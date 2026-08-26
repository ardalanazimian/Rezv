import { db } from './db';
import { Err } from './errors';
import { createLogger } from './logger';
import {
  tokenize, classify, isAssistantIntent, CONFIDENCE_THRESHOLD,
  INTENT_LABELS, INTENT_EXAMPLE_QUESTION, DATA_INTENTS,
  type AssistantIntent,
} from './assistant-nlu';
import { generateAnswer } from './assistant-answers';

const auditLog = createLogger('assistant');

// ═══════════════════════════════════════════════════════════════════════
//  ارکستراسیونِ دستیارِ هوشمند — تنها لایه‌ای که به DB وصل می‌شود.
//  طبقه‌بندِ خالص در assistant-nlu.ts، تولیدِ متنِ پاسخ در assistant-answers.ts.
//
//  خودآموزی اینجا اتفاق می‌افتد: teachAssistant با هر اصلاحِ کارمند،
//  شمارشِ کلماتِ همان سؤال را برایِ نیتِ درست در DB زیاد می‌کند — یعنی
//  دفعه‌ی بعد که سؤالِ مشابهی بیاید، classify() آن را بهتر تشخیص می‌دهد.
//  بدونِ این حلقه، سیستم فقط seed می‌ماند؛ با آن، واقعاً «خودآموز» است.
// ═══════════════════════════════════════════════════════════════════════

const exampleQuestions = () => DATA_INTENTS.map((i) => INTENT_EXAMPLE_QUESTION[i]);

// ═══════════════════════════════════════════════════════════════════════
//  سه سقفِ عددی — و چرا دقیقاً این عددها (اندازه‌گیری‌شده، نه حدس)
//
//  ⚠️ یافته‌ی ۲۰۲۶-۰۸-۲۵ («مسمومیتِ واژگان» — معادلِ قطعیِ prompt injection):
//  `teachAssistant` هر توکنِ سؤال را با `count: { increment: 1 }` بدونِ هیچ
//  سقفی بالا می‌برد و `classify` امتیاز را از
//  `seed[tok] * SEED_WEIGHT + learned[tok]` می‌سازد (SEED_WEIGHT = 3). یعنی
//  دانشِ seed یک سقفِ ثابت داشت و سمتِ یادگرفته بی‌نهایت.
//
//  بازتولیدِ واقعی با خودِ طبقه‌بند (همین اجرا، سؤالِ «امروز چند رزرو داریم»):
//    ۰ چرخه   → reservations_today  conf=0.899
//    ۱۰ چرخه  → vip_customers       conf=0.492   ← جواب عوض شد
//    ۵۰ چرخه  → vip_customers       conf=0.950   ← با اطمینانِ بالا
//    ۲۰۰ چرخه → vip_customers       conf=0.987
//  با سقفِ ۵ روی همان مسیر: تا ۲۰۰ چرخه هم `reservations_today` می‌ماند
//  (conf=0.731) — یعنی سقف مؤثر است، نه تزئینی.
//
//  چرا یادگیری را نمی‌کُشد: سقف روی «هر (نیت، کلمه)» است، نه روی مجموع.
//  کلمه‌ای که اصلاً در seed نیست با شمارشِ ۱–۲ هم تعیین‌کننده است، و
//  یادگیریِ واقعی از **کلمه‌های متنوع** می‌آید نه از تکرارِ یک کلمه.
// ═══════════════════════════════════════════════════════════════════════

/** سقفِ شمارشِ هر (نیت، کلمه). فراتر از این، تکرار دیگر وزن اضافه نمی‌کند. */
export const MAX_VOCAB_COUNT = 5;

/**
 * سقفِ ردیف‌هایی که برایِ طبقه‌بندیِ **هر** سؤال به حافظه‌ی پروسه می‌آید.
 *
 * ⚠️ قبلاً `findMany` بدونِ `take` بود: کلِ واژگانِ آن رستوران در هر سؤال
 * لود می‌شد، در پروسه‌ای که بینِ **همه‌ی** tenantها مشترک است. مرتب‌سازی
 * بر اساسِ شمارش است تا اگر روزی جدول از این سقف گذشت، چیزی که کنار
 * گذاشته می‌شود کم‌اثرترین ردیف‌ها باشند، نه یک بُرشِ تصادفی.
 */
export const MAX_LEARNED_VOCAB_ROWS = 5_000;

/**
 * حداکثر توکنِ متمایزی که **یک** اصلاح می‌تواند تقویت کند.
 * یک سؤالِ ۵۰۰ نویسه‌ای تا ~۱۵۰ توکنِ یکتا می‌دهد؛ بدونِ این سقف، هر اصلاح
 * می‌توانست ۱۵۰ ردیفِ تازه بسازد.
 */
export const MAX_TAUGHT_TOKENS = 40;

async function loadLearnedVocab(restaurantId: string): Promise<Record<string, Record<string, number>>> {
  const rows = await db.restaurantAssistantVocab.findMany({
    where: { restaurantId },
    select: { intent: true, word: true, count: true },
    orderBy: [{ count: 'desc' }, { updatedAt: 'desc' }],
    take: MAX_LEARNED_VOCAB_ROWS,
  });
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    (out[r.intent] ??= {})[r.word] = r.count;
  }
  return out;
}

export interface AskResult {
  log_id: string;
  understood: boolean;
  intent: AssistantIntent;
  confidence: number;
  answer: string;
  suggestions: { intent: AssistantIntent; label: string }[];
}

/** پرسیدنِ یک سؤالِ آزادمتن — طبقه‌بندی + (اگر مطمئن بودیم) پاسخِ واقعی. */
export async function askAssistant(opts: {
  restaurantId: string;
  staffId?: string | null;
  question: string;
}): Promise<AskResult> {
  const { restaurantId, staffId, question } = opts;
  const tokens = tokenize(question);
  const vocab = await loadLearnedVocab(restaurantId);
  const result = classify(tokens, vocab);
  const understood = tokens.length > 0 && result.confidence >= CONFIDENCE_THRESHOLD;

  let answer: string;
  let suggestions: { intent: AssistantIntent; label: string }[] = [];
  if (tokens.length === 0) {
    answer = 'چیزی ننوشتی — یه سؤال درباره‌ی رزروها، مشتری‌ها یا میزها بپرس.';
  } else if (!understood) {
    answer = 'مطمئن نیستم منظورت چی بود؛ شاید یکی از این‌هاست؟ (با انتخابِ گزینه‌ی درست به من یاد می‌دی)';
    suggestions = result.ranked
      .filter((r) => (DATA_INTENTS as readonly string[]).includes(r.intent))
      .slice(0, 3)
      .map((r) => ({ intent: r.intent, label: INTENT_LABELS[r.intent] }));
  } else {
    answer = await generateAnswer(result.intent, restaurantId, exampleQuestions());
  }

  const log = await db.restaurantAssistantLog.create({
    data: {
      restaurantId,
      staffId: staffId || null,
      question: question.slice(0, 500),
      detectedIntent: understood ? result.intent : null,
      confidence: result.confidence,
    },
  });

  return {
    log_id: log.id,
    understood,
    intent: result.intent,
    confidence: Math.round(result.confidence * 1000) / 1000,
    answer,
    suggestions,
  };
}

/**
 * حلقه‌ی خودآموزی: کارمند نیتِ درست را (از چیپ‌های پیشنهاد یا با تأییدِ
 * دستی) مشخص می‌کند → کلماتِ سؤالِ اصلی برایِ آن نیت در واژگانِ همین رستوران
 * تقویت می‌شوند. آنلاین و آنیّ — بدونِ نیازِ به آموزشِ دسته‌ای/شبانه.
 */
export async function teachAssistant(opts: {
  restaurantId: string;
  logId: string;
  correctIntent: string;
  /** کارمندی که اصلاح را ثبت می‌کند (ممکن است با پرسنده فرق کند). */
  staffId?: string | null;
}): Promise<{ answer: string; intent: AssistantIntent }> {
  const { restaurantId, logId, correctIntent, staffId } = opts;
  if (!isAssistantIntent(correctIntent)) throw Err.validation('نیتِ نامعتبر');

  const log = await db.restaurantAssistantLog.findUnique({ where: { id: logId } });
  if (!log || log.restaurantId !== restaurantId) throw Err.notFound('این سؤال');

  // ── هر سؤال فقط **یک‌بار** قابلِ آموزش است ──
  //
  // ⚠️ این نیمه‌ی دومِ رفعِ مسمومیتِ واژگان است و بدونش سقفِ شمارش هم دور
  // زده می‌شد از راهِ دیگر: قبلاً یک `log_id` می‌توانست بی‌نهایت بار
  // feedback بگیرد — یعنی **یک** سؤال + N درخواستِ ارزان، بدونِ هیچ سؤالِ
  // تازه‌ای. حالا خودِ `wasCorrected` (که از قبل وجود داشت و فقط نوشته
  // می‌شد) نقشِ claim را بازی می‌کند.
  //
  // اتمیک و پیش از هر نوشتنِ واژگان: `updateMany` با شرطِ
  // `wasCorrected: false` یعنی دو درخواستِ کاملاً هم‌زمان هم فقط یکی‌شان
  // ردیف را برمی‌دارد (شرط داخلِ همان UPDATE ارزیابی می‌شود، نه در JS).
  const claimed = await db.restaurantAssistantLog.updateMany({
    where: { id: logId, restaurantId, wasCorrected: false },
    data: { wasCorrected: true, finalIntent: correctIntent },
  });
  if (claimed.count === 0) {
    throw Err.validation('این سؤال قبلاً اصلاح شده است؛ برای آموزشِ دوباره یک سؤالِ تازه بپرس');
  }

  const tokens = [...new Set(tokenize(log.question))].slice(0, MAX_TAUGHT_TOKENS);
  if (tokens.length > 0) {
    // ۱) تقویتِ کلمه‌های موجود — فقط تا سقف. شرطِ `count < MAX` داخلِ خودِ
    //    UPDATE است، پس نه ریسِ read-modify-write دارد و نه N رفت‌وبرگشت
    //    (قبلاً یک upsert به‌ازای هر توکن بود).
    await db.restaurantAssistantVocab.updateMany({
      where: { restaurantId, intent: correctIntent, word: { in: tokens }, count: { lt: MAX_VOCAB_COUNT } },
      data: { count: { increment: 1 } },
    });
    // ۲) کلمه‌های تازه. ترتیب مهم است: اگر createMany اول می‌آمد،
    //    ردیفِ تازه بلافاصله با updateMany به ۲ می‌رسید.
    await db.restaurantAssistantVocab.createMany({
      data: tokens.map((word) => ({ restaurantId, intent: correctIntent, word })),
      skipDuplicates: true,
    });
  }

  // ── ردِ حسابرسیِ آموزش ──
  // ⚠️ صداقت درباره‌ی محدوده: این یک لاگِ ساختاریافته است، نه ردیفی در
  // `audit_logs`. نوشتن در آن جدول از راهِ `lib/audit.ts` می‌گذرد و
  // `AuditAction` یک اتحادِ بسته است — افزودنِ `assistant.teach` به آن
  // فایل خارج از دامنه‌ی این تغییر بود. لاگ همان نیمه‌ای را می‌دهد که
  // خودِ `audit()` هم اول انجام می‌دهد (alerting/forensics بلادرنگ)؛
  // نیمه‌ی ماندگارش هنوز باز است و در گزارش ثبت شده.
  auditLog.info('assistant.teach', {
    restaurantId, logId, intent: correctIntent,
    teacherStaffId: staffId ?? null, askerStaffId: log.staffId,
    detectedIntent: log.detectedIntent, tokens: tokens.length,
  });

  const answer = await generateAnswer(correctIntent, restaurantId, exampleQuestions());
  return { answer, intent: correctIntent };
}

export interface AssistantStats {
  total_questions: number;
  corrected_count: number;
  learned_words: number;
  example_questions: string[];
}

/** آمارِ شفافیت — چقدر سؤال پرسیده شده، چقدر اصلاح شده (یعنی چقدر یاد گرفته)،
 *  واژگانِ یادگرفته چقدر بزرگ شده. همان فلسفه‌ی «شفاف، نه silent» که در
 *  restaurant/ai برایِ مدلِ no-show رعایت شده. */
export async function getAssistantStats(restaurantId: string): Promise<AssistantStats> {
  const [totalQuestions, correctedCount, vocabSize] = await Promise.all([
    db.restaurantAssistantLog.count({ where: { restaurantId } }),
    db.restaurantAssistantLog.count({ where: { restaurantId, wasCorrected: true } }),
    db.restaurantAssistantVocab.count({ where: { restaurantId } }),
  ]);
  return {
    total_questions: totalQuestions,
    corrected_count: correctedCount,
    learned_words: vocabSize,
    example_questions: exampleQuestions(),
  };
}
