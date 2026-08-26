// ═══════════════════════════════════════════════════════════
//  لایه‌ی Validation متمرکز — API شبیهِ Zod، بدونِ وابستگیِ خارجی.
//
//  چرا این و نه خودِ Zod (فعلاً): محیطِ فعلی شبکه ندارد و نمی‌توان zod را نصب کرد.
//  این لایه همان سه مشکلِ validationِ دستی را حل می‌کند:
//    ۱. Type Inference — از schema، تایپِ خروجی استنتاج می‌شود (Infer<typeof s>)
//    ۲. فرمتِ خطای یکدست — همه‌ی خطاها یک شکل دارند (ValidationError با field+message)
//    ۳. عدم تکرار — schemaها یک‌جا تعریف و در routeها استفاده می‌شوند
//
//  ⚠️ Immutability (حیاتی): همه‌ی متدهای builder (optional/default/nullable/min/max/...)
//  یک نسخه‌ی cloneشده برمی‌گردانند، نه this. چون این پروژه primitiveهای مشترک
//  (zPhone/zUuid/... در lib/schemas.ts) را به‌عنوان const سطح‌ماژول export می‌کند و
//  در روت‌های مختلف با/بدون .optional() استفاده می‌کند — اگر builder، خودِ instance
//  را mutate می‌کرد، یک .optional() در یک فایل، فیلدِ الزامی در همه‌ی فایل‌های دیگری که
//  همان const را (بدون .optional) استفاده می‌کنند هم به‌صورت خاموش optional می‌کرد
//  (باگ bypass اعتبارسنجی سراسری). این دقیقاً رفتار Zod واقعی هم هست (immutable schemas).
//
//  مهاجرت به Zod در آینده: چون API عمداً شبیهِ Zod است، کافی است
//  `import { z } from './validate'` به `import { z } from 'zod'` تغییر کند
//  و بیشترِ schemaها بدونِ تغییر کار می‌کنند. (وقتی شبکه وصل شد + zod نصب شد.)
// ═══════════════════════════════════════════════════════════
import { Err } from './errors';

export interface Issue { field: string; message: string }

export class SchemaError extends Error {
  issues: Issue[];
  constructor(issues: Issue[]) {
    super(issues.map(i => `${i.field}: ${i.message}`).join('؛ '));
    this.issues = issues;
  }
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };

/** پایه‌ی همه‌ی schemaها. */
export abstract class Schema<T> {
  protected _optional = false;
  protected _default?: T;
  protected _nullable = false;
  abstract _parse(v: unknown, path: string): ParseResult<T>;

  /** clone سطحی: instance جدید از همان کلاس با همان own-propertyها (برای immutability). */
  protected clone(): this {
    const c = Object.create(Object.getPrototypeOf(this));
    return Object.assign(c, this);
  }

  optional(): Schema<T | undefined> {
    const c = this.clone();
    c._optional = true;
    return c as unknown as Schema<T | undefined>;
  }
  default(val: T): Schema<T> {
    const c = this.clone();
    c._default = val;
    c._optional = true;
    return c;
  }
  /** null صریح را به‌عنوان مقدار معتبر (نه «ارسال‌نشده») می‌پذیرد — برای PATCH نیمه که
   *  باید بین «کلید نیامده» (دست‌نخورده) و «کلید=null» (عمداً پاک‌شده) فرق بگذارد. */
  nullable(): Schema<T | null> {
    const c = this.clone();
    c._nullable = true;
    return c as unknown as Schema<T | null>;
  }

  /** parse با پرتابِ خطای یکدست (برای استفاده در route). */
  parse(v: unknown): T {
    const r = this._parse(v, '');
    if (r.ok) return r.value;
    // فرمتِ خطای یکدست → همان Err.validation پروژه (سازگار با errorResponse)
    throw Err.validation(r.issues.map(i => `${i.field || 'ورودی'}: ${i.message}`).join('؛ '));
  }

  /** parse امن بدونِ پرتاب (برای منطقِ شرطی). */
  safeParse(v: unknown): ParseResult<T> {
    return this._parse(v, '');
  }

  protected handleEmpty(v: unknown): ParseResult<T> | null {
    if (v === null && this._nullable) return { ok: true, value: null as unknown as T };
    if (v === undefined || v === null) {
      if (this._default !== undefined) return { ok: true, value: this._default };
      if (this._optional) return { ok: true, value: undefined as unknown as T };
      return { ok: false, issues: [{ field: '', message: 'الزامی است' }] };
    }
    return null;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class StringSchema extends Schema<string> {
  private _min?: number; private _max?: number; private _regex?: RegExp; private _trim = false;
  private _regexMsg?: string;
  min(n: number) { const c = this.clone(); c._min = n; return c; }
  max(n: number) { const c = this.clone(); c._max = n; return c; }
  regex(r: RegExp, msg?: string) { const c = this.clone(); c._regex = r; c._regexMsg = msg; return c; }
  trim() { const c = this.clone(); c._trim = true; return c; }
  /** UUID v1-5 معتبر (فرمت شناسه‌های Prisma در این پروژه). */
  uuid() { const c = this.clone(); c._regex = UUID_RE; c._regexMsg = 'باید UUID معتبر باشد'; return c; }
  email() { const c = this.clone(); c._regex = EMAIL_RE; c._regexMsg = 'ایمیل معتبر نیست'; return c; }
  _parse(v: unknown, path: string): ParseResult<string> {
    const empty = this.handleEmpty(v); if (empty) return this.tagPath(empty, path);
    let s = v;
    if (typeof s !== 'string') {
      if (typeof s === 'number') s = String(s); // پذیرشِ نرمِ عدد → رشته
      else return { ok: false, issues: [{ field: path, message: 'باید رشته باشد' }] };
    }
    if (this._trim) s = (s as string).trim();
    const str = s as string;
    if (this._min !== undefined && str.length < this._min) return { ok: false, issues: [{ field: path, message: `حداقل ${this._min} کاراکتر` }] };
    if (this._max !== undefined && str.length > this._max) return { ok: false, issues: [{ field: path, message: `حداکثر ${this._max} کاراکتر` }] };
    if (this._regex && !this._regex.test(str)) return { ok: false, issues: [{ field: path, message: this._regexMsg || 'قالب نامعتبر' }] };
    return { ok: true, value: str };
  }
  private tagPath(r: ParseResult<string>, path: string): ParseResult<string> {
    if (!r.ok) r.issues = r.issues.map(i => ({ ...i, field: i.field || path }));
    return r;
  }
}

class NumberSchema extends Schema<number> {
  private _min?: number; private _max?: number; private _int = false;
  min(n: number) { const c = this.clone(); c._min = n; return c; }
  max(n: number) { const c = this.clone(); c._max = n; return c; }
  int() { const c = this.clone(); c._int = true; return c; }
  _parse(v: unknown, path: string): ParseResult<number> {
    const empty = this.handleEmpty(v); if (empty) { if (!empty.ok) empty.issues = empty.issues.map(i => ({ ...i, field: path })); return empty; }
    let n = v;
    if (typeof n === 'string' && n.trim() !== '') n = Number(n); // پذیرشِ نرمِ رشته‌ی عددی
    // ⚠️ رفعِ یافته‌ی ۱۸ (فازِ ۲) — `Number.isFinite` به‌جای `!Number.isNaN`:
    // `Infinity` هم `typeof === 'number'` است و هم NaN نیست، پس از فیلترِ قبلی
    // رد می‌شد. راهِ ورود واقعی است، نه نظری: `JSON.parse('{"x":1e400}')`
    // مقدارِ `Infinity` می‌دهد و مسیرِ نرمِ رشته→عدد هم `Number('1e400')` را.
    // `.int()` فقط بخشی از فیلدها را می‌بست؛ فیلدهای `z.number()`ِ بدونِ `.int()`
    // مقدار را تا لایه‌ی Prisma می‌بردند ⇒ خطای خامِ ۵۰۰ به‌جای ۴۲۲.
    // `Number.isFinite` هر سه‌ی NaN، Infinity و -Infinity را با هم رد می‌کند.
    if (typeof n !== 'number' || !Number.isFinite(n)) return { ok: false, issues: [{ field: path, message: 'باید عدد باشد' }] };
    const num = n as number;
    if (this._int && !Number.isInteger(num)) return { ok: false, issues: [{ field: path, message: 'باید عددِ صحیح باشد' }] };
    if (this._min !== undefined && num < this._min) return { ok: false, issues: [{ field: path, message: `حداقل ${this._min}` }] };
    if (this._max !== undefined && num > this._max) return { ok: false, issues: [{ field: path, message: `حداکثر ${this._max}` }] };
    return { ok: true, value: num };
  }
}

class BooleanSchema extends Schema<boolean> {
  _parse(v: unknown, path: string): ParseResult<boolean> {
    const empty = this.handleEmpty(v); if (empty) { if (!empty.ok) empty.issues = empty.issues.map(i => ({ ...i, field: path })); return empty; }
    if (typeof v === 'string') { // پذیرشِ نرم برای query string ('true'/'false'/'1'/'0')
      if (v === 'true' || v === '1') return { ok: true, value: true };
      if (v === 'false' || v === '0') return { ok: true, value: false };
    }
    if (typeof v !== 'boolean') return { ok: false, issues: [{ field: path, message: 'باید بولی باشد' }] };
    return { ok: true, value: v };
  }
}

class EnumSchema<T extends string> extends Schema<T> {
  constructor(private values: readonly T[]) { super(); }
  _parse(v: unknown, path: string): ParseResult<T> {
    const empty = this.handleEmpty(v); if (empty) { if (!empty.ok) empty.issues = empty.issues.map(i => ({ ...i, field: path })); return empty; }
    if (!this.values.includes(v as T)) return { ok: false, issues: [{ field: path, message: `باید یکی از: ${this.values.join('، ')}` }] };
    return { ok: true, value: v as T };
  }
}

class ArraySchema<T> extends Schema<T[]> {
  private _min?: number; private _max?: number;
  constructor(private item: Schema<T>) { super(); }
  min(n: number) { const c = this.clone(); c._min = n; return c; }
  max(n: number) { const c = this.clone(); c._max = n; return c; }
  _parse(v: unknown, path: string): ParseResult<T[]> {
    const empty = this.handleEmpty(v); if (empty) { if (!empty.ok) empty.issues = empty.issues.map(i => ({ ...i, field: path })); return empty; }
    if (!Array.isArray(v)) return { ok: false, issues: [{ field: path, message: 'باید آرایه باشد' }] };
    if (this._min !== undefined && v.length < this._min) return { ok: false, issues: [{ field: path, message: `حداقل ${this._min} عضو` }] };
    if (this._max !== undefined && v.length > this._max) return { ok: false, issues: [{ field: path, message: `حداکثر ${this._max} عضو` }] };
    const out: T[] = [];
    const issues: Issue[] = [];
    v.forEach((el, i) => {
      const r = this.item._parse(el, `${path}[${i}]`);
      if (r.ok) out.push(r.value); else issues.push(...r.issues);
    });
    if (issues.length) return { ok: false, issues };
    return { ok: true, value: out };
  }
}

/** برای فیلدهای JSON آزاد (config دلخواه) که باید کامل حفظ شوند، نه فیلتر بر اساس shape ثابت. */
class RecordSchema extends Schema<Record<string, unknown>> {
  _parse(v: unknown, path: string): ParseResult<Record<string, unknown>> {
    const empty = this.handleEmpty(v); if (empty) { if (!empty.ok) empty.issues = empty.issues.map(i => ({ ...i, field: path })); return empty; }
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      return { ok: false, issues: [{ field: path, message: 'باید آبجکت باشد' }] };
    }
    return { ok: true, value: v as Record<string, unknown> };
  }
}

type Shape = Record<string, Schema<any>>;
type InferShape<S extends Shape> = { [K in keyof S]: S[K] extends Schema<infer U> ? U : never };

class ObjectSchema<S extends Shape> extends Schema<InferShape<S>> {
  constructor(private shape: S) { super(); }
  _parse(v: unknown, path: string): ParseResult<InferShape<S>> {
    const empty = this.handleEmpty(v); if (empty) { if (!empty.ok) empty.issues = empty.issues.map(i => ({ ...i, field: path })); return empty as ParseResult<InferShape<S>>; }
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      return { ok: false, issues: [{ field: path, message: 'باید آبجکت باشد' }] };
    }
    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const issues: Issue[] = [];
    for (const key of Object.keys(this.shape)) {
      const fieldPath = path ? `${path}.${key}` : key;
      const r = this.shape[key]._parse(obj[key], fieldPath);
      if (r.ok) { if (r.value !== undefined) out[key] = r.value; }
      else issues.push(...r.issues.map(i => ({ ...i, field: i.field || fieldPath })));
    }
    if (issues.length) return { ok: false, issues };
    return { ok: true, value: out as InferShape<S> };
  }
}

// ── سازنده‌ها به سبکِ Zod: z.string(), z.object({...}) ──
export const z = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  enum: <const T extends string>(values: readonly T[]) => new EnumSchema(values),
  object: <S extends Shape>(shape: S) => new ObjectSchema(shape),
  array: <T>(item: Schema<T>) => new ArraySchema(item),
  /** آبجکت آزاد (JSON config دلخواه) — کلیدها فیلتر نمی‌شوند. */
  record: () => new RecordSchema(),
};

/** استنتاجِ تایپ از schema — مثلِ z.infer در Zod. */
export type Infer<T> = T extends Schema<infer U> ? U : never;
