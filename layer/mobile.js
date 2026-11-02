// Phone navigation on top of the journal's own sidebar: slide-in drawer, top bar, bottom tabs.
const mq = window.matchMedia("(max-width:767px)");
let sidebar = null, main = null, backdrop, appbar, title;

const findSidebar = () => document.querySelector(".sticky.h-screen") || document.querySelector("aside");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function openDrawer(v) { sidebar && sidebar.classList.toggle("ss-open", v); backdrop.classList.toggle("ss-open", v); }

function tag() {
  const sb = findSidebar();
  if (sb && sb !== sidebar) { sidebar = sb; sb.classList.add("ss-m-sidebar"); }
  if (sidebar && sidebar.nextElementSibling) { main = sidebar.nextElementSibling; main.classList.add("ss-m-main"); }
  if (main) {
    const t = main.querySelector(".text-lg, h1, h2");
    const txt = t && t.textContent.trim(); if (txt && title.textContent !== txt) title.textContent = txt;
  }
}
async function goto(label) {
  // sidebar groups only render their items when expanded: expand, click, collapse
  openDrawer(true); await sleep(120);
  const find = () => [...sidebar.querySelectorAll("button[title]")].find((b) => b.title === label);
  let btn = find();
  if (!btn) {
    const heads = [...sidebar.querySelectorAll(".sidebar-group-header, button")].filter((b) => !b.title && /\S/.test(b.textContent));
    for (const h of heads) { h.click(); await sleep(80); btn = find(); if (btn) break; h.click(); await sleep(40); }
  }
  if (btn) btn.click();
  openDrawer(false);
}
export function initMobile() {
  backdrop = document.createElement("div"); backdrop.className = "ss-m-backdrop"; backdrop.onclick = () => openDrawer(false);
  appbar = document.createElement("div"); appbar.className = "ss-appbar";
  appbar.innerHTML = `<button aria-label="Menu">☰</button><div class="ss-title">Sweet Spot</div>`;
  title = appbar.querySelector(".ss-title"); appbar.firstChild.onclick = () => openDrawer(!sidebar.classList.contains("ss-open"));
  const nav = document.createElement("div"); nav.className = "ss-bottomnav";
  const tabs = [["◧", "Overview", "Overview"], ["☰", "Trades", "Trades"], ["＋", "New Trade", "New Trade"], ["▦", "Calendar", "Calendar"], ["⋯", "Menu", null]];
  nav.innerHTML = tabs.map(([i, l]) => `<button data-l="${l}"><span class="i">${i}</span>${l}</button>`).join("");
  nav.onclick = (e) => { const b = e.target.closest("button"); if (!b) return; const l = tabs.find((t) => t[1] === b.dataset.l)[2]; l ? goto(l) : openDrawer(true); };
  document.body.append(backdrop, appbar, nav);
  window.__ssBack = () => { if (sidebar && sidebar.classList.contains("ss-open")) { openDrawer(false); return true; } return false; };
  let pend = false; new MutationObserver((m) => { if (pend || m.every((x) => x.target.closest && x.target.closest(".ss-appbar,.ss-bottomnav,#ss-sync-root"))) return; pend = true; setTimeout(() => { pend = false; tag(); }, 150); }).observe(document.body, { childList: true, subtree: true });
  tag();
  mq.addEventListener && mq.addEventListener("change", () => openDrawer(false));
}
