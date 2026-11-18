<?php
$params = require __DIR__ . '/params.php';
$db = require __DIR__ . '/db.php';

return [
    'id' => 'simrs-backend-yii',
    'basePath' => dirname(__DIR__),
    'bootstrap' => ['log'],
    'aliases' => [
        '@bower' => '@vendor/bower-asset',
        '@npm'   => '@vendor/npm-asset',
    ],
    'as corsFilter' => [
        'class' => \yii\filters\Cors::class,
        'cors' => [
            'Origin' => ['*'],
            'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
            'Access-Control-Request-Headers' => ['*'],
            'Access-Control-Allow-Credentials' => false,
            'Access-Control-Max-Age' => 86400,
        ],
    ],
    'components' => [
        'request' => [
            'cookieValidationKey' => 'simrs-validation-key-2026',
            'enableCsrfValidation' => false,
            'parsers' => [
                'application/json' => 'yii\web\JsonParser',
            ],
        ],
        'response' => [
            'format' => yii\web\Response::FORMAT_JSON,
            'charset' => 'UTF-8',
            'on beforeSend' => function ($event) {
                $response = $event->sender;
                if ($response->data !== null && !isset($response->data['success'])) {
                    $isSuccess = $response->isSuccessful;
                    $response->data = [
                        'success' => $isSuccess,
                        'status_code' => $response->statusCode,
                        'message' => $isSuccess ? 'Request berhasil' : ($response->data['message'] ?? 'Terjadi kesalahan'),
                        'data' => $isSuccess ? $response->data : null,
                        'errors' => !$isSuccess ? $response->data : null,
                    ];
                }
            },
        ],
        'cache' => ['class' => 'yii\caching\FileCache'],
        'user' => [
            'identityClass' => 'app\models\User',
            'enableAutoLogin' => false,
            'enableSession' => false,
        ],
        'jwt' => [
            'class' => \sizeg\jwt\Jwt::class,
            'key' => $params['jwtSecret'],
        ],
        'log' => [
            'traceLevel' => YII_DEBUG ? 3 : 0,
            'targets' => [
                ['class' => 'yii\log\FileTarget', 'levels' => ['error', 'warning']],
            ],
        ],
        'db' => $db,
        'urlManager' => [
            'enablePrettyUrl' => true,
            'showScriptName' => false,
            'rules' => [
                'POST api/auth/login' => 'auth/login',
                'GET api/auth/me' => 'auth/me',

                // Administrator
                'GET api/admin/permissions' => 'admin/permissions',
                'PUT api/admin/permissions' => 'admin/update-permissions',
                'GET api/admin/<resource:[a-z-]+>' => 'admin/index',
                'POST api/admin/<resource:[a-z-]+>' => 'admin/create',
                'PUT,DELETE api/admin/<resource:[a-z-]+>/<id:\d+>' => 'admin/detail',

                // Master Data
                'GET,POST api/pasien' => 'master-pasien/index',
                'GET,PUT,DELETE api/pasien/<id:\d+>' => 'master-pasien/view',
                'GET,POST api/poli' => 'master-referensi/poli',
                'GET,POST api/dokter' => 'master-referensi/dokter',
                'GET,POST api/tindakan' => 'master-referensi/tindakan',
                'GET,POST api/obat' => 'master-referensi/obat',
                'PUT,DELETE api/obat/<id:\d+>' => 'master-referensi/obat-detail',

                // Transaksi SIMRS
                'GET,POST api/kunjungan' => 'kunjungan/index',
                'GET api/kunjungan/<id:\d+>' => 'kunjungan/detail',
                'POST api/pemeriksaan/<kunjungan_id:\d+>' => 'pemeriksaan/simpan',
                'PUT api/pemeriksaan/<kunjungan_id:\d+>' => 'pemeriksaan/revisi',
                'GET api/farmasi/antrean' => 'farmasi/antrean',
                'POST api/farmasi/serahkan/<resep_id:\d+>' => 'farmasi/serahkan',
                'GET api/billing/kunjungan/<kunjungan_id:\d+>' => 'billing/detail',
                'POST api/billing/bayar/<billing_id:\d+>' => 'billing/bayar',
            ],
        ],
    ],
    'params' => $params,
];
