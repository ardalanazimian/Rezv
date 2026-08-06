import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

// نام‌های نمونه برای ساخت مشتری
const FIRST = ['کیان', 'نیلوفر', 'امیر', 'سارا', 'رضا', 'مریم', 'سامان', 'شیدا', 'علی', 'زهرا', 'محمد', 'فاطمه'];
const LAST = ['موسوی', 'رضایی', 'حسینی', 'احمدی', 'کاظمی', 'محمدی', 'عباسی', 'کریمی', 'ملکی', 'نوری'];
const TIERS = ['gold', 'silver', 'bronze'];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randCode(prefix: string, n: number): string { return `${prefix}-${1000 + n}`; }

async function main() {
  // ── tenant و staff (مدیر رستوران) ──
  const tenant = await db.tenant.create({ data: { name: 'گروه ویستا', plan: 'pro' } });
  await db.staff.create({ data: { tenantId: tenant.id, phone: '+989121111111', role: 'owner' } });

  // ── tenant پلتفرم (شرکت) + مدیر کل، برای ورود به پنل شرکت ──
  const platformTenant = await db.tenant.create({ data: { name: 'شرکت رزرونو', plan: 'pro' } });
  await db.staff.create({ data: { tenantId: platformTenant.id, phone: '+989120000000', role: 'owner' } });
  console.log('→ مدیر پلتفرم: +989120000000 (برای پنل شرکت)');
  console.log('→ tenant پلتفرم را در .env بگذار: PLATFORM_ADMIN_TENANT_ID=' + platformTenant.id);

  const data = [
    { slug: 'vista', name: 'کافه‌رستوران ویستا', cuisine: 'ایتالیایی - فیوژن', vibes: ['رمانتیک', 'آروم'], prefix: 'VIS', cb: 8,
      loc: { city: 'تهران', district: 'زعفرانیه', address: '[دمو] تهران، زعفرانیه، خیابان نمونه، پلاک ۱', lat: 35.8100, lng: 51.4200 },
      menu: [['پاستا کربونارا', 185000, '🍝'], ['سالاد سزار', 85000, '🥗'], ['نوشیدنی ویژه', 45000, '🍷'], ['دسر شکلاتی', 65000, '🍮']] },
    { slug: 'geram', name: 'گرام برگر', cuisine: 'برگر مدرن', vibes: ['کژوال', 'سریع', 'ارزون'], prefix: 'GRM', cb: 5,
      loc: { city: 'تهران', district: 'ونک', address: '[دمو] تهران، ونک، خیابان نمونه، پلاک ۲', lat: 35.7570, lng: 51.4100 },
      menu: [['کلاسیک برگر', 120000, '🍔'], ['اسپایسی برگر', 135000, '🌶'], ['سیب‌زمینی', 45000, '🍟']] },
    { slug: 'ava', name: 'آوا روف‌تاپ', cuisine: 'فیوژن - روف‌تاپ', vibes: ['ویو', 'رمانتیک', 'لوکس'], prefix: 'AVA', cb: 15,
      loc: { city: 'تهران', district: 'ولنجک', address: '[دمو] تهران، ولنجک، خیابان نمونه، پلاک ۳', lat: 35.8080, lng: 51.3980 },
      menu: [['استیک واگیو', 350000, '🥩'], ['شامپاین', 120000, '🍾'], ['کیک تولد', 95000, '🎂']] },
  ] as const;

  let userCounter = 0;

  for (const r of data) {
    const rest = await db.restaurant.create({
      data: {
        tenantId: tenant.id, slug: r.slug, name: r.name, cuisine: r.cuisine,
        vibes: [...r.vibes], clubPrefix: r.prefix, cbBasePct: r.cb,
        city: r.loc.city, district: r.loc.district, address: r.loc.address,
        latitude: r.loc.lat, longitude: r.loc.lng,
        tables: { create: Array.from({ length: 12 }, (_, i) => {
          const n = i + 1;
          const cap = i < 4 ? 2 : i < 9 ? 4 : i < 11 ? 6 : 8;
          // ناحیه‌بندی نمونه برای دمو: میزهای ابتدایی پنجره، میانی داخل، ۶نفره‌ها VIP، آخری فضای باز
          const zone = i < 3 ? 'window' : i < 9 ? 'indoor' : i < 11 ? 'vip' : 'outdoor';
          const shape = cap >= 6 ? 'booth' : i % 3 === 0 ? 'round' : 'rectangle';
          return {
            number: n,
            name: cap >= 8 ? 'میز شاه‌نشین' : null,
            capacity: cap,
            minPartySize: cap >= 6 ? 3 : 1,           // میز بزرگ برای گروه کوچک هدر نرود
            maxPartySize: cap,
            shape, zone,
            isVip: zone === 'vip',
            // میزهای ۲نفره‌ی مجاور قابل‌ترکیب‌اند (دموی merge): ۱↔۲، ۳↔۴
            isMergeable: i < 4,
            mergeableWith: i === 0 ? [2] : i === 1 ? [1, 3] : i === 2 ? [2, 4] : i === 3 ? [3] : [],
            priority: zone === 'vip' ? 10 : zone === 'window' ? 5 : 0, // VIP و پنجره ترجیح بیشتر
            maxDurationMinutes: zone === 'vip' ? 180 : 120,            // VIP مدت بیشتر
            qrCode: `T-DEMO${r.prefix}${String(n).padStart(2, '0')}`,   // کد QR دمو
            posX: (i % 4) * 100 + 50, posY: Math.floor(i / 4) * 100 + 50,
          };
        }) },
        menuItems: { create: r.menu.map(([name, price, emoji]) => ({ name, priceToman: price, emoji })) },
      },
      include: { tables: true },
    });

    // ── ساخت ۱۵ مشتری با عضویت باشگاه و رزرو، برای داده‌ی واقعی آنالیز ──
    const memberCount = r.slug === 'ava' ? 8 : 15; // آوا کمتر (جدیدتر)
    // هر (میز، روز) فقط یک رزرو — در سطح رستوران مشترک است تا constraint رد نکند
    const usedDayTable = new Set<string>();
    for (let i = 0; i < memberCount; i++) {
      userCounter++;
      const phone = `+98912${String(1000000 + userCounter).slice(-7)}`;
      const birthMonth = Math.floor(Math.random() * 12); // 0-11
      const birthDate = new Date(1995, birthMonth, Math.floor(Math.random() * 28) + 1);

      const user = await db.user.upsert({
        where: { phone },
        create: { phone, firstName: rand([...FIRST]), lastName: rand([...LAST]), birthDate },
        update: {},
      });

      // عضویت باشگاه
      await db.clubMember.upsert({
        where: { restaurantId_userId: { restaurantId: rest.id, userId: user.id } },
        create: {
          restaurantId: rest.id, userId: user.id,
          code: randCode(r.prefix, userCounter), tier: rand([...TIERS]),
          points: Math.floor(Math.random() * 2000),
        },
        update: {},
      });

      // ── رزروها: تعداد متغیر تا آنالیز رفتار معنادار شود ──
      // بعضی ۱ بار، بعضی چند بار، بعضی وفادار
      // ⚠️ از تکرارِ (میز، تاریخ) اجتناب می‌شود تا constraint «no_table_overlap»
      //    رد نکند — هر میز در هر روز فقط یک اسلات ۲ساعته می‌گیرد.
      const visitCount = i < 4 ? 1 : i < 10 ? Math.floor(Math.random() * 3) + 2 : Math.floor(Math.random() * 4) + 5;
      let v = 0;
      while (v < visitCount) {
        const daysAgo = Math.floor(Math.random() * 60); // در ۲ ماه گذشته
        const start = new Date(); start.setDate(start.getDate() - daysAgo);
        start.setHours(18 + Math.floor(Math.random() * 4), [0, 30][Math.floor(Math.random() * 2)], 0, 0);
        const end = new Date(start); end.setHours(start.getHours() + 2);
        const table = rand(rest.tables);
        const key = start.toISOString().slice(0, 10) + ':' + table.id;
        if (usedDayTable.has(key)) continue; // این میز در این روز پر است — جای دیگری امتحان کن
        usedDayTable.add(key);
        await db.reservation.create({
          data: {
            code: 'RZ' + Math.random().toString(36).slice(2, 8).toUpperCase(),
            restaurantId: rest.id, tableId: table.id, userId: user.id,
            partySize: Math.floor(Math.random() * 4) + 2,
            slotStart: start, slotEnd: end,
            status: daysAgo < 1 ? 'confirmed' : 'arrived', source: 'app',
          },
        });
        v++;
      }
    }

    // ── همگام‌سازیِ شمارنده‌ی کدِ باشگاه با بیشترینِ کدِ ساخته‌شده ──
    // ⚠️ بدونِ این، createWalkin/createReservation از nextValue پیش‌فرضِ ۱۰۰۲ شروع
    //    می‌کردند و با کدِ seeded (مثلاً VIS-1001) در constraintِ
    //    «club_members(restaurant_id, code)» تداخل می‌کردند و ۵۰۰ می‌دادند.
    const maxClub = await db.clubMember.findFirst({
      where: { restaurantId: rest.id },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    if (maxClub) {
      const maxNum = parseInt(maxClub.code.split('-')[1] ?? '0', 10);
      await db.clubCodeCounter.upsert({
        where: { restaurantId: rest.id },
        create: { restaurantId: rest.id, nextValue: maxNum + 1 },
        update: { nextValue: maxNum + 1 },
      });
    }

    // ── چند رزرو امروز و فردا (برای صفحه‌ی رزروهای پنل) ──
    const todayUsers = await db.clubMember.findMany({ where: { restaurantId: rest.id }, take: 5, include: { user: true } });
    // هر رزرو امروز/فردا روی میزِ متفاوت تا تداخلِ constraint رخ ندهد
    for (let i = 0; i < todayUsers.length; i++) {
      const isToday = i < 3;
      const start = new Date();
      if (!isToday) start.setDate(start.getDate() + 1);
      start.setHours(19 + i % 3, [0, 30][i % 2], 0, 0);
      const end = new Date(start); end.setHours(start.getHours() + 2);
      let table = rest.tables[i];
      let tk = start.toISOString().slice(0, 10) + ':' + table.id;
      if (usedDayTable.has(tk)) {
        table = rest.tables.find((t) => !usedDayTable.has(start.toISOString().slice(0, 10) + ':' + t.id)) ?? table;
        tk = start.toISOString().slice(0, 10) + ':' + table.id;
      }
      usedDayTable.add(tk);
      await db.reservation.create({
        data: {
          code: 'RZ' + Math.random().toString(36).slice(2, 8).toUpperCase(),
          restaurantId: rest.id, tableId: table.id, userId: todayUsers[i].userId,
          partySize: Math.floor(Math.random() * 4) + 2,
          slotStart: start, slotEnd: end,
          status: isToday && i === 0 ? 'arrived' : 'confirmed', source: 'app',
        },
      });
    }

    console.log(`✓ ${rest.name} — ${memberCount} عضو باشگاه + رزروها`);
  }

  console.log('\n✅ seed کامل شد. حالا endpointهای باشگاه و آنالیز داده دارند.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
