<?php
require_once __DIR__ . '/core/security/_Session.php';

// Con la sesion viva no tiene caso volver a pedir la contraseña.
if (Session::user() !== null) {
    header('Location: ' . $_SESSION['home']);
    exit;
}

$version = function ($file) {
    return filemtime(__DIR__ . '/' . $file);
};
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Huubie · Iniciar sesión</title>
    <link rel="icon" href="assets/img/huubie192.png" type="image/png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/plugins/fontello/css/fontello.css">
    <link rel="stylesheet" href="auth/src/css/auth.css?v=<?= $version('auth/src/css/auth.css') ?>">
</head>

<body class="login-body">

    <header class="login-top reveal" style="--i:0">
        <span class="login-wordmark">
            <span class="login-mark sm" aria-hidden="true"><img src="assets/img/huubie.png" alt=""></span>
            Huubie
        </span>
    </header>

    <main class="login-shell">

        <div class="login-card reveal" style="--i:1">

            <span class="login-mark reveal" style="--i:2" aria-hidden="true"><img src="assets/img/huubie.png" alt=""></span>

            <h1 class="login-title reveal" style="--i:3">Bienvenido de vuelta</h1>
            <p class="login-sub reveal" style="--i:4">Inicia sesión en tu cuenta de Huubie.</p>

            <form id="login-form" class="login-form" novalidate>

                <div id="login-error" class="login-error" role="alert">
                    <i class="icon-attention-circled"></i>
                    <span id="login-error-text"></span>
                </div>

                <!-- Usuario recordado en ESTE navegador: sustituye al campo de
                     correo y solo queda escribir la contraseña. -->
                <div id="remembered" class="remembered reveal" style="--i:5" hidden>
                    <span id="remembered-avatar" class="remembered-avatar"></span>
                    <span class="remembered-info">
                        <span id="remembered-name" class="remembered-name"></span>
                        <span id="remembered-email" class="remembered-email"></span>
                    </span>
                    <button type="button" id="btn-forget" class="remembered-x" title="Usar otra cuenta">Cambiar</button>
                </div>

                <div id="email-field" class="field reveal" style="--i:5">
                    <label class="field-label" for="email">Correo electrónico</label>
                    <input type="email" class="field-input" id="email" name="email" placeholder="nombre@empresa.com" autocomplete="username" required>
                </div>

                <div class="field reveal" style="--i:6">
                    <label class="field-label" for="password">Contraseña</label>
                    <div class="control">
                        <input type="password" class="field-input has-eye" id="password" name="password" autocomplete="current-password" required>
                        <button type="button" id="btn-eye" class="eye-btn" aria-label="Mostrar contraseña"><i class="icon-eye"></i></button>
                    </div>
                    <span id="caps-hint" class="caps"><i class="icon-attention"></i>Bloq Mayús está activado</span>
                </div>

                <label class="remember-check reveal" style="--i:7">
                    <input type="checkbox" id="remember" checked>
                    <span>Recordar mi usuario en este equipo</span>
                </label>

                <button type="submit" id="btn-login" class="btn-continue reveal" style="--i:8">
                    <span>Continuar</span>
                    <i class="icon-right btn-arrow"></i>
                    <i class="icon-spin6 btn-spin"></i>
                </button>
            </form>

            <div class="card-foot">¿Sin acceso? <b>Pide una cuenta a tu administrador.</b></div>
        </div>

        <p class="login-trust reveal" style="--i:9"><i class="icon-shield"></i>Tu sesión se cierra tras 8 h sin uso, o 30 días si recuerdas este equipo</p>
    </main>

    <p class="login-footer reveal" style="--i:10">&copy; <?= date('Y') ?> Huubie</p>

    <script src="assets/plugins/jquery/jquery-3.7.0.min.js"></script>
    <script src="auth/src/js/auth.js?v=<?= $version('auth/src/js/auth.js') ?>"></script>
</body>

</html>
