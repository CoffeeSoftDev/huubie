/*  Pedidos › Calendario (Etapa 4: producir y entregar).

    Como el de alpha: Mes, Semana y Día (galería con foto, agrupada por hora).
    Leyenda de estados con conteo, filtros de entrega y elaboración, y un
    buscador que salta al folio aunque esté en otra fecha. Clic en un pedido
    abre el mismo detalle que Pedidos (orderDetail), servido por ctrl-calendario.

    Producción y el Dueño palomean «ya se elaboró» en la esquina de la tarjeta;
    los demás solo ven la marca. Entregar, y cobrar antes si hay saldo, sale del detalle.
    Quien no ve Pedidos (Producción) ve solo pendientes y pagados.

    Vive en dos lugares:
      - calendario.php (calendario.js): página sola, para quien solo ve el calendario.
      - lista-pedidos.php (lista-pedidos.js): la vista «Calendario» del botón de la derecha,
        con embedded = true (sin franja de caja: ya la pintó Pedidos).
    info = el init de ctrl-calendario (acciones, producer, estados, hoy). */

// -- OrderCalendar --

class OrderCalendar extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Calendar';
        this.viewKey      = 'pro:calendario:view:v1';
        this.info         = {};      // init de ctrl-calendario
        this.embedded     = false;   // true dentro de Pedidos
        this.rows         = [];
        this.range        = '';
        this.force        = false;
        this.request      = 0;
        this.hidden       = new Set();
        this.busy         = new Set();
        this.term         = '';
        this.scrollToHit  = false;
        this.searchTimer  = null;
        this.all          = false;   // todas las sucursales: cada tarjeta dice de cuál es
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

        if (!this.embedded) this.header();

        if (this.info.status != 200) return this.blocked(this.info.message || 'No se pudo cargar el calendario. Recarga la página.');

        if (!(this.info.calendar || []).includes('show')) return this.blocked('Tu rol no tiene permiso para ver el calendario de esta sucursal.');

        this.filterBar();
        this.calendarView();
    }

    /*  La tarjeta llena el alto del módulo, como Pedidos: flex-1 del contenedor
        hasta la tarjeta. Sin min-h-0: un mes lleno crece y el único scroll
        sigue siendo el de la página. Sin título: la sucursal ya está en la barra. */
    layout() {
        this.createLayout({
            parent: this._div_modulo,
            design: false,
            data: {
                id:    `page${this.PROJECT_NAME}`,
                class: 'flex flex-1 flex-col',
                container: [
                    { type: 'div', id: `body${this.PROJECT_NAME}`, class: 'w-full flex flex-1 flex-col' }
                ]
            }
        });

        this.primaryLayout({
            parent: `body${this.PROJECT_NAME}`,
            id:     this.PROJECT_NAME,
            class:  'ord-card flex flex-1 flex-col',
            card: {
                name:      `card${this.PROJECT_NAME}`,
                class:     'flex flex-1 flex-col',
                filterBar: { class: 'w-full mb-[12px]' },
                container: { class: 'w-full flex flex-1 flex-col' }
            }
        });
    }

    // Una sola fila: los filtros a la izquierda y las píldoras de estado a la derecha.
    filterBar() {
        const col = 'col-12 col-sm-4';   // los tres filtros miden lo mismo y llenan su mitad de la fila

        this.createLayout({
            parent: `filterBar${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `bar${this.PROJECT_NAME}`,
                class: 'ord-cal-bar',
                container: [
                    { type: 'div', id: `filters${this.PROJECT_NAME}`, class: 'ord-cal-filters' },
                    { type: 'div', id: `legend${this.PROJECT_NAME}`, class: 'ord-cal-legends' }
                ]
            }
        });

        // Los cambios se enlazan abajo: con onchange en texto llamarían a la variable
        // global, que dentro de Pedidos es la lista y no el calendario.
        this.createfilterBar({
            parent:     `filters${this.PROJECT_NAME}`,
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
                    class:       col
                },
                {
                    opc:      'select',
                    id:       'delivery',
                    lbl:      'Entrega',
                    required: false,
                    class:    col,
                    data:     [{ id: '', valor: 'Todas' }, { id: 'pending', valor: 'Por entregar' }, { id: 'done', valor: 'Entregados' }]
                },
                {
                    opc:      'select',
                    id:       'produced',
                    lbl:      'Elaboración',
                    required: false,
                    class:    col,
                    data:     [{ id: '', valor: 'Todas' }, { id: 'todo', valor: 'Por elaborar' }, { id: 'done', valor: 'Elaborados' }]
                }
            ]
        });

        $('#cal_delivery, #cal_produced').on('change', () => this.onFilterChange());

        $('#cal_q')
            .attr({ maxlength: 60, autocomplete: 'off' })
            .on('input', () => this.onSearchInput())
            .on('keydown', (e) => this.onSearchKeydown(e));

        this.legend();
    }

    // Sin título ni subtítulo: solo enciende la franja de caja.
    header() {
        if (this.info.status != 200 || !this.can('show')) return;

        // Cobrar al entregar pide turno abierto: la franja de caja lo muestra arriba.
        orderTurn.paintStrip(true);
    }

    // El turno vive en la franja de caja (caja-strip.js). orderTurn.sync() la llama igual.
    paintTurn() {}

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
                class: 'flex flex-1 flex-col gap-[12px]',
                container: [
                    { type: 'div', id: `calendar${this.PROJECT_NAME}`, class: 'ord-cal' }
                ]
            }
        });

        this.calendar = new FullCalendar.Calendar(document.getElementById(`calendar${this.PROJECT_NAME}`), {
            initialView:    this.savedView(),
            initialDate:    this.info.today || new Date(),
            locale:         'es',
            headerToolbar:  { left: 'prev,next today', center: 'title', right: 'dayGridMonth,galeriaSemana,galeriaDia' },
            buttonText:     { today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' },
            plugins:        [this.galleryPlugin()],
            height:         'auto',
            stickyHeaderDates: false,
            dayMaxEvents:   3,
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
        this.hint();
    }

    // De Mes a Semana o Día FullCalendar no vuelve a pedir pedidos: el conteo se repinta aquí.
    onDatesSet(info) {
        this.saveView(info.view.type);
        this.paintCounts();
        this.afterSearch();
        this.hint();
    }

    /*  La instrucción de Producción va debajo del título del mes. La barra es de
        FullCalendar: si la vuelve a pintar, onDatesSet la repone; si sigue ahí, no la duplica. */
    hint() {
        if (!this.info.producer) return;

        const title = $(`#calendar${this.PROJECT_NAME} .fc-toolbar-title`);

        if (!title.length || title.next('.ord-cal-hint').length) return;

        title.after('<p class="ord-cal-hint"><i data-lucide="circle-check"></i>Toca el círculo de la tarjeta cuando termines de elaborar.</p>');
        title.parent().addClass('ord-cal-titlebox');

        if (window.lucide) lucide.createIcons({ root: title.parent()[0] });
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
            const data    = await useFetch({ url: this._link, data: { opc: 'getCalendar', fi, ff, all: this.all ? 1 : 0 } });

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
        el.setAttribute('style', this.tone(p.status));

        el.innerHTML = `
            <div class="ord-cal-ev-top">
                <span class="ord-cal-ev-hour">${p.hour ? ordHour(p.hour) : 'Sin hora'}</span>
                <span class="ord-cal-ev-short">${this.shortHour(p.hour)}</span>
                <span class="ord-cal-folio">${esc(p.folio)}</span>
            </div>
            <div class="ord-cal-ev-name">${esc(arg.event.title)}</div>
            ${this.branchLine(p, 'ord-cal-ev-branch')}
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

    // -- Vistas Semana y Día: galería --

    /*  Vistas propias de FullCalendar para conservar Hoy, las flechas y el
        titulo. Las dos pintan las mismas tarjetas: el Día las agrupa por hora
        y la Semana por día. Se vuelven a dibujar cada vez que cambian los eventos. */
    galleryPlugin() {
        this._gallery = this._gallery || FullCalendar.createPlugin({
            name: 'galeria',
            views: {
                galeriaSemana: {
                    duration:   { weeks: 1 },
                    buttonText: 'Semana',
                    content:    (props) => ({ domNodes: [this.galleryWeek(props)] })
                },
                galeriaDia: {
                    duration:   { days: 1 },
                    buttonText: 'Día',
                    content:    (props) => ({ domNodes: [this.galleryDay(props)] })
                }
            }
        });

        return this._gallery;
    }

    // Los pedidos de lo que se ve, por hora y nombre; sin hora al final. day = 'AAAA-MM-DD'.
    galleryList(props) {
        return FullCalendar.sliceEvents(props, true)
            .map((seg) => ({
                ...seg.def.extendedProps,
                id:    Number(seg.def.publicId),
                title: seg.def.title,
                day:   seg.range.start.toISOString().slice(0, 10)
            }))
            .sort((a, b) => (a.hour === '') - (b.hour === '') || String(a.hour).localeCompare(String(b.hour)) || a.title.localeCompare(b.title));
    }

    galleryDay(props) {
        const groups = this.groupBy(this.galleryList(props), (p) => p.hour || '');

        const sections = Object.keys(groups)
            .sort((a, b) => (a === '') - (b === '') || a.localeCompare(b))
            .map((hour) => ({ title: hour ? ordHour(hour) : 'Sin hora', items: groups[hour] }));

        return this.gallery(sections, 'Sin pedidos para este día.');
    }

    galleryWeek(props) {
        const groups = this.groupBy(this.galleryList(props), (p) => p.day);

        const sections = Object.keys(groups)
            .sort()
            .map((day) => ({ title: this.dayTitle(day), items: groups[day] }));

        return this.gallery(sections, 'Sin pedidos para esta semana.');
    }

    // Una sección por grupo (hora o día) con su rejilla de tarjetas.
    gallery(sections, empty) {
        const wrap = document.createElement('div');
        wrap.className = 'ord-cal-day';

        if (!sections.length) {
            wrap.innerHTML = `<p class="ord-cal-empty">${empty}</p>`;
            return wrap;
        }

        sections.forEach(({ title, items }) => {
            const section = document.createElement('section');
            const grid    = document.createElement('div');

            section.className = 'ord-cal-hour';
            section.innerHTML = `<p class="ord-cal-hour-title">${esc(title)} <span>· ${items.length} ${items.length === 1 ? 'pedido' : 'pedidos'}</span></p>`;
            grid.className    = 'ord-cal-grid';

            items.forEach((p) => grid.appendChild(this.galleryCard(p)));

            section.appendChild(grid);
            wrap.appendChild(section);
        });

        if (window.lucide) lucide.createIcons({ root: wrap });

        return wrap;
    }

    // «Lunes 16 de noviembre».
    dayTitle(day) {
        const text = new Date(`${day}T00:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');

        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    groupBy(list, key) {
        return list.reduce((groups, p) => ((groups[key(p)] = groups[key(p)] || []).push(p), groups), {});
    }

    /*  Como la tarjeta del catálogo del POS: franja arriba con la foto (o el
        pastel sobre el color del estado), nombre en dos líneas y pie con la
        hora y el estado. La casilla de elaborado va en la esquina de la franja. */
    galleryCard(p) {
        const card = document.createElement('article');
        const hit  = p.match === 1 ? ' is-match' : p.match === 0 ? ' is-dim' : '';
        const tag  = this.deliveryTag(p);

        card.className = 'ord-cal-card' + hit + (this.dimProduced(p) ? ' is-produced' : '');
        card.tabIndex  = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Ver el pedido ${p.folio} de ${p.title}`);
        card.setAttribute('style', this.tone(p.status));

        card.innerHTML = `
            <div class="ord-cal-photo">
                ${p.photo ? orderImg(p.photo, 'w-full h-full object-cover', p.title) : '<i data-lucide="cake"></i>'}
                ${this.produceMark(p)}
            </div>
            <div class="ord-cal-card-body">
                <p class="ord-cal-card-name">${esc(p.title)}</p>
                <p class="ord-cal-card-sub">${esc(p.folio)} · ${p.method === 1 ? 'Domicilio' : 'Recoge'}</p>
                ${this.branchLine(p, 'ord-cal-card-branch')}
                ${tag ?`<div class="ord-cal-card-tags">${tag}</div>` : ''}
                <div class="ord-cal-card-foot">
                    <b>${p.hour ? ordHour(p.hour) : 'Sin hora'}</b>
                    <span class="ord-cal-tag is-status">${esc(this.statusName(p.status))}</span>
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

    // Con «Todas las sucursales», de cuál es el pedido.
    branchLine(p, cls) {
        if (!this.all || !p.branch) return '';

        return `<p class="${cls}"><i data-lucide="house"></i><span>${esc(p.branch)}</span></p>`;
    }

    // -- Elaborado --

    /*  Produccion tiene la casilla (vacia o llena) y la cambia; los demas ven
        solo la marca llena de lo ya elaborado. Lo entregado ya no se palomea.
        El de otra sucursal tampoco: se palomea eligiendo esa sucursal. */
    produceMark(p) {
        const on  = !!p.produced;
        const can = this.info.producer && !p.foreign && [2, 3].includes(p.status) && p.delivery !== 1;
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
        return !!this.info.producer && !!p.produced && p.delivery !== 1;
    }

    async toggleProduced(id) {
        const row = this.rows.find((r) => r.id === id);

        if (!row || this.busy.has(id)) return;

        this.busy.add(id);

        const want = row.produced ? 0 : 1;
        const data = await useFetch({ url: this._link, data: { opc: 'toggleProduced', id, produced: want } });

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
            <button type="button" class="ord-cal-legend" data-status="${id}" aria-pressed="true" style="${this.tone(id)}">
                <span class="ord-cal-dot" aria-hidden="true"></span>${esc(this.statusName(id))}<b data-count-status="${id}">0</b>
            </button>`).join('');

        // El conteo va arriba, a la altura de las etiquetas de los filtros; las píldoras, a la de los campos.
        $(`#legend${this.PROJECT_NAME}`)
            .html(`<span id="total${this.PROJECT_NAME}" class="ord-cal-total"></span><div class="ord-cal-chips">${chips}</div>`)
            .off('click')
            .on('click', 'button.ord-cal-legend', (e) => this.toggleStatus(Number(e.currentTarget.dataset.status)));
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
        const where  = { dayGridMonth: 'el mes', galeriaSemana: 'la semana', galeriaDia: 'el día' }[view.type] || 'el periodo';

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

        const data = await useFetch({ url: this._link, data: { opc: 'locateOrder', q: this.term, all: this.all ? 1 : 0 } });

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
        return (this.info.actions || []).includes(action);
    }

    // Quien no ve Pedidos ve solo pendientes y pagados.
    statusIds() {
        return this.can('show') ? [1, 2, 3, 4] : [2, 3];
    }

    statusName(id) {
        const row = (this.info.statuses || []).find((s) => Number(s.id) === Number(id));

        return row ? row.valor : ({ 1: 'Cotización', 2: 'Pendiente', 3: 'Pagado', 4: 'Cancelado' }[id] || 'Sin estado');
    }

    /*  Colores del estado con la paleta de Huubie UI, como variables de la
        tarjeta. ev = punto de la leyenda en la página clara.
        pastel, stripe e ink = página clara, en contraste bajo: tarjeta casi
        blanca del color (tono 50), filo, franja y píldora en tono 200 y la
        letra en tono 700.
        Pendiente va con el color de su píldora de la leyenda (la tinta al 10 %
        y su filo al ~20 %): el amarillo 50 no se parecía al naranja de la píldora.
        hb = página oscura: el color de cada estado en Huubie, el mismo del
        calendario de alpha (ctrl-calendario), sólido con la letra en blanco. */
    tone(status) {
        const tones = {
            1: { ev: '#1C64F2', pastel: '#EBF5FF', stripe: '#C3DDFD', ink: '#1A56DB', hb: '#6E95C0' },
            2: { ev: '#B45309', pastel: '#F8EEE6', stripe: '#EFDBCB', ink: '#B45309', hb: '#FE6F00' },
            3: { ev: '#057A55', pastel: '#F3FAF7', stripe: '#BCF0DA', ink: '#046C4E', hb: '#0E9E6E' },
            4: { ev: '#EA0234', pastel: '#FDF2F2', stripe: '#FBD5D5', ink: '#C81E1E', hb: '#E60001' }
        };

        const t = tones[status] || { ev: '#6B7280', pastel: '#F9FAFB', stripe: '#E5E7EB', ink: '#374151', hb: '#6B7280' };

        return `--ev:${t.ev};--ev-pastel:${t.pastel};--ev-stripe:${t.stripe};--ev-ink:${t.ink};--ev-hb:${t.hb}`;
    }

    // Entregado, o el saldo que falta cobrar (solo a quien ve Pedidos). Una cotización todavía no debe.
    deliveryTag(p) {
        if (p.delivery === 1) return '<span class="ord-cal-tag is-done">Entregado</span>';

        if (this.can('show') && [2, 3].includes(p.status) && Number(p.balance) > 0.005) return `<span class="ord-cal-tag is-debt">Debe ${money(p.balance)}</span>`;

        return '';
    }

    // La Semana de antes (dayGridWeek) abre la nueva.
    savedView() {
        try {
            const view = localStorage.getItem(this.viewKey) === 'dayGridWeek' ? 'galeriaSemana' : localStorage.getItem(this.viewKey);
            return ['dayGridMonth', 'galeriaSemana', 'galeriaDia'].includes(view) ? view : 'dayGridMonth';
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
