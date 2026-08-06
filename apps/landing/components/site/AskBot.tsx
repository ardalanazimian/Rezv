'use client';

// ═══════════════════════════════════════════════════════════════════════
//  «بپرس» — دستیارِ سایت
//
//  پاسخ‌ها از محتوای خودِ سایت می‌آیند (lib/answer.ts). یعنی هرچه اینجا
//  گفته می‌شود در سایت هم هست و مدیر می‌تواند از داشبورد اصلاحش کند.
//  اگر جوابی پیدا نشود، صریح می‌گوید نمی‌داند و به تماس با فروش می‌برد —
//  هیچ‌وقت از خودش چیزی نمی‌سازد.
//
//  پیکره در سرور ساخته و به‌صورتِ prop تزریق می‌شود، پس جست‌وجو در مرورگر
//  اتفاق می‌افتد: بدونِ رفت‌وبرگشتِ شبکه، و بدونِ اینکه سؤالِ کاربر جایی
//  فرستاده شود.
// ═══════════════════════════════════════════════════════════════════════

import Link from 'next/link';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Icon } from './Icon';
import { answer, starters, type KbDoc, type Answer } from '@/lib/answer';

interface Turn {
  who: 'user' | 'bot';
  text: string;
  source?: Answer['source'];
  related?: Answer['related'];
}

const GREETING =
  'سلام. هرچه درباره‌ی اپِ مشتری، پنلِ کسب‌وکار، قیمت یا دموی رایگان بپرسی ' +
  'از محتوای همین سایت جواب می‌دهم. اگر چیزی را ندانم، صریح می‌گویم.';

export function AskBot({ docs }: { docs: KbDoc[] }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([{ who: 'bot', text: GREETING }]);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const suggestions = starters(docs);

  const ask = useCallback((q: string) => {
    const question = q.trim();
    if (!question) return;
    const a = answer(question, docs);
    setTurns((prev) => [
      ...prev,
      { who: 'user', text: question },
      { who: 'bot', text: a.text, source: a.source, related: a.related },
    ]);
    setDraft('');
  }, [docs]);

  // پیام‌های تازه باید دیده شوند
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  // باز که شد، فوکوس روی ورودی؛ Escape می‌بندد
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`askbot__fab${open ? ' is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="askbot-panel"
        aria-label={open ? 'بستنِ دستیار' : 'پرسش از دستیارِ رزرونو'}
      >
        <Icon name={open ? 'x' : 'chat'} size={20} />
        {!open && <span className="askbot__fab-label">سؤالی داری؟</span>}
      </button>

      <div
        id="askbot-panel"
        className="askbot"
        data-open={open}
        hidden={!open}
        role="dialog"
        aria-label="دستیارِ رزرونو"
        ref={panelRef}
      >
        <header className="askbot__head">
          <span className="askbot__title">
            <span className="askbot__dot" aria-hidden="true" />
            دستیارِ رزرونو
          </span>
          <button type="button" className="askbot__close" onClick={() => setOpen(false)} aria-label="بستن">
            <Icon name="x" size={17} />
          </button>
        </header>

        <div className="askbot__list" ref={listRef}>
          {turns.map((t, i) => (
            <div key={i} className={`askbot__turn askbot__turn--${t.who}`}>
              <p className="askbot__bubble">{t.text}</p>
              {t.source && (
                <Link className="askbot__src" href={t.source.href} onClick={() => setOpen(false)}>
                  <Icon name="arrowLeft" size={14} />
                  {t.source.title}
                </Link>
              )}
              {t.related && t.related.length > 0 && (
                <div className="askbot__chips">
                  {t.related.map((r) => (
                    <button key={r.id} type="button" className="askbot__chip" onClick={() => ask(r.q)}>
                      {r.q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {turns.length === 1 && suggestions.length > 0 && (
            <div className="askbot__chips askbot__chips--start">
              {suggestions.map((sg) => (
                <button key={sg.id} type="button" className="askbot__chip" onClick={() => ask(sg.q)}>
                  {sg.q}
                </button>
              ))}
            </div>
          )}
        </div>

        <form
          className="askbot__form"
          onSubmit={(e) => { e.preventDefault(); ask(draft); }}
        >
          <input
            ref={inputRef}
            className="askbot__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="سؤالت را بنویس…"
            aria-label="سؤال"
          />
          <button type="submit" className="askbot__send" aria-label="ارسال" disabled={!draft.trim()}>
            <Icon name="arrowLeft" size={18} />
          </button>
        </form>

        <p className="askbot__note">
          پاسخ‌ها از محتوای همین سایت‌اند. برای موردِ خاص،{' '}
          <Link href="/contact" onClick={() => setOpen(false)}>با کارشناسِ ما حرف بزن</Link>.
        </p>
      </div>
    </>
  );
}
