<?php

namespace app\controllers;

use Yii;
use yii\web\BadRequestHttpException;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;
use app\components\ApiController;
use app\models\JadwalDokter;
use app\models\MasterDokter;
use app\models\MasterObat;
use app\models\MasterPasien;
use app\models\MasterPoli;
use app\models\MasterTindakan;
use app\models\RolePermission;
use app\models\User;

class AdminController extends ApiController
{
    protected array $allowedRoles = ['ADMIN'];
    private const ROLES = ['ADMIN', 'PENDAFTARAN', 'DOKTER', 'FARMASI', 'LABORATORIUM', 'KASIR'];

    public function actionPermissions()
    {
        $permissionsByRole = [];
        foreach (self::ROLES as $role) {
            $permissionsByRole[$role] = $role === 'ADMIN'
                ? array_keys(RolePermission::availablePermissions())
                : RolePermission::forRole($role);
        }

        return [
            'roles' => self::ROLES,
            'available_permissions' => RolePermission::availablePermissions(),
            'permissions_by_role' => $permissionsByRole,
        ];
    }

    public function actionUpdatePermissions()
    {
        $data = Yii::$app->request->bodyParams;
        $roleValue = $data['role'] ?? null;
        $role = is_string($roleValue) ? strtoupper($roleValue) : '';
        $permissions = $data['permissions'] ?? null;

        if (!in_array($role, self::ROLES, true) || !is_array($permissions)) {
            throw new BadRequestHttpException('Role atau daftar permission tidak valid.');
        }
        foreach ($permissions as $permission) {
            if (!is_string($permission)) {
                throw new BadRequestHttpException('Daftar permission tidak valid.');
            }
        }
        if ($role === 'ADMIN') {
            throw new BadRequestHttpException('Hak akses ADMIN selalu penuh dan tidak dapat dikurangi.');
        }

        $validPermissions = array_keys(RolePermission::availablePermissions());
        $permissions = array_values(array_unique($permissions));
        if (array_diff($permissions, $validPermissions)) {
            throw new BadRequestHttpException('Daftar permission berisi fitur yang tidak dikenal.');
        }

        $transaction = Yii::$app->db->beginTransaction();
        try {
            RolePermission::deleteAll(['role' => $role]);
            foreach ($permissions as $permission) {
                $model = new RolePermission();
                $model->role = $role;
                $model->permission = $permission;
                if (!$model->save()) {
                    throw new BadRequestHttpException(json_encode($model->errors));
                }
            }
            $transaction->commit();
        } catch (\Throwable $error) {
            $transaction->rollBack();
            throw $error;
        }

        return [
            'role' => $role,
            'permissions' => $permissions,
            'message' => 'Hak akses role berhasil diperbarui.',
        ];
    }

    private function getModelClass($resource)
    {
        $models = [
            'pasien' => MasterPasien::class,
            'dokter' => MasterDokter::class,
            'poli' => MasterPoli::class,
            'jadwal' => JadwalDokter::class,
            'tindakan' => MasterTindakan::class,
            'obat' => MasterObat::class,
            'pengguna' => User::class,
        ];

        if (!isset($models[$resource])) {
            throw new NotFoundHttpException('Menu master data tidak ditemukan.');
        }

        return $models[$resource];
    }

    public function actionIndex($resource)
    {
        $class = $this->getModelClass($resource);
        $query = $class::find();

        if ($resource === 'pasien') {
            $query->andWhere(['is_active' => true]);
        } elseif ($resource === 'dokter') {
            $query->with(['poli', 'jadwal']);
        } elseif ($resource === 'jadwal') {
            $query->with('dokter');
        }

        $page = max(1, (int) Yii::$app->request->get('page', 1));
        $pageSize = (int) Yii::$app->request->get('page_size', 25);
        $pageSize = min(100, max(1, $pageSize));
        $search = trim((string) Yii::$app->request->get('q', ''));
        if ($search !== '') {
            $searchColumns = [
                'pasien' => ['no_rm', 'nik', 'nama_lengkap'],
                'dokter' => ['nip', 'nama_dokter', 'spesialisasi'],
                'poli' => ['kode_poli', 'nama_poli'],
                'jadwal' => ['hari'],
                'tindakan' => ['kode_tindakan', 'nama_tindakan', 'kategori'],
                'obat' => ['kode_obat', 'nama_obat'],
                'pengguna' => ['username', 'nama_lengkap', 'role'],
            ];
            $columns = $searchColumns[$resource] ?? [];
            $conditions = ['or'];
            foreach ($columns as $column) {
                $conditions[] = ['ilike', $column, $search];
            }
            if ($resource === 'jadwal') {
                $conditions[] = [
                    'in',
                    'dokter_id',
                    MasterDokter::find()
                        ->select('id')
                        ->andWhere(['ilike', 'nama_dokter', $search]),
                ];
            }
            if (count($conditions) > 1) {
                $query->andWhere($conditions);
            }
        }

        $query->orderBy(['id' => SORT_DESC]);
        $total = (int) (clone $query)->count();
        $query
            ->limit($pageSize)
            ->offset(($page - 1) * $pageSize);
        $models = $resource === 'pengguna'
            ? array_map(static function ($model) {
                return $model->toArray();
            }, $query->all())
            : $query->asArray()->all();

        return [
            'items' => $models,
            'total' => $total,
            'page' => $page,
            'page_size' => $pageSize,
        ];
    }

    public function actionCreate($resource)
    {
        $class = $this->getModelClass($resource);
        $model = new $class();
        $data = Yii::$app->request->bodyParams;

        if ($resource === 'pengguna') {
            $password = $data['password'] ?? '';
            unset($data['password']);
            if ($password === '') {
                throw new BadRequestHttpException('Password wajib diisi untuk pengguna baru.');
            }
            $model->password_hash = Yii::$app->security->generatePasswordHash($password);
        }

        $model->load($data, '');
        $this->validateSchedule($resource, $model);
        if (!$model->save()) {
            throw new BadRequestHttpException(json_encode($model->errors));
        }

        Yii::$app->response->statusCode = 201;
        return $model;
    }

    public function actionDetail($resource, $id)
    {
        $class = $this->getModelClass($resource);
        $model = $class::findOne($id);
        if (!$model) {
            throw new NotFoundHttpException('Data tidak ditemukan.');
        }

        if (Yii::$app->request->isDelete) {
            if ($resource === 'pasien') {
                $model->is_active = false;
                if (!$model->save(false, ['is_active'])) {
                    throw new BadRequestHttpException('Pasien gagal dinonaktifkan.');
                }
                return ['deactivated' => true];
            }

            $model->delete();
            return ['deleted' => true];
        }

        $data = Yii::$app->request->bodyParams;
        if ($resource === 'pengguna') {
            $password = $data['password'] ?? '';
            unset($data['password']);
            if ($password !== '') {
                $model->password_hash = Yii::$app->security->generatePasswordHash($password);
            }
        }

        $model->load($data, '');
        $this->validateSchedule($resource, $model);
        if (!$model->save()) {
            throw new BadRequestHttpException(json_encode($model->errors));
        }

        return $model;
    }

    private function validateSchedule($resource, $model)
    {
        if ($resource !== 'jadwal') {
            return;
        }

        if ($model->jam_mulai >= $model->jam_selesai) {
            throw new BadRequestHttpException('Jam selesai harus setelah jam mulai.');
        }

        $existing = JadwalDokter::find()
            ->where(['dokter_id' => $model->dokter_id, 'hari' => $model->hari])
            ->andWhere(['<>', 'id', $model->id ?: 0])
            ->exists();
        if ($existing) {
            throw new BadRequestHttpException('Dokter sudah memiliki jadwal pada hari tersebut.');
        }
    }
}
