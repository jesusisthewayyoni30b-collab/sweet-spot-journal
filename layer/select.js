// Replaces the phone's native <select> pop-up with a glowing bottom sheet. The real <select> stays
// in the page (React keeps working); we just set its value and fire the same events.
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let sheet = null, target = null;

function labelFor(sel) {
  if (sel.getAttribute("aria-label")) return sel.getAttribute("aria-label");
  let e = sel;
  for (let i = 0; i < 3 && e; i++, e = e.parentElement) {
    const l = e.previousElementSibling && /label/i.test(e.previousElementSibling.tagName) ? e.previousElementSibling : e.querySelector && e.querySelector(":scope > label");
    if (l && l.textContent.trim()) return l.textContent.replace("*", "").trim();
  }
  return "Choose";
}
function close() {
  if (!sheet) return; const s = sheet; sheet = null; target = null;
  s.classList.remove("in"); setTimeout(() => s.remove(), 260);
}
function choose(sel, idx) {
  const opt = sel.options[idx]; if (!opt || opt.disabled) return;
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
  set.call(sel, opt.value);
  sel.dispatchEvent(new Event("input", { bubbles: true }));
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  close();
}
function open(sel) {
  if (sheet) close();
  target = sel;
  const opts = [...sel.options];
  let html = "", group = null;
  opts.forEach((o, i) => {
    const g = o.parentElement && o.parentElement.tagName === "OPTGROUP" ? o.parentElement.label : null;
    if (g !== group) { group = g; if (g) html += `<div class="ss-sh-grp">${esc(g)}</div>`; }
    html += `<button type="button" class="ss-sh-opt${o.selected ? " on" : ""}" data-i="${i}" ${o.disabled ? "disabled" : ""}><span class="ss-sh-dot">${CHECK}</span><span class="ss-sh-txt">${esc(o.textContent.trim() || "None")}</span></button>`;
  });
  const search = opts.length > 8 ? `<input class="ss-sh-search" type="search" placeholder="Search..." autocomplete="off">` : "";
  sheet = document.createElement("div"); sheet.id = "ss-sheet";
  sheet.innerHTML = `<div class="ss-sh-bg"></div><div class="ss-sh-panel" role="listbox"><div class="ss-sh-grab"></div><div class="ss-sh-title">${esc(labelFor(sel))}</div>${search}<div class="ss-sh-list">${html}</div></div>`;
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet && sheet.classList.add("in"));
  const cur = sheet.querySelector(".ss-sh-opt.on"); if (cur) setTimeout(() => cur.scrollIntoView({ block: "center" }), 60);
  sheet.addEventListener("click", (e) => {
    if (e.target.classList.contains("ss-sh-bg")) return close();
    const b = e.target.closest(".ss-sh-opt"); if (b && !b.disabled) choose(sel, +b.dataset.i);
  });
  const s = sheet.querySelector(".ss-sh-search");
  if (s) s.addEventListener("input", () => { const q = s.value.toLowerCase(); sheet.querySelectorAll(".ss-sh-opt").forEach((b) => { b.style.display = b.textContent.toLowerCase().includes(q) ? "" : "none"; }); });
}
export function initSelects() {
  const isSel = (e) => { const s = e.target && e.target.closest && e.target.closest("select"); return s && !s.disabled && !s.multiple && s.size <= 1 ? s : null; };
  document.addEventListener("mousedown", (e) => { if (isSel(e)) e.preventDefault(); }, true);
  document.addEventListener("click", (e) => { const s = isSel(e); if (s) { e.preventDefault(); e.stopPropagation(); open(s); } }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
    if ((e.key === "Enter" || e.key === " ") && document.activeElement && document.activeElement.tagName === "SELECT") { e.preventDefault(); open(document.activeElement); }
  }, true);
  const prev = window.__ssBack;
  window.__ssBack = () => { if (sheet) { close(); return true; } return prev ? prev() : false; };
}
