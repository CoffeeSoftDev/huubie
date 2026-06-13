let api = 'ctrl/ctrl-tenant.php';
let app, companies, plans, subscriptions, payments, coupons, redemptions;
let modules, submodules, sections, typePermissions, roles, permissions;
let dataInit = {};

// Notificación: éxito con timer (se cierra solo), error con botón para poder leerse.
function notify(r) {
    if (r && r.status == 200) {
        alert({ icon: 'success', text: r.message, timer: 1400 });
    } else {
        alert({ icon: 'error', text: (r && r.message) || 'Ocurrió un error', btn1: true });
    }
}

$(async () => {
    dataInit = await useFetch({ url: api, data: { opc: 'init' } });

    app           = new App(api, 'root');
    companies     = new Companies(api, 'root');
    plans         = new Plans(api, 'root');
    subscriptions = new Subscriptions(api, 'root');
    payments      = new Payments(api, 'root');
    coupons       = new Coupons(api, 'root');
    redemptions   = new Redemptions(api, 'root');
    modules         = new Modules(api, 'root');
    submodules      = new Submodules(api, 'root');
    sections        = new Sections(api, 'root');
    typePermissions = new TypePermissions(api, 'root');
    roles           = new Roles(api, 'root');
    permissions     = new Permissions(api, 'root');

    app.render();
});

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Tenant';
    }

    render() {
        this.layout();
        companies.render();
        plans.render();
        subscriptions.render();
        payments.render();
        coupons.render();
        redemptions.render();
        modules.render();
        submodules.render();
        sections.render();
        typePermissions.render();
        roles.render();
        permissions.render();
        // Pestaña por defecto.
        companies.lsCompanies();
    }

    layout() {
        this.primaryLayout({
            parent: 'root',
            id: this.PROJECT_NAME,
            class: 'w-full',
            card: {
                filterBar: { class: 'w-full', id: `filterBar${this.PROJECT_NAME}` },
                container: { class: 'w-full h-full', id: `container${this.PROJECT_NAME}` }
            }
        });

        this.headerBar({ parent: `filterBar${this.PROJECT_NAME}` });
        this.layoutTabs();
    }

    headerBar(options) {
        const totalCompanies = (dataInit.companies || []).length;
        const totalPlans     = (dataInit.plans || []).length;

        const container = $('<div>', {
            class: 'flex justify-between items-center px-2 pt-3 pb-3'
        });

        container.html(`
            <div>
                <h2 class="text-2xl font-semibold">🏢 Administrador del Tenant</h2>
                <p class="text-gray-400">
                    Plataforma SaaS ·
                    <span class="font-semibold text-gray-600">${totalCompanies}</span>
                    empresa${totalCompanies !== 1 ? 's' : ''} activa${totalCompanies !== 1 ? 's' : ''} ·
                    <span class="font-semibold text-gray-600">${totalPlans}</span>
                    plan${totalPlans !== 1 ? 'es' : ''}
                </p>
            </div>
            <button class="bg-[#C05A40] hover:opacity-90 text-white font-semibold px-4 py-2 rounded transition flex items-center"
                onclick="app.render()">
                <i class="icon-arrows-cw mr-2"></i>Actualizar
            </button>
        `);

        $(`#${options.parent}`).html(container);
    }

    layoutTabs() {
        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: 'light',
            class: '',
            type: 'short',
            json: [
                {
                    id: 'empresas',
                    tab: 'Empresas',
                    class: 'mb-1',
                    active: true,
                    onClick: () => companies.lsCompanies()
                },
                {
                    id: 'planes',
                    tab: 'Planes',
                    onClick: () => plans.lsPlans()
                },
                {
                    id: 'suscripciones',
                    tab: 'Suscripciones',
                    onClick: () => subscriptions.lsSubscriptions()
                },
                {
                    id: 'pagos',
                    tab: 'Pagos',
                    onClick: () => payments.lsPayments()
                },
                {
                    id: 'cupones',
                    tab: 'Cupones',
                    onClick: () => coupons.lsCoupons()
                },
                {
                    id: 'canjes',
                    tab: 'Canjes',
                    onClick: () => redemptions.lsRedemptions()
                },
                {
                    id: 'modulos',
                    tab: 'Módulos',
                    onClick: () => modules.lsModules()
                },
                {
                    id: 'submodulos',
                    tab: 'Submódulos',
                    onClick: () => submodules.lsSubmodules()
                },
                {
                    id: 'secciones',
                    tab: 'Secciones',
                    onClick: () => sections.lsSections()
                },
                {
                    id: 'roles',
                    tab: 'Roles',
                    onClick: () => roles.lsRoles()
                },
                {
                    id: 'tipos-permiso',
                    tab: 'Tipos de permiso',
                    onClick: () => typePermissions.lsTypePermissions()
                },
                {
                    id: 'permisos',
                    tab: 'Permisos',
                    onClick: () => permissions.lsPermissions()
                }
            ]
        });

        $(`#content-tabs${this.PROJECT_NAME}`).removeClass('h-screen');
    }
}

/* ====================== Empresas ====================== */

class Companies extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Companies';
    }

    render() {
        const container = $('#container-empresas');
        container.html(`
            <div id="filterbar-companies" class="mb-2"></div>
            <div id="table-companies"></div>
        `);

        this.createfilterBar({
            parent: 'filterbar-companies',
            data: [
                {
                    opc: 'select',
                    id: 'status',
                    lbl: 'Estado',
                    class: 'col-12 col-md-3',
                    data: dataInit.companyStatusFilter || [],
                    onchange: 'companies.lsCompanies()'
                },
                {
                    opc: 'button',
                    class: 'col-12 col-md-3',
                    id: 'btnNewCompany',
                    text: 'Nueva Empresa',
                    onClick: () => this.addCompany()
                }
            ]
        });
    }

    lsCompanies() {
        this.createTable({
            parent: 'table-companies',
            idFilterBar: 'filterbar-companies',
            data: { opc: 'lsCompanies' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbCompanies',
                theme: 'light',
                center: [5],
                right: []
            }
        });
    }

    addCompany() {
        this.createModalForm({
            id: 'formCompanyAdd',
            data: { opc: 'addCompany' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Nueva Empresa' },
            json: this.jsonCompany(true),
            success: (r) => this._afterSave(r)
        });
    }

    async editCompany(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getCompany', id: id } });
        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar la empresa', btn1: true });
            return;
        }

        this.createModalForm({
            id: 'formCompanyEdit',
            data: { opc: 'editCompany', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Editar Empresa' },
            autofill: request.data,
            json: this.jsonCompany(false),
            success: (r) => this._afterSave(r)
        });
    }

    changeStatus(id, current) {
        this.createModalForm({
            id: 'formCompanyStatus',
            data: { opc: 'changeCompanyStatus', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Cambiar estado de la empresa' },
            autofill: { status: current },
            json: [
                {
                    opc: 'select',
                    id: 'status',
                    lbl: 'Estado',
                    class: 'col-12 mb-3',
                    required: true,
                    data: dataInit.companyStatusOptions || []
                }
            ],
            success: (r) => this._afterSave(r)
        });
    }

    _afterSave(r) {
        notify(r);
        if (r.status == 200) this.lsCompanies();
    }

    jsonCompany(isNew) {
        const fields = [
            {
                opc: 'input',
                id: 'name',
                lbl: 'Nombre de la empresa',
                class: 'col-12 mb-3',
                required: true
            },
            {
                opc: 'input',
                id: 'rfc',
                lbl: 'RFC',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'database_name',
                lbl: 'Base de datos',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'ubication',
                lbl: 'Ubicación',
                class: 'col-12 mb-3'
            }
        ];

        if (isNew) {
            fields.push({
                opc: 'select',
                id: 'status',
                lbl: 'Estado inicial',
                class: 'col-12 mb-3',
                data: dataInit.companyStatusOptions || []
            });
        }

        return fields;
    }
}

/* ====================== Planes ====================== */

class Plans extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Plans';
    }

    render() {
        const container = $('#container-planes');
        container.html(`
            <div id="filterbar-plans" class="mb-2"></div>
            <div id="table-plans"></div>
        `);

        this.createfilterBar({
            parent: 'filterbar-plans',
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    class: 'col-12 col-md-3',
                    data: dataInit.statusFilter || [],
                    onchange: 'plans.lsPlans()'
                },
                {
                    opc: 'button',
                    class: 'col-12 col-md-3',
                    id: 'btnNewPlan',
                    text: 'Nuevo Plan',
                    onClick: () => this.addPlan()
                }
            ]
        });
    }

    lsPlans() {
        this.createTable({
            parent: 'table-plans',
            idFilterBar: 'filterbar-plans',
            data: { opc: 'lsPlans' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbPlans',
                theme: 'light',
                center: [8],
                right: [3]
            }
        });
    }

    addPlan() {
        this.createModalForm({
            id: 'formPlanAdd',
            data: { opc: 'addPlan' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Nuevo Plan' },
            json: this.jsonPlan(),
            success: (r) => this._afterSave(r)
        });
    }

    async editPlan(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getPlan', id: id } });
        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar el plan', btn1: true });
            return;
        }

        const data = request.data;
        if (data.billing_cycle != null) data.billing_cycle = String(data.billing_cycle);

        this.createModalForm({
            id: 'formPlanEdit',
            data: { opc: 'editPlan', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Editar Plan' },
            autofill: data,
            json: this.jsonPlan(),
            success: (r) => this._afterSave(r)
        });
    }

    togglePlan(id, active) {
        const action = active == 1 ? 'activar' : 'desactivar';
        this.swalQuestion({
            opts: {
                title: `¿${active == 1 ? 'Activar' : 'Desactivar'} plan?`,
                text: `¿Deseas ${action} este plan?`,
                icon: 'warning'
            },
            data: { opc: 'togglePlan', id: id, active: active },
            methods: { send: (r) => this._afterSave(r) }
        });
    }

    _afterSave(r) {
        notify(r);
        if (r.status == 200) this.lsPlans();
    }

    jsonPlan() {
        return [
            {
                opc: 'input',
                id: 'code',
                lbl: 'Código',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'name',
                lbl: 'Nombre del plan',
                class: 'col-12 col-md-6 mb-3',
                required: true
            },
            {
                opc: 'input',
                id: 'price',
                lbl: 'Precio',
                type: 'number',
                class: 'col-12 col-md-6 mb-3',
                required: true
            },
            {
                opc: 'input',
                id: 'currency',
                lbl: 'Moneda',
                class: 'col-12 col-md-6 mb-3',
                value: 'MXN'
            },
            {
                opc: 'select',
                id: 'billing_cycle',
                lbl: 'Ciclo de cobro',
                class: 'col-12 col-md-6 mb-3',
                data: dataInit.billingCycles || []
            },
            {
                opc: 'input',
                id: 'trial_days',
                lbl: 'Días de prueba',
                type: 'number',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'max_users',
                lbl: 'Máx. usuarios',
                type: 'number',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'max_branches',
                lbl: 'Máx. sucursales',
                type: 'number',
                class: 'col-12 col-md-6 mb-3'
            }
        ];
    }
}

/* ====================== Suscripciones ====================== */

class Subscriptions extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Subscriptions';
    }

    render() {
        const container = $('#container-suscripciones');
        container.html(`
            <div id="filterbar-subscriptions" class="mb-2"></div>
            <div id="table-subscriptions"></div>
        `);

        this.createfilterBar({
            parent: 'filterbar-subscriptions',
            data: [
                {
                    opc: 'select',
                    id: 'status',
                    lbl: 'Estado',
                    class: 'col-12 col-md-3',
                    data: dataInit.subscriptionStatusFilter || [],
                    onchange: 'subscriptions.lsSubscriptions()'
                },
                {
                    opc: 'button',
                    class: 'col-12 col-md-3',
                    id: 'btnNewSubscription',
                    text: 'Nueva Suscripción',
                    onClick: () => this.addSubscription()
                }
            ]
        });
    }

    lsSubscriptions() {
        this.createTable({
            parent: 'table-subscriptions',
            idFilterBar: 'filterbar-subscriptions',
            data: { opc: 'lsSubscriptions' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbSubscriptions',
                theme: 'light',
                center: [3, 4, 5, 6],
                right: []
            }
        });
    }

    addSubscription() {
        if (!(dataInit.companies || []).length) {
            alert({ icon: 'info', text: 'Primero registra al menos una empresa activa', btn1: true });
            return;
        }
        if (!(dataInit.plans || []).length) {
            alert({ icon: 'info', text: 'Primero registra al menos un plan activo', btn1: true });
            return;
        }

        this.createModalForm({
            id: 'formSubscriptionAdd',
            data: { opc: 'addSubscription' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Nueva Suscripción' },
            json: this.jsonSubscription(),
            success: (r) => this._afterSave(r)
        });
    }

    async editSubscription(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getSubscription', id: id } });
        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar la suscripción', btn1: true });
            return;
        }

        this.createModalForm({
            id: 'formSubscriptionEdit',
            data: { opc: 'editSubscription', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Editar Suscripción' },
            autofill: request.data,
            json: this.jsonSubscription(),
            success: (r) => this._afterSave(r)
        });
    }

    changeStatus(id, current) {
        this.createModalForm({
            id: 'formSubscriptionStatus',
            data: { opc: 'changeSubscriptionStatus', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Cambiar estado de la suscripción' },
            autofill: { status: current },
            json: [
                {
                    opc: 'select',
                    id: 'status',
                    lbl: 'Estado',
                    class: 'col-12 mb-3',
                    required: true,
                    data: dataInit.subscriptionStatusOptions || []
                }
            ],
            success: (r) => this._afterSave(r)
        });
    }

    _afterSave(r) {
        notify(r);
        if (r.status == 200) this.lsSubscriptions();
    }

    jsonSubscription() {
        return [
            {
                opc: 'select',
                id: 'company_id',
                lbl: 'Empresa',
                class: 'col-12 col-md-6 mb-3',
                required: true,
                data: dataInit.companies || []
            },
            {
                opc: 'select',
                id: 'plan_id',
                lbl: 'Plan',
                class: 'col-12 col-md-6 mb-3',
                required: true,
                data: dataInit.plans || []
            },
            {
                opc: 'select',
                id: 'status',
                lbl: 'Estado',
                class: 'col-12 col-md-6 mb-3',
                data: dataInit.subscriptionStatusOptions || []
            },
            {
                opc: 'input',
                id: 'external_reference',
                lbl: 'Referencia externa',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'starts_at',
                lbl: 'Inicio',
                type: 'date',
                class: 'col-12 col-md-4 mb-3'
            },
            {
                opc: 'input',
                id: 'ends_at',
                lbl: 'Fin',
                type: 'date',
                class: 'col-12 col-md-4 mb-3'
            },
            {
                opc: 'input',
                id: 'next_billing_date',
                lbl: 'Próximo cobro',
                type: 'date',
                class: 'col-12 col-md-4 mb-3'
            }
        ];
    }
}

/* ====================== Pagos ====================== */

class Payments extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Payments';
    }

    render() {
        const container = $('#container-pagos');
        container.html(`
            <div id="filterbar-payments" class="mb-2"></div>
            <div id="table-payments"></div>
        `);

        this.createfilterBar({
            parent: 'filterbar-payments',
            data: [
                {
                    opc: 'select',
                    id: 'status',
                    lbl: 'Estado',
                    class: 'col-12 col-md-3',
                    data: dataInit.paymentStatusFilter || [],
                    onchange: 'payments.lsPayments()'
                },
                {
                    opc: 'button',
                    class: 'col-12 col-md-3',
                    id: 'btnNewPayment',
                    text: 'Registrar Pago',
                    onClick: () => this.addPayment()
                }
            ]
        });
    }

    lsPayments() {
        this.createTable({
            parent: 'table-payments',
            idFilterBar: 'filterbar-payments',
            data: { opc: 'lsPayments' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbPayments',
                theme: 'light',
                center: [6],
                right: [2]
            }
        });
    }

    addPayment() {
        if (!(dataInit.companies || []).length) {
            alert({ icon: 'info', text: 'Primero registra al menos una empresa activa', btn1: true });
            return;
        }
        this.createModalForm({
            id: 'formPaymentAdd',
            data: { opc: 'addPayment' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Registrar Pago' },
            json: this.jsonPayment(),
            success: (r) => this._afterSave(r)
        });
    }

    async editPayment(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getPayment', id: id } });
        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar el pago', btn1: true });
            return;
        }

        this.createModalForm({
            id: 'formPaymentEdit',
            data: { opc: 'editPayment', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Editar Pago' },
            autofill: request.data,
            json: this.jsonPayment(),
            success: (r) => this._afterSave(r)
        });
    }

    changeStatus(id, current) {
        this.createModalForm({
            id: 'formPaymentStatus',
            data: { opc: 'changePaymentStatus', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Cambiar estado del pago' },
            autofill: { status: current },
            json: [
                {
                    opc: 'select',
                    id: 'status',
                    lbl: 'Estado',
                    class: 'col-12 mb-3',
                    required: true,
                    data: dataInit.paymentStatusOptions || []
                }
            ],
            success: (r) => this._afterSave(r)
        });
    }

    _afterSave(r) {
        notify(r);
        if (r.status == 200) this.lsPayments();
    }

    jsonPayment() {
        return [
            {
                opc: 'select',
                id: 'company_id',
                lbl: 'Empresa',
                class: 'col-12 col-md-6 mb-3',
                required: true,
                data: dataInit.companies || []
            },
            {
                opc: 'select',
                id: 'subscription_id',
                lbl: 'Suscripción (opcional)',
                class: 'col-12 col-md-6 mb-3',
                data: dataInit.subscriptions || []
            },
            {
                opc: 'input',
                id: 'amount',
                lbl: 'Monto',
                type: 'number',
                class: 'col-12 col-md-6 mb-3',
                required: true
            },
            {
                opc: 'input',
                id: 'currency',
                lbl: 'Moneda',
                class: 'col-12 col-md-6 mb-3',
                value: 'MXN'
            },
            {
                opc: 'select',
                id: 'status',
                lbl: 'Estado',
                class: 'col-12 col-md-6 mb-3',
                data: dataInit.paymentStatusOptions || []
            },
            {
                opc: 'input',
                id: 'gateway',
                lbl: 'Pasarela',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'transaction_id',
                lbl: 'ID de transacción',
                type: 'number',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'paid_at',
                lbl: 'Fecha de pago',
                type: 'date',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'invoice_url',
                lbl: 'URL de factura',
                class: 'col-12 mb-3'
            }
        ];
    }
}

/* ====================== Cupones ====================== */

class Coupons extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Coupons';
    }

    render() {
        const container = $('#container-cupones');
        container.html(`
            <div id="filterbar-coupons" class="mb-2"></div>
            <div id="table-coupons"></div>
        `);

        this.createfilterBar({
            parent: 'filterbar-coupons',
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    class: 'col-12 col-md-3',
                    data: dataInit.statusFilter || [],
                    onchange: 'coupons.lsCoupons()'
                },
                {
                    opc: 'button',
                    class: 'col-12 col-md-3',
                    id: 'btnNewCoupon',
                    text: 'Nuevo Cupón',
                    onClick: () => this.addCoupon()
                }
            ]
        });
    }

    lsCoupons() {
        this.createTable({
            parent: 'table-coupons',
            idFilterBar: 'filterbar-coupons',
            data: { opc: 'lsCoupons' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbCoupons',
                theme: 'light',
                center: [4, 6],
                right: []
            }
        });
    }

    addCoupon() {
        this.createModalForm({
            id: 'formCouponAdd',
            data: { opc: 'addCoupon' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Nuevo Cupón' },
            json: this.jsonCoupon(),
            success: (r) => this._afterSave(r)
        });
    }

    async editCoupon(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getCoupon', id: id } });
        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar el cupón', btn1: true });
            return;
        }

        const data = request.data;
        if (data.discount_type != null) data.discount_type = String(data.discount_type);

        this.createModalForm({
            id: 'formCouponEdit',
            data: { opc: 'editCoupon', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Editar Cupón' },
            autofill: data,
            json: this.jsonCoupon(),
            success: (r) => this._afterSave(r)
        });
    }

    toggleCoupon(id, active) {
        const action = active == 1 ? 'activar' : 'desactivar';
        this.swalQuestion({
            opts: {
                title: `¿${active == 1 ? 'Activar' : 'Desactivar'} cupón?`,
                text: `¿Deseas ${action} este cupón?`,
                icon: 'warning'
            },
            data: { opc: 'toggleCoupon', id: id, active: active },
            methods: { send: (r) => this._afterSave(r) }
        });
    }

    _afterSave(r) {
        notify(r);
        if (r.status == 200) this.lsCoupons();
    }

    jsonCoupon() {
        return [
            {
                opc: 'input',
                id: 'code',
                lbl: 'Código',
                class: 'col-12 col-md-6 mb-3',
                required: true
            },
            {
                opc: 'select',
                id: 'discount_type',
                lbl: 'Tipo de descuento',
                class: 'col-12 col-md-6 mb-3',
                data: dataInit.discountTypeOptions || []
            },
            {
                opc: 'input',
                id: 'discount_value',
                lbl: 'Valor del descuento',
                type: 'number',
                class: 'col-12 col-md-6 mb-3',
                required: true
            },
            {
                opc: 'input',
                id: 'max_redemptions',
                lbl: 'Máx. canjes',
                type: 'number',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'description',
                lbl: 'Descripción',
                class: 'col-12 mb-3'
            },
            {
                opc: 'input',
                id: 'valid_from',
                lbl: 'Válido desde',
                type: 'date',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'valid_to',
                lbl: 'Válido hasta',
                type: 'date',
                class: 'col-12 col-md-6 mb-3'
            }
        ];
    }
}

/* ====================== Canjes (solo lectura) ====================== */

class Redemptions extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Redemptions';
    }

    render() {
        const container = $('#container-canjes');
        container.html(`
            <div id="filterbar-redemptions" class="mb-2"></div>
            <div id="table-redemptions"></div>
        `);

        this.createfilterBar({
            parent: 'filterbar-redemptions',
            data: [
                {
                    opc: 'button',
                    class: 'col-12 col-md-3',
                    id: 'btnRefreshRedemptions',
                    text: 'Actualizar',
                    onClick: () => this.lsRedemptions()
                }
            ]
        });
    }

    lsRedemptions() {
        this.createTable({
            parent: 'table-redemptions',
            idFilterBar: 'filterbar-redemptions',
            data: { opc: 'lsRedemptions' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbRedemptions',
                theme: 'light',
                center: [3, 4],
                right: []
            }
        });
    }
}

/* ====================== Módulos ====================== */

class Modules extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Modules';
    }

    render() {
        $('#container-modulos').html(`
            <div id="filterbar-modules" class="mb-2"></div>
            <div id="table-modules"></div>
        `);
        this.createfilterBar({
            parent: 'filterbar-modules',
            data: [
                { opc: 'select', id: 'active', lbl: 'Estado', class: 'col-12 col-md-3', data: dataInit.statusFilter || [], onchange: 'modules.lsModules()' },
                { opc: 'button', class: 'col-12 col-md-3', id: 'btnNewModule', text: 'Nuevo Módulo', onClick: () => this.addModule() }
            ]
        });
    }

    lsModules() {
        this.createTable({
            parent: 'table-modules', idFilterBar: 'filterbar-modules',
            data: { opc: 'lsModules' }, coffeesoft: true, conf: { datatable: true, pag: 10 },
            attr: { id: 'tbModules', theme: 'light', center: [4, 5], right: [] }
        });
    }

    addModule() {
        this.createModalForm({
            id: 'formModuleAdd', data: { opc: 'addModule' }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Nuevo Módulo' }, json: this.jsonModule(),
            success: (r) => this._afterSave(r)
        });
    }

    async editModule(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getModule', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar el módulo', btn1: true }); return; }
        this.createModalForm({
            id: 'formModuleEdit', data: { opc: 'editModule', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Editar Módulo' }, autofill: request.data, json: this.jsonModule(),
            success: (r) => this._afterSave(r)
        });
    }

    toggleModule(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} módulo?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} este módulo?`, icon: 'warning' },
            data: { opc: 'toggleModule', id: id, active: active },
            methods: { send: (r) => this._afterSave(r) }
        });
    }

    _afterSave(r) { notify(r); if (r.status == 200) this.lsModules(); }

    jsonModule() {
        return [
            { opc: 'input', id: 'name', lbl: 'Nombre del módulo', class: 'col-12 col-md-6 mb-3', required: true },
            { opc: 'input', id: 'code', lbl: 'Código', class: 'col-12 col-md-6 mb-3' },
            { opc: 'input', id: 'route', lbl: 'Ruta', class: 'col-12 col-md-8 mb-3' },
            { opc: 'input', id: 'orden', lbl: 'Orden', type: 'number', class: 'col-12 col-md-4 mb-3' }
        ];
    }
}

/* ====================== Submódulos ====================== */

class Submodules extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Submodules';
    }

    render() {
        $('#container-submodulos').html(`
            <div id="filterbar-submodules" class="mb-2"></div>
            <div id="table-submodules"></div>
        `);
        this.createfilterBar({
            parent: 'filterbar-submodules',
            data: [
                { opc: 'select', id: 'active', lbl: 'Estado', class: 'col-12 col-md-3', data: dataInit.statusFilter || [], onchange: 'submodules.lsSubmodules()' },
                { opc: 'button', class: 'col-12 col-md-3', id: 'btnNewSubmodule', text: 'Nuevo Submódulo', onClick: () => this.addSubmodule() }
            ]
        });
    }

    lsSubmodules() {
        this.createTable({
            parent: 'table-submodules', idFilterBar: 'filterbar-submodules',
            data: { opc: 'lsSubmodules' }, coffeesoft: true, conf: { datatable: true, pag: 10 },
            attr: { id: 'tbSubmodules', theme: 'light', center: [5, 6], right: [] }
        });
    }

    addSubmodule() {
        if (!(dataInit.modules || []).length) { alert({ icon: 'info', text: 'Primero registra al menos un módulo activo', btn1: true }); return; }
        this.createModalForm({
            id: 'formSubmoduleAdd', data: { opc: 'addSubmodule' }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Nuevo Submódulo' }, json: this.jsonSubmodule(),
            success: (r) => this._afterSave(r)
        });
    }

    async editSubmodule(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getSubmodule', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar el submódulo', btn1: true }); return; }
        this.createModalForm({
            id: 'formSubmoduleEdit', data: { opc: 'editSubmodule', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Editar Submódulo' }, autofill: request.data, json: this.jsonSubmodule(),
            success: (r) => this._afterSave(r)
        });
    }

    toggleSubmodule(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} submódulo?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} este submódulo?`, icon: 'warning' },
            data: { opc: 'toggleSubmodule', id: id, active: active },
            methods: { send: (r) => this._afterSave(r) }
        });
    }

    _afterSave(r) { notify(r); if (r.status == 200) this.lsSubmodules(); }

    jsonSubmodule() {
        return [
            { opc: 'input', id: 'name', lbl: 'Nombre del submódulo', class: 'col-12 col-md-6 mb-3', required: true },
            { opc: 'select', id: 'module_id', lbl: 'Módulo', class: 'col-12 col-md-6 mb-3', required: true, data: dataInit.modules || [] },
            { opc: 'input', id: 'code', lbl: 'Código', class: 'col-12 col-md-6 mb-3' },
            { opc: 'input', id: 'route', lbl: 'Ruta', class: 'col-12 col-md-6 mb-3' },
            { opc: 'input', id: 'orden', lbl: 'Orden', type: 'number', class: 'col-12 col-md-4 mb-3' }
        ];
    }
}

/* ====================== Secciones ====================== */

class Sections extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Sections';
    }

    render() {
        $('#container-secciones').html(`
            <div id="filterbar-sections" class="mb-2"></div>
            <div id="table-sections"></div>
        `);
        this.createfilterBar({
            parent: 'filterbar-sections',
            data: [
                { opc: 'select', id: 'active', lbl: 'Estado', class: 'col-12 col-md-3', data: dataInit.statusFilter || [], onchange: 'sections.lsSections()' },
                { opc: 'button', class: 'col-12 col-md-3', id: 'btnNewSection', text: 'Nueva Sección', onClick: () => this.addSection() }
            ]
        });
    }

    lsSections() {
        this.createTable({
            parent: 'table-sections', idFilterBar: 'filterbar-sections',
            data: { opc: 'lsSections' }, coffeesoft: true, conf: { datatable: true, pag: 10 },
            attr: { id: 'tbSections', theme: 'light', center: [5, 6], right: [] }
        });
    }

    addSection() {
        if (!(dataInit.modules || []).length) { alert({ icon: 'info', text: 'Primero registra al menos un módulo activo', btn1: true }); return; }
        this.createModalForm({
            id: 'formSectionAdd', data: { opc: 'addSection' }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Nueva Sección' }, json: this.jsonSection(),
            success: (r) => this._afterSave(r)
        });
    }

    async editSection(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getSection', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar la sección', btn1: true }); return; }
        this.createModalForm({
            id: 'formSectionEdit', data: { opc: 'editSection', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Editar Sección' }, autofill: request.data, json: this.jsonSection(),
            success: (r) => this._afterSave(r)
        });
    }

    toggleSection(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} sección?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} esta sección?`, icon: 'warning' },
            data: { opc: 'toggleSection', id: id, active: active },
            methods: { send: (r) => this._afterSave(r) }
        });
    }

    _afterSave(r) { notify(r); if (r.status == 200) this.lsSections(); }

    jsonSection() {
        return [
            { opc: 'input', id: 'name', lbl: 'Nombre de la sección', class: 'col-12 col-md-6 mb-3', required: true },
            { opc: 'select', id: 'module_id', lbl: 'Módulo', class: 'col-12 col-md-6 mb-3', required: true, data: dataInit.modules || [] },
            { opc: 'select', id: 'submodule_id', lbl: 'Submódulo (opcional)', class: 'col-12 col-md-6 mb-3', data: dataInit.submodules || [] },
            { opc: 'input', id: 'code', lbl: 'Código', class: 'col-12 col-md-6 mb-3' },
            { opc: 'input', id: 'route', lbl: 'Ruta', class: 'col-12 col-md-8 mb-3' },
            { opc: 'input', id: 'orden', lbl: 'Orden', type: 'number', class: 'col-12 col-md-4 mb-3' }
        ];
    }
}

/* ====================== Tipos de permiso ====================== */

class TypePermissions extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'TypePermissions';
    }

    render() {
        $('#container-tipos-permiso').html(`
            <div id="filterbar-types" class="mb-2"></div>
            <div id="table-types"></div>
        `);
        this.createfilterBar({
            parent: 'filterbar-types',
            data: [
                { opc: 'select', id: 'active', lbl: 'Estado', class: 'col-12 col-md-3', data: dataInit.statusFilter || [], onchange: 'typePermissions.lsTypePermissions()' },
                { opc: 'button', class: 'col-12 col-md-3', id: 'btnNewType', text: 'Nuevo Tipo', onClick: () => this.addType() }
            ]
        });
    }

    lsTypePermissions() {
        this.createTable({
            parent: 'table-types', idFilterBar: 'filterbar-types',
            data: { opc: 'lsTypePermissions' }, coffeesoft: true, conf: { datatable: true, pag: 10 },
            attr: { id: 'tbTypes', theme: 'light', center: [2], right: [] }
        });
    }

    addType() {
        this.createModalForm({
            id: 'formTypeAdd', data: { opc: 'addTypePermission' }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Nuevo Tipo de Permiso' }, json: this.jsonType(),
            success: (r) => this._afterSave(r)
        });
    }

    async editTypePermission(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getTypePermission', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar el tipo', btn1: true }); return; }
        this.createModalForm({
            id: 'formTypeEdit', data: { opc: 'editTypePermission', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Editar Tipo de Permiso' }, autofill: request.data, json: this.jsonType(),
            success: (r) => this._afterSave(r)
        });
    }

    toggleTypePermission(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} tipo?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} este tipo de permiso?`, icon: 'warning' },
            data: { opc: 'toggleTypePermission', id: id, active: active },
            methods: { send: (r) => this._afterSave(r) }
        });
    }

    _afterSave(r) { notify(r); if (r.status == 200) this.lsTypePermissions(); }

    jsonType() {
        return [
            { opc: 'input', id: 'name', lbl: 'Nombre del tipo de permiso', class: 'col-12 mb-3', required: true }
        ];
    }
}

/* ====================== Roles ====================== */

class Roles extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Roles';
    }

    render() {
        $('#container-roles').html(`
            <div id="filterbar-roles" class="mb-2"></div>
            <div id="table-roles"></div>
        `);
        this.createfilterBar({
            parent: 'filterbar-roles',
            data: [
                { opc: 'select', id: 'active', lbl: 'Estado', class: 'col-12 col-md-3', data: dataInit.statusFilter || [], onchange: 'roles.lsRoles()' },
                { opc: 'button', class: 'col-12 col-md-3', id: 'btnNewRole', text: 'Nuevo Rol', onClick: () => this.addRole() }
            ]
        });
    }

    lsRoles() {
        this.createTable({
            parent: 'table-roles', idFilterBar: 'filterbar-roles',
            data: { opc: 'lsRoles' }, coffeesoft: true, conf: { datatable: true, pag: 10 },
            attr: { id: 'tbRoles', theme: 'light', center: [3, 4], right: [] }
        });
    }

    addRole() {
        this.createModalForm({
            id: 'formRoleAdd', data: { opc: 'addRole' }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Nuevo Rol' }, json: this.jsonRole(),
            success: (r) => this._afterSave(r)
        });
    }

    async editRole(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getRole', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar el rol', btn1: true }); return; }
        this.createModalForm({
            id: 'formRoleEdit', data: { opc: 'editRole', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Editar Rol' }, autofill: request.data, json: this.jsonRole(),
            success: (r) => this._afterSave(r)
        });
    }

    toggleRole(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} rol?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} este rol?`, icon: 'warning' },
            data: { opc: 'toggleRole', id: id, active: active },
            methods: { send: (r) => this._afterSave(r) }
        });
    }

    _afterSave(r) { notify(r); if (r.status == 200) this.lsRoles(); }

    jsonRole() {
        return [
            { opc: 'input', id: 'code', lbl: 'Código', class: 'col-12 col-md-6 mb-3' },
            { opc: 'input', id: 'name', lbl: 'Nombre del rol', class: 'col-12 col-md-6 mb-3', required: true }
        ];
    }
}

/* ====================== Permisos (matriz rol × sección × tipo) ====================== */

class Permissions extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Permissions';
    }

    render() {
        $('#container-permisos').html(`
            <div id="filterbar-permissions" class="mb-2"></div>
            <div id="table-permissions"></div>
        `);
        this.createfilterBar({
            parent: 'filterbar-permissions',
            data: [
                { opc: 'select', id: 'active', lbl: 'Estado', class: 'col-12 col-md-3', data: dataInit.statusFilter || [], onchange: 'permissions.lsPermissions()' },
                { opc: 'button', class: 'col-12 col-md-3', id: 'btnNewPermission', text: 'Asignar Permiso', onClick: () => this.addPermission() }
            ]
        });
    }

    lsPermissions() {
        this.createTable({
            parent: 'table-permissions', idFilterBar: 'filterbar-permissions',
            data: { opc: 'lsPermissions' }, coffeesoft: true, conf: { datatable: true, pag: 10 },
            attr: { id: 'tbPermissions', theme: 'light', center: [4], right: [] }
        });
    }

    addPermission() {
        if (!(dataInit.roles || []).length || !(dataInit.sections || []).length || !(dataInit.typePermissions || []).length) {
            alert({ icon: 'info', text: 'Necesitas al menos un rol, una sección y un tipo de permiso activos', btn1: true });
            return;
        }
        this.createModalForm({
            id: 'formPermissionAdd', data: { opc: 'addPermission' }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Asignar Permiso' },
            json: [
                { opc: 'select', id: 'role_id', lbl: 'Rol', class: 'col-12 mb-3', required: true, data: dataInit.roles || [] },
                { opc: 'select', id: 'section_id', lbl: 'Sección', class: 'col-12 mb-3', required: true, data: dataInit.sections || [] },
                { opc: 'select', id: 'type_permission_id', lbl: 'Tipo de permiso', class: 'col-12 mb-3', required: true, data: dataInit.typePermissions || [] }
            ],
            success: (r) => this._afterSave(r)
        });
    }

    togglePermission(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} permiso?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} este permiso?`, icon: 'warning' },
            data: { opc: 'togglePermission', id: id, active: active },
            methods: { send: (r) => this._afterSave(r) }
        });
    }

    _afterSave(r) { notify(r); if (r.status == 200) this.lsPermissions(); }
}
