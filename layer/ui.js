// Small "Sync" pill + sign-in panel (plain DOM, no React, so it can sit beside the journal's own bundle).
import { subscribe, syncNow, authApi, scheduleSync } from "./sync.js";
import logo from "./logo.png";

const COLORS = { off: "#9aa4b2", syncing: "#f5b800", ok: "#2ecc71", error: "#ff5c5c" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function initUI() {
  const root = document.createElement("div"); root.id = "ss-sync-root";
  document.body.appendChild(root);
  let s = { status: "off", message: "", last: 0, needsReload: false }, open = false, user = null, note = "", email = "";
  subscribe((st) => { s = st; render(); });
  authApi.onAuth((u) => { user = u; if (u) syncNow(); render(); });

  function render() {
    window.dispatchEvent(new CustomEvent('ss-sync', { detail: s.status }));
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
    else if (act === "out") { try { localStorage.removeItem("ss-auth-skip"); } catch {} await authApi.signOut(); location.reload(); }
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

const FRIENDLY = {
  "auth/invalid-credential": "Wrong email or password.", "auth/wrong-password": "Wrong email or password.", "auth/user-not-found": "No account with that email yet. Tap Create account.",
  "auth/email-already-in-use": "That email already has an account. Tap Sign in instead.", "auth/weak-password": "Password needs at least 6 characters.",
  "auth/invalid-email": "That email doesn't look right.", "auth/missing-password": "Enter your password.", "auth/network-request-failed": "No internet connection.",
  "auth/too-many-requests": "Too many tries. Wait a minute and try again.", "auth/operation-not-allowed": "Email sign-in isn't switched on in Firebase yet.",
  "auth/api-key-not-valid": "The Firebase key in this app is invalid.", "auth/invalid-api-key": "The Firebase key in this app is invalid.",
};
const skipped = () => { try { return localStorage.getItem("ss-auth-skip") === "1"; } catch { return false; } };

export async function initAuthGate() {
  if (!authApi.isConfigured() || skipped()) return;
  try { await Promise.race([authApi.ready(), new Promise((r) => setTimeout(r, 4000))]); } catch {}
  if (authApi.signedIn()) return;
  const el = document.createElement("div"); el.id = "ss-auth";
  let mode = "in", busy = false, msg = "";
  const render = () => {
    el.innerHTML = `<div class="ss-au-grid"></div><form class="ss-au-card" autocomplete="on" novalidate>
      <img class="ss-au-logo" alt="" src="${logo}"><div class="ss-au-h">SWEET SPOT <b>TRADING</b></div>
      <div class="ss-au-tabs"><button type="button" data-m="in" class="${mode === "in" ? "on" : ""}">Sign in</button><button type="button" data-m="up" class="${mode === "up" ? "on" : ""}">Create account</button><i style="transform:translateX(${mode === "in" ? 0 : 100}%)"></i></div>
      <label>Email</label><input name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="you@example.com" required>
      <label>Password</label><input name="password" type="password" autocomplete="${mode === "in" ? "current-password" : "new-password"}" placeholder="${mode === "up" ? "At least 6 characters" : "Your password"}" required>
      <div class="ss-au-msg">${msg.replace(/</g, "&lt;")}</div>
      <button class="ss-au-go" type="submit" ${busy ? "disabled" : ""}>${busy ? "Please wait..." : mode === "in" ? "Sign in" : "Create account"}</button>
      <div class="ss-au-sub">Your journal syncs between the app and the website.</div>
      <button type="button" class="ss-au-skip" data-skip="1">Continue without an account</button></form>`;
  };
  render(); document.body.appendChild(el);
  el.addEventListener("click", (e) => {
    const m = e.target.closest("[data-m]");
    if (m && !busy) { const em = el.querySelector("[name=email]").value; mode = m.dataset.m; msg = ""; render(); el.querySelector("[name=email]").value = em; }
    if (e.target.closest("[data-skip]")) { try { localStorage.setItem("ss-auth-skip", "1"); } catch {} close(); }
  });
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 500); };
  el.addEventListener("submit", async (e) => {
    e.preventDefault(); if (busy) return;
    const email = el.querySelector("[name=email]").value.trim(), pw = el.querySelector("[name=password]").value;
    if (!email || !pw) { msg = "Enter your email and password."; render(); el.querySelector("[name=email]").value = email; return; }
    busy = true; msg = ""; render(); el.querySelector("[name=email]").value = email;
    try {
      await (mode === "up" ? authApi.signUp : authApi.signIn)(email, pw);
      await syncNow(); close();
      setTimeout(() => { if (document.querySelector(".ss-sync-banner")) location.reload(); }, 400);
    } catch (err) { busy = false; msg = FRIENDLY[err.code] || String(err.code || err.message || "Something went wrong").replace("auth/", "").replace(/-/g, " "); render(); el.querySelector("[name=email]").value = email; }
  });
}
