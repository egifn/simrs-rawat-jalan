<?php

namespace app\models;

use yii\db\ActiveRecord;

class MasterObat extends ActiveRecord
{
    public static function tableName()
    {
        return 'master_obat';
    }

    public function rules()
    {
        return [
            [['kode_obat', 'nama_obat', 'satuan', 'stok', 'harga_satuan'], 'required'],
            [['kode_obat'], 'unique'],
            [['stok'], 'integer', 'min' => 0],
            [['harga_satuan'], 'number', 'min' => 0],
        ];
    }
}
