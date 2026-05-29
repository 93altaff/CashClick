// Device ID + user session helpers
import * as Application from "expo-application";
import { Platform } from "react-native";
import { storage } from "@/src/utils/storage";

const DEVICE_ID_KEY = "cashclick_device_id";
const USER_KEY = "cashclick_user";

function randomId() {
  return "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function getDeviceId(): Promise<string> {
  // Prefer system-provided IDs (Android ID / iOS identifierForVendor) so cloned apps
  // on the same device share the same id; fall back to a stored random id.
  const cached = await storage.getItem<string>(DEVICE_ID_KEY, "");
  if (cached) return cached as string;
  let id = "";
  try {
    if (Platform.OS === "android") {
      id = (Application.getAndroidId?.() as string | null) || "";
    } else if (Platform.OS === "ios") {
      id = ((await Application.getIosIdForVendorAsync?.()) as string | null) || "";
    }
  } catch {}
  if (!id) id = randomId();
  await storage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export type SessionUser = {
  id: string;
  device_id: string;
  username: string;
  mobile: string;
  points: number;
  total_earned: number;
  total_withdrawn: number;
};

export async function saveUser(u: SessionUser) {
  await storage.setItem(USER_KEY, JSON.stringify(u));
}

export async function loadUser(): Promise<SessionUser | null> {
  const v = await storage.getItem<string>(USER_KEY, "");
  if (!v) return null;
  try { return JSON.parse(v as string); } catch { return null; }
}

export async function clearSession() {
  await storage.removeItem(USER_KEY);
}

const ADMIN_TOKEN_KEY = "cashclick_admin_token";
export async function saveAdminToken(t: string) {
  await storage.setItem(ADMIN_TOKEN_KEY, t);
}
export async function loadAdminToken(): Promise<string | null> {
  const v = await storage.getItem<string>(ADMIN_TOKEN_KEY, "");
  return (v as string) || null;
}
export async function clearAdminToken() {
  await storage.removeItem(ADMIN_TOKEN_KEY);
}
