import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { markAllReadAction } from "@/app/actions/account";
import { EmptyState, PageHeader } from "@/components/ui";

export default async function NotificationsPage() {
  const user = await requireUser();
  const rows = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(100);
  return (
    <div>
      <PageHeader
        title="الإشعارات"
        actions={rows.some((r) => !r.isRead) && <form action={markAllReadAction}><button className="btn-outline">تعليم الكل كمقروء</button></form>}
      />
      {rows.length === 0 ? (
        <EmptyState icon="🔔" title="لا توجد إشعارات" />
      ) : (
        <ul className="card divide-y divide-earth-50">
          {rows.map((n) => (
            <li key={n.id} className={n.isRead ? "" : "bg-brand-50/50"}>
              <Link href={n.link ?? "#"} className="block px-5 py-3.5">
                <div className={`text-sm ${n.isRead ? "" : "font-semibold"}`}>{!n.isRead && "● "}{n.title}</div>
                {n.body && <div className="mt-0.5 text-sm text-ink/65">{n.body}</div>}
                <div className="mt-0.5 text-xs text-ink/40">{timeAgo(n.createdAt)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
