// Admin login
import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { saveAdminToken } from "@/src/auth";

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    setLoading(true);
    try {
      const r = await api.post("/admin/login", { username, password });
      await saveAdminToken(r.token);
      router.replace("/admin/dashboard");
    } catch (e: any) { Alert.alert("Login failed", e.message); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={22} color={colors.textPrimary} /></Pressable>
        <Text style={styles.title}>Admin Login</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.body}>
        <View style={styles.logo}><Feather name="shield" size={36} color="#fff" /></View>
        <Text style={styles.h1}>Admin Access</Text>
        <Text style={styles.sub}>Restricted area · Authorized users only</Text>
        <View style={{ width: "100%", marginTop: 32 }}>
          <Text style={styles.label}>Username</Text>
          <TextInput testID="admin-username" value={username} onChangeText={setUsername} style={styles.input} autoCapitalize="none" autoCorrect={false} />
          <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
          <TextInput testID="admin-password" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry autoCapitalize="none" />
          <Pressable testID="admin-login-btn" style={styles.btn} onPress={onLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Login</Text>}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  title: { fontFamily: fonts.heading, fontSize: 18 },
  body: { flex: 1, padding: spacing.lg, alignItems: "center", paddingTop: spacing.xxl },
  logo: { width: 80, height: 80, borderRadius: 24, backgroundColor: colors.textPrimary, alignItems: "center", justifyContent: "center", ...shadows.heavy },
  h1: { fontFamily: fonts.heading, fontSize: 24, color: colors.textPrimary, marginTop: 16 },
  sub: { fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 4 },
  label: { fontFamily: fonts.body, fontSize: 11, color: colors.textTertiary, marginBottom: 4, letterSpacing: 0.5 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: radius.button, fontFamily: fonts.body, color: colors.textPrimary },
  btn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radius.button, marginTop: 20, alignItems: "center", ...shadows.heavy },
  btnText: { color: "#fff", fontFamily: fonts.heading, fontSize: 15 },
});
