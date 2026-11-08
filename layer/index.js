import * as sync from "./sync.js";
import { initUI, initAuthGate } from "./ui.js";
import { initMobile } from "./mobile.js";
import { initNative } from "./native.js";
import { initSelects } from "./select.js";
import { initPickers } from "./pickers.js";
import { initHtmlImport } from "./htmlimport.js";
import { initShare } from "./share.js";
import { initGuide, initThemeMirror } from "./guide.js";

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
const t0 = performance.now();
const hideSplash = () => { const el = document.getElementById("ss-splash"); if (!el) return; el.classList.add("ss-out"); setTimeout(() => el.remove(), 800); };
window.addEventListener("load", () => setTimeout(hideSplash, Math.max(300, 2900 - (performance.now() - t0))));
setTimeout(hideSplash, 6000);
window.addEventListener("DOMContentLoaded", () => {
  initUI(); initMobile(); initSelects(); initPickers(); initHtmlImport(); initGuide(); initShare(); initThemeMirror(); initNative(); initAuthGate();
  setTimeout(() => sync.markMounted(), 1500);
});
