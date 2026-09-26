<?php
session_start();

// Verifica si la sesión está iniciada
if (isset($_SESSION['USR'])) {
    // Redirige al login si no está autenticado
    header('Location: /alpha/menu/');
    exit();
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/svg+xml" href="src/img/logo/logo.ico" />
    <!-- Web App Meta -->
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#1F2A37">

    <!-- Iconos para iOS y Android -->
    <link rel="apple-touch-icon" sizes="180x180" href="src/img/huubie192.png">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

    <title>Huubie Alpha</title>
    <link rel="stylesheet" href="src/plugins/sweetalert2/sweetalert2.min.css">
    <script src="src/plugins/sweetalert2/sweetalert2.all.min.js"></script>
    <link rel="stylesheet" href="/alpha/src/plugins/fontello/css/fontello.css">

    <script src="https://cdn.tailwindcss.com"></script>
    <script src="src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="src/js/complementos.js?t=<?= time() ?>"></script>
    <script src="src/js/plugins.js?t=<?= time() ?>"></script>
    <script src="src/js/coffeeSoft.js?t=<?= time() ?>"></script>
</head>

<body class="bg-[#111928] flex items-center justify-center min-h-screen">
    <div class="w-full flex flex-wrap items-center justify-center px-4">
        <!-- Sección formulario -->
        <div class="w-full md:w-1/2 flex flex-col items-center justify-center mb-6 md:mb-0">
            <!-- Bienvenida -->
            <div class="w-full md:w-4/5 bg-[#1F2A37] p-4 flex items-center justify-between text-white rounded-md">
                <!-- Texto -->
                <h2 class="text-xl md:text-2xl font-semibold">Bienvenido de regreso</h2>
                <!-- Logo -->
                <img src="src/img/logo/huubie.svg" alt="Imagen" class="w-20 h-15 object-cover">
            </div>

            <!-- Formulario -->
            <form id="formLogin" action="none" class="w-full md:w-4/5 mt-4 text-white rounded-lg">
                <!-- Campos de Usuario y Contraseña -->
                <div class="flex flex-col md:flex-row justify-between gap-x-4">
                    <!-- Usuario -->
                    <div class="flex flex-col w-full md:w-1/2">
                        <label for="user" class="text-sm font-medium">Usuario</label>
                        <input type="text" id="user" name="user" autocomplete="username"
                            class="mt-1.5 h-14 px-4 text-[15px] bg-[#374151] rounded-md outline-none text-white" required>

                        <!-- Usuario recordado en ESTE navegador. Sustituye al campo de usuario:
                             solo queda escribir la contraseña. Lo pinta applyRemembered().
                             El avatar es el mismo de la navbar: su foto, o el morado con icono. -->
                        <div id="rememberedUser" class="hidden mt-1.5 h-14 pl-3 pr-4 bg-[#374151] rounded-md flex items-center gap-x-3">
                            <span id="rememberedAvatar" class="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden shrink-0 text-white">
                                <img id="rememberedPhoto" class="hidden w-full h-full object-cover" alt="">
                                <i id="rememberedIcon" class="icon-user-7 text-lg"></i>
                            </span>
                            <span class="flex flex-col min-w-0 leading-tight">
                                <span id="rememberedName" class="text-[15px] font-medium truncate"></span>
                                <span id="rememberedUserName" class="text-xs text-gray-400 truncate"></span>
                            </span>
                            <button type="button" id="forgetUserBtn" title="Usar otra cuenta" aria-label="Usar otra cuenta"
                                class="ml-auto text-gray-400 hover:text-white">
                                <i class="icon-cancel"></i>
                            </button>
                        </div>
                    </div>
                    <!-- Contraseña con Input Group -->
                    <div class="flex flex-col w-full md:w-1/2 mt-4 md:mt-0">
                        <label for="key" class="text-sm font-medium">Contraseña</label>
                        <div class="relative mt-1.5">
                            <input type="password" id="key" name="key"
                                class="w-full h-14 px-4 pr-12 text-[15px] bg-[#374151] rounded-md outline-none text-white" required>
                            <!-- Icono del ojo -->
                            <button type="button" id="togglePassword"
                                class="absolute inset-y-0 right-4 flex items-center text-lg text-gray-400 hover:text-white">
                                <i class="icon-eye"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- ¿Olvidaste la contraseña? (el usuario se recuerda solo, sin casilla) -->
                <div class="flex justify-end mt-4 text-sm">
                    <a href="#" class="text-blue-400 hover:underline">¿Olvidaste la contraseña?</a>
                </div>

                <!-- Botón -->
                <button type="submit"
                    class="w-full mt-4 h-14 text-base bg-[#1C64F2] hover:bg-[#0E9E6E] rounded-lg font-semibold transition-colors">
                    Iniciar sesión
                </button>
            </form>
        </div>

        <!-- Sección empresa -->
        <div class="hidden md:flex w-1/2 items-center justify-center">
            <img src="src/img/logo/huubie.svg" alt="Imagen" class="w-[50%] object-cover">
        </div>

    </div>

    <script src="access/src/js/access.js?t=<?= time() ?>"></script>
</body>

</html>
