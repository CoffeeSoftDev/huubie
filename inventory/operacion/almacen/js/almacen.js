let api = 'ctrl/ctrl-almacen.php';
let main, products;
let categorias, unidades, areas, proveedores, almacenes;

// Catalogo
let api_catalogo = 'ctrl/ctrl-catalogo.php';
let  cataloge, category, area, zone, warehouse, inflow, shrinkage;

$(async () => {
    const data     = await useFetch({ url: api, data: { opc: "init" } });
    categorias     = data.categorias  || [];
    unidades       = data.unidades    || [];
    areas          = data.areas       || [];
    proveedores    = data.proveedores || [];
    almacenes      = data.almacenes   || [];

    main = new Main(api, "root");
    main.render();

    // Catalogo
    cataloge = new Catalogo(api_catalogo, "root");
    category = new Category(api_catalogo, "root");
    area = new Area(api_catalogo, "root");
    zone = new Zone(api_catalogo, "root");
    warehouse = new Warehouse(api_catalogo, "root");
    inflow = new InflowOrigin(api_catalogo, "root");
    shrinkage = new ShrinkageReason(api_catalogo, "root");

    cataloge.render();

    // Productos.
    products = new Productos(api, "root");
    products.render();
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
                    class: "mb-1",
                    active: true,
                    onClick: () => products.render()
                },

                {
                    id: "categorias",
                    tab: "Categoría",
                    lucideIcon: "folder-tree",
                   
                    onClick: () => category.lsCategory()
                },
                {
                    id: "unidades",
                    tab: "Unidad",
                    lucideIcon: "ruler",
                    class: "mb-1",
                    onClick: () => zone.lsZone()
                },
                {
                    id: "areas",
                    tab: "Área",
                    lucideIcon: "map-pin",
                    onClick: () => area.lsArea()
                },
                {
                    id: "warehouses",
                    tab: "Almacenes",
                    lucideIcon: "warehouse",
                    onClick: () => warehouse.lsWarehouse()
                },
                {
                    id: "inflows",
                    tab: "Origen entradas",
                    lucideIcon: "log-in",
                    onClick: () => inflow.lsInflow()
                },
                {
                    id: "shrinkages",
                    tab: "Motivos salida",
                    lucideIcon: "log-out",
                    onClick: () => shrinkage.lsShrinkage()
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
                    id: "almacen",
                    lbl: "Almacén",
                    class: "col-12 col-md-3",
                    data: [{ id: '', valor: 'Todos' }, ...almacenes],
                    onchange: 'products.lsMateriales()'
                },
                {
                    opc: "select",
                    id: "categoria",
                    lbl: "Categoría",
                    class: "col-12 col-md-2",
                    data: [{ id: '', valor: 'Todos' }, ...categorias],
                    onchange: 'products.lsMateriales()'
                },
                {
                    opc: "select",
                    id: "area",
                    lbl: "Área",
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
                opc: "label",
                id: "lblMaterial",
                text: "Información del Producto",
                class: "col-12 fw-bold text-lg mb-2  p-1"
            },
            {
                opc: "input",
                id: "name",
                lbl: "Nombre del Producto ",
                class: "col-12 col-md-6 mb-3",
                required: true
            },
            // {
            //     opc: "input",
            //     id: "image",
            //     lbl: "Imagen (URL)",
            //     class: "col-12 col-md-6 mb-3",
            //     placeholder: "https://... o ruta de la imagen"
            // },
            {
                opc: "select",
                id: "category_id",
                lbl: "Categoría ",
                class: "col-12 col-md-6 mb-3",
                data: categorias,
                required: true
            },
            // {
            //     opc: "select",
            //     id: "warehouse_area_id",
            //     lbl: "Área *",
            //     class: "col-12 col-md-6 mb-3",
            //     data: areas,
            //     required: true
            // },
            {
                opc: "select",
                id: "unit_id",
                lbl: "Unidad ",
                class: "col-12 col-md-6 mb-3",
                data: unidades,
                required: true
            },
            {
                opc: "input",
                id: "cost_unit",
                lbl: "Costo Unitario ",
                tipo: "cifra",
                class: "col-12 col-md-6 mb-3",
                required: true
            },
            // {
            //     opc: "input",
            //     id: "price",
            //     lbl: "Precio de Venta",
            //     tipo: "cifra",
            //     class: "col-12 col-md-6 mb-3"
            // },
            {
                opc: "input",
                id: "stock_min",
                lbl: "Inventario Mínimo",
                tipo: "numero",
                required: false,
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "stock_max",
                lbl: "Inventario Máximo",
                tipo: "numero",
                required: false,
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "shelf_life_days",
                lbl: "Vida útil (días)",
                tipo: "numero",
                required: false,

                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "textarea",
                id: "description",
                lbl: "Descripción",
                class: "col-12 mb-3",
                required:false,
                rows: 3
            }
        ];
    }

    addMaterial() {
        this.createModalForm({
            id: 'formMaterialAdd',
            data: { opc: 'addMaterial' },
            theme:'light',
            coffeesoft:true,
            bootbox: {
                title: 'Nuevo Producto',
                closeButton: true
            },
            json: this.jsonMaterial(),
            success: (response) => {
                if (response.status === 200) {
                    alert({
                        icon: "success",
                        text: response.message,
                        timer: 1500
                    });
                    this.lsMateriales();
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        timer: 2500
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
                data: { opc: 'editMaterial', id: id },
                theme:'light',
                coffeesoft:true,
                bootbox: {
                    title: 'Editar Producto',
                    closeButton: true
                },
                autofill: request.data,
                json: this.jsonMaterialEdit(),
                success: (response) => {
                    if (response.status === 200) {
                        alert({
                            icon: "success",
                            text: response.message,
                            timer: 1500
                        });
                        this.lsMateriales();
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                            timer: 2500
                        });
                    }
                }
            });
        }
    }

    jsonMaterialEdit() {
        // Mismos campos que el alta: las claves de getMaterialById coinciden con los id del form (autofill).
        return this.jsonMaterial();
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
            data: { opc: "deleteMaterial", active: nuevoEstado, id: id,  },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({
                            icon: "success",
                            text: response.message,
                            timer: 1500
                        });
                        this.lsMateriales();
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                            timer: 2500
                        });
                    }
                }
            }
        });
    }
}
