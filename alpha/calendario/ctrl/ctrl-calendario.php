<?php
if (empty($_POST['opc'])) exit(0);
require_once '../mdl/mdl-calendario.php';
class Calendario extends MCalendario{
    
    function init(){
        return [
            'init' => "Hola Mundo"
        ];
    }
}

$obj    = new Calendario();
$fn     = $_POST['opc'];
$encode = [];
$encode = $obj->$fn();
echo json_encode($encode);
?>