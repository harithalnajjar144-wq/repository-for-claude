import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import type { Listing, ListingDetail } from "@/lib/types";
import { AuthGate } from "@/components/AuthGate";
import { ListingForm, formToBody, listingToForm } from "@/components/ListingForm";
import { ErrorView, Loading, Screen } from "@/components/ui";

export default function EditListing() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({ queryKey: ["listing", id], queryFn: () => api<ListingDetail>(`/listings/${id}`) });
  const save = useAction((v: ReturnType<typeof formToBody>) => api<Listing>(`/listings/${id}`, { method: "PATCH", body: v }), {
    success: "تم حفظ التعديلات",
    invalidate: [["listing", id], ["listings"], ["my-listings"]],
    onDone: () => router.back(),
  });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <ErrorView error={q.error} onRetry={() => q.refetch()} />;
  return (
    <Screen>
      <ListingForm initial={listingToForm(q.data.listing)} submitLabel="حفظ التعديلات" busy={save.busy} onSubmit={(v) => save.run(formToBody(v))} />
    </Screen>
  );
}
