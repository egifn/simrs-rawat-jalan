<?php

use yii\db\Migration;

class m261120_000001_harden_outpatient_transactions extends Migration
{
    public function safeUp()
    {
        $paymentSchema = $this->db->getTableSchema('pembayaran', true);
        if ($paymentSchema->getColumn('request_hash') === null) {
            $this->addColumn('{{%pembayaran}}', 'request_hash', $this->string(64)->null());
        }

        if ($this->db->getTableSchema('{{%lab_integration_outbox}}', true) === null) {
            $this->createTable('{{%lab_integration_outbox}}', [
                'id' => $this->bigPrimaryKey(),
                'lab_order_id' => $this->integer()->notNull(),
                'payload' => $this->json()->notNull(),
                'status' => $this->string(20)->notNull()->defaultValue('PENDING'),
                'attempts' => $this->integer()->notNull()->defaultValue(0),
                'last_error' => $this->text(),
                'locked_at' => $this->timestamp(),
                'created_at' => $this->timestamp()->notNull()->defaultExpression('CURRENT_TIMESTAMP'),
                'delivered_at' => $this->timestamp(),
            ]);
            $this->createIndex(
                'uq_lab_outbox_order',
                '{{%lab_integration_outbox}}',
                'lab_order_id',
                true
            );
            $this->createIndex(
                'idx_lab_outbox_status_created',
                '{{%lab_integration_outbox}}',
                ['status', 'created_at']
            );
        }

        $duplicateKeys = (int) $this->db->createCommand(
            'SELECT COUNT(*) FROM (
                SELECT idempotency_key
                FROM {{%pembayaran}}
                WHERE idempotency_key IS NOT NULL
                GROUP BY idempotency_key
                HAVING COUNT(*) > 1
            ) duplicates'
        )->queryScalar();
        if ($duplicateKeys > 0) {
            throw new \RuntimeException('Pembayaran memiliki idempotency_key duplikat; bersihkan data sebelum migrasi.');
        }
        $idempotencyIndexValue = $this->db->createCommand(
            "SELECT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE schemaname = current_schema()
                  AND tablename = 'pembayaran'
                  AND indexdef ILIKE '%UNIQUE%idempotency_key%'
            )"
        )->queryScalar();
        $idempotencyIndexExists = in_array($idempotencyIndexValue, [true, 1, '1', 't', 'true'], true);
        if (!$idempotencyIndexExists) {
            $this->execute(
                'CREATE UNIQUE INDEX idx_pembayaran_idempotency_key
                 ON {{%pembayaran}} (idempotency_key)
                 WHERE idempotency_key IS NOT NULL'
            );
        }

        $negativeStock = (int) $this->db->createCommand(
            'SELECT COUNT(*) FROM {{%master_obat}} WHERE stok < 0'
        )->queryScalar();
        if ($negativeStock > 0) {
            throw new \RuntimeException('Terdapat stok obat negatif; koreksi stok sebelum migrasi.');
        }
        $stockConstraintValue = $this->db->createCommand(
            "SELECT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'ck_master_obat_stok_nonnegative'
            )"
        )->queryScalar();
        $stockConstraintExists = in_array($stockConstraintValue, [true, 1, '1', 't', 'true'], true);
        if (!$stockConstraintExists) {
            $this->execute(
                'ALTER TABLE {{%master_obat}}
                 ADD CONSTRAINT ck_master_obat_stok_nonnegative CHECK (stok >= 0)'
            );
        }

        $this->execute(
            'CREATE INDEX IF NOT EXISTS idx_kunjungan_pasien_tanggal
             ON {{%kunjungan}} (pasien_id, tanggal_kunjungan DESC)'
        );
        $this->execute(
            'CREATE INDEX IF NOT EXISTS idx_kunjungan_dokter_tanggal_status
             ON {{%kunjungan}} (dokter_id, tanggal_kunjungan, status_antrean)'
        );
        $this->execute(
            'CREATE INDEX IF NOT EXISTS idx_kunjungan_tindakan_kunjungan
             ON {{%kunjungan_tindakan}} (kunjungan_id)'
        );
        $this->execute(
            'CREATE INDEX IF NOT EXISTS idx_resep_detail_resep
             ON {{%resep_detail}} (resep_id)'
        );
        $this->execute(
            'CREATE INDEX IF NOT EXISTS idx_lab_status_created
             ON {{%permintaan_lab}} (status_lab, created_at DESC)'
        );
        $this->execute(
            'CREATE INDEX IF NOT EXISTS idx_pembayaran_billing_waktu
             ON {{%pembayaran}} (billing_id, waktu_bayar DESC)'
        );
    }

    public function safeDown()
    {
        $this->dropIndex('idx_pembayaran_billing_waktu', '{{%pembayaran}}');
        $this->dropIndex('idx_lab_status_created', '{{%permintaan_lab}}');
        $this->dropIndex('idx_resep_detail_resep', '{{%resep_detail}}');
        $this->dropIndex('idx_kunjungan_tindakan_kunjungan', '{{%kunjungan_tindakan}}');
        $this->dropIndex('idx_kunjungan_dokter_tanggal_status', '{{%kunjungan}}');
        $this->dropIndex('idx_kunjungan_pasien_tanggal', '{{%kunjungan}}');
        // Keep the unique key index: it may have existed before this migration.
        $this->execute(
            'ALTER TABLE {{%master_obat}} DROP CONSTRAINT IF EXISTS ck_master_obat_stok_nonnegative'
        );
        $this->dropTable('{{%lab_integration_outbox}}');
        $this->dropColumn('{{%pembayaran}}', 'request_hash');
    }
}
