import { Icon } from './Icon';
import { Reveal } from './Motion';
import type { SiteFaq } from '@/lib/content-types';

// آکاردئون با <details>/<summary>: بدونِ جاوااسکریپت هم باز و بسته می‌شود،
// خزنده متنِ پاسخ‌ها را می‌بیند (نه محتوای پنهانِ JS-only)، و کیبورد/اسکرین‌ریدر
// رفتارِ بومیِ درست دارند.
export function FaqAccordion({ items }: { items: SiteFaq[] }) {
  if (!items.length) return null;
  return (
    <div className="faq-list">
      {items.map((faq, i) => (
        <Reveal key={faq.id} delay={i * 45}>
          <details className="faq-item">
            <summary>
              <span>{faq.question}</span>
              <Icon name="chevronDown" size={18} />
            </summary>
            <div className="faq-item__body">{faq.answer}</div>
          </details>
        </Reveal>
      ))}
    </div>
  );
}
