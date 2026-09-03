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
            SELECT b.id, b.business_name, b.rfc, b.fiscal_address, b.phone, b.adjustment_tolerance,
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

    // Que venta entra al modulo. El criterio no es uno solo: cada POS exporta
    // cosas distintas y por eso se decide por el sistema de la sucursal.
    //
    //   wansoft  trae el estado de operacion, y esa es la unica regla: todo lo
    //            que se cobro ese dia, con la forma de pago que sea.
    //   el resto (Soft Restaurant) no exporta estado de operacion —la columna queda
    //            en NULL— y conserva el criterio de siempre: todo lo que no sea
    //            efectivo. Pedirle Pagada dejaria el modulo vacio.
    //
    // En Wansoft la forma de pago DEJO de filtrar el universo. Antes se pedia
    // ademas TARJETA DE CREDITO y el listado mostraba solo la mitad del dia; el
    // resto —el efectivo, la transferencia, el debito— no existia en pantalla, y
    // son justo los folios a los que se muda un cargo duplicado (ver
    // listCardPaymentsByDay). No se puede reasignar hacia un folio que no se ve.
    //
    // Lo que no cambio es el dinero: totalProcesable() sigue contando SOLO lo
    // cobrado con tarjeta, asi que la venta en efectivo entra al listado valiendo
    // $0.00 y no mueve ni las cifras del dia ni el reparto 16%/0%.
    //
    // Se expone como un solo predicado para que ninguna consulta pueda aplicar una
    // de las reglas y olvidarse de la otra.
    function ventaElegible() {
        if ($this->esWansoft()) return "EXISTS ({$this->estaPagada()})";

        return "EXISTS ({$this->sinEfectivo()})";
    }

    // El folio al que cuenta un cargo. Normalmente el suyo; cuando el cierre lo
    // mudo (ver migra-09) manda assigned_folio, y el cargo deja de sumar en su
    // folio original para sumar en el de destino.
    //
    // Toda la aritmetica del modulo pasa por aqui —el criterio de elegibilidad, el
    // monto procesable, las formas de pago que imprime el papel— para que la
    // mudanza no se tenga que escribir en cuatro consultas distintas y se pueda
    // olvidar en una.
    function folioDelPago() {
        return "COALESCE(p.assigned_folio, p.sale_folio)";
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
            WHERE p.active = 1 AND {$this->folioDelPago()} = s.folio AND pm.name = 'TARJETA DE CREDITO'
        ";
    }

    // El monto que el modulo procesa de una venta: SOLO lo que entro por tarjeta de
    // credito. Wansoft exporta un pago por fila, asi que una cuenta dividida deja
    // varios pagos con el mismo folio; el efectivo, el debito y la transferencia no
    // se facturan por esta via y no pueden viajar en el total del ticket.
    //
    // En la venta cobrada toda con tarjeta —el caso normal— esto da exactamente
    // s.total. La diferencia solo aparece cuando la cuenta se partio.
    //
    // Y da CERO en la venta que se cobro sin tarjeta, que desde la apertura del
    // universo (ver ventaElegible) tambien se lista: es el "servicio de mesa", el
    // folio que no factura nada mientras no reciba un cargo mudado.
    function montoCredito() {
        return "
            SELECT COALESCE(SUM(p.amount), 0)
            FROM {$this->bd}detail_sale_payment p
            LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
            WHERE p.active = 1 AND {$this->folioDelPago()} = s.folio AND pm.name = 'TARJETA DE CREDITO'
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
    //
    // Las formas de pago salen dos veces y no es un descuido:
    //
    //   payment_name  las del folio DESPUES de la mudanza. Es lo que imprime el
    //                 papel, porque describe el cargo que ese folio ampara.
    //   payment_real  las que el POS cobro en ese folio, sin mudanzas. Es lo que
    //                 la pantalla dice del servicio de mesa ("se cobro en
    //                 EFECTIVO") y lo que la conciliacion bancaria va a buscar.
    //
    // En el dia sin cargos mudados —el 99% de los dias— las dos dan lo mismo.
    // La venta trae su comanda cargada o no. Es lo que decide con que se imprime
    // el ticket al 16%: con los productos que el POS exporto, o con los del
    // catalogo cuando el detallado del dia no esta en el sistema.
    //
    // Se pregunta por sale_id y no por el folio del renglon, que es el MOVIMIENTO
    // PDV con el que lo exporto el POS (ver linkDetailToSaleByPdv): por sale_id
    // pasan los renglones que la carga ya engancho a su venta, que son exactamente
    // los que listSaleDetailByFolio va a leer para el papel. Preguntando por folio,
    // un renglon huerfano —cargado antes que su venta, o con movimiento que no
    // amarro— diria que la comanda esta ahi y el papel saldria igual del catalogo.
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

    // Los dos lados de la mudanza, para que la fila pueda decir de donde salio o a
    // donde se fue su cargo. Sin esto el listado mostraria un folio en efectivo
    // cobrando $1,070.00 sin explicar de donde, que es exactamente la clase de
    // cifra que nadie se atreve a facturar.
    //
    // Van como lista y no como folio suelto: nada impide que una cuenta se haya
    // partido en tres vouchers y ceda dos.
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

    // El listado va por folio ascendente. folio es VARCHAR, asi que se ordena por
    // su valor numerico: en texto el '9' cae despues del '10'. El folio en texto
    // queda de desempate para lo que no sea numero.
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
    //
    // Desde que el listado muestra el dia completo hay dos poblaciones y hay que
    // contarlas por separado, porque solo una factura:
    //
    //   tickets      los que traen monto con tarjeta. Son los que se reparten
    //                entre el 16% y el 0%, y los unicos que mueven las cifras.
    //   servicio     los que quedaron en $0.00 —el servicio de mesa—, que ni se
    //                reparten ni entran a los objetivos.
    //   movimientos  la suma de los dos: lo que el POS cobro ese dia.
    //
    // Por eso `generados_cero` pide ademas monto: el servicio de mesa tambien
    // recibe papel al 0% en el cierre, y sin acotarlo la tarjeta del 0% se leeria
    // como si el reparto hubiera mandado ahi el doble de tickets.
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

    // Ventas del dia que piden ticket virtual y no lo tienen: son las que genera de
    // una sola vez el boton del modulo. El 0% es el caso: sin IVA trasladado el
    // ticket del POS no sirve para facturar.
    //
    // Se exige monto: el papel del folio que no ampara ningun cargo —el servicio de
    // mesa y el movimiento que vino con Total $0.00— no se arma con productos y sale
    // con el cierre del dia (ver guardarTicketServicio). Colarlo aqui seria pedirle
    // al armador una combinacion que sume cero.
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
              AND {$this->totalProcesable()} > 0
              AND {$this->ventaElegible()}
            ORDER BY CAST(s.folio AS UNSIGNED) ASC, s.folio ASC
        ";
        return $this->_Read($query, $array);
    }

    // -- Reasignacion de cargos --

    // Los cargos con tarjeta del dia, uno por renglon y en el orden en que el POS
    // los capturo. De aqui sale la lista de los que hay que mudar: el folio que
    // aparece dos veces cede todos menos el primero.
    //
    // Se agrupan por sale_folio y NO por el folio efectivo: lo que se decide aqui
    // es a donde va cada cargo, asi que mirar el destino que ya tienen seria
    // repartir sobre el resultado del reparto anterior. El cierre limpia las
    // mudanzas antes de recalcularlas (ver clearReassignmentsByDay), y esta
    // consulta ve entonces el dia como lo mando el Excel.
    //
    // El cargo en $0.00 no cuenta: Wansoft exporta vouchers vacios —el folio 6284
    // del 22/08 trae uno— y si se colara como "el primero" el folio se quedaria
    // valiendo nada mientras su cobro real se muda a otro lado.
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

    // Los cargos que hoy estan mudados, para el registro que el modulo muestra. Se
    // lee de la base y no del plan porque el plan solo existe mientras corre el
    // cierre: al volver a entrar al dia, esto es lo unico que queda.
    //
    // Trae ademas cuanto cobro el folio que recibe y con que forma de pago, que es
    // lo que explica por que puede amparar un cargo ajeno: no va a pedir factura.
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

    // Muda un cargo. Se escribe uno por uno y no en bloque porque cada cargo va a
    // un folio distinto, y son un punado en el peor dia.
    function reassignPayment($array) {
        $query = "
            UPDATE {$this->bd}detail_sale_payment
               SET assigned_folio = ?
             WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Firma las mudanzas del dia con la corrida que las decidio. Va en una sola
    // sentencia y despues de abrirla, porque el orden lo impone la dependencia: el
    // reparto 16%/0% se calcula sobre los montos YA mudados y la corrida guarda ese
    // reparto, asi que cuando nace la corrida los cargos llevan rato en su sitio.
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

    // Devuelve todos los cargos del dia a su folio original. Es lo primero que hace
    // el cierre —el reparto se recalcula entero, no se acumula sobre el anterior— y
    // lo que deja deshacer el dia sin rastro.
    //
    // Va por sale_id y no por folio: el folio se repite entre sucursales y la tabla
    // de pagos no tiene branch_id propio, asi que el dia se acota por la venta.
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

    // Los del otro catalogo: todo lo que no es puente lleva IVA y con ellos se
    // arma el papel de la venta al 16% que llego sin su comanda. Mismo orden que
    // los puente, de mas caro a mas barato.
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

    // Regenerar un papel es actualizarlo, no cambiarlo por otro: el id del ticket
    // es su identidad interna (punto 22.1) y tiene que sobrevivir a que el dia se
    // rehaga. Los renglones si se reemplazan, porque son el papel armado de nuevo.
    function updateVirtualTicket($array) {
        return $this->_Update([
            'table'  => "{$this->bd}virtual_ticket",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    // El papel recien insertado, por su llave natural: el consecutivo del dia ya
    // es unico por (issue_date, note_number, branch_id), asi que preguntar por el
    // devuelve exactamente el que se acaba de escribir.
    //
    // Antes se resolvia con MAX(id) sobre la tabla entera, que es el id de la
    // ultima fila de CUALQUIER sucursal: dos cierres a la vez colgaban los
    // renglones del ticket equivocado.
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

    // Los renglones del papel que se vuelve a armar. Van por separado porque el
    // ticket ya no se borra: sin esto el papel regenerado sumaria los renglones
    // viejos y los nuevos.
    function deleteVirtualDetailByTicket($array) {
        $query = "
            DELETE FROM {$this->bd}detail_virtual_ticket
            WHERE virtual_ticket_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Antes de volver a repartir, los papeles del dia sueltan su numero de nota
    // guardandolo en negativo. No es un truco de estilo, lo pide el UNIQUE
    // (issue_date, note_number, branch_id): la nota es el lugar de la venta en el
    // dia y una carga nueva del Excel recorre todas, asi que la venta que estrena
    // la nota 3 chocaria contra el papel viejo de la que hoy es la 6.
    //
    // El negativo aparta el numero sin perder el papel —ni su id, que es lo que el
    // punto 22.1 exige conservar— y deja libre el positivo para quien lo estrene.
    // Lo que no vuelva a usarse se borra al final con deleteReleasedVirtualTickets.
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

    // Los que se quedaron con la nota apartada: nadie los reutilizo en este
    // reparto, asi que el dia ya no los contempla.
    function deleteReleasedVirtualTickets($ids) {
        if (empty($ids)) return false;

        $marks = implode(',', array_fill(0, count($ids), '?'));
        $query = "
            DELETE FROM {$this->bd}virtual_ticket
             WHERE note_number < 0 AND id IN ({$marks})
        ";
        return $this->_CUD($query, $ids);
    }

    // Todas las notas del dia de una sola sentencia: es lo que deshace el reparto.
    // Los renglones de cada una se van con ella por el CASCADE de
    // virtual_ticket_id, igual que al regenerar una suelta.
    //
    // Va en consulta cruda y no por _Delete porque la sucursal se compara con <=>:
    // branch_id admite NULL en este esquema y `= ?` no casa con nulo, asi que el
    // dia de una base sin sucursal dada de alta no borraria nada.
    function deleteVirtualTicketByDay($array) {
        $query = "
            DELETE FROM {$this->bd}virtual_ticket
            WHERE issue_date = ? AND branch_id <=> ?
        ";
        return $this->_CUD($query, $array);
    }

    // La corrida que armo esas notas. Se borra DESPUES de ellas y no al reves: la
    // FK fk_vt_run es RESTRICT, asi que mientras le cuelgue un solo papel MySQL
    // rechaza la sentencia.
    function deleteGenerationRunByDay($array) {
        $query = "
            DELETE FROM {$this->bd}generation_run
            WHERE issue_date = ? AND branch_id <=> ?
        ";
        return $this->_CUD($query, $array);
    }

    // -- Reparto del dia --

    // Insumo del reparto 16%/0%: la venta del dia elegible con lo que el algoritmo
    // necesita mirar. La nota viaja porque el ticket que sigue en el grupo del cero
    // conserva la suya, que ya se entrego; el par subtotal/impuesto porque de ahi
    // sale la tasa de la venta (ver tasaDe), y tiene_detalle porque el papel del
    // 16% solo se arma cuando la venta llego sin su comanda.
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

    // -- Corrida de generacion --

    // Cada cierre de dia deja aqui con que meta se repartio, que salio de cada
    // lado y donde corto. Sin esta fila el 70/30 no se puede auditar: la meta se
    // lee de la barra en cada peticion, asi que la pantalla de manana puede
    // recalcular un corte distinto al que de verdad se aplico.
    function createGenerationRun($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}generation_run",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    // La corrida se abre antes de armar los papeles, porque cada ticket necesita
    // su id, y se cierra al terminar con lo que de verdad quedo armado: el plan
    // dice a que tasa cae cada venta, pero un papel puede no llegar a armarse.
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

    // El consecutivo del registro maestro (punto 29). Es propio y no el id: el id
    // lo reparte MySQL y un borrado deja huecos, mientras que este numero es el que
    // se dicta y se anota, y tiene que correr sin saltos.
    //
    // Global a proposito, sin cortar por sucursal ni por año: GEN-000123 identifica
    // una corrida sin que haya que preguntar de donde salio.
    //
    // El SUBSTRING arranca en 5 porque el prefijo 'GEN-' son cuatro caracteres.
    function getNextGenerationRunFolio() {
        $query = "
            SELECT COALESCE(MAX(CAST(SUBSTRING(folio, 5) AS UNSIGNED)), 0) + 1 AS siguiente
            FROM {$this->bd}generation_run
            WHERE folio LIKE 'GEN-%'
        ";
        return $this->_Read($query);
    }

    // De que archivo salieron las ventas del dia (punto 29).
    //
    // Se toma el lote MAS RECIENTE que aporto ventas: un dia se puede recargar, y
    // el ultimo Excel es el que explica el estado con el que se genero. El nombre
    // se copia a la corrida en vez de leerse por join, porque el lote se puede
    // borrar y el registro maestro tiene que seguir diciendo de donde vino.
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

    // Las corridas de un dia, de la mas reciente a la mas vieja. Un dia puede
    // tener varias: el cierre completo y despues los tickets sueltos que se
    // regeneraron, y la auditoria tiene que poder verlas todas.
    //
    // El folio de corte se resuelve aqui y no en la pantalla: la corrida guarda el
    // id de la venta, pero lo que se audita es el folio que el POS imprimio.
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
