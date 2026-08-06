import Link from 'next/link';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/site/JsonLd';
import { Icon } from '@/components/site/Icon';
import { Reveal } from '@/components/site/Motion';
import { getArticles } from '@/lib/site-api';
import { buildMetadata } from '@/lib/seo';
import { SITE } from '@/lib/i18n';
import { graph, webPageJsonLd, breadcrumbJsonLd, blogJsonLd } from '@/lib/site-schema';
import { faDate, fa } from '@/lib/format';

export const revalidate = 300;

export const metadata: Metadata = buildMetadata({
  title: 'بلاگ رزرونو | آموزش مدیریت و رشد رستوران',
  description:
    'مقاله‌های کاربردی درباره‌ی مدیریتِ رزرو، کاهشِ نیامدنِ مهمان، باشگاهِ مشتریان، مدیریتِ ظرفیت و رشدِ رستوران.',
  path: '/blog',
  keywords: ['بلاگ رستوران', 'مدیریت رستوران', 'آموزش رزرو رستوران'],
});

function ArticleCard({
  slug, title, excerpt, tags, readingMinutes, publishedAt, featured,
}: {
  slug: string; title: string; excerpt: string; tags: string[];
  readingMinutes: number; publishedAt: string | null; featured?: boolean;
}) {
  return (
    <article className="article-card">
      {featured && <span className="badge badge--brand" style={{ alignSelf: 'flex-start' }}>ویژه</span>}
      <h3 className="article-card__title">
        <Link href={`/blog/${encodeURIComponent(slug)}`}>{title}</Link>
      </h3>
      <p className="body small">{excerpt}</p>
      {tags.length > 0 && (
        <div className="article-card__tags">
          {tags.slice(0, 3).map((t) => <span key={t} className="badge">{t}</span>)}
        </div>
      )}
      <div className="article-card__meta">
        {publishedAt && <span>{faDate(publishedAt)}</span>}
        <span>{fa(readingMinutes)} دقیقه مطالعه</span>
      </div>
    </article>
  );
}

export default async function BlogPage() {
  const articles = await getArticles();
  const pageUrl = `${SITE}/blog`;
  const [lead, ...rest] = articles;

  return (
    <>
      <JsonLd
        data={graph([
          webPageJsonLd({ name: 'بلاگ رزرونو', description: metadata.description as string, pageUrl }),
          breadcrumbJsonLd([{ name: 'بلاگ', path: '/blog' }]),
          blogJsonLd(articles, pageUrl),
        ])}
        id="page-blog"
      />

      <section className="hero hero--compact hero--center">
        <div className="grid-bg" aria-hidden="true" />
        <div className="container hero__inner">
          <div className="hero__content">
            <Reveal><span className="eyebrow"><Icon name="list" size={14} />بلاگ</span></Reveal>
            <Reveal delay={60}>
              <h1 className="display">
                یادداشت‌هایی درباره‌ی{' '}
                <span className="text-gradient">اداره‌ی رستوران.</span>
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="lead" style={{ maxWidth: '44ch' }}>
                نکته‌های عملی از دلِ کارِ روزمره‌ی رستوران‌ها — نه تئوریِ عمومیِ مدیریت.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section section--tight">
        <div className="container">
          {articles.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state__icon"><Icon name="list" size={22} /></span>
              <p className="body">هنوز مقاله‌ای منتشر نشده است. به‌زودی برمی‌گردیم.</p>
              <Link href="/product" className="btn btn--ghost btn--sm">در این فاصله، محصول را ببینید</Link>
            </div>
          ) : (
            <div className="stack stack-8">
              {/* مقاله‌ی نخست کمی بزرگ‌تر — سلسله‌مراتبِ بصریِ فهرست */}
              <Reveal>
                <article className="card card--pad-lg card--hover stack stack-4">
                  <span className="eyebrow" style={{ alignSelf: 'flex-start' }}>تازه‌ترین</span>
                  <h2 className="h2">
                    <Link href={`/blog/${encodeURIComponent(lead.slug)}`}>{lead.title}</Link>
                  </h2>
                  <p className="lead">{lead.excerpt}</p>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="article-card__meta" style={{ marginTop: 0 }}>
                      {lead.published_at && <span>{faDate(lead.published_at)}</span>}
                      <span>{fa(lead.reading_minutes)} دقیقه مطالعه</span>
                    </span>
                    <Link href={`/blog/${encodeURIComponent(lead.slug)}`} className="btn btn--ghost btn--sm">
                      خواندنِ مقاله
                      <Icon name="arrowLeft" size={15} className="btn__arrow" />
                    </Link>
                  </div>
                </article>
              </Reveal>

              {rest.length > 0 && (
                <div className="grid grid-3">
                  {rest.map((a, i) => (
                    <Reveal key={a.slug} delay={(i % 3) * 80}>
                      <ArticleCard
                        slug={a.slug} title={a.title} excerpt={a.excerpt} tags={a.tags}
                        readingMinutes={a.reading_minutes} publishedAt={a.published_at} featured={a.featured}
                      />
                    </Reveal>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal>
            <div className="cta-band">
              <h2 className="h2" style={{ marginBottom: 'var(--sp-4)' }}>از خواندن تا انجام‌دادن</h2>
              <p className="lead" style={{ maxWidth: '42ch', marginInline: 'auto', marginBottom: 'var(--sp-8)' }}>
                بیشترِ چیزهایی که در این مقاله‌ها می‌خوانید، در پنلِ رزرونو با چند تنظیم عملی می‌شوند.
              </p>
              <div className="row cta-row" style={{ justifyContent: 'center' }}>
                <Link href="/demo" className="btn btn--primary btn--lg">
                  شروعِ دموی ۳۰ روزه
                  <Icon name="arrowLeft" size={18} className="btn__arrow" />
                </Link>
                <Link href="/features" className="btn btn--ghost btn--lg">دیدنِ امکانات</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
