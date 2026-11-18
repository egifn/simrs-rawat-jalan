<?php

namespace app\models;

use yii\db\ActiveRecord;

class Billing extends ActiveRecord
{
    public static function tableName()
    {
        return 'billing';
    }

    public function rules()
    {
        return [
            [['no_invoice', 'kunjungan_id'], 'required'],
            [['biaya_pendaftaran', 'biaya_tindakan', 'biaya_lab', 'biaya_obat', 'total_tagihan', 'total_dibayar'], 'number'],
            [['status_pembayaran'], 'in', 'range' => ['BELUM_DIBAYAR', 'DIBAYAR_SEBAGIAN', 'LUNAS']],
        ];
    }

    public function getPembayaran()
    {
        return $this->hasMany(Pembayaran::class, ['billing_id' => 'id']);
    }

    public function getKunjungan()
    {
        return $this->hasOne(Kunjungan::class, ['id' => 'kunjungan_id']);
    }
}
