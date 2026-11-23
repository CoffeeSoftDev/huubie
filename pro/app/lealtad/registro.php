<?php
/*  Registro solo: la pagina del QR del mostrador, SIN sesion
    (plan: lealtad/docs/plan-crecimiento.html, etapa L1).

      registro.php?t=<token de 32 caracteres>   (loyalty_signup.token, uno por sucursal)

    El cliente escribe su nombre, su WhatsApp (10 digitos) y, si quiere, su
    cumpleaños (dia y mes). Recibe el tipo «de bienvenida» de Lealtad › Programa
    con un numero de 8 digitos al azar.

    Reglas que no se ven en el codigo de un vistazo:
      - WhatsApp nuevo en la empresa: se crea el cliente y su tarjeta, y la
        pagina lo lleva a su tarjeta digital (tarjeta.php). Tambien le llega
        por WhatsApp si la empresa tiene numero.
      - WhatsApp que ya era cliente: la pagina NO ensena nada. Se le manda su
        tarjeta (la que ya tiene, o una nueva de bienvenida si no tiene) a su
        WhatsApp. Su nombre guardado no se pisa; el cumpleaños solo se pone si
        no se sabia.
      - La casilla es el permiso para mensajes que no son respuesta (te
        extrañamos, cumpleaños): sin ella su tarjeta le llega igual, pero
        whatsapp_optin_at se queda vacio.
      - Topes: 5 registros por hora desde una conexion (solo cuentan los que
        dieron o reenviaron tarjeta) y el mismo telefono no recibe otra vez su
        tarjeta en 10 minutos. Un campo trampa (website) que solo llenan los
        robots: se le contesta como si hubiera salido y no se hace nada.
      - Despues del POST va un 303 (recargar no registra dos veces).
      - Token con formato malo o que no existe, o sucursal inactiva: 404 sin
        decir cual. Registro apagado o tipo de bienvenida inactivo: «pide tu
        tarjeta en caja».
      - Los errores van a error_log de PHP: writeToLog dejaria un archivo
        dentro de la carpeta publica. */

require_once __DIR__ . '/../order/mdl/mdl-order.php';
require_once __DIR__ . '/../order/mdl/mdl-lealtad.php';
require_once __DIR__ . '/../order/mdl/mdl-lealtad-programa.php';
require_once __DIR__ . '/../order/mdl/mdl-whatsapp-agente.php';
require_once __DIR__ . '/../order/mdl/mdl-whatsapp-recordatorios.php';
require_once __DIR__ . '/../../core/helpers/_WhatsAppMeta.php';
require_once __DIR__ . '/../order/mdl/mdl-lealtad-whatsapp.php';

class PublicSignupPage extends mdl {

    use LoyaltyCards, WhatsAppInbox, WhatsAppAgentFlow, WhatsAppReminders, LoyaltyWhatsApp, LoyaltyProgram;

    const PER_IP    = 5;     // registros por hora desde una conexion
    const AGAIN_MIN = 10;    // minutos en que un telefono no recibe otra vez su tarjeta
    const MAX_NAME  = 150;

    private $link = null;

    // -- Enlace --

    // El enlace de registro con su sucursal activa. Null si el token no sirve.
    public function open($token) {
        if (!preg_match('/^[a-f0-9]{32}$/', $token)) return null;

        $this->link = $this->qSignupByToken($token);

        return $this->link;
    }

    // Hoy da tarjetas: registro encendido y tipo de bienvenida activo.
    public function live() {
        return $this->link && (int) $this->link['signup_enabled'] === 1 && (int) $this->link['type_active'] === 1;
    }

    // -- Lo que LoyaltyWhatsApp toma de la sesion: aqui sale del enlace --

    protected function companyId() {
        return $this->link ? (int) $this->link['company_id'] : 0;
    }

    protected function branchId() {
        return $this->link ? (int) $this->link['branch_id'] : 0;
    }

    protected function userId() {
        return null;
    }

    protected function scope() {
        return [
            'company_id' => $this->companyId(),
            'company'    => $this->link ? (string) $this->link['company'] : '',
            'branch_id'  => $this->branchId(),
            'branch'     => $this->link ? (string) $this->link['branch'] : ''
        ];
    }

    protected function must($result, $what) {
        if ($result !== true) throw new RuntimeException($what . ': ' . (is_string($result) ? $result : 'sin respuesta de la base'));

        return true;
    }

    // Aqui el permiso lo da la casilla, no el envio.
    protected function loyaltyOptinOnSend() {
        return false;
    }

    // Esta pagina vive en app/lealtad/: dos carpetas arriba esta app/ (el trait cuenta tres, desde un ctrl).
    protected function loyaltyHostUrl($page, $token) {
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
        $host  = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $app   = rtrim(str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/'), 2)), '/');

        return ($https ? 'https' : 'http') . '://' . $host . $app . '/lealtad/' . $page . '?t=' . rawurlencode($token);
    }

    // -- Registro --

    /*  El POST del formulario. Devuelve ['errors' => [campo => texto]] o
        ['go' => 'wa' | 'caja' | <enlace de la tarjeta nueva>]. */
    public function register(array $in, $ip) {
        $branchId = $this->branchId();

        // Campo trampa: al robot se le contesta como si hubiera salido.
        if (trim((string) ($in['website'] ?? '')) !== '') {
            $this->qLogSignup($branchId, $ip, '', null, null, 'mal');

            return ['go' => 'wa'];
        }

        $name   = trim((string) preg_replace('/\s+/u', ' ', (string) ($in['name'] ?? '')));
        $phone  = $this->loyaltyPhone($in['phone'] ?? '');
        $day    = (int) ($in['day'] ?? 0);
        $month  = (int) ($in['month'] ?? 0);
        $agree  = (string) ($in['agree'] ?? '') === '1';
        $errors = [];

        if (mb_strlen($name, 'UTF-8') < 2 || !preg_match('/\p{L}/u', $name)) $errors['name'] = 'Escribe tu nombre.';
        elseif (mb_strlen($name, 'UTF-8') > self::MAX_NAME)                  $errors['name'] = 'Tu nombre es muy largo: usa hasta ' . self::MAX_NAME . ' letras.';

        if ($phone === '') $errors['phone'] = 'Escribe tu WhatsApp: 10 dígitos.';

        if (($day || $month) && !($day && $month && checkdate($month, $day, 2000))) $errors['birthday'] = 'Esa fecha no existe: revisa el día y el mes.';

        if ($errors) return ['errors' => $errors];

        // «mariana lópez» o «MARIANA LÓPEZ» → «Mariana López». Si ya trae mayúsculas y minúsculas, se respeta.
        if ($name === mb_strtolower($name, 'UTF-8') || $name === mb_strtoupper($name, 'UTF-8')) {
            $name = mb_convert_case(mb_strtolower($name, 'UTF-8'), MB_CASE_TITLE, 'UTF-8');
        }

        if ($this->qSignupAttempts($ip, date('Y-m-d H:i:s', strtotime('-1 hour'))) >= self::PER_IP) {
            $this->qLogSignup($branchId, $ip, $phone, null, null, 'tope');

            return ['errors' => ['form' => 'Recibimos muchos registros desde tu conexión en la última hora. Intenta más tarde o pide tu tarjeta en caja.']];
        }

        // El mismo telefono otra vez en 10 minutos (doble clic, o alguien probando): no se le vuelve a mandar.
        if ($this->qSignupPhoneRecent($phone, date('Y-m-d H:i:s', strtotime('-' . self::AGAIN_MIN . ' minutes')))) return ['go' => 'wa'];

        $birthday = $day && $month ? sprintf('2000-%02d-%02d', $month, $day) : null;
        $typeId   = (int) $this->link['signup_type_id'];

        $done = $this->transaction(function () use ($branchId, $typeId, $name, $phone, $birthday, $agree, $ip) {
            $this->qLockSignup($branchId);

            $found = $this->qSignupCustomer($branchId, $phone);

            if ($found) {
                $customerId = (int) $found['id'];

                if ($agree)    $this->must($this->qMarkOptin($customerId), 'registro optin');
                if ($birthday) $this->must($this->qSetBirthdayIfEmpty($customerId, $birthday), 'registro cumpleaños');

                $card   = $this->qOwnedCard($customerId, $branchId);
                $holder = trim((string) $found['name']) !== '' ? (string) $found['name'] : $name;
                $cardId = $card ? (int) $card['id'] : $this->signupCard($customerId, $holder, $typeId, $branchId);

                $this->must($this->qLogSignup($branchId, $ip, $phone, $customerId, $cardId, 'reenviada'), 'registro bitacora');

                return ['card_id' => $cardId, 'fresh' => false];
            }

            $this->must($this->qCreateCustomer([
                'values' => ['name', 'phone', 'birthday', 'whatsapp_optin_at', 'branch_id', 'active'],
                'data'   => [$name, $phone, $birthday, $agree ? date('Y-m-d H:i:s') : null, $branchId, 1]
            ]), 'registro cliente');

            $customerId = $this->qLastInsertId();
            if ($customerId <= 0) throw new RuntimeException('registro: cliente sin id');

            $cardId = $this->signupCard($customerId, $name, $typeId, $branchId);

            $this->must($this->qLogSignup($branchId, $ip, $phone, $customerId, $cardId, 'nueva'), 'registro bitacora');

            return ['card_id' => $cardId, 'fresh' => true];
        });

        // La tarjeta ya quedo guardada: el WhatsApp va aparte y, si falla, la pagina sigue.
        $wa = false;

        try {
            $card = $this->qCard($done['card_id'], $branchId);
            $sent = $card ? $this->loyaltySendCard($card, $phone) : ['status' => 'skip'];
            $wa   = in_array($sent['status'], ['sent', 'simulated'], true);
        } catch (Throwable $e) {
            error_log('[ LEALTAD REGISTRO ] :: whatsapp :: ' . $e->getMessage());
        }

        if (!$done['fresh']) return ['go' => $wa ? 'wa' : 'caja'];

        return ['go' => 'tarjeta.php?t=' . rawurlencode($this->loyaltyCardToken($done['card_id'])) . '&nueva=' . ($wa ? 'wa' : '1')];
    }

    // La tarjeta de bienvenida: 8 digitos al azar y su enlace desde ya.
    private function signupCard($customerId, $holder, $typeId, $branchId) {
        $number = $this->loyaltyFreshNumber($branchId);
        $token  = $this->loyaltyFreshToken();

        $this->must($this->qCreateCard([
            'values' => ['number', 'token', 'holder', 'branch_id', 'card_type_id', 'customer_id', 'active'],
            'data'   => [$number, $token, mb_substr($holder, 0, self::MAX_NAME, 'UTF-8'), $branchId, $typeId, $customerId, 1]
        ]), 'registro tarjeta');

        $id = $this->qLastInsertId();
        if ($id <= 0) throw new RuntimeException('registro: tarjeta sin id');

        return $id;
    }
}

// -- Datos --

$token  = isset($_GET['t']) ? strtolower(trim((string) $_GET['t'])) : '';
$post   = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
$ip     = substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45) ?: '-';
$link   = null;
$view   = 'gone';   // gone (404) | off (apagado) | form | wa | caja
$errors = [];
$old    = ['name' => '', 'phone' => '', 'day' => 0, 'month' => 0, 'agree' => false];

if ($post) {
    $old = [
        'name'  => mb_substr(trim((string) ($_POST['name'] ?? '')), 0, 200, 'UTF-8'),
        'phone' => mb_substr(trim((string) ($_POST['phone'] ?? '')), 0, 20, 'UTF-8'),
        'day'   => (int) ($_POST['day'] ?? 0),
        'month' => (int) ($_POST['month'] ?? 0),
        'agree' => (string) ($_POST['agree'] ?? '') === '1'
    ];
}

try {
    $page = new PublicSignupPage();
    $link = $page->open($token);

    if ($link && $page->live()) {
        $view = 'form';

        if ($post) {
            $out = $page->register($_POST, $ip);

            if (isset($out['go'])) {
                $to = in_array($out['go'], ['wa', 'caja'], true) ? 'registro.php?t=' . rawurlencode($token) . '&r=' . $out['go'] : $out['go'];

                header('Location: ' . $to, true, 303);
                exit;
            }

            $errors = $out['errors'];
        } elseif (in_array($_GET['r'] ?? '', ['wa', 'caja'], true)) {
            $view = (string) $_GET['r'];
        }
    } elseif ($link) {
        $view = 'off';
    }
} catch (Throwable $e) {
    error_log('[ LEALTAD REGISTRO ] :: ' . $e->getMessage());

    if ($link && $post) {
        $view   = 'form';
        $errors = ['form' => 'No pudimos registrarte. Intenta de nuevo en un momento o pide tu tarjeta en caja.'];
    } else {
        $link = null;
        $view = 'gone';
    }
}

if ($view === 'gone') http_response_code(404);

header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

$h     = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
$short = fn ($n) => '$' . number_format((float) $n, floor((float) $n) == (float) $n ? 0 : 2);   // 100 → «$100»
$pct   = fn ($v) => rtrim(rtrim(number_format((float) $v, 2, '.', ''), '0'), '.') . ' %';

// Rutas guardadas relativas a la raiz del sitio («pro_files/...»): cada tramo codificado.
$file = function ($path) {
    $path = trim((string) $path);

    if ($path === '') return '';
    if (preg_match('#^https?://#i', $path)) return $path;

    return '/' . implode('/', array_map('rawurlencode', explode('/', ltrim($path, '/'))));
};

$initials = function ($name) {
    $words = preg_split('/\s+/u', trim((string) $name), -1, PREG_SPLIT_NO_EMPTY);
    $out   = '';

    foreach (array_slice($words, 0, 2) as $w) $out .= mb_strtoupper(mb_substr($w, 0, 1, 'UTF-8'), 'UTF-8');

    return $out !== '' ? $out : '?';
};

// El color de la tarjeta de bienvenida; sin color, el celeste claro de Lealtad › Tarjetas.
$color = '#BAE6FD';
$light = true;

if ($link && preg_match('/^#[0-9A-F]{6}$/i', (string) $link['color'])) $color = strtoupper($link['color']);

// Letra oscura sobre colores claros y blanca sobre los fuertes: el mismo corte (0.24) que tarjeta.php.
[$r, $g, $b] = sscanf($color, '#%02x%02x%02x');
$lin   = function ($v) { $v = $v / 255; return $v <= 0.03928 ? $v / 12.92 : pow(($v + 0.055) / 1.055, 2.4); };
$light = 0.2126 * $lin($r) + 0.7152 * $lin($g) + 0.0722 * $lin($b) > 0.24;
$ink   = $light ? "color-mix(in srgb, {$color} 22%, #0F172A)" : '#FFFFFF';

$store = '';
$logo  = '';
$perk  = '';
$goal  = 0;

// La cifra de arriba a la derecha de la tarjeta, como en Tarjetas: SELLOS 10 · DESCUENTO 5 % · PUNTOS 3 %.
$cardValue = null;

if ($link) {
    $store = trim((string) $link['company']) !== '' ? trim($link['company']) : (trim((string) $link['title']) !== '' ? trim($link['title']) : trim((string) $link['branch']));
    $logo  = $file(trim((string) $link['company_logo']) !== '' ? $link['company_logo'] : $link['branch_logo']);
    $goal  = (int) $link['stamp_goal'];

    if ($goal > 0)                                 $perk = '1 sello por cada ' . $short($link['stamp_amount']) . ' que pagas. Con ' . $goal . ' sellos: ' . trim((string) $link['reward_name']) . '.';
    elseif ((float) $link['discount_percent'] > 0) $perk = $pct($link['discount_percent']) . ' de descuento en cada compra.';
    elseif ((float) $link['points_percent'] > 0)   $perk = $pct($link['points_percent']) . ' de lo que pagas regresa a tu monedero.';

    if ($goal > 0)                                 $cardValue = ['Sellos', (string) $goal];
    elseif ((float) $link['discount_percent'] > 0) $cardValue = ['Descuento', $pct($link['discount_percent'])];
    elseif ((float) $link['points_percent'] > 0)   $cardValue = ['Puntos', $pct($link['points_percent'])];
}

$months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

$title = $view === 'gone' ? 'Registro no disponible' : $store . ' · Tu tarjeta de cliente';

$icons = [
    'card'  => '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    'chat'  => '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    'store' => '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>',
    'link'  => '<path d="M9 17H7A5 5 0 0 1 7 7"/><path d="M15 7h2a5 5 0 0 1 4 8"/><path d="M8 12h4"/><path d="m2 2 20 20"/>',
    'gift'  => '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>'
];

$svg = fn ($name, $size = 16) => '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $icons[$name] . '</svg>';

$favicon = 'data:image/svg+xml,' . rawurlencode(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
    . '<rect width="32" height="32" rx="8" fill="' . $color . '"/>'
    . '<g transform="translate(6 6) scale(.8333)" fill="none" stroke="' . ($light ? '#0F172A' : '#FFFFFF') . '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
    . $icons['card']
    . '</g></svg>'
);

$err = fn ($key) => isset($errors[$key]) ? '<p class="err" id="err-' . $key . '">' . $h($errors[$key]) . '</p>' : '';
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="robots" content="noindex, nofollow">
    <meta name="color-scheme" content="light dark">
    <meta name="theme-color" content="<?= $h($color) ?>">
    <title><?= $h($title) ?></title>
    <link rel="icon" type="image/svg+xml" href="<?= $h($favicon) ?>">
<?php if ($link): ?>
    <meta property="og:type" content="website">
    <meta property="og:title" content="<?= $h($store) ?>">
    <meta property="og:description" content="Tu tarjeta de cliente, gratis y en tu teléfono.">
    <script>
        /* Logo que no carga: un intento contra huubie.com.mx (las fotos viven alla) y luego las iniciales. */
        document.addEventListener('error', function (e) {
            var img = e.target;
            if (!img || img.tagName !== 'IMG' || !img.dataset || !img.dataset.src) return;
            var path = img.dataset.src;
            if (!img.dataset.retry && path.charAt(0) === '/' && location.hostname !== 'huubie.com.mx') {
                img.dataset.retry = '1';
                img.src = 'https://huubie.com.mx' + path;
                return;
            }
            var box = img.parentNode, span = document.createElement('span');
            span.className = 'ini';
            span.textContent = img.dataset.ini || '';
            if (box) { box.classList.add('is-empty'); box.replaceChild(span, img); }
        }, true);
    </script>
<?php endif; ?>
    <style>
        :root {
            --bg: #F3F4F6;
            --paper: #FFFFFF;
            --ink: #0F172A;
            --soft: #5B6577;
            --faint: #94A3B8;
            --chip: #EEF1F5;
            --field: #F6F7F9;
            --card: <?= $h($color) ?>;
            --card-ink: <?= $light ? '#0F172A' : '#FFFFFF' ?>;
            --ok: #047857;
            --bad: #B91C1C;
            --radius: 20px;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #0B1018;
                --paper: #151D29;
                --ink: #E6EAF0;
                --soft: #9AA6B8;
                --faint: #64748B;
                --chip: #1E2836;
                --field: #1B2431;
                --ok: #6EE7B7;
                --bad: #FCA5A5;
            }
        }
        *, *::before, *::after { box-sizing: border-box; }
        html { -webkit-text-size-adjust: 100%; }
        body {
            margin: 0;
            background: var(--bg);
            color: var(--ink);
            font: 15px/1.5 "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
            overflow-x: hidden;
        }
        img { display: block; max-width: 100%; }
        svg { flex: none; }
        .wrap { width: 100%; max-width: 460px; margin: 0 auto; padding: 18px 16px 8px; display: grid; gap: 14px; }

        /* -- Tienda -- */
        .store { display: flex; align-items: center; gap: 12px; padding: 2px 2px 4px; }
        .logo { width: 40px; height: 40px; flex: none; border-radius: 12px; overflow: hidden; background: var(--chip); display: grid; place-items: center; }
        .logo img { width: 100%; height: 100%; object-fit: cover; }
        .logo .ini { font-weight: 800; font-size: 15px; color: var(--soft); }
        .store b { display: block; font-size: 15px; line-height: 1.2; }
        .store small { display: block; font-size: 13px; color: var(--soft); }

        /*  -- La tarjeta que va a recibir: la misma de Lealtad › Tarjetas, de Vender
            y de tarjeta.php (.loy-card en order/src/css/order.css), con sus
            medidas: 340 px de ancho, apaisada como una de plástico (1.586),
            degradado del color de su tipo con un brillo encima. -- */
        .card {
            --c-chip: <?= $light ? 'rgba(15, 23, 42, .08)' : 'rgba(255, 255, 255, .22)' ?>;
            position: relative;
            isolation: isolate;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            width: 340px;
            max-width: 100%;
            aspect-ratio: 1.586;
            margin: 0 auto;
            border-radius: 14px;
            color: <?= $ink ?>;
            background: var(--card);
            background: linear-gradient(135deg, color-mix(in srgb, var(--card) <?= $light ? '88%' : '70%' ?>, #000) 0%, var(--card) 58%, color-mix(in srgb, var(--card) <?= $light ? '70%' : '78%' ?>, #FFF) 100%);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, .3), inset 0 0 0 .5px rgba(0, 0, 0, .1), 0 12px 24px -12px rgba(24, 12, 60, .5), 0 2px 4px rgba(24, 12, 60, .1);
            <?= !$light ? 'text-shadow: 0 1px 1px rgba(0, 0, 0, .16);' : '' ?>
        }
        .card::after { content: ""; position: absolute; inset: 0; z-index: 2; border-radius: inherit; pointer-events: none; background: linear-gradient(125deg, rgba(255, 255, 255, .2) 0%, rgba(255, 255, 255, 0) 35%, rgba(255, 255, 255, 0) 72%, rgba(255, 255, 255, .08) 100%); }
        .card-head { display: flex; align-items: center; gap: 9px; padding: 12px 14px 0; }
        .card-logo { width: 30px; height: 30px; flex: none; border-radius: 9px; display: grid; place-items: center; background: var(--c-chip); }
        .card-logo svg { width: 17px; height: 17px; }
        .card-name { flex: 1; min-width: 0; }
        .card-type { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; font-size: 15px; font-weight: 800; letter-spacing: -.015em; line-height: 1.15; overflow-wrap: anywhere; }
        .card-brand { display: block; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 8.5px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; opacity: .78; }
        .card-value { flex: none; text-align: right; line-height: 1; }
        .card-value b { display: inline-block; font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .card-label { display: block; margin-bottom: 4px; font-size: 8px; font-weight: 700; letter-spacing: .09em; line-height: 1; text-transform: uppercase; opacity: .8; }
        .card-body { flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; padding: 12px 14px 14px; }
        .card-free { font-size: 22px; font-weight: 800; line-height: 1.1; letter-spacing: -.02em; }

        /* -- Cajas -- */
        .box { background: var(--paper); border-radius: var(--radius); padding: 18px; }
        .box h1, .box h2 { margin: 0 0 6px; font-size: 18px; font-weight: 800; line-height: 1.3; }
        .lead { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.4; }
        .note { margin: 6px 0 0; font-size: 13px; color: var(--soft); }

        /* -- Formulario: campos lisos, grandes para el dedo -- */
        form { display: grid; gap: 14px; margin-top: 14px; }
        .field { display: grid; gap: 6px; }
        .field > span, legend { font-size: 13px; font-weight: 700; color: var(--soft); padding: 0; }
        legend small, .field > span small { font-weight: 500; }
        input[type=text], input[type=tel], select {
            width: 100%; height: 48px; padding: 0 14px;
            border: 0; border-radius: 12px; outline: none;
            background: var(--field); color: var(--ink);
            font: inherit; font-size: 16px;   /* 16px: iOS no hace zoom al escribir */
            -webkit-appearance: none; appearance: none;
        }
        select { background-image: linear-gradient(45deg, transparent 50%, var(--soft) 50%), linear-gradient(135deg, var(--soft) 50%, transparent 50%); background-position: calc(100% - 20px) 21px, calc(100% - 15px) 21px; background-size: 5px 5px; background-repeat: no-repeat; padding-right: 34px; }
        input:focus-visible, select:focus-visible { box-shadow: 0 0 0 2px var(--card), 0 0 0 4px <?= $light ? 'rgba(15, 23, 42, .25)' : 'var(--card)' ?>; }
        .is-bad input, .is-bad select { box-shadow: 0 0 0 2px var(--bad); }
        fieldset { margin: 0; padding: 0; border: 0; display: grid; gap: 6px; }
        .pair { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 8px; }
        .agree { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; line-height: 1.45; color: var(--soft); cursor: pointer; }
        .agree input { width: 20px; height: 20px; margin: 1px 0 0; flex: none; accent-color: <?= $light ? '#0F172A' : $h($color) ?>; }
        .err { margin: 0; font-size: 13px; font-weight: 600; color: var(--bad); }
        .form-err { margin: 0; padding: 12px 14px; border-radius: 12px; background: var(--chip); font-size: 14px; font-weight: 600; color: var(--bad); }
        .trap { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
        button.go {
            height: 52px; border: 0; border-radius: 14px;
            background: var(--card); color: var(--card-ink);
            font: inherit; font-size: 16px; font-weight: 800; cursor: pointer;
        }
        button.go:disabled { opacity: .6; cursor: progress; }
        .fine { margin: 0; font-size: 12px; color: var(--faint); text-align: center; }

        /* -- Listo / no disponible -- */
        .done { min-height: 70vh; display: grid; place-items: center; }
        .done-card { width: 100%; text-align: center; background: var(--paper); border-radius: 22px; padding: 34px 24px; }
        .done-card .ic { width: 64px; height: 64px; border-radius: 20px; margin: 0 auto 14px; display: grid; place-items: center; background: var(--chip); color: var(--soft); }
        .done-card .ic.is-ok { background: var(--card); color: var(--card-ink); }
        .done-card h1 { margin: 0; font-size: 22px; font-weight: 800; }
        .done-card p { margin: 8px auto 0; max-width: 34ch; color: var(--soft); }
        footer.by { text-align: center; padding: 8px 16px 28px; font-size: 12px; color: var(--faint); }
    </style>
</head>
<body>
<?php if ($view === 'gone'): ?>
    <main class="wrap">
        <section class="done">
            <div class="done-card">
                <div class="ic"><?= $svg('link', 28) ?></div>
                <h1>Este registro no está disponible</h1>
                <p>Puede que la tienda haya cambiado su código. Pide tu tarjeta en caja.</p>
            </div>
        </section>
    </main>
</body>
</html>
<?php exit; endif; ?>
    <main class="wrap">
        <header class="store">
            <div class="logo<?= $logo === '' ? ' is-empty' : '' ?>">
<?php if ($logo !== ''): ?>
                <img src="<?= $h($logo) ?>" data-src="<?= $h($logo) ?>" data-ini="<?= $h($initials($store)) ?>" alt="">
<?php else: ?>
                <span class="ini"><?= $h($initials($store)) ?></span>
<?php endif; ?>
            </div>
            <div>
                <b><?= $h($store) ?></b>
                <small>Tu tarjeta de cliente</small>
            </div>
        </header>
<?php if ($view === 'off'): ?>
        <section class="done">
            <div class="done-card">
                <div class="ic"><?= $svg('store', 28) ?></div>
                <h1>Pide tu tarjeta en caja</h1>
                <p>Por ahora el registro desde el teléfono está en pausa. En caja te la damos en un momento.</p>
            </div>
        </section>
<?php elseif ($view === 'wa'): ?>
        <section class="done">
            <div class="done-card">
                <div class="ic is-ok"><?= $svg('chat', 28) ?></div>
                <h1>Revisa tu WhatsApp</h1>
                <p>Ese número ya era cliente de <?= $h($store) ?>: te mandamos tu tarjeta por WhatsApp. ¿No te llegó? Pídela en caja dando tu número.</p>
            </div>
        </section>
<?php elseif ($view === 'caja'): ?>
        <section class="done">
            <div class="done-card">
                <div class="ic"><?= $svg('store', 28) ?></div>
                <h1>Ya tienes tu tarjeta</h1>
                <p>Ese número ya es cliente de <?= $h($store) ?>. Pide tu tarjeta en caja dando tu número.</p>
            </div>
        </section>
<?php else: ?>
        <section class="card" aria-label="Tarjeta <?= $h($link['type']) ?>">
            <div class="card-head">
                <span class="card-logo" aria-hidden="true"><?= $svg($goal > 0 ? 'gift' : 'card', 17) ?></span>
                <div class="card-name">
                    <span class="card-type"><?= $h($link['type']) ?></span>
                    <span class="card-brand"><?= $h($store) ?></span>
                </div>
<?php if ($cardValue): ?>
                <div class="card-value"><span class="card-label"><?= $h($cardValue[0]) ?></span><b><?= $h($cardValue[1]) ?></b></div>
<?php endif; ?>
            </div>
            <div class="card-body">
                <span class="card-label">Gratis</span>
                <span class="card-free">Es tuya en un minuto</span>
            </div>
        </section>

        <section class="box">
            <h1>Regístrate y recibe tu tarjeta</h1>
<?php if ($perk !== ''): ?>
            <p class="lead"><?= $h($perk) ?></p>
<?php endif; ?>
            <p class="note">La abres en tu teléfono y la enseñas en caja al pagar.</p>

            <form method="post" action="registro.php?t=<?= $h(rawurlencode($token)) ?>" novalidate autocomplete="on" id="signup">
<?php if (isset($errors['form'])): ?>
                <p class="form-err" role="alert"><?= $h($errors['form']) ?></p>
<?php endif; ?>
                <label class="field<?= isset($errors['name']) ? ' is-bad' : '' ?>">
                    <span>Tu nombre</span>
                    <input type="text" name="name" value="<?= $h($old['name']) ?>" maxlength="150" autocomplete="name" autocapitalize="words" required<?= isset($errors['name']) ? ' aria-invalid="true" aria-describedby="err-name"' : '' ?>>
                    <?= $err('name') ?>
                </label>

                <label class="field<?= isset($errors['phone']) ? ' is-bad' : '' ?>">
                    <span>Tu WhatsApp</span>
                    <input type="tel" name="phone" value="<?= $h($old['phone']) ?>" maxlength="20" inputmode="numeric" autocomplete="tel-national" placeholder="10 dígitos" required<?= isset($errors['phone']) ? ' aria-invalid="true" aria-describedby="err-phone"' : '' ?>>
                    <?= $err('phone') ?>
                </label>

                <fieldset class="<?= isset($errors['birthday']) ? 'is-bad' : '' ?>">
                    <legend>Tu cumpleaños <small>(si quieres, para felicitarte)</small></legend>
                    <div class="pair">
                        <select name="day" aria-label="Día">
                            <option value="0">Día</option>
<?php for ($d = 1; $d <= 31; $d++): ?>
                            <option value="<?= $d ?>"<?= $old['day'] === $d ? ' selected' : '' ?>><?= $d ?></option>
<?php endfor; ?>
                        </select>
                        <select name="month" aria-label="Mes">
                            <option value="0">Mes</option>
<?php foreach ($months as $i => $m): ?>
                            <option value="<?= $i + 1 ?>"<?= $old['month'] === $i + 1 ? ' selected' : '' ?>><?= $h(ucfirst($m)) ?></option>
<?php endforeach; ?>
                        </select>
                    </div>
                    <?= $err('birthday') ?>
                </fieldset>

                <label class="agree">
                    <input type="checkbox" name="agree" value="1"<?= $old['agree'] ? ' checked' : '' ?>>
                    <span>Acepto que <?= $h($store) ?> me escriba por WhatsApp: mi tarjeta, mis premios y promociones. Me doy de baja cuando quiera respondiendo BAJA.</span>
                </label>

                <!-- Campo trampa: las personas no lo ven; los robots lo llenan. -->
                <div class="trap" aria-hidden="true">
                    <label>No llenar <input type="text" name="website" value="" tabindex="-1" autocomplete="off"></label>
                </div>

                <button type="submit" class="go">Quiero mi tarjeta</button>
                <p class="fine">Tus datos solo los usa <?= $h($store) ?> para tu tarjeta.</p>
            </form>
        </section>
<?php endif; ?>
    </main>

    <footer class="by">Tarjeta digital con Huubie</footer>

    <script>
        /* Un solo envio: el boton se apaga al mandar (el 303 del servidor evita el doble registro al recargar). */
        (function () {
            var form = document.getElementById('signup');
            if (!form) return;
            form.addEventListener('submit', function () {
                var button = form.querySelector('button.go');
                if (button) { button.disabled = true; button.textContent = 'Un momento…'; }
            });
        })();
    </script>
</body>
</html>
