<?php
/**
 * Dashboard Mermas — Resumen con datos reales de MySQL (produccion).
 * Ubicacion: app/inventarios/dashboard-mermas-resumen.php
 */

// ===================== CONFIG BD =====================
$host = 'localhost';
$user = 'root';
$pass = '';
$db   = 'fayxzvov_reginas';

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    die('Error de conexion: ' . $conn->connect_error);
}
$conn->set_charset('utf8mb4');

// ===================== KPIs =====================
$kpi = $conn->query("
    SELECT COUNT(*) AS total_mermas,
           COALESCE(SUM(total_cost_loss),0) AS total_costo,
           COALESCE(SUM(total_units),0) AS total_unidades
    FROM inventory_shrinkage
    WHERE active=1
")->fetch_assoc();

// Motivo top
$motivoTop = $conn->query("
    SELECT sr.name AS motivo, COUNT(*) AS cantidad
    FROM inventory_shrinkage sh
    JOIN shrinkage_reason sr ON sh.shrinkage_reason_id = sr.id
    WHERE sh.active=1
    GROUP BY sr.name
    ORDER BY cantidad DESC
    LIMIT 1
")->fetch_assoc();

// Mermas por dia (ultimos 30 dias para tendencia)
$trendRows = [];
$trendRes = $conn->query("
    SELECT DATE(created_at) AS fecha,
           COUNT(*) AS total_mermas,
           COALESCE(SUM(total_units),0) AS total_unidades,
           COALESCE(SUM(total_cost_loss),0) AS total_costo
    FROM inventory_shrinkage
    WHERE active=1 AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    GROUP BY DATE(created_at)
    ORDER BY fecha ASC
");
if ($trendRes) {
    while ($r = $trendRes->fetch_assoc()) $trendRows[] = $r;
}

// Si hay menos de 7 puntos, rellenar con 0 para que el grafico no se vea vacio
$labels = [];
$mermaData = [];
$metaData = [];
if (count($trendRows) > 0) {
    foreach ($trendRows as $r) {
        $d = new DateTime($r['fecha']);
        $labels[] = $d->format('j M');
        $mermaData[] = (int)$r['total_unidades'];
        $metaData[] = max(1, (int)($r['total_unidades'] * 0.7)); // meta simulada al 70%
    }
} else {
    $labels = [];
    $mermaData = [];
    $metaData = [];
}

// Motivos para doughnut
$motivos = [];
$motRes = $conn->query("
    SELECT sr.name AS motivo, COUNT(*) AS cantidad
    FROM inventory_shrinkage sh
    JOIN shrinkage_reason sr ON sh.shrinkage_reason_id = sr.id
    WHERE sh.active=1
    GROUP BY sr.name
    ORDER BY cantidad DESC
");
if ($motRes) {
    while ($r = $motRes->fetch_assoc()) $motivos[] = $r;
}

// Productos con mermas (detalle)
$productos = [];
$prodRes = $conn->query("
    SELECT p.name AS producto,
           SUM(d.quantity) AS unidades_merma,
           p.price,
           SUM(d.subtotal_loss) AS perdida,
           c.classification AS categoria
    FROM detail_inventory_shrinkage d
    JOIN inventory_shrinkage sh ON d.inventory_shrinkage_id = sh.id
    JOIN order_products p ON d.product_id = p.id
    LEFT JOIN order_category c ON p.category_id = c.id
    WHERE sh.active=1 AND d.active=1
    GROUP BY p.id, p.name, p.price, c.classification
    ORDER BY unidades_merma DESC
");
if ($prodRes) {
    while ($r = $prodRes->fetch_assoc()) $productos[] = $r;
}

// Registros completos de mermas
$mermas = [];
$mRes = $conn->query("
    SELECT sh.id, sh.folio, sh.total_products, sh.total_units, sh.total_cost_loss,
           sh.status, sh.created_at, sh.evidence_url,
           sr.name AS motivo, w.name AS almacen
    FROM inventory_shrinkage sh
    LEFT JOIN shrinkage_reason sr ON sh.shrinkage_reason_id = sr.id
    LEFT JOIN warehouse w ON sh.warehouse_id = w.id
    WHERE sh.active=1
    ORDER BY sh.created_at DESC
");
if ($mRes) {
    while ($r = $mRes->fetch_assoc()) $mermas[] = $r;
}

// Detalle por merma (para el modal)
$detallePorMerma = [];
if (count($mermas) > 0) {
    $ids = implode(',', array_column($mermas, 'id'));
    $dRes = $conn->query("
        SELECT d.inventory_shrinkage_id AS merma_id,
               p.name AS producto,
               d.quantity, d.cost, d.subtotal_loss
        FROM detail_inventory_shrinkage d
        JOIN order_products p ON d.product_id = p.id
        WHERE d.inventory_shrinkage_id IN ($ids) AND d.active=1
    ");
    if ($dRes) {
        while ($r = $dRes->fetch_assoc()) {
            $mid = $r['merma_id'];
            unset($r['merma_id']);
            $detallePorMerma[$mid][] = $r;
        }
    }
}

$conn->close();

// Helpers
function fmtMoney($v) {
    return '$' . number_format($v, 2);
}
function fmtDate($d) {
    $dt = new DateTime($d);
    return $dt->format('j M Y · H:i');
}

// Icono por motivo (mapeo basico)
function motivoColor($m) {
    $map = [
        'MERMA' => '#EA0234',
        'Caducidad' => '#EA0234',
        'Daniado' => '#fbbf24',
        'Error produccion' => '#1C64F2',
        'Robo/Faltante' => '#7C3AED',
        'Devolucion' => '#3FC189',
    ];
    return $map[$m] ?? '#9ca3af';
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dashboard Mermas — Resumen · FOGAJA · Huubie</title>

    <!-- Inter font -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

    <!-- Tailwind CDN -->
    <script src="https://cdn.tailwindcss.com"></script>

    <!-- Huubie UI Kit -->
    <link rel="stylesheet" href="../ui/css/ui-kit.css" />

    <!-- Lucide icons -->
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>

    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

    <style>
        body { font-family: 'Inter', system-ui, sans-serif; }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: #141d2b; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #4b5563; }
        .pulse-dot { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
        .alert-pulse { animation: alertPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes alertPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(234, 2, 52, 0.4); } 50% { box-shadow: 0 0 0 8px rgba(234, 2, 52, 0); } }
        /* Modal drawer */
        #detailDrawer { transform: translateX(100%); transition: transform .25s ease; }
        #detailDrawer.open { transform: translateX(0); }
        /* Print styles */
        @media print {
            aside, header button, .no-print { display: none !important; }
            main { margin: 0; padding: 0; }
            body { background: white; color: black; }
            .bg-\[\#1F2A37\] { background: #f3f4f6 !important; border: 1px solid #d1d5db !important; }
            .bg-\[\#141d2b\] { background: #f9fafb !important; }
            .text-white { color: #111 !important; }
            .text-gray-400, .text-gray-500 { color: #374151 !important; }
        }
    </style>
</head>

<body class="bg-[#111928] text-white h-screen flex flex-col overflow-hidden" data-bs-theme="dark">

    <!-- BACKDROP DETAIL -->
    <div id="drawerBackdrop" onclick="closeDrawer()" class="fixed inset-0 bg-black/50 z-40 hidden transition"></div>

    <!-- DRAWER DETALLE MERMA -->
    <div id="detailDrawer" class="fixed top-0 right-0 h-full w-[420px] max-w-full bg-[#111928] border-l border-gray-800 z-50 shadow-2xl flex flex-col">
        <div class="h-14 shrink-0 flex items-center justify-between px-5 border-b border-gray-800">
            <span class="text-sm font-bold text-white">Detalle de merma</span>
            <button onclick="closeDrawer()" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1F2A37] text-gray-400 hover:text-white transition">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        </div>
        <div id="drawerContent" class="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
            <!-- Se rellena via JS -->
        </div>
    </div>

    <div class="flex flex-1 min-h-0">

        <!-- ====================== SIDEBAR ====================== -->
        <aside class="w-56 shrink-0 bg-[#0f172a] border-r border-gray-800 flex flex-col">
            <div class="h-16 flex items-center gap-2 px-4 border-b border-gray-800">
                <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1C64F2] to-[#7C3AED] flex items-center justify-center">
                    <i data-lucide="chef-hat" class="w-4 h-4 text-white"></i>
                </div>
                <div class="flex flex-col leading-tight">
                    <span class="text-sm font-bold tracking-wide">FOGAJA</span>
                    <span class="text-[10px] text-gray-500 uppercase tracking-wider">Huubie v1.0</span>
                </div>
            </div>

            <nav class="flex-1 overflow-y-auto scrollbar-thin py-4 space-y-1">
                <div class="px-4 mb-2">
                    <p class="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Inventarios</p>
                </div>

                <a href="#" class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#1F2A37] hover:text-white transition">
                    <i data-lucide="layout-dashboard" class="w-4 h-4"></i>
                    Resumen
                </a>

                <div>
                    <button class="w-full flex items-center justify-between px-4 py-2.5 text-sm text-white bg-[#1F2A37] border-l-2 border-[#1C64F2]">
                        <span class="flex items-center gap-3">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                            Mermas
                        </span>
                        <i data-lucide="chevron-down" class="w-4 h-4"></i>
                    </button>
                    <ul class="bg-[#0a1220] py-1">
                        <li><a href="dashboard-mermas-resumen.php" class="flex items-center gap-2 pl-11 pr-4 py-2 text-xs bg-[#1C64F2]/10 text-[#1C64F2] border-l-2 border-[#1C64F2]">Resumen</a></li>
                        <li><a href="templates/dashboard-mermas/dashboard-mermas-analisis.html" class="flex items-center gap-2 pl-11 pr-4 py-2 text-xs text-gray-400 hover:text-white hover:bg-[#1F2A37] transition">Analisis por Producto</a></li>
                        <li><a href="templates/dashboard-mermas/dashboard-mermas-historico.html" class="flex items-center gap-2 pl-11 pr-4 py-2 text-xs text-gray-400 hover:text-white hover:bg-[#1F2A37] transition">Historico</a></li>
                        <li><a href="pos-mermas.php" class="flex items-center gap-2 pl-11 pr-4 py-2 text-xs text-gray-400 hover:text-white hover:bg-[#1F2A37] transition">Visor Mermas</a></li>
                    </ul>
                </div>

                <a href="#" class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#1F2A37] hover:text-white transition">
                    <i data-lucide="package-plus" class="w-4 h-4"></i>
                    Entradas
                </a>
                <a href="#" class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#1F2A37] hover:text-white transition">
                    <i data-lucide="boxes" class="w-4 h-4"></i>
                    Stock
                </a>
                <a href="#" class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#1F2A37] hover:text-white transition">
                    <i data-lucide="arrow-left-right" class="w-4 h-4"></i>
                    Traspasos
                </a>
                <a href="#" class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#1F2A37] hover:text-white transition">
                    <i data-lucide="package" class="w-4 h-4"></i>
                    Productos
                </a>

                <div class="px-4 mt-6 mb-2">
                    <p class="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Operacion</p>
                </div>
                <a href="#" class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#1F2A37] hover:text-white transition">
                    <i data-lucide="receipt" class="w-4 h-4"></i>
                    Ventas
                </a>
                <a href="#" class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#1F2A37] hover:text-white transition">
                    <i data-lucide="bar-chart-3" class="w-4 h-4"></i>
                    Reportes
                </a>
            </nav>

            <div class="border-t border-gray-800 p-3 flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-gradient-to-br from-[#1C64F2] to-[#7C3AED] flex items-center justify-center text-xs font-bold">RM</div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-semibold truncate">Rosy Martinez</p>
                    <p class="text-[10px] text-green-400 flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot"></span>
                        En linea
                    </p>
                </div>
                <button class="text-gray-500 hover:text-white">
                    <i data-lucide="log-out" class="w-4 h-4"></i>
                </button>
            </div>
        </aside>

        <!-- ====================== MAIN ====================== -->
        <main class="flex-1 flex flex-col min-w-0 min-h-0">

            <!-- HEADER -->
            <header class="h-16 shrink-0 bg-[#141d2b] border-b border-gray-800 flex items-center px-6 gap-4">
                <nav class="flex items-center gap-2 text-sm">
                    <i data-lucide="home" class="w-4 h-4 text-gray-500"></i>
                    <span class="text-gray-500">Inventarios</span>
                    <i data-lucide="chevron-right" class="w-3 h-3 text-gray-600"></i>
                    <span class="text-gray-500">Mermas</span>
                    <i data-lucide="chevron-right" class="w-3 h-3 text-gray-600"></i>
                    <span class="text-white font-medium">Resumen Ejecutivo</span>
                </nav>
                <div class="flex-1"></div>
                <div class="flex items-center gap-2 px-3 py-1.5 bg-[#1F2A37] rounded-lg border border-gray-700">
                    <i data-lucide="sun" class="w-4 h-4 text-yellow-400"></i>
                    <div class="flex flex-col leading-tight">
                        <span class="text-[10px] text-gray-500 uppercase tracking-wider">Turno</span>
                        <span class="text-xs font-semibold">Matutino · 06:00–14:00</span>
                    </div>
                </div>
                <div class="flex items-center gap-2 px-3 py-1.5 bg-[#1F2A37] rounded-lg border border-gray-700">
                    <i data-lucide="clock" class="w-4 h-4 text-[#1C64F2]"></i>
                    <div class="flex flex-col leading-tight">
                        <span class="text-[10px] text-gray-500 uppercase tracking-wider">Hora actual</span>
                        <span id="liveClock" class="text-xs font-semibold tabular-nums">--:--:--</span>
                    </div>
                </div>
                <button onclick="location.reload()" class="relative w-9 h-9 flex items-center justify-center rounded-lg bg-[#1F2A37] border border-gray-700 hover:border-[#1C64F2] transition" title="Actualizar">
                    <i data-lucide="refresh-cw" class="w-4 h-4 text-gray-300"></i>
                </button>
            </header>

            <!-- CONTENT -->
            <div class="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">

                <!-- HERO + ALERTAS CRITICAS -->
                <section class="bg-[#1F2A37] rounded-xl p-6 border border-gray-700/60">
                    <div class="flex items-start justify-between gap-6 flex-wrap">
                        <div>
                            <div class="flex items-center gap-3 mb-2">
                                <span class="px-2.5 py-1 rounded-md bg-[#1C64F2]/15 text-[#1C64F2] text-[10px] font-bold uppercase tracking-wider border border-[#1C64F2]/30">
                                    Produccion · FOGAJA
                                </span>
                                <span class="text-xs text-gray-500">Sucursal Centro · Cocina principal</span>
                            </div>
                            <h1 class="text-2xl font-bold tracking-tight">Resumen de Mermas</h1>
                            <p class="text-sm text-gray-400 mt-1">
                                Monitoreo en tiempo real de mermas del turno.
                                <span class="text-gray-300">Datos reales de produccion.</span>
                            </p>
                        </div>
                        <div class="flex items-center gap-3 no-print">
                            <button onclick="exportarCSV()" class="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1a2332] border border-gray-700 text-sm text-gray-300 hover:border-gray-500 transition">
                                <i data-lucide="download" class="w-4 h-4"></i>
                                Exportar CSV
                            </button>
                            <button onclick="window.print()" class="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1a2332] border border-gray-700 text-sm text-gray-300 hover:border-gray-500 transition">
                                <i data-lucide="file-text" class="w-4 h-4"></i>
                                Reporte PDF
                            </button>
                            <button onclick="location.href='pos-mermas.php'" class="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1C64F2] hover:bg-[#1a53d4] text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition">
                                <i data-lucide="plus" class="w-4 h-4"></i>
                                Registrar merma
                            </button>
                        </div>
                    </div>

                    <!-- Alertas criticas (dinamicas si hay productos con alta merma) -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
                        <?php if (count($productos) > 0): ?>
                        <div class="bg-[#EA0234]/10 border border-[#EA0234]/30 rounded-lg p-4 flex items-center gap-3 alert-pulse">
                            <div class="w-10 h-10 rounded-lg bg-[#EA0234]/20 flex items-center justify-center flex-shrink-0">
                                <i data-lucide="alert-octagon" class="w-5 h-5 text-[#EA0234]"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-white"><?php echo count($productos); ?> productos con merma registrada</p>
                                <p class="text-[11px] text-gray-400">Revisar tabla inferior para detalle por producto.</p>
                            </div>
                        </div>
                        <?php else: ?>
                        <div class="bg-[#3FC189]/10 border border-[#3FC189]/30 rounded-lg p-4 flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-[#3FC189]/20 flex items-center justify-center flex-shrink-0">
                                <i data-lucide="check-circle-2" class="w-5 h-5 text-[#3FC189]"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-white">Sin mermas registradas hoy</p>
                                <p class="text-[11px] text-gray-400">No hay datos de merma para el periodo actual.</p>
                            </div>
                        </div>
                        <?php endif; ?>

                        <div class="bg-[#fbbf24]/10 border border-[#fbbf24]/30 rounded-lg p-4 flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-[#fbbf24]/20 flex items-center justify-center flex-shrink-0">
                                <i data-lucide="trending-up" class="w-5 h-5 text-[#fbbf24]"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-white"><?php echo count($mermas); ?> registros totales</p>
                                <p class="text-[11px] text-gray-400">Acumulado en la base de datos.</p>
                            </div>
                        </div>

                        <div class="bg-[#3FC189]/10 border border-[#3FC189]/30 rounded-lg p-4 flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-[#3FC189]/20 flex items-center justify-center flex-shrink-0">
                                <i data-lucide="database" class="w-5 h-5 text-[#3FC189]"></i>
                            </div>
                            <div>
                                <p class="text-sm font-bold text-white">Datos en vivo</p>
                                <p class="text-[11px] text-gray-400">Conectado a MySQL produccion · <?php echo date('H:i:s'); ?></p>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- KPI CARDS -->
                <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="bg-[#1F2A37] rounded-xl p-5 border border-gray-700/60">
                        <div class="flex items-center justify-between mb-3">
                            <p class="text-xs text-gray-400 uppercase tracking-wider">Total mermas</p>
                            <div class="w-8 h-8 rounded-lg bg-[#EA0234]/15 flex items-center justify-center">
                                <i data-lucide="trash-2" class="w-4 h-4 text-[#EA0234]"></i>
                            </div>
                        </div>
                        <p class="text-3xl font-bold text-white"><?php echo (int)$kpi['total_mermas']; ?></p>
                        <p class="text-xs text-gray-500 mt-1">registros activos</p>
                    </div>
                    <div class="bg-[#1F2A37] rounded-xl p-5 border border-gray-700/60">
                        <div class="flex items-center justify-between mb-3">
                            <p class="text-xs text-gray-400 uppercase tracking-wider">Total unidades</p>
                            <div class="w-8 h-8 rounded-lg bg-[#3FC189]/15 flex items-center justify-center">
                                <i data-lucide="package" class="w-4 h-4 text-[#3FC189]"></i>
                            </div>
                        </div>
                        <p class="text-3xl font-bold text-white"><?php echo (int)$kpi['total_unidades']; ?></p>
                        <p class="text-xs text-gray-500 mt-1">unidades retiradas</p>
                    </div>
                    <div class="bg-[#1F2A37] rounded-xl p-5 border border-gray-700/60">
                        <div class="flex items-center justify-between mb-3">
                            <p class="text-xs text-gray-400 uppercase tracking-wider">Motivo top</p>
                            <div class="w-8 h-8 rounded-lg bg-[#fbbf24]/15 flex items-center justify-center">
                                <i data-lucide="alert-triangle" class="w-4 h-4 text-[#fbbf24]"></i>
                            </div>
                        </div>
                        <p class="text-2xl font-bold text-white truncate"><?php echo htmlspecialchars($motivoTop['motivo'] ?? 'N/A'); ?></p>
                        <p class="text-xs text-gray-500 mt-1"><?php echo (int)($motivoTop['cantidad'] ?? 0); ?> ocurrencias</p>
                    </div>
                    <div class="bg-[#1F2A37] rounded-xl p-5 border border-gray-700/60">
                        <div class="flex items-center justify-between mb-3">
                            <p class="text-xs text-gray-400 uppercase tracking-wider">Valor perdido</p>
                            <div class="w-8 h-8 rounded-lg bg-[#1C64F2]/15 flex items-center justify-center">
                                <i data-lucide="dollar-sign" class="w-4 h-4 text-[#1C64F2]"></i>
                            </div>
                        </div>
                        <p class="text-3xl font-bold text-white"><?php echo fmtMoney($kpi['total_costo']); ?></p>
                        <p class="text-xs text-gray-500 mt-1">MXN · acumulado</p>
                    </div>
                </section>

                <!-- GRAFICOS: Tendencia + Motivos -->
                <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- Tendencia 7 dias (o disponible) -->
                    <div class="lg:col-span-2 bg-[#1F2A37] rounded-xl p-5 border border-gray-700/60">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h2 class="text-sm font-bold text-white">Tendencia de mermas · Unidades por dia</h2>
                                <p class="text-xs text-gray-500 mt-0.5">Datos reales de la base de datos · ultimos registros</p>
                            </div>
                            <div class="flex items-center gap-3 text-xs text-gray-400">
                                <span class="flex items-center gap-1.5"><span class="w-3 h-1 rounded-full bg-[#EA0234]"></span>Merma real</span>
                                <span class="flex items-center gap-1.5"><span class="w-3 h-1 rounded-full bg-[#3FC189] border-b border-dashed"></span>Meta</span>
                            </div>
                        </div>
                        <div class="h-[260px]">
                            <canvas id="trendChart"></canvas>
                        </div>
                    </div>

                    <!-- Top motivos -->
                    <div class="bg-[#1F2A37] rounded-xl p-5 border border-gray-700/60">
                        <h2 class="text-sm font-bold text-white mb-1">Top motivos de merma</h2>
                        <p class="text-xs text-gray-500 mb-4">Distribucion por tipo de perdida · datos reales</p>
                        <div class="h-[200px] mb-4">
                            <canvas id="motivosChart"></canvas>
                        </div>
                        <div class="space-y-2">
                            <?php
                            $motColors = ['#EA0234','#fbbf24','#1C64F2','#7C3AED','#3FC189','#F97316'];
                            foreach ($motivos as $i => $m):
                                $color = $motColors[$i % count($motColors)];
                                $pct = $kpi['total_mermas'] > 0 ? round(($m['cantidad']/$kpi['total_mermas'])*100,1) : 0;
                            ?>
                            <div class="flex items-center justify-between text-xs">
                                <span class="flex items-center gap-2 text-gray-300"><span class="w-2 h-2 rounded-full" style="background:<?php echo $color; ?>"></span><?php echo htmlspecialchars($m['motivo']); ?></span>
                                <span class="font-bold text-white"><?php echo $pct; ?>%</span>
                            </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                </section>

                <!-- TABLA: Registros de merma -->
                <section class="bg-[#1F2A37] rounded-xl border border-gray-700/60 overflow-hidden">
                    <div class="px-5 py-4 border-b border-gray-700/60 flex items-center justify-between">
                        <div>
                            <h2 class="text-sm font-bold text-white">Registros de merma · Datos reales</h2>
                            <p class="text-xs text-gray-500 mt-0.5"><?php echo count($mermas); ?> mermas registradas en el sistema</p>
                        </div>
                        <button onclick="exportarCSV()" class="no-print flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a2332] border border-gray-700 text-xs text-gray-300 hover:border-gray-500 transition">
                            <i data-lucide="download" class="w-3.5 h-3.5"></i>
                            Descargar CSV
                        </button>
                    </div>
                    <div class="overflow-x-auto scrollbar-thin">
                        <table class="cs-table" id="tablaMermas">
                            <thead>
                                <tr>
                                    <th class="text-left">Folio</th>
                                    <th class="text-left">Motivo</th>
                                    <th class="text-left">Almacen</th>
                                    <th class="text-right">Productos</th>
                                    <th class="text-right">Unidades</th>
                                    <th class="text-right">Costo</th>
                                    <th class="text-left">Fecha</th>
                                    <th>Estado</th>
                                    <th class="text-right no-print">Accion</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($mermas as $m): ?>
                                <tr class="hover:bg-[#1a2332] transition">
                                    <td class="text-sm font-semibold text-white"><?php echo htmlspecialchars($m['folio']); ?></td>
                                    <td class="text-xs text-gray-400"><?php echo htmlspecialchars($m['motivo'] ?? 'N/A'); ?></td>
                                    <td class="text-xs text-gray-400"><?php echo htmlspecialchars($m['almacen'] ?? 'N/A'); ?></td>
                                    <td class="text-right tabular-nums text-white"><?php echo (int)$m['total_products']; ?></td>
                                    <td class="text-right tabular-nums font-bold text-white"><?php echo (int)$m['total_units']; ?></td>
                                    <td class="text-right tabular-nums text-white"><?php echo fmtMoney($m['total_cost_loss']); ?></td>
                                    <td class="text-xs text-gray-400"><?php echo fmtDate($m['created_at']); ?></td>
                                    <td><span class="cs-badge cs-badge-success"><?php echo htmlspecialchars($m['status']); ?></span></td>
                                    <td class="text-right no-print">
                                        <button onclick="verDetalle(<?php echo (int)$m['id']; ?>)" class="cs-btn cs-btn-ghost cs-btn-sm">
                                            <i data-lucide="eye" class="w-3.5 h-3.5"></i> Ver
                                        </button>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                                <?php if (count($mermas) === 0): ?>
                                <tr>
                                    <td colspan="9" class="text-center py-8 text-gray-500 text-sm">No hay registros de merma en la base de datos.</td>
                                </tr>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- TABLA: Productos con merma -->
                <section class="bg-[#1F2A37] rounded-xl border border-gray-700/60 overflow-hidden">
                    <div class="px-5 py-4 border-b border-gray-700/60">
                        <h2 class="text-sm font-bold text-white">Productos afectados · Detalle por articulo</h2>
                        <p class="text-xs text-gray-500 mt-0.5"><?php echo count($productos); ?> productos distintos con merma registrada</p>
                    </div>
                    <div class="overflow-x-auto scrollbar-thin">
                        <table class="cs-table">
                            <thead>
                                <tr>
                                    <th class="text-left">Producto</th>
                                    <th class="text-left">Categoria</th>
                                    <th class="text-right">Unidades merma</th>
                                    <th class="text-right">Precio</th>
                                    <th class="text-right">Perdida</th>
                                    <th class="text-right no-print">Accion</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($productos as $p): ?>
                                <tr class="hover:bg-[#1a2332] transition">
                                    <td>
                                        <div class="flex items-center gap-3">
                                            <div class="w-8 h-8 rounded-lg bg-[#1C64F2]/15 flex items-center justify-center text-[#1C64F2]">
                                                <i data-lucide="package" class="w-4 h-4"></i>
                                            </div>
                                            <div>
                                                <p class="text-sm font-semibold text-white"><?php echo htmlspecialchars($p['producto']); ?></p>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="text-xs text-gray-400"><?php echo htmlspecialchars($p['categoria'] ?? 'Sin categoria'); ?></td>
                                    <td class="text-right tabular-nums font-bold text-white"><?php echo (int)$p['unidades_merma']; ?></td>
                                    <td class="text-right tabular-nums text-gray-400"><?php echo fmtMoney($p['price']); ?></td>
                                    <td class="text-right tabular-nums font-semibold text-[#EA0234]"><?php echo fmtMoney($p['perdida']); ?></td>
                                    <td class="text-right no-print">
                                        <button onclick="marcarAtendido(this)" class="text-[11px] px-3 py-1.5 rounded-md border border-gray-600 text-gray-300 hover:border-gray-400 transition">
                                            Marcar atendido
                                        </button>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                                <?php if (count($productos) === 0): ?>
                                <tr>
                                    <td colspan="6" class="text-center py-8 text-gray-500 text-sm">No hay productos con merma registrada.</td>
                                </tr>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- FOOTER -->
                <footer class="text-center text-[11px] text-gray-600 pt-4 pb-2">
                    <p>© 2026 FOGAJA · Huubie POS · Dashboard Mermas — Resumen Ejecutivo · Datos reales</p>
                </footer>

            </div>
        </main>
    </div>

    <script>
        if (window.lucide) lucide.createIcons();

        // Reloj en vivo
        const clockEl = document.getElementById('liveClock');
        const pad = (n) => String(n).padStart(2, '0');
        const tick = () => {
            const d = new Date();
            clockEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        };
        tick();
        setInterval(tick, 1000);

        // Chart.js — Tendencia (datos reales desde PHP)
        const labels = <?php echo json_encode($labels); ?>;
        const mermaData = <?php echo json_encode($mermaData); ?>;
        const metaData  = <?php echo json_encode($metaData); ?>;

        if (labels.length > 0) {
            const ctxTrend = document.getElementById('trendChart').getContext('2d');
            new Chart(ctxTrend, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Merma real (uds)',
                            data: mermaData,
                            borderColor: '#EA0234',
                            backgroundColor: 'rgba(234, 2, 52, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 4,
                            pointBackgroundColor: '#EA0234',
                            pointBorderColor: '#1F2A37',
                            pointBorderWidth: 2
                        },
                        {
                            label: 'Margen aceptable',
                            data: metaData,
                            borderColor: '#3FC189',
                            backgroundColor: 'transparent',
                            borderDash: [5, 5],
                            fill: false,
                            tension: 0.4,
                            pointRadius: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#1F2A37',
                            titleColor: '#fff',
                            bodyColor: '#d1d5db',
                            borderColor: '#374151',
                            borderWidth: 1,
                            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} uds` }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: '#374151', drawBorder: false },
                            ticks: { color: '#9ca3af', font: { size: 10 } }
                        },
                        y: {
                            grid: { color: '#374151', drawBorder: false },
                            ticks: { color: '#9ca3af', font: { size: 10 } },
                            beginAtZero: true
                        }
                    }
                }
            });
        } else {
            document.getElementById('trendChart').parentElement.innerHTML =
                '<div class="h-full flex flex-col items-center justify-center text-gray-500 text-sm">' +
                '<i data-lucide="bar-chart-2" class="w-8 h-8 mb-2 opacity-50"></i>' +
                'No hay datos suficientes para mostrar la tendencia.</div>';
            lucide.createIcons();
        }

        // Chart.js — Motivos (datos reales desde PHP)
        const motivosLabels = <?php echo json_encode(array_column($motivos, 'motivo')); ?>;
        const motivosData = <?php echo json_encode(array_column($motivos, 'cantidad')); ?>;
        const motivosColors = ['#EA0234','#fbbf24','#1C64F2','#7C3AED','#3FC189','#F97316'];

        if (motivosData.length > 0) {
            const ctxMotivos = document.getElementById('motivosChart').getContext('2d');
            new Chart(ctxMotivos, {
                type: 'doughnut',
                data: {
                    labels: motivosLabels,
                    datasets: [{
                        data: motivosData,
                        backgroundColor: motivosColors.slice(0, motivosData.length),
                        borderColor: '#1F2A37',
                        borderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#1F2A37',
                            titleColor: '#fff',
                            bodyColor: '#d1d5db',
                            borderColor: '#374151',
                            borderWidth: 1
                        }
                    }
                }
            });
        } else {
            document.getElementById('motivosChart').parentElement.innerHTML =
                '<div class="h-full flex flex-col items-center justify-center text-gray-500 text-sm">' +
                '<i data-lucide="pie-chart" class="w-8 h-8 mb-2 opacity-50"></i>' +
                'Sin datos de motivos.</div>';
            lucide.createIcons();
        }

        // ===================== FUNCIONALIDAD BOTONES =====================

        // Exportar CSV (desde tabla de mermas)
        function exportarCSV() {
            const tabla = document.getElementById('tablaMermas');
            if (!tabla) return;
            let csv = [];
            const rows = tabla.querySelectorAll('tr');
            rows.forEach(row => {
                const cols = row.querySelectorAll('td, th');
                const line = Array.from(cols).map(col => {
                    let txt = col.innerText.replace(/\s+/g, ' ').trim();
                    txt = txt.replace(/"/g, '""');
                    return `"${txt}"`;
                }).join(',');
                csv.push(line);
            });
            const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mermas_resumen_${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // Ver detalle (drawer)
        const detallePorMerma = <?php echo json_encode($detallePorMerma); ?>;
        const mermasData = <?php echo json_encode($mermas); ?>;

        function verDetalle(mermaId) {
            const drawer = document.getElementById('detailDrawer');
            const backdrop = document.getElementById('drawerBackdrop');
            const content = document.getElementById('drawerContent');
            const merma = mermasData.find(m => m.id == mermaId);
            const detalle = detallePorMerma[mermaId] || [];

            let html = '';
            if (merma) {
                html += `
                    <div class="bg-[#141d2b] rounded-lg p-4 border border-gray-700/60 mb-4">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-gray-500">Folio</span>
                            <span class="text-sm font-bold text-white">${merma.folio}</span>
                        </div>
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-gray-500">Estado</span>
                            <span class="cs-badge cs-badge-success">${merma.status}</span>
                        </div>
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-gray-500">Fecha</span>
                            <span class="text-xs text-white">${merma.created_at ? new Date(merma.created_at).toLocaleString('es-MX') : '-'}</span>
                        </div>
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs text-gray-500">Almacen</span>
                            <span class="text-xs text-white">${merma.almacen || 'N/A'}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-gray-500">Motivo</span>
                            <span class="text-xs text-white">${merma.motivo || 'N/A'}</span>
                        </div>
                    </div>

                    <p class="text-xs font-bold text-white mb-2">Productos en esta merma</p>
                `;
            }

            if (detalle.length > 0) {
                html += '<div class="space-y-2">';
                detalle.forEach(item => {
                    html += `
                        <div class="bg-[#141d2b] rounded-lg p-3 border border-gray-700/60">
                            <div class="flex items-center justify-between mb-1">
                                <span class="text-xs font-semibold text-white">${item.producto}</span>
                                <span class="text-xs font-bold text-[#EA0234]">-$${Number(item.subtotal_loss).toFixed(2)}</span>
                            </div>
                            <div class="flex items-center gap-3 text-[10px] text-gray-500">
                                <span>Cantidad: ${item.quantity}</span>
                                <span>Costo unit: $${Number(item.cost).toFixed(2)}</span>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            } else {
                html += '<p class="text-xs text-gray-500">Sin productos vinculados.</p>';
            }

            content.innerHTML = html;
            backdrop.classList.remove('hidden');
            drawer.classList.add('open');
            if (window.lucide) setTimeout(() => lucide.createIcons(), 50);
        }

        function closeDrawer() {
            document.getElementById('detailDrawer').classList.remove('open');
            document.getElementById('drawerBackdrop').classList.add('hidden');
        }

        // Marcar atendido (toggle visual)
        function marcarAtendido(btn) {
            btn.classList.toggle('bg-[#3FC189]');
            btn.classList.toggle('text-white');
            btn.classList.toggle('border-transparent');
            if (btn.textContent.trim() === 'Marcar atendido') {
                btn.textContent = 'Atendido';
                btn.disabled = true;
            }
        }
    </script>
</body>
</html>
