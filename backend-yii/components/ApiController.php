<?php

namespace app\components;

use Yii;
use yii\rest\Controller;
use yii\web\UnauthorizedHttpException;
use yii\web\ForbiddenHttpException;
use app\models\User;
use app\models\RolePermission;

class ApiController extends Controller
{
    protected array $allowedRoles = [];
    protected ?string $requiredPermission = null;

    public function beforeAction($action)
    {
        if (!parent::beforeAction($action)) {
            return false;
        }

        if (Yii::$app->request->isOptions) {
            return true;
        }

        $authHeader = Yii::$app->request->headers->get('Authorization');
        if (!$authHeader || !preg_match('/^Bearer\s+(.*?)$/', $authHeader, $matches)) {
            throw new UnauthorizedHttpException('Akses ditolak. Token Bearer diperlukan.');
        }

        $payload = JwtHelper::validateToken($matches[1]);
        if (!$payload) {
            throw new UnauthorizedHttpException('Token tidak valid atau sudah kedaluwarsa.');
        }

        $user = User::findIdentity($payload['uid']);
        if (!$user) {
            throw new UnauthorizedHttpException('User tidak aktif atau tidak ditemukan.');
        }

        Yii::$app->user->setIdentity($user);

        if (!empty($this->allowedRoles)) {
            if ($user->role !== 'ADMIN' && !in_array($user->role, $this->allowedRoles)) {
                throw new ForbiddenHttpException("Akses ditolak. Role Anda ({$user->role}) tidak memiliki izin.");
            }
        }

        if ($this->requiredPermission && !$this->userHasPermission($this->requiredPermission, $user)) {
            throw new ForbiddenHttpException('Hak akses untuk fitur ini belum diberikan kepada role Anda.');
        }

        return true;
    }

    protected function userHasPermission($permission, $user = null)
    {
        $user = $user ?: Yii::$app->user->identity;
        if (!$user || $user->role === 'ADMIN') {
            return $user && $user->role === 'ADMIN';
        }

        return RolePermission::find()
            ->where(['role' => $user->role, 'permission' => $permission])
            ->exists();
    }

    protected function requirePermission($permission)
    {
        if (!$this->userHasPermission($permission)) {
            throw new ForbiddenHttpException('Hak akses untuk fitur ini belum diberikan kepada role Anda.');
        }
    }

    protected function requireAnyPermission(array $permissions)
    {
        foreach ($permissions as $permission) {
            if ($this->userHasPermission($permission)) {
                return;
            }
        }

        throw new ForbiddenHttpException('Hak akses untuk fitur ini belum diberikan kepada role Anda.');
    }
}
