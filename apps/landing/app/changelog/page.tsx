import Link from 'next/link';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/site/JsonLd';
import { Icon } from '@/components/site/Icon';
import { Reveal } from '@/components/site/Motion';
import { getReleaseNotes } from '@/lib/site-api';
import { buildMetadata } from '@/lib/seo';
import { SITE } from '@/lib/i18n';
import { graph, webPageJsonLd, breadcrumbJsonLd } from '@/lib/site-schema';
import { renderMarkdown } from '@/lib/markdown';
import { faDate } from '@/lib/format';

export const revalidate = 600;

export const metadata: Metadata = buildMetadata({
  title: 'تغییرات محصول رزرونو',
  description: 'تازه‌ترین قابلیت‌ها، بهبودها و اصلاحاتِ پلتفرمِ رزرونو.',
  path: '/changelog',
  keywords: ['تغییرات رزرونو', 'به‌روزرسانی نرم افزار رستوران'],
});

export default async function ChangelogPage() {
  const notes = await getReleaseNotes();
  const pageUrl = `${SITE}/changelog`;

  return (
    <>
      <JsonLd
        data={graph([
          webPageJsonLd({ name: 'تغییرات محصول رزرونو', description: metadata.description as string, pageUrl }),
          breadcrumbJsonLd([{ name: 'تغییرات محصول', path: '/changelog' }]),
        ])}
        id="page-changelog"
      />

      <section className="hero hero--compact hero--center">
        <div className="grid-bg" aria-hidden="true" />
        <div className="container hero__inner">
          <div className="hero__content">
            <Reveal><span className="eyebrow"><Icon name="rocket" size={14} />تغییرات محصول</span></Reveal>
            <Reveal delay={60}>
              <h1 className="display">چه چیزی <span className="text-gradient">تازه است.</span></h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="lead" style={{ maxWidth: '42ch' }}>
                هر نسخه چه چیزی به رزرونو اضافه کرده — بدونِ اصطلاحاتِ فنیِ غیرضروری.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section section--tight">
        <div className="container-narrow">
          {notes.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state__icon"><Icon name="rocket" size={22} /></span>
              <p className="body">هنوز یادداشتِ انتشاری ثبت نشده است.</p>
            </div>
          ) : (
            <div className="timeline">
              {notes.map((note, i) => (
                <Reveal key={note.id} delay={i * 70} as="article">
                  <div className="timeline__item">
                    <span className="timeline__dot" aria-hidden="true" />
                    <div className="stack stack-3">
                      <div className="row" style={{ gap: 'var(--sp-3)' }}>
                        <span className="badge badge--brand">نسخه {note.version}</span>
                        {note.released_at && (
                          <time className="tiny muted" dateTime={note.released_at}>{faDate(note.released_at)}</time>
                        )}
                      </div>
                      <h2 className="h3">{note.title}</h2>
                      {note.tags.length > 0 && (
                        <div className="row" style={{ gap: 'var(--sp-2)' }}>
                          {note.tags.map((t) => <span key={t} className="badge">{t}</span>)}
                        </div>
                      )}
                      <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(note.body) }} />
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container-narrow">
          <Reveal>
            <div className="card card--pad-lg stack stack-4" style={{ textAlign: 'center' }}>
              <h2 className="h3">این قابلیت‌ها را روی رستورانِ خودتان ببینید</h2>
              <p className="body">هر چیزی که اینجا می‌خوانید، در دموی ۳۰ روزه در دسترسِ شماست.</p>
              <div className="row cta-row" style={{ justifyContent: 'center' }}>
                <Link href="/demo" className="btn btn--primary">
                  شروعِ دموی رایگان
                  <Icon name="arrowLeft" size={16} className="btn__arrow" />
                </Link>
                <Link href="/features" className="btn btn--ghost">فهرستِ امکانات</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
