import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Meta } from "./types";

export function useMeta() {
  return useQuery({ queryKey: ["meta"], queryFn: () => api<Meta>("/meta"), staleTime: 60 * 60_000 });
}

export function labelOf(list: { key: string; label: string }[] | undefined, key: string | null | undefined) {
  return list?.find((x) => x.key === key)?.label ?? key ?? "";
}

export function useLabels() {
  const { data: meta } = useMeta();
  return {
    meta,
    city: (k?: string | null) => labelOf(meta?.governorates, k),
    category: (k?: string | null) => labelOf(meta?.animalCategories, k),
    icon: (k?: string | null) => meta?.animalCategories.find((c) => c.key === k)?.icon ?? "🐾",
    productCategory: (k?: string | null) => labelOf(meta?.productCategories, k),
  };
}
