<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-temas.php';

// Temas del navbar: alta, edición, imagen de temporada y "por defecto".
// La barra sigue el modelo de erp-pro/pro/app/dev/ctrl/ctrl-temas.php. El
// acento, el primario y el secundario son hex editables; sus rampas las
// calcula el navegador (src/js/tailwind-theme.js).
class ctrl extends mdl {

    private $modes   = ['light', 'dark'];
    private $tipos   = ['color', 'imagen'];
    private $schemes = ['light', 'huubie', 'midnight'];

    // La clave es el tipo que detecta getimagesize() leyendo el archivo, no la
    // extensión que manda el cliente: esta carpeta la sirve Apache.
    private $imageTypes = [
        IMAGETYPE_JPEG => 'jpg',
        IMAGETYPE_PNG  => 'png',
        IMAGETYPE_WEBP => 'webp'
    ];

    const IMAGE_MAX = 3145728;

    function init() {
        return [
            'status'       => 200,
            'statusFilter' => [
                ['id' => '1', 'valor' => 'Activos'],
                ['id' => '0', 'valor' => 'Inactivos']
            ],
            'tipos' => [
                ['id' => 'color',  'valor' => 'Color plano'],
                ['id' => 'imagen', 'valor' => 'Imagen de fondo (temporada)']
            ],
            'modes' => [
                ['id' => 'light', 'valor' => 'Oscuro, para fondos claros'],
                ['id' => 'dark',  'valor' => 'Claro, para fondos oscuros']
            ],
            'schemes' => [
                ['id' => 'light',    'valor' => 'Clara (gris de siempre)'],
                ['id' => 'huubie',   'valor' => 'Oscura Huubie (navy)'],
                ['id' => 'midnight', 'valor' => 'Oscura Midnight (azul noche)']
            ]
        ];
    }

    function lsThemes() {
        $row = [];
        $ls  = $this->listThemes([(int) $_POST['active']]);

        foreach ($ls as $t) {
            $image   = $this->imageUrl($t['image']);
            $missing = $t['tipo'] === 'imagen' && $image === '';

            $row[] = [
                'id'          => $t['id'],
                'Tema'        => renderThemeName($t, $t['tipo'] === 'imagen' ? $image : ''),
                'Código'      => htmlspecialchars($t['code']),
                'Fondo'       => renderThemeTipo($t['tipo'], $missing),
                'Texto'       => $t['mode'] === 'dark' ? 'Claro' : 'Oscuro',
                'Colores'     => renderThemeColors($t['accent'], $t['primary_color'], $t['secondary_color']),
                'Página'      => renderThemeScheme($t['scheme']),
                'Usuarios'    => (int) $t['chosen_by'],
                'Por defecto' => (int) $t['is_default'] === 1 ? renderDefault() : '',
                'Estado'      => renderThemeActive($t['is_active']),
                'a'           => $this->themeActions($t)
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getTheme() {
        $data = $this->getThemeById([(int) $_POST['id']]);
        if ($data) $data['image_url'] = $this->imageUrl($data['image']);

        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'OK' : 'El tema no existe',
            'data'    => $data
        ];
    }

    function addTheme() {
        $error = $this->validate();
        if ($error !== null) return $error;

        $code = $this->slug($_POST['name']);
        if ($code === '')                            return ['status' => 400, 'message' => 'El nombre necesita al menos una letra o número'];
        if ($this->existsThemeByCode([$code, 0]))    return ['status' => 409, 'message' => 'Ya existe un tema con ese nombre'];

        $tipo = $this->tipo();

        // Nace sin "por defecto": ponerlo es un gesto aparte, para que dar de
        // alta un tema no le cambie la barra a nadie por descuido.
        // Sin util->sql(): en PHP 7 convierte el 0 en NULL (0 == '').
        $ok = $this->createTheme([
            'values' => ['code', 'name', 'tipo', 'color', 'accent', 'primary_color', 'secondary_color', 'scheme', 'mode', 'badge', 'is_default', 'orden', 'is_active', 'created_at'],
            'data'   => [
                $code,
                trim($_POST['name']),
                $tipo,
                $this->hex('color'),
                $this->hex('accent'),
                $this->hex('primary_color'),
                $this->hex('secondary_color'),
                $this->scheme(),
                $this->mode(),
                $this->badge(),
                0,
                (int) $_POST['orden'],
                1,
                date('Y-m-d H:i:s')
            ]
        ]);

        if ($ok !== true) return ['status' => 500, 'message' => 'No se pudo crear el tema'];

        return [
            'status'  => 200,
            'message' => $tipo === 'imagen'
                ? 'Tema creado. Súbele su imagen: hasta entonces se ve como color plano.'
                : 'Tema creado. Ya aparece en el selector de la barra.'
        ];
    }

    // El code NO cambia al renombrar: users.theme_code lo guarda y cambiarlo
    // dejaría huérfanos a quienes ya eligieron este tema.
    function editTheme() {
        $id = (int) $_POST['id'];
        if (!$this->getThemeById([$id])) return ['status' => 404, 'message' => 'El tema no existe'];

        $error = $this->validate();
        if ($error !== null) return $error;

        $ok = $this->updateTheme([
            'values' => ['name', 'tipo', 'color', 'accent', 'primary_color', 'secondary_color', 'scheme', 'mode', 'badge', 'orden'],
            'where'  => ['id'],
            'data'   => [
                trim($_POST['name']),
                $this->tipo(),
                $this->hex('color'),
                $this->hex('accent'),
                $this->hex('primary_color'),
                $this->hex('secondary_color'),
                $this->scheme(),
                $this->mode(),
                $this->badge(),
                (int) $_POST['orden'],
                $id
            ]
        ]);

        return [
            'status'  => $ok === true ? 200 : 500,
            'message' => $ok === true ? 'Tema actualizado' : 'No se pudo actualizar el tema'
        ];
    }

    // Apagar el de por defecto se rechaza: dejaría a quien no ha elegido sin
    // tema. Apagar uno mueve a su gente al de por defecto (theme_code = NULL).
    function statusTheme() {
        $id     = (int) $_POST['id'];
        $active = (int) $_POST['active'] === 1 ? 1 : 0;
        $theme  = $this->getThemeById([$id]);

        if (!$theme) return ['status' => 404, 'message' => 'El tema no existe'];

        if ($active === 0 && (int) $theme['is_default'] === 1) {
            return ['status' => 409, 'message' => 'Es el tema por defecto. Pon otro por defecto antes de apagarlo.'];
        }

        $users = $active === 0 ? $this->getThemeCounts([$theme['code']]) : 0;

        $ok = $this->updateTheme([
            'values' => ['is_active'],
            'where'  => ['id'],
            'data'   => [$active, $id]
        ]);
        if ($ok !== true) return ['status' => 500, 'message' => 'No se pudo cambiar el estado'];

        if ($active === 1) return ['status' => 200, 'message' => 'Tema activado'];

        $this->updateThemeUsers([$theme['code']]);

        return [
            'status'  => 200,
            'message' => $users === 0
                ? 'Tema desactivado. Nadie lo tenía elegido.'
                : 'Tema desactivado. ' . ($users === 1 ? '1 persona pasa' : $users . ' personas pasan') . ' al tema por defecto.'
        ];
    }

    // El gesto de temporada: primero se apaga la marca en todos y luego se
    // enciende en uno. Al revés quedarían dos marcados si algo falla en medio.
    function defaultTheme() {
        $id    = (int) $_POST['id'];
        $theme = $this->getThemeById([$id]);

        if (!$theme)                           return ['status' => 404, 'message' => 'El tema no existe'];
        if ((int) $theme['is_active'] !== 1)   return ['status' => 409, 'message' => 'Activa el tema antes de ponerlo por defecto'];

        $this->updateThemeDefault();
        $ok = $this->updateTheme([
            'values' => ['is_default'],
            'where'  => ['id'],
            'data'   => [1, $id]
        ]);

        return [
            'status'  => $ok === true ? 200 : 500,
            'message' => $ok === true
                ? '«' . $theme['name'] . '» es el tema por defecto. Lo verán quienes no hayan elegido el suyo.'
                : 'No se pudo poner por defecto'
        ];
    }

    // El archivo se llama como el code: resubir la imagen pisa la anterior en
    // vez de acumular archivos sueltos.
    function uploadTheme() {
        $id    = (int) $_POST['id'];
        $theme = $this->getThemeById([$id]);

        if (!$theme) return ['status' => 404, 'message' => 'El tema no existe'];

        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            return ['status' => 400, 'message' => 'No llegó ninguna imagen'];
        }

        if ($_FILES['file']['size'] > self::IMAGE_MAX) {
            return ['status' => 413, 'message' => 'La imagen no puede pesar más de 3 MB'];
        }

        $info = @getimagesize($_FILES['file']['tmp_name']);
        if ($info === false || !isset($this->imageTypes[$info[2]])) {
            return ['status' => 415, 'message' => 'El archivo debe ser una imagen JPG, PNG o WEBP'];
        }

        $dir = $this->imageDir();
        if (!is_dir($dir) && !@mkdir($dir, 0777, true)) {
            return ['status' => 500, 'message' => 'No se pudo preparar la carpeta de imágenes'];
        }

        // Se borra la anterior con cualquier extensión: de PNG a JPG el nombre
        // nuevo no pisa al viejo.
        foreach ($this->imageTypes as $ext) {
            $old = $dir . $theme['code'] . '.' . $ext;
            if (is_file($old)) @unlink($old);
        }

        $fileName = $theme['code'] . '.' . $this->imageTypes[$info[2]];
        if (!move_uploaded_file($_FILES['file']['tmp_name'], $dir . $fileName)) {
            return ['status' => 500, 'message' => 'No se pudo guardar la imagen'];
        }

        $ok = $this->updateTheme([
            'values' => ['image', 'tipo'],
            'where'  => ['id'],
            'data'   => ['uploads/themes/' . $fileName, 'imagen', $id]
        ]);

        return [
            'status'  => $ok === true ? 200 : 500,
            'message' => $ok === true ? 'Imagen actualizada' : 'La imagen se guardó pero no se pudo registrar'
        ];
    }

    // -- Auxiliares --

    private function validate() {
        if (trim($_POST['name']) === '')          return ['status' => 400, 'message' => 'Escribe el nombre del tema'];
        if ($this->hex('color') === null)         return ['status' => 400, 'message' => 'El color de fondo debe ser un hexadecimal como #0F2740'];
        if ($this->hex('accent') === null)        return ['status' => 400, 'message' => 'El acento debe ser un hexadecimal como #C05A40'];
        if ($this->hex('primary_color') === null) return ['status' => 400, 'message' => 'El primario debe ser un hexadecimal como #292524'];
        if ($this->hex('secondary_color') === null) return ['status' => 400, 'message' => 'El secundario debe ser un hexadecimal como #7C3AED'];
        if (mb_strlen(trim($_POST['badge'])) > 30) return ['status' => 400, 'message' => 'La etiqueta admite máximo 30 caracteres'];

        return null;
    }

    // Los tres colores terminan dentro de un style en la pantalla de todos: se
    // valida su forma para que no se pueda colar CSS. Solo #RGB o #RRGGBB.
    private function hex($field) {
        $c = strtoupper(trim($_POST[$field]));
        return preg_match('/^#([0-9A-F]{3}|[0-9A-F]{6})$/', $c) ? $c : null;
    }

    private function badge() {
        $b = trim($_POST['badge']);
        return $b === '' ? null : $b;
    }

    private function scheme() {
        $s = strtolower(trim($_POST['scheme']));
        return in_array($s, $this->schemes, true) ? $s : 'light';
    }

    private function mode() {
        $m = strtolower(trim($_POST['mode']));
        return in_array($m, $this->modes, true) ? $m : 'light';
    }

    private function tipo() {
        $t = strtolower(trim($_POST['tipo']));
        return in_array($t, $this->tipos, true) ? $t : 'color';
    }

    // strtr ANTES de strtolower: strtolower trabaja byte a byte y sobre UTF-8
    // rompe los acentuados antes de poder cambiarlos.
    private function slug($name) {
        $code = strtr(trim($name), [
            'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n', 'ü' => 'u',
            'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ñ' => 'N', 'Ü' => 'U'
        ]);
        $code = preg_replace('/[^a-z0-9]+/', '-', strtolower($code));

        return substr(trim($code, '-'), 0, 40);
    }

    private function imageDir() {
        return __DIR__ . '/../../uploads/themes/';
    }

    // La imagen lista para un url(). La base sale de la ruta real de este
    // controlador (.../inventory/tenant/ctrl/); el ?v= cambia al resubirla.
    private function imageUrl($image) {
        $image = trim((string) $image);
        if ($image === '') return '';

        $file = __DIR__ . '/../../' . $image;
        if (!is_file($file)) return '';

        $base = dirname(dirname(dirname($_SERVER['SCRIPT_NAME'])));
        $base = rtrim(str_replace('\\', '/', $base), '/');

        return $base . '/' . $image . '?v=' . filemtime($file);
    }

    private function actionBtnClass($variant, $last = false) {
        $base = $variant === 'danger'
            ? 'inline-flex items-center px-2 py-1 text-sm rounded-md border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 transition'
            : 'inline-flex items-center px-2 py-1 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition';

        return $last ? $base : $base . ' me-1';
    }

    private function themeActions($t) {
        $id       = (int) $t['id'];
        $isActive = (int) $t['is_active'] === 1;
        $a        = [];

        $a[] = [
            'class'   => $this->actionBtnClass('neutral'),
            'html'    => '<i class="icon-pencil"></i>',
            'onclick' => "themes.editTheme({$id})"
        ];

        $a[] = [
            'class'   => $this->actionBtnClass('neutral'),
            'html'    => '<i class="icon-picture"></i>',
            'onclick' => "themes.uploadTheme({$id})"
        ];

        if ($isActive && (int) $t['is_default'] !== 1) {
            $a[] = [
                'class'   => $this->actionBtnClass('neutral'),
                'html'    => '<i class="icon-star-empty"></i>',
                'onclick' => "themes.defaultTheme({$id})"
            ];
        }

        $a[] = [
            'class'   => $this->actionBtnClass($isActive ? 'danger' : 'neutral', true),
            'html'    => $isActive ? '<i class="icon-toggle-on"></i>' : '<i class="icon-toggle-off"></i>',
            'onclick' => 'themes.statusTheme(' . $id . ', ' . ($isActive ? 0 : 1) . ')'
        ];

        return $a;
    }
}

// Complements

// Muestra en miniatura de la barra: su fondo (color o foto) con un "Aa" del
// color de texto que tendrá. Es lo que de verdad se juzga al elegir un tema.
function renderThemeName($t, $image) {
    $bg    = $image !== '' ? "url('{$image}') center/cover no-repeat, {$t['color']}" : $t['color'];
    $ink   = $t['mode'] === 'dark' ? '#F8FAFC' : '#111827';
    $badge = trim((string) $t['badge']) !== ''
        ? '<span class="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide text-white bg-[#7AAB20]">' . htmlspecialchars($t['badge']) . '</span>'
        : '';

    return '<div class="flex items-center gap-2.5">'
        . '<span class="inline-flex items-center justify-center w-16 h-6 rounded-md border border-gray-200 text-[11px] font-bold shrink-0" style="background:' . $bg . ';color:' . $ink . ';">Aa</span>'
        . '<span class="font-semibold text-gray-900">' . htmlspecialchars($t['name']) . '</span>'
        . $badge
        . '</div>';
}

function renderThemeTipo($tipo, $missing) {
    if ($tipo !== 'imagen') return 'Color plano';

    return $missing
        ? '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-amber-50 text-amber-700">Falta la imagen</span>'
        : 'Imagen';
}

// Acento, primario y secundario con su muestra. Los hex ya vienen validados al guardar.
function renderThemeColors($accent, $primary, $secondary) {
    $dot = function ($hex, $label) {
        return '<span class="inline-flex items-center gap-1.5" title="' . $label . '">'
            . '<span class="w-3 h-3 rounded-full shrink-0 border border-gray-200" style="background:' . htmlspecialchars($hex) . ';"></span>'
            . '<span class="text-xs text-gray-600">' . htmlspecialchars($hex) . '</span>'
            . '</span>';
    };

    return '<div class="inline-flex items-center gap-3">' . $dot($accent, 'Acento') . $dot($primary, 'Primario') . $dot($secondary, 'Secundario') . '</div>';
}

function renderThemeScheme($scheme) {
    $schemes = [
        'light'    => ['#F3F4F6', 'Clara'],
        'huubie'   => ['#111928', 'Huubie'],
        'midnight' => ['#0B1420', 'Midnight']
    ];
    $s = $schemes[$scheme] ?? $schemes['light'];

    return '<span class="inline-flex items-center gap-1.5">'
        . '<span class="w-3 h-3 rounded shrink-0 border border-gray-300" style="background:' . $s[0] . ';"></span>'
        . $s[1]
        . '</span>';
}

function renderDefault() {
    return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-emerald-50 text-emerald-700">Por defecto</span>';
}

function renderThemeActive($status) {
    return (int) $status === 1
        ? '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-emerald-50 text-emerald-700">Activo</span>'
        : '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-red-50 text-red-700">Inactivo</span>';
}

if (empty($_SESSION['IDU'])) {
    echo json_encode(['status' => 401, 'message' => 'Tu sesión terminó. Vuelve a entrar.']);
    exit(0);
}

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc) || !is_callable([$obj, $opc])) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
echo json_encode($obj->{$opc}());
