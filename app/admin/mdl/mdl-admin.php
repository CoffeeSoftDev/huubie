<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class MUser extends CRUD {
    protected $util;
    public function __construct(){
        $this->util = new Utileria;
    }

    // Companies
    function lsCompany($array){
        $query = "
            SELECT
                com.id,
                com.social_name,
                com.address,
                com.rfc,
                com.logo,
                com.rute,
                com.ubication,
                com.phone
            FROM
            fayxzvov_admin.companies AS com
            LEFT JOIN subsidiaries AS sub ON companies_id = com.id
            LEFT JOIN usr_users AS us ON subsidiaries_id = sub.id
            WHERE us.id = ?";

        return $this->_Read($query, $array)[0];
    }

    function updateCompany($array){
        return $this->_Update([
            'table' => 'fayxzvov_admin.companies',
            'values' => $array['values'],
            'where' => $array['where'],
            'data' => $array['data']
        ]);
    }

    function getCompanyById($id){
        $query = "
            SELECT
                com.id,
                com.social_name,
                com.address,
                com.rfc,
                com.logo,
                com.rute,
                com.ubication,
                com.phone
            FROM
            fayxzvov_admin.companies AS com
            LEFT JOIN subsidiaries AS sub ON companies_id = com.id
            LEFT JOIN usr_users AS us ON subsidiaries_id = sub.id
            WHERE com.id = ?";

        return $this->_Read($query, [$id])[0];
    }



    // Sucursal
    function lsSucursal($d){
        $query = "SELECT
            subsidiaries.id,
            subsidiaries.name as valor,
            subsidiaries.companies_id
        FROM
            subsidiaries
        WHERE companies_id = ?
            ";

        return $this->_Read($query, $d);
    }

    function lsRol(){
        $query = "SELECT
            usr_rols.id as id ,
            usr_rols.rols as valor
            FROM
            usr_rols
            WHERE usr_rols.id NOT IN (5)
            ";

        return $this->_Read($query, null);
    }

    // Users
    function listUsers($array, $filterSuc = null){
        $rol = $_SESSION['ROLID'];
        $query = "
        SELECT
            usr_users.id,
            (
                SELECT GROUP_CONCAT(s.name SEPARATOR ', ')
                FROM usr_user_subsidiaries us2
                INNER JOIN subsidiaries s ON s.id = us2.subsidiaries_id
                WHERE us2.usr_users_id = usr_users.id
            ) as sucursal,
            usr_users.fullname,
            usr_users.user,
            usr_users.active,
            usr_rols.rols
        FROM
            usr_users
        INNER JOIN usr_rols ON usr_users.usr_rols_id = usr_rols.id
        INNER JOIN usr_user_subsidiaries uus ON uus.usr_users_id = usr_users.id
        INNER JOIN subsidiaries sub_check ON sub_check.id = uus.subsidiaries_id
        INNER JOIN fayxzvov_admin.companies ON sub_check.companies_id = fayxzvov_admin.companies.id
        WHERE usr_users.active = ?
        AND usr_users.usr_rols_id NOT IN (5)
        AND fayxzvov_admin.companies.id = ?";

        if ($filterSuc !== null) {
            $query .= " AND EXISTS (SELECT 1 FROM usr_user_subsidiaries f WHERE f.usr_users_id = usr_users.id AND f.subsidiaries_id = ?)";
            $array[] = $filterSuc;
        }

        $query .= " GROUP BY usr_users.id";

        return $this->_Read($query, $array);
    }

    function getUserByID($array){
        $query = "
        SELECT
            usr_users.user,
            usr_users.fullname,
            usr_users.usr_rols_id
        FROM usr_users
        INNER JOIN usr_rols ON usr_users.usr_rols_id = usr_rols.id
        WHERE usr_users.id = ?";

        $user = $this->_Read($query, $array);

        if ($user) {
            $subs = $this->_Read(
                "SELECT subsidiaries_id FROM usr_user_subsidiaries WHERE usr_users_id = ?",
                $array
            );
            $ids = array_map(function($s) { return $s['subsidiaries_id']; }, $subs);
            $user[0]['subsidiaries_id'] = implode(',', $ids);
        }

        return $user;
    }

    function existsUserByName($array){
        // Valida globalmente: mismo correo en cualquier sucursal o empresa
        $user = is_array($array) ? $array[0] : $array;
        $res = $this->_Select([
            'table' => 'usr_users',
            'values' => 'id',
            'where' => 'LOWER(user) = LOWER(?)',
            'data' => [$user]
        ]);
        return count($res) > 0;
    }

    function existsOtherUserByName($array){
        // Valida globalmente: mismo correo en cualquier sucursal o empresa (excluyendo al usuario actual)
        $user = is_array($array) ? $array[0] : $array;
        $id   = is_array($array) ? $array[1] : null;
        $res = $this->_Select([
            'table' => 'usr_users',
            'values' => 'id',
            'where' => 'LOWER(user) = LOWER(?) AND id != ?',
            'data' => [$user, $id]
        ]);
        return count($res) > 0;
    }

    function createUser($array, $subsidiariesIds = []){
           $query =
            "INSERT INTO
            usr_users
            (fullname, date_creation, usr_rols_id, user, subsidiaries_id, `key`)
            VALUE (?,?,?,?,?,MD5(?))";

           $result = $this->_CUD($query, $array);

           if ($result && !empty($subsidiariesIds)) {
               $this->connect();
               $userId = $this->mysql->lastInsertId();
               $this->syncUserSubsidiaries($userId, $subsidiariesIds);
           }

           return $result;
    }

    function updateUser($array){
        $query = "UPDATE usr_users SET usr_rols_id = ?, user = ?, fullname = ?";

        $data = [
            $array['usr_rols_id'],
            $array['user'],
            $array['fullname'],
        ];

        // Si hay nueva contraseña, agregar al update
        if (!empty($array['key'])) {
            $query .= ", `key` = MD5(?)";
            $data[] = $array['key'];
        }

        $query .= " WHERE id = ?";
        $data[] = $array['id'];

        $result = $this->_CUD($query, $data);

        // Sync sucursales en tabla pivote
        if (!empty($array['subsidiaries_id'])) {
            $ids = explode(',', $array['subsidiaries_id']);
            $this->syncUserSubsidiaries($array['id'], $ids);
        }

        return $result;
    }

    function syncUserSubsidiaries($userId, $subsidiariesIds) {
        $this->_CUD("DELETE FROM usr_user_subsidiaries WHERE usr_users_id = ?", [$userId]);
        $query = "INSERT INTO usr_user_subsidiaries (usr_users_id, subsidiaries_id) VALUES (?, ?)";
        foreach ($subsidiariesIds as $subId) {
            $subId = trim($subId);
            if ($subId !== '') {
                $this->_CUD($query, [$userId, $subId]);
            }
        }
    }

    function deleteUsr($array){
        return $this->_Update([
        'table' => "usr_users",
        'values' => $array['values'],
        'where' => $array['where'],
        'data' => $array['data']
        ]);
    }



    // Sucursales
    function listSucursales($array){
        $query = "
        SELECT
            fayxzvov_alpha.subsidiaries.id as id,
            fayxzvov_alpha.subsidiaries.name as name,
            fayxzvov_alpha.subsidiaries.ubication,
            fayxzvov_alpha.subsidiaries.logo as logo,
            fayxzvov_admin.companies.social_name,
            subsidiaries.active,
            DATE_FORMAT(date_creation, '%d-%m-%Y') AS date_creation
            FROM
            fayxzvov_alpha.subsidiaries
            INNER JOIN fayxzvov_admin.companies ON fayxzvov_alpha.subsidiaries.companies_id = fayxzvov_admin.companies.id
            WHERE subsidiaries.active = ?
            AND fayxzvov_admin.companies.id = ? 
        ";
        return $this->_Read($query, $array);
    }

    function getSucursalById($array){
        $query = "
        SELECT
            fayxzvov_alpha.subsidiaries.name as name,
            fayxzvov_alpha.subsidiaries.id as id,
            fayxzvov_alpha.subsidiaries.ubication,
            fayxzvov_admin.companies.social_name
            FROM
            fayxzvov_alpha.subsidiaries
            INNER JOIN fayxzvov_admin.companies ON fayxzvov_alpha.subsidiaries.companies_id = fayxzvov_admin.companies.id
            WHERE subsidiaries.id = ?
        ";
        return $this->_Read($query, $array);
    }

    function existsSucursalByName($array){
        $res = $this->_Select([
            'table' => 'subsidiaries',
            'values' => 'id',
            'where' => 'LOWER(name) = LOWER(?) AND (active = 1 OR enabled = 1) AND companies_id = ?',
            'data' => $array
        ]);
        return count($res) > 0; // TRUE si ya existe
    }

    function existsOtherSucursalByName($array){
        $res = $this->_Select([
            'table' => 'subsidiaries',
            'values' => 'id',
            'where' => 'LOWER(name) = LOWER(?) AND id != ? AND (active = 1 OR enabled = 1) AND companies_id = ?',
            'data' => $array
        ]);
        return count($res) > 0; // TRUE si ya existe
    }

    function createSucursal($array){
        return $this->_Insert([
            'table'  => "subsidiaries",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateSucursal($array){

        return $this->_Update([
            'table'  => "subsidiaries",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function deleteSuc($array){
        return $this->_Update([
            'table'  => "subsidiaries",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }



    // Clausulas
    function listClausulas($array){
        $query = "
            SELECT
                fayxzvov_alpha.evt_clausules.id AS id,
                fayxzvov_alpha.evt_clausules.name AS name,
                fayxzvov_admin.companies.social_name,
                fayxzvov_alpha.evt_clausules.active,
                DATE_FORMAT(date_creation, '%d-%m-%Y') AS date_creation
            FROM
                fayxzvov_alpha.evt_clausules
            INNER JOIN fayxzvov_admin.companies ON fayxzvov_alpha.evt_clausules.companies_id = fayxzvov_admin.companies.id
            WHERE
                evt_clausules.active = ?
            AND fayxzvov_admin.companies.id = ?
        ";
        return $this->_Read($query, $array);
    }
    
    function getClausulaById($array){
        $query = "
            SELECT
                fayxzvov_alpha.evt_clausules.name AS name,
                fayxzvov_alpha.evt_clausules.id AS id,
                fayxzvov_admin.companies.social_name
            FROM
                fayxzvov_alpha.evt_clausules
            INNER JOIN fayxzvov_admin.companies ON fayxzvov_alpha.evt_clausules.companies_id = fayxzvov_admin.companies.id
            WHERE
                evt_clausules.id = ?
        ";
        return $this->_Read($query, $array);
    }

    function existsClausulaByName($array){
        $res = $this->_Select([
            'table' => 'fayxzvov_alpha.evt_clausules',
            'values' => 'id',
            'where' => 'LOWER(name) = LOWER(?) AND active = 1 AND companies_id = ?',
            'data' => $array
        ]);
        return count($res) > 0; // TRUE si ya existe
    }

    function existsOtherClausulaByName($array){
        $res = $this->_Select([
            'table' => 'fayxzvov_alpha.evt_clausules',
            'values' => 'id',
            'where' => 'LOWER(name) = LOWER(?) AND id != ? AND active = 1 AND companies_id = ?',
            'data' => $array
        ]);
        return count($res) > 0; // TRUE si ya existe
    }

    function createClausula($array){
        return $this->_Insert([
            'table'  => "fayxzvov_alpha.evt_clausules",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateClausula($array){
        return $this->_Update([
            'table'  => "fayxzvov_alpha.evt_clausules",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function deleteClausula($array){
        return $this->_Update([
            'table'  => "fayxzvov_alpha.evt_clausules",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

}
?>
