<?php
/**
 * Catalogo para el autocompletado "@" del chat: BASES DE DATOS y CARPETAS
 * disponibles para conectar. Solo devuelve METADATOS (nombres y rutas), nunca
 * contenido de archivos ni filas: el acceso real sigue pasando por las tools
 * (run_select / list_dir / read_file), con sus mismos limites y whitelist.
 *
 * De las carpetas se manda la ruta ABSOLUTA. Al elegir una en el menu, la
 * conexion viaja exacta (fs_resolve_folder acepta rutas absolutas dentro de
 * FS_ALLOWED_ROOTS), asi que no hay ambiguedad por carpetas homonimas.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/db-config.php';
require_once __DIR__ . '/db-introspect.php';
require_once __DIR__ . '/fs-config.php';
require_once __DIR__ . '/fs-introspect.php';

$out = ['success' => true, 'dbs' => [], 'folders' => []];

// ── Bases de datos (sin las de sistema; respeta DB_ALLOWED_SCHEMAS) ──
try {
    $out['dbs'] = array_values(db_list_schemas());
} catch (Throwable $e) {
    $out['dbs'] = [];
    $out['dbs_error'] = $e->getMessage();   // p.ej. MySQL apagado: el menu sigue con carpetas
}

// ── Carpetas dentro de las raices permitidas (FS_ALLOWED_ROOTS) ──
// El indice trae miles de carpetas, asi que el payload va COMPACTO: la raiz se
// manda una vez en `roots` y cada carpeta solo lleva su indice de raiz (r) y su
// ruta relativa (p). El cliente reconstruye la ruta absoluta: roots[r] + '/' + p.
define('MENTIONS_MAX_FOLDERS', 4000);
try {
    $roots = fs_allowed_roots();
    $rootIdx = array_flip($roots);

    $folders = [];
    foreach (fs_folder_index() as $paths) {
        foreach ($paths as $p) {
            $rel = fs_rel_to_root($p);
            // A que raiz pertenece (con varias raices en la whitelist).
            $r = 0;
            foreach ($roots as $i => $root) {
                if ($p === $root || strpos($p . '/', $root . '/') === 0) { $r = $i; break; }
            }
            $folders[] = ['r' => $r, 'p' => $rel];
        }
    }
    // Las carpetas mas superficiales primero (suelen ser las que se buscan).
    usort($folders, function ($a, $b) {
        $da = substr_count($a['p'], '/');
        $db = substr_count($b['p'], '/');
        if ($da !== $db) return $da <=> $db;
        return strcasecmp($a['p'], $b['p']);
    });

    $out['roots']     = array_values($roots);
    $out['truncated'] = count($folders) > MENTIONS_MAX_FOLDERS;
    $out['folders']   = array_slice($folders, 0, MENTIONS_MAX_FOLDERS);
} catch (Throwable $e) {
    $out['folders'] = [];
    $out['folders_error'] = $e->getMessage();
}

echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
