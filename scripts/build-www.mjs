import { build } from "esbuild";
import fs from "node:fs";
fs.mkdirSync("www", { recursive: true });
const r = await build({ entryPoints: ["layer/index.js"], bundle: true, minify: true, format: "iife", write: false, target: "es2020", legalComments: "none" });
const js = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = fs.readFileSync("layer/mobile.css", "utf8");
let html = fs.readFileSync("source/SweetSpotTradingJourney.html", "utf8");
html = html.replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />');
html = html.replace("<title>Sweet Spot Trading Journey</title>", "<title>Sweet Spot Trading Journal</title>");
const marker = '<script type="module" crossorigin>';
const at = html.indexOf(marker);
if (at < 0) throw new Error("module script marker not found");
html = html.slice(0, at) + `<style id="ss-layer-css">${css}</style>\n<script>${js}</script>\n` + html.slice(at);
// the layer must run BEFORE the journal's module script; head placement guarantees that
fs.writeFileSync("www/index.html", html);
console.log("www/index.html", (html.length / 1e6).toFixed(2) + " MB");
