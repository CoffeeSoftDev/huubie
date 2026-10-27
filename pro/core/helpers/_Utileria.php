<?php
require_once(__DIR__.'/_Zona.php');
setlocale(LC_TIME, 'es_ES.UTF-8'); // Establecer el locale a español
class Utileria{
// Formatear fecha 00-XX-0000
function letterDate($fecha){
    $timestamp = strtotime($fecha);
    $fecha_formateada = ucwords(strftime('%d-%b-%Y', $timestamp));
    return $fecha_formateada;
}
function formatDate($fecha, $tipo = '') {
    $timestamp = strtotime($fecha);
    if (!$timestamp) return "Fecha inválida";

    $date = new DateTime($fecha);

    switch ($tipo) {
        case 'dayMonth':
            $fecha_formateada = ucwords(strftime('%d-%b', $timestamp));
            break;
        case 'letter':
        case 'smMonth':
            $fecha_formateada = ucwords(strftime('%d-%b-%Y', $timestamp));
            break;
        case 'lgMonth':
            $fecha_formateada = ucwords(strftime('%d-%B-%Y', $timestamp));
            break;
        case 'week':
            $fecha_formateada = strftime('%A', $date->getTimestamp());
            break;
        case 'thead':
            $fecha_formateada = strftime('%d %b<br>%A', $date->getTimestamp());
            break;
        case 'default':
            $fecha_formateada = strftime('%d-%m-%Y', $timestamp);
            break;
        case 'database':
        default:
            $fecha_formateada = strftime('%Y-%m-%d', $timestamp);
            break;
    }

    return $fecha_formateada;
}
function lgMonth($num){
    $array = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return $array[$num];
}
function smMonth($num){
    $array = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return $array[$num];
}
function lgWeek($num){
    $array = ['','Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sábado'];
    return $array[$num];
}
function smWeek($num){
    $array = ['','Dom','Lun','Mar','Mie','Jue','Vie','Sáb'];
    return $array[$num];
}
// Formatear el numero teléfonico
function format_phone($numero) {
    if (strlen($numero) === 10) {
        return '('.substr($numero, 0, 3) . ') '. substr($numero, 3, 3) .' '. substr($numero, 6, 2) .' '. substr($numero, 8, 2);
    } else {
        return $numero;
    }
}
// Formatear numeros en monedas y porcentajes
function format_number($number,$icon = '$') {
    // Validamos si $number es numerico y quitamos posibles espacios en blanco
    $number = (is_numeric(trim($number))) ? trim($number) : 0;

    $number = number_format($number,2,'.','');
    // Verificamos si el número es muy pequeño y se muestra como 0.00
    $isTinyNumber = ($number > 0 && abs($number) < 0.01);

    // Si el número es muy pequeño, devolvemos el guion (-) sin el icono
    if ($isTinyNumber) {
        return '-';
    }

    // Le damos formato de numero con 2 decimales
    $format = ($number == 0 || $number == '') ? '-' : number_format($number,2,'.',',');

    // Agregamos el prefijo necesario al numero.
    if($format !== '-')
        return ($icon === '$') ? "{$icon} {$format}" : "{$format} {$icon}";
    else
        return $format;
}
// Generar codigo de seguridad
function code_security($longitud = 6){
    $caracteres = '0123456789';
    $codigo     = '';

    $caracteres_length = strlen($caracteres);

    // Se hace un recorrido para concatenar numeros aleatoriamente
    for ($i=0; $i < $longitud; $i++)
        $codigo .= $caracteres[random_int( 0, $caracteres_length - 1)];

    return $codigo;
}
// Subir un archivo al servidor
function upload_file($file,$ruta,$new_name = null){
    //Comprobar la existencia de la ruta
    if (!file_exists($ruta)) {
        mkdir($ruta, 0777, true); //Crearla si no existe.
    }

    $original_name  = $file['name'];
    $temporary_name = $file['tmp_name'];
    $file_extension = pathinfo($original_name, PATHINFO_EXTENSION);

    // Se asigna el nombre del archivo en caso que se quiera cambiar.
    $name_file = ($new_name !== null) ? $new_name.'.'.$file_extension : $original_name;

    // Asignamos la ruta completa con el nombre del archivo incluido.
    $full_ruta = $ruta.$name_file;

    // Se mueve de la ubicación temporal al servidor.
    if (move_uploaded_file($temporary_name,$full_ruta)) return true;

    // En caso que no funcione correctamente se retorna null
    return false;
}
// Obtener el dominio y la url completa con http
function url(){
    $https   = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https://' : 'http://';
    $dominio = $https.$_SERVER['HTTP_HOST'].'/';
    $erp     = (explode('/',$_SERVER['REQUEST_URI'])[1] ?? '').'/';
    return [$dominio,$erp];
}
/* URL pública de la carpeta a la que apuntan las rutas relativas del servidor.
   $subir son los mismos niveles que el '../' usado para escribir en disco:
   desde /pro/auth/ctrl/x.php con 3 se obtiene https://host/ (raiz del proyecto) */
function baseUrl($subir = 4){
    $seguro  = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
            || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);

    $esquema = $seguro ? 'https://' : 'http://';
    $script  = isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '';
    $raiz    = str_replace('\\', '/', dirname($script, $subir + 1));

    return $esquema.$_SERVER['HTTP_HOST'].rtrim($raiz, '/').'/';
}
//Darle tratamiento al nombre del colaborador
function tratamiento_nombre($name,$last_name){
    // Se cuentan cuantas palabras tiene el nombre.
    $nombre = ucwords(mb_strtolower($name,'utf-8'));

    // Si el nombre es 1 o más de 2 se retorna el apellido
    if(str_word_count($nombre) === 1 || str_word_count($nombre) > 2 )
        $nombre = explode(' ',$nombre)[0].' '.ucfirst(explode(' ',mb_strtolower($last_name,'utf-8'))[0]);

    return $nombre;
}
// HACER UN RECORRIDO DE FECHA_INICIO Y FECHA_FINAL
function intervalDates($date1,$date2) {
    // Convertir las fechas a objetos DateTime
    $inicio = new DateTime($date1);
    $final  = new DateTime($date2);

    $fechas_recorrido = array();

    // Agregar la fecha de inicio al arreglo
    $fechas_recorrido['dates'][]    = $inicio->format('Y-m-d');
    $fechas_recorrido['fecha'][]    = $inicio->format('d-m-Y');
    $fechas_recorrido['thead'][]    = strftime('%A<br>%d %B', $inicio->getTimestamp());
    $fechas_recorrido['thsm'][]     = strftime('%a<br>%d %b', $inicio->getTimestamp());
    $fechas_recorrido['week'][]     = strftime('%A', $inicio->getTimestamp());
    $fechas_recorrido['dayMonth'][] = strftime('%d %B', $inicio->getTimestamp());
    $fechas_recorrido['my'][]       = $inicio->format('m-Y');
    $mes_inicial                    = $inicio->format('m');

    // Iterar desde la fecha de inicio hasta la fecha de fin
    $fecha_actual = clone $inicio;
    while ($fecha_actual < $final) {
        $fecha_actual->modify('+1 day'); // Avanzar un día
        $fechas_recorrido['dates'][]       = $fecha_actual->format('Y-m-d');
        $fechas_recorrido['fecha'][]       = $fecha_actual->format('d-m-Y');
        $fechas_recorrido['thead'][]       = strftime('%A<br>%d %B', $fecha_actual->getTimestamp());
        $fechas_recorrido['thsm'][]        = strftime('%a<br>%d %b', $fecha_actual->getTimestamp());
        $fechas_recorrido['week'][]        = strftime('%A', $fecha_actual->getTimestamp());
        $fechas_recorrido['dayMonth'][]    = strftime('%d %B', $fecha_actual->getTimestamp());
        if($mes_inicial != $fecha_actual->format('m')) {
            $mes_inicial              = $fecha_actual->format('m');
            $fechas_recorrido['my'][] = $fecha_actual->format('m-Y');
        }
    }

    return $fechas_recorrido;
}
// TRATAMIENTO DE VALORES SQL
function sql($arreglo,$slice = 0){
    if(!empty($arreglo)){
        if(isset($arreglo['opc'])) unset($arreglo['opc']);
        $sqlArray = [];

        if (is_array($arreglo) && isset($arreglo[0]) && is_array($arreglo[0])) {
            $sqlArray['values'] = array_keys(current($arreglo));
            foreach ($arreglo as $row) $sqlArray['data'][] = array_values($row);
        } else {
            foreach ($arreglo as $key => $value) {
                $sqlArray['values'][] = $key; // Obtenemos los index y los guardamos como values
                $sqlArray['data'][] =  ($value == '') ? null : $value; // Obtenemos los values que usamos para cada ?
            }
        }

        // Comprobamos que where exista
        if ($slice !== 0) {
            // Separamos los valores acorde a la cantidad de valores del where
            $sqlArray['where'] = array_slice($sqlArray['values'],-$slice);
            array_splice($sqlArray['values'],-$slice);
        }

        return $sqlArray;
    }
}
// CALCULAR SUMATORIA DE MINUTOS Y SEGUNDOS
function calcularTiempoTotal($totalMinutos, $totalSegundos) {
    // Convertir los segundos a minutos
    $totalMinutos += floor($totalSegundos / 60);
    $totalSegundos = $totalSegundos % 60; // Obtener los segundos restantes

    // Convertir los minutos a horas
    $horas = floor($totalMinutos / 60);
    $minutos = $totalMinutos % 60; // Obtener los minutos restantes

     // Agregar ceros a la izquierda si es menor a 10
    $horas = str_pad($horas, 2, '0', STR_PAD_LEFT);
    $minutos = str_pad($minutos, 2, '0', STR_PAD_LEFT);
    $totalSegundos = str_pad($totalSegundos, 2, '0', STR_PAD_LEFT);

    // Retornar el string con el formato deseado
    return [
            'h' => $horas,
            'm' => $minutos,
            's' => $totalSegundos
        ];
}
}
?>
