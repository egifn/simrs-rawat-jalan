<?php

namespace app\components;

class JwtValidationData extends \sizeg\jwt\JwtValidationData
{
    public function init()
    {
        $this->validationData->setIssuer('http://simrs-api.local');
        $this->validationData->setAudience('http://simrs-client.local');
        $this->validationData->setId('SIMRS-JWT-ID');
        parent::init();
    }
}
