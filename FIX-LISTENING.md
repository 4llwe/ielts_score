# Perbaikan Listening v1.2

Audio bunyi nada `tut` telah diganti dengan Web Speech API browser.

## Perubahan
- Tombol **Putar rekaman** membacakan teks bahasa Inggris menggunakan suara `en-US` perangkat.
- Tombol **Hentikan** menghentikan pemutaran.
- Status aksesibel menunjukkan siap, sedang diputar, selesai, atau gagal.
- Cache service worker dinaikkan ke `ielts-mate-v3` agar browser mengambil JavaScript terbaru.

## Setelah deploy
1. Lakukan hard refresh (`Cmd + Shift + R`).
2. Bila masih lama: DevTools → Application → Service Workers → Unregister → Clear site data.
3. Buka Tes Online → IELTS Simulation → Putar rekaman.

## Produksi
Web Speech API cocok untuk MVP, tetapi suara dapat berbeda antarperangkat. Untuk tes profesional, unggah rekaman MP3 manusia/voice talent yang berlisensi melalui bank soal dan simpan URL audionya di database.
