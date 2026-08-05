// ═══════════════════════════════════════════════════════════════════════
//  بلوک‌های محتوایی — موتورِ رندرِ صفحه‌های CMS
//
//  هر صفحه در دیتابیس یک آرایه از بلوک‌هاست. اینجا هر `type` به یک کامپوننتِ
//  طراحی‌شده نگاشت می‌شود. دو قاعده‌ی مهم:
//    • بلوکِ ناشناخته نادیده گرفته می‌شود (نه خطا) → افزودنِ بلوکِ تازه از
//      استودیو هرگز صفحه‌ی زنده را نمی‌شکند.
//    • هر فیلدِ متنی اختیاری است و نبودش فقط یعنی آن تکه رندر نمی‌شود.
//  دیتای زنده (پلن/پرسش/نظر) از بیرون تزریق می‌شود تا بلوک‌ها خالص بمانند.
// ═══════════════════════════════════════════════════════════════════════
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '../site/Icon';
import { Reveal, CountUp } from '../site/Motion';
import { LiveFlow } from './LiveFlow';
import { PinnedStory } from './PinnedStory';
import { SplitText, Magnetic, Ambient, Tilt, Parallax } from '../site/Kinetic';
import { Visual } from './Visuals';
import { PlanCards } from '../pricing/PlanCards';
import { FaqAccordion } from '../site/FaqAccordion';
import { renderMarkdown } from '@/lib/markdown';
import { faDate } from '@/lib/format';
import type { Section, SiteFaq, SitePlan, SiteTestimonial, Cta } from '@/lib/content-types';

// ── کمک‌کننده‌های خواندنِ امنِ فیلدهای CMS ──
const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const b = (v: unknown): boolean => v === true;
const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const cta = (v: unknown): Cta | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const label = s(o.label);
  const href = s(o.href);
  return label && href ? { label, href } : null;
};

export interface SectionData {
  plans: SitePlan[];
  faqs: SiteFaq[];
  testimonials: SiteTestimonial[];
}

function CtaButtons({ primary, secondary, size = 'lg' }: { primary: Cta | null; secondary: Cta | null; size?: 'lg' | 'md' }) {
  if (!primary && !secondary) return null;
  const cls = size === 'lg' ? 'btn--lg' : '';
  return (
    <div className="row cta-row" style={{ gap: 'var(--sp-3)' }}>
      {primary && (
        <Magnetic>
          <Link href={primary.href} className={`btn btn--primary ${cls}`}>
            {primary.label}
            <Icon name="arrowLeft" size={18} className="btn__arrow" />
          </Link>
        </Magnetic>
      )}
      {secondary && (
        <Link href={secondary.href} className={`btn btn--ghost ${cls}`}>{secondary.label}</Link>
      )}
    </div>
  );
}

function Head({ eyebrow, title, subtitle, center = true }: {
  eyebrow?: string | null; title?: string | null; subtitle?: string | null; center?: boolean;
}) {
  if (!title && !eyebrow && !subtitle) return null;
  return (
    <Reveal className={`section-head${center ? ' section-head--center' : ''}`}>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      {title && <h2 className="h2">{title}</h2>}
      {subtitle && <p className="lead">{subtitle}</p>}
    </Reveal>
  );
}

// ═══════════════ hero ═══════════════

function Hero({ sec }: { sec: Section }) {
  const panelKind = (sec.panel as { kind?: string } | undefined)?.kind;
  const hasPanel = Boolean(panelKind);
  const compact = s(sec.variant) === 'compact';
  const bullets = list<string>(sec.bullets);

  return (
    <section className={`hero${compact ? ' hero--compact' : ''}${hasPanel ? '' : ' hero--center'}`}>
      <div className="aurora" aria-hidden="true">
        <span className="aurora__blob" /><span className="aurora__blob" /><span className="aurora__blob" />
      </div>
      <div className="grid-bg" aria-hidden="true" />
      <Ambient />

      <div className={`container hero__inner${hasPanel ? ' hero__inner--split' : ''}`}>
        <div className="hero__content">
          {s(sec.eyebrow) && (
            <Reveal>
              <span className="eyebrow">
                <Icon name="sparkle" size={14} />
                {s(sec.eyebrow)}
              </span>
            </Reveal>
          )}

          {/* عنوان کلمه‌به‌کلمه از پایین می‌آید — نه یک بلوکِ محو */}
          <h1 className="display">
            {s(sec.title) && <SplitText text={s(sec.title) as string} delay={120} />}
            {s(sec.highlight) && (
              <> <SplitText className="text-gradient" text={s(sec.highlight) as string} delay={340} /></>
            )}
          </h1>

          {s(sec.subtitle) && (
            <Reveal delay={120}>
              <p className="lead" style={{ maxWidth: '38ch' }}>{s(sec.subtitle)}</p>
            </Reveal>
          )}

          <Reveal delay={180}>
            <CtaButtons primary={cta(sec.primary)} secondary={cta(sec.secondary)} />
          </Reveal>

          {s(sec.note) && (
            <Reveal delay={220}>
              <p className="small muted">{s(sec.note)}</p>
            </Reveal>
          )}

          {bullets.length > 0 && (
            <Reveal delay={260}>
              <ul className="hero__bullets">
                {bullets.map((item) => (
                  <li key={item}><Icon name="check" size={16} />{item}</li>
                ))}
              </ul>
            </Reveal>
          )}
        </div>

        {hasPanel && (
          <Parallax speed={0.1}>
            <Reveal delay={140}>
              <Visual kind={panelKind} />
            </Reveal>
          </Parallax>
        )}
      </div>
    </section>
  );
}

// ═══════════════ metrics ═══════════════

interface MetricItem { value?: string; suffix?: string; label?: string; hint?: string }

function Metrics({ sec }: { sec: Section }) {
  const items = list<MetricItem>(sec.items);
  if (!items.length) return null;
  return (
    <section className="section section--tight">
      <div className="container">
        <Head eyebrow={s(sec.eyebrow)} title={s(sec.title)} subtitle={s(sec.subtitle)} />
        <div className="grid grid-4">
          {items.map((m, i) => (
            <Reveal key={`${m.label}-${i}`} delay={i * 70}>
              <div className="metric">
                <span className="metric__value">
                  <CountUp value={m.value ?? ''} />
                  {m.suffix && <span className="metric__suffix">{m.suffix}</span>}
                </span>
                {m.label && <span className="metric__label">{m.label}</span>}
                {m.hint && <span className="metric__hint">{m.hint}</span>}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════ apps ═══════════════

interface AppCard { badge?: string; title?: string; body?: string; points?: string[]; cta?: Cta }

function Apps({ sec }: { sec: Section }) {
  const cards = list<AppCard>(sec.cards);
  if (!cards.length) return null;
  return (
    <section className="section section--subtle section--edge">
      <div className="container">
        <Head eyebrow={s(sec.eyebrow)} title={s(sec.title)} subtitle={s(sec.subtitle)} />
        {/* ادعای «یک دادهٔ واحد بینِ دو اپ» را نشان می‌دهد، نه فقط می‌گوید:
            رزروها از سمتِ اپِ مشتری حرکت می‌کنند و در پنل می‌نشینند. */}
        <Reveal>
          <div style={{ marginBlockEnd: 'var(--sp-10)' }}><LiveFlow /></div>
        </Reveal>
        <div className="grid grid-2">
          {cards.map((card, i) => (
            <Reveal key={card.title ?? i} delay={i * 100}>
              <Tilt><article className="app-card">
                {card.badge && <span className="eyebrow" style={{ alignSelf: 'flex-start' }}>{card.badge}</span>}
                {card.title && <h3 className="h3">{card.title}</h3>}
                {card.body && <p className="body">{card.body}</p>}
                {card.points?.length ? (
                  <ul className="app-card__points">
                    {card.points.map((p) => (
                      <li key={p}><Icon name="check" size={17} />{p}</li>
                    ))}
                  </ul>
                ) : null}
                {card.cta && (
                  <Link href={card.cta.href} className="btn btn--ghost" style={{ alignSelf: 'flex-start' }}>
                    {card.cta.label}
                    <Icon name="arrowLeft" size={16} className="btn__arrow" />
                  </Link>
                )}
              </article></Tilt>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}


// ═══════════════ ticker — نوارِ متحرکِ قابلیت‌ها ═══════════════

function Ticker({ sec }: { sec: Section }) {
  const items = list<string>(sec.items);
  if (!items.length) return null;
  // دو بار تکرار می‌شود چون انیمیشن تا ۵۰٪ می‌رود و بی‌درز حلقه می‌زند.
  const row = [...items, ...items];
  return (
    <div className="kx-ticker" aria-label={s(sec.title) ?? 'قابلیت‌ها'}>
      <div className="kx-ticker__row">
        {row.map((it, i) => (
          <span className="kx-ticker__item" key={i} aria-hidden={i >= items.length}>
            <Icon name="sparkle" size={15} />
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

// ═══════════════ features ═══════════════

interface FeatureItem { icon?: string; title?: string; body?: string }

function Features({ sec }: { sec: Section }) {
  const items = list<FeatureItem>(sec.items);
  if (!items.length) return null;
  return (
    <section className="section">
      <div className="container">
        <Head eyebrow={s(sec.eyebrow)} title={s(sec.title)} subtitle={s(sec.subtitle)} />
        <div className="grid grid-3">
          {items.map((f, i) => (
            <Reveal key={f.title ?? i} delay={(i % 3) * 80}>
              <article className="card card--hover feature">
                <span className="icon-tile"><Icon name={f.icon ?? 'dot'} /></span>
                {f.title && <h3 className="feature__title">{f.title}</h3>}
                {f.body && <p className="feature__body">{f.body}</p>}
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════ split ═══════════════

function Split({ sec }: { sec: Section }) {
  const bullets = list<string>(sec.bullets);
  const link = cta(sec.cta);
  const visual = (sec.visual as { kind?: string } | undefined)?.kind;

  return (
    <section className="section">
      <div className={`container split${b(sec.reverse) ? ' split--reverse' : ''}`}>
        <div className="split__content">
          {s(sec.eyebrow) && <Reveal><span className="eyebrow">{s(sec.eyebrow)}</span></Reveal>}
          {s(sec.title) && <Reveal delay={60}><h2 className="h2">{s(sec.title)}</h2></Reveal>}
          {s(sec.body) && <Reveal delay={100}><p className="lead">{s(sec.body)}</p></Reveal>}
          {bullets.length > 0 && (
            <Reveal delay={140}>
              <ul className="split__list">
                {bullets.map((item) => (
                  <li key={item}><Icon name="checkCircle" size={19} />{item}</li>
                ))}
              </ul>
            </Reveal>
          )}
          {link && (
            <Reveal delay={180}>
              <Link href={link.href} className="btn btn--ghost">
                {link.label}
                <Icon name="arrowLeft" size={16} className="btn__arrow" />
              </Link>
            </Reveal>
          )}
        </div>
        <Reveal className="split__media" delay={120}>
          <Visual kind={visual} />
        </Reveal>
      </div>
    </section>
  );
}

// ═══════════════ steps ═══════════════

interface StepItem { title?: string; body?: string }

function Steps({ sec }: { sec: Section }) {
  const items = list<StepItem>(sec.items);
  if (!items.length) return null;
  const alt = s(sec.variant) === 'alt';
  return (
    <section className={`section${alt ? ' section--subtle section--edge' : ''}`}>
      <div className="container">
        <Head eyebrow={s(sec.eyebrow)} title={s(sec.title)} subtitle={s(sec.subtitle)} />
        <div className="steps">
          {items.map((step, i) => (
            <Reveal key={step.title ?? i} delay={i * 90}>
              <article className="step">
                {step.title && <h3 className="step__title">{step.title}</h3>}
                {step.body && <p className="step__body">{step.body}</p>}
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════ comparison ═══════════════

interface CompareRow { label?: string; values?: (boolean | string)[] }

function CompareCell({ value }: { value: boolean | string }) {
  if (value === true) return <span className="compare-cell"><Icon name="checkCircle" size={20} /></span>;
  if (value === false) return <span className="compare-cell compare-cell--no"><Icon name="minus" size={18} /></span>;
  return <span className="compare-cell compare-cell--partial">{value}</span>;
}

function Comparison({ sec }: { sec: Section }) {
  const columns = list<string>(sec.columns);
  const rows = list<CompareRow>(sec.rows);
  if (!columns.length || !rows.length) return null;
  // ستونِ آخر همیشه «رزرونو» است — تأکیدِ بصری روی همان.
  const lastIndex = columns.length - 1;

  return (
    <section className="section">
      <div className="container">
        <Head eyebrow={s(sec.eyebrow)} title={s(sec.title)} subtitle={s(sec.subtitle)} />
        <Reveal>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">{s(sec.title) ?? 'مقایسه'}</caption>
              <thead>
                <tr>
                  <th scope="col">قابلیت</th>
                  {columns.map((c, i) => (
                    <th key={c} scope="col" className={i === lastIndex ? 'is-brand' : undefined} style={{ textAlign: 'center' }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" style={{ fontWeight: 600, background: 'transparent', position: 'static' }}>
                      {row.label}
                    </th>
                    {columns.map((_, i) => (
                      <td key={i} style={{ textAlign: 'center' }}>
                        <CompareCell value={row.values?.[i] ?? false} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ═══════════════ showcase ═══════════════

import { ShowcaseTabs } from './ShowcaseTabs';

interface ShowcaseTab { key?: string; label?: string; title?: string; body?: string; items?: string[] }

function Showcase({ sec }: { sec: Section }) {
  const tabs = list<ShowcaseTab>(sec.tabs).filter((t) => t.label && t.title);
  if (!tabs.length) return null;
  return (
    <section className="section section--subtle section--edge">
      <div className="container">
        <Head eyebrow={s(sec.eyebrow)} title={s(sec.title)} subtitle={s(sec.subtitle)} />
        <ShowcaseTabs
          tabs={tabs.map((t, i) => ({
            key: t.key ?? String(i),
            label: t.label as string,
            title: t.title as string,
            body: t.body ?? '',
            items: t.items ?? [],
          }))}
        />
      </div>
    </section>
  );
}

// ═══════════════ pricing ═══════════════

function Pricing({ sec, data }: { sec: Section; data: SectionData }) {
  return (
    <section className="section" id="pricing">
      <div className="container">
        <Head eyebrow={s(sec.eyebrow)} title={s(sec.title)} subtitle={s(sec.subtitle)} />
        <PlanCards plans={data.plans} note={s(sec.note)} />
      </div>
    </section>
  );
}

// ═══════════════ testimonials ═══════════════

function Testimonials({ sec, data }: { sec: Section; data: SectionData }) {
  const items = data.testimonials;
  return (
    <section className="section section--subtle section--edge">
      <div className="container">
        <Head eyebrow={s(sec.eyebrow)} title={s(sec.title)} subtitle={s(sec.subtitle)} />
        {items.length === 0 ? (
          // حالتِ خالیِ صادقانه: نقلِ‌قولِ ساختگی نمی‌سازیم. مدیر از استودیو
          // نظرهای واقعی را اضافه می‌کند و همین‌جا نمایش داده می‌شوند.
          <Reveal>
            <div className="empty-state">
              <span className="empty-state__icon"><Icon name="chat" size={22} /></span>
              <p className="body" style={{ maxWidth: '42ch' }}>
                نظرهای مشتریان به‌زودی از میانِ رستوران‌های همکار منتشر می‌شود.
                تا آن زمان، ترجیح می‌دهیم چیزی ننویسیم که واقعی نباشد.
              </p>
              <Link href="/contact" className="btn btn--ghost btn--sm">
                گفت‌وگو با مشتریانِ فعلی
              </Link>
            </div>
          </Reveal>
        ) : (
          <div className="grid grid-3">
            {items.map((t, i) => (
              <Reveal key={t.id} delay={(i % 3) * 80}>
                <figure className="card quote" style={{ margin: 0 }}>
                  <div className="quote__stars" aria-label={`${t.rating} از ۵`}>
                    {Array.from({ length: Math.max(1, Math.min(5, t.rating)) }).map((_, k) => (
                      <Icon key={k} name="star" size={15} />
                    ))}
                  </div>
                  <blockquote className="quote__text" style={{ margin: 0 }}>«{t.quote}»</blockquote>
                  <figcaption className="quote__who">
                    <span className="quote__avatar">{t.author.trim().slice(0, 1)}</span>
                    <span className="stack" style={{ gap: 1 }}>
                      <span className="small" style={{ fontWeight: 700 }}>{t.author}</span>
                      <span className="tiny muted">
                        {[t.role, t.company].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ═══════════════ faq ═══════════════

function Faq({ sec, data }: { sec: Section; data: SectionData }) {
  const scope = s(sec.scope);
  const items = scope ? data.faqs.filter((f) => f.scope === scope) : data.faqs;
  if (!items.length) return null;
  return (
    <section className="section">
      <div className="container-narrow">
        <Head eyebrow={s(sec.eyebrow)} title={s(sec.title)} subtitle={s(sec.subtitle)} />
        <FaqAccordion items={items} />
      </div>
    </section>
  );
}

// ═══════════════ cta ═══════════════

function CtaBand({ sec }: { sec: Section }) {
  return (
    <section className="section">
      <div className="container">
        <Reveal>
          <div className="cta-band">
            {s(sec.title) && <h2 className="h1" style={{ marginBottom: 'var(--sp-4)' }}>{s(sec.title)}</h2>}
            {s(sec.body) && (
              <p className="lead" style={{ maxWidth: '46ch', marginInline: 'auto', marginBottom: 'var(--sp-8)' }}>
                {s(sec.body)}
              </p>
            )}
            <div className="row cta-row" style={{ justifyContent: 'center', gap: 'var(--sp-3)' }}>
              {cta(sec.primary) && (
                <Link href={cta(sec.primary)!.href} className="btn btn--primary btn--lg">
                  {cta(sec.primary)!.label}
                  <Icon name="arrowLeft" size={18} className="btn__arrow" />
                </Link>
              )}
              {cta(sec.secondary) && (
                <Link href={cta(sec.secondary)!.href} className="btn btn--ghost btn--lg">
                  {cta(sec.secondary)!.label}
                </Link>
              )}
            </div>
            {s(sec.note) && (
              <p className="small" style={{ marginTop: 'var(--sp-5)', color: 'rgba(255,255,255,.82)' }}>
                {s(sec.note)}
              </p>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ═══════════════ prose / legal ═══════════════

function Prose({ sec }: { sec: Section }) {
  const body = s(sec.body);
  if (!body) return null;
  return (
    <section className="section">
      <div className="container-narrow stack stack-6">
        {s(sec.title) && <Reveal><h2 className="h2">{s(sec.title)}</h2></Reveal>}
        <Reveal delay={60}>
          <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
        </Reveal>
      </div>
    </section>
  );
}

function Legal({ sec }: { sec: Section }) {
  const body = s(sec.body);
  const updated = s(sec.updatedAt);
  return (
    <section className="section">
      <div className="container-narrow stack stack-6">
        {s(sec.title) && <h1 className="h1">{s(sec.title)}</h1>}
        {updated && (
          <p className="small muted">
            {s(sec.updatedLabel) ?? 'آخرین بازنگری'}: {faDate(updated)}
          </p>
        )}
        {body && <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />}
      </div>
    </section>
  );
}

// ═══════════════ رجیستری ═══════════════

const BLOCKS: Record<string, (props: { sec: Section; data: SectionData }) => ReactNode> = {
  hero: ({ sec }) => <Hero sec={sec} />,
  metrics: ({ sec }) => <Metrics sec={sec} />,
  apps: ({ sec }) => <Apps sec={sec} />,
  ticker: ({ sec }) => <Ticker sec={sec} />,
  story: () => <PinnedStory />,
  features: ({ sec }) => <Features sec={sec} />,
  split: ({ sec }) => <Split sec={sec} />,
  steps: ({ sec }) => <Steps sec={sec} />,
  comparison: ({ sec }) => <Comparison sec={sec} />,
  showcase: ({ sec }) => <Showcase sec={sec} />,
  pricing: ({ sec, data }) => <Pricing sec={sec} data={data} />,
  testimonials: ({ sec, data }) => <Testimonials sec={sec} data={data} />,
  faq: ({ sec, data }) => <Faq sec={sec} data={data} />,
  cta: ({ sec }) => <CtaBand sec={sec} />,
  prose: ({ sec }) => <Prose sec={sec} />,
  legal: ({ sec }) => <Legal sec={sec} />,
};

/** آیا این صفحه بلوکی از این نوع دارد؟ (برای تصمیمِ واکشیِ داده در صفحه) */
export function hasBlock(sections: Section[], type: string): boolean {
  return sections.some((sec) => sec.type === type);
}

/** پرسش‌هایی که واقعاً در صفحه رندر می‌شوند — منبعِ FAQPage schema. */
export function faqScopesOf(sections: Section[]): string[] {
  return sections
    .filter((sec) => sec.type === 'faq')
    .map((sec) => (typeof sec.scope === 'string' ? sec.scope : 'general'));
}

export function SectionRenderer({ sections, data }: { sections: Section[]; data: SectionData }) {
  return (
    <>
      {sections.map((sec, i) => {
        const Block = BLOCKS[sec.type];
        // بلوکِ ناشناخته (مثلاً نوعی که در استودیو ساخته شده ولی هنوز کامپوننت
        // ندارد) بی‌صدا رد می‌شود — صفحه‌ی زنده نباید بشکند.
        if (!Block) return null;
        return <Block key={`${sec.type}-${i}`} sec={sec} data={data} />;
      })}
    </>
  );
}
