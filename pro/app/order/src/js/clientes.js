/*  Pedidos › Clientes (Etapa 6a).

    El directorio de clientes de la sucursal: quién es, cuánto ha pedido y
    cuánto debe. Alta, edición y baja lógica (no se borra: se desactiva).
    «Historial» lista sus pedidos; los de esta sucursal abren el mismo detalle
    que Pedidos (orderDetail), servido por ctrl-pedidos.

    Crédito y monedero (V3 de Ventas): la lista suma las columnas «Crédito» y
    «Monedero»; el historial muestra la cuenta del cliente y el botón «Abonar».
    Dar crédito y fijar el límite solo le sale a quien puede activar o
    desactivar clientes (hoy el Dueño).

    Comprobantes (portal del cliente): cada cliente tiene un enlace por
    sucursal (portal.php) donde ve lo que debe y sube la foto de su
    transferencia. «Comprobantes» abre la bandeja: se abonan (entran al turno
    abierto) o se rechazan con un motivo que el cliente lee. El ícono de enlace
    de cada fila arma el mensaje de WhatsApp. Clase Receipts, servida por
    ctrl-comprobantes.

    El detalle, el turno y el cobro llaman a orders.lsOrders(), orders.can() y
    orders.paintTurn(): aquí `orders` es la misma instancia que `customers`. */

let api = 'ctrl/ctrl-clientes.php';
let customers, orders, orderDetail, orderTurn, orderPay, orderClosure, receipts;
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
    receipts             = new Receipts('ctrl/ctrl-comprobantes.php', 'root');
    customers.init();

    if (dataInit.status == 200 && customers.allow('show')) receipts.init();
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

        if (dataInit.status != 200) return;

        // Clientes no lleva la franja de caja (abrir/cerrar turno ni «Ir a Cortes»): el turno
        // lo pide el cobro o el abono cuando hace falta (orderTurn.locked).
        const json = [];

        // La insignia de «Comprobantes» la pinta receipts.paintCounts().
        if (this.allow('show')) {
            json.push({ opc: 'button', id: 'btnReceipts', class: 'col-auto', text: 'Comprobantes <span id="rcpBadge" class="rcp-badge hidden" aria-hidden="true"></span>', icon: 'icon-inbox', color_btn: 'outline', onClick: () => receipts.list() });
        }

        if (this.allow('create')) {
            json.push({ opc: 'button', id: 'btnNewCustomer', class: 'col-auto', text: 'Nuevo cliente', icon: 'icon-plus', color_btn: 'primary', onClick: () => this.add() });
        }

        if (!json.length) return;

        this.coffeeForm({
            parent:       `headerActions${this.PROJECT_NAME}`,
            id:           'formHeaderCustomers',
            class:        'flex gap-[8px] flex-wrap',
            showRequired: false,
            json:         json
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
            ...ORD_TABLE,
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

// -- Receipts --

/*  Clientes › Comprobantes (portal del cliente).

    La bandeja de lo que mandan los clientes desde su enlace (portal.php): se
    abre el comprobante, se ve la foto o el PDF y se abona (entra al turno
    abierto) o se rechaza con un motivo que el cliente lee en su enlace. También
    arma el enlace de cada cliente para mandarlo por WhatsApp.

    Servido por ctrl-comprobantes; el archivo sale por ctrl/comprobante.php.
    El reparto que se ve antes de abonar copia el del ctrl (applyQueue y
    applyParts): primero el folio elegido y luego lo que debe, del más viejo al
    más nuevo. Una cotización solo recibe si es la elegida: es su anticipo. */
class Receipts extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Receipts';
        this.tab          = 'pending';
        this.counts       = { pending: 0, applied: 0, rejected: 0 };
        this.request      = 0;
        this.current      = null;
        this.owes         = false;
        this.mode         = 'apply';
        this.prefilled    = null;
        this.saving       = false;
        this.applyToken   = '';
        this.rejectToken  = '';
        this.closeReview  = null;
        this.timer        = 0;
        this.portalData   = null;
    }

    // La insignia del botón: al abrir la página y cada minuto mientras la pestaña se ve.
    init() {
        this.count();

        clearInterval(this.timer);
        this.timer = setInterval(() => { if (!document.hidden) this.count(); }, 60000);
    }

    // -- Contador --

    async count() {
        const res = await useFetch({ url: this._link, data: { opc: 'countReceipts' } });

        if (res && res.status == 200) this.paintCounts(res.counts);
    }

    paintCounts(counts) {
        this.counts = Object.assign({ pending: 0, applied: 0, rejected: 0 }, counts || {});

        const pending = Number(this.counts.pending) || 0;

        $('#rcpBadge').text(pending > 99 ? '99+' : String(pending)).toggleClass('hidden', pending === 0);
        $('#btnReceipts').attr('aria-label', pending ? `Comprobantes: ${pending} en revisión` : 'Comprobantes');
        $('#receiptInbox button.ord-seg[data-tab="pending"]').text(pending ? `En revisión (${pending})` : 'En revisión');
    }

    // -- Bandeja --

    list() {
        const scope = dataInit.scope || {};

        this.tab = 'pending';

        this.csModal({
            id:         'modalReceiptInbox',
            title:      'Comprobantes',
            subtitle:   [scope.branch ? `Sucursal ${scope.branch}` : '', 'Lo que mandan los clientes desde su enlace'].filter(Boolean).join(' · '),
            lucideIcon: 'inbox',
            width:      'max-w-3xl',
            saveText:   false,
            cancelText: 'Cerrar',
            info:       'Abonar entra al corte del turno abierto.',
            body:       `<div id="receiptInbox" class="rcp-inbox">${this.tabs()}<p id="rcpNote" class="rcp-note"></p><div id="rcpList" class="rcp-list" aria-live="polite"></div></div>`
        });

        $('#modalReceiptInbox')
            .on('click', 'button.ord-seg[data-tab]', (e) => this.switchTab(e.currentTarget.dataset.tab))
            .on('click', 'button.rcp-row', (e) => this.review(Number(e.currentTarget.dataset.id)));

        this.load();
    }

    tabs() {
        const pending = Number(this.counts.pending) || 0;

        const tab = (key, text) => {
            const on = this.tab === key;

            return `<button type="button" class="ord-seg${on ? ' is-active' : ''}" data-tab="${key}" role="tab" aria-selected="${on}">${esc(text)}</button>`;
        };

        return '<div class="rcp-tabs flex" role="tablist" aria-label="Comprobantes">'
            + tab('pending', pending ? `En revisión (${pending})` : 'En revisión')
            + tab('reviewed', 'Revisados')
            + '</div>';
    }

    switchTab(tab) {
        if (!['pending', 'reviewed'].includes(tab) || tab === this.tab) return;

        this.tab = tab;

        $('#receiptInbox button.ord-seg[data-tab]').each((i, el) => {
            const on = el.dataset.tab === tab;

            $(el).toggleClass('is-active', on).attr('aria-selected', String(on));
        });

        this.load();
    }

    async load() {
        const request = ++this.request;
        const tab     = this.tab;

        $('#rcpList').addClass('opacity-50');

        const res = await useFetch({ url: this._link, data: { opc: 'lsReceipts', status: tab } });

        // Solo pinta la última petición: un cambio rápido de pestaña no mezcla listas.
        if (request !== this.request || !$('#rcpList').length) return;

        const box = $('#rcpList').removeClass('opacity-50');

        if (!res || res.status != 200) {
            $('#rcpNote').text('');
            box.html(this.emptyBox('triangle-alert', (res && res.message) || 'No se pudieron leer los comprobantes. Revisa la conexión y vuelve a intentar.'));

            return this.icons();
        }

        this.paintCounts(res.counts);

        const rows    = res.rows || [];
        const limit   = Number(res.limit) || 0;
        const pending = Number(this.counts.pending) || 0;
        const cut     = limit > 0 && rows.length >= limit;

        $('#rcpNote').text(tab === 'pending'
            ? 'Del más viejo al más nuevo. Ábrelo para ver la foto y abonarlo o rechazarlo.' + (cut && pending > limit ? ` Se muestran los primeros ${limit} de ${pending}.` : '')
            : 'Los revisados más recientes primero.' + (cut ? ` Se muestran los últimos ${limit}.` : ''));

        if (!rows.length) {
            box.html(tab === 'pending'
                ? this.emptyBox('inbox', 'No hay comprobantes por revisar. Cuando un cliente mande uno desde su enlace, sale aquí.')
                : this.emptyBox('archive', 'Todavía no se revisa ningún comprobante.'));

            return this.icons();
        }

        box.html(rows.map((r) => this.row(r)).join(''));

        // Una miniatura que no carga deja ver el ícono de abajo.
        box.find('img').on('error', (e) => $(e.currentTarget).remove());

        this.icons();
    }

    // Una fila: la miniatura, quién y para qué folio, cuánto y cómo quedó.
    row(r) {
        const thumb = r.kind === 'pdf'
            ? '<span class="rcp-thumb is-pdf"><i data-lucide="file-text" class="w-5 h-5"></i></span>'
            : `<span class="rcp-thumb"><i data-lucide="image" class="w-5 h-5"></i><img src="${esc(r.file_url)}" loading="lazy" decoding="async" alt=""></span>`;

        const sub = [r.folio, r.target ? `para ${r.target}` : 'sin folio', this.when(r.created_at)].filter(Boolean);
        let extra = '';

        if (r.status === 'applied')  extra = [`Abonó ${money(r.applied)}`, this.when(r.reviewed_at), r.reviewer].filter(Boolean).join(' · ');
        if (r.status === 'rejected') extra = `Motivo: ${r.reject_reason}`;

        return `
            <button type="button" class="rcp-row" data-id="${Number(r.id)}" aria-label="${esc(`Abrir comprobante ${r.folio} de ${r.customer}`)}">
                ${thumb}
                <span class="rcp-row-main">
                    <span class="rcp-row-name">${esc(r.customer)}</span>
                    <span class="rcp-row-sub">${esc(sub.join(' · '))}</span>
                    ${extra ? `<span class="rcp-row-sub">${esc(extra)}</span>` : ''}
                </span>
                <span class="rcp-row-money">
                    <span class="rcp-row-amount">${esc(money(r.amount))}</span>
                    <span class="rcp-pill is-${esc(r.status)}">${esc(r.status_text)}</span>
                </span>
                <i data-lucide="chevron-right" class="rcp-row-go w-4 h-4"></i>
            </button>`;
    }

    emptyBox(icon, text) {
        return `<div class="cus-empty"><i data-lucide="${esc(icon)}" class="w-5 h-5 shrink-0"></i>${esc(text)}</div>`;
    }

    // -- Revisar --

    async review(id) {
        if (this.saving || !id) return;

        const res = await useFetch({ url: this._link, data: { opc: 'getReceipt', id: id } });

        if (!res || res.status != 200) return this.fail(res, 'No se pudo abrir el comprobante');

        const r    = res.receipt;
        const open = r.status === 'pending' && Boolean(res.can_review);

        this.current     = res;
        this.owes        = open && ((res.debts || []).length + (res.quotes || []).length) > 0;
        this.mode        = this.owes ? 'apply' : 'reject';
        this.prefilled   = null;
        this.applyToken  = ordToken();
        this.rejectToken = ordToken();

        const json = [
            { id: 'rcpPreviewBox', tipo: 'html', html: this.preview(r), class: 'w-full' },
            { id: 'rcpSentBox',    tipo: 'html', html: this.sent(res),  class: 'w-full' }
        ];

        if (r.status !== 'pending') json.push({ id: 'rcpResultBox', tipo: 'html', html: this.result(r), class: 'w-full' });
        else if (!open)             json.push({ id: 'rcpBlockBox',  tipo: 'html', html: this.notice(res.block || 'Tu rol no puede abonar ni rechazar comprobantes.'), class: 'w-full' });
        else                        json.push(...this.reviewFields(res));

        const modal = this.csModal({
            id:         'modalReceipt',
            title:      `Comprobante ${r.folio}`,
            subtitle:   [r.customer, r.phone].filter(Boolean).join(' · '),
            lucideIcon: 'receipt',
            width:      'max-w-4xl',
            saveText:   open ? 'Abonar' : false,
            cancelText: open ? 'Cancelar' : 'Cerrar',
            info:       open ? 'Abonar entra al corte del turno abierto.' : '',
            json:       json,
            onSave:     (values, close) => this.save(values, close)
        });

        this.closeReview = modal.close;

        $('#modalReceipt')
            .on('click', 'button.ord-seg[data-mode]', (e) => this.setMode(e.currentTarget.dataset.mode))
            .on('click', 'button.rcp-chip', (e) => this.useReason(e.currentTarget.dataset.text))
            .on('change', '#rc_target', () => this.onTarget())
            .on('input change', '#rc_amount, #rc_method', () => this.paintSplit());

        $('#rcpPreviewBox img').on('error', () => $('#rcpPreviewBox .rcp-preview').addClass('is-broken'));

        if (open) this.setMode(this.mode);
    }

    // Quien revisa: abonar (folio, monto, método y cómo se reparte) o rechazar (motivo).
    reviewFields(res) {
        const r      = res.receipt;
        const fields = [{ id: 'rcpModeBox', tipo: 'html', html: this.modes(), class: 'w-full' }];

        if (!this.owes) {
            fields.push({ id: 'rcpOweBox', tipo: 'html', html: this.notice('Ya no debe nada en esta sucursal. Si el pago no corresponde, recházalo con un motivo.'), class: 'w-full rcp-for-apply' });
        } else {
            const target  = this.defaultTarget(res);
            const cap     = this.split(target, 0).cap;
            const amount  = ordRound(Math.min(Number(r.amount) || 0, cap));
            const lock    = !res.can_apply;
            const methods = res.methods || [];

            this.prefilled = amount;

            if (lock) fields.push({ id: 'rcpBlockBox', tipo: 'html', html: this.notice(res.block || 'Ahora no se puede abonar.'), class: 'w-full rcp-for-apply' });

            fields.push(
                { id: 'rc_target', lbl: 'A qué folio va', tipo: 'select', empty: false, data: this.targetOptions(res), value: target, disabled: lock, class: 'w-full rcp-for-apply' },
                { id: 'rc_amount', lbl: 'Monto que se abona', tipo: 'number', icon: 'dollar-sign', min: 0, step: '0.01', value: amount > 0 ? amount.toFixed(2) : '', disabled: lock, class: 'w-full sm:w-1/2 rcp-for-apply' },
                { id: 'rc_method', lbl: 'Entra como', tipo: 'select', empty: false, data: methods.map((m) => ({ id: m.id, valor: m.name })), value: res.method_id, disabled: lock, class: 'w-full sm:w-1/2 rcp-for-apply' },
                { id: 'rcpSplitBox', tipo: 'html', html: '', class: 'w-full rcp-for-apply' }
            );
        }

        fields.push(
            { id: 'rcpChipsBox', tipo: 'html', html: this.chips(), class: 'w-full rcp-for-reject hidden' },
            { id: 'rc_reason', lbl: 'Motivo (lo lee el cliente)', tipo: 'textarea', rows: 3, maxlength: 255, ph: 'Escribe por qué no se abona o elige uno de arriba.', class: 'w-full rcp-for-reject hidden' }
        );

        return fields;
    }

    modes() {
        const button = (mode, icon, text) => {
            const on = this.mode === mode;

            return `<button type="button" class="ord-seg${on ? ' is-active' : ''}" data-mode="${mode}" aria-pressed="${on}"><i data-lucide="${icon}" class="w-4 h-4"></i>${esc(text)}</button>`;
        };

        return '<div class="flex rcp-modes" role="group" aria-label="Qué hacer con el comprobante">'
            + button('apply', 'hand-coins', 'Abonar')
            + button('reject', 'ban', 'Rechazar')
            + '</div>';
    }

    targetOptions(res) {
        const items   = res.debts || [];
        const options = [];

        if (items.length > 1) options.push({ id: 0, valor: `Todo lo que debe · ${money(res.debt)} (del más viejo al más nuevo)` });

        items.forEach((s) => options.push({ id: s.id, valor: `${s.folio} · ${s.kind === 'credit' ? 'venta a crédito' : 'pedido'} · debe ${money(s.left)}` }));

        (res.quotes || []).forEach((q) => options.push({ id: q.id, valor: `${q.folio} · cotización · anticipo de hasta ${money(q.left)}` }));

        return options;
    }

    // El folio que pidió el cliente si sigue con saldo; si no, «Todo» o el único que hay.
    defaultTarget(res) {
        const items = res.debts || [];
        const all   = items.concat(res.quotes || []);
        const asked = Number(res.receipt.sale_id) || 0;

        if (asked && all.some((s) => Number(s.id) === asked)) return asked;
        if (items.length > 1) return 0;

        return all.length ? Number(all[0].id) : 0;
    }

    // El reparto del ctrl: cap = lo más que admite; parts = cuánto recibe cada folio; after = lo que sigue debiendo.
    split(target, amount) {
        const res   = this.current || {};
        const items = res.debts || [];
        const quote = (res.quotes || []).find((q) => Number(q.id) === Number(target)) || null;

        const chosen = items.find((s) => Number(s.id) === Number(target)) || quote;
        const queue  = (chosen ? [chosen] : []).concat(items.filter((s) => !chosen || Number(s.id) !== Number(chosen.id)));
        const cap    = ordRound(queue.reduce((total, s) => total + Number(s.left || 0), 0));

        const parts = [];
        let rest    = ordRound(amount);

        for (const s of queue) {
            if (rest <= 0.005) break;

            const pay = ordRound(Math.min(rest, Number(s.left)));

            rest = ordRound(rest - pay);
            parts.push({ folio: s.folio, kind: s.kind, quote: s === quote, pay: pay, after: ordRound(Number(s.left) - pay) });
        }

        const after = ordRound(Number(res.debt || 0) + (quote ? Number(quote.left) : 0) - Number(amount || 0));

        return { cap: cap, parts: parts, after: Math.max(after, 0) };
    }

    setMode(mode) {
        if (!['apply', 'reject'].includes(mode)) return;

        this.mode = mode;

        const modal = $('#modalReceipt');

        modal.find('button.ord-seg[data-mode]').each((i, el) => {
            const on = el.dataset.mode === mode;

            $(el).toggleClass('is-active', on).attr('aria-pressed', String(on));
        });

        modal.find('.rcp-for-apply').toggleClass('hidden', mode !== 'apply');
        modal.find('.rcp-for-reject').toggleClass('hidden', mode !== 'reject');
        modal.find('.cs-modal-info').text(mode === 'reject' ? 'El cliente ve el motivo en su enlace.' : 'Abonar entra al corte del turno abierto.');

        if (mode === 'reject') $('#rc_reason').trigger('focus');

        this.paintSplit();
    }

    // Otro folio: si nadie tocó el monto, se ajusta a lo que ese folio admite.
    onTarget() {
        const amount = ordAmount($('#rc_amount').val());

        if (this.prefilled !== null && amount !== null && Math.abs(amount - this.prefilled) < 0.005) {
            const cap = this.split(Number($('#rc_target').val()) || 0, 0).cap;

            this.prefilled = ordRound(Math.min(Number(this.current.receipt.amount) || 0, cap));

            $('#rc_amount').val(this.prefilled > 0 ? this.prefilled.toFixed(2) : '');
        }

        this.paintSplit();
    }

    // Cómo queda el reparto con lo escrito, y el texto del botón.
    paintSplit() {
        const res  = this.current;
        const save = $('#modalReceipt .cs-modal-save');

        if (!res || !save.length) return;

        if (this.mode === 'reject') {
            save.text('Rechazar comprobante').removeClass('is-blocked');
            return;
        }

        save.toggleClass('is-blocked', !this.owes || !res.can_apply);

        if (!this.owes) {
            save.text('Abonar');
            return;
        }

        const r      = res.receipt;
        const amount = ordAmount($('#rc_amount').val());
        const method = (res.methods || []).find((m) => Number(m.id) === Number($('#rc_method').val()));
        const plan   = this.split(Number($('#rc_target').val()) || 0, amount || 0);
        const all    = (res.debts || []).concat(res.quotes || []);
        const valid  = amount !== null && amount > 0 && amount <= plan.cap + 0.005;
        const notes  = [];

        if (r.sale_id && !all.some((s) => Number(s.id) === Number(r.sale_id))) notes.push(`El cliente lo mandó para ${r.target}, que ya no tiene saldo.`);
        if (Number(r.amount) > plan.cap + 0.005) notes.push(`Dice que mandó ${money(r.amount)}; lo más que se puede abonar aquí es ${money(plan.cap)}.`);

        let body = '';

        if (amount === null || amount <= 0) {
            body = `<p class="rcp-split-muted">Escribe cuánto se abona. Lo más es ${esc(money(plan.cap))}.</p>`;
        } else if (!valid) {
            body = `<p class="rcp-split-over">Lo más que se puede abonar aquí es ${esc(money(plan.cap))}.</p>`;
        } else {
            const parts = plan.parts.map((p) => `<strong>${esc(p.folio)}</strong> ${esc(money(p.pay))} (${esc(this.partText(p))})`).join(' · ');

            body = `<p>Se reparte: ${parts}</p>`
                 + `<p class="rcp-split-after">${plan.after <= 0.005 ? 'Queda al corriente.' : `Después de abonar debe ${esc(money(plan.after))}.`}</p>`;
        }

        $('#rcpSplitBox').html(`<div class="rcp-split">${body}${notes.map((n) => `<p class="rcp-split-note">${esc(n)}</p>`).join('')}</div>`);

        save.text(valid && method ? `Abonar ${money(amount)} en ${method.name}` : 'Abonar');
    }

    partText(p) {
        if (p.after <= 0.005) return p.kind === 'credit' ? 'liquidada' : 'queda pagado';

        return p.quote ? `anticipo · resta ${money(p.after)}` : `resta ${money(p.after)}`;
    }

    save(values, close) {
        if (this.saving || !this.current) return;

        return this.mode === 'reject' ? this.reject(values, close) : this.apply(values, close);
    }

    async apply(values, close) {
        const res = this.current;
        const r   = res.receipt;

        if (!this.owes)     return this.stop('Ya no debe nada en esta sucursal. Si el pago no corresponde, recházalo con un motivo.');
        if (!res.can_apply) return this.stop(res.block || 'Ahora no se puede abonar.');

        const target = Number(values.rc_target) || 0;
        const amount = ordAmount(values.rc_amount);
        const method = (res.methods || []).find((m) => Number(m.id) === Number(values.rc_method));
        const cap    = this.split(target, 0).cap;

        if (amount === null || amount <= 0) return this.warn('Escribe cuánto se abona.');
        if (amount > cap + 0.005)           return this.warn(`Lo más que se puede abonar aquí es ${money(cap)}.`);
        if (!method)                        return this.warn('Elige con qué método entra el abono.');

        this.saving = true;

        const button = $('#modalReceipt .cs-modal-save').prop('disabled', true);
        const answer = await useFetch({
            url:  this._link,
            data: { opc: 'applyReceipt', id: r.id, amount: amount, method_id: method.id, sale_id: target, token: this.applyToken }
        });

        this.saving = false;
        button.prop('disabled', false);

        if (answer && Number(answer.status) === 423) {
            await alert({ icon: 'warning', title: answer.title || 'Sin turno abierto', text: answer.message || 'Abre un turno para abonar el comprobante.', btn1: true, btn1Text: 'Entendido' });

            return this.reopen(r.id);
        }

        if (answer && Number(answer.status) === 409) {
            await this.fail(answer, 'No se abonó el comprobante');
            this.refresh();

            return this.reopen(r.id);
        }

        if (!answer || answer.status != 200) return this.fail(answer, 'No se abonó el comprobante');

        close();

        alert({ icon: 'success', title: answer.message, text: answer.detail || '', timer: 2200 });

        this.afterChange();
    }

    async reject(values, close) {
        const r      = this.current.receipt;
        const reason = String(values.rc_reason || '').replace(/\s+/g, ' ').trim();

        if (!reason)             return this.warn('Escribe el motivo: el cliente lo va a leer.');
        if (reason.length > 255) return this.warn('El motivo admite hasta 255 caracteres.');

        this.saving = true;

        const button = $('#modalReceipt .cs-modal-save').prop('disabled', true);
        const answer = await useFetch({
            url:  this._link,
            data: { opc: 'rejectReceipt', id: r.id, reason: reason, token: this.rejectToken }
        });

        this.saving = false;
        button.prop('disabled', false);

        if (answer && Number(answer.status) === 409) {
            await this.fail(answer, 'No se rechazó el comprobante');
            this.refresh();

            return this.reopen(r.id);
        }

        if (!answer || answer.status != 200) return this.fail(answer, 'No se rechazó el comprobante');

        close();

        alert({ icon: 'success', title: answer.message, timer: 2200 });

        this.afterChange();
    }

    reopen(id) {
        if (this.closeReview) this.closeReview();

        return this.review(id);
    }

    // Con la bandeja abierta se vuelve a leer; cerrada, solo la insignia.
    refresh() {
        return $('#receiptInbox').length ? this.load() : this.count();
    }

    afterChange() {
        this.refresh();
        customers.lsCustomers();
        customers.refreshHistory();
    }

    // -- Piezas de la ventana --

    preview(r) {
        const url  = esc(r.file_url);
        const name = [r.file_name || r.folio, r.size].filter(Boolean).join(' · ');

        const file = r.kind === 'pdf'
            ? `<iframe src="${url}" class="rcp-preview-frame" aria-label="${esc(`Comprobante ${r.folio} en PDF`)}"></iframe>`
            : `<a href="${url}" target="_blank" rel="noopener" class="rcp-preview-img" aria-label="Abrir la foto en otra pestaña"><img src="${url}" alt="${esc(`Comprobante ${r.folio} de ${r.customer}`)}"></a>`;

        return `
            <div class="rcp-preview">
                <div class="rcp-preview-file">
                    ${file}
                    <p class="rcp-preview-broken"><i data-lucide="image-off" class="w-5 h-5"></i>No se pudo mostrar el archivo. Ábrelo en otra pestaña.</p>
                </div>
                <div class="rcp-preview-foot">
                    <span class="rcp-preview-name">${esc(name)}</span>
                    <a href="${url}" target="_blank" rel="noopener" class="rcp-preview-open"><i data-lucide="external-link" class="w-4 h-4"></i>Abrir</a>
                </div>
            </div>`;
    }

    // Lo que escribió el cliente y, si sigue en revisión, lo que debe hoy.
    sent(res) {
        const r   = res.receipt;
        const sub = [r.target ? `Para ${r.target}` : 'Sin folio elegido', this.when(r.created_at)].filter(Boolean);

        const note = r.note
            ? `<p class="rcp-sent-note"><i data-lucide="message-square" class="w-4 h-4 shrink-0"></i><span>${esc(r.note)}</span></p>`
            : '';

        let owe = '';

        if (r.status === 'pending' && res.can_review) {
            const folios = (res.debts || []).length;
            const quotes = (res.quotes || []).length;
            const parts  = [];

            if (folios) parts.push(`Hoy debe ${money(res.debt)} en ${folios} ${folios === 1 ? 'folio' : 'folios'}`);
            if (quotes) parts.push(`${quotes} ${quotes === 1 ? 'cotización' : 'cotizaciones'} sin anticipo`);

            owe = `<p class="rcp-sent-owe">${esc(parts.length ? parts.join(' · ') : 'Hoy no debe nada en esta sucursal')}.</p>`;
        }

        return `
            <div class="rcp-sent">
                <div class="rcp-sent-head">
                    <span class="rcp-sent-label">Dice que transfirió</span>
                    <span class="rcp-pill is-${esc(r.status)}">${esc(r.status_text)}</span>
                </div>
                <p class="rcp-sent-amount">${esc(money(r.amount))}</p>
                <p class="rcp-sent-sub">${esc(sub.join(' · '))}</p>
                ${note}
                ${owe}
            </div>`;
    }

    // Un comprobante ya revisado: cómo quedó.
    result(r) {
        const applied = r.status === 'applied';

        const rows = applied
            ? [
                ['Se abonó',   r.applied !== null ? money(r.applied) : ''],
                ['Para',       r.target || 'Lo que debía, del más viejo al más nuevo'],
                ['Entró como', r.method],
                ['Turno',      r.turn_folio],
                ['Revisó',     r.reviewer],
                ['Fecha',      this.when(r.reviewed_at)]
            ]
            : [
                ['Motivo', r.reject_reason],
                ['Revisó', r.reviewer],
                ['Fecha',  this.when(r.reviewed_at)]
            ];

        return `
            <div class="rcp-result is-${applied ? 'applied' : 'rejected'}">
                <p class="rcp-result-title">${applied ? 'Abonado' : 'Rechazado: el cliente ve este motivo en su enlace'}</p>
                <dl>${rows.map(([label, value]) => `<dt>${esc(label)}</dt><dd>${esc(value || '-')}</dd>`).join('')}</dl>
            </div>`;
    }

    notice(text) {
        return `<div class="rcp-block" role="note"><i data-lucide="info" class="w-4 h-4 shrink-0"></i><span>${esc(text)}</span></div>`;
    }

    chips() {
        const reasons = [
            ['No se ve el monto',    'No se alcanza a ver el monto. Manda una foto donde se lea completo.'],
            ['No ha llegado',        'Todavía no nos llega esta transferencia. Si ya la hiciste, espera unos minutos y vuelve a mandarla.'],
            ['El monto no coincide', 'El monto de la transferencia no coincide con el que escribiste.'],
            ['Es de otra cuenta',    'La transferencia no es a la cuenta de la tienda.'],
            ['No se lee el archivo', 'El archivo no se abre o no se lee. Mándalo otra vez.']
        ];

        return '<p class="rcp-chips-label">Motivos frecuentes</p>'
            + `<div class="rcp-chips">${reasons.map(([label, text]) => `<button type="button" class="rcp-chip" data-text="${esc(text)}">${esc(label)}</button>`).join('')}</div>`;
    }

    useReason(text) {
        const box = $('#rc_reason');

        box.val(text || '').trigger('focus');

        const el = box.get(0);

        if (el && el.setSelectionRange) el.setSelectionRange(el.value.length, el.value.length);
    }

    // -- Enlace --

    async portal(customerId) {
        const res = await useFetch({ url: this._link, data: { opc: 'getPortalLink', id: customerId } });

        if (!res || res.status != 200) return this.fail(res, 'No se pudo preparar el enlace');

        this.portalData = res;

        const phone = String(res.customer.phone || '').replace(/\D/g, '').slice(-10);

        this.csModal({
            id:         'modalPortalLink',
            title:      'Enlace del cliente',
            subtitle:   [res.customer.name, res.branch].filter(Boolean).join(' · '),
            lucideIcon: 'link',
            width:      'max-w-lg',
            saveText:   'Abrir WhatsApp',
            cancelText: 'Cerrar',
            info:       'El cliente lo abre sin cuenta ni contraseña.',
            action:     { text: 'Copiar enlace', lucideIcon: 'copy', onClick: () => this.copyLink() },
            json: [
                { id: 'rcpLinkSummary', tipo: 'html', html: this.linkSummary(res), class: 'w-full' },
                { id: 'pl_phone', lbl: 'WhatsApp del cliente', tipo: 'text', icon: 'phone', value: phone, ph: '10 dígitos', maxlength: 16, help: 'Vacío: WhatsApp te deja elegir el contacto.', class: 'w-full' },
                { id: 'pl_message', lbl: 'Mensaje', tipo: 'textarea', rows: 5, maxlength: 1000, value: this.linkMessage(res), class: 'w-full' },
                { id: 'rcpLinkBox', tipo: 'html', html: this.linkBox(res), class: 'w-full' }
            ],
            onSave: (values, close) => this.sendLink(values, close)
        });

        $('#modalPortalLink').on('click', 'button.rcp-renew', () => this.renew());
    }

    linkSummary(res) {
        const debt   = Number(res.debt) || 0;
        const folios = Number(res.folios) || 0;
        const quotes = Number(res.quotes) || 0;
        const parts  = [];

        if (debt > 0.005) parts.push(`Debe <strong>${esc(money(debt))}</strong> en ${folios} ${folios === 1 ? 'folio' : 'folios'}`);
        if (quotes)       parts.push(`${quotes} ${quotes === 1 ? 'cotización' : 'cotizaciones'} sin anticipo`);

        const head = parts.length ? parts.join(' · ') : 'Hoy no debe nada en esta sucursal';

        return `<div class="rcp-linksum"><i data-lucide="wallet" class="w-4 h-4 shrink-0"></i><span>${head}. En su enlace ve esto mismo y puede mandar la foto de su transferencia.</span></div>`;
    }

    linkMessage(res) {
        const name  = String(res.customer.name || '').trim();
        const first = name !== '' && name !== 'Sin nombre' ? name.split(/\s+/)[0] : '';
        const where = res.branch ? ` de ${res.branch}` : '';
        const debt  = Number(res.debt) || 0;

        return `${first ? `Hola ${first}` : 'Hola'}, este es tu enlace${where}.\n`
            + (debt > 0.005
                ? `Ahí ves lo que tienes pendiente (${money(debt)}) y puedes mandar la foto de tu transferencia:\n`
                : 'Ahí puedes ver tus pedidos y mandar el comprobante de tu transferencia:\n')
            + res.link;
    }

    linkBox(res) {
        const renew = res.can_renew
            ? '<button type="button" class="rcp-renew"><i data-lucide="refresh-cw" class="w-4 h-4"></i>Nuevo enlace</button>'
            : '';

        return `
            <div class="rcp-linkbox">
                <p class="rcp-linkbox-url"><i data-lucide="link" class="w-4 h-4 shrink-0"></i><a href="${esc(res.link)}" target="_blank" rel="noopener" class="truncate">${esc(res.link)}</a></p>
                <div class="rcp-linkbox-foot">
                    <span>${esc(res.since ? `Activo desde ${res.since}` : 'Activo')}</span>
                    ${renew}
                </div>
            </div>`;
    }

    async copyLink() {
        const link = this.portalData && this.portalData.link;

        if (!link) return;

        const done = await ticketCopy(link);

        alert(done
            ? { icon: 'success', title: 'Enlace copiado', timer: 1200 }
            : { icon: 'warning', title: 'No se pudo copiar', text: 'Selecciona el enlace y cópialo a mano.', btn1: true, btn1Text: 'Entendido' });
    }

    // Token nuevo: el enlace anterior deja de abrir.
    async renew() {
        const data = this.portalData;

        if (!data || this.saving) return;

        const ask = await alert({
            icon:     'warning',
            title:    '¿Crear un enlace nuevo?',
            text:     'El enlace anterior deja de abrir. Úsalo si lo mandaste a otra persona por error.',
            btn1:     true,
            btn1Text: 'Crear enlace nuevo',
            btn2:     true,
            btn2Text: 'Cancelar'
        });

        if (!ask || !ask.isConfirmed || this.saving) return;

        this.saving = true;

        const res = await useFetch({ url: this._link, data: { opc: 'newPortalLink', id: data.customer.id } });

        this.saving = false;

        if (!res || res.status != 200) return this.fail(res, 'No se cambió el enlace');

        this.portalData = res;

        $('#rcpLinkBox').html(this.linkBox(res));
        $('#rcpLinkSummary').html(this.linkSummary(res));

        // El mensaje que ya escribieron se queda; solo cambia el enlace.
        const message = $('#pl_message');
        const text    = String(message.val() || '');

        message.val(text.includes(data.link) ? text.split(data.link).join(res.link) : this.linkMessage(res));

        this.icons();

        alert({ icon: 'success', title: res.message || 'Enlace nuevo listo.', timer: 1600 });
    }

    sendLink(values, close) {
        const data  = this.portalData;
        const phone = ticketPhone(values.pl_phone);

        if (!data) return;

        if (phone === null) {
            return alert({ icon: 'warning', title: 'Teléfono no válido', text: 'Escribe los 10 dígitos o deja el campo vacío.', btn1: true, btn1Text: 'Entendido' });
        }

        let text = String(values.pl_message || '').trim();

        // Sin el enlace el mensaje no sirve: si lo borraron, va al final.
        if (!text.includes(data.link)) text = (text !== '' ? text + '\n' : '') + data.link;

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');

        close();
    }

    // -- Complements --

    when(value) {
        return ordDate(value, true);
    }

    icons() {
        if (window.lucide) lucide.createIcons();
    }

    stop(text) {
        return alert({ icon: 'warning', title: 'No se puede abonar', text: text, btn1: true, btn1Text: 'Entendido' });
    }

    warn(text) {
        return alert({ icon: 'warning', title: 'Falta un dato', text: text, btn1: true, btn1Text: 'Entendido' });
    }

    fail(data, title) {
        const soft = data && [403, 404, 409, 422].includes(Number(data.status));

        return alert({
            icon:     soft ? 'warning' : 'error',
            title:    title,
            text:     (data && data.message) || 'Revisa la conexión y vuelve a intentar.',
            btn1:     true,
            btn1Text: 'Entendido'
        });
    }
}
