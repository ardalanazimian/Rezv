// ═══════════════════════════════════════════════════════════════════════
//  رندرِ Markdownِ محدود و امن (بدونِ وابستگیِ خارجی)
//
//  چرا خودمان: بدنه‌ی مقاله از CMS می‌آید. حتی وقتی نویسنده مدیرِ خودمان است،
//  محتوای دیتابیس نباید بتواند اسکریپت اجرا کند. بنابراین اول همه‌چیز escape
//  می‌شود و بعد فقط زیرمجموعه‌ی مشخصی از نشانه‌گذاری به HTML تبدیل می‌گردد —
//  یعنی HTMLِ خامِ داخلِ متن هرگز اجرا نمی‌شود (allow-list، نه sanitize).
//
//  پشتیبانی: ## / ###، **پررنگ**، *مورب*، `کد`، فهرستِ نقطه‌ای و عددی،
//  نقلِ‌قول، خطِ جداکننده، لینک، پاراگراف.
// ═══════════════════════════════════════════════════════════════════════

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** فقط http(s) و مسیرِ داخلی. javascript:/data: به «#» تبدیل می‌شوند. */
function safeHref(raw: string): string {
  const href = raw.trim();
  if (/^https?:\/\//i.test(href) || href.startsWith('/') || href.startsWith('#')) return href;
  return '#';
}

/** نشانه‌گذاریِ درون‌خطی روی متنِ از قبل escape‌شده. */
function inline(escaped: string): string {
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) => {
      const url = safeHref(href);
      const external = /^https?:\/\//i.test(url);
      const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${url}"${attrs}>${text}</a>`;
    });
}

/**
 * Markdown → HTMLِ امن. خروجی برای dangerouslySetInnerHTML آماده است چون
 * تنها منبعِ تگ‌ها همین تابع است (نه ورودیِ کاربر).
 */
export function renderMarkdown(md: string): string {
  const lines = escapeHtml(md.replace(/\r\n/g, '\n')).split('\n');
  const out: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let paragraph: string[] = [];
  let quote: string[] = [];

  const closeList = () => {
    if (listType) { out.push(`</${listType}>`); listType = null; }
  };
  const closeParagraph = () => {
    if (paragraph.length) { out.push(`<p>${inline(paragraph.join(' '))}</p>`); paragraph = []; }
  };
  const closeQuote = () => {
    if (quote.length) { out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`); quote = []; }
  };
  const closeAll = () => { closeParagraph(); closeList(); closeQuote(); };

  for (const line of lines) {
    const t = line.trim();

    if (!t) { closeAll(); continue; }

    if (t === '---' || t === '***') { closeAll(); out.push('<hr />'); continue; }

    const heading = /^(#{2,4})\s+(.*)$/.exec(t);
    if (heading) {
      closeAll();
      const level = Math.min(heading[1].length, 4);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(t);
    if (bullet) {
      closeParagraph(); closeQuote();
      if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }

    const ordered = /^\d+[.)]\s+(.*)$/.exec(t);
    if (ordered) {
      closeParagraph(); closeQuote();
      if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; }
      out.push(`<li>${inline(ordered[1])}</li>`);
      continue;
    }

    const quoted = /^&gt;\s?(.*)$/.exec(t);
    if (quoted) {
      closeParagraph(); closeList();
      quote.push(quoted[1]);
      continue;
    }

    closeList(); closeQuote();
    paragraph.push(t);
  }

  closeAll();
  return out.join('\n');
}

/** متنِ ساده از Markdown — برای توضیحاتِ متا و پیش‌نمایش (بدونِ هیچ تگی). */
export function markdownToText(md: string, maxLen = 300): string {
  const text = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*`_]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLen ? `${text.slice(0, maxLen - 1).trimEnd()}…` : text;
}
