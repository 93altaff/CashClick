// Surveys — 10 single-card surveys with native ad, 1× daily.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { getDeviceId } from "@/src/auth";
import RewardPopup from "@/src/components/RewardPopup";
import { AdNative, useInterstitial, useRewarded } from "@/src/components/Ads";

export default function SurveysScreen() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [popup, setPopup] = useState<{ amount: number } | null>(null);
  const interstitial = useInterstitial();
  const adReward = useRewarded(() => submit(1.5));

  const load = async () => {
    const did = await getDeviceId();
    setData(await api.get(`/explore/surveys?device_id=${encodeURIComponent(did)}`));
  };
  useEffect(() => { load(); }, []);

  const select = (opt: number) => {
    const next = [...answers];
    next[idx] = opt;
    setAnswers(next);
    setTimeout(() => {
      if (idx + 1 < (data?.questions?.length || 0)) setIdx(idx + 1);
    }, 200);
  };

  const submit = async (multiplier = 1.0) => {
    try {
      const did = await getDeviceId();
      const r = await api.post("/explore/surveys/submit", { device_id: did, answers, multiplier });
      await interstitial.show();
      setPopup({ amount: r.reward });
      await load();
    } catch (e: any) { Alert.alert("Failed", e.message); }
  };

  if (!data) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  if (data.done) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Header title="Surveys" onBack={() => router.back()} />
        <View style={styles.donePane}>
          <Feather name="check-circle" size={48} color={colors.success} />
          <Text style={styles.doneTitle}>Surveys completed today!</Text>
          <Text style={styles.doneSub}>Earned {data.reward} pts · Come back tomorrow.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const q = data.questions?.[idx];
  const isLast = idx === (data.questions?.length || 0) - 1;
  const finished = answers.length === data.questions.length && answers.every((a) => a !== undefined);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header title="Surveys" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.progress}>{idx + 1} of {data.questions.length}</Text>
        <View style={styles.card}>
          <Text style={styles.question}>{q?.question}</Text>
          <View style={{ marginTop: spacing.md, gap: 8 }}>
            {q?.options?.map((opt: string, i: number) => (
              <Pressable
                key={i}
                testID={`survey-opt-${i}`}
                style={[styles.opt, answers[idx] === i && styles.optSel]}
                onPress={() => select(i)}
              >
                <View style={[styles.radio, answers[idx] === i && styles.radioSel]} />
                <Text style={[styles.optText, answers[idx] === i && { color: colors.primaryDark, fontFamily: fonts.heading }]}>{opt}</Text>
              </Pressable>
            ))}
          </View>
          <AdNative testID="survey-native-ad" />
        </View>

        {finished && (
          <>
            <Pressable testID="survey-submit-btn" style={styles.submitBtn} onPress={() => submit()}><Text style={styles.submitText}>Submit Surveys</Text></Pressable>
            <Pressable style={styles.multiBtn} onPress={() => adReward.show()}>
              <Feather name="play-circle" size={16} color={colors.primaryDark} />
              <Text style={styles.multiText}>Watch ad — 1.5× reward</Text>
            </Pressable>
          </>
        )}

        {!finished && idx > 0 && (
          <Pressable style={styles.backLink} onPress={() => setIdx((i) => Math.max(0, i - 1))}><Text style={styles.backLinkText}>← Previous</Text></Pressable>
        )}
      </ScrollView>
      <RewardPopup visible={!!popup} amount={popup?.amount || 0} title="Surveys Done!" onClaim={() => { setPopup(null); router.back(); }} />
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.backBtn}><Feather name="arrow-left" size={22} color={colors.textPrimary} /></Pressable>
      <Text style={styles.title}>{title}</Text>
      <View style={{ width: 44 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  title: { fontFamily: fonts.heading, fontSize: 18 },
  progress: { fontFamily: fonts.heading, color: colors.primary, fontSize: 12, marginBottom: 8, letterSpacing: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: 12 },
  question: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary, lineHeight: 26 },
  opt: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, backgroundColor: colors.surfaceVariant, borderRadius: radius.button, borderWidth: 1, borderColor: "transparent" },
  optSel: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.textTertiary },
  radioSel: { borderColor: colors.primary, backgroundColor: colors.primary },
  optText: { fontFamily: fonts.body, color: colors.textPrimary, fontSize: 14 },
  submitBtn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radius.button, marginTop: spacing.lg, alignItems: "center", ...shadows.heavy },
  submitText: { color: "#fff", fontFamily: fonts.heading, fontSize: 15 },
  multiBtn: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 8, padding: 12, backgroundColor: colors.primaryLight, borderRadius: radius.button },
  multiText: { color: colors.primaryDark, fontFamily: fonts.heading, fontSize: 13 },
  backLink: { padding: 12 }, backLinkText: { color: colors.textSecondary, fontFamily: fonts.body },
  donePane: { flex: 1, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary, marginTop: 12 },
  doneSub: { fontFamily: fonts.regular, color: colors.textSecondary, marginTop: 4 },
});
