<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/../mdl/mdl-configurar.php';

/*  CONFIGURA TU EMPRESA: lo que el alta en linea no pidio para no estorbar la
    compra -- el alta solo lleva correo, contraseña y nombre de la empresa.

    Al dueño se le manda aqui en su PRIMER ingreso (auth/ctrl/ctrl-auth.php).
    Si lo deja para despues no se le vuelve a mandar: queda como recordatorio
    en la campana de la barra hasta que guarde (companies.setup_done_at).

    No depende del plan ni del pago: son los datos de la empresa, y se pueden
    completar aunque todavia no haya pagado. */
class ctrl extends mdl {
    const OPS = ['init', 'save'];

    function init() {
        $s = $this->getSetup([Session::user(), (int) $_SESSION['company_id']]);

        if (!$s) return ['status' => 404, 'message' => 'No encontramos tu empresa.'];

        return [
            'status' => 200,
            'data'   => [
                'done'             => $s['setup_done_at'] !== null ? 1 : 0,
                'company'          => (string) $s['name'],
                'rfc'              => (string) $s['rfc'],
                'ubication'        => (string) $s['ubication'],
                'branch'           => (string) $s['branch'],
                'branch_ubication' => (string) $s['branch_ubication'],
                'name'             => (string) $s['user_name'],
                'last_name'        => (string) $s['last_name'],
                'phone'            => (string) $s['phone'],
                // root viendo la empresa: sus datos personales no son de aqui.
                'viewing'          => !empty($_SESSION['is_root']) ? 1 : 0,
            ]
        ];
    }

    function save() {
        $companyId = (int) $_SESSION['company_id'];
        $s         = $this->getSetup([Session::user(), $companyId]);

        if (!$s) return ['status' => 404, 'message' => 'No encontramos tu empresa.'];

        $company   = $this->text('company', 120);
        $rfc       = strtoupper((string) $this->text('rfc', 13));
        $ubication = $this->text('ubication', 255);
        $branch    = $this->text('branch', 120);
        $branchUb  = $this->text('branch_ubication', 255);

        if ($company === null) return $this->invalid('company', 'Escribe el nombre de tu empresa.');
        if ($branch === null)  return $this->invalid('branch', 'Escribe el nombre de tu sucursal.');

        // RFC de persona moral (12) o fisica (13). Opcional: se puede dejar para despues.
        if ($rfc !== '' && !preg_match('/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/u', $rfc)) {
            return $this->invalid('rfc', 'Ese RFC no tiene el formato correcto (12 o 13 caracteres).');
        }

        $root = !empty($_SESSION['is_root']);

        if (!$root) {
            $name  = $this->text('name', 80);
            $last  = $this->text('last_name', 80);
            $phone = $this->text('phone', 20);

            if ($name === null) return $this->invalid('name', 'Escribe tu nombre.');

            if ($phone !== null && !preg_match('/^[0-9+() \-]{7,20}$/', $phone)) {
                return $this->invalid('phone', 'Escribe el teléfono solo con números (7 a 20 dígitos).');
            }
        }

        $ok = $this->updateCompany([$company, $rfc === '' ? null : $rfc, $ubication, $companyId]) === true;

        if ($ok && $s['branch_id']) {
            $ok = $this->updateBranch([$branch, $branchUb, $s['branch_id'], $companyId]) === true;
        }

        if ($ok && !$root) {
            $ok = $this->updateUser([$name, (string) $last, Session::user()]) === true
               && $this->updatePhone([$phone, Session::user()]) === true;
        }

        if (!$ok) return ['status' => 500, 'message' => 'No pudimos guardar los datos. Inténtalo de nuevo.'];

        // La barra y el inicio leen esto de la sesion.
        $_SESSION['company'] = $company;
        if (!$root) $_SESSION['user'] = trim($name . ' ' . $last);
        if ((int) $s['branch_id'] === (int) ($_SESSION['branch_id'] ?? 0)) $_SESSION['branch'] = $branch;

        return ['status' => 200, 'message' => 'Tu empresa quedó configurada.'];
    }

    private function invalid($field, $message) {
        return ['status' => 400, 'field' => $field, 'message' => $message];
    }

    // Texto recortado al ancho de su columna; vacio -> null.
    private function text($key, $max) {
        $value = trim(preg_replace('/\s+/', ' ', (string) ($_POST[$key] ?? '')));
        return $value === '' ? null : mb_substr($value, 0, $max);
    }
}

if (!in_array($_POST['opc'], ctrl::OPS, true)) exit(0);

header('Content-Type: application/json; charset=utf-8');

if (Session::user() === null) {
    echo json_encode(['status' => 401, 'message' => 'Tu sesión terminó. Vuelve a iniciar sesión.']);
    exit(0);
}

if (empty($_SESSION['company_id']) || empty($_SESSION['is_owner'])) {
    echo json_encode(['status' => 403, 'message' => 'Solo el dueño puede configurar la empresa.']);
    exit(0);
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
