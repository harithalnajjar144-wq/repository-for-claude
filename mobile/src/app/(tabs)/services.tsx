import { useState } from "react";
import { FlatList, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMeta } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { Provider } from "@/lib/types";
import { ProviderCard } from "@/components/cards";
import { ChipPicker, Empty, ErrorView, Input, Loading, Select } from "@/components/ui";

export default function ServicesScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const { data: meta } = useMeta();
  const [kind, setKind] = useState<"vet" | "shop">(params.kind === "shop" ? "shop" : "vet");
  const [lastParam, setLastParam] = useState(params.kind);
  if (params.kind !== lastParam) {
    setLastParam(params.kind);
    if (params.kind === "shop" || params.kind === "vet") setKind(params.kind);
  }
  const [city, setCity] = useState("");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const q = useQuery({
    queryKey: ["providers", kind, city, term],
    queryFn: () => api<Provider[]>("/providers", { query: { kind, city, q: term } }),
  });
  return (
    <View style={{ flex: 1, backgroundColor: colors.sand }}>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ gap: 10, paddingBottom: 6 }}>
            <ChipPicker
              options={[
                { value: "vet", label: "🩺 الأطباء البيطريون" },
                { value: "shop", label: "🏪 محلات الأعلاف والمستلزمات" },
              ]}
              value={kind}
              onChange={setKind}
            />
            <Input value={search} onChangeText={setSearch} onSubmitEditing={() => setTerm(search.trim())} returnKeyType="search" placeholder={kind === "vet" ? "اسم العيادة أو التخصص" : "اسم المحل"} />
            <Select value={city} allowEmpty="كل المحافظات" options={(meta?.governorates ?? []).map((g) => ({ value: g.key, label: g.label }))} onChange={setCity} />
          </View>
        }
        ListEmptyComponent={q.isLoading ? <Loading full={false} /> : q.error ? <ErrorView error={q.error} onRetry={() => q.refetch()} /> : <Empty icon={kind === "vet" ? "🩺" : "🏪"} title="لا توجد نتائج في هذه المنطقة بعد" />}
        renderItem={({ item }) => <ProviderCard p={item} />}
        refreshing={q.isRefetching}
        onRefresh={() => void q.refetch()}
      />
    </View>
  );
}
