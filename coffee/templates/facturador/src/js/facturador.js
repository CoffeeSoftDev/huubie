let apiFacturador = 'ctrl/ctrl-facturador.php';
let app, facturador, facturadorView;

let branch_id;

const FACTURADOR_TABS = [
    { id: 'folios',    label: 'Folios',    icon: 'printer',          title: 'Folios · consulta de tickets', subtitle: 'Reparto 70/30 y ticket virtual', periodo: true },
    { id: 'resumen',   label: 'Resumen',   icon: 'layout-dashboard', title: 'Resumen',                      subtitle: 'Avance de la meta de facturación', periodo: true },
    { id: 'ventas',    label: 'Ventas',    icon: 'credit-card',      title: 'Venta por pago',               subtitle: 'Cada renglón es un pago aplicado a una orden', periodo: true },
    { id: 'detallado', label: 'Detallado', icon: 'list',             title: 'Detallado',                    subtitle: 'Tickets del POS línea por línea', periodo: true },
    { id: 'facturas',  label: 'Facturas',  icon: 'file-check-2',     title: 'Facturados',                   subtitle: 'CFDI emitidos en el periodo', periodo: true },
    { id: 'catalogos', label: 'Catálogo',  icon: 'book-open',        title: 'Catálogos',                    subtitle: 'Productos puente, clientes y parámetros', periodo: false }
];

const HEAD_FOLIOS    = ['Orden', 'ID', 'Facturado', 'Folio', 'Monto', '16%', ''];
const HEAD_ACUMULADO = ['ID', 'Orden', 'Forma de pago', 'Monto'];
const HEAD_PENDING   = ['ID', 'Orden', 'Monto', 'Tasa'];
const HEAD_FACTURADO = ['ID', 'Orden', 'Folio', 'Monto'];
const HEAD_VENTAS    = ['ID', 'Facturado', 'Forma de pago', 'Fecha', 'Orden', 'Mov. PDV', 'Estatus', 'Mesero', 'Terminal', 'Total', 'Propina', 'Total cobrado'];
const HEAD_DETALLADO = ['Día', 'Fecha', 'Orden', 'Mesa', 'Personas', 'Mesero', 'Terminal', 'Subtotal', 'IVA', 'IEPS', 'Total', 'Cant.', 'P. unit.', 'Platillo / Artículo', 'Clave', 'Modificador'];
const HEAD_FACTURAS  = ['Folio', 'RFC', 'Nombre / Razón social', 'Referencia', 'Estatus', 'Fecha', 'Subtotal', 'IVA', 'IEPS', 'Total', 'UUID', 'Forma', 'Método', 'Orden', 'Fecha op.', 'Tipo'];
const HEAD_BRIDGE    = ['Clave', 'Platillo / Artículo', 'Precio', ''];
const HEAD_CUSTOMERS = ['RFC', 'Razón social', ''];

const _formaPagoName = (code) => {
    const f = SAMPLE_FACTURADOR_PAYMENT_FORMS.find(x => x.code === code);
    return f ? f.name : code;
};

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
        this.activeTab    = 'folios';
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

        this.layout();
        this.filterBar();
        this.bindRail();
        this.showTab(this.activeTab);
    }

    layout() {
        const shell = $('<div>', { class: 'flex-1 min-h-0 w-full flex flex-col gap-3 overflow-hidden' });
        shell.append($('<div>', { id: 'periodoBar', class: 'bg-white rounded-lg border border-gray-200 px-3 py-3 flex-shrink-0' }));
        shell.append($('<div>', { id: 'tabHost',    class: 'flex-1 min-h-0 overflow-hidden flex' }));
        $('#root').html(shell);
    }

    filterBar() {
        const filters = [
            {
                opc:      'select',
                id:       'fVista',
                lbl:      'Vista:',
                class:    'col-12 col-md-3 col-lg-2',
                onchange: 'app.onChangeVista()',
                value:    'dia',
                data:     this.dataInit.vistas
            },
            {
                opc:         'input-calendar',
                id:          'fDia',
                lbl:         'Día:',
                class:       'col-12 col-md-4 col-lg-3',
                readonly:    true,
                placeholder: 'Selecciona un día',
                value:       '',
                required:    false
            },
            {
                opc:      'select',
                id:       'fMes',
                lbl:      'Mes:',
                class:    'col-12 col-md-4 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value:    SAMPLE_FACTURADOR_DEFAULT_MONTH,
                data:     this.dataInit.meses
            }
        ];

        this.createfilterBar({
            parent:     'periodoBar',
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

    bindRail() {
        $('#menu-sidebar .menu-rail-item').toArray().forEach(el => {
            const tab = $(el).data('tab');
            if (!tab) return;
            $(el).on('click', () => this.showTab(tab));
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
            return { modo: 'todos', valor: '', label: 'Todos los días', chip: 'Todos', match: (f) => !!f };
        }
        if (modo === 'mes') {
            const mes = $('#fMes').val() || '';
            return { modo: 'mes', valor: mes, label: mes ? _fmtMes(mes) : '-', chip: 'Mes', match: (f) => !!f && f.startsWith(mes) };
        }
        const dia = this.dia || '';
        return { modo: 'dia', valor: dia, label: dia ? _fmtDate(dia) : '-', chip: 'Día', match: (f) => f === dia };
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
        this.renderActiveTab();
    }

    showTab(name) {
        this.activeTab = name;
        const meta = FACTURADOR_TABS.find(t => t.id === name);

        $('#menu-sidebar .menu-rail-item').removeClass('is-active');
        $(`#menu-sidebar .menu-rail-item[data-tab="${name}"]`).addClass('is-active');

        $('#periodoBar').toggle(!!(meta && meta.periodo));

        this.renderActiveTab();
    }

    renderActiveTab() {
        const name = this.activeTab;
        if (name === 'folios')    { facturador.lsFolios();    return; }
        if (name === 'resumen')   { facturador.lsResumen();   return; }
        if (name === 'ventas')    { facturador.lsVentas();    return; }
        if (name === 'detallado') { facturador.lsDetallado(); return; }
        if (name === 'facturas')  { facturador.lsFacturas();  return; }
        if (name === 'catalogos') { facturador.lsCatalogos(); return; }
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
        const st        = _computeStats(salesDia);

        facturadorView.foliosShell(FACTURADOR_TABS[0]);

        const rows = visibles.map(s => {
            const inv  = _invoiceOf(s);
            const fact = _isInvoiced(s);
            return {
                orden:     `<span class="font-semibold" style="color:#C05A40">${s.orderSeq || '-'}</span>`,
                posref:    `<span style="font-size:10px;color:#9CA3AF">${s.posRef || '-'}</span>`,
                facturado: fact ? '<i data-lucide="check-circle" class="w-4 h-4 text-green-600 inline-block"></i>' : '<span class="text-gray-300">—</span>',
                folio:     inv ? _badgeFolio(inv.folio) : '<span class="text-gray-300">—</span>',
                monto:     `<span class="font-semibold text-gray-800">${_money(_ticketTotal(s))}</span>`,
                tasa:      _badgeTasa(tasaPorId[s.id], fact),
                accion:    `<button class="ct-print" title="Imprimir" onclick="facturadorView.openTicket(${s.id})"><i data-lucide="printer" class="w-4 h-4"></i></button>`
            };
        });

        this.createCoffeeTable3({
            parent:       'foliosTable',
            id:           'tbFolios',
            theme:        'invernal',
            center:       [3, 6, 7],
            right:        [5],
            actionsAlign: 'center',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       11,
            emptyMessage: `Sin tickets en ${per.label}`,
            emptyIcon:    'icon-printer',
            data:         { thead: HEAD_FOLIOS, row: rows }
        });

        if (window.lucide) lucide.createIcons();

        const total = rows.length;
        if (total > 0 && typeof simple_data_table === 'function') simple_data_table('#tbFolios', 10);
        $('#foliosCount').text(`${total} ticket${total !== 1 ? 's' : ''}`);

        facturadorView.resumenPanel({ parent: 'resumenPanel', json: st, period: per, onConfig: () => app.openPctConfig() });
    }

    lsResumen() {
        const salesDia  = app.getSalesPeriodo();
        const st        = _computeStats(salesDia);
        const tasaPorId = _calcTasasDia(salesDia);

        facturadorView.resumenShell(FACTURADOR_TABS[1]);

        const pagos = salesDia.flatMap(s => s.payments.map(p => ({ s, p })));
        const rowsAcum = pagos.map(({ s, p }) => ({
            posref: `<span style="font-size:11px;color:#6B7280">${s.posRef}</span>`,
            orden:  s.orderSeq,
            forma:  _formaPagoName(p.formCode),
            monto:  `<span class="text-gray-800">${_money(p.totalCharged)}</span>`
        }));
        this.createCoffeeTable3({ parent: 'tblAcumulado', id: 'tbAcum', theme: 'light', right: [4], extends: true, scrollable: false, f_size: 11, emptyMessage: 'Sin pagos', emptyIcon: 'icon-doc', data: { thead: HEAD_ACUMULADO, row: rowsAcum } });

        const pend = salesDia.filter(s => !_isInvoiced(s) && s.payments.some(p => p.formCode === '04'));
        const rowsPend = pend.map(s => ({
            posref: `<span style="font-size:11px;color:#6B7280">${s.posRef}</span>`,
            orden:  s.orderSeq,
            monto:  `<span class="text-gray-800">${_money(_ticketTotal(s))}</span>`,
            tasa:   _badgeTasa(tasaPorId[s.id], false)
        }));
        this.createCoffeeTable3({ parent: 'tblPending', id: 'tbPend', theme: 'light', right: [3], center: [4], extends: true, scrollable: false, f_size: 11, emptyMessage: 'Sin pendientes', emptyIcon: 'icon-doc', data: { thead: HEAD_PENDING, row: rowsPend } });

        const fact = salesDia.filter(_isInvoiced);
        const rowsFact = fact.map(s => {
            const inv = _invoiceOf(s);
            return {
                posref: `<span style="font-size:11px;color:#6B7280">${s.posRef}</span>`,
                orden:  s.orderSeq,
                folio:  inv ? _badgeFolio(inv.folio) : '—',
                monto:  `<span class="text-green-700 font-semibold">${_money(_ticketTotal(s))}</span>`
            };
        });
        this.createCoffeeTable3({ parent: 'tblFacturado', id: 'tbFact', theme: 'light', right: [4], extends: true, scrollable: false, f_size: 11, emptyMessage: 'Sin facturas', emptyIcon: 'icon-doc', data: { thead: HEAD_FACTURADO, row: rowsFact } });

        facturadorView.fillResumenKpis(st);
        if (window.lucide) lucide.createIcons();
    }

    lsVentas() {
        const salesDia = app.getSalesPeriodo();
        facturadorView.ventasShell(FACTURADOR_TABS[2]);

        const rows = [];
        let pagosN = 0, tarjeta = 0, efectivo = 0;
        const ordenes = new Set();
        salesDia.forEach(s => {
            const fact = _isInvoiced(s);
            ordenes.add(`${s.operationDate}-${s.orderSeq}`);
            s.payments.forEach(p => {
                pagosN++;
                if (p.formCode === '04') tarjeta += p.totalCharged || 0; else efectivo += p.totalCharged || 0;
                rows.push({
                    posref:   `<span style="font-size:11px;color:#6B7280">${s.posRef}</span>`,
                    fact:     fact ? '<span class="badge-base b-green">Sí</span>' : '<span class="text-gray-300">—</span>',
                    forma:    _formaPagoName(p.formCode),
                    fecha:    _fmtDate(s.operationDate),
                    orden:    s.orderSeq,
                    mov:      s.posMovement,
                    estatus:  s.status,
                    mesero:   _nullCell(s.mesero),
                    terminal: _nullCell(s.terminal),
                    total:    `<span class="text-gray-800">${_money(p.amount)}</span>`,
                    propina:  _money(p.tip || 0),
                    cobrado:  `<span class="font-semibold text-gray-800">${_money(p.totalCharged)}</span>`
                });
            });
        });

        this.createCoffeeTable3({
            parent: 'ventasTable', id: 'tbVentas', theme: 'invernal',
            center: [2, 7], right: [10, 11, 12], extends: true, scrollable: true, f_size: 11,
            emptyMessage: 'Sin pagos en el periodo', emptyIcon: 'icon-credit-card',
            data: { thead: HEAD_VENTAS, row: rows }
        });

        facturadorView.fillVentasKpis({ pagos: pagosN, ordenes: ordenes.size, tarjeta, efectivo, foot: `${pagosN} pago${pagosN !== 1 ? 's' : ''}` });
        if (rows.length > 0 && typeof simple_data_table === 'function') simple_data_table('#tbVentas', 15);
        if (window.lucide) lucide.createIcons();
    }

    lsDetallado() {
        const salesDia = app.getSalesPeriodo();
        facturadorView.detalladoShell(FACTURADOR_TABS[3]);

        const rows = [];
        salesDia.forEach(s => {
            (s.details || []).forEach(d => {
                rows.push({
                    dia:        s.day,
                    fecha:      _fmtDate(s.operationDate),
                    orden:      s.orderSeq,
                    mesa:       _nullCell(s.mesa),
                    personas:   _nullCell(s.personas),
                    mesero:     _nullCell(s.mesero),
                    terminal:   _nullCell(s.terminal),
                    subtotal:   _money(d.subtotal),
                    iva:        _money(d.iva),
                    ieps:       _money(0),
                    total:      `<span class="font-semibold text-gray-800">${_money(d.total)}</span>`,
                    cant:       d.qty,
                    punit:      _money(d.price),
                    platillo:   d.name,
                    clave:      `<span style="font-size:11px;color:#6B7280">${d.clave}</span>`,
                    modificador: _nullCell(d.modifier)
                });
            });
        });

        this.createCoffeeTable3({
            parent: 'detalladoTable', id: 'tbDet', theme: 'invernal',
            center: [1, 3, 4, 5, 12], right: [8, 9, 10, 11, 13], extends: true, scrollable: true, f_size: 11,
            emptyMessage: 'Sin renglones en el periodo', emptyIcon: 'icon-list',
            data: { thead: HEAD_DETALLADO, row: rows }
        });

        facturadorView.setFoot('detFoot', `${rows.length} renglón${rows.length !== 1 ? 'es' : ''}`);
        if (rows.length > 0 && typeof simple_data_table === 'function') simple_data_table('#tbDet', 15);
    }

    lsFacturas() {
        const per = app.getPeriodo();
        const invoices = SAMPLE_FACTURADOR_INVOICES.filter(i => per.match(i.invoiceDate) || per.match(i.operationDate));
        facturadorView.facturasShell(FACTURADOR_TABS[4]);

        const vigentes = invoices.filter(i => i.status === 'Vigente');
        const canceladas = invoices.filter(i => i.status === 'Cancelado');
        const monto = vigentes.reduce((a, i) => a + (i.total || 0), 0);

        const rows = invoices.map(i => ({
            folio:  _badgeFolio(i.folio),
            rfc:    `<span style="font-size:11px;color:#6B7280">${i.rfc}</span>`,
            nombre: i.name,
            ref:    `<span style="font-size:11px;color:#9CA3AF">${i.reference}</span>`,
            estatus: i.status === 'Vigente' ? '<span class="badge-base b-green">Vigente</span>' : '<span class="badge-base b-red">Cancelado</span>',
            fecha:  _fmtDate(i.invoiceDate),
            subtotal: _money(i.subtotal),
            iva:    _money(i.tax),
            ieps:   _money(i.ieps || 0),
            total:  `<span class="font-semibold text-gray-800">${_money(i.total)}</span>`,
            uuid:   `<span style="font-size:10px;color:#9CA3AF">${i.uuid}</span>`,
            forma:  i.paymentFormCode,
            metodo: i.paymentMethodCode,
            orden:  i.orderNo,
            fechaop: _fmtDate(i.operationDate),
            tipo:   i.invoiceType
        }));

        this.createCoffeeTable3({
            parent: 'facturasTable', id: 'tbFacturas', theme: 'invernal',
            center: [5, 12, 13, 14], right: [7, 8, 9, 10], extends: true, scrollable: true, f_size: 11,
            emptyMessage: 'Sin facturas en el periodo', emptyIcon: 'icon-doc-text',
            data: { thead: HEAD_FACTURAS, row: rows }
        });

        facturadorView.fillFacturasKpis({ total: invoices.length, vigentes: vigentes.length, canceladas: canceladas.length, monto, foot: `${invoices.length} factura${invoices.length !== 1 ? 's' : ''}` });
        if (invoices.length > 0 && typeof simple_data_table === 'function') simple_data_table('#tbFacturas', 15);
        if (window.lucide) lucide.createIcons();
    }

    lsCatalogos() {
        facturadorView.catalogosShell(FACTURADOR_TABS[5]);

        const rowsBridge = SAMPLE_FACTURADOR_BRIDGE_PRODUCTS.map(p => ({
            clave:  `<span style="font-size:11px;color:#6B7280">${p.clave}</span>`,
            nombre: p.name,
            precio: `<span class="font-semibold text-gray-800">${_money(p.price)}</span>`,
            accion: `<div class="flex items-center justify-end gap-1">
                        <button class="ct-mini" title="Editar" onclick="facturadorView.openBridgeForm(${p.id})"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                        <button class="ct-mini danger" title="Eliminar" onclick="facturador.delBridge(${p.id})"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                     </div>`
        }));
        this.createCoffeeTable3({ parent: 'bridgeTable', id: 'tbBridge', theme: 'light', right: [3, 4], extends: true, scrollable: false, f_size: 12, emptyMessage: 'Sin productos', emptyIcon: 'icon-doc', data: { thead: HEAD_BRIDGE, row: rowsBridge } });

        const rowsCust = SAMPLE_FACTURADOR_CUSTOMERS.map(c => ({
            rfc:    `<span style="font-size:11px;color:#6B7280">${c.rfc}</span>`,
            nombre: c.name,
            accion: `<div class="flex items-center justify-end gap-1">
                        <button class="ct-mini" title="Editar" onclick="facturadorView.openCustomerForm(${c.id})"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                        <button class="ct-mini danger" title="Eliminar" onclick="facturador.delCustomer(${c.id})"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                     </div>`
        }));
        this.createCoffeeTable3({ parent: 'customersTable', id: 'tbCust', theme: 'light', right: [3], extends: true, scrollable: false, f_size: 12, emptyMessage: 'Sin clientes', emptyIcon: 'icon-doc', data: { thead: HEAD_CUSTOMERS, row: rowsCust } });

        facturadorView.fillParams(SAMPLE_FACTURADOR_META);
        if (window.lucide) lucide.createIcons();
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
        app.renderActiveTab();
    }

    saveParams(pct, iva) {
        SAMPLE_FACTURADOR_META.porcentaje = isNaN(pct) ? SAMPLE_FACTURADOR_META.porcentaje : pct;
        SAMPLE_FACTURADOR_META.tasaIva    = isNaN(iva) ? SAMPLE_FACTURADOR_META.tasaIva : iva;
        facturadorView.alertBox({ type: 'success', title: 'Parámetros guardados', timer: 1400 });
        app.renderActiveTab();
    }

    saveBridge(data) {
        // MODO FAKE: si hubiera backend -> useFetch({ url: apiFacturador, data: { opc: 'saveBridge', ...data } })
        if (data.id) {
            const p = SAMPLE_FACTURADOR_BRIDGE_PRODUCTS.find(x => x.id === +data.id);
            if (p) { p.clave = data.clave; p.name = data.name; p.price = +data.price; }
        } else {
            SAMPLE_FACTURADOR_BRIDGE_PRODUCTS.push({ id: _nextId(SAMPLE_FACTURADOR_BRIDGE_PRODUCTS), clave: data.clave, name: data.name, price: +data.price });
        }
        this.lsCatalogos();
    }

    delBridge(id) {
        facturadorView.alertBox({
            type: 'confirm', title: '¿Eliminar producto puente?', okLabel: 'Eliminar',
            onOk: () => {
                const i = SAMPLE_FACTURADOR_BRIDGE_PRODUCTS.findIndex(x => x.id === id);
                if (i >= 0) SAMPLE_FACTURADOR_BRIDGE_PRODUCTS.splice(i, 1);
                this.lsCatalogos();
            }
        });
    }

    saveCustomer(data) {
        // MODO FAKE: si hubiera backend -> useFetch({ url: apiFacturador, data: { opc: 'saveCustomer', ...data } })
        if (data.id) {
            const c = SAMPLE_FACTURADOR_CUSTOMERS.find(x => x.id === +data.id);
            if (c) { c.rfc = data.rfc; c.name = data.name; }
        } else {
            SAMPLE_FACTURADOR_CUSTOMERS.push({ id: _nextId(SAMPLE_FACTURADOR_CUSTOMERS), rfc: data.rfc, name: data.name });
        }
        this.lsCatalogos();
    }

    delCustomer(id) {
        facturadorView.alertBox({
            type: 'confirm', title: '¿Eliminar cliente fiscal?', okLabel: 'Eliminar',
            onOk: () => {
                const i = SAMPLE_FACTURADOR_CUSTOMERS.findIndex(x => x.id === id);
                if (i >= 0) SAMPLE_FACTURADOR_CUSTOMERS.splice(i, 1);
                this.lsCatalogos();
            }
        });
    }
}

class FacturadorView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'facturador';
        this.ticketFmt    = 'wansoft';
    }

    esc(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    tabHeader(meta, extra) {
        return `
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0" style="background:linear-gradient(135deg,#C05A40 0%,#E8A68F 100%);">
                        <i data-lucide="${meta.icon}" class="w-4 h-4"></i>
                    </span>
                    <div>
                        <h1 class="text-base font-bold text-gray-800">${this.esc(meta.title)}</h1>
                        <p class="text-[11px] text-gray-500">${this.esc(meta.subtitle)}</p>
                    </div>
                </div>
                ${extra || ''}
            </div>`;
    }

    card(inner, cls) {
        return `<div class="bg-white rounded-lg border border-gray-200 overflow-hidden ${cls || ''}">${inner}</div>`;
    }

    foliosShell(meta) {
        const note = `
            <div class="px-4 py-2 border-b border-gray-100 flex items-center gap-3">
                <p class="text-[10px] text-gray-400">todos los tickets del periodo &middot; se omiten efectivos no facturados &middot; los facturados quedan congelados con CFDI vigente</p>
                <span id="foliosCount" class="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold" style="background:#F7F0EB;color:#A84A33;border:1px solid #F0C4B5;">0 tickets</span>
            </div>`;

        const main = `
            <div class="flex-1 min-w-0 flex flex-col overflow-hidden">
                ${this.tabHeader(meta)}
                ${note}
                <div class="flex-1 min-h-0 p-4 overflow-auto">
                    <div id="foliosTable" class="border border-gray-200 rounded-lg overflow-hidden"></div>
                </div>
            </div>`;

        const aside = `
            <aside class="w-full md:w-72 xl:w-80 flex-shrink-0 border-t md:border-t-0 md:border-l border-gray-200 flex flex-col overflow-hidden">
                <div id="resumenPanel" class="flex-1 overflow-auto p-3"></div>
            </aside>`;

        $('#tabHost').html(`<div class="flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden bg-white rounded-lg border border-gray-200">${main}${aside}</div>`);
        if (window.lucide) lucide.createIcons();
    }

    resumenShell(meta) {
        const kpi = (label, valId, tone, icon, det) => `
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">${label}</span>
                    <i data-lucide="${icon}" class="w-4 h-4 ${tone.icon}"></i>
                </div>
                <p class="text-xl font-extrabold ${tone.val}" id="${valId}">$0.00</p>
                <p class="text-[10px] text-gray-400 mt-1" id="${valId}Det">${det || ''}</p>
            </div>`;

        const kpis = `
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                ${kpi('Venta total del periodo', 'rzVenta',      { icon: 'text-gray-400',   val: 'text-gray-900' }, 'banknote', '0 tickets')}
                ${kpi('Meta al 70%',             'rzMeta',       { icon: 'text-[#C05A40]',  val: 'text-gray-900' }, 'target', 'gravado al 16%')}
                ${kpi('Monto facturado',         'rzFacturado',  { icon: 'text-green-600',  val: 'text-green-700' }, 'lock', '0 órdenes bloqueadas')}
                ${kpi('Por facturar al 16%',     'rzPorFacturar',{ icon: 'text-amber-500',  val: 'text-[#C05A40]' }, 'alert-circle', '= meta − facturado')}
            </div>`;

        const progress = `
            <div class="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[11px] font-semibold text-gray-700">Avance de la meta de facturación</span>
                    <span class="text-[11px] font-bold text-[#C05A40]" id="rzAvancePct">0%</span>
                </div>
                <div style="height:10px;border-radius:9999px;background:#E5E7EB;overflow:hidden">
                    <div id="rzAvanceBar" style="height:100%;border-radius:9999px;background:linear-gradient(90deg,#C05A40,#E08A70);width:0%;transition:width .5s ease"></div>
                </div>
                <div class="flex justify-between mt-2 text-[10px] text-gray-400">
                    <span id="rzAvanceFact">$0.00 facturado</span>
                    <span id="rzAvanceObj">objetivo $0.00</span>
                </div>
            </div>`;

        const tables = `
            <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
                ${this.card(`<div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between"><h3 class="text-[12px] font-bold text-gray-800 flex items-center gap-2"><i data-lucide="sigma" class="w-4 h-4 text-gray-400"></i>Acumulado total real</h3><span class="badge-base b-gray">todos los pagos</span></div><div id="tblAcumulado" class="p-2 max-h-80 overflow-auto"></div>`)}
                ${this.card(`<div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between"><h3 class="text-[12px] font-bold text-gray-800 flex items-center gap-2"><i data-lucide="file-clock" class="w-4 h-4 text-amber-500"></i>No facturado que voy a facturar</h3><span class="badge-base b-yellow">solo tarjeta</span></div><div id="tblPending" class="p-2 max-h-80 overflow-auto"></div>`)}
                ${this.card(`<div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between"><h3 class="text-[12px] font-bold text-gray-800 flex items-center gap-2"><i data-lucide="lock" class="w-4 h-4 text-green-600"></i>Orden facturado</h3><span class="badge-base b-green">bloqueadas</span></div><div id="tblFacturado" class="p-2 max-h-80 overflow-auto"></div>`)}
            </div>`;

        $('#tabHost').html(`<div class="flex-1 min-h-0 w-full overflow-auto bg-white rounded-lg border border-gray-200">${this.tabHeader(meta)}<div class="p-4">${kpis}${progress}${tables}</div></div>`);
        if (window.lucide) lucide.createIcons();
    }

    fillResumenKpis(st) {
        $('#rzVenta').text(_money(st.totalReal));
        $('#rzVentaDet').text(`${st.ticketsCount} tickets · efectivo + tarjeta`);
        $('#rzMeta').text(_money(st.meta));
        $('#rzFacturado').text(_money(st.totalFact));
        $('#rzFacturadoDet').text(`${st.facturadasCount} órdenes bloqueadas (CFDI vigente)`);
        $('#rzPorFacturar').text(_money(st.aFacturar));
        const pct = Math.min(100, st.logrado || 0);
        $('#rzAvancePct').text(pct.toFixed(1) + '%');
        $('#rzAvanceBar').css('width', pct + '%');
        $('#rzAvanceFact').text(`${_money(st.totalFact)} facturado`);
        $('#rzAvanceObj').text(`objetivo ${_money(st.meta)}`);
    }

    uploadZone(tone, title, hint, badgeId, badgeCls) {
        return `
            <div class="mb-4 flex items-center gap-4 rounded-xl border border-dashed border-gray-300 bg-white px-5 py-4 cursor-pointer hover:border-[#C05A40]" onclick="facturadorView.fakeUpload()">
                <div class="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style="background:${tone.bg}"><i data-lucide="file-spreadsheet" class="w-5 h-5" style="color:${tone.fg}"></i></div>
                <div class="flex-1">
                    <p class="text-[12px] font-semibold text-gray-800">${title}</p>
                    <p class="text-[10px] text-gray-500 mt-0.5">${hint}</p>
                </div>
                <span id="${badgeId}" class="badge-base ${badgeCls}">Pendiente</span>
            </div>`;
    }

    ventasShell(meta) {
        const zone = this.uploadZone({ bg: '#F5E3DC', fg: '#C05A40' }, 'Arrastra aquí el export del POS (hoja "Venta por pago")', 'Modo demo · los datos provienen del sample sembrado.', 'vBadge', 'b-gray');
        const kpis = `
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div class="bg-white rounded-lg border border-gray-200 p-3"><p class="text-[10px] text-gray-500 uppercase font-semibold">Pagos</p><p class="text-lg font-extrabold text-gray-900" id="vpPagos">0</p></div>
                <div class="bg-white rounded-lg border border-gray-200 p-3"><p class="text-[10px] text-gray-500 uppercase font-semibold">Órdenes</p><p class="text-lg font-extrabold text-gray-900" id="vpOrdenes">0</p></div>
                <div class="bg-white rounded-lg border border-gray-200 p-3"><p class="text-[10px] text-gray-500 uppercase font-semibold">Tarjeta de crédito</p><p class="text-lg font-extrabold text-[#C05A40]" id="vpTarjeta">$0.00</p></div>
                <div class="bg-white rounded-lg border border-gray-200 p-3"><p class="text-[10px] text-gray-500 uppercase font-semibold">Efectivo</p><p class="text-lg font-extrabold text-green-700" id="vpEfectivo">$0.00</p></div>
            </div>`;
        const table = this.card(`<div id="ventasTable" class="p-2 overflow-auto max-h-[520px]"></div><div class="px-4 py-3 border-t border-gray-100"><p class="text-[10px] text-gray-500" id="vpFoot">0 pagos</p></div>`);
        $('#tabHost').html(`<div class="flex-1 min-h-0 w-full overflow-auto bg-white rounded-lg border border-gray-200">${this.tabHeader(meta)}<div class="p-4">${zone}${kpis}${table}</div></div>`);
        if (window.lucide) lucide.createIcons();
    }

    fillVentasKpis(d) {
        $('#vpPagos').text(d.pagos);
        $('#vpOrdenes').text(d.ordenes);
        $('#vpTarjeta').text(_money(d.tarjeta));
        $('#vpEfectivo').text(_money(d.efectivo));
        $('#vpFoot').text(d.foot);
    }

    detalladoShell(meta) {
        const zone = this.uploadZone({ bg: '#FEF3C7', fg: '#D97706' }, 'Arrastra aquí el export detallado del POS (hoja "Detallado")', 'Modo demo · las celdas sin dato se marcan como NULL.', 'dBadge', 'b-yellow');
        const table = this.card(`<div id="detalladoTable" class="p-2 overflow-auto max-h-[540px]"></div><div class="px-4 py-3 border-t border-gray-100"><p class="text-[10px] text-gray-500" id="detFoot">0 renglones</p></div>`);
        $('#tabHost').html(`<div class="flex-1 min-h-0 w-full overflow-auto bg-white rounded-lg border border-gray-200">${this.tabHeader(meta)}<div class="p-4">${zone}${table}</div></div>`);
        if (window.lucide) lucide.createIcons();
    }

    facturasShell(meta) {
        const zone = this.uploadZone({ bg: '#F5E3DC', fg: '#C05A40' }, 'Arrastra aquí la lista de facturas (hoja "Facturados")', 'Modo demo · CFDI provenientes del sample sembrado.', 'fBadge', 'b-gray');
        const kpis = `
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div class="bg-white rounded-lg border border-gray-200 p-3"><p class="text-[10px] text-gray-500 uppercase font-semibold">Facturas</p><p class="text-lg font-extrabold text-gray-900" id="fcTotal">0</p></div>
                <div class="bg-white rounded-lg border border-gray-200 p-3"><p class="text-[10px] text-gray-500 uppercase font-semibold">Vigentes</p><p class="text-lg font-extrabold text-green-700" id="fcVigentes">0</p></div>
                <div class="bg-white rounded-lg border border-gray-200 p-3"><p class="text-[10px] text-gray-500 uppercase font-semibold">Canceladas</p><p class="text-lg font-extrabold text-red-600" id="fcCanceladas">0</p></div>
                <div class="bg-white rounded-lg border border-gray-200 p-3"><p class="text-[10px] text-gray-500 uppercase font-semibold">Monto facturado</p><p class="text-lg font-extrabold text-[#C05A40]" id="fcMonto">$0.00</p></div>
            </div>`;
        const table = this.card(`<div id="facturasTable" class="p-2 overflow-auto max-h-[520px]"></div><div class="px-4 py-3 border-t border-gray-100"><p class="text-[10px] text-gray-500" id="fcFoot">0 facturas</p></div>`);
        $('#tabHost').html(`<div class="flex-1 min-h-0 w-full overflow-auto bg-white rounded-lg border border-gray-200">${this.tabHeader(meta)}<div class="p-4">${zone}${kpis}${table}</div></div>`);
        if (window.lucide) lucide.createIcons();
    }

    fillFacturasKpis(d) {
        $('#fcTotal').text(d.total);
        $('#fcVigentes').text(d.vigentes);
        $('#fcCanceladas').text(d.canceladas);
        $('#fcMonto').text(_money(d.monto));
        $('#fcFoot').text(d.foot);
    }

    catalogosShell(meta) {
        const bridge = this.card(`
            <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 class="text-[12px] font-bold text-gray-800 flex items-center gap-2"><i data-lucide="utensils" class="w-4 h-4 text-[#C05A40]"></i>Productos puente</h3>
                <button class="ct-add" onclick="facturadorView.openBridgeForm()"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Nuevo</button>
            </div>
            <div id="bridgeTable" class="p-2 max-h-96 overflow-auto"></div>`);

        const customers = this.card(`
            <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 class="text-[12px] font-bold text-gray-800 flex items-center gap-2"><i data-lucide="users" class="w-4 h-4 text-[#C05A40]"></i>Clientes fiscales</h3>
                <button class="ct-add" onclick="facturadorView.openCustomerForm()"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Nuevo</button>
            </div>
            <div id="customersTable" class="p-2 max-h-96 overflow-auto"></div>`);

        const params = `
            <div class="bg-white rounded-lg border border-gray-200 p-4 lg:col-span-2">
                <h3 class="text-[12px] font-bold text-gray-800 mb-3 flex items-center gap-2"><i data-lucide="settings-2" class="w-4 h-4 text-[#C05A40]"></i>Parámetros de facturación</h3>
                <div class="flex flex-wrap items-end gap-4">
                    <div><label class="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Porcentaje de meta</label><input type="number" step="0.01" min="0" max="1" id="paramPct" class="rounded-lg border border-gray-200 px-3 py-2 text-sm w-28"></div>
                    <div><label class="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Tasa de IVA</label><input type="number" step="0.01" min="0" max="1" id="paramIva" class="rounded-lg border border-gray-200 px-3 py-2 text-sm w-28"></div>
                    <button class="inline-flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg" style="background:#C05A40" onclick="facturador.saveParams(parseFloat($('#paramPct').val()), parseFloat($('#paramIva').val()))"><i data-lucide="save" class="w-4 h-4"></i>Guardar</button>
                </div>
            </div>`;

        $('#tabHost').html(`<div class="flex-1 min-h-0 w-full overflow-auto bg-white rounded-lg border border-gray-200">${this.tabHeader(meta)}<div class="p-4"><div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${bridge}${customers}${params}</div></div></div>`);
        if (window.lucide) lucide.createIcons();
    }

    fillParams(meta) {
        $('#paramPct').val(meta.porcentaje);
        $('#paramIva').val(meta.tasaIva);
    }

    setFoot(id, text) {
        $('#' + id).text(text);
    }

    fakeUpload() {
        this.alertBox({ type: 'info', title: 'Modo demo', text: 'La carga de Excel se conecta al backend real. Aquí los datos vienen del sample sembrado.', timer: 2200 });
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
                <h3 class="text-[11px] font-bold text-gray-800">Resumen de facturación</h3>
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
                        <p class="text-[8px] text-gray-400 leading-tight">${st.facturadasCount || 0} órdenes bloqueadas &middot; ${(st.logrado || 0).toFixed(1)}% logrado</p>
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

    openPctConfig() {
        const modal = this.cfModal({
            title:   'Porcentaje de facturación',
            theme:   'light',
            size:    'small',
            okLabel: 'Guardar',
            onOk:    () => { if (this.pctFormEl) this.pctFormEl.trigger('submit'); }
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
                    this.alertBox({ type: 'error', title: 'Porcentaje inválido (0 a 100)' });
                    return;
                }
                facturador.setMetaPct(v);
                modal.close();
                this.alertBox({ type: 'success', title: `Porcentaje de facturación: ${Math.round(v)}%`, timer: 1400 });
            }
        });
    }

    openBridgeForm(id) {
        const p = id ? SAMPLE_FACTURADOR_BRIDGE_PRODUCTS.find(x => x.id === id) : null;
        const modal = this.cfModal({ title: p ? 'Editar producto puente' : 'Nuevo producto puente', theme: 'light', size: 'default', okLabel: 'Guardar', onOk: () => { if (this.bridgeFormEl) this.bridgeFormEl.trigger('submit'); } });
        const host = $('<div>', { id: 'bridgeFormHost' });
        modal.body.append(host);
        this.bridgeFormEl = this.coffeeForm({
            parent: 'bridgeFormHost', id: 'bridgeForm', Element: 'form', theme: 'light',
            json: [
                { opc: 'input', type: 'text',   tipo: 'texto',  id: 'bClave',  name: 'clave',  lbl: 'Clave',              class: 'col-6', value: p ? p.clave : '', required: true },
                { opc: 'input', type: 'number', tipo: 'numero', id: 'bPrecio', name: 'price',  lbl: 'Precio',             class: 'col-6', value: p ? p.price : '', required: true },
                { opc: 'input', type: 'text',   tipo: 'texto',  id: 'bName',   name: 'name',   lbl: 'Platillo / Artículo', class: 'col-12', value: p ? p.name : '', required: true }
            ],
            onSave: (d) => { d.id = id || ''; facturador.saveBridge(d); modal.close(); }
        });
    }

    openCustomerForm(id) {
        const c = id ? SAMPLE_FACTURADOR_CUSTOMERS.find(x => x.id === id) : null;
        const modal = this.cfModal({ title: c ? 'Editar cliente fiscal' : 'Nuevo cliente fiscal', theme: 'light', size: 'default', okLabel: 'Guardar', onOk: () => { if (this.custFormEl) this.custFormEl.trigger('submit'); } });
        const host = $('<div>', { id: 'custFormHost' });
        modal.body.append(host);
        this.custFormEl = this.coffeeForm({
            parent: 'custFormHost', id: 'custForm', Element: 'form', theme: 'light',
            json: [
                { opc: 'input', type: 'text', tipo: 'texto', id: 'cRfc',  name: 'rfc',  lbl: 'RFC',          class: 'col-12', value: c ? c.rfc : '', required: true },
                { opc: 'input', type: 'text', tipo: 'texto', id: 'cName', name: 'name', lbl: 'Razón social', class: 'col-12', value: c ? c.name : '', required: true }
            ],
            onSave: (d) => { d.id = id || ''; facturador.saveCustomer(d); modal.close(); }
        });
    }

    openTicket(saleId) {
        const ticket = facturador.getTicket(saleId);
        if (!ticket) {
            this.alertBox({ type: 'error', title: 'No se pudo generar el ticket virtual' });
            return;
        }
        this.ticketModal({
            json:    ticket,
            tasa:    facturador.tasaDeVenta(saleId),
            fmt:     this.ticketFmt,
            onSwap:  (fmt) => { this.ticketFmt = fmt; },
            onRegen: () => facturador.getTicket(saleId),
            onPrint: (t) => this.openPrintSelector(t)
        });
    }

    buildTicketHtml(t, fmt) {
        const esc = (s) => this.esc(s);
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

        const regenBtn = opts.tasa === '0%'
            ? `<button id="ticketRegen" class="flex items-center gap-1.5 text-xs font-semibold" style="background:#fff;color:#374151;border:1px solid #E5E7EB;padding:8px 12px;border-radius:8px;"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>Regenerar productos</button>`
            : '';

        overlay.html(`
            <div style="background:#fff;border-radius:14px;max-width:420px;width:100%;margin:auto;box-shadow:0 12px 40px rgba(17,25,40,.25);">
                <div class="flex items-center justify-between" style="padding:14px 18px;border-bottom:1px solid #F3F4F6;">
                    <div class="flex items-center gap-2">
                        <i data-lucide="printer" class="w-4 h-4 text-[#C05A40]"></i>
                        <h3 class="text-sm font-bold text-gray-800">Ticket virtual <span id="ticketModalOrden" class="text-[#C05A40]"></span></h3>
                    </div>
                    <button id="ticketModalClose" class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
                <div class="flex justify-center" style="padding:10px 18px 0;">
                    <button id="ticketSwap" class="flex items-center gap-1.5 text-xs font-semibold" style="background:#fff;color:#374151;border:1px solid #E5E7EB;padding:6px 14px;border-radius:8px;">
                        <i data-lucide="repeat" class="w-3.5 h-3.5"></i><span id="ticketSwapLabel"></span>
                    </button>
                </div>
                <div style="padding:14px 18px;max-height:56vh;overflow:auto;background:#FAFCFF;">
                    <div id="ticketPaper" style="${paperStyle}"></div>
                </div>
                <div class="flex items-center justify-center gap-2" style="padding:12px 18px;border-top:1px solid #F3F4F6;background:#FAFCFF;border-radius:0 0 14px 14px;">
                    ${regenBtn}
                    <button id="ticketPrint" class="flex items-center gap-1.5 text-xs font-semibold text-white" style="background:#C05A40;padding:8px 16px;border-radius:8px;">
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
            if (window.lucide) lucide.createIcons();
        };

        paint();

        overlay.on('click', '#ticketModalClose', () => overlay.remove());
        overlay.on('mousedown', (e) => { if (e.target === overlay[0]) overlay.remove(); });
        overlay.on('click', '#ticketSwap', () => { fmt = (fmt === 'wansoft') ? 'softrestaurant' : 'wansoft'; opts.onSwap(fmt); paint(); });
        overlay.on('click', '#ticketRegen', () => { const t = opts.onRegen(); if (t) { ticket = t; paint(); } });
        overlay.on('click', '#ticketPrint', () => opts.onPrint(ticket, fmt));
    }

    openPrintSelector(ticket) {
        $('#facturadorPrintSelector').remove();
        const overlay = $('<div>', {
            id: 'facturadorPrintSelector',
            style: 'position:fixed;inset:0;background:rgba(17,25,40,.55);z-index:70;display:flex;align-items:center;justify-content:center;padding:24px;'
        });
        const cardStyle = 'display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 12px;border:1px solid #E5E7EB;border-radius:12px;background:#fff;cursor:pointer;font-size:12px;font-weight:700;color:#374151;';
        overlay.html(`
            <div style="background:#fff;border-radius:14px;max-width:400px;width:100%;box-shadow:0 12px 40px rgba(17,25,40,.25);">
                <div class="flex items-center justify-between" style="padding:14px 18px;border-bottom:1px solid #F3F4F6;">
                    <h3 class="text-sm font-bold text-gray-800 flex items-center gap-2"><i data-lucide="printer" class="w-4 h-4 text-[#C05A40]"></i>¿De qué sistema deseas generar el ticket?</h3>
                    <button id="psClose" class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
                <div style="padding:18px;">
                    <div class="grid grid-cols-2 gap-3">
                        <button id="psSoft" style="${cardStyle}"><i data-lucide="utensils" class="w-6 h-6 text-[#C05A40]"></i>SoftRestaurant<span style="font-size:10px;font-weight:400;color:#9CA3AF">Formato cheque de consumo</span></button>
                        <button id="psWan" style="${cardStyle}"><i data-lucide="monitor-smartphone" class="w-6 h-6 text-[#C05A40]"></i>Wansoft<span style="font-size:10px;font-weight:400;color:#9CA3AF">Formato cuenta de venta</span></button>
                    </div>
                </div>
            </div>
        `);
        $('body').append(overlay);
        if (window.lucide) lucide.createIcons();

        const choose = (fmt) => {
            this.ticketFmt = fmt;
            overlay.remove();
            this.printTicketDoc(ticket, fmt);
        };
        overlay.on('click', '#psClose', () => overlay.remove());
        overlay.on('mousedown', (e) => { if (e.target === overlay[0]) overlay.remove(); });
        overlay.on('click', '#psSoft', () => choose('softrestaurant'));
        overlay.on('click', '#psWan', () => choose('wansoft'));
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
