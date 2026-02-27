<?php
http_response_code(403);
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Acceso denegado</title>
    <link rel="icon" type="image/svg+xml" href="../src/img/logo/logo.ico" />
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#111928] flex items-center justify-center min-h-screen text-white">
    <div class="w-full max-w-xl px-6">
        <div class="bg-[#1F2A37] rounded-lg p-6 shadow">
            <div class="flex items-center justify-between">
                <h1 class="text-2xl font-semibold">Acceso denegado</h1>
                <img src="../src/img/logo/huubie.svg" alt="Huubie" class="w-16 h-16">
            </div>
            <p class="mt-4 text-gray-300">No tienes permisos para ver esta página.</p>

            <div class="mt-6 flex gap-3">
                <a href="/alpha/" class="px-4 py-2 rounded-md bg-[#1C64F2] hover:bg-[#0E9E6E] font-medium">Iniciar sesión</a>
                <a href="/alpha/menu/" class="px-4 py-2 rounded-md bg-[#374151] hover:bg-[#4B5563] font-medium">Volver al menú</a>
            </div>
        </div>

        <div class="mt-6 text-center">
            <a href="javascript:history.back()" class="text-blue-400 hover:underline">Regresar</a>
        </div>
    </div>
</body>
</html>
