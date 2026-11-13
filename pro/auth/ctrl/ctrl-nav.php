<?php
require_once __DIR__ . '/../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/../mdl/mdl-nav.php';
require_once __DIR__ . '/../../core/security/_Permission.php';
require_once __DIR__ . '/../../core/helpers/_CoffeeSoft.php';

/*  Lo que piden la barra superior y el rail lateral de cada pagina.

      session        quien entro, su empresa, sus sucursales y su modo (claro u oscuro)
      rail           el menu lateral de la pagina que pregunta (y sus salidas
                     fijas: Mi perfil y, para el dueño, Configuración)
      theme          guarda el modo elegido
      switchBranch   cambia la sucursal activa

    Todas las rutas que salen de aqui son relativas a pro/: este ctrl lo llaman
    paginas a profundidades distintas y no sabe a cual esta la que pregunta. */
class ctrl extends mdl {
    const OPS = ['session', 'rail', 'theme', 'switchBranch'];

    // Las que solo leen la sesion: se suelta antes de atenderlas para no formar
    // en fila las demas peticiones que la pagina lanza al mismo tiempo.
    const READ_ONLY = ['session', 'rail', 'theme'];

    // La aplicacion solo tiene dos modos. Sus colores estan en
    // assets/js/tailwind-theme.js (MODES); aqui solo se guarda cual eligio cada quien.
    const MODES = ['light', 'dark'];

    const ROUTE_HOME     = 'app/home/';
    const ROUTE_PROFILE  = 'app/perfil/';
    const ROUTE_COMPANIES = 'app/empresas/';
    const ROUTE_SETUP     = 'app/configurar/';
    const ROUTE_SETTINGS  = 'app/configuracion/';

    function session() {
        $row = $this->getNavUser([Session::user()]);

        return [
            'status' => 200,
            'data'   => [
                'user'     => $row['user'] ?? $_SESSION['user'],
                'email'    => $row['email'] ?? $_SESSION['email'],
                'photo'    => userPhotoUrl($row['photo'] ?? '', 3),
                'color'    => $row['color'] ?? '',
                'rol'      => $_SESSION['rol'],
                'company'  => $_SESSION['company'],
                'branch'   => $_SESSION['branch'],
                'is_root'  => (int) $_SESSION['is_root'],
                // El dueño administra su empresa: la barra le ofrece Configuración.
                'is_owner' => $this->ownsCompany() ? 1 : 0,
                // root dentro de una empresa: la esta viendo como su dueño.
                'viewing'  => !empty($_SESSION['is_root']) && Plan::companyId() > 0 ? 1 : 0,
                'locked'   => Plan::companyId() > 0 && !Plan::state()['ok'] ? 1 : 0,
                'notices'  => $this->notices(),
                'branches' => $this->branches(),
                'theme'    => $this->mode($row['theme_code'] ?? null),
            ]
        ];
    }

    /*  EL RAIL. Dos formas, segun desde donde se pregunte:

        Dentro de un modulo (module resuelve contra modules.route): sus
        secciones, las que el usuario puede ver. Primero las sueltas y despues
        los submodulos, cada uno con las suyas.

        En cualquier otra pagina (inicio, perfil): los modulos que la empresa
        contrato. Uno sin ruta todavia se manda igual, sin a donde ir: el rail
        lo pinta apagado, que es mejor que esconder algo por lo que se paga.

        extras son las salidas fijas del pie: el perfil y, para root, Developer
        y Empresas. */
    function rail() {
        $module = $this->resolveModule($_POST['module']);

        $data = $module ? $this->railModule($module) : $this->railHome();
        $data['extras'] = $this->extras($module);

        return ['status' => 200, 'data' => $data];
    }

    function theme() {
        $code = trim((string) $_POST['code']);

        if (!in_array($code, self::MODES, true)) {
            return ['status' => 400, 'message' => 'Ese modo no existe.'];
        }

        $ok = $this->updateUserTheme([$code, Session::user()]);

        return $ok === true
             ? ['status' => 200, 'message' => 'Modo guardado.']
             : ['status' => 500, 'message' => 'No se pudo guardar el modo.'];
    }

    function switchBranch() {
        $id = (int) $_POST['id'];

        foreach ($this->listAllowedBranches() as $branch) {
            if ((int) $branch['id'] !== $id) continue;

            $_SESSION['branch_id'] = $id;
            $_SESSION['branch']    = $branch['name'];

            // root conserva su rol; los demas toman el que tienen en esa sucursal.
            if (empty($_SESSION['is_root'])) {
                $_SESSION['role_id'] = (int) $branch['role_id'];
                $_SESSION['rol']     = $branch['rol'] ?? '';
            }

            return ['status' => 200, 'message' => 'Sucursal cambiada.'];
        }

        return ['status' => 403, 'message' => 'No tienes acceso a esa sucursal.'];
    }

    /*  LA CAMPANA. Pendientes de la empresa, que solo le tocan a su dueño:
        pagar, y completar los datos de la empresa. Esto ultimo se le pide de
        frente solo en su primer ingreso (ctrl-auth); despues vive aqui, como
        recordatorio, hasta que lo haga. Las rutas son relativas a pro/. */
    private function notices() {
        $companyId = Plan::companyId();
        if ($companyId === 0 || empty($_SESSION['is_owner'])) return [];

        $notices = [];
        $state   = Plan::state();

        if (!$state['ok'] && $state['sub']) {
            $notices[] = [
                'icon'  => 'credit-card',
                'title' => $state['reason'] === 'trial' ? 'Tu prueba terminó' : 'Tienes un pago pendiente',
                'text'  => 'Tus módulos están bloqueados hasta regularizarlo.',
                'route' => self::ROUTE_HOME,
            ];
        }

        if (!$this->isCompanySetUp([$companyId])) {
            $notices[] = [
                'icon'  => 'building-2',
                'title' => 'Completa los datos de tu empresa',
                'text'  => 'RFC, dirección y tu sucursal. Toma un minuto.',
                'route' => self::ROUTE_SETUP,
            ];
        }

        return $notices;
    }

    // -- Rail --

    private function railModule($module) {
        $loose  = [];
        $bySub  = [];

        foreach (Permission::sections((int) $module['id']) as $section) {
            $item = [
                'id'    => (int) $section['id'],
                'name'  => $section['name'],
                'icon'  => $section['icon'] ?: 'square',
                'route' => trim((string) $section['route']),
            ];

            if ($section['submodule_id'] === null) $loose[] = $item;
            else $bySub[(int) $section['submodule_id']][] = $item;
        }

        $submodules = [];

        // Un submodulo sin secciones visibles no se pinta: abriria un flotante vacio.
        foreach ($bySub ? $this->listSubmodulesByModule([$module['id']]) : [] as $sub) {
            if (empty($bySub[(int) $sub['id']])) continue;

            $submodules[] = [
                'id'       => (int) $sub['id'],
                'name'     => $sub['name'],
                'icon'     => $sub['icon'] ?: 'folder',
                'sections' => $bySub[(int) $sub['id']],
            ];
        }

        return [
            'mode'       => 'module',
            'title'      => $module['name'],
            'items'      => $loose,
            'submodules' => $submodules,
        ];
    }

    private function railHome() {
        $state = Plan::state();
        $items = [];

        foreach (Permission::modules() as $module) {
            $items[] = [
                'id'     => (int) $module['id'],
                'name'   => $module['name'],
                'icon'   => $module['icon'] ?: 'layout-grid',
                'route'  => trim((string) $module['route']),
                // Empresa sin pago al corriente: el modulo se ve y no abre.
                'locked' => $state['ok'] ? 0 : 1,
            ];
        }

        return [
            'mode'       => 'home',
            'title'      => 'Inicio',
            'items'      => $items,
            'submodules' => [],
        ];
    }

    private function extras($module) {
        $extras = [];

        if (!empty($_SESSION['is_root'])) {
            $dev = $this->getModuleByCode(['developer']);

            if ($dev && trim((string) $dev['route']) !== '' && (!$module || $module['code'] !== 'developer')) {
                $extras[] = ['name' => $dev['name'], 'icon' => $dev['icon'] ?: 'code-xml', 'route' => trim($dev['route'], '/') . '/'];
            }

            $extras[] = ['name' => 'Empresas', 'icon' => 'building-2', 'route' => self::ROUTE_COMPANIES];
        }

        $extras[] = ['name' => 'Mi perfil', 'icon' => 'user-round', 'route' => self::ROUTE_PROFILE];

        // La configuracion de la empresa es de su dueño (root dentro de una
        // empresa la ve como tal: app/empresas le pone is_owner).
        if ($this->ownsCompany()) {
            $extras[] = ['name' => 'Configuración', 'icon' => 'settings', 'route' => self::ROUTE_SETTINGS];
        }

        return $extras;
    }

    private function ownsCompany() {
        return Plan::companyId() > 0 && !empty($_SESSION['is_owner']);
    }

    /*  El modulo de la pagina sale de su ruta relativa a pro/, contra
        modules.route por prefijo de segmento: 'app/developer' cubre
        'app/developer/accesos.php' pero 'app' no cubre 'apps'. */
    private function resolveModule($path) {
        $path = trim((string) $path, "/ \t\n\r\0\x0B");
        if ($path === '') return null;

        $bySection = $this->getModuleBySectionRoute([$path]);
        if ($bySection) return $bySection;

        foreach ($this->listModulesForMatch() as $module) {
            $route = trim((string) $module['route'], '/');

            if ($path === $route || strpos($path . '/', $route . '/') === 0) return $module;
        }

        return null;
    }

    // -- Sucursales --

    private function listAllowedBranches() {
        $companyId = Plan::companyId();
        if ($companyId === 0) return [];

        $all = !empty($_SESSION['is_root']) || !empty($_SESSION['is_owner']) ? 1 : 0;

        return $this->listBranchesByUser([Session::user(), $companyId, $all]);
    }

    private function branches() {
        $current = (int) ($_SESSION['branch_id'] ?? 0);
        $list    = [];

        foreach ($this->listAllowedBranches() as $branch) {
            $list[] = [
                'id'        => (int) $branch['id'],
                'name'      => $branch['name'],
                'ubication' => $branch['ubication'] ?: '',
                'selected'  => (int) $branch['id'] === $current ? 1 : 0,
            ];
        }

        return $list;
    }

    // -- Modo --

    /*  users.theme_code guarda 'light' o 'dark'. Quien nunca eligio ve el claro.
        Puede traer el code de un tema de cuando habia catalogo (themes): esa
        persona sigue en oscuro si la pagina de su tema lo era. */
    private function mode($code) {
        $code = trim((string) $code);

        if (in_array($code, self::MODES, true)) return $code;
        if ($code === '') return 'light';

        $scheme = $this->getThemeScheme([$code]);

        return $scheme !== null && $scheme !== 'light' ? 'dark' : 'light';
    }
}

if (!in_array($_POST['opc'], ctrl::OPS, true)) exit(0);

header('Content-Type: application/json; charset=utf-8');

if (Session::user() === null) {
    echo json_encode(['status' => 401, 'message' => 'Tu sesión terminó. Vuelve a iniciar sesión.']);
    exit(0);
}

if (in_array($_POST['opc'], ctrl::READ_ONLY, true)) session_write_close();

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
