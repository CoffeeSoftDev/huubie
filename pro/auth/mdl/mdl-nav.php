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
                u.color,
                u.theme_code
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
            SELECT id, name, code, icon, route
            FROM {$this->bd}modules
            WHERE is_active = 1 AND route IS NOT NULL AND route <> ''
            ORDER BY CHAR_LENGTH(route) DESC
        ";

        return $this->_Read($query, null);
    }

    /*  El modulo de la seccion cuya ruta es la pagina. Gana sobre modules.route:
        una seccion puede vivir en otra carpeta que su modulo (catalogo esta en
        app/catalogo y es del modulo Pedidos, igual que cortes). [path] -> fila o null. */
    function getModuleBySectionRoute($array) {
        $query = "
            SELECT m.id, m.name, m.code, m.icon, m.route
            FROM {$this->bd}sections s
            INNER JOIN {$this->bd}modules m ON m.id = s.module_id AND m.is_active = 1
            WHERE s.is_active = 1
                AND TRIM(BOTH '/' FROM s.route) = ?
            LIMIT 1
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? null : $sql[0];
    }

    function getModuleByCode($array) {
        $query = "
            SELECT id, name, code, icon, route
            FROM {$this->bd}modules
            WHERE code = ? AND is_active = 1
            LIMIT 1
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? null : $sql[0];
    }

    function listSubmodulesByModule($array) {
        $query = "
            SELECT id, name, icon
            FROM {$this->bd}submodules
            WHERE module_id = ? AND is_active = 1
            ORDER BY orden IS NULL, orden, id
        ";

        $sql = $this->_Read($query, $array);
        return is_array($sql) ? $sql : [];
    }

    // ¿El dueño ya completo los datos de su empresa? (app/configurar)
    function isCompanySetUp($array) {
        $sql = $this->_Read("SELECT setup_done_at FROM {$this->bd}companies WHERE id = ? LIMIT 1", $array);
        return !empty($sql) && $sql[0]['setup_done_at'] !== null;
    }

    // Sucursales:

    // [user_id, company_id, todas]. todas = 1 para el dueño y para root viendo
    // la empresa: entran a todas las activas. Los demas, a las que tienen con
    // un rol activo. La misma regla de auth/mdl/mdl-auth.php.
    function listBranchesByUser($array) {
        $query = "
            SELECT
                b.id,
                b.name,
                b.ubication,
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

        $sql = $this->_Read($query, $array);
        return is_array($sql) ? $sql : [];
    }

    // Temas de la barra:

    function listThemes() {
        $query = "
            SELECT code, name, tipo, color, image, accent, primary_color, secondary_color, sidebar_color, scheme, mode, badge, is_default
            FROM {$this->bd}themes
            WHERE is_active = 1
            ORDER BY orden ASC, id ASC
        ";

        $sql = $this->_Read($query, null);
        return is_array($sql) ? $sql : [];
    }

    // Los de una empresa: los asignados en company_themes mas el de por defecto,
    // que siempre esta.
    function listThemesByCompany($array) {
        $query = "
            SELECT t.code, t.name, t.tipo, t.color, t.image, t.accent, t.primary_color, t.secondary_color, t.sidebar_color, t.scheme, t.mode, t.badge, t.is_default
            FROM {$this->bd}themes t
            LEFT JOIN {$this->bd}company_themes ct ON ct.theme_id = t.id AND ct.company_id = ?
            WHERE t.is_active = 1
                AND (t.is_default = 1 OR ct.id IS NOT NULL)
            ORDER BY t.orden ASC, t.id ASC
        ";

        $sql = $this->_Read($query, $array);
        return is_array($sql) ? $sql : [];
    }

    // [theme_code, user_id]
    function updateUserTheme($array) {
        $query = "UPDATE {$this->bd}users SET theme_code = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }
}
?>
