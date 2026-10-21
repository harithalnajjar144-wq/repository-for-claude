import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { bookings, orderItems, orders, products, providers, users, vetServices } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { BOOKING_STATUS_LABELS, GOVERNORATES, ORDER_STATUS_LABELS, PRODUCT_CATEGORIES, productCategoryLabel, VET_SPECIALTIES } from "@/lib/constants";
import { dateTime, iqd } from "@/lib/format";
import {
  deleteProductAction,
  deleteServiceAction,
  saveProductAction,
  saveServiceAction,
  updateBookingAction,
  updateOrderAction,
  updateProviderAction,
} from "@/app/actions/providers";
import { ActionForm, Field, ImagePicker, SubmitButton } from "@/components/forms";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "إدارة النشاط التجاري" };

export default async function BusinessPage({ searchParams }: { searchParams: Promise<{ tab?: string; edit?: string }> }) {
  const user = await requireUser();
  const [p] = await db.select().from(providers).where(eq(providers.userId, user.id));
  if (!p) redirect("/dashboard");
  const { tab = "profile", edit } = await searchParams;
  const isVet = p.kind === "vet";
  const tabs: [string, string][] = isVet
    ? [["profile", "ملف العيادة"], ["services", "الخدمات"], ["bookings", "الحجوزات"]]
    : [["profile", "ملف المحل"], ["products", "المنتجات"], ["orders", "الطلبات"]];

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.businessName}
        subtitle={isVet ? "إدارة العيادة البيطرية" : "إدارة محل الرعاية والتجهيز"}
        actions={<Link href={`/${isVet ? "vets" : "shops"}/${p.id}`} className="btn-outline">عرض الصفحة العامة</Link>}
      />
      <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-earth-100">
        {tabs.map(([k, l]) => (
          <Link key={k} href={`/dashboard/business?tab=${k}`} className={`flex-1 rounded-lg py-2 text-center text-sm ${tab === k ? "bg-brand-600 font-semibold text-white" : ""}`}>{l}</Link>
        ))}
      </div>

      {tab === "profile" && (
        <ActionForm action={updateProviderAction} className="card space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={isVet ? "اسم العيادة / الطبيب" : "اسم المحل"}><input name="businessName" className="input" defaultValue={p.businessName} required /></Field>
            <Field label="المحافظة">
              <select name="city" className="input" defaultValue={p.city}>
                {GOVERNORATES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="العنوان التفصيلي"><input name="address" className="input" defaultValue={p.address ?? ""} /></Field>
          <Field label="نبذة"><textarea name="description" className="input min-h-28" defaultValue={p.description ?? ""} maxLength={3000} /></Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="هاتف العمل"><input name="phone" dir="ltr" className="input" defaultValue={p.phone ?? ""} /></Field>
            <Field label="واتساب"><input name="whatsapp" dir="ltr" className="input" defaultValue={p.whatsapp ?? ""} /></Field>
            <Field label="أوقات الدوام"><input name="workingHours" className="input" defaultValue={p.workingHours ?? ""} placeholder="السبت-الخميس 9ص - 9م" /></Field>
          </div>
          <Field label={isVet ? "التخصصات (افصل بفاصلة)" : "الأصناف الرئيسية (افصل بفاصلة)"} hint={isVet ? `مثال: ${VET_SPECIALTIES.slice(0, 4).join("، ")}` : "مثال: أعلاف، أدوية بيطرية، مستلزمات قطط"}>
            <input name="specialties" className="input" defaultValue={p.specialties.join("، ")} />
          </Field>
          <Field label="الشعار / صورة العيادة"><input name="logo" type="file" accept="image/*" className="input" /></Field>
          <div className="flex flex-wrap gap-6 text-sm">
            {isVet ? (
              <label className="flex items-center gap-2"><input type="checkbox" name="homeVisits" defaultChecked={p.homeVisits} className="h-4 w-4 accent-brand-600" /> أقدم زيارات منزلية / للحقول</label>
            ) : (
              <label className="flex items-center gap-2"><input type="checkbox" name="delivery" defaultChecked={p.delivery} className="h-4 w-4 accent-brand-600" /> أوفر خدمة التوصيل</label>
            )}
            <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={p.isActive} className="h-4 w-4 accent-brand-600" /> الصفحة ظاهرة للعامة</label>
          </div>
          <SubmitButton>حفظ</SubmitButton>
        </ActionForm>
      )}

      {tab === "services" && isVet && <Services providerId={p.id} editId={Number(edit) || undefined} />}
      {tab === "bookings" && isVet && <Bookings providerId={p.id} />}
      {tab === "products" && !isVet && <Products providerId={p.id} editId={Number(edit) || undefined} />}
      {tab === "orders" && !isVet && <Orders providerId={p.id} />}
    </div>
  );
}

async function Services({ providerId, editId }: { providerId: number; editId?: number }) {
  const rows = await db.select().from(vetServices).where(and(eq(vetServices.providerId, providerId), eq(vetServices.isActive, true)));
  const editing = rows.find((r) => r.id === editId);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="card divide-y divide-earth-50">
        {rows.length === 0 && <p className="p-5 text-sm text-ink/55">أضف خدماتك وأسعارها ليتمكن المربون من الحجز.</p>}
        {rows.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-3 p-4">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-ink/55">{s.price ? iqd(s.price) : "حسب الحالة"} · {s.durationMinutes} دقيقة</div>
            </div>
            <form action={deleteServiceAction} className="flex gap-1">
              <input type="hidden" name="id" value={s.id} />
              <Link href={`/dashboard/business?tab=services&edit=${s.id}`} className="btn-ghost px-2 py-1 text-xs">تعديل</Link>
              <button className="btn-ghost px-2 py-1 text-xs text-red-600">حذف</button>
            </form>
          </div>
        ))}
      </div>
      <ActionForm key={editing?.id ?? "new"} action={saveServiceAction} className="card space-y-3 p-5" resetOnSuccess={!editing}>
        <h3 className="font-semibold">{editing ? "تعديل الخدمة" : "إضافة خدمة"}</h3>
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <Field label="اسم الخدمة"><input name="name" className="input" required defaultValue={editing?.name} placeholder="مثال: تلقيح الأغنام ضد الحمى القلاعية" /></Field>
        <Field label="الوصف"><textarea name="description" className="input" defaultValue={editing?.description ?? ""} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="السعر (د.ع)"><input name="price" type="number" min={0} step={500} className="input" defaultValue={editing?.price ?? ""} /></Field>
          <Field label="المدة (دقيقة)"><input name="durationMinutes" type="number" min={5} className="input" defaultValue={editing?.durationMinutes ?? 30} /></Field>
        </div>
        <SubmitButton>{editing ? "حفظ" : "إضافة"}</SubmitButton>
        {editing && <Link href="/dashboard/business?tab=services" className="block text-center text-xs text-ink/50">إلغاء التعديل</Link>}
      </ActionForm>
    </div>
  );
}

async function Bookings({ providerId }: { providerId: number }) {
  const rows = await db
    .select({ b: bookings, u: { name: users.name, phone: users.phone }, service: vetServices.name })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.userId))
    .leftJoin(vetServices, eq(vetServices.id, bookings.serviceId))
    .where(eq(bookings.providerId, providerId))
    .orderBy(desc(bookings.scheduledAt))
    .limit(200);
  if (!rows.length) return <EmptyState icon="📅" title="لا توجد حجوزات بعد" />;
  return (
    <div className="space-y-3">
      {rows.map(({ b, u, service }) => (
        <div key={b.id} className="card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{u.name} <a href={`tel:${u.phone}`} className="text-sm font-normal text-brand-700" dir="ltr">{u.phone}</a></div>
              <div className="text-sm">📅 {dateTime(b.scheduledAt)} {b.homeVisit && <Badge tone="earth">زيارة منزلية</Badge>}</div>
              <div className="text-sm text-ink/65">{service ?? "استشارة / فحص عام"} · {b.animalType} ({b.animalCount})</div>
              {b.notes && <div className="mt-1 text-sm text-ink/60">«{b.notes}»</div>}
            </div>
            <Badge tone={b.status === "confirmed" ? "green" : b.status === "pending" ? "amber" : "gray"}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
          </div>
          {(b.status === "pending" || b.status === "confirmed") && (
            <form action={updateBookingAction} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="id" value={b.id} />
              <input name="note" className="input max-w-xs flex-1 py-1.5" placeholder="ملاحظة للمربي (اختياري)" />
              {b.status === "pending" && <button name="status" value="confirmed" className="btn-primary py-1.5">تأكيد</button>}
              {b.status === "confirmed" && <button name="status" value="completed" className="btn-primary py-1.5">تم</button>}
              <button name="status" value={b.status === "pending" ? "rejected" : "cancelled"} className="btn-outline py-1.5 text-red-600">{b.status === "pending" ? "رفض" : "إلغاء"}</button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}

async function Products({ providerId, editId }: { providerId: number; editId?: number }) {
  const rows = await db.select().from(products).where(and(eq(products.providerId, providerId), eq(products.isActive, true))).orderBy(desc(products.createdAt));
  const editing = rows.find((r) => r.id === editId);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-ink/55">أضف منتجاتك ليتمكن الزبائن من الطلب مباشرة.</p>
        ) : (
          <table className="table-base">
            <thead><tr><th>المنتج</th><th>السعر</th><th>المخزون</th><th></th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><div className="font-medium">{p.name}</div><div className="text-xs text-ink/50">{productCategoryLabel(p.category)}</div></td>
                  <td className="whitespace-nowrap">{iqd(p.price)}{p.unit && ` / ${p.unit}`}</td>
                  <td className={p.stock === 0 ? "text-red-600" : ""}>{p.stock}</td>
                  <td>
                    <form action={deleteProductAction} className="flex gap-1">
                      <input type="hidden" name="id" value={p.id} />
                      <Link href={`/dashboard/business?tab=products&edit=${p.id}`} className="btn-ghost px-2 py-1 text-xs">تعديل</Link>
                      <button className="btn-ghost px-2 py-1 text-xs text-red-600">حذف</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <ActionForm key={editing?.id ?? "new"} action={saveProductAction} className="card space-y-3 p-5" resetOnSuccess={!editing}>
        <h3 className="font-semibold">{editing ? "تعديل المنتج" : "إضافة منتج"}</h3>
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <Field label="اسم المنتج"><input name="name" className="input" required defaultValue={editing?.name} /></Field>
        <Field label="الفئة">
          <select name="category" className="input" defaultValue={editing?.category ?? "feed"}>
            {PRODUCT_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="الوصف"><textarea name="description" className="input" defaultValue={editing?.description ?? ""} /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="السعر"><input name="price" type="number" min={0} step={250} required className="input" defaultValue={editing?.price} /></Field>
          <Field label="الوحدة"><input name="unit" className="input" placeholder="كيس 50 كغم" defaultValue={editing?.unit ?? ""} /></Field>
          <Field label="المخزون"><input name="stock" type="number" min={0} className="input" defaultValue={editing?.stock ?? 0} /></Field>
        </div>
        <ImagePicker max={4} existing={editing?.images} />
        <SubmitButton>{editing ? "حفظ" : "إضافة"}</SubmitButton>
        {editing && <Link href="/dashboard/business?tab=products" className="block text-center text-xs text-ink/50">إلغاء التعديل</Link>}
      </ActionForm>
    </div>
  );
}

async function Orders({ providerId }: { providerId: number }) {
  const rows = await db
    .select({ o: orders, u: { name: users.name } })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(eq(orders.providerId, providerId))
    .orderBy(desc(orders.createdAt))
    .limit(200);
  if (!rows.length) return <EmptyState icon="🛒" title="لا توجد طلبات بعد" />;
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, rows.map((r) => r.o.id)));
  const next: Record<string, [string, string][]> = {
    pending: [["confirmed", "تأكيد"], ["cancelled", "رفض"]],
    confirmed: [["ready", "جاهز"], ["delivered", "تم التسليم"], ["cancelled", "إلغاء"]],
    ready: [["delivered", "تم التسليم"], ["cancelled", "إلغاء"]],
  };
  return (
    <div className="space-y-3">
      {rows.map(({ o, u }) => (
        <div key={o.id} className="card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-semibold">#{o.id} · {u.name} <a href={`tel:${o.phone}`} dir="ltr" className="text-sm font-normal text-brand-700">{o.phone}</a></div>
              <div className="text-xs text-ink/50">{dateTime(o.createdAt)} · {o.fulfilment === "delivery" ? `توصيل إلى: ${o.address}` : "استلام من المحل"}</div>
            </div>
            <Badge tone={o.status === "delivered" ? "green" : o.status === "cancelled" ? "gray" : "amber"}>{ORDER_STATUS_LABELS[o.status]}</Badge>
          </div>
          <ul className="mt-2 text-sm text-ink/70">
            {items.filter((i) => i.orderId === o.id).map((i) => <li key={i.id}>{i.quantity} × {i.name} — {iqd(i.unitPrice * i.quantity)}</li>)}
          </ul>
          {o.notes && <p className="mt-1 text-sm text-ink/60">«{o.notes}»</p>}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">المجموع: {iqd(o.total)}</span>
            {next[o.status] && (
              <form action={updateOrderAction} className="flex gap-2">
                <input type="hidden" name="id" value={o.id} />
                {next[o.status].map(([s, l]) => (
                  <button key={s} name="status" value={s} className={s === "cancelled" ? "btn-outline py-1.5 text-red-600" : "btn-primary py-1.5"}>{l}</button>
                ))}
              </form>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
