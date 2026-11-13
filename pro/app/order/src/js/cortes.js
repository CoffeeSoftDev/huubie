/*  POS › Tickets/Cierre (sección pos-tickets): visor de turnos y de cierres del día.

    A la izquierda la lista del periodo; a la derecha el papel del corte tal
    como se imprime (orderTurn.cutTicket / orderClosure.dayTicket), en modo
    Resumido o Detallado (cada pedido y cada cobro). Los modales de
    pedido-turno.js y pedido-cierre.js le piden a la página global `orders`
    tres cosas: can(), paintTurn() y lsOrders(); aquí las da Cuts. Los datos
    los sirven ctrl-turno y ctrl-cierre: la lista y el papel con permiso de
    pos-tickets; reimprimir, reabrir y recalcular con el de pos-pedidos. */

let api = 'ctrl/ctrl-pedidos.php';
let orders, orderTurn, orderClosure;
let dataInit = {};

$(async () => {
    dataInit = (await useFetch({ url: api, data: { opc: 'init' } })) || {};

    orderTurn    = new OrderTurn('ctrl/ctrl-turno.php', 'root');
    orderClosure = new OrderClosure('ctrl/ctrl-cierre.php', 'root');
    orders       = new Cuts('ctrl/ctrl-turno.php', 'root');
    orders.init();
});

// -- Cuts --

class Cuts extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME   = 'Cuts';
        this.rangeKey       = 'pro:cortes:range:v1';
        this.modeKey        = 'pro:cortes:mode:v1';
        this.ranges         = { week: 'Semana actual', month: 'Mes actual', lastMonth: 'Mes anterior', last30: 'Últimos 30 días' };
        this.views          = {
            turns: { url: 'ctrl/ctrl-turno.php', opc: 'lsTurns', one: 'turno', many: 'turnos' },
            days:  { url: 'ctrl/ctrl-cierre.php', opc: 'lsDays', one: 'día', many: 'días' }
        };
        this.weekdays       = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        this.months         = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        this.view           = 'turns';
        this.data           = null;
        this.items          = [];
        this.selected       = null;
        this.current        = null;
        this.mode           = this.savedMode();
        this.request        = 0;
        this.previewRequest = 0;
    }

    get filters() {
        return {
            view: $('#cut_view').val() === 'days' ? 'days' : 'turns',
            ...getDataRangePicker('cut_calendar')
        };
    }

    // -- Interface --

    init() {
        this.render();
    }

    render() {
        this.layout();
        this.header();

        if (dataInit.status != 200) return this.blocked(dataInit.message || 'No se pudo cargar Tickets/Cierre. Recarga la página.');

        // La página es de pos-tickets; can() sigue en pos-pedidos para los modales de turno y cierre.
        if (!(dataInit.tickets || []).includes('show')) return this.blocked('Tu rol no tiene permiso para ver los cortes de esta sucursal.');

        this.filterBar();
        this.viewer();
        this.lsCuts();
    }

    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:    `page${this.PROJECT_NAME}`,
                class: 'flex flex-col gap-[16px]',
                container: [
                    { type: 'div', id: `header${this.PROJECT_NAME}`, class: 'w-full' },
                    { type: 'div', id: `body${this.PROJECT_NAME}`, class: 'w-full' }
                ]
            }
        });

        this.primaryLayout({
            parent: `body${this.PROJECT_NAME}`,
            id:     this.PROJECT_NAME,
            class:  'ord-card',
            card: {
                name:      `card${this.PROJECT_NAME}`,
                class:     'flex flex-col',
                filterBar: { class: 'w-full mb-[14px]' },
                container: { class: 'w-full' }
            }
        });
    }

    filterBar() {
        const saved = this.savedRange();

        this.createfilterBar({
            parent:     `filterBar${this.PROJECT_NAME}`,
            id:         `fb${this.PROJECT_NAME}`,
            prefijo:    'cut_',
            coffeesoft: true,
            data: [
                {
                    opc:      'select',
                    id:       'view',
                    lbl:      'Ver',
                    required: false,
                    class:    'col-12 col-sm-5 col-lg-3 col-xl-2',
                    data:     [{ id: 'turns', valor: 'Turnos de caja' }, { id: 'days', valor: 'Cierres del día' }],
                    value:    saved.view,
                    onchange: 'orders.onFilterChange()'
                },
                {
                    opc:      'input-calendar',
                    id:       'calendar',
                    lbl:      'Periodo',
                    required: false,
                    readonly: true,
                    class:    'col-12 col-sm-7 col-lg-4 col-xl-3'
                },
                {
                    opc:         'input',
                    id:          'search',
                    type:        'search',
                    lbl:         'Buscar',
                    required:    false,
                    placeholder: 'Folio, persona o fecha',
                    class:       'col-12 col-lg-5 col-xl-4'
                }
            ]
        });

        dataPicker({
            parent: 'cut_calendar',
            type:   'all',
            rangepicker: {
                startDate:     saved.dates[0],
                endDate:       saved.dates[1],
                showDropdowns: true,
                autoApply:     true,
                locale: {
                    format:           'DD/MM/YYYY',
                    separator:        ' - ',
                    firstDay:         1,
                    customRangeLabel: 'Personalizado',
                    daysOfWeek:       ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
                    monthNames:       this.months
                },
                ranges: Object.fromEntries(Object.entries(this.ranges).map(([range, label]) => [label, this.rangeDates(range)]))
            },
            onSelect: () => this.onFilterChange()
        });

        // 'input' también avisa cuando se borra con la ✕ del campo de búsqueda.
        $('#cut_search').attr('autocomplete', 'off').on('input', () => this.filterList());
    }

    header() {
        const scope = dataInit.scope || {};

        this.createLayout({
            parent: `header${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `title${this.PROJECT_NAME}`,
                class: 'w-full',
                container: [
                    {
                        type:  'div',
                        class: 'flex items-end justify-between gap-[12px] flex-wrap',
                        children: [
                            { type: 'div', id: `headerText${this.PROJECT_NAME}`, class: 'min-w-0' },
                            { type: 'div', id: `headerActions${this.PROJECT_NAME}`, class: 'max-w-full' }
                        ]
                    }
                ]
            }
        });

        this.createLayout({
            parent: `headerText${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `headerTextBody${this.PROJECT_NAME}`,
                class: 'w-full',
                container: [
                    { type: 'h1', class: 'cp-pagina-titulo', text: 'Tickets/Cierre' },
                    { type: 'p', class: 'cp-pagina-subtitulo', text: [scope.company, scope.branch].filter(Boolean).join(' · ') || 'Turnos de caja y cierres del día' }
                ]
            }
        });

        if (dataInit.status != 200 || !this.can('show')) return;

        this.paintTurn();
    }

    // Chip del turno o del día y accesos rápidos. orderTurn.sync() lo repinta.
    paintTurn() {
        if (!$(`#headerActions${this.PROJECT_NAME}`).length) return;

        const turn    = dataInit.turn;
        const day     = dataInit.day || {};
        const pending = day.pending && day.pending.length ? day.pending[0] : '';

        let tone = 'is-none';
        let text = 'Sin turno abierto';

        if (turn && turn.old) {
            tone = 'is-old';
            text = `Turno ${turn.folio} de otro día`;
        } else if (turn) {
            tone = 'is-open';
            text = `Turno ${turn.folio} · desde ${ordHour(String(turn.opened_at).slice(11, 16))}`;
        } else if (day.closed) {
            tone = 'is-closed';
            text = 'Día cerrado';
        } else if (pending) {
            tone = 'is-old';
            text = `Falta cerrar el ${ordDate(pending).slice(0, 5)}`;
        }

        this.createLayout({
            parent: `headerActions${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `headerActionsBody${this.PROJECT_NAME}`,
                class: 'flex items-center gap-[12px] flex-wrap justify-end',
                container: [
                    { type: 'span', id: `turnChip${this.PROJECT_NAME}`, class: `ord-turn-chip ${tone}`, html: `<span class="ord-turn-dot"></span>${esc(text)}` },
                    { type: 'div', id: `headerButtons${this.PROJECT_NAME}`, class: 'flex' }
                ]
            }
        });

        this.coffeeForm({
            parent:       `headerButtons${this.PROJECT_NAME}`,
            id:           'formHeaderCuts',
            class:        'flex flex-wrap gap-[8px]',
            showRequired: false,
            json: [
                { opc: 'button', id: 'btnTurnCuts', class: 'col-auto', text: 'Turno actual', icon: 'icon-clock', color_btn: 'outline', onClick: () => orderTurn.open() },
                { opc: 'button', id: 'btnDayCuts', class: 'col-auto', text: 'Cierre del día', icon: 'icon-calendar-check-o', color_btn: 'outline', onClick: () => orderClosure.open(pending) }
            ]
        });
    }

    blocked(message) {
        this.createLayout({
            parent: `body${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `blocked${this.PROJECT_NAME}`,
                class: 'ord-aviso',
                container: [
                    { type: 'i', class: 'icon-lock text-[22px]' },
                    {
                        type:  'div',
                        class: 'flex flex-col',
                        children: [
                            { type: 'p', class: 'ord-aviso-titulo', text: message },
                            { type: 'p', class: 'ord-aviso-texto', text: 'Si crees que es un error, pide acceso a quien administra Huubie.' }
                        ]
                    }
                ]
            }
        });
    }

    // Esqueleto del visor: lista a la izquierda, barra y papel a la derecha.
    viewer() {
        this.createLayout({
            parent: `container${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `viewer${this.PROJECT_NAME}`,
                class: 'ord-viewer',
                container: [
                    {
                        type:  'div',
                        class: 'ord-viewer-side',
                        children: [
                            { type: 'div', id: `listHead${this.PROJECT_NAME}`, class: 'ord-viewer-head' },
                            { type: 'div', id: `list${this.PROJECT_NAME}`, class: 'ord-viewer-list', 'aria-label': 'Lista de cortes' }
                        ]
                    },
                    {
                        type:  'div',
                        class: 'ord-viewer-main',
                        children: [
                            { type: 'div', id: `bar${this.PROJECT_NAME}`, class: 'ord-viewer-bar' },
                            { type: 'div', id: `paper${this.PROJECT_NAME}`, class: 'ord-viewer-desk' }
                        ]
                    }
                ]
            }
        });

        $(`#list${this.PROJECT_NAME}`)
            .on('click', 'button.ord-vitem', (e) => this.select(String($(e.currentTarget).attr('data-key')), true))
            .on('keydown', 'button.ord-vitem', (e) => this.step(e));

        $(`#bar${this.PROJECT_NAME}`).on('click', 'button.ord-seg', (e) => this.setMode(String($(e.currentTarget).attr('data-mode'))));
    }

    // -- Lista --

    async lsCuts() {
        const request = ++this.request;
        const filters = this.filters;
        const view    = this.views[filters.view];

        this.previewRequest++;
        $(`#viewer${this.PROJECT_NAME}`).addClass('is-loading');

        const data = await useFetch({ url: view.url, data: { opc: view.opc, fi: filters.fi, ff: filters.ff } });

        if (request !== this.request) return;

        $(`#viewer${this.PROJECT_NAME}`).removeClass('is-loading');

        const loaded = Boolean(data && data.status == 200);

        if (!loaded) alert({ icon: 'error', title: 'No se pudo cargar la lista', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

        this.view  = filters.view;
        this.data  = loaded ? data : null;
        this.items = loaded ? (data.items || []).map((item) => this.prepare(item)) : [];

        this.paintHead(filters);
        this.paintList();

        const keep  = this.items.find((item) => item.key === this.selected);
        const first = this.visible()[0];

        if (keep) return this.select(keep.key);
        if (first) return this.select(first.key);

        this.selected = null;
        this.current  = null;
        this.paintEmpty(loaded ? `No hay ${view.many} en este periodo.` : 'No se pudo cargar la lista.');
    }

    // Los modales de turno y cierre llaman orders.lsOrders() al guardar.
    lsOrders() {
        this.lsCuts();
    }

    // La llave de cada renglón (id del turno o fecha del día) y el texto en que busca el filtro.
    prepare(item) {
        const turns = this.view === 'turns';
        const day   = String(turns ? item.opened_at : item.date).slice(0, 10);
        const words = turns
            ? [item.folio, item.opened_by, item.closed_by]
            : [item.folio, item.closed_by, item.note];

        return {
            ...item,
            key:    turns ? String(item.id) : day,
            day:    day,
            search: this.plain([...words, ordDate(day), this.weekday(day)].join(' '))
        };
    }

    visible() {
        const words = this.plain($('#cut_search').val() || '').split(/\s+/).filter(Boolean);

        if (!words.length) return this.items;

        return this.items.filter((item) => words.every((word) => item.search.includes(word)));
    }

    filterList() {
        this.paintList();
    }

    paintHead(filters) {
        const caption = this.caption(this.data, filters);
        const total   = this.items.reduce((sum, item) => sum + Number(item.sold || 0), 0);

        $(`#listHead${this.PROJECT_NAME}`).html(`
            <div class="ord-viewer-count">
                <span>${esc(caption.title)}</span>
                ${this.items.length ? `<strong aria-label="Vendido en el periodo">${money(total)}</strong>` : ''}
            </div>
            <p class="ord-viewer-note">${caption.subtitle}</p>`);
    }

    paintList() {
        const items = this.visible();
        const list  = $(`#list${this.PROJECT_NAME}`);

        if (!items.length) {
            const text = this.items.length ? 'Nada coincide con la búsqueda.' : `No hay ${this.views[this.view].many} en este periodo.`;

            list.html(`<div class="ord-viewer-empty"><i class="icon-search"></i><p>${text}</p></div>`);
            return;
        }

        list.html(this.groups(items).map((group) => `
            <div class="ord-vgroup">
                <p class="ord-vgroup-title"><span>${esc(group.title)}</span><span>${money(group.total)}</span></p>
                ${group.items.map((item) => this.view === 'turns' ? this.turnItem(item) : this.dayItem(item)).join('')}
            </div>`).join(''));

        this.mark();
    }

    // Turnos agrupados por día; días agrupados por mes. Cada grupo con lo vendido.
    groups(items) {
        const groups = [];

        items.forEach((item) => {
            const key  = this.view === 'turns' ? item.day : item.day.slice(0, 7);
            let group  = groups[groups.length - 1];

            if (!group || group.key !== key) {
                group = { key, title: this.groupTitle(item.day), total: 0, items: [] };
                groups.push(group);
            }

            group.total += Number(item.sold || 0);
            group.items.push(item);
        });

        return groups;
    }

    groupTitle(day) {
        if (this.view === 'days') return `${this.months[Number(day.slice(5, 7)) - 1] || ''} ${day.slice(0, 4)}`;

        return `${day === dataInit.today ? 'Hoy, ' : ''}${this.weekday(day)} ${ordDate(day)}`;
    }

    turnItem(t) {
        const end   = t.closed ? ` – ${t.closed_at && String(t.closed_at).slice(0, 10) === t.day ? this.hour(t.closed_at) : ordDate(t.closed_at, true)}` : '';
        const tags  = [
            t.closed ? '' : this.tag('open', 'Abierto', true),
            t.closed && t.difference !== null ? this.diffTag(t.difference) : '',
            t.changed ? this.tag('changed', 'Cambió') : '',
            t.reopened ? this.tag('info', 'Reabierto') : '',
            t.day_closed ? this.tag('muted', 'Día cerrado') : ''
        ];

        return this.itemShell(t, `Turno ${esc(t.folio)}`, [`${this.hour(t.opened_at)}${end}`, esc(t.opened_by)].filter(Boolean).join(' · '), tags);
    }

    dayItem(d) {
        const today = d.date === dataInit.today;
        const turns = `${d.turns} ${d.turns === 1 ? 'turno' : 'turnos'}`;
        const open  = d.open_turns ? ` · ${d.open_turns} ${d.open_turns === 1 ? 'abierto' : 'abiertos'}` : '';
        const sub   = d.closed ? [`Cierre ${esc(d.folio)}`, turns, esc(d.closed_by)].filter(Boolean).join(' · ') : `${turns}${open}`;
        const tags  = [
            d.closed ? this.tag('closed', 'Cerrado') : this.tag(today ? 'open' : 'pending', today ? 'Hoy, sin cerrar' : 'Sin cerrar', today),
            d.difference !== null ? this.diffTag(d.difference) : '',
            d.changed ? this.tag('changed', 'Cambió') : ''
        ];

        return this.itemShell(d, `${this.weekday(d.date)} ${ordDate(d.date)}`, sub, tags);
    }

    itemShell(item, title, sub, tags) {
        const shown = tags.filter(Boolean);

        return `
            <button type="button" class="ord-vitem" data-key="${esc(item.key)}">
                <span class="ord-vitem-row">
                    <span class="ord-vitem-title">${title}</span>
                    <span class="ord-vitem-amount">${money(item.sold)}</span>
                </span>
                <span class="ord-vitem-row">
                    <span class="ord-vitem-sub">${sub}</span>
                    ${item.changed ? `<span class="ord-vitem-live">hoy ${money(item.live)}</span>` : ''}
                </span>
                ${shown.length ? `<span class="ord-vitem-tags">${shown.join('')}</span>` : ''}
            </button>`;
    }

    tag(tone, text, dot) {
        return `<span class="ord-vtag is-${tone}">${dot ? '<span class="ord-vtag-dot"></span>' : ''}${esc(text)}</span>`;
    }

    // Cuadra / Sobran / Faltan con el mismo texto que el modal del turno.
    diffTag(diff) {
        const tone = orderTurn.diffTone(Number(diff));

        return this.tag(tone.tone, tone.text);
    }

    // -- Vista previa --

    select(key, byUser) {
        this.selected = key;
        this.mark();
        this.preview(key);

        if (byUser && window.matchMedia('(max-width: 1023px)').matches) {
            const paper = document.getElementById(`bar${this.PROJECT_NAME}`);

            if (paper) paper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    mark() {
        $(`#list${this.PROJECT_NAME} button.ord-vitem`).removeClass('is-active').removeAttr('aria-current');
        $(`#list${this.PROJECT_NAME} button.ord-vitem[data-key="${this.selected}"]`).addClass('is-active').attr('aria-current', 'true');
    }

    // Flechas arriba y abajo recorren la lista sin soltar el teclado.
    step(e) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

        e.preventDefault();

        const buttons = $(`#list${this.PROJECT_NAME} button.ord-vitem`);
        const index   = buttons.index(e.currentTarget) + (e.key === 'ArrowDown' ? 1 : -1);
        const next    = buttons.eq(Math.max(0, Math.min(buttons.length - 1, index)));

        next.trigger('focus');
        this.select(String(next.attr('data-key')));
    }

    // Siempre pide el detalle: el modo solo cambia lo que se pinta.
    async preview(key) {
        const request = ++this.previewRequest;
        const view    = this.view;
        const turns   = view === 'turns';

        $(`#paper${this.PROJECT_NAME}`).addClass('is-loading');

        const data = await useFetch(turns
            ? { url: 'ctrl/ctrl-turno.php', data: { opc: 'getTurn', id: key, detail: 1 } }
            : { url: 'ctrl/ctrl-cierre.php', data: { opc: 'getDay', date: key, detail: 1 } });

        if (request !== this.previewRequest || view !== this.view) return;

        $(`#paper${this.PROJECT_NAME}`).removeClass('is-loading');

        if (!data || data.status != 200 || (turns && !data.turn)) {
            this.current = null;
            this.paintBar();
            this.paintPaper((data && data.message) || 'No se pudo leer el corte. Vuelve a intentar.');
            return;
        }

        this.current = data;
        this.paintBar();
        this.paintPaper();
    }

    paintBar() {
        const data  = this.current;
        const turns = this.view === 'turns';
        let title   = 'Vista previa';
        let sub     = turns ? 'Elige un turno de la lista.' : 'Elige un día de la lista.';

        if (data && turns) {
            const t = data.turn;

            title = `${t.closed ? 'Corte Z' : 'Corte X'} · Turno ${t.folio}`;
            sub   = t.closed ? [`Cerró ${t.closed_by || 'el'}`.trim(), ordDate(t.closed_at, true)].join(t.closed_by ? ' · ' : ' ') : `Sigue abierto desde ${ordDate(t.opened_at, true)}`;
        }

        if (data && !turns) {
            title = `Cierre del día · ${ordDate(data.date)}`;
            sub   = data.closure ? [`Cierre ${data.closure.folio}`, data.closure.closed_by, ordDate(data.closure.closed_at, true)].filter(Boolean).join(' · ') : 'Sin cerrar: cifras en vivo.';
        }

        const modes = ['summary', 'detail'].map((mode) => {
            const active = this.mode === mode;

            return `<button type="button" class="ord-seg${active ? ' is-active' : ''}" data-mode="${mode}" aria-pressed="${active}">${mode === 'detail' ? 'Detallado' : 'Resumido'}</button>`;
        }).join('');

        this.createLayout({
            parent: `bar${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `barBody${this.PROJECT_NAME}`,
                class: 'ord-viewer-bar-body',
                container: [
                    {
                        type:  'div',
                        class: 'min-w-0',
                        children: [
                            { type: 'p', class: 'ord-viewer-title', text: title },
                            { type: 'p', class: 'ord-viewer-sub', text: sub }
                        ]
                    },
                    {
                        type:  'div',
                        class: 'ord-viewer-tools',
                        children: [
                            { type: 'div', class: 'ord-viewer-modes', html: data ? modes : '' },
                            { type: 'div', id: `barActions${this.PROJECT_NAME}`, class: 'flex' }
                        ]
                    }
                ]
            }
        });

        if (!data) return;

        const json = [{ opc: 'button', id: 'btnOpenCut', class: 'col-auto', text: turns ? 'Ver corte' : 'Ver cierre', icon: 'icon-eye', color_btn: 'outline', onClick: () => this.openCurrent() }];

        if (this.can('print')) json.push({ opc: 'button', id: 'btnPrintCut', class: 'col-auto', text: 'Imprimir', icon: 'icon-print', color_btn: 'primary', onClick: () => this.printCurrent() });

        this.coffeeForm({
            parent:       `barActions${this.PROJECT_NAME}`,
            id:           'formBarCuts',
            class:        'flex gap-[8px]',
            showRequired: false,
            json
        });
    }

    // El mismo papel que sale en la impresora. Con message: el aviso en lugar del papel.
    paintPaper(message) {
        const paper = $(`#paper${this.PROJECT_NAME}`);

        if (message || !this.current) {
            paper.html(`<div class="ord-viewer-empty"><i class="icon-doc-text"></i><p>${esc(message || 'Sin corte que mostrar.')}</p></div>`);
            return;
        }

        const detail = this.mode === 'detail' ? this.current.detail : null;
        const ticket = this.view === 'turns'
            ? orderTurn.cutTicket(this.current, detail)
            : orderClosure.dayTicket(this.current, detail);

        paper.html(`<article class="ord-ticket" aria-label="Vista previa del corte">${ticket}</article>`);
    }

    paintEmpty(message) {
        this.paintBar();
        this.paintPaper(message);
    }

    setMode(mode) {
        this.mode = mode === 'detail' ? 'detail' : 'summary';

        try {
            localStorage.setItem(this.modeKey, this.mode);
        } catch (e) {
            // Sin almacenamiento: el modo dura lo que dure la página.
        }

        $(`#bar${this.PROJECT_NAME} button.ord-seg`).each((i, el) => {
            const active = $(el).attr('data-mode') === this.mode;

            $(el).toggleClass('is-active', active).attr('aria-pressed', String(active));
        });

        if (this.current) this.paintPaper();
    }

    openCurrent() {
        if (!this.current) return;

        if (this.view === 'turns') orderTurn.open(this.current.turn.id);
        else orderClosure.open(this.current.date);
    }

    printCurrent() {
        if (!this.current) return;

        const detail = this.mode === 'detail' ? this.current.detail : null;

        if (this.view === 'turns') orderTurn.printCut(this.current, detail);
        else orderClosure.printDay(this.current, detail);
    }

    // -- Complements --

    onBranchChange() {
        location.reload();
    }

    onFilterChange() {
        this.saveRange();
        this.lsCuts();
    }

    can(action) {
        return (dataInit.actions || []).includes(action);
    }

    hour(value) {
        return ordHour(String(value || '').slice(11, 16));
    }

    weekday(day) {
        const [y, m, d] = String(day).slice(0, 10).split('-').map(Number);

        return y ? this.weekdays[new Date(y, m - 1, d).getDay()] : '';
    }

    // Minúsculas y sin acentos: «maria» encuentra «María».
    plain(text) {
        return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    savedMode() {
        try {
            return localStorage.getItem(this.modeKey) === 'detail' ? 'detail' : 'summary';
        } catch (e) {
            return 'summary';
        }
    }

    savedRange() {
        const saved = { view: 'turns', dates: this.rangeDates('month') };

        try {
            const raw = JSON.parse(localStorage.getItem(this.rangeKey) || '{}') || {};
            const fi  = moment(raw.fi, 'YYYY-MM-DD', true);
            const ff  = moment(raw.ff, 'YYYY-MM-DD', true);

            if (raw.view === 'days') saved.view = 'days';

            if (Object.keys(this.ranges).includes(raw.range)) saved.dates = this.rangeDates(raw.range);
            else if (raw.range === 'custom' && fi.isValid() && ff.isValid() && !ff.isBefore(fi)) saved.dates = [fi, ff];
        } catch (e) {
            return saved;
        }

        return saved;
    }

    saveRange() {
        const { fi, ff } = getDataRangePicker('cut_calendar');

        try {
            localStorage.setItem(this.rangeKey, JSON.stringify({ view: this.filters.view, range: this.rangeName(fi, ff), fi, ff }));
        } catch (e) {
            return;
        }
    }

    rangeDates(range) {
        const server = moment(dataInit.today, 'YYYY-MM-DD', true);
        const today  = server.isValid() ? server : moment();

        switch (range) {
            case 'week':      return [today.clone().startOf('isoWeek'), today.clone().endOf('isoWeek')];
            case 'lastMonth': return [today.clone().subtract(1, 'months').startOf('month'), today.clone().subtract(1, 'months').endOf('month')];
            case 'last30':    return [today.clone().subtract(29, 'days'), today.clone()];
            default:          return [today.clone().startOf('month'), today.clone().endOf('month')];
        }
    }

    rangeName(fi, ff) {
        const same = (range) => {
            const [start, end] = this.rangeDates(range);

            return start.format('YYYY-MM-DD') === fi && end.format('YYYY-MM-DD') === ff;
        };

        return Object.keys(this.ranges).find(same) || 'custom';
    }

    // Encabezado de la lista. subtitle ya viene escapado: va con .html().
    caption(data, filters) {
        const view = this.views[filters.view];

        if (!data) return { title: 'Sin datos', subtitle: 'No se pudo cargar la lista.' };

        const count  = Number(data.count || 0);
        const title  = count ? `${count} ${count === 1 ? view.one : view.many}` : `Sin ${view.many}`;
        const period = `del ${ordDate(filters.fi)} al ${ordDate(filters.ff)} en ${esc(data.branch || (dataInit.scope || {}).branch || '')}.`;

        if (filters.view === 'turns') {
            const changed = Number(data.changed || 0);
            const drift   = changed ? ` ${changed} ${changed === 1 ? 'turno cambió' : 'turnos cambiaron'} después de su corte: ábrelo para ver qué y recalcularlo.` : '';

            return { title, subtitle: `Por fecha de apertura, ${period}${drift}` };
        }

        const pending = Number(data.pending || 0);
        const state   = pending ? ` ${pending} sin cerrar.` : (count ? ' Todos cerrados.' : '');

        return { title, subtitle: `Días con turno o con cierre ${period}${state} Un día cerrado muestra las cifras de su cierre.` };
    }
}
