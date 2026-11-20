# Keputusan Teknis

## Yii menangani aturan transaksi inti

Pendaftaran, rekam medis, stok, billing, dan pembayaran mengubah data operasional SIMRS. Aturan ini diletakkan di Yii supaya satu layanan menjadi sumber kebenaran. Node tidak membuat versi kedua dari aturan pembayaran atau pengeluaran stok.

## Node dipakai untuk layanan pendukung

Node menyediakan data agregasi dashboard, komunikasi order pemeriksaan penunjang, serta PDF invoice. Pemisahan ini menjaga endpoint transaksi utama tetap di Yii, sementara kebutuhan laporan dan integrasi dapat dikembangkan secara terpisah.

## PostgreSQL menjaga konsistensi akhir

Validasi aplikasi membantu memberikan pesan yang mudah dipahami, tetapi database juga menjaga integritas. Foreign key melindungi relasi, unique index melindungi nomor atau key tertentu, dan check constraint mencegah stok menjadi negatif.

## Pendaftaran aman terhadap request bersamaan

Pembuatan kunjungan berlangsung dalam transaksi. Yii mengunci pasien dan jadwal praktik sebelum memeriksa duplikasi serta kuota, lalu menyimpan nomor antrean. Unique index di database menjadi lapisan perlindungan tambahan jika dua request bertemu bersamaan.

## Stok baru berkurang saat obat diserahkan

Resep yang baru dibuat belum mengurangi stok. Saat petugas menyerahkan obat, Yii mengunci resep dan baris obat, mengecek ketersediaan, mengurangi stok, lalu memperbarui status dalam satu transaksi. Jika salah satu langkah gagal, transaksi dibatalkan.

## Pembayaran memakai idempotency key

Jaringan bisa putus setelah server menerima pembayaran. Frontend menyimpan key selama belum mendapat konfirmasi. Yii menyimpan key unik dan ringkasan isi request; retry identik mengembalikan transaksi sebelumnya, sedangkan key yang dipakai untuk nilai berbeda ditolak.

## Perubahan klinis punya batas yang jelas

Sebelum ada pembayaran, perubahan pemeriksaan dapat dilakukan melalui alur revisi dengan alasan dan audit perubahan. Setelah pembayaran tercatat, perubahan ditolak agar rincian billing tidak berubah diam-diam.

## Outbox mencegah order hilang saat Node tidak aktif

Order lab dan event untuk integrasi disimpan di PostgreSQL dalam transaksi yang sama. Dispatcher mengirim event setelahnya. Kegagalan layanan tidak membatalkan data klinis dan event dapat dicoba lagi. Operasional perlu menjadwalkan dispatcher; endpoint retry bukan pengganti jadwal worker.

## Pagination dan indeks membantu saat data bertambah

Endpoint daftar membatasi jumlah data per request, menyediakan filter dan pagination di jalur yang membutuhkan, dan migration menambahkan indeks untuk pencarian kunjungan, antrean, resep, laboratorium, serta pembayaran. Kinerja produksi tetap perlu dipantau dengan data dan beban yang mewakili pemakaian sebenarnya.

## Batasan yang perlu diketahui

- Dashboard saat ini membaca database bersama, sehingga Yii dan Node harus memakai database dan kredensial yang sesuai. Hak akses database produksi sebaiknya dibatasi per service.
- Dashboard agregasi masih berjalan saat request; belum memakai cache atau data mart.
- Dispatcher outbox perlu dijadwalkan dan dipantau oleh lingkungan deployment.
- Koleksi Postman membantu menjalankan request API, tetapi skenario konkurensi tetap perlu dijalankan dengan dua request paralel dan database uji.
- Dataset lokal adalah data demonstrasi. Screenshot dan hasil uji tidak menggantikan validasi klinis maupun persetujuan untuk penggunaan rumah sakit sungguhan.
