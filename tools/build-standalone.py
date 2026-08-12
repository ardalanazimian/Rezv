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
import re, os, sys

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
    'js/features/rewards.js', 'js/features/food-dna.js', 'js/features/chat.js',
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

def inline_assets(html, base):
    """CSS و JS خارجی را داخلِ HTML می‌آورد."""
    def css_repl(m):
        href = m.group(1)
        p = os.path.join(base, href.lstrip('/'))
        if not os.path.exists(p):
            print(f'   ⚠️  CSS پیدا نشد: {href}'); return m.group(0)
        return '<style data-src="' + href + '">\n' + open(p, encoding='utf-8').read() + '\n</style>'
    html = re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+\.css)"\s*/?>', css_repl, html)

    def js_repl(m):
        src = m.group(1)
        p = os.path.join(base, src.lstrip('/'))
        if not os.path.exists(p):
            print(f'   ⚠️  JS پیدا نشد: {src}'); return m.group(0)
        js = open(p, encoding='utf-8').read().replace('</script>', '<\\/script>')
        return '<script data-src="' + src + '">\n' + js + '\n</script>'
    return re.sub(r'<script\s+src="([^"]+\.js)"\s*></script>', js_repl, html)

def drop_dead_refs(html):
    """ارجاعاتی که در حالتِ تک‌فایلی فقط ۴۰۴ می‌دهند."""
    for pat in (r'\s*<link rel="icon"[^>]*>', r'\s*<link rel="manifest"[^>]*>',
                r'\s*<link rel="apple-touch-icon"[^>]*>'):
        html = re.sub(pat, '', html)
    return html

def build(app):
    base = os.path.join(ROOT, 'apps', app)
    html = open(os.path.join(base, 'index.html'), encoding='utf-8').read()
    html = inline_assets(html, base)

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
        bundle = bundle.replace('</script>', '<\\/script>')
        html = re.sub(r'<script\s+type="module"\s+src="[^"]+"\s*></script>',
                      lambda m: '<script data-bundle="customer">\n' + bundle + '\n</script>', html)

    html = drop_dead_refs(html)
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, f'{app}.html')
    open(out, 'w', encoding='utf-8').write(html)

    ext_js  = len(re.findall(r'<script[^>]*\ssrc="', html))
    ext_css = len(re.findall(r'<link[^>]+\.css"', html))
    status  = '✅' if (ext_js == 0 and ext_css == 0) else '⚠️'
    print(f'{status} {app}.html — {os.path.getsize(out)//1024}KB · ارجاعِ خارجی: js={ext_js} css={ext_css}')
    return ext_js == 0 and ext_css == 0

if __name__ == '__main__':
    ok = all([build(a) for a in ('customer', 'business', 'company')])
    print('\nخروجی در standalone/. برای استفاده روی گوشی، کلِ پوشه را منتقل کن و index.html را باز کن.')
    sys.exit(0 if ok else 1)
