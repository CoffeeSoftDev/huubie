<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once '../mdl/mdl-admin-folios.php';

class AdminFolios extends MAdminFolios {

    function init() {
        return [
            'sucursales'   => $this->lsSucursales(),
            'status'       => $this->lsStatus(),
            'sin_sucursal' => $this->countWithoutSubsidiary(),
            'access'       => $_SESSION['ROLID'] ?? null
        ];
    }

    function lsFolios() {
        $folios = $this->getFolios([
            'fi'              => $_POST['fi'] ?? date('Y-m-01'),
            'ff'              => $_POST['ff'] ?? date('Y-m-t'),
            'subsidiaries_id' => $_POST['subsidiaries_id'] ?? '0',
            'only_without'    => !empty($_POST['only_without']),
            'status'          => $_POST['status'] ?? '0'
        ]) ?? [];

        $rows = [];
        foreach ($folios as $folio) {
            $hasSubsidiary = !empty($folio['subsidiaries_id']);

            $subsidiaryBadge = $hasSubsidiary
                ? "<span class='inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-[#1e3a5f] text-blue-200'>" . htmlspecialchars($folio['subsidiary_name']) . "</span>"
                : "<span class='inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-[#5b1e1e] text-red-200'>Sin sucursal</span>";

            $moveButton = "<button onclick='adminFolios.move({$folio['id']})' class='px-2 py-1 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold'>Mover</button>";

            $rows[] = [
                'id'       => $folio['id'],
                'Folio'    => ['html' => "<span class='font-semibold text-gray-200'>#{$folio['id']}</span>"],
                'Creación' => $folio['date_creation'],
                'Cliente'  => [
                    'html' => "<p class='text-gray-300'>" . htmlspecialchars($folio['name_client'] ?? '—') . "</p>"
                            .  "<p class='text-gray-500 text-[11px]'>" . htmlspecialchars($folio['phone'] ?? '') . "</p>"
                ],
                'Total'    => [
                    'html'  => number_format($folio['total_pay'] ?? 0, 2),
                    'class' => 'text-end bg-[#283341]'
                ],
                'Estado'   => $folio['status_label'] ?? '—',
                'Sucursal' => ['html' => $subsidiaryBadge, 'class' => 'text-center'],
                'Acción'   => ['html' => $moveButton, 'class' => 'text-center']
            ];
        }

        return ['row' => $rows];
    }

    function moveFolio() {
        $id  = $_POST['id'] ?? null;
        $raw = $_POST['subsidiaries_id'] ?? '';

        $subsidiaries_id = ($raw !== '' && $raw !== 'null' && $raw !== '0') ? $raw : null;

        if (!$id) {
            return ['status' => 400, 'message' => 'No se especificó el folio.'];
        }

        $result = $this->updateFolioSubsidiary($subsidiaries_id, $id);

        if ($result === true) {
            $message = $subsidiaries_id
                ? "Folio #{$id} movido correctamente."
                : "Folio #{$id} quedó sin sucursal.";
            return ['status' => 200, 'message' => $message];
        }

        return ['status' => 500, 'message' => 'No se pudo mover el folio.', 'debug' => $result];
    }
}

$obj    = new AdminFolios();
$opc    = $_POST['opc'];
$result = $obj->$opc();
echo json_encode($result);
