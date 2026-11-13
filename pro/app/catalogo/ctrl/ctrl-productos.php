<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

/*  Pestaña Productos: productos y servicios de la sucursal. Los paquetes tienen su propia pestaña.

    Compartido / Propio (decision F, 13/11/2026): lo de la Matriz lo venden todas
    las sucursales. Una sucursal lo «hace propio» copiandolo; mientras su copia
    este activa vende la suya. Desactivarla = volver al de la Matriz. */
class ctrl extends core {

    const PHOTO_MAX = 5242880;

    // Opciones del filtro. Fuera de la Matriz las categorías también incluyen las de ella.
    public function init() {
        $fail = $this->needBranch();
        if ($fail) return array_merge($fail, ['categories' => [], 'origins' => [], 'isMain' => true, 'main' => '']);

        $main = $this->mainBranch();

        return [
            'status'     => 200,
            'categories' => $this->qFilterCategories($this->branchId(), $this->mainBranchId()),
            'origins'    => $this->originOptions(),
            'isMain'     => $this->isMainBranch(),
            'main'       => isset($main['name']) ? $main['name'] : ''
        ];
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

    /*  En la Matriz: lo suyo. En otra sucursal: lo suyo y lo que hereda de la Matriz;
        lo heredado solo sale con «Activos» (uno inactivo de la Matriz no se le ofrece).
        origin: '' todos, 'own' propios, 'main' de la Matriz. */
    public function lsProducts() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $company    = $this->companyId();
        $branch     = $this->branchId();
        $main       = $this->mainBranchId();
        $isMain     = $this->isMainBranch();
        $active     = $this->activeFilter();
        $origin     = $isMain ? '' : $this->post('origin');
        $count      = $this->qCountProducts($company, $branch, $main);
        $categoryId = $this->selectOrNull('category_id');
        $category   = $categoryId === null ? null : $this->qCategoryName($categoryId, $branch, $main);
        $items      = [];

        if ($categoryId !== null && $category === null) return ['status' => 200, 'row' => [], 'count' => $count];

        if ($origin !== 'main') {
            foreach ($this->qListProducts($company, $branch, $active, $category, $main) as $item) {
                $items[] = $item + ['from_main' => 0];
            }
        }

        if (!$isMain && $origin !== 'own' && $active === 1) {
            foreach ($this->qListMainProducts($company, $branch, $main, $category) as $item) {
                $items[] = $item + ['from_main' => 1, 'twin_main' => 0, 'own_elsewhere' => 0];
            }
        }

        usort($items, fn ($a, $b) => strcasecmp($a['name'], $b['name']));

        $row = array_map(fn ($item) => $this->productRow($item, $isMain), $items);

        return ['status' => 200, 'row' => $row, 'count' => $count];
    }

    /*  «Hacer propio»: copia a esta sucursal uno de la Matriz. Desde ahí la sucursal
        vende su copia y la cambia sin tocar la Matriz. La categoría y la subcategoría
        se buscan por nombre en la sucursal y, si no existen, se crean (Pedidos las
        agrupa por nombre). Se guarda todo o nada. */
    public function copyProduct() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        if ($this->isMainBranch()) return $this->fail(409, 'Estás en la Matriz: sus productos ya son suyos.');

        $source = $this->qGetMainProduct($this->postId(), $this->companyId(), $this->mainBranchId());

        if (!$source) return $this->fail(404, 'El producto ya no está activo en la Matriz.');

        $dup = $this->duplicateError([
            'name'    => trim($source['name']),
            'sku'     => $this->nullIfBlank($source['sku']),
            'barcode' => $this->nullIfBlank($source['barcode'])
        ]);
        if ($dup) return $dup;

        return $this->attempt(function () use ($source) {
            $id = $this->transaction(function () use ($source) {
                $categoryId    = $this->branchCategory($source);
                $subcategoryId = $this->branchSubcategory($source, $categoryId);

                $this->must($this->qCreateProduct([
                    'values' => [
                        'name', 'description', 'image', 'sku', 'barcode', 'kind', 'unit_id', 'price', 'cost',
                        'portion_qty', 'shelf_life_days', 'is_custom', 'is_inventoriable', 'sell_pos', 'in_catalog',
                        'company_id', 'branch_id', 'category_id', 'subcategory_id', 'active'
                    ],
                    'data' => [
                        trim($source['name']), $source['description'], $source['image'],
                        $this->nullIfBlank($source['sku']), $this->nullIfBlank($source['barcode']),
                        $source['kind'], $source['unit_id'], $source['price'], $source['cost'],
                        $source['portion_qty'], $source['shelf_life_days'], 0, $source['is_inventoriable'],
                        $source['sell_pos'], $source['in_catalog'],
                        $this->companyId(), $this->branchId(), $categoryId, $subcategoryId, 1
                    ]
                ]), 'copyProduct');

                return $this->newId('copyProduct');
            });

            return $this->ok('Ahora es propio de esta sucursal. Lo que cambies no toca la Matriz.', ['id' => $id]);
        }, 'No se pudo copiar el producto.');
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

        $photo = $this->photoInput();
        if (isset($photo['status'])) return $photo;

        // La foto se nombra con el id: primero el producto y luego la foto, todo o nada.
        return $this->attempt(function () use ($in, $photo) {
            $this->transaction(function () use ($in, $photo) {
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

                if ($photo['b64'] === '') return;

                $id = $this->newId('addProduct');

                $this->must($this->qUpdateProduct([
                    'values' => ['image'],
                    'where'  => ['id'],
                    'data'   => [$this->writePhoto($id, $photo['b64']), $id]
                ]), 'addProduct/image');
            });

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

        $photo = $this->photoInput();
        if (isset($photo['status'])) return $photo;

        return $this->attempt(function () use ($in, $id, $photo, $current) {
            $image = $this->nextPhoto($id, $photo, $current['image']);

            $this->must($this->qUpdateProduct([
                'values' => [
                    'name', 'description', 'image', 'sku', 'barcode', 'kind', 'price', 'cost',
                    'is_inventoriable', 'sell_pos', 'in_catalog', 'category_id', 'subcategory_id', 'updated_at = NOW()'
                ],
                'where' => ['id'],
                'data'  => [
                    $in['name'], $in['description'], $image, $in['sku'], $in['barcode'], $in['kind'], $in['price'], $in['cost'],
                    $in['is_inventoriable'], $in['sell_pos'], $in['in_catalog'], $in['category_id'], $in['subcategory_id'], $id
                ]
            ]), 'editProduct');

            if ($image !== $current['image']) $this->dropPhoto($current['image'], $id);

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

    private function originOptions() {
        return [
            ['id' => '',     'valor' => 'Todos'],
            ['id' => 'own',  'valor' => 'Propios'],
            ['id' => 'main', 'valor' => 'De la Matriz']
        ];
    }

    private function nullIfBlank($value) {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    // Solo dentro de transaction().
    private function newId($what) {
        $id = $this->qLastInsertId();

        if ($id <= 0) throw new RuntimeException("{$what}: sin id");

        return $id;
    }

    // La categoría de la sucursal con el nombre de la de la Matriz. Si la tiene inactiva, la copia queda sin categoría.
    private function branchCategory($source) {
        if ($source['category'] === null || $source['category'] === '') return null;

        $found = $this->qFindCategoryByName($this->branchId(), $source['category']);

        if ($found) return (int) $found['active'] === 1 ? (int) $found['id'] : null;

        $this->must($this->qCreateCategory([
            'values' => ['name', 'description', 'branch_id', 'active'],
            'data'   => [$source['category'], $source['category_description'], $this->branchId(), 1]
        ]), 'copyProduct/category');

        return $this->newId('copyProduct/category');
    }

    private function branchSubcategory($source, $categoryId) {
        if ($categoryId === null || $source['subcategory'] === null || $source['subcategory'] === '') return null;

        $found = $this->qFindSubcategoryByName($categoryId, $source['subcategory']);

        if ($found) return (int) $found['active'] === 1 ? (int) $found['id'] : null;

        $this->must($this->qCreateSubcategory([
            'values' => ['name', 'description', 'branch_id', 'category_id', 'active'],
            'data'   => [$source['subcategory'], $source['subcategory_description'], $this->branchId(), $categoryId, 1]
        ]), 'copyProduct/subcategory');

        return $this->newId('copyProduct/subcategory');
    }

    // Devuelve los campos listos o una respuesta de error (trae 'status').
    // $current: el producto al editar; su categoría y subcategoría se aceptan aunque estén inactivas.
    private function productInput($current = null) {
        $kind          = $this->post('kind');
        $name          = $this->nameInput();
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

    // -- Foto del producto --
    /*  Viaja como dataURL en el campo de texto image_b64 (ya achicada en el
        navegador); image_remove = 1 la quita. Si no se toca, los dos llegan vacíos
        y la foto se queda. Se guarda junto a las de Pedidos, relativa a la raíz del
        sitio como las de alpha: la tabla la pinta con «/» delante. */

    // ['b64' => dataURL o '', 'remove' => bool], o la respuesta de error.
    private function photoInput() {
        $b64 = isset($_POST['image_b64']) ? (string) $_POST['image_b64'] : '';

        if ($b64 !== '' && !$this->decodePhoto($b64)) {
            return $this->fail(400, 'La foto debe ser una imagen JPG, PNG o WEBP de hasta 5 MB.');
        }

        return ['b64' => $b64, 'remove' => $this->flag('image_remove') === 1];
    }

    // La extensión sale de lo que trae el archivo por dentro, no de lo que dice el dataURL.
    private function decodePhoto($b64) {
        if (!preg_match('#^data:image/[a-z0-9.+-]+;base64,#i', $b64)) return null;

        $data = base64_decode(substr($b64, strpos($b64, ',') + 1), true);

        if ($data === false || strlen($data) > self::PHOTO_MAX) return null;

        $info = @getimagesizefromstring($data);
        $ext  = $info ? ([IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'][$info[2]] ?? null) : null;

        return $ext ? ['ext' => $ext, 'data' => $data] : null;
    }

    // Foto nueva: su ruta. Quitar: null. Sin cambios: la que ya tenía.
    private function nextPhoto($id, $photo, $currentPath) {
        if ($photo['b64'] !== '') return $this->writePhoto($id, $photo['b64']);
        if ($photo['remove'])     return null;

        return $currentPath;
    }

    // El nombre cambia en cada foto para que el navegador no siga mostrando la anterior.
    private function writePhoto($id, $b64) {
        $image  = $this->decodePhoto($b64);
        $folder = 'pro_files/' . $this->companyId() . '/' . $this->branchId() . '/catalogo/productos/';
        $disk   = $this->diskPath($folder);

        if (!$image) throw new RuntimeException('writePhoto: foto inválida');

        if (!is_dir($disk) && !@mkdir($disk, 0775, true) && !is_dir($disk)) {
            throw new RuntimeException('writePhoto: no se pudo crear ' . $disk);
        }

        $name = (int) $id . '_' . bin2hex(random_bytes(6)) . '.' . $image['ext'];

        if (@file_put_contents($disk . $name, $image['data']) === false) {
            throw new RuntimeException('writePhoto: no se pudo escribir ' . $disk . $name);
        }

        return $folder . $name;
    }

    /*  Borra del disco la foto que dejó de usar. Solo las de pro: las de alpha no
        se tocan. Y solo si ningún otro producto la usa: la copia de «Hacer propio»
        comparte la de la Matriz. */
    private function dropPhoto($path, $id) {
        $path = trim((string) $path);

        if (strpos($path, 'pro_files/') !== 0 || strpos($path, '..') !== false) return;
        if ($this->qCountProductsWithImage($path, $id) > 0) return;

        $file = $this->diskPath($path);

        if (is_file($file)) @unlink($file);
    }

    private function diskPath($relative) {
        $root = isset($_SERVER['DOCUMENT_ROOT']) ? str_replace('\\', '/', $_SERVER['DOCUMENT_ROOT']) : '';

        return rtrim($root, '/') . '/' . $relative;
    }

    // -- Filas --

    private function productRow($item, $isMain) {
        $id = (int) $item['id'];

        return [
            'id'        => $id,
            'Producto'  => $this->productCell($item),
            'Origen'    => $this->originCell($item, $isMain),
            'Categoría' => $this->categoryCell($item),
            'Tipo'      => $item['kind'] === 'service' ? chip('Servicio', 'sky') : chip('Producto', 'slate'),
            'Precio'    => moneyCell($item['price']),
            'Costo'     => moneyCell($item['cost']),
            'Canales'   => $this->channelsCell($item),
            'Estado'    => renderActive($item['active']),
            'a'         => $this->productActions($item, $id)
        ];
    }

    // Foto + nombre + SKU, como la celda de producto de alpha.
    private function productCell($item) {
        return '<div class="flex items-center gap-3">'
            . $this->productPhoto($item['image'])
            . '<div class="min-w-0">' . cellTitle($item['name'], $item['sku']) . '</div>'
            . '</div>';
    }

    /*  Sin foto: el cuadro vacío con el pastel (el mismo de alpha). Las rutas son
        'alpha_files/<empresa>/...' con espacios y acentos: cada tramo va codificado.
        Si la copia local no la tiene, productPhotoError() (catalogo.js) la busca en
        producción y, si tampoco está, deja el cuadro vacío. */
    private function productPhoto($path) {
        $path  = trim((string) $path);
        $empty = '<div class="cp-foto cp-foto-vacia"><i class="icon-birthday"></i></div>';

        if ($path === '') return $empty;

        $src = preg_match('#^https?://#i', $path)
            ? $path
            : '/' . implode('/', array_map('rawurlencode', explode('/', ltrim($path, '/'))));

        return '<img src="' . h($src) . '" alt="" loading="lazy" class="cp-foto" onerror="productPhotoError(this)">';
    }

    /*  Matriz: «Compartido» y cuántas sucursales venden el suyo.
        Sucursal: «De la Matriz», o «Propio» y si reemplaza al de la Matriz. */
    private function originCell($item, $isMain) {
        if ($isMain) {
            if ((int) $item['active'] === 0) return '<span class="cp-celda-sub">No se comparte</span>';

            $others = (int) $item['own_elsewhere'];
            $note   = $others === 0 ? '' : ($others === 1 ? '1 sucursal vende el suyo' : "{$others} sucursales venden el suyo");

            return chip('Compartido', 'emerald') . $this->originNote($note);
        }

        if ((int) $item['from_main'] === 1) return chip('De la Matriz', 'violet');
        if ((int) $item['twin_main'] === 0) return chip('Propio', 'slate');

        $note = (int) $item['active'] === 1 ? 'Reemplaza al de la Matriz' : 'Se vende el de la Matriz';

        return chip('Propio', 'amber') . $this->originNote($note);
    }

    private function originNote($text) {
        return $text === '' ? '' : '<div class="cp-celda-sub">' . h($text) . '</div>';
    }

    /*  De la Matriz: solo «Hacer propio» (se edita en la Matriz).
        Propio activo que reemplaza al de la Matriz: el apagador pasa a «Volver a la
        Matriz» (lo desactiva, no lo borra). */
    private function productActions($item, $id) {
        if ((int) $item['from_main'] === 1) {
            return [[
                'class'      => $this->actionBtnClass('neutral', true),
                'html'       => '<i class="icon-docs"></i> Hacer propio',
                'aria-label' => 'Copiarlo a esta sucursal para cambiarlo',
                'onclick'    => "products.copy({$id})"
            ]];
        }

        $actions = $this->rowActions('products', $id, $item['active']);

        if ((int) $item['twin_main'] === 1 && (int) $item['active'] === 1) {
            $actions[1] = [
                'class'      => $this->actionBtnClass('neutral', true),
                'html'       => '<i class="icon-reply"></i>',
                'aria-label' => 'Volver al de la Matriz',
                'onclick'    => "products.backToMain({$id})"
            ];
        }

        return $actions;
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
