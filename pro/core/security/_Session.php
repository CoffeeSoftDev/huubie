<?php
/*  SESION DE PRO: 8 HORAS SIN USO, O 30 DIAS SI SE RECUERDA EL EQUIPO.

    Toda entrada de pro/ (paginas y ctrl) arranca la sesion con este archivo y
    no con un session_start() suelto. Es el mismo arreglo de
    inventory/conf/_Session.php, por los mismos tres huecos:

    1. Carpeta propia (pro/sessions). En WAMP todas las apps guardan en
       c:/wamp64/tmp, y el recolector de alpha/ o app/ borra con SU limite de
       24 minutos aunque aqui digamos 8 horas.
    2. Cookie propia (HUUBIESESSID). Con PHPSESSID, pro/ compartiria la sesion
       con alpha/ y app/: cerrar sesion alla sacaria de aqui.
    3. La cookie se renueva en cada peticion. PHP solo la manda cuando nace la
       sesion, y caducaria 8 h despues de entrar aunque se siguiera trabajando.

    El recolector borra por la edad del archivo sin saber de quien es, asi que
    a todas se les da el plazo largo y el corto lo hace cumplir start() con
    $_SESSION['_last']. */

class Session {
    const NAME         = 'HUUBIESESSID';
    const TTL          = 28800;    // 8 horas
    const TTL_REMEMBER = 2592000;  // 30 dias: "Recordar mi usuario en este equipo"

    static function start() {
        if (session_status() !== PHP_SESSION_NONE) return;

        $dir = dirname(__DIR__, 2) . '/sessions';

        // Sin carpeta propia se queda la del servidor: mejor una sesion corta
        // que un login roto. En la propia nadie mas limpia, y cPanel trae el
        // recolector apagado.
        if (is_dir($dir) && is_writable($dir)) {
            session_save_path($dir);
            ini_set('session.gc_probability', 1);
            ini_set('session.gc_divisor', 100);
        }

        ini_set('session.gc_maxlifetime', self::TTL_REMEMBER);
        session_name(self::NAME);
        session_set_cookie_params(['lifetime' => self::TTL] + self::cookieParams());
        session_start();

        if (isset($_COOKIE[self::NAME])) {
            $last = (int) ($_SESSION['_last'] ?? 0);

            if ($last > 0 && time() - $last > self::ttl()) $_SESSION = [];

            $_SESSION['_last'] = time();
            self::sendCookie();
        }
    }

    // Lo llama el login despues de session_regenerate_id().
    static function remember($recordar) {
        $_SESSION['_ttl']  = $recordar ? self::TTL_REMEMBER : self::TTL;
        $_SESSION['_last'] = time();
        self::sendCookie();
    }

    static function user() {
        return empty($_SESSION['user_id']) ? null : (int) $_SESSION['user_id'];
    }

    static function destroy() {
        $_SESSION = [];
        session_destroy();
        setcookie(self::NAME, '', ['expires' => time() - 3600] + self::cookieParams());
    }

    private static function ttl() {
        return (int) ($_SESSION['_ttl'] ?? 0) === self::TTL_REMEMBER ? self::TTL_REMEMBER : self::TTL;
    }

    private static function sendCookie() {
        setcookie(session_name(), session_id(), ['expires' => time() + self::ttl()] + self::cookieParams());
    }

    private static function cookieParams() {
        return [
            'path'     => '/',
            'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            'httponly' => true,
            'samesite' => 'Lax',
        ];
    }
}

Session::start();
