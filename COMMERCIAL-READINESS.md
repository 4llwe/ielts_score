# Commercial Readiness — IELTS_MATE

## Implemented in this upgrade

- Public-first landing page with explicit value proposition and conversion paths.
- Clean History API URLs with Netlify fallback; legacy hash links redirect to clean routes.
- Dynamic SEO title, description, canonical, Open Graph, JSON-LD, robots.txt, and sitemap.xml.
- Full public trust layer: privacy, terms, refund, cookie, accessibility, support, and trust center.
- Password recovery flow with enumeration-safe response.
- Same-origin validation for state-changing API requests when `SITE_URL` is configured.
- Clear independent-preparation and non-official-score disclaimers.
- Integrated role narrative for student, instructor, examiner, and admin.
- Resource hub with editorial metadata and educational disclaimers.
- PWA routes and service-worker cache updated for clean URLs.

## Launch gates — must be completed by the operator

1. Register the legal entity and replace personal contact channels where appropriate.
2. Obtain legal review of Privacy, Terms, Refund, consent, tax, and data-retention wording.
3. Review the IELTS_MATE brand and trademark risk; do not use official IELTS/TOEFL logos.
4. Run all Supabase migrations, enable RLS, MFA for staff, email verification, rate limits, backups, and recovery drills.
5. Configure Midtrans production keys, signed webhook, settlement reconciliation, invoice/tax handling, and refund operations.
6. Replace synthetic speech and demonstration assessment material with reviewed, licensed production content.
7. Calibrate tests, moderate Writing/Speaking, document rubrics, and prohibit claims of official score equivalence.
8. Replace placeholder operational statements such as response times only after an SLA is approved.
9. Add consent-controlled analytics, error monitoring, uptime alerts, and a support queue.
10. Perform WCAG 2.2 AA audit, mobile/device testing, penetration testing, and a pilot cohort before paid launch.

## Suggested commercial KPIs

- Visitor → registration; registration → diagnostic completion; diagnostic → consultation.
- Checkout completion, paid activation, refund rate, monthly retention, support response time.
- Weekly active learners, assignment completion, feedback turnaround, mock-test improvement.
- LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at p75, API error rate, and uptime.

## Release decision

The codebase is now a production-oriented commercial candidate. It must not be described as fully launched or legally certified until every launch gate above has evidence and an accountable owner.
