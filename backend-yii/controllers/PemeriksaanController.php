<?php

namespace app\controllers;

use Yii;
use yii\web\BadRequestHttpException;
use yii\web\NotFoundHttpException;
use yii\web\ConflictHttpException;
use app\components\ApiController;
use app\models\Kunjungan;
use app\models\MasterDokter;
use app\models\MasterTindakan;
use app\models\MasterObat;
use app\models\RekamMedis;
use app\models\KunjunganTindakan;
use app\models\Resep;
use app\models\ResepDetail;
use app\models\PermintaanLab;
use app\models\Billing;

class PemeriksaanController extends ApiController
{
    protected array $allowedRoles = [];
    protected ?string $requiredPermission = 'pemeriksaan';

    /**
     * POST /api/pemeriksaan/<kunjungan_id>
     * Menyimpan EMR, Tindakan Medis, Resep Obat, Permintaan Lab, dan kalkulasi Billing otomatis
     */
    public function actionSimpan($kunjungan_id)
    {
        $kunjungan = Kunjungan::findOne($kunjungan_id);
        if (!$kunjungan) {
            throw new NotFoundHttpException('Data kunjungan tidak ditemukan.');
        }

        $user = Yii::$app->user->identity;
        $dokter = MasterDokter::findOne(['user_id' => $user->id]) ?? MasterDokter::findOne($kunjungan->dokter_id);
        $data = Yii::$app->request->post();

        $transaction = Yii::$app->db->beginTransaction();
        try {
            // 1. Simpan / Update Rekam Medis Elektronik
            $rm = RekamMedis::findOne(['kunjungan_id' => $kunjungan->id]) ?? new RekamMedis();
            $rm->kunjungan_id = $kunjungan->id;
            $rm->dokter_id = $dokter->id;
            $rm->anamnesis = $data['anamnesis'] ?? '';
            $rm->tekanan_darah = $data['tekanan_darah'] ?? null;
            $rm->nadi = $data['nadi'] ?? null;
            $rm->suhu_tubuh = $data['suhu_tubuh'] ?? null;
            $rm->berat_badan = $data['berat_badan'] ?? null;
            $rm->pemeriksaan_fisik = $data['pemeriksaan_fisik'] ?? null;
            $rm->diagnosis_utama = $data['diagnosis_utama'] ?? '';
            $rm->diagnosis_sekunder = $data['diagnosis_sekunder'] ?? null;

            if (!$rm->save()) {
                throw new BadRequestHttpException(json_encode($rm->errors));
            }

            // 2. Simpan Tindakan Medis (jika ada)
            $totalBiayaTindakan = 0;
            if (!empty($data['tindakan']) && is_array($data['tindakan'])) {
                KunjunganTindakan::deleteAll(['kunjungan_id' => $kunjungan->id]);
                foreach ($data['tindakan'] as $item) {
                    $masterTindakan = MasterTindakan::findOne(['id' => $item['tindakan_id'], 'kategori' => 'MEDIS']);
                    if (!$masterTindakan) {
                        throw new BadRequestHttpException("Tindakan medis ID {$item['tindakan_id']} tidak valid.");
                    }
                    $qty = (int)($item['jumlah'] ?? 1);
                    $subtotal = $masterTindakan->tarif * $qty;
                    $totalBiayaTindakan += $subtotal;

                    $kt = new KunjunganTindakan();
                    $kt->kunjungan_id = $kunjungan->id;
                    $kt->tindakan_id = $masterTindakan->id;
                    $kt->jumlah = $qty;
                    $kt->tarif_saat_itu = $masterTindakan->tarif;
                    $kt->subtotal = $subtotal;
                    $kt->catatan = $item['catatan'] ?? null;
                    $kt->save(false);
                }
            }

            // 3. Simpan Permintaan Pemeriksaan Penunjang / Lab (jika ada)
            $totalBiayaLab = 0;
            $labOrders = [];
            if (!empty($data['permintaan_lab']) && is_array($data['permintaan_lab'])) {
                foreach ($data['permintaan_lab'] as $labItem) {
                    $masterLab = MasterTindakan::findOne(['id' => $labItem['tindakan_id'], 'kategori' => 'LABORATORIUM']);
                    if (!$masterLab) {
                        throw new BadRequestHttpException("Jenis tes lab ID {$labItem['tindakan_id']} tidak valid.");
                    }
                    $totalBiayaLab += $masterLab->tarif;

                    $order = new PermintaanLab();
                    $order->no_order_lab = 'LAB-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -5));
                    $order->kunjungan_id = $kunjungan->id;
                    $order->dokter_id = $dokter->id;
                    $order->tindakan_id = $masterLab->id;
                    $order->catatan_klinis = $labItem['catatan_klinis'] ?? null;
                    $order->status_lab = 'DIMINTA';
                    $order->save(false);
                    $labOrders[] = $order;
                }
            }

            // 4. Simpan Resep Obat & Validasi Ketersediaan Stok Awal (jika ada)
            $totalBiayaObat = 0;
            if (!empty($data['resep']) && is_array($data['resep'])) {
                $resep = Resep::findOne(['kunjungan_id' => $kunjungan->id]) ?? new Resep();
                if ($resep->isNewRecord) {
                    $resep->no_resep = 'RSP-' . date('Ymd') . '-' . str_pad($kunjungan->id, 5, '0', STR_PAD_LEFT);
                    $resep->kunjungan_id = $kunjungan->id;
                    $resep->dokter_id = $dokter->id;
                    $resep->status_resep = 'MENUNGGU';
                    $resep->save(false);
                } else {
                    ResepDetail::deleteAll(['resep_id' => $resep->id]);
                }

                foreach ($data['resep'] as $obatItem) {
                    $obat = MasterObat::findOne($obatItem['obat_id']);
                    if (!$obat) {
                        throw new BadRequestHttpException("Obat ID {$obatItem['obat_id']} tidak ditemukan.");
                    }
                    $qty = (int)($obatItem['jumlah'] ?? 1);
                    if ($obat->stok < $qty) {
                        throw new BadRequestHttpException("Stok obat '{$obat->nama_obat}' tidak mencukupi (tersisa: {$obat->stok}).");
                    }

                    $subtotalObat = $obat->harga_satuan * $qty;
                    $totalBiayaObat += $subtotalObat;

                    $detail = new ResepDetail();
                    $detail->resep_id = $resep->id;
                    $detail->obat_id = $obat->id;
                    $detail->dosis = $obatItem['dosis'] ?? '1x1';
                    $detail->frekuensi = $obatItem['frekuensi'] ?? 'Sesudah makan';
                    $detail->jumlah = $qty;
                    $detail->harga_saat_itu = $obat->harga_satuan;
                    $detail->subtotal = $subtotalObat;
                    $detail->save(false);
                }
                $kunjungan->status_antrean = 'MENUNGGU_OBAT';
            } else {
                $kunjungan->status_antrean = 'DIPERIKSA';
                $kunjungan->save(false);
            }

            $kunjungan->save(false);

            // 5. Kalkulasi Otomatis Komponen Billing Pasien
            $billing = Billing::findOne(['kunjungan_id' => $kunjungan->id]);
            if ($billing) {
                $billing->biaya_tindakan = $totalBiayaTindakan;
                $billing->biaya_lab = $totalBiayaLab;
                $billing->biaya_obat = $totalBiayaObat;
                $billing->total_tagihan = $billing->biaya_pendaftaran + $totalBiayaTindakan + $totalBiayaLab + $totalBiayaObat;
                $billing->updated_at = date('Y-m-d H:i:s');
                $billing->save(false);
            }

            $transaction->commit();

            // 6. SKENARIO 5 (Gangguan Integrasi): Kirim notifikasi order lab ke Node.js Service secara non-blocking / fallback
            foreach ($labOrders as $order) {
                $this->notifyNodeLabService($order);
            }

            return [
                'rekam_medis' => $rm,
                'billing' => $billing,
                'permintaan_lab' => $labOrders,
            ];
        } catch (\Throwable $e) {
            $transaction->rollBack();
            throw $e;
        }
    }

    /**
     * PUT /api/pemeriksaan/<kunjungan_id>
     * SKENARIO 4: Revisi diagnosis/tindakan setelah billing dibuat + Audit Trail & Soft-Locking jika LUNAS
     */
    public function actionRevisi($kunjungan_id)
    {
        $billing = Billing::findOne(['kunjungan_id' => $kunjungan_id]);
        if ($billing && $billing->status_pembayaran === 'LUNAS') {
            throw new ConflictHttpException('Tagihan sudah LUNAS. Perubahan medis terkunci dan memerlukan pembatalan kwitansi oleh Kasir/Admin.');
        }

        $rm = RekamMedis::findOne(['kunjungan_id' => $kunjungan_id]);
        if (!$rm) {
            throw new NotFoundHttpException('Rekam medis belum ada untuk kunjungan ini.');
        }

        $data = Yii::$app->request->post();
        $oldData = [
            'diagnosis_utama' => $rm->diagnosis_utama,
            'diagnosis_sekunder' => $rm->diagnosis_sekunder,
            'biaya_tindakan_lama' => $billing ? $billing->biaya_tindakan : 0,
        ];

        $transaction = Yii::$app->db->beginTransaction();
        try {
            if (isset($data['diagnosis_utama'])) $rm->diagnosis_utama = $data['diagnosis_utama'];
            if (isset($data['diagnosis_sekunder'])) $rm->diagnosis_sekunder = $data['diagnosis_sekunder'];
            $rm->updated_at = date('Y-m-d H:i:s');
            $rm->save(false);

            $totalBiayaTindakan = $billing ? $billing->biaya_tindakan : 0;
            if (isset($data['tindakan']) && is_array($data['tindakan'])) {
                $totalBiayaTindakan = 0;
                KunjunganTindakan::deleteAll(['kunjungan_id' => $kunjungan_id]);
                foreach ($data['tindakan'] as $item) {
                    $masterTindakan = MasterTindakan::findOne(['id' => $item['tindakan_id'], 'kategori' => 'MEDIS']);
                    if (!$masterTindakan) continue;
                    $qty = (int)($item['jumlah'] ?? 1);
                    $subtotal = $masterTindakan->tarif * $qty;
                    $totalBiayaTindakan += $subtotal;

                    $kt = new KunjunganTindakan();
                    $kt->kunjungan_id = $kunjungan_id;
                    $kt->tindakan_id = $masterTindakan->id;
                    $kt->jumlah = $qty;
                    $kt->tarif_saat_itu = $masterTindakan->tarif;
                    $kt->subtotal = $subtotal;
                    $kt->save(false);
                }

                if ($billing) {
                    $billing->biaya_tindakan = $totalBiayaTindakan;
                    $billing->total_tagihan = $billing->biaya_pendaftaran + $totalBiayaTindakan + $billing->biaya_lab + $billing->biaya_obat;
                    $billing->updated_at = date('Y-m-d H:i:s');
                    $billing->save(false);
                }
            }

            // Catat riwayat perubahan ke tabel audit_logs (JSONB)
            Yii::$app->db->createCommand()->insert('audit_logs', [
                'table_name' => 'rekam_medis_dan_tindakan',
                'record_id' => $rm->id,
                'action' => 'REVISION',
                'old_data' => json_encode($oldData),
                'new_data' => json_encode([
                    'diagnosis_utama' => $rm->diagnosis_utama,
                    'diagnosis_sekunder' => $rm->diagnosis_sekunder,
                    'biaya_tindakan_baru' => $totalBiayaTindakan,
                ]),
                'changed_by' => Yii::$app->user->id,
                'reason' => $data['alasan_revisi'] ?? 'Koreksi klinis oleh dokter',
            ])->execute();

            $transaction->commit();
            return ['message' => 'Revisi pemeriksaan berhasil disimpan dan tercatat di Audit Log.', 'billing' => $billing];
        } catch (\Throwable $e) {
            $transaction->rollBack();
            throw $e;
        }
    }

    private function notifyNodeLabService(PermintaanLab $order): void
    {
        try {
            $ch = curl_init('http://localhost:3001/api/lab/webhook-order');
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_POSTFIELDS => json_encode(['order_id' => $order->id, 'no_order_lab' => $order->no_order_lab]),
                CURLOPT_TIMEOUT_MS => 800, // Timeout cepat agar tidak menghambat dokter
            ]);
            curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode < 200 || $httpCode >= 300) {
                throw new \Exception('Node.js Lab Service tidak merespons');
            }
        } catch (\Throwable $e) {
            // SKENARIO 5: Jika service Node.js mati, tandai PENDING_SYNC tanpa membatalkan pemeriksaan dokter!
            $order->status_lab = 'PENDING_SYNC';
            $order->save(false);
        }
    }
}
