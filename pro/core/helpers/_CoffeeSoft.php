<?php
function evaluar($val, $simbol = '$', $negative = false){

    $value = is_nan($val) ? 0 : $val;
    $isNegative = $value < 0;

    if($simbol == ''){
        $valor = number_format($value, 2, '.', ',');
        if($isNegative && $negative):
            return $value ? "<span class='text-danger'>$valor</span>" : '-';
        else:
            return $value ? $valor : '-';
        endif;    
    }elseif($simbol == '%'){
        $valor = number_format($value, 2, '.', ',');
        if($isNegative && $negative):
            return $value ? "<span class='text-danger'>$valor %</span>" : '-';
        else:
            return $value ? "$valor %" : '-';
        endif; 
    }else {
        $valor = number_format($value, 2, '.', ',');
        if($isNegative && $negative):
            return $value ? "<span class='text-danger'>$ $valor</span>" : '-';
        else:
            return $value ? "$ $valor" : '-';
        endif; 
    }
    
}
function formatSpanishDateTime($fecha = null) {
    if ($fecha === null) {
        $fecha = date('Y-m-d H:i:s');
    }

    $ts = strtotime($fecha);

    $meses = [
        1 => 'ene', 2 => 'feb', 3 => 'mar', 4 => 'abr',
        5 => 'may', 6 => 'jun', 7 => 'jul', 8 => 'ago',
        9 => 'sep', 10 => 'oct', 11 => 'nov', 12 => 'dic'
    ];

    $dia  = date('d', $ts);
    $mes  = $meses[(int) date('n', $ts)];
    $anio = date('Y', $ts);
    $hora = date('h:i', $ts);
    $ampm = date('a', $ts);

    return "{$dia}/{$mes}/{$anio} {$hora} {$ampm}";
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

function formatSpanishDate($fecha = null) {
    setlocale(LC_TIME, 'es_ES.UTF-8'); // Establecer la localización a español

    if ($fecha === null) {
        $fecha = date('Y-m-d'); // Utilizar la fecha actual si no se proporciona una fecha específica
    }

    // Convertir la cadena de fecha a una marca de tiempo
    $marcaTiempo = strtotime($fecha);

    $formatoFecha = "%d/%B/%Y"; // Formato de fecha en español
    $fechaFormateada = strftime($formatoFecha, $marcaTiempo);

    return $fechaFormateada;
}

function formatSpanishNoDay($fecha = null){
    setlocale(LC_TIME, 'es_ES.UTF-8'); // Establecer la localización a español

   // Si no se proporciona una fecha específica, usar la fecha actual
    if ($fecha === null) {
        $fecha = date('Y-m-d');
    }

    // Convertir la cadena de fecha a una marca de tiempo
    $marcaTiempo = strtotime($fecha);

    // Obtener el número del día de la semana (0 para domingo, 6 para sábado)
    $numeroDia = date('w', $marcaTiempo);

    return $numeroDia;
}

function renderUserCard($name, $color = '#2563EB') {
    $initials = '';
    $nameParts = explode(' ', trim($name));
    
    if (count($nameParts) >= 2) {
        $initials = strtoupper(substr($nameParts[0], 0, 1) . substr($nameParts[1], 0, 1));
    } else {
        $initials = strtoupper(substr($name, 0, 2));
    }

    return '<div class="flex items-center gap-3">
        <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style="background-color: ' . $color . ';">
            ' . $initials . '
        </div>
        <div class="flex flex-col">
            <span class="text-xs font-semibold ">' . htmlspecialchars($name) . '</span>
        </div>
    </div>';
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

function listDays(){
    
    return [
        2 => 'Lunes',
        3 => 'Martes',
        4 => 'Miercoles',
        5 => 'Jueves',
        6 => 'Viernes',
        7 => 'Sabado',
        1 => 'Domingo'
        
    ];
}

