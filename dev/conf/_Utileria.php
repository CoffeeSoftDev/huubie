 <?php
date_default_timezone_set('America/Mexico_City');

class Utileria{
    function getIntervalDate($date1, $date2) {
        // Eliminar espacios en blanco al inicio y al final de las fechas
        $date1 = trim($date1);
        $date2 = trim($date2);

        // Convertir las cadenas de fecha en objetos DateTime
        $start = new DateTime($date1);
        $end   = new DateTime($date2);

        // Inicializar el array para almacenar los resultados
        $intervalDate = [
            'dates'      => [], // Fechas en formato 'Y-m-d'
            'fecha'      => [], // Fechas en formato 'd-m-Y'
            'thead'      => [], // Nombre del día + número y nombre del mes largo
            'thsm'       => [], // Nombre corto del día + número y nombre corto del mes
            'week'       => [], // Nombre del día de la semana
            'dayMonth'   => [], // Día y nombre del mes
            'my'         => [], // Mes y año en formato 'm-Y' (para cambios de mes)
        ];

        // Guardar el mes inicial para detectar cambios de mes
        $mes_inicial = $start->format('m');

        // Clonar la fecha de inicio para iterar sin modificar el original
        $fecha_actual = clone $start;

        // Recorrer las fechas desde la inicial hasta la final (incluida)
        while ($fecha_actual <= $end) {
            $timestamp = $fecha_actual->getTimestamp(); // Obtener la marca de tiempo

            // Agregar la fecha en distintos formatos al array
            $intervalDate['dates'][]    = $fecha_actual->format('Y-m-d');
            $intervalDate['fecha'][]    = $fecha_actual->format('d-m-Y');
            $intervalDate['thead'][]    = strftime('%A<br>%d %B', $timestamp);
            $intervalDate['thsm'][]     = strftime('%a<br>%d %b', $timestamp);
            $intervalDate['week'][]     = strftime('%A', $timestamp);
            $intervalDate['dayMonth'][] = strftime('%d %B', $timestamp);

            // Si el mes cambió, agregar el nuevo mes y año al array
            if ($mes_inicial != $fecha_actual->format('m')) {
                $mes_inicial = $fecha_actual->format('m');
                $intervalDate['my'][] = $fecha_actual->format('m-Y');
            }

            // Avanzar un día en la fecha actual
            $fecha_actual->modify('+1 day');
        }

        // Retornar el array con el intervalo de fechas formateado
        return $intervalDate;
    }
    function formatDatetime($datetime) {
        $datetime = new DateTime($datetime);
        $now = new DateTime();
        $yesterday = new DateTime('yesterday');

        // Comprobar si la fecha es hoy
        if ($datetime->format('Y-m-d') === $now->format('Y-m-d')) {
            return "Hoy " . $datetime->format('H:i') . " hrs";
        }

        // Comprobar si la fecha es ayer
        if ($datetime->format('Y-m-d') === $yesterday->format('Y-m-d')) {
            return "Ayer " . $datetime->format('H:i') . " hrs";
        }

        // Si no es hoy ni ayer, retornamos la fecha
        $fecha = $this->formatDate($datetime->format('d-m-Y'),"smDateMonth");
        return $fecha;
    }
    function formatDate($strDate, $type = '') {
        // Limpiamos espacios en blanco
        $strDate = trim($strDate);
        $type = trim($type);

        // Validar si la fecha es válida
        if (empty($strDate) || strtotime($strDate) === false) {
            return "Fecha inválida";
        }

        // Crear objeto DateTime
        $date = new DateTime($strDate);

        // Crear formateador de fecha en español
        $formatter = new IntlDateFormatter(
            'es_ES',                // Locale en español
            IntlDateFormatter::FULL, // Estilo de fecha (no se usa en formato personalizado)
            IntlDateFormatter::NONE, // No mostrar la hora
            'America/Mexico_City',
            IntlDateFormatter::GREGORIAN
        );

        // Formatos personalizados
        $formats = [
            ''            => 'dd-MM-yyyy',    // 01-02-2025
            'smDayMonth'  => 'dd-MMM',       // 01-Ene
            'lgDayMonth'  => 'dd-MMMM',      // 01-Enero
            'smDateMonth' => 'dd-MMM-yyyy',  // 01-Ene-2025
            'lgDateMonth' => 'dd-MMMM-yyyy', // 01-Enero-2025
            'smMonth'     => 'MMM',          // Ene
            'lgMonth'     => 'MMMM',         // Enero
            'week'        => 'EEEE',         // Lunes
            'thead'       => "dd MMM\nEEEE", // 01 Ene \n Lunes
        ];

        // Verificar si el formato solicitado existe, si no, usar el por defecto
        $pattern = $formats[$type] ?? $formats[''];
        $formatter->setPattern($pattern);

        return mb_strtoupper($formatter->format($date),"UTF-8");
    }
    function formatMonth($num, $type = "sm") {
        $num = intval($num);  // Asegurar que es entero
        $type = ($type === "lg") ? "lg" : "sm"; // Si no es "lg", por defecto es "sm"

        // Definir los meses en un solo array y generar abreviaturas automáticamente
        $months = [
            1  => 'Enero',
            2  => 'Febrero',
            3  => 'Marzo',
            4  => 'Abril',
            5  => 'Mayo',
            6  => 'Junio',
            7  => 'Julio',
            8  => 'Agosto',
            9  => 'Septiembre',
            10 => 'Octubre',
            11 => 'Noviembre',
            12 => 'Diciembre'
        ];

        // Generar las versiones cortas automáticamente con `array_map()`
        $shortMonths = array_map(fn($m) => mb_substr($m, 0, 3, 'UTF-8'), $months);

        // Validar si el número es válido
        if (!isset($months[$num])) return "Mes inválido";

        return ($type === "lg") ? $months[$num] : $shortMonths[$num];
    }
    function formatWeek($num, $type = "sm"){
        $num = intval($num);  // Asegurar que es entero
        $type = ($type === "lg") ? "lg" : "sm"; // Si no es "lg", por defecto es "sm"

        // Definir los días en un solo array y generar abreviaturas automáticamente
        $weeks = [
            1  => 'Lunes',
            2  => 'Martes',
            3  => 'Miércoles',
            4  => 'Jueves',
            5  => 'Viernes',
            6  => 'Sábado',
            7  => 'Domingo',
        ];

        // Generar las versiones cortas automáticamente con `array_map()`
        $shortWeeks = array_map(fn($m) => mb_substr($m, 0, 3, 'UTF-8'), $weeks);

        // Validar si el número es válido
        if (!isset($weeks[$num])) return "Mes inválido";

        return ($type === "lg") ? $weeks[$num] : $shortWeeks[$num];
    }
    function formatPhone($number) {
        $number = trim($number);

        if (strlen($number) === 10) {
            $lada = substr($number, 0, 3); // posicion del string 0 + 3
            $pqt1 = substr($number, 3, 3); // 3 + 3
            $pqt2 = substr($number, 6, 2); // 6 + 2
            $pqt3 = substr($number, 8, 2); // 8 + 2

            return "({$lada}) {$pqt1} {$pqt2} {$pqt3}"; // (962) 123 45 67 
        }

        return $number;
    }
    function formatNumber($number, $icon = '$') {
        // Validamos si $number es numerico y limpiamos posibles espacios en blanco
        $number = empty($number) ? 0 : (is_numeric(trim($number)) ? floatval(trim($number)) : 0);
        $icon   = trim($icon);

        // Verificamos si el número es tan pequeño como para mostrar un "-"
        if ($number >= 0 && abs($number) < 0.01) return '-';

        // Formateamos el número con 2 decimales
        $formattedNumber = number_format($number, 2, '.', ',');

        // Agregamos el icono según el tipo
        return $icon === '%' ? "{$formattedNumber} {$icon}" : "{$icon} {$formattedNumber}";
    }
    function securityCode($size = 6){
        $numbers    = '0123456789';
        $alpha1     = 'abcdefghijklmnñopqrstuvwxyz';
        $alpha2     = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
        $characters = "{$numbers}{$alpha1}{$alpha2}";
        
        
        // Se hace un recorrido para concatenar numeros aleatoriamente
        $code              = '';
        $characters_length = strlen($characters);
        for ($i = 0; $i < $size; $i++)
            $code .= $characters[random_int( 0, $characters_length - 1)];
        

        return $code;
    }
    function uploadFile($file,$ruta,$new_name = null){
        
        if (!file_exists($ruta)) { // Comprobar la existencia de la ruta
            mkdir($ruta, 0777, true); // Crearla el fichero si no existe.
        }

        $original_name  = $file['name'];
        $temporary_name = $file['tmp_name'];
        $file_extension = pathinfo($original_name, PATHINFO_EXTENSION);

        // Se asigna el nombre del archivo en caso que se quiera cambiar.
        $name_file = empty($new_name) ? $original_name : "{$new_name}.{$file_extension}";

        // Asignamos la ruta completa con el nombre del archivo incluido.
        $full_ruta = "{$ruta}{$name_file}";

        // Se mueve de la ubicación temporal al servidor.
        if (move_uploaded_file($temporary_name,$full_ruta)) return true;
        else return false;
    }
    function url(){
        $https  = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https://' : 'http://';
        $domain = $_SERVER['HTTP_HOST'].'/';
        $erp    = explode('/',$_SERVER['REQUEST_URI'])[1].'/';

        return [$https.$domain,$erp];
    }
    function capitalize($str){
        $str = trim($str);
        return ucwords(mb_strtolower($str,'utf-8'));
    }
    function formatName($name,$lastName){
        $name     = trim($name);
        $lastName = trim($lastName);
        // Retornar primer nombre y primer apellido
        // [Juan Luis Pérez Solovino] => [Juan Pérez]
        $names    = explode(" ",$name);
        $surnames = explode(" ",$lastName);

        $name     = "{$this->capitalize($names[0])} {$this->capitalize($surnames[0])}";

        return $name;
    }
    function zeroFill($numero, $longitud = 4) {
        return str_pad($numero, $longitud, '0', STR_PAD_LEFT);
    }

    // TRATAMIENTO DE CIFRAS


    // TRATAMIENTO DE VALORES SQL
    function sql($arreglo,$slice = 0){
        if(!empty($arreglo)){
            if(isset($arreglo['opc'])) unset($arreglo['opc']);
            $sqlArray = [];
            
            if (is_array($arreglo)  && isset($arreglo[0]) && is_array($arreglo[0])) {
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

            // if(count($sqlArray['values']) == 0 ) unset($sqlArray['values']);

            return $sqlArray;

        }
    }
}

// funciones de utileria
function evaluar($val, $simbol = '$'){
    $value = is_nan( $val ) ? 0 : $val;
    if($simbol == ''){
        return number_format($value, 2, '.', ', ');
    }if($simbol == '%'){
        return $value ?  number_format($value, 2, '.', ',').' % ' : '-';
    }else {
       if($value < 0):
        $valor =  number_format($value, 2, '.', ',');
        return $value ?  "<span class='text-red-400'>$  $valor </span>"     : '-';
       else:
            return $value ? '$ ' . number_format($value, 2, '.', ',') : '-';
       endif; 
    }
}

function formatSpanishDateAll($fecha = null) {
    setlocale(LC_TIME, 'es_ES.UTF-8'); // Establecer la localización a español

    if ($fecha === null) {
        $fecha = date('Y-m-d'); // Utilizar la fecha actual si no se proporciona una fecha específica
    }

    // Convertir la cadena de fecha a una marca de tiempo
    $marcaTiempo = strtotime($fecha);

    $formatoFecha = "%A, %d de %B del %Y"; // Formato de fecha en español
    $fechaFormateada = strftime($formatoFecha, $marcaTiempo);

    return $fechaFormateada;
}

function formatSpanishDay($fecha = null){
    setlocale(LC_TIME, 'es_ES.UTF-8'); // Establecer la localización a español

    if ($fecha === null) {
        $fecha = date('Y-m-d'); // Utilizar la fecha actual si no se proporciona una fecha específica
    }

    // Convertir la cadena de fecha a una marca de tiempo
    $marcaTiempo = strtotime($fecha);

    $formatoFecha = "%A"; // Formato de fecha en español
    $fechaFormateada = strftime($formatoFecha, $marcaTiempo);

    return $fechaFormateada;
}

function formatSpanishDate($fecha = null, $type = 'short') {
    setlocale(LC_TIME, 'es_ES.UTF-8'); // Establecer localización a español

    if ($fecha === null) {
        $fecha = date('Y-m-d'); // Si no hay fecha, usar la actual
    }

    $marcaTiempo = strtotime($fecha);
    $hoy = date('Y-m-d');
    $ayer = date('Y-m-d', strtotime('-1 day'));
    $antier = date('Y-m-d', strtotime('-2 days'));

    // Verificar si la fecha es hoy o antier
    if ($fecha == $hoy) {
        return "Hoy";
    } elseif ($fecha == $ayer) {
        return "Ayer";
    }

    // Formatos de fecha en español
    $formatos = [
        'short'  => "%d/%b/%Y",          // Ejemplo: 01/ene/2025
        'normal' => "%d de %B del %Y",   // Ejemplo: 01 de enero del 2025
    ];

    // Usar el formato adecuado o 'short' por defecto
    $formatoFecha = $formatos[$type] ?? $formatos['short'];

    return strftime($formatoFecha, $marcaTiempo);
}


?>