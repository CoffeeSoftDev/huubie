<?php
/*
	EL CRUD (Create, READ, UPDATE Y DELETE) se ha establecido en este archivo,
	para facilitar el llamado de las diferentes Querys a la base de datos
*/
require('_Conect.php');

class CRUD extends Conection {
/* Función CUD (Create, Update y Delete)
    los parámetros que recibe son la consulta sql y los datos en forma de arreglo.
    Inserta, modifica y elimina los datos de una tabla en la base de datos.
*/
public function _CUD($query, $values) {
    try {
        $this->connect();
        $stm = $this->mysql->prepare($query);

        // Verificar si $values es un array multidimensional
        $isMultidimensional = is_array($values) && is_array($values[0]);

        //Se recorre la variable $values para iterar correctamente los datos
        foreach($values as $key => $row){
            // Si es multidimensional, vincular cada valor en la fila
            if ($isMultidimensional) {
                foreach ($row as $colKey => $colValue) {
                    $num = ($key * count($row)) + $colKey + 1;
                    $stm->bindParam($num, $values[$key][$colKey]);
                }
            } else {
                // Si es un array simple, vincular cada valor directamente
                $num = $key + 1;
                $stm->bindParam($num, $values[$key]);
            }
        }

        // Almacenamos el resultado de la ejecución
        $result = $stm->execute();
        // Cerrar la conexión después de realizar la consulta
        $this->disconnect();
        // Retornamos el resultado
        return $result;
    } catch (PDOException $e) {
        $message  =  "[ INFO ] ::  $query";
        $message .=  "\n[ ERROR C.U.D. ] :: ". $e->getMessage()."\n";
        $this->writeToLog($message);
    }
}
/* Función Read
    los parámetros que recibe son la consulta sql y los datos en forma de arreglo.
    Consulta y retorna datos de una tabla en la base de datos.
*/
public function _Read($query, $values = null,$retorno = false) {
    try {
        // if($retorno == true) return $query;

        $this->connect();
        $stm = $this->mysql->prepare($query);
        //si el array contiene datos o es null se envia el stm a la conexion 
        if (!isset($values)) {
            $stm->execute();
        } else {
            foreach($values as $key => $value){
                $num = $key + 1;
                $stm->bindParam($num,$values[$key]);
            }

            $stm->execute();
        }
        //almacenamos el resultado que la consulta en una variable para poder retornarla
        $result = $stm->fetchAll(PDO::FETCH_ASSOC);
        // Cerrar la conexión después de realizar la consulta
        $this->disconnect();
        // Retornamos el resultado
        return $result;
    } catch (PDOException $e) {
        $message  =  "[ INFO ] ::  $query";
        $message .=  "\n[ ERROR READ] :: ". $e->getMessage()."\n";
        $this->writeToLog($message); 
    }
}
// Select
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
            $condicion = is_array($array["where"]) ? $array["where"] : preg_split('/\s*,\s*(?![^()]*\))/', $array["where"]);
            foreach ($condicion as $key => $row) {
                // if ( strpos($row,"=") || strpos($row,"<") || strpos($row,">") || strpos(mb_strtoupper($row),"LIKE")  || strpos(mb_strtoupper($row),"NULL") || strpos(mb_strtoupper($row),"BETWEEN") || strpos(mb_strtoupper($row),"DATE_FORMAT")) 
                //     $where .= "$row AND ";
                if (preg_match('/(=|<|>|LIKE|NULL|BETWEEN|DATE_FORMAT|IN|NOT IN)\s*\(?.*?\)?/', $row)) {
                    $where .= "$row AND ";
                    // Cuenta el número de placeholders en la condición actual
                    $placeholders += substr_count($row, '?');
                }
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
        if (!empty($array["order"])) {
            $orderClauses = [];
            foreach ($array["order"] as $key => $value) {
                if (preg_match('/\b(ASC|asc|DESC|desc)\b/', $key)) {
                    $direction = (strtoupper($key) === "ASC") ? "ASC" : "DESC";
                    $columns = is_array($value) ? implode(",", $value) : $value;
                    $orderClauses[] = "$columns $direction";
                }
            }
            if (!empty($orderClauses)) {
                $order = "ORDER BY " . implode(", ", $orderClauses);
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
// INSERT
public function _Insert($array,$tbSQL = '',$string = false){
    // Verificamos que el data no este vacío
    if(!empty($array['data'])){
        $data = $array['data'];
        $tabla = $array["table"];

        if (is_string($tbSQL) && $tbSQL != '' ) $tabla = $tbSQL;
        else if(is_bool($tbSQL) && $tbSQL == true ) $string = true;

        $valueMatch = is_array($array["values"]) ? $array["values"] : array_map("trim",explode(",",$array["values"]));

        // Comprobamos si 'data' es una inserción múltiple o simple
        if (is_array($data) && is_array($data[0])) {
            // Validamos que cada subarray en 'data' tenga la misma longitud que 'valueMatch'
            foreach ($data as $row) {
                if (count($row) !== count($valueMatch)) return "VALUES \ DATA => DOES NOT MATCH INSERT";
            }
        } else {
            // Validamos que 'data' tenga la misma longitud que 'valueMatch'
            if (count($data) !== count($valueMatch))  return "VALUES \ DATA => DOES NOT MATCH INSERT";
        }
        
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
            
    } else return "¡NO DATA!";
}
// UPDATE
public function _Update($array,$tbSQL = '',$string = false){
    if(!empty($array['data'])) {
        $data = $array['data'];
        $tabla = $array["table"];

        if (is_string($tbSQL) && $tbSQL != '' ) $tabla = $tbSQL;
        else if(is_bool($tbSQL) && $tbSQL == true ) $string = true;

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
// DELETE
public function _Delete($array,$tbSQL = '',$string = false){
    if(!empty($array['data']) && !empty($array['where'])) {
        $tabla = $array["table"];

        if (is_string($tbSQL) && $tbSQL != '' ) $tabla = $tbSQL;
        else if(is_bool($tbSQL) && $tbSQL == true ) $string = true;

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


/* 
* IMPLODE:
    Convierte un array en un string 
    $array = [$v1,$v2]; // $string = implode(",", $array) // el resultado es "$v1,$v2";
    en este ejemplo convierte el array en un string separado por ",".
* EXPLODE:
    Convierte un string en un array 
    $string = "$v1+$v2+$v3"; // $array = explode("+", $string); // el resultado es [$v1,$v2,$v3]
    en este ejemplo convierte el array en un string separado por "+".
* ARRAY_FILL
    $array =  array_fill(0, count($data), '?'), lo que hace es tomar el array original "$data" y convertir cada uno de sus elementos
    en "?" en otras palabras $data["v1","v2"] = $array["?","?"]. Esto lo hace tomando la cantidad del array coriginal con count 
    y lo convierte desde la posicion 0.
 */
?>