<?php

namespace app\models;

use yii\db\ActiveRecord;

class MasterPoli extends ActiveRecord
{
    public static function tableName()
    {
        return 'master_poli';
    }

    public function rules()
    {
        return [
            [['kode_poli', 'nama_poli', 'biaya_pendaftaran'], 'required'],
            [['kode_poli'], 'unique'],
            [['biaya_pendaftaran'], 'number', 'min' => 0],
            [['is_active'], 'boolean'],
        ];
    }
}
