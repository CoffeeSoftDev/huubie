<?php
session_start();

if (empty($_POST['opc'])) exit(0);
$opc = $_POST['opc'];

require_once('../mdl/mdl-access.php');

class Access extends MAccess {

    function getUser() {
        // Traer solo por nombre de usuario
        $sql = $this->getUserByData([$_POST['user']]);


        $result = [
            "status"  => 400,
            "message" => "Usuario y/o contraseña incorrecta.",
        ];


        // Verificar existencia y clave
         if ($sql && $sql['key'] === md5($_POST['key'])) {

            $idUser      = $sql['id'];
            $idRol       = $sql['rol'];
            $idSub       = $sql['sucursal'];
            $social_name = $sql['company'];

            $_SESSION['ID']            = $idUser;
            $_SESSION['USR']           = $idUser;
            $_SESSION['ROL']           = $idRol;
            $_SESSION['ROLID']         = $sql['rol_id'];
            $_SESSION['OWNER']         = $sql['owner'];
            $_SESSION['SUB']           = $idSub;
            $_SESSION['SUBSIDIARIE_NAME']           = $sql['subsidiaries_name'];
            $_SESSION['COMPANY']       = $social_name;
            $_SESSION['last_activity'] = time();
            $_SESSION['login_time']    = time();
            $_SESSION['USER']          = $sql['user'];
            $_SESSION['DB']            = $sql['DB'];
            $_SESSION['UBICATION']     = $sql['ubication'];
            $_SESSION['LOGO']          = $sql['logo'];
            $_SESSION['COMPANY_ID']    = $sql['company_id'];
            $_SESSION['COM']    = $sql['company_id'];

            $rute = ($idRol === 1 && $sql['active'] == 0) ? "/alpha/empresas/" : "/alpha/menu/";

            return [
                "status"  => 200,
                "message" => $rute
            ];
        }

        return $result;
    }

    function company(){
        $sql = $this->getUserById([$_SESSION['USR']]);
        $photo = '';
        if (!empty($sql['photo'])) {
            $photo = '../../alpha' . $sql['photo'];
        } else {
            $photo = '../src/img/df-user.png';
        }

        $routes = [];
        if($_SESSION['ROLID'] != 5){
            $routes = $this->getRoutesByCompany([$_SESSION['COMPANY_ID']]);
        } else {
            $routes = $this->getRoutes();
        }

        // Todo usuario habilitado puede cambiar de sucursal (switch de sesion):
        // se listan todas las sucursales de su empresa. El admin (ROLID == 1)
        // usa el selector como filtro de vista; el resto hace switch de sesion.
        $isAdmin      = ($_SESSION['ROLID'] == 1);
        $subsidiaries = $this->getSubsidiariesByCompany([$_SESSION['COMPANY_ID']]);

        return [
            "company"       => $_SESSION['COMPANY'],
            "subsidiary"    => $_SESSION['SUBSIDIARIE_NAME'],
            "subsidiary_id" => $_SESSION['SUB'],
            "is_admin"      => $isAdmin,
            "subsidiaries"  => $subsidiaries,
            "photo"         => $photo,
            "user"          => $sql['fullname'],
            'level'         => $_SESSION['ROLID'],
            'rol'           =>  $_SESSION['ROL'],
            'routes'        => $routes,
        ];
    }


    // Sucursales de la empresa para el selector de la navbar, con el estado del
    // turno de caja por sucursal (para el indicador "Turno abierto / Sin turno"):
    //   'open'  -> turno abierto hoy
    //   'stale' -> turno abierto pero de un dia anterior (sin cerrar)
    //   'none'  -> sin turno abierto
    function branches(){
        $list = $this->getBranchesForNavbar([$_SESSION['COMPANY_ID']]);

        $today        = date('Y-m-d');
        $openShiftMap = [];
        foreach ($this->getOpenShifts() as $os) {
            $openShiftMap[(int) $os['subsidiary_id']] = $os['last_opened'];
        }
        $shiftStateFor = function ($id) use ($openShiftMap, $today) {
            if (!isset($openShiftMap[(int) $id])) return 'none';
            return substr($openShiftMap[(int) $id], 0, 10) === $today ? 'open' : 'stale';
        };

        $branches = [];
        foreach ($list as $branch) {
            $parts    = preg_split('/\s+/', trim($branch['name']));
            $initials = strtoupper(substr($parts[0], 0, 1));
            if (count($parts) > 1) {
                $initials .= strtoupper(substr(end($parts), 0, 1));
            }

            $branches[] = [
                'id'          => (int) $branch['id'],
                'name'        => $branch['name'],
                'ubication'   => $branch['ubication'] ?? '',
                'active'      => (int) $branch['active'],
                'initials'    => $initials,
                'selected'    => ((int) $branch['id'] === (int) $_SESSION['SUB']) ? 1 : 0,
                'shift_state' => $shiftStateFor($branch['id']),
            ];
        }

        return [
            'status'   => 200,
            'company'  => $_SESSION['COMPANY'] ?? '',
            'current'  => [
                'id'          => (int) ($_SESSION['SUB'] ?? 0),
                'name'        => $_SESSION['SUBSIDIARIE_NAME'] ?? '',
                'shift_state' => $shiftStateFor($_SESSION['SUB'] ?? 0),
            ],
            'branches' => $branches,
        ];
    }

    // Cambia la sucursal activa reescribiendo la sesion. Equivale a re-loguear
    // con otro usuario de la misma empresa, pero sin teclear credenciales.
    function switchSubsidiary(){
        $subId = $_POST['subsidiaries_id'] ?? null;

        if (empty($subId)) {
            return ["status" => 400, "message" => "Sucursal no especificada."];
        }

        // Validar que la sucursal pertenece a la empresa del usuario en sesion.
        $sub = $this->getSubsidiaryForCompany([$subId, $_SESSION['COMPANY_ID']]);

        if (!$sub) {
            return ["status" => 403, "message" => "La sucursal no pertenece a tu empresa."];
        }

        $_SESSION['SUB']              = $sub['id'];
        $_SESSION['SUBSIDIARIE_NAME'] = $sub['valor'];
        $_SESSION['last_activity']    = time();

        return [
            "status"        => 200,
            "message"       => "Sucursal actualizada.",
            "subsidiary"    => $sub['valor'],
            "subsidiary_id" => $sub['id']
        ];
    }

    function sidebar(){
        $routes = [];
        if($_SESSION['ROLID'] != 5){
            $routes = $this->getRoutesByCompany([$_SESSION['COMPANY_ID']]);
        } else {
            $routes = $this->getRoutes();
        }

        $sidebar = [];
        $submenu = [];
        foreach($routes as $route){
            if($_SESSION['ROLID'] != 5){
                $submenu[] = [
                    "text" => $route['name'],
                    "url"  => '/alpha/'. $route['route']
                ];
            } else {
                $submenu[] = [
                    "text" => $route['nickname'],
                    "url"  => '/alpha/'. $route['route']
                ];
            }
        }

        $sidebar[] = [ 
            "text"    => 'Ventas',
            "submenu" => $submenu
        ];

        if($_SESSION['ROLID'] == 5){
          $sidebar[] = [
            "text"    => "Configuracion",
            "submenu" => [
                ["text" => "Empresas", "url" => "/alpha/empresas/"],
                ["text" => "Usuarios", "url" => "/alpha/usuarios/"],
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
      // SESSION
    function checkSession(){
        define('SESSION_TIMEOUT', 18000);      // 5 horas de inactividad
        define('WARNING_TIME', 300);           // 5 minutos antes de expirar por inactividad
        define('MAX_SESSION_DURATION', 28800); // 8 horas límite absoluto

          // Verificar si la sesión existe
        if (!isset($_SESSION['last_activity'])) {
            $_SESSION['last_activity'] = time();
        }
        if (!isset($_SESSION['login_time'])) {
            $_SESSION['login_time'] = time();
        }

        $inactive_time  = time() - $_SESSION['last_activity'];
        $total_duration = time() - $_SESSION['login_time'];
        $result         = [
            "status"  => 200,
            "message" => "active",
        ];

          // Límite absoluto de 8 horas
        if ($total_duration >= MAX_SESSION_DURATION) {
            $this->logout();
            $result = ["status" => "expired", "reason" => "max_duration"];
            exit(json_encode($result));
        }

          // Timeout por inactividad
        if ($inactive_time >= SESSION_TIMEOUT) {
            $this->logout();
            $result = ["status" => "expired", "reason" => "inactivity"];
            exit(json_encode($result));
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
    function updateSession(){
        $_SESSION['last_activity'] = time();  // Actualizar la actividad de la sesión
        return [ "status" => 200, "message" => "Sesión actualizada"];
    }
    function logout(){
        sleep(2);
        session_unset();
        session_destroy();
        return "/alpha/";
    }
}

$obj    = new Access();
$result = $obj->$opc();
echo json_encode($result);