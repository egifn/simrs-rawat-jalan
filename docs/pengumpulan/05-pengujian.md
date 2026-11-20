# Test Case dan Pengujian

Gunakan database lokal dengan data dummy. Catat tanggal, commit atau versi source, akun role yang dipakai, hasil aktual, dan bukti untuk setiap test case. Jangan menganggap skenario lulus sebelum dijalankan.

## Test case alur utama

| ID | Skenario | Langkah inti | Hasil yang diharapkan |
|---|---|---|---|
| TC-01 | Login dan hak akses | Login sebagai petugas pendaftaran, lalu coba buka menu/endpoint admin. | Token berhasil diterbitkan; menu dan endpoint dibatasi sesuai permission. |
| TC-02 | Pasien baru | Tambah pasien dummy dengan data valid; ulangi memakai identitas yang sama. | Data valid tersimpan; identitas duplikat ditolak oleh validasi yang tersedia. |
| TC-03 | Pendaftaran kunjungan | Pilih pasien aktif, tanggal dengan jadwal, poli, dan dokter. | Kunjungan serta nomor antrean terbentuk dan tampil pada daftar. |
| TC-04 | Pendaftaran tanpa jadwal | Coba daftar pada tanggal dokter tidak praktik. | Server menolak; tidak ada kunjungan atau antrean setengah tersimpan. |
| TC-05 | Pemeriksaan | Sebagai dokter, simpan pemeriksaan dengan diagnosis serta item tindakan, lab, atau resep. | Rekam medis tersimpan; komponen biaya dan order terkait sesuai data yang dipilih. |
| TC-06 | Revisi pemeriksaan | Revisi pemeriksaan sebelum pembayaran dengan alasan; ulangi setelah ada pembayaran. | Revisi pertama tercatat di audit; setelah pembayaran server menolak perubahan. |
| TC-07 | Hasil laboratorium | Sebagai petugas lab, ubah status permintaan dan masukkan hasil. | Hasil tersimpan dan tidak tertimpa oleh pengiriman hasil ulang yang sudah selesai. |
| TC-08 | Pembayaran sebagian | Bayar sebagian tagihan, lalu buka kembali rincian billing. | Pembayaran tercatat, sisa berkurang, dan status belum lunas/sebagian sesuai model data. |
| TC-09 | Pembayaran lunas dan cetak | Bayar sisa tagihan dan minta invoice PDF. | Status lunas, sisa nol, dan endpoint invoice mengembalikan PDF dengan data kunjungan. |
| TC-10 | Penyerahan obat | Sebelum lunas coba serahkan; setelah lunas serahkan resep valid. | Sebelum lunas ditolak; setelah lunas stok berkurang dan status resep/kunjungan berubah. |
| TC-11 | Role farmasi/kasir | Coba akses endpoint milik role lain. | Endpoint menolak akses yang tidak diizinkan. |
| TC-12 | Paginasi daftar | Minta daftar kunjungan menggunakan `paginated=1&page=1&page_size=10`. | Response berisi `items`, `total`, nomor halaman, dan maksimum 10 item. |

## Test case transaksi dan gangguan

| ID | Skenario | Cara uji | Hasil yang diharapkan |
|---|---|---|---|
| TX-01 | Pendaftaran bersamaan | Kirim dua request kunjungan pasien/poli/tanggal yang sama secara bersamaan. | Hanya satu kunjungan diterima; request lainnya mendapat konflik/penolakan dan nomor antrean tidak ganda. |
| TX-02 | Dua penyerahan, stok satu | Siapkan dua resep yang membutuhkan stok obat terakhir; kirim dua request penyerahan hampir bersamaan. | Maksimal satu transaksi berhasil; stok tidak kurang dari nol. |
| TX-03 | Retry pembayaran | Kirim request pembayaran, lalu kirim ulang key dan payload yang sama. Setelah itu coba key sama dengan nominal berbeda. | Retry pertama mengembalikan pembayaran yang sama; payload berbeda ditolak. |
| TX-04 | Node tidak tersedia | Hentikan Node sementara, simpan order lab di Yii, lalu cek status outbox. Hidupkan Node dan jalankan `php yii lab-outbox/dispatch`. | Order tetap tersimpan sebagai tertunda; event dapat terkirim dan status diperbarui setelah retry berhasil. |
| TX-05 | Hasil lab selesai | Simpan hasil lab sampai selesai lalu coba ubah ulang melalui endpoint reguler. | Endpoint tidak menimpa hasil final secara diam-diam. |
| TX-06 | Perubahan tagihan | Simpan revisi klinis sebelum pembayaran dan verifikasi kembali item/tagihan; ulangi setelah pembayaran. | Total diperbarui sebelum pembayaran, perubahan tercatat, dan perubahan setelah pembayaran ditolak. |

## Pengujian melalui Postman

1. Import collection dan environment lokal.
2. Isi `base_url_yii`, `base_url_node`, username, password, dan ID data uji di environment lokal.
3. Jalankan **Auth - Login** terlebih dahulu. Script request menyimpan token dari response.
4. Jalankan request GET health, dashboard, pasien, antrean, lab, billing, dan invoice sesuai data yang tersedia.
5. Untuk operasi tulis, gunakan pasien dan kunjungan khusus pengujian. Jangan menargetkan data produksi.
6. Simpan screenshot atau export hasil Postman setelah request benar-benar dijalankan.

Collection berisi assertion status HTTP pada beberapa endpoint. Request pembayaran juga mencoba mengirim ulang key dan payload yang sama, lalu mencoba memakai key yang sama dengan nominal berbeda. Jalankan request tersebut hanya pada database lokal khusus uji dan sesuaikan `billing_id` serta `payment_amount`; request pertama benar-benar mencatat pembayaran. Untuk transaksi pembayaran baru, buat key baru; untuk retry transaksi yang sama, pertahankan key lama. Assertion API tidak membuktikan seluruh alur pelayanan atau uji konkurensi stok.

## Unit test dan integration test

Repository memiliki contoh Codeception bawaan Yii, terutama untuk fitur template seperti login dan halaman dasar. Itu belum mencakup enam skenario transaksi di atas. Gunakan test case TX sebagai daftar integration test yang harus dijalankan terhadap database uji, dan catat hasil aktual secara jujur. Jangan jalankan pengujian transaksi pada database berisi data yang perlu dipertahankan.
