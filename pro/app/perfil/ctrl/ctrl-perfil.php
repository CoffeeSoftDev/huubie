<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/../mdl/mdl-perfil.php';
require_once __DIR__ . '/../../../core/helpers/_CoffeeSoft.php';

/*  MI PERFIL: cada quien el suyo.

    Nada de aqui recibe un id de usuario: siempre es el de la sesion. Por eso
    no pasa por Permission -- no hay seccion que conceder, solo hace falta
    haber entrado.

    Lo personal (telefono, cumpleaños, direccion, contacto de emergencia) lo
    edita la persona y se guarda en su ficha de Capital Humano (employees). Lo
    de trabajo (puesto, area, ingreso) solo se muestra: lo lleva la empresa.

    root no es empleado de nadie: su perfil es solo la cuenta. */
class ctrl extends mdl {
    const OPS = ['init', 'saveProfile', 'savePassword', 'savePhoto'];

    // La misma minima que al recuperar la contraseña (auth/ctrl/ctrl-auth.php).
    const PASSWORD_MIN = 6;

    const PHOTO_MAX   = 2097152;   // 2 MB
    const PHOTO_TYPES = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];

    // Los colores que se ofrecen para el avatar. Se valida contra la lista:
    // users.color acaba dentro de un style="".
    const COLORS = ['#1C64F2', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#D97706', '#16A34A', '#0D9488', '#0284C7', '#475569'];

    function init() {
        $p = $this->getProfileByUser([Session::user()]);

        if (!$p) return ['status' => 404, 'message' => 'No encontramos tu cuenta.'];

        // Con empresa propia hay ficha (o se le crea al guardar); root no la tiene.
        $employee = !empty($p['company_id']);

        return [
            'status' => 200,
            'data'   => [
                'account' => [
                    'name'      => (string) $p['name'],
                    'last_name' => (string) $p['last_name'],
                    'email'     => (string) $p['email'],
                    'photo'     => userPhotoUrl($p['photo'], 4),
                    'color'     => $p['color'] ?: '',
                    'rol'       => $_SESSION['rol'],
                    'is_root'   => !empty($_SESSION['is_root']) ? 1 : 0,
                ],
                'colors' => self::COLORS,
                'work'   => !$employee ? null : [
                    'company'    => (string) $p['company'],
                    'branch'     => $p['employee_branch'] ?: $_SESSION['branch'],
                    'job_title'  => (string) $p['job_title'],
                    'department' => (string) $p['department'],
                    // Fechas crudas (Y-m-d): las escribe en español el navegador (Page.date).
                    'hire_date'  => (string) $p['hire_date'],
                    'seniority'  => $this->seniority($p['hire_date']),
                ],
                'personal' => !$employee ? null : [
                    'phone'           => (string) $p['phone'],
                    'birth_date'      => (string) $p['birth_date'],
                    'address'         => (string) $p['address'],
                    'emergency_name'  => (string) $p['emergency_name'],
                    'emergency_phone' => (string) $p['emergency_phone'],
                ],
            ]
        ];
    }

    function saveProfile() {
        $userId   = Session::user();
        $p        = $this->getProfileByUser([$userId]);
        $name     = trim((string) $_POST['name']);
        $lastName = trim((string) $_POST['last_name']);
        $color    = strtoupper(trim((string) $_POST['color']));

        if (!$p)           return ['status' => 404, 'message' => 'No encontramos tu cuenta.'];
        if ($name === '')  return ['status' => 400, 'message' => 'Escribe tu nombre.'];

        if (mb_strlen($name) > 80 || mb_strlen($lastName) > 80) {
            return ['status' => 400, 'message' => 'El nombre es demasiado largo.'];
        }

        if (!in_array($color, self::COLORS, true)) $color = $p['color'] ?: null;

        // Lo personal se revisa ANTES de escribir nada: si el telefono viene
        // mal no se queda guardado el nombre a medias.
        $personal = null;

        if (!empty($p['company_id'])) {
            $personal = $this->personal();
            if (is_string($personal)) return ['status' => 400, 'message' => $personal];
        }

        if ($this->updateAccount([$name, $lastName, $color, $userId]) !== true) {
            return ['status' => 500, 'message' => 'No pudimos guardar tus datos. Inténtalo de nuevo.'];
        }

        // La barra y el inicio saludan con este nombre.
        $_SESSION['user'] = trim($name . ' ' . $lastName);

        if ($personal !== null && !$this->savePersonal($p, $personal)) {
            return ['status' => 500, 'message' => 'Tu nombre quedó guardado, pero no tus datos personales. Inténtalo de nuevo.'];
        }

        return ['status' => 200, 'message' => 'Tus datos quedaron guardados.'];
    }

    function savePassword() {
        $p       = $this->getProfileByUser([Session::user()]);
        $current = (string) $_POST['current'];
        $new     = (string) $_POST['password'];
        $confirm = (string) $_POST['confirm'];

        if (!$p) return ['status' => 404, 'message' => 'No encontramos tu cuenta.'];

        if (!password_verify($current, (string) $p['password'])) {
            return ['status' => 401, 'message' => 'Tu contraseña actual no es correcta.'];
        }

        if (mb_strlen($new) < self::PASSWORD_MIN) {
            return ['status' => 400, 'message' => 'La contraseña nueva debe tener al menos ' . self::PASSWORD_MIN . ' caracteres.'];
        }

        if ($new !== $confirm) {
            return ['status' => 400, 'message' => 'Las dos contraseñas no coinciden.'];
        }

        if ($new === $current) {
            return ['status' => 400, 'message' => 'La contraseña nueva es igual a la actual.'];
        }

        return $this->updatePassword([password_hash($new, PASSWORD_BCRYPT), $p['id']]) === true
             ? ['status' => 200, 'message' => 'Tu contraseña quedó actualizada.']
             : ['status' => 500, 'message' => 'No pudimos guardar la contraseña. Inténtalo de nuevo.'];
    }

    /*  users.photo guarda SOLO el nombre del archivo dentro de pro/uploads/users/
        (userPhotoUrl() en core/helpers/_CoffeeSoft.php). El tipo se lee del
        contenido y no de la extension que mande el navegador, y el nombre lo
        pone el servidor: del archivo subido no se conserva nada. */
    function savePhoto() {
        $p    = $this->getProfileByUser([Session::user()]);
        $file = $_FILES['photo'] ?? null;

        if (!$p) return ['status' => 404, 'message' => 'No encontramos tu cuenta.'];

        if (!$file || $file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
            return ['status' => 400, 'message' => 'No recibimos la imagen. Inténtalo de nuevo.'];
        }

        if ($file['size'] > self::PHOTO_MAX) {
            return ['status' => 400, 'message' => 'La imagen pesa más de 2 MB.'];
        }

        $info = @getimagesize($file['tmp_name']);

        if (!$info || !isset(self::PHOTO_TYPES[$info[2]])) {
            return ['status' => 400, 'message' => 'Sube una imagen JPG, PNG o WebP.'];
        }

        $dir = __DIR__ . '/../../../uploads/users/';

        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            return ['status' => 500, 'message' => 'No se pudo preparar la carpeta de fotos.'];
        }

        $name = 'u' . (int) $p['id'] . '-' . time() . '.' . self::PHOTO_TYPES[$info[2]];

        if (!move_uploaded_file($file['tmp_name'], $dir . $name)) {
            return ['status' => 500, 'message' => 'No se pudo guardar la imagen.'];
        }

        if ($this->updatePhoto([$name, $p['id']]) !== true) {
            @unlink($dir . $name);
            return ['status' => 500, 'message' => 'No pudimos guardar tu foto. Inténtalo de nuevo.'];
        }

        // La anterior ya no la apunta nadie. basename(): solo dentro de la carpeta.
        $old = basename(trim((string) $p['photo']));
        if ($old !== '' && $old !== $name && is_file($dir . $old)) @unlink($dir . $old);

        return ['status' => 200, 'message' => 'Tu foto quedó actualizada.', 'data' => ['photo' => userPhotoUrl($name, 4)]];
    }

    // -- Ficha --

    // Lo personal que mando el formulario, ya revisado: el arreglo listo para
    // updatePersonal() (sin el user_id), o el motivo por el que no se acepta.
    private function personal() {
        $phone   = $this->text('phone', 20);
        $birth   = trim((string) ($_POST['birth_date'] ?? ''));
        $emPhone = $this->text('emergency_phone', 20);

        if ($birth !== '') {
            $date = DateTime::createFromFormat('Y-m-d', $birth);

            if (!$date || $date->format('Y-m-d') !== $birth || $date > new DateTime('today')) {
                return 'Tu fecha de nacimiento no es válida.';
            }
        }

        foreach ([$phone, $emPhone] as $number) {
            if ($number !== null && !preg_match('/^[0-9+() \-]{7,20}$/', $number)) {
                return 'Escribe los teléfonos solo con números (7 a 20 dígitos).';
            }
        }

        return [$phone, $birth === '' ? null : $birth, $this->text('address', 255), $this->text('emergency_name', 120), $emPhone];
    }

    // Quien todavia no tenia ficha la estrena aqui, en su sucursal activa.
    private function savePersonal($p, $personal) {
        if (empty($p['employee_id'])) {
            $branch = (int) ($_SESSION['branch_id'] ?? 0);

            if ($this->createEmployee([$p['id'], $p['company_id'], $branch > 0 ? $branch : null]) !== true) return false;
        }

        return $this->updatePersonal(array_merge($personal, [$p['id']])) === true;
    }

    // Texto opcional: vacio -> NULL, y recortado al ancho de su columna.
    private function text($key, $max) {
        $value = trim((string) ($_POST[$key] ?? ''));
        return $value === '' ? null : mb_substr($value, 0, $max);
    }

    // "2 años y 3 meses", "5 meses", "Menos de un mes".
    private function seniority($hireDate) {
        if (!$hireDate) return '';

        $diff = (new DateTime($hireDate))->diff(new DateTime('today'));
        if ($diff->invert) return '';

        $parts = [];
        if ($diff->y > 0) $parts[] = $diff->y . ($diff->y === 1 ? ' año' : ' años');
        if ($diff->m > 0) $parts[] = $diff->m . ($diff->m === 1 ? ' mes' : ' meses');

        return empty($parts) ? 'Menos de un mes' : implode(' y ', $parts);
    }
}

if (!in_array($_POST['opc'], ctrl::OPS, true)) exit(0);

header('Content-Type: application/json; charset=utf-8');

if (Session::user() === null) {
    echo json_encode(['status' => 401, 'message' => 'Tu sesión terminó. Vuelve a iniciar sesión.']);
    exit(0);
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
