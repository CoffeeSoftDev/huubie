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


// Copia de badge() de inventory/conf/_Utileria.php (y de app/conf). El color es el
// FONDO y el texto se adapta (mismo matiz, mas claro y vivo). Mantener los tres en sync
// (excepcion: la clase cs-badge-soft del modelo de 2 colores es solo de inventory).
// $radius: clase de redondeo de Tailwind ('rounded' por defecto, 'rounded-full' = pastilla).
function badge($text, $color = '#9CA3AF', $degrade = 100, $bgHex = null, $icon = null, $radius = 'rounded') {
    $label = ($text === null || $text === '') ? '-' : $text;
    $ico   = ($icon !== null && $icon !== '')
        ? '<i data-lucide="' . htmlspecialchars($icon, ENT_QUOTES, 'UTF-8') . '" class="w-3 h-3"></i> '
        : '';
    $spanClass = $ico
        ? 'inline-flex items-center gap-1 text-[10px] font-semibold px-3 py-1 ' . $radius
        : 'text-[10px] font-semibold px-3 py-1 ' . $radius;

    // Modelo de 2 colores: $bgHex es el fondo explicito y $color el color del texto.
    // Cuando se recibe $bgHex se ignora la derivacion automatica.
    // Solo en inventory: `cs-badge-soft` + `--b-fg` dejan que dark-mode.css cambie
    // el fondo pastel por un velo de su color cuando el tema es de pagina oscura.
    if ($bgHex !== null && $bgHex !== '') {
        $fg = $color ?: '#475569';
        return '<span class="cs-badge-soft ' . $spanClass . '" style="--b-fg:' . $fg . ';background:' . $bgHex . ';color:' . $fg . ';">' . $ico . $label . '</span>';
    }

    // Modelo clasico (retrocompatible): $color es el FONDO y el texto se deriva del mismo matiz.
    $hex = ltrim($color ?: '#9CA3AF', '#');
    if (strlen($hex) === 3) {
        $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
    }
    $r = hexdec(substr($hex, 0, 2));
    $g = hexdec(substr($hex, 2, 2));
    $b = hexdec(substr($hex, 4, 2));

    // Fondo = el color elegido, al $degrade % de opacidad.
    $alpha = max(0.0, min(100.0, (float) $degrade)) / 100;
    $bg    = "rgba($r,$g,$b,$alpha)";

    // Texto = se adapta: mismo matiz del fondo, mas claro y vivo para contrastar.
    $rn = $r / 255; $gn = $g / 255; $bn = $b / 255;
    $max = max($rn, $gn, $bn); $min = min($rn, $gn, $bn);
    $l = ($max + $min) / 2; $h = 0; $s = 0;
    if ($max != $min) {
        $d = $max - $min;
        $s = $l > 0.5 ? $d / (2 - $max - $min) : $d / ($max + $min);
        if ($max == $rn)     $h = ($gn - $bn) / $d + ($gn < $bn ? 6 : 0);
        elseif ($max == $gn) $h = ($bn - $rn) / $d + 2;
        else                 $h = ($rn - $gn) / $d + 4;
        $h /= 6;
    }
    $s = max(0.50, min(0.85, $s));
    $l = max(0.62, min(0.92, $l + 0.42));

    if ($s == 0) {
        $tr = $tg = $tb = $l;
    } else {
        $hue2rgb = function ($p, $q, $t) {
            if ($t < 0) $t += 1;
            if ($t > 1) $t -= 1;
            if ($t < 1 / 6) return $p + ($q - $p) * 6 * $t;
            if ($t < 1 / 2) return $q;
            if ($t < 2 / 3) return $p + ($q - $p) * (2 / 3 - $t) * 6;
            return $p;
        };
        $q  = $l < 0.5 ? $l * (1 + $s) : $l + $s - $l * $s;
        $p  = 2 * $l - $q;
        $tr = $hue2rgb($p, $q, $h + 1 / 3);
        $tg = $hue2rgb($p, $q, $h);
        $tb = $hue2rgb($p, $q, $h - 1 / 3);
    }
    $fg = sprintf('#%02X%02X%02X', (int) round($tr * 255), (int) round($tg * 255), (int) round($tb * 255));

    return '<span class="' . $spanClass . '" style="background:' . $bg . ';color:' . $fg . ';">' . $ico . $label . '</span>';
}

// La foto del usuario lista para un <img src>. users.photo guarda solo el nombre
// del archivo dentro de pro/uploads/users/. $levels son los dirname() que hay del
// script que corre a pro/: 3 desde auth/ctrl/, 4 desde app/<modulo>/ctrl/.
// Si ya viene como URL o ruta absoluta se deja igual.
function userPhotoUrl($photo, $levels) {
    $photo = trim((string) $photo);
    if ($photo === '') return '';
    if ($photo[0] === '/' || preg_match('#^https?://#', $photo)) return $photo;

    $base = dirname($_SERVER['SCRIPT_NAME'] ?? '', $levels);
    $base = rtrim(str_replace('\\', '/', $base), '/');

    return $base . '/uploads/users/' . rawurlencode($photo);
}
