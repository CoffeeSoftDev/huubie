<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-modulos.php';

// Controlador del dashboard de Módulos (navegador de tarjetas).
class ctrl extends mdl {

    // Módulos como cards de primer nivel, con su conteo de submódulos.
    // Solo se incluyen los módulos en los que el rol del usuario (en su sucursal
    // activa) tiene permiso a alguna sección. Sin sesión/sucursal -> sin módulos.
    function init() {
        $userId   = (int) ($_SESSION['user_id'] ?? $_SESSION['IDU'] ?? 0);
        $branchId = (int) ($_SESSION['branch_id'] ?? 0);

        $ls = ($userId > 0 && $branchId > 0)
            ? $this->qAccessibleModules([$userId, $branchId])
            : [];

        $modules = [];
        foreach ($ls as $m) {
            $count = $this->qSubmoduleCount([(int) $m['id']]);
            $modules[] = [
                'id'          => (int) $m['id'],
                'name'        => $m['name'],
                'icon'        => $m['icon'] ?: 'layout-grid',
                'description' => $m['description'] ?: '',
                'route'       => $m['route'] ?: '',
                'submodules'  => $count,
            ];
        }

        return [
            'status'  => 200,
            'user'    => $_SESSION['user'] ?? 'Usuario',
            'modules' => $modules,
        ];
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
