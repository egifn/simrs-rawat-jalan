<?php

namespace app\controllers;

use Yii;
use yii\web\NotFoundHttpException;
use yii\web\ConflictHttpException;
use yii\web\BadRequestHttpException;
use app\components\ApiController;
use app\models\Resep;
use app\models\ResepDetail;
use app\models\MasterObat;
use app\models\Kunjungan;
use app\models\Billing;

class FarmasiController extends ApiController
{
    protected array $allowedRoles = [];
    protected ?string $requiredPermission = 'farmasi';

    /**
     * GET /api/farmasi/antrean
     */
    public function actionAntrean()
    {
        $query = Resep::find()
            ->with(['details.obat', 'kunjungan.pasien', 'kunjungan.dokter', 'kunjungan.billing']);
        if ($status = Yii::$app->request->get('status')) {
            $query->andWhere(['status_resep' => strtoupper($status)]);
        }

        $limit = filter_var(Yii::$app->request->get('limit', 100), FILTER_VALIDATE_INT);
        $offset = filter_var(Yii::$app->request->get('offset', 0), FILTER_VALIDATE_INT);
        return $query
            ->orderBy(['created_at' => SORT_DESC])
            ->limit($limit === false ? 100 : max(1, min(500, $limit)))
            ->offset($offset === false ? 0 : max(0, $offset))
            ->asArray()
            ->all();
    }

    /**
     * POST /api/farmasi/serahkan/<resep_id>
     * SKENARIO 2: Row-Level Pessimistic Locking (SELECT ... FOR UPDATE) mencegah stok minus saat konkurensi
     */
    public function actionSerahkan($resep_id)
    {
        $transaction = Yii::$app->db->beginTransaction();
        try {
            $resep = Resep::findBySql(
                'SELECT * FROM resep WHERE id = :id FOR UPDATE',
                [':id' => $resep_id]
            )->one();
            if (!$resep) {
                throw new NotFoundHttpException('Data resep tidak ditemukan.');
            }

            if ($resep->status_resep === 'DISERAHKAN') {
                throw new ConflictHttpException('Resep ini sudah diserahkan sebelumnya.');
            }

            $billing = Billing::findBySql(
                'SELECT * FROM billing WHERE kunjungan_id = :kunjungan_id FOR UPDATE',
                [':kunjungan_id' => $resep->kunjungan_id]
            )->one();
            if (!$billing || $billing->status_pembayaran !== 'LUNAS') {
                throw new ConflictHttpException('Obat hanya dapat diserahkan setelah tagihan dibayar lunas di kasir.');
            }

            $details = ResepDetail::find()->where(['resep_id' => $resep->id])->all();
            if (empty($details)) {
                throw new BadRequestHttpException('Detail item obat pada resep kosong.');
            }

            $quantitiesByMedicine = [];
            foreach ($details as $item) {
                if ((int) $item->jumlah < 1) {
                    throw new BadRequestHttpException('Jumlah obat pada resep harus lebih besar dari 0.');
                }
                $quantitiesByMedicine[$item->obat_id] = ($quantitiesByMedicine[$item->obat_id] ?? 0) + (int) $item->jumlah;
            }
            ksort($quantitiesByMedicine, SORT_NUMERIC);

            foreach ($quantitiesByMedicine as $obatId => $quantity) {
                $obatRow = Yii::$app->db->createCommand(
                    'SELECT id, nama_obat, stok FROM master_obat WHERE id = :id FOR UPDATE',
                    [':id' => $obatId]
                )->queryOne();

                if (!$obatRow) {
                    throw new NotFoundHttpException("Data obat ID {$obatId} tidak ditemukan.");
                }

                if ((int) $obatRow['stok'] < $quantity) {
                    throw new ConflictHttpException(
                        "Konkurensi/Stok Habis: Stok obat '{$obatRow['nama_obat']}' tersisa {$obatRow['stok']}, dibutuhkan {$quantity}."
                    );
                }

                Yii::$app->db->createCommand(
                    'UPDATE master_obat SET stok = stok - :qty, updated_at = NOW() WHERE id = :id',
                    [':qty' => $quantity, ':id' => $obatId]
                )->execute();
            }

            $resep->status_resep = 'DISERAHKAN';
            $resep->diproses_oleh = Yii::$app->user->id;
            $resep->waktu_penyerahan = date('Y-m-d H:i:s');
            if (!$resep->save(false)) {
                throw new \RuntimeException('Status penyerahan resep gagal disimpan.');
            }

            if (Kunjungan::updateAll(['status_antrean' => 'SELESAI'], ['id' => $resep->kunjungan_id]) !== 1) {
                throw new \RuntimeException('Status kunjungan gagal diperbarui setelah penyerahan obat.');
            }

            $transaction->commit();

            return [
                'message' => 'Obat berhasil diserahkan dan stok telah diperbarui secara aman.',
                'resep' => $resep,
            ];
        } catch (\Throwable $e) {
            $transaction->rollBack();
            throw $e;
        }
    }
}
