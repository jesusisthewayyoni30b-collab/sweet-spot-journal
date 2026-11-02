// Phone navigation on top of the journal's own sidebar: slide-in drawer, top bar, bottom tabs.
const mq = window.matchMedia("(max-width:767px)");
let sidebar = null, main = null, backdrop, appbar, title, nav, syncBtn, lastTitle = "";

const I = {
  overview: '<path d="M4 13h6V4H4zM14 20h6V11h-6zM14 4h6v4h-6zM4 20h6v-4H4z"/>',
  trades: '<path d="M7 4v3M7 14v3M7 7h0M5 7h4v7H5zM17 7v3M17 17v3M15 10h4v7h-4z"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  menu: '<circle cx="6" cy="6" r="1.6"/><circle cx="12" cy="6" r="1.6"/><circle cx="18" cy="6" r="1.6"/><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/><circle cx="6" cy="18" r="1.6"/><circle cx="12" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/>',
  burger: '<path d="M4 7h16M4 12h10M4 17h16"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9.5a4.25 4.25 0 0 1 .5 8.5z"/>',
};
const svg = (k, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;

const findSidebar = () => document.querySelector(".sticky.h-screen") || document.querySelector("aside");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function openDrawer(v) { if (!sidebar) return; sidebar.classList.toggle("ss-open", v); backdrop.classList.toggle("ss-open", v); document.body.classList.toggle("ss-lock", v); }
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
      const hit = ["Trades", "New Trade", "Calendar"].find((x) => txt.toLowerCase() === x.toLowerCase());
      setActive(hit || (/overview/i.test(txt) ? "Overview" : ""));
      main.classList.remove("ss-fade"); void main.offsetWidth; main.classList.add("ss-fade");
    }
  }
}
async function goto(label) {
  // sidebar groups only render their items when expanded: expand, click, collapse
  openDrawer(true); await sleep(160);
  const find = () => [...sidebar.querySelectorAll("button[title]")].find((b) => b.title === label);
  let btn = find();
  if (!btn) {
    const heads = [...sidebar.querySelectorAll("button")].filter((b) => !b.title && /\S/.test(b.textContent) && !/collapse/i.test(b.textContent));
    for (const h of heads) { h.click(); await sleep(90); btn = find(); if (btn) break; h.click(); await sleep(50); }
  }
  if (btn) btn.click();
  openDrawer(false);
}
export function initMobile() {
  backdrop = document.createElement("div"); backdrop.className = "ss-m-backdrop"; backdrop.onclick = () => openDrawer(false);
  appbar = document.createElement("div"); appbar.className = "ss-appbar";
  appbar.innerHTML = `<button class="ss-ab-btn" aria-label="Menu" data-k="menu">${svg("burger")}</button><div class="ss-title">Sweet Spot</div><button class="ss-ab-btn ss-ab-sync" aria-label="Sync" data-k="sync">${svg("cloud")}<i class="ss-ab-dot"></i></button>`;
  title = appbar.querySelector(".ss-title"); syncBtn = appbar.querySelector(".ss-ab-sync");
  appbar.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.k === "menu") openDrawer(!(sidebar && sidebar.classList.contains("ss-open")));
    else { const pill = document.querySelector(".ss-sync-pill"); pill && pill.click(); }
  });
  window.addEventListener("ss-sync", (e) => { syncBtn.dataset.s = e.detail; });
  nav = document.createElement("div"); nav.className = "ss-bottomnav";
  const tabs = [["overview", "Overview", "Overview"], ["trades", "Trades", "Trades"], ["plus", "New Trade", "New Trade"], ["cal", "Calendar", "Calendar"], ["menu", "Menu", null]];
  nav.innerHTML = tabs.map(([i, l]) => `<button data-l="${l}" class="${i === "plus" ? "ss-fab" : ""}"><span class="ss-ic">${svg(i)}</span><span class="ss-lb">${l}</span></button>`).join("");
  nav.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; const l = tabs.find((t) => t[1] === b.dataset.l)[2]; if (l) goto(l); else openDrawer(true); };
  document.body.append(backdrop, appbar, nav);
  window.__ssBack = () => { if (sidebar && sidebar.classList.contains("ss-open")) { openDrawer(false); return true; } return false; };
  let pend = false;
  new MutationObserver((m) => {
    if (pend || m.every((x) => x.target.closest && x.target.closest(".ss-appbar,.ss-bottomnav,#ss-sync-root,#ss-splash"))) return;
    pend = true; setTimeout(() => { pend = false; tag(); }, 150);
  }).observe(document.body, { childList: true, subtree: true });
  tag();
  mq.addEventListener && mq.addEventListener("change", () => openDrawer(false));
}
