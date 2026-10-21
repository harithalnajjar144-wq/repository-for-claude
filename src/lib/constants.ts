// Reference data shown across the platform (Arabic labels, stable English keys).

export const GOVERNORATES = [
  { key: "baghdad", label: "بغداد" },
  { key: "basra", label: "البصرة" },
  { key: "nineveh", label: "نينوى" },
  { key: "erbil", label: "أربيل" },
  { key: "anbar", label: "الأنبار" },
  { key: "najaf", label: "النجف" },
  { key: "karbala", label: "كربلاء" },
  { key: "babil", label: "بابل" },
  { key: "diyala", label: "ديالى" },
  { key: "kirkuk", label: "كركوك" },
  { key: "salahaddin", label: "صلاح الدين" },
  { key: "wasit", label: "واسط" },
  { key: "dhiqar", label: "ذي قار" },
  { key: "maysan", label: "ميسان" },
  { key: "muthanna", label: "المثنى" },
  { key: "qadisiyah", label: "الديوانية" },
  { key: "sulaymaniyah", label: "السليمانية" },
  { key: "duhok", label: "دهوك" },
  { key: "halabja", label: "حلبجة" },
] as const;

export const ANIMAL_CATEGORIES = [
  { key: "sheep", label: "أغنام", icon: "🐑" },
  { key: "goats", label: "ماعز", icon: "🐐" },
  { key: "cattle", label: "أبقار وعجول", icon: "🐄" },
  { key: "camels", label: "إبل", icon: "🐪" },
  { key: "buffalo", label: "جاموس", icon: "🐃" },
  { key: "horses", label: "خيول", icon: "🐎" },
  { key: "poultry", label: "دواجن وطيور", icon: "🐓" },
  { key: "pigeons", label: "حمام", icon: "🕊️" },
  { key: "falcons", label: "صقور", icon: "🦅" },
  { key: "pets", label: "حيوانات أليفة", icon: "🐈" },
  { key: "other", label: "أخرى", icon: "🐾" },
] as const;

export const PRODUCT_CATEGORIES = [
  { key: "feed", label: "أعلاف" },
  { key: "medicine", label: "أدوية ولقاحات" },
  { key: "supplements", label: "مكملات وفيتامينات" },
  { key: "pet_food", label: "طعام حيوانات أليفة" },
  { key: "accessories", label: "مستلزمات وإكسسوارات" },
  { key: "equipment", label: "معدات وأدوات" },
  { key: "other", label: "أخرى" },
] as const;

export const VET_SPECIALTIES = [
  "مواشي",
  "دواجن",
  "خيول",
  "إبل",
  "حيوانات أليفة",
  "طيور",
  "جراحة",
  "تلقيح اصطناعي",
  "تطعيمات",
];

export const ROLE_LABELS: Record<string, string> = {
  user: "مستخدم",
  trader: "تاجر / مربي",
  vet: "طبيب بيطري",
  shop: "محل رعاية وتجهيز",
  admin: "مدير المنصة",
};

export const GENDER_LABELS: Record<string, string> = {
  male: "ذكر",
  female: "أنثى",
  mixed: "مختلط",
  unknown: "غير محدد",
};

export const AUCTION_STATUS_LABELS: Record<string, string> = {
  scheduled: "قادم",
  live: "مباشر",
  ended: "منتهي - بانتظار التسليم",
  completed: "مكتمل",
  unsold: "انتهى بدون مزايدات",
  cancelled: "ملغي",
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: "بانتظار التأكيد",
  confirmed: "مؤكد",
  completed: "مكتمل",
  cancelled: "ملغي",
  rejected: "مرفوض",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "جديد",
  confirmed: "مؤكد",
  ready: "جاهز",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

export const VERIFICATION_LABELS: Record<string, string> = {
  none: "غير موثق",
  pending: "قيد المراجعة",
  verified: "موثق",
  rejected: "مرفوض",
};

export const TX_TYPE_LABELS: Record<string, string> = {
  topup: "شحن رصيد",
  withdrawal: "سحب",
  deposit_hold: "حجز تأمين مزاد",
  deposit_release: "إرجاع تأمين مزاد",
  deposit_forfeit: "مصادرة تأمين",
  deposit_compensation: "تعويض من تأمين مزايد",
  commission: "عمولة مزاد",
  subscription: "اشتراك",
  featured: "تمييز إعلان",
  adjustment: "تسوية إدارية",
};

export const TOPUP_METHODS = [
  { key: "zaincash", label: "زين كاش" },
  { key: "qicard", label: "كي كارد / ماستر" },
  { key: "fastpay", label: "فاست باي" },
  { key: "asiahawala", label: "آسيا حوالة" },
  { key: "cash", label: "نقداً في المكتب" },
] as const;

export const REPORT_REASONS = [
  { key: "fraud", label: "احتيال أو حساب وهمي" },
  { key: "wrong_info", label: "معلومات غير صحيحة" },
  { key: "sick_animal", label: "حيوان مريض أو مخفي العيوب" },
  { key: "prohibited", label: "محتوى ممنوع" },
  { key: "no_show", label: "لم يلتزم بالصفقة" },
  { key: "other", label: "سبب آخر" },
] as const;

export const AUCTION_DURATIONS = [
  { hours: 1, label: "ساعة واحدة" },
  { hours: 6, label: "6 ساعات" },
  { hours: 24, label: "يوم واحد" },
  { hours: 72, label: "3 أيام" },
  { hours: 168, label: "أسبوع" },
] as const;

export const labelOf = (
  list: readonly { key: string; label: string }[],
  key: string | null | undefined,
) => list.find((x) => x.key === key)?.label ?? key ?? "";

export const cityLabel = (key: string | null | undefined) => labelOf(GOVERNORATES, key);
export const categoryLabel = (key: string | null | undefined) => labelOf(ANIMAL_CATEGORIES, key);
export const categoryIcon = (key: string | null | undefined) =>
  ANIMAL_CATEGORIES.find((c) => c.key === key)?.icon ?? "🐾";
export const productCategoryLabel = (key: string | null | undefined) =>
  labelOf(PRODUCT_CATEGORIES, key);
