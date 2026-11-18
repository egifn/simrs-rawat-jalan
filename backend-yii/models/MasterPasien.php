<?php

namespace app\models;

use yii\db\ActiveRecord;

class MasterPasien extends ActiveRecord
{
    public static function tableName()
    {
        return 'master_pasien';
    }

    public function rules()
    {
        return [
            [['nik', 'nama_lengkap', 'tanggal_lahir', 'jenis_kelamin'], 'required'],
            [['nik'], 'string', 'length' => 16],
            [['nik', 'no_rm'], 'unique', 'message' => '{attribute} sudah terdaftar di sistem.'],
            [['jenis_kelamin'], 'in', 'range' => ['L', 'P']],
            [['is_active'], 'boolean'],
            [['alamat', 'no_telepon', 'no_rm'], 'safe'],
        ];
    }

    public function beforeValidate()
    {
        // Generate No. RM otomatis jika pasien baru: RM-2026-0004
        if ($this->isNewRecord && empty($this->no_rm)) {
            $year = date('Y');
            $lastId = (int) static::find()->max('id') + 1;
            $this->no_rm = sprintf('RM-%s-%04d', $year, $lastId);
        }
        return parent::beforeValidate();
    }
}
