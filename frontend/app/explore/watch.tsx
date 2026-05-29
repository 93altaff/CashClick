// Watch & Earn — 5 tasks daily, 30s gap between tasks.
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

export default function WatchScreen() {
  const router = useRouter();
  const [info, setInfo] = useState<any>({ completed: 0, total: 5, last_at: null });
  const [popup, setPopup] = useState<{ amount: number; idx: number } | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const interstitial = useInterstitial();
  const adReward = useRewarded(async () => doComplete(info.completed, 1.0));

  const load = async () => {
    const did = await getDeviceId();
    setInfo(await api.get(`/explore/watch?device_id=${encodeURIComponent(did)}`));
  };

  useEffect(() => { load(); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const secondsLeft = () => {
    if (!info.last_at) return 0;
    const t = new Date(info.last_at).getTime();
    return Math.max(0, 30 - Math.floor((now - t) / 1000));
  };

  const startTask = (idx: number) => {
    if (idx !== info.completed) return;
    if (secondsLeft() > 0) return Alert.alert("Wait", `Please wait ${secondsLeft()} seconds before next task`);
    adReward.show();
  };

  const doComplete = async (idx: number, multiplier = 1.0) => {
    try {
      const did = await getDeviceId();
      const r = await api.post("/explore/watch/complete", { device_id: did, task_index: idx, multiplier });
      await interstitial.show();
      setPopup({ amount: r.reward, idx });
      await load();
    } catch (e: any) { Alert.alert("Failed", e.message); }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={22} color={colors.textPrimary} /></Pressable>
        <Text style={styles.title}>Watch & Earn</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.intro}>{info.completed}/{info.total} watched today · 30s gap between tasks</Text>
        {Array.from({ length: info.total }).map((_, i) => {
          const done = i < info.completed;
          const current = i === info.completed;
          const left = current ? secondsLeft() : 0;
          return (
            <View key={i} style={[styles.row, done && { opacity: 0.5 }]}>
              <View style={[styles.icon, { backgroundColor: done ? colors.primaryLight : "#FEE2E2" }]}>
                <Feather name={done ? "check" : "play-circle"} size={22} color={done ? colors.primary : "#EF4444"} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Watch Task #{i + 1}</Text>
                <Text style={styles.rowSub}>10-50 pts</Text>
              </View>
              <Pressable
                testID={`watch-start-${i}`}
                style={[styles.watchBtn, (done || !current || left > 0) && { opacity: 0.4 }]}
                onPress={() => startTask(i)}
                disabled={done || !current || left > 0}
              >
                <Text style={styles.watchText}>{done ? "Done" : current ? (left > 0 ? `${left}s` : "Watch") : "Locked"}</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
      <RewardPopup visible={!!popup} amount={popup?.amount || 0} title="Earned!" onClaim={() => setPopup(null)} />
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
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fonts.heading, color: colors.textPrimary, fontSize: 14 },
  rowSub: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 12 },
  watchBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.button, backgroundColor: colors.primary, minWidth: 80, alignItems: "center" },
  watchText: { color: "#fff", fontFamily: fonts.heading, fontSize: 13 },
});
