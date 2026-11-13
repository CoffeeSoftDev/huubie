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
    <meta name="theme-color" content="#FFFFFF">
    <link rel="icon" href="assets/img/huubie192.png" type="image/png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/plugins/fontello/css/fontello.css">
    <link rel="stylesheet" href="auth/src/css/auth.css?v=<?= $version('auth/src/css/auth.css') ?>">
    <!-- Sin defer: pone data-theme antes de pintar (sin parpadeo del tema contrario). -->
    <script src="auth/src/js/theme.js?v=<?= $version('auth/src/js/theme.js') ?>"></script>
</head>

<body class="login-body">
    <div class="auth-split">

        <!-- Formulario -->
        <main class="auth-side">
            <div class="auth-box">

                <div class="welcome reveal" style="--i:0">
                    <div>
                        <!-- Los colores de la marca sin repetir el logo: trazo morado bajo
                             "regreso" y el punto cereza, como en la landing. -->
                        <h1 class="welcome-title">Bienvenido de <span class="swoosh">
                                <span>regreso</span></span><span class="welcome-dot">.</span></h1>
                        <p class="welcome-sub">Inicia sesión en tu cuenta de Huubie.</p>
                    </div>
                    <!-- Solo en pantallas chicas, donde el logo grande de la derecha no sale. -->
                    <img class="brand-logo on-light" src="assets/img/huubie-vector.svg" alt="Huubie">
                    <img class="brand-logo on-dark" src="assets/img/huubie-vector-dark.svg" alt="Huubie">
                </div>

                <form id="login-form" class="login-form" novalidate>

                    <div id="login-error" class="login-error" role="alert">
                        <i class="icon-attention-circled"></i>
                        <span id="login-error-text"></span>
                    </div>

                    <div class="field-row reveal" style="--i:1">

                        <div class="field-col">
                            <label class="field-label" for="email">Email</label>

                            <!-- Usuario recordado en ESTE navegador: sustituye al campo de
                                 correo y solo queda escribir la contraseña. -->
                            <div id="remembered" class="remembered" hidden>
                                <span id="remembered-avatar" class="remembered-avatar"></span>
                                <span class="remembered-info">
                                    <span id="remembered-name" class="remembered-name"></span>
                                    <span id="remembered-email" class="remembered-email"></span>
                                </span>
                                <button type="button" id="btn-forget" class="remembered-x" title="Usar otra cuenta">Cambiar</button>
                            </div>

                            <div id="email-field" class="field">
                                <div class="control">
                                    <svg class="control-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    <input type="email" class="field-input has-icon" id="email" name="email" placeholder="nombre@empresa.com" autocomplete="username" required>
                                </div>
                            </div>
                        </div>

                        <div class="field-col">
                            <label class="field-label" for="password">Contraseña</label>
                            <div class="control">
                                <svg class="control-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                <input type="password" class="field-input has-icon has-eye" id="password" name="password" placeholder="••••••••" autocomplete="current-password" required>
                                <button type="button" id="btn-eye" class="eye-btn" aria-label="Mostrar contraseña"><i class="icon-eye"></i></button>
                            </div>
                            <span id="caps-hint" class="caps"><i class="icon-attention"></i>Bloq Mayús está activado</span>
                        </div>
                    </div>

                    <div class="form-meta reveal" style="--i:2">
                        <label class="remember-check">
                            <input type="checkbox" id="remember" checked>
                            <span>Recuerdame</span>
                        </label>
                        <a class="link" href="recuperar.php">¿Olvidaste la contraseña?</a>
                    </div>

                    <button type="submit" id="btn-login" class="btn-continue reveal" style="--i:3">
                        <span>Iniciar sesión</span>
                    </button>
                </form>

                <p class="auth-note reveal" style="--i:4">¿Sin acceso? <b>Pide una cuenta a tu administrador.</b></p>
            </div>
        </main>

        <!-- Marca: logo vectorial, sin el aro del punto -->
        <aside class="auth-hero reveal" style="--i:1" aria-hidden="true">
            <img class="brand-logo on-light" src="assets/img/huubie-vector.svg" alt="">
            <img class="brand-logo on-dark" src="assets/img/huubie-vector-dark.svg" alt="">
        </aside>
    </div>

    <!-- Pie -->
    <footer class="site-footer">
        <div class="site-footer-inner">
            <div class="site-footer-main">
                <span class="site-footer-logo">
                    <img class="brand-logo on-light" src="assets/img/huubie-vector.svg" alt="Huubie">
                    <img class="brand-logo on-dark" src="assets/img/huubie-vector-dark.svg" alt="Huubie">
                </span>

                <div class="site-footer-text">
                    <p class="site-footer-legal">
                        <span>&copy; <?= date('Y') ?> Huubie. Todos los derechos reservados.</span>
                        <a href="https://huubie.com/terminos" target="_blank" rel="noopener">Términos y condiciones</a>
                        <a href="https://huubie.com/privacidad" target="_blank" rel="noopener">Aviso de privacidad</a>
                        <a href="https://huubie.com/aviso-legal" target="_blank" rel="noopener">Aviso legal</a>
                    </p>
                    <p class="site-footer-help">
                        Si usas un lector de pantalla y tienes problemas con este sitio, escríbenos a
                        <a href="mailto:soporte@huubie.com">soporte@huubie.com</a> y te ayudamos.
                    </p>
                </div>
            </div>

            <div class="site-footer-contact">
                <h2>Contacto</h2>
                <a href="mailto:info@huubie.com">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                    Información: info@huubie.com
                </a>
                <a href="mailto:soporte@huubie.com">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>
                    Soporte: soporte@huubie.com
                </a>
            </div>
        </div>
    </footer>

    <script src="assets/plugins/jquery/jquery-3.7.0.min.js"></script>
    <script src="auth/src/js/auth.js?v=<?= $version('auth/src/js/auth.js') ?>"></script>
</body>

</html>
