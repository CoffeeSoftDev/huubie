<?php
require_once __DIR__ . '/../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/../mdl/mdl-auth.php';

class ctrl extends mdl {
    const OPS = ['login'];

    // A donde entra cada quien, relativo a pro/ (donde vive index.php). root
    // elige empresa primero; los demas ya traen la suya.
    const HOME_ROOT = 'app/empresas/';
    const HOME      = 'app/pedidos/';

    function login() {
        $email    = trim($_POST['email']);
        $password = $_POST['password'];

        if ($email === '' || $password === '') {
            return ['status' => 400, 'message' => 'Escribe tu correo y tu contraseña.', 'data' => null];
        }

        $user = $this->getUserByEmail([$email]);

        if (!$user || empty($user['password']) || !password_verify($password, $user['password'])) {
            return ['status' => 401, 'message' => 'Correo o contraseña incorrectos.', 'data' => null];
        }

        $root   = $this->getRootRole([$user['id']]);
        $branch = null;

        if (!$root) {
            $denied = companyDenied($user['company_id'], $user['company_status']);

            if ($denied !== null) {
                return ['status' => 403, 'message' => $denied, 'data' => null];
            }

            $branch = $this->homeBranch($user);

            if ($branch === null) {
                return ['status' => 403, 'message' => 'Tu cuenta no tiene ninguna sucursal asignada. Pide acceso a tu administrador.', 'data' => null];
            }
        }

        // Id nuevo en cada login: nadie entra con un id de sesion que ya conociera.
        session_regenerate_id(true);
        Session::remember($_POST['remember'] === '1');

        $fullName = trim($user['name'] . ' ' . $user['last_name']);
        $home     = $root ? self::HOME_ROOT : self::HOME;

        $_SESSION['user_id']    = (int) $user['id'];
        $_SESSION['user']       = $fullName;
        $_SESSION['email']      = $user['email'];
        $_SESSION['is_root']    = $root ? 1 : 0;
        $_SESSION['is_owner']   = (int) $user['is_owner'] === 1 ? 1 : 0;
        $_SESSION['company_id'] = $root ? 0 : (int) $user['company_id'];
        $_SESSION['company']    = $root ? '' : $user['company'];
        $_SESSION['branch_id']  = $root ? 0 : (int) $branch['id'];
        $_SESSION['branch']     = $root ? '' : $branch['name'];
        $_SESSION['role_id']    = $root ? (int) $root['id'] : (int) $branch['role_id'];
        $_SESSION['rol']        = $root ? $root['name'] : ($branch['rol'] ?? '');
        $_SESSION['home']       = $home;

        return [
            'status'  => 200,
            'message' => 'Sesión iniciada.',
            'data'    => [
                'redirect' => $home,
                'user'     => $fullName,
                'email'    => $user['email'],
                'photo'    => trim((string) $user['photo']),
                'color'    => $user['color'] ?? '',
            ]
        ];
    }

    // La suya (users.branch_id) si todavia puede usarla; si no, la primera que
    // si. Una sucursal sin rol dejaria al usuario dentro y sin nada que ver.
    private function homeBranch($user) {
        $list = $this->listBranchesByUser([$user['id'], $user['company_id'], (int) $user['is_owner'] === 1 ? 1 : 0]);

        foreach ($list as $branch) {
            if ((int) $branch['id'] === (int) $user['branch_id']) return $branch;
        }

        return empty($list) ? null : $list[0];
    }
}

// Complements.

// 'suspendend' va asi, con la errata del enum de companies.status.
function companyDenied($companyId, $status) {
    if (empty($companyId) || $status === null) return 'Tu cuenta no pertenece a ninguna empresa. Contacta a soporte.';
    if ($status === 'suspendend')              return 'El acceso de tu empresa está suspendido. Contacta a soporte.';
    if ($status === 'cancelled')               return 'La cuenta de tu empresa fue cancelada. Contacta a soporte.';

    return null;
}

if (!in_array($_POST['opc'], ctrl::OPS, true)) exit(0);

header('Content-Type: application/json; charset=utf-8');

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
