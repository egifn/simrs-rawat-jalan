<?php

namespace app\models;

use yii\db\ActiveRecord;

class Pembayaran extends ActiveRecord
{
    public static function tableName()
    {
        return 'pembayaran';
    }

    public function rules()
    {
        return [
            [['billing_id', 'no_kwitansi', 'idempotency_key', 'metode_pembayaran', 'jumlah_bayar', 'kasir_id'], 'required'],
            [['metode_pembayaran'], 'in', 'range' => ['TUNAI', 'NON_TUNAI']],
            [['jumlah_bayar'], 'number', 'min' => 0.01],
            [['request_hash'], 'string', 'length' => 64],
        ];
    }
}
