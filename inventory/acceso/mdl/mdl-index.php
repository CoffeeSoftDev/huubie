<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class Index extends CRUD {
    protected $util;
    public $bd;

    

    function getUserByCredentials($array) {
        $query = "
            SELECT
                u.idUser AS IDU,
                u.usr_perfil AS IDP,
                u.usr_udn AS udn_id,
                udn.UDN AS udn_name,
                pf.perfil AS perfil_name
            FROM usuarios u
            INNER JOIN perfiles pf ON pf.idPerfil = u.usr_perfil
            INNER JOIN udn ON udn.idUDN = u.usr_udn
            WHERE u.usser = ?
                AND (u.keey = MD5(?) OR u.keey2 = MD5(?))
                AND u.usr_estado = 1
                AND pf.perfil_estado = 1
            LIMIT 1
        ";
        
        return $this->_Read($query, $array);
    }
}
?>
