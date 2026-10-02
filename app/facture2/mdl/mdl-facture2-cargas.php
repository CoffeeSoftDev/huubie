<?php

// Consultas que solo necesita la carga de Wansoft.
//
// Vive aparte del modelo de Soft Restaurant y lo EXTIENDE en vez de copiarlo: los
// dos POS escriben en el mismo esquema y comparten casi todo (lotes, ventas,
// pagos, catalogos). Lo que cambia es el punado de metodos de aqui, que son los
// que tocan las tablas que la migracion 05 abrio para Wansoft.
//
// El controlador de cargas extiende esta clase y no la de Soft: heredando las dos
// familias, el mismo endpoint puede correr cualquiera de los dos importadores sin
// preguntar de quien es cada consulta.

require_once 'mdl-facture-cargas.php';

class mdl2 extends mdl {

    // -- Punto de venta de la sucursal --

    // El identificador con el que el controlador decide que importador usar. Es un
    // dato de la sucursal, no de la sesion: cambiar de sucursal cambia el POS que
    // esta operando y por lo tanto el layout del archivo que se espera.
    // `color` viaja con el code porque vive en el catalogo y no en el CSS: un POS
    // nuevo trae el suyo sin tocar la hoja de estilos del modulo.
    function getPosCode($array) {
        $query = "
            SELECT p.code, p.name, p.color
            FROM {$this->bd}branch b
            LEFT JOIN {$this->bd}pos p ON p.id = b.pos_id
            WHERE b.id <=> ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    // El id del POS de la sucursal, que es con lo que se separa el catalogo: dos
    // sistemas pueden llamar igual a productos distintos y los dos tienen razon.
    function getPosId($array) {
        $query = "
            SELECT pos_id
            FROM {$this->bd}branch
            WHERE id <=> ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    // La comision sobre propina que cobra la sucursal, para la vista de propinas.
    function getBranchCommission($array) {
        $query = "
            SELECT tip_commission_rate
            FROM {$this->bd}branch
            WHERE id <=> ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    // -- Ventas por movimiento PDV --

    // Wansoft no tiene folio fiscal: la llave estable del ticket es el movimiento
    // PDV. Se consulta igual que listSaleIdByFolio y por el mismo motivo (los IN de
    // miles de marcadores revientan el limite de PDO), pero cruzando por la columna
    // que si es unica en Wansoft.
    function listSaleIdByPdv($array) {
        $marks = implode(',', array_fill(0, count($array) - 1, '?'));
        $query = "
            SELECT id, pdv_movement
            FROM {$this->bd}sale
            WHERE branch_id <=> ? AND pdv_movement IN ({$marks})
        ";
        return $this->_Read($query, $array);
    }

    // Los movimientos del archivo que YA estan en base, con su total y su fecha.
    //
    // Es la consulta que sostiene la carga incremental: con ella el importador sabe
    // cuales tiene que saltarse antes de insertar nada. Se trae el total ademas del
    // id para poder distinguir un duplicado identico de uno que el POS corrigio
    // despues, que es informacion distinta aunque los dos se omitan.
    //
    // Sin filtro de periodo a proposito: un movimiento ya procesado lo esta aunque
    // el usuario elija otro mes en el filtro. La duplicidad es del dato, no del
    // periodo con el que se sube.
    function listSaleByPdvList($array) {
        $marks = implode(',', array_fill(0, count($array) - 1, '?'));
        $query = "
            SELECT id, folio, pdv_movement, total, operation_date, import_batch_id
            FROM {$this->bd}sale
            WHERE branch_id <=> ? AND pdv_movement IN ({$marks})
        ";
        return $this->_Read($query, $array);
    }

    // Cruce de los pagos del lote contra las ventas recien cargadas. Una sola
    // sentencia por lote: un UPDATE por fila no termina dentro del tiempo de la
    // peticion (mismo motivo que linkSalePaymentByBatch del modelo de Soft).
    //
    // Solo toca los pagos que aun no tienen venta, asi que volver a lanzarla no
    // deshace nada.
    function linkPaymentToSaleByPdv($array) {
        $query = "
            UPDATE {$this->bd}detail_sale_payment p
            JOIN {$this->bd}sale s
              ON s.pdv_movement = p.sale_folio AND s.active = 1 AND s.branch_id <=> ?
            SET p.sale_id = s.id
            WHERE p.active = 1 AND p.sale_id IS NULL AND p.import_batch_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Lo que lleva escrito una carga que TODAVIA esta corriendo.
    //
    // Las filas entran en bloques de 400 y cada bloque hace su propio commit, asi
    // que contarlas desde otra peticion dice cuanto va guardado de verdad. Es lo
    // unico que puede responder "¿se esta guardando?" mientras el importador
    // trabaja: el resultado de la carga no llega hasta que termina.
    //
    // Se pregunta por los lotes NACIDOS despues del ultimo que existia al empezar
    // (`id > ?`), no por fecha: el reloj del navegador no es el del servidor, y una
    // carga anterior del mismo archivo contaria como si fuera esta.
    //
    // `source_rows` es el denominador —las filas que el archivo trae— y se fija al
    // abrir el lote, antes de insertar nada.
    function listImportBatchProgress($array) {
        $query = "
            SELECT b.id,
                   b.sheet_name,
                   b.period_month,
                   b.period_year,
                   b.source_rows,
                   (SELECT COUNT(*) FROM {$this->bd}detail_sale d
                     WHERE d.import_batch_id = b.id)         AS renglones,
                   (SELECT COUNT(*) FROM {$this->bd}detail_sale_payment p
                     WHERE p.import_batch_id = b.id)         AS pagos
            FROM {$this->bd}import_batch b
            WHERE b.active = 1
              AND b.branch_id <=> ?
              AND b.file_name = ?
              AND b.id > ?
            ORDER BY b.id ASC
        ";
        return $this->_Read($query, $array);
    }

    // El lote se crea antes de insertar porque las filas necesitan su id, asi que
    // su conteo nace con las filas LEIDAS del archivo. En una carga incremental eso
    // no es lo que el lote contiene: se corrige al terminar con las que de verdad
    // entraron, o la bitacora diria 100 donde hay 20.
    function updateImportBatchRows($array) {
        $query = "
            UPDATE {$this->bd}import_batch
            SET row_count = ?, control_total = ?, duplicated_rows = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // -- Meseros y cajeros por nombre --

    // Wansoft manda el nombre completo y ningun codigo, asi que el catalogo se
    // cruza por `name`. Se traen los dos campos: el importador arma su mapa con el
    // nombre y respeta el codigo del que ya venia de Soft Restaurant.
    //
    // Sin filtro de active, igual que listProduct: la venta ocurrio y su mesero
    // existio. Dar de baja a alguien es dejar de asignarle mesas hoy, no borrar su
    // historia; si el cruce pidiera active = 1, la baja dejaria ventas huerfanas
    // que ya nadie podria volver a ligar.
    function listWaiterByName($array) {
        $query = "
            SELECT id, code, name
            FROM {$this->bd}waiter
            WHERE branch_id <=> ?
        ";
        return $this->_Read($query, $array);
    }

    function listCashier($array) {
        $query = "
            SELECT id, code, name
            FROM {$this->bd}cashier
            WHERE branch_id <=> ?
        ";
        return $this->_Read($query, $array);
    }

    function createCashier($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}cashier",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    // -- Estado operativo --

    // El eje operativo del ticket (Pagada / Cancelada), que no es el fiscal. Se
    // resuelve por nombre igual que lsSaleStatus, con el que convive.
    function lsSaleOperationStatus() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}sale_operation_status
            WHERE active = 1
        ";
        return $this->_Read($query);
    }

    // -- Resumen del dia --

    function createDailySummary($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}daily_sale_summary",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    // El resumen se reemplaza por dia, no por lote: el UNIQUE es
    // (operation_date, branch_id) y una recarga del mismo dia tiene que pisar la
    // fila anterior aunque venga de otro lote.
    function deleteDailySummaryByDate($array) {
        $query = "
            DELETE FROM {$this->bd}daily_sale_summary
            WHERE operation_date = ? AND branch_id <=> ?
        ";
        return $this->_CUD($query, $array);
    }

    function deleteDailySummaryByBatch($array) {
        return $this->_Delete([
            'table' => "{$this->bd}daily_sale_summary",
            'where' => $array['where'],
            'data'  => $array['data']
        ]);
    }

    // -- Rastro bancario --

    function createPaymentCard($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}detail_sale_payment_card",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    // El movimiento bancario se cuelga del pago por el numero de orden del PDV, que
    // es lo unico que las dos hojas comparten. Cuando una orden tiene varios pagos
    // se liga al primero: la hoja bancaria no dice a cual de ellos pertenece.
    function linkPaymentCardByBatch($array) {
        $query = "
            UPDATE {$this->bd}detail_sale_payment_card c
            JOIN {$this->bd}sale s
              ON s.pdv_movement = c.pdv_order AND s.active = 1 AND s.branch_id <=> ?
            JOIN {$this->bd}detail_sale_payment p
              ON p.sale_id = s.id AND p.active = 1
            SET c.sale_payment_id = p.id
            WHERE c.active = 1 AND c.sale_payment_id IS NULL AND c.import_batch_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function countPaymentCardByBatch($array) {
        $query = "
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN sale_payment_id IS NOT NULL THEN 1 ELSE 0 END) AS ligados
            FROM {$this->bd}detail_sale_payment_card
            WHERE import_batch_id = ?
        ";
        return $this->_Read($query, $array);
    }

    function listPaymentCardByBatch($array) {
        $marks = implode(',', array_fill(0, count($array), '?'));
        $query = "
            SELECT pdv_order, terminal, operation_type, bank, card_type, card_number,
                   authorization_code, amount, is_refund, operation_date
            FROM {$this->bd}detail_sale_payment_card
            WHERE import_batch_id IN ({$marks})
            ORDER BY id ASC
        ";
        return $this->_Read($query, $array);
    }

    function deletePaymentCardByBatch($array) {
        return $this->_Delete([
            'table' => "{$this->bd}detail_sale_payment_card",
            'where' => $array['where'],
            'data'  => $array['data']
        ]);
    }

    // -- Pagos eliminados --

    function createDeletedPayment($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}deleted_sale_payment",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function listDeletedPaymentByBatch($array) {
        $marks = implode(',', array_fill(0, count($array), '?'));
        $query = "
            SELECT d.pdv_order, d.terminal, d.modified_by, d.amount, d.tip,
                   d.operation_date, d.registered_at,
                   w.name AS waiter_name, c.name AS cashier_name, pm.name AS method_name
            FROM {$this->bd}deleted_sale_payment d
            LEFT JOIN {$this->bd}waiter w          ON w.id  = d.waiter_id
            LEFT JOIN {$this->bd}cashier c         ON c.id  = d.cashier_id
            LEFT JOIN {$this->bd}payment_method pm ON pm.id = d.payment_method_id
            WHERE d.import_batch_id IN ({$marks})
            ORDER BY d.id ASC
        ";
        return $this->_Read($query, $array);
    }

    function deleteDeletedPaymentByBatch($array) {
        return $this->_Delete([
            'table' => "{$this->bd}deleted_sale_payment",
            'where' => $array['where'],
            'data'  => $array['data']
        ]);
    }

    // -- Listados de la bitacora --

    // Las ventas de un lote de Wansoft se leen con lo que ese POS si trae: el
    // movimiento, el mesero y el cajero. billing_code y expires_at van siempre en
    // nulo aqui, asi que no se piden.
    function listSaleWansoftByBatch($array) {
        $marks = implode(',', array_fill(0, count($array), '?'));
        $query = "
            SELECT s.pdv_movement, s.order_number, s.operation_date, s.subtotal,
                   s.tax, s.total, s.guest_count,
                   os.name AS operation_status, w.name AS waiter_name, c.name AS cashier_name
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_operation_status os ON os.id = s.operation_status_id
            LEFT JOIN {$this->bd}waiter w                 ON w.id  = s.waiter_id
            LEFT JOIN {$this->bd}cashier c                ON c.id  = s.cashier_id
            WHERE s.import_batch_id IN ({$marks})
            ORDER BY s.order_number ASC
        ";
        return $this->_Read($query, $array);
    }

    // El renglon del lote tal como venia en la hoja: una fila por pago, con los
    // datos del ticket al que pertenece.
    //
    // La venta se trae por JOIN y no se repite en el pago porque la hoja SI los
    // repite —fecha, orden, mesero y cajero salen iguales en las dos filas de un
    // ticket partido— y guardarlos dos veces seria copiar esa redundancia a la
    // base. Aqui se reconstruye para mostrar la hoja como el usuario la subio.
    function listPaymentWansoftByBatch($array) {
        $marks = implode(',', array_fill(0, count($array), '?'));
        $query = "
            SELECT s.operation_date, s.order_number, s.pdv_movement,
                   p.sale_folio, p.amount, p.tip, p.terminal, p.reference,
                   p.transaction_code, p.validation_code, p.paid_at,
                   os.name AS operation_status,
                   w.name  AS waiter_name,
                   c.name  AS cashier_name,
                   pm.name AS method_name
            FROM {$this->bd}detail_sale_payment p
            LEFT JOIN {$this->bd}sale s                   ON s.id  = p.sale_id
            LEFT JOIN {$this->bd}sale_operation_status os ON os.id = s.operation_status_id
            LEFT JOIN {$this->bd}waiter w                 ON w.id  = s.waiter_id
            LEFT JOIN {$this->bd}cashier c                ON c.id  = s.cashier_id
            LEFT JOIN {$this->bd}payment_method pm        ON pm.id = p.payment_method_id
            WHERE p.import_batch_id IN ({$marks})
            ORDER BY p.id ASC
        ";
        return $this->_Read($query, $array);
    }

    // Propinas por mesero: la hoja de control del POS, reconstruida desde los pagos
    // del lote en vez de guardarse aparte.
    //
    // Wansoft la exporta ya sumada, pero no aporta un solo dato que no este en el
    // detalle: guardarla seria escribir dos veces lo mismo y arriesgarse a que las
    // dos copias dejen de coincidir. Calculandola aqui, ademas, la pantalla vale
    // como CUADRE: si lo que sale no empata con la hoja del Excel, la carga tiene
    // algo mal y se ve al instante.
    //
    // El mesero vive en la venta, no en el pago, asi que se llega a el por sale_id.
    // Los pagos que no cruzaron su venta caen en un grupo aparte en vez de
    // desaparecer: un total que no cuadra tiene que poder explicarse.
    function listTipsByWaiter($array) {
        $marks = implode(',', array_fill(0, count($array), '?'));
        $query = "
            SELECT COALESCE(w.name, '(sin mesero)') AS waiter_name,
                   COUNT(*)         AS pagos,
                   SUM(p.amount)    AS ventas,
                   SUM(p.tip)       AS propina
            FROM {$this->bd}detail_sale_payment p
            LEFT JOIN {$this->bd}sale s   ON s.id = p.sale_id
            LEFT JOIN {$this->bd}waiter w ON w.id = s.waiter_id
            WHERE p.active = 1 AND p.import_batch_id IN ({$marks})
            GROUP BY w.id, w.name
            ORDER BY SUM(p.tip) DESC, SUM(p.amount) DESC
        ";
        return $this->_Read($query, $array);
    }

    function listDailySummaryByBatch($array) {
        $marks = implode(',', array_fill(0, count($array), '?'));
        $query = "
            SELECT operation_date, order_count, guest_count, subtotal, tax, total, tip,
                   courtesy_count, free_dish_count, cancelled_dish_count,
                   cancelled_sale_count, courtesy_total, cancellation_total
            FROM {$this->bd}daily_sale_summary
            WHERE import_batch_id IN ({$marks})
            ORDER BY operation_date ASC
        ";
        return $this->_Read($query, $array);
    }

    // -- Catalogo de productos por punto de venta --

    // El catalogo del POS que opera, no el de la sucursal entera. Una sucursal que
    // migro de sistema conserva el catalogo viejo mientras el nuevo entra, y
    // cruzar sin este filtro devolveria claves de los dos.
    //
    // Sin filtro de active por el mismo motivo que listWaiterByName: el renglon de
    // una comanda de agosto tiene que poder ligarse a su platillo aunque hoy este
    // dado de baja del menu.
    function listProductByPos($array) {
        $query = "
            SELECT id, code, name, is_modifier
            FROM {$this->bd}product
            WHERE branch_id <=> ? AND pos_id <=> ?
        ";
        return $this->_Read($query, $array);
    }

    // -- Renglones de comanda --

    // Los renglones del lote se cuelgan de su venta por el movimiento PDV, igual
    // que linkPaymentToSaleByPdv hace con los pagos y por el mismo motivo: un
    // UPDATE por fila no termina dentro del tiempo de la peticion.
    //
    // Solo toca los que aun no tienen venta, asi que volver a lanzarla no deshace
    // nada.
    function linkDetailToSaleByPdv($array) {
        $query = "
            UPDATE {$this->bd}detail_sale d
            JOIN {$this->bd}sale s
              ON s.pdv_movement = d.sale_folio AND s.active = 1 AND s.branch_id <=> ?
            SET d.sale_id = s.id
            WHERE d.active = 1 AND d.sale_id IS NULL AND d.import_batch_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // El gemelo del anterior mirando al reves: engancha los renglones que llegaron
    // ANTES que su venta.
    //
    // Es lo que hace que el orden en que se suben los archivos deje de importar.
    // Sin filtro de lote a proposito: la carga de ventas de hoy puede completar
    // comandas que entraron huerfanas hace tres semanas, y acotarlo al lote en
    // curso las dejaria sueltas para siempre.
    function linkOrphanDetailToSale($array) {
        $query = "
            UPDATE {$this->bd}detail_sale d
            JOIN {$this->bd}sale s
              ON s.pdv_movement = d.sale_folio AND s.active = 1 AND s.branch_id <=> ?
            SET d.sale_id = s.id
            WHERE d.active = 1 AND d.sale_id IS NULL
        ";
        return $this->_CUD($query, $array);
    }

    // Resuelve product_id contra el catalogo del POS. Se hace en una sentencia por
    // lote y despues de sembrar el catalogo, para que los productos que nacieron
    // con esta misma carga tambien queden ligados.
    function linkDetailProductByBatch($array) {
        $query = "
            UPDATE {$this->bd}detail_sale d
            JOIN {$this->bd}product p
              ON p.code = d.product_code AND p.branch_id <=> ? AND p.pos_id <=> ?
            SET d.product_id = p.id
            WHERE d.product_id IS NULL AND d.import_batch_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Los movimientos PDV que YA tienen renglones cargados, para que la carga sea
    // incremental: volver a subir el mismo archivo no duplica una sola comanda.
    //
    // Se pregunta por movimiento y no por lote porque la duplicidad es del dato:
    // el mismo ticket puede venir en dos exports distintos.
    function listDetailPdvLoaded($array) {
        $marks = implode(',', array_fill(0, count($array) - 1, '?'));
        $query = "
            SELECT DISTINCT sale_folio
            FROM {$this->bd}detail_sale
            WHERE active = 1 AND sale_folio IN ({$marks})
              AND import_batch_id IN (
                  SELECT id FROM {$this->bd}import_batch WHERE branch_id <=> ?
              )
        ";
        return $this->_Read($query, $array);
    }

    // Cuantos renglones quedaron sin su venta, para poder decirlo en la bitacora.
    function countOrphanDetail($array) {
        $query = "
            SELECT COUNT(*) AS total, COUNT(DISTINCT sale_folio) AS tickets
            FROM {$this->bd}detail_sale
            WHERE active = 1 AND sale_id IS NULL AND import_batch_id = ?
        ";
        return $this->_Read($query, $array);
    }

    // Los renglones sueltos de TODA la sucursal, sin acotar a un lote.
    //
    // Se cuenta antes y despues del re-enlace para saber cuantos engancho: `_CUD`
    // devuelve el booleano de `execute()`, no las filas afectadas, asi que
    // castearlo daba 1 —y la carga anunciaba "1 renglon enganchado" donde habia
    // enganchado 448—. La resta de estos dos conteos si dice la verdad.
    function countOrphanDetailByBranch($array) {
        $query = "
            SELECT COUNT(*) AS total
            FROM {$this->bd}detail_sale d
            LEFT JOIN {$this->bd}import_batch b ON b.id = d.import_batch_id
            WHERE d.active = 1 AND d.sale_id IS NULL AND b.branch_id <=> ?
        ";
        return $this->_Read($query, $array);
    }
}
