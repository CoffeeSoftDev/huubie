<?php

require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';

class mdl extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd = "fayxzvov_erp.";
    }

    function listUsers($array) {
        $query = "
            SELECT 
                idUser,
                usser,
                usr_Colaborador,
                usr_estado,
                usr_udn,
                DATE_FORMAT(creacion, '%d/%m/%Y') as creacion,
                DATE_FORMAT(activacion, '%d/%m/%Y %H:%i') as activacion
            FROM {$this->bd}usuarios
            WHERE usr_estado = ?
            ORDER BY idUser DESC
        ";
        return $this->_Read($query, $array);
    }

    function getUserById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}usuarios
            WHERE idUser = ?
        ";
        return $this->_Read($query, $array)[0];
    }

    function existsUserByUsername($array) {
        $query = "
            SELECT idUser
            FROM {$this->bd}usuarios
            WHERE LOWER(usser) = LOWER(?)
            AND usr_estado = 1
        ";
        $exists = $this->_Read($query, $array);
        return count($exists) > 0;
    }

    function createUser($array) {
        return $this->_Insert([
            'table'  => $this->bd . 'usuarios',
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateUser($array) {
        return $this->_Update([
            'table'  => $this->bd . 'usuarios',
            'values' => $array['values'],
            'where'  => 'idUser = ?',
            'data'   => $array['data']
        ]);
    }

    function deleteUserById($array) {
        return $this->_Delete([
            'table' => $this->bd . 'usuarios',
            'where' => $array['where'],
            'data'  => $array['data']
        ]);
    }

    function listProfiles($array) {
        $query = "
            SELECT 
                idPerfil,
                perfil,
                perfil_estado,
                DATE_FORMAT(f_creacion, '%d/%m/%Y') as f_creacion
            FROM {$this->bd}perfiles
            WHERE perfil_estado = ?
            ORDER BY idPerfil DESC
        ";
        return $this->_Read($query, $array);
    }

    function getProfileById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}perfiles
            WHERE idPerfil = ?
        ";
        return $this->_Read($query, $array)[0];
    }

    function createProfile($array) {
        return $this->_Insert([
            'table'  => $this->bd . 'perfiles',
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateProfile($array) {
        return $this->_Update([
            'table'  => $this->bd . 'perfiles',
            'values' => $array['values'],
            'where'  => 'idPerfil = ?',
            'data'   => $array['data']
        ]);
    }

    function listUDN($array) {
        $query = "
            SELECT 
                idUDN,
                UDN,
                Abreviatura,
                Stado,
                Antiguedad
            FROM {$this->bd}udn
            WHERE Stado = ?
            ORDER BY idUDN DESC
        ";
        return $this->_Read($query, $array);
    }

    function getUDNById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}udn
            WHERE idUDN = ?
        ";
        return $this->_Read($query, $array)[0];
    }

    function createUDN($array) {
        return $this->_Insert([
            'table'  => $this->bd . 'udn',
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateUDN($array) {
        return $this->_Update([
            'table'  => $this->bd . 'udn',
            'values' => $array['values'],
            'where'  => 'idUDN = ?',
            'data'   => $array['data']
        ]);
    }

    function deleteUDNById($array) {
        return $this->_Delete([
            'table' => $this->bd . 'udn',
            'where' => $array['where'],
            'data'  => $array['data']
        ]);
    }

    function assignProfileToUser($array) {
        return $this->_Insert([
            'table'  => $this->bd . 'user_profiles',
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function removeProfileFromUser($array) {
        return $this->_Delete([
            'table' => $this->bd . 'user_profiles',
            'where' => $array['where'],
            'data'  => $array['data']
        ]);
    }

    function getUserProfile($array) {
        $query = "
            SELECT 
                p.idPerfil,
                p.perfil,
                u.usser,
                u.usr_perfil
            FROM {$this->bd}usuarios u
            LEFT JOIN {$this->bd}perfiles p ON u.usr_perfil = p.idPerfil
            WHERE u.idUser = ?
        ";
        return $this->_Read($query, $array);
    }

    function lsStatusFilter() {
        return [
            ['id' => '1', 'valor' => 'Activos'],
            ['id' => '0', 'valor' => 'Inactivos']
        ];
    }
}
