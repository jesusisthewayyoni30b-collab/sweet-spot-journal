// Small "Sync" pill + sign-in panel (plain DOM, no React, so it can sit beside the journal's own bundle).
import { subscribe, syncNow, authApi } from "./sync.js";

const COLORS = { off: "#9aa4b2", syncing: "#f5b800", ok: "#2ecc71", error: "#ff5c5c" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function initUI() {
  const root = document.createElement("div"); root.id = "ss-sync-root";
  document.body.appendChild(root);
  let s = { status: "off", message: "", last: 0, needsReload: false }, open = false, user = null, note = "", email = "";
  subscribe((st) => { s = st; render(); });
  authApi.onAuth((u) => { user = u; if (u) syncNow(); render(); });

  function render() {
    const panel = !open ? "" : `<div class="ss-sync-panel"><div style="font-weight:700;margin-bottom:8px">Cloud sync</div>${
      !authApi.isConfigured() ? `<div class="ss-sync-mute">Firebase isn't set up yet.</div>`
      : user ? `<div class="ss-sync-mute" style="margin-bottom:10px">Signed in as ${esc(user.email)}</div>
          <div class="ss-sync-row"><button class="ss-sync-btn" data-a="sync">Sync now</button><button class="ss-sync-btn grey" data-a="out">Sign out</button></div>`
      : `<label>Email</label><input id="ss-em" type="email" autocapitalize="none" value="${esc(email)}"/>
          <label>Password (6+ characters)</label><input id="ss-pw" type="password"/>
          <div class="ss-sync-row"><button class="ss-sync-btn" data-a="in">Sign in</button><button class="ss-sync-btn grey" data-a="up">Create account</button></div>`
    }<div class="ss-sync-mute" style="margin-top:10px">${esc(note || s.message)}</div>${s.last ? `<div class="ss-sync-mute" style="margin-top:4px">Last sync ${new Date(s.last).toLocaleTimeString()}</div>` : ""}</div>`;
    root.innerHTML = `${s.needsReload ? `<div class="ss-sync-banner">New data arrived from your other device. <button class="ss-sync-btn dark" data-a="reload">Reload</button></div>` : ""}
      <div class="ss-sync-wrap">${panel}<button class="ss-sync-pill" data-a="toggle" aria-label="Sync"><span class="ss-sync-dot" style="background:${COLORS[s.status]}"></span><span class="ss-sync-label">Sync</span></button></div>`;
  }
  root.addEventListener("click", async (e) => {
    const a = e.target.closest("[data-a]"); if (!a) return; const act = a.dataset.a;
    if (act === "toggle") { open = !open; note = ""; render(); }
    else if (act === "reload") location.reload();
    else if (act === "sync") syncNow();
    else if (act === "out") authApi.signOut();
    else if (act === "in" || act === "up") {
      email = root.querySelector("#ss-em").value.trim(); const pw = root.querySelector("#ss-pw").value;
      note = "Working..."; render();
      try { await (act === "up" ? authApi.signUp : authApi.signIn)(email, pw); note = ""; }
      catch (err) { note = String(err.code || err.message || "Failed").replace("auth/", "").replace(/-/g, " "); }
      render();
    }
  });
  render();
}
