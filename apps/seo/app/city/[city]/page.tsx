import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchRestaurantList } from '@/lib/api';
import Listing from '@/components/Listing';
import { alternates } from '@/lib/i18n';

export const revalidate = 300;

const SITE = 'https://rezervno.ir';
// گاردِ کیفیت: صفحه‌ی مکان با کمتر از این تعداد رستوران ساخته نمی‌شود (ضدِّ thin content).
const MIN_LISTINGS = 1;

function decode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city: rawCity } = await params;
  const city = decode(rawCity);
  const url = `${SITE}/city/${encodeURIComponent(city)}`;
  return {
    title: `بهترین رستوران‌های ${city}`,
    description: `کشف و رزرو آنلاین میز در بهترین رستوران‌های ${city} — منو، امتیاز و قیمت.`,
    alternates: alternates(`/city/${encodeURIComponent(city)}`),
    openGraph: { type: 'website', title: `رستوران‌های ${city}`, url },
  };
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: rawCity } = await params;
  const city = decode(rawCity);
  // strict=true: یک قطعیِ API نباید به «شهرِ بی‌رستوران» و در نتیجه ۴۰۴ِ
  // کش‌شده ترجمه شود (ضدِّ ایندکس). نبودِ واقعی همچنان ۴۰۴ می‌دهد.
  const items = await fetchRestaurantList({ city }, 300, true);
  if (items.length < MIN_LISTINGS) notFound();

  return (
    <Listing
      title={`بهترین رستوران‌های ${city}`}
      description={`${items.length} رستوران در ${city} برای رزرو آنلاین.`}
      pageUrl={`${SITE}/city/${encodeURIComponent(city)}`}
      items={items}
      crumbCity={city}
    />
  );
}
