<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *"); // Permite solicitudes de cualquier origen
header("Access-Control-Allow-Methods: GET, POST, OPTIONS"); // Métodos permitidos
header("Access-Control-Allow-Headers: Content-Type"); // Encabezados permitidos

require_once '../mdl/mdl-admin.php';
class User extends MUser{

    // Sin sesion el modulo no puede armar nada: la empresa y el usuario salen de
    // ella. Se corta aqui y se dice, en vez de seguir con los campos vacios.
    //
    // Antes las dos primeras lineas se protegian con isset() y las dos ultimas no,
    // asi que sin sesion `$_SESSION['COMPANY']` lanzaba un Notice. Ese aviso se
    // imprime ANTES del JSON y la respuesta deja de serlo: el navegador recibe
    // "<br /><font..." y falla con «Unexpected token '<'». La pantalla quedaba en
    // blanco sin decir que lo unico que pasaba era que la sesion no estaba.
    // Se pregunta por COMPANY, que es lo que este metodo usa, y no por USR: en el
    // mismo navegador puede haber una sesion de otro modulo —el facturador deja
    // `USR` sin ninguna de las claves de alpha— y preguntando por `USR` esa sesion
    // ajena pasaba el filtro para morir dos lineas mas abajo.
    function init(){
        if (empty($_SESSION['USR']) || !isset($_SESSION['COMPANY'])) {
            return [
                'status'  => 401,
                'message' => 'Tu sesion no es de este modulo. Vuelve a iniciar sesion.'
            ];
        }

        $id_subsidiarie = isset($_SESSION['SUB']) ? $_SESSION['SUB'] : 1;
        $id_company = isset($_SESSION['COMPANY_ID']) ? $_SESSION['COMPANY_ID'] : 1;

        return [
            'status'      => 200,
            'sucursal'    => $this -> lsSucursal([$id_company]),
            'rol'         => $this -> lsRol(),
            'companies'   => $this -> lsCompany([$_SESSION['USR']]),
            'nameCompany' => $_SESSION['COMPANY'] ?? '',
        ];

    }

    // Company
    function editPhotoCompany() {
        $status = 500;
        $message = 'Error al actualizar el logo de la empresa';

        $companyId = $_POST['id'];

        if (!isset($_FILES['logo']) || $_FILES['logo']['error'] != UPLOAD_ERR_OK) {
            return [
                'status' => 400,
                'message' => 'No se recibió ninguna imagen válida'
            ];
        }

        // Obtener datos anteriores
        $prevData = $this->getCompanyById($companyId);
        if (!empty($prevData['logo'])) {
            $oldFile = $_SERVER['DOCUMENT_ROOT'] . '/alpha' . $prevData['logo'];
            if (file_exists($oldFile)) {
                unlink($oldFile);
            }
        }

        // Guardar nueva imagen
        $ext = pathinfo($_FILES['logo']['name'], PATHINFO_EXTENSION);
        $fileName = "logoCompany" . $companyId . "_" . date('Ymd_His') . "." . $ext;
        $filePath = "../../src/img/logo/" . $fileName;
        $photoPath = "/src/img/logo/" . $fileName;

        if (!move_uploaded_file($_FILES['logo']['tmp_name'], $filePath)) {
            return [
                'status' => 500,
                'message' => 'No se pudo guardar la nueva imagen'
            ];
        }

        // Actualizar en la base de datos
        $data = [
            'logo' => $photoPath,
            'id' => $companyId,
        ];

        $update = $this->updateCompany($this->util->sql($data, 1));

        if ($update) {
            $status = 200;
            $message = 'Logo actualizado correctamente';
        }

        return [
            'status' => $status,
            'message' => $message
        ];
    }

    function deletePhotoCompany() {
        $status = 500;
        $message = 'Error al eliminar el logo de la empresa';

        $companyId = $_POST['id'];

        $prevData = $this->getCompanyById($companyId);
        if (!empty($prevData['logo'])) {
            $oldFile = $_SERVER['DOCUMENT_ROOT'] . '/alpha' . $prevData['logo'];
            if (file_exists($oldFile)) {
                unlink($oldFile);
            }
        }

        $data = [
            'logo' => '',
            'id'   => $companyId,
        ];

        $update = $this->updateCompany($this->util->sql($data, 1));

        if ($update) {
            $status = 200;
            $message = 'Logo eliminado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editCompany() {
        $status = 500;
        $message = 'Error al editar la empresa';

        // $update = $this->updateUser($this->util->sql($_POST, 1));
          $update = $this->updateCompany($this->util->sql($_POST, 1));


        if ($update) {
            $status = 200;
            $message = 'Empresa actualizada correctamente';
        }

        return [
            'status' => $status,
            'message' => $message
        ];
    }

    // Users
    function lsUsers(){
        $__row = [];
        $filterSucursal = !empty($_POST['filterSucursal']) ? $_POST['filterSucursal'] : null;
        $ls = $this->listUsers([$_POST['active'], $_POST['idCompany']], $filterSucursal);

        foreach ($ls as $user) {
            $a = [];

            if ($user['active'] == 1) {
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'usuarios.editar('.$user['id'].')'
                ];
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-500/15 hover:bg-red-500/25 text-red-400',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'usuarios.toggleStatus('.$user['id'].',0)'
                ];
            } else {
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-500/15 hover:bg-red-500/25 text-red-400',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'usuarios.toggleStatus('.$user['id'].',1)'
                ];
            }

            $__row[] = [
                'id'      => $user['id'],

                'Nombre'  => [
                    'html'  => userBadge($user['fullname'],'' ),
                    'class' => 'px-2'
                ],
                    'User'    => $user['user'],
                'Sucursal' => [
                    'html'  => subsidiaryBadges($user['sucursal']),
                    'class' => ''
                ],
                'Rol'     => [
                    'html'  => rolBadge($user['rols']),
                    'class' => ''
                ],
                'a'       => $a,
            ];
        }

        return [
            "row" => $__row,
            'ls'  => $ls,
        ];
    }

    function getUser(){

        $status = 500;
        $message = 'Error al obtener los datos ';
        $lsUser = $this->getUserByID([$_POST['id']]);

         if ($lsUser) {
            $status = 200;
            $message = 'Datos obtenidos correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $lsUser[0]
        ];
    }

    function addUser() {
        $status  = 500;
        $message = 'No se pudo insertar el usuario';

        // Normalizar a minúsculas antes de cualquier validación
        $user = strtolower(trim($_POST['user']));
        $_POST['user'] = $user;

        // Validar que sea un correo electrónico válido
        if (!filter_var($user, FILTER_VALIDATE_EMAIL)) {
            return [
                'status'  => 422,
                'message' => 'El usuario debe ser un correo electrónico válido (Ej. luis@huubie.com).'
            ];
        }

        // Validar que el correo no exista en toda la base de datos
        $exists = $this->existsUserByName([$user]);
        if ($exists) {
            return [
                'status' => 400,
                'message' => 'Este correo ya está registrado por otro usuario.'
            ];
        }

        // El modal manda las sucursales en un solo campo separado por comas. La primera
        // queda como sucursal de arranque de sesión y la lista completa va al pivote.
        $subsidiaries = array_values(array_filter(array_map('trim', explode(',', $_POST['subsidiaries_id'])), 'strlen'));

        if (empty($subsidiaries)) {
            return [
                'status'  => 422,
                'message' => 'Selecciona al menos una sucursal para el usuario.'
            ];
        }

        $__values = [
            $_POST['fullname'],
            date('Y-m-d H:i:s'),
            $_POST['usr_rols_id'],
            $user,
            $subsidiaries[0],
            $_POST['key'],
        ];
        // Crear el usuario
        $create = $this->createUser($__values, $subsidiaries);

        if ($create) {
            $status  = 200;
            $message = 'Usuario creado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
        ];
    }

    function editUser() {
        $group = null;
        $status = 500;
        $message = 'Error al editar';

        // Normalizar a minúsculas antes de cualquier validación
        $user = strtolower(trim($_POST['user']));
        $_POST['user'] = $user;

        // Validar que sea un correo electrónico válido
        if (!filter_var($user, FILTER_VALIDATE_EMAIL)) {
            return [
                'status'  => 422,
                'message' => 'El usuario debe ser un correo electrónico válido (Ej. luis@huubie.com).'
            ];
        }

        // Validar que el correo no exista en toda la base de datos (excluyendo al usuario actual)
        $exists = $this->existsOtherUserByName([$user, $_POST['id']]);
        if ($exists) {
            return [
                'status' => 400,
                'message' => 'Este correo ya está registrado por otro usuario.'
            ];
        }

        $edit = $this->updateUser($_POST);

        if ($edit == true) {
            $status = 200;
            $message = 'Se ha editado correctamente';
        }
        return [
            'status' => $status,
            'message' => $message,
        ];
    }

    function toggleStatusUser(){
        $status = 500;
        $message = 'Error al cambiar el estado del usuario';
        $delete = $this->deleteUsr($this->util->sql($_POST, 1));

        if ($delete == true) {
            $status = 200;
            $message = 'Ha cambiado exitosamente el estado del usuario.';
        }

        return [
            'status'  => $status,
            'message' => $message,
            $delete
        ];
    }

    // Sucursal.
    function lsSucursales() {
        $__row = [];
        $ls = $this->listSucursales([$_POST['active'], $_POST['idCompany']]);

        foreach ($ls as $key) {
            
            $a = [];

            if ($key['active'] == 1) {
                // Activa: permite editar y desactivar
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'sucursales.edit('.$key['id'].')'
                ];

                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-500/15 hover:bg-red-500/25 text-red-400',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'sucursales.toggleStatus('.$key['id'].',0)'
                ];
            } else {

                // Inactiva: solo opción de reactivar
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-500/15 hover:bg-red-500/25 text-red-400',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'sucursales.toggleStatus('.$key['id'].',1)'
                ];
            }

            $__row[] = [
                
                'id'             => $key['id'],
                'Empresa'        => $key['social_name'],
                'Sucursal'       => $key['name'],
                'Ubicación'      => $key['ubication'],
                'Fecha creación' => $key['date_creation'],
                'a'              => $a,
            ];
        }

        return [
            "row" => $__row,
            'ls'  => $ls,
        ];
    }

    function getSucursal() {
        $status = 500;
        $message = 'Error al obtener los datos';

        $data = $this->getSucursalById([$_POST['id']]);

        if ($data) {
            $status = 200;
            $message = 'Datos obtenidos correctamente.';
        }

        return [
            'status'   => $status,
            'message'  => $message,
            'data'     => $data[0],
        ];
    }

    function addSucursal() {
        $status                 = 500;
        $message                = 'No se pudo agregar la sucursal';
        $_POST['date_creation'] = date('Y-m-d H:i:s');
        $_POST['companies_id']  = $_SESSION['COMPANY_ID'];
        $_POST['active']        = 1; // Por defecto, la sucursal se crea activa

        // Validar que el nombre de la sucursal no exista
        $exists = $this->existsSucursalByName([$_POST['name'], $_SESSION['COMPANY_ID']]);
        if ($exists) {
            return [
                'status'  => 400,
                'message' => 'El nombre de la sucursal ya está en uso por otra sucursal.'
            ];
        }

        // Crear la sucursal
        $save = $this->createSucursal($this->util->sql($_POST));

        if ($save) {
            $status = 200;
            $message = 'Sucursal registrada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
        ];
    }

    function editSucursal() {
        $status = 500;
        $message = 'Error al editar';

        // Validar que el nombre de la sucursal no exista
        $exists = $this->existsOtherSucursalByName([$_POST['name'], $_POST['id'], $_SESSION['COM']]);
        if ($exists) {
            return [
                'status'  => 400,
                'message' => 'El nombre de la sucursal ya está en uso por otra sucursal.'
            ];
        }

        // Actualizar la sucursal
        $edit = $this->updateSucursal($this->util->sql($_POST, 1));

        if ($edit) {
            $status = 200;
            $message = 'Sucursal actualizada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
        ];
    }

    function toggleStatusSucursal() {
        $status = 500;
        $message = 'Error al cambiar el estado de la sucursal';

        $delete = $this->deleteSuc($this->util->sql($_POST, 1));

        if ($delete) {
            $status = 200;
            $message = 'Ha cambiado exitosamente el estado de la sucursal.';
        }

        return [
            'status'  => $status,
            'message' => $message,
        ];
    }

    // Clausulas
    function lsClausulas() {
        $__row = [];
        $ls = $this->listClausulas([$_POST['active'], $_POST['idCompany']]);

        foreach ($ls as $key) {
            $a = [];

            if ($key['active'] == 1) {
                // Activa: permite editar y desactivar
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'clausulas.edit('.$key['id'].')'
                ];

                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-500/15 hover:bg-red-500/25 text-red-400',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'clausulas.toggleStatus('.$key['id'].',0)'
                ];
            } else {
                // Inactiva: solo opción de reactivar
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-500/15 hover:bg-red-500/25 text-red-400',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'clausulas.toggleStatus('.$key['id'].',1)'
                ];
            }

            $__row[] = [
                'id'       => $key['id'],
                'Nombre'   => $key['name'],
                // 'Empresa'  => $key['social_name'],
                'Fecha creación' => $key['date_creation'],
                'a'        => $a,
            ];
        }

        return [
            "row" => $__row,
            'ls'  => $ls,
        ];
    }

    function getClausula() {
        $status = 500;
        $message = 'Error al obtener los datos';

        $data = $this->getClausulaById([$_POST['id']]);

        if ($data) {
            $status = 200;
            $message = 'Datos obtenidos correctamente.';
        }

        return [
            'status'   => $status,
            'message'  => $message,
            'data'     => $data[0],
        ];
    }

    function addClausula() {
        $status  = 500;
        $message = 'No se pudo agregar la cláusula';
        $_POST['date_creation'] = date('Y-m-d H:i:s');
        $_POST['companies_id']  = $_SESSION['COMPANY_ID'];

        // Validar que el nombre de la cláusula no exista
        $exists = $this->existsClausulaByName([$_POST['name'], $_POST['companies_id']]);
        if ($exists) {
            return [
                'status'  => 400,
                'message' => 'El nombre de la cláusula ya está en uso por otra cláusula.'
            ];
        }

        // Crear la cláusula
        $save = $this->createClausula($this->util->sql($_POST));

        if ($save) {
            $status = 200;
            $message = 'Cláusula registrada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
             $_SESSION['COM']   
        ];
    }

    function editClausula() {
        $status = 500;
        $message = 'Error al editar';

        // Validar que el nombre de la cláusula no exista
        $exists = $this->existsOtherClausulaByName([$_POST['name'], $_POST['id'], $_SESSION['COM']]);
        if ($exists) {
            return [
                'status'  => 400,
                'message' => 'El nombre de la cláusula ya está en uso por otra cláusula.'
            ];
        }
        // Actualizar la cláusula
        $edit = $this->updateClausula($this->util->sql($_POST, 1));

        if ($edit) {
            $status = 200;
            $message = 'Cláusula actualizada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
        ];
    }

    function toggleStatusClausula() {
        $status = 500;
        $message = 'Error al cambiar el estado de la cláusula';

        $delete = $this->deleteClausula($this->util->sql($_POST, 1));

        if ($delete) {
            $status = 200;
            $message = 'Ha cambiado exitosamente el estado de la cláusula.';
        }

        return [
            'status'  => $status,
            'message' => $message,
        ];
    }

}

// Complements

function userBadge($fullname, $sucursal) {
    $colors = [
        'bg-gradient-to-br from-blue-400 to-blue-600',
        'bg-gradient-to-br from-emerald-400 to-emerald-600',
        'bg-gradient-to-br from-purple-400 to-purple-600',
        'bg-gradient-to-br from-rose-400 to-rose-600',
        'bg-gradient-to-br from-amber-400 to-amber-600',
        'bg-gradient-to-br from-cyan-400 to-cyan-600',
        'bg-gradient-to-br from-indigo-400 to-indigo-600',
        'bg-gradient-to-br from-teal-400 to-teal-600'
    ];

    $parts = explode(' ', trim($fullname));
    $initials = strtoupper(substr($parts[0], 0, 1));
    if (count($parts) > 1) {
        $initials .= strtoupper(substr(end($parts), 0, 1));
    }

    $colorIndex = crc32($fullname) % count($colors);
    $bgColor = $colors[abs($colorIndex)];

    return '<div class="flex items-center gap-3">'
         . '<div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ' . $bgColor . '">'
         . $initials
         . '</div>'
         . '<div>'
         . '<div class="text-sm font-semibold text-white">' . $fullname . '</div>'
         . '<div class="text-xs text-gray-400">' . $sucursal . '</div>'
         . '</div>'
         . '</div>';
}

function subsidiaryBadges($sucursales) {
    if (empty($sucursales)) {
        return '<span class="text-xs text-gray-500">Sin sucursal</span>';
    }

    $html = '';

    foreach (explode(',', $sucursales) as $sucursal) {
        $sucursal = trim($sucursal);

        if ($sucursal !== '') {
            $html .= '<span class="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full bg-gray-500/15 text-gray-300 me-1 mb-1">'
                   . $sucursal
                   . '</span>';
        }
    }

    return $html;
}

function rolBadge($rol) {
    $map = [
        'Administrador' => 'bg-purple-500/15 text-purple-300',
        'Supervisor'    => 'bg-indigo-500/15 text-indigo-300',
        'Cajero'        => 'bg-cyan-500/15 text-cyan-300',
        'Vendedor'      => 'bg-emerald-500/15 text-emerald-300',
        'Lectura'       => 'bg-slate-500/15 text-slate-300',
    ];

    $colors = $map[$rol] ?? 'bg-gray-500/15 text-gray-300';

    return '<span class="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ' . $colors . '">'
         . $rol
         . '</span>';
}

    $obj    = new User();
    $fn     = $_POST['opc'];
    $encode = [];
    $encode = $obj->$fn();
    echo json_encode($encode);
?>
