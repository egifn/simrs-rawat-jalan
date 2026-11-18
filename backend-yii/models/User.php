<?php

namespace app\models;

use Yii;
use yii\db\ActiveRecord;
use yii\web\IdentityInterface;

class User extends ActiveRecord implements IdentityInterface
{
    public static function tableName()
    {
        return 'users';
    }

    public function rules()
    {
        return [
            [['username', 'password_hash', 'nama_lengkap', 'role'], 'required'],
            [['username'], 'unique'],
            [['is_active'], 'boolean'],
            [['role'], 'in', 'range' => ['ADMIN', 'PENDAFTARAN', 'DOKTER', 'FARMASI', 'LABORATORIUM', 'KASIR']],
        ];
    }

    public function fields()
    {
        return ['id', 'username', 'nama_lengkap', 'role', 'is_active'];
    }

    public static function findIdentity($id)
    {
        return static::findOne(['id' => $id, 'is_active' => true]);
    }

    public static function findIdentityByAccessToken($token, $type = null)
    {
        $claims = $token->claims();
        return static::findIdentity($claims->get('uid'));
    }

    public static function findByUsername($username)
    {
        return static::findOne(['username' => $username, 'is_active' => true]);
    }

    public function getId()
    {
        return $this->id;
    }
    public function getAuthKey()
    {
        return null;
    }
    public function validateAuthKey($authKey)
    {
        return false;
    }

    public function validatePassword($password)
    {
        return Yii::$app->security->validatePassword($password, $this->password_hash);
    }
}
