<?php

namespace app\models;

use yii\db\ActiveRecord;

class MasterTindakan extends ActiveRecord
{
    public static function tableName()
    {
        return 'master_tindakan';
    }

    public function rules()
    {
        return [
            [['kode_tindakan', 'nama_tindakan', 'kategori', 'tarif'], 'required'],
            [['kode_tindakan'], 'unique'],
            [['kategori'], 'in', 'range' => ['MEDIS', 'LABORATORIUM']],
            [['tarif'], 'number', 'min' => 0],
            [['is_active'], 'boolean'],
        ];
    }
}
