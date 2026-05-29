// Spin wheel — daily 1 spin, 10-20 pts random.
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { getDeviceId } from "@/src/auth";
import RewardPopup from "@/src/components/RewardPopup";
import { useInterstitial, useRewarded } from "@/src/components/Ads";

export default function SpinScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<any>(null);
  const [spinning, setSpinning] = useState(false);
  const [popup, setPopup] = useState<{ amount: number } | null>(null);
  const spin = useRef(new Animated.Value(0)).current;
  const interstitial = useInterstitial();

  const load = async () => {
    const did = await getDeviceId();
    setStatus(await api.get(`/explore/spin?device_id=${encodeURIComponent(did)}`));
  };
  useEffect(() => { load(); }, []);

  const claim = async (multiplier = 1.0) => {
    setSpinning(true);
    Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => spin.setValue(0));
    try {
      const did = await getDeviceId();
      const r = await api.post("/explore/spin/claim", { device_id: did, multiplier });
      setTimeout(() => { setPopup({ amount: r.reward }); }, 1800);
      await load();
    } catch (e: any) { Alert.alert("Failed", e.message); }
    finally { setTimeout(() => setSpinning(false), 1800); }
  };

  const rewarded = useRewarded(() => claim(2.0));

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "1800deg"] });
  const SECTORS = ["#10B981", "#F59E0B", "#3B82F6", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={22} color={colors.textPrimary} /></Pressable>
        <Text style={styles.title}>Daily Spin</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.body}>
        <Text style={styles.intro}>Spin the wheel — win 10-20 points daily!</Text>
        <View style={styles.wheelWrap}>
          <Animated.View style={[styles.wheel, { transform: [{ rotate }] }]}>
            {SECTORS.map((c, i) => (
              <View
                key={i}
                style={[
                  styles.sector,
                  { backgroundColor: c, transform: [{ rotate: `${(360 / SECTORS.length) * i}deg` }] },
                ]}
              />
            ))}
            <View style={styles.wheelCenter}><Feather name="award" size={28} color={colors.secondary} /></View>
          </Animated.View>
          <View style={styles.pointer} />
        </View>

        <Pressable
          testID="spin-claim-btn"
          style={[styles.spinBtn, (spinning || status?.claimed_today) && { opacity: 0.5 }]}
          onPress={async () => { await interstitial.show(); claim(); }}
          disabled={spinning || status?.claimed_today}
        >
          <Text style={styles.spinText}>{status?.claimed_today ? "Already Spun" : spinning ? "Spinning..." : "Spin Now"}</Text>
        </Pressable>
        {!status?.claimed_today && !spinning && (
          <Pressable testID="spin-multi-btn" style={styles.multiBtn} onPress={() => rewarded.show()}>
            <Feather name="play-circle" size={16} color={colors.primaryDark} />
            <Text style={styles.multiText}>Watch ad — 2× reward</Text>
          </Pressable>
        )}
      </View>
      <RewardPopup visible={!!popup} amount={popup?.amount || 0} title="Lucky Spin!" onClaim={() => setPopup(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  title: { fontFamily: fonts.heading, fontSize: 18 },
  body: { padding: spacing.lg, alignItems: "center" },
  intro: { fontFamily: fonts.body, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: "center" },
  wheelWrap: { width: 280, height: 280, alignItems: "center", justifyContent: "center" },
  wheel: { width: 260, height: 260, borderRadius: 130, backgroundColor: "#fff", overflow: "hidden", justifyContent: "center", alignItems: "center", ...shadows.heavy, borderWidth: 8, borderColor: colors.secondary },
  sector: { position: "absolute", left: "50%", top: 0, width: "50%", height: "50%", transformOrigin: "0% 100%" },
  wheelCenter: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", zIndex: 2, ...shadows.medium },
  pointer: { position: "absolute", top: -10, width: 0, height: 0, borderLeftWidth: 14, borderRightWidth: 14, borderTopWidth: 24, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: colors.secondary, zIndex: 3 },
  spinBtn: { backgroundColor: colors.primary, paddingVertical: 16, paddingHorizontal: 48, borderRadius: radius.button, marginTop: spacing.xl, ...shadows.heavy },
  spinText: { color: "#fff", fontFamily: fonts.heading, fontSize: 15 },
  multiBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, padding: 12, backgroundColor: colors.primaryLight, borderRadius: radius.button, paddingHorizontal: 16 },
  multiText: { color: colors.primaryDark, fontFamily: fonts.heading, fontSize: 13 },
});
