/*  Pedidos › lista (lista-pedidos.php): lista, calendario y tablero en la
    misma pantalla. Los botones de la derecha del encabezado (Calendario |
    Pedidos | Tablero) cambian de vista sin salir de la página; la vista se
    recuerda y ?vista=calendario o ?vista=tablero abre directo en ella.
    El calendario es OrderCalendar (components/order-calendar.js) con su ctrl;
    el tablero es OrderBoard (components/order-board.js) con ctrl-pedidos.

    La captura (TPV) es otra página: pedido.php (nuevo) y pedido.php?id=<id>
    (editar). «Nuevo pedido» y «Editar» llevan ahí (OrderLink); al guardar,
    pedido.js regresa a esta lista. */

let api = 'ctrl/ctrl-pedidos.php';
let orders, orderDetail, orderForm, orderTurn, orderPay, orderClosure;
let dataInit = {};

const ORD_CALENDAR_API = 'ctrl/ctrl-calendario.php';
const ORD_CLIENTS_API  = 'ctrl/ctrl-clientes.php';   // «Editar cliente» del menú de la fila

$(async () => {
    dataInit = (await useFetch({ url: api, data: { opc: 'init' } })) || {};

    orderDetail = new OrderDetail(api, 'root');
    orderForm   = new OrderLink(api, 'root');
    orderTurn   = new OrderTurn('ctrl/ctrl-turno.php', 'root');
    orderPay     = new OrderPay('ctrl/ctrl-cobro.php', 'root');
    orderClosure = new OrderClosure('ctrl/ctrl-cierre.php', 'root');
    orders       = new Orders(api, 'root');

    // «Todas las sucursales» de la barra (navbar.offerAll): la comparte con el Calendario.
    orders.all      = !!(dataInit.all && window.navbar && typeof navbar.offerAll === 'function' && navbar.offerAll('order', dataInit.all));
    orderDetail.all = orders.all;

    // El selector de sucursal de la barra dice cuál tiene turno (navbar.showTurns).
    if (dataInit.turns && window.navbar && typeof navbar.showTurns === 'function') navbar.showTurns(dataInit.turns);

    orders.init();
});

// -- Orders --

class Orders extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Orders';
        this.rangeKey     = 'pro:pedidos:range:v1';
        this.ranges       = { today: 'Hoy', yesterday: 'Ayer', week: 'Semana actual', month: 'Mes actual', lastMonth: 'Mes anterior' };
        this.request      = 0;
        this.searchTimer  = null;
        this.pageLength   = 15;
        this.all          = false;   // todas las sucursales
        this.viewKey      = 'pro:pedidos:vista:v1';
        this.view         = 'list';  // list | calendar | board
        this.calendar     = null;    // OrderCalendar, se arma la primera vez que se abre
        this.board        = null;    // OrderBoard, igual
        this.savingCustomer = false; // «Editar cliente» en curso
    }

    get filters() {
        return {
            q:          String($('#ord_q').val() || '').trim(),
            ...getDataRangePicker('ord_calendar'),
            status:     $('#ord_status').val(),
            order_type: $('#ord_order_type').val()
        };
    }

    // -- Interface --

    init() {
        this.render();
    }

    render() {
        this.layout();
        this.header();

        if (dataInit.status != 200) return this.blocked(dataInit.message || 'No se pudo cargar Pedidos. Recarga la página.');

        if (!this.can('show')) return this.blocked('Tu rol no tiene permiso para ver pedidos en esta sucursal.');

        this.filterBar();
        this.searchBar();
        this.showView(this.startView());
    }

    /*  La tarjeta llena el alto del módulo, como Catálogo: flex-1 de #root
        hasta la tarjeta. Sin min-h-0: con muchos pedidos crece con la tabla y
        el único scroll sigue siendo el de la página.
        body lleva las dos vistas; solo una se ve a la vez. */
    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:    `page${this.PROJECT_NAME}`,
                class: 'flex flex-1 flex-col gap-[16px]',
                container: [
                    { type: 'div', id: `header${this.PROJECT_NAME}`, class: 'w-full' },
                    {
                        type:  'div',
                        id:    `body${this.PROJECT_NAME}`,
                        class: 'w-full flex flex-1 flex-col',
                        children: [
                            { type: 'div', id: `viewList${this.PROJECT_NAME}`, class: 'w-full flex flex-1 flex-col' },
                            { type: 'div', id: `viewCalendar${this.PROJECT_NAME}`, class: 'w-full flex flex-1 flex-col hidden' },
                            { type: 'div', id: `viewBoard${this.PROJECT_NAME}`, class: 'w-full flex flex-1 flex-col hidden' }
                        ]
                    }
                ]
            }
        });

        this.primaryLayout({
            parent: `viewList${this.PROJECT_NAME}`,
            id:     this.PROJECT_NAME,
            class:  'ord-card flex flex-1 flex-col',
            card: {
                name:      `card${this.PROJECT_NAME}`,
                class:     'flex flex-1 flex-col',
                filterBar: { class: 'w-full mb-[14px]' },
                container: { class: 'w-full' }
            }
        });

        // El buscador va fuera de la tabla: createCoffeeTable3 la reescribe en cada búsqueda y el input perdería el foco.
        // "Mostrar N registros" de DataTables se mueve a length (lsOrders) para quedar junto al buscador.
        this.createLayout({
            parent: `container${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `list${this.PROJECT_NAME}`,
                class: 'w-full',
                container: [
                    {
                        type:  'div',
                        id:    `search${this.PROJECT_NAME}`,
                        class: 'w-full',
                        children: [
                            // dataTables_wrapper: el selector movido conserva el estilo de DataTables y de compact.css.
                            { type: 'div', id: `length${this.PROJECT_NAME}`, class: 'ord-dt-length dataTables_wrapper' },
                            // Leyenda del punto verde del folio: lsOrders la enciende si algún pedido lo trae.
                            { type: 'div', id: `legend${this.PROJECT_NAME}`, class: 'ord-dt-legend', html: '<span class="ord-dot"></span>Pedido del turno abierto' },
                            { type: 'div', id: `searchBox${this.PROJECT_NAME}`, class: 'ord-dt-search' }
                        ]
                    },
                    { type: 'div', id: `table${this.PROJECT_NAME}`, class: 'w-full' }
                ]
            }
        });
    }

    filterBar() {
        const saved = this.savedRange();
        const col   = 'col-12 col-sm-6 col-lg-3 col-xl-2';   // los tres filtros y el botón miden lo mismo

        // El periodo filtra siempre por fecha de captura (el ctrl la toma por defecto).
        const data = [
            {
                opc:      'input-calendar',
                id:       'calendar',
                lbl:      'Buscar por fecha de captura',
                required: false,
                readonly: true,
                class:    `${col} ord-period`
            },
            {
                opc:      'select',
                id:       'status',
                lbl:      'Estado',
                required: false,
                class:    `${col} ord-period`,
                data:     [{ id: '', valor: 'Todos' }, ...(dataInit.statuses || [])],
                onchange: 'orders.lsOrders()'
            },
            {
                opc:      'select',
                id:       'order_type',
                lbl:      'Tipo',
                required: false,
                class:    col,
                data:     [{ id: '', valor: 'Todos' }, { id: 'custom', valor: 'Personalizado' }, { id: 'normal', valor: 'Normal' }],
                onchange: 'orders.lsOrders()'
            }
        ];

        // «Nuevo pedido» va al final de la barra, junto a los filtros. Solo con create.
        // Por el prefijo de la barra su id queda como ord_btnNewOrder.
        if (this.can('create')) {
            data.push({ opc: 'button', id: 'btnNewOrder', class: col, text: 'Nuevo pedido', icon: 'icon-plus', color_btn: 'primary', onClick: () => orderForm.add() });
        }

        this.createfilterBar({
            parent:     `filterBar${this.PROJECT_NAME}`,
            id:         `fb${this.PROJECT_NAME}`,
            prefijo:    'ord_',
            coffeesoft: true,
            data:       data
        });

        dataPicker({
            parent: 'ord_calendar',
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
                    monthNames:       ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
                },
                ranges: Object.fromEntries(Object.entries(this.ranges).map(([range, label]) => [label, this.rangeDates(range)]))
            },
            onSelect: () => this.onPeriodChange()
        });

        // apply.daterangepicker llega con el periodo ya escrito en el campo (onSelect llega antes).
        $('#ord_calendar').on('apply.daterangepicker', () => this.fitPeriod());
    }

    /*  «DD/MM/AAAA - DD/MM/AAAA» no cabe junto al ícono cuando la barra va en
        col-2 angosta (1280 a 1439 px): ahí el periodo se ve con año de dos cifras.
        Solo cambia lo que se lee; las fechas que viajan salen del picker. */
    fitPeriod() {
        const input  = $('#ord_calendar');
        const picker = input.data('daterangepicker');

        if (!picker || !input.is(':visible')) return;

        picker.locale.format = 'DD/MM/YYYY';
        picker.updateElement();

        if (input[0].scrollWidth <= input[0].clientWidth) return;

        picker.locale.format = 'DD/MM/YY';
        picker.updateElement();
    }

    // Sobre la tabla, en el extremo derecho; "Mostrar N registros" queda a la izquierda.
    searchBar() {
        this.createfilterBar({
            parent:     `searchBox${this.PROJECT_NAME}`,
            id:         `fbSearch${this.PROJECT_NAME}`,
            prefijo:    'ord_',
            coffeesoft: true,
            data: [
                {
                    opc:         'input',
                    id:          'q',
                    type:        'search',
                    placeholder: 'Buscar folio, cliente o teléfono',
                    required:    false,
                    class:       'col-12'
                }
            ]
        });

        $('#ord_q')
            .attr({ maxlength: 60, autocomplete: 'off', 'aria-label': 'Buscar pedido' })
            .on('input', (e) => this.onSearchInput(e))
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
                            { type: 'div', id: `views${this.PROJECT_NAME}`, class: 'ord-views' }
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
                    { type: 'h1', class: 'cp-pagina-titulo', text: 'Pedidos' },
                    { type: 'p', class: 'cp-pagina-subtitulo', html: this.subtitle(scope) }
                ]
            }
        });

        if (dataInit.status != 200 || !this.can('show')) return;

        this.viewButtons();
        this.paintTurn();

        orderTurn.paintStrip(true);
    }

    // Empresa · sucursal. La sucursal va en negritas y con el color de la marca (order.css › .ord-head-branch).
    subtitle(scope) {
        const branch = this.all ? 'Todas las sucursales' : scope.branch;

        if (!scope.company && !branch) return 'Pedidos y cotizaciones de la sucursal';

        return [
            scope.company ? esc(scope.company) : '',
            branch ? `<b class="ord-head-branch">${esc(branch)}</b>` : ''
        ].filter(Boolean).join(' · ');
    }

    // El encabezado ya no lleva botones: «Nuevo pedido» vive en la barra de filtros
    // y el turno en la franja de caja (caja-strip.js). Se queda vacío porque
    // orderTurn.sync() lo llama en todas las pantallas.
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

    // -- Vistas: Calendario | Pedidos | Tablero --

    // El calendario sale a quien lo ve en esta sucursal (pos-calendario 'show').
    canCalendar() {
        return (dataInit.calendar || []).includes('show');
    }

    // Las vistas que el rol puede abrir, en el orden de los botones. Lista y tablero salen con ver Pedidos.
    views() {
        return this.canCalendar() ? ['calendar', 'list', 'board'] : ['list', 'board'];
    }

    /*  Botones a la derecha del encabezado: el tabLayout de CoffeeSoft, el mismo
        de las pestañas de tickets de Ventas (riel gris, activa en blanco; order.css
        comparte sus reglas). */
    viewButtons() {
        const start = this.startView();
        const tabs  = {
            list:     { id: 'ordViewList', tab: 'Pedidos', lucideIcon: 'list' },
            calendar: { id: 'ordViewCalendar', tab: 'Calendario', lucideIcon: 'calendar-days' },
            board:    { id: 'ordViewBoard', tab: 'Tablero', lucideIcon: 'square-kanban' }
        };

        this.tabLayout({
            parent:          `views${this.PROJECT_NAME}`,
            id:              `viewTabs${this.PROJECT_NAME}`,
            type:            'button',
            theme:           'light',
            renderContainer: false,
            json: this.views().map((view) => ({ ...tabs[view], active: start === view, onClick: () => this.showView(view) }))
        });

        $(`#viewTabs${this.PROJECT_NAME}`).attr({ role: 'group', 'aria-label': 'Cambiar de vista' });
    }

    // ?vista=calendario o ?vista=tablero manda; si no, la última que se usó.
    startView() {
        const url = { calendario: 'calendar', tablero: 'board' }[new URLSearchParams(location.search).get('vista')];

        if (url && this.views().includes(url)) return url;

        try {
            const saved = localStorage.getItem(this.viewKey);

            return this.views().includes(saved) ? saved : 'list';
        } catch (e) {
            return 'list';
        }
    }

    /*  Enseña una vista y esconde las otras. El detalle del pedido es el mismo
        en las tres vistas (mismos botones: Editar, Ya se elaboró, Entregar...).
        Solo cambia quién lo lee: en el calendario ctrl-calendario (alcanza los
        pedidos de las sucursales que el rol ve en el calendario); en la lista y
        el tablero, ctrl-pedidos. */
    showView(view) {
        this.view = this.views().includes(view) ? view : 'list';

        const calendar = this.view === 'calendar';
        const hosts    = { list: 'viewList', calendar: 'viewCalendar', board: 'viewBoard' };

        Object.entries(hosts).forEach(([key, host]) => $(`#${host}${this.PROJECT_NAME}`).toggleClass('hidden', key !== this.view));

        // tabLayout marca el clic; esto cubre cuando la vista cambia sin clic (?vista=, la guardada).
        // El color lo pone data-state (order.css), no las clases de Tailwind del componente.
        const active = { list: 'tab-ordViewList', calendar: 'tab-ordViewCalendar', board: 'tab-ordViewBoard' }[this.view];

        $(`#viewTabs${this.PROJECT_NAME} > button`).each((i, el) => {
            const on = el.id === active;

            $(el).attr({ 'data-state': on ? 'active' : 'inactive', 'aria-pressed': String(on) });
        });

        $('ul.ct3-dropdown-menu').addClass('hidden');

        orderDetail._link    = calendar ? ORD_CALENDAR_API : api;
        orderDetail.editable = true;

        this.saveView();

        if (calendar) return this.showCalendar();
        if (this.view === 'board') return this.showBoard();

        // Escondido el campo no se puede medir: el periodo se acomoda al enseñar la lista, dos cuadros
        // después (Tailwind CDN arma los anchos de la rejilla) y con la letra Lexend ya cargada.
        requestAnimationFrame(() => requestAnimationFrame(() => document.fonts.ready.then(() => this.fitPeriod())));
        this.lsOrders();
    }

    // La primera vez arma el tablero; las demás solo lo vuelve a pedir.
    showBoard() {
        if (this.board) return this.board.lsBoard();

        this.board     = new OrderBoard(api, `viewBoard${this.PROJECT_NAME}`);
        this.board.all = this.all;

        this.board.init();
    }

    // La primera vez pide el init del calendario y lo arma; las demás solo lo refresca.
    async showCalendar() {
        if (this.calendar) {
            if (this.calendar.calendar) this.calendar.calendar.updateSize();

            return this.calendar.lsOrders();
        }

        const info = (await useFetch({ url: ORD_CALENDAR_API, data: { opc: 'init' } })) || {};

        this.calendar          = new OrderCalendar(ORD_CALENDAR_API, `viewCalendar${this.PROJECT_NAME}`);
        this.calendar.info     = info;
        this.calendar.embedded = true;
        this.calendar.all      = this.all;

        this.calendar.init();
    }

    // Se recuerda en el navegador y en la dirección (?vista=calendario | tablero), sin perder ?from=ventas.
    saveView() {
        try {
            localStorage.setItem(this.viewKey, this.view);
        } catch (e) {
            // Sin almacenamiento la vista dura lo que dure la página.
        }

        const params = new URLSearchParams(location.search);
        const name   = { calendar: 'calendario', board: 'tablero' }[this.view];

        if (name) params.set('vista', name);
        else params.delete('vista');

        const query = params.toString();

        history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash);
    }

    // -- CRUD --

    // Los modales (cobro, entrega, turno) lo llaman al guardar: refresca la vista que se ve.
    async lsOrders() {
        if (this.view === 'calendar' && this.calendar) return this.calendar.lsOrders();
        if (this.view === 'board' && this.board) return this.board.lsOrders();

        const request = ++this.request;
        const filters = this.filters;

        $('.ord-period').toggleClass('opacity-50', filters.q !== '');
        $(`#table${this.PROJECT_NAME}`).addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'lsOrders', ...filters, all: this.all ? 1 : 0 } });

        if (request !== this.request) return;

        const loaded = Boolean(data && data.status == 200);

        if (!loaded) alert({ icon: 'error', title: 'No se pudo cargar la lista', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

        $('ul.ct3-dropdown-menu').remove();
        $(`#table${this.PROJECT_NAME}`).removeClass('opacity-50');

        this.createCoffeeTable3({
            parent:  `table${this.PROJECT_NAME}`,
            id:      `tb${this.PROJECT_NAME}`,
            theme:   'light',
            data:    loaded && data.row ? data : { thead: [], row: [] },
            striped: true,
            hover:   true,
            f_size:  12,
            right:   [4, 5, 6],
            center:  [1,2, 7, 8, 9, 10],
            ...ORD_TABLE,
            ...this.emptyState(loaded ? data : null)
        });

        // El selector de la tabla anterior ya no sirve; sin filas no hay qué paginar.
        $(`#length${this.PROJECT_NAME}`).empty();

        // La leyenda solo se ve si alguna fila trae el punto (pedido del turno abierto).
        $(`#legend${this.PROJECT_NAME}`).toggleClass('is-on', loaded && (data.row || []).some((row) => String(row.Folio || '').includes('ord-dot')));

        if (!loaded || !data.row || !data.row.length) return;

        $(`#tb${this.PROJECT_NAME} [data-cancelled]`).closest('tr').addClass('ord-row-cancel');

        // Toda la celda de operaciones abre el menú «…», no solo el ícono.
        $(`#tb${this.PROJECT_NAME} tbody button.icon-dot-3`).parent('td').addClass('ord-ops-cell cursor-pointer');

        $(`#tb${this.PROJECT_NAME}`).on('click', 'td.ord-ops-cell', (e) => {
            if ($(e.target).closest('button').length) return;

            e.stopPropagation();
            $(e.currentTarget).find('button.icon-dot-3').trigger('click');
        });

        // Fechas, horas, folio y montos ordenan por el valor del ctrl, no por el texto ("28/oct/2026").
        $(`#tb${this.PROJECT_NAME} tbody [data-order]`).each((i, el) => $(el).closest('td').attr('data-order', el.dataset.order));

        // Orden por columna como simple_data_table_filter. order: [] respeta el orden del ctrl al cargar.
        // La búsqueda sigue en el servidor (#ord_q): encuentra pedidos fuera del periodo.
        const table = $(`#tb${this.PROJECT_NAME}`).DataTable({
            dom:          'l<"ord-dt-scroll"t><"ord-dt-foot"ip>',
            pageLength:   this.pageLength,
            lengthMenu:   [10, 15, 25, 50],
            order:        [],
            columnDefs:   [{ targets: -1, orderable: false }],
            searching:    false,
            lengthChange: true,
            destroy:      true,
            autoWidth:    false,
            language: {
                lengthMenu: 'Mostrar _MENU_ registros por página',
                info:       'Mostrando _START_ a _END_ de _TOTAL_ pedidos',
                infoEmpty:  'Sin pedidos',
                emptyTable: 'Sin pedidos',
                paginate:   { first: 'Primera', last: 'Última', next: '›', previous: '‹' }
            },
            drawCallback: (settings) => {
                // createCoffeeTable3 raya por posición: al ordenar se repinta en el orden visible.
                ordStripe(settings.nTBody);
                $('ul.ct3-dropdown-menu').addClass('hidden');
                if (window.lucide) lucide.createIcons();
            }
        }).on('length.dt', (e, settings, len) => { this.pageLength = len; });

        // DataTables enlaza el cambio en el propio <select>: moverlo no le quita el evento.
        $(`#length${this.PROJECT_NAME}`).append($(table.table().container()).find('.dataTables_length'));
    }

    // -- Columna Entrega --

    /*  El badge de Entrega abre un menú con los dos estados, como alpha: el
        actual marcado y el otro con su ventana de siempre (entregar,
        cobrar y entregar, o deshacer con motivo). El ctrl manda en
        data-to qué ventana toca y, si no se puede, en data-why el porqué.
        Usa la clase de los menús de la tabla: se cierra con el mismo clic afuera. */
    deliveryMenu(btn, e) {
        e.stopPropagation();

        const el    = $(btn);
        const id    = Number(el.attr('data-id'));
        const given = Number(el.attr('data-state')) === 1;
        const to    = String(el.attr('data-to') || '');
        const why   = String(el.attr('data-why') || '');
        const again = $('ul.ord-deliv-menu:not(.hidden)').data('for') === id;

        $('ul.ct3-dropdown-menu').addClass('hidden');
        $('ul.ord-deliv-menu').remove();

        if (again) return;

        const runs = {
            deliver:   () => orderDetail.deliver(id),
            settle:    () => orderPay.open(id, false, { deliver: true }),
            undeliver: () => orderDetail.undeliver(id)
        };

        const note = to === 'settle' ? 'Primero cobras el saldo' : to ? '' : why;

        const menu = $('<ul>', {
            class: 'ct3-dropdown-menu ord-deliv-menu w-56 border rounded-md shadow-lg',
            css:   { position: 'fixed', zIndex: 99999 },
            role:  'menu'
        }).data('for', id);

        menu.append('<li class="ord-deliv-head">Estado de entrega</li>')
            .append(this.deliveryItem(given ? 'Entregado' : 'Sin entregar', given, 'Estado actual', null, true))
            .append(this.deliveryItem(given ? 'Sin entregar' : 'Entregado', !given, note, to ? runs[to] : null, false));

        $('body').append(menu);

        const rect = btn.getBoundingClientRect();
        const wide = menu.outerWidth() || 224;
        const tall = menu.outerHeight() || 140;
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - wide - 8));
        const top  = rect.bottom + 6 + tall > window.innerHeight - 8 ? rect.top - tall - 6 : rect.bottom + 6;

        menu.css({ top: `${top}px`, left: `${left}px` });

        if (window.lucide) lucide.createIcons();
    }

    // Una opción del menú. done = el punto verde (entregado); run = null la deja apagada con su nota.
    deliveryItem(label, done, note, run, current) {
        const html = `<span class="ord-deliv-dot ${done ? 'is-done' : 'is-wait'}"></span>`
                   + `<span class="min-w-0"><span class="block">${esc(label)}</span>${note ? `<small>${esc(note)}</small>` : ''}</span>`;

        if (current) return $('<li>').append($('<div>', { class: 'ord-deliv-opt is-current', html: html + '<i data-lucide="check" class="w-4 h-4 ml-auto shrink-0"></i>' }));

        if (!run) return $('<li>').append($('<div>', { class: 'ord-deliv-opt is-off', html: html }));

        return $('<li>').append($('<a>', {
            class: 'ord-deliv-opt',
            role:  'menuitem',
            html:  html,
            click: () => {
                $('ul.ord-deliv-menu').remove();
                run();
            }
        }));
    }

    // -- Cliente --

    /*  «Editar cliente» del menú de la fila: nombre, teléfono y correo, con
        las reglas de Clientes (ctrl-clientes › editCustomer: 10 dígitos, sin
        repetir teléfono). El crédito no viaja: se sigue dando en Clientes. */
    async editCustomer(customerId) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        if (this.savingCustomer) return;

        const data = await useFetch({ url: ORD_CLIENTS_API, data: { opc: 'getCustomer', id: customerId } });

        if (!data || data.status != 200 || !data.row) {
            return alert({ icon: 'info', title: 'No se abrió el cliente', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
        }

        const c = data.row;

        this.csModal({
            id:         'modalOrderCustomerEdit',
            title:      'Editar cliente',
            subtitle:   c.since ? `Cliente desde ${c.since}` : '',
            lucideIcon: 'pencil',
            width:      'max-w-md',
            saveText:   'Guardar cambios',
            cancelText: 'Cancelar',
            info:       'El cambio sale en todos los pedidos del cliente.',
            json: [
                { id: 'oce_name', lbl: 'Nombre', required: true, maxlength: 120, value: c.name || '', class: 'w-full' },
                { id: 'oce_phone', lbl: 'Teléfono', required: true, maxlength: 16, ph: '10 dígitos', value: c.phone || '', class: 'w-full' },
                { id: 'oce_email', lbl: 'Correo', maxlength: 120, ph: 'Opcional', value: c.email || '', class: 'w-full' }
            ],
            onSave: (values, close) => this.saveCustomer(c.id, values, close)
        });

        $('#oce_phone')
            .attr({ inputmode: 'numeric', autocomplete: 'off' })
            .on('input', (e) => { e.target.value = e.target.value.replace(/[^\d\s-]/g, ''); });

        $('#oce_email').attr({ inputmode: 'email', autocomplete: 'off' });
    }

    async saveCustomer(id, values, close) {
        if (this.savingCustomer) return;

        const name  = String(values.oce_name || '').trim().replace(/\s+/g, ' ');
        const phone = String(values.oce_phone || '').replace(/\D/g, '');
        const email = String(values.oce_email || '').trim();
        const warn  = (text) => alert({ icon: 'warning', title: 'Revisa el cliente', text: text, btn1: true, btn1Text: 'Entendido' });

        if (!name)               return warn('Escribe el nombre del cliente.');
        if (phone.length !== 10) return warn('El teléfono debe tener 10 dígitos.');
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return warn('El correo no tiene un formato válido.');

        this.savingCustomer = true;

        const button = $('#modalOrderCustomerEdit .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: ORD_CLIENTS_API, data: { opc: 'editCustomer', id: id, name: name, phone: phone, email: email } });

        this.savingCustomer = false;
        button.prop('disabled', false);

        // Teléfono repetido o dato inválido: la ventana sigue abierta con lo escrito.
        if (!data || data.status != 200) return warn((data && data.message) || 'No se guardó el cliente. Vuelve a intentar.');

        close();
        alert({ icon: 'success', title: data.message, timer: 1400 });
        this.lsOrders();
    }

    // -- Complements --

    onBranchChange() {
        location.reload();
    }

    onPeriodChange() {
        this.saveRange();
        this.lsOrders();
    }

    onSearchInput(e) {
        const q = e.target.value.trim();

        clearTimeout(this.searchTimer);

        if (q.length === 1 && !/\d/.test(q)) return;

        this.searchTimer = setTimeout(() => this.lsOrders(), 350);
    }

    onSearchKeydown(e) {
        if (e.key !== 'Enter') return;

        e.preventDefault();
        clearTimeout(this.searchTimer);
        this.lsOrders();
    }

    can(action) {
        return (dataInit.actions || []).includes(action);
    }

    savedRange() {
        const saved = { dates: this.rangeDates('month') };

        try {
            const raw = JSON.parse(localStorage.getItem(this.rangeKey) || '{}') || {};
            const fi  = moment(raw.fi, 'YYYY-MM-DD', true);
            const ff  = moment(raw.ff, 'YYYY-MM-DD', true);

            if (Object.keys(this.ranges).includes(raw.range)) saved.dates = this.rangeDates(raw.range);
            else if (raw.range === 'custom' && fi.isValid() && ff.isValid() && !ff.isBefore(fi)) saved.dates = [fi, ff];
        } catch (e) {
            return saved;
        }

        return saved;
    }

    saveRange() {
        const { fi, ff } = getDataRangePicker('ord_calendar');

        try {
            localStorage.setItem(this.rangeKey, JSON.stringify({ range: this.rangeName(fi, ff), fi, ff }));
        } catch (e) {
            return;
        }
    }

    rangeDates(range) {
        const server = moment(dataInit.today, 'YYYY-MM-DD', true);
        const today  = server.isValid() ? server : moment();

        switch (range) {
            case 'today':     return [today.clone(), today.clone()];
            case 'yesterday': return [today.clone().subtract(1, 'days'), today.clone().subtract(1, 'days')];
            case 'week':      return [today.clone().startOf('isoWeek'), today.clone().endOf('isoWeek')];
            case 'lastMonth': return [today.clone().subtract(1, 'months').startOf('month'), today.clone().subtract(1, 'months').endOf('month')];
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

    // Mensaje de la tabla vacía. Sin título ni subtítulo.
    emptyState(data) {
        if (!data) return { emptyMessage: 'No se pudo cargar la lista de pedidos', emptyIcon: 'icon-attention' };

        if (data.mode === 'search') return { emptyMessage: 'Ningún pedido coincide con la búsqueda', emptyIcon: 'icon-search' };

        return { emptyMessage: 'No hay pedidos en este periodo', emptyIcon: 'icon-calendar-1' };
    }
}

// -- OrderLink --

/*  En la lista, «Nuevo pedido» y «Editar» (fila, detalle, tablero, calendario
    y la ventana de pagos) llevan a pedido.php. Editar revisa aquí que se pueda
    y avisa si el pedido ya está en un corte: si no se edita, no se cambia de
    página. Cancelar y eliminar siguen siendo de OrderForm, aquí en la lista.
    «Nuevo pedido» también: sin turno, el aviso sale sobre la lista y no se
    cambia de página; con «Abrir turno», al quedar abierto sigue a la captura. */
class OrderLink extends OrderForm {

    async add() {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        if (this.checking) return;

        this.checking = true;

        const data = await useFetch({ url: this._link, data: { opc: 'getNewOrderTurn' } });

        this.checking = false;

        const go = () => { location.href = this.formUrl(0); };

        if (data && data.status == 200) return go();

        this.warnFail(data, 'No se pudo abrir la captura', go);
    }

    async edit(id) {
        if (await this.editable(id)) location.href = this.formUrl(id);
    }

    // pedido.php conserva ?from=ventas: la franja sigue ofreciendo el regreso a Ventas.
    formUrl(id) {
        const params = new URLSearchParams();
        const from   = new URLSearchParams(location.search).get('from');

        if (id) params.set('id', String(id));
        if (from) params.set('from', from);

        const query = params.toString();

        return 'pedido.php' + (query ? `?${query}` : '');
    }
}
