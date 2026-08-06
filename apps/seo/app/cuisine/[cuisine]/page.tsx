import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchRestaurantList } from '@/lib/api';
import Listing from '@/components/Listing';
import { alternates } from '@/lib/i18n';

export const revalidate = 300;

const SITE = 'https://rezervno.ir';
const MIN_LISTINGS = 1; // گاردِ کیفیت (ضدِّ thin content)

function decode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

export async function generateMetadata({ params }: { params: Promise<{ cuisine: string }> }): Promise<Metadata> {
  const { cuisine: rawCuisine } = await params;
  const cuisine = decode(rawCuisine);
  const url = `${SITE}/cuisine/${encodeURIComponent(cuisine)}`;
  return {
    title: `رستوران‌های ${cuisine}`,
    description: `کشف و رزرو آنلاین بهترین رستوران‌های ${cuisine} — منو، امتیاز و قیمت.`,
    alternates: alternates(`/cuisine/${encodeURIComponent(cuisine)}`),
    openGraph: { type: 'website', title: `رستوران‌های ${cuisine}`, url },
  };
}

export default async function CuisinePage({ params }: { params: Promise<{ cuisine: string }> }) {
  const { cuisine: rawCuisine } = await params;
  const cuisine = decode(rawCuisine);
  const items = await fetchRestaurantList({ cuisine });
  if (items.length < MIN_LISTINGS) notFound();

  return (
    <Listing
      title={`رستوران‌های ${cuisine}`}
      description={`${items.length} رستوران با آشپزیِ ${cuisine} برای رزرو آنلاین.`}
      pageUrl={`${SITE}/cuisine/${encodeURIComponent(cuisine)}`}
      items={items}
    />
  );
}
