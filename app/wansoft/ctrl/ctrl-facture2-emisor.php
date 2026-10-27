<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../conf/_Terminal.php';
terminalExige(['catalogos']);

require_once '../mdl/mdl-facture2-emisor.php';
require_once '../conf/_Auditoria.php';

class ctrl extends mdl {

    public $branch;

    public function __construct() {
        parent::__construct();
        $this->branch = $this->resolveBranch();

        session_write_close();
    }

    // El facturador tiene su propia tabla branch: el id de sucursal de la sesion
    // de Huubie (SUB) es de otro esquema y no cruza con este. Se resuelve contra
    // fayxzvov_facturacion.branch y se cachea en sesion.
    function resolveBranch() {
        if (!empty($_SESSION['FACTURE_BRANCH'])) return (int) $_SESSION['FACTURE_BRANCH'];

        $ls = $this->getBranch();
        $id = (int) ($ls[0]['id'] ?? 0);
        if ($id > 0) $_SESSION['FACTURE_BRANCH'] = $id;

        return $id;
    }

    // branch_id admite NULL: sin sucursal dada de alta el modulo lee las filas
    // sin sucursal en vez de romper la FK.
    function branchId() {
        return $this->branch > 0 ? $this->branch : null;
    }

    function init() {
        return [
            'emisor' => $this->emisor(),
            'pos'    => $this->lsPos()
        ];
    }

    // -- Emisor --

    // Lo que se imprime en el ticket sale de la sucursal. Si no tiene razon social
    // propia se encabeza con la de la empresa, que es la dueña del RFC.
    // El membrete se arma con las dos filas: la sucursal encabeza el papel y pone el
    // LUGAR DE EXPEDICION, y la empresa pone el lema y el domicilio fiscal, que es
    // el que va bajo el RFC. Es el mismo arreglo que devuelve el modulo Tickets.
    //
    // El punto de venta viaja junto al membrete porque es un dato de la misma
    // sucursal: `pos_code` es la llave con la que el resto del modulo pregunta que
    // sistema esta operando, y `pos_name` es solo la etiqueta que se muestra.
    function emisor() {
        $ls = $this->getEmisor([$this->branchId()]);

        if (empty($ls)) {
            return [
                'razon' => '', 'logo' => '', 'lema' => '', 'rfc' => '', 'telefono' => '', 'domicilio' => '', 'expedicion' => '',
                'pos_id' => '', 'pos_name' => '', 'pos_code' => '', 'pos_color' => '', 'tolerancia' => ''
            ];
        }

        $item = $ls[0];

        return [
            'razon'      => $item['business_name'] ?: $item['company_name'],
            // El logo encabeza el papel en lugar de la razon social. Se devuelve la
            // ruta publica, que es la que el navegador pide tal cual.
            'logo'       => $item['logo'] ?? '',
            'lema'       => $item['company_name'],
            'rfc'        => $item['rfc'] ?: $item['company_rfc'],
            'telefono'   => $item['phone'] ?: $item['company_phone'],
            'domicilio'  => $item['company_address'] ?: $item['fiscal_address'],
            'expedicion' => $item['fiscal_address'],
            'pos_id'     => $item['pos_id']    ?? '',
            'pos_name'   => $item['pos_name']  ?? '',
            'pos_code'   => $item['pos_code']  ?? '',
            'pos_color'  => $item['pos_color'] ?? '',
            // Tampoco se imprime: dice hasta donde acepta la casa que el ticket
            // virtual se cuadre con un descuento (ver ajusteDe en Tickets).
            'tolerancia' => $item['adjustment_tolerance'] ?? 0
        ];
    }

    // Que sistema esta operando la sucursal, en una sola llamada, para las pantallas
    // que necesitan el dato pero no el membrete completo (importacion, tickets).
    function pos() {
        $emisor = $this->emisor();

        return [
            'status'    => 200,
            'pos_id'    => $emisor['pos_id'],
            'pos_name'  => $emisor['pos_name'],
            'pos_code'  => $emisor['pos_code'],
            'pos_color' => $emisor['pos_color']
        ];
    }

    // El formulario es uno solo pero cae en dos tablas. La empresa se actualiza
    // aparte y no bloquea: una sucursal sin empresa resuelta igual guarda lo suyo.
    function saveEmisor() {
        $status  = 500;
        $message = 'No se pudieron guardar los datos del emisor';

        if (!$this->branchId()) {
            return ['status' => 400, 'message' => 'No hay sucursal dada de alta en el facturador'];
        }

        $campos = [
            'business_name'  => $_POST['razon']      ?? '',
            'rfc'            => $_POST['rfc']        ?? '',
            'phone'          => $_POST['telefono']   ?? '',
            'fiscal_address' => $_POST['expedicion'] ?? ''
        ];

        // El punto de venta solo se toca si el formulario lo mando: una pantalla que
        // guarde el membrete sin ese campo no debe dejar a la sucursal sin sistema.
        // El 0 es la opcion "Sin definir" del select y se guarda vacio, que util->sql
        // traduce a NULL: la FK no acepta un id que no existe.
        if (array_key_exists('pos_id', $_POST)) {
            $posId = (int) $_POST['pos_id'];
            $campos['pos_id'] = $posId > 0 ? $posId : '';
        }

        // La tolerancia se guarda igual de condicionada que el punto de venta, y
        // nunca negativa: un tope en negativo marcaria como fuera de rango todos
        // los papeles, incluidos los que cuadraron exacto.
        if (array_key_exists('tolerancia', $_POST)) {
            $campos['adjustment_tolerance'] = max(0, numVal($_POST['tolerancia']));
        }

        $campos['id'] = $this->branchId();

        // Lo que habia ANTES de guardar: despues ya no se puede saber.
        $previo = $this->getEmisor([$this->branchId()]);

        $update = $this->updateBranch($this->util->sql($campos, 1));

        $this->saveCompany();

        if ($update) {
            $this->registrarEmisor(!empty($previo) ? $previo[0] : []);

            $status  = 200;
            $message = 'Datos del emisor actualizados';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'emisor'  => $this->emisor()
        ];
    }

    // Lema y domicilio fiscal son de la empresa.
    //
    // El lema SI puede quedarse vacio, pero solo cuando la sucursal tiene razon
    // social propia: el membrete se encabeza con una de las dos y borrar las dos
    // dejaria el papel mudo. Antes el vacio se ignoraba siempre, tuviera o no la
    // sucursal su nombre, y eso obligaba a inventar un valor —un punto— para poder
    // guardar; ese punto acababa impreso en el ticket del cliente.
    //
    // El vacio llega a la base como NULL, que es lo que `Utileria::sql` hace con
    // la cadena vacia y lo que la columna admite desde migra-14. Tiene que ser
    // NULL y no '' porque es UNIQUE: la segunda empresa sin lema chocaria.
    function saveCompany() {
        $ls = $this->getEmisor([$this->branchId()]);

        if (empty($ls) || empty($ls[0]['company_id'])) return false;

        $campos = ['fiscal_address' => $_POST['domicilio'] ?? ''];

        $lema      = trim($_POST['lema'] ?? '');
        $sucursal  = trim($ls[0]['business_name'] ?? '');

        if ($lema !== '' || $sucursal !== '') $campos['business_name'] = $lema;

        $campos['id'] = $ls[0]['company_id'];

        return $this->updateCompany($this->util->sql($campos, 1));
    }

    // -- Auditoria (punto 35) --

    // Un renglon por accion, escrito DESPUES de que la accion salio bien. La escritura
    // es de Auditoria (conf/_Auditoria.php) y este ayudante le pone lo que solo el
    // controlador sabe: quien tecleo su PIN —no la sesion de Huubie— y la sucursal.
    //
    // La sesion se cerro en el constructor, pero sigue legible: cerrarla suelta el
    // candado de escritura, no vacia $_SESSION.
    function registrar($accion, $entity, $entityId, $label, $detail = []) {
        $bitacora = new Auditoria;

        return $bitacora->createAuditLog([
            'action'    => $accion,
            'entity'    => $entity,
            'entity_id' => $entityId,
            'label'     => $label,
            'detail'    => $detail,
            'user_id'   => $_SESSION['WANSOFT_USER'] ?? null,
            'branch_id' => $this->branchId()
        ]);
    }

    // El emisor se vuelve a leer DESPUES de guardar y se compara contra lo que habia,
    // campo por campo: el formulario es uno solo pero cae en dos tablas, y lo que
    // cambio es lo que la base tiene ahora, no lo que la pantalla creyo mandar. Sin
    // cambios no hay renglon: guardar igual no es una accion que auditar.
    //
    // El punto de venta viaja por su nombre y no por su id: "Wansoft" se lee dentro de
    // un ano, "2" no.
    function registrarEmisor($antes) {
        $ls = $this->getEmisor([$this->branchId()]);

        if (empty($ls) || empty($antes)) return;

        $cambios = [];
        $nombres = [];

        foreach (camposDeEmisor() as $campo => $dato) {
            $previo = valorDeEmisor($campo, $antes[$dato['columna']]);
            $nuevo  = valorDeEmisor($campo, $ls[0][$dato['columna']]);

            if ($previo === $nuevo) continue;

            $cambios[$campo] = [
                'antes'   => $previo === '' ? null : $previo,
                'despues' => $nuevo === '' ? null : $nuevo
            ];

            $nombres[] = $dato['nombre'];
        }

        if (empty($cambios)) return;

        $this->registrar('catalogo', 'branch', $this->branchId(), 'Emisor · ' . implode(', ', $nombres), $cambios);
    }

    // -- Logo del ticket --

    // Donde viven los logos y como los pide el navegador. Son la misma carpeta
    // dicha de dos formas: la del disco es relativa a este ctrl y la publica es la
    // que se guarda en la base y se imprime en el papel.
    const LOGO_DIR = __DIR__ . '/../src/img/logos/';
    const LOGO_URL = '/app/wansoft/src/img/logos/';

    // Solo mapas de bits, y con su firma verificada. Un SVG es un documento con
    // scripts adentro y el papel lo pinta con <img> en la misma pagina del modulo:
    // no entra aunque se llame .svg.
    const LOGO_TIPOS = ['png' => 'png', 'jpg' => 'jpeg', 'jpeg' => 'jpeg', 'webp' => 'webp'];
    const LOGO_PESO  = 2097152;

    // El logo se sube aparte del formulario porque es un archivo: el resto del
    // emisor viaja urlencoded y no admite binarios (ver subirArchivo en Cargas).
    function saveLogo() {
        if (!$this->branchId()) {
            return ['status' => 400, 'message' => 'No hay sucursal dada de alta en el facturador'];
        }

        $file = $_FILES['logo'] ?? null;

        if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            return ['status' => 400, 'message' => 'No se recibio ninguna imagen'];
        }

        if ($file['size'] > self::LOGO_PESO) {
            return ['status' => 400, 'message' => 'La imagen pesa mas de 2 MB'];
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

        // La extension dice como se llama el archivo y getimagesize dice que es en
        // realidad: si no coinciden, lo que subieron no es la imagen que dice ser.
        $info = @getimagesize($file['tmp_name']);
        $tipo = $info ? strtolower(str_replace('image/', '', $info['mime'])) : '';

        if (!isset(self::LOGO_TIPOS[$ext]) || self::LOGO_TIPOS[$ext] !== $tipo) {
            return ['status' => 400, 'message' => 'El logo debe ser una imagen PNG, JPG o WEBP'];
        }

        if (!is_dir(self::LOGO_DIR)) mkdir(self::LOGO_DIR, 0775, true);

        // El nombre lo pone el modulo y no el archivo que llego: el original puede
        // traer rutas o caracteres que el sistema de archivos interpreta.
        $nombre = 'logoBranch' . $this->branchId() . '_' . date('Ymd_His') . '.' . $ext;

        if (!move_uploaded_file($file['tmp_name'], self::LOGO_DIR . $nombre)) {
            return ['status' => 500, 'message' => 'No se pudo guardar la imagen'];
        }

        $anterior = $this->logoActual();

        $update = $this->updateBranch($this->util->sql([
            'logo' => self::LOGO_URL . $nombre,
            'id'   => $this->branchId()
        ], 1));

        if (!$update) {
            // La fila manda: un archivo suelto que la base no conoce no lo va a
            // borrar nadie despues.
            @unlink(self::LOGO_DIR . $nombre);

            return ['status' => 500, 'message' => 'No se pudo guardar el logo del emisor'];
        }

        $this->borrarLogo($anterior);

        return [
            'status'  => 200,
            'message' => 'Logo actualizado',
            'emisor'  => $this->emisor()
        ];
    }

    // Quitar el logo devuelve el papel a encabezarse con la razon social, que es
    // como imprimia antes de que se subiera ninguno.
    function deleteLogo() {
        if (!$this->branchId()) {
            return ['status' => 400, 'message' => 'No hay sucursal dada de alta en el facturador'];
        }

        $anterior = $this->logoActual();

        // La cadena vacia la traduce util->sql a NULL, que es el "sin logo" de la
        // columna (ver migra-13).
        $update = $this->updateBranch($this->util->sql([
            'logo' => '',
            'id'   => $this->branchId()
        ], 1));

        if (!$update) {
            return ['status' => 500, 'message' => 'No se pudo quitar el logo'];
        }

        $this->borrarLogo($anterior);

        return [
            'status'  => 200,
            'message' => 'Logo quitado',
            'emisor'  => $this->emisor()
        ];
    }

    function logoActual() {
        $ls = $this->getEmisor([$this->branchId()]);

        return $ls[0]['logo'] ?? '';
    }

    // Del archivo viejo solo se borra su nombre dentro de la carpeta de logos: la
    // ruta viene de la base, pero un valor manipulado no debe poder senalar a
    // cualquier archivo del servidor.
    function borrarLogo($ruta) {
        if (empty($ruta)) return false;

        $archivo = self::LOGO_DIR . basename($ruta);

        return file_exists($archivo) ? @unlink($archivo) : false;
    }
}

// Complements

// Un importe puede llegar como "$1,138.00" y el casteo directo lo deja en 1.0:
// el signo y los separadores se quitan antes, para que valga lo mismo escribirlo
// con formato o sin el. El front ya lo limpia al teclear; esto cubre lo que
// llega por fuera del formulario.
function numVal($value) {
    $limpio = str_replace(['%', ',', '$', ' '], '', (string) $value);

    return is_numeric($limpio) ? (float) $limpio : 0;
}

// Los campos del emisor que la bitacora vigila: la llave es como se guarda en el
// detalle, `columna` es de donde sale en getEmisor y `nombre` como se dice en el
// renglon. La empresa lleva prefijo porque su razon social y su domicilio no son los
// de la sucursal aunque la columna se llame igual.
function camposDeEmisor() {
    return [
        'business_name'          => ['columna' => 'business_name',        'nombre' => 'razón social'],
        'rfc'                    => ['columna' => 'rfc',                  'nombre' => 'RFC'],
        'phone'                  => ['columna' => 'phone',                'nombre' => 'teléfono'],
        'fiscal_address'         => ['columna' => 'fiscal_address',       'nombre' => 'lugar de expedición'],
        'pos'                    => ['columna' => 'pos_name',             'nombre' => 'punto de venta'],
        'adjustment_tolerance'   => ['columna' => 'adjustment_tolerance', 'nombre' => 'tolerancia de ajuste'],
        'company_business_name'  => ['columna' => 'company_name',         'nombre' => 'lema'],
        'company_fiscal_address' => ['columna' => 'company_address',      'nombre' => 'domicilio fiscal']
    ];
}

// La tolerancia es dinero y se compara con sus dos decimales; el resto es texto sin
// espacios de sobra, y NULL y cadena vacia son lo mismo: un campo en blanco.
function valorDeEmisor($campo, $valor) {
    if ($campo === 'adjustment_tolerance') return round((float) $valor, 2);

    return trim((string) $valor);
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
