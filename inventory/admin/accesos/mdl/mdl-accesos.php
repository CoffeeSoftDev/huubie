<?php
require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';

class mdl extends CRUD {

    public $util;
    public $bd;

    // Módulos que nunca salen en los permisos de un rol de la empresa: son del
    // Super Admin (DEV, root, tenant). Darlos desde aquí abriría la plataforma.
    const PLATFORM_MODULES = "'dev', 'root', 'tenant'";

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_erp.';
    }

    /* ====================== Empresa ====================== */

    function qCompany($array) {
        $query = "SELECT id, name FROM {$this->bd}companies WHERE id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // Los números del Resumen: usuarios (activos y todos), roles, sucursales
    // activas y movimientos de la bitácora en el día.
    function qSummaryCounts($array) {
        // [company_id x 5]
        $query = "
            SELECT
                (SELECT COUNT(*) FROM {$this->bd}users u WHERE u.company_id = ? AND u.status = 'active') AS usuarios_activos,
                (SELECT COUNT(*) FROM {$this->bd}users u WHERE u.company_id = ?)                         AS usuarios_total,
                (SELECT COUNT(*) FROM {$this->bd}roles r
                  WHERE r.company_id = ? AND r.is_system = 0 AND r.is_active = 1)                         AS roles,
                (SELECT COUNT(*) FROM {$this->bd}branches b WHERE b.company_id = ? AND b.is_active = 1)  AS sucursales,
                (SELECT COUNT(*) FROM {$this->bd}audit_log a
                  WHERE a.company_id = ? AND a.created_at >= CURDATE())                                   AS movimientos_hoy
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : [];
    }

    /* ====================== Sucursales (branches) ====================== */

    // Sucursales de la empresa filtradas por estado (para la tabla), con el
    // nombre de su responsable.
    function qBranches($array) {
        // [company_id, is_active]
        $query = "
            SELECT
                b.id, b.name, b.ubication, b.phone, b.email, b.manager_id, b.logo, b.is_active, b.company_id,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))) AS manager_name
            FROM {$this->bd}branches b
            LEFT JOIN {$this->bd}users u ON u.id = b.manager_id
            WHERE b.company_id = ? AND b.is_active = ?
            ORDER BY b.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Sucursales activas de la empresa en formato {id, valor} para selects.
    function qBranchesForSelect($array) {
        // [company_id]
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}branches
            WHERE company_id = ? AND is_active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qBranch($array) {
        // [id, company_id]
        $query = "
            SELECT
                b.id, b.name, b.ubication, b.phone, b.email, b.manager_id, b.logo, b.is_active, b.company_id,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))) AS manager_name
            FROM {$this->bd}branches b
            LEFT JOIN {$this->bd}users u ON u.id = b.manager_id
            WHERE b.id = ? AND b.company_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qInsertBranch($array) {
        // [name, ubication, phone, email, manager_id, company_id]
        $query = "
            INSERT INTO {$this->bd}branches (name, ubication, phone, email, manager_id, company_id, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdateBranch($array) {
        // [name, ubication, phone, email, manager_id, id, company_id]
        $query = "
            UPDATE {$this->bd}branches
            SET name = ?, ubication = ?, phone = ?, email = ?, manager_id = ?
            WHERE id = ? AND company_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdateBranchLogo($array) {
        // [logo, id, company_id]
        $query = "UPDATE {$this->bd}branches SET logo = ? WHERE id = ? AND company_id = ?";
        return $this->_CUD($query, $array);
    }

    function qSetBranchActive($array) {
        // [is_active, id, company_id]
        $query = "UPDATE {$this->bd}branches SET is_active = ? WHERE id = ? AND company_id = ?";
        return $this->_CUD($query, $array);
    }

    function qBranchNameExists($array) {
        // [name, company_id, id que se excluye (0 = ninguno)]
        $query = "SELECT id FROM {$this->bd}branches WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND company_id = ? AND id <> ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r);
    }

    /* ====================== Roles ====================== */

    // Roles que se asignan por sucursal en Accesos: los activos de la empresa y
    // los del sistema (is_system = 1, sin empresa: hoy el Dueño). Los del sistema
    // se asignan pero no se editan ni enseñan sus permisos (ver qCompanyRoles).
    // El Super Admin nunca se asigna desde aquí (ni el 1 ni otro rol con su
    // código, que daría el mismo acceso total). El Dueño solo lo asigna un Dueño
    // o un Super Admin (segundo parámetro = 1).
    function qRolesForSelect($array) {
        // [company_id, puede_asignar_dueno]
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}roles
            WHERE (company_id = ? OR is_system = 1) AND is_active = 1 AND id <> 1
                AND (code IS NULL OR code <> 'superadmin')
                AND (? = 1 OR code IS NULL OR code <> 'dueno')
            ORDER BY is_system DESC, id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Rango del usuario en Accesos: Super Admin (el rol en cualquier sucursal) y
    // Dueño (users.is_owner o el rol Dueño en alguna sucursal).
    function qUserRank($array) {
        // [user_id]
        $query = "
            SELECT
                EXISTS (
                    SELECT 1
                    FROM {$this->bd}users_braches ub
                    JOIN {$this->bd}roles r ON r.id = ub.role_id AND r.is_active = 1
                    WHERE ub.user_id = u.id AND r.code = 'superadmin'
                ) AS is_superadmin,
                (COALESCE(u.is_owner, 0) = 1 OR EXISTS (
                    SELECT 1
                    FROM {$this->bd}users_braches ub
                    JOIN {$this->bd}roles r ON r.id = ub.role_id AND r.is_active = 1
                    WHERE ub.user_id = u.id AND r.code = 'dueno'
                )) AS is_dueno
            FROM {$this->bd}users u
            WHERE u.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : ['is_superadmin' => 0, 'is_dueno' => 0];
    }

    // Los roles de la empresa que se configuran en Accesos: solo los suyos
    // (is_system = 0). Los del sistema (Super Admin) no salen ni se cuentan.
    // users = usuarios activos que lo tienen; assignments = todos los que lo
    // tienen, activos o no (con ellos no se puede borrar: la FK de
    // users_braches lo impide).
    function qCompanyRoles($array) {
        // [company_id]
        $modules = self::PLATFORM_MODULES;
        $query = "
            SELECT
                r.id, r.code, r.name, r.description,
                (
                    SELECT COUNT(DISTINCT ub.user_id)
                    FROM {$this->bd}users_braches ub
                    JOIN {$this->bd}users u ON u.id = ub.user_id AND u.status = 'active'
                    WHERE ub.role_id = r.id
                ) AS users,
                (SELECT COUNT(DISTINCT ub.user_id) FROM {$this->bd}users_braches ub WHERE ub.role_id = r.id) AS assignments,
                (
                    SELECT COUNT(*)
                    FROM {$this->bd}permissions_roles pr
                    JOIN {$this->bd}permissions p       ON p.id = pr.permission_id AND p.is_active = 1
                    JOIN {$this->bd}type_permissions tp ON tp.id = p.type_permission_id AND tp.is_active = 1
                    JOIN {$this->bd}sections s          ON s.id = p.section_id AND s.is_active = 1
                    JOIN {$this->bd}modules m           ON m.id = s.module_id AND m.is_active = 1 AND m.code NOT IN ({$modules})
                    WHERE pr.role_id = r.id
                ) AS actions
            FROM {$this->bd}roles r
            WHERE r.company_id = ? AND r.is_system = 0 AND r.is_active = 1
            ORDER BY r.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Un rol de la empresa. Uno del sistema o de otra empresa no existe aquí.
    function qCompanyRole($array) {
        // [id, company_id]
        $query = "
            SELECT id, code, name, description,
                   (SELECT COUNT(DISTINCT ub.user_id) FROM {$this->bd}users_braches ub WHERE ub.role_id = r.id) AS assignments
            FROM {$this->bd}roles r
            WHERE r.id = ? AND r.company_id = ? AND r.is_system = 0 AND r.is_active = 1
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qRoleNameExists($array) {
        // [name, company_id, id que se excluye (0 = ninguno)]
        $query = "SELECT id FROM {$this->bd}roles WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND company_id = ? AND id <> ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r);
    }

    function qInsertRole($array) {
        // [code, name, description, company_id]
        $query = "
            INSERT INTO {$this->bd}roles (code, name, description, is_system, is_active, company_id, created_at)
            VALUES (?, ?, ?, 0, 1, ?, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdateRole($array) {
        // [name, description, id, company_id]
        $query = "UPDATE {$this->bd}roles SET name = ?, description = ? WHERE id = ? AND company_id = ? AND is_system = 0";
        return $this->_CUD($query, $array);
    }

    function qDeleteRole($array) {
        // [id, company_id]
        $query = "DELETE FROM {$this->bd}roles WHERE id = ? AND company_id = ? AND is_system = 0";
        return $this->_CUD($query, $array);
    }

    function qDeleteRolePermissions($array) {
        // [role_id]
        $query = "DELETE FROM {$this->bd}permissions_roles WHERE role_id = ?";
        return $this->_CUD($query, $array);
    }

    // Roles que tiene el usuario en cualquier sucursal.
    function qUserRoleIds($array) {
        // [user_id]
        $query = "SELECT DISTINCT role_id FROM {$this->bd}users_braches WHERE user_id = ? AND role_id IS NOT NULL";
        $r = $this->_Read($query, $array);
        return is_array($r) ? array_map('intval', array_column($r, 'role_id')) : [];
    }

    // El catálogo de acciones que puede tener un rol de la empresa (acción, tipo,
    // sección y módulo encendidos, sin los módulos de la plataforma), marcando
    // las que ya tiene. role_id = 0 las trae sin marcar.
    function qRoleCatalog($array) {
        // [role_id]
        $modules = self::PLATFORM_MODULES;
        $query = "
            SELECT
                p.id                 AS permission_id,
                p.type_permission_id AS type_id,
                tp.name              AS type_name,
                tp.`order`           AS type_order,
                s.id                 AS section_id,
                s.code               AS section_code,
                s.name               AS section_name,
                s.icon               AS section_icon,
                m.id                 AS module_id,
                m.name               AS module_name,
                m.icon               AS module_icon,
                (pr.id IS NOT NULL)  AS granted
            FROM {$this->bd}permissions p
            JOIN {$this->bd}type_permissions tp ON tp.id = p.type_permission_id AND tp.is_active = 1
            JOIN {$this->bd}sections s          ON s.id = p.section_id AND s.is_active = 1
            JOIN {$this->bd}modules m           ON m.id = s.module_id AND m.is_active = 1 AND m.code NOT IN ({$modules})
            LEFT JOIN {$this->bd}permissions_roles pr ON pr.permission_id = p.id AND pr.role_id = ?
            WHERE p.is_active = 1
            ORDER BY m.orden ASC, m.id ASC, s.orden ASC, s.id ASC, tp.`order` ASC, tp.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qInsertRolePermission($array) {
        // [role_id, permission_id]
        $query = "INSERT INTO {$this->bd}permissions_roles (role_id, permission_id) VALUES (?, ?)";
        return $this->_CUD($query, $array);
    }

    function qDeleteRolePermission($array) {
        // [role_id, permission_id]
        $query = "DELETE FROM {$this->bd}permissions_roles WHERE role_id = ? AND permission_id = ?";
        return $this->_CUD($query, $array);
    }

    /* ====================== Usuarios ====================== */

    function qUsers($array) {
        // [company_id, status]
        $query = "
            SELECT
                u.id,
                u.name,
                u.last_name,
                u.email,
                u.status,
                u.is_owner,
                u.branch_id,
                u.color,
                DATE_FORMAT(u.created_at, '%d/%m/%Y %H:%i') AS created,
                b.name AS branch_name,
                (
                    SELECT GROUP_CONCAT(DISTINCT br.name ORDER BY br.name ASC SEPARATOR ', ')
                    FROM {$this->bd}users_braches ub
                    INNER JOIN {$this->bd}branches br ON br.id = ub.branch_id
                    WHERE ub.user_id = u.id
                ) AS branch_names,
                (
                    SELECT GROUP_CONCAT(DISTINCT ro.name ORDER BY ro.name ASC SEPARATOR ', ')
                    FROM {$this->bd}users_braches ub
                    INNER JOIN {$this->bd}roles ro ON ro.id = ub.role_id
                    WHERE ub.user_id = u.id
                ) AS role_names,
                EXISTS (
                    SELECT 1
                    FROM {$this->bd}users_braches ub
                    JOIN {$this->bd}roles r ON r.id = ub.role_id AND r.is_active = 1
                    WHERE ub.user_id = u.id AND r.code = 'superadmin'
                ) AS is_superadmin,
                (COALESCE(u.is_owner, 0) = 1 OR EXISTS (
                    SELECT 1
                    FROM {$this->bd}users_braches ub
                    JOIN {$this->bd}roles r ON r.id = ub.role_id AND r.is_active = 1
                    WHERE ub.user_id = u.id AND r.code = 'dueno'
                )) AS is_dueno
            FROM {$this->bd}users u
            LEFT JOIN {$this->bd}branches b ON b.id = u.branch_id
            WHERE u.company_id = ? AND u.status = ?
            ORDER BY u.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Usuarios activos de la empresa en formato {id, valor}: el responsable de
    // una sucursal.
    function qUsersForSelect($array) {
        // [company_id]
        $query = "
            SELECT id, TRIM(CONCAT(COALESCE(name, ''), ' ', COALESCE(last_name, ''))) AS valor
            FROM {$this->bd}users
            WHERE company_id = ? AND status = 'active'
            ORDER BY name ASC, last_name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qUser($array) {
        // [id, company_id]
        $query = "
            SELECT id, name, last_name, email, branch_id, is_owner, status, color, photo
            FROM {$this->bd}users
            WHERE id = ? AND company_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qUpdateUserPhoto($array) {
        // [photo, id, company_id]
        $query = "UPDATE {$this->bd}users SET photo = ?, updated_at = NOW() WHERE id = ? AND company_id = ?";
        return $this->_CUD($query, $array);
    }

    function qUserBranchIds($array) {
        // [user_id]
        $query = "
            SELECT branch_id
            FROM {$this->bd}users_braches
            WHERE user_id = ?
            ORDER BY branch_id ASC
        ";
        $r = $this->_Read($query, $array);
        if (!is_array($r) || empty($r)) return [];
        return array_column($r, 'branch_id');
    }

    function qEmailExists($array) {
        // [email, company_id]
        $query = "SELECT id FROM {$this->bd}users WHERE LOWER(email) = LOWER(?) AND company_id = ?";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    function qEmailExistsExcept($array) {
        // [email, company_id, id]
        $query = "SELECT id FROM {$this->bd}users WHERE LOWER(email) = LOWER(?) AND company_id = ? AND id <> ?";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    function qInsertUser($array) {
        // [name, last_name, email, password, branch_id, company_id, color]
        $query = "
            INSERT INTO {$this->bd}users
                (name, last_name, email, password, branch_id, company_id, color, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qLastInsertId() {
        $r = $this->_Read("SELECT LAST_INSERT_ID() AS id", []);
        return (is_array($r) && !empty($r)) ? (int) $r[0]['id'] : 0;
    }

    function qUpdateUser($array) {
        // [name, last_name, email, branch_id, color, id, company_id]
        $query = "
            UPDATE {$this->bd}users
            SET name = ?, last_name = ?, email = ?, branch_id = ?, color = ?, updated_at = NOW()
            WHERE id = ? AND company_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function qDeleteUserBranches($array) {
        // [user_id]
        $query = "DELETE FROM {$this->bd}users_braches WHERE user_id = ?";
        return $this->_CUD($query, $array);
    }

    // Rol que el usuario tiene en cada sucursal, como mapa branch_id => role_id.
    // editUser() borra y reinserta users_braches, asi que necesita esta foto
    // previa para devolver cada fila con el rol que ya tenia.
    function qUserBranchRoles($array) {
        // [user_id]
        $query = "
            SELECT branch_id, role_id
            FROM {$this->bd}users_braches
            WHERE user_id = ?
        ";
        $r = $this->_Read($query, $array);
        if (!is_array($r) || empty($r)) return [];
        return array_column($r, 'role_id', 'branch_id');
    }

    function qInsertUserBranch($array) {
        // [user_id, branch_id, role_id]
        $query = "
            INSERT INTO {$this->bd}users_braches (user_id, branch_id, role_id)
            VALUES (?, ?, ?)
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdateUserPassword($array) {
        // [password, id, company_id]
        $query = "UPDATE {$this->bd}users SET password = ? WHERE id = ? AND company_id = ?";
        return $this->_CUD($query, $array);
    }

    function qSetUserStatus($array) {
        // [status, id, company_id]
        $query = "UPDATE {$this->bd}users SET status = ? WHERE id = ? AND company_id = ?";
        return $this->_CUD($query, $array);
    }

    // Nombres de sucursales y roles de la empresa por id: la bitácora cuenta el
    // antes y el después con nombres, no con números.
    function qBranchNames($array) {
        // [company_id]
        $r = $this->_Read("SELECT id, name FROM {$this->bd}branches WHERE company_id = ?", $array);
        return is_array($r) ? array_column($r, 'name', 'id') : [];
    }

    function qRoleNames() {
        $r = $this->_Read("SELECT id, name FROM {$this->bd}roles", null);
        return is_array($r) ? array_column($r, 'name', 'id') : [];
    }

    /* ====================== Bitácora (audit_log) ====================== */

    // Los movimientos del periodo, del más reciente al más viejo. El día final
    // entra completo: created_at lleva hora. Usuario y tipo son opcionales (vacío
    // = todos), por eso el WHERE se arma aquí. El tope es una constante del ctrl.
    function qAuditLog($array) {
        $where = 'a.company_id = ? AND a.created_at >= ? AND a.created_at < DATE_ADD(?, INTERVAL 1 DAY)';
        $data  = [$array['company_id'], $array['fi'], $array['ff']];

        if (!empty($array['user_id'])) {
            $where .= ' AND a.user_id = ?';
            $data[] = $array['user_id'];
        }

        if (!empty($array['entity'])) {
            $where .= ' AND a.entity = ?';
            $data[] = $array['entity'];
        }

        $limit = (int) $array['limit'];

        $query = "
            SELECT a.id, a.created_at, a.action, a.entity, a.entity_id, a.label, a.detail, a.user_id, a.user_name, a.ip
            FROM {$this->bd}audit_log a
            WHERE {$where}
            ORDER BY a.created_at DESC, a.id DESC
            LIMIT {$limit}
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    // Los últimos movimientos de la empresa (el Resumen).
    function qRecentAudit($array) {
        // [company_id]
        $query = "
            SELECT a.id, a.created_at, a.action, a.entity, a.label, a.user_name
            FROM {$this->bd}audit_log a
            WHERE a.company_id = ?
            ORDER BY a.created_at DESC, a.id DESC
            LIMIT 8
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qAuditEntry($array) {
        // [id, company_id]
        $query = "
            SELECT a.id, a.created_at, a.action, a.entity, a.entity_id, a.label, a.detail, a.user_name, a.ip
            FROM {$this->bd}audit_log a
            WHERE a.id = ? AND a.company_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // Quienes aparecen EN LA BITÁCORA de la empresa, para el filtro de usuario.
    function qAuditUsers($array) {
        // [company_id]
        $query = "
            SELECT a.user_id AS id, MAX(a.user_name) AS valor
            FROM {$this->bd}audit_log a
            WHERE a.company_id = ? AND a.user_id IS NOT NULL
            GROUP BY a.user_id
            ORDER BY valor ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Los números de la bitácora en el periodo: todo, sesiones, cambios y bajas.
    function qAuditCounts($array) {
        // [company_id, fi, ff]
        $query = "
            SELECT
                COUNT(*) AS total,
                SUM(a.action IN ('iniciar-sesion', 'cerrar-sesion', 'entrar-empresa'))           AS sesiones,
                SUM(a.action IN ('crear', 'editar', 'permisos', 'contrasena', 'activar'))        AS cambios,
                SUM(a.action IN ('eliminar', 'desactivar'))                                      AS bajas
            FROM {$this->bd}audit_log a
            WHERE a.company_id = ? AND a.created_at >= ? AND a.created_at < DATE_ADD(?, INTERVAL 1 DAY)
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : [];
    }
}
