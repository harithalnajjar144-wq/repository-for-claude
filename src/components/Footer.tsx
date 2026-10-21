import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-16 bg-brand-900 text-white/80">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-md text-sm leading-7 text-white/65">
            منصة حلالي تنظّم سوق المواشي والحيوانات في العراق: بيع وشراء مباشر بدون وسطاء، مزادات محمية بالتأمين،
            أطباء بيطريون ومحلات تجهيز في مكان واحد.
          </p>
        </div>
        <div>
          <h3 className="mb-3 font-semibold text-white">المنصة</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/listings" className="hover:text-white">سوق المواشي</Link></li>
            <li><Link href="/auctions" className="hover:text-white">المزادات</Link></li>
            <li><Link href="/vets" className="hover:text-white">الأطباء البيطريون</Link></li>
            <li><Link href="/shops" className="hover:text-white">محلات التجهيز</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-semibold text-white">للأعمال</h3>
          <ul className="space-y-2 text-sm">
            <li><Link href="/pricing" className="hover:text-white">الباقات والاشتراكات</Link></li>
            <li><Link href="/how-auctions-work" className="hover:text-white">كيف يعمل المزاد</Link></li>
            <li><Link href="/register" className="hover:text-white">سجّل كتاجر أو طبيب أو محل</Link></li>
            <li><Link href="/terms" className="hover:text-white">شروط الاستخدام</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} حلالي. جميع الحقوق محفوظة.
      </div>
    </footer>
  );
}
