<?php
require_once __DIR__ . '/../../../core/database/_CRUD.php';
require_once __DIR__ . '/../../../core/helpers/_Utileria.php';

// Configuración global de coffeeIA: una sola fila (id = 1). En inventory la lee
// conf/_IaOllama.php en cada pregunta; en pro, el CoffeeIA que la use.
class mdl extends CRUD {

    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        // Sin prefijo: la base del .env (DB_NAME).
        $this->bd   = '';
    }

    function getCoffeeIAConfig($array) {
        $query = "
            SELECT id, active, tone, model, effort, vision_model, updated_at
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
