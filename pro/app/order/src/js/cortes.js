/*  POS › Tickets/Cierre (sección pos-tickets): visor de turnos, de cierres
    del día y de tickets (como alpha/order-visor).

    A la izquierda la lista del periodo; a la derecha el papel tal como se
    imprime. Turnos: el corte (orderTurn.cutTicket) en modo Resumido o
    Detallado. Cierres del día: el Corte Z de alpha en hoja carta
    (orderClosure.paintReport); un clic en un pedido abre su ticket con
    «Volver al corte Z». Tickets: pedidos (P) y ventas de mostrador (V) por fecha de
    captura; el papel es el ticket (OrderDetail.ticketHtml / ordTicketHtml)
    con sus pagos y su bitácora al lado. Los modales de pedido-turno.js y
    pedido-cierre.js le piden a la página global `orders` tres cosas: can(),
    paintTurn() y lsOrders(); aquí las da Cuts. Los datos los sirven
    ctrl-turno, ctrl-cierre y ctrl-tickets: la lista y el papel con permiso
    de pos-tickets; reimprimir, reabrir y recalcular con el de pos-pedidos. */

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
            turns:   { url: 'ctrl/ctrl-turno.php', opc: 'lsTurns', one: 'turno', many: 'turnos' },
            days:    { url: 'ctrl/ctrl-cierre.php', opc: 'lsDays', one: 'día', many: 'días' },
            tickets: { url: 'ctrl/ctrl-tickets.php', opc: 'lsTickets', one: 'ticket', many: 'tickets' }
        };
        this.kinds          = { order: 'Pedido', counter: 'Mostrador', online: 'Tienda en línea' };
        this.titles         = { order: 'Pedido', counter: 'Venta', online: 'Pedido en línea' };
        // Tono de cada estado (sale_status): Cotización, Pendiente, Pagado, Cancelado.
        this.statusTones    = { 1: 'closed', 2: 'pending', 3: 'ok', 4: 'short' };
        // Solo sus ayudantes de ticket y de bitácora: el visor no abre el modal del pedido.
        this.kit            = new OrderDetail('ctrl/ctrl-tickets.php', 'root');
        this.weekdays       = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        this.months         = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        this.view           = 'turns';
        this.data           = null;
        this.items          = [];
        this.selected       = null;
        this.current        = null;
        this.over           = null;   // el ticket abierto desde el Corte Z (vista Cierres del día)
        this.mode           = this.savedMode();
        this.request        = 0;
        this.previewRequest = 0;
    }

    get filters() {
        const view = String($('#cut_view').val() || '');

        return {
            view: this.views[view] ? view : 'turns',
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
                class: 'flex flex-1 flex-col gap-[16px]',
                container: [
                    { type: 'div', id: `header${this.PROJECT_NAME}`, class: 'w-full' },
                    { type: 'div', id: `body${this.PROJECT_NAME}`, class: 'w-full flex flex-1 flex-col' }
                ]
            }
        });

        // La tarjeta llena el alto del módulo, como Pedidos.
        this.primaryLayout({
            parent: `body${this.PROJECT_NAME}`,
            id:     this.PROJECT_NAME,
            class:  'ord-card flex flex-1 flex-col',
            card: {
                name:      `card${this.PROJECT_NAME}`,
                class:     'flex flex-1 flex-col',
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
                    data:     [{ id: 'turns', valor: 'Turnos de caja' }, { id: 'days', valor: 'Cierres del día' }, { id: 'tickets', valor: 'Tickets' }],
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
                    placeholder: 'Folio, cliente, persona o fecha',
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
                    { type: 'p', class: 'cp-pagina-subtitulo', text: [scope.company, scope.branch].filter(Boolean).join(' · ') || 'Turnos de caja, cierres del día y tickets' }
                ]
            }
        });

        if (dataInit.status != 200 || !this.can('show')) return;

        // Sin la franja de caja (abrir y cerrar turno): es un visor, como alpha/order-visor.
        // El turno se abre y se cierra en Ventas y en Pedidos.
        this.paintTurn();
    }

    // «Cierre del día» del encabezado. orderTurn.sync() lo repinta: el botón abre el día pendiente si lo hay.
    paintTurn() {
        if (!$(`#headerActions${this.PROJECT_NAME}`).length) return;

        const day     = dataInit.day || {};
        const pending = day.pending && day.pending.length ? day.pending[0] : '';

        this.createLayout({
            parent: `headerActions${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `headerActionsBody${this.PROJECT_NAME}`,
                class: 'flex items-center gap-[12px] flex-wrap justify-end',
                container: [
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
                { opc: 'button', id: 'btnDayCuts', class: 'col-auto', text: 'Cierre del día', icon: 'icon-calendar-check-o', color_btn: 'outline', onClick: () => orderClosure.open(pending) }
            ]
        });

        // Sin un turno cerrado no se cierra el día: la regla de todas las pantallas (orderTurn.dayReady).
        // Los días ya cerrados se siguen viendo desde la lista de Cortes.
        ordLock('btnDayCuts', !orderTurn.dayReady(), orderTurn.dayWhy());
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
        // Ticket: por día de captura. Muestra su total; suma al grupo solo lo vendido (sold).
        if (this.view === 'tickets') {
            const day = String(item.created_at).slice(0, 10);

            return {
                ...item,
                key:    String(item.id),
                day:    day,
                amount: item.total,
                struck: Number(item.status_id) === 4,
                search: this.plain([item.folio, item.customer, item.seller, item.status, item.turn, this.kinds[item.kind], ordDate(day), this.weekday(day)].join(' '))
            };
        }

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
                ${group.items.map((item) => this.view === 'turns' ? this.turnItem(item) : this.view === 'days' ? this.dayItem(item) : this.ticketItem(item)).join('')}
            </div>`).join(''));

        this.mark();
    }

    // Turnos y tickets agrupados por día; días agrupados por mes. Cada grupo con lo vendido.
    groups(items) {
        const groups = [];

        items.forEach((item) => {
            const key  = this.view === 'days' ? item.day.slice(0, 7) : item.day;
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

    // Folio, hora de captura y cliente; el estado, de qué es y lo que falta cobrar.
    ticketItem(t) {
        const status  = Number(t.status_id);
        const who     = t.customer || (t.kind === 'counter' ? 'Público en general' : 'Sin cliente');
        const balance = status === 2 && Number(t.balance) > 0.005 ? this.tag('pending', `Saldo ${money(t.balance)}`) : '';
        const tags    = [
            this.tag(this.statusTones[status] || 'muted', t.status),
            this.tag('muted', this.kinds[t.kind] || 'Pedido'),
            balance
        ];

        return this.itemShell(t, esc(t.folio), [this.hour(t.created_at), esc(who)].filter(Boolean).join(' · '), tags);
    }

    // amount: lo que se pinta a la derecha (sin él, lo vendido). struck: tachado (cancelado).
    itemShell(item, title, sub, tags) {
        const shown  = tags.filter(Boolean);
        const amount = item.amount !== undefined ? item.amount : item.sold;

        return `
            <button type="button" class="ord-vitem" data-key="${esc(item.key)}">
                <span class="ord-vitem-row">
                    <span class="ord-vitem-title">${title}</span>
                    <span class="ord-vitem-amount${item.struck ? ' is-off' : ''}">${money(amount)}</span>
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
        const query   = {
            turns:   { url: 'ctrl/ctrl-turno.php', data: { opc: 'getTurn', id: key, detail: 1 } },
            days:    { url: 'ctrl/ctrl-cierre.php', data: { opc: 'getDay', date: key, detail: 1, report: 1 } },
            tickets: { url: 'ctrl/ctrl-tickets.php', data: { opc: 'getTicket', id: key } }
        };

        this.over = null;

        $(`#paper${this.PROJECT_NAME}`).addClass('is-loading');

        const data = await useFetch(query[view]);

        if (request !== this.previewRequest || view !== this.view) return;

        $(`#paper${this.PROJECT_NAME}`).removeClass('is-loading');

        if (!data || data.status != 200 || (turns && !data.turn) || (view === 'tickets' && !data.order)) {
            this.current = null;
            this.paintBar();
            this.paintPaper((data && data.message) || `No se pudo leer ${view === 'tickets' ? 'el ticket' : 'el corte'}. Vuelve a intentar.`);
            return;
        }

        this.current = data;
        this.paintBar();
        this.paintPaper();
    }

    paintBar() {
        const data    = this.current;
        const turns   = this.view === 'turns';
        const tickets = this.view === 'tickets';
        let title     = 'Vista previa';
        let sub       = turns ? 'Elige un turno de la lista.' : tickets ? 'Elige un ticket de la lista.' : 'Elige un día de la lista.';

        if (data && turns) {
            const t = data.turn;

            title = `${t.closed ? 'Corte Z' : 'Corte X'} · Turno ${t.folio}`;
            sub   = t.closed ? [`Cerró ${t.closed_by || 'el'}`.trim(), ordDate(t.closed_at, true)].join(t.closed_by ? ' · ' : ' ') : `Sigue abierto desde ${ordDate(t.opened_at, true)}`;
        }

        if (data && this.view === 'days') {
            title = `Cierre del día · ${ordDate(data.date)}`;
            sub   = data.closure ? [`Cierre ${data.closure.folio}`, data.closure.closed_by, ordDate(data.closure.closed_at, true)].filter(Boolean).join(' · ') : 'Sin cerrar: cifras en vivo.';
        }

        if (data && tickets) {
            const o   = data.order;
            const who = String(o.created_by || '').trim();

            title = `${this.titles[data.kind] || 'Pedido'} ${data.folio}`;
            sub   = [o.status, ordDate(o.created_at, true), who ? `${data.kind === 'counter' ? 'Atendió' : 'Capturó'} ${who}` : '', o.turn_folio ? `Turno ${o.turn_folio}` : 'Sin turno'].filter(Boolean).join(' · ');
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
                            { type: 'div', class: 'ord-viewer-modes', html: data && turns ? modes : '' },
                            { type: 'div', id: `barActions${this.PROJECT_NAME}`, class: 'flex' }
                        ]
                    }
                ]
            }
        });

        if (!data) return;

        // El ticket no tiene modos ni modal propio: solo se imprime, con 'print' de pos-tickets.
        const json  = tickets ? [] : [{ opc: 'button', id: 'btnOpenCut', class: 'col-auto', text: turns ? 'Ver corte' : 'Ver cierre', icon: 'icon-eye', color_btn: 'outline', onClick: () => this.openCurrent() }];
        const print = tickets ? this.canTickets('print') : this.can('print');

        if (print) json.push({ opc: 'button', id: 'btnPrintCut', class: 'col-auto', text: 'Imprimir', icon: 'icon-print', color_btn: 'primary', onClick: () => this.printCurrent() });

        if (!json.length) return;

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
            paper.html(`<div class="ord-viewer-empty"><i class="icon-doc-text"></i><p>${esc(message || (this.view === 'tickets' ? 'Sin ticket que mostrar.' : 'Sin corte que mostrar.'))}</p></div>`);
            return;
        }

        if (this.view === 'tickets') return this.paintTicket(paper, this.current);

        // Cierres del día: el Corte Z de alpha, no un ticket. Un clic en un pedido abre su ticket aquí mismo.
        if (this.view === 'days') {
            if (this.over) return this.paintTicket(paper, this.over, true);

            return orderClosure.paintReport(paper, this.current, (id) => this.openOver(id));
        }

        const detail = this.mode === 'detail' ? this.current.detail : null;

        paper.html(`<article class="ord-ticket" aria-label="Vista previa del corte">${orderTurn.cutTicket(this.current, detail)}</article>`);
    }

    // Clic en un pedido del Corte Z: su ticket en el mismo papel, con «Volver al corte Z» (como alpha/order-visor).
    async openOver(id) {
        const key  = this.selected;
        const data = await useFetch({ url: 'ctrl/ctrl-tickets.php', data: { opc: 'getTicket', id } });

        if (this.view !== 'days' || this.selected !== key) return;

        if (!data || data.status != 200 || !data.order) {
            alert({ icon: 'error', title: 'No se abrió el ticket', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        this.over = data;
        this.paintPaper();

        $(`#paper${this.PROJECT_NAME}`).scrollTop(0);
    }

    // -- Ticket (vista Tickets) --

    /*  El ticket tal como sale impreso y, al lado, sus pagos y su bitácora
        (como alpha/order-visor). Va en un iframe con ORD_TICKET_CSS: esa hoja
        trae reglas de html y body que pisarían la página. back: viene del
        Corte Z y lleva «Volver al corte Z». */
    paintTicket(paper, data, back) {
        paper.html(`
            <div class="ord-tk-view">
                ${back ? '<div class="ord-tk-back"><button type="button" class="ord-tk-back-btn"><i data-lucide="arrow-left" class="w-4 h-4"></i>Volver al corte Z</button></div>' : ''}
                <div class="ord-tk-desk">
                    <article class="ord-tk-paper" aria-label="Vista previa del ticket">
                        <iframe id="frameTicketCuts" class="ord-tk-frame" title="Ticket ${esc(data.folio)}"></iframe>
                    </article>
                    <div class="ord-tk-side">
                        ${this.ticketPayments(data)}
                        ${this.ticketHistory(data.history || [])}
                    </div>
                </div>
            </div>`);

        if (back) {
            paper.find('button.ord-tk-back-btn').on('click', () => {
                this.over = null;
                this.paintPaper();
            });
        }

        const frame = document.getElementById('frameTicketCuts');
        const fit   = () => {
            const doc = frame.contentDocument;

            if (doc && doc.documentElement) frame.style.height = `${doc.documentElement.scrollHeight}px`;
        };

        frame.addEventListener('load', () => {
            fit();

            // El logo puede llegar después del load del documento.
            Array.from(frame.contentDocument.images).forEach((img) => img.addEventListener('load', fit));
        });

        // .tk con 16 px de aire: la tarjeta redondeada de alpha (p-4 rounded-lg). La impresión no cambia.
        frame.srcdoc = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>${ORD_TICKET_CSS} html, body { overflow: hidden; } .tk { padding: 16px; }</style></head><body>${this.ticketHtml(data)}</body></html>`;

        if (window.lucide) lucide.createIcons();
    }

    // Venta de mostrador: el ticket de venta (como al reimprimir en el Historial). Pedido: el de pedido.
    ticketHtml(data) {
        return data.kind === 'counter' ? ordTicketHtml(data.ticket || {}, { reprint: true }) : this.kit.ticketHtml(data);
    }

    // «Historial de pagos»: cada cobro con su método, cuándo, en qué turno y quién; abajo las cuentas.
    ticketPayments(data) {
        const o        = data.order;
        const payments = data.payments || [];
        const total    = Number(o.total || 0);
        const tip      = Number(o.tip_amount || 0);
        const paid     = Number(o.paid || 0);
        const discount = Number(o.discount_amount || 0);
        const alive    = Number(o.sale_status_id) !== 4;
        const balance  = alive ? ordRound(total + tip - paid) : 0;
        const credit   = data.ticket && Number(data.ticket.credit) > 0.005 ? Number(data.ticket.credit) : 0;

        const rows = payments.map((p) => {
            const [icon, tone] = this.kit.paymentIcon(p);
            const by     = String(p.received_by || '').trim();
            const cross  = p.branch && p.branch !== data.branch ? `<span class="ord-tk-badge" title="Cobrado en otra sucursal">${esc(p.branch)}</span>` : '';
            const meta   = [ordDate(p.paid_at, true), p.turn_folio ? `Turno ${esc(p.turn_folio)}` : 'Sin turno', by ? esc(by) : ''].filter(Boolean).join(' · ');
            const change = Number(p.change_amount) > 0 ? `<p class="ord-tk-meta">Recibió ${money(p.tendered_amount)} · cambio ${money(p.change_amount)}</p>` : '';

            return `
                <li class="ord-tk-row">
                    <i data-lucide="${icon}" class="w-4 h-4 ${tone} shrink-0 mt-0.5"></i>
                    <div class="min-w-0 flex-1">
                        <p class="ord-tk-name">${esc(p.method || 'Sin método')}${cross}</p>
                        <p class="ord-tk-meta">${meta}</p>
                        ${change}
                    </div>
                    <span class="ord-tk-amount">${money(p.amount)}</span>
                </li>`;
        }).join('');

        const line = (label, value, cls = '') => `<div class="ord-tk-sum-row ${cls}"><span>${label}</span><span>${value}</span></div>`;

        const rest = !alive          ? line('Cancelado', 'No suma en lo vendido', 'is-muted')
                   : credit          ? line('A crédito', money(credit), 'is-due')
                   : balance > 0.005 ? line('Saldo', money(balance), 'is-due')
                   : balance < -0.005 ? line('Saldo a favor', money(Math.abs(balance)), 'is-favor')
                   : line('Saldo', money(0), 'is-zero');

        return `
            <section class="ord-tk-card">
                <header class="ord-tk-head">
                    <i data-lucide="wallet" class="w-4 h-4"></i>
                    <span>Historial de pagos</span>
                    <small>${payments.length} ${payments.length === 1 ? 'pago' : 'pagos'}</small>
                </header>
                ${payments.length ? `<ul class="ord-tk-list">${rows}</ul>` : '<p class="ord-tk-empty">Sin pagos registrados.</p>'}
                <div class="ord-tk-sum">
                    ${discount > 0 ? line('Subtotal', money(o.subtotal)) : ''}
                    ${discount > 0 ? line('Descuento', `−${money(discount)}`, 'is-discount') : ''}
                    ${line('Total', money(total), 'is-total')}
                    ${tip > 0 ? line('Propina', money(tip)) : ''}
                    ${line('Cobrado', money(paid), 'is-paid')}
                    ${rest}
                </div>
            </section>`;
    }

    // «Bitácora» (Historial de actividad en order-visor), lo más nuevo arriba. Los íconos, los del detalle del pedido.
    ticketHistory(history) {
        const rows = history.map((h) => {
            const title        = h.title || h.action || 'Movimiento';
            const [icon, tone] = this.kit.historyIcon(h.type, title);
            const who          = String(h.user_name || '').trim();

            return `
                <li class="ord-tk-row">
                    <i data-lucide="${icon}" class="w-4 h-4 ${tone} shrink-0 mt-0.5"></i>
                    <div class="min-w-0 flex-1">
                        <p class="ord-tk-name">${esc(title)}</p>
                        ${h.detail ? `<p class="ord-tk-text">${esc(h.detail)}</p>` : ''}
                        <p class="ord-tk-meta">${ordDate(h.created_at, true)} · ${who ? esc(who) : 'Sin registro'}</p>
                    </div>
                </li>`;
        }).join('');

        return `
            <section class="ord-tk-card">
                <header class="ord-tk-head">
                    <i data-lucide="history" class="w-4 h-4"></i>
                    <span>Bitácora</span>
                    <small>${history.length} ${history.length === 1 ? 'movimiento' : 'movimientos'}</small>
                </header>
                ${history.length ? `<ul class="ord-tk-list">${rows}</ul>` : '<p class="ord-tk-empty">Sin movimientos registrados.</p>'}
            </section>`;
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

        // Solo el corte del turno tiene Resumido | Detallado.
        if (this.current && this.view === 'turns') this.paintPaper();
    }

    openCurrent() {
        if (!this.current || this.view === 'tickets') return;

        if (this.view === 'turns') orderTurn.open(this.current.turn.id);
        else orderClosure.open(this.current.date);
    }

    printCurrent() {
        if (!this.current) return;

        // Lo que está en el papel: el ticket (de la lista o abierto desde el Corte Z) o el corte.
        const ticket = this.view === 'tickets' ? this.current : this.view === 'days' ? this.over : null;

        if (ticket) {
            if (!this.canTickets('print')) return;

            ordPrintDoc(`${this.titles[ticket.kind] || 'Pedido'} ${ticket.folio}`, ORD_TICKET_CSS, this.ticketHtml(ticket));
            return;
        }

        if (this.view === 'days') return orderClosure.printDay(this.current);

        orderTurn.printCut(this.current, this.mode === 'detail' ? this.current.detail : null);
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

    // Las acciones de la página (pos-tickets). can() sigue en pos-pedidos para los modales de turno y cierre.
    canTickets(action) {
        return (dataInit.tickets || []).includes(action);
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

            if (this.views[raw.view]) saved.view = raw.view;

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

        if (filters.view === 'tickets') {
            const kinds = data.kinds || {};
            const parts = [
                kinds.order ? `${kinds.order} ${kinds.order === 1 ? 'pedido' : 'pedidos'}` : '',
                kinds.online ? `${kinds.online} de la tienda en línea` : '',
                kinds.counter ? `${kinds.counter} de mostrador` : ''
            ].filter(Boolean).join(', ');
            const more  = data.more ? ` Se ven los ${count} más recientes: acorta el periodo para ver el resto.` : '';

            return { title, subtitle: `Por fecha de captura, ${period}${parts ? ` ${esc(parts)}.` : ''} El total es lo vendido: sin cotizaciones ni cancelados.${more}` };
        }

        const pending = Number(data.pending || 0);
        const state   = pending ? ` ${pending} sin cerrar.` : (count ? ' Todos cerrados.' : '');

        return { title, subtitle: `Días con turno o con cierre ${period}${state} Un día cerrado muestra las cifras de su cierre.` };
    }
}
