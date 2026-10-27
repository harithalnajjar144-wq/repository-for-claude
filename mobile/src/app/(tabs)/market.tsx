import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { apiRaw } from "@/lib/api";
import { toInt } from "@/lib/format";
import { useMeta } from "@/lib/meta";
import { colors } from "@/lib/theme";
import type { Listing } from "@/lib/types";
import { ListingCard } from "@/components/cards";
import { Button, Chip, ChipPicker, Empty, ErrorView, Field, Input, Loading, Row, Select, Switch, T, styles } from "@/components/ui";

type Filters = { q: string; category: string; city: string; type: string; minPrice: string; maxPrice: string; sort: string; verified: boolean };
const EMPTY: Filters = { q: "", category: "", city: "", type: "", minPrice: "", maxPrice: "", sort: "", verified: false };

export default function MarketScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const { data: meta } = useMeta();
  const [f, setF] = useState<Filters>({ ...EMPTY, category: params.category ?? "" });
  const [draft, setDraft] = useState<Filters>(f);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  // Follow category links from the home screen.
  const [lastParam, setLastParam] = useState(params.category);
  if (params.category !== lastParam) {
    setLastParam(params.category);
    setF((x) => ({ ...x, category: params.category ?? "" }));
  }

  const query = useMemo(
    () => ({
      q: f.q,
      category: f.category,
      city: f.city,
      type: f.type,
      minPrice: f.minPrice,
      maxPrice: f.maxPrice,
      sort: f.sort,
      verified: f.verified ? "1" : "",
    }),
    [f],
  );
  const q = useInfiniteQuery({
    queryKey: ["listings", query],
    queryFn: ({ pageParam }) => apiRaw<Listing[]>("/listings", { query: { ...query, page: pageParam } }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page && last.totalPages && last.page < last.totalPages ? last.page + 1 : undefined),
  });
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;
  const activeFilters = [f.city, f.type, f.minPrice, f.maxPrice, f.sort, f.verified ? "1" : ""].filter(Boolean).length;

  const header = (
    <View style={{ gap: 10, paddingBottom: 10 }}>
      <Row>
        <Input
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => setF((x) => ({ ...x, q: search.trim() }))}
          returnKeyType="search"
          placeholder="ابحث عن سلالة أو عنوان…"
          style={{ flex: 1 }}
        />
        <Button
          title={activeFilters ? `فلترة (${activeFilters})` : "فلترة"}
          variant="outline"
          onPress={() => {
            setDraft(f);
            setOpen(true);
          }}
        />
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label="الكل" selected={!f.category} onPress={() => setF((x) => ({ ...x, category: "" }))} />
        {meta?.animalCategories.map((c) => (
          <Chip key={c.key} label={`${c.icon} ${c.label}`} selected={f.category === c.key} onPress={() => setF((x) => ({ ...x, category: c.key }))} />
        ))}
      </ScrollView>
      <T size={13} color={colors.muted}>
        {total} إعلان
      </T>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.sand }}>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorView error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(l) => String(l.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <Empty title="لا توجد إعلانات مطابقة">
              <T color={colors.muted} center>
                جرّب توسيع البحث أو أضف طلب شراء ليصلك البائعون.
              </T>
            </Empty>
          }
          renderItem={({ item }) => (
            <View style={{ flex: 1, maxWidth: "50%" }}>
              <ListingCard l={item} />
            </View>
          )}
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          onEndReachedThreshold={0.4}
          refreshing={q.isRefetching && !q.isFetchingNextPage}
          onRefresh={() => void q.refetch()}
          ListFooterComponent={q.isFetchingNextPage ? <Loading full={false} /> : undefined}
        />
      )}
      <Pressable
        accessibilityLabel="أضف إعلان"
        onPress={() => router.push("/listing/new")}
        style={{ position: "absolute", bottom: 20, end: 20, backgroundColor: colors.brand600, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 12, elevation: 4 }}
      >
        <T color={colors.white} w="bold">
          + أضف إعلان
        </T>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { maxHeight: "85%" }]}>
          <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
            <T w="bold" size={18}>
              فلترة النتائج
            </T>
            <Select
              label="المحافظة"
              value={draft.city}
              allowEmpty="كل العراق"
              options={(meta?.governorates ?? []).map((g) => ({ value: g.key, label: g.label }))}
              onChange={(city) => setDraft({ ...draft, city })}
            />
            <Field label="نوع الإعلان">
              <ChipPicker
                options={[
                  { value: "", label: "الكل" },
                  { value: "offer", label: "للبيع" },
                  { value: "wanted", label: "مطلوب" },
                ]}
                value={draft.type}
                onChange={(type) => setDraft({ ...draft, type })}
              />
            </Field>
            <Field label="السعر (د.ع)">
              <Row>
                <Input style={{ flex: 1 }} placeholder="من" keyboardType="number-pad" value={draft.minPrice} onChangeText={(v) => setDraft({ ...draft, minPrice: String(toInt(v) ?? "") })} />
                <Input style={{ flex: 1 }} placeholder="إلى" keyboardType="number-pad" value={draft.maxPrice} onChangeText={(v) => setDraft({ ...draft, maxPrice: String(toInt(v) ?? "") })} />
              </Row>
            </Field>
            <Field label="الترتيب">
              <ChipPicker
                options={[
                  { value: "", label: "الأحدث" },
                  { value: "price_asc", label: "الأرخص" },
                  { value: "price_desc", label: "الأغلى" },
                  { value: "popular", label: "الأكثر مشاهدة" },
                ]}
                value={draft.sort}
                onChange={(sort) => setDraft({ ...draft, sort })}
              />
            </Field>
            <Switch label="البائعون الموثقون فقط" value={draft.verified} onChange={(verified) => setDraft({ ...draft, verified })} />
            <Row>
              <Button
                title="تطبيق"
                style={{ flex: 1 }}
                onPress={() => {
                  setF({ ...draft, q: f.q });
                  setOpen(false);
                }}
              />
              <Button
                title="مسح"
                variant="outline"
                onPress={() => {
                  setDraft({ ...EMPTY, category: f.category, q: f.q });
                }}
              />
            </Row>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
