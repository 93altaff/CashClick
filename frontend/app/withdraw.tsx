// Withdraw screen — balance card, UPI/Bank toggle, amount chips, form, history.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { getDeviceId } from "@/src/auth";
import { useRewarded } from "@/src/components/Ads";

export default function Withdraw() {
  const router = useRouter();
  const [bal, setBal] = useState<any>(null);
  const [chips, setChips] = useState<number[]>([]);
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<"upi" | "bank">("upi");
  const [history, setHistory] = useState<any[]>([]);
  const [data, setData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const reward = useRewarded(() => Alert.alert("Thanks!", "Your support helps admin process faster."));

  const load = async () => {
    const did = await getDeviceId();
    const [b, cfg, h] = await Promise.all([
      api.get(`/wallet/balance?device_id=${encodeURIComponent(did)}`),
      api.get(`/config`),
      api.get(`/wallet/withdrawals?device_id=${encodeURIComponent(did)}`),
    ]);
    setBal(b); setChips(cfg.withdraw_chips || []); setHistory(h);
  };

  useEffect(() => { load(); }, []);

  const validate = (): string | null => {
    if (!amount) return "Select an amount";
    if (bal && amount * bal.conversion_rate > bal.points) return "Insufficient balance";
    if (method === "upi") {
      if (!data.name) return "Enter name";
      if (!data.upi) return "Enter UPI ID";
      if (data.upi !== data.upi_confirm) return "UPI IDs do not match";
    } else {
      if (!data.name) return "Enter account holder name";
      if (!data.acc) return "Enter account number";
      if (data.acc !== data.acc_confirm) return "Account numbers do not match";
      if (!data.ifsc) return "Enter IFSC";
      if (data.ifsc !== data.ifsc_confirm) return "IFSC codes do not match";
    }
    return null;
  };

  const onSubmit = async () => {
    const err = validate();
    if (err) return Alert.alert("Validation", err);
    setSubmitting(true);
    try {
      const did = await getDeviceId();
      const details = method === "upi"
        ? { name: data.name, upi_id: data.upi }
        : { name: data.name, acc_no: data.acc, ifsc: data.ifsc };
      await api.post("/wallet/withdraw", { device_id: did, amount, method, details });
      setSuccess(true);
      await load();
    } catch (e: any) { Alert.alert("Failed", e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={22} color={colors.textPrimary} /></Pressable>
        <Text style={styles.title}>Withdraw</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={styles.balCard}>
          <Text style={styles.balLabel}>Available Balance</Text>
          <Text style={styles.balRupee}>₹{bal?.rupees?.toFixed(2) || "0.00"}</Text>
          <Text style={styles.balPts}>{(bal?.points || 0).toLocaleString()} pts · {bal?.conversion_rate || 100} pts = ₹1</Text>
        </View>

        <Text style={styles.sectionTitle}>Method</Text>
        <View style={styles.toggleRow}>
          {(["upi", "bank"] as const).map((m) => (
            <Pressable
              key={m}
              testID={`withdraw-method-${m}`}
              style={[styles.toggle, method === m && styles.toggleActive]}
              onPress={() => setMethod(m)}
            >
              <Feather name={m === "upi" ? "smartphone" : "credit-card"} size={18} color={method === m ? "#fff" : colors.textSecondary} />
              <Text style={[styles.toggleText, method === m && { color: "#fff" }]}>{m === "upi" ? "UPI" : "Bank Transfer"}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Select Amount</Text>
        <View style={styles.chipsWrap}>
          {chips.map((c) => (
            <Pressable
              key={c}
              testID={`withdraw-amount-${c}`}
              style={[styles.chip, amount === c && styles.chipActive]}
              onPress={() => setAmount(c)}
            >
              <Text style={[styles.chipText, amount === c && styles.chipTextActive]}>₹{c}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Details</Text>
        {method === "upi" ? (
          <>
            <Field label="Name" value={data.name || ""} onChange={(t) => setData({ ...data, name: t })} testID="withdraw-name" />
            <Field label="UPI ID" value={data.upi || ""} onChange={(t) => setData({ ...data, upi: t })} testID="withdraw-upi" />
            <Field label="Confirm UPI ID" value={data.upi_confirm || ""} onChange={(t) => setData({ ...data, upi_confirm: t })} testID="withdraw-upi-confirm" />
          </>
        ) : (
          <>
            <Field label="Account Holder Name" value={data.name || ""} onChange={(t) => setData({ ...data, name: t })} testID="withdraw-name" />
            <Field label="Account Number" value={data.acc || ""} onChange={(t) => setData({ ...data, acc: t })} testID="withdraw-acc" kbd="number-pad" />
            <Field label="Confirm Account Number" value={data.acc_confirm || ""} onChange={(t) => setData({ ...data, acc_confirm: t })} testID="withdraw-acc-confirm" kbd="number-pad" />
            <Field label="IFSC Code" value={data.ifsc || ""} onChange={(t) => setData({ ...data, ifsc: t.toUpperCase() })} testID="withdraw-ifsc" />
            <Field label="Confirm IFSC Code" value={data.ifsc_confirm || ""} onChange={(t) => setData({ ...data, ifsc_confirm: t.toUpperCase() })} testID="withdraw-ifsc-confirm" />
          </>
        )}

        <Pressable testID="withdraw-submit-btn" style={styles.submitBtn} onPress={onSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Withdrawal</Text>}
        </Pressable>

        <Text style={styles.sectionTitle}>Withdrawal History</Text>
        {!history.length ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No withdrawals yet</Text></View>
        ) : history.filter(w => !w.is_campaign).map((w) => (
          <View key={w.id} style={styles.histRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.histTitle}>₹{w.amount} · {(w.method || "").toUpperCase()}</Text>
              <Text style={styles.histMeta}>{new Date(w.created_at).toLocaleString()}</Text>
              <Text style={styles.histDetails} numberOfLines={1}>
                {w.method === "upi" ? `UPI: ${w.details?.upi_id || ""}` : `A/c: ${w.details?.acc_no || ""} · IFSC: ${w.details?.ifsc || ""}`}
              </Text>
              {w.reason ? <Text style={styles.histReason}>Reason: {w.reason}</Text> : null}
            </View>
            <View style={[styles.statusPill, w.status === "paid" && { backgroundColor: "#D1FAE5" }, w.status === "rejected" && { backgroundColor: "#FEE2E2" }, w.status === "pending" && { backgroundColor: "#FEF3C7" }]}>
              <Text style={[styles.statusText, w.status === "paid" && { color: colors.primaryDark }, w.status === "rejected" && { color: colors.error }, w.status === "pending" && { color: colors.secondaryDark }]}>
                {String(w.status).toUpperCase()}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={success} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.confirmCard}>
            <View style={styles.successIcon}><Feather name="check" size={36} color="#fff" /></View>
            <Text style={styles.confirmTitle}>Withdrawal Submitted!</Text>
            <Text style={styles.confirmBody}>Your request is under review. Watch a quick ad to help speed up processing.</Text>
            <Pressable style={styles.helpAdminBtn} onPress={() => { reward.show(); }}>
              <Feather name="play-circle" size={18} color="#fff" />
              <Text style={styles.helpAdminText}>Help Admin (Watch Ad)</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn2} onPress={() => { setSuccess(false); router.back(); }}>
              <Text style={styles.cancelText2}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, testID, kbd }: { label: string; value: string; onChange: (t: string) => void; testID?: string; kbd?: any }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={kbd || "default"}
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  title: { fontFamily: fonts.heading, fontSize: 18 },
  balCard: { backgroundColor: colors.primaryDark, padding: spacing.lg, borderRadius: radius.card, ...shadows.heavy },
  balLabel: { fontFamily: fonts.body, color: "rgba(255,255,255,0.75)", fontSize: 12, letterSpacing: 1 },
  balRupee: { fontFamily: fonts.heading, color: "#fff", fontSize: 36, marginTop: 6, letterSpacing: -1 },
  balPts: { fontFamily: fonts.regular, color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 4 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 14, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 },
  toggleRow: { flexDirection: "row", gap: 10 },
  toggle: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: radius.button, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  toggleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { fontFamily: fonts.heading, color: colors.textSecondary, fontSize: 13 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 100, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { fontFamily: fonts.heading, color: colors.textSecondary, fontSize: 14 },
  chipTextActive: { color: colors.primaryDark },
  label: { fontFamily: fonts.body, fontSize: 11, color: colors.textTertiary, marginBottom: 4 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: radius.button, fontFamily: fonts.body, color: colors.textPrimary },
  submitBtn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radius.button, marginTop: spacing.md, alignItems: "center", ...shadows.heavy },
  submitText: { color: "#fff", fontFamily: fonts.heading, fontSize: 15 },
  empty: { padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.image, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  emptyText: { color: colors.textTertiary, fontFamily: fonts.regular },
  histRow: { flexDirection: "row", gap: 12, padding: 14, backgroundColor: colors.surface, borderRadius: radius.image, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  histTitle: { fontFamily: fonts.heading, fontSize: 14, color: colors.textPrimary },
  histMeta: { fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  histDetails: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  histReason: { fontFamily: fonts.regular, fontSize: 11, color: colors.error, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100, alignSelf: "flex-start" },
  statusText: { fontFamily: fonts.heading, fontSize: 10 },
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: 20 },
  confirmCard: { backgroundColor: "#fff", borderRadius: radius.card, padding: spacing.xl, alignItems: "center", width: "100%", maxWidth: 360 },
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  confirmTitle: { fontFamily: fonts.heading, fontSize: 18, marginTop: 12, color: colors.textPrimary },
  confirmBody: { fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 6, textAlign: "center" },
  helpAdminBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.button, marginTop: 16, width: "100%" },
  helpAdminText: { color: "#fff", fontFamily: fonts.heading },
  cancelBtn2: { marginTop: 8, padding: 12 },
  cancelText2: { fontFamily: fonts.heading, color: colors.textSecondary },
});
