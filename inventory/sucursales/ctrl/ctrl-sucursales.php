<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-sucursales.php';

class ctrl extends mdl {

    function init() {
        $userId    = $_SESSION['IDU']        ?? 0;
        $companyId = $_SESSION['company_id'] ?? 0;
        $isOwner   = (int) ($_SESSION['is_owner'] ?? 0);

        $rows        = $this->getBranchesByUser([$userId, $companyId, $isOwner, $userId]);
        $branches    = [];
        $nameUser    = $_SESSION['user'] ?? '';
        $companyLogo = null;

        foreach ($rows as $branch) {
            $parts    = preg_split('/\s+/', trim($branch['name']));
            $initials = strtoupper(substr($parts[0], 0, 1));
            if (count($parts) > 1) {
                $initials .= strtoupper(substr(end($parts), 0, 1));
            }

            $branches[] = [
                'id'           => (int) $branch['id'],
                'name'         => $branch['name'],
                'ubication'    => $branch['ubication'] ?? '',
                'active'       => (int) $branch['active'],
                'initials'     => $initials,
                'selected'     => ((int) $branch['id'] === (int) ($_SESSION['branch_id'] ?? 0)) ? 1 : 0,
                // En fayxzvov_erp aún no existen tablas de turnos; estado neutro por ahora.
                'shift_status' => 'no_shift',
                'shift_label'  => 'Sin turno hoy',
            ];
            $nameUser    = $branch['user'] ?: $nameUser;
            $companyLogo = $branch['logo'] ?? $companyLogo;
        }

        return [
            'status'       => 200,
            'user'         => $nameUser,
            'company'      => $_SESSION['company'] ?? '',
            'sub'          => $_SESSION['branch_id'] ?? null,
            'branches'     => $branches,
            'company_logo' => $companyLogo,
        ];
    }

    function switchBranch() {
        $id = (int) ($_POST['id'] ?? 0);
        if ($id <= 0) {
            return ['status' => 400, 'message' => 'Sucursal inválida'];
        }

        $branch = $this->getBranchById([$id, $_SESSION['company_id'] ?? 0]);
        if (!$branch) {
            return ['status' => 404, 'message' => 'Sucursal no encontrada'];
        }

        $expira = time() + (365 * 24 * 60 * 60);
        setcookie('branch_id', $id,             $expira, '/');
        setcookie('branch',    $branch['name'], $expira, '/');

        $_SESSION['branch_id'] = $id;
        $_SESSION['branch']    = $branch['name'];

        return [
            'status'    => 200,
            'branch_id' => $id,
            'branch'    => $branch['name'],
        ];
    }

    function logout() {
        setcookie('branch_id', '', time() - 3600, '/');
        setcookie('branch',    '', time() - 3600, '/');
        session_unset();
        session_destroy();
        return ['status' => 200];
    }
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
