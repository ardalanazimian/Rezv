// ═══════════════════════════════════════════════════════════════════════
//  سفرِ `web-landing` — W1..W9
//
//  تنها سفری که کاملاً روی HTTP سنجیدنی است، پس اولین سفری است که عددِ
//  واقعی می‌دهد. بقیه مرورگر و بک‌اندِ زنده می‌خواهند.
//
//  لِینِ من اینجا طبقِ `FP-007` **سنجش** است نه نوشتن: این فایل چیزی را در
//  لندینگ عوض نمی‌کند، فقط ادعاهایش را می‌سنجد.
//
//  ⚠️ هیچ assertionی «نبودِ موضوع» را pass نمی‌شمارد (بندِ ۴ منشور). اگر
//  sitemap خالی باشد یا صفحه نیاید، نتیجه BLOCKED یا FAIL است، نه سبز.
// ═══════════════════════════════════════════════════════════════════════
import { PASS, FAIL, BLOCKED, record } from './evidence.mjs';

const CRAWLER_UA =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

async function get(url, headers) {
  try {
    const res = await fetch(url, { headers: headers || {}, redirect: 'follow' });
    const body = await res.text();
    return { ok: true, status: res.status, body, url: res.url, headers: res.headers };
  } catch (err) {
    return { ok: false, status: null, body: '', error: String(err && err.cause && err.cause.code ? err.cause.code : err) };
  }
}

async function head(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, status: null, error: String(err && err.cause && err.cause.code ? err.cause.code : err) };
  }
}

/** بلوک‌های JSON-LD یک صفحه. */
function jsonLdBlocks(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try { out.push(JSON.parse(m[1].trim())); } catch { out.push({ __unparsable: m[1].slice(0, 200) }); }
  }
  return out;
}

/** همه‌ی گره‌ها، چه تکی چه داخلِ @graph. */
function flattenLd(blocks) {
  const nodes = [];
  for (const b of blocks) {
    if (Array.isArray(b)) nodes.push(...b);
    else if (b && Array.isArray(b['@graph'])) nodes.push(...b['@graph']);
    else if (b) nodes.push(b);
  }
  return nodes;
}

function attr(html, tag, key, want) {
  const re = new RegExp(`<${tag}[^>]*\\b${key}\\s*=\\s*["']([^"']*)["'][^>]*>`, 'i');
  const m = re.exec(html);
  return m ? m[1] : null;
}

export async function runWebLanding(cfg) {
  const A = [];
  const site = cfg.landingUrl.replace(/\/$/, '');
  const log = [];
  const say = (s) => log.push(s);

  // ── W1: ریشه با user-agentِ خزنده ──
  const root = await get(`${site}/`, { 'user-agent': CRAWLER_UA });
  say(`W1 GET ${site}/ (Googlebot UA) -> ${root.ok ? root.status : root.error}`);
  if (!root.ok) {
    A.push(record('W1', 'ریشه با UAِ خزنده ۲۰۰ می‌دهد', BLOCKED, `به میزبان نرسیدیم: ${root.error}`, null));
  } else {
    A.push(record('W1', 'ریشه با UAِ خزنده ۲۰۰ می‌دهد', root.status === 200 ? PASS : FAIL,
      `HTTP ${root.status}`, `status=${root.status}`));
  }

  // ── W2: robots.txt و OAI-SearchBot ──
  const robots = await get(`${site}/robots.txt`);
  say(`W2 GET ${site}/robots.txt -> ${robots.ok ? robots.status : robots.error}`);
  if (!robots.ok || robots.status !== 200) {
    A.push(record('W2', 'robots.txt اجازه می‌دهد و OAI-SearchBot بسته نیست', BLOCKED,
      `robots.txt در دسترس نیست (${robots.ok ? robots.status : robots.error})`, null));
  } else {
    const txt = robots.body;
    say(txt.slice(0, 400));
    // «بسته بودنِ» یک بات یعنی بلوکِ مخصوصِ خودش Disallow: / داشته باشد.
    const blocked = (ua) => {
      const re = new RegExp(`user-agent:\\s*${ua}[\\s\\S]*?(?=user-agent:|$)`, 'i');
      const block = re.exec(txt);
      return block ? /disallow:\s*\/\s*$/im.test(block[0]) : false;
    };
    const oai = blocked('OAI-SearchBot');
    const allAll = /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*$/im.test(txt);
    A.push(record('W2', 'robots.txt اجازه می‌دهد و OAI-SearchBot بسته نیست',
      !oai && !allAll ? PASS : FAIL,
      `OAI-SearchBot blocked=${oai} · '*' disallow-all=${allAll}`, txt.slice(0, 600)));
  }

  // ── W3: sitemapها را **از robots.txt کشف کن**، مثلِ خودِ خزنده ──
  //
  // ⚠️ تصحیحِ ۲۰۲۶-۰۹-۱۸، از اولین اجرای واقعی: نسخه‌ی اولِ این assertion فقط
  // `/sitemap.xml` را می‌خواند و قرمز شد. اشتباهِ خودِ assertion بود: آدرس‌های
  // رستوران در `sitemap-restaurants.xml` هستند (rewrite به اپِ SEO) و
  // `robots.txt`ِ apex هر دو را اعلام می‌کند. خزنده از robots.txt کشف می‌کند،
  // پس این هم باید همان کار را بکند — هم درست‌تر است هم وفادارتر به واقعیت.
  const smUrls = [];
  if (robots.ok && robots.status === 200) {
    for (const m of robots.body.matchAll(/^\s*sitemap:\s*(\S+)\s*$/gim)) smUrls.push(m[1]);
  }
  if (smUrls.length === 0) smUrls.push(`${site}/sitemap.xml`);
  say(`W3 sitemaps declared in robots.txt: ${smUrls.join(' , ') || '(هیچ)'}`);

  let restaurantUrl = null;
  let totalLocs = 0;
  let anySitemapOk = false;
  for (const smUrl of smUrls) {
    const sm = await get(smUrl);
    say(`W3 GET ${smUrl} -> ${sm.ok ? sm.status : sm.error}`);
    if (!sm.ok || sm.status !== 200) continue;
    anySitemapOk = true;
    const locs = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1]);
    totalLocs += locs.length;
    if (!restaurantUrl) restaurantUrl = locs.find((u) => /\/r\//.test(u)) || null;
  }
  say(`W3 total <loc>=${totalLocs} · first /r/ = ${restaurantUrl ?? '(هیچ)'}`);

  if (!anySitemapOk) {
    A.push(record('W3', 'sitemap باز می‌شود و آدرسِ رستورانش زنده است', BLOCKED,
      `هیچ‌کدام از ${smUrls.length} sitemapِ اعلام‌شده باز نشد`, smUrls.join('\n')));
  } else if (totalLocs === 0) {
    // نبودِ موضوع خطاست، نه pass.
    A.push(record('W3', 'sitemap باز می‌شود و آدرسِ رستورانش زنده است', FAIL,
      'هیچ <loc>ی در هیچ sitemapی نیست — خالی‌بودن سبز نیست', smUrls.join('\n')));
  } else if (!restaurantUrl) {
    A.push(record('W3', 'sitemap باز می‌شود و آدرسِ رستورانش زنده است', FAIL,
      `${totalLocs} آدرس در ${smUrls.length} sitemap، ولی هیچ /r/ ی نیست`, smUrls.join('\n')));
  } else {
    const r = await head(restaurantUrl);
    say(`W3 HEAD ${restaurantUrl} -> ${r.ok ? r.status : r.error}`);
    A.push(record('W3', 'sitemap باز می‌شود و آدرسِ رستورانش زنده است',
      r.ok && r.status === 200 ? PASS : FAIL,
      `${totalLocs} آدرس · ${restaurantUrl} → ${r.ok ? r.status : r.error}`, null));
  }

  // ── W4/W5/W6/W8: صفحه‌ی رستوران ──
  if (!restaurantUrl) {
    for (const [id, title] of [
      ['W4', 'JSON-LD رستوران با خودِ صفحه می‌خواند'],
      ['W5', 'منو HTML است، نه عکس یا PDF'],
      ['W6', 'lang/dir/canonical/OG درست‌اند'],
      ['W8', 'AggregateRating فقط جایی که نظرِ واقعی هست'],
    ]) A.push(record(id, title, BLOCKED, 'آدرسِ رستورانی از sitemap به‌دست نیامد', null));
  } else {
    const page = await get(restaurantUrl, { 'user-agent': CRAWLER_UA });
    say(`W4 GET ${restaurantUrl} -> ${page.ok ? page.status : page.error}`);
    if (!page.ok || page.status !== 200) {
      for (const [id, title] of [
        ['W4', 'JSON-LD رستوران با خودِ صفحه می‌خواند'],
        ['W5', 'منو HTML است، نه عکس یا PDF'],
        ['W6', 'lang/dir/canonical/OG درست‌اند'],
        ['W8', 'AggregateRating فقط جایی که نظرِ واقعی هست'],
      ]) A.push(record(id, title, BLOCKED, `صفحه نیامد (${page.ok ? page.status : page.error})`, null));
    } else {
      const nodes = flattenLd(jsonLdBlocks(page.body));
      const rest = nodes.find((n) => n && (n['@type'] === 'Restaurant' || (Array.isArray(n['@type']) && n['@type'].includes('Restaurant'))));
      say(`W4 JSON-LD nodes=${nodes.length} · Restaurant=${rest ? 'yes' : 'no'}`);

      if (!rest) {
        A.push(record('W4', 'JSON-LD رستوران با خودِ صفحه می‌خواند', FAIL,
          `${nodes.length} گره JSON-LD، هیچ‌کدام Restaurant نیست`, nodes.map((n) => n && n['@type']).join(', ')));
      } else {
        // نام باید در متنِ رندرشده هم باشد — نشانه‌گذاری که با صفحه نخواند
        // اطلاعاتِ غلط در مقیاس است.
        const name = typeof rest.name === 'string' ? rest.name : '';
        const inHtml = name.length > 0 && page.body.includes(name);
        A.push(record('W4', 'JSON-LD رستوران با خودِ صفحه می‌خواند', inHtml ? PASS : FAIL,
          `name=«${name}» · در HTMLِ رندرشده: ${inHtml}`, `name=${name}`));
      }

      // W5 — منو به‌صورتِ HTML. اگر لینکِ منو به .pdf/.jpg برود، قرمز.
      const menuHref = attr(page.body, 'a', 'href', null);
      const pdfish = /\/menu[^"']*\.(pdf|jpe?g|png|webp)/i.test(page.body);
      A.push(record('W5', 'منو HTML است، نه عکس یا PDF', pdfish ? FAIL : PASS,
        pdfish ? 'لینکی به منوی PDF/عکس پیدا شد' : 'هیچ لینکِ منوی PDF/عکسی نیست',
        menuHref ? `first-anchor=${menuHref}` : null));

      // W6 — زبان/جهت/canonical/OG
      const lang = attr(page.body, 'html', 'lang');
      const dir = attr(page.body, 'html', 'dir');
      const canonical = (/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i.exec(page.body) || [])[1] || null;
      const ogImage = (/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(page.body) || [])[1] || null;
      let ogOk = false;
      if (ogImage) {
        const oi = await head(ogImage.startsWith('http') ? ogImage : `${site}${ogImage}`);
        ogOk = oi.ok && oi.status === 200;
        say(`W6 og:image ${ogImage} -> ${oi.ok ? oi.status : oi.error}`);
      }
      const w6ok = lang === 'fa' && dir === 'rtl' && !!canonical && ogOk;
      A.push(record('W6', 'lang/dir/canonical/OG درست‌اند', w6ok ? PASS : FAIL,
        `lang=${lang} dir=${dir} canonical=${canonical ? 'yes' : 'no'} og:image 200=${ogOk}`,
        `canonical=${canonical}\nog:image=${ogImage}`));

      // W8 — rating فقط با نظرِ واقعی
      const agg = nodes.find((n) => n && n.aggregateRating);
      const count = agg && agg.aggregateRating ? Number(agg.aggregateRating.reviewCount ?? agg.aggregateRating.ratingCount ?? 0) : 0;
      A.push(record('W8', 'AggregateRating فقط جایی که نظرِ واقعی هست',
        !agg || count > 0 ? PASS : FAIL,
        agg ? `aggregateRating حاضر است با reviewCount=${count}` : 'aggregateRating ندارد (درست)',
        agg ? JSON.stringify(agg.aggregateRating) : null));
    }
  }

  // ── W7: deep-linkِ «رزرو میز» رستوران/تاریخ/نفر را حفظ می‌کند (D-31) ──
  if (!restaurantUrl) {
    A.push(record('W7', 'deep-linkِ رزرو رستوران/تاریخ/نفر را حفظ می‌کند', BLOCKED,
      'آدرسِ رستورانی برای سنجش نبود', null));
  } else {
    const page = await get(restaurantUrl);
    const hrefs = page.ok ? [...page.body.matchAll(/href=["']([^"']*(?:reserve|booking|app\.)[^"']*)["']/gi)].map((m) => m[1]) : [];
    const deep = hrefs.find((h) => /[?&](r|restaurant|slug)=/.test(h)) || null;
    say(`W7 candidate reserve links=${hrefs.length} · with restaurant param = ${deep ?? '(هیچ)'}`);
    A.push(record('W7', 'deep-linkِ رزرو رستوران/تاریخ/نفر را حفظ می‌کند', deep ? PASS : FAIL,
      deep ? `لینک: ${deep}` : `${hrefs.length} لینکِ رزرو، هیچ‌کدام شناسه‌ی رستوران را حمل نمی‌کند`,
      hrefs.slice(0, 10).join('\n')));
  }

  // ── W9: هیچ مسیرِ ثبت‌نامِ خودسرویسِ رایگان (حکمِ مالک ۰۹-۱۷، افزوده‌ی CEO) ──
  const demo = await get(`${site}/demo`);
  // ⚠️ تصحیحِ ۲۰۲۶-۰۹-۱۸، از اولین اجرای واقعی — و این یکی assertion را FAKEABLE
  // کرده بود. بدونِ هدرِ Origin، این مسیر **۴۰۳ BLOCKED** می‌دهد («منشأ درخواست
  // مجاز نیست») که ردِ CSRF است، نه حذفِ مسیر. با Originِ مجاز همان مسیر **۴۲۲
  // VALIDATION** می‌دهد، یعنی کاملاً زنده است و فقط فیلد می‌خواهد.
  // نسخه‌ی اول ۴۰۳ را «حذف‌شده» می‌شمرد، پس روزی که کسی CORS را سفت کند این
  // assertion سبز می‌شد در حالی که قیفِ ثبت‌نامِ رایگان هنوز باز بود.
  // حالا: Originِ مجاز فرستاده می‌شود، و فقط ۴۰۴/۴۱۰ «حذف‌شده» است.
  const trial = await (async () => {
    try {
      const res = await fetch(`${cfg.apiBase.replace(/\/$/, '')}/v1/site/trial`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: site },
        body: JSON.stringify({ probe: true }),
      });
      return { ok: true, status: res.status };
    } catch (err) {
      return { ok: false, error: String(err && err.cause && err.cause.code ? err.cause.code : err) };
    }
  })();
  say(`W9 GET ${site}/demo -> ${demo.ok ? demo.status : demo.error}`);
  say(`W9 POST ${cfg.apiBase}/v1/site/trial -> ${trial.ok ? trial.status : trial.error}`);

  // قبول **فقط** ۴۰۴/۴۱۰. ۴۰۳ عمداً بیرون است: ردِ CSRF است نه حذفِ مسیر، و
  // شمردنش به‌عنوانِ «حذف‌شده» این assertion را قابلِ‌جعل می‌کرد.
  const demoGone = demo.ok && [404, 410].includes(demo.status);
  const trialGone = trial.ok && [404, 410].includes(trial.status);
  if (!demo.ok || !trial.ok) {
    A.push(record('W9', 'هیچ مسیرِ ثبت‌نامِ خودسرویسِ رایگان نیست', BLOCKED,
      `به یکی از دو مسیر نرسیدیم (demo=${demo.ok ? demo.status : demo.error} · trial=${trial.ok ? trial.status : trial.error})`, null));
  } else if (trial.status === 403) {
    // نتیجه‌ی نامعتبر، نه سبز و نه قرمز: ۴۰۳ یعنی به خودِ منطقِ مسیر نرسیدیم.
    A.push(record('W9', 'هیچ مسیرِ ثبت‌نامِ خودسرویسِ رایگان نیست', BLOCKED,
      `POST /v1/site/trial → 403 (ردِ منشأ/CSRF). یعنی به منطقِ مسیر نرسیدیم، پس نه «حذف‌شده» ثابت شد نه «زنده». Originِ مجاز بفرست و دوباره بسنج.`,
      `demo_status=${demo.status}\ntrial_status=403`));
  } else {
    A.push(record('W9', 'هیچ مسیرِ ثبت‌نامِ خودسرویسِ رایگان نیست',
      demoGone && trialGone ? PASS : FAIL,
      `/demo → ${demo.status} · POST /v1/site/trial → ${trial.status}. ` +
        'حکمِ مالک ۰۹-۱۷: لانچِ اول پولی است و آزمایشیِ خودسرویس حذف می‌شود.',
      `demo_status=${demo.status}\ntrial_status=${trial.status}`));
  }

  return { assertions: A, raw: log.join('\n') };
}
