let api = 'ctrl/ctrl-almacen.php';
let main, products;
let zonas, categorias, areas, departamentos, proveedores;

// Inventario.
let api_inventario = 'ctrl/ctrl-inventario.php';
let inventario, captura;
let tipoMovimiento, productosInventario;

// Movimientos.
let api_movimientos = 'ctrl/ctrl-movimientos.php';
let movimientos;

let categorias_movimientos, meses, anios;

// Catalogo
let api_catalogo = 'ctrl/ctrl-catalogo.php';
let  cataloge, category, area, zone;

$(async () => {
    const data     = await useFetch({ url: api, data: { opc: "init" } });
    zonas          = data.zonas;
    categorias     = data.categorias;
    areas          = data.areas;
    departamentos  = data.departamentos;
    proveedores    = data.proveedores;

    main = new Main(api, "root");
    main.render();

    // Productos.
    products = new Productos(api, "root");
    products.render();

    // Inventario.
    const invt                = await useFetch({ url: api_inventario, data: { opc: "init" } });
          tipoMovimiento      = invt.tipoMovimiento;
          productosInventario = invt.productos;

    inventario = new Inventario(api_inventario, "root");
    captura = new CapturaMovimiento(api_inventario, "root");
    inventario.render();
    
    // Movimientos.

    const req = await useFetch({ url: api_movimientos, data: { opc: "init" } });
    categorias_movimientos = req.categorias;
    meses = req.meses;
    anios = req.anios;

    movimientos = new Movimientos(api_movimientos, "root");
    movimientos.render();



    // Catalogo
    cataloge = new Catalogo(api_catalogo, "root");
    category = new Category(api_catalogo, "root");
    area     = new Area(api_catalogo, "root");
    zone     = new Zone(api_catalogo, "root");

    cataloge.render();

});

class Main extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "almacenMain";
    }

    render() {
        this.layout();
     
    }

    layout() {
        
        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            class: "w-full",
            card: {
                filterBar: { class: "w-full", id: `filterBar${this.PROJECT_NAME}` },
                container: { class: "w-full h-full", id: `container${this.PROJECT_NAME}` }
            }
        });


        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: "light",
            type: "short",
            json: [
                {
                    id: "productos",
                    tab: "Productos",
                    lucideIcon: "package",
                    active: true,
                    class: "mb-1",
                    
                    onClick: () => products.render()
                },
                {
                    id: "inventario",
                    tab: "Inventario",
                    lucideIcon: "clipboard-list",
                  

                    onClick: () => inventario.render()
                },
                {
                    id: "movimientos",
                    tab: "Movimientos",
                    lucideIcon: "arrow-left-right",
                   
                    onClick: () => movimientos.renderMovimiento()
                },
                {
                    id: "catalogo",
                    tab: "Catálogo",
                    lucideIcon: "book-open",
                  
                  
                }
            ]
        });
    }
}

class Productos extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Products";
    }

    render() {
        this.layout();
        this.filterBar();
        this.lsMateriales();
    }

    layout() {
        this.primaryLayout({
            parent: 'container-productos',
            id: this.PROJECT_NAME,
            class: 'w-full p-3',
            card: {
                filterBar: { class: 'w-full mb-3', id: 'filterBar' + this.PROJECT_NAME },
                container: { class: 'w-full h-full', id: 'container' + this.PROJECT_NAME }
            }
        });

        $(`#filterBar${this.PROJECT_NAME}`).prepend(`
            <div class="px-2 pb-2">
                <h2 class="text-2xl font-semibold">📦 Productos</h2>
                <p class="text-gray-400">Gestión de productos del almacén</p>
            </div>
        `);
    }

    filterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: "select",
                    id: "zona",
                    lbl: "Departamento",
                    class: "col-12 col-md-2",
                    data: [{ id: '', valor: 'Todos' }, ...zonas],
                    onchange: 'products.lsMateriales()'
                },
                {
                    opc: "select",
                    id: "categoria",
                    lbl: "Presentación",
                    class: "col-12 col-md-2",
                    data: [{ id: '', valor: 'Todos' }, ...categorias],
                    onchange: 'products.lsMateriales()'
                },
                {
                    opc: "select",
                    id: "area",
                    lbl: "Grupo",
                    class: "col-12 col-md-2",
                    data: [{ id: '', valor: 'Todos' }, ...areas],
                    onchange: 'products.lsMateriales()'
                },
                {
                    opc: "select",
                    id: "estado",
                    lbl: "Estado",
                    class: "col-12 col-md-2",
                    data: [
                        { id: '', valor: 'Todos' },
                        { id: '1', valor: 'Activos' },
                        { id: '0', valor: 'Inactivos' }
                    ],
                    onchange: 'products.lsMateriales()'
                },
                {
                    opc: "button",
                    id: "btnNuevoMaterial",
                    text: "Nuevo Producto",
                    className:'w-100',
                    class: "col-12 col-md-3",
                    color_btn: "primary",
                    onClick: () => this.addMaterial()
                }
            ]
        });
    }

    lsMateriales() {
        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: 'lsMateriales' },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: 'tbMateriales',
                theme: 'light',
                class: 'w-100 lowercase',
                // title: 'Lista de productos',
                // subtitle: 'Productos registrados en el sistema',
                striped:true,
                center: [1,3,4,7],
                right: [5],
                f_size: 12
            },
            success: (response) => {
                if (response.total_value) {
                    $(`#container${this.PROJECT_NAME}`).append(`
                        <div class="px-4 py-3 bg-white border-t">
                            <div class="flex justify-end">
                                <span class="text-lg font-bold">Valor Total del Inventario: ${response.total_value}</span>
                            </div>
                        </div>
                    `);
                }
            }
        });
    }

    jsonMaterial() {
        return [
            {
                opc: "select",
                id: "id_zona",
                lbl: "Negocio: *",
                class: "col-12 col-md-6 mb-3",
                data: zonas,
                required: true
            },
            // {
            //     opc: "input",
            //     id: "CodigoEquipo",
            //     lbl: "Código *",
            //     placeholder: "AR-01-29-XXX",
            //     class: "col-12 col-md-6 mb-3",
            //     // required: true
            // },
            {
                opc: "label",
                id: "lblMaterial",
                text: "Información del Producto",
                class: "col-12 fw-bold text-lg mb-2  p-1"
            },
            {
                opc: "input",
                id: "Equipo",
                lbl: "Nombre del Producto *",
                class: "col-12 col-md-6 mb-3",
                required: true
            },
            {
                opc: "select",
                id: "Area",
                lbl: "Grupo",
                class: "col-12 col-md-6 mb-3",
                data: areas,
                required: true
            },
         
          
         
          
          
            {
                opc: "input",
                id: "cantidad",
                lbl: "Cantidad inicial *",
                tipo: "numero",
                class: "col-12 col-md-6 mb-3",
                required: true
            },
            {
                opc: "select",
                id: "id_categoria",
                lbl: "Presentación *",
                class: "col-12 col-md-6 mb-3",
                data: categorias,
                required: true
            },

            {
                opc: "input",
                id: "Costo",
                lbl: "Costo Unitario *",
                tipo: "cifra",
                class: "col-12 col-md-6 mb-3",
                required: true
            },
            {
                opc: "input",
                id: "PrecioVenta",
                lbl: "Precio de Venta",
                tipo: "cifra",
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "inventario_min",
                lbl: "Inventario Mínimo",
                tipo: "numero",
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "textarea",
                id: "Descripcion",
                lbl: "Descripción",
                class: "col-12 mb-3",
                rows: 3
            }
        ];
    }

    addMaterial() {
        this.createModalForm({
            id: 'formMaterialAdd',
            data: { opc: 'addMaterial' },
            bootbox: {
                title: 'Nuevo Material',
                closeButton: true
            },
            json: this.jsonMaterial(),
            success: (response) => {
                if (response.status === 200) {
                    alert({
                        icon: "success",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Aceptar"
                    });
                    this.lsMateriales();
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });
    }

    async editMaterial(id) {
        const request = await useFetch({
            url: this._link,
            data: { opc: "getMaterial", id: id }
        });

        if (request.status === 200) {
            this.createModalForm({
                id: 'formMaterialEdit',
                data: { opc: 'editMaterial', idAlmacen: id },
                bootbox: {
                    title: 'Editar Material',
                    closeButton: true
                },
                autofill: request.data,
                json: this.jsonMaterialEdit(),
                success: (response) => {
                    if (response.status === 200) {
                        alert({
                            icon: "success",
                            text: response.message,
                            btn1: true,
                            btn1Text: "Aceptar"
                        });
                        this.lsMateriales();
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                            btn1: true,
                            btn1Text: "Ok"
                        });
                    }
                }
            });
        }
    }

    jsonMaterialEdit() {
        return [
            {
                opc: "select",
                id: "id_zona",
                lbl: "Negocio: *",
                class: "col-12 col-md-6 mb-3",
                data: zonas,
                required: true
            },
            {
                opc: "label",
                id: "lblMaterial",
                text: "Información del Producto",
                class: "col-12 fw-bold text-lg mb-2  p-1"
            },
            {
                opc: "input",
                id: "Equipo",
                lbl: "Nombre del Producto *",
                class: "col-12 col-md-6 mb-3",
                required: true
            },
            {
                opc: "select",
                id: "Area",
                lbl: "Grupo",
                class: "col-12 col-md-6 mb-3",
                data: areas,
                required: true
            },
            {
                opc: "input",
                id: "cantidad",
                lbl: "Cantidad actual",
                tipo: "numero",
                class: "col-12 col-md-6 mb-3",
                disabled: true
            },
            {
                opc: "select",
                id: "id_categoria",
                lbl: "Presentación *",
                class: "col-12 col-md-6 mb-3",
                data: categorias,
                required: true
            },
            {
                opc: "input",
                id: "Costo",
                lbl: "Costo Unitario *",
                tipo: "cifra",
                class: "col-12 col-md-6 mb-3",
                required: true
            },
            {
                opc: "input",
                id: "PrecioVenta",
                lbl: "Precio de Venta",
                tipo: "cifra",
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "inventario_min",
                lbl: "Inventario Mínimo",
                tipo: "numero",
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "textarea",
                id: "Descripcion",
                lbl: "Descripción",
                class: "col-12 mb-3",
                rows: 3
            }
        ];
    }

    statusMaterial(id, estado) {
        const nuevoEstado = estado == 1 ? 0 : 1;
        const accion = estado == 1 ? 'desactivar' : 'activar';

        this.swalQuestion({
            opts: {
                title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} producto?`,
                html: `El producto será ${accion === 'desactivar' ? 'desactivado' : 'activado'}.`,
                icon: "warning"
            },
            data: { opc: "deleteMaterial", Estado: nuevoEstado, idAlmacen: id,  },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({
                            icon: "success",
                            text: response.message,
                            btn1: true,
                            btn1Text: "Aceptar"
                        });
                        this.lsMateriales();
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                            btn1: true,
                            btn1Text: "Ok"
                        });
                    }
                }
            }
        });
    }
}
