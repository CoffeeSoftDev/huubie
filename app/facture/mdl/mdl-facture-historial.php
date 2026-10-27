<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

// Modelo del registro maestro de generacion (punto 29). Lee el mismo esquema del
// Facturador, pero solo la bitacora: aqui no se abre ni se cierra una corrida —eso
// vive en mdl-facture-tickets.php— y ninguna consulta de este archivo escribe.
//
// Las cifras se leen de la corrida y NO se recalculan sobre el dia de hoy: es
// justamente lo que el registro sirve para demostrar. Un dia se puede recargar, y
// entonces el archivo, los movimientos y las mudanzas ya no son los que esa
// ejecucion vio.
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

    // -- Registro de generacion --

    // Las corridas del periodo, de la mas reciente a la mas vieja. El filtro por
    // tipo es opcional y por eso el WHERE se arma aqui: una corrida sin tipo pedido
    // devuelve las tres clases, no ninguna.
    //
    // Los tickets se cuentan por subconsulta y no por JOIN: con un JOIN cada corrida
    // se repetiria una vez por papel y los conteos congelados de la fila se
    // multiplicarian con ella.
    function listGenerationRuns($array) {
        $where = 'r.active = 1';
        $data  = [];

        $where .= ' AND r.branch_id <=> ?';
        $data[] = $array['branch'];

        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND r.issue_date BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }

        if (!empty($array['kind'])) {
            $where .= ' AND r.kind = ?';
            $data[] = $array['kind'];
        }

        $query = "
            SELECT r.id, r.folio, r.kind, r.issue_date, r.source_file,
                   r.day_total, r.billed_16, r.billed_0,
                   r.count_16, r.count_0, r.no_paper,
                   r.movements_count, r.reassigned_count, r.zero_ticket_count,
                   r.user_name, r.created_at,
                   (SELECT COUNT(*) FROM {$this->bd}virtual_ticket v
                     WHERE v.generation_run_id = r.id AND v.active = 1) AS tickets
            FROM {$this->bd}generation_run r
            WHERE {$where}
            ORDER BY r.issue_date DESC, r.id DESC
        ";
        return $this->_Read($query, $data);
    }

    // La ficha completa de una corrida: los once datos del punto 29 mas el contexto
    // con el que se repartio el dia —la meta, la tolerancia y la semilla del papel—.
    //
    // El folio de corte se resuelve aqui y no en la pantalla: la corrida guarda el id
    // de la venta, pero lo que se audita es el folio que el POS imprimio.
    function getGenerationRunById($array) {
        $query = "
            SELECT r.id, r.folio, r.kind, r.issue_date, r.source_file,
                   r.goal_mode, r.goal_value, r.goal_amount,
                   r.day_total, r.billed_16, r.billed_0,
                   r.count_16, r.count_0, r.no_paper,
                   r.movements_count, r.reassigned_count, r.zero_ticket_count,
                   r.adjustment_tolerance, r.paper_seed,
                   r.user_name, r.user_id, r.created_at,
                   s.folio AS cut_folio,
                   (SELECT COUNT(*) FROM {$this->bd}virtual_ticket v
                     WHERE v.generation_run_id = r.id AND v.active = 1) AS tickets
            FROM {$this->bd}generation_run r
            LEFT JOIN {$this->bd}sale s ON s.id = r.cut_sale_id
            WHERE r.id = ?
              AND r.branch_id <=> ?
        ";
        return $this->_Read($query, $array);
    }

    // El resumen del periodo que encabeza la pantalla. Suma las columnas congeladas
    // de las corridas, no las ventas del dia: lo que se resume es lo que el modulo
    // ejecuto, y por eso una venta que nunca entro a una corrida no aparece aqui.
    function getGenerationRunCounts($array) {
        $where = 'r.active = 1';
        $data  = [];

        $where .= ' AND r.branch_id <=> ?';
        $data[] = $array['branch'];

        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND r.issue_date BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }

        if (!empty($array['kind'])) {
            $where .= ' AND r.kind = ?';
            $data[] = $array['kind'];
        }

        $query = "
            SELECT
                COUNT(*)                             AS corridas,
                IFNULL(SUM(r.movements_count), 0)    AS movimientos,
                IFNULL(SUM(r.day_total), 0)          AS total,
                IFNULL(SUM(r.billed_16), 0)          AS monto16,
                IFNULL(SUM(r.billed_0), 0)           AS monto0,
                IFNULL(SUM(r.reassigned_count), 0)   AS reasignados,
                IFNULL(SUM(r.zero_ticket_count), 0)  AS ceros
            FROM {$this->bd}generation_run r
            WHERE {$where}
        ";

        $result = $this->_Read($query, $data);

        return !empty($result) ? $result[0] : [
            'corridas'    => 0,
            'movimientos' => 0,
            'total'       => 0,
            'monto16'     => 0,
            'monto0'      => 0,
            'reasignados' => 0,
            'ceros'       => 0
        ];
    }
}
