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
                   source_rows, row_count, duplicated_rows, control_total,
                   created_at, user_id, user_name
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
                   source_rows, row_count, duplicated_rows, control_total,
                   created_at, user_id, user_name
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
        $marks = implode(',', array_fill(0, count($array), '?'));
        $query = "
            SELECT s.folio, s.billing_code, s.invoice_series, s.operation_date,
                   s.discount_percent, s.subtotal, s.tax, s.total, s.expires_at,
                   st.name AS status_name
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_status st ON st.id = s.sale_status_id
            WHERE s.active = 1 AND s.import_batch_id IN ({$marks})
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

    // Sin LIMIT, igual que las ventas: la hoja es una pestana del periodo y su
    // pestana anuncia el total del lote, asi que traer solo una parte la haria
    // mentir. Son 3 909 pagos del mismo orden que los 3 821 tickets, y DataTables
    // los pagina en el cliente.
    function listSalePaymentByBatch($array) {
        $marks = implode(',', array_fill(0, count($array), '?'));
        $query = "
            SELECT p.sale_folio, p.currency, p.amount, p.exchange_rate,
                   p.sale_subtotal, p.sale_tax, p.sale_total, pm.name AS method_name
            FROM {$this->bd}detail_sale_payment p
            LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
            WHERE p.active = 1 AND p.import_batch_id IN ({$marks})
            ORDER BY p.id ASC
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

    // -- Catalogos que siembra la hoja de comandas --

    // El export del POS no trae catalogo: producto y mesero solo existen como
    // codigo de texto dentro del renglon de la comanda. Se leen los que ya estan
    // en base para insertar unicamente los nuevos, porque la UNIQUE
    // (code, branch_id) rechaza el resto. Sin filtro de active: una fila dada de
    // baja sigue ocupando esa clave.
    // -- Tickets virtuales del periodo --

    // Notas ya emitidas sobre las ventas de un periodo. Es lo que convierte una
    // recarga en algo destructivo: virtual_ticket cuelga de sale con ON DELETE
    // CASCADE, asi que reemplazar el reporte de ventas borraria las notas junto
    // con las ventas, sin dejar rastro.
    function countVirtualTicketByPeriod($array) {
        $query = "
            SELECT COUNT(*)          AS total,
                   MIN(v.note_number) AS nota_min,
                   MAX(v.note_number) AS nota_max
            FROM {$this->bd}virtual_ticket v
            JOIN {$this->bd}sale s         ON s.id = v.sale_id
            JOIN {$this->bd}import_batch b ON b.id = s.import_batch_id
            WHERE v.active = 1
              AND b.branch_id <=> ?
              AND b.period_year  = ?
              AND b.period_month = ?
        ";
        return $this->_Read($query, $array);
    }

    // Muestra de las notas emitidas, para poder nombrarlas en el aviso: un conteo
    // a secas no deja ir a buscarlas.
    function listVirtualTicketByPeriod($array) {
        $query = "
            SELECT v.note_number, s.folio, v.total
            FROM {$this->bd}virtual_ticket v
            JOIN {$this->bd}sale s         ON s.id = v.sale_id
            JOIN {$this->bd}import_batch b ON b.id = s.import_batch_id
            WHERE v.active = 1
              AND b.branch_id <=> ?
              AND b.period_year  = ?
              AND b.period_month = ?
            ORDER BY v.note_number
            LIMIT 6
        ";
        return $this->_Read($query, $array);
    }

    // Trae tambien lo que la carga puede refrescar: con el valor actual a la mano
    // el importador solo escribe los productos que de verdad cambiaron.
    function listProduct($array) {
        $query = "
            SELECT id, code, name, price, is_modifier
            FROM {$this->bd}product
            WHERE branch_id <=> ?
        ";
        return $this->_Read($query, $array);
    }

    function createProduct($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}product",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    // Refresca del producto solo lo que se deriva del Excel. is_bridge queda
    // fuera a proposito: lo marca el usuario a mano y la carga no manda sobre el.
    function updateProduct($array) {
        $query = "
            UPDATE {$this->bd}product
            SET name = ?, price = ?, is_modifier = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function listWaiter($array) {
        $query = "
            SELECT id, code
            FROM {$this->bd}waiter
            WHERE branch_id <=> ?
        ";
        return $this->_Read($query, $array);
    }

    function createWaiter($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}waiter",
            'values' => $array['values'],
            'data'   => $array['data']
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

    // Los tres enlaces del renglon (venta, producto y mesero) se resuelven por el
    // texto que trae el Excel, y cada uno va en una sola sentencia: son 13 000
    // renglones por carga y un UPDATE por fila no termina dentro del tiempo de la
    // peticion (mismo motivo que linkSalePaymentByBatch).
    //
    // Las tres solo tocan las filas del lote que aun no tienen el enlace, asi que
    // volver a lanzarlas no deshace nada.
    //
    // El catalogo se cruza SIN mirar active: la venta ocurrio y su renglon apunta
    // al producto y al mesero que la hicieron. Dar de baja un producto es dejar de
    // ofrecerlo hoy, no borrar su historia; si el enlace pidiera active = 1, la
    // baja dejaria renglones huerfanos que ya nadie podria volver a ligar (la clave
    // sigue ocupada, asi que tampoco se daria de alta otra vez).
    function linkSaleDetailToSale($array) {
        $query = "
            UPDATE {$this->bd}detail_sale d
            JOIN {$this->bd}sale s
              ON s.folio = d.sale_folio AND s.active = 1 AND s.branch_id <=> ?
            SET d.sale_id = s.id
            WHERE d.active = 1 AND d.sale_id IS NULL AND d.import_batch_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function linkSaleDetailToProduct($array) {
        $query = "
            UPDATE {$this->bd}detail_sale d
            JOIN {$this->bd}product p
              ON p.code = d.product_code AND p.branch_id <=> ?
            SET d.product_id = p.id
            WHERE d.active = 1 AND d.product_id IS NULL AND d.import_batch_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function linkSaleDetailToWaiter($array) {
        $query = "
            UPDATE {$this->bd}detail_sale d
            JOIN {$this->bd}waiter w
              ON w.code = d.waiter_code AND w.branch_id <=> ?
            SET d.waiter_id = w.id
            WHERE d.active = 1 AND d.waiter_id IS NULL AND d.import_batch_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Las comandas se pueden subir antes que el reporte de ventas: sus renglones
    // quedan sin sale_id hasta que la venta existe. El lote de ventas los liga por
    // folio, igual que hace con los pagos.
    function linkSaleDetailByBatch($array) {
        $query = "
            UPDATE {$this->bd}detail_sale d
            JOIN {$this->bd}sale s ON s.folio = d.sale_folio AND s.active = 1
            SET d.sale_id = s.id
            WHERE d.active = 1 AND d.sale_id IS NULL AND s.import_batch_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // detail_sale cuelga de sale con ON DELETE CASCADE, igual que los pagos:
    // borrar un lote de ventas se llevaria los renglones de las comandas, que son
    // de otra carga. Se desligan antes de borrar y vuelven a quedar sin venta.
    function unlinkSaleDetailByBatch($array) {
        $query = "
            UPDATE {$this->bd}detail_sale d
            JOIN {$this->bd}sale s ON s.id = d.sale_id
            SET d.sale_id = NULL
            WHERE s.import_batch_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Resultado del cruce del lote: cuantos renglones quedaron colgados de su
    // venta, de su producto y de su mesero.
    function countSaleDetailByBatch($array) {
        $query = "
            SELECT COUNT(*)                     AS renglones,
                   SUM(sale_id    IS NOT NULL)  AS con_venta,
                   SUM(product_id IS NOT NULL)  AS con_producto,
                   SUM(waiter_id  IS NOT NULL)  AS con_mesero
            FROM {$this->bd}detail_sale
            WHERE active = 1 AND import_batch_id = ?
        ";
        return $this->_Read($query, $array);
    }

    // Sin LIMIT por la misma razon que los pagos: la pestana de la hoja anuncia el
    // total del lote y la tabla debe traerlo completo.
    function listSaleDetailByBatch($array) {
        $marks = implode(',', array_fill(0, count($array), '?'));
        $query = "
            SELECT sale_folio, table_number, waiter_code, product_code,
                   description, quantity, amount, closed_at
            FROM {$this->bd}detail_sale
            WHERE active = 1 AND import_batch_id IN ({$marks})
            ORDER BY id ASC
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
