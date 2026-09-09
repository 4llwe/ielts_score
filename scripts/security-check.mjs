import fs from "node:fs";
import path from "node:path";
const roots = ["index.html", "assets", "netlify", "supabase", ".env.example"];
const files = [];
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  const st = fs.statSync(root);
  if (st.isFile()) files.push(root);
  else {
    const walk = (d) =>
      fs
        .readdirSync(d, { withFileTypes: true })
        .forEach((e) =>
          e.isDirectory()
            ? walk(path.join(d, e.name))
            : files.push(path.join(d, e.name)),
        );
    walk(root);
  }
}
let ok = true;
for (const f of files) {
  const b = fs.readFileSync(f);
  if (b.includes(0)) continue;
  const s = b.toString("utf8");
  if (
    /(sk_live_|service_role_key\s*[=:]\s*[A-Za-z0-9_-]{20,}|MIDTRANS_SERVER_KEY=[^A-Z\n#])/.test(
      s,
    )
  ) {
    console.error("Possible secret:", f);
    ok = false;
  }
}
const netlify = fs.readFileSync("netlify.toml", "utf8");
for (const h of [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "Referrer-Policy",
]) {
  if (!netlify.includes(h)) {
    console.error("Missing header:", h);
    ok = false;
  }
}
if (!ok) process.exit(1);
console.log("Security static checks passed.");
