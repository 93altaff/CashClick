// Admin dashboard with stat cards and Manage grid.
import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { clearAdminToken, loadAdminToken } from "@/src/auth";

const MANAGE_ITEMS = [
  { key: "users", title: "Users", icon: "users", color: "#3B82F6" },
  { key: "withdrawals", title: "Withdrawals", icon: "credit-card", color: "#EF4444" },
  { key: "task_subs", title: "Task Requests", icon: "inbox", color: "#F59E0B" },
  { key: "tasks", title: "Tasks", icon: "briefcase", color: "#10B981" },
  { key: "campaigns", title: "Campaigns", icon: "zap", color: "#EC4899" },
  { key: "banners", title: "Banners", icon: "image", color: "#06B6D4" },
  { key: "visits", title: "Visit & Earn", icon: "external-link", color: "#8B5CF6" },
  { key: "config", title: "Withdraw / Refer / Admob", icon: "settings", color: "#84CC16" },
  { key: "games_config", title: "Games Config", icon: "play", color: "#F97316" },
  { key: "quick_access", title: "Quick Access", icon: "link", color: "#14B8A6" },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const tok = await loadAdminToken();
    if (!tok) { router.replace("/admin/login"); return; }
    try { setStats(await api.get("/admin/dashboard", tok)); }
    catch { await clearAdminToken(); router.replace("/admin/login"); }
  }, [router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/(tabs)/profile")} style={styles.backBtn}><Feather name="arrow-left" size={22} color={colors.textPrimary} /></Pressable>
        <Text style={styles.title}>Admin Dashboard</Text>
        <Pressable onPress={async () => { await clearAdminToken(); router.replace("/admin/login"); }} style={styles.backBtn}>
          <Feather name="log-out" size={20} color={colors.error} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          <Stat label="Total Users" value={stats?.total_users || 0} icon="users" color="#3B82F6" onPress={() => router.push("/admin/manage/users" as any)} />
          <Stat label="Active (7d)" value={stats?.active_users || 0} icon="activity" color="#10B981" onPress={() => router.push("/admin/manage/active_users" as any)} />
          <Stat label="Paid (₹)" value={stats?.paid_withdrawal_amount || 0} icon="check-circle" color="#059669" onPress={() => router.push("/admin/manage/withdrawals?status=paid" as any)} />
          <Stat label="Pending (₹)" value={stats?.pending_withdrawal_amount || 0} icon="clock" color="#F59E0B" onPress={() => router.push("/admin/manage/withdrawals?status=pending" as any)} />
          <Stat label="Task Requests" value={stats?.task_requests || 0} icon="inbox" color="#EC4899" onPress={() => router.push("/admin/manage/task_subs" as any)} />
          <Stat label="Pending Withdraws" value={stats?.pending_withdrawals || 0} icon="credit-card" color="#EF4444" onPress={() => router.push("/admin/manage/withdrawals" as any)} />
        </View>

        <Text style={styles.sectionTitle}>Manage</Text>
        <View style={styles.manageGrid}>
          {MANAGE_ITEMS.map((m) => (
            <Pressable
              key={m.key}
              testID={`admin-manage-${m.key}`}
              style={styles.mCard}
              onPress={() => router.push(`/admin/manage/${m.key}` as any)}
            >
              <View style={[styles.mIcon, { backgroundColor: m.color + "20" }]}>
                <Feather name={m.icon as any} size={20} color={m.color} />
              </View>
              <Text style={styles.mTitle}>{m.title}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, icon, color, onPress }: { label: string; value: number; icon: any; color: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.statCard} onPress={onPress}>
      <View style={[styles.mIcon, { backgroundColor: color + "20" }]}><Feather name={icon} size={20} color={color} /></View>
      <Text style={styles.statValue}>{typeof value === "number" ? value.toLocaleString() : value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  title: { fontFamily: fonts.heading, fontSize: 18 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.md, marginTop: spacing.md, textTransform: "uppercase", letterSpacing: 0.5 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  statCard: { width: "31%", backgroundColor: colors.surface, padding: 12, borderRadius: radius.image, borderWidth: 1, borderColor: colors.border, alignItems: "center", ...shadows.light },
  statValue: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary, marginTop: 8 },
  statLabel: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary, marginTop: 2, textAlign: "center" },
  manageGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  mCard: { width: "47%", backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.image, borderWidth: 1, borderColor: colors.border, gap: 10 },
  mIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  mTitle: { fontFamily: fonts.heading, fontSize: 14, color: colors.textPrimary },
});
