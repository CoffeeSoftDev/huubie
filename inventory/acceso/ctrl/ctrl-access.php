<?php
/*  SESION DE 8 HORAS.

    Se fija ANTES de session_start(), que es cuando nace la sesion del login y
    cuando se manda su cookie: despues ya no sirve de nada. El .htaccess de
    inventory pone lo mismo para el resto de las peticiones (ahi hace falta
    porque el recolector de sesiones corre en cualquiera de ellas); esto de aqui
    cubre la que de verdad importa y funciona aunque el hosting ignore el
    php_value del .htaccess. */
ini_set('session.gc_maxlifetime', 28800);
session_set_cookie_params(28800);

session_start();
if (empty($_POST['opc'])) exit(0);
$opc = $_POST['opc'];

require_once('../mdl/mdl-access.php');
require_once('../../conf/_Message.php');

class Access extends MAccess {

    // Recuperación de contraseña: cuánto vive el código y cuántos tiros hay.
    // Seis dígitos son un millón de combinaciones; con 15 minutos y 5 intentos
    // la ventana de quien prueba a ciegas son 5 tiros entre un millón.
    const RESET_MINUTES     = 15;
    const RESET_MAX_TRIES   = 5;
    const RESET_CODE_LENGTH = 6;
    const PASSWORD_MIN      = 4;

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
            $_SESSION['email']      = $usr['email'] ?? '';
            $_SESSION['is_owner']   = $usr['is_owner'];
            $_SESSION['last_activity'] = time();

            // Quién se salta el selector de sucursal: el dueño (is_owner) y
            // cualquiera con rol Super Admin o Administrador. Antes solo contaba
            // is_owner, así que un Administrador aterrizaba en el selector.
            $isAdmin = (int) ($usr['is_owner'] ?? 0) === 1 || $this->userIsAdmin([$usr['IDU']]);
            $_SESSION['is_admin'] = $isAdmin ? 1 : 0;

            return [
                "IDU"        => $usr['IDU'],
                "company_id" => $usr['company_id'],
                "company"    => $usr['company'],
                "user"       => $_SESSION['user'],
                // El correo lo usa el login para recordar al usuario en este navegador.
                "email"      => $_SESSION['email'],
                "photo"      => $this->photoUrl($usr['photo'] ?? ''),
                // Color elegido para el usuario: pinta su avatar en el login recordado
                // y en la navbar.
                "color"      => $usr['color'] ?? '',
                "is_owner"   => $usr['is_owner'],
                "is_admin"   => $_SESSION['is_admin'],
            ];
    }

    /* ===== Recuperación de contraseña =====
       Tres pasos, los tres los llama inventory/recuperar.php:
         1. forgotPassword() manda el código al correo
         2. verifyCode()     solo abre el paso 3
         3. resetPassword()  escribe la contraseña nueva
       Portado de erp-pro/pro/auth/ctrl/ctrl-auth.php. */

    /*  PASO 1 :: EL CÓDIGO SE GUARDA DESPUÉS DE ENTREGARLO. Si el correo no
        sale no se escribe nada, porque un código que nadie llegó a leer solo
        sirve para gastarle los intentos al siguiente.

        La respuesta distingue "no existe esa cuenta" de "no se pudo entregar":
        le dice a cualquiera si un correo está dado de alta, pero sin eso quien
        escribe un correo viejo se queda esperando un mensaje que no va a llegar. */
    function forgotPassword() {
        $correo = trim($_POST['correo'] ?? '');

        if ($correo === '') {
            return ['status' => 400, 'message' => 'Escribe tu correo.', 'data' => null];
        }

        $usuario = $this->getUserForReset([$correo]);

        if (empty($usuario)) {
            return [
                'status'  => 404,
                'message' => 'No encontramos una cuenta activa con ese correo.',
                'data'    => null
            ];
        }

        $codigo  = $this->resetCode();
        $nombre  = trim($usuario['name'] ?? '');
        $saludo  = $nombre === '' ? 'Hola.' : "Hola, {$nombre}.";
        $mensaje = new Message;

        $entregado = $mensaje->correo(
            $usuario['email'],
            'Código para recuperar tu contraseña — Coffee Inventory',
            $saludo . "\n\n" . $this->recoveryMessage($codigo)
        );

        if ($entregado !== true) {
            return [
                'status'  => 502,
                'message' => 'No pudimos entregarte el código. Inténtalo más tarde; tu contraseña actual sigue funcionando.',
                'data'    => null
            ];
        }

        if ($this->setResetCode([password_hash($codigo, PASSWORD_BCRYPT), self::RESET_MINUTES, $usuario['IDU']]) !== true) {
            // Salió el correo pero no se guardó el código: el que acaba de leer
            // no le va a servir, y hay que decírselo.
            return [
                'status'  => 500,
                'message' => 'Enviamos el correo pero no pudimos registrar el código. Inténtalo de nuevo.',
                'data'    => null
            ];
        }

        return [
            'status'  => 200,
            'message' => 'Te enviamos un código a tu correo.',
            'data'    => ['minutos' => self::RESET_MINUTES]
        ];
    }

    /*  PASO 2 :: no entrega nada ni firma ninguna sesión, solo abre la pantalla
        de la contraseña nueva. Por eso resetPassword() vuelve a pedir el código:
        si este paso fuera el único guardián, bastaría con saltárselo. */
    function verifyCode() {
        $correo = trim($_POST['correo'] ?? '');
        $codigo = trim($_POST['codigo'] ?? '');

        $usuario = $correo === '' ? null : $this->getUserForReset([$correo]);

        if (empty($usuario)) {
            return ['status' => 404, 'message' => 'No encontramos esa cuenta. Vuelve a empezar.', 'data' => null];
        }

        $revision = $this->checkCode($usuario, $codigo);

        return [
            'status'  => $revision['status'],
            'message' => $revision['message'],
            'data'    => $revision['status'] === 200 ? ['minimo' => self::PASSWORD_MIN] : null
        ];
    }

    // PASO 3 :: el código es lo único que demuestra que quien escribe la
    // contraseña es quien recibió el correo, así que se comprueba otra vez.
    function resetPassword() {
        $correo   = trim($_POST['correo'] ?? '');
        $codigo   = trim($_POST['codigo'] ?? '');
        $nueva    = (string) ($_POST['nueva'] ?? '');
        $confirma = (string) ($_POST['confirmar'] ?? '');

        $usuario = $correo === '' ? null : $this->getUserForReset([$correo]);

        if (empty($usuario)) {
            return ['status' => 404, 'message' => 'No encontramos esa cuenta. Vuelve a empezar.', 'data' => null];
        }

        // El código va ANTES que la contraseña: si está vencido da igual lo que
        // haya escrito, y así no se le va un intento en corregir algo inútil.
        $revision = $this->checkCode($usuario, $codigo);

        if ($revision['status'] !== 200) {
            return ['status' => $revision['status'], 'message' => $revision['message'], 'data' => null];
        }

        if ($nueva === '' || $confirma === '') {
            return ['status' => 400, 'message' => 'Escribe la contraseña nueva dos veces.', 'data' => null];
        }

        if (mb_strlen($nueva) < self::PASSWORD_MIN) {
            return ['status' => 400, 'message' => 'La contraseña debe tener al menos ' . self::PASSWORD_MIN . ' caracteres.', 'data' => null];
        }

        if ($nueva !== $confirma) {
            return ['status' => 400, 'message' => 'Las dos contraseñas no coinciden.', 'data' => null];
        }

        $guardada = $this->setNewPassword([
            password_hash($nueva, PASSWORD_BCRYPT),
            md5($nueva),
            $usuario['IDU']
        ]);

        return $guardada === true
             ? ['status' => 200, 'message' => 'Tu contraseña quedó lista. Ya puedes iniciar sesión.', 'data' => null]
             : ['status' => 500, 'message' => 'No pudimos guardar la contraseña. Inténtalo de nuevo.', 'data' => null];
    }

    /*  ¿VALE ESTE CÓDIGO? El único sitio donde se decide.

        El orden de las preguntas importa: primero si hay código, luego si sigue
        vivo, luego si quedan tiros y solo al final si acierta. Así un código
        vencido no gasta intentos y el mensaje dice lo que de verdad pasa.

        AL QUINTO FALLO EL CÓDIGO SE TIRA: si alguien está probando a ciegas, lo
        que no puede es seguir teniendo blanco. */
    private function checkCode($usuario, $codigo) {
        $guardado = (string) ($usuario['reset_code'] ?? '');
        $fallos   = (int) ($usuario['reset_tries'] ?? 0);

        if ($guardado === '') {
            return ['status' => 409, 'message' => 'No tienes ningún código pendiente. Pide uno nuevo.'];
        }

        if (empty($usuario['reset_vigente'])) {
            return ['status' => 410, 'message' => 'El código ya venció. Pide uno nuevo.'];
        }

        if ($fallos >= self::RESET_MAX_TRIES) {
            return ['status' => 429, 'message' => 'Se agotaron los intentos. Pide un código nuevo.'];
        }

        // Seis dígitos o no es un código. No gasta intento: al que se le coló un
        // espacio no hay por qué cobrárselo.
        if (!preg_match('/^[0-9]{' . self::RESET_CODE_LENGTH . '}$/', $codigo)) {
            return ['status' => 400, 'message' => 'El código son ' . self::RESET_CODE_LENGTH . ' dígitos.'];
        }

        if (password_verify($codigo, $guardado)) {
            return ['status' => 200, 'message' => 'Código correcto.'];
        }

        $fallos++;

        if ($fallos >= self::RESET_MAX_TRIES) {
            $this->clearResetCode([$usuario['IDU']]);

            return ['status' => 429, 'message' => 'Se agotaron los intentos. Pide un código nuevo.'];
        }

        $this->addResetTry([$usuario['IDU']]);

        $quedan = self::RESET_MAX_TRIES - $fallos;

        return [
            'status'  => 401,
            'message' => 'El código no es correcto. Te ' . ($quedan === 1 ? 'queda 1 intento' : "quedan {$quedan} intentos") . '.'
        ];
    }

    // random_int() y no random_bytes() con módulo: aquel repartía 256 valores
    // entre 10 dígitos, así que del 0 al 5 salían más seguido que del 6 al 9.
    private function resetCode() {
        $codigo = '';

        for ($i = 0; $i < self::RESET_CODE_LENGTH; $i++) $codigo .= random_int(0, 9);

        return $codigo;
    }

    /*  El correo dice DOS cosas que no son adorno: cuánto dura el código, para
        que no lo teclee media hora después y crea que el sistema está roto; y
        que su contraseña de siempre sigue sirviendo, que es lo que permite a
        quien no pidió nada ignorar el mensaje sin hacer nada más. */
    private function recoveryMessage($codigo) {
        $texto  = "Tu código para recuperar el acceso a Coffee Inventory es:\n\n";
        $texto .= "{$codigo}\n\n";
        $texto .= "Vence en " . self::RESET_MINUTES . " minutos. Escríbelo aquí y ahí mismo eliges tu nueva contraseña:\n";
        $texto .= $this->baseUrl() . "recuperar.php\n\n";
        $texto .= "Si no has sido tú, ignora este mensaje: tu contraseña actual sigue funcionando.";

        return $texto;
    }

    /*  La foto del usuario, lista para meter en un <img src>.

        `users.photo` guarda el NOMBRE del archivo dentro de
        inventory/uploads/users/ y aquí se le arma la URL con baseUrl(), que sale
        de la ruta real del controlador: así no hay un '/inventory/' escrito a
        mano que se rompa cuando el proyecto cuelga de una subcarpeta.

        Si el valor ya viene como URL (http...) o como ruta absoluta (/...) se
        deja igual: el día que la carga de imágenes guarde una ruta completa
        --o una foto de Google-- esto sigue sirviendo sin tocarse. */
    private function photoUrl($photo) {
        $photo = trim((string) $photo);

        if ($photo === '')                                  return '';
        if (preg_match('#^(https?:)?//#', $photo))          return $photo;
        if ($photo[0] === '/')                              return $photo;

        return $this->baseUrl() . 'uploads/users/' . rawurlencode($photo);
    }

    // La URL del login. Sale de la ruta de este controlador
    // (/inventory/acceso/ctrl/) y no escrita a mano, así una prueba desde local
    // manda a local.
    private function baseUrl() {
        $esquema = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host    = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $ruta    = dirname(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '')));

        return $esquema . '://' . $host . rtrim(str_replace('\\', '/', $ruta), '/') . '/';
    }

    function company() {
        // El rol depende de la sucursal accedida: se pasa la branch_id activa para
        // resolver users_braches -> roles de esa sucursal (no de una cualquiera).
        $branchId = (int) ($_SESSION['branch_id'] ?? 0);
        $sql = !empty($_SESSION['IDU']) ? $this->getSessionUser([$branchId, $_SESSION['IDU']]) : null;

        // Se prioriza el valor vivo de la BD sobre el cacheado en sesion (login viejo),
        // asi un rename de compania/sucursal se refleja sin cerrar sesion.
        $company = $sql['company'] ?? ($_SESSION['company'] ?? '');
        // Sucursal asignada: se resuelve desde branches por branch_id (igual que inventario).
        $branch  = $sql['branch'] ?? ($_SESSION['branch'] ?? '');

        return [
            "photo"      => $this->photoUrl($sql['photo'] ?? ''),
            "color"      => $sql['color'] ?? '',
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
    function menu () {
        $userId   = (int) ($_SESSION['user_id'] ?? $_SESSION['IDU'] ?? 0);
        $branchId = (int) ($_SESSION['branch_id'] ?? 0);

        if ($userId <= 0 || $branchId <= 0) {
            return ['status' => 200, 'items' => []];
        }

        // Modulo actual: se resuelve por la ruta de la pagina (relativa a /inventory/)
        // que envia el sidebar. Asi el menu muestra solo las secciones de ese modulo.
        $moduleId = $this->resolveModuleId($_POST['module'] ?? '');

        // Con modulo resuelto se acota a sus secciones; si no (pagina fuera de un
        // modulo) se cae al comportamiento previo: todas las secciones accesibles.
        $ls = $moduleId > 0
            ? $this->getAccessibleSectionsByModule([$userId, $branchId, $moduleId])
            : $this->getAccessibleSections([$userId, $branchId]);

        $items = [];
        foreach ($ls as $s) {
            // Sin ruta no hay a donde ir: el rail armaria base + '' = raiz de
            // inventory, que es el login, y el usuario lo vive como "me saco la sesion".
            $route = trim((string) ($s['route'] ?? ''));
            if ($route === '') continue;

            $items[] = [
                'code'  => $s['code'],
                'title' => $s['name'],
                'icon'  => $s['icon'] ?: 'square',     // ícono por defecto si falta
                'route' => $route                      // ruta relativa a inventory/
            ];
        }

        return ['status' => 200, 'items' => $items, 'module_id' => $moduleId];
    }

    // Empareja la ruta de la pagina (relativa a /inventory/) contra modules.route,
    // tomando el prefijo de ruta mas largo (segmento a segmento). 0 si no hay match.
    private function resolveModuleId($path) {
        $path = trim((string) $path, "/ \t\n\r\0\x0B");
        if ($path === '') return 0;

        foreach ($this->getModulesForMatch() as $m) {
            $route = trim((string) $m['route'], '/');
            if ($route === '') continue;
            // Match exacto o por segmento: "operacion/almacen" cubre
            // "operacion/almacen/stock.php" pero "admin" no cubre "administracion".
            if ($path === $route || strpos($path . '/', $route . '/') === 0) {
                return (int) $m['id'];
            }
        }
        return 0;
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

    /* ===== Temas del navbar ===== */

    // Catalogo + el tema elegido por el usuario. Sin sesion se responde igual,
    // con el tema por defecto, para que la barra del login tambien se pinte.
    function themes() {
        $userId = (int) ($_SESSION['user_id'] ?? $_SESSION['IDU'] ?? 0);
        $ls     = $this->getThemes();

        $themes  = [];
        $default = 'light';
        foreach ($ls as $t) {
            if ((int) $t['is_default'] === 1) $default = $t['code'];
            $themes[] = [
                'code'   => $t['code'],
                'name'   => $t['name'],
                'color'  => $t['color'],
                'accent' => $t['accent'],
                'mode'   => $t['mode'],
                'badge'  => $t['badge'] ?: '',
            ];
        }

        $current = $userId > 0 ? $this->getUserTheme([$userId]) : null;

        return [
            'status'  => 200,
            'themes'  => $themes,
            'current' => $current ?: $default,
        ];
    }

    function saveTheme() {
        $userId = (int) ($_SESSION['user_id'] ?? $_SESSION['IDU'] ?? 0);
        $code   = trim($_POST['code'] ?? '');

        if ($userId <= 0)                 return ['status' => 401, 'message' => 'Sin sesión'];
        if ($code === '')                 return ['status' => 400, 'message' => 'Tema no válido'];
        if (!$this->themeExists([$code])) return ['status' => 404, 'message' => 'Ese tema no existe'];

        $ok = $this->setUserTheme([$code, $userId]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Tema guardado' : 'No se pudo guardar el tema'];
    }

    // SESSION
    function checkSession() {
        define('SESSION_TIMEOUT', 28800);  // 8 horas
        define('WARNING_TIME', 300);       // 5 minutos antes de expirar

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
