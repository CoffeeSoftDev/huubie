<?php
session_start();

// Validar sesión de usuario
if (empty($_SESSION["IDU"])) {
    header("Location: ../");
    exit();
}
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="shortcut icon" href="../src/img/logos/coffee_icon.png" type="image/x-icon">
    <title>Módulos</title>

    <!-- CDN TAILWIND -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="../src/js/tailwind-theme.js"></script>

    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest"></script>

    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">

    <!-- SweetAlert -->
    <link rel="stylesheet" href="../src/plugin/sweetalert2/sweetalert2.min.css">

    <style>
        :root {
            --mod-bg:    #F3F4F6;
            --mod-text:  #111827;
            --mod-muted: #6B7280;
        }
        body.dark-mode {
            --mod-bg:    #111928;
            --mod-text:  #F9FAFB;
            --mod-muted: #9CA3AF;
        }
        body { font-family: 'Inter', sans-serif; background: var(--mod-bg); transition: background .2s ease; }

        /* Las tarjetas (ModuleCard) usan Poppins; el CDN de Tailwind no genera
           utilidades arbitrarias de forma fiable, por eso se define como clase propia. */
        .font-poppins { font-family: 'Poppins', sans-serif; }
    </style>
</head>

<body class="min-h-screen flex flex-col">

    <!-- Navbar (incluye su propio toggle de tema) -->
    <div id="menu-navbar"></div>

    <main class="flex-1 flex flex-col">
        <div class="w-full max-w-6xl mx-auto px-4 py-8 flex-1" id="root"></div>
    </main>

    <!-- Core Libraries -->
    <script src="../src/plugin/jquery/jquery-3.7.0.min.js"></script>
    <script src="../src/plugin/sweetalert2/sweetalert2.all.min.js"></script>

    <!-- Tema inicial (el toggle lo provee el navbar). Aplica la preferencia guardada
         antes de montar para evitar parpadeo. -->
    <script>
        (function () {
            const dark = localStorage.getItem("darkMode") === "true";
            document.body.classList.toggle("dark-mode", dark);
            document.body.setAttribute("data-bs-theme", dark ? "dark" : "light");
        })();
    </script>

    <!-- CoffeeSoft Framework -->
    <script src="../src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>

    <!-- Navbar (se auto-inicializa: fetch company + monta en #menu-navbar) -->
    <script src="../acceso/src/js/navbar.js?t=<?php echo time(); ?>"></script>

    <!-- Componente de tarjetas -->
    <script src="../src/js/components/moduleCard.js?t=<?php echo time(); ?>"></script>

    <!-- Dashboard de Módulos -->
    <script src="src/js/app.js?t=<?php echo time(); ?>"></script>
</body>

</html>
