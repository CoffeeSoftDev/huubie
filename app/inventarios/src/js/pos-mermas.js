let api = 'ctrl/ctrl-pos-mermas.php';
let app, mermas, mermasView;

let turno, subsidiaries_id;

window.updateSession = () => { };


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
                subsidiaries_id: r.subsidiaries_id || 4,
                sucursales:      r.sucursales      || [],
                motivos:         r.motivos_merma   || [],
                almacenes:       r.almacenes       || []
            };
        } else {
            this.dataInit = {
                subsidiaries_id: 4,
                sucursales: [
                    { id: 4, valor: 'Reginas Kafeto'     },
                    { id: 5, valor: 'Reginas Central'    },
                    { id: 6, valor: 'Reginas Pasteleria' }
                ],
                motivos: [
                    { id: 'Caducidad',        valor: 'Caducidad'        },
                    { id: 'Daniado',          valor: 'Daniado / Roto'   },
                    { id: 'Error produccion', valor: 'Error produccion' },
                    { id: 'Robo/Faltante',    valor: 'Robo / Faltante'  },
                    { id: 'Devolucion',       valor: 'Devolucion'       }
                ],
                almacenes: []
            };
        }
        this.subId      = this.dataInit.subsidiaries_id;
        subsidiaries_id = this.subId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        mermasView.renderHeader(SAMPLE_VIEW_HEADER_MERMAS, () => mermas.openMermaForm());
        mermasView.renderFooter(SAMPLE_VIEW_FOOTER_MERMAS);
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
            class:'flex-1 flex flex-col overflow-hidden min-w-0 w-full',
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
                opc:      'select',
                id:       'fPeriodo',
                lbl:      'Periodo:',
                class:    'col-12 col-md-3 col-lg-2',
                onchange: 'app.onChangePeriodo()',
                value:    'hoy',
                data: [
                    { id: 'hoy',    valor: 'Hoy'        },
                    { id: 'semana', valor: 'Esta semana'},
                    { id: 'mes',    valor: 'Este mes'   },
                    { id: 'rango',  valor: 'Por rango'  }
                ]
            },
            {
                opc:      'select',
                id:       'subsidiaries_id',
                lbl:      'Sucursal:',
                class:    'col-12 col-md-3 col-lg-3',
                onchange: 'app.onChangeFilters()',
                data:     []
            },
            {
                opc:      'select',
                id:       'fMotivo',
                lbl:      'Motivo:',
                class:    'col-12 col-md-3 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data: [
                    { id: '',                 valor: 'Todos'           },
                    { id: 'Caducidad',        valor: 'Caducidad'       },
                    { id: 'Daniado',          valor: 'Daniado / Roto'  },
                    { id: 'Error produccion', valor: 'Error produccion'},
                    { id: 'Robo/Faltante',    valor: 'Robo / Faltante' },
                    { id: 'Devolucion',       valor: 'Devolucion'      }
                ]
            },
            {
                opc:   'input-calendar',
                id:    'calendarPOSMermas',
                lbl:   'Rango de fecha:',
                class: 'col-12 col-md-4 col-lg-3'
            },
            {
                opc:        'input',
                id:         'qBuscar',
                lbl:        'Buscar:',
                class:      'col-12 col-md-3 col-lg-2',
                placeholder:'Folio o producto...',
                onkeyup:    'app.onChangeFilters()'
            }
        ];

        this.createfilterBar({
            parent: 'filterBar',
            data:   filters
        });

        $('#fPeriodo').val('hoy');

        dataPicker({
            parent: `calendar${this.PROJECT_NAME}`,
            rangepicker: {
                startDate: moment('2026-05-01'),
                endDate:   moment('2026-05-16'),
                showDropdowns: true,
                ranges: {
                    'Hoy':           [moment(), moment()],
                    'Ayer':          [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                    'Semana actual': [moment().startOf('week'),  moment().endOf('week')],
                    'Mes actual':    [moment().startOf('month'), moment().endOf('month')],
                    'Mes anterior':  [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
                }
            },
            onSelect: () => this.onChangeFilters()
        });

        this.onChangePeriodo();
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
            $sel.append(`<option value="${item.id}">${item.valor}</option>`);
        });
    }

    getFilters() {
        const fPeriodo = $('#fPeriodo').val() || 'hoy';
        let fi = '';
        let ff = '';

        const today = moment();
        if (fPeriodo === 'hoy') {
            fi = today.format('YYYY-MM-DD');
            ff = today.format('YYYY-MM-DD');
        } else if (fPeriodo === 'semana') {
            fi = today.clone().startOf('week').format('YYYY-MM-DD');
            ff = today.clone().endOf('week').format('YYYY-MM-DD');
        } else if (fPeriodo === 'mes') {
            fi = today.clone().startOf('month').format('YYYY-MM-DD');
            ff = today.clone().endOf('month').format('YYYY-MM-DD');
        } else if (fPeriodo === 'rango') {
            const range = getDataRangePicker(`calendar${this.PROJECT_NAME}`) || {};
            fi = range.fi || '';
            ff = range.ff || '';
        }

        return {
            subsidiaries_id: $('#subsidiaries_id').val() || this.subId || '',
            fPeriodo:        fPeriodo,
            fi:              fi,
            ff:              ff,
            motivo:          $('#fMotivo').val() || '',
            q:               $('#qBuscar').val() || ''
        };
    }

    // -- Event handlers --

    async onChangeFilters() {
        mermas.lsMermas();
        await mermas.lsKpis();
    }

    onChangePeriodo() {
        const mode = $('#fPeriodo').val() || 'hoy';
        const $rangeWrap = $('#calendarPOSMermas').closest('[class*="col-"]');

        if (mode === 'rango') $rangeWrap.show();
        else                  $rangeWrap.hide();

        this.onChangeFilters();
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

        const data = (r && r.status === 200) ? { row: r.row } : SAMPLE_MERMAS_TABLE;

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'dark',
            title:        '',
            subtitle:     '',
            center:       [3, 4, 8],
            right:        [5],
            extends:      true,
            scrollable:   true,
            f_size:       12,
            emptyMessage: 'No se encontraron mermas con los filtros aplicados',
            emptyIcon:    'icon-trash-empty',
            data:         data
        });

        const total = (data.row || []).length;
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

        const c   = (r && r.status === 200) ? r.counts : SAMPLE_MERMAS_COUNTS;
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
            mermasView.renderDetail(Object.assign({}, r.header, { detail: r.detail }));
        } else {
            mermasView.renderDetail(SAMPLE_MERMA_DETAIL);
        }
    }

    // -- Actions --

    openMermaForm() {
        mermasView.mermaFormModal({
            productCatalog: SAMPLE_PRODUCT_CATALOG,
            motivos:        app.dataInit.motivos,
            sucursales:     app.dataInit.sucursales,
            defaults: {
                sucursal: app.subId,
                fecha:    moment().format('YYYY-MM-DD')
            },
            onSubmit: async (payload) => {
                const r = await fn_ajax({
                    opc:     'saveMerma',
                    payload: JSON.stringify(payload)
                }, api).catch(() => null);

                if (r && r.status === 200) {
                    alert({ icon: 'success', text: 'Merma ' + r.folio + ' registrada' });
                    this.lsMermas();
                    this.lsKpis();
                } else {
                    alert({ icon: 'error', text: (r && r.message) || 'No se pudo registrar la merma' });
                }
            }
        });
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
                <button id="btnNuevaMerma"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--cs-danger,#E02424)] hover:bg-[#DC2626] text-white text-[11px] font-bold transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    Nueva Merma
                </button>
                ${togglesHtml}
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        wrap.on('click', '#btnNuevaMerma', () => opts.onNueva());

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

    mermaFormModal(options) {
        const defaults = {
            id:             'modalNuevaMerma',
            currency:       'es-MX',
            productCatalog: [],
            motivos: [
                { id: 'Caducidad',        valor: 'Caducidad / Vencimiento' },
                { id: 'Daniado',          valor: 'Producto dañado'         },
                { id: 'Error produccion', valor: 'Error de produccion'     },
                { id: 'Robo/Faltante',    valor: 'Robo / Faltante'         },
                { id: 'Devolucion',       valor: 'Devolucion de cliente'   },
                { id: 'Otro',             valor: 'Otro'                    }
            ],
            sucursales: [],
            defaults: {
                motivo:   'Caducidad',
                sucursal: '',
                fecha:    moment().format('YYYY-MM-DD'),
                nota:     ''
            },
            labels: {
                title:        'Registrar Merma',
                subtitle:     'Reporta productos dañados, vencidos o perdidos',
                lblMotivo:    'Motivo',
                lblSucursal:  'Sucursal',
                lblFecha:     'Fecha',
                lblNota:      'Observaciones',
                lblBuscar:    'Buscar productos',
                phBuscar:     'Nombre o SKU...',
                lblFoto:      'Evidencia fotografica',
                fotoHint:     'Tomar foto o subir',
                fotoExts:     'JPG/PNG · max. 5 MB',
                lblResumen:   'Resumen del folio',
                lblItems:     'Productos',
                lblUnidades:  'Unidades',
                lblPerdida:   'Perdida total',
                lblLista:     'Productos en merma',
                btnLimpiar:   'Limpiar',
                emptyLista:   'Aun no se han agregado productos',
                emptyHint:    'Usa el buscador para agregar productos',
                btnCancelar:  'Cancelar',
                btnRegistrar: 'Registrar Merma',
                footNote:     'El stock se descontara automaticamente'
            },
            onSubmit: () => { },
            onCancel: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.defaults = Object.assign({}, defaults.defaults, o.defaults || {});
        opts.labels   = Object.assign({}, defaults.labels,   o.labels   || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const fmt = (n) => '$' + parseFloat(n || 0).toLocaleString(opts.currency, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        const state = {
            items:    [],
            photo:    null,
            motivo:   opts.defaults.motivo,
            sucursal: opts.defaults.sucursal,
            fecha:    opts.defaults.fecha,
            nota:     opts.defaults.nota
        };

        const $existing = $(`#${opts.id}`);
        if ($existing.length) $existing.remove();

        const motivosOpts = opts.motivos.map(m =>
            `<option value="${esc(m.id)}" ${m.id === state.motivo ? 'selected' : ''}>${esc(m.valor)}</option>`
        ).join('');

        const sucursalesOpts = opts.sucursales.map(s =>
            `<option value="${esc(s.id)}" ${String(s.id) === String(state.sucursal) ? 'selected' : ''}>${esc(s.valor)}</option>`
        ).join('');

        const modal = $(`
            <div id="${opts.id}" style="position:fixed;inset:0;z-index:100;">
                <div class="cs-modal-backdrop" data-modal-close style="position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:90;"></div>
                <div class="cs-modal" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:95%;max-width:960px;max-height:90vh;background:#111928;border:1px solid rgba(55,65,81,0.6);border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,0.6);overflow:hidden;display:flex;flex-direction:column;z-index:100;">

                    <div class="cs-modal-header" style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(55,65,81,0.6);background:#141d2b;flex-shrink:0;">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style="background:linear-gradient(135deg,#EF4444,#F97316);box-shadow:0 8px 20px rgba(239,68,68,0.2);">
                                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-white">${esc(opts.labels.title)}</h3>
                                <p class="text-[11px] text-gray-500">${esc(opts.labels.subtitle)}</p>
                            </div>
                        </div>
                        <button class="w-8 h-8 rounded-lg bg-[#1a2332] border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white" data-modal-close>
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>

                    <div class="cs-modal-body" style="padding:0;flex:1;overflow:hidden;min-height:0;display:flex;flex-direction:column;">

                        <div class="px-5 pt-3 pb-3 border-b border-gray-800/70" style="background:rgba(15,24,37,0.4);">
                            <div class="grid grid-cols-4 gap-2">
                                <div>
                                    <label class="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider font-semibold">${esc(opts.labels.lblMotivo)}</label>
                                    <select id="${opts.id}_motivo" class="cs-select text-xs w-full">${motivosOpts}</select>
                                </div>
                                <div>
                                    <label class="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider font-semibold">${esc(opts.labels.lblSucursal)}</label>
                                    <select id="${opts.id}_sucursal" class="cs-select text-xs w-full">${sucursalesOpts}</select>
                                </div>
                                <div>
                                    <label class="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider font-semibold">${esc(opts.labels.lblFecha)}</label>
                                    <input id="${opts.id}_fecha" type="date" value="${esc(state.fecha)}" class="cs-input text-xs w-full">
                                </div>
                                <div>
                                    <label class="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider font-semibold">${esc(opts.labels.lblNota)}</label>
                                    <input id="${opts.id}_nota" type="text" placeholder="Detalle adicional..." class="cs-input text-xs w-full">
                                </div>
                            </div>
                        </div>

                        <div class="flex flex-1 min-h-0">

                            <div class="w-[280px] border-r border-gray-800/70 flex flex-col flex-shrink-0 p-3 gap-3 overflow-y-auto cs-scroll">
                                <div>
                                    <p class="text-[11px] font-bold uppercase tracking-wider text-gray-300 mb-2">${esc(opts.labels.lblBuscar)}</p>
                                    <div class="relative">
                                        <span class="cs-input-group-icon"><i data-lucide="search" class="w-4 h-4"></i></span>
                                        <input id="${opts.id}_buscar" type="text" placeholder="${esc(opts.labels.phBuscar)}" class="cs-input pl-10 text-xs w-full" autocomplete="off">
                                    </div>
                                    <div id="${opts.id}_resultados" class="mt-1.5 hidden" style="background:#0f1825;border:1px solid rgba(75,85,99,0.5);border-radius:10px;box-shadow:0 12px 28px -8px rgba(0,0,0,0.5);overflow:hidden;max-height:240px;overflow-y:auto;"></div>
                                </div>

                                <div>
                                    <p class="text-[11px] font-bold uppercase tracking-wider text-gray-300 mb-2">${esc(opts.labels.lblFoto)}</p>
                                    <input type="file" id="${opts.id}_photoInput" accept="image/*" capture="environment" class="hidden">
                                    <div id="${opts.id}_photoDrop" class="border-2 border-dashed border-[#374151] rounded-lg p-3 text-center hover:border-red-500/50 cursor-pointer transition-colors">
                                        <i data-lucide="camera" class="w-5 h-5 text-gray-600 mx-auto mb-1"></i>
                                        <p class="text-[10px] text-[#6B7280]">${esc(opts.labels.fotoHint)}</p>
                                        <p class="text-[9px] text-[#4B5563] mt-0.5">${esc(opts.labels.fotoExts)}</p>
                                    </div>
                                    <div id="${opts.id}_photoPreview" class="hidden relative rounded-lg overflow-hidden border border-[#374151] bg-[#0f172a]">
                                        <img id="${opts.id}_photoImg" alt="Evidencia" class="w-full h-24 object-cover">
                                        <div class="absolute inset-x-0 bottom-0 px-2 py-1 flex items-center justify-between" style="background:linear-gradient(to top,rgba(0,0,0,0.8),transparent);">
                                            <span id="${opts.id}_photoName" class="text-[9px] text-white truncate max-w-[160px]"></span>
                                            <button type="button" id="${opts.id}_photoRemove" class="text-white/80 hover:text-white px-1 py-0.5 rounded bg-red-500/40 hover:bg-red-500/60" title="Eliminar">
                                                <i data-lucide="trash-2" class="w-3 h-3"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div class="border-t border-gray-800/70 pt-3 mt-auto">
                                    <p class="text-[9px] uppercase text-gray-500 tracking-wider font-bold mb-2">${esc(opts.labels.lblResumen)}</p>
                                    <div class="space-y-1.5">
                                        <div class="flex justify-between items-center text-[11px]"><span class="text-gray-500 flex items-center gap-1.5"><i data-lucide="package" class="w-3 h-3"></i>${esc(opts.labels.lblItems)}</span><span class="text-white font-bold" id="${opts.id}_qtyItems">0</span></div>
                                        <div class="flex justify-between items-center text-[11px]"><span class="text-gray-500 flex items-center gap-1.5"><i data-lucide="layers" class="w-3 h-3"></i>${esc(opts.labels.lblUnidades)}</span><span class="text-white font-bold" id="${opts.id}_qtyUnits">0</span></div>
                                        <div class="flex justify-between items-center text-xs pt-2 mt-1 border-t border-gray-800/50"><span class="text-gray-300 font-medium">${esc(opts.labels.lblPerdida)}</span><span class="text-red-400 font-bold text-sm" id="${opts.id}_qtyCosto">-$0.00</span></div>
                                    </div>
                                </div>
                            </div>

                            <div class="flex-1 flex flex-col min-w-0 min-h-0">
                                <div class="px-4 py-2.5 border-b border-gray-800/70 flex items-center justify-between flex-shrink-0" style="background:linear-gradient(180deg,rgba(15,24,37,0.6),transparent);">
                                    <div class="flex items-center gap-2">
                                        <div class="w-6 h-6 rounded-md bg-red-500/15 border border-red-500/25 flex items-center justify-center"><i data-lucide="boxes" class="w-3.5 h-3.5 text-red-400"></i></div>
                                        <p class="text-[11px] font-bold uppercase tracking-wider text-gray-300">${esc(opts.labels.lblLista)}</p>
                                        <span id="${opts.id}_cntItems" class="cs-badge font-bold" style="background:linear-gradient(135deg,rgba(239,68,68,0.22),rgba(220,38,38,0.18));color:#fca5a5;border:1px solid rgba(239,68,68,0.4);padding:1px 6px;font-size:8px;border-radius:6px;">0</span>
                                    </div>
                                    <button id="${opts.id}_btnLimpiar" class="text-[10px] text-gray-500 hover:text-red-400 transition flex items-center gap-1 hidden px-2 py-1 rounded-md hover:bg-red-500/10"><i data-lucide="trash-2" class="w-3 h-3"></i>${esc(opts.labels.btnLimpiar)}</button>
                                </div>
                                <div id="${opts.id}_lista" class="flex-1 overflow-y-auto px-3 py-3 space-y-2 cs-scroll"></div>
                            </div>
                        </div>
                    </div>

                    <div class="cs-modal-footer" style="display:flex;align-items:center;justify-content:space-between;padding:10px 18px;border-top:1px solid rgba(55,65,81,0.6);background:#141d2b;flex-shrink:0;">
                        <div class="text-[10px] text-gray-500 flex items-center gap-1.5"><i data-lucide="info" class="w-3 h-3"></i><span>${esc(opts.labels.footNote)}</span></div>
                        <div class="flex gap-2">
                            <button class="cs-btn cs-btn-outline cs-btn-sm" data-modal-close>${esc(opts.labels.btnCancelar)}</button>
                            <button id="${opts.id}_btnSubmit" class="cs-btn cs-btn-danger cs-btn-sm flex items-center gap-1.5">
                                <i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i>
                                <span>${esc(opts.labels.btnRegistrar)}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        $('body').append(modal);
        if (window.lucide) lucide.createIcons();

        const renderEmpty = () => `
            <div class="flex flex-col items-center justify-center py-16 text-center">
                <div class="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center mb-2">
                    <i data-lucide="package-open" class="w-6 h-6 text-red-400/60"></i>
                </div>
                <p class="text-[11px] font-medium text-gray-400">${esc(opts.labels.emptyLista)}</p>
                <p class="text-[10px] text-gray-600 mt-1">${esc(opts.labels.emptyHint)}</p>
            </div>
        `;

        const renderItem = (it, idx) => `
            <div class="rounded-lg border border-gray-700/60 px-3 py-2" style="background:linear-gradient(180deg,#1a2332,#161e2c);" data-item-idx="${idx}">
                <div class="flex items-start justify-between gap-2">
                    <div class="flex-1 min-w-0">
                        <p class="text-[12px] font-semibold text-white truncate">${esc(it.name)}</p>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="px-1.5 py-0.5 rounded text-[9px] font-bold border border-gray-700 text-gray-300 bg-[#0f1825]">${esc(it.sku)}</span>
                            <span class="text-[10px] text-gray-500">${fmt(it.costo_unit)} c/u</span>
                        </div>
                    </div>
                    <button type="button" data-act="remove" class="text-gray-500 hover:text-red-400 transition p-1" title="Quitar">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
                <div class="flex items-center justify-between gap-2 mt-2">
                    <div class="flex items-center gap-1">
                        <button type="button" data-act="dec" class="w-6 h-6 rounded bg-[#0f1825] border border-gray-700 hover:border-red-500/50 text-gray-300 flex items-center justify-center text-xs">−</button>
                        <input type="number" min="1" value="${it.qty}" data-act="qty" class="cs-input text-xs text-center" style="width:50px;padding:3px 4px !important;font-size:11px !important;">
                        <button type="button" data-act="inc" class="w-6 h-6 rounded bg-[#0f1825] border border-gray-700 hover:border-red-500/50 text-gray-300 flex items-center justify-center text-xs">+</button>
                    </div>
                    <span class="text-[12px] font-bold text-red-400">-${fmt(it.qty * it.costo_unit)}</span>
                </div>
            </div>
        `;

        const recalc = () => {
            const totUds   = state.items.reduce((s, it) => s + (parseInt(it.qty, 10) || 0), 0);
            const totCosto = state.items.reduce((s, it) => s + ((parseInt(it.qty, 10) || 0) * (parseFloat(it.costo_unit) || 0)), 0);
            $(`#${opts.id}_qtyItems`).text(state.items.length);
            $(`#${opts.id}_qtyUnits`).text(totUds);
            $(`#${opts.id}_qtyCosto`).text('-' + fmt(totCosto));
            $(`#${opts.id}_cntItems`).text(state.items.length);
            if (state.items.length > 0) $(`#${opts.id}_btnLimpiar`).removeClass('hidden');
            else                        $(`#${opts.id}_btnLimpiar`).addClass('hidden');
        };

        const renderLista = () => {
            const $lista = $(`#${opts.id}_lista`);
            if (state.items.length === 0) {
                $lista.html(renderEmpty());
            } else {
                $lista.html(state.items.map((it, i) => renderItem(it, i)).join(''));
            }
            if (window.lucide) lucide.createIcons();
            recalc();
        };

        const addItem = (p) => {
            const exists = state.items.findIndex(it => it.id === p.id);
            if (exists >= 0) {
                state.items[exists].qty = (parseInt(state.items[exists].qty, 10) || 0) + 1;
            } else {
                state.items.push({ id: p.id, name: p.name, sku: p.sku, costo_unit: p.costo_unit, qty: 1 });
            }
            renderLista();
        };

        const renderResultados = (term) => {
            const $box = $(`#${opts.id}_resultados`);
            if (!term || term.length < 1) { $box.addClass('hidden').empty(); return; }
            const q = term.toLowerCase();
            const matches = opts.productCatalog.filter(p =>
                p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
            ).slice(0, 8);

            if (matches.length === 0) {
                $box.removeClass('hidden').html(`<div class="px-3 py-3 text-center text-[10px] text-gray-500 italic">Sin resultados</div>`);
                return;
            }

            const html = matches.map(p => `
                <div class="px-3 py-2 cursor-pointer transition" data-pid="${p.id}" style="border-bottom:1px solid rgba(55,65,81,0.4);">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex-1 min-w-0">
                            <p class="text-[11px] font-semibold text-white truncate">${esc(p.name)}</p>
                            <div class="flex items-center gap-2 mt-0.5">
                                <span class="px-1.5 py-0.5 rounded text-[8px] font-bold border border-gray-700 text-gray-300 bg-[#0f1825]">${esc(p.sku)}</span>
                                <span class="text-[9px] text-gray-500">Stock: ${p.stock}</span>
                            </div>
                        </div>
                        <span class="text-[10px] font-bold text-gray-300">${fmt(p.costo_unit)}</span>
                    </div>
                </div>
            `).join('');
            $box.removeClass('hidden').html(html);
        };

        const $modal      = $(`#${opts.id}`);
        const $buscar     = $(`#${opts.id}_buscar`);
        const $resultados = $(`#${opts.id}_resultados`);
        const $lista      = $(`#${opts.id}_lista`);
        const $photoDrop  = $(`#${opts.id}_photoDrop`);
        const $photoInp   = $(`#${opts.id}_photoInput`);
        const $photoPrev  = $(`#${opts.id}_photoPreview`);

        renderLista();

        const closeModal = () => { $modal.remove(); opts.onCancel(); };

        $modal.on('click', '[data-modal-close]', closeModal);

        $buscar.on('input', (e) => renderResultados($(e.currentTarget).val().trim()));
        $buscar.on('blur',  () => setTimeout(() => $resultados.addClass('hidden'), 150));
        $buscar.on('focus', (e) => { const v = $(e.currentTarget).val().trim(); if (v) renderResultados(v); });

        $resultados.on('mousedown', '[data-pid]', (e) => {
            const pid = parseInt($(e.currentTarget).attr('data-pid'), 10);
            const p   = opts.productCatalog.find(x => x.id === pid);
            if (p) { addItem(p); $buscar.val('').focus(); $resultados.addClass('hidden'); }
        });

        $lista.on('click', '[data-act="inc"]', (e) => {
            const idx = parseInt($(e.currentTarget).closest('[data-item-idx]').attr('data-item-idx'), 10);
            state.items[idx].qty = (parseInt(state.items[idx].qty, 10) || 0) + 1;
            renderLista();
        });
        $lista.on('click', '[data-act="dec"]', (e) => {
            const idx = parseInt($(e.currentTarget).closest('[data-item-idx]').attr('data-item-idx'), 10);
            const v   = (parseInt(state.items[idx].qty, 10) || 0) - 1;
            if (v <= 0) state.items.splice(idx, 1);
            else        state.items[idx].qty = v;
            renderLista();
        });
        $lista.on('change', '[data-act="qty"]', (e) => {
            const idx = parseInt($(e.currentTarget).closest('[data-item-idx]').attr('data-item-idx'), 10);
            const v   = parseInt($(e.currentTarget).val(), 10);
            if (!v || v <= 0) state.items.splice(idx, 1);
            else              state.items[idx].qty = v;
            renderLista();
        });
        $lista.on('click', '[data-act="remove"]', (e) => {
            const idx = parseInt($(e.currentTarget).closest('[data-item-idx]').attr('data-item-idx'), 10);
            state.items.splice(idx, 1);
            renderLista();
        });

        $(`#${opts.id}_btnLimpiar`).on('click', () => { state.items = []; renderLista(); });

        $photoDrop.on('click', () => $photoInp.trigger('click'));
        $photoInp.on('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                state.photo = { name: file.name, dataUrl: ev.target.result };
                $(`#${opts.id}_photoImg`).attr('src', ev.target.result);
                $(`#${opts.id}_photoName`).text(file.name);
                $photoDrop.addClass('hidden');
                $photoPrev.removeClass('hidden');
            };
            reader.readAsDataURL(file);
        });
        $(`#${opts.id}_photoRemove`).on('click', () => {
            state.photo = null;
            $photoInp.val('');
            $photoPrev.addClass('hidden');
            $photoDrop.removeClass('hidden');
        });

        $(`#${opts.id}_motivo`).on('change',   (e) => { state.motivo   = $(e.currentTarget).val(); });
        $(`#${opts.id}_sucursal`).on('change', (e) => { state.sucursal = $(e.currentTarget).val(); });
        $(`#${opts.id}_fecha`).on('change',    (e) => { state.fecha    = $(e.currentTarget).val(); });
        $(`#${opts.id}_nota`).on('input',      (e) => { state.nota     = $(e.currentTarget).val(); });

        $(`#${opts.id}_btnSubmit`).on('click', () => {
            if (state.items.length === 0) {
                alert({ icon: 'warning', text: 'Agrega al menos un producto' });
                return;
            }
            const totUds   = state.items.reduce((s, it) => s + (parseInt(it.qty, 10) || 0), 0);
            const totCosto = state.items.reduce((s, it) => s + ((parseInt(it.qty, 10) || 0) * (parseFloat(it.costo_unit) || 0)), 0);

            const payload = {
                motivo:         state.motivo,
                sucursal:       state.sucursal,
                fecha:          state.fecha,
                nota:           state.nota,
                items:          state.items.map(it => ({
                    id:          it.id,
                    name:        it.name,
                    sku:         it.sku,
                    qty:         parseInt(it.qty, 10),
                    costo_unit:  parseFloat(it.costo_unit),
                    costo_total: parseInt(it.qty, 10) * parseFloat(it.costo_unit)
                })),
                total_unidades: totUds,
                total_costo:    totCosto,
                photo:          state.photo
            };

            $modal.remove();
            opts.onSubmit(payload);
        });
    }
}
