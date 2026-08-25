<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {

    public $util;
    public $bd;

    // El POS del que salio el Excel de la sucursal ('wansoft', 'soft-restaurant').
    // De el dependen las reglas de ventaElegible(), porque cada sistema exporta
    // cosas distintas. Lo resuelve el controlador al arrancar.
    public $posCode = '';

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_facturacion.';
    }

    // -- Catalogos --

    // El sistema de punto de venta con el que opera la sucursal. Es un dato de la
    // sucursal y no de la sesion: de el dependen las reglas de elegibilidad, igual
    // que en Cargas depende el layout del archivo que se espera.
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
    //
    // Las dos filas se necesitan enteras porque el membrete reparte los datos entre
    // ellas: el lema y el domicilio fiscal son de la empresa y la direccion de la
    // sucursal es el LUGAR DE EXPEDICION.
    function getEmisor($array) {
        $query = "
            SELECT b.id, b.business_name, b.rfc, b.fiscal_address, b.phone,
                   c.business_name AS company_name, c.rfc AS company_rfc,
                   c.fiscal_address AS company_address, c.phone AS company_phone
            FROM {$this->bd}branch b
            LEFT JOIN {$this->bd}company c ON c.id = b.company_id
            WHERE b.id <=> ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    // Dias que tienen ventas elegibles (ver ventaElegible): son los unicos que
    // pueden pedir ticket virtual, asi que el filtro no ofrece dias que abririan
    // en vacio.
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

    // -- Tickets del dia --

    // Que venta entra a la generacion de tickets. El criterio no es uno solo: cada
    // POS exporta cosas distintas y por eso se decide por el sistema de la sucursal.
    //
    //   wansoft  desglosa la forma de pago y trae el estado de operacion, asi que
    //            se le exigen las dos reglas: TARJETA DE CREDITO y estado Pagada.
    //   el resto (Soft Restaurant) no exporta estado de operacion —la columna queda
    //            en NULL— y conserva el criterio de siempre: todo lo que no sea
    //            efectivo. Pedirle Pagada dejaria el modulo vacio.
    //
    // Se expone como un solo predicado para que ninguna consulta pueda aplicar una
    // de las reglas y olvidarse de la otra.
    function ventaElegible() {
        if ($this->esWansoft()) {
            return "EXISTS ({$this->soloCredito()}) AND EXISTS ({$this->estaPagada()})";
        }

        return "EXISTS ({$this->sinEfectivo()})";
    }

    function esWansoft() {
        return $this->posCode === 'wansoft';
    }

    // Criterio de Soft Restaurant: el efectivo no deja rastro bancario y no se
    // factura por esta via. Un ticket multipago entra si alguno de sus pagos fue
    // por banco.
    function sinEfectivo() {
        return "
            SELECT 1
            FROM {$this->bd}detail_sale_payment p
            LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
            WHERE p.active = 1 AND p.sale_folio = s.folio AND UPPER(pm.name) <> 'EFECTIVO'
        ";
    }

    // Criterio de Wansoft: solo lo cobrado con TARJETA DE CREDITO. El efectivo, el
    // debito, la transferencia y cualquier otra forma del catalogo quedan fuera del
    // monto que se reparte.
    //
    // La comparacion va sin UPPER(): la columna es utf8mb4_general_ci y ya ignora
    // mayusculas y acentos. UPPER() no es multibyte y convertiria «Tarjeta de
    // credito» en «TARJETA DE CRéDITO», que no empata con el seed. Es el mismo
    // cuidado que el importador toma con claveNombre().
    function soloCredito() {
        return "
            SELECT 1
            FROM {$this->bd}detail_sale_payment p
            LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
            WHERE p.active = 1 AND p.sale_folio = s.folio AND pm.name = 'TARJETA DE CREDITO'
        ";
    }

    // El monto que el modulo procesa de una venta: SOLO lo que entro por tarjeta de
    // credito. Wansoft exporta un pago por fila, asi que una cuenta dividida deja
    // varios pagos con el mismo folio; el efectivo, el debito y la transferencia no
    // se facturan por esta via y no pueden viajar en el total del ticket.
    //
    // En la venta cobrada toda con tarjeta —el caso normal— esto da exactamente
    // s.total. La diferencia solo aparece cuando la cuenta se partio.
    function montoCredito() {
        return "
            SELECT COALESCE(SUM(p.amount), 0)
            FROM {$this->bd}detail_sale_payment p
            LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
            WHERE p.active = 1 AND p.sale_folio = s.folio AND pm.name = 'TARJETA DE CREDITO'
        ";
    }

    // El total con el que trabajan las tarjetas del encabezado, el reparto 16/0 y el
    // papel. Se pide siempre con el alias `total` para que el controlador siga
    // leyendo $item['total'] sin enterarse de que POS viene.
    function totalProcesable() {
        return $this->esWansoft() ? "({$this->montoCredito()})" : "s.total";
    }

    // La venta que no se cobro no se factura: de los cuatro estados de operacion
    // que exporta Wansoft (Abierta, Pagada, Cancelada, Eliminada) solo Pagada llega
    // a ticket.
    //
    // El estado de operacion no es el estado fiscal: sale_status dice si la venta ya
    // se facturo (FACTURADO) o vencio, lo llena Soft Restaurant y se lee aparte. Un
    // POS llena una columna y el otro la otra, nunca las dos.
    function estaPagada() {
        return "
            SELECT 1
            FROM {$this->bd}sale_operation_status os
            WHERE os.id = s.operation_status_id AND os.name = 'Pagada'
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
            SELECT s.id, s.folio, s.operation_date, s.subtotal, s.tax,
                   {$this->totalProcesable()} AS total,
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

    // Conteos del dia para las pildoras del encabezado: los que ya estan facturados
    // (no se les toca) y los que van al 0% (los que piden ticket virtual).
    //
    // De la misma pasada salen los montos de las tarjetas: la venta del dia y lo que
    // ya esta facturado. Facturado es SOLO la venta que el POS reporto FACTURADO, la
    // que quedo congelada con su folio de factura. Tener ticket virtual no cuenta:
    // el ticket es el papel con el que se va a facturar, no la factura.
    //
    // El monto sale de totalProcesable(), no de s.total: en una cuenta dividida solo
    // cuenta la parte cobrada con tarjeta.
    //
    // total_cero es lo que el reparto dejo realmente en la tasa cero: la venta que
    // se quedo con papel. Es el mismo monto que suma generateDay(), y sirve para
    // contrastarlo contra el objetivo en la tarjeta del 0%.
    function getTicketDayCounts($array) {
        $query = "
            SELECT COUNT(*) AS tickets,
                   COALESCE(SUM(st.name = 'FACTURADO'), 0) AS facturados,
                   COALESCE(SUM(s.tax = 0 AND (st.name IS NULL OR st.name <> 'FACTURADO')), 0) AS cero,
                   COALESCE(SUM(v.id IS NOT NULL), 0) AS generados,
                   COALESCE(SUM({$this->totalProcesable()}), 0) AS total,
                   COALESCE(SUM(CASE WHEN st.name = 'FACTURADO' THEN {$this->totalProcesable()} ELSE 0 END), 0) AS total_facturado,
                   COALESCE(SUM(CASE WHEN v.id IS NOT NULL THEN {$this->totalProcesable()} ELSE 0 END), 0) AS total_cero
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

    // La venta suelta que se pide por folio, para verla en el panel o generarle su
    // ticket. A diferencia del listado no se filtra: una venta en efectivo o
    // cancelada se puede seguir consultando, pero viaja con el veredicto de las
    // reglas para que el controlador se niegue a generarle papel y diga por que.
    // Los EXISTS salen de los mismos helpers que filtran el listado, asi que el
    // criterio no se escribe dos veces.
    function getTicketByFolio($array) {
        $query = "
            SELECT s.id, s.folio, s.operation_date, s.subtotal, s.tax,
                   {$this->totalProcesable()} AS total,
                   s.invoice_series, st.name AS status_name,
                   os.name AS operation_status,
                   EXISTS ({$this->soloCredito()}) AS es_credito,
                   EXISTS ({$this->estaPagada()})  AS esta_pagada,
                   v.id AS virtual_id, v.note_number, v.subtotal AS virtual_subtotal,
                   v.discount AS virtual_discount,
                   {$this->ticketSelect()}
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_status st ON st.id = s.sale_status_id
            LEFT JOIN {$this->bd}sale_operation_status os ON os.id = s.operation_status_id
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
              AND {$this->ventaElegible()}
            ORDER BY CAST(s.folio AS UNSIGNED) ASC, s.folio ASC
        ";
        return $this->_Read($query, $array);
    }

    // -- Productos puente --

    // Los del catalogo de tasa 0% son los que arman el ticket virtual: se marcan a
    // mano en Catalogos y solo sirven los que tienen precio. Del mas caro al mas
    // barato, que es el orden en que se van acomodando para llegar al total.
    //
    // El modificador queda fuera aunque estuviera marcado: acompaña a otro producto
    // y un ticket armado con el saldria con un renglon que nadie pide solo.
    function listBridgeProducts($array) {
        $query = "
            SELECT id, code, name, price
            FROM {$this->bd}product
            WHERE active = 1 AND is_bridge = 1 AND is_modifier = 0 AND price > 0 AND branch_id <=> ?
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

    // -- Reparto del dia --

    // Insumo del reparto 16%/0%: la venta del dia elegible con lo unico que el
    // algoritmo necesita mirar. La nota viaja porque el ticket que sigue en el
    // grupo del cero conserva la suya, que ya se entrego.
    function listSaleDayForSplit($array) {
        $query = "
            SELECT s.id, s.folio, s.operation_date,
                   {$this->totalProcesable()} AS total,
                   st.name AS status_name,
                   v.id AS virtual_id, v.note_number
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

    // Los renglones reales del dia completo en una sola consulta. La hoja imprime
    // 91 papeles: pedir el detalle ticket por ticket serian 91 viajes a la base.
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

    // Los renglones reales de una sola venta, para el papel que se mira en el
    // panel. El listado del dia usa listSaleDetailByDay; aqui se pide uno.
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

    // Lo mismo para el papel inventado: los renglones puente de todos los tickets
    // del dia de una pasada, para no repetir listVirtualDetail por cada uno.
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

    // La venta que salio del grupo del cero suelta su papel: si se quedara, el
    // reparto guardado diria que sigue al 0% cuando ya se factura al 16%.
    function deleteVirtualTicketBySale($array) {
        return $this->_Delete([
            'table' => "{$this->bd}virtual_ticket",
            'where' => $array['where'],
            'data'  => $array['data']
        ]);
    }
}
