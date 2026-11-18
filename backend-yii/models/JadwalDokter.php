<?php

namespace app\models;

use yii\db\ActiveRecord;

class JadwalDokter extends ActiveRecord
{
    public static function tableName()
    {
        return 'jadwal_dokter';
    }

    public function rules()
    {
        return [
            [['dokter_id', 'hari', 'jam_mulai', 'jam_selesai'], 'required'],
            [['dokter_id', 'kuota_harian'], 'integer'],
            [['hari'], 'in', 'range' => ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']],
        ];
    }

    public function getDokter()
    {
        return $this->hasOne(MasterDokter::class, ['id' => 'dokter_id']);
    }
}
