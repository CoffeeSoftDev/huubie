<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

// Pestaña Productos: productos y servicios de la sucursal. Los paquetes tienen su propia pestaña.
class ctrl extends core {

    // Opciones del filtro: categorías activas de la sucursal.
    public function init() {
        $fail = $this->needBranch();
        if ($fail) return array_merge($fail, ['categories' => []]);

        return ['status' => 200, 'categories' => $this->qCategoryOptions($this->branchId())];
    }

    // Opciones del modal. keep_* conserva la categoría y la subcategoría actuales aunque estén inactivas.
    public function formOptions() {
        $fail = $this->needBranch();
        if ($fail) return array_merge($fail, ['categories' => [], 'subcategories' => [], 'kinds' => []]);

        $branch = $this->branchId();

        return [
            'status'        => 200,
            'categories'    => $this->qCategoryOptions($branch, $this->postId('keep_category_id')),
            'subcategories' => $this->qSubcategoryOptions($branch, $this->postId('keep_subcategory_id')),
            'kinds'         => $this->productKinds()
        ];
    }

    public function lsProducts() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $company  = $this->companyId();
        $branch   = $this->branchId();
        $category = $this->selectOrNull('category_id');
        $row      = [];

        foreach ($this->qListProducts($company, $branch, $this->activeFilter(), $category) as $item) {
            $id = (int) $item['id'];

            $row[] = [
                'id'        => $id,
                'Producto'  => cellTitle($item['name'], $item['sku']),
                'Categoría' => $this->categoryCell($item),
                'Tipo'      => $item['kind'] === 'service' ? chip('Servicio', 'sky') : chip('Producto', 'slate'),
                'Precio'    => money($item['price']),
                'Costo'     => money($item['cost']),
                'Canales'   => $this->channelsCell($item),
                'Estado'    => renderActive($item['active']),
                'a'         => $this->rowActions('products', $id, $item['active'])
            ];
        }

        return ['status' => 200, 'row' => $row, 'count' => $this->qCountProducts($company, $branch)];
    }

    public function getProduct() {
        $data = $this->qGetProduct($this->postId(), $this->companyId(), $this->branchId());

        return $data ? ['status' => 200, 'data' => $data] : $this->fail(404, 'El producto no existe.');
    }

    public function addProduct() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $in = $this->productInput();
        if (isset($in['status'])) return $in;

        $dup = $this->duplicateError($in);
        if ($dup) return $dup;

        return $this->attempt(function () use ($in) {
            $this->must($this->qCreateProduct([
                'values' => [
                    'name', 'description', 'sku', 'barcode', 'kind', 'price', 'cost',
                    'is_custom', 'is_inventoriable', 'sell_pos', 'in_catalog',
                    'company_id', 'branch_id', 'category_id', 'subcategory_id', 'active'
                ],
                'data' => [
                    $in['name'], $in['description'], $in['sku'], $in['barcode'], $in['kind'], $in['price'], $in['cost'],
                    0, $in['is_inventoriable'], $in['sell_pos'], $in['in_catalog'],
                    $this->companyId(), $this->branchId(), $in['category_id'], $in['subcategory_id'], 1
                ]
            ]), 'addProduct');

            return $this->ok('Producto creado.');
        }, 'No se pudo guardar el producto.');
    }

    public function editProduct() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $id      = $this->postId();
        $current = $this->qGetProduct($id, $this->companyId(), $this->branchId());

        if (!$current) return $this->fail(404, 'El producto no existe.');

        $in = $this->productInput($current);
        if (isset($in['status'])) return $in;

        $dup = $this->duplicateError($in, $id);
        if ($dup) return $dup;

        return $this->attempt(function () use ($in, $id) {
            $this->must($this->qUpdateProduct([
                'values' => [
                    'name', 'description', 'sku', 'barcode', 'kind', 'price', 'cost',
                    'is_inventoriable', 'sell_pos', 'in_catalog', 'category_id', 'subcategory_id', 'updated_at = NOW()'
                ],
                'where' => ['id'],
                'data'  => [
                    $in['name'], $in['description'], $in['sku'], $in['barcode'], $in['kind'], $in['price'], $in['cost'],
                    $in['is_inventoriable'], $in['sell_pos'], $in['in_catalog'], $in['category_id'], $in['subcategory_id'], $id
                ]
            ]), 'editProduct');

            return $this->ok('Producto actualizado.');
        }, 'No se pudo guardar el producto.');
    }

    public function statusProduct() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        if (!$this->qGetProduct($id, $this->companyId(), $this->branchId())) return $this->fail(404, 'El producto no existe.');

        $active = $this->flag('active');

        // Un paquete activo con un componente inactivo no se podría vender completo.
        if ($active === 0) {
            $bundles = $this->qCountBundlesWith($id);

            if ($bundles > 0) return $this->fail(409, "Está en {$bundles} paquete(s) activo(s). Quítalo de ahí primero.");
        }

        return $this->attempt(function () use ($active, $id) {
            $this->must($this->qUpdateProduct([
                'values' => ['active', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [$active, $id]
            ]), 'statusProduct');

            return $this->ok($active === 1 ? 'Producto activado.' : 'Producto desactivado.');
        }, 'No se pudo cambiar el estado del producto.');
    }

    // -- Auxiliares --

    private function productKinds() {
        return [
            ['id' => 'product', 'valor' => 'Producto'],
            ['id' => 'service', 'valor' => 'Servicio']
        ];
    }

    // Devuelve los campos listos o una respuesta de error (trae 'status').
    // $current: el producto al editar; su categoría y subcategoría se aceptan aunque estén inactivas.
    private function productInput($current = null) {
        $kind          = $this->post('kind');
        $name          = $this->post('name');
        $sku           = $this->textOrNull('sku');
        $barcode       = $this->textOrNull('barcode');
        $description   = $this->textOrNull('description');
        $price         = $this->amount('price', null);
        $cost          = $this->amount('cost', 0);
        $categoryId    = $this->selectOrNull('category_id');
        $subcategoryId = $this->selectOrNull('subcategory_id');

        if ($kind === '') $kind = 'product';

        if (!in_array($kind, array_column($this->productKinds(), 'id'), true)) {
            return $this->fail(400, 'El tipo de producto no es válido.');
        }

        if ($name === '')                       return $this->fail(400, 'Escribe el nombre del producto.');
        if ($this->tooLong($name, 255))         return $this->fail(400, 'El nombre admite hasta 255 caracteres.');
        if ($this->tooLong($sku, 80))           return $this->fail(400, 'El SKU admite hasta 80 caracteres.');
        if ($this->tooLong($barcode, 80))       return $this->fail(400, 'El código de barras admite hasta 80 caracteres.');
        if ($this->tooLong($description, 1000)) return $this->fail(400, 'La descripción admite hasta 1000 caracteres.');
        if ($price === null)                    return $this->fail(400, 'Escribe el precio de venta: un número mayor o igual a 0.');
        if ($cost === null)                     return $this->fail(400, 'El costo debe ser un número mayor o igual a 0.');

        $problem = $this->categoryProblem($categoryId, $current ? (int) $current['category_id'] : 0);
        if ($problem) return $problem;

        $problem = $this->subcategoryProblem($subcategoryId, $categoryId, $current ? (int) $current['subcategory_id'] : 0);
        if ($problem) return $problem;

        return [
            'kind'             => $kind,
            'name'             => $name,
            'sku'              => $sku,
            'barcode'          => $barcode,
            'description'      => $description,
            'price'            => $price,
            'cost'             => $cost,
            'category_id'      => $categoryId,
            'subcategory_id'   => $subcategoryId,
            'sell_pos'         => $this->flag('sell_pos'),
            'in_catalog'       => $this->flag('in_catalog'),
            'is_inventoriable' => $this->flag('is_inventoriable')
        ];
    }

    // null si la subcategoría sirve; si no, la respuesta de error. $keepId: la que ya tenía (se acepta inactiva).
    private function subcategoryProblem($subcategoryId, $categoryId, $keepId = 0) {
        if ($subcategoryId === null) return null;
        if ($categoryId === null)    return $this->fail(400, 'Elige primero la categoría de la subcategoría.');

        $subcategory = $this->qGetSubcategory($subcategoryId, $this->branchId());

        if (!$subcategory) return $this->fail(400, 'La subcategoría elegida no existe.');

        if ((int) $subcategory['category_id'] !== $categoryId) {
            return $this->fail(400, 'La subcategoría no pertenece a la categoría elegida.');
        }

        if ((int) $subcategory['active'] === 0 && (int) $subcategory['id'] !== (int) $keepId) {
            return $this->fail(409, 'La subcategoría elegida está inactiva. Actívala o elige otra.');
        }

        return null;
    }

    // Respuesta 409 si el nombre, el SKU o el código de barras ya están ocupados; null si están libres.
    private function duplicateError($in, $exceptId = 0) {
        $company = $this->companyId();
        $branch  = $this->branchId();

        $dup = $this->qFindProductByName($company, $branch, $in['name'], $exceptId);
        if ($dup) return $this->nameTaken($dup, 'products');

        if ($in['sku'] !== null) {
            $dup = $this->qFindProductBySku($company, $branch, $in['sku'], $exceptId);
            if ($dup) return $this->takenBy($dup, 'El SKU');
        }

        if ($in['barcode'] !== null) {
            $dup = $this->qFindProductByBarcode($company, $branch, $in['barcode'], $exceptId);
            if ($dup) return $this->takenBy($dup, 'El código de barras');
        }

        return null;
    }

    // «El SKU ya lo usa «Café americano».» y, si ese está inactivo, dónde encontrarlo.
    private function takenBy($dup, $what) {
        $message = "{$what} ya lo usa «{$dup['name']}».";

        if ((int) $dup['active'] === 0) $message .= ' Está en el filtro «Inactivos».';

        return $this->fail(409, $message);
    }

    // «Pasteles › De chocolate»; — si no tiene ninguna.
    private function categoryCell($item) {
        $parts = array_filter([$item['category'], $item['subcategory']], function ($value) {
            return $value !== null && $value !== '';
        });

        return $parts ? h(implode(' › ', $parts)) : '<span class="cp-celda-sub">—</span>';
    }

    private function channelsCell($item) {
        $chips = [];

        if ((int) $item['sell_pos'] === 1)   $chips[] = chip('POS', 'emerald');
        if ((int) $item['in_catalog'] === 1) $chips[] = chip('Catálogo', 'sky');

        return $chips ? implode(' ', $chips) : '<span class="cp-celda-sub">—</span>';
    }
}

Permission::dispatch(new ctrl(), 'catalogo');
