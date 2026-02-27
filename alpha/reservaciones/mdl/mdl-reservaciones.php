<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class MPedidos extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_coffee.';
    }

    // Init.
    public function lsEstatus() {
        return $this->_Select([
            'table' => "{$this->bd}reservation_status",
            'values' => "id , name as valor",
            'where' => "active =1",
        ]);
    }

    function getSucursalByID($array){
        $query = "SELECT
            fayxzvov_alpha.subsidiaries.id AS idSucursal,
            fayxzvov_admin.companies.id AS idCompany,
            fayxzvov_admin.companies.social_name as name,
            fayxzvov_alpha.subsidiaries.`name` as sucursal
        FROM
            fayxzvov_alpha.subsidiaries
        INNER JOIN fayxzvov_admin.companies ON fayxzvov_alpha.subsidiaries.companies_id = fayxzvov_admin.companies.id
        where subsidiaries.id = ?";
        return $this->_Read($query, $array)[0];
    }

    // Reservations.
    function listReservations($array){

        $values = [
            'reservation.id AS id',
            'name_event',
            'name_client',
            "DATE_FORMAT(date_creation,'%Y-%m-%d') AS date_creation",
            'date_start',
            "DATE_FORMAT(date_start,'%H:%i hrs') as hours_start",
            'date_end',
            'total_pay',
            'notes',
            'status_process.status',
            'location',
            'advanced_pay',
            'phone',
            'discount',
            'email',
            'status_reservation_id as estado',
            'status_process_id AS idStatus',
        ];

        $innerjoin = [
            $this->bd.'status_process' => 'reservation.status_process_id = status_process.id',
        ];

        $where = ['subsidiaries_id = ? AND date_creation BETWEEN ? AND ? '];

        // FILTROS POR ESTADO

        if ( $array['status'] == '0') unset($array['status']);
        else $where[] = 'status_process_id = ? and category_id = 2';


        return $this->_Select([

            'table'     => "{$this->bd}reservation",
            'values'    => $values,
            'innerjoin' => $innerjoin,
            'where'     => $where,
            'order'     => ['ASC' => 'status_process.id','DESC' => 'reservation.date_creation'],
            'data'      => array_values($array),

        ]);

    }

    public function getReservationById($array) {
        return $this->_Select([
            'table' => "{$this->bd}reservation",
            'values' => "*",
            'where' => "id = ?",
            'data' => $array
        ])[0];
    }

    public function createReservation($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}reservation",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    public function updateReservation($array) {
        return $this->_Update([
            'table'  => "{$this->bd}reservation",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    // History. 
    function getReservationHistories($array){

        $query = "
         SELECT
            rh.id AS id,
            rh.title AS valor,
            rh.action AS message,
            DATE_FORMAT(rh.date_action, '%d/%m/%Y %r') AS date,
            rh. COMMENT,
            rh.type,
            user AS author
        FROM
            {$this->bd}reservation_histories rh
        LEFT JOIN fayxzvov_alpha.usr_users u ON rh.usr_users_id = u.id
        WHERE
            rh.reservation_id = ?
        ORDER BY
            rh.date_action ASC
        ";

        return $this->_Read($query, $array);
    }

    function addHistories($array){
        return $this->_Insert([
            'table'  => "{$this->bd}reservation_histories",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }




}
?>
