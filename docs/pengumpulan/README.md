# Dokumen Pengumpulan SIMRS Rawat Jalan

Dokumen ini merangkum cara kerja aplikasi, cara menjalankannya, daftar endpoint, keputusan teknis, dan cara memeriksa fitur utama. Isinya mengikuti source code di repository ini.

## Isi folder

1. [Arsitektur dan alur komunikasi](./01-arsitektur.md)
2. [Instalasi dan konfigurasi](./02-instalasi-konfigurasi.md)
3. [Dokumentasi endpoint API](./03-dokumentasi-api.md)
4. [Keputusan teknis](./04-keputusan-teknis.md)
5. [Test case dan cara pengujian](./05-pengujian.md)
6. [Bukti implementasi](./06-bukti-implementasi.md)
7. [Hasil uji lokal yang sudah dijalankan](./hasil-uji-lokal.md)

Collection untuk Postman ada di [`postman/SIMRS-Rawat-Jalan.postman_collection.json`](../../postman/SIMRS-Rawat-Jalan.postman_collection.json). Variabel contoh ada di [`postman/SIMRS-local.postman_environment.json`](../../postman/SIMRS-local.postman_environment.json).

## Catatan sebelum demo atau pengumpulan

- Jalankan aplikasi lokal dan pakai data dummy. Jangan masukkan data pasien sungguhan ke repository, screenshot, atau collection Postman.
- Akun yang tertulis di README utama adalah akun demo lokal, bukan akun untuk server publik. Ganti password dan secret sebelum aplikasi dipasang di luar lingkungan lokal.
- Folder `bukti-tampilan` disediakan untuk screenshot yang diambil dari aplikasi. Screenshot harus menunjukkan hasil yang benar-benar dijalankan; jangan mengisi bukti dengan mockup.
- Pastikan satu alur demonstrasi selesai dari pendaftaran sampai pembayaran. Jika database lokal belum memiliki data yang cocok untuk seluruh tahapan, siapkan data uji terlebih dahulu dan catat kendala pada laporan.
- Test case di dokumen menjelaskan prosedur dan hasil yang diharapkan. Hasil pengujian harus dicatat setelah benar-benar menjalankan skenario, bukan dianggap lulus hanya karena aplikasinya bisa dibuka.
