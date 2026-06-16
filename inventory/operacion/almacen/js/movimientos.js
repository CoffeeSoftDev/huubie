let api = 'ctrl/ctrl-movimientos.php';
let app, movimientos, movimientosView;

let branchId;

const VIEW_HEADER_MOVIMIENTOS = {
    title:    'Visor de Movimientos',
    subtitle: 'Kardex de inventario · entradas, mermas y traspasos',
    // back:     { href: '/inventory/operacion/almacen/index.php', title: 'Regresar al inicio' }
};

$(async () => {
    movimientosView = new MovimientosView(api, 'root');
    movimientos     = new Movimientos(api, 'root');
    app             = new App(api, 'root');
    await app.init();
});


class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Movimientos';
        this.branchId     = null;
        this.selectedId   = null;
        this.dataInit     = {};
    }

    async init() {
        const r  = await fn_ajax({ opc: 'init' }, api).catch(() => null);
        const ok = r && r.status === 200;

        this.dataInit = {
            branch_id:  ok ? (r.branch_id  || '') : '',
            sucursales: ok ? (r.sucursales || []) : []
        };

        this.branchId = this.dataInit.branch_id;
        branchId      = this.branchId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        this.renderHeader();
        movimientosView.renderDetail(null);
        movimientos.lsMovimientos();
        movimientos.lsKpis();
    }

    renderHeader() {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const branch     = (this.dataInit.sucursales || []).find(s => String(s.id) === String(this.branchId));
        const branchName = branch ? (branch.valor || '') : '';

        const titleHtml = branchName
            ? `${VIEW_HEADER_MOVIMIENTOS.title} <span class="font-bold" style="color:#C05A40;">&middot; ${esc(branchName)}</span>`
            : VIEW_HEADER_MOVIMIENTOS.title;

        movimientosView.renderHeader(Object.assign({}, VIEW_HEADER_MOVIMIENTOS, { titleHtml }));
    }

    layout() {
        const mainPanel = {
            type: 'div',
            id:   'mainPanel',
            class: 'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                {
                    id:    'viewHeader',
                    text:  '#viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    class: 'px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    text:  '#tableWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto bg-white'
                }
            ]
        };

        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'w-full md:w-[380px] flex-shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col overflow-hidden',
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
                class:     'flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden bg-white rounded-lg border border-gray-200',
                container: [mainPanel, detailPanel]
            }
        });
    }

    filterBar() {
        const withAll = (list, label) => {
            const arr = list || [];
            return (arr[0] && (arr[0].id === '' || arr[0].id == null))
                ? arr
                : [{ id: '', valor: label }].concat(arr);
        };
        const sucursales = withAll(this.dataInit.sucursales, 'Todas las sucursales');
        const tipos = [
            { id: '',              valor: 'Todos los tipos' },
            { id: 'ENTRADA',       valor: 'Entradas' },
            { id: 'MERMA',         valor: 'Mermas' },
            { id: 'TRANSFERENCIA', valor: 'Traspasos' }
        ];

        const filters = [
            {
                opc:   'input-calendar',
                id:    `calendar${this.PROJECT_NAME}`,
                lbl:   'Rango de fecha:',
                class: 'col-12 col-md-4 col-lg-4'
            },
            {
                opc:      'select',
                id:       'fSucursal',
                lbl:      'Sucursal:',
                class:    'col-12 col-md-3 col-lg-4',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     sucursales
            },
            {
                opc:      'select',
                id:       'fTipo',
                lbl:      'Tipo:',
                class:    'col-12 col-md-3 col-lg-4',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     tipos
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      'light',
            data:       filters
        });

        // Arrancamos en la sucursal activa del usuario. Si solo tiene una, el
        // select queda fijo (sin opcion "Todas" y deshabilitado).
        const sucs = this.dataInit.sucursales || [];
        if (sucs.length <= 1) {
            $('#fSucursal').find('option[value=""]').remove();
            $('#fSucursal').val(this.branchId).prop('disabled', true);
        } else {
            $('#fSucursal').val(this.branchId);
        }

        dataPicker({
            parent: `calendar${this.PROJECT_NAME}`,
            rangepicker: {
                startDate:     moment().startOf('month'),
                endDate:       moment().endOf('month'),
                showDropdowns: true,
                ranges: {
                    'Hoy':           [moment(), moment()],
                    'Ayer':          [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                    'Semana actual': [moment().startOf('week'), moment().endOf('week')],
                    'Mes actual':    [moment().startOf('month'), moment().endOf('month')],
                    'Mes anterior':  [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
                }
            },
            onSelect: () => this.onChangeFilters()
        });
    }

    getFilters() {
        const range = getDataRangePicker(`calendar${this.PROJECT_NAME}`) || {};
        return {
            branch_id: $('#fSucursal').val() || '',
            tipo:      $('#fTipo').val()     || '',
            item_id:   '',
            fechaIni:  range.fi              || '',
            fechaFin:  range.ff              || '',
            q:         ''
        };
    }

    async onChangeFilters() {
        movimientos.lsMovimientos();
        await movimientos.lsKpis();
        if (this.selectedId != null) this.selectProducto(null);
    }

    onBranchChange(detail) {
        if (detail && detail.id != null) {
            this.branchId = detail.id;
            branchId      = this.branchId;
        }
        this.renderHeader();
        this.selectProducto(null);
        movimientos.lsMovimientos();
        movimientos.lsKpis();
    }

    selectProducto(itemId) {
        this.selectedId = itemId;
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
        if (itemId != null) {
            const $row = $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
                return $(this).find(`[onclick*="selectProducto(${itemId})"]`).length > 0;
            });
            $row.addClass('row-active');
        }
        const prod = (itemId != null && movimientos._raw) ? movimientos._raw[itemId] : null;
        movimientosView.renderDetail(prod || null);
    }
}


class Movimientos extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Movimientos';
        this._raw         = {};
    }

    lsMovimientos() {
        const f = app.getFilters();

        this.createTable({
            parent:      'tableWrap',
            idFilterBar: 'filterBar',
            coffeesoft:  true,
            conf:        { datatable: true, pag: 15 },
            data: {
                opc:           'lsMovimientos',
                branch_id:     f.branch_id,
                movement_type: f.tipo,
                item_id:       f.item_id,
                fi:            f.fechaIni,
                ff:            f.fechaFin,
                q:             f.q
            },
            methods: {
                send: (resp) => {
                    this._raw = {};
                    const arr = (resp && resp.data) ? resp.data : [];
                    arr.forEach(p => { this._raw[p.itemId] = p; });
                }
            },
            attr: {
                id:           `tb${this.PROJECT_NAME}`,
                theme:        'light',
                f_size:       12,
                center:       [2, 3, 4, 5, 7],
                emptyMessage: 'No se encontraron movimientos con los filtros aplicados',
                emptyIcon:    'icon-activity'
            }
        });
    }

    async lsKpis() {
        const f = app.getFilters();
        const r = await fn_ajax({
            opc:       'showMovimientos',
            branch_id: f.branch_id,
            item_id:   f.item_id,
            fi:        f.fechaIni,
            ff:        f.fechaFin
        }, api).catch(() => null);
        const c = (r && r.status === 200) ? r.counts : {};

        const kpis = [
            { id: 'kpiTotal',    label: 'Total Movs', value: parseInt(c.total          || 0, 10), tone: 'default' },
            { id: 'kpiEntradas', label: 'Entradas',   value: parseInt(c.total_entradas || 0, 10), tone: 'success' },
            { id: 'kpiMermas',   label: 'Mermas',     value: parseInt(c.total_mermas   || 0, 10), tone: 'danger'  },
            { id: 'kpiTransf',   label: 'Traspasos',  value: parseInt(c.total_traspasos|| 0, 10), tone: 'info'    }
        ];
        movimientosView.renderInfoCards(kpis);
    }
}


class MovimientosView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Movimientos';
    }

    renderDetail(producto) {
        this.productMovimientosPanel({
            parent:  'detailPanel',
            json:    producto,
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
            onClick: () => {}
        });
    }

    renderHeader(data) {
        this.viewHeader({
            parent: 'viewHeader',
            json:   data
        });
    }

    kpisRow(options) {
        const defaults = {
            parent: 'root',
            id:     'kpisRow',
            class:  'grid grid-cols-2 md:grid-cols-4 gap-3',
            json:   [],
            labels: { empty: 'Sin indicadores' },
            tones: {
                default: 'text-gray-800',
                success: 'text-green-600',
                warning: 'text-amber-500',
                danger:  'text-red-600',
                info:    'text-[#C05A40]'
            },
            cardClass:  'cs-kpi-card bg-white rounded-lg border border-gray-200 px-3 py-3 cursor-pointer hover:shadow-lg transition-shadow',
            labelClass: 'cs-kpi-label text-[10px] uppercase tracking-wider font-bold text-gray-500',
            valueClass: 'cs-kpi-value text-sm font-bold',
            onClick:    () => {}
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
                </div>`;
        };

        const grid = $('<div>', { id: opts.id, class: opts.class });

        if (!opts.json || opts.json.length === 0) {
            grid.html(`<p class="col-span-full text-[10px] text-gray-400 italic text-center py-2">${esc(opts.labels.empty)}</p>`);
            $(`#${opts.parent}`).html(grid);
            return;
        }

        grid.html(opts.json.map((kpi, idx) => kpiCard(kpi, idx)).join(''));
        $(`#${opts.parent}`).html(grid);

        grid.find('[data-kpi-idx]').on('click', (e) => {
            const idx = parseInt($(e.currentTarget).attr('data-kpi-idx'), 10);
            opts.onClick(opts.json[idx], idx);
        });
    }

    viewHeader(options) {
        const defaults = {
            parent: 'root',
            id:     'viewHeader',
            class:  'flex items-center justify-between w-full',
            json:   { title: '', titleHtml: '', subtitle: '', back: null },
            classes: {
                title:    'text-lg font-bold text-gray-800',
                subtitle: 'text-xs text-gray-500',
                backBtn:  'w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0'
            },
            onBack: null
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const backCfg   = opts.json.back;
        const backHref  = typeof backCfg === 'string' ? backCfg : (backCfg && backCfg.href) || '';
        const backTitle = (backCfg && backCfg.title) || 'Regresar';
        const backHtml  = backCfg ? `
            <button type="button" id="${opts.id}_back" class="${opts.classes.backBtn}" title="${esc(backTitle)}">
                <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>` : '';

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html(`
            <div class="flex items-center gap-3">
                ${backHtml}
                <div>
                    <h1 class="${opts.classes.title}">${opts.json.titleHtml || esc(opts.json.title)}</h1>
                    ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
                </div>
            </div>`);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        if (backCfg) {
            $(`#${opts.id}_back`).on('click', () => {
                if (typeof opts.onBack === 'function') return opts.onBack();
                if (backHref) window.location.href = backHref;
            });
        }
    }

    productMovimientosPanel(options) {
        const defaults = {
            parent: 'root',
            id:     'productMovimientosPanel',
            class:  'w-full h-full flex-shrink-0 bg-white flex flex-col overflow-hidden',
            json:   null,
            labels: {
                emptyTitle: 'Selecciona un producto',
                emptyHint:  'Haz click en el boton ver para listar todos sus movimientos.',
                subtitle:   'Historial de movimientos'
            },
            tipoPalettes: {
                'ENTRADA':       { bg: 'rgba(63,193,137,0.15)', fg: '#15803D' },
                'MERMA':         { bg: 'rgba(224,36,36,0.15)',  fg: '#B91C1C' },
                'TRANSFERENCIA': { bg: 'rgba(192,90,64,0.15)',  fg: '#C05A40' },
                'AJUSTE':        { bg: 'rgba(167,139,250,0.15)', fg: '#7C3AED' }
            },
            onClose: () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels       = Object.assign({}, defaults.labels,       o.labels       || {});
        opts.tipoPalettes = Object.assign({}, defaults.tipoPalettes, o.tipoPalettes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const fmtQty   = (n) => { const v = Number(n || 0); return (v >= 0 ? '+' : '') + v; };

        const DOW = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
        const MON = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const fmtFecha = (val) => {
            if (!val) return '-';
            const d = new Date(String(val).replace(' ', 'T'));
            if (isNaN(d.getTime())) return val;
            const base = `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]} ${d.getFullYear()}`;
            if (d.getHours() === 0 && d.getMinutes() === 0) return base;
            let   h    = d.getHours();
            const min  = String(d.getMinutes()).padStart(2, '0');
            const ampm = h >= 12 ? 'pm' : 'am';
            h = h % 12 || 12;
            return `${base} ${h}:${min} ${ampm}`;
        };

        const aside = $('<aside>', { id: opts.id, class: opts.class });

        if (!opts.json) {
            aside.html(`
                <div class="px-3 py-3 flex-shrink-0 bg-gray-50 border-b border-gray-200">
                    <h3 class="text-sm font-bold text-gray-800">Movimientos del producto</h3>
                    <p class="text-[10px] text-gray-500">${esc(opts.labels.subtitle)}</p>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6">
                    <div class="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                        <i data-lucide="activity" class="w-6 h-6 text-gray-400"></i>
                    </div>
                    <p class="text-[11px] text-gray-500">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-[10px] text-gray-400 mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
                </div>`);
            $(`#${opts.parent}`).html(aside);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const p     = opts.json;
        const movs  = p.movs || [];
        const neto  = Number(p.neto || 0);
        const netoColor = neto < 0 ? 'text-red-600' : 'text-green-600';

        const summaryItem = (label, value, extraClass) => `
            <div class="flex flex-col items-center">
                <span class="text-[9px] uppercase tracking-wider text-gray-400">${esc(label)}</span>
                <span class="text-sm font-bold ${extraClass || 'text-gray-800'}">${value}</span>
            </div>`;

        const movCard = (m) => {
            const isOut    = Number(m.cant) < 0;
            const qtyColor = isOut ? 'text-red-600' : 'text-green-600';
            const tipoC    = opts.tipoPalettes[m.tipo] || { bg: 'rgba(156,163,175,0.18)', fg: '#6B7280' };
            return `
                <div class="border border-gray-200 rounded-lg p-2.5">
                    <div class="flex items-center justify-between mb-1.5">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0" style="background:${tipoC.bg};color:${tipoC.fg};">${esc(m.tipo)}</span>
                            <span class="text-[10px] text-gray-500 truncate">${esc(m.folio || '-')}</span>
                        </div>
                        <span class="text-[10px] text-gray-400 flex-shrink-0">${esc(fmtFecha(m.fecha))}</span>
                    </div>
                    <div class="flex items-center justify-between text-[11px]">
                        <span class="${qtyColor} font-bold">${fmtQty(m.cant)}</span>
                        <span class="text-gray-500">${Number(m.stockPrev)} <span class="text-gray-400">&rarr;</span> <b class="text-gray-700">${Number(m.stockPost)}</b></span>
                    </div>
                    <div class="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                        <span class="truncate">${esc(m.almacen || '-')}${m.sucursal && m.sucursal !== '-' ? ` &middot; ${esc(m.sucursal)}` : ''}</span>
                        <span class="font-semibold text-gray-600 flex-shrink-0">${fmtMoney(m.costoTot)}</span>
                    </div>
                    <div class="flex items-center justify-between text-[10px] text-gray-400 mt-0.5">
                        <span class="truncate">${esc(m.usuario || '-')}</span>
                        ${m.estado ? `<span class="flex-shrink-0">${esc(m.estado)}</span>` : ''}
                    </div>
                    ${m.nota ? `<p class="text-[10px] text-gray-500 mt-1 border-t border-gray-100 pt-1">${esc(m.nota)}</p>` : ''}
                </div>`;
        };

        aside.html(`
            <div class="px-3 py-3 flex-shrink-0 flex items-start justify-between bg-gray-50 border-b border-gray-200">
                <div class="min-w-0">
                    <h3 class="text-sm font-bold text-gray-800 leading-tight truncate">${esc(p.producto)}</h3>
                    ${p.sku ? `<p class="text-[10px] text-gray-400">SKU: ${esc(p.sku)}</p>` : ''}
                </div>
                <button id="${opts.id}_close" class="text-gray-500 hover:text-gray-700 transition-colors p-1 flex-shrink-0" title="Cerrar">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            <div class="px-3 py-3 flex-shrink-0 border-b border-gray-200">
                <div class="grid grid-cols-4 gap-2">
                    ${summaryItem('Movs', p.count)}
                    ${summaryItem('Entradas', p.entradas, 'text-green-600')}
                    ${summaryItem('Salidas', p.salidas, 'text-red-600')}
                    ${summaryItem('Neto', fmtQty(neto), netoColor)}
                </div>
            </div>

            <div class="flex-1 overflow-y-auto cs-scroll px-3 py-3 space-y-2">
                ${movs.length
                    ? movs.map(movCard).join('')
                    : '<p class="text-[11px] text-gray-400 italic text-center py-6">Sin movimientos para este producto.</p>'}
            </div>`);

        $(`#${opts.parent}`).html(aside);
        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}_close`).on('click', () => opts.onClose(p));
    }
}
