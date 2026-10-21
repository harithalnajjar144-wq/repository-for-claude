import { listProviders } from "@/lib/queries";
import { GOVERNORATES } from "@/lib/constants";
import { ProviderCard } from "./cards";
import { EmptyState, PageHeader } from "./ui";
import Link from "next/link";

export async function ProviderDirectory({ kind, f }: { kind: "vet" | "shop"; f: { city?: string; q?: string } }) {
  const rows = await listProviders(kind, f);
  const isVet = kind === "vet";
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader
        title={isVet ? "الأطباء والعيادات البيطرية" : "محلات الرعاية والتجهيز"}
        subtitle={isVet ? "احجز موعداً أو زيارة منزلية مع طبيب بيطري في محافظتك." : "أعلاف، أدوية، مكملات ومستلزمات الحيوانات الأليفة والمواشي."}
        actions={<Link href={`/register?role=${kind}`} className="btn-outline">{isVet ? "أنت طبيب بيطري؟ انضم" : "لديك محل؟ انضم"}</Link>}
      />
      <form className="card mb-6 flex flex-wrap gap-2 p-3">
        <input name="q" defaultValue={f.q} placeholder={isVet ? "اسم العيادة أو التخصص" : "اسم المحل"} className="input flex-1 min-w-48" />
        <select name="city" defaultValue={f.city ?? ""} className="input w-auto">
          <option value="">كل المحافظات</option>
          {GOVERNORATES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
        <button className="btn-primary">بحث</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState icon={isVet ? "🩺" : "🏪"} title="لا توجد نتائج في هذه المنطقة بعد" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => <ProviderCard key={r.p.id} p={r.p} verified={r.verificationStatus} />)}
        </div>
      )}
    </div>
  );
}
