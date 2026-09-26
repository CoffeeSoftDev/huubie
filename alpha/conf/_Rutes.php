<?php
    session_start();
    // Verifica si la sesión está iniciada
    if (!isset($_SESSION['USR'])) {
        // Redirige al login si no está autenticado
        header('Location: /alpha/');
        exit();
    }

    // Produccion (rol 8) solo entra al calendario de pedidos: cualquier otra pantalla,
    // el hub incluido, lo regresa ahi. Los controladores cierran las escrituras aparte.
    if (($_SESSION['ROLID'] ?? 0) == 8 && strpos($_SERVER['SCRIPT_NAME'], '/pedidos/calendario/') === false) {
        header('Location: /alpha/pedidos/calendario/');
        exit();
    }

    define('PATH_BASE', '/alpha/');
    define('PATH_ACCESS', '/alpha/access/');
    define('PATH_MENU', '/alpha/menus/');
    define('PATH_EVENTOS', '/alpha/eventos/');
    define('PATH_PEDIDOS', '/alpha/pedidos/');
    define('PATH_PEDIDOS2', '/alpha/pedidos-2/');
    define('PATH_PEDIDOS3', '/alpha/pedidos3/');
    define('PATH_ADMIN', '/alpha/admin/');
    define('PATH_RESERVACIONES', '/dev/reservaciones/');
    define('PATH_RRHH', '/alpha/rrhh/');
    define('PATH_FINANZAS', '/alpha/finanzas/');
    define('PATH_RRHH3', '/alpha/rrhh3/');

?>