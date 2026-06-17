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

    // Módulos activos con AL MENOS una sección accesible para el rol del usuario
    // en su sucursal activa (users_braches -> permissions -> sections). Así el
    // dashboard solo muestra módulos en los que el rol puede entrar a algo.
    function qAccessibleModules($array) {
        // [user_id, branch_id]
        $query = "
            SELECT DISTINCT m.id, m.name, m.code, m.icon, m.description, m.route, m.orden
            FROM {$this->bd}modules m
            JOIN {$this->bd}sections s       ON s.module_id  = m.id AND s.is_active = 1
            JOIN {$this->bd}permissions p    ON p.section_id = s.id AND p.is_active = 1
            JOIN {$this->bd}users_braches ub ON ub.role_id   = p.role_id
            WHERE m.is_active = 1 AND ub.user_id = ? AND ub.branch_id = ?
            ORDER BY m.orden ASC, m.id ASC
        ";
        $r = $this->_Read($query, $array);
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
