# Hasil Uji Lokal

Pengujian berikut dijalankan pada aplikasi lokal dengan satu pasien dummy khusus dokumentasi. Tidak ada NIK atau data pasien sungguhan yang dicatat di laporan ini.

Tanggal pengujian: 20 November 2026.

| Bagian | Hasil yang diamati |
|---|---|
| Node.js health | `GET /api/health` merespons berhasil. Screenshot ada di `bukti-tampilan/01-node-health.png`. |
| Master tindakan | Daftar tindakan dan tarif tampil di aplikasi. Screenshot ada di `bukti-tampilan/02-master-tindakan.png`. |
| Pendaftaran | Pasien dummy dan kunjungan berhasil disimpan; antrean `T-002` tampil dengan status `MENUNGGU`. Screenshot ada di `bukti-tampilan/03-pendaftaran-antrean.png`. |
| Pemeriksaan | Rekam medis, satu tindakan medis, dan satu resep berhasil disimpan. Aplikasi menampilkan konfirmasi sukses. |
| Billing | Total Rp178.000, terdiri dari pendaftaran Rp50.000, tindakan Rp120.000, obat Rp8.000, dan lab Rp0. Pembayaran berhasil menjadi `LUNAS`. Screenshot ada di `bukti-tampilan/07-billing-kasir.png`. |
| Idempotency pembayaran | Request ulang dengan key dan payload pembayaran yang sama menghasilkan HTTP 200 dan `idempotent_replay=true`. Key sama dengan nominal berbeda ditolak dengan HTTP 409. |
| Penyerahan obat | Farmasi berhasil menyerahkan resep; aplikasi mengonfirmasi stok diperbarui. Screenshot ada di `bukti-tampilan/08-farmasi.png`. |
| Invoice | Endpoint Node mengembalikan HTTP 200 dengan content type `application/pdf`. File PDF ada di `bukti-tampilan/09-invoice.pdf`. |

Pengujian ini membuktikan satu alur dasar sampai pembayaran dan penyerahan obat, serta retry pembayaran idempotent. Skenario pemeriksaan laboratorium, kegagalan Node saat pengiriman order, dan dua transaksi bersamaan berebut stok belum dijalankan dalam sesi ini. Jalankan test case TX pada [dokumen pengujian](./05-pengujian.md) terpisah di database khusus uji.

## Bukti API di Postman

Collection yang bisa di-import ada di `postman/SIMRS-Rawat-Jalan.postman_collection.json`. Request pembayaran di collection memiliki assertion untuk retry idempotency. Sesi yang menghasilkan catatan di atas dijalankan dari aplikasi/browser lokal, bukan dari Postman Desktop; sebelum pengumpulan akhir, jalankan collection tersebut di Postman dan simpan screenshot hasil Runner agar bukti penggunaan Postman juga tersedia.
