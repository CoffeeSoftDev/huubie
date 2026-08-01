<?php
// Cajon de TODOs: barre la biblioteca del usuario buscando los todo*.json que
// tenga repartidos por sus carpetas y los sirve juntos, para poder trabajarlos
// sin abrir cada archivo en el visor.
//
// Acciones (`action` por POST o GET):
//   scan    -> todas las listas encontradas, con sus secciones y contadores
//   save    -> reescribe un todo.json completo (el cliente manda el JSON entero)
//   create  -> crea una lista nueva en una carpeta de la biblioteca
//   folders -> carpetas donde se puede crear una lista (para el selector)
//   users   -> cuentas con las que se puede compartir (todas menos la propia)
//   share   -> comparte una lista propia con una cuenta (permiso view | edit)
//   unshare -> retira esa comparticion
//
// El alcance es la biblioteca del visor: documents/users/<id> y documents/shared,
// mas las listas que OTRA cuenta haya compartido con la de la sesion — esas se
// leen de su biblioteca original, nunca se copian (ver todo-shares.php).
require_once __DIR__ . '/todos-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$action = $_POST['action'] ?? $_GET['action'] ?? '';

try {
    switch ($action) {

        case 'scan': {
            $me     = todo_shares_user_id();
            $shared = $me > 0 ? todo_shares_by_owner($me) : [];
            $lists  = [];

            foreach (todos_roots() as $info) {
                foreach (todos_walk($info['root']) as $path) {
                    $entry = todos_entry($path, $info);
                    // Mis listas cargan con quien las comparto: el panel de
                    // comparticion se abre sin pedir nada mas al servidor.
                    if ($entry['scope'] === 'mine' && isset($shared[$entry['rel']])) {
                        $entry['shares'] = $shared[$entry['rel']];
                    }
                    $lists[] = $entry;
                }
            }

            // Listas que otras cuentas comparten conmigo. Se leen de su biblioteca
            // original: si el dueno la borro o la movio, simplemente no aparece.
            foreach (todo_shares_for_target($me) as $share) {
                $info = todos_invited_root($share);
                if ($info === null) continue;
                $path = $info['root'] . '/' . $share['rel'];
                if (!is_file($path) || !todos_is_todo_file(basename($path))) continue;
                $lists[] = todos_entry($path, $info);
            }

            // Mas pendientes primero: el cajon se abre mostrando donde hay trabajo.
            // A igualdad, la lista tocada mas recientemente.
            usort($lists, function ($a, $b) {
                if ($a['pending'] !== $b['pending']) return $b['pending'] - $a['pending'];
                return $b['mtime'] - $a['mtime'];
            });

            $pending = 0;
            $active  = 0;
            foreach ($lists as $l) {
                $pending += $l['pending'];
                if ($l['total'] > 0) $active++;
            }

            echo json_encode([
                'success' => true,
                'user'    => coffee_visor_user_key(),
                'lists'   => $lists,
                'totals'  => ['lists' => count($lists), 'active' => $active, 'pending' => $pending]
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        case 'save': {
            $fullPath = trim($_POST['fullPath'] ?? '');
            $content  = (string) ($_POST['content'] ?? '');

            if ($fullPath === '')                     todos_fail('fullPath requerido');
            if (!todos_is_todo_file(basename($fullPath))) todos_fail('Solo se guardan archivos todo*.json');
            if (strlen($content) > TODOS_MAX_BYTES)   todos_fail('La lista excede el tamano maximo');
            // El cliente manda el JSON entero: si viniera roto dejaria la lista
            // ilegible para el visor, asi que se rechaza antes de tocar el disco.
            if (json_decode($content, true) === null)  todos_fail('El contenido no es JSON valido');

            // Primero las raices propias; si no cae en ninguna, todavia puede ser
            // una lista que me compartieron — y entonces manda su permiso.
            $info = todos_root_of($fullPath);
            if ($info === null) {
                $info = todos_invited_root_of($fullPath);
                if ($info === null)               todos_fail('Ruta fuera de la biblioteca', 403);
                if ($info['permission'] !== 'edit') todos_fail('Esta lista se compartio contigo solo para consulta', 403);
            }
            if (!is_file($fullPath)) todos_fail('La lista ya no existe en el disco', 404);

            if (@file_put_contents($fullPath, $content) === false) {
                todos_fail('No se pudo escribir la lista', 500);
            }

            echo json_encode([
                'success' => true,
                'entry'   => todos_entry($fullPath, $info)
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        // Añade tareas a una lista SIN reescribirla entera. `save` manda el JSON
        // completo desde el navegador, asi que si otra pestaña (o el chat) escribio
        // en medio, se pierde su cambio. Aqui el archivo se lee y se modifica en el
        // servidor: lo que llega son solo las tareas nuevas.
        case 'append': {
            $fullPath = trim($_POST['fullPath'] ?? '');
            $payload  = json_decode((string) ($_POST['sections'] ?? ''), true);

            if ($fullPath === '')                         todos_fail('fullPath requerido');
            if (!todos_is_todo_file(basename($fullPath))) todos_fail('Solo se guardan archivos todo*.json');
            if (!is_array($payload) || !$payload)         todos_fail('No llego ninguna tarea');

            $info = todos_root_of($fullPath);
            if ($info === null) {
                $info = todos_invited_root_of($fullPath);
                if ($info === null)                 todos_fail('Ruta fuera de la biblioteca', 403);
                if ($info['permission'] !== 'edit') todos_fail('Esta lista se compartio contigo solo para consulta', 403);
            }
            if (!is_file($fullPath)) todos_fail('La lista ya no existe en el disco', 404);

            $data = json_decode((string) @file_get_contents($fullPath), true);
            if (!is_array($data)) $data = [];
            if (!isset($data['sections']) || !is_array($data['sections'])) $data['sections'] = [];

            // Ids unicos contra los que ya viven en el archivo.
            $used = [];
            foreach ($data['sections'] as $sec) {
                if (isset($sec['id'])) $used[(string) $sec['id']] = true;
                foreach ((array) ($sec['tasks'] ?? []) as $t) {
                    if (isset($t['id'])) $used[(string) $t['id']] = true;
                }
            }
            $mint = function ($prefix) use (&$used) {
                do { $id = $prefix . substr(str_shuffle('abcdefghijklmnopqrstuvwxyz0123456789'), 0, 6); }
                while (isset($used[$id]));
                $used[$id] = true;
                return $id;
            };

            $added = 0;
            foreach ($payload as $block) {
                if (!is_array($block)) continue;
                $titulo = trim((string) ($block['titulo'] ?? '')) ?: 'Pendientes';

                // Si ya hay una seccion con ese titulo las tareas se suman ahi, en vez
                // de crear duplicados con el mismo nombre.
                $idx = null;
                foreach ($data['sections'] as $i => $sec) {
                    if (strcasecmp(trim((string) ($sec['title'] ?? '')), $titulo) === 0) { $idx = $i; break; }
                }
                if ($idx === null) {
                    $data['sections'][] = ['id' => $mint('s'), 'title' => $titulo, 'tasks' => []];
                    $idx = count($data['sections']) - 1;
                }
                if (!isset($data['sections'][$idx]['tasks']) || !is_array($data['sections'][$idx]['tasks'])) {
                    $data['sections'][$idx]['tasks'] = [];
                }

                foreach ((array) ($block['tareas'] ?? []) as $t) {
                    $text = trim((string) ($t['text'] ?? ''));
                    if ($text === '') continue;
                    $task = ['id' => $mint('t'), 'text' => $text, 'done' => false];
                    // Los campos opcionales viajan tal cual: el panel los pinta como
                    // chips y `ref` guarda de donde salio la tarea.
                    foreach (['prio', 'tags', 'ref'] as $k) {
                        if (isset($t[$k]) && $t[$k] !== '' && $t[$k] !== []) $task[$k] = $t[$k];
                    }
                    $data['sections'][$idx]['tasks'][] = $task;
                    $added++;
                }
            }

            if (!$added) todos_fail('No llego ninguna tarea con texto');

            $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (strlen($json) > TODOS_MAX_BYTES)          todos_fail('La lista excede el tamano maximo');
            if (@file_put_contents($fullPath, $json) === false) todos_fail('No se pudo escribir la lista', 500);

            echo json_encode([
                'success' => true,
                'added'   => $added,
                'entry'   => todos_entry($fullPath, $info)
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        case 'create': {
            $dir   = trim($_POST['dir'] ?? '');          // relativo a la raiz, '' = raiz
            $scope = ($_POST['scope'] ?? 'mine') === 'shared' ? 'shared' : 'mine';
            $file  = trim($_POST['file'] ?? 'todo.json');
            $title = trim($_POST['title'] ?? '');

            if ($file === '') $file = 'todo.json';
            if (substr($file, -5) !== '.json') $file .= '.json';
            if (!todos_is_todo_file($file)) todos_fail('El nombre debe empezar por "todo" y terminar en .json');
            if (preg_match('#(^|/)\.\.(/|$)#', $dir . '/' . $file)) todos_fail('Ruta no permitida');

            $roots = todos_roots();
            $info  = $scope === 'shared' ? $roots[1] : $roots[0];
            $target = $info['root'] . ($dir !== '' ? '/' . trim($dir, '/') : '') . '/' . $file;

            if (todos_root_of($target) === null) todos_fail('Carpeta destino fuera de la biblioteca', 403);
            // Nunca pisar una lista existente: se devuelve la que ya estaba para
            // que el cajon la abra en vez de crear una vacia encima.
            if (is_file($target)) {
                echo json_encode([
                    'success' => true,
                    'exists'  => true,
                    'entry'   => todos_entry($target, $info)
                ], JSON_UNESCAPED_UNICODE);
                break;
            }

            $seed = [
                'title'    => $title !== '' ? $title : basename(dirname($target)),
                'sections' => []
            ];
            if (@file_put_contents($target, json_encode($seed, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) === false) {
                todos_fail('No se pudo crear la lista', 500);
            }

            echo json_encode([
                'success' => true,
                'entry'   => todos_entry($target, $info)
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        // Carpetas candidatas para una lista nueva: la raiz de la biblioteca, sus
        // proyectos y las subcarpetas de estos. Mas hondo no se ofrece — una lista
        // enterrada cuatro niveles no la vuelve a encontrar nadie.
        case 'folders': {
            $folders = [];
            $roots   = todos_roots();
            $mine    = $roots[0]['root'];

            $folders[] = ['scope' => 'mine', 'dir' => '', 'label' => 'Biblioteca (raiz)'];
            foreach (@scandir($mine) ?: [] as $proj) {
                if ($proj === '.' || $proj === '..' || !is_dir($mine . '/' . $proj)) continue;
                $folders[] = ['scope' => 'mine', 'dir' => $proj, 'label' => $proj];
                foreach (@scandir($mine . '/' . $proj) ?: [] as $sub) {
                    if ($sub === '.' || $sub === '..' || !is_dir($mine . '/' . $proj . '/' . $sub)) continue;
                    $folders[] = ['scope' => 'mine', 'dir' => $proj . '/' . $sub, 'label' => $proj . ' / ' . $sub];
                }
            }
            $folders[] = ['scope' => 'shared', 'dir' => '', 'label' => coffee_visor_shared_name()];

            echo json_encode(['success' => true, 'folders' => $folders], JSON_UNESCAPED_UNICODE);
            break;
        }

        // ── Comparticion entre cuentas ──────────────────────────────────────
        // Solo se comparte lo propio (`scope` mine): la carpeta comun ya la ven
        // todos, y lo que a mi me prestaron no es mio para volver a prestarlo.
        case 'users': {
            $me = todo_shares_user_id();
            if ($me <= 0) todos_fail('Inicia sesion para compartir listas', 401);

            $users = array_values(array_filter(todo_shares_users(), function ($u) use ($me) {
                return $u['id'] !== $me;
            }));
            echo json_encode(['success' => true, 'users' => $users], JSON_UNESCAPED_UNICODE);
            break;
        }

        case 'share': {
            $me         = todo_shares_user_id();
            $rel        = todo_shares_norm_rel($_POST['rel'] ?? '');
            $target     = (int) ($_POST['target'] ?? 0);
            $permission = todo_shares_perm($_POST['permission'] ?? 'edit');

            if ($me <= 0)        todos_fail('Inicia sesion para compartir listas', 401);
            if ($rel === '')     todos_fail('Lista no valida');
            if ($target <= 0)    todos_fail('Elige con quien compartir');
            if ($target === $me) todos_fail('Esa lista ya es tuya');
            if (!isset(todo_shares_users_map()[$target])) todos_fail('Esa cuenta no existe', 404);

            // La ruta se reconstruye desde MI raiz: el cliente manda solo el
            // relativo, asi que no hay forma de registrar un permiso sobre la
            // biblioteca de otro.
            $mine = todos_roots()[0];
            $path = $mine['root'] . '/' . $rel;
            if (!is_file($path) || !todos_is_todo_file(basename($path))) todos_fail('Esa lista no esta en tu biblioteca', 404);

            todo_shares_set($me, $rel, $target, $permission);

            $byOwner = todo_shares_by_owner($me);
            echo json_encode([
                'success' => true,
                'shares'  => $byOwner[$rel] ?? []
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        case 'unshare': {
            $me     = todo_shares_user_id();
            $rel    = todo_shares_norm_rel($_POST['rel'] ?? '');
            $target = (int) ($_POST['target'] ?? 0);

            if ($me <= 0)     todos_fail('Inicia sesion para compartir listas', 401);
            if ($rel === '')  todos_fail('Lista no valida');
            if ($target <= 0) todos_fail('Falta la cuenta a retirar');

            todo_shares_remove($me, $rel, $target);

            $byOwner = todo_shares_by_owner($me);
            echo json_encode([
                'success' => true,
                'shares'  => $byOwner[$rel] ?? []
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        default:
            todos_fail('Accion no reconocida: ' . $action);
    }
} catch (Throwable $e) {
    todos_fail('Error en el cajon de TODOs: ' . $e->getMessage(), 500);
}
