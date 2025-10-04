<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once '../mdl/mdl-dashboard.php';

class Dashboard extends MDashboard {
    
    function init() {
        return [
            'status' => $this->lsStatus(),
            'subsidiaries' => $this->getSucursalByID([$_SESSION['SUB']])
        ];
    }

    // Enhanced Dashboard Statistics with KPIs
    function getDashboardStats() {
        $status = 500;
        $message = 'Error al obtener estadísticas';
        $data = [];

        try {
            $mes = $_POST['mes'] ?? date('m');
            $anio = $_POST['anio'] ?? date('Y');
            
            // Obtener estadísticas generales
            $totalOrders = $this->getTotalOrders();
            $todayOrders = $this->getTodayOrders();
            $pendingOrders = $this->getPendingOrders();
            $completedOrders = $this->getCompletedOrders();
            $cancelledOrders = $this->getCancelledOrders();
            
            // Obtener ingresos con filtros de período
            $totalRevenue = $this->getTotalRevenue();
            $todayRevenue = $this->getTodayRevenue();
            $monthRevenue = $this->getMonthRevenue([$mes, $anio]);
            $previousMonthRevenue = $this->getPreviousMonthRevenue([$mes, $anio]);
            
            // Calcular KPIs avanzados
            $avgOrderValue = $this->getAverageOrderValue([$mes, $anio]);
            $conversionRate = $this->getConversionRate([$mes, $anio]);
            $growthRate = $this->calculateGrowthRate($monthRevenue, $previousMonthRevenue);
            $fulfillmentRate = $this->getFulfillmentRate([$mes, $anio]);
            
            // Obtener datos para comparación
            $previousMonthOrders = $this->getPreviousMonthOrders([$mes, $anio]);
            $ordersGrowth = $this->calculateGrowthRate($totalOrders, $previousMonthOrders);
            
            // Obtener pedidos por estado
            $ordersByStatus = $this->getOrdersByStatus();
            
            // Obtener productos más vendidos del período
            $topProducts = $this->getTopProducts([$mes, $anio]);
            
            // Obtener pedidos recientes
            $recentOrders = $this->getRecentOrders();

            $data = [
                'stats' => [
                    'total_orders' => $totalOrders,
                    'today_orders' => $todayOrders,
                    'pending_orders' => $pendingOrders,
                    'completed_orders' => $completedOrders,
                    'cancelled_orders' => $cancelledOrders,
                    'orders_growth' => $ordersGrowth
                ],
                'revenue' => [
                    'total' => $totalRevenue,
                    'today' => $todayRevenue,
                    'month' => $monthRevenue,
                    'previous_month' => $previousMonthRevenue,
                    'growth_rate' => $growthRate
                ],
                'kpis' => [
                    'avg_order_value' => $avgOrderValue,
                    'conversion_rate' => $conversionRate,
                    'fulfillment_rate' => $fulfillmentRate,
                    'orders_per_day' => $this->getOrdersPerDay([$mes, $anio])
                ],
                'ordersByStatus' => $ordersByStatus,
                'topProducts' => $topProducts,
                'recentOrders' => $recentOrders
            ];

            $status = 200;
            $message = 'Estadísticas obtenidas correctamente';
            
        } catch (Exception $e) {
            $message = 'Error: ' . $e->getMessage();
            error_log("Dashboard Stats Error: " . $e->getMessage());
        }

        return [
            'status' => $status,
            'message' => $message,
            'data' => $data
        ];
    }

    // Obtener pedidos por rango de fechas para gráficos
    function getOrdersChart() {
        $status = 500;
        $message = 'Error al obtener datos del gráfico';
        $data = [];

        try {
            $startDate = $_POST['start_date'] ?? date('Y-m-01'); // Primer día del mes
            $endDate = $_POST['end_date'] ?? date('Y-m-d'); // Hoy
            
            $chartData = $this->getOrdersChartData([$startDate, $endDate]);
            
            $data = [
                'labels' => array_column($chartData, 'date'),
                'orders' => array_column($chartData, 'total_orders'),
                'revenue' => array_column($chartData, 'total_revenue')
            ];

            $status = 200;
            $message = 'Datos del gráfico obtenidos correctamente';
            
        } catch (Exception $e) {
            $message = 'Error: ' . $e->getMessage();
        }

        return [
            'status' => $status,
            'message' => $message,
            'data' => $data
        ];
    }

    // Obtener resumen de pedidos por período
    function getOrdersSummary() {
        $status = 500;
        $message = 'Error al obtener resumen';
        $data = [];

        try {
            $period = $_POST['period'] ?? 'today'; // today, week, month, year
            
            switch ($period) {
                case 'today':
                    $data = $this->getTodaySummary();
                    break;
                case 'week':
                    $data = $this->getWeekSummary();
                    break;
                case 'month':
                    $data = $this->getMonthSummary();
                    break;
                case 'year':
                    $data = $this->getYearSummary();
                    break;
                default:
                    $data = $this->getTodaySummary();
            }

            $status = 200;
            $message = 'Resumen obtenido correctamente';
            
        } catch (Exception $e) {
            $message = 'Error: ' . $e->getMessage();
        }

        return [
            'status' => $status,
            'message' => $message,
            'data' => $data
        ];
    }

    // Enhanced Chart Data with Advanced Analytics
    function getChartData() {
        $status = 500;
        $message = 'Error al obtener datos del gráfico';
        $data = [];

        try {
            $mes = $_POST['mes'] ?? date('m');
            $anio = $_POST['anio'] ?? date('Y');
            $chartType = $_POST['chart_type'] ?? 'all';
            
            // Validar parámetros
            if (!$this->validateDateParams($mes, $anio)) {
                throw new Exception('Parámetros de fecha inválidos');
            }
            
            $chartData = [];
            
            // Obtener distribución por estado del período seleccionado
            if ($chartType === 'all' || $chartType === 'status') {
                $statusDistribution = $this->getStatusDistribution([$mes, $anio]);
                $chartData['statusDistribution'] = [
                    'labels' => array_column($statusDistribution, 'status_name'),
                    'data' => array_column($statusDistribution, 'total'),
                    'colors' => $this->getStatusColors(),
                    'total' => array_sum(array_column($statusDistribution, 'total'))
                ];
            }
            
            // Obtener tendencia mensual del año
            if ($chartType === 'all' || $chartType === 'monthly') {
                $monthlyTrend = $this->getMonthlyTrend([$anio]);
                $chartData['monthlyTrend'] = [
                    'labels' => array_column($monthlyTrend, 'month_name'),
                    'orders' => array_column($monthlyTrend, 'total_orders'),
                    'revenue' => array_column($monthlyTrend, 'total_revenue'),
                    'avg_order_value' => array_column($monthlyTrend, 'avg_order_value')
                ];
            }
            
            // Obtener tendencia diaria del mes seleccionado
            if ($chartType === 'all' || $chartType === 'daily') {
                $dailyTrend = $this->getDailyTrend([$mes, $anio]);
                $chartData['dailyTrend'] = [
                    'labels' => array_column($dailyTrend, 'day'),
                    'orders' => array_column($dailyTrend, 'total_orders'),
                    'revenue' => array_column($dailyTrend, 'total_revenue')
                ];
            }
            
            // Obtener comparación con período anterior
            if ($chartType === 'all' || $chartType === 'comparison') {
                $comparison = $this->getPeriodComparison([$mes, $anio]);
                $chartData['comparison'] = $comparison;
            }
            
            // Obtener top productos con más detalle
            if ($chartType === 'all' || $chartType === 'products') {
                $topProductsChart = $this->getTopProductsChart([$mes, $anio]);
                $chartData['topProducts'] = [
                    'labels' => array_column($topProductsChart, 'product_name'),
                    'data' => array_column($topProductsChart, 'total_quantity'),
                    'revenue' => array_column($topProductsChart, 'total_revenue')
                ];
            }

            $data = $chartData;
            $status = 200;
            $message = 'Datos del gráfico obtenidos correctamente';
            
        } catch (Exception $e) {
            $message = 'Error: ' . $e->getMessage();
            error_log("Chart Data Error: " . $e->getMessage());
            
            // Datos de fallback mejorados
            $data = [
                'statusDistribution' => [
                    'labels' => ['Sin datos'],
                    'data' => [1],
                    'colors' => ['#6B7280'],
                    'total' => 1
                ],
                'monthlyTrend' => [
                    'labels' => [],
                    'orders' => [],
                    'revenue' => [],
                    'avg_order_value' => []
                ],
                'dailyTrend' => [
                    'labels' => [],
                    'orders' => [],
                    'revenue' => []
                ],
                'comparison' => [
                    'current_period' => 0,
                    'previous_period' => 0,
                    'growth_rate' => 0
                ],
                'topProducts' => [
                    'labels' => [],
                    'data' => [],
                    'revenue' => []
                ]
            ];
        }

        return [
            'status' => $status,
            'message' => $message,
            'data' => $data
        ];
    }



    // Enhanced Smart Alerts System
    function getDashboardAlerts() {
        $status = 500;
        $message = 'Error al obtener alertas';
        $data = [];

        try {
            $alerts = [];
            
            // Pedidos pendientes de hoy con prioridad
            $pendingToday = $this->getPendingOrdersToday();
            if ($pendingToday > 0) {
                $priority = $pendingToday > 5 ? 'high' : 'medium';
                $alerts[] = [
                    'id' => 'pending_today',
                    'type' => 'warning',
                    'priority' => $priority,
                    'title' => 'Pedidos Pendientes Hoy',
                    'message' => "Tienes {$pendingToday} pedidos pendientes para hoy",
                    'icon' => 'icon-clock',
                    'action_url' => '/pedidos?filter=pending&date=today',
                    'timestamp' => date('Y-m-d H:i:s')
                ];
            }
            
            // Pedidos vencidos (crítico)
            $overdueOrders = $this->getOverdueOrders();
            if ($overdueOrders > 0) {
                $alerts[] = [
                    'id' => 'overdue_orders',
                    'type' => 'danger',
                    'priority' => 'high',
                    'title' => 'Pedidos Vencidos',
                    'message' => "Hay {$overdueOrders} pedidos que ya pasaron su fecha de entrega",
                    'icon' => 'icon-attention',
                    'action_url' => '/pedidos?filter=overdue',
                    'timestamp' => date('Y-m-d H:i:s')
                ];
            }
            
            // Ingresos por debajo del promedio
            $currentRevenue = $this->getTodayRevenue();
            $avgDailyRevenue = $this->getAverageDailyRevenue();
            if ($currentRevenue < ($avgDailyRevenue * 0.7)) {
                $percentage = round((($avgDailyRevenue - $currentRevenue) / $avgDailyRevenue) * 100);
                $alerts[] = [
                    'id' => 'low_revenue',
                    'type' => 'warning',
                    'priority' => 'medium',
                    'title' => 'Ingresos Bajos',
                    'message' => "Los ingresos de hoy están {$percentage}% por debajo del promedio",
                    'icon' => 'icon-chart-down',
                    'action_url' => '/dashboard?view=revenue',
                    'timestamp' => date('Y-m-d H:i:s')
                ];
            }
            
            // Patrones inusuales en pedidos
            $unusualPatterns = $this->detectUnusualPatterns();
            if (!empty($unusualPatterns)) {
                foreach ($unusualPatterns as $pattern) {
                    $alerts[] = [
                        'id' => 'unusual_pattern_' . $pattern['type'],
                        'type' => 'info',
                        'priority' => 'low',
                        'title' => 'Patrón Inusual Detectado',
                        'message' => $pattern['message'],
                        'icon' => 'icon-chart-line',
                        'action_url' => '/analytics?pattern=' . $pattern['type'],
                        'timestamp' => date('Y-m-d H:i:s')
                    ];
                }
            }
            
            // Productos con bajo stock relacionados a pedidos
            $lowStockProducts = $this->getLowStockProducts();
            if (count($lowStockProducts) > 0) {
                $alerts[] = [
                    'id' => 'low_stock',
                    'type' => 'info',
                    'priority' => 'medium',
                    'title' => 'Stock Bajo',
                    'message' => count($lowStockProducts) . " productos tienen stock bajo",
                    'icon' => 'icon-box',
                    'action_url' => '/inventory?filter=low_stock',
                    'timestamp' => date('Y-m-d H:i:s')
                ];
            }
            
            // Alerta de rendimiento positivo
            $monthlyGrowth = $this->getMonthlyGrowthRate();
            if ($monthlyGrowth > 20) {
                $alerts[] = [
                    'id' => 'high_growth',
                    'type' => 'success',
                    'priority' => 'low',
                    'title' => 'Crecimiento Excelente',
                    'message' => "Crecimiento del {$monthlyGrowth}% este mes",
                    'icon' => 'icon-chart-up',
                    'action_url' => '/reports?type=growth',
                    'timestamp' => date('Y-m-d H:i:s')
                ];
            }

            // Ordenar alertas por prioridad
            usort($alerts, function($a, $b) {
                $priorities = ['high' => 3, 'medium' => 2, 'low' => 1];
                return $priorities[$b['priority']] - $priorities[$a['priority']];
            });

            $data = $alerts;
            $status = 200;
            $message = 'Alertas obtenidas correctamente';
            
        } catch (Exception $e) {
            $message = 'Error: ' . $e->getMessage();
            error_log("Dashboard Alerts Error: " . $e->getMessage());
        }

        return [
            'status' => $status,
            'message' => $message,
            'data' => $data
        ];
    }
    
    // Helper methods for enhanced functionality
    private function validateDateParams($mes, $anio) {
        return is_numeric($mes) && $mes >= 1 && $mes <= 12 && 
               is_numeric($anio) && $anio >= 2020 && $anio <= 2030;
    }
    
    private function getStatusColors() {
        return [
            '#3B82F6', // Azul - Cotización
            '#EAB308', // Amarillo - Pendiente  
            '#10B981', // Verde - Pagado
            '#EF4444'  // Rojo - Cancelado
        ];
    }
    
    private function calculateGrowthRate($current, $previous) {
        if ($previous == 0) return $current > 0 ? 100 : 0;
        return round((($current - $previous) / $previous) * 100, 2);
    }
}

// Funciones auxiliares
function formatCurrency($amount) {
    return '$' . number_format($amount, 2);
}

function getStatusBadge($status) {
    switch ($status) {
        case 1:
            return '<span class="bg-[#9EBBDB] text-[#2A55A3] text-xs font-semibold px-2 py-1 rounded">COTIZACIÓN</span>';
        case 2:
            return '<span class="bg-[#633112] text-[#F2C215] text-xs font-semibold px-2 py-1 rounded">PENDIENTE</span>';
        case 3:
            return '<span class="bg-[#014737] text-[#3FC189] text-xs font-semibold px-2 py-1 rounded">PAGADO</span>';
        case 4:
            return '<span class="bg-[#572A34] text-[#E05562] text-xs font-semibold px-2 py-1 rounded">CANCELADO</span>';
        default:
            return '<span class="bg-gray-500 text-white text-xs font-semibold px-2 py-1 rounded">DESCONOCIDO</span>';
    }
}

$obj = new Dashboard();
$fn = $_POST['opc'];
$encode = $obj->$fn();
echo json_encode($encode);
?>