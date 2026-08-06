// جایگزینِ next/link در پیش‌نمایشِ آفلاین.
//
// next/link به روترِ Next وابسته است و بیرون از اپ کار نمی‌کند. اینجا یک
// <a> ساده می‌سازیم؛ روترِ کوچکِ پیش‌نمایش خودش کلیکِ لینک‌های داخلی را
// می‌گیرد و صفحه را عوض می‌کند (همان کاری که next/link می‌کرد).
import type { AnchorHTMLAttributes, ReactNode } from 'react';

interface Props extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children?: ReactNode;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
}

export default function Link({ href, children, prefetch, replace, scroll, ...rest }: Props) {
  void prefetch;
  void replace;
  void scroll;
  return <a href={href} {...rest}>{children}</a>;
}
