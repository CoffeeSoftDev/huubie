<?php
/*  Recuperar contraseña: tres pasos en una sola pagina, sin recargar.

        1. tu correo      -> forgotPassword()  manda un codigo de 6 digitos
        2. el codigo      -> verifyCode()      solo abre el paso 3
        3. la contraseña  -> resetPassword()   la escribe, dos veces

    La logica esta en auth/src/js/recuperar.js y auth/ctrl/ctrl-auth.php. Los
    tres pasos viven aqui para que la cuenta y el codigo se queden en memoria
    del navegador y no pasen por la URL (historial, logs de Apache, Referer).

    LOS id SON EL CONTRATO con recuperar.js. */
$version = function ($file) {
    return filemtime(__DIR__ . '/' . $file);
};
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Huubie · Recuperar contraseña</title>
    <link rel="icon" href="assets/img/huubie192.png" type="image/png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/plugins/fontello/css/fontello.css">
    <link rel="stylesheet" href="auth/src/css/auth.css?v=<?= $version('auth/src/css/auth.css') ?>">
</head>

<body class="login-body">

    <header class="login-top reveal" style="--i:0">
        <a class="login-wordmark" href="index.php">
            <span class="login-mark sm" aria-hidden="true"><img src="assets/img/huubie.png" alt=""></span>
            Huubie
        </a>
    </header>

    <main class="login-shell">

        <div class="login-card reveal" style="--i:1">

            <span class="login-mark reveal" style="--i:2" aria-hidden="true"><img src="assets/img/huubie.png" alt=""></span>

            <h1 class="login-title reveal" style="--i:3">Recuperar contraseña</h1>

            <div id="steps" class="steps reveal" style="--i:4">
                <span class="step on"></span>
                <span class="step"></span>
                <span class="step"></span>
            </div>

            <div id="notice" class="notice hide" role="status"></div>

            <!-- Paso 1 :: tu correo -->
            <form id="form-email" class="login-form reveal" style="--i:5" novalidate>
                <p class="step-text">
                    Escribe el correo con el que entras. Te enviamos un código
                    para que puedas elegir una contraseña nueva.
                </p>

                <div class="field">
                    <label class="field-label" for="email">Correo electrónico</label>
                    <input type="email" class="field-input" id="email" placeholder="nombre@empresa.com" autocomplete="username" required>
                </div>

                <button type="submit" id="btn-send" class="btn-continue">Enviar código</button>
            </form>

            <!-- Paso 2 :: el codigo -->
            <form id="form-code" class="login-form hide" novalidate>
                <p class="step-text">
                    Escribe el código de 6 dígitos que te enviamos a
                    <span id="email-echo"></span>.
                </p>

                <div class="field">
                    <label class="field-label" for="code">Código</label>
                    <!-- one-time-code: el teclado del telefono ofrece pegarlo en cuanto llega. -->
                    <input type="text" class="field-input field-code" id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" required>
                </div>

                <button type="submit" id="btn-code" class="btn-continue">Continuar</button>
                <button type="button" id="btn-resend" class="btn-ghost">¿No te llegó? Enviar otro código</button>
            </form>

            <!-- Paso 3 :: la contraseña nueva -->
            <form id="form-password" class="login-form hide" novalidate>
                <p class="step-text">
                    Elige tu contraseña nueva. Escríbela dos veces para
                    asegurarnos de que quedó como querías.
                </p>

                <div class="field">
                    <label class="field-label" for="password">Contraseña nueva</label>
                    <div class="control">
                        <input type="password" class="field-input has-eye" id="password" autocomplete="new-password" required>
                        <button type="button" id="btn-eye" class="eye-btn" aria-label="Mostrar contraseña"><i class="icon-eye"></i></button>
                    </div>
                </div>

                <div class="field">
                    <label class="field-label" for="confirm">Repite la contraseña</label>
                    <input type="password" class="field-input" id="confirm" autocomplete="new-password" required>
                </div>

                <button type="submit" id="btn-password" class="btn-continue">Guardar contraseña</button>
            </form>

            <!-- Final -->
            <div id="step-done" class="login-form hide">
                <a href="index.php" class="btn-continue">
                    <span>Iniciar sesión</span>
                    <i class="icon-right btn-arrow"></i>
                </a>
            </div>

            <div class="card-foot">¿Ya la recordaste? <a href="index.php">Volver a iniciar sesión</a></div>
        </div>
    </main>

    <p class="login-footer reveal" style="--i:6">&copy; <?= date('Y') ?> Huubie</p>

    <script src="assets/plugins/jquery/jquery-3.7.0.min.js"></script>
    <script src="auth/src/js/recuperar.js?v=<?= $version('auth/src/js/recuperar.js') ?>"></script>
</body>

</html>
