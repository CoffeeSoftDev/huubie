<?php
require_once __DIR__ . '/../conf/_Session.php';

// Validar sesión de usuario
if (empty($_SESSION["IDU"])) {
    header("Location: ../");
    exit();
}

// Solo el Super Admin elige empresa; los demás entran directo a sus módulos.
require_once __DIR__ . '/../conf/_Permissions.php';
if (!Permissions::superAdmin()) {
    header("Location: ../modulos/");
    exit();
}
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="../src/img/logos/favicon.svg" type="image/svg+xml">
    <title>Selecciona tu empresa</title>

    <!-- CDN TAILWIND -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="../src/js/tailwind-theme.js?v=<?php echo filemtime(__DIR__ . '/../src/js/tailwind-theme.js'); ?>"></script>

    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest"></script>

    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

    <!-- SweetAlert -->
    <link rel="stylesheet" href="../src/plugin/sweetalert2/sweetalert2.min.css">

    <!-- Tokens de página (fondo gris, acento del tema). -->
    <link rel="stylesheet" href="../src/css/themes.css?v=<?php echo filemtime(__DIR__ . '/../src/css/themes.css'); ?>">

    <style>
        /* La misma pantalla que el selector de sucursales (sucursales/index.php). */
        :root           { --emp-bg: var(--bg, #F3F4F6); }
        body.dark-mode  { --emp-bg: var(--dk-bg, #111928); }

        body { font-family: 'Inter', sans-serif; background: var(--emp-bg); transition: background .2s ease; }

        /* ── Ícono flotante de tema (solo ícono, sin recuadro de botón) ── */
        .emp-theme-toggle {
            position: fixed; top: 18px; right: 18px; z-index: 50;
            width: 40px; height: 40px;
            display: flex; align-items: center; justify-content: center;
            color: var(--ink-dim, #6B7280); border: none; background: transparent;
            transition: color .15s ease; cursor: pointer;
        }
        .emp-theme-toggle:hover { color: var(--ink, #111827); }
        body.dark-mode .emp-theme-toggle       { color: var(--dk-muted, #9CA3AF); }
        body.dark-mode .emp-theme-toggle:hover { color: var(--dk-text, #F9FAFB); }
    </style>
</head>

<body class="h-screen flex flex-col overflow-hidden">

    <!-- Toggle de tema (claro/oscuro) -->
    <button id="btnThemeToggle" class="emp-theme-toggle" title="Cambiar tema claro/oscuro" type="button"></button>

    <main class="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        <div class="w-full flex-1 flex flex-col" id="root"></div>
    </main>

    <!-- Core Libraries -->
    <script src="../src/plugin/jquery/jquery-3.7.0.min.js"></script>
    <script src="../src/plugin/sweetalert2/sweetalert2.all.min.js"></script>

    <!-- Inicialización del tema (claro por defecto) -->
    <script>
        (function () {
            // Tema claro por defecto; respeta la preferencia previa del usuario.
            const isDark = localStorage.getItem("darkMode") === "true";
            applyTheme(isDark);

            function applyTheme(dark) {
                document.body.classList.toggle("dark-mode", dark);
                document.body.setAttribute("data-bs-theme", dark ? "dark" : "light");
                const btn = document.getElementById("btnThemeToggle");
                if (btn) btn.innerHTML = `<i data-lucide="${dark ? 'sun' : 'moon'}" class="w-[18px] h-[18px]"></i>`;
                if (typeof lucide !== "undefined") lucide.createIcons();
            }

            document.getElementById("btnThemeToggle").addEventListener("click", function () {
                const dark = !document.body.classList.contains("dark-mode");
                localStorage.setItem("darkMode", dark ? "true" : "false");
                applyTheme(dark);
            });
        })();
    </script>

    <!-- CoffeeSoft Framework -->
    <script src="../src/js/coffeeSoft.js?v=<?php echo filemtime(__DIR__ . '/../src/js/coffeeSoft.js'); ?>"></script>

    <!-- Pantalla de elección en tarjetas (la del selector de sucursales) -->
    <script src="../src/js/components/cs-selector-cards.js?v=<?php echo filemtime(__DIR__ . '/../src/js/components/cs-selector-cards.js'); ?>"></script>

    <!-- Selector de empresas -->
    <script src="src/js/app.js?t=<?php echo time(); ?>"></script>
</body>

</html>
