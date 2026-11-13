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
                <!-- El punto rojo es el punto final de la oracion y la sonrisa pasa
                     por debajo de "pronto": juntos son la sonrisa del logo, con sus
                     mismas formas. Primero se dibuja el arco, despues brota el punto. -->
                <h1 class="bye-title">Nos vemos <span class="bye-word">pronto<span class="smile-anchor" aria-hidden="true"><svg class="smile" viewBox="108 362 482 198"><defs><clipPath id="smileShape"><path d="M504.44 450.19L490.93 464.43C480.63 475.28 467.84 484.73 455.25 492.75C361.85 552.22 221.64 539.12 149.42 451.84L113.74 451.84L128.16 469.33C145.43 490.28 173.15 512.76 197.01 525.49C209.72 532.27 223.36 537.14 237.08 541.44C288.13 557.42 342.19 561.41 394.25 547.7C446.21 534.02 492.62 503.26 527.29 462.58L504.44 450.19Z" /></clipPath></defs><g clip-path="url(#smileShape)"><path class="smile-arc" pathLength="1" d="M112.08 429.7A256.9 256.9 0 0 0 530.23 440.65" /></g><circle class="smile-dot" cx="545.9" cy="406.5" r="41.4" /></svg></span></span></h1>

                <p class="bye-sub">Cerraste tu sesión de forma segura.</p>
            </div>
        </main>

        <!-- Marca: logo vectorial, sin el aro del punto -->
        <aside class="auth-hero reveal" style="--i:1" aria-hidden="true">
            <img class="brand-logo on-light" src="assets/img/huubie-vector.svg" alt="">
            <img class="brand-logo on-dark" src="assets/img/huubie-vector-dark.svg" alt="">
        </aside>
    </div>

    <script>
        // replace(): "Atras" no regresa a la despedida.
        setTimeout(function () { window.location.replace('index.php'); }, 2600);
    </script>
</body>

</html>
