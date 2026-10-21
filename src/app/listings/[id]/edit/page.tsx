import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { listings } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { updateListingAction } from "@/app/actions/listings";
import { ListingForm } from "@/components/ListingForm";
import { PageHeader } from "@/components/ui";

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/listings/${id}/edit`);
  const [l] = await db.select().from(listings).where(eq(listings.id, Number(id) || 0));
  if (!l || (l.userId !== user.id && user.role !== "admin")) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title="تعديل الإعلان" />
      <ListingForm action={updateListingAction} listing={l} />
    </div>
  );
}
