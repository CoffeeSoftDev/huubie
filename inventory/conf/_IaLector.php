<?php
/*  IaLector :: sacarle el texto a lo que se sube a un chat de IA.

    El modelo no abre archivos: lee texto. Este helper recibe una ruta en disco y
    devuelve un string. No habla con el modelo, no toca la base y no sabe quien
    pregunta, asi que se puede probar sin sesion.

    Port recortado de pro/core/Helpers/_IaLector.php (erp-pro): aqui solo hace
    falta lo que trae una lista de productos o precios -- Excel (.xlsx y .xls),
    CSV y texto --. Las fotos NO se leen aqui: las transcribe un modelo con vision
    (ver IaOllama::transcribirImagen).

    Nunca lanza: un archivo corrupto termina en 'aviso', no en una pantalla en blanco.
*/
class IaLector {

    // Lista BLANCA: lo que no este aqui no entra.
    const TIPOS = [
        'xlsx' => 'doc',
        'xls'  => 'doc',
        'csv'  => 'doc',
        'txt'  => 'doc',
        'png'  => 'imagen',
        'jpg'  => 'imagen',
        'jpeg' => 'imagen',
        'webp' => 'imagen'
    ];

    // Se mira la firma de los bytes, no la extension: la extension la escribe quien sube.
    const FIRMAS = [
        'xlsx' => "PK\x03\x04",
        'png'  => "\x89PNG",
        'jpg'  => "\xFF\xD8\xFF",
        'jpeg' => "\xFF\xD8\xFF"
    ];

    const FIRMA_OLE = "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1";

    // Tope de texto y de filas por hoja: una lista de precios cabe de sobra; un
    // catalogo de veinte mil filas no cabe en la pregunta y se corta avisando.
    const MAX_TEXTO = 30000;
    const MAX_FILAS = 400;

    static function clase($ext) {
        $ext = strtolower(ltrim((string) $ext, '.'));

        return isset(self::TIPOS[$ext]) ? self::TIPOS[$ext] : null;
    }

    static function firmaOk($ruta, $ext) {
        $ext = strtolower((string) $ext);

        if ($ext === 'xls') return self::firmaXls($ruta);

        if (!isset(self::FIRMAS[$ext])) return true;

        $f = @fopen($ruta, 'rb');

        if ($f === false) return false;

        $cabeza = (string) fread($f, 8);

        fclose($f);

        return strpos($cabeza, self::FIRMAS[$ext]) === 0;
    }

    // Devuelve siempre ['texto', 'aviso', 'partes'] (partes = hojas del Excel).
    static function leer($ruta, $ext) {
        $ext = strtolower(ltrim((string) $ext, '.'));

        if (!is_readable($ruta)) return self::salida('', 'No encontré el archivo en el servidor.');

        try {
            switch ($ext) {
                case 'xlsx': return self::xlsx($ruta);
                case 'xls':  return self::xls($ruta);
                default:     return self::plano($ruta);
            }
        } catch (Exception $e) {
            return self::salida('', 'El archivo está dañado o no pude abrirlo.');
        } catch (Error $e) {
            return self::salida('', 'El archivo está dañado o no pude abrirlo.');
        }
    }

    // Renglones con contenido, para el chip del chat ("3 hojas · 48 renglones").
    static function renglones($t) {
        $n = 0;

        foreach (explode("\n", (string) $t) as $linea) {
            $linea = trim($linea);

            if ($linea !== '' && strpos($linea, '===') !== 0 && strpos($linea, '[') !== 0) $n++;
        }

        return $n;
    }

    private static function salida($texto, $aviso = '', $partes = 0) {
        return ['texto' => $texto, 'aviso' => $aviso, 'partes' => (int) $partes];
    }

    // -- Texto plano (csv, txt) --

    private static function plano($ruta) {
        $crudo = (string) @file_get_contents($ruta, false, null, 0, self::MAX_TEXTO * 4);

        if (trim($crudo) === '') return self::salida('', 'El archivo está vacío.');

        return self::salida(self::recortar(self::normalizar($crudo)), '', 1);
    }

    // -- Excel .xlsx --
    // Los textos viven UNA vez en xl/sharedStrings.xml y cada celda guarda el
    // numero de casilla: hay que cruzar los dos o donde dice "Coca Cola" sale un 47.

    private static function xlsx($ruta) {
        if (!class_exists('ZipArchive')) return self::salida('', 'Este servidor no puede abrir hojas de cálculo.');

        $zip = new ZipArchive;

        if ($zip->open($ruta) !== true) {
            return self::salida('', 'No pude abrir el Excel. Si es un .xls antiguo, guárdalo como .xlsx y vuelve a subirlo.');
        }

        $tabla = [];
        $ss    = (string) $zip->getFromName('xl/sharedStrings.xml');

        if ($ss !== '') {
            preg_match_all('~<si>(.*?)</si>~s', $ss, $m);

            foreach ($m[1] as $si) {
                preg_match_all('~<t[^>]*>(.*?)</t>~s', $si, $t);

                $tabla[] = self::entidades(implode('', $t[1]));
            }
        }

        $nombres = [];
        $wb      = (string) $zip->getFromName('xl/workbook.xml');

        if ($wb !== '' && preg_match_all('~<sheet[^>]*name="([^"]*)"~', $wb, $m)) {
            foreach ($m[1] as $n) $nombres[] = self::entidades($n);
        }

        $hojas = [];

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $n = (string) $zip->getNameIndex($i);

            if (preg_match('~^xl/worksheets/sheet(\d+)\.xml$~', $n, $mm)) {
                $hojas[(int) $mm[1]] = (string) $zip->getFromIndex($i);
            }
        }

        $zip->close();

        if (empty($hojas)) return self::salida('', 'El Excel no tiene hojas legibles.');

        ksort($hojas);

        $out   = '';
        $corte = false;

        foreach ($hojas as $num => $xml) {
            $titulo = isset($nombres[$num - 1]) ? $nombres[$num - 1] : 'Hoja ' . $num;
            $filas  = self::filasDeHoja($xml, $tabla, $corte);

            if ($filas === '') continue;

            $out .= "\n=== " . $titulo . " ===\n" . $filas;
        }

        if ($corte) $out .= "\n[Se cortó en " . self::MAX_FILAS . " filas por hoja. Hay más abajo.]\n";

        if (trim($out) === '') return self::salida('', 'El Excel está vacío.');

        return self::salida(self::recortar($out), '', count($hojas));
    }

    // Filas de una hoja en TSV; las celdas vacias del final de cada fila se tiran.
    private static function filasDeHoja($xml, $tabla, &$corte) {
        preg_match_all('~<row[^>]*>(.*?)</row>~s', $xml, $rows);

        $out = '';
        $n   = 0;

        foreach ($rows[1] as $fila) {
            if ($n >= self::MAX_FILAS) { $corte = true; break; }

            preg_match_all('~<c\b([^>]*)/>|<c\b([^>]*)>(.*?)</c>~s', $fila, $cs, PREG_SET_ORDER);

            $celdas = [];

            foreach ($cs as $c) {
                $attr = $c[1] !== '' ? $c[1] : (isset($c[2]) ? $c[2] : '');
                $body = isset($c[3]) ? $c[3] : '';
                $tipo = preg_match('~\bt="([^"]*)"~', $attr, $mt) ? $mt[1] : '';

                // t="inlineStr" trae el texto en la propia celda (lo usan varios exportadores).
                if ($tipo === 'inlineStr') {
                    preg_match_all('~<t[^>]*>(.*?)</t>~s', $body, $ti);

                    $celdas[] = self::entidades(implode('', $ti[1]));
                    continue;
                }

                $v = preg_match('~<v[^>]*>(.*?)</v>~s', $body, $mv) ? $mv[1] : '';

                $celdas[] = $tipo === 's'
                          ? (isset($tabla[(int) $v]) ? $tabla[(int) $v] : '')
                          : self::entidades($v);
            }

            while (!empty($celdas) && trim((string) end($celdas)) === '') array_pop($celdas);

            if (empty($celdas)) continue;

            $out .= implode("\t", $celdas) . "\n";
            $n++;
        }

        return $out;
    }

    // -- Excel .xls --
    // Tres caras: el binario OLE de Office 97, una tabla HTML/XML con nombre .xls
    // (lo que exportan muchos puntos de venta) y un .xlsx renombrado.

    private static function firmaXls($ruta) {
        $f = @fopen($ruta, 'rb');

        if ($f === false) return false;

        $cabeza = (string) fread($f, 512);

        fclose($f);

        return strpos($cabeza, self::FIRMA_OLE) === 0
            || strpos($cabeza, self::FIRMAS['xlsx']) === 0
            || self::xlsDeTexto($cabeza);
    }

    private static function xlsDeTexto($cabeza) {
        $c = ltrim((string) preg_replace('~^\xEF\xBB\xBF~', '', (string) $cabeza));

        return $c !== '' && $c[0] === '<' && strpos((string) $cabeza, "\x00") === false;
    }

    // El binario OLE se lee con la PhpSpreadsheet que ya trae app/src/vendor. Si no
    // esta, se pide guardarlo como .xlsx en vez de romper.
    private static function xls($ruta) {
        $cabeza = (string) @file_get_contents($ruta, false, null, 0, 512);

        if (strpos($cabeza, self::FIRMAS['xlsx']) === 0) return self::xlsx($ruta);

        if (strpos($cabeza, self::FIRMA_OLE) !== 0) return self::xlsTexto($ruta);

        $sinLibreria = self::salida('', 'Este servidor no puede abrir Excel .xls antiguos. Guárdalo como .xlsx y vuelve a subirlo.');
        $cargador    = dirname(__DIR__, 2) . '/app/src/vendor/autoload.php';

        if (!is_readable($cargador)) return $sinLibreria;

        require_once($cargador);

        if (!class_exists('PhpOffice\PhpSpreadsheet\Reader\Xls')) return $sinLibreria;

        $nivel = error_reporting(error_reporting() & ~E_DEPRECATED & ~E_USER_DEPRECATED);

        try {
            $lector = new \PhpOffice\PhpSpreadsheet\Reader\Xls();

            $lector->setReadDataOnly(true);

            $libro = $lector->load($ruta);
            $out   = '';
            $corte = false;
            $hojas = 0;

            foreach ($libro->getWorksheetIterator() as $hoja) {
                $hojas++;

                $filas = '';
                $n     = 0;

                foreach ($hoja->getRowIterator() as $fila) {
                    if ($n >= self::MAX_FILAS) { $corte = true; break; }

                    $celdas = [];
                    $it     = $fila->getCellIterator();

                    $it->setIterateOnlyExistingCells(false);

                    foreach ($it as $celda) {
                        $v = $celda->isFormula() ? $celda->getOldCalculatedValue() : $celda->getValue();

                        $celdas[] = self::celdaXls($v);
                    }

                    while (!empty($celdas) && trim((string) end($celdas)) === '') array_pop($celdas);

                    if (empty($celdas)) continue;

                    $filas .= implode("\t", $celdas) . "\n";
                    $n++;
                }

                if ($filas !== '') $out .= "\n=== " . $hoja->getTitle() . " ===\n" . $filas;
            }

            $libro->disconnectWorksheets();

        } finally {
            error_reporting($nivel);
        }

        if ($corte) $out .= "\n[Se cortó en " . self::MAX_FILAS . " filas por hoja. Hay más abajo.]\n";

        if (trim($out) === '') return self::salida('', 'El Excel está vacío.');

        return self::salida(self::recortar(self::normalizar($out)), '', $hojas);
    }

    // Decimales sin cola de ceros ni notacion cientifica: "1200.5", no "1.2005E+3".
    private static function celdaXls($v) {
        if ($v === null) return '';

        if (is_object($v) && method_exists($v, 'getPlainText')) $v = $v->getPlainText();

        if (is_bool($v)) return $v ? 'VERDADERO' : 'FALSO';

        if (is_float($v)) {
            $s = rtrim(rtrim(sprintf('%.10F', $v), '0'), '.');

            return $s === '-0' ? '0' : $s;
        }

        return str_replace(["\t", "\r", "\n"], ' ', (string) $v);
    }

    // El .xls que por dentro es HTML o XML se aplana como tabla.
    private static function xlsTexto($ruta) {
        $crudo = (string) @file_get_contents($ruta, false, null, 0, self::MAX_TEXTO * 8);

        if (trim($crudo) === '') return self::salida('', 'El Excel está vacío.');

        $x = self::normalizar($crudo);
        $x = preg_replace('~<(style|script|head)\b.*?</\1>~is', '', $x);
        $x = preg_replace('~\s+~u', ' ', $x);
        $x = preg_replace('~<Worksheet\b[^>]*\bss:Name="([^"]*)"[^>]*>~i', "\n=== $1 ===\n", $x);
        $x = preg_replace('~</(tr|Row)\s*>~i', "\n", $x);
        $x = preg_replace('~</(td|th|Cell)\s*>~i', "\t", $x);
        $x = html_entity_decode(strip_tags($x), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $filas = [];
        $corte = false;

        foreach (explode("\n", $x) as $renglon) {
            $celdas = array_map(function ($c) {
                return trim((string) preg_replace('~[ \x{00A0}]+~u', ' ', $c));
            }, explode("\t", $renglon));

            while (!empty($celdas) && end($celdas) === '') array_pop($celdas);

            if (empty($celdas)) continue;

            if (count($filas) >= self::MAX_FILAS) { $corte = true; break; }

            $filas[] = implode("\t", $celdas);
        }

        if (empty($filas)) return self::salida('', 'El Excel está vacío.');

        $out = implode("\n", $filas) . "\n";

        if ($corte) $out .= "\n[Se cortó en " . self::MAX_FILAS . " filas. Hay más abajo.]\n";

        return self::salida(self::recortar($out), '', max(1, (int) preg_match_all('~<Worksheet\b~i', $crudo)));
    }

    // -- Comunes --

    private static function entidades($t) {
        return html_entity_decode((string) $t, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }

    // A UTF-8 limpio: un CSV de Excel en Windows viene en Windows-1252 y sus acentos
    // rompen json_encode si no se convierten.
    private static function normalizar($t) {
        $t = (string) $t;

        if (!mb_check_encoding($t, 'UTF-8')) $t = mb_convert_encoding($t, 'UTF-8', 'Windows-1252');

        $t = preg_replace('~^\xEF\xBB\xBF~', '', $t);
        $t = preg_replace('~[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]~', '', $t);
        $t = str_replace("\r\n", "\n", $t);
        $t = preg_replace('~\n{4,}~', "\n\n\n", $t);

        return trim($t);
    }

    private static function recortar($t) {
        $t = (string) $t;

        if (mb_strlen($t) <= self::MAX_TEXTO) return $t;

        return mb_substr($t, 0, self::MAX_TEXTO) . "\n\n[El archivo sigue, pero se cortó aquí: es más largo de lo que puedo leer de una vez.]";
    }
}
