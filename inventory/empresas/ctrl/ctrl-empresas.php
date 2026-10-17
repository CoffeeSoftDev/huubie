<?php
require_once __DIR__ . '/../../conf/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-empresas.php';
require_once '../../conf/_Permissions.php';
require_once '../../conf/_Auditoria.php';

// Pantalla de Empresas: el Super Admin elige a qué empresa entra (o al módulo DEV).
class ctrl extends mdl {

    function init() {
        $currentId = (int) ($_SESSION['company_id'] ?? 0);

        $companies = [];
        foreach ($this->listCompanies() as $c) {
            $companies[] = [
                'id'        => (int) $c['id'],
                'name'      => $c['name'],
                'ubication' => $c['ubication'] ?: '',
                'branches'  => (int) $c['branches'],
                'current'   => (int) $c['id'] === $currentId ? 1 : 0,
            ];
        }

        $dev = $this->getModuleByCode(['dev']);

        return [
            'status'    => 200,
            'user'      => $_SESSION['user'] ?? 'Usuario',
            'companies' => $companies,
            'dev'       => $dev ? [
                'name'        => $dev['name'],
                'icon'        => $dev['icon'] ?: 'code-xml',
                'description' => $dev['description'] ?: '',
                'route'       => $dev['route'] ?: '',
            ] : null,
        ];
    }

    // Deja la sesión en la empresa elegida: todo inventory se acota por
    // company_id y branch_id de la sesión, y la navbar lista sus sucursales.
    function enterCompany() {
        $company = $this->getCompanyById([(int) ($_POST['id'] ?? 0)]);
        if (!$company) {
            return ['status' => 404, 'message' => 'Empresa no encontrada'];
        }

        $branches = $this->listBranchesByCompany([(int) $company['id']]);
        if (empty($branches)) {
            return ['status' => 409, 'message' => 'Esta empresa no tiene sucursales activas'];
        }

        // Al volver a la empresa en la que ya estaba conserva su sucursal.
        $branch = $branches[0];
        foreach ($branches as $b) {
            if ((int) $b['id'] === (int) ($_SESSION['branch_id'] ?? 0)) $branch = $b;
        }

        $_SESSION['company_id'] = (int) $company['id'];
        $_SESSION['company']    = $company['name'];
        $_SESSION['branch_id']  = (int) $branch['id'];
        $_SESSION['branch']     = $branch['name'];
        // Ve todas las sucursales de la empresa, como un dueño (ver login()).
        $_SESSION['is_owner']   = 1;

        // Queda en la bitácora de la empresa a la que entró: su dueño ve que el
        // Super Admin estuvo ahí.
        Auditoria::registrar('entrar-empresa', 'sesion', (int) $_SESSION['IDU'], $_SESSION['user'] ?? '', [
            'empresa'  => $company['name'],
            'sucursal' => $branch['name']
        ]);

        return [
            'status'  => 200,
            'message' => 'OK',
            'company' => $company['name'],
            'branch'  => $branch['name'],
        ];
    }
}

$obj = new ctrl();
$opc = $_POST['opc'];

if (!method_exists($obj, $opc)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}

if (!Permissions::superAdmin()) {
    echo json_encode(['status' => 403, 'message' => 'Solo el Super Admin puede elegir empresa.']);
    exit(0);
}

echo json_encode($obj->{$opc}());
