// Sync engine for the journal's own storage (IndexedDB, via window.storage) <-> Firebase.
// Rules: newest write wins, per key. Deletions are not synced. Screenshots (trade_img:/news_img:)
// stay on the device. On a device's FIRST sync, the cloud copy wins for keys that exist in both.
import * as fb from "./firebase.js";

const CFG_KEY = "sweetspot-sync-config";
const META_KEY = "sweetspot-sync-meta";
const SKIP = ["trade_img:", "news_img:"];
const syncable = (k) => typeof k === "string" && !SKIP.some((p) => k.startsWith(p));

let inner = null;
let T = { ready: fb.ready, signedIn: fb.signedIn, manifest: fb.manifest, get: fb.get, put: fb.put };
let state = { status: "off", message: "Sign in to sync", last: 0, needsReload: false };
const listeners = new Set();
let running = false, again = false, timer = null, mounted = false;

export const attach = (storage) => { inner = storage; };
export const setTransport = (t) => { T = t; };
export const markMounted = () => { mounted = true; };
export const authApi = { ready: () => T.ready(), signedIn: () => fb.signedIn(), isConfigured: fb.isConfigured, signIn: fb.signIn, signUp: fb.signUp, signOut: fb.signOut, onAuth: fb.onAuth, user: fb.currentUser };
const emit = (p) => { state = { ...state, ...p }; listeners.forEach((f) => f(state)); };
export const subscribe = (f) => { listeners.add(f); f(state); return () => listeners.delete(f); };

const getCfg = () => { try { return JSON.parse(localStorage.getItem(CFG_KEY) || "{}"); } catch { return {}; } };
const saveCfg = (p) => { try { localStorage.setItem(CFG_KEY, JSON.stringify({ ...getCfg(), ...p })); } catch {} };
const readMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); } catch { return {}; } };
const writeMeta = (m) => { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch {} };

async function localKeys() { const r = await inner.list("", false); return (r.keys || []).filter(syncable); }
async function readLocal(k) { try { const r = await inner.get(k, false); return r && typeof r.value === "string" ? r.value : null; } catch { return null; } }

export function noteLocalWrite(key) {
  if (!syncable(key)) return;
  const m = readMeta(); m[key] = Date.now(); writeMeta(m);
  scheduleSync();
}
export function scheduleSync(ms = 3000) {
  if (!T.signedIn()) return;
  clearTimeout(timer);
  timer = setTimeout(() => syncNow(), ms);
}

export async function syncNow() {
  if (!inner) return;
  await T.ready();
  if (!T.signedIn()) { emit({ status: "off", message: "Sign in to sync" }); return; }
  if (running) { again = true; return; }
  running = true;
  emit({ status: "syncing", message: "Syncing..." });
  try {
    const cfg = getCfg(); const meta = readMeta();
    const items = await T.manifest();
    const remote = new Map(items.map((i) => [i.key, i.t]));
    const local = new Set(await localKeys());
    const pulls = [], pushes = [];
    for (const [key, rt] of remote) {
      const lt = meta[key] || 1;
      if (!local.has(key)) pulls.push(key);
      else if (!cfg.initialDone) pulls.push(key);
      else if (rt > lt) pulls.push(key);
      else if (lt > rt) pushes.push(key);
    }
    for (const key of local) if (!remote.has(key)) pushes.push(key);
    let changed = 0;
    for (const key of pulls) {
      const r = await T.get(key);
      if ((await readLocal(key)) !== r.value) { await inner.set(key, r.value, false); changed++; }
      meta[key] = r.t;
    }
    for (const key of pushes) {
      const v = await readLocal(key); if (v === null) continue;
      const t = meta[key] || Date.now();
      await T.put(key, t, v); meta[key] = t;
    }
    writeMeta(meta); saveCfg({ initialDone: true });
    emit({ status: "ok", last: Date.now(), message: `Synced (${pulls.length} down, ${pushes.length} up)`, needsReload: state.needsReload || (mounted && changed > 0) });
  } catch (e) {
    emit({ status: "error", message: String((e && e.message) || e) });
  } finally {
    running = false;
    if (again) { again = false; scheduleSync(500); }
  }
}
export async function initialPull(ms = 6000) {
  await Promise.race([syncNow(), new Promise((r) => setTimeout(r, ms))]);
}
export function startBackground() {
  setInterval(() => { if (document.visibilityState === "visible") syncNow(); }, 60000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") syncNow(); });
  window.addEventListener("online", () => syncNow());
}
