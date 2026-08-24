#!/usr/bin/env python3
"""
رزرونو — راستی‌آزماییِ فونت

اعلانِ `@font-face` یعنی فونت **کار می‌کند**؟ نه. این اسکریپت واقعاً بررسی
می‌کند که فایلِ فونت وجود دارد، به هر سه اپ رسیده، در بسته‌ی آفلاین جاسازی
شده، و بایت‌هایش یک فونتِ معتبر است — نه صرفاً یک رشته‌ی base64.

اجرا:  python tools/check-fonts.py
خروجی: exit 0 اگر همه‌چیز درست باشد، وگرنه 1 با گزارشِ دقیق.
"""
import base64, io, os, re, sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

APPS = ('customer', 'business', 'company')
# امضایِ بایتِ آغازینِ هر قالب — «فایل هست» کافی نیست، باید واقعاً فونت باشد.
MAGIC = {'.woff2': b'wOF2', '.woff': b'wOFF', '.ttf': b'\x00\x01\x00\x00', '.otf': b'OTTO'}

fails, warns = [], []


def check_magic(path):
    ext = os.path.splitext(path)[1].lower()
    want = MAGIC.get(ext)
    if not want:
        return True
    with open(path, 'rb') as fh:
        return fh.read(4) == want


# ── ۱) منبع ──
src_dir = 'shared/fonts'
sources = [f for f in os.listdir(src_dir) if f.lower().endswith(('.woff2', '.woff', '.ttf', '.otf'))] \
    if os.path.isdir(src_dir) else []
if not sources:
    fails.append('shared/fonts/ هیچ فایلِ فونتی ندارد')
print('منبع (shared/fonts): ' + (', '.join(sources) if sources else '—'))
for f in sources:
    p = os.path.join(src_dir, f)
    if not check_magic(p):
        fails.append(p + ' — بایت‌هایِ آغازین با قالبش نمی‌خواند (فایلِ خراب؟)')

# ── ۲) کپی در هر اپ ──
for app in APPS:
    d = 'apps/' + app + '/fonts'
    for f in sources:
        p = os.path.join(d, f)
        if not os.path.exists(p):
            fails.append(p + ' — نیست (اجرا کن: sh tools/sync-design-system.sh)')
        elif os.path.getsize(p) != os.path.getsize(os.path.join(src_dir, f)):
            fails.append(p + ' — اندازه با منبع فرق دارد')

# ── ۳) هر اپ فونت را اعلام می‌کند و به CDN وابسته نیست ──
for app in APPS:
    html_p = 'apps/' + app + '/index.html'
    html = io.open(html_p, encoding='utf-8').read()
    # کامنت‌ها را در نظر نگیر — فقط ارجاعِ واقعی مهم است
    live = re.sub(r'<!--.*?-->', '', html, flags=re.S)
    if 'fonts.googleapis.com' in live or 'fonts.gstatic.com' in live:
        fails.append(html_p + ' — هنوز به CDNِ فونتِ ثالث وابسته است')
    if 'css/fonts.css' not in live:
        fails.append(html_p + ' — css/fonts.css را لود نمی‌کند')

    css_p = 'apps/' + app + '/css/fonts.css'
    if not os.path.exists(css_p):
        fails.append(css_p + ' — نیست')
        continue
    css = io.open(css_p, encoding='utf-8').read()
    for m in re.finditer(r'''url\(\s*['"]?([^)'"]+?\.(?:woff2|woff|ttf|otf))['"]?\s*\)''', css, re.I):
        target = os.path.normpath(os.path.join('apps/' + app + '/css', m.group(1)))
        if not os.path.exists(target):
            fails.append(css_p + ' — @font-face به فایلِ ناموجود اشاره می‌کند: ' + m.group(1))

# ── ۴) بسته‌ی آفلاین: فونت واقعاً جاسازی شده؟ ──
for app in APPS:
    p = 'standalone/' + app + '.html'
    if not os.path.exists(p):
        warns.append(p + ' — ساخته نشده (python tools/build-standalone.py)')
        continue
    s = io.open(p, encoding='utf-8').read()
    blobs = re.findall(r'data:font/(?:woff2|woff|ttf|otf);base64,([A-Za-z0-9+/=]+)', s)
    if not blobs:
        fails.append(p + ' — هیچ فونتی جاسازی نشده (روی file:// بدونِ فونتِ فارسی رندر می‌شود)')
    for b in blobs:
        try:
            raw = base64.b64decode(b)
        except Exception:
            fails.append(p + ' — base64ِ فونت قابلِ decode نیست')
            continue
        if raw[:4] not in MAGIC.values():
            fails.append(p + ' — دادهٔ جاسازی‌شده فونتِ معتبر نیست')
    live = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    if re.search(r'url\(\s*[\'"]?\.\./fonts/', live):
        fails.append(p + ' — مسیرِ نسبیِ فونت باقی مانده (روی file:// کار نمی‌کند)')
    if 'as="font"' in live:
        fails.append(p + ' — <link rel=preload as=font> باقی مانده (روی file:// فقط ۴۰۴)')

# ── گزارش ──
print()
for w in warns:
    print('  ⚠️  ' + w)
if fails:
    print('✗ راستی‌آزماییِ فونت شکست خورد (' + str(len(fails)) + ' مورد):')
    for f in fails:
        print('    • ' + f)
    sys.exit(1)
print('✓ فونت درست است: منبع، کپیِ هر سه اپ، اعلانِ @font-face، و جاسازیِ آفلاین')
print('  (بدونِ هیچ وابستگی به CDNِ ثالث)')
