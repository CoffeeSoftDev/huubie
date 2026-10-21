<?php
/*  SESION DE INVENTORY: 8 HORAS DE INACTIVIDAD, Y SOLO DE INVENTORY.

    Toda entrada de inventory/ (paginas y ctrl) arranca la sesion por aqui y no
    con un session_start() suelto. Lo suelto la dejaba en ~24 minutos por tres
    huecos:

    1. Carpeta compartida. Todas las apps de WAMP guardan sesiones en la misma
       carpeta (c:/wamp64/tmp). Cualquier peticion de alpha/, app/ o coffee/
       puede correr el recolector con SU limite (1440 s = 24 min) y borra las
       sesiones de inventory aunque aqui digamos 8 horas. En cPanel, ademas, un
       cron limpia la carpeta comun con el limite del php.ini e ignora ini_set.
       Por eso inventory guarda las suyas en inventory/sessions.
    2. Cookie compartida. Con PHPSESSID, inventory usaba la MISMA sesion que
       alpha/ y app/ en el mismo dominio: cerrar sesion alla (session_destroy)
       sacaba tambien de aqui. INVSESSID la separa.
    3. Cookie que no se renovaba. PHP manda la cookie solo cuando nace la
       sesion, asi que caducaba 8 h despues de la primera visita aunque el
       usuario siguiera trabajando. Aqui se renueva en cada peticion.

    Si inventory/sessions no existe o no se puede escribir, se queda la carpeta
    del servidor: mejor una sesion corta que un login roto.

    RECORDAR ESTE EQUIPO: si en el login se deja marcada la casilla, esa sesion
    dura 30 dias sin uso en vez de 8 horas (lo guarda invSessionRecordar() en
    $_SESSION['_inv_ttl']). El recolector borra por la edad del archivo y no sabe
    de que sesion es cada uno, asi que se le da el plazo largo a todas y el corto
    lo hace cumplir este archivo con $_SESSION['_inv_last']: una sesion de 8 h
    que pasa ese tiempo sin uso se vacia aqui aunque su archivo siga en disco. */

const INV_SESSION_TTL          = 28800;    // 8 horas
const INV_SESSION_TTL_REMEMBER = 2592000;  // 30 dias: "Recordar mi usuario en este equipo"

// Plazo de ESTA sesion: el largo solo si el login lo pidio.
function invSessionTtl() {
    return (int) ($_SESSION['_inv_ttl'] ?? 0) === INV_SESSION_TTL_REMEMBER
         ? INV_SESSION_TTL_REMEMBER
         : INV_SESSION_TTL;
}

// Cookie con el plazo completo de la sesion, contado desde ahora.
function invSessionCookie() {
    setcookie(session_name(), session_id(), [
        'expires'  => time() + invSessionTtl(),
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

// La llama login() despues de session_regenerate_id(): fija el plazo y reenvia la cookie.
function invSessionRecordar($recordar) {
    $_SESSION['_inv_ttl']  = $recordar ? INV_SESSION_TTL_REMEMBER : INV_SESSION_TTL;
    $_SESSION['_inv_last'] = time();
    invSessionCookie();
}

if (session_status() === PHP_SESSION_NONE) {
    $invSessionDir = dirname(__DIR__) . '/sessions';

    if (is_dir($invSessionDir) && is_writable($invSessionDir)) {
        session_save_path($invSessionDir);

        // En la carpeta propia nadie mas limpia: el recolector de PHP tiene que
        // correr aunque el hosting lo traiga apagado (cPanel pone 0).
        ini_set('session.gc_probability', 1);
        ini_set('session.gc_divisor', 100);
    }

    ini_set('session.gc_maxlifetime', INV_SESSION_TTL_REMEMBER);
    session_name('INVSESSID');
    session_set_cookie_params([
        'lifetime' => INV_SESSION_TTL,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();

    // Sesion que ya venia en la cookie: vencida se vacia (los ctrl la ven como
    // sin login); viva se le vuelve a dar su plazo completo.
    if (isset($_COOKIE[session_name()])) {
        $invLast = (int) ($_SESSION['_inv_last'] ?? 0);

        if ($invLast > 0 && time() - $invLast > invSessionTtl()) {
            $_SESSION = [];
        }

        $_SESSION['_inv_last'] = time();
        invSessionCookie();
    }
}
