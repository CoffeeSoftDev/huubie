<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {
    protected $util;

    public function __construct() {
        $this->util = new Utileria;
    }
    
    // 💁‍♀️ USUARIO ---------------------
    function getUserById($id) {
        $leftjoin = [
            'usr_rols AS r' => 'u.usr_rols_id = r.id',
            'subsidiaries AS s' => 'u.subsidiaries_id = s.id',
            'fayxzvov_admin.companies AS c'=> 's.companies_id = c.id'
        ];
        $values = "
            u.id, u.user, u.phone, u.active, u.subsidiaries_id, u.photo, u.fullname, 
            DATE_FORMAT(u.date_creation, '%d %M %Y') as date_creation, 
            birthday, r.rols AS rol, s.name AS subsidiary, c.social_name AS company, s.ubication
        ";
        return $this->_Select([
            'table' => 'usr_users AS u',
            'values' => $values,
            'leftjoin' => $leftjoin,
            'where' => 'u.id = ?',
            'data' => [$id]
        ])[0];
    }

    function existsOtherUserByName($array) {
        $res = $this->_Select([
            'table' => 'usr_users',
            'values' => 'id',
            'where' => 'LOWER(user) = LOWER(?) AND id != ? AND (active = 1 OR enabled = 1)',
            'data' => $array
        ]);
        return count($res) <= 0; // TRUE si no hay otro con ese nombre
    }

    function updateUser($array) {
        return $this->_Update([
            'table' => 'usr_users',
            'values' => $array['values'],
            'where' => $array['where'],
            'data' => $array['data']
        ]);
    }
}
