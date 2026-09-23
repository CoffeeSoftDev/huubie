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
    /*  Chat flotante de Productos: altas, cambios de precio y bajas a partir de un
        mensaje, un Excel o una foto. El modelo solo PROPONE; aquí se valida cada
        cambio contra el catálogo real y la propuesta se guarda en la sesión. Lo que
        se aplica sale de la sesión, nunca de lo que mande el navegador. */

    const IA_MAX_CAMBIOS  = 150;
    const IA_MAX_CATALOGO = 1500;

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

        $catalogo   = $this->listMateriales([]);
        $categorias = $this->lsCategories();
        $unidades   = $this->lsUnits();

        // Sin esto la sesión queda bloqueada mientras el modelo piensa y la tabla de
        // Productos no puede recargar en ese rato. Se reabre para guardar la propuesta.
        session_write_close();
        set_time_limit(180);

        $respuesta = $ia->chatJson($this->mensajesIA($mensaje, $adjuntos, $historial, $catalogo, $categorias, $unidades));

        if (!$respuesta['ok']) return ['status' => 502, 'message' => $respuesta['error']];

        $cambios = isset($respuesta['data']['changes']) && is_array($respuesta['data']['changes']) ? $respuesta['data']['changes'] : [];
        $reply   = $this->textoIA($respuesta['data']['reply'] ?? '');
        $vista   = $this->validarCambiosIA($cambios, $catalogo, $categorias, $unidades);
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

        $companies_id = $_SESSION['company_id'];
        $branch_id    = $_SESSION['branch_id'] ?? null;
        $now          = date('Y-m-d H:i:s');

        try {
            $hechos = $this->transaction(function () use ($selecciones, $companies_id, $branch_id, $now) {
                $n = ['add' => 0, 'price' => 0, 'deactivate' => 0];

                foreach ($selecciones as $c) {
                    if ($c['action'] === 'add')        $this->altaIA($c, $companies_id, $branch_id, $now);
                    if ($c['action'] === 'price')      $this->precioProductoIA($c, $companies_id);
                    if ($c['action'] === 'deactivate') $this->bajaIA($c, $companies_id);

                    $n[$c['action']]++;
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
            'data'    => $hechos
        ];
    }

    private function mensajesIA($mensaje, $adjuntos, $historial, $catalogo, $categorias, $unidades) {
        $mensajes = [['role' => 'system', 'content' => $this->promptIA($catalogo, $categorias, $unidades)]];

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

    private function promptIA($catalogo, $categorias, $unidades) {
        $lineas = [];

        foreach (array_slice($catalogo, 0, self::IA_MAX_CATALOGO) as $p) {
            $lineas[] = implode(' | ', [
                $p['id'],
                $p['sku'] ?: '-',
                $p['name'],
                $p['categoria'] ?: '-',
                number_format((float) $p['price'], 2, '.', ''),
                (float) $p['tax'],
                (int) $p['active'] === 1 ? 'activo' : 'baja'
            ]);
        }

        $recorte = count($catalogo) > self::IA_MAX_CATALOGO ? ' (recortado a los ' . self::IA_MAX_CATALOGO . ' más recientes)' : '';

        return implode("\n", [
            'Eres el asistente de PRODUCTOS del almacén de Coffee Inventory. Hablas español, en frases cortas y claras.',
            '',
            'Solo puedes proponer tres tipos de cambio al catálogo:',
            '- "add": dar de alta un producto que NO existe en el catálogo.',
            '- "price": cambiar el precio de venta de un producto que SÍ existe.',
            '- "deactivate": dar de baja (desactivar) un producto que SÍ existe.',
            'No manejas existencias, entradas, salidas, costos ni borrados. Si te piden otra cosa, dilo en "reply" y no propongas cambios.',
            'Tú NO aplicas nada: propones, y la persona revisa una vista previa y confirma.',
            '',
            'Cómo leer lo que te dan:',
            '- El MENSAJE manda. Los ARCHIVOS (hojas de cálculo o fotos ya transcritas) son material de apoyo para lo que pide el mensaje.',
            '- Si solo llega un archivo con nombres y precios, entiende que quieren actualizar el precio de los que existen y dar de alta los que no.',
            '- Busca cada producto en el CATÁLOGO por nombre o SKU aunque venga escrito distinto (mayúsculas, acentos, abreviaturas, plural).',
            '- Para "price" y "deactivate" el "item_id" es OBLIGATORIO y sale del catálogo. Si dudas entre dos productos, no lo incluyas y pregúntalo en "reply".',
            '- Nunca propongas "add" de algo que ya está en el catálogo.',
            '- Si dos archivos (o el mensaje y un archivo) dan precios distintos para el mismo producto, no lo incluyas y pregunta en "reply" cuál vale.',
            '',
            'Precios:',
            '- "price" es el precio de venta FINAL, con IVA incluido. Si te dicen que el precio es sin IVA (o "más IVA"), manda ese número en "base" y no mandes "price".',
            '- Aumentos o descuentos en porcentaje: calcula el precio nuevo a partir del precio actual del catálogo y redondea a 2 decimales.',
            '- "tax" es el IVA: solo 0, 8 o 16. Si no lo sabes, no lo mandes.',
            '- Números sin signo de pesos ni separador de miles: 1250.5',
            '',
            'Altas:',
            '- "name": el nombre como debe quedar, con mayúscula inicial.',
            '- "category": una de CATEGORÍAS, escrita igual. Si ninguna corresponde, déjala vacía.',
            '- "unit": una de UNIDADES, escrita igual. Si ninguna corresponde, déjala vacía.',
            '',
            'Como mucho ' . self::IA_MAX_CAMBIOS . ' cambios por respuesta; si hay más, propone los primeros y avísalo en "reply".',
            '',
            'Responde SOLO con un objeto JSON, sin texto antes ni después. Ejemplo:',
            '{"reply": "Encontré 3 cambios. Revísalos y confirma.", "changes": [',
            '  {"action": "price", "item_id": 12, "name": "Agua natural 1 L", "price": 18.5},',
            '  {"action": "add", "name": "Refresco de cola 600 ml", "category": "Bebidas", "unit": "Pieza", "price": 22, "tax": 16},',
            '  {"action": "deactivate", "item_id": 40, "name": "Pan dulce"}',
            ']}',
            'Omite los campos que no apliquen. Si no hay cambios, "changes" va vacío y en "reply" explicas o preguntas lo que falte.',
            '',
            'CATEGORÍAS: ' . (empty($categorias) ? '(ninguna)' : implode(', ', array_column($categorias, 'valor'))),
            'UNIDADES: ' . (empty($unidades) ? '(ninguna)' : implode(', ', array_map(function ($u) { return $u['valor'] . ' (' . $u['code'] . ')'; }, $unidades))),
            '',
            'CATÁLOGO' . $recorte . ' (id | sku | nombre | categoría | precio con IVA | IVA % | estado):',
            empty($lineas) ? '(vacío)' : implode("\n", $lineas)
        ]);
    }

    /*  Convierte lo que propuso el modelo en filas de vista previa. Las que no se
        pueden aplicar (producto que no existe, precio igual, ya dado de baja) se
        enseñan con su motivo pero no entran en 'validos'. El nombre que se enseña
        es el del catálogo, no el que escribió el modelo: así se ve qué producto se
        va a tocar de verdad. */
    private function validarCambiosIA($cambios, $catalogo, $categorias, $unidades) {
        $porId     = [];
        $porSku    = [];
        $porNombre = [];

        foreach ($catalogo as $p) {
            $porId[(int) $p['id']] = $p;

            if (!empty($p['sku'])) $porSku[mb_strtolower(trim($p['sku']))] = (int) $p['id'];

            $clave = $this->normalizarIA($p['name']);

            if (!isset($porNombre[$clave])) $porNombre[$clave] = (int) $p['id'];
        }

        $alias   = ['alta' => 'add', 'agregar' => 'add', 'nuevo' => 'add', 'precio' => 'price', 'baja' => 'deactivate', 'desactivar' => 'deactivate'];
        $row     = [];
        $validos = [];
        $vistos  = [];
        $resumen = ['add' => 0, 'price' => 0, 'deactivate' => 0, 'invalid' => 0];

        foreach (array_slice($cambios, 0, self::IA_MAX_CAMBIOS) as $c) {
            if (!is_array($c)) continue;

            $accion = strtolower($this->textoIA($c['action'] ?? ''));
            $accion = $alias[$accion] ?? $accion;

            if ($accion === 'add') {
                $fila = $this->validarAltaIA($c, $porId, $porNombre, $categorias, $unidades, $vistos);
            } elseif ($accion === 'price') {
                $fila = $this->validarPrecioIA($c, $this->buscarProductoIA($c, $porId, $porSku, $porNombre), $vistos);
            } elseif ($accion === 'deactivate') {
                $fila = $this->validarBajaIA($c, $this->buscarProductoIA($c, $porId, $porSku, $porNombre), $vistos);
            } else {
                continue;
            }

            // null = repetido dentro de la misma propuesta.
            if ($fila === null) continue;

            $idx = count($row);

            $fila['row']['idx']    = $idx;
            $fila['row']['action'] = $accion;
            $fila['row']['valid']  = $fila['cambio'] !== null;

            if ($fila['cambio'] !== null) {
                $validos[$idx] = $fila['cambio'];
                $resumen[$accion]++;
            } else {
                $resumen['invalid']++;
            }

            $row[] = $fila['row'];
        }

        return [
            'row'     => $row,
            'validos' => $validos,
            'resumen' => $resumen
        ];
    }

    private function validarAltaIA($c, $porId, $porNombre, $categorias, $unidades, &$vistos) {
        $nombre = mb_substr(preg_replace('/\s+/u', ' ', $this->textoIA($c['name'] ?? '')), 0, 160);
        $clave  = $this->normalizarIA($nombre);

        if (mb_strlen($nombre) < 2) return $this->filaIA(['name' => 'Producto sin nombre', 'note' => 'Falta el nombre.']);

        if (isset($vistos['add' . $clave])) return null;

        $vistos['add' . $clave] = true;

        if (isset($porNombre[$clave])) {
            $existe = $porId[$porNombre[$clave]];

            return $this->filaIA([
                'name' => $nombre,
                'sku'  => $existe['sku'] ?? '',
                'note' => (int) $existe['active'] === 1 ? 'Ya existe en el catálogo.' : 'Ya existe, dado de baja.'
            ]);
        }

        $pedidaCat    = $this->textoIA($c['category'] ?? '');
        $pedidaUnidad = $this->textoIA($c['unit'] ?? '');
        $categoria    = $this->buscarOpcionIA($pedidaCat, $categorias);
        $unidad       = $this->buscarOpcionIA($pedidaUnidad, $unidades);
        $avisos       = [];

        [$precio, $base, $iva] = $this->precioIA($c, 0, true);

        if ($categoria === null && $pedidaCat !== '')  $avisos[] = 'La categoría «' . $pedidaCat . '» no existe: queda sin categoría.';
        if ($unidad === null && $pedidaUnidad !== '') $avisos[] = 'La unidad «' . $pedidaUnidad . '» no existe: queda sin unidad.';

        return $this->filaIA([
            'name'   => $nombre,
            'after'  => $this->pesosIA($precio ?? 0),
            'detail' => implode(' · ', [
                $categoria ? $categoria['valor'] : 'Sin categoría',
                $unidad ? $unidad['valor'] : 'Sin unidad',
                'IVA ' . $iva . '%'
            ]),
            'warn'   => implode(' ', $avisos)
        ], [
            'action'      => 'add',
            'name'        => $nombre,
            'category_id' => $categoria ? (int) $categoria['id'] : null,
            'unit_id'     => $unidad ? (int) $unidad['id'] : null,
            'price'       => $precio ?? 0,
            'base'        => $base ?? 0,
            'tax'         => $iva
        ]);
    }

    private function validarPrecioIA($c, $item, &$vistos) {
        $pedido = $this->textoIA($c['name'] ?? '');

        if ($item === null) return $this->filaIA(['name' => $pedido ?: 'Producto sin identificar', 'note' => 'No lo encontré en el catálogo.']);

        if (isset($vistos['price' . $item['id']])) return null;

        $vistos['price' . $item['id']] = true;

        $ivaActual = (float) $item['tax'];

        [$precio, $base, $iva] = $this->precioIA($c, $ivaActual, false);

        $fila = [
            'name'   => $item['name'],
            'sku'    => $item['sku'] ?? '',
            'before' => $this->pesosIA($item['price']),
            'warn'   => $this->avisoIdentidadIA($pedido, $item['name'])
        ];

        if ($precio === null) return $this->filaIA($fila + ['note' => 'Falta el precio nuevo.']);

        if (abs($precio - (float) $item['price']) < 0.005 && abs($iva - $ivaActual) < 0.005) {
            return $this->filaIA($fila + ['note' => 'Ya tiene ese precio.']);
        }

        return $this->filaIA($fila + [
            'after'  => $this->pesosIA($precio),
            'detail' => 'Sin IVA ' . $this->pesosIA($base) . ' · IVA ' . $iva . '%'
        ], [
            'action'  => 'price',
            'item_id' => (int) $item['id'],
            'price'   => $precio,
            'base'    => $base,
            'tax'     => $iva
        ]);
    }

    private function validarBajaIA($c, $item, &$vistos) {
        $pedido = $this->textoIA($c['name'] ?? '');

        if ($item === null) return $this->filaIA(['name' => $pedido ?: 'Producto sin identificar', 'note' => 'No lo encontré en el catálogo.']);

        if (isset($vistos['deactivate' . $item['id']])) return null;

        $vistos['deactivate' . $item['id']] = true;

        $fila = [
            'name' => $item['name'],
            'sku'  => $item['sku'] ?? ''
        ];

        if ((int) $item['active'] !== 1) return $this->filaIA($fila + ['before' => 'Baja', 'note' => 'Ya está dado de baja.']);

        $stock  = (float) $item['quantity'];
        $avisos = array_filter([
            $this->avisoIdentidadIA($pedido, $item['name']),
            $stock > 0 ? 'Aún tiene ' . rtrim(rtrim(number_format($stock, 2, '.', ','), '0'), '.') . ' en existencia.' : ''
        ]);

        return $this->filaIA($fila + [
            'before' => 'Activo',
            'after'  => 'Baja',
            'warn'   => implode(' ', $avisos)
        ], [
            'action'  => 'deactivate',
            'item_id' => (int) $item['id']
        ]);
    }

    private function buscarProductoIA($c, $porId, $porSku, $porNombre) {
        $id = isset($c['item_id']) && is_numeric($c['item_id']) ? (int) $c['item_id'] : 0;

        if ($id > 0 && isset($porId[$id])) return $porId[$id];

        $sku = mb_strtolower($this->textoIA($c['sku'] ?? ''));

        if ($sku !== '' && isset($porSku[$sku])) return $porId[$porSku[$sku]];

        $clave = $this->normalizarIA($this->textoIA($c['name'] ?? ''));

        if ($clave !== '' && isset($porNombre[$clave])) return $porId[$porNombre[$clave]];

        return null;
    }

    // Categoría o unidad por nombre (o código de unidad); si no hay igual exacto,
    // vale una parcial solo si es la única ("Bebida" encuentra "Bebidas").
    private function buscarOpcionIA($texto, $lista) {
        $clave = $this->normalizarIA($texto);

        if ($clave === '') return null;

        $parciales = [];

        foreach ($lista as $o) {
            $valor  = $this->normalizarIA($o['valor']);
            $codigo = isset($o['code']) ? $this->normalizarIA($o['code']) : '';

            if ($clave === $valor || ($codigo !== '' && $clave === $codigo)) return $o;

            if ($valor !== '' && (strpos($valor, $clave) !== false || strpos($clave, $valor) !== false)) $parciales[] = $o;
        }

        return count($parciales) === 1 ? $parciales[0] : null;
    }

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

    // Si el nombre que escribió el modelo no se parece al del catálogo, se avisa:
    // puede haber elegido el producto equivocado.
    private function avisoIdentidadIA($pedido, $real) {
        $a = $this->normalizarIA($pedido);
        $b = $this->normalizarIA($real);

        if ($a === '' || $a === $b || strpos($a, $b) !== false || strpos($b, $a) !== false) return '';

        similar_text($a, $b, $parecido);

        return $parecido < 60 ? 'En tu lista decía «' . $pedido . '».' : '';
    }

    private function normalizarIA($texto) {
        $t = mb_strtolower(trim((string) $texto), 'UTF-8');
        $t = strtr($t, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);

        return trim(preg_replace('/[^a-z0-9]+/', ' ', $t));
    }

    private function textoIA($valor) {
        return is_scalar($valor) ? trim((string) $valor) : '';
    }

    private function pesosIA($n) {
        return '$' . number_format((float) $n, 2);
    }

    private function filaIA($row, $cambio = null) {
        return [
            'row'    => array_merge([
                'name'   => '',
                'sku'    => '',
                'before' => '—',
                'after'  => '—',
                'detail' => '',
                'warn'   => '',
                'note'   => ''
            ], $row),
            'cambio' => $cambio
        ];
    }

    // Misma alta que addMaterial, con los datos ya validados.
    private function altaIA($c, $companies_id, $branch_id, $now) {
        $sql = $this->util->sql([
            'name'         => $c['name'],
            'image'        => '',
            'category_id'  => $c['category_id'],
            'branch_id'    => $branch_id,
            'companies_id' => $companies_id,
            'created_at'   => $now,
            'active'       => 1
        ]);

        // Los precios van después de util->sql(): un 0 ahí se volvería NULL (gotcha 0 == '').
        $sql['values'][] = 'price';
        $sql['values'][] = 'price_without_tax';
        $sql['values'][] = 'tax';
        $sql['data'][]   = $c['price'];
        $sql['data'][]   = $c['base'];
        $sql['data'][]   = $c['tax'];

        if ($this->createMaterial($sql) !== true) throw new Exception('No pude dar de alta «' . $c['name'] . '».');

        $attribute = $this->util->sql([
            'sku'          => $this->skuFor($c['category_id']),
            'unit_id'      => $c['unit_id'],
            'item_id'      => $this->getMaxItemId(),
            'companies_id' => $companies_id,
            'created_at'   => $now,
            'active'       => 1
        ]);

        if ($this->createItemAttribute($attribute) !== true) throw new Exception('No pude guardar los datos de «' . $c['name'] . '».');
    }

    private function precioProductoIA($c, $companies_id) {
        $update = $this->updateMaterial([
            'values' => 'price = ?, price_without_tax = ?, tax = ?',
            'where'  => ['id = ?', 'companies_id = ?'],
            'data'   => [$c['price'], $c['base'], $c['tax'], $c['item_id'], $companies_id]
        ]);

        if ($update !== true) throw new Exception('No pude cambiar el precio del producto ' . $c['item_id'] . '.');
    }

    private function bajaIA($c, $companies_id) {
        $update = $this->updateMaterial([
            'values' => 'active = ?',
            'where'  => ['id = ?', 'companies_id = ?'],
            'data'   => [0, $c['item_id'], $companies_id]
        ]);

        if ($update !== true) throw new Exception('No pude dar de baja el producto ' . $c['item_id'] . '.');
    }

    private function resumenIA($n) {
        $partes = [];

        if ($n['add'])        $partes[] = $n['add'] . ($n['add'] === 1 ? ' alta' : ' altas');
        if ($n['price'])      $partes[] = $n['price'] . ($n['price'] === 1 ? ' precio actualizado' : ' precios actualizados');
        if ($n['deactivate']) $partes[] = $n['deactivate'] . ($n['deactivate'] === 1 ? ' baja' : ' bajas');

        $ultimo = array_pop($partes);

        return 'Listo: ' . (empty($partes) ? '' : implode(', ', $partes) . ' y ') . $ultimo . '.';
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
