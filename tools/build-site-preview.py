#!/usr/bin/env python3
"""
رزرونو — ساختِ پیش‌نمایشِ تک‌فایلیِ وب‌سایت (apps/landing)

چرا لازم است:
  خروجیِ Next روی مسیرهای مطلقِ /_next/... تکیه دارد و فقط پشتِ وب‌سرور باز
  می‌شود. برای نشان‌دادنِ سایت روی گوشیِ کسی (بدونِ سرور، بدونِ اینترنت) یک
  فایلِ HTML لازم است که با دابل‌کلیک کار کند.

چطور کار می‌کند:
  ۱) هر مسیر از سرورِ production خوانده می‌شود (HTMLِ رندرشده‌ی سرور).
  ۲) همه‌ی CSS، JS و فونت‌ها داخلِ فایل inline می‌شوند. چانک‌های webpack به
     ترتیبِ خودشان به‌صورتِ اسکریپتِ کلاسیک می‌آیند تا CORSِ file:// آن‌ها را
     مسدود نکند.
  ۳) صفحه‌ها در یک فایل کنارِ هم می‌نشینند و یک روترِ کوچک بینشان جابه‌جا
     می‌کند؛ لینک‌های داخلی به همان روتر وصل می‌شوند.

  نکته‌ی مهم: خودِ اپلیکیشن دوباره پیاده‌سازی نمی‌شود. همان باندلِ واقعی اجرا
  می‌شود، پس هرچه در سایتِ زنده کار می‌کند اینجا هم کار می‌کند و با تغییرِ کد
  از هم واگرا نمی‌شوند.

اجرا:  python3 tools/build-site-preview.py [--base http://localhost:3200] [--out FILE]
"""
import argparse
import base64
import html
import json
import mimetypes
import os
import re
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# مسیرهایی که در پیش‌نمایش می‌آیند. اولی صفحه‌ی شروع است.
ROUTES = [
    ('/', 'خانه'),
    ('/product', 'محصول'),
    ('/customer-app', 'اپ مشتری'),
    ('/business-app', 'پنل کسب‌وکار'),
    ('/features', 'امکانات'),
    ('/how-it-works', 'چطور کار می‌کند'),
    ('/pricing', 'قیمت‌گذاری'),
    ('/faq', 'پرسش‌ها'),
    ('/blog', 'بلاگ'),
    ('/demo', 'دموی رایگان'),
    ('/contact', 'تماس'),
    ('/about', 'درباره'),
]


def fetch(base, path, binary=False):
    url = base.rstrip('/') + path
    with urllib.request.urlopen(url, timeout=30) as r:
        data = r.read()
    return data if binary else data.decode('utf-8')


def data_uri(path, blob):
    mime = mimetypes.guess_type(path)[0] or 'application/octet-stream'
    if path.endswith('.woff2'):
        mime = 'font/woff2'
    return f'data:{mime};base64,' + base64.b64encode(blob).decode('ascii')


class Inliner:
    """دارایی‌ها را یک‌بار می‌گیرد و کش می‌کند — چند صفحه CSS و چانکِ مشترک دارند."""

    def __init__(self, base):
        self.base = base
        self.cache = {}

    def get(self, path, binary=False):
        key = (path, binary)
        if key not in self.cache:
            self.cache[key] = fetch(self.base, path, binary)
        return self.cache[key]

    def css(self, path):
        """CSS + جاسازیِ فونت‌هایی که به آن ارجاع می‌دهند."""
        text = self.get(path)

        def repl(m):
            ref = m.group(1).strip('\'"')
            if ref.startswith(('data:', 'http')):
                return m.group(0)
            asset = ref if ref.startswith('/') else '/_next/static/css/' + ref
            try:
                return f'url({data_uri(asset, self.get(asset, binary=True))})'
            except Exception:
                return m.group(0)

        return re.sub(r'url\(([^)]+)\)', repl, text)


def js_safe(text):
    """
    هر '</script' داخلِ متن، تگِ اسکریپتِ میزبان را زودتر می‌بندد و بقیه‌ی کد
    به‌عنوان HTML پارس می‌شود. چانک‌های Next این رشته را دارند (کدِ SSR).
    این یک باگِ واقعی بود: کلِ باندل با SyntaxError می‌مرد.
    """
    return text.replace('</script', '<\\/script').replace('<!--', '<\\!--')


def build_bundle():
    """preview/mount.tsx را با esbuild به یک اسکریپتِ کلاسیکِ خودکفا می‌سازد."""
    app = os.path.join(ROOT, 'apps', 'landing')
    out = os.path.join(app, '.next', 'preview-mount.js')
    cmd = [
        os.path.join(app, 'node_modules', '.bin', 'esbuild'),
        'preview/mount.tsx', '--bundle', '--format=iife', '--platform=browser',
        '--target=es2019', '--minify', '--jsx=automatic', '--loader:.json=json',
        '--alias:next/link=./preview/shims/link.tsx',
        '--alias:next/navigation=./preview/shims/navigation.ts',
        '--define:process.env.NODE_ENV="production"',
        # کدِ مشترک به process.env هم دست می‌زند (مثلِ آدرسِ API). در مرورگر
        # process وجود ندارد و کلِ باندل با ReferenceError می‌مرد؛ یک شیِ
        # خالی کافی است چون پیش‌نمایش هیچ درخواستی به API نمی‌فرستد.
        '--banner:js=var process=(typeof process!=="undefined"?process:{env:{NODE_ENV:"production"}});',
        f'--outfile={out}',
    ]
    subprocess.run(cmd, cwd=app, check=True, capture_output=True)
    with open(out, encoding='utf-8') as f:
        return f.read()


def split_shell(page_html):
    """
    <main> را از پوسته (هدر، فوتر، دانه، پرده، دستیار) جدا می‌کند.
    فقط <main> بینِ صفحه‌ها عوض می‌شود؛ پوسته یک بار می‌ماند — درست مثلِ
    layout.tsx در خودِ اپ. اگر پوسته هم کپی می‌شد، هر صفحه یک هدر و فوترِ
    اضافه می‌آورد و چیدمان بهم می‌ریخت.
    """
    m = re.search(r'<body[^>]*>(.*)</body>', page_html, re.S)
    body = m.group(1) if m else page_html
    # بارِ flight (self.__next_f) در همین اسکریپت‌های خطی است و React بدونِ آن
    # hydrate نمی‌کند. جدا نگه داشته می‌شود تا فقط برای صفحه‌ی اول اجرا شود.
    flight = '\n'.join(
        s for s in re.findall(r'<script[^>]*>(.*?)</script>', body, re.S) if '__next_f' in s
    )
    body = re.sub(r'<script\b[^>]*>.*?</script>', '', body, flags=re.S)
    body = re.sub(r'<script\b[^>]*/>', '', body)
    main = re.search(r'(<main\b[^>]*>.*?</main>)', body, re.S)
    if not main:
        return body.strip(), None, flight
    shell = body[:main.start(1)] + '<!--RZ-MAIN-->' + body[main.end(1):]
    return main.group(1).strip(), shell.strip(), flight


ROUTER = r"""
// ── روترِ پیش‌نمایش ────────────────────────────────────────────────────
// صفحه‌ها همه در همین فایل‌اند؛ اینجا فقط <main> عوض می‌شود و انیمیشن‌های
// CSS با کلونِ تازه دوباره از صفر اجرا می‌شوند (همان حسِ ورود به صفحه).
(function () {
  var PAGES = window.__RZ_PAGES__ || {};
  var host = document.getElementById('rz-host');
  var pick = document.getElementById('rz-pick');

  function boot(root) {
    // Reveal: چون IntersectionObserverِ اپ فقط یک‌بار در بارگذاری وصل می‌شود،
    // برای محتوایی که بعداً جایگزین شده دوباره وصلش می‌کنیم.
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.dataset.visible = 'true'; io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    root.querySelectorAll('.reveal').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight) el.dataset.visible = 'true'; else io.observe(el);
    });
  }

  function go(path, push) {
    var page = PAGES[path];
    if (!page) return;
    host.innerHTML = page.main;
    document.title = page.title;
    if (pick) pick.value = path;
    window.scrollTo(0, 0);
    if (push !== false && history.replaceState) history.replaceState(null, '', '#' + path);
    // صحنه‌های تعاملیِ صفحه‌ی تازه دوباره سوار می‌شوند (و قبلی‌ها unmount)
    if (window.__RZ_PAGE__) window.__RZ_PAGE__();
    else boot(host);
  }

  // لینک‌های داخلی → روتر. لینکِ بیرونی و لنگرِ #... دست‌نخورده می‌ماند.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href[0] !== '/' || href.indexOf('//') === 0) return;
    var clean = href.split('#')[0].split('?')[0].replace(/\/$/, '') || '/';
    if (!PAGES[clean]) return;   // صفحه‌ای که در پیش‌نمایش نیست → بی‌اثر
    e.preventDefault();
    go(clean, true);
  });

  if (pick) pick.addEventListener('change', function () { go(pick.value, true); });

  var start = (location.hash || '').slice(1);
  if (!window.__RZ_PAGE__) boot(document.body);   // پشتیبان اگر باندل نیامد
  if (start && PAGES[start] && start !== '/') go(start, false);
})();
"""

SHELL_CSS = r"""
/* نوارِ انتخابِ صفحه — فقط در پیش‌نمایش، نه در سایتِ واقعی */
#rz-bar {
  position: fixed; inset-block-end: 0; inset-inline: 0; z-index: 300;
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  background: rgba(20,16,14,.92); color: #f7f2ec;
  border-block-start: 1px solid rgba(255,255,255,.14);
  font: 500 13px/1.4 var(--font-vazirmatn, system-ui), system-ui, sans-serif;
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
}
#rz-bar b { font-weight: 700; color: #f0a06c; white-space: nowrap; }
#rz-pick {
  flex: 1 1 auto; min-width: 0; padding: 9px 12px; border-radius: 10px;
  background: rgba(255,255,255,.1); color: #fff; font: inherit;
  border: 1px solid rgba(255,255,255,.2); min-height: 40px;
}
#rz-pick option { color: #111; }
body { padding-block-end: 62px; }
/* دکمه و پنلِ دستیار نباید زیرِ نوارِ انتخابِ صفحه بروند */
.askbot__fab, .askbot { inset-block-end: calc(70px + env(safe-area-inset-bottom)) !important; }
/* نشانگرِ سفارشی روی نوار هم باید کار کند */
html.has-cursor #rz-bar, html.has-cursor #rz-bar * { cursor: none !important; }
"""


def build(base, out):
    inl = Inliner(base)
    print(f'  سرور: {base}')

    first = fetch(base, '/')
    head = re.search(r'<head[^>]*>(.*)</head>', first, re.S).group(1)

    # ── CSS: به همان ترتیبی که در <head> آمده ──
    css_paths = re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"', head)
    css_paths += re.findall(r'<link[^>]+href="([^"]+\.css)"[^>]*rel="stylesheet"', head)
    css_paths = list(dict.fromkeys(css_paths))
    css = '\n'.join(inl.css(p) for p in css_paths if p.startswith('/'))
    print(f'  CSS: {len(css_paths)} فایل · {len(css)//1024}KB')

    # ── جاوااسکریپتِ اپ ──
    # چانک‌های Turbopack عمداً استفاده نمی‌شوند: بارگذارِ آن‌ها بقیه‌ی چانک‌ها
    # را در زمانِ اجرا fetch می‌کند و روی file:// این کار شکست می‌خورد و
    # hydration بی‌صدا متوقف می‌ماند (اندازه‌گیری شد: صفحه رندر می‌شد ولی هیچ
    # بومی نقاشی نمی‌کرد). به‌جایش preview/mount.tsx با esbuild به یک
    # اسکریپتِ کلاسیک تبدیل می‌شود که همان کامپوننت‌های واقعی را سوار می‌کند.
    bundle = build_bundle()
    print(f'  باندلِ پیش‌نمایش: {len(bundle)//1024}KB')

    # ── صفحه‌ها ──
    pages, options, shell, flight = {}, [], None, ''
    for path, label in ROUTES:
        try:
            doc = fetch(base, path)
        except Exception as e:
            print(f'   ⚠️  {path} نیامد ({e})')
            continue
        main, sh, fl = split_shell(doc)
        if sh and shell is None:
            shell = sh       # پوسته از صفحه‌ی اول گرفته می‌شود و ثابت می‌ماند
            flight = fl      # بارِ hydration هم فقط از همان صفحه
        title = re.search(r'<title[^>]*>(.*?)</title>', doc, re.S)
        pages[path] = {
            'main': main,
            'title': html.unescape(title.group(1)).strip() if title else label,
        }
        options.append(f'<option value="{path}">{label}</option>')
        print(f'  ✓ {path:<16} {len(main)//1024}KB')

    if shell is None:
        raise SystemExit('پوسته پیدا نشد — آیا <main> در HTMLِ سرور هست؟')
    home = pages['/']
    body_attr = re.search(r'<body([^>]*)>', first)
    body_attr = body_attr.group(1) if body_attr else ''
    html_attr = re.search(r'<html([^>]*)>', first)
    html_attr = html_attr.group(1) if html_attr else ' lang="fa" dir="rtl"'
    # پرده‌ی ورود روی sessionStorage قفل است؛ در پیش‌نمایش باید هر بار دیده شود
    inline_head_scripts = re.findall(r'<script>(.*?)</script>', head, re.S)
    boot_js = '\n'.join(s for s in inline_head_scripts if 'rz_intro' not in s)

    doc = f"""<!doctype html>
<html{html_attr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(home['title'])}</title>
<style>{css}</style>
<style>{SHELL_CSS}</style>
<script>{boot_js}</script>
</head>
<body{body_attr}>
{shell.replace('<!--RZ-MAIN-->', '<div id="rz-host">' + home['main'] + '</div>')}

<div id="rz-bar">
  <b>پیش‌نمایشِ رزرونو</b>
  <select id="rz-pick" aria-label="انتخابِ صفحه">{''.join(options)}</select>
</div>

<script>window.__RZ_PAGES__ = {js_safe(json.dumps(pages, ensure_ascii=False))};</script>
<script>{js_safe(bundle)}</script>
<script>{ROUTER}</script>
</body>
</html>
"""
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(doc)
    print(f'\n  → {out}  ({os.path.getsize(out)/1024/1024:.2f}MB · {len(pages)} صفحه)')
    return out


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://localhost:3200')
    ap.add_argument('--out', default=os.path.join(ROOT, 'standalone', 'website.html'))
    a = ap.parse_args()
    try:
        build(a.base, a.out)
    except urllib.error.URLError as e:
        print(f'سرور در دسترس نیست ({a.base}): {e}\nاول: cd apps/landing && npm run build && PORT=3200 npm run start')
        sys.exit(1)
