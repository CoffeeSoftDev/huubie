<?php
// Presentaciones en la captura de Entradas y Salidas. Catálogo > Productos las da de
// alta (item_presentation: «Caja 24» es 24 piezas de su producto base). En el buscador
// de la captura salen como un producto más, con id "p{id}" y la nota de a cuánto
// equivalen; al guardar, cada renglón de presentación se vuelve renglón de su base:
// cantidad × factor y costo ÷ factor. El stock y el kárdex siempre van en el base.
// Lo usan mdl-entradas y mdl-salidas.

trait PresentacionesCaptura {

    // -- Consultas --

    // Las activas de la empresa cuyo producto base sigue activo.
    function listPresentacionesCaptura($array) {
        // [companies_id]
        $query = "
            SELECT
                p.id,
                p.item_id,
                p.name,
                p.sku,
                p.factor,
                p.cost_unit,
                p.image,
                p.unit_id,
                COALESCE(pu.code, '')            AS unidad,
                i.name                           AS base_name,
                i.category_id,
                ic.name                          AS categoria,
                bu.name                          AS base_unit,
                COALESCE(ia.cost_tax, i.tax, 0)  AS iva_compra
            FROM {$this->bd}item_presentation p
            INNER JOIN {$this->bd}item           i  ON i.id = p.item_id AND i.active = 1
            LEFT JOIN  {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN  {$this->bd}item_category  ic ON ic.id = i.category_id
            LEFT JOIN  {$this->bd}unit           pu ON pu.id = p.unit_id
            LEFT JOIN  {$this->bd}unit           bu ON bu.id = ia.unit_id
            WHERE p.active = 1 AND p.companies_id = ? {$this->presentacionesVisibles()}
            ORDER BY p.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function getPresentacionCaptura($array) {
        // [id, companies_id]
        $query = "
            SELECT p.id, p.item_id, p.name, p.factor
            FROM {$this->bd}item_presentation p
            INNER JOIN {$this->bd}item i ON i.id = p.item_id AND i.active = 1
            WHERE p.id = ? AND p.companies_id = ? AND p.active = 1
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // El último costo de la presentación (sin IVA), como updateItemCost con el producto.
    function updatePresentacionCosto($array) {
        // [cost_unit, id, companies_id]
        $query = "
            UPDATE {$this->bd}item_presentation
            SET cost_unit = ?
            WHERE id = ? AND companies_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Las presentaciones siguen a su producto base: si la sucursal no ve el base
    // (VisibilidadProductos), tampoco sus presentaciones. Salidas define su propia regla
    // (filtroCapturaProductos: lo suyo y lo de sus almacenes).
    private function presentacionesVisibles() {
        if (method_exists($this, 'filtroCapturaProductos')) return $this->filtroCapturaProductos('i');

        return method_exists($this, 'filtroProductosVisibles') ? $this->filtroProductosVisibles('i') : '';
    }

    // -- Captura --

    // Lo común de una presentación en el catálogo del buscador; cada módulo le pone
    // sus costos. `equivale` es la nota que la captura pinta debajo del nombre.
    function presentacionCatalogo($p) {
        $factor = (float) $p['factor'];

        return [
            'id'           => 'p' . $p['id'],
            'sku'          => $p['sku'] ?: '',
            'nombre'       => $p['name'],
            'categoria'    => $p['categoria'] ?: 'Sin categoria',
            'category_id'  => (string) ($p['category_id'] ?? ''),
            'unit_id'      => (string) ($p['unit_id'] ?? ''),
            'unidad'       => $p['unidad'] ?? '',
            'stock'        => 0,
            'image'        => $p['image'] ?? '',
            'icon'         => 'boxes',
            'presentacion' => true,
            'base_id'      => (string) $p['item_id'],
            'factor'       => $factor,
            'equivale'     => 'Equivale a ' . $this->cifraPresentacion($factor) . ' ' . $this->pluralPresentacion($p['base_unit']) . ' de ' . $p['base_name']
        ];
    }

    // Al mapa de stock del almacén ({item_id: cantidad}) le suma cada presentación con
    // los empaques completos que da su base: 40 piezas ÷ 24 = 1 caja.
    function stockConPresentaciones($map, $companiesId) {
        foreach ($this->listPresentacionesCaptura([$companiesId]) as $p) {
            $base   = (float) ($map[(string) $p['item_id']] ?? 0);
            $factor = (float) $p['factor'];

            $map['p' . $p['id']] = $factor > 0 ? max(0, floor($base / $factor)) : 0;
        }

        return $map;
    }

    // Los renglones con presentación ("p{id}") pasan a su base: cantidad × factor y cada
    // campo de `$porUnidad` (costos) ÷ factor. Devuelve los renglones, el error si una
    // presentación ya no está, y las usadas con su costo original (para su último costo).
    // El renglón convertido lleva `presentation_id` y `presentation_qty` (lo capturado)
    // para quien quiera guardarlo (Salidas lo enseña en su detalle).
    function renglonesABase($productos, $companiesId, $porUnidad) {
        $usadas = [];

        foreach ($productos as $i => $p) {
            $id = (string) ($p['product_id'] ?? '');
            if ($id === '' || $id[0] !== 'p') continue;

            $pres = $this->getPresentacionCaptura([(int) substr($id, 1), $companiesId]);
            if (!$pres) return ['productos' => [], 'error' => 'Una presentación de la captura ya no está activa; quítala y vuelve a agregarla', 'usadas' => []];

            $factor = (float) $pres['factor'];
            $usadas[] = ['id' => (int) $pres['id']] + array_intersect_key($p, array_flip($porUnidad));

            $productos[$i]['product_id']       = (int) $pres['item_id'];
            $productos[$i]['quantity']         = round((float) ($p['quantity'] ?? 0) * $factor, 4);
            $productos[$i]['unit_id']          = null;
            $productos[$i]['presentation_id']  = (int) $pres['id'];
            $productos[$i]['presentation_qty'] = (float) ($p['quantity'] ?? 0);

            foreach ($porUnidad as $campo) {
                if (isset($p[$campo]) && is_numeric($p[$campo])) $productos[$i][$campo] = (float) $p[$campo] / $factor;
            }
        }

        return ['productos' => $productos, 'error' => null, 'usadas' => $usadas];
    }

    private function cifraPresentacion($n) {
        return rtrim(rtrim(number_format((float) $n, 2, '.', ''), '0'), '.');
    }

    // «Pieza» → «piezas», «Paquete» → «paquetes»; abreviaturas y lo que ya termina en s igual.
    private function pluralPresentacion($unidad) {
        $u = mb_strtolower(trim((string) $unidad), 'UTF-8');

        if ($u === '') return 'unidades';
        if (mb_strlen($u) <= 3 || mb_substr($u, -1) === 's') return $u;

        return preg_match('/[aeiouáéíóú]$/u', $u) ? $u . 's' : $u . 'es';
    }
}
