const express = require("express");
const Joi = require("joi");
const crypto = require("crypto");
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
const webhookOrderSchema = Joi.object({
  order_id: Joi.number().integer().positive().required(),
  no_order_lab: Joi.string().trim().min(1).required(),
  kunjungan_id: Joi.number().integer().positive().required(),
  outbox_id: Joi.number().integer().positive().required(),
});

/**
 * POST /api/lab/webhook-order
 * Endpoint internal yang dipanggil Yii2 saat dokter membuat permintaan lab
 */
router.post("/webhook-order", async (req, res, next) => {
  try {
    const integrationSecret = process.env.SIMRS_LAB_WEBHOOK_SECRET;
    const providedSecret = req.get("X-Integration-Secret");
    const expectedSecretBytes = integrationSecret ? Buffer.from(integrationSecret) : null;
    const providedSecretBytes = providedSecret ? Buffer.from(providedSecret) : null;
    if (!integrationSecret) {
      return res.status(503).json({
        success: false,
        status_code: 503,
        message: "Secret integrasi laboratorium belum dikonfigurasi.",
        data: null,
        errors: null,
      });
    }
    if (
      !providedSecretBytes ||
      providedSecretBytes.length !== expectedSecretBytes.length ||
      !crypto.timingSafeEqual(providedSecretBytes, expectedSecretBytes)
    ) {
      return res.status(401).json({
        success: false,
        status_code: 401,
        message: "Autentikasi integrasi laboratorium gagal.",
        data: null,
        errors: null,
      });
    }

    const { error, value } = webhookOrderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        status_code: 400,
        message: "Payload order laboratorium tidak valid.",
        data: null,
        errors: error.details,
      });
    }

    console.info("[LIS Webhook] Order diterima.", {
      order_id: value.order_id,
      no_order_lab: value.no_order_lab,
      outbox_id: value.outbox_id,
    });
    res.json({
      success: true,
      status_code: 200,
      message: "Order laboratorium diterima oleh LIS Node.js Service",
      data: value,
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
        `SELECT pl.id, pl.no_order_lab, pl.status_lab, o.status AS sync_status,
                o.attempts, o.last_error
         FROM permintaan_lab pl
         JOIN lab_integration_outbox o ON o.lab_order_id = pl.id
         WHERE pl.status_lab = 'PENDING_SYNC'
            OR o.status IN ('PENDING', 'FAILED', 'PROCESSING')
         ORDER BY o.created_at ASC
         LIMIT 100`,
      );

      res.json({
        success: true,
        status_code: 200,
        message: "Daftar sinkronisasi yang tertunda dimuat. Jalankan worker Yii `php yii lab-outbox/dispatch` untuk mencoba ulang.",
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
      const status = req.query.status ? String(req.query.status).toUpperCase() : null;
      const kunjunganId = req.query.kunjungan_id;
      const parsedLimit = Number.parseInt(req.query.limit, 10);
      const parsedOffset = Number.parseInt(req.query.offset, 10);
      const limit = Number.isInteger(parsedLimit) ? Math.min(500, Math.max(1, parsedLimit)) : 100;
      const offset = Number.isInteger(parsedOffset) ? Math.max(0, parsedOffset) : 0;
      if (status && !["DIMINTA", "DIPROSES", "SELESAI", "PENDING_SYNC"].includes(status)) {
        return res.status(400).json({
          success: false,
          status_code: 400,
          message: "Filter status laboratorium tidak valid.",
          data: null,
          errors: { name: "BadRequest" },
        });
      }
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
        params.push(status);
        query += ` AND pl.status_lab = $${params.length}`;
      }
      if (kunjunganId) {
        params.push(kunjunganId);
        query += ` AND pl.kunjungan_id = $${params.length}`;
      }

      params.push(limit);
      query += ` ORDER BY pl.created_at DESC LIMIT $${params.length}`;
      params.push(offset);
      query += ` OFFSET $${params.length}`;
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
      WHERE id = $4 AND status_lab <> 'SELESAI'
      RETURNING *
    `;

      const { rows } = await pool.query(query, [
        JSON.stringify(hasil_lab),
        catatan_petugas || null,
        req.user.uid,
        id,
      ]);

      if (rows.length === 0) {
        const exists = await pool.query("SELECT status_lab FROM permintaan_lab WHERE id = $1", [id]);
        if (exists.rowCount && exists.rows[0].status_lab === "SELESAI") {
          return res.status(409).json({
            success: false,
            status_code: 409,
            message: "Hasil pemeriksaan sudah diselesaikan dan tidak dapat ditimpa.",
            data: null,
            errors: { name: "Conflict" },
          });
        }
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
