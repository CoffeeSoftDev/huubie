let apiCatalogos = '/app/facture/ctrl/ctrl-facture-catalogos.php';
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
        this.dataInit = await useFetch({ url: apiCatalogos, data: { opc: 'init' } });

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        catalogosView.renderHeader();
        catalogosView.renderFooter();
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
                    class: 'flex items-center justify-between px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    class: 'px-3 pt-3 bg-[#0E1521] flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 pt-1 pb-4 bg-[#0E1521] flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto'
                },
                {
                    id:    'viewFooterRow',
                    class: 'flex items-center justify-between px-4 py-2 bg-[#0E1521] flex-shrink-0'
                }
            ]
        };

        // createLayout solo itera children en type 'div': para un aside caen en el
        // default y jQuery los toma como metodo. Las zonas del panel se arman aparte.
        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'w-full md:w-[420px] flex-shrink-0 bg-[#141d2b] border-t md:border-t-0 md:border-l border-[#374151] flex flex-col overflow-hidden'
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden',
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
                        class: 'px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex items-center justify-between flex-shrink-0'
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
            class: 'bg-[#1F2A37] rounded-lg overflow-hidden flex flex-col',
            children: [
                {
                    id:    `head${key}`,
                    class: 'px-4 py-3 flex items-center justify-between'
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
            theme:      FACTURE_THEME,
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

    async lsProductos() {
        const data = await useFetch({ url: apiCatalogos, data: Object.assign({ opc: 'lsProductos' }, app.getFilters()) });

        this.createCoffeeTable3({
            parent:       'tableProductos',
            id:           'tbProductos',
            theme:        FACTURE_THEME,
            center:       [1, 4, 5],
            right:        [3],
            actionsAlign: 'center',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'No se encontraron productos',
            emptyIcon:    'ic-box',
            data:         data
        });

        if (window.lucide) lucide.createIcons();
    }

    async lsMeseros() {
        const data = await useFetch({ url: apiCatalogos, data: Object.assign({ opc: 'lsMeseros' }, app.getFilters()) });

        this.createCoffeeTable3({
            parent:       'tableMeseros',
            id:           'tbMeseros',
            theme:        FACTURE_THEME,
            center:       [1],
            actionsAlign: 'center',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'No se encontraron meseros',
            emptyIcon:    'ic-users',
            data:         data
        });

        if (window.lucide) lucide.createIcons();
    }

    // El pie del modulo se escribe con los mismos conteos de las tarjetas: es el
    // resumen del catalogo con el filtro puesto.
    async lsKpis() {
        const kpis = await useFetch({ url: apiCatalogos, data: Object.assign({ opc: 'showKpis' }, app.getFilters()) });

        catalogosView.renderInfoCards([
            {
                id:          'kpiProductos',
                title:       'Productos',
                lucideIcon:  'package',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.productos,
                    color: 'text-white'
                }
            },
            {
                id:          'kpiPuente',
                title:       'Marcados puente',
                lucideIcon:  'link',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.puente,
                    color: 'text-green-600'
                }
            },
            {
                id:          'kpiMeseros',
                title:       'Meseros',
                lucideIcon:  'users',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.meseros,
                    color: 'text-white'
                }
            },
            {
                id:          'kpiPrecio',
                title:       'Suma de puentes',
                lucideIcon:  'banknote',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.sumaPuente,
                    color: 'text-[#1C64F2]'
                }
            }
        ]);

        app.updateFooterInfo(`${kpis.productos} productos (${kpis.puente} puente · ${kpis.modificadores} modificadores) · ${kpis.meseros} meseros`);
    }

    // -- Actions --

    // La clave anterior viaja aparte: es la que localiza la fila cuando la edicion
    // cambia la clave del POS, y sin ella se daria de alta un producto nuevo.
    async saveProducto(code, data) {
        const response = await useFetch({ url: apiCatalogos, data: Object.assign({ opc: 'saveProducto', previo: code || '' }, data) });

        this.afterSave(response);
    }

    async saveMesero(code, data) {
        const response = await useFetch({ url: apiCatalogos, data: Object.assign({ opc: 'saveMesero', previo: code || '' }, data) });

        this.afterSave(response);
    }

    async saveEmisor() {
        const response = await useFetch({
            url: apiCatalogos,
            data: {
                opc:       'saveEmisor',
                razon:     $('#razon').val(),
                rfc:       $('#rfc').val(),
                telefono:  $('#telefono').val(),
                domicilio: $('#domicilio').val()
            }
        });

        if (response.status === 200) app.dataInit.emisor = response.emisor;

        this.alertBox({
            type:  response.status === 200 ? 'success' : 'error',
            title: response.message,
            timer: response.status === 200 ? 1600 : 0
        });
    }

    // Las dos tablas y las tarjetas se releen juntas: un producto marcado como
    // puente cambia tambien el conteo del pie.
    afterSave(response) {
        if (response.status === 200) {
            this.lsProductos();
            this.lsMeseros();
            this.lsKpis();
        }

        this.alertBox({
            type:  response.status === 200 ? 'success' : 'error',
            title: response.message,
            timer: response.status === 200 ? 1600 : 0
        });
    }

    deleteProducto(code) {
        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Dar de baja el producto',
                text:              `Se retirara la clave ${code} del catalogo. Los renglones ya cargados la conservan.`,
                icon:              'warning',
                confirmButtonText: 'Si, dar de baja',
                cancelButtonText:  'No'
            }
        }).then(async (result) => {
            if (!result.isConfirmed) return;

            this.afterSave(await useFetch({ url: apiCatalogos, data: { opc: 'deleteProducto', code: code } }));
        });
    }

    deleteMesero(code) {
        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Dar de baja el mesero',
                text:              `Se retirara la clave ${code} del catalogo de meseros.`,
                icon:              'warning',
                confirmButtonText: 'Si, dar de baja',
                cancelButtonText:  'No'
            }
        }).then(async (result) => {
            if (!result.isConfirmed) return;

            this.afterSave(await useFetch({ url: apiCatalogos, data: { opc: 'deleteMesero', code: code } }));
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

    // Copy de la cabecera y del pie del modulo. No son datos: productos, meseros y
    // emisor se consultan al servidor.
    renderHeader() {
        this.viewHeader({
            parent: 'viewHeader',
            id:     'hdrCatalogos',
            json: {
                title:    'Catalogos',
                subtitle: 'Administra los productos que sirven de puente, los meseros y los datos del emisor del ticket virtual',
                back:     { href: '/app/facture/index.php', title: 'Regresar al Facturador' }
            }
        });
    }

    renderFooter() {
        this.viewFooter({
            parent: 'viewFooterRow',
            id:     'viewFooter',
            json: {
                info: '',
                legends: [
                    { tone: 'success', label: 'Producto puente' },
                    { tone: 'warning', label: 'Modificador'     },
                    { tone: 'default', label: 'Sin marcar'      }
                ]
            }
        });
    }

    renderInfoCards(rows) {
        this.infoCard({
            parent: 'kpisRow',
            id:     'kpisCatalogos',
            theme:  FACTURE_THEME,
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
            theme:        FACTURE_THEME,
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
                data:     app.dataInit.sino
            },
            {
                opc:      'select',
                id:       'modificador',
                lbl:      'Es modificador',
                class:    'col-12 col-md-4 mb-3',
                required: false,
                data:     app.dataInit.sino
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

    // El registro se pide al servidor y no se guarda una copia en el cliente: la
    // tabla ya viene armada como HTML, asi que el formulario necesita los campos
    // en crudo y esos solo los tiene la consulta.
    async openProductoForm(code) {
        const data     = code ? await useFetch({ url: apiCatalogos, data: { opc: 'getProducto', code: code } }) : {};
        const producto = data.producto || null;

        this.formModal({
            id:       'frmProducto',
            title:    producto ? `Editar ${producto.nombre}` : 'Nuevo producto',
            autofill: producto || false,
            json:     this.jsonProducto(),
            onSave:   (form) => catalogos.saveProducto(code || '', form)
        });
    }

    async openMeseroForm(code) {
        const data   = code ? await useFetch({ url: apiCatalogos, data: { opc: 'getMesero', code: code } }) : {};
        const mesero = data.mesero || null;

        this.formModal({
            id:       'frmMesero',
            title:    mesero ? `Editar ${mesero.nombre}` : 'Nuevo mesero',
            size:     'default',
            autofill: mesero || false,
            json:     this.jsonMesero(),
            onSave:   (form) => catalogos.saveMesero(code || '', form)
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
            theme:    FACTURE_THEME,
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
                title: 'text-[12px] font-bold text-gray-300 flex items-center gap-2'
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
                title:    'text-lg font-bold text-white',
                subtitle: 'text-xs text-gray-400',
                groupLbl: 'text-[9px] text-gray-400 uppercase tracking-wider font-bold',
                btn:      'demo-toggle px-2.5 py-1 rounded text-[11px] border border-[#374151] text-gray-400 hover:bg-[#1F2A37] transition-colors',
                btnActive:'demo-toggle active px-2.5 py-1 rounded text-[11px] border border-blue-400 bg-[rgba(28,100,242,0.12)] text-blue-300',
                sep:      'text-gray-300',
                backBtn:  'w-8 h-8 rounded-full bg-[#1F2A37] hover:bg-[rgba(28,100,242,0.12)] border border-[#374151] hover:border-blue-400 flex items-center justify-center text-gray-400 hover:text-blue-300 transition-colors flex-shrink-0'
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
                info:    'var(--cs-info,#1C64F2)',
                purple:  'var(--cs-accent-purple,#7C3AED)'
            },
            classes: {
                info:   'text-[10px] text-gray-400',
                legend: 'flex items-center gap-3 text-[10px] text-gray-400',
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
