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
        // La empresa se resuelve por la FK directa usr_users.subsidiaries_id, no por el
        // pivote: asi un usuario sin sucursales asignadas sigue apareciendo en el listado.
        $query = "
        SELECT
            usr_users.id,
            (
                SELECT GROUP_CONCAT(sub_pivote.name ORDER BY sub_pivote.name SEPARATOR ', ')
                FROM usr_user_subsidiaries
                INNER JOIN subsidiaries sub_pivote ON sub_pivote.id = usr_user_subsidiaries.subsidiaries_id
                WHERE usr_user_subsidiaries.usr_users_id = usr_users.id
            ) as sucursal,
            usr_users.fullname,
            usr_users.user,
            usr_users.active,
            usr_rols.rols
        FROM
            usr_users
        INNER JOIN subsidiaries ON usr_users.subsidiaries_id = subsidiaries.id
        INNER JOIN usr_rols ON usr_users.usr_rols_id = usr_rols.id
        INNER JOIN fayxzvov_admin.companies ON subsidiaries.companies_id = fayxzvov_admin.companies.id
        WHERE usr_users.active = ?
        AND usr_users.usr_rols_id NOT IN (5)
        AND fayxzvov_admin.companies.id = ?";

        if (!empty($filterSuc)) {
            $query .= "
        AND EXISTS (
            SELECT 1
            FROM usr_user_subsidiaries
            WHERE usr_user_subsidiaries.usr_users_id = usr_users.id
            AND usr_user_subsidiaries.subsidiaries_id = ?
        )";
            $array[] = $filterSuc;
        }

        return $this->_Read($query, $array);
    }

    function getUserByID($array){
        $query = "
        SELECT
            usr_users.user,
            usr_users.subsidiaries_id,
            usr_users.fullname,
            usr_users.usr_rols_id
        FROM
            usr_users
        INNER JOIN subsidiaries ON usr_users.subsidiaries_id = subsidiaries.id
        INNER JOIN usr_rols ON usr_users.usr_rols_id = usr_rols.id
        WHERE usr_users.id = ?";

        $user = $this->_Read($query, $array);

        // El modal edita varias sucursales: subsidiaries_id deja de ser la FK directa y
        // pasa a ser la lista del pivote, en ids separados por coma.
        if (!empty($user)) {
            $subsidiaries = $this->_Read("
                SELECT subsidiaries_id
                FROM usr_user_subsidiaries
                WHERE usr_users_id = ?", $array);

            $ids = array_column($subsidiaries, 'subsidiaries_id');
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
           $query	=
            "INSERT INTO
            usr_users
            (fullname, date_creation, usr_rols_id, user, subsidiaries_id, `key`)
            VALUE (?,?,?,?,?,MD5(?))";

           $result = $this->_CUD($query,$array);

           // _CUD cierra la conexion al terminar, asi que lastInsertId() siempre daria 0.
           // El id se relee por el correo, que el controlador ya valido como unico.
           if ($result && !empty($subsidiariesIds)) {
               $user = $this->_Read("
                   SELECT id
                   FROM usr_users
                   WHERE LOWER(user) = LOWER(?)", [$array[3]]);

               if (!empty($user)) {
                   $this->syncUserSubsidiaries($user[0]['id'], $subsidiariesIds);
               }
           }

           return $result;
    }

    function updateUser($array){
        // subsidiaries_id ya no se escribe aqui: lo gobierna el pivote via syncUserSubsidiaries.
        $query = "UPDATE usr_users SET usr_rols_id = ?, user = ?, fullname = ?";

        $data = [
            $array['usr_rols_id'],
            $array['user'],
            $array['fullname']
        ];

        // Si hay nueva contraseña, agregar al update
        if (!empty($array['key'])) {
            $query .= ", `key` = MD5(?)";
            $data[] = $array['key'];
        }

        $query .= " WHERE id = ?";
        $data[] = $array['id'];

        $result = $this->_CUD($query, $data);

        if ($result && !empty($array['subsidiaries_id'])) {
            $this->syncUserSubsidiaries($array['id'], explode(',', $array['subsidiaries_id']));
        }

        return $result;
    }

    function syncUserSubsidiaries($userId, $subsidiariesIds){
        $ids = array_values(array_filter(array_map('trim', $subsidiariesIds), 'strlen'));

        // Sin sucursales no se borra nada: _CRUD no expone transacciones y un DELETE
        // suelto dejaria al usuario sin ninguna asignada.
        if (empty($ids)) {
            return false;
        }

        $this->_CUD("DELETE FROM usr_user_subsidiaries WHERE usr_users_id = ?", [$userId]);

        $query = "INSERT INTO usr_user_subsidiaries (usr_users_id, subsidiaries_id) VALUES (?, ?)";

        foreach ($ids as $subsidiaryId) {
            $this->_CUD($query, [$userId, $subsidiaryId]);
        }

        // La sucursal de arranque de sesion tiene que seguir entre las asignadas: el login
        // hace INNER JOIN contra usr_users.subsidiaries_id y dejaria al usuario sin entrar.
        $login = $this->_Read("
            SELECT subsidiaries_id
            FROM usr_users
            WHERE id = ?", [$userId]);

        if (empty($login) || !in_array((string) $login[0]['subsidiaries_id'], $ids, true)) {
            $this->_CUD("UPDATE usr_users SET subsidiaries_id = ? WHERE id = ?", [$ids[0], $userId]);
        }

        return true;
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
