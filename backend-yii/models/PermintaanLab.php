<?php

namespace app\models;

use yii\db\ActiveRecord;

class PermintaanLab extends ActiveRecord
{
    public static function tableName()
    {
        return 'permintaan_lab';
    }

    public function rules()
    {
        return [
            [['no_order_lab', 'kunjungan_id', 'dokter_id', 'tindakan_id'], 'required'],
            [['kunjungan_id', 'dokter_id', 'tindakan_id', 'petugas_lab_id'], 'integer'],
            [['status_lab'], 'in', 'range' => ['DIMINTA', 'DIPROSES', 'SELESAI', 'PENDING_SYNC']],
            [['catatan_klinis', 'hasil_lab', 'waktu_selesai'], 'safe'],
        ];
    }

    public function getTindakan()
    {
        return $this->hasOne(MasterTindakan::class, ['id' => 'tindakan_id']);
    }
}
