<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-config.php';
// require_once '../../conf/coffeSoft.php';

class ctrl extends mdl {

    function init() {
        $lsCustomers = $this->lsCustomers();
        $lsCompanies = $this->lsCompanies();
        $lsModules   = $this->lsModules();

        return [
            'customers' => $lsCustomers,
            'companies' => $lsCompanies,
            'modules'   => $lsModules
        ];
    }

    // Companies
    function lsCompanies() {
        $__row = [];
        $ls = $this->listCompanies([$_POST['enabled']??1]);

        foreach ($ls as $company) {
            $a = [];

            if ($company['enabled'] == 1) {
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'companies.edit(' . $company['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30 me-1',
                    'html'    => '<i class="icon-link"></i>',
                    'onclick' => 'companies.showModules(' . $company['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'companies.toggleStatus(' . $company['id'] . ',0)'
                ];
            } else {
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'companies.toggleStatus(' . $company['id'] . ',1)'
                ];
            }

            $__row[] = [
                'id'       => $company['id'],
                'Empresa'  => $company['social_name'],
                'RFC'      => $company['rfc'],
                'Ubicación' => $company['ubication'],
                'Cliente'  => $company['customer_name'],
                'BD'       => [
                    'html'  => dbBadge($company['name_bd']),
                    'class' => ''
                ],
                'a'        => $a,
            ];
        }

        return ['row' => $__row, 'thead' => ''];
    }

    function getCompany() {
        $status = 500;
        $message = 'Error al obtener los datos';
        $getData = $this->getCompanyById([$_POST['id']]);

        if ($getData) {
            $status = 200;
            $message = 'Datos obtenidos correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $getData[0]
        ];
    }

    function addCompany() {
        $status = 500;
        $message = 'No se pudo agregar la empresa';

        $exists = $this->existsCompanyByName([$_POST['social_name']]);
        if ($exists) {
            return [
                'status'  => 409,
                'message' => 'Ya existe una empresa con ese nombre.'
            ];
        }

        $_POST['enabled'] = 1;
        $create = $this->createCompany($this->util->sql($_POST));

        if ($create) {
            $status = 200;
            $message = 'Empresa agregada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editCompany() {
        $status = 500;
        $message = 'Error al editar la empresa';

        $exists = $this->existsOtherCompanyByName([$_POST['social_name'], $_POST['id']]);
        if ($exists) {
            return [
                'status'  => 409,
                'message' => 'Ya existe otra empresa con ese nombre.'
            ];
        }

        $edit = $this->updateCompany($this->util->sql($_POST, 1));

        if ($edit) {
            $status = 200;
            $message = 'Empresa actualizada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function toggleStatusCompany() {
        $status = 500;
        $message = 'Error al cambiar el estado de la empresa';

        $update = $this->updateCompany($this->util->sql($_POST, 1));

        if ($update) {
            $status = 200;
            $message = 'Estado de la empresa actualizado correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Customers
    function lsCustomers() {
        $__row = [];
        $ls = $this->listCustomers([$_POST['enabled']??1]);

        foreach ($ls as $customer) {
            $a = [];

            if ($customer['enabled'] == 1) {
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'customers.edit(' . $customer['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'customers.toggleStatus(' . $customer['id'] . ',0)'
                ];
            } else {
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'customers.toggleStatus(' . $customer['id'] . ',1)'
                ];
            }

            $__row[] = [
                'id'       => $customer['id'],
                'Nombre'   => [
                    'html'  => userBadge($customer['full_name'], ''),
                    'class' => 'px-2'
                ],
                'Apellido Paterno' => $customer['paternal_surname'],
                'Apellido Materno' => $customer['maternal_surname'],
                'a'        => $a,
            ];
        }

        return ['row' => $__row, 'thead' => ''];
    }

    function getCustomer() {
        $status = 500;
        $message = 'Error al obtener los datos';
        $getData = $this->getCustomerById([$_POST['id']]);

        if ($getData) {
            $status = 200;
            $message = 'Datos obtenidos correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $getData[0]
        ];
    }

    function addCustomer() {
        $status = 500;
        $message = 'No se pudo agregar el cliente';

        $_POST['full_name'] = trim($_POST['name'] . ' ' . $_POST['paternal_surname'] . ' ' . $_POST['maternal_surname']);

        $exists = $this->existsCustomerByName([$_POST['full_name']]);
        if ($exists) {
            return [
                'status'  => 409,
                'message' => 'Ya existe un cliente con ese nombre.'
            ];
        }

        $_POST['enabled'] = 1;
        $create = $this->createCustomer($this->util->sql($_POST));

        if ($create) {
            $status = 200;
            $message = 'Cliente agregado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editCustomer() {
        $status = 500;
        $message = 'Error al editar el cliente';

        $_POST['full_name'] = trim($_POST['name'] . ' ' . $_POST['paternal_surname'] . ' ' . $_POST['maternal_surname']);

        $exists = $this->existsOtherCustomerByName([$_POST['full_name'], $_POST['id']]);
        if ($exists) {
            return [
                'status'  => 409,
                'message' => 'Ya existe otro cliente con ese nombre.'
            ];
        }

        $edit = $this->updateCustomer($this->util->sql($_POST, 1));

        if ($edit) {
            $status = 200;
            $message = 'Cliente actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function toggleStatusCustomer() {
        $status = 500;
        $message = 'Error al cambiar el estado del cliente';

        $update = $this->updateCustomer($this->util->sql($_POST, 1));

        if ($update) {
            $status = 200;
            $message = 'Estado del cliente actualizado correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Modules
    function lsModules() {
        $__row = [];
        $ls = $this->listModules();

        foreach ($ls as $module) {
            $__row[] = [
                'id'          => $module['id'],
                'Módulo'      => $module['name'],
                'Nickname'    => $module['nickname'],
                'Ruta'        => $module['route'],
                'Descripción' => $module['description'],
                'a'           => actionButtonsModule($module['id']),
            ];
        }

        return ['row' => $__row, 'thead' => ''];
    }

    function getModule() {
        $status = 500;
        $message = 'Error al obtener los datos';
        $getData = $this->getModuleById([$_POST['id']]);

        if ($getData) {
            $status = 200;
            $message = 'Datos obtenidos correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $getData[0]
        ];
    }

    function addModule() {
        $status = 500;
        $message = 'No se pudo agregar el módulo';

        $create = $this->createModule($this->util->sql($_POST));

        if ($create) {
            $status = 200;
            $message = 'Módulo agregado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editModule() {
        $status = 500;
        $message = 'Error al editar el módulo';

        $edit = $this->updateModule($this->util->sql($_POST, 1));

        if ($edit) {
            $status = 200;
            $message = 'Módulo actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function deleteModule() {
        $status = 500;
        $message = 'Error al eliminar el módulo';

        $values = $this->util->sql(['id' => $_POST['id']], 1);
        $delete = $this->deleteModuleById($values);

        if ($delete) {
            $status = 200;
            $message = 'Módulo eliminado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Module-Company
    function lsModuleCompany() {
        $__row = [];
        $ls = $this->listModulesByCompany([$_POST['company_id']]);

        foreach ($ls as $mc) {
            $__row[] = [
                'id'          => $mc['id'],
                'Módulo'      => $mc['module_name'],
                'Nickname'    => $mc['nickname'],
                'Ruta'        => $mc['route'],
                'Descripción' => $mc['description'],
                'a'           => actionButtonsUnlink($mc['id']),
            ];
        }

        return ['row' => $__row, 'thead' => ''];
    }

    function addModuleCompany() {
        $status = 500;
        $message = 'No se pudo vincular el módulo';

        $exists = $this->existsModuleCompany([$_POST['module_id'], $_POST['company_id']]);
        if ($exists) {
            return [
                'status'  => 409,
                'message' => 'Este módulo ya está vinculado a la empresa.'
            ];
        }

        $create = $this->createModuleCompany($this->util->sql($_POST));

        if ($create) {
            $status = 200;
            $message = 'Módulo vinculado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function deleteModuleCompany() {
        $status = 500;
        $message = 'Error al desvincular el módulo';

        $values = $this->util->sql(['id' => $_POST['id']], 1);
        $delete = $this->deleteModuleCompanyById($values);

        if ($delete) {
            $status = 200;
            $message = 'Módulo desvinculado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Admin Users
    function lsAdminUsers() {
        $__row = [];
        $ls = $this->listAdminUsers([$_POST['enabled']]);

        foreach ($ls as $adminUser) {
            $a = [];

            if ($adminUser['enabled'] == 1) {
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'adminUsers.edit(' . $adminUser['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'adminUsers.toggleStatus(' . $adminUser['id'] . ',0)'
                ];
            } else {
                $a[] = [
                    'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'adminUsers.toggleStatus(' . $adminUser['id'] . ',1)'
                ];
            }

            $__row[] = [
                'id'       => $adminUser['id'],
                'Usuario'  => [
                    'html'  => userBadge($adminUser['user'], $adminUser['name_database']),
                    'class' => 'px-2'
                ],
                'Base de datos' => [
                    'html'  => dbBadge($adminUser['name_database']),
                    'class' => ''
                ],
                'Cliente'  => $adminUser['customer_name'],
                'a'        => $a,
            ];
        }

        return ['row' => $__row, 'thead' => ''];
    }

    function getAdminUser() {
        $status = 500;
        $message = 'Error al obtener los datos';
        $getData = $this->getAdminUserById([$_POST['id']]);

        if ($getData) {
            $status = 200;
            $message = 'Datos obtenidos correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $getData[0]
        ];
    }

    function addAdminUser() {
        $status = 500;
        $message = 'No se pudo agregar el usuario';

        $exists = $this->existsAdminUserByName([$_POST['user']]);
        if ($exists) {
            return [
                'status'  => 409,
                'message' => 'Ya existe un usuario con ese nombre.'
            ];
        }

        $_POST['enabled'] = 1;
        $_POST['active'] = 0;
        $_POST['key'] = md5($_POST['key']);
        $create = $this->createAdminUser($this->util->sql($_POST));

        if ($create) {
            $status = 200;
            $message = 'Usuario agregado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editAdminUser() {
        $status = 500;
        $message = 'Error al editar el usuario';

        $exists = $this->existsOtherAdminUserByName([$_POST['user'], $_POST['id']]);
        if ($exists) {
            return [
                'status'  => 409,
                'message' => 'Ya existe otro usuario con ese nombre.'
            ];
        }

        if (!empty($_POST['key'])) {
            $_POST['key'] = md5($_POST['key']);
        } else {
            unset($_POST['key']);
        }

        $edit = $this->updateAdminUser($this->util->sql($_POST, 1));

        if ($edit) {
            $status = 200;
            $message = 'Usuario actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function toggleStatusAdminUser() {
        $status = 500;
        $message = 'Error al cambiar el estado del usuario';

        $update = $this->updateAdminUser($this->util->sql($_POST, 1));

        if ($update) {
            $status = 200;
            $message = 'Estado del usuario actualizado correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }
}

// Complements

function userBadge($fullname, $subtitle) {
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
         . '<div class="text-xs text-gray-400">' . $subtitle . '</div>'
         . '</div>'
         . '</div>';
}

function dbBadge($dbName) {
    return '<span class="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-cyan-500/15 text-cyan-400">'
         . $dbName
         . '</span>';
}

function actionButtonsModule($id) {
    return [
        [
            'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 me-1',
            'html'    => '<i class="icon-pencil"></i>',
            'onclick' => "modules.edit($id)"
        ],
        [
            'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30',
            'html'    => '<i class="icon-trash"></i>',
            'onclick' => "modules.deleteModule($id)"
        ]
    ];
}

function actionButtonsUnlink($id) {
    return [
        [
            'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30',
            'html'    => '<i class="icon-link-ext"></i> Desvincular',
            'onclick' => "companies.unlinkModule($id)"
        ]
    ];
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
