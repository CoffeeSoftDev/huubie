<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {
    public $util;
    public $bd;

    public $posCode = '';

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_facturacion.';
    }

    // -- Catalogos --

    function getPosCode($array) {
        $query = "
            SELECT p.code
            FROM {$this->bd}branch b
            LEFT JOIN {$this->bd}pos p ON p.id = b.pos_id
            WHERE b.id <=> ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    function getBranch() {
        $query = "
            SELECT id
            FROM {$this->bd}branch
            WHERE active = 1
            ORDER BY id ASC
            LIMIT 1
        ";
        return $this->_Read($query);
    }

    function getEmisor($array) {
        $query = "
            SELECT b.id, b.business_name, b.logo, b.rfc, b.fiscal_address, b.phone, b.adjustment_tolerance,
                   c.business_name AS company_name, c.rfc AS company_rfc,
                   c.fiscal_address AS company_address, c.phone AS company_phone
            FROM {$this->bd}branch b
            LEFT JOIN {$this->bd}company c ON c.id = b.company_id
            WHERE b.id <=> ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    function lsDias($array) {
        $query = "
            SELECT DATE(s.operation_date) AS id, DATE(s.operation_date) AS valor
            FROM {$this->bd}sale s
            WHERE s.active = 1
              AND s.branch_id <=> ?
              AND s.operation_date IS NOT NULL
              AND {$this->ventaElegible()}
            GROUP BY DATE(s.operation_date)
            ORDER BY DATE(s.operation_date) DESC
        ";
        return $this->_Read($query, $array);
    }

    // Los generados se cuentan con EXISTS y no con un LEFT JOIN a virtual_ticket:
    // el join multiplica la fila de la venta por cada papel suyo y el SUM del monto
    // procesable saldria contado de mas.
    function lsDiasDelMes($array) {
        $query = "
            SELECT DATE(s.operation_date) AS id,
                   COUNT(*) AS movimientos,
                   COALESCE(SUM({$this->totalProcesable()}), 0) AS total,
                   COALESCE(SUM({$this->totalProcesable()} > 0), 0) AS con_cargo,
                   COALESCE(SUM(EXISTS (
                       SELECT 1
                       FROM {$this->bd}virtual_ticket v
                       WHERE v.sale_id = s.id AND v.active = 1
                   )), 0) AS generados
            FROM {$this->bd}sale s
            WHERE s.active = 1
              AND s.branch_id <=> ?
              AND s.operation_date IS NOT NULL
              AND DATE_FORMAT(s.operation_date, '%Y-%m') = ?
              AND {$this->ventaElegible()}
            GROUP BY DATE(s.operation_date)
            ORDER BY DATE(s.operation_date) ASC
        ";
        return $this->_Read($query, $array);
    }

    // -- Tickets del dia --

    // El universo del modulo cambia con el POS: Wansoft exporta estado de operacion
    // y entra todo lo Pagada; Soft Restaurant deja esa columna en NULL y conserva el
    // criterio de siempre, todo lo que no sea efectivo.
    function ventaElegible() {
        if ($this->esWansoft()) return "EXISTS ({$this->estaPagada()})";

        return "EXISTS ({$this->sinEfectivo()})";
    }

    function folioDelPago() {
        return "COALESCE(p.assigned_folio, p.sale_folio)";
    }

    function esWansoft() {
        return $this->posCode === 'wansoft';
    }

    function sinEfectivo() {
        return "
            SELECT 1
            FROM {$this->bd}detail_sale_payment p
            LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
            WHERE p.active = 1 AND p.sale_folio = s.folio AND UPPER(pm.name) <> 'EFECTIVO'
        ";
    }

    // La comparacion va sin UPPER(): la columna es utf8mb4_general_ci y ya ignora
    // mayusculas y acentos, mientras que UPPER() no es multibyte y convertiria
    // «Tarjeta de credito» en «TARJETA DE CRéDITO», que no empata con el seed.
    function soloCredito() {
        return "
            SELECT 1
            FROM {$this->bd}detail_sale_payment p
            LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
            WHERE p.active = 1 AND {$this->folioDelPago()} = s.folio AND pm.name = 'TARJETA DE CREDITO'
        ";
    }

    function montoCredito() {
        return "
            SELECT COALESCE(SUM(p.amount), 0)
            FROM {$this->bd}detail_sale_payment p
            LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
            WHERE p.active = 1 AND {$this->folioDelPago()} = s.folio AND pm.name = 'TARJETA DE CREDITO'
        ";
    }

    function totalProcesable() {
        return $this->esWansoft() ? "({$this->montoCredito()})" : "s.total";
    }

    function estaPagada() {
        return "
            SELECT 1
            FROM {$this->bd}sale_operation_status os
            WHERE os.id = s.operation_status_id AND os.name = 'Pagada'
        ";
    }

    function conDetalle() {
        return "
            SELECT 1
              FROM {$this->bd}detail_sale d
             WHERE d.active = 1 AND d.sale_id = s.id
        ";
    }

    function ticketSelect() {
        return "
            (SELECT GROUP_CONCAT(DISTINCT pm.name ORDER BY pm.name SEPARATOR ' + ')
               FROM {$this->bd}detail_sale_payment p
               LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
              WHERE p.active = 1 AND {$this->folioDelPago()} = s.folio) AS payment_name,
            (SELECT GROUP_CONCAT(DISTINCT pm.name ORDER BY pm.name SEPARATOR ' + ')
               FROM {$this->bd}detail_sale_payment p
               LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
              WHERE p.active = 1 AND p.sale_folio = s.folio) AS payment_real,
            (SELECT MIN(d.table_number)
               FROM {$this->bd}detail_sale d
              WHERE d.active = 1 AND d.sale_folio = s.folio) AS table_number,
            (SELECT COALESCE(MIN(w.name), MIN(d.waiter_code))
               FROM {$this->bd}detail_sale d
               LEFT JOIN {$this->bd}waiter w ON w.id = d.waiter_id
              WHERE d.active = 1 AND d.sale_folio = s.folio) AS waiter_name
        ";
    }

    function reasignacionSelect() {
        return "
            (SELECT GROUP_CONCAT(DISTINCT p.sale_folio ORDER BY p.sale_folio SEPARATOR ', ')
               FROM {$this->bd}detail_sale_payment p
              WHERE p.active = 1 AND p.assigned_folio = s.folio) AS recibido_de,
            (SELECT GROUP_CONCAT(DISTINCT p.assigned_folio ORDER BY p.assigned_folio SEPARATOR ', ')
               FROM {$this->bd}detail_sale_payment p
              WHERE p.active = 1 AND p.sale_folio = s.folio AND p.assigned_folio IS NOT NULL) AS cedido_a,
            (SELECT COALESCE(SUM(p.amount), 0)
               FROM {$this->bd}detail_sale_payment p
              WHERE p.active = 1 AND p.assigned_folio = s.folio) AS monto_recibido
        ";
    }

    function listTicketsByDay($array) {
        $query = "
            SELECT s.id, s.folio, s.operation_date, s.subtotal, s.tax,
                   {$this->totalProcesable()} AS total,
                   s.total AS sale_total,
                   s.invoice_series, st.name AS status_name,
                   v.id AS virtual_id, v.note_number, v.subtotal AS virtual_subtotal,
                   v.discount AS virtual_discount, v.tax_rate AS virtual_tax_rate,
                   v.visible_folio, v.origin_folio,
                   EXISTS ({$this->conDetalle()}) AS tiene_detalle,
                   {$this->ticketSelect()},
                   {$this->reasignacionSelect()}
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_status st ON st.id = s.sale_status_id
            LEFT JOIN {$this->bd}virtual_ticket v ON v.sale_id = s.id AND v.active = 1
            WHERE s.active = 1
              AND s.branch_id <=> ?
              AND DATE(s.operation_date) = ?
              AND {$this->ventaElegible()}
              AND (s.folio LIKE ? OR EXISTS (
                    SELECT 1
                    FROM {$this->bd}detail_sale d
                    LEFT JOIN {$this->bd}waiter w ON w.id = d.waiter_id
                    WHERE d.active = 1 AND d.sale_folio = s.folio
                      AND (d.waiter_code LIKE ? OR w.name LIKE ?)
              ))
            ORDER BY CAST(s.folio AS UNSIGNED) ASC, s.folio ASC
        ";
        return $this->_Read($query, $array);
    }

    function getTicketDayCounts($array) {
        $query = "
            SELECT COALESCE(SUM({$this->totalProcesable()} > 0), 0) AS tickets,
                   COALESCE(SUM({$this->totalProcesable()} = 0), 0) AS servicio,
                   COUNT(*) AS movimientos,
                   COALESCE(SUM(st.name = 'FACTURADO'), 0) AS facturados,
                   COALESCE(SUM(s.tax = 0 AND {$this->totalProcesable()} > 0 AND (st.name IS NULL OR st.name <> 'FACTURADO')), 0) AS cero,
                   COALESCE(SUM(v.id IS NOT NULL), 0) AS generados,
                   COALESCE(SUM(v.id IS NOT NULL AND v.tax_rate = 0 AND {$this->totalProcesable()} > 0), 0) AS generados_cero,
                   COALESCE(SUM(v.id IS NOT NULL AND {$this->totalProcesable()} = 0), 0) AS generados_servicio,
                   COALESCE(SUM({$this->totalProcesable()}), 0) AS total,
                   COALESCE(SUM(CASE WHEN st.name = 'FACTURADO' THEN {$this->totalProcesable()} ELSE 0 END), 0) AS total_facturado,
                   COALESCE(SUM(CASE WHEN v.id IS NOT NULL AND v.tax_rate = 0 AND {$this->totalProcesable()} > 0 THEN {$this->totalProcesable()} ELSE 0 END), 0) AS total_cero
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_status st ON st.id = s.sale_status_id
            LEFT JOIN {$this->bd}virtual_ticket v ON v.sale_id = s.id AND v.active = 1
            WHERE s.active = 1
              AND s.branch_id <=> ?
              AND DATE(s.operation_date) = ?
              AND {$this->ventaElegible()}
        ";
        return $this->_Read($query, $array);
    }

    function getTicketByFolio($array) {
        $query = "
            SELECT s.id, s.folio, s.operation_date, s.subtotal, s.tax,
                   {$this->totalProcesable()} AS total,
                   s.total AS sale_total,
                   s.invoice_series, st.name AS status_name,
                   os.name AS operation_status,
                   EXISTS ({$this->soloCredito()}) AS es_credito,
                   EXISTS ({$this->estaPagada()})  AS esta_pagada,
                   EXISTS ({$this->conDetalle()})  AS tiene_detalle,
                   v.id AS virtual_id, v.note_number, v.subtotal AS virtual_subtotal,
                   v.discount AS virtual_discount, v.tax_rate AS virtual_tax_rate,
                   v.visible_folio, v.origin_folio,
                   {$this->ticketSelect()},
                   {$this->reasignacionSelect()}
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_status st ON st.id = s.sale_status_id
            LEFT JOIN {$this->bd}sale_operation_status os ON os.id = s.operation_status_id
            LEFT JOIN {$this->bd}virtual_ticket v ON v.sale_id = s.id AND v.active = 1
            WHERE s.active = 1 AND s.folio = ? AND s.branch_id <=> ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    function listPendingZero($array) {
        $query = "
            SELECT s.folio
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_status st ON st.id = s.sale_status_id
            LEFT JOIN {$this->bd}virtual_ticket v ON v.sale_id = s.id AND v.active = 1
            WHERE s.active = 1
              AND s.branch_id <=> ?
              AND DATE(s.operation_date) = ?
              AND s.tax = 0
              AND (st.name IS NULL OR st.name <> 'FACTURADO')
              AND v.id IS NULL
              AND {$this->totalProcesable()} > 0
              AND {$this->ventaElegible()}
            ORDER BY CAST(s.folio AS UNSIGNED) ASC, s.folio ASC
        ";
        return $this->_Read($query, $array);
    }

    // -- Reasignacion de cargos --

    function listCardPaymentsByDay($array) {
        $query = "
            SELECT p.id, p.sale_folio, p.amount
            FROM {$this->bd}detail_sale_payment p
            INNER JOIN {$this->bd}sale s ON s.id = p.sale_id
            LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
            WHERE p.active = 1
              AND s.active = 1
              AND s.branch_id <=> ?
              AND DATE(s.operation_date) = ?
              AND pm.name = 'TARJETA DE CREDITO'
              AND p.amount > 0
            ORDER BY CAST(p.sale_folio AS UNSIGNED) ASC, p.sale_folio ASC, p.id ASC
        ";
        return $this->_Read($query, $array);
    }

    function listReassignedByDay($array) {
        $query = "
            SELECT
                p.sale_folio     AS origen,
                p.assigned_folio AS destino,
                p.amount         AS monto,
                (SELECT GROUP_CONCAT(DISTINCT pm2.name ORDER BY pm2.name SEPARATOR ', ')
                   FROM {$this->bd}detail_sale_payment p2
                   INNER JOIN {$this->bd}sale s2 ON s2.id = p2.sale_id
                   LEFT JOIN {$this->bd}payment_method pm2 ON pm2.id = p2.payment_method_id
                  WHERE p2.active = 1
                    AND s2.active = 1
                    AND s2.branch_id <=> s.branch_id
                    AND DATE(s2.operation_date) = DATE(s.operation_date)
                    AND p2.sale_folio = p.assigned_folio
                    AND p2.amount > 0) AS pago_destino
            FROM {$this->bd}detail_sale_payment p
            INNER JOIN {$this->bd}sale s ON s.id = p.sale_id
            WHERE p.active = 1
              AND s.active = 1
              AND s.branch_id <=> ?
              AND DATE(s.operation_date) = ?
              AND p.assigned_folio IS NOT NULL
            ORDER BY CAST(p.sale_folio AS UNSIGNED) ASC, p.id ASC
        ";
        return $this->_Read($query, $array);
    }

    function reassignPayment($array) {
        $query = "
            UPDATE {$this->bd}detail_sale_payment
               SET assigned_folio = ?
             WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function stampReassignmentsByDay($array) {
        $query = "
            UPDATE {$this->bd}detail_sale_payment p
            INNER JOIN {$this->bd}sale s ON s.id = p.sale_id
               SET p.reassignment_run_id = ?
             WHERE s.branch_id <=> ?
               AND DATE(s.operation_date) = ?
               AND p.assigned_folio IS NOT NULL
               AND p.reassignment_run_id IS NULL
        ";
        return $this->_CUD($query, $array);
    }

    function clearReassignmentsByDay($array) {
        $query = "
            UPDATE {$this->bd}detail_sale_payment p
            INNER JOIN {$this->bd}sale s ON s.id = p.sale_id
               SET p.assigned_folio = NULL, p.reassignment_run_id = NULL
             WHERE s.branch_id <=> ?
               AND DATE(s.operation_date) = ?
               AND p.assigned_folio IS NOT NULL
        ";
        return $this->_CUD($query, $array);
    }

    // -- Productos puente --

    function listBridgeProducts($array) {
        $query = "
            SELECT id, code, name, price
            FROM {$this->bd}product
            WHERE active = 1 AND is_bridge = 1 AND is_modifier = 0 AND price > 0 AND branch_id <=> ?
            ORDER BY price DESC, name ASC
        ";
        return $this->_Read($query, $array);
    }

    function listTaxProducts($array) {
        $query = "
            SELECT id, code, name, price
            FROM {$this->bd}product
            WHERE active = 1 AND is_bridge = 0 AND is_modifier = 0 AND price > 0 AND branch_id <=> ?
            ORDER BY price DESC, name ASC
        ";
        return $this->_Read($query, $array);
    }

    // -- Ticket virtual --

    function listVirtualDetail($array) {
        $query = "
            SELECT description, quantity, unit_price, amount
            FROM {$this->bd}detail_virtual_ticket
            WHERE active = 1 AND virtual_ticket_id = ?
            ORDER BY id ASC
        ";
        return $this->_Read($query, $array);
    }

    function createVirtualTicket($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}virtual_ticket",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateVirtualTicket($array) {
        return $this->_Update([
            'table'  => "{$this->bd}virtual_ticket",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function getVirtualTicketByNote($array) {
        $query = "
            SELECT id
            FROM {$this->bd}virtual_ticket
            WHERE issue_date = ? AND note_number = ? AND branch_id <=> ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    function createVirtualDetail($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}detail_virtual_ticket",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function deleteVirtualDetailByTicket($array) {
        $query = "
            DELETE FROM {$this->bd}detail_virtual_ticket
            WHERE virtual_ticket_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function releaseVirtualNotes($ids) {
        if (empty($ids)) return false;

        $marks = implode(',', array_fill(0, count($ids), '?'));
        $query = "
            UPDATE {$this->bd}virtual_ticket
               SET note_number = -ABS(note_number)
             WHERE id IN ({$marks})
        ";
        return $this->_CUD($query, $ids);
    }

    function deleteReleasedVirtualTickets($ids) {
        if (empty($ids)) return false;

        $marks = implode(',', array_fill(0, count($ids), '?'));
        $query = "
            DELETE FROM {$this->bd}virtual_ticket
             WHERE note_number < 0 AND id IN ({$marks})
        ";
        return $this->_CUD($query, $ids);
    }

    function deleteVirtualTicketByDay($array) {
        $query = "
            DELETE FROM {$this->bd}virtual_ticket
            WHERE issue_date = ? AND branch_id <=> ?
        ";
        return $this->_CUD($query, $array);
    }

    function deleteGenerationRunByDay($array) {
        $query = "
            DELETE FROM {$this->bd}generation_run
            WHERE issue_date = ? AND branch_id <=> ?
        ";
        return $this->_CUD($query, $array);
    }

    // -- Reparto del dia --

    function listSaleDayForSplit($array) {
        $query = "
            SELECT s.id, s.folio, s.operation_date, s.subtotal, s.tax,
                   {$this->totalProcesable()} AS total,
                   s.total AS sale_total,
                   st.name AS status_name,
                   v.id AS virtual_id, v.note_number, v.tax_rate AS virtual_tax_rate,
                   EXISTS ({$this->conDetalle()}) AS tiene_detalle,
                   {$this->reasignacionSelect()}
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_status st ON st.id = s.sale_status_id
            LEFT JOIN {$this->bd}virtual_ticket v ON v.sale_id = s.id AND v.active = 1
            WHERE s.active = 1
              AND s.branch_id <=> ?
              AND DATE(s.operation_date) = ?
              AND {$this->ventaElegible()}
            ORDER BY CAST(s.folio AS UNSIGNED) ASC, s.folio ASC
        ";
        return $this->_Read($query, $array);
    }

    function listSaleDetailByDay($array) {
        $query = "
            SELECT d.sale_folio, d.description, d.quantity, d.amount
            FROM {$this->bd}detail_sale d
            INNER JOIN {$this->bd}sale s ON s.id = d.sale_id
            WHERE d.active = 1
              AND s.active = 1
              AND s.branch_id <=> ?
              AND DATE(s.operation_date) = ?
            ORDER BY d.sale_folio ASC, d.id ASC
        ";
        return $this->_Read($query, $array);
    }

    function listSaleDetailByFolio($array) {
        $query = "
            SELECT d.description, d.quantity, d.amount
            FROM {$this->bd}detail_sale d
            INNER JOIN {$this->bd}sale s ON s.id = d.sale_id
            WHERE d.active = 1 AND s.active = 1 AND s.id = ?
            ORDER BY d.id ASC
        ";
        return $this->_Read($query, $array);
    }

    function listVirtualDetailByDay($array) {
        $query = "
            SELECT v.sale_id, d.description, d.quantity, d.amount
            FROM {$this->bd}detail_virtual_ticket d
            INNER JOIN {$this->bd}virtual_ticket v ON v.id = d.virtual_ticket_id
            WHERE d.active = 1
              AND v.active = 1
              AND v.branch_id <=> ?
              AND v.issue_date = ?
            ORDER BY v.sale_id ASC, d.id ASC
        ";
        return $this->_Read($query, $array);
    }

    // -- Corrida de generacion --

    function createGenerationRun($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}generation_run",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateGenerationRun($array) {
        return $this->_Update([
            'table'  => "{$this->bd}generation_run",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function getMaxGenerationRunId() {
        $query = "SELECT MAX(id) AS id FROM {$this->bd}generation_run";
        return $this->_Read($query);
    }

    function getNextGenerationRunFolio() {
        $query = "
            SELECT COALESCE(MAX(CAST(SUBSTRING(folio, 5) AS UNSIGNED)), 0) + 1 AS siguiente
            FROM {$this->bd}generation_run
            WHERE folio LIKE 'GEN-%'
        ";
        return $this->_Read($query);
    }

    function getSourceFileByDay($array) {
        $query = "
            SELECT b.file_name
            FROM {$this->bd}sale s
            INNER JOIN {$this->bd}import_batch b ON b.id = s.import_batch_id
            WHERE s.active = 1
              AND b.active = 1
              AND s.branch_id <=> ?
              AND DATE(s.operation_date) = ?
            ORDER BY b.id DESC
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    function listGenerationRuns($array) {
        $query = "
            SELECT r.id, r.folio, r.kind, r.issue_date, r.goal_mode, r.goal_value, r.goal_amount,
                   r.day_total, r.billed_16, r.billed_0, r.count_16, r.count_0, r.no_paper,
                   r.movements_count, r.reassigned_count, r.zero_ticket_count, r.source_file,
                   r.adjustment_tolerance, r.user_name, r.user_id, r.created_at,
                   s.folio AS cut_folio,
                   (SELECT COUNT(*) FROM {$this->bd}virtual_ticket v
                     WHERE v.generation_run_id = r.id AND v.active = 1) AS tickets
            FROM {$this->bd}generation_run r
            LEFT JOIN {$this->bd}sale s ON s.id = r.cut_sale_id
            WHERE r.active = 1
              AND r.branch_id <=> ?
              AND r.issue_date = ?
            ORDER BY r.id DESC
        ";
        return $this->_Read($query, $array);
    }
}
