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
        this.clase        = 'puente';
    }

    async init() {
        this.dataInit = await useFetch({ url: apiCatalogos, data: { opc: 'init' } });

        this.render();
    }

    render() {
        this.layout();
        catalogosView.renderHeader();
        this.filterBar();

        catalogos.lsProductos();
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
                    class: 'px-4 py-3 bg-[#141d2b] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'contentRow',
                    class: 'p-3 flex-1 min-h-0 flex flex-col'
                }
            ]
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'flex-1 min-h-0 w-full flex flex-col overflow-hidden',
                container: [mainPanel]
            }
        });

        this.cardLayout();
    }

    cardLayout() {
        this.createLayout({
            parent: 'contentRow',
            design: false,
            data: {
                id:        'cardCatalogo',
                class:     'w-full flex-1 min-h-0 bg-[#1F2A37] rounded-lg p-4 flex flex-col overflow-hidden',
                container: [
                    {
                        type:  'div',
                        id:    'viewBody',
                        class: 'flex-1 min-h-0 overflow-auto scroll-thin'
                    }
                ]
            }
        });
    }

    // -- Filter bar --

    filterBar() {
        this.createLayout({
            parent: 'filterBar',
            design: false,
            data: {
                id:    'filterBarWrap',
                class: 'flex flex-col lg:flex-row lg:items-center gap-4',
                container: [
                    {
                        type:  'div',
                        id:    'filterBarRow',
                        class: 'w-full lg:w-[500px] flex-shrink-0'
                    },
                    {
                        type:  'div',
                        id:    'viewNote',
                        class: 'flex-1 min-w-0'
                    }
                ]
            }
        });

        this.createfilterBar({
            parent:     'filterBarRow',
            id:         `filterBar${this.PROJECT_NAME}`,
            coffeesoft: true,
            theme:      FACTURE_THEME,
            data: [
                {
                    opc:      'select',
                    id:       'fClase',
                    lbl:      'Catalogo:',
                    class:    'col-12 col-md-6 col-lg-7',
                    value:    this.clase,
                    required: false,
                    onchange: 'app.onChangeFilters()',
                    data:     this.dataInit.tipos
                },
                {
                    opc:       'button',
                    id:        'btnNuevoProducto',
                    text:      'Nuevo producto',
                    icon:      'ic-plus',
                    color_btn: 'primary',
                    class:     'col-12 col-md-6 col-lg-5',
                    onClick:   () => catalogosView.openProductoForm()
                }
            ]
        });

        catalogosView.renderNote();
    }

    getFilters() {
        return {
            q:     '',
            clase: this.clase
        };
    }

    onChangeFilters() {
        this.clase = $('#fClase').val() || '';

        catalogos.lsProductos();
    }

    // El listado de modificadores va sin la columna de tasa, asi que el Estatus
    // recorre un lugar y las columnas centradas son otras. El ctrl aplica la misma
    // regla al armar la tabla.
    verTasa() {
        return this.clase !== 'modificador';
    }

    emptyMessage() {
        const vacios = {
            puente: 'Aun no hay productos de tasa 0% dados de alta',
            normal: 'Aun no hay productos de IVA 16% dados de alta'
        };

        return vacios[this.clase] || 'No hay productos con el filtro aplicado';
    }
}

// -- Catalogos --

class Catalogos extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'catalogos';
    }

    // -- Data --

    lsProductos() {
        this.createTable({
            parent:      'viewBody',
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            coffeesoft:  true,
            data:        Object.assign({ opc: 'lsProductos' }, app.getFilters()),
            attr: {
                id:           'tbProductos',
                theme:        FACTURE_THEME,
                center:       app.verTasa() ? [1, 4, 5] : [1, 4],
                right:        [3],
                actionsAlign: 'center',
                hover:        true,
                f_size:       11,
                border_table: 'border-0',
                emptyMessage: app.emptyMessage(),
                emptyIcon:    'ic-box'
            },
            conf: {
                pag: 12
            }
        });
    }

    // -- Actions --

    async saveProducto(code, data) {
        const response = await useFetch({
            url:  apiCatalogos,
            data: Object.assign({ opc: 'saveProducto', previo: code || '' }, data)
        });

        this.afterSave(response);
    }

    async editProductoFlag(code, campo, valor) {
        const response = await useFetch({
            url: apiCatalogos,
            data: {
                opc:   'editProductoFlag',
                code:  code,
                campo: campo,
                valor: valor
            }
        });

        this.afterSave(response);
    }

    editProductoStatus(code, valor) {
        if (valor === 1) return this.saveStatus('editProductoStatus', code, valor);

        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Dar de baja el producto',
                text:              `Se retirara la clave ${code} del catalogo activo. Los renglones ya cargados la conservan y podras volver a activarla.`,
                icon:              'warning',
                confirmButtonText: 'Si, dar de baja',
                cancelButtonText:  'No'
            }
        }).then((result) => {
            if (result.isConfirmed) this.saveStatus('editProductoStatus', code, valor);
        });
    }

    async saveStatus(opc, code, valor) {
        const response = await useFetch({
            url: apiCatalogos,
            data: {
                opc:   opc,
                code:  code,
                valor: valor
            }
        });

        this.afterSave(response);
    }

    afterSave(response) {
        if (response.status === 200) this.refresh();

        this.alertBox({
            theme: FACTURE_THEME,
            type:  response.status === 200 ? 'success' : 'error',
            title: response.message,
            timer: response.status === 200 ? 1600 : 0
        });
    }

    refresh() {
        this.lsProductos();
    }
}

// -- Vista --

class CatalogosView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'catalogos';
    }

    // -- Render helpers --

    renderHeader() {
        this.viewHeader({
            parent: 'viewHeader',
            id:     'hdrCatalogos',
            json: {
                title:    'Catalogos',
                subtitle: 'Productos de tasa 0% e IVA 16%',
                back:     { href: '/app/facture/index.php', title: 'Regresar al Facturador' }
            }
        });
    }

    notas() {
        return {
            tasaCero: {
                icon:   'percent',
                accent: '#3FC189',
                title:  'Catalogo tasa 0%',
                text:   'Con estos productos se arma la parte del ticket a tasa 0%: el sistema junta sus precios hasta cubrir el total cobrado (para $250, uno de $150 y otro de $100).'
            },
            tasaIva: {
                icon:   'receipt',
                accent: '#60A5FA',
                title:  'Catalogo IVA 16%',
                text:   'Los productos sin marcar son los de tasa 16% y arman esa parte del ticket. La tasa se cambia desde la columna Tasa de la tabla.'
            },
            modificador: {
                icon:   'layers',
                accent: '#F59E0B',
                title:  '¿Que es un modificador?',
                text:   'Acompaña a otro producto —extra de queso, termino de la carne, guarnicion— y nunca arma un ticket por si solo.'
            }
        };
    }

    renderNote() {
        const notas = this.notas();

        this.noteCard({
            parent: 'viewNote',
            class:  'flex flex-col md:flex-row gap-2',
            classes: {
                item: 'note-card flex items-start gap-2 flex-1 px-3 py-2 rounded-lg bg-[#0E1521]'
            },
            json: {
                items: [notas.tasaCero, notas.tasaIva]
            }
        });
    }

    // -- Forms --

    async openProductoForm(code) {
        const data     = code ? await useFetch({ url: apiCatalogos, data: { opc: 'getProducto', code: code } }) : {};
        const producto = data.producto || null;

        this.formModal({
            id:       'frmProducto',
            title:    producto ? `Editar ${producto.nombre}` : 'Nuevo producto',
            autofill: producto || false,
            note:     { items: [this.notas().modificador] },
            json: [
                {
                    opc:      'input',
                    id:       'code',
                    lbl:      'Codigo',
                    tipo:     'text',
                    required: false,
                    class:    'col-12 col-md-4 mb-3'
                },
                {
                    opc:   'input',
                    id:    'nombre',
                    lbl:   'Descripcion',
                    tipo:  'texto',
                    class: 'col-12 col-md-8 mb-3'
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
                    id:       'modificador',
                    lbl:      'Es modificador',
                    class:    'col-12 col-md-4 mb-3',
                    value:    '0',
                    required: false,
                    data:     app.dataInit.sino
                },
                // La tasa decide en cual de los dos catalogos cae el producto. En un
                // alta se propone la del catalogo que se esta viendo, que es el que
                // se vino a llenar.
                {
                    opc:      'select',
                    id:       'puente',
                    lbl:      'Tasa',
                    class:    'col-12 col-md-4 mb-3',
                    value:    app.clase === 'normal' ? '0' : '1',
                    required: false,
                    data:     app.dataInit.tasas
                }
            ],
            onSave: (form) => catalogos.saveProducto(code || '', form)
        });

        this.toggleTasa();

        $('#modificador').on('change', () => this.toggleTasa());
    }

    // El modificador acompaña a otro producto y nunca arma un ticket por si solo,
    // asi que no elige catalogo: se le esconde la tasa y se guarda fuera del de
    // tasa 0%, que es el unico que se consume para armar papel.
    //
    // La tasa que traia se recuerda para devolverla si se desmarca: quien entro al
    // catalogo de tasa 0% no deberia salir con un producto al 16% por haber pasado
    // un momento por el modificador.
    toggleTasa() {
        const esModificador = $('#modificador').val() === '1';
        const tasa          = $('#puente');

        tasa.closest('[class*="col-"]').toggle(!esModificador);

        if (esModificador) {
            this.tasaPrevia = tasa.val();

            return tasa.val('0');
        }

        if (this.tasaPrevia !== undefined) tasa.val(this.tasaPrevia);
    }

    editProducto(code) {
        this.openProductoForm(code);
    }

    // -- Components --

    formModal(options) {
        const defaults = {
            id:       'frmModal',
            title:    '',
            size:     'large',
            theme:    FACTURE_THEME,
            autofill: false,
            note:     null,
            json:     [],
            onSave:   () => { }
        };

        const opts = Object.assign({}, defaults, options || {});
        const host = $('<div>', { id: `${opts.id}Host` });
        const note = $('<div>', { id: `${opts.id}Note` });

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

        // La nota va bajo los campos: es la aclaracion de lo que se acaba de
        // capturar, no la portada del formulario.
        if (opts.note) {
            modal.body.append(note);

            this.noteCard({
                parent: `${opts.id}Note`,
                class:  'flex flex-col gap-2 mt-2',
                json:   opts.note
            });
        }

        return modal;
    }

    noteCard(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex flex-col md:flex-row gap-2 mb-3',
            json:   { items: [] },
            classes: {
                item:  'note-card flex items-start gap-2.5 flex-1 px-3 py-2.5 rounded-lg bg-[#0E1521]',
                chip:  'note-chip flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0',
                icon:  'w-3.5 h-3.5',
                body:  'flex-1 min-w-0',
                text:  'note-text text-[10px] text-gray-400 leading-relaxed mb-0',
                title: 'note-title text-[11px] font-bold mb-0.5'
            }
        };

        const tint = (hex, alpha) => {
            const n = parseInt(String(hex || '').replace('#', ''), 16);

            if (isNaN(n)) return 'transparent';

            return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const item = (it) => `
            <div class="${opts.classes.item}">
                ${it.icon ? `
                    <span class="${opts.classes.chip}" style="background: ${tint(it.accent, .15)};">
                        <i data-lucide="${esc(it.icon)}" class="${opts.classes.icon}" style="color: ${esc(it.accent || 'currentColor')};"></i>
                    </span>
                ` : ''}
                <div class="${opts.classes.body}">
                    <p class="${opts.classes.title}" style="color: ${esc(it.accent || 'currentColor')};">${esc(it.title)}</p>
                    <p class="${opts.classes.text}">${esc(it.text)}</p>
                </div>
            </div>
        `;

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html((opts.json.items || []).map(item).join(''));

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
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
                group:    'flex items-center gap-1 p-1 rounded-lg border border-[#374151] bg-[#141d2b]',
                btn:      'demo-toggle px-3 py-1.5 rounded-md text-[12px] text-gray-400 hover:bg-[#1F2A37] hover:text-white transition-colors',
                btnActive:'demo-toggle active px-3 py-1.5 rounded-md text-[12px] font-semibold bg-[#1C64F2] text-white',
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

        const toggleGroup = (g) => {
            const buttons = (g.options || []).map(op => {
                const active = state[g.key] === op.value;
                return `<button type="button"
                                data-toggle-key="${esc(g.key)}"
                                data-toggle-value="${esc(op.value)}"
                                class="${active ? opts.classes.btnActive : opts.classes.btn}">${esc(op.label)}</button>`;
            }).join('');
            const label = g.label ? `<span class="${opts.classes.groupLbl}">${esc(g.label)}</span>` : '';
            return `
                ${label}
                <div class="${opts.classes.group}">
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
}

// -- Complementos --

function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
