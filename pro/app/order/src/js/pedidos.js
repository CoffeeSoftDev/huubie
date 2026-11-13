let api = 'ctrl/ctrl-pedidos.php';
let orders, orderDetail, orderForm, orderTurn, orderPay, orderClosure;
let dataInit = {};

$(async () => {
    dataInit = (await useFetch({ url: api, data: { opc: 'init' } })) || {};

    orderDetail = new OrderDetail(api, 'root');
    orderForm   = new OrderForm(api, 'root');
    orderTurn   = new OrderTurn('ctrl/ctrl-turno.php', 'root');
    orderPay     = new OrderPay('ctrl/ctrl-cobro.php', 'root');
    orderClosure = new OrderClosure('ctrl/ctrl-cierre.php', 'root');
    orders       = new Orders(api, 'root');
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
    }

    get filters() {
        return {
            q:          String($('#ord_q').val() || '').trim(),
            date_type:  $('#ord_date_type').val(),
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
        this.lsOrders();
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

        // El buscador va fuera de la tabla: createCoffeeTable3 la reescribe en cada búsqueda y el input perdería el foco.
        this.createLayout({
            parent: `container${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `list${this.PROJECT_NAME}`,
                class: 'w-full',
                container: [
                    { type: 'div', id: `search${this.PROJECT_NAME}`, class: 'w-full' },
                    { type: 'div', id: `table${this.PROJECT_NAME}`, class: 'w-full' }
                ]
            }
        });
    }

    filterBar() {
        const saved = this.savedRange();

        this.createfilterBar({
            parent:     `filterBar${this.PROJECT_NAME}`,
            id:         `fb${this.PROJECT_NAME}`,
            prefijo:    'ord_',
            coffeesoft: true,
            data: [
                {
                    opc:      'select',
                    id:       'date_type',
                    lbl:      'Filtrar por',
                    required: false,
                    class:    'col-12 col-sm-5 col-lg-3 col-xl-2 ord-period',
                    data:     [{ id: 'created', valor: 'Fecha de captura' }, { id: 'delivery', valor: 'Fecha de entrega' }],
                    value:    saved.dateType,
                    onchange: 'orders.onPeriodChange()'
                },
                {
                    opc:      'input-calendar',
                    id:       'calendar',
                    lbl:      'Periodo',
                    required: false,
                    readonly: true,
                    class:    'col-12 col-sm-7 col-lg-4 col-xl-3 ord-period'
                },
                {
                    opc:      'select',
                    id:       'status',
                    lbl:      'Estado',
                    required: false,
                    class:    'col-6 col-lg-2 ord-period',
                    data:     [{ id: '', valor: 'Todos' }, ...(dataInit.statuses || [])],
                    onchange: 'orders.lsOrders()'
                },
                {
                    opc:      'select',
                    id:       'order_type',
                    lbl:      'Tipo',
                    required: false,
                    class:    'col-6 col-lg-3 col-xl-2',
                    data:     [{ id: '', valor: 'Todos' }, { id: 'custom', valor: 'Personalizado' }, { id: 'normal', valor: 'Normal' }],
                    onchange: 'orders.lsOrders()'
                }
            ]
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
    }

    // Sobre la tabla, a la derecha de "Mostrar N registros" (como en alpha/pedidos).
    searchBar() {
        this.createfilterBar({
            parent:     `search${this.PROJECT_NAME}`,
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
                    { type: 'h1', class: 'cp-pagina-titulo', text: 'Pedidos' },
                    { type: 'p', class: 'cp-pagina-subtitulo', text: [scope.company, scope.branch].filter(Boolean).join(' · ') || 'Pedidos y cotizaciones de la sucursal' }
                ]
            }
        });

        if (dataInit.status != 200 || !this.can('show')) return;

        this.paintTurn();
    }

    // Chip del turno o del día y botones del encabezado. orderTurn.sync() lo repinta.
    paintTurn() {
        if (!$(`#headerActions${this.PROJECT_NAME}`).length) return;

        const turn    = dataInit.turn;
        const day     = dataInit.day || {};
        const pending = day.pending && day.pending.length ? day.pending[0] : '';
        const create  = this.can('create');

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

        const opens = !turn && create && !day.closed && !pending;
        const json  = [
            {
                opc:       'button',
                id:        'btnTurnOrders',
                class:     'col-auto',
                text:      opens ? 'Abrir turno' : 'Turno y corte',
                icon:      opens ? 'icon-lock-open' : 'icon-clock',
                color_btn: 'secondary',
                onClick:   () => orderTurn.open()
            },
            {
                opc:       'button',
                id:        'btnDayOrders',
                class:     'col-auto',
                text:      'Cierre del día',
                icon:      'icon-calendar-check-o',
                color_btn: 'success',
                onClick:   () => orderClosure.open(pending)
            }
        ];

        if (create) {
            json.push({ opc: 'button', id: 'btnNewOrder', class: 'col-auto', text: 'Nuevo pedido', icon: 'icon-plus', color_btn: 'primary', onClick: () => orderForm.add() });
        }

        this.coffeeForm({
            parent:       `headerButtons${this.PROJECT_NAME}`,
            id:           'formHeaderOrders',
            class:        'flex gap-[8px]',
            showRequired: false,
            json:         json
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

    // -- CRUD --

    async lsOrders() {
        const request = ++this.request;
        const filters = this.filters;

        $('.ord-period').toggleClass('opacity-50', filters.q !== '');
        $(`#table${this.PROJECT_NAME}`).addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'lsOrders', ...filters } });

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
            f_size:  13,
            right:   [4, 5, 6],
            center:  [2, 7, 8, 9, 10],
            ...this.emptyState(loaded ? data : null)
        });

        if (!loaded || !data.row || !data.row.length) return;

        $(`#tb${this.PROJECT_NAME} [data-cancelled]`).closest('tr').addClass('ord-row-cancel');

        $(`#tb${this.PROJECT_NAME}`).DataTable({
            dom:          '<"ord-dt-top"l><"ord-dt-scroll"t><"ord-dt-foot"ip>',
            pageLength:   this.pageLength,
            lengthMenu:   [10, 15, 25, 50],
            ordering:     false,
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
            drawCallback: () => {
                $('ul.ct3-dropdown-menu').addClass('hidden');
                if (window.lucide) lucide.createIcons();
            }
        }).on('length.dt', (e, settings, len) => { this.pageLength = len; });
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
        const saved = { dateType: 'created', dates: this.rangeDates('month') };

        try {
            const raw = JSON.parse(localStorage.getItem(this.rangeKey) || '{}') || {};
            const fi  = moment(raw.fi, 'YYYY-MM-DD', true);
            const ff  = moment(raw.ff, 'YYYY-MM-DD', true);

            if (['created', 'delivery'].includes(raw.dateType)) saved.dateType = raw.dateType;

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
            localStorage.setItem(this.rangeKey, JSON.stringify({ dateType: $('#ord_date_type').val(), range: this.rangeName(fi, ff), fi, ff }));
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
