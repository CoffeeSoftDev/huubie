<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/svg+xml" href="/alpha/src/img/alpha.png" />
    <title>Alpha</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="/alpha/access/src/css/logout.css">
</head>

<body class="bg-[#111928] flex items-center justify-center min-h-screen">
    <div class="relative text-white text-5xl font-bold flex items-center">
        <span class="text-center">Nos vemos pronto</span>

        <!-- Sonrisa más curva y corta -->
        <div
            class="absolute left-[280px] top-[10px] h-[70px] w-[200px] border-b-[10px] border-red-500 rounded-[50%] opacity-0 smile">
        </div>

        <!-- Punto ajustado -->
        <div class="absolute left-[410px] top-[5px] w-3 h-3 bg-red-500 rounded-full sm:ml-1 md:ml-2 mt-8 opacity-0 translate-y-[400px] dot"></div>
    </div>
    <!-- Logo de empresa -->
    <div class="hidden lg:flex w-1/2 items-center justify-center">
        <img src="/alpha/src/img/logo/huubie.svg" alt="Imagen" class="w-[50%] object-cover">
    </div>
    <script src="/alpha/src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="/alpha/src/js/complementos.js?t=<?php echo time(); ?>"></script>
    <script src="/alpha/src/js/plugins.js?t=<?php echo time(); ?>"></script>
    <script src="/alpha/src/js/coffeSoft.js?t=<?php echo time(); ?>"></script>
    <script src="/alpha/access/src/js/logout.js"></script>
</body>
</html>