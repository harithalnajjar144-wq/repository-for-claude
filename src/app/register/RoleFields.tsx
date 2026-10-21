"use client";

import { useState } from "react";

const ROLES = [
  { key: "user", icon: "🛒", title: "مستخدم", desc: "تصفح، شراء، ودخول المزادات" },
  { key: "trader", icon: "🐑", title: "تاجر / مربي", desc: "انشر إعلانات وافتح مزادات" },
  { key: "vet", icon: "🩺", title: "طبيب بيطري", desc: "اعرض خدماتك واستقبل الحجوزات" },
  { key: "shop", icon: "🏪", title: "محل رعاية وتجهيز", desc: "اعرض الأعلاف والمستلزمات" },
];

export function RoleFields({ initial = "user" }: { initial?: string }) {
  const [role, setRole] = useState(initial);
  return (
    <>
      <fieldset>
        <legend className="label">نوع الحساب</legend>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <label
              key={r.key}
              className={`cursor-pointer rounded-xl border p-3 transition ${
                role === r.key ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-earth-200 hover:border-brand-300"
              }`}
            >
              <input type="radio" name="role" value={r.key} checked={role === r.key} onChange={() => setRole(r.key)} className="sr-only" />
              <div className="text-xl">{r.icon}</div>
              <div className="mt-1 text-sm font-semibold">{r.title}</div>
              <div className="text-xs text-ink/55">{r.desc}</div>
            </label>
          ))}
        </div>
      </fieldset>
      {(role === "vet" || role === "shop") && (
        <label className="block">
          <span className="label">{role === "vet" ? "اسم العيادة أو الطبيب" : "اسم المحل"}</span>
          <input name="businessName" className="input" required maxLength={160} />
        </label>
      )}
    </>
  );
}
