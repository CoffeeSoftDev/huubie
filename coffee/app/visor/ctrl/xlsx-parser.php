<?php
/**
 * Parser ligero de .xlsx -> CSV sin dependencias externas.
 * Usa ZipArchive + XMLReader nativos de PHP. Lee la primera hoja.
 */

class XlsxParser {

    /**
     * Convierte el contenido binario de un .xlsx en CSV (UTF-8).
     */
    public static function toCsv($binaryContent, $maxRows = 5000) {
        if (!class_exists('ZipArchive')) {
            throw new Exception('ZipArchive no esta disponible en este PHP');
        }
        $tmp = tempnam(sys_get_temp_dir(), 'huubie-xlsx-');
        if ($tmp === false) throw new Exception('No se pudo crear archivo temporal');

        try {
            file_put_contents($tmp, $binaryContent);

            $zip = new ZipArchive();
            if ($zip->open($tmp) !== true) {
                throw new Exception('El archivo no es un .xlsx valido (no es ZIP)');
            }

            $sharedStrings = self::readSharedStrings($zip);
            $sheetXml      = self::resolveFirstSheet($zip);
            if ($sheetXml === null) {
                $zip->close();
                throw new Exception('No se encontro la primera hoja dentro del .xlsx');
            }

            $rows = self::readSheet($sheetXml, $sharedStrings, $maxRows);
            $zip->close();

            return self::rowsToCsv($rows);
        } finally {
            @unlink($tmp);
        }
    }

    private static function readSharedStrings(ZipArchive $zip) {
        $idx = $zip->locateName('xl/sharedStrings.xml');
        if ($idx === false) return [];
        $raw = $zip->getFromIndex($idx);
        if (!$raw) return [];

        $strings = [];
        $reader = new XMLReader();
        if (!$reader->XML($raw, 'UTF-8', LIBXML_NOERROR | LIBXML_NOWARNING)) return [];

        while ($reader->read()) {
            if ($reader->nodeType === XMLReader::ELEMENT && $reader->name === 'si') {
                $node = $reader->readOuterXML();
                $strings[] = self::extractSiText($node);
            }
        }
        $reader->close();
        return $strings;
    }

    private static function extractSiText($siXml) {
        // <si> puede contener <t> directo o varios <r><t>...</t></r> (texto enriquecido).
        $sx = @simplexml_load_string($siXml);
        if ($sx === false) return '';
        $out = '';
        if (isset($sx->t)) $out .= (string) $sx->t;
        if (isset($sx->r)) {
            foreach ($sx->r as $r) $out .= (string) $r->t;
        }
        return $out;
    }

    private static function resolveFirstSheet(ZipArchive $zip) {
        // El workbook.xml lista las hojas y sus r:id. El target real esta en _rels/workbook.xml.rels.
        // Pero para simplificar: la primera hoja casi siempre es xl/worksheets/sheet1.xml.
        $candidates = ['xl/worksheets/sheet1.xml', 'xl/worksheets/Sheet1.xml'];
        foreach ($candidates as $c) {
            $idx = $zip->locateName($c);
            if ($idx !== false) return $zip->getFromIndex($idx);
        }
        // Fallback: buscar cualquier xl/worksheets/sheet*.xml
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (stripos($name, 'xl/worksheets/sheet') === 0) {
                return $zip->getFromIndex($i);
            }
        }
        return null;
    }

    private static function readSheet($sheetXml, $sharedStrings, $maxRows) {
        $rows = [];
        $reader = new XMLReader();
        if (!$reader->XML($sheetXml, 'UTF-8', LIBXML_NOERROR | LIBXML_NOWARNING)) return $rows;

        $rowCount = 0;
        while ($reader->read()) {
            if ($reader->nodeType === XMLReader::ELEMENT && $reader->name === 'row') {
                if ($rowCount >= $maxRows) break;
                $rowXml = $reader->readOuterXML();
                $row    = self::parseRow($rowXml, $sharedStrings);
                $rows[] = $row;
                $rowCount++;
            }
        }
        $reader->close();
        return self::padRows($rows);
    }

    private static function parseRow($rowXml, $sharedStrings) {
        $sx = @simplexml_load_string($rowXml);
        if ($sx === false) return [];
        $cells = [];
        foreach ($sx->c as $c) {
            $ref   = (string) $c['r'];        // ej. "A1"
            $type  = (string) $c['t'];        // s = sharedString, str = inline, b = bool
            $colIx = self::colLetterToIndex(self::colLetters($ref));
            $val   = '';
            if ($type === 's') {
                $idx = (int) $c->v;
                $val = $sharedStrings[$idx] ?? '';
            } elseif ($type === 'inlineStr' && isset($c->is)) {
                $val = (string) $c->is->t;
            } elseif (isset($c->v)) {
                $val = (string) $c->v;
            }
            $cells[$colIx] = $val;
        }
        return $cells;
    }

    private static function colLetters($ref) {
        $letters = '';
        for ($i = 0; $i < strlen($ref); $i++) {
            $ch = $ref[$i];
            if (ctype_alpha($ch)) $letters .= $ch; else break;
        }
        return $letters;
    }

    private static function colLetterToIndex($letters) {
        $n = 0;
        for ($i = 0; $i < strlen($letters); $i++) {
            $n = $n * 26 + (ord(strtoupper($letters[$i])) - ord('A') + 1);
        }
        return $n - 1; // 0-based
    }

    private static function padRows($rows) {
        $maxCol = 0;
        foreach ($rows as $r) {
            if ($r) $maxCol = max($maxCol, max(array_keys($r)));
        }
        $out = [];
        foreach ($rows as $r) {
            $padded = [];
            for ($i = 0; $i <= $maxCol; $i++) $padded[] = $r[$i] ?? '';
            $out[] = $padded;
        }
        return $out;
    }

    private static function rowsToCsv($rows) {
        $fh = fopen('php://temp', 'r+');
        foreach ($rows as $r) {
            fputcsv($fh, $r);
        }
        rewind($fh);
        $csv = stream_get_contents($fh);
        fclose($fh);
        return $csv;
    }
}
