import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/site/JsonLd';
import { Icon } from '@/components/site/Icon';
import { Reveal } from '@/components/site/Motion';
import { getArticle, getArticles } from '@/lib/site-api';
import { buildMetadata } from '@/lib/seo';
import { SITE } from '@/lib/i18n';
import { graph, breadcrumbJsonLd, articleJsonLd } from '@/lib/site-schema';
import { renderMarkdown, markdownToText } from '@/lib/markdown';
import { faDate, fa } from '@/lib/format';

export const revalidate = 300;
// اسلاگی که در زمانِ build نبوده هم باید کار کند (مقاله‌ی تازه در استودیو).
export const dynamicParams = true;

export async function generateStaticParams() {
  const articles = await getArticles({ limit: 50 });
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return buildMetadata({ title: 'مقاله پیدا نشد', description: 'این مقاله در دسترس نیست.', path: `/blog/${slug}`, noindex: true });

  return buildMetadata({
    title: article.seo.title || article.title,
    description: article.seo.description || article.excerpt,
    path: `/blog/${encodeURIComponent(article.slug)}`,
    keywords: article.seo.keywords.length ? article.seo.keywords : article.tags,
    image: article.seo.og_image || article.cover_url || null,
    noindex: article.seo.noindex,
    type: 'article',
    publishedTime: article.published_at,
    modifiedTime: article.updated_at ?? article.published_at,
    tags: article.tags,
  });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  // لینک‌سازیِ داخلی: مقاله‌های هم‌برچسب، وگرنه تازه‌ترین‌ها.
  const all = await getArticles({ limit: 12 });
  const related = all
    .filter((a) => a.slug !== article.slug)
    .sort((a, b) => {
      const shareA = a.tags.filter((t) => article.tags.includes(t)).length;
      const shareB = b.tags.filter((t) => article.tags.includes(t)).length;
      return shareB - shareA;
    })
    .slice(0, 3);

  const pageUrl = `${SITE}/blog/${encodeURIComponent(article.slug)}`;

  return (
    <>
      <JsonLd
        data={graph([
          articleJsonLd(article, pageUrl),
          breadcrumbJsonLd([
            { name: 'بلاگ', path: '/blog' },
            { name: article.title, path: `/blog/${encodeURIComponent(article.slug)}` },
          ]),
        ])}
        id="page-article"
      />

      <article className="section section--tight">
        <div className="container-narrow article-hero">
          <Reveal>
            <nav aria-label="مسیر" className="row small muted" style={{ gap: 'var(--sp-2)' }}>
              <Link href="/blog">بلاگ</Link>
              <Icon name="chevronDown" size={13} style={{ transform: 'rotate(90deg)' }} />
              <span>{article.tags[0] ?? 'مقاله'}</span>
            </nav>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="h1">{article.title}</h1>
          </Reveal>

          <Reveal delay={100}>
            <p className="lead">{article.excerpt}</p>
          </Reveal>

          <Reveal delay={140}>
            <div className="article-meta">
              <span className="row" style={{ gap: 'var(--sp-2)' }}>
                <Icon name="user" size={15} />
                {article.author_name}
                {article.author_role && ` — ${article.author_role}`}
              </span>
              {article.published_at && (
                <span className="row" style={{ gap: 'var(--sp-2)' }}>
                  <Icon name="calendar" size={15} />
                  <time dateTime={article.published_at}>{faDate(article.published_at)}</time>
                </span>
              )}
              <span className="row" style={{ gap: 'var(--sp-2)' }}>
                <Icon name="clock" size={15} />
                {fa(article.reading_minutes)} دقیقه مطالعه
              </span>
            </div>
          </Reveal>

          <hr className="divider" />

          <Reveal delay={80}>
            <div className="prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }} />
          </Reveal>

          {article.tags.length > 0 && (
            <Reveal>
              <div className="row" style={{ marginTop: 'var(--sp-8)' }}>
                {article.tags.map((t) => <span key={t} className="badge">{t}</span>)}
              </div>
            </Reveal>
          )}
        </div>
      </article>

      <section className="section section--tight">
        <div className="container-narrow">
          <Reveal>
            <div className="card card--pad-lg stack stack-4" style={{ textAlign: 'center' }}>
              <h2 className="h3">{markdownToText(article.title, 80)} — در عمل</h2>
              <p className="body">
                رزرونو همین کارها را برای رستوران‌ها ساده می‌کند. ۳۰ روز رایگان امتحان کنید.
              </p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <Link href="/demo" className="btn btn--primary">
                  شروعِ دموی رایگان
                  <Icon name="arrowLeft" size={16} className="btn__arrow" />
                </Link>
                <Link href="/features" className="btn btn--ghost">دیدنِ امکانات</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section section--subtle section--edge">
          <div className="container">
            <div className="section-head">
              <h2 className="h3">خواندنِ بعدی</h2>
            </div>
            <div className="grid grid-3">
              {related.map((a, i) => (
                <Reveal key={a.slug} delay={i * 80}>
                  <article className="article-card">
                    <h3 className="article-card__title">
                      <Link href={`/blog/${encodeURIComponent(a.slug)}`}>{a.title}</Link>
                    </h3>
                    <p className="body small">{a.excerpt}</p>
                    <div className="article-card__meta">
                      {a.published_at && <span>{faDate(a.published_at)}</span>}
                      <span>{fa(a.reading_minutes)} دقیقه</span>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
