<?php
require_once('../../conf/_CRUD.php');
class Perfiles extends CRUD {
    // SELECT 
    function allDirectory(){
        $query = "SELECT
                    	modulos.idModulo AS idM,
                    	modulos.modulo,
                    	directorios.idDirectorio AS id,
                    	directorios.directorio AS directorio,
                    	directorios.dir_ruta AS ruta,
                    	directorios.dir_estado AS estado,
                    	directorios.dir_block AS validacion,
                    	directorios.dir_visible AS oculto,
                    	directorios.dir_submodulo AS idS,
                    	(SELECT submodulos.submodulo FROM submodulos WHERE submodulos.idSubmodulo = idS) AS submodulo
                    FROM
                    	directorios
                    	INNER JOIN modulos ON modulos.idModulo = directorios.dir_modulo
                    WHERE
                    	directorios.dir_visible = 1 
                    GROUP BY
                    	directorios.idDirectorio 
                    ORDER BY
                    	modulo ASC,
                    	id ASC,
                    	directorios.dir_estado DESC";
        return $this->_Read($query,null);
    }
    function ProfileList(){
        $query = "SELECT
                        idPerfil as id,
                        perfil,
                        perfil_estado as estado
                    FROM
                        perfiles";
        return $this->_Read($query,null);
    }
    function moduleDirectory($array){
        $query = "SELECT idDirectorio FROM directorios WHERE dir_modulo = ?";
        return $this->_Read($query,$array);
    }
    function submoduleDirectory($array){
        $query = "SELECT idDirectorio FROM directorios WHERE dir_submodulo = ?";
        return $this->_Read($query,$array);
    }
    function existencePermission($array){
        $query = "SELECT id_Directorio FROM permisos WHERE id_Perfil = ? AND id_Directorio = ?";
        $sql   = $this->_Read($query,$array);
        if ( isset($sql[0])) {
            return true;
        } else {
            return false;
        }
    }
    // INSERT
    function newProfile($array){
        $query = "INSERT INTO perfiles (perfil) VALUES (?)";
        return $this->_CUD($query,$array);
    }
    function insertPermission($array){
        $query = "INSERT INTO permisos (id_Perfil,id_Directorio,ver,escribir,editar,imprimir) VALUES (?,?,1,1,1,1)";
        return $this->_CUD($query,$array);
    }
    function insertPermissionOnexOne($array){
        $query = "INSERT INTO permisos (ver,id_Perfil,id_Directorio) VALUES (1,?,?)";
        return $this->_CUD($query,$array);
    }
    // UPDATE
    function statusProfile($array){
        $query = "UPDATE perfiles SET perfil_estado = ? WHERE idPerfil = ?";
        return $this->_CUD($query,$array);
    }
    function editProfile($array){
        $query = "UPDATE perfiles SET perfil = ? WHERE idPerfil = ?";
        return $this->_CUD($query,$array);
    }
    function updatePermisssion($campo,$array){
        $query = "UPDATE permisos SET $campo = ? WHERE id_Perfil = ? AND id_Directorio = ?";
        return $this->_CUD($query,$array);
    }
    //DELETE
    function deletePermission($array){
        $query = "DELETE FROM permisos WHERE id_Perfil = ? AND id_Directorio = ?";
        return $this->_CUD($query,$array);
    }
}
?>