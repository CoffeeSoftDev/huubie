let api = 'ctrl/ctrl-facturador.php';
let app, modulos, modulosView;

let turno, subsidiaries_id;

window.updateSession = () => { };


$(async () => {
    modulosView = new ModulosView(api, 'root');
    modulos     = new Modulos(api, 'root');
    app         = new App(api, 'root');
    await app.init();
});

// -- Clase principal --

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Facturador';
        this.subId        = null;
    }

    async init() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:{ opc:'init' } })
        this.dataInit = {
            subsidiaries_id: '',
            periodos:        SAMPLE_MODULOS_PERIODOS,
            topbar:          SAMPLE_MODULOS_TOPBAR,
            dia:             '2026-06-10'
        };
        this.subId      = this.dataInit.subsidiaries_id;
        subsidiaries_id = this.subId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        modulosView.renderTopBar(this.dataInit.topbar);
        modulosView.renderFooter(SAMPLE_MODULOS_FOOTER);
        modulos.lsModulos();
    }

    // -- Layout --

    layout() {
        this.primaryLayout({
            parent: 'root',
            id:     this.PROJECT_NAME,
            class:  'flex mx-2 ',
            heightPreset: 'full',
            card: {
                filterBar: { class: 'w-full ', id: 'filterBar' },
                container: { class: 'w-full my-2 h-screen rounded p-3 overflow-auto', id: 'container' + this.PROJECT_NAME }
            }
        });

        $('#filterBar').html(`
            <div id="filterBar${this.PROJECT_NAME}" class="w-full my-3 " ></div>
            <div id="containerHours"></div>
        `);

        this.createLayout({
            parent: `container${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:        `wrap${this.PROJECT_NAME}`,
                class:     'w-full flex flex-col gap-4',
                container: [
                    {
                        type:  'div',
                        id:    `topBar${this.PROJECT_NAME}`,
                        class: 'w-full card-base px-4 py-3'
                    },
                    {
                        type:  'div',
                        id:    `cards${this.PROJECT_NAME}`,
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    `viewFooter${this.PROJECT_NAME}`,
                        class: 'w-full flex items-center justify-between border-t border-ink-200 pt-3'
                    }
                ]
            }
        });
    }

    // -- Filter bar --

    filterBar() {
        const filters = [
            {
                opc:      'select',
                id:       'fPeriodo',
                lbl:      'Periodo:',
                class:    'col-12 col-md-4 col-lg-2',
                value:    '2026-06',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.periodos
            },
            {
                opc:      'input',
                id:       'fDia',
                lbl:      'Dia:',
                type:     'date',
                class:    'col-12 col-md-4 col-lg-2',
                value:    this.dataInit.dia,
                required: false,
                onchange: 'app.onChangeFilters()'
            },
            {
                opc:       'button',
                id:        'btnAbrirResumen',
                text:      'Abrir resumen del dia',
                icon:      'icon-chart-bar',
                color_btn: 'primary',
                className: 'btn-primary',
                class:     'col-12 col-md-4 col-lg-3',
                onClick:   () => modulos.openModulo('resumen')
            }
        ];

        this.createfilterBar({
            parent:     `filterBar${this.PROJECT_NAME}`,
            id:         `frmFilter${this.PROJECT_NAME}`,
            coffeesoft: true,
            theme:      'light',
            data:       filters
        });
    }

    getFilters() {
        return {
            subsidiaries_id: this.subId || '',
            periodo:         $('#fPeriodo').val() || '',
            dia:             $('#fDia').val()     || this.dataInit.dia
        };
    }

    // -- Event handlers --

    onChangeFilters() {
        modulosView.renderTopBar(this.dataInit.topbar);
    }
}

// -- Modulos --

class Modulos extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Facturador';
    }

    // -- Data --

    lsModulos() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:{ opc:'lsModulos' } })
        modulosView.renderCards(SAMPLE_MODULOS_CARDS);
    }

    // -- Actions --

    openModulo(id) {
        const m = SAMPLE_MODULOS_DB[id];
        if (!m) return;
        const f = app.getFilters();
        window.location.href = `${m.enlace}?dia=${encodeURIComponent(f.dia)}`;
    }
}

// -- Vista --

class ModulosView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Facturador';
        this.cardsApi     = null;
    }

    // -- Render helpers --

    renderTopBar(data) {
        const f       = app.getFilters();
        const periodo = SAMPLE_MODULOS_PERIODOS.find(p => p.id === f.periodo);
        this.topBar({
            parent: `topBar${this.PROJECT_NAME}`,
            id:     `bar${this.PROJECT_NAME}`,
            json:   Object.assign({}, data, { periodo: periodo ? periodo.valor : f.periodo, dia: f.dia })
        });
    }

    renderCards(cards) {
        if (!this.cardsApi) {
            this.cardsApi = new ModuleCard(`#cards${this.PROJECT_NAME}`, {
                header: {
                    show:     true,
                    title:    'Modulos del Facturador',
                    subtitle: 'Cada tab del boceto es un modulo independiente. Elige por donde empezar.',
                    search: {
                        show:        true,
                        placeholder: 'Buscar modulo...',
                        shortcut:    'Ctrl+K',
                        width:       'w-full md:w-[320px]'
                    }
                },
                grid: {
                    cols:   'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
                    gap:    'gap-x-3 gap-y-4',
                    height: 'h-[190px]'
                },
                colors: {
                    titleC:    '#111928',
                    subC:      '#6B7280',
                    cardBg:    '#FFFFFF',
                    cardHover: '#FBF1ED',
                    iconBg:    '#C05A40',
                    inputBg:   '#FFFFFF',
                    inputBd:   '#E5E7EB',
                    kbdBg:     '#F3F4F6',
                    kbdC:      '#6B7280'
                },
                font:  'sans',
                cards: cards
            }).init();
            return;
        }

        this.cardsApi.setCards(cards);
    }

    renderFooter(data) {
        this.viewFooter({
            parent:  `viewFooter${this.PROJECT_NAME}`,
            id:      `ftr${this.PROJECT_NAME}`,
            classes: SAMPLE_MODULOS_FOOTER_CLASSES,
            tones:   SAMPLE_MODULOS_FOOTER_TONES,
            json:    data
        });
    }

    // -- Components --

    topBar(options) {
        const defaults = {
            parent: 'root',
            id:     'topBar',
            class:  'flex items-center gap-3 flex-wrap w-full',
            json:   { icon: 'receipt-text', titulo: '', subtitulo: '', periodo: '', dia: '', usuario: {} }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json  = Object.assign({}, defaults.json, o.json || {});
        opts.json.usuario = Object.assign({}, defaults.json.usuario, (o.json || {}).usuario || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const u = opts.json.usuario;

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html(`
            <div class="flex items-center gap-2.5 shrink-0">
                <div class="w-9 h-9 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center">
                    <i data-lucide="${esc(opts.json.icon)}" class="w-5 h-5"></i>
                </div>
                <div>
                    <h1 class="text-sm font-bold text-ink-900 leading-tight">${esc(opts.json.titulo)}</h1>
                    <p class="text-[10px] text-ink-500 leading-tight">${esc(opts.json.subtitulo)}</p>
                </div>
            </div>
            <div class="flex-1"></div>
            <div class="hidden md:flex items-center gap-2 bg-ink-50 rounded-lg px-3 py-1.5 border border-ink-200">
                <i data-lucide="calendar-days" class="w-4 h-4 text-ink-400"></i>
                <span class="text-xs font-semibold text-ink-700">${esc(opts.json.periodo)}</span>
                <span class="w-px h-4 bg-ink-300"></span>
                <span class="text-xs font-semibold text-ink-700">${esc(opts.json.dia)}</span>
            </div>
            <div class="flex items-center gap-2 pl-3 border-l border-ink-200">
                <div class="w-8 h-8 rounded-full bg-brand-500 text-white text-[11px] font-bold flex items-center justify-center">${esc(u.iniciales)}</div>
                <div class="hidden sm:block">
                    <p class="text-[11px] font-semibold text-ink-800 leading-tight">${esc(u.nombre)}</p>
                    <p class="text-[10px] text-ink-400 leading-tight">${esc(u.sucursal)}</p>
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

        const toneColor  = (tone) => opts.tones[tone] || opts.tones.default;
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
}
