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

  // ⚠️ رفع‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۴): نامِ رستوران‌های seed پیشوندِ [DEMO] گرفت —
  // فقط آدرس «[دمو]» داشت، ولی نام‌ها بدونِ برچسب بودند و چون slug دارند، در
  // اپ مشتری isLive حساب می‌شوند و هیچ چیپِ «نمونه» نمی‌گیرند — یعنی از
  // رستورانِ واقعی قابلِ‌تشخیص نبودند (قانونِ ۶ی CLAUDE.md؛ demo-seed.sql از
  // قبل درست بود).
  const data = [
    { slug: 'vista', name: '[DEMO] کافه‌رستوران ویستا', cuisine: 'ایتالیایی - فیوژن', vibes: ['رمانتیک', 'آروم'], prefix: 'VIS', cb: 8,
      loc: { city: 'تهران', district: 'زعفرانیه', address: '[دمو] تهران، زعفرانیه، خیابان نمونه، پلاک ۱', lat: 35.8100, lng: 51.4200 },
      menu: [['پاستا کربونارا', 185000, '🍝'], ['سالاد سزار', 85000, '🥗'], ['نوشیدنی ویژه', 45000, '🍷'], ['دسر شکلاتی', 65000, '🍮']] },
    { slug: 'geram', name: '[DEMO] گرام برگر', cuisine: 'برگر مدرن', vibes: ['کژوال', 'سریع', 'ارزون'], prefix: 'GRM', cb: 5,
      loc: { city: 'تهران', district: 'ونک', address: '[دمو] تهران، ونک، خیابان نمونه، پلاک ۲', lat: 35.7570, lng: 51.4100 },
      menu: [['کلاسیک برگر', 120000, '🍔'], ['اسپایسی برگر', 135000, '🌶'], ['سیب‌زمینی', 45000, '🍟']] },
    { slug: 'ava', name: '[DEMO] آوا روف‌تاپ', cuisine: 'فیوژن - روف‌تاپ', vibes: ['ویو', 'رمانتیک', 'لوکس'], prefix: 'AVA', cb: 15,
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
        smsBalance: 50,
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
      const visitCount = i < 4 ? 1 : i < 10 ? Math.floor(Math.random() * 3) + 2 : Math.floor(Math.random() * 4) + 5;
      for (let v = 0; v < visitCount; v++) {
        const daysAgo = Math.floor(Math.random() * 60); // در ۲ ماه گذشته
        // میز/ساعت به‌طورِ تصادفی انتخاب می‌شود، پس برخوردِ گاه‌به‌گاه با
        // رزروِ دیگری روی همان میز/بازه واقعاً رخ می‌دهد (constraintِ
        // no_table_overlap در ۰۲۶ درست همین را جلوگیری می‌کند) — به‌جایِ
        // شکستِ کلِ seed، چند بار با میز/ساعتِ تازه دوباره امتحان کن.
        for (let attempt = 0; attempt < 8; attempt++) {
          const start = new Date(); start.setDate(start.getDate() - daysAgo);
          start.setHours(18 + Math.floor(Math.random() * 4), [0, 30][Math.floor(Math.random() * 2)], 0, 0);
          const end = new Date(start); end.setHours(start.getHours() + 2);
          const table = rand(rest.tables);
          try {
            await db.reservation.create({
              data: {
                code: 'RZ' + Math.random().toString(36).slice(2, 8).toUpperCase(),
                restaurantId: rest.id, tableId: table.id, userId: user.id,
                partySize: Math.floor(Math.random() * 4) + 2,
                slotStart: start, slotEnd: end,
                status: daysAgo < 1 ? 'confirmed' : 'arrived',
                source: 'app',
              },
            });
            break;
          } catch (e: any) {
            const isOverlap = e?.code === 'P2010' || /23P01|exclusion constraint/i.test(String(e?.message));
            if (!isOverlap || attempt === 7) throw e;
          }
        }
      }
    }

    // ── چند رزرو امروز و فردا (برای صفحه‌ی رزروهای پنل) ──
    const todayUsers = await db.clubMember.findMany({ where: { restaurantId: rest.id }, take: 5, include: { user: true } });
    for (let i = 0; i < todayUsers.length; i++) {
      const isToday = i < 3;
      const start = new Date();
      if (!isToday) start.setDate(start.getDate() + 1);
      start.setHours(19 + i % 3, [0, 30][i % 2], 0, 0);
      const end = new Date(start); end.setHours(start.getHours() + 2);
      // ⚠️ رفعِ باگ (live-test ۲۰۲۶-۰۸-۱۲): این تخصیصِ میز/ساعت با میزِ
      // ثابتِ tables[i] بود، درحالی‌که حلقه‌ی بالا هم‌زمان می‌تواند رزروی
      // با daysAgo=0 (امروز) روی همان میز و بازه‌ی نزدیک بگذارد — همان
      // constraintِ no_table_overlap که چند خط بالاتر توضیح داده شده،
      // ولی اینجا try/catchِ متناظرش جا افتاده بود و کلِ seed را کرش
      // می‌کرد. حالا مثلِ حلقه‌ی بالا، با میزِ تصادفی و چند بار تلاش.
      for (let attempt = 0; attempt < 8; attempt++) {
        const table = attempt === 0 ? rest.tables[i] : rand(rest.tables);
        try {
          await db.reservation.create({
            data: {
              code: 'RZ' + Math.random().toString(36).slice(2, 8).toUpperCase(),
              restaurantId: rest.id, tableId: table.id, userId: todayUsers[i].userId,
              partySize: Math.floor(Math.random() * 4) + 2,
              slotStart: start, slotEnd: end,
              status: isToday && i === 0 ? 'arrived' : 'confirmed', source: 'app',
            },
          });
          break;
        } catch (e: any) {
          const isOverlap = e?.code === 'P2010' || /23P01|exclusion constraint/i.test(String(e?.message));
          if (!isOverlap || attempt === 7) throw e;
        }
      }
    }

    console.log(`✓ ${rest.name} — ${memberCount} عضو باشگاه + رزروها`);
  }

  console.log('\n✅ seed کامل شد. حالا endpointهای باشگاه و آنالیز داده دارند.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
