// Splash/redirect: load device id, check registration, route to login or tabs.
import { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { colors, fonts } from "@/src/theme";
import { getDeviceId, saveUser, loadUser } from "@/src/auth";
import { api } from "@/src/api";
import LogoVideo from "@/src/components/LogoVideo";

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      try {
        const did = await getDeviceId();
        const cached = await loadUser();
        const res = await api.get(`/auth/check-device/${encodeURIComponent(did)}`);
        if (res.exists && res.user) {
          await saveUser(res.user);
          setTimeout(() => router.replace("/(tabs)"), 600);
        } else {
          if (cached) {
            // device on backend cleared — clear local
          }
          setTimeout(() => router.replace("/login"), 600);
        }
      } catch (e) {
        // network error — still go to login
        setTimeout(() => router.replace("/login"), 800);
      }
    })();
  }, [router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <LogoVideo size={140} borderRadius={32} testID="splash-logo" />
      <Text style={styles.brand}>CashClick</Text>
      <Text style={styles.tagline}>Earn while you play</Text>
      <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  logo: {
    width: 110, height: 110, borderRadius: 28, backgroundColor: colors.primaryDark,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.3, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 8,
  },
  brand: { fontFamily: fonts.heading, fontSize: 36, color: "#fff", marginTop: 24, letterSpacing: -1 },
  tagline: { fontFamily: fonts.regular, color: "#D1FAE5", marginTop: 6, fontSize: 14 },
});
