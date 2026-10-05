<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {

    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_facturacion.';
    }

    // -- Catalogos --

    // La sucursal del modulo vive en este esquema, no en la sesion de Huubie.
    function getBranch() {
        $query = "
            SELECT id
            FROM {$this->bd}branch
            WHERE active = 1
            ORDER BY id ASC
            LIMIT 1
        ";
        return $this->_Read($query);
    }

    // -- Productos --

    // El catalogo lo siembra la carga de comandas con las claves del POS; aqui se
    // administra lo que el POS no dice: si el producto sirve de puente para armar
    // tickets virtuales y si es un modificador.
    //
    // El listado ya no esconde a los inactivos: la baja es logica y reversible, y
    // la columna de estatus es la que la vuelve visible. $where lo arma el ctrl
    // desde un mapa fijo (nunca texto del usuario).
    function listProduct($array, $where = '') {
        $query = "
            SELECT id, code, name, price, is_bridge, is_modifier, active
            FROM {$this->bd}product
            WHERE branch_id <=> ?
              AND (code LIKE ? OR name LIKE ?)
              {$where}
            ORDER BY id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getProductByCode($array) {
        $query = "
            SELECT id, code, name, price, is_bridge, is_modifier, active
            FROM {$this->bd}product
            WHERE code = ? AND branch_id <=> ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    // Consulta dedicada con arreglo posicional (sin util->sql()): is_bridge, is_modifier
    // y price aceptan 0 legitimo, y util->sql() lo convertiria en NULL por su
    // comparacion suelta contra las columnas NOT NULL de este esquema.
    function createProduct($array) {
        // [code, name, price, is_bridge, is_modifier, branch_id]
        $query = "
            INSERT INTO {$this->bd}product (code, name, price, is_bridge, is_modifier, branch_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateProduct($array) {
        // [code, name, price, is_bridge, is_modifier, id]
        $query = "
            UPDATE {$this->bd}product
            SET code = ?, name = ?, price = ?, is_bridge = ?, is_modifier = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // $column ya viene validada en el ctrl contra un mapa fijo (is_bridge/is_modifier),
    // nunca es texto libre del usuario: por eso es seguro interpolarla en el SET.
    function updateProductFlag($column, $array) {
        // [valor, id]
        $query = "UPDATE {$this->bd}product SET {$column} = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function updateProductActive($array) {
        // [active, id]
        $query = "UPDATE {$this->bd}product SET active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    // -- Meseros --

    function listWaiter($array) {
        $query = "
            SELECT id, code, name, active
            FROM {$this->bd}waiter
            WHERE branch_id <=> ?
              AND (code LIKE ? OR name LIKE ?)
            ORDER BY active DESC, name ASC
        ";
        return $this->_Read($query, $array);
    }

    function getWaiterByCode($array) {
        $query = "
            SELECT id, code, name, active
            FROM {$this->bd}waiter
            WHERE code = ? AND branch_id <=> ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    function createWaiter($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}waiter",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateWaiter($array) {
        return $this->_Update([
            'table'  => "{$this->bd}waiter",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    // Consulta dedicada con arreglo posicional: la baja (active = 0) pasada por
    // util->sql() se convierte en NULL por su comparacion suelta y la columna es
    // NOT NULL con STRICT_ALL_TABLES.
    function updateWaiterActive($array) {
        // [active, id]
        $query = "UPDATE {$this->bd}waiter SET active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }
}
