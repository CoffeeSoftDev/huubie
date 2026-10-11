<?php
/*  IaLector :: sacarle el texto a lo que se sube a un chat de IA.

    El modelo no abre archivos: lee texto. Este helper recibe una ruta en disco y
    devuelve un string. No habla con el modelo, no toca la base y no sabe quien
    pregunta, asi que se puede probar sin sesion.

    Port recortado de pro/core/Helpers/_IaLector.php (erp-pro): aqui solo hace
    falta lo que trae una lista de productos o precios -- Excel (.xlsx, .xlsm,
    .xlsb y .xls), LibreOffice (.ods), CSV/TSV y texto --. Las fotos NO se leen
    aqui: las transcribe un modelo con vision (ver IaOllama::transcribirImagen).

    Nunca lanza: un archivo corrupto termina en 'aviso', no en una pantalla en blanco.
*/
class IaLector {

    // Lista BLANCA: lo que no este aqui no entra.
    const TIPOS = [
        'xlsx' => 'doc',
        'xlsm' => 'doc',
        'xlsb' => 'doc',
        'xls'  => 'doc',
        'ods'  => 'doc',
        'csv'  => 'doc',
        'tsv'  => 'doc',
        'txt'  => 'doc',
        'png'  => 'imagen',
        'jpg'  => 'imagen',
        'jpeg' => 'imagen',
        'webp' => 'imagen'
    ];

    // Se mira la firma de los bytes, no la extension: la extension la escribe quien sube.
    const FIRMAS = [
        'xlsx' => "PK\x03\x04",
        'xlsm' => "PK\x03\x04",
        'xlsb' => "PK\x03\x04",
        'ods'  => "PK\x03\x04",
        'png'  => "\x89PNG",
        'jpg'  => "\xFF\xD8\xFF",
        'jpeg' => "\xFF\xD8\xFF"
    ];

    const FIRMA_OLE = "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1";

    // Tope de texto y de filas por hoja: una lista de precios cabe de sobra; un
    // catalogo de veinte mil filas no cabe en la pregunta y se corta avisando.
    const MAX_TEXTO = 30000;
    const MAX_FILAS = 400;

    // Una celda suelta en la columna XFD no debe volver la fila mil tabuladores.
    const MAX_COLUMNAS = 256;

    const ERRORES_XLSB = [0x00 => '#NULL!', 0x07 => '#DIV/0!', 0x0F => '#VALUE!', 0x17 => '#REF!', 0x1D => '#NAME?', 0x24 => '#NUM!', 0x2A => '#N/A'];

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
                case 'xlsx':
                case 'xlsm':
                case 'xlsb':
                case 'ods':  return self::libro($ruta);
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

    // -- Libros en ZIP (.xlsx, .xlsm, .xlsb, .ods) --
    // Manda lo que trae dentro, no la extension: un .xlsb renombrado a .xlsx se
    // lee igual que si conservara su nombre.

    private static function libro($ruta) {
        if (!class_exists('ZipArchive')) return self::salida('', 'Este servidor no puede abrir hojas de cálculo.');

        $zip = new ZipArchive;

        if ($zip->open($ruta) !== true) {
            return self::salida('', 'No pude abrir el Excel. Si es un .xls antiguo, guárdalo como .xlsx y vuelve a subirlo.');
        }

        try {
            if ($zip->locateName('xl/workbook.bin') !== false) return self::xlsb($zip);
            if ($zip->locateName('content.xml') !== false)     return self::ods($zip);

            return self::xlsx($zip);
        } finally {
            $zip->close();
        }
    }

    // -- Excel .xlsx / .xlsm --
    // Los textos viven UNA vez en xl/sharedStrings.xml y cada celda guarda el
    // numero de casilla: hay que cruzar los dos o donde dice "Coca Cola" sale un 47.

    private static function xlsx($zip) {
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

    // -- Excel .xlsb --
    // Binario BIFF12 dentro del ZIP. PhpSpreadsheet no lo abre, asi que se recorren
    // los registros a mano: solo interesan nombres de hoja, textos compartidos y celdas.

    private static function xlsb($zip) {
        // El nombre de cada hoja apunta a su archivo por un rId de workbook.bin.rels.
        $destinos = [];
        $rels     = (string) $zip->getFromName('xl/_rels/workbook.bin.rels');

        if (preg_match_all('~<Relationship\b[^>]*>~', $rels, $m)) {
            foreach ($m[0] as $rel) {
                if (preg_match('~\bId="([^"]*)"~', $rel, $id) && preg_match('~\bTarget="([^"]*)"~', $rel, $to)) {
                    $destinos[$id[1]] = strpos($to[1], '/') === 0 ? ltrim($to[1], '/') : 'xl/' . $to[1];
                }
            }
        }

        $hojas = [];

        foreach (self::registros((string) $zip->getFromName('xl/workbook.bin')) as $tipo => $r) {
            if ($tipo !== 0x9C) continue;   // BrtBundleSh: estado, id, rId y nombre

            $p      = 8;
            $rel    = self::textoXlsb($r, $p);
            $nombre = self::textoXlsb($r, $p);

            if (isset($destinos[$rel])) $hojas[$destinos[$rel]] = $nombre;
        }

        if (empty($hojas)) {
            for ($i = 0; $i < $zip->numFiles; $i++) {
                if (preg_match('~^xl/worksheets/sheet(\d+)\.bin$~', (string) $zip->getNameIndex($i), $mm)) {
                    $hojas[$mm[0]] = 'Hoja ' . $mm[1];
                }
            }

            ksort($hojas, SORT_NATURAL);
        }

        if (empty($hojas)) return self::salida('', 'El Excel no tiene hojas legibles.');

        // Primero las celdas y despues los textos compartidos, y de esos solo los que
        // se usan: un catalogo grande trae decenas de miles y se muestran 400 filas.
        $leidas = [];
        $usados = [];
        $corte  = false;

        foreach ($hojas as $ruta => $titulo) {
            $leidas[] = [$titulo, self::filasXlsb((string) $zip->getFromName($ruta), $usados, $corte)];
        }

        $tabla = self::textosXlsb((string) $zip->getFromName('xl/sharedStrings.bin'), $usados);
        $out   = '';

        foreach ($leidas as $hoja) {
            $filas = '';

            foreach ($hoja[1] as $celdas) {
                foreach ($celdas as $col => $v) {
                    if (is_int($v)) $celdas[$col] = isset($tabla[$v]) ? $tabla[$v] : '';
                }

                $celdas = array_filter($celdas, 'strlen');

                if (empty($celdas)) continue;

                $filas .= implode("\t", array_replace(array_fill(0, max(array_keys($celdas)) + 1, ''), $celdas)) . "\n";
            }

            if ($filas !== '') $out .= "\n=== " . $hoja[0] . " ===\n" . $filas;
        }

        if ($corte) $out .= "\n[Se cortó en " . self::MAX_FILAS . " filas por hoja. Hay más abajo.]\n";

        if (trim($out) === '') return self::salida('', 'El Excel está vacío.');

        return self::salida(self::recortar($out), '', count($hojas));
    }

    // Filas como [columna => valor]. A diferencia del .xlsx se respeta la columna:
    // un hueco en B no recorre el precio de C a la columna del nombre. Las celdas
    // de texto compartido quedan como su indice (int) y se anotan en $usados.
    private static function filasXlsb($bin, &$usados, &$corte) {
        $filas  = [];
        $celdas = [];
        $col    = -1;

        foreach (self::registros($bin) as $tipo => $r) {
            if ($tipo === 0x00 || $tipo === 0x92) {   // BrtRowHdr / BrtEndSheetData
                if (!empty($celdas)) $filas[] = $celdas;

                $celdas = [];
                $col    = -1;

                if ($tipo === 0x92 || count($filas) > self::MAX_FILAS) break;

                continue;
            }

            if ($tipo < 0x01 || $tipo > 0x12) continue;

            // 12-18 son las celdas "cortas": sin columna, van en la siguiente a la anterior.
            $corto = $tipo >= 0x0C;
            $base  = $corto ? $tipo - 11 : $tipo;
            $col   = $corto ? $col + 1 : self::u32($r, 0);

            if ($col >= self::MAX_COLUMNAS) continue;

            $v = $base === 0x07 ? self::u32($r, $corto ? 4 : 8) : self::valorXlsb($base, $r, $corto ? 4 : 8);

            if (is_int($v)) $usados[$v] = true;

            if ($v !== '') $celdas[$col] = $v;
        }

        if (!empty($celdas)) $filas[] = $celdas;

        if (count($filas) > self::MAX_FILAS) {
            $corte = true;
            $filas = array_slice($filas, 0, self::MAX_FILAS);
        }

        return $filas;
    }

    // BrtSSTItem (1 byte de banderas y el texto). Se recorre solo hasta el ultimo
    // indice usado y se decodifican unicamente esos; el resto se salta.
    private static function textosXlsb($bin, $usados) {
        $tabla = [];

        if (empty($usados)) return $tabla;

        $ultimo = max(array_keys($usados));
        $i      = 0;

        foreach (self::registros($bin) as $tipo => $r) {
            if ($tipo !== 0x13) continue;

            if (isset($usados[$i])) {
                $p         = 1;
                $tabla[$i] = self::celdaXls(self::textoXlsb($r, $p));
            }

            if (++$i > $ultimo) break;
        }

        return $tabla;
    }

    // Las formulas (8-11) guardan su ultimo resultado igual que una celda normal.
    // El texto compartido (7) lo resuelve filasXlsb.
    private static function valorXlsb($tipo, $r, $p) {
        switch ($tipo) {
            case 0x02:
                return self::celdaXls(self::rk(self::u32($r, $p)));
            case 0x03:
            case 0x0B:
                $e = ord((string) substr($r, $p, 1));

                return isset(self::ERRORES_XLSB[$e]) ? self::ERRORES_XLSB[$e] : '#ERROR';
            case 0x04:
            case 0x0A:
                return self::celdaXls(ord((string) substr($r, $p, 1)) !== 0);
            case 0x05:
            case 0x09:
                return strlen($r) >= $p + 8 ? self::celdaXls(unpack('e', substr($r, $p, 8))[1]) : '';
            case 0x06:
            case 0x08:
                return self::celdaXls(self::textoXlsb($r, $p));
            default:
                return '';
        }
    }

    // Cada registro abre con su tipo (1-2 bytes) y su tamano (1-4 bytes), en grupos
    // de 7 bits donde el bit alto avisa que sigue otro byte. Va en linea y no en un
    // helper: se ejecuta por cada celda y con Xdebug cada llamada cuesta.
    private static function registros($bin) {
        $len = strlen($bin);
        $p   = 0;

        while ($p < $len) {
            $b    = ord($bin[$p++]);
            $tipo = $b & 0x7F;

            if ($b > 0x7F && $p < $len) $tipo |= (ord($bin[$p++]) & 0x7F) << 7;

            $tam = 0;

            for ($i = 0; $i < 28 && $p < $len; $i += 7) {
                $b    = ord($bin[$p++]);
                $tam |= ($b & 0x7F) << $i;

                if ($b < 0x80) break;
            }

            yield $tipo => (string) substr($bin, $p, $tam);

            $p += $tam;
        }
    }

    private static function u32($buf, $p) {
        return strlen($buf) >= $p + 4 ? unpack('V', substr($buf, $p, 4))[1] : 0;
    }

    // XLWideString: largo en caracteres (4 bytes) y luego UTF-16LE. 0xFFFFFFFF = nulo.
    private static function textoXlsb($buf, &$p) {
        $n  = self::u32($buf, $p);
        $p += 4;

        if ($n === 0 || $n === 0xFFFFFFFF) return '';

        $s  = (string) substr($buf, $p, $n * 2);
        $p += $n * 2;

        return mb_convert_encoding($s, 'UTF-8', 'UTF-16LE');
    }

    // RkNumber: entero de 30 bits o double con solo sus 32 bits altos; el bit 0
    // pide dividir entre 100 (asi guarda Excel precios como 12.50).
    private static function rk($v) {
        $n = ($v & 0x02)
           ? ((($v & 0x80000000) ? $v - 0x100000000 : $v) >> 2)
           : unpack('e', pack('VV', 0, $v & 0xFFFFFFFC))[1];

        return ($v & 0x01) ? $n / 100 : $n;
    }

    // -- LibreOffice .ods --
    // Todo vive en content.xml. Celdas y filas iguales se comprimen con
    // number-columns/rows-repeated: se desdoblan con tope, porque la ultima fila
    // suele decir "repite esta vacia un millon de veces".

    private static function ods($zip) {
        $xml = (string) $zip->getFromName('content.xml');

        preg_match_all('~<table:table(?=[\s>])([^>]*)>(.*?)</table:table>~s', $xml, $tablas, PREG_SET_ORDER);

        if (empty($tablas)) return self::salida('', 'La hoja de cálculo no tiene hojas legibles.');

        $out   = '';
        $corte = false;

        foreach ($tablas as $i => $t) {
            $titulo = preg_match('~table:name="([^"]*)"~', $t[1], $m) ? self::entidades($m[1]) : 'Hoja ' . ($i + 1);
            $filas  = self::filasOds($t[2], $corte);

            if ($filas !== '') $out .= "\n=== " . $titulo . " ===\n" . $filas;
        }

        if ($corte) $out .= "\n[Se cortó en " . self::MAX_FILAS . " filas por hoja. Hay más abajo.]\n";

        if (trim($out) === '') return self::salida('', 'La hoja de cálculo está vacía.');

        return self::salida(self::recortar($out), '', count($tablas));
    }

    private static function filasOds($xml, &$corte) {
        preg_match_all('~<table:table-row(?=[\s/>])([^>]*?)(?:/>|>(.*?)</table:table-row>)~s', $xml, $rows, PREG_SET_ORDER);

        $out = '';
        $n   = 0;

        foreach ($rows as $row) {
            preg_match_all('~<table:(?:covered-)?table-cell(?=[\s/>])([^>]*?)(?:/>|>(.*?)</table:(?:covered-)?table-cell>)~s', isset($row[2]) ? $row[2] : '', $cs, PREG_SET_ORDER);

            $celdas = [];
            $huecos = 0;

            foreach ($cs as $c) {
                $valor = self::celdaOds($c[1], isset($c[2]) ? $c[2] : '');
                $veces = preg_match('~table:number-columns-repeated="(\d+)"~', $c[1], $m) ? (int) $m[1] : 1;

                // Las vacias solo se escriben si despues de ellas viene algo.
                if ($valor === '') { $huecos += $veces; continue; }

                if (count($celdas) + $huecos >= self::MAX_COLUMNAS) break;

                $celdas = array_merge($celdas, array_fill(0, $huecos, ''));
                $veces  = min($veces, self::MAX_COLUMNAS - count($celdas));
                $huecos = 0;

                for ($k = 0; $k < $veces; $k++) $celdas[] = $valor;
            }

            if (empty($celdas)) continue;

            $veces = preg_match('~table:number-rows-repeated="(\d+)"~', $row[1], $m) ? (int) $m[1] : 1;

            for ($k = 0; $k < $veces; $k++) {
                if ($n >= self::MAX_FILAS) { $corte = true; return $out; }

                $out .= implode("\t", $celdas) . "\n";
                $n++;
            }
        }

        return $out;
    }

    // Numeros, monedas y porcentajes traen el valor crudo en office:value ("12.5");
    // lo demas se toma del texto que se ve en la celda.
    private static function celdaOds($attr, $body) {
        if (preg_match('~office:value="([^"]*)"~', $attr, $m)) return self::entidades($m[1]);

        $body = preg_replace('~<office:annotation\b.*?</office:annotation>~s', '', $body);
        $body = preg_replace('~<text:(?:s|tab|line-break)\b[^>]*/>|</text:p>~', ' ', (string) $body);

        return trim((string) preg_replace('~\s+~u', ' ', self::entidades(strip_tags((string) $body))));
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

        if (strpos($cabeza, self::FIRMAS['xlsx']) === 0) return self::libro($ruta);

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
