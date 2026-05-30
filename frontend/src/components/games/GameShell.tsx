// Shared game session hook + UI shell for all mini-games.
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { getDeviceId, saveUser } from "@/src/auth";
import RewardPopup from "@/src/components/RewardPopup";
import { useInterstitial, useRewarded, AdNative } from "@/src/components/Ads";

export type GameState = {
  id: string; name: string; icon: string; color: string;
  chances: number; chances_left: number; plays_today: number;
};

/** Hook that loads game config & wraps the play API call. */
export function useGameSession(gameId: string) {
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [popup, setPopup] = useState<{ amount: number; sub?: string } | null>(null);
  const interstitial = useInterstitial();
  const rewarded = useRewarded(async () => {
    try {
      const did = await getDeviceId();
      const r = await api.post("/games/watch-rewarded", { device_id: did, game_id: gameId });
      Alert.alert("Chances added!", `+${r.added} chances · ${r.refills_left} refills left today`);
      await refresh();
    } catch (e: any) { Alert.alert("Failed", e.message); }
  });

  const refresh = useCallback(async () => {
    const did = await getDeviceId();
    const games = await api.get(`/games?device_id=${encodeURIComponent(did)}`);
    const g = games.find((x: any) => x.id === gameId);
    setGame(g || null);
  }, [gameId]);

  useEffect(() => { (async () => { try { await refresh(); } finally { setLoading(false); } })(); }, [refresh]);

  const play = useCallback(async (resultLabel?: string) => {
    if (!game || submitting) return null;
    if (game.chances_left <= 0) {
      Alert.alert("No chances", "Watch a rewarded ad to get more chances.");
      return null;
    }
    setSubmitting(true);
    try {
      const did = await getDeviceId();
      const r = await api.post("/games/play", { device_id: did, game_id: gameId });
      setPopup({ amount: r.reward, sub: resultLabel });
      if (r.show_interstitial) setTimeout(() => interstitial.show(), 250);
      // refresh user balance cache
      try { const me = await api.get(`/auth/me/${encodeURIComponent(did)}`); await saveUser(me); } catch {}
      await refresh();
      return r.reward as number;
    } catch (e: any) { Alert.alert("Failed", e.message); return null; }
    finally { setSubmitting(false); }
  }, [game, gameId, submitting, refresh, interstitial]);

  return {
    game, loading, submitting, popup, setPopup,
    play, refresh, watchAd: () => rewarded.show(),
  };
}

type ShellProps = {
  game: GameState | null;
  loading: boolean;
  popup: { amount: number; sub?: string } | null;
  onClosePopup: () => void;
  onWatchAd: () => void;
  /** The game UI itself, passed game state for chance/reward info. */
  children: React.ReactNode;
  /** Optional footer (e.g. score) */
  scoreText?: string;
  /** Optional leaderboard button handler */
  onShowLeaderboard?: () => void;
};

export function GameShell({ game, loading, popup, onClosePopup, onWatchAd, children, scoreText, onShowLeaderboard }: ShellProps) {
  const router = useRouter();
  if (loading || !game) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: game.color }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="game-back">
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.title}>{game.name}</Text>
          <Text style={styles.subtitle}>Win {(game as any).reward_min ?? 10}-{(game as any).reward_max ?? 50} pts</Text>
        </View>
        <View style={styles.chancePill}>
          <Feather name="zap" size={12} color="#fff" />
          <Text style={styles.chanceText}>{game.chances_left}/{game.chances}</Text>
        </View>
        {onShowLeaderboard ? (
          <Pressable testID="game-leaderboard-btn" onPress={onShowLeaderboard} style={styles.lbBtn}>
            <Feather name="award" size={18} color="#fff" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        {game.chances_left <= 0 ? (
          <Pressable testID="game-watch-ad-btn" style={styles.adBtnTop} onPress={onWatchAd}>
            <Feather name="play-circle" size={18} color="#fff" />
            <Text style={styles.adTextTop}>Watch ad — +{game.chances} chances</Text>
          </Pressable>
        ) : null}
        <View style={{ flex: 1, opacity: game.chances_left <= 0 ? 0.35 : 1 }} pointerEvents={game.chances_left <= 0 ? "none" : "auto"}>
          {children}
        </View>
        <View style={{ marginTop: spacing.md }}>
          <AdNative testID="game-native-ad" />
        </View>
      </View>

      <View style={styles.footer}>
        {scoreText ? <Text style={styles.scoreText}>{scoreText}</Text> : null}
      </View>

      <RewardPopup
        visible={!!popup}
        amount={popup?.amount || 0}
        title="You Won!"
        subtitle={popup?.sub || `${game.name} reward`}
        onClaim={onClosePopup}
        claimLabel="Play Again"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    gap: 8, ...shadows.medium,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.2)" },
  title: { color: "#fff", fontFamily: fonts.heading, fontSize: 18, letterSpacing: -0.3 },
  subtitle: { color: "rgba(255,255,255,0.85)", fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  chancePill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.22)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
  chanceText: { color: "#fff", fontFamily: fonts.heading, fontSize: 12 },
  lbBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.2)" },
  body: { flex: 1, padding: spacing.lg },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: 8 },
  scoreText: { textAlign: "center", color: colors.textSecondary, fontFamily: fonts.body },
  adBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.primaryLight, paddingVertical: 12, borderRadius: radius.button },
  adText: { color: colors.primaryDark, fontFamily: fonts.heading, fontSize: 13 },
  adBtnTop: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.button, marginBottom: spacing.md, ...shadows.medium },
  adTextTop: { color: "#fff", fontFamily: fonts.heading, fontSize: 14 },
});
