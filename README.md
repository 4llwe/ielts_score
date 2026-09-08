# IELTS_MATE Platform

MVP full-stack siap deploy untuk mengubah landing page IELTS_MATE menjadi platform kursus, tes, dashboard multi-peran, CMS navigasi, dan API dasar.

## Fitur yang tersedia

- Landing page profesional dan responsif
- Program, tes, paket & harga, sumber belajar, tentang, kontak, registrasi, dan halaman legal
- Dashboard berbasis data nyata untuk Siswa, Instructor, Examiner, dan Super Admin
- Navigation Manager: tambah, edit, urutkan, publish/draft, dan hapus menu
- Test engine server-side: paket/soal dari Supabase, answer key tidak dikirim ke browser, scoring dan attempt disimpan di server
- Registrasi Supabase Auth dan formulir kontak tersimpan sebagai prospek CRM
- Netlify Function API dengan JWT, role guard, audit log, dan Netlify Blobs
- Security headers, CSP, mobile navigation, focus state, reduced motion
- Seed data dan script pemeriksaan proyek

## Mode produksi nyata

Dashboard memakai Supabase Auth, PostgreSQL/RLS, Midtrans, private Storage, audit log, dan API Netlify. Tidak ada pemilihan peran di login dan tidak ada data statistik contoh pada dashboard. Tanpa konfigurasi produksi, operasi aman akan gagal tertutup dan menampilkan pesan konfigurasi—bukan membuat data lokal semu.


## Menjalankan lokal

```bash
npm install
npm run dev
```

Atau untuk melihat frontend tanpa Functions:

```bash
python3 -m http.server 8888
```

Buka `http://localhost:8888`.

## Deploy ke Netlify

### Dari Netlify UI

1. Ekstrak ZIP dan unggah ke repository GitHub/GitLab.
2. Netlify → Add new project → Import repository.
3. Build command: kosong.
4. Publish directory: `.`
5. Functions directory: `netlify/functions`.
6. Tambahkan environment variables.
7. Deploy.

### Dari CLI

```bash
npm install
npx netlify login
npx netlify init
npx netlify deploy --prod
```

## Endpoint

- `GET /api/health`
- `GET /api/public`
- `POST /api/auth/login`
- `GET /api/admin/content` — token admin
- `PUT /api/admin/content` — token admin
- `GET /api/admin/audit` — token admin

## Struktur

```text
index.html
assets/
  styles.css
  app.js
data/
  seed.json
netlify/functions/
  api.mjs
netlify.toml
package.json
scripts-check.mjs
README.md
```

## Roadmap produksi

- PostgreSQL schema dan migrations
- Autentikasi MFA dan account recovery
- Payment gateway dan invoice
- LMS: enrollment, module, lesson, assignment, progress
- Test engine server-side: question bank, timer, autosave, scoring, examiner queue
- Certificate verification
- API partner management, scopes, webhooks, rate limiting
- File storage untuk audio, dokumen, dan speaking recordings
- Automated tests, error monitoring, backups, dan restore drill

## Trademark

IELTS dan TOEFL adalah merek pemiliknya masing-masing. Jangan menyatakan kemitraan, otorisasi, atau status tes resmi tanpa bukti dan izin tertulis.


## Preparation Lab terintegrasi

Menu Tes Online kini mencakup IELTS Mini Preparation dan TOEFL iBT 2026 Mini Preparation, kajian metode, audio simulasi, autosave, timer, skor objektif, word count, dan rekaman Speaking. Semua item bersifat orisinal dan diagnostik.


## Stack produksi pilihan

- Supabase: autentikasi, PostgreSQL, Row Level Security, dan Storage.
- Midtrans: Snap payment dan webhook dengan verifikasi signature.
- Netlify: hosting, Functions, HTTPS, headers, dan deployment.

Jalankan seluruh migrasi `supabase/migrations/001` sampai `005` secara berurutan, isi environment variables dari `.env.example`, lalu ikuti `PRODUCTION-SETUP.md`. Gunakan `npm run check:production` di lingkungan yang telah memiliki secrets.
