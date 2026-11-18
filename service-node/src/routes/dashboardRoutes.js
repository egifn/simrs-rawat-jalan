const express = require("express");
const pool = require("../config/db");
const {
  verifyToken,
  authorizePermissions,
} = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * GET /api/dashboard/summary?start_date=2026-01-01&end_date=2026-12-31
 */
router.get(
  "/summary",
  verifyToken,
  authorizePermissions("dashboard", "laporan"),
  async (req, res, next) => {
  try {
    const startDate = req.query.start_date || "2026-01-01";
    const endDate = req.query.end_date || "2026-12-31";

    // Jalankan 6 query agregasi secara paralel (Promise.all) untuk performa maksimal
    const [
      kunjunganRes,
      poliRes,
      tindakanRes,
      pendapatanRes,
      obatRes,
      statusBayarRes,
    ] = await Promise.all([
      // 1. Total kunjungan pasien
      pool.query(
        `SELECT COUNT(*)::int AS total_kunjungan,
                COUNT(*) FILTER (WHERE status_antrean = 'SELESAI')::int AS selesai,
                COUNT(*) FILTER (WHERE status_antrean != 'SELESAI' AND status_antrean != 'BATAL')::int AS aktif
         FROM kunjungan
         WHERE tanggal_kunjungan BETWEEN $1 AND $2`,
        [startDate, endDate],
      ),
      // 2. Kunjungan berdasarkan poli
      pool.query(
        `SELECT mp.nama_poli, COUNT(k.id)::int AS jumlah
         FROM master_poli mp
         LEFT JOIN kunjungan k ON k.poli_id = mp.id AND k.tanggal_kunjungan BETWEEN $1 AND $2
         GROUP BY mp.id, mp.nama_poli
         ORDER BY jumlah DESC`,
        [startDate, endDate],
      ),
      // 3. Jumlah tindakan medis terbanyak
      pool.query(
        `SELECT mt.nama_tindakan, COALESCE(SUM(kt.jumlah), 0)::int AS total_dilakukan, COALESCE(SUM(kt.subtotal), 0)::numeric AS total_nilai
         FROM kunjungan_tindakan kt
         JOIN master_tindakan mt ON kt.tindakan_id = mt.id
         JOIN kunjungan k ON kt.kunjungan_id = k.id
         WHERE k.tanggal_kunjungan BETWEEN $1 AND $2
         GROUP BY mt.id, mt.nama_tindakan
         ORDER BY total_dilakukan DESC`,
        [startDate, endDate],
      ),
      // 4. Ringkasan pendapatan
      pool.query(
        `SELECT COALESCE(SUM(b.total_tagihan), 0)::numeric AS potensi_pendapatan,
                COALESCE(SUM(b.total_dibayar), 0)::numeric AS pendapatan_diterima,
                COALESCE(SUM(b.total_tagihan - b.total_dibayar), 0)::numeric AS piutang_belum_bayar
         FROM billing b
         JOIN kunjungan k ON b.kunjungan_id = k.id
         WHERE k.tanggal_kunjungan BETWEEN $1 AND $2`,
        [startDate, endDate],
      ),
      // 5. Rekap penggunaan obat
      pool.query(
        `SELECT mo.kode_obat, mo.nama_obat, mo.satuan, mo.stok AS sisa_stok,
                COALESCE(SUM(rd.jumlah), 0)::int AS total_keluar
         FROM master_obat mo
         LEFT JOIN resep_detail rd ON rd.obat_id = mo.id
         LEFT JOIN resep r ON rd.resep_id = r.id AND r.status_resep = 'DISERAHKAN'
         LEFT JOIN kunjungan k ON r.kunjungan_id = k.id AND k.tanggal_kunjungan BETWEEN $1 AND $2
         GROUP BY mo.id
         ORDER BY total_keluar DESC`,
        [startDate, endDate],
      ),
      // 6. Status pembayaran
      pool.query(
        `SELECT b.status_pembayaran, COUNT(b.id)::int AS jumlah_transaksi, COALESCE(SUM(b.total_tagihan), 0)::numeric AS nominal
         FROM billing b
         JOIN kunjungan k ON b.kunjungan_id = k.id
         WHERE k.tanggal_kunjungan BETWEEN $1 AND $2
         GROUP BY b.status_pembayaran`,
        [startDate, endDate],
      ),
    ]);

    res.json({
      success: true,
      status_code: 200,
      message: "Data ringkasan dashboard berhasil dimuat.",
      data: {
        periode: { start_date: startDate, end_date: endDate },
        kunjungan: kunjunganRes.rows[0],
        kunjungan_per_poli: poliRes.rows,
        tindakan_medis: tindakanRes.rows,
        pendapatan: pendapatanRes.rows[0],
        rekap_obat: obatRes.rows,
        status_pembayaran: statusBayarRes.rows,
      },
      errors: null,
      },
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;
