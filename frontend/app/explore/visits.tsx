// Visit & Earn — admin controlled, timer 10s, open URL, complete on return.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, AppState, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { getDeviceId } from "@/src/auth";
import RewardPopup from "@/src/components/RewardPopup";
import { useInterstitial, useRewarded } from "@/src/components/Ads";

export default function VisitsScreen() {
  const router = useRouter();
  const [visits, setVisits] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [timer, setTimer] = useState(0);
  const [popup, setPopup] = useState<{ amount: number; visitId: string } | null>(null);
  const [resetPopup, setResetPopup] = useState(false);
  const timerRef = useRef<any>(null);
  const startedAt = useRef<number>(0);
  const interstitial = useInterstitial();

  const load = useCallback(async () => {
    const did = await getDeviceId();
    setVisits(await api.get(`/explore/visits?device_id=${encodeURIComponent(did)}`));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startVisit = async (v: any) => {
    if (v.completed_today) return;
    try {
      const did = await getDeviceId();
      await api.post("/explore/visits/start", { device_id: did, visit_id: v.id });
      setActive(v); setTimer(10);
      startedAt.current = Date.now();
      Linking.openURL(v.url).catch(() => Alert.alert("Failed", "Could not open URL"));
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
        const left = 10 - elapsed;
        setTimer(Math.max(left, 0));
        if (left <= 0) clearInterval(timerRef.current);
      }, 500);
    } catch (e: any) { Alert.alert("Failed", e.message); }
  };

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && active) {
        clearInterval(timerRef.current);
        const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
        if (elapsed < 10) {
          // came back early — reset
          (async () => {
            try {
              const did = await getDeviceId();
              await api.post("/explore/visits/reset", { device_id: did, visit_id: active.id });
            } catch {}
            setResetPopup(true);
            setActive(null);
            load();
          })();
        } else {
          completeVisit(active);
        }
      }
    });
    return () => sub.remove();
  }, [active]);

  const completeVisit = async (v: any, multiplier = 1.0) => {
    try {
      const did = await getDeviceId();
      const r = await api.post("/explore/visits/complete", { device_id: did, visit_id: v.id, multiplier });
      await interstitial.show();
      setPopup({ amount: r.reward, visitId: v.id });
      setActive(null);
      load();
    } catch (e: any) { Alert.alert("Failed", e.message); setActive(null); }
  };

  const rewarded = useRewarded(() => {
    if (popup) completeVisit({ id: popup.visitId }, 1.5);
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={22} color={colors.textPrimary} /></Pressable>
        <Text style={styles.title}>Visit & Earn</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.intro}>Visit websites for 10 seconds to earn rewards. Resets daily.</Text>
        {visits.map((v) => (
          <View key={v.id} style={styles.row}>
            <View style={[styles.icon, { backgroundColor: "#DBEAFE" }]}><Feather name="external-link" size={20} color="#3B82F6" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{v.title}</Text>
              <Text style={styles.rowSub}>{v.reward_min}-{v.reward_max} pts</Text>
              {v.completed_today ? <Text style={styles.done}>✓ Completed today</Text> : null}
            </View>
            <Pressable
              testID={`visit-start-${v.id}`}
              style={[styles.visitBtn, v.completed_today && { opacity: 0.4 }]}
              onPress={() => startVisit(v)}
              disabled={!!v.completed_today || !!active}
            >
              <Text style={styles.visitText}>{v.completed_today ? "Done" : "Visit"}</Text>
            </Pressable>
          </View>
        ))}
        {active && (
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>Stay on the site for</Text>
            <Text style={styles.timerVal}>{timer}s</Text>
            <Text style={styles.timerHint}>Returning early will reset this task.</Text>
          </View>
        )}
      </ScrollView>

      <RewardPopup
        visible={!!popup}
        amount={popup?.amount || 0}
        title="Visit Complete!"
        onClaim={() => setPopup(null)}
        multiplier={1.5}
        onMultiplier={() => { setPopup(null); rewarded.show(); }}
        multiplierLabel="Watch ad — 1.5× reward"
      />
      <RewardPopup
        visible={resetPopup}
        amount={0}
        title="Visit Reset"
        subtitle="You returned before 10 seconds. Try again."
        onClaim={() => setResetPopup(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  title: { fontFamily: fonts.heading, fontSize: 18 },
  intro: { fontFamily: fonts.body, color: colors.textSecondary, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: colors.surface, borderRadius: radius.image, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fonts.heading, color: colors.textPrimary, fontSize: 14 },
  rowSub: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 12 },
  done: { fontFamily: fonts.heading, color: colors.primary, fontSize: 11, marginTop: 2 },
  visitBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.button, backgroundColor: colors.primary },
  visitText: { color: "#fff", fontFamily: fonts.heading, fontSize: 13 },
  timerCard: { marginTop: spacing.lg, padding: spacing.xl, backgroundColor: colors.surface, borderRadius: radius.card, alignItems: "center", borderWidth: 2, borderColor: colors.primary, ...shadows.medium },
  timerLabel: { fontFamily: fonts.body, color: colors.textSecondary },
  timerVal: { fontFamily: fonts.heading, color: colors.primary, fontSize: 48, marginTop: 8 },
  timerHint: { fontFamily: fonts.regular, color: colors.textTertiary, fontSize: 12, marginTop: 8 },
});
