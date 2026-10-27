import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { appRouteFor } from "@/lib/links";
import { colors } from "@/lib/theme";
import type { Notification } from "@/lib/types";
import { AuthGate } from "@/components/AuthGate";
import { Card, Empty, Loading, Screen, T } from "@/components/ui";

export default function Notifications() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}

function Content() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => api<Notification[]>("/me/notifications") });
  const hasUnread = q.data?.some((n) => !n.isRead);
  // Opening the list marks everything as read (after showing the unread state once).
  useEffect(() => {
    if (!hasUnread) return;
    const t = setTimeout(() => {
      api("/me/notifications/read", { method: "POST", body: {} })
        .then(() => qc.invalidateQueries({ queryKey: ["me"] }))
        .catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [hasUnread, qc]);
  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading ? (
        <Loading full={false} />
      ) : !q.data?.length ? (
        <Empty icon="🔔" title="لا توجد إشعارات" />
      ) : (
        <Card style={{ padding: 0 }}>
          {q.data.map((n, i) => (
            <Pressable
              key={n.id}
              onPress={() => router.push(appRouteFor(n.link))}
              style={[{ padding: 12, gap: 2 }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.line }, !n.isRead && { backgroundColor: colors.brand50 }]}
            >
              <View style={{ flexDirection: "row", gap: 6 }}>
                {!n.isRead && <T color={colors.brand600}>●</T>}
                <T w={n.isRead ? "regular" : "semibold"} style={{ flex: 1 }}>
                  {n.title}
                </T>
              </View>
              {n.body && (
                <T size={13} color={colors.muted}>
                  {n.body}
                </T>
              )}
              <T size={11} color={colors.faint}>
                {timeAgo(n.createdAt)}
              </T>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}
