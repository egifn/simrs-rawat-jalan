<?php

namespace app\commands;

use app\components\LabOutboxDispatcher;
use yii\console\Controller;

class LabOutboxController extends Controller
{
    public function actionDispatch($limit = 50)
    {
        $delivered = (new LabOutboxDispatcher())->dispatchPending($limit);
        $this->stdout("Berhasil mengirim {$delivered} event laboratorium.\n");
    }
}
