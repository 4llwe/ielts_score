import fs from "node:fs";
const required = [
  "COMMERCIAL-READINESS.md",
  "RELEASE-ACCEPTANCE.md",
  "SECURITY.md",
  "INCIDENT-RESPONSE.md",
  "DATA-RETENTION.md",
  "supabase/migrations/006_commercial_hardening.sql",
  "supabase/migrations/007_preparation_branding.sql",
  "supabase/migrations/008_toefl_preparation_form_a.sql",
  "scripts/build.mjs",
  "ops/README.md",
  "ops/LEGAL-REVIEW.md",
  "ops/CONTENT-RIGHTS-REGISTER.csv",
  "ops/ASSESSMENT-VALIDATION.md",
  "ops/EXAMINER-CALIBRATION.md",
  "ops/PENETRATION-TEST-BRIEF.md",
  "ops/PAYMENT-RECONCILIATION-SOP.md",
  "ops/BACKUP-RESTORE-DRILL.md",
  "ops/MANUAL-WCAG-AUDIT.md",
  "ops/PILOT-GO-NO-GO.md",
  "robots.txt",
  "sitemap.xml",
  "_redirects",
];
let ok = true;
for (const f of required)
  if (!fs.existsSync(f)) {
    console.error("Missing release artifact:", f);
    ok = false;
  }
const active = [
  "index.html",
  "assets/app.js",
  "assets/production-dashboard.js",
  "assets/production-test.js",
  "netlify/functions/api.mjs",
]
  .map((f) => fs.readFileSync(f, "utf8"))
  .join("\n");
if (/href=["']#\//.test(active)) {
  console.error("Active hash navigation remains");
  ok = false;
}
if (
  /Pendaftaran TOEFL Official Test|TOEFL & IELTS Prediction Test|IELTS Private Coaching/.test(
    active,
  )
) {
  console.error("Unapproved exam-brand product wording remains");
  ok = false;
}
if (
  !active.includes("IELTS Preparation") ||
  !active.includes("TOEFL Preparation")
) {
  console.error("Preparation-only brand wording missing");
  ok = false;
}
if (!active.includes("im_refresh") || !active.includes("privacy/export")) {
  console.error("Session/privacy hardening missing");
  ok = false;
}
if (!ok) process.exit(1);
console.log("Release checks passed.");
