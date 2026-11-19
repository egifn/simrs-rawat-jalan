<?php

namespace app\controllers;

use Yii;
use yii\db\IntegrityException;
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
        $metode = strtoupper((string) ($data['metode_pembayaran'] ?? 'TUNAI'));
        $rawJumlahBayar = $data['jumlah_bayar'] ?? null;

        if (!is_string($idempotencyKey) || trim($idempotencyKey) === '' || strlen($idempotencyKey) > 255) {
            throw new BadRequestHttpException('Header/field idempotency_key (UUID) wajib disertakan untuk keamanan transaksi.');
        }
        $idempotencyKey = trim($idempotencyKey);
        if (!is_numeric($rawJumlahBayar) || !is_finite((float) $rawJumlahBayar)) {
            throw new BadRequestHttpException('Jumlah pembayaran tidak valid.');
        }
        $jumlahBayar = round((float) $rawJumlahBayar, 2);
        if ($jumlahBayar <= 0) {
            throw new BadRequestHttpException('Jumlah pembayaran harus lebih dari 0.');
        }
        if (!in_array($metode, ['TUNAI', 'NON_TUNAI'], true)) {
            throw new BadRequestHttpException('Metode pembayaran tidak valid.');
        }

        $requestHash = hash('sha256', json_encode([
            'billing_id' => (int) $billing_id,
            'metode_pembayaran' => $metode,
            'jumlah_bayar' => number_format($jumlahBayar, 2, '.', ''),
        ]));
        $existingPayment = Pembayaran::findOne(['idempotency_key' => $idempotencyKey]);
        if ($existingPayment) {
            return $this->replayPayment($existingPayment, $billing_id, $requestHash, $metode, $jumlahBayar);
        }

        $transaction = Yii::$app->db->beginTransaction();
        try {
            $billing = Billing::findBySql('SELECT * FROM billing WHERE id = :id FOR UPDATE', [':id' => $billing_id])->one();
            if (!$billing) {
                throw new NotFoundHttpException('Tagihan tidak ditemukan.');
            }

            $existingPayment = Pembayaran::findOne(['idempotency_key' => $idempotencyKey]);
            if ($existingPayment) {
                $transaction->commit();
                return $this->replayPayment($existingPayment, $billing_id, $requestHash, $metode, $jumlahBayar);
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
            $pembayaran->no_kwitansi = 'KWT-' . date('Ymd') . '-' . strtoupper(Yii::$app->security->generateRandomString(10));
            $pembayaran->idempotency_key = $idempotencyKey;
            $pembayaran->request_hash = $requestHash;
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
            if (!$billing->save(false)) {
                throw new \RuntimeException('Ringkasan tagihan gagal diperbarui.');
            }

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
        } catch (IntegrityException $error) {
            $transaction->rollBack();
            $existingPayment = Pembayaran::findOne(['idempotency_key' => $idempotencyKey]);
            if ($existingPayment) {
                return $this->replayPayment($existingPayment, $billing_id, $requestHash, $metode, $jumlahBayar);
            }
            throw new ConflictHttpException('Transaksi pembayaran berkonflik. Silakan muat ulang tagihan dan coba kembali.');
        } catch (\Throwable $e) {
            $transaction->rollBack();
            throw $e;
        }
    }

    private function replayPayment(Pembayaran $payment, $billingId, $requestHash, $method, $amount)
    {
        $sameRequest = $payment->request_hash !== null
            ? hash_equals($payment->request_hash, $requestHash)
            : ((int) $payment->billing_id === (int) $billingId
                && strtoupper($payment->metode_pembayaran) === $method
                && number_format((float) $payment->jumlah_bayar, 2, '.', '') === number_format($amount, 2, '.', ''));
        if ((int) $payment->billing_id !== (int) $billingId || !$sameRequest) {
            throw new ConflictHttpException('Idempotency key sudah digunakan untuk transaksi dengan data berbeda.');
        }

        return [
            'idempotent_replay' => true,
            'message' => 'Transaksi pembayaran sudah tercatat. Data transaksi sebelumnya dikembalikan.',
            'pembayaran' => $payment,
            'billing' => Billing::findOne($billingId),
        ];
    }
}
