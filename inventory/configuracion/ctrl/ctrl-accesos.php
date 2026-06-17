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

            $color    = $u['color'] ?: renderColorFromName($u['name'] . ' ' . $u['last_name']);
            $initial  = mb_strtoupper(mb_substr(trim($u['name']), 0, 1));
            $avatar   = '<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:' . $color . ';color:#fff;font-size:12px;font-weight:700;margin-right:6px;">' . $initial . '</span>';

            $fullname = $avatar . trim(($u['name'] ?? '') . ' ' . ($u['last_name'] ?? ''));
            if ((int) $u['is_owner'] === 1) {
                $fullname .= ' <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#7a2e1d] text-[#f0a58f]">Dueño</span>';
            }

            $branchNames = $u['branch_names']
                ? implode('', array_map(function($n) {
                    return '<span class="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f3e8e4] text-[#C05A40] mr-1 mb-0.5">' . trim($n) . '</span>';
                  }, explode(',', $u['branch_names'])))
                : '<span class="italic text-gray-400 text-sm">Sin asignar</span>';

            $row[] = [
                'id'          => $u['id'],
                'Colaborador' => $fullname,
                'Correo'      => $u['email'] ?: '-',
                'Sucursales'  => $branchNames,
                'Estado'      => renderStatus($u['status'] === 'active' ? 1 : 0),
                'a'           => $a
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getUser() {
        $id   = (int) $_POST['id'];
        $data = $this->qUser([$id, $this->companiesId]);
        if (!$data) {
            return ['status' => 404, 'message' => 'Usuario no encontrado', 'data' => null];
        }
        $data['branch_ids'] = $this->qUserBranchIds([$id]);
        return [
            'status'  => 200,
            'message' => 'OK',
            'data'    => $data
        ];
    }

    function addUser() {
        $name       = trim($_POST['name']);
        $lastName   = trim($_POST['last_name']);
        $email      = trim($_POST['email']);
        $password   = (string) $_POST['password'];
        $branchIds  = $this->normalizeBranchIds($_POST['branch_ids'] ?? '');
        $color      = $this->normalizeColor($_POST['color'] ?? '');

        if ($name === '' || $email === '') {
            return ['status' => 400, 'message' => 'Nombre y correo son obligatorios'];
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['status' => 400, 'message' => 'El correo no es válido'];
        }
        if (empty($branchIds)) {
            return ['status' => 400, 'message' => 'Debes asignar al menos una sucursal'];
        }
        if (strlen($password) < 4) {
            return ['status' => 400, 'message' => 'La contraseña debe tener al menos 4 caracteres'];
        }
        if ($this->qEmailExists([$email, $this->companiesId])) {
            return ['status' => 409, 'message' => 'Ya existe un usuario con ese correo'];
        }

        foreach ($branchIds as $bid) {
            if (!$this->qBranch([$bid, $this->companiesId])) {
                return ['status' => 400, 'message' => 'Una de las sucursales seleccionadas no es válida'];
            }
        }

        return $this->transaction(function () use ($name, $lastName, $email, $password, $branchIds, $color) {
            $this->qInsertUser([
                $name,
                $lastName ?: null,
                $email,
                password_hash($password, PASSWORD_BCRYPT),
                md5($password),
                $branchIds[0],
                $this->companiesId,
                $color
            ]);

            $newId = $this->qLastInsertId();
            if (!$newId) {
                throw new \Exception('No se pudo obtener el id del usuario creado');
            }

            foreach ($branchIds as $bid) {
                $this->qInsertUserBranch([$newId, $bid]);
            }

            return ['status' => 200, 'message' => 'Usuario creado correctamente'];
        });
    }

    function editUser() {
        $id        = (int) $_POST['id'];
        $name      = trim($_POST['name']);
        $lastName  = trim($_POST['last_name']);
        $email     = trim($_POST['email']);
        $branchIds = $this->normalizeBranchIds($_POST['branch_ids'] ?? '');
        $color     = $this->normalizeColor($_POST['color'] ?? '');

        if ($name === '' || $email === '') {
            return ['status' => 400, 'message' => 'Nombre y correo son obligatorios'];
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['status' => 400, 'message' => 'El correo no es válido'];
        }
        if (empty($branchIds)) {
            return ['status' => 400, 'message' => 'Debes asignar al menos una sucursal'];
        }
        $current = $this->qUser([$id, $this->companiesId]);
        if (!$current) {
            return ['status' => 404, 'message' => 'Usuario no encontrado'];
        }
        if ($this->qEmailExistsExcept([$email, $this->companiesId, $id])) {
            return ['status' => 409, 'message' => 'Ya existe otro usuario con ese correo'];
        }

        foreach ($branchIds as $bid) {
            if (!$this->qBranch([$bid, $this->companiesId])) {
                return ['status' => 400, 'message' => 'Una de las sucursales seleccionadas no es válida'];
            }
        }

        return $this->transaction(function () use ($id, $name, $lastName, $email, $branchIds, $color) {
            $this->qUpdateUser([
                $name,
                $lastName ?: null,
                $email,
                $branchIds[0],
                $color,
                $id,
                $this->companiesId
            ]);

            $this->qDeleteUserBranches([$id]);

            foreach ($branchIds as $bid) {
                $this->qInsertUserBranch([$id, $bid]);
            }

            return ['status' => 200, 'message' => 'Usuario actualizado correctamente'];
        });
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

    private function normalizeBranchIds($raw) {
        if (is_array($raw)) {
            $ids = $raw;
        } elseif (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            $ids = is_array($decoded) ? $decoded : explode(',', $raw);
        } else {
            return [];
        }
        $result = [];
        foreach ($ids as $v) {
            $int = (int) $v;
            if ($int > 0) $result[] = $int;
        }
        return array_values(array_unique($result));
    }

    private function normalizeColor($raw) {
        $v = trim((string) $raw);
        return preg_match('/^#[0-9A-Fa-f]{6}$/', $v) ? $v : null;
    }
}

/* ====================== Helpers ====================== */

function renderColorFromName($name) {
    $palette = ['#C05A40','#4A7C8F','#6B7FAB','#7A9E5F','#A06B3C','#6A5FA8','#4D8FA8','#9E5F6B','#5F9E7A','#8C6A3C'];
    $hash    = 0;
    $str     = mb_strtolower(trim($name));
    for ($i = 0, $len = mb_strlen($str); $i < $len; $i++) {
        $hash = (($hash << 5) - $hash) + mb_ord(mb_substr($str, $i, 1));
        $hash = $hash & 0x7FFFFFFF;
    }
    return $palette[$hash % count($palette)];
}

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
