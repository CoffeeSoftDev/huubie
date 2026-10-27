<?php

// Puerta de entrada de la terminal Wansoft.
//
// Arranca la sesion y define las rutas base. No exige el login de Huubie
// ($_SESSION['USR']): la puerta de la terminal es su PIN (wansoftExige en las
// paginas, terminalExige y opcPermitida en los controladores). Quien cobra no
// tiene por que tener cuenta en el ERP, y exigirla mandaba al login de /app/ en
// cualquier servidor que no fuera local.

session_start();

// Las mismas constantes que define el guard de Huubie: el modulo las hereda para
// que los enlaces al resto del sistema sigan funcionando desde aqui.
define('PATH_BASE',      '/app/');
define('PATH_ACCESS',    '/app/access/');
define('PATH_MENU',      '/app/');
define('PATH_FACTURE',   '/app/facture/');
define('PATH_WANSOFT',   '/app/wansoft/');

// -- Sesion de la terminal --
//
// Encima de la sesion de Huubie la terminal tiene la suya: quien tecleo su PIN en
// la pantalla de acceso (login en ctrl-facture2-pos.php). Cada pagina declara que
// permiso pide con wansoftExige() justo despues de incluir este archivo; sin
// argumento solo pide que haya alguien adentro.

function wansoftPuede($permiso) {
    return in_array($permiso, $_SESSION['WANSOFT_PERMS'] ?? [], true);
}

// Sin sesion de terminal se vuelve al acceso; con sesion pero sin el permiso, al
// menu, que es donde se ve con candado lo que el rol no tiene.
function wansoftExige($permiso = null) {
    if (empty($_SESSION['WANSOFT_USER'])) {
        header('Location: ' . PATH_WANSOFT);
        exit();
    }

    if ($permiso && !wansoftPuede($permiso)) {
        header('Location: ' . PATH_WANSOFT . 'inicio.php');
        exit();
    }
}

// La pantalla de acceso es tambien el candado: llegar a ella —por Bloquear, por
// Salir o tecleando la url— cierra la sesion de la terminal. La de Huubie sigue.
function wansoftCierra() {
    unset($_SESSION['WANSOFT_USER'], $_SESSION['WANSOFT_PERMS']);
}
