// جایگزینِ next/navigation در پیش‌نمایشِ آفلاین.
//
// هدر برای «صفحه‌ی فعال» به usePathname تکیه دارد. در پیش‌نمایش، مسیر در
// هشِ آدرس نگه داشته می‌شود (#/pricing)، پس همان را برمی‌گردانیم و با
// hashchange دوباره رندر می‌کنیم تا نشانه‌ی صفحه‌ی فعال درست جابه‌جا شود.
import { useEffect, useState } from 'react';

const read = () => (typeof location === 'undefined' ? '/' : location.hash.slice(1) || '/');

export function usePathname(): string {
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => setPath(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path;
}

export function useRouter() {
  return {
    push: (href: string) => { location.hash = href; },
    replace: (href: string) => { location.hash = href; },
    back: () => history.back(),
    forward: () => history.forward(),
    refresh: () => {},
    prefetch: () => {},
  };
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams(): Record<string, string> {
  return {};
}
