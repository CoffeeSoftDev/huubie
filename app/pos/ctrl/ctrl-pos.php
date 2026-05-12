<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-pos.php';
require_once '../../conf/coffeSoft.php';

class ctrl extends mdl {

    function init() {
        return [];
    }

    function ls() {
        $__row = [];
        $ls = $this->listPos();

        foreach ($ls as $item) {
            $__row[] = [
                'id' => $item['id']
            ];
        }

        return $__row;
    }
}

$ctrl = new ctrl();
echo json_encode($ctrl->{$_POST['opc']}());
