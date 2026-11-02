import fs from "node:fs";
const logo = "data:image/png;base64," + fs.readFileSync("layer/logo.png").toString("base64");
const word = (t, d0) => `<div class="word${d0 > 1 ? " w2" : ""}">` + [...t].map((c, i) => c === " " ? `<span style="width:.45em"></span>` : `<span style="animation-delay:${(d0 + i * 0.07).toFixed(2)}s">${c}</span>`).join("") + `</div>`;
export default `<div id="ss-splash" aria-hidden="true"><div class="grid"></div><div class="mark"><div class="ring"></div><div class="ring r2"></div><img alt="" src="${logo}"></div>${word("SWEET SPOT", 0.7)}${word("TRADING", 1.5)}<div class="sub">Journal</div><div class="bar"><i></i></div></div>`;
