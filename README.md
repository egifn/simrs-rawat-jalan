# SIMRS Rawat Jalan Terintegrasi (Yii2 + Node.js + React + PostgreSQL)

Sistem Informasi Manajemen Rumah Sakit (SIMRS) Modul Pelayanan Rawat Jalan dengan arsitektur _hybrid_ yang mengutamakan integritas transaksi klinis/keuangan serta performa analitik dan integrasi penunjang.

## 1. Arsitektur & Teknologi

- **Database:** PostgreSQL (Relational Schema, Composite Unique Index, Check Constraints, JSONB)
- **Core Backend (Port 8000):** PHP 8.4 + Yii2 Framework (RBAC, ACID Transactions, Pessimistic Locking, Idempotency Key, Audit Trail)
- **Integration & Analytics Service (Port 3001):** Node.js + Express (Lab LIS Integration, Fallback Sync `PENDING_SYNC`, Parallel Aggregation Dashboard, PDF Invoice Generator via `pdfkit`)
- **Frontend (Port 5173/5174):** React.js + Vite + Tailwind CSS v4 + Axios

## 2. Akun Pengujian (Default Password: `password123`)

| Role           | Username   | Hak Akses Utama                                                |
| :------------- | :--------- | :------------------------------------------------------------- |
| `ADMIN`        | `admin`    | Akses penuh seluruh modul & laporan                            |
| `PENDAFTARAN`  | `daftar1`  | Registrasi pasien baru & antrean poliklinik                    |
| `DOKTER`       | `dokter1`  | EMR, tindakan medis, order lab, & resep elektronik             |
| `FARMASI`      | `farmasi1` | Validasi & penyerahan obat (_row-level stock locking_)         |
| `LABORATORIUM` | `lab1`     | Penerimaan order LIS, sinkronisasi fallback, & input hasil lab |
| `KASIR`        | `kasir1`   | Billing terpadu, pembayaran _idempotent_, & cetak PDF invoice  |

## 3. Menu Berdasarkan Role

- **ADMIN:** Dashboard/laporan, data pasien, dokter, poli, jadwal dokter, master tindakan, master obat, pengguna, hak akses, serta akses ke modul pelayanan.
- **PENDAFTARAN:** Dashboard pendaftaran, pencarian/registrasi pasien, kunjungan, antrean, dan riwayat pasien.
- **DOKTER:** Dashboard dokter, antrean, detail pasien, riwayat kunjungan, pemeriksaan, tindakan, permintaan lab, dan resep.
- **LABORATORIUM:** Dashboard laboratorium, permintaan, input hasil, dan status hasil pemeriksaan.
- **FARMASI:** Dashboard farmasi, antrean resep, stok, dan penyerahan obat.
- **KASIR:** Dashboard kasir, daftar tagihan, pembayaran bertahap, riwayat pembayaran, dan invoice.

CRUD administrator dan pengaturan jadwal memakai model data Yii yang tersedia. Hak akses tiap role disimpan di tabel `role_permissions`, dapat diubah dari menu **Hak Akses**, digunakan untuk menyaring menu React, dan diperiksa kembali oleh endpoint Yii serta Node.js. Administrator selalu memiliki akses penuh. Pengguna perlu masuk kembali agar menu yang ditampilkan mengikuti konfigurasi terbaru. Data pasien yang dihapus dinonaktifkan (`is_active = false`) agar riwayat kunjungan tetap utuh; pencarian dan daftar pasien hanya menampilkan data aktif. Data tenaga medis dikelola sebagai data dokter; tidak ada tabel/model terpisah untuk tenaga medis non-dokter.

Endpoint konfigurasi hak akses adalah `GET /api/admin/permissions` dan `PUT /api/admin/permissions` dengan payload `{ "role": "DOKTER", "permissions": ["dashboard", "pemeriksaan"] }`. Hanya Administrator yang dapat mengubah konfigurasi; permission yang tidak dikenal ditolak.

## 4. Penanganan Edge Cases & Keamanan

1. **Anti-Duplikasi Pendaftaran:** Yii mengunci baris pasien dan jadwal praktik dalam transaksi, memeriksa kunjungan aktif pada poli/tanggal yang sama, lalu membuat nomor antrean dan memeriksa kuota sebelum transaksi disimpan.
2. **Race Condition Stok Obat:** Menggunakan transaksi database dengan _Pessimistic Locking_ (`SELECT ... FOR UPDATE`) serta constraint `stok >= 0`.
3. **Anti-Double Payment:** Setiap transaksi kasir wajib menyertakan `idempotency_key` (UUID v4) unik.
4. **Integritas Rekam Medis & Billing:** _Soft-lock_ mencegah perubahan tindakan/resep setelah tagihan berstatus `LUNAS`, serta mencatat log revisi ke tabel `audit_logs` (`JSONB`).
5. **Resiliensi Layanan Penunjang:** Apabila `service-node` tidak aktif saat dokter mengirim permintaan lab, order tetap tersimpan aman di Yii2 dengan status `PENDING_SYNC` dan dapat disinkronkan ulang melalui endpoint `/api/lab/sync-pending`.

## 5. Cara Menjalankan Proyek

1. **Database:** Buat database `simrs_rawat_jalan` di PostgreSQL, lalu jalankan `database/schema.sql` dan `database/seed.sql`.
2. **Backend Yii2:** Masuk ke `backend-yii/`, sesuaikan `config/db.php`, jalankan `php yii migrate --interactive=0` untuk membuat tabel hak akses dan permission awal, lalu jalankan `php yii serve --port=8000`.
3. **Service Node.js:** Masuk ke `service-node/`, salin `.env`, jalankan `npm install` dan `npm start` (berjalan di port `3001`).
4. **Frontend React:** Masuk ke `frontend-react/`, jalankan `npm install` dan `npm run dev`.
