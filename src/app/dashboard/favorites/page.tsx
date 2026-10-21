import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { favorites, listings, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ListingCard } from "@/components/cards";
import { EmptyState, PageHeader } from "@/components/ui";

export default async function Favorites() {
  const user = await requireUser();
  const rows = await db
    .select({ l: listings, seller: { name: users.name, verificationStatus: users.verificationStatus } })
    .from(favorites)
    .innerJoin(listings, eq(listings.id, favorites.listingId))
    .innerJoin(users, eq(users.id, listings.userId))
    .where(eq(favorites.userId, user.id))
    .orderBy(desc(favorites.createdAt));
  const visible = rows.filter((r) => r.l.status === "active" || r.l.status === "sold");
  return (
    <div>
      <PageHeader title="المفضلة" />
      {visible.length === 0 ? (
        <EmptyState icon="♡" title="لا توجد إعلانات في المفضلة" />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {visible.map((r) => <ListingCard key={r.l.id} l={{ ...r.l, seller: r.seller }} />)}
        </div>
      )}
    </div>
  );
}
