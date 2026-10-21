import { ProviderDirectory } from "@/components/ProviderDirectory";

export const metadata = { title: "محلات الرعاية والتجهيز" };

export default async function ShopsPage({ searchParams }: { searchParams: Promise<{ city?: string; q?: string }> }) {
  return <ProviderDirectory kind="shop" f={await searchParams} />;
}
