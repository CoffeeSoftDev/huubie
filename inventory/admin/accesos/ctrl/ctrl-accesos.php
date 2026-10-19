<?php
require_once __DIR__ . '/../../../conf/_Session.php';
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-accesos.php';
require_once '../../../conf/_Permissions.php';
require_once '../../../conf/_Auditoria.php';

class ctrl extends mdl {

    // Acción del rol que pide cada opc (conf/_Permissions.php); los demás solo
    // piden poder entrar a Configuración > Accesos. Apagar un usuario o una
    // sucursal es darlo de baja; borrar un rol es eliminar.
    const PERMISSIONS = [
        'addBranch'           => 'agregar',
        'addUser'             => 'agregar',
        'addRole'             => 'agregar',
        'editBranch'          => 'editar',
        'editUser'            => 'editar',
        'changePassword'      => 'editar',
        'editRole'            => 'editar',
        'saveRolePermissions' => 'editar',
        'toggleBranch'        => 'cancelar',
        'toggleUser'          => 'cancelar',
        'deleteRole'          => 'eliminar'
    ];

    // Acciones de la bitácora: etiqueta, color de texto, fondo e ícono del badge.
    const AUDIT_ACTIONS = [
        'crear'          => ['Alta',              '#15803D', '#DCFCE7', 'plus'],
        'editar'         => ['Edición',           '#1D4ED8', '#DBEAFE', 'pencil'],
        'permisos'       => ['Permisos',          '#6D28D9', '#EDE9FE', 'shield-check'],
        'contrasena'     => ['Contraseña',        '#B45309', '#FEF3C7', 'key-round'],
        'activar'        => ['Activación',        '#15803D', '#DCFCE7', 'toggle-right'],
        'desactivar'     => ['Baja',              '#B91C1C', '#FEE2E2', 'toggle-left'],
        'eliminar'       => ['Eliminación',       '#B91C1C', '#FEE2E2', 'trash-2'],
        'iniciar-sesion' => ['Inicio de sesión',  '#475569', '#F1F5F9', 'log-in'],
        'cerrar-sesion'  => ['Cierre de sesión',  '#475569', '#F1F5F9', 'log-out'],
        'entrar-empresa' => ['Entrada a empresa', '#0E7490', '#CFFAFE', 'building-2']
    ];

    const AUDIT_ENTITIES = [
        'users'    => 'Usuario',
        'roles'    => 'Rol',
        'branches' => 'Sucursal',
        'sesion'   => 'Sesión'
    ];

    // Tope de renglones de la bitácora por consulta.
    const AUDIT_LIMIT = 1000;

    // Códigos que dan rango (conf/_Permissions.php, la jerarquía de abajo): un
    // rol nuevo de la empresa no puede llamarse así.
    const RESERVED_CODES = ['superadmin', 'dueno'];

    public $companiesId;
    public $branchId;
    public $userId;
    private $actor;
    private $actorRoles;

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
            'sucursales'   => $this->qBranchesForSelect([$this->companiesId]),
            'roles'        => $this->qRolesForSelect([$this->companiesId, $this->canAssignOwner() ? 1 : 0]),
            'usuarios'     => $this->qUsersForSelect([$this->companiesId])
        ];
    }

    /* ====================== Resumen ====================== */

    function showResumen() {
        $c = $this->qSummaryCounts(array_merge(array_fill(0, 5, $this->companiesId), [$this->seesSuperAdminLog()]));

        $actividad = array_map(function ($a) {
            $action = self::AUDIT_ACTIONS[$a['action']] ?? [$a['action'], '#475569', '#F1F5F9', 'circle'];
            // En las de sesión el elemento es la misma persona: no se repite su nombre.
            $target = $a['entity'] === 'sesion' ? '' : ': ' . $a['label'];
            return [
                'id'    => (int) $a['id'],
                'icon'  => $action[3],
                'label' => trim(($a['user_name'] ?: 'Alguien') . ' · ' . mb_strtolower($action[0]) . $target),
                'meta'  => date('d/m/Y H:i', strtotime($a['created_at'])) . ' · ' . (self::AUDIT_ENTITIES[$a['entity']] ?? $a['entity'])
            ];
        }, $this->qRecentAudit([$this->companiesId, $this->seesSuperAdminLog()]));

        $roles = array_map(function ($r) {
            return [
                'id'      => (int) $r['id'],
                'name'    => $r['name'],
                'users'   => (int) $r['users'],
                'actions' => (int) $r['actions']
            ];
        }, $this->qCompanyRoles([$this->companiesId]));

        return [
            'status'    => 200,
            'counts'    => [
                'usuarios_activos' => (int) ($c['usuarios_activos'] ?? 0),
                'usuarios_total'   => (int) ($c['usuarios_total'] ?? 0),
                'roles'            => (int) ($c['roles'] ?? 0),
                'sucursales'       => (int) ($c['sucursales'] ?? 0),
                'movimientos_hoy'  => (int) ($c['movimientos_hoy'] ?? 0)
            ],
            'actividad' => $actividad,
            'roles'     => $roles
        ];
    }

    /* ====================== Sucursales (branches) ====================== */

    // Trae también lo que deja el plan: el front lo refresca con la tabla, que se
    // vuelve a pedir después de cada alta o cambio de estado.
    function lsBranches() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $ls     = $this->qBranches([$this->companiesId, $active]);
        $plan   = $this->branchPlan();

        $row = [];
        foreach ($ls as $b) {
            $a = [];
            $a[] = [
                'class'   => self::ACTION_BUTTON . 'text-gray-500 hover:bg-gray-100 hover:text-blue-600',
                'html'    => '<i class="icon-pencil"></i>',
                'title'   => 'Configurar sucursal',
                'onclick' => 'subsidiaries.editSubsidiary(' . $b['id'] . ')'
            ];
            if ($b['is_active'] == 1) {
                $a[] = [
                    'class'   => self::ACTION_BUTTON . 'text-red-500 hover:bg-red-50 hover:text-red-600',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'subsidiaries.toggleSubsidiary(' . $b['id'] . ', 0)'
                ];
            } else {
                // Con el plan lleno se ve apagado; al tocarlo el front explica por qué.
                $a[] = [
                    'class'   => self::ACTION_BUTTON . ($plan['canCreate'] ? 'text-gray-400 hover:bg-gray-100 hover:text-green-600' : 'text-gray-300 cursor-not-allowed'),
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'subsidiaries.toggleSubsidiary(' . $b['id'] . ', 1)'
                ];
            }

            $name = $this->branchAvatar($b) . htmlspecialchars($b['name']);
            if ((int) $b['id'] === $this->branchId) {
                // Dentro del inline-flex el espacio se pierde: el margen lo separa del nombre.
                $name .= '<span class="ml-2 whitespace-nowrap">' . badge('Tu sucursal', 'var(--accent-soft-fg, rgb(var(--brand-700, 168 74 51)))', 100, 'var(--accent-soft-bg, rgb(var(--brand-100, 247 227 220)))') . '</span>';
            }

            $row[] = [
                'id'          => $b['id'],
                'Sucursal'    => '<span class="inline-flex items-center">' . $name . '</span>',
                'Dirección'   => $b['ubication'] ? htmlspecialchars($b['ubication']) : '-',
                'Teléfono'    => $b['phone'] ? htmlspecialchars($b['phone']) : '-',
                'Correo'      => $b['email'] ? htmlspecialchars($b['email']) : '-',
                'Responsable' => trim((string) $b['manager_name']) !== ''
                    ? htmlspecialchars($b['manager_name'])
                    : '<span class="italic text-gray-400 text-sm">Sin asignar</span>',
                'Estado'      => renderStatus($b['is_active']),
                'a'           => Permissions::rowActions('configuracion-accesos', $a)
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls, 'plan' => $plan];
    }

    function getBranch() {
        $data = $this->qBranch([(int) $_POST['id'], $this->companiesId]);
        if ($data) $data['logo_url'] = $this->imageUrl('branches', $data['logo'] ?? '');

        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'OK' : 'Sucursal no encontrada',
            'data'    => $data
        ];
    }

    function addBranch() {
        $plan = $this->branchPlan();
        if (!$plan['canCreate']) {
            return ['status' => 409, 'message' => $plan['denied']['agregar']];
        }

        $fields = $this->branchFields();
        $error  = $this->branchError($fields, 0);
        if ($error) return ['status' => 400, 'message' => $error];

        $id = $this->transaction(function () use ($fields) {
            $this->qInsertBranch([
                $fields['name'],
                $fields['ubication'],
                $fields['phone'],
                $fields['email'],
                $fields['manager_id'],
                $fields['folio_code'],
                $this->companiesId
            ]);

            $newId = $this->qLastInsertId();
            if (!$newId) throw new \Exception('No se pudo obtener el id de la sucursal creada');

            // El logo lleva el id en su nombre de archivo: va después del alta.
            if ($this->imageTouched('logo')) {
                $this->qUpdateBranchLogo([$this->saveImage('branches', 'logo', 'branch', $newId, ''), $newId, $this->companiesId]);
            }

            return $newId;
        });

        Auditoria::registrar('crear', 'branches', $id, $fields['name'], [
            'cambios' => $this->diffRows([], $this->branchSnapshot($fields, $this->imageTouched('logo') ? 'Con logo' : ''), self::BRANCH_FIELDS)
        ]);

        return ['status' => 200, 'message' => 'Sucursal creada correctamente'];
    }

    function editBranch() {
        $id     = (int) $_POST['id'];
        $fields = $this->branchFields();

        $current = $this->qBranch([$id, $this->companiesId]);
        if (!$current) {
            return ['status' => 404, 'message' => 'Sucursal no encontrada'];
        }

        $error = $this->branchError($fields, $id);
        if ($error) return ['status' => 400, 'message' => $error];

        $logoTouched = $this->imageTouched('logo');

        $this->transaction(function () use ($id, $fields, $current, $logoTouched) {
            $this->qUpdateBranch([
                $fields['name'],
                $fields['ubication'],
                $fields['phone'],
                $fields['email'],
                $fields['manager_id'],
                $fields['folio_code'],
                $id,
                $this->companiesId
            ]);

            if ($logoTouched) {
                $this->qUpdateBranchLogo([$this->saveImage('branches', 'logo', 'branch', $id, $current['logo'] ?? ''), $id, $this->companiesId]);
            }
        });

        $before = $this->branchSnapshot([
            'name'       => $current['name'],
            'ubication'  => $current['ubication'],
            'phone'      => $current['phone'],
            'email'      => $current['email'],
            'manager_id' => $current['manager_id'],
            'folio_code' => $current['folio_code']
        ], '');
        $after = $this->branchSnapshot($fields, $logoTouched ? (($_POST['logo_clear'] ?? '') === '1' ? 'Se quitó' : 'Se cambió') : '');

        $cambios = $this->diffRows($before, $after, self::BRANCH_FIELDS);
        if ($cambios) Auditoria::registrar('editar', 'branches', $id, $fields['name'], ['cambios' => $cambios]);

        return ['status' => 200, 'message' => 'Sucursal actualizada correctamente'];
    }

    function toggleBranch() {
        $id     = (int) $_POST['id'];
        $active = (int) $_POST['active'];

        $current = $this->qBranch([$id, $this->companiesId]);
        if (!$current) {
            return ['status' => 404, 'message' => 'Sucursal no encontrada'];
        }

        // Reactivar también ocupa un lugar del plan: si no, bastaba desactivar,
        // crear otra y volver a activar la primera.
        if ($active === 1 && (int) $current['is_active'] !== 1) {
            $plan = $this->branchPlan();
            if (!$plan['canCreate']) {
                return ['status' => 409, 'message' => $plan['denied']['activar']];
            }
        }

        $ok = $this->qSetBranchActive([$active, $id, $this->companiesId]);
        if ($ok) Auditoria::registrar($active ? 'activar' : 'desactivar', 'branches', $id, $current['name']);

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? ($active ? 'Sucursal activada' : 'Sucursal desactivada') : 'No se pudo actualizar el estado'
        ];
    }

    /*  Cuántas sucursales activas deja el plan de la empresa. Mismo criterio que
        DEV (tenant/ctrl addBranch): el plan de la suscripción activa o en prueba
        más reciente, y cuentan las sucursales activas. Sin plan, o con un plan
        sin tope, no hay límite. Vale para todos, Super Admin incluido: el plan
        se cambia en DEV. */
    private function branchPlan() {
        $plan   = $this->qActivePlan([$this->companiesId]);
        $active = $this->qCountActiveBranches([$this->companiesId]);
        $max    = $plan && $plan['max_branches'] !== null ? (int) $plan['max_branches'] : null;

        $info = [
            'name'      => $plan ? (string) $plan['name'] : '',
            'max'       => $max,
            'active'    => $active,
            'canCreate' => $max === null || $active < $max,
            'title'     => '',
            'message'   => ''
        ];

        if (!$plan) return $info;

        if ($max === null) {
            $info['title']   = 'Plan ' . $plan['name'] . ' · sin límite de sucursales';
            $info['message'] = $active === 1 ? 'Tienes 1 sucursal activa.' : "Tienes {$active} sucursales activas.";
            return $info;
        }

        $left = $max - $active;
        $info['title'] = 'Plan ' . $plan['name'] . ' · permite ' . $max . ($max === 1 ? ' sucursal activa' : ' sucursales activas');

        if ($left > 0) {
            $info['message'] = 'Puedes agregar ' . $left . ($left === 1 ? ' sucursal más.' : ' sucursales más.');
            return $info;
        }

        $info['message'] = $left === 0
            ? 'Llegaste al límite de tu plan: para agregar otra sucursal, mejora el plan o desactiva una.'
            : 'Tienes más sucursales activas de las que permite tu plan: no se pueden agregar ni activar más.';

        // Por qué se niega cada acción: lo que responden addBranch y toggleBranch
        // y lo que el front avisa antes de pedirlas.
        $info['denied'] = [
            'agregar' => $this->planDenied($info, 'agregar otra'),
            'activar' => $this->planDenied($info, 'activar esta')
        ];

        return $info;
    }

    private function planDenied($plan, $what) {
        return 'El plan ' . $plan['name'] . ' permite ' . $plan['max'] . ($plan['max'] === 1 ? ' sucursal activa' : ' sucursales activas')
             . ' y ya tienes ' . $plan['active'] . '. Para ' . $what . ', mejora el plan o desactiva una sucursal.';
    }

    // Campos de la sucursal y su etiqueta en la bitácora.
    const BRANCH_FIELDS = [
        'name'      => 'Nombre',
        'ubication' => 'Dirección',
        'phone'     => 'Teléfono',
        'email'     => 'Correo',
        'manager'   => 'Responsable',
        'folio_code'=> 'Clave de folios',
        'logo'      => 'Logo'
    ];

    // folio_code vacío = la arma Almacén del nombre la primera vez que saca un folio.
    private function branchFields() {
        $phone = trim((string) ($_POST['phone'] ?? ''));

        return [
            'name'       => trim((string) ($_POST['name'] ?? '')),
            'ubication'  => trim((string) ($_POST['ubication'] ?? '')) ?: null,
            'phone'      => $phone !== '' ? mb_substr($phone, 0, 20) : null,
            'email'      => trim((string) ($_POST['email'] ?? '')) ?: null,
            'manager_id' => (int) ($_POST['manager_id'] ?? 0) ?: null,
            'folio_code' => strtoupper(trim((string) ($_POST['folio_code'] ?? ''))) ?: null
        ];
    }

    private function branchError($fields, $id) {
        if ($fields['name'] === '') return 'El nombre de la sucursal es obligatorio';
        if ($this->qBranchNameExists([$fields['name'], $this->companiesId, $id])) return 'Ya existe una sucursal con ese nombre';
        if ($fields['folio_code'] !== null && !preg_match('/^[A-Z0-9]{2,5}$/', $fields['folio_code'])) return 'La clave de folios lleva de 2 a 5 letras o números, sin espacios';
        if ($fields['folio_code'] !== null && $this->qBranchFolioCodeExists([$fields['folio_code'], $this->companiesId, $id])) return 'Otra sucursal ya usa esa clave de folios';
        if ($fields['email'] !== null && !filter_var($fields['email'], FILTER_VALIDATE_EMAIL)) return 'El correo de la sucursal no es válido';
        if ($fields['phone'] !== null && !preg_match('/^[0-9+()\s.-]{7,20}$/', $fields['phone'])) return 'El teléfono solo lleva números, espacios, +, ( ) y guiones';

        if ($fields['manager_id'] !== null) {
            $manager = $this->qUser([$fields['manager_id'], $this->companiesId]);
            if (!$manager || $manager['status'] !== 'active') return 'El responsable debe ser un usuario activo de la empresa';
        }

        return '';
    }

    // Lo que la bitácora cuenta de una sucursal: el responsable por nombre.
    private function branchSnapshot($fields, $logo) {
        $manager = '';
        if (!empty($fields['manager_id'])) {
            $user    = $this->qUser([(int) $fields['manager_id'], $this->companiesId]);
            $manager = $user ? trim($user['name'] . ' ' . ($user['last_name'] ?? '')) : '';
        }

        return [
            'name'      => (string) $fields['name'],
            'ubication' => (string) ($fields['ubication'] ?? ''),
            'phone'     => (string) ($fields['phone'] ?? ''),
            'email'     => (string) ($fields['email'] ?? ''),
            'manager'   => $manager,
            'folio_code'=> (string) ($fields['folio_code'] ?? ''),
            'logo'      => $logo
        ];
    }

    private function branchAvatar($b) {
        $logo = $this->imageUrl('branches', $b['logo'] ?? '');

        if ($logo !== '') {
            return '<img src="' . htmlspecialchars($logo) . '" alt="" style="width:28px;height:28px;border-radius:8px;object-fit:cover;margin-right:8px;flex-shrink:0;">';
        }

        $initial = mb_strtoupper(mb_substr(trim($b['name']), 0, 1));
        return '<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:var(--accent-soft-bg, rgb(var(--brand-100, 247 227 220)));color:var(--accent-soft-fg, rgb(var(--brand-700, 168 74 51)));font-size:12px;font-weight:700;margin-right:8px;flex-shrink:0;">' . htmlspecialchars($initial) . '</span>';
    }

    /* ====================== Roles ====================== */

    // Solo los roles de la empresa (is_system = 0): los del sistema no salen ni
    // se pueden pedir por id. Cada uno trae si se puede cambiar y borrar.
    function lsRoles() {
        $ls = $this->qCompanyRoles([$this->companiesId]);

        $roles = array_map(function ($r) {
            return $this->roleRow($r);
        }, $ls);

        return [
            'status'    => 200,
            'roles'     => $roles,
            'templates' => array_map(function ($r) {
                return ['id' => (int) $r['id'], 'valor' => $r['name']];
            }, $ls)
        ];
    }

    function getRole() {
        $role = $this->companyRole((int) ($_POST['id'] ?? 0));
        if (!$role) return ['status' => 404, 'message' => 'Rol no encontrado'];

        $row = null;
        foreach ($this->qCompanyRoles([$this->companiesId]) as $r) {
            if ((int) $r['id'] === (int) $role['id']) $row = $this->roleRow($r);
        }

        return [
            'status'  => 200,
            'role'    => $row,
            'catalog' => $this->roleCatalog((int) $role['id'])
        ];
    }

    function addRole() {
        $name        = trim((string) ($_POST['name'] ?? ''));
        $description = trim((string) ($_POST['description'] ?? '')) ?: null;
        $templateId  = (int) ($_POST['template_id'] ?? 0);
        $code        = $this->slug($name);

        if ($name === '') return ['status' => 400, 'message' => 'El nombre del rol es obligatorio'];
        if ($code === '' || in_array($code, self::RESERVED_CODES, true)) {
            return ['status' => 400, 'message' => 'Ese nombre está reservado para un rol del sistema'];
        }
        if ($this->qRoleNameExists([$name, $this->companiesId, 0])) {
            return ['status' => 409, 'message' => 'Ya existe un rol con ese nombre'];
        }

        $template = $templateId > 0 ? $this->companyRole($templateId) : null;
        if ($templateId > 0 && !$template) {
            return ['status' => 400, 'message' => 'El rol a copiar no es válido'];
        }

        $copied = [];
        if ($template) {
            $templateCatalog = $this->qRoleCatalog([(int) $template['id']]);
            foreach ($templateCatalog as $p) {
                if ((int) $p['granted'] === 1) $copied[] = (int) $p['permission_id'];
            }
            $copied = $this->withViewAction($templateCatalog, $copied);
        }

        $id = $this->transaction(function () use ($code, $name, $description, $copied) {
            $this->qInsertRole([$code, $name, $description, $this->companiesId]);

            $newId = $this->qLastInsertId();
            if (!$newId) throw new \Exception('No se pudo obtener el id del rol creado');

            foreach ($copied as $permissionId) {
                $this->qInsertRolePermission([$newId, $permissionId]);
            }

            return $newId;
        });

        $cambios = $this->diffRows([], [
            'name'        => $name,
            'description' => (string) $description,
            'template'    => $template ? $template['name'] . ' (' . count($copied) . ' acciones)' : ''
        ], self::ROLE_FIELDS);
        Auditoria::registrar('crear', 'roles', $id, $name, ['cambios' => $cambios]);

        return ['status' => 200, 'message' => 'Rol creado correctamente', 'id' => $id];
    }

    function editRole() {
        $id          = (int) ($_POST['id'] ?? 0);
        $name        = trim((string) ($_POST['name'] ?? ''));
        $description = trim((string) ($_POST['description'] ?? '')) ?: null;

        $role = $this->companyRole($id);
        if (!$role) return ['status' => 404, 'message' => 'Rol no encontrado'];

        $lock = $this->roleLock($role);
        if ($lock) return ['status' => 403, 'message' => $lock];

        if ($name === '') return ['status' => 400, 'message' => 'El nombre del rol es obligatorio'];
        if ($this->qRoleNameExists([$name, $this->companiesId, $id])) {
            return ['status' => 409, 'message' => 'Ya existe otro rol con ese nombre'];
        }

        // El código no se toca: es el que da rango al Dueño y no cambia al renombrar.
        $ok = $this->qUpdateRole([$name, $description, $id, $this->companiesId]);

        if ($ok) {
            $cambios = $this->diffRows(
                ['name' => $role['name'], 'description' => (string) $role['description']],
                ['name' => $name, 'description' => (string) $description],
                self::ROLE_FIELDS
            );
            if ($cambios) Auditoria::registrar('editar', 'roles', $id, $name, ['cambios' => $cambios]);
        }

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Rol actualizado correctamente' : 'No se pudo actualizar el rol'
        ];
    }

    /*  Deja en permissions_roles exactamente las acciones marcadas, pero solo
        entre las del catálogo de la empresa (qRoleCatalog): lo apagado o de la
        plataforma no sale en la matriz y se conserva tal cual. */
    function saveRolePermissions() {
        $id   = (int) ($_POST['id'] ?? 0);
        $role = $this->companyRole($id);
        if (!$role) return ['status' => 404, 'message' => 'Rol no encontrado'];

        $lock = $this->roleLock($role);
        if ($lock) return ['status' => 403, 'message' => $lock];

        $catalog = $this->qRoleCatalog([$id]);
        $visible = array_map('intval', array_column($catalog, 'permission_id'));
        $granted = [];
        foreach ($catalog as $p) {
            if ((int) $p['granted'] === 1) $granted[] = (int) $p['permission_id'];
        }

        $wanted = array_values(array_intersect($this->postedIds($_POST['permissions'] ?? '[]'), $visible));
        $wanted = $this->withViewAction($catalog, $wanted);
        $remove = array_values(array_diff($granted, $wanted));
        $add    = array_values(array_diff($wanted, $granted));

        if (!$remove && !$add) return ['status' => 200, 'message' => 'Sin cambios en los permisos'];

        // Quitarle a su propio rol todo Configuración > Accesos lo dejaría fuera de
        // esta pantalla (y a todos los que tienen ese rol), sin nadie de la empresa
        // que pueda devolvérselo. El Super Admin no corre ese riesgo.
        if ($this->locksOutActor($id, $catalog, $wanted)) {
            return ['status' => 409, 'message' => 'Tu propio rol tiene que conservar al menos una acción en Configuración > Accesos'];
        }

        $this->transaction(function () use ($id, $remove, $add) {
            foreach ($remove as $permissionId) $this->qDeleteRolePermission([$id, $permissionId]);
            foreach ($add as $permissionId)    $this->qInsertRolePermission([$id, $permissionId]);
        });

        Auditoria::registrar('permisos', 'roles', $id, $role['name'], [
            'cambios' => $this->permissionDiff($catalog, $wanted)
        ]);

        return ['status' => 200, 'message' => 'Permisos de «' . $role['name'] . '» guardados'];
    }

    function deleteRole() {
        $id   = (int) ($_POST['id'] ?? 0);
        $role = $this->companyRole($id);
        if (!$role) return ['status' => 404, 'message' => 'Rol no encontrado'];

        $lock = $this->deleteLock($role);
        if ($lock) return ['status' => 409, 'message' => $lock];

        $actions = 0;
        foreach ($this->qRoleCatalog([$id]) as $p) $actions += (int) $p['granted'];

        $this->transaction(function () use ($id) {
            $this->qDeleteRolePermissions([$id]);
            $this->qDeleteRole([$id, $this->companiesId]);
        });

        Auditoria::registrar('eliminar', 'roles', $id, $role['name'], [
            'cambios' => $this->diffRows([
                'name'        => $role['name'],
                'description' => (string) $role['description'],
                'actions'     => $actions . ' acciones'
            ], [], self::ROLE_FIELDS)
        ]);

        return ['status' => 200, 'message' => 'Rol eliminado correctamente'];
    }

    const ROLE_FIELDS = [
        'name'        => 'Nombre',
        'description' => 'Descripción',
        'template'    => 'Permisos copiados de',
        'actions'     => 'Permisos'
    ];

    private function companyRole($id) {
        return $id > 0 ? $this->qCompanyRole([$id, $this->companiesId]) : null;
    }

    private function roleRow($r) {
        return [
            'id'          => (int) $r['id'],
            'name'        => $r['name'],
            'description' => $r['description'] ?: '',
            'users'       => (int) $r['users'],
            'actions'     => (int) $r['actions'],
            'lock'        => $this->roleLock($r),
            'deleteLock'  => $this->deleteLock($r)
        ];
    }

    /*  ¿Quién cambia un rol? Además del permiso de la sección:
          - El rol Dueño, solo un Dueño o un Super Admin.
          - Nadie que no sea Dueño o Super Admin cambia un rol que él mismo
            tiene: se estaría dando acceso a sí mismo.
        Regresa el motivo, o '' si se puede. */
    private function roleLock($role) {
        if ($this->isOwnerOrSuper()) return '';
        if (($role['code'] ?? '') === 'dueno') return 'Solo un Dueño o un Super Admin puede modificar el rol Dueño';
        if (in_array((int) $role['id'], $this->actorRoleIds(), true)) return 'No puedes modificar el rol que tienes asignado: pídeselo a un Dueño';
        return '';
    }

    // Borrar, además: el rol Dueño no se borra nunca (da el rango) y un rol que
    // alguien tiene tampoco (users_braches lo apunta con FK).
    private function deleteLock($role) {
        if (($role['code'] ?? '') === 'dueno') return 'El rol Dueño no se puede eliminar';

        $lock = $this->roleLock($role);
        if ($lock) return $lock;

        $n = (int) ($role['assignments'] ?? 0);
        if ($n > 0) return ($n === 1 ? 'Lo tiene 1 usuario' : "Lo tienen {$n} usuarios") . ': cámbiales el rol antes de eliminarlo';

        return '';
    }

    // ¿El cambio le quita a un rol que tiene quien edita todo lo que tenía en
    // Configuración > Accesos? (Si nunca lo tuvo, no hay nada que perder.)
    private function locksOutActor($roleId, $catalog, $wanted) {
        if ((int) $this->actorRank()['is_superadmin'] === 1)            return false;
        if (!in_array((int) $roleId, $this->actorRoleIds(), true))      return false;

        $before = 0;
        $after  = 0;
        foreach ($catalog as $p) {
            if ($p['section_code'] !== 'configuracion-accesos') continue;
            $before += (int) $p['granted'];
            $after  += in_array((int) $p['permission_id'], $wanted, true) ? 1 : 0;
        }
        return $before > 0 && $after === 0;
    }

    // Acción de la que dependen las demás de una sección (type_permissions.code).
    const VIEW_CODE = 'ver';

    // Ver va con cualquier otra acción de su sección: la matriz la marca sola, y
    // aquí se asegura aunque la petición llegue sin ella o se copie un rol que no
    // la tenía. Solo agrega: nunca quita lo que se pidió.
    private function withViewAction($catalog, $ids) {
        $view  = [];
        $other = [];
        foreach ($catalog as $p) {
            $sid = (int) $p['section_id'];
            if ($p['type_code'] === self::VIEW_CODE)                    $view[$sid]  = (int) $p['permission_id'];
            elseif (in_array((int) $p['permission_id'], $ids, true))    $other[$sid] = true;
        }

        foreach (array_keys($other) as $sid) {
            if (isset($view[$sid]) && !in_array($view[$sid], $ids, true)) $ids[] = $view[$sid];
        }
        return $ids;
    }

    // Catálogo → matriz: columnas (tipos de acción en uso) y módulos > secciones >
    // acciones (permission id, tipo y si la tiene).
    private function roleCatalog($roleId) {
        $types   = [];
        $modules = [];

        foreach ($this->qRoleCatalog([$roleId]) as $r) {
            $tid = (int) $r['type_id'];
            $mid = (int) $r['module_id'];
            $sid = (int) $r['section_id'];

            $types[$tid] = ['id' => $tid, 'code' => $r['type_code'], 'name' => $r['type_name'], 'order' => (int) $r['type_order']];

            if (!isset($modules[$mid])) {
                $modules[$mid] = ['id' => $mid, 'name' => $r['module_name'], 'icon' => $r['module_icon'] ?: 'layout-grid', 'sections' => []];
            }
            if (!isset($modules[$mid]['sections'][$sid])) {
                $modules[$mid]['sections'][$sid] = ['id' => $sid, 'name' => $r['section_name'], 'icon' => $r['section_icon'] ?: 'square', 'actions' => []];
            }

            $modules[$mid]['sections'][$sid]['actions'][] = [
                'id'      => (int) $r['permission_id'],
                'type_id' => $tid,
                'granted' => (int) $r['granted'] === 1
            ];
        }

        usort($types, function ($a, $b) {
            return [$a['order'], $a['id']] <=> [$b['order'], $b['id']];
        });

        // Listas y no objetos en el JSON: el front las recorre en orden.
        foreach ($modules as &$m) $m['sections'] = array_values($m['sections']);
        unset($m);

        return ['types' => array_values($types), 'modules' => array_values($modules)];
    }

    // Qué cambió en los permisos, por sección: "Ver, Agregar" → "Ver, Agregar, Editar".
    private function permissionDiff($catalog, $wanted) {
        $sections = [];
        foreach ($catalog as $p) {
            $key = $p['module_name'] . ' › ' . $p['section_name'];
            if (!isset($sections[$key])) $sections[$key] = ['antes' => [], 'despues' => []];

            if ((int) $p['granted'] === 1)                                 $sections[$key]['antes'][]   = $p['type_name'];
            if (in_array((int) $p['permission_id'], $wanted, true))       $sections[$key]['despues'][] = $p['type_name'];
        }

        $rows = [];
        foreach ($sections as $campo => $s) {
            if ($s['antes'] === $s['despues']) continue;
            $rows[] = [
                'campo'   => $campo,
                'antes'   => $s['antes'] ? implode(', ', $s['antes']) : 'Sin acceso',
                'despues' => $s['despues'] ? implode(', ', $s['despues']) : 'Sin acceso'
            ];
        }
        return $rows;
    }

    // 'Gerente Regional' -> 'gerente-regional' (igual que el tenant).
    private function slug($text) {
        $text = strtr(mb_strtolower(trim((string) $text), 'UTF-8'), ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
        return trim(preg_replace('/[^a-z0-9]+/', '-', $text), '-');
    }

    /* ====================== Usuarios ====================== */

    /*  La tabla cabe en una laptop sin amontonarse (como la del panel de
        referencia): el correo va debajo del nombre y no en su columna, el rango
        se lee una sola vez (en Rol) y las sucursales no hacen crecer el renglón. */
    function lsUsers() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $status = $active === 1 ? 'active' : 'inactive';
        $ls = $this->qUsers([$this->companiesId, $status]);

        $assigned = [];
        foreach ($this->qUserAssignments([$this->companiesId, $this->companiesId]) as $as) {
            $uid = (int) $as['user_id'];
            $assigned[$uid]['branches'][] = ['name' => $as['branch_name'], 'active' => (int) $as['branch_active'] === 1];
            if ($as['role_name'] !== null) $assigned[$uid]['roles'][$as['role_name']] = (string) $as['role_code'];
        }
        $activeBranches = $this->qCountActiveBranches([$this->companiesId]);

        $row = [];
        foreach ($ls as $u) {
            $a = [];
            if ($this->canManage($u['id'], $u)) {
                $a[] = [
                    'class'   => self::ACTION_BUTTON . 'text-gray-500 hover:bg-gray-100 hover:text-blue-600',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'users.editUser(' . $u['id'] . ')'
                ];
                if ($u['status'] === 'active') {
                    $a[] = [
                        'class'   => self::ACTION_BUTTON . 'text-red-500 hover:bg-red-50 hover:text-red-600',
                        'html'    => '<i class="icon-toggle-on"></i>',
                        'onclick' => 'users.toggleUser(' . $u['id'] . ', 0)'
                    ];
                } else {
                    $a[] = [
                        'class'   => self::ACTION_BUTTON . 'text-gray-400 hover:bg-gray-100 hover:text-green-600',
                        'html'    => '<i class="icon-toggle-off"></i>',
                        'onclick' => 'users.toggleUser(' . $u['id'] . ', 1)'
                    ];
                }
            } else {
                // Sin acciones, pero la celda se queda: el renglón no se descuadra
                // y el candado dice por qué no se puede tocar.
                $a[] = [
                    'class' => self::ACTION_BUTTON . 'text-gray-400 cursor-default',
                    'html'  => '<i class="icon-lock"></i>',
                    'title' => $this->manageDenied($u)
                ];
            }

            $mine = $assigned[(int) $u['id']] ?? [];

            $row[] = [
                'id'          => $u['id'],
                'Colaborador' => $this->userCell($u),
                'Rol'         => $this->roleChips($mine['roles'] ?? []),
                'Sucursales'  => $this->branchChips($mine['branches'] ?? [], $activeBranches),
                'Estado'      => renderStatus($u['status'] === 'active' ? 1 : 0),
                'a'           => Permissions::rowActions('configuracion-accesos', $a)
            ];
        }

        return ['status' => 200, 'row' => $row];
    }

    // Botones de las tablas de Usuarios y Sucursales: solo el ícono, sin borde.
    const ACTION_BUTTON = 'inline-flex items-center justify-center w-7 h-7 rounded-md transition ';

    // Foto (o inicial sobre su color), nombre y, debajo, el correo.
    private function userCell($u) {
        $name  = trim(($u['name'] ?? '') . ' ' . ($u['last_name'] ?? ''));
        $photo = $this->imageUrl('users', $u['photo'] ?? '');

        $avatar = $photo !== ''
            ? '<img src="' . htmlspecialchars($photo) . '" alt="" class="w-8 h-8 rounded-full object-cover shrink-0">'
            : '<span class="w-8 h-8 rounded-full inline-flex items-center justify-center shrink-0 text-white text-[11px] font-bold" style="background:'
                . ($this->normalizeColor($u['color'] ?? '') ?: renderColorFromName($name)) . ';">'
                . htmlspecialchars(mb_strtoupper(mb_substr(trim((string) $u['name']), 0, 1))) . '</span>';

        return '<div class="flex items-center gap-2.5 min-w-0">' . $avatar
             . '<div class="min-w-0 max-w-[230px] leading-tight">'
             . '<p class="font-medium text-gray-800 truncate">' . htmlspecialchars($name) . '</p>'
             . '<p class="text-[11px] text-gray-500 truncate" title="' . htmlspecialchars((string) $u['email']) . '">' . htmlspecialchars((string) $u['email']) . '</p>'
             . '</div></div>';
    }

    // El rango se distingue por color: Super Admin oscuro, Dueño con el acento
    // del tema, los de la empresa en azul.
    private function roleChips($roles) {
        if (!$roles) return '<span class="italic text-gray-400 text-[11px]">Sin rol</span>';

        $chips = [];
        foreach ($roles as $name => $code) {
            $label = htmlspecialchars($name);
            if ($code === 'superadmin')  $chips[] = badge($label, '#FFFFFF', 100, '#111827');
            elseif ($code === 'dueno')   $chips[] = badge($label, 'var(--accent-soft-fg, rgb(var(--brand-700, 168 74 51)))', 100, 'var(--accent-soft-bg, rgb(var(--brand-100, 247 227 220)))');
            else                         $chips[] = badge($label, '#1D4ED8', 100, '#DBEAFE');
        }
        return $this->chipRow($chips);
    }

    // Con todas las sucursales activas de la empresa basta una etiqueta; si no,
    // las dos primeras y "+N" (el resto en el tooltip).
    private function branchChips($branches, $activeTotal) {
        if (!$branches) return '<span class="italic text-gray-400 text-[11px]">Sin asignar</span>';

        $fg    = 'var(--accent-soft-fg, rgb(var(--brand-700, 168 74 51)))';
        $bg    = 'var(--accent-soft-bg, rgb(var(--brand-100, 247 227 220)))';
        $names = array_column($branches, 'name');
        $all   = htmlspecialchars(implode(', ', $names));

        $active = count(array_filter($branches, function ($b) { return $b['active']; }));
        if ($activeTotal > 1 && $active === $activeTotal) {
            return $this->chipRow(['<span title="' . $all . '">' . badge('Todas las sucursales', $fg, 100, $bg) . '</span>']);
        }

        $chips = array_map(function ($n) use ($fg, $bg) {
            return badge(htmlspecialchars($n), $fg, 100, $bg);
        }, array_slice($names, 0, 2));

        $rest = array_slice($names, 2);
        if ($rest) {
            $chips[] = '<span title="' . htmlspecialchars(implode(', ', $rest)) . '">' . badge('+' . count($rest), '#475569', 100, '#F1F5F9') . '</span>';
        }
        return $this->chipRow($chips);
    }

    // Cada etiqueta entera en un renglón: badge() es un span en línea y el
    // nombre se partía a la mitad cuando la columna se angostaba.
    private function chipRow($chips) {
        return '<div class="flex flex-wrap items-center gap-1">' . implode('', array_map(function ($c) {
            return '<span class="whitespace-nowrap">' . $c . '</span>';
        }, $chips)) . '</div>';
    }

    function getUser() {
        $id   = (int) $_POST['id'];
        $data = $this->qUser([$id, $this->companiesId]);
        if (!$data) {
            return ['status' => 404, 'message' => 'Usuario no encontrado', 'data' => null];
        }
        $rank = $this->qUserRank([$id]);
        if (!$this->canManage($id, $rank)) {
            return ['status' => 403, 'message' => $this->manageDenied($rank), 'data' => null];
        }
        // Solo las sucursales de esta empresa (ver qUserBranchIds).
        $data['branch_ids']   = $this->qUserBranchIds([$id, $this->companiesId]);
        $data['branch_roles'] = $this->qUserBranchRoles([$id, $this->companiesId]);
        $data['photo_url']    = $this->imageUrl('users', $data['photo'] ?? '');
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

        $roles = $this->resolveBranchRoles($branchIds, []);
        if ($roles === null) {
            return ['status' => 400, 'message' => 'Elige el rol del usuario en cada sucursal'];
        }

        $newId = $this->transaction(function () use ($name, $lastName, $email, $password, $branchIds, $roles, $color) {
            $this->qInsertUser([
                $name,
                $lastName ?: null,
                $email,
                password_hash($password, PASSWORD_BCRYPT),
                $branchIds[0],
                $this->companiesId,
                $color
            ]);

            $newId = $this->qLastInsertId();
            if (!$newId) {
                throw new \Exception('No se pudo obtener el id del usuario creado');
            }

            foreach ($branchIds as $bid) {
                $this->qInsertUserBranch([$newId, $bid, $roles[$bid]]);
            }

            // La foto se guarda al final porque su nombre lleva el id del usuario,
            // que hasta aquí no existía.
            if ($this->imageTouched('photo')) {
                $this->qUpdateUserPhoto([$this->saveImage('users', 'photo', 'user', $newId, ''), $newId, $this->companiesId]);
            }

            return $newId;
        });

        $fullName = trim($name . ' ' . $lastName);
        Auditoria::registrar('crear', 'users', $newId, $fullName, [
            'cambios' => $this->diffRows([], [
                'name'     => $fullName,
                'email'    => $email,
                'branches' => $this->branchRolesText($roles)
            ], self::USER_FIELDS)
        ]);

        return ['status' => 200, 'message' => 'Usuario creado correctamente'];
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
        $rank = $this->qUserRank([$id]);
        if (!$this->canManage($id, $rank)) {
            return ['status' => 403, 'message' => $this->manageDenied($rank)];
        }
        if ($this->qEmailExistsExcept([$email, $this->companiesId, $id])) {
            return ['status' => 409, 'message' => 'Ya existe otro usuario con ese correo'];
        }

        foreach ($branchIds as $bid) {
            if (!$this->qBranch([$bid, $this->companiesId])) {
                return ['status' => 400, 'message' => 'Una de las sucursales seleccionadas no es válida'];
            }
        }

        // Roles de antes de tocar users_braches: la edicion borra y reinserta las
        // filas de esta empresa (las de otras se quedan como están) y el Super
        // Admin de una sucursal se conserva tal cual (resolveBranchRoles).
        $currentRoles = $this->qUserBranchRoles([$id, $this->companiesId]);
        $roles = $this->resolveBranchRoles($branchIds, $currentRoles);
        if ($roles === null) {
            return ['status' => 400, 'message' => 'Elige el rol del usuario en cada sucursal'];
        }

        // Nadie que no sea Dueño o Super Admin se cambia a sí mismo sucursales o
        // roles: con permiso en Accesos podría darse el rol que quisiera.
        if ($id === $this->userId && !$this->isOwnerOrSuper() && $this->rolesChanged($currentRoles, $roles)) {
            return ['status' => 403, 'message' => 'No puedes cambiar tus propias sucursales ni roles: pídeselo a un Dueño'];
        }

        $photoActual  = $current['photo'] ?? '';
        $photoTouched = $this->imageTouched('photo');

        $this->transaction(function () use ($id, $name, $lastName, $email, $branchIds, $roles, $color, $password, $photoActual, $photoTouched) {
            $this->qUpdateUser([
                $name,
                $lastName ?: null,
                $email,
                $branchIds[0],
                $color,
                $id,
                $this->companiesId
            ]);

            $this->qDeleteUserBranches([$id, $this->companiesId]);

            foreach ($branchIds as $bid) {
                $this->qInsertUserBranch([$id, $bid, $roles[$bid]]);
            }

            if ($password !== '') {
                $this->qUpdateUserPassword([
                    password_hash($password, PASSWORD_BCRYPT),
                    $id,
                    $this->companiesId
                ]);
            }

            if ($photoTouched) {
                $this->qUpdateUserPhoto([$this->saveImage('users', 'photo', 'user', $id, $photoActual), $id, $this->companiesId]);
            }
        });

        $fullName = trim($name . ' ' . $lastName);
        $cambios  = $this->diffRows([
            'name'     => trim($current['name'] . ' ' . ($current['last_name'] ?? '')),
            'email'    => (string) $current['email'],
            'branches' => $this->branchRolesText($currentRoles),
            'password' => '',
            'photo'    => ''
        ], [
            'name'     => $fullName,
            'email'    => $email,
            'branches' => $this->branchRolesText($roles),
            'password' => $password !== '' ? 'Se cambió' : '',
            'photo'    => $photoTouched ? (($_POST['photo_clear'] ?? '') === '1' ? 'Se quitó' : 'Se cambió') : ''
        ], self::USER_FIELDS);

        if ($cambios) Auditoria::registrar('editar', 'users', $id, $fullName, ['cambios' => $cambios]);

        return ['status' => 200, 'message' => 'Usuario actualizado correctamente'];
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
        $rank = $this->qUserRank([$id]);
        if (!$this->canManage($id, $rank)) {
            return ['status' => 403, 'message' => $this->manageDenied($rank)];
        }

        $ok = $this->qUpdateUserPassword([
            password_hash($password, PASSWORD_BCRYPT),
            $id,
            $this->companiesId
        ]);

        if ($ok) Auditoria::registrar('contrasena', 'users', $id, trim($current['name'] . ' ' . ($current['last_name'] ?? '')));

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
        $rank = $this->qUserRank([$id]);
        if (!$this->canManage($id, $rank)) {
            return ['status' => 403, 'message' => $this->manageDenied($rank)];
        }

        $status = $active === 1 ? 'active' : 'inactive';
        $ok = $this->qSetUserStatus([$status, $id, $this->companiesId]);

        if ($ok) Auditoria::registrar($active ? 'activar' : 'desactivar', 'users', $id, trim($current['name'] . ' ' . ($current['last_name'] ?? '')));

        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? ($active ? 'Usuario activado' : 'Usuario desactivado') : 'No se pudo actualizar el estado'
        ];
    }

    // Campos del usuario y su etiqueta en la bitácora. La contraseña solo dice que
    // cambió: su valor nunca se guarda.
    const USER_FIELDS = [
        'name'     => 'Nombre',
        'email'    => 'Correo',
        'branches' => 'Sucursales y roles',
        'password' => 'Contraseña',
        'photo'    => 'Foto'
    ];

    // "Reginas Guadalupe (Almacenista), Reginas kafeto (Supervisor)".
    private function branchRolesText($map) {
        $branches = $this->qBranchNames([$this->companiesId]);
        $roles    = $this->qRoleNames();

        $parts = [];
        foreach ($map as $branchId => $roleId) {
            $parts[] = ($branches[$branchId] ?? ('Sucursal ' . $branchId)) . ' (' . ($roles[$roleId] ?? 'Sin rol') . ')';
        }
        sort($parts);

        return implode(', ', $parts);
    }

    private function rolesChanged($currentRoles, $roles) {
        $a = [];
        foreach ($currentRoles as $b => $r) $a[(int) $b] = (int) $r;
        $b = [];
        foreach ($roles as $k => $r) $b[(int) $k] = (int) $r;
        ksort($a);
        ksort($b);

        return $a !== $b;
    }

    /* ====================== Bitácora (audit_log) ====================== */

    function lsBitacora() {
        $ls = $this->qAuditLog([
            'company_id'    => $this->companiesId,
            'fi'            => $this->validDate($_POST['fi'] ?? ''),
            'ff'            => $this->validDate($_POST['ff'] ?? ''),
            'user_id'       => (int) ($_POST['user_id'] ?? 0),
            'entity'        => isset(self::AUDIT_ENTITIES[$_POST['entity'] ?? '']) ? $_POST['entity'] : '',
            've_superadmin' => $this->seesSuperAdminLog(),
            'limit'         => self::AUDIT_LIMIT
        ]);

        $row = [];
        foreach ($ls as $l) {
            $action = self::AUDIT_ACTIONS[$l['action']] ?? [$l['action'], '#475569', '#F1F5F9', 'circle'];
            $detail = json_decode((string) $l['detail'], true);

            $row[] = [
                'id'       => $l['id'],
                'Fecha'    => date('d/m/Y H:i', strtotime($l['created_at'])),
                'Usuario'  => $l['user_name'] ? htmlspecialchars($l['user_name']) : '-',
                'Acción'   => badge($action[0], $action[1], 100, $action[2], $action[3]),
                'Elemento' => '<span class="text-[11px] uppercase tracking-wide text-gray-400">' . (self::AUDIT_ENTITIES[$l['entity']] ?? $l['entity']) . '</span> '
                            . '<span class="font-medium">' . htmlspecialchars($l['label']) . '</span>',
                'Detalle'  => htmlspecialchars($this->auditSummary($detail)),
                'IP'       => $l['ip'] ? htmlspecialchars($l['ip']) : '-',
                'a'        => [[
                    'class'   => 'inline-flex items-center justify-center w-8 h-8 p-1.5 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="eye" class="w-4 h-4"></i>',
                    'title'   => 'Ver detalle',
                    'onclick' => 'bitacora.getBitacora(' . (int) $l['id'] . ')'
                ]]
            ];
        }

        return ['status' => 200, 'row' => $row];
    }

    function showBitacora() {
        $c = $this->qAuditCounts([
            $this->companiesId,
            $this->validDate($_POST['fi'] ?? ''),
            $this->validDate($_POST['ff'] ?? ''),
            $this->seesSuperAdminLog()
        ]);

        return [
            'status' => 200,
            'counts' => [
                'total'    => (int) ($c['total'] ?? 0),
                'sesiones' => (int) ($c['sesiones'] ?? 0),
                'cambios'  => (int) ($c['cambios'] ?? 0),
                'bajas'    => (int) ($c['bajas'] ?? 0)
            ],
            'usuarios' => $this->qAuditUsers([$this->companiesId, $this->seesSuperAdminLog()])
        ];
    }

    // El detalle de un movimiento: el antes y el después de cada campo.
    function getBitacora() {
        $l = $this->qAuditEntry([(int) ($_POST['id'] ?? 0), $this->companiesId, $this->seesSuperAdminLog()]);
        if (!$l) return ['status' => 404, 'message' => 'Movimiento no encontrado'];

        $action = self::AUDIT_ACTIONS[$l['action']] ?? [$l['action'], '#475569', '#F1F5F9', 'circle'];
        $detail = json_decode((string) $l['detail'], true);

        $row = [];
        foreach ($this->auditRows($detail) as $r) {
            $row[] = [
                'Campo'   => '<span class="font-medium">' . htmlspecialchars($r['campo']) . '</span>',
                'Antes'   => $r['antes'] !== '' ? htmlspecialchars($r['antes']) : '<span class="text-gray-400">—</span>',
                'Después' => $r['despues'] !== '' ? htmlspecialchars($r['despues']) : '<span class="text-gray-400">—</span>',
                'opc'     => 0
            ];
        }

        return [
            'status' => 200,
            'header' => [
                'badge'    => badge($action[0], $action[1], 100, $action[2], $action[3]),
                'elemento' => (self::AUDIT_ENTITIES[$l['entity']] ?? $l['entity']) . ' · ' . $l['label'],
                'fecha'    => date('d/m/Y H:i:s', strtotime($l['created_at'])),
                'usuario'  => $l['user_name'] ?: '-',
                'ip'       => $l['ip'] ?: '-'
            ],
            'row' => $row
        ];
    }

    // El detalle guardado como renglones campo / antes / después. Los de sesión
    // traen datos sueltos (sucursal, empresa): van en "Después".
    private function auditRows($detail) {
        if (!is_array($detail)) return [];
        if (isset($detail['cambios']) && is_array($detail['cambios'])) return $detail['cambios'];

        $rows = [];
        foreach ($detail as $campo => $valor) {
            $rows[] = ['campo' => ucfirst((string) $campo), 'antes' => '', 'despues' => is_scalar($valor) ? (string) $valor : json_encode($valor)];
        }
        return $rows;
    }

    // Lo que se lee en la columna Detalle de la tabla.
    private function auditSummary($detail) {
        $rows = $this->auditRows($detail);
        if (!$rows) return '';

        if (!isset($detail['cambios'])) {
            return implode(' · ', array_map(function ($r) { return $r['campo'] . ': ' . $r['despues']; }, $rows));
        }

        $campos = array_column($rows, 'campo');
        $resto  = count($campos) > 2 ? ' y ' . (count($campos) - 2) . ' más' : '';

        return implode(', ', array_slice($campos, 0, 2)) . $resto;
    }

    // Antes y después campo por campo, solo lo que cambió. Alta: antes vacío;
    // baja: después vacío.
    private function diffRows($before, $after, $labels) {
        $rows = [];
        foreach ($labels as $key => $label) {
            $a = trim((string) ($before[$key] ?? ''));
            $d = trim((string) ($after[$key] ?? ''));
            if ($a === $d) continue;
            $rows[] = ['campo' => $label, 'antes' => $a, 'despues' => $d];
        }
        return $rows;
    }

    // Lo que hizo un Super Admin solo lo ve otro Super Admin: la tabla, el
    // detalle, los números, el filtro de usuario y el Resumen. 1 o 0 para el SQL.
    private function seesSuperAdminLog() {
        return (int) $this->actorRank()['is_superadmin'] === 1 ? 1 : 0;
    }

    private function validDate($date) {
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $date) ? $date : date('Y-m-d');
    }

    /* ===== Imágenes: foto del colaborador y logo de la sucursal =====
       Convención compartida con el login (acceso/ctrl/ctrl-access.php): la
       columna guarda SOLO el nombre del archivo dentro de
       inventory/uploads/<carpeta>/ (users, branches). */

    private function imageDir($folder) {
        return __DIR__ . '/../../../uploads/' . $folder . '/';
    }

    // ¿El formulario trae algo que hacer con la imagen? Sin esto, guardar sin
    // tocarla la borraría.
    private function imageTouched($field) {
        return ($_POST[$field . '_b64'] ?? '') !== '' || ($_POST[$field . '_clear'] ?? '') === '1';
    }

    /*  La imagen viaja como dataURL en un campo de TEXTO, no como archivo:
        createModalForm manda el formulario por useFetch, que arma un
        URLSearchParams, y ahí un File se convierte en "[object File]". Es el
        mismo camino que la evidencia de mermas (ctrl-salidas.php).

        Devuelve el nombre de archivo a guardar, o null para dejarla vacía. Si
        el dataURL viene roto se conserva la que ya había: vale más quedarse con
        la imagen vieja que borrarla por un envío mal formado. */
    private function saveImage($folder, $field, $prefix, $id, $current) {
        $b64   = (string) ($_POST[$field . '_b64'] ?? '');
        $clear = ($_POST[$field . '_clear'] ?? '') === '1';
        $dir   = $this->imageDir($folder);

        if (!$clear) {
            if (!preg_match('#^data:image/([a-zA-Z0-9.+-]+);base64,#', $b64, $m)) return $current;

            $ext = strtolower($m[1]) === 'jpeg' ? 'jpg' : strtolower($m[1]);
            if (!in_array($ext, ['jpg', 'png', 'webp', 'gif'], true))            return $current;

            $data = base64_decode(substr($b64, strpos($b64, ',') + 1), true);
            if ($data === false)                                                 return $current;

            if (!is_dir($dir)) @mkdir($dir, 0777, true);

            $fileName = $prefix . '_' . (int) $id . '_' . time() . '.' . $ext;
            if (@file_put_contents($dir . $fileName, $data) === false)           return $current;

            $this->dropImage($folder, $current);
            return $fileName;
        }

        $this->dropImage($folder, $current);
        return null;
    }

    // Borra del disco la imagen anterior. basename() para que un valor manipulado
    // no pueda salirse de la carpeta.
    private function dropImage($folder, $file) {
        $file = basename(trim((string) $file));
        if ($file === '') return;

        $path = $this->imageDir($folder) . $file;
        if (is_file($path)) @unlink($path);
    }

    // La imagen lista para un <img src>. La base sale de la ruta real de este
    // controlador (.../inventory/admin/accesos/ctrl/) y no escrita a mano.
    private function imageUrl($folder, $file) {
        $file = trim((string) $file);
        if ($file === '') return '';
        if ($file[0] === '/' || preg_match('#^https?://#', $file)) return $file;

        $base = dirname(dirname(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? ''))));
        $base = rtrim(str_replace('\\', '/', $base), '/');

        return $base . '/uploads/' . $folder . '/' . rawurlencode($file);
    }

    /* ===== Jerarquía ===== */

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

    // Ids que llegan como JSON ("[1,2,3]"): los permisos marcados de un rol.
    private function postedIds($raw) {
        $decoded = json_decode((string) $raw, true);
        if (!is_array($decoded)) return [];

        $ids = [];
        foreach ($decoded as $v) {
            $id = (int) $v;
            if ($id > 0) $ids[] = $id;
        }
        return array_values(array_unique($ids));
    }

    // Rol de cada sucursal (branch_id => role_id) a partir de `branch_roles`.
    // Solo valen los roles de la empresa que puede asignar quien edita
    // (qRolesForSelect: nunca el Super Admin; el Dueño, solo un Dueño o Super
    // Admin). Donde el usuario ya es Super Admin se queda así: ese rol es del
    // sistema y no se asigna ni se quita desde aquí. null = falta o no vale el
    // rol de alguna.
    private function resolveBranchRoles($branchIds, $currentRoles) {
        $allowed = array_map('intval', array_column($this->qRolesForSelect([$this->companiesId, $this->canAssignOwner() ? 1 : 0]), 'id'));
        $sent    = $this->normalizeBranchRoles($_POST['branch_roles'] ?? '');

        $roles = [];
        foreach ($branchIds as $bid) {
            if ((int) ($currentRoles[$bid] ?? 0) === 1) {
                $roles[$bid] = 1;
                continue;
            }

            $role = $sent[$bid] ?? 0;
            if (!in_array($role, $allowed, true)) return null;
            $roles[$bid] = $role;
        }
        return $roles;
    }

    /*  JERARQUÍA DE ACCESOS: además del permiso de la sección, editar o dar de
        baja a alguien depende de quién es cada uno.
          - Al Super Admin solo lo toca otro Super Admin o él mismo.
          - Al Dueño, solo un Dueño o un Super Admin.
        $rank trae is_superadmin e is_dueno (qUsers o qUserRank). */
    private function canManage($id, $rank) {
        $actor = $this->actorRank();

        if ((int) $rank['is_superadmin'] === 1) {
            return (int) $actor['is_superadmin'] === 1 || (int) $id === $this->userId;
        }
        if ((int) $rank['is_dueno'] === 1) {
            return (int) $actor['is_superadmin'] === 1 || (int) $actor['is_dueno'] === 1;
        }
        return true;
    }

    private function manageDenied($rank) {
        return (int) $rank['is_superadmin'] === 1
            ? 'Solo otro Super Admin puede modificar a un Super Admin'
            : 'Solo un Dueño o un Super Admin puede modificar a un Dueño';
    }

    // Quien no es Dueño ni Super Admin tampoco puede nombrar dueños: sería darse
    // a sí mismo (o a otro) un rango que después ya no podría tocar.
    private function canAssignOwner() {
        return $this->isOwnerOrSuper();
    }

    private function isOwnerOrSuper() {
        $actor = $this->actorRank();

        return (int) $actor['is_superadmin'] === 1 || (int) $actor['is_dueno'] === 1;
    }

    private function actorRank() {
        if ($this->actor === null) $this->actor = $this->qUserRank([$this->userId]);

        return $this->actor;
    }

    private function actorRoleIds() {
        if ($this->actorRoles === null) $this->actorRoles = $this->qUserRoleIds([$this->userId]);

        return $this->actorRoles;
    }

    private function normalizeBranchRoles($raw) {
        $decoded = is_string($raw) && $raw !== '' ? json_decode($raw, true) : $raw;
        if (!is_array($decoded)) return [];

        $result = [];
        foreach ($decoded as $branchId => $roleId) {
            if ((int) $branchId > 0) $result[(int) $branchId] = (int) $roleId;
        }
        return $result;
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
echo json_encode(Permissions::guard('configuracion-accesos', $opc, ctrl::PERMISSIONS) ?: $obj->{$opc}());
