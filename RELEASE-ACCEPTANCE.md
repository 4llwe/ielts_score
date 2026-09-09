# Release Acceptance — evidence required

A release is commercially approved only when every item has owner, date, environment, and evidence link.

- [ ] Legal entity, tax, invoice, privacy, terms, refund, trademark, and content licenses approved.
- [ ] Supabase migrations 001–006 applied; RLS tests, MFA, email verification, rate limits, and backup restore passed.
- [ ] Midtrans production settlement, denial, expiry, duplicate webhook, and refund cases reconciled.
- [ ] All published questions are original/licensed/cleared and all published tests have approved validation status.
- [ ] Examiner rubric calibration and moderation sample meet the academic quality threshold.
- [ ] WCAG 2.2 AA manual audit covers public pages, four dashboards, test flows, modals, errors, and mobile.
- [ ] OWASP ASVS review and authenticated penetration test have no open critical/high findings.
- [ ] Core Web Vitals field targets pass at p75 after the pilot.
- [ ] Monitoring, alerting, incident contacts, support SLA, privacy requests, retention jobs, and status communication tested.
- [ ] Pilot cohort exit criteria and go/no-go approval signed.

## Commercial Launch Evidence Pack

Lengkapi prosedur di `ops/`, letakkan bukti final di `evidence/`, lalu jalankan `npm run check:evidence`. Kelulusan script hanya memeriksa keberadaan artefak; keaslian, tanda tangan, ruang lingkup, dan validitas harus diverifikasi manusia.
