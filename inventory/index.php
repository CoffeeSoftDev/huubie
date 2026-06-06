<?php
if(isset($_COOKIE['IDU'])){
    echo '<script>
        let ruta = localStorage.getItem("url");
        if (ruta) {
            const HREF = new URL(window.location.href);
            const ERP = HREF.pathname.split("/").filter(Boolean)[0];
            window.location.href = HREF.origin + "/" + ERP + "/" + ruta;
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
    <title>CoffeeInventory - Iniciar sesión</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="src/js/tailwind-theme.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="src/plugin/sweetalert2/sweetalert2.min.css">
    <link rel="stylesheet" href="src/css/index.css">
</head>

<body class="login-body">

    <!-- Ambient Blobs -->
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="blob blob-3"></div>

    <!-- Main Card -->
    <div class="login-card-wrap">

        <!-- Floating Cup -->
        <div class="cup-float">
            <div class="cup-inner">
                <svg width="120" height="120" viewBox="0 0 140 140" fill="none">
                    <g stroke="#E8A68F" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.9">
                        <path class="steam" d="M55 40 Q60 30 55 20" />
                        <path class="steam" d="M70 40 Q75 30 70 20" />
                        <path class="steam" d="M85 40 Q90 30 85 20" />
                    </g>
                    <ellipse cx="70" cy="108" rx="38" ry="6" fill="#1E2730" opacity="0.3"/>
                    <ellipse cx="70" cy="106" rx="34" ry="5" fill="#F7F0EB"/>
                    <path d="M40 58 h60 v38 a12 12 0 0 1 -12 12 h-36 a12 12 0 0 1 -12 -12 z" fill="#F7F0EB"/>
                    <ellipse cx="70" cy="58" rx="30" ry="7" fill="#F7F0EB"/>
                    <ellipse cx="70" cy="58" rx="27" ry="5" fill="#1E2730" opacity="0.08"/>
                    <ellipse cx="70" cy="58" rx="24" ry="4.5" fill="#C05A40"/>
                    <path d="M55 58 q15 -2 30 0" stroke="#E8A68F" stroke-width="2" stroke-linecap="round" opacity="0.7" fill="none"/>
                    <path d="M100 64 h10 a8 8 0 0 1 0 16 h-10" stroke="#F7F0EB" stroke-width="6" stroke-linecap="round" fill="none"/>
                </svg>
            </div>
        </div>

        <div class="glass-card">
            <!-- Header -->
            <div class="login-header">
                <h1 class="text-gradient">CoffeeInventory</h1>
                <p class="login-subtitle">Gestión inteligente de almacén</p>
            </div>

            <form id="form_login" novalidate class="login-form">

                <div id="login-error" class="login-error" role="alert">
                    <span class="login-error-icon">⚠</span>
                    <span id="login-error-text">Usuario y/o clave incorrectos.</span>
                </div>

                <div class="form-group">
                    <label class="vsr-label" for="usuario">Correo o usuario</label>
                    <div class="input-wrap">
                        <svg class="input-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
                        <input type="text" class="glass-input" name="usuario" id="usuario" placeholder="Tu correo o usuario" required autocomplete="username">
                    </div>
                </div>

                <div class="form-group">
                    <label class="vsr-label" for="clave">Contraseña</label>
                    <div class="input-wrap">
                        <svg class="input-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
                        <input type="password" class="glass-input has-eye" name="clave" id="clave" placeholder="••••••••" required autocomplete="current-password">
                        <span class="eye-icon" id="btnEye"><i data-lucide="eye"></i></span>
                    </div>
                </div>

                <button type="submit" class="btn-glow">Iniciar sesión</button>
            </form>
        </div>

        <p class="login-copyright">CoffeeSoft Ecosystem © <?php echo date('Y'); ?></p>
    </div>

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
