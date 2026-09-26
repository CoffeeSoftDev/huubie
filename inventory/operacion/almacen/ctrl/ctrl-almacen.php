<?php

if (empty($_POST['opc'])) exit(0);

session_start();
require_once '../mdl/mdl-almacen.php';
require_once '../../../conf/_IaLector.php';
require_once '../../../conf/_IaOllama.php';

class ctrl extends mdl {

    function init() {
        return [
            'categorias'  => $this->lsCategories(),
            'unidades'    => $this->lsUnits(),
            'areas'       => $this->lsAreas(),
            'proveedores' => $this->lsProveedores()
        ];
    }

    function lsMateriales() {

        $filters = [
            'categoria' => $_POST['categoria'] ?? '',
            'area'      => $_POST['area'] ?? '',
            'estado'    => $_POST['estado'] ?? ''
        ];

        $data = $this->listMateriales($filters);
        $rows = [];
        $totalValue = 0;

        foreach ($data as $item) {
            // El inventario se valúa al último costo de compra, no al precio de venta.
            $value = floatval($item['quantity']) * floatval($item['cost_unit']);
            $totalValue += $value;

            $a = [
                [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="pencil" class="w-4 h-4"></i>',
                    'onclick' => 'products.editMaterial(' . $item['id'] . ')'
                ],
                [
                    'class'   => $item['active'] == 1
                        ? 'inline-flex items-center justify-center w-9 h-9 p-2 text-emerald-500 hover:text-red-600 transition-colors cursor-pointer bg-transparent border-0'
                        : 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-emerald-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => $item['active'] == 1 ? '<i data-lucide="toggle-right" class="w-4 h-4"></i>' : '<i data-lucide="toggle-left" class="w-4 h-4"></i>',
                    'onclick' => 'products.statusMaterial(' . $item['id'] . ', ' . $item['active'] . ')'
                ]
            ];

            $rows[] = [
                'id'         => $item['id'],
                'Insumo'     => [
                    'class' => 'justify-center px-2 py-2',
                    'html'  => renderProductImage($item['image'] ?? '', $item['name'])
                ],
                'Categoría'  => $item['categoria'] ?? '-',
                'Área'       => $item['area'] ?? '-',
                'Stock'      => $item['quantity'],
                'Mín'        => $item['stock_min'] ?? '-',
                'Máx'        => $item['stock_max'] ?? '-',
                'Vida útil'  => isset($item['shelf_life_days']) && $item['shelf_life_days'] !== null
                    ? $item['shelf_life_days'] . ' días'
                    : '-',

                // Inventario = costo (como Soft Restaurant con sus insumos). El precio de
                // venta solo vive en el formulario, para lo que se revende tal cual.
                'Último costo' => [
                    'html'  => '$' . number_format((float) $item['cost_unit'], 2),
                    'class' => 'text-end'
                ],
                'Estado'     => renderStatus($item['active']),
                'a'          => $a
            ];
        }

        return [
            'row'         => $rows,
            'total_value' => '$' . number_format($totalValue, 2)
        ];
    }

    function getMaterial() {
        $id      = $_POST['id'];
        $status  = 404;
        $message = 'Insumo no encontrado';
        $data    = null;

        $material = $this->getMaterialById($id);

        if ($material) {
            $status  = 200;
            $message = 'Insumo encontrado';
            $data    = $material;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    function addMaterial() {
        $status  = 500;
        $message = 'No se pudo agregar el insumo';

        // Solo el nombre es obligatorio. El precio de venta es opcional (un insumo
        // que no se vende queda en 0) y el costo lo van dejando las entradas.
        if (trim($_POST['name'] ?? '') === '') {
            return [
                'status'  => 400,
                'message' => 'El nombre del producto es obligatorio'
            ];
        }

        $now          = date('Y-m-d H:i:s');
        $companies_id = $_SESSION['company_id'];
        $branch_id    = $_SESSION['branch_id'];

        [$price, $price_without_tax, $tax] = $this->salePrice();

        $item = [
            'name'            => $_POST['name'] ?? '',
            'image'           => $_POST['image'] ?? '',
            'category_id'     => $_POST['category_id'] ?? null,
            'branch_id'       => $branch_id,
            'companies_id'    => $companies_id,
            'created_at'      => $now,
            'active'          => 1
        ];

        // price, price_without_tax y tax se anexan DESPUÉS de util->sql() para evitar el gotcha
        // 0 == '' (PHP 7.4), que convertiría un 0 en NULL y violaría item.price NOT NULL.
        $sql = $this->util->sql($item);
        $sql['values'][] = 'price';
        $sql['values'][] = 'price_without_tax';
        $sql['values'][] = 'tax';
        $sql['data'][]   = $price;
        $sql['data'][]   = $price_without_tax;
        $sql['data'][]   = $tax;

        $create = $this->createMaterial($sql);

        if ($create) {
            $itemId = $this->getMaxItemId();

            // Campos numéricos NOT NULL con DEFAULT 0 (cost_unit, stock_min): se omiten cuando
            // van vacíos para que aplique el DEFAULT de la BD. Si se mandara 0, util->sql() lo
            // convertiría en NULL (gotcha 0 == '' en PHP 7.4) y violaría el NOT NULL.
            $attribute = [
                'sku'               => $this->skuFor($_POST['category_id'] ?? null),
                'description'       => $_POST['description'] ?? '',
                'shelf_life_days'   => ($_POST['shelf_life_days'] ?? '') === '' ? null : $_POST['shelf_life_days'],
                'stock_max'         => ($_POST['stock_max'] ?? '') === '' ? null : $_POST['stock_max'],
                'warehouse_area_id' => ($_POST['warehouse_area_id'] ?? '') === '' ? null : $_POST['warehouse_area_id'],
                'unit_id'           => $_POST['unit_id'] ?? null,
                'item_id'           => $itemId,
                'companies_id'      => $companies_id,
                'created_at'        => $now,
                'active'            => 1
            ];

            // Solo se incluyen si traen valor real; si no, la BD usa su DEFAULT 0.
            if (($_POST['cost_unit'] ?? '') !== '') $attribute['cost_unit'] = $_POST['cost_unit'];
            if (($_POST['stock_min'] ?? '') !== '') $attribute['stock_min'] = $_POST['stock_min'];

            $this->createItemAttribute($this->util->sql($attribute));

            $status  = 200;
            $message = 'Insumo agregado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Alta exprés desde el buscador de Solicitudes: el solicitante solo aporta el
    // nombre (obligatorio) y, opcionalmente, categoría y unidad. Los precios entran
    // en 0 porque los fija después quien surte/compra; el SKU se autogenera. Devuelve
    // id y sku para inyectar el producto directo en la solicitud sin recargar todo.
    function addProductoRapido() {
        if (($_POST['name'] ?? '') === '') {
            return ['status' => 400, 'message' => 'El nombre del producto es obligatorio'];
        }

        $now          = date('Y-m-d H:i:s');
        $companies_id = $_SESSION['company_id'];
        $branch_id    = $_SESSION['branch_id'];

        $item = [
            'name'         => $_POST['name'],
            'image'        => '',
            'category_id'  => ($_POST['category_id'] ?? '') === '' ? null : $_POST['category_id'],
            'branch_id'    => $branch_id,
            'companies_id' => $companies_id,
            'created_at'   => $now,
            'active'       => 1
        ];

        // price, price_without_tax y tax se anexan DESPUÉS de util->sql() y en 0 para
        // esquivar el gotcha 0 == '' (PHP 7.4), que los volvería NULL y violaría el NOT NULL.
        $sql = $this->util->sql($item);
        $sql['values'][] = 'price';
        $sql['values'][] = 'price_without_tax';
        $sql['values'][] = 'tax';
        $sql['data'][]   = 0;
        $sql['data'][]   = 0;
        $sql['data'][]   = 0;

        if (!$this->createMaterial($sql)) {
            return ['status' => 500, 'message' => 'No se pudo crear el producto'];
        }

        $itemId = $this->getMaxItemId();
        $sku    = $this->skuFor($item['category_id']);

        $attribute = [
            'sku'          => $sku,
            'unit_id'      => ($_POST['unit_id'] ?? '') === '' ? null : $_POST['unit_id'],
            'item_id'      => $itemId,
            'companies_id' => $companies_id,
            'created_at'   => $now,
            'active'       => 1
        ];
        $this->createItemAttribute($this->util->sql($attribute));

        return [
            'status'  => 200,
            'message' => 'Producto creado',
            'id'      => $itemId,
            'sku'     => $sku
        ];
    }

    function editMaterial() {
        $status  = 500;
        $message = 'Error al editar el insumo';

        $id = $_POST['id'];

        [$price, $price_without_tax, $tax] = $this->salePrice();

        $editItem = $this->updateMaterial([
            'values' => 'name = ?, image = ?, price = ?, price_without_tax = ?, tax = ?, category_id = ?',
            'where'  => 'id = ?',
            'data'   => [
                $_POST['name'] ?? '',
                $_POST['image'] ?? '',
                $price,
                $price_without_tax,
                $tax,
                $_POST['category_id'] ?? null,
                $id
            ]
        ]);

        $this->updateItemAttribute([
            'values' => 'description = ?, cost_unit = ?, stock_min = ?, stock_max = ?, shelf_life_days = ?, warehouse_area_id = ?, unit_id = ?',
            'where'  => 'item_id = ?',
            'data'   => [
                $_POST['description'] ?? '',
                ($_POST['cost_unit'] ?? '') === '' ? 0 : $_POST['cost_unit'],
                ($_POST['stock_min'] ?? '') === '' ? 0 : $_POST['stock_min'],
                ($_POST['stock_max'] ?? '') === '' ? 0 : $_POST['stock_max'],
                ($_POST['shelf_life_days'] ?? '') === '' ? null : $_POST['shelf_life_days'],
                ($_POST['warehouse_area_id'] ?? '') === '' ? null : $_POST['warehouse_area_id'],
                $_POST['unit_id'] ?? null,
                $id
            ]
        ]);

        // Un producto que llegó sin SKU (p. ej. por una carga masiva) lo recibe al
        // editarse. Si ya tiene uno, updateItemAttributeSku no lo toca.
        $this->updateItemAttributeSku([$this->skuFor($_POST['category_id'] ?? null), $id]);

        if ($editItem) {
            $status  = 200;
            $message = 'Insumo editado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Precio de venta: el pivote es el precio CON IVA (lo que paga el cliente) y el
    // precio sin IVA se deriva aquí, para que las dos columnas siempre cuadren
    // aunque el formulario redondee. Devuelve [price, price_without_tax, tax].
    private function salePrice() {
        $price = ($_POST['price'] ?? '') === '' ? 0 : floatval($_POST['price']);
        $tax   = ($_POST['tax'] ?? '') === '' ? 0 : floatval($_POST['tax']);
        $base  = $tax > 0 ? round($price / (1 + $tax / 100), 2) : $price;

        return [$price, $base, $tax];
    }

    /*  SKU con el formato de claves de Soft Restaurant: clave del grupo (2 dígitos)
        + consecutivo dentro del grupo (3 dígitos). Aquí el grupo es la categoría:
        el tercer producto de la categoría 4 es 04003. Sin categoría va al grupo 00.

        El consecutivo sale del SKU más alto con ese prefijo, no de contar los
        productos de la categoría: el que se cambia de categoría conserva su SKU
        (igual que en Soft Restaurant) y contar volvería a repartir su número.
        str_pad rellena pero no recorta: la categoría 123 da 123001. */
    private function skuFor($categoryId) {
        $prefix = str_pad((int) $categoryId, 2, '0', STR_PAD_LEFT);
        $last   = $this->getSkuCounts([
            strlen($prefix) + 1,
            $_SESSION['company_id'],
            '^' . $prefix . '[0-9]{3,}$'
        ]);

        return $prefix . str_pad($last + 1, 3, '0', STR_PAD_LEFT);
    }

    function deleteMaterial() {
        $status      = 500;
        $nuevoEstado = $_POST['active'];
        $message     = $nuevoEstado == 1 ? 'No se pudo activar el insumo' : 'No se pudo desactivar el insumo';

        $update = $this->updateMaterial([
            'values' => 'active = ?',
            'where'  => 'id = ?',
            'data'   => [$_POST['active'], $_POST['id']]
        ]);

        if ($update) {
            $status  = 200;
            $message = $nuevoEstado == 1 ? 'Insumo activado correctamente' : 'Insumo desactivado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function statusMaterial() {
        $status  = 500;
        $message = 'No se pudo actualizar el estado';

        $update = $this->updateMaterial([
            'values' => 'active = ?',
            'where'  => 'id = ?',
            'data'   => [$_POST['active'], $_POST['id']]
        ]);

        if ($update) {
            $status  = 200;
            $message = 'Estado actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // -- Asistente IA --
    /*  Chat flotante del catálogo del almacén: altas, cambios, bajas y
        reactivaciones de productos, categorías, unidades, áreas, almacenes y
        proveedores, a partir de un mensaje, un Excel o una foto.

        El modelo solo PROPONE. Aquí se valida cada cambio contra los datos reales
        y la propuesta se guarda en la sesión; lo que se aplica sale de la sesión,
        nunca de lo que mande el navegador.

        El comportamiento (tono y reglas del negocio) vive en ia/asistente-catalogo.md
        y se edita sin tocar PHP. Lo que no se puede romper desde ese archivo --qué
        entidades y campos existen, el formato JSON y los datos vivos-- lo arma promptIA(). */

    const IA_MAX_CAMBIOS  = 150;
    const IA_MAX_CATALOGO = 1500;

    // Entidades que toca el asistente y los campos que el modelo puede mandar en
    // "set" (clave => etiqueta de la vista previa). El orden importa: los
    // catálogos se validan y se aplican antes que los productos que los usan.
    const IA_ENTIDADES = [
        'category'  => ['tag' => 'Categoría', 'uno' => 'categoría', 'varios' => 'categorías',  'campos' => ['name' => 'Nombre']],
        'unit'      => ['tag' => 'Unidad',    'uno' => 'unidad',    'varios' => 'unidades',    'campos' => ['code' => 'Código', 'name' => 'Nombre']],
        'area'      => ['tag' => 'Área',      'uno' => 'área',      'varios' => 'áreas',       'campos' => ['name' => 'Nombre', 'description' => 'Descripción']],
        'warehouse' => ['tag' => 'Almacén',   'uno' => 'almacén',   'varios' => 'almacenes',   'campos' => ['name' => 'Nombre', 'branch' => 'Sucursal', 'is_default' => 'Por defecto']],
        'supplier'  => ['tag' => 'Proveedor', 'uno' => 'proveedor', 'varios' => 'proveedores', 'campos' => ['name' => 'Nombre', 'contact_name' => 'Contacto', 'phone' => 'Teléfono', 'email' => 'Email']],
        'product'   => ['tag' => 'Producto',  'uno' => 'producto',  'varios' => 'productos',   'campos' => [
            'name'            => 'Nombre',
            'category'        => 'Categoría',
            'unit'            => 'Unidad',
            'area'            => 'Área',
            'price'           => 'Precio',
            'base'            => 'Precio sin IVA',
            'tax'             => 'IVA',
            'cost'            => 'Último costo',
            'stock_min'       => 'Mínimo',
            'stock_max'       => 'Máximo',
            'shelf_life_days' => 'Vida útil',
            'description'     => 'Descripción'
        ]]
    ];

    // Tope de caracteres por columna de texto de cada catálogo (el de la BD).
    const IA_LARGOS = [
        'category'  => ['name' => 120],
        'unit'      => ['code' => 20, 'name' => 80],
        'area'      => ['name' => 120, 'description' => 255],
        'warehouse' => ['name' => 120],
        'supplier'  => ['name' => 160, 'contact_name' => 120, 'phone' => 20, 'email' => 120]
    ];

    // Lee lo que se adjunta al chat y lo devuelve como texto. No guarda nada en
    // disco: el archivo vive lo que dura la petición.
    function readArchivo() {
        if (empty($_SESSION['company_id'])) return ['status' => 401, 'message' => 'Tu sesión expiró. Vuelve a entrar.'];

        $f = $_FILES['archivo'] ?? null;

        if (!is_array($f)) return ['status' => 400, 'message' => 'No llegó ningún archivo.'];

        if (in_array((int) $f['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            return ['status' => 413, 'message' => 'El archivo pasa del tope del servidor (' . ini_get('upload_max_filesize') . ').'];
        }

        if ((int) $f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
            return ['status' => 400, 'message' => 'El archivo no llegó completo. Vuelve a subirlo.'];
        }

        if ((int) $f['size'] > 8 * 1048576) return ['status' => 413, 'message' => 'El archivo pesa más de 8 MB.'];

        $nombre = mb_substr((string) $f['name'], 0, 120);
        $ext    = strtolower((string) pathinfo($nombre, PATHINFO_EXTENSION));
        $clase  = IaLector::clase($ext);

        if ($clase === null) {
            return ['status' => 415, 'message' => 'Solo leo Excel (.xlsx o .xls), CSV o imágenes (PNG, JPG o WEBP).'];
        }

        if (!IaLector::firmaOk($f['tmp_name'], $ext)) {
            return ['status' => 415, 'message' => 'Ese archivo dice ser .' . $ext . ' pero por dentro es otra cosa. Vuelve a guardarlo desde el programa que lo hizo.'];
        }

        if ($clase === 'imagen') {
            $ia = IaOllama::desdeCredenciales();

            if ($ia === null) return ['status' => 503, 'message' => 'El asistente no está configurado: falta la llave de Ollama.'];

            session_write_close();
            set_time_limit(180);

            $leido = $ia->transcribirImagen($f['tmp_name']);
        } else {
            $leido = IaLector::leer($f['tmp_name'], $ext);
        }

        if ($leido['texto'] === '') {
            return ['status' => 422, 'message' => $leido['aviso'] !== '' ? $leido['aviso'] : 'No encontré nada que leer en ese archivo.'];
        }

        $renglones = IaLector::renglones($leido['texto']);
        $partes    = (int) ($leido['partes'] ?? 0);
        $origen    = $clase === 'imagen' ? 'Imagen leída' : ($partes > 1 ? $partes . ' hojas' : 'Archivo leído');

        return [
            'status' => 200,
            'data'   => [
                'nombre'  => $nombre,
                'clase'   => $clase,
                'detalle' => $origen . ' · ' . $renglones . ($renglones === 1 ? ' renglón' : ' renglones'),
                'texto'   => $leido['texto']
            ]
        ];
    }

    function askAsistente() {
        if (empty($_SESSION['company_id'])) return ['status' => 401, 'message' => 'Tu sesión expiró. Vuelve a entrar.'];

        $mensaje   = mb_substr(trim((string) ($_POST['mensaje'] ?? '')), 0, 4000);
        $adjuntos  = json_decode((string) ($_POST['adjuntos'] ?? '[]'), true);
        $historial = json_decode((string) ($_POST['historial'] ?? '[]'), true);
        $adjuntos  = is_array($adjuntos) ? $adjuntos : [];
        $historial = is_array($historial) ? $historial : [];

        if ($mensaje === '' && empty($adjuntos)) {
            return ['status' => 400, 'message' => 'Escríbeme qué quieres hacer o adjunta un archivo.'];
        }

        $ia = IaOllama::desdeCredenciales();

        if ($ia === null) return ['status' => 503, 'message' => 'El asistente no está configurado: falta la llave de Ollama.'];

        $ctx = $this->contextoIA();

        // Sin esto la sesión queda bloqueada mientras el modelo piensa y las tablas
        // del almacén no pueden recargar en ese rato. Se reabre para guardar la propuesta.
        session_write_close();
        set_time_limit(180);

        $respuesta = $ia->chatJson($this->mensajesIA($mensaje, $adjuntos, $historial, $ctx));

        if (!$respuesta['ok']) return ['status' => 502, 'message' => $respuesta['error']];

        $cambios = isset($respuesta['data']['changes']) && is_array($respuesta['data']['changes']) ? $respuesta['data']['changes'] : [];
        $reply   = $this->textoIA($respuesta['data']['reply'] ?? '');
        $vista   = $this->validarCambiosIA($cambios, $ctx);
        $token   = '';

        if (!empty($vista['validos'])) {
            $token = bin2hex(random_bytes(8));

            session_start();
            $_SESSION['iaProductos'] = ['token' => $token, 'cambios' => $vista['validos']];
        }

        if ($reply === '') $reply = empty($vista['row']) ? 'No encontré cambios que proponer.' : 'Revisa la vista previa y confirma.';

        return [
            'status'  => 200,
            'reply'   => $reply,
            'token'   => $token,
            'row'     => $vista['row'],
            'resumen' => $vista['resumen']
        ];
    }

    // Todo o nada: si un cambio falla, la transacción deshace los demás.
    function applyAsistente() {
        if (empty($_SESSION['company_id'])) return ['status' => 401, 'message' => 'Tu sesión expiró. Vuelve a entrar.'];

        $pendiente = $_SESSION['iaProductos'] ?? null;
        $token     = (string) ($_POST['token'] ?? '');

        if (!is_array($pendiente) || $token === '' || !hash_equals((string) $pendiente['token'], $token)) {
            return ['status' => 409, 'message' => 'Esa vista previa ya no está vigente. Pídeme los cambios otra vez.'];
        }

        $ids         = json_decode((string) ($_POST['ids'] ?? '[]'), true);
        $selecciones = [];

        foreach ((array) $ids as $i) {
            if (is_numeric($i) && isset($pendiente['cambios'][(int) $i])) $selecciones[(int) $i] = $pendiente['cambios'][(int) $i];
        }

        if (empty($selecciones)) return ['status' => 400, 'message' => 'No marcaste ningún cambio.'];

        // El índice ya viene en orden de aplicación: catálogos primero, productos después.
        ksort($selecciones);

        $companies_id = $_SESSION['company_id'];
        $branch_id    = $_SESSION['branch_id'] ?? null;
        $now          = date('Y-m-d H:i:s');

        try {
            $hechos = $this->transaction(function () use ($selecciones, $companies_id, $branch_id, $now) {
                $n       = [];
                $creados = [];

                foreach ($selecciones as $c) {
                    $this->aplicarCambioIA($c, $companies_id, $branch_id, $now, $creados);

                    $n[$c['entity']][$c['action']] = ($n[$c['entity']][$c['action']] ?? 0) + 1;
                }

                return $n;
            });
        } catch (Throwable $e) {
            error_log('[applyAsistente] ' . $e->getMessage());

            $motivo = $e instanceof PDOException ? 'la base de datos rechazó un cambio.' : $e->getMessage();

            return ['status' => 500, 'message' => 'No se aplicó ningún cambio: ' . $motivo];
        }

        unset($_SESSION['iaProductos']);

        return [
            'status'  => 200,
            'message' => $this->resumenIA($hechos),
            'data'    => ['entidades' => array_keys($hechos)]
        ];
    }

    // -- Asistente IA · contexto y prompt --

    private function contextoIA() {
        $ctx = [
            'product' => $this->listMateriales([]),
            'branch'  => $this->lsBranches()
        ];

        foreach (['category', 'unit', 'area', 'warehouse', 'supplier'] as $entidad) {
            $ctx[$entidad] = $this->listCatalog($entidad);
        }

        foreach ($ctx as $k => $filas) {
            if (!is_array($filas)) $ctx[$k] = [];
        }

        return $ctx;
    }

    private function mensajesIA($mensaje, $adjuntos, $historial, $ctx) {
        $mensajes = [['role' => 'system', 'content' => $this->promptIA($ctx)]];

        foreach (array_slice($historial, -8) as $h) {
            $rol   = is_array($h) ? ($h['role'] ?? '') : '';
            $texto = is_array($h) ? $this->textoIA($h['content'] ?? '') : '';

            if (($rol === 'user' || $rol === 'assistant') && $texto !== '') {
                $mensajes[] = ['role' => $rol, 'content' => mb_substr($texto, 0, 3000)];
            }
        }

        $pregunta = 'MENSAJE: ' . ($mensaje !== '' ? $mensaje : '(sin texto: solo adjuntó archivos)');
        $cupo     = 60000;

        foreach (array_slice($adjuntos, 0, 3) as $a) {
            $texto = is_array($a) ? mb_substr($this->textoIA($a['texto'] ?? ''), 0, min(30000, $cupo)) : '';

            if ($texto === '') continue;

            $cupo     -= mb_strlen($texto);
            $pregunta .= "\n\nARCHIVO «" . mb_substr($this->textoIA($a['nombre'] ?? 'archivo'), 0, 120) . "»:\n" . $texto;

            if ($cupo <= 0) break;
        }

        $mensajes[] = ['role' => 'user', 'content' => $pregunta];

        return $mensajes;
    }

    // Tres partes: el contexto editable (ia/asistente-catalogo.md), el contrato
    // (entidades, campos y formato JSON, que valida validarCambiosIA) y los datos vivos.
    private function promptIA($ctx) {
        $ruta     = __DIR__ . '/../ia/asistente-catalogo.md';
        $reglas   = is_readable($ruta) ? trim(preg_replace('/<!--.*?-->/s', '', (string) file_get_contents($ruta))) : '';
        $sucursal = array_column($ctx['branch'], 'valor', 'id');
        $estado   = function ($r) { return (int) $r['active'] === 1 ? 'activo' : 'baja'; };
        $filas    = [];

        foreach ($ctx['category'] as $r)  $filas['category'][]  = [$r['id'], $r['name'], $estado($r)];
        foreach ($ctx['unit'] as $r)      $filas['unit'][]      = [$r['id'], $r['code'], $r['name'], $estado($r)];
        foreach ($ctx['area'] as $r)      $filas['area'][]      = [$r['id'], $r['name'], $r['description'], $estado($r)];
        foreach ($ctx['branch'] as $r)    $filas['branch'][]    = [$r['id'], $r['valor']];
        foreach ($ctx['supplier'] as $r)  $filas['supplier'][]  = [$r['id'], $r['name'], $r['contact_name'], $r['phone'], $r['email'], $estado($r)];

        foreach ($ctx['warehouse'] as $r) {
            $filas['warehouse'][] = [$r['id'], $r['name'], $sucursal[$r['branch_id']] ?? '-', (int) $r['is_default'] === 1 ? 'sí' : 'no', $estado($r)];
        }

        foreach (array_slice($ctx['product'], 0, self::IA_MAX_CATALOGO) as $p) {
            $filas['product'][] = [
                $p['id'],
                $p['sku'],
                $p['name'],
                $p['categoria'],
                $p['unidad'],
                $p['area'],
                number_format((float) $p['price'], 2, '.', ''),
                (float) $p['tax'],
                number_format((float) $p['cost_unit'], 2, '.', ''),
                $this->numeroIA($p['stock_min']),
                $this->numeroIA($p['stock_max']),
                $this->numeroIA($p['shelf_life_days']),
                $estado($p)
            ];
        }

        $recorte = count($ctx['product']) > self::IA_MAX_CATALOGO ? ' (recortado a los ' . self::IA_MAX_CATALOGO . ' más recientes)' : '';

        return implode("\n", [
            $reglas !== '' ? $reglas : 'Eres el asistente del catálogo del almacén. Hablas español, en frases cortas.',
            '',
            '== CONTRATO (lo que el sistema acepta) ==',
            'Entidades ("entity") y los campos que puedes mandar en "set":',
            '- product: name, category, unit, area, price (venta con IVA), base (venta sin IVA), tax (0, 8 o 16), cost (último costo sin IVA), stock_min, stock_max, shelf_life_days (días), description',
            '- category: name',
            '- unit: code, name',
            '- area: name, description',
            '- warehouse: name, branch (nombre de una SUCURSAL), is_default (true o false)',
            '- supplier: name, contact_name, phone, email',
            'Acciones ("action"): "add" (alta), "edit" (cambio), "deactivate" (baja), "activate" (reactivar).',
            '- En edit, deactivate y activate el "id" es OBLIGATORIO y sale de la lista de esa entidad. En "ref" pon cómo lo nombró la persona.',
            '- En edit manda en "set" SOLO los campos que cambian.',
            '- En un producto, "category", "unit" y "area" van con el NOMBRE tal como está en su lista. Si la das de alta en esta misma respuesta, usa el mismo nombre.',
            '- Números sin signo de pesos ni separador de miles: 1250.5',
            '- Como mucho ' . self::IA_MAX_CAMBIOS . ' cambios por respuesta; si hay más, propone los primeros y avísalo en "reply".',
            '',
            'Responde SOLO con un objeto JSON, sin texto antes ni después. Ejemplo de la forma:',
            '{"reply": "Te propongo 4 cambios. Revísalos y confirma.", "changes": [',
            '  {"entity": "category", "action": "add", "set": {"name": "Bebidas"}},',
            '  {"entity": "product", "action": "add", "set": {"name": "Agua natural 1 L", "category": "Bebidas", "unit": "Pieza", "price": 18, "tax": 16}},',
            '  {"entity": "product", "action": "edit", "id": 45, "ref": "refresco de cola", "set": {"price": 24.5, "stock_min": 6}},',
            '  {"entity": "supplier", "action": "deactivate", "id": 9, "ref": "Distribuidora Norte"}',
            ']}',
            'Si no hay cambios, "changes" va vacío y en "reply" explicas o preguntas lo que falte.',
            '',
            '== DATOS DE LA EMPRESA ==',
            $this->tablaIA('CATEGORÍAS', ['id', 'nombre', 'estado'], $filas['category'] ?? []),
            '',
            $this->tablaIA('UNIDADES', ['id', 'código', 'nombre', 'estado'], $filas['unit'] ?? []),
            '',
            $this->tablaIA('ÁREAS', ['id', 'nombre', 'descripción', 'estado'], $filas['area'] ?? []),
            '',
            $this->tablaIA('SUCURSALES', ['id', 'nombre'], $filas['branch'] ?? []),
            '',
            $this->tablaIA('ALMACENES', ['id', 'nombre', 'sucursal', 'por defecto', 'estado'], $filas['warehouse'] ?? []),
            '',
            $this->tablaIA('PROVEEDORES', ['id', 'nombre', 'contacto', 'teléfono', 'email', 'estado'], $filas['supplier'] ?? []),
            '',
            $this->tablaIA('PRODUCTOS' . $recorte, ['id', 'sku', 'nombre', 'categoría', 'unidad', 'área', 'precio con IVA', 'IVA %', 'último costo', 'mín', 'máx', 'vida útil días', 'estado'], $filas['product'] ?? [])
        ]);
    }

    private function tablaIA($titulo, $columnas, $filas) {
        $lineas = array_map(function ($f) {
            return implode(' | ', array_map(function ($v) {
                $v = trim(str_replace(["\r", "\n", '|'], [' ', ' ', '/'], (string) $v));
                return $v === '' ? '-' : $v;
            }, $f));
        }, $filas);

        return $titulo . ' (' . implode(' | ', $columnas) . "):\n" . (empty($lineas) ? '(vacío)' : implode("\n", $lineas));
    }

    // -- Asistente IA · validación --

    /*  Convierte lo que propuso el modelo en filas de vista previa. Las que no se
        pueden aplicar (no existe, no cambia nada, ya está dado de baja) se enseñan
        con su motivo pero no entran en 'validos'. El nombre que se enseña es el del
        catálogo, no el que escribió el modelo: así se ve qué registro se toca de verdad.

        Dos vueltas: primero los catálogos y después los productos, para que un
        producto pueda usar la categoría (o unidad, o área) que se da de alta en la
        misma respuesta. Ese orden es también el de aplicación. */
    private function validarCambiosIA($cambios, $ctx) {
        $idx     = $this->indicesIA($ctx);
        $nuevos  = [];
        $vistos  = [];
        $row     = [];
        $validos = [];
        $resumen = ['add' => 0, 'edit' => 0, 'deactivate' => 0, 'activate' => 0, 'invalid' => 0];
        $lista   = [];

        foreach (array_slice($cambios, 0, self::IA_MAX_CAMBIOS) as $c) {
            $n = $this->normalizarCambioIA($c);

            if ($n === null) continue;

            // Dos "edit" del mismo registro (precio en uno, categoría en otro) se juntan.
            $clave = $n['action'] === 'edit' && $n['id'] > 0 ? 'edit|' . $n['entity'] . '|' . $n['id'] : count($lista);

            if (isset($lista[$clave])) {
                $lista[$clave]['set'] = array_merge($lista[$clave]['set'], $n['set']);
                continue;
            }

            $lista[$clave] = $n;
        }

        foreach ([false, true] as $productos) {
            foreach ($lista as $c) {
                if (($c['entity'] === 'product') !== $productos) continue;

                $fila = $productos
                      ? $this->validarProductoIA($c, $idx, $nuevos, $vistos)
                      : $this->validarCatalogoIA($c, $ctx, $idx, $nuevos, $vistos);

                if ($fila === null) continue;

                $i = count($row);

                $fila['row']['idx']    = $i;
                $fila['row']['action'] = $c['action'];
                $fila['row']['tag']    = self::IA_ENTIDADES[$c['entity']]['tag'];
                $fila['row']['valid']  = $fila['cambio'] !== null;

                if ($fila['cambio'] !== null) {
                    $validos[$i] = $fila['cambio'] + ['entity' => $c['entity'], 'action' => $c['action'], 'nombre' => $fila['row']['name']];
                    $resumen[$c['action']]++;
                } else {
                    $resumen['invalid']++;
                }

                $row[] = $fila['row'];
            }
        }

        return [
            'row'     => $row,
            'validos' => $validos,
            'resumen' => $resumen
        ];
    }

    // Acepta sinónimos en español y el formato viejo (campos sueltos, "item_id",
    // action "price") para que un modelo que se sale un poco del contrato no se pierda.
    private function normalizarCambioIA($c) {
        if (!is_array($c)) return null;

        $entidades = ['producto' => 'product', 'productos' => 'product', 'item' => 'product', 'insumo' => 'product',
                      'categoria' => 'category', 'unidad' => 'unit', 'almacen' => 'warehouse', 'proveedor' => 'supplier'];
        $acciones  = ['alta' => 'add', 'agregar' => 'add', 'nuevo' => 'add', 'crear' => 'add', 'create' => 'add',
                      'editar' => 'edit', 'cambiar' => 'edit', 'modificar' => 'edit', 'update' => 'edit', 'price' => 'edit', 'precio' => 'edit',
                      'baja' => 'deactivate', 'desactivar' => 'deactivate', 'eliminar' => 'deactivate', 'borrar' => 'deactivate', 'delete' => 'deactivate',
                      'reactivar' => 'activate', 'activar' => 'activate'];

        $entidad = $this->normalizarIA($this->textoIA($c['entity'] ?? ''));
        $entidad = $entidades[$entidad] ?? ($entidad === '' ? 'product' : $entidad);
        $accion  = $this->normalizarIA($this->textoIA($c['action'] ?? ''));
        $accion  = $acciones[$accion] ?? $accion;

        if (!isset(self::IA_ENTIDADES[$entidad]) || !in_array($accion, ['add', 'edit', 'deactivate', 'activate'], true)) return null;

        $set = isset($c['set']) && is_array($c['set']) ? $c['set'] : [];

        foreach (array_keys(self::IA_ENTIDADES[$entidad]['campos']) as $campo) {
            if (!array_key_exists($campo, $set) && array_key_exists($campo, $c) && $campo !== 'name') $set[$campo] = $c[$campo];
        }

        // En el formato viejo el nombre suelto de un alta es el nombre nuevo; en lo
        // demás es solo la referencia de a quién se toca.
        if ($accion === 'add' && !array_key_exists('name', $set) && isset($c['name'])) $set['name'] = $c['name'];

        $id = 0;

        if (isset($c['id']) && is_numeric($c['id']))           $id = (int) $c['id'];
        elseif (isset($c['item_id']) && is_numeric($c['item_id'])) $id = (int) $c['item_id'];

        return [
            'entity' => $entidad,
            'action' => $accion,
            'id'     => $id,
            'ref'    => $this->textoIA($c['ref'] ?? ($c['name'] ?? '')),
            'sku'    => $this->textoIA($c['sku'] ?? ''),
            'set'    => $set
        ];
    }

    // Por entidad: filas por id, id por nombre normalizado y, en unidades y
    // productos, id por código o SKU. Con dos nombres iguales gana el activo.
    private function indicesIA($ctx) {
        $idx = [];

        foreach (array_keys(self::IA_ENTIDADES) as $entidad) {
            $idx[$entidad] = ['id' => [], 'nombre' => [], 'codigo' => []];

            foreach ($ctx[$entidad] as $r) {
                $id    = (int) $r['id'];
                $clave = $this->normalizarIA($r['name']);

                $idx[$entidad]['id'][$id] = $r;

                $previo = $idx[$entidad]['nombre'][$clave] ?? null;

                if ($previo === null || ((int) $r['active'] === 1 && (int) $idx[$entidad]['id'][$previo]['active'] !== 1)) {
                    $idx[$entidad]['nombre'][$clave] = $id;
                }

                $codigo = $entidad === 'unit' ? $r['code'] : ($entidad === 'product' ? $r['sku'] : '');
                $codigo = $this->normalizarIA($codigo);

                if ($codigo !== '' && !isset($idx[$entidad]['codigo'][$codigo])) $idx[$entidad]['codigo'][$codigo] = $id;
            }
        }

        return $idx;
    }

    private function buscarIA($entidad, $c, $idx) {
        $i = $idx[$entidad];

        if ($c['id'] > 0 && isset($i['id'][$c['id']])) return $i['id'][$c['id']];

        foreach ([$c['sku'], $c['ref']] as $texto) {
            $clave = $this->normalizarIA($texto);

            if ($clave === '') continue;
            if (isset($i['nombre'][$clave])) return $i['id'][$i['nombre'][$clave]];
            if (isset($i['codigo'][$clave])) return $i['id'][$i['codigo'][$clave]];
        }

        return null;
    }

    private function validarCatalogoIA($c, $ctx, $idx, &$nuevos, &$vistos) {
        $entidad = $c['entity'];
        $def     = self::IA_ENTIDADES[$entidad];

        if ($c['action'] === 'add') {
            $campos = $this->camposCatalogoIA($entidad, $c['set'], null, $ctx);
            $nombre = $campos['values']['name'] ?? '';
            $clave  = $this->normalizarIA($nombre);

            if ($nombre === '') return $this->filaIA(['name' => $c['ref'] ?: ucfirst($def['uno']) . ' sin nombre', 'note' => 'Falta el nombre.']);

            if (isset($vistos['add' . $entidad . $clave])) return null;

            $vistos['add' . $entidad . $clave] = true;

            if (isset($idx[$entidad]['nombre'][$clave])) {
                $existe = $idx[$entidad]['id'][$idx[$entidad]['nombre'][$clave]];

                return $this->filaIA(['name' => $nombre, 'note' => (int) $existe['active'] === 1 ? 'Ya existe.' : 'Existe dado de baja: pídeme reactivarlo.']);
            }

            if ($entidad === 'unit' && !isset($campos['values']['code'])) {
                $campos['values']['code'] = mb_strtoupper(mb_substr($nombre, 0, 20));
                $campos['changes'][]      = ['label' => 'Código', 'before' => '', 'after' => $campos['values']['code']];
                $campos['warn'][]         = 'Código tomado del nombre.';
            }

            if ($entidad === 'warehouse' && !isset($campos['values']['branch_id'])) {
                $campos['values']['branch_id'] = (int) ($_SESSION['branch_id'] ?? 0);
                $campos['changes'][]           = ['label' => 'Sucursal', 'before' => '', 'after' => $this->nombreSucursalIA($campos['values']['branch_id'], $ctx) . ' (la tuya)'];
            }

            $nuevos[$entidad][$clave] = $nombre;

            return $this->filaIA([
                'name'    => $nombre,
                'changes' => $this->sinNombreIA($campos['changes']),
                'warn'    => implode(' ', $campos['warn'])
            ], ['values' => $campos['values']]);
        }

        $actual = $this->buscarIA($entidad, $c, $idx);

        if ($actual === null) return $this->filaIA(['name' => $c['ref'] ?: ucfirst($def['uno']) . ' sin identificar', 'note' => 'No lo encontré.']);

        $id    = (int) $actual['id'];
        $aviso = $this->avisoIdentidadIA($c['ref'], $actual['name']);

        if ($c['action'] === 'edit') {
            if (isset($vistos['edit' . $entidad . $id])) return null;

            $vistos['edit' . $entidad . $id] = true;

            $campos = $this->camposCatalogoIA($entidad, $c['set'], $actual, $ctx);
            $fila   = ['name' => $actual['name'], 'changes' => $campos['changes'], 'warn' => trim($aviso . ' ' . implode(' ', $campos['warn']))];

            if (isset($campos['values']['name'])) {
                $otro = $idx[$entidad]['nombre'][$this->normalizarIA($campos['values']['name'])] ?? null;

                if ($otro !== null && $otro !== $id) return $this->filaIA($fila + ['note' => 'Ya existe otro registro con ese nombre.']);
            }

            if (empty($campos['values'])) return $this->filaIA($fila + ['note' => 'No cambia nada.']);

            return $this->filaIA($fila, ['id' => $id, 'values' => $campos['values']]);
        }

        return $this->validarEstadoIA($entidad, $c['action'], $actual, $aviso, $idx, $vistos);
    }

    // Baja o reactivación, igual para productos y catálogos.
    private function validarEstadoIA($entidad, $accion, $actual, $aviso, $idx, &$vistos) {
        $id      = (int) $actual['id'];
        $destino = $accion === 'activate' ? 1 : 0;

        if (isset($vistos['estado' . $entidad . $id])) return null;

        $vistos['estado' . $entidad . $id] = true;

        $fila = [
            'name'   => $actual['name'],
            'sku'    => $entidad === 'product' ? ($actual['sku'] ?? '') : '',
            'before' => (int) $actual['active'] === 1 ? 'Activo' : 'Baja',
            'after'  => $destino === 1 ? 'Activo' : 'Baja'
        ];

        if ((int) $actual['active'] === $destino) {
            return $this->filaIA(['name' => $fila['name'], 'sku' => $fila['sku'], 'note' => $destino === 1 ? 'Ya está activo.' : 'Ya está dado de baja.']);
        }

        $avisos = [$aviso];

        if ($destino === 0) $avisos[] = $this->avisoBajaIA($entidad, $actual, $idx);

        return $this->filaIA($fila + ['warn' => trim(implode(' ', array_filter($avisos)))], ['id' => $id]);
    }

    // Lo que se queda colgando al dar de baja: existencias o productos que la usan.
    private function avisoBajaIA($entidad, $actual, $idx) {
        if ($entidad === 'product') {
            $stock = (float) $actual['quantity'];

            return $stock > 0 ? 'Aún tiene ' . $this->numeroIA($stock) . ' en existencia.' : '';
        }

        if ($entidad === 'warehouse') return (int) $actual['is_default'] === 1 ? 'Es el almacén por defecto de su sucursal.' : '';

        $columna = ['category' => 'categoria', 'unit' => 'unidad', 'area' => 'area'][$entidad] ?? null;

        if ($columna === null) return '';

        $buscado = $this->normalizarIA($entidad === 'unit' ? $actual['code'] : $actual['name']);
        $usos    = 0;

        foreach ($idx['product']['id'] as $p) {
            if ((int) $p['active'] === 1 && $this->normalizarIA($p[$columna]) === $buscado) $usos++;
        }

        return $usos > 0 ? $usos . ($usos === 1 ? ' producto activo la usa.' : ' productos activos la usan.') : '';
    }

    // Campos de un catálogo: solo los que cambian. Devuelve values (columna => valor),
    // changes (para la vista previa) y warn (lo que se ignoró y por qué).
    private function camposCatalogoIA($entidad, $set, $actual, $ctx) {
        $etiquetas = self::IA_ENTIDADES[$entidad]['campos'];
        $out       = ['values' => [], 'changes' => [], 'warn' => []];

        foreach ($set as $campo => $valor) {
            if (!isset($etiquetas[$campo])) continue;

            $etiqueta = $etiquetas[$campo];

            if ($campo === 'branch') {
                $sucursal = $this->buscarSucursalIA($valor, $ctx);

                if ($sucursal === null) {
                    $out['warn'][] = 'La sucursal «' . $this->textoIA($valor) . '» no existe: no se cambia.';
                    continue;
                }

                if ($actual !== null && (int) $actual['branch_id'] === (int) $sucursal['id']) continue;

                $out['values']['branch_id'] = (int) $sucursal['id'];
                $out['changes'][]           = ['label' => $etiqueta, 'before' => $actual ? $this->nombreSucursalIA($actual['branch_id'], $ctx) : '', 'after' => $sucursal['valor']];
                continue;
            }

            if ($campo === 'is_default') {
                $si = $this->siNoIA($valor);

                if ($si === null || ($actual !== null && (int) $actual['is_default'] === $si)) continue;

                $out['values']['is_default'] = $si;
                $out['changes'][]            = ['label' => $etiqueta, 'before' => $actual ? ((int) $actual['is_default'] === 1 ? 'Sí' : 'No') : '', 'after' => $si === 1 ? 'Sí' : 'No'];
                continue;
            }

            $texto = mb_substr(preg_replace('/\s+/u', ' ', $this->textoIA($valor)), 0, self::IA_LARGOS[$entidad][$campo]);
            $antes = $actual !== null ? trim((string) ($actual[$campo] ?? '')) : '';

            if ($campo === 'code') $texto = mb_strtoupper($texto);

            // Nombre y código no se pueden dejar vacíos; los demás sí (se borra el dato).
            if (in_array($campo, ['name', 'code'], true) && mb_strlen($texto) < 1) continue;
            if ($actual === null && $texto === '') continue;
            if ($actual !== null && $texto === $antes) continue;

            if ($campo === 'email' && $texto !== '' && !filter_var($texto, FILTER_VALIDATE_EMAIL)) {
                $out['warn'][] = 'El email «' . $texto . '» no es válido: no se cambia.';
                continue;
            }

            $out['values'][$campo] = $texto;
            $out['changes'][]      = ['label' => $etiqueta, 'before' => $antes, 'after' => $texto === '' ? '(vacío)' : $texto];
        }

        return $out;
    }

    private function validarProductoIA($c, $idx, &$nuevos, &$vistos) {
        if ($c['action'] === 'add') {
            $campos = $this->camposProductoIA($c['set'], null, $idx, $nuevos);
            $nombre = $campos['item']['name'] ?? '';
            $clave  = $this->normalizarIA($nombre);

            if ($nombre === '') return $this->filaIA(['name' => $c['ref'] ?: 'Producto sin nombre', 'note' => 'Falta el nombre.']);

            if (isset($vistos['addproduct' . $clave])) return null;

            $vistos['addproduct' . $clave] = true;

            if (isset($idx['product']['nombre'][$clave])) {
                $existe = $idx['product']['id'][$idx['product']['nombre'][$clave]];

                return $this->filaIA([
                    'name' => $nombre,
                    'sku'  => $existe['sku'] ?? '',
                    'note' => (int) $existe['active'] === 1 ? 'Ya existe en el catálogo.' : 'Existe dado de baja: pídeme reactivarlo.'
                ]);
            }

            // Un producto nuevo sin precio entra en 0 (insumo que no se vende).
            $campos['item'] += ['price' => 0, 'price_without_tax' => 0, 'tax' => 0];

            return $this->filaIA([
                'name'    => $nombre,
                'changes' => $this->sinNombreIA($campos['changes']),
                'warn'    => implode(' ', $campos['warn'])
            ], ['item' => $campos['item'], 'attr' => $campos['attr'], 'refs' => $campos['refs']]);
        }

        $actual = $this->buscarIA('product', $c, $idx);

        if ($actual === null) return $this->filaIA(['name' => $c['ref'] ?: 'Producto sin identificar', 'note' => 'No lo encontré en el catálogo.']);

        $id    = (int) $actual['id'];
        $aviso = $this->avisoIdentidadIA($c['ref'], $actual['name']);

        if ($c['action'] !== 'edit') return $this->validarEstadoIA('product', $c['action'], $actual, $aviso, $idx, $vistos);

        if (isset($vistos['editproduct' . $id])) return null;

        $vistos['editproduct' . $id] = true;

        $campos = $this->camposProductoIA($c['set'], $actual, $idx, $nuevos);
        $fila   = [
            'name'    => $actual['name'],
            'sku'     => $actual['sku'] ?? '',
            'changes' => $campos['changes'],
            'warn'    => trim($aviso . ' ' . implode(' ', $campos['warn']))
        ];

        if (isset($campos['item']['name'])) {
            $otro = $idx['product']['nombre'][$this->normalizarIA($campos['item']['name'])] ?? null;

            if ($otro !== null && $otro !== $id) return $this->filaIA($fila + ['note' => 'Ya existe otro producto con ese nombre.']);
        }

        if (empty($campos['item']) && empty($campos['attr']) && empty($campos['refs'])) {
            return $this->filaIA($fila + ['note' => 'Ya tiene esos datos.']);
        }

        return $this->filaIA($fila, ['id' => $id, 'item' => $campos['item'], 'attr' => $campos['attr'], 'refs' => $campos['refs']]);
    }

    /*  Campos de un producto, repartidos donde viven: item (nombre, categoría,
        precio de venta) e item_attribute (unidad, área, costo, mínimos, vida útil,
        descripción). 'refs' guarda la categoría, unidad o área que se da de alta en
        la misma propuesta: su id se conoce hasta aplicarla. */
    private function camposProductoIA($set, $actual, $idx, $nuevos) {
        $etiquetas = self::IA_ENTIDADES['product']['campos'];
        $out       = ['item' => [], 'attr' => [], 'refs' => [], 'changes' => [], 'warn' => []];

        if (array_key_exists('name', $set)) {
            $nombre = mb_substr(preg_replace('/\s+/u', ' ', $this->textoIA($set['name'])), 0, 160);

            if (mb_strlen($nombre) >= 2 && ($actual === null || $nombre !== $actual['name'])) {
                $out['item']['name'] = $nombre;
                $out['changes'][]    = ['label' => 'Nombre', 'before' => $actual['name'] ?? '', 'after' => $nombre];
            }
        }

        // campo => [entidad del catálogo, columna, tabla destino, columna de listMateriales]
        $referencias = [
            'category' => ['category', 'category_id',       'item', 'categoria'],
            'unit'     => ['unit',     'unit_id',           'attr', 'unidad'],
            'area'     => ['area',     'warehouse_area_id', 'attr', 'area']
        ];

        foreach ($referencias as $campo => [$entidad, $columna, $destino, $columnaActual]) {
            $texto = array_key_exists($campo, $set) ? $this->textoIA($set[$campo]) : '';

            if ($texto === '') continue;

            $ref   = $this->refCatalogoIA($entidad, $texto, $idx, $nuevos);
            $antes = $actual !== null ? trim((string) ($actual[$columnaActual] ?? '')) : '';

            if ($ref === null) {
                $out['warn'][] = $etiquetas[$campo] . ' «' . $texto . '» no existe: ' . ($actual ? 'no se cambia.' : 'queda sin ' . mb_strtolower($etiquetas[$campo]) . '.');
                continue;
            }

            $mismo = $actual !== null && (
                $this->normalizarIA($antes) === $this->normalizarIA($ref['name'])
                || ($entidad === 'unit' && $this->normalizarIA($antes) === $this->normalizarIA($ref['code'] ?? ''))
            );

            if ($mismo) continue;

            if (isset($ref['nueva'])) {
                $out['refs'][$campo] = ['clave' => $ref['nueva'], 'nombre' => $ref['name']];
            } else {
                $out[$destino][$columna] = (int) $ref['id'];

                if ((int) $ref['active'] !== 1) $out['warn'][] = $etiquetas[$campo] . ' «' . $ref['name'] . '» está dada de baja.';
            }

            $out['changes'][] = ['label' => $etiquetas[$campo], 'before' => $antes, 'after' => $ref['name'] . (isset($ref['nueva']) ? ' (nueva)' : '')];
        }

        // Precio de venta: el precio con IVA manda y la base se deriva (salePrice()).
        $tocaPrecio = array_key_exists('price', $set) || array_key_exists('base', $set);

        if ($tocaPrecio || array_key_exists('tax', $set)) {
            $ivaActual    = $actual !== null ? (float) $actual['tax'] : 0;
            $precioActual = $actual !== null ? (float) $actual['price'] : 0;
            $entrada      = $set;

            // Solo IVA: se conserva el precio que paga el cliente y se recalcula la base.
            if (!$tocaPrecio) $entrada['price'] = $precioActual;

            [$precio, $base, $iva] = $this->precioIA($entrada, $ivaActual, $actual === null || !$tocaPrecio);

            if ($precio === null) {
                $out['warn'][] = 'El precio no es un número válido: no se cambia.';
            } else {
                $cambiaPrecio = $actual === null || abs($precio - $precioActual) >= 0.005;
                $cambiaIva    = $actual === null || abs($iva - $ivaActual) >= 0.005;

                if ($cambiaPrecio || $cambiaIva) {
                    $out['item'] += ['price' => $precio, 'price_without_tax' => $base, 'tax' => $iva];

                    if ($cambiaPrecio) $out['changes'][] = ['label' => 'Precio', 'before' => $actual ? $this->pesosIA($precioActual) : '', 'after' => $this->pesosIA($precio) . ($iva > 0 ? ' (sin IVA ' . $this->pesosIA($base) . ')' : '')];
                    if ($cambiaIva)    $out['changes'][] = ['label' => 'IVA', 'before' => $actual ? $ivaActual . '%' : '', 'after' => $iva . '%'];
                }
            }
        }

        // campo => [columna en item_attribute, es dinero]
        $numeros = [
            'cost'            => ['cost_unit', true],
            'stock_min'       => ['stock_min', false],
            'stock_max'       => ['stock_max', false],
            'shelf_life_days' => ['shelf_life_days', false]
        ];

        foreach ($numeros as $campo => [$columna, $dinero]) {
            if (!array_key_exists($campo, $set)) continue;

            $n = $this->cifraIA($set[$campo]);

            if ($n === null || $n < 0 || $n > 9999999) {
                $out['warn'][] = $etiquetas[$campo] . ': «' . $this->textoIA($set[$campo]) . '» no es un número válido.';
                continue;
            }

            if ($columna === 'shelf_life_days') $n = (int) round($n);

            $antes = $actual !== null ? $actual[$columna] : null;

            if ($antes !== null && $antes !== '' && abs((float) $antes - $n) < 0.0001) continue;

            $formato = function ($v) use ($dinero, $columna) {
                if ($v === null || $v === '') return '';
                if ($dinero) return $this->pesosIA($v);
                return $this->numeroIA($v) . ($columna === 'shelf_life_days' ? ' días' : '');
            };

            $out['attr'][$columna] = $n;
            $out['changes'][]      = ['label' => $etiquetas[$campo], 'before' => $formato($antes), 'after' => $formato($n)];
        }

        if (array_key_exists('description', $set)) {
            $texto = mb_substr(preg_replace('/\s+/u', ' ', $this->textoIA($set['description'])), 0, 255);
            $antes = $actual !== null ? trim((string) ($actual['description'] ?? '')) : '';

            if ($texto !== $antes && !($actual === null && $texto === '')) {
                $out['attr']['description'] = $texto;
                $out['changes'][]           = ['label' => 'Descripción', 'before' => $antes, 'after' => $texto === '' ? '(vacío)' : $texto];
            }
        }

        return $out;
    }

    // Categoría, unidad o área por nombre (o código de unidad), o la que se da de
    // alta en esta misma propuesta. Sin igual exacto vale una parcial solo si es
    // la única activa ("Bebida" encuentra "Bebidas").
    private function refCatalogoIA($entidad, $texto, $idx, $nuevos) {
        $clave = $this->normalizarIA($texto);

        if ($clave === '') return null;

        $fila = function ($r) {
            return ['id' => (int) $r['id'], 'name' => $r['name'], 'code' => $r['code'] ?? '', 'active' => (int) $r['active']];
        };

        if (isset($idx[$entidad]['nombre'][$clave])) return $fila($idx[$entidad]['id'][$idx[$entidad]['nombre'][$clave]]);
        if (isset($idx[$entidad]['codigo'][$clave])) return $fila($idx[$entidad]['id'][$idx[$entidad]['codigo'][$clave]]);
        if (isset($nuevos[$entidad][$clave]))        return ['nueva' => $clave, 'name' => $nuevos[$entidad][$clave]];

        $parciales = [];

        foreach ($idx[$entidad]['id'] as $r) {
            $valor = $this->normalizarIA($r['name']);

            if ((int) $r['active'] === 1 && $valor !== '' && (strpos($valor, $clave) !== false || strpos($clave, $valor) !== false)) {
                $parciales[] = $r;
            }
        }

        return count($parciales) === 1 ? $fila($parciales[0]) : null;
    }

    private function buscarSucursalIA($valor, $ctx) {
        $clave = $this->normalizarIA($this->textoIA($valor));

        foreach ($ctx['branch'] as $b) {
            if ((string) $b['id'] === $this->textoIA($valor) || ($clave !== '' && $this->normalizarIA($b['valor']) === $clave)) return $b;
        }

        return null;
    }

    private function nombreSucursalIA($id, $ctx) {
        foreach ($ctx['branch'] as $b) {
            if ((int) $b['id'] === (int) $id) return $b['valor'];
        }

        return 'Sucursal ' . $id;
    }

    // -- Asistente IA · aplicación --

    private function aplicarCambioIA($c, $companies_id, $branch_id, $now, &$creados) {
        $entidad = $c['entity'];

        if ($entidad === 'product') {
            if ($c['action'] === 'add')  return $this->altaProductoIA($c, $companies_id, $branch_id, $now, $creados);
            if ($c['action'] === 'edit') return $this->editarProductoIA($c, $companies_id, $creados);

            return $this->estadoIA($entidad, $c, $companies_id);
        }

        if ($c['action'] === 'add')  return $this->altaCatalogoIA($c, $companies_id, $branch_id, $now, $creados);
        if ($c['action'] === 'edit') return $this->editarCatalogoIA($c, $companies_id);

        return $this->estadoIA($entidad, $c, $companies_id);
    }

    private function altaCatalogoIA($c, $companies_id, $branch_id, $now, &$creados) {
        $entidad = $c['entity'];
        $valores = $c['values'] + ['companies_id' => $companies_id, 'created_at' => $now, 'active' => 1];

        if ($entidad === 'warehouse') $valores += ['branch_id' => $branch_id, 'is_default' => 0];

        if ($this->createCatalog($entidad, $this->sqlIA($valores)) !== true) {
            throw new Exception('No pude dar de alta ' . self::IA_ENTIDADES[$entidad]['uno'] . ' «' . $valores['name'] . '».');
        }

        $creados[$entidad][$this->normalizarIA($valores['name'])] = $this->getMaxCatalogId($entidad);
    }

    private function editarCatalogoIA($c, $companies_id) {
        $update = $this->updateCatalog($c['entity'], [
            'values' => array_keys($c['values']),
            'where'  => ['id = ?', 'companies_id = ?'],
            'data'   => array_merge(array_values($c['values']), [$c['id'], $companies_id])
        ]);

        if ($update !== true) throw new Exception('No pude cambiar ' . self::IA_ENTIDADES[$c['entity']]['uno'] . ' «' . $c['nombre'] . '».');
    }

    private function estadoIA($entidad, $c, $companies_id) {
        $datos = [
            'values' => ['active'],
            'where'  => ['id = ?', 'companies_id = ?'],
            'data'   => [$c['action'] === 'activate' ? 1 : 0, $c['id'], $companies_id]
        ];

        $update = $entidad === 'product' ? $this->updateMaterial($datos) : $this->updateCatalog($entidad, $datos);

        if ($update !== true) throw new Exception('No pude cambiar el estado de ' . self::IA_ENTIDADES[$entidad]['uno'] . ' «' . $c['nombre'] . '».');
    }

    // Misma alta que addMaterial, con los datos ya validados.
    private function altaProductoIA($c, $companies_id, $branch_id, $now, $creados) {
        [$item, $attr] = $this->resolverRefsIA($c, $creados);

        $datos = $item + [
            'image'        => '',
            'branch_id'    => $branch_id,
            'companies_id' => $companies_id,
            'created_at'   => $now,
            'active'       => 1
        ];

        if ($this->createMaterial($this->sqlIA($datos)) !== true) throw new Exception('No pude dar de alta «' . $item['name'] . '».');

        $atributos = $attr + [
            'sku'          => $this->skuFor($item['category_id'] ?? null),
            'item_id'      => $this->getMaxItemId(),
            'companies_id' => $companies_id,
            'created_at'   => $now,
            'active'       => 1
        ];

        if ($this->createItemAttribute($this->sqlIA($atributos)) !== true) throw new Exception('No pude guardar los datos de «' . $item['name'] . '».');
    }

    private function editarProductoIA($c, $companies_id, $creados) {
        [$item, $attr] = $this->resolverRefsIA($c, $creados);

        if (!empty($item)) {
            $update = $this->updateMaterial([
                'values' => array_keys($item),
                'where'  => ['id = ?', 'companies_id = ?'],
                'data'   => array_merge(array_values($item), [$c['id'], $companies_id])
            ]);

            if ($update !== true) throw new Exception('No pude cambiar el producto «' . $c['nombre'] . '».');
        }

        if (!empty($attr)) {
            $update = $this->updateItemAttribute([
                'values' => array_keys($attr),
                'where'  => ['item_id = ?', 'companies_id = ?', 'active = 1'],
                'data'   => array_merge(array_values($attr), [$c['id'], $companies_id])
            ]);

            if ($update !== true) throw new Exception('No pude cambiar los datos del producto «' . $c['nombre'] . '».');
        }

        // Igual que editMaterial: si el producto no tenía SKU, lo recibe ahora.
        if (array_key_exists('category_id', $item)) $this->updateItemAttributeSku([$this->skuFor($item['category_id']), $c['id']]);
    }

    // Pone el id de la categoría, unidad o área dada de alta en esta misma propuesta.
    // Si no se marcó, el producto no puede quedar apuntando a la nada: se detiene todo.
    private function resolverRefsIA($c, $creados) {
        $item    = $c['item'];
        $attr    = $c['attr'];
        $destino = ['category' => ['item', 'category_id'], 'unit' => ['attr', 'unit_id'], 'area' => ['attr', 'warehouse_area_id']];

        foreach ($c['refs'] as $campo => $ref) {
            $id = $creados[$campo][$ref['clave']] ?? null;

            if ($id === null) {
                $producto = $item['name'] ?? $c['nombre'];

                throw new Exception('«' . $producto . '» usa ' . self::IA_ENTIDADES[$campo]['uno'] . ' nueva «' . $ref['nombre'] . '», que no marcaste. Márcala también o desmarca el producto.');
            }

            [$tabla, $columna] = $destino[$campo];

            if ($tabla === 'item') $item[$columna] = $id;
            else                   $attr[$columna] = $id;
        }

        return [$item, $attr];
    }

    // INSERT sin util->sql(): ahí un 0 se volvería NULL (gotcha 0 == ''). Los null
    // se omiten para que la BD ponga su DEFAULT.
    private function sqlIA($valores) {
        $valores = array_filter($valores, function ($v) { return $v !== null; });

        return [
            'values' => array_keys($valores),
            'data'   => array_values($valores)
        ];
    }

    // "Listo. Altas: 1 categoría y 2 productos · Cambios: 5 productos."
    private function resumenIA($n) {
        $verbos = ['add' => 'Altas', 'edit' => 'Cambios', 'deactivate' => 'Bajas', 'activate' => 'Reactivados'];
        $partes = [];

        foreach ($verbos as $accion => $verbo) {
            $items = [];

            foreach (self::IA_ENTIDADES as $entidad => $def) {
                $k = $n[$entidad][$accion] ?? 0;

                if ($k) $items[] = $k . ' ' . ($k === 1 ? $def['uno'] : $def['varios']);
            }

            if (empty($items)) continue;

            $ultimo   = array_pop($items);
            $partes[] = $verbo . ': ' . (empty($items) ? '' : implode(', ', $items) . ' y ') . $ultimo;
        }

        return 'Listo. ' . implode(' · ', $partes) . '.';
    }

    // -- Asistente IA · utilidades --

    // Mismo pivote que salePrice(): el precio CON IVA manda y la base se deriva.
    // Devuelve [precio, base, iva]; precio null si no hay un precio usable.
    private function precioIA($c, $ivaActual, $permitirCero) {
        $iva    = $this->ivaIA($c['tax'] ?? null, $ivaActual);
        $precio = $this->cifraIA($c['price'] ?? null);
        $base   = $this->cifraIA($c['base'] ?? null);

        if (!$permitirCero) {
            if ($precio !== null && $precio <= 0) $precio = null;
            if ($base !== null && $base <= 0)     $base   = null;
        }

        if ($precio === null && $base !== null) $precio = round($base * (1 + $iva / 100), 2);

        if ($precio === null || $precio < 0 || $precio > 999999) return [null, null, $iva];

        $precio = round($precio, 2);
        $base   = $iva > 0 ? round($precio / (1 + $iva / 100), 2) : $precio;

        return [$precio, $base, $iva];
    }

    private function ivaIA($valor, $porDefecto) {
        $n = $this->cifraIA($valor);

        if ($n === null) return (float) $porDefecto;

        if ($n > 0 && $n < 1) $n *= 100;

        $n = round($n);

        return in_array($n, [0.0, 8.0, 16.0], true) ? $n : (float) $porDefecto;
    }

    private function cifraIA($valor) {
        if (is_int($valor) || is_float($valor)) return (float) $valor;

        if (!is_string($valor)) return null;

        $s = str_replace(['$', ',', ' ', 'MXN', 'mxn'], '', trim($valor));

        return is_numeric($s) ? (float) $s : null;
    }

    private function siNoIA($valor) {
        if (is_bool($valor)) return $valor ? 1 : 0;

        $v = $this->normalizarIA($this->textoIA($valor));

        if (in_array($v, ['1', 'si', 'yes', 'true', 'verdadero'], true)) return 1;
        if (in_array($v, ['0', 'no', 'false', 'falso'], true))           return 0;

        return null;
    }

    // Si el nombre que escribió el modelo no se parece al del catálogo, se avisa:
    // puede haber elegido el registro equivocado.
    private function avisoIdentidadIA($pedido, $real) {
        $a = $this->normalizarIA($pedido);
        $b = $this->normalizarIA($real);

        if ($a === '' || $a === $b || strpos($a, $b) !== false || strpos($b, $a) !== false) return '';

        similar_text($a, $b, $parecido);

        return $parecido < 60 ? 'En tu lista decía «' . $pedido . '».' : '';
    }

    private function sinNombreIA($changes) {
        return array_values(array_filter($changes, function ($ch) { return $ch['label'] !== 'Nombre'; }));
    }

    private function normalizarIA($texto) {
        $t = mb_strtolower(trim((string) $texto), 'UTF-8');
        $t = strtr($t, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);

        return trim(preg_replace('/[^a-z0-9]+/', ' ', $t));
    }

    private function textoIA($valor) {
        return is_scalar($valor) ? trim((string) $valor) : '';
    }

    private function numeroIA($n) {
        if ($n === null || $n === '') return '';

        return rtrim(rtrim(number_format((float) $n, 2, '.', ''), '0'), '.');
    }

    private function pesosIA($n) {
        return '$' . number_format((float) $n, 2);
    }

    private function filaIA($row, $cambio = null) {
        return [
            'row'    => array_merge([
                'name'    => '',
                'sku'     => '',
                'changes' => [],
                'before'  => '',
                'after'   => '',
                'detail'  => '',
                'warn'    => '',
                'note'    => ''
            ], $row),
            'cambio' => $cambio
        ];
    }
}

// Complements

function renderProductImage($foto, $nombre) {
    $src = !empty($foto) ? $foto : '';

    $img = !empty($src)
        ? '<img src="' . htmlspecialchars($src) . '" alt="Imagen Insumo" class="w-8 h-8 bg-gray-500 rounded-md object-cover" />'
        : '<div class="w-10 h-10 bg-gray-200 rounded-sm flex items-center justify-center">
                <i class="icon-picture-5 text-gray-600"></i>
           </div>';

    // El nombre va SIN clase de tamano: asi hereda el font-size que createTable
    // pinta en la celda (f_size). Con text-xs quedaba clavado en 9.8px, porque
    // compact.css lo fija con !important y eso le gana al estilo del <td>.
    return '
        <div class="flex items-center justify-start gap-2 py-1 text-center">
            ' . $img . '
            <div>' . htmlspecialchars($nombre) . '</div>
        </div>';
}

function renderStatus($estatus) {
    switch ($estatus) {
        case 1:
            return '<span class="px-2 py-1 rounded-md text-xs font-semibold bg-green-100 text-green-700">Activo</span>';
        case 0:
            return '<span class="px-2 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-700">Inactivo</span>';
        default:
            return '<span class="px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700">Desconocido</span>';
    }
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
