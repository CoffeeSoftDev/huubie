<?php
/*  ACCESO POR SECCION.

    Un modulo se divide en secciones (tabla sections) y cada seccion es una
    pagina. Alguien ve una seccion cuando su rol en la sucursal activa tiene al
    menos una accion concedida en ella (permissions_roles). root ve todas las
    encendidas: su acceso es total y no lleva filas.

    Se pregunta por el code de la seccion y no por su id: el id cambia de una
    base a otra, el code no.

    Es la misma regla con la que el sidebar arma su menu (sections()), asi que
    lo que se ve en el menu y lo que deja entrar la pagina no pueden discrepar.

    Y antes que el rol va el PLAN (core/security/_Plan.php): la seccion tiene que
    ser de un modulo que la empresa contrato, y la empresa tiene que estar al
    corriente. Vale tambien para root cuando entro a una empresa: la ve como su
    dueño, con lo que esa empresa pago y nada mas. */
require_once __DIR__ . '/../database/_CRUD.php';
require_once __DIR__ . '/_Session.php';
require_once __DIR__ . '/_Plan.php';

class Permission extends CRUD {
    private static $db = null;

    private static function db() {
        if (self::$db === null) self::$db = new self;
        return self::$db;
    }

    private static function isRoot() {
        return !empty($_SESSION['is_root']);
    }

    /*  root, o su rol lo concede. Espera tres placeholders: root, user_id y
        branch_id.

        Developer es SOLO de root, diga lo que diga permissions_roles: es la
        administracion de la plataforma (empresas, planes, cobros, accesos de
        todos). Un rol de empresa -- ni el Dueño -- no entra aunque alguien le
        marque esos permisos por error en Accesos. */
    private static function canSee($alias) {
        return "(? = 1 OR (COALESCE(m.code, '') <> 'developer' AND " . self::grantedTo($alias) . "))";
    }

    private static function who($userId) {
        return [self::isRoot() ? 1 : 0, $userId, (int) ($_SESSION['branch_id'] ?? 0)];
    }

    static function section($code) {
        $userId = Session::user();
        if ($userId === null || $code === '') return false;

        $sql = self::db()->_Read("
            SELECT s.module_id, m.code AS module_code
            FROM sections s
            INNER JOIN modules m ON m.id = s.module_id AND m.is_active = 1
            WHERE s.code = ?
                AND s.is_active = 1
                AND " . self::canSee('s') . "
            LIMIT 1
        ", array_merge([$code], self::who($userId)));

        return !empty($sql) && Plan::allows($sql[0]['module_id'], $sql[0]['module_code']);
    }

    // 0 si no existe o esta apagado.
    static function moduleId($code) {
        $sql = self::db()->_Read("SELECT id FROM modules WHERE code = ? AND is_active = 1 LIMIT 1", [$code]);
        return empty($sql) ? 0 : (int) $sql[0]['id'];
    }

    // Las secciones que ve en un modulo, en su orden. module_id = 0 trae las de todos.
    static function sections($moduleId) {
        $userId = Session::user();
        if ($userId === null) return [];

        $sql = self::db()->_Read("
            SELECT s.id, s.name, s.code, s.icon, s.route, s.module_id, s.submodule_id, m.code AS module_code
            FROM sections s
            INNER JOIN modules m ON m.id = s.module_id AND m.is_active = 1
            WHERE s.is_active = 1
                AND (? = 0 OR s.module_id = ?)
                AND " . self::canSee('s') . "
            ORDER BY m.orden IS NULL, m.orden, s.orden IS NULL, s.orden, s.id
        ", array_merge([$moduleId, $moduleId], self::who($userId)));

        return array_values(array_filter(is_array($sql) ? $sql : [], function ($section) {
            return Plan::allows($section['module_id'], $section['module_code']);
        }));
    }

    /*  Los modulos contratados que le tocan a quien pregunta: lo que pintan el
        rail y el inicio. El dueño y root los ven todos. Los demas, aquellos
        donde su rol tiene alguna seccion; un modulo que aun no tiene secciones
        no puede concederse a nadie, y esconderlo dejaria a la empresa sin ver
        lo que contrato.

        Se listan aunque la empresa no este al corriente (Plan::state()): el
        inicio los enseña con candado. */
    static function modules() {
        $modules = Plan::modules();

        if (self::isRoot() || !empty($_SESSION['is_owner'])) return $modules;

        $userId = Session::user();
        if ($userId === null) return [];

        $withSections = self::db()->_Read("SELECT DISTINCT module_id FROM sections WHERE is_active = 1");
        $withSections = array_column(is_array($withSections) ? $withSections : [], 'module_id');

        // Por rol y sin pasar por el plan: aqui solo importa a cuales tiene derecho.
        $granted = self::db()->_Read("
            SELECT DISTINCT s.module_id
            FROM sections s
            WHERE s.is_active = 1 AND " . self::grantedTo('s'), [$userId, (int) ($_SESSION['branch_id'] ?? 0)]);
        $granted = array_column(is_array($granted) ? $granted : [], 'module_id');

        return array_values(array_filter($modules, function ($module) use ($withSections, $granted) {
            return !in_array($module['id'], $withSections) || in_array($module['id'], $granted);
        }));
    }

    // Para las paginas: sin sesion al login; sin acceso, a su inicio.
    // $toRoot = el camino de la pagina a pro/ ('../../' desde app/modulo/).
    static function page($code, $toRoot) {
        if (Session::user() === null) {
            header('Location: ' . $toRoot . 'index.php');
            exit;
        }

        if (!self::section($code)) {
            header('Location: ' . $toRoot . $_SESSION['home']);
            exit;
        }
    }

    // Para los ctrl: corta con el mismo JSON que contestan ellos.
    static function demand($code) {
        if (Session::user() === null) {
            echo json_encode(['status' => 401, 'message' => 'Tu sesión terminó. Vuelve a iniciar sesión.']);
            exit;
        }

        if (!self::section($code)) {
            echo json_encode(['status' => 403, 'message' => 'No tienes acceso a esta sección.']);
            exit;
        }
    }

    /*  El final de los ctrl de una seccion: permiso primero y luego la operacion.
        Solo se despachan los metodos publicos que declara el propio ctrl: los
        del modelo y los de CRUD tambien son publicos y no son operaciones. */
    static function dispatch($obj, $section) {
        header('Content-Type: application/json; charset=utf-8');

        self::demand($section);

        $opc = (string) $_POST['opc'];
        $ok  = $opc !== '' && strpos($opc, '__') !== 0 && method_exists($obj, $opc);

        if ($ok) {
            $method = new ReflectionMethod($obj, $opc);
            $ok     = $method->isPublic() && $method->getDeclaringClass()->getName() === get_class($obj);
        }

        if (!$ok) {
            echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
            exit;
        }

        echo json_encode($obj->{$opc}());
    }

    // ¿Puede hacer esa accion ('show', 'create', 'update', 'cancel', 'delete', 'print') en la seccion?
    static function can($sectionCode, $actionCode) {
        return in_array($actionCode, self::actions($sectionCode), true);
    }

    // Los codes de las acciones concedidas en la seccion, en la sucursal activa.
    // root trae todas las que la seccion tiene dadas de alta.
    static function actions($sectionCode) {
        $userId = Session::user();
        if ($userId === null || $sectionCode === '') return [];

        $sql = self::db()->_Read("
            SELECT DISTINCT tp.code
            FROM sections s
            INNER JOIN modules m           ON m.id = s.module_id AND m.is_active = 1
            INNER JOIN permissions p       ON p.section_id = s.id AND p.is_active = 1
            INNER JOIN type_permissions tp ON tp.id = p.type_permission_id AND tp.is_active = 1
            WHERE s.code = ?
                AND s.is_active = 1
                AND (? = 1 OR EXISTS (
                        SELECT 1
                        FROM users_braches ub
                        INNER JOIN roles r              ON r.id = ub.role_id AND r.is_active = 1
                        INNER JOIN permissions_roles pr ON pr.role_id = r.id
                        WHERE ub.user_id = ? AND ub.branch_id = ?
                            AND pr.permission_id = p.id
                    ))
        ", [$sectionCode, self::isRoot() ? 1 : 0, $userId, (int) ($_SESSION['branch_id'] ?? 0)]);

        return is_array($sql) ? array_column($sql, 'code') : [];
    }

    // ¿El rol del usuario en la sucursal activa tiene alguna accion en la seccion?
    // Espera dos placeholders: user_id y branch_id.
    private static function grantedTo($alias) {
        return "EXISTS (
                    SELECT 1
                    FROM users_braches ub
                    INNER JOIN roles r              ON r.id = ub.role_id AND r.is_active = 1
                    INNER JOIN permissions_roles pr ON pr.role_id = r.id
                    INNER JOIN permissions p        ON p.id = pr.permission_id AND p.is_active = 1
                    INNER JOIN type_permissions tp  ON tp.id = p.type_permission_id AND tp.is_active = 1
                    WHERE ub.user_id = ? AND ub.branch_id = ?
                        AND p.section_id = {$alias}.id
                )";
    }
}
?>
