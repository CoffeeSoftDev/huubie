let api = 'ctrl/ctrl-almacen.php';
let main, products, asistente;
let categorias, unidades, areas, proveedores, almacenes, productos, superAdmin, coffeeIA, sucursales, sucursalSesion, administrador;

// Vida útil: cuántos días vale cada periodo del selector.
const PERIODOS_VIDA = [
    { id: '1',  valor: 'Días' },
    { id: '7',  valor: 'Semanas (7 días)' },
    { id: '14', valor: 'Dos semanas (14 días)' },
    { id: '30', valor: 'Meses (30 días)' }
];

// Catalogo
let api_catalogo = 'ctrl/ctrl-catalogo.php';
let  cataloge, category, area, unit, warehouse, inflow, shrinkage, supplier, transferStatus, requisitionStatus;

$(async () => {
    const data     = await useFetch({ url: api, data: { opc: "init" } });
    categorias     = data.categorias  || [];
    unidades       = data.unidades    || [];
    areas          = data.areas       || [];
    proveedores    = data.proveedores || [];
    almacenes      = data.almacenes   || [];
    productos      = data.productos   || [];
    superAdmin     = !!data.superadmin;
    coffeeIA       = data.coffeeia !== false;
    sucursales     = data.sucursales  || [];
    sucursalSesion = String(data.branch_id || '');
    administrador  = !!data.administrador;

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
    requisitionStatus = new RequisitionStatus(api_catalogo, "root");

    cataloge.render();

    // Productos.
    products = new Productos(api, "root");
    products.render();

    asistente = new AsistenteProductos(api, "root");

    // Se enciende o apaga en Administrador > CoffeeIA. El asistente da de alta,
    // edita y da de baja productos: sin ninguna de esas acciones no sale.
    if (coffeeIA && (can('agregar') || can('editar') || can('cancelar'))) asistente.renderLauncher();
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
                    id: "requisition-status",
                    tab: "Estados requisición",
                    lucideIcon: "clipboard-list",
                    class: paneClass,
                    onClick: () => requisitionStatus.lsRequisitionStatus()
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
        // scrollbar-gutter: el hueco de la barra va siempre; si no, la columna Insumo
        // cambiaba 16px entre una pagina con scroll y otra sin el.
        this.primaryLayout({
            parent: 'container-productos',
            id: this.PROJECT_NAME,
            class: 'w-full flex-1 min-h-0 flex flex-col',
            card: {
                class: 'flex flex-col col-12 flex-1 min-h-0',
                filterBar: { class: 'w-full mb-3 flex-shrink-0', id: 'filterBar' + this.PROJECT_NAME },
                container: { class: 'w-full flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]', id: 'container' + this.PROJECT_NAME }
            }
        });
    }

    // `this.filtroSucursal`: la sucursal elegida en el selector con sus categorías y áreas
    // (cambiarSucursal). Sin elegir, la de la sesión.
    filterBar() {
        const f = this.filtroSucursal || { sucursal: sucursalSesion, categorias: categorias, areas: areas };

        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                // El stock es el de la sucursal de la navbar. init manda la lista al
                // administrador (todas) y a quien tiene más de una sucursal (las suyas): al
                // elegir una salen sus productos con su stock, categorías y áreas. Solo el
                // administrador tiene "Todas", con todo y la suma.
                ...(sucursales.length ? [{
                    opc: "select",
                    id: "sucursal",
                    lbl: "Sucursal",
                    class: "col-12 col-md-2",
                    value: f.sucursal,
                    data: [...(administrador ? [{ id: '', valor: 'Todas las sucursales' }] : []), ...sucursales],
                    onchange: 'products.cambiarSucursal()'
                }] : []),
                // Mismo orden que las columnas de la tabla: primero qué es, luego dónde está.
                {
                    opc: "select",
                    id: "categoria",
                    lbl: "Categoría",
                    class: "col-12 col-md-2",
                    data: [{ id: '', valor: 'Todas' }, ...f.categorias],
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
                        ...f.areas,
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
                ...(can('agregar') ? [{
                    opc: "button",
                    id: "btnNuevoMaterial",
                    text: "Nuevo Producto",
                    className:'w-100',
                    class: "col-12 col-md-2",
                    color_btn: "primary",
                    onClick: () => this.addMaterial()
                }] : []),
                // El mismo chat del ícono de la navbar; sale con las mismas condiciones.
                ...(coffeeIA && (can('agregar') || can('editar') || can('cancelar')) ? [{
                    opc: "button",
                    id: "btnCoffeeIA",
                    text: "CoffeeIA",
                    // Sus colores los pone mountCoffeeIAIcon (los del botón CoffeeIA de Salidas).
                    className: 'w-100 inline-flex items-center justify-center gap-2',
                    class: "col-12 col-md-2",
                    color_btn: "outline",
                    onClick: () => asistente.render()
                }] : [])
            ]
        });

        this.mountAreaFilter();
        this.mountCoffeeIAIcon();
    }

    // La sucursal del selector de la barra ('' sin selector o con "Todas").
    sucursalElegida() {
        return String($(`#filterBar${this.PROJECT_NAME} #sucursal`).val() ?? '');
    }

    // Cambio de sucursal en el selector: los filtros de Categoría y Área se rehacen con
    // las de esa sucursal (o las de todas) y la tabla se vuelve a consultar. El estado se queda.
    async cambiarSucursal() {
        const $bar     = $(`#filterBar${this.PROJECT_NAME}`);
        const sucursal = String($bar.find('#sucursal').val() ?? '');
        const estado   = $bar.find('#estado').val();
        const r        = await useFetch({ url: this._link, data: { opc: 'lsCatalogoSucursal', sucursal: sucursal } }).catch(() => null);

        this.filtroSucursal = {
            sucursal:   sucursal,
            categorias: (r && r.categorias) || [],
            areas:      (r && r.areas) || []
        };
        this.filterBar();
        $bar.find('#estado').val(estado);
        this.lsMateriales();
    }

    // Formulario del producto: el área elegida va en una píldora chica (la de la lista se
    // queda a 13 px, cfBadgeOption) y las listas de Categoría y Unidad no pasan de 240 px.
    // El "_" de Tailwind es espacio: & .select2-selection .cs-badge-soft.
    compactarSelectsProducto(formId) {
        $(`#${formId}`).addClass([
            '[&_.select2-selection_.cs-badge-soft]:!text-[11px]',
            '[&_.select2-selection_.cs-badge-soft]:!py-0',
            '[&_.select2-selection_.cs-badge-soft]:!px-2',
            '[&_.select2-selection_.cs-badge-soft]:!leading-5'
        ].join(' '));

        $(`#${formId}`).find('#unit_id, #category_id').on('select2:open', () => {
            $('.select2-container--open .select2-results__options').css('max-height', '240px');
        });
    }

    // Formulario del producto: al cambiar la Sucursal (solo el administrador la ve), los
    // selects de Categoría y Área se rehacen con las de esa sucursal; lo elegido se queda si
    // existe allá. El reset del alta en serie regresa a la sucursal de la sesión.
    mountSucursalProducto(formId) {
        const $form = $(`#${formId}`);
        const $suc  = $form.find('#branch_id');
        if (!$suc.length) return;

        const llenar = ($sel, lista, primera = null) => {
            const actual = String($sel.val() ?? '');
            $sel.empty();
            if (primera) $sel.append($('<option>', { value: primera.id, text: primera.valor }));
            lista.forEach(it => $sel.append($('<option>', {
                value: it.id,
                text: it.valor,
                'data-color': it.color,
                'data-bg': it.bg,
                'data-description': it.description
            })));
            const sigue = lista.some(it => String(it.id) === actual);
            $sel.val(sigue ? actual : (primera ? primera.id : (lista[0] ? String(lista[0].id) : ''))).trigger('change');
        };

        $suc.on('change', async () => {
            const r = await useFetch({ url: this._link, data: { opc: 'lsCatalogoSucursal', sucursal: $suc.val() || '' } }).catch(() => null);
            if (!r || r.status !== 200) return;
            llenar($form.find('#category_id'), r.categorias || []);
            llenar($form.find('#warehouse_area_id'), r.areas || [], { id: '', valor: 'Sin área' });
        });

        $form.on('reset', () => setTimeout(() => $suc.val(String(sucursalSesion || '')).trigger('change'), 0));
    }

    // Con el aspecto del botón CoffeeIA de la captura de Salidas (btnIA de salida-form.js):
    // borde violeta con su sombra, texto en negritas y el "IA" en violeta, sobre el gris de
    // los botones claros (btnLight: gray-100, gray-200 al pasar el mouse). El ícono es la
    // cara de coffeeIA (iaIconPlain) en ese violeta. Se le quitan los colores de
    // btnOutline (el .bg-white de Bootstrap trae !important).
    mountCoffeeIAIcon() {
        $(`#filterBar${this.PROJECT_NAME} #btnCoffeeIA`)
            .removeClass('bg-white border-blue-600 text-blue-600 font-semibold hover:bg-blue-600 hover:text-white active:bg-blue-600 focus:ring-blue-600')
            .addClass('bg-gray-100 !border-violet-300 text-gray-800 font-bold shadow-sm shadow-violet-500/25 hover:bg-gray-200 hover:!border-violet-500 focus:ring-violet-500 transition-all')
            .empty()
            .attr({ title: 'CoffeeIA', 'aria-label': 'CoffeeIA' })
            .append(
                $(this.iaIconPlain()).addClass('block w-5 h-5 text-violet-600'),
                $('<span>', { class: 'whitespace-nowrap' }).append(
                    document.createTextNode('Coffee'),
                    $('<span>', { class: 'text-violet-600', text: 'IA' })
                )
            );
    }

    // La lista del filtro va más holgada que el select2 de siempre: alcanzan todas las
    // áreas sin barra y cada fila se puede tocar con el dedo.
    mountAreaFilter() {
        select2Checklist({
            id: "area",
            placeholder: "áreas",
            all: "Todas las áreas",
            none: "Ninguna área",
            // ul / li = la lista y sus filas (en Tailwind el "_" de las clases de select2 es espacio).
            dropdownClass: "min-w-[300px] [&_ul]:!max-h-[360px] [&_li]:!py-2",
            format: (opt) => this.cfBadgeOption(opt),
            onChange: () => this.lsMateriales()
        });
    }

    // El badge de área del core (selects con badge:true y el filtro de arriba) mide
    // 9.8 px: compact.css achica el text-xs y junto a los campos de 14 px se perdía.
    // En Productos va a 13 px, con más aire; "Sin área" sube igual.
    cfBadgeOption(opt) {
        const $badge = super.cfBadgeOption(opt).removeClass('text-xs').addClass('text-[13px]');

        return $badge.hasClass('cs-badge-soft') ? $badge.removeClass('py-0.5').addClass('py-1') : $badge;
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
                class: 'w-100 lowercase table-fixed min-w-[1080px]',
                striped:true,
                center: [2,4,6,7,8,10],
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
    // el select del formulario "Nueva área" lee `almacenes`.
    async reloadAlmacenes() {
        const data = await useFetch({ url: this._link, data: { opc: "init" } });
        almacenes = data.almacenes || [];
    }

    // Recarga los productos del select «producto base» de una presentación: el que se
    // acaba de dar de alta ya se puede elegir en la siguiente captura.
    async reloadProductos() {
        const data = await useFetch({ url: this._link, data: { opc: "init" } });
        productos = data.productos || [];
    }

    // Orden de captura: identificación (nombre, categoría, unidad, código, foto), costo
    // (costo con impuesto, IVA de compra y último costo), inventario (inventariable,
    // área, mínimo, máximo, vida útil y su periodo) y notas. El precio de venta no se captura aquí.
    // Rejilla de 3 en 3 (col-md-4, mismo ancho en todos); la descripción a lo ancho.
    // Los encabezados son `opc: "label"`; su estilo va en la clase porque coffeeForm la
    // pasa al contenedor (cfToTailwindGrid borra mt-N / p-N, por eso se usa pt-/pb-).
    // Arriba va el selector Producto | Presentación y al final los campos de la
    // presentación (mountPresentacion): en ese modo los del producto se esconden.
    // `cats` / `ars`: las categorías y áreas de los selects (por omisión, las de la sucursal
    // de la sesión; al editar, las de la sucursal del producto).
    jsonMaterial(cats = categorias, ars = areas) {
        const section = "col-12 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500";

        return [
            // -- Producto o presentación --
            {
                opc: "div",
                id: "modeField",
                class: "col-12 pb-1",
                required: false
            },

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
                data: cats || categorias,
                required: true
            },
            // select2: con muchas unidades la lista nativa llenaba la pantalla; así trae
            // buscador y una lista de alto fijo, como Categoría.
            {
                opc: "select",
                id: "unit_id",
                lbl: "Unidad de medida",
                class: "col-12 col-md-4",
                select2: true,
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
            // Solo el administrador: de qué sucursal es el producto. Cambiarla lo mueve de
            // sucursal; vacío al dar de alta = la de la sesión.
            ...(administrador && sucursales.length ? [{
                opc: "select",
                id: "branch_id",
                lbl: "Sucursal",
                class: "col-12 col-md-4",
                data: sucursales,
                value: String(sucursalSesion || ''),
                required: false
            }] : []),
            // Lo llena mountProductPhoto: vista previa, subir/cambiar y quitar.
            {
                opc: "div",
                id: "photoField",
                lbl: "Foto",
                class: administrador && sucursales.length ? "col-12 col-md-4" : "col-12 col-md-8",
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
                    ...(ars || areas)
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
                id: "shelf_life_qty",
                lbl: "Vida útil",
                tipo: "numero",
                required: false,
                class: "col-12 col-md-4",
                onkeyup: "products.calcShelfLife()",
                onchange: "products.calcShelfLife()"
            },
            {
                opc: "select",
                id: "shelf_life_unit",
                lbl: "Periodo",
                class: "col-12 col-md-4",
                required: false,
                onchange: "products.calcShelfLife()",
                data: PERIODOS_VIDA
            },
            {
                opc: "input",
                type: "hidden",
                id: "shelf_life_days",
                required: false,
                class: "hidden"
            },
            // 1 = el formulario ya enseñó los productos de nombre parecido (paintNameCheck).
            {
                opc: "input",
                type: "hidden",
                id: "similar_ok",
                required: false,
                class: "hidden"
            },

            // -- Descripción --
            {
                opc: "textarea",
                id: "description",
                lbl: "Descripción",
                class: "col-12 pt-1",
                placeholder: "Notas y otros nombres con que se conoce el producto (opcional)",
                required: false,
                rows: 2
            },

            // -- Presentación --
            // Lo llena mountPresentacion: producto base, factor y los datos propios.
            {
                opc: "div",
                id: "presentationField",
                class: "col-12",
                required: false
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

    // El ctrl solo lee shelf_life_days (oculto); número y periodo son de captura.
    calcShelfLife() {
        const qty = parseFloat($('#shelf_life_qty').val());
        $('#shelf_life_days').val(isNaN(qty) ? '' : Math.round(qty * Number($('#shelf_life_unit').val())));
    }

    // Al editar, los días guardados se muestran en meses o semanas si cuadran exacto.
    shelfLifeParts(days) {
        const n    = parseInt(days, 10);
        const unit = n > 0 ? ([30, 7].find(d => n % d === 0) || 1) : 1;
        return { qty: isNaN(n) ? '' : String(n / unit), unit: String(unit) };
    }

    // Las notas del último costo y de la descripción (otros nombres del producto) van
    // debajo de su campo, en chico. Si el formulario no cabe entero se deja el scroll
    // propio del cuerpo de cfModal (72vh), así los botones Aceptar/Cancelar siempre se ven.
    mountMaterialHints(formId) {
        mountFieldHints(formId, {
            cost_unit: "Se actualiza con cada entrada.",
            description: "Agrega cómo también se le conoce al producto. Ej.: Jitomate → tomate, tomate rojo. Colorante Azul No. 1 / E-133 → colorante azul, color azul, azul, gel azul brillante, gel Azul Brillante Enco 1131-250."
        });
    }

    // Mientras se escribe el nombre se avisa si ya existe (no se podrá guardar) o si hay
    // otros parecidos. Al editar no se consulta si el nombre sigue siendo el de antes.
    mountNameCheck(formId, id = 0, original = '') {
        const $form = $(`#${formId}`);
        const $name = $form.find('#name');
        const key   = (text) => plainText(text).replace(/[^a-z0-9]+/g, ' ').trim();
        let timer   = null;
        let turn    = 0;
        let hover   = false;

        // El input y su mensaje de error van juntos: la validación del core lo busca
        // en el mismo padre. El ícono y el tooltip flotan: el formulario no se mueve.
        $name.add($name.nextAll('.tw-error')).wrapAll($('<div>', { class: 'relative' }));

        const $flag = $('<span>', {
            'data-name-flag': '',
            class: 'hidden absolute right-2.5 top-1/2 -translate-y-1/2 cursor-help'
        }).append($('<i>', { 'data-lucide': 'alert-circle', class: 'w-4 h-4' }));

        const $tip = $('<div>', {
            'data-name-check': '',
            role: 'tooltip',
            class: 'hidden pointer-events-none absolute left-0 top-full mt-1.5 z-30 w-max max-w-[320px] rounded-lg bg-gray-800 px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-lg'
        });

        // El tooltip se ve mientras se escribe el nombre o con el mouse sobre el ícono.
        const toggleTip = () => $tip.toggleClass('hidden', $flag.hasClass('hidden') || !(hover || $name.is(':focus')));

        $name.after($flag, $tip).on('focus blur', toggleTip);
        $flag.on('mouseenter mouseleave', (e) => {
            hover = e.type === 'mouseenter';
            toggleTip();
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();

        $name.on('input', () => {
            const name = $name.val().trim();
            const mine = ++turn;

            clearTimeout(timer);

            if (name.length < 3 || key(name) === key(original)) {
                this.paintNameCheck(formId, null);
                return;
            }

            $form.find('#similar_ok').val('');

            timer = setTimeout(async () => {
                const response = await useFetch({
                    url: this._link,
                    // Se compara solo con su sucursal: la del campo Sucursal (administrador)
                    // o la del selector; el ctrl usa la del producto al editar.
                    data: { opc: 'lsSimilarMaterials', name: name, id: id, branch_id: $form.find('#branch_id').val() || '', sucursal: this.sucursalElegida() }
                });

                if (mine === turn && $name.val().trim() === name) this.paintNameCheck(formId, response);
            }, 350);
        });
    }

    // Nombre igual en rojo; parecidos en ámbar (borde del campo e ícono). El texto va
    // en el tooltip. Enseñar los parecidos de ESTE nombre pone similar_ok = 1: el
    // servidor ya no vuelve a frenar el guardado por ellos.
    paintNameCheck(formId, matches) {
        const $form   = $(`#${formId}`);
        const $name   = $form.find('#name');
        const $flag   = $form.find('[data-name-flag]');
        const $tip    = $form.find('[data-name-check]');
        const exact   = matches && matches.exact;
        const similar = (matches && matches.similar) || [];
        const label   = (item) => `«${item.name}»${item.active ? '' : ' (inactivo)'}`;
        const more    = matches && matches.more ? ` y ${matches.more} más` : '';

        $form.find('#similar_ok').val(!exact && similar.length ? '1' : '');
        $name.removeClass('pr-8 !border-red-400 !border-amber-400');
        $flag.removeClass('text-red-500 text-amber-500').addClass('hidden');
        $tip.addClass('hidden').text('');

        if (!exact && !similar.length) return;

        $name.addClass(exact ? 'pr-8 !border-red-400' : 'pr-8 !border-amber-400');
        $flag.removeClass('hidden').addClass(exact ? 'text-red-500' : 'text-amber-500');
        $tip.text(exact
            ? `Ya existe un producto con este nombre en esta sucursal: ${label(exact)}.`
            : `Ya existe en esta sucursal con un nombre similar: ${similar.map(label).join(', ')}${more}. Si es otro producto, puedes guardarlo.`
        ).toggleClass('hidden', !$name.is(':focus'));
    }

    // Error al guardar. Si fue por el nombre (repetido o parecido) el aviso se queda en
    // el campo y la alerta no se cierra sola, para alcanzar a leer qué productos son.
    alertNameCheck(formId, response) {
        if (response.matches) this.paintNameCheck(formId, response.matches);

        this.alertBox({
            type: response.matches ? "warning" : "error",
            theme: "light",
            title: response.message,
            timer: response.matches ? 0 : 2500
        });
    }

    // El alta del Catálogo se abre encima: el producto no se cierra ni pierde lo capturado.
    // Dar de alta un área o una unidad es agregar al Catálogo: sin esa acción no salen.
    mountCatalogShortcuts(formId) {
        if (!can('agregar')) return;

        const $form = $(`#${formId}`);

        const shortcut = (field, onClick) => {
            const $label = $form.find(`label[for="${field}"]`);
            const $btn   = $('<button>', {
                type:  'button',
                class: 'inline-flex items-center gap-0.5 h-4 !p-0 !leading-none text-[11px] font-semibold text-blue-600 hover:text-blue-700'
            }).append(
                $('<i>', { 'data-lucide': 'plus', class: 'w-3 h-3' }),
                $('<span>', { text: 'Nueva' })
            );

            // El label conserva su margen (compact.css lo fuerza): así el select no baja.
            $label.wrap($('<div>', { class: 'flex items-start justify-between gap-2' }));
            $label.after($btn.on('click', onClick));
        };

        shortcut('warehouse_area_id', () => area.addArea((id) => this.pickCreated(formId, 'warehouse_area_id', areas, id)));
        shortcut('unit_id', () => unit.addUnit((id) => this.pickCreated(formId, 'unit_id', unidades, id)));

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // El select se armó con el catálogo de antes: la opción nueva se agrega a mano.
    pickCreated(formId, field, list, id) {
        const item = list.find(it => String(it.id) === String(id));
        if (!item) return;

        $(`#${formId} #${field}`)
            .append($('<option>', {
                value: item.id,
                text: item.valor,
                'data-color': item.color,
                'data-bg': item.bg,
                'data-description': item.description
            }))
            .val(String(item.id))
            .trigger('change');
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

        // Los ocultos no vuelven solos a vacío con el reset del form (resetMaterialForm).
        $field.closest('form').on('reset', () => {
            $b64.val('');
            $remove.val('0');
            paint('');
        });

        // flex-wrap: con el campo Sucursal (administrador) la foto ocupa un tercio y "Quitar" baja.
        $field.addClass('flex flex-wrap items-center gap-x-3 gap-y-1').append($thumb, $pick, $drop, $file, $b64, $remove);
        paint(inventoryFileUrl(image));
    }

    // Producto o presentación: el selector de arriba y los campos de la presentación
    // (producto base, cuántas trae, nombre, unidad del empaque, SKU, costo, área y foto).
    // Área, foto y descripción son suyas (decisión B): son las mismas celdas del producto, que
    // en ese modo se mudan a la sección de la presentación. Lo demás lo hereda del base, así que
    // los otros campos del producto se esconden y dejan de ser obligatorios. Al cambiar
    // de modo lo capturado pasa al otro lado.
    // opts.producto (Editar): el producto que ya existe; en Presentación deja de serlo y
    //   su stock pasa al base × factor (pasarAPresentacion en el ctrl).
    // opts.fijo (editar una presentación): el base no cambia y el selector no sale de Presentación.
    // opts.modal: el cfModal, para el texto de su botón Aceptar.
    mountPresentacion(formId, opts = {}) {
        const $form   = $(`#${formId}`);
        const prod    = opts.producto || null;
        const fijo    = opts.fijo || null;
        const celda   = ($el) => $el.parentsUntil($form).last();
        const $modo   = $form.find('#modeField');
        const $campos = $form.find('#presentationField');
        const $cArea  = celda($form.find('#warehouse_area_id'));
        const $cFoto  = celda($form.find('#photoField'));
        const $cDesc  = celda($form.find('#description'));
        const $suyos  = $form.children().not(celda($modo)).not(celda($campos)).not($cArea).not($cFoto).not($cDesc).not('.hidden');
        const $reqs   = $suyos.find('[required]');
        const $okBtn  = opts.modal ? opts.modal.footer.find('button').last() : $();
        const okText  = $okBtn.text();
        const $flag   = $('<input>', { type: 'hidden', name: 'is_presentacion', value: '0' });
        let modo      = fijo ? 'presentacion' : 'producto';

        const label   = (id, text, req) => $('<label>', { class: CF_CSS.label, for: id, html: text + (req ? '<span class="text-red-400 ml-0.5">*</span>' : '') });
        const sec     = (text) => $('<div>', { class: 'col-span-3 pt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500', text: text });
        const $base   = $('<select>', { id: `${formId}_base`, name: 'base_item_id', class: CF_CSS.select });
        const $factor = $('<input>', { id: `${formId}_factor`, type: 'text', inputmode: 'decimal', name: 'factor', placeholder: '12', class: `${CF_CSS.input} text-center` });
        const $nombre = $('<input>', { id: `${formId}_pname`, name: 'pres_name', placeholder: 'Ej. Reja 12', class: CF_CSS.input });
        const $unidad = $('<select>', { id: `${formId}_punit`, name: 'pres_unit_id', class: `${CF_CSS.select} pr-8` }).append(
            $('<option>', { value: '', text: 'Elige la unidad' }),
            unidades.map(u => $('<option>', { value: u.id, text: u.valor }))
        );
        // La flecha de los select de coffeeForm (los que no son select2).
        const $flecha = $('<div>', { class: 'pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5' })
            .append($('<i>', { 'data-lucide': 'chevron-down', class: 'w-4 h-4 text-gray-400' }));
        const $sku    = $('<input>', { id: `${formId}_psku`, name: 'pres_sku', class: CF_CSS.input });
        const $costo  = $('<input>', { id: `${formId}_pcost`, name: 'pres_cost_unit', class: `${CF_CSS.input} text-right` });
        const $hSku   = $('<div>', { class: 'mt-1 text-[11px] text-gray-500' });
        const $hCosto = $('<div>', { class: 'mt-1 text-[11px] text-gray-500' });
        const $uniTxt = $('<span>');
        const $pasado = $('<span>', { class: 'hidden normal-case tracking-normal font-medium text-blue-600', text: ' · datos pasados del producto' });
        const $hereda = $('<div>', { class: 'flex flex-wrap gap-1.5' });
        const $stock  = $('<div>', { class: 'hidden rounded-lg px-3 py-2.5 flex flex-col gap-1.5' });
        const $vista  = $('<div>', { class: 'flex flex-wrap items-center gap-2 text-xs text-gray-500' });
        // Dónde caen las celdas de área, foto y descripción en cada modo (las marcas, su lugar
        // en el producto).
        const $lArea  = $('<div>', { class: 'col-span-3 sm:col-span-1' });
        const $lFoto  = $('<div>', { class: 'col-span-3' });
        const $lDesc  = $('<div>', { class: 'col-span-3' });
        const $mArea  = $('<span>', { class: 'hidden' }).insertBefore($cArea);
        const $mFoto  = $('<span>', { class: 'hidden' }).insertBefore($cFoto);
        const $mDesc  = $('<span>', { class: 'hidden' }).insertBefore($cDesc);

        const baseInfo = () => {
            const id = fijo ? fijo.item_id : $base.val();
            const p  = productos.find(x => String(x.id) === String(id));

            if (p) return { nombre: p.valor, unidad: p.unidad, costo: Number(p.cost_unit || 0), sku: p.sku || '', categoria: p.categoria, area: p.area, stock: Number(p.stock || 0) };

            return fijo ? { nombre: fijo.nombre, unidad: fijo.unidad, costo: Number(fijo.costo || 0), sku: fijo.sku || '', stock: 0 } : null;
        };

        const opcion = (valor, icono, titulo, texto) => $('<button>', { type: 'button', 'data-modo': valor }).append(
            $('<span>', { 'data-ico': '', class: 'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0' }).append($('<i>', { 'data-lucide': icono, class: 'w-5 h-5' })),
            $('<span>', { class: 'min-w-0 text-left' }).append(
                $('<span>', { class: 'block text-[13px] font-semibold text-gray-800', text: titulo }),
                $('<span>', { class: 'block text-[11px] leading-snug text-gray-500', text: texto })
            )
        );

        const $opciones = $('<div>', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-2' }).append(
            opcion('producto', 'box', 'Producto', 'Una cosa que se cuenta en stock: una lata, un kilo'),
            opcion('presentacion', 'boxes', 'Presentación', 'Un empaque con varias de un producto: reja, caja, six pack')
        );

        $modo.append(
            $('<span>', { class: CF_CSS.label, text: prod || fijo ? '¿Qué es?' : '¿Qué das de alta?' }),
            $opciones,
            $flag
        );

        // El producto que pasa a presentación: lo que tiene hoy.
        const $viejo = prod ? $('<div>', { class: 'col-span-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 flex items-center gap-3' }).append(
            $('<div>', { class: 'flex-1 min-w-0' }).append(
                $('<div>', { class: 'text-sm font-semibold text-gray-800 truncate', text: prod.nombre }),
                $('<div>', { class: 'text-[11px] text-gray-500', text: `${fmtCantidad(prod.stock)} en stock · ${prod.movimientos} ${prod.movimientos === 1 ? 'movimiento' : 'movimientos'}` })
            ),
            $('<span>', { class: 'inline-flex items-center gap-1 rounded-full bg-gray-200 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600' }).append(
                $('<i>', { 'data-lucide': 'box', class: 'w-3 h-3' }),
                $('<span>', { text: 'Hoy es producto' })
            )
        ) : null;

        $campos.append(
            $('<div>', { class: 'grid grid-cols-3 gap-x-4 gap-y-3' }).append(
                $viejo,
                sec('Equivale a'),
                $('<div>', { class: 'col-span-3 sm:col-span-2' }).append(label($base.attr('id'), 'Producto base', true), $base),
                $('<div>', { class: 'col-span-3 sm:col-span-1' }).append(
                    $('<label>', { class: CF_CSS.label, for: $factor.attr('id') }).append('¿Cuántas ', $uniTxt, ' trae?', $('<span>', { class: 'text-red-400 ml-0.5', text: '*' })),
                    $factor
                ),
                sec('La presentación').append($pasado),
                $('<div>', { class: 'col-span-3 sm:col-span-2' }).append(label($nombre.attr('id'), 'Nombre', true), $nombre),
                $('<div>', { class: 'col-span-3 sm:col-span-1' }).append(label($unidad.attr('id'), 'Unidad del empaque', true), $('<div>', { class: 'relative' }).append($unidad, $flecha)),
                $('<div>', { class: 'col-span-3 sm:col-span-1' }).append(label($sku.attr('id'), 'Código (SKU)'), $sku, $hSku),
                $('<div>', { class: 'col-span-3 sm:col-span-1' }).append(label($costo.attr('id'), 'Costo'), $costo, $hCosto),
                $lArea,
                $lFoto,
                $lDesc,
                $('<div>', { class: 'col-span-3 rounded-lg border border-gray-200 px-3 py-2.5 flex flex-col gap-1.5' }).append(
                    $('<div>', { class: 'flex items-center gap-1.5 text-xs font-semibold text-gray-600' }).append(
                        $('<i>', { 'data-lucide': 'corner-down-right', class: 'w-3.5 h-3.5' }),
                        $('<span>', { text: 'Hereda del producto base (no se captura aquí)' })
                    ),
                    $hereda
                ),
                $stock.addClass('col-span-3'),
                $vista.addClass('col-span-3')
            )
        );

        // Las opciones se arman cada vez que se entra al modo: en la captura en serie
        // traen el producto recién dado de alta. El que se edita no puede ser su base.
        const fillBase = () => {
            const actual = $base.val();

            $base.empty().append($('<option>', { value: '', text: '' }));
            productos
                .filter(p => !prod || String(p.id) !== String(prod.id))
                .forEach(p => $base.append($('<option>', { value: p.id, text: `${p.valor} · $${Number(p.cost_unit || 0).toFixed(2)} por ${String(p.unidad || 'unidad').toLowerCase()}` })));
            $base.val(actual).trigger('change.select2');
        };

        // Al cambiar de modo, nombre, SKU, unidad y costo pasan al otro lado.
        const PARES = [['name', 'pres_name'], ['sku', 'pres_sku'], ['unit_id', 'pres_unit_id'], ['cost_unit', 'pres_cost_unit']];

        const pasar = (aPresentacion) => {
            let alguno = false;

            // Sin nombre no hay nada capturado: la unidad del alta trae un valor por defecto.
            const origen = aPresentacion ? 'name' : 'pres_name';
            if (!String($form.find(`[name="${origen}"]`).val() || '').trim()) {
                $pasado.addClass('hidden');
                return;
            }

            PARES.forEach(([suyo, presentacion]) => {
                const $de = $form.find(`[name="${aPresentacion ? suyo : presentacion}"]`);
                const $a  = $form.find(`[name="${aPresentacion ? presentacion : suyo}"]`);

                if (!$de.val()) return;
                $a.val($de.val());
                alguno = true;

                if (aPresentacion) {
                    $a.addClass('!bg-blue-50');
                    setTimeout(() => $a.removeClass('!bg-blue-50'), 1200);
                }
            });

            if (!aPresentacion) this.calcCostWithTax();
            $pasado.toggleClass('hidden', !(aPresentacion && alguno));
        };

        const paint = () => {
            const presen = modo === 'presentacion';
            const base   = baseInfo();
            const factor = parseFloat($factor.val()) || 0;
            const uni    = pluralUnidad(base ? base.unidad : '');
            const nombre = $nombre.val().trim().toLowerCase() || 'presentación';

            $flag.val(presen ? '1' : '0');
            $suyos.toggleClass('hidden', presen);
            $reqs.prop('required', !presen);
            celda($campos).toggleClass('hidden', !presen);

            // Área, foto y descripción se mudan con el modo: lo capturado viaja con ellas.
            if ($cArea.parent()[0] !== (presen ? $lArea : $form)[0]) {
                if (presen) {
                    $lArea.append($cArea);
                    $lFoto.append($cFoto);
                    $lDesc.append($cDesc);
                } else {
                    $mArea.after($cArea);
                    $mFoto.after($cFoto);
                    $mDesc.after($cDesc);
                }
            }
            $okBtn.text(presen && prod ? 'Guardar como presentación' : okText);

            $opciones.children().each((_, btn) => {
                const on = $(btn).data('modo') === modo;
                const no = fijo && !on;

                $(btn)
                    .attr('aria-pressed', on)
                    .prop('disabled', no)
                    .attr('class', `flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors ${on ? 'border-[1.5px] border-blue-600 bg-blue-50' : 'border border-gray-200 bg-white hover:bg-gray-50'} ${no ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`)
                    .find('[data-ico]').attr('class', `w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${on ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`);
            });

            $uniTxt.text(uni);
            $sku.attr('placeholder', base && base.sku && factor ? `${base.sku}-${factor}` : 'Auto');
            $hSku.text('Vacío: el SKU del base + factor');
            $costo.attr('placeholder', base && factor ? (factor * base.costo).toFixed(2) : '0.00');
            $hCosto.text(base && factor ? `Vacío: ${factor} × $${base.costo.toFixed(2)}` : 'Vacío: factor × costo del base');

            $hereda.empty().append(
                (base ? [base.categoria && `Categoría: ${base.categoria}`, 'Mínimo y máximo', 'Vida útil'].filter(Boolean) : ['Elige el producto base'])
                    .map(t => $('<span>', { class: 'rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600', text: t }))
            );

            $vista.empty().append(
                $('<span>', { text: `En Productos sale debajo de ${base ? base.nombre : '…'} como` }),
                $('<span>', { class: 'rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700', text: `1 ${nombre} = ${factor || '?'} ${uni}` })
            );

            // Editar > Presentación: lo que pasa con su stock (decisión A: se suma al base).
            $stock.toggleClass('hidden', !(presen && prod)).empty();

            if (presen && prod) {
                const suma = prod.stock * factor;

                if (!prod.stock) {
                    $stock.attr('class', 'col-span-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 flex flex-col gap-1').append(
                        $('<div>', { class: 'text-xs font-semibold text-gray-700', text: 'No tiene stock: no se mueve inventario' }),
                        $('<div>', { class: 'text-[11px] text-gray-500', text: 'Al guardar se desactiva y su historial se queda con él.' })
                    );
                } else {
                    $stock.attr('class', 'col-span-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 flex flex-col gap-1.5').append(
                        $('<div>', { class: 'text-xs font-semibold text-blue-800', text: 'Su stock pasa al producto base' }),
                        $('<div>', { class: 'flex flex-wrap items-center gap-2 text-sm text-gray-700' }).append(
                            $('<span>', { class: 'rounded-md bg-white px-2 py-0.5 font-semibold', text: `${fmtCantidad(prod.stock)} en stock` }),
                            $('<span>', { class: 'text-gray-400', text: '×' }),
                            $('<span>', { class: 'rounded-md bg-white px-2 py-0.5 font-semibold', text: factor || '?' }),
                            $('<span>', { class: 'text-gray-400', text: '=' }),
                            $('<span>', { class: 'rounded-md bg-white px-2 py-0.5 font-semibold text-blue-700', text: factor ? `+${fmtCantidad(suma)} ${uni}` : '?' }),
                            $('<span>', { text: base && factor ? `→ ${base.nombre}: ${fmtCantidad(base.stock)} a ${fmtCantidad(base.stock + suma)}` : '→ elige el base y el factor' })
                        ),
                        $('<div>', { class: 'text-[11px] text-blue-800', text: 'Queda un ajuste AJU- registrado. El producto se desactiva y su historial se queda con él. Revisa el factor: el ajuste sale de él.' })
                    );
                }
            }

            if (window.lucide) lucide.createIcons();
        };

        const setModo = (nuevo) => {
            if (fijo || nuevo === modo) return;

            if (nuevo === 'presentacion') fillBase();
            pasar(nuevo === 'presentacion');
            modo = nuevo;
            paint();
        };

        // Editar una presentación: llega con sus datos y su base.
        if (fijo) {
            $base.append($('<option>', { value: fijo.item_id, text: fijo.nombre })).val(String(fijo.item_id)).prop('disabled', true);
            $factor.val(Number(fijo.factor));
            $nombre.val(fijo.name);
            $unidad.val(String(fijo.unit_id || ''));
            $sku.val(fijo.sku_propio || '');
            $costo.val(fijo.cost_unit);
            $form.find('#warehouse_area_id').val(String(fijo.area_id || '')).trigger('change');
            $form.find('#description').val(fijo.description || '');
        }

        // Igual que los select2 de coffeeForm: el dropdown se ancla al modal.
        $base.select2({
            theme: 'bootstrap-5',
            width: '100%',
            placeholder: 'Elige el producto base',
            dropdownParent: $base.closest('.cf-modal, .modal, .bootbox')
        });

        $opciones.on('click', '[data-modo]', (e) => setModo($(e.currentTarget).data('modo')));
        $base.on('change', paint);
        $factor.add($nombre).on('input', paint);

        // Captura en serie: el reset limpia los campos y el modo se queda.
        $form.on('reset', () => setTimeout(() => {
            $pasado.addClass('hidden');
            paint();
        }));

        paint();
    }

    // Vuelve el alta a como abrió: campos, select2, foto, vida útil y aviso del nombre.
    // Lo que se dio de alta con "+ Nueva" se queda en los selects.
    resetMaterialForm(formId) {
        const $form = $(`#${formId}`);

        $form[0].reset();
        $form.find('select').trigger('change.select2');
        $form.find('#shelf_life_days, #similar_ok').val('');
        this.costAnchor = 'unit';
        this.paintNameCheck(formId, null);
        $form.find('#name').trigger('focus');
    }

    // Captura en serie: al guardar, el modal sigue abierto y se limpia para el siguiente.
    addMaterial() {
        this.costAnchor = 'unit';

        this.createModalForm({
            id: 'formMaterialAdd',
            // Quien tiene varias sucursales da de alta en la que ve en el selector.
            data: { opc: 'addMaterial', sucursal: this.sucursalElegida() },
            theme:'light',
            coffeesoft:true,
            closeOnError: false,
            closeOnSuccess: false,
            bootbox: {
                title: 'Nuevo Producto',
                size: 'large',
                closeButton: true,
                escapeClose: false
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
                    this.reloadProductos();
                    this.resetMaterialForm('formMaterialAdd');
                } else if (response.updated) {
                    // La presentación ya existía en ese producto: se actualizó, no se duplicó.
                    this.alertBox({
                        type: "warning",
                        theme: "light",
                        title: response.message,
                        timer: 0
                    });
                    this.lsMateriales();
                    this.resetMaterialForm('formMaterialAdd');
                } else {
                    this.alertNameCheck('formMaterialAdd', response);
                }
            }
        });

        this.mountMaterialHints('formMaterialAdd');
        this.mountNameCheck('formMaterialAdd');
        this.mountCatalogShortcuts('formMaterialAdd');
        this.mountProductPhoto('formMaterialAdd');
        this.mountPresentacion('formMaterialAdd');
        this.mountSucursalProducto('formMaterialAdd');
        this.compactarSelectsProducto('formMaterialAdd');
    }

    async editMaterial(id) {
        const request = await useFetch({
            url: this._link,
            data: { opc: "getMaterial", id: id }
        });

        if (request.status === 200) {
            // Sin área llega NULL; '' selecciona la opción "Sin área" del select.
            request.data.warehouse_area_id = request.data.warehouse_area_id || '';
            const vida = this.shelfLifeParts(request.data.shelf_life_days);
            request.data.shelf_life_qty  = vida.qty;
            request.data.shelf_life_unit = vida.unit;
            this.costAnchor = 'unit';

            const modal = this.createModalForm({
                id: 'formMaterialEdit',
                data: { opc: 'editMaterial', id: id },
                theme:'light',
                coffeesoft:true,
                closeOnError: false,
                bootbox: {
                    title: 'Editar Producto',
                    size: 'large',
                    closeButton: true,
                    escapeClose: false
                },
                autofill: request.data,
                // Las categorías y áreas de la sucursal del producto (getMaterial).
                json: this.jsonMaterialEdit(request.data.categorias, request.data.areas),
                success: (response) => {
                    if (response.status === 200) {
                        this.alertBox({
                            type: "success",
                            theme: "light",
                            title: response.message,
                            timer: 1500
                        });
                        this.lsMateriales();
                        this.reloadProductos();
                    } else {
                        this.alertNameCheck('formMaterialEdit', response);
                    }
                }
            });

            this.mountMaterialHints('formMaterialEdit');
            this.mountNameCheck('formMaterialEdit', id, request.data.name);
            this.mountCatalogShortcuts('formMaterialEdit');
            this.mountProductPhoto('formMaterialEdit', request.data.image);
            this.mountPresentacion('formMaterialEdit', {
                modal: modal,
                producto: {
                    id: id,
                    nombre: request.data.name,
                    stock: Number(request.data.stock || 0),
                    movimientos: Number(request.data.movimientos || 0)
                }
            });
            this.mountSucursalProducto('formMaterialEdit');
            this.compactarSelectsProducto('formMaterialEdit');
        }
    }

    jsonMaterialEdit(cats, ars) {
        // Mismos campos que el alta: las claves de getMaterialById coinciden con los id del form (autofill).
        return this.jsonMaterial(cats, ars);
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

    // -- Presentaciones --

    // Las presentaciones salen en la tabla como un producto más (lsMateriales, con la nota
    // de su equivalencia). Aquí solo se guardan sus datos para editarlas y darlas de baja.
    async lsPresentaciones() {
        const response = await useFetch({ url: this._link, data: { opc: 'lsPresentaciones' } });

        this.presentaciones = (response && response.row) || [];
        return this.presentaciones;
    }

    // El mismo formulario en modo Presentación, con sus datos y su producto base fijo.
    async editPresentacion(id) {
        const buscar = () => (this.presentaciones || []).find(x => String(x.id) === String(id));
        const p      = buscar() || (await this.lsPresentaciones(), buscar());

        if (!p) return;

        this.createModalForm({
            id: 'formPresentacionEdit',
            data: { opc: 'editPresentacion', id: id },
            theme: 'light',
            coffeesoft: true,
            closeOnError: false,
            bootbox: {
                title: 'Editar presentación',
                size: 'large',
                closeButton: true,
                escapeClose: false
            },
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
                        type: "warning",
                        theme: "light",
                        title: response.message,
                        timer: 2500
                    });
                }
            }
        });

        // Área, foto y descripción son de la presentación, no del base.
        this.mountCatalogShortcuts('formPresentacionEdit');
        this.mountProductPhoto('formPresentacionEdit', p.image);
        this.mountPresentacion('formPresentacionEdit', {
            fijo: {
                item_id: p.item_id,
                nombre: p.base_name,
                unidad: p.base_unit,
                costo: p.base_cost,
                sku: p.base_sku,
                factor: p.factor,
                name: p.name,
                unit_id: p.unit_id,
                sku_propio: p.sku,
                cost_unit: p.cost_unit,
                area_id: p.warehouse_area_id,
                description: p.description
            }
        });
    }

    // Como statusMaterial, sin la opción de eliminar: la base se sigue dando de baja desde su fila.
    statusPresentacion(id, estado) {
        const activar = estado != 1;

        this.alertBox({
            type:       activar ? "confirm" : "cancel",
            theme:      "light",
            title:      activar ? "¿Activar presentación?" : "¿Desactivar presentación?",
            detailHtml: activar ? "La presentación será activada." : "La presentación será desactivada. El producto base no cambia.",
            okLabel:    activar ? "Activar" : "Desactivar",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "statusPresentacion", active: activar ? 1 : 0, id: id }
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

// «Pieza» → «piezas», «Paquete» → «paquetes»; las abreviaturas («kg», «ml») y lo que ya
// termina en s se quedan igual.
const pluralUnidad = (unidad) => {
    const u = String(unidad || '').trim().toLowerCase();

    if (!u) return 'unidades';
    if (u.length <= 3 || u.endsWith('s')) return u;

    return /[aeiouáéíóú]$/.test(u) ? `${u}s` : `${u}es`;
};

// 5, 12.5, 1,250: sin ceros de relleno ni más de 4 decimales.
const fmtCantidad = (n) => Number(Number(n || 0).toFixed(4)).toLocaleString('es-MX');

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

// Ancho fijo por columna (la tabla va con table-fixed): al paginar, buscar o filtrar
// las columnas ya no se acomodan al texto de cada página. Insumo (el producto) lleva un
// porcentaje, no lo que sobra: así el sobrante se reparte igual y no se la come.
const PRODUCT_WIDTHS = {
    'insumo':       '26%',
    'unidad':       '7%',
    'categoría':    '12%',
    'área':         '12%',
    'último costo': '9%',
    'stock':        '6%',
    'mín':          '5%',
    'máx':          '5%',
    'vida útil':    '8%',
    'estado':       '7%',
    '':             '8%'
};

// La columna Estado solo sale con el filtro "Todos": los anchos van por encabezado,
// no por posición. El de las acciones (engrane) no tiene texto.
function productsColumnDefs(table) {
    return $(table).find('thead th').map((i, th) => {
        const width = PRODUCT_WIDTHS[$(th).text().trim().toLowerCase()];
        return width ? { targets: i, width: width } : null;
    }).get();
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
        autoWidth: false,
        columnDefs: productsColumnDefs(table),
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

    // Los datos de las presentaciones, para editarlas desde su fila.
    products.lsPresentaciones();
}

// Mismo gris que el striped del tema light de createCoffeeTable3 (color_row_alt).
function repaintZebra(table, alt = "bg-gray-100") {
    $(table).children("tbody").children("tr").each((i, tr) => {
        $(tr).children("td").toggleClass(alt, i % 2 === 0);
    });
}

// -- Foto del producto --

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
// etiqueta de cada opción, ej. el badge del área; `dropdownClass` va en la lista abierta.
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
        dropdownCssClass: opts.dropdownClass || "",
        placeholder: { id: "", text: opts.all },
        templateSelection: () => $("<span>", {
            class: checked.length === all.length ? "text-gray-800" : "font-semibold text-blue-600",
            text: summary()
        }),
        templateResult: (opt) => {
            if (!opt.element) return opt.text;
            if (opt.id === ALL || opt.id === NONE) return $("<span>", { class: "text-[13px] font-semibold text-blue-600", text: opt.text });

            return $("<span>", { class: "flex items-center gap-2.5" }).append(
                $("<input>", { type: "checkbox", tabindex: -1, "data-check": opt.id, class: "w-4 h-4 flex-shrink-0 pointer-events-none accent-blue-600" }).prop("checked", checked.includes(opt.id)),
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

    // CoffeeIA en la navbar (iaNavButton, ia-chat.js): abre y cierra el chat. El botón
    // del filtro de Productos (Productos.filterBar) abre el mismo.
    renderLauncher() {
        this.iaNavButton({
            id:      `launcher${this.PROJECT_NAME}`,
            onClick: () => this.render()
        });
    }

    render() {
        if (!this.chat) {
            this.chat = this.iaChat({
                id:          `chat${this.PROJECT_NAME}`,
                title:       "CoffeeIA",
                subtitle:    "Productos y todas las pestañas del catálogo",
                placeholder: "Pregúntame o adjunta un Excel o una foto…",
                accept:      ".xlsx,.xlsm,.xlsb,.xls,.ods,.csv,.tsv,.png,.jpg,.jpeg,.webp",
                welcome:     "Pregúntame lo que quieras de tu catálogo: reviso tus productos de verdad, te doy mi opinión y te propongo cambios. Nada se guarda sin tu confirmación.",
                suggestions: [
                    "¿Qué productos podrían ser presentaciones?",
                    "¿Cómo está mi catálogo?",
                    "¿Qué productos no tienen costo?"
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
                    },
                    purge: {
                        label:        "Vaciar",
                        tone:         "bg-red-600 text-white",
                        confirm:      "Se borra para siempre y no se puede deshacer.",
                        confirmLabel: "Sí, vaciar"
                    },
                    present: {
                        label:        "A presentación",
                        tone:         "bg-amber-100 text-amber-700",
                        confirm:      "Su stock pasa al producto base y quedan desactivados.",
                        confirmLabel: "Sí, pasar"
                    }
                },
                onAttach:  (file) => this.readArchivo(file),
                onSend:    (text, adjuntos, historial, progress) => this.askAsistente(text, adjuntos, historial, progress),
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

    // Una petición por vuelta: mientras el servidor devuelva `turno`, CoffeeIA sigue
    // trabajando (usó herramientas) y cada paso se enseña en la burbuja de espera.
    async askAsistente(text, adjuntos, historial, progress) {
        let data = {
            opc:       "askAsistente",
            mensaje:   text,
            adjuntos:  JSON.stringify(adjuntos),
            historial: JSON.stringify(historial)
        };

        for (let vuelta = 0; vuelta < 12; vuelta++) {
            const response = await useFetch({ url: this._link, data: data });

            if (!response || !response.turno) {
                return response || {
                    status:  500,
                    message: "El asistente no respondió. Inténtalo otra vez."
                };
            }

            (response.pasos || []).forEach((paso) => progress && progress(paso));
            data = { opc: "askAsistente", turno: response.turno };
        }

        return {
            status:  500,
            message: "CoffeeIA dio demasiadas vueltas sin contestar. Pregúntale de otra forma."
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

        // Orígenes y motivos no viven en los selects de Productos.
        if (toca("inflow"))    inflow.lsInflow();
        if (toca("shrinkage")) shrinkage.lsShrinkage();

        // Con categorías o áreas nuevas el filtro de Productos se vuelve a pintar.
        if (toca("category") || toca("area")) products.render();
        else if (toca("product"))            products.lsMateriales();

        // El select de producto base de las presentaciones lee la lista global.
        if (toca("product")) products.reloadProductos();
    }
}
