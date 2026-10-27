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

    // -- Sucursal --

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
    //
    // Del lado de la empresa viajan tambien el lema y su domicilio fiscal: son dos
    // renglones del membrete que no son de la sucursal, la cual aporta su direccion
    // como LUGAR DE EXPEDICION.
    //
    // Viaja ademas el punto de venta con el que opera la sucursal: el JOIN es LEFT
    // porque una sucursal puede no tenerlo capturado todavia y el emisor igual debe
    // poder imprimirse.
    function getEmisor($array) {
        $query = "
            SELECT b.id, b.business_name, b.logo, b.rfc, b.fiscal_address, b.phone, b.company_id,
                   b.adjustment_tolerance,
                   c.business_name AS company_name, c.rfc AS company_rfc,
                   c.fiscal_address AS company_address, c.phone AS company_phone,
                   b.pos_id, p.name AS pos_name, p.code AS pos_code, p.color AS pos_color
            FROM {$this->bd}branch b
            LEFT JOIN {$this->bd}company c ON c.id = b.company_id
            LEFT JOIN {$this->bd}pos     p ON p.id = b.pos_id
            WHERE b.id <=> ?
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    // -- Punto de venta --

    // Catalogo de sistemas de punto de venta (Soft Restaurant / Wansoft). Sale con
    // el alias `valor` porque asi lo consume el select del formulario, y con el
    // color para que la pantalla pinte cada sistema sin tener la paleta escrita.
    function lsPos() {
        $query = "
            SELECT id, name AS valor, code, color
            FROM {$this->bd}pos
            WHERE active = 1
            ORDER BY name ASC
        ";
        return $this->_Read($query);
    }

    function updateBranch($array) {
        return $this->_Update([
            'table'  => "{$this->bd}branch",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    // El membrete se guarda en dos tablas: el formulario del emisor es uno solo,
    // pero el lema y el domicilio fiscal viven en la empresa.
    function updateCompany($array) {
        return $this->_Update([
            'table'  => "{$this->bd}company",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }
}
