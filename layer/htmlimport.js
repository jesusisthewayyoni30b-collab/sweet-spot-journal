// Lets the journal's "Import Trades" accept MetaTrader statement/report files (.html).
// Supports MT4-style statements (FBS, Exness, etc. "Closed Transactions") and MT5 "Trade History Report"
// (Positions table, often UTF-16). The report is converted to a CSV the journal already understands.
const DT = /^\d{4}[.\-/]\d{2}[.\-/]\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/;
const num = (s) => { const v = String(s ?? "").replace(/[\s ]/g, "").replace(/,/g, ""); return v === "" || isNaN(+v) ? null : +v; };
const dt = (s) => String(s).trim().replace(/\./g, "-").replace("T", " ").replace(/\//g, "-");
const csvCell = (v) => { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function decode(buf) {
  const u = new Uint8Array(buf);
  if (u[0] === 0xff && u[1] === 0xfe) return new TextDecoder("utf-16le").decode(u);
  if (u[0] === 0xfe && u[1] === 0xff) return new TextDecoder("utf-16be").decode(u);
  if (u[0] === 0xef && u[1] === 0xbb) return new TextDecoder("utf-8").decode(u.subarray(3));
  // UTF-16 without BOM: every other byte is 0
  let z = 0; for (let i = 1; i < Math.min(u.length, 400); i += 2) if (u[i] === 0) z++;
  if (z > 120) return new TextDecoder("utf-16le").decode(u);
  return new TextDecoder("utf-8").decode(u);
}

const clean = (c) => c.textContent.replace(/[ \s]+/g, " ").trim();

export function parseReport(text) {
  const doc = new DOMParser().parseFromString(text, "text/html");
  const trades = [];
  for (const table of doc.querySelectorAll("table")) {
    const rows = [...table.querySelectorAll(":scope > tbody > tr, :scope > tr")];
    let head = null, hi = -1;
    for (let i = 0; i < rows.length; i++) {
      const cells = [...rows[i].children].map(clean);
      const low = cells.map((c) => c.toLowerCase().replace(/[^a-z]/g, ""));
      const has = (k) => low.includes(k);
      if ((has("symbol") || has("item")) && has("type") && has("profit") && (has("ticket") || has("position") || has("time") || has("opentime"))
        && !has("direction") && !has("deal")) { head = low; hi = i; break; }
    }
    if (!head) continue;
    const idx = (name, nth = 0) => { let n = 0; for (let i = 0; i < head.length; i++) if (head[i] === name) { if (n === nth) return i; n++; } return -1; };
    const col = {
      id: head.includes("ticket") ? idx("ticket") : idx("position"),
      open: head.includes("opentime") ? idx("opentime") : idx("time", 0),
      close: head.includes("closetime") ? idx("closetime") : idx("time", 1),
      type: idx("type"), size: head.includes("size") ? idx("size") : idx("volume"),
      sym: head.includes("item") ? idx("item") : idx("symbol"),
      oprice: idx("price", 0), cprice: idx("price", 1), sl: head.includes("sl") ? idx("sl") : -1, tp: head.includes("tp") ? idx("tp") : -1,
      comm: idx("commission"), swap: idx("swap"), profit: idx("profit"),
    };
    // MT report headers use "S / L" and "T / P"
    if (col.sl < 0) col.sl = head.findIndex((h) => h === "sl" || h === "s" || h.startsWith("sl"));
    if (col.tp < 0) col.tp = head.findIndex((h) => h === "tp" || h === "t" || h.startsWith("tp"));
    for (let i = hi + 1; i < rows.length; i++) {
      let c = [...rows[i].children].map(clean);
      if (c.length !== head.length) { const nz = c.filter((x) => x !== ""); if (nz.length === head.filter(Boolean).length) c = nz; else continue; }
      const type = (c[col.type] || "").toLowerCase();
      if (type !== "buy" && type !== "sell") continue;
      if (!DT.test(c[col.open] || "") || !DT.test(c[col.close] || "")) continue;
      const profit = num(c[col.profit]) ?? 0, comm = num(c[col.comm]) ?? 0, swap = num(c[col.swap]) ?? 0;
      const net = round(profit + comm + swap);
      const note = [];
      const after = rows[i + 1] && rows[i + 1].children.length < 4 ? clean(rows[i + 1]) : "";
      const m = /\[(sl|tp)\b/i.exec(after || ""); if (m) note.push(m[1].toLowerCase() === "tp" ? "Closed at TP" : "Closed at SL");
      note.push("Ticket " + (c[col.id] || ""));
      trades.push({
        open: dt(c[col.open]), close: dt(c[col.close]), pair: (c[col.sym] || "").toUpperCase(),
        dir: type === "buy" ? "Buy" : "Sell", lots: String(c[col.size] || "").split("/")[0].trim(),
        entry: c[col.oprice], exit: c[col.cprice], sl: col.sl >= 0 ? c[col.sl] : "", tp: col.tp >= 0 ? c[col.tp] : "",
        comm: comm || "", swap: swap || "", gross: round(profit), net,
        res: net > 0 ? "Win" : net < 0 ? "Loss" : "BE", note: note.join(" · "),
      });
    }
  }
  return trades;
}

export function toCsv(trades) {
  const H = ["Open Time", "Close Time", "Pair", "Direction", "Lot Size", "Entry Price", "Exit Price", "SL Price", "TP Price", "Commission", "Swap", "Gross P&L", "Net P&L", "Result", "Notes"];
  const lines = [H.join(",")];
  for (const t of trades) lines.push([t.open, t.close, t.pair, t.dir, t.lots, t.entry, t.exit, t.sl, t.tp, t.comm, t.swap, t.gross, t.net, t.res, t.note].map(csvCell).join(","));
  return lines.join("\n");
}

const shift = (str, hrs) => {
  if (!hrs) return str;
  const d = new Date(str.replace(" ", "T") + "Z"); d.setUTCHours(d.getUTCHours() - hrs);
  return d.toISOString().slice(0, 19).replace("T", " ");
};
const applyOffset = (trades, hrs) => { for (const t of trades) { t.open = shift(t.open, hrs); t.close = shift(t.close, hrs); } return trades; };

// MetaTrader "trading-data" CSV exports (Ticket ID, Open Time, Open Price, Close Time, Close Price, Profit, Lots, Commission, Swap, Symbol, Type, SL, TP ...)
function splitCsv(line) { const o = []; let c = "", q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { if (q && line[i + 1] === '"') { c += '"'; i++; } else q = !q; } else if (ch === "," && !q) { o.push(c); c = ""; } else c += ch; } o.push(c); return o; }
export function parseMtCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const h = splitCsv(lines[0]).map((x) => x.trim().toLowerCase().replace(/[^a-z]/g, ""));
  const ix = (n) => h.indexOf(n);
  if (ix("ticketid") < 0 && ix("ticket") < 0 && ix("position") < 0) return null;
  if (ix("symbol") < 0 || ix("profit") < 0 || ix("opentime") < 0 || ix("closetime") < 0 || (ix("lots") < 0 && ix("volume") < 0 && ix("size") < 0)) return null;
  const id = ix("ticketid") >= 0 ? ix("ticketid") : ix("ticket") >= 0 ? ix("ticket") : ix("position");
  const lot = ix("lots") >= 0 ? ix("lots") : ix("size") >= 0 ? ix("size") : ix("volume");
  const out = [];
  for (const l of lines.slice(1)) {
    const c = splitCsv(l); const type = (c[ix("type")] || "").toLowerCase();
    if (type !== "buy" && type !== "sell") continue;
    const profit = num(c[ix("profit")]) ?? 0, comm = ix("commission") >= 0 ? num(c[ix("commission")]) ?? 0 : 0, swap = ix("swap") >= 0 ? num(c[ix("swap")]) ?? 0 : 0;
    const net = round(profit + comm + swap);
    out.push({
      open: dt(c[ix("opentime")]), close: dt(c[ix("closetime")]), pair: (c[ix("symbol")] || "").toUpperCase(), dir: type === "buy" ? "Buy" : "Sell",
      lots: String(c[lot] || "").trim(), entry: c[ix("openprice")] ?? "", exit: c[ix("closeprice")] ?? "", sl: ix("sl") >= 0 && num(c[ix("sl")]) ? c[ix("sl")] : "", tp: ix("tp") >= 0 && num(c[ix("tp")]) ? c[ix("tp")] : "",
      comm: comm || "", swap: swap || "", gross: round(profit), net, res: net > 0 ? "Win" : net < 0 ? "Loss" : "BE", note: "Ticket " + (c[id] || ""),
    });
  }
  return out.length ? out : null;
}

// Ask whether to convert broker server time to New York time
function askOffset() {
  return new Promise((resolve) => {
    let saved = "7"; try { saved = localStorage.getItem("ss-broker-offset") || "7"; } catch (e) {}
    const w = document.createElement("div"); w.className = "ss-off";
    w.innerHTML = '<div class="ss-off-card"><div class="ss-off-t">Broker report times</div><div class="ss-off-p">MetaTrader reports use your <b>broker server time</b>. The journal (kill zones, sessions, calendar) runs on <b>New York time</b>. Most brokers (FundedNext, FBS, Exness, IC Markets...) are New York + 7 hours.</div>'
      + '<button class="ss-off-b pri" data-h="7">Convert to New York time (\u22127h)</button>'
      + '<div class="ss-off-row"><span>Other broker: hours ahead of New York</span><input type="number" step="1" min="-12" max="14" value="' + saved + '"><button class="ss-off-b" data-c="1">Use</button></div>'
      + '<button class="ss-off-b ghost" data-h="0">Keep the times as they are</button></div>';
    const done = (h) => { try { localStorage.setItem("ss-broker-offset", String(h)); } catch (e) {} w.remove(); resolve(h); };
    w.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.c) done(Number(w.querySelector("input").value) || 0); else done(Number(b.dataset.h));
    });
    document.body.appendChild(w);
  });
}

const isHtml = (f) => /\.html?$/i.test(f.name) || f.type === "text/html";
const isCsv = (f) => /\.csv$/i.test(f.name);

// make the import screen say that MetaTrader HTML reports are welcome
function relabel() {
  const map = [
    [/^Import Trades from Excel \/ CSV$/, "Import Trades \u2014 Excel, CSV or MetaTrader HTML"],
    [/^Choose an \.xlsx, \.xls, or \.csv file to get started\.$/, "Choose an .xlsx, .xls, .csv file or a MetaTrader .html report (MT4 / MT5 / FBS statement) to get started."],
  ];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) { const t = (n.nodeValue || "").trim(); if (t.length > 20 && t.length < 70) for (const [re, to] of map) if (re.test(t) && n.nodeValue !== to) n.nodeValue = to; }
}

export function initHtmlImport() {
  let rt = 0; new MutationObserver(() => { clearTimeout(rt); rt = setTimeout(relabel, 120); }).observe(document.body, { childList: true, subtree: true });
  // 1) let the Android/desktop picker offer .html files on the journal's import input
  document.addEventListener("click", (e) => {
    const el = e.target;
    if (el && el.tagName === "INPUT" && el.type === "file" && /\.csv/i.test(el.accept) && !/html/i.test(el.accept)) el.accept += ",.html,.htm,text/html";
  }, true);
  // 2) convert a chosen MetaTrader report / export to a CSV the journal understands
  document.addEventListener("change", async (e) => {
    const el = e.target;
    if (!el || el.tagName !== "INPUT" || el.type !== "file" || el.__ssConv) return;
    const f = el.files && el.files[0];
    if (!f) return;
    const json = /\.json$/i.test(f.name), html = isHtml(f), csv = isCsv(f);
    if (!json && !html && !csv) return;
    e.stopImmediatePropagation(); e.stopPropagation();           // hold the event until we know what the file is
    const pass = () => { el.__ssConv = true; el.dispatchEvent(new Event("change", { bubbles: true })); el.__ssConv = false; };
    try {
      if (json) {
        let j = null; try { j = JSON.parse(await f.text()); } catch (err) {}
        if (j && j.sweetSpotPartial && j.data) { await mergeRestore(j.data); el.value = ""; } else pass();
        return;
      }
      let trades = null;
      if (html) trades = parseReport(decode(await f.arrayBuffer()));
      else { trades = parseMtCsv(await f.text()); if (!trades) { pass(); return; } }   // an ordinary CSV: let the journal handle it
      if (!trades.length) { alert("No closed trades were found in that file. Use the Trade History / Statement HTML exported from MetaTrader (it must contain a Closed Transactions or Positions table)."); el.value = ""; return; }
      const hrs = await askOffset();
      const out = new File([toCsv(applyOffset(trades, hrs))], f.name.replace(/\.(html?|csv)$/i, "") + " (converted).csv", { type: "text/csv" });
      const dtf = new DataTransfer(); dtf.items.add(out); el.files = dtf.files;
      pass();
    } catch (err) { alert("Couldn't read that file: " + (err && err.message || err)); el.value = ""; }
  }, true);
}

async function mergeRestore(d) {
  const rd = async (k) => { try { const r = await window.storage.get(k, false); return r && r.value ? JSON.parse(r.value) : []; } catch (e) { return []; } };
  const merge = (cur, add) => { const m = new Map((cur || []).map((x) => [x.id, x])); for (const x of add || []) m.set(x.id, x); return [...m.values()]; };
  const acc = merge(await rd("sweetspot_accounts"), d.accounts), trd = merge(await rd("sweetspot_trades"), d.trades);
  await window.storage.set("sweetspot_accounts", JSON.stringify(acc), false);
  await window.storage.set("sweetspot_trades", JSON.stringify(trd), false);
  await window.storage.set("sweetspot_samples_seeded_v1", JSON.stringify(true), false);
  alert("Added " + (d.accounts || []).length + " accounts and " + (d.trades || []).length + " trades. Everything else in your journal was left as it is.");
  location.reload();
}
