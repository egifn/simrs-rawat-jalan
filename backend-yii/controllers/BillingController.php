<?php

namespace app\controllers;

use Yii;
use yii\web\NotFoundHttpException;
use yii\web\BadRequestHttpException;
use yii\web\ConflictHttpException;
use app\components\ApiController;
use app\models\Billing;
use app\models\Pembayaran;
use app\models\KunjunganTindakan;
use app\models\Resep;
use app\models\PermintaanLab;
use app\models\RekamMedis;
use app\models\Kunjungan;

class BillingController extends ApiController
{
    protected array $allowedRoles = [];
    protected ?string $requiredPermission = 'kasir';

    /**
     * GET /api/billing/kunjungan/<kunjungan_id>
     */
    public function actionDetail($kunjungan_id)
    {
        $billing = Billing::find()
            ->with(['pembayaran', 'kunjungan.pasien', 'kunjungan.poli', 'kunjungan.dokter'])
            ->where(['kunjungan_id' => $kunjungan_id])
            ->asArray()
            ->one();

        if (!$billing) {
            throw new NotFoundHttpException('Data tagihan (billing) tidak ditemukan.');
        }

        // Ambil rincian item tindakan, lab, dan obat untuk ditampilkan di invoice
        $tindakan = KunjunganTindakan::find()->with('tindakan')->where(['kunjungan_id' => $kunjungan_id])->asArray()->all();
        $lab = PermintaanLab::find()->with('tindakan')->where(['kunjungan_id' => $kunjungan_id])->asArray()->all();
        $resep = Resep::find()->with('details.obat')->where(['kunjungan_id' => $kunjungan_id])->asArray()->one();

        return [
            'billing' => $billing,
            'rincian' => [
                'tindakan' => $tindakan,
                'laboratorium' => $lab,
                'obat' => $resep ? $resep['details'] : [],
            ],
        ];
    }

    /**
     * POST /api/billing/bayar/<billing_id>
     * SKENARIO 3: Idempotency Key mencegah pencatatan transaksi pembayaran ganda saat retry jaringan
     */
    public function actionBayar($billing_id)
    {
        $data = Yii::$app->request->post();
        $idempotencyKey = $data['idempotency_key'] ?? null;
        $metode = strtoupper($data['metode_pembayaran'] ?? 'TUNAI');
        $jumlahBayar = (float)($data['jumlah_bayar'] ?? 0);

        if (empty($idempotencyKey)) {
            throw new BadRequestHttpException('Header/field idempotency_key (UUID) wajib disertakan untuk keamanan transaksi.');
        }

        // 1. Cek Idempotency Key sebelum memproses transaksi: Jika sudah pernah diproses, kembalikan data yang sama!
        $existingPayment = Pembayaran::findOne(['idempotency_key' => $idempotencyKey]);
        if ($existingPayment) {
            $billing = Billing::findOne($billing_id);
            return [
                'idempotent_replay' => true,
                'message' => 'Transaksi dengan idempotency_key ini sudah tercatat sebelumnya (Mencegah pembayaran ganda).',
                'pembayaran' => $existingPayment,
                'billing' => $billing,
            ];
        }

        if ($jumlahBayar <= 0) {
            throw new BadRequestHttpException('Jumlah pembayaran harus lebih dari 0.');
        }

        $transaction = Yii::$app->db->beginTransaction();
        try {
            // Kunci baris billing selama proses pembayaran
            $billing = Billing::findBySql('SELECT * FROM billing WHERE id = :id FOR UPDATE', [':id' => $billing_id])->one();
            if (!$billing) {
                throw new NotFoundHttpException('Tagihan tidak ditemukan.');
            }

            if (!RekamMedis::find()->where(['kunjungan_id' => $billing->kunjungan_id])->exists()) {
                throw new ConflictHttpException('Pembayaran belum dapat diproses sebelum pemeriksaan dokter disimpan.');
            }

            $sisaTagihan = (float)$billing->total_tagihan - (float)$billing->total_dibayar;
            if ($jumlahBayar > $sisaTagihan) {
                throw new BadRequestHttpException("Jumlah bayar (Rp {$jumlahBayar}) melebihi sisa tagihan (Rp {$sisaTagihan}).");
            }

            $pembayaran = new Pembayaran();
            $pembayaran->billing_id = $billing->id;
            $pembayaran->no_kwitansi = 'KWT-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -5));
            $pembayaran->idempotency_key = $idempotencyKey;
            $pembayaran->metode_pembayaran = $metode;
            $pembayaran->jumlah_bayar = $jumlahBayar;
            $pembayaran->kasir_id = Yii::$app->user->id;
            if (!$pembayaran->save()) {
                throw new BadRequestHttpException(json_encode($pembayaran->errors));
            }

            $billing->total_dibayar = (float)$billing->total_dibayar + $jumlahBayar;
            $billing->status_pembayaran = ($billing->total_dibayar >= (float)$billing->total_tagihan)
                ? 'LUNAS'
                : 'DIBAYAR_SEBAGIAN';
            $billing->updated_at = date('Y-m-d H:i:s');
            $billing->save(false);

            if ($billing->status_pembayaran === 'LUNAS') {
                $resep = Resep::findOne(['kunjungan_id' => $billing->kunjungan_id]);
                if (!$resep || in_array($resep->status_resep, ['DISERAHKAN', 'BATAL'], true)) {
                    Kunjungan::updateAll(
                        ['status_antrean' => 'SELESAI'],
                        ['id' => $billing->kunjungan_id]
                    );
                }
            }

            $transaction->commit();

            return [
                'idempotent_replay' => false,
                'message' => 'Pembayaran berhasil dicatat.',
                'pembayaran' => $pembayaran,
                'billing' => $billing,
            ];
        } catch (\Throwable $e) {
            $transaction->rollBack();
            throw $e;
        }
    }
}
