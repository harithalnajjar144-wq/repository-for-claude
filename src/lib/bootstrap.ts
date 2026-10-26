/**
 * Database setup shared by the seed script and server start-up:
 * migrations, subscription plans, the admin account and optional demo data.
 */
import path from "node:path";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "@/db";
import {
  ads,
  auctionDeposits,
  auctions,
  bids,
  listings,
  plans,
  products,
  providers,
  users,
  vetServices,
  walletTransactions,
} from "@/db/schema";

export async function runMigrations() {
  await migrate(db, { migrationsFolder: path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle") });
}

const H = 3600_000;
const D = 24 * H;

async function upsertUser(v: typeof users.$inferInsert) {
  const [existing] = await db.select().from(users).where(eq(users.phone, v.phone));
  if (existing) return existing;
  const [u] = await db.insert(users).values(v).returning();
  return u;
}

async function credit(userId: number, amount: number, note: string) {
  const [u] = await db.update(users).set({ walletBalance: sql`${users.walletBalance} + ${amount}` }).where(eq(users.id, userId)).returning();
  await db.insert(walletTransactions).values({ userId, type: "topup", amount, balanceAfter: u.walletBalance, note });
}

/** Plans always; admin only when a phone and password are given. Safe to run on every start. */
export async function ensureBaseData(admin?: { phone: string; password: string }) {

  // ---- Plans ----
  const planRows: (typeof plans.$inferInsert)[] = [
    { slug: "trader-basic", name: "تاجر أساسي", role: "trader", priceMonthly: 15000, maxActiveListings: 15, maxActiveAuctions: 3, features: ["إعلان مميز واحد شهرياً", "شارة تاجر"], sortOrder: 1 },
    { slug: "trader-pro", name: "تاجر محترف", role: "trader", priceMonthly: 35000, maxActiveListings: 60, maxActiveAuctions: 10, features: ["أولوية في نتائج البحث", "إحصائيات المشاهدات", "دعم مباشر"], sortOrder: 2 },
    { slug: "trader-farm", name: "مزرعة / شركة", role: "trader", priceMonthly: 75000, maxActiveListings: null, maxActiveAuctions: null, features: ["إعلانات ومزادات غير محدودة", "صفحة مزرعة مخصصة", "مدير حساب"], sortOrder: 3 },
    { slug: "vet-clinic", name: "عيادة بيطرية", role: "vet", priceMonthly: 25000, maxActiveListings: 5, maxActiveAuctions: 0, features: ["ظهور في دليل الأطباء", "استقبال الحجوزات أونلاين", "شارة طبيب موثق"], sortOrder: 1 },
    { slug: "shop-store", name: "متجر رعاية", role: "shop", priceMonthly: 20000, maxActiveListings: 5, maxActiveAuctions: 0, features: ["عرض منتجات غير محدود", "استقبال الطلبات", "خيار التوصيل"], sortOrder: 1 },
  ];
  for (const p of planRows) await db.insert(plans).values(p).onConflictDoNothing({ target: plans.slug });

  if (!admin) return;
  const [existingAdmin] = await db.select().from(users).where(eq(users.phone, admin.phone));
  if (existingAdmin) return;
  await db.insert(users).values({
    name: "إدارة حلالي",
    phone: admin.phone,
    whatsapp: admin.phone,
    passwordHash: await bcrypt.hash(admin.password, 10),
    role: "admin",
    city: "anbar",
    verificationStatus: "verified",
  });
  console.log(`[halali] admin account created for ${admin.phone}`);
}

/** Sample traders, listings, auctions, vets and shops. Skipped if any listing exists. */
export async function seedDemoData() {

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(listings);
  if (n > 0) {
    console.log("Demo data already present, skipping.");
    return;
  }

  const pw = await bcrypt.hash("demo12345", 10);
  const mk = (name: string, phone: string, role: "user" | "trader" | "vet" | "shop", city: string, verified = true, bio?: string) =>
    upsertUser({ name, phone, whatsapp: phone, passwordHash: pw, role, city, bio, verificationStatus: verified ? "verified" : "none" });

  const t1 = await mk("أبو أحمد الدليمي", "07801112233", "trader", "anbar", true, "مربي أغنام عواسي في الرمادي منذ 20 سنة.");
  const t2 = await mk("حاج كريم الجبوري", "07702223344", "trader", "salahaddin", true, "تجارة عجول وأبقار حلوب.");
  const t3 = await mk("مزرعة الفرات للخيول", "07813334455", "trader", "babil", true, "خيول عربية أصيلة بنسب موثق.");
  const t4 = await mk("سيف العبيدي", "07724445566", "trader", "baghdad", false);
  const t5 = await mk("علي الكناني - صقور", "07505556677", "trader", "basra", true, "صقور ومستلزمات الصيد.");
  const u1 = await mk("مصطفى حسن", "07706667788", "user", "baghdad", true);
  const u2 = await mk("عمر الفهداوي", "07817778899", "user", "anbar", true);
  const u3 = await mk("حسين الموسوي", "07738889900", "user", "najaf", false);
  const vet1 = await mk("د. ليث الراوي", "07809990011", "vet", "anbar", true);
  const vet2 = await mk("د. زينب العزاوي", "07701110022", "vet", "baghdad", true);
  const vet3 = await mk("د. حيدر الساعدي", "07502220033", "vet", "basra", false);
  const shop1 = await mk("محلات الخير للأعلاف", "07813330044", "shop", "anbar", true);
  const shop2 = await mk("بيت الحيوانات الأليفة", "07704440055", "shop", "baghdad", true);

  for (const u of [u1, u2, t1, t2, t3, t5]) await credit(u.id, 1_000_000, "رصيد تجريبي");

  // ---- Listings ----
  const now = Date.now();
  const L = (userId: number, v: Partial<typeof listings.$inferInsert> & Pick<typeof listings.$inferInsert, "title" | "category" | "city">, ageDays = 1): typeof listings.$inferInsert => ({
    userId,
    description: "الحيوانات بصحة ممتازة ومطعمة، التربية في مزرعة مفتوحة، أهلاً بالمعاينة في أي وقت. السعر قابل للتفاوض البسيط للجادين فقط.",
    createdAt: new Date(now - ageDays * D),
    ...v,
  });
  await db.insert(listings).values([
    L(t1.id, { title: "15 نعجة عواسي حوامل بعمر سنتين", category: "sheep", breed: "عواسي", price: 6_750_000, quantity: 15, ageMonths: 24, gender: "female", weightKg: 55, city: "anbar", area: "الرمادي", featuredUntil: new Date(now + 5 * D), views: 412 }, 0.2),
    L(t1.id, { title: "كبش عواسي فحل للتلقيح", category: "sheep", breed: "عواسي", price: 1_200_000, ageMonths: 30, gender: "male", weightKg: 95, city: "anbar", area: "هيت", views: 230 }, 1),
    L(t2.id, { title: "عجول هولشتاين للتسمين - 6 رؤوس", category: "cattle", breed: "هولشتاين", price: 13_800_000, quantity: 6, ageMonths: 8, gender: "male", weightKg: 220, city: "salahaddin", area: "تكريت", featuredUntil: new Date(now + 2 * D), views: 301 }, 0.5),
    L(t2.id, { title: "بقرة حلوب تنتج 25 لتر يومياً", category: "cattle", breed: "فريزيان", price: 3_500_000, ageMonths: 48, gender: "female", city: "salahaddin", views: 188 }, 2),
    L(t4.id, { title: "ماعز شامي أصيل - ذكر وأنثيين", category: "goats", breed: "شامي", price: 2_100_000, quantity: 3, ageMonths: 14, gender: "mixed", city: "baghdad", area: "أبو غريب", views: 95 }, 3),
    L(t3.id, { title: "مهرة عربية أصيلة بعمر سنتين", category: "horses", breed: "عربي أصيل", price: null, ageMonths: 24, gender: "female", city: "babil", area: "الحلة", views: 520 }, 1.5),
    L(t5.id, { title: "صقر حر قرناس مدرب", category: "falcons", breed: "حر", price: 4_500_000, ageMonths: 20, gender: "female", city: "basra", views: 344 }, 0.8),
    L(t4.id, { title: "دجاج بياض - 200 دجاجة بعمر 5 أشهر", category: "poultry", breed: "لوهمان", price: 1_600_000, quantity: 200, ageMonths: 5, gender: "female", city: "baghdad", views: 77 }, 4),
    L(t1.id, { title: "حمام زاجل بلجيكي - 10 أزواج", category: "pigeons", breed: "زاجل", price: 750_000, quantity: 20, city: "anbar", views: 64 }, 5),
    L(u3.id, { title: "مطلوب: 20 خروف كرادي للعيد", type: "wanted", category: "sheep", breed: "كرادي", price: 9_000_000, quantity: 20, city: "najaf", description: "أبحث عن 20 خروف كرادي بوزن 40-50 كغم، التسليم في النجف قبل العيد. يرجى التواصل مع صور وأسعار." }, 0.3),
    L(t2.id, { title: "إبل مجاهيم - ناقتان مع حوار", category: "camels", breed: "مجاهيم", price: 12_000_000, quantity: 3, gender: "mixed", city: "muthanna", views: 140 }, 6),
    L(t4.id, { title: "قطط شيرازي بعمر 3 أشهر", category: "pets", breed: "شيرازي", price: 150_000, quantity: 2, ageMonths: 3, city: "baghdad", views: 210 }, 2.5),
    L(t2.id, { title: "جاموس عراقي حلوب", category: "buffalo", price: 4_200_000, gender: "female", ageMonths: 60, city: "maysan", views: 58 }, 7),
    L(t1.id, { title: "طليان عواسي للتسمين - 30 رأس", category: "sheep", breed: "عواسي", price: 9_600_000, quantity: 30, ageMonths: 6, gender: "male", weightKg: 32, city: "anbar", views: 150 }, 2),
  ]);

  // ---- Auctions ----
  const auc = async (v: typeof auctions.$inferInsert, bidders: [number, number][] = []) => {
    const [a] = await db.insert(auctions).values(v).returning();
    let last: number | null = null;
    for (const [i, [uid, amount]] of bidders.entries()) {
      const [dep] = await db.select().from(auctionDeposits).where(sql`${auctionDeposits.auctionId} = ${a.id} and ${auctionDeposits.userId} = ${uid}`);
      if (!dep) {
        const [u] = await db.update(users).set({ walletBalance: sql`${users.walletBalance} - ${a.depositAmount}` }).where(eq(users.id, uid)).returning();
        await db.insert(walletTransactions).values({ userId: uid, type: "deposit_hold", amount: -a.depositAmount, balanceAfter: u.walletBalance, reference: `auction:${a.id}`, note: `تأمين مزاد: ${a.title}` });
        await db.insert(auctionDeposits).values({ auctionId: a.id, userId: uid, amount: a.depositAmount });
      }
      await db.insert(bids).values({ auctionId: a.id, bidderId: uid, amount, createdAt: new Date(v.startsAt.getTime() + (i + 1) * 600_000) });
      last = amount;
    }
    if (last) await db.update(auctions).set({ currentPrice: last, bidCount: bidders.length }).where(eq(auctions.id, a.id));
    return a;
  };
  const base = { commissionRate: "0.0300", description: "نسب موثق وشهادة صحية حديثة. المعاينة متاحة قبل انتهاء المزاد بالتنسيق مع البائع. التسليم في موقع البائع." };
  await auc(
    { ...base, sellerId: t3.id, title: "فحل عربي أصيل - أدهم بعمر 4 سنوات", category: "horses", breed: "عربي أصيل", ageMonths: 48, gender: "male", city: "babil", startPrice: 15_000_000, minIncrement: 250_000, depositAmount: 750_000, startsAt: new Date(now - 20 * H), endsAt: new Date(now + 4 * H), status: "live" },
    [[u1.id, 15_000_000], [u2.id, 15_500_000], [u1.id, 16_250_000]],
  );
  await auc(
    { ...base, sellerId: t5.id, title: "صقر شاهين بحري نادر", category: "falcons", breed: "شاهين", ageMonths: 18, gender: "female", city: "basra", startPrice: 3_000_000, minIncrement: 100_000, depositAmount: 150_000, startsAt: new Date(now - 2 * H), endsAt: new Date(now + 22 * H), status: "live" },
    [[u2.id, 3_000_000]],
  );
  await auc({ ...base, sellerId: t1.id, title: "كبش عواسي بطل معارض 2026", category: "sheep", breed: "عواسي", ageMonths: 36, gender: "male", weightKg: 120, city: "anbar", startPrice: 2_500_000, minIncrement: 50_000, depositAmount: 125_000, startsAt: new Date(now + 6 * H), endsAt: new Date(now + 30 * H), status: "scheduled" });
  await auc({ ...base, sellerId: t2.id, title: "ثور هولشتاين للتلقيح", category: "cattle", breed: "هولشتاين", ageMonths: 30, gender: "male", city: "salahaddin", startPrice: 6_000_000, minIncrement: 100_000, depositAmount: 300_000, startsAt: new Date(now - 1 * H), endsAt: new Date(now + 47 * H), status: "live" });

  // ---- Vets ----
  const [pv1] = await db.insert(providers).values({ userId: vet1.id, kind: "vet", businessName: "عيادة الراوي البيطرية", city: "anbar", address: "الرمادي - شارع 20", phone: vet1.phone, whatsapp: vet1.phone, workingHours: "السبت - الخميس 8ص - 8م", homeVisits: true, specialties: ["مواشي", "تلقيح اصطناعي", "تطعيمات"], description: "عيادة متخصصة بصحة المواشي والإبل، زيارات ميدانية للحقول في عموم الأنبار، تلقيح اصطناعي وتطعيمات موسمية." }).returning();
  const [pv2] = await db.insert(providers).values({ userId: vet2.id, kind: "vet", businessName: "مركز رعاية الحيوانات الأليفة", city: "baghdad", address: "المنصور - قرب ساحة الرواد", phone: vet2.phone, whatsapp: vet2.phone, workingHours: "يومياً 10ص - 10م", specialties: ["حيوانات أليفة", "طيور", "جراحة"], description: "رعاية شاملة للقطط والكلاب والطيور: فحوصات، تطعيمات، عمليات جراحية، وفندقة." }).returning();
  const [pv3] = await db.insert(providers).values({ userId: vet3.id, kind: "vet", businessName: "د. حيدر للخيول والإبل", city: "basra", address: "الزبير", phone: vet3.phone, homeVisits: true, specialties: ["خيول", "إبل"], description: "طبيب بيطري متخصص بالخيول والإبل." }).returning();
  await db.insert(vetServices).values([
    { providerId: pv1.id, name: "فحص عام للقطيع (زيارة ميدانية)", price: 50000, durationMinutes: 90 },
    { providerId: pv1.id, name: "تلقيح اصطناعي للأبقار", price: 35000, durationMinutes: 45 },
    { providerId: pv1.id, name: "تطعيم الحمى القلاعية (للرأس)", price: 3000, durationMinutes: 10 },
    { providerId: pv2.id, name: "فحص وتطعيم قطط", price: 25000, durationMinutes: 30 },
    { providerId: pv2.id, name: "تعقيم", price: 75000, durationMinutes: 60 },
    { providerId: pv3.id, name: "فحص عرج الخيول", price: 60000, durationMinutes: 60 },
  ]);

  // ---- Shops ----
  const [ps1] = await db.insert(providers).values({ userId: shop1.id, kind: "shop", businessName: "محلات الخير للأعلاف والأدوية", city: "anbar", address: "الرمادي - الحي الصناعي", phone: shop1.phone, whatsapp: shop1.phone, workingHours: "7ص - 7م", delivery: true, specialties: ["أعلاف", "أدوية بيطرية", "معدات"], description: "أعلاف مركزة وشعير وتبن، أدوية ولقاحات بيطرية، ومعدات المزارع. توصيل داخل الرمادي والفلوجة." }).returning();
  const [ps2] = await db.insert(providers).values({ userId: shop2.id, kind: "shop", businessName: "بيت الحيوانات الأليفة", city: "baghdad", address: "الكرادة داخل", phone: shop2.phone, whatsapp: shop2.phone, workingHours: "11ص - 11م", delivery: true, specialties: ["طعام قطط", "إكسسوارات", "أقفاص"], description: "كل ما تحتاجه قطتك وكلبك وطيورك." }).returning();
  await db.insert(products).values([
    { providerId: ps1.id, name: "علف مركز للأغنام 16% بروتين", category: "feed", price: 32000, unit: "كيس 50 كغم", stock: 300 },
    { providerId: ps1.id, name: "شعير عراقي منقى", category: "feed", price: 27000, unit: "كيس 50 كغم", stock: 500 },
    { providerId: ps1.id, name: "تبن حنطة مكبوس", category: "feed", price: 9000, unit: "بالة", stock: 120 },
    { providerId: ps1.id, name: "فيتامين AD3E للمواشي", category: "supplements", price: 12000, unit: "قنينة 100 مل", stock: 40 },
    { providerId: ps1.id, name: "مضاد طفيليات (آيفرمكتين)", category: "medicine", price: 15000, unit: "قنينة 50 مل", stock: 25 },
    { providerId: ps1.id, name: "معلفة حديد للأغنام", category: "equipment", price: 85000, unit: "قطعة", stock: 8 },
    { providerId: ps2.id, name: "طعام قطط جاف (رويال كانين)", category: "pet_food", price: 45000, unit: "كيس 4 كغم", stock: 30 },
    { providerId: ps2.id, name: "رمل قطط معطر", category: "accessories", price: 8000, unit: "كيس 10 لتر", stock: 60 },
    { providerId: ps2.id, name: "قفص طيور كبير", category: "accessories", price: 65000, unit: "قطعة", stock: 5 },
  ]);

  await db.insert(ads).values({ title: "شركة الرافدين للأعلاف - خصم 10% على العلف المركز", subtitle: "عرض خاص لمستخدمي حلالي حتى نهاية الشهر", advertiser: "الرافدين للأعلاف", linkUrl: `/shops/${ps1.id}`, placement: "home_top", endsAt: new Date(now + 30 * D) });

  console.log("Demo data created. Demo accounts use password: demo12345");
  console.log("  trader: 07801112233 · buyer: 07706667788 · vet: 07809990011 · shop: 07813330044");
}
