let apiFacture = '/app/facture/ctrl/ctrl-facture.php';
let app, modulos, modulosView;

const VIEW_HEADER_FACTURADOR = {
    title:    'Facturador SAT',
    subtitle: 'Control de tickets del restaurante. Cada modulo es una etapa del proceso fiscal'
};

$(async () => {
    modulosView = new ModulosView(apiFacture, 'root');
    modulos     = new Modulos(apiFacture, 'root');
    app         = new App(apiFacture, 'root');
    await app.init();
});

// -- Clase principal --

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'facturadorMain';
    }

    async init() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiFacture, data:{ opc:'init' } })
        this.dataInit = {
            periodos: SAMPLE_MODULOS_PERIODOS,
            dia:      '2026-06-10'
        };

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        modulosView.renderHeader();
        modulosView.renderFooter(SAMPLE_MODULOS_FOOTER);
        modulos.lsModulos();
    }

    // -- Layout --

    layout() {
        this.primaryLayout({
            parent: 'root',
            id:     this.PROJECT_NAME,
            class:  'w-full',
            card: {
                filterBar: { class: 'w-full', id: `filterBar${this.PROJECT_NAME}` },
                // Sin h-full: el card crece con su contenido (grid de modulos).
                // El scroll vertical lo da #main__content del shell, no este card.
                container: { class: 'w-full', id: `container${this.PROJECT_NAME}` }
            }
        });

        this.createLayout({
            parent: `container${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `wrap${this.PROJECT_NAME}`,
                class: 'w-full flex flex-col gap-4',
                container: [
                    {
                        type:  'div',
                        id:    'viewHeader',
                        class: 'w-full flex items-center justify-between'
                    },
                    {
                        type:  'div',
                        id:    'cardsRow',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'viewFooter',
                        class: 'w-full flex items-center justify-between border-t border-gray-200 pt-3'
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
                class:    'col-12 col-md-4 col-lg-3',
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
                class:    'col-12 col-md-4 col-lg-3',
                value:    this.dataInit.dia,
                required: false,
                onchange: 'app.onChangeFilters()'
            },
            {
                opc:       'button',
                id:        'btnAbrirResumen',
                text:      'Abrir resumen del dia',
                color_btn: 'invernal',
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
            periodo: $('#fPeriodo').val() || '',
            dia:     $('#fDia').val()     || this.dataInit.dia
        };
    }

    // -- Event handlers --

    onChangeFilters() {
        modulosView.renderHeader();
    }
}

// -- Modulos --

class Modulos extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'facturadorMain';
    }

    // -- Data --

    lsModulos() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiFacture, data:{ opc:'lsModulos' } })
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
        this.PROJECT_NAME = 'facturadorMain';
        this.cardsApi     = null;
    }

    // -- Render helpers --

    renderHeader() {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const f       = app.getFilters();
        const periodo = (SAMPLE_MODULOS_PERIODOS.find(p => p.id === f.periodo) || {}).valor || f.periodo;

        this.viewHeader({
            parent: 'viewHeader',
            id:     `hdr${this.PROJECT_NAME}`,
            json: Object.assign({}, VIEW_HEADER_FACTURADOR, {
                titleHtml: `${VIEW_HEADER_FACTURADOR.title} <span class="font-bold" style="color:#C05A40;">&middot; ${esc(periodo)}</span>`
            })
        });
    }

    renderCards(cards) {
        const items = cards.map(c => Object.assign({}, c, {
            footer:  'Abrir modulo',
            onClick: () => modulos.openModulo(this.moduloIdOf(c))
        }));

        if (this.cardsApi) {
            this.cardsApi.setCards(items);
            return;
        }

        this.cardsApi = new ModuleCard('#cardsRow', {
            header: {
                show:     true,
                title:    'Modulos del Facturador',
                subtitle: 'Cada etapa del proceso fiscal es un modulo independiente. Elige por donde empezar.',
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
            font:  'sans',
            cards: items
        }).init();
    }

    moduloIdOf(card) {
        const found = Object.values(SAMPLE_MODULOS_DB).find(m => m.enlace === card.enlace);
        return found ? found.id : '';
    }

    renderFooter(data) {
        this.viewFooter({
            parent: 'viewFooter',
            id:     `ftr${this.PROJECT_NAME}`,
            json:   data
        });
    }

    // -- Components --

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
                btnActive:'demo-toggle active px-2.5 py-1 rounded text-[11px] border border-blue-400 bg-blue-50 text-blue-700',
                sep:      'text-gray-300',
                backBtn:  'w-8 h-8 rounded-full bg-gray-100 hover:bg-blue-50 border border-gray-200 hover:border-blue-400 flex items-center justify-center text-gray-500 hover:text-blue-700 transition-colors flex-shrink-0'
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
                const isActive = $(this).attr('data-toggle-value') === val;
                this.className = isActive ? opts.classes.btnActive : opts.classes.btn;
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
                info:    'var(--cs-info,#C05A40)',
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
