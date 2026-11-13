/*  POS › Cortes (sección pos-tickets): la historia de turnos y de cierres del día.

    Reusa los modales de pedido-turno.js y pedido-cierre.js. Esos modales le
    piden a la página global `orders` tres cosas: can(), paintTurn() y
    lsOrders(); aquí las da Cuts. Ver un turno desfasado y recalcularlo se hace
    desde su modal. Los datos los sirven ctrl-turno y ctrl-cierre (permiso de
    pos-pedidos). */

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
        this.PROJECT_NAME = 'Cuts';
        this.rangeKey     = 'pro:cortes:range:v1';
        this.ranges       = { week: 'Semana actual', month: 'Mes actual', lastMonth: 'Mes anterior', last30: 'Últimos 30 días' };
        this.views        = { turns: { url: 'ctrl/ctrl-turno.php', opc: 'lsTurns' }, days: { url: 'ctrl/ctrl-cierre.php', opc: 'lsDays' } };
        this.request      = 0;
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

        if (dataInit.status != 200) return this.blocked(dataInit.message || 'No se pudo cargar Cortes. Recarga la página.');

        if (!this.can('show')) return this.blocked('Tu rol no tiene permiso para ver los cortes de esta sucursal.');

        this.filterBar();
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
                    monthNames:       ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
                },
                ranges: Object.fromEntries(Object.entries(this.ranges).map(([range, label]) => [label, this.rangeDates(range)]))
            },
            onSelect: () => this.onFilterChange()
        });
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
                    {
                        type:  'div',
                        class: 'cp-migas',
                        children: [
                            { type: 'span', class: 'cp-migas-raiz', text: 'Huubie' },
                            { type: 'span', class: 'cp-migas-sep', text: '/' },
                            { type: 'span', class: 'cp-migas-raiz', text: 'POS' },
                            { type: 'span', class: 'cp-migas-sep', text: '/' },
                            { type: 'span', class: 'cp-migas-actual', text: 'Cortes' }
                        ]
                    },
                    { type: 'h1', class: 'cp-pagina-titulo', text: 'Cortes' },
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
            class:        'flex gap-[8px]',
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

    // -- CRUD --

    async lsCuts() {
        const request = ++this.request;
        const filters = this.filters;
        const view    = this.views[filters.view];

        $(`#container${this.PROJECT_NAME}`).addClass('opacity-50');

        const data = await useFetch({ url: view.url, data: { opc: view.opc, fi: filters.fi, ff: filters.ff } });

        if (request !== this.request) return;

        const loaded = Boolean(data && data.status == 200);

        if (!loaded) alert({ icon: 'error', title: 'No se pudo cargar la lista', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

        $('ul.ct3-dropdown-menu').remove();
        $(`#container${this.PROJECT_NAME}`).removeClass('opacity-50');

        const turns = filters.view === 'turns';

        this.createCoffeeTable3({
            parent:  `container${this.PROJECT_NAME}`,
            id:      `tb${this.PROJECT_NAME}`,
            theme:   'light',
            data:    loaded && data.row ? data : { thead: [], row: [] },
            striped: true,
            hover:   true,
            f_size:  13,
            right:   turns ? [4, 5, 6] : [5, 6, 7],
            center:  turns ? [7, 8] : [3, 4],
            ...this.caption(loaded ? data : null, filters)
        });

        if (!loaded || !data.row || !data.row.length) return;

        $(`#tb${this.PROJECT_NAME}`).DataTable({
            dom:          '<"ord-dt-scroll"t><"ord-dt-foot"ip>',
            pageLength:   15,
            ordering:     false,
            searching:    false,
            lengthChange: false,
            destroy:      true,
            autoWidth:    false,
            language: {
                info:       `Mostrando _START_ a _END_ de _TOTAL_ ${turns ? 'turnos' : 'cierres'}`,
                infoEmpty:  turns ? 'Sin turnos' : 'Sin cierres',
                emptyTable: turns ? 'Sin turnos' : 'Sin cierres',
                paginate:   { first: 'Primera', last: 'Última', next: '›', previous: '‹' }
            },
            drawCallback: () => {
                $('ul.ct3-dropdown-menu').addClass('hidden');
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    // Los modales de turno y cierre llaman orders.lsOrders() al guardar.
    lsOrders() {
        this.lsCuts();
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

    caption(data, filters) {
        const turns = filters.view === 'turns';

        if (!data) return { title: null, subtitle: null, emptyMessage: 'No se pudo cargar la lista', emptyIcon: 'icon-attention' };

        const branch  = esc(data.branch || (dataInit.scope || {}).branch || '');
        const count   = Number(data.count || 0);
        const period  = `del ${ordDate(filters.fi)} al ${ordDate(filters.ff)} en ${branch}.`;
        const changed = Number(data.changed || 0);

        if (turns) {
            const drift = changed
                ? ` ${changed} ${changed === 1 ? 'turno cambió' : 'turnos cambiaron'} después de su corte: ábrelo para ver qué y recalcularlo.`
                : '';

            return {
                title:        count ? `${count} ${count === 1 ? 'turno' : 'turnos'}` : 'Sin turnos',
                subtitle:     `Por fecha de apertura, ${period}${drift}`,
                emptyMessage: 'No hay turnos en este periodo',
                emptyIcon:    'icon-clock'
            };
        }

        return {
            title:        count ? `${count} ${count === 1 ? 'cierre' : 'cierres'} del día` : 'Sin cierres',
            subtitle:     `Cierres vigentes ${period} Las cifras son las del cierre.`,
            emptyMessage: 'No hay cierres del día en este periodo',
            emptyIcon:    'icon-calendar-check-o'
        };
    }
}
