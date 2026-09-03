<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

// Modelo de la terminal Wansoft. Lee el mismo esquema del Facturador —es la misma
// operacion vista desde el mostrador— pero solo lo que la terminal necesita: el
// papel que YA se emitio. Nada de aqui genera folios ni reparte el dia; eso vive
// en mdl-facture-tickets.php y ahi se queda.
class mdl extends CRUD {

    public $util;
    public $bd;
    public $posCode = '';

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_facturacion.';
    }

    // -- Emisor --

    // El facturador tiene su propia tabla branch: el id de sucursal de la sesion de
    // Huubie es de otro esquema y no cruza con este.
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

    // El membrete que imprime el papel. Las dos filas se necesitan enteras porque el
    // encabezado reparte los datos entre ellas: el lema y el domicilio fiscal son de
    // la empresa y la direccion de la sucursal es el LUGAR DE EXPEDICION.
    function getEmisor($array) {
        $query = "
            SELECT b.id, b.business_name, b.logo, b.rfc, b.fiscal_address, b.phone,
                   c.business_name AS company_name, c.rfc AS company_rfc,
                   c.fiscal_address AS company_address, c.phone AS company_phone
            FROM {$this->bd}branch b
            LEFT JOIN {$this->bd}company c ON c.id = b.company_id
            WHERE b.id <=> ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    // Con que sistema opera la sucursal. Decide el formato del papel, no el
    // contenido: el ticket se busca igual en los dos.
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

    // -- Universo de la terminal --
    //
    // Lo que la terminal reimprime es el dia que el POS cobro, con el MISMO criterio
    // con el que el Facturador arma su listado: en Wansoft la venta pagada, en Soft
    // Restaurant la que dejo rastro bancario. Los dos modulos tienen que hablar del
    // mismo dia, o el ticket que uno emite es un movimiento que el otro no conoce.

    function esWansoft() {
        return $this->posCode === 'wansoft';
    }

    // El alias viaja porque el criterio se pregunta dos veces sobre la misma tabla:
    // una por la venta que se lista y otra, dentro de notaSelect, por las que la
    // preceden en el dia. Escrito con `s` fijo, la segunda contaria las filas de la
    // primera y toda venta saldria con la orden 1.
    function ventaElegible($alias = 's') {
        if ($this->esWansoft()) return "EXISTS ({$this->estaPagada($alias)})";

        return "EXISTS ({$this->sinEfectivo($alias)})";
    }

    // De los cuatro estados de operacion que exporta Wansoft solo Pagada llego a
    // cobrarse, y solo lo cobrado tiene ticket que reimprimir.
    function estaPagada($alias = 's') {
        return "
            SELECT 1
            FROM {$this->bd}sale_operation_status os
            WHERE os.id = {$alias}.operation_status_id AND os.name = 'Pagada'
        ";
    }

    // Criterio de Soft Restaurant: el efectivo no deja rastro bancario y no entra
    // por esta via.
    function sinEfectivo($alias = 's') {
        return "
            SELECT 1
            FROM {$this->bd}detail_sale_payment p
            LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
            WHERE p.active = 1 AND p.sale_folio = {$alias}.folio AND UPPER(pm.name) <> 'EFECTIVO'
        ";
    }

    // Si la venta trajo su comanda cargada. Es lo que decide con que se imprime el
    // ticket que no tiene papel virtual: con los productos que el POS exporto, o con
    // una sola partida de CONSUMO cuando el detallado no esta en el sistema.
    function conDetalle() {
        return "
            SELECT 1
            FROM {$this->bd}detail_sale d
            WHERE d.active = 1 AND d.sale_id = s.id
        ";
    }

    // -- Reimpresion --

    // Mesa y mesero salen de la comanda, que es la unica que los trae: el reporte de
    // ventas no exporta ninguno de los dos. Se correlaciona por folio de venta y no
    // por sale_id porque asi esta cargada la comanda (ver detail_sale.sale_folio).
    function comandaSelect() {
        return "
            (SELECT MIN(d.table_number)
               FROM {$this->bd}detail_sale d
              WHERE d.active = 1 AND d.sale_folio = s.folio) AS table_number,
            (SELECT COALESCE(MIN(w.name), MIN(d.waiter_code))
               FROM {$this->bd}detail_sale d
               LEFT JOIN {$this->bd}waiter w ON w.id = d.waiter_id
              WHERE d.active = 1 AND d.sale_folio = s.folio) AS waiter_name
        ";
    }

    // El folio que se busca en la terminal es el IMPRESO, no el de la venta: cuando
    // el cierre muda un cargo (punto 17) el papel conserva el suyo, y es el que el
    // cliente trae en la mano. visible_folio guarda esa foto; los papeles anteriores
    // a la migracion 15 caen al folio de su venta.
    function folioImpreso() {
        return "COALESCE(v.visible_folio, s.folio)";
    }

    // La nota que lleva el papel. El inventado la trae escrita —es la que se
    // entrego—; el real todavia no tiene ninguna, y en su lugar va el sitio que la
    // venta ocupa en su dia, que es exactamente la nota que el cierre le pondria.
    //
    // Se resuelve en la base y no contando filas en PHP para que el numero sea el
    // mismo en los tres caminos: la lista del periodo, la busqueda por movimiento y
    // la tanda que se manda a la impresora. Contando en PHP, la tanda —que solo trae
    // lo marcado— numeraria desde 1 y entregaria papeles con una orden distinta a la
    // que el cajero acaba de ver en la lista.
    function notaSelect() {
        return "
            COALESCE(v.note_number, (
                SELECT COUNT(*) + 1
                  FROM {$this->bd}sale s2
                 WHERE s2.active = 1
                   AND s2.branch_id <=> s.branch_id
                   AND DATE(s2.operation_date) = DATE(s.operation_date)
                   AND CAST(s2.folio AS UNSIGNED) < CAST(s.folio AS UNSIGNED)
                   AND {$this->ventaElegible('s2')}
            )) AS note_number
        ";
    }

    // Lo que la terminal reimprime son los DOS papeles del dia, no uno:
    //
    //   el inventado  fila viva de virtual_ticket, con su nota, sus renglones y su
    //                 importe. Es el que arma el reparto del cierre.
    //   el real       la venta cuya comanda cuadra, que NO guarda fila en
    //                 virtual_ticket a proposito (ver generateDay): su ticket es el
    //                 consumo que el POS exporto y no hay nada que inventarle.
    //
    // Por eso la consulta parte de la VENTA y el papel entra con LEFT JOIN. Partir
    // del papel dejaba fuera al segundo grupo —un tercio del dia— y esos movimientos
    // no salian en la lista ni se encontraban tecleando su numero, aunque el cliente
    // trajera el ticket en la mano.
    function ticketSelect() {
        return "
            v.id AS virtual_id, v.tax_rate,
            {$this->notaSelect()},
            v.subtotal AS virtual_subtotal, v.discount AS virtual_discount,
            v.tax AS virtual_tax, v.total AS virtual_total,
            v.origin_folio, v.visible_folio,
            COALESCE(v.issue_date, DATE(s.operation_date)) AS issue_date,
            {$this->folioImpreso()} AS folio,
            s.id AS sale_id, s.folio AS sale_folio, s.operation_date,
            s.subtotal, s.tax, s.total,
            EXISTS ({$this->conDetalle()}) AS tiene_detalle,
            {$this->comandaSelect()}
        ";
    }

    // El listado va por folio ascendente. folio es VARCHAR, asi que se ordena por su
    // valor numerico: en texto el '9' cae despues del '10'. Es el mismo orden con el
    // que el Facturador reparte las notas, y tiene que serlo: de ese lugar sale el
    // numero de orden de la venta que todavia no tiene papel.
    function ordenDelDia() {
        return "DATE(s.operation_date) ASC, CAST(s.folio AS UNSIGNED) ASC, s.folio ASC";
    }

    // Dias que tienen algo que reimprimir. Antes se leian de virtual_ticket y por eso
    // un dia sin cierre abria vacio aunque el POS ya hubiera subido sus ventas.
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

    // Los tickets de un periodo. Un dia suelto entra aqui con los dos extremos
    // iguales: la pantalla no tiene dos consultas, tiene una con un rango de un dia.
    function listTickets($array) {
        $query = "
            SELECT {$this->ticketSelect()}
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}virtual_ticket v ON v.sale_id = s.id AND v.active = 1
            WHERE s.active = 1
              AND s.branch_id <=> ?
              AND DATE(s.operation_date) BETWEEN ? AND ?
              AND {$this->ventaElegible()}
            ORDER BY {$this->ordenDelDia()}
        ";
        return $this->_Read($query, $array);
    }

    // El ticket que se pide por el movimiento que el cajero tiene a la vista. El
    // numero de orden no entra en el WHERE: viaja en la fila y lo coteja el
    // controlador, que puede decir en que se equivoco.
    function getTicketByFolio($array) {
        $query = "
            SELECT {$this->ticketSelect()}
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}virtual_ticket v ON v.sale_id = s.id AND v.active = 1
            WHERE s.active = 1
              AND s.branch_id <=> ?
              AND {$this->folioImpreso()} = ?
              AND {$this->ventaElegible()}
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    // La venta del movimiento, sin el filtro de elegibilidad. Solo sirve para
    // responder mejor cuando la busqueda no encuentra nada: un movimiento que existe
    // pero se cancelo no es lo mismo que un movimiento que no existe, y quien esta en
    // la caja necesita saber cual de las dos cosas le paso.
    function getSaleByFolio($array) {
        $query = "
            SELECT s.id, s.folio, s.operation_date
            FROM {$this->bd}sale s
            WHERE s.active = 1
              AND s.branch_id <=> ?
              AND s.folio = ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    // Los tickets que el usuario marco en la lista, para mandarlos juntos a la
    // impresora. Se piden por movimiento porque es lo que la seleccion guarda —el
    // numero que se ve en la fila— y no por el id interno de la venta.
    //
    // El primer valor del array es la sucursal y el resto son los folios: de ahi
    // salen las marcas del IN, que son tantas como folios haya.
    function listTicketsByFolios($array) {
        $marcas = implode(', ', array_fill(0, count($array) - 1, '?'));

        $query = "
            SELECT {$this->ticketSelect()}
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}virtual_ticket v ON v.sale_id = s.id AND v.active = 1
            WHERE s.active = 1
              AND s.branch_id <=> ?
              AND {$this->folioImpreso()} IN ({$marcas})
              AND {$this->ventaElegible()}
            ORDER BY {$this->ordenDelDia()}
        ";
        return $this->_Read($query, $array);
    }

    // Los renglones de varios papeles de una pasada: imprimir treinta tickets no
    // puede costar treinta consultas de detalle. Viajan con su virtual_ticket_id
    // para que el controlador los reparta.
    function listTicketLinesByTickets($array) {
        $marcas = implode(', ', array_fill(0, count($array), '?'));

        $query = "
            SELECT d.virtual_ticket_id, d.description, d.quantity, d.amount
            FROM {$this->bd}detail_virtual_ticket d
            WHERE d.active = 1
              AND d.virtual_ticket_id IN ({$marcas})
            ORDER BY d.virtual_ticket_id ASC, d.id ASC
        ";
        return $this->_Read($query, $array);
    }

    // Los renglones del papel emitido: description guarda el nombre del producto al
    // emitir, no lo lee del catalogo, para que lo que se entrego no cambie porque
    // cambie lo que hay detras.
    function listTicketLines($array) {
        $query = "
            SELECT description, quantity, unit_price, amount
            FROM {$this->bd}detail_virtual_ticket
            WHERE active = 1 AND virtual_ticket_id = ?
            ORDER BY id ASC
        ";
        return $this->_Read($query, $array);
    }

    // Los renglones del papel REAL: lo que de verdad consumieron, tal como el POS lo
    // exporto. Se piden por sale_id y no por el folio del renglon, que es el
    // movimiento PDV con el que llego la comanda: por sale_id pasan solo los
    // renglones que la carga ya engancho a su venta.
    function listSaleLines($array) {
        $query = "
            SELECT d.description, d.quantity, d.unit_price, d.amount
            FROM {$this->bd}detail_sale d
            WHERE d.active = 1 AND d.sale_id = ?
            ORDER BY d.id ASC
        ";
        return $this->_Read($query, $array);
    }

    // Los renglones reales de varios papeles de una pasada, por la misma razon que
    // los inventados: imprimir el dia entero no puede costar una consulta por ticket.
    function listSaleLinesBySales($array) {
        $marcas = implode(', ', array_fill(0, count($array), '?'));

        $query = "
            SELECT d.sale_id, d.description, d.quantity, d.amount
            FROM {$this->bd}detail_sale d
            WHERE d.active = 1
              AND d.sale_id IN ({$marcas})
            ORDER BY d.sale_id ASC, d.id ASC
        ";
        return $this->_Read($query, $array);
    }
}
