import fs from "node:fs";
import path from "node:path";
const out = path.resolve("dist");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const item of [
  "index.html",
  "assets",
  "data",
  "manifest.webmanifest",
  "sw.js",
  "robots.txt",
  "sitemap.xml",
  "_redirects",
]) {
  fs.cpSync(path.resolve(item), path.join(out, item), { recursive: true });
}
console.log(
  "Static dist created without migrations, private materials, operator docs, or answer keys.",
);
