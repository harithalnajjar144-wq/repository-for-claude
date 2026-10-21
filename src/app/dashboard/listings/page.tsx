import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { listings } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { categoryLabel, cityLabel } from "@/lib/constants";
import { dateOnly, iqd, num } from "@/lib/format";
import { setListingStatusAction } from "@/app/actions/listings";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

const STATUS: Record<string, [string, "green" | "gray" | "earth" | "red"]> = {
  active: ["نشط", "green"],
  sold: ["مباع", "earth"],
  hidden: ["مخفي", "gray"],
  removed: ["محذوف", "red"],
};

export default async function MyListings() {
  const user = await requireUser();
  const rows = await db.select().from(listings).where(eq(listings.userId, user.id)).orderBy(desc(listings.createdAt));
  const visible = rows.filter((r) => r.status !== "removed");
  return (
    <div>
      <PageHeader title="إعلاناتي" actions={<Link href="/listings/new" className="btn-primary">+ إعلان جديد</Link>} />
      {visible.length === 0 ? (
        <EmptyState title="لم تنشر أي إعلان بعد"><Link href="/listings/new" className="font-semibold text-brand-700">انشر إعلانك الأول</Link></EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>الإعلان</th><th>السعر</th><th>المحافظة</th><th>المشاهدات</th><th>الحالة</th><th>التاريخ</th><th></th></tr></thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/listings/${l.id}`} className="font-medium hover:text-brand-700">{l.title}</Link>
                    <div className="text-xs text-ink/50">{categoryLabel(l.category)} {l.type === "wanted" && "· طلب شراء"} {l.featuredUntil && l.featuredUntil > new Date() && "· ★ مميز"}</div>
                  </td>
                  <td className="whitespace-nowrap">{iqd(l.price)}</td>
                  <td>{cityLabel(l.city)}</td>
                  <td>{num(l.views)}</td>
                  <td><Badge tone={STATUS[l.status][1]}>{STATUS[l.status][0]}</Badge></td>
                  <td className="whitespace-nowrap text-xs">{dateOnly(l.createdAt)}</td>
                  <td>
                    <form action={setListingStatusAction} className="flex gap-1">
                      <input type="hidden" name="id" value={l.id} />
                      <Link href={`/listings/${l.id}/edit`} className="btn-ghost px-2 py-1 text-xs">تعديل</Link>
                      {l.status === "active" ? (
                        <button name="status" value="sold" className="btn-ghost px-2 py-1 text-xs">تم البيع</button>
                      ) : (
                        <button name="status" value="active" className="btn-ghost px-2 py-1 text-xs">إعادة نشر</button>
                      )}
                      <button name="status" value="removed" className="btn-ghost px-2 py-1 text-xs text-red-600">حذف</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
