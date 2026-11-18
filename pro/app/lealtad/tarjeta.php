<?php
/*  Tarjeta digital de lealtad: la pagina que abre el cliente en su telefono, SIN sesion.

      tarjeta.php?t=<token de 32 caracteres>   (card.token)

    Muestra la tarjeta como pase de Wallet (degradado del color de su tipo; ver
    lealtad/docs/propuesta-diseno.html) con sus sellos o su beneficio, el nivel
    y su barra si es de nivel, y un QR con el NUMERO para que en caja la lean con
    el lector igual que el plastico; debajo, lo que da, el monedero si la tarjeta
    tiene cliente dueño y sus ultimas compras. Todo lo pinta PHP; el QR lo dibuja
    qrcode-generator en el navegador (sin JavaScript queda el numero escrito,
    que tambien sirve).

    Animaciones (sin JavaScript o con «reducir movimiento», la tarjeta sale
    quieta y completa): entra subiendo, los sellos se llenan uno tras otro y el
    telefono recuerda (localStorage, por numero de tarjeta) lo que vio la ultima
    vez: los sellos nuevos caen girando, el monedero sube hasta su saldo, el
    premio recien completado echa confeti y el nivel nuevo gira a dorado. Al
    volver a la pestaña despues de 30 s, la pagina se recarga sola.

    Token con formato malo, que ya se cambio, tarjeta o tipo inactivos: la misma
    pagina 404, sin decir cual fue. Las etiquetas og llevan solo el nombre de la
    tienda: el enlace se comparte por WhatsApp y la vista previa no debe mostrar
    datos del cliente. Del cliente se muestra solo el primer nombre. */

require_once __DIR__ . '/../order/mdl/mdl-order.php';
require_once __DIR__ . '/../order/mdl/mdl-lealtad.php';
require_once __DIR__ . '/../order/mdl/mdl-lealtad-niveles.php';

class PublicCardPage extends mdl {

    use LoyaltyCards, LoyaltyLevels;

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
            'stamps' => $goal > 0 ? ['have' => max($this->qCardStamps($id), 0), 'goal' => $goal] + $this->qCardStampTotals($id) : null,
            'level'  => $goal > 0 ? null : $this->cardLevel($card)
        ];
    }

    /*  Su nivel, si su tipo esta en la escalera y Niveles esta encendido: el
        nombre, su lugar, el gasto de 12 meses y el siguiente (null = el mas
        alto). La barra va del minimo de su nivel al del siguiente. */
    private function cardLevel($card) {
        $setting = $this->qRow("SELECT levels_enabled FROM {$this->pos}loyalty_setting WHERE company_id = ? LIMIT 1", [(int) $card['company_id']]);

        if (!$setting || (int) $setting['levels_enabled'] !== 1) return null;

        $branchId = (int) $card['branch_id'];
        $levels   = $this->qLevels($branchId);
        $place    = $this->levelPlace($levels, (int) $card['card_type_id']);

        if (!$place || count($levels) < 2) return null;

        $row   = $this->qLevelCards($branchId, $this->levelSince(), (int) $card['id'])[0] ?? null;
        $spend = $row ? (float) $row['spend'] : 0.0;
        $above = $this->levelAbove($levels, (int) $card['card_type_id']);
        $from  = (float) $levels[$place - 1]['level_min_spend'];
        $goal  = $above ? (float) $above['level_min_spend'] : $spend;

        return [
            'name'  => (string) $levels[$place - 1]['name'],
            'place' => $place,
            'top'   => !$above,
            'spend' => $spend,
            'next'  => $above ? (string) $above['name'] : '',
            'left'  => $above ? max(0, $goal - $spend) : 0,
            'perk'  => $above ? $this->levelPerk($above) : '',
            'pct'   => $above && $goal > $from ? max(0, min(1, ($spend - $from) / ($goal - $from))) : 1
        ];
    }
}

// -- Datos --

$token = isset($_GET['t']) ? strtolower(trim((string) $_GET['t'])) : '';
$d     = null;

// Recién registrada desde registro.php: 'wa' = también salió por WhatsApp; '1' = solo en pantalla.
$fresh = in_array($_GET['nueva'] ?? '', ['wa', '1'], true) ? (string) $_GET['nueva'] : '';

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

// Iconos de Lucide copiados aqui: la pagina solo carga Lucide si el sello trae el suyo.
$icons = [
    'card'   => '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    'wallet' => '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    'tag'    => '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    'link'   => '<path d="M9 17H7A5 5 0 0 1 7 7"/><path d="M15 7h2a5 5 0 0 1 4 8"/><path d="M8 12h4"/><path d="m2 2 20 20"/>',
    'gift'   => '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
    'home'   => '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    'trophy' => '<path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"/><path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"/><path d="M18 9h1.5a1 1 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6 9H4.5a1 1 0 0 1 0-5H6"/>',
    'info'   => '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    'crown'  => '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>'
];

$svg = fn ($name, $size = 16) => '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $icons[$name] . '</svg>';

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
    $left     = $goal > 0 ? max(0, $goal - $have) : 0;
    $reward   = trim((string) $c['reward_name']);
    $level    = $d['level'];
    $wallet   = $owner && $points > 0 ? (float) $d['wallet'] : null;

    // Arriba a la derecha: la cifra de la tarjeta. Al centro: lo grande y la frase.
    if ($goal > 0)         [$valLabel, $valText] = ['Sellos', $onCardSt . '/' . $goal];
    elseif ($discount > 0) [$valLabel, $valText] = ['Descuento', $pct($discount)];
    elseif ($points > 0)   [$valLabel, $valText] = ['Puntos', $pct($points)];
    else                   [$valLabel, $valText] = ['', ''];

    if ($goal > 0) {
        $say = $ready > 0 ? '¡Premio listo: ' . $reward . '!' : ($left === 1 ? '¡Solo 1 sello para tu ' . $reward . '!' : 'Te faltan ' . $left . ' sellos para tu ' . $reward);
    } elseif ($wallet !== null) {
        $say = $pct($points) . ' de lo que pagas regresa a tu monedero.';
    } elseif ($discount > 0) {
        $say = 'En cada compra, al enseñar tu tarjeta.';
    } else {
        $say = '';
    }

    // Los 3 campos del pase.
    $fields = [['Titular', $onCard !== '' ? $onCard : 'Al portador']];

    if ($goal > 0)            array_push($fields, ['Premio', $reward], ['Vigencia', 'No caducan']);
    elseif ($points > 0)      array_push($fields, ['Ganado', $money($t['points'])], ['Compras', (string) $sales]);
    else                      array_push($fields, ['Ahorrado', $money($t['discount'])], ['Compras', (string) $sales]);

    /*  Un sello por cada uno de la meta: punteado; el juntado, lleno con el icono
        del tipo. El último es el premio (regalo). --k es su lugar: con él se
        llenan uno tras otro al abrir. */
    $stampRow = function ($count, $on) use ($icon, $h, $svg) {
        $out = '';

        for ($i = 0; $i < $count; $i++) {
            $gift = $i === $count - 1;
            $out .= '<span class="st' . ($i < $on ? ' is-on' : '') . ($gift ? ' is-gift' : '') . '" style="--k:' . $i . '">'
                  . ($gift ? $svg('gift', 16) : ($icon !== '' ? '<i data-lucide="' . $h($icon) . '"></i>' : ''))
                  . '</span>';
        }

        return $out;
    };

    $title = $store . ' · Tu tarjeta';
} else {
    $title = 'Tarjeta no disponible';
}

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
    <script>document.documentElement.classList.add('js');</script>
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

        /*  -- La tarjeta: un pase al estilo de Wallet. Degradado en diagonal del
            color de su tipo con un brillo encima; letra blanca u oscura segun el
            color (el mismo corte que inkOf de tarjetas.js). -- */
        .pass {
            --p-ink: <?= $ink ?>;
            --p-chip: <?= $d && $light ? 'rgba(15, 23, 42, .08)' : 'rgba(255, 255, 255, .22)' ?>;
            --p-line: <?= $d && $light ? 'rgba(15, 23, 42, .32)' : 'rgba(255, 255, 255, .6)' ?>;
            position: relative;
            isolation: isolate;
            overflow: hidden;
            border-radius: var(--radius);
            color: var(--p-ink);
            background: var(--card);
            background: linear-gradient(135deg, color-mix(in srgb, var(--card) <?= $d && $light ? '88%' : '70%' ?>, #000) 0%, var(--card) 58%, color-mix(in srgb, var(--card) <?= $d && $light ? '70%' : '78%' ?>, #FFF) 100%);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, .3), inset 0 0 0 .5px rgba(0, 0, 0, .1), 0 16px 30px -16px rgba(24, 12, 60, .55), 0 2px 4px rgba(24, 12, 60, .12);
            <?= $d && !$light ? 'text-shadow: 0 1px 1px rgba(0, 0, 0, .16);' : '' ?>
        }
        .pass::after { content: ""; position: absolute; inset: 0; z-index: 2; border-radius: inherit; pointer-events: none; background: linear-gradient(125deg, rgba(255, 255, 255, .2) 0%, rgba(255, 255, 255, 0) 35%, rgba(255, 255, 255, 0) 72%, rgba(255, 255, 255, .08) 100%); }
        .pass-head { display: flex; align-items: center; gap: 10px; padding: 16px 18px 0; }
        .pass-logo { width: 36px; height: 36px; flex: none; border-radius: 11px; display: grid; place-items: center; background: var(--p-chip); }
        .pass-logo svg { width: 20px; height: 20px; }
        .pass-name { flex: 1; min-width: 0; }
        .pass-name b { display: block; font-size: 18px; font-weight: 800; letter-spacing: -.015em; line-height: 1.15; overflow-wrap: anywhere; }
        .pass-name small { display: block; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 9.5px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; opacity: .8; }
        .pass-val { flex: none; text-align: right; line-height: 1; }
        .pass-val b { display: inline-block; font-size: 21px; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .lbl { display: block; margin-bottom: 5px; font-size: 9px; font-weight: 700; letter-spacing: .09em; line-height: 1; text-transform: uppercase; opacity: .8; }
        .pass-body { display: grid; gap: 12px; padding: 16px 18px; }
        .pass-big { display: flex; align-items: flex-end; gap: 8px; }
        .pass-big b { flex: none; font-size: 40px; font-weight: 800; letter-spacing: -.035em; line-height: 1; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .pass-big span { padding-bottom: 4px; font-size: 14px; font-weight: 600; line-height: 1.2; opacity: .9; }
        .pass-say { margin: 0; font-size: 13.5px; font-weight: 600; line-height: 1.35; }
        .pass-tier { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12.5px; font-weight: 600; }
        .pass-tier > span:last-child { min-width: 0; opacity: .92; text-align: right; }
        .badge { flex: none; display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 10px 0 8px; border-radius: 12px; background: var(--p-chip); font-size: 12px; font-weight: 700; white-space: nowrap; }
        .badge svg { width: 13px; height: 13px; }
        .badge em { display: inline-block; font-style: normal; }
        .badge.is-top { background: linear-gradient(135deg, #FFF1A8, #FFDA4A 45%, #F2B01E); color: #4A3200; text-shadow: none; }
        .bar { height: 7px; overflow: hidden; border-radius: 7px; background: <?= $d && $light ? 'rgba(15, 23, 42, .12)' : 'rgba(255, 255, 255, .26)' ?>; }
        .bar i { display: block; height: 100%; border-radius: inherit; background: var(--p-ink); transition: width 1.3s cubic-bezier(.3, .8, .3, 1); }
        .pass-fields { display: flex; justify-content: space-between; gap: 12px; padding: 0 18px; }
        .pass-fields > span { min-width: 0; }
        .pass-fields > span:last-child { text-align: right; }
        .pass-fields b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; }
        /* El QR: siempre negro sobre blanco, aun en modo oscuro, para que el lector lo lea. */
        .pass-qr { display: flex; flex-direction: column; align-items: center; padding: 18px 18px 0; }
        .pass-qrbox { position: relative; width: 100%; max-width: 212px; padding: 10px; border-radius: 16px; background: #FFFFFF; box-shadow: 0 8px 18px -6px rgba(0, 0, 0, .35); }
        .qr-code { width: 100%; aspect-ratio: 1; display: grid; place-items: center; color: #0F172A; }
        .qr-code svg { display: block; width: 100%; height: auto; }
        .pass-num { margin: 10px 0 0; font: 700 13px/1.2 ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; letter-spacing: .18em; overflow-wrap: anywhere; text-align: center; }
        .pass-ready { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; height: 26px; padding: 0 12px; border-radius: 13px; background: #FFDA4A; color: #3D2C00; font-size: 12px; font-weight: 700; text-shadow: none; }
        .pass-ready svg { width: 14px; height: 14px; }
        .pass-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 16px 18px 14px; font-size: 11px; font-weight: 500; opacity: .8; }
        .pass-foot svg { width: 14px; height: 14px; }
        .pass-sheen { position: absolute; top: 0; bottom: 0; left: 0; z-index: 3; width: 45%; pointer-events: none; background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, .5), rgba(255, 255, 255, 0)); transform: translateX(-130%) skewX(-18deg); }
        .qr-hint { margin: -4px auto 0; max-width: 36ch; font-size: 12.5px; color: var(--soft); text-align: center; }

        /* -- Sellos: punteados; el juntado, lleno del color de la letra con el icono del color de la tarjeta. El ultimo es el premio. -- */
        .pass-stamps { display: grid; grid-template-columns: repeat(5, minmax(0, 40px)); justify-content: space-between; row-gap: 10px; }
        .pass-stamps.is-many { grid-template-columns: repeat(10, minmax(0, 28px)); column-gap: 2px; row-gap: 7px; }
        .st { position: relative; display: grid; place-items: center; width: 100%; aspect-ratio: 1; border: 1.5px dashed var(--p-line); border-radius: 99px; color: var(--p-ink); }
        .st svg { width: 50%; height: 50%; stroke-width: 2.2; opacity: 0; }
        .st.is-gift svg { opacity: .65; }
        .st.is-on { border-style: solid; border-color: var(--p-ink); background: var(--p-ink); color: var(--card); box-shadow: 0 3px 8px rgba(0, 0, 0, .18); }
        .st.is-on svg { opacity: 1; }
        .ready { margin-top: 14px; padding: 12px 14px; border-radius: 14px; background: var(--chip); font-weight: 700; color: var(--ok); }

        /* -- Avance hacia el premio, en la caja de abajo -- */
        .progress { margin-top: 14px; display: grid; gap: 7px; }
        .progress-top { display: flex; justify-content: space-between; gap: 10px; font-size: 13.5px; }
        .progress-top span { flex: none; color: var(--soft); }
        .progress .track { height: 8px; overflow: hidden; border-radius: 99px; background: var(--chip); }
        .progress .track i { display: block; height: 100%; border-radius: inherit; background: var(--card); transition: width 1.3s cubic-bezier(.3, .8, .3, 1); }

        /* -- Movimiento (lo prende el script de abajo con .js en <html>) -- */
        .js .pass { animation: pass-in .8s cubic-bezier(.2, .85, .25, 1.06) both; }
        .js .st.is-on { animation: st-fill .45s calc(.35s + var(--k) * 60ms) cubic-bezier(.3, 1.4, .5, 1) both; }
        .st.is-new { animation: st-drop .62s cubic-bezier(.2, 1.3, .4, 1) both !important; }
        .st.is-new::after { content: ""; position: absolute; inset: -5px; border-radius: 50%; border: 2px solid var(--p-ink); animation: st-ring .75s .18s ease-out both; }
        .pass.is-done .st { animation: st-hop .55s calc(var(--k) * 55ms) cubic-bezier(.3, .7, .4, 1) both !important; }
        .pass.is-shine .pass-sheen, .pass.is-done .pass-sheen { animation: sheen 1.1s .4s ease-in-out 2; }
        .pop { animation: pop .5s cubic-bezier(.3, 1.6, .5, 1); }
        .badge.flip em { animation: flip .5s ease; }
        .badge.is-top.is-new { animation: gpulse 1s ease-out 3; }
        .cf { position: fixed; inset: 0; z-index: 50; width: 100%; height: 100%; pointer-events: none; }
        @keyframes pass-in { from { opacity: 0; transform: translateY(36px) scale(.96); } 60% { opacity: 1; } to { opacity: 1; transform: none; } }
        @keyframes st-fill { from { opacity: 0; transform: scale(.4); } }
        @keyframes st-drop { 0% { opacity: 0; transform: scale(2.4) rotate(-26deg); } 55% { opacity: 1; transform: scale(.88) rotate(4deg); } 78% { transform: scale(1.06); } 100% { opacity: 1; transform: none; } }
        @keyframes st-ring { from { opacity: .95; transform: scale(.8); } to { opacity: 0; transform: scale(1.9); } }
        @keyframes st-hop { 0%, 100% { transform: none; } 40% { transform: translateY(-8px) scale(1.08); } }
        @keyframes sheen { to { transform: translateX(330%) skewX(-18deg); } }
        @keyframes pop { 40% { transform: scale(1.3); } }
        @keyframes flip { to { transform: rotateX(360deg); } }
        @keyframes gpulse { from { box-shadow: 0 0 0 0 rgba(255, 218, 74, .85); } to { box-shadow: 0 0 0 12px rgba(255, 218, 74, 0); } }
        @media (prefers-reduced-motion: reduce) {
            .js .pass, .js .st.is-on, .st.is-new, .st.is-new::after, .pass.is-done .st, .pass.is-shine .pass-sheen, .pass.is-done .pass-sheen, .pop, .badge.flip em, .badge.is-top.is-new { animation: none !important; }
            .bar i, .progress .track i { transition: none; }
        }

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
        .fresh { margin: 0; padding: 12px 14px; border-radius: 14px; background: var(--paper); font-size: 14px; line-height: 1.45; }
        .fresh b { color: var(--ok); }
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
<?php if ($fresh !== ''): ?>

        <p class="fresh" role="status"><b>¡Listo, ya es tuya!</b> <?= $fresh === 'wa' ? 'También te la mandamos por WhatsApp: ahí la tienes siempre.' : 'Guarda esta página: agrégala a tu pantalla de inicio.' ?></p>
<?php endif; ?>

        <section class="pass<?= $ready > 0 ? ' is-ready' : '' ?>" aria-label="Tarjeta <?= $h($c['type']) ?>"
                 data-num="<?= $h($number) ?>" data-stamps="<?= $goal > 0 ? $have : 0 ?>" data-goal="<?= $goal ?>"
                 data-wallet="<?= $wallet !== null ? number_format($wallet, 2, '.', '') : '' ?>" data-level="<?= $level ? $h($level['name']) : '' ?>">
            <div class="pass-head">
                <span class="pass-logo" aria-hidden="true"><?= $goal > 0 ? ($icon !== '' ? '<i data-lucide="' . $h($icon) . '"></i>' : $svg('gift', 20)) : ($level ? $svg('crown', 20) : $svg($points > 0 && $discount <= 0 ? 'wallet' : 'tag', 20)) ?></span>
                <div class="pass-name"><b><?= $h($c['type']) ?></b><small><?= $h($store) ?></small></div>
<?php if ($valText !== ''): ?>
                <div class="pass-val"><span class="lbl"><?= $h($valLabel) ?></span><b id="passVal"><?= $h($valText) ?></b></div>
<?php endif; ?>
            </div>
            <div class="pass-body">
<?php if ($goal > 0): ?>
                <div class="pass-stamps<?= $goal > 10 ? ' is-many' : '' ?>" role="img" aria-label="Llevas <?= $onCardSt ?> de <?= $goal ?> sellos"><?= $stampRow(min($goal, 20), $onCardSt) ?></div>
<?php elseif ($wallet !== null): ?>
                <div class="pass-big"><b id="passWallet"><?= $h($money($wallet)) ?></b><span>en tu monedero</span></div>
<?php elseif ($discount > 0 || $points > 0): ?>
                <div class="pass-big"><b><?= $h($pct($discount > 0 ? $discount : $points)) ?></b><span><?= $discount > 0 ? 'de descuento' : 'en puntos al monedero' ?></span></div>
<?php endif; ?>
<?php if ($level): ?>
                <div class="pass-tier">
                    <span class="badge<?= $level['top'] ? ' is-top' : '' ?>"><?= $svg('trophy', 13) ?><em><?= $h($level['name']) ?></em></span>
                    <span><?= $level['top'] ? 'Tu nivel más alto' : 'Faltan ' . $h($short($level['left'])) . ' para ' . $h($level['next']) ?></span>
                </div>
                <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="<?= (int) round($level['pct'] * 100) ?>"><i data-fill="<?= round($level['pct'] * 100, 1) ?>" style="width:<?= round($level['pct'] * 100, 1) ?>%"></i></div>
<?php endif; ?>
<?php if ($say !== ''): ?>
                <p class="pass-say"><?= $h($say) ?></p>
<?php endif; ?>
            </div>
            <div class="pass-fields">
<?php foreach ($fields as [$label, $value]): ?>
                <span><span class="lbl"><?= $h($label) ?></span><b><?= $h($value) ?></b></span>
<?php endforeach; ?>
            </div>
            <div class="pass-qr" aria-label="Código para leer en caja">
                <div class="pass-qrbox"><div class="qr-code" id="qr" data-code="<?= $h($number) ?>"></div></div>
                <p class="pass-num"><?= $h($number) ?></p>
<?php if ($ready > 0): ?>
                <span class="pass-ready"><?= $svg('gift', 14) ?>Listo para canjear<?= $ready > 1 ? ' · ' . $ready : '' ?></span>
<?php endif; ?>
            </div>
            <div class="pass-foot"><span>Actualizado hace un momento</span><?= $svg('info', 14) ?></div>
            <i class="pass-sheen" aria-hidden="true"></i>
        </section>
        <p class="qr-hint">Enséñala en caja al pagar. Si el lector no lee el QR, sube el brillo o di el número.</p>

        <section class="box">
            <h2><i><?= $svg($goal > 0 ? 'gift' : ($points > 0 && $discount <= 0 ? 'wallet' : 'tag')) ?></i>Lo que te da</h2>
<?php if ($goal > 0): ?>
            <p class="lead">1 sello por cada <?= $h($short($c['stamp_amount'])) ?> que pagas. Con <?= $goal ?> sellos: <?= $h($reward) ?>.</p>
            <div class="progress">
                <div class="progress-top"><b><?= $ready > 0 ? 'Premio listo' : 'Faltan ' . $left . ($left === 1 ? ' sello' : ' sellos') ?></b><span><?= $onCardSt ?> de <?= $goal ?></span></div>
                <div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="<?= $goal ?>" aria-valuenow="<?= $onCardSt ?>"><i data-fill="<?= round($onCardSt / $goal * 100, 1) ?>" style="width:<?= round($onCardSt / $goal * 100, 1) ?>%"></i></div>
            </div>
<?php if ($ready > 0): ?>
            <p class="ready">¡Tu premio está listo! Pídelo en caja: <?= $h($reward) ?> (vale hasta <?= $h($money($c['reward_value'])) ?>).<?= $ready > 1 ? ' Tienes ' . $ready . ' premios.' : '' ?></p>
<?php else: ?>
            <p class="note">Unos <?= $h($short($left * (float) $c['stamp_amount'])) ?> más en compras. Cuentan los pagos en efectivo, tarjeta o transferencia; no el monedero ni el crédito. Los sellos no caducan.</p>
<?php endif; ?>
<?php endif; ?>
<?php if ($discount > 0): ?>
            <p class="lead"><?= $h($pct($discount)) ?> de descuento en cada compra.</p>
<?php endif; ?>
<?php if ($points > 0): ?>
            <p class="lead"><?= $h($pct($points)) ?> de lo que pagas regresa a tu monedero.</p>
<?php if ($owner): ?>
            <p class="note">Tu monedero hoy: <b><?= $h($money($d['wallet'])) ?></b>. Lo usas pagando con «Monedero» en caja; lo que pagas con monedero no da puntos.</p>
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

        /*  Movimiento. El telefono recuerda lo que vio la ultima vez (localStorage,
            por numero): sellos, monedero, nivel y si el premio ya estaba listo.
            Con eso anima solo lo nuevo. Si localStorage falla, todo sale quieto
            salvo la entrada. Con «reducir movimiento», nada se mueve. */
        (function () {
            var pass = document.querySelector('.pass');
            if (!pass) return;

            var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
            var key    = 'huubie:tarjeta:' + (pass.getAttribute('data-num') || '');
            var now    = {
                stamps: Number(pass.getAttribute('data-stamps')) || 0,
                wallet: pass.getAttribute('data-wallet') === '' ? null : Number(pass.getAttribute('data-wallet')),
                level:  pass.getAttribute('data-level') || '',
                ready:  pass.classList.contains('is-ready')
            };
            var seen = null;

            try { seen = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { seen = null; }
            try { localStorage.setItem(key, JSON.stringify(now)); } catch (e) { /* sin memoria: no pasa nada */ }

            // Las barras se llenan desde cero al abrir.
            var bars = document.querySelectorAll('[data-fill]');

            if (!reduce) {
                Array.prototype.forEach.call(bars, function (bar) { bar.style.width = '0%'; });
                requestAnimationFrame(function () { requestAnimationFrame(function () {
                    Array.prototype.forEach.call(bars, function (bar) { bar.style.width = bar.getAttribute('data-fill') + '%'; });
                }); });
            }

            // Al volver a la pestaña despues de un rato, la pagina se recarga: asi se ve lo que paso en caja.
            var away = 0;

            document.addEventListener('visibilitychange', function () {
                if (document.hidden) { away = Date.now(); return; }
                if (away && Date.now() - away > 30000) location.reload();
            });

            if (reduce) return;

            var pop = function (el) { if (!el) return; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); };
            var goal = Number(pass.getAttribute('data-goal')) || 0;

            // Sellos nuevos desde la ultima visita: caen uno tras otro despues de la entrada.
            if (seen && goal > 0 && now.stamps > seen.stamps) {
                var stamps = pass.querySelectorAll('.st');
                var from   = Math.max(0, Math.min(seen.stamps, goal));
                var to     = Math.min(now.stamps, goal);

                for (var i = from; i < to; i++) {
                    (function (st, delay) {
                        setTimeout(function () { st.classList.add('is-new'); }, delay);
                    })(stamps[i], 900 + (i - from) * 260);
                }

                setTimeout(function () { pop(document.getElementById('passVal')); }, 900 + (to - from) * 260);
            }

            // Premio recien completado (o la primera vez que se ve listo): ola, brillo y confeti. Ya visto: solo el brillo.
            if (now.ready && (!seen || !seen.ready)) {
                setTimeout(function () { pass.classList.add('is-done'); confetti(['#FFDA4A', '#FFFFFF', getComputedStyle(pass).getPropertyValue('--card').trim() || '#7C3AED', '#FF4F7B', '#4ADE80']); }, seen && now.stamps > seen.stamps ? 1600 : 900);
            } else if (now.ready) {
                pass.classList.add('is-shine');
            }

            // Monedero que subio: cuenta hasta el saldo de hoy.
            var walletEl = document.getElementById('passWallet');

            if (seen && walletEl && seen.wallet !== null && now.wallet !== null && now.wallet > seen.wallet) {
                var a = seen.wallet, b = now.wallet, t0 = 0;
                var fmt = function (n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

                walletEl.textContent = fmt(a);
                setTimeout(function () {
                    requestAnimationFrame(function tick(t) {
                        if (!t0) t0 = t;
                        var k = Math.min(1, (t - t0) / 1300), e = 1 - Math.pow(1 - k, 3);
                        walletEl.textContent = fmt(a + (b - a) * e);
                        if (k < 1) requestAnimationFrame(tick); else pop(walletEl);
                    });
                }, 800);
            }

            // Nivel nuevo: la insignia gira, brilla y, si es el mas alto, pulsa dorada.
            var badge = pass.querySelector('.badge');

            if (seen && seen.level && now.level && seen.level !== now.level && badge) {
                setTimeout(function () {
                    badge.classList.add('flip', 'is-new');
                    pass.classList.add('is-shine');
                    if (badge.classList.contains('is-top')) confetti(['#FFDA4A', '#F2B01E', '#FFF1A8', '#FFFFFF']);
                }, 900);
            }

            // Confeti sobre toda la pantalla, 2.6 s.
            function confetti(colors) {
                var canvas = document.createElement('canvas');
                var ctx    = canvas.getContext && canvas.getContext('2d');
                if (!ctx) return;

                var dpr = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight;
                var box = pass.getBoundingClientRect(), cx = box.left + box.width / 2, cy = Math.max(40, box.top + 120);

                canvas.className = 'cf';
                canvas.width     = W * dpr;
                canvas.height    = H * dpr;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                document.body.appendChild(canvas);

                var bits = [];

                for (var n = 0; n < 140; n++) {
                    bits.push({ x: cx + (Math.random() - .5) * 80, y: cy, vx: (Math.random() - .5) * 11, vy: -Math.random() * 9 - 3, g: .22 + Math.random() * .08,
                                r: Math.random() * 6, vr: (Math.random() - .5) * .35, w: 5 + Math.random() * 5, h: 8 + Math.random() * 7, c: colors[n % colors.length], round: Math.random() < .3 });
                }

                var start = 0;

                requestAnimationFrame(function frame(t) {
                    if (!start) start = t;
                    var k = (t - start) / 2600;

                    ctx.clearRect(0, 0, W, H);
                    bits.forEach(function (p) {
                        p.vy += p.g; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
                        ctx.save();
                        ctx.globalAlpha = Math.max(0, 1 - k * k);
                        ctx.translate(p.x, p.y);
                        ctx.rotate(p.r);
                        ctx.fillStyle = p.c;
                        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, 7); ctx.fill(); }
                        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
                        ctx.restore();
                    });

                    if (k < 1) requestAnimationFrame(frame); else canvas.remove();
                });
            }
        })();
    </script>
</body>
</html>
