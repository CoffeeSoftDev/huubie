<?php
/*  La hoja de una requisición: Imprimir (Requisiciones y Surtir, con costos si
    la casilla ver-costos lo deja) y el comprobante público del enlace de
    WhatsApp (comprobante-requisicion.php, sin costos). Va aparte del ctrl
    porque el comprobante se abre sin sesión: no carga core-inventarios (que
    arranca la sesión de pro). Solo usa lo que recibe. */

if (!function_exists('h')) {
    function h($text) { return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8'); }
}

trait RequisicionDoc {

    /*  $r: la fila de qGetRequisition / qRequisitionByToken; $lines:
        qRequisitionLines (cost en 0 si no van costos); $supplies:
        qRequisitionSupplies. $toolbar: los botones Imprimir / Cerrar. */
    protected function documentHtml($r, array $lines, array $supplies, $costs, $toolbar = true) {
        $total = 0.0;
        $rows  = '';

        foreach ($lines as $l) {
            $sub    = (float) $l['quantity'] * (float) $l['cost'];
            $total += $sub;
            $rows  .= '<tr><td class="prod"><span class="prod-name">' . h($l['name']) . '</span>'
                    . ($l['sku'] ? ' <span class="sku">' . h($l['sku']) . '</span>' : '')
                    . ($l['note'] ? '<div class="pres">' . h($l['note']) . '</div>' : '') . '</td>'
                    . '<td class="c">' . h($this->docNum($l['quantity'])) . '</td>'
                    . '<td class="c">' . h($this->docNum($l['quantity_supplied'])) . '</td>'
                    . '<td class="c">' . h($l['unit'] ?: 'PZA') . '</td>'
                    . ($costs ? '<td class="r">$' . number_format($sub, 2) . '</td>' : '') . '</tr>';
        }

        $hist = '';
        foreach ($supplies as $s) {
            $hist .= '<tr><td>' . h($this->docDate($s['created_at'], true)) . '</td>'
                   . '<td>' . h($s['warehouse'] ?: '-') . '</td>'
                   . '<td class="c">' . (int) $s['total_products'] . '</td>'
                   . '<td class="c">' . h($this->docNum($s['total_units'])) . '</td>'
                   . '<td>' . ($s['inflow_folio'] ? 'Recibido · ' . h($s['inflow_folio']) : 'Por recibir') . '</td></tr>';
        }

        $info = function ($k, $v) {
            return '<div class="info-item"><span class="k">' . h($k) . '</span><span class="v">' . h($v ?: '-') . '</span></div>';
        };

        $css = "*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#c8c8c8;color:#000;padding:24px}"
             . ".toolbar{width:816px;max-width:100%;margin:0 auto 16px;display:flex;justify-content:flex-end;gap:8px}.btn{cursor:pointer;border:1px solid #000;border-radius:4px;padding:8px 16px;font-size:13px;font-weight:600;color:#fff;background:#333}.btn.gray{background:#777}"
             . ".sheet{width:816px;max-width:100%;min-height:1056px;margin:0 auto;background:#fff;padding:40px 48px;box-shadow:0 2px 10px rgba(0,0,0,.25)}"
             . ".doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:18px}.doc-title{font-size:22px;font-weight:800}.folio{font-size:20px;font-weight:800;text-align:right}"
             . ".status{display:inline-block;margin-top:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:2px 10px;border:1px solid #000;border-radius:3px}"
             . ".info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 40px;margin-bottom:18px}.info-item{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #ccc;padding-bottom:4px;font-size:12px}.info-item .k{color:#555}.info-item .v{font-weight:700;text-align:right}"
             . "h4{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#555;margin:6px 0}"
             . "table{width:100%;border-collapse:collapse;margin-bottom:18px}thead th{border-bottom:1.5px solid #000;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:4px 8px;text-align:left}thead th.r{text-align:right}thead th.c{text-align:center}"
             . "tbody td{padding:3px 8px;font-size:11px;border-bottom:1px solid #e2e2e2}tbody td.r{text-align:right;white-space:nowrap}tbody td.c{text-align:center;white-space:nowrap}.prod-name{font-weight:600}.sku{color:#777;font-size:10px}.pres{color:#555;font-size:10px;font-style:italic;margin-top:1px}"
             . ".nota{margin-top:6px;border-left:3px solid #000;background:#f7f7f7;padding:10px 14px;font-size:12px}.nota b{display:block;margin-bottom:3px;text-transform:uppercase;font-size:10px;letter-spacing:.5px;color:#555}"
             . ".firmas{display:flex;justify-content:space-between;gap:64px;margin-top:72px;page-break-inside:avoid}.firma{flex:1;text-align:center;font-size:11px}.firma .linea{border-top:1px solid #000;margin-bottom:6px}.firma .rol{font-weight:700;text-transform:uppercase;letter-spacing:.5px;font-size:10px}"
             . "@media (max-width:700px){body{padding:8px}.sheet{padding:20px 16px;min-height:auto}.info-grid{grid-template-columns:1fr}}"
             . "@media print{body{background:#fff;padding:0}.toolbar{display:none}.sheet{width:auto;min-height:auto;box-shadow:none;padding:0}}";

        return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
             . '<title>Requisición ' . h($r['folio']) . '</title><style>' . $css . '</style></head><body>'
             . ($toolbar ? '<div class="toolbar"><button class="btn" onclick="window.print()">Imprimir</button><button class="btn gray" onclick="window.close()">Cerrar</button></div>' : '')
             . '<div class="sheet">'
             . '<div class="doc-header"><div><div class="doc-title">Requisición</div><div style="font-size:12px;color:#555;margin-top:3px">'
             . h($r['branch']) . ' &rarr; ' . h($r['source_branch']) . '</div></div>'
             . '<div><div class="folio">' . h($r['folio']) . '</div><span class="status">' . h($r['status_name']) . '</span></div></div>'
             . '<div class="info-grid">'
             . $info('Pide', $r['branch']) . $info('Surte', $r['source_branch'])
             . $info('Área', $r['department']) . $info('Lo necesita para', $r['needed_date'] ? $this->docDate($r['needed_date']) : '')
             . $info('Creada', $this->docDate($r['created_at'], true)) . $info('Productos', (string) count($lines))
             . '</div>'
             . '<table><thead><tr><th>Producto</th><th class="c">Pedido</th><th class="c">Surtido</th><th class="c">Unidad</th>' . ($costs ? '<th class="r">Importe est.</th>' : '') . '</tr></thead>'
             . '<tbody>' . ($rows ?: '<tr><td colspan="' . ($costs ? 5 : 4) . '" class="c">Sin productos</td></tr>') . '</tbody></table>'
             . ($costs ? '<p style="text-align:right;font-size:13px;font-weight:800;margin:-8px 0 16px">Total estimado $' . number_format($total, 2) . '</p>' : '')
             . ($hist ? '<h4>Surtimientos</h4><table><thead><tr><th>Fecha</th><th>Almacén</th><th class="c">Productos</th><th class="c">Unidades</th><th>Recepción</th></tr></thead><tbody>' . $hist . '</tbody></table>' : '')
             . ($r['note'] ? '<div class="nota"><b>Nota</b>' . h($r['note']) . '</div>' : '')
             . ($r['reject_reason'] ? '<div class="nota"><b>Motivo</b>' . h($r['reject_reason']) . '</div>' : '')
             . '<div class="firmas"><div class="firma"><div class="linea"></div><div class="rol">Solicita</div></div><div class="firma"><div class="linea"></div><div class="rol">Surte</div></div><div class="firma"><div class="linea"></div><div class="rol">Recibe</div></div></div>'
             . '</div></body></html>';
    }

    // 28/nov/2026 (con $time: 28/nov/2026 08:45 am).
    private function docDate($stamp, $time = false) {
        $ts = strtotime((string) $stamp);
        if (!$ts) return '-';

        $months = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

        return date('d', $ts) . '/' . $months[(int) date('n', $ts)] . '/' . date('Y', $ts) . ($time ? ' ' . date('h:i a', $ts) : '');
    }

    // 1,250.5: sin ceros de más.
    private function docNum($n) {
        return rtrim(rtrim(number_format((float) $n, 3, '.', ','), '0'), '.');
    }
}
