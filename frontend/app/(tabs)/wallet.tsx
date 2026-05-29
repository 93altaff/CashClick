// Wallet tab — balance card, transactions with horizontal filter grid.
import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { getDeviceId, saveUser } from "@/src/auth";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "games", label: "Games" },
  { key: "task", label: "Task" },
  { key: "campaigns", label: "Campaigns" },
  { key: "refer", label: "Refer" },
  { key: "explore", label: "Explore" },
];

export default function WalletTab() {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [bal, setBal] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);

  const load = useCallback(async (f = filter) => {
    const did = await getDeviceId();
    try {
      const [me, b, t] = await Promise.all([
        api.get(`/auth/me/${encodeURIComponent(did)}`),
        api.get(`/wallet/balance?device_id=${encodeURIComponent(did)}`),
        api.get(`/wallet/transactions?device_id=${encodeURIComponent(did)}${f !== "all" ? `&kind=${f}` : ""}`),
      ]);
      setUser(me); await saveUser(me);
      setBal(b);
      setTxs(t);
    } catch {}
  }, [filter]);

  useFocusEffect(useCallback(() => { load(filter); }, [filter, load]));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.h1}>Wallet</Text>
        <Text style={styles.sub}>@{user?.username || "..."}</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(filter); setRefreshing(false); }} />}
      >
        <View style={styles.balanceCard} testID="wallet-balance-card">
          <Text style={styles.balLabel}>Total Balance</Text>
          <Text style={styles.balRupee}>₹{bal?.rupees?.toFixed(2) || "0.00"}</Text>
          <Text style={styles.balPts}>{(bal?.points || 0).toLocaleString()} points</Text>
          <Text style={styles.balRate}>{bal?.conversion_rate || 100} pts = ₹1</Text>
          <Pressable testID="wallet-withdraw-btn" style={styles.withdrawBtn} onPress={() => router.push("/withdraw" as any)}>
            <Feather name="arrow-up-right" size={18} color={colors.primaryDark} />
            <Text style={styles.withdrawText}>Withdraw</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Transaction History</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              testID={`wallet-filter-${f.key}`}
              style={[styles.chip, filter === f.key && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: spacing.lg }}>
          {!txs.length ? (
            <View style={styles.empty}><Text style={styles.emptyText}>No transactions yet.</Text></View>
          ) : (
            txs.map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <View style={[styles.txIcon, { backgroundColor: tx.amount_pts >= 0 ? colors.primaryLight : "#FEE2E2" }]}>
                  <Feather name={tx.amount_pts >= 0 ? "arrow-down" : "arrow-up"} size={16} color={tx.amount_pts >= 0 ? colors.primary : colors.error} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txTag}>{tx.tag}</Text>
                  <Text style={styles.txMeta}>{tx.kind} · {new Date(tx.created_at).toLocaleString()}</Text>
                </View>
                <Text style={[styles.txAmount, { color: tx.amount_pts >= 0 ? colors.primary : colors.error }]}>
                  {tx.amount_pts >= 0 ? "+" : ""}{tx.amount_pts}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  h1: { fontFamily: fonts.heading, fontSize: 26, color: colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 13 },
  balanceCard: {
    marginHorizontal: spacing.lg, padding: spacing.xl, backgroundColor: colors.primaryDark,
    borderRadius: radius.card, ...shadows.heavy,
  },
  balLabel: { fontFamily: fonts.body, color: "rgba(255,255,255,0.75)", fontSize: 12, letterSpacing: 1 },
  balRupee: { fontFamily: fonts.heading, color: "#fff", fontSize: 44, marginTop: 8, letterSpacing: -1 },
  balPts: { fontFamily: fonts.body, color: "rgba(255,255,255,0.9)", marginTop: 4 },
  balRate: { fontFamily: fonts.regular, color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 4 },
  withdrawBtn: {
    marginTop: spacing.lg, backgroundColor: "#fff", borderRadius: radius.button, paddingVertical: 14,
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
  },
  withdrawText: { fontFamily: fonts.heading, color: colors.primaryDark, fontSize: 15 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary, paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  filterRow: { paddingHorizontal: spacing.lg, gap: 8, paddingBottom: spacing.md },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.surfaceVariant, borderRadius: 100 },
  chipActive: { backgroundColor: colors.primaryLight },
  chipText: { fontFamily: fonts.body, color: colors.textSecondary, fontSize: 12 },
  chipTextActive: { color: colors.primaryDark, fontFamily: fonts.heading },
  txRow: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
    backgroundColor: colors.surface, borderRadius: radius.image, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  txTag: { fontFamily: fonts.heading, color: colors.textPrimary, fontSize: 13 },
  txMeta: { fontFamily: fonts.regular, color: colors.textTertiary, fontSize: 11, marginTop: 2 },
  txAmount: { fontFamily: fonts.heading, fontSize: 16 },
  empty: { padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.image, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  emptyText: { color: colors.textTertiary, fontFamily: fonts.regular },
});
