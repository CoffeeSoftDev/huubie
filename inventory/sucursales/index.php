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
    <title>Selecciona tu sucursal</title>

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
        /* ── Variables de tema (claro por defecto) ──
           Los tokens propios de esta pantalla cuelgan de los globales de
           themes.css. */
        :root {
            --suc-bg:        var(--bg, #F3F4F6);
            --suc-card:      var(--surface, #FFFFFF);
            --suc-card-sel:  var(--surface, #FFFFFF);
            --suc-border:    var(--line, #E5E7EB);
            --suc-text:      var(--ink, #111827);
            --suc-muted:     var(--ink-dim, #6B7280);
            --suc-pill-bg:   #FFFFFF;
            --suc-pill-text: #6B7280;
        }
        /* ── Override modo oscuro: superficies del tema (themes.css) ── */
        body.dark-mode {
            --suc-bg:        var(--dk-bg, #111928);
            --suc-card:      var(--dk-card, #1F2A37);
            --suc-card-sel:  var(--dk-card, #1F2A37);
            --suc-border:    var(--dk-line, #374151);
            --suc-text:      var(--dk-text, #F9FAFB);
            --suc-muted:     var(--dk-muted, #9CA3AF);
            --suc-pill-bg:   var(--dk-hover, #1D2937);
            --suc-pill-text: var(--dk-muted, #9CA3AF);
        }

        body { font-family: 'Inter', sans-serif; background: var(--suc-bg); transition: background .2s ease; }

        .suc-card        { background: var(--suc-card); border-color: var(--suc-border); }
        .suc-card-sel    { background: var(--suc-card-sel); }
        .suc-text        { color: var(--suc-text); }
        .suc-muted       { color: var(--suc-muted); }
        .suc-pill        { background: var(--suc-pill-bg); border-color: var(--suc-border); color: var(--suc-pill-text); }
        .suc-border      { border-color: var(--suc-border); }

        /* ── Ícono flotante de tema (solo ícono, sin recuadro de botón) ── */
        .suc-theme-toggle {
            position: fixed; top: 18px; right: 18px; z-index: 50;
            width: 40px; height: 40px;
            display: flex; align-items: center; justify-content: center;
            color: var(--suc-muted); border: none; background: transparent;
            transition: color .15s ease; cursor: pointer;
        }
        .suc-theme-toggle:hover { color: var(--suc-text); }
    </style>
</head>

<body class="h-screen flex flex-col overflow-hidden">

    <!-- Toggle de tema (claro/oscuro) -->
    <button id="btnThemeToggle" class="suc-theme-toggle" title="Cambiar tema claro/oscuro" type="button"></button>

    <main class="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        <div class="w-full flex-1" id="root"></div>
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
    <script src="../src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>

    <!-- Módulo Sucursales -->
    <script src="src/js/app.js?t=<?php echo time(); ?>"></script>
</body>

</html>
