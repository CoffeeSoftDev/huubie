<?php
    session_start();
    // Verifica si la sesión está iniciada
    if (!isset($_SESSION['USR'])) {
        // Redirige al login si no está autenticado
        header('Location: /alpha/');
        exit();
    }

    define('PATH_BASE', '/coffee/');
    define('PATH_ACCESS', '/coffee/access/');
    define('PATH_MENU', '/coffee/');
    define('PATH_ADMIN', '/coffee/admin/');

?>