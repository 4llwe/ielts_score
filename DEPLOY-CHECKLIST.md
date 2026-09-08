# Checklist Publikasi IELTS_MATE

## Wajib sebelum menerima pengguna nyata

1. Deploy ke Netlify dari repository Git.
2. Set `DEMO_MODE=false`.
3. Set `JWT_SECRET` acak minimal 32 karakter.
4. Set `ADMIN_EMAIL` dan `ADMIN_PASSWORD_HASH` bcrypt.
5. Pastikan Supabase Auth aktif, email confirmation bekerja, dan MFA admin diterapkan.
6. Hubungkan PostgreSQL/Supabase untuk akun, attempts, submission, hasil, dan audit.
7. Ganti audio Web Speech API dengan MP3 manusia yang berlisensi.
8. Aktifkan object storage untuk rekaman Speaking dan dokumen Writing.
9. Uji bank soal pada kelompok sasaran; analisis kesulitan, daya beda, reliabilitas, dan bias.
10. Tinjau Kebijakan Privasi, Syarat Layanan, Refund, dan disclaimer merek oleh penasihat hukum.
11. Uji pembayaran di sandbox sebelum mode produksi.
12. Pasang domain, HTTPS, email transaksional, analytics, error monitoring, backup, dan restore drill.

## Pemeriksaan yang sudah dilakukan

- Pemeriksaan struktur proyek: lulus.
- Pemeriksaan sintaks JavaScript: lulus.
- Pemeriksaan ZIP: lulus.
- Visual QA desktop dashboard admin: lulus.
- Visual QA seluler dashboard siswa: lulus.
- Tidak ditemukan resource gagal atau console error pada pratinjau final.

## Catatan status

Rilis menggunakan integrasi produksi. Publikasi hanya dilakukan setelah seluruh poin wajib, UAT, dan pengujian keamanan dinyatakan lulus.
