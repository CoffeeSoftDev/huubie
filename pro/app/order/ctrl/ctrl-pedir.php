<?php
/*  V8 · Tienda en linea: lo que llama el enlace publico (pedir.php).

    SIN sesion: no pasa por _Session.php ni por Permission::dispatch. Solo
    responde dos opc, por lista blanca:
      getCatalog   la tienda del token con sus productos (in_catalog = 1).
      addWebOrder  el pedido del cliente.

    Reglas que no se ven en el codigo de un vistazo:
      - El token es lo unico que identifica la tienda. Token que no existe o
        sucursal inactiva: 404 sin decir cual de las dos.
      - Precio y nombre salen de la base, nunca del navegador. Solo productos
        que hoy estan en la tienda de esa sucursal.
      - El pedido es una venta tipo 4 (E-commerce) en Cotizacion, sin usuario y
        sin turno: no suma a ningun corte hasta que alguien lo acepta en
        Tienda en linea (ahi toma el turno abierto).
      - El cliente se busca por los ultimos 10 digitos del telefono en TODA la
        empresa; si no existe se crea. Su nombre guardado no se pisa: lo que
        escribio queda en online_order.
      - Limite: 10 pedidos por hora por IP y 5 por telefono en la sucursal.
      - Doble envio: el mismo telefono con el mismo total, fecha y numero de
        productos en menos de 3 minutos devuelve el pedido que ya llego.
      - online_order.created_at se escribe con la hora de PHP (la misma que usa
        la bandeja para filtrar), no con la de MySQL. */

if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/../mdl/mdl-order.php';
require_once __DIR__ . '/../mdl/mdl-tienda.php';

class PublicStore extends mdl {

    use OnlineStore;

    const WEB        = 4;    // sale_type E-commerce
    const QUOTE      = 1;    // sale_status Cotizacion
    const ACCENT     = '#233876';
    const MAX_LINES  = 60;
    const MAX_QTY    = 999;
    const MAX_NAME   = 120;
    const MAX_EMAIL  = 255;
    const MAX_PLACE  = 255;
    const MAX_NOTE   = 2000;
    const MAX_AHEAD  = 90;   // dias hacia adelante que se pueden pedir
    const PER_IP     = 10;
    const PER_PHONE  = 5;
    const AGAIN_MIN  = 3;    // minutos en que un envio repetido devuelve el mismo pedido

    public function run($opc) {
        try {
            if ($opc === 'getCatalog')  return $this->getCatalog();
            if ($opc === 'addWebOrder') return $this->addWebOrder();

            return $this->fail(400, 'Solicitud no válida.');
        } catch (Throwable $e) {
            $this->writeToLog('[ TIENDA PUBLICA ] :: ' . $e->getMessage());

            return $this->fail(500, 'No pudimos procesar tu solicitud. Intenta de nuevo en un momento.');
        }
    }

    // -- Catalogo --

    public function getCatalog() {
        $store = $this->storeFromToken();
        if (isset($store['status'])) return $store;

        $info = $this->storeInfo($store);

        if ((int) $store['active'] !== 1) {
            return ['status' => 200, 'open' => false, 'store' => $info, 'categories' => [], 'products' => []];
        }

        $categories = [];
        $products   = [];

        foreach ($this->products($store) as $p) {
            $key = (int) $p['category_id'];

            if (!isset($categories[$key])) {
                $categories[$key] = ['id' => $key, 'name' => trim((string) $p['category']) !== '' ? trim($p['category']) : 'Otros', 'count' => 0];
            }

            $categories[$key]['count']++;

            $products[] = [
                'id'          => (int) $p['id'],
                'name'        => trim((string) $p['name']),
                'description' => trim((string) $p['description']),
                'price'       => round((float) $p['price'], 2),
                'category_id' => $key,
                'image'       => $this->fileUrl($p['image'])
            ];
        }

        return [
            'status'     => 200,
            'open'       => true,
            'store'      => $info,
            'categories' => array_values($categories),
            'products'   => $products
        ];
    }

    // -- Pedido --

    public function addWebOrder() {
        $store = $this->storeFromToken();
        if (isset($store['status'])) return $store;

        if ((int) $store['active'] !== 1) return $this->fail(409, 'La tienda está cerrada por ahora. No se recibió tu pedido.');

        // Campo trampa: una persona no lo ve; un robot lo llena.
        if ($this->post('website') !== '') return $this->fail(400, 'No se pudo enviar el pedido.');

        $in = $this->orderInput($store);
        if (isset($in['status'])) return $in;

        $lines = $this->resolveLines($store, $in['lines']);
        if (isset($lines['status'])) return $lines;

        $total   = $this->linesTotal($lines);
        $branch  = (int) $store['branch_id'];
        $ip      = substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
        $hourAgo = date('Y-m-d H:i:s', strtotime('-1 hour'));

        $again = $this->qRecentWebOrder($branch, $in['phone'], date('Y-m-d H:i:s', strtotime('-' . self::AGAIN_MIN . ' minutes')));

        if ($again
            && round((float) $again['total'], 2) === $total
            && (string) $again['delivery_date'] === $in['date']
            && (int) $again['lines_count'] === count($lines)) {
            return $this->answer($store, (int) $again['id'], $in, $lines, $total);
        }

        if ($ip !== '' && $this->qOrdersFromIp($ip, $hourAgo) >= self::PER_IP) {
            return $this->fail(429, 'Recibimos muchos pedidos desde tu conexión en la última hora. Escríbenos por WhatsApp para terminar tu pedido.');
        }

        if ($this->qOrdersFromPhone($branch, $in['phone'], $hourAgo) >= self::PER_PHONE) {
            return $this->fail(429, 'Ya recibimos varios pedidos con ese teléfono en la última hora. Escríbenos por WhatsApp si necesitas cambiar algo.');
        }

        $id = $this->transaction(function () use ($store, $in, $lines, $total, $branch, $ip) {
            $customerId = $this->customerFor($branch, $in);

            $this->must($this->qCreateOrder([
                'values' => [
                    'branch_id', 'customer_id', 'user_id', 'turn_id', 'sale_type_id', 'sale_status_id',
                    'delivery_method', 'delivery_status', 'delivery_date', 'delivery_time', 'location', 'note',
                    'subtotal', 'discount_amount', 'total', 'active'
                ],
                'data' => [
                    $branch, $customerId, null, null, self::WEB, self::QUOTE,
                    $in['delivery'] === 'delivery' ? 1 : 0, 0, $in['date'], $in['time'], $in['address'], $in['note'],
                    $total, 0, $total, 1
                ]
            ]), 'addWebOrder');

            $id = $this->qLastInsertId();
            if ($id <= 0) throw new RuntimeException('addWebOrder: sin id');

            $this->must($this->qUpdateOrder(['values' => ['folio'], 'where' => ['id'], 'data' => [(string) $id, $id]]), 'addWebOrder folio');

            foreach ($lines as $line) {
                $this->must($this->qCreateLine([
                    'values' => ['sale_id', 'product_id', 'name', 'price', 'quantity', 'details', 'dedication', 'active'],
                    'data'   => [$id, $line['product_id'], $line['name'], $line['price'], $line['quantity'], null, null, 1]
                ]), 'addWebOrder linea');
            }

            $this->must($this->qCreateWebOrder([
                'values' => ['sale_id', 'branch_id', 'customer_name', 'phone', 'email', 'delivery', 'payment', 'ip', 'created_at'],
                'data'   => [$id, $branch, $in['name'], $in['phone'], $in['email'], $in['delivery'], $in['payment'], $ip, date('Y-m-d H:i:s')]
            ]), 'addWebOrder origen');

            $count = count($lines);
            $text  = 'Pedido recibido por la tienda en línea a nombre de ' . $in['name'] . ' (' . $in['phone'] . ') — total '
                   . $this->money($total) . ', ' . ($count === 1 ? '1 producto' : "{$count} productos")
                   . '. ' . $this->deliveryText($in['delivery']) . ', ' . $this->paymentText($in['payment']) . '.';

            $this->must($this->qCreateHistory([
                'values' => ['sale_id', 'user_id', 'type', 'title', 'action', 'detail', 'active'],
                'data'   => [$id, null, 'event', 'Pedido en línea', mb_substr($text, 0, 255, 'UTF-8'), $text, 1]
            ]), 'addWebOrder bitacora');

            return $id;
        });

        return $this->answer($store, $id, $in, $lines, $total);
    }

    // Lo que ve el cliente al terminar: resumen, datos para transferir y el WhatsApp de la tienda.
    private function answer($store, $id, $in, $lines, $total) {
        $folio = 'P' . $id;
        $when  = $this->longDate($in['date']) . ' a las ' . $this->hour12($in['time']);
        $place = $in['delivery'] === 'delivery' ? 'Envío a ' . $in['address'] : 'Recojo en tienda';
        $wa    = '';

        if (preg_match('/^\d{10}$/', (string) $store['whatsapp'])) {
            $text = "Hola, acabo de hacer el pedido {$folio} en su tienda en línea.\n"
                  . "A nombre de: {$in['name']}\n"
                  . "Entrega: {$place}, {$when}\n"
                  . 'Pago: ' . $this->paymentText($in['payment']) . "\n"
                  . 'Total: ' . $this->money($total);

            $wa = 'https://wa.me/52' . $store['whatsapp'] . '?text=' . rawurlencode($text);
        }

        return [
            'status'  => 200,
            'message' => 'Pedido enviado.',
            'order'   => [
                'folio'     => $folio,
                'name'      => $in['name'],
                'delivery'  => $in['delivery'],
                'address'   => $in['delivery'] === 'delivery' ? $in['address'] : trim((string) $store['address']),
                'when'      => $when,
                'payment'   => $in['payment'],
                'total'     => $total,
                'lines'     => array_map(fn ($l) => [
                    'name'     => $l['name'],
                    'quantity' => $l['quantity'],
                    'amount'   => round($l['price'] * $l['quantity'], 2)
                ], $lines),
                'bank_info' => $in['payment'] === 'transfer' ? (string) $store['bank_info'] : '',
                'wa'        => $wa
            ]
        ];
    }

    // -- Validacion --

    private function storeFromToken() {
        $token = $this->post('t');

        if (!preg_match('/^[a-f0-9]{16}$/', $token)) return $this->fail(404, 'Este enlace no es válido.');

        $store = $this->qStoreByToken($token);

        return $store ?: $this->fail(404, 'Este enlace no es válido.');
    }

    private function orderInput($store) {
        $name     = trim((string) preg_replace('/\s+/u', ' ', $this->post('name')));
        $phone    = preg_replace('/\D/', '', $this->post('phone'));
        $email    = strtolower(trim($this->post('email')));
        $delivery = $this->post('delivery');
        $payment  = $this->post('payment');
        $date     = $this->post('date');
        $time     = $this->post('time');
        $address  = trim((string) preg_replace('/\s+/u', ' ', $this->post('address')));
        $note     = trim(str_replace("\r", '', $this->post('note')));
        $lines    = json_decode($this->post('lines'), true);

        // «52» o «521» delante (lada de Mexico) se quitan: se guardan 10 digitos.
        if (strlen($phone) > 10 && preg_match('/^521?(\d{10})$/', $phone, $m)) $phone = $m[1];

        if (mb_strlen($name, 'UTF-8') < 2)                 return $this->fail(422, 'Escribe tu nombre.');
        if (mb_strlen($name, 'UTF-8') > self::MAX_NAME)    return $this->fail(422, 'Tu nombre admite hasta ' . self::MAX_NAME . ' caracteres.');
        if (strlen($phone) !== 10)                         return $this->fail(422, 'Tu teléfono va a 10 dígitos.');
        if ($email !== '' && (strlen($email) > self::MAX_EMAIL || !filter_var($email, FILTER_VALIDATE_EMAIL))) {
            return $this->fail(422, 'Revisa tu correo, o déjalo vacío.');
        }

        $ways = ['pickup' => (int) $store['pickup'] === 1, 'delivery' => (int) $store['delivery'] === 1];
        $pays = ['store' => (int) $store['pay_store'] === 1, 'transfer' => (int) $store['pay_transfer'] === 1];

        if (empty($ways[$delivery])) return $this->fail(422, 'Elige cómo quieres recibir tu pedido.');
        if (empty($pays[$payment]))  return $this->fail(422, 'Elige cómo quieres pagar.');

        $day = DateTime::createFromFormat('!Y-m-d', $date);

        if (!$day || $day->format('Y-m-d') !== $date) return $this->fail(422, 'Elige la fecha de entrega.');

        $first = date('Y-m-d', strtotime('+' . (int) $store['lead_days'] . ' days'));
        $last  = date('Y-m-d', strtotime('+' . self::MAX_AHEAD . ' days'));

        if ($date < $first) {
            $lead = (int) $store['lead_days'];

            return $this->fail(422, $lead === 0
                ? 'La fecha de entrega no puede ser anterior a hoy.'
                : 'Pedimos ' . ($lead === 1 ? '1 día' : "{$lead} días") . ' de anticipación: la primera fecha disponible es el ' . $this->longDate($first) . '.');
        }

        if ($date > $last) return $this->fail(422, 'Recibimos pedidos hasta con ' . self::MAX_AHEAD . ' días de anticipación.');

        if (!preg_match('/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/', $time, $t)) return $this->fail(422, 'Elige la hora de entrega.');

        $time = $t[1] . ':' . $t[2] . ':00';

        if ($date === date('Y-m-d') && $time <= date('H:i:s')) return $this->fail(422, 'Para hoy, elige una hora más tarde que la actual.');

        if ($delivery === 'delivery' && $address === '')               return $this->fail(422, 'Escribe la dirección de entrega.');
        if (mb_strlen($address, 'UTF-8') > self::MAX_PLACE)            return $this->fail(422, 'La dirección admite hasta ' . self::MAX_PLACE . ' caracteres.');
        if (mb_strlen($note, 'UTF-8') > self::MAX_NOTE)                return $this->fail(422, 'La nota admite hasta 2,000 caracteres.');
        if (!is_array($lines) || count($lines) === 0)                  return $this->fail(422, 'Tu carrito está vacío.');
        if (count($lines) > self::MAX_LINES)                           return $this->fail(422, 'Un pedido admite hasta ' . self::MAX_LINES . ' productos distintos.');

        return [
            'name'     => $name,
            'phone'    => $phone,
            'email'    => $email === '' ? null : $email,
            'delivery' => $delivery,
            'payment'  => $payment,
            'date'     => $date,
            'time'     => $time,
            'address'  => $delivery === 'delivery' ? $address : null,
            'note'     => $note === '' ? null : $note,
            'lines'    => array_values($lines)
        ];
    }

    // Cada renglon del carrito contra lo que hoy sale en la tienda. Repetidos se suman.
    private function resolveLines($store, array $raw) {
        $catalog = [];

        foreach ($this->products($store) as $p) $catalog[(int) $p['id']] = $p;

        $merged = [];

        foreach ($raw as $item) {
            $id  = is_array($item) && isset($item['id']) ? (int) $item['id'] : 0;
            $qty = is_array($item) && isset($item['qty']) ? $item['qty'] : null;

            if ($id <= 0 || !preg_match('/^\d{1,3}$/', (string) $qty) || (int) $qty < 1) {
                return $this->fail(422, 'Revisa las cantidades de tu carrito.');
            }

            if (!isset($catalog[$id])) {
                return $this->fail(409, 'Un producto de tu carrito ya no está disponible. Recarga la página para ver la tienda al día.');
            }

            $merged[$id] = ($merged[$id] ?? 0) + (int) $qty;
        }

        $lines = [];

        foreach ($merged as $id => $qty) {
            if ($qty > self::MAX_QTY) return $this->fail(422, 'Pide hasta ' . self::MAX_QTY . ' piezas de un mismo producto.');

            $lines[] = [
                'product_id' => $id,
                'name'       => trim((string) $catalog[$id]['name']),
                'price'      => round((float) $catalog[$id]['price'], 2),
                'quantity'   => $qty
            ];
        }

        return $lines;
    }

    // El cliente de la empresa con ese telefono, o uno nuevo.
    private function customerFor($branch, $in) {
        $found = $this->qStoreCustomer($branch, $in['phone']);

        if ($found) return (int) $found['id'];

        $this->must($this->qCreateCustomer([
            'values' => ['name', 'phone', 'email', 'branch_id', 'active'],
            'data'   => [$in['name'], $in['phone'], $in['email'], $branch, 1]
        ]), 'addWebOrder cliente');

        $id = $this->qLastInsertId();
        if ($id <= 0) throw new RuntimeException('addWebOrder: cliente sin id');

        return $id;
    }

    // -- Consultas --

    private function products($store) {
        $company = (int) $store['company_id'];
        $branch  = (int) $store['branch_id'];
        $main    = $this->qFirstBranch($company);

        return $this->qStoreProducts($company, $branch, $main ? (int) $main['id'] : $branch, true);
    }

    // El ultimo pedido de ese telefono desde $since, con lo que se compara un envio repetido.
    private function qRecentWebOrder($branchId, $phone, $since) {
        return $this->qRow("
            SELECT
                s.id,
                s.total,
                s.delivery_date,
                (
                    SELECT COUNT(*)
                    FROM {$this->pos}detail_sale d
                    WHERE d.sale_id = s.id
                        AND IFNULL(d.active, 1) = 1
                ) AS lines_count
            FROM {$this->pos}online_order o
            INNER JOIN {$this->pos}sale s ON s.id = o.sale_id
            WHERE o.branch_id = ?
                AND o.phone = ?
                AND o.created_at >= ?
                AND IFNULL(s.active, 1) = 1
            ORDER BY o.id DESC
            LIMIT 1
        ", [$branchId, $phone, $since]);
    }

    // -- Formato --

    // Lo publico de la tienda. Los datos bancarios solo salen al terminar un pedido con transferencia.
    private function storeInfo($s) {
        $first = date('Y-m-d', strtotime('+' . (int) $s['lead_days'] . ' days'));
        $logo  = trim((string) $s['branch_logo']) !== '' ? $s['branch_logo'] : $s['company_logo'];

        return [
            'title'        => trim((string) $s['title']) !== '' ? trim($s['title']) : (trim((string) $s['company']) !== '' ? trim($s['company']) : trim((string) $s['branch'])),
            'message'      => trim((string) $s['message']),
            'branch'       => trim((string) $s['branch']),
            'company'      => trim((string) $s['company']),
            'address'      => trim((string) $s['address']),
            'logo'         => $this->fileUrl($logo),
            'accent'       => preg_match('/^#[0-9A-F]{6}$/i', (string) $s['accent']) ? strtoupper($s['accent']) : self::ACCENT,
            'whatsapp'     => preg_match('/^\d{10}$/', (string) $s['whatsapp']) ? (string) $s['whatsapp'] : '',
            'pickup'       => (int) $s['pickup'] === 1,
            'delivery'     => (int) $s['delivery'] === 1,
            'pay_store'    => (int) $s['pay_store'] === 1,
            'pay_transfer' => (int) $s['pay_transfer'] === 1,
            'lead_days'    => (int) $s['lead_days'],
            'min_date'     => $first,
            'max_date'     => date('Y-m-d', strtotime('+' . self::MAX_AHEAD . ' days')),
            'today'        => date('Y-m-d'),
            'now'          => date('H:i')
        ];
    }

    // Rutas guardadas relativas a la raiz del sitio («pro_files/...», «alpha_files/...»).
    private function fileUrl($path) {
        $path = trim((string) $path);

        if ($path === '') return '';
        if (preg_match('#^https?://#i', $path)) return $path;

        return '/' . implode('/', array_map('rawurlencode', explode('/', ltrim($path, '/'))));
    }

    private function linesTotal(array $lines) {
        $total = 0;

        foreach ($lines as $line) $total += $line['price'] * $line['quantity'];

        return round($total, 2);
    }

    private function deliveryText($delivery) {
        return $delivery === 'delivery' ? 'Envío a domicilio' : 'Recoge en tienda';
    }

    private function paymentText($payment) {
        return $payment === 'transfer' ? 'Transferencia' : 'Paga en tienda';
    }

    private function money($n) {
        return '$' . number_format(round((float) $n, 2), 2);
    }

    private function hour12($time) {
        $stamp = strtotime('2000-01-01 ' . $time);

        return $stamp ? date('g:i A', $stamp) : '';
    }

    // «martes 17 de noviembre»
    private function longDate($date) {
        $days   = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        $months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        $stamp  = strtotime($date);

        return $stamp ? $days[(int) date('w', $stamp)] . ' ' . date('j', $stamp) . ' de ' . $months[(int) date('n', $stamp) - 1] : (string) $date;
    }

    // -- Ayudantes --

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

echo json_encode((new PublicStore())->run((string) $_POST['opc']), JSON_UNESCAPED_UNICODE);
