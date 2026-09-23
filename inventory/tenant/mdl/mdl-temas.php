<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

// Temas del navbar: el lado de quien los publica. El lado de quien los usa
// vive en acceso/mdl/mdl-access.php y solo lee los ACTIVOS.
class mdl extends CRUD {

    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_erp.';
    }

    function listThemes($array) {
        $query = "
            SELECT
                t.id, t.code, t.name, t.tipo, t.color, t.image, t.accent, t.primary_color, t.secondary_color, t.scheme, t.mode, t.badge,
                t.is_default, t.orden, t.is_active,
                (SELECT COUNT(*) FROM {$this->bd}users u WHERE u.theme_code = t.code) AS chosen_by
            FROM {$this->bd}themes t
            WHERE t.is_active = ?
            ORDER BY t.orden ASC, t.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function getThemeById($array) {
        $query = "
            SELECT id, code, name, tipo, color, image, accent, primary_color, secondary_color, scheme, mode, badge, is_default, orden, is_active
            FROM {$this->bd}themes
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // [code, id]: el code es la llave con la que users.theme_code apunta al tema.
    function existsThemeByCode($array) {
        $query = "SELECT id FROM {$this->bd}themes WHERE code = ? AND id <> ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r);
    }

    function getThemeCounts($array) {
        $query = "SELECT COUNT(*) AS total FROM {$this->bd}users WHERE theme_code = ?";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? (int) $r[0]['total'] : 0;
    }

    function createTheme($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}themes",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateTheme($array) {
        return $this->_Update([
            'table'  => "{$this->bd}themes",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    /* Suelta a quien tenía elegido un tema que se apaga. Se escribe NULL y no
       el code del de por defecto: NULL significa "sigo el tema de la casa", así
       el próximo cambio de temporada también les llega. */
    function updateThemeUsers($array) {
        $query = "UPDATE {$this->bd}users SET theme_code = NULL WHERE theme_code = ?";
        return $this->_CUD($query, $array);
    }

    /* Apaga la marca de por defecto en todos. is_default no puede llevar UNIQUE
       (está llena de ceros), así que la exclusividad la garantiza correr esto
       SIEMPRE antes de marcar el nuevo. El 1 va como placeholder porque _CUD
       revisa $values[0] y truena con un arreglo vacío. */
    function updateThemeDefault() {
        $query = "UPDATE {$this->bd}themes SET is_default = 0 WHERE is_default = ?";
        return $this->_CUD($query, [1]);
    }
}
