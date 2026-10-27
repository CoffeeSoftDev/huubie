<?php
require_once __DIR__ . '/../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/../mdl/mdl-auth.php';
require_once __DIR__ . '/../../core/helpers/_Message.php';
require_once __DIR__ . '/../../core/helpers/_CoffeeSoft.php';

class ctrl extends mdl {
    const OPS = ['login', 'forgotPassword', 'verifyCode', 'resetPassword'];

    // A donde entra cada quien, relativo a pro/ (donde vive index.php). root
    // elige empresa primero; los demas ya traen la suya.
    const HOME_ROOT = 'app/empresas/';
    const HOME      = 'app/pedidos/';

    // Contraseñas equivocadas seguidas antes de bloquear la cuenta. Se abre
    // recuperando la contraseña (setNewPassword limpia el contador).
    const MAX_ATTEMPTS = 6;

    // Seis digitos son un millon de combinaciones; con 15 minutos y 5 intentos
    // quien prueba a ciegas tiene 5 tiros entre un millon.
    const RESET_MINUTES     = 15;
    const RESET_MAX_TRIES   = 5;
    const RESET_CODE_LENGTH = 6;
    const PASSWORD_MIN      = 6;

    function login() {
        $email    = trim($_POST['email']);
        $password = $_POST['password'];

        if ($email === '' || $password === '') {
            return ['status' => 400, 'message' => 'Escribe tu correo y tu contraseña.', 'data' => null];
        }

        $user = $this->getUserByEmail([$email]);

        if (!$user || empty($user['password'])) {
            return ['status' => 401, 'message' => 'Correo o contraseña incorrectos.', 'data' => null];
        }

        // Bloqueada ni siquiera se revisa la contraseña: si no, el bloqueo no
        // frenaria a quien la esta adivinando.
        if ((int) $user['login_attempts'] >= self::MAX_ATTEMPTS) {
            return ['status' => 423, 'message' => lockedMessage(), 'data' => null];
        }

        if (!password_verify($password, $user['password'])) {
            $this->addLoginAttempt([$user['id']]);

            $quedan = self::MAX_ATTEMPTS - ((int) $user['login_attempts'] + 1);

            if ($quedan <= 0) {
                return ['status' => 423, 'message' => lockedMessage(), 'data' => null];
            }

            return [
                'status'  => 401,
                'message' => 'Correo o contraseña incorrectos. Te ' . ($quedan === 1 ? 'queda 1 intento' : "quedan {$quedan} intentos") . '.',
                'data'    => null
            ];
        }

        if ((int) $user['login_attempts'] > 0) $this->resetLoginAttempts([$user['id']]);

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
                'photo'    => userPhotoUrl($user['photo'], 3),
                'color'    => $user['color'] ?? '',
            ]
        ];
    }

    /*  RECUPERAR CONTRASEÑA, tres pasos que llama recuperar.php:
          1. forgotPassword() manda el codigo al correo
          2. verifyCode()     solo abre el paso 3
          3. resetPassword()  escribe la contraseña nueva
        Portado de inventory/acceso/ctrl/ctrl-access.php.

        El codigo se guarda DESPUES de entregarlo: si el correo no sale no se
        escribe nada, porque un codigo que nadie leyo solo le gasta los intentos
        al siguiente. Y users.password no se toca hasta el paso 3: pedir un
        codigo no deja fuera a nadie. */
    function forgotPassword() {
        $email = trim($_POST['email']);

        if ($email === '') {
            return ['status' => 400, 'message' => 'Escribe tu correo.', 'data' => null];
        }

        $user = $this->getUserForReset([$email]);

        if (empty($user)) {
            return ['status' => 404, 'message' => 'No encontramos una cuenta activa con ese correo.', 'data' => null];
        }

        $codigo = $this->util->code_security(self::RESET_CODE_LENGTH);
        $nombre = trim((string) $user['name']);
        $saludo = $nombre === '' ? 'Hola.' : "Hola, {$nombre}.";

        $entregado = (new Message)->correo(
            $user['email'],
            'Código para recuperar tu contraseña — Huubie',
            $saludo . "\n\n" . $this->recoveryMessage($codigo)
        );

        if ($entregado !== true) {
            return [
                'status'  => 502,
                'message' => 'No pudimos entregarte el código. Inténtalo más tarde; tu contraseña actual sigue funcionando.',
                'data'    => null
            ];
        }

        if ($this->setResetCode([password_hash($codigo, PASSWORD_BCRYPT), self::RESET_MINUTES, $user['id']]) !== true) {
            return [
                'status'  => 500,
                'message' => 'Enviamos el correo pero no pudimos registrar el código. Inténtalo de nuevo.',
                'data'    => null
            ];
        }

        return [
            'status'  => 200,
            'message' => 'Te enviamos un código a tu correo. Vence en ' . self::RESET_MINUTES . ' minutos.',
            'data'    => null
        ];
    }

    // No firma nada: resetPassword() vuelve a pedir el codigo. Si este paso
    // fuera el unico guardian, bastaria con saltarselo.
    function verifyCode() {
        $user = $this->getUserForReset([trim($_POST['email'])]);

        if (empty($user)) {
            return ['status' => 404, 'message' => 'No encontramos esa cuenta. Vuelve a empezar.', 'data' => null];
        }

        $revision = $this->checkCode($user, trim($_POST['code']));

        return ['status' => $revision['status'], 'message' => $revision['message'], 'data' => null];
    }

    function resetPassword() {
        $password = (string) $_POST['password'];
        $confirm  = (string) $_POST['confirm'];

        $user = $this->getUserForReset([trim($_POST['email'])]);

        if (empty($user)) {
            return ['status' => 404, 'message' => 'No encontramos esa cuenta. Vuelve a empezar.', 'data' => null];
        }

        // El codigo va ANTES que la contraseña: si esta vencido da igual lo que
        // haya escrito, y asi no se le va un intento en corregir algo inutil.
        $revision = $this->checkCode($user, trim($_POST['code']));

        if ($revision['status'] !== 200) {
            return ['status' => $revision['status'], 'message' => $revision['message'], 'data' => null];
        }

        if (mb_strlen($password) < self::PASSWORD_MIN) {
            return ['status' => 400, 'message' => 'La contraseña debe tener al menos ' . self::PASSWORD_MIN . ' caracteres.', 'data' => null];
        }

        if ($password !== $confirm) {
            return ['status' => 400, 'message' => 'Las dos contraseñas no coinciden.', 'data' => null];
        }

        $guardada = $this->setNewPassword([password_hash($password, PASSWORD_BCRYPT), $user['id']]);

        return $guardada === true
             ? ['status' => 200, 'message' => 'Tu contraseña quedó lista. Ya puedes iniciar sesión.', 'data' => null]
             : ['status' => 500, 'message' => 'No pudimos guardar la contraseña. Inténtalo de nuevo.', 'data' => null];
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

    /*  ¿Vale este codigo? El orden importa: primero si hay codigo, luego si
        sigue vivo, luego si quedan tiros y al final si acierta. Asi un codigo
        vencido no gasta intentos. Al quinto fallo el codigo se tira: quien
        prueba a ciegas no puede seguir teniendo blanco. */
    private function checkCode($user, $codigo) {
        $guardado = (string) $user['reset_code'];
        $fallos   = (int) $user['reset_tries'];

        if ($guardado === '') {
            return ['status' => 409, 'message' => 'No tienes ningún código pendiente. Pide uno nuevo.'];
        }

        if (empty($user['reset_vigente'])) {
            return ['status' => 410, 'message' => 'El código ya venció. Pide uno nuevo.'];
        }

        if ($fallos >= self::RESET_MAX_TRIES) {
            return ['status' => 429, 'message' => 'Se agotaron los intentos. Pide un código nuevo.'];
        }

        // Seis digitos o no es un codigo. No gasta intento: al que se le colo un
        // espacio no hay por que cobrarselo.
        if (!preg_match('/^[0-9]{' . self::RESET_CODE_LENGTH . '}$/', $codigo)) {
            return ['status' => 400, 'message' => 'El código son ' . self::RESET_CODE_LENGTH . ' dígitos.'];
        }

        if (password_verify($codigo, $guardado)) {
            return ['status' => 200, 'message' => 'Código correcto.'];
        }

        $fallos++;

        if ($fallos >= self::RESET_MAX_TRIES) {
            $this->clearResetCode([$user['id']]);
            return ['status' => 429, 'message' => 'Se agotaron los intentos. Pide un código nuevo.'];
        }

        $this->addResetTry([$user['id']]);

        $quedan = self::RESET_MAX_TRIES - $fallos;

        return [
            'status'  => 401,
            'message' => 'El código no es correcto. Te ' . ($quedan === 1 ? 'queda 1 intento' : "quedan {$quedan} intentos") . '.'
        ];
    }

    /*  El correo dice dos cosas que no son adorno: cuanto dura el codigo, para
        que no lo teclee media hora despues y crea que el sistema esta roto; y
        que su contraseña sigue sirviendo, para que quien no pidio nada pueda
        ignorarlo. El enlace sale de baseUrl(): una prueba en local manda a local. */
    private function recoveryMessage($codigo) {
        $texto  = "Tu código para recuperar el acceso a Huubie es:\n\n";
        $texto .= "{$codigo}\n\n";
        $texto .= "Vence en " . self::RESET_MINUTES . " minutos. Escríbelo aquí y ahí mismo eliges tu nueva contraseña:\n";
        $texto .= $this->util->baseUrl(2) . "recuperar.php\n\n";
        $texto .= "Si no has sido tú, ignora este mensaje: tu contraseña actual sigue funcionando.";

        return $texto;
    }
}

// Complements.

// Solo entran las empresas activas; las demas reciben por que no.
function companyDenied($companyId, $status) {
    if (empty($companyId) || $status === null) return 'Tu cuenta no pertenece a ninguna empresa. Contacta a soporte.';
    if ($status === 'active')                  return null;
    if ($status === 'pending')                 return 'Tu empresa todavía no está activa. Contacta a soporte.';
    if ($status === 'suspended')               return 'El acceso de tu empresa está suspendido. Contacta a soporte.';
    if ($status === 'cancelled')               return 'La cuenta de tu empresa fue cancelada. Contacta a soporte.';

    return 'Tu empresa no tiene acceso. Contacta a soporte.';
}

function lockedMessage() {
    return 'Tu cuenta se bloqueó por ' . ctrl::MAX_ATTEMPTS . ' intentos fallidos. Recupera tu contraseña para desbloquearla.';
}

if (!in_array($_POST['opc'], ctrl::OPS, true)) exit(0);

header('Content-Type: application/json; charset=utf-8');

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
