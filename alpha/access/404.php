<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Oops! Página perdida</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      background-color: #0b1c34;
    }

    .giant-404 {
      position: absolute;
      font-size: 51rem;
      font-weight: 900;
      color: #04172E;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 0;
      pointer-events: none;
      user-select: none;
      line-height: 1;
      white-space: nowrap;
    }
  </style>
</head>
<body class="relative flex items-center justify-center min-h-screen overflow-hidden">

  <!-- 🔢 Número 404 de fondo -->
  <div class="giant-404">404</div>

  <!-- 🌌 Contenido -->
  <div class="relative z-10 flex flex-col md:flex-row items-center rounded-2xl shadow-2xl p-10 max-w-5xl w-full gap-8">

    <!-- Texto -->
    <div class="flex-1 text-center md:text-left space-y-4">
      <h1 class="text-9xl font-extrabold text-white drop-shadow-md">Oops!</h1>
      <p class="text-gray-300 text-2xl">Parece que algo se ha perdido en el espacio...<br/>¡Nuestro error!</p>
      <a href="/alpha/menu/" class="inline-block mt-4 bg-red-500 hover:bg-red-600 transition px-6 py-3 rounded-full font-semibold text-white text-lg">
        🚀 Llévame a casa
      </a>
    </div>

    <!-- Imagen -->
    <div class="flex-1 flex justify-center">
      <img src="https://www.huubie.com.mx/alpha/src/img/astronauta.png" alt="Astronauta flotando" class="w-80 max-w-full drop-shadow-lg"/>
    </div>

  </div>

</body>
</html>
