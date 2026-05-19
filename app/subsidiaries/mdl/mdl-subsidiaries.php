<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_reginas.';
    }

    function getBranchesByUser($array) {
        $query = $this->branchesSelect("
            INNER JOIN subsidiaries ON subsidiaries.id = usr_user_subsidiaries.subsidiaries_id
        ", "
            FROM usr_user_subsidiaries
        ", "
            WHERE usr_user_subsidiaries.usr_users_id = ?
              AND subsidiaries.enabled = 1
        ");
        return $this->_Read($query, $array);
    }

    function getBranchesByCompany($array) {
        $query = $this->branchesSelect("", "
            FROM subsidiaries
        ", "
            WHERE subsidiaries.companies_id = ?
              AND subsidiaries.enabled = 1
        ");
        return $this->_Read($query, $array);
    }

    private function branchesSelect($joinSubsidiaries, $fromClause, $whereClause) {
        return "
            SELECT
                subsidiaries.id,
                subsidiaries.name,
                subsidiaries.ubication,
                subsidiaries.active,
                subsidiaries.logo,
                COALESCE(open_any.cnt, 0)        AS open_shifts,
                COALESCE(open_any.oldest, NULL)  AS oldest_open_at,
                COALESCE(open_today.cnt, 0)      AS open_shifts_today,
                COALESCE(closed_today.cnt, 0)    AS closed_shifts_today,
                COALESCE(daily.id, 0)            AS daily_closure_id
            {$fromClause}
            {$joinSubsidiaries}
            LEFT JOIN (
                SELECT subsidiary_id, COUNT(*) AS cnt, MIN(opened_at) AS oldest
                FROM {$this->bd}cash_shift
                WHERE status = 'open' AND active = 1 AND subsidiary_id IS NOT NULL
                GROUP BY subsidiary_id
            ) open_any ON open_any.subsidiary_id = subsidiaries.id
            LEFT JOIN (
                SELECT subsidiary_id, COUNT(*) AS cnt
                FROM {$this->bd}cash_shift
                WHERE DATE(opened_at) = CURDATE() AND status = 'open' AND active = 1
                GROUP BY subsidiary_id
            ) open_today ON open_today.subsidiary_id = subsidiaries.id
            LEFT JOIN (
                SELECT subsidiary_id, COUNT(*) AS cnt
                FROM {$this->bd}cash_shift
                WHERE DATE(opened_at) = CURDATE() AND status = 'closed' AND active = 1
                GROUP BY subsidiary_id
            ) closed_today ON closed_today.subsidiary_id = subsidiaries.id
            LEFT JOIN (
                SELECT subsidiary_id, id
                FROM {$this->bd}daily_closure
                WHERE closure_date = CURDATE() AND is_legacy = 0 AND active = 1
            ) daily ON daily.subsidiary_id = subsidiaries.id
            {$whereClause}
            ORDER BY subsidiaries.active DESC, subsidiaries.name ASC
        ";
    }
}
