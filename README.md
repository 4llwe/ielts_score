# IELTS_MATE Platform

MVP full-stack siap deploy untuk mengubah landing page IELTS_MATE menjadi platform kursus, tes, dashboard multi-peran, CMS navigasi, dan API dasar.

## Fitur yang tersedia

- Landing page profesional dan responsif
- Program, tes, paket & harga, sumber belajar, tentang, kontak, registrasi, dan halaman legal
- Dashboard demo untuk Siswa, Instructor, Examiner, dan Super Admin
- Navigation Manager: tambah, edit, urutkan, publish/draft, dan hapus menu
- Demo test engine dan penyimpanan jawaban lokal
- Form registrasi/kontak yang berfungsi dalam mode demo
- Netlify Function API dengan JWT, role guard, audit log, dan Netlify Blobs
- Security headers, CSP, mobile navigation, focus state, reduced motion
- Seed data dan script pemeriksaan proyek

## Penting: demo vs produksi

Antarmuka dapat dijalankan tanpa konfigurasi agar mudah direview. Login browser saat ini adalah **demo UI**. Jangan menggunakan mode demo untuk data nyata.

Untuk produksi:

1. Ubah frontend login agar memanggil `POST /api/auth/login`.
2. Set `DEMO_MODE=false`.
3. Set environment variables di Netlify:
   - `JWT_SECRET` — minimal 32 karakter acak
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD_HASH` — hash bcrypt; buat dengan `node -e "console.log(require('bcryptjs').hashSync('PASSWORD_KUAT',12))"`
4. Gunakan identity provider produksi (Supabase Auth, Auth0, Clerk, atau layanan setara) dan MFA untuk admin.
5. Hubungkan transaksi ke Midtrans/Xendit dan email transactional.
6. Tambahkan database relasional (PostgreSQL/Supabase) untuk users, courses, tests, attempts, payments, dan permissions. Netlify Blobs pada starter ditujukan untuk CMS ringan, bukan seluruh sistem akademik/transaksi.
7. Ganti seluruh materi/soal demo dengan materi berlisensi.
8. Tinjau halaman legal oleh penasihat hukum.

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
