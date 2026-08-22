<?php

// Puerta de entrada del Facturador 2.
//
// Mismo papel que app/facture/conf/_Rutes.php: arranca la sesion, exige usuario y
// define las rutas base. Vive aparte y no lo comparte con facture porque el
// permiso es de este modulo; tocar el guard del otro abriria tambien aquel.
//
// El modulo esta en fase maqueta: no consulta base de datos y no escribe nada, asi
// que en local siembra una sesion minima para poder abrirlo sin pasar por el login
// de /app/. Fuera de local exige sesion real y manda al login de Huubie.

session_start();

// Hosts de trabajo local. Agregar un vhost es sumarlo a esta lista, no tocar la
// logica de abajo.
define('WANSOFT_LOCAL_HOSTS', [
    'localhost',
    '127.0.0.1',
    '::1',
    'www.cs-huubie.com',
    'cs-huubie.com'
]);

function wansoftDevPermitido() {
    $host = explode(':', $_SERVER['HTTP_HOST'] ?? '')[0];

    return in_array($host, WANSOFT_LOCAL_HOSTS, true);
}

// Dos candados, y basta con que uno cierre para que no se siembre nada: solo si no
// hay sesion —una sesion real de Huubie nunca se pisa— y solo en local.
if (!isset($_SESSION['USR']) && wansoftDevPermitido()) {
    $_SESSION['USR']          = 1;
    $_SESSION['NAME']         = 'Pruebas';
    $_SESSION['ROL']          = 'Terminal';
    $_SESSION['WANSOFT_DEV']  = true;
}

if (!isset($_SESSION['USR'])) {
    header('Location: /app/');
    exit();
}

// Las mismas constantes que define el guard de Huubie: el modulo las hereda para
// que los enlaces al resto del sistema sigan funcionando desde aqui.
define('PATH_BASE',      '/app/');
define('PATH_ACCESS',    '/app/access/');
define('PATH_MENU',      '/app/');
define('PATH_FACTURE',   '/app/facture/');
define('PATH_FACTURE2',  '/app/facture2/');
