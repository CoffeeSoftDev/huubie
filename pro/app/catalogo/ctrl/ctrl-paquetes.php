<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

// Pestaña Paquetes: un paquete es un product con kind 'bundle'; lo que lleva vive en product_recipe.
class ctrl extends core {

    // Opciones del modal. keep_id conserva la categoría actual aunque esté inactiva.
    public function formOptions() {
        $fail = $this->needBranch();
        if ($fail) return array_merge($fail, ['categories' => [], 'components' => []]);

        return [
            'status'     => 200,
            'categories' => $this->qCategoryOptions($this->branchId(), $this->postId('keep_id')),
            'components' => $this->qComponentOptions($this->companyId(), $this->branchId())
        ];
    }

    public function lsBundles() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $company = $this->companyId();
        $branch  = $this->branchId();
        $list    = $this->qListBundles($company, $branch, $this->activeFilter());
        $items   = $this->itemsByBundle(array_column($list, 'id'));
        $row     = [];

        foreach ($list as $item) {
            $id = (int) $item['id'];

            $row[] = [
                'id'           => $id,
                'Paquete'      => $this->bundleCell($item),
                'Contenido'    => $this->contentCell(isset($items[$id]) ? $items[$id] : []),
                'Por separado' => moneyCell($item['separate_price']),
                'Precio'       => $this->priceCell($item['price'], $item['separate_price']),
                'Estado'       => renderActive($item['active']),
                'a'            => $this->rowActions('bundles', $id, $item['active'])
            ];
        }

        return ['status' => 200, 'row' => $row, 'count' => $this->qCountBundles($company, $branch)];
    }

    public function getBundle() {
        $data = $this->qGetBundle($this->postId(), $this->companyId(), $this->branchId());

        if (!$data) return $this->fail(404, 'El paquete no existe.');

        $items = array_map(function ($item) {
            return [
                'id'     => (int) $item['component_id'],
                'name'   => $item['name'],
                'sku'    => (string) $item['sku'],
                'kind'   => $item['kind'],
                'qty'    => (float) $item['quantity'],
                'price'  => (float) $item['price'],
                'cost'   => (float) $item['unit_cost'],
                'active' => (int) $item['active']
            ];
        }, $this->qBundleItems([(int) $data['id']]));

        return ['status' => 200, 'data' => $data, 'items' => $items];
    }

    public function addBundle() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $in = $this->bundleInput();
        if (isset($in['status'])) return $in;

        $dup = $this->qFindProductByName($this->companyId(), $this->branchId(), $in['name']);
        if ($dup) return $this->nameTaken($dup, 'bundles');

        $photo = $this->photoInput();
        if (isset($photo['status'])) return $photo;

        return $this->attempt(function () use ($in, $photo) {
            // El paquete, su receta y su foto se guardan juntos o no se guarda nada.
            $this->transaction(function () use ($in, $photo) {
                $this->must($this->qCreateProduct([
                    'values' => [
                        'name', 'description', 'kind', 'price', 'cost', 'is_custom', 'is_inventoriable',
                        'sell_pos', 'in_catalog', 'company_id', 'branch_id', 'category_id', 'active'
                    ],
                    'data' => [
                        $in['name'], $in['description'], 'bundle', $in['price'], 0, 0, 0,
                        $in['sell_pos'], $in['in_catalog'], $this->companyId(), $this->branchId(), $in['category_id'], 1
                    ]
                ]), 'addBundle');

                $id = $this->qLastInsertId();

                if ($id <= 0) throw new RuntimeException('addBundle: sin id del paquete');

                $this->saveRecipe($id, $in['components']);

                if ($photo['b64'] === '') return;

                $this->must($this->qUpdateProduct([
                    'values' => ['image'],
                    'where'  => ['id'],
                    'data'   => [$this->writePhoto($id, $photo['b64'], 'paquetes'), $id]
                ]), 'addBundle/image');
            });

            return $this->ok('Paquete creado.');
        }, 'No se pudo guardar el paquete.');
    }

    public function editBundle() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $id      = $this->postId();
        $current = $this->qGetBundle($id, $this->companyId(), $this->branchId());

        if (!$current) return $this->fail(404, 'El paquete no existe.');

        $in = $this->bundleInput((int) $current['category_id'], $id);
        if (isset($in['status'])) return $in;

        $dup = $this->qFindProductByName($this->companyId(), $this->branchId(), $in['name'], $id);
        if ($dup) return $this->nameTaken($dup, 'bundles');

        $photo = $this->photoInput();
        if (isset($photo['status'])) return $photo;

        return $this->attempt(function () use ($in, $id, $photo, $current) {
            $image = $this->nextPhoto($id, $photo, $current['image'], 'paquetes');

            $this->transaction(function () use ($in, $id, $image) {
                $this->must($this->qUpdateProduct([
                    'values' => ['name', 'description', 'image', 'price', 'sell_pos', 'in_catalog', 'category_id', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [$in['name'], $in['description'], $image, $in['price'], $in['sell_pos'], $in['in_catalog'], $in['category_id'], $id]
                ]), 'editBundle');

                $this->saveRecipe($id, $in['components']);
            });

            if ($image !== $current['image']) $this->dropPhoto($current['image'], $id);

            return $this->ok('Paquete actualizado.');
        }, 'No se pudo guardar el paquete.');
    }

    public function statusBundle() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        if (!$this->qGetBundle($id, $this->companyId(), $this->branchId())) return $this->fail(404, 'El paquete no existe.');

        $active = $this->flag('active');

        // Con algo inactivo adentro, el paquete no se podría vender completo.
        if ($active === 1) {
            $off = array_filter($this->qBundleItems([$id]), function ($item) {
                return (int) $item['active'] === 0;
            });

            if ($off) {
                $names = implode(', ', array_column($off, 'name'));

                return $this->fail(409, "Lleva productos inactivos: {$names}. Actívalos en la pestaña Productos o quítalos del paquete.");
            }
        }

        return $this->attempt(function () use ($active, $id) {
            $this->must($this->qUpdateProduct([
                'values' => ['active', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [$active, $id]
            ]), 'statusBundle');

            return $this->ok($active === 1 ? 'Paquete activado.' : 'Paquete desactivado.');
        }, 'No se pudo cambiar el estado del paquete.');
    }

    // -- Auxiliares --

    /*  Devuelve los campos listos o una respuesta de error (trae 'status').
        $currentCategory: la que ya tenía (se acepta inactiva). $bundleId: el paquete que se edita.
        components llega como JSON: [{"id": 12, "qty": 2}, ...]. */
    private function bundleInput($currentCategory = 0, $bundleId = 0) {
        $name        = $this->nameInput();
        $description = $this->textOrNull('description');
        $price       = $this->amount('price', null);
        $categoryId  = $this->selectOrNull('category_id');
        $posted      = $this->postedJson('components');

        if ($name === '')                       return $this->fail(400, 'Escribe el nombre del paquete.');
        if ($this->tooLong($name, 255))         return $this->fail(400, 'El nombre admite hasta 255 caracteres.');
        if ($this->tooLong($description, 1000)) return $this->fail(400, 'La descripción admite hasta 1000 caracteres.');
        if ($price === null)                    return $this->fail(400, 'Escribe el precio del paquete: un número mayor o igual a 0.');

        $problem = $this->categoryProblem($categoryId, $currentCategory);
        if ($problem) return $problem;

        if ($posted === null) return $this->fail(400, 'La lista de productos del paquete no es válida.');

        // El mismo producto dos veces se junta en una sola línea.
        $merged = [];

        foreach ($posted as $component) {
            $id  = isset($component['id']) ? filter_var($component['id'], FILTER_VALIDATE_INT) : false;
            $qty = isset($component['qty']) && is_numeric($component['qty']) ? round((float) $component['qty'], 3) : 0;

            if ($id === false || $id <= 0 || $qty <= 0) return $this->fail(400, 'Cada producto del paquete necesita una cantidad mayor a 0.');
            if ($id === (int) $bundleId)                 return $this->fail(400, 'Un paquete no puede contenerse a sí mismo.');

            $merged[$id] = round((isset($merged[$id]) ? $merged[$id] : 0) + $qty, 3);
        }

        if (!$merged) return $this->fail(400, 'Agrega al menos un producto al paquete.');

        // Solo vuelven los productos y servicios activos de la sucursal.
        $found = $this->qComponentsByIds($this->companyId(), $this->branchId(), array_keys($merged));

        if (count($found) < count($merged)) {
            return $this->fail(409, 'Uno de los productos ya no está disponible (se desactivó o no existe). Revisa la lista.');
        }

        $components = [];

        foreach ($found as $item) {
            $id = (int) $item['id'];

            $components[] = ['id' => $id, 'qty' => $merged[$id], 'cost' => (float) $item['cost']];
        }

        return [
            'name'        => $name,
            'description' => $description,
            'price'       => $price,
            'category_id' => $categoryId,
            'components'  => $components,
            'sell_pos'    => $this->flag('sell_pos'),
            'in_catalog'  => $this->flag('in_catalog')
        ];
    }

    /*  Reescribe la receta completa y deja en el paquete la suma de lo que cuesta lo que lleva.
        Va dentro de transaction(): si una línea falla, no queda nada a medias.
        El costo se congela aquí: si luego cambia el costo de un producto, el paquete no se recalcula solo. */
    private function saveRecipe($bundleId, $components) {
        $this->must($this->qDeleteBundleItems($bundleId), 'saveRecipe: borrar receta');

        $total = 0;

        foreach ($components as $component) {
            $cost   = round($component['qty'] * $component['cost'], 2);
            $total += $cost;

            $this->must($this->qCreateBundleItem([
                'values' => ['quantity', 'cost', 'product_id', 'component_id', 'active'],
                'data'   => [$component['qty'], $cost, $bundleId, $component['id'], 1]
            ]), 'saveRecipe: línea de receta');
        }

        $this->must($this->qUpdateProduct([
            'values' => ['cost', 'updated_at = NOW()'],
            'where'  => ['id'],
            'data'   => [round($total, 2), $bundleId]
        ]), 'saveRecipe: costo del paquete');
    }

    // Foto + nombre + categoría, como la celda de Productos; sin foto, el regalo.
    private function bundleCell($item) {
        return '<div class="flex items-center gap-3">'
            . $this->productPhoto($item['image'], 'icon-gift')
            . '<div class="min-w-0">' . cellTitle($item['name'], $item['category']) . '</div>'
            . '</div>';
    }

    // Lo que lleva cada paquete de la lista, en una sola consulta: [bundle_id => [componentes]].
    private function itemsByBundle(array $ids) {
        $grouped = [];

        foreach ($this->qBundleItems($ids) as $item) {
            $grouped[(int) $item['product_id']][] = $item;
        }

        return $grouped;
    }

    // «2 × Café americano, 1 × Pan», recortado a 90 caracteres; avisa si lleva algo inactivo.
    private function contentCell(array $items) {
        if (!$items) return '<span class="cp-celda-sub">Sin productos</span>';

        $parts = array_map(function ($item) {
            return $this->quantityText($item['quantity']) . ' × ' . $item['name'];
        }, $items);

        $text = implode(', ', $parts);

        if (mb_strlen($text, 'UTF-8') > 90) $text = rtrim(mb_substr($text, 0, 89, 'UTF-8')) . '…';

        $inactive = array_filter($items, function ($item) {
            return (int) $item['active'] === 0;
        });

        return h($text) . ($inactive ? ' ' . chip('Lleva inactivos', 'red') : '');
    }

    // Precio y, si sale más barato que por separado, cuánto ahorra el cliente.
    private function priceCell($price, $separate) {
        $saving = (float) $separate - (float) $price;

        if ($saving <= 0.005 || abs((float) $price) < 0.005) return moneyCell($price);

        return money($price) . '<div class="cp-celda-sub">Ahorra ' . money($saving) . '</div>';
    }

    // Hasta 3 decimales, sin ceros de relleno: 2.000 -> 2; 1.500 -> 1.5.
    private function quantityText($value) {
        return rtrim(rtrim(number_format((float) $value, 3, '.', ','), '0'), '.');
    }
}

Permission::dispatch(new ctrl(), 'catalogo');
