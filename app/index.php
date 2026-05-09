<?php
session_start();

// Si ya hay sesion activa, manda directo al selector de sucursales
if (isset($_SESSION['USR'])) {
    header('Location: /app/subsidiaries/');
    exit();
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <meta name="theme-color" content="#1F2A37">

    <link rel="apple-touch-icon" sizes="180x180" href="/app/src/img/huubie192.png">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

    <title>Huubie Coffee</title>

    <link rel="stylesheet" href="/app/src/plugins/sweetalert2/sweetalert2.min.css">
    <script src="/app/src/plugins/sweetalert2/sweetalert2.all.min.js"></script>
    <link rel="stylesheet" href="/app/src/plugins/fontello/css/fontello.css">

    <script src="https://cdn.tailwindcss.com"></script>
    <script src="/app/src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="/app/src/js/complementos.js?t=<?= time() ?>"></script>
    <script src="/app/src/js/plugins.js?t=<?= time() ?>"></script>
    <script src="/app/src/js/coffeeSoft.js?t=<?= time() ?>"></script>
</head>

<body class="bg-[#111928] flex items-center justify-center min-h-screen">
    <div class="w-full flex flex-wrap items-center justify-center px-4">
        <!-- Seccion formulario -->
        <div class="w-full md:w-1/2 flex flex-col items-center justify-center mb-6 md:mb-0">
            <!-- Bienvenida -->
            <div class="w-full md:w-4/5 bg-[#1F2A37] px-6 py-6 flex items-center justify-between text-white rounded-md">
                <h2 class="text-xl md:text-2xl font-semibold">Bienvenido de regreso</h2>
                <img src="/app/src/img/logo/huubie.svg" alt="huubie" class="h-16 object-contain">
            </div>

            <!-- Formulario -->
            <form id="formLogin" action="none" class="w-full md:w-4/5 mt-6 text-white">
                <div class="flex flex-col md:flex-row justify-between gap-x-4">
                    <!-- Email -->
                    <div class="flex flex-col w-full md:w-1/2">
                        <label for="user" class="text-sm font-medium">Email</label>
                        <input type="text" id="user" name="user"
                            placeholder="name@example.com"
                            class="mt-1 p-2 bg-[#374151] rounded-md outline-none text-white placeholder-gray-500" required>
                    </div>
                    <!-- Contrasena -->
                    <div class="flex flex-col w-full md:w-1/2 mt-4 md:mt-0">
                        <label for="key" class="text-sm font-medium">Contraseña</label>
                        <div class="relative mt-1">
                            <input type="password" id="key" name="key"
                                placeholder="••••••••••"
                                class="w-full p-2 pr-10 bg-[#374151] rounded-md outline-none text-white placeholder-gray-500" required>
                            <button type="button" id="togglePassword"
                                class="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-white">
                                <i class="icon-eye"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- <div class="flex flex-col md:flex-row justify-between items-center mt-4 text-sm">
                    <label class="flex items-center gap-x-2 cursor-pointer">
                        <input type="checkbox" id="rememberMe" name="rememberMe" class="bg-[#374151] w-4 h-4">
                        Recuérdame
                    </label>
                    <a href="#" class="text-blue-400 hover:underline mt-2 md:mt-0">¿Olvidaste la contraseña?</a>
                </div> -->

                <button type="submit"
                    class="w-full mt-10 p-2 bg-[#1C64F2] hover:bg-[#0E9E6E] rounded-lg font-semibold transition-colors">
                    Iniciar Sesión
                </button>
            </form>
        </div>

        <!-- Seccion empresa -->
        <div class="hidden md:flex w-1/2 flex-col items-center justify-center">
            <img src="/app/src/img/logo/huubie.svg" alt="Tu empresa" class="w-[50%] object-contain">
            <!-- <h3 class="text-white text-xl font-semibold mt-4">Tu empresa</h3> -->
        </div>
    </div>

    <script src="/app/access/src/js/access.js?t=<?= time() ?>"></script>
</body>
</html>
