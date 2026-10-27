<?php
/*  Cerrar sesion es borrar la del servidor, no solo las cookies: si no, la
    sesion seguiria viva sus 8 horas y cualquiera en ese navegador volveria a
    entrar. El usuario recordado del login (localStorage) se queda. */
require_once __DIR__ . '/core/security/_Session.php';

Session::destroy();

header('Location: index.php');
exit;
