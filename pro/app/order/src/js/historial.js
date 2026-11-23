/*  Pedidos › Historial de ventas (pos-historial): fase V2 del plan de Ventas.

    Lista las ventas de mostrador por periodo, turno y método de pago. El
    detalle, el cobro y quitar un pago son los de Pedidos con subclases:
    OrderDetail → SaleDetail y OrderPay → SalePayments. Aquí se agregan
    cancelar la venta y cambiar su cliente.

    Manda el ctrl (ctrl-historial.php): la Cajera solo recibe sus ventas del
    turno abierto; Dueño o Supervisor ven todo y cancelan. `orders` apunta a
    esta pantalla porque el turno, el cierre y el cobro llaman orders.can(),
    orders.paintTurn() y orders.lsOrders(). */

let api = 'ctrl/ctrl-historial.php';
let saleHistory, orders, orderDetail, orderPay, orderTurn, orderClosure;
let dataInit = {};

$(async () => {
    dataInit     = (await useFetch({ url: api, data: { opc: 'init' } })) || {};
    orderTurn    = new OrderTurn('ctrl/ctrl-turno.php', 'root');
    orderClosure = new OrderClosure('ctrl/ctrl-cierre.php', 'root');
    orderDetail  = new SaleDetail(api, 'root');
    orderPay     = new SalePayments(api, 'root');
    saleHistory  = new SaleHistory(api, 'root');
    orders       = saleHistory;

    saleHistory.init();
});

// -- SaleHistory --

class SaleHistory extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'SaleHistory';
        this.ranges       = { today: 'Hoy', yesterday: 'Ayer', week: 'Semana actual', month: 'Mes actual', lastMonth: 'Mes anterior' };
        this.request      = 0;
        this.pageLength   = 15;
    }

    // La Cajera no filtra: el ctrl le fija su usuario y el turno abierto.
    get own() {
        return !dataInit.can_all;
    }

    get filters() {
        if (this.own) return {};

        return {
            ...getDataRangePicker('his_calendar'),
            turn_id:   $('#his_turn').val() || 0,
            method_id: $('#his_method').val() || 0
        };
    }

    // -- Interface --

    init() {
        this.render();
    }

    render() {
        this.layout();
        this.header();

        if (dataInit.status != 200) return this.blocked(dataInit.message || 'No se pudo cargar el historial. Recarga la página.');

        if (!this.canHistory('show')) return this.blocked('Tu rol no tiene permiso para ver el historial de ventas en esta sucursal.');

        if (!this.own) this.filterBar();

        this.lsOrders();
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

        // "Mostrar N registros" (lo mueve lsOrders) y los totales del periodo, sobre la tabla.
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
                            { type: 'div', id: `length${this.PROJECT_NAME}`, class: 'ord-dt-length dataTables_wrapper' },
                            { type: 'div', id: `summary${this.PROJECT_NAME}`, class: 'his-summary' }
                        ]
                    },
                    { type: 'div', id: `table${this.PROJECT_NAME}`, class: 'w-full' }
                ]
            }
        });
    }

    filterBar() {
        const col = 'col-12 col-sm-6 col-lg-3';

        this.createfilterBar({
            parent:     `filterBar${this.PROJECT_NAME}`,
            id:         `fb${this.PROJECT_NAME}`,
            prefijo:    'his_',
            coffeesoft: true,
            data: [
                {
                    opc:      'input-calendar',
                    id:       'calendar',
                    lbl:      'Periodo',
                    required: false,
                    readonly: true,
                    class:    col
                },
                {
                    opc:      'select',
                    id:       'turn',
                    lbl:      'Turno',
                    required: false,
                    class:    col,
                    data:     [{ id: '', valor: 'Todos los turnos' }],
                    onchange: 'saleHistory.lsOrders()'
                },
                {
                    opc:      'select',
                    id:       'method',
                    lbl:      'Método de pago',
                    required: false,
                    class:    col,
                    data:     [{ id: '', valor: 'Todos' }, ...(dataInit.methods || [])],
                    onchange: 'saleHistory.lsOrders()'
                }
            ]
        });

        const today = this.rangeDates('today');

        dataPicker({
            parent: 'his_calendar',
            type:   'all',
            rangepicker: {
                startDate:     today[0],
                endDate:       today[1],
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
                    { type: 'h1', class: 'cp-pagina-titulo', text: 'Historial de ventas' },
                    { type: 'p', class: 'cp-pagina-subtitulo', text: [scope.company, scope.branch].filter(Boolean).join(' · ') || 'Ventas de mostrador de la sucursal' }
                ]
            }
        });

        if (dataInit.status != 200 || !this.canHistory('show')) return;

        this.paintTurn();

        orderTurn.paintStrip(true);
    }

    // «Cierre del día» del encabezado. El turno lo muestra la franja de caja (caja-strip.js).
    // orderTurn.sync() lo repinta: el botón abre el día pendiente si lo hay.
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
            id:           'formHeaderHistory',
            class:        'flex gap-[8px]',
            showRequired: false,
            json: [
                {
                    opc:       'button',
                    id:        'btnDayHistory',
                    class:     'col-auto',
                    text:      'Cierre del día',
                    icon:      'icon-calendar-check-o',
                    color_btn: 'success',
                    onClick:   () => orderClosure.open(pending)
                }
            ]
        });

        // Sin un turno cerrado no se cierra el día: la regla de todas las pantallas (orderTurn.dayReady).
        ordLock('btnDayHistory', !orderTurn.dayReady(), orderTurn.dayWhy());
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

    // Los turnos del periodo. Conserva el elegido si sigue en la lista.
    paintTurns(turns) {
        const select = $('#his_turn');
        if (!select.length) return;

        const current = String(select.val() || '');

        select.empty();

        [{ id: '', valor: 'Todos los turnos' }, ...turns].forEach((t) => select.append($('<option>', { value: t.id, text: t.valor })));

        select.val(turns.some((t) => String(t.id) === current) ? current : '');
    }

    // Lo que ve la Cajera en lugar de los filtros.
    paintOwn(own) {
        if (!own) return;

        const text = own.open
            ? `Tus ventas del turno <b>${esc(own.turn_folio)}</b>. Para ver otros turnos, pide acceso a Dueño o Supervisor.`
            : 'No hay turno abierto: aquí verás tus ventas cuando se abra uno.';

        this.createLayout({
            parent: `filterBar${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `own${this.PROJECT_NAME}`,
                class: 'his-own',
                container: [
                    { type: 'i', class: 'icon-user' },
                    { type: 'span', html: text }
                ]
            }
        });
    }

    // Ventas cobradas, total, propinas y canceladas del periodo.
    paintSummary(s) {
        const box = $(`#summary${this.PROJECT_NAME}`);

        if (!s) return box.empty();

        const chip = (label, value, tone) => `<span class="his-chip${tone ? ' ' + tone : ''}">${label} <b>${value}</b></span>`;

        box.html([
            chip('Ventas', Number(s.count || 0)),
            chip('Total', money(s.total)),
            Number(s.tips) > 0.005 ? chip('Propinas', money(s.tips)) : '',
            Number(s.cancelled) > 0 ? chip('Canceladas', Number(s.cancelled), 'is-cancel') : ''
        ].join(''));
    }

    // -- CRUD --

    async lsOrders() {
        const request = ++this.request;

        $(`#table${this.PROJECT_NAME}`).addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'lsSales', ...this.filters } });

        if (request !== this.request) return;

        const loaded = Boolean(data && data.status == 200);

        if (!loaded) alert({ icon: 'error', title: 'No se pudo cargar el historial', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

        $('ul.ct3-dropdown-menu').remove();
        $(`#table${this.PROJECT_NAME}`).removeClass('opacity-50');

        if (loaded) {
            this.paintOwn(data.own);
            this.paintTurns(data.turns || []);
        }

        this.paintSummary(loaded ? data.summary : null);

        this.createCoffeeTable3({
            parent:  `table${this.PROJECT_NAME}`,
            id:      `tb${this.PROJECT_NAME}`,
            theme:   'light',
            data:    loaded && data.row ? data : { thead: [], row: [] },
            striped: true,
            hover:   true,
            f_size:  13,
            right:   [7, 8],
            center:  [2, 5, 9, 10],
            ...ORD_TABLE,
            ...this.emptyState(loaded ? data : null)
        });

        $(`#length${this.PROJECT_NAME}`).empty();

        if (!loaded || !data.row || !data.row.length) return;

        $(`#tb${this.PROJECT_NAME} [data-cancelled]`).closest('tr').addClass('ord-row-cancel');

        // El ctrl ya ordena (lo más nuevo arriba) y las celdas no traen data-order: sin orden por columna.
        const table = $(`#tb${this.PROJECT_NAME}`).DataTable({
            dom:          'l<"ord-dt-scroll"t><"ord-dt-foot"ip>',
            pageLength:   this.pageLength,
            lengthMenu:   [10, 15, 25, 50],
            ordering:     false,
            searching:    false,
            lengthChange: true,
            destroy:      true,
            autoWidth:    false,
            language: {
                lengthMenu: 'Mostrar _MENU_ registros por página',
                info:       'Mostrando _START_ a _END_ de _TOTAL_ ventas',
                infoEmpty:  'Sin ventas',
                emptyTable: 'Sin ventas',
                paginate:   { first: 'Primera', last: 'Última', next: '›', previous: '‹' }
            },
            drawCallback: (settings) => {
                ordStripe(settings.nTBody);
                $('ul.ct3-dropdown-menu').addClass('hidden');
                if (window.lucide) lucide.createIcons();
            }
        }).on('length.dt', (e, settings, len) => { this.pageLength = len; });

        $(`#length${this.PROJECT_NAME}`).append($(table.table().container()).find('.dataTables_length'));
    }

    // -- Complements --

    onBranchChange() {
        location.reload();
    }

    // Otro periodo trae otros turnos: el elegido ya no aplica.
    onPeriodChange() {
        $('#his_turn').val('');
        this.lsOrders();
    }

    // Lo que piden el turno, el cierre y el cobro (permisos de pos-ventas).
    can(action) {
        return (dataInit.actions || []).includes(action);
    }

    canHistory(action) {
        return (dataInit.history || []).includes(action);
    }

    rangeDates(range) {
        const server = moment(dataInit.today, 'YYYY-MM-DD', true);
        const today  = server.isValid() ? server : moment();

        switch (range) {
            case 'today':     return [today.clone(), today.clone()];
            case 'yesterday': return [today.clone().subtract(1, 'days'), today.clone().subtract(1, 'days')];
            case 'week':      return [today.clone().startOf('isoWeek'), today.clone()];
            case 'lastMonth': return [today.clone().subtract(1, 'months').startOf('month'), today.clone().subtract(1, 'months').endOf('month')];
            default:          return [today.clone().startOf('month'), today.clone()];
        }
    }

    emptyState(data) {
        if (!data) return { emptyMessage: 'No se pudo cargar el historial de ventas', emptyIcon: 'icon-attention' };

        if (data.own && !data.own.open) return { emptyMessage: 'No hay turno abierto', emptyIcon: 'icon-lock' };

        if (data.own) return { emptyMessage: 'Aún no registras ventas en este turno', emptyIcon: 'icon-clock' };

        return { emptyMessage: 'No hay ventas con estos filtros', emptyIcon: 'icon-calendar-1' };
    }
}

// -- SaleDetail --

/*  El detalle de Pedidos con lo de una venta: sin entrega ni edición, con
    propina, turno y cierre del día, y los botones Cambiar cliente y Cancelar. */
class SaleDetail extends OrderDetail {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'SaleDetail';
        this.editable     = false;
        this.busy         = false;
        this.last         = null;   // la última venta abierta (SalePayments la lee)
    }

    async fetchOrder(id) {
        const data = await super.fetchOrder(id);

        if (data) this.last = data;

        return data;
    }

    async show(id) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        const data = await this.fetchOrder(id);
        if (!data) return;

        const o        = data.order;
        const canPrint = (data.actions || []).includes('print');

        this.galleries = {};

        this.csModal({
            id:         'modalOrderDetails',
            title:      `Venta V${o.folio || o.id}`,
            lucideIcon: 'receipt',
            width:      'max-w-5xl',
            saveText:   false,
            cancelText: 'Cerrar',
            action:     canPrint ? { text: 'Imprimir', lucideIcon: 'printer', onClick: () => this.printData(data) } : null,
            body: `
                <div id="orderDetailsContainer" class="flex flex-col lg:flex-row gap-[16px] p-[20px] h-[70vh] overflow-y-auto">
                    <div class="lg:w-1/3 flex flex-col gap-[16px] min-w-0">
                        ${this.infoOrder(data)}
                        ${this.infoSales(data)}
                        ${this.historyCard(data.history || [])}
                    </div>
                    <div class="lg:w-2/3 min-w-0">
                        ${this.listProducts(data.lines || [])}
                    </div>
                </div>`
        });

        $('#modalOrderDetails .cs-modal-title').after(this.badges(data));

        this.bindGalleries();

        if (window.lucide) lucide.createIcons();
    }

    // -- Insignias bajo el titulo --

    badges(data) {
        const o      = data.order;
        const tone   = this.tones()[Number(o.sale_status_id)] || 'bg-slate-100 text-slate-600';
        const chip   = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap';
        const turn   = o.turn_folio
            ? `<span class="${chip} bg-gray-100 text-gray-600"><i data-lucide="timer" class="w-3 h-3"></i>Turno ${esc(o.turn_folio)} · ${o.turn_status === 'open' ? 'abierto' : 'cerrado'}</span>`
            : '';

        return `
            <div class="flex flex-wrap items-center gap-1.5 mt-1">
                <span class="${chip} bg-gray-100 text-gray-600"><i data-lucide="house" class="w-3 h-3"></i>${esc(data.branch)}</span>
                <span class="${chip} ${tone}">${esc(o.status || 'Sin estado')}</span>
                <span class="${chip} bg-gray-100 text-gray-600"><i data-lucide="store" class="w-3 h-3"></i>Mostrador</span>
                ${turn}
            </div>`;
    }

    // -- Informacion de la venta --

    infoOrder(data) {
        const o       = data.order;
        const none    = '<span class="font-normal text-gray-400">Sin registro</span>';
        const contact = [o.phone, o.email].filter(Boolean).map(esc).join(' · ');

        const rows = [
            this.infoRow('file-text', 'Folio', `V${esc(o.folio || o.id)}`),
            this.infoRow('user', 'Cliente', o.customer ? esc(o.customer) : 'Público en general', contact),
            this.infoRow('clock', 'Fecha', ordDate(o.created_at, true)),
            this.infoRow('user-pen', 'Atendió', o.created_by ? esc(o.created_by) : none),
            this.infoRow('timer', 'Turno', o.turn_folio ? esc(o.turn_folio) : none, o.turn_folio ? (o.turn_status === 'open' ? 'Abierto' : 'Cerrado') : '')
        ];

        if (o.closure_day) rows.push(this.infoRow('calendar-check', 'Cierre del día', ordDate(o.closure_day)));

        const note = o.note
            ? `<div class="ord-well mt-2 p-[10px] rounded-lg bg-[#fff] border-[1px] border-gray-200 text-[12.5px] text-gray-600">
                   <span class="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Nota</span>${esc(o.note)}
               </div>`
            : '';

        return this.card('info', 'Información de la venta', `<div class="divide-y divide-gray-200">${rows.join('')}</div>${note}${this.cancelBox(o)}`, this.saleActions(data));
    }

    saleActions(data) {
        const id  = Number(data.order.id);
        const can = data.can || {};
        const out = [];

        // V7: el enlace solo llega con el permiso de imprimir (ctrl saleBundle).
        if (data.share && data.share.link) {
            out.push(`<button type="button" class="ord-undeliver" onclick="orderDetail.shareTicket()">
                          <i data-lucide="message-circle" class="w-4 h-4"></i>Enviar ticket
                      </button>`);
        }

        if (can.customer) {
            out.push(`<button type="button" class="ord-undeliver" onclick="orderDetail.changeCustomer(${id})">
                          <i data-lucide="user-pen" class="w-4 h-4"></i>Cambiar cliente
                      </button>`);
        }

        if (can.cancel) {
            out.push(`<button type="button" class="ord-sale-cancel" onclick="orderDetail.cancel(${id}, { fromDetail: true })">
                          <i data-lucide="circle-x" class="w-4 h-4"></i>Cancelar venta
                      </button>`);
        }

        return out.length ? `<div class="flex flex-wrap gap-[6px]">${out.join('')}</div>` : '';
    }

    // -- Enviar ticket (V7) --

    shareTicket() {
        const data = this.last;

        if (!data) return;

        this.ticketShare(data.share, data.ticket || {});
    }

    cancelBox(o) {
        return super.cancelBox(o).replace('Pedido cancelado', 'Venta cancelada');
    }

    // -- Resumen de pago --

    // Lo que se debe es el total más la propina (order.due, del ctrl).
    infoSales(data) {
        const o         = data.order;
        const can       = data.can || {};
        const cancelled = Number(o.sale_status_id) === 4;
        const total     = Number(o.total || 0);
        const tip       = Number(o.tip_amount || 0);
        const due       = o.due !== undefined ? Number(o.due) : ordRound(total + tip);
        const paid      = Number(o.paid || 0);
        const discount  = Number(o.discount_amount || 0);
        const balance   = ordRound(due - paid);
        const payments  = data.payments || [];

        const line = (label, value, cls) => `
            <div class="flex items-center justify-between text-[13px] py-1">
                <span class="text-gray-500">${label}</span><span class="${cls || 'text-gray-800'}">${value}</span>
            </div>`;

        let discountHtml = '';

        if (discount > 0) {
            const why = [o.discount_percent > 0 ? `${Number(o.discount_percent)}%` : '', o.discount_reason, o.discount_note]
                .filter(Boolean).map(esc).join(' · ');

            discountHtml = line('Descuento', `−${money(discount)}`, 'font-semibold text-amber-600')
                         + (why ? `<p class="text-[11.5px] text-amber-600 text-right -mt-0.5 mb-1">${why}</p>` : '');
        }

        const tipHtml = tip > 0.005
            ? line('Propina', money(tip)) + line('Cobrado', money(due), 'text-base font-bold text-gray-900')
            : '';

        // Vendida a crédito: lo que falta no es un faltante, es la cuenta del cliente.
        const onCredit = Number(o.on_credit) === 1;

        const balanceHtml = cancelled
            ? line('Saldo', 'No se cobra', 'font-semibold text-gray-400')
            : balance > 0.005
                ? (onCredit
                    ? line('A crédito', money(balance), 'text-base font-bold text-amber-600')
                    : line('Saldo', money(balance), 'text-base font-bold text-red-600'))
                : balance < -0.005
                    ? line('Saldo a favor', money(Math.abs(balance)), 'text-base font-bold text-sky-700')
                    : line('Saldo', '$0.00', 'text-base font-bold text-gray-400');

        // La papelera solo en pagos de un turno abierto: el corte cerrado no se mueve.
        const rows = payments.map((p) => this.paymentRow(p, o.id, can.delete_payment && p.turn_status !== 'closed')).join('');

        const body = `
            ${line('Subtotal', money(o.subtotal))}
            ${discountHtml}
            ${line('Total', money(total), tip > 0.005 ? 'font-semibold text-gray-800' : 'text-base font-bold text-gray-900')}
            ${tipHtml}

            <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-[12px] mb-1">Pagos (${payments.length})</p>
            ${payments.length
                ? `<div class="border-l-2 border-gray-200 pl-[12px] flex flex-col gap-2">${rows}</div>`
                : '<p class="text-[12.5px] text-gray-400 mb-0">Sin pagos registrados.</p>'}

            <div class="border-t-[1px] border-gray-200 mt-[12px] pt-2">
                ${line('Pagado', money(paid), 'font-semibold text-emerald-700')}
                ${balanceHtml}
            </div>`;

        const pay = can.pay
            ? `<button type="button" class="ord-pay-open" onclick="orderPay.open(${Number(o.id)}, true)">
                   <i data-lucide="banknote" class="w-4 h-4"></i>Cobrar
               </button>`
            : '';

        return this.card('wallet', 'Resumen de pago', body, pay);
    }

    listProducts(lines) {
        return super.listProducts(lines)
            .replace('Productos del pedido', 'Productos de la venta')
            .replace('Este pedido no contiene productos.', 'Esta venta no contiene productos.');
    }

    // -- Impresion --

    // El ticket de Ventas (ordPrintTicket, formato de alpha) con lo guardado; si se canceló, lo dice.
    printData(data) {
        if (!(data.actions || []).includes('print')) {
            alert({ icon: 'error', text: 'Tu rol no tiene permiso para imprimir ventas en esta sucursal.', btn1: true });
            return;
        }

        ordPrintTicket(data.ticket || {}, { reprint: true });
    }

    // -- Cancelar --

    /*  Antes de pedir el motivo dice qué pasa con el dinero: lo del turno
        abierto sale del corte; lo de un turno cerrado queda como saldo a favor
        del cliente. Sin cliente, eso último no se puede (el ctrl responde 409).
        Lo pagado con monedero regresa al monedero y el adeudo a crédito se anula. */
    async cancel(id, opts = {}) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        if (this.busy) return;

        const data = await this.fetchOrder(id);
        if (!data) return;

        const o   = data.order;
        const can = data.can || {};

        if (!can.cancel) {
            alert({ icon: 'info', title: 'No se puede cancelar', text: can.cancel_reason || 'Tu rol no puede cancelar ventas: lo autoriza Dueño o Supervisor.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        const pays   = data.payments || [];
        const sum    = (list) => ordRound(list.reduce((acc, p) => acc + Number(p.amount || 0), 0));
        const live   = pays.filter((p) => p.turn_status !== 'closed');
        const isPurse = (p) => p.method_code === 'PUNTOS' && Number(o.customer_id) > 0;
        const open   = sum(live.filter((p) => !isPurse(p)));
        const purse  = sum(live.filter(isPurse));
        const closed = sum(pays.filter((p) => p.turn_status === 'closed'));
        const debt   = Number(o.credit || 0);
        const folio  = o.folio || o.id;

        if (closed > 0.005 && Number(o.customer_id) <= 0) {
            alert({
                icon:     'warning',
                title:    'Primero asigna un cliente',
                html:     `<p class="text-[14px] mb-0">La venta V${esc(folio)} tiene <b>${money(closed)}</b> cobrados en un turno que ya cerró y es de Público en general. `
                        + 'Ese dinero no puede salir de un corte cerrado: asígnale un cliente para dejarlo como saldo a favor.</p>',
                btn1:     true,
                btn1Text: 'Entendido'
            });
            return;
        }

        const items = [];

        if (open > 0.005)   items.push(`<li><b>${money(open)}</b> cobrados en el turno abierto se devuelven y <b>salen del corte</b>.</li>`);
        if (purse > 0.005)  items.push(`<li><b>${money(purse)}</b> pagados con monedero <b>regresan al monedero</b> de ${esc(o.customer)}.</li>`);
        if (closed > 0.005) items.push(`<li><b>${money(closed)}</b> cobrados en turnos cerrados quedan como <b>saldo a favor</b> de ${esc(o.customer)}.</li>`);
        if (debt > 0.005)   items.push(`<li>El adeudo a crédito de <b>${money(debt)}</b> <b>se anula</b>: ${esc(o.customer)} ya no lo debe.</li>`);
        if (!items.length)  items.push('<li>La venta no tiene pagos: solo cambia a cancelada.</li>');

        const html = `
            <div class="ord-well p-[12px] rounded-lg bg-gray-50 border-[1px] border-gray-200 text-[12.5px] text-gray-600">
                <p class="font-semibold text-gray-700 mb-1">Qué pasa con el dinero</p>
                <ul class="list-disc pl-[18px] mb-0 flex flex-col gap-1">${items.join('')}</ul>
            </div>`;

        const back = opts.fromDetail ? () => this.show(id) : () => {};

        if (opts.fromDetail) $('#modalOrderDetails .cs-modal-x').trigger('click');

        this.csModal({
            id:         'modalSaleCancel',
            title:      'Cancelar venta',
            subtitle:   `Venta V${folio} · ${money(o.due)}`,
            lucideIcon: 'circle-x',
            width:      'max-w-lg',
            saveText:   'Cancelar venta',
            cancelText: 'Volver',
            info:       'La cancelación queda en la bitácora con tu nombre.',
            json: [
                { id: 'sc_money', tipo: 'html', class: 'w-full', html: html },
                { id: 'sc_reason', lbl: 'Motivo', tipo: 'textarea', required: true, maxlength: 255, rows: 3, ph: 'Ej. El cliente se arrepintió', class: 'w-full' }
            ],
            onSave: (values, close) => this.saveCancel(id, values, close, back)
        });

        orderPay.onDismiss('modalSaleCancel', back);

        $('#sc_reason').trigger('focus');
    }

    async saveCancel(id, values, close, back) {
        if (this.busy) return;

        const reason = String(values.sc_reason || '').trim();

        if (!reason) {
            alert({ icon: 'warning', title: 'Falta el motivo', text: 'Escribe por qué se cancela la venta.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        this.busy = true;

        const button = $('#modalSaleCancel .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'cancelSale', id: id, reason: reason } });

        this.busy = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) {
            alert({
                icon:     data && data.status && data.status < 500 ? 'warning' : 'error',
                title:    'No se canceló la venta',
                text:     (data && data.message) || 'Revisa la conexión y vuelve a intentar.',
                btn1:     true,
                btn1Text: 'Entendido'
            });
            return;
        }

        orderPay.closeQuiet('modalSaleCancel', close);

        orders.lsOrders();
        orderTurn.touch();

        back();

        alert({ icon: 'success', title: 'Venta cancelada', text: data.message, btn1: true, btn1Text: 'Entendido' });
    }

    // -- Cambiar el cliente --

    async changeCustomer(id) {
        if (this.busy) return;

        this.busy = true;

        const data = await useFetch({ url: this._link, data: { opc: 'customerOptions', id: id } });

        this.busy = false;

        if (!data || data.status != 200) {
            alert({ icon: 'error', title: 'No se abrieron los clientes', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        const sale = this.last && Number(this.last.order.id) === Number(id) ? this.last.order : {};
        const back = () => this.show(id);

        $('#modalOrderDetails .cs-modal-x').trigger('click');

        this.csModal({
            id:         'modalSaleCustomer',
            title:      'Cambiar cliente',
            subtitle:   `Venta V${sale.folio || id}`,
            lucideIcon: 'user-pen',
            width:      'max-w-lg',
            saveText:   'Guardar',
            cancelText: 'Volver',
            info:       'El cambio queda en la bitácora. Los pagos no se mueven.',
            json: [
                {
                    id:    'sc_customer',
                    lbl:   'Cliente',
                    tipo:  'select2',
                    data:  [{ id: '', valor: 'Público en general' }, ...(data.customers || [])],
                    empty: false,
                    value: Number(data.customer_id) > 0 ? data.customer_id : '',
                    class: 'w-full'
                }
            ],
            onSave: (values, close) => this.saveCustomer(id, values, close, back)
        });

        orderPay.onDismiss('modalSaleCustomer', back);
    }

    async saveCustomer(id, values, close, back) {
        if (this.busy) return;

        this.busy = true;

        const button = $('#modalSaleCustomer .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'setCustomer', id: id, customer_id: values.sc_customer || '' } });

        this.busy = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) {
            alert({
                icon:     data && data.status && data.status < 500 ? 'warning' : 'error',
                title:    'No se cambió el cliente',
                text:     (data && data.message) || 'Revisa la conexión y vuelve a intentar.',
                btn1:     true,
                btn1Text: 'Entendido'
            });
            return;
        }

        orderPay.closeQuiet('modalSaleCustomer', close);

        orders.lsOrders();

        back();

        alert({ icon: 'success', title: data.message, timer: 1800 });
    }
}

// -- SalePayments --

/*  La ventana de pagos de Pedidos (pedido-cobro.js) con textos de venta. Sin
    descuento (lo da la pantalla de Ventas al cobrar), sin contraseña al quitar
    un pago y con la propina dentro de lo que se debe: payOptions ya manda
    total = total + propina. Una sola sucursal: aquí no se cobra en otra. */
class SalePayments extends OrderPay {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'SalePayments';
        this.tip          = 0;
    }

    start(data, fromDetail, opts) {
        this.tip = Number((data.order && data.order.tip_amount) || 0);

        super.start(data, fromDetail, opts);
    }

    // -- Textos --

    noun()         { return 'Venta'; }
    theNoun()      { return 'la venta'; }
    prefix()       { return 'V'; }
    noClient()     { return 'Público en general'; }
    paidLabel()    { return 'Venta pagada completamente'; }
    paidShort()    { return 'Venta pagada.'; }
    canDiscount()  { return false; }
    keyOnSettled() { return false; }
    fillsBalance() { return true; }
    originLabel()  { return 'Origen de la venta'; }

    // Una venta no se entrega: al liquidarla no pregunta.
    asksDeliver()  { return false; }

    // Bajo el Total: la propina que trae (sola, o después del total tachado).
    totalExtra(after) {
        if (this.tip <= 0.005) return '';

        return after ? ` · propina ${money(this.tip)}` : `Incluye propina ${money(this.tip)}`;
    }

    blockView() {
        const v    = super.blockView();
        const swap = (s) => String(s || '')
            .replace('Pedido cancelado', 'Venta cancelada')
            .replace('Un pedido cancelado', 'Una venta cancelada')
            .replace('Pedido pagado completamente', 'Venta pagada completamente');

        return Object.assign({}, v, { title: swap(v.title), text: swap(v.text) });
    }
}
