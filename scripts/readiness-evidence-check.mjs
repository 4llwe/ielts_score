import fs from "node:fs";
import path from "node:path";
const required = [
  ["legal-review.pdf", "Legal review"],
  ["content-rights-register.csv", "Content rights register"],
  ["assessment-validation.pdf", "Assessment validation"],
  ["examiner-calibration.pdf", "Examiner calibration"],
  ["penetration-test.pdf", "Independent penetration test and retest"],
  ["payment-reconciliation.pdf", "Payment reconciliation test"],
  ["backup-restore-drill.pdf", "Backup/restore drill"],
  ["manual-wcag-audit.pdf", "Manual WCAG audit"],
  ["pilot-go-no-go.pdf", "Signed go/no-go decision"],
];
const dir = path.resolve("evidence");
const missing = [];
for (const [file, label] of required) {
  const p = path.join(dir, file);
  if (!fs.existsSync(p) || fs.statSync(p).size < 32)
    missing.push(`${label}: evidence/${file}`);
}
if (missing.length) {
  console.error(
    "Commercial launch evidence is incomplete:\n- " + missing.join("\n- "),
  );
  process.exit(1);
}
console.log(
  "All external launch evidence files are present. Review signatures and validity manually.",
);
