import type { MetadataRoute } from 'next';

const SITE = 'https://rezervno.ir';

// robots.txt اپِ SEO: خزیدنِ صفحاتِ عمومی مجاز؛ اشاره به sitemap پویا.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
