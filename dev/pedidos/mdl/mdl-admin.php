<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';


class mdl extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        // $this->bd = "{$_SESSION['DB']}.";
        $this->bd = "fayxzvov_coffee.";
    }

    // 🛍️ Product.

    function lsProductos($array){
        $leftjoin = [
            $this->bd . 'order_category' => 'order_products.category_id = order_category.id'
        ];

        return $this->_Select([
            'table'    => $this->bd . 'order_products',
            'values'   =>
                "order_products.id as id,
                order_products.name AS valor,
                order_products.price,
                order_products.description,
                order_products.image,
                order_category.classification,
                DATE_FORMAT(order_products.date_creation, '%d %M %Y') as date_creation,
                order_products.active",

            'leftjoin' => $leftjoin,
            'where'    => 'order_products.active = ? AND order_products.subsidiaries_id = ?',
            'order'    => ['DESC' => 'order_products.id'],
            'data'     => $array
        ]);
    }

    function getProductoById($id){
        return $this->_Select([
            'table'  => $this->bd . 'order_products',
            'values' => "*",
            'where'  => 'id = ?',
            'data'   => [$id]
        ])[0];
    }

    function existsProductoByName($array) {
        $query = "
            SELECT id
            FROM {$this->bd}order_products
            WHERE LOWER(name) = LOWER(?)
            AND active = 1
            AND subsidiaries_id = ?
        ";

        $exists = $this->_Read($query, $array);
        return count($exists) > 0;
    }

    function existsOtherProductoByName($array) {
        $res = $this->_Select([
            'table'  => $this->bd . 'order_products',
            'values' => 'id',
            'where'  => 'LOWER(name) = LOWER(?) AND id != ? AND active = 1 AND subsidiaries_id = ?',
            'data'   => $array
        ]);
        return count($res) <= 0;
    }

    function createProducto($array) {
        return $this->_Insert([
            'table'  => $this->bd . 'order_products',
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateProducto($array) {
        return $this->_Update([
            'table'  => $this->bd . 'order_products',
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    // Category.

    function lsCategory($array) {

        return $this->_Select([
            'table' => "{$this->bd}order_category",

            'values' => "
                id,
                classification AS valor,
                description,
                DATE_FORMAT(date_creation, '%d %M %Y') AS date_creation,
                active
            ",
            'where' => "active = ? ",
            'order' => ['DESC' => 'id'],
            'data'  => $array
        ]);
    }

    function getCategory($array = []) {
        return $this->_Select([

            'table'  => "{$this->bd}order_category",
            'values' => ['id', 'active','classification', 'description', "DATE_FORMAT(date_creation, '%Y-%m-%d') AS date_creation"],
            'order'  => ['DESC' => 'date_creation']
        ]);
    }

    function getCategoryById($array) {
        return $this->_Select([

            'table'  => "{$this->bd}order_category",
            'values' => '*',
            'where'  => 'id = ?',
            'data'   => $array
        ])[0];
    }

    function createCategory($array) {

        return $this->_Insert([

            'table'  => "{$this->bd}order_category",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);

    }

    function updateCategory($array) {
        return $this->_Update([

            'table'  => "{$this->bd}order_category",
            'values' => $array['values'],
            'where'  => 'id = ?',
            'data'   => $array['data']
        ]);
    }

    // Clients.

    function lsClient($array) {
        return $this->_Select([
            'table'  => "{$this->bd}order_clients",
            'values' =>
                "id,
                name,
                phone,
                email,
                DATE_FORMAT(date_create, '%Y-%m-%d') as date_create",
            'where'  => 'active = ? AND subsidiaries_id = ?',
            'order'  => ['DESC' => 'id'],
            'data'   => $array
        ]);
    }

    function getClientById($array) {
        return $this->_Select([
            'table'  => "{$this->bd}order_clients",
            'values' => '*',
            'where'  => 'id = ?',
            'data'   => $array
        ])[0];
    }

    function createClient($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}order_clients",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateClient($array) {
        return $this->_Update([
            'table'  => "{$this->bd}order_clients",
            'values' => $array['values'],
            'where'  => 'id = ?',
            'data'   => $array['data']
        ]);
    }

    // Modifier.
    function getAllModifiers($array) {
        return $this->_Select([
            'table'  => "{$this->bd}order_modifier",
            'values' => 'id,name,name as valor,active',
            'where'  => 'active = ?',
            'data'   => $array
        ]);
    }

    function getModifierById($array) {
        return $this->_Select([
            'table'  => "{$this->bd}order_modifier",
            'values' => '*',
            'where'  => 'id = ?',
            'data'   => $array
        ])[0];
    }

    function maxModifier(){

        return $this->_Select([

            'table'  => "{$this->bd}order_modifier",
            'values' => 'MAX(id) AS id',

        ])[0]['id'];
    }

    function createModifier($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}order_modifier",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateModifier($array) {
        return $this->_Update([
            'table'  => "{$this->bd}order_modifier",
            'values' => $array['values'],
            'where'  => 'id = ?',
            'data'   => $array['data']
        ]);
    }

    public function existsModifier($array) {
        $query = "
            SELECT id 
            FROM {$this->bd}order_modifier 
            WHERE name = ? AND active = 1
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return !empty($result);
    }

    function existsProductModifier($array) {
        $query = "
            SELECT id 
            FROM {$this->bd}order_modifier_products
            WHERE name = ? AND modifier_id = ? AND active = 1
            LIMIT 1
        ";

        $result = $this->_Read($query, $array);
        return !empty($result);
    }

    function getAllProducstModifiers($array) {
        return $this->_Select([
            'table'  => "{$this->bd}order_modifier_products",
            'values' => '*',
            'where'  => 'modifier_id = ? and active=1',
            'data'   => $array,
            'order'  => ['DESC' => 'id']
        ]);
    }


    function createProductModifier($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}order_modifier_products",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

   

    // modifierProduct.
    public function lsModifierOrderProducts($array) {
        $leftjoin = [
            $this->bd . 'order_modifier' => 'order_modifier_products.modifier_id = order_modifier.id'
        ];
    
        // Siempre se recibe al menos el valor de "active"
        $where = 'order_modifier_products.active = ?';
        $data  = [$array[0]];
    
        // Si se recibe un segundo parámetro (modifier_id), lo añadimos al filtro
        if (isset($array[1]) && $array[1] != 0) {
            $where .= ' AND order_modifier.id = ?';
            $data[] = $array[1];
        }
    
        return $this->_Select([
            'table'    => $this->bd . 'order_modifier_products',
            'values'   =>
                "order_modifier_products.id as id,
                order_modifier_products.name,
                order_modifier_products.price,
                order_modifier_products.cant,
                order_modifier_products.description,
                order_modifier.name as modifier,
                DATE_FORMAT(order_modifier_products.date_creation, '%d %M %Y') as date_creation,
                order_modifier_products.active",
    
            'leftjoin' => $leftjoin,
            'where'    => $where,
            'order'    => ['DESC' => 'order_modifier_products.id'],
            'data'     => $data
        ]);
    }
    

    public function updateModifierProduct($array) {
        return $this->_Update([
            'table'  => "{$this->bd}order_modifier_products",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function getProductModifierById($array) {
        return $this->_Select([
            'table'  => "{$this->bd}order_modifier_products",
            'values' => '*',
            'where'  => 'id = ?',
            'data'   => $array
        ])[0];
    }

    function updateProductModifier($array) {
        return $this->_Update([
            'table'  => "{$this->bd}order_modifier_products",
            'values' => $array['values'],
            'where'  => 'id = ?',
            'data'   => $array['data']
        ]);
    }

    // payment.
    function registerPayment($array) {
        return $this->_Update([
            'table'  => "{$this->bd}order",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }









}
