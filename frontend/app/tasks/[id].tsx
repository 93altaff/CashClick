// Task detail screen with form submission
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert, Modal, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { getDeviceId } from "@/src/auth";
import TutorialVideo from "@/src/components/TutorialVideo";

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<any>(null);
  const [supportUrl, setSupportUrl] = useState<string>("");
  const [show, setShow] = useState(false);
  const [data, setData] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const did = await getDeviceId();
    try {
      const [t, cfg] = await Promise.all([
        api.get(`/tasks/${id}?device_id=${encodeURIComponent(did)}`),
        api.get(`/config`),
      ]);
      setTask(t);
      setSupportUrl(cfg?.support_url || "");
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  useEffect(() => { load(); }, [id]);

  const onSubmit = async () => {
    setConfirm(false); setSubmitting(true);
    try {
      const did = await getDeviceId();
      await api.post("/tasks/submit", { device_id: did, task_id: id, form_data: data });
      Alert.alert("Submitted!", "Your task is under review.");
      await load();
      setShow(false);
    } catch (e: any) { Alert.alert("Failed", e.message); }
    finally { setSubmitting(false); }
  };

  if (!task) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  const sub = task.my_submission;
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={22} color={colors.textPrimary} /></Pressable>
        <Text style={styles.title}>Task Details</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.card}>
          <Text style={styles.taskTitle}>{task.title}</Text>
          <View style={styles.rewardBadge}><Feather name="award" size={14} color="#fff" /><Text style={styles.rewardText}>₹{task.reward}</Text></View>
        </View>

        <SectionCard title="Rules" icon="alert-circle">
          <Text style={styles.body}>{task.rules}</Text>
        </SectionCard>

        {task.tutorial_url ? (
          <SectionCard title="Tutorial Video" icon="play-circle">
            <TutorialVideo url={task.tutorial_url} height={200} />
          </SectionCard>
        ) : null}

        <Pressable testID="task-help-btn" style={styles.helpBtn} onPress={() => {
          if (supportUrl) Linking.openURL(supportUrl).catch(() => Alert.alert("Cannot open", supportUrl));
          else Alert.alert("Get Help", "Support is not configured yet.");
        }}>
          <Feather name="help-circle" size={16} color={colors.textSecondary} />
          <Text style={styles.helpText}>Get Help</Text>
        </Pressable>

        {sub ? (
          <View style={[styles.statusCard, { backgroundColor: sub.status === "approved" ? "#D1FAE5" : sub.status === "rejected" ? "#FEE2E2" : "#FEF3C7" }]}>
            <Feather name={sub.status === "approved" ? "check-circle" : sub.status === "rejected" ? "x-circle" : "clock"} size={20} color={sub.status === "approved" ? colors.primaryDark : sub.status === "rejected" ? colors.error : colors.secondaryDark} />
            <Text style={[styles.statusText, { color: sub.status === "approved" ? colors.primaryDark : sub.status === "rejected" ? colors.error : colors.secondaryDark }]}>
              {sub.status === "approved" ? "Approved — Points credited" : sub.status === "rejected" ? "Rejected" : "Under Review"}
            </Text>
          </View>
        ) : !show ? (
          <Pressable testID="task-start-btn" style={styles.startBtn} onPress={() => {
            if (task.cta_url) Linking.openURL(task.cta_url).catch(() => {});
            setShow(true);
          }}>
            <Text style={styles.startText}>Start Task</Text>
            <Feather name="arrow-right" size={20} color="#fff" />
          </Pressable>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Submission Form</Text>
            {(task.form_fields || []).map((f: any) => (
              <View key={f.key} style={{ marginTop: 12 }}>
                <Text style={styles.label}>{f.label}</Text>
                <TextInput
                  testID={`task-field-${f.key}`}
                  value={data[f.key] || ""}
                  onChangeText={(t) => setData((d) => ({ ...d, [f.key]: t }))}
                  style={styles.input}
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            ))}
            <Pressable testID="task-submit-btn" style={styles.startBtn} onPress={() => setConfirm(true)}>
              <Text style={styles.startText}>Submit for Review</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal visible={confirm} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.confirmCard}>
            <Feather name="alert-circle" size={36} color={colors.secondary} />
            <Text style={styles.confirmTitle}>Confirm Submission?</Text>
            <Text style={styles.confirmBody}>Please ensure all details are accurate. Once submitted, you cannot edit until reviewed.</Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setConfirm(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={styles.okBtn} onPress={onSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.okText}>Confirm</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: any; children: any }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHead}><Feather name={icon} size={16} color={colors.primary} /><Text style={styles.sectionTitle}>{title}</Text></View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  title: { fontFamily: fonts.heading, fontSize: 18 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.lg, ...shadows.light, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  taskTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary, flex: 1 },
  rewardBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  rewardText: { color: "#fff", fontFamily: fonts.heading, fontSize: 14 },
  sectionCard: { backgroundColor: colors.surface, borderRadius: radius.image, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 14, color: colors.textPrimary },
  body: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  linkText: { color: colors.primary, fontFamily: fonts.heading, fontSize: 13 },
  helpBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, marginTop: spacing.md },
  helpText: { fontFamily: fonts.body, color: colors.textSecondary, fontSize: 13 },
  startBtn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radius.button, marginTop: spacing.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, ...shadows.heavy },
  startText: { color: "#fff", fontFamily: fonts.heading, fontSize: 15 },
  statusCard: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: radius.image, marginTop: spacing.md },
  statusText: { fontFamily: fonts.heading, fontSize: 14 },
  formCard: { marginTop: spacing.md, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.image, borderWidth: 1, borderColor: colors.border },
  formTitle: { fontFamily: fonts.heading, fontSize: 14, color: colors.textPrimary },
  label: { fontFamily: fonts.body, fontSize: 11, color: colors.textTertiary, marginBottom: 4, letterSpacing: 0.5 },
  input: { backgroundColor: colors.surfaceVariant, borderRadius: radius.button, padding: 12, fontFamily: fonts.body, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
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
