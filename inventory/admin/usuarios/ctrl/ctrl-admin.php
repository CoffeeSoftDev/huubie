<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-admin.php';

class ctrl extends mdl {

    function init() {
        return [
            'status' => $this->lsStatusFilter()
        ];
    }

    function lsUsers() {
        $__row = [];
        $active = $_POST['active'];
        $ls = $this->listUsers([$active]);

        foreach ($ls as $key) {
            $a = [];

            if ($key['usr_estado'] == 1) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'users.editUser(' . $key['idUser'] . ')'
                ];

                $a[] = [
                    'class'   => 'btn btn-sm btn-info me-1',
                    'html'    => '<i class="icon-user-plus"></i>',
                    'onclick' => 'users.assignProfile(' . $key['idUser'] . ')'
                ];

                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-trash"></i>',
                    'onclick' => 'users.deleteUser(' . $key['idUser'] . ')'
                ];

            } else {

                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-success',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'users.activateUser(' . $key['idUser'] . ')'
                ];
            }

            $__row[] = [
                'id'           => $key['idUser'],
                'Usuario'      => $key['usser'],
                'Colaborador'  => $key['usr_Colaborador'],
                'Estado'       => renderStatus($key['usr_estado']),
                'Creación'     => $key['creacion'],
                'Activación'   => $key['activacion'] ?? 'Nunca',
                'a'            => $a
            ];
        }

        return [
            'row' => $__row,
            'ls'  => $ls
        ];
    }

    function getUser() {
        $status = 500;
        $message = 'Error al obtener los datos';
        $getUser = $this->getUserById([$_POST['idUser']]);

        if ($getUser) {
            $status = 200;
            $message = 'Datos obtenidos correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $getUser
        ];
    }

    function addUser() {
        $status = 500;
        $message = 'No se pudo agregar el usuario';
        
        $_POST['creacion'] = date('Y-m-d H:i:s');
        $_POST['usr_estado'] = 1;
        $_POST['key2'] = password_hash($_POST['key'], PASSWORD_BCRYPT);

        $exists = $this->existsUserByUsername([$_POST['usser']]);

        if (!$exists) {
            $create = $this->createUser($this->util->sql($_POST));
            if ($create) {
                $status = 200;
                $message = 'Usuario agregado correctamente';
            }
        } else {
            $status = 409;
            $message = 'Ya existe un usuario con ese nombre.';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editUser() {
        $idUser = $_POST['idUser'];
        $status = 500;
        $message = 'Error al editar usuario';

        if (isset($_POST['key']) && !empty($_POST['key'])) {
            $_POST['key2'] = password_hash($_POST['key'], PASSWORD_BCRYPT);
        } else {
            unset($_POST['key']);
            unset($_POST['key2']);
        }

        $edit = $this->updateUser($this->util->sql($_POST, 1));

        if ($edit) {
            $status = 200;
            $message = 'Usuario editado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function deleteUser() {
        $status = 500;
        $message = 'Error al eliminar el usuario';

        $values = $this->util->sql(['idUser' => $_POST['idUser']], 1);
        $delete = $this->deleteUserById($values);

        if ($delete) {
            $status = 200;
            $message = 'Usuario eliminado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function lsProfiles() {
        $__row = [];
        $active = $_POST['active'];
        $ls = $this->listProfiles([$active]);

        foreach ($ls as $key) {
            $a = [];

            if ($key['perfil_estado'] == 1) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'profiles.editProfile(' . $key['idPerfil'] . ')'
                ];

                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'profiles.statusProfile(' . $key['idPerfil'] . ', ' . $key['perfil_estado'] . ')'
                ];
            } else {
                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-success',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'profiles.statusProfile(' . $key['idPerfil'] . ', ' . $key['perfil_estado'] . ')'
                ];
            }

            $__row[] = [
                'id'       => $key['idPerfil'],
                'Nombre'   => $key['perfil'],
                'Estado'   => renderStatus($key['perfil_estado']),
                'Creación' => $key['f_creacion'],
                'a'        => $a
            ];
        }

        return [
            'row' => $__row,
            'ls'  => $ls
        ];
    }

    function getProfile() {
        $status = 500;
        $message = 'Error al obtener los datos';
        $getProfile = $this->getProfileById([$_POST['idPerfil']]);

        if ($getProfile) {
            $status = 200;
            $message = 'Datos obtenidos correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $getProfile
        ];
    }

    function addProfile() {
        $status = 500;
        $message = 'No se pudo agregar el perfil';
        
        $_POST['f_creacion'] = date('Y-m-d H:i:s');
        $_POST['perfil_estado'] = 1;

        $create = $this->createProfile($this->util->sql($_POST));
        
        if ($create) {
            $status = 200;
            $message = 'Perfil agregado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editProfile() {
        $status = 500;
        $message = 'Error al editar perfil';

        $edit = $this->updateProfile($this->util->sql($_POST, 1));

        if ($edit) {
            $status = 200;
            $message = 'Perfil editado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function statusProfile() {
        $status = 500;
        $message = 'No se pudo actualizar el estado del perfil';

        $update = $this->updateProfile($this->util->sql($_POST, 1));

        if ($update) {
            $status = 200;
            $message = 'El estado del perfil se actualizó correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function lsUDN() {
        $__row = [];
        $active = $_POST['active'];
        $ls = $this->listUDN([$active]);

        foreach ($ls as $key) {
            $a = [];

            if ($key['Stado'] == 1) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'udn.editUDN(' . $key['idUDN'] . ')'
                ];

                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-trash"></i>',
                    'onclick' => 'udn.deleteUDN(' . $key['idUDN'] . ')'
                ];
            } else {
                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-success',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'udn.activateUDN(' . $key['idUDN'] . ')'
                ];
            }

            $__row[] = [
                'id'          => $key['idUDN'],
                'Nombre'      => $key['UDN'],
                'Abreviatura' => $key['Abreviatura'],
                'Antigüedad'  => $key['Antiguedad'],
                'Estado'      => renderStatus($key['Stado']),
                'a'           => $a
            ];
        }

        return [
            'row' => $__row,
            'ls'  => $ls
        ];
    }

    function getUDN() {
        $status = 500;
        $message = 'Error al obtener los datos';
        $getUDN = $this->getUDNById([$_POST['idUDN']]);

        if ($getUDN) {
            $status = 200;
            $message = 'Datos obtenidos correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $getUDN
        ];
    }

    function addUDN() {
        $status = 500;
        $message = 'No se pudo agregar la unidad de negocio';
        
        $_POST['Stado'] = 1;

        $create = $this->createUDN($this->util->sql($_POST));
        
        if ($create) {
            $status = 200;
            $message = 'Unidad de negocio agregada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editUDN() {
        $status = 500;
        $message = 'Error al editar unidad de negocio';

        $edit = $this->updateUDN($this->util->sql($_POST, 1));

        if ($edit) {
            $status = 200;
            $message = 'Unidad de negocio editada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function deleteUDN() {
        $status = 500;
        $message = 'Error al eliminar la unidad de negocio';

        $values = $this->util->sql(['idUDN' => $_POST['idUDN']], 1);
        $delete = $this->deleteUDNById($values);

        if ($delete) {
            $status = 200;
            $message = 'Unidad de negocio eliminada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function assignProfile() {
        $status = 500;
        $message = 'Error al asignar perfil';

        $_POST['assigned_date'] = date('Y-m-d H:i:s');
        $assign = $this->assignProfileToUser($this->util->sql($_POST));

        if ($assign) {
            $status = 200;
            $message = 'Perfil asignado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function removeProfile() {
        $status = 500;
        $message = 'Error al remover perfil';

        $values = $this->util->sql([
            'user_id' => $_POST['user_id'],
            'profile_id' => $_POST['profile_id']
        ], 1);
        
        $remove = $this->removeProfileFromUser($values);

        if ($remove) {
            $status = 200;
            $message = 'Perfil removido correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function getUserProfiles() {
        $profiles = $this->getUserProfile([$_POST['idUser']]);

        return [
            'status' => 200,
            'data'   => $profiles
        ];
    }
}

// Complements

function renderStatus($status) {
    switch ($status) {
        case 1:
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#014737] text-[#3FC189]">Activo</span>';
        case 0:
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#721c24] text-[#ba464d]">Inactivo</span>';
        default:
            return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-gray-500 text-white">Desconocido</span>';
    }
}

$obj = new ctrl();
$fn = $_POST['opc'];
$encode = $obj->$fn();
echo json_encode($encode);
