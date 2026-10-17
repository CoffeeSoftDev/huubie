<?php
require_once __DIR__ . '/../../conf/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-modulos.php';

// Controlador del dashboard de Módulos (navegador de tarjetas).
class ctrl extends mdl {

    // Módulos como cards de primer nivel, con su conteo de submódulos.
    // Solo se incluyen los módulos en los que el rol del usuario (en su sucursal
    // activa) tiene alguna acción en alguna sección; el Super Admin los ve todos
    // porque su acceso es total. Sin sesión/sucursal -> sin módulos.
    function init() {
        $userId   = (int) ($_SESSION['user_id'] ?? $_SESSION['IDU'] ?? 0);
        $branchId = (int) ($_SESSION['branch_id'] ?? 0);

        $ls           = [];
        $isSuperAdmin = false;
        if ($userId > 0 && $branchId > 0) {
            $isSuperAdmin = $this->qIsSuperAdmin([$userId]);
            $ls = $isSuperAdmin
                ? $this->qModules()
                : $this->qAccessibleModules([$userId, $branchId]);
        }

        $modules = [];
        foreach ($ls as $m) {
            $count = $this->qSubmoduleCount([(int) $m['id']]);
            $modules[] = [
                'id'          => (int) $m['id'],
                'name'        => $m['name'],
                'icon'        => $m['icon'] ?: 'layout-grid',
                'description' => $m['description'] ?: '',
                'route'       => $this->landingRoute($m, $isSuperAdmin, $userId, $branchId),
                'submodules'  => $count,
            ];
        }

        return [
            'status'  => 200,
            'user'    => $_SESSION['user'] ?? 'Usuario',
            'modules' => $modules,
        ];
    }

    // Abrir un módulo lleva a su primera sección (por orden) que el rol puede
    // abrir: en Inventario, el Dashboard. Solo cuentan las páginas del propio
    // módulo (su ruta cuelga de modules.route); sin ninguna, la ruta del módulo.
    private function landingRoute($module, $isSuperAdmin, $userId, $branchId) {
        $base = trim((string) $module['route'], '/');
        $ls   = $this->qLandingSections([(int) $module['id'], $isSuperAdmin ? 1 : 0, $userId, $branchId]);

        foreach ($ls as $s) {
            $route = trim((string) $s['route'], '/');
            if ($base !== '' && strpos($route . '/', $base . '/') === 0) return $s['route'];
        }

        return $module['route'] ?: '';
    }

    // Submódulos de un módulo (cards de segundo nivel) + datos del módulo padre.
    function submodules() {
        $moduleId = (int) ($_POST['module_id'] ?? 0);
        if ($moduleId <= 0) {
            return ['status' => 400, 'message' => 'Módulo no válido'];
        }

        $module = $this->qModule([$moduleId]);
        if (!$module) {
            return ['status' => 404, 'message' => 'Módulo no encontrado'];
        }

        $ls = $this->qSubmodulesByModule([$moduleId]);
        $submodules = [];
        foreach ($ls as $sm) {
            $submodules[] = [
                'id'          => (int) $sm['id'],
                'name'        => $sm['name'],
                'icon'        => $sm['icon'] ?: 'folder-tree',
                'description' => $sm['description'] ?: '',
                'route'       => $sm['route'] ?: '',
            ];
        }

        return [
            'status' => 200,
            'module' => [
                'id'   => (int) $module['id'],
                'name' => $module['name'],
                'icon' => $module['icon'] ?: 'layout-grid',
            ],
            'submodules' => $submodules,
        ];
    }
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
