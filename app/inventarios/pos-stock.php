<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <title>POS — Visor de Stock</title>

    <?php require_once(__DIR__ . '/../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/../layout/core-libraries.php'); ?>

    <!-- El scroll vive dentro de #mainContainer (body overflow-hidden), por lo que el
         gutter global de head.php solo dejaria una franja muerta junto al navbar. -->
    <style>
        html { scrollbar-gutter: auto; }

        /* Scrollbars con la paleta Huubie dark (acotadas al modulo, no globales).
           Track translucido sobre los paneles #141d2b/#1F2A37, thumb gris-borde
           (#374151) y hover en el morado de marca (#7C3AED). */
        #POSStock *,
        .cs-scroll {
            scrollbar-width: thin;                       /* Firefox */
            scrollbar-color: #374151 transparent;        /* thumb | track */
        }
        #POSStock ::-webkit-scrollbar,
        .cs-scroll::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        #POSStock ::-webkit-scrollbar-track,
        .cs-scroll::-webkit-scrollbar-track {
            background: transparent;
        }
        #POSStock ::-webkit-scrollbar-thumb,
        .cs-scroll::-webkit-scrollbar-thumb {
            background: #374151;
            border-radius: 9999px;
            border: 2px solid transparent;               /* aire alrededor del thumb */
            background-clip: padding-box;
        }
        #POSStock ::-webkit-scrollbar-thumb:hover,
        .cs-scroll::-webkit-scrollbar-thumb:hover {
            background: #7C3AED;                          /* accent morado Huubie */
            background-clip: padding-box;
        }
        #POSStock ::-webkit-scrollbar-corner,
        .cs-scroll::-webkit-scrollbar-corner {
            background: transparent;
        }
    </style>
</head>

<body class="bg-[#111928] text-white h-screen flex flex-col overflow-hidden" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <div id="mainContainer" class="flex-1 w-full transition-all duration-500 bg-[#111928] text-white overflow-hidden flex flex-col min-h-0">
        <div class="bg-[#111928] flex-1 flex flex-col min-h-0" id="root"></div>
    </div>

    <script src="/app/inventarios/src/js/pos-stock.js?t=<?php echo time(); ?>"></script>
</body>

</html>
