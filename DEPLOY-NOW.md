# Deploy singkat

## Cara paling aman (GitHub → Netlify)

1. Ekstrak `ielts_score-ready.zip`.
2. Salin seluruh isi folder hasil ekstrak ke repository GitHub `ielts_score`, lalu commit ke branch `main`.
3. Netlify akan menjalankan `npm run build` dan menerbitkan versi baru otomatis.

Setelah status deploy **Published**, buka website di jendela incognito dan uji login.

## Perbaikan utama

- Form login modal sekarang benar-benar terhubung ke proses autentikasi.
- Access token sesi dikirim sebagai Bearer token jika browser/Netlify tidak mempertahankan cookie.
- Refresh sesi memperbarui token pada tab aktif.
- Dashboard dan mesin tes memakai sesi autentikasi yang sama.
- Cache Service Worker dinaikkan versinya agar JavaScript lama dibuang.
- Inline style dan inline event handler yang diblokir CSP telah dihapus.
- Filter Program sekarang hanya menampilkan kartu sesuai menu yang dipilih.
- Akun admin langsung diarahkan ke workspace `/admin` tanpa header publik.
- Menu Persiapan Tes menampilkan akses Paket Tes, Bank Soal, dan Kelas.
- Menu Kajian Tes diganti menjadi Alumni & Testimoni dengan formulir pengiriman cerita untuk diverifikasi.
- Sertifikat memakai tanda tangan direktur yang sudah dibersihkan dan barcode QR menuju halaman verifikasi.
- Dashboard otomatis memperbarui sesi kedaluwarsa sehingga data tidak berhenti pada pesan gagal dimuat.
- Ringkasan admin tetap tampil jika salah satu sumber metrik belum tersedia.
- Navigasi lama berbentuk `#/...` dinormalisasi ke rute aktif, termasuk Alumni & Testimoni.
- Favicon, ikon Safari, ikon PWA, dan ikon open link memakai logo lembaga.

## Konfigurasi Netlify yang tetap diperlukan

Pastikan environment variables produksi yang tercantum di `.env.example` sudah tersedia di Netlify. Jangan mengunggah file `.env` atau secret key ke GitHub.
