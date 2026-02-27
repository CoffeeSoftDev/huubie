<?php
if(empty($_POST['opc'])) exit(0);

require_once('../mdl/mdl-usuarios.php'); $obj = new Usuarios;
require_once('../../conf/_Utileria.php'); $util = new Utileria;

$encode = [];

switch ( $_POST['opc'] ) {
    case 'initComponent':
            $encode['perfiles'] = $obj->lsPerfil();
            $encode['usuarios'] = $obj->lsUsers();
        break;
    case 'create':
            $array = $util->sql($_POST);
            $encode = $obj->create_user($array['data']);
        break;
}
echo json_encode($encode);
?>