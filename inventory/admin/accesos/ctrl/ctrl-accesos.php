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
                'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition me-1',
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'subsidiaries.editSubsidiary(' . $b['id'] . ')'
            ];
            if ($b['is_active'] == 1) {
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded-md border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 transition',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'subsidiaries.toggleSubsidiary(' . $b['id'] . ', 0)'
                ];
            } else {
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'subsidiaries.toggleSubsidiary(' . $b['id'] . ', 1)'
                ];
            }

            $name = htmlspecialchars($b['name']);
            if ((int) $b['id'] === $this->branchId) {
                $name .= ' ' . badge('Tu sucursal', '#C05A40', 100, '#F7E3DC');
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
                'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition me-1',
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'users.editUser(' . $u['id'] . ')'
            ];
            if ($u['status'] === 'active') {
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded-md border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 transition',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'users.toggleUser(' . $u['id'] . ', 0)'
                ];
            } else {
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'users.toggleUser(' . $u['id'] . ', 1)'
                ];
            }

            $color    = $u['color'] ?: renderColorFromName($u['name'] . ' ' . $u['last_name']);
            $initial  = mb_strtoupper(mb_substr(trim($u['name']), 0, 1));
            $avatar   = '<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:' . $color . ';color:#fff;font-size:12px;font-weight:700;margin-right:6px;">' . $initial . '</span>';

            $fullname = $avatar . trim(($u['name'] ?? '') . ' ' . ($u['last_name'] ?? ''));
            if ((int) $u['is_owner'] === 1) {
                $fullname .= ' ' . badge('Dueño', '#C05A40', 100, '#F7E3DC');
            }

            $branchNames = $u['branch_names']
                ? implode(' ', array_map(function($n) {
                    return badge(trim($n), '#C05A40', 100, '#F7E3DC');
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
        $data['photo_url']  = $this->photoUrl($data['photo'] ?? '');
        return [
            'status'  => 200,
            'message' => 'OK',
            'data'    => $data
        ];
    }

    /* ===== Foto del colaborador =====
       Convención compartida con el login (acceso/ctrl/ctrl-access.php):
       `users.photo` guarda SOLO el nombre del archivo dentro de
       inventory/uploads/users/. */

    private function photoDir() {
        return __DIR__ . '/../../../uploads/users/';
    }

    // ¿El formulario trae algo que hacer con la foto? Sin esto, guardar el
    // usuario sin tocar su foto la borraría.
    private function photoTouched() {
        return ($_POST['photo_b64'] ?? '') !== '' || ($_POST['photo_clear'] ?? '') === '1';
    }

    /*  La foto viaja como dataURL en un campo de TEXTO, no como archivo:
        createModalForm manda el formulario por useFetch, que arma un
        URLSearchParams, y ahí un File se convierte en "[object File]". Es el
        mismo camino que la evidencia de mermas (ctrl-salidas.php).

        Devuelve el nombre de archivo a guardar, o null para dejarla vacía. Si
        el dataURL viene roto se conserva la que ya había: vale más quedarse con
        la foto vieja que borrarla por un envío mal formado. */
    private function savePhoto($userId, $currentPhoto) {
        $b64   = (string) ($_POST['photo_b64'] ?? '');
        $clear = ($_POST['photo_clear'] ?? '') === '1';
        $dir   = $this->photoDir();

        if (!$clear) {
            if (!preg_match('#^data:image/([a-zA-Z0-9.+-]+);base64,#', $b64, $m)) return $currentPhoto;

            $ext = strtolower($m[1]) === 'jpeg' ? 'jpg' : strtolower($m[1]);
            if (!in_array($ext, ['jpg', 'png', 'webp', 'gif'], true))            return $currentPhoto;

            $data = base64_decode(substr($b64, strpos($b64, ',') + 1), true);
            if ($data === false)                                                 return $currentPhoto;

            if (!is_dir($dir)) @mkdir($dir, 0777, true);

            $fileName = 'user_' . (int) $userId . '_' . time() . '.' . $ext;
            if (@file_put_contents($dir . $fileName, $data) === false)           return $currentPhoto;

            $this->dropPhoto($currentPhoto);
            return $fileName;
        }

        $this->dropPhoto($currentPhoto);
        return null;
    }

    // Borra del disco la foto anterior. basename() para que un valor manipulado
    // no pueda salirse de la carpeta.
    private function dropPhoto($photo) {
        $photo = basename(trim((string) $photo));
        if ($photo === '') return;

        $file = $this->photoDir() . $photo;
        if (is_file($file)) @unlink($file);
    }

    // La foto lista para un <img src>. La base sale de la ruta real de este
    // controlador (.../inventory/admin/accesos/ctrl/) y no escrita a mano.
    private function photoUrl($photo) {
        $photo = trim((string) $photo);
        if ($photo === '') return '';
        if ($photo[0] === '/' || preg_match('#^https?://#', $photo)) return $photo;

        $base = dirname(dirname(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? ''))));
        $base = rtrim(str_replace('\\', '/', $base), '/');

        return $base . '/uploads/users/' . rawurlencode($photo);
    }

    function addUser() {
        $name       = trim($_POST['name']);
        $lastName   = trim($_POST['last_name']);
        $email      = trim($_POST['email']);
        $password   = (string) $_POST['password'];
        $branchIds  = $this->normalizeBranchIds($_POST['branch_ids'] ?? '');
        $color      = $this->normalizeColor($_POST['color'] ?? '');

        // Segunda barrera de la doble confirmacion: el JS ya bloquea el envio,
        // esto cubre el caso de que la peticion llegue por fuera del formulario.
        if ($password !== (string) ($_POST['password_confirmation'] ?? '')) {
            return ['status' => 422, 'message' => 'Las contraseñas no coinciden'];
        }

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

            // El alta no captura rol todavia: la fila nace sin el y el usuario
            // no vera modulos hasta que se le asigne uno.
            foreach ($branchIds as $bid) {
                $this->qInsertUserBranch([$newId, $bid, null]);
            }

            // La foto se guarda al final porque su nombre lleva el id del usuario,
            // que hasta aquí no existía.
            if ($this->photoTouched()) {
                $this->qUpdateUserPhoto([$this->savePhoto($newId, ''), $newId, $this->companiesId]);
            }

            return ['status' => 200, 'message' => 'Usuario creado correctamente'];
        });
    }

    function editUser() {
        $id                   = (int) $_POST['id'];
        $name                 = trim($_POST['name']);
        $lastName             = trim($_POST['last_name']);
        $email                = trim($_POST['email']);
        $branchIds            = $this->normalizeBranchIds($_POST['branch_ids'] ?? '');
        $color                = $this->normalizeColor($_POST['color'] ?? '');
        // Opcionales en la edicion: si no llegan, la contrasena no se toca.
        $password             = (string) ($_POST['password'] ?? '');
        $passwordConfirmation = (string) ($_POST['password_confirmation'] ?? '');

        if ($password !== '' && $password !== $passwordConfirmation) {
            return ['status' => 422, 'message' => 'Las contraseñas no coinciden'];
        }
        if ($name === '' || $email === '') {
            return ['status' => 400, 'message' => 'Nombre y correo son obligatorios'];
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['status' => 400, 'message' => 'El correo no es válido'];
        }
        if (empty($branchIds)) {
            return ['status' => 400, 'message' => 'Debes asignar al menos una sucursal'];
        }
        if ($password !== '' && strlen($password) < 4) {
            return ['status' => 400, 'message' => 'La contraseña debe tener al menos 4 caracteres'];
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

        // Foto de los roles antes de tocar users_braches: el rol vive solo en esa
        // tabla y la edicion la borra entera, asi que hay que leerlo primero.
        $roleByBranch = $this->qUserBranchRoles([$id]);
        $rolesActuales = array_filter($roleByBranch, function ($r) { return $r !== null; });
        $fallbackRole  = !empty($rolesActuales) ? reset($rolesActuales) : null;

        $photoActual = $current['photo'] ?? '';

        return $this->transaction(function () use ($id, $name, $lastName, $email, $branchIds, $color, $password, $roleByBranch, $fallbackRole, $photoActual) {
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

            // Se reinserta cada sucursal con el rol que ya tenia. Una sucursal
            // recien asignada no tiene rol propio: hereda el del resto para no
            // quedarse en NULL, que es lo que dejaba al usuario sin modulos.
            foreach ($branchIds as $bid) {
                $this->qInsertUserBranch([$id, $bid, $roleByBranch[$bid] ?? $fallbackRole]);
            }

            if ($password !== '') {
                $this->qUpdateUserPassword([
                    password_hash($password, PASSWORD_BCRYPT),
                    md5($password),
                    $id,
                    $this->companiesId
                ]);
            }

            if ($this->photoTouched()) {
                $this->qUpdateUserPhoto([$this->savePhoto($id, $photoActual), $id, $this->companiesId]);
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
    // [color de texto, color de fondo] - modelo pastel de 2 colores (badge() en
    // _Utileria.php); el vino #9D3434 es el --danger de Arcilla Invernal, no el
    // rojo puro de Bootstrap (ver colors.css).
    $map = [
        1 => ['#16A34A', '#DCFCE7'],
        0 => ['#9D3434', '#F6E4E4']
    ];
    $c    = $map[(int) $status] ?? ['#475569', '#F1F5F9'];
    $text = $status == 1 ? 'Activo' : ($status == 0 ? 'Inactivo' : 'Desconocido');

    return badge($text, $c[0], 100, $c[1]);
}

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
echo json_encode($obj->{$opc}());
