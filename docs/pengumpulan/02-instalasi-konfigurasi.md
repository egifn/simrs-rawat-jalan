# Instalasi dan Konfigurasi

Panduan ini untuk menjalankan aplikasi di komputer pengembangan Windows. Perintah dijalankan dari PowerShell. Sesuaikan alamat folder repository dengan lokasi di komputer masing-masing.

## Kebutuhan

- PHP dan Composer, dengan ekstensi PostgreSQL/PDO yang diperlukan Yii.
- PostgreSQL.
- Node.js dan npm.
- Git.

Versi package yang terpasang dapat dilihat pada `composer.json` dan file `package.json` masing-masing bagian.

## 1. Siapkan database

1. Buat database PostgreSQL bernama `simrs_rawat_jalan`.
2. Impor `database/simrs_rawat_jalan.sql` ke database tersebut.
3. Periksa `backend-yii/config/db.php` dan sesuaikan host, port, nama database, user, dan password dengan konfigurasi komputer.
4. Terapkan migration Yii:

```powershell
Set-Location 'D:\path\ke\simrs-rawat-jalan\backend-yii'
php yii migrate --interactive=0
```

Migration menambahkan kebutuhan role/permission, status aktif pasien, ketahanan transaksi, outbox laboratorium, constraint stok, dan indeks. Jangan menjalankan demo pada database yang berisi data pasien sungguhan.

## 2. Jalankan backend Yii

```powershell
Set-Location 'D:\path\ke\simrs-rawat-jalan\backend-yii'
$env:SIMRS_LAB_WEBHOOK_SECRET = 'ISI_SECRET_WEBHOOK_ACAK_YANG_SAMA_DI_NODE'
php yii serve --port=8000
```

API utama tersedia di `http://localhost:8000/api`.
Jalankan perintah secret dan server pada PowerShell yang sama agar Yii mewarisi konfigurasi tersebut.

## 3. Jalankan service Node.js

Siapkan file `.env` lokal di `service-node` berdasarkan `.env.example`:

```powershell
Set-Location 'D:\path\ke\simrs-rawat-jalan\service-node'
Copy-Item .env.example .env
```

Gunakan kredensial database lokal dan secret acak milik sendiri. `JWT_SECRET` Node harus sama dengan `jwtSecret` pada konfigurasi Yii, karena token Yii diverifikasi oleh service Node. Nilai `SIMRS_LAB_WEBHOOK_SECRET` pada `.env` Node harus sama dengan environment proses PHP. Jangan masukkan file `.env` atau secret ke Git atau menyalin nilainya ke screenshot. Jika file konfigurasi rahasia pernah masuk ke repository atau riwayat commit, ganti semua secret/kredensial tersebut sebelum repository dibagikan.

```powershell
Set-Location 'D:\path\ke\simrs-rawat-jalan\service-node'
npm install
npm start
```

Service berjalan di `http://localhost:3001`. Cek `GET /api/health` untuk memastikan service hidup.

Dispatcher outbox dapat dijalankan berkala dari folder `backend-yii`:

```powershell
php yii lab-outbox/dispatch
```

Untuk kebutuhan deployment, jadwalkan perintah tersebut menggunakan Task Scheduler atau worker yang dikelola operator. Menjalankannya sekali saja tidak membuat jadwal otomatis.

## 4. Jalankan frontend React

```powershell
Set-Location 'D:\path\ke\simrs-rawat-jalan\frontend-react'
npm install
npm run dev
```

Buka alamat Vite yang ditampilkan di terminal, biasanya `http://localhost:5173`. Alamat API lokal saat ini dikonfigurasi pada `frontend-react/src/services/api.js`.

## 5. Akun dan data uji

README utama mencantumkan akun demo yang disediakan oleh database lokal. Gunakan hanya untuk demonstrasi lokal. Siapkan pasien, dokter, jadwal praktik, tindakan, dan obat dummy yang diperlukan untuk skenario uji. Hindari nama, NIK, nomor telepon, atau informasi klinis milik orang sungguhan.

## 6. Perintah pemeriksaan

```powershell
# Yii, dari folder backend-yii
php yii migrate/history
php yii lab-outbox/dispatch 1 --interactive=0

# Node.js, dari folder service-node
node --check src/routes/labRoutes.js
node --check src/routes/dashboardRoutes.js

# React, dari folder frontend-react
npm run lint
npm run build
```

`npm run lint` saat ini dapat menampilkan warning hook React di beberapa halaman. Catat warning tersebut sebagai temuan; build yang berhasil tidak otomatis berarti semua alur bisnis sudah diuji.
