// Phone navigation on top of the journal's own sidebar: slide-in drawer, top bar, bottom tabs.
const mq = window.matchMedia("(max-width:767px)");
let sidebar = null, main = null, backdrop, appbar, title, nav, syncBtn, lastTitle = "";

const I = {
  overview: '<path d="M4 13h6V4H4zM14 20h6V11h-6zM14 4h6v4h-6zM4 20h6v-4H4z"/>',
  trades: '<path d="M7 4v3M7 14v3M7 7h0M5 7h4v7H5zM17 7v3M17 17v3M15 10h4v7h-4z"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  menu: '<circle cx="6" cy="6" r="1.6"/><circle cx="12" cy="6" r="1.6"/><circle cx="18" cy="6" r="1.6"/><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/><circle cx="6" cy="18" r="1.6"/><circle cx="12" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/>',
  rules: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  burger: '<path d="M4 7h16M4 12h10M4 17h16"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9.5a4.25 4.25 0 0 1 .5 8.5z"/>',
};
const svg = (k, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;

const findSidebar = () => document.querySelector(".sticky.h-screen") || document.querySelector("aside");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function openDrawer(v) { if (!sidebar) return; sidebar.classList.toggle("ss-open", v); backdrop.classList.toggle("ss-open", v); }
function setActive(label) { nav.querySelectorAll("button").forEach((b) => b.classList.toggle("ss-on", b.dataset.l === label)); }

function tag() {
  const sb = findSidebar();
  if (sb && sb !== sidebar) { sidebar = sb; sb.classList.add("ss-m-sidebar"); }
  if (sidebar && !sidebar.__ssBound) {
    sidebar.__ssBound = true;
    sidebar.addEventListener("click", (e) => { if (e.target.closest("button[title]")) setTimeout(() => openDrawer(false), 60); });
  }
  if (sidebar && sidebar.nextElementSibling) { main = sidebar.nextElementSibling; main.classList.add("ss-m-main"); }
  if (main) {
    const t = main.querySelector(".text-lg, h1, h2");
    const txt = t && t.textContent.trim();
    if (txt && txt !== lastTitle) {
      lastTitle = txt; title.textContent = txt;
      const k = txt.toLowerCase();
      setActive(k === "account overview" ? "Overview" : k === "trades" ? "Trades" : (k === "add trade" || k === "new trade") ? "New Trade" : k === "calendar" ? "Calendar" : k === "rules" ? "Rules" : "");
      main.classList.remove("ss-fade"); void main.offsetWidth; main.classList.add("ss-fade");
    }
  }
}
async function goto(label) {
  // Done silently while the drawer stays closed: expand the group that holds the page, click it, collapse again.
  if (!sidebar) return;
  const find = () => [...sidebar.querySelectorAll("button[title]")].find((b) => b.title === label);
  const heads = () => [...sidebar.querySelectorAll("button")].filter((b) => !b.title && /\S/.test(b.textContent) && !/collapse/i.test(b.textContent));
  let btn = find(), openedText = null;
  if (!btn) {
    for (const h of heads()) {
      h.click(); await sleep(50); btn = find();
      if (btn) { openedText = h.textContent.trim(); break; }
      h.click(); await sleep(20);
    }
  }
  if (btn) btn.click();
  if (openedText) {
    await sleep(60);
    const h = heads().find((x) => x.textContent.trim() === openedText);
    if (h && find()) h.click();
  }
}
// Kill zones (New York time) - same schedule as the journal's own indicator.
const KZ = [
  { n: "Asian", m: "Forex", s: "20:00", e: "24:00", c: "#fbbf24" }, { n: "London", m: "Forex", s: "02:00", e: "05:00", c: "#60a5fa" },
  { n: "NY AM", m: "Forex", s: "07:00", e: "10:00", c: "#22d3ee" }, { n: "London Close", m: "Forex", s: "10:00", e: "12:00", c: "#a78bfa" },
  { n: "NY AM", m: "Indices", s: "09:30", e: "11:00", c: "#34d399" }, { n: "NY PM", m: "Indices", s: "13:30", e: "16:00", c: "#f472b6" },
].map((z) => ({ ...z, a: hm(z.s), b: hm(z.e) }));
function hm(t) { const [h, m] = t.split(":").map(Number); return (h * 60 + m) * 60; }
const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });
const hms = (n) => { n = Math.max(0, Math.floor(n)); return `${String(Math.floor(n / 3600)).padStart(2, "0")}:${String(Math.floor((n % 3600) / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`; };
function kzTick() {
  const el = appbar && appbar.querySelector(".ss-kz"); if (!el) return;
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
  const sod = ((+p.hour % 24) * 60 + +p.minute) * 60 + +p.second;
  let act = null;
  for (const z of KZ) if (sod >= z.a && sod < z.b) { const left = z.b - sod; if (!act || left < act.left) act = { z, left, frac: (sod - z.a) / (z.b - z.a) }; }
  let state, color, label, cd, frac;
  if (act) { state = "on"; color = act.z.c; label = `${act.z.n} \u00b7 ${act.z.m === "Forex" ? "FX" : "IDX"} \u00b7 ends`; cd = hms(act.left); frac = act.frac; }
  else {
    let nx = null;
    for (const z of KZ) { const d = (z.a - sod + 86400) % 86400; if (!nx || d < nx.d) nx = { z, d }; }
    const soon = nx.d <= 900;
    state = soon ? "soon" : "off"; color = soon ? "#f59e0b" : "#f87171";
    label = `${soon ? "Get ready" : "Next"} \u00b7 ${nx.z.n} ${nx.z.m === "Forex" ? "FX" : "IDX"}`; cd = hms(nx.d); frac = soon ? 1 - nx.d / 900 : 0;
  }
  el.dataset.s = state; el.style.setProperty("--kz", color);
  el.querySelector(".ss-kz-l").textContent = label; el.querySelector(".ss-kz-c").textContent = cd;
  el.querySelector(".ss-kz-bar u").style.width = `${Math.round(frac * 1000) / 10}%`;
}
export function initMobile() {
  backdrop = document.createElement("div"); backdrop.className = "ss-m-backdrop"; backdrop.onclick = () => openDrawer(false);
  appbar = document.createElement("div"); appbar.className = "ss-appbar";
  appbar.innerHTML = `<button class="ss-ab-btn" aria-label="Menu" data-k="menu">${svg("burger")}</button><div class="ss-kz" data-s="off"><i class="ss-kz-dot"></i><div class="ss-kz-t"><span class="ss-kz-l">Kill zone</span><span class="ss-kz-c">--:--:--</span></div><b class="ss-kz-bar"><u></u></b></div><button class="ss-ab-btn ss-ab-sync" aria-label="Sync" data-k="sync">${svg("cloud")}<i class="ss-ab-dot"></i></button>`;
  title = document.createElement("span"); syncBtn = appbar.querySelector(".ss-ab-sync");
  appbar.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.k === "menu") openDrawer(!(sidebar && sidebar.classList.contains("ss-open")));
    else { const pill = document.querySelector(".ss-sync-pill"); pill && pill.click(); }
  });
  window.addEventListener("ss-sync", (e) => { syncBtn.dataset.s = e.detail; });
  nav = document.createElement("div"); nav.className = "ss-bottomnav";
  const tabs = [["overview", "Overview", "Account Overview"], ["trades", "Trades", "Trades"], ["plus", "New Trade", "Add Trade"], ["cal", "Calendar", "Calendar"], ["rules", "Rules", "Rules"]];
  nav.innerHTML = tabs.map(([i, l]) => `<button data-l="${l}" class="${i === "plus" ? "ss-fab" : ""}"><span class="ss-ic">${svg(i)}</span><span class="ss-lb">${l}</span></button>`).join("");
  nav.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; const l = tabs.find((t) => t[1] === b.dataset.l)[2]; if (l) goto(l); };
  document.body.append(backdrop, appbar, nav);
  window.__ssBack = () => { if (sidebar && sidebar.classList.contains("ss-open")) { openDrawer(false); return true; } return false; };
  let pend = false;
  new MutationObserver((m) => {
    if (pend || m.every((x) => x.target.closest && x.target.closest(".ss-appbar,.ss-bottomnav,#ss-sync-root,#ss-splash"))) return;
    pend = true; setTimeout(() => { pend = false; tag(); }, 150);
  }).observe(document.body, { childList: true, subtree: true });
  tag(); kzTick(); setInterval(kzTick, 1000);
  mq.addEventListener && mq.addEventListener("change", () => openDrawer(false));
}
