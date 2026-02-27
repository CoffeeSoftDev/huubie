<?php
require_once('../../conf/_CRUD.php');
class Usuarios extends CRUD {
    function lsPerfil(){
        return $this->_Select([
            'table'  => 'perfiles',
            'values' => 'idPerfil as id,perfil AS valor',
            'where'  => 'perfil_estado = 1'
        ]);
    }
    function lsUsers(){
        return $this->_Select([
            'table'  => 'usuarios',
            'values' => 'idUser,usser,usr_estado,usr_perfil,perfil',
            'innerjoin' => ['perfiles' => 'usr_perfil = idPerfil']
        ]);
    }
    function create_user($array){
        return $this->_CUD('INSERT INTO usuarios (usr_perfil,usser,keey) VALUES (?,?,MD5(?))',$array);
    }
}
?>