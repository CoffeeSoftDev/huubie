<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-facture-catalogos.php';

class ctrl extends mdl {

    public $branch;

    public function __construct() {
        parent::__construct();
        $this->branch = $this->resolveBranch();

        // La tabla y los kpis se piden juntos tras cada escritura: sin cerrar la
        // sesion aqui, el lock de sesion de PHP los serializa aunque el navegador
        // los dispare al mismo tiempo.
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

    // Los auxiliares encabezan la lista porque son la marca con la que abre el
    // modulo: el resto del catalogo se consulta desde aqui, pero no es lo que se
    // viene a ver. El id de cada opcion es la clave del mapa de whereClase().
    function init() {
        return [
            'tipos' => [
                ['id' => 'puente',      'valor' => 'Productos auxiliares'],
                ['id' => 'modificador', 'valor' => 'Modificadores'],
                ['id' => 'normal',      'valor' => 'Sin marcar'],
                ['id' => 'inactivos',   'valor' => 'Inactivos'],
                ['id' => '',            'valor' => 'Todos']
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
        $like = '%' . trim($_POST['q'] ?? '') . '%';

        return [$this->branchId(), $like, $like];
    }

    // El valor del select no viaja al SQL: cada opcion tiene aqui su condicion
    // fija, y lo que no este en el mapa no filtra.
    //
    // La marca llega como 'clase' porque createTable reserva la llave 'tipo' para el
    // modo de validar_contenedor y no la reenvia.
    function whereClase() {
        $mapa = [
            'puente'      => ' AND is_bridge = 1 ',
            'modificador' => ' AND is_modifier = 1 ',
            'normal'      => ' AND is_bridge = 0 AND is_modifier = 0 ',
            'inactivos'   => ' AND active = 0 '
        ];

        return $mapa[$_POST['clase'] ?? ''] ?? '';
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

    // Las dos marcas del producto se cambian con el interruptor de su celda, sin
    // abrir el formulario: son las dos columnas que se repasan de corrido cuando se
    // arma el catalogo de auxiliares.
    //
    // Los kpis viajan en la misma respuesta: el switch de la celda dispara esta
    // consulta para refrescar la tabla, y sin esto necesitaria una segunda vuelta
    // al servidor solo para las tarjetas.
    function lsProductos() {
        $__row = [];
        foreach ($this->listProduct($this->filtros(), $this->whereClase()) as $item) {
            $__row[] = [
                'id'                => $item['code'],
                'Codigo'            => cellCodigo($item['code']),
                'Nombre'            => cellNombre($item['name'], $item['active']),
                'Precio'            => cellPrecio($item['price']),
                'Producto auxiliar' => switchCell($item['code'], 'puente', $item['is_bridge']),
                'Modificador'       => switchCell($item['code'], 'modificador', $item['is_modifier']),
                'Estatus'           => statusBadge($item['active']),
                'a'                 => productoButtons($item['code'], $item['active'])
            ];
        }

        return [
            'row'   => $__row,
            'thead' => ['Codigo', 'Nombre', 'Precio', 'Producto auxiliar', 'Modificador', 'Estatus', 'Acciones'],
            'kpis'  => $this->productKpis()
        ];
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
    //
    // Las escrituras van por consulta dedicada con arreglo posicional, sin pasar
    // por util->sql(): su comparacion suelta ($value == '') convierte is_bridge,
    // is_modifier o price en 0 a NULL, y las columnas son NOT NULL con STRICT_ALL_TABLES.
    function saveProducto() {
        $code   = trim($_POST['code'] ?? '');
        $previo = trim($_POST['previo'] ?? '');

        if ($code === '') return ['status' => 400, 'message' => 'La clave del producto es obligatoria'];

        $nombre     = trim($_POST['nombre'] ?? '');
        $precio     = (float) ($_POST['precio'] ?? 0);
        $isBridge   = (int) ($_POST['puente'] ?? 0);
        $isModifier = (int) ($_POST['modificador'] ?? 0);

        $existe = $previo !== '' ? $previo : $code;
        $actual = $this->getProductByCode([$existe, $this->branchId()]);

        $guardado = !empty($actual)
            ? $this->updateProduct([$code, $nombre, $precio, $isBridge, $isModifier, $actual[0]['id']])
            : $this->createProduct([$code, $nombre, $precio, $isBridge, $isModifier, $this->branchId()]);

        return [
            'status'  => $guardado ? 200 : 500,
            'message' => $guardado ? 'Producto guardado' : 'No se pudo guardar el producto'
        ];
    }

    // El interruptor de la fila manda que marca toca y con que valor se queda. La
    // columna se resuelve contra un mapa fijo (nunca texto libre del usuario) y
    // viaja como literal seguro en el SET de la consulta dedicada.
    function editProductoFlag() {
        $columnas = ['puente' => 'is_bridge', 'modificador' => 'is_modifier'];
        $columna  = $columnas[$_POST['campo'] ?? ''] ?? '';

        if ($columna === '') return ['status' => 400, 'message' => 'La marca no existe'];

        $ls = $this->getProductByCode([$_POST['code'] ?? '', $this->branchId()]);

        if (empty($ls)) return ['status' => 404, 'message' => 'El producto no existe'];

        $valor    = (int) ($_POST['valor'] ?? 0);
        $guardado = $this->updateProductFlag($columna, [$valor, $ls[0]['id']]);

        return [
            'status'  => $guardado ? 200 : 500,
            'message' => $guardado ? 'Marca actualizada' : 'No se pudo actualizar la marca'
        ];
    }

    // Baja logica y reversible: los renglones de comanda ya cargados apuntan al
    // producto por id, asi que borrarlo de verdad dejaria el historico sin a que
    // colgarse. El mismo boton lo vuelve a dar de alta.
    function editProductoStatus() {
        $ls = $this->getProductByCode([$_POST['code'] ?? '', $this->branchId()]);

        if (empty($ls)) return ['status' => 404, 'message' => 'El producto no existe'];

        $activo   = (int) ($_POST['valor'] ?? 0);
        $guardado = $this->updateProductActive([$activo, $ls[0]['id']]);

        return [
            'status'  => $guardado ? 200 : 500,
            'message' => $guardado
                ? ($activo ? 'Producto activado' : 'Producto dado de baja')
                : 'No se pudo cambiar el estatus del producto'
        ];
    }

    // -- Meseros --

    // El mesero que sigue con su clave por nombre es el que la carga dio de alta y
    // nadie ha bautizado: se marca para que se vea cual falta capturar.
    function lsMeseros() {
        $__row = [];
        foreach ($this->listWaiter($this->filtros()) as $item) {
            $__row[] = [
                'id'      => $item['code'],
                'Codigo'  => cellCodigo($item['code']),
                'Nombre'  => cellMesero($item['name'], $item['code'], $item['active']),
                'Estatus' => statusBadge($item['active']),
                'a'       => meseroButtons($item['code'], $item['active'])
            ];
        }

        return [
            'row'   => $__row,
            'thead' => ['Codigo', 'Nombre', 'Estatus', 'Acciones']
        ];
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

    // Consulta dedicada con arreglo posicional: la baja (active = 0) pasada por
    // util->sql() se convierte en NULL por su comparacion suelta y la columna es
    // NOT NULL con STRICT_ALL_TABLES.
    function editMeseroStatus() {
        $ls = $this->getWaiterByCode([$_POST['code'] ?? '', $this->branchId()]);

        if (empty($ls)) return ['status' => 404, 'message' => 'El mesero no existe'];

        $activo   = (int) ($_POST['valor'] ?? 0);
        $guardado = $this->updateWaiterActive([$activo, $ls[0]['id']]);

        return [
            'status'  => $guardado ? 200 : 500,
            'message' => $guardado
                ? ($activo ? 'Mesero activado' : 'Mesero dado de baja')
                : 'No se pudo cambiar el estatus del mesero'
        ];
    }

    // -- Indicadores --

    // Compartida por lsProductos() (viaja en la misma respuesta que la tabla) y por
    // showKpis() (cifras de producto + mesero juntas para cuando la vista lo pida
    // aparte). El buscador es comun a las dos vistas.
    function productKpis() {
        $producto = $this->getProductCounts($this->filtros(), $this->whereClase());
        $p = $producto[0] ?? ['productos' => 0, 'puente' => 0, 'modificadores' => 0, 'precio_promedio' => 0];

        return [
            'productos'      => (int) $p['productos'],
            'puente'         => (int) $p['puente'],
            'modificadores'  => (int) $p['modificadores'],
            'precioPromedio' => money($p['precio_promedio'])
        ];
    }

    // Las dos vistas se sirven de una sola consulta: el buscador es comun a las dos
    // y el cambio de pestaña no vuelve a pedir cifras al servidor.
    function showKpis() {
        $mesero = $this->getWaiterCounts($this->filtros());
        $m = $mesero[0] ?? ['meseros' => 0, 'activos' => 0, 'sin_nombre' => 0];

        return array_merge($this->productKpis(), [
            'meseros'          => (int) $m['meseros'],
            'meserosActivos'   => (int) $m['activos'],
            'meserosBaja'      => (int) $m['meseros'] - (int) $m['activos'],
            'meserosSinNombre' => (int) $m['sin_nombre']
        ]);
    }
}

// Complements

function money($valor) {
    return '$' . number_format((float) $valor, 2);
}

function cellCodigo($code) {
    return '<span class="font-mono text-[10px] text-gray-400">' . $code . '</span>';
}

// El nombre pierde fuerza cuando el producto esta de baja: es la primera senal de
// la fila, antes de llegar a la columna de estatus.
function cellNombre($name, $active) {
    $tono = (int) $active === 1 ? 'text-gray-300' : 'text-gray-500 line-through';

    return '<span class="font-semibold ' . $tono . '">' . $name . '</span>';
}

function cellPrecio($price) {
    return '<span class="text-gray-400">' . money($price) . '</span>';
}

function cellMesero($name, $code, $active) {
    $pendiente = $name === $code
        ? '<span class="badge-base b-yellow ml-2">Sin nombre</span>'
        : '';

    return cellNombre($name, $active) . $pendiente;
}

// Interruptor de la marca: escribe el valor contrario al que muestra, de modo que
// la celda es el control y no hace falta abrir el formulario para una sola casilla.
function switchCell($code, $campo, $valor) {
    $on   = (int) $valor === 1;
    $tono = $campo === 'modificador' ? ' cs-switch-gray' : '';

    return '<button type="button"
                    class="cs-switch' . $tono . ($on ? ' is-on' : '') . '"
                    title="' . ($on ? 'Quitar marca' : 'Marcar') . '"
                    onclick="catalogos.editProductoFlag(\'' . $code . '\', \'' . $campo . '\', ' . ($on ? 0 : 1) . ')">
                <span class="cs-switch-knob"></span>
            </button>';
}

function statusBadge($active) {
    return (int) $active === 1
        ? '<span class="badge-base b-green">Activo</span>'
        : '<span class="badge-base b-red">Inactivo</span>';
}

// El mismo boton da de baja y vuelve a dar de alta: la baja es logica, asi que la
// fila no desaparece y el estatus se corrige desde donde se ve.
function statusButton($code, $active, $accion) {
    $on = (int) $active === 1;

    return [
        'class'   => $on ? 'btn-icon-danger' : 'btn-icon-success',
        'html'    => '<i data-lucide="power" class="w-3.5 h-3.5"></i>',
        'title'   => $on ? 'Dar de baja' : 'Activar',
        'onclick' => "{$accion}('{$code}', " . ($on ? 0 : 1) . ")"
    ];
}

function productoButtons($code, $active) {
    return [
        [
            'class'   => 'btn-icon-view',
            'html'    => '<i data-lucide="pencil" class="w-3.5 h-3.5"></i>',
            'title'   => 'Editar producto',
            'onclick' => "catalogosView.editProducto('{$code}')"
        ],
        statusButton($code, $active, 'catalogos.editProductoStatus')
    ];
}

function meseroButtons($code, $active) {
    return [
        [
            'class'   => 'btn-icon-view',
            'html'    => '<i data-lucide="pencil" class="w-3.5 h-3.5"></i>',
            'title'   => 'Editar mesero',
            'onclick' => "catalogosView.editMesero('{$code}')"
        ],
        statusButton($code, $active, 'catalogos.editMeseroStatus')
    ];
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
