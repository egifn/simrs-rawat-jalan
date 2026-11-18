<?php
return [
    'class' => 'yii\db\Connection',
    'dsn' => 'pgsql:host=localhost;port=5433;dbname=simrs_rawat_jalan',
    // 'dsn' => 'pgsql:host=127.0.0.1;port=5432;dbname=simrs_rawat_jalan',
    'username' => 'postgres',
    'password' => 'root', // <-- GANTI DENGAN PASSWORD POSTGRESQL KAMU
    'charset' => 'utf8',
    'schemaMap' => [
        'pgsql' => [
            'class' => 'yii\db\pgsql\Schema',
            'defaultSchema' => 'public'
        ]
    ],
];
