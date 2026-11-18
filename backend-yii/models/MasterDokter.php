<?php

namespace app\models;

use yii\db\ActiveRecord;

class MasterDokter extends ActiveRecord
{
    public static function tableName()
    {
        return 'master_dokter';
    }

    public function rules()
    {
        return [
            [['nip', 'nama_dokter', 'spesialisasi', 'poli_id'], 'required'],
            [['nip'], 'unique'],
            [['poli_id', 'user_id'], 'integer'],
            [['is_active'], 'boolean'],
        ];
    }

    public function getPoli()
    {
        return $this->hasOne(MasterPoli::class, ['id' => 'poli_id']);
    }

    public function getJadwal()
    {
        return $this->hasMany(JadwalDokter::class, ['dokter_id' => 'id']);
    }

    public function extraFields()
    {
        return ['poli', 'jadwal'];
    }
}
