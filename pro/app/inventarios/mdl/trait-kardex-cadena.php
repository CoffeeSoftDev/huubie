<?php
/*  Cadena «Antes → Quedó» del kárdex (vista inventory_movement). Cada renglón
    guarda el stock de antes y el de después del momento en que movió. Si luego
    se edita una entrada o una salida, o se cancela un ajuste aplicado, los
    renglones que vienen detrás se quedan con números viejos. Esto los rehace
    en el orden del kárdex (sort_at) partiendo del stock real: el último
    «Quedó» siempre es lo que hay hoy en el almacén.

    La de inventory/operacion/almacen/mdl/mdl-kardex.php (KardexInventario)
    con los prefijos de movement_uid de pro. Corre dentro de la transacción
    de quien llama (core-inventarios). */
trait KardexCadena {

    // movement_uid => tabla y columnas de Antes / Quedó. Los prefijos largos primero.
    private function kardexTargets() {
        return [
            'IN-X-'   => ['detail_inventory_inflow',     'cancel_previous_stock',      'cancel_resulting_stock'],
            'IN-'     => ['detail_inventory_inflow',     'previous_stock',             'resulting_stock'],
            'OUT-X-'  => ['detail_inventory_outflow',    'cancel_previous_stock',      'cancel_resulting_stock'],
            'OUT-'    => ['detail_inventory_outflow',    'previous_stock',             'resulting_stock'],
            'TR-OUT-' => ['detail_inventory_transfer',   'origin_previous_stock',      'origin_resulting_stock'],
            'TR-IN-'  => ['detail_inventory_transfer',   'destination_previous_stock', 'destination_resulting_stock'],
            'ADJ-'    => ['detail_inventory_adjustment', 'previous_stock',             'resulting_stock']
        ];
    }

    // $pairs: [[product_id, warehouse_id], ...]; los repetidos se rehacen una vez.
    protected function kardexChains(array $pairs, $companyId) {
        $done = [];

        foreach ($pairs as $pair) {
            $key = (int) $pair[0] . '-' . (int) $pair[1];

            if (isset($done[$key])) continue;

            $done[$key] = true;
            $this->kardexChain((int) $pair[0], (int) $pair[1], (int) $companyId);
        }
    }

    private function kardexChain($productId, $warehouseId, $companyId) {
        $inv  = 'fayxzvov_inventarios.';
        $movs = $this->_Read("
            SELECT movement_uid, quantity, stock_prev, stock_post
            FROM {$inv}inventory_movement
            WHERE product_id = ? AND warehouse_id = ? AND company_id = ?
            ORDER BY sort_at, movement_uid
        ", [$productId, $warehouseId, $companyId]);

        if (!is_array($movs) || !$movs) return;

        $stock = $this->_Read("
            SELECT IFNULL(SUM(quantity), 0) AS quantity
            FROM {$inv}stock
            WHERE product_id = ? AND warehouse_id = ? AND active = 1
        ", [$productId, $warehouseId]);

        // Lo que había antes del primer movimiento: el stock real menos lo que movieron todos.
        $balance = (float) ($stock[0]['quantity'] ?? 0);
        foreach ($movs as $m) $balance -= (float) $m['quantity'];

        foreach ($movs as $m) {
            $prev     = round($balance, 4);
            $balance += (float) $m['quantity'];
            $post     = round($balance, 4);

            $same = $m['stock_prev'] !== null && $m['stock_post'] !== null
                && abs((float) $m['stock_prev'] - $prev) < 0.0001
                && abs((float) $m['stock_post'] - $post) < 0.0001;

            if (!$same) $this->kardexRow($m['movement_uid'], $prev, $post);
        }
    }

    private function kardexRow($uid, $prev, $post) {
        foreach ($this->kardexTargets() as $prefix => $t) {
            if (strpos($uid, $prefix) !== 0) continue;

            $this->must($this->_CUD(
                "UPDATE fayxzvov_inventarios.{$t[0]} SET {$t[1]} = ?, {$t[2]} = ? WHERE id = ?",
                [$prev, $post, (int) substr($uid, strlen($prefix))]
            ), 'kardexChain');

            return;
        }
    }
}
