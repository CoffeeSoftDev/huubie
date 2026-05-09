<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-subsidiaries.php';

class ctrl extends mdl {

    function init() {
        return [
            'status'  => 200,
            'user'    => $_SESSION['USER']    ?? '',
            'company' => $_SESSION['COMPANY'] ?? '',
            'rol'     => $_SESSION['ROL']     ?? null,
            'sub'     => $_SESSION['SUB']     ?? null,
        ];
    }
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
