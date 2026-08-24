<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-facture-emisor.php';

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
                'razon' => '', 'lema' => '', 'rfc' => '', 'telefono' => '', 'domicilio' => '', 'expedicion' => '',
                'pos_id' => '', 'pos_name' => '', 'pos_code' => '', 'pos_color' => ''
            ];
        }

        $item = $ls[0];

        return [
            'razon'      => $item['business_name'] ?: $item['company_name'],
            'lema'       => $item['company_name'],
            'rfc'        => $item['rfc'] ?: $item['company_rfc'],
            'telefono'   => $item['phone'] ?: $item['company_phone'],
            'domicilio'  => $item['company_address'] ?: $item['fiscal_address'],
            'expedicion' => $item['fiscal_address'],
            'pos_id'     => $item['pos_id']    ?? '',
            'pos_name'   => $item['pos_name']  ?? '',
            'pos_code'   => $item['pos_code']  ?? '',
            'pos_color'  => $item['pos_color'] ?? ''
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

        $campos['id'] = $this->branchId();

        $update = $this->updateBranch($this->util->sql($campos, 1));

        $this->saveCompany();

        if ($update) {
            $status  = 200;
            $message = 'Datos del emisor actualizados';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'emisor'  => $this->emisor()
        ];
    }

    // Lema y domicilio fiscal son de la empresa. Si el lema llega vacio no se pisa:
    // company.business_name es la razon social del membrete y borrarla dejaria al
    // papel sin encabezado cuando la sucursal tampoco tiene nombre propio.
    function saveCompany() {
        $ls = $this->getEmisor([$this->branchId()]);

        if (empty($ls) || empty($ls[0]['company_id'])) return false;

        $campos = ['fiscal_address' => $_POST['domicilio'] ?? ''];

        if (trim($_POST['lema'] ?? '') !== '') $campos['business_name'] = $_POST['lema'];

        $campos['id'] = $ls[0]['company_id'];

        return $this->updateCompany($this->util->sql($campos, 1));
    }
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
