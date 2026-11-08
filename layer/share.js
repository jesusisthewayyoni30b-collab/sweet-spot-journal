// Share a single trade as a public, read-only page (https://<site>/s/<id>). The friend sees only that snapshot.
import * as fb from "./firebase.js";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";

const MAP = "sweetspot-shares";
const SITE = "https://sweet-spot-journal.web.app";
const IMG = ["monthlyImg", "weeklyImg", "dailyImg", "h1Img", "m5Img"];
const LINK = ["monthlyLink", "weeklyLink", "dailyLink", "h1Link", "m5Link"];
const NAMES = { monthly: "Monthly", weekly: "Weekly", daily: "Daily", h1: "1H", m5: "5M" };
const rmap = () => { try { return JSON.parse(localStorage.getItem(MAP) || "{}"); } catch { return {}; } };
const wmap = (m) => { try { localStorage.setItem(MAP, JSON.stringify(m)); } catch {} };
const rid = () => { const a = new Uint8Array(12); crypto.getRandomValues(a); return [...a].map((b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join(""); };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function readJson(k, d) { try { const r = await window.storage.get(k, false); return r && r.value ? JSON.parse(r.value) : d; } catch { return d; } }

async function findTrade(card) {
  const trades = await readJson("sweetspot_trades", []);
  const txt = card.innerText;
  const c = trades.filter((t) => t.pair && txt.includes(t.pair) && (!t.openTime || txt.includes(t.openTime)) && (!t.closeTime || txt.includes(t.closeTime)));
  if (c.length <= 1) return c[0];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const hit = c.find((t) => { const [y, m, d] = String(t.date).split("-").map(Number); return m && txt.includes(months[m - 1] + " " + d + " " + y) || txt.includes(months[m - 1] + " " + d + ", " + y); });
  return hit || c[0];
}

function shrink(url, max = 1000, q = 0.62) {
  return new Promise((res) => {
    if (typeof url !== "string" || !url.startsWith("data:image")) return res(null);
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      try { res(c.toDataURL("image/jpeg", q)); } catch { res(null); }
    };
    im.onerror = () => res(null);
    im.src = url;
  });
}

async function build(t, o) {
  const accs = await readJson("sweetspot_accounts", []);
  const acc = accs.find((a) => a.id === t.accountId);
  const p = { pair: t.pair, date: t.date, direction: t.direction, session: t.session, setup: t.setupType, bias: t.dailyBias, open: t.openTime, close: t.closeTime, duration: t.duration, rr: t.rr, actualRR: t.actualRR, result: t.result, openPrice: t.openPrice, closePrice: t.closePrice, tp: t.tpPrice, sl: t.slPrice, slPips: t.slPips, tpPips: t.tpPips, hidePnl: !o.pnl, by: o.name || "" };
  if (o.pnl) { p.net = t.netPnl; p.gross = t.grossPnl; p.cur = (acc && acc.currency) || "$"; p.riskPct = t.riskPct; }
  if (o.lot) p.lot = t.lotSize;
  if (o.notes) { p.confluences = t.confluences; p.notes = t.mistakesNotes; p.lesson = t.lessonCategory; }
  p.links = LINK.map((k, i) => t[k] ? { n: NAMES[IMG[i].replace("Img", "")], u: t[k] } : null).filter(Boolean);
  p.imgs = [];
  if (o.imgs) {
    const store = await readJson("trade_img:" + t.id, {});
    let budget = 700000;
    for (const k of IMG) {
      const v = store[k] || t[k]; if (!v) continue;
      let out = await shrink(v); if (out && out.length > 190000) out = await shrink(v, 760, 0.5);
      if (out && out.length <= budget) { budget -= out.length; p.imgs.push({ n: NAMES[k.replace("Img", "")], u: out }); }
    }
  }
  return p;
}

function dialog(t, existing) {
  const w = document.createElement("div"); w.className = "ss-off ss-share";
  const user = fb.currentUser();
  const signed = !!user;
  w.innerHTML = '<div class="ss-off-card"><div class="ss-off-t">Share this trade</div>'
    + '<div class="ss-off-p">Your friend gets a private link to a read-only snapshot of <b>' + esc(t.pair) + '</b> — no account, no access to anything else in your journal.</div>'
    + (signed ? '<label class="ss-sh-r"><input type="checkbox" id="sh-pnl"><span>Show profit / loss amounts</span></label>'
      + '<label class="ss-sh-r"><input type="checkbox" id="sh-lot"><span>Show lot size</span></label>'
      + '<label class="ss-sh-r"><input type="checkbox" id="sh-notes" checked><span>Include confluences &amp; notes</span></label>'
      + '<label class="ss-sh-r"><input type="checkbox" id="sh-imgs" checked><span>Include screenshots</span></label>'
      + '<input class="ss-sh-n" id="sh-name" maxlength="30" placeholder="Your name (optional)">'
      + '<div class="ss-sh-link" id="sh-link"></div><div class="ss-sh-msg" id="sh-msg"></div>'
      + '<button class="ss-off-b pri" id="sh-go"></button><button class="ss-off-b" id="sh-copy" style="display:none">Copy link</button><button class="ss-off-b" id="sh-send" style="display:none">Send to a friend…</button><button class="ss-off-b ghost" id="sh-stop" style="display:none">Stop sharing (link stops working)</button>'
      : '<div class="ss-sh-msg" style="display:block">Sign in first (menu → Settings → Account) so your shared trades are tied to your account.</div>')
    + '<button class="ss-off-b ghost" id="sh-x">Close</button></div>';
  document.body.appendChild(w);
  const $ = (s) => w.querySelector(s);
  $("#sh-x").onclick = () => w.remove();
  w.addEventListener("click", (e) => { if (e.target === w) w.remove(); });
  if (!signed) return;
  const map = rmap(); let id = map[t.id];
  const msg = (s, bad) => { const m = $("#sh-msg"); m.textContent = s; m.style.display = s ? "block" : "none"; m.style.color = bad ? "#f87171" : ""; };
  const url = () => SITE + "/s/" + id;
  const refresh = () => {
    const on = !!id;
    $("#sh-go").textContent = on ? "Update shared snapshot" : "Create share link";
    $("#sh-copy").style.display = $("#sh-send").style.display = $("#sh-stop").style.display = on ? "" : "none";
    $("#sh-link").textContent = on ? url() : ""; $("#sh-link").style.display = on ? "block" : "none";
  };
  try { const nm = localStorage.getItem("sweetspot-share-name"); if (nm) $("#sh-name").value = nm; } catch {}
  refresh();
  $("#sh-go").onclick = async () => {
    const b = $("#sh-go"); b.disabled = true; msg("Creating…");
    try {
      const name = $("#sh-name").value.trim(); try { localStorage.setItem("sweetspot-share-name", name); } catch {}
      const payload = await build(t, { pnl: $("#sh-pnl").checked, lot: $("#sh-lot").checked, notes: $("#sh-notes").checked, imgs: $("#sh-imgs").checked, name });
      if (!id) id = rid();
      await fb.shareSave(id, payload);
      const m = rmap(); m[t.id] = id; wmap(m); refresh(); msg("Ready — anyone with the link can view it.");
    } catch (e) { msg("Couldn't create the link: " + (e && e.message ? e.message : e), true); }
    b.disabled = false;
  };
  $("#sh-copy").onclick = async () => { try { await navigator.clipboard.writeText(url()); msg("Link copied."); } catch { msg(url()); } };
  $("#sh-send").onclick = async () => {
    const text = t.pair + " trade — take a look:";
    try {
      if (Capacitor.isNativePlatform()) await Share.share({ title: "Trade review", text, url: url(), dialogTitle: "Send to a friend" });
      else if (navigator.share) await navigator.share({ title: "Trade review", text, url: url() });
      else { await navigator.clipboard.writeText(url()); msg("Link copied."); }
    } catch {}
  };
  $("#sh-stop").onclick = async () => {
    if (!confirm("Stop sharing this trade? The link will stop working.")) return;
    try { await fb.shareDelete(id); const m = rmap(); delete m[t.id]; wmap(m); id = null; refresh(); msg("Sharing stopped."); } catch (e) { msg("Couldn't stop sharing: " + (e && e.message ? e.message : e), true); }
  };
}

function inject() {
  const back = [...document.querySelectorAll("button")].find((b) => /Back to Trades/.test(b.textContent));
  if (!back) return;
  const bar = back.parentElement; if (!bar || bar.querySelector(".ss-share-btn")) return;
  const edit = [...bar.querySelectorAll("button")].find((b) => /^\s*Edit\s*$/.test(b.textContent));
  if (!edit) return;
  const b = document.createElement("button");
  b.className = (edit.className || "") + " ss-share-btn"; b.type = "button";
  b.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg> Share';
  b.onclick = async (e) => {
    e.preventDefault(); e.stopPropagation();
    const card = bar.nextElementSibling || bar.parentElement;
    const t = await findTrade(card);
    if (!t) { alert("Couldn't identify this trade. Open it again and retry."); return; }
    dialog(t);
  };
  edit.parentElement.insertBefore(b, edit);
}

export function initShare() {
  let q = 0;
  new MutationObserver(() => { if (q) return; q = setTimeout(() => { q = 0; try { inject(); } catch {} }, 120); }).observe(document.body, { childList: true, subtree: true });
}
