<?php

use yii\db\Migration;

class m260101_000002_add_is_active_to_master_pasien extends Migration
{
    public function safeUp()
    {
        $this->addColumn(
            '{{%master_pasien}}',
            'is_active',
            $this->boolean()->notNull()->defaultValue(true)
        );
    }

    public function safeDown()
    {
        $this->dropColumn('{{%master_pasien}}', 'is_active');
    }
}
