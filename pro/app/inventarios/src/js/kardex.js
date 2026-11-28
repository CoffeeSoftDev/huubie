// -- Kárdex --
// El «Visor de Movimientos» de inventory/operacion/almacen/movimientos aplicado
// al Catálogo de pro: tarjetas, filtros, una fila por producto con sus
// movimientos del periodo y, en el ojo, cada movimiento con lo que había y lo
// que quedó. Solo lectura. Comunes (invEsc, viewHeader...) en inventarios.js.

let apiKardex = 'ctrl/ctrl-kardex.php';
let app, movimientos, movimientosView;

const VIEW_HEADER_MOVIMIENTOS = {
    title:    'Visor de Movimientos',
    subtitle: 'Kárdex de inventario · entradas, salidas, traspasos y cancelaciones'
};

$(async () => {
    movimientosView = new MovimientosView(apiKardex, 'root');
    movimientos     = new Movimientos(apiKardex, 'root');
    app             = new App(apiKardex, 'root');
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
        const r = await useFetch({ url: apiKardex, data: { opc: 'init' } });

        if (!r || r.status !== 200) return invBlocked(r && r.message);

        INV_ACTIONS = r.actions || [];

        this.dataInit = {
            branch_id:  r.branch_id || '',
            branch:     (r.scope || {}).branch || '',
            sucursales: r.sucursales || [],
            costs:      !!r.costs
        };
        this.branchId = this.dataInit.branch_id;

        this.render();
    }

    render() {
        this.invVisorLayout({ id: this.PROJECT_NAME, key: 'movimientos', kpisFirst: true });
        this.visorResize({ key: 'movimientos', label: 'Ancho de los movimientos del producto' });
        this.filterBar();
        movimientosView.renderHeader(Object.assign({}, VIEW_HEADER_MOVIMIENTOS, {
            titleHtml: invTitleHtml(VIEW_HEADER_MOVIMIENTOS.title, this.dataInit.branch)
        }));
        movimientosView.renderDetail(null);
        movimientos.lsMovimientos();
        movimientos.lsKpis();
    }

    filterBar() {
        const tipos = [
            { id: '',              valor: 'Todos los tipos' },
            { id: 'ENTRADA',       valor: 'Entradas' },
            { id: 'SALIDA',        valor: 'Salidas' },
            { id: 'TRANSFERENCIA', valor: 'Traspasos' },
            { id: 'AJUSTE',        valor: 'Ajustes' },
            { id: 'CANCELACION',   valor: 'Cancelaciones' }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      'light',
            data: [
                { opc: 'input-calendar', id: `calendar${this.PROJECT_NAME}`, lbl: 'Rango de fecha:', class: 'col-12 col-md-4 col-lg-4', readonly: true, required: false },
                { opc: 'select', id: 'fSucursal', lbl: 'Sucursal:', class: 'col-12 col-md-3 col-lg-4', data: this.dataInit.sucursales || [] },
                { opc: 'select', id: 'fTipo', lbl: 'Tipo:', class: 'col-12 col-md-3 col-lg-4', onchange: 'app.onChangeFilters()', value: '', data: tipos }
            ]
        });

        // La sucursal es la de la barra de arriba.
        $('#fSucursal').val(String(this.branchId)).prop('disabled', true);

        const range = this.invRangePicker({
            parent:   `calendar${this.PROJECT_NAME}`,
            start:    moment().startOf('month'),
            end:      moment(),
            onSelect: (fi, ff) => {
                this.rangeFi = fi;
                this.rangeFf = ff;
                this.onChangeFilters();
            }
        });

        this.rangeFi = range.fi;
        this.rangeFf = range.ff;
    }

    getFilters() {
        return {
            tipo: $('#fTipo').val() || '',
            fi:   this.rangeFi || '',
            ff:   this.rangeFf || ''
        };
    }

    async onChangeFilters() {
        movimientos.lsMovimientos();
        await movimientos.lsKpis();

        if (this.selectedId != null) this.selectProducto(null);
    }

    selectProducto(itemId) {
        this.selectedId = itemId;

        const $rows = $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');

        if (itemId != null) {
            $rows.filter(function () {
                return $(this).find(`[onclick*="selectProducto(${itemId})"]`).length > 0;
            }).addClass('row-active');
        }

        movimientosView.renderDetail(itemId != null ? (movimientos.raw[itemId] || null) : null);
    }
}

class Movimientos extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Movimientos';
        this.raw          = {};
    }

    // Columnas: Producto, Movs, Entradas, Salidas, Neto, Últ. Mov
    async lsMovimientos() {
        const f = app.getFilters();
        const r = await useFetch({ url: apiKardex, data: { opc: 'lsMovimientos', movement_type: f.tipo, fi: f.fi, ff: f.ff } });
        const ok = r && r.status === 200;

        this.raw = {};
        (ok ? r.data || [] : []).forEach((p) => { this.raw[p.itemId] = p; });

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'light',
            center:       [2, 3, 4, 5, 6],
            actionsAlign: 'left',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       12,
            emptyMessage: 'No se encontraron movimientos con los filtros aplicados',
            emptyIcon:    'icon-activity',
            data:         { row: ok ? r.row : [] }
        });

        if (window.lucide) lucide.createIcons();

        if (ok && r.row.length && typeof simple_data_table === 'function') simple_data_table(`#tb${this.PROJECT_NAME}`, 15);

        if (ok && r.more) this.alertBox({ type: 'warning', title: 'Son muchos movimientos: se ven los más recientes. Acorta el rango.' });
    }

    async lsKpis() {
        const f = app.getFilters();
        const r = await useFetch({ url: apiKardex, data: { opc: 'showMovimientos', movement_type: f.tipo, fi: f.fi, ff: f.ff } });
        const c = (r && r.status === 200) ? r.counts : {};

        movimientosView.renderInfoCards([
            { id: 'kpiTotal',    label: 'Total Movs', value: parseInt(c.total || 0, 10),           tone: 'default' },
            { id: 'kpiEntradas', label: 'Entradas',   value: parseInt(c.total_entradas || 0, 10),  tone: 'success' },
            { id: 'kpiSalidas',  label: 'Salidas',    value: parseInt(c.total_salidas || 0, 10),   tone: 'danger' },
            { id: 'kpiTransf',   label: 'Traspasos',  value: parseInt(c.total_traspasos || 0, 10), tone: 'info' }
        ]);
    }
}

class MovimientosView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Movimientos';
    }

    // El ojo abre el visor; la X o un cambio de filtros lo ocultan.
    renderDetail(producto) {
        this.productMovimientosPanel({
            parent:  'detailPanel',
            json:    producto,
            onClose: () => app.selectProducto(null)
        });

        invToggleVisor(!!producto);
    }

    // Las tarjetas chicas de inventory/movimientos (solo informan).
    renderInfoCards(rows) {
        this.kpisRow({
            parent:     'kpisRow',
            json:       rows,
            cardClass:  'bg-white rounded-lg border border-gray-200 px-3 py-3',
            labelClass: 'text-[10px] uppercase tracking-wider font-bold text-gray-500',
            valueClass: 'text-sm font-bold'
        });
    }

    renderHeader(data) {
        this.viewHeader({ parent: 'viewHeader', json: data });
    }

    // -- Visor de la derecha: los movimientos del producto --

    productMovimientosPanel(options) {
        const defaults = {
            parent: 'root',
            id:     'productMovimientosPanel',
            class:  'w-full h-full flex-shrink-0 bg-white flex flex-col overflow-hidden',
            json:   null,
            labels: {
                emptyTitle: 'Selecciona un producto',
                emptyHint:  'Haz click en el ojo para listar todos sus movimientos.',
                subtitle:   'Historial de movimientos'
            },
            tipoPalettes: {
                'ENTRADA':       { bg: 'rgba(63,193,137,0.15)', fg: '#15803D' },
                'SALIDA':        { bg: 'rgba(224,36,36,0.15)',  fg: '#B91C1C' },
                'TRANSFERENCIA': { bg: 'rgb(var(--brand-600, 192 90 64) /0.15)', fg: 'rgb(var(--brand-600, 192 90 64))' },
                'AJUSTE':        { bg: 'rgba(167,139,250,0.15)', fg: '#7C3AED' },
                'CANCELACION':   { bg: 'rgba(156,163,175,0.18)', fg: '#4B5563' }
            },
            onClose: () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels       = Object.assign({}, defaults.labels,       o.labels       || {});
        opts.tipoPalettes = Object.assign({}, defaults.tipoPalettes, o.tipoPalettes || {});

        const esc      = invEsc;
        const fmtMoney = invMoney;
        const fmtQty   = (n) => { const v = Number(n || 0); return (v > 0 ? '+' : '') + invQty(v); };
        const DOW      = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
        const MON      = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const fmtFecha = (val) => {
            if (!val) return '-';
            const d = new Date(String(val).replace(' ', 'T'));
            if (isNaN(d.getTime())) return val;
            const base = `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]} ${d.getFullYear()}`;
            if (d.getHours() === 0 && d.getMinutes() === 0) return base;
            let hh = d.getHours();
            const min = String(d.getMinutes()).padStart(2, '0');
            const ampm = hh >= 12 ? 'pm' : 'am';
            hh = hh % 12 || 12;
            return `${base} ${hh}:${min} ${ampm}`;
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

        const p    = opts.json;
        const movs = p.movs || [];
        const neto = Number(p.neto || 0);

        const summaryItem = (label, value, extraClass) => `
            <div class="flex flex-col items-center">
                <span class="text-[9px] uppercase tracking-wider text-gray-400">${esc(label)}</span>
                <span class="text-sm font-bold ${extraClass || 'text-gray-800'}">${value}</span>
            </div>`;

        const movCard = (m) => {
            const qtyColor = Number(m.cant) < 0 ? 'text-red-600' : 'text-green-600';
            const tipoC    = opts.tipoPalettes[m.tipo] || { bg: 'rgba(156,163,175,0.18)', fg: '#6B7280' };

            return `
                <div class="border border-gray-200 rounded-lg p-2.5">
                    <div class="flex items-center justify-between mb-1.5">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0" style="background:${tipoC.bg};color:${tipoC.fg};">${esc(m.tipoTxt)}</span>
                            <span class="text-[10px] text-gray-500 truncate">${esc(m.folio || '-')}</span>
                        </div>
                        <span class="text-[10px] text-gray-400 flex-shrink-0">${esc(fmtFecha(m.fecha))}</span>
                    </div>
                    <div class="flex items-center justify-between text-[11px]">
                        <span class="${qtyColor} font-bold">${fmtQty(m.cant)} <span class="font-normal text-gray-400">${esc(p.unidad)}</span></span>
                        <span class="text-gray-500">${esc(invQty(m.stockPrev))} <span class="text-gray-400">&rarr;</span> <b class="text-gray-700">${esc(invQty(m.stockPost))}</b></span>
                    </div>
                    <div class="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                        <span class="truncate">${esc(m.almacen || '-')}</span>
                        ${m.costoTot !== null ? `<span class="font-semibold text-gray-600 flex-shrink-0">${fmtMoney(Math.abs(m.costoTot))}</span>` : ''}
                    </div>
                    <div class="flex items-center justify-between text-[10px] text-gray-400 mt-0.5">
                        <span class="truncate">${esc(m.usuario || '-')}</span>
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
                <button id="${opts.id}_close" class="text-gray-500 hover:text-gray-700 transition-colors p-1 flex-shrink-0" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>

            <div class="px-3 py-3 flex-shrink-0 border-b border-gray-200">
                <div class="grid grid-cols-4 gap-2">
                    ${summaryItem('Movs', p.count)}
                    ${summaryItem('Entradas', p.entradas, 'text-green-600')}
                    ${summaryItem('Salidas', p.salidas, 'text-red-600')}
                    ${summaryItem('Neto', esc(fmtQty(neto)), neto < 0 ? 'text-red-600' : 'text-green-600')}
                </div>
            </div>

            <div class="flex-1 overflow-y-auto cs-scroll px-3 py-3 space-y-2">
                ${movs.length ? movs.map(movCard).join('') : '<p class="text-[11px] text-gray-400 italic text-center py-6">Sin movimientos para este producto.</p>'}
            </div>`);

        $(`#${opts.parent}`).html(aside);
        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}_close`).on('click', () => opts.onClose(p));
    }
}
