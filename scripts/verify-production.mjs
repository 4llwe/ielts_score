import fs from "node:fs";
const required = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MIDTRANS_SERVER_KEY",
  "MIDTRANS_CLIENT_KEY",
  "SITE_URL",
  "RESEND_API_KEY",
  "EMAIL_FROM",
];
const missing = required.filter((k) => !process.env[k]);
const issues = [];
const placeholder =
  /^(change|replace|example|your_|xxx|test[-_]?key|placeholder)|example\.(com|org)$/i;
for (const key of required) {
  const value = String(process.env[key] || "").trim();
  if (value && (value.length < 8 || placeholder.test(value)))
    issues.push(`${key} appears to be a placeholder`);
}
if (process.env.DEMO_MODE !== "false") issues.push("DEMO_MODE must be false");
if (process.env.MIDTRANS_IS_PRODUCTION !== "true")
  issues.push("MIDTRANS_IS_PRODUCTION must be true");
try {
  const site = new URL(process.env.SITE_URL || "");
  if (
    site.protocol !== "https:" ||
    site.pathname !== "/" ||
    site.search ||
    site.hash
  )
    issues.push(
      "SITE_URL must be an exact HTTPS origin without path, query, or hash",
    );
} catch {
  if (process.env.SITE_URL) issues.push("SITE_URL is invalid");
}
try {
  if (new URL(process.env.SUPABASE_URL || "").protocol !== "https:")
    issues.push("SUPABASE_URL must use HTTPS");
} catch {
  if (process.env.SUPABASE_URL) issues.push("SUPABASE_URL is invalid");
}
for (const migration of [
  "006_commercial_hardening.sql",
  "007_preparation_branding.sql",
]) {
  if (!fs.existsSync(`supabase/migrations/${migration}`))
    issues.push(`Missing migration ${migration}`);
}
if (missing.length || issues.length) {
  console.error(JSON.stringify({ ok: false, missing, issues }, null, 2));
  process.exit(1);
}
console.log(
  JSON.stringify(
    { ok: true, mode: "production", site: process.env.SITE_URL },
    null,
    2,
  ),
);
