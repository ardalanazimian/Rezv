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

# ── ۵) CSP هیچ میزبانِ فونتِ ثالثی را مجاز نکند ──
#
# چرا این بند جداگانه لازم بود: بندِ ۳ فقط HTML را می‌دید. تا ۲۰۲۶-۰۹-۰۴
# هر دو پروکسی در CSP به fonts.googleapis.com و fonts.gstatic.com اجازه می‌دادند
# در حالی که هیچ کدی آن‌ها را صدا نمی‌زد — یعنی گارد سبز بود و در عینِ حال
# درِ پشتی باز مانده بود.
#
# چرا مجوزِ بلااستفاده بی‌ضرر نیست: اگر یک رگرسیون دوباره <link> را بیاورد،
# در ایران مرورگر تا timeout منتظر می‌ماند؛ و چون stylesheet رندر را مسدود
# می‌کند، کاربر چند ثانیه صفحه‌ی سفید می‌بیند. با بستنِ CSP، همان
# درخواست فوری رد می‌شود: شکستِ سریع به‌جای معلقِ کند.
PROXY_CONFIGS = ('deploy/caddy/Caddyfile', 'deploy/nginx/nginx.conf')
THIRD_PARTY_FONT_HOSTS = ('fonts.googleapis.com', 'fonts.gstatic.com')

_seen_csp = 0
for p in PROXY_CONFIGS:
    if not os.path.exists(p):
        fails.append(p + ' — نیست؛ بندِ ۵ بدونِ موضوع توخالی سبز می‌ماند')
        continue
    text = io.open(p, encoding='utf-8').read()
    # کامنت‌ها را حذف کن — توضیحِ «چرا حذفش کردیم» نباید خودش گارد را قرمز کند.
    live = re.sub(r'^\s*#.*$', '', text, flags=re.M)
    for line in live.splitlines():
        if 'Content-Security-Policy' not in line:
            continue
        _seen_csp += 1
        for host in THIRD_PARTY_FONT_HOSTS:
            if host in line:
                fails.append(p + ' — CSP هنوز ' + host + ' را مجاز می‌کند؛ در ایران یعنی رندرِ معلق تا timeout')
        # ⚠️ دریوِ font-src را جدا کن، نه کلِ خط. نسخه‌ی اول `'data:' not in line` بود و
        # چون همان خط `img-src 'self' data: https:` دارد، حذفِ data: از font-src را
        # نمی‌گرفت — با جهشِ M3 پیدا شد (۲۰۲۶-۰۹-۰۴).
        m = re.search(r'font-src([^;"]*)', line)
        if m and 'data:' not in m.group(1):
            fails.append(p + " — font-src بدونِ data: است؛ بسته‌ی standalone فونتِ base64 دارد و می‌شکند")

# قاعده‌ی ۵ CLAUDE.md: نبودِ موضوع باید خطا باشد، نه عبور.
if _seen_csp == 0:
    fails.append('هیچ هدرِ CSP در پیکربندیِ پروکسی پیدا نشد — بندِ ۵ چیزی را نسنجیده است')

# ── ۶) سطح‌هایِ Next.js: landing و seo ──
#
# چرا این بند لازم بود (شکافی که تا ۲۰۲۶-۰۹-۱۰ باز بود): APPS بالا سه اپِ
# وانیلا است. ولی **پنج** سطح رابطِ فارسی دارند — `apps/landing` و `apps/seo`
# هم. یعنی این گارد سه‌پنجم را می‌دید و سبزش «فونت درست است» خوانده می‌شد.
#
# و این دقیقاً همان سطحی است که رگرسیونش **قبلاً رخ داده**: کامنتِ
# `apps/landing/app/layout.tsx:18-22` ثبت کرده که تا ممیزیِ ۲۰۲۶-۰۸-۲۴ از
# `next/font/google` استفاده می‌شد — که در زمانِ **build** به
# fonts.googleapis.com وصل می‌شود. یعنی buildِ داخلِ ایران یا می‌شکست یا
# بی‌صدا بدونِ فونت می‌ماند. رفع شد، و هیچ‌چیز جلویِ برگشتش را نمی‌گرفت.
#
# سه سطحِ دیگرِ این فایل با هم فرق دارند و عمداً جدا سنجیده می‌شوند: آن‌ها
# `@font-face` در CSS دارند، این‌ها `localFont()` در TSX.
NEXT_SURFACES = ('landing', 'seo')

for app in NEXT_SURFACES:
    root = 'apps/' + app
    if not os.path.isdir(root):
        # همان قاعده‌ی بندِ ۵: نبودِ موضوع خطاست، نه عبور. اگر سطحی حذف/
        # جابه‌جا شد، این فهرست باید عمداً به‌روز شود — نه اینکه بی‌صدا
        # صفر فایل بسنجد.
        fails.append(root + ' — در NEXT_SURFACES هست ولی وجود ندارد؛ فهرست را به‌روز کن')
        continue

    # الف) فایلِ فونتِ محلی واقعاً هست و فونتِ معتبر است؟
    found = []
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.next')]
        for f in files:
            if f.lower().endswith(('.woff2', '.woff', '.ttf', '.otf')):
                found.append(os.path.join(base, f))
    if not found:
        fails.append(root + ' — هیچ فایلِ فونتِ self-hosted ندارد (پس یا CDN است یا بی‌فونت)')
    for p in found:
        if not check_magic(p):
            fails.append(p + ' — بایت‌هایِ آغازین با قالبش نمی‌خواند (فایلِ خراب؟)')

    # ب) هیچ‌جا `next/font/google` نباشد — همان رگرسیونی که یک‌بار رخ داد.
    #    کامنت‌ها حذف می‌شوند، وگرنه همان کامنتی که می‌گوید «حذفش کردیم»
    #    خودش گارد را قرمز می‌کند.
    _seen_localfont = 0
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.next')]
        for f in files:
            if not f.endswith(('.ts', '.tsx', '.js', '.jsx')):
                continue
            p = os.path.join(base, f)
            try:
                text = io.open(p, encoding='utf-8').read()
            except Exception:
                continue
            live = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
            live = re.sub(r'^\s*//.*$', '', live, flags=re.M)
            if 'next/font/google' in live:
                fails.append(p + ' — next/font/google برگشته؛ در زمانِ build به fonts.googleapis.com وصل می‌شود و buildِ داخلِ ایران می‌شکند یا بی‌فونت می‌ماند')
            # ج) هر localFont باید به فایلی اشاره کند که هست.
            for m in re.finditer(r'''src\s*:\s*['"]([^'"]+\.(?:woff2|woff|ttf|otf))['"]''', live, re.I):
                _seen_localfont += 1
                target = os.path.normpath(os.path.join(base, m.group(1)))
                if not os.path.exists(target):
                    fails.append(p + ' — localFont به فایلِ ناموجود اشاره می‌کند: ' + m.group(1))

    # د) اعلانِ CSSی — **مکانیزمِ دومِ معتبر**، نه شکلِ خراب.
    #
    # ⚠️ نسخه‌ی اولِ همین بند فقط `localFont()` را می‌پذیرفت و `apps/seo` را
    # قرمز کرد. یافته نبود؛ **گارد غلط بود**: seo فونت را با `@font-face` در
    # `app/globals.css` اعلام می‌کند که کاملاً درست است. دو سطحِ Next دو
    # مکانیزمِ متفاوت دارند و هیچ‌کدام اشتباه نیست.
    #
    # درسش همان چیزی است که این فایل جای دیگر هم می‌گوید: گاردی که یک شکلِ
    # پیاده‌سازی را «تنها شکلِ درست» فرض کند، کدِ سالم را قرمز می‌کند — و آن
    # قرمزِ کاذب بدتر از سبزِ کاذب نیست، ولی همان‌قدر اعتماد را می‌سوزاند.
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.next')]
        for f in files:
            if not f.endswith('.css'):
                continue
            p = os.path.join(base, f)
            css = io.open(p, encoding='utf-8').read()
            css_live = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
            for m in re.finditer(r'''url\(\s*['"]?([^)'"]+?\.(?:woff2|woff|ttf|otf))['"]?\s*\)''', css_live, re.I):
                _seen_localfont += 1
                ref = m.group(1)
                # مسیرِ مطلق در Next از `public/` سرو می‌شود، نه از کنارِ CSS.
                target = os.path.normpath(os.path.join(root, 'public', ref.lstrip('/'))) \
                    if ref.startswith('/') else os.path.normpath(os.path.join(base, ref))
                if not os.path.exists(target):
                    fails.append(p + ' — @font-face به فایلِ ناموجود اشاره می‌کند: ' + ref)

    if _seen_localfont == 0:
        fails.append(root + ' — نه localFont(src=…) و نه @font-face با url() پیدا نشد؛ یا فونت اصلاً اعلام نمی‌شود یا شکلش عوض شده و این بند چیزی نسنجیده')

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
print('  (بدونِ هیچ وابستگی به CDNِ ثالث — نه در HTML و نه در CSPِ پروکسی)')
