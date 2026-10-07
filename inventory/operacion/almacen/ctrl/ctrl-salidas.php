<?php
require_once __DIR__ . '/../../../conf/_Session.php';
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-salidas.php';
require_once '../../../conf/coffeSoft.php';
require_once '../../../conf/_IaOllama.php';

class ctrl extends mdl {

    public $companiesId;
    public $branchId;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->companiesId = (int) ($_SESSION['company_id'] ?? $_POST['companies_id'] ?? 0);
        $this->branchId    = (int) ($_SESSION['branch_id']  ?? $_POST['branch_id']    ?? 0);
        $this->userId      = (int) ($_SESSION['user_id']    ?? $_POST['user_id']      ?? 0);
    }

    function init() {
        $productos = array_map(function ($producto) {
            return [
                'id'        => (string) $producto['id'],
                'sku'       => $producto['sku'] ?: '',
                'nombre'    => $producto['nombre'],
                'categoria' => $producto['categoria'] ?: 'Sin categoria',
                'costo'     => (float) $producto['costo'],
                'precio'    => (float) ($producto['precio'] ?? 0),
                'stock'     => 0,
                'image'     => $producto['image'] ?? '',
                'icon'      => 'package',
                'bg'        => 'bg-gray-700/40',
                'color'     => 'text-gray-300'
            ];
        }, $this->qProductsForTransfer([$this->companiesId]));

        return [
            'status'          => 200,
            'companies_id'    => $this->companiesId,
            'branch_id'       => $this->branchId,
            'user_id'         => $this->userId,
            'coffeeia'        => IaOllama::activo($this),
            'sucursales'      => $this->lsSucursales(['company_id' => $this->companiesId, 'user_id' => $this->userId, 'is_owner' => (int) ($_SESSION['is_owner'] ?? 0)]),
            'almacenes'       => $this->lsWarehouses(['companies_id' => $this->companiesId]),
            'motivos_salida'   => $this->lsShrinkageReasons(),
            'productos'       => $productos
        ];
    }

    function lsStockByWarehouse() {
        $warehouseId = (int) ($_POST['warehouse_id'] ?? 0);
        $map = [];
        if ($warehouseId > 0) {
            foreach ($this->qStockByWarehouse([$warehouseId]) as $row) {
                $map[(string) $row['item_id']] = (float) $row['quantity'];
            }
        }
        return ['status' => 200, 'stock' => $map];
    }

    function lsSalidas() {
        $rows = $this->qSalidas([
            'companies_id'    => $this->companiesId,
            'branch_id'       => $_POST['branch_id'] ?? '',
            'reason_id'       => $_POST['reason_id']       ?? '',
            'status'          => $_POST['status']          ?? '',
            'fi'              => $_POST['fi']              ?? '',
            'ff'              => $_POST['ff']              ?? '',
            'q'               => $_POST['q']               ?? ''
        ]);

        $row = [];
        foreach ($rows as $salida) {
            $row[] = [
                'id'         => $salida['id'],
                'Folio'      => [
                    'html' => renderFolioLink($salida['folio'], $salida['id'])
                ],
                'Fecha'      => fechaHoraSalida($salida['created_at']),
                'Tipo'       => badge($salida['reason_name'], $salida['reason_color'], 100, $salida['reason_bg'] ?? null, $salida['reason_icon'] ?? null),
                'Sucursal'   => $salida['branch_name'] ?: '-',
                'Origen'     => $salida['warehouse_name']  ?: '-',
                'Costo'      => '<span class="text-red-400">' . evaluar((float) $salida['total_cost_loss']) . '</span>',
                'Estado'     => statusBadge($salida['status']),
                'Registrado' => $salida['user_name'] ?: '-',
                'a' => [
                    [
                        'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                        'html'    => '<i data-lucide="eye" class="w-4 h-4"></i>',
                        'onclick' => "salidas.getSalida({$salida['id']})"
                    ]
                ]
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    function showSalidas() {
        $kpis = $this->getSalidaKpis($this->kpiFilters());
        return ['status' => 200, 'counts' => $kpis];
    }

    function lsKpiDetail() {
        $filters = $this->kpiFilters();

        switch ($_POST['kpi']) {
            case 'kpiPerdida':
                $row = $this->kpiRowsByProduct($filters, 'cost');
                break;
            case 'kpiRegistros':
                $row = $this->kpiRowsByReason($filters);
                break;
            case 'kpiUnidades':
                $row = $this->kpiRowsByProduct($filters, 'units');
                break;
            case 'kpiCanceladas':
                $row = $this->kpiRowsCancelled($filters);
                break;
            default:
                return ['status' => 400, 'message' => 'Indicador no reconocido'];
        }

        return ['status' => 200, 'row' => $row];
    }

    function getSalida() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetSalida([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Salida no encontrada'];
        $detail = $this->getSalidaDetail([$id]);
        return ['status' => 200, 'header' => $header, 'detail' => $detail];
    }

    function saveSalida() {
        $payload   = json_decode($_POST['payload'] ?? '[]', true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }

        $folio         = $this->nextFolio('S-', 'inventory_shrinkage', $this->companiesId);
        $totalProducts = count($productos);
        $totalUnits    = 0;
        $totalLoss     = 0;
        foreach ($productos as $producto) {
            $totalUnits += (float) $producto['quantity'];
            $totalLoss  += (float) $producto['quantity'] * (float) $producto['cost'];
        }

        $evidenceUrl = $payload['evidence_url'] ?? null;
        $b64 = $payload['evidence_b64'] ?? null;
        if (!empty($b64) && preg_match('#^data:image/([a-zA-Z0-9.+-]+);base64,#', $b64, $mm)) {
            $ext  = strtolower($mm[1]) === 'jpeg' ? 'jpg' : strtolower($mm[1]);
            $data = base64_decode(substr($b64, strpos($b64, ',') + 1), true);
            if ($data !== false) {
                $dir = __DIR__ . '/../../../../inventory/uploads/mermas/';
                if (!is_dir($dir)) @mkdir($dir, 0777, true);
                $fileName = $folio . '.' . $ext;
                if (@file_put_contents($dir . $fileName, $data) !== false) {
                    $evidenceUrl = '/inventory/uploads/mermas/' . $fileName;
                }
            }
        }

        $ok = $this->insertSalida([
            $folio,
            $payload['note']         ?? null,
            $evidenceUrl,
            $totalProducts,
            $totalUnits,
            $totalLoss,
            $payload['status']       ?? 'Aplicada',
            (int) $payload['shrinkage_reason_id'],
            (int) $payload['warehouse_id'],
            (int) ($payload['branch_id'] ?? $this->branchId),
            $this->userId,
            $this->companiesId
        ]);

        if (!$ok) return ['status' => 500, 'message' => 'No se pudo registrar la salida'];

        $salidaRow = $this->_Read(
            "SELECT id FROM {$this->bd}inventory_shrinkage WHERE folio = ? AND companies_id = ? LIMIT 1",
            [$folio, $this->companiesId]
        );
        $salidaId = (int) ($salidaRow[0]['id'] ?? 0);

        foreach ($productos as $producto) {
            $productId = (int) $producto['product_id'];
            $warehouse = (int) $payload['warehouse_id'];
            $qty       = (float) $producto['quantity'];
            $cost      = (float) $producto['cost'];

            $stockRow = $this->getStockRow([$productId, $warehouse]);
            $prev     = $stockRow ? (float) $stockRow['quantity'] : 0;
            $post     = $prev - $qty;

            $this->insertSalidaDetail([
                $qty,
                $cost,
                $qty * $cost,
                $prev,
                $post,
                $productId,
                $salidaId
            ]);

            if ($stockRow) {
                $this->updateStockQuantity([$post, (int) $stockRow['id']]);
            }
        }

        return ['status' => 200, 'message' => 'Salida registrada', 'folio' => $folio, 'id' => $salidaId];
    }

    // Cancelar pide la contraseña de quien está en sesión (igual que en entradas).
    // Al acertar queda una autorización en sesión para ESA salida durante
    // CANCEL_WINDOW segundos; cancelSalida la exige y la consume.
    const CANCEL_WINDOW = 600;

    function verifyCancelPassword() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetSalida([$id]);
        if (!$header || (int) $header['companies_id'] !== $this->companiesId) {
            return ['status' => 404, 'message' => 'Salida no encontrada'];
        }

        // Misma verificación que el login: bcrypt con respaldo MD5 heredado.
        $user  = $this->qUserPassword([$this->userId]);
        $pass  = str_replace("'", "", $_POST['password']);
        $valid = $user && (
            (!empty($user['password']) && password_verify($pass, $user['password'])) ||
            (!empty($user['user_key']) && $user['user_key'] === md5($pass))
        );
        if (!$valid) return ['status' => 401, 'message' => 'Contraseña incorrecta'];

        $_SESSION['shrinkage_cancel'][$id] = time();
        return ['status' => 200, 'message' => 'OK'];
    }

    private function cancelAuthorized($id) {
        $at = (int) ($_SESSION['shrinkage_cancel'][$id] ?? 0);
        return $at > 0 && (time() - $at) <= self::CANCEL_WINDOW;
    }

    function cancelSalida() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetSalida([$id]);

        if (!$header) {
            return ['status' => 404, 'message' => 'Salida no encontrada'];
        }
        if ($header['status'] === 'Cancelada') {
            return ['status' => 400, 'message' => 'La salida ya esta cancelada'];
        }
        if (!$this->cancelAuthorized($id)) {
            return ['status' => 403, 'message' => 'Confirma tu contraseña para cancelar la salida'];
        }

        $warehouse = (int) $header['warehouse_id'];
        $detail    = $this->getSalidaDetail([$id]);
        foreach ($detail as $d) {
            $productId = (int) $d['product_id'];
            $qty       = (float) $d['quantity'];
            $stockRow  = $this->getStockRow([$productId, $warehouse]);
            if ($stockRow) {
                $post = (float) $stockRow['quantity'] + $qty;
                $this->updateStockQuantity([$post, (int) $stockRow['id']]);
            } else {
                $this->insertStockRow([$qty, $warehouse, $productId, $this->companiesId]);
            }
        }

        $r = $this->qCancelSalida([$id]);
        if ($r) unset($_SESSION['shrinkage_cancel'][$id]);
        return [
            'status'  => $r ? 200 : 500,
            'message' => $r ? 'Salida cancelada y stock restaurado' : 'No se pudo cancelar'
        ];
    }

    function deleteSalida() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetSalida([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Salida no encontrada'];
        if (($header['status'] ?? '') !== 'Cancelada') {
            return ['status' => 400, 'message' => 'Solo se puede eliminar una salida cancelada'];
        }
        $r = $this->deleteSalidaById([$id]);
        return [
            'status'  => $r ? 200 : 500,
            'message' => $r ? 'Salida eliminada' : 'No se pudo eliminar'
        ];
    }

    function saveSalidaEvidence() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetSalida([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Salida no encontrada'];
        if (($header['status'] ?? '') === 'Cancelada') {
            return ['status' => 400, 'message' => 'No se puede modificar la evidencia de una salida cancelada'];
        }

        $dir    = __DIR__ . '/../../../../inventory/uploads/mermas/';
        $oldUrl = $header['evidence_url'] ?? null;
        $b64    = $_POST['evidence_b64'] ?? null;

        if (empty($b64)) {
            if (!empty($oldUrl)) {
                $oldFile = $dir . basename($oldUrl);
                if (is_file($oldFile)) @unlink($oldFile);
            }
            $this->updateSalidaEvidence([null, $id]);
            return ['status' => 200, 'message' => 'Evidencia eliminada', 'evidence_url' => null];
        }

        if (!preg_match('#^data:image/([a-zA-Z0-9.+-]+);base64,#', $b64, $mm)) {
            return ['status' => 400, 'message' => 'Formato de imagen invalido'];
        }
        $ext  = strtolower($mm[1]) === 'jpeg' ? 'jpg' : strtolower($mm[1]);
        $data = base64_decode(substr($b64, strpos($b64, ',') + 1), true);
        if ($data === false) {
            return ['status' => 400, 'message' => 'No se pudo decodificar la imagen'];
        }
        if (!is_dir($dir)) @mkdir($dir, 0777, true);
        $fileName = $header['folio'] . '.' . $ext;
        if (@file_put_contents($dir . $fileName, $data) === false) {
            return ['status' => 500, 'message' => 'No se pudo guardar la evidencia'];
        }
        $url = '/inventory/uploads/mermas/' . $fileName;

        if (!empty($oldUrl) && basename($oldUrl) !== $fileName) {
            $oldFile = $dir . basename($oldUrl);
            if (is_file($oldFile)) @unlink($oldFile);
        }

        $this->updateSalidaEvidence([$url, $id]);
        return ['status' => 200, 'message' => 'Evidencia actualizada', 'evidence_url' => $url];
    }

    // -- CoffeeIA --

    // Mismo chat que Catálogo y Entradas (ia-chat.js). El adjunto lo lee
    // ctrl-almacen::readArchivo; aquí se empareja con el catálogo y el servidor lo
    // valida: solo entran ids que existen. El costo no se pide: una salida usa el
    // costo del producto. Lo que no está en el catálogo se reporta como faltante.
    const IA_MAX_CATALOGO  = 800;
    const IA_MAX_RENGLONES = 100;

    function askSalidaIA() {
        if (empty($_SESSION['company_id'])) return ['status' => 401, 'message' => 'Tu sesión expiró. Vuelve a entrar.'];

        if (!IaOllama::activo($this)) return ['status' => 403, 'message' => 'CoffeeIA está apagado. Se enciende en Administrador > CoffeeIA.'];

        $mensaje   = mb_substr(trim((string) ($_POST['mensaje'] ?? '')), 0, 4000);
        $adjuntos  = json_decode((string) ($_POST['adjuntos'] ?? '[]'), true);
        $historial = json_decode((string) ($_POST['historial'] ?? '[]'), true);
        $adjuntos  = is_array($adjuntos) ? $adjuntos : [];
        $historial = is_array($historial) ? $historial : [];

        if ($mensaje === '' && empty($adjuntos)) {
            return ['status' => 400, 'message' => 'Adjunta la foto de la nota o escríbeme qué sale.'];
        }

        $ia = IaOllama::desdeCredenciales($this);
        if ($ia === null) return ['status' => 503, 'message' => 'La IA no está configurada: falta la llave de Ollama.'];

        $catalogo = array_slice($this->qProductsForTransfer([$this->companiesId]), 0, self::IA_MAX_CATALOGO);

        // Sin esto la sesión queda bloqueada mientras el modelo piensa.
        session_write_close();
        set_time_limit(180);

        $r = $ia->chatJson($this->mensajesSalidaIA($mensaje, $adjuntos, $historial, $catalogo));
        if (!$r['ok']) return ['status' => 502, 'message' => $r['error']];

        return ['status' => 200] + $this->validarSalidaIA($r['data'], $catalogo);
    }

    private function mensajesSalidaIA($mensaje, $adjuntos, $historial, $catalogo) {
        $filas = array_map(function ($p) {
            return implode(' | ', array_map(function ($v) {
                $v = trim(str_replace(["\r", "\n", '|'], [' ', ' ', '/'], (string) $v));
                return $v === '' ? '-' : $v;
            }, [$p['id'], $p['sku'], $p['nombre'], $p['categoria']]));
        }, $catalogo);

        $sistema = implode("\n", [
            'Eres CoffeeIA y ayudas a capturar una SALIDA de mercancía del almacén (merma, caducidad, consumo interno, surtido). Hablas español, en frases cortas.',
            'Te llega lo que sale: la transcripción de una foto (nota, hoja de merma, lista o ticket), un Excel o lo que la persona escribe.',
            'Por cada renglón con un producto, búscalo en el CATÁLOGO por nombre, SKU o clave, aunque venga abreviado o escrito distinto.',
            '- Si corresponde a un producto del catálogo va en "items", con el "id" del catálogo y en "ref" el texto del renglón.',
            '- Si NO está en el catálogo va en "missing", con el nombre como aparece en el documento.',
            '- Si la persona solo pregunta o no hay productos, "items" y "missing" van vacíos y contestas en "reply".',
            '- No inventes productos ni cantidades. Un renglón que no se lee no se pone.',
            '- Si un producto aparece varias veces, pon un renglón por cada vez que aparece, con su propia cantidad. No las sumes.',
            '- "quantity": cantidad que sale, como número. Si no se ve, 1.',
            '- No pongas costos: la salida usa el costo registrado del producto.',
            '- Como mucho ' . self::IA_MAX_RENGLONES . ' renglones entre "items" y "missing".',
            '',
            'Responde SOLO con un objeto JSON, sin texto antes ni después. La forma:',
            '{"reply": "Encontré 5 productos; 1 no está en el catálogo.", "items": [{"id": 45, "ref": "COCA COLA 600", "quantity": 12}], "missing": [{"name": "Salsa Valentina 1 L", "quantity": 3}]}',
            '',
            'CATÁLOGO (id | sku | nombre | categoría):',
            empty($filas) ? '(vacío)' : implode("\n", $filas)
        ]);

        $mensajes = [['role' => 'system', 'content' => $sistema]];

        foreach (array_slice($historial, -8) as $h) {
            $rol   = is_array($h) ? ($h['role'] ?? '') : '';
            $texto = is_array($h) ? mb_substr(trim((string) ($h['content'] ?? '')), 0, 3000) : '';
            if (($rol === 'user' || $rol === 'assistant') && $texto !== '') $mensajes[] = ['role' => $rol, 'content' => $texto];
        }

        $pregunta = 'MENSAJE: ' . ($mensaje !== '' ? $mensaje : '(sin texto: solo adjuntó archivos)');
        $cupo     = 60000;

        foreach (array_slice($adjuntos, 0, 3) as $a) {
            $texto = is_array($a) ? mb_substr(trim((string) ($a['texto'] ?? '')), 0, min(30000, $cupo)) : '';
            if ($texto === '') continue;

            $cupo     -= mb_strlen($texto);
            $pregunta .= "\n\nARCHIVO «" . $this->textoSalidaIA($a['nombre'] ?? 'archivo') . "»:\n" . $texto;
            if ($cupo <= 0) break;
        }

        $mensajes[] = ['role' => 'user', 'content' => $pregunta];

        return $mensajes;
    }

    // Vista previa del chat: "add" = producto del catálogo; "missing" = no está y no
    // se puede sacar (se enseña para revisarlo, sin casilla). Un id que no existe no
    // entra como "add": pasa a faltante con su texto. Un producto repetido en la nota
    // queda en renglones separados.
    private function validarSalidaIA($data, $catalogo) {
        $porId   = array_column($catalogo, null, 'id');
        $items   = [];
        $missing = [];

        foreach (array_slice(is_array($data['items'] ?? null) ? $data['items'] : [], 0, self::IA_MAX_RENGLONES) as $it) {
            if (!is_array($it)) continue;

            $id  = (int) ($it['id'] ?? 0);
            $qty = $this->numeroSalidaIA($it['quantity'] ?? null);
            $qty = $qty > 0 ? $qty : 1;

            if (!isset($porId[$id])) {
                $nombre = $this->textoSalidaIA($it['ref'] ?? '');
                if ($nombre !== '') $missing[] = ['nombre' => $nombre, 'cantidad' => $qty];
                continue;
            }

            $items[] = ['id' => (string) $id, 'nombre' => $porId[$id]['nombre'], 'cantidad' => $qty];
        }

        foreach (array_slice(is_array($data['missing'] ?? null) ? $data['missing'] : [], 0, self::IA_MAX_RENGLONES) as $m) {
            $nombre = is_array($m) ? $this->textoSalidaIA($m['name'] ?? '') : '';
            if ($nombre === '') continue;

            $qty       = $this->numeroSalidaIA($m['quantity'] ?? null);
            $missing[] = ['nombre' => $nombre, 'cantidad' => $qty > 0 ? $qty : 1];
        }

        $row = [];

        foreach ($items as $it) {
            $row[] = [
                'idx'        => count($row),
                'action'     => 'add',
                'valid'      => true,
                'name'       => $it['nombre'],
                'sku'        => $porId[$it['id']]['sku'] ?? '',
                'changes'    => [['label' => 'Cantidad', 'after' => (string) $it['cantidad']]],
                'product_id' => $it['id'],
                'cantidad'   => $it['cantidad']
            ];
        }

        foreach ($missing as $m) {
            $row[] = [
                'idx'      => count($row),
                'action'   => 'missing',
                'valid'    => false,
                'name'     => $m['nombre'],
                'note'     => 'No está en el catálogo: no se puede sacar (' . $m['cantidad'] . ').',
                'cantidad' => $m['cantidad']
            ];
        }

        $reply = $this->textoSalidaIA($data['reply'] ?? '');
        if ($reply === '') {
            $reply = empty($row)
                ? 'No encontré productos que sacar.'
                : count($items) . ' en el catálogo' . (count($missing) ? '; ' . count($missing) . ' no están.' : '.');
        }

        return [
            'reply' => $reply,
            'token' => empty($items) ? '' : bin2hex(random_bytes(8)),
            'row'   => $row
        ];
    }

    // Número o texto numérico ("1,250.5"). null si no hay número o es negativo.
    private function numeroSalidaIA($v) {
        if (is_int($v) || is_float($v)) return $v >= 0 ? round((float) $v, 4) : null;
        $v = str_replace(['$', ',', ' '], '', (string) $v);
        return is_numeric($v) && (float) $v >= 0 ? round((float) $v, 4) : null;
    }

    private function textoSalidaIA($v) {
        return mb_substr(trim(strip_tags(is_string($v) ? $v : '')), 0, 200);
    }

    // Los mismos filtros para las cards y para su desglose.
    private function kpiFilters() {
        return [
            'companies_id'    => $this->companiesId,
            'branch_id'       => $_POST['branch_id'] ?? '',
            'reason_id'       => $_POST['reason_id']       ?? '',
            'status'          => $_POST['status']          ?? '',
            'fi'              => $_POST['fi']              ?? '',
            'ff'              => $_POST['ff']              ?? ''
        ];
    }

    private function kpiRowsByReason($filters) {
        $reasons = $this->listSalidasByReason($filters);
        $total   = array_sum(array_column($reasons, 'total_salidas'));

        $row = [];
        foreach ($reasons as $key => $reason) {
            $row[] = [
                'id'             => $key + 1,
                'Tipo de salida' => badge($reason['reason_name'] ?: 'Sin tipo', $reason['reason_color'] ?: '#9CA3AF', 100, $reason['reason_bg'] ?? null, $reason['reason_icon'] ?? null),
                'Registros'      => (int) $reason['total_salidas'],
                'Unidades'       => kpiQuantity($reason['total_unidades']),
                'Valor'          => evaluar((float) $reason['total_costo']),
                'Participación'  => kpiPercent($reason['total_salidas'], $total)
            ];
        }

        if ($row) {
            $row[] = kpiTotalRow([
                'Tipo de salida' => 'Total',
                'Registros'      => $total,
                'Unidades'       => kpiQuantity(array_sum(array_column($reasons, 'total_unidades'))),
                'Valor'          => evaluar(array_sum(array_column($reasons, 'total_costo'))),
                'Participación'  => kpiPercent($total, $total)
            ]);
        }
        return $row;
    }

    private function kpiRowsByProduct($filters, $order) {
        $products = $this->listSalidaProducts(array_merge($filters, ['order' => $order]));
        $field    = $order === 'units' ? 'total_unidades' : 'total_costo';
        $total    = array_sum(array_column($products, $field));

        $row = [];
        foreach ($products as $key => $product) {
            $cells = [
                'id'       => $key + 1,
                'Producto' => kpiProduct($product['product_name'], $product['sku']),
                'Unidad'   => $product['unit'] ?: '-',
                'Cantidad' => kpiQuantity($product['total_unidades'])
            ];
            if ($order === 'cost') $cells['Valor'] = evaluar((float) $product['total_costo']);
            $cells['Participación'] = kpiPercent($product[$field], $total);
            $row[] = $cells;
        }

        if ($row) {
            $totals = [
                'Producto' => 'Total',
                'Unidad'   => '',
                'Cantidad' => kpiQuantity(array_sum(array_column($products, 'total_unidades')))
            ];
            if ($order === 'cost') $totals['Valor'] = evaluar($total);
            $totals['Participación'] = kpiPercent($total, $total);
            $row[] = kpiTotalRow($totals);
        }
        return $row;
    }

    // Como la card: las canceladas del periodo, sin importar el filtro de estado.
    private function kpiRowsCancelled($filters) {
        $salidas = $this->qSalidas(array_merge($filters, ['status' => 'Cancelada']));

        $row = [];
        foreach ($salidas as $salida) {
            $row[] = [
                'id'             => $salida['id'],
                'Folio'          => $salida['folio'],
                'Fecha'          => fechaHoraSalida($salida['created_at']),
                'Tipo de salida' => badge($salida['reason_name'], $salida['reason_color'], 100, $salida['reason_bg'] ?? null, $salida['reason_icon'] ?? null),
                'Sucursal'       => $salida['branch_name'] ?: '-',
                'Unidades'       => kpiQuantity($salida['total_units']),
                'Valor'          => evaluar((float) $salida['total_cost_loss'])
            ];
        }

        if ($row) {
            $row[] = kpiTotalRow([
                'Folio'          => 'Total',
                'Fecha'          => '',
                'Tipo de salida' => '',
                'Sucursal'       => '',
                'Unidades'       => kpiQuantity(array_sum(array_column($salidas, 'total_units'))),
                'Valor'          => evaluar(array_sum(array_column($salidas, 'total_cost_loss')))
            ]);
        }
        return $row;
    }
}

// Folio que abre el visor, igual que el ojo (y que el folio de Entradas).
function renderFolioLink($folio, $id) {
    $label = htmlspecialchars($folio, ENT_QUOTES);
    return "<a href='#' onclick=\"salidas.getSalida(" . (int) $id . "); return false;\""
         . " class='font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-700' title='Ver detalle de la salida'>{$label}</a>";
}

// 20/SEP/2026 10:00 AM. El mes va de una lista fija: strftime depende del locale
// del servidor y está obsoleto desde PHP 8.1.
function fechaHoraSalida($fecha) {
    $ts = strtotime((string) $fecha);
    if (!$ts) return '-';
    $meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    return date('d', $ts) . '/' . $meses[(int) date('n', $ts) - 1] . '/' . date('Y h:i A', $ts);
}

function statusBadge($status) {
    // [color de texto, color de fondo] - modelo pastel de 2 colores (igual que los motivos).
    $map = [
        'Aplicada'  => ['#16A34A', '#DCFCE7'],
        'Aplicado'  => ['#16A34A', '#DCFCE7'],
        'Pendiente' => ['#D97706', '#FEF3C7'],
        'Cancelada' => ['#DC2626', '#FEE2E2'],
        'Revertida' => ['#DC2626', '#FEE2E2']
    ];
    $c = $map[$status] ?? ['#475569', '#F1F5F9'];
    return badge(strtoupper($status), $c[0], 100, $c[1]);
}

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
echo json_encode($obj->{$opc}());
