<?php
/*  Tarjeta digital de lealtad: la pagina que abre el cliente en su telefono, SIN sesion.

      tarjeta.php?t=<token de 32 caracteres>   (card.token)

    Muestra la tarjeta (lisa, del color de su tipo), un QR con el NUMERO para
    que en caja la lean con el lector igual que el plastico, lo que da, el
    monedero si la tarjeta tiene cliente dueño y sus ultimas compras. Todo lo
    pinta PHP; el QR lo dibuja qrcode-generator en el navegador (sin JavaScript
    queda el numero escrito, que tambien sirve).

    Token con formato malo, que ya se cambio, tarjeta o tipo inactivos: la misma
    pagina 404, sin decir cual fue. Las etiquetas og llevan solo el nombre de la
    tienda: el enlace se comparte por WhatsApp y la vista previa no debe mostrar
    datos del cliente. Del cliente se muestra solo el primer nombre. */

require_once __DIR__ . '/../order/mdl/mdl-order.php';
require_once __DIR__ . '/../order/mdl/mdl-lealtad.php';

class PublicCardPage extends mdl {

    use LoyaltyCards;

    const MOVES = 5;

    public function load($token) {
        if (!preg_match('/^[a-f0-9]{32}$/', $token)) return null;

        $card = $this->qDigitalCard($token);

        if (!$card) return null;

        $id   = (int) $card['id'];
        $goal = (int) $card['stamp_goal'];

        return [
            'card'   => $card,
            'totals' => $this->qCardTotals($id),
            'wallet' => $card['owner_id'] !== null ? $this->qCardWallet((int) $card['owner_id']) : null,
            'moves'  => $this->qCardMoves($id, self::MOVES),
            // Sellos: have (los de hoy, nunca menos de 0), goal, earned, rewards (canjeados) y saved.
            'stamps' => $goal > 0 ? ['have' => max($this->qCardStamps($id), 0), 'goal' => $goal] + $this->qCardStampTotals($id) : null
        ];
    }
}

// -- Datos --

$token = isset($_GET['t']) ? strtolower(trim((string) $_GET['t'])) : '';
$d     = null;

try {
    $d = (new PublicCardPage())->load($token);
} catch (Throwable $e) {
    $d = null;
}

if (!$d) http_response_code(404);

header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');

$h     = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
$money = fn ($n) => '$' . number_format((float) $n, 2);
$short = fn ($n) => '$' . number_format((float) $n, floor((float) $n) == (float) $n ? 0 : 2);   // 100 → «$100»
$pct   = fn ($v) => rtrim(rtrim(number_format((float) $v, 2, '.', ''), '0'), '.') . ' %';
$dmy   = fn ($v) => $v ? date('d/m/Y', strtotime((string) $v)) : '';
// El primer nombre con mayúscula inicial («sergio lópez» → «Sergio»).
$first = function ($name) {
    $word = (string) (preg_split('/\s+/u', trim((string) $name), -1, PREG_SPLIT_NO_EMPTY)[0] ?? '');

    return $word === '' ? '' : mb_strtoupper(mb_substr($word, 0, 1, 'UTF-8'), 'UTF-8') . mb_substr($word, 1, null, 'UTF-8');
};

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

// El color de su tipo; sin color, el celeste claro de Lealtad › Tarjetas.
$color = '#BAE6FD';
$ink   = '#0F172A';

if ($d) {
    $c = $d['card'];
    $t = $d['totals'] ?: ['sales' => 0, 'sold' => 0, 'discount' => 0, 'points' => 0, 'last_sale' => null];

    if (preg_match('/^#[0-9A-F]{6}$/i', (string) $c['color'])) $color = strtoupper($c['color']);

    // Letra oscura sobre colores claros y blanca sobre los fuertes: luminancia de WCAG, el mismo corte (0.24) que inkOf() de tarjetas.js.
    [$r, $g, $b] = sscanf($color, '#%02x%02x%02x');
    $lin   = function ($v) { $v = $v / 255; return $v <= 0.03928 ? $v / 12.92 : pow(($v + 0.055) / 1.055, 2.4); };
    $light = 0.2126 * $lin($r) + 0.7152 * $lin($g) + 0.0722 * $lin($b) > 0.24;
    $ink   = $light ? "color-mix(in srgb, {$color} 22%, #0F172A)" : '#FFFFFF';

    // La empresa primero: la tarjeta vale en todas sus sucursales (la tienda en línea es de la sucursal de alta).
    $store    = trim((string) $c['company']) !== '' ? trim($c['company']) : (trim((string) $c['title']) !== '' ? trim($c['title']) : trim((string) $c['branch']));
    $logoRaw  = trim((string) $c['company_logo']) !== '' ? $c['company_logo'] : $c['branch_logo'];
    $logo     = $file($logoRaw);
    $owner    = $c['owner_id'] !== null;
    $holder   = trim((string) $c['holder']);
    $who      = $first($owner ? $c['customer'] : $holder);
    $onCard   = $holder !== '' ? $holder : ($owner ? $first($c['customer']) : '');
    $number   = (string) $c['number'];
    $discount = round((float) $c['discount_percent'], 2);
    $points   = round((float) $c['points_percent'], 2);
    $sales    = (int) $t['sales'];
    $moves    = $d['moves'];

    // Sellos: el icono es un nombre de Lucide (lo valida el alta); con uno raro, círculo liso.
    $st       = $d['stamps'];
    $goal     = $st ? (int) $st['goal'] : 0;
    $have     = $st ? min((int) $st['have'], 999) : 0;
    $icon     = $st && preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', (string) $c['stamp_icon']) ? (string) $c['stamp_icon'] : '';
    $ready    = $goal > 0 ? intdiv($have, $goal) : 0;
    $onCardSt = $goal > 0 ? ($have >= $goal ? $goal : $have) : 0;
    $reward   = trim((string) $c['reward_name']);
    $stampRow = function ($count, $on, $class) use ($icon, $h) {
        $out = '';

        for ($i = 0; $i < $count; $i++) {
            $out .= '<span class="' . $class . ($i < $on ? ' is-on' : '') . ($icon !== '' ? ' has-icon' : '') . '">'
                  . ($icon !== '' ? '<i data-lucide="' . $h($icon) . '"></i>' : '')
                  . '</span>';
        }

        return $out;
    };

    $title = $store . ' · Tu tarjeta';
} else {
    $title = 'Tarjeta no disponible';
}

$icons = [
    'card'   => '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    'wallet' => '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    'tag'    => '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    'link'   => '<path d="M9 17H7A5 5 0 0 1 7 7"/><path d="M15 7h2a5 5 0 0 1 4 8"/><path d="M8 12h4"/><path d="m2 2 20 20"/>',
    'gift'   => '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
    'home'   => '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'
];

$svg = fn ($name, $size = 16) => '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $icons[$name] . '</svg>';

// Icono de la pestaña: la tarjeta sobre su color. Asi el navegador no pide /favicon.ico.
$favicon = 'data:image/svg+xml,' . rawurlencode(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
    . '<rect width="32" height="32" rx="8" fill="' . $color . '"/>'
    . '<g transform="translate(6 6) scale(.8333)" fill="none" stroke="' . ($d && $light ? '#0F172A' : '#FFFFFF') . '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
    . $icons['card']
    . '</g></svg>'
);

$qrVersion = @filemtime(__DIR__ . '/../../assets/plugins/qrcode/qrcode.js') ?: 1;
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
<?php if ($d): ?>
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="<?= $h($store) ?>">
    <meta property="og:type" content="website">
    <meta property="og:title" content="<?= $h($store) ?>">
    <meta property="og:description" content="Tu tarjeta de cliente, siempre a la mano.">
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
            --card: <?= $h($color) ?>;
            --card-ink: <?= $d && $light ? '#0F172A' : '#FFFFFF' ?>;
            --card-ink-real: <?= $ink ?>;
            --ok: #047857;
            --save: #B45309;
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
                --ok: #6EE7B7;
                --save: #FCD34D;
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

        /* -- La tarjeta: un rectangulo liso de un solo color, sin filos ni sombra -- */
        .card {
            position: relative;
            display: flex; flex-direction: column; justify-content: space-between;
            aspect-ratio: 1.586;
            padding: 18px 20px;
            border-radius: var(--radius);
            background: var(--card);
            color: <?= $ink ?>;
            <?= $d && !$light ? 'text-shadow: 0 1px 1px rgba(0, 0, 0, .22);' : '' ?>
        }
        .card-top, .card-bottom { display: flex; justify-content: space-between; gap: 12px; }
        .card-top { align-items: flex-start; }
        .card-bottom { align-items: flex-end; }
        .card-type { font-size: 18px; font-weight: 700; line-height: 1.2; overflow-wrap: anywhere; }
        .card-brand { flex-shrink: 0; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10.5px; font-weight: 600; letter-spacing: .07em; line-height: 1.9; text-transform: uppercase; opacity: .85; }
        .card-number { margin: 0; font: 600 20px/1.2 ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; letter-spacing: .12em; overflow-wrap: anywhere; }
        .card-number.is-long { font-size: 15px; letter-spacing: .04em; }
        .card-owner { min-width: 0; }
        .card-label, .perk span { display: block; font-size: 10px; font-weight: 600; letter-spacing: .08em; line-height: 1.3; text-transform: uppercase; opacity: .85; }
        .card-holder { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; }
        .card-holder.is-empty { opacity: .6; }
        .perks { display: flex; gap: 14px; flex-shrink: 0; }
        .perk { text-align: right; }
        .perk b { display: block; font-size: 24px; font-weight: 800; line-height: 1.05; white-space: nowrap; }

        /* -- Sellos: lisos, sin bordes. En la tarjeta, del color de la letra; en la caja, del color de la tarjeta -- */
        .card-stamps { display: grid; grid-template-columns: repeat(10, minmax(0, 20px)); gap: 5px; }
        .st { display: inline-flex; align-items: center; justify-content: center; width: 100%; aspect-ratio: 1; border-radius: 99px; }
        .st svg { width: 62%; height: 62%; stroke-width: 2.2; }
        .card .st { background: var(--card-ink-real); opacity: .26; }
        .card .st.is-on { opacity: 1; }
        .card .st.has-icon { background: transparent; color: var(--card-ink-real); opacity: .5; }
        .card .st.has-icon.is-on { background: var(--card-ink-real); color: var(--card); opacity: 1; }
        .stamps { display: grid; grid-template-columns: repeat(5, minmax(0, 46px)); gap: 10px; margin-top: 14px; }
        .stamps .st { background: var(--chip); color: var(--faint); }
        .stamps .st.is-on { background: var(--card); color: var(--card-ink); }
        .ready { margin-top: 14px; padding: 12px 14px; border-radius: 14px; background: var(--chip); font-weight: 700; color: var(--ok); }

        /* -- El QR: siempre negro sobre blanco, aun en modo oscuro, para que el lector lo lea -- */
        .qr { background: #FFFFFF; color: #0F172A; border-radius: var(--radius); padding: 22px 20px 18px; text-align: center; }
        .qr-code { width: 100%; max-width: 236px; margin: 0 auto; aspect-ratio: 1; display: grid; place-items: center; }
        .qr-code svg { display: block; width: 100%; height: auto; }
        .qr-number { margin: 10px 0 0; font: 700 22px/1.2 ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; letter-spacing: .14em; overflow-wrap: anywhere; }
        .qr-hint { margin: 6px auto 0; max-width: 32ch; font-size: 13px; color: #5B6577; }

        /* -- Cajas -- */
        .box { background: var(--paper); border-radius: var(--radius); padding: 18px; }
        .box h2 { margin: 0 0 12px; font-size: 15px; font-weight: 800; display: flex; align-items: center; gap: 10px; }
        .box h2 i { font-style: normal; width: 28px; height: 28px; border-radius: 9px; flex: none; display: grid; place-items: center; background: var(--chip); color: var(--soft); }
        .lead { margin: 0; font-size: 17px; font-weight: 700; line-height: 1.35; }
        .note { margin: 6px 0 0; font-size: 13px; color: var(--soft); }
        .wallet { margin-top: 14px; padding: 14px 16px; border-radius: 14px; background: var(--chip); }
        .wallet small { display: block; font-size: 13px; font-weight: 700; color: var(--soft); }
        .wallet b { display: block; font-size: 32px; font-weight: 800; letter-spacing: -.02em; line-height: 1.15; font-variant-numeric: tabular-nums; color: var(--ok); }
        .stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
        .stat { padding: 12px 14px; border-radius: 14px; background: var(--chip); min-width: 0; }
        .stat small { display: block; font-size: 12px; font-weight: 600; color: var(--soft); }
        .stat b { display: block; font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* -- Compras -- */
        .moves { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
        .move { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .move b { display: block; font-size: 14px; font-variant-numeric: tabular-nums; }
        .move small { display: block; font-size: 12px; color: var(--soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .move div { min-width: 0; }
        .move span { flex: none; font-size: 13px; font-weight: 700; white-space: nowrap; }
        .move .is-save { color: var(--save); }
        .move .is-points { color: var(--ok); }
        .move .is-none { color: var(--faint); font-weight: 600; }

        .tip { display: flex; gap: 10px; align-items: flex-start; padding: 2px 4px; font-size: 13px; color: var(--soft); }
        footer.by { text-align: center; padding: 8px 16px 28px; font-size: 12px; color: var(--faint); }

        /* -- Tarjeta no disponible -- */
        .gone { min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; }
        .gone-card { max-width: 420px; text-align: center; background: var(--paper); border-radius: 22px; padding: 36px 26px; }
        .gone-card .ic { width: 64px; height: 64px; border-radius: 20px; margin: 0 auto 14px; display: grid; place-items: center; background: var(--chip); color: var(--soft); }
        .gone-card h1 { margin: 0; font-size: 22px; font-weight: 800; }
        .gone-card p { margin: 8px 0 0; color: var(--soft); }
    </style>
</head>
<?php if (!$d): ?>
<body>
    <main class="gone">
        <div class="gone-card">
            <div class="ic"><?= $svg('link', 28) ?></div>
            <h1>Esta tarjeta no está disponible</h1>
            <p>Puede que la tienda haya cambiado tu enlace o pausado la tarjeta. Pregunta en caja.</p>
        </div>
    </main>
</body>
</html>
<?php exit; endif; ?>
<body>
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
                <small><?= $who !== '' ? 'Hola, ' . $h($who) . '. Esta es tu tarjeta.' : 'Esta es tu tarjeta.' ?></small>
            </div>
        </header>

        <section class="card" aria-label="Tarjeta <?= $h($c['type']) ?>">
            <div class="card-top">
                <span class="card-type"><?= $h($c['type']) ?></span>
                <span class="card-brand"><?= $h($store) ?></span>
            </div>
            <p class="card-number<?= strlen($number) > 16 ? ' is-long' : '' ?>"><?= $h($number) ?></p>
<?php if ($goal > 0): ?>
            <div class="card-stamps" aria-hidden="true"><?= $stampRow(min($goal, 20), $onCardSt, 'st') ?></div>
<?php endif; ?>
            <div class="card-bottom">
                <div class="card-owner">
                    <span class="card-label">Titular</span>
                    <span class="card-holder<?= $onCard === '' ? ' is-empty' : '' ?>"><?= $onCard !== '' ? $h($onCard) : 'Al portador' ?></span>
                </div>
                <div class="perks">
<?php if ($goal > 0): ?>
                    <div class="perk"><b><?= $onCardSt ?>/<?= $goal ?></b><span>sellos</span></div>
<?php endif; ?>
<?php if ($discount > 0): ?>
                    <div class="perk"><b><?= $h($pct($discount)) ?></b><span>descuento</span></div>
<?php endif; ?>
<?php if ($points > 0): ?>
                    <div class="perk"><b><?= $h($pct($points)) ?></b><span>puntos</span></div>
<?php endif; ?>
                </div>
            </div>
        </section>

        <section class="qr" aria-label="Código para leer en caja">
            <div class="qr-code" id="qr" data-code="<?= $h($number) ?>"></div>
            <p class="qr-number"><?= $h($number) ?></p>
            <p class="qr-hint">Enséñalo en caja al pagar. Si el lector no lo lee, sube el brillo o di el número.</p>
        </section>

        <section class="box">
            <h2><i><?= $svg($goal > 0 ? 'gift' : ($points > 0 && $discount <= 0 ? 'wallet' : 'tag')) ?></i>Lo que te da</h2>
<?php if ($goal > 0): ?>
            <p class="lead">1 sello por cada <?= $h($short($c['stamp_amount'])) ?> que pagas. Con <?= $goal ?> sellos: <?= $h($reward) ?>.</p>
            <div class="stamps" role="img" aria-label="Llevas <?= $onCardSt ?> de <?= $goal ?> sellos"><?= $stampRow($goal, $onCardSt, 'st') ?></div>
<?php if ($ready > 0): ?>
            <p class="ready">¡Tu premio está listo! Pídelo en caja: <?= $h($reward) ?> (vale hasta <?= $h($money($c['reward_value'])) ?>).<?= $ready > 1 ? ' Tienes ' . $ready . ' premios.' : '' ?></p>
<?php else: ?>
            <p class="note">Te faltan <b><?= $goal - $have ?></b> <?= $goal - $have === 1 ? 'sello' : 'sellos' ?> para tu <?= $h($reward) ?>. Cuentan los pagos en efectivo, tarjeta o transferencia; no el monedero ni el crédito.</p>
<?php endif; ?>
<?php endif; ?>
<?php if ($discount > 0): ?>
            <p class="lead"><?= $h($pct($discount)) ?> de descuento en cada compra.</p>
<?php endif; ?>
<?php if ($points > 0): ?>
            <p class="lead"><?= $h($pct($points)) ?> de lo que pagas regresa a tu monedero.</p>
<?php if ($owner): ?>
            <div class="wallet">
                <small>Tu monedero hoy</small>
                <b><?= $h($money($d['wallet'])) ?></b>
            </div>
            <p class="note">Lo usas pagando con «Monedero» en caja. Lo que pagas con monedero no da puntos.</p>
<?php else: ?>
            <p class="note">Los puntos van al monedero del cliente de la compra: en caja da tu nombre o tu teléfono.</p>
<?php endif; ?>
<?php endif; ?>
            <div class="stats">
                <div class="stat"><small>Compras con tu tarjeta</small><b><?= $sales ?></b></div>
<?php if ($goal > 0): ?>
                <div class="stat"><small>Premios canjeados</small><b><?= (int) $st['rewards'] ?></b></div>
<?php elseif ($points > 0 && $discount <= 0): ?>
                <div class="stat"><small>Puntos ganados</small><b><?= $h($money($t['points'])) ?></b></div>
<?php else: ?>
                <div class="stat"><small>Te has ahorrado</small><b><?= $h($money($t['discount'])) ?></b></div>
<?php endif; ?>
            </div>
        </section>

<?php if ($moves): ?>
        <section class="box">
            <h2><i><?= $svg('card') ?></i>Tus últimas compras</h2>
            <ul class="moves">
<?php foreach ($moves as $m): ?>
<?php
    $save    = (float) $m['discount'];
    $earned  = (float) $m['points'];
    $prize   = (float) $m['reward'];
    $gotSt   = (int) $m['stamps'];
    $benefit = [];

    if ($prize > 0)      $benefit[] = ['is-save', 'Premio −' . $money($prize)];
    elseif ($save > 0)   $benefit[] = ['is-save', '−' . $money($save) . ' de descuento'];
    if ($earned > 0)     $benefit[] = ['is-points', '+' . $money($earned) . ' en puntos'];
    if ($gotSt > 0)      $benefit[] = ['is-points', '+' . $gotSt . ($gotSt === 1 ? ' sello' : ' sellos')];
?>
                <li class="move">
                    <div>
                        <b><?= $h($money($m['total'])) ?></b>
                        <small><?= $h(implode(' · ', array_filter([$dmy($m['created_at']), trim((string) $m['branch'])]))) ?></small>
                    </div>
<?php if ($benefit): ?>
                    <span class="<?= $benefit[0][0] ?>"><?= $h(implode(' · ', array_column($benefit, 1))) ?></span>
<?php else: ?>
                    <span class="is-none">Sin beneficio</span>
<?php endif; ?>
                </li>
<?php endforeach; ?>
            </ul>
        </section>
<?php endif; ?>

        <p class="tip"><?= $svg('home') ?><span>Para tenerla a la mano, en el menú de tu navegador elige «Agregar a pantalla de inicio».</span></p>
    </main>

    <footer class="by">Tarjeta digital con Huubie</footer>

    <script src="../../assets/plugins/qrcode/qrcode.js?v=<?= (int) $qrVersion ?>"></script>
<?php if ($icon !== ''): ?>
    <!-- El icono del sello es de Lucide: la misma copia local que usa Huubie. -->
    <script src="../../assets/plugins/lucide/lucide.min.js"></script>
    <script>if (window.lucide) lucide.createIcons();</script>
<?php endif; ?>
    <script>
        /* El QR lleva solo el numero: es lo que escribe el lector en Vender. Correccion M y margen de 4 modulos. */
        (function () {
            var box = document.getElementById('qr');
            if (!box || typeof qrcode !== 'function') return;
            var qr = qrcode(0, 'M');
            qr.addData(box.getAttribute('data-code') || '');
            qr.make();
            box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
            box.setAttribute('role', 'img');
            box.setAttribute('aria-label', 'Código QR de la tarjeta ' + (box.getAttribute('data-code') || ''));
        })();
    </script>
</body>
</html>
