<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/../mdl/mdl-configuracion.php';
require_once __DIR__ . '/../../../core/billing/_Billing.php';

/*  CONFIGURACIÓN DE LA EMPRESA: lo que su dueño administra por su cuenta.

      Empresa      nombre, logo y datos fiscales
      Sucursales   agregar, renombrar, apagar
      Usuarios     su gente: a que sucursal entra cada quien y con que rol
      Roles        los roles propios de la empresa y lo que deja hacer cada uno
      Plan y pagos el plan y cambiarlo, pagar, la forma de pago y el historial

    Es del DUEÑO (o de root viendo la empresa como su dueño): no es una seccion
    con permisos por rol, asi que no pasa por Permission. La revision va al pie
    de este archivo y vale para todas las operaciones.

    Todo se lee y se escribe sobre la empresa de la sesion ($this->cid). Cada
    operacion que recibe un id revisa primero que ese registro sea de ESTA
    empresa: el id viene del navegador y no se le cree. */
class ctrl extends configMdl {
    const OPS = [
        'init', 'saveCompany', 'saveLogo', 'removeLogo',
        'branches', 'saveBranch', 'toggleBranch',
        'users', 'saveUser', 'toggleUser',
        'roles', 'getRole', 'saveRole', 'toggleRole',
        'billing', 'checkout', 'portal', 'plans', 'changePlan',
    ];

    // Las que solo leen la sesion: se suelta antes para no formar en fila a la
    // barra y al rail.
    const READ_ONLY = ['init', 'branches', 'users', 'roles', 'getRole', 'billing', 'checkout', 'portal', 'plans', 'changePlan'];

    const LOGO_MAX   = 2097152;   // 2 MB
    const LOGO_TYPES = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];

    // Colores del avatar: los mismos de Mi perfil. users.color acaba en un style="".
    const COLORS = ['#1C64F2', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#D97706', '#16A34A', '#0D9488', '#0284C7', '#475569'];

    // Regimenes fiscales del SAT (c_RegimenFiscal) que le tocan a un negocio.
    const REGIMES = [
        '601' => 'General de Ley Personas Morales',
        '603' => 'Personas Morales con Fines no Lucrativos',
        '612' => 'Personas Físicas con Actividades Empresariales y Profesionales',
        '621' => 'Incorporación Fiscal',
        '625' => 'Actividades con ingresos por Plataformas Tecnológicas',
        '626' => 'Régimen Simplificado de Confianza (RESICO)',
        '606' => 'Arrendamiento',
        '616' => 'Sin obligaciones fiscales',
    ];

    const PASSWORD_MIN = 8;

    private $cid;

    function __construct() {
        parent::__construct();
        $this->cid = (int) ($_SESSION['company_id'] ?? 0);
    }

    // =========================================================== Empresa

    function init() {
        $c = $this->getCompany([$this->cid]);
        if (!$c) return ['status' => 404, 'message' => 'No encontramos tu empresa.'];

        $fiscal = $this->hasFiscalColumns();

        $regimes = [];
        foreach (self::REGIMES as $code => $name) $regimes[] = ['id' => (string) $code, 'name' => $name];

        return [
            'status' => 200,
            'data'   => [
                'company' => [
                    'name'       => (string) $c['name'],
                    'rfc'        => (string) $c['rfc'],
                    'ubication'  => (string) $c['ubication'],
                    'logo'       => companyLogoUrl($c['logo'], 4),
                    'legal_name' => (string) ($c['legal_name'] ?? ''),
                    'tax_regime' => (string) ($c['tax_regime'] ?? ''),
                    'zip_code'   => (string) ($c['zip_code'] ?? ''),
                    'phone'      => (string) ($c['phone'] ?? ''),
                    'email'      => (string) ($c['email'] ?? ''),
                ],
                // Sin la migracion de datos fiscales la pagina no ofrece esos campos.
                'fiscal'  => $fiscal ? 1 : 0,
                'regimes' => $regimes,
                'colors'  => self::COLORS,
                'limits'  => $this->limits(),
                'me'      => (int) Session::user(),
                // root no es de la empresa: la administra como su dueño.
                'viewing' => !empty($_SESSION['is_root']) ? 1 : 0,
            ]
        ];
    }

    function saveCompany() {
        $name = $this->text('name', 120);
        $rfc  = strtoupper((string) $this->text('rfc', 13));

        if ($name === null) return $this->invalid('name', 'Escribe el nombre de tu empresa.');

        // RFC de persona moral (12) o fisica (13). Opcional.
        if ($rfc !== '' && !preg_match('/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/u', $rfc)) {
            return $this->invalid('rfc', 'Ese RFC no tiene el formato correcto (12 o 13 caracteres).');
        }

        $fields = [
            'name'      => $name,
            'rfc'       => $rfc === '' ? null : $rfc,
            'ubication' => $this->text('ubication', 255),
        ];

        if ($this->hasFiscalColumns()) {
            $regime = trim((string) ($_POST['tax_regime'] ?? ''));
            $zip    = trim((string) ($_POST['zip_code'] ?? ''));
            $phone  = $this->text('phone', 20);
            $email  = $this->text('email', 120);

            if ($regime !== '' && !isset(self::REGIMES[$regime])) return $this->invalid('tax_regime', 'Elige un régimen fiscal de la lista.');
            if ($zip !== '' && !preg_match('/^[0-9]{5}$/', $zip))  return $this->invalid('zip_code', 'El código postal son 5 números.');

            if ($phone !== null && !preg_match('/^[0-9+() \-]{7,20}$/', $phone)) {
                return $this->invalid('phone', 'Escribe el teléfono solo con números (7 a 20 dígitos).');
            }
            if ($email !== null && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return $this->invalid('email', 'Ese correo no es válido.');
            }

            $fields += [
                'legal_name' => $this->text('legal_name', 160),
                'tax_regime' => $regime === '' ? null : $regime,
                'zip_code'   => $zip === '' ? null : $zip,
                'phone'      => $phone,
                'email'      => $email === null ? null : strtolower($email),
            ];
        }

        if ($this->updateCompany($fields, $this->cid) !== true) {
            return ['status' => 500, 'message' => 'No pudimos guardar los datos. Inténtalo de nuevo.'];
        }

        // La barra lee el nombre de la sesion.
        $_SESSION['company'] = $name;

        return ['status' => 200, 'message' => 'Los datos de tu empresa quedaron guardados.'];
    }

    /*  companies.logo guarda SOLO el nombre del archivo dentro de
        pro/uploads/companies/. El tipo se lee del contenido y no de la
        extension que mande el navegador, y el nombre lo pone el servidor. */
    function saveLogo() {
        $c    = $this->getCompany([$this->cid]);
        $file = $_FILES['logo'] ?? null;

        if (!$c) return ['status' => 404, 'message' => 'No encontramos tu empresa.'];

        if (!$file || $file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
            return ['status' => 400, 'message' => 'No recibimos la imagen. Inténtalo de nuevo.'];
        }
        if ($file['size'] > self::LOGO_MAX) {
            return ['status' => 400, 'message' => 'La imagen pesa más de 2 MB.'];
        }

        $info = @getimagesize($file['tmp_name']);

        if (!$info || !isset(self::LOGO_TYPES[$info[2]])) {
            return ['status' => 400, 'message' => 'Sube una imagen JPG, PNG o WebP.'];
        }

        $dir = $this->logoDir();

        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            return ['status' => 500, 'message' => 'No se pudo preparar la carpeta de logos.'];
        }

        $name = 'c' . $this->cid . '-' . time() . '.' . self::LOGO_TYPES[$info[2]];

        if (!move_uploaded_file($file['tmp_name'], $dir . $name)) {
            return ['status' => 500, 'message' => 'No se pudo guardar la imagen.'];
        }

        if ($this->updateCompanyLogo([$name, $this->cid]) !== true) {
            @unlink($dir . $name);
            return ['status' => 500, 'message' => 'No pudimos guardar el logo. Inténtalo de nuevo.'];
        }

        $this->dropLogo($c['logo'], $name);

        return ['status' => 200, 'message' => 'El logo quedó actualizado.', 'data' => ['logo' => companyLogoUrl($name, 4)]];
    }

    function removeLogo() {
        $c = $this->getCompany([$this->cid]);
        if (!$c) return ['status' => 404, 'message' => 'No encontramos tu empresa.'];

        if ($this->updateCompanyLogo([null, $this->cid]) !== true) {
            return ['status' => 500, 'message' => 'No pudimos quitar el logo. Inténtalo de nuevo.'];
        }

        $this->dropLogo($c['logo'], '');

        return ['status' => 200, 'message' => 'Se quitó el logo.', 'data' => ['logo' => '']];
    }

    private function logoDir() {
        return __DIR__ . '/../../../uploads/companies/';
    }

    // El anterior ya no lo apunta nadie. basename(): solo dentro de la carpeta.
    private function dropLogo($old, $keep) {
        $old = basename(trim((string) $old));
        if ($old === '' || $old === $keep) return;

        $file = $this->logoDir() . $old;
        if (is_file($file)) @unlink($file);
    }

    // ======================================================== Sucursales

    function branches() {
        $current = (int) ($_SESSION['branch_id'] ?? 0);
        $list    = [];

        foreach ($this->listBranches([$this->cid]) as $b) {
            $list[] = [
                'id'        => (int) $b['id'],
                'name'      => (string) $b['name'],
                'ubication' => (string) $b['ubication'],
                'active'    => (int) $b['is_active'],
                'users'     => (int) $b['users'],
                // En la que esta parado quien pregunta: no se apaga desde aqui.
                'current'   => (int) $b['id'] === $current ? 1 : 0,
            ];
        }

        return ['status' => 200, 'data' => ['branches' => $list, 'limits' => $this->limits()]];
    }

    function saveBranch() {
        $id        = (int) ($_POST['id'] ?? 0);
        $name      = $this->text('name', 120);
        $ubication = $this->text('ubication', 255);

        if ($name === null) return $this->invalid('name', 'Escribe el nombre de la sucursal.');

        if ($id === 0) {
            $error = $this->branchLimitError();
            if ($error) return $error;

            if ($this->qBranchNameExists([$name, $this->cid])) {
                return $this->invalid('name', 'Ya tienes una sucursal con ese nombre.');
            }

            $ok = $this->qInsertBranch([$name, $ubication, $this->cid]) === true;

            return $ok
                 ? ['status' => 200, 'message' => 'Sucursal agregada. Ahora dale acceso a tu gente en Usuarios.']
                 : ['status' => 500, 'message' => 'No pudimos agregar la sucursal. Inténtalo de nuevo.'];
        }

        if (!$this->qBranchInCompany([$id, $this->cid])) return ['status' => 404, 'message' => 'Esa sucursal no es de tu empresa.'];

        if ($this->qBranchNameExistsExcept([$name, $this->cid, $id])) {
            return $this->invalid('name', 'Ya tienes otra sucursal con ese nombre.');
        }

        if ($this->qUpdateBranch([$name, $ubication, $id]) !== true) {
            return ['status' => 500, 'message' => 'No pudimos guardar la sucursal. Inténtalo de nuevo.'];
        }

        // La barra lee de la sesion el nombre de la sucursal activa.
        if ($id === (int) ($_SESSION['branch_id'] ?? 0)) $_SESSION['branch'] = $name;

        return ['status' => 200, 'message' => 'Sucursal actualizada.'];
    }

    /*  Apagar una sucursal no borra nada: deja de ofrecerse para entrar y
        vuelve tal cual al encenderla. No se apaga la ultima activa (la empresa
        se quedaria sin donde operar) ni aquella en la que se esta parado. */
    function toggleBranch() {
        $id     = (int) ($_POST['id'] ?? 0);
        $active = (int) ($_POST['active'] ?? 0) === 1 ? 1 : 0;

        if (!$this->qBranchInCompany([$id, $this->cid])) return ['status' => 404, 'message' => 'Esa sucursal no es de tu empresa.'];

        $branch = $this->qBranch([$id]);

        if ($active === (int) $branch['is_active']) return ['status' => 200, 'message' => 'Sin cambios.'];

        if ($active === 1) {
            $error = $this->branchLimitError();
            if ($error) return $error;
        } else {
            if ($id === (int) ($_SESSION['branch_id'] ?? 0)) {
                return ['status' => 400, 'message' => 'Estás trabajando en esta sucursal. Cámbiate a otra desde la barra antes de desactivarla.'];
            }
            if ($this->qCountActiveBranches([$this->cid]) <= 1) {
                return ['status' => 400, 'message' => 'Tu empresa necesita al menos una sucursal activa.'];
            }
        }

        $ok = $this->qSetBranchActive([$active, $id]) === true;

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? ($active ? 'Sucursal activada.' : 'Sucursal desactivada. Su información se conserva.') : 'No se pudo cambiar el estado.',
        ];
    }

    private function branchLimitError() {
        $limits = $this->limits()['branches'];

        if ($limits['max'] !== null && $limits['used'] >= $limits['max']) {
            return ['status' => 409, 'message' => 'Tu plan incluye ' . $limits['max'] . ($limits['max'] === 1 ? ' sucursal activa' : ' sucursales activas') . '. Para agregar otra, cambia de plan.'];
        }

        return null;
    }

    // ========================================================== Usuarios

    function users() {
        $access = [];
        foreach ($this->listUsersAccess([$this->cid]) as $a) {
            $access[(int) $a['user_id']][] = [
                'branch_id' => (int) $a['branch_id'],
                'branch'    => (string) $a['branch'],
                'role_id'   => (int) $a['role_id'],
                'role'      => (string) $a['role'],
            ];
        }

        $me    = (int) Session::user();
        $users = [];

        foreach ($this->listUsers([$this->cid]) as $u) {
            $id = (int) $u['id'];

            $users[] = [
                'id'         => $id,
                'name'       => (string) $u['name'],
                'last_name'  => (string) $u['last_name'],
                'email'      => (string) $u['email'],
                'status'     => (string) $u['status'],
                'owner'      => (int) $u['is_owner'],
                'photo'      => userPhotoUrl($u['photo'], 4),
                'color'      => (string) $u['color'],
                'last_login' => (string) $u['last_login'],
                'me'         => $id === $me ? 1 : 0,
                'access'     => $access[$id] ?? [],
            ];
        }

        $branches = [];
        foreach ($this->qBranchesByCompany([$this->cid]) as $b) {
            $branches[] = ['id' => (int) $b['id'], 'name' => (string) $b['valor'], 'active' => (int) $b['is_active']];
        }

        $roles = [];
        foreach ($this->qRolesForCompany([$this->cid]) as $r) {
            $roles[] = ['id' => (int) $r['id'], 'name' => (string) $r['valor'], 'system' => (int) $r['is_system']];
        }

        return ['status' => 200, 'data' => ['users' => $users, 'branches' => $branches, 'roles' => $roles, 'limits' => $this->limits()]];
    }

    /*  Alta y edicion. `access` viaja como JSON [{branch_id, role_id}]: una
        fila por sucursal a la que entra. Al dueño no se le pide: entra a todas
        (homeBranch en auth/ctrl/ctrl-auth.php). */
    function saveUser() {
        $id       = (int) ($_POST['id'] ?? 0);
        $name     = $this->text('name', 80);
        $last     = $this->text('last_name', 80);
        $email    = strtolower((string) $this->text('email', 120));
        $password = (string) ($_POST['password'] ?? '');
        $color    = in_array($_POST['color'] ?? '', self::COLORS, true) ? $_POST['color'] : null;
        $access   = $this->postedAccess();

        $current = null;

        if ($id > 0) {
            $current = $this->companyUser($id);
            if (!$current) return ['status' => 404, 'message' => 'Esa persona no es de tu empresa.'];
        }

        if ($name === null)  return $this->invalid('name', 'Escribe el nombre.');
        if ($email === '')   return $this->invalid('email', 'Escribe el correo con el que va a entrar.');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return $this->invalid('email', 'Ese correo no es válido.');
        if ($this->qUserEmailTaken([$email, $id]))      return $this->invalid('email', 'Ya hay una cuenta de Huubie con ese correo.', 409);

        if ($id === 0 && $password === '') return $this->invalid('password', 'Ponle una contraseña para su primer ingreso.');

        if ($password !== '' && mb_strlen($password) < self::PASSWORD_MIN) {
            return $this->invalid('password', 'La contraseña debe tener al menos ' . self::PASSWORD_MIN . ' caracteres.');
        }

        $owner = $current ? (int) $current['is_owner'] === 1 : false;

        $error = $this->accessError($access, $owner);
        if ($error) return $error;

        // Su sucursal de casa: la que ya tenia si sigue entrando a ella; si no, la primera.
        $home = $current ? (int) $current['branch_id'] : 0;
        if (!in_array($home, array_column($access, 'branch_id'), true)) {
            $home = $access ? $access[0]['branch_id'] : ($home ?: null);
        }

        if ($id === 0) {
            $error = $this->userLimitError();
            if ($error) return $error;
        }

        return $this->transaction(function () use ($id, $name, $last, $email, $password, $color, $access, $home, $current) {
            if ($id === 0) {
                $this->qInsertUser([$name, $last, $email, password_hash($password, PASSWORD_BCRYPT), $home, $this->cid, $color, 0]);

                $id = $this->qLastInsertId();
                if (!$id) throw new \Exception('No se pudo obtener el id del usuario creado');
            } else {
                $this->qUpdateUser([$name, $last, $email, $this->cid, $home, $color ?: $current['color'], (int) $current['is_owner'], $id]);

                if ($password !== '') $this->qUpdateUserPassword([password_hash($password, PASSWORD_BCRYPT), $id]);
            }

            $this->qDeleteUserBranches([$id]);
            foreach ($access as $a) $this->qInsertUserBranchRole([$id, $a['branch_id'], $a['role_id']]);

            // Si se edito a si mismo, la barra lee su nombre de la sesion.
            if ($id === (int) Session::user()) $_SESSION['user'] = trim($name . ' ' . $last);

            return ['status' => 200, 'message' => $current ? 'Usuario actualizado.' : 'Usuario agregado. Ya puede entrar con su correo y contraseña.'];
        });
    }

    /*  Desactivar no borra: la persona deja de poder entrar y conserva su
        historial. Nadie se desactiva a si mismo ni a un dueño desde aqui. */
    function toggleUser() {
        $id     = (int) ($_POST['id'] ?? 0);
        $active = (int) ($_POST['active'] ?? 0) === 1;
        $user   = $this->companyUser($id);

        if (!$user) return ['status' => 404, 'message' => 'Esa persona no es de tu empresa.'];

        if ($id === (int) Session::user()) return ['status' => 400, 'message' => 'No puedes desactivar tu propia cuenta.'];
        if ((int) $user['is_owner'] === 1) return ['status' => 400, 'message' => 'La cuenta de un dueño no se desactiva desde aquí. Escríbenos si necesitas hacerlo.'];

        if ($active && $user['status'] !== 'active') {
            $error = $this->userLimitError();
            if ($error) return $error;
        }

        $ok = $this->qSetUserStatus([$active ? 'active' : 'inactive', $id]) === true;

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? ($active ? 'Usuario activado.' : 'Usuario desactivado. Ya no puede entrar.') : 'No se pudo cambiar el estado.',
        ];
    }

    // El usuario, solo si es de esta empresa y no es de plataforma (root).
    private function companyUser($id) {
        if ($id <= 0 || !$this->qUserExistsInCompany([$id, $this->cid])) return null;
        if ($this->qUserIsRoot([$id])) return null;

        return $this->qUser([$id]);
    }

    private function postedAccess() {
        $decoded = json_decode((string) ($_POST['access'] ?? ''), true);
        $result  = [];

        foreach ((is_array($decoded) ? $decoded : []) as $a) {
            $branchId = (int) ($a['branch_id'] ?? 0);
            if ($branchId <= 0 || isset($result[$branchId])) continue;

            $result[$branchId] = ['branch_id' => $branchId, 'role_id' => (int) ($a['role_id'] ?? 0)];
        }

        return array_values($result);
    }

    // Cada acceso: una sucursal de la empresa con un rol que la empresa puede dar.
    private function accessError($access, $owner) {
        if (!$access && !$owner) return $this->invalid('access', 'Dale acceso al menos a una sucursal.');

        $roles = array_map('intval', array_column($this->qRolesForCompany([$this->cid]), 'id'));

        foreach ($access as $a) {
            if (!$this->qBranchInCompany([$a['branch_id'], $this->cid])) return $this->invalid('access', 'Una de las sucursales no es de tu empresa.');
            if (!in_array($a['role_id'], $roles, true))                  return $this->invalid('access', 'Elige un rol para cada sucursal con acceso.');
        }

        return null;
    }

    private function userLimitError() {
        $limits = $this->limits()['users'];

        if ($limits['max'] !== null && $limits['used'] >= $limits['max']) {
            return ['status' => 409, 'message' => 'Tu plan incluye ' . $limits['max'] . ($limits['max'] === 1 ? ' usuario activo' : ' usuarios activos') . '. Desactiva a alguien o cambia de plan para agregar más.'];
        }

        return null;
    }

    // ============================================================= Roles

    function roles() {
        $roles = [];

        foreach ($this->listRoles([$this->cid, $this->cid]) as $r) {
            $roles[] = [
                'id'     => (int) $r['id'],
                'name'   => (string) $r['name'],
                // Del sistema: lo comparten todas las empresas, aqui solo se consulta.
                'system' => $this->lockedRole($r) ? 1 : 0,
                'active' => (int) $r['is_active'],
                'users'  => (int) $r['users'],
            ];
        }

        return ['status' => 200, 'data' => ['roles' => $roles]];
    }

    // El rol con lo que deja hacer, por modulo y seccion. id = 0: un rol nuevo, sin nada marcado.
    function getRole() {
        $id   = (int) ($_POST['id'] ?? 0);
        $role = null;

        if ($id > 0) {
            $role = $this->visibleRole($id);
            if (!$role) return ['status' => 404, 'message' => 'Ese rol no está disponible para tu empresa.'];
        }

        return [
            'status' => 200,
            'data'   => [
                'id'       => $id,
                'name'     => $role ? (string) $role['name'] : '',
                'system'   => $role && $this->lockedRole($role) ? 1 : 0,
                'modules'  => $this->permissionTree($id),
            ]
        ];
    }

    function saveRole() {
        $id   = (int) ($_POST['id'] ?? 0);
        $name = $this->text('name', 60);

        if ($name === null) return $this->invalid('name', 'Ponle nombre al rol.');

        if ($id > 0 && !$this->ownRole($id)) return ['status' => 404, 'message' => 'Ese rol no es de tu empresa.'];

        if ($this->qRoleNameExists([$name, $this->cid, $id])) return $this->invalid('name', 'Ya tienes un rol con ese nombre.');

        $wanted = [];
        foreach ((array) json_decode((string) ($_POST['permissions'] ?? '[]'), true) as $pid) $wanted[] = (int) $pid;

        return $this->transaction(function () use ($id, $name, $wanted) {
            if ($id === 0) {
                // Sin code: los permisos especiales se resuelven por roles.code
                // (root, dueno) y un rol de empresa no debe tener ninguno.
                $this->qInsertRole([null, $name, 0, $this->cid]);

                $id = $this->qLastInsertId();
                if (!$id) throw new \Exception('No se pudo obtener el id del rol creado');
            } else {
                $role = $this->qRole([$id]);
                $this->qUpdateRole([$role['code'], $name, $id]);
            }

            $this->syncPermissions($id, $wanted);

            return ['status' => 200, 'message' => 'Rol guardado.', 'id' => $id];
        });
    }

    // Un rol que alguien tiene no se apaga: esa gente se quedaria sin entrar.
    function toggleRole() {
        $id     = (int) ($_POST['id'] ?? 0);
        $active = (int) ($_POST['active'] ?? 0) === 1 ? 1 : 0;

        if (!$this->ownRole($id)) return ['status' => 404, 'message' => 'Ese rol no es de tu empresa.'];

        if ($active === 0) {
            foreach ($this->listRoles([$this->cid, $this->cid]) as $r) {
                if ((int) $r['id'] === $id && (int) $r['users'] > 0) {
                    return ['status' => 400, 'message' => 'Hay ' . (int) $r['users'] . ((int) $r['users'] === 1 ? ' persona' : ' personas') . ' con este rol. Cámbiales el rol en Usuarios antes de desactivarlo.'];
                }
            }
        }

        $ok = $this->qSetRoleActive([$active, $id]) === true;

        return ['status' => $ok ? 200 : 500, 'message' => $ok ? ($active ? 'Rol activado.' : 'Rol desactivado.') : 'No se pudo cambiar el estado.'];
    }

    // Un rol propio de la empresa (los del sistema no se editan aqui).
    private function ownRole($id) {
        $role = $id > 0 ? $this->qRole([$id]) : null;

        return $role && !$this->lockedRole($role) && (int) $role['company_id'] === $this->cid;
    }

    // Solo de consulta: los del sistema y los de codigo reservado (root, dueno),
    // que resuelven permisos especiales por su code.
    private function lockedRole($role) {
        return (int) $role['is_system'] === 1 || in_array(strtolower((string) ($role['code'] ?? '')), $this->reservedRoleCodes, true);
    }

    // Uno que la empresa puede ver: propio, o del sistema y activo. Nunca root.
    private function visibleRole($id) {
        $role = $this->qRole([$id]);

        if (!$role || $role['code'] === 'root') return null;
        if ((int) $role['is_system'] === 1)     return (int) $role['is_active'] === 1 ? $role : null;

        return (int) $role['company_id'] === $this->cid ? $role : null;
    }

    /*  Las acciones que este dueño puede conceder: las de los modulos que su
        empresa contrato (Plan::modules() ya deja fuera los de plataforma, como
        Developer). Devuelve las filas de qRolePermissions de esos modulos. */
    private function grantable($roleId) {
        $mine = array_map('intval', array_column(Plan::modules(), 'id'));

        return array_values(array_filter($this->qRolePermissions([$roleId]), function ($row) use ($mine) {
            return in_array((int) $row['module_id'], $mine, true);
        }));
    }

    // modulo > seccion > acciones, en el orden del menu.
    private function permissionTree($roleId) {
        $modules = [];

        foreach ($this->grantable($roleId) as $r) {
            $mid = (int) $r['module_id'];
            $sid = (int) $r['section_id'];

            if (!isset($modules[$mid])) {
                $modules[$mid] = ['id' => $mid, 'name' => $r['module_name'], 'icon' => $r['module_icon'] ?: 'layout-grid', 'sections' => []];
            }
            if (!isset($modules[$mid]['sections'][$sid])) {
                $modules[$mid]['sections'][$sid] = ['id' => $sid, 'name' => $r['section_name'], 'icon' => $r['section_icon'] ?: 'square', 'actions' => []];
            }

            $modules[$mid]['sections'][$sid]['actions'][] = [
                'id'      => (int) $r['permission_id'],
                'name'    => $r['type_name'],
                'granted' => (int) $r['granted'] === 1 ? 1 : 0,
            ];
        }

        foreach ($modules as &$m) $m['sections'] = array_values($m['sections']);
        unset($m);

        return array_values($modules);
    }

    // Deja al rol exactamente con $wanted, pero solo entre lo que se puede conceder.
    private function syncPermissions($roleId, $wanted) {
        $rows    = $this->grantable($roleId);
        $visible = array_map('intval', array_column($rows, 'permission_id'));
        $granted = [];

        foreach ($rows as $r) {
            if ((int) $r['granted'] === 1) $granted[] = (int) $r['permission_id'];
        }

        $wanted = array_values(array_intersect($wanted, $visible));

        foreach (array_diff($granted, $wanted) as $pid) $this->qDeleteRolePermission([$roleId, $pid]);
        foreach (array_diff($wanted, $granted) as $pid) $this->qInsertRolePermission([$roleId, $pid]);
    }

    // ====================================================== Plan y pagos

    function billing() {
        $state = Plan::state();
        $sub   = $state['sub'];
        $c     = $this->getCompany([$this->cid]);

        $price = null;
        if ($sub) {
            $price = $sub['price'] !== null ? $sub['price'] : ($sub['mode'] === 'custom' ? $this->getSubscriptionTotal([$sub['id']]) : null);
        }

        $modules = [];
        foreach (Plan::modules() as $m) $modules[] = ['name' => $m['name'], 'icon' => $m['icon'] ?: 'layout-grid'];

        $payments = [];
        foreach ($this->listPayments([$this->cid]) as $p) {
            $payments[] = [
                'id'       => (int) $p['id'],
                'day'      => (string) $p['day'],
                'amount'   => (float) $p['amount'],
                'currency' => $p['currency'] ?: 'MXN',
                'status'   => (string) $p['status'],
                'gateway'  => (string) $p['gateway'],
                'invoice'  => preg_match('#^https://#', (string) $p['invoice_url']) ? $p['invoice_url'] : '',
            ];
        }

        return [
            'status' => 200,
            'data'   => [
                'plan' => [
                    'ok'         => $state['ok'] ? 1 : 0,
                    'reason'     => $state['reason'],
                    'name'       => $sub ? (string) $sub['plan'] : '',
                    'status'     => $sub ? (string) $sub['status'] : '',
                    'price'      => $price,
                    'currency'   => $sub ? $sub['currency'] : 'MXN',
                    'cycle'      => $sub ? $sub['cycle'] : '',
                    'next'       => $sub && $sub['next'] ? substr($sub['next'], 0, 10) : '',
                    'trial_end'  => $sub ? $sub['trial_end'] : null,
                    'trial_left' => $sub ? $sub['trial_left'] : null,
                ],
                'modules'    => $modules,
                'limits'     => $this->limits(),
                'payments'   => $payments,
                'can_pay'    => $this->canPay($state) ? 1 : 0,
                // La forma de pago se administra en el portal de Stripe: hace
                // falta que la empresa ya sea su cliente (pago al menos una vez).
                'can_portal' => Stripe::ready() && $c && !empty($c['stripe_customer_id']) ? 1 : 0,
            ]
        ];
    }

    private function canPay($state) {
        return !$state['ok'] && $state['sub'] !== null && Stripe::ready();
    }

    // "Pagar ahora": a la pagina de pago de Stripe. Al volver, el inicio la concilia.
    function checkout() {
        if (!$this->canPay(Plan::state())) {
            return ['status' => 403, 'message' => 'El pago en línea no está disponible para tu cuenta. Contáctanos.'];
        }

        $billing = new Billing(4);

        list($url, $error) = $billing->checkout(
            $billing->currentSubscriptionId($this->cid),
            $billing->url . 'app/home/?session_id={CHECKOUT_SESSION_ID}',
            $billing->url . 'app/configuracion/#pagos'
        );

        return $error ? ['status' => 502, 'message' => $error] : ['status' => 200, 'url' => $url];
    }

    /*  "Forma de pago": el portal de cliente de Stripe, donde cambia su
        tarjeta y baja sus facturas. Los datos de la tarjeta nunca pasan por
        Huubie. */
    function portal() {
        $c = $this->getCompany([$this->cid]);

        if (!$c || empty($c['stripe_customer_id'])) {
            return ['status' => 400, 'message' => 'Todavía no tienes una forma de pago registrada. Se guarda con tu primer pago.'];
        }

        list($session, $error) = Stripe::request('POST', 'billing_portal/sessions', [
            'customer'   => $c['stripe_customer_id'],
            'return_url' => Billing::proUrl(4) . 'app/configuracion/#pagos',
        ]);

        return $error ? ['status' => 502, 'message' => $error] : ['status' => 200, 'url' => $session['url']];
    }

    // ====================================================== Cambiar de plan

    /*  Los planes de Huubie entre los que el dueño puede elegir, con lo que
        trae cada uno, y los modulos sueltos para el Personalizado. */
    function plans() {
        $sub = $this->getSubscription([$this->cid]);

        $included = [];
        foreach ($this->listPlanModules() as $row) $included[(int) $row['plan_id']][] = $row['name'];

        $plans = [];
        foreach ($this->listHuubiePlans() as $p) {
            $features = json_decode((string) $p['features'], true);

            $plans[] = [
                'id'           => (int) $p['id'],
                'name'         => (string) $p['name'],
                'description'  => (string) $p['description'],
                'price'        => $p['price'] === null ? null : (float) $p['price'],
                'price_before' => $p['price_before'] === null ? null : (float) $p['price_before'],
                'currency'     => $p['currency'] ?: 'MXN',
                'cycle'        => $p['billing_cycle'] ?: 'monthly',
                'max_users'    => $p['max_users'] === null ? null : (int) $p['max_users'],
                'max_branches' => $p['max_branches'] === null ? null : (int) $p['max_branches'],
                'features'     => is_array($features) ? array_values(array_map('strval', $features)) : [],
                // included: trae sus modulos · custom: se arma por modulos y cuesta
                // lo que sumen · pick: se eligen `pick` modulos · all: todos.
                'mode'         => (string) $p['modules_mode'],
                'pick'         => $p['modules_pick'] === null ? 0 : (int) $p['modules_pick'],
                'modules'      => $included[(int) $p['id']] ?? [],
                'featured'     => (int) $p['featured'],
            ];
        }

        $modules = [];
        foreach ($this->listSellableModules() as $m) {
            $modules[] = ['id' => (int) $m['id'], 'name' => (string) $m['name'], 'icon' => $m['icon'] ?: 'layout-grid', 'text' => (string) $m['description'], 'price' => (float) $m['price']];
        }

        // Lo que ya tiene elegido (Personalizado o plan a elegir), con el precio contratado.
        $mine = [];
        if ($sub) {
            foreach ($this->qSubscriptionModules([$sub['id']]) as $row) $mine[] = ['id' => (int) $row['module_id'], 'price' => (float) $row['price']];
        }

        return [
            'status' => 200,
            'data'   => [
                'plans'   => $plans,
                'modules' => $modules,
                'current' => $sub ? (int) $sub['plan_id'] : 0,
                'mine'    => $mine,
                'next'    => $sub ? (string) $sub['next'] : '',
                // Con cobro automatico el precio nuevo entra en la siguiente factura.
                'auto'    => $sub && !empty($sub['stripe_subscription_id']) ? 1 : 0,
                'limits'  => $this->limits(),
            ]
        ];
    }

    /*  Cambia el plan de la empresa. Lo que incluye el plan nuevo aplica desde
        ya; el precio nuevo se cobra en el SIGUIENTE pago, sin prorrateo: no se
        cobra ni se devuelve nada por los dias que quedan del periodo.

        Si la empresa paga con cobro automatico (suscripcion de Stripe), primero
        se le cambia el precio alla: si Stripe no lo acepta, aqui no cambia
        nada y no hay forma de quedar con un plan y cobrando otro. */
    function changePlan() {
        $planId = (int) ($_POST['plan_id'] ?? 0);
        $sub    = $this->getSubscription([$this->cid]);

        if (!$sub) return ['status' => 404, 'message' => 'Tu empresa todavía no tiene una suscripción. Contáctanos para contratar un plan.'];

        $plan = null;
        foreach ($this->listHuubiePlans() as $p) {
            if ((int) $p['id'] === $planId) $plan = $p;
        }

        if (!$plan) return ['status' => 404, 'message' => 'Ese plan no está disponible.'];

        // Lo que ya usa tiene que caber en el plan nuevo.
        $limits = $this->limits();

        if ($plan['max_branches'] !== null && $limits['branches']['used'] > (int) $plan['max_branches']) {
            return ['status' => 409, 'message' => 'El plan ' . $plan['name'] . ' incluye ' . (int) $plan['max_branches'] . ' ' . ((int) $plan['max_branches'] === 1 ? 'sucursal' : 'sucursales') . ' y tienes ' . $limits['branches']['used'] . ' activas. Desactiva las que sobren en Sucursales y vuelve a intentarlo.'];
        }
        if ($plan['max_users'] !== null && $limits['users']['used'] > (int) $plan['max_users']) {
            return ['status' => 409, 'message' => 'El plan ' . $plan['name'] . ' incluye ' . (int) $plan['max_users'] . ' ' . ((int) $plan['max_users'] === 1 ? 'usuario' : 'usuarios') . ' y tienes ' . $limits['users']['used'] . ' activos. Desactiva a quienes sobren en Usuarios y vuelve a intentarlo.'];
        }

        $picked = $this->pickedModules($plan, $sub);
        if (isset($picked['error'])) return ['status' => 400, 'field' => 'modules', 'message' => $picked['error']];

        $prices = $picked['prices'];
        $amount = $plan['modules_mode'] === 'custom' ? array_sum($prices) : (float) $plan['price'];

        // Lo mismo que ya tiene: nada que hacer.
        $before = [];
        foreach ($this->qSubscriptionModules([$sub['id']]) as $row) $before[] = (int) $row['module_id'];
        $after = array_keys($prices);
        sort($before);
        sort($after);

        if ((int) $sub['plan_id'] === $planId && $before === $after) {
            return ['status' => 200, 'message' => 'Ya tienes ese plan.', 'unchanged' => 1];
        }

        if (!empty($sub['stripe_subscription_id'])) {
            $names = [];
            foreach ($this->listSellableModules() as $m) {
                if (isset($prices[(int) $m['id']])) $names[] = $m['name'];
            }

            $error = (new Billing(4))->changePrice($sub['stripe_subscription_id'], 'Huubie · Plan ' . $plan['name'], $amount, $plan['currency'] ?: 'MXN', $plan['billing_cycle'], implode(', ', $names));

            if ($error) return ['status' => 502, 'message' => 'No pudimos actualizar tu cobro, así que tu plan no cambió. ' . $error];
        }

        return $this->transaction(function () use ($sub, $plan, $planId, $prices, $amount) {
            if ($this->updateSubscriptionPlan([$planId, $sub['id'], $this->cid]) !== true) throw new \Exception('subscriptions');

            $this->qDeleteSubscriptionModules([$sub['id']]);
            foreach ($prices as $moduleId => $price) {
                if (!$this->qInsertSubscriptionModule([$sub['id'], $moduleId, $price])) throw new \Exception('subscription_module');
            }

            $cost = '$' . number_format($amount, 2) . ' ' . ($plan['currency'] ?: 'MXN') . ' más IVA';

            return ['status' => 200, 'message' => 'Listo: ahora tienes el plan ' . $plan['name'] . '. Tu siguiente pago será de ' . $cost . '.'];
        });
    }

    /*  Los modulos del plan nuevo, con lo que se cobra por cada uno
        ([module_id => precio]), o el motivo por el que no se acepta.
          custom  al menos uno; cada uno a su precio de lista, salvo los que ya
                  tenia contratados, que conservan el suyo.
          pick    exactamente los que dice el plan; van en 0 (se cobra el plan).
          otros   el plan ya dice que modulos trae: no se guarda ninguno. */
    private function pickedModules($plan, $sub) {
        $mode = $plan['modules_mode'];

        if ($mode !== 'custom' && $mode !== 'pick') return ['prices' => []];

        $catalog = [];
        foreach ($this->listSellableModules() as $m) $catalog[(int) $m['id']] = (float) $m['price'];

        $wanted = [];
        foreach ((array) json_decode((string) ($_POST['modules'] ?? '[]'), true) as $id) {
            $id = (int) $id;
            if (isset($catalog[$id])) $wanted[$id] = true;
        }
        $wanted = array_keys($wanted);

        if ($mode === 'pick') {
            $pick = (int) $plan['modules_pick'];

            if (count($wanted) !== $pick) return ['error' => 'El plan ' . $plan['name'] . ' incluye ' . $pick . ' ' . ($pick === 1 ? 'módulo' : 'módulos') . ' a elegir: marca exactamente ' . $pick . '.'];

            return ['prices' => array_fill_keys($wanted, 0.0)];
        }

        if (!$wanted) return ['error' => 'El plan ' . $plan['name'] . ' se arma por módulos: elige al menos uno.'];

        // El precio contratado solo se conserva si ya estaba en un Personalizado.
        $kept = [];
        if ((int) $sub['plan_id'] === (int) $plan['id']) {
            foreach ($this->qSubscriptionModules([$sub['id']]) as $row) $kept[(int) $row['module_id']] = (float) $row['price'];
        }

        $prices = [];
        foreach ($wanted as $id) $prices[$id] = $kept[$id] ?? $catalog[$id];

        return ['prices' => $prices];
    }

    // ============================================================ Comunes

    // Cuanto lleva usado de lo que su plan le deja. max null = sin tope.
    private function limits() {
        $plan = $this->getPlanLimits([$this->cid]);

        return [
            'branches' => ['used' => $this->qCountActiveBranches([$this->cid]), 'max' => $plan['max_branches'] === null ? null : (int) $plan['max_branches']],
            'users'    => ['used' => $this->countActiveUsers([$this->cid]),     'max' => $plan['max_users'] === null ? null : (int) $plan['max_users']],
        ];
    }

    private function invalid($field, $message, $status = 400) {
        return ['status' => $status, 'field' => $field, 'message' => $message];
    }

    // Texto recortado al ancho de su columna; vacio -> null.
    private function text($key, $max) {
        $value = trim(preg_replace('/\s+/', ' ', (string) ($_POST[$key] ?? '')));
        return $value === '' ? null : mb_substr($value, 0, $max);
    }
}

if (!in_array($_POST['opc'], ctrl::OPS, true)) exit(0);

header('Content-Type: application/json; charset=utf-8');

if (Session::user() === null) {
    echo json_encode(['status' => 401, 'message' => 'Tu sesión terminó. Vuelve a iniciar sesión.']);
    exit(0);
}

// Solo el dueño de la empresa (o root viendola como tal: app/empresas le pone is_owner).
if (empty($_SESSION['company_id']) || empty($_SESSION['is_owner'])) {
    echo json_encode(['status' => 403, 'message' => 'Solo el dueño puede administrar la empresa.']);
    exit(0);
}

$obj = new ctrl();

if (in_array($_POST['opc'], ctrl::READ_ONLY, true)) session_write_close();

try {
    echo json_encode($obj->{$_POST['opc']}());
} catch (\Throwable $e) {
    echo json_encode(['status' => 500, 'message' => 'No pudimos completar la operación. Inténtalo de nuevo.']);
}
