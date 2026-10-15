<?php
// Cadena "Antes → Quedó" del historial de movimientos (visor de Stock y Movimientos).
// Cada renglón guarda el stock de antes y el de después del momento en que se capturó.
// Si luego se edita, cancela o borra un movimiento anterior, los que vienen detrás se
// quedan con números viejos. Esto los rehace en el orden del visor (created_at de la
// vista inventory_movement) partiendo del stock real: el último "Quedó" siempre es lo
// que hay hoy en el almacén.
// Lo trae BorradoInventario, así lo tienen mdl-entradas, mdl-salidas y mdl-ordenes.
// Corre dentro de la transacción de quien llama.

trait KardexInventario {

    // -- Cadena --

    // $pares: [[item_id, warehouse_id], ...]; los repetidos se rehacen una sola vez.
    function updateKardexChains($pares, $companiesId) {
        $hechos = [];
        foreach ($pares as $par) {
            $llave = (int) $par[0] . '-' . (int) $par[1];
            if (isset($hechos[$llave])) continue;
            $hechos[$llave] = true;
            $this->updateKardexChain((int) $par[0], (int) $par[1], $companiesId);
        }
    }

    function updateKardexChain($itemId, $warehouseId, $companiesId) {
        $movs = $this->_Read("
            SELECT movement_uid, movement_type, status, quantity, stock_prev, stock_post
            FROM {$this->bd}inventory_movement
            WHERE item_id = ? AND warehouse_id = ? AND companies_id = ?
            ORDER BY created_at ASC, movement_uid ASC
        ", [$itemId, $warehouseId, $companiesId]);
        if (empty($movs)) return;

        $stock = $this->_Read("
            SELECT COALESCE(SUM(quantity), 0) AS quantity
            FROM {$this->bd}stock
            WHERE item_id = ? AND warehouse_id = ? AND active = 1
        ", [$itemId, $warehouseId]);

        // Lo que había antes del primer movimiento: el stock real menos lo que movieron todos.
        $saldo = (float) ($stock[0]['quantity'] ?? 0);
        foreach ($movs as $m) $saldo -= $this->efectoKardex($m);

        foreach ($movs as $m) {
            $prev   = round($saldo, 4);
            $saldo += $this->efectoKardex($m);
            $post   = round($saldo, 4);

            $igual = $m['stock_prev'] !== null && $m['stock_post'] !== null
                && abs((float) $m['stock_prev'] - $prev) < 0.0001
                && abs((float) $m['stock_post'] - $post) < 0.0001;
            if (!$igual) $this->updateKardexRow($m['movement_uid'], $prev, $post);
        }
    }

    // Una orden de producción pendiente ya sale en la vista pero aún no mueve stock.
    private function efectoKardex($m) {
        if ($m['movement_type'] === 'ENTRADA' && $m['status'] === 'Pendiente') return 0.0;
        return (float) $m['quantity'];
    }

    // movement_uid = prefijo de la vista + id del renglón en su tabla de detalle.
    private function updateKardexRow($uid, $prev, $post) {
        $destinos = [
            'IN-'     => ['detail_inventory_inflow',     'previous_stock',         'resulting_stock'],
            'SH-'     => ['detail_inventory_shrinkage',  'previous_stock',         'resulting_stock'],
            'ADJ-'    => ['detail_inventory_adjustment', 'previous_stock',         'resulting_stock'],
            'TR-OUT-' => ['detail_inventory_transfer',   'origin_stock_prev',      'origin_stock_post'],
            'TR-IN-'  => ['detail_inventory_transfer',   'destination_stock_prev', 'destination_stock_post']
        ];
        foreach ($destinos as $prefijo => $d) {
            if (strpos($uid, $prefijo) !== 0) continue;
            $this->_CUD("
                UPDATE {$this->bd}{$d[0]}
                SET {$d[1]} = ?, {$d[2]} = ?
                WHERE id = ?
            ", [$prev, $post, (int) substr($uid, strlen($prefijo))]);
            return;
        }
    }
}
