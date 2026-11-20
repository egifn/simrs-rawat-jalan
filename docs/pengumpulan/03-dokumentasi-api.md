# Dokumentasi Endpoint API

Base URL pengembangan:

- Yii: `http://localhost:8000/api`
- Node.js: `http://localhost:3001/api`

Kecuali login dan health check, endpoint transaksi memerlukan token:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Response Yii dibungkus dalam bentuk `success`, `status_code`, `message`, `data`, dan `errors`. Node memakai bentuk serupa untuk response API; endpoint PDF mengembalikan file PDF.

## Autentikasi

| Method | Path | Fungsi |
|---|---|---|
| POST | `/auth/login` | Login. Body: `{"username":"...","password":"..."}`. Response berisi token, user, dan permission. |
| GET | `/auth/me` | Memeriksa token aktif dan memuat informasi user. |

## Master data dan administrator (Yii)

| Method | Path | Fungsi / catatan |
|---|---|---|
| GET, POST | `/pasien` | Daftar dan tambah pasien. Daftar mendukung pencarian `q`; hanya pasien aktif yang ditampilkan. |
| GET, PUT, DELETE | `/pasien/{id}` | Lihat atau ubah pasien; DELETE menonaktifkan pasien agar riwayat kunjungan tidak terhapus. |
| GET, POST | `/poli` | Daftar dan pengelolaan poli sesuai permission. |
| GET, POST | `/dokter` | Daftar dan pengelolaan dokter. |
| GET, POST | `/tindakan` | Daftar dan pengelolaan master tindakan, termasuk kategori dan tarif. |
| GET, POST | `/obat` | Daftar dan pengelolaan master obat. |
| PUT, DELETE | `/obat/{id}` | Ubah atau hapus master obat sesuai aturan relasi data. |
| GET | `/admin/{resource}` | Daftar data resource admin, memakai parameter pencarian/paginasi sesuai resource. |
| POST | `/admin/{resource}` | Tambah data resource admin. |
| PUT, DELETE | `/admin/{resource}/{id}` | Ubah atau hapus/nonaktifkan data resource. |
| GET | `/admin/permissions` | Daftar permission dan role. |
| PUT | `/admin/permissions` | Atur permission role. Body: `{"role":"DOKTER","permissions":["dashboard","pemeriksaan"]}`. |

## Pelayanan (Yii)

| Method | Path | Fungsi / catatan |
|---|---|---|
| GET | `/kunjungan` | Daftar antrean/kunjungan. Filter tersedia antara lain `tanggal`, `poli_id`, `dokter_id`, `status`, `pasien_id`, dan `tagihan_belum_lunas`. Parameter `paginated=1`, `page`, `page_size` memberi response berisi `items`, `total`, `page`, `page_size`. |
| POST | `/kunjungan` | Mendaftarkan kunjungan. Body minimal: `pasien_id`, `poli_id`, `dokter_id`, dan `tanggal_kunjungan` (`YYYY-MM-DD`). |
| GET | `/kunjungan/{id}` | Detail kunjungan dan informasi terkait. |
| POST | `/pemeriksaan/{kunjungan_id}` | Simpan pemeriksaan awal. Payload mencakup anamnesis, tanda vital, diagnosis, daftar `tindakan`, `permintaan_lab`, dan `resep` bila diperlukan. |
| PUT | `/pemeriksaan/{kunjungan_id}` | Revisi pemeriksaan; wajib disertai alasan sesuai validasi server. Perubahan setelah pembayaran tercatat ditolak. |
| GET | `/farmasi/antrean` | Daftar resep, dapat difilter memakai `status`, serta `limit` dan `offset`. |
| POST | `/farmasi/serahkan/{resep_id}` | Serahkan resep. Hanya dapat dilakukan setelah tagihan lunas dan stok tersedia. |
| GET | `/billing/kunjungan/{kunjungan_id}` | Ambil total billing, pembayaran, dan rincian biaya kunjungan. |
| POST | `/billing/bayar/{billing_id}` | Catat pembayaran bertahap. Body: `idempotency_key`, `metode_pembayaran` (`TUNAI` atau `NON_TUNAI`), `jumlah_bayar`. |

Contoh body pembayaran:

```json
{
  "idempotency_key": "UUID-UNIK-UNTUK-REQUEST-INI",
  "metode_pembayaran": "TUNAI",
  "jumlah_bayar": 50000
}
```

Ketika mengulang request akibat timeout, gunakan key dan isi transaksi yang sama. Jangan membuat key baru sebelum memastikan request sebelumnya tidak diterima server.

## Service pendukung (Node.js)

| Method | Path | Fungsi / catatan |
|---|---|---|
| GET | `/health` | Memeriksa service berjalan; tidak memerlukan token. |
| GET | `/dashboard/summary?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` | Ringkasan kunjungan, poli, tindakan, pendapatan, obat, dan status pembayaran. Perlu token dan permission dashboard/laporan. |
| POST | `/lab/webhook-order` | Webhook internal order dari Yii. Memerlukan header `X-Integration-Secret` yang cocok dengan konfigurasi service. |
| POST | `/lab/sync-pending` | Melihat status sinkronisasi tertunda. Memerlukan token dan permission laboratorium. |
| GET | `/lab/permintaan` | Daftar permintaan laboratorium; mendukung filter `status`, `kunjungan_id`, `limit`, `offset`. |
| PUT | `/lab/hasil/{id}` | Simpan hasil lab. Body: `{"hasil_lab":{...},"catatan_petugas":"..."}`. Hasil yang telah selesai tidak ditimpa lewat endpoint ini. |
| GET | `/pdf/invoice/{kunjungan_id}` | Menghasilkan invoice PDF. Memerlukan token dan permission kasir. |

## Import Postman

Import collection `postman/SIMRS-Rawat-Jalan.postman_collection.json` dan environment lokal di `postman/SIMRS-local.postman_environment.json`. Isi variabel username dan password langsung di Postman pada komputer lokal; jangan commit nilai rahasia. Request login menyimpan token untuk request selanjutnya.
