<?php
require_once __DIR__ . '/../../core/database/_CRUD.php';
require_once __DIR__ . '/../../core/helpers/_Utileria.php';

class mdl extends CRUD {
    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        // Sin prefijo: las tablas viven en la base del .env (DB_NAME).
        $this->bd   = '';
    }

    function getNavUser($array) {
        $query = "
            SELECT
                u.id,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))) AS user,
                u.email,
                u.photo,
                u.color
            FROM {$this->bd}users u
            WHERE u.id = ?
            LIMIT 1
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? null : $sql[0];
    }

    // La ruta mas larga primero: 'app/developer' le gana a 'app' al resolver la pagina.
    function listModulesForMatch() {
        $query = "
            SELECT id, name, route
            FROM {$this->bd}modules
            WHERE is_active = 1 AND route IS NOT NULL AND route <> ''
            ORDER BY CHAR_LENGTH(route) DESC
        ";

        return $this->_Read($query, null);
    }
}
?>
