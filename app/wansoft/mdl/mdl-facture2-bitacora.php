<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

// Modelo de la bitacora de auditoria (punto 35). Solo LEE: los renglones los escribe
// cada controlador, en el momento en que la accion pasa, con Auditoria
// (conf/_Auditoria.php), y ninguna consulta de este archivo inserta, edita ni borra.
// Por eso aqui no hay un createAuditLog: la escritura es una sola y vive donde los
// cinco controladores que escriben pueden alcanzarla.
//
// Todo se filtra por sucursal: la bitacora de una no es la de otra, aunque compartan
// la tabla.
class mdl extends CRUD {

    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_facturacion.';
    }

    // -- Sucursal --

    // El facturador tiene su propia tabla branch: el id de sucursal de la sesion de
    // Huubie es de otro esquema y no cruza con este.
    function getBranch() {
        $query = "
            SELECT id
            FROM {$this->bd}branch
            WHERE active = 1
            ORDER BY id ASC
            LIMIT 1
        ";
        return $this->_Read($query);
    }

    // -- Filtros --

    // Los usuarios que aparecen EN LA BITACORA, no los de la tabla user: la lista sale
    // de las copias del nombre que cada renglon guardo, y asi quien ya se dio de baja
    // sigue pudiendo filtrarse. `id` y `valor` son lo mismo porque el filtro compara
    // contra esa copia.
    function lsUsuarios($array) {
        $query = "
            SELECT DISTINCT a.user_name AS id, a.user_name AS valor
            FROM {$this->bd}audit_log a
            WHERE a.branch_id <=> ?
              AND a.user_name IS NOT NULL
            ORDER BY a.user_name ASC
        ";
        return $this->_Read($query, $array);
    }

    // -- Bitacora --

    // Los movimientos del periodo, del mas reciente al mas viejo. El dia final entra
    // completo —hasta antes de la medianoche del siguiente— porque `created_at` lleva
    // hora y un `<= '2026-10-03'` dejaria fuera todo lo que paso despues de las 00:00.
    //
    // Usuario y accion son opcionales y por eso el WHERE se arma aqui: un filtro vacio
    // es "todos", no "ninguno". El tope va como entero ya convertido porque LIMIT no
    // admite marcador: llega de una constante del controlador, nunca del usuario.
    function listAuditLog($array) {
        $where = 'a.branch_id <=> ? AND a.created_at >= ? AND a.created_at < DATE_ADD(?, INTERVAL 1 DAY)';
        $data  = [$array['branch'], $array['fi'], $array['ff']];

        if (!empty($array['user'])) {
            $where .= ' AND a.user_name = ?';
            $data[] = $array['user'];
        }

        if (!empty($array['action'])) {
            $where .= ' AND a.action = ?';
            $data[] = $array['action'];
        }

        $limite = (int) $array['limit'];

        $query = "
            SELECT a.id, a.created_at, a.action, a.label, a.user_name
            FROM {$this->bd}audit_log a
            WHERE {$where}
            ORDER BY a.created_at DESC, a.id DESC
            LIMIT {$limite}
        ";
        return $this->_Read($query, $data);
    }

    // El renglon completo, con su detalle en JSON. Se pide aparte porque la lista solo
    // necesita cuatro columnas y el detalle de un renglon puede traer decenas de
    // movimientos: se lee cuando alguien pregunta por UNO.
    function getAuditLogById($array) {
        $query = "
            SELECT a.id, a.created_at, a.action, a.entity, a.entity_id,
                   a.label, a.detail, a.user_name
            FROM {$this->bd}audit_log a
            WHERE a.id = ?
              AND a.branch_id <=> ?
        ";
        return $this->_Read($query, $array);
    }
}
