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
            // users.status es enum de texto; el filtro manda 1/0/pending y el ctrl lo traduce.
            'userStatusFilter' => [
                ['id' => '1', 'valor' => 'Activos'],
                ['id' => '0', 'valor' => 'Inactivos'],
                ['id' => 'pending', 'valor' => 'Pendientes']
            ],
            'companies'        => $this->qCompaniesForSelect(),
            'modules'          => $this->qModulesForSelect(),
            'submodules'       => $this->qSubmodulesForSelect(),
            'sections'         => $this->qSectionsForSelect(),
            'typePermissions'  => $this->qTypePermissionsForSelect(),
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

        // Con código ya puesto, renombrar no lo cambia: 'developer' es como la
        // pantalla de empresas encuentra la tarjeta de este módulo.
        $ok = $this->qUpdateModule([
            $name,
            $module['code'] ?: (trim($_POST['code'] ?? '') ?: null),
            trim($_POST['icon'] ?? '') ?: null,
            trim($_POST['description'] ?? '') ?: null,
            trim($_POST['route'] ?? '') ?: null,
            (int) $module['orden'],
            $id
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Módulo actualizado correctamente' : 'No se pudo actualizar el módulo'];
    }

    // Developer no se apaga: Permission::section pide el módulo encendido incluso
    // a root, y Accesos (donde se volvería a encender) vive dentro de él.
    function toggleModule() {
        $id     = (int) $_POST['id'];
        $module = $this->qModule([$id]);
        if (!$module) return ['status' => 404, 'message' => 'Módulo no encontrado'];
        if ($module['code'] === 'developer' && (int) $_POST['active'] !== 1) {
            return ['status' => 400, 'message' => 'El módulo Developer no se puede desactivar: ahí se administran los accesos y nadie podría volver a entrar'];
        }
        $ok = $this->qSetModuleActive([(int) $_POST['active'], $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? ((int) $_POST['active'] ? 'Módulo activado' : 'Módulo desactivado') : 'No se pudo actualizar el estado'];
    }

    /* ===== Submódulos (submodules) =====
       Se crean, editan y apagan desde la pestaña Módulos (acordeones por submódulo). */

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

    function toggleSubmodule() {
        $id = (int) $_POST['id'];
        if (!$this->qSubmodule([$id])) return ['status' => 404, 'message' => 'Submódulo no encontrado'];
        $ok = $this->qSetSubmoduleActive([(int) $_POST['active'], $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? ((int) $_POST['active'] ? 'Submódulo activado' : 'Submódulo desactivado') : 'No se pudo actualizar el estado'];
    }

    // Solo se elimina un submódulo desactivado, y para siempre. Sus secciones no se
    // borran: pasan a "Sin submódulo" del mismo módulo con todo y sus permisos.
    function deleteSubmodule() {
        $id    = (int) $_POST['id'];
        $found = $this->qSubmodule([$id]);
        if (!$found) return ['status' => 404, 'message' => 'Submódulo no encontrado'];
        if ((int) $found['is_active'] === 1) return ['status' => 400, 'message' => 'Solo se puede eliminar un submódulo desactivado'];

        return $this->transaction(function () use ($id) {
            $this->qDetachSubmoduleSections([$id]);
            $this->qDeleteSubmodule([$id]);
            return ['status' => 200, 'message' => 'Submódulo eliminado'];
        });
    }

    /* ===== Secciones (sections) ===== */

    // Las tarjetas de la pestaña Módulos pintan los permisos de cada sección como
    // chips: van los tipos activos y lo que ya tiene cada sección.
    function lsSections() {
        // 'all' = Estado Todos: activas e inactivas.
        $active = isset($_POST['active']) ? $_POST['active'] : '1';
        $ls = $active === 'all' ? $this->qSections([]) : $this->qSections([(int) $active]);

        return [
            'status'      => 200,
            'ls'          => $ls,
            'modules'     => $this->qModulesCatalog(),
            'submodules'  => $this->qSubmodulesCatalog(),
            'types'       => array_map(function ($t) {
                return ['id' => (int) $t['id'], 'name' => $t['name']];
            }, $this->qTypePermissions([1])),
            'permissions' => array_map(function ($p) {
                return $this->permissionRow($p);
            }, $this->qPermissionsCatalog())
        ];
    }

    function getSection() {
        $id   = (int) $_POST['id'];
        $data = $this->qSection([$id]);
        if ($data) {
            $data['module_id']    = $data['module_id'] !== null ? (string) $data['module_id'] : '';
            $data['submodule_id'] = $data['submodule_id'] !== null ? (string) $data['submodule_id'] : '';
        }
        return [
            'status'   => $data ? 200 : 404,
            'message'  => $data ? 'OK' : 'Sección no encontrada',
            'data'     => $data,
            // Para el select de permisos del modal.
            'type_ids' => $data ? $this->qSectionTypeIds([$id]) : []
        ];
    }

    // En transacción para que LAST_INSERT_ID lea la misma conexión del INSERT y
    // los permisos de la sección se guarden junto con ella.
    function addSection() {
        $name     = trim($_POST['name'] ?? '');
        $moduleId = (int) ($_POST['module_id'] ?? 0);
        if ($name === '') return ['status' => 400, 'message' => 'El nombre de la sección es obligatorio'];
        if ($moduleId <= 0) return ['status' => 400, 'message' => 'Debes seleccionar un módulo'];

        return $this->transaction(function () use ($name, $moduleId) {
            $this->qInsertSection([
                $name,
                trim($_POST['code'] ?? '') ?: null,
                trim($_POST['icon'] ?? '') ?: null,
                trim($_POST['route'] ?? '') ?: null,
                $this->intOrNull($_POST['orden'] ?? '') ?? 0,
                $moduleId,
                $this->selectOrNull($_POST['submodule_id'] ?? '')
            ]);

            $newId = $this->qLastInsertId();
            if (!$newId) {
                throw new \Exception('No se pudo obtener el id de la sección creada');
            }

            $this->syncSectionTypes($newId);

            return ['status' => 200, 'message' => 'Sección creada correctamente'];
        });
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
        return $this->transaction(function () use ($id, $name, $moduleId, $section) {
            $this->qUpdateSection([
                $name,
                $section['code'],
                trim($_POST['icon'] ?? '') ?: null,
                trim($_POST['route'] ?? '') ?: null,
                $this->intOrNull($_POST['orden'] ?? '') ?? 0,
                $moduleId,
                $this->selectOrNull($_POST['submodule_id'] ?? ''),
                $id
            ]);

            $this->syncSectionTypes($id);

            return ['status' => 200, 'message' => 'Sección actualizada correctamente'];
        });
    }

    /*  Deja encendidos en la sección exactamente los tipos de permiso que llegan
        en `type_ids` (JSON con ids), entre los activos. Apagar uno no borra nada:
        los roles que ya lo tenían lo recuperan si se vuelve a poner. Sin
        `type_ids` en el POST (no hay tipos activos que elegir) no se toca nada. */
    private function syncSectionTypes($sectionId) {
        if (!isset($_POST['type_ids'])) return;

        $wanted = $this->postedIds('type_ids');
        foreach ($this->qTypePermissions([1]) as $t) {
            $typeId = (int) $t['id'];
            $this->setPermission($sectionId, $typeId, in_array($typeId, $wanted, true) ? 1 : 0);
        }
    }

    // Accesos tampoco: apagada, Permission::page('accesos') deja fuera a todos.
    function toggleSection() {
        $id      = (int) $_POST['id'];
        $section = $this->qSection([$id]);
        if (!$section) return ['status' => 404, 'message' => 'Sección no encontrada'];
        if ($section['code'] === 'accesos' && (int) $_POST['active'] !== 1) {
            return ['status' => 400, 'message' => 'La sección Accesos no se puede desactivar: es donde se vuelve a encender todo'];
        }
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

    /* ===== Roles (roles) =====
       Se listan, crean, editan y apagan desde la pestaña Permisos (lsPermissionRoles). */

    function getRole() {
        $data = $this->qRole([(int) $_POST['id']]);
        if ($data && (int) $data['is_system'] === 1) $data['company_name'] = 'Todas las empresas (rol del sistema)';
        return ['status' => $data ? 200 : 404, 'message' => $data ? 'OK' : 'Rol no encontrado', 'data' => $data];
    }

    // Acciones por sección del rol, para la pestaña Permisos. El Super Admin no
    // se edita porque su acceso es total.
    function getRolePermissions() {
        $id   = (int) ($_POST['id'] ?? 0);
        $role = $this->qRole([$id]);
        if (!$role) return ['status' => 404, 'message' => 'Rol no encontrado'];

        if ($role['code'] === 'root') {
            return ['status' => 200, 'fullAccess' => true, 'modules' => []];
        }

        return [
            'status'     => 200,
            'fullAccess' => false,
            'modules'    => $this->permissionTree($this->qRolePermissions([$id]))
        ];
    }

    // El rol nace sin acciones. Devuelve su id y empresa para que la pestaña
    // Permisos lo deje elegido y listo para marcarle sus permisos.
    // company_id = 'system': rol del sistema, sin empresa, para todas las empresas.
    function addRole() {
        $name      = trim($_POST['name'] ?? '');
        $code      = trim($_POST['code'] ?? '') ?: null;
        $isSystem  = (string) ($_POST['company_id'] ?? '') === 'system';
        $companyId = $isSystem ? null : (int) ($_POST['company_id'] ?? 0);
        if ($name === '') return ['status' => 400, 'message' => 'El nombre del rol es obligatorio'];
        if (!$isSystem && ($companyId <= 0 || !$this->qCompany([$companyId]))) return ['status' => 400, 'message' => 'Elige la empresa del rol'];

        $error = $this->roleError($code, $name, $companyId, 0);
        if ($error) return ['status' => 400, 'message' => $error];

        // En transacción para que LAST_INSERT_ID lea la misma conexión del INSERT.
        return $this->transaction(function () use ($code, $name, $isSystem, $companyId) {
            $this->qInsertRole([$code, $name, $isSystem ? 1 : 0, $companyId]);

            $newId = $this->qLastInsertId();
            if (!$newId) {
                throw new \Exception('No se pudo obtener el id del rol creado');
            }

            return [
                'status'     => 200,
                'message'    => 'Rol creado. Ahora márcale sus permisos',
                'id'         => $newId,
                'company_id' => $isSystem ? 'system' : $companyId
            ];
        });
    }

    function editRole() {
        $id   = (int) $_POST['id'];
        $name = trim($_POST['name'] ?? '');
        $code = trim($_POST['code'] ?? '') ?: null;
        if ($name === '') return ['status' => 400, 'message' => 'El nombre del rol es obligatorio'];

        $role = $this->qRole([$id]);
        if (!$role) return ['status' => 404, 'message' => 'Rol no encontrado'];

        // El código de root es el que le da el acceso total: no se cambia. Los demás
        // roles del sistema se validan como los de empresa, entre los del sistema.
        if ($role['code'] === 'root') {
            $code = $role['code'];
        } else {
            $companyId = (int) $role['is_system'] === 1 ? null : (int) $role['company_id'];
            $error = $this->roleError($code, $name, $companyId, $id);
            if ($error) return ['status' => 400, 'message' => $error];
        }

        $ok = $this->qUpdateRole([$code, $name, $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Rol actualizado correctamente' : 'No se pudo actualizar el rol'];
    }

    function toggleRole() {
        $id   = (int) $_POST['id'];
        $role = $this->qRole([$id]);
        if (!$role) return ['status' => 404, 'message' => 'Rol no encontrado'];
        if ($role['code'] === 'root') {
            return ['status' => 400, 'message' => 'El rol root no se puede desactivar'];
        }
        $ok = $this->qSetRoleActive([(int) $_POST['active'], $id]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? ((int) $_POST['active'] ? 'Rol activado' : 'Rol desactivado') : 'No se pudo actualizar el estado'];
    }

    // El código no puede ser uno reservado (root da acceso total) y el nombre no se
    // repite dentro de la misma empresa o, con $companyId null, entre los del sistema.
    private function roleError($code, $name, $companyId, $id) {
        if ($code !== null && in_array(strtolower($code), $this->reservedRoleCodes, true)) {
            return 'Ese código está reservado';
        }
        if ($this->qRoleNameExists([$name, $companyId, $id])) {
            return $companyId === null ? 'Ya hay un rol del sistema con ese nombre' : 'Esa empresa ya tiene un rol con ese nombre';
        }
        return null;
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

    /* ===== Permisos: acciones de cada rol (permissions_roles) ===== */

    // Panel de roles de la pestaña Permisos. Empresa: 'system' (el de arranque)
    // = solo los del sistema; un id = los de esa empresa. Estado: 1/0.
    function lsPermissionRoles() {
        $active  = isset($_POST['active']) ? (int) $_POST['active'] : 1;
        $company = (string) ($_POST['company_id'] ?? 'system');

        $ls = ctype_digit($company)
            ? $this->qRoles([$active, (int) $company], 'company')
            : $this->qRoles([$active], 'system');

        return [
            'status' => 200,
            'roles'  => array_map(function ($r) {
                return [
                    'id'        => (int) $r['id'],
                    'name'      => $r['name'],
                    'code'      => $r['code'],
                    'is_system' => (int) $r['is_system'],
                    'is_active' => (int) $r['is_active'],
                    'actions'   => (int) $r['actions'],
                    'sections'  => (int) $r['sections']
                ];
            }, $ls)
        ];
    }

    function saveRolePermissions() {
        $id   = (int) ($_POST['id'] ?? 0);
        $role = $this->qRole([$id]);
        if (!$role) return ['status' => 404, 'message' => 'Rol no encontrado'];
        if ($role['code'] === 'root') return ['status' => 400, 'message' => 'El rol root tiene acceso total: sus permisos no se editan'];
        if (!isset($_POST['permissions'])) return ['status' => 400, 'message' => 'No llegaron los permisos del rol'];

        return $this->transaction(function () use ($id, $role) {
            $this->syncRolePermissions($id);
            return ['status' => 200, 'message' => 'Permisos de «' . $role['name'] . '» guardados'];
        });
    }

    /*  Deja en permissions_roles exactamente las acciones que llegan en
        `permissions` (JSON con ids), pero solo entre las vigentes: lo que esté
        apagado en el catálogo no sale en la pestaña y se conserva tal cual, para
        que el rol lo recupere si se vuelve a encender. */
    private function syncRolePermissions($roleId) {
        $rows    = $this->qRolePermissions([$roleId]);
        $visible = array_map('intval', array_column($rows, 'permission_id'));
        $granted = [];
        foreach ($rows as $r) {
            if ((int) $r['granted'] === 1) $granted[] = (int) $r['permission_id'];
        }

        $wanted = array_values(array_intersect($this->postedIds('permissions'), $visible));

        foreach (array_diff($granted, $wanted) as $permissionId) {
            $this->qDeleteRolePermission([$roleId, $permissionId]);
        }
        foreach (array_diff($wanted, $granted) as $permissionId) {
            $this->qInsertRolePermission([$roleId, $permissionId]);
        }
    }

    // Ids positivos y sin repetir de un campo que viaja como JSON ('[1,3]').
    private function postedIds($key) {
        $decoded = json_decode((string) ($_POST[$key] ?? ''), true);
        if (!is_array($decoded)) return [];

        $ids = [];
        foreach ($decoded as $v) {
            $id = (int) $v;
            if ($id > 0) $ids[] = $id;
        }
        return array_values(array_unique($ids));
    }

    /* ===== Permisos de cada sección (permissions) =====
       Se eligen en la pestaña Módulos: el select del modal de sección, la × de
       sus chips y el menú del clic derecho. */

    // Enciende o apaga una acción en una sección. Apagarla no le quita nada a los
    // roles: deja de verse y de contar, y al encenderla cada rol la recupera.
    function togglePermission() {
        $secId  = (int) ($_POST['section_id'] ?? 0);
        $typeId = (int) ($_POST['type_permission_id'] ?? 0);
        $active = (int) ($_POST['active'] ?? 0) === 1 ? 1 : 0;

        if (!$this->qSection([$secId]))         return ['status' => 404, 'message' => 'Sección no encontrada'];
        if (!$this->qTypePermission([$typeId])) return ['status' => 404, 'message' => 'Tipo de permiso no encontrado'];

        $ok      = $this->setPermission($secId, $typeId, $active);
        $current = $this->qFindPermission([$secId, $typeId]);

        return [
            'status'     => $ok ? 200 : 500,
            'message'    => $ok ? ($active ? 'Acción agregada a la sección' : 'Acción quitada de la sección') : 'No se pudo actualizar la acción',
            'permission' => $current ? $this->permissionRow($current) : null
        ];
    }

    // Inserta la acción si la sección nunca la tuvo; si ya existe solo la enciende o apaga.
    private function setPermission($secId, $typeId, $active) {
        $found = $this->qFindPermission([$secId, $typeId]);
        if ($found) return $this->qSetPermissionActive([$active, (int) $found['id']]);
        if ($active === 1) return $this->qInsertPermission([$secId, $typeId]);
        return true; // No existe y se pide quitar: nada que hacer.
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

    /* ===== Usuarios de todas las empresas =====
       Cada usuario pertenece a una sucursal (users.branch_id) y entra a las que
       tenga en users_braches, con un rol en cada una: admin en una, cajero en otra. */

    function lsUsers() {
        $statuses  = ['1' => 'active', '0' => 'inactive', 'pending' => 'pending'];
        $status    = $statuses[(string) ($_POST['active'] ?? '1')] ?? 'active';
        $company   = (string) ($_POST['company_id'] ?? 'all');
        $byCompany = ctype_digit($company);
        $params    = $byCompany ? [$status, (int) $company] : [$status];

        $access = [];
        foreach ($this->qUsersAccess($params, $byCompany) as $a) {
            $access[$a['user_id']][] = $a;
        }

        $row = [];
        foreach ($this->qUsers($params, $byCompany) as $u) {
            $mine   = $access[$u['id']] ?? [];
            $isRoot = in_array('root', array_column($mine, 'role_code'), true);

            // Un pendiente aún no define su contraseña: activarlo no le serviría de nada.
            $a = [[
                'class'   => $this->actionBtnClass('neutral', $u['status'] === 'pending'),
                'html'    => '<i class="icon-pencil"></i>',
                'onclick' => 'users.editUser(' . $u['id'] . ')'
            ]];
            if ($u['status'] !== 'pending') {
                $isActive = $u['status'] === 'active';
                $a[] = [
                    'class'   => $this->actionBtnClass($isActive ? 'danger' : 'neutral', true),
                    'html'    => $isActive ? '<i class="icon-toggle-on"></i>' : '<i class="icon-toggle-off"></i>',
                    'onclick' => 'users.toggleUser(' . $u['id'] . ', ' . ($isActive ? 0 : 1) . ')'
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

            $row[] = [
                'id'       => $u['id'],
                'Usuario'  => $cell,
                'Correo'   => htmlspecialchars($u['email'] ?? '—'),
                'Empresa'  => $u['company_name'] ? htmlspecialchars($u['company_name']) : '<span class="italic text-gray-400 text-sm">Plataforma</span>',
                'Sucursal' => $this->userHomeLabel($u, $mine, $isRoot),
                'Accesos'  => $this->userAccessLabel($mine, $isRoot),
                'Estado'   => renderUserStatus($u['status']),
                'a'        => $a
            ];
        }

        return ['status' => 200, 'row' => $row];
    }

    // La sucursal a la que pertenece. Si no entra a ella, el login lo manda a la
    // primera en la que sí tenga rol (homeBranch en auth/ctrl/ctrl-auth.php): se avisa.
    private function userHomeLabel($user, $access, $isRoot) {
        if (!$user['branch_name']) return '<span class="italic text-gray-400 text-sm">Sin sucursal</span>';

        $label  = htmlspecialchars($user['branch_name']);
        $inside = in_array((int) $user['branch_id'], array_map('intval', array_column($access, 'branch_id')), true);
        if ($inside || $isRoot || (int) $user['is_owner'] === 1) return $label;

        return '<div class="flex items-center gap-2">' . $label
             . badge('Sin acceso', '#92400E', 100, '#FEF3C7') . '</div>';
    }

    private function userAccessLabel($access, $isRoot) {
        if ($isRoot) {
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-gray-900 text-white">Acceso total</span>';
        }
        if (!$access) return badge('Sin acceso', '#92400E', 100, '#FEF3C7');

        return '<div class="flex flex-wrap gap-1">' . implode('', array_map(function ($a) {
            $role = $a['role_name'] ? htmlspecialchars($a['role_name']) : 'Sin rol';
            return badge(htmlspecialchars($a['branch_name']) . ' · ' . $role, '#1D4ED8', 100, '#DBEAFE');
        }, $access)) . '</div>';
    }

    function getUser() {
        $id   = (int) ($_POST['id'] ?? 0);
        $data = $this->qUser([$id]);
        if (!$data) return ['status' => 404, 'message' => 'Usuario no encontrado'];

        $companyId          = (int) $data['company_id'];
        $data['company_id'] = $companyId ? (string) $companyId : '';
        $data['branch_id']  = $data['branch_id'] !== null ? (string) $data['branch_id'] : '';
        $data['photo_url']  = $this->photoUrl($data['photo'] ?? '');

        return [
            'status'  => 200,
            'message' => 'OK',
            'data'    => $data,
            'isRoot'  => $this->qUserIsRoot([$id]),
            'access'  => array_map(function ($a) {
                return ['branch_id' => (int) $a['branch_id'], 'role_id' => (int) $a['role_id']];
            }, $this->qUserAccess([$id])),
            'options' => $companyId ? $this->companyAccess($companyId) : ['branches' => [], 'roles' => []]
        ];
    }

    // Al cambiar la empresa en el modal de usuario: sus sucursales y los roles que se dan en ellas.
    function getCompanyAccess() {
        $companyId = (int) ($_POST['company_id'] ?? 0);
        if (!$this->qCompany([$companyId])) return ['status' => 404, 'message' => 'Empresa no encontrada'];

        return array_merge(['status' => 200], $this->companyAccess($companyId));
    }

    private function companyAccess($companyId) {
        return [
            'branches' => $this->qBranchesByCompany([$companyId]),
            'roles'    => $this->qRolesForCompany([$companyId])
        ];
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
        $user     = $this->postedUser();
        $password = (string) ($_POST['password'] ?? '');

        if ($password !== (string) ($_POST['password_confirmation'] ?? '')) {
            return ['status' => 422, 'message' => 'Las contraseñas no coinciden'];
        }
        $error = $this->userError($user, 0) ?: $this->accessError($user);
        if ($error) return $error;
        if (strlen($password) < 4) {
            return ['status' => 400, 'message' => 'La contraseña debe tener al menos 4 caracteres'];
        }

        return $this->transaction(function () use ($user, $password) {
            $this->qInsertUser([
                $user['name'],
                $user['last_name'],
                $user['email'],
                password_hash($password, PASSWORD_BCRYPT),
                $user['branch_id'],
                $user['company_id'],
                $user['color']
            ]);

            $newId = $this->qLastInsertId();
            if (!$newId) {
                throw new \Exception('No se pudo obtener el id del usuario creado');
            }

            $this->saveAccess($newId, $user['access']);

            // La foto se guarda al final porque su nombre lleva el id del usuario,
            // que hasta aquí no existía.
            if ($this->photoTouched()) {
                $this->qUpdateUserPhoto([$this->savePhoto($newId, ''), $newId]);
            }

            return ['status' => 200, 'message' => 'Usuario creado correctamente'];
        });
    }

    // Un usuario de plataforma (root) no tiene empresa: de él solo se editan sus
    // datos, y sus accesos se quedan como están.
    function editUser() {
        $id      = (int) ($_POST['id'] ?? 0);
        $current = $this->qUser([$id]);
        if (!$current) return ['status' => 404, 'message' => 'Usuario no encontrado'];

        $user     = $this->postedUser();
        $isRoot   = $this->qUserIsRoot([$id]);
        // Opcionales en la edicion: si no llegan, la contrasena no se toca.
        $password = (string) ($_POST['password'] ?? '');

        if ($password !== '' && $password !== (string) ($_POST['password_confirmation'] ?? '')) {
            return ['status' => 422, 'message' => 'Las contraseñas no coinciden'];
        }
        $error = $this->userError($user, $id) ?: ($isRoot ? null : $this->accessError($user));
        if ($error) return $error;
        if ($password !== '' && strlen($password) < 4) {
            return ['status' => 400, 'message' => 'La contraseña debe tener al menos 4 caracteres'];
        }

        if ($isRoot) {
            $user['company_id'] = $current['company_id'];
            $user['branch_id']  = $current['branch_id'];
        }

        return $this->transaction(function () use ($id, $user, $isRoot, $password, $current) {
            $this->qUpdateUser([
                $user['name'],
                $user['last_name'],
                $user['email'],
                $user['company_id'],
                $user['branch_id'],
                $user['color'],
                $id
            ]);

            if (!$isRoot) $this->saveAccess($id, $user['access']);

            if ($password !== '') {
                $this->qUpdateUserPassword([password_hash($password, PASSWORD_BCRYPT), $id]);
            }

            if ($this->photoTouched()) {
                $this->qUpdateUserPhoto([$this->savePhoto($id, $current['photo'] ?? ''), $id]);
            }

            return ['status' => 200, 'message' => 'Usuario actualizado correctamente'];
        });
    }

    function toggleUser() {
        $id     = (int) ($_POST['id'] ?? 0);
        $active = (int) ($_POST['active'] ?? 0);

        if (!$this->qUser([$id])) {
            return ['status' => 404, 'message' => 'Usuario no encontrado'];
        }

        $ok = $this->qSetUserStatus([$active === 1 ? 'active' : 'inactive', $id]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? ($active ? 'Usuario activado' : 'Usuario desactivado') : 'No se pudo actualizar el estado'
        ];
    }

    private function postedUser() {
        return [
            'name'       => trim($_POST['name'] ?? ''),
            'last_name'  => trim($_POST['last_name'] ?? '') ?: null,
            'email'      => trim($_POST['email'] ?? ''),
            'company_id' => (int) ($_POST['company_id'] ?? 0),
            'branch_id'  => (int) ($_POST['branch_id'] ?? 0),
            'color'      => $this->normalizeColor($_POST['color'] ?? ''),
            'access'     => $this->normalizeAccess($_POST['access'] ?? '')
        ];
    }

    private function userError($user, $id) {
        if ($user['name'] === '' || $user['email'] === '') {
            return ['status' => 400, 'message' => 'Nombre y correo son obligatorios'];
        }
        if (!filter_var($user['email'], FILTER_VALIDATE_EMAIL)) {
            return ['status' => 400, 'message' => 'El correo no es válido'];
        }
        if ($this->qUserEmailTaken([$user['email'], $id])) {
            return ['status' => 409, 'message' => 'Ya existe un usuario con ese correo'];
        }
        return null;
    }

    // Empresa, sucursal a la que pertenece y accesos: todo de la misma empresa, y
    // cada acceso con un rol del sistema o de esa empresa.
    private function accessError($user) {
        $companyId = $user['company_id'];

        if ($companyId <= 0 || !$this->qCompany([$companyId])) {
            return ['status' => 400, 'message' => 'Elige la empresa del usuario'];
        }
        if ($user['branch_id'] <= 0 || !$this->qBranchInCompany([$user['branch_id'], $companyId])) {
            return ['status' => 400, 'message' => 'Elige la sucursal a la que pertenece'];
        }
        if (!$user['access']) {
            return ['status' => 400, 'message' => 'Dale acceso al menos a una sucursal'];
        }

        $roles = array_map('intval', array_column($this->qRolesForCompany([$companyId]), 'id'));
        foreach ($user['access'] as $a) {
            if (!$this->qBranchInCompany([$a['branch_id'], $companyId])) {
                return ['status' => 400, 'message' => 'Una de las sucursales con acceso no es de la empresa'];
            }
            if (!in_array($a['role_id'], $roles, true)) {
                return ['status' => 400, 'message' => 'Cada sucursal con acceso necesita un rol de la empresa'];
            }
        }
        return null;
    }

    // Reescribe los accesos: lo que no llegó en `access` deja de estar.
    private function saveAccess($userId, $access) {
        $this->qDeleteUserBranches([$userId]);
        foreach ($access as $a) {
            $this->qInsertUserBranchRole([$userId, $a['branch_id'], $a['role_id']]);
        }
    }

    // access viaja como JSON [{branch_id, role_id}, ...]: una fila por sucursal.
    private function normalizeAccess($raw) {
        $decoded = json_decode((string) $raw, true);

        $result = [];
        foreach ((is_array($decoded) ? $decoded : []) as $a) {
            $branchId = (int) ($a['branch_id'] ?? 0);
            if ($branchId <= 0 || isset($result[$branchId])) continue;
            $result[$branchId] = ['branch_id' => $branchId, 'role_id' => (int) ($a['role_id'] ?? 0)];
        }
        return array_values($result);
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
            // Los que ofrecen los modales de asignar y cambiar rol: del sistema y de esta empresa.
            'roles'          => $this->qRolesForCompany([$companyId])
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
        if (!$this->roleFitsCompany($role, (int) $branch['company_id'])) {
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
        $assignment = $this->qAssignment([$assignmentId]);
        if (!$assignment) {
            return ['status' => 404, 'message' => 'Asignación no encontrada'];
        }
        $role = $this->qRole([$roleId]);
        if (!$this->roleFitsCompany($role, (int) $assignment['company_id'])) {
            return ['status' => 400, 'message' => 'El rol seleccionado no es válido'];
        }

        $ok = $this->qSetUserBranchRole([$roleId, $assignmentId]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Rol actualizado a ' . $role['name'] : 'No se pudo actualizar el rol'
        ];
    }

    // En una sucursal solo se da un rol encendido del sistema o de la empresa dueña.
    // root no se reparte aquí: en cualquier sucursal da acceso total a toda la plataforma.
    private function roleFitsCompany($role, $companyId) {
        if (!$role || (int) $role['is_active'] !== 1 || $role['code'] === 'root') return false;
        return (int) $role['is_system'] === 1 || (int) $role['company_id'] === $companyId;
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
