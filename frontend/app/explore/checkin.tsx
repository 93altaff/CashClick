// Daily Check-in (30 days, +10 per day up to 100, with multiplier)
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { getDeviceId } from "@/src/auth";
import RewardPopup from "@/src/components/RewardPopup";
import { useInterstitial, useRewarded } from "@/src/components/Ads";

export default function CheckinScreen() {
  const router = useRouter();
  const [info, setInfo] = useState<any>(null);
  const [popup, setPopup] = useState<{ amount: number; multiplier?: number; title?: string; subtitle?: string } | null>(null);
  const interstitial = useInterstitial();

  const load = async () => {
    const did = await getDeviceId();
    try { setInfo(await api.get(`/explore/checkin?device_id=${encodeURIComponent(did)}`)); } catch {}
  };
  useEffect(() => { load(); }, []);

  const claim = async (multiplier = 1.0) => {
    const did = await getDeviceId();
    try {
      const r = await api.post("/explore/checkin/claim", { device_id: did, multiplier });
      const cycled = r.day === 1 && (info?.day || 0) >= 30;
      setPopup({
        amount: r.reward,
        multiplier: 1.2,
        title: cycled ? "🎉 30-Day Streak Complete!" : "Streak Continues!",
        subtitle: cycled ? "Awesome! A new 30-day cycle has begun." : `Day ${r.day} claimed`,
      });
      await load();
    } catch (e: any) { Alert.alert("Failed", e.message); }
  };

  const rewarded = useRewarded(async () => { await claim(1.2); });

  const days = Array.from({ length: 30 }, (_, i) => i + 1);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header title="Daily Check-in" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.streakCard}>
          <Feather name="calendar" size={40} color="#fff" />
          <Text style={styles.streakDay}>Day {info?.day || 0}</Text>
          <Text style={styles.streakHint}>{info?.claimed_today ? "Come back tomorrow!" : `Today's reward: +${info?.next_reward || 10} pts`}</Text>
        </View>

        <View style={styles.grid}>
          {days.map((d) => {
            const claimed = d <= (info?.day || 0);
            const today = d === (info?.next_day || (info?.day || 0) + 1) && !info?.claimed_today;
            const reward = Math.min(10 + (d - 1) * 10, 100);
            return (
              <View key={d} style={[styles.dayBox, claimed && styles.dayClaimed, today && styles.dayToday]}>
                <Text style={[styles.dayNum, claimed && { color: "#fff" }, today && { color: colors.primaryDark }]}>D{d}</Text>
                <Text style={[styles.dayRew, claimed && { color: "rgba(255,255,255,0.85)" }, today && { color: colors.primaryDark }]}>+{reward}</Text>
              </View>
            );
          })}
        </View>

        <Pressable
          testID="checkin-claim-btn"
          style={[styles.claimBtn, info?.claimed_today && { opacity: 0.5 }]}
          onPress={async () => { await interstitial.show(); await claim(); }}
          disabled={info?.claimed_today}
        >
          <Text style={styles.claimText}>{info?.claimed_today ? "Already Claimed" : "Claim Today's Reward"}</Text>
        </Pressable>
        {!info?.claimed_today && (
          <Pressable testID="checkin-multiplier-btn" style={styles.multiBtn} onPress={() => rewarded.show()}>
            <Feather name="play-circle" size={16} color={colors.primaryDark} />
            <Text style={styles.multiText}>Watch ad — 1.2× reward</Text>
          </Pressable>
        )}
      </ScrollView>
      <RewardPopup
        visible={!!popup}
        amount={popup?.amount || 0}
        title={popup?.title || "Streak Continues!"}
        subtitle={popup?.subtitle || "Daily check-in claimed"}
        onClaim={() => setPopup(null)}
      />
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={22} color={colors.textPrimary} /></Pressable>
      <Text style={styles.title}>{title}</Text>
      <View style={{ width: 44 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  title: { fontFamily: fonts.heading, fontSize: 18 },
  streakCard: { backgroundColor: colors.primary, padding: spacing.xl, borderRadius: radius.card, alignItems: "center", ...shadows.heavy },
  streakDay: { fontFamily: fonts.heading, color: "#fff", fontSize: 32, marginTop: 8 },
  streakHint: { fontFamily: fonts.regular, color: "rgba(255,255,255,0.9)", marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.lg },
  dayBox: { width: "18%", aspectRatio: 1, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  dayClaimed: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayToday: { backgroundColor: colors.primaryLight, borderColor: colors.primary, borderWidth: 2 },
  dayNum: { fontFamily: fonts.heading, fontSize: 11, color: colors.textPrimary },
  dayRew: { fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  claimBtn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radius.button, marginTop: spacing.lg, alignItems: "center", ...shadows.heavy },
  claimText: { color: "#fff", fontFamily: fonts.heading, fontSize: 15 },
  multiBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, padding: 12, backgroundColor: colors.primaryLight, borderRadius: radius.button },
  multiText: { color: colors.primaryDark, fontFamily: fonts.heading, fontSize: 13 },
});
