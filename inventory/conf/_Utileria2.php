
<?php
class Utileria{

// Tratamiento del array para SQL
function sql($POST, $where = 0){
    if(isset($POST['opc'])) unset($POST['opc']);
    $array = []; //Creamo un nuevo array para darle tratamiento
    foreach ($POST as $key => $value) {
        $array['values'][] = $key; // Obtenemos los index y los guardamos como values
        $array['data'][] = $value; // Obtenemos los values que usamos para cada ?
    }

    // Comprobamos que where exista
    if ($where !== 0) {
        // Separamos los valores acorde a la cantidad de valores del where
        $array['where'] = array_slice($array['values'],-$where);
        array_splice($array['values'],-$where);
    }

    // En caso que values sea igual a 0 lo eliminamos del array
    if(count($array['values']) == 0 ) unset($array['values']);

    return $array;
}
}