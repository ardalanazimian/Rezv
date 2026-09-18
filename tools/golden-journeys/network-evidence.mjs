// ═══════════════════════════════════════════════════════════════════════
//  شاهدِ شبکه‌ایِ base_url — جایگزینِ تستِ رشته‌ایِ گیت (§۸ پیشنهاد)
//
//  چرا (اندازه‌گیریِ ۲۰۲۶-۰۹-۱۸): شرطِ ۴cِ `tools/gate-deploy.mjs:54` یک
//  **تستِ رشته‌ای** است — `/localhost|127\.0\.0\.1|\.local\b/i` — و آن گیت در
//  کلِ عمرش هیچ تماسِ شبکه‌ای نمی‌گیرد:
//    grep -cE 'fetch|http\.|request|curl' tools/gate-deploy.mjs → 0
//    (کنترلِ مثبت: existsSync در همان فایل → 5)
//  پس روی `0.0.0.0`، `[::1]`، `192.168.1.50`، یک IPِ عمومیِ خام، یا یک
//  تونلِ موقت پاس می‌شود — هیچ‌کدام «staging روی دامنه‌ی واقعی» نیستند، که
//  کلِ نکتهٔ آن شرط است.
//
//  regex عمداً وصله نشد: افزودنِ `0.0.0.0` به denylist همان طراحی است یک دور
//  بعد، و هنوز روی تونل پاس می‌شود. به‌جایش **مشاهده** ثبت می‌شود:
//    · IPی که واقعاً به آن وصل شدیم
//    · صادرکننده و subject/SANِ گواهیِ TLS
//    · آدرسِ نهایی پس از redirect
//  و داوری با گیت است، نه با این فایل.
//
//  ⚠️ صادقانه: این شاهد جعل را **گران‌تر** می‌کند، نه ناممکن. یک /etc/hosts
//  به‌علاوه‌ی گواهیِ self-signed هنوز ممکن است. برای همین پیش از ساخت به
//  Red Team (`rezv-18`) فرستاده شد. هر چه آن‌ها بشکنند اینجا ثبت می‌شود.
// ═══════════════════════════════════════════════════════════════════════
import { lookup } from 'node:dns/promises';
import { connect as tlsConnect } from 'node:tls';

/** IPی که این میزبان واقعاً به آن resolve می‌شود. */
async function resolvedAddress(hostname) {
  try {
    const r = await lookup(hostname, { all: false });
    return { address: r.address, family: `IPv${r.family}` };
  } catch (err) {
    return { address: null, family: null, error: String(err && err.code ? err.code : err) };
  }
}

/** صادرکننده و subjectِ گواهی — فقط برای https. */
function certificate(hostname, port) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    let socket;
    try {
      socket = tlsConnect(
        // `rejectUnauthorized: false` عمدی است: می‌خواهیم گواهیِ **نامعتبر** را
        // هم ببینیم و ثبت کنیم، نه اینکه اتصال را رد کنیم و چیزی ندانیم.
        // داوری با گیت است؛ اینجا فقط مشاهده ثبت می‌شود.
        { host: hostname, port: port || 443, servername: hostname, rejectUnauthorized: false, timeout: 8000 },
        () => {
          const c = socket.getPeerCertificate(false) || {};
          finish({
            issuer_cn: (c.issuer && c.issuer.CN) || null,
            issuer_o: (c.issuer && c.issuer.O) || null,
            subject_cn: (c.subject && c.subject.CN) || null,
            subject_alt_name: c.subjectaltname || null,
            valid_to: c.valid_to || null,
            authorized: socket.authorized === true,
            authorization_error: socket.authorized ? null : String(socket.authorizationError || ''),
          });
          socket.end();
        },
      );
      socket.on('timeout', () => { finish({ error: 'TLS_TIMEOUT' }); socket.destroy(); });
      socket.on('error', (err) => finish({ error: String(err && err.code ? err.code : err) }));
    } catch (err) {
      finish({ error: String(err) });
    }
  });
}

/**
 * شاهدِ شبکه‌ایِ یک base_url.
 * هیچ‌وقت throw نمی‌کند — شکست خودش یک مشاهده است و باید ثبت شود.
 */
export async function networkEvidence(baseUrl) {
  let u;
  try {
    u = new URL(baseUrl);
  } catch {
    return { base_url: baseUrl, error: 'URL_NAMOTABAR' };
  }

  const dns = await resolvedAddress(u.hostname);
  const cert = u.protocol === 'https:' ? await certificate(u.hostname, u.port) : { skipped: 'HTTP_BEDUN_TLS' };

  let finalUrl = null;
  let status = null;
  try {
    const res = await fetch(u.toString(), { redirect: 'follow' });
    finalUrl = res.url;
    status = res.status;
  } catch (err) {
    finalUrl = null;
    status = String(err && err.cause && err.cause.code ? err.cause.code : err);
  }

  return {
    base_url: baseUrl,
    hostname: u.hostname,
    protocol: u.protocol.replace(':', ''),
    resolved: dns,
    tls: cert,
    final_url_after_redirects: finalUrl,
    http_status: status,
    measured_at: new Date().toISOString(),
  };
}
