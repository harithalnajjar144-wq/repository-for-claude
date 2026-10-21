import { ProviderDirectory } from "@/components/ProviderDirectory";

export const metadata = { title: "الأطباء البيطريون" };

export default async function VetsPage({ searchParams }: { searchParams: Promise<{ city?: string; q?: string }> }) {
  return <ProviderDirectory kind="vet" f={await searchParams} />;
}
