<?php

namespace app\models;

use yii\db\ActiveRecord;

class RolePermission extends ActiveRecord
{
    public static function tableName()
    {
        return 'role_permissions';
    }

    public static function availablePermissions()
    {
        return [
            'dashboard' => 'Dashboard',
            'pasien' => 'Data Pasien',
            'dokter' => 'Data Dokter',
            'poli' => 'Data Poli',
            'jadwal' => 'Jadwal Dokter',
            'tindakan' => 'Master Tindakan',
            'obat' => 'Master Obat',
            'pengguna' => 'Pengguna',
            'hak-akses' => 'Hak Akses',
            'pendaftaran' => 'Pendaftaran & Antrean',
            'pemeriksaan' => 'Pemeriksaan Dokter',
            'laboratorium' => 'Laboratorium',
            'farmasi' => 'Farmasi',
            'kasir' => 'Kasir & Billing',
            'laporan' => 'Laporan',
        ];
    }

    public static function forRole($role)
    {
        return static::find()
            ->select('permission')
            ->where(['role' => $role])
            ->column();
    }

    public function rules()
    {
        return [
            [['role', 'permission'], 'required'],
            [['role'], 'string', 'max' => 30],
            [['permission'], 'string', 'max' => 50],
            [['role', 'permission'], 'unique', 'targetAttribute' => ['role', 'permission']],
        ];
    }
}
