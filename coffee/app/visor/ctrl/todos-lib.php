<?php
// Nucleo del cajon de TODOs: raices de la biblioteca, forma del archivo y validacion
// de rutas. Vive aparte de ctrl-todos.php porque lo comparten DOS entradas con
// autenticacion distinta:
//   - ctrl-todos.php      -> el cajon del visor, con la sesion del navegador
//   - ctrl-todo-sync.php  -> la sincronizacion con avatars, servidor a servidor por token
// Aqui no se emite salida ni se decide nada de HTTP: eso es de cada entrada.
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
