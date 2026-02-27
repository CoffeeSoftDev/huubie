<?php
    require_once('../../conf/_CRUD.php');

    class Directorios extends CRUD{
        // FULL DATOS
        function allDirectory(){
            $query = "SELECT
                    	modulos.idModulo AS idM,
                    	modulos.modulo,
                    	directorios.idDirectorio AS id,
                    	directorios.directorio AS directorio,
                    	directorios.dir_ruta AS ruta,
                    	directorios.dir_orden AS orden,
                    	directorios.dir_estado AS estado,
                    	directorios.dir_block AS validacion,
                    	directorios.dir_visible AS oculto,
                    	directorios.dir_submodulo AS idS,
                        submodulos.submodulo
                    FROM
                    	directorios
                    	INNER JOIN modulos ON modulos.idModulo = directorios.dir_modulo
						LEFT JOIN submodulos ON submodulos.idSubmodulo = dir_submodulo
                    GROUP BY
                    	directorios.idDirectorio 
                    ORDER BY
                        mod_orden,
                        sub_orden,
                        dir_orden ASC,
                    	directorios.dir_estado DESC";
            return $this->_Read($query,null);
        }
        function listModules(){
            $query = "SELECT
                    modulos.idModulo AS id,
                    modulos.modulo AS valor
                FROM 
                    modulos
                ORDER BY
                    mod_orden,valor ASC";
            return $this->_Read($query,null);
        }
        function listSubmodules(){
            $query = "SELECT
                    submodulos.idSubmodulo AS id,
                    submodulos.submodulo AS valor,
                    submodulos.sub_idModulo AS idM
                FROM 
                    submodulos
                ORDER BY
                    valor ASC";
            return $this->_Read($query,$array);
        }
        function selectModuloExist($array){
            $query = "SELECT
                        idModulo 
                    FROM
                        modulos 
                    WHERE
                    modulo = ? AND
                    mod_ruta = ?";
            return $this->_Read($query,$array);
        }
        function selectSubmoduloExist($array){
            $query = "SELECT
                        idSubmodulo 
                    FROM
                        submodulos 
                    WHERE
                        sub_idModulo = ? AND
                        submodulo = ? AND
                        sub_ruta = ?";
            return $this->_Read($query,$array);
        }
        function ruteModule($array){
            $query = "SELECT mod_ruta FROM modulos WHERE idModulo = ?";
            $sql = $this->_Read($query,$array);
            return $sql[0]['mod_ruta'];
        }
        function ruteSubmodule($array){
            $query = "SELECT sub_ruta FROM submodulos WHERE idSubmodulo = ?";
            $sql = $this->_Read($query,$array);
            return $sql[0]['sub_ruta'];
        }
        function ruteDirectory($array){
            $query = "SELECT dir_ruta FROM directorios WHERE idDirectorio = ?";
            $sql = $this->_Read($query,$array);
            return $sql[0]['dir_ruta'];
        }
        // INSERT
        function insertModule($array){
            $query = "INSERT INTO modulos (modulo, mod_ruta) VALUES (?,?)";
            return $this->_CUD($query,$array);
        }
        function insertSubmodule($array){
            $query = "INSERT INTO submodulos (sub_idModulo,submodulo,sub_ruta) VALUES (?,?,?)";
            return $this->_CUD($query,$array);
        }
        function insertDirectory($array){
            $query = "INSERT INTO directorios (
                        dir_modulo,
                        dir_submodulo,
                        directorio,
                        dir_ruta
                        ) VALUES (
                            ?,?,?,?
                        )";
            $exito = $this->_CUD($query,$array);
            if($exito == true)
                $sql =  $this->_Read('SELECT MAX(idDirectorio) AS idDir FROM directorios',null);

            return $sql[0]['idDir']; 
        }
        function tics($array){
            $query = "INSERT INTO permisos
                        ( id_Perfil, id_Directorio, ver, escribir, editar, imprimir )
                        VALUES
                            ( 1, ?, 1, 1, 1, 1 )";
            return $this->_CUD($query,$array);
        }
        // UPDATE
        function statusDirectory($array){
            $query = "UPDATE directorios SET dir_estado = ? WHERE idDirectorio = ?";
            return $this->_CUD($query,$array);
        }
        function visibleDirectory($array){
            $query = "UPDATE directorios SET dir_visible = ? WHERE idDirectorio = ?";
            return $this->_CUD($query,$array);
        }
        function blockDirectory($array){
            $query = "UPDATE directorios SET dir_block = ? WHERE idDirectorio = ?";
            return $this->_CUD($query,$array);
        }
        function updateDirectory($array){
            $query = "UPDATE directorios SET
                            directorio = ?,
                            dir_ruta = ?,
                            dir_modulo = ?,
                            dir_submodulo = ?
                        WHERE 
                            idDirectorio = ?";
            return $this->_CUD($query,$array);
        }
        function changeOrder($array){
            $query = "UPDATE directorios SET dir_orden = ? WHERE idDirectorio = ?";
            return $this->_CUD($query,$array);
        }
        // DELETE
        function deleteDirectory($array){
            return $this->_CUD("DELETE FROM directorios WHERE idDirectorio = ?",$array);
        }
    } 
?>