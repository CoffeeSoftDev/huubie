<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class MPermisos extends CRUD {
    protected $util;

    public function __construct(){
        $this->util = new Utileria;
    }

    // Roles
    // El rol 5 queda fuera del listado igual que en el resto del admin (NOT IN (5)).
    function listRoles(){
        $query = "
            SELECT
                r.id,
                r.rols AS name,
                (SELECT COUNT(*) FROM usr_users u
                  WHERE u.usr_rols_id = r.id AND u.active = 1) AS users,
                (SELECT COUNT(*) FROM usr_rol_permissions rp
                  WHERE rp.usr_rols_id = r.id AND rp.active = 1) AS granted
            FROM usr_rols r
            WHERE r.active = 1 AND r.id NOT IN (5)
            ORDER BY r.id";

        return $this->_Read($query);
    }

    // Permissions
    function listPermissions(){
        $query = "
            SELECT
                id,
                code,
                name,
                description,
                family,
                is_dangerous,
                has_scope
            FROM usr_permissions
            WHERE active = 1
            ORDER BY family, sort";

        return $this->_Read($query);
    }

    // Lo concedido a un rol. Se devuelve el id del permiso y su alcance: la ausencia
    // de fila es lo que significa "no lo puede hacer".
    function listRolPermissions($array){
        $query = "
            SELECT permissions_id, scope
            FROM usr_rol_permissions
            WHERE usr_rols_id = ? AND active = 1";

        return $this->_Read($query, $array);
    }

    // Altas, bajas y cambios de alcance por separado. Sin transacciones en esta capa,
    // reemplazar el set entero dejaria al rol sin permisos entre el borrado y la
    // insercion; con operaciones puntuales el peor caso es un permiso sin aplicar.
    function createRolPermissions($array){
        return $this->_Insert([
            'table'  => 'usr_rol_permissions',
            'values' => ['usr_rols_id', 'permissions_id', 'scope'],
            'data'   => $array
        ]);
    }

    function deleteRolPermission($array){
        return $this->_Delete([
            'table' => 'usr_rol_permissions',
            'where' => ['usr_rols_id', 'permissions_id'],
            'data'  => $array
        ]);
    }

    function updateRolPermissionScope($array){
        return $this->_Update([
            'table'  => 'usr_rol_permissions',
            'values' => ['scope'],
            'where'  => ['usr_rols_id', 'permissions_id'],
            'data'   => $array
        ]);
    }
}
?>
