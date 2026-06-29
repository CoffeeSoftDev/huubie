<?php
    session_start();
    // Verifica si la sesión está iniciada
    if (!isset($_SESSION['USR'])) {
        // Redirige al login si no esta autenticado
        header('Location: /app/');
        exit();
    }

    define('PATH_BASE', '/app/');
    define('PATH_ACCESS', '/app/access/');
    define('PATH_MENU', '/app/');
    define('PATH_ADMIN', '/app/admin/');
    define('PATH_PEDIDOS', '/app/pedidos/');

?>