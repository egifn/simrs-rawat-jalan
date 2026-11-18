const express = require("express");
const Joi = require("joi");
const pool = require("../config/db");
const {
  verifyToken,
  authorizePermissions,
} = require("../middlewares/authMiddleware");

const router = express.Router();

// Schema validasi input hasil lab
const hasilLabSchema = Joi.object({
  hasil_lab: Joi.object().min(1).required(),
  catatan_petugas: Joi.string().allow("", null),
});

/**
 * POST /api/lab/webhook-order
 * Endpoint internal yang dipanggil Yii2 saat dokter membuat permintaan lab
 */
router.post("/webhook-order", async (req, res, next) => {
  try {
    const { order_id, no_order_lab } = req.body;
    console.log(
      `[LIS Webhook] Menerima order lab baru: ${no_order_lab} (ID: ${order_id})`,
    );
    res.json({
      success: true,
      status_code: 200,
      message: "Order laboratorium diterima oleh LIS Node.js Service",
      data: { order_id, no_order_lab },
      errors: null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/lab/sync-pending
 * SKENARIO 5: Menyinkronkan kembali order lab yang berstatus PENDING_SYNC saat Node.js sempat down
 */
router.post(
  "/sync-pending",
  verifyToken,
  authorizePermissions("laboratorium"),
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `UPDATE permintaan_lab 
       SET status_lab = 'DIMINTA' 
       WHERE status_lab = 'PENDING_SYNC' 
       RETURNING id, no_order_lab, status_lab`,
      );

      res.json({
        success: true,
        status_code: 200,
        message: `${result.rowCount} permintaan lab yang tertunda (PENDING_SYNC) berhasil disinkronkan.`,
        data: result.rows,
        errors: null,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/lab/permintaan
 * Daftar permintaan lab (Bisa diakses Petugas Lab & Dokter, mendukung filter status & kunjungan_id)
 */
router.get(
  "/permintaan",
  verifyToken,
  authorizePermissions("laboratorium", "pemeriksaan"),
  async (req, res, next) => {
    try {
      const { status, kunjungan_id } = req.query;
      let query = `
      SELECT pl.*, 
             mt.kode_tindakan, mt.nama_tindakan, mt.tarif,
             k.no_registrasi, k.tanggal_kunjungan,
             mp.no_rm, mp.nama_lengkap AS nama_pasien, mp.jenis_kelamin,
             md.nama_dokter
      FROM permintaan_lab pl
      JOIN master_tindakan mt ON pl.tindakan_id = mt.id
      JOIN kunjungan k ON pl.kunjungan_id = k.id
      JOIN master_pasien mp ON k.pasien_id = mp.id
      JOIN master_dokter md ON pl.dokter_id = md.id
      WHERE 1=1
    `;
      const params = [];

      if (status) {
        params.push(status.toUpperCase());
        query += ` AND pl.status_lab = $${params.length}`;
      }
      if (kunjungan_id) {
        params.push(kunjungan_id);
        query += ` AND pl.kunjungan_id = $${params.length}`;
      }

      query += ` ORDER BY pl.created_at DESC`;
      const { rows } = await pool.query(query, params);

      res.json({
        success: true,
        status_code: 200,
        message: "Daftar permintaan laboratorium berhasil dimuat.",
        data: rows,
        errors: null,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/lab/hasil/:id
 * Petugas Laboratorium menginput hasil pemeriksaan (disimpan sebagai JSONB)
 */
router.put(
  "/hasil/:id",
  verifyToken,
  authorizePermissions("laboratorium"),
  async (req, res, next) => {
    try {
      const { error, value } = hasilLabSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          status_code: 400,
          message: "Validasi input gagal.",
          data: null,
          errors: error.details,
        });
      }

      const { id } = req.params;
      const { hasil_lab, catatan_petugas } = value;

      const query = `
      UPDATE permintaan_lab
      SET hasil_lab = $1::jsonb,
          catatan_klinis = COALESCE($2, catatan_klinis),
          status_lab = 'SELESAI',
          petugas_lab_id = $3,
          waktu_selesai = NOW()
      WHERE id = $4
      RETURNING *
    `;

      const { rows } = await pool.query(query, [
        JSON.stringify(hasil_lab),
        catatan_petugas || null,
        req.user.uid,
        id,
      ]);

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          status_code: 404,
          message: "Permintaan laboratorium tidak ditemukan.",
          data: null,
          errors: null,
        });
      }

      res.json({
        success: true,
        status_code: 200,
        message: "Hasil pemeriksaan laboratorium berhasil disimpan.",
        data: rows[0],
        errors: null,
      });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
