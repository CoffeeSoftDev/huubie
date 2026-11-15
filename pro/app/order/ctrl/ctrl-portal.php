<?php
/*  Portal del cliente: lo que llama el enlace publico (portal.php).

    SIN sesion: no pasa por _Session.php ni por Permission::dispatch. Solo
    responde dos opc, por lista blanca:
      getPortal   lo que debe el cliente en la sucursal del enlace y sus comprobantes.
      addReceipt  sube un comprobante (foto o PDF) para revision.

    Reglas que no se ven en el codigo de un vistazo:
      - El token (32 hex) es lo unico que identifica al cliente. Token que no
        existe, que ya se cambio, cliente inactivo o sucursal inactiva: 404 sin
        decir cual.
      - Subir un comprobante NO abona nada: queda en revision hasta que alguien
        de la tienda lo abona o lo rechaza en Clientes › Comprobantes.
      - El monto no pasa de lo que debe (mas la cotizacion elegida, si eligio
        una): un error de dedo no debe llegar a revision.
      - El archivo se acepta por su contenido (firma de PDF o imagen JPG, PNG o
        WEBP), no por su nombre ni por lo que diga el navegador. Se guarda con
        un nombre al azar fuera de la web (mdl-portal, receiptDir).
      - Limites: 10 envios por hora por conexion y 3 en revision por cliente.
      - created_at se escribe con la hora de PHP: es la que compara el limite. */

// Un envio mas pesado que post_max_size llega sin $_POST ni $_FILES: se avisa antes de salir.
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && empty($_POST) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    header('Content-Type: application/json; charset=utf-8');
    exit(json_encode(['status' => 413, 'message' => 'El archivo pesa demasiado. Sube una foto o un PDF más ligero.'], JSON_UNESCAPED_UNICODE));
}

if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/../mdl/mdl-order.php';
require_once __DIR__ . '/../mdl/mdl-portal.php';

class PublicPortal extends mdl {

    use CustomerPortal;

    const ACCENT       = '#233876';
    const MAX_BYTES    = 5242880;   // 5 MB
    const MAX_AMOUNT   = 1000000;
    const MAX_NOTE     = 255;
    const MAX_FILENAME = 150;
    const LIST_MAX     = 20;
    const PER_IP       = 10;
    const PER_CUSTOMER = 3;

    public function run($opc) {
        try {
            if ($opc === 'getPortal')  return $this->getPortal();
            if ($opc === 'addReceipt') return $this->addReceipt();

            return $this->fail(400, 'Solicitud no válida.');
        } catch (Throwable $e) {
            $this->writeToLog('[ PORTAL CLIENTES ] :: ' . $e->getMessage());

            return $this->fail(500, 'No pudimos procesar tu solicitud. Intenta de nuevo en un momento.');
        }
    }

    // -- Portal --

    public function getPortal() {
        $portal = $this->portalFromToken();
        if (isset($portal['status'])) return $portal;

        return $this->view($portal);
    }

    // -- Comprobante --

    public function addReceipt() {
        $portal = $this->portalFromToken();
        if (isset($portal['status'])) return $portal;

        // Campo trampa: una persona no lo ve; un robot lo llena.
        if ($this->post('website') !== '') return $this->fail(400, 'No se pudo enviar el comprobante.');

        $customer = (int) $portal['customer_id'];
        $branch   = (int) $portal['branch_id'];
        $ip       = substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
        $ip       = $ip !== '' ? $ip : '-';

        if ($this->qReceiptsFromIp($ip, date('Y-m-d H:i:s', strtotime('-1 hour'))) >= self::PER_IP) {
            return $this->fail(429, 'Recibimos muchos comprobantes desde tu conexión en la última hora. Intenta más tarde o mándalo por WhatsApp.');
        }

        if ($this->qPendingReceipts($customer, $branch) >= self::PER_CUSTOMER) {
            return $this->fail(429, 'Ya tienes ' . self::PER_CUSTOMER . ' comprobantes en revisión. Cuando la tienda los revise podrás mandar otro.');
        }

        $in = $this->receiptInput($customer, $branch);
        if (isset($in['status'])) return $in;

        $file = $this->uploadedFile();
        if (isset($file['status'])) return $file;

        $dir = $this->receiptDir($branch);

        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('addReceipt: no se pudo crear la carpeta de la sucursal ' . $branch);
        }

        $name = bin2hex(random_bytes(16)) . '.' . $file['ext'];
        $path = $dir . '/' . $name;

        if (!move_uploaded_file($file['tmp'], $path)) throw new RuntimeException('addReceipt: no se pudo guardar el archivo');

        $now = date('Y-m-d H:i:s');

        try {
            $id = $this->transaction(function () use ($customer, $branch, $in, $file, $name, $ip, $now) {
                $this->must($this->qCreateReceipt([
                    'values' => ['customer_id', 'branch_id', 'sale_id', 'amount', 'note', 'file', 'file_name', 'mime', 'size', 'status', 'ip', 'created_at', 'updated_at'],
                    'data'   => [$customer, $branch, $in['sale_id'], $in['amount'], $in['note'], $branch . '/' . $name, $file['name'], $file['mime'], $file['size'], 'pending', $ip, $now, $now]
                ]), 'addReceipt');

                $id = $this->qLastInsertId();
                if ($id <= 0) throw new RuntimeException('addReceipt: sin id');

                return $id;
            });
        } catch (Throwable $e) {
            @unlink($path);
            throw $e;
        }

        $answer = $this->view($portal, 'Recibimos tu comprobante ' . $this->receiptFolio($id) . '. Aquí verás cuando la tienda lo revise.');
        $answer['receipt'] = $this->receiptFolio($id);

        return $answer;
    }

    // -- Vista --

    // Todo lo que pinta portal.js. $message: el aviso de un envio que acaba de llegar.
    private function view($portal, $message = null) {
        $customer = (int) $portal['customer_id'];
        $branch   = (int) $portal['branch_id'];
        $debts    = $this->portalDebts($customer, $branch, date('Y-m-d'));
        $pending  = $this->qPendingReceipts($customer, $branch);
        $answer   = [
            'status'    => 200,
            'portal'    => $this->portalInfo($portal),
            'items'     => array_map(fn ($sale) => $this->saleView($sale), $debts['items']),
            'quotes'    => array_map(fn ($sale) => $this->saleView($sale), $debts['quotes']),
            'debt'      => $debts['debt'],
            'receipts'  => array_map(fn ($row) => $this->receiptView($row), $this->qPortalReceipts($customer, $branch, self::LIST_MAX)),
            'pending'   => $pending,
            'can_send'  => $pending < self::PER_CUSTOMER,
            'per_customer' => self::PER_CUSTOMER,
            'max_bytes' => $this->maxBytes()
        ];

        if ($message !== null) $answer['message'] = $message;

        return $answer;
    }

    // Lo publico de la tienda y del cliente: solo su primer nombre.
    private function portalInfo($p) {
        $logo  = trim((string) $p['branch_logo']) !== '' ? $p['branch_logo'] : $p['company_logo'];
        $name  = trim((string) $p['customer']);
        $first = $name !== '' ? (string) preg_split('/\s+/u', $name)[0] : '';

        return [
            'title'     => trim((string) $p['title']) !== '' ? trim($p['title']) : (trim((string) $p['company']) !== '' ? trim($p['company']) : trim((string) $p['branch'])),
            'branch'    => trim((string) $p['branch']),
            'address'   => trim((string) $p['address']),
            'logo'      => $this->fileUrl($logo),
            'accent'    => preg_match('/^#[0-9A-F]{6}$/i', (string) $p['accent']) ? strtoupper($p['accent']) : self::ACCENT,
            'whatsapp'  => preg_match('/^\d{10}$/', (string) $p['whatsapp']) ? (string) $p['whatsapp'] : '',
            'bank_info' => trim((string) $p['bank_info']),
            'customer'  => $first
        ];
    }

    private function saleView($s) {
        $credit = $s['kind'] === 'credit';
        $when   = $credit
                ? 'Compra del ' . $this->dayText($s['date'])
                : ($s['date'] !== '' ? 'Entrega el ' . $this->dayText($s['date']) . ($s['time'] !== '' ? ' a las ' . $this->hour12($s['time']) : '') : 'Sin fecha de entrega');

        return [
            'id'    => $s['id'],
            'kind'  => $s['kind'],
            'folio' => $s['folio'],
            'title' => $credit ? 'Compra a crédito' : 'Pedido',
            'when'  => $when,
            'total' => $s['total'],
            'paid'  => $s['paid'],
            'left'  => $s['left']
        ];
    }

    private function receiptView($r) {
        return [
            'id'       => (int) $r['id'],
            'folio'    => $this->receiptFolio($r['id']),
            'target'   => $this->receiptTarget($r['sale_id'], $r['sale_type_id']),
            'amount'   => round((float) $r['amount'], 2),
            'applied'  => $r['applied_amount'] !== null ? round((float) $r['applied_amount'], 2) : null,
            'status'   => (string) $r['status'],
            'reason'   => (string) $r['reject_reason'],
            'note'     => (string) $r['note'],
            'kind'     => (string) $r['mime'] === 'application/pdf' ? 'pdf' : 'image',
            'sent'     => $this->stamp($r['created_at']),
            'reviewed' => $r['reviewed_at'] ? $this->stamp($r['reviewed_at']) : ''
        ];
    }

    // -- Validacion --

    private function portalFromToken() {
        $token = $this->post('t');

        if (!preg_match('/^[a-f0-9]{32}$/', $token)) return $this->fail(404, 'Este enlace no es válido o ya se cambió. Pide el tuyo a la tienda.');

        $portal = $this->qPortalByToken($token);

        return $portal ?: $this->fail(404, 'Este enlace no es válido o ya se cambió. Pide el tuyo a la tienda.');
    }

    // [monto, folio o null, nota] contra lo que el cliente debe HOY en la sucursal.
    private function receiptInput($customer, $branch) {
        $amount = $this->amountOf($this->post('amount'));
        $raw    = $this->post('sale_id', '0');
        $saleId = preg_match('/^\d{1,10}$/', $raw) ? (int) $raw : -1;
        $note   = trim((string) preg_replace('/\s+/u', ' ', $this->post('note')));

        if ($saleId < 0)                                return $this->fail(422, 'Elige para qué es tu transferencia.');
        if ($amount === null || $amount <= 0)           return $this->fail(422, 'Escribe cuánto transferiste.');
        if ($amount > self::MAX_AMOUNT)                 return $this->fail(422, 'Revisa el monto que transferiste.');
        if (mb_strlen($note, 'UTF-8') > self::MAX_NOTE) return $this->fail(422, 'La nota admite hasta ' . self::MAX_NOTE . ' caracteres.');

        $debts = $this->portalDebts($customer, $branch, date('Y-m-d'));
        $quote = null;

        if ($saleId > 0) {
            $found = false;

            foreach ($debts['items'] as $sale) {
                if ($sale['id'] === $saleId) $found = true;
            }

            foreach ($debts['quotes'] as $sale) {
                if ($sale['id'] === $saleId) $quote = $sale;
            }

            if (!$found && !$quote) return $this->fail(409, 'Ese folio ya no tiene saldo pendiente. Recarga la página para ver lo que debes al día.');
        } elseif ($debts['debt'] <= 0.005) {
            return $this->fail(409, 'No tienes saldo pendiente en esta sucursal.');
        }

        // Lo mas que se puede mandar: lo que debe, mas la cotizacion si eligio una.
        $max = round($debts['debt'] + ($quote ? $quote['left'] : 0), 2);

        if ($amount > $max + 0.005) {
            return $this->fail(422, 'El monto pasa de lo que debes (' . $this->money($max) . '). Revísalo; si transferiste de más, escríbenos por WhatsApp.');
        }

        return ['amount' => $amount, 'sale_id' => $saleId > 0 ? $saleId : null, 'note' => $note === '' ? null : $note];
    }

    // El archivo de $_FILES['file'] ya revisado: [tmp, size, ext, mime, name] o el error para el cliente.
    private function uploadedFile() {
        $f    = $_FILES['file'] ?? null;
        $max  = $this->maxBytes();
        $big  = 'El archivo pesa demasiado. Sube una foto o un PDF de hasta ' . $this->sizeText($max) . '.';

        if (!is_array($f) || !isset($f['error']) || is_array($f['error'])) return $this->fail(422, 'Adjunta la foto o el PDF de tu transferencia.');

        $error = (int) $f['error'];

        if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) return $this->fail(413, $big);
        if ($error === UPLOAD_ERR_NO_FILE)                                    return $this->fail(422, 'Adjunta la foto o el PDF de tu transferencia.');
        if ($error === UPLOAD_ERR_PARTIAL)                                    return $this->fail(422, 'El archivo no terminó de subir. Intenta otra vez.');
        if ($error !== UPLOAD_ERR_OK)                                         throw new RuntimeException('addReceipt: error de subida ' . $error);

        $tmp  = (string) $f['tmp_name'];
        $size = (int) $f['size'];

        if (!is_uploaded_file($tmp)) return $this->fail(400, 'No se pudo leer el archivo. Intenta otra vez.');
        if ($size <= 0)              return $this->fail(422, 'El archivo está vacío.');
        if ($size > $max)            return $this->fail(413, $big);

        $ext = $this->fileKind($tmp);
        if ($ext === null) return $this->fail(415, 'Sube una foto (JPG, PNG o WEBP) o un PDF.');

        $types = $this->receiptTypes();

        return ['tmp' => $tmp, 'size' => $size, 'ext' => $ext, 'mime' => $types[$ext], 'name' => $this->cleanName((string) $f['name'], $ext)];
    }

    // jpg, png, webp o pdf segun los bytes del archivo. Null si no es ninguno.
    private function fileKind($tmp) {
        $head = (string) @file_get_contents($tmp, false, null, 0, 1024);

        if (strpos($head, '%PDF-') !== false) return 'pdf';

        $info = @getimagesize($tmp);
        if (!$info) return null;

        $map = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];

        return $map[$info[2]] ?? null;
    }

    // Solo para mostrarlo en la revision: el archivo se guarda con otro nombre.
    private function cleanName($name, $ext) {
        $name = basename(str_replace('\\', '/', $name));
        $name = trim((string) preg_replace('/[^\p{L}\p{N} ._()-]+/u', '', $name));

        if ($name === '' || $name === '.' || $name === '..') $name = 'comprobante.' . $ext;

        return mb_substr($name, 0, self::MAX_FILENAME, 'UTF-8');
    }

    // El limite real: 5 MB o menos si el servidor acepta menos.
    private function maxBytes() {
        $limit  = self::MAX_BYTES;
        $upload = $this->iniBytes((string) ini_get('upload_max_filesize'));
        $post   = $this->iniBytes((string) ini_get('post_max_size'));

        if ($upload > 0) $limit = min($limit, $upload);
        if ($post > 65536) $limit = min($limit, $post - 65536);   // el resto del formulario tambien viaja

        return $limit;
    }

    private function iniBytes($value) {
        $value = trim($value);
        if ($value === '') return 0;

        $unit = strtolower(substr($value, -1));
        $num  = (float) $value;

        if ($unit === 'g') return (int) ($num * 1073741824);
        if ($unit === 'm') return (int) ($num * 1048576);
        if ($unit === 'k') return (int) ($num * 1024);

        return (int) $num;
    }

    // -- Formato --

    // Rutas guardadas relativas a la raiz del sitio («pro_files/...», «alpha_files/...»).
    private function fileUrl($path) {
        $path = trim((string) $path);

        if ($path === '') return '';
        if (preg_match('#^https?://#i', $path)) return $path;

        return '/' . implode('/', array_map('rawurlencode', explode('/', ltrim($path, '/'))));
    }

    private function money($n) {
        return '$' . number_format(round((float) $n, 2), 2);
    }

    private function sizeText($bytes) {
        $mb = $bytes / 1048576;

        return ($mb >= 1 ? rtrim(rtrim(number_format($mb, 1), '0'), '.') . ' MB' : max(1, (int) round($bytes / 1024)) . ' KB');
    }

    private function hour12($time) {
        $stamp = strtotime('2000-01-01 ' . $time);

        return $stamp ? date('g:i A', $stamp) : '';
    }

    // «15/11/2026 · 4:32 PM»
    private function stamp($datetime) {
        $stamp = strtotime((string) $datetime);

        return $stamp ? date('d/m/Y', $stamp) . ' · ' . date('g:i A', $stamp) : '';
    }

    // «martes 17 de noviembre»; con el año si no es el de hoy.
    private function dayText($date) {
        $days   = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        $months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        $stamp  = strtotime((string) $date);

        if (!$stamp) return (string) $date;

        $text = $days[(int) date('w', $stamp)] . ' ' . date('j', $stamp) . ' de ' . $months[(int) date('n', $stamp) - 1];

        return date('Y', $stamp) === date('Y') ? $text : $text . ' de ' . date('Y', $stamp);
    }

    // -- Ayudantes --

    private function amountOf($raw) {
        $raw = str_replace(['$', ',', ' '], '', (string) $raw);

        if (!preg_match('/^\d{1,9}(\.\d{1,2})?$/', $raw)) return null;

        return round((float) $raw, 2);
    }

    private function post($key, $default = '') {
        return isset($_POST[$key]) ? trim((string) $_POST[$key]) : $default;
    }

    private function fail($status, $message) {
        return ['status' => $status, 'message' => $message];
    }

    private function must($result, $what) {
        if ($result !== true) {
            throw new RuntimeException($what . ': ' . (is_string($result) ? $result : 'sin respuesta de la base'));
        }

        return true;
    }
}

// -- Respuesta --

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    exit(json_encode(['status' => 405, 'message' => 'Solicitud no válida.']));
}

echo json_encode((new PublicPortal())->run((string) $_POST['opc']), JSON_UNESCAPED_UNICODE);
