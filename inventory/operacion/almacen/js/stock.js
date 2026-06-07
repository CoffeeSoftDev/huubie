let apiStock = 'ctrl/ctrl-stock.php';
let app, stock, stockView;

let subsidiaries_id;

const NIVELES_STOCK = [
    { id: '',        valor: 'Todos los niveles' },
    { id: 'ok',      valor: 'Stock OK'          },
    { id: 'bajo',    valor: 'Stock Bajo'         },
    { id: 'agotado', valor: 'Agotado'            }
];

const MOVIMIENTOS_STOCK = [
    { id: '',    valor: 'Todos los productos' },
    { id: 'con', valor: 'Con movimientos'     },
    { id: 'sin', valor: 'Sin movimientos'     }
];

$(async () => {
    stockView = new StockView(apiStock, 'root');
    stock     = new Stock(apiStock, 'root');
    app       = new App(apiStock, 'root');
    await app.init();
});

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSStock';
        this.subId        = null;
        this.selectedId   = null;
    }

    async init() {
        const r = await useFetch({ url: apiStock, data: { opc: 'init' } });
        if (r && r.status === 200) {
            this.dataInit = {
                subsidiaries_id: r.subsidiaries_id || '',
                sucursales:      r.sucursales      || [],
                categorias:      r.categorias      || [],
                niveles:         NIVELES_STOCK
            };
        } else {
            this.dataInit = {
                subsidiaries_id: '',
                sucursales:      [],
                categorias:      [],
                niveles:         NIVELES_STOCK
            };
        }
        this.subId      = this.dataInit.subsidiaries_id;
        subsidiaries_id = this.subId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        stockView.renderHeader({
            title:    'Visor de Stock',
            subtitle: 'Control de existencias por sucursal, categoria y nivel',
            back:     { href: 'index.php', title: 'Regresar al inicio' }
        });
        stockView.renderDetail(null);
        this.populateFilters();
        stock.lsStock();
        stock.lsKpis();
    }

    layout() {

        // #root tiene min-height global (general.css) calculado con 4rem que NO
        // contempla el navbar real ni el breadcrumb, por lo que desborda el viewport.
        // Anulamos ese min-height y le damos una altura exacta segun su posicion real,
        // dejando el scroll interno al tableWrap. Se reajusta en resize.
        this.fitRootHeight();
        $(window).off('resize.stock').on('resize.stock', () => this.fitRootHeight());

        const mainPanel = {
            type: 'div',
            id:   'mainPanel',
            class:'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                {
                    id:    'viewHeader',
                    text:  '#viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id: 'filterBar',
                    class: 'px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    text:  '#tableWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto bg-white'
                }
            ]
        };

        const detailPanel = {
            type: 'aside',
            id:   'detailPanel',
            class:'detail-drawer fixed inset-y-0 right-0 z-50 w-full max-w-md transform translate-x-full transition-transform duration-300 ease-out md:relative md:translate-x-0 md:w-[420px] md:max-w-none md:transition-none md:z-auto flex-shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col overflow-hidden shadow-2xl md:shadow-none',
            children: [
                {
                    id:    'emptyDetail',
                    text:  '#emptyDetail',
                    class: 'flex-1 flex flex-col items-center justify-center text-center px-6'
                },
                {
                    id:    'detailContent',
                    text:  '#detailContent',
                    class: 'hidden flex-1 flex flex-col overflow-hidden'
                }
            ]
        };

        const backdrop = {
            type: 'div',
            id:   'detailBackdrop',
            class: 'detail-backdrop hidden fixed inset-0 bg-black/40 z-40 md:hidden'
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'flex-1 min-h-0 w-full flex flex-row overflow-hidden relative bg-white rounded-lg border border-gray-200',
                container: [mainPanel, detailPanel, backdrop]
            }
        });

        $('#detailBackdrop').off('click').on('click', () => this.selectProduct(null));
    }

    fitRootHeight() {
        const $root = $('#root');
        if (!$root.length) return;
        const top    = $root[0].getBoundingClientRect().top; // distancia desde el viewport
        const bottom = 20; // respiro inferior (padding de #main__content)
        $root.css({
            display:       'flex',
            flexDirection: 'column',
            minHeight:     0,
            height:        `calc(100vh - ${Math.ceil(top)}px - ${bottom}px)`,
            overflow:      'hidden'
        });
    }

    openDetailDrawer() {
        $('#detailPanel').removeClass('translate-x-full');
        $('#detailBackdrop').removeClass('hidden');
    }

    closeDetailDrawer() {
        $('#detailPanel').addClass('translate-x-full');
        $('#detailBackdrop').addClass('hidden');
    }

    filterBar() {

        let filters = [
            {
                opc:      'select',
                id:       'subsidiaries_id',
                lbl:      'Sucursal:',
                class:    'col-12 col-md-3 col-lg-3',
                onchange: 'app.onChangeSucursal()',
                value:    '',
                data:     [{ id: '', valor: 'Todas las sucursales' }]
            },
            {
                opc:      'select',
                id:       'fCategoria',
                lbl:      'Categoria:',
                class:    'col-12 col-md-3 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     [{ id: '', valor: 'Todas las categorias' }].concat(this.dataInit.categorias || [])
            },
            {
                opc:      'select',
                id:       'fNivel',
                lbl:      'Nivel:',
                class:    'col-12 col-md-3 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     NIVELES_STOCK
            },
            {
                opc:      'select',
                id:       'fMovimiento',
                lbl:      'Movimientos:',
                class:    'col-12 col-md-3 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value:    'con',
                data:     MOVIMIENTOS_STOCK
            }
        ];

        this.createfilterBar({
            parent: 'filterBar',
            coffeesoft:true,
            theme:'light',
            data:   filters
        });
    }

    populateFilters() {
        const sucursales = this.dataInit.sucursales || [];
        if (sucursales.length) {
            this.populateSelect('subsidiaries_id', sucursales);
            $('#subsidiaries_id').val(this.subId);
        }
    }

    populateSelect(id, data) {
        const $sel = $(`#${id}`);
        if (!$sel.length) return;
        $sel.find('option:not(:first)').remove();
        data.forEach(item => {
            if (item.id === '' && $sel.find('option').first().val() === '') return;
            $sel.append(`<option value="${item.id}">${item.valor}</option>`);
        });
    }

    getFilters() {
        return {
            subsidiaries_id: $('#subsidiaries_id').val() || this.subId || '',
            categoria:       $('#fCategoria').val()     || '',
            nivel:           $('#fNivel').val()         || '',
            movimiento:      $('#fMovimiento').val()    || '',
            q:               $('#qBuscar').val()        || ''
        };
    }

    async onChangeFilters() {
        stock.lsStock();
        await stock.lsKpis();

        if (this.selectedId) {
            this.selectProduct(null);
        }
    }

    onChangeSucursal() {
        stock.lsStock();
        stock.lsKpis();
        if (this.selectedId) stock.getProducto(this.selectedId);
    }

    selectProduct(productId) {
        this.selectedId = productId;
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
        if (productId) {
            $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
                return $(this).find(`[onclick*="selectProduct(${productId})"]`).length > 0;
            }).addClass('row-active');
            this.openDetailDrawer();
            stock.getProducto(productId);
        } else {
            this.closeDetailDrawer();
            stockView.renderDetail(null);
        }
    }

}

class Stock extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSStock';
    }

    lsStock() {
        const f = app.getFilters();

        this.createTable({
            parent:      'tableWrap',
            idFilterBar: 'filterBar',
            coffeesoft:  true,
            conf:        { datatable: true, pag: 15 },
            data: {
                opc:             'lsStock',
                subsidiaries_id: f.subsidiaries_id,
                category_id:     f.categoria,
                nivel:           f.nivel,
                movimiento:      f.movimiento,
                q:               f.q
            },
            attr: {
                id:           `tb${this.PROJECT_NAME}`,
                theme:        'light',
                striped:      true,
                f_size:       12,
                center:       [3, 7, 8],
                emptyMessage: 'No se encontraron productos con los filtros aplicados',
                emptyIcon:    'icon-cube'
            }
        });
    }

    async lsKpis() {
        const f = app.getFilters();
        const r = await useFetch({
            url: apiStock,
            data: {
                opc:             'showStock',
                subsidiaries_id: f.subsidiaries_id
            }
        });

        const c = (r && r.status === 200) ? r.counts : {};

        const kpis = [
            { id: 'kpiTotal',   label: 'Total Productos', value: parseInt(c.total_productos || 0, 10), tone: 'default', icon: 'package'         },
            { id: 'kpiOk',      label: 'Stock OK',        value: parseInt(c.total_ok        || 0, 10), tone: 'success', icon: 'check-circle-2'  },
            { id: 'kpiBajo',    label: 'Stock Bajo',      value: parseInt(c.total_bajo      || 0, 10), tone: 'warning', icon: 'alert-triangle'  },
            { id: 'kpiAgotado', label: 'Agotado',         value: parseInt(c.total_agotado   || 0, 10), tone: 'danger',  icon: 'x-circle'        },
            { id: 'kpiVida',    label: 'Vida util',       value: 0,                                    tone: 'purple',  icon: 'clock'           }
        ];
        stockView.renderInfoCards(kpis);
    }

    async getProducto(id) {
        const r = await useFetch({ url: apiStock, data: { opc: 'getProducto', id: id } });
        if (r && r.status === 200) {
            stockView.renderDetail(r.producto);
        } else {
            stockView.renderDetail(null);
        }
    }

    viewMovimientos(id) {
        app.selectProduct(id);
    }
}

class StockView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSStock';
    }

    renderDetail(producto) {
        const sucursalesReales = (app && app.dataInit && app.dataInit.sucursales || [])
            .filter(s => s.id !== '')
            .map(s => ({ id: String(s.id), name: s.valor }));

        this.productDetailPanel({
            parent:      'detailPanel',
            json:        producto,
            sucursalId:  $('#subsidiaries_id').val() || '',
            sucursalName: $('#subsidiaries_id option:selected').text() || 'Todas las sucursales',
            sucursales:  sucursalesReales.length ? sucursalesReales : undefined,
            onClose:     () => app.selectProduct(null)
        });
    }

    renderInfoCards(rows) {
        this.kpisRow({
            parent:  'kpisRow',
            json:    rows,
            onClick: (kpi) => console.log('[kpisRow] click', kpi.id)
        });
    }

    renderHeader(data) {
        this.viewHeader({
            parent:   'viewHeader',
            json:     data,
            onToggle: (key, value) => console.log('[viewHeader] toggle', key, '->', value)
        });
    }

    renderFooter(data) {
        this.viewFooter({
            parent: 'viewFooter',
            json:   data
        });
    }

    renderTabs(project) {
        this.tabsBar({
            parent: 'tabsRow',
            json: [
                { id: 'stock',        label: 'Stock Actual',  active: true  },
                { id: 'movimientos',  label: 'Movimientos',   active: false },
                { id: 'entradas',     label: 'Entradas',      active: false },
                { id: 'traspasos',    label: 'Traspasos',     active: false },
                { id: 'ajustes',      label: 'Ajustes',       active: false }
            ],
            onChange: (tab) => console.log('[tabsBar]', tab.id)
        });
    }

    kpisRow(options) {
        const defaults = {
            parent: 'root',
            id:     'kpisRow',
            class:  'grid grid-cols-2 md:grid-cols-5 gap-3',
            json:   [],
            labels: {
                empty: 'Sin indicadores'
            },
            tones: {
                default: 'text-white',
                success: 'cs-text-success text-[var(--cs-success,#3FC189)]',
                warning: 'cs-text-warning text-[var(--cs-warning,#FBBF24)]',
                danger:  'cs-text-danger  text-[#FDA4AF]',
                info:    'cs-text-info    text-[var(--cs-info,#1C64F2)]',
                purple:  'cs-text-purple  text-[#FCD34D]'
            },
            iconBgTones: {
                default: 'bg-slate-500/15',
                success: 'bg-emerald-500/15',
                warning: 'bg-amber-500/15',
                danger:  'bg-rose-500/28',
                info:    'bg-blue-500/15',
                purple:  'bg-amber-500/28'
            },
            cardClass:  'cs-kpi-card bg-[var(--cs-bg-input,#1F2937)] rounded-lg px-3 py-3 cursor-pointer hover:bg-[var(--cs-bg-header,#141d2b)] transition-colors',
            labelClass: 'cs-kpi-label text-[10px] uppercase tracking-wider font-bold text-[var(--cs-text-muted,#9CA3AF)] whitespace-nowrap truncate',
            valueClass: 'cs-kpi-value text-sm font-bold',
            iconWrapClass: 'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
            iconClass:     'w-3.5 h-3.5',
            onClick:    () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels      = Object.assign({}, defaults.labels,      o.labels      || {});
        opts.tones       = Object.assign({}, defaults.tones,       o.tones       || {});
        opts.iconBgTones = Object.assign({}, defaults.iconBgTones, o.iconBgTones || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const toneClass   = (tone) => opts.tones[tone]       || opts.tones.default;
        const iconBgClass = (tone) => opts.iconBgTones[tone] || opts.iconBgTones.default;

        const kpiCard = (kpi, idx) => {
            const cardId = kpi.id || `${opts.id}_${idx}`;
            const iconHtml = kpi.icon ? `
                <div class="${opts.iconWrapClass} ${iconBgClass(kpi.tone)}">
                    <i data-lucide="${esc(kpi.icon)}" class="${opts.iconClass} ${toneClass(kpi.tone)}"></i>
                </div>
            ` : '';
            return `
                <div id="${cardId}" data-kpi-idx="${idx}" class="${opts.cardClass}">
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex-1 min-w-0">
                            <p class="${opts.labelClass}">${esc(kpi.label)}</p>
                            <p class="${opts.valueClass} ${toneClass(kpi.tone)}" id="${cardId}_value">${esc(kpi.value)}</p>
                        </div>
                        ${iconHtml}
                    </div>
                </div>
            `;
        };

        const grid = $('<div>', { id: opts.id, class: opts.class });

        if (!opts.json || opts.json.length === 0) {
            grid.html(`
                <p class="col-span-full text-[10px] text-[var(--cs-text-muted,#9CA3AF)] italic text-center py-2">
                    ${esc(opts.labels.empty)}
                </p>
            `);
            $(`#${opts.parent}`).html(grid);
            return;
        }

        grid.html(opts.json.map((kpi, idx) => kpiCard(kpi, idx)).join(''));
        $(`#${opts.parent}`).html(grid);
        if (window.lucide) lucide.createIcons();

        grid.find('[data-kpi-idx]').on('click', (e) => {
            const idx = parseInt($(e.currentTarget).attr('data-kpi-idx'), 10);
            const kpi = opts.json[idx];
            opts.onClick(kpi, idx);
        });
    }

    viewHeader(options) {
        const defaults = {
            parent: 'root',
            id:     'viewHeader',
            class:  'flex items-center justify-between w-full',
            json:   { title: '', subtitle: '', toggles: [], back: null },
            classes: {
                title:    'text-base font-bold text-white',
                subtitle: 'text-[10px] text-[var(--cs-text-secondary,#D1D5DB)]',
                groupLbl: 'text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold',
                btn:      'demo-toggle px-2.5 py-1 rounded text-[11px] border border-[var(--cs-border,#374151)] text-[var(--cs-text-secondary,#D1D5DB)] hover:bg-[var(--cs-bg-input,#1F2937)] transition-colors',
                btnActive:'demo-toggle active px-2.5 py-1 rounded text-[11px] border border-[var(--cs-accent-purple,#7C3AED)] bg-[var(--cs-accent-purple,#7C3AED)]/15 text-white',
                sep:      'text-[var(--cs-border,#374151)]',
                backBtn:  'w-8 h-8 rounded-full bg-[var(--cs-bg-input,#1F2937)] hover:bg-[var(--cs-accent-purple,#7C3AED)]/15 border border-[var(--cs-border,#374151)] hover:border-[var(--cs-accent-purple,#7C3AED)] flex items-center justify-center text-[var(--cs-text-secondary,#D1D5DB)] hover:text-white transition-colors flex-shrink-0'
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

        const backCfg  = opts.json.back;
        const backHref = typeof backCfg === 'string' ? backCfg : (backCfg && backCfg.href) || '';
        const backTitle = (backCfg && backCfg.title) || 'Regresar';
        const backHtml = backCfg ? `
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
                    <h1 class="${opts.classes.title}">${esc(opts.json.title)}</h1>
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
                const isActive  = $(this).attr('data-toggle-value') === val;
                this.className  = isActive ? opts.classes.btnActive : opts.classes.btn;
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
                info:   'text-[10px] text-[var(--cs-text-muted,#9CA3AF)]',
                legend: 'flex items-center gap-3 text-[10px] text-[var(--cs-text-muted,#9CA3AF)]',
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

        const toneColor = (tone) => opts.tones[tone] || opts.tones.default;
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

    tabsBar(options) {
        const defaults = {
            parent: 'root',
            id:     'tabsBar',
            class:  'flex items-center gap-1 border-b border-transparent',
            json:   [],
            classes: {
                tab:       'px-3 py-2 text-[11px] font-medium text-[var(--cs-text-muted,#9CA3AF)] border-b-2 border-transparent hover:text-white transition-colors cursor-pointer',
                tabActive: 'px-3 py-2 text-[11px] font-bold text-[var(--cs-accent-purple,#A78BFA)] border-b-2 border-[var(--cs-accent-purple,#7C3AED)] cursor-pointer'
            },
            onChange: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html((opts.json || []).map(tab => `
            <button type="button"
                    data-tab-id="${esc(tab.id)}"
                    class="${tab.active ? opts.classes.tabActive : opts.classes.tab}">
                ${esc(tab.label)}
            </button>
        `).join(''));

        $(`#${opts.parent}`).html(wrap);

        wrap.on('click', '[data-tab-id]', (e) => {
            const id = $(e.currentTarget).attr('data-tab-id');
            wrap.find('[data-tab-id]').each(function () {
                const isActive = $(this).attr('data-tab-id') === id;
                this.className = isActive ? opts.classes.tabActive : opts.classes.tab;
            });
            const tab = (opts.json || []).find(t => t.id === id);
            opts.onChange(tab || { id });
        });
    }

    productDetailPanel(options) {
        const defaults = {
            parent:       'root',
            id:           'productDetailPanel',
            class:        'w-full h-full flex-shrink-0 bg-[var(--cs-bg-header,#141d2b)] border-l border-[var(--cs-border,#374151)] flex flex-col overflow-hidden',
            json:         null,
            sucursalId:   '',
            sucursalName: 'Todas las sucursales',
            labels: {
                emptyTitle:   'Selecciona un producto',
                emptyHint:    'Haz click en cualquier fila o en el icono ojo para ver el detalle aqui.',
                comportLbl:   'Comportamiento e historial',
                stockBajo:    'Atencion: stock bajo',
                stockAgotado: 'Producto agotado',
                msgBajo:      (min) => `Existencias por debajo del minimo (${min}). Considera reabastecer pronto.`,
                msgAgotado:   'Sin existencias disponibles. Considera generar un reabastecimiento.',
                existencias:  'Existencias por sucursal',
                almacenes:    'Almacenes disponibles',
                historial:    'Historial de movimientos',
                stock:        'Stock',
                min:          'Min',
                max:          'Max',
                vidaUtilLbl:  'Vida util'
            },
            sucursales: [
                { id: 'kafeto',  name: 'Reginas Kafeto'  },
                { id: 'central', name: 'Reginas Central' },
                { id: 'norte',   name: 'Reginas Norte'   },
                { id: 'sur',     name: 'Reginas Sur'     }
            ],
            statusMap: {
                ok:      { palette: 'emerald', icon: 'check-circle-2', label: 'Stock OK',   msg: 'Nivel saludable, dentro del rango optimo.',                stockColor: 'text-emerald-300' },
                bajo:    { palette: 'orange',  icon: 'alert-triangle', label: 'Stock Bajo', msg: 'El nivel actual esta por debajo del minimo recomendado.', stockColor: 'text-orange-300'  },
                agotado: { palette: 'rose',    icon: 'x-circle',       label: 'Agotado',    msg: 'No hay existencias disponibles.',                          stockColor: 'text-rose-300'    }
            },
            statusPalettes: {
                emerald: { bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', text: 'text-emerald-300' },
                orange:  { bg: 'bg-orange-500/8',  border: 'border-orange-500/20',  text: 'text-orange-300'  },
                rose:    { bg: 'bg-rose-500/8',    border: 'border-rose-500/20',    text: 'text-rose-300'    }
            },
            vidaMap: {
                critico: { palette: 'rose',    icon: 'alert-octagon', label: 'Critica',   msg: 'Caducidad inminente, prioriza la rotacion.' },
                proximo: { palette: 'amber',   icon: 'clock',         label: 'Proxima',   msg: 'Cercano a su fecha de caducidad.'           },
                ok:      { palette: 'emerald', icon: 'leaf',          label: 'Saludable', msg: 'Vida util dentro del rango optimo.'         },
                na:      { palette: 'slate',   icon: 'minus',         label: 'No aplica', msg: 'Producto sin vida util registrada.'         }
            },
            vidaPalettes: {
                rose:    { bg: 'bg-rose-500/8',    border: 'border-rose-500/20',    text: 'text-rose-300'    },
                amber:   { bg: 'bg-amber-500/8',   border: 'border-amber-500/20',   text: 'text-amber-300'   },
                emerald: { bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', text: 'text-emerald-300' },
                slate:   { bg: 'bg-slate-500/8',   border: 'border-slate-500/20',   text: 'text-slate-300'   }
            },
            movMap: {
                in:     { bg: 'bg-green-500/15',  iconColor: 'text-green-400',  icon: 'arrow-down',  qtyColor: 'text-green-400'  },
                out:    { bg: 'bg-red-500/15',    iconColor: 'text-red-400',    icon: 'arrow-up',    qtyColor: 'text-red-400'    },
                tr:     { bg: 'bg-purple-500/15', iconColor: 'text-purple-400', icon: 'repeat',      qtyColor: 'text-purple-400' },
                adjust: { bg: 'bg-orange-500/15', iconColor: 'text-orange-400', icon: 'settings-2',  qtyColor: 'text-orange-400' }
            },
            onClose: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels         = Object.assign({}, defaults.labels,         o.labels         || {});
        opts.statusMap      = Object.assign({}, defaults.statusMap,      o.statusMap      || {});
        opts.statusPalettes = Object.assign({}, defaults.statusPalettes, o.statusPalettes || {});
        opts.vidaMap        = Object.assign({}, defaults.vidaMap,        o.vidaMap        || {});
        opts.vidaPalettes   = Object.assign({}, defaults.vidaPalettes,   o.vidaPalettes   || {});
        opts.movMap         = Object.assign({}, defaults.movMap,         o.movMap         || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const aside = $('<aside>', { id: opts.id, class: opts.class });

        if (!opts.json) {
            aside.html(`
                <div class="px-4 py-3 border-b border-[var(--cs-border,#374151)] flex-shrink-0 flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-bold text-white">Vista del Producto</h3>
                        <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.comportLbl)}</p>
                    </div>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6">
                    <div class="w-14 h-14 rounded-full bg-[var(--cs-bg-input,#1F2937)] border border-[var(--cs-border,#374151)] flex items-center justify-center mb-3">
                        <i data-lucide="package-search" class="w-6 h-6 text-[var(--cs-text-muted,#9CA3AF)]"></i>
                    </div>
                    <p class="text-[11px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
                </div>
            `);
            $(`#${opts.parent}`).html(aside);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const p             = opts.json;
        const sucId         = opts.sucursalId;
        const sucName       = opts.sucursalName;
        const stockVal      = (p.stockSuc || {})[sucId] != null ? p.stockSuc[sucId] : (p.stockSuc[''] || 0);
        const status        = opts.statusMap[p.estado] || opts.statusMap.ok;
        const statusPalette = opts.statusPalettes[status.palette];
        const tieneVida     = !!(p.vida && p.vida.label && p.vida.label !== 'na');
        const vidaCfg       = opts.vidaMap[(p.vida && p.vida.label) || 'na'];
        const vidaPalette   = opts.vidaPalettes[vidaCfg.palette];
        const vidaText      = p.vida && p.vida.dias != null ? `${p.vida.dias} dias restantes` : 'Sin caducidad activa';

        const stockColor = (q) => q === 0 ? 'text-red-400' : (q < p.min ? 'text-orange-400' : 'text-green-400');

        const branchListHtml = (opts.sucursales || []).map(s => {
            const q      = (p.stockSuc || {})[s.id] != null ? p.stockSuc[s.id] : 0;
            const active = sucId === s.id ? 'border-[var(--cs-accent-purple,#7C3AED)]' : 'border-[var(--cs-border,#374151)]';
            return `
                <div class="flex items-center justify-between bg-[var(--cs-bg-input,#1F2937)] rounded-md px-2.5 py-1.5 border ${active}">
                    <div class="flex items-center gap-2">
                        <i data-lucide="store" class="w-5 h-5 ${q === 0 ? 'text-gray-500' : 'text-[#c4b5fd]'}"></i>
                        <span class="text-[11px] ${q === 0 ? 'text-gray-500' : 'text-white'}">${esc(s.name)}</span>
                    </div>
                    <span class="text-[11px] font-bold ${stockColor(q)}">${q}</span>
                </div>`;
        }).join('');

        const almTone = {
            info:   { bg: 'rgba(28,100,242,0.15)',  fg: '#60A5FA' },
            purple: { bg: 'rgba(124,58,237,0.15)',  fg: '#A78BFA' }
        };
        const almacenesHtml = (p.almacenes || []).map(a => {
            const t = almTone[a.type] || almTone.info;
            return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background:${t.bg};color:${t.fg};">
                <i data-lucide="warehouse" class="w-2.5 h-2.5 mr-1 inline"></i>${esc(a.name)}
            </span>`;
        }).join('');

        const movsAll    = p.movs || [];
        const movsToShow = movsAll.slice(0, 10);
        const movsHtml   = movsToShow.map(m => {
            const cfg = opts.movMap[m.type] || opts.movMap.adjust;
            return `
                <div class="flex items-start gap-2 bg-[var(--cs-bg-input,#1F2937)] rounded-md px-2.5 py-1.5 border border-[var(--cs-border,#374151)]">
                    <div class="w-5 h-5 rounded ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5">
                        <i data-lucide="${cfg.icon}" class="w-2.5 h-2.5 ${cfg.iconColor}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                            <p class="text-[10px] font-medium text-white">${esc(m.label)}</p>
                            <span class="text-[10px] font-bold ${cfg.qtyColor}">${esc(m.qty)}</span>
                        </div>
                        <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(m.when)}</p>
                    </div>
                </div>`;
        }).join('');

        const subtitle = sucId ? `Existencias en ${esc(sucName)}` : 'Vista consolidada (todas las sucursales)';

        aside.html(`
            <div class="px-4 py-3 border-b border-[var(--cs-border,#374151)] flex-shrink-0 flex items-center justify-between">
                <div>
                    <h3 class="text-sm font-bold text-white">Vista del Producto</h3>
                    <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)]" id="${opts.id}_subtitle">${subtitle}</p>
                </div>
                <button id="${opts.id}_close" class="text-[var(--cs-text-secondary,#D1D5DB)] hover:text-white transition-colors p-1" title="Cerrar">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            <div class="flex-1 overflow-y-auto cs-scroll px-4 py-3 space-y-3">
                <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-lg p-2 border border-[var(--cs-border,#374151)]">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-md ${p.iconBg} flex items-center justify-center ${p.iconText} flex-shrink-0">
                            <i data-lucide="cake" class="w-4 h-4"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-bold text-white truncate leading-tight">${esc(p.name)}</p>
                            <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] truncate">SKU: ${esc(p.sku)} · ${esc(p.categoria)}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-[var(--cs-border,#374151)]">
                        <div class="text-center leading-tight">
                            <p class="text-[8px] text-[var(--cs-text-muted,#9CA3AF)] uppercase">${esc(opts.labels.stock)}</p>
                            <p class="text-sm font-bold ${status.stockColor}">${stockVal}</p>
                        </div>
                        <div class="text-center leading-tight">
                            <p class="text-[8px] text-[var(--cs-text-muted,#9CA3AF)] uppercase">${esc(opts.labels.min)}</p>
                            <p class="text-sm font-bold text-white">${p.min}</p>
                        </div>
                        <div class="text-center leading-tight">
                            <p class="text-[8px] text-[var(--cs-text-muted,#9CA3AF)] uppercase">${esc(opts.labels.max)}</p>
                            <p class="text-sm font-bold text-white">${p.max}</p>
                        </div>
                    </div>
                </div>

                <div class="rounded-lg border ${statusPalette.border} ${statusPalette.bg} px-3 py-2 flex items-start gap-2">
                    <i data-lucide="${status.icon}" class="w-4 h-4 ${statusPalette.text} flex-shrink-0 mt-0.5"></i>
                    <div class="flex-1 min-w-0">
                        <strong class="block text-xs ${statusPalette.text}">Estado: ${esc(status.label)}</strong>
                        <p class="text-[10px] text-gray-400">${esc(status.msg)}</p>
                    </div>
                </div>

                ${tieneVida ? `
                <div class="rounded-lg border ${vidaPalette.border} ${vidaPalette.bg} px-3 py-2 flex items-start gap-2">
                    <i data-lucide="${vidaCfg.icon}" class="w-4 h-4 ${vidaPalette.text} flex-shrink-0 mt-0.5"></i>
                    <div class="flex-1 min-w-0">
                        <strong class="block text-xs ${vidaPalette.text}">${esc(opts.labels.vidaUtilLbl)}: ${esc(vidaCfg.label)} · ${esc(vidaText)}</strong>
                        <p class="text-[10px] text-gray-400">${esc(vidaCfg.msg)}</p>
                    </div>
                </div>` : ''}

                <div>
                    <div class="flex items-center justify-between mb-1.5">
                        <h4 class="text-[10px] font-semibold uppercase tracking-wider text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.existencias)}</h4>
                        <span class="text-[9px] text-gray-500">Total: ${(p.stockSuc && p.stockSuc[''] != null) ? p.stockSuc[''] : 0}</span>
                    </div>
                    <div class="space-y-1.5">${branchListHtml}</div>
                </div>

                <div>
                    <h4 class="text-[10px] font-semibold uppercase tracking-wider text-[var(--cs-text-muted,#9CA3AF)] mb-1.5">${esc(opts.labels.almacenes)}</h4>
                    <div class="flex flex-wrap gap-1.5">${almacenesHtml}</div>
                </div>

                <div>
                    <div class="flex items-center justify-between mb-1.5">
                        <h4 class="text-[10px] font-semibold uppercase tracking-wider text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.historial)}</h4>
                        <span class="text-[9px] text-gray-500">${movsToShow.length} de ${movsAll.length}${movsAll.length > 10 ? ' (ultimos 10)' : ''}</span>
                    </div>
                    <div class="space-y-1.5">${movsHtml || '<p class="text-[10px] text-gray-500 italic">Sin movimientos</p>'}</div>
                </div>
            </div>
        `);

        $(`#${opts.parent}`).html(aside);
        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}_close`).on('click', () => opts.onClose(p));
    }
}
