<?php

namespace app\controllers;

use Yii;
use yii\rest\Controller;
use yii\web\UnauthorizedHttpException;
use app\models\User;
use app\models\RolePermission;
use app\components\JwtHelper;

class AuthController extends Controller
{
    public function actionLogin()
    {
        $request = Yii::$app->request->post();
        $username = $request['username'] ?? '';
        $password = $request['password'] ?? '';

        $user = User::findByUsername($username);
        if (!$user || !$user->validatePassword($password)) {
            throw new UnauthorizedHttpException('Username atau password salah.');
        }

        $token = JwtHelper::generateToken([
            'uid' => $user->id,
            'username' => $user->username,
            'role' => $user->role,
        ]);

        return [
            'token' => $token,
            'user' => $user,
            'permissions' => $user->role === 'ADMIN'
                ? array_keys(RolePermission::availablePermissions())
                : RolePermission::forRole($user->role),
        ];
    }

    public function actionMe()
    {
        $authHeader = Yii::$app->request->headers->get('Authorization');
        if (!$authHeader || !preg_match('/^Bearer\s+(.*?)$/', $authHeader, $matches)) {
            throw new UnauthorizedHttpException('Token tidak ditemukan.');
        }

        $payload = JwtHelper::validateToken($matches[1]);
        if (!$payload) {
            throw new UnauthorizedHttpException('Token tidak valid atau sudah kedaluwarsa.');
        }

        $user = User::findIdentity($payload['uid']);
        if (!$user) {
            throw new UnauthorizedHttpException('User tidak ditemukan.');
        }

        return [
            'user' => $user,
            'permissions' => $user->role === 'ADMIN'
                ? array_keys(RolePermission::availablePermissions())
                : RolePermission::forRole($user->role),
        ];
    }
}
