<?php
require_once __DIR__ . '/ctrl/auth-session.php';
require_once __DIR__ . '/ctrl/auth-config.php';
require_once __DIR__ . '/ctrl/auth-db.php';
require_once __DIR__ . '/ctrl/auth-helpers.php';

if (auth_current_user()) {
    header('Location: visor/index.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Iniciar sesión — CoffeeSoft</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="https://accounts.google.com/gsi/client" async defer></script>

    <link rel="stylesheet" href="src/css/auth.css?t=<?php echo time(); ?>">
</head>
<body class="auth-body">

    <div class="auth-shell">
        <div class="auth-card">
            <div class="auth-brand">
                <span class="auth-brand-mark"><?php include __DIR__ . '/visor/brand-mark.php'; ?></span>
                <span class="auth-brand-name">CoffeeSoft</span>
            </div>

            <div class="auth-tabs" role="tablist">
                <button type="button" class="auth-tab active" data-tab="login" role="tab">Iniciar sesión</button>
                <button type="button" class="auth-tab" data-tab="register" role="tab">Crear cuenta</button>
            </div>

            <div id="authError" class="auth-error" hidden></div>

            <div id="googleWrap" class="auth-google-wrap" hidden>
                <div id="gsiButton"></div>
                <div class="auth-sep"><span>o</span></div>
            </div>
            <div id="googleUnavailable" class="auth-google-unavailable" hidden>
                <i data-lucide="info" class="w-3.5 h-3.5"></i>
                <span>Inicio con Google aún no configurado</span>
            </div>

            <form id="loginForm" class="auth-form" novalidate>
                <label class="auth-field">
                    <span class="auth-label">Correo</span>
                    <input type="email" name="email" class="auth-input" placeholder="tu@correo.com" required autocomplete="username">
                </label>
                <label class="auth-field">
                    <span class="auth-label">Contraseña</span>
                    <input type="password" name="password" class="auth-input" placeholder="••••••••" required autocomplete="current-password">
                </label>
                <button type="submit" class="auth-btn-primary">
                    <span>Iniciar sesión</span>
                    <i data-lucide="loader-2" class="w-4 h-4 auth-spin" hidden></i>
                </button>
            </form>

            <form id="registerForm" class="auth-form" novalidate hidden>
                <label class="auth-field">
                    <span class="auth-label">Nombre</span>
                    <input type="text" name="name" class="auth-input" placeholder="Tu nombre" required autocomplete="name">
                </label>
                <label class="auth-field">
                    <span class="auth-label">Correo</span>
                    <input type="email" name="email" class="auth-input" placeholder="tu@correo.com" required autocomplete="email">
                </label>
                <label class="auth-field">
                    <span class="auth-label">Contraseña</span>
                    <input type="password" name="password" class="auth-input" placeholder="Mínimo 8 caracteres" required autocomplete="new-password">
                </label>
                <label class="auth-field">
                    <span class="auth-label">Confirmar contraseña</span>
                    <input type="password" name="password_confirm" class="auth-input" placeholder="Repite tu contraseña" required autocomplete="new-password">
                </label>
                <button type="submit" class="auth-btn-primary">
                    <span>Crear cuenta</span>
                    <i data-lucide="loader-2" class="w-4 h-4 auth-spin" hidden></i>
                </button>
            </form>
        </div>
    </div>

    <script>
        window.GOOGLE_CLIENT_ID = <?php echo json_encode(GOOGLE_CLIENT_ID); ?>;
    </script>
    <script src="src/js/auth.js?t=<?php echo time(); ?>"></script>
</body>
</html>
