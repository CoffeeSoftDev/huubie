/*  Pedidos › Calendario (Etapa 4: producir y entregar).

    Como el de alpha: Mes, Semana y Día (galería con foto, agrupada por hora).
    Leyenda de estados con conteo, filtros de entrega y elaboración, y un
    buscador que salta al folio aunque esté en otra fecha. Clic en un pedido
    abre el mismo detalle que Pedidos (orderDetail), servido por ctrl-calendario.

    Producción palomea «ya se elaboró» en la esquina de la tarjeta; los demás
    solo ven la marca. Entregar, y cobrar antes si hay saldo, sale del detalle.
    Quien no ve Pedidos (Producción) ve solo pendientes y pagados. */

let api = 'ctrl/ctrl-calendario.php';
let orders, orderDetail, orderTurn, orderPay, orderClosure;
let dataInit = {};

$(async () => {
    dataInit = (await useFetch({ url: api, data: { opc: 'init' } })) || {};

    orderDetail          = new OrderDetail(api, 'root');
    orderDetail.editable = false;
    orderTurn            = new OrderTurn('ctrl/ctrl-turno.php', 'root');
    orderPay             = new OrderPay('ctrl/ctrl-cobro.php', 'root');
    orderClosure         = new OrderClosure('ctrl/ctrl-cierre.php', 'root');
    orders               = new OrderCalendar(api, 'root');
    orders.init();
});

// -- OrderCalendar --

class OrderCalendar extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Calendar';
        this.viewKey      = 'pro:calendario:view:v1';
        this.rows         = [];
        this.range        = '';
        this.force        = false;
        this.request      = 0;
        this.hidden       = new Set();
        this.busy         = new Set();
        this.term         = '';
        this.scrollToHit  = false;
        this.searchTimer  = null;
    }

    get filters() {
        return {
            delivery: $('#cal_delivery').val() || '',
            produced: $('#cal_produced').val() || ''
        };
    }

    // -- Interface --

    init() {
        this.render();
    }

    render() {
        this.layout();
        this.header();

        if (dataInit.status != 200) return this.blocked(dataInit.message || 'No se pudo cargar el calendario. Recarga la página.');

        if (!(dataInit.calendar || []).includes('show')) return this.blocked('Tu rol no tiene permiso para ver el calendario de esta sucursal.');

        this.filterBar();
        this.calendarView();
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
                filterBar: { class: 'w-full mb-[12px]' },
                container: { class: 'w-full' }
            }
        });
    }

    filterBar() {
        this.createfilterBar({
            parent:     `filterBar${this.PROJECT_NAME}`,
            id:         `fb${this.PROJECT_NAME}`,
            prefijo:    'cal_',
            coffeesoft: true,
            data: [
                {
                    opc:         'input',
                    id:          'q',
                    lbl:         'Buscar',
                    type:        'search',
                    placeholder: 'Folio, cliente o teléfono',
                    required:    false,
                    class:       'col-12 col-md-5 col-xl-4'
                },
                {
                    opc:      'select',
                    id:       'delivery',
                    lbl:      'Entrega',
                    required: false,
                    class:    'col-6 col-md-3 col-xl-2',
                    data:     [{ id: '', valor: 'Todas' }, { id: 'pending', valor: 'Por entregar' }, { id: 'done', valor: 'Entregados' }],
                    onchange: 'orders.onFilterChange()'
                },
                {
                    opc:      'select',
                    id:       'produced',
                    lbl:      'Elaboración',
                    required: false,
                    class:    'col-6 col-md-4 col-xl-2',
                    data:     [{ id: '', valor: 'Todas' }, { id: 'todo', valor: 'Por elaborar' }, { id: 'done', valor: 'Elaborados' }],
                    onchange: 'orders.onFilterChange()'
                }
            ]
        });

        $('#cal_q')
            .attr({ maxlength: 60, autocomplete: 'off' })
            .on('input', () => this.onSearchInput())
            .on('keydown', (e) => this.onSearchKeydown(e));
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
                            { type: 'div', id: `headerActions${this.PROJECT_NAME}`, class: 'shrink-0' }
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
                    { type: 'h1', class: 'cp-pagina-titulo', text: 'Calendario' },
                    { type: 'p', class: 'cp-pagina-subtitulo', text: [scope.company, scope.branch].filter(Boolean).join(' · ') || 'Pedidos por fecha de entrega' }
                ]
            }
        });

        if (dataInit.status != 200 || !this.can('show')) return;

        this.paintTurn();
    }

    // Chip del turno: cobrar al entregar pide turno abierto. orderTurn.sync() lo repinta.
    paintTurn() {
        if (!$(`#headerActions${this.PROJECT_NAME}`).length || !this.can('show')) return;

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
            id:           'formHeaderCalendar',
            class:        'flex gap-[8px]',
            showRequired: false,
            json: [
                { opc: 'button', id: 'btnTurnCalendar', class: 'col-auto', text: 'Turno actual', icon: 'icon-clock', color_btn: 'outline', onClick: () => orderTurn.open() }
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

    // -- Calendario --

    calendarView() {
        this.createLayout({
            parent: `container${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `calendarWrap${this.PROJECT_NAME}`,
                class: 'flex flex-col gap-[12px]',
                container: [
                    { type: 'div', id: `legend${this.PROJECT_NAME}`, class: 'flex flex-wrap items-center gap-[8px]' },
                    { type: 'div', id: `calendar${this.PROJECT_NAME}`, class: 'ord-cal' }
                ]
            }
        });

        this.legend();

        this.calendar = new FullCalendar.Calendar(document.getElementById(`calendar${this.PROJECT_NAME}`), {
            initialView:    this.savedView(),
            initialDate:    dataInit.today || new Date(),
            locale:         'es',
            headerToolbar:  { left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek,galeriaDia' },
            buttonText:     { today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' },
            plugins:        [this.galleryPlugin()],
            height:         'auto',
            stickyHeaderDates: false,
            dayMaxEvents:   3,
            views:          { dayGridWeek: { dayMaxEvents: false } },
            moreLinkClick:  'popover',
            moreLinkContent: (arg) => `+${arg.num} más`,
            navLinks:       true,
            navLinkDayClick: (date) => this.calendar.changeView('galeriaDia', date),
            // Lo que coincide con el buscador va primero: con dayMaxEvents quedaria dentro del «+N».
            eventOrder:     '-match,hour,title',
            events:         (info, success) => this.source(info, success),
            eventContent:   (arg) => this.eventContent(arg),
            eventClick:     (info) => this.onEventClick(info),
            datesSet:       (info) => this.onDatesSet(info),
            loading:        (on) => $(`#calendar${this.PROJECT_NAME}`).toggleClass('is-loading', on)
        });

        this.calendar.render();
    }

    // De Mes a Semana o Día FullCalendar no vuelve a pedir pedidos: el conteo se repinta aquí.
    onDatesSet(info) {
        this.saveView(info.view.type);
        this.paintCounts();
        this.afterSearch();
    }

    /*  FullCalendar pide los pedidos de lo que se ve. Se guardan en rows y los
        filtros, la leyenda y el buscador trabajan sobre ellos sin volver a
        pedirlos: solo se vuelve al servidor al cambiar de fechas o con lsOrders(). */
    async source(info, success) {
        const fi  = moment(info.start).format('YYYY-MM-DD');
        const ff  = moment(info.end).subtract(1, 'day').format('YYYY-MM-DD');
        const key = `${fi}|${ff}`;

        if (this.force || key !== this.range) {
            const request = ++this.request;
            const data    = await useFetch({ url: api, data: { opc: 'getCalendar', fi, ff } });

            if (request !== this.request) return success([]);

            if (!data || data.status != 200) {
                alert({ icon: 'error', title: 'No se pudo cargar el calendario', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
                return success(this.visible());
            }

            this.rows  = (data.events || []).map((r) => ({ ...r, id: Number(r.id) }));
            this.range = key;
            this.force = false;
        }

        success(this.visible());

        this.paintCounts();
        this.afterSearch();
    }

    // Lo que pasa la leyenda y los filtros, con la marca del buscador.
    visible() {
        const f = this.filters;

        return this.rows
            .filter((r) => !this.hidden.has(r.status) && this.passFilters(r, f))
            .map((r) => {
                const match = this.term ? (this.matches(r) ? 1 : 0) : null;

                return {
                    ...r,
                    id:              String(r.id),
                    match:           match,
                    backgroundColor: 'transparent',
                    borderColor:     'transparent',
                    classNames:      ['ord-cal-event', match === 1 ? 'is-match' : match === 0 ? 'is-dim' : '']
                };
            });
    }

    passFilters(r, f) {
        if (f.delivery === 'pending' && r.delivery === 1) return false;
        if (f.delivery === 'done' && r.delivery !== 1)    return false;
        if (f.produced === 'todo' && r.produced)          return false;
        if (f.produced === 'done' && !r.produced)         return false;

        return true;
    }

    // Tarjeta del Mes y la Semana: hora y folio, cliente, entrega y la marca de elaborado.
    eventContent(arg) {
        const p  = { ...arg.event.extendedProps, id: Number(arg.event.id) };
        const el = document.createElement('div');

        el.className = 'ord-cal-ev' + (this.dimProduced(p) ? ' is-produced' : '');
        el.style.setProperty('--ev', this.color(p.status).line);
        el.style.setProperty('--ev-bg', this.color(p.status).bg);

        el.innerHTML = `
            <div class="ord-cal-ev-top">
                <span class="ord-cal-ev-hour">${p.hour ? ordHour(p.hour) : 'Sin hora'}</span>
                <span class="ord-cal-ev-short">${this.shortHour(p.hour)}</span>
                <span class="ord-cal-folio">${esc(p.folio)}</span>
            </div>
            <div class="ord-cal-ev-name">${esc(arg.event.title)}</div>
            <div class="ord-cal-ev-meta">
                <i data-lucide="${p.method === 1 ? 'truck' : 'store'}"></i>
                <span>${p.method === 1 ? 'Domicilio' : 'Recoge'}</span>
                ${this.deliveryTag(p)}
            </div>
            ${this.produceMark(p)}`;

        if (window.lucide) lucide.createIcons({ root: el });

        return { domNodes: [el] };
    }

    // «9:30a», «4p»: la hora que cabe en la rejilla del celular.
    shortHour(hour) {
        const m = String(hour || '').match(/^(\d{1,2}):(\d{2})/);

        if (!m) return 's/h';

        const h = Number(m[1]);

        return `${h % 12 || 12}${m[2] === '00' ? '' : ':' + m[2]}${h < 12 ? 'a' : 'p'}`;
    }

    // La casilla de la esquina palomea; el resto de la tarjeta abre el pedido.
    onEventClick(info) {
        info.jsEvent.preventDefault();

        const check = info.jsEvent.target.closest('button[data-produce]');

        if (check) return this.toggleProduced(Number(check.dataset.produce));

        orderDetail.show(Number(info.event.id));
    }

    // -- Vista Día: galería --

    /*  Vista propia de FullCalendar para conservar Hoy, las flechas y el titulo:
        los pedidos del dia agrupados por hora, con la foto grande arriba. Se
        vuelve a dibujar cada vez que cambian los eventos. */
    galleryPlugin() {
        this._gallery = this._gallery || FullCalendar.createPlugin({
            name: 'galeriaDia',
            views: {
                galeriaDia: {
                    duration:   { days: 1 },
                    buttonText: 'Día',
                    content:    (props) => ({ domNodes: [this.galleryDay(props)] })
                }
            }
        });

        return this._gallery;
    }

    galleryDay(props) {
        const list = FullCalendar.sliceEvents(props, true)
            .map((seg) => ({ ...seg.def.extendedProps, id: Number(seg.def.publicId), title: seg.def.title }))
            .sort((a, b) => String(a.hour).localeCompare(String(b.hour)) || a.title.localeCompare(b.title));

        const wrap = document.createElement('div');
        wrap.className = 'ord-cal-day';

        if (!list.length) {
            wrap.innerHTML = '<p class="ord-cal-empty">Sin pedidos para este día.</p>';
            return wrap;
        }

        const groups = {};
        list.forEach((p) => (groups[p.hour || ''] = groups[p.hour || ''] || []).push(p));

        // Sin hora va al final.
        Object.keys(groups)
            .sort((a, b) => (a === '') - (b === '') || a.localeCompare(b))
            .forEach((hour) => {
                const items   = groups[hour];
                const section = document.createElement('section');
                const grid    = document.createElement('div');

                section.className = 'ord-cal-hour';
                section.innerHTML = `<p class="ord-cal-hour-title">${hour ? ordHour(hour) : 'Sin hora'} <span>· ${items.length} ${items.length === 1 ? 'pedido' : 'pedidos'}</span></p>`;
                grid.className    = 'ord-cal-grid';

                items.forEach((p) => grid.appendChild(this.galleryCard(p)));

                section.appendChild(grid);
                wrap.appendChild(section);
            });

        if (window.lucide) lucide.createIcons({ root: wrap });

        return wrap;
    }

    galleryCard(p) {
        const c    = this.color(p.status);
        const card = document.createElement('article');
        const hit  = p.match === 1 ? ' is-match' : p.match === 0 ? ' is-dim' : '';

        card.className = 'ord-cal-card' + hit + (this.dimProduced(p) ? ' is-produced' : '');
        card.tabIndex  = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Ver el pedido ${p.folio} de ${p.title}`);
        card.style.setProperty('--ev', c.line);
        card.style.setProperty('--ev-bg', c.bg);

        card.innerHTML = `
            <div class="ord-cal-photo">
                ${p.photo ? orderImg(p.photo, 'w-full h-full object-cover', p.title) : '<i data-lucide="cake" class="w-8 h-8"></i>'}
                <span class="ord-cal-photo-hour">${p.hour ? ordHour(p.hour) : 'Sin hora'}</span>
                <span class="ord-cal-photo-dot" aria-hidden="true"></span>
                ${this.produceMark(p)}
            </div>
            <div class="ord-cal-card-body">
                <p class="ord-cal-card-name">${esc(p.title)}</p>
                <p class="ord-cal-card-sub">${esc(p.folio)} · ${p.method === 1 ? 'Domicilio' : 'Recoge'}</p>
                <div class="ord-cal-card-tags">
                    <span class="ord-cal-tag is-status">${esc(this.statusName(p.status))}</span>
                    ${this.deliveryTag(p)}
                </div>
            </div>`;

        card.addEventListener('click', (e) => {
            const check = e.target.closest('button[data-produce]');

            if (check) return this.toggleProduced(p.id);

            orderDetail.show(p.id);
        });

        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target === card) orderDetail.show(p.id);
        });

        return card;
    }

    // -- Elaborado --

    /*  Produccion tiene la casilla (vacia o llena) y la cambia; los demas ven
        solo la marca llena de lo ya elaborado. Lo entregado ya no se palomea. */
    produceMark(p) {
        const on  = !!p.produced;
        const can = dataInit.producer && [2, 3].includes(p.status) && p.delivery !== 1;
        const at  = p.producedAt ? ordDate(p.producedAt, true) : '';

        if (can) {
            const label = on ? `Elaborado el ${at}. Toca para quitar la marca.` : 'Toca aquí cuando termines de elaborar este pedido.';

            return `<button type="button" class="ord-cal-check${on ? ' is-on' : ''}" data-produce="${Number(p.id)}" aria-label="${esc(label)}" aria-pressed="${on}">
                        <i data-lucide="check"></i>
                    </button>`;
        }

        if (!on) return '';

        return `<span class="ord-cal-check is-on is-static" role="img" aria-label="${esc(`Producción lo elaboró el ${at}.`)}"><i data-lucide="check"></i></span>`;
    }

    // Produccion apaga lo que ya elaboro: de un vistazo ve lo que le falta.
    dimProduced(p) {
        return !!dataInit.producer && !!p.produced && p.delivery !== 1;
    }

    async toggleProduced(id) {
        const row = this.rows.find((r) => r.id === id);

        if (!row || this.busy.has(id)) return;

        this.busy.add(id);

        const want = row.produced ? 0 : 1;
        const data = await useFetch({ url: api, data: { opc: 'toggleProduced', id, produced: want } });

        this.busy.delete(id);

        if (!data || data.status != 200) {
            alert({
                icon:     data && data.status && data.status < 500 ? 'info' : 'error',
                title:    'No se cambió la marca',
                text:     (data && data.message) || 'Revisa la conexión y vuelve a intentar.',
                btn1:     true,
                btn1Text: 'Entendido'
            });
            return;
        }

        row.produced   = Number(data.produced);
        row.producedAt = data.produced_at || '';

        this.redraw();
    }

    // -- Leyenda --

    legend() {
        const chips = this.statusIds().map((id) => `
            <button type="button" class="ord-cal-legend" data-status="${id}" aria-pressed="true" style="--ev:${this.color(id).line}">
                <span class="ord-cal-dot" aria-hidden="true"></span>${esc(this.statusName(id))}<b data-count-status="${id}">0</b>
            </button>`).join('');

        const hint = dataInit.producer
            ? '<span class="ord-cal-hint"><i data-lucide="circle-check"></i>Toca el círculo de la tarjeta cuando termines de elaborar.</span>'
            : '';

        $(`#legend${this.PROJECT_NAME}`)
            .html(`${chips}<span id="total${this.PROJECT_NAME}" class="ord-cal-total"></span>${hint}`)
            .off('click')
            .on('click', 'button.ord-cal-legend', (e) => this.toggleStatus(Number(e.currentTarget.dataset.status)));

        if (window.lucide) lucide.createIcons({ root: document.getElementById(`legend${this.PROJECT_NAME}`) });
    }

    toggleStatus(id) {
        if (this.hidden.has(id)) this.hidden.delete(id);
        else this.hidden.add(id);

        $(`button.ord-cal-legend[data-status="${id}"]`)
            .toggleClass('is-off', this.hidden.has(id))
            .attr('aria-pressed', String(!this.hidden.has(id)));

        this.redraw();
    }

    // Lo del periodo que se ve (sin los dias de relleno del mes), con los filtros.
    paintCounts() {
        if (!this.calendar) return;

        const view   = this.calendar.view;
        const from   = moment(view.currentStart).format('YYYY-MM-DD');
        const to     = moment(view.currentEnd).format('YYYY-MM-DD');
        const f      = this.filters;
        const period = this.rows.filter((r) => r.start >= from && r.start < to && this.passFilters(r, f));
        const shown  = period.filter((r) => !this.hidden.has(r.status));
        const where  = { dayGridMonth: 'el mes', dayGridWeek: 'la semana', galeriaDia: 'el día' }[view.type] || 'el periodo';

        this.statusIds().forEach((id) => $(`[data-count-status="${id}"]`).text(period.filter((r) => r.status === id).length));

        let text = `${shown.length} ${shown.length === 1 ? 'pedido' : 'pedidos'} en ${where}`;

        if (this.term) {
            const hits = this.onScreen().filter((r) => this.matches(r)).length;

            text = hits
                ? `${hits} ${hits === 1 ? 'coincidencia' : 'coincidencias'} a la vista`
                : 'Sin coincidencias a la vista. Enter busca el folio en otras fechas.';
        }

        $(`#total${this.PROJECT_NAME}`).text(text);
    }

    // Lo que está dibujado: el Mes incluye sus días de relleno; pasa leyenda y filtros.
    onScreen() {
        if (!this.calendar) return [];

        const view = this.calendar.view;
        const from = moment(view.activeStart).format('YYYY-MM-DD');
        const to   = moment(view.activeEnd).format('YYYY-MM-DD');
        const f    = this.filters;

        return this.rows.filter((r) => r.start >= from && r.start < to && !this.hidden.has(r.status) && this.passFilters(r, f));
    }

    // -- Buscador --

    onSearchInput() {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.search(false), 250);
    }

    onSearchKeydown(e) {
        if (e.key !== 'Enter') return;

        e.preventDefault();
        clearTimeout(this.searchTimer);
        this.search(true);
    }

    /*  Marca lo que coincide en lo cargado. Con Enter y sin coincidencias, un
        folio se busca en todas las fechas (locateOrder) y el calendario salta
        a su dia de entrega. */
    async search(enter) {
        this.term        = this.normalize($('#cal_q').val());
        this.scrollToHit = !!this.term;

        this.redraw();

        if (!enter || !this.term || !/^p?\d+$/.test(this.term)) return;

        if (this.onScreen().some((r) => this.matches(r))) return;

        const data = await useFetch({ url: api, data: { opc: 'locateOrder', q: this.term } });

        if (!data || data.status != 200) {
            alert({ icon: 'info', title: 'Folio no encontrado', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        const view = this.calendar.view;
        const seen = data.date >= moment(view.activeStart).format('YYYY-MM-DD') && data.date < moment(view.activeEnd).format('YYYY-MM-DD');

        // Su fecha ya está en pantalla y no se ve: es nuevo (se recarga) o lo tapan la leyenda o los filtros.
        if (seen && !this.rows.some((r) => r.id === Number(data.id))) {
            this.scrollToHit = true;
            return this.lsOrders();
        }

        if (seen) {
            alert({ icon: 'info', title: `P${data.id} está oculto`, text: `Se entrega el ${ordDate(data.date)}, pero lo ocultan la leyenda o los filtros.`, btn1: true, btn1Text: 'Entendido' });
            return;
        }

        this.scrollToHit = true;
        this.calendar.gotoDate(data.date);
    }

    // Lleva la pantalla a la primera coincidencia, una vez por busqueda.
    afterSearch() {
        if (!this.scrollToHit) return;

        this.scrollToHit = false;

        setTimeout(() => {
            const el = document.querySelector(`#calendar${this.PROJECT_NAME} .is-match`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    }

    matches(r) {
        return [r.folio, r.title, r.phone].some((v) => this.normalize(v).includes(this.term));
    }

    // Minusculas y sin acentos: «maria» encuentra «María».
    normalize(value) {
        return String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
    }

    // -- Complements --

    // Repinta con lo cargado; lsOrders() es el que vuelve al servidor.
    redraw() {
        if (this.calendar) this.calendar.refetchEvents();
    }

    // Los modales (cobro, entrega, turno) lo llaman al guardar.
    lsOrders() {
        this.force = true;
        this.redraw();
    }

    onFilterChange() {
        this.redraw();
    }

    onBranchChange() {
        location.reload();
    }

    can(action) {
        return (dataInit.actions || []).includes(action);
    }

    // Quien no ve Pedidos ve solo pendientes y pagados.
    statusIds() {
        return this.can('show') ? [1, 2, 3, 4] : [2, 3];
    }

    statusName(id) {
        const row = (dataInit.statuses || []).find((s) => Number(s.id) === Number(id));

        return row ? row.valor : ({ 1: 'Cotización', 2: 'Pendiente', 3: 'Pagado', 4: 'Cancelado' }[id] || 'Sin estado');
    }

    // Mismos tonos que las insignias del detalle.
    color(status) {
        const colors = {
            1: { line: '#2A55A3', bg: '#EAF0FA' },
            2: { line: '#D97706', bg: '#FFF6E5' },
            3: { line: '#059669', bg: '#E7F6EF' },
            4: { line: '#DC2626', bg: '#FDECEC' }
        };

        return colors[status] || { line: '#78716C', bg: '#F5F5F4' };
    }

    // Entregado, o el saldo que falta cobrar (solo a quien ve Pedidos). Una cotización todavía no debe.
    deliveryTag(p) {
        if (p.delivery === 1) return '<span class="ord-cal-tag is-done">Entregado</span>';

        if (this.can('show') && [2, 3].includes(p.status) && Number(p.balance) > 0.005) return `<span class="ord-cal-tag is-debt">Debe ${money(p.balance)}</span>`;

        return '';
    }

    savedView() {
        try {
            const view = localStorage.getItem(this.viewKey);
            return ['dayGridMonth', 'dayGridWeek', 'galeriaDia'].includes(view) ? view : 'dayGridMonth';
        } catch (e) {
            return 'dayGridMonth';
        }
    }

    saveView(view) {
        try {
            localStorage.setItem(this.viewKey, view);
        } catch (e) {
            // Sin almacenamiento arranca en el mes.
        }
    }
}
