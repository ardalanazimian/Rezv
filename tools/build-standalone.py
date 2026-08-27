#!/usr/bin/env python3
"""
رزرونو — ساختِ نسخه‌ی آفلاینِ تک‌فایلی از apps/

چرا لازم است:
  apps/*/index.html از مسیرهای مطلق (/css/..., /js/...) استفاده می‌کند که فقط پشتِ
  وب‌سرور کار می‌کند. علاوه بر آن اپ مشتری ES Module است و مرورگر ماژول را روی
  file:// به‌خاطر CORS مسدود می‌کند.

  این اسکریپت برای هر اپ یک HTML خودکفا می‌سازد: CSS و JS داخلِ خودِ فایل inline
  می‌شوند و ماژول‌های اپ مشتری به یک اسکریپتِ کلاسیک ادغام می‌شوند. نتیجه با
  دابل‌کلیک یا روی گوشی (بدون سرور و بدون نصب) کار می‌کند.

اجرا:  python3 tools/build-standalone.py
خروجی: standalone/{customer,business,company}.html
"""
import re, os, sys, base64

# رفعِ واقعی (۲۰۲۶-۰۸-۲۳): این اسکریپت روی ویندوز کرش می‌کرد — نه موقعِ ساخت،
# بلکه دقیقاً موقعِ چاپِ نتیجه (کنسولِ پیش‌فرض cp1252 است و نمی‌تواند '\u2705'
# را encode کند). بدتر: crash *بعد از* نوشتنِ فایلِ اول رخ می‌داد، پس
# customer.html ساخته می‌شد و دوتایِ دیگر نه — یک بسته‌ی نیمه‌کاره بدونِ هشدارِ
# روشن. عملاً هیچ توسعه‌دهنده‌ی ویندوزی نمی‌توانست این تحویل را بازتولید کند.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(ROOT, 'standalone')

# ترتیبِ ادغامِ ماژول‌های اپ مشتری.
# گرافِ واقعی حلقه‌دار است (api ↔ auth، discover ↔ detail)؛ چون همه در یک scope
# ادغام می‌شوند و function ها hoist می‌شوند، حلقه‌ها مشکلی نمی‌سازند. فقط ماژول‌های
# بدونِ وابستگی باید اول بیایند و نقطه‌ی ورود (main) آخر.
#
# ⚠️ رفعِ باگ (live-test ۲۰۲۶-۰۸-۱۲): این لیست با اپِ واقعی (main.js، ۲۵ ایمپورت
# + ۳ وابستگیِ transitive که main.js مستقیم import نمی‌کند: api-core.js،
# waitlist.js، data/booking.js) به‌طورِ سیستماتیک مقایسه شد — ۱۱ ماژولِ واقعی
# اصلاً در این لیست نبودن (analytics.js, api-core.js, data/booking.js,
# waitlist.js, و ۷ فایلِ features/*). چون build_standalone.py فقط خطِ import را
# پاک می‌کند و چک نمی‌کند اسمِ importشده واقعاً در باندل تعریف شده یا نه، اسکریپت
# بدونِ هیچ هشداری «✅» چاپ می‌کرد، ولی HTMLِ خروجی رویِ اولین تماسِ API با
# `ReferenceError: httpJson is not defined` می‌شکست (چون api.js از api-core.js
# می‌خواندش و api-core.js اصلاً در باندل نبود) — بدونِ کارکردنِ کلِ لیستِ انتظار،
# آنالیتیکس، onboarding، pull-refresh، swipe-actions، live-strip، و a11y هم.
# لیستِ زیر از importهای واقعیِ main.js مشتق شده + ۳ وابستگیِ transitive در
# جایگاهِ درست (api-core.js قبل از api.js؛ waitlist.js قبل از data/booking.js
# چون booking.js از آن offerWaitlist می‌خواهد؛ data/booking.js زود، قبل از
# auth.js/data/discover.js که از آن faTime/quickBook می‌خواهند).
CUSTOMER_ORDER = [
    'js/icons.js', 'js/api-core.js', 'js/data/seed.js', 'js/waitlist.js',
    'js/data/booking.js', 'js/store.js', 'js/actions.js', 'js/api.js',
    'js/analytics.js', 'js/data/discover.js', 'js/data/detail.js',
    'js/reservation.js', 'js/features/trips.js', 'js/features/loyalty.js',
    'js/features/economy.js',
    'js/features/rewards.js', 'js/features/food-dna.js', 'js/features/chat.js',
    'js/features/checkin.js',
    'js/features/palette.js', 'js/features/notifications.js',
    'js/features/a11y.js', 'js/features/onboarding.js',
    'js/features/pull-refresh.js', 'js/features/swipe-actions.js',
    'js/features/live-strip.js', 'js/user-profile.js', 'js/auth.js',
    'js/theme-pwa.js', 'js/init.js', 'js/main.js',
]

def strip_module(code, path):
    """حذفِ نحوِ ES Module تا کد به‌عنوان اسکریپتِ کلاسیک اجرا شود."""
    has_export = bool(re.search(r'^\s*export\b', code, re.M))
    code = re.sub(r'^\s*import\s+[^;]*?;\s*$', '', code, flags=re.M | re.S)
    code = re.sub(r'^\s*import\s*\{[^}]*\}\s*from\s*[\'"][^\'"]+[\'"]\s*;?\s*$', '', code, flags=re.M | re.S)
    code = re.sub(r'^\s*export\s+(?=(async\s+)?(function|const|let|var|class)\b)', '', code, flags=re.M)
    code = re.sub(r'^\s*export\s*\{[^}]*\}\s*;?\s*$', '', code, flags=re.M)
    code = re.sub(r'^\s*export\s+default\s+', '', code, flags=re.M)
    # رفعِ تصادمِ نام: chat.js نسخه‌ی محلی و متفاوتی از esc/faTime دارد.
    # در scope مشترک یکی دیگری را بازنویسی می‌کرد؛ اینجا نام‌گذاریِ مجزا می‌شود.
    # (chat.js چیزی export می‌کند، پس IIFE-wrap عمومیِ زیر برایش صدق نمی‌کند —
    # باید دستی و هدفمند رفع شود.)
    if path.endswith('features/chat.js'):
        code = re.sub(r'\besc\b', 'chatEsc', code)
        code = re.sub(r'\bfaTime\b', 'chatFaTime', code)
    # ⚠️ رفعِ باگِ کلاس (live-test ۲۰۲۶-۰۸-۱۲): pull-refresh.js و swipe-actions.js
    # هر دو `const THRESHOLD`، `let _busy`، و تابع‌های `reduced/onMove/onStart`ِ
    # هم‌نام و کاملاً بی‌ربط داشتن — در ES modules مشکلی نبود (هرکدام scope
    # خودشو داره)، ولی در اسکریپتِ کلاسیکِ مشترک، `const`/`let` تکراری
    # SyntaxError می‌داد (کلِ باندل رو از کار می‌انداخت) و توابعِ تکراری بی‌صدا
    # همدیگه رو بازنویسی می‌کردن (یکی از دو ژست‌کنترل‌کننده silently می‌شکست) —
    # با live-test در مرورگرِ واقعی پیدا شد، نه فرض. به‌جایِ رفعِ تک‌تکِ اسم‌ها
    # (که با هر افزودنِ ماژولِ تازه دوباره می‌شکنه)، هر ماژولی که هیچ export
    # نداره (یعنی فقط side-effect است، چیزی از بیرون بهش دسترسی لازم نداره)
    # در IIFEِ خودش پیچیده می‌شه تا اسکوپِ محلیِ ES module رو شبیه‌سازی کنه.
    if not has_export:
        code = '(function(){\n' + code + '\n})();'
    return code

def find_top_level_clashes(parts):
    """اعلان‌هایِ هم‌نامِ سطحِ‌بالا بینِ ماژول‌هایِ IIFE-نشده را پیدا می‌کند.

    چرا این گارد لازم شد (باگِ واقعیِ کشف‌شده ۲۰۲۶-۰۸-۲۳): strip_module فقط
    ماژول‌هایی را در IIFE می‌پیچد که **هیچ export ندارند**. ماژول‌هایی که export
    دارند در scopeِ مشترکِ باندل باز می‌مانند — و `palette.js` و
    `notifications.js` هر دو `function ensureEl()` و `function render()` داشتند.
    اعلانِ دوباره‌ی `function` خطا نمی‌دهد؛ آخری بی‌صدا برنده می‌شود. نتیجه در
    بسته‌ی آفلاینِ تحویل‌شده: بازکردنِ «پالتِ فرمان» به‌جایِ پالت، **مرکزِ اعلان**
    را می‌ساخت و رندر می‌کرد. هیچ تست/لینتی این را نمی‌دید چون منبعِ ESM کاملاً
    سالم است و فقط باندل خراب می‌شود.

    فقط قطعه‌هایی بررسی می‌شوند که در IIFE نپیچیده‌اند (یعنی با `(function(){`
    شروع نمی‌شوند) — بقیه scopeِ خودشان را دارند و تصادم ندارند.
    """
    seen, clashes = {}, []
    for part in parts:
        m = re.match(r'\s*/\* ═══ (\S+) ═══ \*/\n(.*)', part, re.S)
        if not m:
            continue
        mod, code = m.group(1), m.group(2)
        if code.lstrip().startswith('(function(){'):
            continue                                   # scopeِ خودش را دارد
        for name in re.findall(r'^(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)',
                               code, re.M):
            if name in seen and seen[name] != mod:
                clashes.append((name, [seen[name], mod]))
            else:
                seen[name] = mod
    return clashes


def inline_assets(html, base):
    """CSS و JS خارجی را داخلِ HTML می‌آورد."""
    def css_repl(m):
        href = m.group(1)
        p = os.path.join(base, href.lstrip('/'))
        if not os.path.exists(p):
            print(f'   ⚠️  CSS پیدا نشد: {href}'); return m.group(0)
        css = embed_fonts(open(p, encoding='utf-8').read(), base, href)
        return '<style data-src="' + href + '">\n' + css + '\n</style>'
    html = re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+\.css)"\s*/?>', css_repl, html)

    def js_repl(m):
        src = m.group(1)
        p = os.path.join(base, src.lstrip('/'))
        if not os.path.exists(p):
            print(f'   ⚠️  JS پیدا نشد: {src}'); return m.group(0)
        js = open(p, encoding='utf-8').read().replace('</script>', '<\\/script>')
        return '<script data-src="' + src + '">\n' + js + '\n</script>'
    return re.sub(r'<script\s+src="([^"]+\.js)"\s*></script>', js_repl, html)

# نکته‌ی ظریف: مسیر داخلِ url() معمولاً در کوتیشن است — `url('../fonts/x.woff2')`.
# نسخه‌ی اولِ این regex کوتیشنِ پایانی را مصرف نمی‌کرد و هیچ‌وقت مچ نمی‌شد
# (ساخت بی‌صدا موفق می‌شد ولی فونت جاسازی **نمی‌شد**). کوتیشن حالا اختیاری است.
FONT_URL_RE = re.compile(r'''url\(\s*['"]?([^)'"]+?\.(?:woff2|woff|ttf|otf))['"]?\s*\)''', re.I)
FONT_MIME = {'.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf'}


def embed_fonts(css, base, css_href):
    """`url(...)`هایِ فونت را به data: URI تبدیل می‌کند.

    ⚠️ چرا لازم است (یافته‌ی P0، ممیزیِ UI/UX ۲۰۲۶-۰۸-۲۴): بسته‌ی تک‌فایلی با
    دابل‌کلیک روی `file://` باز می‌شود. تا پیش از این فونت با یک <link> از
    `fonts.googleapis.com` می‌آمد که روی `file://` **همیشه** شکست می‌خورد، پس
    کلِ UIِ فارسی با فونتِ پیش‌فرضِ سیستم رندر می‌شد — همان بسته‌ای که README
    به کاربر می‌گوید بازش کند.

    حالا فونت self-host است، ولی یک `url('../fonts/x.woff2')`ِ **نسبی** هم در
    حالتِ inline معنا ندارد (CSS دیگر فایلِ جدا نیست). پس بایت‌هایِ فونت را
    base64 می‌کنیم.

    هزینه: woff2ِ ۱۰۸KB → ~۱۴۵KB base64، یک‌بار در هر HTML. در برابرِ «هیچ
    فونتی» معامله‌ی درستی است.
    """
    css_dir = os.path.dirname(os.path.join(base, css_href.lstrip('/')))

    def repl(m):
        raw = m.group(1).strip().strip('\'"')
        if raw.startswith('data:') or raw.startswith('http'):
            return m.group(0)
        fp = os.path.normpath(os.path.join(css_dir, raw))
        mime = FONT_MIME.get(os.path.splitext(fp)[1].lower())
        if not mime:
            return m.group(0)
        if not os.path.exists(fp):
            print(f'   ⚠️  فونت پیدا نشد: {raw}')
            return m.group(0)
        b64 = base64.b64encode(open(fp, 'rb').read()).decode('ascii')
        return "url('data:" + mime + ";base64," + b64 + "')"

    return FONT_URL_RE.sub(repl, css)


def drop_dead_refs(html):
    """ارجاعاتی که در حالتِ تک‌فایلی فقط ۴۰۴ می‌دهند."""
    for pat in (r'\s*<link rel="icon"[^>]*>', r'\s*<link rel="manifest"[^>]*>',
                r'\s*<link rel="apple-touch-icon"[^>]*>',
                # preloadِ فونت: فونت به‌صورتِ data: در CSS جاسازی شده، پس این
                # فقط یک درخواستِ ۴۰۴ روی file:// است.
                r'\s*<link rel="preload"[^>]*as="font"[^>]*>'):
        html = re.sub(pat, '', html)
    return html

def check_panel_scope(app, base, raw_html):
    """همان گاردِ تصادمِ نام، برایِ پنل‌هایِ اسکریپت-کلاسیک.

    business/company باندل نمی‌شوند — هر فایل `<script>` خودش را دارد. ولی
    اسکریپت‌هایِ کلاسیک **یک scopeِ سراسریِ مشترک** دارند: دو `function` هم‌نام
    در دو فایل خطا نمی‌دهند، آخری بی‌صدا برنده می‌شود (دقیقاً همان کلاسی که در
    باندلِ customer پالتِ فرمان را شکسته بود). دو `const/let` هم‌نام هم
    SyntaxErrorِ زمانِ پارس می‌دهد و کلِ فایلِ دوم را از کار می‌اندازد.
    """
    srcs = re.findall(r'<script\s+src="([^"]+\.js)"\s*></script>', raw_html)
    seen, clashes = {}, []
    for rel in srcs:
        p = os.path.join(base, rel.lstrip('/'))
        if not os.path.exists(p):
            continue
        code = open(p, encoding='utf-8').read()
        code = re.sub(r'/\*.*?\*/', '', code, flags=re.S)          # کامنتِ بلوکی
        code = re.sub(r'^\s*//.*$', '', code, flags=re.M)          # کامنتِ خطی
        for m in re.finditer(
                r'^(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)', code, re.M):
            name = m.group(1)
            if name in seen and seen[name] != rel:
                clashes.append((name, [seen[name], rel]))
            else:
                seen[name] = rel
    return clashes


def build(app, write=True):
    base = os.path.join(ROOT, 'apps', app)
    html = open(os.path.join(base, 'index.html'), encoding='utf-8').read()

    if app != 'customer':
        panel_clashes = check_panel_scope(app, base, html)
        if panel_clashes:
            for name, files in panel_clashes:
                print(f'   ❌ نامِ تکراریِ سطحِ‌بالا: {name} در {" و ".join(files)}')
            raise SystemExit(
                f'\nساخت متوقف شد ({app}): اسکریپت‌هایِ کلاسیک یک scopeِ سراسری '
                'مشترک دارند — تابعِ هم‌نامِ فایلِ بعدی بی‌صدا قبلی را بازنویسی '
                'می‌کند و const/let هم‌نام کلِ فایل را با SyntaxError می‌اندازد.\n'
                'یکی از دو نام را در منبع اختصاصی کن.'
            )

    html = inline_assets(html, base)
    # [merge ۰۸-۲۴] inline_fonts(html, base) حذف شد: جاسازیِ فونت حالا داخلِ
    # css_repl→embed_fonts انجام می‌شود که هر الگویِ url() را می‌گیرد (با/بی
    # کوتیشن، هر پسوندِ فونت) — نسخه‌ی قبلی فقط '../fonts/*.woff2'ِ
    # تک‌کوتیشنی را می‌دید و بی‌صدا رد می‌شد.

    if app == 'customer':
        parts = []
        for rel in CUSTOMER_ORDER:
            p = os.path.join(base, rel)
            if not os.path.exists(p):
                print(f'   ⚠️  ماژول نیست: {rel}'); continue
            parts.append(f'\n/* ═══ {rel} ═══ */\n' + strip_module(open(p, encoding='utf-8').read(), rel))
        bundle = '\n'.join(parts)
        left = len(re.findall(r'^\s*(import|export)\s', bundle, re.M))
        if left:
            print(f'   ⚠️  {left} import/export باقی ماند');
        clashes = find_top_level_clashes(parts)
        if clashes:
            for name, mods in clashes:
                print(f'   ❌ نامِ تکراریِ سطحِ‌بالا: {name} در {" و ".join(mods)}')
            raise SystemExit(
                '\nساخت متوقف شد: در باندلِ تک‌اسکریپتی، اعلانِ هم‌نامِ دو ماژول '
                'در یک scope می‌نشیند و آخری بی‌صدا اولی را بازنویسی می‌کند.\n'
                'یکی از دو تابع/متغیر را در **منبع** به نامی اختصاصی تغییر بده '
                '(مثلاً renderPalette به‌جای render).'
            )
        bundle = bundle.replace('</script>', '<\\/script>')
        html = re.sub(r'<script\s+type="module"\s+src="[^"]+"\s*></script>',
                      lambda m: '<script data-bundle="customer">\n' + bundle + '\n</script>', html)

    html = drop_dead_refs(html)
    if not write:
        return html
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, f'{app}.html')
    open(out, 'w', encoding='utf-8').write(html)

    ext_js  = len(re.findall(r'<script[^>]*\ssrc="', html))
    ext_css = len(re.findall(r'<link[^>]+\.css"', html))
    status  = '✅' if (ext_js == 0 and ext_css == 0) else '⚠️'
    print(f'{status} {app}.html — {os.path.getsize(out)//1024}KB · ارجاعِ خارجی: js={ext_js} css={ext_css}')
    return ext_js == 0 and ext_css == 0

APPS = ('customer', 'business', 'company')


def check():
    """مقایسه‌ی خروجیِ commit‌شده با ساختِ تازه — بدونِ نوشتن.

    چرا لازم شد (یافته‌ی واقعیِ ۲۰۲۶-۰۸-۲۳): standalone/*.html خروجیِ تولیدشده‌ی
    commit‌شده است و از ۲۰۲۶-۰۸-۱۸ بازتولید نشده بود. یعنی بسته‌ی آفلاین — همان
    چیزی که README به کاربر می‌گوید بازش کند — هنوز همه‌ی باگ‌هایی را داشت که در
    منبع رفع شده بودند، از جمله یک P0 که کلِ مسیرِ رزرو را با بک‌اندِ واقعی
    می‌شکست. آرتیفکتی که بی‌صدا کهنه شود از نبودش بدتر است: ظاهرِ به‌روز دارد
    ولی کدِ قدیمی تحویل می‌دهد.
    """
    stale = []
    for app in APPS:
        out = os.path.join(OUT, f'{app}.html')
        if not os.path.exists(out):
            stale.append(f'{app}.html وجود ندارد')
            continue
        if open(out, encoding='utf-8').read() != build(app, write=False):
            stale.append(f'{app}.html با منبع هم‌خوان نیست')
    # ── آرتیفکت‌هایِ بی‌صاحب ──────────────────────────────────────────────
    # یافته‌ی ۲۰۲۶-۰۸-۲۶: `standalone/website.html` (۱٫۵MB) در
    # `README-website.md` به کاربر به‌عنوانِ بخشی از همین بسته معرفی می‌شود،
    # ولی **هیچ سازنده‌ای ندارد** — در APPS نیست، پس `--check` هرگز نگاهش
    # نمی‌کرد و با وجودِ کهنه‌بودن باز هم «✓ هم‌خوان است» چاپ می‌شد.
    #
    # این همان تله‌ی docstringِ بالاست، یک لایه بالاتر: نه آرتیفکتِ کهنه،
    # بلکه **گیتی که کهنگی را نمی‌بیند**. گیتِ سبزی که یک‌چهارمِ بسته را
    # اصلاً چک نمی‌کند، از نبودِ گیت بدتر است — چون اطمینانِ کاذب می‌دهد.
    #
    # عمداً fail نمی‌کند: سازنده‌ای وجود ندارد که رفعش کند، و بازتولید یا
    # حذفِ یک تحویلیِ کاربر تصمیمِ محصولی است، نه تصمیمِ این اسکریپت.
    # ولی دیگر بی‌صدا هم نیست.
    managed = {f'{a}.html' for a in APPS} | {'index.html'}
    unmanaged = sorted(
        f for f in os.listdir(OUT)
        if f.endswith('.html') and f not in managed
    )
    if unmanaged:
        print('⚠ آرتیفکتِ بی‌صاحب در standalone/ (این اسکریپت نه می‌سازدشان، نه تازگی‌شان را چک می‌کند):')
        for f in unmanaged:
            print(f'   - {f} — اسنپ‌شاتِ تاریخ‌دار است، نه ساختِ تازه')

    if stale:
        print('✗ بسته‌ی standalone کهنه است:')
        for x in stale:
            print('   - ' + x)
        print('\n  اجرا کن: python tools/build-standalone.py')
        return 1
    print('✓ بسته‌ی standalone با منبع هم‌خوان است')
    return 0


if __name__ == '__main__':
    if '--check' in sys.argv:
        sys.exit(check())
    ok = all([build(a) for a in APPS])
    print('\nخروجی در standalone/. برای استفاده روی گوشی، کلِ پوشه را منتقل کن و index.html را باز کن.')
    sys.exit(0 if ok else 1)
