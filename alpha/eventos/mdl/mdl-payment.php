<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');
session_start();

class MPayment extends CRUD {
    protected $util;
    
    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = "{$_SESSION['DB']}.";
    }

    function lsEvents(){
        $values = [
            "idEvent AS id",
            "date_creation",
            "advance_pay",
            "total_pay",
            "date_start",
            "`location`",
            "quantity_people",
            "idStatus",
            "name_status",
            "type_event",
        ];

        $innerjoin = [
            "{$this->bd}status" => "id_status_event = idStatus",
            "{$this->bd}event_type"     => "id_type_event = idType",
        ];

        return $this->_Select([
            'table'     => "{$this->bd}events",
            'values'    => $values,
            'innerjoin' => $innerjoin,
        ]);
    }

    // Sub evento
    function listSubEvents($array) {

        $query = "
            SELECT
                sub.id,
                sub.name_subevent as title,
                sub.name_subevent,
                sub.date_start as date,
                sub.date_start,
                sub.date_end,
                sub.time_start,
                sub.time_end,
                sub.total_pay,
                sub.location,
                sub.notes,
                sub.type_event,
                sub.quantity_people,
                sub.status_process_id,
                sub.type_event as type,
                evt.name_event as event
            FROM {$this->bd}evt_subevents sub
            INNER JOIN {$this->bd}evt_events evt ON sub.evt_events_id = evt.id
            WHERE sub.evt_events_id = ? ";
            
        return $this->_Read($query, $array);
    }

    // Package & Products Event
    function getPackagesByEventId($array) {
        $query = "
        SELECT
            evt_package.id as idPackage,
            evt_package.id,
            evt_package.`name`,
            evt_package.description,
            evt_package.date_creation,  
            evt_package.price_person,
            evt_package.active,
            evt_events_package.id ,
            evt_events_package.package_id ,
            evt_events_package.event_id,
            evt_events_package.subevent_id,
            evt_events_package.quantity,
            evt_events_package.price
        FROM
            {$this->bd}evt_package
            INNER JOIN {$this->bd}evt_events_package ON evt_events_package.package_id = evt_package.id
            WHERE event_id = ?
        ";
        return $this->_Read($query, $array);
    }
    
    function getExtrasByEvent($array) {

        $query = "
            SELECT
                evt_events_package.id,
                evt_events_package.date_creation,
                evt_events_package.event_id,
                evt_events_package.subevent_id,
                evt_events_package.package_id,
                evt_events_package.quantity,
                evt_events_package.price,
                evt_events_package.product_id,
                evt_products.`name`,
                evt_products.price
            FROM
                {$this->bd}evt_events_package
            INNER JOIN {$this->bd}evt_products ON evt_events_package.product_id = evt_products.id
            WHERE package_id is null 
            AND event_id = ? ";

        return $this->_Read($query, $array);
    }


    function getProductsPackageId($array) {
        $query = "
            SELECT
            evt_package_products.quantity,
            evt_package_products.date_creation,
            evt_products.`name`,
            evt_products.price,
            evt_products.active,
            evt_package_products.package_id
            FROM
            {$this->bd}evt_package_products
            INNER JOIN {$this->bd}evt_products ON evt_package_products.products_id = evt_products.id
            WHERE package_id = ?
        ";

        return $this->_Read($query, $array);
    }

    function getPackagesBySubEventId($array) {

        $query = "
            SELECT
                evt_package.id,
                evt_package.`name`,
                evt_package.description,
                evt_package.date_creation,  
                evt_package.price_person,
                evt_package.active,
                evt_events_package.id,
                evt_events_package.event_id,
                evt_events_package.package_id ,
                evt_events_package.subevent_id,
                evt_events_package.quantity,
                evt_events_package.price
            FROM
                {$this->bd}evt_package
            INNER JOIN 
                {$this->bd}evt_events_package ON evt_events_package.package_id = evt_package.id
            WHERE subevent_id = ? ";

        return $this->_Read($query, $array);
    }

    function getExtrasBySubEventId($array) {

        $query = "
            SELECT
                evt_events_package.id,
                evt_events_package.date_creation,
                evt_events_package.event_id,
                evt_events_package.subevent_id,
                evt_events_package.package_id,
                evt_events_package.quantity,
                evt_events_package.price,
                evt_events_package.product_id,
                evt_products.`name`,
                evt_products.price
            FROM
                {$this->bd}evt_events_package
            INNER JOIN {$this->bd}evt_products ON evt_events_package.product_id = evt_products.id
            WHERE package_id is null 
            AND subevent_id = ? ";

        return $this->_Read($query, $array);
    }


    // Menu
    public function getMenuById($array){
       
        $query = "
            SELECT
            id, quantity, package_type, price
            FROM {$this->bd}evt_menu
            WHERE id_sub_event = ?
        ";
        return $this->_Read($query, $array);
    }

    public function getDishesByMenu($array){
        $values = 'id, dish, quantity, tiempo, id_menu, id_clasificacion, id_event';
        
        return $this->_Select([

            'table'  => "{$this->bd}evt_dishes",
            'values' => $values,
            'where'  => 'id_menu = ?',
            'data'   => $array,
        ]);
    }

    // Payment
    function getPaymentByID($array){
        $query = "
           SELECT
            evt_payments.id,
            SUM(evt_payments.pay) as valor,
            method_pay.method_pay

            FROM
            {$this->bd}evt_payments
            INNER JOIN {$this->bd}method_pay ON evt_payments.method_pay_id = method_pay.id
            WHERE evt_events_id = ?

            GROUP BY method_pay
        ";
        return $this->_Read($query, $array);
    }

    function addMethodPay($array){
        return $this->_Insert([
            'table'  => "{$this->bd}evt_payments",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function getMethodPay($array){
        $query = "
            SELECT
                method_pay.id,
                method_pay.method_pay
            FROM
                {$this->bd}method_pay
            WHERE id = ?
        ";

        return $this->_Read($query, $array)[0]['method_pay'];
    }

    function getListPayment($array) {
        $query = "
        SELECT
            evt_payments.id,
            evt_payments.date_pay,
            evt_payments.pay,
            method_pay.id,
            method_pay.method_pay,
            evt_payments.method_pay_id,
            evt_payments.evt_events_id,
            evt_payments.type
        FROM
        {$this->bd}evt_payments
        INNER JOIN {$this->bd}method_pay ON evt_payments.method_pay_id = method_pay.id
        where evt_events_id = ?
        ORDER BY evt_payments.id ASC
        ";
        return $this->_Read($query,$array);
    }


    // histor of Events
    function getHistoryEventByID($array){
        $query = "
            SELECT
                evt_histories.id as id,
                evt_histories.title as valor,
                evt_histories.action as message,
                evt_histories.date_action as date,
                evt_histories.comment,
                evt_histories.type,
                fullname AS author
            FROM {$this->bd}evt_histories
            LEFT JOIN fayxzvov_alpha.usr_users ON evt_histories.usr_users_id = fayxzvov_alpha.usr_users.id
            WHERE evt_histories.evt_events_id = ?

            ORDER BY evt_histories.date_action ASC
        ";
        return $this->_Read($query, $array);
    }

    // Info Events.

    function getEventsByID($array){
        $query = "SELECT
            evt_category.category as type_event,
            evt_events.phone,
            evt_events.email,
            evt_events.name_client as contact,
            evt_events.name_event as name,
            evt_events.date_creation,
            DATE_FORMAT(evt_events.date_start, '%Y/%m/%d') AS date_start,
            DATE_FORMAT(evt_events.date_start, '%H:%i hrs ') AS date_start_hr,
            DATE_FORMAT(evt_events.date_end, '%Y/%m/%d') AS date_end,
            DATE_FORMAT(evt_events.date_end, '%H:%i hrs ') AS date_end_hr,
            evt_events.total_pay,
            evt_events.advanced_pay as advance_pay,
            evt_events.notes,
            evt_events.status_process_id,
            evt_events.location,
            evt_events.quantity_people,
            method_pay.id,
            evt_events.discount,
            method_pay.method_pay,
            evt_events.id,
            status_process.status
        FROM
            {$this->bd}evt_category
            LEFT JOIN {$this->bd}evt_events ON evt_events.category_id = evt_category.id
            LEFT JOIN {$this->bd}method_pay ON evt_events.method_pay_id = method_pay.id
            INNER JOIN {$this->bd}status_process ON evt_events.status_process_id = status_process.id

        WHERE evt_events.id = ?
        ";
        
        return $this->_Read($query, $array)[0];
    }

    function getDishes($array){

        $query = "
           SELECT
            evt_dishes.id,
            evt_dishes.tiempo,
            evt_classification.classification,

            evt_dishes.quantity,
            evt_dishes.dish,
            evt_menu.id_event,
            evt_dishes.id_menu
            FROM
            {$this->bd}evt_classification
            INNER JOIN {$this->bd}evt_dishes ON evt_dishes.id_clasificacion = evt_classification.id
            INNER JOIN {$this->bd}evt_menu ON evt_dishes.id_menu = evt_menu.id
            Where evt_menu.id_event = ? and tiempo = ?
            ORDER BY tiempo asc

        ";
        
        return $this->_Read($query, $array);
    }
    
    function getAdvancedPay($array){

         $query = "
            SELECT
                SUM(pay) as totalPay
            FROM
            {$this->bd}evt_payments
            INNER JOIN {$this->bd}method_pay ON evt_payments.method_pay_id = method_pay.id
            WHERE evt_events_id = ?
         ";

        return $this->_Read($query, $array)[0];


    }

    function getTimeByEvent($array){

        $query = "
          SELECT
            evt_dishes.id,
            evt_dishes.tiempo as valor
          
            FROM
            {$this->bd}evt_classification
            INNER JOIN {$this->bd}evt_dishes ON evt_dishes.id_clasificacion = evt_classification.id
            INNER JOIN {$this->bd}evt_menu ON evt_dishes.id_menu = evt_menu.id
            Where evt_menu.id_event = ?
            GROUP BY tiempo 
        ";
        
        return $this->_Read($query, $array);
    }

    function getMenu($array) {
        $values = 'id, id_event, quantity, package_type, price';
        return $this->_Select([
            'table'     => "{$this->bd}evt_menu",
            'values'    => $values,
            'where'     => 'id_event = ?',
            'data'      => $array
        ])[0];
    }

    function lsEventByID($array){
        $query = "
              SELECT
                customers.contact,
                customers.phone,
                evt_events.location,
                DATE_FORMAT(evt_events.date_creation, '%Y/%m/%d') AS date_creation,
                DATE_FORMAT(evt_events.date_start, '%Y/%m/%d') AS date_start,
                DATE_FORMAT(evt_events.date_end, '%Y/%m/%d') AS date_end,
                evt_events.total_pay,
                evt_events.advanced_pay,
                evt_events.notes,
                status_process.status,
                status_process.id AS idStatus,
                evt_events.id AS id
            FROM {$this->bd}evt_events
            INNER JOIN {$this->bd}customers ON evt_events.customers_id = customers.id
            INNER JOIN {$this->bd}status_process ON evt_events.status_process_id = status_process.id
            WHERE evt_events.id = ?
            ";
        
        return $this->_Read($query, $array);
    }
    
    function lsSubEvent($array){
        
        $query = "

            SELECT
                
                evt_subevents.id as id,
                name_sub_event,
                quantity_people,
                DATE_FORMAT(date_start, '%Y/%m/%d') AS date_start,
                evt_subevents.time_start,
                evt_subevents.time_end,
                evt_subevents.notes,
                evt_types.type,
                evt_subevents.location,
                status_process.status

            FROM
                {$this->bd}evt_subevents
                INNER JOIN {$this->bd}evt_types ON evt_subevents.evt_type_id = evt_types.id
                INNER JOIN {$this->bd}status_process ON evt_subevents.status_process_id = status_process.id
            WHERE 
            evt_events_id = ?
                
        ";
            
        return $this-> _Read($query, $array);
    }

    function lsMenu($array){
        
        $query = "
           SELECT
                evt_packages.package,
                evt_packages.enabled,
                evt_menus.quantity,
                evt_menus.pay_person,
                evt_menus.id,
                evt_menus.evt_subevent_id
            FROM
                {$this->bd}evt_menus
            INNER JOIN {$this->bd}evt_packages ON evt_menus.evt_package_id = evt_packages.id

            WHERE evt_menus.evt_subevent_id = ? ";
            
        return $this-> _Read($query, $array);
    }

    
    function updateEvent($array){


        return $this->_Update([
            'table' => "{$this->bd}evt_events",
            'values' => $array['values'],
            'where' => $array['where'],
            'data' => $array['data'],
        ]);
    }

    function addHistories($array){
        return $this->_Insert([
            'table'  => "{$this->bd}evt_histories",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    // Clausules.

    function listClausules($array){
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
}


?>