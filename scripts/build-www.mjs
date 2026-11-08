import { build } from "esbuild";
import fs from "node:fs";
import splash from "./splash-html.mjs";
fs.mkdirSync("www", { recursive: true });
const r = await build({ entryPoints: ["layer/index.js"], bundle: true, minify: true, format: "iife", write: false, target: "es2020", legalComments: "none", loader: { ".png": "dataurl" } });
const js = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = fs.readFileSync("layer/splash.css", "utf8") + fs.readFileSync("layer/mobile.css", "utf8") + fs.readFileSync("layer/guide.css", "utf8");
let html = fs.readFileSync("source/SweetSpotTradingJourney.html", "utf8");
html = html.replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />');
html = html.replace("<title>Sweet Spot Trading Journey</title>", "<title>Sweet Spot Trading Journal</title>");
// website icons: replace the old favicon / home-screen icons with the new logo
const du = (f) => "data:image/png;base64," + fs.readFileSync("layer/" + f).toString("base64");
html = html.replace(/<link rel="(?:icon|apple-touch-icon|shortcut icon)"[^>]*>\s*/g, "");
html = html.replace("<head>", `<head>\n<link rel="icon" type="image/png" sizes="16x16" href="${du("favicon-16.png")}">\n<link rel="icon" type="image/png" sizes="32x32" href="${du("favicon-32.png")}">\n<link rel="icon" type="image/png" sizes="192x192" href="${du("favicon-192.png")}">\n<link rel="apple-touch-icon" sizes="180x180" href="${du("apple-touch-180.png")}">\n<meta name="theme-color" content="#000000">`);
// Way to Freedom starts hidden for new users; they switch it on in Settings
const wtfOld = "backtestingEnabled:!0,wtfEnabled:!0,defaultPair";
if (!html.includes(wtfOld)) throw new Error("default settings not found");
html = html.replace(wtfOld, "backtestingEnabled:!0,wtfEnabled:!1,defaultPair");
const gOld = `tab:"wtfOverview",body:"This is Freedom View`, gNew = `tab:"dashboard",body:"Hidden until you want it: switch it on in Settings \\u2192 Global Defaults. This is Freedom View`;
const gOld2 = "Don't want this section at all? Turn it off in Settings \u2192 Global Defaults \u2014 nothing gets deleted, it just tucks away.";
if (!html.includes(gOld)) throw new Error("guide step not found");
html = html.replace(gOld, gNew);
html = html.replace(gOld2, "You can switch it off again any time \u2014 nothing gets deleted, it just tucks away.");
const marker = '<script type="module" crossorigin>';
const at = html.indexOf(marker);
if (at < 0) throw new Error("module script marker not found");
html = html.slice(0, at) + `<style id="ss-layer-css">${css}</style>\n<script>${js}</script>\n` + html.slice(at);
// the layer must run BEFORE the journal's module script; head placement guarantees that
const rootTag = '<div id="root"></div>';
const ri = html.lastIndexOf(rootTag);
if (ri < 0) throw new Error("root div not found");
html = html.slice(0, ri) + splash + html.slice(ri);
fs.writeFileSync("www/index.html", html);
console.log("www/index.html", (html.length / 1e6).toFixed(2) + " MB");
