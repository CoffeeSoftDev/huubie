<?php
require_once __DIR__ . '/inv-plantilla.php';

/*  Venta → Inventarios: la venta descuenta el producto (F1 del plan
    «Descontar al vender», 27/11/2026). Lo usan Pedidos y Ventas (core-order).

    Corre DENTRO de la transacción de la venta, aislado con un SAVEPOINT: si
    algo del inventario falla, se deshace solo lo del inventario, queda en el
    log y la venta sigue. La caja nunca se detiene por inventario. Si MySQL ya
    tiró la transacción completa (deadlock), el error sube y la venta tampoco
    queda: se cobra otra vez.

    Qué descuenta: los renglones con un producto del Catálogo que lleva
    inventario (is_inventoriable = 1, o insumo) y no es personalizado
    (is_custom). Un paquete descuenta lo que lo arma (product_recipe) con la
    misma regla. La línea libre (sin producto) no descuenta. Se vende aunque no
    haya existencia: el saldo queda negativo y Stock lo marca agotado.

    Cuándo (decisión del 27/11/2026):
      invSaleOut   venta de mostrador al cobrarse; pedido al entregarse.
      invSaleBack  venta cancelada; pedido que regresa a «No entregado» o
                   «Para producir»; pedido eliminado.

    El documento es una salida (inventory_outflow) con el motivo del sistema
    SALIDA_POR_VENTA, sale_id = la venta y folio = el de la venta (V1735,
    P1653; si se vuelve a entregar, P1653-2). Sale del almacén por defecto de
    la sucursal. No se lista en Salidas: se ve en Kárdex.

    Las recetas (descontar insumos) quedan para después: plan en
    D:\coffeeBibliotecario\biblioteca\huubie\pro\app\inventarios\docs\plan-descontar-al-vender.html */
trait InventarioVenta {

    private function invDb()  { return 'fayxzvov_inventarios.'; }
    private function invPos() { return 'fayxzvov_pos.'; }

    // La salida de la venta. null = no había nada que descontar (o falló y quedó en el log).
    protected function invSaleOut($saleId) {
        return $this->invIsolated('invSaleOut', function () use ($saleId) {
            return $this->invSaleOutRun((int) $saleId);
        });
    }

    // Regresa al almacén lo que la venta sacó. null = no había salida.
    protected function invSaleBack($saleId, $reason) {
        return $this->invIsolated('invSaleBack', function () use ($saleId, $reason) {
            return $this->invSaleBackRun((int) $saleId, (string) $reason);
        });
    }

    // -- Aislamiento --

    private function invIsolated($what, callable $fn) {
        if (!$this->inTransaction || !$this->mysql) return null;

        $this->mysql->exec('SAVEPOINT inv_venta');

        try {
            $result = $fn();
            $this->mysql->exec('RELEASE SAVEPOINT inv_venta');

            return $result;
        } catch (Throwable $e) {
            // Sin savepoint (la transacción ya no existe) la venta tampoco puede quedar.
            try {
                $this->mysql->exec('ROLLBACK TO SAVEPOINT inv_venta');
            } catch (Throwable $lost) {
                throw $e;
            }

            $this->writeToLog('[ INVENTARIO VENTA ] :: ' . $what . ': ' . $e->getMessage());

            return null;
        }
    }

    // -- Salida --

    private function invSaleOutRun($saleId) {
        $inv  = $this->invDb();
        $sale = $this->invRow("
            SELECT s.id, s.folio, s.sale_type_id, s.branch_id, b.company_id, b.name AS branch
            FROM {$this->invPos()}sale s
            INNER JOIN branches b ON b.id = s.branch_id
            WHERE s.id = ?
            LIMIT 1
        ", [$saleId]);

        if (!$sale || (int) $sale['company_id'] <= 0) return null;

        // Primero el Catálogo: sin nada que lleve inventario no se toca la base de Inventarios.
        $items = $this->invSaleItems($saleId);
        if (!$items) return null;

        // Ya descontada (doble envío, o entregada otra vez sin haber regresado): no se repite.
        if ($this->invRow("SELECT id FROM {$inv}inventory_outflow WHERE sale_id = ? AND status = 'applied' AND active = 1 LIMIT 1", [$saleId])) return null;

        $companyId = (int) $sale['company_id'];
        $branchId  = (int) $sale['branch_id'];
        $isSale    = in_array((int) $sale['sale_type_id'], [2, 3], true);
        $reasonId  = $this->invSaleReason($companyId);
        $warehouse = $this->invSaleWarehouse($companyId, $branchId, (string) $sale['branch']);
        $whId      = (int) $warehouse['id'];
        $base      = ($isSale ? 'V' : 'P') . ($sale['folio'] !== null && $sale['folio'] !== '' ? $sale['folio'] : $sale['id']);
        $folio     = $this->invSaleFolio($companyId, $base);
        $note      = $isSale ? "Venta {$base}" : "Pedido {$base} entregado";
        $userId    = (int) ($_SESSION['user_id'] ?? 0) ?: null;
        $units     = 0.0;
        $cost      = 0.0;

        foreach ($items as $item) {
            $units += $item['quantity'];
            $cost  += $item['quantity'] * $item['cost'];
        }

        $this->invMust($this->_CUD("
            INSERT INTO {$inv}inventory_outflow
                (folio, note, total_products, total_units, total_cost, operation_date, status, user_id,
                 company_id, branch_id, warehouse_id, outflow_reason_id, sale_id, active)
            VALUES (?, ?, ?, ?, ?, CURDATE(), 'applied', ?, ?, ?, ?, ?, ?, 1)
        ", [$folio, $note, count($items), round($units, 4), round($cost, 2), $userId, $companyId, $branchId, $whId, $reasonId, $saleId]), 'salida');

        $outflowId = (int) $this->mysql->lastInsertId();
        if ($outflowId <= 0) throw new RuntimeException('salida sin id');

        foreach ($items as $item) {
            $lot = $this->invTakeLots($whId, $item['product_id'], $item['quantity']);

            [$prev, $post] = $this->invStockMove($companyId, $whId, $item['product_id'], -$item['quantity']);

            $this->invMust($this->_CUD("
                INSERT INTO {$inv}detail_inventory_outflow
                    (quantity, cost, subtotal, previous_stock, resulting_stock, inventory_outflow_id, product_id, stock_lot_id, active, moved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(6))
            ", [$item['quantity'], $item['cost'], round($item['quantity'] * $item['cost'], 2), $prev, $post, $outflowId, $item['product_id'], $lot]), 'renglón');
        }

        return ['folio' => $folio, 'warehouse' => $warehouse['name'], 'products' => count($items), 'units' => round($units, 4)];
    }

    // [{product_id, quantity, cost}] de lo que la venta saca del almacén.
    private function invSaleItems($saleId) {
        $pos   = $this->invPos();
        $items = [];
        $lines = $this->invRows("
            SELECT d.product_id, SUM(d.quantity) AS quantity, p.kind, p.cost,
                   IFNULL(p.is_inventoriable, 0) AS tracked, IFNULL(p.is_custom, 0) AS custom
            FROM {$pos}detail_sale d
            INNER JOIN {$pos}product p ON p.id = d.product_id
            WHERE d.sale_id = ? AND IFNULL(d.active, 1) = 1 AND d.quantity > 0
            GROUP BY d.product_id, p.kind, p.cost, p.is_inventoriable, p.is_custom
        ", [$saleId]);

        foreach ($lines as $line) {
            if ($line['kind'] !== 'bundle') {
                $this->invAddItem($items, $line, (float) $line['quantity']);
                continue;
            }

            $parts = $this->invRows("
                SELECT r.component_id AS product_id, r.quantity AS per, p.kind, p.cost,
                       IFNULL(p.is_inventoriable, 0) AS tracked, IFNULL(p.is_custom, 0) AS custom
                FROM {$pos}product_recipe r
                INNER JOIN {$pos}product p ON p.id = r.component_id
                WHERE r.product_id = ? AND IFNULL(r.active, 1) = 1
            ", [(int) $line['product_id']]);

            foreach ($parts as $part) {
                $per = (float) $part['per'] > 0 ? (float) $part['per'] : 1.0;

                $this->invAddItem($items, $part, (float) $line['quantity'] * $per);
            }
        }

        return array_values($items);
    }

    private function invAddItem(array &$items, array $p, $qty) {
        $tracked = (int) $p['tracked'] === 1 || $p['kind'] === 'supply';

        if (!$tracked || (int) $p['custom'] === 1 || !in_array($p['kind'], ['product', 'supply'], true) || $qty <= 0) return;

        $id = (int) $p['product_id'];

        if (isset($items[$id])) {
            $items[$id]['quantity'] = round($items[$id]['quantity'] + $qty, 4);
            return;
        }

        $items[$id] = ['product_id' => $id, 'quantity' => round($qty, 4), 'cost' => round((float) $p['cost'], 4)];
    }

    // El motivo «Venta POS» de la empresa; si nunca entró a Inventarios, se le copia la plantilla.
    private function invSaleReason($companyId) {
        $inv  = $this->invDb();
        $find = function () use ($inv, $companyId) {
            return $this->invRow("SELECT id FROM {$inv}outflow_reason WHERE company_id = ? AND code = 'SALIDA_POR_VENTA' ORDER BY active DESC, id LIMIT 1", [$companyId]);
        };

        $row = $find();

        if (!$row) {
            InvPlantilla::seed($this, $inv, $companyId);
            $row = $find();
        }

        // Ya tenía sus motivos, pero sin este: se copia solo el de la plantilla.
        if (!$row) {
            $columns = InvPlantilla::COLUMNS['outflow_reason'];

            $this->invMust($this->_CUD("
                INSERT INTO {$inv}outflow_reason ({$columns}, company_id, active)
                SELECT {$columns}, ?, 1
                FROM {$inv}outflow_reason
                WHERE company_id IS NULL AND code = 'SALIDA_POR_VENTA'
                ORDER BY id
                LIMIT 1
            ", [$companyId]), 'motivo');

            $row = $find();
        }

        if (!$row) throw new RuntimeException('falta el motivo SALIDA_POR_VENTA en la plantilla');

        return (int) $row['id'];
    }

    /*  El almacén por defecto de la sucursal. Si la sucursal nunca abrió
        Inventarios no tiene: se le crea el suyo, con la misma regla de
        core-inventarios::branchWarehouses («Almacén Cuarta»; el de la Matriz
        es el principal si la empresa no tiene otro). */
    private function invSaleWarehouse($companyId, $branchId, $branchName) {
        $inv  = $this->invDb();
        $find = function () use ($inv, $companyId, $branchId) {
            return $this->invRow("
                SELECT id, name
                FROM {$inv}warehouse
                WHERE company_id = ? AND branch_id = ? AND active = 1
                ORDER BY is_default DESC, is_main DESC, id
                LIMIT 1
            ", [$companyId, $branchId]);
        };

        $row = $find();
        if ($row) return $row;

        $main    = $this->invRow("SELECT id FROM branches WHERE company_id = ? AND IFNULL(is_active, 1) = 1 ORDER BY id LIMIT 1", [$companyId]);
        $hasMain = $this->invRow("SELECT id FROM {$inv}warehouse WHERE company_id = ? AND is_main = 1 AND active = 1 LIMIT 1", [$companyId]);
        $company = $this->invRow("SELECT name FROM companies WHERE id = ? LIMIT 1", [$companyId]);
        $isMain  = $main && (int) $main['id'] === (int) $branchId && !$hasMain;

        $this->invMust($this->_CUD("
            INSERT INTO {$inv}warehouse (name, is_main, is_default, supply_moves_stock, company_id, branch_id, active)
            VALUES (?, ?, 1, 1, ?, ?, 1)
        ", ['Almacén ' . $this->invShortBranch($branchName, $company ? (string) $company['name'] : ''), $isMain ? 1 : 0, $companyId, $branchId]), 'almacén');

        $row = $find();
        if (!$row) throw new RuntimeException('no se pudo crear el almacén de la sucursal');

        return $row;
    }

    // «Reginas Cuarta» -> «Cuarta».
    private function invShortBranch($name, $company) {
        $name    = trim($name);
        $company = trim($company);

        if ($company !== '' && mb_stripos($name, $company . ' ', 0, 'UTF-8') === 0) {
            $name = trim(mb_substr($name, mb_strlen($company, 'UTF-8'), null, 'UTF-8'));
        }

        return $name !== '' ? $name : 'de la sucursal';
    }

    // V1735 o P1653; si ese folio ya tiene salida (se canceló y se vuelve a entregar), P1653-2.
    private function invSaleFolio($companyId, $base) {
        $inv   = $this->invDb();
        $folio = $base;

        for ($n = 2; $this->invRow("SELECT id FROM {$inv}inventory_outflow WHERE company_id = ? AND folio = ? LIMIT 1", [$companyId, $folio]); $n++) {
            $folio = $base . '-' . $n;
        }

        return $folio;
    }

    // -- Regreso --

    private function invSaleBackRun($saleId, $reason) {
        $inv     = $this->invDb();
        $userId  = (int) ($_SESSION['user_id'] ?? 0) ?: null;
        $reason  = mb_substr(trim($reason), 0, 255, 'UTF-8') ?: 'Venta cancelada';
        $folios  = [];
        $outflows = $this->invRows("
            SELECT id, folio, company_id, warehouse_id
            FROM {$inv}inventory_outflow
            WHERE sale_id = ? AND status = 'applied' AND active = 1
            ORDER BY id
            FOR UPDATE
        ", [$saleId]);

        foreach ($outflows as $o) {
            $lines = $this->invRows("
                SELECT id, product_id, quantity, stock_lot_id
                FROM {$inv}detail_inventory_outflow
                WHERE inventory_outflow_id = ? AND active = 1
                ORDER BY id
            ", [(int) $o['id']]);

            foreach ($lines as $d) {
                [$prev, $post] = $this->invStockMove((int) $o['company_id'], (int) $o['warehouse_id'], (int) $d['product_id'], (float) $d['quantity']);

                $this->invMust($this->_CUD("
                    UPDATE {$inv}detail_inventory_outflow
                    SET cancel_previous_stock = ?, cancel_resulting_stock = ?, cancel_moved_at = NOW(6)
                    WHERE id = ?
                ", [$prev, $post, (int) $d['id']]), 'regreso del renglón');

                // Como cancelSalida: regresa al lote del que salió primero.
                if ($d['stock_lot_id']) {
                    $this->invMust($this->_CUD("UPDATE {$inv}stock_lot SET quantity = quantity + ? WHERE id = ?", [(float) $d['quantity'], (int) $d['stock_lot_id']]), 'regreso al lote');
                }
            }

            $this->invMust($this->_CUD("
                UPDATE {$inv}inventory_outflow
                SET status = 'cancelled', cancelled_at = NOW(), cancelled_user_id = ?, cancel_reason = ?
                WHERE id = ?
            ", [$userId, $reason, (int) $o['id']]), 'cancelar la salida');

            $folios[] = $o['folio'];
        }

        return $folios ? ['folios' => $folios] : null;
    }

    // -- Motor (las mismas reglas que core-inventarios) --

    // Suma o resta del saldo del almacén. Devuelve [antes, quedó]. Puede quedar negativo.
    private function invStockMove($companyId, $warehouseId, $productId, $delta) {
        $inv  = $this->invDb();
        $find = function () use ($inv, $warehouseId, $productId) {
            return $this->invRow("SELECT id, quantity FROM {$inv}stock WHERE warehouse_id = ? AND product_id = ? LIMIT 1 FOR UPDATE", [$warehouseId, $productId]);
        };

        $row = $find();

        if (!$row) {
            $this->invMust($this->_CUD("
                INSERT INTO {$inv}stock (quantity, company_id, warehouse_id, product_id, active)
                VALUES (0, ?, ?, ?, 1)
            ", [$companyId, $warehouseId, $productId]), 'existencia');

            $row = $find();
            if (!$row) throw new RuntimeException('sin renglón de existencia');
        }

        $prev = round((float) $row['quantity'], 4);
        $post = round($prev + $delta, 4);

        $this->invMust($this->_CUD("UPDATE {$inv}stock SET quantity = ?, last_movement_at = NOW() WHERE id = ?", [$post, (int) $row['id']]), 'saldo');

        return [$prev, $post];
    }

    // Saca de los lotes empezando por el que vence primero. Devuelve el id del primero que tocó.
    private function invTakeLots($warehouseId, $productId, $qty) {
        $inv   = $this->invDb();
        $rest  = $qty;
        $first = null;
        $lots  = $this->invRows("
            SELECT id, quantity
            FROM {$inv}stock_lot
            WHERE warehouse_id = ? AND product_id = ? AND quantity > 0 AND active = 1
            ORDER BY expires_at IS NULL, expires_at, id
            FOR UPDATE
        ", [$warehouseId, $productId]);

        foreach ($lots as $lot) {
            if ($rest <= 0) break;

            $take = min((float) $lot['quantity'], $rest);
            $rest = round($rest - $take, 4);

            $this->invMust($this->_CUD("UPDATE {$inv}stock_lot SET quantity = ? WHERE id = ?", [round((float) $lot['quantity'] - $take, 4), (int) $lot['id']]), 'lote');

            if ($first === null) $first = (int) $lot['id'];
        }

        return $first;
    }

    // -- Ayudantes --

    private function invRows($query, array $data) {
        $rows = $this->_Read($query, $data);

        return is_array($rows) ? $rows : [];
    }

    private function invRow($query, array $data) {
        $rows = $this->invRows($query, $data);

        return $rows ? $rows[0] : null;
    }

    private function invMust($result, $what) {
        if ($result !== true) throw new RuntimeException($what . ': ' . (is_string($result) ? $result : 'sin respuesta de la base'));
    }
}
