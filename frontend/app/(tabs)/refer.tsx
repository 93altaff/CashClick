// Refer tab — refer & earn screen with rules, code, history.
import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Share, ImageBackground, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { getDeviceId } from "@/src/auth";

export default function ReferTab() {
  const [info, setInfo] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const did = await getDeviceId();
    try {
      const r = await api.get(`/refer/info?device_id=${encodeURIComponent(did)}`);
      setInfo(r);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onShare = async () => {
    if (!info) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    Share.share({
      message: `🎉 Join me on CashClick & earn rewards!\nUse my referral code: ${info.code}\nDownload now and start earning ₹ for playing games & tasks.`,
    });
  };

  const rules = info?.rules || {};
  const modes: string[] = rules.qualify_modes || [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <ImageBackground
          source={{ uri: "https://images.pexels.com/photos/4303031/pexels-photo-4303031.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" }}
          imageStyle={{ borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
          style={styles.hero}
        >
          <View style={styles.heroOverlay} />
          <Feather name="gift" size={48} color="#fff" />
          <Text style={styles.heroTitle}>Refer & Earn</Text>
          <Text style={styles.heroSub}>Invite friends. Earn rewards.</Text>
          <Text style={styles.bigReward}>₹{Math.round((rules.refer_reward || 0) / (rules.conversion_rate || 100))} <Text style={styles.bigRewardUnit}>per referral</Text></Text>
        </ImageBackground>

        <View style={styles.codeCard}>
          <Text style={styles.label}>YOUR REFERRAL CODE</Text>
          <View style={styles.codeRow}>
            <Text style={styles.code} testID="refer-code">{info?.code || "..."}</Text>
            <Pressable testID="refer-share-btn" onPress={onShare} style={styles.shareBtn}>
              <Feather name="share-2" size={16} color="#fff" />
              <Text style={styles.shareText}>Share</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatBox label="Friends" value={info?.total_referrals || 0} icon="users" />
          <StatBox label="Earned" value={`${info?.total_earned_pts || 0} pts`} icon="award" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to qualify</Text>
          <View style={styles.ruleCard}>
            {modes.includes("points") && (
              <Rule icon="zap" text={`Friend earns ${rules.qualify_points} points`} />
            )}
            {modes.includes("withdraw") && (
              <Rule icon="credit-card" text="Friend's first successful withdrawal" />
            )}
            {modes.includes("checkin") && (
              <Rule icon="calendar" text="Friend continues daily check-in streak" />
            )}
            {modes.length === 0 && <Text style={styles.ruleText}>Configured by admin.</Text>}
            <Text style={styles.bonusNote}>
              You earn {rules.refer_reward || 50} pts (≈ ₹{Math.round((rules.refer_reward || 50) / (rules.conversion_rate || 100))}) per qualified referral.
            </Text>
          </View>
        </View>

        {modes.includes("checkin") && rules.checkin_rewards && Object.keys(rules.checkin_rewards).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Streak bonuses</Text>
            <View style={styles.streakWrap}>
              {Object.entries(rules.checkin_rewards as Record<string, number>).map(([day, rupees]) => (
                <View key={day} style={styles.streakPill}>
                  <Text style={styles.streakDay}>Day {day}</Text>
                  <Text style={styles.streakRupee}>₹{rupees}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Referral History</Text>
          {!info?.history?.length ? (
            <View style={styles.empty}><Text style={styles.emptyText}>No referrals yet. Share your code!</Text></View>
          ) : (
            info.history.map((h: any) => (
              <View key={h.username} style={styles.historyRow}>
                <View style={[styles.rowIcon, { backgroundColor: colors.primaryLight }]}>
                  <Feather name="user" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyName}>@{h.username}</Text>
                  <Text style={styles.historyDate}>Joined {new Date(h.joined_at).toLocaleDateString()}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: h.qualified ? "#D1FAE5" : "#FEF3C7" }]}>
                  <Text style={{ color: h.qualified ? colors.primaryDark : colors.secondaryDark, fontFamily: fonts.heading, fontSize: 10 }}>
                    {h.qualified ? "QUALIFIED" : "PENDING"}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Rule({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.ruleRow}>
      <Feather name={icon} size={16} color={colors.primary} />
      <Text style={styles.ruleText}>{text}</Text>
    </View>
  );
}

function StatBox({ label, value, icon }: { label: string; value: any; icon: any }) {
  return (
    <View style={styles.statBox}>
      <Feather name={icon} size={20} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hero: {
    paddingTop: spacing.xl, paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg,
    alignItems: "center", overflow: "hidden",
  },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5, 150, 105, 0.85)", borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTitle: { fontFamily: fonts.heading, color: "#fff", fontSize: 28, marginTop: 12, letterSpacing: -0.5 },
  heroSub: { fontFamily: fonts.regular, color: "rgba(255,255,255,0.9)", marginTop: 4 },
  bigReward: { fontFamily: fonts.heading, color: "#fff", fontSize: 36, marginTop: 16, letterSpacing: -1 },
  bigRewardUnit: { fontSize: 14, color: "rgba(255,255,255,0.85)" },
  codeCard: {
    marginHorizontal: spacing.lg, marginTop: -28, padding: spacing.lg,
    backgroundColor: colors.surface, borderRadius: radius.card, ...shadows.medium,
  },
  label: { fontFamily: fonts.heading, fontSize: 11, color: colors.textTertiary, letterSpacing: 1 },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  code: { fontFamily: fonts.heading, fontSize: 24, color: colors.textPrimary, letterSpacing: 0.5 },
  shareBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.button, flexDirection: "row", alignItems: "center", gap: 6 },
  shareText: { color: "#fff", fontFamily: fonts.heading, fontSize: 13 },
  statsRow: { flexDirection: "row", gap: 12, marginHorizontal: spacing.lg, marginTop: spacing.md },
  statBox: { flex: 1, backgroundColor: colors.surface, padding: 16, borderRadius: radius.image, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  statValue: { fontFamily: fonts.heading, fontSize: 20, color: colors.textPrimary, marginTop: 6 },
  statLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.md, letterSpacing: -0.3 },
  ruleCard: { backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 12 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ruleText: { fontFamily: fonts.body, fontSize: 13, color: colors.textPrimary, flex: 1 },
  bonusNote: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 12, marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  streakWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  streakPill: { backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: colors.border, flexDirection: "row", gap: 6, alignItems: "center" },
  streakDay: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary },
  streakRupee: { fontFamily: fonts.heading, fontSize: 13, color: colors.primary },
  empty: { padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.image, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  emptyText: { color: colors.textTertiary, fontFamily: fonts.regular },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, padding: 14, borderRadius: radius.image, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  historyName: { fontFamily: fonts.heading, fontSize: 14, color: colors.textPrimary },
  historyDate: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
});
