let apiCatalogos = 'ctrl/ctrl-facturador-catalogos.php';
let app, catalogos, catalogosView;

$(async () => {
    catalogosView = new CatalogosView(apiCatalogos, 'root');
    catalogos     = new Catalogos(apiCatalogos, 'root');
    app           = new App(apiCatalogos, 'root');
    await app.init();
});

// -- Clase principal --

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'catalogos';
    }

    async init() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiCatalogos, data:{ opc:'init' } })
        this.dataInit = {
            tipos:  SAMPLE_CATALOGOS_TIPOS,
            sino:   SAMPLE_CATALOGOS_SINO,
            emisor: SAMPLE_CATALOGOS_EMISOR
        };

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        catalogosView.renderHeader(SAMPLE_VIEW_HEADER_CATALOGOS);
        catalogosView.renderFooter(SAMPLE_VIEW_FOOTER_CATALOGOS);
        catalogosView.renderPanelHeads();
        catalogosView.renderEmisorForm(this.dataInit.emisor);
        catalogos.lsKpis();
        catalogos.lsProductos();
        catalogos.lsMeseros();
    }

    // -- Layout --

    layout() {
        const mainPanel = {
            type:  'div',
            id:    'mainPanel',
            class: 'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                {
                    id:    'viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    class: 'px-3 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto bg-white'
                },
                {
                    id:    'viewFooterRow',
                    class: 'flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 flex-shrink-0'
                }
            ]
        };

        // createLayout solo itera children en type 'div': para un aside caen en el
        // default y jQuery los toma como metodo. Las zonas del panel se arman aparte.
        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'w-full md:w-[420px] flex-shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col overflow-hidden'
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden bg-white rounded-lg border border-gray-200',
                container: [mainPanel, detailPanel]
            }
        });

        this.createLayout({
            parent: 'detailPanel',
            design: false,
            data: {
                id:        'detailInner',
                class:     'flex-1 min-h-0 flex flex-col overflow-hidden',
                container: [
                    {
                        type:  'div',
                        id:    'detailHead',
                        class: 'px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0'
                    },
                    {
                        type:  'div',
                        id:    'formEmisor',
                        class: 'flex-1 min-h-0 overflow-auto scroll-thin px-3 py-3'
                    }
                ]
            }
        });

        this.gridsLayout();
    }

    gridsLayout() {
        const panel = (key) => ({
            type:  'div',
            id:    `card${key}`,
            class: 'bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col',
            children: [
                {
                    id:    `head${key}`,
                    class: 'px-4 py-3 border-b border-gray-200 flex items-center justify-between'
                },
                {
                    id:    `table${key}`,
                    class: 'overflow-auto scroll-thin max-h-80'
                }
            ]
        });

        this.createLayout({
            parent: 'tableWrap',
            design: false,
            data: {
                id:        'gridsRow',
                class:     'w-full grid grid-cols-1 xl:grid-cols-2 gap-4',
                container: [panel('Productos'), panel('Meseros')]
            }
        });
    }

    // -- Filter bar --

    filterBar() {
        const filters = [
            {
                opc:         'input',
                id:          'qBuscar',
                lbl:         'Buscar:',
                class:       'col-12 col-md-4 col-lg-3',
                placeholder: 'Codigo o nombre...',
                required:    false,
                onkeyup:     'app.onChangeFilters()'
            },
            {
                opc:      'select',
                id:       'fTipo',
                lbl:      'Catalogo:',
                class:    'col-12 col-md-4 col-lg-3',
                value:    '',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.tipos
            },
            {
                opc:       'button',
                id:        'btnNuevoProducto',
                text:      'Nuevo producto',
                color_btn: 'invernal',
                class:     'col-12 col-md-6 col-lg-3',
                onClick:   () => catalogosView.openProductoForm()
            },
            {
                opc:       'button',
                id:        'btnNuevoMesero',
                text:      'Nuevo mesero',
                color_btn: 'secondary',
                class:     'col-12 col-md-6 col-lg-3',
                onClick:   () => catalogosView.openMeseroForm()
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      'light',
            data:       filters
        });
    }

    getFilters() {
        return {
            q:    $('#qBuscar').val() || '',
            tipo: $('#fTipo').val()   || ''
        };
    }

    // -- Event handlers --

    onChangeFilters() {
        catalogos.lsProductos();
        catalogos.lsMeseros();
        catalogos.lsKpis();
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }
}

// -- Catalogos --

class Catalogos extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'catalogos';
    }

    // -- Data --

    getProductos() {
        const f = app.getFilters();
        if (f.tipo === 'meseros') return [];
        return Object.values(SAMPLE_CATALOGOS_PRODUCTOS_DB).filter(e => {
            if (!f.q) return true;
            return (e.code + ' ' + e.nombre).toLowerCase().includes(f.q.toLowerCase());
        });
    }

    getMeseros() {
        const f = app.getFilters();
        if (f.tipo === 'productos') return [];
        return Object.values(SAMPLE_CATALOGOS_MESEROS_DB).filter(e => {
            if (!f.q) return true;
            return (e.code + ' ' + e.nombre).toLowerCase().includes(f.q.toLowerCase());
        });
    }

    lsProductos() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiCatalogos, data:Object.assign({ opc:'lsProductos' }, app.getFilters()) })
        const rows = this.getProductos().map(_productoRow);

        this.createCoffeeTable3({
            parent:       'tableProductos',
            id:           'tbProductos',
            theme:        'light',
            center:       [1, 4, 5],
            right:        [3],
            actionsAlign: 'center',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'No se encontraron productos puente',
            emptyIcon:    'icon-box',
            data:         { row: rows }
        });

        if (window.lucide) lucide.createIcons();

        app.updateFooterInfo(`${rows.length} productos puente · ${this.getMeseros().length} meseros`);
    }

    lsMeseros() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiCatalogos, data:Object.assign({ opc:'lsMeseros' }, app.getFilters()) })
        const rows = this.getMeseros().map(_meseroRow);

        this.createCoffeeTable3({
            parent:       'tableMeseros',
            id:           'tbMeseros',
            theme:        'light',
            center:       [1],
            actionsAlign: 'center',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'No se encontraron meseros',
            emptyIcon:    'icon-users',
            data:         { row: rows }
        });

        if (window.lucide) lucide.createIcons();
    }

    lsKpis() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiCatalogos, data:Object.assign({ opc:'showKpis' }, app.getFilters()) })
        const productos = this.getProductos();
        const meseros   = this.getMeseros();

        catalogosView.renderInfoCards([
            {
                id:          'kpiProductos',
                title:       'Productos',
                lucideIcon:  'package',
                bgColor:     'bg-white',
                borderColor: 'border-gray-200',
                data: {
                    value: productos.length,
                    color: 'text-gray-800'
                }
            },
            {
                id:          'kpiPuente',
                title:       'Marcados puente',
                lucideIcon:  'link',
                bgColor:     'bg-white',
                borderColor: 'border-gray-200',
                data: {
                    value: productos.filter(p => p.puente).length,
                    color: 'text-green-600'
                }
            },
            {
                id:          'kpiMeseros',
                title:       'Meseros',
                lucideIcon:  'users',
                bgColor:     'bg-white',
                borderColor: 'border-gray-200',
                data: {
                    value: meseros.length,
                    color: 'text-gray-800'
                }
            },
            {
                id:          'kpiPrecio',
                title:       'Suma de precios',
                lucideIcon:  'banknote',
                bgColor:     'bg-white',
                borderColor: 'border-gray-200',
                data: {
                    value: _fmtMX(productos.reduce((s, p) => s + Number(p.precio || 0), 0)),
                    color: 'text-[#C05A40]'
                }
            }
        ]);
    }

    // -- Actions --

    saveProducto(code, data) {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiCatalogos, data:Object.assign({ opc:code ? 'editProducto' : 'addProducto' }, data) })
        const payload = {
            code:        data.code,
            nombre:      data.nombre,
            precio:      parseFloat(data.precio || '0'),
            puente:      parseInt(data.puente || '0', 10),
            modificador: parseInt(data.modificador || '0', 10)
        };

        if (code && code !== payload.code) delete SAMPLE_CATALOGOS_PRODUCTOS_DB[code];
        SAMPLE_CATALOGOS_PRODUCTOS_DB[payload.code] = payload;

        this.lsProductos();
        this.lsKpis();
        this.alertBox({ type: 'success', title: 'Producto puente guardado', timer: 1600 });
    }

    saveMesero(code, data) {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiCatalogos, data:Object.assign({ opc:code ? 'editMesero' : 'addMesero' }, data) })
        const payload = {
            code:   data.code,
            nombre: data.nombre
        };

        if (code && code !== payload.code) delete SAMPLE_CATALOGOS_MESEROS_DB[code];
        SAMPLE_CATALOGOS_MESEROS_DB[payload.code] = payload;

        this.lsMeseros();
        this.lsKpis();
        this.alertBox({ type: 'success', title: 'Mesero guardado', timer: 1600 });
    }

    saveEmisor() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiCatalogos, data:{ opc:'saveEmisor', ...payload } })
        app.dataInit.emisor = {
            razon:     $('#razon').val(),
            rfc:       $('#rfc').val(),
            telefono:  $('#telefono').val(),
            lugar:     $('#lugar').val(),
            domicilio: $('#domicilio').val()
        };
        this.alertBox({ type: 'success', title: 'Datos del emisor actualizados', timer: 1600 });
    }

    deleteProducto(code) {
        const e = SAMPLE_CATALOGOS_PRODUCTOS_DB[code];
        if (!e) return;

        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Dar de baja el producto',
                text:              `Se retirara "${e.nombre}" del catalogo de productos puente.`,
                icon:              'warning',
                confirmButtonText: 'Si, dar de baja',
                cancelButtonText:  'No'
            }
        }).then((result) => {
            if (!result.isConfirmed) return;
            // MODO FAKE: si hubiera backend -> useFetch({ url:apiCatalogos, data:{ opc:'deleteProducto', code:code } })
            delete SAMPLE_CATALOGOS_PRODUCTOS_DB[code];
            this.lsProductos();
            this.lsKpis();
        });
    }

    deleteMesero(code) {
        const e = SAMPLE_CATALOGOS_MESEROS_DB[code];
        if (!e) return;

        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Dar de baja el mesero',
                text:              `Se retirara "${e.nombre}" del catalogo de meseros.`,
                icon:              'warning',
                confirmButtonText: 'Si, dar de baja',
                cancelButtonText:  'No'
            }
        }).then((result) => {
            if (!result.isConfirmed) return;
            // MODO FAKE: si hubiera backend -> useFetch({ url:apiCatalogos, data:{ opc:'deleteMesero', code:code } })
            delete SAMPLE_CATALOGOS_MESEROS_DB[code];
            this.lsMeseros();
            this.lsKpis();
        });
    }
}

// -- Vista --

class CatalogosView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'catalogos';
    }

    // -- Render helpers --

    renderHeader(data) {
        this.viewHeader({
            parent: 'viewHeader',
            id:     'hdrCatalogos',
            json:   data
        });
    }

    renderFooter(data) {
        this.viewFooter({
            parent: 'viewFooterRow',
            id:     'viewFooter',
            json:   data
        });
    }

    renderInfoCards(rows) {
        this.infoCard({
            parent: 'kpisRow',
            id:     'kpisCatalogos',
            theme:  'light',
            style:  'file',
            cols:   4,
            json:   rows
        });
    }

    renderPanelHeads() {
        this.panelHead({
            parent: 'headProductos',
            json: {
                icon:  'package',
                title: 'Productos puente',
                badge: { text: 'catalogo', tone: 'b-gray' }
            }
        });

        this.panelHead({
            parent: 'headMeseros',
            json: {
                icon:  'users',
                title: 'Meseros',
                badge: { text: 'catalogo', tone: 'b-gray' }
            }
        });

        this.panelHead({
            parent: 'detailHead',
            json: {
                icon:  'building-2',
                title: 'Emisor del ticket virtual'
            }
        });
    }

    // -- Forms --

    renderEmisorForm(emisor) {
        this.coffeeForm({
            parent:       'formEmisor',
            id:           'frmEmisor',
            theme:        'light',
            showRequired: false,
            autofill:     emisor,
            json:         this.jsonEmisor()
        });
    }

    jsonEmisor() {
        return [
            {
                opc:   'input',
                id:    'razon',
                lbl:   'Razon social',
                tipo:  'texto',
                class: 'col-12 mb-3'
            },
            {
                opc:   'input',
                id:    'rfc',
                lbl:   'RFC',
                tipo:  'texto',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc:   'input',
                id:    'telefono',
                lbl:   'Telefono',
                tipo:  'tel',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc:   'input',
                id:    'lugar',
                lbl:   'Lugar de expedicion',
                tipo:  'texto',
                class: 'col-12 mb-3'
            },
            {
                opc:   'input',
                id:    'domicilio',
                lbl:   'Domicilio fiscal',
                tipo:  'texto',
                class: 'col-12 mb-3'
            },
            {
                opc:       'button',
                id:        'btnGuardarEmisor',
                text:      'Guardar emisor',
                color_btn: 'invernal',
                class:     'col-12',
                onClick:   () => catalogos.saveEmisor()
            }
        ];
    }

    jsonProducto() {
        return [
            {
                opc:   'input',
                id:    'code',
                lbl:   'Codigo',
                tipo:  'texto',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc:   'input',
                id:    'nombre',
                lbl:   'Nombre del producto',
                tipo:  'texto',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc:   'input',
                id:    'precio',
                lbl:   'Precio',
                tipo:  'cifra',
                class: 'col-12 col-md-4 mb-3'
            },
            {
                opc:      'select',
                id:       'puente',
                lbl:      'Es producto puente',
                class:    'col-12 col-md-4 mb-3',
                required: false,
                data:     SAMPLE_CATALOGOS_SINO
            },
            {
                opc:      'select',
                id:       'modificador',
                lbl:      'Es modificador',
                class:    'col-12 col-md-4 mb-3',
                required: false,
                data:     SAMPLE_CATALOGOS_SINO
            }
        ];
    }

    jsonMesero() {
        return [
            {
                opc:   'input',
                id:    'code',
                lbl:   'Codigo',
                tipo:  'texto',
                class: 'col-12 col-md-4 mb-3'
            },
            {
                opc:   'input',
                id:    'nombre',
                lbl:   'Nombre del mesero',
                tipo:  'texto',
                class: 'col-12 col-md-8 mb-3'
            }
        ];
    }

    openProductoForm(code) {
        const producto = code ? SAMPLE_CATALOGOS_PRODUCTOS_DB[code] : null;

        // MODO FAKE: si hubiera backend -> this.createModalForm({ coffeesoft:true, data:{ opc:code ? 'editProducto' : 'addProducto' } }) y el componente hace el POST
        this.formModal({
            id:       'frmProducto',
            title:    producto ? `Editar ${producto.nombre}` : 'Nuevo producto puente',
            autofill: producto || false,
            json:     this.jsonProducto(),
            onSave:   (data) => catalogos.saveProducto(code || '', data)
        });
    }

    openMeseroForm(code) {
        const mesero = code ? SAMPLE_CATALOGOS_MESEROS_DB[code] : null;

        // MODO FAKE: si hubiera backend -> this.createModalForm({ coffeesoft:true, data:{ opc:code ? 'editMesero' : 'addMesero' } }) y el componente hace el POST
        this.formModal({
            id:       'frmMesero',
            title:    mesero ? `Editar ${mesero.nombre}` : 'Nuevo mesero',
            size:     'default',
            autofill: mesero || false,
            json:     this.jsonMesero(),
            onSave:   (data) => catalogos.saveMesero(code || '', data)
        });
    }

    editProducto(code) {
        this.openProductoForm(code);
    }

    editMesero(code) {
        this.openMeseroForm(code);
    }

    // -- Components --

    formModal(options) {
        const defaults = {
            id:       'frmModal',
            title:    '',
            size:     'large',
            theme:    'light',
            autofill: false,
            json:     [],
            onSave:   () => { }
        };

        const opts = Object.assign({}, defaults, options || {});
        const host = $('<div>', { id: `${opts.id}Host` });

        let form;
        const modal = this.cfModal({
            title:       opts.title,
            size:        opts.size,
            theme:       opts.theme,
            closeButton: true,
            onOk:        () => form.trigger('submit')
        });

        modal.body.append(host);

        form = this.coffeeForm({
            parent:   `${opts.id}Host`,
            id:       opts.id,
            Element:  'form',
            theme:    opts.theme,
            autofill: opts.autofill,
            json:     opts.json,
            onSave:   (data) => {
                opts.onSave(data);
                modal.close();
            }
        });

        return modal;
    }

    panelHead(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex items-center justify-between w-full',
            json:   { icon: '', iconClass: 'w-4 h-4 text-gray-400', title: '', badge: null },
            classes: {
                title: 'text-[12px] font-bold text-gray-700 flex items-center gap-2'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const iconHtml  = opts.json.icon ? `<i data-lucide="${esc(opts.json.icon)}" class="${opts.json.iconClass}"></i>` : '';
        const badge     = opts.json.badge;
        const badgeHtml = badge ? `<span class="badge-base ${esc(badge.tone || 'b-gray')}">${esc(badge.text)}</span>` : '';

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`
            <h3 class="${opts.classes.title}">${iconHtml}${esc(opts.json.title)}</h3>
            ${badgeHtml}
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }

    viewHeader(options) {
        const defaults = {
            parent: 'root',
            id:     'viewHeader',
            class:  'flex items-center justify-between w-full',
            json:   { title: '', titleHtml: '', subtitle: '', toggles: [], back: null },
            classes: {
                title:    'text-lg font-bold text-gray-800',
                subtitle: 'text-xs text-gray-500',
                groupLbl: 'text-[9px] text-gray-500 uppercase tracking-wider font-bold',
                btn:      'demo-toggle px-2.5 py-1 rounded text-[11px] border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors',
                btnActive:'demo-toggle active px-2.5 py-1 rounded text-[11px] border border-blue-400 bg-blue-50 text-blue-700',
                sep:      'text-gray-300',
                backBtn:  'w-8 h-8 rounded-full bg-gray-100 hover:bg-blue-50 border border-gray-200 hover:border-blue-400 flex items-center justify-center text-gray-500 hover:text-blue-700 transition-colors flex-shrink-0'
            },
            onToggle: () => { },
            onBack:   null
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const state = {};
        (opts.json.toggles || []).forEach(g => { state[g.key] = g.value; });

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const toggleGroup = (g) => {
            const buttons = (g.options || []).map(op => {
                const active = state[g.key] === op.value;
                return `<button type="button"
                                data-toggle-key="${esc(g.key)}"
                                data-toggle-value="${esc(op.value)}"
                                class="${active ? opts.classes.btnActive : opts.classes.btn}">${esc(op.label)}</button>`;
            }).join('');
            return `
                <div class="flex items-center gap-2">
                    <span class="${opts.classes.groupLbl}">${esc(g.label)}</span>
                    ${buttons}
                </div>
            `;
        };

        const backCfg   = opts.json.back;
        const backHref  = typeof backCfg === 'string' ? backCfg : (backCfg && backCfg.href) || '';
        const backTitle = (backCfg && backCfg.title) || 'Regresar';
        const backHtml  = backCfg ? `
            <button type="button" id="${opts.id}_back" class="${opts.classes.backBtn}" title="${esc(backTitle)}">
                <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
        ` : '';

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        const togglesHtml = (opts.json.toggles || [])
            .map((g, i, arr) => toggleGroup(g) + (i < arr.length - 1 ? `<span class="${opts.classes.sep}">|</span>` : ''))
            .join('');

        wrap.html(`
            <div class="flex items-center gap-3">
                ${backHtml}
                <div>
                    <h1 class="${opts.classes.title}">${opts.json.titleHtml || esc(opts.json.title)}</h1>
                    ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-4">
                ${togglesHtml}
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        wrap.on('click', '[data-toggle-key]', (e) => {
            const $btn = $(e.currentTarget);
            const key  = $btn.attr('data-toggle-key');
            const val  = $btn.attr('data-toggle-value');
            state[key] = val;

            $btn.siblings('[data-toggle-key="' + key + '"]').addBack().each(function () {
                const isActive = $(this).attr('data-toggle-value') === val;
                this.className = isActive ? opts.classes.btnActive : opts.classes.btn;
            });

            opts.onToggle(key, val, Object.assign({}, state));
        });

        if (backCfg) {
            $(`#${opts.id}_back`).on('click', () => {
                if (typeof opts.onBack === 'function') return opts.onBack();
                if (backHref) window.location.href = backHref;
            });
        }
    }

    viewFooter(options) {
        const defaults = {
            parent: 'root',
            id:     'viewFooter',
            class:  'flex items-center justify-between w-full',
            json:   { info: '', legends: [] },
            tones: {
                default: '#9CA3AF',
                success: 'var(--cs-success,#3FC189)',
                warning: 'var(--cs-warning,#FBBF24)',
                danger:  'var(--cs-danger,#E02424)',
                info:    'var(--cs-info,#C05A40)',
                purple:  'var(--cs-accent-purple,#7C3AED)'
            },
            classes: {
                info:   'text-[10px] text-gray-500',
                legend: 'flex items-center gap-3 text-[10px] text-gray-500',
                item:   'flex items-center gap-1'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.tones   = Object.assign({}, defaults.tones,   o.tones   || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const toneColor  = (tone) => opts.tones[tone] || opts.tones.default;
        const legendItem = (lg) => `
            <span class="${opts.classes.item}">
                <span class="w-2 h-2 rounded-full" style="background:${toneColor(lg.tone)};"></span>
                ${esc(lg.label)}
            </span>
        `;

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        const legendsHtml = (opts.json.legends || []).map(legendItem).join('');

        wrap.html(`
            <p id="${opts.id}_info" class="${opts.classes.info}">${esc(opts.json.info)}</p>
            <div class="${opts.classes.legend}">${legendsHtml}</div>
        `);

        $(`#${opts.parent}`).html(wrap);
    }
}
