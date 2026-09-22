let api = 'ctrl/ctrl-almacen.php';
let main, products;
let categorias, unidades, areas, proveedores, almacenes;

// Catalogo
let api_catalogo = 'ctrl/ctrl-catalogo.php';
let  cataloge, category, area, unit, warehouse, inflow, shrinkage, supplier, transferStatus;

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
    cataloge       = new Catalogo(api_catalogo, "root");
    category       = new Category(api_catalogo, "root");
    area           = new Area(api_catalogo, "root");
    unit           = new Unit(api_catalogo, "root");
    warehouse      = new Warehouse(api_catalogo, "root");
    inflow         = new InflowOrigin(api_catalogo, "root");
    shrinkage      = new ShrinkageReason(api_catalogo, "root");
    supplier       = new Supplier(api_catalogo, "root");
    transferStatus = new TransferStatus(api_catalogo, "root");

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
        // #root ya es flex:1 min-h-0 (general.css). Repetimos flex-1 min-h-0 en cada
        // nivel para que el modulo llene el alto aunque la tabla venga vacia; el scroll
        // lo toma el contenedor de la tabla, no #main__content.
        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            class: "w-full flex-1 min-h-0 flex flex-col",
            card: {
                class: "flex flex-col col-12 flex-1 min-h-0",
                filterBar: { class: "w-full", id: `filterBar${this.PROJECT_NAME}` },
                container: { class: "w-full flex-1 min-h-0 flex flex-col", id: `container${this.PROJECT_NAME}` }
            }
        });


        // `class` de cada tab aplica al PANEL (#container-{id}), no al boton: por eso
        // cada uno repite la cadena flex. `content` aplica a #content-tabs...
        const paneClass = "flex-1 min-h-0 flex flex-col";

        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: "light",
            type: "short",
            class: "flex-shrink-0",
            content: { class: "flex-1 min-h-0 flex flex-col" },
            json: [

                {
                    id: "productos",
                    tab: "Productos",
                    lucideIcon: "package",
                    class: `mb-1 ${paneClass}`,
                    active: true,
                    onClick: () => products.render()
                },

                {
                    id: "categorias",
                    tab: "Categoría",
                    lucideIcon: "folder-tree",
                    class: paneClass,
                    onClick: () => category.lsCategory()
                },
                {
                    id: "unidades",
                    tab: "Unidad",
                    lucideIcon: "ruler",
                    class: `mb-1 ${paneClass}`,
                    onClick: () => unit.lsUnit()
                },
                {
                    id: "areas",
                    tab: "Área",
                    lucideIcon: "map-pin",
                    class: paneClass,
                    onClick: () => area.lsArea()
                },
                {
                    id: "warehouses",
                    tab: "Almacenes",
                    lucideIcon: "warehouse",
                    class: paneClass,
                    onClick: () => warehouse.lsWarehouse()
                },
                {
                    id: "suppliers",
                    tab: "Proveedores",
                    lucideIcon: "truck",
                    class: paneClass,
                    onClick: () => supplier.lsSupplier()
                },
                {
                    id: "inflows",
                    tab: "Origen entradas",
                    lucideIcon: "log-in",
                    class: paneClass,
                    onClick: () => inflow.lsInflow()
                },
                {
                    id: "shrinkages",
                    tab: "Motivos salida",
                    lucideIcon: "log-out",
                    class: paneClass,
                    onClick: () => shrinkage.lsShrinkage()
                },
                {
                    id: "transfer-status",
                    tab: "Estados traspaso",
                    lucideIcon: "arrow-left-right",
                    class: paneClass,
                    onClick: () => transferStatus.lsTransferStatus()
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
        // Ultimo tramo de la cadena flex: el contenedor de la tabla llena el panel y es
        // el que scrollea. Asi con 0 filas el area ocupa todo y con muchas no desborda.
        this.primaryLayout({
            parent: 'container-productos',
            id: this.PROJECT_NAME,
            class: 'w-full flex-1 min-h-0 flex flex-col',
            card: {
                class: 'flex flex-col col-12 flex-1 min-h-0',
                filterBar: { class: 'w-full mb-3 flex-shrink-0', id: 'filterBar' + this.PROJECT_NAME },
                container: { class: 'w-full flex-1 min-h-0 overflow-auto', id: 'container' + this.PROJECT_NAME }
            }
        });
    }

    filterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: "select",
                    id: "almacen",
                    lbl: "Almacén",
                    class: "col-12 col-md-2",
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
                    class: "col-12 col-md-2",
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
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbMateriales',
                theme: 'light',
                class: 'w-100 lowercase',
                striped:true,
                center: [2,3,4,5,6,7,12],
                right: [9,10,11],
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

    // Recarga el catálogo global de categorías tras altas/ediciones hechas en la pestaña
    // Categoría, para que el formulario y el filtro de Productos lo reflejen sin recargar
    // la página (ambos leen el global `categorias`).
    async reloadCategorias() {
        const data = await useFetch({ url: this._link, data: { opc: "init" } });
        categorias = data.categorias || [];
    }

    // Recarga el catálogo global de unidades tras altas/ediciones hechas en la pestaña
    // Unidad, para que el formulario de Productos lo refleje sin recargar la página.
    async reloadUnidades() {
        const data = await useFetch({ url: this._link, data: { opc: "init" } });
        unidades = data.unidades || [];
    }

    // El formulario va en cuatro bloques, en el orden en que se captura un producto:
    // qué es (identificación), cuánto cuesta (precio), cuánto tener (inventario) y notas.
    // Los encabezados son `opc: "label"`; su estilo va en la clase porque coffeeForm la
    // pasa al contenedor (cfToTailwindGrid borra mt-N / p-N, por eso se usa pt-/pb-).
    jsonMaterial() {
        const section = "col-12 pb-1 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wider text-gray-500";

        return [
            // -- Identificación --
            {
                opc: "label",
                id: "lblIdentificacion",
                text: "Identificación",
                class: section
            },
            {
                opc: "input",
                id: "name",
                lbl: "Nombre del producto",
                class: "col-12 col-md-8",
                required: true
            },
            {
                // Automático (ITM-<id>): lo asigna el controlador al guardar. Va deshabilitado,
                // así que no viaja en el POST; solo se enseña.
                opc: "input",
                id: "sku",
                lbl: "SKU",
                class: "col-12 col-md-4",
                placeholder: "Automático",
                disabled: true,
                required: false
            },
            {
                opc: "select",
                id: "category_id",
                lbl: "Categoría",
                class: "col-12 col-md-6",
                data: categorias,
                required: true
            },
            {
                opc: "select",
                id: "unit_id",
                lbl: "Unidad",
                class: "col-12 col-md-6",
                data: unidades,
                required: true
            },
            // {
            //     opc: "input",
            //     id: "image",
            //     lbl: "Imagen (URL)",
            //     class: "col-12 col-md-6 mb-3",
            //     placeholder: "https://... o ruta de la imagen"
            // },

            // -- Precio --
            // Orden del cálculo: costo sin IVA -> IVA -> precio con IVA. En la tabla el
            // primero sale como "Costo Unitario" y el último como "Precio Con IVA".
            {
                opc: "label",
                id: "lblPrecio",
                text: "Precio",
                class: section + " pt-3"
            },
            {
                opc: "input",
                id: "price_without_tax",
                lbl: "Costo sin IVA",
                tipo: "cifra",
                class: "col-12 col-md-4",
                required: true,
                onkeyup: "products.calcCostUnit()",
                onchange: "products.calcCostUnit()"
            },
            {
                opc: "select",
                id: "tax",
                lbl: "IVA",
                class: "col-12 col-md-4",
                onchange: "products.calcCostUnit()",
                data: [
                    { id: '0', valor: '0%' },
                    { id: '8', valor: '8%' },
                    { id: '16', valor: '16%' }
                ]
            },
            {
                // Precio con IVA = costo sin IVA + IVA. El calculo va en ambos sentidos:
                // este campo tambien recalcula price_without_tax (calcPriceWithoutTax).
                opc: "input",
                id: "cost_unit",
                lbl: "Precio con IVA",
                tipo: "cifra",
                class: "col-12 col-md-4",
                required: true,
                onkeyup: "products.calcPriceWithoutTax()",
                onchange: "products.calcPriceWithoutTax()"
            },

            // -- Inventario --
            {
                opc: "label",
                id: "lblInventario",
                text: "Inventario",
                class: section + " pt-3"
            },
            {
                opc: "input",
                id: "stock_min",
                lbl: "Mínimo",
                tipo: "numero",
                required: false,
                class: "col-12 col-md-4"
            },
            {
                opc: "input",
                id: "stock_max",
                lbl: "Máximo",
                tipo: "numero",
                required: false,
                class: "col-12 col-md-4"
            },
            {
                opc: "input",
                id: "shelf_life_days",
                lbl: "Vida útil (días)",
                tipo: "numero",
                required: false,
                class: "col-12 col-md-4"
            },
            // {
            //     opc: "select",
            //     id: "warehouse_area_id",
            //     lbl: "Área *",
            //     class: "col-12 col-md-6 mb-3",
            //     data: areas,
            //     required: true
            // },

            // -- Descripción --
            {
                opc: "label",
                id: "lblDescripcion",
                text: "Descripción",
                class: section + " pt-3"
            },
            {
                opc: "textarea",
                id: "description",
                showLabel: false,
                class: "col-12",
                placeholder: "Notas del producto (opcional)",
                required: false,
                rows: 3
            }
        ];
    }

    // Calcula en vivo: costo unitario = precio sin impuesto + (precio sin impuesto * IVA / 100).
    // Si no hay precio base no toca el campo, para no borrar el costo de productos existentes al editar.
    // La bandera _syncingCost evita el bucle infinito con calcPriceWithoutTax: al escribir el
    // campo hermano con .val() se dispara su propio onkeyup, que volveria a llamar a este metodo.
    calcCostUnit() {
        if (this._syncingCost) return;
        const base = parseFloat($('#price_without_tax').val());
        if (isNaN(base)) return;
        const taxPct = parseFloat($('#tax').val()) || 0;

        this._syncingCost = true;
        $('#cost_unit').val((base + (base * taxPct / 100)).toFixed(2));
        this._syncingCost = false;
    }

    // Camino inverso: precio sin impuesto = costo unitario / (1 + IVA / 100).
    // Misma bandera _syncingCost que calcCostUnit, para no reentrar entre los dos metodos.
    calcPriceWithoutTax() {
        if (this._syncingCost) return;
        const costUnit = parseFloat($('#cost_unit').val());
        if (isNaN(costUnit)) return;
        const taxPct = parseFloat($('#tax').val()) || 0;

        this._syncingCost = true;
        $('#price_without_tax').val((costUnit / (1 + taxPct / 100)).toFixed(2));
        this._syncingCost = false;
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
                    this.alertBox({
                        type: "success",
                        theme: "light",
                        title: response.message,
                        timer: 1500
                    });
                    this.lsMateriales();
                } else {
                    this.alertBox({
                        type: "error",
                        theme: "light",
                        title: response.message,
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
                        this.alertBox({
                            type: "success",
                            theme: "light",
                            title: response.message,
                            timer: 1500
                        });
                        this.lsMateriales();
                    } else {
                        this.alertBox({
                            type: "error",
                            theme: "light",
                            title: response.message,
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

    // Confirmación con alertBox (el diálogo de alpha/pedidos) en vez de SweetAlert:
    // desactivar va en rojo ('cancel') y activar en azul ('confirm').
    statusMaterial(id, estado) {
        const activar = estado != 1;

        this.alertBox({
            type:       activar ? "confirm" : "cancel",
            theme:      "light",
            title:      activar ? "¿Activar producto?" : "¿Desactivar producto?",
            detailHtml: activar ? "El producto será activado." : "El producto será desactivado.",
            okLabel:    activar ? "Activar" : "Desactivar",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "deleteMaterial", active: activar ? 1 : 0, id: id }
                });

                if (response && response.status === 200) {
                    this.alertBox({
                        type: "success",
                        theme: "light",
                        title: response.message,
                        timer: 1500
                    });
                    this.lsMateriales();
                } else {
                    this.alertBox({
                        type: "error",
                        theme: "light",
                        title: (response && response.message) || "No se pudo actualizar el estado",
                        timer: 2500
                    });
                }
            }
        });
    }
}
