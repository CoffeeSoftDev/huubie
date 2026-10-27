<?php

// Puerta de entrada del Facturador.
//
// Es el gemelo de app/conf/_Rutes.php y hace lo mismo que el —arranca la sesion,
// exige usuario y define las rutas base—, con una diferencia: en local siembra
// una sesion de desarrollo para que el modulo se abra sin pasar por el login de
// /app/. Fuera de local se comporta igual que el original y manda al login.
//
// Vive aparte y no dentro de app/conf/ porque el permiso es del Facturador, no
// de Huubie: tocar el guard comun abriria tambien el resto de los modulos.

session_start();

require_once __DIR__ . '/dev-session.php';

// Entrada automatica con el perfil por defecto. Con FACTURE_DEV_AUTO en false no
// siembra nada y la peticion cae en el login de abajo.
factureSesionDev();

if (!isset($_SESSION['USR'])) {
    if (!factureDevPermitido()) {
        // Fuera de local se sale al login de Huubie, igual que cualquier otro
        // modulo.
        header('Location: /app/');
        exit();
    }

    // La pagina que se pedia viaja con el redirect: elegir perfil devuelve ahi y
    // no al inicio, que es lo que se espera al abrir un enlace directo.
    header('Location: /app/facture/login.php?ir=' . urlencode($_SERVER['REQUEST_URI'] ?? ''));
    exit();
}

// La sesion sembrada se anuncia en pantalla. Una sesion falsa invisible es peor
// que no tenerla: el modulo se veria identico al de un usuario real y cualquiera
// creeria que esta viendo sus propios datos.
if (!empty($_SESSION['FACTURE_DEV'])) ob_start('factureDevRibbon');

// Las mismas constantes que define el guard de Huubie: el modulo las hereda para
// que los enlaces al resto del sistema seguen funcionando desde aqui.
define('PATH_BASE',    '/app/');
define('PATH_ACCESS',  '/app/access/');
define('PATH_MENU',    '/app/');
define('PATH_ADMIN',   '/app/admin/');
define('PATH_PEDIDOS', '/app/pedidos/');
define('PATH_FACTURE', '/app/facture/');
