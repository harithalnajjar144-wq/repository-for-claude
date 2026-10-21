import { requireUser } from "@/lib/auth";
import { createListingAction } from "@/app/actions/listings";
import { ListingForm } from "@/components/ListingForm";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "إعلان جديد" };

export default async function NewListingPage() {
  const user = await requireUser("/listings/new");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title="إعلان جديد" subtitle="أضف عرض بيع أو طلب شراء. الإعلانات الواضحة بالصور تُباع أسرع." />
      <ListingForm action={createListingAction} defaultCity={user.city} />
    </div>
  );
}
