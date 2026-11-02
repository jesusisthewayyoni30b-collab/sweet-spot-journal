// Run after `npx cap add android`: puts the Sweet Spot icon, splash screen and dark theme into the Android project.
import fs from "node:fs";
import path from "node:path";
const from = path.resolve("android-assets/res");
const to = path.resolve("android/app/src/main/res");
if (!fs.existsSync(to)) { console.error("android project not found - run `npx cap add android` first"); process.exit(1); }
fs.cpSync(from, to, { recursive: true, force: true });
console.log("Sweet Spot icon, splash and theme applied.");
