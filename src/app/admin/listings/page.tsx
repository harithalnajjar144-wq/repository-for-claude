import Link from "next/link";
import { desc, eq, ilike, and, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { listings, users } from "@/db/schema";
import { categoryLabel, cityLabel } from "@/lib/constants";
import { dateOnly, iqd } from "@/lib/format";
import { moderateListingAction } from "@/app/actions/admin";
import { Badge, PageHeader } from "@/components/ui";

export default async function AdminListings({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  const where: SQL[] = [];
  if (q?.trim()) where.push(ilike(listings.title, `%${q.trim()}%`));
  if (status) where.push(eq(listings.status, status as "active"));
  const rows = await db
    .select({ l: listings, u: { name: users.name, id: users.id } })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.userId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(listings.createdAt))
    .limit(150);
  return (
    <div>
      <PageHeader title="الإعلانات" />
      <form className="card mb-4 flex flex-wrap gap-2 p-3">
        <input name="q" defaultValue={q} placeholder="بحث بالعنوان" className="input flex-1" />
        <select name="status" defaultValue={status ?? ""} className="input w-auto">
          <option value="">كل الحالات</option><option value="active">نشط</option><option value="hidden">مخفي</option><option value="sold">مباع</option><option value="removed">محذوف</option>
        </select>
        <button className="btn-primary">بحث</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>#</th><th>الإعلان</th><th>البائع</th><th>السعر</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            {rows.map(({ l, u }) => (
              <tr key={l.id}>
                <td className="text-xs">{l.id}</td>
                <td><Link href={`/listings/${l.id}`} className="font-medium hover:text-brand-700">{l.title}</Link><div className="text-xs text-ink/50">{categoryLabel(l.category)} · {cityLabel(l.city)} · {dateOnly(l.createdAt)}</div></td>
                <td>{u.name}</td>
                <td className="whitespace-nowrap">{iqd(l.price)}</td>
                <td><Badge tone={l.status === "active" ? "green" : l.status === "removed" ? "red" : "gray"}>{l.status}</Badge></td>
                <td>
                  <form action={moderateListingAction} className="flex gap-1">
                    <input type="hidden" name="id" value={l.id} />
                    {l.status !== "active" && <button name="status" value="active" className="btn-ghost px-2 py-1 text-xs">تفعيل</button>}
                    {l.status === "active" && <button name="status" value="hidden" className="btn-ghost px-2 py-1 text-xs">إخفاء</button>}
                    {l.status !== "removed" && <button name="status" value="removed" className="btn-ghost px-2 py-1 text-xs text-red-600">حذف</button>}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
