<?php
/*
	EL CRUD (Create, READ, UPDATE Y DELETE) se ha establecido en este archivo,
	para facilitar el llamado de las diferentes Querys a la base de datos
*/
require('_Conect2.php');

class CRUD extends Conection {

	/*
		Función CUD (Create, Update y Delete)
		los parámetros que recibe son la consulta sql y los datos en forma de arreglo.
		Inserta, modifica y elimina los datos de una tabla en la base de datos.
	*/
	public function _CUD($query, $values) {
		try {
            $this->connect();
			$stm = $this->mysql->prepare($query);

			//Se recorre la variable $values para iterar correctamente los datos
			foreach($values as $key => $value){
				$num = $key + 1;
				$stm->bindParam($num,$values[$key]);
			}

			return $stm->execute();
		} catch (PDOException $e) {
			$message  =  "[ INFO ] ::  $query";
			$message .=  "\n[ ERROR C.U.D. ] :: ". $e->getMessage()."\n";
			$this->writeToLog($message);
		}
	}

	/*
		Función Read
		los parámetros que recibe son la consulta sql y los datos en forma de arreglo.
		Consulta y retorna datos de una tabla en la base de datos.
	*/

	public function _Read($query, $array) {
		try {
            $this->connect();
			$stm = $this->mysql->prepare($query);
			//si el array contiene datos o es null se envia el stm a la conexion 
			if ($array === null) {
				$stm->execute();
			} else {
				// foreach($values as $key => $value){
				// 	$num = $key + 1;
				// 	$stm->bindParam($num,$values[$key]);
				// }

				$stm->execute($array);
			}
			//almacenamos el resultado que la consulta en una variable para poder retornarla
			return $stm->fetchAll(PDO::FETCH_ASSOC);
		} catch (PDOException $e) {
			$message  =  "[ INFO ] ::  $query";
			$message .=  "\n[ ERROR READ] :: ". $e->getMessage()."\n";
			$this->writeToLog($message); 
		}
	}


    // INSERT
   public function _Insert($array,$string = false){
    // Verificamos que el data no este vacío
    if(!empty($array['data'])){
        $data = $array['data'];
        $tabla = $array["table"];

        $valueMatch = is_array($array["values"]) ? $array["values"] : array_map("trim",explode(",",$array["values"]));
        if(count($data) === count($valueMatch)) {
            // Obtenemos los values si es un array lo convertirmos a string
            $values = is_array($array["values"]) ? implode(",", $array["values"]) : $array["values"];

            $placeholders = ""; // Valores temporales "?"
            // Comprobamos si el data es un array multiple
            if (is_array($data) && is_array($data[0]))  {
                // Creamos un array de los grupos [(?), (?), (?)]
                $group = [];
                foreach ($data as $key => $row) 
                    $group[] = "(" . implode(",", array_fill(0, count($row), '?')) . ")";

                // Lo convertimos a string
                $placeholders = implode(", ", $group);
            } else {  
                // Si data es un solo array, convertimos sus valores a placeholders "?"
                // Si data es un string lo convertimos array y luego convertimos sus valores a placeholders "?"
                $placeholders = is_array($data) 
                            ? "(".implode(",", array_fill(0, count($data), '?')).")" 
                            : "(".implode(",", array_fill(0, count(explode(",",$data)), '?')).")";
            }

            $query = "INSERT INTO {$tabla} ({$values}) VALUES {$placeholders}";
            if($string) return $query;
            else return $this->_CUD($query,$data);
        } else return "VALUES \ DATA => DOES NOT MATCH INSERT";
    } else return "¡NO DATA!";
}

public function _Update($array,$string = false){
    if(!empty($array['data'])) {                
        $data = $array['data'];
        $tabla = $array["table"];

        $placeholders = 0;
        $values = "";
        if (!empty($array["values"])) {
            $campos = is_array($array["values"]) ? $array["values"] : explode(",",$array["values"]);
            foreach ($campos as $key => $row) {
                if(strpos($row,"=")) $values .= "$row,";
                else {
                    $values .= "$row = ?,";
                    $placeholders++;
                }

                if( strpos($row,"=") && strpos($row,"?")) $placeholders++;
            }
            $values = rtrim($values,",");
        }
        
        $where = "";
        if (!empty($array["where"])) {
            $condicion = is_array($array["where"]) ? $array["where"] : explode(",",$array["where"]);
            foreach ($condicion as $key => $row) {
                if(strpos($row,"=") || strpos(mb_strtoupper($row),"LIKE") ) $where .= "$row AND ";
                else {
                    $where .= "$row = ? AND ";
                    $placeholders++;
                }

                if( ( strpos($row,"=") || strpos($row,"<") || strpos($row,">") ) && strpos($row,"?")) $placeholders++;
            }
            $where = "WHERE ".rtrim($where," AND ");
        }

        
        if(count($data) === $placeholders){
            $query = "UPDATE {$tabla} SET {$values} {$where}";
            if($string) return $query;
            else return $this->_CUD($query,$data);
        } else return "VALUES \ WHERE \ DATA => DOES NOT MATCH UPDATE";
    } else return "¡NO DATA!";
}

public function _Select($array,$string = false){
    if ( !is_array($array) ) { return $this->_Read("SELECT ".$array,null); }
    else {
        $tablas = "";
        if(!empty($array['table'])) 
            $tablas = "FROM ".(is_array($array["table"]) ? implode(",", $array["table"]) : $array["table"]); //* IMPLODE

        $values = is_array($array["values"]) ? implode(",", $array["values"]) : $array["values"];

        $innerJoin = "";
        if(!empty($array['innerjoin'])) {
            foreach($array["innerjoin"] as $table => $foreingkey) {
                $innerJoin  .= " INNER JOIN $table ON ";
                $innerJoin .= is_array($foreingkey) ? implode(" = ", $foreingkey) : $foreingkey;
            }
        }

        $leftJoin = "";
        if(!empty($array['leftjoin'])) {
            foreach($array["leftjoin"] as $table => $foreingkey) {
                $leftJoin  .= " LEFT JOIN $table ON ";
                $leftJoin .= is_array($foreingkey) ? implode(" = ", $foreingkey) : $foreingkey;
            }
        }

        $placeholders = 0;
        $where = "";
        if (!empty($array["where"])) {
            $condicion = is_array($array["where"]) ? $array["where"] : array_map("trim",explode(",",$array["where"]));
            foreach ($condicion as $key => $row) {
                if(strpos($row,"=") || strpos(mb_strtoupper($row),"LIKE")  || strpos(mb_strtoupper($row),"NULL") ) $where .= "$row AND ";
                else {
                    $where .= "$row = ? AND ";
                    $placeholders++;
                }

                if( ( strpos($row,"=") || strpos($row,"<") || strpos($row,">") ) && strpos($row,"?")) $placeholders++;
            }
            $where = "WHERE ".rtrim($where," AND ");
        }

        $group = "";
        if(!empty($array["group"])){
            $by = is_array($array["group"]) ? implode(",",$array["group"]) : $array["group"];
            $group = "GROUP BY $by";
        }

        $order = "";
        if(!empty($array["order"])){
            foreach($array["order"] as $key => $value) {
                if (preg_match('/\b(ASC|asc|DESC|desc)\b/', $key)) {
                    $order  = "ORDER BY ";
                    $order .= is_array($value) ? implode(",", $value) : $value;
                    $order .= ($key === "ASC" || $key === "asc") ? " ASC" : " DESC";
                }
            }
        }

        $limit = "";
        if(!empty($array["limit"])){
            $limit = "LIMIT ";
            $limit .= is_array($array["limit"]) ? implode(",", $array["limit"]) : $array["limit"];
        }

        $data = empty($array['data']) ? null : $array["data"];
        $query = "SELECT {$values} {$tablas} {$innerJoin} {$leftJoin} {$where} {$group} {$order} {$limit}";
        if($string) return $query; 
        else return $this->_Read($query,$data);
    }
}

// DELETE
public function _Delete($array,$string = false){
    if(!empty($array['data']) && !empty($array['where'])) {
        $tabla = $array["table"];

        $where = "";
        $condicion = is_array($array["where"]) ? $array["where"] : explode(",",$array["where"]);

        if(count($condicion) === count($array['data'])){
            foreach ($condicion as $key => $row) $where .= "$row = ? AND ";
            $where = rtrim($where," AND ");

            $query = "DELETE FROM {$tabla} WHERE {$where}";
            if($string) return $query;
            else return $this->_CUD($query,$array['data']);
        } else return "WHERE \ DATA => DOES NOT MATCH DELETE";
    } else return "¡NO DATA, NO WHERE!";
}

}

?>