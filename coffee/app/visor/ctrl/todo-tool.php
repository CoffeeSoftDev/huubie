<?php
/* Herramienta `todo_propose`: deja que el chat proponga tareas para una lista TODO.
 *
 * A diferencia de las demas, esta no le devuelve datos al modelo: recoge lo que el
 * modelo propone y lo aparta para que el CONTROLADOR se lo entregue a la interfaz,
 * que lo pinta como una tarjeta con casillas. El archivo no se toca aqui.
 *
 * Es deliberado. Un modelo con permiso de escritura directa en las listas del
 * usuario las llena de ruido en una semana y no hay forma de deshacerlo: entre la
 * propuesta y el disco va una persona. Al modelo se le devuelve solo un acuse.
 *
 * El acumulador es estatico por peticion: el loop de tools puede llamar a la
 * herramienta varias veces (una por seccion, p. ej.) y todo se junta en una sola
 * propuesta.
 */

require_once __DIR__ . '/todos-lib.php';

/** Definicion en formato OpenAI de las herramientas. */
function todo_tool_specs() {
    return [
        [
            'type' => 'function',
            'function' => [
                'name'        => 'todo_list',
                'description' => 'Indice de las listas TODO del usuario: titulo, ruta, pendientes y hechas. '
                               . 'NO trae el texto de las tareas. Usala primero para saber que listas existen '
                               . 'y con que clave (`key`) pedir el detalle.',
                'parameters'  => ['type' => 'object', 'properties' => (object) []],
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name'        => 'todo_read',
                'description' => 'Lee una lista TODO completa: sus secciones y el texto y estado de cada tarea. '
                               . 'Solo lectura. Pide la lista por la `key` que devolvio todo_list.',
                'parameters'  => [
                    'type' => 'object',
                    'properties' => [
                        'key' => ['type' => 'string', 'description' => 'Clave de la lista, tal cual la devolvio todo_list.'],
                    ],
                    'required' => ['key'],
                ],
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name'        => 'todo_stats',
                'description' => 'Cuentas ya calculadas sobre TODAS las listas: totales, verbos con los que '
                               . 'empiezan las tareas y terminos que se repiten en varias listas. Usala para '
                               . 'responder que se corrige mas o que patrones se repiten — los numeros ya vienen '
                               . 'hechos, no los recalcules ni los inventes.',
                'parameters'  => [
                    'type' => 'object',
                    'properties' => [
                        'solo_pendientes' => [
                            'type' => 'boolean',
                            'description' => 'true para contar solo lo que sigue abierto. Por defecto cuenta todo.',
                        ],
                    ],
                ],
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name'        => 'todo_propose',
                'description' => 'Propone tareas para la lista TODO del usuario. NO las guarda: se le muestran '
                               . 'al usuario en una tarjeta para que elija cuales acepta. Usala cuando el usuario '
                               . 'pida anotar algo, o cuando le entregues hallazgos de una revision que deban '
                               . 'convertirse en trabajo. Cada tarea debe ser accionable y, si sale de un archivo '
                               . 'concreto, llevar su ruta y linea en `ref`.',
                'parameters'  => [
                    'type' => 'object',
                    'properties' => [
                        'titulo'    => [
                            'type' => 'string',
                            'description' => 'Titulo corto de la propuesta (ej. "Auditoria de app/facture").',
                        ],
                        'secciones' => [
                            'type'  => 'array',
                            'description' => 'Grupos de tareas. Una sola seccion si no hay motivo para separarlas.',
                            'items' => [
                                'type' => 'object',
                                'properties' => [
                                    'titulo' => ['type' => 'string', 'description' => 'Nombre del grupo (ej. "UI / UX", "Controlador").'],
                                    'tareas' => [
                                        'type'  => 'array',
                                        'items' => [
                                            'type' => 'object',
                                            'properties' => [
                                                'text' => ['type' => 'string', 'description' => 'La tarea, empezando por un verbo en infinitivo.'],
                                                'prio' => ['type' => 'string', 'description' => 'alta | media | baja (opcional).'],
                                                'tags' => ['type' => 'array', 'items' => ['type' => 'string'], 'description' => 'Etiquetas cortas, sin gato (opcional).'],
                                                'ref'  => ['type' => 'string', 'description' => 'Origen: "ruta/archivo.php:123" (opcional).'],
                                            ],
                                            'required' => ['text'],
                                        ],
                                    ],
                                ],
                                'required' => ['titulo', 'tareas'],
                            ],
                        ],
                    ],
                    'required' => ['secciones'],
                ],
            ],
        ],
    ];
}

/**
 * Acumulador de la peticion. Sin argumentos devuelve lo juntado hasta ahora;
 * `todo_tool_take()` lo devuelve y lo vacia (lo llama el controlador al responder).
 */
function todo_tool_bag(array $add = null, $reset = false) {
    static $bag = null;
    if ($reset) { $out = $bag; $bag = null; return $out; }
    if ($add !== null) {
        if ($bag === null) $bag = ['titulo' => '', 'secciones' => []];
        if ($bag['titulo'] === '' && $add['titulo'] !== '') $bag['titulo'] = $add['titulo'];
        foreach ($add['secciones'] as $sec) $bag['secciones'][] = $sec;
    }
    return $bag;
}

/** La propuesta acumulada (o null). Vacia el acumulador. */
function todo_tool_take() {
    return todo_tool_bag(null, true);
}

// ── Lectura ─────────────────────────────────────────────────────────────────
// El barrido es el mismo del cajon (todos-lib.php): misma sesion, mismas raices
// y mismos permisos de comparticion. El chat no ve una linea mas que la ventana.

/** Todas las listas visibles para la sesion, propias, comunes y prestadas. */
function todo_tool_scan() {
    $lists = [];
    foreach (todos_roots() as $info) {
        foreach (todos_walk($info['root']) as $path) $lists[] = todos_entry($path, $info);
    }
    foreach (todo_shares_for_target(todo_shares_user_id()) as $share) {
        $info = todos_invited_root($share);
        if ($info === null) continue;
        $path = $info['root'] . '/' . $share['rel'];
        if (!is_file($path) || !todos_is_todo_file(basename($path))) continue;
        $lists[] = todos_entry($path, $info);
    }
    return $lists;
}

/** Indice: lo que necesita el modelo para elegir, sin el texto de las tareas. */
function todo_tool_list() {
    $out = [];
    foreach (todo_tool_scan() as $l) {
        $out[] = [
            'key'       => $l['key'],
            'titulo'    => $l['title'],
            'ruta'      => $l['pathLabel'],
            'total'     => $l['total'],
            'hechas'    => $l['done'],
            'pendientes'=> $l['pending'],
        ];
    }
    return ['listas' => $out, 'total_listas' => count($out)];
}

/** Una lista entera. La `key` es la que devolvio todo_list. */
function todo_tool_read($key) {
    $key = trim((string) $key);
    foreach (todo_tool_scan() as $l) {
        if ($l['key'] !== $key) continue;

        $secciones = [];
        foreach ($l['sections'] as $sec) {
            $tareas = [];
            foreach ($sec['tasks'] as $t) {
                $tarea = ['text' => $t['text'], 'done' => (bool) $t['done']];
                foreach (['prio', 'tags', 'due', 'ref'] as $k) {
                    if (isset($t[$k]) && $t[$k] !== '' && $t[$k] !== []) $tarea[$k] = $t[$k];
                }
                $tareas[] = $tarea;
            }
            $secciones[] = ['titulo' => $sec['title'], 'tareas' => $tareas];
        }

        return [
            'titulo'     => $l['title'],
            'ruta'       => $l['pathLabel'],
            'total'      => $l['total'],
            'hechas'     => $l['done'],
            'pendientes' => $l['pending'],
            'solo_lectura' => !$l['canEdit'],
            'secciones'  => $secciones,
        ];
    }
    return ['error' => 'No hay ninguna lista con la clave "' . $key . '". Pide todo_list para ver las que existen.'];
}

// Terminos que delatan un patron de correccion. Se cuentan por TAREA y por LISTA:
// lo que aparece en cuatro proyectos pesa mas que lo que se repite mucho en uno.
const TODO_TERMS = [
    'filterbar' => 'filterBar', 'scrollbar' => 'scrollbar', 'datatable' => 'datatable',
    'boton'     => 'botones',   'button'    => 'botones',
    'columna'   => 'columnas de tabla', 'tabla' => 'tablas',
    'selector'  => 'selectores', 'modal' => 'modales', 'alert' => 'alertas',
    'kpi'       => 'KPIs cards', 'card' => 'cards', 'badge' => 'badges',
    'icono'     => 'iconos', 'grafica' => 'graficas', 'tema' => 'tema y colores',
    'color'     => 'tema y colores', 'border' => 'bordes', 'scroll' => 'scroll',
];

/** Cuentas sobre todas las listas. Contar es trabajo de PHP, no del modelo. */
function todo_tool_stats($soloPendientes = false) {
    $total = 0; $hechas = 0; $listas = 0;
    $verbos = [];
    $terminos = [];   // termino => ['tareas' => n, 'listas' => [titulo => true]]
    $sinFecha = 0;

    foreach (todo_tool_scan() as $l) {
        $listas++;
        foreach ($l['sections'] as $sec) {
            foreach ($sec['tasks'] as $t) {
                $done = (bool) $t['done'];
                $total++;
                if ($done) $hechas++;
                if ($soloPendientes && $done) continue;

                $text = trim((string) $t['text']);
                if ($text === '') continue;
                if (!isset($t['born']) && !isset($t['due'])) $sinFecha++;

                // Verbo inicial: dice si el trabajo es agregar o desandar.
                $palabras = preg_split('/\s+/u', mb_strtolower($text, 'UTF-8'));
                $verbo = $palabras[0] ?? '';
                if ($verbo !== '' && mb_strlen($verbo, 'UTF-8') > 2) {
                    $verbos[$verbo] = ($verbos[$verbo] ?? 0) + 1;
                }

                $plano = todo_tool_plain($text);
                foreach (TODO_TERMS as $needle => $label) {
                    if (strpos($plano, $needle) === false) continue;
                    if (!isset($terminos[$label])) $terminos[$label] = ['tareas' => 0, 'listas' => [], 'ejemplo' => ''];
                    $terminos[$label]['tareas']++;
                    $terminos[$label]['listas'][$l['title']] = true;
                    // Una tarea textual por termino: el modelo la cita en vez de
                    // inventarse un ejemplo. Se queda con la mas larga, que suele
                    // ser la que mejor explica el patron.
                    if (mb_strlen($text, 'UTF-8') > mb_strlen($terminos[$label]['ejemplo'], 'UTF-8')) {
                        $terminos[$label]['ejemplo'] = $text;
                    }
                }
            }
        }
    }

    arsort($verbos);
    $topVerbos = array_slice($verbos, 0, 8, true);

    // Solo lo que cruza mas de una lista: dentro de un proyecto repetir es normal,
    // entre proyectos es una regla que falta.
    $cruzados = [];
    foreach ($terminos as $label => $d) {
        if (count($d['listas']) < 2) continue;
        $cruzados[] = [
            'termino' => $label,
            'tareas'  => $d['tareas'],
            'listas'  => count($d['listas']),
            'donde'   => array_keys($d['listas']),
            'ejemplo' => $d['ejemplo'],
        ];
    }
    usort($cruzados, function ($a, $b) {
        if ($a['listas'] !== $b['listas']) return $b['listas'] - $a['listas'];
        return $b['tareas'] - $a['tareas'];
    });

    return [
        'total'      => $total,
        'hechas'     => $hechas,
        'pendientes' => $total - $hechas,
        'listas'     => $listas,
        'alcance'    => $soloPendientes ? 'solo pendientes' : 'todas las tareas',
        'verbos'     => $topVerbos,
        'cruzados'   => array_slice($cruzados, 0, 12),
        'sin_fecha'  => $sinFecha,
        'nota'       => 'Estos numeros ya estan calculados: citalos tal cual. `cruzados` va ordenado por '
                      . 'cuantas listas alcanza cada termino, que es lo que convierte una correccion en regla. '
                      . 'El campo `ejemplo` es una tarea REAL del usuario: copiala literal, no la reescribas.',
    ];
}

/** Minusculas sin acentos, para que "botón" y "boton" cuenten igual. */
function todo_tool_plain($text) {
    $t = mb_strtolower((string) $text, 'UTF-8');
    return strtr($t, ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u','ñ'=>'n']);
}

/**
 * Normaliza lo que mando el modelo y lo aparta. Devuelve al modelo un acuse corto:
 * si le devolvieramos la lista entera, la repetiria en prosa debajo de la tarjeta.
 */
function todo_run_tool($name, array $args) {
    if ($name === 'todo_list') {
        return json_encode(todo_tool_list(), JSON_UNESCAPED_UNICODE);
    }
    if ($name === 'todo_read') {
        return json_encode(todo_tool_read($args['key'] ?? ''), JSON_UNESCAPED_UNICODE);
    }
    if ($name === 'todo_stats') {
        return json_encode(todo_tool_stats(!empty($args['solo_pendientes'])), JSON_UNESCAPED_UNICODE);
    }
    if ($name !== 'todo_propose') {
        return json_encode(['error' => 'Herramienta desconocida: ' . $name], JSON_UNESCAPED_UNICODE);
    }

    $secciones = [];
    $total     = 0;
    foreach ((array) ($args['secciones'] ?? []) as $sec) {
        if (!is_array($sec)) continue;
        $tareas = [];
        foreach ((array) ($sec['tareas'] ?? []) as $t) {
            if (!is_array($t)) continue;
            $text = trim((string) ($t['text'] ?? ''));
            if ($text === '') continue;

            $tarea = ['text' => $text];
            $prio  = strtolower(trim((string) ($t['prio'] ?? '')));
            if (in_array($prio, ['alta', 'media', 'baja'], true)) $tarea['prio'] = $prio;

            $tags = [];
            foreach ((array) ($t['tags'] ?? []) as $tag) {
                $tag = ltrim(trim((string) $tag), '#');
                if ($tag !== '' && !in_array($tag, $tags, true)) $tags[] = $tag;
            }
            if ($tags) $tarea['tags'] = array_slice($tags, 0, 4);

            $ref = trim((string) ($t['ref'] ?? ''));
            if ($ref !== '') $tarea['ref'] = $ref;

            $tareas[] = $tarea;
            $total++;
        }
        if ($tareas) {
            $secciones[] = [
                'titulo' => trim((string) ($sec['titulo'] ?? '')) ?: 'Pendientes',
                'tareas' => $tareas,
            ];
        }
    }

    if (!$secciones) {
        return json_encode(['error' => 'no llego ninguna tarea con texto'], JSON_UNESCAPED_UNICODE);
    }

    todo_tool_bag(['titulo' => trim((string) ($args['titulo'] ?? '')), 'secciones' => $secciones]);

    return json_encode([
        'ok'      => true,
        'shown'   => $total,
        'message' => 'Las tareas ya se le mostraron al usuario en una tarjeta para que elija cuales acepta. '
                   . 'NO las repitas en tu respuesta: comenta en una o dos frases que encontraste y nada mas.',
    ], JSON_UNESCAPED_UNICODE);
}

/** Etiqueta del indicador "trabajando…". */
function todo_tool_label(array $args) {
    $n = 0;
    foreach ((array) ($args['secciones'] ?? []) as $sec) $n += count((array) ($sec['tareas'] ?? []));
    return $n ? ('preparando ' . $n . ' tarea' . ($n === 1 ? '' : 's')) : 'preparando tareas';
}
