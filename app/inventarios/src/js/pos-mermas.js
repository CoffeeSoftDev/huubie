let api = 'ctrl/ctrl-pos-mermas.php';
let app, mermas, mermasView;

let turno, subsidiaries_id;

window.updateSession = () => { };

// Config estatica de la vista (titulo, leyendas de motivo). No son datos de negocio.
const VIEW_HEADER_MERMAS = {
    title:    'Visor de Mermas',
    subtitle: 'Control de perdidas por sucursal, motivo y periodo',
    back:     { href: '/app/inventarios/index.php', title: 'Regresar al inicio' }
};

const VIEW_FOOTER_MERMAS = {
    info: '',
    legends: [
        { tone: 'danger',  label: 'Caducidad'        },
        { tone: 'warning', label: 'Daniado'          },
        { tone: 'info',    label: 'Error produccion' },
        { tone: 'purple',  label: 'Robo / Faltante'  },
        { tone: 'success', label: 'Devolucion'       }
    ]
};


$(async () => {
    mermasView = new MermasView(api, 'root');
    mermas     = new Mermas(api, 'root');
    app        = new App(api, 'root');
    await app.init();
});


class App extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSMermas';
        this.subId = null;
    }

    async init() {
        const r = await fn_ajax({ opc: 'init' }, api).catch(() => null);
        if (r && r.status === 200) {
            this.dataInit = {
                subsidiaries_id: r.subsidiaries_id || '',
                sucursales:      r.sucursales      || [],
                motivos:         r.motivos_merma   || [],
                almacenes:       r.almacenes       || [],
                productos:       r.productos       || []
            };
        } else {
            this.dataInit = {
                subsidiaries_id: '',
                sucursales:      [],
                motivos:         [],
                almacenes:       [],
                productos:       []
            };
        }
        this.subId      = this.dataInit.subsidiaries_id;
        subsidiaries_id = this.subId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        mermasView.renderHeader(VIEW_HEADER_MERMAS, () => mermas.openMermaForm());
        mermasView.renderFooter(VIEW_FOOTER_MERMAS);
        mermasView.renderDetail(null);
        this.populateFilters();
        mermas.lsMermas();
        mermas.lsKpis();
    }

    // -- Layout --

    layout() {

        const mainPanel = {
            type: 'div',
            id:   'mainPanel',
            class:'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                {
                    id:    'viewHeader',
                    text:  '#viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    class: 'px-4 py-3 bg-[#141d2b] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    text:  '#tableWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto'
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
            class:'w-full md:w-[420px] flex-shrink-0 bg-[#141d2b] border-t md:border-t-0 md:border-l border-[#374151] flex flex-col overflow-hidden',
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

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden overflow-y-auto md:overflow-hidden',
                container: [mainPanel, detailPanel]
            }
        });
    }

    // -- Filter bar --

    filterBar() {

        let filters = [
            {
                opc:         'input',
                id:          'fRango',
                lbl:         'Rango:',
                class:       'col-12 col-md-6 col-lg-3',
                readonly:    true,
                placeholder: 'Selecciona un rango',
                value:       '',
                required:    false
            },
            {
                opc:      'select',
                id:       'subsidiaries_id',
                lbl:      'Sucursal:',
                class:    'col-12 col-md-6 col-lg-2',
                onchange: 'app.onChangeFilters()',
                data:     []
            },
            {
                opc:      'select',
                id:       'fMotivo',
                lbl:      'Motivo:',
                class:    'col-12 col-md-6 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data: [
                    { id: '', valor: 'Todos' }
                ]
            },
            {
                opc:        'input',
                id:         'qBuscar',
                lbl:        'Buscar:',
                class:      'col-12 col-md-6 col-lg-2',
                placeholder:'Folio o producto...',
                onkeyup:    'app.onChangeFilters()'
            },
            {
                opc:       'button',
                id:        'btnNuevaMerma',
                text:      'Nueva Merma',
                color_btn: 'danger',
                class:     'col-12 col-md-6 col-lg-3',
                onClick:   () => mermas.openMermaForm()
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      'dark',
            data:       filters
        });

        this.initRangePicker();
    }

    // Rango de fechas via bootstrap-daterangepicker sobre #fRango. Default: ultimos 7 dias.
    initRangePicker() {
        this.rangeFi = moment().subtract(6, 'days').format('YYYY-MM-DD');
        this.rangeFf = moment().format('YYYY-MM-DD');

        dataPicker({
            parent: 'fRango',
            type:   'all',
            rangepicker: {
                startDate:           moment().subtract(6, 'days'),
                endDate:             moment(),
                showDropdowns:       true,
                alwaysShowCalendars: true,
                ranges: {
                    'Hoy':             [moment(), moment()],
                    'Ayer':            [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                    'Ultimos 7 dias':  [moment().subtract(6, 'days'), moment()],
                    'Semana actual':   [moment().startOf('isoWeek'), moment().endOf('isoWeek')],
                    'Semana anterior': [moment().subtract(1, 'week').startOf('isoWeek'), moment().subtract(1, 'week').endOf('isoWeek')],
                    'Mes actual':      [moment().startOf('month'), moment().endOf('month')],
                    'Mes anterior':    [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
                },
                locale: {
                    format:           'YYYY-MM-DD',
                    separator:        '  a  ',
                    applyLabel:       'Aplicar',
                    cancelLabel:      'Cancelar',
                    customRangeLabel: 'Personalizado',
                    daysOfWeek:       ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'],
                    monthNames:       ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
                    firstDay:         1
                }
            },
            onSelect: (start, end) => {
                this.rangeFi = start.format('YYYY-MM-DD');
                this.rangeFf = end.format('YYYY-MM-DD');
                this.onChangeFilters();
            }
        });
    }

    populateFilters() {
        const sucursales = this.dataInit.sucursales || [];
        if (sucursales.length) {
            this.populateSelect('subsidiaries_id', sucursales);
            $('#subsidiaries_id').val(this.subId);
        }
        // Motivos del catalogo real: el value es el shrinkage_reason_id (numerico).
        this.populateSelect('fMotivo', this.dataInit.motivos || []);
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
        return {
            subsidiaries_id: $('#subsidiaries_id').val() || this.subId || '',
            fi:              this.rangeFi               || '',
            ff:              this.rangeFf               || '',
            motivo:          $('#fMotivo').val()        || '',
            q:               $('#qBuscar').val()        || ''
        };
    }

    // -- Event handlers --

    async onChangeFilters() {
        mermas.lsMermas();
        await mermas.lsKpis();
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    // -- Facade --

    renderDetail(merma) {
        mermasView.renderDetail(merma);
    }

    printMerma(id) {
        mermas.printMerma(id);
    }

    reverseMerma(id) {
        mermas.reverseMerma(id);
    }
}

class Mermas extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSMermas';
    }

    // -- Data --

    async lsMermas() {
        const f = app.getFilters();
        const r = await fn_ajax(Object.assign({ opc: 'lsMermas' }, {
            subsidiaries_id: f.subsidiaries_id,
            reason_id:       f.motivo,
            fi:              f.fi,
            ff:              f.ff,
            q:               f.q
        }), api).catch(() => null);

        const data = (r && r.status === 200) ? { row: r.row } : { row: [] };

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'dark',
            title:        '',
            subtitle:     '',
            center:       [1, 4, 5, 8],
            right:        [6],
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       12,
            emptyMessage: 'No se encontraron mermas con los filtros aplicados',
            emptyIcon:    'icon-trash-empty',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        const total = (data.row || []).length;

        if (total > 0 && typeof simple_data_table === 'function') {
            simple_data_table(`#tb${this.PROJECT_NAME}`, 10);
        }

        app.updateFooterInfo(`Mostrando ${total} merma${total !== 1 ? 's' : ''}`);
    }

    async lsKpis() {
        const f = app.getFilters();
        const r = await fn_ajax({
            opc:             'showMermas',
            subsidiaries_id: f.subsidiaries_id,
            fi:              f.fi,
            ff:              f.ff
        }, api).catch(() => null);

        const c   = (r && r.status === 200) ? r.counts : {};
        const fmt = (n) => '$' + parseFloat(n || 0).toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        const kpis = [
            { id: 'kpiMermaHoy',  label: 'Perdida total', value: fmt(c.total_costo),                          tone: 'danger'  },
            { id: 'kpiRegistros', label: 'Registros',     value: parseInt(c.total_mermas    || 0, 10),        tone: 'default' },
            { id: 'kpiUnidades',  label: 'Unidades',      value: parseInt(c.total_unidades  || 0, 10),        tone: 'warning' },
            { id: 'kpiMotivo',    label: 'Motivo top',    value: c.motivo_top || '-',                         tone: 'purple'  }
        ];
        mermasView.renderInfoCards(kpis);
    }

    async getMerma(id) {
        const r = await fn_ajax({ opc: 'getMerma', id: id }, api).catch(() => null);
        if (r && r.status === 200) {
            mermasView.renderDetail(this.mapMermaDetail(r.header || {}, r.detail || []));
        } else {
            mermasView.renderDetail(null);
        }
    }

    // Normaliza la respuesta del backend (columnas DB) al shape que espera mermaDetailPanel.
    mapMermaDetail(h, detail) {
        const created = String(h.created_at || '');
        return {
            id:             h.id,
            folio:          h.folio,
            motivo:         h.reason_name || '',
            fecha:          created ? created.replace(' ', 'T') : '',
            sucursal:       h.subsidiary_name || '',
            almacen:        h.warehouse_name  || '',
            registrado_por: h.user_name ? { name: h.user_name } : null,
            nota:           h.note         || '',
            foto:           h.evidence_url || '',
            items: (detail || []).map(d => ({
                name:        d.product_name,
                sku:         d.sku,
                qty:         Number(d.quantity || 0),
                costo_unit:  Number(d.cost || 0),
                costo_total: Number(d.subtotal_loss != null ? d.subtotal_loss : Number(d.quantity || 0) * Number(d.cost || 0))
            })),
            total_unidades: Number(h.total_units || 0),
            total_costo:    Number(h.total_cost_loss || 0)
        };
    }

    // -- Actions --

    openMermaForm() {
        // Sucursal por defecto = la seleccionada en el filtro (o la del navbar).
        const curSub = $('#subsidiaries_id').val() || app.subId;
        if (!this.mermaFormApi) {
            this.mermaFormApi = mermasView.mermaForm({
                parent: 'body',
                id:     'mermaFormModal',
                json:   app.dataInit.productos || [],
                data: {
                    motivos:         (app.dataInit.motivos || []).filter(m => m.id !== ''),
                    sucursales:      (app.dataInit.sucursales || []).filter(s => s.id !== ''),
                    almacenes:       app.dataInit.almacenes || [],
                    fecha:           moment().format('YYYY-MM-DD'),
                    subsidiaries_id: curSub
                },
                onSubmit: async (payload) => {
                    const backendPayload = {
                        note:                payload.nota || null,
                        evidence_url:        null, // pendiente endpoint de subida de evidencia
                        status:              'Aplicada',
                        shrinkage_reason_id: payload.motivo,
                        warehouse_id:        payload.warehouseId,
                        subsidiaries_id:     payload.sucursalId,
                        productos:           payload.items.map(it => ({
                            product_id: it.id,
                            quantity:   it.qty,
                            cost:       it.costo
                        }))
                    };

                    const r = await fn_ajax({
                        opc:     'saveMerma',
                        payload: JSON.stringify(backendPayload)
                    }, api).catch(() => null);

                    if (r && r.status === 200) {
                        if (typeof alert === 'function') alert({ icon: 'success', text: r.message || ('Merma ' + r.folio + ' registrada') });
                        this.lsMermas();
                        this.lsKpis();
                    } else {
                        if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo registrar la merma' });
                    }
                },
                onClose: () => console.log('[mermaForm] cerrado')
            });
        }
        // Sincroniza la sucursal del navbar (y sus almacenes) en cada apertura.
        this.mermaFormApi.setData({ subsidiaries_id: curSub, fecha: moment().format('YYYY-MM-DD') });
        this.mermaFormApi.open();
    }

    printMerma(id) {
        console.log('[printMerma]', id);
        alert({ icon: 'info', text: 'Imprimiendo merma ' + id });
    }

    reverseMerma(id) {
        const doReverse = async () => {
            const r = await fn_ajax({ opc: 'reverseMerma', id: id }, api).catch(() => null);
            if (r && r.status === 200) {
                alert({ icon: 'success', text: 'Merma ' + id + ' revertida' });
                mermasView.renderDetail(null);
                this.lsMermas();
                this.lsKpis();
            } else {
                alert({ icon: 'error', text: (r && r.message) || 'No se pudo revertir' });
            }
        };

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: '¿Reversar esta merma?',
                text:  'El stock de los productos sera restaurado. Accion irreversible.',
                icon:  'warning',
                showCancelButton:  true,
                confirmButtonText: 'Si, reversar',
                cancelButtonText:  'Cancelar'
            }).then((r) => { if (r.isConfirmed) doReverse(); });
        } else {
            doReverse();
        }
    }
}

class MermasView extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSMermas';
    }

    // -- Render helpers --

    renderDetail(merma) {
        this.mermaDetailPanel({
            parent:      'detailPanel',
            json:        merma,
            onClose:     ()  => this.renderDetail(null),
            onImprimir:  (m) => console.log('[mermaDetailPanel] imprimir',  m && m.folio),
            onReversar:  (m) => { if (m) mermas.reverseMerma(m.id); }
        });
    }

    renderInfoCards(rows) {
        this.kpisRow({
            parent:  'kpisRow',
            json:    rows,
            onClick: (kpi) => console.log('[kpisRow] click', kpi.id)
        });
    }

    renderHeader(data, onNueva) {
        this.viewHeader({
            parent:   'viewHeader',
            json:     data,
            onToggle: (key, value) => console.log('[viewHeader] toggle', key, '->', value),
            onNueva:  onNueva || (() => { })
        });
    }

    renderFooter(data) {
        this.viewFooter({
            parent: 'viewFooter',
            json:   data
        });
    }

    // -- Components --

    kpisRow(options) {
        const defaults = {
            parent: 'root',
            id:     'kpisRow',
            class:  'grid grid-cols-4 gap-3',
            json:   [],
            labels: {
                empty: 'Sin indicadores'
            },
            tones: {
                default: 'text-white',
                success: 'cs-text-success text-[var(--cs-success,#3FC189)]',
                warning: 'cs-text-warning text-[var(--cs-warning,#FBBF24)]',
                danger:  'cs-text-danger  text-[var(--cs-danger,#E02424)]',
                info:    'cs-text-info    text-[var(--cs-info,#1C64F2)]',
                purple:  'cs-text-purple  text-[var(--cs-accent-purple,#7C3AED)]'
            },
            cardClass:  'cs-kpi-card bg-[var(--cs-bg-input,#1F2937)]  rounded-lg px-3 py-3 cursor-pointer hover:bg-[var(--cs-bg-header,#141d2b)] transition-colors',
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
            id:     'viewHeader',
            class:  'flex items-center justify-between w-full',
            json:   { title: '', subtitle: '', toggles: [], back: null },
            classes: {
                title:     'text-base font-bold text-white',
                subtitle:  'text-[10px] text-[var(--cs-text-secondary,#D1D5DB)]',
                groupLbl:  'text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold',
                btn:       'demo-toggle px-2.5 py-1 rounded text-[11px] border border-[var(--cs-border,#374151)] text-[var(--cs-text-secondary,#D1D5DB)] hover:bg-[var(--cs-bg-input,#1F2937)] transition-colors',
                btnActive: 'demo-toggle active px-2.5 py-1 rounded text-[11px] border border-[var(--cs-danger,#E02424)] bg-[var(--cs-danger,#E02424)]/15 text-white',
                sep:       'text-[var(--cs-border,#374151)]',
                backBtn:   'w-8 h-8 rounded-full bg-[var(--cs-bg-input,#1F2937)] hover:bg-[var(--cs-danger,#E02424)]/15 border border-[var(--cs-border,#374151)] hover:border-[var(--cs-danger,#E02424)] flex items-center justify-center text-[var(--cs-text-secondary,#D1D5DB)] hover:text-white transition-colors flex-shrink-0'
            },
            onToggle: () => { },
            onNueva:  () => { },
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

    mermaDetailPanel(options) {
        const defaults = {
            parent:   'root',
            id:       'mermaDetailPanel',
            class:    'w-full h-full flex-shrink-0 bg-[var(--cs-bg-header,#141d2b)] border-l border-[var(--cs-border,#374151)] flex flex-col overflow-hidden',
            json:     null,
            currency: 'es-MX',
            labels: {
                emptyTitle:  'Selecciona una merma',
                emptyHint:   'Haz click en cualquier fila de la tabla para ver el detalle completo aqui',
                informacion: 'Informacion general',
                registrado:  'Registrado por',
                fechaHora:   'Fecha y hora',
                motivoLbl:   'Motivo de la merma',
                items:       'Productos en merma',
                nota:        'Nota / observaciones',
                evidencia:   'Foto de evidencia',
                sinFoto:     'Sin foto de evidencia',
                sinNota:     'Sin nota',
                unidades:    'Unidades',
                perdida:     'Perdida total',
                btnImprimir: 'Imprimir',
                btnReversar: 'Reversar',
                folioPrefix: 'Merma'
            },
            sucursalLabels: {
                kafeto:     'Reginas Kafeto',
                central:    'Reginas Central',
                pasteleria: 'Reginas Pasteleria'
            },
            onClose:    () => { },
            onImprimir: () => { },
            onReversar: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels         = Object.assign({}, defaults.labels,         o.labels         || {});
        opts.sucursalLabels = Object.assign({}, defaults.sucursalLabels, o.sucursalLabels || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const fmt = (n) => '$' + parseFloat(n || 0).toLocaleString(opts.currency, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        const parseDate = (iso) => {
            if (!iso) return { fecha: '—', hora: '—' };
            const d  = new Date(iso);
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yy = d.getFullYear();
            const hh = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            return { fecha: `${dd}/${mm}/${yy}`, hora: `${hh}:${mi}` };
        };

        const motivoBadge = (motivo) => {
            const map = {
                'Caducidad':        { bg: 'rgba(224,36,36,0.18)',  fg: 'var(--cs-danger,#E02424)'        },
                'Daniado':          { bg: 'rgba(251,191,36,0.18)', fg: 'var(--cs-warning,#FBBF24)'       },
                'Error produccion': { bg: 'rgba(28,100,242,0.18)', fg: 'var(--cs-info,#1C64F2)'          },
                'Robo/Faltante':    { bg: 'rgba(124,58,237,0.18)', fg: 'var(--cs-accent-purple,#7C3AED)' },
                'Devolucion':       { bg: 'rgba(63,193,137,0.18)', fg: 'var(--cs-success,#3FC189)'       }
            };
            const c = map[motivo] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
            return `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide" style="background:${c.bg};color:${c.fg};">${esc(motivo).toUpperCase()}</span>`;
        };

        const itemsHtml = (items) => {
            if (!items || items.length === 0) {
                return `<p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] italic">Sin productos</p>`;
            }
            const rows = items.map(it => {
                return `
                    <div class="px-2 py-2 border-b border-[var(--cs-border,#374151)] last:border-b-0">
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex-1 min-w-0">
                                <p class="text-[13px] font-semibold text-white">${esc(it.name)}</p>
                                <div class="flex items-center gap-2 mt-0.5">
                                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border border-[var(--cs-border,#374151)] text-[var(--cs-text-secondary,#D1D5DB)] bg-[var(--cs-bg-input,#1F2937)]">${esc(it.sku || '—')}</span>
                                    <span class="text-[11px] text-[var(--cs-text-muted,#9CA3AF)]">${it.qty} × ${fmt(it.costo_unit)}</span>
                                </div>
                            </div>
                            <div class="text-right flex-shrink-0 pt-0.5">
                                <p class="text-[14px] font-bold text-[var(--cs-danger,#E02424)]">-${fmt(it.costo_total)}</p>
                            </div>
                        </div>
                    </div>`;
            }).join('');
            return `<div class="rounded-lg border border-[var(--cs-border,#374151)] overflow-hidden">${rows}</div>`;
        };

        const fotoHtml = (foto) => {
            if (!foto) {
                return `
                    <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-lg p-4 border border-dashed border-[var(--cs-border,#374151)] flex flex-col items-center justify-center min-h-[120px]">
                        <svg class="w-8 h-8 text-[var(--cs-border,#374151)] mb-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16l4-4a3 3 0 014 0l5 5M14 14l1-1a3 3 0 014 0l2 2M14 8h.01M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                        </svg>
                        <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] italic">${esc(opts.labels.sinFoto)}</p>
                    </div>`;
            }
            return `
                <div class="rounded-lg overflow-hidden border border-[var(--cs-border,#374151)]">
                    <img src="${esc(foto)}" alt="Evidencia" class="w-full h-32 object-cover" />
                </div>`;
        };

        const registradoHtml = (reg) => {
            if (!reg) {
                return `<p class="text-[11px] text-[var(--cs-text-muted,#9CA3AF)] italic">Sin usuario</p>`;
            }
            const rol   = reg.rol   ? `<p class="text-[10px] text-[var(--cs-text-secondary,#D1D5DB)]">${esc(reg.rol)}</p>`     : '';
            const email = reg.email ? `<p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] truncate">${esc(reg.email)}</p>` : '';
            return `<p class="text-[12px] text-white font-bold leading-tight">${esc(reg.name)}</p>${rol}${email}`;
        };

        const aside = $('<aside>', { id: opts.id, class: opts.class });

        if (!opts.json) {
            aside.html(`
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6">
                    <div class="w-16 h-16 rounded-full bg-[var(--cs-bg-input,#1F2937)] border border-[var(--cs-border,#374151)] flex items-center justify-center mb-3">
                        <i data-lucide="package-x" class="w-8 h-8 text-[var(--cs-border,#374151)]"></i>
                    </div>
                    <p class="text-[11px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
                </div>
            `);
            $(`#${opts.parent}`).html(aside);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const m        = opts.json;
        const f        = parseDate(m.fecha);
        const sucursal = opts.sucursalLabels[m.sucursal] || m.sucursal || '—';
        const items    = m.items || [];

        aside.html(`
            <div class="px-3 py-3 border-b border-[var(--cs-border,#374151)] flex-shrink-0">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                        <h3 class="text-base font-bold text-[var(--cs-danger,#E02424)]">${esc(opts.labels.folioPrefix)} ${esc(m.folio || '')}</h3>
                        ${motivoBadge(m.motivo)}
                    </div>
                    <button id="${opts.id}_close" class="text-[var(--cs-text-secondary,#D1D5DB)] hover:text-white transition-colors" title="Cerrar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] mt-0.5">${esc(sucursal)} · ${f.fecha} ${f.hora}</p>
            </div>

            <div class="flex-1 overflow-y-auto cs-scroll px-3 py-3 space-y-4">
                <div>
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold mb-2">${esc(opts.labels.informacion)}</p>
                    <div class="grid grid-cols-2 gap-2">
                        <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-lg p-3 border border-[var(--cs-border,#374151)]">
                            <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-semibold mb-1">${esc(opts.labels.registrado)}</p>
                            ${registradoHtml(m.registrado_por)}
                        </div>
                        <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-lg p-3 border border-[var(--cs-border,#374151)]">
                            <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-semibold mb-1">${esc(opts.labels.fechaHora)}</p>
                            <p class="text-[12px] text-white font-bold">${f.fecha}</p>
                            <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)]">${f.hora}</p>
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
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold mb-2">${esc(opts.labels.evidencia)}</p>
                    ${fotoHtml(m.foto)}
                </div>

                <div>
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold mb-2">${esc(opts.labels.nota)}</p>
                    <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-lg px-3 py-2.5 border border-[var(--cs-border,#374151)]">
                        <p class="text-[11px] text-[var(--cs-text-secondary,#D1D5DB)] leading-snug">
                            ${m.nota ? esc(m.nota) : `<span class="italic text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.sinNota)}</span>`}
                        </p>
                    </div>
                </div>

                <div class="border-t border-[var(--cs-border,#374151)] pt-4">
                    <div class="flex items-center justify-between text-[11px] mb-1">
                        <span class="text-[var(--cs-text-secondary,#D1D5DB)]">${esc(opts.labels.unidades)}</span>
                        <span class="text-white font-medium">${esc(m.total_unidades || 0)}</span>
                    </div>
                    <div class="border-t border-dashed border-[var(--cs-border,#374151)] pt-3 mt-2">
                        <div class="flex items-center justify-between">
                            <span class="text-[11px] text-[var(--cs-text-muted,#9CA3AF)] uppercase font-bold">${esc(opts.labels.perdida)}</span>
                            <span class="text-xl text-[var(--cs-danger,#E02424)] font-extrabold">-${fmt(m.total_costo)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="px-5 py-3 border-t border-[var(--cs-border,#374151)] flex-shrink-0">
                <div class="grid grid-cols-2 gap-2">
                    <button id="${opts.id}_btnImprimir" class="flex items-center justify-center gap-1 px-2 py-2 rounded-md border border-[var(--cs-border,#374151)] text-[11px] text-white hover:bg-[var(--cs-bg-input,#1F2937)] transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                        </svg>
                        ${esc(opts.labels.btnImprimir)}
                    </button>
                    <button id="${opts.id}_btnReversar" class="flex items-center justify-center gap-1 px-2 py-2 rounded-md border border-[var(--cs-danger,#E02424)]/40 text-[11px] text-[var(--cs-danger,#E02424)] hover:bg-[var(--cs-danger,#E02424)]/10 transition-colors">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M4 9a9 9 0 0114.85-3.36M20 20v-5h-5M20 15a9 9 0 01-14.85 3.36"/>
                        </svg>
                        ${esc(opts.labels.btnReversar)}
                    </button>
                </div>
            </div>
        `);

        $(`#${opts.parent}`).html(aside);
        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}_close`).on('click',       () => opts.onClose(m));
        $(`#${opts.id}_btnImprimir`).on('click', () => opts.onImprimir(m));
        $(`#${opts.id}_btnReversar`).on('click', () => opts.onReversar(m));
    }
}
