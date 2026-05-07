<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';


class mdl extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd = "{$_SESSION['DB']}.";
    }
    
    // 📦 PAQUETES ---------------------
    function getPaquetes($array) {
        return $this->_Select([
            'table'  => $this->bd."evt_package",
            'values' => "id, name, DATE_FORMAT(date_creation, '%d %M %Y') as date_creation, description, price_person, active",
            'where'  => 'active = ? AND subsidiaries_id = ?',
            'order'   => ['DESC' => 'id'],
            'data'   => $array
        ]);
    }

    function existsPaqueteByName($array) {
        $exists = $this->_Select([
            'table' => $this->bd.'evt_package',
            'values' => 'id',
            'where' => 'LOWER(name) = LOWER(?) AND active = 1 AND subsidiaries_id = ?',
            'data' => $array
        ]);
        return count($exists) > 0;
    }

    function createPaquete($array) {
        return $this->_Insert([
            'table' => $this->bd.'evt_package',
            'values' => $array['values'],
            'data' => $array['data']
        ]);
    }

    // ACTUALIZACION
    function getPaqueteById($id) {
        return $this->_Select([
            'table' => $this->bd.'evt_package',
            'values' => '*',
            'where' => 'id = ?',
            'data' => [$id]
        ])[0];
    }

    function existsOtherPaqueteByName($array) {
        $res = $this->_Select([
            'table' => $this->bd.'evt_package',
            'values' => 'id',
            'where' => 'LOWER(name) = LOWER(?) AND id != ? AND active = 1 AND subsidiaries_id = ?',
            'data' => $array
        ]);
        return count($res) <= 0; // TRUE si no hay otro con ese nombre
    }

    function updatePaquete($array) {
        return $this->_Update([
            'table' => $this->bd.'evt_package',
            'values' => $array['values'],
            'where' => $array['where'],
            'data' => $array['data']
        ]);
    }

    function maxPaqueteID(){
        $result = $this->_Select([
            'table'  => $this->bd."evt_package",
            'values' => "MAX(id) AS id",
        ]);
        return $result[0]['id'];
    }

    // 🛒 PRODUCTOS ---------------------
    function getProductos($array) {
        $leftjoin = [
            $this->bd.'evt_classification' => 'evt_products.id_classification = evt_classification.id'
        ];

        return $this->_Select([
            'table'    => $this->bd.'evt_products',
            'values'   => "evt_products.id, evt_products.name AS valor, evt_products.price, evt_classification.classification, DATE_FORMAT(evt_products.date_creation, '%d %M %Y') as date_creation, evt_products.active",
            'leftjoin' => $leftjoin,
            'where'    => 'evt_products.active = ? AND evt_products.subsidiaries_id = ?',
            'order'   => ['DESC' => 'evt_products.id'],
            "data"     => $array
        ]);
    }

    function existsProductoByName($array) {
        $exists = $this->_Select([
            'table' => $this->bd.'evt_products',
            'values' => 'id',
            'where' => 'LOWER(name) = LOWER(?) AND active = 1 AND subsidiaries_id = ?',
            'data' => $array
        ]);

        return count($exists) > 0; 
    }

    function createProducto($array) {
        return $this->_Insert([
            'table' => $this->bd.'evt_products',
            'values' => $array['values'],
            'data' => $array['data']
        ]);
    }

    // ACTUALIZACION
    function getProductoById($id) {
        return $this->_Select([
            'table' => $this->bd.'evt_products',
            'values' => '*',
            'where' => 'id = ?',
            'data' => [$id]
        ])[0];
    }
    
    function existsOtherProductoByName($array) {
        $res = $this->_Select([
            'table' => $this->bd.'evt_products',
            'values' => 'id',
            'where' => 'LOWER(name) = LOWER(?) AND id != ? AND active = 1 AND subsidiaries_id = ?',
            'data' => $array
        ]);
        return count($res) <= 0; // TRUE si no hay otro con ese nombre
    }

    function updateProducto($array) {
        return $this->_Update([
            'table' => $this->bd.'evt_products',
            'values' => $array['values'],
            'where' => $array['where'],
            'data' => $array['data']
        ]);
    }


    // 🛍️ PAQUETE PRODUCTOS -------------------
    function deletePaqueteProductos($array) {
        return $this->_Delete([
            'table' => $this->bd.'evt_package_products',
            'values' => $array['values'],
            'where' => $array['where'],
            'data' => $array['data']
        ]);
    }

    function createPaqueteProductos($array) {
        return $this->_Insert([
            'table' => $this->bd.'evt_package_products',
            'values' => $array['values'],
            'data' => $array['data']
        ]);
    }

    function getPaqueteProductos($array) {
        $leftjoin = [
            $this->bd.'evt_products' => 'evt_package_products.products_id = evt_products.id',
            $this->bd.'evt_classification' => 'evt_products.id_classification = evt_classification.id'
        ];

        return $this->_Select([
            'table'    => $this->bd.'evt_package_products',
            'values'   => "evt_package_products.id AS idPP, evt_products.id AS id, evt_products.name AS valor, evt_products.price, evt_products.active, evt_package_products.quantity, evt_classification.classification",
            'leftjoin' => $leftjoin,
            'where'    => 'evt_package_products.package_id = ?',
            'data'     => $array
        ]);
    }

    // 🏷️ CLASIFICACIONES -------------------
    function getClasificaciones($array) {
        return $this->_Select([
            'table'  => $this->bd.'evt_classification',
            'values' => "id, classification, DATE_FORMAT(date_creation, '%d %M %Y') AS date_creation, active",
            'where'  => 'active = ? AND subsidiaries_id = ?',
            'order'   => ['DESC' => 'id'],
            'data'   => $array
        ]);
    }

    function existsClasificacionByName($array) {
        $exists = $this->_Select([
            'table' => $this->bd.'evt_classification',
            'values' => 'id',
            'where' => 'LOWER(classification) = LOWER(?) AND active = 1 AND subsidiaries_id = ?',
            'data' => $array
        ]);
        return count($exists) > 0; 
    }

    function createClasificacion($array) {
        return $this->_Insert([
            'table' => $this->bd.'evt_classification',
            'values' => $array['values'],
            'data' => $array['data']
        ]);
    }

    // ACTUALIZACION
    function getClasificacionById($id) {
        return $this->_Select([
            'table' => $this->bd.'evt_classification',
            'values' => "id, classification, DATE_FORMAT(date_creation, '%d %M %Y') AS date_creation, active",
            'where' => 'id = ?',
            'data' => [$id]
        ])[0];
    }

    function existsOtherClasificacionByName($array) {
        $res = $this->_Select([
            'table' => $this->bd.'evt_classification',
            'values' => 'id',
            'where' => 'LOWER(classification) = LOWER(?) AND id != ? AND active = 1 AND subsidiaries_id = ?',
            'data' => $array
        ]);
        return count($res) <= 0; // TRUE si no hay otra con ese nombre
    }

    function updateClasificacion($array) {
        return $this->_Update([
            'table' => $this->bd.'evt_classification',
            'values' => $array['values'],
            'where' => $array['where'],
            'data' => $array['data']
        ]);
    }

}
