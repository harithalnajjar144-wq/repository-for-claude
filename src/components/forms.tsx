"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/errors";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p className="mt-3 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText = "جارٍ الحفظ…",
  confirm,
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink/50">{hint}</span>}
    </label>
  );
}

/** Multi-image picker with local previews. */
export function ImagePicker({
  name = "images",
  max = 8,
  label = "الصور",
  existing = [],
}: {
  name?: string;
  max?: number;
  label?: string;
  existing?: string[];
}) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [kept, setKept] = useState<string[]>(existing);
  return (
    <div>
      <span className="label">{label}</span>
      {kept.map((u) => (
        <input key={u} type="hidden" name="keepImages" value={u} />
      ))}
      <div className="flex flex-wrap gap-2">
        {kept.map((u) => (
          <div key={u} className="relative h-20 w-20 overflow-hidden rounded-xl border border-earth-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setKept(kept.filter((x) => x !== u))}
              className="absolute end-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
              aria-label="حذف الصورة"
            >
              ×
            </button>
          </div>
        ))}
        {previews.map((u) => (
          <div key={u} className="h-20 w-20 overflow-hidden rounded-xl border border-brand-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
        <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-earth-200 text-xs text-ink/50 hover:border-brand-400 hover:text-brand-600">
          <span className="text-2xl leading-none">+</span>
          إضافة
          <input
            type="file"
            name={name}
            accept="image/jpeg,image/png,image/webp"
            multiple={max > 1}
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []).slice(0, Math.max(0, max - kept.length));
              setPreviews(files.map((f) => URL.createObjectURL(f)));
            }}
          />
        </label>
      </div>
      <span className="mt-1 block text-xs text-ink/50">حتى {max} صور، JPG أو PNG أو WEBP بحجم أقل من 6 ميغابايت.</span>
    </div>
  );
}
