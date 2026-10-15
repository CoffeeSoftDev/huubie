<?php
// Borrado real de entradas, salidas y pedidos (CoffeeIA de esos tres módulos).
// Lo usan mdl-entradas, mdl-salidas y mdl-ordenes con `use BorradoInventario;`.
//
// Antes de borrar se regresa el stock de lo que estaba aplicado, exacto y sin topes
// (puede quedar negativo): así, borrar todos los movimientos deja el stock en lo que
// había antes de ellos. Una cancelada ya regresó su stock y solo se borra.
// Corre dentro de la transacción de quien llama: un error deshace todo.

require_once __DIR__ . '/mdl-kardex.php';

trait BorradoInventario {

    use KardexInventario;

    // -- Entradas --

    // Devuelve el folio borrado, o null si no existe en la empresa.
    function deleteEntradaFullById($id, $companiesId) {
        $h = $this->_Read("
            SELECT id, folio, status, warehouse_id
            FROM {$this->bd}inventory_inflow
            WHERE id = ? AND companies_id = ?
            LIMIT 1
        ", [$id, $companiesId]);
        if (empty($h)) return null;

        $detalle = [];
        if ($h[0]['status'] === 'Aplicada') {
            $detalle = $this->_Read("
                SELECT item_id, COALESCE(confirmed_quantity, quantity) AS qty
                FROM {$this->bd}detail_inventory_inflow
                WHERE inventory_inflow_id = ? AND active = 1
            ", [$id]);

            foreach ($detalle as $d) {
                $this->moverStockBorrado((int) $d['item_id'], (int) $h[0]['warehouse_id'], -(float) $d['qty'], $companiesId);
            }
        }

        $this->_CUD("DELETE FROM {$this->bd}detail_inventory_inflow WHERE inventory_inflow_id = ?", [$id]);
        $this->_CUD("DELETE FROM {$this->bd}inventory_inflow WHERE id = ? AND companies_id = ?", [$id, $companiesId]);

        $this->updateKardexChains(array_map(function ($d) use ($h) {
            return [$d['item_id'], $h[0]['warehouse_id']];
        }, $detalle), $companiesId);

        return $h[0]['folio'];
    }

    // -- Salidas --

    function deleteSalidaFullById($id, $companiesId) {
        $h = $this->_Read("
            SELECT id, folio, status, warehouse_id
            FROM {$this->bd}inventory_shrinkage
            WHERE id = ? AND companies_id = ?
            LIMIT 1
        ", [$id, $companiesId]);
        if (empty($h)) return null;

        $detalle = [];
        if ($h[0]['status'] === 'Aplicada') {
            $detalle = $this->_Read("
                SELECT item_id, quantity AS qty
                FROM {$this->bd}detail_inventory_shrinkage
                WHERE inventory_shrinkage_id = ? AND active = 1
            ", [$id]);

            foreach ($detalle as $d) {
                $this->moverStockBorrado((int) $d['item_id'], (int) $h[0]['warehouse_id'], (float) $d['qty'], $companiesId);
            }
        }

        $this->_CUD("DELETE FROM {$this->bd}detail_inventory_shrinkage WHERE inventory_shrinkage_id = ?", [$id]);
        $this->_CUD("DELETE FROM {$this->bd}inventory_shrinkage WHERE id = ? AND companies_id = ?", [$id, $companiesId]);

        $this->updateKardexChains(array_map(function ($d) use ($h) {
            return [$d['item_id'], $h[0]['warehouse_id']];
        }, $detalle), $companiesId);

        return $h[0]['folio'];
    }

    // -- Pedidos --

    // Borra el pedido con todo lo que movió: los reabastos (REAB-) que salieron de él,
    // las entradas de su recepción (ENT-) y la salida de su surtido (SI-), regresando
    // el stock. Una compra (CP-) que venga de él detiene todo: esa vive en Compras.
    // Devuelve ['pedidos' => folios, 'movimientos' => folios]; vacío si no existe.
    function deletePedidoFullById($id, $companiesId) {
        $h = $this->_Read("
            SELECT id, folio
            FROM {$this->bd}purchase_order
            WHERE id = ? AND companies_id = ?
            LIMIT 1
        ", [$id, $companiesId]);
        if (empty($h)) return ['pedidos' => [], 'movimientos' => []];

        $borrado = ['pedidos' => [], 'movimientos' => []];
        $ligas   = $this->getPedidoLinksById($id);

        if ($ligas['compras']) {
            throw new Exception("la compra {$ligas['compras'][0]} viene de {$h[0]['folio']}");
        }

        foreach ($ligas['reabastos_ids'] as $hijo) {
            $b       = $this->deletePedidoFullById($hijo, $companiesId);
            $borrado = array_merge_recursive($borrado, $b);
        }
        foreach ($ligas['entradas_ids'] as $entrada) {
            $borrado['movimientos'][] = $this->deleteEntradaFullById($entrada, $companiesId);
        }
        foreach ($ligas['salidas_ids'] as $salida) {
            $borrado['movimientos'][] = $this->deleteSalidaFullById($salida, $companiesId);
        }

        $this->_CUD("DELETE FROM {$this->bd}detail_purchase_order WHERE purchase_order_id = ?", [$id]);
        $this->_CUD("DELETE FROM {$this->bd}purchase_order WHERE id = ? AND companies_id = ?", [$id, $companiesId]);

        $borrado['pedidos'][]   = $h[0]['folio'];
        $borrado['movimientos'] = array_values(array_filter($borrado['movimientos']));

        return $borrado;
    }

    // Lo que se va con el pedido: reabastos que generó, compras que salieron de él y
    // las entradas y salidas ligadas (purchase_order_id). Folios para la vista previa
    // e ids para borrar. El reabasto que nace al surtir no lleva origin_purchase_order_id:
    // su liga es la nota que le pone createReabastoOrden, y esa nadie la escribe a mano.
    function getPedidoLinksById($id) {
        $hijos = $this->_Read("
            SELECT h.id, h.folio
            FROM {$this->bd}purchase_order p
            INNER JOIN {$this->bd}purchase_order h
                ON h.origin_purchase_order_id = p.id
                OR (h.companies_id = p.companies_id AND h.folio LIKE 'REAB-%'
                    AND h.note = CONCAT('Reabasto por surtido de la solicitud ', p.folio))
            WHERE p.id = ? AND h.id <> p.id
            ORDER BY h.id
        ", [$id]);
        $entradas = $this->_Read("
            SELECT id, folio
            FROM {$this->bd}inventory_inflow
            WHERE purchase_order_id = ?
            ORDER BY id
        ", [$id]);
        $salidas = $this->_Read("
            SELECT id, folio
            FROM {$this->bd}inventory_shrinkage
            WHERE purchase_order_id = ?
            ORDER BY id
        ", [$id]);

        $reabastos = array_values(array_filter($hijos, function ($p) { return strpos($p['folio'], 'CP-') !== 0; }));
        $compras   = array_values(array_filter($hijos, function ($p) { return strpos($p['folio'], 'CP-') === 0; }));

        return [
            'reabastos'     => array_column($reabastos, 'folio'),
            'reabastos_ids' => array_map('intval', array_column($reabastos, 'id')),
            'compras'       => array_column($compras, 'folio'),
            'entradas'      => array_column($entradas, 'folio'),
            'entradas_ids'  => array_map('intval', array_column($entradas, 'id')),
            'salidas'       => array_column($salidas, 'folio'),
            'salidas_ids'   => array_map('intval', array_column($salidas, 'id'))
        ];
    }

    // -- Stock --

    // Suma `$delta` (negativo resta) al stock del producto en el almacén. Si no tiene
    // renglón se crea con ese valor, como al surtir sin existencia.
    private function moverStockBorrado($itemId, $warehouseId, $delta, $companiesId) {
        $r = $this->_Read("
            SELECT id
            FROM {$this->bd}stock
            WHERE item_id = ? AND warehouse_id = ? AND active = 1
            LIMIT 1
        ", [$itemId, $warehouseId]);

        if (!empty($r)) {
            $this->_CUD("
                UPDATE {$this->bd}stock
                SET quantity = quantity + ?, last_movement_at = NOW(), updated_at = NOW()
                WHERE id = ?
            ", [$delta, (int) $r[0]['id']]);
            return;
        }

        $this->_CUD("
            INSERT INTO {$this->bd}stock
                (quantity, last_movement_at, warehouse_id, item_id, companies_id)
            VALUES (?, NOW(), ?, ?, ?)
        ", [$delta, $warehouseId, $itemId, $companiesId]);
    }
}
