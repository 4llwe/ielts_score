# IELTS_MATE — Production Setup (Supabase + Midtrans + Netlify)

## 1. Supabase

1. Buat proyek Supabase baru di region terdekat pengguna.
2. Buka **SQL Editor** dan jalankan migrasi secara berurutan:
   - `supabase/migrations/001_production_schema.sql`
   - `supabase/migrations/002_program_catalog.sql`
   - `supabase/migrations/003_recognition_certificates.sql`
   - `supabase/migrations/004_institution_profile.sql`
   - `supabase/migrations/005_full_operations.sql`
   - `supabase/migrations/006_commercial_hardening.sql`
   - `supabase/migrations/007_preparation_branding.sql`
   - `supabase/migrations/008_toefl_preparation_form_a.sql`
3. Di Authentication, aktifkan email confirmation dan atur Site URL ke domain produksi.
4. Tambahkan redirect URL Netlify preview dan domain produksi.
5. Buat pengguna admin, lalu jalankan:

```sql
update public.profiles set role='admin' where email='EMAIL_ADMIN_ANDA';
```

6. Pastikan Storage memiliki bucket privat `writing` dan `speaking` setelah migrasi.
7. Jangan pernah meletakkan `SUPABASE_SERVICE_ROLE_KEY` di frontend atau repository publik.

## 2. Midtrans

1. Buat akun merchant dan selesaikan verifikasi bisnis.
2. Gunakan Sandbox untuk uji pembayaran.
3. Di Midtrans Dashboard, atur Payment Notification URL:

```text
https://DOMAIN-ANDA/api/payments/webhook
```

4. Atur Finish URL ke `https://DOMAIN-ANDA/dashboard`.
5. Setelah seluruh skenario lulus, ubah `MIDTRANS_IS_PRODUCTION=true` dan gunakan production keys.

Skenario wajib: sukses, pending, deny, cancel, expire, refund, notifikasi duplikat, dan signature tidak valid.

## 3. Netlify

Import repository dan gunakan:

- Build command: kosong
- Publish directory: `.`
- Functions directory: `netlify/functions`

Tambahkan environment variables sesuai `.env.example`. Gunakan secret scanning dan batasi akses tim.

## 4. Domain dan email

- Hubungkan domain kustom dan paksa HTTPS.
- Konfigurasikan SPF, DKIM, dan DMARC.
- Jika memakai Resend, verifikasi domain pengirim dan isi `RESEND_API_KEY` serta `EMAIL_FROM`.

## 5. Data dan privasi

- Tetapkan retensi jawaban, audio, invoice, dan audit log.
- Buat proses ekspor, koreksi, dan penghapusan data pengguna.
- Batasi akses examiner hanya ke submission yang ditugaskan.
- Buat backup database dan uji restore sebelum launch.

## 6. Mutu asesmen

- Gunakan audio manusia yang berlisensi.
- Lakukan expert review dan pilot testing.
- Hitung tingkat kesulitan, daya beda, reliabilitas, distractor efficiency, dan differential item functioning.
- Kalibrasi rater Writing/Speaking dan ukur inter-rater agreement.
- Jangan menyebut skor latihan sebagai skor resmi IELTS/TOEFL.

## 7. Gate peluncuran komersial

Publikasi berbayar hanya setelah:

- autentikasi email dan pemulihan akun diuji;
- RLS diuji dengan akun student, examiner, dan admin;
- pembayaran Sandbox lulus seluruh skenario;
- kebijakan privasi, syarat, dan refund ditinjau penasihat hukum;
- monitoring, backup, dan incident response aktif;
- bank soal dan rubrik selesai divalidasi.
