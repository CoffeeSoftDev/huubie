<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once '../mdl/mdl-permisos.php';

class Permisos extends MPermisos {

    // El rol que NUNCA se edita. Si se pudiera vaciar, el sistema quedaria sin nadie
    // que lo administre y no habria pantalla desde donde arreglarlo.
    const ROL_ADMIN = 1;

    // Mientras el modulo no se administre a si mismo, el candado es el rol de sesion.
    // Devuelve el error listo para retornar, o null si puede pasar.
    private function accessDenial(){
        if (empty($_SESSION['USR'])) {
            return [
                'status'  => 401,
                'message' => 'Tu sesion no es de este modulo. Vuelve a iniciar sesion.'
            ];
        }

        if (($_SESSION['ROLID'] ?? 0) != self::ROL_ADMIN) {
            return [
                'status'  => 403,
                'message' => 'Solo un administrador puede ver y editar los permisos.'
            ];
        }

        return null;
    }

    function init(){
        $denial = $this->accessDenial();
        if ($denial) return $denial;

        return [
            'status'      => 200,
            'roles'       => $this->lsRoles(),
            'permissions' => $this->lsPermissions(),
            'rolAdmin'    => self::ROL_ADMIN
        ];
    }

    function lsRoles(){
        $roles = $this->listRoles();
        return is_array($roles) ? $roles : [];
    }

    function lsPermissions(){
        $permissions = $this->listPermissions();
        return is_array($permissions) ? $permissions : [];
    }

    // Lo que tiene un rol, en el formato que espera la pantalla:
    // { permissions_id: scope }
    function lsRolPermissions(){
        $denial = $this->accessDenial();
        if ($denial) return $denial;

        $rolId = intval($_POST['id'] ?? 0);
        if (!$rolId) {
            return ['status' => 400, 'message' => 'Falta el rol.'];
        }

        $rows    = $this->listRolPermissions([$rolId]);
        $granted = [];

        if (is_array($rows)) {
            foreach ($rows as $row) {
                $granted[$row['permissions_id']] = $row['scope'];
            }
        }

        return [
            'status'  => 200,
            'granted' => $granted
        ];
    }

    // Guarda el set de un rol comparandolo contra lo que ya hay: da de alta lo que
    // falta, quita lo que sobra y actualiza el alcance de lo que cambio. No vacia el
    // rol para volver a llenarlo porque esta capa no tiene transacciones y ese hueco
    // dejaria al rol sin permisos si la insercion falla.
    function savePermissions(){
        $denial = $this->accessDenial();
        if ($denial) return $denial;

        $rolId = intval($_POST['id'] ?? 0);
        if (!$rolId) {
            return ['status' => 400, 'message' => 'Falta el rol.'];
        }

        if ($rolId === self::ROL_ADMIN) {
            return [
                'status'  => 403,
                'message' => 'El rol Administrador siempre conserva todos los permisos.'
            ];
        }

        // Llega como JSON { permissions_id: scope } desde la pantalla.
        $entrada = json_decode($_POST['permissions'] ?? '[]', true);
        if (!is_array($entrada)) {
            return ['status' => 400, 'message' => 'No se pudo leer la lista de permisos.'];
        }

        // Solo permisos del catalogo y alcances validos: la pantalla manda ids, pero
        // el POST se puede armar a mano.
        $catalogo = [];
        foreach ($this->lsPermissions() as $permiso) {
            $catalogo[$permiso['id']] = $permiso;
        }

        $nuevo = [];
        foreach ($entrada as $permissionId => $scope) {
            $permissionId = intval($permissionId);
            if (!isset($catalogo[$permissionId])) continue;

            // Un permiso sin alcance se guarda siempre en 'all': la pantalla no lo
            // pregunta y dejarlo en 'own' lo apagaria para media empresa.
            $admiteScope = intval($catalogo[$permissionId]['has_scope']) === 1;
            $nuevo[$permissionId] = ($admiteScope && $scope === 'own') ? 'own' : 'all';
        }

        $filas  = $this->listRolPermissions([$rolId]);
        $actual = [];
        if (is_array($filas)) {
            foreach ($filas as $fila) {
                $actual[intval($fila['permissions_id'])] = $fila['scope'];
            }
        }

        $altas   = [];
        $cambios = 0;

        foreach ($nuevo as $permissionId => $scope) {
            if (!isset($actual[$permissionId])) {
                $altas[] = [$rolId, $permissionId, $scope];
                continue;
            }

            if ($actual[$permissionId] !== $scope) {
                $this->updateRolPermissionScope([$scope, $rolId, $permissionId]);
                $cambios++;
            }
        }

        if (!empty($altas)) {
            $this->createRolPermissions($altas);
            $cambios += count($altas);
        }

        foreach ($actual as $permissionId => $scope) {
            if (!isset($nuevo[$permissionId])) {
                $this->deleteRolPermission([$rolId, $permissionId]);
                $cambios++;
            }
        }

        return [
            'status'  => 200,
            'message' => $cambios === 1
                ? 'Se guardo 1 cambio.'
                : "Se guardaron {$cambios} cambios.",
            'granted' => $nuevo
        ];
    }
}

    $obj    = new Permisos();
    $fn     = $_POST['opc'];
    $encode = [];
    $encode = $obj->$fn();
    echo json_encode($encode);
?>
