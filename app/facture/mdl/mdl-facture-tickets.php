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

    // Lo que se imprime en el encabezado del ticket sale de la sucursal; la empresa
    // pone la razon social cuando la sucursal no tiene una propia.
    function getEmisor($array) {
        $query = "
            SELECT b.business_name, b.rfc, b.fiscal_address, b.phone,
                   c.business_name AS company_name
            FROM {$this->bd}branch b
            LEFT JOIN {$this->bd}company c ON c.id = b.company_id
            WHERE b.id <=> ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    // Dias que tienen ventas cobradas por banco: son los unicos que pueden pedir
    // ticket virtual, asi que el filtro no ofrece dias que abririan en vacio.
    function lsDias($array) {
        $query = "
            SELECT DATE(s.operation_date) AS id, DATE(s.operation_date) AS valor
            FROM {$this->bd}sale s
            WHERE s.active = 1
              AND s.branch_id <=> ?
              AND s.operation_date IS NOT NULL
              AND EXISTS ({$this->sinEfectivo()})
            GROUP BY DATE(s.operation_date)
            ORDER BY DATE(s.operation_date) DESC
        ";
        return $this->_Read($query, $array);
    }

    // -- Tickets del dia --

    // El ticket virtual solo aplica a lo que NO se cobro en efectivo: el efectivo no
    // deja rastro bancario y no se factura por esta via. Un ticket multipago entra
    // si alguno de sus pagos fue por banco.
    function sinEfectivo() {
        return "
            SELECT 1
            FROM {$this->bd}detail_sale_payment p
            LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
            WHERE p.active = 1 AND p.sale_folio = s.folio AND UPPER(pm.name) <> 'EFECTIVO'
        ";
    }

    // Mesa, mesero y formas de pago del ticket viven en otras tablas y se resuelven
    // por folio: son las que completan el papel del ticket virtual.
    function ticketSelect() {
        return "
            (SELECT GROUP_CONCAT(DISTINCT pm.name ORDER BY pm.name SEPARATOR ' + ')
               FROM {$this->bd}detail_sale_payment p
               LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
              WHERE p.active = 1 AND p.sale_folio = s.folio) AS payment_name,
            (SELECT MIN(d.table_number)
               FROM {$this->bd}detail_sale d
              WHERE d.active = 1 AND d.sale_folio = s.folio) AS table_number,
            (SELECT COALESCE(MIN(w.name), MIN(d.waiter_code))
               FROM {$this->bd}detail_sale d
               LEFT JOIN {$this->bd}waiter w ON w.id = d.waiter_id
              WHERE d.active = 1 AND d.sale_folio = s.folio) AS waiter_name
        ";
    }

    // El listado va por folio ascendente. folio es VARCHAR, asi que se ordena por
    // su valor numerico: en texto el '9' cae despues del '10'. El folio en texto
    // queda de desempate para lo que no sea numero.
    function listTicketsByDay($array) {
        $query = "
            SELECT s.id, s.folio, s.operation_date, s.subtotal, s.tax, s.total,
                   s.invoice_series, st.name AS status_name,
                   v.id AS virtual_id, v.note_number, v.subtotal AS virtual_subtotal,
                   v.discount AS virtual_discount,
                   {$this->ticketSelect()}
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_status st ON st.id = s.sale_status_id
            LEFT JOIN {$this->bd}virtual_ticket v ON v.sale_id = s.id AND v.active = 1
            WHERE s.active = 1
              AND s.branch_id <=> ?
              AND DATE(s.operation_date) = ?
              AND EXISTS ({$this->sinEfectivo()})
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

    // Conteos del dia para las pildoras del encabezado: los que ya estan facturados
    // (no se les toca) y los que van al 0% (los que piden ticket virtual).
    //
    // De la misma pasada salen los montos de las tarjetas: la venta del dia y lo que
    // ya esta facturado. Facturado es SOLO la venta que el POS reporto FACTURADO, la
    // que quedo congelada con su folio de factura. Tener ticket virtual no cuenta:
    // el ticket es el papel con el que se va a facturar, no la factura. El monto
    // sale de s.total, que es lo que se cobro.
    function getTicketDayCounts($array) {
        $query = "
            SELECT COUNT(*) AS tickets,
                   COALESCE(SUM(st.name = 'FACTURADO'), 0) AS facturados,
                   COALESCE(SUM(s.tax = 0 AND (st.name IS NULL OR st.name <> 'FACTURADO')), 0) AS cero,
                   COALESCE(SUM(v.id IS NOT NULL), 0) AS generados,
                   COALESCE(SUM(s.total), 0) AS total,
                   COALESCE(SUM(CASE WHEN st.name = 'FACTURADO' THEN s.total ELSE 0 END), 0) AS total_facturado
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_status st ON st.id = s.sale_status_id
            LEFT JOIN {$this->bd}virtual_ticket v ON v.sale_id = s.id AND v.active = 1
            WHERE s.active = 1
              AND s.branch_id <=> ?
              AND DATE(s.operation_date) = ?
              AND EXISTS ({$this->sinEfectivo()})
        ";
        return $this->_Read($query, $array);
    }

    function getTicketByFolio($array) {
        $query = "
            SELECT s.id, s.folio, s.operation_date, s.subtotal, s.tax, s.total,
                   s.invoice_series, st.name AS status_name,
                   v.id AS virtual_id, v.note_number, v.subtotal AS virtual_subtotal,
                   v.discount AS virtual_discount,
                   {$this->ticketSelect()}
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_status st ON st.id = s.sale_status_id
            LEFT JOIN {$this->bd}virtual_ticket v ON v.sale_id = s.id AND v.active = 1
            WHERE s.active = 1 AND s.folio = ? AND s.branch_id <=> ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    // Ventas del dia que piden ticket virtual y no lo tienen: son las que genera de
    // una sola vez el boton del modulo. El 0% es el caso: sin IVA trasladado el
    // ticket del POS no sirve para facturar.
    //
    // Va en el mismo orden que listTicketsByDay: aqui se reparten las notas, y si
    // se repartieran en otro orden no coincidirian con el consecutivo que el
    // listado ya le mostro al usuario.
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
              AND EXISTS ({$this->sinEfectivo()})
            ORDER BY CAST(s.folio AS UNSIGNED) ASC, s.folio ASC
        ";
        return $this->_Read($query, $array);
    }

    // -- Productos puente --

    // Los puente son los que arman el ticket virtual: se marcan a mano en Catalogos
    // y solo sirven los que tienen precio. Del mas caro al mas barato, que es el
    // orden en que se van acomodando para llegar al total.
    function listBridgeProducts($array) {
        $query = "
            SELECT id, code, name, price
            FROM {$this->bd}product
            WHERE active = 1 AND is_bridge = 1 AND price > 0 AND branch_id <=> ?
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

    // La nota se reinicia cada dia: el consecutivo se busca dentro del dia de
    // expedicion, no en toda la tabla.
    function getNextNote($array) {
        $query = "
            SELECT COALESCE(MAX(note_number), 0) + 1 AS nota
            FROM {$this->bd}virtual_ticket
            WHERE issue_date = ? AND branch_id <=> ?
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

    function getMaxVirtualTicketId() {
        $query = "SELECT MAX(id) AS id FROM {$this->bd}virtual_ticket";
        return $this->_Read($query);
    }

    function createVirtualDetail($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}detail_virtual_ticket",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    // Regenerar es volver a armar el mismo ticket: se borra el anterior y sus
    // renglones se van con el por el CASCADE de virtual_ticket_id.
    function deleteVirtualTicket($array) {
        return $this->_Delete([
            'table' => "{$this->bd}virtual_ticket",
            'where' => $array['where'],
            'data'  => $array['data']
        ]);
    }
}
