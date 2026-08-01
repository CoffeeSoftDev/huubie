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

/** Definicion en formato OpenAI de la herramienta. */
function todo_tool_specs() {
    return [
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

/**
 * Normaliza lo que mando el modelo y lo aparta. Devuelve al modelo un acuse corto:
 * si le devolvieramos la lista entera, la repetiria en prosa debajo de la tarjeta.
 */
function todo_run_tool($name, array $args) {
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
