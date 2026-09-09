# Payment Reconciliation and Refund SOP

## Harian
1. Ekspor transaksi Midtrans dan daftar payment internal.
2. Cocokkan order ID, gross amount, status, waktu, dan enrollment.
3. Pisahkan missing webhook, duplicate, amount mismatch, chargeback, dan refund.
4. Jangan aktifkan akses pada transaksi yang belum terverifikasi.
5. Catat koreksi dan pemberi persetujuan dalam audit log.

## Refund
- Verifikasi identitas dan order ID.
- Terapkan kebijakan refund versi saat pembelian.
- Gunakan maker-checker untuk nilai di atas ambang internal.
- Simpan bukti provider dan notifikasi pelanggan.

## Uji sebelum launch
[ ] sukses [ ] pending [ ] gagal [ ] expired [ ] duplicate webhook [ ] refund penuh [ ] refund parsial [ ] chargeback

Bukti: `evidence/payment-reconciliation.pdf`
