<?php
require_once __DIR__ . '/../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/../mdl/mdl-nav.php';
require_once __DIR__ . '/../../core/security/_Permission.php';
require_once __DIR__ . '/../../core/helpers/_CoffeeSoft.php';

// Lo que piden la barra superior (session) y el menu lateral (menu) de cada pagina.
class ctrl extends mdl {
    const OPS = ['session', 'menu'];

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

    private function resolveModule($path) {
        $path = trim((string) $path, "/ \t\n\r\0\x0B");
        if ($path === '') return 0;

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

// Las dos solo leen la sesion: se suelta ya para no formar en fila las demas
// peticiones que la pagina lanza al mismo tiempo.
session_write_close();

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
