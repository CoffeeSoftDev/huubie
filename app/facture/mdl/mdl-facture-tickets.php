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

    function lsPaymentMethod($array) {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}payment_method
            WHERE active = 1 AND (subsidiaries_id <=> ? OR subsidiaries_id IS NULL)
            ORDER BY name ASC
        ";
        return $this->_Read($query, $array);
    }

    function lsSaleStatus() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}sale_status
            WHERE active = 1
            ORDER BY id ASC
        ";
        return $this->_Read($query);
    }

    // -- Tickets --

    // El folio se repite cuando el mismo Excel se sube dos veces: el UNIQUE
    // (folio, subsidiaries_id) no bloquea con la sucursal en NULL. Se toma la
    // ultima fila de cada folio para que el listado tenga un ticket por folio.
    function ticketsFrom() {
        return "
            FROM {$this->bd}sale s
            JOIN (
                SELECT folio, MAX(id) AS id
                FROM {$this->bd}sale
                WHERE active = 1 AND subsidiaries_id <=> ?
                  AND operation_date BETWEEN ? AND ?
                GROUP BY folio
            ) u ON u.id = s.id
            LEFT JOIN {$this->bd}sale_status st ON st.id = s.sale_status_id
        ";
    }

    // Los pagos no traen sale_id resuelto: el cruce con la venta es por folio.
    function paymentsSelect() {
        return "
            (SELECT GROUP_CONCAT(DISTINCT pm.name ORDER BY pm.name SEPARATOR ' + ')
               FROM {$this->bd}detail_sale_payment p
               LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
              WHERE p.active = 1 AND p.sale_folio = s.folio) AS payment_name
        ";
    }

    function listTickets($array) {
        $query = "
            SELECT s.id, s.folio, s.billing_code, s.invoice_series, s.operation_date,
                   s.discount_percent, s.subtotal, s.tax, s.total,
                   st.name AS status_name,
                   {$this->paymentsSelect()}
            {$this->ticketsFrom()}
            WHERE 1 = 1 {$array['filters']}
            ORDER BY s.operation_date ASC, s.folio ASC
            LIMIT 1000
        ";
        return $this->_Read($query, $array['data']);
    }

    function sumTickets($array) {
        $query = "
            SELECT COUNT(*) AS tickets,
                   COALESCE(SUM(s.total), 0) AS monto,
                   COALESCE(SUM(st.name = 'FACTURADO'), 0) AS facturados,
                   COALESCE(SUM(s.tax = 0), 0) AS cero
            {$this->ticketsFrom()}
            WHERE 1 = 1 {$array['filters']}
        ";
        return $this->_Read($query, $array['data']);
    }

    function getTicketByFolio($array) {
        $query = "
            SELECT s.id, s.folio, s.billing_code, s.invoice_series, s.operation_date,
                   s.discount_percent, s.subtotal, s.tax, s.total,
                   st.name AS status_name,
                   {$this->paymentsSelect()}
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_status st ON st.id = s.sale_status_id
            WHERE s.active = 1 AND s.folio = ? AND s.subsidiaries_id <=> ?
            ORDER BY s.id DESC
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    // El mesero vive en las comandas: solo hay dato si esa hoja ya se cargo.
    function getTicketWaiter($array) {
        $query = "
            SELECT COALESCE(w.name, d.waiter_code) AS waiter_name, d.table_number
            FROM {$this->bd}detail_sale d
            LEFT JOIN {$this->bd}waiter w ON w.id = d.waiter_id
            WHERE d.active = 1 AND d.sale_folio = ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }
}
