<?php
// Raices de la biblioteca de documentos, compartidas por los endpoints del visor.
// Vive aparte de ctrl-visor.php porque ese archivo despacha acciones al incluirse:
// cualquier otro ctrl que necesite saber donde vive la biblioteca de un usuario
// requiere ESTE archivo, no aquel.
require_once __DIR__ . '/../../ctrl/auth-session.php';

// ── Biblioteca POR USUARIO ──────────────────────────────────────────────────
// Cada cuenta tiene su propio arbol en documents/users/<id>/ y el visor solo
// lista y escribe dentro de esa carpeta: nadie ve ni toca los documentos de
// otro. Las carpetas de sistema (template/, module-template/, chats/) siguen
// colgando de documents/ porque no pertenecen a ningun usuario — las gestionan
// el Playground y el Forge con sus propios endpoints.
if (!function_exists('coffee_visor_documents_base')) {
    function coffee_visor_documents_base() {
        return rtrim(str_replace('\\', '/', __DIR__ . '/../documents'), '/');
    }
}

// Identidad de la carpeta: el id numerico de la sesion. Sin sesion iniciada se
// cae a "_guest" en vez de a la raiz compartida, para que una peticion sin
// cookie nunca alcance los documentos de una cuenta real.
if (!function_exists('coffee_visor_user_key')) {
    function coffee_visor_user_key() {
        $id = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : 0;
        return $id > 0 ? (string) $id : '_guest';
    }
}

// Raiz de documentos del usuario en curso. Se crea al vuelo: una cuenta nueva
// entra al visor con su carpeta vacia, sin paso de alta manual.
if (!function_exists('coffee_visor_docs_root')) {
    function coffee_visor_docs_root() {
        $root = coffee_visor_documents_base() . '/users/' . coffee_visor_user_key();
        if (!is_dir($root)) @mkdir($root, 0775, true);
        return $root;
    }
}

// Prefijo de los relPath que se exponen al frontend (clave de los iconos por
// archivo en data/icons.json).
if (!function_exists('coffee_visor_docs_rel_prefix')) {
    function coffee_visor_docs_rel_prefix() {
        return 'coffee/app/visor/documents/users/' . coffee_visor_user_key();
    }
}

// ── Carpeta compartida ──────────────────────────────────────────────────────
// documents/shared/ es el terreno comun: cuelga del arbol de TODOS los usuarios
// como un proyecto mas (en celeste, para que no se confunda con los propios) y
// todos pueden leer y escribir en ella. No vive dentro de ninguna biblioteca:
// es una raiz aparte que el sandbox autoriza explicitamente.
if (!function_exists('coffee_visor_shared_name')) {
    function coffee_visor_shared_name() {
        return 'Compartido';
    }
}

if (!function_exists('coffee_visor_shared_root')) {
    function coffee_visor_shared_root() {
        $root = coffee_visor_documents_base() . '/shared';
        if (!is_dir($root)) @mkdir($root, 0775, true);
        return $root;
    }
}

if (!function_exists('coffee_visor_shared_rel_prefix')) {
    function coffee_visor_shared_rel_prefix() {
        return 'coffee/app/visor/documents/shared';
    }
}
