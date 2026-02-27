<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

// 📜 Modelo para la gestión de evt_subevents
class mdl extends CRUD {
    protected $util;
    protected $bd;

    public function __construct(){
        $this->util = new Utileria;
        $this->bd   = "{$_SESSION['DB']}.";
    }

    // Eventos
    function createEvent($array){
        return $this->_Insert([
            'table' => "{$this->bd}evt_events",
            'values' => $array['values'],
            'data' => $array['data']
        ]);
    }

    function maxEvent(){
        return $this->_Select([
            'table'  => "{$this->bd}evt_events",
            'values' => 'MAX(id) AS id',
        ])[0]['id'];
    }

    function getEventById($array){
        $values = "
        	evt_events.id AS idEvent,
            name_event,
            date_creation,
            date_start,
            date_end,
            total_pay,
            advanced_pay,
            status_process_id,
            location,
            name_client,
            phone,
            email,
            method_pay_id,
            type_event,
            quantity_people,
            status,
            method_pay,
            notes,
            discount,
            info_discount,
            subsidiaries_id";

        $leftjoin = [
            "{$this->bd}status_process" => "status_process_id = status_process.id",
            "{$this->bd}method_pay" => "method_pay_id = method_pay.id",
        ];
        return $this->_Select([
            'table'     => "{$this->bd}evt_events",
            'values'    => $values,
            'leftjoin' => $leftjoin,
            'where'     => 'evt_events.id = ?',
            'data'      => $array
        ])[0];
    }

    function updateEvent($array){
        return $this->_Update([
            'table'  => "{$this->bd}evt_events",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

    public function getMenuByEventId($array){


        $query = "
            SELECT
            id, quantity, package_type, price
            FROM {$this->bd}evt_menu
            WHERE id_sub_event = ?
        ";
        return $this->_Read($query, $array);
    }

    public function updateTotalEvt($idEvent) { 

        // 1. Obtener suma de total_pay de los subeventos
        $query = "
            SELECT SUM(CAST(total_pay AS DECIMAL(10,2))) AS total
            FROM {$this->bd}evt_subevents
            WHERE evt_events_id = ? ";

        $result = $this->_Read($query, [$idEvent]);
        $total  = isset($result[0]['total']) ? $result[0]['total'] : 0;

        // 2. Actualizar el campo total_pay en evt_events
        
        $array = $this->util->sql([
            'total_pay' => $total,
            'id'        => $idEvent
        ],1);

        $success = $this-> updateEvent($array);


        return ['success'=>$success , 'total' => $total];

    }


    // Menu& Packages
    public function createEventPackage($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}evt_events_package",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    public function removePackage($array) {
        return $this->_Delete([
            'table' => "{$this->bd}evt_events_package",
            'where' => $array['where'],
            'data'  => $array['data']
        ]);
    }

    public function createEventExtra($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}evt_events_package",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateEventPackageQuantity($array){

        return $this->_Update([
            'table'  => "{$this->bd}evt_events_package",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

    function getPackage($array){
        $query = "
            SELECT
               price_person as price
            FROM
                {$this->bd}evt_package WHERE id = ?";

        return $this->_Read($query, $array)[0];
    }

    public function getEventPackageByKeys($array){

        $query = "
        SELECT
            evt_events_package.id,
            evt_events_package.subevent_id,
            evt_events_package.package_id,
            evt_events_package.quantity
        FROM {$this->bd}evt_events_package
        WHERE subevent_id = ? and package_id = ?


        ";

        return $this->_Read($query, $array)[0];
    }

    // Payment
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
                {$this->bd}method_pay WHERE id = ?";

        return $this->_Read($query, $array)[0]['method_pay'];
    }

    function addHistories($array){
        return $this->_Insert([
            'table' => "{$this->bd}evt_histories",
            'values' => $array['values'],
            'data' => $array['data'],
        ]);
    }

    // 📜 Sub eventos
    public function getSubEventsByEventId($array) {
        $query = "
        SELECT
            sub.id,
            sub.name_subevent as title,
            sub.name_subevent,
            sub.date_start as date,
            sub.date_start,
            sub.date_end,
            DATE_FORMAT(sub.time_start, '%H:%i') as time_start,
            DATE_FORMAT(sub.time_end, '%H:%i') as time_end,
            sub.quantity_people,
            sub.total_pay,
            sub.location,
            sub.notes,
            sub.type_event,
            sub.status_process_id,
            sub.type_event as type,
            evt.name_event as event
        FROM {$this->bd}evt_subevents sub
        INNER JOIN {$this->bd}evt_events evt ON sub.evt_events_id = evt.id
        WHERE sub.evt_events_id = ?
        ";
        return $this->_Read($query, $array);
    }

    public function getSubEventoByID($array){
        $query = "
        SELECT
            id,
            evt_events_id,
            name_subevent,
            date_creation,
            date_start,
            date_end,
            time_start,
            time_end,
            total_pay,
            notes,
            status_process_id,
            location,
            quantity_people,
            type_event,
            evt_menu_id
        FROM {$this->bd}evt_subevents
        WHERE id = ?
        ";
        return $this->_Read($query, $array);
    }

    public function getTotalSubEvents($array){

        $query = "
            SELECT
                SUM(evt_subevents.total_pay) as total,
                SUM(evt_subevents.quantity_people) as quantity
                FROM
                {$this->bd}evt_subevents
            WHERE evt_events_id = ?
        ";
        return $this->_Read($query, $array)[0];
    }

    // 📜 Crear nuevo subevento
    public function createSubEvento($array){
        return $this->_Insert([
            'table'  => "{$this->bd}evt_subevents",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    // 📜 Actualizar subevento
    public function updateSubEvento($array){
        return $this->_Update([
            'table'  => "{$this->bd}evt_subevents",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

    public function deleteSubEvento($array){
        return $this->_Delete([
            'table' => "{$this->bd}evt_subevents",
            'where' => $array['where'],
            'data'  => $array['data'],
        ]);
    }

    public function maxSubEvent(){
        return $this->_Select([
            'table'  => "{$this->bd}evt_subevents",
            'values' => 'MAX(id) AS id',
        ])[0]['id'];
    }

    // Histories.


    // Menú
    public function getMenuById($array)
    {


        $query = "
            SELECT
            id, quantity, package_type, price
            FROM {$this->bd}evt_menu
            WHERE id_sub_event = ?
        ";
        return $this->_Read($query, $array);
    }

    public function maxMenu()
    {
        return $this->_Select([
            'table' => "{$this->bd}evt_menu",
            'values' => 'MAX(id) AS id',
        ])[0]['id'];
    }

    public function createMenu($array)
    {
        return $this->_Insert([
            'table' => "{$this->bd}evt_menu",
            'values' => $array['values'],
            'data' => $array['data'],
        ]);
    }

    // Dishes
    public function getDish($array){
        $values = 'evt_dishes.id AS id, dish, quantity, tiempo, id_menu, id_clasificacion, classification AS clasificacion, id_event';
        $innerjoin = ["evt_classification" => "evt_classification.id = id_clasificacion"];

        return $this->_Select([
            'table' => "{$this->bd}evt_dishes",
            'values' => $values,
            'innerjoin' => $innerjoin,
            'where' => 'id_menu = ?',
            'order' => ['ASC' => 'id_clasificacion, dish, tiempo'],
            'data' => $array,
        ]);
    }

    function getDishById($array){
        $values = 'id, dish, quantity, tiempo, id_menu, id_clasificacion, id_event';

        return $this->_Select([

            'table'  => "evt_dishes",
            'values' => $values,
            'where'  => 'id = ?',
            'data'   => $array,
        ])[0];
    }


    public function createDish($array){

        return $this->_Insert([
            'table'  => "{$this->bd}evt_dishes",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function deleteDish($array){

        return $this->_Delete([
            'table' => "{$this->bd}evt_dishes",
            'where' => $array['where'],
            'data'  => $array['data'],
        ]);
    }

    function updateDish($array){

        return $this->_Update([
            'table'  => "{$this->bd}evt_dishes",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }


    // FUNCIONES REALES
    function getMenus($array){
        $values = '
            p.id AS package_id,
            p.name AS package,
            p.description,
            p.price_person,
            pr.id AS idPr,
            pr.name AS product,
            c.id AS idC,
            c.classification
        ';

        $leftjoin = [
            $this->bd.'evt_package_products AS pp' => 'p.id = pp.package_id',
            $this->bd.'evt_products AS pr' => 'pp.products_id = pr.id',
            $this->bd.'evt_classification AS c' => 'pr.id_classification = c.id'
        ];

        return $this->_Select([
            'table'     => $this->bd.'evt_package AS p',
            'values'    => $values,
            'leftjoin'  => $leftjoin,
            'where'     => 'p.subsidiaries_id = ? AND p.active = 1 AND pr.active = 1',
            'data'      => $array
        ]);
    }

    function getProductosExtras($array) {
        $values = '
            p.id,
            p.name AS nombre,
            p.price AS precio,
            c.id AS id_clasificacion,
            c.classification
        ';

        $leftjoin = [
            $this->bd.'evt_classification AS c' => 'p.id_classification = c.id'
        ];

        return $this->_Select([
            'table'     => $this->bd.'evt_products AS p',
            'values'    => $values,
            'leftjoin'  => $leftjoin,
            'where'     => 'p.subsidiaries_id = ? AND p.active = 1',
            'data'      => $array
        ]);
    }

    function getClasificaciones($array){
        return $this->_Select([
            'table'  => $this->bd.'evt_classification',
            'values' => 'id, classification AS nombre',
            'where'     => 'subsidiaries_id = ? AND active = 1',
            'data'      => $array
        ]);
    }

    // add extra
    function createProduct($array){
        return $this->_Insert([
            'table'  => "{$this->bd}evt_products",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function maxProduct(){

        return $this->_Select([

            'table'  => "{$this->bd}evt_products",
            'values' => 'MAX(id) AS id',

        ])[0]['id'];
    }


    // RELACION EVENTO - PAQUETE (O PRODUCTO)
    function getSubEventPackage($array)
    {
        $values = '
        	ep.id AS idRelation,
            subevent_id,
            ep.package_id,
            ep.quantity,
            ep.price,
            ep.date_creation,
            p.id AS idP,
            p. NAME AS package,
            description,
            price_person,
            pr.id AS idPr,
            pr. NAME AS product,
            ep.id AS idEvtPackage,
            pp.quantity AS quantityProduct,
            c.id AS idC,
            c.classification
        ';

        $leftjoin = [
            $this->bd.'evt_package AS p' => 'ep.package_id = p.id',
            $this->bd.'evt_package_products AS pp' => 'p.id = pp.package_id',
            $this->bd.'evt_products AS pr' => 'pp.products_id = pr.id',
            $this->bd.'evt_classification AS c' => 'pr.id_classification = c.id'
        ];

        return $this->_Select([
            'table'     => $this->bd."evt_events_package AS ep",
            'values'    => $values,
            'leftjoin'  => $leftjoin,
            'where'     => 'ep.subevent_id = ? AND ep.product_id IS NULL AND ep.package_id IS NOT NULL',
            'data'      => $array
        ]);
    }

    function getSubEventProduct($array){
        $values = '
            ep.id AS idRelation,
            ep.subevent_id,
            ep.product_id,
            ep.quantity,
            ep.price,
            ep.id AS idEvtPackage,

            ep.date_creation,
            p.name AS nombre,
            p.price AS precioUnitario,
            c.id AS id_clasificacion,
            c.classification AS clasificacion
        ';

        $leftjoin = [
            $this->bd.'evt_products AS p' => 'ep.product_id = p.id',
            $this->bd.'evt_classification AS c' => 'p.id_classification = c.id'
        ];

        return $this->_Select([
            'table'     => $this->bd.'evt_events_package AS ep',
            'values'    => $values,
            'leftjoin'  => $leftjoin,
            'where'     => 'ep.subevent_id = ? AND ep.product_id IS NOT NULL AND ep.package_id IS NULL',
            'data'      => $array
        ]);
    }

    function createSubEventPackage($array)
    {
        return $this->_Insert([
            'table' => $this->bd."evt_events_package",
            'values' => $array['values'],
            'data' => $array['data']
        ]);
    }

    function deleteSubEventPackage($array)
    {
        return $this->_Delete([
            'table' => $this->bd."evt_events_package",
            'where' => $array['where'],
            'data' => $array['data']
        ]);
    }
}