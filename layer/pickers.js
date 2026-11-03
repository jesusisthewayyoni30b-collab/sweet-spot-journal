// Futuristic date + time pickers (replace the phone's native dialogs). They set the real <input> value
// and fire input/change so the journal's own code reacts exactly as before.
const pad = (n) => String(n).padStart(2, "0");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let sheet = null;

function closeSheet() {
  const s = document.getElementById("ss-sheet"); sheet = null;
  if (s) { s.classList.remove("in"); setTimeout(() => s.remove(), 260); }
}
function setValue(inp, v) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  set.call(inp, v);
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  inp.dispatchEvent(new Event("change", { bubbles: true }));
}
function shell(title, body) {
  const old = document.getElementById("ss-sheet"); if (old) old.remove();
  sheet = document.createElement("div"); sheet.id = "ss-sheet";
  sheet.innerHTML = `<div class="ss-sh-bg"></div><div class="ss-sh-panel"><div class="ss-sh-grab"></div><div class="ss-sh-title">${title}</div>${body}</div>`;
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet && sheet.classList.add("in"));
  sheet.querySelector(".ss-sh-bg").addEventListener("click", closeSheet);
  return sheet;
}
const labelFor = (inp, dflt) => {
  const par = inp.parentElement;
  const l = (inp.previousElementSibling && /label/i.test(inp.previousElementSibling.tagName) ? inp.previousElementSibling : par && par.querySelector(":scope > label"));
  const t = l && l.textContent.replace("*", "").trim();
  return t && t.length <= 32 ? t : dflt;
};

/* ---------------- time ---------------- */
function openTime(inp) {
  const withSec = inp.step && +inp.step < 60;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(inp.value || "");
  const now = new Date();
  let h24 = m ? +m[1] : now.getHours(), mi = m ? +m[2] : now.getMinutes(), se = m && m[3] ? +m[3] : 0;
  const ap = h24 >= 12 ? 1 : 0, h12 = h24 % 12 || 12;
  const col = (cls, items) => `<div class="ss-wh ${cls}"><div class="ss-wh-in">${items.map((t) => `<div class="ss-wh-i">${t}</div>`).join("")}</div></div>`;
  const hours = Array.from({ length: 12 }, (_, i) => pad(i + 1)), mins = Array.from({ length: 60 }, (_, i) => pad(i));
  const s = shell(labelFor(inp, "Time"), `<div class="ss-whs"><div class="ss-wh-sel"></div>${col("h", hours)}<span class="ss-wh-c">:</span>${col("m", mins)}${withSec ? `<span class="ss-wh-c">:</span>${col("s", mins)}` : ""}${col("a", ["AM", "PM"])}</div>
    <div class="ss-pk-row"><button type="button" class="ss-pk-btn ghost" data-a="clear">Clear</button><button type="button" class="ss-pk-btn ghost" data-a="now">Now</button><button type="button" class="ss-pk-btn" data-a="set">Set</button></div>`);
  const cols = { h: s.querySelector(".ss-wh.h"), m: s.querySelector(".ss-wh.m"), s: s.querySelector(".ss-wh.s"), a: s.querySelector(".ss-wh.a") };
  const IH = 46;
  const goto = (c, i, smooth) => c && c.scrollTo({ top: i * IH, behavior: smooth ? "smooth" : "auto" });
  const read = (c) => c ? Math.round(c.scrollTop / IH) : 0;
  const paint = () => Object.values(cols).forEach((c) => { if (!c) return; const k = read(c); c.querySelectorAll(".ss-wh-i").forEach((e, i) => e.classList.toggle("on", i === k)); });
  const place = (hh, mm, ss, aa, smooth) => { goto(cols.h, hh - 1, smooth); goto(cols.m, mm, smooth); goto(cols.s, ss, smooth); goto(cols.a, aa, smooth); setTimeout(paint, smooth ? 350 : 30); };
  setTimeout(() => place(h12, mi, se, ap, false), 40);
  Object.values(cols).forEach((c) => c && c.addEventListener("scroll", () => requestAnimationFrame(paint), { passive: true }));
  s.addEventListener("click", (e) => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    if (b.dataset.a === "clear") { setValue(inp, ""); closeSheet(); }
    else if (b.dataset.a === "now") { const d = new Date(); place(d.getHours() % 12 || 12, d.getMinutes(), d.getSeconds(), d.getHours() >= 12 ? 1 : 0, true); }
    else if (b.dataset.a === "set") {
      const hh = read(cols.h) + 1, mm = read(cols.m), ss = read(cols.s), aa = read(cols.a);
      const H = (hh % 12) + (aa ? 12 : 0);
      setValue(inp, `${pad(H)}:${pad(mm)}${withSec ? ":" + pad(ss) : ""}`); closeSheet();
    }
  });
}

/* ---------------- date ---------------- */
function openDate(inp) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(inp.value || "");
  const today = new Date();
  let y = m ? +m[1] : today.getFullYear(), mo = m ? +m[2] - 1 : today.getMonth();
  const sel = m ? `${m[1]}-${m[2]}-${m[3]}` : "";
  const todayS = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const s = shell(labelFor(inp, "Date"), `<div class="ss-cal-h"><button type="button" data-n="-12" aria-label="Previous year">«</button><button type="button" data-n="-1" aria-label="Previous month">‹</button><div class="ss-cal-t"></div><button type="button" data-n="1" aria-label="Next month">›</button><button type="button" data-n="12" aria-label="Next year">»</button></div>
    <div class="ss-cal-w">${["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => `<span>${d}</span>`).join("")}</div><div class="ss-cal-g"></div>
    <div class="ss-pk-row"><button type="button" class="ss-pk-btn ghost" data-a="clear">Clear</button><button type="button" class="ss-pk-btn ghost" data-a="today">Today</button></div>`);
  const grid = s.querySelector(".ss-cal-g"), ttl = s.querySelector(".ss-cal-t");
  const render = () => {
    ttl.textContent = `${MONTHS[mo]} ${y}`;
    const first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
    let h = "";
    for (let i = 0; i < first; i++) h += "<i></i>";
    for (let d = 1; d <= days; d++) {
      const v = `${y}-${pad(mo + 1)}-${pad(d)}`;
      const dis = (inp.min && v < inp.min) || (inp.max && v > inp.max);
      h += `<button type="button" data-d="${v}" class="${v === sel ? "on" : ""}${v === todayS ? " td" : ""}" ${dis ? "disabled" : ""}>${d}</button>`;
    }
    grid.innerHTML = h;
  };
  render();
  s.addEventListener("click", (e) => {
    const n = e.target.closest("[data-n]"); if (n) { const t = mo + +n.dataset.n; y += Math.floor(t / 12); mo = ((t % 12) + 12) % 12; render(); return; }
    const d = e.target.closest("[data-d]"); if (d && !d.disabled) { setValue(inp, d.dataset.d); closeSheet(); return; }
    const a = e.target.closest("[data-a]"); if (!a) return;
    if (a.dataset.a === "clear") { setValue(inp, ""); closeSheet(); }
    if (a.dataset.a === "today") { setValue(inp, todayS); closeSheet(); }
  });
}

export function initPickers() {
  const hit = (e) => { const i = e.target && e.target.closest && e.target.closest("input[type=date],input[type=time]"); return i && !i.disabled && !i.readOnly ? i : null; };
  document.addEventListener("mousedown", (e) => { if (hit(e)) e.preventDefault(); }, true);
  document.addEventListener("click", (e) => {
    const i = hit(e); if (!i) return;
    e.preventDefault(); e.stopPropagation();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    i.type === "time" ? openTime(i) : openDate(i);
  }, true);
  const prev = window.__ssBack;
  window.__ssBack = () => { if (document.getElementById("ss-sheet")) { closeSheet(); return true; } return prev ? prev() : false; };
}
