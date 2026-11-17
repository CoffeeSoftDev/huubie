<?php
/*  V8 · Tienda en linea: la pagina que abre el cliente, SIN sesion.

      pedir.php?t=<token de 16 caracteres>

    Aqui solo se pinta la portada (nombre, logo, color, como entrega y como
    cobra) para que salga al instante y con el color de la tienda. El catalogo,
    el carrito, el formulario y la confirmacion los pinta src/js/pedir.js, que
    habla con ctrl/ctrl-pedir.php.

    Token con formato malo, que no existe o de una sucursal inactiva: la misma
    pagina 404, sin decir cual fue. */

require_once __DIR__ . '/mdl/mdl-order.php';
require_once __DIR__ . '/mdl/mdl-tienda.php';

class PublicStorePage extends mdl {

    use OnlineStore;

    public function load($token) {
        if (!preg_match('/^[a-f0-9]{16}$/', $token)) return null;

        return $this->qStoreByToken($token) ?: null;
    }
}

// -- Datos --

$token = isset($_GET['t']) ? strtolower(trim((string) $_GET['t'])) : '';
$s     = null;

try {
    $s = (new PublicStorePage())->load($token);
} catch (Throwable $e) {
    $s = null;
}

if (!$s) http_response_code(404);

header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');

$h = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');

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

$accent = '#233876';
$ink    = '#FFFFFF';
$text   = $accent;

if ($s) {
    if (preg_match('/^#[0-9A-F]{6}$/i', (string) $s['accent'])) $accent = strtoupper($s['accent']);

    // Texto sobre el color: blanco si el color es oscuro, casi negro si es claro.
    [$r, $g, $b] = sscanf($accent, '#%02x%02x%02x');
    $light = (0.2126 * $r + 0.7152 * $g + 0.0722 * $b) / 255 > 0.62;
    $ink   = $light ? '#0F172A' : '#FFFFFF';
    $text  = $light ? "color-mix(in srgb, {$accent} 55%, #000)" : $accent;

    $name    = trim((string) $s['title']) !== '' ? trim($s['title']) : (trim((string) $s['company']) !== '' ? trim($s['company']) : trim((string) $s['branch']));
    $message = trim((string) $s['message']);
    $branch  = trim((string) $s['branch']);
    $address = trim((string) $s['address']);
    $open    = (int) $s['active'] === 1;
    $logoRaw = trim((string) $s['branch_logo']) !== '' ? $s['branch_logo'] : $s['company_logo'];
    $logo    = $file($logoRaw);
    $lead    = (int) $s['lead_days'];

    $perks = [];
    if ((int) $s['pickup'] === 1)       $perks[] = ['store', 'Recoges en tienda'];
    if ((int) $s['delivery'] === 1)     $perks[] = ['truck', 'Envío a domicilio'];
    if ((int) $s['pay_transfer'] === 1) $perks[] = ['bank', 'Transferencia'];
    if ((int) $s['pay_store'] === 1)    $perks[] = ['wallet', 'Pago en tienda'];
    if ($lead > 0)                      $perks[] = ['calendar', 'Pide con ' . ($lead === 1 ? '1 día' : "{$lead} días") . ' de anticipación'];

    $title = $name . ' · Haz tu pedido';

    // Vista previa al compartir el enlace por WhatsApp.
    $scheme  = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host    = preg_replace('/[^a-z0-9.:\-]/i', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
    $ogImage = ($logo !== '' && $host !== '' && $logo[0] === '/') ? "{$scheme}://{$host}{$logo}" : $logo;
    $ogText  = $message !== '' ? $message : 'Elige tus productos y haz tu pedido en línea.';
} else {
    $title = 'Enlace no válido';
}

// Fondo claro de la portada: 6 % del color de la tienda sobre blanco. Tambien tiñe la barra del navegador.
[$r, $g, $b] = sscanf($accent, '#%02x%02x%02x');
$heroBg = sprintf('#%02X%02X%02X', round($r * .06 + 255 * .94), round($g * .06 + 255 * .94), round($b * .06 + 255 * .94));

$icons = [
    'store'    => '<path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>',
    'truck'    => '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    'bank'     => '<path d="M3 22h18"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="m12 2 8 5H4z"/>',
    'wallet'   => '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    'calendar' => '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    'pin'      => '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    'link'     => '<path d="M9 17H7A5 5 0 0 1 7 7"/><path d="M15 7h2a5 5 0 0 1 4 8"/><path d="M8 12h4"/><path d="m2 2 20 20"/>'
];

$svg = fn ($name, $size = 16) => '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $icons[$name] . '</svg>';

// Icono de la pestaña: la bolsa sobre el color de la tienda. Asi el navegador no pide /favicon.ico.
$favicon = 'data:image/svg+xml,' . rawurlencode(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
    . '<rect width="32" height="32" rx="8" fill="' . $accent . '"/>'
    . '<g transform="translate(6 6) scale(.8333)" fill="none" stroke="' . $ink . '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
    . '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>'
    . '</g></svg>'
);

$jsVersion = @filemtime(__DIR__ . '/src/js/pedir.js') ?: 1;
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="robots" content="noindex, nofollow">
    <meta name="color-scheme" content="light">
    <meta name="theme-color" content="<?= $h($heroBg) ?>">
    <title><?= $h($title) ?></title>
    <link rel="icon" type="image/svg+xml" href="<?= $h($favicon) ?>">
<?php if ($s): ?>
    <meta property="og:type" content="website">
    <meta property="og:title" content="<?= $h($name) ?>">
    <meta property="og:description" content="<?= $h($ogText) ?>">
<?php if ($ogImage !== ''): ?>
    <meta property="og:image" content="<?= $h($ogImage) ?>">
<?php endif; ?>
<?php endif; ?>
    <script>
        /* Foto que no carga: un intento contra huubie.com.mx (las fotos viven alla) y luego las iniciales.
           Va aqui arriba para alcanzar tambien al logo de la portada. */
        document.addEventListener('error', function (e) {
            var img = e.target;
            if (!img || img.tagName !== 'IMG' || !img.dataset || !img.dataset.src) return;
            var path = img.dataset.src;
            if (!img.dataset.retry && path.charAt(0) === '/' && location.hostname !== 'huubie.com.mx') {
                img.dataset.retry = '1';
                img.src = 'https://huubie.com.mx' + path;
                return;
            }
            // Card del catalogo (sin data-ini): se quita la foto y queda el icono de la categoria, como en el POS.
            if (!img.dataset.ini) { img.remove(); return; }
            var box = img.parentNode, span = document.createElement('span');
            span.className = 'ini';
            span.textContent = img.dataset.ini || '';
            if (box) { box.classList.add('is-empty'); box.replaceChild(span, img); }
        }, true);
    </script>
    <style>
        :root {
            --bg: #F5F6F8;
            --paper: #FFFFFF;
            --ink: #0F172A;
            --soft: #5B6577;
            --faint: #94A3B8;
            --line: #E4E7EC;
            --chip: #EEF1F5;
            --field: #FFFFFF;
            --brand: <?= $h($accent) ?>;
            --brand-ink: <?= $h($ink) ?>;
            --brand-text: <?= $h($text) ?>;
            --brand-soft: color-mix(in srgb, var(--brand) 9%, var(--paper));
            --brand-line: color-mix(in srgb, var(--brand) 38%, var(--line));
            --ok: #15803D;
            --ok-soft: #DCFCE7;
            --danger: #B91C1C;
            --danger-soft: #FEE2E2;
            --wa: #1FAF54;
            --radius: 18px;
            --shadow: 0 1px 2px rgba(15, 23, 42, .05), 0 10px 30px -18px rgba(15, 23, 42, .28);
            --top: 0px;
        }
        /* Siempre en claro: sin version oscura aunque el telefono este en modo oscuro. */
        *, *::before, *::after { box-sizing: border-box; }
        html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
        html.lock { overflow: hidden; }
        body {
            margin: 0;
            background: var(--bg);
            color: var(--ink);
            font: 15px/1.5 "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
            overflow-x: hidden;
        }
        button, input, textarea, select { font: inherit; color: inherit; }
        button { cursor: pointer; }
        img { display: block; max-width: 100%; }
        svg { flex: none; }
        [hidden] { display: none !important; }
        .wrap { width: 100%; max-width: 1180px; margin: 0 auto; padding: 0 16px; }
        .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        :focus-visible { outline: 3px solid color-mix(in srgb, var(--brand) 55%, transparent); outline-offset: 2px; }

        /* -- Portada --
           Clara: un velo del color de la tienda sobre blanco y letra oscura.
           El color fuerte queda para los botones y la categoria activa. */
        .hero {
            background:
                radial-gradient(70% 120% at 100% 0%, color-mix(in srgb, var(--brand) 12%, transparent), transparent 65%),
                <?= $h($heroBg) ?>;
            color: var(--ink);
            border-bottom: 1px solid color-mix(in srgb, var(--brand) 10%, var(--line));
            padding: 28px 0 64px;
        }
        .hero-in { display: flex; gap: 18px; align-items: center; }
        .logo {
            width: 76px; height: 76px; flex: none;
            border-radius: 22px;
            background: var(--paper);
            box-shadow: 0 0 0 1px var(--line), 0 10px 24px -14px rgba(15, 23, 42, .35);
            display: grid; place-items: center;
            overflow: hidden;
        }
        .logo img { width: 100%; height: 100%; object-fit: cover; }
        .logo .ini { font-weight: 800; font-size: 26px; color: var(--brand-text); letter-spacing: -.02em; }
        .state {
            display: inline-flex; align-items: center; gap: 8px;
            font-size: 12px; font-weight: 700; letter-spacing: .02em;
            padding: 4px 10px 4px 8px; border-radius: 999px;
            background: var(--paper); color: var(--soft);
            border: 1px solid var(--line);
        }
        .state::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #22C55E; box-shadow: 0 0 0 3px rgba(34, 197, 94, .18); }
        .state.is-closed::before { background: #F59E0B; box-shadow: 0 0 0 3px rgba(245, 158, 11, .18); }
        .hero h1 { margin: 8px 0 2px; font-size: clamp(24px, 4.6vw, 36px); line-height: 1.12; letter-spacing: -.025em; font-weight: 800; }
        .hero .msg { margin: 6px 0 0; max-width: 62ch; color: var(--soft); }
        .hero .where { margin: 8px 0 0; display: flex; gap: 6px; align-items: center; font-size: 13px; color: var(--soft); }
        .perks {
            margin-top: -38px;
            position: relative;
        }
        .perks-in {
            background: var(--paper);
            border-radius: var(--radius);
            box-shadow: var(--shadow);
            padding: 12px;
            display: flex; flex-wrap: wrap; gap: 8px;
        }
        .perk {
            display: inline-flex; align-items: center; gap: 7px;
            padding: 7px 12px; border-radius: 999px;
            background: var(--brand-soft); color: var(--brand-text);
            font-size: 13px; font-weight: 600;
        }
        @media (min-width: 720px) {
            .hero { padding: 40px 0 76px; }
            .logo { width: 96px; height: 96px; border-radius: 26px; }
            .logo .ini { font-size: 32px; }
        }

        /* -- Barra de busqueda y categorias -- */
        .bar {
            position: sticky; top: 0; z-index: 20;
            background: color-mix(in srgb, var(--bg) 88%, transparent);
            -webkit-backdrop-filter: saturate(1.4) blur(12px);
            backdrop-filter: saturate(1.4) blur(12px);
            padding: 14px 0 10px;
            margin-top: 8px;
        }
        .bar.is-stuck { box-shadow: 0 1px 0 var(--line); }
        .bar-in { display: flex; flex-direction: column; gap: 10px; }
        .search {
            position: relative; display: flex; align-items: center;
        }
        .search svg { position: absolute; left: 14px; color: var(--faint); pointer-events: none; }
        .search input {
            width: 100%; height: 46px;
            border-radius: 14px; border: 1px solid var(--line);
            background: var(--field);
            padding: 0 40px 0 42px;
            outline: none;
            transition: border-color .15s, box-shadow .15s;
        }
        .search input:focus { border-color: var(--brand-line); box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand) 14%, transparent); }
        /* La «×» nativa de type=search sobra: ya esta el boton .clear. */
        .search input::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; display: none; }
        .search .clear {
            position: absolute; right: 6px;
            width: 34px; height: 34px; border-radius: 10px;
            border: 0; background: transparent; color: var(--soft);
            display: grid; place-items: center;
        }
        .chips { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; -webkit-overflow-scrolling: touch; }
        .chips::-webkit-scrollbar { display: none; }
        .chip {
            flex: none; white-space: nowrap;
            height: 36px; padding: 0 14px;
            border-radius: 999px; border: 1px solid var(--line);
            background: var(--paper); color: var(--soft);
            font-size: 13px; font-weight: 600;
            display: inline-flex; align-items: center; gap: 6px;
            transition: background .15s, color .15s, border-color .15s;
        }
        .chip small { font-size: 11px; font-weight: 700; opacity: .7; }
        .chip.is-active { background: var(--brand); border-color: var(--brand); color: var(--brand-ink); }
        @media (min-width: 720px) {
            .bar-in { flex-direction: row; align-items: center; }
            .search { flex: 0 0 300px; }
            .chips { flex: 1; }
        }

        /* -- Esqueleto de carga -- */
        .skel { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); padding: 22px 0 40px; }
        .skel div { height: 140px; border-radius: 12px; background: linear-gradient(90deg, var(--chip), var(--paper), var(--chip)); background-size: 200% 100%; animation: shimmer 1.4s infinite linear; }
        @media (max-width: 639.98px) { .skel { gap: 8px; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); } }
        @keyframes shimmer { to { background-position: -200% 0; } }

        /* -- Acomodo -- */
        /* minmax(0, 1fr): sin el, la fila de dias (9 botones) ensancha la columna en celular. */
        .layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; padding: 6px 0 120px; align-items: start; }
        @media (min-width: 980px) {
            .layout { grid-template-columns: minmax(0, 1fr) 360px; padding-bottom: 56px; }
        }
        body.is-done .layout { grid-template-columns: minmax(0, 640px); justify-content: center; }
        body.is-done .cart, body.is-done .cartbar, body.is-done .bar { display: none !important; }

        /* -- Catalogo -- */
        .cat { scroll-margin-top: calc(var(--top) + 12px); padding-top: 14px; }
        .cat h2 { margin: 0 0 12px; font-size: 18px; font-weight: 800; letter-spacing: -.01em; display: flex; align-items: baseline; gap: 8px; }
        .cat h2 small { font-size: 12px; font-weight: 700; color: var(--faint); }
        /* Cards iguales a las del POS (pos-catalog.js + sale-cat de order.css): foto de 84 px
           con margen y esquinas, nombre en una linea, precio y un «+» redondo. Tocar la card
           abre la ficha; el «+» agrega uno. */
        .grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); }
        @media (max-width: 639.98px) { .grid { gap: 8px; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); } }

        .card {
            position: relative;
            display: flex; flex-direction: column;
            min-width: 0;
            background: #FFFFFF;
            border: 1px solid #E5E7EB;
            border-radius: 12px;
            color: #111827;
            overflow: hidden;
            transition: border-color .15s, box-shadow .15s;
        }
        .card:hover { border-color: #D1D5DB; box-shadow: 0 6px 18px -8px rgba(0, 0, 0, .25); }
        .card.is-in { border-color: var(--brand-line); }
        .card .open { all: unset; cursor: pointer; display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .card .open:focus-visible { outline: 3px solid color-mix(in srgb, var(--brand) 45%, transparent); outline-offset: -3px; border-radius: 12px; }
        .pc-top {
            position: relative;
            display: flex; align-items: center; justify-content: center;
            height: 84px; margin: 6px 6px 0; flex-shrink: 0;
            border-radius: 9px; overflow: hidden;
            background: color-mix(in srgb, var(--brand) 9%, #FFFFFF);
            color: var(--brand);
        }
        .pc-top svg { width: 26px; height: 26px; }
        .pc-top img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .pc-body { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; padding: 8px 10px 9px; }
        .pc-name { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 12.5px; font-weight: 600; line-height: 1.3; }
        /* min-height y padding-right: el «+» va encima, a la derecha del precio. */
        .pc-foot { display: flex; align-items: center; min-height: 24px; margin-top: auto; padding-right: 30px; }
        .pc-foot b { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .pc-add {
            position: absolute; right: 10px; bottom: 9px;
            width: 24px; height: 24px; padding: 0;
            border: 0; border-radius: 999px;
            background: var(--brand-soft); color: var(--brand-text);
            display: grid; place-items: center;
            transition: background-color .15s, color .15s;
        }
        /* Area de toque de 40 px sin agrandar el circulo. */
        .pc-add::before { content: ""; position: absolute; inset: -8px; }
        .pc-add svg { width: 14px; height: 14px; }
        .card:hover .pc-add { background: var(--brand); color: var(--brand-ink); }
        .pc-add:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 18%, transparent); }
        .ph {
            position: relative;
            aspect-ratio: 4 / 3;
            background: var(--brand-soft);
            display: grid; place-items: center;
            overflow: hidden;
        }
        .ph img { width: 100%; height: 100%; object-fit: cover; }
        .ph .ini { font-weight: 800; font-size: 28px; color: var(--brand-text); opacity: .75; letter-spacing: -.02em; }
        /* Piezas en el carrito: sobre la foto de la card. */
        .badge {
            position: absolute; top: 6px; right: 6px;
            min-width: 24px; height: 24px; padding: 0 7px;
            border-radius: 999px;
            background: var(--brand); color: var(--brand-ink);
            font-size: 12px; font-weight: 800;
            display: grid; place-items: center;
            box-shadow: 0 4px 12px -4px rgba(0, 0, 0, .4);
        }
        .price { font-weight: 800; font-size: 16px; letter-spacing: -.01em; }

        .step {
            display: inline-flex; align-items: center;
            height: 40px; border-radius: 12px;
            background: var(--brand-soft);
            border: 1px solid var(--brand-line);
        }
        .step button {
            width: 36px; height: 38px; border: 0; background: transparent;
            color: var(--brand-text); display: grid; place-items: center;
        }
        .step span { min-width: 22px; text-align: center; font-weight: 800; font-size: 14px; color: var(--brand-text); }
        .step.sm { height: 34px; border-radius: 10px; }
        .step.sm button { width: 30px; height: 32px; }
        .step.lg { height: 50px; border-radius: 14px; }
        .step.lg button { width: 48px; height: 48px; }
        .step.lg span { min-width: 34px; font-size: 17px; }

        .empty { text-align: center; padding: 48px 16px; color: var(--soft); }
        .empty svg { color: var(--faint); margin: 0 auto 10px; display: block; }
        .empty b { display: block; color: var(--ink); font-size: 16px; margin-bottom: 4px; }

        /* -- Carrito: panel a la derecha (escritorio) u hoja que sube (celular) -- */
        .cart {
            background: var(--paper);
            border-radius: var(--radius);
            box-shadow: var(--shadow);
            display: flex; flex-direction: column;
            max-height: calc(100vh - var(--top) - 32px);
        }
        @media (min-width: 980px) { .cart { position: sticky; top: calc(var(--top) + 16px); } }
        .cart-head { display: flex; align-items: center; gap: 10px; padding: 18px 18px 12px; border-bottom: 1px solid var(--line); }
        .cart-head h2 { margin: 0; font-size: 17px; font-weight: 800; flex: 1; }
        .cart-head small { color: var(--soft); font-size: 13px; font-weight: 600; }
        .cart-list { overflow-y: auto; padding: 4px 18px; flex: 1; min-height: 0; overscroll-behavior: contain; }
        .line { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--line); }
        .line:last-child { border-bottom: 0; }
        .line .ph { width: 52px; height: 52px; aspect-ratio: auto; border-radius: 12px; }
        .line .ph .ini { font-size: 16px; }
        .line b { display: block; font-size: 14px; line-height: 1.3; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .line small { color: var(--soft); font-size: 12px; }
        .line .right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
        .line .amt { font-weight: 800; font-size: 14px; }
        .cart-foot { padding: 14px 18px 18px; border-top: 1px solid var(--line); display: grid; gap: 12px; }
        .total { display: flex; justify-content: space-between; align-items: baseline; }
        .total span { color: var(--soft); font-weight: 600; }
        .total strong { font-size: 22px; font-weight: 800; letter-spacing: -.02em; }
        .fine { margin: 0; font-size: 12px; color: var(--soft); }
        .cart .x { display: none; }
        .cart .empty { padding: 36px 8px; }

        .backdrop {
            position: fixed; inset: 0; z-index: 40;
            background: rgba(2, 6, 23, .52);
            opacity: 0; pointer-events: none;
            transition: opacity .2s;
        }
        .backdrop.is-open { opacity: 1; pointer-events: auto; }

        @media (max-width: 979.98px) {
            .cart {
                position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
                border-radius: 22px 22px 0 0;
                max-height: 86vh;
                transform: translateY(105%);
                transition: transform .26s cubic-bezier(.2, .8, .2, 1);
                padding-bottom: env(safe-area-inset-bottom);
                box-shadow: 0 -12px 40px -12px rgba(0, 0, 0, .35);
            }
            .cart.is-open { transform: none; }
            .cart::before { content: ""; width: 40px; height: 4px; border-radius: 4px; background: var(--line); margin: 10px auto 0; }
            .cart .x { display: grid; }
        }
        .x { width: 36px; height: 36px; border-radius: 10px; border: 0; background: var(--chip); color: var(--soft); place-items: center; }

        .cartbar {
            position: fixed; left: 12px; right: 12px; z-index: 30;
            bottom: calc(12px + env(safe-area-inset-bottom));
            height: 58px; border-radius: 18px; border: 0;
            background: var(--brand); color: var(--brand-ink);
            display: flex; align-items: center; gap: 12px; padding: 0 18px 0 12px;
            font-weight: 700;
            box-shadow: 0 14px 34px -12px color-mix(in srgb, var(--brand) 70%, #000);
            transform: translateY(140%);
            transition: transform .26s cubic-bezier(.2, .8, .2, 1);
        }
        .cartbar.is-on { transform: none; }
        .cartbar .n {
            min-width: 34px; height: 34px; border-radius: 11px;
            background: rgba(255, 255, 255, .2);
            display: grid; place-items: center; font-weight: 800;
        }
        .cartbar .lbl { flex: 1; text-align: left; }
        .cartbar .amt { font-weight: 800; }
        .cartbar.bump { animation: bump .32s ease; }
        @keyframes bump { 40% { transform: scale(1.035); } }
        @media (min-width: 980px) { .cartbar { display: none; } }

        /* -- Botones -- */
        .btn {
            height: 50px; padding: 0 20px;
            border-radius: 14px; border: 0;
            background: var(--brand); color: var(--brand-ink);
            font-weight: 700; font-size: 15px;
            display: inline-flex; align-items: center; justify-content: center; gap: 10px;
            width: 100%;
            text-decoration: none;
            transition: filter .15s, transform .12s;
        }
        .btn:hover { filter: brightness(1.06); }
        .btn:active { transform: scale(.985); }
        .btn[disabled] { opacity: .55; cursor: not-allowed; filter: none; transform: none; }
        .btn.ghost { background: var(--chip); color: var(--ink); }
        .btn.wa { background: var(--wa); color: #FFFFFF; }
        .btn .sum { margin-left: auto; font-weight: 800; }
        .link {
            border: 0; background: transparent; padding: 6px 0;
            color: var(--brand-text); font-weight: 700;
            display: inline-flex; align-items: center; gap: 6px;
        }

        /* -- Formulario del pedido -- */
        .co-top { display: flex; align-items: center; gap: 10px; margin: 6px 0 4px; }
        .co-title { margin: 6px 0 16px; font-size: 24px; font-weight: 800; letter-spacing: -.02em; }
        .box {
            background: var(--paper);
            border-radius: var(--radius);
            box-shadow: var(--shadow);
            padding: 18px;
            margin-bottom: 14px;
        }
        .box h3 { margin: 0 0 14px; font-size: 16px; font-weight: 800; display: flex; align-items: center; gap: 10px; }
        .box h3 i {
            font-style: normal; width: 26px; height: 26px; border-radius: 9px;
            background: var(--brand-soft); color: var(--brand-text);
            display: grid; place-items: center; font-size: 13px; font-weight: 800;
        }
        .box h3 em { font-style: normal; font-weight: 600; font-size: 12px; color: var(--faint); margin-left: auto; }
        .fields { display: grid; gap: 14px; }
        @media (min-width: 640px) { .fields.two { grid-template-columns: 1fr 1fr; } }
        .field label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; }
        .field label small { font-weight: 500; color: var(--faint); }
        .field input, .field textarea {
            width: 100%; min-height: 48px;
            border-radius: 12px; border: 1px solid var(--line);
            background: var(--field);
            padding: 11px 14px;
            outline: none;
            transition: border-color .15s, box-shadow .15s;
        }
        .field textarea { resize: vertical; min-height: 84px; }
        .field input:focus, .field textarea:focus { border-color: var(--brand-line); box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand) 14%, transparent); }
        .field.is-bad input, .field.is-bad textarea, .opts.is-bad .opt, .days.is-bad .day { border-color: var(--danger); }
        .err { margin: 6px 0 0; font-size: 12px; font-weight: 600; color: var(--danger); }
        .hint { margin: 6px 0 0; font-size: 12px; color: var(--soft); }

        .opts { display: grid; gap: 10px; }
        @media (min-width: 640px) { .opts { grid-template-columns: 1fr 1fr; } }
        .opt {
            position: relative;
            display: flex; gap: 12px; align-items: flex-start;
            padding: 14px 44px 14px 14px; border-radius: 14px;
            border: 1.5px solid var(--line);
            background: var(--field);
            cursor: pointer;
            transition: border-color .15s, background .15s;
        }
        .opt input { position: absolute; opacity: 0; pointer-events: none; }
        .opt .ic {
            width: 38px; height: 38px; border-radius: 11px; flex: none;
            background: var(--chip); color: var(--soft);
            display: grid; place-items: center;
        }
        .opt b { display: block; font-size: 14px; }
        .opt small { display: block; color: var(--soft); font-size: 12px; line-height: 1.4; margin-top: 2px; }
        .opt::after {
            content: ""; position: absolute; top: 14px; right: 14px;
            width: 18px; height: 18px; border-radius: 50%;
            border: 2px solid var(--line); background: var(--paper);
        }
        /* .is-on lo pone pedir.js: asi no depende de :has(), que falta en navegadores viejos. */
        .opt.is-on { border-color: var(--brand); background: var(--brand-soft); }
        .opt.is-on .ic { background: var(--brand); color: var(--brand-ink); }
        .opt.is-on::after { border-color: var(--brand); background: radial-gradient(circle, var(--brand) 0 4px, var(--paper) 5px); }
        .opt:has(input:focus-visible) { outline: 3px solid color-mix(in srgb, var(--brand) 55%, transparent); outline-offset: 2px; }

        .days { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 2px 2px 4px; margin: 0 -2px; }
        .days::-webkit-scrollbar { display: none; }
        .day {
            flex: none; width: 68px; padding: 8px 0;
            border-radius: 14px; border: 1.5px solid var(--line);
            background: var(--field); text-align: center;
            line-height: 1.2;
        }
        .day small { display: block; font-size: 11px; font-weight: 700; color: var(--soft); text-transform: capitalize; }
        .day b { display: block; font-size: 20px; font-weight: 800; margin: 2px 0; }
        .day span { display: block; font-size: 11px; color: var(--faint); text-transform: capitalize; }
        .day.is-on { border-color: var(--brand); background: var(--brand); color: var(--brand-ink); }
        .day.is-on small, .day.is-on span { color: inherit; opacity: .85; }
        .day.more { display: grid; place-items: center; color: var(--brand-text); font-weight: 700; font-size: 12px; }
        .day.more span { font-size: 12px; color: inherit; text-transform: none; }
        .when { display: grid; gap: 14px; margin-top: 14px; }
        @media (min-width: 640px) { .when { grid-template-columns: 1fr 1fr; } }
        .sub { margin: 18px 0 8px; font-size: 13px; font-weight: 700; }
        .mt { margin-top: 14px; }
        .box.empty { padding: 44px 22px; }
        .check { display: flex; gap: 10px; align-items: center; font-size: 13px; color: var(--soft); margin: 4px 2px 16px; }
        .check input { width: 18px; height: 18px; accent-color: var(--brand); }
        .trap { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }

        .banner {
            display: flex; gap: 10px; align-items: flex-start;
            padding: 12px 14px; border-radius: 14px;
            background: var(--danger-soft); color: var(--danger);
            font-size: 14px; font-weight: 600;
            margin-bottom: 14px;
        }
        .banner a { color: inherit; }
        .send-m { position: sticky; bottom: calc(10px + env(safe-area-inset-bottom)); z-index: 10; margin-top: 4px; }
        .send-m .btn { box-shadow: 0 14px 30px -12px color-mix(in srgb, var(--brand) 70%, #000); }
        .resume { display: flex; justify-content: center; margin-bottom: 10px; }
        @media (min-width: 980px) { .only-m { display: none !important; } }
        @media (max-width: 979.98px) { .only-d { display: none !important; } }

        /* -- Ficha del producto -- */
        .dlg {
            position: fixed; z-index: 60;
            left: 50%; top: 50%;
            width: min(520px, calc(100vw - 24px));
            max-height: calc(100vh - 24px);
            overflow-y: auto;
            transform: translate(-50%, -46%) scale(.98);
            opacity: 0; pointer-events: none;
            background: var(--paper); border-radius: 22px;
            box-shadow: 0 30px 80px -20px rgba(0, 0, 0, .5);
            transition: opacity .2s, transform .2s;
        }
        .dlg.is-open { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%); }
        .dlg .ph { aspect-ratio: 16 / 11; }
        .dlg .ph .ini { font-size: 46px; }
        /* z-index: la foto (.ph) tambien es relative y va despues; sin el, la tapa. */
        .dlg .x { position: absolute; top: 12px; right: 12px; z-index: 2; display: grid; background: rgba(15, 23, 42, .55); color: #FFFFFF; }
        .dlg-body { padding: 18px 20px 20px; }
        .dlg-body h2 { margin: 0; font-size: 21px; font-weight: 800; letter-spacing: -.01em; }
        .dlg-body .price { display: block; margin-top: 4px; font-size: 18px; color: var(--brand-text); }
        .dlg-body p { margin: 12px 0 0; color: var(--soft); white-space: pre-line; }
        .dlg-foot { display: flex; gap: 12px; align-items: center; margin-top: 20px; }
        .dlg-foot .btn { flex: 1; }
        @media (max-width: 639.98px) {
            .dlg {
                left: 0; right: 0; top: auto; bottom: 0; width: auto;
                max-height: 92vh;
                border-radius: 22px 22px 0 0;
                transform: translateY(100%);
                padding-bottom: env(safe-area-inset-bottom);
            }
            .dlg.is-open { transform: none; }
        }

        /* -- Confirmacion -- */
        .done { text-align: center; padding: 24px 0 8px; }
        .done .ok {
            width: 76px; height: 76px; border-radius: 50%;
            margin: 0 auto 14px;
            background: var(--ok-soft); color: var(--ok);
            display: grid; place-items: center;
            animation: pop .5s cubic-bezier(.2, 1.4, .4, 1);
        }
        @keyframes pop { from { transform: scale(.4); opacity: 0; } }
        .done h2 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -.02em; }
        .done p { margin: 6px auto 0; max-width: 46ch; color: var(--soft); }
        .folio {
            display: inline-block; margin-top: 14px;
            padding: 6px 14px; border-radius: 999px;
            background: var(--brand-soft); color: var(--brand-text);
            font-weight: 800; letter-spacing: .04em;
        }
        .rows { margin: 0; }
        .rows div { display: flex; justify-content: space-between; gap: 16px; padding: 9px 0; border-bottom: 1px dashed var(--line); font-size: 14px; }
        .rows div:last-child { border-bottom: 0; }
        .rows dt { color: var(--soft); }
        .rows dd { margin: 0; text-align: right; font-weight: 600; }
        .bank {
            margin: 0; padding: 14px; border-radius: 12px;
            background: var(--chip);
            font: 14px/1.6 ui-monospace, "SFMono-Regular", Consolas, monospace;
            white-space: pre-wrap; word-break: break-word;
        }
        .acts { display: grid; gap: 10px; margin-top: 4px; }

        .toast {
            position: fixed; left: 50%; z-index: 70;
            bottom: calc(86px + env(safe-area-inset-bottom));
            transform: translate(-50%, 20px);
            opacity: 0; pointer-events: none;
            background: #0F172A; color: #FFFFFF;
            padding: 10px 16px; border-radius: 12px;
            font-size: 14px; font-weight: 600;
            box-shadow: 0 12px 30px -10px rgba(0, 0, 0, .45);
            transition: opacity .2s, transform .2s;
            max-width: calc(100vw - 32px);
        }
        .toast.is-on { opacity: 1; transform: translate(-50%, 0); }
        @media (min-width: 980px) { .toast { bottom: 28px; } }

        /* -- Enlace no valido -- */
        .gone { min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; }
        .gone-card { max-width: 420px; text-align: center; background: var(--paper); border-radius: 22px; box-shadow: var(--shadow); padding: 36px 26px; }
        .gone-card .ic { width: 64px; height: 64px; border-radius: 20px; margin: 0 auto 14px; display: grid; place-items: center; background: var(--chip); color: var(--soft); }
        .gone-card h1 { margin: 0; font-size: 22px; font-weight: 800; }
        .gone-card p { margin: 8px 0 0; color: var(--soft); }

        footer.by { text-align: center; padding: 8px 16px 28px; font-size: 12px; color: var(--faint); }
        @media (max-width: 979.98px) { body:not(.is-done) footer.by { padding-bottom: 96px; } }

        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
        }
    </style>
</head>
<?php if (!$s): ?>
<body>
    <main class="gone">
        <div class="gone-card">
            <div class="ic"><?= $svg('link', 28) ?></div>
            <h1>Este enlace no es válido</h1>
            <p>Puede que la tienda haya cambiado su enlace. Pídele a la tienda el enlace nuevo.</p>
        </div>
    </main>
</body>
</html>
<?php exit; endif; ?>
<body data-token="<?= $h($token) ?>" data-api="ctrl/ctrl-pedir.php">
    <header class="hero">
        <div class="wrap hero-in">
            <div class="logo<?= $logo === '' ? ' is-empty' : '' ?>">
<?php if ($logo !== ''): ?>
                <img src="<?= $h($logo) ?>" data-src="<?= $h($logo) ?>" data-ini="<?= $h($initials($name)) ?>" alt="">
<?php else: ?>
                <span class="ini"><?= $h($initials($name)) ?></span>
<?php endif; ?>
            </div>
            <div>
                <span class="state<?= $open ? '' : ' is-closed' ?>"><?= $open ? 'Recibiendo pedidos' : 'Cerrado por ahora' ?></span>
                <h1><?= $h($name) ?></h1>
<?php if ($message !== ''): ?>
                <p class="msg"><?= $h($message) ?></p>
<?php endif; ?>
<?php if ($branch !== '' || $address !== ''): ?>
                <p class="where"><?= $svg('pin', 14) ?><span><?= $h(implode(' · ', array_filter([$branch, $address]))) ?></span></p>
<?php endif; ?>
            </div>
        </div>
    </header>

<?php if ($perks): ?>
    <div class="wrap perks">
        <div class="perks-in">
<?php foreach ($perks as $p): ?>
            <span class="perk"><?= $svg($p[0], 15) ?><?= $h($p[1]) ?></span>
<?php endforeach; ?>
        </div>
    </div>
<?php endif; ?>

    <div id="app" class="wrap">
        <div class="skel" aria-label="Cargando productos"><div></div><div></div><div></div><div></div></div>
    </div>

    <footer class="by">Pedidos en línea con Huubie</footer>

    <noscript><p class="wrap empty">Para hacer tu pedido activa JavaScript en tu navegador.</p></noscript>
    <script src="src/js/pedir.js?v=<?= (int) $jsVersion ?>"></script>
</body>
</html>
