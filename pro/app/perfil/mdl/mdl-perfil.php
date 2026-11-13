<?php
require_once __DIR__ . '/../../../core/database/_CRUD.php';
require_once __DIR__ . '/../../../core/helpers/_Utileria.php';

/*  El perfil junta dos cosas de la misma persona:
      users       la cuenta: nombre, correo, contraseña, foto y color
      employees   su ficha en Capital Humano: datos personales y de trabajo
    Todo se pide por el id del usuario de la sesion; aqui nadie edita a otro. */
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
                u.company_id,
                c.name AS company,
                e.id   AS employee_id,
                e.job_title,
                e.department,
                e.hire_date,
                e.birth_date,
                e.phone,
                e.address,
                e.emergency_name,
                e.emergency_phone,
                b.name AS employee_branch
            FROM {$this->bd}users u
            LEFT JOIN {$this->bd}companies c ON c.id = u.company_id
            LEFT JOIN {$this->bd}employees e ON e.user_id = u.id
            LEFT JOIN {$this->bd}branches b  ON b.id = e.branch_id
            WHERE u.id = ?
            LIMIT 1
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? null : $sql[0];
    }

    // [name, last_name, color, id]
    function updateAccount($array) {
        $query = "
            UPDATE {$this->bd}users
               SET name = ?, last_name = ?, color = ?, updated_at = NOW()
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

    // [user_id, company_id, branch_id]. La ficha de quien todavia no tenia:
    // nace vacia y la llena updatePersonal().
    function createEmployee($array) {
        $query = "
            INSERT INTO {$this->bd}employees (user_id, company_id, branch_id, created_at)
            VALUES (?, ?, ?, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    // [phone, birth_date, address, emergency_name, emergency_phone, user_id].
    // Solo lo personal: puesto, area e ingreso los lleva Capital Humano.
    function updatePersonal($array) {
        $query = "
            UPDATE {$this->bd}employees
               SET phone = ?, birth_date = ?, address = ?, emergency_name = ?, emergency_phone = ?, updated_at = NOW()
             WHERE user_id = ?
        ";
        return $this->_CUD($query, $array);
    }
}
?>
