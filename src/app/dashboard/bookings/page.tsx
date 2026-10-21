import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, providers, vetServices } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { BOOKING_STATUS_LABELS } from "@/lib/constants";
import { dateTime } from "@/lib/format";
import { updateBookingAction } from "@/app/actions/providers";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export default async function MyBookings() {
  const user = await requireUser();
  const rows = await db
    .select({ b: bookings, p: providers, service: vetServices.name })
    .from(bookings)
    .innerJoin(providers, eq(providers.id, bookings.providerId))
    .leftJoin(vetServices, eq(vetServices.id, bookings.serviceId))
    .where(eq(bookings.userId, user.id))
    .orderBy(desc(bookings.scheduledAt));
  return (
    <div>
      <PageHeader title="حجوزاتي البيطرية" actions={<Link href="/vets" className="btn-primary">احجز موعداً</Link>} />
      {rows.length === 0 ? (
        <EmptyState icon="🩺" title="لا توجد حجوزات" />
      ) : (
        <div className="space-y-3">
          {rows.map(({ b, p, service }) => (
            <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link href={`/vets/${p.id}`} className="font-semibold hover:text-brand-700">{p.businessName}</Link>
                <div className="text-sm text-ink/65">{service ?? "استشارة / فحص عام"} · {b.animalType} ({b.animalCount}) {b.homeVisit && "· زيارة منزلية"}</div>
                <div className="text-sm">📅 {dateTime(b.scheduledAt)}</div>
                {b.providerNote && <div className="text-xs text-ink/60">ملاحظة العيادة: {b.providerNote}</div>}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={b.status === "confirmed" ? "green" : b.status === "pending" ? "amber" : "gray"}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
                {(b.status === "pending" || b.status === "confirmed") && (
                  <form action={updateBookingAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <button name="status" value="cancelled" className="btn-ghost text-xs text-red-600">إلغاء</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
