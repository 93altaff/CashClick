// Home tab — TopBar, sliding banners, mini-games grid.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, FlatList, Image,
  Pressable, Dimensions, RefreshControl, Linking,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import TopBar from "@/src/components/TopBar";
import { api } from "@/src/api";
import { getDeviceId, loadUser, saveUser } from "@/src/auth";

const { width: SCREEN_W } = Dimensions.get("window");
const BANNER_W = SCREEN_W - spacing.lg * 2;

type Banner = { id: string; title: string; subtitle: string; image: string; url: string; is_external: boolean };
type Game = { id: string; name: string; icon: string; color: string; chances: number; chances_left: number; reward_min: number; reward_max: number };

export default function HomeTab() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const bannerRef = useRef<FlatList<Banner> | null>(null);
  const [bannerIdx, setBannerIdx] = useState(0);

  const load = useCallback(async () => {
    const did = await getDeviceId();
    try {
      const [me, b, g] = await Promise.all([
        api.get(`/auth/me/${encodeURIComponent(did)}`),
        api.get(`/banners`),
        api.get(`/games?device_id=${encodeURIComponent(did)}`),
      ]);
      setUser(me); await saveUser(me);
      setBanners(b);
      setGames(g);
    } catch (e) {
      const u = await loadUser();
      if (u) setUser(u);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => {
      setBannerIdx((i) => {
        const next = (i + 1) % banners.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, [banners.length]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onBannerPress = (b: Banner) => {
    if (!b.url) return;
    if (b.is_external) Linking.openURL(b.url).catch(() => {});
    else router.push(b.url as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <TopBar username={user?.username || "..."} points={user?.points || 0} onPointsPress={() => router.push("/(tabs)/wallet")} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        testID="home-scroll"
      >
        {banners.length > 0 && (
          <FlatList
            ref={bannerRef}
            data={banners}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(b) => b.id}
            snapToInterval={BANNER_W + spacing.md}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
            renderItem={({ item }) => (
              <Pressable
                testID={`home-banner-${item.id}`}
                style={[styles.banner, { width: BANNER_W }]}
                onPress={() => onBannerPress(item)}
              >
                {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" /> : null}
                <View style={styles.bannerOverlay} />
                <View style={styles.bannerContent}>
                  <Text style={styles.bannerTitle}>{item.title}</Text>
                  {item.subtitle ? <Text style={styles.bannerSubtitle}>{item.subtitle}</Text> : null}
                </View>
              </Pressable>
            )}
          />
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Play Games & Earn Rewards</Text>
            <Text style={styles.sectionHint}>{games.length} games</Text>
          </View>
          <View style={styles.grid}>
            {games.map((g) => (
              <Pressable
                key={g.id}
                testID={`home-game-${g.id}`}
                style={({ pressed }) => [styles.gameCard, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
                onPress={() => router.push(`/games/${g.id}` as any)}
              >
                <View style={[styles.gameThumb, { backgroundColor: g.color + "20" }]}>
                  <Feather name={g.icon as any} size={32} color={g.color} />
                </View>
                <View style={{ paddingHorizontal: 10, paddingBottom: 10, paddingTop: 8 }}>
                  <Text style={styles.gameName} numberOfLines={1}>{g.name}</Text>
                  <View style={styles.gameMeta}>
                    <Text style={styles.gameReward}>+{g.reward_min}-{g.reward_max} pts</Text>
                    <View style={[styles.chancePill, g.chances_left <= 0 && { backgroundColor: "#FEE2E2" }]}>
                      <Text style={[styles.chanceText, g.chances_left <= 0 && { color: colors.error }]}>{g.chances_left}/{g.chances}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const CARD_W = (SCREEN_W - spacing.lg * 2 - spacing.md) / 2;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  banner: {
    height: 160, borderRadius: radius.card, overflow: "hidden",
    backgroundColor: colors.primary, ...shadows.medium,
  },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.35)" },
  bannerContent: { position: "absolute", left: 18, right: 18, bottom: 18 },
  bannerTitle: { fontFamily: fonts.heading, color: "#fff", fontSize: 20, letterSpacing: -0.3 },
  bannerSubtitle: { fontFamily: fonts.body, color: "rgba(255,255,255,0.9)", fontSize: 13, marginTop: 4 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: spacing.md },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.textPrimary, letterSpacing: -0.3 },
  sectionHint: { fontFamily: fonts.body, color: colors.textSecondary, fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  gameCard: {
    width: CARD_W, backgroundColor: colors.surface, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden", ...shadows.light,
  },
  gameThumb: { height: 100, alignItems: "center", justifyContent: "center" },
  gameName: { fontFamily: fonts.heading, fontSize: 14, color: colors.textPrimary },
  gameMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  gameReward: { fontFamily: fonts.body, fontSize: 11, color: colors.primary },
  chancePill: { backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  chanceText: { fontFamily: fonts.heading, fontSize: 10, color: colors.primaryDark },
});
