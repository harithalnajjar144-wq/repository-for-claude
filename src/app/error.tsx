"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const msg = error.message && !error.digest ? error.message : "حدث خطأ غير متوقع.";
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="text-5xl">⚠️</div>
      <h1 className="mt-4 text-xl font-bold">{msg}</h1>
      <button onClick={reset} className="btn-primary mt-6">حاول مرة أخرى</button>
    </div>
  );
}
