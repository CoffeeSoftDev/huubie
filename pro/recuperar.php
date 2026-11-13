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
    <link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/plugins/fontello/css/fontello.css">
    <link rel="stylesheet" href="auth/src/css/auth.css?v=<?= $version('auth/src/css/auth.css') ?>">
    <!-- Sin defer: pone data-theme antes de pintar (sin parpadeo del tema contrario). -->
    <script src="auth/src/js/theme.js?v=<?= $version('auth/src/js/theme.js') ?>"></script>
</head>

<body class="login-body">

    <div class="theme-switch" role="group" aria-label="Tema de la página">
        <button type="button" data-theme-set="light" aria-pressed="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            Claro
        </button>
        <button type="button" data-theme-set="dark" aria-pressed="false">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            Oscuro
        </button>
    </div>

    <main class="login-shell">

        <div class="login-card reveal" style="--i:1">

            <a class="brand-link reveal" style="--i:2" href="index.php" aria-label="Volver a iniciar sesión">
                <img class="brand-logo on-light" src="assets/img/huubie_light.png" alt="Huubie">
                <img class="brand-logo on-dark" src="assets/img/huubie.png" alt="Huubie">
            </a>

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
