<?php

namespace app\models;

use yii\db\ActiveRecord;

class RekamMedis extends ActiveRecord
{
    public static function tableName()
    {
        return 'rekam_medis';
    }

    public function rules()
    {
        return [
            [['kunjungan_id', 'dokter_id', 'anamnesis', 'diagnosis_utama'], 'required'],
            [['kunjungan_id', 'dokter_id', 'nadi'], 'integer'],
            [['suhu_tubuh', 'berat_badan'], 'number'],
            [['tekanan_darah', 'pemeriksaan_fisik', 'diagnosis_sekunder'], 'safe'],
        ];
    }
}
