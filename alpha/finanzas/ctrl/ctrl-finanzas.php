<?php
ob_start();
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-finanzas.php';

class ctrl extends mdl {

    function init() {
        $subsidiaries = $this->lsSubsidiaries();

        return [
            'status'       => 200,
            'subsidiaries' => $subsidiaries,
            'usr'          => $_SESSION['USR'],
            'sub'          => $_SESSION['SUB'],
            'rol'          => $_SESSION['ROLID']
        ];
    }
}

$obj = new ctrl();
if (ob_get_length()) ob_clean();
header('Content-Type: application/json');
echo json_encode($obj->{$_POST['opc']}());
