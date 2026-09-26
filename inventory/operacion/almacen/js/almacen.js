let api = 'ctrl/ctrl-almacen.php';
let main, products, asistente;
let categorias, unidades, areas, proveedores;

// Catalogo
let api_catalogo = 'ctrl/ctrl-catalogo.php';
let  cataloge, category, area, unit, warehouse, inflow, shrinkage, supplier, transferStatus;

$(async () => {
    const data     = await useFetch({ url: api, data: { opc: "init" } });
    categorias     = data.categorias  || [];
    unidades       = data.unidades    || [];
    areas          = data.areas       || [];
    proveedores    = data.proveedores || [];

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
                    text: "Asistente IA",
                    icon: "icon-magic",
                    className: 'w-100',
                    class: "col-12 col-md-2",
                    color_btn: "outline",
                    onClick: () => asistente.render()
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
                center: [2,3,4,5,6,9],
                right: [8],
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

    // El formulario va en cinco bloques, en el orden en que se captura un producto:
    // qué es (identificación), en cuánto se vende (venta), cuánto tener (inventario),
    // cuánto costó (costo, opcional porque lo actualizan las entradas) y notas.
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
                opc: "input",
                id: "name",
                lbl: "Nombre del producto",
                class: "col-12 col-md-8",
                required: true
            },
            {
                // Automático, formato Soft Restaurant (categoría + consecutivo: 04003): lo
                // asigna el controlador al guardar. Va deshabilitado, así que no viaja en el
                // POST; solo se enseña.
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

            // -- Inventario --
            {
                opc: "label",
                id: "lblInventario",
                text: "Inventario",
                class: section + " pt-3"
            },
            // Área = en qué parte del almacén se guarda. Tiene que viajar siempre:
            // editMaterial la escribe, y si falta en el form la dejaría en NULL.
            {
                opc: "select",
                id: "warehouse_area_id",
                lbl: "Área",
                class: "col-12 col-md-3",
                data: [{ id: '', valor: 'Sin área' }, ...areas],
                required: false
            },
            {
                opc: "input",
                id: "stock_min",
                lbl: "Mínimo",
                tipo: "numero",
                required: false,
                class: "col-12 col-md-3"
            },
            {
                opc: "input",
                id: "stock_max",
                lbl: "Máximo",
                tipo: "numero",
                required: false,
                class: "col-12 col-md-3"
            },
            {
                opc: "input",
                id: "shelf_life_days",
                lbl: "Vida útil (días)",
                tipo: "numero",
                required: false,
                class: "col-12 col-md-3"
            },

            // -- Costo --
            // Último costo de compra sin IVA. Cada entrada y cada recepción de orden lo
            // reemplaza; aquí solo se captura si el producto aún no tiene compras.
            {
                opc: "label",
                id: "lblCosto",
                text: "Costo",
                class: section + " pt-3"
            },
            {
                opc: "input",
                id: "cost_unit",
                lbl: "Último costo sin IVA",
                tipo: "cifra",
                class: "col-12 col-md-6",
                required: false,
                placeholder: "Se actualiza con cada entrada"
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
                title:       "Asistente de catálogo",
                subtitle:    "Productos, categorías, unidades, áreas, almacenes y proveedores",
                placeholder: "Escribe o adjunta un Excel o una foto…",
                accept:      ".xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp",
                welcome:     "Puedo dar de alta, cambiar, dar de baja y reactivar productos, categorías, unidades, áreas, almacenes y proveedores. Escríbeme, adjunta un Excel o pega la foto de una lista: te enseño una vista previa y nada se guarda hasta que confirmes.",
                suggestions: [
                    "Crea la categoría Cortes y pásale todos los cortes de res",
                    "Pon la arrachera y la picaña en el área CONGELADOR con mínimo 5",
                    "Cambia el teléfono del proveedor Walmart a 993 123 4567",
                    "Actualiza los precios con la lista que adjunto"
                ],
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

        if (toca("category") || toca("unit") || toca("area") || toca("supplier")) {
            const data = await useFetch({ url: this._link, data: { opc: "init" } });

            if (data) {
                categorias  = data.categorias  || [];
                unidades    = data.unidades    || [];
                areas       = data.areas       || [];
                proveedores = data.proveedores || [];
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
