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
                    	usr_users.`user` AS user,
                    	usr_users.enabled AS active,
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

            return isset($success) ? $success[0] : null;
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

            return isset($success) ? $success[0] : null;
        }
    }
?>