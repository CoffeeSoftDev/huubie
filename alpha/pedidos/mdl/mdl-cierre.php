<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class MCierre extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_reginas.';
    }

    function getSubsidiaryName($array) {
        $query = "
            SELECT s.name as sucursal, c.social_name as company
            FROM fayxzvov_alpha.subsidiaries s
            INNER JOIN fayxzvov_admin.companies c ON s.companies_id = c.id
            WHERE s.id = ?
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function getDailyClosureByDate($array) {
        $query = "
            SELECT dc.*, u.fullname AS closed_by_name
            FROM {$this->bd}daily_closure dc
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = dc.employee_id
            WHERE dc.closure_date = ? AND dc.subsidiary_id = ? AND dc.is_legacy = 0 AND dc.status = 0 AND dc.active = 1
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function getConsolidatedMetrics($array) {
        $query = "
            SELECT
                COUNT(*) as total_shifts,
                COALESCE(SUM(cs.total_orders), 0) as total_orders,
                COALESCE(SUM(cs.total_sales), 0) as total_sales,
                COALESCE(SUM(cs.cash), 0) as total_cash,
                COALESCE(SUM(cs.card), 0) as total_card,
                COALESCE(SUM(cs.transfer), 0) as total_transfer
            FROM {$this->bd}cash_shift cs
            WHERE DATE(cs.opened_at) = ? AND cs.subsidiary_id = ? AND cs.status = 'closed' AND cs.active = 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : [
            'total_shifts' => 0, 'total_orders' => 0, 'total_sales' => 0,
            'total_cash' => 0, 'total_card' => 0, 'total_transfer' => 0
        ];
    }

    function listOpenShifts($array) {
        $query = "
            SELECT cs.id, cs.opened_at, cs.shift_name, u.fullname AS employee_name
            FROM {$this->bd}cash_shift cs
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = cs.employee_id
            WHERE DATE(cs.opened_at) = ? AND cs.subsidiary_id = ? AND cs.status = 'open' AND cs.active = 1
            ORDER BY cs.opened_at ASC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function listOrphanOrders($array) {
        $query = "
            SELECT o.id, o.id as folio, o.date_creation, o.total_pay, o.status
            FROM {$this->bd}`order` o
            WHERE DATE(o.date_creation) = ? AND o.subsidiaries_id = ?
              AND (o.cash_shift_id IS NULL OR o.cash_shift_id = 0)
              AND o.status != 4 AND o.is_legacy = 0
            ORDER BY o.date_creation ASC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function listPendingBalance($array) {
        $query = "
            SELECT
                o.id, o.id as folio, o.date_creation, o.total_pay,
                COALESCE(SUM(pp.pay), 0) as total_paid,
                (o.total_pay - COALESCE(SUM(pp.pay), 0)) as pending_balance
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_payments pp ON pp.order_id = o.id
            WHERE DATE(o.date_creation) = ? AND o.subsidiaries_id = ?
              AND o.status != 4 AND o.is_legacy = 0
            GROUP BY o.id
            HAVING pending_balance > 0.01
            ORDER BY pending_balance DESC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    // Dinero de pedidos del dia por metodo: solo pagos COBRADOS ese dia y en ESTA
    // sucursal (mismo criterio que payment_real del desglose). Sin el filtro de
    // date_pay, un pago de otra fecha (p.ej. anticipo cobrado dias antes) inflaba
    // el total del cierre sin respaldo en los turnos. Los abonos a pedidos de dias
    // anteriores van aparte (getDailyPrevPaymentsByMethod).
    // Params: [date_creation, subsidiaria del pedido, date_pay, sucursal de cobro].
    function getConsolidatedPayments($array) {
        $query = "
            SELECT
                pp.method_pay_id,
                SUM(pp.pay) as total_paid
            FROM {$this->bd}order_payments pp
            INNER JOIN {$this->bd}`order` o ON pp.order_id = o.id
            WHERE DATE(o.date_creation) = ? AND o.subsidiaries_id = ?
              AND DATE(pp.date_pay) = ?
              AND COALESCE(pp.subsidiaries_id, o.subsidiaries_id) = ?
              AND o.status != 4 AND o.is_legacy = 0
            GROUP BY pp.method_pay_id
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function getConsolidatedStatuses($array) {
        $query = "
            SELECT o.status, COUNT(*) as count
            FROM {$this->bd}`order` o
            WHERE DATE(o.date_creation) = ? AND o.subsidiaries_id = ?
              AND o.is_legacy = 0
            GROUP BY o.status
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function getDiscountTotal($array) {
        $query = "
            SELECT COALESCE(SUM(o.discount), 0) as total_discount
            FROM {$this->bd}`order` o
            WHERE DATE(o.date_creation) = ? AND o.subsidiaries_id = ?
              AND o.status != 4 AND o.is_legacy = 0
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? floatval($result[0]['total_discount']) : 0;
    }

    function createClosure($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}daily_closure",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function getMaxClosureId() {
        $query = "SELECT MAX(id) as id FROM {$this->bd}daily_closure";
        $result = $this->_Read($query, null);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function createClosurePayments($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}closure_payment",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function createClosureStatuses($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}closure_status_proccess",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateOrdersClosure($array) {
        $query = "
            UPDATE {$this->bd}`order`
            SET daily_closure_id = ?
            WHERE DATE(date_creation) = ? AND subsidiaries_id = ?
              AND is_legacy = 0
              AND (daily_closure_id IS NULL OR daily_closure_id = 0)
        ";
        return $this->_CUD($query, $array);
    }

    // Conteo de transacciones con el mismo criterio que getConsolidatedPayments,
    // para que el numero de operaciones corresponda al dinero reportado.
    // Params: [date_creation, subsidiaria del pedido, date_pay, sucursal de cobro].
    function getPaymentTransactions($array) {
        $query = "
            SELECT
                pp.method_pay_id,
                COUNT(*) AS transactions,
                COALESCE(SUM(pp.pay), 0) AS total
            FROM {$this->bd}order_payments pp
            INNER JOIN {$this->bd}`order` o ON pp.order_id = o.id
            WHERE DATE(o.date_creation) = ? AND o.subsidiaries_id = ?
              AND DATE(pp.date_pay) = ?
              AND COALESCE(pp.subsidiaries_id, o.subsidiaries_id) = ?
              AND o.status != 4 AND o.is_legacy = 0
            GROUP BY pp.method_pay_id
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function getOrdersBreakdown($array) {
        $date            = $array[0];
        $subsidiaries_id = $array[1];

        // payment_real: cobrado este dia en esta sucursal (mismo criterio que el corte de turno).
        // total_paid_upto: acumulado pagado hasta el fin del dia, sin filtrar sucursal (saldo global).
        $query = "
            SELECT
                o.id AS folio,
                o.date_creation,
                -- Hora del pedido: hora real de registro si existe; si date_creation viene sin
                -- hora (medianoche, pedidos con fecha de entrega), cae a time_order.
                COALESCE(NULLIF(TIME(o.date_creation), '00:00:00'), o.time_order) AS order_time,
                oc.name AS client_name,
                o.status,
                o.total_pay,
                o.discount,
                COALESCE((
                    SELECT SUM(op.pay)
                    FROM {$this->bd}order_payments op
                    WHERE op.order_id = o.id
                      AND DATE(op.date_pay) = ?
                      AND COALESCE(op.subsidiaries_id, o.subsidiaries_id) = ?
                ), 0) AS payment_real,
                COALESCE((
                    SELECT SUM(op2.pay)
                    FROM {$this->bd}order_payments op2
                    WHERE op2.order_id = o.id
                      AND DATE(op2.date_pay) <= ?
                ), 0) AS total_paid_upto,
                (
                    SELECT mp.method_pay
                    FROM {$this->bd}order_payments pp
                    INNER JOIN {$this->bd}method_pay mp ON pp.method_pay_id = mp.id
                    WHERE pp.order_id = o.id
                    ORDER BY pp.pay DESC
                    LIMIT 1
                ) AS method,
                (
                    SELECT cs.id
                    FROM {$this->bd}cash_shift cs
                    WHERE cs.active = 1
                      AND (
                        cs.id = o.cash_shift_id
                        OR (o.cash_shift_id IS NULL
                            AND o.date_creation >= cs.opened_at
                            AND o.date_creation < COALESCE(cs.closed_at, NOW())
                            AND cs.subsidiary_id = o.subsidiaries_id)
                      )
                    ORDER BY cs.opened_at DESC
                    LIMIT 1
                ) AS shift_id
            FROM {$this->bd}`order` o
            INNER JOIN {$this->bd}order_clients oc ON o.client_id = oc.id
            WHERE DATE(o.date_creation) = ? AND o.subsidiaries_id = ?
              AND o.is_legacy = 0
            ORDER BY o.date_creation ASC
        ";
        $result = $this->_Read($query, [$date, $subsidiaries_id, $date, $date, $subsidiaries_id]);
        return is_array($result) ? $result : [];
    }

    // Abonos cobrados este dia en esta sucursal para pedidos de dias anteriores.
    // Si el pedido es de otra sucursal (cobro cruzado entrante) origin_subsidiary
    // lo identifica; el dinero cuenta aqui porque aqui entro a caja.
    // Abonos recibidos hoy a pedidos creados en dias previos. Cada abono se atribuye al
    // turno (cash_shift) de la sucursal que cobro cuyo rango [opened_at, closed_at] contiene
    // la fecha del pago. Un pedido abonado en dos turnos del mismo dia aparece una vez por turno.
    // El saldo ("total_paid_upto") se calcula hasta el cierre de ESE turno para que "Quedo" sea
    // coherente con el momento del cobro.
    function getDailyPrevPayments($array) {
        $query = "
            SELECT
                o.id,
                o.total_pay,
                o.discount,
                cs.id AS shift_id,
                cs.opened_at AS shift_opened_at,
                SUM(op.pay) AS payment_real,
                MAX(op.date_pay) AS pay_time,
                (SELECT COALESCE(SUM(op2.pay), 0)
                   FROM {$this->bd}order_payments op2
                  WHERE op2.order_id = o.id
                    AND op2.date_pay <= COALESCE(cs.closed_at, ?)) AS total_paid_upto,
                o.status,
                o.date_creation,
                o.subsidiaries_id AS origin_subsidiary_id,
                os.name AS origin_subsidiary,
                c.name AS client_name,
                GROUP_CONCAT(DISTINCT mp.method_pay ORDER BY mp.method_pay SEPARATOR ' + ') AS method
            FROM {$this->bd}order_payments op
            JOIN {$this->bd}`order` o ON o.id = op.order_id
            LEFT JOIN {$this->bd}order_clients c ON c.id = o.client_id
            LEFT JOIN {$this->bd}method_pay mp ON mp.id = op.method_pay_id
            LEFT JOIN fayxzvov_alpha.subsidiaries os ON os.id = o.subsidiaries_id
            LEFT JOIN {$this->bd}cash_shift cs
                   ON cs.subsidiary_id = COALESCE(op.subsidiaries_id, o.subsidiaries_id)
                  AND cs.active = 1
                  AND op.date_pay >= cs.opened_at
                  AND (cs.closed_at IS NULL OR op.date_pay <= cs.closed_at)
            WHERE DATE(op.date_pay) = ?
              AND DATE(o.date_creation) < ?
              AND COALESCE(op.subsidiaries_id, o.subsidiaries_id) = ?
              AND o.status != 4 AND o.is_legacy = 0
            GROUP BY o.id, cs.id, cs.opened_at, o.total_pay, o.discount, o.status, o.date_creation, o.subsidiaries_id, os.name, c.name
            ORDER BY cs.opened_at ASC, o.date_creation ASC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    // Mismos abonos que getDailyPrevPayments, pero agrupados por metodo de pago:
    // el listado por pedido concatena los metodos (GROUP_CONCAT) y no permite
    // repartir el monto entre efectivo/tarjeta/transferencia cuando un pedido
    // recibe mas de un abono en el dia.
    function getDailyPrevPaymentsByMethod($array) {
        $query = "
            SELECT
                op.method_pay_id,
                SUM(op.pay) AS total_paid,
                COUNT(*) AS transactions
            FROM {$this->bd}order_payments op
            JOIN {$this->bd}`order` o ON o.id = op.order_id
            WHERE DATE(op.date_pay) = ?
              AND DATE(o.date_creation) < ?
              AND COALESCE(op.subsidiaries_id, o.subsidiaries_id) = ?
              AND o.status != 4 AND o.is_legacy = 0
            GROUP BY op.method_pay_id
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    // Pagos del dia de pedidos de ESTA sucursal que se cobraron en OTRA (cobro
    // cruzado saliente). No entran a esta caja: se reportan informativos y no suman.
    function getDailyCrossPayments($array) {
        $query = "
            SELECT
                o.id,
                o.total_pay,
                cs.name AS charged_subsidiary,
                SUM(op.pay) AS payment_cross,
                o.date_creation,
                c.name AS client_name
            FROM {$this->bd}order_payments op
            JOIN {$this->bd}`order` o ON o.id = op.order_id
            LEFT JOIN {$this->bd}order_clients c ON c.id = o.client_id
            LEFT JOIN fayxzvov_alpha.subsidiaries cs ON cs.id = COALESCE(op.subsidiaries_id, o.subsidiaries_id)
            WHERE DATE(op.date_pay) = ?
              AND o.subsidiaries_id = ?
              AND COALESCE(op.subsidiaries_id, o.subsidiaries_id) != ?
              AND o.status != 4 AND o.is_legacy = 0
            GROUP BY o.id, o.total_pay, cs.name, COALESCE(op.subsidiaries_id, o.subsidiaries_id), o.date_creation, c.name
            ORDER BY o.date_creation ASC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function listShiftsDetail($array) {
        $query = "
            SELECT
                cs.id, cs.shift_name, cs.opened_at, cs.closed_at, cs.status,
                cs.total_sales, cs.total_orders, cs.cash as total_cash, cs.card as total_card, cs.transfer as total_transfer,
                u.fullname AS employee_name
            FROM {$this->bd}cash_shift cs
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = cs.employee_id
            WHERE DATE(cs.opened_at) = ? AND cs.subsidiary_id = ? AND cs.active = 1
            ORDER BY cs.opened_at ASC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function updateClosureReopen($array) {
        $query = "
            UPDATE {$this->bd}daily_closure
            SET status = 1, reopened_by = ?, reopen_reason = ?, reopened_at = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateOrdersUnlink($array) {
        $query = "
            UPDATE {$this->bd}`order`
            SET daily_closure_id = NULL
            WHERE daily_closure_id = ? AND is_legacy = 0
        ";
        return $this->_CUD($query, $array);
    }

    function getClosureById($array) {
        $query = "
            SELECT dc.*, u.fullname AS closed_by_name, ur.fullname AS reopened_by_name
            FROM {$this->bd}daily_closure dc
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = dc.employee_id
            LEFT JOIN fayxzvov_alpha.usr_users ur ON ur.id = dc.reopened_by
            WHERE dc.id = ?
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    // Corte de Caja:

    function getOrdersSummary($array) {
        $query = "
            SELECT
                COUNT(*) AS total_cuentas,
                SUM(CASE WHEN o.status = 4 THEN 1 ELSE 0 END) AS canceladas,
                -- Ventas reales = pendientes + pagados (status 2,3). Se excluyen cotizaciones (1) y cancelados (4).
                SUM(CASE WHEN o.discount > 0 AND o.status IN (2,3) THEN 1 ELSE 0 END) AS con_descuento,
                COALESCE(SUM(CASE WHEN o.status IN (2,3) THEN o.total_pay ELSE 0 END), 0) AS total_ventas,
                COALESCE(AVG(CASE WHEN o.status IN (2,3) THEN o.total_pay ELSE NULL END), 0) AS cuenta_promedio,
                MIN(o.id) AS folio_inicial,
                MAX(o.id) AS folio_final,
                COALESCE(SUM(CASE WHEN o.status IN (2,3) THEN o.discount ELSE 0 END), 0) AS total_descuentos
            FROM {$this->bd}`order` o
            WHERE DATE(o.date_creation) = ?
            AND o.subsidiaries_id = ?
            AND o.is_legacy = 0
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function getPaymentBreakdown($array) {
        $query = "
            SELECT
                mp.method_pay AS nombre,
                COALESCE(SUM(pp.pay), 0) AS total
            FROM {$this->bd}order_payments pp
            INNER JOIN {$this->bd}`order` o ON pp.order_id = o.id
            INNER JOIN {$this->bd}method_pay mp ON pp.method_pay_id = mp.id
            WHERE DATE(o.date_creation) = ?
            AND o.subsidiaries_id = ?
            AND o.status != 4
            AND o.is_legacy = 0
            GROUP BY mp.id, mp.method_pay
            ORDER BY mp.id ASC
        ";
        $result = $this->_Read($query, $array);
        $breakdown = [];

        if (is_array($result) && !empty($result)) {
            foreach ($result as $row) {
                $breakdown[$row['nombre']] = floatval($row['total']);
            }
        }

        return $breakdown;
    }

    function getOrdersDetail($array) {
        $query = "
            SELECT
                o.id AS folio_cuenta,
                o.id AS folio_nota,
                o.date_creation AS fecha,
                sp.status AS status_nombre,
                o.status AS status_id,
                COALESCE(o.discount, 0) AS descuento_importe,
                o.total_pay AS importe,
                COALESCE((SELECT SUM(pp.pay) FROM {$this->bd}order_payments pp WHERE pp.order_id = o.id AND pp.method_pay_id = 1), 0) AS efectivo,
                COALESCE((SELECT SUM(pp.pay) FROM {$this->bd}order_payments pp WHERE pp.order_id = o.id AND pp.method_pay_id = 2), 0) AS tarjeta,
                COALESCE((SELECT SUM(pp.pay) FROM {$this->bd}order_payments pp WHERE pp.order_id = o.id AND pp.method_pay_id = 3), 0) AS transferencia
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}status_process sp ON o.status = sp.id
            WHERE DATE(o.date_creation) = ?
            AND o.subsidiaries_id = ?
            AND o.is_legacy = 0
            ORDER BY o.id ASC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function getCashShiftsSummary($array) {
        // Dinero en caja del turno = efectivo + tarjeta + transferencia cobrados (snapshot al cierre,
        // no editable a diferencia de los totales de pedido). El reporte lo recalcula desde estos 3.
        $query = "
            SELECT
                cs.id,
                cs.shift_name AS estacion,
                u.fullname AS cajero,
                cs.opened_at AS apertura,
                cs.closed_at AS cierre,
                (cs.cash + cs.card + cs.transfer) AS total,
                cs.opening_amount AS fondo_caja,
                cs.cash AS efectivo,
                cs.card AS tarjeta,
                cs.transfer AS transferencia,
                cs.total_orders,
                cs.status
            FROM {$this->bd}cash_shift cs
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = cs.employee_id
            WHERE DATE(cs.opened_at) = ?
            AND cs.subsidiary_id = ?
            AND cs.active = 1
            ORDER BY cs.opened_at ASC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    // =============================================
    // Recálculo de corte de turno (cash_shift)
    // Recomputa los totales de un turno cerrado a partir de los pagos actuales,
    // usando la misma lógica que el cierre (getShiftSalesMetrics de MPedidos):
    // ventana del turno + atribución por COALESCE(pago.subsidiaries_id, orden.subsidiaries_id).
    // Sirve para reflejar en el corte una corrección de método de pago hecha
    // después de cerrar el turno, sin editar los totales a mano.
    // =============================================

    function getShiftById($array) {
        $query = "
            SELECT id, opened_at, closed_at, status, subsidiary_id, daily_closure_id
            FROM {$this->bd}cash_shift
            WHERE id = ? AND active = 1
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function getShiftPaymentTotals($array) {
        // $array = [opened_at, end_at, subsidiary_id]
        $query = "
            SELECT pp.method_pay_id, SUM(pp.pay) AS total_paid
            FROM {$this->bd}order_payments pp
            INNER JOIN {$this->bd}`order` po ON pp.order_id = po.id
            WHERE pp.date_pay >= ? AND pp.date_pay <= ?
              AND COALESCE(pp.subsidiaries_id, po.subsidiaries_id) = ?
              AND po.status != 4
            GROUP BY pp.method_pay_id
        ";
        return $this->_Read($query, $array);
    }

    function getShiftOrderTotals($array) {
        // $array = [shift_id, opened_at, end_at, subsidiary_id]
        $query = "
            SELECT COUNT(*) AS total_orders, COALESCE(SUM(total_pay), 0) AS total_sales
            FROM {$this->bd}`order`
            WHERE (cash_shift_id = ? OR (cash_shift_id IS NULL AND date_creation >= ? AND date_creation < ? AND subsidiaries_id = ?))
              AND status != 4
        ";
        return $this->_Read($query, $array);
    }

    function updateCashShiftTotals($array) {
        // $array = [total_sales, cash, card, transfer, total_orders, shift_id]
        $query = "
            UPDATE {$this->bd}cash_shift
            SET total_sales = ?, cash = ?, card = ?, transfer = ?, total_orders = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function deleteShiftPayments($array) {
        $query = "DELETE FROM {$this->bd}shift_payment WHERE cash_shift_id = ?";
        return $this->_CUD($query, $array);
    }

    function insertShiftPayment($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}shift_payment",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function getSalesByCategory($array) {
        $query = "
            SELECT
                oc.classification AS categoria,
                COALESCE(SUM(pkg.price * pkg.quantity), 0) AS total
            FROM {$this->bd}order_package pkg
            INNER JOIN {$this->bd}`order` o ON pkg.pedidos_id = o.id
            LEFT JOIN {$this->bd}order_products op ON pkg.product_id = op.id
            LEFT JOIN {$this->bd}order_category oc ON op.category_id = oc.id
            WHERE DATE(o.date_creation) = ?
            AND o.subsidiaries_id = ?
            AND o.status != 4
            AND o.is_legacy = 0
            GROUP BY oc.id, oc.classification
            ORDER BY total DESC
        ";
        $result = $this->_Read($query, $array);
        $categories = [];

        if (is_array($result) && !empty($result)) {
            foreach ($result as $row) {
                $categories[$row['categoria'] ?: 'Sin categoría'] = floatval($row['total']);
            }
        }

        return $categories;
    }
}
