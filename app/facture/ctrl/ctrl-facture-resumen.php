<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-facture-resumen.php';

class ctrl extends mdl {

    public $branch;

    public function __construct() {
        parent::__construct();
        $this->branch = $this->resolveBranch();
    }

    // El facturador tiene su propia tabla branch: el id de sucursal de la sesion
    // de Huubie (SUB) es de otro esquema y no cruza con este. Se resuelve contra
    // fayxzvov_facturacion.branch y se cachea en sesion.
    function resolveBranch() {
        if (!empty($_SESSION['FACTURE_BRANCH'])) return (int) $_SESSION['FACTURE_BRANCH'];

        $ls = $this->getBranch();
        $id = (int) ($ls[0]['id'] ?? 0);
        if ($id > 0) $_SESSION['FACTURE_BRANCH'] = $id;

        return $id;
    }

    // branch_id admite NULL: sin sucursal dada de alta el modulo lee las filas
    // sin sucursal en vez de romper la FK.
    function branchId() {
        return $this->branch > 0 ? $this->branch : null;
    }

    // El dia no se elige solo: el Excel del POS se sube en diferido, asi que el
    // modulo abre en el ultimo dia cargado. La meta es una politica de la casa
    // (que parte de la venta se factura), no un dato de la base.
    function init() {
        $dias = $this->lsDias([$this->branchId()]);
        $pide = $_POST['dia'] ?? '';
        $dia  = '';

        foreach ($dias as $item) {
            if ($item['id'] === $pide) $dia = $pide;
        }

        return [
            'dias' => $dias,
            'dia'  => $dia ?: ($dias[0]['id'] ?? date('Y-m-d')),
            'metas' => [
                ['id' => '0.60', 'valor' => '60% de la venta'],
                ['id' => '0.70', 'valor' => '70% de la venta'],
                ['id' => '0.80', 'valor' => '80% de la venta'],
                ['id' => '1.00', 'valor' => '100% de la venta']
            ]
        ];
    }

    // -- Listados --

    // Las tres tablas salen de la misma consulta del dia y se separan por lo que
    // cada panel responde: el acumulado real, lo que falta por facturar (solo
    // banco, porque el efectivo no se factura por esta via) y lo ya bloqueado.
    //
    // El orden es la posicion del ticket dentro del dia: el POS no numera las notas
    // del dia, se cuentan al recorrerlas en orden de operacion.
    function lsTodos() {
        $__row = [];
        $orden = 0;

        foreach ($this->ventasDelDia() as $item) {
            $orden++;
            $__row[] = [
                'id'             => $item['folio'],
                'ID'             => cellId($item['folio']),
                'Orden'          => cellOrden($orden),
                'Forma de pago'  => badgeMetodo($item['method_name']),
                'Monto'          => cellMonto($item['total'])
            ];
        }

        return ['row' => $__row, 'thead' => ''];
    }

    function lsPendientes() {
        $__row = [];
        $orden = 0;

        foreach ($this->ventasDelDia() as $item) {
            $orden++;
            if (esFacturado($item['status_name'])) continue;
            if (esEfectivo($item['method_name']))  continue;

            $__row[] = [
                'id'    => $item['folio'],
                'Sel'   => checkPendiente($item['folio'], $item['total']),
                'ID'    => cellId($item['folio']),
                'Orden' => cellOrden($orden),
                'Monto' => cellMonto($item['total'])
            ];
        }

        return ['row' => $__row, 'thead' => ''];
    }

    function lsFacturados() {
        $__row = [];
        $orden = 0;

        foreach ($this->ventasDelDia() as $item) {
            $orden++;
            if (!esFacturado($item['status_name'])) continue;

            $__row[] = [
                'id'    => $item['folio'],
                'ID'    => cellId($item['folio']),
                'Orden' => cellOrden($orden),
                'Folio' => badgeFolio($item['invoice_series']),
                'Monto' => cellMonto($item['total'])
            ];
        }

        return ['row' => $__row, 'thead' => ''];
    }

    function ventasDelDia() {
        return $this->listSaleByDay([$this->branchId(), $_POST['dia'] ?? date('Y-m-d')]);
    }

    // Todo lo que dicen las tarjetas, la barra de avance y los pies de los paneles.
    // El avance se mide en dinero y no en tickets: la meta es facturar una parte de
    // la venta del dia, no una cantidad de notas.
    function showKpis() {
        $dia  = $_POST['dia'] ?? date('Y-m-d');
        $meta = (float) ($_POST['meta'] ?? 0.7);

        $counts = $this->getSaleDayCounts([$this->branchId(), $dia]);
        $c      = $counts[0] ?? ['tickets' => 0, 'total' => 0, 'facturados' => 0, 'total_facturado' => 0];

        $total       = (float) $c['total'];
        $facturado   = (float) $c['total_facturado'];
        $objetivo    = $total * $meta;
        $porFacturar = max(0, $objetivo - $facturado);
        $avance      = $objetivo > 0 ? round($facturado * 100 / $objetivo, 1) : 0;

        return [
            'status'           => 200,
            'tickets'          => (int) $c['tickets'],
            'bloqueados'       => (int) $c['facturados'],
            'meta'             => $meta,
            'metaPct'          => round($meta * 100),
            'total'            => $total,
            'totalTexto'       => money($total),
            'objetivo'         => $objetivo,
            'objetivoTexto'    => money($objetivo),
            'facturado'        => $facturado,
            'facturadoTexto'   => money($facturado),
            'porFacturar'      => $porFacturar,
            'porFacturarTexto' => money($porFacturar),
            'avance'           => $avance
        ];
    }

    // -- Acciones --

    // Marca como FACTURADO las ventas seleccionadas y les asigna serie.
    function sendToInvoice() {
        $status  = 500;
        $message = 'No se pudo enviar a facturar';
        $ids     = json_decode($_POST['ids'], true);

        if (empty($ids)) {
            return ['status' => 400, 'message' => 'No hay tickets seleccionados'];
        }

        $estado = $this->getSaleStatusIdByName(['FACTURADO']);
        if (empty($estado)) {
            return ['status' => 500, 'message' => 'No existe el estado FACTURADO en el catalogo'];
        }

        $estadoId = $estado[0]['id'];
        $enviados = 0;

        foreach ($ids as $folio) {
            $update = $this->updateSale($this->util->sql([
                'sale_status_id' => $estadoId,
                'invoice_series' => 'F-' . $folio,
                'folio'          => $folio
            ], 1));

            if ($update) $enviados++;
        }

        if ($enviados > 0) {
            $status  = 200;
            $message = $enviados . ' ticket(s) enviados a facturar';
        }

        return [
            'status'   => $status,
            'message'  => $message,
            'enviados' => $enviados
        ];
    }
}

// Complements

function money($valor) {
    return '$' . number_format((float) $valor, 2);
}

function esFacturado($statusName) {
    return strtoupper((string) $statusName) === 'FACTURADO';
}

// El efectivo no entra a la seleccion: no deja rastro bancario y no se factura
// por esta via. Un ticket multipago trae las dos formas concatenadas, asi que se
// pregunta si SOLO fue efectivo.
function esEfectivo($metodo) {
    return strtoupper(trim((string) $metodo)) === 'EFECTIVO';
}

function cellId($folio) {
    return '<span class="font-mono text-[10px] text-gray-400">' . $folio . '</span>';
}

function cellOrden($orden) {
    return '<span class="text-gray-400">' . $orden . '</span>';
}

function cellMonto($valor) {
    return '<span class="font-semibold text-white">' . money($valor) . '</span>';
}

function badgeMetodo($metodo) {
    if (!$metodo) return '<span class="cell-null">Sin pago</span>';

    $tone = esEfectivo($metodo) ? 'b-green' : 'b-terra';
    return '<span class="badge-base ' . $tone . '">' . $metodo . '</span>';
}

function badgeFolio($serie) {
    if (!$serie) return '<span class="cell-null">Sin folio</span>';

    return '<span class="badge-base b-terra">' . $serie . '</span>';
}

// El monto viaja en el checkbox: la suma de lo seleccionado se actualiza en el
// cliente mientras se marca, sin volver a preguntar al servidor.
function checkPendiente($folio, $total) {
    return '<input type="checkbox" class="chk-pending w-4 h-4 rounded border-[#374151] accent-[#1C64F2]"'
         . ' data-id="' . $folio . '" data-amount="' . (float) $total . '"'
         . ' onchange="app.onTogglePendiente(this)">';
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
