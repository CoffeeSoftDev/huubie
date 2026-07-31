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
require_once __DIR__ . '/library-roots.php';
require_once __DIR__ . '/todo-shares.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const TODOS_MAX_DEPTH = 6;          // hasta donde baja el barrido
const TODOS_MAX_BYTES = 524288;     // 512 KB por lista

function todos_fail($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function todos_norm($p) {
    return rtrim(str_replace('\\', '/', (string) $p), '/');
}

// Las dos raices propias del cajon, con la etiqueta que las nombra en la interfaz.
// La biblioteca propia va primero: es la que el usuario reconoce como "sus"
// carpetas. `keyPrefix` y `relPrefix` viajan con la raiz porque las listas
// invitadas (de otra cuenta) se arman con el mismo molde pero con otros valores.
function todos_roots() {
    return [
        [
            'root'      => todos_norm(coffee_visor_docs_root()),
            'scope'     => 'mine',
            'label'     => '',
            'keyPrefix' => 'mine:',
            'relPrefix' => coffee_visor_docs_rel_prefix()
        ],
        [
            'root'      => todos_norm(coffee_visor_shared_root()),
            'scope'     => 'shared',
            'label'     => coffee_visor_shared_name(),
            'keyPrefix' => 'shared:',
            'relPrefix' => coffee_visor_shared_rel_prefix()
        ]
    ];
}

// Raiz "prestada": la biblioteca de otra cuenta vista a traves de una
// comparticion concreta. Devuelve null si esa cuenta ya no tiene carpeta.
function todos_invited_root($share) {
    $root = coffee_visor_docs_root_of($share['ownerId']);
    if ($root === '') return null;

    return [
        'root'       => todos_norm($root),
        'scope'      => 'invited',
        'label'      => $share['ownerName'],
        'keyPrefix'  => 'u' . (int) $share['ownerId'] . ':',
        'relPrefix'  => coffee_visor_docs_rel_prefix_of($share['ownerId']),
        'ownerId'    => (int) $share['ownerId'],
        'ownerName'  => $share['ownerName'],
        'permission' => $share['permission']
    ];
}

// Un todo es cualquier json cuyo nombre empiece por "todo": asi entran los que ya
// existen (todo.json, todo-huubie.json, todo_play.json) sin renombrar nada.
function todos_is_todo_file($name) {
    return (bool) preg_match('/^todo[^\/\\\\]*\.json$/i', (string) $name);
}

// Recorre una raiz y devuelve las rutas de sus todo*.json. La profundidad esta
// acotada porque la biblioteca puede tener arboles largos (Diagramas, planes) y
// el barrido corre en cada apertura del cajon.
function todos_walk($dir, $depth = 0) {
    $found = [];
    if ($depth > TODOS_MAX_DEPTH || !is_dir($dir)) return $found;

    foreach (@scandir($dir) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $full = $dir . '/' . $entry;
        if (is_dir($full)) {
            $found = array_merge($found, todos_walk($full, $depth + 1));
        } else if (todos_is_todo_file($entry)) {
            $found[] = $full;
        }
    }
    return $found;
}

// Normaliza el contenido de un todo.json a la forma que espera el cajon. Un
// archivo a medias (sin sections, sin ids) no debe tirar la vista: se completa.
//
// Normalizar NO es recortar: las claves que el cajon no entiende (due, tags,
// prio, notas, lo que sea) viajan intactas hasta el navegador y vuelven al disco
// al guardar. Antes se perdian aqui, y el archivo quedaba mutilado al primer clic.
// Las del nivel raiz van aparte, en `extra`, porque ahi la ficha de la lista mezcla
// datos del archivo con estado de ejecucion que nunca debe escribirse.
function todos_shape($raw, $fallbackTitle) {
    $data = json_decode((string) $raw, true);
    if (!is_array($data)) $data = [];

    $out = [
        'title'    => trim((string) ($data['title'] ?? '')) !== '' ? $data['title'] : $fallbackTitle,
        'sections' => [],
        'extra'    => array_diff_key($data, ['title' => 1, 'sections' => 1])
    ];

    // Los ids que faltan se inventan, pero nunca pisando uno que ya exista en el
    // archivo: dos tareas con el mismo id rompen en silencio el borrado, el
    // arrastre y la edicion, porque el cajon las localiza por ese id.
    $seq  = 0;
    $used = [];
    $mint = function ($given, $prefix) use (&$seq, &$used) {
        $id = (string) $given;
        if ($id === '' || isset($used[$id])) {
            do { $id = $prefix . (++$seq); } while (isset($used[$id]));
        }
        $used[$id] = true;
        return $id;
    };

    foreach ((array) ($data['sections'] ?? []) as $sec) {
        if (!is_array($sec)) continue;
        $tasks = [];
        foreach ((array) ($sec['tasks'] ?? []) as $task) {
            if (!is_array($task)) continue;
            $tasks[] = array_merge($task, [
                'id'   => $mint($task['id'] ?? '', 't'),
                'text' => (string) ($task['text'] ?? ''),
                'done' => !empty($task['done'])
            ]);
        }
        $out['sections'][] = array_merge($sec, [
            'id'    => $mint($sec['id'] ?? '', 's'),
            'title' => (string) ($sec['title'] ?? 'Seccion'),
            'tasks' => $tasks
        ]);
    }
    return $out;
}

// Ficha de una lista tal como la consume el cajon. `key` es la ruta relativa a su
// raiz: sobrevive a que cambie el id de usuario, asi que sirve de identidad
// estable para recordar que listas estan archivadas.
function todos_entry($fullPath, $rootInfo) {
    $full = todos_norm($fullPath);
    $root = $rootInfo['root'];
    $rel  = ltrim(substr($full, strlen($root)), '/');
    $dir  = trim(dirname($rel), '.');
    $file = basename($full);

    $raw   = @file_get_contents($full);
    $label = $dir !== '' ? basename($dir) : ($rootInfo['label'] !== '' ? $rootInfo['label'] : 'Biblioteca');
    $shape = todos_shape($raw === false ? '' : $raw, $label);

    $total = 0;
    $done  = 0;
    foreach ($shape['sections'] as $sec) {
        foreach ($sec['tasks'] as $task) {
            $total++;
            if ($task['done']) $done++;
        }
    }

    // Migas de pan legibles: "Huubie / Facturador / todo.json". La carpeta
    // compartida se nombra con su etiqueta y no con el nombre real del directorio;
    // una lista invitada se encabeza con el nombre de su dueno, para que nadie la
    // confunda con una propia.
    $crumbs = $dir !== '' ? explode('/', $dir) : [];
    if ($rootInfo['scope'] !== 'mine') array_unshift($crumbs, $rootInfo['label']);

    // Sobre lo ajeno solo se manda el permiso registrado; lo propio y la carpeta
    // comun siempre son editables.
    $permission = $rootInfo['scope'] === 'invited'
        ? ($rootInfo['permission'] === 'view' ? 'view' : 'edit')
        : 'edit';

    return [
        'key'      => $rootInfo['keyPrefix'] . $rel,
        'scope'    => $rootInfo['scope'],
        'title'    => $shape['title'],
        'file'      => $file,
        'dir'       => $dir,
        'rel'       => $rel,
        'crumbs'    => $crumbs,
        'pathLabel' => implode(' / ', array_merge($crumbs, [$file])),
        'fullPath'  => $full,
        'relPath'   => $rootInfo['relPrefix'] . ($rel !== '' ? '/' . $rel : ''),
        'total'     => $total,
        'done'      => $done,
        'pending'   => $total - $done,
        'mtime'     => @filemtime($full) ?: 0,
        'sections'  => $shape['sections'],
        // Claves del nivel raiz que no son del cajon: se devuelven para poder
        // reescribirlas tal cual al guardar.
        'extra'     => (object) $shape['extra'],
        // Comparticion: quien es el dueno cuando la lista es prestada, y con
        // quien la comparto yo cuando es mia (lo rellena `scan`).
        'ownerId'    => (int) ($rootInfo['ownerId'] ?? 0),
        'ownerName'  => (string) ($rootInfo['ownerName'] ?? ''),
        'permission' => $permission,
        'canEdit'    => $permission === 'edit',
        'shares'     => []
    ];
}

// Valida que una ruta absoluta caiga dentro de las raices del cajon. Se compara
// el directorio (no el archivo) para que tambien sirva al crear uno nuevo.
function todos_root_of($fullPath) {
    $dirReal = realpath(dirname(todos_norm($fullPath)));
    if ($dirReal === false) return null;
    $dirReal = todos_norm($dirReal);

    foreach (todos_roots() as $info) {
        $rootReal = realpath($info['root']);
        if ($rootReal === false) continue;
        $rootReal = todos_norm($rootReal);
        if ($dirReal === $rootReal || strpos($dirReal, $rootReal . '/') === 0) return $info;
    }
    return null;
}

// Igual que la anterior pero para lo prestado: una ruta cae aqui solo si apunta
// EXACTAMENTE al archivo que otra cuenta compartio conmigo. No basta con estar
// dentro de su biblioteca — compartir una lista no abre su carpeta entera.
function todos_invited_root_of($fullPath) {
    $me = todo_shares_user_id();
    if ($me <= 0) return null;

    // Se compara la ruta REAL de los dos lados: las raices se arman con un ".."
    // en medio y una comparacion literal nunca casaria.
    $full = realpath(todos_norm($fullPath));
    if ($full === false) return null;
    $full = todos_norm($full);

    foreach (todo_shares_for_target($me) as $share) {
        $info = todos_invited_root($share);
        if ($info === null) continue;
        $target = realpath($info['root'] . '/' . $share['rel']);
        if ($target !== false && strcasecmp(todos_norm($target), $full) === 0) return $info;
    }
    return null;
}

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
