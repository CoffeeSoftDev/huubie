<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-developer.php';

// Seccion Accesos: modulos, submodulos, secciones, tipos de permiso, roles,
// permisos, usuarios y sucursales.
class ctrl extends core {

    function init() {
        return [
            'status'           => 200,
            'statusFilter'     => [
                ['id' => '1', 'valor' => 'Activos'],
                ['id' => '0', 'valor' => 'Inactivos']
            ],
            // users.status es enum de texto; el filtro manda 1/0 y el ctrl lo traduce.
            'userStatusFilter' => [
                ['id' => '1', 'valor' => 'Activos'],
                ['id' => '0', 'valor' => 'Inactivos']
            ],
            'companies'        => $this->qCompaniesForSelect(),
            'modules'          => $this->qModulesForSelect(),
            'submodules'       => $this->qSubmodulesForSelect(),
            'sections'         => $this->qSectionsForSelect(),
            'roles'            => $this->qRolesForSelect(),
            'typePermissions'  => $this->qTypePermissionsForSelect(),
            'branches'         => $this->qBranchesForSelect([$this->companyId()]),
            // Rutas navegables reales detectadas en disco, para que Modulos,
            // Submodulos y Secciones elijan una ruta que si existe.
            'routes'           => $this->scanRoutes()
        ];
    }

    // Escanea pro/ (hasta 2 niveles) y devuelve las rutas navegables: las carpetas
    // que tienen index.php y, dentro de cada una, los archivos .php sueltos (ej.
    // app/developer/accesos.php). Formato {id: ruta, valor: etiqueta}.
    private function scanRoutes() {
        // El controlador vive en pro/app/developer/ctrl/ -> la raíz de pro es ../../../
        $base = realpath(__DIR__ . '/../../../');
        if ($base === false) return [];

        $skip   = ['auth', 'core', 'assets', 'sessions', 'migrations', 'uploads', 'vendor', 'node_modules', '.git'];
        $routes = [];

        $top = @scandir($base);
        if ($top === false) return [];

        foreach ($top as $dir) {
            if ($dir === '.' || $dir === '..' || in_array($dir, $skip, true)) continue;
            $path = $base . DIRECTORY_SEPARATOR . $dir;
            if (!is_dir($path)) continue;

            // Nivel 1: carpeta con index.php + sus archivos .php directos.
            if (is_file($path . DIRECTORY_SEPARATOR . 'index.php')) {
                $routes[] = ['id' => $dir, 'valor' => $dir];
                $this->collectPhpFiles($path, $dir, $routes);
            }

            // Nivel 2: subcarpetas con index.php (ej. operacion/almacen, admin/usuarios).
            $sub = @scandir($path);
            if ($sub === false) continue;
            foreach ($sub as $child) {
                if ($child === '.' || $child === '..') continue;
                $childPath = $path . DIRECTORY_SEPARATOR . $child;
                if (is_dir($childPath) && is_file($childPath . DIRECTORY_SEPARATOR . 'index.php')) {
                    $route = $dir . '/' . $child;
                    $routes[] = ['id' => $route, 'valor' => $route];
                    // Archivos .php directos de la subcarpeta (ej. operacion/almacen/salidas.php).
                    $this->collectPhpFiles($childPath, $route, $routes);
                }
            }
        }

        // Orden alfabético por ruta para una lista predecible.
        usort($routes, function ($a, $b) { return strcmp($a['id'], $b['id']); });
        return $routes;
    }

    // Agrega a $routes los archivos .php que viven directamente en $dirPath (sin entrar a
    // subcarpetas), omitiendo index.php porque la carpeta ya lo representa como ruta.
    private function collectPhpFiles($dirPath, $prefix, &$routes) {
        $files = @scandir($dirPath);
        if ($files === false) return;
        foreach ($files as $file) {
            if ($file === '.' || $file === '..' || $file === 'index.php') continue;
            if (strtolower(substr($file, -4)) !== '.php') continue;
            if (!is_file($dirPath . DIRECTORY_SEPARATOR . $file)) continue;
            $route = $prefix . '/' . $file;
            $routes[] = ['id' => $route, 'valor' => $route];
        }
    }

    /* ===== Módulos (modules) ===== */

    function lsModules() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $ls = $this->qModules([$active]);

        $row = [];
        foreach ($ls as $m) {
            $row[] = [
                'id'      => $m['id'],
                'Nombre'  => htmlspecialchars($m['name'] ?? ''),
                'Código'  => $m['code'] ?: '-',
                'Ruta'    => $m['route'] ?: '-',
                'Orden'   => $m['orden'] ?? 0,
                'Estado'  => renderActive($m['is_active']),
                'a'       => $this->toggleActions('modules', 'editModule', 'toggleModule', $m['id'], $m['is_active'])
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getModule() {
        $data = $this->qModule([(int) $_POST['id']]);
        return ['status' => $data ? 200 : 404, 'message' => $data ? 'OK' : 'Módulo no encontrado', 'data' => $data];
    }

    function addModule() {
        $name = trim($_POST['name'] ?? '');
        if ($name === '') return ['status' => 400, 'message' => 'El nombre del módulo es obligatorio'];

        $ok = $this->qInsertModule([
            $name,
            trim($_POST['code'] ?? '') ?: null,
            trim($_POST['icon'] ?? '') ?: null,
            trim($_POST['description'] ?? '') ?: null,
            trim($_POST['route'] ?? '') ?: null,
            $this->qModulesMaxOrden() + 1
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Módulo creado correctamente' : 'No se pudo crear el módulo'];
    }

    function editModule() {
        $id     = (int) $_POST['id'];
        $name   = trim($_POST['name'] ?? '');
        if ($name === '') return ['status' => 400, 'message' => 'El nombre del módulo es obligatorio'];
        $module = $this->qModule([$id]);
        if (!$module) return ['status' => 404, 'message' => 'Módulo no encontrado'];

        $ok = $this->qUpdateModule([
            $name,
            trim($_POST['code'] ?? '') ?: null,
            trim($_POST['icon'] ?? '') ?: null,
            trim($_POST['description'] ?? '') ?: null,
            trim($_POST['route'] ?? '') ?: null,
            (int) $module['orden'],
            $id
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Módulo actualizado correctamente' : 'No se pudo actualizar el módulo'];
    }

    function toggleModule() {
        $id = (int) $_POST['id'];
        if (!$this->qModule([$id])) return ['status' => 404, 'message' => 'Módulo no encontrado'];
        $ok = $this->qSetModuleActive([(int) $_POST['active'], $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? ((int) $_POST['active'] ? 'Módulo activado' : 'Módulo desactivado') : 'No se pudo actualizar el estado'];
    }

    /* ===== Submódulos (submodules) ===== */

    function lsSubmodules() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $ls = $this->qSubmodules([$active]);

        $row = [];
        foreach ($ls as $sm) {
            $row[] = [
                'id'      => $sm['id'],
                'Nombre'  => htmlspecialchars($sm['name'] ?? ''),
                'Módulo'  => $sm['module_name'] ? htmlspecialchars($sm['module_name']) : '<span class="italic text-gray-400">Sin módulo</span>',
                'Código'  => $sm['code'] ?: '-',
                'Ruta'    => $sm['route'] ?: '-',
                'Orden'   => $sm['orden'] ?? 0,
                'Estado'  => renderActive($sm['is_active']),
                'a'       => $this->toggleActions('submodules', 'editSubmodule', 'toggleSubmodule', $sm['id'], $sm['is_active'])
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getSubmodule() {
        $data = $this->qSubmodule([(int) $_POST['id']]);
        if ($data && $data['module_id'] !== null) $data['module_id'] = (string) $data['module_id'];
        return ['status' => $data ? 200 : 404, 'message' => $data ? 'OK' : 'Submódulo no encontrado', 'data' => $data];
    }

    function addSubmodule() {
        $name     = trim($_POST['name'] ?? '');
        $moduleId = (int) ($_POST['module_id'] ?? 0);
        if ($name === '') return ['status' => 400, 'message' => 'El nombre del submódulo es obligatorio'];
        if ($moduleId <= 0) return ['status' => 400, 'message' => 'Debes seleccionar un módulo'];

        $ok = $this->qInsertSubmodule([
            $name,
            trim($_POST['code'] ?? '') ?: null,
            trim($_POST['icon'] ?? '') ?: null,
            trim($_POST['description'] ?? '') ?: null,
            trim($_POST['route'] ?? '') ?: null,
            $this->intOrNull($_POST['orden'] ?? '') ?? 0,
            $moduleId
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Submódulo creado correctamente' : 'No se pudo crear el submódulo'];
    }

    function editSubmodule() {
        $id       = (int) $_POST['id'];
        $name     = trim($_POST['name'] ?? '');
        $moduleId = (int) ($_POST['module_id'] ?? 0);
        if ($name === '') return ['status' => 400, 'message' => 'El nombre del submódulo es obligatorio'];
        if ($moduleId <= 0) return ['status' => 400, 'message' => 'Debes seleccionar un módulo'];
        if (!$this->qSubmodule([$id])) return ['status' => 404, 'message' => 'Submódulo no encontrado'];

        $ok = $this->qUpdateSubmodule([
            $name,
            trim($_POST['code'] ?? '') ?: null,
            trim($_POST['icon'] ?? '') ?: null,
            trim($_POST['description'] ?? '') ?: null,
            trim($_POST['route'] ?? '') ?: null,
            $this->intOrNull($_POST['orden'] ?? '') ?? 0,
            $moduleId,
            $id
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Submódulo actualizado correctamente' : 'No se pudo actualizar el submódulo'];
    }

    // Renombrado en línea desde el acordeón de la pestaña Secciones: solo cambia el nombre.
    function renameSubmodule() {
        $id   = (int) $_POST['id'];
        $name = trim($_POST['name']);
        if ($name === '') return ['status' => 400, 'message' => 'El nombre del submódulo es obligatorio'];
        if (!$this->qSubmodule([$id])) return ['status' => 404, 'message' => 'Submódulo no encontrado'];

        $ok = $this->qRenameSubmodule([$name, $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Submódulo actualizado correctamente' : 'No se pudo actualizar el submódulo'];
    }

    function toggleSubmodule() {
        $id = (int) $_POST['id'];
        if (!$this->qSubmodule([$id])) return ['status' => 404, 'message' => 'Submódulo no encontrado'];
        $ok = $this->qSetSubmoduleActive([(int) $_POST['active'], $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? ((int) $_POST['active'] ? 'Submódulo activado' : 'Submódulo desactivado') : 'No se pudo actualizar el estado'];
    }

    /* ===== Secciones (sections) ===== */

    function lsSections() {
        // 'all' = Estado Todos: activas e inactivas.
        $active = isset($_POST['active']) ? $_POST['active'] : '1';
        $ls = $active === 'all' ? $this->qSections([]) : $this->qSections([(int) $active]);

        $row = [];
        foreach ($ls as $s) {
            $row[] = [
                'id'         => $s['id'],
                'Nombre'     => htmlspecialchars($s['name'] ?? ''),
                'Módulo'     => $s['module_name'] ? htmlspecialchars($s['module_name']) : '-',
                'Submódulo'  => $s['submodule_name'] ? htmlspecialchars($s['submodule_name']) : '-',
                'Ruta'       => $s['route'] ?: '-',
                'Orden'      => $s['orden'] ?? 0,
                'Estado'     => renderActive($s['is_active']),
                'a'          => $this->toggleActions('sections', 'editSection', 'toggleSection', $s['id'], $s['is_active'])
            ];
        }

        return [
            'status'     => 200,
            'row'        => $row,
            'ls'         => $ls,
            'modules'    => $this->qModulesCatalog(),
            'submodules' => $this->qSubmodulesCatalog()
        ];
    }

    function getSection() {
        $data = $this->qSection([(int) $_POST['id']]);
        if ($data) {
            $data['module_id']    = $data['module_id'] !== null ? (string) $data['module_id'] : '';
            $data['submodule_id'] = $data['submodule_id'] !== null ? (string) $data['submodule_id'] : '';
        }
        return ['status' => $data ? 200 : 404, 'message' => $data ? 'OK' : 'Sección no encontrada', 'data' => $data];
    }

    function addSection() {
        $name     = trim($_POST['name'] ?? '');
        $moduleId = (int) ($_POST['module_id'] ?? 0);
        if ($name === '') return ['status' => 400, 'message' => 'El nombre de la sección es obligatorio'];
        if ($moduleId <= 0) return ['status' => 400, 'message' => 'Debes seleccionar un módulo'];

        $ok = $this->qInsertSection([
            $name,
            trim($_POST['code'] ?? '') ?: null,
            trim($_POST['icon'] ?? '') ?: null,
            trim($_POST['route'] ?? '') ?: null,
            $this->intOrNull($_POST['orden'] ?? '') ?? 0,
            $moduleId,
            $this->selectOrNull($_POST['submodule_id'] ?? '')
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Sección creada correctamente' : 'No se pudo crear la sección'];
    }

    function editSection() {
        $id       = (int) $_POST['id'];
        $name     = trim($_POST['name'] ?? '');
        $moduleId = (int) ($_POST['module_id'] ?? 0);
        if ($name === '') return ['status' => 400, 'message' => 'El nombre de la sección es obligatorio'];
        if ($moduleId <= 0) return ['status' => 400, 'message' => 'Debes seleccionar un módulo'];
        $section = $this->qSection([$id]);
        if (!$section) return ['status' => 404, 'message' => 'Sección no encontrada'];

        // El código es la llave de los permisos (Permissions::page/can): renombrar no lo cambia.
        $ok = $this->qUpdateSection([
            $name,
            $section['code'],
            trim($_POST['icon'] ?? '') ?: null,
            trim($_POST['route'] ?? '') ?: null,
            $this->intOrNull($_POST['orden'] ?? '') ?? 0,
            $moduleId,
            $this->selectOrNull($_POST['submodule_id'] ?? ''),
            $id
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Sección actualizada correctamente' : 'No se pudo actualizar la sección'];
    }

    function toggleSection() {
        $id = (int) $_POST['id'];
        if (!$this->qSection([$id])) return ['status' => 404, 'message' => 'Sección no encontrada'];
        $ok = $this->qSetSectionActive([(int) $_POST['active'], $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? ((int) $_POST['active'] ? 'Sección activada' : 'Sección desactivada') : 'No se pudo actualizar el estado'];
    }

    // Solo se elimina una sección desactivada. Borra el acceso (sección + permisos);
    // la carpeta y los archivos de la ruta en disco no se tocan.
    function deleteSection() {
        $id = (int) $_POST['id'];
        $found = $this->qSection([$id]);
        if (!$found) return ['status' => 404, 'message' => 'Sección no encontrada'];
        if ((int) $found['is_active'] === 1) return ['status' => 400, 'message' => 'Solo se puede eliminar una sección desactivada'];

        $ok = $this->qDeleteSection([$id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Sección eliminada' : 'No se pudo eliminar la sección'];
    }

    // Renombrado en línea (doble clic en el nombre): solo cambia el nombre.
    function renameSection() {
        $id   = (int) $_POST['id'];
        $name = trim($_POST['name']);
        if ($name === '') return ['status' => 400, 'message' => 'El nombre de la sección es obligatorio'];
        if (!$this->qSection([$id])) return ['status' => 404, 'message' => 'Sección no encontrada'];

        $ok = $this->qRenameSection([$name, $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Sección actualizada correctamente' : 'No se pudo actualizar la sección'];
    }

    // Reorden por arrastre: llegan solo las secciones cuyo orden cambió, [{id, orden}, ...].
    function sortSections() {
        $items = json_decode($_POST['items'], true);

        $pairs = [];
        foreach ((is_array($items) ? $items : []) as $item) {
            $id    = (int) ($item['id'] ?? 0);
            $orden = (int) ($item['orden'] ?? 0);
            if ($id > 0 && $orden >= 0) $pairs[] = [$id, $orden];
        }
        if (!$pairs) return ['status' => 400, 'message' => 'No hay secciones que reordenar'];

        $ok = $this->qSortSections($pairs);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Orden actualizado' : 'No se pudo actualizar el orden'];
    }

    /* ===== Tipos de permiso (type_permissions) ===== */

    function lsTypePermissions() {
        $active = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $ls = $this->qTypePermissions([$active]);

        $row = [];
        foreach ($ls as $t) {
            $isActive = (int) $t['is_active'];
            // El toggle deja de ser el ultimo boton cuando Eliminar lo sigue.
            $a = $this->toggleActions('typePermissions', 'editTypePermission', 'toggleTypePermission', $t['id'], $isActive, $isActive === 1);
            if ($isActive === 0) {
                $a[] = [
                    'class'   => $this->actionBtnClass('danger', true),
                    'html'    => '<i class="icon-trash"></i>',
                    'onclick' => 'typePermissions.deleteTypePermission(' . $t['id'] . ')'
                ];
            }
            $row[] = [
                'id'     => $t['id'],
                'Nombre' => htmlspecialchars($t['name'] ?? ''),
                'Código' => $t['code'] ?: '-',
                'Estado' => renderActive($t['is_active']),
                'a'      => $a
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getTypePermission() {
        $data = $this->qTypePermission([(int) $_POST['id']]);
        return ['status' => $data ? 200 : 404, 'message' => $data ? 'OK' : 'Tipo de permiso no encontrado', 'data' => $data];
    }

    // El código sale del nombre y ya no cambia: los módulos revisan las acciones
    // por código (conf/_Permissions.php), así renombrar el tipo no quita permisos.
    function addTypePermission() {
        $name = trim($_POST['name'] ?? '');
        $code = $this->slug($name);
        if ($name === '' || $code === '') return ['status' => 400, 'message' => 'El nombre es obligatorio'];
        if ($this->qTypeCodeExists([$code])) return ['status' => 409, 'message' => "Ya existe un tipo de permiso con el código «{$code}»"];

        $ok = $this->qInsertTypePermission([$name, $code]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Tipo de permiso creado' : 'No se pudo crear el tipo de permiso'];
    }

    // 'Subir comprobante' -> 'subir-comprobante'.
    private function slug($text) {
        $text = strtr(mb_strtolower(trim((string) $text), 'UTF-8'), ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
        return trim(preg_replace('/[^a-z0-9]+/', '-', $text), '-');
    }

    function editTypePermission() {
        $id   = (int) $_POST['id'];
        $name = trim($_POST['name'] ?? '');
        if ($name === '') return ['status' => 400, 'message' => 'El nombre es obligatorio'];
        if (!$this->qTypePermission([$id])) return ['status' => 404, 'message' => 'Tipo de permiso no encontrado'];
        $ok = $this->qUpdateTypePermission([$name, $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Tipo de permiso actualizado' : 'No se pudo actualizar'];
    }

    function toggleTypePermission() {
        $id = (int) $_POST['id'];
        if (!$this->qTypePermission([$id])) return ['status' => 404, 'message' => 'Tipo de permiso no encontrado'];
        $ok = $this->qSetTypePermissionActive([(int) $_POST['active'], $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? ((int) $_POST['active'] ? 'Activado' : 'Desactivado') : 'No se pudo actualizar el estado'];
    }

    function deleteTypePermission() {
        $id = (int) $_POST['id'];
        $found = $this->qTypePermission([$id]);
        if (!$found) return ['status' => 404, 'message' => 'Tipo de permiso no encontrado'];
        if ((int) $found['is_active'] === 1) return ['status' => 400, 'message' => 'Solo se puede eliminar un tipo de permiso desactivado'];

        $enUso = $this->qCountPermissionsByType([$id]);
        if ($enUso > 0) return ['status' => 400, 'message' => 'No se puede eliminar: hay permisos que usan este tipo'];

        $ok = $this->qDeleteTypePermission([$id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Tipo de permiso eliminado' : 'No se pudo eliminar el tipo de permiso'];
    }

    /* ===== Roles (roles) ===== */

    function lsRoles() {
        // Empresa: all = todos, system = solo los del sistema, un id = los de esa empresa.
        $active  = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $company = (string) ($_POST['company_id'] ?? 'all');

        $ls = ctype_digit($company)
            ? $this->qRoles([$active, (int) $company], 'company')
            : $this->qRoles([$active], $company === 'system' ? 'system' : 'all');

        $row = [];
        foreach ($ls as $r) {
            // Los roles del sistema no se desactivan: si editar queda solo en la
            // fila, pasa a ser el ultimo boton (sin me-1).
            $isSystem = (int) $r['is_system'] === 1;
            $a = [];
            $a[] = [
                'class'   => $this->actionBtnClass('neutral', $isSystem),
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'roles.editRole(' . $r['id'] . ')'
            ];
            if (!$isSystem) {
                if ($r['is_active'] == 1) {
                    $a[] = [
                        'class'   => $this->actionBtnClass('danger', true),
                        'html'    => '<i class="icon-toggle-on"></i>',
                        'onclick' => 'roles.toggleRole(' . $r['id'] . ', 0)'
                    ];
                } else {
                    $a[] = [
                        'class'   => $this->actionBtnClass('neutral', true),
                        'html'    => '<i class="icon-toggle-off"></i>',
                        'onclick' => 'roles.toggleRole(' . $r['id'] . ', 1)'
                    ];
                }
            }

            $system = (int) $r['is_system'] === 1
                ? '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-sky-50 text-sky-700 ">Sistema</span>'
                : '<span class="px-2 py-1 rounded-md text-sm font-semibold  bg-slate-50 text-slate-600 ">De empresa</span>';

            $row[] = [
                'id'       => $r['id'],
                'Código'   => $r['code'] ?: '-',
                'Rol'      => htmlspecialchars($r['name'] ?? ''),
                'Empresa'  => $this->roleCompanyLabel($r),
                'Tipo'     => $system,
                'Permisos' => $this->roleAccessLabel($r),
                'Estado'   => renderActive($r['is_active']),
                'a'        => $a
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getRole() {
        $data = $this->qRole([(int) $_POST['id']]);
        if ($data && (int) $data['is_system'] === 1) $data['company_name'] = 'Todas las empresas (rol del sistema)';
        return ['status' => $data ? 200 : 404, 'message' => $data ? 'OK' : 'Rol no encontrado', 'data' => $data];
    }

    // Acciones por sección para el modal del rol. id = 0 es un rol nuevo: llegan
    // todas sin marcar. El Super Admin no se edita porque su acceso es total.
    function getRolePermissions() {
        $id   = (int) ($_POST['id'] ?? 0);
        $role = $id > 0 ? $this->qRole([$id]) : null;
        if ($id > 0 && !$role) return ['status' => 404, 'message' => 'Rol no encontrado'];

        if ($role && $role['code'] === 'root') {
            return ['status' => 200, 'fullAccess' => true, 'modules' => []];
        }

        return [
            'status'     => 200,
            'fullAccess' => false,
            'modules'    => $this->permissionTree($this->qRolePermissions([$id]))
        ];
    }

    function addRole() {
        $name      = trim($_POST['name'] ?? '');
        $code      = trim($_POST['code'] ?? '') ?: null;
        $companyId = (int) ($_POST['company_id'] ?? 0);
        if ($name === '') return ['status' => 400, 'message' => 'El nombre del rol es obligatorio'];
        if ($companyId <= 0 || !$this->qCompany([$companyId])) return ['status' => 400, 'message' => 'Elige la empresa del rol'];

        $error = $this->roleError($code, $name, $companyId, 0);
        if ($error) return ['status' => 400, 'message' => $error];

        return $this->transaction(function () use ($code, $name, $companyId) {
            $this->qInsertRole([$code, $name, $companyId]);

            $newId = $this->qLastInsertId();
            if (!$newId) {
                throw new \Exception('No se pudo obtener el id del rol creado');
            }

            $this->syncRolePermissions($newId);

            return ['status' => 200, 'message' => 'Rol creado correctamente'];
        });
    }

    function editRole() {
        $id   = (int) $_POST['id'];
        $name = trim($_POST['name'] ?? '');
        $code = trim($_POST['code'] ?? '') ?: null;
        if ($name === '') return ['status' => 400, 'message' => 'El nombre del rol es obligatorio'];

        $role = $this->qRole([$id]);
        if (!$role) return ['status' => 404, 'message' => 'Rol no encontrado'];

        // El código del Super Admin es el que le da el acceso total: no se cambia.
        if ((int) $role['is_system'] === 1) {
            $code = $role['code'];
        } else {
            $error = $this->roleError($code, $name, (int) $role['company_id'], $id);
            if ($error) return ['status' => 400, 'message' => $error];
        }

        return $this->transaction(function () use ($id, $code, $name, $role) {
            $this->qUpdateRole([$code, $name, $id]);

            if ($role['code'] !== 'root') $this->syncRolePermissions($id);

            return ['status' => 200, 'message' => 'Rol actualizado correctamente'];
        });
    }

    function toggleRole() {
        $id   = (int) $_POST['id'];
        $role = $this->qRole([$id]);
        if (!$role) return ['status' => 404, 'message' => 'Rol no encontrado'];
        if ((int) $role['is_system'] === 1) {
            return ['status' => 400, 'message' => 'Los roles del sistema no se pueden desactivar'];
        }
        $ok = $this->qSetRoleActive([(int) $_POST['active'], $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? ((int) $_POST['active'] ? 'Rol activado' : 'Rol desactivado') : 'No se pudo actualizar el estado'];
    }

    // Rol de una empresa (no del sistema): el código no puede ser uno reservado y
    // el nombre no se repite dentro de la misma empresa.
    private function roleError($code, $name, $companyId, $id) {
        if ($code !== null && in_array(strtolower($code), $this->reservedRoleCodes, true)) {
            return 'Ese código está reservado para un rol del sistema';
        }
        if ($this->qRoleNameExists([$name, $companyId, $id])) return 'Esa empresa ya tiene un rol con ese nombre';
        return null;
    }

    private function roleCompanyLabel($role) {
        if ((int) $role['is_system'] === 1) return '<span class="text-gray-400">Todas</span>';
        return $role['company_name'] ? htmlspecialchars($role['company_name']) : '-';
    }

    // Columna Permisos de la tabla de roles. El Super Admin tiene acceso total
    // por código y no lleva filas en permissions_roles.
    private function roleAccessLabel($role) {
        if ($role['code'] === 'root') {
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-gray-900 text-white">Acceso total</span>';
        }

        $actions  = (int) $role['actions'];
        $sections = (int) $role['sections'];
        if ($actions === 0) return '<span class="italic text-gray-400">Sin permisos</span>';

        return $actions . ($actions === 1 ? ' acción' : ' acciones')
            . ' · ' . $sections . ($sections === 1 ? ' sección' : ' secciones');
    }

    // Filas de qRolePermissions -> módulo > sección > acciones, en el orden en que llegan.
    private function permissionTree($rows) {
        $modules = [];
        foreach ($rows as $r) {
            $mid = (int) $r['module_id'];
            $sid = (int) $r['section_id'];

            if (!isset($modules[$mid])) {
                $modules[$mid] = [
                    'id'       => $mid,
                    'name'     => $r['module_name'],
                    'icon'     => $r['module_icon'] ?: 'layout-grid',
                    'sections' => []
                ];
            }

            if (!isset($modules[$mid]['sections'][$sid])) {
                $modules[$mid]['sections'][$sid] = [
                    'id'      => $sid,
                    'name'    => $r['section_name'],
                    'icon'    => $r['section_icon'] ?: 'square',
                    'actions' => []
                ];
            }

            $modules[$mid]['sections'][$sid]['actions'][] = [
                'id'      => (int) $r['permission_id'],
                'name'    => $r['type_name'],
                'granted' => (int) $r['granted'] === 1
            ];
        }

        // Listas y no objetos en el JSON: el front las recorre en orden.
        foreach ($modules as &$m) $m['sections'] = array_values($m['sections']);
        unset($m);

        return array_values($modules);
    }

    /*  Deja en permissions_roles exactamente las acciones que llegan en
        `permissions` (JSON con ids), pero solo entre las vigentes: lo que esté
        apagado en el catálogo no sale en el modal y se conserva tal cual, para
        que el rol lo recupere si se vuelve a encender. Sin `permissions` en el
        POST no se toca nada: una pantalla vieja que solo edita el nombre no le
        borra los permisos al rol. */
    private function syncRolePermissions($roleId) {
        if (!isset($_POST['permissions'])) return;

        $rows    = $this->qRolePermissions([$roleId]);
        $visible = array_map('intval', array_column($rows, 'permission_id'));
        $granted = [];
        foreach ($rows as $r) {
            if ((int) $r['granted'] === 1) $granted[] = (int) $r['permission_id'];
        }

        $wanted = array_values(array_intersect($this->postedPermissionIds(), $visible));

        foreach (array_diff($granted, $wanted) as $permissionId) {
            $this->qDeleteRolePermission([$roleId, $permissionId]);
        }
        foreach (array_diff($wanted, $granted) as $permissionId) {
            $this->qInsertRolePermission([$roleId, $permissionId]);
        }
    }

    private function postedPermissionIds() {
        $decoded = json_decode((string) $_POST['permissions'], true);
        if (!is_array($decoded)) return [];

        $ids = [];
        foreach ($decoded as $v) {
            $id = (int) $v;
            if ($id > 0) $ids[] = $id;
        }
        return array_values(array_unique($ids));
    }

    /* ===== Permisos: acciones de cada sección (permissions) ===== */

    // Datos de la pestaña Permisos: las secciones encendidas (filas), los tipos
    // de permiso activos (columnas) y las acciones que ya tiene cada sección.
    function lsPermissions() {
        $sections = $this->qCatalogSections();

        $modules = [];
        foreach ($sections as $s) {
            $mid = (int) $s['module_id'];
            if (isset($modules[$mid])) continue;
            $modules[$mid] = [
                'id'   => $mid,
                'name' => $s['module_name'],
                'icon' => $s['module_icon'] ?: 'layout-grid'
            ];
        }

        return [
            'status'   => 200,
            'modules'  => array_values($modules),
            'sections' => array_map(function ($s) {
                return [
                    'id'        => (int) $s['id'],
                    'name'      => $s['name'],
                    'icon'      => $s['icon'] ?: 'square',
                    'route'     => $s['route'] ?: '',
                    'module_id' => (int) $s['module_id']
                ];
            }, $sections),
            'types' => array_map(function ($t) {
                return ['id' => (int) $t['id'], 'name' => $t['name']];
            }, $this->qTypePermissions([1])),
            'permissions' => array_map(function ($p) {
                return $this->permissionRow($p);
            }, $this->qPermissionsCatalog())
        ];
    }

    // Enciende o apaga una acción en una sección. Apagarla no le quita nada a los
    // roles: deja de verse y de contar, y al encenderla cada rol la recupera.
    function togglePermission() {
        $secId  = (int) ($_POST['section_id'] ?? 0);
        $typeId = (int) ($_POST['type_permission_id'] ?? 0);
        $active = (int) ($_POST['active'] ?? 0) === 1 ? 1 : 0;

        if (!$this->qSection([$secId]))         return ['status' => 404, 'message' => 'Sección no encontrada'];
        if (!$this->qTypePermission([$typeId])) return ['status' => 404, 'message' => 'Tipo de permiso no encontrado'];

        $found = $this->qFindPermission([$secId, $typeId]);
        if ($found) {
            $ok = $this->qSetPermissionActive([$active, (int) $found['id']]);
        } elseif ($active === 1) {
            $ok = $this->qInsertPermission([$secId, $typeId]);
        } else {
            $ok = true; // No existe y se pide quitar: nada que hacer.
        }

        $current = $this->qFindPermission([$secId, $typeId]);

        return [
            'status'     => $ok ? 200 : 500,
            'message'    => $ok ? ($active ? 'Acción agregada a la sección' : 'Acción quitada de la sección') : 'No se pudo actualizar la acción',
            'permission' => $current ? $this->permissionRow($current) : null
        ];
    }

    private function permissionRow($p) {
        return [
            'id'                 => (int) $p['id'],
            'section_id'         => (int) $p['section_id'],
            'type_permission_id' => (int) $p['type_permission_id'],
            'is_active'          => (int) $p['is_active'],
            'roles'              => (int) $p['roles']
        ];
    }

    /* ===== Usuarios (mismo CRUD que admin/accesos, mas el rol) ===== */

    function lsUsers() {
        $status = (isset($_POST['active']) && (int) $_POST['active'] === 0) ? 'inactive' : 'active';
        $ls = $this->qUsersFull([$this->companyId(), $status]);

        $row = [];
        foreach ($ls as $u) {
            $a = [];
            $a[] = [
                'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition me-1',
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'users.editUser(' . $u['id'] . ')'
            ];
            if ($u['status'] === 'active') {
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded-md border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 transition',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'users.toggleUser(' . $u['id'] . ', 0)'
                ];
            } else {
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'users.toggleUser(' . $u['id'] . ', 1)'
                ];
            }

            // renderAvatar() ya devuelve un flex con iniciales + nombre; el badge
            // de dueño se envuelve aparte para que quede a un lado y no debajo.
            $fullName = trim(($u['name'] ?? '') . ' ' . ($u['last_name'] ?? ''));
            $cell     = renderAvatar($fullName);
            if ((int) $u['is_owner'] === 1) {
                $cell = '<div class="flex items-center gap-2">'
                      . $cell . badge('Dueño', ACCENT_TEXT, 100, ACCENT_BG)
                      . '</div>';
            }

            $branches = $u['branch_names']
                ? implode(' ', array_map(function ($n) {
                    return badge(trim($n), ACCENT_TEXT, 100, ACCENT_BG);
                  }, explode(',', $u['branch_names'])))
                : '<span class="italic text-gray-400 text-sm">Sin asignar</span>';

            $roles = $u['role_names']
                ? implode(' ', array_map(function ($n) {
                    return badge(trim($n), '#1D4ED8', 100, '#DBEAFE');
                  }, explode(',', $u['role_names'])))
                : badge('Sin rol', '#92400E', 100, '#FEF3C7');

            $row[] = [
                'id'          => $u['id'],
                'Usuario'     => $cell,
                'Correo'      => htmlspecialchars($u['email'] ?? '—'),
                'Sucursales'  => $branches,
                'Rol'         => $roles,
                'Estado'      => renderUserStatus($u['status']),
                'a'           => $a
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getUser() {
        $id   = (int) ($_POST['id'] ?? 0);
        $data = $this->qUserFull([$id, $this->companyId()]);
        if (!$data) {
            return ['status' => 404, 'message' => 'Usuario no encontrado'];
        }

        $data['branch_ids'] = $this->qUserBranchIds([$id]);
        $data['role_id']    = $this->qUserMainRole([$id]);
        $data['photo_url']  = $this->photoUrl($data['photo'] ?? '');

        return ['status' => 200, 'message' => 'OK', 'data' => $data];
    }

    /* ===== Foto del colaborador =====
       Convención compartida con el login (acceso/ctrl/ctrl-access.php) y con
       admin/accesos: `users.photo` guarda SOLO el nombre del archivo dentro de
       pro/uploads/users/. */

    private function photoDir() {
        return __DIR__ . '/../../../uploads/users/';
    }

    // ¿El formulario trae algo que hacer con la foto? Sin esto, guardar el
    // usuario sin tocar su foto la borraría.
    private function photoTouched() {
        return ($_POST['photo_b64'] ?? '') !== '' || ($_POST['photo_clear'] ?? '') === '1';
    }

    /*  La foto viaja como dataURL en un campo de TEXTO, no como archivo:
        createModalForm manda el formulario por useFetch, que arma un
        URLSearchParams, y ahí un File se convierte en "[object File]".

        Devuelve el nombre de archivo a guardar, o null para dejarla vacía. Si
        el dataURL viene roto se conserva la que ya había: vale más quedarse con
        la foto vieja que borrarla por un envío mal formado. */
    private function savePhoto($userId, $currentPhoto) {
        $b64   = (string) ($_POST['photo_b64'] ?? '');
        $clear = ($_POST['photo_clear'] ?? '') === '1';
        $dir   = $this->photoDir();

        if (!$clear) {
            if (!preg_match('#^data:image/([a-zA-Z0-9.+-]+);base64,#', $b64, $m)) return $currentPhoto;

            $ext = strtolower($m[1]) === 'jpeg' ? 'jpg' : strtolower($m[1]);
            if (!in_array($ext, ['jpg', 'png', 'webp', 'gif'], true))            return $currentPhoto;

            $data = base64_decode(substr($b64, strpos($b64, ',') + 1), true);
            if ($data === false)                                                 return $currentPhoto;

            if (!is_dir($dir)) @mkdir($dir, 0777, true);

            $fileName = 'user_' . (int) $userId . '_' . time() . '.' . $ext;
            if (@file_put_contents($dir . $fileName, $data) === false)           return $currentPhoto;

            $this->dropPhoto($currentPhoto);
            return $fileName;
        }

        $this->dropPhoto($currentPhoto);
        return null;
    }

    // Borra del disco la foto anterior. basename() para que un valor manipulado
    // no pueda salirse de la carpeta.
    private function dropPhoto($photo) {
        $photo = basename(trim((string) $photo));
        if ($photo === '') return;

        $file = $this->photoDir() . $photo;
        if (is_file($file)) @unlink($file);
    }

    private function photoUrl($photo) {
        return userPhotoUrl($photo, 4);
    }

    function addUser() {
        $name      = trim($_POST['name'] ?? '');
        $lastName  = trim($_POST['last_name'] ?? '');
        $email     = trim($_POST['email'] ?? '');
        $password  = (string) ($_POST['password'] ?? '');
        $roleId    = (int) ($_POST['role_id'] ?? 0);
        $branchIds = $this->normalizeBranchIds($_POST['branch_ids'] ?? '');
        $color     = $this->normalizeColor($_POST['color'] ?? '');

        if ($password !== (string) ($_POST['password_confirmation'] ?? '')) {
            return ['status' => 422, 'message' => 'Las contraseñas no coinciden'];
        }
        if ($name === '' || $email === '') {
            return ['status' => 400, 'message' => 'Nombre y correo son obligatorios'];
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['status' => 400, 'message' => 'El correo no es válido'];
        }
        if ($roleId <= 0 || !$this->qRole([$roleId])) {
            return ['status' => 400, 'message' => 'Debes elegir un rol válido'];
        }
        if (empty($branchIds)) {
            return ['status' => 400, 'message' => 'Debes asignar al menos una sucursal'];
        }
        if (strlen($password) < 4) {
            return ['status' => 400, 'message' => 'La contraseña debe tener al menos 4 caracteres'];
        }
        if ($this->qUserEmailExists([$email, $this->companyId()])) {
            return ['status' => 409, 'message' => 'Ya existe un usuario con ese correo'];
        }
        foreach ($branchIds as $bid) {
            if (!$this->qBranchInCompany([$bid, $this->companyId()])) {
                return ['status' => 400, 'message' => 'Una de las sucursales seleccionadas no es válida'];
            }
        }

        return $this->transaction(function () use ($name, $lastName, $email, $password, $branchIds, $color, $roleId) {
            $this->qInsertUser([
                $name,
                $lastName ?: null,
                $email,
                password_hash($password, PASSWORD_BCRYPT),
                $branchIds[0],
                $this->companyId(),
                $color
            ]);

            $newId = $this->qLastInsertId();
            if (!$newId) {
                throw new \Exception('No se pudo obtener el id del usuario creado');
            }

            // El rol elegido se aplica a todas sus sucursales: el modal captura
            // un rol por usuario, no uno por sucursal.
            foreach ($branchIds as $bid) {
                $this->qInsertUserBranchRole([$newId, $bid, $roleId]);
            }

            // La foto se guarda al final porque su nombre lleva el id del usuario,
            // que hasta aquí no existía.
            if ($this->photoTouched()) {
                $this->qUpdateUserPhoto([$this->savePhoto($newId, ''), $newId, $this->companyId()]);
            }

            return ['status' => 200, 'message' => 'Usuario creado correctamente'];
        });
    }

    function editUser() {
        $id                   = (int) ($_POST['id'] ?? 0);
        $name                 = trim($_POST['name'] ?? '');
        $lastName             = trim($_POST['last_name'] ?? '');
        $email                = trim($_POST['email'] ?? '');
        $roleId               = (int) ($_POST['role_id'] ?? 0);
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
        if ($roleId <= 0 || !$this->qRole([$roleId])) {
            return ['status' => 400, 'message' => 'Debes elegir un rol válido'];
        }
        if (empty($branchIds)) {
            return ['status' => 400, 'message' => 'Debes asignar al menos una sucursal'];
        }
        if ($password !== '' && strlen($password) < 4) {
            return ['status' => 400, 'message' => 'La contraseña debe tener al menos 4 caracteres'];
        }
        $current = $this->qUserFull([$id, $this->companyId()]);
        if (!$current) {
            return ['status' => 404, 'message' => 'Usuario no encontrado'];
        }
        if ($this->qUserEmailExistsExcept([$email, $this->companyId(), $id])) {
            return ['status' => 409, 'message' => 'Ya existe otro usuario con ese correo'];
        }
        foreach ($branchIds as $bid) {
            if (!$this->qBranchInCompany([$bid, $this->companyId()])) {
                return ['status' => 400, 'message' => 'Una de las sucursales seleccionadas no es válida'];
            }
        }

        $photoActual = $current['photo'] ?? '';

        return $this->transaction(function () use ($id, $name, $lastName, $email, $branchIds, $color, $password, $roleId, $photoActual) {
            $this->qUpdateUser([
                $name,
                $lastName ?: null,
                $email,
                $branchIds[0],
                $color,
                $id,
                $this->companyId()
            ]);

            $this->qDeleteUserBranches([$id]);

            foreach ($branchIds as $bid) {
                $this->qInsertUserBranchRole([$id, $bid, $roleId]);
            }

            if ($password !== '') {
                $this->qUpdateUserPassword([
                    password_hash($password, PASSWORD_BCRYPT),
                    $id,
                    $this->companyId()
                ]);
            }

            if ($this->photoTouched()) {
                $this->qUpdateUserPhoto([$this->savePhoto($id, $photoActual), $id, $this->companyId()]);
            }

            return ['status' => 200, 'message' => 'Usuario actualizado correctamente'];
        });
    }

    function toggleUser() {
        $id     = (int) ($_POST['id'] ?? 0);
        $active = (int) ($_POST['active'] ?? 0);

        if (!$this->qUserFull([$id, $this->companyId()])) {
            return ['status' => 404, 'message' => 'Usuario no encontrado'];
        }

        $ok = $this->qSetUserStatus([$active === 1 ? 'active' : 'inactive', $id, $this->companyId()]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? ($active ? 'Usuario activado' : 'Usuario desactivado') : 'No se pudo actualizar el estado'
        ];
    }

    // branch_ids viaja como CSV desde los chips ('1,3'), pero se acepta tambien
    // un array JSON por si la peticion llega de otro cliente.
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
            $n = (int) trim((string) $v);
            if ($n > 0 && !in_array($n, $result, true)) $result[] = $n;
        }
        return $result;
    }

    private function normalizeColor($raw) {
        $color = trim((string) $raw);
        return preg_match('/^#[0-9A-Fa-f]{6}$/', $color) ? $color : null;
    }

    /* ===== Sucursales (el admin elige empresa y reparte su gente) ===== */

    // Una sola consulta por empresa: la lista, el detalle de cada sucursal y los
    // KPIs salen de esta respuesta, así que cambiar de sucursal no vuelve al servidor.
    function lsBranches() {
        $companyId = (int) ($_POST['company_id'] ?? 0) ?: $this->companyId();
        if (!$this->qCompanyHasSubscription([$companyId])) {
            return ['status' => 404, 'message' => 'Empresa no encontrada'];
        }

        $byBranch = [];
        foreach ($this->qBranchAssignments([$companyId]) as $a) {
            $byBranch[$a['branch_id']][] = $a;
        }

        $branches = [];
        foreach ($this->qBranches([$companyId]) as $b) {
            $members = [];
            $row     = [];
            foreach ($byBranch[$b['id']] ?? [] as $a) {
                $fullName  = trim($a['name'] . ' ' . ($a['last_name'] ?? ''));
                $members[] = [
                    'assignment_id' => (int) $a['assignment_id'],
                    'user_id'       => (int) $a['user_id'],
                    'role_id'       => (int) $a['role_id'],
                    'name'          => $fullName
                ];
                $row[] = [
                    'id'      => $a['assignment_id'],
                    'Usuario' => renderUserCell($fullName, $a['email']),
                    'Rol'     => $a['role_name']
                        ? badge(htmlspecialchars($a['role_name']), '#1D4ED8', 100, '#DBEAFE')
                        : badge('Sin rol', '#92400E', 100, '#FEF3C7'),
                    'a'       => [
                        [
                            'class'   => $this->actionBtnClass('neutral'),
                            'html'    => '<i class="icon-pencil"></i>',
                            'onclick' => 'branches.editUserRole(' . (int) $a['assignment_id'] . ')'
                        ],
                        [
                            'class'   => $this->actionBtnClass('danger', true),
                            'html'    => '<i class="icon-trash"></i>',
                            'onclick' => 'branches.removeUserRole(' . (int) $a['assignment_id'] . ')'
                        ]
                    ]
                ];
            }

            $branches[] = [
                'id'        => (int) $b['id'],
                'name'      => (string) $b['name'],
                'ubication' => (string) $b['ubication'],
                'is_active' => (int) $b['is_active'],
                'created'   => $b['created'],
                'users'     => (int) $b['users'],
                'members'   => $members,
                'row'       => $row
            ];
        }

        return [
            'status'         => 200,
            'company_id'     => $companyId,
            'companies'      => $this->qCompaniesBranchSummary(),
            'branches'       => $branches,
            'candidates'     => $this->qUsersForBranchAssign([$companyId]),
            'plan'           => $this->qPlanActiveByCompany([$companyId]),
            // Las sucursales que ofrece el modal de Usuarios (empresa en sesión), frescas tras cada cambio.
            'selectBranches' => $this->qBranchesForSelect([$this->companyId()])
        ];
    }

    function addBranch() {
        $companyId = (int) ($_POST['company_id'] ?? 0);
        $name      = trim($_POST['name'] ?? '');

        if ($name === '') {
            return ['status' => 400, 'message' => 'El nombre de la sucursal es obligatorio'];
        }
        if (!$this->qCompanyHasSubscription([$companyId])) {
            return ['status' => 404, 'message' => 'Empresa no encontrada'];
        }
        if ($this->qBranchNameExists([$name, $companyId])) {
            return ['status' => 400, 'message' => 'Ya existe una sucursal con ese nombre'];
        }

        $plan = $this->qPlanActiveByCompany([$companyId]);
        if ($plan && $plan['max_branches'] !== null
            && $this->qCountActiveBranches([$companyId]) >= (int) $plan['max_branches']) {
            return ['status' => 400, 'message' => 'El plan ' . $plan['name'] . ' permite ' . (int) $plan['max_branches'] . ' sucursales activas'];
        }

        $ok = $this->qInsertBranch([$name, trim($_POST['ubication'] ?? '') ?: null, $companyId]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Sucursal «' . $name . '» creada correctamente' : 'No se pudo crear la sucursal'
        ];
    }

    function editBranch() {
        $id   = (int) ($_POST['id'] ?? 0);
        $name = trim($_POST['name'] ?? '');

        if ($name === '') {
            return ['status' => 400, 'message' => 'El nombre de la sucursal es obligatorio'];
        }
        $branch = $this->qBranch([$id]);
        if (!$branch) {
            return ['status' => 404, 'message' => 'Sucursal no encontrada'];
        }
        if ($this->qBranchNameExistsExcept([$name, (int) $branch['company_id'], $id])) {
            return ['status' => 400, 'message' => 'Ya existe una sucursal con ese nombre'];
        }

        $ok = $this->qUpdateBranch([$name, trim($_POST['ubication'] ?? '') ?: null, $id]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Sucursal actualizada' : 'No se pudo actualizar la sucursal'
        ];
    }

    // Desactivar no borra la gente: las asignaciones quedan guardadas para cuando se reactive.
    function toggleBranch() {
        $id     = (int) ($_POST['id'] ?? 0);
        $active = (int) ($_POST['active'] ?? 0) === 1 ? 1 : 0;

        $branch = $this->qBranch([$id]);
        if (!$branch) {
            return ['status' => 404, 'message' => 'Sucursal no encontrada'];
        }

        $ok = $this->qSetBranchActive([$active, $id]);
        if (!$ok) {
            return ['status' => 500, 'message' => 'No se pudo actualizar el estado'];
        }
        if ($active) {
            return ['status' => 200, 'message' => 'Sucursal «' . $branch['name'] . '» activada'];
        }

        $kept = $this->qCountBranchAssignments([$id]);
        return [
            'status'  => 200,
            'message' => $kept > 0
                ? 'Sucursal desactivada. ' . $kept . ' asignaciones quedan guardadas.'
                : 'Sucursal desactivada'
        ];
    }

    // La empresa se toma de la sucursal y no de la sesión: el admin SaaS reparte
    // gente en la empresa que eligió arriba, no solo en la suya.
    function assignUserRole() {
        $userId   = (int) ($_POST['user_id'] ?? 0);
        $branchId = (int) ($_POST['branch_id'] ?? 0);
        $roleId   = (int) ($_POST['role_id'] ?? 0);

        if ($userId <= 0 || $branchId <= 0 || $roleId <= 0) {
            return ['status' => 400, 'message' => 'Usuario, sucursal y rol son obligatorios'];
        }
        $branch = $this->qBranch([$branchId]);
        if (!$branch) {
            return ['status' => 404, 'message' => 'Sucursal no encontrada'];
        }
        if ((int) $branch['is_active'] !== 1) {
            return ['status' => 400, 'message' => 'La sucursal está desactivada: reactívala para asignar gente'];
        }
        $user = $this->qUserFull([$userId, (int) $branch['company_id']]);
        if (!$user) {
            return ['status' => 400, 'message' => 'El usuario no pertenece a la empresa de la sucursal'];
        }
        $role = $this->qRole([$roleId]);
        if (!$role) {
            return ['status' => 400, 'message' => 'El rol seleccionado no es válido'];
        }

        // Si ya existe la fila usuario+sucursal, se actualiza el rol en vez de duplicar.
        $existing = $this->qUserBranchAssignment([$userId, $branchId]);
        $ok = $existing
            ? $this->qSetUserBranchRole([$roleId, (int) $existing['id']])
            : $this->qInsertUserBranchRole([$userId, $branchId, $roleId]);

        $fullName = trim($user['name'] . ' ' . ($user['last_name'] ?? ''));
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? $fullName . ' asignado como ' . $role['name'] : 'No se pudo asignar el rol'
        ];
    }

    function updateUserRole() {
        $assignmentId = (int) ($_POST['assignment_id'] ?? 0);
        $roleId       = (int) ($_POST['role_id'] ?? 0);

        if ($assignmentId <= 0 || $roleId <= 0) {
            return ['status' => 400, 'message' => 'Asignación y rol son obligatorios'];
        }
        if (!$this->qAssignment([$assignmentId])) {
            return ['status' => 404, 'message' => 'Asignación no encontrada'];
        }
        $role = $this->qRole([$roleId]);
        if (!$role) {
            return ['status' => 400, 'message' => 'El rol seleccionado no es válido'];
        }

        $ok = $this->qSetUserBranchRole([$roleId, $assignmentId]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Rol actualizado a ' . $role['name'] : 'No se pudo actualizar el rol'
        ];
    }

    function removeUserRole() {
        $assignmentId = (int) ($_POST['assignment_id'] ?? 0);
        if (!$this->qAssignment([$assignmentId])) {
            return ['status' => 404, 'message' => 'Asignación no encontrada'];
        }

        $ok = $this->qDeleteUserBranchRole([$assignmentId]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Asignación quitada' : 'No se pudo quitar la asignación'
        ];
    }
}

Permission::dispatch(new ctrl(), 'accesos');
