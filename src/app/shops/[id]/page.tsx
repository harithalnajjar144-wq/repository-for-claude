import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, providers, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { PRODUCT_CATEGORIES, productCategoryLabel } from "@/lib/constants";
import { iqd } from "@/lib/format";
import { createOrderAction } from "@/app/actions/providers";
import { ProviderHeader } from "@/components/ProviderHeader";
import { ReportForm } from "@/components/ReportForm";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { EmptyState } from "@/components/ui";

export default async function ShopPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ category?: string }> }) {
  const id = Number((await params).id) || 0;
  const { category } = await searchParams;
  const [row] = await db
    .select({ p: providers, v: users.verificationStatus, banned: users.isBanned })
    .from(providers)
    .innerJoin(users, eq(users.id, providers.userId))
    .where(and(eq(providers.id, id), eq(providers.kind, "shop")));
  if (!row || row.banned) notFound();
  const user = await getCurrentUser();
  const all = await db
    .select()
    .from(products)
    .where(and(eq(products.providerId, id), eq(products.isActive, true)))
    .orderBy(asc(products.category), asc(products.name));
  const items = category ? all.filter((p) => p.category === category) : all;
  const cats = PRODUCT_CATEGORIES.filter((c) => all.some((p) => p.category === c.key));
  const isOwner = user?.id === row.p.userId;
  const canOrder = !!user && !isOwner;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <ProviderHeader p={row.p} verification={row.v} loggedIn={!!user} />
      {isOwner && (
        <p className="mt-4 text-sm">هذه صفحة محلك العامة. <Link href="/dashboard/business" className="font-semibold text-brand-700">إدارة المنتجات والطلبات</Link></p>
      )}
      <ActionForm action={createOrderAction} className="mt-6" resetOnSuccess>
        <input type="hidden" name="providerId" value={row.p.id} />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section>
            {cats.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-2">
                <Link href={`/shops/${id}`} className={`badge px-3 py-1.5 text-sm ${!category ? "bg-brand-600 text-white" : "bg-white ring-1 ring-earth-100"}`}>الكل</Link>
                {cats.map((c) => (
                  <Link key={c.key} href={`/shops/${id}?category=${c.key}`} className={`badge px-3 py-1.5 text-sm ${category === c.key ? "bg-brand-600 text-white" : "bg-white ring-1 ring-earth-100"}`}>{c.label}</Link>
                ))}
              </div>
            )}
            {items.length === 0 ? (
              <EmptyState icon="📦" title="لا توجد منتجات معروضة بعد" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((p) => (
                  <div key={p.id} className="card flex gap-3 p-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-earth-50">
                      {p.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl">📦</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-ink/50">{productCategoryLabel(p.category)}</div>
                      <div className="font-medium leading-snug">{p.name}</div>
                      {p.description && <div className="line-clamp-2 text-xs text-ink/55">{p.description}</div>}
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="font-bold text-brand-700">{iqd(p.price)}{p.unit && <span className="text-xs font-normal text-ink/50"> / {p.unit}</span>}</span>
                        {p.stock > 0 ? (
                          canOrder && <input type="number" name={`qty_${p.id}`} min={0} max={p.stock} defaultValue={0} className="input w-16 px-2 py-1 text-center" aria-label={`كمية ${p.name}`} />
                        ) : (
                          <span className="text-xs text-red-600">نفد</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <aside className="space-y-4">
            {canOrder ? (
              <div className="card space-y-3 p-5">
                <h2 className="text-lg font-bold">إتمام الطلب</h2>
                <p className="text-xs text-ink/55">حدد الكميات من القائمة ثم أرسل الطلب. الدفع نقداً عند الاستلام.</p>
                <fieldset className="flex gap-2 text-sm">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-earth-200 p-2.5 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                    <input type="radio" name="fulfilment" value="pickup" defaultChecked className="accent-brand-600" /> استلام من المحل
                  </label>
                  {row.p.delivery && (
                    <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-earth-200 p-2.5 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                      <input type="radio" name="fulfilment" value="delivery" className="accent-brand-600" /> توصيل
                    </label>
                  )}
                </fieldset>
                {row.p.delivery && <Field label="عنوان التوصيل"><input name="address" className="input" /></Field>}
                <Field label="رقم الهاتف"><input name="phone" dir="ltr" defaultValue={user!.phone} className="input text-end" /></Field>
                <Field label="ملاحظات"><textarea name="notes" className="input" maxLength={1000} /></Field>
                <SubmitButton className="btn-primary w-full" pendingText="جارٍ الإرسال…">إرسال الطلب</SubmitButton>
              </div>
            ) : !user ? (
              <div className="card p-5"><Link href={`/login?next=/shops/${id}`} className="btn-primary w-full">سجّل الدخول للطلب</Link></div>
            ) : null}
          </aside>
        </div>
      </ActionForm>
      {user && !isOwner && (
        <div className="mt-6 max-w-sm"><ReportForm targetType="provider" targetId={row.p.id} /></div>
      )}
    </div>
  );
}
