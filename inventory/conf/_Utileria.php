
<?php
class Utileria{
function sql($arreglo,$slice = 0){
    if(!empty($arreglo)){
        if(isset($arreglo['opc'])) unset($arreglo['opc']);
        $sqlArray = [];

        
        if (is_array($arreglo) && isset($arreglo[0]) && is_array($arreglo[0])) {
            $sqlArray['values'] = array_keys(current($arreglo));
            foreach ($arreglo as $row) {
                $sqlArray['data'][] = array_values($row);
            }
        } else {
            foreach ($arreglo as $key => $value) {
                $sqlArray['values'][] = $key;
                $sqlArray['data'][]   = ($value == '') ? null : $value;
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

// Espejo EXACTO de badge() en app/conf/_Utileria.php y del simulador JS en
// inventory/operacion/almacen/js/catalogo.js (badgeColors/badgePreview). El color es el
// FONDO y el texto se adapta (mismo matiz, mas claro y vivo). Mantener los tres en sync.
function badge($text, $color = '#9CA3AF', $degrade = 100, $bgHex = null, $icon = null) {
    $label = ($text === null || $text === '') ? '-' : $text;
    $ico   = ($icon !== null && $icon !== '')
        ? '<i data-lucide="' . htmlspecialchars($icon, ENT_QUOTES, 'UTF-8') . '" class="w-3 h-3"></i> '
        : '';
    $spanClass = $ico
        ? 'inline-flex items-center gap-1 text-[10px] font-semibold px-3 py-1 rounded'
        : 'text-[10px] font-semibold px-3 py-1 rounded';

    // Modelo de 2 colores: $bgHex es el fondo explicito y $color el color del texto.
    // Cuando se recibe $bgHex se ignora la derivacion automatica.
    if ($bgHex !== null && $bgHex !== '') {
        $fg = $color ?: '#475569';
        return '<span class="' . $spanClass . '" style="background:' . $bgHex . ';color:' . $fg . ';">' . $ico . $label . '</span>';
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