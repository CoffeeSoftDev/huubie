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
    function getPosCode($array) {
        $query = "
            SELECT p.code, p.name
            FROM {$this->bd}branch b
            LEFT JOIN {$this->bd}pos p ON p.id = b.pos_id
            WHERE b.id <=> ?
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
        $query = "
            SELECT pdv_order, terminal, operation_type, bank, card_type, card_number,
                   authorization_code, amount, is_refund, operation_date
            FROM {$this->bd}detail_sale_payment_card
            WHERE import_batch_id = ?
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
        $query = "
            SELECT d.pdv_order, d.terminal, d.modified_by, d.amount, d.tip,
                   d.operation_date, d.registered_at,
                   w.name AS waiter_name, c.name AS cashier_name, pm.name AS method_name
            FROM {$this->bd}deleted_sale_payment d
            LEFT JOIN {$this->bd}waiter w          ON w.id  = d.waiter_id
            LEFT JOIN {$this->bd}cashier c         ON c.id  = d.cashier_id
            LEFT JOIN {$this->bd}payment_method pm ON pm.id = d.payment_method_id
            WHERE d.import_batch_id = ?
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
        $query = "
            SELECT s.pdv_movement, s.order_number, s.operation_date, s.subtotal,
                   s.tax, s.total, s.guest_count,
                   os.name AS operation_status, w.name AS waiter_name, c.name AS cashier_name
            FROM {$this->bd}sale s
            LEFT JOIN {$this->bd}sale_operation_status os ON os.id = s.operation_status_id
            LEFT JOIN {$this->bd}waiter w                 ON w.id  = s.waiter_id
            LEFT JOIN {$this->bd}cashier c                ON c.id  = s.cashier_id
            WHERE s.import_batch_id = ?
            ORDER BY s.order_number ASC
        ";
        return $this->_Read($query, $array);
    }

    // Los pagos de un lote de Wansoft: propina y terminal son lo que distingue a
    // este POS y por eso encabezan el listado.
    function listPaymentWansoftByBatch($array) {
        $query = "
            SELECT p.sale_folio, p.amount, p.tip, p.terminal, p.reference,
                   p.transaction_code, p.validation_code, p.paid_at,
                   pm.name AS method_name
            FROM {$this->bd}detail_sale_payment p
            LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
            WHERE p.import_batch_id = ?
            ORDER BY p.id ASC
        ";
        return $this->_Read($query, $array);
    }

    function listDailySummaryByBatch($array) {
        $query = "
            SELECT operation_date, order_count, guest_count, subtotal, tax, total, tip,
                   courtesy_count, free_dish_count, cancelled_dish_count,
                   cancelled_sale_count, courtesy_total, cancellation_total
            FROM {$this->bd}daily_sale_summary
            WHERE import_batch_id = ?
            ORDER BY operation_date ASC
        ";
        return $this->_Read($query, $array);
    }
}
