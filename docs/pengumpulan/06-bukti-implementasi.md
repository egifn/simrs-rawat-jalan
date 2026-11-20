# Bukti Implementasi

## Bukti tampilan

Simpan screenshot aplikasi yang benar-benar berjalan di folder `bukti-tampilan` ini. Ambil gambar tanpa data pribadi, token, password, atau URL yang mengandung credential.

| File yang tersedia / disiapkan | Tampilan yang dibuktikan |
|---|---|
| `bukti-tampilan/01-node-health.png` | Response health service Node.js yang sedang berjalan. |
| `bukti-tampilan/02-master-tindakan.png` | Master tindakan dan tarif di aplikasi. |
| `bukti-tampilan/03-pendaftaran-antrean.png` | Form pendaftaran dan daftar antrean. Data yang terlihat berasal dari database demonstrasi lokal. |
| `bukti-tampilan/07-billing-kasir.png` | Rincian tagihan dan status pembayaran lunas. |
| `bukti-tampilan/08-farmasi.png` | Resep dummy yang sudah diserahkan. Screenshot dipotong agar tidak menampilkan data pasien lain. |
| `bukti-tampilan/09-invoice.pdf` | Invoice PDF yang dihasilkan service Node untuk kunjungan uji. |

Screenshot hanya menjadi bukti tampilan. Untuk membuktikan proses, sertakan urutan request/response Postman atau rekaman langkah test case.

## Bukti alur layanan

Untuk satu pasien dummy, dokumentasikan secara berurutan:

1. Pasien dan kunjungan dibuat; catat nomor registrasi dan antrean.
2. Dokter menyimpan pemeriksaan; catat status rekam medis serta item tindakan/lab/resep yang dipilih.
3. Petugas lab mengisi hasil jika kunjungan meminta pemeriksaan lab.
4. Kasir membuka rincian billing, melakukan pembayaran, dan memastikan sisa tagihan menjadi nol.
5. Farmasi menyerahkan resep setelah pembayaran lunas; catat perubahan stok.
6. Cetak invoice PDF untuk kunjungan yang sama.

Pakai satu ID kunjungan dummy yang sama dalam catatan sehingga hubungan antar tahap bisa diperiksa. Jangan menulis NIK atau data pasien asli di dokumen.

## Bukti backend Node.js

Lampirkan hasil Postman atau terminal untuk:

- `GET /api/health` berhasil.
- `GET /api/dashboard/summary` dengan rentang tanggal yang valid.
- `GET /api/lab/permintaan` dan `PUT /api/lab/hasil/{id}` pada data uji.
- `GET /api/pdf/invoice/{kunjungan_id}` menghasilkan file PDF.
- Webhook internal order lab dengan secret yang benar, tanpa menampilkan nilai secret.

## Status bukti saat dokumen dibuat

Screenshot health Node, master tindakan, pendaftaran, billing, dan penyerahan obat serta satu invoice PDF sudah dibuat dari aplikasi lokal menggunakan data dummy. Alur pemeriksaan dan pembayaran juga telah dijalankan. Screenshot dashboard, form pemeriksaan, dan input hasil laboratorium belum disertakan. Skenario laboratorium dan uji konkurensi masih perlu dijalankan terpisah.
