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

        function getSubsidiariesByCompany($array){
            $query = "SELECT
                id,
                name as valor
            FROM
                fayxzvov_alpha.subsidiaries
            WHERE
                companies_id = ?
            ORDER BY name";
            return $this->_Read($query, $array);
        }

        function getSubsidiaryForCompany($array){
            $query = "SELECT
                id,
                name as valor
            FROM
                fayxzvov_alpha.subsidiaries
            WHERE
                id = ?
                AND companies_id = ?
            LIMIT 1";
            $success = $this->_Read($query, $array);

            return (isset($success) && count($success) > 0) ? $success[0] : null;
        }

        // Sucursales de la empresa para la navbar, con ubicacion y estado activo
        // (las columnas que necesita la tarjeta del selector de sucursal).
        function getBranchesForNavbar($array){
            $query = "SELECT
                id,
                name,
                ubication,
                active
            FROM
                fayxzvov_alpha.subsidiaries
            WHERE
                companies_id = ?
                AND enabled = 1
            ORDER BY active DESC, name ASC";
            return $this->_Read($query, $array);
        }

        // Turnos de caja abiertos por sucursal (el mas reciente de cada una), para
        // el indicador de "turno activo" en la navbar. cash_shift vive en la BD
        // operativa de alpha (fayxzvov_reginas), no en fayxzvov_alpha.
        function getOpenShifts(){
            $query = "SELECT
                subsidiary_id,
                MAX(opened_at) AS last_opened
            FROM
                fayxzvov_reginas.cash_shift
            WHERE
                status = 'open'
                AND active = 1
                AND subsidiary_id IS NOT NULL
            GROUP BY subsidiary_id";
            $result = $this->_Read($query, null);
            return is_array($result) ? $result : [];
        }
    }
?>