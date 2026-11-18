<?php

use app\models\RolePermission;
use yii\db\Migration;

class m260101_000001_create_role_permissions extends Migration
{
    public function safeUp()
    {
        $this->createTable('{{%role_permissions}}', [
            'id' => $this->primaryKey(),
            'role' => $this->string(30)->notNull(),
            'permission' => $this->string(50)->notNull(),
            'created_at' => $this->timestamp()->notNull()->defaultExpression('CURRENT_TIMESTAMP'),
        ]);
        $this->createIndex(
            'uq-role-permissions-role-permission',
            '{{%role_permissions}}',
            ['role', 'permission'],
            true
        );

        $permissions = RolePermission::availablePermissions();
        $roles = [
            'ADMIN' => array_keys($permissions),
            'PENDAFTARAN' => ['dashboard', 'pasien', 'pendaftaran'],
            'DOKTER' => ['dashboard', 'pemeriksaan'],
            'LABORATORIUM' => ['dashboard', 'laboratorium'],
            'FARMASI' => ['dashboard', 'farmasi', 'obat'],
            'KASIR' => ['dashboard', 'kasir'],
        ];

        $rows = [];
        foreach ($roles as $role => $rolePermissions) {
            foreach ($rolePermissions as $permission) {
                $rows[] = [$role, $permission];
            }
        }

        $this->batchInsert('{{%role_permissions}}', ['role', 'permission'], $rows);
    }

    public function safeDown()
    {
        $this->dropTable('{{%role_permissions}}');
    }
}
