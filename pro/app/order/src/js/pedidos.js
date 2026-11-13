let api = 'ctrl/ctrl-pedidos.php';
let orders, orderDetail;
let dataInit = {};

$(async () => {
    dataInit = (await useFetch({ url: api, data: { opc: 'init' } })) || {};

    orderDetail = new OrderDetail(api, 'root');
    orders      = new Orders(api, 'root');
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
                    opc:         'input',
                    id:          'q',
                    lbl:         'Buscar',
                    type:        'search',
                    placeholder: 'Folio, cliente o teléfono',
                    required:    false,
                    class:       'col-12 col-xl-3'
                },
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

        $('#ord_q')
            .attr({ maxlength: 60, autocomplete: 'off' })
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
                        class: 'cp-migas',
                        children: [
                            { type: 'span', class: 'cp-migas-raiz', text: 'Huubie' },
                            { type: 'span', class: 'cp-migas-sep', text: '/' },
                            { type: 'span', class: 'cp-migas-raiz', text: 'POS' },
                            { type: 'span', class: 'cp-migas-sep', text: '/' },
                            { type: 'span', class: 'cp-migas-actual', text: 'Pedidos' }
                        ]
                    },
                    { type: 'h1', class: 'cp-pagina-titulo', text: 'Pedidos' },
                    { type: 'p', class: 'cp-pagina-subtitulo', text: [scope.company, scope.branch].filter(Boolean).join(' · ') || 'Pedidos y cotizaciones de la sucursal' }
                ]
            }
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
        $(`#container${this.PROJECT_NAME}`).addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'lsOrders', ...filters } });

        if (request !== this.request) return;

        const loaded = Boolean(data && data.status == 200);

        if (!loaded) alert({ icon: 'error', title: 'No se pudo cargar la lista', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

        $('ul.ct3-dropdown-menu').remove();
        $(`#container${this.PROJECT_NAME}`).removeClass('opacity-50');

        this.createCoffeeTable3({
            parent:  `container${this.PROJECT_NAME}`,
            id:      `tb${this.PROJECT_NAME}`,
            theme:   'light',
            data:    loaded && data.row ? data : { thead: [], row: [] },
            striped: true,
            hover:   true,
            f_size:  13,
            right:   [4, 5, 6],
            center:  [2, 7, 8, 9, 10],
            ...this.caption(loaded ? data : null, filters)
        });

        if (!loaded || !data.row || !data.row.length) return;

        $(`#tb${this.PROJECT_NAME} [data-cancelled]`).closest('tr').addClass('ord-row-cancel');

        $(`#tb${this.PROJECT_NAME}`).DataTable({
            dom:          '<"ord-dt-scroll"t><"ord-dt-foot"ip>',
            pageLength:   15,
            ordering:     false,
            searching:    false,
            lengthChange: false,
            destroy:      true,
            autoWidth:    false,
            language: {
                info:       'Mostrando _START_ a _END_ de _TOTAL_ pedidos',
                infoEmpty:  'Sin pedidos',
                emptyTable: 'Sin pedidos',
                paginate:   { first: 'Primera', last: 'Última', next: '›', previous: '‹' }
            },
            drawCallback: () => {
                $('ul.ct3-dropdown-menu').addClass('hidden');
                if (window.lucide) lucide.createIcons();
            }
        });
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

    caption(data, filters) {
        if (!data) return { title: null, subtitle: null, emptyMessage: 'No se pudo cargar la lista de pedidos', emptyIcon: 'icon-attention' };

        const branch = esc(data.branch || (dataInit.scope || {}).branch || '');
        const count  = Number(data.count || 0);
        const shift  = (data.row || []).some((row) => String(row.Folio || '').includes('ord-dot')) ? ' El punto verde marca los pedidos del turno abierto.' : '';

        if (data.mode === 'search') {
            const total = Number(data.total || 0);

            return {
                title:        count ? `${count} de ${total} ${total === 1 ? 'coincidencia' : 'coincidencias'}` : 'Sin coincidencias',
                subtitle:     `Búsqueda «${esc(filters.q)}» en ${branch}. Se ignoran el periodo y el estado.${data.exact ? ' El folio exacto va primero.' : ''}${shift}`,
                emptyMessage: 'Ningún pedido coincide con la búsqueda',
                emptyIcon:    'icon-search'
            };
        }

        const by = filters.date_type === 'delivery' ? 'fecha de entrega' : 'fecha de captura';

        return {
            title:        count ? `${count} ${count === 1 ? 'pedido' : 'pedidos'}` : 'Sin pedidos',
            subtitle:     `Por ${by}, del ${ordDate(filters.fi)} al ${ordDate(filters.ff)} en ${branch}.${shift}`,
            emptyMessage: 'No hay pedidos en este periodo',
            emptyIcon:    'icon-calendar-1'
        };
    }
}
