<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->alpha = 'fayxzvov_alpha.';
        $this->admin = 'fayxzvov_admin.';
    }
    
    function getBranchesByUser($array) {
        $query = "
            SELECT 
                subsidiaries.id,
                subsidiaries.name,
                subsidiaries.ubication,
                subsidiaries.active,
                social_name AS company,
                name_bd AS DB,
                fullname AS user,
                companies.logo AS logo
            FROM {$this->alpha}usr_user_subsidiaries
            INNER JOIN {$this->alpha}subsidiaries ON subsidiaries.id = usr_user_subsidiaries.subsidiaries_id
            INNER JOIN {$this->admin}companies ON companies.id = subsidiaries.companies_id
            INNER JOIN {$this->alpha}usr_users ON usr_users.id = usr_user_subsidiaries.usr_users_id
            WHERE usr_user_subsidiaries.usr_users_id = ?
            AND subsidiaries.active = 1
        ";
        return $this->_Read($query, $array);
    }

    function getShiftDataForBranch($db, $subsidiaryId) {
        $p = $db . '.';
        $query = "
            SELECT
                COALESCE(open_any.cnt,    0)    AS open_shifts,
                COALESCE(open_any.oldest, NULL) AS oldest_open_at,
                COALESCE(open_today.cnt,  0)    AS open_shifts_today,
                COALESCE(closed_today.cnt,0)    AS closed_shifts_today,
                COALESCE(daily.id,        0)    AS daily_closure_id
            FROM (SELECT 1) AS dual
            LEFT JOIN (
                SELECT COUNT(*) AS cnt, MIN(opened_at) AS oldest
                FROM {$p}cash_shift
                WHERE status = 'open' AND active = 1 AND subsidiary_id = ?
            ) open_any      ON 1 = 1
            LEFT JOIN (
                SELECT COUNT(*) AS cnt
                FROM {$p}cash_shift
                WHERE DATE(opened_at) = CURDATE() AND status = 'open' AND active = 1 AND subsidiary_id = ?
            ) open_today    ON 1 = 1
            LEFT JOIN (
                SELECT COUNT(*) AS cnt
                FROM {$p}cash_shift
                WHERE DATE(opened_at) = CURDATE() AND status = 'closed' AND active = 1 AND subsidiary_id = ?
            ) closed_today  ON 1 = 1
            LEFT JOIN (
                SELECT id
                FROM {$p}daily_closure
                WHERE closure_date = CURDATE() AND is_legacy = 0 AND active = 1 AND subsidiary_id = ?
                LIMIT 1
            ) daily         ON 1 = 1
        ";
        $result = $this->_Read($query, [$subsidiaryId, $subsidiaryId, $subsidiaryId, $subsidiaryId]);
        return $result[0] ?? [];
    }
}
