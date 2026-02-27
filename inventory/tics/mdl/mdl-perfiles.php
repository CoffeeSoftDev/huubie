<?php
require_once('../../conf/_CRUD.php');
class Perfiles extends CRUD {
    // SELECT 
    function listUDN(){
        $query = "SELECT
                    udn.idUDN AS id,
                    udn.UDN AS valor
                FROM
                    udn
                WHERE
                    udn.Stado = 1 
                ORDER BY
                    udn.UDN ASC";
        return $this->_Read($query,null);
    }
    function allDirectory($id){
        $query = "SELECT
                    modulos.idModulo AS idM,
                    modulos.modulo AS modulo,
                    submodulos.submodulo AS submodulo,
                    directorios.dir_submodulo AS idSubmodulo,
                    directorios.idDirectorio AS id,
                    directorios.directorio AS directorio,
                    ( SELECT ver FROM permisos WHERE permisos.id_Directorio = id AND permisos.id_Perfil = $id ) as ver,
                    ( SELECT escribir FROM permisos WHERE permisos.id_Directorio = id AND permisos.id_Perfil = $id ) as escribir,
                    ( SELECT editar FROM permisos WHERE permisos.id_Directorio = id AND permisos.id_Perfil = $id ) as editar,
                    ( SELECT imprimir FROM permisos WHERE permisos.id_Directorio = id AND permisos.id_Perfil = $id ) as imprimir
                FROM
                    directorios
                    INNER JOIN modulos ON modulos.idModulo          = directorios.dir_modulo
                    INNER JOIN submodulos ON submodulos.idSubmodulo = directorios.dir_submodulo
                    OR directorios.dir_submodulo IS NULL
                GROUP BY
                    directorios.idDirectorio
                ORDER BY
                    modulo ASC,
                    submodulo ASC,
                    id ASC,
                    directorios.dir_estado DESC";
        return $this->_Read($query,null);
    }
    function ProfileList(){
        $query = "SELECT
                    idPerfil AS id,
                    perfil,
                    perfil_estado AS estado
                FROM
                    perfiles";
        return $this->_Read($query,null);
    }
    function allDirectories(){
        $query = "SELECT idDirectorio FROM directorios";
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
    function existencePermissionAll($array){
        $query = "SELECT count(id_Directorio) as cuenta FROM permisos WHERE id_Perfil = ?";
        $sql   = $this->_Read($query,$array);
        return $sql[0]['cuenta'];
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
    function deleteAllModules($array){
        $query = "DELETE FROM permisos WHERE id_Perfil = ?";
        return $this->_CUD($query,$array);
    }
}
?>