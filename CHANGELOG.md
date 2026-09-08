# Changelog

## v1.2.0 — Perbaikan suara Listening

- Menghapus penggunaan audio demo yang hanya menghasilkan nada `tut`.
- Mengganti pemutaran dengan Web Speech API berbahasa `en-US`.
- Menambahkan tombol Putar, Hentikan, dan status pemutaran yang aksesibel.
- Menaikkan cache service worker ke `ielts-mate-v3` agar revisi segera dimuat.

## v1.1.0 — Listening & PWA revision

- Menambahkan audio nyata pada IELTS/TOEFL simulation, bukan hanya soal teks.
- Menambahkan pemutar audio HTML5, petunjuk headphone, status Audio aktif, dan transkrip latihan.
- Menambahkan berkas audio demo MP3 terkompresi untuk memperkecil transfer.
- Placement Test tetap menggunakan soal grammar tanpa Listening.
- Menambahkan web app manifest, service worker, ikon 192/512, dan cache dasar untuk meningkatkan kesiapan PWA.
- Menambahkan pemeriksaan otomatis untuk audio, manifest, service worker, dan ikon.

> Audio bawaan adalah materi demonstrasi. Ganti dengan rekaman berlisensi sebelum penggunaan komersial.

## 2026-09-08 — Program catalog & pricing

- Added 16 program and service entries from the supplied promotional materials.
- Added confirmed promotional pricing, previous-price display, and billing units.
- Added category filters and responsive program cards.
- Added a transparent pricing page with Midtrans-ready purchase actions.
- Added consultation status for programs without a supplied price.
- Added Supabase catalog migration and pricing governance notes.
- Reworded official-test service as registration assistance to avoid an unverified affiliation claim.

## 2026-09-08 — Preparation & recognition certificate dashboard

- Repositioned all assessments as independent preparation, practice, and internal diagnostic activities.
- Replaced official-score language with internal progress language.
- Added student recognition-certificate dashboard and completion criteria.
- Added administrator certificate issuing, registry, and revocation workflow.
- Added printable Certificate of Participation and Certificate of Completion layouts.
- Added public certificate-number verification and Supabase verification API.
- Added certificate audit integration, RLS-compatible schema migration, and certificate policy.
- Added explicit disclaimer that certificates are not official IELTS/TOEFL certificates or proficiency scores.

## 2026-09-08 — Brand and director profile

- Added the supplied IELTS_MATE logo to navigation, footer, contact, PWA icons, and certificates.
- Added Sumawartini, M.TESOL as Founder & Program Director.
- Added the supplied director portrait and official contact details.
- Updated certificate signature identity and public contact page.

## 2026-09-08 — Institutional profile

- Added the official IELTS_MATE narrative, vision, mission, values, learning journey, leadership, and contact profile.
- Added a public Profil Lembaga page and homepage introduction.
- Added an admin Institution CMS panel with Supabase synchronization.
- Added migration 004_institution_profile.sql and public/admin API routes.

## 2026-09-08 — Full production integration

- Removed role selection, local login fallback, example dashboard metrics, and demo-only actions.
- Added live role dashboards for students, instructors, examiners, and administrators.
- Added real users, enrollments, programs, classes, leads, materials, assignments, attendance, schedules, notifications, CMS, and audit APIs.
- Added secure payment-to-enrollment automation after verified Midtrans notifications.
- Added server-side test packages, attempts, answer persistence, scoring, and admin question-bank management.
- Added migration 005_full_operations.sql with RLS-protected operational tables.

## 2026-09-08 — Logo-derived futuristic visual system

- Rebuilt the interface around the logo palette: deep burgundy, silver, soft rose, ivory, and obsidian.
- Added a distinctive editorial/futuristic visual language with geometric linework, restrained depth, sharper radii, and stronger hierarchy.
- Restyled public pages, dashboard roles, test engine, forms, certificate, institution profile, and mobile navigation consistently.
- Preserved accessibility, focus visibility, reduced-motion support, responsive behavior, and print-safe certificates.
