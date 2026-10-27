import { router } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAction } from "@/lib/hooks";
import type { Listing } from "@/lib/types";
import { AuthGate } from "@/components/AuthGate";
import { ListingForm, formToBody, listingToForm } from "@/components/ListingForm";
import { Notice, Screen } from "@/components/ui";

export default function NewListing() {
  return (
    <AuthGate message="سجّل الدخول لنشر إعلانك.">
      <Content />
    </AuthGate>
  );
}

function Content() {
  const { user } = useAuth();
  const create = useAction((v: ReturnType<typeof formToBody>) => api<Listing>("/listings", { body: v }), {
    success: "✅ تم نشر إعلانك",
    invalidate: [["listings"], ["home"], ["my-listings"]],
    onDone: (l) => router.replace({ pathname: "/listing/[id]", params: { id: String(l.id) } }),
  });
  return (
    <Screen>
      <Notice tone="green">الإعلانات الواضحة بالصور تُباع أسرع. صوّر الحيوان في ضوء النهار ومن أكثر من زاوية.</Notice>
      <ListingForm initial={listingToForm(undefined, user?.city)} submitLabel="نشر الإعلان" busy={create.busy} onSubmit={(v) => create.run(formToBody(v))} />
    </Screen>
  );
}
