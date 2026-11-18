<?php

namespace app\models;

use yii\db\ActiveRecord;

class ResepDetail extends ActiveRecord
{
    public static function tableName()
    {
        return 'resep_detail';
    }

    public function rules()
    {
        return [
            [['resep_id', 'obat_id', 'dosis', 'frekuensi', 'jumlah', 'harga_saat_itu', 'subtotal'], 'required'],
            [['resep_id', 'obat_id', 'jumlah'], 'integer'],
            [['harga_saat_itu', 'subtotal'], 'number'],
        ];
    }

    public function getObat()
    {
        return $this->hasOne(MasterObat::class, ['id' => 'obat_id']);
    }
}
