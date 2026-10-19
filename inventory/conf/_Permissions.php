<?php
/*  PERMISOS POR ROL: qué acciones puede hacer el usuario en sesión en cada sección.

    Salen de permissions_roles: las acciones del catálogo (permissions) que tiene
    el rol del usuario en su sucursal activa. La sección se nombra por
    sections.code ('entradas', 'salidas', 'stock', 'reportes', 'dashboard',
    'administrador' = Catálogo, 'configuracion-accesos'...) y la acción por
    type_permissions.code ('ver', 'agregar', 'editar', 'cancelar', 'eliminar',
    'subir-comprobante', 'agregar-conteo', 'cancelar-conteo', 'imprimir').
    El Super Admin las tiene todas, en todas las secciones.

    Para entrar a una sección basta con tener una acción en ella: es la misma
    regla del menú (acceso/mdl/mdl-access.php::getAccessibleSections).

      page()        en la página, antes de pintar: sin acciones, de regreso a Inicio.
      script()      deja las acciones en el navegador (PERMISSIONS y can()).
      guard()       en el ctrl, antes de despachar el opc.
      can()         donde se arman botones.
      rowActions()  quita de una fila los botones que el rol no puede usar.
      superAdmin()  ¿el usuario en sesión es Super Admin? (elige empresa).
      sectionOn()   ¿la sección está encendida? Apagada no entra nadie (Traspasos).
*/
require_once __DIR__ . '/_CRUD.php';

class Permissions extends CRUD {

    private static $db;
    private static $cache = [];

    // Acciones del usuario en sesión en una sección. Sin sesión o sin sucursal, ninguna.
    public static function actions($section) {
        if (!array_key_exists($section, self::$cache)) {
            self::$cache[$section] = self::db()->loadActions($section);
        }
        return self::$cache[$section];
    }

    public static function can($section, $action) {
        return in_array($action, self::actions($section), true);
    }

    // El Super Admin no depende de la sucursal: entra a todas las empresas.
    public static function superAdmin() {
        $userId = (int) ($_SESSION['user_id'] ?? $_SESSION['IDU'] ?? 0);

        return $userId > 0 && self::db()->isSuperAdmin([$userId]);
    }

    public static function page($section) {
        $actions = self::actions($section);

        if (empty($actions)) {
            header('Location: ' . self::homeUrl());
            exit();
        }

        return $actions;
    }

    // ¿La sección y su módulo están encendidos (Accesos)? page() deja pasar al Super Admin
    // aunque la sección esté apagada; esto no: apagada, nadie la usa.
    public static function sectionOn($section) {
        return self::db()->isSectionOn([$section]);
    }

    public static function script($actions) {
        return '<script>'
            . 'const PERMISSIONS = ' . json_encode(array_values($actions)) . ';'
            . 'const can = (action) => PERMISSIONS.includes(action);'
            . '</script>';
    }

    /*  $rules[$opc] dice qué acción hace falta:
            'agregar'                          esa acción en la sección del ctrl
            ['editar', 'cancelar']             cualquiera de esas
            ['administrador' => 'agregar',
             'entradas' => ['agregar', 'editar']]   cualquiera, en esas secciones
        '*' es cualquier acción. Un opc sin regla solo pide poder entrar a la
        sección del ctrl. Regresa null si puede o la respuesta 403. */
    public static function guard($section, $opc, $rules) {
        $rule = $rules[$opc] ?? '*';

        if (!is_array($rule) || array_values($rule) === $rule) {
            $rule = [$section => $rule];
        }

        foreach ($rule as $sec => $needed) {
            foreach ((array) $needed as $action) {
                $allowed = $action === '*' ? !empty(self::actions($sec)) : self::can($sec, $action);
                if ($allowed) return null;
            }
        }

        return ['status' => 403, 'message' => 'Tu rol no tiene permiso para esta acción.'];
    }

    // Reglas de un ctrl de catálogos donde cada entidad tiene addX, editX, sortX,
    // statusX (dar de baja) y deleteX.
    public static function crud($entities) {
        $rules = [];

        foreach ($entities as $entity) {
            $rules["add{$entity}"]    = 'agregar';
            $rules["edit{$entity}"]   = 'editar';
            $rules["sort{$entity}"]   = 'editar';
            $rules["status{$entity}"] = 'cancelar';
            $rules["delete{$entity}"] = 'eliminar';
        }

        return $rules;
    }

    // Se decide por el método JS del onclick: editX / openEditX = editar,
    // statusX / toggleX = dar de baja (cancelar), deleteX = eliminar. Los demás
    // (ver el detalle, abrir) se quedan.
    public static function rowActions($section, $buttons) {
        return array_values(array_filter($buttons, function ($button) use ($section) {
            if (!preg_match('/\.([A-Za-z_]+)\s*\(/', (string) ($button['onclick'] ?? ''), $m)) return true;

            $action = self::actionOfMethod($m[1]);
            return $action === null || self::can($section, $action);
        }));
    }

    private static function actionOfMethod($method) {
        if (preg_match('/^(edit|openEdit)/', $method))  return 'editar';
        if (preg_match('/^(status|toggle)/', $method)) return 'cancelar';
        if (preg_match('/^delete/', $method))          return 'eliminar';
        return null;
    }

    // Inicio (las cards de módulos). Sale de la ruta de la página para que
    // también sirva cuando el proyecto cuelga de una subcarpeta.
    private static function homeUrl() {
        $path = (string) ($_SERVER['SCRIPT_NAME'] ?? '');
        $i    = strpos($path, '/inventory/');

        return ($i !== false ? substr($path, 0, $i) : '') . '/inventory/modulos/';
    }

    private static function db() {
        if (!self::$db) self::$db = new self();
        return self::$db;
    }

    // -- Consultas --

    private function loadActions($section) {
        $userId   = (int) ($_SESSION['user_id'] ?? $_SESSION['IDU'] ?? 0);
        $branchId = (int) ($_SESSION['branch_id'] ?? 0);
        if ($userId <= 0 || $branchId <= 0) return [];

        $rows = $this->isSuperAdmin([$userId])
            ? $this->allActions()
            : $this->roleActions([$userId, $branchId, $section]);

        return array_column($rows, 'code');
    }

    // Mismo criterio que el menú: acceso/mdl/mdl-access.php::userIsSuperAdmin.
    private function isSuperAdmin($array) {
        // [user_id]
        $query = "
            SELECT 1
            FROM fayxzvov_erp.users_braches ub
            JOIN fayxzvov_erp.roles r ON r.id = ub.role_id AND r.is_active = 1
            WHERE ub.user_id = ?
                AND r.code = 'superadmin'
            LIMIT 1
        ";
        return !empty($this->_Read($query, $array));
    }

    private function isSectionOn($array) {
        // [section_code]
        $query = "
            SELECT 1
            FROM fayxzvov_erp.sections s
            JOIN fayxzvov_erp.modules m ON m.id = s.module_id AND m.is_active = 1
            WHERE s.code = ? AND s.is_active = 1
            LIMIT 1
        ";
        return !empty($this->_Read($query, $array));
    }

    private function allActions() {
        $query = "
            SELECT code
            FROM fayxzvov_erp.type_permissions
            WHERE is_active = 1 AND code IS NOT NULL
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    // Acciones encendidas (la acción, su tipo, la sección y su módulo) que el rol
    // del usuario tiene en la sección, en esa sucursal.
    private function roleActions($array) {
        // [user_id, branch_id, section_code]
        $query = "
            SELECT DISTINCT tp.code
            FROM fayxzvov_erp.users_braches ub
            JOIN fayxzvov_erp.roles r              ON r.id = ub.role_id AND r.is_active = 1
            JOIN fayxzvov_erp.permissions_roles pr ON pr.role_id = r.id
            JOIN fayxzvov_erp.permissions p        ON p.id = pr.permission_id AND p.is_active = 1
            JOIN fayxzvov_erp.type_permissions tp  ON tp.id = p.type_permission_id AND tp.is_active = 1
            JOIN fayxzvov_erp.sections s           ON s.id = p.section_id AND s.is_active = 1
            JOIN fayxzvov_erp.modules m            ON m.id = s.module_id AND m.is_active = 1
            WHERE ub.user_id = ? AND ub.branch_id = ?
                AND s.code = ?
                AND tp.code IS NOT NULL
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }
}
