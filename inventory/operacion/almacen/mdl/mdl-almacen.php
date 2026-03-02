<?php

require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';

class mdl extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = "fayxzvov_almacen.";
    }

    // Selects para filtros

    function lsZonas() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}areas
            WHERE active = 1
            AND udn_id = ".$_SESSION['idUDN']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function lsCategories() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}presentations
            WHERE active = 1
            AND udn_id = ".$_SESSION['idUDN']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function lsAreas() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}product_groups
            WHERE active = 1
            AND udn_id = ".$_SESSION['idUDN']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function lsProveedores() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}supplier
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    // Materiales

    function listMateriales($filters) {
        $query = "
            SELECT
                a.id,
                a.code,
                a.name,
                a.quantity,
                a.cost,
                a.price,
                a.active,
                a.min_stock,
                a.description,
                a.created_at,
                ar.name as area,
                c.name as categoria,
                z.name as zona
            FROM {$this->bd}product a
            LEFT JOIN {$this->bd}product_groups ar ON a.group_id        = ar.id
            LEFT JOIN {$this->bd}presentations c   ON a.presentations_id = c.id
            LEFT JOIN {$this->bd}areas z            ON a.area_id         = z.id
            WHERE a.udn_id = ".$_SESSION['idUDN']."
        ";

        $params = [];

        if (!empty($filters['zona'])) {
            $query .= " AND a.area_id = ?";
            $params[] = $filters['zona'];
        }

        if (!empty($filters['categoria'])) {
            $query .= " AND a.presentations_id = ?";
            $params[] = $filters['categoria'];
        }

        if (!empty($filters['area'])) {
            $query .= " AND a.group_id = ?";
            $params[] = $filters['area'];
        }

        if (isset($filters['estado']) && $filters['estado'] !== '') {
            $query .= " AND a.active = ?";
            $params[] = $filters['estado'];
        }

        $query .= " ORDER BY a.id DESC";

        return $this->_Read($query, $params);
    }

    function getMaterialById($id) {
        $query = "
            SELECT
                a.*,
                ar.name as area_nombre,
                c.name as categoria_nombre,
                z.name as zona_nombre
            FROM {$this->bd}product a
            LEFT JOIN {$this->bd}product_groups ar ON a.group_id        = ar.id
            LEFT JOIN {$this->bd}presentations c   ON a.presentations_id = c.id
            LEFT JOIN {$this->bd}areas z            ON a.area_id         = z.id
            WHERE a.id = ?
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }

    function existsMaterialByCode($array) {
        $query = "
            SELECT COUNT(*) as count
            FROM {$this->bd}product
            WHERE code = ? AND active = 1
            AND udn_id = ".$_SESSION['idUDN']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['count'] > 0;
    }

    function getNextCodigoEquipo() {
        $query = "
            SELECT COALESCE(MAX(id), 0) + 1 as next_id
            FROM {$this->bd}product
        ";
        $result = $this->_Read($query, []);
        $nextId = $result[0]['next_id'];
        return 'PRD-' . str_pad($nextId, 3, '0', STR_PAD_LEFT);
    }

    function createMaterial($data) {
        return $this->_Insert([
            'table'  => "{$this->bd}product",
            'values' => $data['values'],
            'data'   => $data['data']
        ]);
    }

    function updateMaterial($data) {
        return $this->_Update([
            'table'  => "{$this->bd}product",
            'values' => $data['values'],
            'where'  => $data['where'],
            'data'   => $data['data']
        ]);
    }

    function deleteMaterialById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}product",
            'where' => $array['where'],
            'data'  => $array['data']
        ]);
    }

    // Categorías

    function listCategorias() {
        $query = "
            SELECT
                id,
                name,
                created_at as date_creation,
                active
            FROM {$this->bd}presentations
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function getCategoriaById($id) {
        $query = "
            SELECT * FROM {$this->bd}presentations WHERE id = ?
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }

    function createCategoria($data) {
        return $this->_Insert([
            'table'  => "{$this->bd}presentations",
            'values' => $data['values'],
            'data'   => $data['data']
        ]);
    }

    function updateCategoria($data) {
        return $this->_Update([
            'table'  => "{$this->bd}presentations",
            'values' => $data['values'],
            'where'  => $data['where'],
            'data'   => $data['data']
        ]);
    }

    // Áreas

    function listAreas() {
        $query = "
            SELECT
                id,
                name,
                created_at as date_creation,
                active
            FROM {$this->bd}product_groups
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function getAreaById($id) {
        $query = "
            SELECT * FROM {$this->bd}product_groups WHERE id = ?
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }

    function createArea($data) {
        return $this->_Insert([
            'table'  => "{$this->bd}product_groups",
            'values' => $data['values'],
            'data'   => $data['data']
        ]);
    }

    function updateArea($data) {
        return $this->_Update([
            'table'  => "{$this->bd}product_groups",
            'values' => $data['values'],
            'where'  => $data['where'],
            'data'   => $data['data']
        ]);
    }

    // Zonas

    function listZonas() {
        $query = "
            SELECT
                id,
                name,
                created_at as date_creation,
                active
            FROM {$this->bd}areas
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function getZonaById($id) {
        $query = "
            SELECT * FROM {$this->bd}areas WHERE id = ?
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }

    function createZona($data) {
        return $this->_Insert([
            'table'  => "{$this->bd}areas",
            'values' => $data['values'],
            'data'   => $data['data']
        ]);
    }

    function updateZona($data) {
        return $this->_Update([
            'table'  => "{$this->bd}areas",
            'values' => $data['values'],
            'where'  => $data['where'],
            'data'   => $data['data']
        ]);
    }

    // Proveedores

    function listProveedores() {
        $query = "
            SELECT
                id,
                name
            FROM {$this->bd}supplier
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function getProveedorById($id) {
        $query = "
            SELECT * FROM {$this->bd}supplier WHERE id = ?
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }

    function createProveedor($data) {
        return $this->_Insert([
            'table'  => "{$this->bd}supplier",
            'values' => $data['values'],
            'data'   => $data['data']
        ]);
    }

    function updateProveedor($data) {
        return $this->_Update([
            'table'  => "{$this->bd}supplier",
            'values' => $data['values'],
            'where'  => $data['where'],
            'data'   => $data['data']
        ]);
    }
}
