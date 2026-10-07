
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

// Colores del badge de un área (warehouse_area). Con color_hex elegido en Catálogo > Área:
// ese es el texto y el fondo es su tono claro. Sin él, un tono fijo de la paleta por id,
// así la misma área sale igual en todas las filas. Lo usan la tabla de Productos, el
// select de Área (init de ctrl-almacen) y el catálogo de Áreas.
function areaColors($id, $hex) {
    if (preg_match('/^#[0-9A-Fa-f]{6}$/', (string) $hex)) {
        $rgb = sscanf($hex, '#%02x%02x%02x');
        $bg  = array_map(function ($c) { return (int) round($c + (255 - $c) * 0.85); }, $rgb);

        return ['fg' => strtoupper($hex), 'bg' => vsprintf('#%02X%02X%02X', $bg)];
    }

    $palette = [
        ['fg' => '#1D4ED8', 'bg' => '#DBEAFE'],
        ['fg' => '#047857', 'bg' => '#D1FAE5'],
        ['fg' => '#6D28D9', 'bg' => '#EDE9FE'],
        ['fg' => '#B45309', 'bg' => '#FEF3C7'],
        ['fg' => '#BE123C', 'bg' => '#FFE4E6'],
        ['fg' => '#0E7490', 'bg' => '#CFFAFE'],
        ['fg' => '#C2410C', 'bg' => '#FFEDD5'],
        ['fg' => '#4338CA', 'bg' => '#E0E7FF'],
        ['fg' => '#0F766E', 'bg' => '#CCFBF1'],
        ['fg' => '#A21CAF', 'bg' => '#FAE8FF']
    ];

    return $palette[(int) $id % count($palette)];
}

// Switch de estado de las filas de catálogo: encendido = activo (clic da de baja),
// apagado = inactivo (clic activa). $fn es el status() del JS, que confirma antes y
// recibe el estado actual de la fila como número (compara con !== 1).
// Encendido va con el acento del tema (`blue-*` sigue a --brand-*), en degradado.
// El pr-3 lo separa del borde derecho de la celda (y del botón que le sigue).
function statusSwitch($fn, $id, $active) {
    $on = (int) $active === 1;

    return [
        'class'   => 'inline-flex items-center justify-center h-9 pl-1 pr-3 cursor-pointer',
        'html'    => '<span class="relative inline-flex items-center w-9 h-5 rounded-full transition-colors hover:brightness-110 ' . ($on ? 'bg-gradient-to-r from-blue-700 to-blue-500 shadow-sm' : 'bg-gray-300') . '">'
                   . '<span class="inline-block w-4 h-4 rounded-full bg-white shadow-md transition-transform ' . ($on ? 'translate-x-[16px]' : 'translate-x-0.5') . '"></span>'
                   . '</span>',
        'title'   => $on ? 'Dar de baja' : 'Activar',
        'onclick' => $fn . '(' . (int) $id . ', ' . ($on ? 1 : 0) . ')'
    ];
}
// Desglose de las cards (Entradas, Salidas): celdas de createCoffeeTable3.
// Cantidad sin ceros de relleno: 120, 12.5, 0.25.
function kpiQuantity($value) {
    return rtrim(rtrim(number_format((float) $value, 2, '.', ','), '0'), '.');
}

function kpiPercent($part, $total) {
    return (float) $total > 0 ? number_format((float) $part * 100 / (float) $total, 1) . ' %' : '-';
}

function kpiProduct($name, $sku) {
    $html = htmlspecialchars((string) $name, ENT_QUOTES, 'UTF-8');
    if (!empty($sku)) $html .= ' <span class="text-[10px] text-gray-400">' . htmlspecialchars($sku, ENT_QUOTES, 'UTF-8') . '</span>';
    return $html;
}

// Fila de total al pie (opc 2: coffeeSoft le pone el borde superior grueso).
function kpiTotalRow($cells) {
    $row = ['id' => 'total'];
    foreach ($cells as $column => $value) {
        $row[$column] = [
            'html'  => $value,
            'class' => 'font-bold'
        ];
    }
    $row['opc'] = 2;
    return $row;
}
