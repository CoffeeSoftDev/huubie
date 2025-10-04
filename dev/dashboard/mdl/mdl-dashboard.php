<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class MDashboard extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_coffee.';
    }

    // Status list
    function lsStatus() {
        $query = "SELECT id as id, status as valor FROM {$this->bd}status_process";
        return $this->_Read($query, null);
    }

    // Sucursal info
    function getSucursalByID($array) {
        $query = "
            SELECT
                fayxzvov_alpha.subsidiaries.id AS idSucursal,
                fayxzvov_admin.companies.id AS idCompany,
                fayxzvov_admin.companies.social_name as name,
                fayxzvov_alpha.subsidiaries.`name` as sucursal
            FROM
                fayxzvov_alpha.subsidiaries
            INNER JOIN fayxzvov_admin.companies ON fayxzvov_alpha.subsidiaries.companies_id = fayxzvov_admin.companies.id
            WHERE subsidiaries.id = ?
        ";
        return $this->_Read($query, $array)[0];
    }

    // Dashboard Statistics Methods
    function getTotalOrders() {
        $query = "SELECT COUNT(*) as total FROM {$this->bd}order WHERE subsidiaries_id = ?";
        $result = $this->_Read($query, [$_SESSION['SUB']]);
        return $result[0]['total'] ?? 0;
    }

    function getTodayOrders() {
        $query = "
            SELECT COUNT(*) as total 
            FROM {$this->bd}order 
            WHERE DATE(date_creation) = CURDATE() 
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$_SESSION['SUB']]);
        return $result[0]['total'] ?? 0;
    }

    function getPendingOrders() {
        $query = "
            SELECT COUNT(*) as total 
            FROM {$this->bd}order 
            WHERE status = 2 
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$_SESSION['SUB']]);
        return $result[0]['total'] ?? 0;
    }

    function getCompletedOrders() {
        $query = "
            SELECT COUNT(*) as total 
            FROM {$this->bd}order 
            WHERE status = 3 
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$_SESSION['SUB']]);
        return $result[0]['total'] ?? 0;
    }

    // Revenue Methods
    function getTotalRevenue() {
        $query = "
            SELECT COALESCE(SUM(total_pay), 0) as total 
            FROM {$this->bd}order 
            WHERE status IN (2, 3) 
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$_SESSION['SUB']]);
        return $result[0]['total'] ?? 0;
    }

    function getTodayRevenue() {
        $query = "
            SELECT COALESCE(SUM(total_pay), 0) as total 
            FROM {$this->bd}order 
            WHERE DATE(date_creation) = CURDATE() 
            AND status IN (2, 3) 
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$_SESSION['SUB']]);
        return $result[0]['total'] ?? 0;
    }

    // function getMonthRevenue() {
    //     $query = "
    //         SELECT COALESCE(SUM(total_pay), 0) as total 
    //         FROM {$this->bd}order 
    //         WHERE MONTH(date_creation) = MONTH(CURDATE()) 
    //         AND YEAR(date_creation) = YEAR(CURDATE())
    //         AND status IN (2, 3) 
    //         AND subsidiaries_id = ?
    //     ";
    //     $result = $this->_Read($query, [$_SESSION['SUB']]);
    //     return $result[0]['total'] ?? 0;
    // }

    // Orders by Status
    function getOrdersByStatus() {
        $query = "
            SELECT 
                sp.status as status_name,
                sp.id as status_id,
                COUNT(o.id) as total
            FROM {$this->bd}status_process sp
            LEFT JOIN {$this->bd}order o ON sp.id = o.status AND o.subsidiaries_id = ?
            GROUP BY sp.id, sp.status
            ORDER BY sp.id
        ";
        return $this->_Read($query, [$_SESSION['SUB']]);
    }

    // Top Products
    // function getTopProducts() {
    //     $query = "
    //         SELECT 
    //             p.name as product_name,
    //             COUNT(op.id) as total_orders,
    //             SUM(op.quantity) as total_quantity,
    //             SUM(op.quantity * p.price) as total_revenue
    //         FROM {$this->bd}order_package op
    //         INNER JOIN {$this->bd}order_products p ON op.product_id = p.id
    //         INNER JOIN {$this->bd}order o ON op.pedidos_id = o.id
    //         WHERE o.subsidiaries_id = ?
    //         AND o.status IN (2, 3)
    //         GROUP BY p.id, p.name
    //         ORDER BY total_quantity DESC
    //         LIMIT 10
    //     ";
    //     return $this->_Read($query, [$_SESSION['SUB']]);
    // }

    // Recent Orders
    function getRecentOrders() {
        $query = "
            SELECT 
                o.id,
                oc.name as client_name,
                o.total_pay,
                o.date_creation,
                o.date_order,
                o.time_order,
                sp.status as status_name,
                o.status as status_id
            FROM {$this->bd}order o
            INNER JOIN {$this->bd}order_clients oc ON o.client_id = oc.id
            INNER JOIN {$this->bd}status_process sp ON o.status = sp.id
            WHERE o.subsidiaries_id = ?
            ORDER BY o.date_creation DESC
            LIMIT 10
        ";
        return $this->_Read($query, [$_SESSION['SUB']]);
    }

    // Chart Data
    function getOrdersChartData($array) {
        $query = "
            SELECT 
                DATE(date_creation) as date,
                COUNT(*) as total_orders,
                COALESCE(SUM(total_pay), 0) as total_revenue
            FROM {$this->bd}order
            WHERE date_creation BETWEEN ? AND ?
            AND subsidiaries_id = ?
            GROUP BY DATE(date_creation)
            ORDER BY date ASC
        ";
        $params = [$array[0], $array[1], $_SESSION['SUB']];
        return $this->_Read($query, $params);
    }

    // Summary Methods
    function getTodaySummary() {
        $query = "
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(total_pay), 0) as total_revenue,
                COUNT(CASE WHEN status = 2 THEN 1 END) as pending_orders,
                COUNT(CASE WHEN status = 3 THEN 1 END) as completed_orders
            FROM {$this->bd}order
            WHERE DATE(date_creation) = CURDATE()
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$_SESSION['SUB']]);
        return $result[0] ?? [];
    }

    function getWeekSummary() {
        $query = "
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(total_pay), 0) as total_revenue,
                COUNT(CASE WHEN status = 2 THEN 1 END) as pending_orders,
                COUNT(CASE WHEN status = 3 THEN 1 END) as completed_orders
            FROM {$this->bd}order
            WHERE WEEK(date_creation) = WEEK(CURDATE())
            AND YEAR(date_creation) = YEAR(CURDATE())
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$_SESSION['SUB']]);
        return $result[0] ?? [];
    }

    function getMonthSummary() {
        $query = "
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(total_pay), 0) as total_revenue,
                COUNT(CASE WHEN status = 2 THEN 1 END) as pending_orders,
                COUNT(CASE WHEN status = 3 THEN 1 END) as completed_orders
            FROM {$this->bd}order
            WHERE MONTH(date_creation) = MONTH(CURDATE())
            AND YEAR(date_creation) = YEAR(CURDATE())
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$_SESSION['SUB']]);
        return $result[0] ?? [];
    }

    function getYearSummary() {
        $query = "
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(total_pay), 0) as total_revenue,
                COUNT(CASE WHEN status = 2 THEN 1 END) as pending_orders,
                COUNT(CASE WHEN status = 3 THEN 1 END) as completed_orders
            FROM {$this->bd}order
            WHERE YEAR(date_creation) = YEAR(CURDATE())
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$_SESSION['SUB']]);
        return $result[0] ?? [];
    }

    // Alert Methods
    function getPendingOrdersToday() {
        $query = "
            SELECT COUNT(*) as total 
            FROM {$this->bd}order 
            WHERE DATE(date_order) = CURDATE() 
            AND status = 2 
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$_SESSION['SUB']]);
        return $result[0]['total'] ?? 0;
    }

    function getOverdueOrders() {
        $query = "
            SELECT COUNT(*) as total 
            FROM {$this->bd}order 
            WHERE date_order < CURDATE() 
            AND status = 2 
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$_SESSION['SUB']]);
        return $result[0]['total'] ?? 0;
    }

    function getLowStockProducts() {
        // Esta función puede implementarse si tienes control de inventario
        // Por ahora retorna array vacío
        return [];
    }

    // Chart-specific methods
    function getStatusDistribution($array) {
        $mes = $array[0];
        $anio = $array[1];
        
        $query = "
            SELECT 
                sp.status as status_name,
                sp.id as status_id,
                COUNT(o.id) as total
            FROM {$this->bd}status_process sp
            LEFT JOIN {$this->bd}order o ON sp.id = o.status 
                AND o.subsidiaries_id = ?
                AND MONTH(o.date_creation) = ?
                AND YEAR(o.date_creation) = ?
            GROUP BY sp.id, sp.status
            HAVING total > 0
            ORDER BY sp.id
        ";
        return $this->_Read($query, [$_SESSION['SUB'], $mes, $anio]);
    }

    function getMonthlyTrend($array) {
        $anio = $array[0];
        
        $query = "
            SELECT 
                MONTH(date_creation) as month_num,
                MONTHNAME(date_creation) as month_name,
                COUNT(*) as total_orders,
                COALESCE(SUM(total_pay), 0) as total_revenue,
                COALESCE(AVG(total_pay), 0) as avg_order_value
            FROM {$this->bd}order
            WHERE YEAR(date_creation) = ?
            AND subsidiaries_id = ?
            GROUP BY MONTH(date_creation), MONTHNAME(date_creation)
            ORDER BY MONTH(date_creation)
        ";
        return $this->_Read($query, [$anio, $_SESSION['SUB']]);
    }

    // Enhanced KPI Methods
    function getCancelledOrders() {
        $query = "
            SELECT COUNT(*) as total 
            FROM {$this->bd}order 
            WHERE status = 4 
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$_SESSION['SUB']]);
        return $result[0]['total'] ?? 0;
    }

    function getMonthRevenue($array) {
        $mes = $array[0];
        $anio = $array[1];
        
        $query = "
            SELECT COALESCE(SUM(total_pay), 0) as total 
            FROM {$this->bd}order 
            WHERE MONTH(date_creation) = ? 
            AND YEAR(date_creation) = ?
            AND status IN (2, 3) 
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$mes, $anio, $_SESSION['SUB']]);
        return $result[0]['total'] ?? 0;
    }

    function getPreviousMonthRevenue($array) {
        $mes = $array[0];
        $anio = $array[1];
        
        // Calcular mes anterior
        $prevMes = $mes - 1;
        $prevAnio = $anio;
        if ($prevMes < 1) {
            $prevMes = 12;
            $prevAnio = $anio - 1;
        }
        
        $query = "
            SELECT COALESCE(SUM(total_pay), 0) as total 
            FROM {$this->bd}order 
            WHERE MONTH(date_creation) = ? 
            AND YEAR(date_creation) = ?
            AND status IN (2, 3) 
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$prevMes, $prevAnio, $_SESSION['SUB']]);
        return $result[0]['total'] ?? 0;
    }

    function getAverageOrderValue($array) {
        $mes = $array[0];
        $anio = $array[1];
        
        $query = "
            SELECT COALESCE(AVG(total_pay), 0) as avg_value 
            FROM {$this->bd}order 
            WHERE MONTH(date_creation) = ? 
            AND YEAR(date_creation) = ?
            AND status IN (2, 3) 
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$mes, $anio, $_SESSION['SUB']]);
        return round($result[0]['avg_value'] ?? 0, 2);
    }

    function getConversionRate($array) {
        $mes = $array[0];
        $anio = $array[1];
        
        $query = "
            SELECT 
                COUNT(*) as total_orders,
                COUNT(CASE WHEN status IN (2, 3) THEN 1 END) as converted_orders
            FROM {$this->bd}order 
            WHERE MONTH(date_creation) = ? 
            AND YEAR(date_creation) = ?
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$mes, $anio, $_SESSION['SUB']]);
        
        if ($result[0]['total_orders'] > 0) {
            return round(($result[0]['converted_orders'] / $result[0]['total_orders']) * 100, 2);
        }
        return 0;
    }

    function getFulfillmentRate($array) {
        $mes = $array[0];
        $anio = $array[1];
        
        $query = "
            SELECT 
                COUNT(*) as total_orders,
                COUNT(CASE WHEN status = 3 THEN 1 END) as fulfilled_orders
            FROM {$this->bd}order 
            WHERE MONTH(date_creation) = ? 
            AND YEAR(date_creation) = ?
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$mes, $anio, $_SESSION['SUB']]);
        
        if ($result[0]['total_orders'] > 0) {
            return round(($result[0]['fulfilled_orders'] / $result[0]['total_orders']) * 100, 2);
        }
        return 0;
    }

    function getOrdersPerDay($array) {
        $mes = $array[0];
        $anio = $array[1];
        
        $query = "
            SELECT 
                COUNT(*) as total_orders,
                COUNT(DISTINCT DATE(date_creation)) as active_days
            FROM {$this->bd}order 
            WHERE MONTH(date_creation) = ? 
            AND YEAR(date_creation) = ?
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$mes, $anio, $_SESSION['SUB']]);
        
        if ($result[0]['active_days'] > 0) {
            return round($result[0]['total_orders'] / $result[0]['active_days'], 2);
        }
        return 0;
    }

    function getPreviousMonthOrders($array) {
        $mes = $array[0];
        $anio = $array[1];
        
        // Calcular mes anterior
        $prevMes = $mes - 1;
        $prevAnio = $anio;
        if ($prevMes < 1) {
            $prevMes = 12;
            $prevAnio = $anio - 1;
        }
        
        $query = "
            SELECT COUNT(*) as total 
            FROM {$this->bd}order 
            WHERE MONTH(date_creation) = ? 
            AND YEAR(date_creation) = ?
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$prevMes, $prevAnio, $_SESSION['SUB']]);
        return $result[0]['total'] ?? 0;
    }

    // Enhanced Chart Methods
    function getDailyTrend($array) {
        $mes = $array[0];
        $anio = $array[1];
        
        $query = "
            SELECT 
                DAY(date_creation) as day,
                COUNT(*) as total_orders,
                COALESCE(SUM(total_pay), 0) as total_revenue
            FROM {$this->bd}order
            WHERE MONTH(date_creation) = ? 
            AND YEAR(date_creation) = ?
            AND subsidiaries_id = ?
            GROUP BY DAY(date_creation)
            ORDER BY DAY(date_creation)
        ";
        return $this->_Read($query, [$mes, $anio, $_SESSION['SUB']]);
    }

    function getPeriodComparison($array) {
        $mes = $array[0];
        $anio = $array[1];
        
        $currentPeriod = $this->getMonthRevenue([$mes, $anio]);
        $previousPeriod = $this->getPreviousMonthRevenue([$mes, $anio]);
        
        $growthRate = 0;
        if ($previousPeriod > 0) {
            $growthRate = round((($currentPeriod - $previousPeriod) / $previousPeriod) * 100, 2);
        }
        
        return [
            'current_period' => $currentPeriod,
            'previous_period' => $previousPeriod,
            'growth_rate' => $growthRate
        ];
    }

    function getTopProducts($array) {
        $mes = $array[0];
        $anio = $array[1];
        
        $query = "
            SELECT 
                p.name as product_name,
                COUNT(op.id) as total_orders,
                SUM(op.quantity) as total_quantity,
                SUM(op.quantity * p.price) as total_revenue
            FROM {$this->bd}order_package op
            INNER JOIN {$this->bd}order_products p ON op.product_id = p.id
            INNER JOIN {$this->bd}order o ON op.pedidos_id = o.id
            WHERE o.subsidiaries_id = ?
            AND MONTH(o.date_creation) = ?
            AND YEAR(o.date_creation) = ?
            AND o.status IN (2, 3)
            GROUP BY p.id, p.name
            ORDER BY total_quantity DESC
            LIMIT 10
        ";
        return $this->_Read($query, [$_SESSION['SUB'], $mes, $anio]);
    }

    function getTopProductsChart($array) {
        $mes = $array[0];
        $anio = $array[1];
        
        $query = "
            SELECT 
                p.name as product_name,
                SUM(op.quantity) as total_quantity,
                SUM(op.quantity * p.price) as total_revenue
            FROM {$this->bd}order_package op
            INNER JOIN {$this->bd}order_products p ON op.product_id = p.id
            INNER JOIN {$this->bd}order o ON op.pedidos_id = o.id
            WHERE o.subsidiaries_id = ?
            AND MONTH(o.date_creation) = ?
            AND YEAR(o.date_creation) = ?
            AND o.status IN (2, 3)
            GROUP BY p.id, p.name
            ORDER BY total_quantity DESC
            LIMIT 5
        ";
        return $this->_Read($query, [$_SESSION['SUB'], $mes, $anio]);
    }

    // Alert-specific methods
    function getAverageDailyRevenue() {
        $query = "
            SELECT COALESCE(AVG(daily_revenue), 0) as avg_revenue
            FROM (
                SELECT DATE(date_creation) as order_date, SUM(total_pay) as daily_revenue
                FROM {$this->bd}order
                WHERE date_creation >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                AND status IN (2, 3)
                AND subsidiaries_id = ?
                GROUP BY DATE(date_creation)
            ) as daily_totals
        ";
        $result = $this->_Read($query, [$_SESSION['SUB']]);
        return $result[0]['avg_revenue'] ?? 0;
    }

    function detectUnusualPatterns() {
        // Detectar patrones inusuales en los pedidos
        $patterns = [];
        
        // Patrón 1: Pico inusual de pedidos en un día
        $query = "
            SELECT COUNT(*) as today_orders,
                   (SELECT AVG(daily_orders) FROM (
                       SELECT COUNT(*) as daily_orders
                       FROM {$this->bd}order
                       WHERE date_creation >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                       AND date_creation < CURDATE()
                       AND subsidiaries_id = ?
                       GROUP BY DATE(date_creation)
                   ) as avg_calc) as avg_orders
            FROM {$this->bd}order
            WHERE DATE(date_creation) = CURDATE()
            AND subsidiaries_id = ?
        ";
        $result = $this->_Read($query, [$_SESSION['SUB'], $_SESSION['SUB']]);
        
        if (!empty($result)) {
            $todayOrders = $result[0]['today_orders'];
            $avgOrders = $result[0]['avg_orders'] ?? 0;
            
            if ($todayOrders > ($avgOrders * 2) && $avgOrders > 0) {
                $patterns[] = [
                    'type' => 'order_spike',
                    'message' => "Pico inusual de pedidos hoy: {$todayOrders} vs promedio de " . round($avgOrders, 1)
                ];
            }
        }
        
        return $patterns;
    }

    function getMonthlyGrowthRate() {
        $query = "
            SELECT 
                (SELECT COALESCE(SUM(total_pay), 0) 
                 FROM {$this->bd}order 
                 WHERE MONTH(date_creation) = MONTH(CURDATE()) 
                 AND YEAR(date_creation) = YEAR(CURDATE())
                 AND status IN (2, 3) 
                 AND subsidiaries_id = ?) as current_month,
                (SELECT COALESCE(SUM(total_pay), 0) 
                 FROM {$this->bd}order 
                 WHERE MONTH(date_creation) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
                 AND YEAR(date_creation) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
                 AND status IN (2, 3) 
                 AND subsidiaries_id = ?) as previous_month
        ";
        $result = $this->_Read($query, [$_SESSION['SUB'], $_SESSION['SUB']]);
        
        if (!empty($result)) {
            $current = $result[0]['current_month'];
            $previous = $result[0]['previous_month'];
            
            if ($previous > 0) {
                return round((($current - $previous) / $previous) * 100, 2);
            }
        }
        
        return 0;
    }


}
?>