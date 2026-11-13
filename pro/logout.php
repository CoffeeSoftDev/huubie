<?php
/*  Cerrar sesion es borrar la del servidor, no solo las cookies: si no, la
    sesion seguiria viva sus 8 horas y cualquiera en ese navegador volveria a
    entrar. El usuario recordado del login (localStorage) se queda.

    La sesion se destruye ANTES de pintar nada: la despedida es solo adorno y
    aunque se cierre la pestaña a media animacion ya no hay sesion. Al terminar
    regresa al login. */
require_once __DIR__ . '/core/security/_Session.php';

Session::destroy();

header('Cache-Control: no-store');

$version = function ($file) {
    return filemtime(__DIR__ . '/' . $file);
};
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#FFFFFF">
    <title>Huubie · Nos vemos pronto</title>
    <link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="auth/src/css/auth.css?v=<?= $version('auth/src/css/auth.css') ?>">
    <!-- Sin defer: pone data-theme antes de pintar (sin parpadeo del tema contrario). -->
    <script src="auth/src/js/theme.js?v=<?= $version('auth/src/js/theme.js') ?>"></script>
    <!-- Sin JavaScript tambien se vuelve al login. -->
    <noscript><meta http-equiv="refresh" content="3;url=index.php"></noscript>
</head>

<body class="login-body">
    <div class="auth-split">

        <!-- Despedida -->
        <main class="auth-side bye-side">
            <div class="bye">
                <!-- Como en alpha: el punto rojo es el punto final de la oracion y
                     la sonrisa se dibuja debajo de "pronto"; juntos son la
                     sonrisa del logo. Primero el arco, despues brota el punto. -->
                <h1 class="bye-title">Nos vemos <span class="bye-word">pronto<span class="bye-dot" aria-hidden="true"></span><svg class="bye-smile" viewBox="0 0 200 62" aria-hidden="true"><path class="bye-arc" pathLength="1" d="M9 9 Q 100 92 191 9" /></svg></span></h1>

                <p class="bye-sub">Cerraste tu sesión de forma segura.</p>
            </div>
        </main>

        <!-- Marca -->
        <aside class="auth-hero reveal" style="--i:1" aria-hidden="true">
            <img class="brand-logo on-light" src="assets/img/huubie_light.png" alt="">
            <img class="brand-logo on-dark" src="assets/img/huubie.svg" alt="">
        </aside>
    </div>

    <script>
        // replace(): "Atras" no regresa a la despedida.
        setTimeout(function () { window.location.replace('index.php'); }, 2600);
    </script>
</body>

</html>
