<?php
/**
 * CEREBRO del agente: lo que sabe entre conversaciones y lo que sabe leer.
 *
 * Dos piezas, una misma idea — al system prompt viaja el INDICE, no el contenido:
 *
 *   Memoria persistente  hechos por (agente, usuario). Se inyectan las ultimas 40 con
 *                        su [id] visible, para que el modelo pueda borrar la obsoleta.
 *   Archivos de reglas   una linea por archivo (name — description · cuando). El
 *                        contenido lo abre el agente con read_rules cuando lo necesita.
 *
 * Por que el indice y no el contenido: grimorio-coffee-varoch.md pesa 100 KB (~25 000
 * tokens) y hoy se inyecta entero en CADA turno; su linea de indice pesa ~20 tokens.
 * El agente paga solo por el archivo que abrio.
 *
 * Sobre la resolucion de nombres (agents_rule_resolve): en el modulo del que viene
 * este diseno, 25 de 310 lecturas fallaron por una sola razon — el modelo pide
 * 'transmute' cuando el archivo es 'transmute.md'. Aqui se resuelve tambien sin
 * extension y por prefijo unico, y el error siempre devuelve la lista de archivos
 * disponibles para que el modelo se corrija en el mismo turno.
 */

require_once __DIR__ . '/agents-registry.php';

const BRAIN_MAX_MEMORIES    = 100;    // por agente + usuario
const BRAIN_MEMORY_CHARS    = 500;    // por memoria
const BRAIN_PROMPT_MEMORIES = 40;     // ultimas N inyectadas al prompt
const BRAIN_RULES_READ_CAP  = 24000;  // chars por lectura de read_rules (~6k tokens)
const BRAIN_RULE_WRITE_CAP  = 20000;  // chars por archivo escrito con write_rule

// ── Resolucion de archivos ──────────────────────────────────────────────────

/**
 * Indice de archivos visibles para un agente: propios UNION los que le compartieron.
 * Si un nombre choca gana el propio (se consultan primero y el dedup respeta el orden).
 */
function brain_index($agentKey) {
    $agent = agents_get_by_key($agentKey);
    if (!$agent) return [];

    // El rango de prioridad va como COLUMNA y no como expresion del ORDER BY: en un
    // UNION, SQLite solo ordena por columnas del resultado.
    $st = agents_db()->prepare('
        SELECT k.id, k.name, k.description, k.when_to_use, k.priority, 0 AS shared,
               CASE k.priority WHEN "critical" THEN 1 WHEN "high" THEN 2 WHEN "medium" THEN 3 ELSE 4 END AS prio_rank
        FROM agent_knowledge k
        WHERE k.agent_id = ? AND k.active = 1
        UNION ALL
        SELECT k.id, k.name, k.description, k.when_to_use, k.priority, 1 AS shared,
               CASE k.priority WHEN "critical" THEN 1 WHEN "high" THEN 2 WHEN "medium" THEN 3 ELSE 4 END AS prio_rank
        FROM agent_knowledge k
        INNER JOIN agent_knowledge_share s ON s.knowledge_id = k.id
        WHERE s.agent_id = ? AND k.active = 1
        ORDER BY shared ASC, prio_rank ASC, id ASC
    ');
    $st->execute([$agent['id'], $agent['id']]);

    $index = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $key = mb_strtolower($r['name']);
        if (isset($index[$key])) continue;   // propios primero: ganan el nombre
        $index[$key] = [
            'id'          => (int) $r['id'],
            'name'        => $r['name'],
            'description' => (string) $r['description'],
            'when_to_use' => (string) $r['when_to_use'],
            'priority'    => $r['priority'],
            'shared'      => (int) $r['shared'] === 1,
        ];
    }
    return array_values($index);
}

/**
 * Encuentra el archivo que pidio el modelo, tolerando como lo escribe de verdad:
 * exacto -> sin extension -> prefijo unico. Solo se acepta el prefijo cuando hay UNA
 * coincidencia; con dos, adivinar seria peor que devolver el error con la lista.
 */
function brain_resolve($agentKey, $name) {
    $name  = trim((string) $name);
    $index = brain_index($agentKey);
    if ($name === '' || empty($index)) return null;

    $needle = mb_strtolower($name);
    foreach ($index as $f) {
        if (mb_strtolower($f['name']) === $needle) return $f;
    }

    $bare = preg_replace('/\.(md|txt|markdown)$/i', '', $needle);
    foreach ($index as $f) {
        if (mb_strtolower(preg_replace('/\.(md|txt|markdown)$/i', '', $f['name'])) === $bare) return $f;
    }

    $hits = [];
    foreach ($index as $f) {
        if (strpos(mb_strtolower($f['name']), $bare) === 0) $hits[] = $f;
    }
    return count($hits) === 1 ? $hits[0] : null;
}

// ── Tools ───────────────────────────────────────────────────────────────────

/** read_rules: abre un archivo del indice, paginado por lineas. */
function brain_read_rules(array $args, $agentKey) {
    if ((string) $agentKey === '') {
        return ['error' => 'No hay agente en este chat, no hay archivos de reglas que leer.'];
    }

    $file = brain_resolve($agentKey, $args['name'] ?? '');
    if ($file === null) {
        return [
            'error'                => "No existe el archivo de reglas '" . trim((string) ($args['name'] ?? '')) . "'.",
            'archivos_disponibles' => array_column(brain_index($agentKey), 'name'),
        ];
    }

    $st = agents_db()->prepare('SELECT name, content FROM agent_knowledge WHERE id = ?');
    $st->execute([$file['id']]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if (!$row) return ['error' => 'El archivo de reglas ya no existe.'];

    $lines      = explode("\n", (string) $row['content']);
    $totalLines = count($lines);
    $offset     = max(1, (int) ($args['offset'] ?? 1));
    $limit      = (int) ($args['limit'] ?? 0);
    $body       = implode("\n", array_slice($lines, $offset - 1, $limit > 0 ? $limit : null));

    $truncated = false;
    if (mb_strlen($body) > BRAIN_RULES_READ_CAP) {
        $body      = mb_substr($body, 0, BRAIN_RULES_READ_CAP);
        $truncated = true;
    }

    $out = [
        'success'     => true,
        'name'        => $row['name'],
        'total_lines' => $totalLines,
        'offset'      => $offset,
        'content'     => $body,
    ];
    if ($truncated || $offset > 1 || ($limit > 0 && $offset - 1 + $limit < $totalLines)) {
        $out['truncated'] = true;
        $out['note']      = "Lectura parcial de {$totalLines} lineas totales; pide el resto con offset/limit.";
    }
    return $out;
}

/** save_memory: un hecho que sobrevive a la conversacion. */
function brain_save_memory(array $args, $agentKey, $userId) {
    if ((string) $agentKey === '') {
        return ['error' => 'No hay agente en este chat, no se puede guardar memoria.'];
    }

    $content = trim((string) ($args['content'] ?? ''));
    if ($content === '') {
        return ['error' => 'content es requerido: el hecho a recordar, breve y autocontenido.'];
    }
    if (mb_strlen($content) > BRAIN_MEMORY_CHARS) {
        $content = mb_substr($content, 0, BRAIN_MEMORY_CHARS);
    }

    $st = agents_db()->prepare('SELECT COUNT(*) FROM agent_memories WHERE agent_key = ? AND user_id = ?');
    $st->execute([(string) $agentKey, (string) $userId]);
    if ((int) $st->fetchColumn() >= BRAIN_MAX_MEMORIES) {
        return ['error' => 'Limite de ' . BRAIN_MAX_MEMORIES . ' memorias alcanzado. Borra las obsoletas con forget_memory antes de guardar nuevas.'];
    }

    $st = agents_db()->prepare('INSERT INTO agent_memories (agent_key, user_id, content, date_creation) VALUES (?, ?, ?, ?)');
    $st->execute([(string) $agentKey, (string) $userId, $content, date('Y-m-d H:i:s')]);

    return [
        'success' => true,
        'id'      => (int) agents_db()->lastInsertId(),
        'note'    => 'Memoria guardada; estara disponible en futuras conversaciones.',
    ];
}

/** forget_memory: borra por id, con agente+usuario en el WHERE (nadie borra ajenas). */
function brain_forget_memory(array $args, $agentKey, $userId) {
    $id = (int) ($args['id'] ?? 0);
    if ($id < 1) {
        return ['error' => 'id es requerido: el numero entre corchetes en la seccion "Memoria persistente" de tu prompt.'];
    }

    $st = agents_db()->prepare('DELETE FROM agent_memories WHERE id = ? AND agent_key = ? AND user_id = ?');
    $st->execute([$id, (string) $agentKey, (string) $userId]);
    if ($st->rowCount() < 1) {
        return ['error' => "No existe la memoria [$id] para este agente y usuario."];
    }
    return ['success' => true, 'deleted' => $id];
}

/**
 * write_rule: el agente crea o mejora un archivo PROPIO. Nunca toca los que otro
 * agente le presto — para el son de solo lectura, y su dueno los edita.
 */
function brain_write_rule(array $args, $agentKey) {
    $agent = agents_get_by_key($agentKey);
    if (!$agent) return ['error' => 'No hay agente en este chat, no se pueden escribir reglas.'];

    $name = trim((string) ($args['name'] ?? ''));
    if ($name === '')            return ['error' => 'name es requerido: el archivo a crear o actualizar (ej: CONVENCIONES.md).'];
    if (mb_strlen($name) > 100)  return ['error' => 'El nombre no puede exceder 100 caracteres.'];

    $content = (string) ($args['content'] ?? '');
    if (trim($content) === '')   return ['error' => 'content es requerido: el contenido del archivo de reglas.'];

    $description = mb_substr(trim((string) ($args['description'] ?? '')), 0, 255);
    $mode        = mb_strtolower(trim((string) ($args['mode'] ?? 'overwrite'))) === 'append' ? 'append' : 'overwrite';
    $now         = date('Y-m-d H:i:s');

    $st = agents_db()->prepare('SELECT id, name, content FROM agent_knowledge WHERE agent_id = ? AND LOWER(name) = LOWER(?)');
    $st->execute([$agent['id'], $name]);
    $existing = $st->fetch(PDO::FETCH_ASSOC);

    if ($existing && $mode === 'append') {
        $content = rtrim((string) $existing['content']) . "\n" . $content;
    }
    if (mb_strlen($content) > BRAIN_RULE_WRITE_CAP) {
        return ['error' => 'El contenido resultante supera los ' . BRAIN_RULE_WRITE_CAP . ' caracteres. Resumelo o divide en varios archivos.'];
    }

    if ($existing) {
        if ($description !== '') {
            $st = agents_db()->prepare('UPDATE agent_knowledge SET content = ?, description = ?, date_update = ? WHERE id = ?');
            $st->execute([$content, $description, $now, $existing['id']]);
        } else {
            $st = agents_db()->prepare('UPDATE agent_knowledge SET content = ?, date_update = ? WHERE id = ?');
            $st->execute([$content, $now, $existing['id']]);
        }
        return [
            'success' => true,
            'action'  => $mode === 'append' ? 'appended' : 'updated',
            'name'    => $existing['name'],
            'chars'   => mb_strlen($content),
            'note'    => 'Archivo actualizado; su nuevo contenido esta disponible con read_rules desde el proximo turno.',
        ];
    }

    $st = agents_db()->prepare('
        INSERT INTO agent_knowledge (name, description, content, priority, active, date_creation, date_update, agent_id)
        VALUES (?, ?, ?, "medium", 1, ?, ?, ?)
    ');
    $st->execute([$name, $description, $content, $now, $now, $agent['id']]);

    return [
        'success' => true,
        'action'  => 'created',
        'name'    => $name,
        'chars'   => mb_strlen($content),
        'note'    => 'Archivo creado; aparecera en el indice de tu prompt desde el proximo turno.',
    ];
}

/** Despacho unico para tools_run(). Devuelve el array; el registry lo serializa. */
function brain_run_tool($name, array $args, $agentKey, $userId) {
    switch ($name) {
        case 'read_rules':    return brain_read_rules($args, $agentKey);
        case 'save_memory':   return brain_save_memory($args, $agentKey, $userId);
        case 'forget_memory': return brain_forget_memory($args, $agentKey, $userId);
        case 'write_rule':    return brain_write_rule($args, $agentKey);
    }
    return ['error' => 'Herramienta de cerebro desconocida: ' . $name];
}

/** Recorte para las lineas del indice: una frase, no un parrafo. */
function brain_trim($text, $max) {
    $text = trim(preg_replace('/\s+/u', ' ', (string) $text));
    return mb_strlen($text) > $max ? mb_substr($text, 0, $max - 1) . '…' : $text;
}

/** Etiqueta legible del estado mientras corre (la muestra el chat en vivo). */
function brain_tool_label($name, array $args) {
    switch ($name) {
        case 'read_rules':    return 'leyendo ' . (isset($args['name']) ? $args['name'] : 'sus reglas');
        case 'save_memory':   return 'guardando una memoria';
        case 'forget_memory': return 'olvidando una memoria';
        case 'write_rule':    return 'escribiendo ' . (isset($args['name']) ? $args['name'] : 'una regla');
    }
    return 'consultando su memoria';
}

// ── Inyeccion al system prompt ──────────────────────────────────────────────

/** ¿Este agente tiene algo que aportar al prompt? Decide si vale abrir el loop. */
function brain_has_context($agentKey, $userId) {
    if ((string) $agentKey === '') return false;
    try {
        if (!empty(brain_index($agentKey))) return true;
        $st = agents_db()->prepare('SELECT COUNT(*) FROM agent_memories WHERE agent_key = ? AND user_id = ?');
        $st->execute([(string) $agentKey, (string) $userId]);
        return (int) $st->fetchColumn() > 0;
    } catch (Throwable $e) {
        return false;
    }
}

/**
 * Bloque que se ANEXA al system prompt cada turno, siempre fresco.
 *
 * $hasReadRules importa: si la tool no esta declarada en este turno, el indice NO se
 * emite. Publicar una lista de archivos que el agente no puede abrir es peor que no
 * tenerla — anuncia un conocimiento inalcanzable y el modelo termina inventando. En su
 * lugar, para un chat sin herramientas se inyectan completas solo las reglas
 * `critical`, que es el comportamiento de antes pero acotado a lo imprescindible.
 */
function brain_prompt_extra($agentKey, $userId, $hasReadRules, $hasMemoryTools) {
    if ((string) $agentKey === '') return '';

    try {
        $extra = '';

        $memories = array_reverse(agents_memories($agentKey, $userId, BRAIN_PROMPT_MEMORIES));
        if (!empty($memories)) {
            $extra .= "\n\n## Memoria persistente\nHechos guardados en conversaciones anteriores con este usuario:\n";
            foreach ($memories as $m) {
                $extra .= '- [' . $m['id'] . '] ' . $m['content'] . "\n";
            }
            if ($hasMemoryTools) {
                $extra .= "Guarda hechos nuevos importantes con save_memory (preferencias, decisiones, datos del proyecto); borra los obsoletos con forget_memory usando el id entre corchetes.";
            }
        } elseif ($hasMemoryTools) {
            $extra .= "\n\n## Memoria persistente\nAun no hay memorias guardadas. Cuando el usuario comparta un hecho que sirva en futuras conversaciones (preferencias, decisiones, datos del proyecto), guardalo con save_memory. No guardes trivialidades.";
        }

        $index = brain_index($agentKey);
        if (empty($index)) return $extra;

        if ($hasReadRules) {
            $extra .= "\n\n## Archivos de reglas (leelos con read_rules)\n";
            foreach ($index as $f) {
                $line = '- ' . $f['name'];
                // La descripcion se recorta: varios .md traen un frontmatter de parrafo
                // entero y el indice dejaria de ser ligero, que es todo su proposito.
                if ($f['description'] !== '') $line .= ' — ' . brain_trim($f['description'], 120);
                if ($f['when_to_use'] !== '') $line .= ' · cuando: ' . brain_trim($f['when_to_use'], 120);
                $extra .= $line . "\n";
            }
            $extra .= "Antes de escribir o modificar codigo regulado por alguno de estos archivos, leelo con read_rules (solo el que necesites). Sus convenciones son OBLIGATORIAS y tienen prioridad sobre tu criterio.";
            return $extra;
        }

        // Sin read_rules en este turno: solo lo critico, y completo.
        $critical = [];
        foreach ($index as $f) {
            if ($f['priority'] === 'critical') $critical[] = $f;
        }
        if (empty($critical)) return $extra;

        foreach ($critical as $f) {
            $st = agents_db()->prepare('SELECT content FROM agent_knowledge WHERE id = ?');
            $st->execute([$f['id']]);
            $content = (string) $st->fetchColumn();
            if (trim($content) === '') continue;
            $extra .= "\n\n## Reglas obligatorias — " . $f['name'] . "\n" . $content . "\n";
        }
        return $extra;
    } catch (Throwable $e) {
        return '';   // el cerebro nunca debe tumbar un turno de chat
    }
}
