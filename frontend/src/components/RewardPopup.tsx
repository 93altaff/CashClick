// Animated reward popup with optional rewarded-ad multiplier action.
import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Modal, Pressable, Animated, Easing } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";

type Props = {
  visible: boolean;
  amount: number;
  title?: string;
  subtitle?: string;
  multiplier?: number;
  onClaim: () => void;
  onMultiplier?: () => void;
  multiplierLabel?: string;
  claimLabel?: string;
};

export default function RewardPopup({
  visible, amount, title = "You Won!", subtitle, multiplier, onClaim, onMultiplier, multiplierLabel, claimLabel = "Claim",
}: Props) {
  const scale = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      scale.setValue(0);
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 80 }).start();
      Animated.loop(
        Animated.timing(rotate, { toValue: 1, duration: 2500, easing: Easing.linear, useNativeDriver: true })
      ).start();
    }
  }, [visible, rotate, scale]);
  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]} testID="reward-popup">
          <Animated.View style={[styles.coinWrap, { transform: [{ rotate: spin }] }]}>
            <View style={styles.coin}>
              <Feather name="award" size={48} color="#fff" />
            </View>
          </Animated.View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.amount}>+{amount} <Text style={styles.amountUnit}>pts</Text></Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {multiplier && onMultiplier ? (
            <Pressable testID="reward-multiplier-btn" style={styles.multiplierBtn} onPress={onMultiplier}>
              <Feather name="play-circle" size={18} color={colors.primary} />
              <Text style={styles.multiplierText}>{multiplierLabel || `Watch ad — ${multiplier}× reward`}</Text>
            </Pressable>
          ) : null}
          <Pressable testID="reward-claim-btn" style={styles.claimBtn} onPress={onClaim}>
            <Text style={styles.claimText}>{claimLabel}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  card: {
    width: "100%", maxWidth: 360, backgroundColor: colors.surface, borderRadius: radius.card,
    padding: spacing.xl, alignItems: "center", ...shadows.heavy,
  },
  coinWrap: { marginBottom: spacing.md },
  coin: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: colors.secondary,
    alignItems: "center", justifyContent: "center", ...shadows.medium,
  },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.textPrimary },
  amount: { fontFamily: fonts.heading, fontSize: 44, color: colors.primary, marginTop: 8 },
  amountUnit: { fontSize: 16, color: colors.textSecondary },
  subtitle: { fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 4, textAlign: "center" },
  multiplierBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.primaryLight, paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: radius.button, marginTop: spacing.lg,
  },
  multiplierText: { fontFamily: fonts.heading, color: colors.primaryDark, fontSize: 13 },
  claimBtn: {
    marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: radius.button, width: "100%", alignItems: "center",
  },
  claimText: { color: "#fff", fontFamily: fonts.heading, fontSize: 16 },
});
