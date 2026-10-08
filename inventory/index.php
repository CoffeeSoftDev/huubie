<?php
if(isset($_COOKIE['IDU'])){
    echo '<script>
        let ruta = localStorage.getItem("url");
        if (ruta) {
            // Redirección relativa a la ubicación del login (inventory/), igual que en index.js:
            // funciona sin importar la subcarpeta donde esté montado el proyecto.
            window.location.href = ruta.replace(/^\/+/, "");
        }
    </script>';
}
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <link rel="shortcut icon" href="src/img/logos/coffee_icon.png" type="image/x-icon">
    <title>Coffee Inventory - Iniciar sesión</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="src/js/tailwind-theme.js?v=<?php echo filemtime(__DIR__ . '/src/js/tailwind-theme.js'); ?>"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="src/plugin/sweetalert2/sweetalert2.min.css">
    <link rel="stylesheet" href="src/css/index.css?v=<?php echo filemtime(__DIR__ . '/src/css/index.css'); ?>">
</head>

<body class="login-body">

    <header class="login-top reveal" style="--i:0">
        <span class="login-wordmark"><span class="login-logo" aria-hidden="true"></span>Coffee Inventory</span>
    </header>

    <main class="login-shell">

        <div class="login-card reveal" style="--i:1">

            <span class="login-mark reveal" style="--i:2" aria-hidden="true"><span class="login-logo"></span></span>

            <h1 class="login-title reveal" style="--i:3">Bienvenido de vuelta</h1>
            <p class="login-sub reveal" style="--i:4">Inicia sesión en tu cuenta de Coffee Inventory.</p>

            <form id="form_login" novalidate class="login-form">

                <div id="login-error" class="login-error" role="alert">
                    <i data-lucide="circle-alert"></i>
                    <span id="login-error-text">Usuario y/o clave incorrectos.</span>
                </div>

                <!-- Usuario recordado en ESTE navegador. Sustituye al campo de correo:
                     solo queda escribir la contraseña. Lo pinta applyRemembered(). -->
                <div id="rememberedUser" class="remembered reveal" style="--i:5" hidden>
                    <span id="rememberedAvatar" class="remembered-avatar"></span>
                    <span class="remembered-info">
                        <span id="rememberedName" class="remembered-name"></span>
                        <span id="rememberedEmail" class="remembered-email"></span>
                    </span>
                    <button type="button" id="forgetUserBtn" class="remembered-x" title="Usar otra cuenta">Cambiar</button>
                </div>

                <div class="field reveal" style="--i:5" id="emailField">
                    <label class="field-label" for="usuario">Correo electrónico</label>
                    <input type="email" class="field-input" name="usuario" id="usuario" placeholder="nombre@empresa.com" required autocomplete="username">
                </div>

                <div class="field reveal" style="--i:6">
                    <div class="label-row">
                        <label class="field-label" for="clave">Contraseña</label>
                        <a href="recuperar.php">¿La olvidaste?</a>
                    </div>
                    <div class="control">
                        <input type="password" class="field-input has-eye" name="clave" id="clave" required autocomplete="current-password">
                        <button type="button" class="eye-btn" id="btnEye" aria-label="Mostrar contraseña"><i data-lucide="eye"></i></button>
                    </div>
                    <span class="caps" id="capsHint"><i data-lucide="triangle-alert"></i>Bloq Mayús está activado</span>
                </div>

                <label class="remember-check reveal" style="--i:7">
                    <input type="checkbox" id="rememberMe" checked>
                    <span>Recordar mi usuario en este equipo</span>
                </label>

                <button type="submit" class="btn-continue reveal" style="--i:8" id="btnLogin">
                    <span>Continuar</span>
                    <i data-lucide="arrow-right" class="btn-arrow"></i>
                    <i data-lucide="loader-circle" class="btn-spin"></i>
                </button>
            </form>

            <div class="card-foot">¿Sin acceso? <b>Pide una cuenta a tu administrador.</b></div>
        </div>

        <p class="login-trust reveal" style="--i:9"><i data-lucide="shield-check"></i>Tu sesión se cierra tras 8 h sin uso</p>
    </main>

    <p class="login-footer reveal" style="--i:10">&copy; <?php echo date('Y'); ?> CoffeeSoft</p>

    <script src="src/plugin/lucide/lucide.min.js"></script>
    <script src="src/plugin/jquery/jquery-3.7.0.min.js"></script>
    <script src="src/plugin/bootstrap-5/js/bootstrap.min.js"></script>
    <script src="src/plugin/bootbox.min.js"></script>
    <script src="src/plugin/sweetalert2/sweetalert2.all.min.js"></script>
    <script src="src/js/complementos.js"></script>
    <script src="src/js/plugins.js"></script>
    <script src="src/js/plugin-forms.js"></script>

    <script src="acceso/src/js/index.js?t=<?php echo time(); ?>"></script>
</body>

</html>
