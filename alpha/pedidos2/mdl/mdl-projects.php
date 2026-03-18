<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');
session_start();

class mdl extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = "{$_SESSION['DB']}.";
    }

    function listProjects($array) {
        return $this->_Select([
            'table'  => "{$this->bd}projects",
            'values' => [
                'id',
                'name',
                'size',
                'status',
                "DATE_FORMAT(date_creation, '%Y-%m-%d %H:%i') as date_creation",
                "DATE_FORMAT(date_updated, '%Y-%m-%d %H:%i') as date_updated",
                'subsidiaries_id'
            ],
            'where'  => 'status = ?',
            'order'  => ['DESC' => 'date_creation'],
            'data'   => $array
        ]);
    }

    function getProjectById($array) {
        return $this->_Select([
            'table'  => "{$this->bd}projects",
            'values' => '*',
            'where'  => 'id = ?',
            'data'   => $array
        ])[0] ?? null;
    }

    function createProject($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}projects",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateProject($array) {
        return $this->_Update([
            'table'  => "{$this->bd}projects",
            'values' => $array['values'],
            'where'  => 'id = ?',
            'data'   => $array['data']
        ]);
    }

    function deleteProject($array) {
        return $this->_Delete([
            'table' => "{$this->bd}projects",
            'where' => 'id = ?',
            'data'  => $array
        ]);
    }

    function getProjectsByStatus($array) {
        return $this->_Select([
            'table'  => "{$this->bd}projects",
            'values' => '*',
            'where'  => 'status = ? AND subsidiaries_id = ?',
            'order'  => ['DESC' => 'date_creation'],
            'data'   => $array
        ]);
    }

    function getProjectsBySize($array) {
        return $this->_Select([
            'table'  => "{$this->bd}projects",
            'values' => '*',
            'where'  => 'size LIKE ? AND subsidiaries_id = ?',
            'order'  => ['DESC' => 'date_creation'],
            'data'   => $array
        ]);
    }

    function countProjectsByStatus($array) {
        $query = "
            SELECT 
                status,
                COUNT(*) as total
            FROM {$this->bd}projects
            WHERE subsidiaries_id = ?
            GROUP BY status
        ";
        return $this->_Read($query, $array);
    }
}
?>
