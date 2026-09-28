let api = 'ctrl/ctrl-almacen.php';
let main, products, asistente, conteo;
let categorias, unidades, areas, proveedores, almacenes, superAdmin;

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
    superAdmin     = !!data.superadmin;

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

    asistente = new AsistenteProductos(api, "root");
    conteo    = new FormatoConteo(api, "root");
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
                // Área = dónde está dentro del almacén (anaquel, refrigerador...).
                // Lo que hay en cada almacén se consulta en Stock, no aquí.
                {
                    opc: "select",
                    id: "area",
                    lbl: "Área",
                    class: "col-12 col-md-2",
                    data: [{ id: '', valor: 'Todas' }, ...areas],
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
                },
                {
                    opc: "button",
                    id: "btnAsistenteIA",
                    text: "CoffeeIA",
                    icon: "icon-magic",
                    className: 'w-100',
                    class: "col-12 col-md-2",
                    color_btn: "outline",
                    onClick: () => asistente.render()
                },
                {
                    opc: "button",
                    id: "btnFormatoConteo",
                    text: "Formato conteo",
                    icon: "icon-file-excel",
                    className: 'w-100',
                    class: "col-12 col-md-2",
                    color_btn: "outline",
                    onClick: () => conteo.render()
                }
            ]
        });
    }

    lsMateriales() {
        // DataTables pinta cada página al cambiarla: sus íconos Lucide se convierten en cada draw.
        $(`#container${this.PROJECT_NAME}`).off('draw.lucide').on('draw.dt.lucide', () => {
            if (window.lucide) lucide.createIcons();
        });

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
                center: [2,3,5,6,7,9],
                right: [4],
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

    // Recarga el catálogo global de áreas tras altas/ediciones hechas en la pestaña
    // Área, para que el formulario de Productos lo refleje sin recargar la página.
    async reloadAreas() {
        const data = await useFetch({ url: this._link, data: { opc: "init" } });
        areas = data.areas || [];
    }

    // Orden de captura: identificación (categoría, código, nombre, unidad), costo
    // (último costo, IVA de compra y costo con impuesto), inventario (inventariable,
    // área, mínimo, máximo, vida útil), venta y notas.
    // Mismo reparto que el POS: el precio de venta vive en item y el costo en item_attribute.
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
                opc: "select",
                id: "category_id",
                lbl: "Categoría",
                class: "col-12 col-md-8",
                data: categorias,
                required: true
            },
            {
                // Automático, formato Soft Restaurant (categoría + consecutivo: 04003): lo
                // asigna el controlador al guardar. Va deshabilitado, así que no viaja en el
                // POST; solo se enseña.
                opc: "input",
                id: "sku",
                lbl: "Código (SKU)",
                class: "col-12 col-md-4",
                placeholder: "Automático",
                disabled: true,
                required: false
            },
            {
                opc: "input",
                id: "name",
                lbl: "Nombre del producto",
                class: "col-12 col-md-8",
                required: true
            },
            {
                opc: "select",
                id: "unit_id",
                lbl: "Unidad de medida",
                class: "col-12 col-md-4",
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

            // -- Costo --
            // Último costo de compra sin IVA. Cada entrada y cada recepción de orden lo
            // reemplaza (con su IVA); aquí solo se captura si el producto aún no tiene
            // compras. El costo con impuesto no se guarda: se calcula de los otros dos.
            {
                opc: "label",
                id: "lblCosto",
                text: "Costo",
                class: section + " pt-3"
            },
            {
                opc: "input",
                id: "cost_unit",
                lbl: "Último costo",
                tipo: "cifra",
                class: "col-12 col-md-4",
                required: false,
                placeholder: "Se actualiza con cada entrada",
                onkeyup: "products.calcCostWithTax()",
                onchange: "products.calcCostWithTax()"
            },
            {
                opc: "select",
                id: "cost_tax",
                lbl: "IVA",
                class: "col-12 col-md-4",
                onchange: "products.calcCostWithTax()",
                data: [
                    { id: '0', valor: '0%' },
                    { id: '8', valor: '8%' },
                    { id: '16', valor: '16%' }
                ]
            },
            {
                opc: "input",
                id: "cost_with_tax",
                lbl: "Costo c/impuesto",
                tipo: "cifra",
                class: "col-12 col-md-4",
                required: false,
                placeholder: "0.00",
                onkeyup: "products.calcCostUnit()",
                onchange: "products.calcCostUnit()"
            },

            // -- Inventario --
            {
                opc: "label",
                id: "lblInventario",
                text: "Inventario",
                class: section + " pt-3"
            },
            {
                opc: "select",
                id: "is_inventoriable",
                lbl: "Inventariable",
                class: "col-12 col-md-4",
                data: [
                    { id: '1', valor: 'Sí' },
                    { id: '0', valor: 'No' }
                ]
            },
            // Área = en qué parte del almacén se guarda. Tiene que viajar siempre:
            // editMaterial la escribe, y si falta en el form la dejaría en NULL.
            {
                opc: "select",
                id: "warehouse_area_id",
                lbl: "Área",
                class: "col-12 col-md-8",
                data: [{ id: '', valor: 'Sin área' }, ...areas],
                required: false
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

            // -- Venta --
            // Primero el precio final (el que paga el cliente); el precio sin IVA se
            // calcula solo. También funciona al revés: teclear la base calcula el precio.
            // Opcional: un insumo que no se vende se queda en 0.
            {
                opc: "label",
                id: "lblVenta",
                text: "Venta",
                class: section + " pt-3"
            },
            {
                opc: "input",
                id: "price",
                lbl: "Precio de venta",
                tipo: "cifra",
                class: "col-12 col-md-4",
                required: false,
                placeholder: "0.00",
                onkeyup: "products.calcPriceWithoutTax()",
                onchange: "products.calcPriceWithoutTax()"
            },
            {
                opc: "select",
                id: "tax",
                lbl: "IVA",
                class: "col-12 col-md-4",
                onchange: "products.calcPriceWithoutTax()",
                data: [
                    { id: '0', valor: '0%' },
                    { id: '8', valor: '8%' },
                    { id: '16', valor: '16%' }
                ]
            },
            {
                opc: "input",
                id: "price_without_tax",
                lbl: "Precio sin IVA",
                tipo: "cifra",
                class: "col-12 col-md-4",
                required: false,
                placeholder: "0.00",
                onkeyup: "products.calcPrice()",
                onchange: "products.calcPrice()"
            },

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

    // Precio sin IVA = precio de venta / (1 + IVA / 100). Corre al teclear el precio y al
    // cambiar el IVA. Sin precio no toca nada, para no borrar datos al editar.
    // La bandera _syncingPrice evita que los dos cálculos se llamen entre sí.
    calcPriceWithoutTax() {
        if (this._syncingPrice) return;
        const price = parseFloat($('#price').val());
        if (isNaN(price)) return;
        const taxPct = parseFloat($('#tax').val()) || 0;

        this._syncingPrice = true;
        $('#price_without_tax').val((price / (1 + taxPct / 100)).toFixed(2));
        this._syncingPrice = false;
    }

    // Camino inverso: precio de venta = precio sin IVA + (precio sin IVA * IVA / 100).
    calcPrice() {
        if (this._syncingPrice) return;
        const base = parseFloat($('#price_without_tax').val());
        if (isNaN(base)) return;
        const taxPct = parseFloat($('#tax').val()) || 0;

        this._syncingPrice = true;
        $('#price').val((base + (base * taxPct / 100)).toFixed(2));
        this._syncingPrice = false;
    }

    // Costo c/impuesto = último costo + IVA de compra. Mismo par que el precio: al
    // editar, el autofill cambia el select del IVA y eso lo pinta con el costo guardado.
    calcCostWithTax() {
        if (this.syncingCost) return;
        const cost = parseFloat($('#cost_unit').val());
        if (isNaN(cost)) return;
        const taxPct = parseFloat($('#cost_tax').val()) || 0;

        this.syncingCost = true;
        $('#cost_with_tax').val((cost * (1 + taxPct / 100)).toFixed(2));
        this.syncingCost = false;
    }

    calcCostUnit() {
        if (this.syncingCost) return;
        const total = parseFloat($('#cost_with_tax').val());
        if (isNaN(total)) return;
        const taxPct = parseFloat($('#cost_tax').val()) || 0;

        this.syncingCost = true;
        $('#cost_unit').val((total / (1 + taxPct / 100)).toFixed(2));
        this.syncingCost = false;
    }

    addMaterial() {
        this.createModalForm({
            id: 'formMaterialAdd',
            data: { opc: 'addMaterial' },
            theme:'light',
            coffeesoft:true,
            bootbox: {
                title: 'Nuevo Producto',
                size: 'small',
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
                    size: 'small',
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
    // desactivar va en rojo ('cancel') y activar en azul ('confirm'). Al desactivar
    // se ofrece también eliminarlo: alertBox solo tiene dos botones, así que va como enlace.
    statusMaterial(id, estado) {
        const activar = estado != 1;
        const alertId = `alertStatus${this.PROJECT_NAME}`;
        const eliminar = `<br><button type="button" data-delete-producto class="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-red-600 hover:text-red-700 hover:underline"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Eliminarlo definitivamente</button>`;

        this.alertBox({
            id:         alertId,
            type:       activar ? "confirm" : "cancel",
            theme:      "light",
            title:      activar ? "¿Activar producto?" : "¿Desactivar producto?",
            detailHtml: activar ? "El producto será activado." : "El producto será desactivado." + eliminar,
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

        if (activar) return;

        $(`#${alertId} [data-delete-producto]`).on('click', () => {
            $(`#${alertId} [data-ab-cancel]`).trigger('click');
            this.deleteProducto(id);
        });
    }

    // El servidor lo niega si el producto ya tiene movimientos o existencia:
    // en ese caso solo se puede desactivar.
    deleteProducto(id) {
        this.alertBox({
            type:       "cancel",
            theme:      "light",
            title:      "¿Eliminar producto?",
            detailHtml: "Se borra para siempre y no se puede deshacer.",
            okLabel:    "Eliminar",
            okBg:       "bg-red-600 hover:bg-red-700",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "deleteProducto", id: id }
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
                        type: "warning",
                        theme: "light",
                        title: "No se pudo eliminar",
                        detailHtml: (response && response.message) || "Inténtalo otra vez."
                    });
                }
            }
        });
    }
}

// -- Asistente --

class AsistenteProductos extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "AsistenteProductos";
        this.chat         = null;
    }

    // -- Interface --

    render() {
        if (!this.chat) {
            this.chat = this.iaChat({
                id:          `chat${this.PROJECT_NAME}`,
                title:       "CoffeeIA",
                subtitle:    "Productos, categorías, unidades, áreas, almacenes y proveedores",
                placeholder: "Escribe o adjunta un Excel o una foto…",
                accept:      ".xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp",
                welcome:     "Te ayudo con tu catálogo. Nada se guarda sin tu confirmación.",
                actions: {
                    add: {
                        label: "Alta",
                        tone:  "bg-emerald-100 text-emerald-700"
                    },
                    edit: {
                        label: "Cambio",
                        tone:  "bg-sky-100 text-sky-700"
                    },
                    deactivate: {
                        label: "Baja",
                        tone:  "bg-red-100 text-red-700"
                    },
                    activate: {
                        label: "Reactivar",
                        tone:  "bg-violet-100 text-violet-700"
                    },
                    purge: {
                        label:        "Vaciar",
                        tone:         "bg-red-600 text-white",
                        confirm:      "Se borra para siempre y no se puede deshacer.",
                        confirmLabel: "Sí, vaciar"
                    }
                },
                onAttach:  (file) => this.readArchivo(file),
                onSend:    (text, adjuntos, historial) => this.askAsistente(text, adjuntos, historial),
                onConfirm: (token, ids) => this.applyAsistente(token, ids)
            });
        }

        this.chat.toggle();
    }

    // -- CRUD --

    async readArchivo(file) {
        const data = new FormData();
        data.append("opc", "readArchivo");
        data.append("archivo", file);

        try {
            const response = await fetch(this._link, {
                method:      "POST",
                credentials: "same-origin",
                body:        data
            });

            return await response.json();
        } catch (e) {
            return {
                status:  500,
                message: "No pude leer el archivo."
            };
        }
    }

    async askAsistente(text, adjuntos, historial) {
        const response = await useFetch({
            url: this._link,
            data: {
                opc:       "askAsistente",
                mensaje:   text,
                adjuntos:  JSON.stringify(adjuntos),
                historial: JSON.stringify(historial)
            }
        });

        return response || {
            status:  500,
            message: "El asistente no respondió. Inténtalo otra vez."
        };
    }

    async applyAsistente(token, ids) {
        const response = await useFetch({
            url: this._link,
            data: {
                opc:   "applyAsistente",
                token: token,
                ids:   JSON.stringify(ids)
            }
        });

        if (response && response.status === 200) this.refreshCatalogs((response.data && response.data.entidades) || []);

        return response || {
            status:  500,
            message: "No se pudo aplicar. Inténtalo otra vez."
        };
    }

    // -- Complements --

    // Recarga solo lo que tocó el asistente: las pestañas del catálogo afectadas y los
    // selects globales que usan el filtro y el formulario de Productos.
    async refreshCatalogs(entidades) {
        const toca = (e) => entidades.includes(e);

        if (toca("category") || toca("unit") || toca("area") || toca("supplier") || toca("warehouse")) {
            const data = await useFetch({ url: this._link, data: { opc: "init" } });

            if (data) {
                categorias  = data.categorias  || [];
                unidades    = data.unidades    || [];
                areas       = data.areas       || [];
                proveedores = data.proveedores || [];
                almacenes   = data.almacenes   || [];
            }
        }

        if (toca("category"))  category.lsCategory();
        if (toca("unit"))      unit.lsUnit();
        if (toca("area"))      area.lsArea();
        if (toca("warehouse")) warehouse.lsWarehouse();
        if (toca("supplier"))  supplier.lsSupplier();

        // Con categorías o áreas nuevas el filtro de Productos se vuelve a pintar.
        if (toca("category") || toca("area")) products.render();
        else if (toca("product"))            products.lsMateriales();
    }
}

// -- Formato de conteo --
// El "Reporte de inventario rápido" de Soft Restaurant (docs/SOFT_*_INVENTARIO.XLS)
// hecho para imprimir: un bloque por producto, un renglón por movimiento y una
// columna por día de la semana. Sencillo = 6 movimientos; completo = + físico y diferencia.

class FormatoConteo extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "FormatoConteo";
        this.EXCELJS      = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";
        this.DIAS         = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"];
        this.ALTO_TITULOS = [22, 16, 14, 15, 26, 26];
        this.ALTO_FILA    = 15;
        this.ALTO_BANDA   = 16;
        this.GRIS         = "FFF3F4F6";
        this.GRIS_NA      = "FFD1D5DB";
        this.AMARILLO     = "FFFEF3C7";
    }

    // -- Interface --

    render() {
        this.createModalForm({
            id: `form${this.PROJECT_NAME}`,
            data: { opc: "showFormatoConteo" },
            theme: "light",
            coffeesoft: true,
            bootbox: {
                title: "Formato de conteo",
                closeButton: true
            },
            json: this.jsonFormato(),
            success: (response) => {
                if (response && response.status === 200) {
                    this.downloadFormato(response.data);
                } else {
                    this.alertBox({
                        type: "error",
                        theme: "light",
                        title: (response && response.message) || "No se pudo generar el formato",
                        timer: 2500
                    });
                }
            }
        });
    }

    // Área y categoría arrancan con lo que ya está elegido en el filtro de Productos.
    jsonFormato() {
        const filtro = (id) => $(`#filterBarProducts #${id}`).val() || "";

        return [
            {
                opc: "select",
                id: "formato",
                lbl: "Formato",
                class: "col-12",
                data: [
                    { id: "completo", valor: "Completo: movimientos, físico y diferencia" },
                    { id: "sencillo", valor: "Sencillo: movimientos y teórico" }
                ]
            },
            {
                opc: "input",
                id: "semana",
                type: "date",
                lbl: "Semana del",
                class: "col-12 col-md-6",
                value: this.mondayOf(new Date())
            },
            {
                opc: "select",
                id: "inicial",
                lbl: "Existencia inicial",
                class: "col-12 col-md-6",
                data: [
                    { id: "1", valor: "Del sistema" },
                    { id: "0", valor: "En blanco" }
                ]
            },
            {
                opc: "select",
                id: "warehouse_id",
                lbl: "Almacén",
                class: "col-12",
                required: false,
                data: [{ id: "", valor: "Todos" }, ...almacenes]
            },
            {
                opc: "select",
                id: "area_id",
                lbl: "Área",
                class: "col-12 col-md-6",
                required: false,
                value: filtro("area"),
                data: [{ id: "", valor: "Todas" }, ...areas]
            },
            {
                opc: "select",
                id: "category_id",
                lbl: "Categoría",
                class: "col-12 col-md-6",
                required: false,
                value: filtro("categoria"),
                data: [{ id: "", valor: "Todas" }, ...categorias]
            }
        ];
    }

    async downloadFormato(data) {
        try {
            await this.loadExcelJS();
        } catch (e) {
            this.alertBox({
                type: "error",
                theme: "light",
                title: "No se pudo cargar el generador de Excel. Revisa la conexión.",
                timer: 3000
            });
            return;
        }

        const { workbook, hojas } = this.createFormato(data);
        const buffer = await workbook.xlsx.writeBuffer();
        const link   = document.createElement("a");

        link.href     = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
        link.download = `Inventario_rapido_${data.formato}_${this.fmtDate(data.lunes).replace(/\//g, "-")}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);

        this.alertBox({
            type: "success",
            theme: "light",
            title: `Formato listo: ${data.rows.length} productos en ${hojas} hojas`,
            timer: 2000
        });
    }

    // -- Excel --

    createFormato(data) {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = data.usuario || "CoffeeSoft";
        workbook.calcProperties.fullCalcOnLoad = true;

        const hojas = this.sheetFormato(workbook, data);
        this.sheetInstrucciones(workbook, data);

        return { workbook, hojas };
    }

    // Los saltos de página se ponen a mano: cada área empieza en hoja nueva (para
    // repartir las hojas por zona) y ningún producto queda partido entre dos hojas.
    // El área se repite arriba de cada hoja que continúa.
    sheetFormato(workbook, data) {
        const ws   = workbook.addWorksheet("Inventario", { views: [{ state: "frozen", ySplit: 6 }] });
        const dias = this.diasSemana(data.lunes);
        const movs = this.movimientos(data.formato);

        this.setColumns(ws, dias);
        this.encabezado(ws, data, dias);

        const escala   = this.escalaImpresion(ws);
        const altoUtil = ((7.4 * 72) / (escala / 100) - this.ALTO_TITULOS.reduce((a, b) => a + b, 0)) * 0.95;
        const bloque   = movs.length * this.ALTO_FILA;

        let r = 7, usado = 0, hojas = 1, area = null;

        data.rows.forEach((p) => {
            let banda = p.area_id !== area;

            if (usado > 0 && (banda || usado + bloque > altoUtil)) {
                ws.getRow(r - 1).addPageBreak();
                usado = 0;
                hojas++;
                banda = true;
            }

            if (banda) {
                this.bandaArea(ws, r, p, p.area_id === area);
                area = p.area_id;
                usado += this.ALTO_BANDA;
                r++;
            }

            this.bloqueProducto(ws, r, p, movs, dias, data.inicial);
            usado += bloque;
            r += movs.length;
        });

        const pie = (t) => String(t || "").replace(/&/g, "&&");

        ws.pageSetup = {
            paperSize: 1,
            orientation: "landscape",
            scale: escala,
            fitToPage: false,
            horizontalCentered: true,
            printTitlesRow: "1:6",
            margins: { left: 0.4, right: 0.4, top: 0.55, bottom: 0.55, header: 0.25, footer: 0.25 }
        };
        ws.headerFooter.oddFooter = `&L&8Almacén: ${pie(data.almacen)}&C&8Hoja &P de &N&R&8Semana del ${this.fmtDate(data.lunes)}`;

        return hojas;
    }

    // Leyenda de colores y un producto de ejemplo con lunes y martes capturados.
    sheetInstrucciones(workbook, data) {
        const ws       = workbook.addWorksheet("Cómo llenarlo");
        const dias     = this.diasSemana(data.lunes);
        const movs     = this.movimientos(data.formato);
        const completo = data.formato === "completo";

        this.setColumns(ws, dias);
        this.mergeText(ws, "A1:L1", "CÓMO LLENAR EL FORMATO", { bold: true, size: 12 });
        ws.getRow(1).height = 22;

        const reglas = [
            [null, "Blanco: se llena a mano con lo que pasó ese día (entradas, ventas, salidas y desperdicio)."],
            ...(completo ? [[this.AMARILLO, "Amarillo: físico almacén, lo que se cuenta en el anaquel al cierre del día."]] : []),
            [this.GRIS, "Gris: se calcula solo al capturarlo en Excel. Teórico = inicial + entradas − ventas − salidas − desperdicio." + (completo ? " Diferencia = físico − teórico." : "")],
            [this.GRIS_NA, "Gris oscuro: no aplica. El TOTAL suma la semana de los movimientos; una existencia no se suma."],
            [null, data.inicial
                ? `Existencia inicial del lunes: la del sistema al ${this.fmtDate(data.generado)} ${data.generado.slice(11, 16)}.`
                : "Existencia inicial del lunes: en blanco, se anota a mano."],
            [null, completo
                ? "Del martes en adelante la existencia inicial es el físico del día anterior (o el teórico si ese día no se contó)."
                : "Del martes en adelante la existencia inicial es el teórico del día anterior."],
            [null, "Si un día no hubo movimiento, anota 0: así se calcula el teórico de ese día."],
            [null, "Firma cada hoja: quién contó, quién revisó y quién autorizó."]
        ];

        reglas.forEach(([tono, texto], i) => {
            const r = i + 3;
            this.paint(ws.getCell(`A${r}`), { fill: tono, border: this.bordes() });
            this.mergeText(ws, `B${r}:L${r}`, texto, { wrap: true });
            ws.getRow(r).height = 18;
        });

        const r0 = reglas.length + 4;
        this.mergeText(ws, `A${r0}:L${r0}`, "EJEMPLO: lunes y martes capturados", { bold: true });
        this.filaTitulos(ws, r0 + 1, dias);
        ws.getRow(r0 + 1).height = 26;

        const fila = this.bloqueProducto(ws, r0 + 2, { sku: "02003", name: "AGUA NATURAL 600 ML", unidad: "PZA", existencia: 54 }, movs, dias, true);
        const captura = {
            E: { entradas: 24, ventas: 18, salidas: 0, desperdicio: 1, fisico: 58 },
            F: { entradas: 0, ventas: 12, salidas: 2, desperdicio: 0, fisico: 44 }
        };

        Object.keys(captura).forEach((col) => {
            Object.keys(captura[col]).forEach((key) => {
                if (fila[key]) ws.getCell(`${col}${fila[key]}`).value = captura[col][key];
            });
        });

        ws.pageSetup = {
            paperSize: 1,
            orientation: "landscape",
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 1,
            horizontalCentered: true,
            margins: { left: 0.4, right: 0.4, top: 0.55, bottom: 0.55, header: 0.25, footer: 0.25 }
        };
    }

    // Renglones 1-6, los que se repiten en cada hoja impresa: título, empresa,
    // filtros, firmas y encabezados de columna (mismo orden que el reporte de Soft).
    encabezado(ws, data, dias) {
        const titulo = "REPORTE DE INVENTARIO RÁPIDO" + (data.formato === "completo" ? " · CONTEO FÍSICO" : "");
        const empresa = [data.rfc ? `RFC: ${data.rfc}` : "", data.ubicacion].filter(Boolean).join("   ·   ");
        const filtros = [
            `Sucursal: ${data.sucursal || "-"}`,
            `Almacén: ${data.almacen}`,
            `Semana del ${this.fmtDate(data.lunes)} al ${this.fmtDate(dias[6].iso)}`,
            data.filtro
        ].filter(Boolean).join("   ·   ");
        const linea = "_______________________________";

        this.mergeText(ws, "A1:H1", titulo, { bold: true, size: 14 });
        this.mergeText(ws, "I1:L1", `Fecha: ${this.fmtDate(data.generado)}`, { h: "right" });
        this.mergeText(ws, "A2:H2", data.empresa, { bold: true, size: 11 });
        this.mergeText(ws, "I2:L2", `Hora: ${data.generado.slice(11, 16)}`, { h: "right" });
        this.mergeText(ws, "A3:H3", empresa, { color: "FF4B5563" });
        this.mergeText(ws, "I3:L3", `Imprimió: ${data.usuario || "-"}`, { h: "right", color: "FF4B5563" });
        this.mergeText(ws, "A4:L4", filtros);
        this.mergeText(ws, "A5:L5", `Contó: ${linea}      Revisó: ${linea}      Autorizó: ${linea}`, { v: "bottom" });
        this.filaTitulos(ws, 6, dias);

        this.ALTO_TITULOS.forEach((h, i) => ws.getRow(i + 1).height = h);
    }

    filaTitulos(ws, r, dias) {
        const titulos = ["CLAVE", "DESCRIPCIÓN", "UNIDAD", "MOVIMIENTO", ...dias.map((d) => `${d.nombre}\n${d.corto}`), "TOTAL"];

        titulos.forEach((t, i) => {
            const cell = ws.getRow(r).getCell(i + 1);
            cell.value = t;
            this.paint(cell, { bold: true, size: 8, fill: "FFE5E7EB", h: "center", wrap: true, border: this.bordes() });
        });
    }

    bandaArea(ws, r, p, continua) {
        ws.mergeCells(`A${r}:L${r}`);
        ws.getCell(`A${r}`).value = `ÁREA: ${String(p.area).toUpperCase()}${continua ? "   (continúa)" : ""}`;

        for (let c = 1; c <= 12; c++) {
            this.paint(ws.getRow(r).getCell(c), { bold: true, fill: this.GRIS, border: this.bordes() });
        }

        ws.getRow(r).height = this.ALTO_BANDA;
    }

    // Clave, descripción y unidad van combinadas a lo alto del bloque. Devuelve el
    // renglón de cada movimiento para que el ejemplo pueda llenarlo.
    bloqueProducto(ws, r0, p, movs, dias, conInicial) {
        const fila = {};
        movs.forEach((m, i) => fila[m.key] = r0 + i);
        const fin = r0 + movs.length - 1;

        ["A", "B", "C"].forEach((c) => ws.mergeCells(`${c}${r0}:${c}${fin}`));
        ws.getCell(`A${r0}`).value = p.sku || "";
        ws.getCell(`B${r0}`).value = p.name;
        ws.getCell(`C${r0}`).value = p.unidad || "";

        movs.forEach((m, i) => {
            const r     = r0 + i;
            const borde = this.bordes(r === fin);
            const tono  = m.tipo === "calculo" ? this.GRIS : (m.tipo === "fisico" ? this.AMARILLO : null);
            const suma  = m.tipo === "captura" || m.key === "diferencia";

            ws.getRow(r).height = this.ALTO_FILA;

            this.paint(ws.getCell(`A${r}`), { h: "center", v: "top", border: borde });
            this.paint(ws.getCell(`B${r}`), { bold: true, v: "top", wrap: true, border: borde });
            this.paint(ws.getCell(`C${r}`), { h: "center", v: "top", border: borde });

            const label = ws.getCell(`D${r}`);
            label.value = m.label;
            this.paint(label, { size: 8, bold: m.tipo === "calculo" || m.tipo === "fisico", fill: tono, border: borde });

            dias.forEach((d, j) => {
                const cell = ws.getCell(`${d.col}${r}`);
                cell.value = this.formulaDia(m.key, d.col, j > 0 ? dias[j - 1].col : null, fila, p, conInicial);
                this.paint(cell, { h: "center", bold: m.tipo === "fisico", fill: tono, border: borde });
            });

            const total = ws.getCell(`L${r}`);
            total.value = suma ? { formula: `IF(COUNT(E${r}:K${r})=0,"",SUM(E${r}:K${r}))` } : null;
            this.paint(total, { h: "center", bold: true, fill: suma ? tono : this.GRIS_NA, border: borde });
        });

        return fila;
    }

    // Las fórmulas devuelven "" mientras no haya captura, para que la hoja impresa
    // salga en blanco. El teórico solo corre cuando hay al menos un movimiento del día.
    formulaDia(key, col, prev, fila, p, conInicial) {
        const f = (formula) => ({ formula });

        switch (key) {
            case "inicial":
                if (!prev) return conInicial ? Math.round(Number(p.existencia) * 1000) / 1000 : null;
                return fila.fisico
                    ? f(`IF(${prev}${fila.fisico}<>"",${prev}${fila.fisico},${prev}${fila.teorico})`)
                    : f(`${prev}${fila.teorico}`);

            case "teorico":
                return f(`IF(COUNT(${col}${fila.entradas}:${col}${fila.desperdicio})=0,"",N(${col}${fila.inicial})+N(${col}${fila.entradas})-N(${col}${fila.ventas})-N(${col}${fila.salidas})-N(${col}${fila.desperdicio}))`);

            case "diferencia":
                return f(`IF(OR(${col}${fila.fisico}="",${col}${fila.teorico}=""),"",${col}${fila.fisico}-${col}${fila.teorico})`);

            default:
                return null;
        }
    }

    // -- Complements --

    movimientos(formato) {
        const base = [
            { key: "inicial",     label: "Existencia inicial",      tipo: "existencia" },
            { key: "entradas",    label: "Entradas de almacén",     tipo: "captura" },
            { key: "ventas",      label: "Ventas",                  tipo: "captura" },
            { key: "salidas",     label: "Salidas de almacén",      tipo: "captura" },
            { key: "desperdicio", label: "Salidas por desperdicio", tipo: "captura" },
            { key: "teorico",     label: "Teórico almacén",         tipo: "calculo" }
        ];

        if (formato === "sencillo") return base;

        return [
            ...base,
            { key: "fisico",     label: "Físico almacén",     tipo: "fisico" },
            { key: "diferencia", label: "Diferencia almacén", tipo: "calculo" }
        ];
    }

    diasSemana(lunes) {
        const [y, m, d] = lunes.split("-").map(Number);

        return this.DIAS.map((nombre, i) => {
            const iso = this.isoDate(new Date(y, m - 1, d + i));
            return { nombre, iso, corto: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`, col: String.fromCharCode(69 + i) };
        });
    }

    setColumns(ws, dias) {
        ws.columns = [
            { width: 8 },
            { width: 30 },
            { width: 7 },
            { width: 19 },
            ...dias.map(() => ({ width: 9.5 })),
            { width: 9 }
        ];
    }

    // Escala para que las 12 columnas quepan a lo ancho de una carta horizontal
    // (10.2" útiles). Ancho de columna en px ≈ caracteres × 7 + 5.
    escalaImpresion(ws) {
        const anchoPx = ws.columns.reduce((total, c) => total + Math.round(c.width * 7 + 5), 0);
        return Math.min(100, Math.floor((10.2 * 96) / anchoPx * 100) - 1);
    }

    bordes(cierre = false) {
        const thin = { style: "thin", color: { argb: "FF9CA3AF" } };
        return {
            top: thin,
            left: thin,
            right: thin,
            bottom: cierre ? { style: "medium", color: { argb: "FF374151" } } : thin
        };
    }

    // Estilo completo por celda: un objeto nuevo en cada una, porque ExcelJS
    // comparte el estilo entre las celdas de un rango combinado.
    paint(cell, { bold = false, size = 9, color = "FF111827", fill = null, h = "left", v = "middle", wrap = false, border = null } = {}) {
        cell.style = {
            font: { name: "Arial", size, bold, color: { argb: color } },
            alignment: { horizontal: h, vertical: v, wrapText: wrap },
            border: border || {},
            fill: fill ? { type: "pattern", pattern: "solid", fgColor: { argb: fill } } : { type: "pattern", pattern: "none" }
        };
    }

    mergeText(ws, range, value, style = {}) {
        ws.mergeCells(range);
        const cell = ws.getCell(range.split(":")[0]);
        cell.value = value;
        this.paint(cell, { v: "middle", ...style });
    }

    loadExcelJS() {
        if (window.ExcelJS) return Promise.resolve();

        return new Promise((resolve, reject) => {
            const script   = document.createElement("script");
            script.src     = this.EXCELJS;
            script.onload  = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    mondayOf(date) {
        return this.isoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7)));
    }

    isoDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    fmtDate(iso) {
        return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
    }
}
