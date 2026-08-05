// ═══════════════════════════════════════════════════════════════════════
//  موتورِ پاسخ — بازیابی از محتوای خودِ سایت
//
//  چرا بازیابی و نه مدلِ زبانی: پاسخ باید همیشه چیزی باشد که واقعاً در سایت
//  نوشته شده و مدیر می‌تواند اصلاحش کند. این‌طور هیچ‌وقت چیزی از خودش
//  نمی‌سازد، هزینه ندارد، و آفلاین هم کار می‌کند.
//
//  روش: امتیازدهیِ واژه‌ای با وزن‌دهی به پرسش (BM25‑گونه‌ی ساده). برای یک
//  پیکره‌ی چندده‌تایی این کاملاً کافی است و هیچ وابستگی‌ای اضافه نمی‌کند.
//
//  اگر چیزی پیدا نشد، صادقانه می‌گوید نمی‌داند و به تماس با فروش راهنمایی
//  می‌کند — نه اینکه نزدیک‌ترین پاسخِ بی‌ربط را برگرداند.
// ═══════════════════════════════════════════════════════════════════════

export interface KbDoc {
  id: string;
  title: string;
  body: string;
  /** مسیرِ صفحه‌ای که این محتوا آنجاست، برای «بیشتر بخوانید» */
  href: string;
  kind: 'faq' | 'article' | 'page';
  scope?: string;
}

export interface Answer {
  text: string;
  source: { title: string; href: string } | null;
  /** پرسش‌های نزدیک، برای وقتی کاربر نمی‌داند چه بپرسد */
  related: { q: string; id: string }[];
  confident: boolean;
}

// واژه‌هایی که بارِ معنایی ندارند و امتیاز را خراب می‌کنند.
//
// سه دسته، و هر سه لازم‌اند — با تستِ واقعی معلوم شد:
//   ۱) حروف و ضمایر
//   ۲) واژه‌های پرسشی: بدونِ «چقدر»، سؤالِ «قیمت بلیت هواپیما چقدر است»
//      با اطمینان به «راه‌اندازی چقدر طول می‌کشد» وصل می‌شد.
//   ۳) فعل‌های محاوره‌ای: «چند کاربر می‌تونم بسازم» سه واژه دارد که دوتایش
//      فعل است و در متنِ نوشتاری نیست؛ بدونِ حذفشان پوششِ سؤال مصنوعاً
//      پایین می‌آمد و دستیار جوابِ درست را رد می‌کرد.
const STOP = new Set([
  // حروف، ضمایر، افعالِ کمکی
  'از', 'به', 'با', 'در', 'را', 'که', 'این', 'آن', 'های', 'ها', 'یک', 'می',
  'است', 'هست', 'شد', 'شود', 'کرد', 'کند', 'برای', 'تا', 'هم', 'یا', 'و',
  'من', 'ما', 'شما', 'خود', 'باید', 'دارد', 'دارم', 'داریم', 'کنم', 'کنیم',
  'بود', 'اگر', 'ولی', 'اما', 'روی', 'بر', 'هر', 'همه', 'نه', 'بله', 'یعنی',
  'مثل', 'مثلا', 'هایی', 'شامل', 'مورد', 'طور', 'جور',
  // واژه‌های پرسشی
  'چه', 'چی', 'چطور', 'چگونه', 'آیا', 'کجا', 'کی', 'چند', 'چقدر', 'چرا',
  'کدام', 'کدوم', 'چندتا', 'چیه', 'چیست', 'میشه',
  // فعل‌های محاوره‌ای و شکسته
  'تونم', 'تونی', 'تونه', 'تونیم', 'بتونم', 'بتونیم', 'میتونم', 'میتونه',
  'بسازم', 'بسازیم', 'بگیرم', 'بگیره', 'بدم', 'بده', 'کنه', 'میکنه', 'میکنم',
  'بشه', 'باشه', 'داره', 'دارن', 'هستش', 'میاد', 'بیاد', 'بزنم', 'ببینم',
]);

/** یکسان‌سازیِ نگارشِ فارسی — «ی/ک»ِ عربی، اعرابِ، نیم‌فاصله و اعدادِ فارسی. */
export function normalize(input: string): string {
  return input
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ً-ْـ]/g, '')
    .replace(/‌/g, ' ')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function tokenize(input: string): string[] {
  return normalize(input)
    .split(' ')
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** ریشه‌ی خیلی سبک: پسوندهای جمع/اضافه را برمی‌دارد تا «رزروها» با «رزرو» بخورد. */
function stem(w: string): string {
  return w
    .replace(/(هایی|هایم|هایت|هایش|های|ها)$/u, '')
    .replace(/(تری|ترین|تر)$/u, '')
    .replace(/(ام|ات|اش|مان|تان|شان)$/u, '')
    || w;
}

interface Scored { doc: KbDoc; score: number }

// BM25 — پارامترهای متعارف.
// k1: اشباعِ تکرار (تکرارِ دهم یک واژه ارزشِ تکرارِ دومش را ندارد)
// b:  اثرِ طولِ سند (سندِ کوتاهی که واژه را دارد، دقیق‌تر از سندِ بلند است)
const K1 = 1.2;
const B = 0.75;
const TITLE_BOOST = 2.6;

export function search(query: string, docs: KbDoc[], limit = 5): Scored[] {
  const qs = tokenize(query).map(stem);
  if (!qs.length) return [];

  // نسخه‌ی اول فقط «حضور» واژه را می‌سنجید. نتیجه این شد که دو سند با یک بار
  // تکرارِ واژه دقیقاً هم‌امتیاز می‌شدند و انتخاب عملاً تصادفی بود — سؤالِ
  // «چند کاربر می‌توانم بسازم» به پاسخِ قیمت‌گذاری می‌رسید نه به پاسخِ تیم.
  // BM25 با شمارشِ تکرار و نرمال‌سازیِ طول این را حل می‌کند.
  const df = new Map<string, number>();
  const prepared = docs.map((d) => {
    const title = tokenize(d.title).map(stem);
    const body = tokenize(d.body).map(stem);
    const tf = new Map<string, number>();
    for (const w of body) tf.set(w, (tf.get(w) ?? 0) + 1);
    // عنوان چند بار شمرده می‌شود تا وزنش بیشتر باشد، بدونِ فرمولِ جدا
    for (const w of title) tf.set(w, (tf.get(w) ?? 0) + TITLE_BOOST);
    for (const w of new Set([...title, ...body])) df.set(w, (df.get(w) ?? 0) + 1);
    return { tf, len: body.length + title.length };
  });

  const N = docs.length || 1;
  const avgLen = prepared.reduce((s, p) => s + p.len, 0) / N || 1;

  const scored: Scored[] = docs.map((doc, i) => {
    const { tf, len } = prepared[i];
    let score = 0;
    let matched = 0;
    for (const q of qs) {
      const f = tf.get(q) ?? 0;
      if (f === 0) continue;
      matched++;
      const idf = Math.log(1 + (N - (df.get(q) ?? 0) + 0.5) / ((df.get(q) ?? 0) + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * len) / avgLen)));
    }
    // پوششِ پرسش هنوز ضرب می‌شود: سندی که همه‌ی واژه‌ها را دارد بر سندی که
    // یکی را چند بار تکرار کرده ترجیح دارد.
    return { doc, score: score * (0.45 + matched / qs.length) };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** آستانه‌ای که زیرش «نمی‌دانم» بهتر از حدسِ بی‌ربط است. */
const MIN_SCORE = 1.15;

/**
 * کف پوششِ سؤال: دستِ‌کم این کسر از واژه‌های معنادارِ کاربر باید در سند باشد.
 *
 * چرا لازم است: «قیمت بلیت هواپیما به استانبول» فقط روی واژه‌ی «قیمت» با
 * پرسش‌های قیمت‌گذاری هم‌پوشانی دارد و امتیازش از آستانه رد می‌شد — یعنی
 * دستیار با اطمینان جوابِ بی‌ربط می‌داد. با تستِ واقعی گرفته شد.
 */
const MIN_COVERAGE = 0.4;

export function answer(query: string, docs: KbDoc[]): Answer {
  const qs = tokenize(query).map(stem);
  const hits = search(query, docs, 5);
  const top = hits[0];

  const related = hits.slice(1, 4).map((h) => ({ q: h.doc.title, id: h.doc.id }));

  const coverage = top ? coverageOf(qs, top.doc) : 0;

  if (!top || top.score < MIN_SCORE || coverage < MIN_COVERAGE) {
    return {
      text:
        'برای این یکی جوابِ دقیقی در محتوای سایت پیدا نکردم و ترجیح می‌دهم حدس نزنم. ' +
        'می‌توانی سؤالت را کمی بازتر بپرسی، یا از صفحه‌ی تماس با کارشناسِ ما حرف بزنی.',
      source: { title: 'تماس با فروش', href: '/contact' },
      related: hits.slice(0, 3).map((h) => ({ q: h.doc.title, id: h.doc.id })),
      confident: false,
    };
  }

  return {
    text: top.doc.body,
    source: { title: top.doc.title, href: top.doc.href },
    related,
    confident: true,
  };
}

/** چه کسری از واژه‌های معنادارِ سؤال واقعاً در این سند هست. */
function coverageOf(qs: string[], doc: KbDoc): number {
  if (!qs.length) return 0;
  const t = new Set([...tokenize(doc.title).map(stem), ...tokenize(doc.body).map(stem)]);
  return qs.filter((q) => t.has(q)).length / qs.length;
}

/** پیشنهادهای شروع — از خودِ پیکره، نه فهرستِ ثابت. */
export function starters(docs: KbDoc[]): { q: string; id: string }[] {
  const pick = (scope: string) => docs.find((d) => d.scope === scope);
  return [pick('customer'), pick('business'), pick('pricing'), pick('demo')]
    .filter((d): d is KbDoc => Boolean(d))
    .map((d) => ({ q: d.title, id: d.id }));
}
