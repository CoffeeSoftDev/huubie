<?php require_once("../../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <title>Calendario de Pedidos</title>

    <?php require_once(__DIR__ . '/../../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/../../layout/core-libraries.php'); ?>

    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap" rel="stylesheet">

    <!-- Modulo: dependencias especificas de calendario -->
    <link rel="stylesheet" href="https://code.jquery.com/ui/1.13.2/themes/base/jquery-ui.css">
    <script src="https://code.jquery.com/ui/1.13.2/jquery-ui.min.js"></script>

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.0.0/animate.compat.css" />

    <!-- rrule + FullCalendar (rrule debe ir antes del connector) -->
    <script src='https://cdn.jsdelivr.net/npm/rrule@2.6.4/dist/es5/rrule.min.js'></script>
    <script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.14/index.global.min.js'></script>
    <script src='https://cdn.jsdelivr.net/npm/@fullcalendar/moment@6.1.14/index.global.min.js'></script>
    <script src='https://cdn.jsdelivr.net/npm/@fullcalendar/rrule@6.1.14/index.global.min.js'></script>

    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

    <!-- Select2 -->
    <link rel="stylesheet" href="/app/src/plugins/select2/bootstrap/select2.min.css">
    <link rel="stylesheet" href="/app/src/plugins/select2/bootstrap/select2-bootstrap-5-theme.min.css">
    <script src="/app/src/plugins/select2/bootstrap/select2.min.js"></script>

    <!-- Modulo: override useFetch para rutas relativas del calendario -->
    <script>
        const originalUseFetch = window.useFetch;
        window.useFetch = function(options) {
            if (options && options.url && options.url.startsWith('../access/')) {
                options.url = '../../access/' + options.url.substring(10);
            }
            return originalUseFetch(options);
        };
    </script>

    <!-- Modulo: estilos especificos de calendario -->
    <style>
        /* Ocultar scrollbar en toda la aplicación */
        ::-webkit-scrollbar {
            width: 0px !important;
            background: transparent !important;
        }

        /* Para Firefox */
        * {
            scrollbar-width: none !important;
        }

        /* 🔮 Glassmorphism púrpura — cristal real */
        .glass-purple-btn {
            background: linear-gradient(
                135deg,
                rgba(168, 85, 247, 0.25) 0%,
                rgba(136, 2, 194, 0.15) 50%,
                rgba(88, 28, 135, 0.22) 100%
            );
            backdrop-filter: blur(18px) saturate(180%);
            -webkit-backdrop-filter: blur(18px) saturate(180%);
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.18);
            box-shadow:
                0 8px 32px rgba(88, 28, 135, 0.35),
                0 2px 8px rgba(0, 0, 0, 0.25),
                inset 0 1px 1px rgba(255, 255, 255, 0.35),
                inset 0 -1px 1px rgba(255, 255, 255, 0.08);
            position: relative;
            overflow: hidden;
            transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
            isolation: isolate;
        }

        .glass-purple-btn:hover {
            transform: translateY(-1px);
            box-shadow:
                0 8px 20px rgba(136, 2, 194, 0.45),
                0 4px 12px rgba(0, 0, 0, 0.3),
                inset 0 1px 1px rgba(255, 255, 255, 0.5),
                inset 0 -1px 1px rgba(255, 255, 255, 0.1);
        }

        /* Reflejo superior (highlight tipo vidrio) */
        .glass-purple-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 50%;
            background: linear-gradient(
                180deg,
                rgba(255, 255, 255, 0.22) 0%,
                rgba(255, 255, 255, 0.05) 60%,
                transparent 100%
            );
            border-radius: 20px 20px 50% 50% / 20px 20px 100% 100%;
            pointer-events: none;
            z-index: 1;
        }

        /* Brillo diagonal sutil */
        .glass-purple-btn::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(
                120deg,
                transparent 0%,
                transparent 40%,
                rgba(255, 255, 255, 0.15) 50%,
                transparent 60%,
                transparent 100%
            );
            pointer-events: none;
            z-index: 0;
        }

        .glass-purple-btn > * {
            position: relative;
            z-index: 2;
        }
    </style>
</head>

<body class="bg-[#111928] text-white" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <div id="mainContainer" class="w-full min-h-screen flex flex-col text-white overflow-x-hidden mt-16">
        <div style="background-color:#111827;" class="w-full max-w-full overflow-x-auto" id="root"></div>
    </div>

    <!-- Modulo Scripts -->
    <script src="/app/pedidos/src/js/pedidos-catalogo.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/calendario-pedidos.js?t=<?php echo time(); ?>"></script>
</body>

</html>
