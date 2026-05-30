// Earn tab — horizontal segmented grid: Task | Campaigns | Explore.
import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import TopBar from "@/src/components/TopBar";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { getDeviceId, saveUser } from "@/src/auth";

type Tab = "task" | "campaigns" | "explore";

const EXPLORE_ITEMS = [
  { key: "checkin", title: "Daily Check-in", subtitle: "Up to ₹1 daily", icon: "calendar", color: "#10B981", route: "/explore/checkin" },
  { key: "spin", title: "Spin Wheel", subtitle: "Free spin everyday", icon: "refresh-cw", color: "#F59E0B", route: "/explore/spin" },
  { key: "scratch", title: "Scratch Card", subtitle: "Scratch to win", icon: "credit-card", color: "#8B5CF6", route: "/explore/scratch" },
  { key: "visit", title: "Visit & Earn", subtitle: "Visit websites", icon: "external-link", color: "#3B82F6", route: "/explore/visits" },
  { key: "watch", title: "Watch & Earn", subtitle: "5 tasks daily", icon: "play-circle", color: "#EF4444", route: "/explore/watch" },
  { key: "surveys", title: "Surveys", subtitle: "10 surveys daily", icon: "clipboard", color: "#06B6D4", route: "/explore/surveys" },
  { key: "quizzes", title: "Quizzes", subtitle: "10 quizzes daily", icon: "help-circle", color: "#EC4899", route: "/explore/quizzes" },
];

export default function EarnTab() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("task");
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const did = await getDeviceId();
    try {
      const [me, t, c] = await Promise.all([
        api.get(`/auth/me/${encodeURIComponent(did)}`),
        api.get(`/tasks?device_id=${encodeURIComponent(did)}`),
        api.get(`/campaigns?device_id=${encodeURIComponent(did)}`),
      ]);
      setUser(me); await saveUser(me);
      setTasks(t);
      setCampaigns(c);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // Status priority: not-yet-submitted -> pending -> approved -> rejected; latest first within same bucket
  const statusRank = (s?: string) => (!s ? 0 : s === "pending" ? 1 : s === "approved" ? 2 : s === "rejected" ? 3 : 0);
  const sortByStatusLatest = (arr: any[]) =>
    [...arr].sort((a, b) => {
      const r = statusRank(a.my_status) - statusRank(b.my_status);
      if (r !== 0) return r;
      const ta = new Date(a.submitted_at || a.created_at || 0).getTime();
      const tb = new Date(b.submitted_at || b.created_at || 0).getTime();
      return tb - ta;
    });
  const sortedTasks = sortByStatusLatest(tasks);
  const sortedCampaigns = sortByStatusLatest(campaigns);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <TopBar username={user?.username || "..."} points={user?.points || 0} />
      <View style={styles.headerWrap}>
        <Text style={styles.h1}>High Paying Tasks & Campaigns</Text>
      </View>
      <View style={styles.segRow}>
        {(["task", "campaigns", "explore"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            testID={`earn-tab-${t}`}
            onPress={() => setTab(t)}
            style={[styles.seg, tab === t && styles.segActive]}
          >
            <Text style={[styles.segText, tab === t && styles.segTextActive]}>
              {t === "task" ? "Tasks" : t === "campaigns" ? "Campaigns" : "Explore"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {tab === "task" && sortedTasks.map((t) => (
          <Pressable
            key={t.id}
            testID={`earn-task-${t.id}`}
            style={styles.row}
            onPress={() => router.push(`/tasks/${t.id}` as any)}
          >
            <View style={[styles.rowIcon, { backgroundColor: colors.primaryLight }]}>
              <Feather name="briefcase" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t.title}</Text>
              <Text style={styles.rowSub}>Rules: {t.rules?.slice(0, 60)}{t.rules?.length > 60 ? "..." : ""}</Text>
              {t.my_status ? <StatusBadge status={t.my_status} /> : null}
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowReward}>₹{t.reward}</Text>
              <Feather name="chevron-right" size={20} color={colors.textTertiary} />
            </View>
          </Pressable>
        ))}

        {tab === "campaigns" && sortedCampaigns.map((c) => (
          <Pressable
            key={c.id}
            testID={`earn-campaign-${c.id}`}
            style={styles.row}
            onPress={() => router.push(`/campaigns/${c.id}` as any)}
          >
            <View style={[styles.rowIcon, { backgroundColor: "#FEF3C7" }]}>
              <Feather name="zap" size={22} color={colors.secondaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{c.title}</Text>
              <Text style={styles.rowSub}>{c.rules?.slice(0, 60)}{c.rules?.length > 60 ? "..." : ""}</Text>
              {c.my_status ? <StatusBadge status={c.my_status} /> : null}
            </View>
            <View style={styles.rowRight}>
              {c.external_reward ? <Text style={styles.rowReward}>{c.external_reward}</Text> : null}
              <Feather name="chevron-right" size={20} color={colors.textTertiary} />
            </View>
          </Pressable>
        ))}

        {tab === "explore" && (
          <View style={styles.exploreGrid}>
            {EXPLORE_ITEMS.map((e) => (
              <Pressable
                key={e.key}
                testID={`earn-explore-${e.key}`}
                style={({ pressed }) => [styles.exploreCard, pressed && { opacity: 0.85 }]}
                onPress={() => router.push(e.route as any)}
              >
                <View style={[styles.exploreIcon, { backgroundColor: e.color + "20" }]}>
                  <Feather name={e.icon as any} size={24} color={e.color} />
                </View>
                <Text style={styles.exploreTitle}>{e.title}</Text>
                <Text style={styles.exploreSub}>{e.subtitle}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusBadge({ status }: { status: string }) {
  const bg = status === "approved" ? "#D1FAE5" : status === "rejected" ? "#FEE2E2" : "#FEF3C7";
  const fg = status === "approved" ? colors.primaryDark : status === "rejected" ? colors.error : colors.secondaryDark;
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, marginTop: 6 }}>
      <Text style={{ color: fg, fontFamily: fonts.heading, fontSize: 10, textTransform: "uppercase" }}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  h1: { fontFamily: fonts.heading, fontSize: 22, color: colors.textPrimary, letterSpacing: -0.3 },
  segRow: { flexDirection: "row", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: 8 },
  seg: { flex: 1, paddingVertical: 10, borderRadius: 100, backgroundColor: colors.surfaceVariant, alignItems: "center", justifyContent: "center" },
  segActive: { backgroundColor: colors.primary },
  segText: { fontFamily: fonts.heading, fontSize: 13, color: colors.textSecondary },
  segTextActive: { color: "#fff" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, padding: 14, borderRadius: radius.image,
    borderWidth: 1, borderColor: colors.border, marginBottom: 12, ...shadows.light,
  },
  rowIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fonts.heading, color: colors.textPrimary, fontSize: 14 },
  rowSub: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  rowRight: { alignItems: "flex-end", gap: 4 },
  rowReward: { fontFamily: fonts.heading, color: colors.primary, fontSize: 16 },
  exploreGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  exploreCard: {
    width: "47%", backgroundColor: colors.surface, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.border, padding: 14, ...shadows.light,
  },
  exploreIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  exploreTitle: { fontFamily: fonts.heading, fontSize: 14, color: colors.textPrimary, marginTop: 10 },
  exploreSub: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 },
});
