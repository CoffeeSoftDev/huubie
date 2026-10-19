<?php
// Folio por sucursal (19/10/2026): cada sucursal lleva su propia serie con su clave,
// ENT-KAF-0001, S-KAF-0001, OC-GUA-0001. La clave es fayxzvov_erp.branches.folio_code
// (Accesos › Sucursales). Si una sucursal no la tiene, se arma del nombre y se guarda la
// primera vez que hace falta.
// Como la clave no se repite en la empresa, el folio tampoco: las búsquedas por
// folio + companies_id siguen sirviendo.
// Lo usan mdl-entradas, -salidas, -ordenes, -compras, -stock, -traspasos y -almacen.

trait FolioSucursal {

    private $clavesFolio = [];

    // Siguiente folio de la serie de la sucursal: el número más alto de esa serie + 1.
    function nextFolio($prefix, $tabla, $companies_id, $branch_id) {
        $serie = $prefix . $this->claveFolio($branch_id, $companies_id) . '-';

        $r = $this->_Read("
            SELECT MAX(CAST(SUBSTRING(folio, ?) AS UNSIGNED)) AS ultimo
            FROM {$this->bd}{$tabla}
            WHERE companies_id = ? AND folio LIKE ?
        ", [strlen($serie) + 1, $companies_id, $serie . '%']);

        return $serie . str_pad((int) ($r[0]['ultimo'] ?? 0) + 1, 4, '0', STR_PAD_LEFT);
    }

    // Clave de folio de la sucursal. Sin clave capturada, la arma del nombre y la guarda.
    function claveFolio($branch_id, $companies_id) {
        $branch_id = (int) $branch_id;
        if (isset($this->clavesFolio[$branch_id])) return $this->clavesFolio[$branch_id];

        $r = $this->_Read("
            SELECT name, folio_code
            FROM fayxzvov_erp.branches
            WHERE id = ? AND company_id = ?
            LIMIT 1
        ", [$branch_id, (int) $companies_id]);

        if (empty($r)) return $this->clavesFolio[$branch_id] = 'SUC' . $branch_id;

        $clave = strtoupper(trim((string) $r[0]['folio_code']));

        if ($clave === '') {
            $clave = $this->claveFolioNueva((string) $r[0]['name'], $branch_id, $companies_id);
            $this->_CUD("
                UPDATE fayxzvov_erp.branches
                SET folio_code = ?
                WHERE id = ? AND (folio_code IS NULL OR folio_code = '')
            ", [$clave, $branch_id]);
        }

        return $this->clavesFolio[$branch_id] = $clave;
    }

    // Tres letras de la última palabra del nombre («Reginas Kafeto» → KAF); si es muy
    // corta («Kafeto 2»), con la anterior. Si otra sucursal de la empresa ya la usa,
    // dos letras y un número (KA2, KA3…).
    private function claveFolioNueva($nombre, $branch_id, $companies_id) {
        $limpio   = strtr($nombre, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
                                    'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U', 'Ñ' => 'N']);
        $palabras = array_map(function ($p) { return preg_replace('/[^A-Za-z0-9]/', '', $p); }, preg_split('/\s+/', trim($limpio)));
        $ultima   = (string) array_pop($palabras);
        if (strlen($ultima) < 2 && $palabras) $ultima = array_pop($palabras) . $ultima;

        $base = strtoupper(substr($ultima, 0, 3));
        if (strlen($base) < 2) $base = 'SUC';

        $usadas = $this->_Read("
            SELECT UPPER(folio_code) AS clave
            FROM fayxzvov_erp.branches
            WHERE company_id = ? AND id <> ? AND folio_code IS NOT NULL
        ", [(int) $companies_id, $branch_id]);
        $usadas = is_array($usadas) ? array_column($usadas, 'clave') : [];

        $clave = $base;
        for ($n = 2; in_array($clave, $usadas, true); $n++) $clave = substr($base, 0, 2) . $n;

        return $clave;
    }
}
