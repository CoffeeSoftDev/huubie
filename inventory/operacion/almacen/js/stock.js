let apiStock = 'ctrl/ctrl-stock.php';
let app, stock, stockView, stockPrediction, stockCount, ajustes;

let branch_id;

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
    stockView      = new StockView(apiStock, 'root');
    stock          = new Stock(apiStock, 'root');
    stockPrediction = new StockPrediction(apiStock, 'root');
    stockCount     = new StockCount(apiStock, 'root');
    ajustes        = new Ajustes(apiStock, 'root');
    app            = new App(apiStock, 'root');
    await app.init();
});

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSStock';
        this.subId        = null;
        this.selectedId   = null;
        this.ajustesReady = false;
    }

    async init() {
        const r = await useFetch({ url: apiStock, data: { opc: 'init' } });
        if (r && r.status === 200) {
            this.dataInit = {
                branch_id: r.branch_id || '',
                sucursales:      r.sucursales      || [],
                categorias:      r.categorias      || [],
                areas:           r.areas           || [],
                estadosAjuste:   r.estados_ajuste  || [],
                niveles:         NIVELES_STOCK
            };
        } else {
            this.dataInit = {
                branch_id: '',
                sucursales:      [],
                categorias:      [],
                areas:           [],
                estadosAjuste:   [],
                niveles:         NIVELES_STOCK
            };
        }
        this.subId      = this.dataInit.branch_id;
        branch_id = this.subId;

        this.render();
    }

    render() {
        this.layout();
        this.resizePanel();
        this.renderTabs();
        this.filterBar();
        stockView.renderDetail(null);
        this.populateFilters();
        this.renderHeader();
        stock.lsStock();
        stock.lsKpis();
    }

    renderHeader() {
        const branchVal  = $('#branch_id').val() || '';
        const branchName = $('#branch_id option:selected').text() || '';

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const titleHtml = (branchVal && branchName)
            ? `Visor de Stock <span class="font-bold" style="color:rgb(var(--brand-600, 192 90 64));">· ${esc(branchName)}</span>`
            : 'Visor de Stock';

        stockView.renderHeader({
            title:     'Visor de Stock',
            titleHtml: titleHtml,
            subtitle:  'Control de existencias por sucursal, categoria y nivel',
            // back:      { href: 'index.php', title: 'Regresar al inicio' }
        });
    }

    renderTabs() {
        this.tabLayout({
            parent:          'tabsRow',
            id:              'tabsStock',
            type:            'short',
            theme:           'light',
            renderContainer: false,
            json: [
                {
                    id:     'stock',
                    tab:    'Stock actual',
                    active: true
                },
                {
                    id:     'ajustes',
                    tab:    'Ajustes'
                }
            ],
            onChange: (tabId) => this.onChangeTab(tabId)
        });
    }

    onChangeTab(tabId) {
        const isAjustes = tabId === 'ajustes';

        if (isAjustes && this.selectedId) this.selectProduct(null);

        $('#filterBar, #kpisRow, #tableWrap, #detailPanel').toggleClass('hidden', isAjustes);
        $('#detailResizer').css('display', isAjustes ? 'none' : '');
        $('#filterBarAjustes, #containerAjustes').toggleClass('hidden', !isAjustes);

        if (!isAjustes) return;

        if (this.ajustesReady) {
            ajustes.lsAjustes();
            return;
        }
        this.ajustesReady = true;
        ajustes.render();
    }

    layout() {

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
                    id:    'tabsRow',
                    class: 'px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0'
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
                },
                {
                    id:    'filterBarAjustes',
                    class: 'hidden px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'containerAjustes',
                    class: 'hidden p-3 flex-1 min-h-0 overflow-auto bg-white'
                }
            ]
        };

        // Tirador entre la tabla y el visor: el ancho del visor vive en --stock-detail-w.
        const detailResizer = {
            type:  'div',
            id:    'detailResizer',
            class: "hidden md:block relative z-[5] flex-shrink-0 w-[6px] -mx-[3px] cursor-col-resize touch-none after:content-[''] after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:-translate-x-1/2 after:rounded-full after:transition-colors hover:after:bg-gray-400"
        };

        const detailPanel = {
            type: 'aside',
            id:   'detailPanel',
            class:'detail-drawer fixed inset-y-0 right-0 z-50 w-full max-w-md transform translate-x-full transition-transform duration-300 ease-out md:relative md:translate-x-0 md:w-[var(--stock-detail-w,420px)] md:max-w-[60vw] md:transition-none md:z-auto flex-shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col overflow-hidden shadow-2xl md:shadow-none',
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
                container: [mainPanel, detailResizer, detailPanel, backdrop]
            }
        });

        $('#detailBackdrop').off('click').on('click', () => this.selectProduct(null));
    }

    // Arrastrar el tirador cambia el ancho del visor y la tabla toma el resto.
    resizePanel() {
        const handle = document.getElementById('detailResizer');
        const panel  = document.getElementById('detailPanel');
        if (!handle || !panel) return;

        this.applyPanelWidth(this.savedPanelWidth() || 420, false);
        handle.setAttribute('role', 'separator');
        handle.setAttribute('aria-orientation', 'vertical');
        handle.setAttribute('aria-label', 'Ancho del visor del producto');

        const move = (e) => this.applyPanelWidth(panel.getBoundingClientRect().right - e.clientX, false);

        handle.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;

            e.preventDefault();
            handle.setPointerCapture(e.pointerId);
            handle.classList.add('after:bg-blue-600');
            document.body.style.cursor     = 'col-resize';
            document.body.style.userSelect = 'none';

            const release = () => {
                handle.classList.remove('after:bg-blue-600');
                document.body.style.cursor     = '';
                document.body.style.userSelect = '';
                handle.removeEventListener('pointermove', move);
                this.applyPanelWidth(panel.getBoundingClientRect().width, true);
            };

            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', release, { once: true });
            handle.addEventListener('pointercancel', release, { once: true });
        });
    }

    applyPanelWidth(px, save) {
        const width = Math.round(Math.min(760, Math.max(300, px)));
        document.documentElement.style.setProperty('--stock-detail-w', `${width}px`);

        if (!save) return;
        try {
            localStorage.setItem('inventory:stock:detailWidth', width);
        } catch (e) { }
    }

    savedPanelWidth() {
        try {
            const px = Number(localStorage.getItem('inventory:stock:detailWidth'));
            return px > 0 ? px : null;
        } catch (e) {
            return null;
        }
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
                id:       'branch_id',
                lbl:      'Sucursal:',
                class:    'col-12 col-md-4 col-lg-2',
                onchange: 'app.onChangeSucursal()',
                value:    '',
                data:     [{ id: '', valor: 'Todas las sucursales' }]
            },
            {
                opc:      'select',
                id:       'fCategoria',
                lbl:      'Categoria:',
                class:    'col-12 col-md-4 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     [{ id: '', valor: 'Todas las categorias' }].concat(this.dataInit.categorias || [])
            },
            {
                opc:      'select',
                id:       'fArea',
                lbl:      'Área:',
                class:    'col-12 col-md-4 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     [{ id: '', valor: 'Todas las áreas' }].concat(this.dataInit.areas || [])
            },
            {
                opc:      'select',
                id:       'fNivel',
                lbl:      'Nivel:',
                class:    'col-12 col-md-4 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     NIVELES_STOCK
            },
            {
                opc:      'select',
                id:       'fMovimiento',
                lbl:      'Movimientos:',
                class:    'col-12 col-md-4 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    'con',
                data:     MOVIMIENTOS_STOCK
            },
            {
                opc:       'button',
                id:        'btnConteoFisico',
                text:      'Conteo físico',
                icon:      'icon-clipboard',
                className: 'w-100',
                class:     'col-12 col-md-4 col-lg-2',
                color_btn: 'primary',
                onClick:   () => stockCount.addConteo()
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
            this.populateSelect('branch_id', sucursales);
            $('#branch_id').val(this.subId);
            if (sucursales.length <= 1) {
                $('#branch_id').find('option[value=""]').remove();
                $('#branch_id').val(this.subId).prop('disabled', true);
            }
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
            branch_id: $('#branch_id').val() || this.subId || '',
            categoria:       $('#fCategoria').val()     || '',
            area:            $('#fArea').val()          || '',
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
        this.renderHeader();
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
                branch_id: f.branch_id,
                category_id:     f.categoria,
                area_id:         f.area,
                nivel:           f.nivel,
                movimiento:      f.movimiento,
                q:               f.q
            },
            attr: {
                id:           `tb${this.PROJECT_NAME}`,
                theme:        'light',
                striped:      true,
                f_size:       12,
                center:       [3, 7, 8, 9],
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
                opc:         'showStock',
                branch_id:   f.branch_id,
                category_id: f.categoria,
                area_id:     f.area,
                movimiento:  f.movimiento,
                q:           f.q
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
            stockPrediction.render(id);
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
            sucursalId:  $('#branch_id').val() || '',
            sucursalName: $('#branch_id option:selected').text() || 'Todas las sucursales',
            sucursales:  sucursalesReales.length ? sucursalesReales : undefined,
            onClose:     () => app.selectProduct(null)
        });
    }

    renderInfoCards(rows) {
        this.kpisRow({
            parent:  'kpisRow',
            json:    rows,
            cols:5,
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
                btnActive:'demo-toggle active px-2.5 py-1 rounded text-[11px] border border-violet-400 bg-violet-50 text-violet-700',
                sep:      'text-gray-300',
                backBtn:  'w-8 h-8 rounded-full bg-gray-100 hover:bg-violet-50 border border-gray-200 hover:border-violet-400 flex items-center justify-center text-gray-500 hover:text-violet-700 transition-colors flex-shrink-0'
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
                info:    'var(--cs-info,rgb(var(--brand-600, 192 90 64)))',
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
                tab:       'px-3 py-2 text-[11px] font-medium text-gray-500 border-b-2 border-transparent hover:text-gray-800 transition-colors cursor-pointer',
                tabActive: 'px-3 py-2 text-[11px] font-bold text-violet-600 border-b-2 border-violet-600 cursor-pointer'
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

    // Modal del conteo fisico con el diseno de templates/stock/stock-v2.html:
    // encabezado, pestanas + conteo ciego, aviso, hoja y pie con resumen y acciones.
    countModal(options) {
        const defaults = {
            id:       'mdlConteo',
            title:    'Conteo físico',
            subtitle: '',
            badge:    '',
            info:     { tone: 'gray', text: '' },
            blind:    { checked: false, disabled: false },
            actions:  [],
            onBlind:  () => { },
            onClose:  () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.info  = Object.assign({}, defaults.info,  o.info  || {});
        opts.blind = Object.assign({}, defaults.blind, o.blind || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const infoTone = {
            gray:    { cls: 'text-gray-500',    icon: 'info'           },
            blue:    { cls: 'text-blue-600 font-medium', icon: 'pencil-line' },
            emerald: { cls: 'text-emerald-700', icon: 'check-circle-2' }
        }[opts.info.tone] || { cls: 'text-gray-500', icon: 'info' };

        const btnKind = {
            primary:   'h-9 px-[12px] rounded-md bg-main hover:bg-main-hover text-[12px] font-semibold text-white inline-flex items-center gap-1.5',
            secondary: 'h-9 px-[12px] rounded-md border border-gray-300 bg-white text-[12px] font-semibold text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5',
            ghost:     'h-9 px-[12px] rounded-md text-[12px] font-medium text-gray-500 hover:text-rose-600 hover:bg-white inline-flex items-center gap-1.5'
        };

        const actionsHtml = opts.actions.map(a => `
            <button type="button" id="${esc(a.id)}" class="${btnKind[a.kind] || btnKind.secondary}">
                ${a.icon ? `<i data-lucide="${esc(a.icon)}" class="w-4 h-4"></i>` : ''}${esc(a.text)}
            </button>`).join('');

        const modal = $('<div>', { id: opts.id, class: 'fixed inset-0 z-[1050] bg-black/40 flex items-center justify-center p-[12px]' });

        modal.html(`
            <div class="bg-white rounded-xl shadow-2xl w-[1024px] max-w-full h-[88vh] flex flex-col overflow-hidden">
                <div class="flex items-start justify-between gap-3 px-[20px] py-[16px] border-b border-gray-200">
                    <div>
                        <h2 class="text-base font-bold text-gray-800 flex items-center gap-2">
                            <i data-lucide="clipboard-check" class="w-5 h-5 text-blue-600"></i>${esc(opts.title)}${opts.badge}
                        </h2>
                        <p class="text-[11px] text-gray-500 mt-0.5">${esc(opts.subtitle)}</p>
                    </div>
                    <button type="button" data-count-close class="p-1 text-gray-500 hover:text-gray-800"><i data-lucide="x" class="w-5 h-5"></i></button>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-3 px-[20px] py-[10px] border-b border-gray-200">
                    <div id="${opts.id}Tabs" class="min-w-0 max-w-full"></div>
                    <label class="inline-flex items-center gap-2 text-[11px] ${opts.blind.disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 cursor-pointer'} select-none">
                        <input id="${opts.id}Blind" type="checkbox" class="w-3.5 h-3.5 accent-blue-600" ${opts.blind.checked ? 'checked' : ''} ${opts.blind.disabled ? 'disabled' : ''}>
                        Conteo ciego <span class="text-gray-400">(oculta lo que dice el sistema)</span>
                    </label>
                </div>

                <div class="px-[20px] py-2 text-[10px] flex items-center gap-1.5 ${infoTone.cls}">
                    <i data-lucide="${infoTone.icon}" class="w-3 h-3 flex-shrink-0"></i>${esc(opts.info.text)}
                </div>

                <div id="${opts.id}Table" class="flex-1 min-h-0 overflow-auto px-[20px]"></div>

                <div class="flex flex-wrap items-center justify-between gap-3 px-[20px] py-[12px] border-t border-gray-200 bg-gray-50">
                    <div id="${opts.id}Summary" class="flex flex-wrap items-center gap-4 text-[10px] text-gray-600"></div>
                    <div class="flex items-center gap-2">${actionsHtml}</div>
                </div>
            </div>
        `);

        $(`#${opts.id}`).remove();
        $('body').append(modal);
        if (window.lucide) lucide.createIcons();

        const close = () => {
            $(document).off('keydown.countModal');
            modal.remove();
            opts.onClose();
        };

        modal.on('click', '[data-count-close]', close);
        modal.on('change', `#${opts.id}Blind`, () => opts.onBlind());
        opts.actions.forEach(a => modal.on('click', `#${a.id}`, () => a.onClick()));
        $(document).on('keydown.countModal', (e) => { if (e.key === 'Escape' && !$('[id^="alertBox_"]').length) close(); });

        const setSummary = (s) => {
            const pendientes = s.total - s.counted;
            const net        = Number(s.net || 0);
            const money      = '$' + Math.abs(net).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            $(`#${opts.id}Summary`).html(`
                <span><b class="text-gray-900">${s.counted}</b> de ${s.total} contados</span>
                <span class="${pendientes > 0 ? 'text-gray-500' : 'text-emerald-700'}">${pendientes} pendientes</span>
                ${s.blind ? '<span class="text-gray-400">Diferencias ocultas (conteo ciego)</span>' : `
                <span><b class="text-gray-900">${s.differences}</b> con diferencia</span>
                <span>Ajuste neto: <b class="${net < 0 ? 'text-rose-600' : 'text-sky-700'}">${net < 0 ? '-' : '+'}${money}</b></span>`}
            `);
        };

        return { el: modal, close, setSummary };
    }

    aiPredictionCard(options) {
        const defaults = {
            parent:           'aiPrediction',
            id:               'aiPredictionCard',
            state:            'loading',
            iaOk:             true,
            iaMsg:            '',
            dias:             0,
            reorden:          0,
            resumen:          '',
            tendencia:        [],
            tendenciaDelta:   null,
            proyeccion:       [],
            stockActual:      0,
            stockMin:         0,
            entradaColor:     '#3FC189',
            salidaColor:      'rgb(var(--brand-600, 192 90 64))',
            historicoColor:   '#94A3B8',
            proyeccionColor:  '#475569',
            minLineColor:     '#CBD5E1',
            errorMsg:         'No se pudo obtener la prediccion.',
            accentColor:      '#475569',
            accentBg:         'bg-slate-50',
            accentBorder:     'border-slate-200',
            accentText:       'text-slate-800',
            accentSubtext:    'text-slate-600'
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        let inner = '';

        if (opts.state === 'loading') {
            inner = `
                <div class="flex items-center gap-2 py-1">
                    <svg class="animate-spin w-4 h-4 flex-shrink-0" style="color:${opts.accentColor};" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                    <span class="text-[11px] ${opts.accentSubtext}">Analizando patron...</span>
                </div>
            `;
        } else if (opts.state === 'error') {
            inner = `
                <div class="flex items-center gap-2">
                    <i data-lucide="alert-circle" class="w-4 h-4 flex-shrink-0 ${opts.accentSubtext}"></i>
                    <p class="text-[11px] ${opts.accentSubtext}">${esc(opts.errorMsg)}</p>
                </div>
            `;
        } else if (opts.iaOk) {
            const diasHtml   = `<strong class="font-bold" style="color:${opts.accentColor};">${esc(opts.dias)} dias</strong>`;
            const reordHtml  = `<strong class="font-bold" style="color:${opts.accentColor};">${esc(opts.reorden)} unidades</strong>`;

            inner = `
                <p class="text-[11px] ${opts.accentText} leading-relaxed">
                    Al ritmo actual, el stock se agotara en ~${diasHtml}.
                    Sugerimos reorden de ${reordHtml}.
                </p>
                ${opts.resumen ? `<p class="text-[10px] ${opts.accentSubtext} mt-1 leading-relaxed">${esc(opts.resumen)}</p>` : ''}
            `;
        } else {
            // IA no disponible: mostramos solo la tendencia real (grafico abajo).
            inner = `
                <p class="text-[11px] ${opts.accentSubtext} leading-relaxed flex items-start gap-1.5">
                    <i data-lucide="info" class="w-3.5 h-3.5 flex-shrink-0 mt-0.5"></i>
                    <span>${esc(opts.iaMsg || 'Recomendacion IA no disponible.')} Mostramos el comportamiento real.</span>
                </p>
            `;
        }

        // Grafico de proyeccion: curva de stock acumulado, dos trazos SVG
        // (historico solido + proyeccion 7d con marcadores circulares). Funciona
        // sin IA: cuando la IA no responde seguimos dibujando el forecast con
        // datos reales. Estado vacio explicito cuando no hubo movimientos.
        let chartHtml = '';
        if (opts.state === 'ready' && Array.isArray(opts.tendencia) && opts.tendencia.length) {
            const d = opts.tendenciaDelta;
            let deltaHtml;
            if (d === null || d === undefined) {
                deltaHtml = `<span class="text-[9px] text-gray-400">Sin histórico previo</span>`;
            } else if (d >= 0) {
                deltaHtml = `<span class="text-[9px] font-bold text-emerald-600">+${esc(d)}% vs semana anterior</span>`;
            } else {
                deltaHtml = `<span class="text-[9px] font-bold text-rose-600">${esc(d)}% vs semana anterior</span>`;
            }

            // Reconstruimos la curva de stock retrocediendo desde hoy.
            // Recorremos del mas reciente al mas antiguo: hoy = stockActual;
            // dia anterior = stock_ayer = stock_hoy + (entrada_hoy - salida_hoy).
            const stockActualNum = Number(opts.stockActual) || 0;
            const serieRev = [];
            let stockRev = stockActualNum;
            for (let i = opts.tendencia.length - 1; i >= 0; i--) {
                const t = opts.tendencia[i];
                serieRev.push({ dia: t.dia, fecha: t.fecha, stock: stockRev });
                // stock del dia anterior: si hoy entraron X y salieron Y,
                // ayer habia (stock_hoy - X + Y) unidades. En otras palabras,
                // restamos el delta (entrada - salida) que se movio entre
                // aquel dia y hoy.
                const mov = (Number(t.entrada) || 0) - (Number(t.salida) || 0);
                stockRev = stockRev - mov;
            }
            const serieHistFinal = serieRev.reverse();

            // Serie proyectada: la entrega el backend (proyeccion_stock) o
            // construimos en el cliente si no viene. Cada punto es stock
            // proyectado en dia futuro.
            const proy = Array.isArray(opts.proyeccion) ? opts.proyeccion : [];

            // Si no hay historico real con stock y tampoco proyeccion, vacio.
            const sumAll = opts.tendencia.reduce(
                (acc, t) => acc + (Number(t.entrada) || 0) + (Number(t.salida) || 0), 0
            );

            let bodyHtml;
            if (sumAll <= 0 && proy.length === 0) {
                bodyHtml = `
                    <div class="flex flex-col items-center justify-center h-16 text-center">
                        <i data-lucide="bar-chart-2" class="w-4 h-4 text-gray-300 mb-1"></i>
                        <span class="text-[9px] text-gray-400">Sin movimientos en los últimos 7 días</span>
                    </div>`;
            } else {
                // Calculo de coordenadas SVG.
                // - Eje X: 7 puntos historicos + 7 puntos proyectados = 14.
                //   Reservamos un pequeno margen a la izquierda para la etiqueta
                //   "mín" y a la derecha para etiquetas futuras.
                // - Eje Y: stock en unidades. Si todos los valores son 0,
                //   usamos un minimo artificial para que la linea se vea.
                const w = 280, h = 70;
                const padL = 6, padR = 6, padT = 6, padB = 14;
                const innerW = w - padL - padR;
                const innerH = h - padT - padB;

                const puntosAll = [
                    ...serieHistFinal.map(p => p.stock),
                    ...proy.map(p => Number(p.stock) || 0)
                ];
                let yMin = Math.min(...puntosAll);
                let yMax = Math.max(...puntosAll);
                // Si el rango es 0 (stock plano) o casi, fijamos un minimo.
                if (yMax - yMin < 1) {
                    yMin = Math.max(0, yMax - 1);
                    yMax = yMax + 1;
                }
                // Margen extra arriba y abajo del 10% para que la linea no
                // toque los bordes.
                const yPad = (yMax - yMin) * 0.1 || 0.5;
                yMin = Math.max(0, yMin - yPad);
                yMax = yMax + yPad;

                const totalPuntos = 14;
                const xStep = innerW / (totalPuntos - 1);

                const toX = (i) => padL + i * xStep;
                const toY = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;

                // Polilinea historica (7 puntos, indices 0..6).
                const histPts = serieHistFinal.map((p, i) => `${toX(i).toFixed(1)},${toY(p.stock).toFixed(1)}`).join(' ');
                // Polilinea proyectada: arranca en el ultimo historico (i=6) y
                // avanza 7 puntos mas (i=7..13).
                const proyPts = proy.map((p, j) => {
                    const i = 6 + (j + 1);
                    return `${toX(i).toFixed(1)},${toY(Number(p.stock) || 0).toFixed(1)}`;
                });
                const proyPtsStr = `${toX(6).toFixed(1)},${toY(serieHistFinal[serieHistFinal.length - 1].stock).toFixed(1)} ${proyPts.join(' ')}`;

                // Marcadores circulares para cada punto proyectado.
                const markers = proy.map((p, j) => {
                    const i = 6 + (j + 1);
                    return `<circle cx="${toX(i).toFixed(1)}" cy="${toY(Number(p.stock) || 0).toFixed(1)}" r="2.5" fill="${opts.proyeccionColor}" stroke="white" stroke-width="0.8" />`;
                }).join('');

                // Etiqueta "IA" sobre el primer marcador proyectado.
                let iaLabel = '';
                if (proy.length > 0) {
                    const iaLabelX = toX(7);
                    const iaLabelY = toY(Number(proy[0].stock) || 0) - 5;
                    iaLabel = `<text x="${iaLabelX.toFixed(1)}" y="${iaLabelY.toFixed(1)}" font-size="7" font-weight="700" fill="${opts.proyeccionColor}" text-anchor="middle" font-family="ui-sans-serif, system-ui">IA</text>`;
                }

                // Linea de stock minimo (si hay dato).
                let minLine = '';
                if (Number(opts.stockMin) > 0 && Number(opts.stockMin) >= yMin && Number(opts.stockMin) <= yMax) {
                    const minY = toY(Number(opts.stockMin));
                    minLine = `
                        <line x1="${padL}" y1="${minY.toFixed(1)}" x2="${(w - padR).toFixed(1)}" y2="${minY.toFixed(1)}"
                              stroke="${opts.minLineColor}" stroke-width="0.8" stroke-dasharray="2,2" />
                        <text x="${(w - padR - 2).toFixed(1)}" y="${(minY - 2).toFixed(1)}" font-size="6" fill="${opts.minLineColor}" text-anchor="end" font-family="ui-sans-serif, system-ui">mín</text>
                    `;
                }

                // Eje X inferior.
                const xAxisY = (h - padB + 4).toFixed(1);
                const xAxis = `<line x1="${padL}" y1="${xAxisY}" x2="${(w - padR).toFixed(1)}" y2="${xAxisY}" stroke="#E2E8F0" stroke-width="0.6" />`;

                // Etiquetas de dias en X: H-6, H-5, ..., H0, +1, ..., +7.
                // Usamos la letra del dia (L/M/M/J/V/S/D) en su lugar para
                // menos ruido. Las futuras llevan prefijo "+".
                const xLabels = serieHistFinal.map((p, i) => {
                    const x = toX(i);
                    const label = i === serieHistFinal.length - 1 ? 'Hoy' : p.dia;
                    return `<text x="${x.toFixed(1)}" y="${(h - 2).toFixed(1)}" font-size="6" fill="#94A3B8" text-anchor="middle" font-family="ui-sans-serif, system-ui">${esc(label)}</text>`;
                }).join('');
                const xLabelsProy = proy.map((p, j) => {
                    const i = 6 + (j + 1);
                    return `<text x="${toX(i).toFixed(1)}" y="${(h - 2).toFixed(1)}" font-size="6" fill="${opts.proyeccionColor}" text-anchor="middle" font-weight="600" font-family="ui-sans-serif, system-ui">+${p.offset}</text>`;
                }).join('');

                const svg = `
                    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="w-full h-16 block" xmlns="http://www.w3.org/2000/svg">
                        ${minLine}
                        ${xAxis}
                        <polyline points="${histPts}" fill="none" stroke="${opts.historicoColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                        <polyline points="${proyPtsStr}" fill="none" stroke="${opts.proyeccionColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                        ${markers}
                        ${iaLabel}
                        ${xLabels}
                        ${xLabelsProy}
                    </svg>
                `;

                bodyHtml = `<div class="mt-1">${svg}</div>`;
            }

            // Leyenda: Historico / Proyeccion / Stock min (condicional).
            const minLegend = Number(opts.stockMin) > 0
                ? `<span class="flex items-center gap-1 text-[8px] text-gray-500">
                        <span class="w-3 h-0.5" style="background:${opts.minLineColor};border-top:1px dashed ${opts.minLineColor};"></span>Stock mín
                    </span>`
                : '';
            const legendHtml = `
                <div class="flex items-center gap-3 mt-1.5">
                    <span class="flex items-center gap-1 text-[8px] text-gray-500">
                        <span class="w-2 h-0.5 rounded-full" style="background:${opts.historicoColor};"></span>Histórico
                    </span>
                    <span class="flex items-center gap-1 text-[8px] text-gray-500">
                        <span class="w-2 h-2 rounded-full" style="background:${opts.proyeccionColor};"></span>Proyección IA
                    </span>
                    ${minLegend}
                </div>`;

            chartHtml = `
                <div class="mt-2.5 pt-2.5 border-t" style="border-color:rgba(148,163,184,0.25);">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-[9px] font-bold uppercase tracking-wider text-slate-500">Proyección IA · Stock 7 días</span>
                        ${deltaHtml}
                    </div>
                    ${bodyHtml}
                    ${legendHtml}
                </div>
            `;
        }

        const card = `
            <div id="${opts.id}" class="rounded-lg border ${opts.accentBorder} ${opts.accentBg} px-3 py-2.5">
                <div class="flex items-center gap-2 mb-2">
                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0"
                          style="background:rgba(71,85,105,0.12);">
                        <i data-lucide="lightbulb" class="w-3.5 h-3.5" style="color:${opts.accentColor};"></i>
                    </span>
                    <span class="text-[11px] font-bold ${opts.accentText} uppercase tracking-wide">Prediccion IA</span>
                </div>
                ${inner}
                ${chartHtml}
            </div>
        `;

        $(`#${opts.parent}`).html(card);
        if (window.lucide) lucide.createIcons();
    }

    productDetailPanel(options) {
        const defaults = {
            parent:       'root',
            id:           'productDetailPanel',
            class:        'w-full h-full flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden',
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
                ok:      { palette: 'emerald', icon: 'check-circle-2', label: 'Stock OK',   msg: 'Nivel saludable, dentro del rango optimo.',                stockColor: 'text-emerald-600' },
                bajo:    { palette: 'orange',  icon: 'alert-triangle', label: 'Stock Bajo', msg: 'El nivel actual esta por debajo del minimo recomendado.', stockColor: 'text-orange-600'  },
                agotado: { palette: 'rose',    icon: 'x-circle',       label: 'Agotado',    msg: 'No hay existencias disponibles.',                          stockColor: 'text-rose-600'    }
            },
            statusPalettes: {
                emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
                orange:  { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700'  },
                rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700'    }
            },
            vidaMap: {
                critico: { palette: 'rose',    icon: 'alert-octagon', label: 'Critica',   msg: 'Caducidad inminente, prioriza la rotacion.' },
                proximo: { palette: 'amber',   icon: 'clock',         label: 'Proxima',   msg: 'Cercano a su fecha de caducidad.'           },
                ok:      { palette: 'emerald', icon: 'leaf',          label: 'Saludable', msg: 'Vida util dentro del rango optimo.'         },
                na:      { palette: 'slate',   icon: 'minus',         label: 'No aplica', msg: 'Producto sin vida util registrada.'         }
            },
            vidaPalettes: {
                rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700'    },
                amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700'   },
                emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
                slate:   { bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-600'   }
            },
            movMap: {
                in:     { bg: 'bg-green-100',  iconColor: 'text-green-600',  icon: 'arrow-down',  qtyColor: 'text-green-600'  },
                out:    { bg: 'bg-red-100',    iconColor: 'text-red-600',    icon: 'arrow-up',    qtyColor: 'text-red-600'    },
                tr:     { bg: 'bg-purple-100', iconColor: 'text-purple-600', icon: 'repeat',      qtyColor: 'text-purple-600' },
                adjust: { bg: 'bg-orange-100', iconColor: 'text-orange-600', icon: 'settings-2',  qtyColor: 'text-orange-600' }
            },
            movFilter: {
                btn:         'px-2 py-0.5 rounded text-[10px] font-medium text-gray-500 whitespace-nowrap hover:bg-gray-100 transition-colors',
                btnActive:   'px-2 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap transition-colors',
                activeStyle: 'background:rgb(var(--brand-600, 192 90 64));',
                labels: { todos: 'Todos', in: '+ Entradas', out: '- Salidas' }
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
        opts.movFilter      = Object.assign({}, defaults.movFilter,      o.movFilter      || {});
        opts.movFilter.labels = Object.assign({}, defaults.movFilter.labels, (o.movFilter || {}).labels || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const aside = $('<aside>', { id: opts.id, class: opts.class });

        if (!opts.json) {
            aside.html(`
                <div class="px-4 py-3 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-bold text-gray-800">Vista del Producto</h3>
                        <p class="text-[10px] text-gray-500">${esc(opts.labels.comportLbl)}</p>
                    </div>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6">
                    <div class="w-14 h-14 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center mb-3">
                        <i data-lucide="package-search" class="w-6 h-6 text-gray-500"></i>
                    </div>
                    <p class="text-[11px] text-gray-500">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-[10px] text-gray-500 mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
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

        const stockColor = (q) => q <= 0 ? 'text-red-600' : (q < p.min ? 'text-orange-600' : 'text-green-600');

        const branchListHtml = (opts.sucursales || []).map(s => {
            const q      = (p.stockSuc || {})[s.id] != null ? p.stockSuc[s.id] : 0;
            const active = sucId === s.id ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-gray-50';
            return `
                <div class="flex items-center justify-between rounded-md px-2.5 py-1.5 border ${active}">
                    <div class="flex items-center gap-2">
                        <i data-lucide="store" class="w-5 h-5 ${q <= 0 ? 'text-gray-400' : 'text-violet-500'}"></i>
                        <span class="text-[11px] ${q <= 0 ? 'text-gray-400' : 'text-gray-800'}">${esc(s.name)}</span>
                    </div>
                    <span class="text-[11px] font-bold ${stockColor(q)}">${q}</span>
                </div>`;
        }).join('');

        const almTone = {
            info:   { bg: 'rgb(var(--brand-600, 192 90 64) /0.15)',  fg: 'rgb(var(--brand-600, 192 90 64))' },
            purple: { bg: 'rgba(124,58,237,0.15)',  fg: '#A78BFA' }
        };
        const almacenesHtml = (p.almacenes || []).map(a => {
            const t = almTone[a.type] || almTone.info;
            return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background:${t.bg};color:${t.fg};">
                <i data-lucide="warehouse" class="w-2.5 h-2.5 mr-1 inline"></i>${esc(a.name)}
            </span>`;
        }).join('');

        const movsAll = p.movs || [];

        // Direccion del movimiento: por tipo explicito y, si no, por el signo del qty.
        const movDir = (m) => {
            if (m.type === 'in')  return 'in';
            if (m.type === 'out') return 'out';
            const q = String(m.qty == null ? '' : m.qty).trim();
            return q.charAt(0) === '-' ? 'out' : 'in';
        };

        const movItemHtml = (m) => {
            const cfg = opts.movMap[m.type] || opts.movMap.adjust;
            const tieneStock = m.prev != null && m.post != null;
            const stockTrace = tieneStock ? `
                        <p class="text-[9px] text-gray-500 mt-0.5 flex items-center gap-1">
                            <span>Antes: <strong class="text-gray-700">${esc(m.prev)}</strong></span>
                            <i data-lucide="arrow-right" class="w-2.5 h-2.5 text-gray-400"></i>
                            <span>Quedo: <strong class="text-gray-700">${esc(m.post)}</strong></span>
                        </p>` : '';
            const sucursalTrace = m.branch ? `
                        <p class="text-[9px] text-gray-500 mt-0.5 flex items-center gap-1">
                            <i data-lucide="store" class="w-2.5 h-2.5 text-violet-500"></i>
                            <span>${esc(m.branch)}</span>
                        </p>` : '';
            return `
                <div class="flex items-start gap-2 bg-gray-50 rounded-md px-2.5 py-1.5 border border-gray-200">
                    <div class="w-5 h-5 rounded ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5">
                        <i data-lucide="${cfg.icon}" class="w-2.5 h-2.5 ${cfg.iconColor}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                            <p class="text-[10px] font-medium text-gray-800">${esc(m.label)}</p>
                            <span class="text-[10px] font-bold ${cfg.qtyColor}">${esc(m.qty)}</span>
                        </div>
                        <p class="text-[9px] text-gray-500">${esc(m.when)}</p>
                        ${sucursalTrace}
                        ${stockTrace}
                    </div>
                </div>`;
        };

        const renderMovs = (filter) => {
            let list = movsAll;
            if (filter === 'in')  list = movsAll.filter(m => movDir(m) === 'in');
            if (filter === 'out') list = movsAll.filter(m => movDir(m) === 'out');
            const toShow = list.slice(0, 10);
            return toShow.map(movItemHtml).join('')
                || '<p class="text-[10px] text-gray-500 italic">Sin movimientos</p>';
        };

        const subtitle = sucId ? `Existencias en ${esc(sucName)}` : 'Vista consolidada (todas las sucursales)';

        aside.html(`
            <div class="px-4 py-3 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
                <div>
                    <h3 class="text-sm font-bold text-gray-800">Vista del Producto</h3>
                    <p class="text-[10px] text-gray-500" id="${opts.id}_subtitle">${subtitle}</p>
                </div>
                <button id="${opts.id}_close" class="text-gray-600 hover:text-gray-800 transition-colors p-1" title="Cerrar">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            <div class="flex-1 overflow-y-auto cs-scroll px-4 py-3 space-y-3">
                <div class="bg-gray-50 rounded-lg p-2 border border-gray-200">
                    <div class="flex items-center gap-2">
                        ${p.image ? `
                        <a href="${esc(inventoryFileUrl(p.image))}" target="_blank" rel="noopener" title="Ver foto" class="w-12 h-12 rounded-md bg-gray-100 overflow-hidden flex-shrink-0 ring-1 ring-black/5 hover:ring-2 hover:ring-blue-400/60 transition">
                            <img src="${esc(inventoryFileUrl(p.image))}" alt="${esc(p.name)}" class="w-full h-full object-cover">
                        </a>` : `
                        <div class="w-8 h-8 rounded-md ${p.iconBg} flex items-center justify-center ${p.iconText} flex-shrink-0">
                            <i data-lucide="package" class="w-4 h-4"></i>
                        </div>`}
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-bold text-gray-800 truncate leading-tight">${esc(p.name)}</p>
                            <p class="text-[9px] text-gray-500 truncate">SKU: ${esc(p.sku)} · ${esc(p.categoria)}</p>
                        </div>
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${statusPalette.border} ${statusPalette.bg} ${statusPalette.text} text-[10px] font-bold flex-shrink-0">
                            <i data-lucide="${status.icon}" class="w-3 h-3"></i>${esc(status.label)}
                        </span>
                    </div>
                    <div class="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-gray-200">
                        <div class="text-center leading-tight">
                            <p class="text-[8px] text-gray-500 uppercase">${esc(opts.labels.stock)}</p>
                            <p class="text-sm font-bold ${status.stockColor}">${stockVal}</p>
                        </div>
                        <div class="text-center leading-tight">
                            <p class="text-[8px] text-gray-500 uppercase">${esc(opts.labels.min)}</p>
                            <p class="text-sm font-bold text-gray-800">${p.min}</p>
                        </div>
                        <div class="text-center leading-tight">
                            <p class="text-[8px] text-gray-500 uppercase">${esc(opts.labels.max)}</p>
                            <p class="text-sm font-bold text-gray-800">${p.max}</p>
                        </div>
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

                <div id="aiPrediction"></div>

                <div>
                    <div class="flex items-center justify-between mb-1.5">
                        <h4 class="text-xs font-semibold uppercase tracking-wider text-gray-500 leading-tight">${esc(opts.labels.existencias)}</h4>
                        <span class="text-[9px] text-gray-500">Total: ${(p.stockSuc && p.stockSuc[''] != null) ? p.stockSuc[''] : 0}</span>
                    </div>
                    <div class="space-y-1.5">${branchListHtml}</div>
                </div>

                <div>
                    <h4 class="text-xs font-semibold uppercase tracking-wider text-gray-500 leading-tight mb-1.5">${esc(opts.labels.almacenes)}</h4>
                    <div class="flex flex-wrap gap-1.5">${almacenesHtml}</div>
                </div>

                <div>
                    <div class="flex items-center justify-between mb-2 gap-2">
                        <h4 class="text-xs font-semibold uppercase tracking-wider text-gray-500 leading-tight">${esc(opts.labels.historial)}</h4>
                        <div class="flex items-center gap-1 flex-shrink-0" id="${opts.id}_movFilters">
                            <button type="button" data-mov-filter="todos" class="${opts.movFilter.btnActive}" style="${opts.movFilter.activeStyle}">${esc(opts.movFilter.labels.todos)}</button>
                            <button type="button" data-mov-filter="in"    class="${opts.movFilter.btn}">${esc(opts.movFilter.labels.in)}</button>
                            <button type="button" data-mov-filter="out"   class="${opts.movFilter.btn}">${esc(opts.movFilter.labels.out)}</button>
                        </div>
                    </div>
                    <div class="space-y-1.5" id="${opts.id}_movsList">${renderMovs('todos')}</div>
                </div>
            </div>
        `);

        $(`#${opts.parent}`).html(aside);
        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}_close`).on('click', () => opts.onClose(p));

        const $movFilters = $(`#${opts.id}_movFilters`);
        $movFilters.on('click', '[data-mov-filter]', function () {
            const filter = $(this).attr('data-mov-filter');
            $movFilters.find('[data-mov-filter]').each(function () {
                const isActive = $(this).attr('data-mov-filter') === filter;
                this.className = isActive ? opts.movFilter.btnActive : opts.movFilter.btn;
                this.setAttribute('style', isActive ? opts.movFilter.activeStyle : '');
            });
            $(`#${opts.id}_movsList`).html(renderMovs(filter));
            if (window.lucide) lucide.createIcons();
        });
    }
}

class StockPrediction extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME  = 'POSStock';
        this._currentId    = null;
        this._containerId  = 'aiPrediction';
    }

    async render(productId) {
        this._currentId = productId;

        const $wrap = $(`#${this._containerId}`);
        if (!$wrap.length) return;

        stockView.aiPredictionCard({ parent: this._containerId, state: 'loading' });

        const r = await useFetch({ url: apiStock, data: { opc: 'predict', id: productId } });

        if (this._currentId !== productId) return;

        if (!r || r.status !== 200) {
            const msg = (r && r.message) ? r.message : 'Error al conectar con la IA.';
            stockView.aiPredictionCard({ parent: this._containerId, state: 'error', errorMsg: msg });
            return;
        }

        stockView.aiPredictionCard({
            parent:         this._containerId,
            state:          'ready',
            iaOk:           r.ia_ok !== false,
            iaMsg:          r.mensaje_ia || '',
            dias:           r.dias_agotamiento,
            reorden:        r.reorden_sugerido,
            resumen:        r.resumen,
            tendencia:      r.tendencia || [],
            tendenciaDelta: (r.tendencia_delta === undefined ? null : r.tendencia_delta),
            proyeccion:     r.proyeccion_stock || [],
            stockActual:    r.stock_actual || 0,
            stockMin:       r.stock_min || 0
        });
    }
}

// -- Conteo fisico --

class StockCount extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'StockCount';
        this.id           = null;
        this.areaId       = '';
        this.counts       = {};
        this.sheet        = [];
        this.perms        = {};
        this.modal        = null;
    }

    // -- Interface --

    async render(id) {
        this.id     = id;
        this.areaId = '';
        this.counts = {};

        const data = await this.getConteo();
        if (!data) return;

        this.modal = stockView.countModal({
            id:       'mdlConteo',
            title:    'Conteo físico',
            subtitle: data.header.subtitle,
            badge:    data.header.badge,
            info:     data.header.info,
            blind: {
                checked:  data.perms.edit && data.header.is_blind === 1,
                disabled: !data.perms.edit
            },
            actions:  this.jsonActions(data.perms),
            onBlind:  () => this.toggleBlind(),
            onClose:  () => this.onClose()
        });

        $('#mdlConteoTable').on('input', '[data-count]', (e) => this.onCountChange($(e.currentTarget)));

        this.renderTabs(data.areas || []);
        this.paintSheet(data);
    }

    // "Todas" llega con id vacio; en la pestana va como 'todas' para que su id del DOM no quede en blanco.
    renderTabs(areas) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        this.tabLayout({
            parent:          'mdlConteoTabs',
            id:              `tabs${this.PROJECT_NAME}`,
            type:            'short',
            theme:           'light',
            renderContainer: false,
            json:            areas.map(a => ({
                id:     a.id || 'todas',
                tab:    `${esc(a.valor)} (${a.total})`,
                active: a.id === this.areaId
            })),
            onChange: (tabId) => {
                this.areaId = tabId === 'todas' ? '' : tabId;
                this.lsConteo();
            }
        });
    }

    paintSheet(data) {
        this.createCoffeeTable3({
            parent:       'mdlConteoTable',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'light',
            f_size:       11,
            class:        'w-full table-fixed text-[11px]',
            color_th:     'sticky top-0 z-10 bg-white border-b border-gray-200',
            color_group:  'bg-gray-200 text-gray-700',
            border_table: '',
            border_row:   'border-b border-gray-100',
            center:       [3, 5],
            right:        [4, 6, 7],
            emptyMessage: 'No hay productos en esta área',
            emptyIcon:    'icon-cube',
            data:         {
                thead: data.thead || [],
                row:   data.row   || []
            }
        });

        // Anchos fijos: las columnas no se mueven al cambiar de area ni al capturar.
        const widths = ['30%', '15%', '9%', '10%', '14%', '10%', '12%'];
        $(`#tb${this.PROJECT_NAME} thead th`).each((i, th) => $(th).css('width', widths[i] || ''));

        this.restoreCounts();
        this.toggleBlind();
        if (!this.areaId && (data.row || []).some(r => r.colgroup)) this.groupToggles();

        if (this.perms.edit) $(`#tb${this.PROJECT_NAME} [data-count]:enabled`).first().trigger('focus');
    }

    // En "Todas" cada renglon de area contrae o expande sus productos.
    groupToggles() {
        const $groups = $(`#tb${this.PROJECT_NAME} tbody tr`).has('td[colspan]');

        $groups.addClass('cursor-pointer select-none').attr('title', 'Contraer / expandir');
        $groups.find('td').prepend(
            $('<span>', { 'data-group-chevron': '', class: 'inline-flex align-middle mr-1.5 transition-transform' })
                .append($('<i>', { 'data-lucide': 'chevron-down', class: 'w-3.5 h-3.5' }))
        );
        if (window.lucide) lucide.createIcons();

        $groups.on('click', (e) => {
            const $group = $(e.currentTarget);
            const closed = !$group.hasClass('is-collapsed');
            $group.toggleClass('is-collapsed', closed).find('[data-group-chevron]').toggleClass('-rotate-90', closed);
            $group.nextUntil($groups).toggleClass('hidden', closed);
        });
    }

    // -- CRUD --

    async lsConteo() {
        const data = await this.getConteo();
        if (data) this.paintSheet(data);
    }

    async getConteo() {
        const r = await useFetch({
            url:  apiStock,
            data: {
                opc:     'getConteo',
                id:      this.id,
                area_id: this.areaId
            }
        });

        if (!r || r.status !== 200) {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo cargar el conteo' });
            return null;
        }

        this.sheet = r.sheet || [];
        this.perms = r.perms || {};
        return r;
    }

    // Nada se crea hasta aceptar la sucursal. Si su almacen ya tiene un borrador
    // abierto, el ctrl lo retoma en vez de crear otro. Sin sucursales que elegir,
    // cuenta la de la sesion.
    addConteo() {
        const sucursales = app.dataInit.sucursales || [];

        this.createModalForm({
            id:         'frmConteo',
            coffeesoft: true,
            theme:      'light',
            bootbox:    { title: '¿Deseas crear un conteo físico?', closeButton: true },
            data:       { opc: 'addConteo' },
            json: [
                {
                    opc:   'label',
                    text:  'Elige la sucursal que vas a contar. Si ya tiene un conteo en borrador, se abre ese para continuar. El stock no cambia hasta que apliques el ajuste.',
                    class: 'col-12 text-[12px] text-gray-500 leading-relaxed'
                },
                {
                    opc:   'select',
                    id:    'conteoBranch',
                    name:  'branch_id',
                    lbl:   'Sucursal',
                    class: 'col-12',
                    value: $('#branch_id').val() || app.subId,
                    data:  sucursales.length ? sucursales : [{ id: app.subId, valor: 'Sucursal actual' }]
                }
            ],
            success: (r) => {
                if (!r || r.status !== 200) {
                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo abrir el conteo' });
                    return;
                }
                this.render(r.id);
            }
        });
    }

    async editConteo(silent = false) {
        const r = await useFetch({
            url:  apiStock,
            data: {
                opc:      'editConteo',
                id:       this.id,
                counts:   JSON.stringify(this.counts),
                is_blind: $('#mdlConteoBlind').is(':checked') ? 1 : 0
            }
        });

        if (!r || r.status !== 200) {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo guardar el conteo' });
            return false;
        }

        this.sheet.forEach(s => {
            if (!Object.prototype.hasOwnProperty.call(this.counts, s.id)) return;
            s.qty = this.counts[s.id] === '' ? null : Number(this.counts[s.id]);
        });
        this.counts = {};

        if (!silent) this.alertBox({ type: 'success', title: r.message, timer: 1500 });
        return true;
    }

    // Guarda lo capturado y aplica el ajuste: cada diferencia se suma al stock.
    async statusConteo() {
        const s       = this.summary();
        const missing = s.total - s.counted;
        const ok      = await this.confirm(
            '¿Aplicar el ajuste?',
            `Se ajustarán <b class="text-blue-600">${s.counted} ${s.counted === 1 ? 'producto' : 'productos'}</b>. Cada diferencia se suma al stock actual del almacén y el conteo ya no se podrá editar.${missing ? ` Quedan ${missing} productos sin contar: no se ajustarán.` : ''}`,
            'Aplicar'
        );
        if (!ok || !(await this.editConteo(true))) return;

        const r = await useFetch({
            url:  apiStock,
            data: {
                opc:    'statusConteo',
                id:     this.id,
                action: 'aplicar'
            }
        });

        if (!r || r.status !== 200) {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo aplicar el ajuste' });
            return;
        }

        this.alertBox({ type: 'success', title: r.message, timer: 1800 });
        this.afterChange(true);
    }

    askCancelPassword(retry) {
        return new Promise((resolve) => {
            this.alertBox({
                type:             'confirm',
                icon:             'lock',
                title:            'Confirma tu contraseña',
                detailHtml:       retry
                    ? 'Contraseña incorrecta. Intenta de nuevo.'
                    : 'Para cancelar el conteo escribe tu contraseña.',
                input:            'password',
                inputPlaceholder: 'Tu contraseña',
                inputRequired:    true,
                inputError:       'Escribe tu contraseña',
                okLabel:          'Continuar',
                cancelLabel:      'Cancelar',
                onOk: async (password) => {
                    const r = await useFetch({
                        url:  apiStock,
                        data: { opc: 'verifyCancelPassword', id: this.id, password: password }
                    }).catch(() => null);

                    if (r && r.status === 200) { resolve(true); return; }
                    if (r && r.status === 401) { resolve(await this.askCancelPassword(true)); return; }

                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo verificar la contraseña' });
                    resolve(false);
                },
                onCancel: () => resolve(false)
            });
        });
    }

    async cancelConteo() {
        if (!(await this.askCancelPassword(false))) return;

        // Sin captura editable = ya aplicado: cancelar revierte el stock.
        const applied = !this.perms.edit;

        this.alertBox({
            type:       'cancel',
            title:      applied ? '¿Cancelar el ajuste?' : '¿Cancelar el conteo?',
            detailHtml: applied
                ? 'El stock vuelve a como estaba antes de aplicar y el ajuste sale del kárdex.'
                : 'Se descarta lo capturado. El stock no cambia.',
            okLabel:    'Sí, cancelar',
            onOk: async () => {
                const r = await useFetch({ url: apiStock, data: { opc: 'cancelConteo', id: this.id } });
                if (!r || r.status !== 200) {
                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo cancelar el conteo' });
                    return;
                }
                this.alertBox({ type: 'success', title: r.message, timer: 1500 });
                this.afterChange(false);
            }
        });
    }

    jsonActions(perms) {
        const actions = [];

        if (perms.cancel) {
            actions.push({
                id:      'btnConteoCancelar',
                text:    perms.edit ? 'Cancelar conteo' : 'Cancelar ajuste',
                kind:    'ghost',
                onClick: () => this.cancelConteo()
            });
        }
        if (perms.edit) {
            actions.push({
                id:      'btnConteoBorrador',
                text:    'Guardar borrador',
                kind:    'secondary',
                onClick: () => this.editConteo()
            });
        }
        if (perms.apply) {
            actions.push({
                id:      'btnConteoAplicar',
                text:    'Aplicar ajuste',
                icon:    'check',
                kind:    'primary',
                onClick: () => this.statusConteo()
            });
        }

        return actions;
    }

    // -- Complements --

    onClose() {
        this.modal = null;
        if (this.perms.edit && Object.keys(this.counts).length) this.editConteo();
    }

    onCountChange($input) {
        this.counts[$input.data('count')] = $input.val();
        this.paintDiff($input);
        this.renderSummary();
    }

    // Lo capturado sin guardar gana sobre lo que trae la base.
    restoreCounts() {
        $(`#tb${this.PROJECT_NAME} [data-count]`).each((_, el) => {
            const id = $(el).data('count');
            if (Object.prototype.hasOwnProperty.call(this.counts, id)) $(el).val(this.counts[id]);
            this.paintDiff($(el));
        });
    }

    paintDiff($input) {
        const id      = $input.data('count');
        const $dif    = $(`#Diferencia_${id}`);
        const $val    = $(`#Valor_${id}`);
        const pending = $input.val() === '';
        const tones   = 'text-rose-600 text-sky-700 text-emerald-600 text-gray-300 font-bold';

        $dif.add($val).removeClass(tones);

        if (pending) {
            $dif.text('—').addClass('text-gray-300');
            $val.text('—').addClass('text-gray-300');
            return;
        }

        const dif   = Math.round((Number($input.val()) - Number($input.data('system'))) * 100) / 100;
        const value = Math.abs(dif * Number($input.data('cost')));
        const tone  = dif < 0 ? 'text-rose-600' : 'text-sky-700';

        if (dif === 0) {
            $dif.text('0').addClass('text-emerald-600');
            $val.text('—').addClass('text-gray-300');
            return;
        }

        $dif.text((dif > 0 ? '+' : '') + dif).addClass(`${tone} font-bold`);
        $val.text(value ? (dif < 0 ? '-' : '+') + formatPrice(value) : '—').addClass(value ? tone : 'text-gray-300');
    }

    // Oculta los valores sin quitar las columnas, asi la hoja no se recorre.
    toggleBlind() {
        const blind = $('#mdlConteoBlind').is(':checked');
        $(`#tb${this.PROJECT_NAME}`).find('td[data-col="4"], td[data-col="6"], td[data-col="7"]').toggleClass('invisible', blind);
        this.renderSummary();
    }

    // Sin area resume todo el almacen (lo que aplica el ajuste); con area, solo esa pestana.
    summary(areaId = '') {
        let total = 0, counted = 0, differences = 0, net = 0;

        this.sheet.forEach(s => {
            if (areaId && s.area !== areaId) return;
            total++;

            const dirty = Object.prototype.hasOwnProperty.call(this.counts, s.id);
            const raw   = dirty ? this.counts[s.id] : s.qty;
            if (raw === '' || raw === null || raw === undefined) return;

            counted++;
            const dif = Math.round((Number(raw) - s.system) * 100) / 100;
            if (dif !== 0) {
                differences++;
                net += dif * s.cost;
            }
        });

        return {
            total:       total,
            counted:     counted,
            differences: differences,
            net:         net,
            blind:       $('#mdlConteoBlind').is(':checked')
        };
    }

    renderSummary() {
        if (this.modal) this.modal.setSummary(this.summary(this.areaId));
    }

    // Cierra sin autoguardar; al aplicar, el conteo queda marcado como nuevo en Ajustes.
    afterChange(applied) {
        this.counts = {};
        if (this.modal) this.modal.close();

        stock.lsStock();
        stock.lsKpis();

        if (applied) ajustes.newId = this.id;
        else if (ajustes.newId === this.id) ajustes.newId = null;
        if (app.ajustesReady) ajustes.lsAjustes();
    }

    confirm(title, detail, okLabel) {
        return new Promise((resolve) => {
            this.alertBox({
                type:       'confirm',
                title:      title,
                detailHtml: detail,
                okLabel:    okLabel,
                onOk:       () => resolve(true),
                onCancel:   () => resolve(false)
            });
        });
    }
}

// -- Ajustes --

class Ajustes extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Ajustes';
        this.newId        = null;
    }

    // -- Interface --

    render() {
        this.filterBar();
        this.lsAjustes();
    }

    filterBar() {
        this.createfilterBar({
            parent:     'filterBarAjustes',
            id:         `filterForm${this.PROJECT_NAME}`,
            coffeesoft: true,
            theme:      'light',
            data: [
                {
                    opc:      'select',
                    id:       'fEstadoAjuste',
                    lbl:      'Estado:',
                    class:    'col-12 col-md-4 col-lg-3',
                    onchange: 'ajustes.lsAjustes()',
                    value:    '',
                    required: false,
                    data:     app.dataInit.estadosAjuste
                },
                {
                    opc:       'button',
                    id:        'btnConteoAjustes',
                    text:      'Conteo físico',
                    icon:      'icon-clipboard',
                    className: 'w-100',
                    class:     'col-12 col-md-4 col-lg-2',
                    color_btn: 'primary',
                    onClick:   () => stockCount.addConteo()
                }
            ]
        });
    }

    // -- CRUD --

    lsAjustes() {
        $('#containerAjustes').off('draw.dt.lucide').on('draw.dt.lucide', () => {
            if (window.lucide) lucide.createIcons();
        });

        this.createTable({
            parent:      'containerAjustes',
            idFilterBar: 'filterBarAjustes',
            coffeesoft:  true,
            conf:       { datatable: true, pag: 15 },
            data: {
                opc:       'lsAjustes',
                branch_id: app.getFilters().branch_id,
                status:    $('#fEstadoAjuste').val() || '',
                new_id:    this.newId || ''
            },
            attr: {
                id:           `tb${this.PROJECT_NAME}`,
                theme:        'light',
                striped:      true,
                f_size:       12,
                center:       [2, 4, 5, 6],
                right:        [7],
                emptyMessage: 'Aún no hay conteos registrados',
                emptyIcon:    'icon-clipboard'
            }
        });
    }
}
