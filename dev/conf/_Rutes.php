<?php
    session_start();
    // Verifica si la sesión está iniciada
    if (!isset($_SESSION['USR'])) {
        // Redirige al login si no está autenticado
        header('Location: /dev/');
        exit();
    }

    define('PATH_BASE', '/dev/');
    define('PATH_ACCESS', '/dev/access/');
    define('PATH_MENU', '/dev/menus/');
    define('PATH_EVENTOS', '/dev/eventos/');
    define('PATH_PEDIDOS', '/dev/pedidos/');
    define('PATH_DASHBOARD', '/dev/dashboard/');
    define('PATH_RESERVACIONES', '/dev/reservaciones/');
    define('PATH_ADMIN', '/dev/admin/');
   


?>
