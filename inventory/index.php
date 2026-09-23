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
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="src/plugin/sweetalert2/sweetalert2.min.css">
    <link rel="stylesheet" href="src/css/index.css">
</head>

<body class="login-body">

    <main class="login-shell">

        <div class="login-card">

            <div class="login-brand">
                <span class="login-mark" aria-hidden="true"></span>
            </div>

            <h1 class="login-title">Inicia sesión</h1>
            <p class="login-sub">para continuar a Coffee Inventory</p>

            <form id="form_login" novalidate class="login-form">

                <div id="login-error" class="login-error" role="alert">
                    <i data-lucide="alert-circle"></i>
                    <span id="login-error-text">Usuario y/o clave incorrectos.</span>
                </div>

                <!-- Usuario recordado en ESTE navegador. Sustituye al campo de correo:
                     solo queda escribir la contraseña. Lo pinta applyRemembered(). -->
                <div id="rememberedUser" class="remembered" hidden>
                    <span id="rememberedAvatar" class="remembered-avatar"></span>
                    <span class="remembered-info">
                        <span id="rememberedName" class="remembered-name"></span>
                        <span id="rememberedEmail" class="remembered-email"></span>
                    </span>
                    <button type="button" id="forgetUserBtn" class="remembered-x" aria-label="Usar otra cuenta" title="Usar otra cuenta">
                        <i data-lucide="x"></i>
                    </button>
                </div>

                <div class="field" id="emailField">
                    <input type="email" class="field-input" name="usuario" id="usuario" placeholder=" " required autocomplete="username">
                    <label class="field-label" for="usuario">Correo electrónico</label>
                </div>

                <div class="field">
                    <input type="password" class="field-input has-eye" name="clave" id="clave" placeholder=" " required autocomplete="current-password">
                    <label class="field-label" for="clave">Contraseña</label>
                    <button type="button" class="eye-btn" id="btnEye" aria-label="Mostrar contraseña"><i data-lucide="eye"></i></button>
                </div>

                <label class="remember-check">
                    <input type="checkbox" id="rememberMe" checked>
                    <span>Recordar mi usuario en este equipo</span>
                </label>

                <button type="submit" class="btn-continue">Continuar</button>
            </form>

            <a class="login-link" href="recuperar.php">¿Olvidaste tu contraseña?</a>
        </div>

        <p class="login-footer">Powered by <span class="cs-brand"><span class="cs-coffee">Coffee</span><span class="cs-soft">Soft</span></span> &copy; 2025</p>
    </main>

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
