// AdMob wrappers — placeholders in Expo Go / Web, real ads in dev/prod builds.
import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { colors, fonts, radius } from "@/src/theme";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const isWeb = Platform.OS === "web";
const ADS_AVAILABLE = !isExpoGo && !isWeb;

let GMA: any = null;
if (ADS_AVAILABLE) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    GMA = require("react-native-google-mobile-ads");
  } catch {
    GMA = null;
  }
}

export function initMobileAds() {
  if (GMA && GMA.default) {
    try { GMA.default().initialize(); } catch {}
  }
}

export function AdBanner({ testID }: { testID?: string }) {
  if (!ADS_AVAILABLE || !GMA) {
    return (
      <View style={styles.banner} testID={testID || "ad-banner"}>
        <Text style={styles.bannerText}>AD BANNER</Text>
      </View>
    );
  }
  const { BannerAd, BannerAdSize, TestIds } = GMA;
  return (
    <View testID={testID || "ad-banner"}>
      <BannerAd
        unitId={TestIds.BANNER}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      />
    </View>
  );
}

export function AdNative({ testID }: { testID?: string }) {
  // Native ads require complex setup; for now render a styled "sponsored" placeholder
  // matching design — real native ads can be wired here later for build.
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

export function useInterstitial(): { show: () => Promise<void>; ready: boolean } {
  const [ready, setReady] = useState(true);
  const adRef = useRef<any>(null);
  useEffect(() => {
    if (!ADS_AVAILABLE || !GMA) return;
    try {
      const { InterstitialAd, AdEventType, TestIds } = GMA;
      const ad = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL);
      const sub = ad.addAdEventListener(AdEventType.LOADED, () => setReady(true));
      const sub2 = ad.addAdEventListener(AdEventType.CLOSED, () => { setReady(false); ad.load(); });
      ad.load();
      adRef.current = ad;
      return () => { try { sub(); sub2(); } catch {} };
    } catch {}
  }, []);
  const show = useCallback(async () => {
    if (ADS_AVAILABLE && adRef.current) {
      try { adRef.current.show(); return; } catch {}
    }
    // Expo Go: short no-op delay
    await new Promise((r) => setTimeout(r, 400));
  }, []);
  return { show, ready };
}

export function useRewarded(onEarned?: () => void): { show: () => Promise<boolean>; ready: boolean } {
  const [ready, setReady] = useState(true);
  const adRef = useRef<any>(null);
  useEffect(() => {
    if (!ADS_AVAILABLE || !GMA) return;
    try {
      const { RewardedAd, RewardedAdEventType, AdEventType, TestIds } = GMA;
      const ad = RewardedAd.createForAdRequest(TestIds.REWARDED);
      const a = ad.addAdEventListener(RewardedAdEventType.LOADED, () => setReady(true));
      const b = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => onEarned?.());
      const c = ad.addAdEventListener(AdEventType.CLOSED, () => { setReady(false); ad.load(); });
      ad.load();
      adRef.current = ad;
      return () => { try { a(); b(); c(); } catch {} };
    } catch {}
  }, [onEarned]);
  const show = useCallback(async () => {
    if (ADS_AVAILABLE && adRef.current) {
      try { adRef.current.show(); return true; } catch { return false; }
    }
    // Expo Go: simulate watched ad
    await new Promise((r) => setTimeout(r, 600));
    onEarned?.();
    return true;
  }, [onEarned]);
  return { show, ready };
}

const styles = StyleSheet.create({
  banner: {
    height: 56,
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  bannerText: {
    fontFamily: fonts.heading,
    color: colors.textTertiary,
    fontSize: 11,
    letterSpacing: 2,
  },
  native: {
    flexDirection: "row",
    padding: 14,
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.image,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 12,
  },
  nativeBadge: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nativeBadgeText: { color: "#fff", fontSize: 10, fontFamily: fonts.heading },
  nativeTitle: { fontFamily: fonts.heading, fontSize: 14, color: colors.textPrimary },
  nativeBody: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
