<?php
/*  V7 · Ticket publico de una venta de mostrador.

    Lo abre el cliente desde el enlace que le llega por WhatsApp, SIN sesion:
    esta pagina no pasa por Permission::page ni por _Session.php.

      ticket.php?v=<id de la venta>&k=<firma>

    La firma la valida TicketLink (mdl/mdl-ticket.php). Firma mala, venta que no
    es de mostrador (sale_type_id 3) o venta inactiva: la misma pagina 404, sin
    decir cual de las tres fue.

    Muestra lo mismo que el ticket impreso, menos lo que no le toca al cliente:
    sin telefono ni correo, la tarjeta con sus ultimos 4 digitos, quien atendio
    solo con su nombre y una venta cancelada sin el motivo interno. */

require_once __DIR__ . '/mdl/mdl-order.php';
require_once __DIR__ . '/mdl/mdl-ticket.php';

class PublicTicket extends mdl {

    use TicketLink;

    const SALE_TYPE = 3;
    const CANCELLED = 4;

    // El ticket listo para pintar, o null.
    public function load($id, $sign) {
        if (!$this->ticketValid($id, $sign)) return null;

        $s = $this->qSale((int) $id);

        if (!$s) return null;

        $saleId   = (int) $s['id'];
        $lines    = $this->qOrderLines($saleId);
        $payments = $this->qPayments($saleId);
        $alive    = (int) $s['sale_status_id'] !== self::CANCELLED;
        $tip      = round((float) $s['tip_amount'], 2);
        $total    = round((float) $s['total'], 2);
        $paid     = round((float) $s['paid'], 2);
        $discount = round((float) $s['discount_amount'], 2);
        $charge   = $alive ? $this->qReceivable($saleId, 'cargo') : null;
        $points   = $alive ? $this->qReceivable($saleId, 'puntos') : null;
        $credit   = $charge ? max(round($total + $tip - $paid, 2), 0) : 0;
        $cardType = trim((string) $s['card_type']);
        $cardNum  = preg_replace('/\s+/', '', (string) $s['card_number']);
        $reason   = trim((string) $s['discount_reason']) !== '' ? $s['discount_reason'] : ($cardType !== '' ? 'Tarjeta ' . $cardType : '');

        return [
            'company'   => trim((string) $s['company']),
            'branch'    => trim((string) $s['branch']),
            'address'   => trim((string) $s['address']),
            'folio'     => (string) ($s['folio'] ?: $s['id']),
            'date'      => (string) $s['created_at'],
            'user'      => trim((string) $s['user_name']),
            'customer'  => trim((string) $s['customer']) !== '' ? trim($s['customer']) : 'Público en general',
            'card'      => $cardNum !== '' ? trim($cardType . ' · •••• ' . substr($cardNum, -4)) : '',
            'lines'     => array_map(fn ($l) => [
                'name'     => trim((string) $l['name']) !== '' ? $l['name'] : $l['product_name'],
                'quantity' => (float) $l['quantity'],
                'details'  => trim((string) $l['details']),
                // Neto: el descuento del renglon (Ventas) ya va restado.
                'discount' => round((float) $l['discount_amount'], 2),
                'amount'   => round((float) $l['price'] * (float) $l['quantity'] - (float) $l['discount_amount'], 2)
            ], $lines),
            'subtotal'  => round((float) $s['subtotal'], 2),
            'discount'  => $discount > 0 ? ['amount' => $discount, 'reason' => $reason] : null,
            'total'     => $total,
            'tip'       => $tip,
            'charged'   => round($total + $tip - $credit, 2),
            'credit'    => $credit,
            'points'    => $points ? round((float) $points['amount'], 2) : 0,
            'payments'  => array_map(fn ($p) => [
                'method'   => $p['method'] !== '' ? $p['method'] : 'Sin método',
                'cash'     => (int) $p['is_cash'] === 1,
                'amount'   => round((float) $p['amount'], 2),
                'tendered' => round((float) $p['tendered_amount'], 2),
                'change'   => round((float) $p['change_amount'], 2)
            ], $alive ? $payments : []),
            'cancelled' => !$alive
        ];
    }

    // -- Consultas --

    private function qSale($id) {
        return $this->qRow("
            SELECT
                s.id,
                s.folio,
                s.subtotal,
                s.discount_amount,
                IFNULL(s.tip_amount, 0) AS tip_amount,
                s.total,
                s.created_at,
                s.sale_status_id,
                IFNULL(c.name, '')   AS customer,
                IFNULL(dr.name, '')  AS discount_reason,
                IFNULL(cd.number, '') AS card_number,
                IFNULL(ct.name, '')   AS card_type,
                IFNULL(u.name, '')    AS user_name,
                IFNULL(b.name, '')    AS branch,
                IFNULL(b.ubication, '') AS address,
                IFNULL(co.name, '')   AS company,
                {$this->qPaidSql('s')} AS paid
            FROM {$this->pos}sale s
            LEFT JOIN {$this->pos}customer c         ON c.id  = s.customer_id
            LEFT JOIN {$this->pos}discount_reason dr ON dr.id = s.discount_reason_id
            LEFT JOIN {$this->pos}card cd            ON cd.id = s.card_id
            LEFT JOIN {$this->pos}card_type ct       ON ct.id = cd.card_type_id
            LEFT JOIN {$this->bd}users u             ON u.id  = s.user_id
            LEFT JOIN {$this->bd}branches b          ON b.id  = s.branch_id
            LEFT JOIN {$this->bd}companies co        ON co.id = b.company_id
            WHERE s.id = ?
                AND s.sale_type_id = ?
                AND IFNULL(s.active, 1) = 1
            LIMIT 1
        ", [$id, self::SALE_TYPE]);
    }

    // El cargo a credito o los puntos de la venta (como qSaleCharge y qSalePoints).
    private function qReceivable($saleId, $kind) {
        return $this->qRow("
            SELECT id, amount
            FROM {$this->pos}receivable
            WHERE sale_id = ?
                AND kind = ?
                AND IFNULL(active, 1) = 1
                AND deleted_at IS NULL
            ORDER BY id
            LIMIT 1
        ", [$saleId, $kind]);
    }
}

// -- Respuesta --

$id   = isset($_GET['v']) ? (int) $_GET['v'] : 0;
$sign = isset($_GET['k']) ? (string) $_GET['k'] : '';
$t    = null;

try {
    $t = (new PublicTicket())->load($id, $sign);
} catch (Throwable $e) {
    $t = null;
}

if (!$t) http_response_code(404);

header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

$h = fn ($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
$m = fn ($n) => '$' . number_format((float) $n, 2);
$q = fn ($n) => rtrim(rtrim(number_format((float) $n, 3, '.', ''), '0'), '.');

$months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
$stamp  = '';

if ($t && strtotime($t['date'])) {
    $ts    = strtotime($t['date']);
    $stamp = date('j', $ts) . ' ' . $months[(int) date('n', $ts) - 1] . ' ' . date('Y · H:i', $ts);
}

if ($t) {
    $state = $t['cancelled']
        ? ['cancel', 'Cancelada']
        : ($t['credit'] > 0.005 ? ['credit', 'A crédito'] : ['paid', 'Pagada']);

    $title = ($t['company'] !== '' ? $t['company'] : $t['branch']) . ' · Ticket V' . $t['folio'];
} else {
    $title = 'Ticket no disponible';
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <meta name="color-scheme" content="light dark">
    <title><?= $h($title) ?></title>
    <style>
        :root {
            --bg: #F1F5F9;
            --paper: #FFFFFF;
            --ink: #0F172A;
            --soft: #64748B;
            --line: #E2E8F0;
            --accent: #0F172A;
            --paid-bg: #DCFCE7;   --paid-ink: #166534;
            --credit-bg: #FEF3C7; --credit-ink: #92400E;
            --cancel-bg: #FEE2E2; --cancel-ink: #991B1B;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #0B1120;
                --paper: #151E2E;
                --ink: #E2E8F0;
                --soft: #94A3B8;
                --line: #263246;
                --accent: #E2E8F0;
                --paid-bg: #14532D;   --paid-ink: #BBF7D0;
                --credit-bg: #78350F; --credit-ink: #FDE68A;
                --cancel-bg: #7F1D1D; --cancel-ink: #FECACA;
            }
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; }
        body {
            min-height: 100vh;
            padding: 24px 16px 40px;
            background: var(--bg);
            color: var(--ink);
            font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        }
        .tk { max-width: 400px; margin: 0 auto; }
        .tk-paper {
            position: relative;
            padding: 24px 20px 28px;
            background: var(--paper);
            border-radius: 14px 14px 0 0;
            box-shadow: 0 1px 2px rgb(15 23 42 / .06), 0 8px 24px rgb(15 23 42 / .06);
        }
        /* Filo de papel cortado. */
        .tk-paper::after {
            content: '';
            position: absolute;
            left: 0; right: 0; bottom: -10px;
            height: 10px;
            background:
                linear-gradient(135deg, var(--paper) 50%, transparent 50%) 0 0 / 14px 10px repeat-x,
                linear-gradient(225deg, var(--paper) 50%, transparent 50%) 0 0 / 14px 10px repeat-x;
        }
        .tk-head { text-align: center; }
        .tk-company { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -.01em; }
        .tk-branch { margin: 2px 0 0; color: var(--soft); font-size: 13px; }
        .tk-meta { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 18px; }
        .tk-folio { font-size: 13px; color: var(--soft); }
        .tk-folio b { display: block; color: var(--ink); font-size: 17px; }
        .tk-pill { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
        .tk-pill.paid   { background: var(--paid-bg);   color: var(--paid-ink); }
        .tk-pill.credit { background: var(--credit-bg); color: var(--credit-ink); }
        .tk-pill.cancel { background: var(--cancel-bg); color: var(--cancel-ink); }
        .tk-hr { margin: 16px 0; border: 0; border-top: 1px dashed var(--line); }
        .tk-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 3px 0; }
        .tk-row > span:last-child { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .tk-row.muted { color: var(--soft); font-size: 13px; }
        .tk-row.total { padding-top: 8px; font-size: 18px; font-weight: 700; }
        .tk-row.strong { font-weight: 600; }
        .tk-line { padding: 6px 0; }
        .tk-line .tk-row { padding: 0; }
        .tk-qty { color: var(--soft); font-variant-numeric: tabular-nums; }
        .tk-note { margin: 2px 0 0; color: var(--soft); font-size: 12.5px; }
        .tk-label { margin: 0 0 6px; color: var(--soft); font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
        .tk-void { margin: 16px 0 0; padding: 10px; border-radius: 10px; background: var(--cancel-bg); color: var(--cancel-ink); text-align: center; font-weight: 600; }
        .tk-thanks { margin: 18px 0 0; text-align: center; font-weight: 600; }
        .tk-small { margin: 4px 0 0; text-align: center; color: var(--soft); font-size: 12px; }
        .tk-actions { display: flex; justify-content: center; margin-top: 28px; }
        .tk-btn {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 10px 18px;
            border: 1px solid var(--line); border-radius: 10px;
            background: var(--paper); color: var(--ink);
            font: inherit; font-weight: 600; cursor: pointer;
        }
        .tk-btn:hover { border-color: var(--soft); }
        .tk-btn svg { width: 16px; height: 16px; }
        .tk-brand { margin-top: 18px; text-align: center; color: var(--soft); font-size: 12px; }
        .tk-empty { text-align: center; padding: 40px 20px; border-radius: 14px; }
        .tk-empty h1 { margin: 0 0 8px; font-size: 18px; }
        .tk-empty p { margin: 0; color: var(--soft); }
        @media print {
            body { padding: 0; background: #FFFFFF; color: #000000; }
            .tk-paper { box-shadow: none; }
            .tk-paper::after, .tk-actions, .tk-brand { display: none; }
        }
    </style>
</head>
<body>
<main class="tk">
<?php if (!$t): ?>
    <div class="tk-paper tk-empty">
        <h1>Ticket no disponible</h1>
        <p>El enlace está incompleto o ya no es válido. Pide a la tienda que te lo envíe de nuevo.</p>
    </div>
<?php else: ?>
    <article class="tk-paper">
        <header class="tk-head">
            <h1 class="tk-company"><?= $h($t['company'] !== '' ? $t['company'] : $t['branch']) ?></h1>
            <?php if ($t['company'] !== '' && $t['branch'] !== ''): ?><p class="tk-branch"><?= $h($t['branch']) ?></p><?php endif; ?>
            <?php if ($t['address'] !== ''): ?><p class="tk-branch"><?= $h($t['address']) ?></p><?php endif; ?>
        </header>

        <div class="tk-meta">
            <div class="tk-folio"><b>Venta V<?= $h($t['folio']) ?></b><?= $h($stamp) ?></div>
            <span class="tk-pill <?= $h($state[0]) ?>"><?= $h($state[1]) ?></span>
        </div>

        <hr class="tk-hr">

        <div class="tk-row muted"><span>Cliente</span><span><?= $h($t['customer']) ?></span></div>
        <?php if ($t['user'] !== ''): ?><div class="tk-row muted"><span>Te atendió</span><span><?= $h($t['user']) ?></span></div><?php endif; ?>
        <?php if ($t['card'] !== ''): ?><div class="tk-row muted"><span>Tarjeta</span><span><?= $h($t['card']) ?></span></div><?php endif; ?>

        <hr class="tk-hr">

        <p class="tk-label">Productos</p>
        <?php foreach ($t['lines'] as $l): ?>
        <div class="tk-line">
            <div class="tk-row"><span><span class="tk-qty"><?= $h($q($l['quantity'])) ?> ×</span> <?= $h($l['name']) ?></span><span><?= $h($m($l['amount'])) ?></span></div>
            <?php if ($l['details'] !== ''): ?><p class="tk-note"><?= $h($l['details']) ?></p><?php endif; ?>
            <?php if ($l['discount'] > 0.005): ?><p class="tk-note">Descuento −<?= $h($m($l['discount'])) ?></p><?php endif; ?>
        </div>
        <?php endforeach; ?>
        <?php if (!$t['lines']): ?><p class="tk-note">Sin productos.</p><?php endif; ?>

        <hr class="tk-hr">

        <?php if ($t['discount']): ?>
        <div class="tk-row muted"><span>Subtotal</span><span><?= $h($m($t['subtotal'])) ?></span></div>
        <div class="tk-row muted"><span>Descuento<?= $t['discount']['reason'] !== '' ? ' · ' . $h($t['discount']['reason']) : '' ?></span><span>−<?= $h($m($t['discount']['amount'])) ?></span></div>
        <?php endif; ?>
        <div class="tk-row total"><span>Total</span><span><?= $h($m($t['total'])) ?></span></div>
        <?php if ($t['tip'] > 0.005): ?>
        <div class="tk-row muted"><span>Propina</span><span><?= $h($m($t['tip'])) ?></span></div>
        <?php endif; ?>

        <?php if ($t['payments']): ?>
        <hr class="tk-hr">
        <p class="tk-label">Pagos</p>
        <?php foreach ($t['payments'] as $p): ?>
        <div class="tk-row"><span><?= $h($p['method']) ?></span><span><?= $h($m($p['amount'])) ?></span></div>
        <?php if ($p['cash'] && $p['change'] > 0.005): ?>
        <div class="tk-row muted"><span>Recibido <?= $h($m($p['tendered'])) ?></span><span>Cambio <?= $h($m($p['change'])) ?></span></div>
        <?php endif; ?>
        <?php endforeach; ?>
        <?php endif; ?>

        <?php if ($t['credit'] > 0.005): ?>
        <div class="tk-row strong"><span>A crédito</span><span><?= $h($m($t['credit'])) ?></span></div>
        <?php endif; ?>
        <?php if ($t['points'] > 0.005): ?>
        <div class="tk-row muted"><span>Puntos a tu monedero</span><span><?= $h($m($t['points'])) ?></span></div>
        <?php endif; ?>

        <?php if ($t['cancelled']): ?>
        <p class="tk-void">Esta venta fue cancelada.</p>
        <?php else: ?>
        <p class="tk-thanks">¡Gracias por tu compra!</p>
        <?php endif; ?>
        <p class="tk-small">IVA incluido</p>
    </article>

    <div class="tk-actions">
        <button type="button" class="tk-btn" onclick="window.print()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
            Guardar o imprimir
        </button>
    </div>
<?php endif; ?>
    <p class="tk-brand">Ticket digital · Huubie</p>
</main>
</body>
</html>
