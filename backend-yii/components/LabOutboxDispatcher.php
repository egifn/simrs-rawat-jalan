<?php

namespace app\components;

use Yii;

class LabOutboxDispatcher
{
    public function dispatch($outboxId)
    {
        $claim = Yii::$app->db->createCommand(
            "UPDATE {{%lab_integration_outbox}}
             SET status = 'PROCESSING', attempts = attempts + 1, locked_at = NOW()
             WHERE id = :id
               AND (
                    status IN ('PENDING', 'FAILED')
                    OR (status = 'PROCESSING' AND locked_at < NOW() - INTERVAL '5 minutes')
               )
             RETURNING id, lab_order_id, payload",
            [':id' => $outboxId]
        )->queryOne();

        if (!$claim) {
            return false;
        }

        $payload = json_decode($claim['payload'], true);
        if (!is_array($payload)) {
            $this->markFailed($claim, 'Payload outbox laboratorium tidak valid.');
            return false;
        }
        $payload['outbox_id'] = (int) $claim['id'];
        $url = getenv('SIMRS_NODE_LAB_WEBHOOK_URL') ?: 'http://localhost:3001/api/lab/webhook-order';
        $integrationSecret = getenv('SIMRS_LAB_WEBHOOK_SECRET');
        if (!is_string($integrationSecret) || $integrationSecret === '') {
            $this->markFailed($claim, 'SIMRS_LAB_WEBHOOK_SECRET belum dikonfigurasi.');
            return false;
        }
        if (!function_exists('curl_init')) {
            $this->markFailed($claim, 'Ekstensi cURL PHP tidak tersedia.');
            return false;
        }
        $curl = curl_init($url);
        if ($curl === false) {
            $this->markFailed($claim, 'Gagal memulai koneksi cURL.');
            return false;
        }

        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'X-Integration-Secret: ' . $integrationSecret,
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_CONNECTTIMEOUT_MS => 500,
            CURLOPT_TIMEOUT_MS => 1500,
        ]);
        $response = curl_exec($curl);
        $curlError = curl_error($curl);
        $httpCode = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        $responseBody = is_string($response) ? json_decode($response, true) : null;

        if ($response === false || $httpCode < 200 || $httpCode >= 300 || ($responseBody['success'] ?? false) !== true) {
            $this->markFailed(
                $claim,
                $response === false
                    ? $curlError
                    : "Layanan Node.js menolak event atau merespons HTTP {$httpCode}."
            );
            return false;
        }

        $transaction = Yii::$app->db->beginTransaction();
        try {
            Yii::$app->db->createCommand(
                "UPDATE {{%lab_integration_outbox}}
                 SET status = 'DELIVERED', delivered_at = NOW(), locked_at = NULL, last_error = NULL
                 WHERE id = :id",
                [':id' => $claim['id']]
            )->execute();
            Yii::$app->db->createCommand(
                "UPDATE {{%permintaan_lab}}
                 SET status_lab = 'DIMINTA'
                 WHERE id = :id AND status_lab = 'PENDING_SYNC'",
                [':id' => $claim['lab_order_id']]
            )->execute();
            $transaction->commit();
        } catch (\Throwable $error) {
            $transaction->rollBack();
            throw $error;
        }

        return true;
    }

    public function dispatchPending($limit = 50)
    {
        $ids = Yii::$app->db->createCommand(
            "SELECT id
             FROM {{%lab_integration_outbox}}
             WHERE status IN ('PENDING', 'FAILED')
                OR (status = 'PROCESSING' AND locked_at < NOW() - INTERVAL '5 minutes')
             ORDER BY created_at ASC
             LIMIT :limit",
            [':limit' => max(1, min(500, (int) $limit))]
        )->queryColumn();

        $delivered = 0;
        foreach ($ids as $id) {
            if ($this->dispatch($id)) {
                $delivered++;
            }
        }
        return $delivered;
    }

    private function markFailed(array $claim, $error)
    {
        $transaction = Yii::$app->db->beginTransaction();
        try {
            Yii::$app->db->createCommand(
                "UPDATE {{%lab_integration_outbox}}
                 SET status = 'FAILED', locked_at = NULL, last_error = :error
                 WHERE id = :id",
                [':id' => $claim['id'], ':error' => mb_substr((string) $error, 0, 2000)]
            )->execute();
            Yii::$app->db->createCommand(
                "UPDATE {{%permintaan_lab}}
                 SET status_lab = 'PENDING_SYNC'
                 WHERE id = :id",
                [':id' => $claim['lab_order_id']]
            )->execute();
            $transaction->commit();
        } catch (\Throwable $databaseError) {
            $transaction->rollBack();
            throw $databaseError;
        }

        Yii::warning([
            'message' => 'Gagal mengirim notifikasi order laboratorium; event tersimpan untuk retry.',
            'outbox_id' => $claim['id'],
            'error' => $error,
        ], __METHOD__);
    }
}
