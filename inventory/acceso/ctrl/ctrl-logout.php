<?php
    // Sesión de 8 horas, propia de inventory: ver conf/_Session.php.
    require_once __DIR__ . '/../../conf/_Session.php';
    require_once __DIR__ . '/../../conf/_Auditoria.php';

    /*  CERRAR SESIÓN ES BORRAR LA DEL SERVIDOR. Antes solo se limpiaban las
        cookies y el localStorage: la sesión (INVSESSID) seguía viva sus 8 horas
        y cualquiera en ese navegador volvía a entrar abriendo modulos/.
        La bitácora va antes de borrarla: después ya no se sabe quién era. */
    if (!empty($_SESSION['IDU'])) {
        Auditoria::registrar('cerrar-sesion', 'sesion', (int) $_SESSION['IDU'], $_SESSION['user'] ?? '');
    }

    $_SESSION = [];
    session_destroy();
    setcookie(session_name(), '', time() - 3600, '/');

    setcookie("IDU", "", time() - 3600, "/");
    setcookie("IDP", "", time() - 3600, "/");

    /*  A dónde se vuelve: el login sale de la ruta REAL de este archivo
        (.../inventory/acceso/ctrl/ctrl-logout.php -> .../inventory/) y no
        escrita a mano, así funciona igual servido en /inventory/ que en
        /huubie/inventory/. SCRIPT_NAME apunta al archivo aunque se haya
        llegado por /salir, que es una reescritura interna.  */
    $login = rtrim(str_replace('\\', '/', dirname(dirname(dirname($_SERVER['SCRIPT_NAME'])))), '/') . '/';

    echo "<script>
            // El usuario recordado sobrevive al logout: cerrar sesión no es
            // 'no soy yo'. La llave es la misma de acceso/src/js/index.js.
            const REMEMBER_KEY = 'inventory:login:remember:v1';
            const recordado = localStorage.getItem(REMEMBER_KEY);

            localStorage.clear();
            sessionStorage.clear();

            if (recordado) localStorage.setItem(REMEMBER_KEY, recordado);

            window.location.href = " . json_encode($login) . ";
    </script>";
?>
