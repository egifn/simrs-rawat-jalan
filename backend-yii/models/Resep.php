<?php

namespace app\models;

use yii\db\ActiveRecord;

class Resep extends ActiveRecord
{
    public static function tableName()
    {
        return 'resep';
    }

    public function rules()
    {
        return [
            [['no_resep', 'kunjungan_id', 'dokter_id'], 'required'],
            [['kunjungan_id', 'dokter_id', 'diproses_oleh'], 'integer'],
            [['status_resep'], 'in', 'range' => ['MENUNGGU', 'DIPROSES', 'DISERAHKAN', 'BATAL']],
        ];
    }

    public function getDetails()
    {
        return $this->hasMany(ResepDetail::class, ['resep_id' => 'id']);
    }

    public function getKunjungan()
    {
        return $this->hasOne(Kunjungan::class, ['id' => 'kunjungan_id']);
    }
}
