const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

export const API_BASE = (localStorage.getItem("API_BASE") || DEFAULT_API_BASE).trim();

function getToken() {
  return localStorage.getItem("fortune_token") || null;
}

export function setToken(token) {
  if (token) localStorage.setItem("fortune_token", token);
  else localStorage.removeItem("fortune_token");
}

export function getUser() {
  const raw = localStorage.getItem("fortune_user");
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function setUser(user) {
  if (user) localStorage.setItem("fortune_user", JSON.stringify(user));
  else localStorage.removeItem("fortune_user");
}

export function logout() {
  setToken(null);
  setUser(null);
  location.reload();
}

async function jreq(method, path, body) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function jpost(path, body) { return jreq("POST", path, body); }
async function jget(path) { return jreq("GET", path); }
async function jdelete(path) { return jreq("DELETE", path); }

export function setApiBase(next) {
  localStorage.setItem("API_BASE", next);
  location.reload();
}

export async function calcSaju(input) {
  return jpost("/api/saju/calc", input);
}

export async function calcGunghap(a, b) {
  return jpost("/api/gunghap", { a, b });
}

export async function calcDaily(input) {
  return jpost("/api/daily", input);
}

export async function getDailyGanzhi() {
  return jget("/api/daily/today-ganzhi");
}

export async function apiLogin(email, password) {
  return jpost("/api/auth/login", { email, password });
}

export async function apiRegister(email, password, name) {
  return jpost("/api/auth/register", { email, password, name });
}

export async function getVapidPublicKey() {
  return jget("/api/push/vapid-public");
}

export async function subscribePush(subscription) {
  return jpost("/api/push/subscribe", { subscription });
}

export async function unsubscribePush() {
  return jdelete("/api/push/subscribe");
}
