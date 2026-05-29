// Leaderboard modal — today's top players for a game.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { api } from "@/src/api";

type Props = {
  visible: boolean;
  gameId: string;
  gameName: string;
  gameColor: string;
  onClose: () => void;
};

export default function LeaderboardModal({ visible, gameId, gameName, gameColor, onClose }: Props) {
  const [period, setPeriod] = useState<"today" | "all">("today");
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !gameId) return;
    setLoading(true);
    api.get(`/games/${encodeURIComponent(gameId)}/leaderboard?period=${period}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [visible, gameId, period]);

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={[styles.header, { backgroundColor: gameColor }]}>
            <Feather name="award" size={22} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Leaderboard</Text>
              <Text style={styles.subtitle}>{gameName}</Text>
            </View>
            <Pressable testID="lb-close" onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.tabs}>
            {(["today", "all"] as const).map((p) => (
              <Pressable
                key={p}
                testID={`lb-${p}`}
                style={[styles.tab, period === p && styles.tabActive]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[styles.tabText, period === p && styles.tabTextActive]}>{p === "today" ? "Today" : "All Time"}</Text>
              </Pressable>
            ))}
          </View>

          {loading ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
          ) : !data?.leaderboard?.length ? (
            <View style={styles.center}>
              <Feather name="users" size={32} color={colors.textTertiary} />
              <Text style={styles.empty}>No scores yet — be the first!</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
              {data.leaderboard.map((row: any, i: number) => (
                <View key={`${row.username}-${i}`} style={[styles.row, i < 3 && styles.rowTop]}>
                  <View style={[styles.rank, i === 0 && styles.gold, i === 1 && styles.silver, i === 2 && styles.bronze]}>
                    <Text style={[styles.rankText, i < 3 && { color: "#fff" }]}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.uname}>@{row.username}</Text>
                    <Text style={styles.meta}>{row.plays} {row.plays === 1 ? "play" : "plays"}</Text>
                  </View>
                  <Text style={styles.pts}>{row.total_pts} <Text style={styles.ptsUnit}>pts</Text></Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85%", minHeight: 360, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontFamily: fonts.heading, color: "#fff", fontSize: 18 },
  subtitle: { fontFamily: fonts.regular, color: "rgba(255,255,255,0.9)", fontSize: 12, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.2)" },
  tabs: { flexDirection: "row", gap: 8, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 100, backgroundColor: colors.surfaceVariant, alignItems: "center" },
  tabActive: { backgroundColor: colors.primaryLight },
  tabText: { fontFamily: fonts.body, color: colors.textSecondary, fontSize: 13 },
  tabTextActive: { color: colors.primaryDark, fontFamily: fonts.heading },
  center: { padding: spacing.xxl, alignItems: "center", gap: 8 },
  empty: { fontFamily: fonts.regular, color: colors.textSecondary },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.image, backgroundColor: colors.surfaceVariant, marginBottom: 8 },
  rowTop: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadows.light },
  rank: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceVariant, alignItems: "center", justifyContent: "center" },
  gold: { backgroundColor: "#F59E0B" },
  silver: { backgroundColor: "#9CA3AF" },
  bronze: { backgroundColor: "#B45309" },
  rankText: { fontFamily: fonts.heading, color: colors.textPrimary, fontSize: 14 },
  uname: { fontFamily: fonts.heading, color: colors.textPrimary, fontSize: 14 },
  meta: { fontFamily: fonts.regular, color: colors.textTertiary, fontSize: 11, marginTop: 2 },
  pts: { fontFamily: fonts.heading, color: colors.primary, fontSize: 18 },
  ptsUnit: { color: colors.textSecondary, fontSize: 11 },
});
