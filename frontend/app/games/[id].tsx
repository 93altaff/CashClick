// Game dispatcher — routes to the real playable mini-game by id.
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, spacing } from "@/src/theme";
import { GameShell, useGameSession } from "@/src/components/games/GameShell";
import { GAMES_MAP } from "@/src/components/games/GamesRegistry";
import { GAMES_MAP_EXTRA } from "@/src/components/games/GamesRegistry2";
import LeaderboardModal from "@/src/components/games/LeaderboardModal";

const ALL_GAMES = { ...GAMES_MAP, ...GAMES_MAP_EXTRA };

export default function GamePlay() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useGameSession(id);
  const GameComponent = ALL_GAMES[id];
  const [showLB, setShowLB] = useState(false);

  return (
    <>
      <GameShell
        game={session.game}
        loading={session.loading}
        popup={session.popup}
        onClosePopup={() => session.setPopup(null)}
        onWatchAd={session.watchAd}
        onShowLeaderboard={() => setShowLB(true)}
      >
        {GameComponent ? (
          <GameComponent session={{ play: session.play, submitting: session.submitting }} />
        ) : (
          <View style={styles.fallback}>
            <Feather name="alert-circle" size={32} color={colors.textTertiary} />
            <Text style={styles.fallbackTitle}>Game unavailable</Text>
            <Text style={styles.fallbackText}>This game is coming soon.</Text>
          </View>
        )}
      </GameShell>
      <LeaderboardModal
        visible={showLB}
        gameId={id}
        gameName={session.game?.name || ""}
        gameColor={session.game?.color || colors.primary}
        onClose={() => setShowLB(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center", flex: 1, padding: spacing.lg, gap: 8 },
  fallbackTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary },
  fallbackText: { fontFamily: fonts.regular, color: colors.textSecondary },
});
