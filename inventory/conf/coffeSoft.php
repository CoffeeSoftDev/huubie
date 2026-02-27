<?php

function evaluar($val, $simbol = '$'){

    $value = is_nan( $val ) ? 0 : $val;

    if($simbol == ''){
        
        return number_format($value, 2, '.', ', ');
    }if($simbol == '%'){
        
        return $value ?  number_format($value, 2, '.', ',').' % ' : '-';
    }else {
     
       if($value < 0):
        $valor =  number_format($value, 2, '.', ',');

        return $value ?  "<span class='text-danger'>$  $valor </span>"     : '-';

       else:
            return $value ? '$ ' . number_format($value, 2, '.', ',') : '-';
       endif; 

    }
    
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

    $formatoFecha = "%d/%b/%Y"; // Formato de fecha en español
    $fechaFormateada = strftime($formatoFecha, $marcaTiempo);

    return $fechaFormateada;
}

function setStatus($status){



    switch ($status) {
        case 1:
            return '<span class="label label-success">Activo</span>';
        
        case 2:
            return '<span class="label label-primary">En espera..</span>';
    
        case 0:
            return '<span class="label label-danger">Cancelado</span>';
        default:
            return '<span class="label label-primary">Desconocido</span>';
            break;
    }

}