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

    // La sucursal del modulo vive en este esquema, no en la sesion de Huubie.
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

    function lsAnios($array) {
        $query = "
            SELECT DISTINCT period_year AS id, period_year AS valor
            FROM {$this->bd}import_batch
            WHERE active = 1 AND period_year IS NOT NULL AND branch_id <=> ?
            ORDER BY period_year DESC
        ";
        return $this->_Read($query, $array);
    }

    function lsPaymentMethod($array) {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}payment_method
            WHERE active = 1 AND (branch_id <=> ? OR branch_id IS NULL)
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

    // La carga mas reciente va arriba, pero dentro de una misma carga el orden es
    // el de insercion (id ASC): el lote de "Pagos" se guarda antes que el de
    // "Reporte de ventas" y asi se lee en la bitacora.
    function listImportBatch($array) {
        $query = "
            SELECT id, file_name, sheet_name, period_year, period_month,
                   row_count, control_total, created_at
            FROM {$this->bd}import_batch
            WHERE active = 1
              AND branch_id <=> ?
              AND period_year  = ?
              AND period_month = ?
            ORDER BY created_at DESC, id ASC
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

    // Lotes que ya ocupan el periodo con la misma hoja: la carga los sobreescribe,
    // asi que se buscan para borrarlos antes de insertar.
    function listImportBatchBySheet($array) {
        $query = "
            SELECT id, file_name, row_count
            FROM {$this->bd}import_batch
            WHERE active = 1
              AND branch_id    <=> ?
              AND period_year   = ?
              AND period_month  = ?
              AND sheet_name    = ?
            ORDER BY id ASC
        ";
        return $this->_Read($query, $array);
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

    // Resuelve folio -> id para colgar los pagos de su venta. El primer valor del
    // array es la sucursal y el resto son los folios a buscar: la UNIQUE
    // (folio, branch_id) garantiza que cada par devuelve un solo id.
    function listSaleIdByFolio($array) {
        $marcas = implode(',', array_fill(0, count($array) - 1, '?'));

        $query = "
            SELECT id, folio
            FROM {$this->bd}sale
            WHERE active = 1
              AND branch_id <=> ?
              AND folio IN ({$marcas})
        ";
        return $this->_Read($query, $array);
    }

    // Sin LIMIT: el lote se ve completo (3 821 tickets del reporte de junio) porque
    // la tabla la pagina DataTables en el cliente.
    function listSaleByBatch($array) {
        $query = "
            SELECT s.folio, s.billing_code, s.invoice_series, s.operation_date,
                   s.subtotal, s.tax, s.total, st.name AS status_name
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_status st ON st.id = s.sale_status_id
            WHERE s.active = 1 AND s.import_batch_id = ?
            ORDER BY s.id ASC
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

    // Match por folio: liga los pagos que estan en base sin venta con las ventas
    // del lote recien cargado. Va en una sola sentencia porque son miles de filas
    // y un UPDATE por pago no termina dentro del tiempo de la peticion.
    function linkSalePaymentByBatch($array) {
        $query = "
            UPDATE {$this->bd}detail_sale_payment p
            JOIN {$this->bd}sale s ON s.folio = p.sale_folio AND s.active = 1
            SET p.sale_id = s.id
            WHERE p.active = 1
              AND p.sale_id IS NULL
              AND s.import_batch_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // detail_sale_payment cuelga de sale con ON DELETE CASCADE: borrar un lote de
    // ventas se llevaria los pagos ligados. Los pagos entran primero y son la base
    // del cruce, asi que se desligan antes de borrar y vuelven a quedar sin venta.
    function unlinkSalePaymentByBatch($array) {
        $query = "
            UPDATE {$this->bd}detail_sale_payment p
            JOIN {$this->bd}sale s ON s.id = p.sale_id
            SET p.sale_id = NULL
            WHERE s.import_batch_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Resultado del cruce: cuantos pagos quedaron ligados al lote de ventas y
    // cuantos de ellos apuntan a un ticket que el POS ya reporto facturado.
    function countSalePaymentByBatch($array) {
        $query = "
            SELECT COUNT(*) AS ligados,
                   SUM(s.invoice_series IS NOT NULL) AS facturados
            FROM {$this->bd}detail_sale_payment p
            JOIN {$this->bd}sale s ON s.id = p.sale_id
            WHERE p.active = 1 AND s.import_batch_id = ?
        ";
        return $this->_Read($query, $array);
    }

    // El folio de factura vive en la venta: llega por el enlace sale_id que arma
    // la carga, no por el folio de texto.
    function listSalePaymentByBatch($array) {
        $query = "
            SELECT p.sale_folio, p.currency, p.amount, p.exchange_rate,
                   p.sale_subtotal, p.sale_tax, p.sale_total, pm.name AS method_name,
                   s.invoice_series
            FROM {$this->bd}detail_sale_payment p
            LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
            LEFT JOIN {$this->bd}sale s ON s.id = p.sale_id
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
