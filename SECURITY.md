# Security Policy

## Production controls
- Access and refresh tokens are stored only in Secure, HttpOnly, SameSite cookies.
- Mutating requests require the configured same origin; payment webhook signature verification is separate.
- Authentication, recovery, registration, support, and other abuse-prone flows use database-backed rate limits.
- Supabase RLS remains the data authorization boundary; Netlify role checks are defense in depth.
- Staff MFA, email verification, breached-password protection, short session lifetime, and log retention must be enabled in Supabase.

## Vulnerability reporting
Report privately to the operator email. Do not include passwords, access tokens, or learner content. Acknowledge within one business day, triage within three, and communicate remediation status.

## Required external assurance
Before public launch: dependency review, OWASP ASVS review, authenticated penetration test, payment-flow test, backup restore drill, and least-privilege service-role review. Record evidence in the release checklist.
