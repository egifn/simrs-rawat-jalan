<?php

namespace app\models;

use yii\db\ActiveRecord;

class KunjunganTindakan extends ActiveRecord
{
    public static function tableName()
    {
        return 'kunjungan_tindakan';
    }

    public function rules()
    {
        return [
            [['kunjungan_id', 'tindakan_id', 'jumlah', 'tarif_saat_itu', 'subtotal'], 'required'],
            [['kunjungan_id', 'tindakan_id', 'jumlah'], 'integer'],
            [['tarif_saat_itu', 'subtotal'], 'number'],
            [['catatan'], 'safe'],
        ];
    }

    public function getTindakan()
    {
        return $this->hasOne(MasterTindakan::class, ['id' => 'tindakan_id']);
    }
}
