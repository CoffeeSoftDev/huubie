# PIVOTE ADMIN PEDIDOS

## DESCRIPCION
Este módulo forma parte del sistema Administrador y está diseñado para permitir al usuario gestionar eficientemente los productos disponibles en una tienda o catálogo digital.

Este módulo está optimizado con TailwindCSS y usa componentes de CoffeeSoft para asegurar una experiencia fluida, adaptable y profesional.

Esta separado en tres pestañas:
 - Productos
 - Categorias
 - Clientes

### ADMIN.JS [ FRONT-JS]
```javascript
let app,category,client;

let cat;
const api = "../pedidos/ctrl/ctrl-admin.php";

$(async () => {

    const data = await useFetch({ url: api, data: { opc: "init" } });
    cat  = data.category;

    app      = new App(api, "root");
    category = new Category(api, "root");
    client  = new Client(api, "root");
    app.render();

});


class App extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Admin";
        this.dataProducto = [];
    }

    render() {
        this.layout();

        this.filterBarProductos();
        this.lsProductos();
        category.lsCategory();
        client.lsClientes();

    }

    layout() {

        this.primaryLayout({
            parent: `root`,
            id: this.PROJECT_NAME,
            class: 'flex mx-2 my-2 h-100 mt-5 p-2 ',
            card: {
                filterBar: { class: 'w-full my-3', id: 'filterBar' + this.PROJECT_NAME },
                container: { class: 'w-full my-3 h-full  rounded-lg p-3', id: 'container' + this.PROJECT_NAME }
            }
        });

        // layout
        this.layoutTabs();
        category.filterBarCategory();
        client.filterBarClient();
    }

    layoutTabs() {
        this.tabLayout({
            parent: "container" + this.PROJECT_NAME,
            id: "tabsPedidos",
            content: { class: "" },
            theme: "dark",
            type: 'short',
            json: [
                {
                    id: "productos",
                    tab: "Productos",
                    class:'mb-1',
                    onClick: () => this.lsProductos(),
                    active: true,
                },
                {
                    id: "categoria",
                    tab: "Categoría",
                    onClick: () => category.lsCategory()
                },
                {
                    id: "cliente",
                    tab: "Clientes",
                    onClick: () => client.lsClient()
                }
            ]
        });

        $("#container" + this.PROJECT_NAME).prepend(`
        <div class="px-4 pt-3 pb-3">
            <h2 class="text-2xl font-semibold text-white">📦 Administrador</h2>
            <p class="text-gray-400">Gestiona productos, categorías y clientes.</p>
        </div>`);
    }

    filterBarProductos() {
        const container = $("#container-productos");
        container.html('<div id="filterbar-productos" class="mb-2"></div><div id="tabla-productos"></div>');

        this.createfilterBar({
            parent: "filterbar-productos",
            data: [
                {
                    opc: "select",
                    id: "estado-productos",
                    class: "col-12 col-md-3",
                    data: [
                        { id: "1", valor: "Disponibles" },
                        { id: "0", valor: "No disponibles" }
                    ],
                    onchange: ' app.lsProductos()'
                },
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNuevoProducto",
                    text: "Nuevo Producto",
                    onClick: () => this.addProducto(),
                },
            ],
        });


    }

    // Productos

    lsProductos() {
        this.createTable({
            parent: "tabla-productos",
            idFilterBar: "idFilterBar",
            data: { opc: "listProductos" },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbProductos",
                theme: 'dark',
                right:[3],
                center:[1,6]
            },
        });
    }

    addProducto() {

        this.createModalForm({
            id: 'formProductoAdd',
            data: { opc: 'addProducto' },
            bootbox: {
                title: 'Agregar Producto',
            },
            json: [
                {
                    opc: "input",
                    id: "name",
                    lbl: "Nombre del Producto",
                    class: "col-12 mb-3"
                },
                {
                    opc: "input",
                    id: "price",
                    lbl: "Precio",
                    tipo: "cifra",
                    class: "col-12 mb-3",
                    onkeyup: "validationInputForNumber('#price')"
                },
                {
                    opc: "textarea",
                    id: "description",
                    lbl: "Descripción",
                    class: "col-12 mb-3"
                },
                {
                    opc: "select",
                    id: "category_id",
                    lbl: "Clasificación",
                    class: "col-12",
                    data: cat,
                    text: "classification",
                    value: "id"
                },
                {
                    opc: "div",
                    id: "image",
                    lbl: "Fotos o videos del producto",
                    class: "col-12 mt-3",
                    html: `
                        <div class="w-full p-4 border-2 border-dashed border-violet-500 rounded-xl bg-[#1F2A37] text-center">
                            <div class="flex flex-col items-center justify-center py-6">
                                <div class="w-12 h-12 bg-violet-600 rounded-full flex items-center justify-center mb-4">
                                    <i class="fas fa-upload text-white"></i>
                                </div>
                                <p class="text-white text-sm">
                                    Drag & Drop or <span class="text-violet-400 cursor-pointer underline">choose file</span> to upload
                                </p>
                                <p class="text-xs text-gray-400 mt-2">Supported formats : Jpeg, pdf</p>
                            </div>
                        </div>
                        `
                },

            ],
            success: (response) => {
                console.log(response);
                if (response.status === 200) {
                    alert({ icon: "success", text: response.message });
                    this.lsProductos();
                } else {
                    alert({ icon: "info", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                }
            }
        });

    }

    async editProducto(id) {

        const request = await useFetch({
            url: this._link,
            data: {
                opc: "getProducto",
                id: id,
            },
        });

        const producto = request.data;

        this.createModalForm({
            id: 'formProductoEdit',
            data: { opc: 'editProducto', id: producto.id },
            bootbox: {
                title: 'Editar Producto',
            },
            autofill: producto,
            json: [
                {
                    opc: "input",
                    id: "name",
                    lbl: "Nombre del Producto",
                    class: "col-12 mb-3"
                },
                {
                    opc: "input",
                    id: "price",
                    lbl: "Precio",
                    tipo: "cifra",
                    class: "col-12 mb-3",
                    onkeyup: "validationInputForNumber('#price')"
                },
                {
                    opc: "textarea",
                    id: "description",
                    lbl: "Descripción",
                    class: "col-12 mb-3"
                },
                {
                    opc  : "select",
                    id   : "category_id",
                    lbl  : "Clasificación",
                    class: "col-12",
                    data : cat,
                    text : "classification",
                    value: "id"
                },
                {
                    opc: "div",
                    id: "image",
                    lbl: "Fotos o videos del producto",
                    class: "col-12 mt-3",
                    html: `
                    <div class="w-full p-4 border-2 border-dashed border-violet-500 rounded-xl bg-[#1F2A37] text-center">
                        <div class="flex flex-col items-center justify-center py-6">
                            <div class="w-12 h-12 bg-violet-600 rounded-full flex items-center justify-center mb-4">
                                <i class="fas fa-upload text-white"></i>
                            </div>
                            <p class="text-white text-sm">
                                Drag & Drop or <span class="text-violet-400 cursor-pointer underline">choose file</span> to upload
                            </p>
                            <p class="text-xs text-gray-400 mt-2">Supported formats : Jpeg, pdf</p>
                        </div>
                    </div>
                `
                }


            ],
            success: (response) => {
                this.lsProductos();
            },
        });
    }

    statusProducto(id, active) {
        this.swalQuestion({
            opts: {
                title: "¿Desea cambiar el estado del Producto? " + active,
                text: "Esta acción ocultará o reactivará el producto.",
                icon: "warning",
            },

            data: {
                opc: "statusProducto",
                active: active === 1 ? 0 : 1,
                id: id,
            },

            methods: {
                send: () => this.lsProductos(),
            },
        });
    }




}

class Category extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Categorias";
    }


    filterBarCategory() {
        const container = $("#container-categoria");
        container.html('<div id="filterbar-category" class="mb-2"></div><div id="table-category"></div>');

        this.createfilterBar({
            parent: "filterbar-category",
            data: [
                {
                    opc: "select",
                    id: "active",
                    class: "col-12 col-md-3",
                    data: [
                        { id: "1", valor: "Disponibles" },
                        { id: "0", valor: "No disponibles" }
                    ],
                    onchange: ' category.lsCategory()'
                },
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNewCategory",
                    text: "Nueva categoria ",
                    onClick: () => this.addCategory(),
                },
            ],
        });
    }

    lsCategory() {
        this.createTable({
            parent: "table-category",
            idFilterBar: "filterbar-category",
            data: { opc: "listCategory" },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbCategory",
                theme: 'dark'
            },
        });
    }

    addCategory() {
        this.createModalForm({
            id: 'formCategoryAdd',
            data: { opc: 'addCategory' },
            bootbox: {
                title: 'Agregar categoria',
            },
            json: [
                {
                    opc: "input",
                    id: "classification",
                    lbl: "Category Name",
                    class: "col-12 mb-3"
                },
                {
                    opc: "textarea",
                    id: "description",
                    lbl: "Description",
                    class: "col-12 mb-3"
                }
            ],
            success: (response) => {
                if (response.status === 200) {
                    alert({ icon: "success", text: response.message });
                    this.loadCategory();
                } else {
                    alert({ icon: "info", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                }
            }
        });
    }

    async editCategory(id) {
        const request = await useFetch({
            url: this._link,
            data: {
                opc: "getCategories",
                id: id,
            },
        });


        const data = request.data;

        this.createModalForm({
            id: 'formCategoriaEdit',
            data: { opc: 'editCategory', id: id },
            bootbox: {
                title: 'Editar Categoría',
            },
            autofill: data,
            json: [
                {
                    opc: "input",
                    id: "classification",
                    lbl: "Nombre de la categoría",
                    class: "col-12 mb-3"
                },
                {
                    opc: "textarea",
                    id: "description",
                    lbl: "Descripción",
                    class: "col-12 mb-3"
                }
            ],
            success: (response) => {
                if (response.status === 200) {
                    alert({ icon: "success", text: response.message });
                    this.lsCategory();
                } else {
                    alert({ icon: "info", title: "Oops!...", text: response.message });
                }
            }
        });
    }

    statusCategory(id, estado) {

        this.swalQuestion({

            opts: {
                title: "¿Desea cambiar el estado de la categoría?",
                text: "Esta acción activará o desactivará la categoría.",
                icon: "warning",
            },

            data: {

                opc   : "statusCategory",
                active: estado === 1 ? 0: 1,
                id    : id,

            },

            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message });
                        this.lsCategory();
                    } else {
                        alert({ icon: "info", title: "Oops!...", text: response.message });
                    }
                }
            },
        });

    }




}

class Client extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Client";
    }

    filterBarClient() {
        const container = $("#container-cliente");
        container.html('<div id="filterbar-client" class="mb-2"></div><div id="table-client"></div>');

        this.createfilterBar({
            parent: "filterbar-client",
            data: [
                {
                    opc: "select",
                    id: "active",
                    class: "col-12 col-md-3",
                    data: [
                        { id: "1", valor: "Disponibles" },
                        { id: "0", valor: "No disponibles" }
                    ],
                    onchange: ' client.lsClient()'
                },
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNewClient",
                    text: "Nuevo Cliente",
                    onClick: () => this.addClient(),
                },
            ],
        });
    }

    lsClient() {
        this.createTable({
            parent: "table-client",
            idFilterBar: "filterbar-client",
            data: { opc: "listClient" },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbClient",
                theme: 'dark'
            },
        });
    }

    addClient() {
        this.createModalForm({
            id: 'formClientAdd',
            data: { opc: 'addClient' },
            bootbox: {
                title: 'Agregar Cliente',
            },
            json: [
                {
                    opc: "input",
                    id: "name",
                    lbl: "Nombre del Cliente",
                    class: "col-12 mb-3"
                },
                {
                    opc: "input",
                    id: "email",
                    lbl: "Correo Electrónico",
                    class: "col-12 mb-3"
                },
                {
                    opc: "input",
                    id: "phone",
                    lbl: "Teléfono",
                    class: "col-12 mb-3"
                }
            ],
            success: (response) => {
                if (response.status === 200) {
                    alert({ icon: "success", text: response.message });
                    this.lsClient();
                } else {
                    alert({ icon: "info", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                }
            }
        });
    }

    async editClient(id) {
        const request = await useFetch({
            url: this._link,
            data: {
                opc: "getClient",
                id: id,
            },
        });

        const data = request.data;

        this.createModalForm({
            id: 'formClientEdit',
            data: { opc: 'editClient', id: id },
            bootbox: {
                title: 'Editar Cliente',
            },
            autofill: data,
            json: [
                {
                    opc: "input",
                    id: "name",
                    lbl: "Nombre del Cliente",
                    class: "col-12 mb-3"
                },
                {
                    opc: "input",
                    id: "email",
                    lbl: "Correo Electrónico",
                    class: "col-12 mb-3"
                },
                {
                    opc: "input",
                    id: "phone",
                    lbl: "Teléfono",
                    class: "col-12 mb-3"
                }
            ],
            success: (response) => {
                if (response.status === 200) {
                    alert({ icon: "success", text: response.message });
                    this.lsClient();
                } else {
                    alert({ icon: "info", title: "Oops!...", text: response.message });
                }
            }
        });
    }

    deleteClient(id) {
        this.swalQuestion({
            opts: {
                title: "¿Desea eliminar este cliente?",
                text: "Esta acción no se puede deshacer.",
                icon: "warning",
            },
            data: {
                opc: "deleteClient",
                id: id,
            },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message });
                        this.lsClient();
                    } else {
                        alert({ icon: "info", title: "Oops!...", text: response.message });
                    }
                }
            },
        });
    }
}

```

### ctrl-admin.php [ CTRL]
 ```php
 <?php
    session_start();
    if (empty($_POST['opc'])) exit(0);

    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

    require_once '../mdl/mdl-admin.php';

    class ctrl extends mdl {


        function init() {
            return [
                'category' => $this->lsCategory([])
            ];
        }

        // Products.

        function listProductos() {
            $active = $_POST['estado-productos'];
            $data   = $this->lsProductos([$active,$_SESSION['SUB']]);
            $rows   = [];

            foreach ($data as $item) {
                $a = [];

                if ($active == 1) {
                    $a[] = [
                        'class'   => 'btn btn-sm btn-primary me-1',
                        'html'    => '<i class="icon-pencil"></i>',
                        'onclick' => 'app.editProducto(' . $item['id'] . ')'
                    ];

                    $a[] = [
                        'class'   => 'btn btn-sm btn-danger',
                        'html'    => '<i class="icon-toggle-on"></i>',
                        'onclick' => 'app.statusProducto(' . $item['id'] . ', ' . $item['active'] . ')'
                    ];
                } else {
                    $a[] = [
                        'class'   => 'btn btn-sm btn-outline-danger',
                        'html'    => '<i class="icon-toggle-off"></i>',
                        'onclick' => 'app.statusProducto(' . $item['id'] . ', ' . $item['active'] . ')'
                    ];
                }

                $rows[] = [
                    'id'       => $item['id'],
                    'Producto' => [
                            'class' => ' justify-start  px-2 py-2 ',
                            'html'  => renderProductImage($costsys,$item['valor'])
                    ],
                    'Precio'          => evaluar($item['price']),
                    'Estado'          => renderStatus($item['active']),

                    'Inventario'  => $item['active'],
                    'Categoria'   => $item['classification'],
                    'Descripción' => $item['description'],

                    'a'               => $a
                ];
            }

            return [
                'row' => $rows,
                'ls'  => $data,
                $_SESSION['SUB']
            ];
        }

        function getProducto() {
            $id = $_POST['id'];
            $status = 404;
            $message = 'Producto no encontrado';
            $data = null;

            $producto = $this->getProductoById($id);

            if ($producto > 0) {
                $status  = 200;
                $message = 'Producto encontrado';
                $data    = $producto;
            }

            return [
                'status'  => $status,
                'message' => $message,
                'data'    => $data
            ];
        }

        function addProducto() {
            $status = 500;
            $message = 'No se pudo agregar el producto';
            $_POST['date_creation'] = date('Y-m-d H:i:s');
            $_POST['subsidiaries_id'] = $_SESSION['SUB'];

            $exists = $this->existsProductoByName([$_POST['name'], $_SESSION['SUB']]);

            if ($exists === 0) {
                $create = $this->createProducto($this->util->sql($_POST));
                if ($create) {
                    $status = 200;
                    $message = 'Producto agregado correctamente';
                }
            } else {
                $status = 409;
                $message = 'Ya existe un producto con ese nombre.';
            }

            return [
                'status' => $status,
                'message' => $message,
                'data' => $exists
            ];
        }

        function editProducto() {
            $id = $_POST['id'];
            $status = 500;
            $message = 'Error al editar producto';

            // if (!$this->existsOtherProductoByName([$_POST['name'], $id, $_SESSION['SUB']])) {
            //     $status = 409;
            //     $message = 'Ya existe otro producto con ese nombre.';
            // } else {
                $edit = $this->updateProducto($this->util->sql($_POST, 1));
                if ($edit) {
                    $status = 200;
                    $message = 'Producto editado correctamente';
                }
            // }

            return [
                'status' => $status,
                'message' => $message
            ];
        }

        function statusProducto() {
            $status = 500;
            $message = 'No se pudo actualizar el estado del producto';

            $update = $this->updateProducto($this->util->sql($_POST, 1));

            if ($update) {
                $status = 200;
                $message = 'El estado del producto se actualizó correctamente';
            }

            return [
                'status' => $status,
                'message' => $message,
                'update' => $update

            ];
        }

        // Category.

        function listCategory() {
            $__row = [];

            $ls    = $this->lsCategory([$_POST['active']]);

            foreach ($ls as $key) {

                $a = [];

                if ($key['active'] == 1) {
                    $a[] = [
                        'class'   => 'btn btn-sm btn-primary me-1',
                        'html'    => '<i class="icon-pencil"></i>',
                        'onclick' => 'category.editCategory(' . $key['id'] . ')'
                    ];

                    $a[] = [
                        'class'   => 'btn btn-sm btn-danger',
                        'html'    => '<i class="icon-toggle-on"></i>',
                        'onclick' => 'category.statusCategory(' . $key['id'] . ', ' . $key['active'] . ')'
                    ];
                } else {

                    $a[] = [
                        'class'   => 'btn btn-sm btn-outline-danger',
                        'html'    => '<i class="icon-toggle-off"></i>',
                        'onclick' => 'category.statusCategory(' . $key['id'] . ', ' . $key['active'] . ')'
                    ];
                }


                $__row[] = [
                    'id'          => $key['id'],
                    'Nombre'      => $key['valor'],
                    'Descripción' => $key['description'],
                    'Estado'      => renderStatus($key['active']),
                    'a'           => $a
                ];
            }

            return [
                'row' => $__row,
                'ls'  => $ls
            ];
        }

        function addCategory() {

            $_POST['date_creation']   = date('Y-m-d H:i:s');
            $_POST['active']          = 1;
            $_POST['subsidiaries_id'] = $_SESSION['SUB'];

            $data   = $this->util->sql($_POST);
            $create = $this->createCategory($data);

            return [
                'status'  => $create ? 200 : 500,
                'message' => $create ? 'Categoría agregada correctamente.' : 'No se pudo agregar.',
                $create,
                $data
            ];
        }

        function getCategories() {

            $get = $this->getCategoryById([$_POST['id']]);

            return [
                'status'  => $get ? 200 : 500,
                'message' => $get ? 'Datos obtenidos.' : 'Error al obtener.',
                'data'    => $get,
                'data'    => $get,
            ];
        }

        function editCategory() {

            $edit = $this->updateCategory($this->util->sql($_POST, 1));

            return [
                'status' => $edit ? 200 : 500,
                'message' => $edit ? 'Categoría actualizada.' : 'No se pudo actualizar.'
            ];
        }

        function statusCategory() {

            $update = $this->updateCategory($this->util->sql($_POST, 1));

            return [
                'status' => $update ? 200 : 500,
                'message' => $update ? 'Estado actualizado' : 'Error al cambiar estado'
            ];
        }

        // Client.

        function listClient() {
            $__row = [];

            $ls = $this->lsClient([1, $_SESSION['SUB']]);

            foreach ($ls as $key) {

                $a = [];

                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'client.editClient(' . $key['id'] . ')'
                ];

                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-trash"></i>',
                    'onclick' => 'client.deleteClient(' . $key['id'] . ')'
                ];

                $__row[] = [
                    'id'         => $key['id'],
                    'Nombre'     => $key['name'],
                    'Correo'     => $key['email'],
                    'Teléfono'   => $key['phone'],
                    'Registrado' => formatSpanishDate($key['date_create']),
                    'a'          => $a
                ];
            }

            return [
                'row' => $__row,
                'ls'  => $ls
            ];
        }

        function addClient() {
            $_POST['date_create']    = date('Y-m-d H:i:s');
            $_POST['active']         = 1;
            $_POST['subsidiaries_id'] = $_SESSION['SUB'];

            $data   = $this->util->sql($_POST);
            $create = $this->createClient($data);

            return [
                'status'  => $create ? 200 : 500,
                'message' => $create ? 'Cliente registrado correctamente.' : 'Error al registrar.',
                $create,
                $data
            ];
        }

        function getClient() {
            $get = $this->getClientById([$_POST['id']]);

            return [
                'status'  => $get ? 200 : 500,
                'message' => $get ? 'Datos obtenidos.' : 'Error al obtener.',
                'data'    => $get
            ];
        }

        function editClient() {
            $edit = $this->updateClient($this->util->sql($_POST, 1));

            return [
                'status' => $edit ? 200 : 500,
                'message' => $edit ? 'Cliente actualizado.' : 'No se pudo actualizar.',
                'post'=>$this->util->sql($_POST, 1)
            ];
        }

        function deleteClient() {
            $del = $this->deleteClientById([$_POST['id']]);

            return [
                'status' => $del ? 200 : 500,
                'message' => $del ? 'Cliente eliminado correctamente.' : 'Error al eliminar.'
            ];
        }

    }

// Complements.


  function renderProductImage($foto, $nombre) {
    $src = !empty($foto) ? 'https://erp-varoch.com/' . $foto : '';

    $img = !empty($src)
        ? '<img src="' . $src . '" alt="Imagen Producto" class="w-10 h-10 bg-gray-500 rounded-md object-cover" />'
        : '<div class="w-12 h-12 bg-[#1F2A37] rounded-md flex items-center justify-center">
                <i class=" icon-birthday text-gray-500"></i>
        </div>';

    return '
        <div class="flex items-center justify-start gap-2">
            ' . $img . '
            <div class="text-sm text-white">' . htmlspecialchars($nombre) . '</div>
        </div>';
  }

  function renderStatus($estatus) {
        switch ($estatus) {
            case 1:
                return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#014737] text-[#3FC189]">Activo</span>';
            case 0:
                return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#721c24] text-[#ba464d]">Inactivo</span>';
            case 2:
                return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#8a4600] text-[#f0ad28]">Borrador</span>';
            default:
                return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-gray-500 text-white">Desconocido</span>';
        }
  }




$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());


```

### mdl-admin.PHP [ mdl ]
```php

<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';
session_start();

class mdl extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd = "{$_SESSION['DB']}.";
    }

    // 🛍️ Product.

    function lsProductos($array){
        $leftjoin = [
            $this->bd . 'pedidos_category' => 'pedidos_products.category_id = pedidos_category.id'
        ];

        return $this->_Select([
            'table'    => $this->bd . 'pedidos_products',
            'values'   =>
                "pedidos_products.id as id,
                pedidos_products.name AS valor,
                pedidos_products.price,
                pedidos_products.description,
                pedidos_products.image,
                pedidos_category.classification,
                DATE_FORMAT(pedidos_products.date_creation, '%d %M %Y') as date_creation,
                pedidos_products.active",

            'leftjoin' => $leftjoin,
            'where'    => 'pedidos_products.active = ? AND pedidos_products.subsidiaries_id = ?',
            'order'    => ['DESC' => 'pedidos_products.id'],
            'data'     => $array
        ]);
    }

    function getProductoById($id){
        return $this->_Select([
            'table'  => $this->bd . 'pedidos_products',
            'values' => "*",
            'where'  => 'id = ?',
            'data'   => [$id]
        ])[0];
    }

    function existsProductoByName($array) {
        $query = "
            SELECT id
            FROM {$this->bd}pedidos_products
            WHERE LOWER(name) = LOWER(?)
            AND active = 1
            AND subsidiaries_id = ?
        ";

        $exists = $this->_Read($query, $array);
        return count($exists) > 0;
    }

    function existsOtherProductoByName($array) {
        $res = $this->_Select([
            'table'  => $this->bd . 'pedidos_products',
            'values' => 'id',
            'where'  => 'LOWER(name) = LOWER(?) AND id != ? AND active = 1 AND subsidiaries_id = ?',
            'data'   => $array
        ]);
        return count($res) <= 0;
    }

    function createProducto($array) {
        return $this->_Insert([
            'table'  => $this->bd . 'pedidos_products',
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateProducto($array) {
        return $this->_Update([
            'table'  => $this->bd . 'pedidos_products',
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    // Category.

    function lsCategory($array) {

        return $this->_Select([
            'table' => "{$this->bd}pedidos_category",

            'values' => "
                id,
                classification AS valor,
                description,
                DATE_FORMAT(date_creation, '%d %M %Y') AS date_creation,
                active
            ",
            'where' => "active = ? ",
            'order' => ['DESC' => 'id'],
            'data'  => $array
        ]);
    }

    function getCategory($array = []) {
        return $this->_Select([

            'table'  => "{$this->bd}pedidos_category",
            'values' => ['id', 'active','classification', 'description', "DATE_FORMAT(date_creation, '%Y-%m-%d') AS date_creation"],
            'order'  => ['DESC' => 'date_creation']
        ]);
    }

    function getCategoryById($array) {
        return $this->_Select([

            'table'  => "{$this->bd}pedidos_category",
            'values' => '*',
            'where'  => 'id = ?',
            'data'   => $array
        ])[0];
    }

    function createCategory($array) {

        return $this->_Insert([

            'table'  => "{$this->bd}pedidos_category",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);

    }

    function updateCategory($array) {
        return $this->_Update([

            'table'  => "{$this->bd}pedidos_category",
            'values' => $array['values'],
            'where'  => 'id = ?',
            'data'   => $array['data']
        ]);
    }

   // Clients.

    function lsClient($array) {
        return $this->_Select([
            'table'  => "{$this->bd}pedidos_clients",
            'values' =>
                "id,
                name,
                phone,
                email,
                DATE_FORMAT(date_create, '%Y-%m-%d') as date_create",
            'where'  => 'active = ? AND subsidiaries_id = ?',
            'order'  => ['DESC' => 'id'],
            'data'   => $array
        ]);
    }

    function getClientById($array) {
        return $this->_Select([
            'table'  => "{$this->bd}pedidos_clients",
            'values' => '*',
            'where'  => 'id = ?',
            'data'   => $array
        ])[0];
    }

    function createClient($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}pedidos_clients",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateClient($array) {
        return $this->_Update([
            'table'  => "{$this->bd}pedidos_clients",
            'values' => $array['values'],
            'where'  => 'id = ?',
            'data'   => $array['data']
        ]);
    }



}



```
