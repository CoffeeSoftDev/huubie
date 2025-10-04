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
    <link rel="Huubie" href="src/img/logo/logo.ico">
    <title>Huubie Alpha</title>
    <link rel="stylesheet" href="src/plugins/sweetalert2/sweetalert2.min.css">
    <script src="src/plugins/sweetalert2/sweetalert2.all.min.js"></script>
    <link rel="stylesheet" href="/alpha/src/plugins/fontello/css/fontello.css">

    <script src="https://cdn.tailwindcss.com"></script>
    <script src="src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="src/js/complementos.js?t=<?= time() ?>"></script>
    <script src="src/js/plugins.js?t=<?= time() ?>"></script>
    <script src="src/js/coffeSoft.js?t=<?= time() ?>"></script>
</head>

<body class="bg-[#1E293B] flex items-center justify-center min-h-screen">
    <div class="w-full flex flex-wrap items-center justify-center px-4">
        <!-- Sección formulario -->
        <div class="w-full md:w-1/2 flex flex-col items-center justify-center mb-6 md:mb-0 ">
            <!-- Bienvenida -->
            <div class="w-full md:w-4/5 bg-[#333D4C] p-4 flex items-center justify-between text-white rounded-md">
                <!-- Texto -->
                <h2 class="text-xl md:text-2xl font-semibold">Bienvenido Dev</h2>
                <!-- Logo -->
                <img src="src/img/logo/dhuubie.svg" alt="Imagen" class="w-20 h-15 object-cover">
            </div>

            <!-- Formulario -->
            <form id="formLogin" action="none" class="w-full md:w-4/5 mt-4 text-white rounded-lg">
                <!-- Campos de Usuario y Contraseña -->
                <div class="flex flex-col md:flex-row justify-between gap-x-4">
                    <!-- Usuario -->
                    <div class="flex flex-col w-full md:w-1/2">
                        <label for="user" class="text-sm font-medium">Usuario</label>
                        <input type="text" id="user" name="user"
                            class="mt-1 p-2 bg-[#374151] rounded-md outline-none text-white" required>
                    </div>
                    <!-- Contraseña con Input Group -->
                    <div class="flex flex-col w-full md:w-1/2 mt-4 md:mt-0">
                        <label for="key" class="text-sm font-medium">Contraseña</label>
                        <div class="relative mt-1">
                            <input type="password" id="key" name="key"
                                class="w-full p-2 pr-10 bg-[#374151] rounded-md outline-none text-white" required>
                            <!-- Icono del ojo -->
                            <button type="button" id="togglePassword"
                                class="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-white">
                                <i class="icon-eye"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Recuerdame & ¿Olvidaste la contraseña? -->
                <div class="flex flex-col md:flex-row justify-between items-center mt-4 text-sm">
                    <label class="flex items-center gap-x-2 cursor-pointer">
                        <input type="checkbox" id="rememberMe" name="rememberMe" class="bg-[#374151] w-4 h-4">
                        Recuerdame
                    </label>
                    <a href="#" class="text-blue-400 hover:underline mt-2 md:mt-0">¿Olvidaste la contraseña?</a>
                </div>

                <!-- Botón -->
                <button type="submit"
                    class="w-full mt-4 p-2 bg-[#1C64F2] hover:bg-[#0E9E6E] rounded-lg font-semibold transition-colors">
                    Iniciar sesión
                </button>
            </form>
        </div>

        <!-- Sección empresa -->
        <div class="hidden md:flex w-1/2 items-center justify-center">
            <img src="src/img/logo/huuubie.svg" alt="Imagen" class="w-[50%] object-cover">
        </div>

    </div>

    <script src="access/src/js/access.js?t=<?= time() ?>"></script>
</body>

</html>