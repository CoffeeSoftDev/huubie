/*  POS › Tickets/Cierre (sección pos-tickets): visor de turnos, de cierres
    del día y de tickets (como alpha/order-visor).

    El mismo visor de alpha: arriba Ver, Periodo y Sucursal (la barra de la
    página no lleva selector: cortes.php › $noBranch). Abajo dos paneles con
    una agarradera en medio que los ajusta (doble clic la regresa): a la
    izquierda la lista del periodo (buscador, columnas y el total al pie); a
    la derecha la vista previa del papel tal como se imprime.

    Cambiar de sucursal es como elegirla en la barra (ctrl-nav › switchBranch),
    pero sin recargar: se pide el init de la otra y se repinta la lista.

    Turnos: el corte (orderTurn.cutTicket) en modo Resumido o
    Detallado. Cierres del día: el Corte Z en hoja carta, Concentrado o
    Detallado (orderClosure.paintReport); un clic en un pedido abre su ticket con
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
    // visor = 1: trae las sucursales del selector (las que el rol ve en pos-tickets).
    dataInit = (await useFetch({ url: api, data: { opc: 'init', visor: 1 } })) || {};

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
        this.widthKey       = 'pro:cortes:lista:v1';
        this.listWidth      = 540;    // ancho de la lista (agarradera); doble clic lo regresa aquí
        // Panel de la lista por vista: título y columnas (como alpha/order-visor › columnsFor).
        this.columns        = {
            turns:   { title: 'Turnos',          grid: 'minmax(0, 1fr) 128px 54px 104px', cols: ['Folio', 'Horario', 'Tickets', 'Vendido'] },
            days:    { title: 'Cierres del día', grid: 'minmax(0, 1fr) 58px 58px 108px',  cols: ['Folio', 'Turnos', 'Tickets', 'Vendido'] },
            tickets: { title: 'Tickets',         grid: 'minmax(0, 1fr) 62px 92px 108px',  cols: ['Folio', 'Hora', 'Pagado', 'Total'] }
        };
        // Los rangos del selector de alpha/order-visor.
        this.ranges         = { today: 'Hoy', last7: 'Últimos 7 días', month: 'Mes actual', lastMonth: 'Mes anterior' };
        this.period         = 'day';  // 'day' = Fecha, 'range' = Rango (filterBar › periodBox)
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
            ...getDataRangePicker(this.period === 'range' ? 'cut_calendar' : 'cut_day')
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

    // Como alpha/order-visor: los filtros sobre la página y, abajo, los dos paneles del visor.
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

        this.createLayout({
            parent: `body${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    this.PROJECT_NAME,
                class: 'flex flex-1 flex-col',
                container: [
                    { type: 'div', id: `filterBar${this.PROJECT_NAME}`, class: 'w-full mb-[14px]' },
                    { type: 'div', id: `container${this.PROJECT_NAME}`, class: 'w-full' }
                ]
            }
        });
    }

    // Ver, Periodo y Sucursal (alpha: Tipo de reporte, Período de consulta y Sucursal).
    filterBar() {
        const saved  = this.savedRange();
        const visor  = dataInit.visor || {};
        const places = visor.branches || [];

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
                    class:    'col-12 col-sm-6 col-lg-3 col-xl-2',
                    data:     [{ id: 'turns', valor: 'Turnos de caja' }, { id: 'days', valor: 'Cierres del día' }, { id: 'tickets', valor: 'Tickets' }],
                    value:    saved.view,
                    onchange: 'orders.onFilterChange()'
                },
                {
                    opc:      'div',
                    id:       'cutPeriodWrap',
                    lbl:      'Periodo',
                    required: false,
                    class:    'col-12 col-sm-6 col-lg-5 col-xl-4'
                },
                {
                    opc:      'select',
                    id:       'branch',
                    lbl:      'Sucursal',
                    required: false,
                    class:    'col-12 col-sm-6 col-lg-3 col-xl-2',
                    data:     places,
                    value:    String(visor.branch_id || ''),
                    onchange: 'orders.changeBranch()'
                }
            ]
        });

        // Con una sola sucursal se ve cuál es, pero no hay a dónde cambiar.
        $('#cut_branch').prop('disabled', places.length < 2);

        this.periodBox(saved);
    }

    /*  El periodo como en alpha/order-visor: en una sola caja, Fecha o Rango
        (radios), la fecha o el rango y el ícono de calendario. Cada modo tiene
        su calendario; solo se ve el del modo elegido. */
    periodBox(saved) {
        const locale = {
            format:           'DD/MM/YYYY',
            separator:        ' - ',
            firstDay:         1,
            customRangeLabel: 'Personalizado',
            daysOfWeek:       ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
            monthNames:       this.months
        };

        this.period = saved.mode;

        $('#cutPeriodWrap').html(`
            <div class="ord-cutper">
                <label class="ord-cutper-opt"><input type="radio" name="cutPeriod" value="day"> Fecha</label>
                <label class="ord-cutper-opt"><input type="radio" name="cutPeriod" value="range"> Rango</label>
                <span class="ord-cutper-sep"></span>
                <input type="text" id="cut_day" readonly>
                <input type="text" id="cut_calendar" readonly>
                <i data-lucide="calendar" class="ord-cutper-ico"></i>
            </div>`);

        $(`input[name="cutPeriod"][value="${this.period}"]`).prop('checked', true);
        $('input[name="cutPeriod"]').on('change', (e) => this.setPeriod(e.target.value));

        if (window.lucide) lucide.createIcons({ root: $('#cutPeriodWrap')[0] });

        dataPicker({
            parent: 'cut_day',
            type:   'simple',
            rangeDefault: {
                singleDatePicker: true,
                startDate:        this.rangeDates('today')[0],
                showDropdowns:    true,
                autoApply:        true,
                locale:           locale
            },
            onSelect: () => this.onFilterChange()
        });

        dataPicker({
            parent: 'cut_calendar',
            type:   'all',
            rangepicker: {
                startDate:     saved.dates[0],
                endDate:       saved.dates[1],
                showDropdowns: true,
                autoApply:     true,
                locale:        locale,
                ranges:        Object.fromEntries(Object.entries(this.ranges).map(([range, label]) => [label, this.rangeDates(range)]))
            },
            onSelect: () => this.onFilterChange()
        });

        this.paintPeriod();
    }

    // Solo se ve el calendario del modo elegido.
    paintPeriod() {
        $('#cut_day').toggle(this.period === 'day');
        $('#cut_calendar').toggle(this.period === 'range');
    }

    setPeriod(mode) {
        this.period = mode === 'range' ? 'range' : 'day';

        this.paintPeriod();
        this.onFilterChange();
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

    /*  Esqueleto del visor (alpha/order-visor › renderBody): el panel de la
        lista (encabezado con buscador, columnas, renglones y el total al pie),
        la agarradera y el panel de la vista previa (barra y papel). */
    viewer() {
        this.createLayout({
            parent: `container${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `viewer${this.PROJECT_NAME}`,
                class: 'ord-vis',
                container: [
                    {
                        type:  'div',
                        id:    `listPanel${this.PROJECT_NAME}`,
                        class: 'ord-vis-panel ord-vis-list',
                        children: [
                            { type: 'div', id: `listHead${this.PROJECT_NAME}`, class: 'ord-vis-head' },
                            { type: 'div', id: `listCols${this.PROJECT_NAME}`, class: 'ord-vis-cols' },
                            { type: 'div', id: `list${this.PROJECT_NAME}`, class: 'ord-vis-rows', 'aria-label': 'Lista de cortes' },
                            { type: 'div', id: `listFoot${this.PROJECT_NAME}`, class: 'ord-vis-foot' }
                        ]
                    },
                    {
                        type:  'div',
                        id:    `split${this.PROJECT_NAME}`,
                        class: 'ord-vis-split',
                        children: [{ type: 'span', class: 'ord-vis-grip' }]
                    },
                    {
                        type:  'div',
                        class: 'ord-vis-panel ord-vis-main',
                        children: [
                            { type: 'div', id: `bar${this.PROJECT_NAME}`, class: 'ord-vis-head ord-vis-bar' },
                            { type: 'div', id: `paper${this.PROJECT_NAME}`, class: 'ord-viewer-desk ord-vis-paper' }
                        ]
                    }
                ]
            }
        });

        this.listHead();
        this.initSplitter();

        $(`#list${this.PROJECT_NAME}`)
            .on('click', 'button.ord-vrow', (e) => this.select(String($(e.currentTarget).attr('data-key')), true))
            .on('keydown', 'button.ord-vrow', (e) => this.step(e));

        $(`#bar${this.PROJECT_NAME}`).on('click', 'button.ord-seg', (e) => this.setMode(String($(e.currentTarget).attr('data-mode'))));
    }

    // Encabezado del panel de la lista: ícono, título de la vista, cuántos hay y el buscador.
    listHead() {
        this.createLayout({
            parent: `listHead${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `listHeadBody${this.PROJECT_NAME}`,
                class: 'flex flex-col gap-[8px]',
                container: [
                    {
                        type:  'div',
                        class: 'ord-vis-head-row',
                        children: [
                            { type: 'i', 'data-lucide': 'file-text', class: 'ord-vis-ico' },
                            { type: 'span', id: `listTitle${this.PROJECT_NAME}`, class: 'ord-vis-title', text: this.columns[this.filters.view].title },
                            { type: 'span', id: `listCount${this.PROJECT_NAME}`, class: 'ord-vis-count', text: '' }
                        ]
                    },
                    {
                        type:  'div',
                        class: 'ord-vis-search',
                        children: [
                            { type: 'i', 'data-lucide': 'search', class: 'ord-vis-search-ico' },
                            { type: 'input', id: 'cut_search', placeholder: 'Buscar por folio, cliente, persona o fecha…', autocomplete: 'off', 'aria-label': 'Buscar en la lista' }
                        ]
                    },
                    { type: 'p', id: `listNote${this.PROJECT_NAME}`, class: 'ord-vis-note' }
                ]
            }
        });

        // createLayout usa «type» para la etiqueta: el campo se vuelve de búsqueda aquí.
        // 'input' también avisa cuando se borra con la ✕ del campo.
        $('#cut_search').attr('type', 'search').on('input', () => this.filterList());

        if (window.lucide) lucide.createIcons({ root: document.getElementById(`listHead${this.PROJECT_NAME}`) });
    }

    // La agarradera entre los paneles (alpha › initSplitter): arrastrar ajusta la lista; doble clic la regresa.
    initSplitter() {
        const MIN_LIST    = 340;
        const MIN_PREVIEW = 420;
        const panel       = $(`#listPanel${this.PROJECT_NAME}`);
        const apply       = (width) => {
            this.listWidth = Math.round(width);
            panel.css('--ord-vis-list', `${this.listWidth}px`);
        };

        apply(this.savedWidth());

        $(`#split${this.PROJECT_NAME}`)
            .attr({ role: 'separator', 'aria-orientation': 'vertical', title: 'Arrastra para ajustar la vista previa · doble clic la regresa' })
            .off('mousedown dblclick')
            .on('dblclick', () => {
                apply(540);
                this.saveWidth();
            })
            .on('mousedown', (e) => {
                e.preventDefault();

                const startX = e.clientX;
                const startW = panel.outerWidth();
                const maxW   = Math.max($(`#viewer${this.PROJECT_NAME}`).width() - MIN_PREVIEW, MIN_LIST);

                // Sin seleccionar texto mientras se arrastra.
                $('body').css({ 'user-select': 'none', cursor: 'col-resize' });

                $(document)
                    .on('mousemove.ordVisSplit', (ev) => apply(Math.min(Math.max(startW + (ev.clientX - startX), MIN_LIST), maxW)))
                    .on('mouseup.ordVisSplit', () => {
                        $(document).off('.ordVisSplit');
                        $('body').css({ 'user-select': '', cursor: '' });
                        this.saveWidth();
                    });
            });
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

    // Título de la vista, la nota del periodo y las columnas (alpha › columnsFor).
    paintHead(filters) {
        const caption = this.caption(this.data, filters);
        const look    = this.columns[this.view];

        $(`#listTitle${this.PROJECT_NAME}`).text(look.title);
        $(`#listNote${this.PROJECT_NAME}`).html(caption.subtitle);

        $(`#listCols${this.PROJECT_NAME}`)
            .css('grid-template-columns', look.grid)
            .html(look.cols.map((col, i) => `<span${i ? ' class="text-right"' : ''}>${col}</span>`).join(''));
    }

    // Los renglones (agrupados por día; los cierres, por mes), cuántos hay y el total al pie. Todo con la búsqueda aplicada.
    paintList() {
        const items = this.visible();
        const list  = $(`#list${this.PROJECT_NAME}`);
        const total = items.reduce((sum, item) => sum + Number(item.sold || 0), 0);

        $(`#listCount${this.PROJECT_NAME}`).text(`${items.length} ${items.length === 1 ? 'resultado' : 'resultados'}`);

        $(`#listFoot${this.PROJECT_NAME}`).html(`<span>Vendido ${this.items.length && items.length < this.items.length ? 'en la búsqueda' : 'del periodo'}</span><strong>${money(total)}</strong>`);

        if (!items.length) {
            const text = this.items.length ? 'Nada coincide con la búsqueda.' : `No hay ${this.views[this.view].many} en este periodo.`;

            list.html(`<div class="ord-viewer-empty"><i class="icon-search"></i><p>${text}</p></div>`);
            return;
        }

        list.html(this.groups(items).map((group) => `
            <div class="ord-vgroup2">
                <p class="ord-vgroup2-title"><i data-lucide="calendar" class="w-3 h-3"></i><span>${esc(group.title)}</span><span>${money(group.total)}</span></p>
                ${group.items.map((item) => this.view === 'turns' ? this.turnItem(item) : this.view === 'days' ? this.dayItem(item) : this.ticketItem(item)).join('')}
            </div>`).join(''));

        if (window.lucide) lucide.createIcons({ root: list[0] });

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

    // Folio · Horario (con lo que duró, o ABIERTO) · Tickets · Vendido (alpha › fetchTurnos).
    turnItem(t) {
        // Cerró otro día: la fecha corta (21/11); lo que duró va abajo.
        const end  = !t.closed ? '—' : t.closed_at && String(t.closed_at).slice(0, 10) === t.day ? this.hour(t.closed_at) : ordDate(t.closed_at).slice(0, 5);
        const tags = [
            t.closed && t.difference !== null ? this.diffTag(t.difference) : '',
            t.changed ? this.tag('changed', 'Cambió') : '',
            t.reopened ? this.tag('info', 'Reabierto') : '',
            t.day_closed ? this.tag('muted', 'Día cerrado') : ''
        ];

        return this.itemShell(t, {
            dot:   t.closed ? 'is-closed' : 'is-open',
            title: `Turno ${esc(t.folio)}`,
            sub:   [esc(t.opened_by) || 'Sin cajero', ordDate(t.day)].join(' · '),
            tags:  tags,
            cells: [
                [`${this.hour(t.opened_at)} → ${end}`, t.closed ? this.lasted(t.opened_at, t.closed_at) : 'Abierto', t.closed ? 'plain' : 'hot'],
                [String(t.tickets || 0), 'Tickets']
            ]
        });
    }

    // Folio del cierre (o SIN CIERRE) · Turnos · Tickets · Vendido (alpha › fetchCierres).
    dayItem(d) {
        const today = d.date === dataInit.today;
        const open  = d.open_turns ? `${d.open_turns} ${d.open_turns === 1 ? 'abierto' : 'abiertos'}` : '';
        const tags  = [
            d.difference !== null ? this.diffTag(d.difference) : '',
            d.changed ? this.tag('changed', 'Cambió') : ''
        ];

        return this.itemShell(d, {
            dot:   d.closed ? 'is-closed' : today ? 'is-open' : 'is-wait',
            title: d.closed ? `Cierre ${esc(d.folio)}` : today ? 'Hoy, sin cerrar' : 'Sin cierre',
            hour:  d.closed ? this.hour(d.closed_at) : '',
            sub:   [`${this.weekday(d.date)} ${ordDate(d.date)}`, esc(d.closed_by)].filter(Boolean).join(' · '),
            tags:  tags,
            cells: [
                [String(d.turns || 0), open || 'Turnos', open ? 'hot' : ''],
                [String(d.tickets || 0), 'Tickets']
            ]
        });
    }

    // Folio (punto con el color del estado) · Hora · Pagado · Total (alpha › fetchTickets).
    ticketItem(t) {
        const status  = Number(t.status_id);
        const who     = t.customer || (t.kind === 'counter' ? 'Público en general' : 'Sin cliente');
        const balance = status === 2 && Number(t.balance) > 0.005 ? this.tag('pending', `Saldo ${money(t.balance)}`) : '';

        return this.itemShell(t, {
            dot:   `is-st${status}`,
            title: esc(t.folio),
            sub:   [esc(who), esc(t.status), this.kinds[t.kind] || 'Pedido'].join(' · '),
            tags:  [balance],
            cells: [
                [this.hour(t.created_at) || '—', ''],
                [money(t.paid), 'Abono']
            ]
        });
    }

    /*  Un renglón de la lista en la rejilla de su vista (this.columns): el folio
        con su punto, la hora y debajo quién y cuándo (y sus etiquetas); luego las
        celdas [valor, nota, tono] y al final el importe. Tono de la nota: 'hot'
        (resaltada: abierto) o 'plain' (sin mayúsculas: lo que duró). amount: el
        importe (sin él, lo vendido); struck: tachado (cancelado); changed: la
        nota del importe dice cuánto da hoy. */
    itemShell(item, row) {
        const shown  = (row.tags || []).filter(Boolean);
        const amount = item.amount !== undefined ? item.amount : item.sold;
        const cell   = ([value, note, tone]) => `
                <span class="ord-vrow-num">
                    <span class="ord-vrow-val">${value}</span>
                    ${note ? `<span class="ord-vrow-cap${tone ? ` is-${tone}` : ''}">${note}</span>` : ''}
                </span>`;

        return `
            <button type="button" class="ord-vrow" data-key="${esc(item.key)}" style="grid-template-columns: ${this.columns[this.view].grid}">
                <span class="ord-vrow-main">
                    <span class="ord-vrow-line">
                        <span class="ord-vrow-dot ${row.dot}"></span>
                        <span class="ord-vrow-folio">${row.title}</span>
                        ${row.hour ? `<span class="ord-vrow-hour">${row.hour}</span>` : ''}
                    </span>
                    <span class="ord-vrow-sub">${row.sub}</span>
                    ${shown.length ? `<span class="ord-vrow-tags">${shown.join('')}</span>` : ''}
                </span>
                ${row.cells.map(cell).join('')}
                <span class="ord-vrow-num">
                    <span class="ord-vrow-val ord-vrow-money${item.struck ? ' is-off' : Number(amount) > 0.005 ? '' : ' is-zero'}">${money(amount)}</span>
                    <span class="ord-vrow-cap${item.changed ? ' is-hot' : ''}">${item.changed ? `hoy ${money(item.live)}` : 'MXN'}</span>
                </span>
            </button>`;
    }

    // Lo que duró un turno cerrado: «3h 05m» (alpha › formatDuracion).
    lasted(from, to) {
        const mins = Math.max(0, Math.round((moment(to) - moment(from)) / 60000));

        return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
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
        $(`#list${this.PROJECT_NAME} button.ord-vrow`).removeClass('is-active').removeAttr('aria-current');
        $(`#list${this.PROJECT_NAME} button.ord-vrow[data-key="${this.selected}"]`).addClass('is-active').attr('aria-current', 'true');
    }

    // Flechas arriba y abajo recorren la lista sin soltar el teclado.
    step(e) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

        e.preventDefault();

        const buttons = $(`#list${this.PROJECT_NAME} button.ord-vrow`);
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

        // Día sin cerrar y sin 'ver-corte-z' (como alpha): el Corte Z llega hasta cerrarlo.
        if (view === 'days' && data.hidden) {
            this.current = null;
            this.paintBar();
            this.paintPaper(data.hidden_reason);
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

        // El mismo modo para turnos y cierres; en el Corte Z el corto se llama Concentrado (como en Soft).
        const modes = ['summary', 'detail'].map((mode) => {
            const active = this.mode === mode;
            const text   = mode === 'detail' ? 'Detallado' : this.view === 'days' ? 'Concentrado' : 'Resumido';

            return `<button type="button" class="ord-seg${active ? ' is-active' : ''}" data-mode="${mode}" aria-pressed="${active}">${text}</button>`;
        }).join('');

        // Como alpha: «Vista previa de impresión» a la izquierda y los modos a la derecha. Abajo, qué papel es.
        this.createLayout({
            parent: `bar${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `barBody${this.PROJECT_NAME}`,
                class: 'ord-vis-bar-body',
                container: [
                    {
                        type:  'div',
                        class: 'min-w-0',
                        children: [
                            { type: 'p', class: 'ord-vis-eyebrow', text: 'Vista previa de impresión' },
                            { type: 'p', class: 'ord-vis-bar-title', html: `<b>${esc(title)}</b>${sub ? `<span> · ${esc(sub)}</span>` : ''}` }
                        ]
                    },
                    {
                        type:  'div',
                        class: 'ord-viewer-tools',
                        children: [
                            { type: 'div', class: 'ord-viewer-modes', html: data && !tickets ? modes : '' },
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

            return orderClosure.paintReport(paper, this.current, (id) => this.openOver(id), this.mode);
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

        // Turnos (Resumido | Detallado) y cierres (Concentrado | Detallado); con un ticket abierto encima del Corte Z, se queda el ticket.
        if (this.current && (this.view === 'turns' || (this.view === 'days' && !this.over))) this.paintPaper();
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

        if (this.view === 'days') return orderClosure.printDay(this.current, this.mode);

        orderTurn.printCut(this.current, this.mode === 'detail' ? this.current.detail : null);
    }

    // -- Sucursal --

    /*  El selector de la barra de filtros (alpha › reportSucursal). Cambia la
        sesión como la barra de arriba (ctrl-nav › switchBranch), sin recargar:
        se pide el init de la otra sucursal y se repintan el encabezado
        («Cierre del día» es de esa sucursal) y la lista. Si no se pudo,
        regresa a la de antes. */
    async changeBranch() {
        const select = $('#cut_branch');
        const id     = String(select.val() || '');
        const now    = String((dataInit.visor || {}).branch_id || '');

        if (!id || id === now) return;

        select.prop('disabled', true);

        const res = window.navbar && typeof navbar.post === 'function' ? await navbar.post({ opc: 'switchBranch', id: id }) : null;

        if (!res || res.status !== 200) {
            select.val(now).prop('disabled', false);
            alert({ icon: 'error', title: 'No se cambió la sucursal', text: (res && res.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        // Elegir una sucursal apaga «Todas» de Pedidos y Calendario, como en la barra. La barra queda al día aunque no se vea.
        if (typeof navbar.clearAll === 'function') navbar.clearAll();
        ((navbar.data && navbar.data.branches) || []).forEach((b) => { b.selected = String(b.id) === id; });

        const init = await useFetch({ url: api, data: { opc: 'init', visor: 1 } });

        select.prop('disabled', false);

        // La sesión ya es de la otra sucursal: sin su init, lo de la pantalla no le corresponde.
        if (!init || init.status != 200) return location.reload();

        dataInit = init;

        this.header();

        if (!(dataInit.tickets || []).includes('show')) {
            this.items = [];
            this.paintList();
            this.paintEmpty('Tu rol no tiene permiso para ver los cortes de esta sucursal.');
            return;
        }

        this.selected = null;
        this.lsCuts();
    }

    // -- Complements --

    onBranchChange() {
        location.reload();
    }

    // Ancho guardado de la lista (agarradera); sin él, 540 px.
    savedWidth() {
        try {
            const width = parseInt(localStorage.getItem(this.widthKey), 10);

            return Number.isFinite(width) ? Math.min(Math.max(width, 340), 1000) : this.listWidth;
        } catch (e) {
            return this.listWidth;
        }
    }

    saveWidth() {
        try {
            localStorage.setItem(this.widthKey, String(this.listWidth));
        } catch (e) {
            // Sin almacenamiento: el ancho dura lo que dure la página.
        }
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

    // Fecha arranca en hoy, como en alpha. Se recuerdan la vista, el modo y el rango.
    savedRange() {
        const saved = { view: 'turns', mode: 'day', dates: this.rangeDates('last7') };

        try {
            const raw = JSON.parse(localStorage.getItem(this.rangeKey) || '{}') || {};
            const fi  = moment(raw.fi, 'YYYY-MM-DD', true);
            const ff  = moment(raw.ff, 'YYYY-MM-DD', true);

            if (this.views[raw.view]) saved.view = raw.view;
            if (raw.mode === 'range') saved.mode = 'range';

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
            localStorage.setItem(this.rangeKey, JSON.stringify({ view: this.filters.view, mode: this.period, range: this.rangeName(fi, ff), fi, ff }));
        } catch (e) {
            return;
        }
    }

    rangeDates(range) {
        const server = moment(dataInit.today, 'YYYY-MM-DD', true);
        const today  = server.isValid() ? server : moment();

        switch (range) {
            case 'today':     return [today.clone(), today.clone()];
            case 'last7':     return [today.clone().subtract(6, 'days'), today.clone()];
            case 'lastMonth': return [today.clone().subtract(1, 'months').startOf('month'), today.clone().subtract(1, 'months').endOf('month')];
            default:          return [today.clone().startOf('month'), today.clone()];
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
