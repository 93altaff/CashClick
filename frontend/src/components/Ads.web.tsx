// Web stub for Ads.tsx — Metro resolves this on web builds.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts, radius } from "@/src/theme";

export function initMobileAds() { /* noop on web */ }

export function AdBanner({ testID }: { testID?: string }) {
  return (
    <View style={styles.banner} testID={testID || "ad-banner"}>
      <Text style={styles.bannerText}>AD BANNER</Text>
    </View>
  );
}

export function AdNative({ testID }: { testID?: string }) {
  return (
    <View style={styles.native} testID={testID || "ad-native"}>
      <View style={styles.nativeBadge}><Text style={styles.nativeBadgeText}>AD</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.nativeTitle}>Sponsored</Text>
        <Text style={styles.nativeBody}>Discover top-rated apps & offers handpicked for you.</Text>
      </View>
    </View>
  );
}

export function useInterstitial() {
  return { ready: true, show: async () => { await new Promise((r) => setTimeout(r, 200)); } };
}

export function useRewarded(onEarned?: () => void) {
  return {
    ready: true,
    show: async () => {
      await new Promise((r) => setTimeout(r, 400));
      onEarned?.();
      return true;
    },
  };
}

const styles = StyleSheet.create({
  banner: {
    height: 56, backgroundColor: colors.surfaceVariant, borderRadius: radius.button,
    alignItems: "center", justifyContent: "center", marginHorizontal: 16, marginVertical: 8,
    borderWidth: 1, borderColor: colors.border, borderStyle: "dashed",
  },
  bannerText: { fontFamily: fonts.heading, color: colors.textTertiary, fontSize: 11, letterSpacing: 2 },
  native: {
    flexDirection: "row", padding: 14, backgroundColor: colors.surfaceVariant, borderRadius: radius.image,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: 12,
  },
  nativeBadge: { backgroundColor: colors.secondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  nativeBadgeText: { color: "#fff", fontSize: 10, fontFamily: fonts.heading },
  nativeTitle: { fontFamily: fonts.heading, fontSize: 14, color: colors.textPrimary },
  nativeBody: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
