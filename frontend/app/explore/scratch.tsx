// Scratch card — daily 1 manual scratch; grid of overlay tiles reveals on touch.
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { getDeviceId } from "@/src/auth";
import RewardPopup from "@/src/components/RewardPopup";
import { useInterstitial, useRewarded } from "@/src/components/Ads";

const GRID = 5; // 5x5 = 25 tiles
const REVEAL_THRESHOLD = 12;

export default function ScratchScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<any>(null);
  const [revealed, setRevealed] = useState<boolean[]>(Array(GRID * GRID).fill(false));
  const [reward, setReward] = useState<number | null>(null);
  const [popup, setPopup] = useState<{ amount: number } | null>(null);
  const interstitial = useInterstitial();

  const load = async () => {
    const did = await getDeviceId();
    setStatus(await api.get(`/explore/scratch?device_id=${encodeURIComponent(did)}`));
  };
  useEffect(() => { load(); }, []);

  const revealedCount = useMemo(() => revealed.filter(Boolean).length, [revealed]);

  const onTileTouch = (idx: number) => {
    if (status?.claimed_today) return;
    setRevealed((r) => { if (r[idx]) return r; const next = [...r]; next[idx] = true; return next; });
  };

  useEffect(() => {
    if (revealedCount >= REVEAL_THRESHOLD && reward === null && !status?.claimed_today) {
      doClaim();
    }
  }, [revealedCount]);

  const doClaim = async (multiplier = 1.0) => {
    try {
      const did = await getDeviceId();
      const r = await api.post("/explore/scratch/claim", { device_id: did, multiplier });
      setReward(r.reward);
      await interstitial.show();
      setPopup({ amount: r.reward });
      await load();
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    }
  };

  const rewarded = useRewarded(() => doClaim(2.0));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={22} color={colors.textPrimary} /></Pressable>
        <Text style={styles.title}>Scratch Card</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.body}>
        <Text style={styles.intro}>Tap to scratch — reveal {REVEAL_THRESHOLD}+ tiles to win</Text>
        <View style={styles.card}>
          <View style={styles.cardInner}>
            <Feather name="award" size={48} color={colors.secondary} />
            <Text style={styles.cardLabel}>Reward!</Text>
            <Text style={styles.cardReward}>{reward !== null ? `+${reward} pts` : "+10-20 pts"}</Text>
          </View>
          <View style={styles.tileGrid} pointerEvents={status?.claimed_today ? "none" : "auto"}>
            {revealed.map((shown, i) => (
              <Pressable
                key={i}
                style={[styles.tile, shown && { opacity: 0 }]}
                onPress={() => onTileTouch(i)}
              />
            ))}
          </View>
        </View>
        {status?.claimed_today ? (
          <Text style={styles.alreadyTxt}>You've scratched today's card. Come back tomorrow!</Text>
        ) : reward === null ? (
          <Text style={styles.progressTxt}>{revealedCount}/{REVEAL_THRESHOLD} revealed</Text>
        ) : (
          <Pressable testID="scratch-multi-btn" style={styles.multiBtn} onPress={() => rewarded.show()}>
            <Feather name="play-circle" size={16} color={colors.primaryDark} />
            <Text style={styles.multiText}>Watch ad — 2× reward</Text>
          </Pressable>
        )}
      </View>
      <RewardPopup visible={!!popup} amount={popup?.amount || 0} title="Scratch Win!" onClaim={() => setPopup(null)} />
    </SafeAreaView>
  );
}

const TILE_SIZE = (260 - 10) / GRID;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  title: { fontFamily: fonts.heading, fontSize: 18 },
  body: { padding: spacing.lg, alignItems: "center" },
  intro: { fontFamily: fonts.body, color: colors.textSecondary, marginBottom: spacing.lg },
  card: { width: 280, height: 280, padding: 5, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.secondary, ...shadows.heavy, overflow: "hidden" },
  cardInner: { position: "absolute", inset: 5, alignItems: "center", justifyContent: "center", backgroundColor: "#FEF3C7", borderRadius: 20 },
  cardLabel: { fontFamily: fonts.heading, color: colors.secondaryDark, fontSize: 16, marginTop: 8 },
  cardReward: { fontFamily: fonts.heading, color: colors.primary, fontSize: 28, marginTop: 4 },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", width: 260, height: 260 },
  tile: { width: TILE_SIZE, height: TILE_SIZE, backgroundColor: "#94A3B8", borderWidth: 1, borderColor: "#64748B" },
  progressTxt: { marginTop: 16, fontFamily: fonts.body, color: colors.textSecondary },
  alreadyTxt: { marginTop: 16, fontFamily: fonts.body, color: colors.textSecondary, textAlign: "center", paddingHorizontal: 32 },
  multiBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, padding: 12, backgroundColor: colors.primaryLight, borderRadius: radius.button, paddingHorizontal: 16 },
  multiText: { color: colors.primaryDark, fontFamily: fonts.heading, fontSize: 13 },
});
