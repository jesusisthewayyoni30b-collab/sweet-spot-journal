// Marks the journal's first-run guide card so guide.css can restyle it, and replays the
// "decode" animations whenever the step changes.
export function initGuide() {
  let timer = 0;
  const run = () => {
    const skip = [...document.querySelectorAll("button")].find((b) => /^skip guide$/i.test((b.textContent || "").trim()));
    const card = skip && skip.closest(".max-w-lg");
    if (!card) return;
    if (!card.classList.contains("ss-guide")) { card.classList.add("ss-guide"); card.parentElement && card.parentElement.classList.add("ss-guide-wrap"); }
    const label = card.querySelector(".text-\\[10px\\]");
    const m = label && /step\s+(\d+)\s+of\s+(\d+)/i.exec(label.textContent || "");
    if (m) card.style.setProperty("--gp", String(Math.min(1, (+m[1]) / (+m[2]))));
    const ic = card.querySelector(".w-10 svg");
    if (ic) { const c = getComputedStyle(ic).color; if (c) { card.style.setProperty("--ga", c); card.parentElement && card.parentElement.style.setProperty("--ga", c); } }
    const title = (card.querySelector(".text-base.font-semibold") || {}).textContent || "";
    if (card.dataset.gs !== title) {
      const first = card.dataset.gs === undefined; card.dataset.gs = title;
      if (!first) { card.classList.remove("ss-re"); void card.offsetWidth; }
      card.classList.add("ss-re");
    }
  };
  const mo = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(run, 40); });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  run();
}

// The journal sets its theme colours on an inner wrapper, but the phone bars live on <body>.
// Mirror the theme variables onto <html> so the bars (and sheets/pickers) follow the chosen theme.
const VARS = ["--ss-bg", "--ss-surface", "--ss-border", "--ss-text", "--ss-text-soft", "--ss-text-muted", "--ss-text-mute2", "--ss-heading", "--ss-hover", "--ss-track", "--wtf-button-text", "--acc-trading"];
export function initThemeMirror() {
  let last = "";
  const sync = () => {
    const t = document.querySelector("[data-theme]");
    if (!t) return;
    const cs = getComputedStyle(t);
    const vals = VARS.map((v) => cs.getPropertyValue(v).trim());
    const key = vals.join("|");
    if (key === last) return; last = key;
    const r = document.documentElement.style;
    VARS.forEach((v, i) => { if (vals[i]) r.setProperty(v, vals[i]); });
    if (vals[11]) r.setProperty("--ssA", vals[11]);
  };
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["data-theme", "style"] });
  setInterval(sync, 1500); sync();
}
