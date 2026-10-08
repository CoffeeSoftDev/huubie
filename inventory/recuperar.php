<?php
/*  Recuperación de contraseña :: Coffee Inventory.

    Tres pasos en una sola página, sin recargar:

        1. tu correo      -> forgotPassword()  manda un código de 6 dígitos
        2. el código      -> verifyCode()      solo abre el paso 3
        3. la contraseña  -> resetPassword()   la escribe, dos veces

    La lógica está en acceso/src/js/recuperar.js y en acceso/ctrl/ctrl-access.php,
    que es el mismo controlador que atiende el login. Aquí abajo solo hay formulario.

    POR QUÉ LOS TRES PASOS VIVEN EN LA MISMA PÁGINA: porque el código y la
    cuenta se quedan en memoria del navegador y no hay que pasarlos por la URL
    --donde acabarían en el historial, en los logs de Apache y en el Referer--
    ni inventar un token de sesión para un trámite que dura dos minutos.

    LOS id SON EL CONTRATO con recuperar.js. Si se renombra uno aquí, hay que
    renombrarlo allí.  */
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="shortcut icon" href="src/img/logos/coffee_icon.png" type="image/x-icon">
    <title>Coffee Inventory - Recuperar contraseña</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="src/plugin/sweetalert2/sweetalert2.min.css">
    <link rel="stylesheet" href="src/css/index.css?v=<?php echo filemtime(__DIR__ . '/src/css/index.css'); ?>">
</head>

<body class="login-body">

    <header class="login-top reveal" style="--i:0">
        <a class="login-wordmark" href="index.php"><span class="login-logo" aria-hidden="true"></span>Coffee Inventory</a>
    </header>

    <main class="login-shell">

        <div class="login-card reveal" style="--i:1">

            <span class="login-mark reveal" style="--i:2" aria-hidden="true"><span class="login-logo"></span></span>

            <h1 class="login-title reveal" style="--i:3">Recuperar contraseña</h1>

            <div class="pasos reveal" style="--i:4" id="pasos">
                <span class="paso on"></span>
                <span class="paso"></span>
                <span class="paso"></span>
            </div>

            <div id="aviso" class="aviso hide"></div>

            <!-- ============ PASO 1 :: tu correo ============ -->
            <form id="form-correo" novalidate class="login-form reveal" style="--i:5">
                <p class="paso-texto">
                    Escribe el correo con el que entras. Te enviamos un código
                    para que puedas elegir una contraseña nueva.
                </p>

                <div class="field">
                    <label class="field-label" for="correo">Correo electrónico</label>
                    <input type="email" class="field-input" name="correo" id="correo" placeholder="nombre@empresa.com" required autocomplete="username" autofocus>
                </div>

                <button type="submit" class="btn-continue" id="btn-enviar">Enviar código</button>
            </form>

            <!-- ============ PASO 2 :: el código ============ -->
            <form id="form-codigo" novalidate class="login-form hide">
                <p class="paso-texto">
                    Escribe el código de 6 dígitos que te enviamos a
                    <span id="correo-eco"></span>.
                </p>

                <div class="field">
                    <label class="field-label" for="codigo">Código</label>
                    <!-- one-time-code: el teclado del teléfono ofrece pegarlo
                         en cuanto llega el mensaje. -->
                    <input type="text" class="field-input field-code" name="codigo" id="codigo"
                           inputmode="numeric" autocomplete="one-time-code" maxlength="6"
                           placeholder="••••••" required>
                </div>

                <button type="submit" class="btn-continue" id="btn-codigo">Continuar</button>
                <button type="button" class="btn-ghost" id="btn-reenviar">¿No te llegó? Enviar otro código</button>
            </form>

            <!-- ============ PASO 3 :: la contraseña nueva ============ -->
            <form id="form-clave" novalidate class="login-form hide">
                <p class="paso-texto">
                    Elige tu contraseña nueva. Escríbela dos veces para
                    asegurarnos de que quedó como querías.
                </p>

                <div class="field">
                    <label class="field-label" for="nueva">Contraseña nueva</label>
                    <div class="control">
                        <input type="password" class="field-input has-eye" name="nueva" id="nueva" required autocomplete="new-password">
                        <button type="button" class="eye-btn" id="btnEye" aria-label="Mostrar contraseña"><i data-lucide="eye"></i></button>
                    </div>
                </div>

                <div class="field">
                    <label class="field-label" for="confirmar">Repite la contraseña</label>
                    <input type="password" class="field-input" name="confirmar" id="confirmar" required autocomplete="new-password">
                </div>

                <button type="submit" class="btn-continue" id="btn-clave">Guardar contraseña</button>
            </form>

            <!-- ============ FINAL ============ -->
            <div id="paso-listo" class="login-form hide">
                <a href="index.php" class="btn-continue">
                    <span>Iniciar sesión</span>
                    <i data-lucide="arrow-right" class="btn-arrow"></i>
                </a>
            </div>

            <div class="card-foot">¿Ya la recordaste? <a href="index.php">Volver a iniciar sesión</a></div>
        </div>
    </main>

    <p class="login-footer reveal" style="--i:6">&copy; <?php echo date('Y'); ?> CoffeeSoft</p>

    <script src="src/plugin/lucide/lucide.min.js"></script>
    <script src="src/plugin/jquery/jquery-3.7.0.min.js"></script>
    <script src="src/plugin/sweetalert2/sweetalert2.all.min.js"></script>
    <script src="src/js/complementos.js"></script>
    <script src="src/js/plugins.js"></script>

    <script src="acceso/src/js/recuperar.js?t=<?php echo time(); ?>"></script>
</body>

</html>
