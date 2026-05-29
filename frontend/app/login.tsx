// Login / Register flow: continue button → mobile + username
import React, { useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { getDeviceId, saveUser } from "@/src/auth";
import { api } from "@/src/api";

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState<"welcome" | "form">("welcome");
  const [mobile, setMobile] = useState("");
  const [confirmMobile, setConfirmMobile] = useState("");
  const [username, setUsername] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [checking, setChecking] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [loading, setLoading] = useState(false);

  const checkUsername = async (val: string) => {
    setUsername(val);
    if (val.length < 3) { setUsernameStatus("idle"); return; }
    setUsernameStatus("checking");
    try {
      const r = await api.post("/auth/check-username", { username: val });
      setUsernameStatus(r.available ? "available" : "taken");
    } catch {
      setUsernameStatus("idle");
    }
  };

  const onContinue = () => {
    setStep("form");
  };

  const onSubmit = async () => {
    if (mobile.length < 10) return Alert.alert("Invalid", "Enter a valid 10-digit mobile number");
    if (mobile !== confirmMobile) return Alert.alert("Mismatch", "Mobile numbers do not match");
    if (username.length < 3) return Alert.alert("Invalid", "Username too short");
    if (usernameStatus === "taken") return Alert.alert("Taken", "Choose a different username");
    setLoading(true);
    try {
      const did = await getDeviceId();
      const res = await api.post("/auth/register", {
        device_id: did, mobile, username,
        referred_by: referredBy.trim() || null,
      });
      await saveUser(res.user);
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Login failed", e.message || "Try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <View style={styles.logo}>
              <Feather name="dollar-sign" size={42} color="#fff" />
            </View>
          </View>
          <Text style={styles.brand}>CashClick</Text>
          <Text style={styles.welcome}>
            {step === "welcome" ? "Earn rewards by playing games & completing tasks" : "Create your account"}
          </Text>

          {step === "welcome" ? (
            <View style={{ width: "100%", marginTop: spacing.xl }}>
              <View style={styles.benefits}>
                <Benefit icon="gift" text="Daily rewards & streaks" />
                <Benefit icon="users" text="Refer friends & earn ₹" />
                <Benefit icon="credit-card" text="Instant UPI withdrawals" />
              </View>
              <Pressable
                testID="login-continue-btn"
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
                onPress={onContinue}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
                <Feather name="arrow-right" size={20} color="#fff" />
              </Pressable>
              <Text style={styles.note}>
                Secured by device login. One account per device.
              </Text>
            </View>
          ) : (
            <View style={{ width: "100%", marginTop: spacing.lg }}>
              <Field label="Mobile Number" value={mobile} onChange={(t) => setMobile(t.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile" keyboard="phone-pad" testID="login-mobile-input" />
              <Field label="Confirm Mobile Number" value={confirmMobile} onChange={(t) => setConfirmMobile(t.replace(/\D/g, "").slice(0, 10))} placeholder="Re-enter mobile" keyboard="phone-pad" testID="login-mobile-confirm-input" />
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Username</Text>
                <View style={[styles.inputWrap, usernameStatus === "taken" && { borderColor: colors.error }]}>
                  <Text style={styles.atPrefix}>@</Text>
                  <TextInput
                    testID="login-username-input"
                    value={username}
                    onChangeText={(t) => checkUsername(t.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
                    placeholder="unique_username"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={20}
                  />
                  {usernameStatus === "checking" && <ActivityIndicator size="small" color={colors.primary} />}
                  {usernameStatus === "available" && <Feather name="check-circle" size={18} color={colors.success} />}
                  {usernameStatus === "taken" && <Feather name="x-circle" size={18} color={colors.error} />}
                </View>
                {usernameStatus === "taken" && <Text style={styles.errorText}>Username already taken</Text>}
                {usernameStatus === "available" && <Text style={styles.okText}>Available</Text>}
              </View>
              <Field label="Referral Code (optional)" value={referredBy} onChange={setReferredBy} placeholder="@friend_username" testID="login-referral-input" />

              <Pressable
                testID="login-register-btn"
                style={({ pressed }) => [styles.primaryBtn, (loading || usernameStatus === "taken") && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
                onPress={onSubmit}
                disabled={loading || usernameStatus === "taken"}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Text style={styles.primaryBtnText}>Create Account</Text>
                    <Feather name="arrow-right" size={20} color="#fff" />
                  </>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Benefit({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitIcon}><Feather name={icon} size={18} color={colors.primary} /></View>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

function Field({
  label, value, onChange, placeholder, keyboard, testID,
}: { label: string; value: string; onChange: (t: string) => void; placeholder?: string; keyboard?: any; testID?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          keyboardType={keyboard || "default"}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl, alignItems: "center" },
  logoWrap: { marginTop: spacing.xl },
  logo: {
    width: 84, height: 84, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", ...shadows.heavy,
  },
  brand: { fontFamily: fonts.heading, fontSize: 32, color: colors.textPrimary, marginTop: spacing.lg, letterSpacing: -0.5 },
  welcome: { fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 6, textAlign: "center", fontSize: 14 },
  benefits: { marginTop: spacing.xl, gap: 12 },
  benefitRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, padding: 16, borderRadius: radius.image,
    borderWidth: 1, borderColor: colors.border,
  },
  benefitIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  benefitText: { fontFamily: fonts.body, fontSize: 14, color: colors.textPrimary, flex: 1 },
  primaryBtn: {
    height: 56, backgroundColor: colors.primary, borderRadius: radius.button,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: spacing.xl, ...shadows.heavy,
  },
  primaryBtnText: { color: "#fff", fontFamily: fonts.heading, fontSize: 16 },
  note: { textAlign: "center", color: colors.textTertiary, fontFamily: fonts.regular, fontSize: 12, marginTop: 16 },
  fieldWrap: { marginTop: spacing.md },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", height: 56,
    backgroundColor: colors.surface, borderRadius: radius.button,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, gap: 8,
  },
  atPrefix: { fontFamily: fonts.heading, color: colors.textTertiary, fontSize: 16 },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.textPrimary },
  errorText: { color: colors.error, fontFamily: fonts.regular, fontSize: 12, marginTop: 6 },
  okText: { color: colors.success, fontFamily: fonts.regular, fontSize: 12, marginTop: 6 },
});
