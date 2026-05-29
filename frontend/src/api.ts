// API client for CashClick
const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

async function req<T = any>(method: string, path: string, body?: any, token?: string): Promise<T> {
  const url = `${BASE}/api${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["X-Admin-Token"] = token;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.detail || data?.message || `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

export const api = {
  get: <T = any>(p: string, token?: string) => req<T>("GET", p, undefined, token),
  post: <T = any>(p: string, body?: any, token?: string) => req<T>("POST", p, body, token),
  del: <T = any>(p: string, token?: string) => req<T>("DELETE", p, undefined, token),
};

export const BACKEND_URL = BASE;
