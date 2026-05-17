let api = 'ctrl/ctrl-pos-historial-ventas.php';
let app;

let turno, subsidiaries_id;

window.updateSession = () => { };


$(async () => {
    app = new App(api, 'root');
    await app.init();
});

class App extends Templates {



    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSHistorialVentas';
        this.subId = null;
    }

    async init() {
        const res = await useFetch({ url: this._link, data: { opc: 'init' } });

        this.dataInit = res || {};
        this.subId = this.dataInit.subsidiaries_id || null;
        subsidiaries_id = this.subId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        this.renderHeader(SAMPLE_VIEW_HEADER);
        this.renderFooter(SAMPLE_VIEW_FOOTER);


        this.renderDetail();
        this.populateFilters();
        this.lsVentas();
        this.lsKpis();
    }

    // -- Layout --

    layout() {


        const mainPanel = {
            type: 'div',
            id: 'mainPanel',
            class: 'flex-1 flex flex-col overflow-hidden min-w-0 w-full',
            children: [
                {
                    id: 'viewHeader',
                    text: '#viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id: 'filterBar',
                    class: 'px-4 py-3 bg-[#141d2b] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id: 'kpisRow',
                    class: 'px-3 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id: 'tableWrap',
                    text: '#tableWrap',
                    class: 'p-3 flex-1 overflow-y-auto overflow-x-auto cs-scroll'
                },
                {
                    id: 'viewFooter',
                    text: '#viewFooter',
                    class: 'px-4 py-2 bg-[#141d2b] border-t border-[#374151] flex items-center justify-between flex-shrink-0'
                }
            ]
        };

        const detailPanel = {
            type: 'aside',
            id: 'detailPanel',
            class: 'w-full md:w-[420px] flex-shrink-0 bg-[#141d2b] border-t md:border-t-0 md:border-l border-[#374151] flex flex-col overflow-hidden',
            children: [
                {
                    id: 'emptyDetail',
                    text: '#emptyDetail',
                    class: 'flex-1 flex flex-col items-center justify-center text-center px-6'
                },
                {
                    id: 'detailContent',
                    text: '#detailContent',
                    class: 'hidden flex-1 flex flex-col overflow-hidden'
                }
            ]
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id: this.PROJECT_NAME,
                class: 'mt-16 h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden overflow-y-auto md:overflow-hidden',
                container: [mainPanel, detailPanel]
            }
        });
    }

    // -- Filter bar --
    filterBar() {

        let filters = [
            {
                opc: 'select',
                id: 'fTurno',
                lbl: 'Periodo:',
                class: 'col-12 col-md-3 col-lg-2',
                onchange: 'app.onChangePeriodo()',
                value: 'actual',
                data: [
                    { id: 'actual', valor: 'Turno actual' },
                    { id: 'dia', valor: 'Dia actual' },
                    { id: 'rango', valor: 'Por rango de fecha' }
                ]
            },

            {
                opc: 'select',
                id: 'cash_shift_id',
                lbl: 'Turno:',
                class: 'col-12 col-md-3 col-lg-3',
                onchange: 'app.onChangeFilters()',
                data: []
            },

            {
                opc: 'input-calendar',
                id: 'dayPOSHistorialVentas',
                lbl: 'Dia:',
                class: 'col-12 col-md-3 col-lg-2'
            },
            {
                opc: 'input-calendar',
                id: 'calendarPOSHistorialVentas',
                lbl: 'Rango de fecha:',
                class: 'col-12 col-md-4 col-lg-3'
            },
            {
                opc: 'select',
                id: 'status',
                lbl: 'Estatus:',
                class: 'col-12 col-md-3 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value: '',
                data: [
                    { id: '', valor: 'Todos' },
                    { id: '1', valor: 'Pendiente' },
                    { id: '2', valor: 'En proceso' },
                    { id: '3', valor: 'Pagado' },
                    { id: '4', valor: 'Cancelado' }
                ]
            }


        ];

        this.createfilterBar({
            parent: 'filterBar',
            data: filters
        });

        $('#fTurno').val('actual');

        dataPicker({
            parent: `calendar${this.PROJECT_NAME}`,
            rangepicker: {
                startDate: moment('2026-04-01'),
                endDate: moment('2026-05-15'),
                showDropdowns: true,
                ranges: {
                    'Hoy': [moment(), moment()],
                    'Ayer': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                    'Semana actual': [moment().startOf('week'), moment().endOf('week')],
                    'Mes actual': [moment().startOf('month'), moment().endOf('month')],
                    'Mes anterior': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
                }
            },
            onSelect: () => this.onChangeFilters()
        });

        dataPicker({
            parent: `day${this.PROJECT_NAME}`,
            type: 'simple',
            rangeDefault: {
                startDate: moment(),
                singleDatePicker: true,
                showDropdowns: true,
                autoApply: true,
                locale: { format: 'DD-MM-YYYY' }
            },
            onSelect: () => this.onChangeFilters()
        });

        this.onChangePeriodo();
    }

    populateFilters() {
        const sucursales = this.dataInit.sucursales || [];
        if (sucursales.length) {
            this.populateSelect('subsidiaries_id', sucursales);
        }

        const turnos = this.dataInit.turnos || [];
        if (turnos.length) {
            this.populateSelect('cash_shift_id', turnos);
            turno = turnos[0];
            $('#cash_shift_id').val(turnos[0].id);
        } else {
            $('#cash_shift_id').html('<option value="" selected disabled>-- Sin turno --</option>');
        }
    }

    populateSelect(id, data) {
        const $sel = $(`#${id}`);
        if (!$sel.length) return;
        $sel.find('option:not(:first)').remove();
        data.forEach(item => {
            $sel.append(`<option value="${item.id}">${item.valor}</option>`);
        });
    }

    getFilters() {
        const fTurno = $('#fTurno').val() || 'actual';
        let fi = '';
        let ff = '';

        if (fTurno === 'dia') {
            const day = getDataRangePicker(`day${this.PROJECT_NAME}`) || {};
            fi = day.fi || '';
            ff = day.fi || '';
        } else if (fTurno === 'rango') {
            const range = getDataRangePicker(`calendar${this.PROJECT_NAME}`) || {};
            fi = range.fi || '';
            ff = range.ff || '';
        }

        return {
            subsidiaries_id: $('#subsidiaries_id').val() || this.subId || '',
            cash_shift_id: fTurno === 'actual' ? ($('#cash_shift_id').val() || '') : '',
            fTurno: fTurno,
            fi: fi,
            ff: ff,
            status: $('#status').val() || ''
        };
    }

    // -- Data --
    lsVentas() {
        const filters = this.getFilters();
        this.createTable({
            parent: 'tableWrap',
            idFilterBar: 'filterBar',
            data: Object.assign({ opc: 'lsVentas' }, filters),
            conf: { datatable: true, pag: 15 },
            coffeesoft: true,
            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: 'dark',
                title: '',
                subtitle: '',
                extends: true,
                emptyMessage: 'No se encontraron ventas con los filtros aplicados',
                emptyIcon: 'icon-doc-text',
                f_size: 12
            },
            methods: {
                send: (data) => {
                    const total = data && data.row ? data.row.length : 0;
                    this.updateFooterInfo(`Mostrando ${total} venta${total !== 1 ? 's' : ''}`);
                }
            }
        });
    }

    async lsKpis() {
        const filters = this.getFilters();
        const response = await useFetch({
            url: this._link,
            data: Object.assign({ opc: 'showVentas' }, filters)
        });


        const c = response.counts;
        const fmt = (n) => '$' + parseFloat(n || 0).toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        const kpis = [
            { id: 'kpiCount', label: 'Ventas', value: c.total_ventas || 0, tone: 'default' },
            { id: 'kpiTotal', label: 'Monto total', value: fmt(c.total_monto), tone: 'success' },
            { id: 'kpiDesc', label: 'Descuentos', value: fmt(c.total_descuentos), tone: 'warning' },
            { id: 'kpiCanc', label: 'Canceladas', value: c.total_canceladas || 0, tone: 'danger' }
        ];
        this.renderInfoCards(kpis);

    }

    async getVenta(id) {
        this.saleDetailPanel({ parent: 'detailPanel', loading: true });
        const [response] = await Promise.all([
            useFetch({ url: this._link, data: { opc: 'getVenta', id } }),
            new Promise(resolve => setTimeout(resolve, 1000))
        ]);
        this.renderDetail(response.data);

    }

    // -- Render helpers --

    renderDetail(sale) {
        this.saleDetailPanel({
            parent: 'detailPanel',
            json: sale,
            onClose: () => this.renderDetail(null),
            onReabrir: (v) => { if (v) this.reopenVenta(v.id); },
            onReimprimir: (v) => { if (v) this.reprintTicket(v); },
            onCancelar: (v) => { if (v) this.cancelVenta(v.id); }
        });
    }

    renderInfoCards(rows) {
        this.kpisRow({
            parent: 'kpisRow',
            json: rows,
            onClick: (kpi) => console.log('[kpisRow] click', kpi.id)
        });
    }

    renderHeader(data) {
        this.viewHeader({
            parent: 'viewHeader',
            json: data,
            onToggle: (key, value) => console.log('[viewHeader] toggle', key, '→', value)
        });
    }

    renderFooter(data) {
        this.viewFooter({
            parent: 'viewFooter',
            json: data
        });
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    // -- Event handlers --

    async onChangeFilters() {
        this.lsVentas();
        await this.lsKpis();
    }

    onChangePeriodo() {
        const mode = $('#fTurno').val() || 'actual';

        const $shiftWrap = $('#cash_shift_id').closest('[class*="col-"]');
        const $dayWrap = $('#dayPOSHistorialVentas').closest('[class*="col-"]');
        const $rangeWrap = $('#calendarPOSHistorialVentas').closest('[class*="col-"]');

        $shiftWrap.hide();
        $dayWrap.hide();
        $rangeWrap.hide();

        if (mode === 'actual') {
            $shiftWrap.show();
        } else if (mode === 'dia') {
            $dayWrap.show();
        } else if (mode === 'rango') {
            $rangeWrap.show();
        }

        this.onChangeFilters();
    }

    async editVenta(id) {
        const response = await useFetch({
            url: this._link,
            data: { opc: 'editVenta', id }
        });

        if (response && response.status === 200) {
            alert({ icon: 'success', text: response.message });
            this.lsVentas();
        }
    }

    async askAdminCreds({ title, message, confirmText, icon }) {
        const { value } = await Swal.fire({
            title,
            html: `
                <p class="text-sm mb-3 text-gray-300">${message}</p>
                <input id="swal-admin-user" class="swal2-input !bg-[#111928] !text-white !border !border-gray-600" placeholder="Usuario" autocomplete="off">
                <input id="swal-admin-key"  class="swal2-input !bg-[#111928] !text-white !border !border-gray-600" type="password" placeholder="Clave" autocomplete="off">
            `,
            icon,
            showCancelButton: true,
            confirmButtonText: confirmText,
            cancelButtonText: 'Volver',
            focusConfirm: false,
            customClass: {
                popup:         'bg-[#1F2A37] text-white rounded-lg shadow-lg',
                title:         'text-2xl font-semibold text-white',
                htmlContainer: 'text-gray-300',
                confirmButton: 'bg-[#1C64F2] hover:bg-[#0E9E6E] text-white py-2 px-4 rounded',
                cancelButton:  'bg-transparent text-white border border-gray-500 py-2 px-4 rounded hover:bg-[#111928]'
            },
            preConfirm: () => {
                const user = document.getElementById('swal-admin-user').value.trim();
                const key  = document.getElementById('swal-admin-key').value;
                if (!user || !key) {
                    Swal.showValidationMessage('Usuario y clave son requeridos');
                    return false;
                }
                return { user, key };
            }
        });
        return value || null;
    }

    async cancelVenta(id) {
        const creds = await this.askAdminCreds({
            title:       'Autorización de administrador',
            message:     'Esta venta será cancelada. Ingresa las credenciales de un administrador para continuar.',
            confirmText: 'Cancelar venta',
            icon:        'warning'
        });
        if (!creds) return;

        const response = await useFetch({
            url:  this._link,
            data: { opc: 'cancelVenta', id, user: creds.user, key: creds.key }
        });

        if (response && response.status === 200) {
            alert({ icon: 'success', text: response.message });
            this.renderDetail(null);
            this.lsVentas();
            await this.lsKpis();
        } else {
            alert({ icon: 'error', text: (response && response.message) || 'Error al cancelar la venta' });
        }
    }

    async reopenVenta(id) {
        const creds = await this.askAdminCreds({
            title:       'Autorización de administrador',
            message:     'Esta venta será reabierta y volverá a estado "En proceso". Ingresa las credenciales de un administrador.',
            confirmText: 'Reabrir venta',
            icon:        'question'
        });
        if (!creds) return;

        const response = await useFetch({
            url:  this._link,
            data: { opc: 'reopenVenta', id, user: creds.user, key: creds.key }
        });

        if (response && response.status === 200) {
            alert({ icon: 'success', text: response.message });
            this.renderDetail(null);
            this.lsVentas();
            await this.lsKpis();
        } else {
            alert({ icon: 'error', text: (response && response.message) || 'Error al reabrir la venta' });
        }
    }

    reprintTicket(v) {
        if (!v) return;

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
        const fmt = (n) => '$' + parseFloat(n || 0).toLocaleString('es-MX', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });

        const items     = v.items || [];
        const pagos     = v.pagos || [];
        const subtotal  = items.reduce((s, it) => s + (it.price || 0) * (it.qty || 0), 0);
        const descuento = items.reduce((s, it) => s + (it.price || 0) * (it.qty || 0) * ((it.discount || 0) / 100), 0);
        const total     = subtotal - descuento;

        const f = v.fecha ? new Date(v.fecha) : new Date();
        const fechaStr = `${String(f.getDate()).padStart(2,'0')}/${String(f.getMonth()+1).padStart(2,'0')}/${f.getFullYear()} ${String(f.getHours()).padStart(2,'0')}:${String(f.getMinutes()).padStart(2,'0')}`;

        const itemsHtml = items.map(it => `
            <tr>
                <td style="text-align:left;">${esc(it.name)}<br><span style="font-size:10px;color:#666;">${it.qty} x ${fmt(it.price)}</span></td>
                <td style="text-align:right;vertical-align:top;">${fmt((it.price || 0) * (it.qty || 0))}</td>
            </tr>
        `).join('');

        const pagosHtml = pagos.map(p => `
            <tr>
                <td style="text-align:left;">${esc(p.name || p.clave)}</td>
                <td style="text-align:right;">${fmt(p.amount)}</td>
            </tr>
        `).join('');

        const html = `
            <!DOCTYPE html>
            <html><head><meta charset="UTF-8"><title>Ticket ${esc(v.folio || '')}</title>
            <style>
                body{font-family:'Courier New',monospace;width:280px;margin:10px auto;color:#000;font-size:12px;}
                h1{font-size:14px;text-align:center;margin:0 0 4px;}
                .sub{text-align:center;font-size:11px;margin-bottom:8px;}
                hr{border:0;border-top:1px dashed #000;margin:6px 0;}
                table{width:100%;border-collapse:collapse;}
                td{padding:2px 0;font-size:11px;}
                .total{font-size:14px;font-weight:bold;}
                .right{text-align:right;}
                .center{text-align:center;font-size:10px;margin-top:8px;}
                @media print{body{margin:0;}}
            </style></head><body>
                <h1>${esc(v.folio || '')}</h1>
                <div class="sub">
                    ${esc(v.sucursal || '')}<br>
                    ${fechaStr}<br>
                    Estatus: ${esc(String(v.estatus || '').toUpperCase())}
                </div>
                ${v.cliente ? `<hr><div style="font-size:11px;">Cliente: ${esc(v.cliente.name)}${v.cliente.phone ? '<br>Tel: ' + esc(v.cliente.phone) : ''}</div>` : ''}
                <hr>
                <table>${itemsHtml}</table>
                <hr>
                <table>
                    <tr><td>Subtotal</td><td class="right">${fmt(subtotal)}</td></tr>
                    ${descuento > 0 ? `<tr><td>Descuento</td><td class="right">-${fmt(descuento)}</td></tr>` : ''}
                    <tr><td class="total">TOTAL</td><td class="right total">${fmt(total)}</td></tr>
                </table>
                ${pagos.length ? `<hr><div style="font-size:10px;font-weight:bold;">Metodos de pago</div><table>${pagosHtml}</table>` : ''}
                ${v.nota ? `<hr><div style="font-size:10px;">Nota: ${esc(v.nota)}</div>` : ''}
                <div class="center">*** Reimpresion ***<br>Gracias por su preferencia</div>
                <script>window.onload=function(){window.print();setTimeout(function(){window.close();},300);};<\/script>
            </body></html>
        `;

        const blob = new Blob([html], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const w    = window.open(url, '_blank', 'width=400,height=600');
        if (!w) {
            URL.revokeObjectURL(url);
            alert({ icon: 'warning', text: 'Permite las ventanas emergentes para imprimir el ticket' });
            return;
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    // -- Components --

    kpisRow(options) {
        const defaults = {
            parent: 'root',
            id: 'kpisRow',
            class: 'grid grid-cols-4 gap-3',
            json: [],
            labels: {
                empty: 'Sin indicadores'
            },
            tones: {
                default: 'text-white',
                success: 'cs-text-success text-[var(--cs-success,#3FC189)]',
                warning: 'cs-text-warning text-[var(--cs-warning,#FBBF24)]',
                danger: 'cs-text-danger  text-[var(--cs-danger,#E02424)]',
                info: 'cs-text-info    text-[var(--cs-info,#1C64F2)]',
                purple: 'cs-text-purple  text-[var(--cs-accent-purple,#7C3AED)]'
            },
            cardClass: 'cs-kpi-card bg-[var(--cs-bg-input,#1F2937)]  rounded-lg px-3 py-3 cursor-pointer hover:bg-[var(--cs-bg-header,#141d2b)] transition-colors',
            labelClass: 'cs-kpi-label text-[10px] uppercase tracking-wider font-bold text-[var(--cs-text-muted,#9CA3AF)]',
            valueClass: 'cs-kpi-value text-sm font-bold',
            onClick: () => { }
        };

        const o = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});
        opts.tones = Object.assign({}, defaults.tones, o.tones || {});

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

        grid.find('[data-kpi-idx]').on('click', (e) => {
            const idx = parseInt($(e.currentTarget).attr('data-kpi-idx'), 10);
            const kpi = opts.json[idx];
            opts.onClick(kpi, idx);
        });
    }

    viewHeader(options) {
        const defaults = {
            parent: 'root',
            id: 'viewHeader',
            class: 'flex items-center justify-between w-full',
            json: { title: '', subtitle: '', toggles: [] },
            classes: {
                title: 'text-base font-bold text-white',
                subtitle: 'text-[10px] text-[var(--cs-text-secondary,#D1D5DB)]',
                groupLbl: 'text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold',
                btn: 'demo-toggle px-2.5 py-1 rounded text-[11px] border border-[var(--cs-border,#374151)] text-[var(--cs-text-secondary,#D1D5DB)] hover:bg-[var(--cs-bg-input,#1F2937)] transition-colors',
                btnActive: 'demo-toggle active px-2.5 py-1 rounded text-[11px] border border-[var(--cs-info,#1C64F2)] bg-[var(--cs-info,#1C64F2)]/15 text-white',
                sep: 'text-[var(--cs-border,#374151)]'
            },
            onToggle: () => { }
        };

        const o = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json = Object.assign({}, defaults.json, o.json || {});
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

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        const togglesHtml = (opts.json.toggles || [])
            .map((g, i, arr) => toggleGroup(g) + (i < arr.length - 1 ? `<span class="${opts.classes.sep}">|</span>` : ''))
            .join('');

        wrap.html(`
            <div>
                <h1 class="${opts.classes.title}">${esc(opts.json.title)}</h1>
                ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
            </div>
            <div class="flex items-center gap-4">${togglesHtml}</div>
        `);

        $(`#${opts.parent}`).html(wrap);

        wrap.on('click', '[data-toggle-key]', (e) => {
            const $btn = $(e.currentTarget);
            const key = $btn.attr('data-toggle-key');
            const val = $btn.attr('data-toggle-value');
            state[key] = val;

            $btn.siblings('[data-toggle-key="' + key + '"]').addBack().each(function () {
                const isActive = $(this).attr('data-toggle-value') === val;
                this.className = isActive ? opts.classes.btnActive : opts.classes.btn;
            });

            opts.onToggle(key, val, Object.assign({}, state));
        });
    }

    viewFooter(options) {
        const defaults = {
            parent: 'root',
            id: 'viewFooter',
            class: 'flex items-center justify-between w-full',
            json: { info: '', legends: [] },
            tones: {
                default: '#9CA3AF',
                success: 'var(--cs-success,#3FC189)',
                warning: 'var(--cs-warning,#FBBF24)',
                danger: 'var(--cs-danger,#E02424)',
                info: 'var(--cs-info,#1C64F2)',
                purple: 'var(--cs-accent-purple,#7C3AED)'
            },
            classes: {
                info: 'text-[10px] text-[var(--cs-text-muted,#9CA3AF)]',
                legend: 'flex items-center gap-3 text-[10px] text-[var(--cs-text-muted,#9CA3AF)]',
                item: 'flex items-center gap-1'
            }
        };

        const o = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json = Object.assign({}, defaults.json, o.json || {});
        opts.tones = Object.assign({}, defaults.tones, o.tones || {});
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

    saleDetailPanel(options) {
        const defaults = {
            parent: 'root',
            id: 'saleDetailPanel',
            class: 'w-full h-full flex-shrink-0 bg-[var(--cs-bg-header,#141d2b)] border-l border-[var(--cs-border,#374151)] flex flex-col overflow-hidden',
            json: null,
            currency: 'es-MX',
            labels: {
                emptyTitle: 'Selecciona una venta',
                emptyHint: 'Haz click en cualquier fila de la tabla para ver el detalle completo aqui',
                informacion: 'Informacion',
                cliente: 'Cliente',
                fechaHora: 'Fecha y hora',
                items: 'Items - Productos',
                nota: 'Nota de la venta',
                metodosPago: 'Metodos de pago',
                subtotal: 'Subtotal',
                descuento: 'Descuento',
                total: 'Total',
                sinCliente: 'Sin cliente asociado',
                naCliente: 'N/A',
                sinNota: 'Sin nota',
                sinPagos: 'Sin pagos registrados',
                btnReabrir: 'Reabrir',
                btnReimprimir: 'Reimprimir',
                btnCancelar: 'Cancelar',
                folioPrefix: 'Venta'
            },
            sucursalLabels: {
                kafeto: 'Reginas Kafeto',
                central: 'Reginas Central',
                pasteleria: 'Reginas Pasteleria'
            },
            turnoLabels: {
                manana: 'Manana',
                tarde: 'Tarde',
                noche: 'Noche'
            },
            onClose: () => { },
            onReabrir: () => { },
            onReimprimir: () => { },
            onCancelar: () => { },
            loading: false
        };

        const o = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});
        opts.sucursalLabels = Object.assign({}, defaults.sucursalLabels, o.sucursalLabels || {});
        opts.turnoLabels = Object.assign({}, defaults.turnoLabels, o.turnoLabels || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const fmt = (n) => '$' + parseFloat(n || 0).toLocaleString(opts.currency, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        const parseDate = (iso) => {
            if (!iso) return { fecha: '—', hora: '—' };
            const d = new Date(iso);
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yy = d.getFullYear();
            const hh = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            return { fecha: `${dd}/${mm}/${yy}`, hora: `${hh}:${mi}` };
        };

        const statusBadge = (estatus) => {
            const v = String(estatus || '').toLowerCase();
            const map = {
                pagado: { bg: 'rgba(63,193,137,0.18)', fg: 'var(--cs-success,#3FC189)', txt: 'PAGADO' },
                cancelado: { bg: 'rgba(224,36,36,0.18)', fg: 'var(--cs-danger,#E02424)', txt: 'CANCELADO' },
                abierto: { bg: 'rgba(28,100,242,0.18)', fg: 'var(--cs-info,#1C64F2)', txt: 'ABIERTO' }
            };
            const c = map[v] || { bg: 'rgba(251,191,36,0.18)', fg: 'var(--cs-warning,#FBBF24)', txt: esc(estatus).toUpperCase() };
            return `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide" style="background:${c.bg};color:${c.fg};">${c.txt}</span>`;
        };

        const clienteHtml = (cli) => {
            if (!cli) {
                return `<p class="text-[11px] text-[var(--cs-text-muted,#9CA3AF)] italic">${esc(opts.labels.naCliente)}</p>
                        <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.sinCliente)}</p>`;
            }
            const phone = cli.phone ? `<p class="text-[10px] text-[var(--cs-text-secondary,#D1D5DB)]">${esc(cli.phone)}</p>` : '';
            const email = cli.email ? `<p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] truncate">${esc(cli.email)}</p>` : '';
            return `<p class="text-[12px] text-white font-bold leading-tight">${esc(cli.name)}</p>${phone}${email}`;
        };

        const itemsHtml = (items) => {
            if (!items || items.length === 0) {
                return `<p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] italic">Sin productos</p>`;
            }
            const rows = items.map(it => {
                const bruto = (it.price || 0) * (it.qty || 0);
                const neto = bruto * (1 - (it.discount || 0) / 100);
                const hasDisc = (it.discount || 0) > 0;
                const bgClass = hasDisc ? 'bg-[rgba(180,160,60,0.18)]' : '';
                return `
                    <div class="px-2 py-2 border-b border-[var(--cs-border,#374151)] last:border-b-0 ${bgClass}">
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex-1 min-w-0">
                                <p class="text-[13px] font-semibold text-white">${esc(it.name)}</p>
                                <div class="flex items-center gap-2 mt-0.5">
                                    <span class="text-[11px] text-[var(--cs-text-muted,#9CA3AF)]">${it.qty} × ${fmt(it.price)}</span>
                                    ${hasDisc ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border border-[var(--cs-warning,#FBBF24)] text-[var(--cs-warning,#FBBF24)] bg-[rgba(251,191,36,0.1)]">-${it.discount}%</span>` : ''}
                                </div>
                            </div>
                            <div class="text-right flex-shrink-0 pt-0.5">
                                ${hasDisc ? `<p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] line-through">${fmt(bruto)}</p>` : ''}
                                <p class="text-[14px] font-bold text-white">${fmt(neto)}</p>
                            </div>
                        </div>
                    </div>`;
            }).join('');
            return `<div class="rounded-lg border border-[var(--cs-border,#374151)] overflow-hidden">${rows}</div>`;
        };

        const pagosHtml = (pagos) => {
            if (!pagos || pagos.length === 0) {
                return `<p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] italic">${esc(opts.labels.sinPagos)}</p>`;
            }
            return pagos.map(p => `
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border border-[var(--cs-border,#374151)] text-[var(--cs-text-secondary,#D1D5DB)] bg-[var(--cs-bg-input,#1F2937)]">${esc(p.clave)}</span>
                        <span class="text-[11px] text-[var(--cs-text-secondary,#D1D5DB)]">${esc(p.name)}</span>
                    </div>
                    <span class="text-[11px] text-white font-semibold">${fmt(p.amount)}</span>
                </div>
            `).join('');
        };

        const calcTotals = (v) => {
            const items = v.items || [];
            const subtotal = items.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 0), 0);
            const descuento = items.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 0) * ((it.discount || 0) / 100), 0);
            return { subtotal, descuento, total: subtotal - descuento };
        };

        const aside = $('<aside>', { id: opts.id, class: opts.class });

        if (opts.loading) {
            aside.html(`
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
                    <div class="w-10 h-10 rounded-full border-2 border-[var(--cs-border,#374151)] border-t-[var(--cs-info,#1C64F2)] animate-spin"></div>
                    <p class="text-[11px] text-[var(--cs-text-muted,#9CA3AF)]">Cargando detalle...</p>
                </div>
            `);
            $(`#${opts.parent}`).html(aside);
            return;
        }

        if (!opts.json) {
            aside.html(`
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6">
                    <div class="w-16 h-16 rounded-full bg-[var(--cs-bg-input,#1F2937)] border border-[var(--cs-border,#374151)] flex items-center justify-center mb-3">
                        <i data-lucide="sticker" class="w-8 h-8 text-[var(--cs-border,#374151)]"></i>
                    </div>
                    <p class="text-[11px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
                </div>
            `);
            $(`#${opts.parent}`).html(aside);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const v = opts.json;
        const t = calcTotals(v);
        const f = parseDate(v.fecha);
        const sucursal = opts.sucursalLabels[v.sucursal] || v.sucursal || '—';
        const turno = opts.turnoLabels[v.turno] || v.turno || '—';
        const estadoTurn = v.turnoCerrado ? '(cerrado)' : '(abierto)';
        const items = v.items || [];

        aside.html(`
            <div class="px-3 py-3 border-b border-[var(--cs-border,#374151)] flex-shrink-0">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                        <h3 class="text-base font-bold text-white">${esc(opts.labels.folioPrefix)} ${esc(v.folio || '')}</h3>
                        ${statusBadge(v.estatus)}
                    </div>
                    <button id="${opts.id}_close" class="text-[var(--cs-text-secondary,#D1D5DB)] hover:text-white transition-colors" title="Cerrar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] mt-0.5">${esc(sucursal)} · ${esc(turno)} ${estadoTurn}</p>
            </div>

            <div class="flex-1 overflow-y-auto cs-scroll px-3 py-3 space-y-4">
                <div>
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold mb-2">${esc(opts.labels.informacion)}</p>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-lg p-3 border border-[var(--cs-border,#374151)]">
                            <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-semibold mb-1">${esc(opts.labels.cliente)}</p>
                            ${clienteHtml(v.cliente)}
                        </div>
                        <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-lg p-3 border border-[var(--cs-border,#374151)]">
                            <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-semibold mb-1">${esc(opts.labels.fechaHora)}</p>
                            <p class="text-[12px] text-white font-bold">${f.fecha}</p>
                            <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)]">${f.hora} · Turno: ${esc(turno)}</p>
                        </div>
                    </div>
                </div>

                <div>
                    <div class="flex items-center justify-between mb-2">
                        <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold">${esc(opts.labels.items)}</p>
                        <span class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase font-bold">${items.length} item${items.length === 1 ? '' : 's'}</span>
                    </div>
                    ${itemsHtml(items)}
                </div>

                <div>
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold mb-2">${esc(opts.labels.nota)}</p>
                    <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-lg px-3 py-2.5 border border-[var(--cs-border,#374151)]">
                        <p class="text-[11px] text-[var(--cs-text-secondary,#D1D5DB)] leading-snug">
                            ${v.nota ? esc(v.nota) : `<span class="italic text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.sinNota)}</span>`}
                        </p>
                    </div>
                </div>

                <div class="border-t border-[var(--cs-border,#374151)] pt-4">
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold mb-2">${esc(opts.labels.metodosPago)}</p>
                    <div class="space-y-1.5 mb-3">${pagosHtml(v.pagos)}</div>

                    <div class="flex items-center justify-between text-[11px] mb-1">
                        <span class="text-[var(--cs-text-secondary,#D1D5DB)]">${esc(opts.labels.subtotal)}</span>
                        <span class="text-white font-medium">${fmt(t.subtotal)}</span>
                    </div>
                    <div class="flex items-center justify-between text-[11px] mb-3">
                        <span class="text-[var(--cs-text-secondary,#D1D5DB)]">${esc(opts.labels.descuento)}</span>
                        <span class="text-[var(--cs-warning,#FBBF24)] font-medium">-${fmt(t.descuento)}</span>
                    </div>

                    <div class="border-t border-dashed border-[var(--cs-border,#374151)] pt-3">
                        <div class="flex items-center justify-between">
                            <span class="text-[11px] text-[var(--cs-text-muted,#9CA3AF)] uppercase font-bold">${esc(opts.labels.total)}</span>
                            <span class="text-xl text-[var(--cs-success,#3FC189)] font-extrabold">${fmt(t.total)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="px-5 py-3 border-t border-[var(--cs-border,#374151)] flex-shrink-0">
                <div class="grid grid-cols-3 gap-2">
                    <button id="${opts.id}_btnReabrir" class="flex items-center justify-center gap-1 px-2 py-2 rounded-md border border-[var(--cs-border,#374151)] text-[11px] text-white hover:bg-[var(--cs-bg-input,#1F2937)] transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M4 9a9 9 0 0114.85-3.36M20 20v-5h-5M20 15a9 9 0 01-14.85 3.36"/></svg>
                        ${esc(opts.labels.btnReabrir)}
                    </button>
                    <button id="${opts.id}_btnReimprimir" class="flex items-center justify-center gap-1 px-2 py-2 rounded-md border border-[var(--cs-border,#374151)] text-[11px] text-white hover:bg-[var(--cs-bg-input,#1F2937)] transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                        ${esc(opts.labels.btnReimprimir)}
                    </button>
                    <button id="${opts.id}_btnCancelar" class="flex items-center justify-center gap-1 px-2 py-2 rounded-md border border-[var(--cs-danger,#E02424)]/40 text-[11px] text-[var(--cs-danger,#E02424)] hover:bg-[var(--cs-danger,#E02424)]/10 transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                        ${esc(opts.labels.btnCancelar)}
                    </button>
                </div>
            </div>
        `);

        $(`#${opts.parent}`).html(aside);

        $(`#${opts.id}_close`).on('click', () => opts.onClose(v));
        $(`#${opts.id}_btnReabrir`).on('click', () => opts.onReabrir(v));
        $(`#${opts.id}_btnReimprimir`).on('click', () => opts.onReimprimir(v));
        $(`#${opts.id}_btnCancelar`).on('click', () => opts.onCancelar(v));
    }
}
