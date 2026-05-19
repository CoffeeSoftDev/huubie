<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-subsidiaries.php';

class ctrl extends mdl {

    function init() {
        if ((int) ($_SESSION['ROLID'] ?? 0) === 5) {
            $list = $this->getBranchesByCompany([$_SESSION['COMPANY_ID']]);
        } else {
            $list = $this->getBranchesByUser([$_SESSION['USR']]);
        }

        $branches = [];
        foreach ($list as $branch) {
            $parts    = preg_split('/\s+/', trim($branch['name']));
            $initials = strtoupper(substr($parts[0], 0, 1));
            if (count($parts) > 1) {
                $initials .= strtoupper(substr(end($parts), 0, 1));
            }

            $openShifts      = (int) ($branch['open_shifts']        ?? 0);
            $openShiftsToday = (int) ($branch['open_shifts_today']  ?? 0);
            $closedShifts    = (int) ($branch['closed_shifts_today'] ?? 0);
            $hasClosure      = (int) ($branch['daily_closure_id']   ?? 0) > 0;
            $oldestOpenAt    = $branch['oldest_open_at'] ?? null;

            if ($hasClosure) {
                $shiftStatus = 'closed';
                $shiftLabel  = 'Cierre del dia';
            } elseif ($openShifts > 0 && $openShiftsToday > 0) {
                $shiftStatus = 'open';
                $shiftLabel  = $openShifts === 1 ? 'Turno abierto' : "{$openShifts} turnos abiertos";
            } elseif ($openShifts > 0) {
                $shiftStatus = 'open_stale';
                $shiftLabel  = 'Abierto';
            } elseif ($closedShifts > 0) {
                $shiftStatus = 'pending_close';
                $shiftLabel  = 'Cierre pendiente';
            } else {
                $shiftStatus = 'no_shift';
                $shiftLabel  = 'Sin turno hoy';
            }

            $branches[] = [
                'id'             => (int) $branch['id'],
                'name'           => $branch['name'],
                'ubication'      => $branch['ubication'] ?? '',
                'active'         => (int) $branch['active'],
                'initials'       => $initials,
                'selected'       => ((int) $branch['id'] === (int) ($_SESSION['SUB'] ?? 0)) ? 1 : 0,
                'shift_status'   => $shiftStatus,
                'shift_label'    => $shiftLabel,
                'open_shifts'    => $openShifts,
                'oldest_open_at' => $oldestOpenAt,
            ];
        }

        return [
            'status'   => 200,
            'user'     => $_SESSION['USER']    ?? '',
            'company'  => $_SESSION['COMPANY'] ?? '',
            'rol'      => $_SESSION['ROL']     ?? null,
            'sub'      => $_SESSION['SUB']     ?? null,
            'branches' => $branches,
        ];
    }
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
