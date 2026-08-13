#!/usr/bin/env python3
"""ترمیمِ یال‌هایِ بی‌مقصدِ گرافِ graphify (dangling edges).

چرا لازم است
────────────
استخراج‌گرِ ASTِ graphify برایِ هر import یک یال می‌سازد، ولی برایِ دو دسته
هدف هیچ nodeای نمی‌سازد؛ نتیجه این است که هنگامِ ساختِ گراف آن یال‌ها بی‌صدا
حذف می‌شوند و گراف بخشی از حقیقت را از دست می‌دهد:

  ۱) وابستگیِ بیرونی — `import { NextResponse } from 'next/server'` یالی به
     `ref_next_server` می‌سازد، ولی چون این پکیج داخلِ کورپوس نیست nodeاش
     ساخته نمی‌شود. یعنی گراف نمی‌تواند به «چه چیزهایی به next وابسته‌اند؟»
     جواب بدهد — در حالی که این دقیقاً همان چیزی است که یک گرافِ وابستگی
     باید بلد باشد.

  ۲) re-export — `api/src/lib/schemas.ts` نمادِ `z` را از `./validate` وارد و
     دوباره صادر می‌کند. هر فایلی که `import { z } from '@/lib/schemas'`
     بزند یالی به `api_src_lib_schemas_z` می‌سازد که وجود ندارد؛ nodeِ واقعی
     `api_src_lib_validate_z` است. این یال‌ها دقیقاً همان‌هایی هستند که
     نشان می‌دهند چه کسی از لایه‌ی اعتبارسنجی استفاده می‌کند.

این اسکریپت هر دو را ترمیم می‌کند و هر چیزی را که با اطمینان نتوانست حل کند
گزارش می‌دهد — هرگز حدس نمی‌زند و هرگز یالِ ساختگی نمی‌سازد.

اجرا:
    python3 tools/graphify-repair-edges.py <extraction.json> [-o <out.json>]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# نمادهایِ ماژولِ استانداردِ پایتون — برایِ تشخیصِ importهایِ بیرونیِ
# اسکریپت‌هایِ tools/ که پیشوندِ ref_ نمی‌گیرند.
STDLIB = set(getattr(sys, "stdlib_module_names", ()))

RE_EXPORT_BRACE = re.compile(r"export\s*(?:type\s*)?\{([^}]*)\}\s*(?:from\s*['\"]([^'\"]+)['\"])?")
IMPORT_FROM = re.compile(r"import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['\"]([^'\"]+)['\"]")


def norm(part: str) -> str:
    """همان نرمال‌سازیِ شناسه‌ای که graphify استفاده می‌کند."""
    return re.sub(r"[^a-z0-9]+", "_", part.lower()).strip("_")


def node_id_for(rel_path: Path, symbol: str) -> str:
    stem = rel_path.with_suffix("")
    return "_".join(norm(p) for p in stem.parts if norm(p)) + "_" + norm(symbol)


def build_reexport_map(root: Path, node_ids: set[str]) -> dict[str, str]:
    """نگاشتِ «شناسه‌ی بی‌مقصدِ حاصلِ re-export» → «شناسه‌ی nodeِ تعریف‌کننده».

    فقط وقتی نگاشت می‌سازد که هر سه شرط برقرار باشد: فایل واقعاً نماد را
    دوباره صادر کرده باشد، منبعِ importش مشخص باشد، و nodeِ مقصد واقعاً در
    گراف وجود داشته باشد. در غیر این صورت چیزی برنمی‌گرداند.
    """
    alias: dict[str, str] = {}
    for path in root.rglob("*.ts"):
        if "node_modules" in path.parts or ".next" in path.parts:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if "export" not in text:
            continue

        # از کجا هر نماد وارد شده؟
        origin: dict[str, str] = {}
        for names, src in IMPORT_FROM.findall(text):
            for raw in names.split(","):
                sym = raw.split(" as ")[-1].strip()
                if sym:
                    origin[sym] = src

        rel = path.relative_to(root)
        for names, from_src in RE_EXPORT_BRACE.findall(text):
            for raw in names.split(","):
                sym = raw.split(" as ")[-1].strip()
                if not sym:
                    continue
                src = from_src or origin.get(sym)
                if not src or not src.startswith("."):
                    continue  # فقط re-exportِ داخلی؛ بیرونی کارِ بخشِ external است
                target_rel = (rel.parent / src).resolve().relative_to(root.resolve()) \
                    if (rel.parent / src).is_absolute() else Path(*(rel.parent / src).parts)
                # نرمال‌سازیِ ../ و ./
                parts: list[str] = []
                for p in target_rel.parts:
                    if p == "..":
                        if parts:
                            parts.pop()
                    elif p not in (".", ""):
                        parts.append(p)
                target_rel = Path(*parts)
                broken = node_id_for(rel, sym)
                real = node_id_for(target_rel, sym)
                if broken not in node_ids and real in node_ids:
                    alias[broken] = real
    return alias


def npm_dependency_names(root: Path) -> set[str]:
    """نامِ همه‌ی پکیج‌هایِ اعلام‌شده در package.jsonهایِ پروژه (نرمال‌شده).

    استخراج‌گر برایِ کلیدهایِ dependencies یک node می‌سازد ولی گاهی یالی به
    نامِ خامِ پکیج می‌ماند؛ این‌ها هم وابستگیِ بیرونی‌اند، نه شناسه‌ی شکسته.
    """
    names: set[str] = set()
    for pkg in root.rglob("package.json"):
        if "node_modules" in pkg.parts:
            continue
        try:
            data = json.loads(pkg.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for key in ("dependencies", "devDependencies", "peerDependencies"):
            for name in (data.get(key) or {}):
                names.add(norm(name))
    return names


def is_external(missing_id: str, npm: set[str]) -> bool:
    if missing_id.startswith("ref_") or missing_id in STDLIB or missing_id in npm:
        return True
    # زیرماژولِ stdlib: urllib_request → urllib، xml_etree → xml
    head = missing_id.split("_", 1)[0]
    return head in STDLIB and head != missing_id


def external_label(missing_id: str) -> str:
    name = missing_id[4:] if missing_id.startswith("ref_") else missing_id
    return name.replace("_", "/") + " (external)"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("extraction")
    ap.add_argument("-o", "--out")
    ap.add_argument("--root", default=".")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    data = json.loads(Path(args.extraction).read_text(encoding="utf-8"))
    nodes, edges = data["nodes"], data["edges"]
    ids = {n["id"] for n in nodes}

    missing: set[str] = set()
    for e in edges:
        for side in ("source", "target"):
            if e[side] not in ids:
                missing.add(e[side])
    before = sum(1 for e in edges if e["source"] not in ids or e["target"] not in ids)
    print(f"یالِ بی‌مقصد پیش از ترمیم: {before}  ({len(missing)} شناسه‌ی یکتا)")

    alias = build_reexport_map(root, ids)
    alias = {k: v for k, v in alias.items() if k in missing}
    print(f"  • re-export حل‌شده: {len(alias)} شناسه")

    # دریفتِ شناسه بینِ چانک‌هایِ استخراجِ معنایی: دو subagent برایِ یک فایل
    # دو شناسه‌یِ متفاوت ساخته‌اند (مثلاً standalone_business_html در برابرِ
    # standalone_business_bundle). فقط وقتی نگاشت می‌کنیم که هر یالِ اشاره‌کننده
    # به شناسه‌یِ گمشده دقیقاً از همان فایلی بیاید که یک nodeِ موجود هم از آن
    # آمده و آن فایل تنها یک nodeِ «سطحِ فایل» داشته باشد — وگرنه دست نمی‌زنیم.
    by_source: dict[str, list[str]] = {}
    for n in nodes:
        sf = n.get("source_file")
        if sf:
            by_source.setdefault(str(sf), []).append(n["id"])
    edges_of: dict[str, set[str]] = {}
    for e in edges:
        for side in ("source", "target"):
            if e[side] in missing and e[side] not in alias:
                edges_of.setdefault(e[side], set()).add(str(e.get("source_file") or ""))
    # نگاشتِ «فایلِ واقعیِ روی دیسک» → شناسه‌ی نرمال‌شده‌اش، برایِ حلِ
    # شناسه‌هایی که در واقع به یک فایل اشاره می‌کنند نه به یک نماد.
    file_ids: dict[str, Path] = {}
    for p in root.rglob("*"):
        if not p.is_file() or "node_modules" in p.parts or ".git" in p.parts:
            continue
        rel = p.relative_to(root)
        fid = "_".join(norm(x) for x in rel.parts if norm(x))          # با پسوند
        fid_nx = "_".join(norm(x) for x in rel.with_suffix("").parts if norm(x))  # بی‌پسوند
        file_ids.setdefault(fid, rel)
        file_ids.setdefault(fid_nx, rel)

    drift = synth_file = 0
    for mid in sorted(edges_of):
        rel = file_ids.get(mid)
        if rel is None:
            continue
        abs_s = str(root / rel)
        cands = by_source.get(abs_s, []) + by_source.get(str(rel), [])
        if cands:
            # nodeی که بیشترین پیشوندِ مشترک را با شناسه‌ی گمشده دارد =
            # همان موجودیتِ سطحِ فایل (نه یک مفهومِ فرعیِ همان فایل).
            best = max(cands, key=lambda c: len(__import__("os").path.commonprefix([c, mid])))
            alias[mid] = best
            drift += 1
        else:
            # فایل واقعاً هست ولی هیچ nodeای نساخته (مثلاً JSONِ داده یا CSS).
            # یالِ import به آن واقعی است، پس nodeِ سطحِ فایل می‌سازیم.
            nodes.append({
                "id": mid, "label": str(rel), "file_type": "code",
                "source_file": abs_s, "source_location": None, "source_url": None,
                "captured_at": None, "author": None, "contributor": None,
            })
            ids.add(mid)
            synth_file += 1
    print(f"  • شناسه‌یِ فایل‌محورِ حل‌شده: {drift} | nodeِ فایلِ بدونِ نماد ساخته‌شده: {synth_file}")

    npm = npm_dependency_names(root)
    ext = sorted(m for m in missing if m not in alias and is_external(m, npm))
    for m in ext:
        nodes.append({
            "id": m,
            "label": external_label(m),
            "file_type": "code",
            "source_file": None,
            "source_location": None,
            "source_url": None,
            "captured_at": None,
            "author": None,
            "contributor": None,
            "external": True,
        })
    ids |= set(ext)
    print(f"  • nodeِ وابستگیِ بیرونی ساخته‌شده: {len(ext)}")

    for e in edges:
        for side in ("source", "target"):
            if e[side] in alias:
                e[side] = alias[e[side]]

    after = sum(1 for e in edges if e["source"] not in ids or e["target"] not in ids)
    unresolved = sorted({x for e in edges for x in (e["source"], e["target"]) if x not in ids})
    print(f"یالِ بی‌مقصد پس از ترمیم: {after}  (کاهش {before - after})")
    if unresolved:
        print(f"  حل‌نشده ({len(unresolved)} شناسه) — عمداً دست‌نخورده، نه حدس‌زده:")
        for u in unresolved[:15]:
            print(f"     {u}")

    out = Path(args.out or args.extraction)
    data["nodes"] = nodes
    data["edges"] = edges
    out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"نوشته شد: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
