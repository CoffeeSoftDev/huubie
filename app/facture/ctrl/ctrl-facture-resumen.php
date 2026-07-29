<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-facture-resumen.php';

class ctrl extends mdl {

    public $subsidiariesId;

    public function __construct() {
        parent::__construct();
        $this->subsidiariesId = (int) ($_SESSION['SUB'] ?? $_POST['subsidiaries_id'] ?? 0);
    }

    // subsidiaries_id apunta por FK a fayxzvov_alpha.subsidiaries: un 0 sin
    // sucursal en sesion rompe la restriccion, y la columna admite NULL.
    function branchId() {
        return $this->subsidiariesId > 0 ? $this->subsidiariesId : null;
    }

    function init() {
        $dias = $this->lsDias([$this->branchId()]);

        return [
            'dias' => $dias,
            'dia'  => empty($dias) ? date('Y-m-d') : $dias[0]['id']
        ];
    }

    // -- Listados --

    function lsTodos() {
        return ['row' => $this->rowsDelDia(''), 'thead' => ''];
    }

    function lsPendientes() {
        return ['row' => $this->rowsDelDia('VENCIDO'), 'thead' => ''];
    }

    function lsFacturados() {
        return ['row' => $this->rowsDelDia('FACTURADO'), 'thead' => ''];
    }

    // Las tres pestanas comparten consulta y se separan por estado fiscal.
    function rowsDelDia($estado) {
        $dia = $_POST['dia'];

        $__row = [];
        foreach ($this->listSaleByDay([$this->branchId(), $dia]) as $item) {
            if ($estado !== '' && $item['status_name'] !== $estado) continue;

            $facturado = $item['status_name'] === 'FACTURADO';

            $__row[] = [
                'id'      => $item['folio'],
                'Folio'   => '<span class="font-semibold text-gray-300">' . $item['folio'] . '</span>',
                'Hora'    => '<span class="text-gray-400">' . date('H:i', strtotime($item['operation_date'])) . '</span>',
                'Metodo'  => '<span class="text-gray-400">' . ($item['method_name'] ?: 'Sin pago') . '</span>',
                'Mesero'  => '<span class="text-gray-400">' . ($item['waiter_code'] ?: '-') . '</span>',
                'Total'   => '<span class="font-semibold text-gray-300">$' . number_format($item['total'], 2) . '</span>',
                'Factura' => $item['invoice_series'] ? '<span class="text-gray-400">' . $item['invoice_series'] . '</span>' : '<span class="cell-null">Sin factura</span>',
                'Estado'  => fiscalBadge($facturado)
            ];
        }

        return $__row;
    }

    function showKpis() {
        $dia  = $_POST['dia'];
        $meta = (float) $_POST['meta'];

        $counts = $this->getSaleDayCounts([$this->branchId(), $dia]);
        $c      = $counts[0];

        $tickets    = (int) $c['tickets'];
        $facturados = (int) $c['facturados'];
        $avance     = $tickets > 0 ? round($facturados * 100 / $tickets, 1) : 0;

        return [
            'status'          => 200,
            'tickets'         => $tickets,
            'total'           => (float) $c['total'],
            'facturados'      => $facturados,
            'total_facturado' => (float) $c['total_facturado'],
            'pendientes'      => $tickets - $facturados,
            'avance'          => $avance,
            'meta'            => $meta * 100,
            'cumple_meta'     => $avance >= ($meta * 100)
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

function fiscalBadge($facturado) {
    return $facturado
        ? '<span class="badge-base b-green">Facturado</span>'
        : '<span class="badge-base b-yellow">Pendiente</span>';
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
