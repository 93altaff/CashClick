// Top bar shown on tab screens — logo + username on left, points on right.
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, spacing } from "@/src/theme";
import LogoVideo from "@/src/components/LogoVideo";

type Props = { username: string; points: number; showLogo?: boolean; onPointsPress?: () => void };

export default function TopBar({ username, points, showLogo = true, onPointsPress }: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        {showLogo ? (
          <LogoVideo size={40} borderRadius={12} testID="topbar-logo" />
        ) : null}
        <View>
          <Text style={styles.hi}>Hi,</Text>
          <Text style={styles.uname} testID="topbar-username">@{username}</Text>
        </View>
      </View>
      <Pressable onPress={onPointsPress} style={styles.points} testID="topbar-points">
        <Feather name="zap" size={16} color={colors.secondaryDark} />
        <Text style={styles.pointsText}>{points.toLocaleString()}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  hi: { fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary },
  uname: { fontFamily: fonts.heading, fontSize: 16, color: colors.textPrimary },
  points: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FEF3C7", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
    borderWidth: 1, borderColor: "#FCD34D",
  },
  pointsText: { fontFamily: fonts.heading, color: colors.secondaryDark, fontSize: 14 },
});
