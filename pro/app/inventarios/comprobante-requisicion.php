<?php
/*  Comprobante público de una requisición: el enlace que se comparte por
    WhatsApp (Requisiciones y Surtir › Compartir). Sin sesión: se abre solo con
    su llave (requisition.share_token, 32 hex). El mismo documento de
    Imprimir, sin costos.

    Carga el mdl y la hoja (trait-requisicion-doc), NO core-inventarios: ese
    arranca la sesión de pro y a cada visitante le crearía una. */
require_once __DIR__ . '/mdl/mdl-inventarios.php';
require_once __DIR__ . '/mdl/trait-requisicion-doc.php';

class comprobanteRequisicion extends mdl {

    use RequisicionDoc;

    public function render($token) {
        if (!preg_match('/^[a-f0-9]{32}$/', $token)) return null;

        $r = $this->qRequisitionByToken($token);
        if (!$r) return null;

        $lines = array_map(function ($l) { $l['cost'] = 0; return $l; }, $this->qRequisitionLines((int) $r['id']));

        return $this->documentHtml($r, $lines, $this->qRequisitionSupplies((int) $r['id']), false);
    }
}

$html = (new comprobanteRequisicion())->render((string) ($_GET['t'] ?? ''));

header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex');

if ($html === null) {
    http_response_code(404);
    echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Requisición</title></head>'
       . '<body style="font-family:Segoe UI,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:90vh;color:#555">'
       . '<p>Este enlace ya no existe o no es válido.</p></body></html>';
    exit;
}

echo $html;
