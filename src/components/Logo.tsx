import Link from "next/link";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="" className="h-9 w-9" />
      <span className="leading-tight">
        <span className={`block text-xl font-bold ${light ? "text-white" : "text-brand-700"}`}>حلالي</span>
        <span className={`hidden text-[11px] sm:block ${light ? "text-white/70" : "text-ink/50"}`}>سوق المواشي الرقمي</span>
      </span>
    </Link>
  );
}
