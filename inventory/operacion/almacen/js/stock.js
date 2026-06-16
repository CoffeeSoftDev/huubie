let apiStock = 'ctrl/ctrl-stock.php';
let app, stock, stockView, stockPrediction;

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
    app            = new App(apiStock, 'root');
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
                branch_id: r.branch_id || '',
                sucursales:      r.sucursales      || [],
                categorias:      r.categorias      || [],
                niveles:         NIVELES_STOCK
            };
        } else {
            this.dataInit = {
                branch_id: '',
                sucursales:      [],
                categorias:      [],
                niveles:         NIVELES_STOCK
            };
        }
        this.subId      = this.dataInit.branch_id;
        branch_id = this.subId;

        this.render();
    }

    render() {
        this.layout();
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
            ? `Visor de Stock <span class="font-bold" style="color:#C05A40;">· ${esc(branchName)}</span>`
            : 'Visor de Stock';

        stockView.renderHeader({
            title:     'Visor de Stock',
            titleHtml: titleHtml,
            subtitle:  'Control de existencias por sucursal, categoria y nivel',
            // back:      { href: 'index.php', title: 'Regresar al inicio' }
        });
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
                info:    'var(--cs-info,#1C64F2)',
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
            salidaColor:      '#C05A40',
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
                activeStyle: 'background:#C05A40;',
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
            info:   { bg: 'rgba(28,100,242,0.15)',  fg: '#60A5FA' },
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
                        <div class="w-8 h-8 rounded-md ${p.iconBg} flex items-center justify-center ${p.iconText} flex-shrink-0">
                            <i data-lucide="package" class="w-4 h-4"></i>
                        </div>
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
