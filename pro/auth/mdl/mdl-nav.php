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

    /*  El modulo de la seccion cuya ruta es la pagina. Gana sobre modules.route:
        una seccion puede vivir en otra carpeta que su modulo (catalogo esta en
        app/catalogo y pertenece a POS). [path] -> module_id o 0. */
    function getModuleBySectionRoute($array) {
        $query = "
            SELECT s.module_id
            FROM {$this->bd}sections s
            INNER JOIN {$this->bd}modules m ON m.id = s.module_id AND m.is_active = 1
            WHERE s.is_active = 1
              AND TRIM(BOTH '/' FROM s.route) = ?
            LIMIT 1
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? 0 : (int) $sql[0]['module_id'];
    }

    // -- Sucursales de la barra --

    /*  Como listBranchesByUser del login (mdl-auth.php), con ubicacion y estado.
        [user_id, company_id, is_owner]: el dueno ve todas las de su empresa; los demas,
        solo las que tienen asignadas en users_braches con un rol activo. */
    function listNavBranches($array) {
        $query = "
            SELECT
                b.id,
                b.name,
                b.ubication,
                b.is_active,
                ub.role_id,
                r.name AS rol
            FROM {$this->bd}branches b
            LEFT JOIN {$this->bd}users_braches ub ON ub.branch_id = b.id AND ub.user_id = ?
            LEFT JOIN {$this->bd}roles r ON r.id = ub.role_id AND r.is_active = 1
            WHERE b.company_id = ?
              AND b.is_active = 1
              AND (? = 1 OR r.id IS NOT NULL)
            ORDER BY b.name ASC
        ";

        return $this->_Read($query, $array);
    }

    // -- Temas --

    // Todo el catalogo activo (para root).
    function listThemes() {
        $query = "
            SELECT code, name, tipo, color, image, accent, primary_color, secondary_color,
                   sidebar_color, scheme, mode, badge, is_default, orden
            FROM {$this->bd}themes
            WHERE is_active = 1
            ORDER BY orden ASC, id ASC
        ";

        return $this->_Read($query, null);
    }

    // Los temas por defecto mas los que la empresa habilito en company_themes. [company_id]
    function listThemesByCompany($array) {
        $query = "
            SELECT DISTINCT t.id, t.code, t.name, t.tipo, t.color, t.image, t.accent, t.primary_color,
                   t.secondary_color, t.sidebar_color, t.scheme, t.mode, t.badge, t.is_default, t.orden
            FROM {$this->bd}themes t
            LEFT JOIN {$this->bd}company_themes ct ON ct.theme_id = t.id AND ct.company_id = ?
            WHERE t.is_active = 1
              AND (t.is_default = 1 OR ct.id IS NOT NULL)
            ORDER BY t.orden ASC, t.id ASC
        ";

        return $this->_Read($query, $array);
    }

    // [user_id] -> el codigo guardado o null.
    function getUserTheme($array) {
        $sql = $this->_Read("SELECT theme_code FROM {$this->bd}users WHERE id = ? LIMIT 1", $array);

        return empty($sql) ? null : $sql[0]['theme_code'];
    }

    // [code, user_id]
    function setUserTheme($array) {
        return $this->_CUD("UPDATE {$this->bd}users SET theme_code = ? WHERE id = ?", $array);
    }

    // [code]
    function themeExists($array) {
        $sql = $this->_Read("SELECT id FROM {$this->bd}themes WHERE code = ? AND is_active = 1 LIMIT 1", $array);

        return !empty($sql);
    }
}
?>
