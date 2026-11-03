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
