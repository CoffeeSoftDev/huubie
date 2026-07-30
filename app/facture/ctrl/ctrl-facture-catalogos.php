<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-facture-catalogos.php';

class ctrl extends mdl {

    public $branch;

    public function __construct() {
        parent::__construct();
        $this->branch = $this->resolveBranch();
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
            'tipos' => [
                ['id' => '',          'valor' => 'Todos los catalogos'],
                ['id' => 'productos', 'valor' => 'Productos'],
                ['id' => 'meseros',   'valor' => 'Meseros']
            ],
            'sino' => [
                ['id' => '1', 'valor' => 'Si'],
                ['id' => '0', 'valor' => 'No']
            ],
            'emisor' => $this->emisor()
        ];
    }

    // -- Filtros --

    // El buscador cae sobre clave y nombre en las dos tablas, asi que el arreglo de
    // parametros es el mismo para productos y para meseros.
    function filtros() {
        $q     = trim($_POST['q'] ?? '');
        $like  = '%' . $q . '%';

        return [
            'tipo' => $_POST['tipo'] ?? '',
            'data' => [$this->branchId(), $like, $like]
        ];
    }

    // -- Emisor --

    // Lo que se imprime en el ticket sale de la sucursal. Si no tiene razon social
    // propia se encabeza con la de la empresa, que es la dueña del RFC.
    function emisor() {
        $ls = $this->getEmisor([$this->branchId()]);

        if (empty($ls)) {
            return ['razon' => '', 'rfc' => '', 'telefono' => '', 'domicilio' => ''];
        }

        $item = $ls[0];

        return [
            'razon'     => $item['business_name'] ?: $item['company_name'],
            'rfc'       => $item['rfc'] ?: $item['company_rfc'],
            'telefono'  => $item['phone'],
            'domicilio' => $item['fiscal_address']
        ];
    }

    function saveEmisor() {
        $status  = 500;
        $message = 'No se pudieron guardar los datos del emisor';

        if (!$this->branchId()) {
            return ['status' => 400, 'message' => 'No hay sucursal dada de alta en el facturador'];
        }

        $update = $this->updateBranch($this->util->sql([
            'business_name'  => $_POST['razon']     ?? '',
            'rfc'            => $_POST['rfc']       ?? '',
            'phone'          => $_POST['telefono']  ?? '',
            'fiscal_address' => $_POST['domicilio'] ?? '',
            'id'             => $this->branchId()
        ], 1));

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

    // -- Productos --

    // El tipo del filtro apaga la tabla que no se pidio: las dos viven en la misma
    // pantalla, asi que el filtro decide cual trae filas en vez de esconderla.
    function lsProductos() {
        $filtros = $this->filtros();

        if ($filtros['tipo'] === 'meseros') return ['row' => [], 'thead' => ''];

        $__row = [];
        foreach ($this->listProduct($filtros['data']) as $item) {
            $__row[] = [
                'id'          => $item['code'],
                'Codigo'      => cellCodigo($item['code']),
                'Nombre'      => '<span class="font-semibold text-gray-300">' . $item['name'] . '</span>',
                'Precio'      => '<span class="text-gray-400">' . money($item['price']) . '</span>',
                'Puente'      => badgeSiNo($item['is_bridge'], 'b-green'),
                'Modificador' => badgeSiNo($item['is_modifier'], 'b-yellow'),
                'a'           => productoButtons($item['code'])
            ];
        }

        return ['row' => $__row, 'thead' => ''];
    }

    function getProducto() {
        $ls = $this->getProductByCode([$_POST['code'] ?? '', $this->branchId()]);

        if (empty($ls)) return ['status' => 404, 'message' => 'El producto no existe'];

        $item = $ls[0];

        return [
            'status'   => 200,
            'producto' => [
                'code'        => $item['code'],
                'nombre'      => $item['name'],
                'precio'      => (float) $item['price'],
                'puente'      => (string) (int) $item['is_bridge'],
                'modificador' => (string) (int) $item['is_modifier']
            ]
        ];
    }

    // Alta y edicion comparten campos: la clave decide cual de las dos es. La clave
    // es la del POS, asi que un producto que ya existe se edita, no se duplica (la
    // UNIQUE (code, branch_id) lo rechazaria).
    function saveProducto() {
        $code   = trim($_POST['code'] ?? '');
        $previo = trim($_POST['previo'] ?? '');

        if ($code === '') return ['status' => 400, 'message' => 'La clave del producto es obligatoria'];

        $campos = [
            'code'        => $code,
            'name'        => trim($_POST['nombre'] ?? ''),
            'price'       => (float) ($_POST['precio'] ?? 0),
            'is_bridge'   => (int) ($_POST['puente'] ?? 0),
            'is_modifier' => (int) ($_POST['modificador'] ?? 0)
        ];

        $existe = $previo !== '' ? $previo : $code;
        $actual = $this->getProductByCode([$existe, $this->branchId()]);

        if (!empty($actual)) {
            $campos['id'] = $actual[0]['id'];
            $guardado     = $this->updateProduct($this->util->sql($campos, 1));
        } else {
            $campos['branch_id'] = $this->branchId();
            $guardado            = $this->createProduct($this->util->sql([$campos]));
        }

        return [
            'status'  => $guardado ? 200 : 500,
            'message' => $guardado ? 'Producto guardado' : 'No se pudo guardar el producto'
        ];
    }

    // Baja logica: los renglones de comanda ya cargados apuntan al producto por id,
    // asi que borrarlo de verdad dejaria el historico sin a que colgarse.
    function deleteProducto() {
        $ls = $this->getProductByCode([$_POST['code'] ?? '', $this->branchId()]);

        if (empty($ls)) return ['status' => 404, 'message' => 'El producto no existe'];

        $baja = $this->updateProduct($this->util->sql([
            'active' => 0,
            'id'     => $ls[0]['id']
        ], 1));

        return [
            'status'  => $baja ? 200 : 500,
            'message' => $baja ? 'Producto dado de baja' : 'No se pudo dar de baja el producto'
        ];
    }

    // -- Meseros --

    function lsMeseros() {
        $filtros = $this->filtros();

        if ($filtros['tipo'] === 'productos') return ['row' => [], 'thead' => ''];

        $__row = [];
        foreach ($this->listWaiter($filtros['data']) as $item) {
            $__row[] = [
                'id'     => $item['code'],
                'Codigo' => cellCodigo($item['code']),
                'Nombre' => '<span class="font-semibold text-gray-300">' . $item['name'] . '</span>',
                'a'      => meseroButtons($item['code'])
            ];
        }

        return ['row' => $__row, 'thead' => ''];
    }

    function getMesero() {
        $ls = $this->getWaiterByCode([$_POST['code'] ?? '', $this->branchId()]);

        if (empty($ls)) return ['status' => 404, 'message' => 'El mesero no existe'];

        return [
            'status' => 200,
            'mesero' => [
                'code'   => $ls[0]['code'],
                'nombre' => $ls[0]['name']
            ]
        ];
    }

    // La carga de comandas da de alta al mesero con su clave como nombre: aqui es
    // donde se le escribe el nombre real.
    function saveMesero() {
        $code   = trim($_POST['code'] ?? '');
        $previo = trim($_POST['previo'] ?? '');

        if ($code === '') return ['status' => 400, 'message' => 'La clave del mesero es obligatoria'];

        $campos = [
            'code' => $code,
            'name' => trim($_POST['nombre'] ?? '') ?: $code
        ];

        $existe = $previo !== '' ? $previo : $code;
        $actual = $this->getWaiterByCode([$existe, $this->branchId()]);

        if (!empty($actual)) {
            $campos['id'] = $actual[0]['id'];
            $guardado     = $this->updateWaiter($this->util->sql($campos, 1));
        } else {
            $campos['branch_id'] = $this->branchId();
            $guardado            = $this->createWaiter($this->util->sql([$campos]));
        }

        return [
            'status'  => $guardado ? 200 : 500,
            'message' => $guardado ? 'Mesero guardado' : 'No se pudo guardar el mesero'
        ];
    }

    function deleteMesero() {
        $ls = $this->getWaiterByCode([$_POST['code'] ?? '', $this->branchId()]);

        if (empty($ls)) return ['status' => 404, 'message' => 'El mesero no existe'];

        $baja = $this->updateWaiter($this->util->sql([
            'active' => 0,
            'id'     => $ls[0]['id']
        ], 1));

        return [
            'status'  => $baja ? 200 : 500,
            'message' => $baja ? 'Mesero dado de baja' : 'No se pudo dar de baja el mesero'
        ];
    }

    // -- Indicadores --

    function showKpis() {
        $filtros  = $this->filtros();
        $producto = $this->getProductCounts($filtros['data']);
        $mesero   = $this->getWaiterCounts($filtros['data']);

        $p = $producto[0] ?? ['productos' => 0, 'puente' => 0, 'modificadores' => 0, 'suma_puente' => 0];

        return [
            'productos'     => (int) $p['productos'],
            'puente'        => (int) $p['puente'],
            'modificadores' => (int) $p['modificadores'],
            'sumaPuente'    => money($p['suma_puente']),
            'meseros'       => (int) ($mesero[0]['meseros'] ?? 0)
        ];
    }
}

// Complements

function money($valor) {
    return '$' . number_format((float) $valor, 2);
}

function cellCodigo($code) {
    return '<span class="font-mono text-[10px] text-gray-400">' . $code . '</span>';
}

function badgeSiNo($valor, $tone) {
    return (int) $valor === 1
        ? '<span class="badge-base ' . $tone . '">Si</span>'
        : '<span class="badge-base b-gray">No</span>';
}

function productoButtons($code) {
    return [
        [
            'class'   => 'btn-icon-view',
            'html'    => '<i data-lucide="pencil" class="w-3.5 h-3.5"></i>',
            'title'   => 'Editar producto',
            'onclick' => "catalogosView.editProducto('{$code}')"
        ],
        [
            'class'   => 'btn-icon-danger',
            'html'    => '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>',
            'title'   => 'Dar de baja',
            'onclick' => "catalogos.deleteProducto('{$code}')"
        ]
    ];
}

function meseroButtons($code) {
    return [
        [
            'class'   => 'btn-icon-view',
            'html'    => '<i data-lucide="pencil" class="w-3.5 h-3.5"></i>',
            'title'   => 'Editar mesero',
            'onclick' => "catalogosView.editMesero('{$code}')"
        ],
        [
            'class'   => 'btn-icon-danger',
            'html'    => '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>',
            'title'   => 'Dar de baja',
            'onclick' => "catalogos.deleteMesero('{$code}')"
        ]
    ];
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
