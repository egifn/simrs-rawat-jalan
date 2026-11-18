const express = require("express");
const PDFDocument = require("pdfkit");
const pool = require("../config/db");
const {
  verifyToken,
  authorizePermissions,
} = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * GET /api/pdf/invoice/:kunjungan_id
 * Menghasilkan file PDF Invoice & Bukti Pembayaran siap cetak
 */
router.get(
  "/invoice/:kunjungan_id",
  verifyToken,
  authorizePermissions("kasir"),
  async (req, res, next) => {
  try {
    const { kunjungan_id } = req.params;

    const query = `
      SELECT b.*, k.no_registrasi, k.tanggal_kunjungan, k.kode_antrean,
             mp.no_rm, mp.nama_lengkap AS nama_pasien, mp.alamat,
             poli.nama_poli, md.nama_dokter
      FROM billing b
      JOIN kunjungan k ON b.kunjungan_id = k.id
      JOIN master_pasien mp ON k.pasien_id = mp.id
      JOIN master_poli poli ON k.poli_id = poli.id
      JOIN master_dokter md ON k.dokter_id = md.id
      WHERE b.kunjungan_id = $1
    `;
    const { rows } = await pool.query(query, [kunjungan_id]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Data billing tidak ditemukan." });
    }

    const inv = rows[0];
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=Invoice-${inv.no_invoice}.pdf`,
    );
    doc.pipe(res);

    // Header Rumah Sakit
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("RSU INOVA MEDIKA", { align: "center" });
    doc
      .fontSize(10)
      .font("Helvetica")
      .text("Sistem Informasi Manajemen Rumah Sakit - Pelayanan Rawat Jalan", {
        align: "center",
        },
      );
    doc.moveDown().moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown();

    // Info Pasien & Invoice
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(`INVOICE TAGIHAN: ${inv.no_invoice}`);
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        `No. Registrasi : ${inv.no_registrasi} | Tanggal: ${new Date(inv.tanggal_kunjungan).toLocaleDateString("id-ID")}`,
      )
      .text(`Pasien         : ${inv.nama_pasien} (${inv.no_rm})`)
      .text(`Poli / Dokter  : ${inv.nama_poli} - ${inv.nama_dokter}`)
      .text(`Status Bayar   : ${inv.status_pembayaran}`)
      .moveDown();

    // Tabel Rincian Biaya
    doc.font("Helvetica-Bold").text("Rincian Komponen Biaya Pelayanan:");
    doc.moveDown(0.5);
    const formatRp = (val) => `Rp ${Number(val).toLocaleString("id-ID")}`;

    doc
      .font("Helvetica")
      .text(
        `1. Biaya Pendaftaran Poli          : ${formatRp(inv.biaya_pendaftaran)}`,
      )
      .text(
        `2. Biaya Tindakan Medis            : ${formatRp(inv.biaya_tindakan)}`,
      )
      .text(`3. Biaya Pemeriksaan Penunjang/Lab : ${formatRp(inv.biaya_lab)}`)
      .text(`4. Biaya Obat & Farmasi            : ${formatRp(inv.biaya_obat)}`)
      .moveDown();

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown(0.5);
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(`TOTAL TAGIHAN  : ${formatRp(inv.total_tagihan)}`)
      .text(`TOTAL DIBAYAR  : ${formatRp(inv.total_dibayar)}`)
      .text(
        `SISA TAGIHAN   : ${formatRp(inv.total_tagihan - inv.total_dibayar)}`,
      )
      .moveDown(2);

    doc
      .fontSize(9)
      .font("Helvetica-Oblique")
      .text(
        "Dokumen ini dicetak secara otomatis oleh SIMRS Terintegrasi (Node.js PDF Engine).",
        { align: "center" },
      );

    doc.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
