<?php

namespace app\controllers;

use Yii;
use yii\web\BadRequestHttpException;
use yii\web\NotFoundHttpException;
use yii\web\ConflictHttpException;
use app\components\ApiController;
use app\components\LabOutboxDispatcher;
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
        if (!$dokter) {
            throw new NotFoundHttpException('Data dokter tidak ditemukan.');
        }
        $data = Yii::$app->request->post();

        $transaction = Yii::$app->db->beginTransaction();
        try {
            $billing = Billing::findBySql(
                'SELECT * FROM {{%billing}} WHERE kunjungan_id = :kunjungan_id FOR UPDATE',
                [':kunjungan_id' => $kunjungan->id]
            )->one();
            if (!$billing) {
                throw new NotFoundHttpException('Tagihan kunjungan tidak ditemukan.');
            }
            if ((float) $billing->total_dibayar > 0 || $billing->status_pembayaran === 'LUNAS') {
                throw new ConflictHttpException('Pemeriksaan tidak dapat diubah setelah pembayaran tercatat. Ajukan koreksi melalui prosedur kasir.');
            }
            if (RekamMedis::find()->where(['kunjungan_id' => $kunjungan->id])->exists()) {
                throw new ConflictHttpException('Pemeriksaan sudah tersimpan. Gunakan fitur revisi agar perubahan tercatat di audit.');
            }

            $rm = new RekamMedis();
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

            $totalBiayaTindakan = 0;
            if (!empty($data['tindakan']) && is_array($data['tindakan'])) {
                foreach ($data['tindakan'] as $item) {
                    $masterTindakan = MasterTindakan::findOne(['id' => $item['tindakan_id'], 'kategori' => 'MEDIS']);
                    if (!$masterTindakan) {
                        throw new BadRequestHttpException("Tindakan medis ID {$item['tindakan_id']} tidak valid.");
                    }
                    $qty = (int)($item['jumlah'] ?? 1);
                    if ($qty < 1) {
                        throw new BadRequestHttpException('Jumlah tindakan harus lebih besar dari 0.');
                    }
                    $subtotal = $masterTindakan->tarif * $qty;
                    $totalBiayaTindakan += $subtotal;

                    $kt = new KunjunganTindakan();
                    $kt->kunjungan_id = $kunjungan->id;
                    $kt->tindakan_id = $masterTindakan->id;
                    $kt->jumlah = $qty;
                    $kt->tarif_saat_itu = $masterTindakan->tarif;
                    $kt->subtotal = $subtotal;
                    $kt->catatan = $item['catatan'] ?? null;
                    if (!$kt->save()) {
                        throw new BadRequestHttpException(json_encode($kt->errors));
                    }
                }
            }

            $totalBiayaLab = 0;
            $labOrders = [];
            $outboxIds = [];
            if (!empty($data['permintaan_lab']) && is_array($data['permintaan_lab'])) {
                foreach ($data['permintaan_lab'] as $labItem) {
                    $masterLab = MasterTindakan::findOne(['id' => $labItem['tindakan_id'], 'kategori' => 'LABORATORIUM']);
                    if (!$masterLab) {
                        throw new BadRequestHttpException("Jenis tes lab ID {$labItem['tindakan_id']} tidak valid.");
                    }
                    $totalBiayaLab += $masterLab->tarif;

                    $order = new PermintaanLab();
                    $order->no_order_lab = 'LAB-' . date('Ymd') . '-' . strtoupper(Yii::$app->security->generateRandomString(10));
                    $order->kunjungan_id = $kunjungan->id;
                    $order->dokter_id = $dokter->id;
                    $order->tindakan_id = $masterLab->id;
                    $order->catatan_klinis = $labItem['catatan_klinis'] ?? null;
                    $order->status_lab = 'PENDING_SYNC';
                    if (!$order->save()) {
                        throw new BadRequestHttpException(json_encode($order->errors));
                    }
                    $payload = [
                        'order_id' => (int) $order->id,
                        'no_order_lab' => $order->no_order_lab,
                        'kunjungan_id' => (int) $kunjungan->id,
                    ];
                    Yii::$app->db->createCommand()->insert('{{%lab_integration_outbox}}', [
                        'lab_order_id' => $order->id,
                        'payload' => json_encode($payload),
                        'status' => 'PENDING',
                    ])->execute();
                    $labOrders[] = $order;
                    $outboxIds[] = Yii::$app->db->getLastInsertID();
                }
            }

            $totalBiayaObat = 0;
            if (!empty($data['resep']) && is_array($data['resep'])) {
                $resep = Resep::findOne(['kunjungan_id' => $kunjungan->id]) ?? new Resep();
                if ($resep->isNewRecord) {
                    $resep->no_resep = 'RSP-' . date('Ymd') . '-' . str_pad($kunjungan->id, 5, '0', STR_PAD_LEFT);
                    $resep->kunjungan_id = $kunjungan->id;
                    $resep->dokter_id = $dokter->id;
                    $resep->status_resep = 'MENUNGGU';
                    if (!$resep->save()) {
                        throw new BadRequestHttpException(json_encode($resep->errors));
                    }
                }

                $requestedQuantities = [];
                foreach ($data['resep'] as $obatItem) {
                    $obatId = filter_var($obatItem['obat_id'] ?? null, FILTER_VALIDATE_INT);
                    $qty = filter_var($obatItem['jumlah'] ?? 1, FILTER_VALIDATE_INT);
                    if ($obatId === false || $qty === false || $qty < 1) {
                        throw new BadRequestHttpException('Obat dan jumlah resep harus valid.');
                    }
                    $requestedQuantities[$obatId] = ($requestedQuantities[$obatId] ?? 0) + $qty;
                }
                foreach ($requestedQuantities as $obatId => $qty) {
                    $obat = MasterObat::findOne($obatId);
                    if (!$obat || (int) $obat->stok < $qty) {
                        throw new BadRequestHttpException("Stok obat ID {$obatId} tidak mencukupi untuk jumlah resep.");
                    }
                }

                foreach ($data['resep'] as $obatItem) {
                    $obat = MasterObat::findOne($obatItem['obat_id']);
                    $qty = (int)($obatItem['jumlah'] ?? 1);

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
                    if (!$detail->save()) {
                        throw new BadRequestHttpException(json_encode($detail->errors));
                    }
                }
                $kunjungan->status_antrean = 'MENUNGGU_OBAT';
            } else {
                $kunjungan->status_antrean = 'DIPERIKSA';
            }

            if (!$kunjungan->save(false)) {
                throw new \RuntimeException('Status antrean gagal disimpan.');
            }

            $billing->biaya_tindakan = $totalBiayaTindakan;
            $billing->biaya_lab = $totalBiayaLab;
            $billing->biaya_obat = $totalBiayaObat;
            $billing->total_tagihan = $billing->biaya_pendaftaran + $totalBiayaTindakan + $totalBiayaLab + $totalBiayaObat;
            $billing->updated_at = date('Y-m-d H:i:s');
            if (!$billing->save(false)) {
                throw new \RuntimeException('Tagihan pemeriksaan gagal diperbarui.');
            }

            $transaction->commit();

            $pendingSync = [];
            $outbox = new LabOutboxDispatcher();
            foreach ($outboxIds as $index => $outboxId) {
                if (!$outbox->dispatch($outboxId)) {
                    $pendingSync[] = $labOrders[$index]->id;
                }
            }

            return [
                'rekam_medis' => $rm,
                'billing' => $billing,
                'permintaan_lab' => $labOrders,
                'pending_sync_lab_ids' => $pendingSync,
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
        $data = Yii::$app->request->post();
        $reason = trim((string) ($data['alasan_revisi'] ?? ''));
        if ($reason === '') {
            throw new BadRequestHttpException('Alasan revisi wajib diisi untuk audit rekam medis.');
        }
        if (!isset($data['diagnosis_utama']) && !isset($data['diagnosis_sekunder']) && !array_key_exists('tindakan', $data)) {
            throw new BadRequestHttpException('Tidak ada data pemeriksaan yang akan direvisi.');
        }

        $transaction = Yii::$app->db->beginTransaction();
        try {
            $billing = Billing::findBySql(
                'SELECT * FROM {{%billing}} WHERE kunjungan_id = :kunjungan_id FOR UPDATE',
                [':kunjungan_id' => $kunjungan_id]
            )->one();
            if (!$billing) {
                throw new NotFoundHttpException('Tagihan kunjungan tidak ditemukan.');
            }
            if ((float) $billing->total_dibayar > 0 || $billing->status_pembayaran === 'LUNAS') {
                throw new ConflictHttpException('Revisi terkunci karena pembayaran sudah tercatat. Selesaikan koreksi pembayaran terlebih dahulu.');
            }

            $rm = RekamMedis::findOne(['kunjungan_id' => $kunjungan_id]);
            if (!$rm) {
                throw new NotFoundHttpException('Rekam medis belum ada untuk kunjungan ini.');
            }
            $oldData = [
                'rekam_medis' => [
                    'diagnosis_utama' => $rm->diagnosis_utama,
                    'diagnosis_sekunder' => $rm->diagnosis_sekunder,
                ],
                'tindakan' => KunjunganTindakan::find()
                    ->where(['kunjungan_id' => $kunjungan_id])
                    ->asArray()
                    ->all(),
                'billing' => [
                    'biaya_tindakan' => $billing->biaya_tindakan,
                    'total_tagihan' => $billing->total_tagihan,
                    'total_dibayar' => $billing->total_dibayar,
                ],
            ];

            if (isset($data['diagnosis_utama'])) {
                $rm->diagnosis_utama = trim((string) $data['diagnosis_utama']);
            }
            if (array_key_exists('diagnosis_sekunder', $data)) {
                $rm->diagnosis_sekunder = $data['diagnosis_sekunder'];
            }
            $rm->updated_at = date('Y-m-d H:i:s');
            if (!$rm->save()) {
                throw new BadRequestHttpException(json_encode($rm->errors));
            }

            $totalBiayaTindakan = (float) $billing->biaya_tindakan;
            if (array_key_exists('tindakan', $data)) {
                if (!is_array($data['tindakan'])) {
                    throw new BadRequestHttpException('Daftar tindakan revisi tidak valid.');
                }
                $totalBiayaTindakan = 0;
                KunjunganTindakan::deleteAll(['kunjungan_id' => $kunjungan_id]);
                foreach ($data['tindakan'] as $item) {
                    $masterTindakan = MasterTindakan::findOne(['id' => $item['tindakan_id'], 'kategori' => 'MEDIS']);
                    if (!$masterTindakan) {
                        throw new BadRequestHttpException('Tindakan revisi tidak valid.');
                    }
                    $qty = filter_var($item['jumlah'] ?? 1, FILTER_VALIDATE_INT);
                    if ($qty === false || $qty < 1) {
                        throw new BadRequestHttpException('Jumlah tindakan harus lebih besar dari 0.');
                    }
                    $subtotal = $masterTindakan->tarif * $qty;
                    $totalBiayaTindakan += $subtotal;

                    $kt = new KunjunganTindakan();
                    $kt->kunjungan_id = $kunjungan_id;
                    $kt->tindakan_id = $masterTindakan->id;
                    $kt->jumlah = $qty;
                    $kt->tarif_saat_itu = $masterTindakan->tarif;
                    $kt->subtotal = $subtotal;
                    if (!$kt->save()) {
                        throw new BadRequestHttpException(json_encode($kt->errors));
                    }
                }
            }

            $billing->biaya_tindakan = $totalBiayaTindakan;
            $billing->total_tagihan = $billing->biaya_pendaftaran + $totalBiayaTindakan + $billing->biaya_lab + $billing->biaya_obat;
            $billing->updated_at = date('Y-m-d H:i:s');
            if (!$billing->save(false)) {
                throw new \RuntimeException('Total tagihan gagal disinkronkan dengan revisi pemeriksaan.');
            }

            Yii::$app->db->createCommand()->insert('{{%audit_logs}}', [
                'table_name' => 'rekam_medis_dan_tindakan',
                'record_id' => $rm->id,
                'action' => 'REVISION',
                'old_data' => json_encode($oldData),
                'new_data' => json_encode([
                    'rekam_medis' => [
                        'diagnosis_utama' => $rm->diagnosis_utama,
                        'diagnosis_sekunder' => $rm->diagnosis_sekunder,
                    ],
                    'tindakan' => KunjunganTindakan::find()
                        ->where(['kunjungan_id' => $kunjungan_id])
                        ->asArray()
                        ->all(),
                    'billing' => [
                        'biaya_tindakan' => $billing->biaya_tindakan,
                        'total_tagihan' => $billing->total_tagihan,
                        'total_dibayar' => $billing->total_dibayar,
                    ],
                ]),
                'changed_by' => Yii::$app->user->id,
                'reason' => $reason,
            ])->execute();

            $transaction->commit();
            return ['message' => 'Revisi pemeriksaan berhasil disimpan dan tercatat di Audit Log.', 'billing' => $billing];
        } catch (\Throwable $e) {
            $transaction->rollBack();
            throw $e;
        }
    }

}
