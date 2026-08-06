'use client';

// زبانه‌های «داخلِ پنل». الگوی tab/tabpanel با پیمایشِ کیبورد (فلش/Home/End)
// طبق WAI-ARIA — چون این تنها بخشِ صفحه است که محتوا را عوض می‌کند.

import { useRef, useState } from 'react';
import { Icon } from '../site/Icon';

export interface ShowcaseTabItem {
  key: string;
  label: string;
  title: string;
  body: string;
  items: string[];
}

export function ShowcaseTabs({ tabs }: { tabs: ShowcaseTabItem[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    setActive(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // راست‌چین: فلشِ چپ یعنی «بعدی»
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); focusTab(active + 1); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); focusTab(active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusTab(0); }
    else if (e.key === 'End') { e.preventDefault(); focusTab(tabs.length - 1); }
  };

  const current = tabs[active];

  return (
    <div className="showcase">
      <div className="showcase__tabs" role="tablist" aria-orientation="vertical" onKeyDown={onKeyDown}>
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={`showcase-tab-${tab.key}`}
            aria-selected={i === active}
            aria-controls={`showcase-panel-${tab.key}`}
            tabIndex={i === active ? 0 : -1}
            className="showcase__tab"
            onClick={() => setActive(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`showcase-panel-${current.key}`}
        aria-labelledby={`showcase-tab-${current.key}`}
        className="showcase__panel"
        // کلید باعث می‌شود انیمیشنِ ورود در هر تعویض دوباره اجرا شود
        key={current.key}
        tabIndex={0}
      >
        <h3 className="h3">{current.title}</h3>
        {current.body && <p className="body">{current.body}</p>}
        {current.items.length > 0 && (
          <ul className="showcase__list">
            {current.items.map((item) => (
              <li key={item}><Icon name="check" size={17} />{item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
