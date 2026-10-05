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
                    id: "unidades",
                    tab: "Unidad",
                    lucideIcon: "ruler",
                    class: `mb-1 ${paneClass}`,
                    onClick: () => unit.lsUnit()
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
                // Mismo orden que las columnas de la tabla: primero qué es, luego dónde está.
                {
                    opc: "select",
                    id: "categoria",
                    lbl: "Categoría",
                    class: "col-12 col-md-2",
                    data: [{ id: '', valor: 'Todas' }, ...categorias],
                    onchange: 'products.lsMateriales()'
                },
                // Área = dónde está dentro del almacén (anaquel, refrigerador...).
                // Lo que hay en cada almacén se consulta en Stock, no aquí.
                // Buscador con casillas para excluir áreas (mountAreaFilter).
                {
                    opc: "select",
                    id: "area",
                    lbl: "Área",
                    class: "col-12 col-md-2",
                    select2: true,
                    badge: true,
                    data: [
                        { id: '', valor: 'Todas las áreas' },
                        ...areas,
                        { id: 'none', valor: 'Sin área' }
                    ]
                },
                // Arranca en Activos. La columna Estado solo sale con "Todos" (lsMateriales).
                {
                    opc: "select",
                    id: "estado",
                    lbl: "Estado",
                    class: "col-12 col-md-2",
                    data: [
                        { id: '1', valor: 'Activos' },
                        { id: '0', valor: 'Inactivos' },
                        { id: '', valor: 'Todos' }
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
                // Colores fijos, no del tema: `blue-*` sigue al acento (terracota en Claro),
                // por eso el azul va en hex (el de erp-pro). El `!` gana al color del preset.
                {
                    opc: "button",
                    id: "btnAsistenteIA",
                    text: "CoffeeIA",
                    icon: "icon-magic",
                    className: 'w-100 !border-[#2563EB] !text-[#2563EB] hover:!bg-[#2563EB] hover:!text-white focus:!ring-[#2563EB]',
                    class: "col-12 col-md-2",
                    color_btn: "outline",
                    onClick: () => asistente.render()
                },
                {
                    opc: "button",
                    id: "btnFormatoConteo",
                    text: "Formato conteo",
                    icon: "icon-file-excel",
                    className: 'w-100 !border-[#217346] !text-[#217346] hover:!bg-[#217346] hover:!text-white focus:!ring-[#217346]',
                    class: "col-12 col-md-2",
                    color_btn: "outline",
                    onClick: () => conteo.render()
                }
            ]
        });

        this.mountAreaFilter();
    }

    mountAreaFilter() {
        select2Checklist({
            id: "area",
            placeholder: "áreas",
            all: "Todas las áreas",
            none: "Ninguna área",
            format: (opt) => this.cfBadgeOption(opt),
            onChange: () => this.lsMateriales()
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
            conf: { datatable: true, fn_datatable: 'productsDataTable', pag: 25 },
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

    // Recarga el catálogo global de almacenes tras cambios en la pestaña Almacenes:
    // el select del formulario "Nueva área" y el Formato de conteo leen `almacenes`.
    async reloadAlmacenes() {
        const data = await useFetch({ url: this._link, data: { opc: "init" } });
        almacenes = data.almacenes || [];
    }

    // Orden de captura: identificación (nombre, categoría, unidad, código, foto), costo
    // (costo con impuesto, IVA de compra y último costo), inventario (inventariable,
    // área, mínimo, máximo, vida útil) y notas. El precio de venta no se captura aquí.
    // Rejilla de 3 en 3 (col-md-4, mismo ancho en todos); la descripción a lo ancho.
    // Los encabezados son `opc: "label"`; su estilo va en la clase porque coffeeForm la
    // pasa al contenedor (cfToTailwindGrid borra mt-N / p-N, por eso se usa pt-/pb-).
    jsonMaterial() {
        const section = "col-12 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500";

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
                class: "col-12 col-md-4",
                required: true
            },
            {
                opc: "select",
                id: "category_id",
                lbl: "Categoría",
                class: "col-12 col-md-4",
                select2: true,
                data: categorias,
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
            {
                // Editable. Vacío = automático, formato Soft Restaurant (categoría +
                // consecutivo: 04003) que asigna el controlador al guardar.
                opc: "input",
                id: "sku",
                lbl: "Código (SKU)",
                class: "col-12 col-md-4",
                placeholder: "Auto",
                required: false
            },
            // Lo llena mountProductPhoto: vista previa, subir/cambiar y quitar.
            {
                opc: "div",
                id: "photoField",
                lbl: "Foto",
                class: "col-12 col-md-8",
                required: false
            },

            // -- Costo --
            // Último costo de compra sin IVA. Cada entrada y cada recepción de orden lo
            // reemplaza (con su IVA); aquí solo se captura si el producto aún no tiene
            // compras. El costo con impuesto no se guarda: se calcula de los otros dos.
            // La nota "Se actualiza con cada entrada" va debajo (mountMaterialHints).
            {
                opc: "label",
                id: "lblCosto",
                text: "Costo",
                class: section + " pt-1"
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
            {
                opc: "select",
                id: "cost_tax",
                lbl: "IVA",
                class: "col-12 col-md-4",
                onchange: "products.calcCostByTax()",
                data: [
                    {
                        id: '0',
                        valor: '0%'
                    },
                    {
                        id: '8',
                        valor: '8%'
                    },
                    {
                        id: '16',
                        valor: '16%'
                    }
                ]
            },
            {
                opc: "input",
                id: "cost_unit",
                lbl: "Último costo",
                tipo: "cifra",
                class: "col-12 col-md-4",
                required: false,
                placeholder: "0.00",
                onkeyup: "products.calcCostWithTax()",
                onchange: "products.calcCostWithTax()"
            },

            // -- Inventario --
            {
                opc: "label",
                id: "lblInventario",
                text: "Inventario",
                class: section + " pt-1"
            },
            {
                opc: "select",
                id: "is_inventoriable",
                lbl: "Inventariable",
                class: "col-12 col-md-4",
                data: [
                    {
                        id: '1',
                        valor: 'Sí'
                    },
                    {
                        id: '0',
                        valor: 'No'
                    }
                ]
            },
            // Área = en qué parte del almacén se guarda. Tiene que viajar siempre:
            // editMaterial la escribe, y si falta en el form la dejaría en NULL.
            // Cada área trae su color (init de ctrl-almacen) y se pinta como en la tabla.
            {
                opc: "select",
                id: "warehouse_area_id",
                lbl: "Área",
                class: "col-12 col-md-4",
                select2: true,
                badge: true,
                search: true,
                data: [
                    {
                        id: '',
                        valor: 'Sin área'
                    },
                    ...areas
                ],
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

            // -- Descripción --
            {
                opc: "textarea",
                id: "description",
                lbl: "Descripción",
                class: "col-12 pt-1",
                placeholder: "Notas del producto (opcional)",
                required: false,
                rows: 2
            }
        ];
    }

    // Costo c/impuesto = último costo + IVA de compra. Al editar, el autofill cambia el
    // select del IVA y eso lo pinta con el costo guardado.
    calcCostWithTax() {
        if (this.syncingCost) return;
        const cost = parseFloat($('#cost_unit').val());
        if (isNaN(cost)) return;
        const taxPct = parseFloat($('#cost_tax').val()) || 0;

        this.costAnchor  = 'unit';
        this.syncingCost = true;
        $('#cost_with_tax').val((cost * (1 + taxPct / 100)).toFixed(2));
        this.syncingCost = false;
    }

    calcCostUnit() {
        if (this.syncingCost) return;
        const total = parseFloat($('#cost_with_tax').val());
        if (isNaN(total)) return;
        const taxPct = parseFloat($('#cost_tax').val()) || 0;

        this.costAnchor  = 'withTax';
        this.syncingCost = true;
        $('#cost_unit').val((total / (1 + taxPct / 100)).toFixed(2));
        this.syncingCost = false;
    }

    // Al cambiar el IVA se respeta el costo que se tecleó al último: si fue el de
    // c/impuesto se recalcula el último costo, y al revés. Cada formulario arranca
    // anclado al último costo (lo que trae el autofill al editar).
    calcCostByTax() {
        if (this.costAnchor === 'withTax') this.calcCostUnit();
        else this.calcCostWithTax();
    }

    // La nota del último costo va debajo del input, en chico (antes era el placeholder).
    // Si el formulario no cabe entero se deja el scroll propio del cuerpo de cfModal
    // (72vh), así los botones Aceptar/Cancelar siempre se ven.
    mountMaterialHints(formId) {
        mountFieldHints(formId, { cost_unit: "Se actualiza con cada entrada." });
    }

    // Foto: vista previa, "Subir foto" / "Cambiar foto" y "Quitar". Se achica en el
    // navegador (compressPhoto) y viaja como dataURL en el oculto image_b64;
    // image_remove = 1 le pide a editMaterial que la borre. Si no se toca, los dos van
    // vacíos y la foto guardada se queda. El input de archivo va sin `name` para no
    // entrar al FormData del formulario.
    mountProductPhoto(formId, image = '') {
        const $field  = $(`#${formId} #photoField`);
        const $b64    = $('<input>', { type: 'hidden', name: 'image_b64', value: '' });
        const $remove = $('<input>', { type: 'hidden', name: 'image_remove', value: '0' });
        const $file   = $('<input>', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'hidden' });
        const $thumb  = $('<div>', { class: 'w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 overflow-hidden' });
        const $pick   = $('<button>', { type: 'button', class: 'inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition hover:border-blue-600 hover:text-blue-600' });
        const $drop   = $('<button>', { type: 'button', text: 'Quitar', class: 'text-xs font-medium text-red-500 hover:text-red-700 hover:underline' });

        const paint = (src) => {
            $thumb.empty().append(src
                ? $('<img>', { src: src, alt: 'Foto del producto', class: 'w-full h-full object-cover' })
                : $('<i>', { 'data-lucide': 'image', class: 'w-5 h-5 text-gray-400' }));
            $pick.empty().append(
                $('<i>', { 'data-lucide': 'upload', class: 'w-4 h-4' }),
                $('<span>', { text: src ? 'Cambiar foto' : 'Subir foto' })
            );
            $drop.toggleClass('hidden', !src);
            if (typeof lucide !== 'undefined') lucide.createIcons();
        };

        $pick.on('click', () => $file.trigger('click'));

        $file.on('change', async () => {
            const file = $file[0].files[0];
            $file.val('');
            if (!file) return;

            const dataUrl = await compressPhoto(file);

            if (!dataUrl) {
                this.alertBox({ type: 'warning', theme: 'light', title: 'No se pudo leer la foto', detailHtml: 'Usa una imagen JPG, PNG o WEBP.' });
                return;
            }

            $b64.val(dataUrl);
            $remove.val('0');
            paint(dataUrl);
        });

        $drop.on('click', () => {
            $b64.val('');
            $remove.val('1');
            paint('');
        });

        $field.addClass('flex items-center gap-3').append($thumb, $pick, $drop, $file, $b64, $remove);
        paint(productImageUrl(image));
    }

    addMaterial() {
        this.costAnchor = 'unit';

        this.createModalForm({
            id: 'formMaterialAdd',
            data: { opc: 'addMaterial' },
            theme:'light',
            coffeesoft:true,
            bootbox: {
                title: 'Nuevo Producto',
                size: 'large',
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

        this.mountMaterialHints('formMaterialAdd');
        this.mountProductPhoto('formMaterialAdd');
    }

    async editMaterial(id) {
        const request = await useFetch({
            url: this._link,
            data: { opc: "getMaterial", id: id }
        });

        if (request.status === 200) {
            // Sin área llega NULL; '' selecciona la opción "Sin área" del select.
            request.data.warehouse_area_id = request.data.warehouse_area_id || '';
            this.costAnchor = 'unit';

            this.createModalForm({
                id: 'formMaterialEdit',
                data: { opc: 'editMaterial', id: id },
                theme:'light',
                coffeesoft:true,
                bootbox: {
                    title: 'Editar Producto',
                    size: 'large',
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

            this.mountMaterialHints('formMaterialEdit');
            this.mountProductPhoto('formMaterialEdit', request.data.image);
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

// -- Tabla de Productos --
// Lo escrito en el buscador de la tabla. Cada filtro vuelve a pintar la tabla; con esto
// la búsqueda sigue puesta en vez de borrarse.
let productsSearch = "";

const plainText = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// El buscador no distingue acentos ni mayúsculas ("azucar" encuentra "Azúcar") y acepta
// varias palabras en cualquier orden. La búsqueda propia de DataTables 1.13 compara los
// acentos tal cual, por eso se filtra aquí y solo en la tabla de Productos.
if ($.fn.dataTable) {
    $.fn.dataTable.ext.search.push((settings, data) => {
        if (settings.nTable.id !== "tbMateriales" || !productsSearch.trim()) return true;

        const row = plainText(data.join(" "));
        return plainText(productsSearch).split(/\s+/).filter(Boolean).every((word) => row.includes(word));
    });
}

// DataTable de Productos (conf.fn_datatable): como simple_data_table, más el selector
// de cuántos ver (10/25/50/100), que se recuerda en la sesión, y el buscador (busca en
// las filas ya cargadas: nombre, categoría, área...). createCoffeeTable3 deja el
// zebra fijo por fila y al ordenar o cambiar de página quedaban dos grises (o dos
// blancos) juntos: se repinta en cada draw sobre las filas visibles.
function productsDataTable(table, no) {
    const key   = `${table.replace("#", "")}_length`;
    const saved = parseInt(sessionStorage.getItem(key), 10);

    $(table)
        .on("draw.dt", () => repaintZebra(table))
        .on("length.dt", (e, settings, len) => sessionStorage.setItem(key, len));

    const dt = $(table).DataTable({
        pageLength: [10, 25, 50, 100].includes(saved) ? saved : no,
        lengthMenu: [10, 25, 50, 100],
        lengthChange: true,
        destroy: true,
        searching: true,
        order: [],
        info: true,
        language: {
            search: "",
            searchPlaceholder: "Buscar producto...",
            zeroRecords: "Ningún producto coincide con la búsqueda",
            infoFiltered: "(filtrados de _MAX_)",
            lengthMenu: "Mostrar _MENU_ registros",
            info: "Mostrando del (_START_ al _END_) de un total de _TOTAL_ registros",
            infoEmpty: "Mostrando del 0 al 0 de un total de 0 registros",
            loadingRecords: "Por favor espere - cargando...",
            paginate: {
                first: "Primero",
                last: "Último",
                next: "Siguiente",
                previous: "Anterior"
            }
        }
    });

    // El buscador filtra con el ext.search de arriba: se suelta la búsqueda propia de
    // DataTables y solo se vuelve a dibujar.
    $(`${table}_filter input`).val(productsSearch).off().on("input", function () {
        productsSearch = this.value;
        dt.draw();
    });

    getPageDataTable(table);
}

// Mismo gris que el striped del tema light de createCoffeeTable3 (color_row_alt).
function repaintZebra(table, alt = "bg-gray-100") {
    $(table).children("tbody").children("tr").each((i, tr) => {
        $(tr).children("td").toggleClass(alt, i % 2 === 0);
    });
}

// -- Foto del producto --

// item.image es relativa a inventory/ (uploads/productos/...) y esta página vive en
// operacion/almacen/. Espejo de renderProductImage (ctrl-almacen); mantener ambos en sync.
function productImageUrl(path) {
    if (!path) return "";
    return /^(https?:)?\/\/|^\//i.test(path) ? path : `../../${path}`;
}

// La foto lista para guardar: JPEG de máximo `max` px por lado. Va sobre blanco para que
// lo transparente de un PNG no salga negro. Resuelve "" si el navegador no la puede abrir.
function compressPhoto(file, max = 800) {
    return new Promise((resolve) => {
        if (!file || !/^image\//.test(file.type)) return resolve("");

        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            const scale  = Math.min(1, max / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");
            canvas.width  = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);

            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve("");
        };
        img.src = url;
    });
}

// -- Filtro con casillas --
// Select2 con buscador y una casilla por opción, todas marcadas al inicio: quitar una la
// excluye (como el filtro de estados de Actividades en corporativogv). Las dos primeras
// filas marcan o quitan todas. El select se queda en su opción vacía, que hace de
// etiqueta ("Todas las áreas", "Barra, Bodega", "3 de 8 áreas"), y su `name` pasa a un
// input oculto, que es lo que lee el filterBar:
//     ''          todas marcadas (sin filtro)
//     'a,b'       solo esas
//     '__none__'  ninguna marcada (no sale nada)
// Cada clic llama `onChange` (agrupa los clics seguidos). `format(opt)` pinta la
// etiqueta de cada opción, ej. el badge del área.
function select2Checklist(opts) {
    const ALL    = "__all__";
    const NONE   = "__none__";
    const $sel   = $(`#${opts.id}`);
    const all    = $sel.find("option").map((i, o) => o.value).get().filter((v) => v !== "");
    const $value = $("<input>", { type: "hidden", name: $sel.attr("name"), value: "" });
    let checked  = all.slice();
    let timer    = null;

    if (!$sel.length || !$.fn.select2) return;

    const names = () => all.filter((id) => checked.includes(id)).map((id) => $sel.find(`option[value="${id}"]`).text());

    const summary = () => {
        if (checked.length === all.length) return opts.all;
        if (!checked.length) return opts.none;
        return checked.length <= 2 ? names().join(", ") : `${checked.length} de ${all.length} ${opts.placeholder}`;
    };

    const serialize = () => {
        if (checked.length === all.length) return "";
        if (!checked.length) return NONE;
        return all.filter((id) => checked.includes(id)).join(",");
    };

    const paint = () => {
        $(`#select2-${opts.id}-results input[data-check]`).each((i, box) => { box.checked = checked.includes(box.dataset.check); });
        $value.val(serialize());
        $sel.trigger("change.select2");

        clearTimeout(timer);
        timer = setTimeout(opts.onChange, 250);
    };

    $sel.attr("name", "").after($value);
    $sel.find('option[value=""]').after(
        $("<option>", { value: ALL, text: "Marcar todas" }),
        $("<option>", { value: NONE, text: "Quitar todas" })
    );

    // Con placeholder la opción vacía no sale en la lista y la etiqueta se pinta con
    // templateSelection. Al elegir una fila se cancela la selección (el select no cambia)
    // y solo se marca o desmarca su casilla: así la lista sigue abierta.
    $sel.select2({
        theme: "bootstrap-5",
        width: "100%",
        dropdownAutoWidth: true,
        selectionCssClass: "cs-select2-filter",
        placeholder: { id: "", text: opts.all },
        templateSelection: () => $("<span>", {
            class: checked.length === all.length ? "text-gray-800" : "font-semibold text-blue-600",
            text: summary()
        }),
        templateResult: (opt) => {
            if (!opt.element) return opt.text;
            if (opt.id === ALL || opt.id === NONE) return $("<span>", { class: "text-xs font-semibold text-blue-600", text: opt.text });

            return $("<span>", { class: "flex items-center gap-2" }).append(
                $("<input>", { type: "checkbox", tabindex: -1, "data-check": opt.id, class: "pointer-events-none accent-blue-600" }).prop("checked", checked.includes(opt.id)),
                opts.format ? opts.format(opt) : opt.text
            );
        }
    }).on("select2:selecting", (e) => {
        e.preventDefault();

        const id = e.params.args.data.id;

        if (id === ALL) checked = all.slice();
        else if (id === NONE) checked = [];
        else checked = checked.includes(id) ? checked.filter((c) => c !== id) : checked.concat(id);

        paint();
    });
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
