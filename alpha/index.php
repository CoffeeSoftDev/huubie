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
    <link rel="stylesheet" href="access/src/css/login.css?t=<?= time() ?>">

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
            <!-- Sin `required`: validation_form inyectaria sus avisos de Bootstrap (sin estilo aqui)
                 y el navegador su globo. Los vacios los valida startSession() con mensaje propio. -->
            <form id="formLogin" action="none" class="w-full md:w-4/5 mt-4 text-white rounded-lg" novalidate>
                <!-- Campos de Usuario y Contraseña -->
                <div class="flex flex-col md:flex-row justify-between gap-x-4">
                    <!-- Usuario -->
                    <div id="groupUser" class="flex flex-col w-full md:w-1/2">
                        <label for="user" class="text-sm font-medium">Usuario</label>
                        <div id="userField" class="login-field mt-1.5">
                            <input type="text" id="user" name="user" class="login-input" placeholder="ej. mlopez"
                                autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false"
                                enterkeyhint="next" aria-required="true" aria-describedby="userMsg">
                            <svg class="login-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>

                        <!-- Usuario recordado en ESTE navegador. Sustituye al campo de usuario:
                             solo queda escribir la contraseña. Lo pinta applyRemembered().
                             El avatar es el mismo de la navbar: su foto, o el morado con icono. -->
                        <div id="rememberedUser" class="login-card hidden mt-1.5 h-12 pl-2.5 pr-1.5 bg-[#374151] rounded-md flex items-center gap-x-2.5">
                            <span id="rememberedAvatar" class="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shrink-0 text-white">
                                <img id="rememberedPhoto" class="hidden w-full h-full object-cover" alt="">
                                <svg id="rememberedIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </span>
                            <span class="flex flex-col min-w-0 leading-tight">
                                <span id="rememberedName" class="text-sm font-medium truncate"></span>
                                <span id="rememberedUserName" class="text-xs text-gray-400 truncate"></span>
                            </span>
                            <button type="button" id="forgetUserBtn" class="login-forget" title="Usar otra cuenta" aria-label="Usar otra cuenta">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>
                        <p id="userMsg" class="login-msg" aria-live="polite">
                            <svg class="msg-err"xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                            <span></span>
                        </p>
                    </div>

                    <!-- Contraseña -->
                    <div id="groupKey" class="flex flex-col w-full md:w-1/2 mt-2 md:mt-0">
                        <label for="key" class="text-sm font-medium">Contraseña</label>
                        <div class="login-field mt-1.5">
                            <input type="password" id="key" name="key" class="login-input has-btn" placeholder="••••••••"
                                autocomplete="current-password" enterkeyhint="go" aria-required="true" aria-describedby="keyMsg">
                            <svg class="login-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            <!-- Ojo: trae los dos iconos, aria-pressed decide cual se ve -->
                            <button type="button" id="togglePassword" class="login-eye" aria-label="Mostrar contraseña" aria-pressed="false">
                                <svg class="eye-on"xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                                <svg class="eye-off"xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>
                            </button>
                        </div>
                        <p id="keyMsg" class="login-msg" aria-live="polite">
                            <svg class="msg-err"xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                            <svg class="msg-caps"xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18v-6H5l7-7 7 7h-4v6H9z"/></svg>
                            <span></span>
                        </p>
                    </div>
                </div>

                <!-- ¿Olvidaste la contraseña? (el usuario se recuerda solo, sin casilla) -->
                <div class="flex justify-end mt-2 text-sm">
                    <a href="#" class="text-blue-400 hover:underline">¿Olvidaste la contraseña?</a>
                </div>

                <!-- Botón -->
                <button type="submit" id="btnLogin"
                    class="w-full mt-4 h-12 text-[15px] bg-[#1C64F2] hover:bg-[#0E9E6E] rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-80 disabled:cursor-wait">
                    <svg class="login-spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    <span>Iniciar sesión</span>
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
