import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink/60">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon = "🐑", title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="text-4xl">{icon}</div>
      <p className="font-semibold">{title}</p>
      {children && <div className="text-sm text-ink/60">{children}</div>}
    </div>
  );
}

const tones = {
  green: "bg-brand-50 text-brand-700 ring-1 ring-brand-200",
  earth: "bg-earth-50 text-earth-700 ring-1 ring-earth-200",
  gray: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
  red: "bg-red-50 text-red-700 ring-1 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  amber: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
} as const;

export function Badge({ tone = "gray", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

export function VerifiedBadge({ status }: { status: string }) {
  if (status !== "verified") return null;
  return (
    <span title="حساب موثق" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M12 2l2.4 2.2 3.2-.4.9 3.1 2.9 1.5-1 3.1 1 3.1-2.9 1.5-.9 3.1-3.2-.4L12 22l-2.4-2.2-3.2.4-.9-3.1-2.9-1.5 1-3.1-1-3.1 2.9-1.5.9-3.1 3.2.4z" />
        <path d="M10.5 15.2l-3-3 1.4-1.4 1.6 1.6 4.6-4.6 1.4 1.4z" fill="white" />
      </svg>
      موثق
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-ink/55">{label}</div>
      <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink/50">{hint}</div>}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  makeHref,
}: {
  page: number;
  totalPages: number;
  makeHref: (p: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="التنقل بين الصفحات">
      {page > 1 && (
        <Link className="btn-outline" href={makeHref(page - 1)}>
          السابق
        </Link>
      )}
      <span className="px-3 text-sm text-ink/60">
        صفحة {page} من {totalPages}
      </span>
      {page < totalPages && (
        <Link className="btn-outline" href={makeHref(page + 1)}>
          التالي
        </Link>
      )}
    </nav>
  );
}

export function Notice({ tone = "earth", children }: { tone?: "earth" | "green" | "red" | "blue"; children: ReactNode }) {
  const c = {
    earth: "border-earth-200 bg-earth-50 text-earth-700",
    green: "border-brand-200 bg-brand-50 text-brand-800",
    red: "border-red-200 bg-red-50 text-red-800",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
  }[tone];
  return <div className={`rounded-xl border px-4 py-3 text-sm ${c}`}>{children}</div>;
}
