<?php
    session_start();
    // Verifica si la sesión está iniciada
    if (!isset($_SESSION['USR'])) {
        // Redirige al login si no está autenticado
        header('Location: /alpha/');
        exit();
    }

    define('PATH_BASE', '/alpha/');
    define('PATH_ACCESS', '/alpha/access/');
    define('PATH_MENU', '/alpha/menus/');
    define('PATH_EVENTOS', '/alpha/eventos/');
    define('PATH_PEDIDOS', '/alpha/pedidos/');
    define('PATH_ADMIN', '/alpha/admin/');
    define('PATH_RESERVACIONES', '/dev/reservaciones/');
    
?>