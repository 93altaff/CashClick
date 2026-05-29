// Campaign detail — user confirms payment received → creates transaction tagged campaign.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { getDeviceId } from "@/src/auth";

export default function CampaignDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<any>(null);
  const [started, setStarted] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    (async () => {
      try { setC(await api.get(`/campaigns/${id}`)); }
      catch (e: any) { Alert.alert("Error", e.message); }
    })();
  }, [id]);

  const onConfirm = async () => {
    setConfirm(false);
    try {
      const did = await getDeviceId();
      await api.post("/campaigns/confirm", { device_id: did, campaign_id: id });
      Alert.alert("Confirmed!", "Your campaign payment has been recorded.");
      router.back();
    } catch (e: any) { Alert.alert("Failed", e.message); }
  };

  if (!c) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={22} color={colors.textPrimary} /></Pressable>
        <Text style={styles.title}>Campaign Details</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.card}>
          <Feather name="zap" size={32} color={colors.secondary} />
          <Text style={styles.taskTitle}>{c.title}</Text>
          <Text style={styles.subtitle}>External rewards — no app points awarded</Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}><Feather name="alert-circle" size={16} color={colors.primary} /><Text style={styles.sectionTitle}>Rules</Text></View>
          <Text style={styles.body}>{c.rules}</Text>
        </View>

        <Pressable testID="campaign-help-btn" style={styles.helpBtn} onPress={() => Alert.alert("Get Help", "Contact support via Profile → Help & Support")}>
          <Feather name="help-circle" size={16} color={colors.textSecondary} />
          <Text style={styles.helpText}>Get Help</Text>
        </Pressable>

        {!started ? (
          <Pressable testID="campaign-start-btn" style={styles.startBtn} onPress={() => setStarted(true)}>
            <Text style={styles.startText}>Start Campaign</Text>
            <Feather name="arrow-right" size={20} color="#fff" />
          </Pressable>
        ) : (
          <Pressable testID="campaign-paid-btn" style={[styles.startBtn, { backgroundColor: colors.secondary }]} onPress={() => setConfirm(true)}>
            <Feather name="check" size={20} color="#fff" />
            <Text style={styles.startText}>Payment Received</Text>
          </Pressable>
        )}
      </ScrollView>

      <Modal visible={confirm} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.confirmCard}>
            <Feather name="alert-circle" size={36} color={colors.secondary} />
            <Text style={styles.confirmTitle}>Confirm Payment Received?</Text>
            <Text style={styles.confirmBody}>This will record the campaign in your withdrawal history. No app points are credited.</Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setConfirm(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={styles.okBtn} onPress={onConfirm}><Text style={styles.okText}>Confirm</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  title: { fontFamily: fonts.heading, fontSize: 18 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.lg, alignItems: "center", ...shadows.light },
  taskTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.textPrimary, marginTop: 12, textAlign: "center" },
  subtitle: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  sectionCard: { backgroundColor: colors.surface, borderRadius: radius.image, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 14, color: colors.textPrimary },
  body: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  helpBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, marginTop: spacing.md },
  helpText: { fontFamily: fonts.body, color: colors.textSecondary, fontSize: 13 },
  startBtn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radius.button, marginTop: spacing.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, ...shadows.heavy },
  startText: { color: "#fff", fontFamily: fonts.heading, fontSize: 15 },
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: 20 },
  confirmCard: { backgroundColor: "#fff", borderRadius: radius.card, padding: spacing.xl, alignItems: "center", width: "100%", maxWidth: 360 },
  confirmTitle: { fontFamily: fonts.heading, fontSize: 18, marginTop: 12, color: colors.textPrimary },
  confirmBody: { fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 6, textAlign: "center" },
  confirmActions: { flexDirection: "row", gap: 8, marginTop: spacing.lg, width: "100%" },
  cancelBtn: { flex: 1, padding: 14, borderRadius: radius.button, backgroundColor: colors.surfaceVariant, alignItems: "center" },
  okBtn: { flex: 1, padding: 14, borderRadius: radius.button, backgroundColor: colors.primary, alignItems: "center" },
  cancelText: { fontFamily: fonts.heading, color: colors.textSecondary },
  okText: { fontFamily: fonts.heading, color: "#fff" },
});
