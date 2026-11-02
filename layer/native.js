// Android-only bits: file export through the share sheet, hardware back button.
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export function initNative() {
  if (!Capacitor.isNativePlatform()) return;
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    const a = this;
    if (a.download && a.href && a.href.startsWith("blob:")) {
      (async () => {
        try {
          const blob = await (await fetch(a.href)).blob();
          const data = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.readAsDataURL(blob); });
          const path = a.download || "export.txt";
          const w = await Filesystem.writeFile({ path, data, directory: Directory.Cache });
          await Share.share({ title: path, url: w.uri, dialogTitle: "Save or share " + path });
        } catch (e) { console.error("export failed", e); }
      })();
      return;
    }
    return origClick.call(a);
  };
  App.addListener("backButton", () => {
    if (window.__ssBack && window.__ssBack()) return;
    App.exitApp();
  });
}
