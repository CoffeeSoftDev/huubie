<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

// Modelo del dashboard de Módulos: lee modules/submodules/sections de fayxzvov_erp
// para armar el navegador de tarjetas (módulo -> submódulos -> secciones del sidebar).
class mdl extends CRUD {

    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_erp.';
    }

    // Módulos activos (cards de primer nivel).
    function qModules() {
        $query = "
            SELECT id, name, code, icon, description, route, orden
            FROM {$this->bd}modules
            WHERE is_active = 1
            ORDER BY orden ASC, id ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    // Submódulos activos de un módulo (cards de segundo nivel).
    function qSubmodulesByModule($array) {
        // [module_id]
        $query = "
            SELECT id, name, code, icon, description, route, orden, module_id
            FROM {$this->bd}submodules
            WHERE is_active = 1 AND module_id = ?
            ORDER BY orden ASC, id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Cuenta de submódulos por módulo (para mostrar en la card "N submódulos").
    function qSubmoduleCount($array) {
        // [module_id]
        $query = "SELECT COUNT(*) AS n FROM {$this->bd}submodules WHERE is_active = 1 AND module_id = ?";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? (int) $r[0]['n'] : 0;
    }

    // Un módulo por id (para el encabezado al entrar a sus submódulos).
    function qModule($array) {
        // [id]
        $query = "SELECT id, name, code, icon, route FROM {$this->bd}modules WHERE id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }
}
