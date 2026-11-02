import * as sync from "./sync.js";
import { initUI } from "./ui.js";
import { initMobile } from "./mobile.js";
import { initNative } from "./native.js";

// Trap window.storage before the journal's bundle assigns it, so every write is noticed
// and the first reads wait (briefly) for the cloud copy.
let raw = null, wrapped = null;
const gate = (async () => { try { await sync.initialPull(6000); } catch {} })();
function wrap(s) {
  raw = s; sync.attach(s);
  wrapped = {
    async get(k, sh) { await gate; return s.get(k, sh); },
    async list(p, sh) { await gate; return s.list(p, sh); },
    async set(k, v, sh) { const r = await s.set(k, v, sh); sync.noteLocalWrite(k); return r; },
    async delete(k, sh) { const r = await s.delete(k, sh); return r; },
  };
}
Object.defineProperty(window, "storage", { configurable: true, get: () => wrapped || undefined, set: (v) => wrap(v) });

sync.startBackground();
window.addEventListener("DOMContentLoaded", () => {
  initUI(); initMobile(); initNative();
  setTimeout(() => sync.markMounted(), 1500);
});
