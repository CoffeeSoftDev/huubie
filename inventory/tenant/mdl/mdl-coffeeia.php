<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

// Configuración global de coffeeIA: una sola fila (id = 1). Quien la usa es
// conf/_IaOllama.php, que la lee en cada pregunta de los chats de inventory.
class mdl extends CRUD {

    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_erp.';
    }

    function getCoffeeIAConfig($array) {
        $query = "
            SELECT id, tone, model, effort, vision_model, updated_at
            FROM {$this->bd}coffeeia_config
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function updateCoffeeIAConfig($array) {
        return $this->_Update([
            'table'  => "{$this->bd}coffeeia_config",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }
}
