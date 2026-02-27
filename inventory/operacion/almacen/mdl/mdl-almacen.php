<?php

require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';

class mdl extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = "fayxzvov_mtto.";
    }

    // Selects para filtros

    function lsZonas() {
        $query = "
            SELECT id_zona as id, nombre_zona AS valor
            FROM {$this->bd}mtto_almacen_zona
            WHERE active = 1
            AND udn_id = ".$_SESSION['idUDN']."
            ORDER BY nombre_zona ASC
        ";
        return $this->_Read($query, []);
    }

    function lsCategories() {
        $query = "
            SELECT idcategoria as id, nombreCategoria AS valor
            FROM {$this->bd}mtto_categoria
            WHERE active = 1
            AND udn_id = ".$_SESSION['idUDN']."
            ORDER BY nombreCategoria ASC
        ";
        return $this->_Read($query, []);
    }

    function lsAreas() {
        $query = "
            SELECT idArea as id, nombre_area AS valor
            FROM {$this->bd}mtto_almacen_area
            WHERE active = 1
            AND udn_id = ".$_SESSION['idUDN']."
            ORDER BY nombre_area ASC
        ";
        return $this->_Read($query, []);
    }

    function lsDepartamentos() {
        $query = "
            SELECT id, nombre AS valor
            FROM {$this->bd}departamento
            WHERE active = 1
            ORDER BY nombre ASC
        ";
        return $this->_Read($query, []);
    }

    function lsProveedores() {
        $query = "
            SELECT idProveedor as id, nombreProveedor AS valor
            FROM {$this->bd}mtto_proveedores
            ORDER BY nombreProveedor ASC
        ";
        return $this->_Read($query, []);
    }

    // Materiales

    function listMateriales($filters) {
        $query = "
            SELECT 
                a.idAlmacen as id,
                a.CodigoEquipo,
                a.Equipo,
                a.cantidad,
                a.Costo,
                a.PrecioVenta,
                a.Estado,
                a.rutaImagen,
                a.inventario_min,
                a.Descripcion,
                a.FechaIngreso,
                ar.nombre_area as area,
                c.nombreCategoria as categoria,
                z.nombre_zona as zona,
                d.nombre as departamento,
                p.nombreProveedor as proveedor
            FROM {$this->bd}mtto_almacen a
            LEFT JOIN {$this->bd}mtto_almacen_area ar ON a.Area         = ar.idArea
            LEFT JOIN {$this->bd}mtto_categoria c     ON a.id_categoria = c.idcategoria
            LEFT JOIN {$this->bd}mtto_almacen_zona z  ON a.id_zona      = z.id_zona
            LEFT JOIN {$this->bd}departamento d       ON a.id_dpto      = d.id
            LEFT JOIN {$this->bd}mtto_proveedores p   ON a.id_Proveedor = p.idProveedor
            WHERE UDN_Almacen = ".$_SESSION['idUDN']."
        ";

        $params = [];

        if (!empty($filters['zona'])) {
            $query .= " AND a.id_zona = ?";
            $params[] = $filters['zona'];
        }

        if (!empty($filters['categoria'])) {
            $query .= " AND a.id_categoria = ?";
            $params[] = $filters['categoria'];
        }

        if (!empty($filters['area'])) {
            $query .= " AND a.Area = ?";
            $params[] = $filters['area'];
        }

        if (isset($filters['estado']) && $filters['estado'] !== '') {
            $query .= " AND a.Estado = ?";
            $params[] = $filters['estado'];
        }

        $query .= " ORDER BY a.idAlmacen DESC";

        return $this->_Read($query, $params);
    }

    function getMaterialById($id) {
        $query = "
            SELECT 
                a.*,
                ar.nombre_area as area_nombre,
                c.nombreCategoria as categoria_nombre,
                z.nombre_zona as zona_nombre,
                d.nombre as departamento_nombre,
                p.nombreProveedor as proveedor_nombre
            FROM {$this->bd}mtto_almacen a
            LEFT JOIN {$this->bd}mtto_almacen_area ar ON a.Area         = ar.idArea
            LEFT JOIN {$this->bd}mtto_categoria c     ON a.id_categoria = c.idcategoria
            LEFT JOIN {$this->bd}mtto_almacen_zona z  ON a.id_zona      = z.id_zona
            LEFT JOIN {$this->bd}departamento d       ON a.id_dpto      = d.id
            LEFT JOIN {$this->bd}mtto_proveedores p   ON a.id_Proveedor = p.idProveedor
            WHERE a.idAlmacen = ?
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }

    function existsMaterialByCode($array) {
        $query = "
            SELECT COUNT(*) as count
            FROM {$this->bd}mtto_almacen
            WHERE CodigoEquipo = ? AND Estado = 1
            AND UDN_Almacen = ".$_SESSION['idUDN']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['count'] > 0;
    }

    function getNextCodigoEquipo() {
        $query = "
            SELECT COALESCE(MAX(idAlmacen), 0) + 1 as next_id
            FROM {$this->bd}mtto_almacen
        ";
        $result = $this->_Read($query, []);
        $nextId = $result[0]['next_id'];
        return 'PRD-' . str_pad($nextId, 3, '0', STR_PAD_LEFT);
    }

    function createMaterial($data) {
        return $this->_Insert([
            'table'  => "{$this->bd}mtto_almacen",
            'values' => $data['values'],
            'data'   => $data['data']
        ]);
    }

    function updateMaterial($data) {
        return $this->_Update([
            'table'  => "{$this->bd}mtto_almacen",
            'values' => $data['values'],
            'where'  => $data['where'],
            'data'   => $data['data']
        ]);
    }

    function deleteMaterialById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}mtto_almacen",
            'where' => $array['where'],
            'data'  => $array['data']
        ]);
    }

    // Categorías

    function listCategorias() {
        $query = "
            SELECT 
                idcategoria as id,
                nombreCategoria,
                date_creation,
                active
            FROM {$this->bd}mtto_categoria
            ORDER BY nombreCategoria ASC
        ";
        return $this->_Read($query, []);
    }

    function getCategoriaById($id) {
        $query = "
            SELECT * FROM {$this->bd}mtto_categoria WHERE idcategoria = ?
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }

    function createCategoria($data) {
        return $this->_Insert([
            'table'  => "{$this->bd}mtto_categoria",
            'values' => $data['values'],
            'data'   => $data['data']
        ]);
    }

    function updateCategoria($data) {
        return $this->_Update([
            'table'  => "{$this->bd}mtto_categoria",
            'values' => $data['values'],
            'where'  => $data['where'],
            'data'   => $data['data']
        ]);
    }

    // Áreas

    function listAreas() {
        $query = "
            SELECT 
                idArea as id,
                nombre_area,
                date_creation,
                active
            FROM {$this->bd}mtto_almacen_area
            ORDER BY nombre_area ASC
        ";
        return $this->_Read($query, []);
    }

    function getAreaById($id) {
        $query = "
            SELECT * FROM {$this->bd}mtto_almacen_area WHERE idArea = ?
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }

    function createArea($data) {
        return $this->_Insert([
            'table'  => "{$this->bd}mtto_almacen_area",
            'values' => $data['values'],
            'data'   => $data['data']
        ]);
    }

    function updateArea($data) {
        return $this->_Update([
            'table'  => "{$this->bd}mtto_almacen_area",
            'values' => $data['values'],
            'where'  => $data['where'],
            'data'   => $data['data']
        ]);
    }

    // Zonas

    function listZonas() {
        $query = "
            SELECT 
                id_zona as id,
                nombre_zona,
                date_creation,
                active
            FROM {$this->bd}mtto_almacen_zona
            ORDER BY nombre_zona ASC
        ";
        return $this->_Read($query, []);
    }

    function getZonaById($id) {
        $query = "
            SELECT * FROM {$this->bd}mtto_almacen_zona WHERE id_zona = ?
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }

    function createZona($data) {
        return $this->_Insert([
            'table'  => "{$this->bd}mtto_almacen_zona",
            'values' => $data['values'],
            'data'   => $data['data']
        ]);
    }

    function updateZona($data) {
        return $this->_Update([
            'table'  => "{$this->bd}mtto_almacen_zona",
            'values' => $data['values'],
            'where'  => $data['where'],
            'data'   => $data['data']
        ]);
    }

    // Proveedores

    function listProveedores() {
        $query = "
            SELECT 
                idProveedor as id,
                nombreProveedor
            FROM {$this->bd}mtto_proveedores
            ORDER BY nombreProveedor ASC
        ";
        return $this->_Read($query, []);
    }

    function getProveedorById($id) {
        $query = "
            SELECT * FROM {$this->bd}mtto_proveedores WHERE idProveedor = ?
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }

    function createProveedor($data) {
        return $this->_Insert([
            'table'  => "{$this->bd}mtto_proveedores",
            'values' => $data['values'],
            'data'   => $data['data']
        ]);
    }

    function updateProveedor($data) {
        return $this->_Update([
            'table'  => "{$this->bd}mtto_proveedores",
            'values' => $data['values'],
            'where'  => $data['where'],
            'data'   => $data['data']
        ]);
    }
}
