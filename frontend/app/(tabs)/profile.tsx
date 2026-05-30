// Profile tab — username + mobile (left), animated mascot (right), quick access grid, admin login.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Animated, Easing, Linking, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { getDeviceId, loadUser, clearSession } from "@/src/auth";
import LogoVideo from "@/src/components/LogoVideo";

const APP_VERSION = "1.0.0";

export default function ProfileTab() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [qa, setQa] = useState<any[]>([]);
  const wave = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    const did = await getDeviceId();
    try {
      const me = await api.get(`/auth/me/${encodeURIComponent(did)}`);
      setUser(me);
    } catch { setUser(await loadUser()); }
    try { setQa(await api.get(`/profile/quick-access`)); } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(wave, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(wave, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [wave]);

  const tilt = wave.interpolate({ inputRange: [0, 1], outputRange: ["-6deg", "6deg"] });
  const scale = wave.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.04] });

  const handleQA = (url: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => Alert.alert("Cannot open", url));
  };

  const onLogout = async () => {
    Alert.alert("Logout?", "You will be asked to login again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => { await clearSession(); router.replace("/login"); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>USERNAME</Text>
            <Text style={styles.username} testID="profile-username">@{user?.username || "..."}</Text>
            <Text style={styles.mobile}>{user?.mobile || ""}</Text>
            <View style={styles.statsRow}>
              <Stat icon="zap" value={user?.points || 0} label="Points" />
              <Stat icon="trending-up" value={user?.total_earned || 0} label="Earned" />
            </View>
          </View>
          <Animated.View style={{ transform: [{ rotate: tilt }, { scale }] }}>
            <LogoVideo size={96} borderRadius={24} testID="profile-mascot" />
            <View style={styles.hiBubble}><Text style={styles.hiText}>Hi! 👋</Text></View>
          </Animated.View>
        </View>

        <Text style={styles.sectionTitle}>As Your Needs</Text>
        <View style={styles.qaList}>
          {qa.map((q) => (
            <Pressable
              key={q.id}
              testID={`profile-qa-${q.label}`}
              style={({ pressed }) => [styles.qaRow, pressed && { opacity: 0.7 }]}
              onPress={() => handleQA(q.url)}
            >
              <View style={styles.qaIcon}><Feather name={q.icon as any} size={20} color={colors.primary} /></View>
              <Text style={styles.qaLabel} numberOfLines={1}>{q.label}</Text>
              <Feather name="chevron-right" size={20} color={colors.textTertiary} />
            </Pressable>
          ))}
        </View>

        <Text style={styles.version}>CashClick v{APP_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon, value, label }: { icon: any; value: any; label: string }) {
  return (
    <View style={styles.statBox}>
      <Feather name={icon} size={14} color={colors.primary} />
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", padding: spacing.lg,
    backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginTop: spacing.md,
    borderRadius: radius.card, ...shadows.light,
  },
  label: { fontFamily: fonts.heading, fontSize: 10, color: colors.textTertiary, letterSpacing: 1 },
  username: { fontFamily: fonts.heading, fontSize: 22, color: colors.textPrimary, marginTop: 4 },
  mobile: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  mascot: { width: 96, height: 96 },
  hiBubble: { position: "absolute", top: -6, right: -8, backgroundColor: colors.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  hiText: { color: "#fff", fontFamily: fonts.heading, fontSize: 11 },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  statBox: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100 },
  statValue: { fontFamily: fonts.heading, color: colors.primaryDark, fontSize: 12 },
  statLabel: { fontFamily: fonts.regular, color: colors.primaryDark, fontSize: 10 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary, paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  qaList: { paddingHorizontal: spacing.lg, gap: 10 },
  qaRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 14,
    borderRadius: radius.image, borderWidth: 1, borderColor: colors.border,
  },
  qaIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  qaLabel: { flex: 1, fontFamily: fonts.heading, fontSize: 14, color: colors.textPrimary },
  adminWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: 8 },
  adminBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, backgroundColor: colors.surface, borderRadius: radius.button, borderWidth: 1, borderColor: colors.border },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, backgroundColor: colors.surface, borderRadius: radius.button, borderWidth: 1, borderColor: "#FEE2E2" },
  adminText: { fontFamily: fonts.heading, color: colors.textSecondary, fontSize: 13 },
  version: { textAlign: "center", color: colors.textTertiary, fontFamily: fonts.regular, fontSize: 11, marginTop: spacing.xl },
});
