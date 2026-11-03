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

const isHtml = (f) => /\.html?$/i.test(f.name) || f.type === "text/html";

export function initHtmlImport() {
  // 1) let the Android/desktop picker offer .html files on the journal's import input
  document.addEventListener("click", (e) => {
    const el = e.target;
    if (el && el.tagName === "INPUT" && el.type === "file" && /\.csv/i.test(el.accept) && !/html/i.test(el.accept)) el.accept += ",.html,.htm,text/html";
  }, true);
  // 2) convert a chosen report to a CSV before the journal reads it
  document.addEventListener("change", async (e) => {
    const el = e.target;
    if (!el || el.tagName !== "INPUT" || el.type !== "file" || el.__ssConv) return;
    const f = el.files && el.files[0];
    if (!f || !isHtml(f)) return;
    e.stopImmediatePropagation(); e.stopPropagation();
    try {
      const trades = parseReport(decode(await f.arrayBuffer()));
      if (!trades.length) { alert("No closed trades were found in that report. Use the Trade History / Statement HTML exported from MetaTrader (it must contain a Closed Transactions or Positions table)."); el.value = ""; return; }
      const csv = new File([toCsv(trades)], f.name.replace(/\.html?$/i, "") + ".csv", { type: "text/csv" });
      const dtf = new DataTransfer(); dtf.items.add(csv); el.files = dtf.files;
      el.__ssConv = true; el.dispatchEvent(new Event("change", { bubbles: true })); el.__ssConv = false;
    } catch (err) { alert("Couldn't read that report: " + (err && err.message || err)); el.value = ""; }
  }, true);
}
