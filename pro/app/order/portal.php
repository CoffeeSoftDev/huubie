<?php
/*  Portal del cliente: la pagina que abre el cliente, SIN sesion.

      portal.php?t=<token de 32 caracteres>

    Un enlace por cliente y sucursal (customer_portal). Aqui solo se pinta la
    portada (tienda, color, saludo) para que salga al instante. Lo que debe, el
    formulario del comprobante y la lista de sus comprobantes los pinta
    src/js/portal.js, que habla con ctrl/ctrl-portal.php.

    Token con formato malo, que ya se cambio, cliente o sucursal inactivos: la
    misma pagina 404, sin decir cual fue. Las etiquetas og llevan solo el nombre
    de la tienda: el enlace se comparte por WhatsApp y no debe mostrar datos del
    cliente en la vista previa. */

require_once __DIR__ . '/mdl/mdl-order.php';
require_once __DIR__ . '/mdl/mdl-portal.php';

class PublicPortalPage extends mdl {

    use CustomerPortal;

    public function load($token) {
        if (!preg_match('/^[a-f0-9]{32}$/', $token)) return null;

        return $this->qPortalByToken($token) ?: null;
    }
}

// -- Datos --

$token = isset($_GET['t']) ? strtolower(trim((string) $_GET['t'])) : '';
$p     = null;

try {
    $p = (new PublicPortalPage())->load($token);
} catch (Throwable $e) {
    $p = null;
}

if (!$p) http_response_code(404);

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

if ($p) {
    if (preg_match('/^#[0-9A-F]{6}$/i', (string) $p['accent'])) $accent = strtoupper($p['accent']);

    // Texto sobre el color: blanco si el color es oscuro, casi negro si es claro.
    [$r, $g, $b] = sscanf($accent, '#%02x%02x%02x');
    $light = (0.2126 * $r + 0.7152 * $g + 0.0722 * $b) / 255 > 0.62;
    $ink   = $light ? '#0F172A' : '#FFFFFF';
    $text  = $light ? "color-mix(in srgb, {$accent} 55%, #000)" : $accent;

    $name    = trim((string) $p['title']) !== '' ? trim($p['title']) : (trim((string) $p['company']) !== '' ? trim($p['company']) : trim((string) $p['branch']));
    $branch  = trim((string) $p['branch']);
    $address = trim((string) $p['address']);
    $logoRaw = trim((string) $p['branch_logo']) !== '' ? $p['branch_logo'] : $p['company_logo'];
    $logo    = $file($logoRaw);
    $who     = trim((string) $p['customer']);
    $first   = $who !== '' ? (string) preg_split('/\s+/u', $who)[0] : '';

    $title = $name . ' · Tu cuenta';
} else {
    $title = 'Enlace no válido';
}

$icons = [
    'receipt' => '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    'pin'     => '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    'link'    => '<path d="M9 17H7A5 5 0 0 1 7 7"/><path d="M15 7h2a5 5 0 0 1 4 8"/><path d="M8 12h4"/><path d="m2 2 20 20"/>'
];

$svg = fn ($name, $size = 16) => '<svg width="' . $size . '" height="' . $size . '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $icons[$name] . '</svg>';

// Icono de la pestaña: el recibo sobre el color de la tienda. Asi el navegador no pide /favicon.ico.
$favicon = 'data:image/svg+xml,' . rawurlencode(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
    . '<rect width="32" height="32" rx="8" fill="' . $accent . '"/>'
    . '<g transform="translate(6 6) scale(.8333)" fill="none" stroke="' . $ink . '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
    . $icons['receipt']
    . '</g></svg>'
);

$jsVersion = @filemtime(__DIR__ . '/src/js/portal.js') ?: 1;
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="robots" content="noindex, nofollow">
    <meta name="color-scheme" content="light dark">
    <meta name="theme-color" content="<?= $h($accent) ?>">
    <title><?= $h($title) ?></title>
    <link rel="icon" type="image/svg+xml" href="<?= $h($favicon) ?>">
<?php if ($p): ?>
    <meta property="og:type" content="website">
    <meta property="og:title" content="<?= $h($name) ?>">
    <meta property="og:description" content="Consulta tu saldo y manda tu comprobante de pago.">
<?php endif; ?>
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
            --warn: #B45309;
            --warn-soft: #FEF3C7;
            --danger: #B91C1C;
            --danger-soft: #FEE2E2;
            --wa: #1FAF54;
            --radius: 18px;
            --shadow: 0 1px 2px rgba(15, 23, 42, .05), 0 10px 30px -18px rgba(15, 23, 42, .28);
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #0B1018;
                --paper: #131B27;
                --ink: #E6EAF0;
                --soft: #9AA6B8;
                --faint: #64748B;
                --line: #243041;
                --chip: #1B2534;
                --field: #0F1621;
                --brand-text: color-mix(in srgb, var(--brand) 42%, #FFFFFF);
                --brand-soft: color-mix(in srgb, var(--brand) 20%, var(--paper));
                --brand-line: color-mix(in srgb, var(--brand) 55%, var(--line));
                --ok: #4ADE80;
                --ok-soft: rgba(34, 197, 94, .14);
                --warn: #FBBF24;
                --warn-soft: rgba(245, 158, 11, .14);
                --danger: #FCA5A5;
                --danger-soft: rgba(239, 68, 68, .14);
                --shadow: 0 0 0 1px var(--line);
            }
        }
        *, *::before, *::after { box-sizing: border-box; }
        html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
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
        .wrap { width: 100%; max-width: 1080px; margin: 0 auto; padding: 0 16px; }
        .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        :focus-visible { outline: 3px solid color-mix(in srgb, var(--brand) 55%, transparent); outline-offset: 2px; }

        /* -- Portada -- */
        .hero {
            background:
                radial-gradient(90% 140% at 100% 0%, rgba(255, 255, 255, .20), transparent 60%),
                radial-gradient(60% 90% at 0% 100%, rgba(0, 0, 0, .18), transparent 70%),
                var(--brand);
            color: var(--brand-ink);
            padding: 28px 0 72px;
        }
        .hero-in { display: flex; gap: 18px; align-items: center; }
        .logo {
            width: 72px; height: 72px; flex: none;
            border-radius: 22px;
            background: var(--paper);
            box-shadow: 0 0 0 4px rgba(255, 255, 255, .25), 0 12px 30px -12px rgba(0, 0, 0, .45);
            display: grid; place-items: center;
            overflow: hidden;
        }
        .logo img { width: 100%; height: 100%; object-fit: cover; }
        .logo .ini { font-weight: 800; font-size: 25px; color: var(--brand-text); letter-spacing: -.02em; }
        .tag {
            display: inline-flex; align-items: center; gap: 7px;
            font-size: 12px; font-weight: 700; letter-spacing: .02em;
            padding: 4px 10px 4px 8px; border-radius: 999px;
            background: rgba(255, 255, 255, .16);
            border: 1px solid rgba(255, 255, 255, .22);
        }
        .hero h1 { margin: 8px 0 2px; font-size: clamp(24px, 4.6vw, 34px); line-height: 1.12; letter-spacing: -.025em; font-weight: 800; }
        .hero .msg { margin: 6px 0 0; max-width: 60ch; opacity: .92; }
        .hero .where { margin: 8px 0 0; display: flex; gap: 6px; align-items: center; font-size: 13px; opacity: .85; }
        @media (min-width: 720px) {
            .hero { padding: 40px 0 84px; }
            .logo { width: 88px; height: 88px; border-radius: 26px; }
            .logo .ini { font-size: 30px; }
        }

        /* -- Acomodo -- */
        .layout { position: relative; margin-top: -48px; display: grid; gap: 14px; padding-bottom: 20px; }
        .col { min-width: 0; display: grid; gap: 14px; align-content: start; }
        @media (min-width: 980px) {
            .layout { grid-template-columns: minmax(0, 1fr) 400px; grid-template-areas: "main side" "hist side"; align-items: start; gap: 18px; }
            .col-main { grid-area: main; }
            .col-hist { grid-area: hist; }
            .col-side { grid-area: side; position: sticky; top: 16px; }
            .col-side .opts { grid-template-columns: 1fr; }
            .layout.is-clear { grid-template-columns: minmax(0, 760px); grid-template-areas: "main" "hist"; justify-content: center; }
            .only-m { display: none !important; }
        }
        .skel { position: relative; margin-top: -48px; display: grid; gap: 14px; padding-bottom: 40px; }
        .skel div { height: 170px; border-radius: var(--radius); background: linear-gradient(90deg, var(--chip), var(--paper), var(--chip)); background-size: 200% 100%; animation: shimmer 1.4s infinite linear; }
        .skel div + div { height: 260px; }
        @keyframes shimmer { to { background-position: -200% 0; } }

        .box {
            background: var(--paper);
            border-radius: var(--radius);
            box-shadow: var(--shadow);
            padding: 18px;
        }
        .box h3 { margin: 0 0 14px; font-size: 16px; font-weight: 800; display: flex; align-items: center; gap: 10px; }
        .box h3 i {
            font-style: normal; width: 28px; height: 28px; border-radius: 9px; flex: none;
            background: var(--brand-soft); color: var(--brand-text);
            display: grid; place-items: center;
        }
        .box h3 em { font-style: normal; font-weight: 600; font-size: 12px; color: var(--faint); margin-left: auto; }
        .box h3 .link { margin-left: auto; font-size: 13px; }
        .box > .hint:first-of-type { margin-top: -8px; margin-bottom: 12px; }

        /* -- Saldo -- */
        .sum { padding: 20px; }
        .sum-top { display: flex; gap: 14px; align-items: flex-start; justify-content: space-between; }
        .sum small { display: block; font-size: 13px; font-weight: 700; color: var(--soft); }
        .sum-amt { display: block; margin-top: 2px; font-size: clamp(32px, 8vw, 44px); font-weight: 800; letter-spacing: -.03em; line-height: 1.1; font-variant-numeric: tabular-nums; }
        .sum-sub { display: block; margin-top: 6px; font-size: 13px; color: var(--soft); }
        .sum-ic { width: 50px; height: 50px; border-radius: 15px; flex: none; display: grid; place-items: center; background: var(--brand-soft); color: var(--brand-text); }
        .sum.is-clear .sum-ic { background: var(--ok-soft); color: var(--ok); }
        .sum .btn { margin-top: 16px; }
        .note { display: flex; gap: 10px; align-items: flex-start; margin-top: 14px; padding: 11px 13px; border-radius: 12px; font-size: 13px; font-weight: 600; }
        .note.warn { background: var(--warn-soft); color: var(--warn); }
        .note.ok { background: var(--ok-soft); color: var(--ok); }
        .note.bad { background: var(--danger-soft); color: var(--danger); }
        .note.info { background: var(--chip); color: var(--soft); }

        /* -- Lo que debe -- */
        .debts { display: grid; gap: 10px; }
        .debt {
            display: flex; gap: 12px;
            padding: 14px; border-radius: 14px;
            border: 1.5px solid var(--line); background: var(--field);
            transition: border-color .15s, box-shadow .15s;
        }
        .debt.is-picked { border-color: var(--brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 14%, transparent); }
        .debt-ic { width: 40px; height: 40px; border-radius: 12px; flex: none; display: grid; place-items: center; background: var(--chip); color: var(--soft); }
        .debt-body { flex: 1; min-width: 0; }
        .debt-top { display: flex; gap: 10px; align-items: baseline; justify-content: space-between; }
        .debt-top b { font-size: 15px; }
        .debt-top strong { font-size: 16px; font-weight: 800; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .debt-when { margin-top: 2px; font-size: 13px; color: var(--soft); }
        .fol {
            display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: 999px;
            background: var(--brand-soft); color: var(--brand-text);
            font-size: 12px; font-weight: 800; letter-spacing: .03em; vertical-align: 1px;
        }
        .meter { margin-top: 10px; height: 6px; border-radius: 999px; background: var(--chip); overflow: hidden; }
        .meter i { display: block; height: 100%; min-width: 6px; border-radius: inherit; background: var(--brand); }
        .debt-foot { margin-top: 8px; display: flex; gap: 10px; align-items: center; justify-content: space-between; font-size: 12px; color: var(--soft); }
        .debt-foot .link { font-size: 13px; padding: 2px 0; white-space: nowrap; }

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
        .link {
            border: 0; background: transparent; padding: 6px 0;
            color: var(--brand-text); font-weight: 700;
            display: inline-flex; align-items: center; gap: 6px;
            text-decoration: none;
        }
        .x { width: 36px; height: 36px; border-radius: 10px; border: 0; background: var(--chip); color: var(--soft); display: grid; place-items: center; flex: none; }

        /* -- Formulario -- */
        .sub { margin: 0 0 8px; font-size: 13px; font-weight: 700; }
        .mt { margin-top: 16px; }
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
        .field textarea { resize: vertical; min-height: 72px; }
        .field input:focus, .field textarea:focus { border-color: var(--brand-line); box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand) 14%, transparent); }
        .field.is-bad input, .field.is-bad textarea, .field.is-bad .drop { border-color: var(--danger); }
        .money { position: relative; }
        .money span { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-weight: 700; color: var(--soft); pointer-events: none; }
        .field .money input { padding-left: 30px; font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .err { margin: 6px 0 0; font-size: 12px; font-weight: 600; color: var(--danger); }
        .hint { margin: 6px 0 0; font-size: 12px; color: var(--soft); }
        .fine { margin: 10px 0 0; font-size: 12px; color: var(--faint); text-align: center; }
        .trap { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }

        .opts { display: grid; gap: 10px; }
        @media (min-width: 640px) { .opts { grid-template-columns: 1fr 1fr; } }
        .opt {
            position: relative;
            display: flex; gap: 12px; align-items: flex-start;
            padding: 12px 42px 12px 12px; border-radius: 14px;
            border: 1.5px solid var(--line);
            background: var(--field);
            cursor: pointer;
            transition: border-color .15s, background .15s;
        }
        .opt input { position: absolute; opacity: 0; pointer-events: none; }
        .opt .ic { width: 36px; height: 36px; border-radius: 11px; flex: none; background: var(--chip); color: var(--soft); display: grid; place-items: center; }
        .opt b { display: block; font-size: 14px; }
        .opt small { display: block; color: var(--soft); font-size: 12px; line-height: 1.4; margin-top: 2px; }
        .opt::after {
            content: ""; position: absolute; top: 13px; right: 13px;
            width: 18px; height: 18px; border-radius: 50%;
            border: 2px solid var(--line); background: var(--paper);
        }
        /* .is-on lo pone portal.js: asi no depende de :has(), que falta en navegadores viejos. */
        .opt.is-on { border-color: var(--brand); background: var(--brand-soft); }
        .opt.is-on .ic { background: var(--brand); color: var(--brand-ink); }
        .opt.is-on::after { border-color: var(--brand); background: radial-gradient(circle, var(--brand) 0 4px, var(--paper) 5px); }
        .opt:has(input:focus-visible), .drop:has(input:focus-visible) { outline: 3px solid color-mix(in srgb, var(--brand) 55%, transparent); outline-offset: 2px; }

        .drop {
            position: relative;
            display: grid; justify-items: center; gap: 4px;
            text-align: center; padding: 22px 16px;
            border-radius: 14px; border: 1.5px dashed var(--brand-line);
            background: var(--brand-soft); color: var(--brand-text);
            cursor: pointer;
            transition: border-color .15s, background .15s;
        }
        .field .drop { margin: 0; font-weight: 400; }
        .drop input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
        .drop b { font-size: 14px; }
        .drop small { font-size: 12px; color: var(--soft); }
        .drop.is-over { border-style: solid; border-color: var(--brand); }
        .picked { display: flex; gap: 12px; align-items: center; padding: 10px; border-radius: 14px; border: 1px solid var(--line); background: var(--field); }
        .thumb { width: 64px; height: 64px; border-radius: 10px; overflow: hidden; flex: none; display: grid; place-items: center; background: var(--chip); color: var(--soft); }
        .thumb img { width: 100%; height: 100%; object-fit: cover; }
        .picked-body { flex: 1; min-width: 0; }
        .picked-body b { display: block; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .picked-body small { display: block; font-size: 12px; color: var(--soft); }

        .banner {
            display: flex; gap: 10px; align-items: flex-start;
            padding: 12px 14px; border-radius: 14px;
            background: var(--danger-soft); color: var(--danger);
            font-size: 14px; font-weight: 600;
            margin-bottom: 14px;
        }
        .banner a { color: inherit; }
        .sent { text-align: center; padding: 6px 0 16px; margin-bottom: 16px; border-bottom: 1px solid var(--line); }
        .sent .ok {
            width: 60px; height: 60px; border-radius: 50%;
            margin: 0 auto 10px;
            background: var(--ok-soft); color: var(--ok);
            display: grid; place-items: center;
            animation: pop .5s cubic-bezier(.2, 1.4, .4, 1);
        }
        @keyframes pop { from { transform: scale(.4); opacity: 0; } }
        .sent b { display: block; font-size: 17px; }
        .sent p { margin: 4px auto 12px; max-width: 40ch; font-size: 14px; color: var(--soft); }

        .bank {
            margin: 0; padding: 14px; border-radius: 12px;
            background: var(--chip);
            font: 14px/1.6 ui-monospace, "SFMono-Regular", Consolas, monospace;
            white-space: pre-wrap; word-break: break-word;
        }
        .acts { display: grid; gap: 10px; margin-top: 12px; }

        /* -- Comprobantes -- */
        .rcs { list-style: none; margin: 0; padding: 0; }
        .rc { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px dashed var(--line); }
        .rc:first-child { padding-top: 0; }
        .rc:last-child { border-bottom: 0; padding-bottom: 0; }
        .rc-ic { width: 38px; height: 38px; border-radius: 11px; flex: none; display: grid; place-items: center; background: var(--chip); color: var(--soft); }
        .rc-body { flex: 1; min-width: 0; }
        .rc-top { display: flex; gap: 10px; align-items: center; justify-content: space-between; }
        .rc-top b { font-size: 15px; font-variant-numeric: tabular-nums; }
        .rc-sub { margin-top: 2px; font-size: 12px; color: var(--soft); }
        .rc-sub.ok { color: var(--ok); font-weight: 600; }
        .rc-why { margin-top: 8px; padding: 9px 11px; border-radius: 10px; background: var(--danger-soft); color: var(--danger); font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
        .rc-note { margin-top: 6px; font-size: 13px; color: var(--soft); overflow-wrap: anywhere; }
        .pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .pill::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .pill.warn { background: var(--warn-soft); color: var(--warn); }
        .pill.ok { background: var(--ok-soft); color: var(--ok); }
        .pill.bad { background: var(--danger-soft); color: var(--danger); }

        .empty { text-align: center; padding: 28px 12px; color: var(--soft); }
        .empty svg { color: var(--faint); margin: 0 auto 10px; display: block; }
        .empty b { display: block; color: var(--ink); font-size: 16px; margin-bottom: 4px; }

        .toast {
            position: fixed; left: 50%; z-index: 70;
            bottom: calc(24px + env(safe-area-inset-bottom));
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

        /* -- Enlace no valido -- */
        .gone { min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; }
        .gone-card { max-width: 420px; text-align: center; background: var(--paper); border-radius: 22px; box-shadow: var(--shadow); padding: 36px 26px; }
        .gone-card .ic { width: 64px; height: 64px; border-radius: 20px; margin: 0 auto 14px; display: grid; place-items: center; background: var(--chip); color: var(--soft); }
        .gone-card h1 { margin: 0; font-size: 22px; font-weight: 800; }
        .gone-card p { margin: 8px 0 0; color: var(--soft); }

        footer.by { text-align: center; padding: 8px 16px 28px; font-size: 12px; color: var(--faint); }

        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
        }
    </style>
</head>
<?php if (!$p): ?>
<body>
    <main class="gone">
        <div class="gone-card">
            <div class="ic"><?= $svg('link', 28) ?></div>
            <h1>Este enlace ya no funciona</h1>
            <p>Puede que la tienda haya cambiado tu enlace. Pídele el nuevo a la tienda.</p>
        </div>
    </main>
</body>
</html>
<?php exit; endif; ?>
<body data-token="<?= $h($token) ?>" data-api="ctrl/ctrl-portal.php">
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
                <span class="tag"><?= $svg('receipt', 14) ?>Tu cuenta en <?= $h($name) ?></span>
                <h1><?= $first !== '' ? 'Hola, ' . $h($first) : 'Tu cuenta' ?></h1>
                <p class="msg">Aquí ves lo que debes y nos mandas tu comprobante de transferencia.</p>
<?php if ($branch !== '' || $address !== ''): ?>
                <p class="where"><?= $svg('pin', 14) ?><span><?= $h(implode(' · ', array_filter([$branch, $address]))) ?></span></p>
<?php endif; ?>
            </div>
        </div>
    </header>

    <div id="app" class="wrap">
        <div class="skel" aria-label="Cargando tu cuenta"><div></div><div></div></div>
    </div>

    <footer class="by">Portal de clientes con Huubie</footer>

    <noscript><p class="wrap empty">Para ver tu cuenta activa JavaScript en tu navegador.</p></noscript>
    <script src="src/js/portal.js?v=<?= (int) $jsVersion ?>"></script>
</body>
</html>
