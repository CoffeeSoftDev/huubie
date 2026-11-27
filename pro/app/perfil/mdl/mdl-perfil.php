<?php
require_once __DIR__ . '/../../../core/database/_CRUD.php';
require_once __DIR__ . '/../../../core/helpers/_Utileria.php';

/*  El perfil es la cuenta de la persona (users): nombre, correo, contraseña,
    foto, color y sus datos personales (telefono, cumpleaños, direccion y
    contacto de emergencia). Todo se pide por el id del usuario de la sesion;
    aqui nadie edita a otro. */
class mdl extends CRUD {
    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        // Sin prefijo: las tablas viven en la base del .env (DB_NAME).
        $this->bd   = '';
    }

    function getProfileByUser($array) {
        $query = "
            SELECT
                u.id,
                u.name,
                u.last_name,
                u.email,
                u.photo,
                u.color,
                u.password,
                u.phone,
                u.birth_date,
                u.address,
                u.emergency_name,
                u.emergency_phone,
                u.created_at,
                u.company_id,
                c.name AS company,
                b.name AS branch
            FROM {$this->bd}users u
            LEFT JOIN {$this->bd}companies c ON c.id = u.company_id
            LEFT JOIN {$this->bd}branches b  ON b.id = u.branch_id
            WHERE u.id = ?
            LIMIT 1
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? null : $sql[0];
    }

    // [name, last_name, color, phone, birth_date, address, emergency_name, emergency_phone, id]
    function updateAccount($array) {
        $query = "
            UPDATE {$this->bd}users
               SET name = ?, last_name = ?, color = ?,
                   phone = ?, birth_date = ?, address = ?, emergency_name = ?, emergency_phone = ?,
                   updated_at = NOW()
             WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // [photo, id]
    function updatePhoto($array) {
        $query = "UPDATE {$this->bd}users SET photo = ?, updated_at = NOW() WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    // [password bcrypt, id]
    function updatePassword($array) {
        $query = "UPDATE {$this->bd}users SET password = ?, updated_at = NOW() WHERE id = ?";
        return $this->_CUD($query, $array);
    }
}
?>
