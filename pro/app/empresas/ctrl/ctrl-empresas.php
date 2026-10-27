<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/../mdl/mdl-empresas.php';

// root elige a que empresa entra. Los demas ya traen la suya desde el login.
class ctrl extends mdl {
    const OPS = ['init', 'enterCompany'];

    // El mismo HOME de auth/ctrl/ctrl-auth.php: a donde entra quien ya tiene empresa.
    const HOME = 'app/pedidos/';

    function init() {
        $currentId = (int) $_SESSION['company_id'];
        $companies = [];

        foreach ($this->listCompanies() as $company) {
            $companies[] = [
                'id'        => (int) $company['id'],
                'name'      => $company['name'],
                'ubication' => $company['ubication'] ?: '',
                'branches'  => (int) $company['branches'],
                'current'   => (int) $company['id'] === $currentId ? 1 : 0,
            ];
        }

        // El modulo Developer va como una tarjeta mas, delante de las empresas.
        $dev = $this->getModuleByCode(['developer']);

        return [
            'status'    => 200,
            'user'      => $_SESSION['user'],
            'companies' => $companies,
            'dev'       => $dev && $dev['route'] ? [
                'name'        => $dev['name'],
                'icon'        => $dev['icon'] ?: 'code-xml',
                'description' => $dev['description'] ?: '',
                'route'       => $dev['route'],
            ] : null,
        ];
    }

    // Deja la sesion en la empresa elegida, como si fuera su dueño: ve todas
    // sus sucursales. Al volver a la misma empresa conserva su sucursal.
    function enterCompany() {
        $company = $this->getCompanyById([$_POST['id']]);

        if (!$company) {
            return ['status' => 404, 'message' => 'Esa empresa no existe o no está activa.'];
        }

        $branches = $this->listBranchesByCompany([$company['id']]);

        if (empty($branches)) {
            return ['status' => 409, 'message' => 'Esta empresa no tiene sucursales activas.'];
        }

        $branch = $branches[0];

        foreach ($branches as $item) {
            if ((int) $item['id'] === (int) $_SESSION['branch_id']) $branch = $item;
        }

        $_SESSION['company_id'] = (int) $company['id'];
        $_SESSION['company']    = $company['name'];
        $_SESSION['branch_id']  = (int) $branch['id'];
        $_SESSION['branch']     = $branch['name'];
        $_SESSION['is_owner']   = 1;

        return [
            'status'   => 200,
            'message'  => 'OK',
            'redirect' => self::HOME,
        ];
    }
}

if (!in_array($_POST['opc'], ctrl::OPS, true)) exit(0);

header('Content-Type: application/json; charset=utf-8');

if (Session::user() === null) {
    echo json_encode(['status' => 401, 'message' => 'Tu sesión terminó. Vuelve a iniciar sesión.']);
    exit(0);
}

if (empty($_SESSION['is_root'])) {
    echo json_encode(['status' => 403, 'message' => 'Solo root puede elegir empresa.']);
    exit(0);
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
