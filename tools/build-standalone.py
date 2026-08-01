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
CUSTOMER_ORDER = [
    'js/icons.js', 'js/data/seed.js', 'js/theme-pwa.js', 'js/api.js', 'js/auth.js',
    'js/store.js', 'js/actions.js', 'js/data/detail.js', 'js/data/discover.js',
    'js/reservation.js', 'js/features/rewards.js', 'js/features/loyalty.js',
    'js/features/trips.js', 'js/features/food-dna.js', 'js/features/chat.js',
    'js/user-profile.js', 'js/init.js', 'js/main.js',
]

def strip_module(code, path):
    """حذفِ نحوِ ES Module تا کد به‌عنوان اسکریپتِ کلاسیک اجرا شود."""
    code = re.sub(r'^\s*import\s+[^;]*?;\s*$', '', code, flags=re.M | re.S)
    code = re.sub(r'^\s*import\s*\{[^}]*\}\s*from\s*[\'"][^\'"]+[\'"]\s*;?\s*$', '', code, flags=re.M | re.S)
    code = re.sub(r'^\s*export\s+(?=(async\s+)?(function|const|let|var|class)\b)', '', code, flags=re.M)
    code = re.sub(r'^\s*export\s*\{[^}]*\}\s*;?\s*$', '', code, flags=re.M)
    code = re.sub(r'^\s*export\s+default\s+', '', code, flags=re.M)
    # رفعِ تصادمِ نام: chat.js نسخه‌ی محلی و متفاوتی از esc/faTime دارد.
    # در scope مشترک یکی دیگری را بازنویسی می‌کرد؛ اینجا نام‌گذاریِ مجزا می‌شود.
    if path.endswith('features/chat.js'):
        code = re.sub(r'\besc\b', 'chatEsc', code)
        code = re.sub(r'\bfaTime\b', 'chatFaTime', code)
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
