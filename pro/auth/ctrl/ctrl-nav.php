<?php
require_once __DIR__ . '/../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/../mdl/mdl-nav.php';
require_once __DIR__ . '/../../core/security/_Permission.php';
require_once __DIR__ . '/../../core/helpers/_CoffeeSoft.php';

// Lo que piden la barra superior (session, branches, themes, avisos) y el menu lateral (menu) de cada pagina.
// branches, switchBranch, themes, saveTheme y lsAvisos los usa la barra copiada de inventory (app/catalogo/src/js/navbar.js).
class ctrl extends mdl {
    const OPS = ['session', 'menu', 'branches', 'switchBranch', 'themes', 'saveTheme', 'lsAvisos'];

    function session() {
        $row = $this->getNavUser([Session::user()]);

        return [
            'status' => 200,
            'data'   => [
                'user'    => $row['user'] ?? $_SESSION['user'],
                'email'   => $row['email'] ?? $_SESSION['email'],
                'photo'   => userPhotoUrl($row['photo'] ?? '', 3),
                'color'   => $row['color'] ?? '',
                'rol'     => $_SESSION['rol'],
                'company' => $_SESSION['company'],
                'branch'  => $_SESSION['branch'],
                'branch_id' => (int) ($_SESSION['branch_id'] ?? 0),
                'is_root' => (int) $_SESSION['is_root'],
            ]
        ];
    }

    /*  Las secciones del modulo de la pagina, las que el usuario puede ver.
        El modulo sale de la ruta de la pagina relativa a pro/ (module), contra
        modules.route por prefijo de segmento: 'app/developer' cubre
        'app/developer/accesos.php' pero 'app' no cubre 'apps'. */
    function menu() {
        $moduleId = $this->resolveModule($_POST['module']);
        $items    = [];

        foreach (Permission::sections($moduleId) as $section) {
            // Sin ruta no hay a donde ir: el rail armaria la raiz de pro, que es el login.
            $route = trim((string) $section['route']);
            if ($route === '') continue;

            $items[] = [
                'code'  => $section['code'],
                'title' => $section['name'],
                'icon'  => $section['icon'] ?: 'square',
                'route' => $route
            ];
        }

        return ['status' => 200, 'items' => $items, 'module_id' => $moduleId];
    }

    // -- Sucursales --

    // Las sucursales activas de la empresa que el usuario puede abrir; la de la sesion va marcada.
    function branches() {
        $current = (int) ($_SESSION['branch_id'] ?? 0);
        $list    = [];

        foreach ($this->myBranches((int) ($_SESSION['company_id'] ?? 0)) as $b) {
            $list[] = [
                'id'        => (int) $b['id'],
                'name'      => $b['name'],
                'ubication' => (string) ($b['ubication'] ?? ''),
                'active'    => (int) $b['is_active'],
                'initials'  => $this->initials($b['name']),
                'selected'  => (int) $b['id'] === $current ? 1 : 0
            ];
        }

        return [
            'status'   => 200,
            'company'  => (string) ($_SESSION['company'] ?? ''),
            'current'  => ['id' => $current, 'name' => (string) ($_SESSION['branch'] ?? '')],
            'branches' => $list
        ];
    }

    // Cambia la sucursal de la sesion, igual que el login: sucursal y rol de esa sucursal.
    function switchBranch() {
        $id     = (int) ($_POST['id'] ?? 0);
        $branch = null;

        foreach ($this->myBranches((int) ($_SESSION['company_id'] ?? 0)) as $b) {
            if ((int) $b['id'] === $id) {
                $branch = $b;
                break;
            }
        }

        if (!$branch) return ['status' => 403, 'message' => 'Esta sucursal no está asignada a tu usuario.'];

        $_SESSION['branch_id'] = (int) $branch['id'];
        $_SESSION['branch']    = $branch['name'];

        // El dueno puede no tener fila en users_braches: sin rol de la sucursal conserva el que traia.
        if (empty($_SESSION['is_root']) && !empty($branch['role_id'])) {
            $_SESSION['role_id'] = (int) $branch['role_id'];
            $_SESSION['rol']     = $branch['rol'] ?? '';
        }

        return [
            'status'  => 200,
            'message' => 'Sucursal cambiada correctamente',
            'branch'  => ['id' => (int) $branch['id'], 'name' => $branch['name']]
        ];
    }

    // -- Temas --

    // El catalogo de fayxzvov_app.themes que la empresa tiene habilitado y el tema del usuario.
    function themes() {
        $themes  = [];
        $codes   = [];
        $default = '';

        foreach ($this->allowedThemes() as $t) {
            $themes[] = [
                'code'      => $t['code'],
                'name'      => $t['name'],
                'tipo'      => $t['tipo'],
                'color'     => $t['color'],
                'image'     => $t['tipo'] === 'imagen' ? $this->themeImageUrl($t['image']) : '',
                'accent'    => $t['accent'],
                'primary'   => $t['primary_color'],
                'secondary' => $t['secondary_color'],
                'sidebar'   => $t['sidebar_color'] ?: '',
                'scheme'    => $t['scheme'],
                'mode'      => $t['mode'],
                'badge'     => $t['badge'] ?: ''
            ];

            $codes[] = $t['code'];
            if ($default === '' && (int) $t['is_default'] === 1) $default = $t['code'];
        }

        if ($default === '' && $codes) $default = $codes[0];

        $current = $this->getUserTheme([Session::user()]);
        if (!in_array($current, $codes, true)) $current = $default;

        return ['status' => 200, 'themes' => $themes, 'current' => $current];
    }

    function saveTheme() {
        $code = trim((string) ($_POST['code'] ?? ''));

        if ($code === '')                       return ['status' => 400, 'message' => 'Tema no válido.'];
        if (!$this->themeExists([$code]))       return ['status' => 404, 'message' => 'Ese tema no existe.'];
        if (!in_array($code, array_column($this->allowedThemes(), 'code'), true)) {
            return ['status' => 403, 'message' => 'Ese tema no está habilitado para tu empresa.'];
        }

        return $this->setUserTheme([$code, Session::user()])
             ? ['status' => 200, 'message' => 'Tema guardado.']
             : ['status' => 500, 'message' => 'No se pudo guardar el tema.'];
    }

    // -- Avisos --

    // En pro todavia no hay avisos: la campana queda vacia hasta que los haya.
    function lsAvisos() {
        return ['status' => 200, 'items' => []];
    }

    // -- Auxiliares --

    // Root no tiene empresa (company_id 0): no hay sucursales que listar.
    private function myBranches($companyId) {
        if ($companyId <= 0) return [];

        return $this->listNavBranches([Session::user(), $companyId, !empty($_SESSION['is_owner']) ? 1 : 0]);
    }

    // Root ve todo el catalogo; los demas, los temas por defecto y los que su empresa habilito.
    private function allowedThemes() {
        if (!empty($_SESSION['is_root'])) return $this->listThemes();

        return $this->listThemesByCompany([(int) ($_SESSION['company_id'] ?? 0)]);
    }

    /*  La imagen se guarda relativa a pro/ (uploads/themes/<code>.<ext>, desde developer).
        La URL sale de la ruta de este archivo: pro/auth/ctrl/ctrl-nav.php -> pro/.
        ?v= con la fecha del archivo para que el navegador no muestre una imagen vieja. */
    private function themeImageUrl($image) {
        $image = trim((string) $image);
        if ($image === '') return '';

        $file = __DIR__ . '/../../' . $image;
        if (!is_file($file)) return '';

        $base = rtrim(str_replace('\\', '/', dirname(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '')))), '/');

        return $base . '/' . ltrim($image, '/') . '?v=' . filemtime($file);
    }

    // Iniciales como en inventory: primera letra de la primera palabra y de la ultima.
    private function initials($name) {
        $words = preg_split('/\s+/', trim((string) $name), -1, PREG_SPLIT_NO_EMPTY);
        if (!$words) return '';

        $first = mb_substr($words[0], 0, 1, 'UTF-8');
        $last  = count($words) > 1 ? mb_substr($words[count($words) - 1], 0, 1, 'UTF-8') : '';

        return mb_strtoupper($first . $last, 'UTF-8');
    }

    private function resolveModule($path) {
        $path = trim((string) $path, "/ \t\n\r\0\x0B");
        if ($path === '') return 0;

        $bySection = $this->getModuleBySectionRoute([$path]);
        if ($bySection > 0) return $bySection;

        foreach ($this->listModulesForMatch() as $module) {
            $route = trim((string) $module['route'], '/');

            if ($path === $route || strpos($path . '/', $route . '/') === 0) return (int) $module['id'];
        }

        return 0;
    }
}

if (!in_array($_POST['opc'], ctrl::OPS, true)) exit(0);

header('Content-Type: application/json; charset=utf-8');

if (Session::user() === null) {
    echo json_encode(['status' => 401, 'message' => 'Tu sesión terminó. Vuelve a iniciar sesión.', 'items' => []]);
    exit(0);
}

// Todas menos switchBranch solo leen la sesion: se suelta ya para no formar en fila
// las demas peticiones que la pagina lanza al mismo tiempo.
if ($_POST['opc'] !== 'switchBranch') session_write_close();

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
