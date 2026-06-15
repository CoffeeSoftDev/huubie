<?php
session_start();
if (empty($_POST['opc'])) exit(0);
$opc = $_POST['opc'];

require_once('../mdl/mdl-access.php');

class Access extends MAccess {
    function login() {
            $user = trim(str_replace("'", "", $_POST['usuario'] ?? ''));
            $pass = str_replace("'", "", $_POST['clave'] ?? '');

            $usr = $this->getUserByCredentials([$user]);

            // Verifica la contrasena: bcrypt (password) con respaldo MD5 (key) para credenciales heredadas.
            $valid = $usr && (
                (!empty($usr['password']) && password_verify($pass, $usr['password'])) ||
                (!empty($usr['user_key']) && $usr['user_key'] === md5($pass))
            );

            if (!$valid) {
                return false;
            }

            $expira = time() + (365 * 24 * 60 * 60);
            setcookie("IDU",        $usr['IDU'],        $expira, "/");
            setcookie("company_id", $usr['company_id'], $expira, "/");
            setcookie("company",    $usr['company'],    $expira, "/");

            $_SESSION['IDU']        = $usr['IDU'];             // id usuario (clave que validan las páginas: sucursales, almacén, etc.)
            $_SESSION['user_id']    = $usr['IDU'];             // alias id usuario
            $_SESSION['company_id'] = $usr['company_id'];      // id compania
            $_SESSION['branch_id'] = $usr['branch_id'];        // id sucursal
            $_SESSION['company']    = $usr['company'];         // nombre de la compania
            $_SESSION['branch']      = $usr['branch'];         // nombre de la sucursal

            $_SESSION['user']       = trim(($usr['name'] ?? '') . ' ' . ($usr['last_name'] ?? ''));
            $_SESSION['is_owner']   = $usr['is_owner'];
            $_SESSION['last_activity'] = time();

            return [
                "IDU"        => $usr['IDU'],
                "company_id" => $usr['company_id'],
                "company"    => $usr['company'],
                "user"       => $_SESSION['user'],
                "photo"      => $usr['photo'] ?? '',
            ];
    }

    function company() {
        $sql = !empty($_SESSION['IDU']) ? $this->getSessionUser([$_SESSION['IDU']]) : null;

        // Se prioriza el valor vivo de la BD sobre el cacheado en sesion (login viejo),
        // asi un rename de compania/sucursal se refleja sin cerrar sesion.
        $company = $sql['company'] ?? ($_SESSION['company'] ?? '');
        // Sucursal asignada: se resuelve desde branches por branch_id (igual que inventario).
        $branch  = $sql['branch'] ?? ($_SESSION['branch'] ?? '');

        return [
            "photo"      => $sql['photo'] ?? '',
            "user"       => $sql['user'] ?? ($_SESSION['user'] ?? 'Usuario'),
            "email"      => $sql['email'] ?? ($_SESSION['email'] ?? ''),
            "rol"        => $sql['rol'] ?? '',
            "level"      => isset($sql['level']) ? (int)$sql['level'] : 0,
            "company"    => $company,
            "company_id" => $sql['company_id'] ?? ($_SESSION['company_id'] ?? null),
            "sucursal"   => $branch,
            "branch"     => $branch,
            "branch_id"  => $sql['branch_id'] ?? ($_SESSION['branch_id'] ?? null),
            // Compatibilidad con el navbar (lee udn/negocio).
            "udn"        => $company,
            "negocio"    => $company,
        ];
    }

    function sidebar() {
        $sidebar = [
            [
                "text"    => "Ventas",
                "submenu" => [
                    // ["text" => "Eventos", "url" => "/dev/eventos/"],
                    ["text" => "Pedidos", "url" => "/dev/pedidos/"],
                    ["text" => "Reservaciones", "url" => "/dev/reservaciones/"],
                    ["text" => "Dashboard", "url" => "/dev/dashboard/"],
                    ["text" => "Administración", "url" => "/dev/admin-pedidos/"]
                ]
            ]
        ];

        if((int)($_SESSION['is_owner'] ?? 0) === 1 ){
          $sidebar[] = [
            "text"    => "Configuracion",
            "submenu" => [
                ["text" => "Empresas", "url" => "/dev/empresas/"],
                ["text" => "Usuarios", "url" => "/dev/usuarios/"],
            ]
          ];
        }


      $rrhh = [
        "text"=> "Recursos Humanos", "submenu"=> [
          [ "text"=> "Personal", "url"=> "#" ],
          [ "text"=> "Incidencia", "url"=> "#" ],
          [ "text"=> "Nómina", "url"=> "#" ],
          [ "text"=> "Permisos", "url"=> "#" ],
          [ "text"=> "Desempeño", "url"=> "#" ],
          [ "text"=> "Reclutamiento", "url"=> "#" ],
          [ "text"=> "Actas", "url"=> "#" ],
          [ "text"=> "Reconocimientos", "url"=> "#" ],
          [ "text"=> "Configuración", "url"=> "#" ],
        ]
      ];

      $finanzas = [
            "text"=> "Finanzas", "submenu"=> [
                [ "text"=> "Ingresos", "url"=> "#" ],
                [ "text"=> "Egresos", "url"=> "#" ],
                [ "text"=> "Cuentas por pagar", "url"=> "#" ],
                [ "text"=> "Cuentas por cobrar", "url"=> "#" ],
                [ "text"=> "Ordenes de compra", "url"=> "#" ],
                [ "text"=> "Proveedores", "url"=> "#" ],
                [ "text"=> "Recepción y entrega", "url"=> "#" ],
                [ "text"=> "Auditoría", "url"=> "#" ],
                [ "text"=> "Reportes", "url"=> "#" ],
                [ "text"=> "Presupuesto", "url"=> "#" ],
            ]
        ];

        return $sidebar;
    }

    // Menú lateral dinámico: secciones a las que el usuario logueado tiene acceso
    // en su sucursal activa. Fail-closed: si no hay sesión o no hay permisos, regresa vacío.
    function menu() {
        $userId   = (int) ($_SESSION['user_id'] ?? $_SESSION['IDU'] ?? 0);
        $branchId = (int) ($_SESSION['branch_id'] ?? 0);

        if ($userId <= 0 || $branchId <= 0) {
            return ['status' => 200, 'items' => []];
        }

        $ls = $this->getAccessibleSections([$userId, $branchId]);

        $items = [];
        foreach ($ls as $s) {
            $items[] = [
                'code'  => $s['code'],
                'title' => $s['name'],
                'icon'  => $s['icon'] ?: 'square',     // ícono por defecto si falta
                'route' => $s['route'] ?: ''           // ruta relativa a inventory/
            ];
        }

        return ['status' => 200, 'items' => $items];
    }

    function branches() {
        $userId   = (int) ($_SESSION['user_id'] ?? $_SESSION['IDU'] ?? 0);
        $isOwner  = (int) ($_SESSION['is_owner'] ?? 0);

        if ($isOwner === 1) {
            $list = $this->getBranchesByCompany([$_SESSION['company_id']]);
        } else {
            $list = $this->getBranchesByUser([$userId]);
        }

        $branches = [];
        foreach ($list as $branch) {
            $parts    = preg_split('/\s+/', trim($branch['name']));
            $initials = strtoupper(substr($parts[0], 0, 1));
            if (count($parts) > 1) {
                $initials .= strtoupper(substr(end($parts), 0, 1));
            }

            $branches[] = [
                'id'        => (int) $branch['id'],
                'name'      => $branch['name'],
                'ubication' => $branch['ubication'] ?? '',
                'active'    => (int) $branch['is_active'],
                'initials'  => $initials,
                'selected'  => ((int) $branch['id'] === (int) ($_SESSION['branch_id'] ?? 0)) ? 1 : 0,
            ];
        }

        return [
            'status'   => 200,
            'company'  => $_SESSION['company'] ?? '',
            'current'  => [
                'id'   => (int) ($_SESSION['branch_id'] ?? 0),
                'name' => $_SESSION['branch'] ?? '',
            ],
            'branches' => $branches,
        ];
    }

    function switchBranch() {
        $id = $_POST['id'];

        $branch = $this->getBranchById([$id]);

        if (!$branch) {
            return [
                'status'  => 404,
                'message' => 'Sucursal no encontrada',
            ];
        }

        if ((int) $branch['company_id'] !== (int) ($_SESSION['company_id'] ?? 0)) {
            return [
                'status'  => 403,
                'message' => 'No tienes acceso a esta sucursal',
            ];
        }

        $isOwner = (int) ($_SESSION['is_owner'] ?? 0);
        if ($isOwner !== 1) {
            $userId = (int) ($_SESSION['user_id'] ?? $_SESSION['IDU'] ?? 0);
            if (!$this->userHasAccessToBranch([$userId, (int) $id])) {
                return [
                    'status'  => 403,
                    'message' => 'Esta sucursal no está asignada a tu usuario',
                ];
            }
        }

        $_SESSION['branch_id'] = (int) $branch['id'];
        $_SESSION['branch']    = $branch['name'];

        return [
            'status'  => 200,
            'message' => 'Sucursal cambiada correctamente',
            'branch'  => [
                'id'   => (int) $branch['id'],
                'name' => $branch['name'],
            ],
        ];
    }

    // SESSION
    function checkSession() {
        define('SESSION_TIMEOUT', 1800);  // 30 minutos
        define('WARNING_TIME', 300);      // 5 minutos antes de expirar

          // Verificar si la sesión existe
        if (!isset($_SESSION['last_activity'])) {
            $_SESSION['last_activity'] = time();  // Inicializar si no está definida
        }

        $inactive_time = time() - $_SESSION['last_activity'];
        $result        = [
            "status"  => 200,
            "message" => "active",
        ];

          // Verifica si la sesión está activa
        if ($inactive_time >= SESSION_TIMEOUT) {
            $this->logout();
            $result = ["status" => "expired"];  // Notificar al frontend que la sesión expiró
            exit   (json_encode($result));      // Salir inmediatamente
        } elseif ($inactive_time >= (SESSION_TIMEOUT - WARNING_TIME)) {
            $time_left = SESSION_TIMEOUT - $inactive_time;
            $result    = [
                "status"        => "warning",
                "time_left"     => $time_left,
                "inactive_time" => $inactive_time
            ];
        }

        return $result;
    }

    function updateSession() {
        $_SESSION['last_activity'] = time();  // Actualizar la actividad de la sesión
        return [ "status" => 200, "message" => "Sesión actualizada"];
    }

    function logout() {
        sleep(2);
        session_unset();
        session_destroy();
        return "/dev/";
    }
}

$obj    = new Access();
$result = $obj->$opc();
echo json_encode($result);
