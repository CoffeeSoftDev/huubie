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
<html lang="es" data-theme="light">
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
                <span class="auth-brand-name"><span class="auth-brand-coffee">Coffee</span><span class="auth-brand-soft">Soft</span></span>
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

                <div class="auth-method" role="tablist" aria-label="Método de acceso">
                    <button type="button" class="auth-method-btn active" data-method="password" role="tab">Contraseña</button>
                    <button type="button" class="auth-method-btn" data-method="pin" role="tab">PIN</button>
                </div>

                <label class="auth-field" data-method-field="password">
                    <span class="auth-label">Contraseña</span>
                    <span class="auth-pass">
                        <input type="password" name="password" class="auth-input" placeholder="••••••••" autocomplete="current-password">
                        <button type="button" class="auth-pass-toggle" aria-label="Mostrar contraseña" title="Mostrar contraseña">
                            <i data-lucide="eye"></i>
                        </button>
                    </span>
                </label>

                <label class="auth-field" data-method-field="pin" hidden>
                    <span class="auth-label">PIN</span>
                    <span class="auth-pass">
                        <input type="password" name="pin" class="auth-input" inputmode="numeric" maxlength="6" placeholder="4 a 6 dígitos" autocomplete="off">
                        <button type="button" class="auth-pass-toggle" aria-label="Mostrar PIN" title="Mostrar PIN">
                            <i data-lucide="eye"></i>
                        </button>
                    </span>
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
                    <span class="auth-pass">
                        <input type="password" name="password" class="auth-input" placeholder="Mínimo 8 caracteres" required autocomplete="new-password">
                        <button type="button" class="auth-pass-toggle" aria-label="Mostrar contraseña" title="Mostrar contraseña">
                            <i data-lucide="eye"></i>
                        </button>
                    </span>
                </label>
                <label class="auth-field">
                    <span class="auth-label">Confirmar contraseña</span>
                    <span class="auth-pass">
                        <input type="password" name="password_confirm" class="auth-input" placeholder="Repite tu contraseña" required autocomplete="new-password">
                        <button type="button" class="auth-pass-toggle" aria-label="Mostrar contraseña" title="Mostrar contraseña">
                            <i data-lucide="eye"></i>
                        </button>
                    </span>
                </label>
                <label class="auth-field">
                    <span class="auth-label">PIN de acceso rápido <span class="auth-optional">(opcional)</span></span>
                    <span class="auth-pass">
                        <input type="password" name="pin" class="auth-input" inputmode="numeric" maxlength="6" placeholder="4 a 6 dígitos" autocomplete="off">
                        <button type="button" class="auth-pass-toggle" aria-label="Mostrar PIN" title="Mostrar PIN">
                            <i data-lucide="eye"></i>
                        </button>
                    </span>
                </label>
                <label class="auth-field" data-pin-confirm hidden>
                    <span class="auth-label">Confirmar PIN</span>
                    <span class="auth-pass">
                        <input type="password" name="pin_confirm" class="auth-input" inputmode="numeric" maxlength="6" placeholder="Repite el PIN" autocomplete="off">
                        <button type="button" class="auth-pass-toggle" aria-label="Mostrar PIN" title="Mostrar PIN">
                            <i data-lucide="eye"></i>
                        </button>
                    </span>
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
