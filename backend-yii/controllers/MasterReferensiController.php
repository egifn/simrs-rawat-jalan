<?php

namespace app\controllers;

use Yii;
use yii\web\BadRequestHttpException;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;
use app\components\ApiController;
use app\models\MasterPoli;
use app\models\MasterDokter;
use app\models\MasterTindakan;
use app\models\MasterObat;

class MasterReferensiController extends ApiController
{
    public function actionPoli()
    {
        if (Yii::$app->request->isPost) {
            $this->onlyAdmin('poli');
            $model = new MasterPoli();
            $model->load(Yii::$app->request->post(), '');
            if (!$model->save()) throw new BadRequestHttpException(json_encode($model->errors));
            return $model;
        }
        return MasterPoli::find()->where(['is_active' => true])->all();
    }

    public function actionDokter()
    {
        if (Yii::$app->request->isPost) {
            $this->onlyAdmin('dokter');
            $model = new MasterDokter();
            $model->load(Yii::$app->request->post(), '');
            if (!$model->save()) throw new BadRequestHttpException(json_encode($model->errors));
            return $model;
        }
        $query = MasterDokter::find()->with(['poli', 'jadwal'])->where(['is_active' => true]);
        if ($poliId = Yii::$app->request->get('poli_id')) {
            $query->andWhere(['poli_id' => $poliId]);
        }
        return $query->asArray()->all();
    }

    public function actionTindakan()
    {
        if (Yii::$app->request->isPost) {
            $this->onlyAdmin('tindakan');
            $model = new MasterTindakan();
            $model->load(Yii::$app->request->post(), '');
            if (!$model->save()) throw new BadRequestHttpException(json_encode($model->errors));
            return $model;
        }
        $query = MasterTindakan::find()->where(['is_active' => true]);
        if ($kategori = Yii::$app->request->get('kategori')) {
            $query->andWhere(['kategori' => strtoupper($kategori)]);
        }
        if ($q = Yii::$app->request->get('q')) {
            $query->andFilterWhere(['ilike', 'nama_tindakan', $q]);
        }
        return $query->all();
    }

    public function actionObat()
    {
        if (Yii::$app->request->isPost) {
            $this->onlyAdminOrFarmasi('obat');
            $model = new MasterObat();
            $model->load(Yii::$app->request->post(), '');
            if (!$model->save()) throw new BadRequestHttpException(json_encode($model->errors));
            return $model;
        }
        $query = MasterObat::find()->orderBy(['nama_obat' => SORT_ASC]);
        if ($q = Yii::$app->request->get('q')) {
            $query->andFilterWhere(['ilike', 'nama_obat', $q]);
        }
        return $query->all();
    }

    public function actionObatDetail($id)
    {
        $this->onlyAdminOrFarmasi('obat');
        $model = MasterObat::findOne($id);
        if (!$model) throw new NotFoundHttpException('Obat tidak ditemukan.');

        if (Yii::$app->request->isPut) {
            $model->load(Yii::$app->request->post(), '');
            if (!$model->save()) throw new BadRequestHttpException(json_encode($model->errors));
            return $model;
        }
        if (Yii::$app->request->isDelete) {
            $model->delete();
            return ['deleted' => true];
        }
    }

    private function onlyAdmin($permission)
    {
        if (Yii::$app->user->identity->role !== 'ADMIN') {
            throw new ForbiddenHttpException('Hanya Administrator yang dapat mengelola master data ini.');
        }
        $this->requirePermission($permission);
    }

    private function onlyAdminOrFarmasi($permission)
    {
        $role = Yii::$app->user->identity->role;
        if (!in_array($role, ['ADMIN', 'FARMASI'])) {
            throw new ForbiddenHttpException('Hanya Admin atau Petugas Farmasi yang dapat mengelola master obat.');
        }
        $this->requirePermission($permission);
    }
}
