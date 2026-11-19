<?php

namespace app\controllers;

use Yii;
use yii\db\IntegrityException;
use yii\web\BadRequestHttpException;
use yii\web\ConflictHttpException;
use yii\web\NotFoundHttpException;
use app\components\ApiController;
use app\models\Kunjungan;
use app\models\MasterPoli;
use app\models\MasterDokter;
use app\models\MasterPasien;
use app\models\JadwalDokter;
use app\models\Billing;

class KunjunganController extends ApiController
{
    public function actionIndex()
    {
        $request = Yii::$app->request;

        // GET: Daftar Antrean Kunjungan (Bisa difilter tanggal, poli, dokter, status)
        if ($request->isGet) {
            $this->requireAnyPermission(['pendaftaran', 'pemeriksaan', 'laboratorium', 'farmasi', 'kasir']);
            $query = Kunjungan::find()
                ->with(['pasien', 'poli', 'dokter', 'billing', 'rekamMedis'])
                ->orderBy(['tanggal_kunjungan' => SORT_DESC, 'no_antrean' => SORT_ASC]);

            if ($tanggal = $request->get('tanggal')) {
                $query->andWhere(['tanggal_kunjungan' => $tanggal]);
            }
            if ($poliId = $request->get('poli_id')) {
                $query->andWhere(['poli_id' => $poliId]);
            }
            if ($dokterId = $request->get('dokter_id')) {
                $query->andWhere(['dokter_id' => $dokterId]);
            }
            if ($status = $request->get('status')) {
                $query->andWhere(['status_antrean' => strtoupper($status)]);
            }
            if ($pasienId = $request->get('pasien_id')) {
                $query->andWhere(['pasien_id' => $pasienId]);
            }
            if ($request->get('tagihan_belum_lunas')) {
                $query->andWhere([
                    'in',
                    'id',
                    Billing::find()
                        ->select('kunjungan_id')
                        ->andWhere(['<>', 'status_pembayaran', 'LUNAS']),
                ])->andWhere(['<>', 'status_antrean', 'BATAL']);
            }

            if ($request->get('paginated')) {
                $pageSize = filter_var($request->get('page_size', 50), FILTER_VALIDATE_INT);
                $page = filter_var($request->get('page', 1), FILTER_VALIDATE_INT);
                $pageSize = $pageSize === false ? 50 : max(1, min(200, $pageSize));
                $page = $page === false ? 1 : max(1, $page);
                $total = (int) (clone $query)->count();

                return [
                    'items' => $query
                        ->limit($pageSize)
                        ->offset(($page - 1) * $pageSize)
                        ->asArray()
                        ->all(),
                    'total' => $total,
                    'page' => $page,
                    'page_size' => $pageSize,
                ];
            }

            $limit = filter_var($request->get('limit', 200), FILTER_VALIDATE_INT);
            $offset = filter_var($request->get('offset', 0), FILTER_VALIDATE_INT);
            $limit = $limit === false ? 200 : max(1, min(500, $limit));
            $offset = $offset === false ? 0 : max(0, $offset);
            return $query->limit($limit)->offset($offset)->asArray()->all();
        }

        // POST: Daftarkan kunjungan jika role memiliki permission pendaftaran.
        if ($request->isPost) {
            $user = Yii::$app->user->identity;
            $this->requirePermission('pendaftaran');

            $data = $request->post();
            $pasienId = $data['pasien_id'] ?? null;
            $poliId = $data['poli_id'] ?? null;
            $dokterId = $data['dokter_id'] ?? null;
            $tanggal = $data['tanggal_kunjungan'] ?? date('Y-m-d');

            foreach ([$pasienId, $poliId, $dokterId] as $id) {
                if (filter_var($id, FILTER_VALIDATE_INT) === false || (int) $id < 1) {
                    throw new BadRequestHttpException('Pasien, poli, dan dokter wajib dipilih dengan benar.');
                }
            }
            if (!is_string($tanggal)) {
                throw new BadRequestHttpException('Tanggal kunjungan tidak valid.');
            }
            $date = \DateTime::createFromFormat('!Y-m-d', $tanggal);
            if (!$date || $date->format('Y-m-d') !== $tanggal) {
                throw new BadRequestHttpException('Tanggal kunjungan tidak valid.');
            }

            $poli = MasterPoli::findOne($poliId);
            $dokter = MasterDokter::findOne(['id' => $dokterId, 'poli_id' => $poliId]);

            if (!$poli || !$dokter || !$dokter->is_active) {
                throw new BadRequestHttpException('Data pasien, poli, atau dokter tidak valid / tidak sesuai poli.');
            }

            $hari = [
                'Monday' => 'Senin',
                'Tuesday' => 'Selasa',
                'Wednesday' => 'Rabu',
                'Thursday' => 'Kamis',
                'Friday' => 'Jumat',
                'Saturday' => 'Sabtu',
                'Sunday' => 'Minggu',
            ][$date->format('l')];

            $transaction = Yii::$app->db->beginTransaction();
            try {
                $pasien = MasterPasien::findBySql(
                    'SELECT * FROM {{%master_pasien}} WHERE id = :id AND is_active = TRUE FOR UPDATE',
                    [':id' => $pasienId]
                )->one();
                if (!$pasien) {
                    throw new BadRequestHttpException('Data pasien tidak ditemukan.');
                }

                $jadwal = JadwalDokter::findBySql(
                    'SELECT * FROM {{%jadwal_dokter}} WHERE dokter_id = :dokter_id AND hari = :hari FOR UPDATE',
                    [':dokter_id' => $dokterId, ':hari' => $hari]
                )->one();
                if (!$jadwal || $jadwal->jam_mulai >= $jadwal->jam_selesai) {
                    throw new BadRequestHttpException('Dokter tidak memiliki jadwal praktik yang valid pada tanggal tersebut.');
                }

                $duplikasi = Kunjungan::find()
                    ->where([
                        'pasien_id' => $pasienId,
                        'poli_id' => $poliId,
                        'tanggal_kunjungan' => $tanggal,
                    ])
                    ->andWhere(['<>', 'status_antrean', 'BATAL'])
                    ->exists();
                if ($duplikasi) {
                    throw new ConflictHttpException('Pasien sudah terdaftar pada poli tersebut di tanggal yang sama.');
                }

                $jumlahTerdaftar = (int) Kunjungan::find()
                    ->where([
                        'dokter_id' => $dokterId,
                        'tanggal_kunjungan' => $tanggal,
                    ])
                    ->andWhere(['<>', 'status_antrean', 'BATAL'])
                    ->count();
                if ($jadwal->kuota_harian !== null && $jumlahTerdaftar >= (int) $jadwal->kuota_harian) {
                    throw new ConflictHttpException('Kuota antrean dokter pada tanggal tersebut sudah penuh.');
                }

                $lastAntrean = (int) Kunjungan::find()
                    ->where(['poli_id' => $poliId, 'dokter_id' => $dokterId, 'tanggal_kunjungan' => $tanggal])
                    ->max('no_antrean');

                $nextAntrean = $lastAntrean + 1;
                $prefix = strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $poli->kode_poli), -1) ?: 'A');
                $kodeAntrean = sprintf('%s-%03d', $prefix, $nextAntrean);
                $noRegistrasi = 'REG-' . $date->format('Ymd') . '-' . strtoupper(Yii::$app->security->generateRandomString(8));

                $kunjungan = new Kunjungan();
                $kunjungan->no_registrasi = $noRegistrasi;
                $kunjungan->pasien_id = $pasienId;
                $kunjungan->poli_id = $poliId;
                $kunjungan->dokter_id = $dokterId;
                $kunjungan->tanggal_kunjungan = $tanggal;
                $kunjungan->no_antrean = $nextAntrean;
                $kunjungan->kode_antrean = $kodeAntrean;
                $kunjungan->status_antrean = 'MENUNGGU';
                $kunjungan->created_by = $user->id;

                if (!$kunjungan->save()) {
                    throw new BadRequestHttpException(json_encode($kunjungan->errors));
                }

                // Otomatis inisialisasi Draft Billing dengan biaya pendaftaran poli
                Yii::$app->db->createCommand()->insert('billing', [
                    'no_invoice' => 'INV-' . date('Ymd') . '-' . str_pad($kunjungan->id, 5, '0', STR_PAD_LEFT),
                    'kunjungan_id' => $kunjungan->id,
                    'biaya_pendaftaran' => $poli->biaya_pendaftaran,
                    'total_tagihan' => $poli->biaya_pendaftaran,
                    'status_pembayaran' => 'BELUM_DIBAYAR',
                ])->execute();

                $transaction->commit();

                Yii::$app->response->statusCode = 201;
                return Kunjungan::find()->with(['pasien', 'poli', 'dokter', 'billing'])->where(['id' => $kunjungan->id])->asArray()->one();
            } catch (IntegrityException $e) {
                $transaction->rollBack();
                throw new ConflictHttpException('Duplikasi terdeteksi: Pasien sudah terdaftar aktif pada poli dan tanggal yang sama, atau antrean bentrok.');
            } catch (\Throwable $e) {
                $transaction->rollBack();
                throw $e;
            }
        }
    }

    public function actionDetail($id)
    {
        $this->requireAnyPermission(['pendaftaran', 'pemeriksaan', 'laboratorium', 'farmasi', 'kasir']);
        $kunjungan = Kunjungan::find()
            ->with(['pasien', 'poli', 'dokter', 'rekamMedis', 'billing'])
            ->where(['id' => $id])
            ->asArray()
            ->one();

        if (!$kunjungan) {
            throw new NotFoundHttpException('Data kunjungan tidak ditemukan.');
        }
        return $kunjungan;
    }
}
