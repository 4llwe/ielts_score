# QA Report — Commercial Candidate v3

Date: 9 September 2026

## Automated checks passed

- JavaScript syntax: app, production dashboard, production test, and Netlify API.
- Project structure and required production assets.
- Static security checks and secret-pattern scan.
- Release artifact and clean-route checks.
- API health, HttpOnly cookie clearing, refresh rejection without credentials, and cross-origin mutation rejection.
- History API navigation and dynamic SEO title changes.
- Desktop and 390px mobile visual rendering: no horizontal viewport overflow, overlay collision, or runtime exception in tested states.
- Automated WCAG A/AA scan on 18 public routes: zero detected violations after remediation.
- Authenticated student dashboard desktop/mobile render: no overflow or runtime exception with deterministic QA data.

## Security controls added

- Secure HttpOnly access/refresh cookies, automatic refresh, and server logout.
- Same-origin enforcement for state-changing browser requests.
- Database-backed rate limiting for abuse-prone endpoints.
- Supabase RLS defense boundary and API role checks.
- Upload extension/size restrictions and HTTPS URL validation.
- Payment webhook signature verification and auditable operations.

## Academic and commercial release controls

- Unverified questions cannot be published.
- Unvalidated tests cannot be published or started.
- Existing demonstration material is moved out of published state by migration 006.
- Writing/Speaking evaluations require four rubric criteria on a 0–9 scale in 0.5 increments, plus substantive feedback.
- Practice results and certificates remain clearly separated from official IELTS/TOEFL claims.

## Required human/external acceptance

Automated QA cannot certify legal compliance, trademark permission, content ownership, psychometric validity, payment merchant approval, production infrastructure, or absence of every possible vulnerability. Commercial launch is approved only after the operator completes and signs every item in `RELEASE-ACCEPTANCE.md` with real production evidence.
