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
            ORDER BY id ASC
        ";
        return $this->_Read($query);
    }

    // El periodo por defecto no puede ser el mes en curso: el Excel del POS se
    // sube en diferido, asi que se abre en el ultimo mes que tiene ventas.
    function getLastPeriod($array) {
        $query = "
            SELECT DATE_FORMAT(MAX(operation_date), '%Y-%m-01') AS fi,
                   DATE(LAST_DAY(MAX(operation_date)))          AS ff
            FROM {$this->bd}sale
            WHERE active = 1 AND branch_id <=> ?
        ";
        return $this->_Read($query, $array);
    }

    // -- Ventas --

    // El folio se repite cuando el mismo Excel se sube dos veces: el UNIQUE
    // (folio, branch_id) no bloquea con la sucursal en NULL. Se toma la
    // ultima fila de cada folio para que el listado tenga una venta por folio.
    function ventasFrom() {
        return "
            FROM {$this->bd}sale s
            JOIN (
                SELECT folio, MAX(id) AS id
                FROM {$this->bd}sale
                WHERE active = 1 AND branch_id <=> ?
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

    // Los pagos del periodo, uno por renglon y sin agrupar: la columna "Forma de
    // pago" muestra cada cobro del ticket con su importe, y un GROUP_CONCAT los
    // devolveria ya fundidos en una sola cadena. Se traen de una sola consulta y
    // el controlador los reparte por folio.
    function listPagos($array) {
        $query = "
            SELECT p.sale_folio, p.amount, pm.name AS payment_name
            FROM {$this->bd}detail_sale_payment p
            LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
            JOIN (
                SELECT folio, MAX(id) AS id
                FROM {$this->bd}sale
                WHERE active = 1 AND branch_id <=> ?
                  AND operation_date BETWEEN ? AND ?
                GROUP BY folio
            ) u ON u.folio = p.sale_folio
            WHERE p.active = 1
            ORDER BY p.sale_folio ASC, pm.name ASC, p.id ASC
        ";
        return $this->_Read($query, $array);
    }

    // El tope da para un mes completo, que es el periodo mas largo que abre el
    // modulo por defecto (~3 800 ventas del POS). Con rangos mas largos el listado
    // se corta, y el controlador lo avisa al pie de la tabla en vez de callarlo.
    function listVentas($array) {
        $query = "
            SELECT s.id, s.folio, s.billing_code, s.invoice_series, s.operation_date,
                   s.discount_percent, s.subtotal, s.tax, s.total,
                   st.name AS status_name,
                   {$this->paymentsSelect()}
            {$this->ventasFrom()}
            WHERE 1 = 1 {$array['filters']}
            ORDER BY s.operation_date ASC, s.folio ASC
            LIMIT 5000
        ";
        return $this->_Read($query, $array['data']);
    }

    function sumVentas($array) {
        $query = "
            SELECT COUNT(*) AS ventas,
                   COALESCE(SUM(s.total), 0) AS monto,
                   COALESCE(SUM(st.name = 'FACTURADO'), 0) AS facturados,
                   COALESCE(SUM(s.tax = 0), 0) AS cero
            {$this->ventasFrom()}
            WHERE 1 = 1 {$array['filters']}
        ";
        return $this->_Read($query, $array['data']);
    }

    function getVentaByFolio($array) {
        $query = "
            SELECT s.id, s.folio, s.billing_code, s.invoice_series, s.operation_date,
                   s.discount_percent, s.subtotal, s.tax, s.total,
                   st.name AS status_name,
                   {$this->paymentsSelect()}
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_status st ON st.id = s.sale_status_id
            WHERE s.active = 1 AND s.folio = ? AND s.branch_id <=> ?
            ORDER BY s.id DESC
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    // -- Comandas --

    // Mesa, mesero y horas se repiten en cada partida de la cuenta: el
    // encabezado de la comanda de la venta se resume en una sola fila. Solo hay
    // dato si la hoja de comandas ya se cargo.
    function getVentaComanda($array) {
        $query = "
            SELECT MIN(d.comanda_folio)            AS comanda_folio,
                   MIN(d.table_number)             AS table_number,
                   COALESCE(MIN(w.name), MIN(d.waiter_code)) AS waiter_name,
                   MIN(d.opened_at)                AS opened_at,
                   MAX(d.closed_at)                AS closed_at,
                   COUNT(*)                        AS partidas,
                   COALESCE(SUM(d.amount), 0)      AS importe
            FROM {$this->bd}detail_sale d
            LEFT JOIN {$this->bd}waiter w ON w.id = d.waiter_id
            WHERE d.active = 1 AND d.sale_folio = ?
        ";
        return $this->_Read($query, $array);
    }

    // Renglones de la comanda. El import de comandas.xls no resuelve product_id
    // (el catalogo se arma aparte), asi que la descripcion sale de la hoja y el
    // catalogo solo se consulta cuando ya quedo cruzado.
    function listVentaItems($array) {
        $query = "
            SELECT d.product_code,
                   COALESCE(p.name, d.description) AS description,
                   d.quantity, d.discount_percent, d.amount
            FROM {$this->bd}detail_sale d
            LEFT JOIN {$this->bd}product p ON p.id = d.product_id
            WHERE d.active = 1 AND d.sale_folio = ?
            ORDER BY d.id ASC
        ";
        return $this->_Read($query, $array);
    }
}
