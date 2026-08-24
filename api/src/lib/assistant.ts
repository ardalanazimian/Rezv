import { db } from './db';
import { Err } from './errors';
import {
  tokenize, classify, isAssistantIntent, CONFIDENCE_THRESHOLD,
  INTENT_LABELS, INTENT_EXAMPLE_QUESTION, DATA_INTENTS,
  type AssistantIntent,
} from './assistant-nlu';
import { generateAnswer } from './assistant-answers';

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

async function loadLearnedVocab(restaurantId: string): Promise<Record<string, Record<string, number>>> {
  const rows = await db.restaurantAssistantVocab.findMany({
    where: { restaurantId },
    select: { intent: true, word: true, count: true },
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
}): Promise<{ answer: string; intent: AssistantIntent }> {
  const { restaurantId, logId, correctIntent } = opts;
  if (!isAssistantIntent(correctIntent)) throw Err.validation('نیتِ نامعتبر');

  const log = await db.restaurantAssistantLog.findUnique({ where: { id: logId } });
  if (!log || log.restaurantId !== restaurantId) throw Err.notFound('این سؤال');

  const tokens = [...new Set(tokenize(log.question))];
  if (tokens.length > 0) {
    await Promise.all(tokens.map((word) =>
      db.restaurantAssistantVocab.upsert({
        where: { restaurantId_intent_word: { restaurantId, intent: correctIntent, word } },
        create: { restaurantId, intent: correctIntent, word, count: 1 },
        update: { count: { increment: 1 }, updatedAt: new Date() },
      }),
    ));
  }

  await db.restaurantAssistantLog.update({
    where: { id: logId },
    data: { wasCorrected: true, finalIntent: correctIntent },
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
