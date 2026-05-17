let api = 'ctrl/ctrl-pos-movimientos.php';
let app, movimientos, movimientosView;

let turno, subsidiaries_id;

window.updateSession = () => { };


$(async () => {
    movimientosView = new MovimientosView(api, 'root');
    movimientos     = new Movimientos(api, 'root');
    app             = new App(api, 'root');
    await app.init();
});


class App extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSMovimientos';
        this.subId        = null;
        this.selectedId   = null;
    }

    async init() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:{ opc:'init' } })
        this.dataInit = {
            subsidiaries_id: '',
            sucursales:  SAMPLE_MOVIMIENTOS_SUCURSALES,
            tipos:       SAMPLE_MOVIMIENTOS_TIPOS
        };
        this.subId      = this.dataInit.subsidiaries_id;
        subsidiaries_id = this.subId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        movimientosView.renderHeader(SAMPLE_VIEW_HEADER_MOVIMIENTOS);
        movimientosView.renderFooter(SAMPLE_VIEW_FOOTER_MOVIMIENTOS);
        movimientosView.renderTabs(this.PROJECT_NAME);
        movimientosView.renderDetail(null);
        this.populateFilters();
        movimientos.lsMovimientos();
        movimientos.lsKpis();
    }

    // -- Layout --

    layout() {

        const mainPanel = {
            type: 'div',
            id:   'mainPanel',
            class:'flex-1 flex flex-col overflow-hidden min-w-0 w-full',
            children: [
                {
                    id:    'viewHeader',
                    text:  '#viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'tabsRow',
                    class: 'px-4 bg-[#141d2b] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    class: 'px-4 py-3 bg-[#141d2b] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    text:  '#tableWrap',
                    class: 'p-3 flex-1 '
                },
                {
                    id:    'viewFooter',
                    text:  '#viewFooter',
                    class: 'px-4 py-2 bg-[#141d2b] border-t border-[#374151] flex items-center justify-between flex-shrink-0'
                }
            ]
        };

        const detailPanel = {
            type: 'aside',
            id:   'detailPanel',
            class:'w-full md:w-[360px] flex-shrink-0 bg-[#141d2b] border-t md:border-t-0 md:border-l border-[#374151] flex flex-col overflow-hidden',
            children: [
                {
                    id:    'detailContent',
                    text:  '#detailContent',
                    class: 'flex-1 flex flex-col overflow-hidden'
                }
            ]
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'mt-16 h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden overflow-y-auto md:overflow-hidden',
                container: [mainPanel, detailPanel]
            }
        });
    }

    // -- Filter bar --

    filterBar() {

        let filters = [
            {
                opc:      'select',
                id:       'subsidiaries_id',
                lbl:      'Sucursal:',
                class:    'col-12 col-md-3 col-lg-3',
                onchange: 'app.onChangeSucursal()',
                data:     []
            },
            {
                opc:      'select',
                id:       'fTipo',
                lbl:      'Tipo:',
                class:    'col-12 col-md-3 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     SAMPLE_MOVIMIENTOS_TIPOS
            },
            {
                opc:      'date',
                id:       'fFechaIni',
                lbl:      'Desde:',
                class:    'col-12 col-md-2 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '2026-03-28'
            },
            {
                opc:      'date',
                id:       'fFechaFin',
                lbl:      'Hasta:',
                class:    'col-12 col-md-2 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '2026-04-04'
            },
            {
                opc:        'input',
                id:         'qBuscar',
                lbl:        'Buscar:',
                class:      'col-12 col-md-2 col-lg-2',
                placeholder:'Producto, referencia...',
                onkeyup:    'app.onChangeFilters()'
            }
        ];

        this.createfilterBar({
            parent: 'filterBar',
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
            tipo:            $('#fTipo').val()           || '',
            fechaIni:        $('#fFechaIni').val()       || '',
            fechaFin:        $('#fFechaFin').val()       || '',
            q:               $('#qBuscar').val()         || ''
        };
    }

    // -- Event handlers --

    async onChangeFilters() {
        movimientos.lsMovimientos();
        await movimientos.lsKpis();

        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectMovimiento(null);
        }
    }

    onChangeSucursal() {
        movimientos.lsMovimientos();
        movimientos.lsKpis();
        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectMovimiento(null);
        }
    }

    isVisibleAfterFilters(id) {
        const m   = SAMPLE_MOVIMIENTOS_DB[id];
        if (!m) return false;
        const f   = this.getFilters();
        const suc = !f.subsidiaries_id || m.sucursalId === f.subsidiaries_id;
        const tip = !f.tipo            || m.tipo       === f.tipo;
        const q   = !f.q || (m.id + ' ' + m.producto + ' ' + (m.referencia || ''))
                                .toLowerCase()
                                .includes(f.q.toLowerCase());
        const ts  = new Date(m.fechaIso).getTime();
        const ini = f.fechaIni ? new Date(f.fechaIni).getTime() : -Infinity;
        const fin = f.fechaFin ? (new Date(f.fechaFin).getTime() + 86400000) : Infinity;
        return suc && tip && q && ts >= ini && ts <= fin;
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    // -- Facade --

    selectMovimiento(id) {
        this.selectedId = id;
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
        if (id) {
            const $row = $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
                return $(this).text().includes(id);
            });
            $row.addClass('row-active');
        }
        movimientosView.renderDetail(id ? SAMPLE_MOVIMIENTOS_DB[id] : null);
    }

    renderDetail(movimiento) {
        movimientosView.renderDetail(movimiento);
    }
}


class Movimientos extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSMovimientos';
    }

    // -- Data --

    lsMovimientos() {
        // MODO FAKE: si hubiera backend -> useFetch({ data:Object.assign({ opc:'lsMovimientos' }, app.getFilters()) })
        const f = app.getFilters();
        const filteredRows = (SAMPLE_MOVIMIENTOS_TABLE.row || []).filter(r => {
            const m = SAMPLE_MOVIMIENTOS_DB[r.id];
            if (!m) return true;
            const suc = !f.subsidiaries_id || m.sucursalId === f.subsidiaries_id;
            const tip = !f.tipo            || m.tipo       === f.tipo;
            const q   = !f.q || (m.id + ' ' + m.producto + ' ' + (m.referencia || ''))
                                    .toLowerCase()
                                    .includes(f.q.toLowerCase());
            const ts  = new Date(m.fechaIso).getTime();
            const ini = f.fechaIni ? new Date(f.fechaIni).getTime() : -Infinity;
            const fin = f.fechaFin ? (new Date(f.fechaFin).getTime() + 86400000) : Infinity;
            return suc && tip && q && ts >= ini && ts <= fin;
        });

        const data = { row: filteredRows };

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'dark',
            title:        '',
            subtitle:     '',
            center:       [3, 4, 5, 6],
            right:        [7, 8],
            extends:      true,
            scrollable:   false,
            f_size:       12,
            emptyMessage: 'No se encontraron movimientos con los filtros aplicados',
            emptyIcon:    'icon-activity',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        const total = filteredRows.length;
        app.updateFooterInfo(`Mostrando ${total} movimiento${total !== 1 ? 's' : ''}`);
    }

    async lsKpis() {
        // MODO FAKE: si hubiera backend -> useFetch({ data:Object.assign({ opc:'showMovimientos' }, app.getFilters()) })
        const f = app.getFilters();
        const visible = Object.values(SAMPLE_MOVIMIENTOS_DB).filter(m => {
            const suc = !f.subsidiaries_id || m.sucursalId === f.subsidiaries_id;
            const tip = !f.tipo            || m.tipo       === f.tipo;
            const q   = !f.q || (m.id + ' ' + m.producto + ' ' + (m.referencia || ''))
                                    .toLowerCase()
                                    .includes(f.q.toLowerCase());
            const ts  = new Date(m.fechaIso).getTime();
            const ini = f.fechaIni ? new Date(f.fechaIni).getTime() : -Infinity;
            const fin = f.fechaFin ? (new Date(f.fechaFin).getTime() + 86400000) : Infinity;
            return suc && tip && q && ts >= ini && ts <= fin;
        });

        const counts = {
            total:    visible.length,
            entradas: visible.filter(m => m.tipo === 'ENTRADA' || m.tipo === 'DEVOLUCION').length,
            salidas:  visible.filter(m => m.tipo === 'SALIDA POS' || m.tipo === 'SALIDA PED').length,
            merma:    visible.filter(m => m.tipo === 'MERMA').length,
            transf:   visible.filter(m => m.tipo === 'TRANSFERENCIA').length
        };

        const kpis = [
            { id: 'kpiTotal',    label: 'Total Movs', value: counts.total,    tone: 'default' },
            { id: 'kpiEntradas', label: 'Entradas',   value: counts.entradas, tone: 'success' },
            { id: 'kpiSalidas',  label: 'Salidas',    value: counts.salidas,  tone: 'danger'  },
            { id: 'kpiMerma',    label: 'Merma',      value: counts.merma,    tone: 'warning' },
            { id: 'kpiTransf',   label: 'Transf.',    value: counts.transf,   tone: 'info'    }
        ];
        movimientosView.renderInfoCards(kpis);
    }

    async getMovimiento(id) {
        // MODO FAKE: si hubiera backend -> useFetch({ data:{ opc:'getMovimiento', id } })
        movimientosView.renderDetail(SAMPLE_MOVIMIENTOS_DB[id] || null);
    }

    // -- Actions --

    viewMovimiento(id) {
        console.log('[viewMovimiento]', id);
        app.selectMovimiento(id);
    }
}


class MovimientosView extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSMovimientos';
    }

    // -- Render helpers --

    renderDetail(movimiento) {
        this.movimientoDetailPanel({
            parent:  'detailPanel',
            json:    movimiento,
            onClose: () => {
                app.selectedId = null;
                this.renderDetail(null);
                $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
            }
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
            parent: 'viewHeader',
            json:   data
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
                { id: 'stock',        label: 'Stock Actual',  active: false, href: 'pos-stock.php'        },
                { id: 'movimientos',  label: 'Movimientos',   active: true,  href: 'pos-movimientos.php'  },
                { id: 'entradas',     label: 'Entradas',      active: false, href: 'pos-entradas.php'     },
                { id: 'traspasos',    label: 'Traspasos',     active: false, href: 'pos-traspasos.php'    },
                { id: 'mermas',       label: 'Mermas',        active: false, href: 'pos-mermas.php'       }
            ],
            onChange: (tab) => { if (tab && tab.href) window.location.href = tab.href; }
        });
    }

    // -- Components --

    kpisRow(options) {
        const defaults = {
            parent: 'root',
            id:     'kpisRow',
            class:  'grid grid-cols-2 md:grid-cols-5 gap-3',
            json:   [],
            labels: { empty: 'Sin indicadores' },
            tones: {
                default: 'text-white',
                success: 'text-[var(--cs-success,#3FC189)]',
                warning: 'text-[var(--cs-warning,#FBBF24)]',
                danger:  'text-[var(--cs-danger,#E02424)]',
                info:    'text-[var(--cs-info,#1C64F2)]',
                purple:  'text-[var(--cs-accent-purple,#7C3AED)]'
            },
            cardClass:  'cs-kpi-card bg-[var(--cs-bg-input,#1F2937)] rounded-lg px-3 py-3 cursor-pointer hover:bg-[var(--cs-bg-header,#141d2b)] transition-colors',
            labelClass: 'cs-kpi-label text-[10px] uppercase tracking-wider font-bold text-[var(--cs-text-muted,#9CA3AF)]',
            valueClass: 'cs-kpi-value text-sm font-bold',
            onClick:    () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});
        opts.tones  = Object.assign({}, defaults.tones,  o.tones  || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const toneClass = (tone) => opts.tones[tone] || opts.tones.default;

        const kpiCard = (kpi, idx) => {
            const cardId = kpi.id || `${opts.id}_${idx}`;
            return `
                <div id="${cardId}" data-kpi-idx="${idx}" class="${opts.cardClass}">
                    <p class="${opts.labelClass}">${esc(kpi.label)}</p>
                    <p class="${opts.valueClass} ${toneClass(kpi.tone)}" id="${cardId}_value">${esc(kpi.value)}</p>
                </div>
            `;
        };

        const grid = $('<div>', { id: opts.id, class: opts.class });

        if (!opts.json || opts.json.length === 0) {
            grid.html(`<p class="col-span-full text-[10px] text-[var(--cs-text-muted,#9CA3AF)] italic text-center py-2">${esc(opts.labels.empty)}</p>`);
            $(`#${opts.parent}`).html(grid);
            return;
        }

        grid.html(opts.json.map((kpi, idx) => kpiCard(kpi, idx)).join(''));
        $(`#${opts.parent}`).html(grid);

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
            json:   { title: '', subtitle: '' },
            classes: {
                title:    'text-base font-bold text-white',
                subtitle: 'text-[10px] text-[var(--cs-text-secondary,#D1D5DB)]'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html(`
            <div>
                <h1 class="${opts.classes.title}">${esc(opts.json.title)}</h1>
                ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
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
                legend: 'flex items-center gap-3 text-[10px] text-[var(--cs-text-muted,#9CA3AF)] flex-wrap',
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
            class:  'flex items-center gap-1 border-b border-transparent overflow-x-auto',
            json:   [],
            classes: {
                tab:       'px-3 py-2 text-[11px] font-medium text-[var(--cs-text-muted,#9CA3AF)] border-b-2 border-transparent hover:text-white transition-colors cursor-pointer whitespace-nowrap',
                tabActive: 'px-3 py-2 text-[11px] font-bold text-[var(--cs-accent-purple,#A78BFA)] border-b-2 border-[var(--cs-accent-purple,#7C3AED)] cursor-pointer whitespace-nowrap'
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
            const id  = $(e.currentTarget).attr('data-tab-id');
            const tab = (opts.json || []).find(t => t.id === id);
            opts.onChange(tab || { id });
        });
    }

    movimientoDetailPanel(options) {
        const defaults = {
            parent:    'root',
            id:        'movimientoDetailPanel',
            class:     'w-full h-full flex-shrink-0 bg-[var(--cs-bg-header,#141d2b)] border-l border-[var(--cs-border,#374151)] flex flex-col overflow-hidden',
            json:      null,
            labels: {
                emptyTitle: 'Selecciona un movimiento',
                emptyHint:  'Haz click en cualquier fila para ver el detalle aqui.',
                subtitle:   'Click en una fila para ver',
                tipo:       'Tipo',
                cant:       'Cantidad',
                stockPre:   'Stock antes',
                stockPos:   'Stock despues',
                costoU:     'Costo unitario',
                costoT:     'Costo total',
                ref:        'Referencia',
                suc:        'Sucursal',
                usr:        'Usuario',
                fch:        'Fecha',
                ultimos:    'Ultimos movimientos'
            },
            tipoPalettes: {
                'ENTRADA':       { bg: 'rgba(63,193,137,0.15)', fg: '#3FC189' },
                'SALIDA POS':    { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' },
                'SALIDA PED':    { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
                'MERMA':         { bg: 'rgba(251,146,60,0.15)', fg: '#FB923C' },
                'TRANSFERENCIA': { bg: 'rgba(28,100,242,0.15)', fg: '#60A5FA' },
                'AJUSTE':        { bg: 'rgba(124,58,237,0.15)', fg: '#A78BFA' },
                'DEVOLUCION':    { bg: 'rgba(34,211,238,0.15)', fg: '#22D3EE' }
            },
            onClose:   () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels       = Object.assign({}, defaults.labels,       o.labels       || {});
        opts.tipoPalettes = Object.assign({}, defaults.tipoPalettes, o.tipoPalettes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const fmtMoney = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const DOW = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
        const MON = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const fmtFecha = (iso) => {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso || '';
            const dow = DOW[d.getDay()];
            const day = String(d.getDate()).padStart(2, '0');
            const mon = MON[d.getMonth()];
            let h     = d.getHours();
            const m   = String(d.getMinutes()).padStart(2, '0');
            const ampm = h >= 12 ? 'pm' : 'am';
            h = h % 12 || 12;
            return `${dow} ${day} ${mon} ${String(h).padStart(2, '0')}:${m} ${ampm}`;
        };

        const aside = $('<aside>', { id: opts.id, class: opts.class });

        // -- Estado vacio
        if (!opts.json) {
            aside.html(`
                <div class="px-4 py-3 border-b border-[var(--cs-border,#374151)] flex-shrink-0">
                    <h3 class="text-sm font-bold text-white">Detalle Movimiento</h3>
                    <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.subtitle)}</p>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6">
                    <div class="w-14 h-14 rounded-full bg-[var(--cs-bg-input,#1F2937)] border border-[var(--cs-border,#374151)] flex items-center justify-center mb-3">
                        <i data-lucide="activity" class="w-6 h-6 text-[var(--cs-text-muted,#9CA3AF)]"></i>
                    </div>
                    <p class="text-[11px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
                </div>
            `);
            $(`#${opts.parent}`).html(aside);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const m         = opts.json;
        const positivos = ['ENTRADA', 'TRANSFERENCIA', 'DEVOLUCION'];
        const isPos     = positivos.includes(m.tipo);
        const sign      = isPos ? '+' : '-';
        const costoTot  = Math.abs(m.cant) * Number(m.costoUnit || 0);
        const tipoColor = (() => {
            const map = {
                'ENTRADA': 'text-green-400', 'TRANSFERENCIA': 'text-blue-400', 'DEVOLUCION': 'text-cyan-400',
                'SALIDA POS': 'text-red-400', 'SALIDA PED': 'text-red-400', 'MERMA': 'text-orange-400', 'AJUSTE': 'text-purple-400'
            };
            return map[m.tipo] || 'text-gray-400';
        })();
        const tipoC = opts.tipoPalettes[m.tipo] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
        const tipoBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background:${tipoC.bg};color:${tipoC.fg};">${esc(m.tipo)}</span>`;

        const timeline = (SAMPLE_MOV_TIMELINE[m.sku] || []).slice(0, 4);
        const dotColor = (tipo) => ({
            'ENTRADA': 'bg-green-400', 'TRANSFERENCIA': 'bg-blue-400', 'DEVOLUCION': 'bg-cyan-400',
            'SALIDA POS': 'bg-red-400', 'SALIDA PED': 'bg-red-400', 'MERMA': 'bg-orange-400', 'AJUSTE': 'bg-purple-400'
        }[tipo] || 'bg-gray-400');
        const timelineHtml = timeline.length ? timeline.map((t, idx) => {
            const isLast  = idx === timeline.length - 1;
            const tSign   = ['ENTRADA','TRANSFERENCIA','DEVOLUCION'].includes(t.tipo) ? '+' : '-';
            const tLabel  = ({
                'ENTRADA':'Entrada','SALIDA POS':'Salida POS','SALIDA PED':'Salida Pedido','MERMA':'Merma',
                'TRANSFERENCIA':'Transferencia','AJUSTE':'Ajuste','DEVOLUCION':'Devolucion'
            })[t.tipo] || t.tipo;
            return `
                <div class="relative ${isLast ? '' : 'pb-3'}">
                    <div class="absolute -left-[17px] top-0 w-2.5 h-2.5 rounded-full ${dotColor(t.tipo)} border-2 border-[var(--cs-bg-header,#141d2b)]"></div>
                    <p class="text-[10px] font-medium">${tSign}${Math.abs(t.cant)} ${tLabel} <span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(t.ref || '')}</span></p>
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(fmtFecha(t.fechaIso))}</p>
                </div>
            `;
        }).join('') : '<p class="text-[10px] text-gray-500 italic">Sin historial</p>';

        aside.html(`
            <div class="px-4 py-3 border-b border-[var(--cs-border,#374151)] flex-shrink-0 flex items-center justify-between">
                <div>
                    <h3 class="text-sm font-bold text-white">Detalle Movimiento</h3>
                    <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(m.id)} &mdash; ${esc(fmtFecha(m.fechaIso))}</p>
                </div>
                <button id="${opts.id}_close" class="text-[var(--cs-text-secondary,#D1D5DB)] hover:text-white transition-colors p-1" title="Cerrar">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            <div class="flex-1 overflow-y-auto cs-scroll px-4 py-3 space-y-3">

                <!-- Producto + datos del movimiento -->
                <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-lg p-3 border border-[var(--cs-border,#374151)]">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="w-10 h-10 rounded-lg ${m.bg} flex items-center justify-center"><i data-lucide="${m.icon}" class="w-5 h-5 ${m.color}"></i></div>
                        <div class="min-w-0">
                            <p class="text-xs font-bold truncate">${esc(m.producto)}</p>
                            <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)]">SKU: ${esc(m.sku)}</p>
                        </div>
                    </div>
                    <div class="space-y-1.5 mt-3">
                        <div class="flex justify-between text-[11px]"><span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.tipo)}</span>${tipoBadge}</div>
                        <div class="flex justify-between text-[11px]"><span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.cant)}</span><span class="font-bold ${tipoColor}">${sign}${Math.abs(m.cant)}</span></div>
                        <div class="flex justify-between text-[11px]"><span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.stockPre)}</span><span>${m.stockPrev}</span></div>
                        <div class="flex justify-between text-[11px]"><span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.stockPos)}</span><span class="font-bold">${m.stockPost}</span></div>
                        <div class="flex justify-between text-[11px]"><span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.costoU)}</span><span>${fmtMoney(m.costoUnit)}</span></div>
                        <div class="flex justify-between text-[11px]"><span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.costoT)}</span><span class="font-bold ${tipoColor}">${sign}${fmtMoney(costoTot)}</span></div>
                        <div class="border-t border-[var(--cs-border,#374151)] pt-1.5 mt-1.5"></div>
                        <div class="flex justify-between text-[11px]"><span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.ref)}</span><span class="${m.refLink ? 'text-blue-400 hover:underline cursor-pointer' : ''}">${esc(m.referencia || '-')}</span></div>
                        <div class="flex justify-between text-[11px]"><span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.suc)}</span><span>${esc(m.sucursal || '-')}</span></div>
                        <div class="flex justify-between text-[11px]"><span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.usr)}</span><span>${esc(m.usuario || '-')}</span></div>
                        <div class="flex justify-between text-[11px]"><span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.fch)}</span><span>${esc(fmtFecha(m.fechaIso))}</span></div>
                    </div>
                </div>

                <!-- Historial reciente -->
                <div>
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider mb-2">${esc(opts.labels.ultimos)}</p>
                    <div class="space-y-0 border-l-2 border-[var(--cs-border,#374151)] ml-2 pl-3">
                        ${timelineHtml}
                    </div>
                </div>
            </div>
        `);

        $(`#${opts.parent}`).html(aside);
        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}_close`).on('click', () => opts.onClose(m));
    }
}
