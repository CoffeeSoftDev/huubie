<?php
session_start();
if (empty($_POST['opc'])) exit(0);
$opc = $_POST['opc'];

require_once('../mdl/mdl-access.php');

class Access extends MAccess {

  

    function company(){
        // $sql = $this->getUserById([$_COOKIE['IDU']]);
        $photo = '';
        // if (!empty($sql['photo'])) {
        //     $photo = 'dev' . $sql['photo'];
        // } else {
        //     $photo = 'dev/src/img/df-user.png';
        // }

        return [
            "photo"   => $photo,
            // "user"    => $sql['fullname'],
            "udn"    => $_SESSION['UDN'],
            
        ];
    }


    function sidebar(){
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

        if($_SESSION['ROL'] === 1 ){
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
      // SESSION
    function checkSession(){
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
    function updateSession(){
        $_SESSION['last_activity'] = time();  // Actualizar la actividad de la sesión
        return [ "status" => 200, "message" => "Sesión actualizada"];
    }
    function logout(){
        sleep(2);
        session_unset();
        session_destroy();
        return "/dev/";
    }
}

$obj    = new Access();
$result = $obj->$opc();
echo json_encode($result);
