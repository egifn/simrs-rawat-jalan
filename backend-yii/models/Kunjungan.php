<?php

namespace app\models;

use yii\db\ActiveRecord;

class Kunjungan extends ActiveRecord
{
    public static function tableName()
    {
        return 'kunjungan';
    }

    public function rules()
    {
        return [
            [['no_registrasi', 'pasien_id', 'poli_id', 'dokter_id', 'tanggal_kunjungan', 'no_antrean', 'kode_antrean'], 'required'],
            [['pasien_id', 'poli_id', 'dokter_id', 'no_antrean', 'created_by'], 'integer'],
            [['status_antrean'], 'in', 'range' => ['MENUNGGU', 'DIPERIKSA', 'MENUNGGU_OBAT', 'SELESAI', 'BATAL']],
        ];
    }

    public function getPasien()
    {
        return $this->hasOne(MasterPasien::class, ['id' => 'pasien_id']);
    }
    public function getPoli()
    {
        return $this->hasOne(MasterPoli::class, ['id' => 'poli_id']);
    }
    public function getDokter()
    {
        return $this->hasOne(MasterDokter::class, ['id' => 'dokter_id']);
    }
    public function getRekamMedis()
    {
        return $this->hasOne(RekamMedis::class, ['kunjungan_id' => 'id']);
    }
    public function getBilling()
    {
        return $this->hasOne(Billing::class, ['kunjungan_id' => 'id']);
    }
}
