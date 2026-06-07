<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-accesos.php';

class ctrl extends mdl {

    public $companiesId;
    public $branchId;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->companiesId = (int) ($_SESSION['company_id'] ?? $_POST['company_id'] ?? 0);
        $this->branchId    = (int) ($_SESSION['branch_id']  ?? $_POST['branch_id']  ?? 0);
        $this->userId      = (int) ($_SESSION['IDU'] ?? $_SESSION['user_id'] ?? $_POST['user_id'] ?? 0);
    }

    function init() {
        $company = $this->qCompany([$this->companiesId]);
        return [
            'status'       => 200,
            'company_id'   => $this->companiesId,
            'branch_id'    => $this->branchId,
            'company_name' => $company['name'] ?? '—',
            'statusFilter' => [
                ['id' => '1', 'valor' => 'Activos'],
                ['id' => '0', 'valor' => 'Inactivos']
            ],
            'sucursales'   => $this->qBranchesForSelect([$this->companiesId])
        ];
    }

    /* ====================== Sucursales (branches) ====================== */

    function lsBranches() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $ls = $this->qBranches([$this->companiesId, $active]);

        $row = [];
        foreach ($ls as $b) {
            $a = [];
            $a[] = [
                'class'   => 'btn btn-sm btn-primary me-1',
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'subsidiaries.editSubsidiary(' . $b['id'] . ')'
            ];
            if ($b['is_active'] == 1) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'subsidiaries.toggleSubsidiary(' . $b['id'] . ', 0)'
                ];
            } else {
                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-success',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'subsidiaries.toggleSubsidiary(' . $b['id'] . ', 1)'
                ];
            }

            $name = htmlspecialchars($b['name']);
            if ((int) $b['id'] === $this->branchId) {
                $name .= ' <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#7a2e1d] text-[#f0a58f]">Tu sucursal</span>';
            }

            $row[] = [
                'id'         => $b['id'],
                'Sucursal'   => $name,
                'Ubicación'  => $b['ubication'] ?: '-',
                'Estado'     => renderStatus($b['is_active']),
                'a'          => $a
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getBranch() {
        $data = $this->qBranch([(int) $_POST['id'], $this->companiesId]);
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'OK' : 'Sucursal no encontrada',
            'data'    => $data
        ];
    }

    function addBranch() {
        $name = trim($_POST['name'] ?? '');
        if ($name === '') {
            return ['status' => 400, 'message' => 'El nombre de la sucursal es obligatorio'];
        }

        $ok = $this->qInsertBranch([
            $name,
            trim($_POST['ubication'] ?? '') ?: null,
            $this->companiesId
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Sucursal creada correctamente' : 'No se pudo crear la sucursal'
        ];
    }

    function editBranch() {
        $id   = (int) $_POST['id'];
        $name = trim($_POST['name'] ?? '');
        if ($name === '') {
            return ['status' => 400, 'message' => 'El nombre de la sucursal es obligatorio'];
        }

        $current = $this->qBranch([$id, $this->companiesId]);
        if (!$current) {
            return ['status' => 404, 'message' => 'Sucursal no encontrada'];
        }

        $ok = $this->qUpdateBranch([
            $name,
            trim($_POST['ubication'] ?? '') ?: null,
            $id,
            $this->companiesId
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Sucursal actualizada correctamente' : 'No se pudo actualizar la sucursal'
        ];
    }

    function toggleBranch() {
        $id     = (int) $_POST['id'];
        $active = (int) $_POST['active'];

        $current = $this->qBranch([$id, $this->companiesId]);
        if (!$current) {
            return ['status' => 404, 'message' => 'Sucursal no encontrada'];
        }

        $ok = $this->qSetBranchActive([$active, $id, $this->companiesId]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? ($active ? 'Sucursal activada' : 'Sucursal desactivada') : 'No se pudo actualizar el estado'
        ];
    }

    /* ====================== Usuarios ====================== */

    function lsUsers() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $status = $active === 1 ? 'active' : 'inactive';
        $ls = $this->qUsers([$this->companiesId, $status]);

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
            if ($u['status'] === 'active') {
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

            $fullname = trim(($u['name'] ?? '') . ' ' . ($u['last_name'] ?? ''));
            if ((int) $u['is_owner'] === 1) {
                $fullname .= ' <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#7a2e1d] text-[#f0a58f]">Dueño</span>';
            }

            $row[] = [
                'id'          => $u['id'],
                'Colaborador' => $fullname,
                'Correo'      => $u['email'] ?: '-',
                'Sucursal'    => $u['branch_name'] ?: '<span class="italic text-gray-400">Sin asignar</span>',
                'Estado'      => renderStatus($u['status'] === 'active' ? 1 : 0),
                'a'           => $a
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
        $name     = trim($_POST['name'] ?? '');
        $lastName = trim($_POST['last_name'] ?? '');
        $email    = trim($_POST['email'] ?? '');
        $password = (string) ($_POST['password'] ?? '');
        $branchId = (int) ($_POST['branch_id'] ?? 0);

        if ($name === '' || $email === '') {
            return ['status' => 400, 'message' => 'Nombre y correo son obligatorios'];
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['status' => 400, 'message' => 'El correo no es válido'];
        }
        if ($branchId <= 0) {
            return ['status' => 400, 'message' => 'Debes asignar una sucursal al usuario'];
        }
        if (strlen($password) < 4) {
            return ['status' => 400, 'message' => 'La contraseña debe tener al menos 4 caracteres'];
        }
        if ($this->qEmailExists([$email, $this->companiesId])) {
            return ['status' => 409, 'message' => 'Ya existe un usuario con ese correo'];
        }
        if (!$this->qBranch([$branchId, $this->companiesId])) {
            return ['status' => 400, 'message' => 'La sucursal seleccionada no es válida'];
        }

        $ok = $this->qInsertUser([
            $name,
            $lastName ?: null,
            $email,
            password_hash($password, PASSWORD_BCRYPT),
            md5($password),
            $branchId,
            $this->companiesId
        ]);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Usuario creado correctamente' : 'No se pudo crear el usuario'
        ];
    }

    function editUser() {
        $id       = (int) $_POST['id'];
        $name     = trim($_POST['name'] ?? '');
        $lastName = trim($_POST['last_name'] ?? '');
        $email    = trim($_POST['email'] ?? '');
        $branchId = (int) ($_POST['branch_id'] ?? 0);

        if ($name === '' || $email === '') {
            return ['status' => 400, 'message' => 'Nombre y correo son obligatorios'];
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['status' => 400, 'message' => 'El correo no es válido'];
        }
        if ($branchId <= 0) {
            return ['status' => 400, 'message' => 'Debes asignar una sucursal al usuario'];
        }
        $current = $this->qUser([$id, $this->companiesId]);
        if (!$current) {
            return ['status' => 404, 'message' => 'Usuario no encontrado'];
        }
        if ($this->qEmailExistsExcept([$email, $this->companiesId, $id])) {
            return ['status' => 409, 'message' => 'Ya existe otro usuario con ese correo'];
        }
        if (!$this->qBranch([$branchId, $this->companiesId])) {
            return ['status' => 400, 'message' => 'La sucursal seleccionada no es válida'];
        }

        $ok = $this->qUpdateUser([
            $name,
            $lastName ?: null,
            $email,
            $branchId,
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
            md5($password),
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

        $status = $active === 1 ? 'active' : 'inactive';
        $ok = $this->qSetUserStatus([$status, $id, $this->companiesId]);
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
