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

    // -- Emisor del ticket virtual --

    // Los datos con los que se imprime el ticket son los de la sucursal; la razon
    // social de la empresa se trae junto porque es la que encabeza el papel cuando
    // la sucursal no tiene nombre propio.
    function getEmisor($array) {
        $query = "
            SELECT b.id, b.business_name, b.rfc, b.fiscal_address, b.phone,
                   c.business_name AS company_name, c.rfc AS company_rfc
            FROM {$this->bd}branch b
            LEFT JOIN {$this->bd}company c ON c.id = b.company_id
            WHERE b.id <=> ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    function updateBranch($array) {
        return $this->_Update([
            'table'  => "{$this->bd}branch",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    // -- Productos --

    // El catalogo lo siembra la carga de comandas con las claves del POS; aqui se
    // administra lo que el POS no dice: si el producto sirve de puente para armar
    // tickets virtuales y si es un modificador.
    function listProduct($array) {
        $query = "
            SELECT id, code, name, price, is_bridge, is_modifier
            FROM {$this->bd}product
            WHERE active = 1
              AND branch_id <=> ?
              AND (code LIKE ? OR name LIKE ?)
            ORDER BY is_bridge DESC, name ASC
        ";
        return $this->_Read($query, $array);
    }

    function getProductByCode($array) {
        $query = "
            SELECT id, code, name, price, is_bridge, is_modifier
            FROM {$this->bd}product
            WHERE active = 1 AND code = ? AND branch_id <=> ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    // Conteos del catalogo para las tarjetas del modulo. La suma de precios se
    // limita a los productos puente: son los que van a armar el ticket virtual.
    function getProductCounts($array) {
        $query = "
            SELECT COUNT(*) AS productos,
                   COALESCE(SUM(is_bridge), 0)   AS puente,
                   COALESCE(SUM(is_modifier), 0) AS modificadores,
                   COALESCE(SUM(CASE WHEN is_bridge = 1 THEN price ELSE 0 END), 0) AS suma_puente
            FROM {$this->bd}product
            WHERE active = 1
              AND branch_id <=> ?
              AND (code LIKE ? OR name LIKE ?)
        ";
        return $this->_Read($query, $array);
    }

    function createProduct($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}product",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateProduct($array) {
        return $this->_Update([
            'table'  => "{$this->bd}product",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    // -- Meseros --

    function listWaiter($array) {
        $query = "
            SELECT id, code, name
            FROM {$this->bd}waiter
            WHERE active = 1
              AND branch_id <=> ?
              AND (code LIKE ? OR name LIKE ?)
            ORDER BY name ASC
        ";
        return $this->_Read($query, $array);
    }

    function getWaiterByCode($array) {
        $query = "
            SELECT id, code, name
            FROM {$this->bd}waiter
            WHERE active = 1 AND code = ? AND branch_id <=> ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    function getWaiterCounts($array) {
        $query = "
            SELECT COUNT(*) AS meseros
            FROM {$this->bd}waiter
            WHERE active = 1
              AND branch_id <=> ?
              AND (code LIKE ? OR name LIKE ?)
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
}
