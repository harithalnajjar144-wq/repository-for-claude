"use client";

import { useState } from "react";

export function Gallery({ images, fallback }: { images: string[]; fallback: React.ReactNode }) {
  const [i, setI] = useState(0);
  if (!images.length) return <div className="card aspect-[4/3] overflow-hidden">{fallback}</div>;
  return (
    <div>
      <div className="card relative aspect-[4/3] overflow-hidden bg-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[i]} alt="" className="h-full w-full object-contain" />
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => setI((i - 1 + images.length) % images.length)} className="absolute start-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 px-3 py-1.5 shadow" aria-label="السابق">›</button>
            <button type="button" onClick={() => setI((i + 1) % images.length)} className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 px-3 py-1.5 shadow" aria-label="التالي">‹</button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((src, idx) => (
            <button key={src} type="button" onClick={() => setI(idx)} className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg ring-2 ${idx === i ? "ring-brand-500" : "ring-transparent"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
