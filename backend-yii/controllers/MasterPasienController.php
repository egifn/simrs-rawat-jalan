<?php

namespace app\controllers;

use Yii;
use yii\web\NotFoundHttpException;
use yii\web\BadRequestHttpException;
use app\components\ApiController;
use app\models\MasterPasien;

class MasterPasienController extends ApiController
{
    // Read and write access are checked against the role's configured permissions.
    public function actionIndex()
    {
        $request = Yii::$app->request;

        if ($request->isGet) {
            $this->requireAnyPermission(['pasien', 'pendaftaran']);
            $query = MasterPasien::find()
                ->where(['is_active' => true])
                ->orderBy(['id' => SORT_DESC]);
            if ($search = $request->get('q')) {
                $query->andFilterWhere([
                    'or',
                    ['ilike', 'no_rm', $search],
                    ['ilike', 'nik', $search],
                    ['ilike', 'nama_lengkap', $search],
                ]);
            }
            return $query->limit(50)->all();
        }

        if ($request->isPost) {
            $this->checkWriteAccess();
            $model = new MasterPasien();
            $model->load($request->post(), '');
            if (!$model->save()) {
                throw new BadRequestHttpException(json_encode($model->errors));
            }
            Yii::$app->response->statusCode = 201;
            return $model;
        }
    }

    public function actionView($id)
    {
        $model = MasterPasien::findOne(['id' => $id, 'is_active' => true]);
        if (!$model) {
            throw new NotFoundHttpException('Data pasien tidak ditemukan.');
        }

        $request = Yii::$app->request;
        if ($request->isGet) {
            $this->requireAnyPermission(['pasien', 'pendaftaran']);
            return $model;
        }

        $this->checkWriteAccess();

        if ($request->isPut) {
            $model->load($request->post(), '');
            if (!$model->save()) {
                throw new BadRequestHttpException(json_encode($model->errors));
            }
            return $model;
        }

        if ($request->isDelete) {
            $model->is_active = false;
            if (!$model->save(false, ['is_active'])) {
                throw new BadRequestHttpException('Pasien gagal dinonaktifkan.');
            }
            return ['deactivated' => true];
        }
    }

    private function checkWriteAccess()
    {
        $this->requireAnyPermission(['pasien', 'pendaftaran']);
    }
}
