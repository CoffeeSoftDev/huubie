<?php
    require_once("../../conf/_Utileria.php");
    require_once("../../conf/_CRUD.php");
    class MAccess extends CRUD {
        protected $util;
        public function __construct() {
            $this->util = new Utileria();
        }

        function getUserByData($array){
            $query = "SELECT
                    	usr_users.id AS id,
                    	subsidiaries.id AS sucursal,
                        subsidiaries.name AS subsidiaries_name,
                    	usr_users.`user` AS user,
                    	usr_users.enabled AS active,
                    	usr_users.owner AS owner,
                    	usr_rols.rols AS rol,
                    	usr_rols.id AS rol_id,
                    	fayxzvov_admin.companies.social_name AS company,
                        usr_users.key,
                        fayxzvov_admin.companies.name_bd as DB,
                        photo,
                        fullname,
                        fayxzvov_admin.companies.ubication,
                        fayxzvov_admin.companies.id as company_id,
                        fayxzvov_admin.companies.logo
                    FROM
                    	usr_users
                    	INNER JOIN subsidiaries ON usr_users.subsidiaries_id = subsidiaries.id
                    	INNER JOIN usr_rols ON usr_users.usr_rols_id = usr_rols.id
                    	INNER JOIN fayxzvov_admin.companies ON subsidiaries.companies_id = fayxzvov_admin.companies.id
                    WHERE
                    	usr_users.enabled = 1
                        AND BINARY usr_users.user = ?

                        ";

            $success = $this->_Read($query, $array);

            return (isset($success) && count($success) > 0) ? $success[0] : null;
        }

        function getUserById($array){
            $query = "SELECT
                    	usr_users.id AS id,
                    	subsidiaries.id AS sucursal,
                    	usr_users.`user` AS user,
                    	usr_users.enabled AS active,
                    	usr_rols.rols AS rol,
                    	fayxzvov_admin.companies.social_name AS company,
                        usr_users.key,
                        photo,
                        fullname
                    FROM
                    	usr_users
                    	INNER JOIN subsidiaries ON usr_users.subsidiaries_id = subsidiaries.id
                    	INNER JOIN usr_rols ON usr_users.usr_rols_id = usr_rols.id
                    	INNER JOIN fayxzvov_admin.companies ON subsidiaries.companies_id = fayxzvov_admin.companies.id
                    WHERE
                    	usr_users.enabled = 1
                        AND usr_users.id = ?

                        ";
            $success = $this->_Read($query, $array);

            return (isset($success) && count($success) > 0) ? $success[0] : null;
        }

        function getRoutesByCompany($array){
            $query = "
                SELECT modules.id AS id, name, route, file_path, nickname, description, image
                FROM fayxzvov_admin.module_company
                INNER JOIN fayxzvov_admin.modules ON modules.id = module_id
                WHERE company_id = ?
            ";
            return $this->_Read($query, $array);
        }

        function getRoutes(){
            $query = "
                SELECT id, name, route, file_path, nickname, description, image
                FROM fayxzvov_admin.modules
            ";
            return $this->_Read($query, null);
        }

        function getBranchesByCompany($array){
            $query = "
                SELECT
                    id,
                    name,
                    ubication,
                    active,
                    logo
                FROM subsidiaries
                WHERE companies_id = ?
                    AND enabled = 1
                ORDER BY active DESC, name ASC
            ";
            return $this->_Read($query, $array);
        }

        function getBranchesByUser($array){
            $query = "
                SELECT
                    subsidiaries.id,
                    subsidiaries.name,
                    subsidiaries.ubication,
                    subsidiaries.active,
                    subsidiaries.logo
                FROM usr_user_subsidiaries
                INNER JOIN subsidiaries ON subsidiaries.id = usr_user_subsidiaries.subsidiaries_id
                WHERE usr_user_subsidiaries.usr_users_id = ?
                    AND subsidiaries.enabled = 1
                ORDER BY subsidiaries.active DESC, subsidiaries.name ASC
            ";
            return $this->_Read($query, $array);
        }

        function userHasAccessToBranch($array){
            $query = "
                SELECT 1
                FROM usr_user_subsidiaries
                WHERE usr_users_id = ?
                    AND subsidiaries_id = ?
                LIMIT 1
            ";
            $result = $this->_Read($query, $array);
            return !empty($result);
        }

        function getBranchById($array){
            $query = "
                SELECT
                    id,
                    name,
                    companies_id,
                    ubication,
                    active
                FROM subsidiaries
                WHERE id = ?
                    AND enabled = 1
            ";
            $success = $this->_Read($query, $array);

            return (isset($success) && count($success) > 0) ? $success[0] : null;
        }
    }
?>