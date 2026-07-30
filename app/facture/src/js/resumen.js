let apiResumen = '/app/facture/ctrl/ctrl-facture-resumen.php';
let app, resumen, resumenView;

// Copy del modulo. No son datos: ventas, montos y avance se consultan al servidor.
const VIEW_HEADER_RESUMEN = {
    title:    'Resumen del dia',
    subtitle: 'Avance de la meta de facturacion del dia: cuanto se vendio, cuanto se facturo y cuanto falta',
    back:     { href: '/app/facture/index.php', title: 'Regresar al Facturador' }
};

const VIEW_FOOTER_RESUMEN = {
    info: '',
    legends: [
        { tone: 'success', label: 'Facturado'    },
        { tone: 'warning', label: 'Por facturar' },
        { tone: 'purple',  label: 'Efectivo'     },
        { tone: 'info',    label: 'Banco'        }
    ]
};

// El unico formato que se arma en el cliente: la suma de lo que se va marcando.
// El resto de los montos llegan ya escritos del servidor.
const pesos = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const fechaLarga = (iso) => {
    const parts = String(iso || '').split('-');
    if (parts.length !== 3) return iso || '';
    return `${parseInt(parts[2], 10)} de ${MESES_ES[parseInt(parts[1], 10) - 1]} de ${parts[0]}`;
};

// useFetch del framework resuelve por callback; aqui el modulo encadena con
// await, asi que las llamadas pasan por este helper.
const fnAjax = (data, url) => fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams(data)
}).then(r => r.json());

$(async () => {
    resumenView = new ResumenView(apiResumen, 'root');
    resumen     = new Resumen(apiResumen, 'root');
    app         = new App(apiResumen, 'root');
    await app.init();
});

// -- Clase principal --

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'resumen';
        this.seleccion    = [];
    }

    // El dia lo resuelve el servidor con el ultimo que tiene ventas cargadas; con
    // ?dia= entra a ese si existe. Nada se preselecciona: marcar los tickets que se
    // van a facturar es la decision del cierre.
    async init() {
        this.dataInit = await fnAjax({ opc: 'init', dia: this.getDiaFromUrl() }, apiResumen);

        this.render();
    }

    getDiaFromUrl() {
        return new URLSearchParams(window.location.search).get('dia') || '';
    }

    render() {
        this.layout();
        this.filterBar();
        resumenView.renderFooter(VIEW_FOOTER_RESUMEN);
        resumenView.renderPanelHeads();
        this.updateHeaderTitle();
        resumen.lsKpis();
        resumen.lsTodos();
        resumen.lsPendientes();
        resumen.lsFacturados();
    }

    // -- Layout --

    layout() {
        const mainPanel = {
            type:  'div',
            id:    'mainPanel',
            class: 'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                {
                    id:    'viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    class: 'px-3 pt-3 bg-[#0E1521] flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 pt-1 pb-4 bg-[#0E1521] flex-shrink-0'
                },
                {
                    id:    'progressRow',
                    class: 'px-4 py-3 bg-[#141d2b] flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto'
                },
                {
                    id:    'viewFooterRow',
                    class: 'flex items-center justify-between px-4 py-2 bg-[#0E1521] flex-shrink-0'
                }
            ]
        };

        // createLayout solo itera children en type 'div': para un aside caen en el
        // default y jQuery los toma como metodo. Las zonas del panel se arman aparte.
        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'w-full md:w-[420px] flex-shrink-0 bg-[#141d2b] border-t md:border-t-0 md:border-l border-[#374151] flex flex-col overflow-hidden'
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden',
                container: [mainPanel, detailPanel]
            }
        });

        this.createLayout({
            parent: 'detailPanel',
            design: false,
            data: {
                id:        'detailInner',
                class:     'flex-1 min-h-0 flex flex-col overflow-hidden',
                container: [
                    {
                        type:  'div',
                        id:    'detailHead',
                        class: 'px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex items-center justify-between flex-shrink-0'
                    },
                    {
                        type:  'div',
                        id:    'detailContent',
                        class: 'flex-1 min-h-0 overflow-auto scroll-thin px-3 py-2'
                    },
                    {
                        type:  'div',
                        id:    'detailFoot',
                        class: 'px-4 py-3 bg-[#0E1521] flex-shrink-0'
                    }
                ]
            }
        });

        this.panelsLayout();
    }

    // Dos tarjetas dentro del area scrolleable: acumulado del dia y facturados.
    // El panel de pendientes vive en el aside porque es la zona de trabajo.
    panelsLayout() {
        const panel = (key, maxH) => ({
            type:  'div',
            id:    `card${key}`,
            class: 'bg-[#1F2A37] rounded-lg overflow-hidden flex flex-col',
            children: [
                {
                    id:    `head${key}`,
                    class: 'px-4 py-3 flex items-center justify-between'
                },
                {
                    id:    `table${key}`,
                    class: `overflow-auto scroll-thin ${maxH}`
                },
                {
                    id:    `foot${key}`,
                    class: 'px-4 py-3 mt-auto'
                }
            ]
        });

        this.createLayout({
            parent: 'tableWrap',
            design: false,
            data: {
                id:        'panelsGrid',
                class:     'w-full grid grid-cols-1 xl:grid-cols-2 gap-4',
                container: [
                    panel('Todos',      'max-h-80'),
                    panel('Facturados', 'max-h-80')
                ]
            }
        });
    }

    // -- Filter bar --

    filterBar() {
        const filters = [
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
                opc:      'select',
                id:       'fMeta',
                lbl:      'Meta de facturacion:',
                class:    'col-12 col-md-4 col-lg-3',
                value:    '0.70',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.metas
            },
            {
                opc:       'button',
                id:        'btnRecalcular',
                text:      'Recalcular',
                color_btn: 'secondary',
                class:     'col-12 col-md-4 col-lg-3',
                onClick:   () => this.recalcular()
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      FACTURE_THEME,
            data:       filters
        });
    }

    getFilters() {
        return {
            dia:  $('#fDia').val() || this.dataInit.dia,
            meta: parseFloat($('#fMeta').val() || '0.70')
        };
    }

    // -- Event handlers --

    // Cambiar de dia vacia la seleccion: los folios marcados eran de otro dia.
    onChangeFilters() {
        this.seleccion = [];

        this.updateHeaderTitle();
        resumen.lsKpis();
        resumen.lsTodos();
        resumen.lsPendientes();
        resumen.lsFacturados();
    }

    onTogglePendiente(input) {
        const id = $(input).attr('data-id');
        if (input.checked) {
            if (this.seleccion.indexOf(id) === -1) this.seleccion.push(id);
        } else {
            this.seleccion = this.seleccion.filter(x => x !== id);
        }
        resumen.refreshTotales();
    }

    recalcular() {
        resumen.lsKpis();
        this.alertBox({ type: 'success', title: 'Indicadores recalculados', timer: 1600 });
    }

    updateHeaderTitle() {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const f         = this.getFilters();
        const titleHtml = `${VIEW_HEADER_RESUMEN.title} <span class="font-bold" style="color:#1C64F2;">&middot; ${esc(fechaLarga(f.dia))}</span>`;

        resumenView.renderHeader(Object.assign({}, VIEW_HEADER_RESUMEN, { titleHtml }));
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    // -- Facade --

    getSeleccion() {
        return this.seleccion.slice();
    }
}

// -- Resumen --

class Resumen extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'resumen';
    }

    // -- Data --

    async lsTodos() {
        const data = await fnAjax(Object.assign({ opc: 'lsTodos' }, app.getFilters()), apiResumen);

        this.createCoffeeTable3({
            parent:       'tableTodos',
            id:           'tbTodos',
            theme:        FACTURE_THEME,
            center:       [2],
            right:        [4],
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'Sin pagos registrados en el dia seleccionado',
            emptyIcon:    'ic-file-text',
            data:         data
        });

        const filas = (data.row || []).length;
        app.updateFooterInfo(`Mostrando ${filas} ticket${filas !== 1 ? 's' : ''} del dia`);
    }

    async lsPendientes() {
        const data = await fnAjax(Object.assign({ opc: 'lsPendientes' }, app.getFilters()), apiResumen);

        this.createCoffeeTable3({
            parent:       'detailContent',
            id:           'tbPendientes',
            theme:        FACTURE_THEME,
            center:       [1, 3],
            right:        [4],
            extends:      true,
            scrollable:   false,
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'No hay tickets por facturar cobrados por banco',
            emptyIcon:    'ic-clock',
            data:         data
        });

        // La seleccion vive en el cliente: al repintar la tabla los checks vuelven
        // vacios, asi que los totales del pie se recalculan con lo que quedo.
        this.refreshTotales();
    }

    async lsFacturados() {
        const data = await fnAjax(Object.assign({ opc: 'lsFacturados' }, app.getFilters()), apiResumen);

        this.createCoffeeTable3({
            parent:       'tableFacturados',
            id:           'tbFacturados',
            theme:        FACTURE_THEME,
            center:       [2, 3],
            right:        [4],
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'Aun no hay tickets facturados',
            emptyIcon:    'ic-lock',
            data:         data
        });
    }

    // Los montos del dia, el objetivo de la meta y el avance los calcula el
    // servidor sobre las ventas del dia; aqui solo se pintan y se guardan para que
    // el pie del panel los tenga a mano mientras se marcan tickets.
    async lsKpis() {
        const t = await fnAjax(Object.assign({ opc: 'showKpis' }, app.getFilters()), apiResumen);

        this.totales = t;

        resumenView.renderInfoCards([
            {
                id:          'kpiTotal',
                title:       'Venta total',
                lucideIcon:  'banknote',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value:    t.totalTexto,
                    subtitle: `${t.tickets} tickets · efectivo + banco`,
                    color:    'text-white'
                }
            },
            {
                id:          'kpiMeta',
                title:       `Meta al ${t.metaPct}%`,
                lucideIcon:  'target',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value:    t.objetivoTexto,
                    subtitle: 'monto objetivo del dia',
                    color:    'text-white'
                }
            },
            {
                id:          'kpiFacturado',
                title:       'Ya facturado',
                lucideIcon:  'lock',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value:    t.facturadoTexto,
                    subtitle: `${t.bloqueados} tickets bloqueados`,
                    color:    'text-green-600'
                }
            },
            {
                id:          'kpiPorFacturar',
                title:       'Por facturar',
                lucideIcon:  'alert-circle',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value:    t.porFacturarTexto,
                    subtitle: 'meta menos facturado',
                    color:    'text-[#1C64F2]'
                }
            }
        ]);

        this.refreshTotales();
    }

    // Lo unico que se suma en el cliente: el monto de los tickets marcados, que
    // cambia con cada clic y no vale una peticion. El resto viene de lsKpis.
    getSeleccionado() {
        let suma = 0;

        $(`#tbPendientes .chk-pending:checked`).each(function () {
            suma += Number($(this).attr('data-amount') || 0);
        });

        return suma;
    }

    refreshTotales() {
        const t = this.totales;
        if (!t) return;

        const sumaSel = this.getSeleccionado();

        resumenView.renderProgress({
            label:     'Avance de la meta de facturacion',
            percent:   t.avance,
            leftText:  `${t.facturadoTexto} facturado`,
            rightText: `objetivo ${t.objetivoTexto}`
        });

        resumenView.renderPanelFoots({
            total:     t.totalTexto,
            facturado: t.facturadoTexto,
            sumaSel:   pesos(sumaSel),
            restante:  pesos(Math.max(0, t.porFacturar - sumaSel))
        });
    }

    // -- Actions --

    sendToInvoice() {
        const seleccion = app.getSeleccion();
        if (!seleccion.length) {
            this.alertBox({ type: 'message', title: 'Selecciona al menos un ticket por facturar' });
            return;
        }

        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Enviar a facturar',
                text:              `Se enviaran ${seleccion.length} tickets al portal de facturacion.`,
                icon:              'question',
                confirmButtonText: 'Si, enviar',
                cancelButtonText:  'No'
            }
        }).then(async (result) => {
            if (!result.isConfirmed) return;

            const response = await fnAjax({
                opc: 'sendToInvoice',
                ids: JSON.stringify(seleccion)
            }, apiResumen);

            if (response.status === 200) {
                app.seleccion = [];

                this.lsKpis();
                this.lsTodos();
                this.lsPendientes();
                this.lsFacturados();
            }

            this.alertBox({
                type:  response.status === 200 ? 'success' : 'error',
                title: response.message,
                timer: response.status === 200 ? 1800 : 0
            });
        });
    }
}

// -- Vista --

class ResumenView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'resumen';
    }

    // -- Render helpers --

    renderHeader(data) {
        this.viewHeader({
            parent: 'viewHeader',
            id:     'hdrResumen',
            json:   data
        });
    }

    renderFooter(data) {
        this.viewFooter({
            parent: 'viewFooterRow',
            id:     'viewFooter',
            json:   data
        });
    }

    renderInfoCards(rows) {
        this.infoCard({
            parent: 'kpisRow',
            id:     'kpisResumen',
            theme:  FACTURE_THEME,
            style:  'file',
            cols:   4,
            json:   rows
        });
    }

    renderPanelHeads() {
        this.panelHead({
            parent: 'headTodos',
            json: {
                icon:  'sigma',
                title: 'Acumulado total real',
                badge: { text: 'todos los pagos', tone: 'b-gray' }
            }
        });

        this.panelHead({
            parent: 'headFacturados',
            json: {
                icon:      'lock',
                iconClass: 'w-4 h-4 text-green-600',
                title:     'Facturados',
                badge:     { text: 'bloqueados', tone: 'b-green' }
            }
        });

        this.panelHead({
            parent: 'detailHead',
            json: {
                icon:      'file-clock',
                iconClass: 'w-4 h-4 text-amber-500',
                title:     'Por facturar',
                badge:     { text: 'solo tarjeta', tone: 'b-yellow' }
            }
        });
    }

    renderPanelFoots(t) {
        this.panelFoot({
            parent: 'footTodos',
            json:   [{ label: 'Total del dia', value: t.total }]
        });

        this.panelFoot({
            parent: 'footFacturados',
            json:   [{ label: 'Monto facturado', value: t.facturado, valueClass: 'text-[11px] font-bold text-green-600' }]
        });

        this.panelFoot({
            parent: 'detailFoot',
            json: [
                { label: 'Suma seleccionada', value: t.sumaSel,  valueClass: 'text-[11px] font-bold text-[#1C64F2]' },
                { label: 'Objetivo restante', value: t.restante, labelClass: 'text-[10px] text-gray-400', valueClass: 'text-[10px] text-gray-400' }
            ],
            action: {
                id:      'btnEnviarFacturar',
                text:    'Enviar a facturar',
                icon:    'send',
                onClick: () => resumen.sendToInvoice()
            }
        });
    }

    renderProgress(data) {
        this.progressBar({
            parent: 'progressRow',
            id:     'progResumen',
            json:   data
        });
    }

    // -- Components --

    panelHead(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex items-center justify-between w-full',
            json:   { icon: '', iconClass: 'w-4 h-4 text-gray-400', title: '', badge: null },
            classes: {
                title: 'text-[12px] font-bold text-gray-300 flex items-center gap-2'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const iconHtml  = opts.json.icon ? `<i data-lucide="${esc(opts.json.icon)}" class="${opts.json.iconClass}"></i>` : '';
        const badge     = opts.json.badge;
        const badgeHtml = badge ? `<span class="badge-base ${esc(badge.tone || 'b-gray')}">${esc(badge.text)}</span>` : '';

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`
            <h3 class="${opts.classes.title}">${iconHtml}${esc(opts.json.title)}</h3>
            ${badgeHtml}
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }

    panelFoot(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex flex-col gap-1 w-full',
            json:   [],
            action: null,
            classes: {
                row:   'flex items-center justify-between w-full',
                label: 'text-[11px] font-semibold text-gray-400',
                value: 'text-[11px] font-semibold text-white',
                btn:   `${CF_CSS.btnPrimary} mt-2 flex items-center justify-center gap-2`
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const rowsHtml = (opts.json || []).map(r => `
            <div class="${opts.classes.row}">
                <span class="${r.labelClass || opts.classes.label}">${esc(r.label)}</span>
                <span class="${r.valueClass || opts.classes.value}">${esc(r.value)}</span>
            </div>
        `).join('');

        const a = opts.action;
        const actionHtml = a ? `
            <button type="button" id="${esc(a.id)}" class="${opts.classes.btn}">
                ${a.icon ? `<i data-lucide="${esc(a.icon)}" class="w-4 h-4"></i>` : ''}${esc(a.text)}
            </button>
        ` : '';

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(rowsHtml + actionHtml);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        if (a && typeof a.onClick === 'function') {
            $(`#${a.id}`).on('click', () => a.onClick());
        }
    }

    progressBar(options) {
        const defaults = {
            parent: 'root',
            id:     'progressBar',
            class:  'w-full',
            json:   { label: '', percent: 0, leftText: '', rightText: '' },
            classes: {
                label:   'text-[11px] font-semibold text-gray-300',
                percent: 'text-[11px] font-bold text-[#1C64F2]',
                caption: 'flex justify-between mt-2 text-[10px] text-gray-400'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const pct = Math.max(0, Math.min(100, Number(opts.json.percent || 0)));

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html(`
            <div class="flex items-center justify-between mb-2">
                <span class="${opts.classes.label}">${esc(opts.json.label)}</span>
                <span class="${opts.classes.percent}">${pct.toFixed(1)}%</span>
            </div>
            <div class="prog-track"><div class="prog-fill" style="width:${pct}%"></div></div>
            <div class="${opts.classes.caption}">
                <span>${esc(opts.json.leftText)}</span>
                <span>${esc(opts.json.rightText)}</span>
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
    }

    viewHeader(options) {
        const defaults = {
            parent: 'root',
            id:     'viewHeader',
            class:  'flex items-center justify-between w-full',
            json:   { title: '', titleHtml: '', subtitle: '', toggles: [], back: null },
            classes: {
                title:    'text-lg font-bold text-white',
                subtitle: 'text-xs text-gray-400',
                groupLbl: 'text-[9px] text-gray-400 uppercase tracking-wider font-bold',
                btn:      'demo-toggle px-2.5 py-1 rounded text-[11px] border border-[#374151] text-gray-400 hover:bg-[#1F2A37] transition-colors',
                btnActive:'demo-toggle active px-2.5 py-1 rounded text-[11px] border border-blue-400 bg-[rgba(28,100,242,0.12)] text-blue-300',
                sep:      'text-gray-300',
                backBtn:  'w-8 h-8 rounded-full bg-[#1F2A37] hover:bg-[rgba(28,100,242,0.12)] border border-[#374151] hover:border-blue-400 flex items-center justify-center text-gray-400 hover:text-blue-300 transition-colors flex-shrink-0'
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
                info:    'var(--cs-info,#1C64F2)',
                purple:  'var(--cs-accent-purple,#7C3AED)'
            },
            classes: {
                info:   'text-[10px] text-gray-400',
                legend: 'flex items-center gap-3 text-[10px] text-gray-400',
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
