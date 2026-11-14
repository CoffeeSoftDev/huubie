/*  Pedidos › Clientes (Etapa 6a).

    El directorio de clientes de la sucursal: quién es, cuánto ha pedido y
    cuánto debe. Alta, edición y baja lógica (no se borra: se desactiva).
    «Historial» lista sus pedidos; los de esta sucursal abren el mismo detalle
    que Pedidos (orderDetail), servido por ctrl-pedidos.

    Crédito y monedero (V3 de Ventas): la lista suma las columnas «Crédito» y
    «Monedero»; el historial muestra la cuenta del cliente y el botón «Abonar».
    Dar crédito y fijar el límite solo le sale a quien puede activar o
    desactivar clientes (hoy el Dueño).

    El detalle, el turno y el cobro llaman a orders.lsOrders(), orders.can() y
    orders.paintTurn(): aquí `orders` es la misma instancia que `customers`. */

let api = 'ctrl/ctrl-clientes.php';
let customers, orders, orderDetail, orderTurn, orderPay, orderClosure;
let dataInit = {};

$(async () => {
    dataInit = (await useFetch({ url: api, data: { opc: 'init' } })) || {};

    orderDetail          = new OrderDetail('ctrl/ctrl-pedidos.php', 'root');
    orderDetail.editable = false;
    orderTurn            = new OrderTurn('ctrl/ctrl-turno.php', 'root');
    orderPay             = new OrderPay('ctrl/ctrl-cobro.php', 'root');
    orderClosure         = new OrderClosure('ctrl/ctrl-cierre.php', 'root');
    customers            = new Customers(api, 'root');
    orders               = customers;
    customers.init();
});

// -- Customers --

class Customers extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Customers';
        this.request      = 0;
        this.pageLength   = 15;
        this.saving       = false;
        this.term         = '';
        this.termDigits   = '';
        this.historyId    = 0;
        this.historyData  = null;
        this.payToken     = '';

        // Filtro propio de DataTables: solo actúa sobre la tabla de clientes.
        $.fn.dataTable.ext.search.push((settings, row) => settings.nTable.id !== `tb${this.PROJECT_NAME}` || this.matches(row[0]));
    }

    get filters() {
        return {
            status: $('#cus_status').val() || '1',
            sort:   $('#cus_sort').val() || 'name'
        };
    }

    // -- Interface --

    init() {
        this.render();
    }

    render() {
        this.layout();
        this.header();

        if (dataInit.status != 200) return this.blocked(dataInit.message || 'No se pudo cargar Clientes. Recarga la página.');

        if (!this.allow('show')) return this.blocked('Tu rol no tiene permiso para ver clientes en esta sucursal.');

        this.filterBar();
        this.searchBar();
        this.lsCustomers();
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

        // El buscador va fuera de la tabla: createCoffeeTable3 la reescribe y el input perdería el foco.
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
                    { type: 'h1', class: 'cp-pagina-titulo', text: 'Clientes' },
                    { type: 'p', class: 'cp-pagina-subtitulo', text: [scope.company, scope.branch].filter(Boolean).join(' · ') || 'Clientes de la sucursal' }
                ]
            }
        });

        if (dataInit.status != 200 || !this.allow('create')) return;

        this.coffeeForm({
            parent:       `headerActions${this.PROJECT_NAME}`,
            id:           'formHeaderCustomers',
            class:        'flex gap-[8px]',
            showRequired: false,
            json: [
                { opc: 'button', id: 'btnNewCustomer', class: 'col-auto', text: 'Nuevo cliente', icon: 'icon-plus', color_btn: 'primary', onClick: () => this.add() }
            ]
        });
    }

    filterBar() {
        this.createfilterBar({
            parent:     `filterBar${this.PROJECT_NAME}`,
            id:         `fb${this.PROJECT_NAME}`,
            prefijo:    'cus_',
            coffeesoft: true,
            data: [
                {
                    opc:      'select',
                    id:       'status',
                    lbl:      'Estado',
                    required: false,
                    class:    'col-6 col-md-4 col-lg-3 col-xl-2',
                    data:     [{ id: '1', valor: 'Activos' }, { id: '0', valor: 'Inactivos' }, { id: 'all', valor: 'Todos' }],
                    onchange: 'customers.lsCustomers()'
                },
                {
                    opc:      'select',
                    id:       'sort',
                    lbl:      'Ordenar por',
                    required: false,
                    class:    'col-6 col-md-4 col-lg-3 col-xl-2',
                    data: [
                        { id: 'name', valor: 'Nombre' },
                        { id: 'recent', valor: 'Último pedido' },
                        { id: 'orders', valor: 'Más pedidos' },
                        { id: 'sold', valor: 'Más vendido' },
                        { id: 'due', valor: 'Mayor saldo por cobrar' }
                    ],
                    onchange: 'customers.lsCustomers()'
                }
            ]
        });
    }

    // Sobre la tabla, a la derecha de «Mostrar N registros» (como en Pedidos).
    searchBar() {
        this.createfilterBar({
            parent:     `search${this.PROJECT_NAME}`,
            id:         `fbSearch${this.PROJECT_NAME}`,
            prefijo:    'cus_',
            coffeesoft: true,
            data: [
                {
                    opc:         'input',
                    id:          'q',
                    type:        'search',
                    placeholder: 'Buscar nombre, teléfono o correo',
                    required:    false,
                    class:       'col-12'
                }
            ]
        });

        $('#cus_q')
            .attr({ maxlength: 60, autocomplete: 'off', 'aria-label': 'Buscar cliente' })
            .on('input', (e) => this.onSearchInput(e));
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

    async lsCustomers() {
        const request = ++this.request;

        $(`#table${this.PROJECT_NAME}`).addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'lsCustomers', ...this.filters } });

        if (request !== this.request) return;

        const loaded = Boolean(data && data.status == 200);

        if (!loaded) alert({ icon: 'error', title: 'No se pudo cargar la lista', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

        $(`#table${this.PROJECT_NAME}`).removeClass('opacity-50');

        this.createCoffeeTable3({
            parent:  `table${this.PROJECT_NAME}`,
            id:      `tb${this.PROJECT_NAME}`,
            theme:   'light',
            data:    loaded && data.row ? data : { thead: [], row: [] },
            striped: true,
            hover:   true,
            f_size:  13,
            right:   [4, 5, 6, 7, 8],
            center:  [2, 3, 9],
            ...this.emptyState(loaded)
        });

        if (!loaded || !data.row || !data.row.length) return;

        $(`#tb${this.PROJECT_NAME}`).DataTable({
            dom:          '<"ord-dt-top"l><"ord-dt-scroll"t><"ord-dt-foot"ip>',
            pageLength:   this.pageLength,
            lengthMenu:   [10, 15, 25, 50],
            ordering:     false,
            searching:    true,
            lengthChange: true,
            destroy:      true,
            autoWidth:    false,
            language: {
                lengthMenu:   'Mostrar _MENU_ registros por página',
                info:         'Mostrando _START_ a _END_ de _TOTAL_ clientes',
                infoEmpty:    'Sin clientes',
                infoFiltered: '(de _MAX_ en total)',
                emptyTable:   'Sin clientes',
                zeroRecords:  'Ningún cliente coincide con la búsqueda',
                paginate:     { first: 'Primera', last: 'Última', next: '›', previous: '‹' }
            },
            drawCallback: () => {
                if (window.lucide) lucide.createIcons();
            }
        }).on('length.dt', (e, settings, len) => { this.pageLength = len; });
    }

    add() {
        this.form(null);
    }

    async edit(id) {
        const customer = await this.getCustomer(id);

        if (customer) this.form(customer);
    }

    form(customer) {
        if (this.saving) return;

        const scope = dataInit.scope || {};

        const json = [
            { id: 'cf_name', lbl: 'Nombre', required: true, maxlength: 120, value: customer ? customer.name : '', class: 'w-full' },
            { id: 'cf_phone', lbl: 'Teléfono', required: true, maxlength: 16, ph: '10 dígitos', value: customer ? customer.phone : '', help: 'Un teléfono no se repite entre los clientes activos de la sucursal.', class: 'w-full' },
            { id: 'cf_email', lbl: 'Correo', maxlength: 120, ph: 'Opcional', value: customer ? customer.email : '', class: 'w-full' }
        ];

        // Crédito: solo quien puede activar o desactivar clientes. El ctrl ignora estos campos a los demás.
        if (this.allow('delete')) {
            json.push(
                { id: 'cf_credit', lbl: 'Puede comprar a crédito', tipo: 'switch', value: customer ? Number(customer.credit_enabled) : 0, help: 'En «Vender» se podrá dejar el resto a su cuenta.', class: 'w-full' },
                { id: 'cf_limit', lbl: 'Límite de crédito ($)', tipo: 'number', min: 0, step: '0.01', ph: '0.00', value: customer && Number(customer.credit_limit) > 0 ? customer.credit_limit : '', help: 'Lo más que puede deber a la vez.', class: 'w-full' }
            );
        }

        this.csModal({
            id:         'modalCustomer',
            title:      customer ? 'Editar cliente' : 'Nuevo cliente',
            subtitle:   scope.branch ? `Sucursal ${scope.branch}` : '',
            lucideIcon: customer ? 'pencil' : 'user-plus',
            width:      'max-w-md',
            saveText:   customer ? 'Guardar cambios' : 'Agregar cliente',
            cancelText: 'Cancelar',
            json:       json,
            onSave: (values, close) => this.save(customer, values, close)
        });

        $('#cf_phone')
            .attr({ inputmode: 'numeric', autocomplete: 'off' })
            .on('input', (e) => { e.target.value = e.target.value.replace(/[^\d\s-]/g, ''); });

        $('#cf_email').attr({ inputmode: 'email', autocomplete: 'off' });
    }

    async save(customer, values, close) {
        if (this.saving) return;

        const name  = String(values.cf_name || '').trim().replace(/\s+/g, ' ');
        const phone = String(values.cf_phone || '').replace(/\D/g, '');
        const email = String(values.cf_email || '').trim();

        if (!name) return this.warn('Escribe el nombre del cliente.');
        if (phone.length !== 10) return this.warn('El teléfono debe tener 10 dígitos.');
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return this.warn('El correo no tiene un formato válido.');

        const payload = { opc: customer ? 'editCustomer' : 'addCustomer', id: customer ? customer.id : 0, name: name, phone: phone, email: email };

        if (this.allow('delete')) {
            const credit = Number(values.cf_credit) === 1;
            const limit  = String(values.cf_limit || '').trim() === '' ? 0 : ordAmount(values.cf_limit);

            if (limit === null)       return this.warn('El límite de crédito no es un monto válido (hasta $999,999, con 2 decimales).');
            if (credit && limit <= 0) return this.warn('Para dar crédito escribe un límite mayor a $0.');

            payload.credit_enabled = credit ? 1 : 0;
            payload.credit_limit   = limit;
        }

        this.saving = true;

        const button = $('#modalCustomer .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: payload });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) return this.fail(data, 'No se guardó el cliente');

        close();
        alert({ icon: 'success', title: data.message, timer: 1400 });
        this.lsCustomers();
    }

    // No borra: desactiva. El cliente deja de salir en la captura.
    async status(id, active) {
        if (this.saving) return;

        const customer = await this.getCustomer(id);

        if (!customer) return;

        const name = customer.name || 'este cliente';
        const r    = await alert({
            icon:     active ? 'question' : 'warning',
            title:    active ? `¿Reactivar a ${name}?` : `¿Desactivar a ${name}?`,
            text:     active ? 'Volverá a salir al capturar pedidos.' : 'Dejará de salir al capturar pedidos. Sus pedidos no cambian.',
            btn1:     true,
            btn1Text: active ? 'Reactivar' : 'Desactivar',
            btn2:     true,
            btn2Text: 'Cancelar'
        });

        if (!r || !r.isConfirmed || this.saving) return;

        this.saving = true;

        const data = await useFetch({ url: this._link, data: { opc: 'statusCustomer', id: id, active: active } });

        this.saving = false;

        if (!data || data.status != 200) return this.fail(data, 'No se cambió el estado');

        alert({ icon: 'success', title: data.message, timer: 1400 });
        this.lsCustomers();
    }

    async getCustomer(id) {
        const data = await useFetch({ url: this._link, data: { opc: 'getCustomer', id: id } });

        if (data && data.status == 200) return data.row;

        this.fail(data, 'No se pudo abrir el cliente');

        return null;
    }

    // -- Historial --

    async history(id) {
        const data = await this.getHistory(id);

        if (!data) return;

        const c = data.customer;

        this.historyId   = id;
        this.historyData = data;

        this.csModal({
            id:         'modalCustomerHistory',
            title:      c.name || 'Sin nombre',
            subtitle:   [c.phone, c.email, c.since ? `Cliente desde ${c.since}` : ''].filter(Boolean).join(' · '),
            lucideIcon: 'history',
            width:      'max-w-3xl',
            saveText:   false,
            cancelText: 'Cerrar',
            body:       `<div id="customerHistory" class="cus-history">${this.historyBody(data)}</div>`
        });

        $('#modalCustomerHistory')
            .on('click', 'button.cus-order', (e) => orderDetail.show(Number(e.currentTarget.dataset.id)))
            .on('click', 'button.cus-pay', () => this.pay());
    }

    async getHistory(id) {
        const data = await useFetch({ url: this._link, data: { opc: 'lsHistory', id: id } });

        if (data && data.status == 200) return data;

        this.fail(data, 'No se pudo cargar el historial');

        return null;
    }

    // Tras cobrar o entregar desde el detalle: el historial abierto se vuelve a pintar.
    async refreshHistory() {
        if (!this.historyId || !$('#customerHistory').length) return;

        const data = await this.getHistory(this.historyId);

        if (!data || !$('#customerHistory').length) return;

        this.historyData = data;

        $('#customerHistory').html(this.historyBody(data));

        if (window.lucide) lucide.createIcons();
    }

    historyBody(data) {
        const s     = data.summary || {};
        const rows  = data.row || [];
        const notes = [];

        if (s.quotes)    notes.push(`${s.quotes} ${s.quotes === 1 ? 'cotización' : 'cotizaciones'}`);
        if (s.cancelled) notes.push(`${s.cancelled} ${s.cancelled === 1 ? 'cancelado' : 'cancelados'}`);
        if (data.more)   notes.push(`se muestran los ${data.max} pedidos más recientes y el resumen es de esos`);

        const tiles = [
            { label: 'Pedidos', value: s.orders || 0, tone: '' },
            { label: 'Vendido', value: s.sold, tone: '' },
            { label: 'Cobrado', value: s.paid, tone: '' },
            { label: 'Por cobrar', value: s.due, tone: s.has_due ? 'is-due' : '' }
        ];

        const summary = `
            ${this.creditBlock(data)}
            <div class="cus-tiles">
                ${tiles.map((t) => `<div class="cus-tile ${t.tone}"><span class="cus-tile-label">${esc(t.label)}</span><span class="cus-tile-value">${esc(t.value)}</span></div>`).join('')}
            </div>
            <p class="cus-note">Cuentan pedidos pendientes y pagados${notes.length ? '. Además: ' + esc(notes.join('; ')) : ''}.</p>`;

        if (!rows.length) return `${summary}<div class="cus-empty"><i data-lucide="inbox" class="w-5 h-5"></i>Este cliente aún no tiene pedidos.</div>`;

        return `${summary}<div class="cus-orders">${rows.map((o) => this.historyRow(o)).join('')}</div>`;
    }

    // Los de esta sucursal abren el detalle; los de otra solo se listan.
    historyRow(o) {
        const sub = [o.created, o.delivery ? `Entrega ${o.delivery}` : '', o.same_branch ? '' : (o.branch ? `Sucursal ${o.branch}` : 'Otra sucursal')].filter(Boolean);

        const inner = `
            <span class="cus-order-main">
                <span class="cus-order-folio">${esc(o.folio)}</span>
                <span class="cus-order-sub">${esc(sub.join(' · '))}</span>
            </span>
            <span class="cus-order-state">${o.status}</span>
            <span class="cus-order-money">
                <span class="cus-order-total">${esc(o.total)}</span>
                <span class="cus-order-due ${o.due ? 'is-due' : ''}">${o.due ? 'Debe ' + esc(o.due) : 'Abonado ' + esc(o.paid)}</span>
            </span>
            ${o.can_open ? '<i data-lucide="chevron-right" class="cus-order-go w-4 h-4"></i>' : '<span class="cus-order-go"></span>'}`;

        return o.can_open
             ? `<button type="button" class="cus-order" data-id="${Number(o.id)}" aria-label="Ver pedido ${esc(o.folio)}">${inner}</button>`
             : `<div class="cus-order is-static">${inner}</div>`;
    }

    // -- Crédito --

    /*  La cuenta del cliente: lo que debe de ventas a crédito, su límite, lo que
        le queda y su monedero. No sale si el cliente no tiene nada de eso. */
    creditBlock(data) {
        const c     = data.credit || {};
        const moves = c.moves || [];

        if (!c.enabled && !c.has_debt && !c.has_wallet && !moves.length) return '';

        const tiles = [
            { label: 'Debe a crédito', value: c.debt, tone: c.has_debt ? 'is-credit' : '' },
            { label: 'Límite', value: c.enabled ? c.limit : 'Sin crédito', tone: c.enabled ? '' : 'is-off' },
            { label: 'Disponible', value: c.enabled ? c.available : '-', tone: c.enabled ? '' : 'is-off' },
            { label: 'Monedero', value: c.wallet, tone: c.has_wallet ? 'is-wallet' : '' }
        ];

        const pay = c.can_pay
            ? '<button type="button" class="cus-pay"><i data-lucide="hand-coins" class="w-4 h-4"></i><span>Abonar</span></button>'
            : '';

        const list = moves.length
            ? `<div class="cus-moves">${moves.map((m) => this.moveRow(m)).join('')}</div>`
            : '';

        return `
            <section class="cus-credit" aria-label="Crédito y monedero">
                <div class="cus-credit-head">
                    <p class="cus-credit-title">Crédito y monedero</p>
                    ${pay}
                </div>
                <div class="cus-tiles">
                    ${tiles.map((t) => `<div class="cus-tile ${t.tone}"><span class="cus-tile-label">${esc(t.label)}</span><span class="cus-tile-value">${esc(t.value)}</span></div>`).join('')}
                </div>
                ${list}
            </section>`;
    }

    // Un cargo (venta a crédito) o un abono de la cuenta.
    moveRow(m) {
        const sub = [m.folio, m.date, m.method].filter(Boolean);

        return `
            <div class="cus-move is-${m.kind === 'cargo' ? 'cargo' : 'abono'}">
                <span class="cus-move-main">
                    <span class="cus-move-label">${esc(m.label)}</span>
                    <span class="cus-move-sub">${esc(sub.join(' · '))}</span>
                </span>
                <span class="cus-move-amount">${m.kind === 'cargo' ? '+' : '−'} ${esc(m.amount)}</span>
            </div>`;
    }

    // Ventana «Abonar»: el dinero entra al turno abierto y baja la cuenta del cliente.
    pay() {
        const data = this.historyData;
        const c    = data && data.credit;

        if (!c || !c.can_pay || this.saving) return;

        const methods = data.methods || [];

        if (!methods.length) return this.warn('No hay métodos de pago activos para recibir el abono.');

        // Un token por ventana: si la red reintenta el envío, el abono no se guarda dos veces.
        this.payToken = ordToken();

        this.csModal({
            id:         'modalCreditPay',
            title:      'Abonar a crédito',
            subtitle:   `${data.customer.name || 'Sin nombre'} · debe ${c.debt}`,
            lucideIcon: 'hand-coins',
            width:      'max-w-md',
            saveText:   'Registrar abono',
            cancelText: 'Cancelar',
            info:       'Entra al corte del turno abierto.',
            json: [
                { id: 'cp_amount', lbl: 'Monto del abono', tipo: 'number', min: 0, step: '0.01', required: true, value: Number(c.debt_value).toFixed(2), help: 'Se aplica primero a la venta más antigua.', class: 'w-full' },
                { id: 'cp_method', lbl: 'Método de pago', tipo: 'select', empty: false, required: true, data: methods.map((m) => ({ id: m.id, valor: m.name })), value: methods[0].id, class: 'w-full' },
                { id: 'cp_tendered', lbl: 'Recibe en efectivo', tipo: 'number', min: 0, step: '0.01', ph: 'Igual al abono', help: 'Vacío = paga exacto, sin cambio.', class: 'w-full cp-cash' }
            ],
            onSave: (values, close) => this.savePay(values, close)
        });

        // «Recibe en efectivo» solo aplica al efectivo.
        const paint = () => {
            const method = methods.find((m) => Number(m.id) === Number($('#cp_method').val()));

            $('#modalCreditPay .cp-cash').toggleClass('hidden', !(method && Number(method.is_cash) === 1));
        };

        $('#cp_method').on('change', paint);
        paint();
    }

    async savePay(values, close) {
        const data = this.historyData;
        const c    = data && data.credit;

        if (!c || this.saving) return;

        const amount = ordAmount(values.cp_amount);
        const method = (data.methods || []).find((m) => Number(m.id) === Number(values.cp_method));

        if (amount === null || amount <= 0)               return this.warn('Escribe cuánto abona el cliente.');
        if (amount > Number(c.debt_value) + 0.005)        return this.warn(`El abono (${money(amount)}) pasa de lo que debe (${c.debt}).`);
        if (!method)                                      return this.warn('Elige el método de pago.');

        const cash   = Number(method.is_cash) === 1;
        let tendered = amount;

        if (cash && String(values.cp_tendered || '').trim() !== '') {
            tendered = ordAmount(values.cp_tendered);

            if (tendered === null)         return this.warn('Lo recibido no es un monto válido.');
            if (tendered + 0.005 < amount) return this.warn(`Lo recibido (${money(tendered)}) no alcanza para ${money(amount)}.`);
        }

        this.saving = true;

        const button = $('#modalCreditPay .cs-modal-save').prop('disabled', true);
        const res    = await useFetch({
            url:  this._link,
            data: { opc: 'addCreditPayment', id: this.historyId, amount: amount, method_id: method.id, tendered: tendered, token: this.payToken }
        });

        this.saving = false;
        button.prop('disabled', false);

        if (res && Number(res.status) === 423) {
            return alert({ icon: 'warning', title: res.title || 'Sin turno abierto', text: res.message || 'Abre un turno para recibir el abono.', btn1: true, btn1Text: 'Entendido' });
        }

        if (!res || res.status != 200) return this.fail(res, 'No se registró el abono');

        close();

        // Con cambio el aviso se queda hasta que lo cierren: la cajera tiene que verlo.
        const change = Number(res.change) > 0.005;
        const text   = [res.detail || '', change ? `Cambio: ${money(res.change)}.` : ''].filter(Boolean).join(' ');

        alert(change
            ? { icon: 'success', title: res.message, text: text, btn1: true, btn1Text: 'Listo' }
            : { icon: 'success', title: res.message, text: text, timer: 1800 });

        this.lsCustomers();
        this.refreshHistory();
    }

    // -- Complements --

    onBranchChange() {
        location.reload();
    }

    onSearchInput(e) {
        this.term       = this.plain(e.target.value.trim());
        this.termDigits = this.term.replace(/\D/g, '');

        if ($.fn.DataTable.isDataTable(`#tb${this.PROJECT_NAME}`)) $(`#tb${this.PROJECT_NAME}`).DataTable().draw();
    }

    // Sin acentos ni mayúsculas; el teléfono se compara solo por dígitos.
    matches(cell) {
        if (!this.term) return true;

        const text = this.plain(String(cell || '').replace(/<[^>]*>/g, ' '));

        if (text.includes(this.term)) return true;

        return this.termDigits.length >= 3 && this.termDigits.length === this.term.replace(/[\s-]/g, '').length && text.replace(/\D/g, '').includes(this.termDigits);
    }

    plain(text) {
        return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }

    // Permisos de la sección Clientes.
    allow(action) {
        return (dataInit.clients || []).includes(action);
    }

    // Permisos de Pedidos: los piden el detalle, el turno y el cobro.
    can(action) {
        return (dataInit.actions || []).includes(action);
    }

    lsOrders() {
        this.lsCustomers();
        this.refreshHistory();
    }

    // Esta página no pinta el chip del turno.
    paintTurn() {}

    emptyState(loaded) {
        if (!loaded) return { emptyMessage: 'No se pudo cargar la lista de clientes', emptyIcon: 'icon-attention' };

        return { emptyMessage: 'No hay clientes con este filtro', emptyIcon: 'icon-users' };
    }

    warn(text) {
        alert({ icon: 'warning', title: 'Falta un dato', text: text, btn1: true, btn1Text: 'Entendido' });
    }

    fail(data, title) {
        const soft = data && [403, 404, 409, 422].includes(Number(data.status));

        alert({
            icon:     soft ? 'warning' : 'error',
            title:    title,
            text:     (data && data.message) || 'Revisa la conexión y vuelve a intentar.',
            btn1:     true,
            btn1Text: 'Entendido'
        });
    }
}
