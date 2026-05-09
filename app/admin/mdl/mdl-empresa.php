<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class MCompany extends CRUD {
    protected $util;

    public function __construct() {
        $this->util = new Utileria;
    }

    function listUsers(){
        $query = "
        SELECT
           
            usr_users.id,
            subsidiaries.name as sucursal,

            usr_users.user,
            usr_users.enabled,
            usr_rols.rols

            FROM
            usr_users
            INNER JOIN subsidiaries ON usr_users.subsidiaries_id = subsidiaries.id
            INNER JOIN usr_rols ON usr_users.usr_rols_id = usr_rols.id
            WHERE usr_users.enabled = 1

            ";

        return $this->_Read($query, null);
    }

    function lsCustomers(){
        $query = "SELECT
            customers.id,
            customers.full_name as valor
        FROM
            fayxzvov_admin.customers
        WHERE customers.enabled = 1";
        return $this->_Read($query, null);
    }

    function listCompanies(){
        $query = "
        SELECT
            companies.id,
            companies.social_name,
            companies.customers_id,
            customers.full_name AS customer_name,
            companies.enabled
        FROM
            fayxzvov_admin.companies
        INNER JOIN fayxzvov_admin.customers ON companies.customers_id = customers.id
        WHERE companies.enabled = 1
        ";
        return $this->_Read($query, null);   
    }

    function createCompany($array){
        return $this->_Insert([
            'table'  => "fayxzvov_admin.companies",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateCompany($array){
        return $this->_Update([
            'table'  => "fayxzvov_admin.companies",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function removeCompany($array){
        return $this->_Update([
            'table'  => "fayxzvov_admin.companies",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function getCompanyByID($id){
        $query = "
        SELECT
            companies.id,
            companies.social_name,
            companies.customers_id,
            customers.full_name AS customer_name,
            companies.enabled
        FROM
            fayxzvov_admin.companies
        INNER JOIN fayxzvov_admin.customers ON companies.customers_id = customers.id
        WHERE companies.id = ?
        ";
        return $this->_Read($query, [$id]);   
    }
}
?>
