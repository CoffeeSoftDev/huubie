let apiFacturador = 'ctrl/ctrl-facturador.php';
let app, facturador, facturadorView;

let branch_id;

$(async () => {
    facturadorView = new FacturadorView(apiFacturador, 'root');
    facturador     = new Facturador(apiFacturador, 'root');
    app            = new App(apiFacturador, 'root');
    await app.init();
});

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'facturador';
        this.subId        = null;
        this.dia          = SAMPLE_FACTURADOR_DEFAULT_DAY;
    }

    async init() {
        // MODO FAKE: si hubiera backend -> useFetch({ url: apiFacturador, data: { opc: 'init' } })
        this.dataInit = {
            branch_id:      '',
            vistas:         SAMPLE_FACTURADOR_VISTAS,
            meses:          SAMPLE_FACTURADOR_MESES,
            paymentForms:   SAMPLE_FACTURADOR_PAYMENT_FORMS,
            paymentMethods: SAMPLE_FACTURADOR_PAYMENT_METHODS,
            customers:      SAMPLE_FACTURADOR_CUSTOMERS,
            bridgeProducts: SAMPLE_FACTURADOR_BRIDGE_PRODUCTS
        };
        this.subId = this.dataInit.branch_id;
        branch_id  = this.subId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        facturadorView.renderHeader(VIEW_HEADER_FACTURADOR);
        facturadorView.renderFooter();
        facturador.lsFolios();
        facturador.lsKpis();
        facturador.lsResumen();
    }

    layout() {
        const mainPanel = {
            type:  'div',
            id:    'mainPanel',
            class: 'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                { id: 'viewHeader', class: 'flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0' },
                { id: 'filterBar',  class: 'px-3 py-3 bg-white border-b border-gray-200 flex-shrink-0' },
                { id: 'foliosNote', class: 'px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-3 flex-shrink-0' },
                { id: 'kpisRow',    class: 'px-3 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0' },
                { id: 'tableWrap',  class: 'p-3 flex-1 min-h-0 overflow-auto bg-white' },
                { id: 'viewFooter', class: 'px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0' }
            ]
        };

        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'w-full md:w-72 xl:w-80 flex-shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col overflow-hidden',
            children: [
                { id: 'resumenPanel', class: 'flex-1 overflow-auto p-3' }
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

        $('#foliosNote').html(`
            <p class="text-[10px] text-gray-400">todos los tickets del periodo &middot; se omiten efectivos no facturados &middot; los facturados quedan congelados con CFDI vigente</p>
            <span id="foliosCount" class="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold" style="background:#F7F0EB;color:#A84A33;border:1px solid #F0C4B5;">0 tickets</span>
        `);
    }

    filterBar() {
        const filters = [
            {
                opc:      'select',
                id:       'fVista',
                lbl:      'Vista:',
                class:    'col-12 col-md-4 col-lg-3',
                onchange: 'app.onChangeVista()',
                value:    'dia',
                data:     this.dataInit.vistas
            },
            {
                opc:         'input-calendar',
                id:          'fDia',
                lbl:         'Dia:',
                class:       'col-12 col-md-4 col-lg-3',
                readonly:    true,
                placeholder: 'Selecciona un dia',
                value:       '',
                required:    false
            },
            {
                opc:      'select',
                id:       'fMes',
                lbl:      'Mes:',
                class:    'col-12 col-md-4 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value:    '2026-06',
                data:     this.dataInit.meses
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      'light',
            data:       filters
        });

        this.initDayPicker();
        this.togglePeriodo();
    }

    initDayPicker() {
        dataPicker({
            parent: 'fDia',
            type:   'all',
            rangepicker: {
                singleDatePicker:    true,
                startDate:           moment(SAMPLE_FACTURADOR_DEFAULT_DAY),
                autoApply:           true,
                showDropdowns:       true,
                alwaysShowCalendars: true,
                locale: {
                    format:     'YYYY-MM-DD',
                    applyLabel:  'Aplicar',
                    cancelLabel: 'Cancelar',
                    daysOfWeek:  ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'],
                    monthNames:  ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
                    firstDay:    1
                }
            },
            onSelect: (start) => {
                this.dia = start.format('YYYY-MM-DD');
                this.onChangeFilters();
            }
        });
    }

    togglePeriodo() {
        const modo = $('#fVista').val();
        $('#fDia').closest('[class*="col-"]').toggle(modo === 'dia');
        $('#fMes').closest('[class*="col-"]').toggle(modo === 'mes');
    }

    getPeriodo() {
        const modo = $('#fVista').val() || 'dia';
        if (modo === 'todos') {
            return { modo: 'todos', valor: '', label: 'Todos los dias', chip: 'Todos', match: (f) => !!f };
        }
        if (modo === 'mes') {
            const mes = $('#fMes').val() || '';
            return { modo: 'mes', valor: mes, label: mes ? _fmtMes(mes) : '-', chip: 'Mes', match: (f) => !!f && f.startsWith(mes) };
        }
        const dia = this.dia || '';
        return { modo: 'dia', valor: dia, label: dia ? _fmtDate(dia) : '-', chip: 'Dia', match: (f) => f === dia };
    }

    getSalesPeriodo() {
        const per = this.getPeriodo();
        return SAMPLE_FACTURADOR_SALES.filter(s => per.match(s.operationDate));
    }

    onChangeVista() {
        this.togglePeriodo();
        this.onChangeFilters();
    }

    onChangeFilters() {
        facturador.lsFolios();
        facturador.lsKpis();
        facturador.lsResumen();
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    openPctConfig() {
        facturadorView.openPctConfig();
    }
}

class Facturador extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'facturador';
    }

    lsFolios() {
        // MODO FAKE: si hubiera backend -> useFetch({ url: apiFacturador, data: Object.assign({ opc: 'lsFolios' }, app.getPeriodo()) })
        const per       = app.getPeriodo();
        const salesDia  = app.getSalesPeriodo();
        const tasaPorId = _calcTasasDia(salesDia);
        const visibles  = salesDia.filter(s => _isInvoiced(s) || !_isCashOnly(s));

        const data = { row: visibles.map(s => _folioRow(s, tasaPorId[s.id])) };

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'invernal',
            center:       [3, 4, 6],
            right:        [5],
            actionsAlign: 'left',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       13,
            emptyMessage: `Sin tickets en ${per.label}`,
            emptyIcon:    'icon-printer',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        const total = (data.row || []).length;
        if (total > 0 && typeof simple_data_table === 'function') {
            simple_data_table(`#tb${this.PROJECT_NAME}`, 10);
        }

        $('#foliosCount').text(`${total} ticket${total !== 1 ? 's' : ''}`);
    }

    lsKpis() {
        // MODO FAKE: si hubiera backend -> useFetch({ url: apiFacturador, data: { opc: 'showKpis', ...app.getPeriodo() } })
        const st = _computeStats(app.getSalesPeriodo());

        const kpis = [
            { id: 'kpiTotal',       label: 'Cuenta total',        value: _money(st.totalReal),  tone: 'default' },
            { id: 'kpiMeta',        label: 'Meta a facturar 16%', value: _money(st.meta),       tone: 'purple'  },
            { id: 'kpiFacturado',   label: 'Ya facturado',        value: _money(st.totalFact),  tone: 'success' },
            { id: 'kpiPorFacturar', label: 'Falta por facturar',  value: _money(st.aFacturar),  tone: 'warning' }
        ];
        facturadorView.renderInfoCards(kpis);
    }

    lsResumen() {
        const st = _computeStats(app.getSalesPeriodo());
        facturadorView.renderResumen(st, app.getPeriodo());

        app.updateFooterInfo(`Mostrando ${st.visiblesCount} ticket${st.visiblesCount !== 1 ? 's' : ''} · Facturados ${st.facturadasCount} (${_money(st.totalFact)}) · Pendientes ${st.pendientesCount} (${_money(st.montoPend)})`);
    }

    getTicket(saleId) {
        const sale = SAMPLE_FACTURADOR_SALES.find(s => s.id === saleId);
        if (!sale) return null;
        return _buildVirtualTicket(sale);
    }

    tasaDeVenta(saleId) {
        const sale = SAMPLE_FACTURADOR_SALES.find(s => s.id === saleId);
        if (!sale) return '';
        return _calcTasasDia(app.getSalesPeriodo())[sale.id] || '';
    }

    setMetaPct(pct) {
        // MODO FAKE: si hubiera backend -> useFetch({ url: apiFacturador, data: { opc: 'saveMeta', porcentaje: pct } })
        SAMPLE_FACTURADOR_META.porcentaje = pct / 100;
        app.onChangeFilters();
    }
}

class FacturadorView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'facturador';
    }

    renderHeader(data) {
        this.viewHeader({ parent: 'viewHeader', json: data });
    }

    renderFooter() {
        this.viewFooter({
            parent: 'viewFooter',
            json: {
                info: '',
                legends: [
                    { tone: 'terra',   label: '16% (a facturar)' },
                    { tone: 'gray',    label: '0% (se queda)' },
                    { tone: 'success', label: 'Facturado (CFDI)' }
                ]
            }
        });
    }

    renderInfoCards(rows) {
        this.kpisRow({ parent: 'kpisRow', json: rows, onClick: () => {} });
    }

    renderResumen(st, per) {
        this.resumenPanel({
            parent: 'resumenPanel',
            json:   st,
            period: per,
            onConfig: () => app.openPctConfig()
        });
    }

    openTicket(saleId) {
        const ticket = facturador.getTicket(saleId);
        if (!ticket) {
            this.alertBox({ type: 'error', title: 'No se pudo generar el ticket virtual' });
            return;
        }
        this.ticketFmt = this.ticketFmt || 'wansoft';
        this.ticketModal({
            json:       ticket,
            tasa:       facturador.tasaDeVenta(saleId),
            fmt:        this.ticketFmt,
            onSwap:     (fmt) => { this.ticketFmt = fmt; },
            onRegen:    () => facturador.getTicket(saleId),
            onPrint:    (t, fmt) => this.printTicketDoc(t, fmt)
        });
    }

    openPctConfig() {
        const modal = this.cfModal({
            title:    'Porcentaje de facturacion',
            theme:    'light',
            size:     'small',
            okLabel:  'Guardar',
            onOk:     () => { if (this.pctFormEl) this.pctFormEl.trigger('submit'); }
        });

        const host = $('<div>', { id: 'pctConfigHost' });
        modal.body.append(host);

        this.pctFormEl = this.coffeeForm({
            parent:  'pctConfigHost',
            id:      'pctConfigForm',
            Element: 'form',
            theme:   'light',
            json: [
                { opc: 'input', type: 'number', tipo: 'numero', id: 'cfgPct', name: 'porcentaje', lbl: 'Porcentaje que se factura al 16% (el resto queda en 0%)', class: 'col-12', value: Math.round((SAMPLE_FACTURADOR_META.porcentaje || 0.70) * 100), required: true }
            ],
            onSave: (d) => {
                const v = parseFloat(d.porcentaje);
                if (isNaN(v) || v < 0 || v > 100) {
                    this.alertBox({ type: 'error', title: 'Porcentaje invalido (0 a 100)' });
                    return;
                }
                facturador.setMetaPct(v);
                modal.close();
                this.alertBox({ type: 'success', title: `Porcentaje de facturacion: ${Math.round(v)}%`, timer: 1400 });
            }
        });
    }

    viewHeader(options) {
        const defaults = {
            parent:  'root',
            id:      'viewHeader',
            class:   'flex items-center justify-between w-full',
            json:    { title: '', subtitle: '' },
            classes: {
                title:    'text-lg font-bold text-gray-800',
                subtitle: 'text-xs text-gray-500'
            }
        };

        const opts = Object.assign({}, defaults, options || {});
        opts.json    = Object.assign({}, defaults.json,    (options || {}).json    || {});
        opts.classes = Object.assign({}, defaults.classes, (options || {}).classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html(`
            <div class="flex items-center gap-2.5">
                <span class="w-8 h-8 rounded-lg flex items-center justify-center text-white" style="background:linear-gradient(135deg,#C05A40 0%,#E8A68F 100%);">
                    <i data-lucide="printer" class="w-4 h-4"></i>
                </span>
                <div>
                    <h1 class="${opts.classes.title}">${esc(opts.json.title)}</h1>
                    ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
                </div>
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }

    viewFooter(options) {
        const defaults = {
            parent: 'root',
            id:     'viewFooter',
            class:  'flex items-center justify-between w-full',
            json:   { info: '', legends: [] },
            tones: {
                default: '#9CA3AF',
                success: '#15803D',
                warning: '#B45309',
                terra:   '#C05A40',
                gray:    '#9CA3AF'
            }
        };

        const opts = Object.assign({}, defaults, options || {});
        opts.json  = Object.assign({}, defaults.json,  (options || {}).json  || {});
        opts.tones = Object.assign({}, defaults.tones, (options || {}).tones || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const toneColor = (tone) => opts.tones[tone] || opts.tones.default;

        const legendsHtml = (opts.json.legends || []).map(lg => `
            <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full" style="background:${toneColor(lg.tone)};"></span>
                ${esc(lg.label)}
            </span>
        `).join('');

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html(`
            <p id="${opts.id}_info" class="text-[10px] text-gray-500">${esc(opts.json.info)}</p>
            <div class="flex items-center gap-3 text-[10px] text-gray-500">${legendsHtml}</div>
        `);

        $(`#${opts.parent}`).html(wrap);
    }

    kpisRow(options) {
        const defaults = {
            parent:     'root',
            id:         'kpisRow',
            class:      'grid grid-cols-2 md:grid-cols-4 gap-4',
            json:       [],
            tones: {
                default: 'text-gray-800',
                success: 'text-green-600',
                warning: 'text-[#A84A33]',
                danger:  'text-red-600',
                info:    'text-blue-600',
                purple:  'text-[#C05A40]'
            },
            cardClass:  'bg-white rounded-lg border border-gray-200 px-4 py-3',
            labelClass: 'text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-1 text-left',
            valueClass: 'text-xl font-extrabold text-right',
            onClick:    () => {}
        };

        const opts = Object.assign({}, defaults, options || {});
        opts.tones = Object.assign({}, defaults.tones, (options || {}).tones || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const toneClass = (tone) => opts.tones[tone] || opts.tones.default;

        const grid = $('<div>', { id: opts.id, class: opts.class });
        grid.html(opts.json.map((kpi, idx) => `
            <div id="${kpi.id || opts.id + '_' + idx}" data-kpi-idx="${idx}" class="${opts.cardClass}">
                <p class="${opts.labelClass}">${esc(kpi.label)}</p>
                <p class="${opts.valueClass} ${toneClass(kpi.tone)}">${esc(kpi.value)}</p>
            </div>
        `).join(''));

        $(`#${opts.parent}`).html(grid);
    }

    resumenPanel(options) {
        const opts = Object.assign({ parent: 'resumenPanel', json: {}, period: {}, onConfig: () => {} }, options || {});
        const st  = opts.json;
        const pctFact  = Math.round((st.pct || 0.70) * 100);
        const pctCero  = 100 - pctFact;

        const $parent = $(`#${opts.parent}`);
        if (!$parent.length) return;

        $parent.html(`
            <div class="flex items-center gap-2 mb-1">
                <i data-lucide="calculator" class="w-3.5 h-3.5 text-[#C05A40]"></i>
                <h3 class="text-[11px] font-bold text-gray-800">Resumen de facturacion</h3>
                <button id="resumenConfigBtn" class="ml-auto text-gray-400 hover:text-[#C05A40]" title="Configurar porcentaje">
                    <i data-lucide="settings" class="w-3.5 h-3.5"></i>
                </button>
            </div>
            <p class="text-[9px] text-gray-400 mb-2">${opts.period.chip || ''} &middot; ${opts.period.label || ''}</p>

            <div class="flex flex-col gap-2">
                <div class="rounded-md bg-gray-50 border border-gray-100 px-2.5 py-2">
                    <div class="flex items-center justify-between">
                        <span class="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Cuenta total</span>
                        <span class="text-[9px] font-extrabold text-gray-500">100%</span>
                    </div>
                    <p class="text-base font-extrabold text-gray-900 leading-tight">${_money(st.totalReal)}</p>
                    <p class="text-[8px] text-gray-400 leading-tight">${st.ticketsCount || 0} tickets &middot; todos los pagos</p>
                </div>

                <div class="rounded-md px-2.5 py-2" style="background:#FBF1ED;border:1px solid #F5E3DC;">
                    <div class="flex items-center justify-between">
                        <span class="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Meta a facturar 16%</span>
                        <span class="text-[9px] font-extrabold text-[#C05A40]">${pctFact}%</span>
                    </div>
                    <p class="text-base font-extrabold text-[#C05A40] leading-tight">${_money(st.meta)}</p>
                    <p class="text-[8px] text-gray-400 leading-tight">parte del total que se factura con IVA</p>
                </div>

                <div class="ml-2 pl-2 flex flex-col gap-2" style="border-left:2px solid #F0C4B5;">
                    <div class="rounded-md bg-green-50 border border-green-100 px-2.5 py-2">
                        <span class="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Ya facturado</span>
                        <p class="text-base font-extrabold text-green-700 leading-tight">${_money(st.totalFact)}</p>
                        <p class="text-[8px] text-gray-400 leading-tight">${st.facturadasCount || 0} ordenes bloqueadas &middot; ${(st.logrado || 0).toFixed(1)}% logrado</p>
                    </div>
                    <div class="rounded-md px-2.5 py-2" style="background:#FBF1ED;border:1px solid #F0C4B5;">
                        <span class="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Falta por facturar</span>
                        <p class="text-base font-extrabold text-[#A84A33] leading-tight">${_money(st.aFacturar)}</p>
                        <p class="text-[8px] text-gray-400 leading-tight">= meta - ya facturado</p>
                    </div>
                </div>

                <div class="rounded-md bg-gray-50 border border-gray-100 px-2.5 py-2">
                    <div class="flex items-center justify-between">
                        <span class="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Se queda en 0%</span>
                        <span class="text-[9px] font-extrabold text-gray-500">${pctCero}%</span>
                    </div>
                    <p class="text-base font-extrabold text-gray-900 leading-tight">${_money(st.cero)}</p>
                    <p class="text-[8px] text-gray-400 leading-tight">resto del total &middot; no se factura</p>
                </div>
            </div>
        `);

        if (window.lucide) lucide.createIcons();
        $parent.find('#resumenConfigBtn').on('click', () => opts.onConfig());
    }

    buildTicketHtml(t, fmt) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const sep = '<div style="border-top:1px dashed #9CA3AF;margin:8px 0;"></div>';

        if (fmt === 'softrestaurant') {
            const items = t.items.map(it => `<tr><td>${it.qty}&nbsp;&nbsp;${esc(it.name)}</td><td style="text-align:right">${_money(it.qty * it.price)}</td></tr>`).join('');
            const disc  = t.discount > 0 ? `<tr><td>DESCUENTO:</td><td style="text-align:right;color:#9D3434">-${_money(t.discount)}</td></tr>` : '';
            const iva   = t.total - t.total / (1 + (SAMPLE_FACTURADOR_META.tasaIva || 0.16));
            return `
                <div style="text-align:center">
                    <p style="font-weight:700;font-size:13px;letter-spacing:1px">RESTAURANT</p>
                    <p>Av. Central Norte 45, Tapachula, Chis.</p>
                    <p>Tel. (962) 555-0134</p>
                </div>${sep}
                <table>
                    <tr><td>CHEQUE:</td><td style="text-align:right;font-weight:700">#${esc(t.nota)}</td></tr>
                    <tr><td>FECHA:</td><td style="text-align:right">${_fmtDate(t.date)}</td></tr>
                    <tr><td>MESA:</td><td style="text-align:right">${esc(t.mesa || '-')}</td></tr>
                    <tr><td>LE ATENDIO:</td><td style="text-align:right">${esc(t.mesero || '-')}</td></tr>
                    <tr><td>ESTACION:</td><td style="text-align:right">${esc(t.terminal || '-')}</td></tr>
                </table>${sep}
                <table>
                    <tr><td style="font-weight:700">CANT DESCRIPCION</td><td style="text-align:right;font-weight:700">IMPORTE</td></tr>
                    ${items}
                </table>${sep}
                <table>
                    <tr><td>SUBTOTAL:</td><td style="text-align:right">${_money(t.subtotal)}</td></tr>
                    ${disc}
                    <tr><td style="font-weight:700;font-size:13px">TOTAL:</td><td style="text-align:right;font-weight:700;font-size:13px">${_money(t.total)}</td></tr>
                    <tr><td>IVA INCLUIDO:</td><td style="text-align:right">${_money(iva)}</td></tr>
                </table>${sep}
                <div style="text-align:center">
                    <p>FORMA DE PAGO: ${esc(t.paymentForm)}</p>
                    <p style="margin-top:4px">PROPINA NO INCLUIDA</p>
                    <p style="margin-top:6px">GRACIAS POR SU VISITA</p>
                    <p style="margin-top:6px;color:#6B7280">Este ticket no es un comprobante fiscal</p>
                    <p style="margin-top:4px;color:#6B7280;font-size:10px">SoftRestaurant</p>
                </div>`;
        }

        const items = t.items.map(it => `<tr><td style="text-align:center">${it.qty}</td><td>${esc(it.name)}</td><td style="text-align:right">${_money(it.price)}</td><td style="text-align:right">${_money(it.qty * it.price)}</td></tr>`).join('');
        const disc  = t.discount > 0 ? `<tr><td colspan="3">Descuento:</td><td style="text-align:right;color:#9D3434">-${_money(t.discount)}</td></tr>` : '';
        return `
            <div style="text-align:center">
                <p style="font-weight:700;font-size:13px;letter-spacing:1px">RESTAURANT</p>
                <p>Av. Central Norte 45, Tapachula, Chis.</p>
                <p>Tel. (962) 555-0134</p>
            </div>${sep}
            <p style="text-align:center;font-weight:700;font-size:13px">CUENTA #${esc(t.nota)}</p>
            <table>
                <tr><td>Fecha:</td><td style="text-align:right">${_fmtDate(t.date)}</td></tr>
                <tr><td>Terminal:</td><td style="text-align:right">${esc(t.terminal || '-')}</td></tr>
                <tr><td>Mesa:</td><td style="text-align:right">${esc(t.mesa || '-')}</td></tr>
                <tr><td>Atendio:</td><td style="text-align:right">${esc(t.mesero || '-')}</td></tr>
            </table>${sep}
            <table>
                <tr><td style="font-weight:700;text-align:center">Cant</td><td style="font-weight:700">Producto</td><td style="font-weight:700;text-align:right">Precio</td><td style="font-weight:700;text-align:right">Total</td></tr>
                ${items}
            </table>${sep}
            <table>
                <tr><td colspan="3">Subtotal:</td><td style="text-align:right">${_money(t.subtotal)}</td></tr>
                ${disc}
                <tr><td colspan="3" style="font-weight:700;font-size:13px">Total:</td><td style="text-align:right;font-weight:700;font-size:13px">${_money(t.total)}</td></tr>
            </table>${sep}
            <div style="text-align:center">
                <p>Forma de pago: ${esc(t.paymentForm)}</p>
                <p style="margin-top:6px">Gracias por su preferencia</p>
                <p style="margin-top:6px;color:#6B7280">Documento sin valor fiscal</p>
                <p style="margin-top:4px;color:#6B7280;font-size:10px">Powered by Wansoft</p>
            </div>`;
    }

    ticketModal(options) {
        const opts = Object.assign({ json: null, tasa: '', fmt: 'wansoft', onSwap: () => {}, onRegen: () => null, onPrint: () => {} }, options || {});
        let ticket = opts.json;
        let fmt    = opts.fmt;
        if (!ticket) return;

        $('#facturadorTicketModal').remove();

        const paperStyle = "background:#fff;border:1px solid #E5E7EB;border-radius:10px;font-family:'Courier New',ui-monospace,monospace;font-size:11px;color:#1F2937;padding:22px 20px;max-width:320px;margin:0 auto;line-height:1.5;";

        const overlay = $('<div>', {
            id: 'facturadorTicketModal',
            style: 'position:fixed;inset:0;background:rgba(17,25,40,.5);z-index:60;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px;'
        });

        overlay.html(`
            <div style="background:#fff;border-radius:14px;max-width:420px;width:100%;margin:auto;box-shadow:0 12px 40px rgba(17,25,40,.25);">
                <div class="flex items-center justify-between" style="padding:14px 18px;border-bottom:1px solid #F3F4F6;">
                    <div class="flex items-center gap-2">
                        <i data-lucide="receipt" class="w-4 h-4 text-[#C05A40]"></i>
                        <h3 class="text-sm font-bold text-gray-800">Ticket virtual <span id="ticketModalOrden" class="text-[#C05A40]"></span></h3>
                    </div>
                    <button id="ticketModalClose" class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
                <div style="padding:18px;max-height:60vh;overflow:auto;background:#FAFCFF;">
                    <div id="ticketPaper" style="${paperStyle}"></div>
                </div>
                <div class="flex items-center gap-2" style="padding:12px 18px;border-top:1px solid #F3F4F6;background:#FAFCFF;border-radius:0 0 14px 14px;">
                    <button id="ticketSwap" class="flex items-center gap-1.5 text-xs font-semibold" style="background:#fff;color:#374151;border:1px solid #E5E7EB;padding:8px 12px;border-radius:8px;">
                        <i data-lucide="repeat" class="w-3.5 h-3.5"></i><span id="ticketSwapLabel"></span>
                    </button>
                    <button id="ticketRegen" class="flex items-center gap-1.5 text-xs font-semibold" style="background:#fff;color:#374151;border:1px solid #E5E7EB;padding:8px 12px;border-radius:8px;">
                        <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>Regenerar
                    </button>
                    <button id="ticketPrint" class="flex items-center gap-1.5 text-xs font-semibold text-white ml-auto" style="background:#C05A40;padding:8px 16px;border-radius:8px;">
                        <i data-lucide="printer" class="w-3.5 h-3.5"></i>Imprimir
                    </button>
                </div>
            </div>
        `);

        $('body').append(overlay);

        const paint = () => {
            overlay.find('#ticketModalOrden').text('#' + ticket.nota);
            overlay.find('#ticketPaper').html(this.buildTicketHtml(ticket, fmt));
            overlay.find('#ticketSwapLabel').text(fmt === 'wansoft' ? 'Cambiar a SoftRestaurant' : 'Cambiar a Wansoft');
            overlay.find('#ticketRegen').toggle(opts.tasa === '0%');
            if (window.lucide) lucide.createIcons();
        };

        paint();

        overlay.on('click', '#ticketModalClose', () => overlay.remove());
        overlay.on('mousedown', (e) => { if (e.target === overlay[0]) overlay.remove(); });
        overlay.on('click', '#ticketSwap', () => { fmt = (fmt === 'wansoft') ? 'softrestaurant' : 'wansoft'; opts.onSwap(fmt); paint(); });
        overlay.on('click', '#ticketRegen', () => { const t = opts.onRegen(); if (t) { ticket = t; paint(); } });
        overlay.on('click', '#ticketPrint', () => opts.onPrint(ticket, fmt));
    }

    printTicketDoc(t, fmt) {
        const inner = this.buildTicketHtml(t, fmt);
        const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ticket #${t.nota}</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',ui-monospace,monospace;background:#c8c8c8;padding:24px}.toolbar{max-width:320px;margin:0 auto 14px;display:flex;justify-content:flex-end;gap:8px}.btn{cursor:pointer;border:none;border-radius:6px;padding:8px 16px;font-size:12px;font-weight:700;color:#fff;background:#C05A40;font-family:'Inter',sans-serif}.btn.gray{background:#777}.paper{background:#fff;max-width:320px;margin:0 auto;padding:22px 20px;font-size:11px;color:#1F2937;line-height:1.5;box-shadow:0 2px 10px rgba(0,0,0,.25)}.paper table{width:100%}.paper td{padding:2px 0;font-size:11px}@media print{body{background:#fff;padding:0}.toolbar{display:none}.paper{box-shadow:none;max-width:none}}</style>
        </head><body>
        <div class="toolbar"><button class="btn" onclick="window.print()">Imprimir</button><button class="btn gray" onclick="window.close()">Cerrar</button></div>
        <div class="paper">${inner}</div>
        </body></html>`;

        const w = window.open('', '_blank', 'width=420,height=760');
        if (!w) { this.alertBox({ type: 'warning', title: 'Permite las ventanas emergentes para imprimir el ticket.' }); return; }
        w.document.write(html);
        w.document.close();
        w.focus();
    }
}
