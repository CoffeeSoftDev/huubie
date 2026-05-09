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
            $branches[] = [
                'id'        => (int) $branch['id'],
                'name'      => $branch['name'],
                'ubication' => $branch['ubication'] ?? '',
                'active'    => (int) $branch['active'],
                'initials'  => $initials,
                'selected'  => ((int) $branch['id'] === (int) ($_SESSION['SUB'] ?? 0)) ? 1 : 0,
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
