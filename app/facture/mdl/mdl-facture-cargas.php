<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {

    public $util;
    public $bd;
    public $bdAlpha;

    public function __construct() {
        $this->util    = new Utileria;
        $this->bd      = 'fayxzvov_facturacion.';
        $this->bdAlpha = 'fayxzvov_alpha.';
    }

    // -- Catalogos --

    function lsAnios($array) {
        $query = "
            SELECT DISTINCT period_year AS id, period_year AS valor
            FROM {$this->bd}import_batch
            WHERE active = 1 AND period_year IS NOT NULL AND subsidiaries_id <=> ?
            ORDER BY period_year DESC
        ";
        return $this->_Read($query, $array);
    }

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
        ";
        return $this->_Read($query);
    }

    // -- Bitacora de carga --

    function listImportBatch($array) {
        $query = "
            SELECT id, file_name, sheet_name, period_year, period_month,
                   row_count, control_total, created_at
            FROM {$this->bd}import_batch
            WHERE active = 1
              AND subsidiaries_id <=> ?
              AND period_year  = ?
              AND period_month = ?
            ORDER BY created_at DESC, id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getImportBatchById($array) {
        $query = "
            SELECT id, file_name, sheet_name, period_year, period_month,
                   row_count, control_total, created_at
            FROM {$this->bd}import_batch
            WHERE id = ?
        ";
        return $this->_Read($query, $array);
    }

    function getMaxImportBatchId() {
        $query = "SELECT MAX(id) AS id FROM {$this->bd}import_batch";
        return $this->_Read($query);
    }

    function createImportBatch($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}import_batch",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }


    function deleteImportBatchById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}import_batch",
            'where' => $array['where'],
            'data'  => $array['data']
        ]);
    }

    // -- Ventas (hoja "Reporte de ventas") --

    function createSale($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}sale",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function listSaleByBatch($array) {
        $query = "
            SELECT s.folio, s.billing_code, s.invoice_series, s.operation_date,
                   s.subtotal, s.tax, s.total, st.name AS status_name
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_status st ON st.id = s.sale_status_id
            WHERE s.active = 1 AND s.import_batch_id = ?
            ORDER BY s.id ASC
            LIMIT 500
        ";
        return $this->_Read($query, $array);
    }


    function deleteSaleByBatch($array) {
        return $this->_Delete([
            'table' => "{$this->bd}sale",
            'where' => $array['where'],
            'data'  => $array['data']
        ]);
    }

    // -- Pagos (hoja "Pagos") --

    function createSalePayment($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}detail_sale_payment",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function listSalePaymentByBatch($array) {
        $query = "
            SELECT p.sale_folio, p.currency, p.amount, p.exchange_rate,
                   p.sale_subtotal, p.sale_tax, p.sale_total, pm.name AS method_name
            FROM {$this->bd}detail_sale_payment p
            LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
            WHERE p.active = 1 AND p.import_batch_id = ?
            ORDER BY p.id ASC
            LIMIT 500
        ";
        return $this->_Read($query, $array);
    }


    function deleteSalePaymentByBatch($array) {
        return $this->_Delete([
            'table' => "{$this->bd}detail_sale_payment",
            'where' => $array['where'],
            'data'  => $array['data']
        ]);
    }

    // -- Comandas (hoja "comandas") --

    function createSaleDetail($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}detail_sale",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function listSaleDetailByBatch($array) {
        $query = "
            SELECT sale_folio, table_number, waiter_code, product_code,
                   description, quantity, amount, closed_at
            FROM {$this->bd}detail_sale
            WHERE active = 1 AND import_batch_id = ?
            ORDER BY id ASC
            LIMIT 500
        ";
        return $this->_Read($query, $array);
    }

    function deleteSaleDetailByBatch($array) {
        return $this->_Delete([
            'table' => "{$this->bd}detail_sale",
            'where' => $array['where'],
            'data'  => $array['data']
        ]);
    }
}
