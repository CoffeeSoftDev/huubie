<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {

    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_facturacion.';
    }

    // -- Catalogos --

    // Dias con ventas cargadas: alimentan el filtro de fecha del modulo.
    function lsDias($array) {
        $query = "
            SELECT DATE(operation_date) AS id, DATE(operation_date) AS valor
            FROM {$this->bd}sale
            WHERE active = 1 AND subsidiaries_id <=> ? AND operation_date IS NOT NULL
            GROUP BY DATE(operation_date)
            ORDER BY DATE(operation_date) DESC
        ";
        return $this->_Read($query, $array);
    }

    // -- Ventas del dia --

    /*
        Una venta puede tener varios pagos; se toma el primero para no duplicar
        el renglon, y el mesero sale del detalle de comandas por folio de cuenta.
    */
    function listSaleByDay($array) {
        $query = "
            SELECT s.id, s.folio, s.total, s.subtotal, s.tax, s.invoice_series,
                   s.operation_date, st.name AS status_name,
                   (SELECT pm.name
                      FROM {$this->bd}detail_sale_payment p
                      LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
                     WHERE p.active = 1 AND p.sale_folio = s.folio
                     LIMIT 1) AS method_name,
                   (SELECT d.waiter_code
                      FROM {$this->bd}detail_sale d
                     WHERE d.active = 1 AND d.sale_folio = s.folio
                     LIMIT 1) AS waiter_code
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_status st ON st.id = s.sale_status_id
            WHERE s.active = 1
              AND s.subsidiaries_id <=> ?
              AND DATE(s.operation_date) = ?
            ORDER BY s.operation_date ASC, s.id ASC
        ";
        return $this->_Read($query, $array);
    }

    function getSaleDayCounts($array) {
        $query = "
            SELECT COUNT(*) AS tickets,
                   COALESCE(SUM(s.total), 0) AS total,
                   SUM(CASE WHEN st.name = 'FACTURADO' THEN 1 ELSE 0 END) AS facturados,
                   COALESCE(SUM(CASE WHEN st.name = 'FACTURADO' THEN s.total ELSE 0 END), 0) AS total_facturado
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_status st ON st.id = s.sale_status_id
            WHERE s.active = 1
              AND s.subsidiaries_id <=> ?
              AND DATE(s.operation_date) = ?
        ";
        return $this->_Read($query, $array);
    }

    function getSaleStatusIdByName($array) {
        $query = "
            SELECT id
            FROM {$this->bd}sale_status
            WHERE name = ?
        ";
        return $this->_Read($query, $array);
    }

    function updateSale($array) {
        return $this->_Update([
            'table'  => "{$this->bd}sale",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }
}
