// Generic admin manage screen for all entity types.
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Modal, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { loadAdminToken } from "@/src/auth";

type Field = { key: string; label: string; type: "text" | "number" | "bool" | "json"; placeholder?: string };

const SCHEMA: Record<string, { title: string; list: string; upsert: string; del?: string; fields: Field[]; status?: string[] }> = {
  banners: {
    title: "Banners", list: "/admin/banners", upsert: "/admin/banners/upsert", del: "/admin/banners/:id",
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "text" },
      { key: "image", label: "Image URL", type: "text" },
      { key: "url", label: "Tap URL", type: "text" },
      { key: "is_external", label: "External URL?", type: "bool" },
      { key: "pinned", label: "Pinned?", type: "bool" },
      { key: "hidden", label: "Hidden?", type: "bool" },
      { key: "order", label: "Order", type: "number" },
    ],
  },
  tasks: {
    title: "Tasks", list: "/admin/tasks", upsert: "/admin/tasks/upsert", del: "/admin/tasks/:id",
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "reward", label: "Reward (₹)", type: "number" },
      { key: "rules", label: "Rules", type: "text" },
      { key: "tutorial_url", label: "Tutorial URL", type: "text" },
      { key: "form_fields", label: 'Form Fields JSON e.g. [{"key":"email","label":"Email","type":"text"}]', type: "json" },
      { key: "status", label: "Status (active/inactive)", type: "text" },
    ],
  },
  campaigns: {
    title: "Campaigns", list: "/admin/campaigns", upsert: "/admin/campaigns/upsert", del: "/admin/campaigns/:id",
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "rules", label: "Rules", type: "text" },
      { key: "tutorial_url", label: "Tutorial URL", type: "text" },
      { key: "status", label: "Status", type: "text" },
    ],
  },
  visits: {
    title: "Visit & Earn", list: "/admin/visits", upsert: "/admin/visits/upsert", del: "/admin/visits/:id",
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "url", label: "URL", type: "text" },
      { key: "reward_min", label: "Reward Min", type: "number" },
      { key: "reward_max", label: "Reward Max", type: "number" },
      { key: "status", label: "Status", type: "text" },
    ],
  },
  quick_access: {
    title: "Quick Access", list: "/admin/quick-access", upsert: "/admin/quick-access", del: "/admin/quick-access/:id",
    fields: [
      { key: "label", label: "Label", type: "text" },
      { key: "icon", label: "Icon (feather name)", type: "text" },
      { key: "url", label: "URL", type: "text" },
      { key: "order", label: "Order", type: "number" },
    ],
  },
};

export default function ManageScreen() {
  const router = useRouter();
  const { type, status } = useLocalSearchParams<{ type: string; status?: string }>();
  const [token, setToken] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [deduct, setDeduct] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { (async () => { const t = await loadAdminToken(); if (!t) router.replace("/admin/login"); else setToken(t); })(); }, [router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (type === "users") {
        setItems(await api.get(`/admin/users${search ? `?q=${encodeURIComponent(search)}` : ""}`, token));
      } else if (type === "active_users") {
        setItems(await api.get(`/admin/users/active`, token));
      } else if (type === "withdrawals") {
        setItems(await api.get(`/admin/withdrawals${status ? `?status=${status}` : ""}`, token));
      } else if (type === "task_subs") {
        setItems(await api.get(`/admin/task-submissions?status=pending`, token));
      } else if (type === "games_config") {
        setItems(await api.get(`/admin/games-config`, token));
      } else if (type === "config") {
        const cfg = await api.get(`/config`);
        setItems([cfg]);
      } else {
        const schema = SCHEMA[type as string];
        if (schema) setItems(await api.get(schema.list, token));
      }
    } catch (e: any) { Alert.alert("Failed", e.message); }
    finally { setLoading(false); }
  }, [token, type, search, status]);

  useEffect(() => { load(); }, [load]);

  const onAdd = () => {
    const schema = SCHEMA[type as string];
    if (!schema) return;
    const init: any = {};
    schema.fields.forEach((f) => { init[f.key] = f.type === "bool" ? false : f.type === "number" ? 0 : ""; });
    setEditing(init);
  };

  const onEdit = (it: any) => {
    const schema = SCHEMA[type as string];
    if (!schema) return;
    const data: any = { id: it.id };
    schema.fields.forEach((f) => {
      data[f.key] = f.type === "json" ? JSON.stringify(it[f.key] ?? "", null, 2) : it[f.key];
    });
    setEditing(data);
  };

  const onSave = async () => {
    if (!token || !editing) return;
    const schema = SCHEMA[type as string];
    if (!schema) return;
    const payload: any = { id: editing.id || undefined };
    for (const f of schema.fields) {
      let v = editing[f.key];
      if (f.type === "number") v = parseInt(String(v || 0), 10);
      if (f.type === "bool") v = !!v;
      if (f.type === "json") { try { v = JSON.parse(v || "null"); } catch { return Alert.alert("Invalid JSON", `${f.label} must be valid JSON`); } }
      payload[f.key] = v;
    }
    try { await api.post(schema.upsert, payload, token); setEditing(null); load(); }
    catch (e: any) { Alert.alert("Failed", e.message); }
  };

  const onDelete = async (it: any) => {
    const schema = SCHEMA[type as string];
    if (!schema?.del) return;
    Alert.alert("Delete?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try { await api.del(schema.del!.replace(":id", it.id), token!); load(); }
          catch (e: any) { Alert.alert("Failed", e.message); }
      } }
    ]);
  };

  const onWdAction = async (it: any, action: string) => {
    try {
      const payload: any = { withdrawal_id: it.id, action };
      if (action === "rejected" || action === "deducted") payload.reason = reason;
      if (action === "deducted") payload.deduct_amount = parseInt(deduct || "0", 10);
      await api.post(`/admin/withdrawals/action`, payload, token!);
      setReason(""); setDeduct(""); setEditing(null); load();
    } catch (e: any) { Alert.alert("Failed", e.message); }
  };

  const onTaskAction = async (it: any, action: string) => {
    try { await api.post(`/admin/task-submissions/action`, { submission_id: it.id, action }, token!); load(); }
    catch (e: any) { Alert.alert("Failed", e.message); }
  };

  const onGameCfgSave = async () => {
    if (!editing) return;
    try { await api.post(`/admin/games-config`, {
        id: editing.id,
        chances: parseInt(String(editing.chances || 0), 10),
        reward_min: parseInt(String(editing.reward_min || 0), 10),
        reward_max: parseInt(String(editing.reward_max || 0), 10),
      }, token!); setEditing(null); load(); }
    catch (e: any) { Alert.alert("Failed", e.message); }
  };

  const onConfigSave = async () => {
    if (!editing) return;
    const payload: any = {};
    [
      "conversion_rate","refer_reward","refer_qualify_points","min_withdraw","app_version",
    ].forEach((k) => { if (editing[k] !== undefined) payload[k] = isNaN(Number(editing[k])) ? editing[k] : Number(editing[k]); });
    if (editing.force_update !== undefined) payload.force_update = !!editing.force_update;
    if (editing.refer_qualify_modes) try { payload.refer_qualify_modes = JSON.parse(editing.refer_qualify_modes); } catch {}
    if (editing.refer_checkin_rewards) try { payload.refer_checkin_rewards = JSON.parse(editing.refer_checkin_rewards); } catch {}
    if (editing.withdraw_chips) try { payload.withdraw_chips = JSON.parse(editing.withdraw_chips); } catch {}
    if (editing.ad_config) try { payload.ad_config = JSON.parse(editing.ad_config); } catch {}
    try { await api.post(`/admin/config`, payload, token!); setEditing(null); load(); }
    catch (e: any) { Alert.alert("Failed", e.message); }
  };

  const schema = SCHEMA[type as string];
  const title = (schema?.title) || ({
    users: "Users", active_users: "Active Users", withdrawals: "Withdrawals", task_subs: "Task Requests",
    games_config: "Games Config", config: "App Settings",
  } as any)[type as string] || type;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={22} color={colors.textPrimary} /></Pressable>
        <Text style={styles.title}>{title}</Text>
        {schema ? (
          <Pressable onPress={onAdd} style={styles.backBtn}><Feather name="plus" size={22} color={colors.primary} /></Pressable>
        ) : <View style={{ width: 44 }} />}
      </View>
      {(type === "users") && (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search username or mobile" placeholderTextColor={colors.textTertiary} style={styles.input} />
        </View>
      )}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
          {/* Users */}
          {(type === "users" || type === "active_users") && items.map((u: any) => (
            <View key={u.id || u.device_id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>@{u.username}</Text>
                <Text style={styles.rowMeta}>{u.mobile} · {u.points} pts · earned {u.total_earned}</Text>
                <Text style={styles.rowMeta}>Last active: {u.last_active ? new Date(u.last_active).toLocaleString() : "never"}</Text>
              </View>
            </View>
          ))}

          {/* Withdrawals */}
          {type === "withdrawals" && items.map((w: any) => (
            <View key={w.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>₹{w.amount} · @{w.username || "?"}</Text>
                <Text style={styles.rowMeta}>{w.method?.toUpperCase()} · {w.status?.toUpperCase()}</Text>
                <Text style={styles.rowMeta}>{new Date(w.created_at).toLocaleString()}</Text>
                <Text style={styles.rowMeta} numberOfLines={2}>{JSON.stringify(w.details)}</Text>
                {w.reason ? <Text style={styles.rowReason}>Reason: {w.reason}</Text> : null}
              </View>
              {w.status === "pending" && (
                <View style={{ gap: 6 }}>
                  <Pressable style={[styles.smallBtn, { backgroundColor: colors.primary }]} onPress={() => onWdAction(w, "paid")}><Text style={styles.smallBtnText}>Pay</Text></Pressable>
                  <Pressable style={[styles.smallBtn, { backgroundColor: colors.error }]} onPress={() => { setEditing({ wdAction: "rejected", w }); }}><Text style={styles.smallBtnText}>Reject</Text></Pressable>
                  <Pressable style={[styles.smallBtn, { backgroundColor: colors.secondary }]} onPress={() => { setEditing({ wdAction: "deducted", w }); }}><Text style={styles.smallBtnText}>Deduct</Text></Pressable>
                </View>
              )}
            </View>
          ))}

          {/* Task submissions */}
          {type === "task_subs" && items.map((s: any) => (
            <View key={s.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{s.task_title}</Text>
                <Text style={styles.rowMeta}>@{s.username} · ₹{s.reward}</Text>
                <Text style={styles.rowMeta} numberOfLines={2}>{JSON.stringify(s.form_data)}</Text>
              </View>
              <View style={{ gap: 6 }}>
                <Pressable style={[styles.smallBtn, { backgroundColor: colors.primary }]} onPress={() => onTaskAction(s, "approve")}><Text style={styles.smallBtnText}>Approve</Text></Pressable>
                <Pressable style={[styles.smallBtn, { backgroundColor: colors.error }]} onPress={() => onTaskAction(s, "reject")}><Text style={styles.smallBtnText}>Reject</Text></Pressable>
                <Pressable style={[styles.smallBtn, { backgroundColor: colors.textTertiary }]} onPress={() => onTaskAction(s, "reset")}><Text style={styles.smallBtnText}>Reset</Text></Pressable>
              </View>
            </View>
          ))}

          {/* Games config */}
          {type === "games_config" && items.map((g: any) => (
            <Pressable key={g.id} style={styles.row} onPress={() => setEditing({ ...g })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{g.name}</Text>
                <Text style={styles.rowMeta}>Chances: {g.chances} · Reward: {g.reward_min}-{g.reward_max}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.textTertiary} />
            </Pressable>
          ))}

          {/* Config */}
          {type === "config" && items.map((cfg: any) => (
            <Pressable key={cfg.key} style={styles.row} onPress={() => setEditing({
              conversion_rate: String(cfg.conversion_rate),
              refer_reward: String(cfg.refer_reward),
              refer_qualify_points: String(cfg.refer_qualify_points),
              refer_qualify_modes: JSON.stringify(cfg.refer_qualify_modes || []),
              refer_checkin_rewards: JSON.stringify(cfg.refer_checkin_rewards || {}, null, 2),
              withdraw_chips: JSON.stringify(cfg.withdraw_chips || []),
              min_withdraw: String(cfg.min_withdraw),
              ad_config: JSON.stringify(cfg.ad_config || {}, null, 2),
              app_version: cfg.app_version,
              force_update: cfg.force_update,
            })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>App Configuration</Text>
                <Text style={styles.rowMeta}>Conv rate: {cfg.conversion_rate} · Refer: {cfg.refer_reward} pts</Text>
                <Text style={styles.rowMeta}>Min withdraw: ₹{cfg.min_withdraw} · v{cfg.app_version}</Text>
              </View>
              <Feather name="edit-2" size={18} color={colors.primary} />
            </Pressable>
          ))}

          {/* Schema-based entities */}
          {schema && items.map((it: any) => (
            <Pressable key={it.id} style={styles.row} onPress={() => onEdit(it)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{it.title || it.label || it.name}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>{it.subtitle || it.rules || it.url || ""}</Text>
              </View>
              {schema.del ? (
                <Pressable onPress={() => onDelete(it)} style={styles.delBtn}>
                  <Feather name="trash-2" size={16} color={colors.error} />
                </Pressable>
              ) : null}
            </Pressable>
          ))}

          {items.length === 0 && (
            <View style={styles.empty}><Text style={styles.emptyText}>No items yet.</Text></View>
          )}
        </ScrollView>
      )}

      {/* Generic schema edit modal */}
      <Modal visible={!!editing && schema} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>{editing?.id ? "Edit" : "Add"} {schema?.title?.slice(0, -1)}</Text>
            <ScrollView style={{ maxHeight: 500 }}>
              {schema?.fields.map((f) => (
                <View key={f.key} style={{ marginBottom: 10 }}>
                  <Text style={styles.label}>{f.label}</Text>
                  {f.type === "bool" ? (
                    <Pressable style={[styles.toggle, !!editing?.[f.key] && { backgroundColor: colors.primary }]} onPress={() => setEditing((e: any) => ({ ...e, [f.key]: !e[f.key] }))}>
                      <Text style={[styles.toggleText, !!editing?.[f.key] && { color: "#fff" }]}>{editing?.[f.key] ? "Yes" : "No"}</Text>
                    </Pressable>
                  ) : (
                    <TextInput
                      value={String(editing?.[f.key] ?? "")}
                      onChangeText={(t) => setEditing((e: any) => ({ ...e, [f.key]: t }))}
                      style={[styles.input, f.type === "json" && { minHeight: 80, textAlignVertical: "top" }]}
                      multiline={f.type === "json"}
                      keyboardType={f.type === "number" ? "number-pad" : "default"}
                      placeholderTextColor={colors.textTertiary}
                    />
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={styles.editActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditing(null)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={styles.saveBtn} onPress={onSave}><Text style={styles.saveText}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Games config modal */}
      <Modal visible={!!editing && type === "games_config"} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>Edit {editing?.name}</Text>
            <Text style={styles.label}>Chances</Text>
            <TextInput value={String(editing?.chances || "")} onChangeText={(t) => setEditing((e: any) => ({ ...e, chances: t }))} style={styles.input} keyboardType="number-pad" />
            <Text style={styles.label}>Reward Min</Text>
            <TextInput value={String(editing?.reward_min || "")} onChangeText={(t) => setEditing((e: any) => ({ ...e, reward_min: t }))} style={styles.input} keyboardType="number-pad" />
            <Text style={styles.label}>Reward Max</Text>
            <TextInput value={String(editing?.reward_max || "")} onChangeText={(t) => setEditing((e: any) => ({ ...e, reward_max: t }))} style={styles.input} keyboardType="number-pad" />
            <View style={styles.editActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditing(null)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={styles.saveBtn} onPress={onGameCfgSave}><Text style={styles.saveText}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Config modal */}
      <Modal visible={!!editing && type === "config"} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.editCard}>
            <ScrollView style={{ maxHeight: 540 }}>
              <Text style={styles.editTitle}>App Configuration</Text>
              {["conversion_rate","refer_reward","refer_qualify_points","min_withdraw","app_version"].map((k) => (
                <View key={k} style={{ marginBottom: 8 }}>
                  <Text style={styles.label}>{k.replace(/_/g, " ")}</Text>
                  <TextInput value={String(editing?.[k] ?? "")} onChangeText={(t) => setEditing((e: any) => ({ ...e, [k]: t }))} style={styles.input} />
                </View>
              ))}
              {["refer_qualify_modes","refer_checkin_rewards","withdraw_chips","ad_config"].map((k) => (
                <View key={k} style={{ marginBottom: 8 }}>
                  <Text style={styles.label}>{k} (JSON)</Text>
                  <TextInput value={String(editing?.[k] ?? "")} onChangeText={(t) => setEditing((e: any) => ({ ...e, [k]: t }))} style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]} multiline />
                </View>
              ))}
              <View style={{ marginBottom: 8 }}>
                <Text style={styles.label}>force_update</Text>
                <Pressable style={[styles.toggle, !!editing?.force_update && { backgroundColor: colors.primary }]} onPress={() => setEditing((e: any) => ({ ...e, force_update: !e?.force_update }))}>
                  <Text style={[styles.toggleText, !!editing?.force_update && { color: "#fff" }]}>{editing?.force_update ? "Yes" : "No"}</Text>
                </Pressable>
              </View>
            </ScrollView>
            <View style={styles.editActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditing(null)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={styles.saveBtn} onPress={onConfigSave}><Text style={styles.saveText}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Withdrawal action modal */}
      <Modal visible={!!editing?.wdAction} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>{editing?.wdAction === "rejected" ? "Reject Withdrawal" : "Deduct Amount"}</Text>
            <Text style={styles.label}>Reason</Text>
            <TextInput value={reason} onChangeText={setReason} style={styles.input} placeholder="Reason" placeholderTextColor={colors.textTertiary} />
            {editing?.wdAction === "deducted" && (
              <>
                <Text style={styles.label}>Deduct amount (₹)</Text>
                <TextInput value={deduct} onChangeText={setDeduct} style={styles.input} keyboardType="number-pad" />
              </>
            )}
            <View style={styles.editActions}>
              <Pressable style={styles.cancelBtn} onPress={() => { setEditing(null); setReason(""); setDeduct(""); }}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={styles.saveBtn} onPress={() => onWdAction(editing.w, editing.wdAction)}><Text style={styles.saveText}>Confirm</Text></Pressable>
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
  title: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: colors.surface, borderRadius: radius.image, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  rowTitle: { fontFamily: fonts.heading, color: colors.textPrimary, fontSize: 14 },
  rowMeta: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  rowReason: { fontFamily: fonts.regular, color: colors.error, fontSize: 12, marginTop: 2 },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  smallBtnText: { color: "#fff", fontFamily: fonts.heading, fontSize: 11 },
  delBtn: { padding: 8 },
  empty: { padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.image, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  emptyText: { color: colors.textTertiary, fontFamily: fonts.regular },
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: 20 },
  editCard: { backgroundColor: "#fff", borderRadius: radius.card, padding: spacing.lg, width: "100%", maxWidth: 480 },
  editTitle: { fontFamily: fonts.heading, fontSize: 18, marginBottom: 12, color: colors.textPrimary },
  label: { fontFamily: fonts.body, fontSize: 11, color: colors.textTertiary, marginBottom: 4 },
  input: { backgroundColor: colors.surfaceVariant, padding: 12, borderRadius: radius.button, fontFamily: fonts.body, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  toggle: { padding: 12, borderRadius: radius.button, backgroundColor: colors.surfaceVariant, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  toggleText: { fontFamily: fonts.heading, color: colors.textSecondary },
  editActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: radius.button, backgroundColor: colors.surfaceVariant, alignItems: "center" },
  saveBtn: { flex: 1, padding: 14, borderRadius: radius.button, backgroundColor: colors.primary, alignItems: "center" },
  cancelText: { fontFamily: fonts.heading, color: colors.textSecondary },
  saveText: { fontFamily: fonts.heading, color: "#fff" },
});
