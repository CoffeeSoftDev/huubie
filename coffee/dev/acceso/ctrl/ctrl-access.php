<?php
session_start();
if (empty($_POST['opc'])) exit(0);
$opc = $_POST['opc'];

require_once('../mdl/mdl-access.php');

class Access extends MAccess {
    function login() {
        $user = trim($_POST['usuario']);
        $pass = $_POST['password'];

        $usr = $this->getUserByCredentials([$user]);
        $valid = $usr && !empty($usr['password']) && password_verify($pass, $usr['password']);

        if (!$valid) {
            return [
                'status'  => 401,
                'message' => 'Usuario y/o contraseña incorrectos.'
            ];
        }

        $expira = time() + (365 * 24 * 60 * 60);
        setcookie("IDU", $usr['id'], $expira, "/");
        setcookie("company_id", $usr['company_id'], $expira, "/");

        $_SESSION['IDU']           = $usr['id'];
        $_SESSION['user_id']       = $usr['id'];
        $_SESSION['company_id']    = $usr['company_id'];
        $_SESSION['company']       = $usr['company'];
        $_SESSION['branch_id']     = $usr['branch_id'];
        $_SESSION['branch']        = $usr['branch'];
        $_SESSION['user']          = trim($usr['name'] . ' ' . $usr['last_name']);
        $_SESSION['is_owner']      = $usr['is_owner'];
        $_SESSION['last_activity'] = time();

        return [
            'status'  => 200,
            'message' => 'Bienvenido',
            'user'    => $_SESSION['user'],
            'company' => $usr['company'],
            'branch'  => $usr['branch']
        ];
    }
}

$obj = new Access();
echo json_encode($obj->$opc());
