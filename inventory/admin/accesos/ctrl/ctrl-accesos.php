<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-accesos.php';

class ctrl extends mdl {

    public $companiesId;
    public $subsidiariesId;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->companiesId    = (int) ($_SESSION['companies_id']    ?? $_POST['companies_id']    ?? 0);
        $this->subsidiariesId = (int) ($_SESSION['subsidiaries_id'] ?? $_POST['subsidiaries_id'] ?? 0);
        $this->userId         = (int) ($_SESSION['user_id']         ?? $_POST['user_id']         ?? 0);
    }

    function init() {
        $company = $this->qCompany([$this->companiesId]);
        return [
            'status'          => 200,
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $this->subsidiariesId,
            'company_name'    => $company['name'] ?? '—',
            'statusFilter'    => [
                ['id' => '1', 'valor' => 'Activos'],
                ['id' => '0', 'valor' => 'Inactivos']
            ],
            'sucursales'      => $this->qSubsidiariesForSelect([$this->companiesId])
        ];
    }

    /* ====================== Sucursales ====================== */

    function lsSubsidiaries() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $ls = $this->qSubsidiaries([$this->companiesId, $active]);

        $row = [];
        foreach ($ls as $s) {
            $a = [];
            $a[] = [
                'class'   => 'btn btn-sm btn-primary me-1',
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'subsidiaries.editSubsidiary(' . $s['id'] . ')'
            ];
            if ($s['active'] == 1) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'subsidiaries.toggleSubsidiary(' . $s['id'] . ', 0)'
                ];
            } else {
                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-success',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'subsidiaries.toggleSubsidiary(' . $s['id'] . ', 1)'
                ];
            }

            $name = htmlspecialchars($s['name']);
            if ((int) $s['id'] === $this->subsidiariesId) {
                $name .= ' <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#7a2e1d] text-[#f0a58f]">Tu sucursal</span>';
            }

            $row[] = [
                'id'         => $s['id'],
                'Sucursal'   => $name,
                'Dirección'  => $s['address'] ?: '-',
                'Teléfono'   => $s['phone']   ?: '-',
                'Principal'  => $s['is_main'] ? '<i class="icon-ok text-green-600"></i>' : '-',
                'Estado'     => renderStatus($s['active']),
                'a'          => $a
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getSubsidiary() {
        $data = $this->qSubsidiary([(int) $_POST['id'], $this->companiesId]);
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'OK' : 'Sucursal no encontrada',
            'data'    => $data
        ];
    }

    function addSubsidiary() {
        $name = trim($_POST['name'] ?? '');
        if ($name === '') {
            return ['status' => 400, 'message' => 'El nombre de la sucursal es obligatorio'];
        }

        $ok = $this->qInsertSubsidiary([
            $name,
            trim($_POST['address'] ?? '') ?: null,
            trim($_POST['phone'] ?? '') ?: null,
            !empty($_POST['is_main']) ? 1 : 0,
            $this->companiesId
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Sucursal creada correctamente' : 'No se pudo crear la sucursal'
        ];
    }

    function editSubsidiary() {
        $id   = (int) $_POST['id'];
        $name = trim($_POST['name'] ?? '');
        if ($name === '') {
            return ['status' => 400, 'message' => 'El nombre de la sucursal es obligatorio'];
        }

        $current = $this->qSubsidiary([$id, $this->companiesId]);
        if (!$current) {
            return ['status' => 404, 'message' => 'Sucursal no encontrada'];
        }

        $ok = $this->qUpdateSubsidiary([
            $name,
            trim($_POST['address'] ?? '') ?: null,
            trim($_POST['phone'] ?? '') ?: null,
            !empty($_POST['is_main']) ? 1 : 0,
            $id,
            $this->companiesId
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Sucursal actualizada correctamente' : 'No se pudo actualizar la sucursal'
        ];
    }

    function toggleSubsidiary() {
        $id     = (int) $_POST['id'];
        $active = (int) $_POST['active'];

        $current = $this->qSubsidiary([$id, $this->companiesId]);
        if (!$current) {
            return ['status' => 404, 'message' => 'Sucursal no encontrada'];
        }

        $ok = $this->qSetSubsidiaryActive([$active, $id, $this->companiesId]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? ($active ? 'Sucursal activada' : 'Sucursal desactivada') : 'No se pudo actualizar el estado'
        ];
    }

    /* ====================== Usuarios ====================== */

    function lsUsers() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $ls = $this->qUsers([$this->companiesId, $active]);

        $row = [];
        foreach ($ls as $u) {
            $a = [];
            $a[] = [
                'class'   => 'btn btn-sm btn-primary me-1',
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'users.editUser(' . $u['id'] . ')'
            ];
            $a[] = [
                'class'   => 'btn btn-sm btn-warning me-1',
                'html'    => '<i class="icon-key"></i>',
                'onclick' => 'users.changePassword(' . $u['id'] . ')'
            ];
            if ($u['active'] == 1) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'users.toggleUser(' . $u['id'] . ', 0)'
                ];
            } else {
                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-success',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'users.toggleUser(' . $u['id'] . ', 1)'
                ];
            }

            $row[] = [
                'id'         => $u['id'],
                'Colaborador'=> htmlspecialchars($u['fullname']),
                'Usuario'    => htmlspecialchars($u['username']),
                'Correo'     => $u['email'] ?: '-',
                'Sucursal'   => $u['subsidiary_name'] ?: '<span class="italic text-gray-400">Sin asignar</span>',
                'Últ. acceso'=> $u['last_login'] ?: 'Nunca',
                'Estado'     => renderStatus($u['active']),
                'a'          => $a
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getUser() {
        $data = $this->qUser([(int) $_POST['id'], $this->companiesId]);
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'OK' : 'Usuario no encontrado',
            'data'    => $data
        ];
    }

    function addUser() {
        $fullname = trim($_POST['fullname'] ?? '');
        $username = trim($_POST['username'] ?? '');
        $password = (string) ($_POST['password'] ?? '');

        if ($fullname === '' || $username === '') {
            return ['status' => 400, 'message' => 'Nombre y usuario son obligatorios'];
        }
        if (strlen($password) < 4) {
            return ['status' => 400, 'message' => 'La contraseña debe tener al menos 4 caracteres'];
        }
        if ($this->qUsernameExists([$username, $this->companiesId])) {
            return ['status' => 409, 'message' => 'Ya existe un usuario con ese nombre de usuario'];
        }

        $ok = $this->qInsertUser([
            $fullname,
            $username,
            trim($_POST['email'] ?? '') ?: null,
            trim($_POST['phone'] ?? '') ?: null,
            password_hash($password, PASSWORD_BCRYPT),
            1, // role_id por defecto (no hay catalogo de roles aun)
            !empty($_POST['subsidiaries_id']) ? (int) $_POST['subsidiaries_id'] : null,
            $this->companiesId
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Usuario creado correctamente' : 'No se pudo crear el usuario'
        ];
    }

    function editUser() {
        $id       = (int) $_POST['id'];
        $fullname = trim($_POST['fullname'] ?? '');
        $username = trim($_POST['username'] ?? '');

        if ($fullname === '' || $username === '') {
            return ['status' => 400, 'message' => 'Nombre y usuario son obligatorios'];
        }
        $current = $this->qUser([$id, $this->companiesId]);
        if (!$current) {
            return ['status' => 404, 'message' => 'Usuario no encontrado'];
        }
        if ($this->qUsernameExistsExcept([$username, $this->companiesId, $id])) {
            return ['status' => 409, 'message' => 'Ya existe otro usuario con ese nombre de usuario'];
        }

        $ok = $this->qUpdateUser([
            $fullname,
            $username,
            trim($_POST['email'] ?? '') ?: null,
            trim($_POST['phone'] ?? '') ?: null,
            !empty($_POST['subsidiaries_id']) ? (int) $_POST['subsidiaries_id'] : null,
            $id,
            $this->companiesId
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Usuario actualizado correctamente' : 'No se pudo actualizar el usuario'
        ];
    }

    function changePassword() {
        $id       = (int) $_POST['id'];
        $password = (string) ($_POST['password'] ?? '');

        if (strlen($password) < 4) {
            return ['status' => 400, 'message' => 'La contraseña debe tener al menos 4 caracteres'];
        }
        $current = $this->qUser([$id, $this->companiesId]);
        if (!$current) {
            return ['status' => 404, 'message' => 'Usuario no encontrado'];
        }

        $ok = $this->qUpdateUserPassword([
            password_hash($password, PASSWORD_BCRYPT),
            $id,
            $this->companiesId
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Contraseña actualizada' : 'No se pudo actualizar la contraseña'
        ];
    }

    function toggleUser() {
        $id     = (int) $_POST['id'];
        $active = (int) $_POST['active'];

        if ($id === $this->userId && $active === 0) {
            return ['status' => 400, 'message' => 'No puedes desactivar tu propio usuario'];
        }
        $current = $this->qUser([$id, $this->companiesId]);
        if (!$current) {
            return ['status' => 404, 'message' => 'Usuario no encontrado'];
        }

        $ok = $this->qSetUserActive([$active, $id, $this->companiesId]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? ($active ? 'Usuario activado' : 'Usuario desactivado') : 'No se pudo actualizar el estado'
        ];
    }
}

/* ====================== Helpers ====================== */

function renderStatus($status) {
    switch ((int) $status) {
        case 1:
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#014737] text-[#3FC189]">Activo</span>';
        case 0:
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#721c24] text-[#ba464d]">Inactivo</span>';
        default:
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-gray-500 text-white">Desconocido</span>';
    }
}

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
echo json_encode($obj->{$opc}());
