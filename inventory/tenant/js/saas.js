// -- Empresas --

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
                    class: 'col-12 col-md-2',
                    data: dataInit.companyStatusFilter || [],
                    onchange: 'companies.lsCompanies()'
                },
                {
                    opc: 'button',
                    class: 'col-12 col-md-2',
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
                striped:true,
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
            success: (r) => afterSave(r, () => this.lsCompanies())
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
            success: (r) => afterSave(r, () => this.lsCompanies())
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
            success: (r) => afterSave(r, () => this.lsCompanies())
        });
    }

    jsonCompany(isNew) {
        const fields = [
            {
                opc: 'input',
                id: 'name',
                lbl: 'Nombre de la empresa',
                class: 'col-12 mb-3',
            },
            {
                opc: 'input',
                id: 'rfc',
                lbl: 'RFC',
                class: 'col-12 col-md-6 mb-3',
                required:false
            },
            {
                opc: 'input',
                id: 'database_name',
                lbl: 'Base de datos',
                class: 'col-12 col-md-6 mb-3',
                required: false

            },
            {
                opc: 'input',
                id: 'ubication',
                lbl: 'Ubicación',
                class: 'col-12 mb-3',
                required: false

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

// -- Planes --

const SAMPLE_PLANS = [
    { id: 1, code: 'FREE', name: 'Free', price: 0, currency: 'MXN', billing_cycle: 'monthly', max_users: 1, max_branches: 1, trial_days: 0, is_active: 1 },
    { id: 2, code: 'BSC', name: 'Básico', price: 299, currency: 'MXN', billing_cycle: 'monthly', max_users: 5, max_branches: 1, trial_days: 14, is_active: 1 },
    { id: 3, code: 'PRO', name: 'Profesional', price: 799, currency: 'MXN', billing_cycle: 'monthly', max_users: 20, max_branches: 3, trial_days: 14, is_active: 1 },
    { id: 4, code: 'ENT', name: 'Enterprise', price: 1999, currency: 'MXN', billing_cycle: 'yearly', max_users: null, max_branches: null, trial_days: 30, is_active: 0 }
];

class Plans extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Plans';
    }

    render() {
        const container = $('#container-planes');
        container.html(`
            <div id="filterbar-plans" class="mb-2"></div>
            <div id="cards-plans" class="mt-3"></div>
        `);

        this.createfilterBar({
            parent: 'filterbar-plans',
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    class: 'col-12 col-md-2',
                    data: dataInit.statusFilter || [],
                    onchange: 'plans.lsPlans()'
                },
                {
                    opc: 'button',
                    class: 'col-12 col-md-2',
                    id: 'btnNewPlan',
                    text: 'Nuevo Plan',
                    onClick: () => this.addPlan()
                }
            ]
        });
    }

    async lsPlans() {
        const activeVal = $('#filterbar-plans #active').val() ?? 1;
        const response = await useFetch({
            url: this._link,
            data: { opc: 'lsPlans', active: activeVal }
        });

        const list = (response.status === 200 && response.ls) ? response.ls : [];
        this.renderPlanCards(list);
    }

    renderPlanCards(plans) {
        const $wrap = $('#cards-plans');

        if (!plans.length) {
            $wrap.html(`
                <div class="flex items-center justify-center py-16 text-gray-400">
                    <p class="text-sm">Sin planes para mostrar.</p>
                </div>
            `);
            return;
        }

        const cards = plans.map(p => this.buildPlanCard(p)).join('');
        $wrap.html(`<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 p-1">${cards}</div>`);
    }

    buildPlanCard(p) {
        const isActive = parseInt(p.is_active) === 1;
        const price    = parseFloat(p.price);
        const currency = p.currency || 'MXN';

        const priceHtml = price === 0
            ? `<span class="text-xl font-bold text-gray-800">Gratis</span>`
            : `<span class="text-xl font-bold text-gray-800">$${Number(price).toFixed(2)}</span>
               <span class="text-[11px] text-gray-400 ml-0.5">/${currency}</span>`;

        const bullets = this.buildBullets(p);
        const bulletsHtml = bullets.map(b => `
            <li class="flex items-start gap-1.5 text-[11px] text-gray-600">
                <span class="text-[#C05A40] font-bold leading-none">✓</span>
                <span>${b}</span>
            </li>
        `).join('');

        const toggleChecked = isActive ? 'checked' : '';
        const toggleNext    = isActive ? 0 : 1;
        const cardBorder    = isActive ? 'border-[#C05A40]' : 'border-gray-200 opacity-70';

        return `
            <div class="bg-white rounded-lg border ${cardBorder} shadow-sm flex flex-col p-3 gap-2.5 transition-all hover:shadow-md">
                <div class="flex items-start justify-between gap-1.5">
                    <div class="min-w-0">
                        <p class="text-[9px] font-semibold text-[#C05A40] uppercase tracking-wide">${p.code || ''}</p>
                        <h3 class="text-sm font-bold text-gray-800 leading-tight truncate">${p.name}</h3>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5" title="${isActive ? 'Desactivar' : 'Activar'}">
                        <input type="checkbox" class="sr-only peer" ${toggleChecked}
                            onchange="plans.togglePlan(${p.id}, ${toggleNext})">
                        <div class="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer
                            peer-checked:bg-[#C05A40]
                            after:content-[''] after:absolute after:top-0.5 after:left-0.5
                            after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all
                            peer-checked:after:translate-x-4">
                        </div>
                    </label>
                </div>

                <div class="flex items-baseline gap-0.5">
                    ${priceHtml}
                </div>

                <ul class="flex flex-col gap-1 flex-1">
                    ${bulletsHtml}
                </ul>

                <div class="flex gap-1.5 pt-2 border-t border-gray-100">
                    <button onclick="plans.editPlan(${p.id})"
                        class="flex-1 text-[11px] border border-[#C05A40] text-[#C05A40] rounded-md py-1 px-2 font-medium hover:bg-[#C05A40] hover:text-white transition-colors">
                        Editar
                    </button>
                    <button onclick="plans.configurePlan(${p.id})"
                        class="flex-1 text-[11px] bg-[#C05A40] text-white rounded-md py-1 px-2 font-medium hover:bg-[#a34b34] transition-colors">
                        Configurar
                    </button>
                </div>
            </div>
        `;
    }

    buildBullets(p) {
        const bullets = [];

        if (p.max_users != null && p.max_users !== '')
            bullets.push(`${p.max_users} usuario${p.max_users == 1 ? '' : 's'}`);
        else
            bullets.push('Usuarios ilimitados');

        if (p.max_branches != null && p.max_branches !== '')
            bullets.push(`${p.max_branches} sucursal${p.max_branches == 1 ? '' : 'es'}`);
        else
            bullets.push('Sucursales ilimitadas');

        const cycle = p.billing_cycle;
        if (cycle === 'monthly')  bullets.push('Facturación mensual');
        else if (cycle === 'yearly')  bullets.push('Facturación anual');
        else if (cycle === 'weekly')  bullets.push('Facturación semanal');
        else if (cycle)               bullets.push(`Ciclo: ${cycle}`);

        const trial = parseInt(p.trial_days);
        if (trial > 0) bullets.push(`${trial} días de prueba gratis`);

        return bullets;
    }

    configurePlan(id) {
        Swal.fire({
            icon: 'info',
            title: 'Próximamente',
            text: 'La configuración avanzada del plan estará disponible pronto.',
            confirmButtonColor: '#C05A40'
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
            success: (r) => afterSave(r, () => this.lsPlans())
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
            success: (r) => afterSave(r, () => this.lsPlans())
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
            methods: { send: (r) => afterSave(r, () => this.lsPlans()) }
        });
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

// -- Suscripciones --

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
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'status',
                    lbl: 'Estado',
                    class: 'col-12 col-md-2',
                    data: dataInit.subscriptionStatusFilter || [],
                    onchange: 'subscriptions.lsSubscriptions()'
                },
                {
                    opc: 'button',
                    class: 'col-12 col-md-2',
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
            success: (r) => afterSave(r, () => this.lsSubscriptions())
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
            success: (r) => afterSave(r, () => this.lsSubscriptions())
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
            success: (r) => afterSave(r, () => this.lsSubscriptions())
        });
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

// -- Pagos --

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
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'status',
                    lbl: 'Estado',
                    class: 'col-12 col-md-2',
                    data: dataInit.paymentStatusFilter || [],
                    onchange: 'payments.lsPayments()'
                },
                {
                    opc: 'button',
                    class: 'col-12 col-md-2',
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
            success: (r) => afterSave(r, () => this.lsPayments())
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
            success: (r) => afterSave(r, () => this.lsPayments())
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
            success: (r) => afterSave(r, () => this.lsPayments())
        });
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
                selected: '-- Selecciona --',
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

// -- Cupones --

class Coupons extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Coupons';
    }

    render() {
        const container = $('#container-cupones');
        container.html(`
            <div id="filterbar-coupons" class="mb-2"></div>
            <div id="cards-coupons" class="mt-3"></div>
        `);

        this.createfilterBar({
            parent: 'filterbar-coupons',
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    class: 'col-12 col-md-2',
                    data: dataInit.statusFilter || [],
                    onchange: 'coupons.lsCoupons()'
                },
                {
                    opc: 'button',
                    class: 'col-12 col-md-2',
                    id: 'btnNewCoupon',
                    text: 'Nuevo Cupón',
                    onClick: () => this.addCoupon()
                }
            ]
        });
    }

    async lsCoupons() {
        const activeVal = $('#filterbar-coupons #active').val() ?? 1;
        const response = await useFetch({
            url: this._link,
            data: { opc: 'lsCoupons', active: activeVal }
        });

        const list = (response.status === 200 && response.ls) ? response.ls : [];
        this.renderCouponCards(list);
    }

    renderCouponCards(coupons) {
        const $wrap = $('#cards-coupons');

        if (!coupons.length) {
            $wrap.html(`
                <div class="flex items-center justify-center py-16 text-gray-400">
                    <p class="text-sm">Sin cupones para mostrar.</p>
                </div>
            `);
            return;
        }

        const cards = coupons.map(c => this.buildCouponCard(c)).join('');
        $wrap.html(`<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 p-1">${cards}</div>`);
    }

    buildCouponCard(c) {
        const isActive = parseInt(c.is_active) === 1;
        const value    = parseFloat(c.discount_value) || 0;
        const discount = c.discount_type === 'percent'
            ? `${value % 1 === 0 ? value : value.toFixed(2)}%`
            : `$${value.toFixed(2)}`;

        const used  = parseInt(c.times_redeemed) || 0;
        const max   = (c.max_redemptions != null && c.max_redemptions !== '') ? c.max_redemptions : '∞';
        const desde = c.valid_from || '—';
        const hasta = c.valid_to || '—';

        const toggleChecked = isActive ? 'checked' : '';
        const toggleNext    = isActive ? 0 : 1;
        const cardBorder    = isActive ? 'border-[#C05A40]' : 'border-gray-200 opacity-70';

        return `
            <div class="bg-white rounded-lg border ${cardBorder} shadow-sm flex flex-col p-3 gap-2.5 transition-all hover:shadow-md">
                <div class="flex items-start justify-between gap-1.5">
                    <div class="min-w-0">
                        <p class="text-[9px] font-semibold text-[#C05A40] uppercase tracking-wide">Cupón</p>
                        <h3 class="text-sm font-bold text-gray-800 leading-tight font-mono truncate">${c.code || ''}</h3>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5" title="${isActive ? 'Desactivar' : 'Activar'}">
                        <input type="checkbox" class="sr-only peer" ${toggleChecked}
                            onchange="coupons.toggleCoupon(${c.id}, ${toggleNext})">
                        <div class="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer
                            peer-checked:bg-[#C05A40]
                            after:content-[''] after:absolute after:top-0.5 after:left-0.5
                            after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all
                            peer-checked:after:translate-x-4">
                        </div>
                    </label>
                </div>

                <div class="flex items-baseline gap-0.5">
                    <span class="text-xl font-bold text-gray-800">${discount}</span>
                    <span class="text-[11px] text-gray-400 ml-0.5">descuento</span>
                </div>

                <div class="flex flex-col gap-1 flex-1">
                    ${c.description ? `<p class="text-[11px] text-gray-600 leading-snug">${c.description}</p>` : ''}
                    <div class="flex items-center gap-1.5 text-[11px] text-gray-600">
                        <span class="text-[#C05A40] font-bold leading-none">✓</span>
                        <span>${used} / ${max} usos</span>
                    </div>
                    <div class="flex items-center gap-1.5 text-[11px] text-gray-600">
                        <span class="text-[#C05A40] font-bold leading-none">✓</span>
                        <span>${desde} → ${hasta}</span>
                    </div>
                </div>

                <div class="flex gap-1.5 pt-2 border-t border-gray-100">
                    <button onclick="coupons.editCoupon(${c.id})"
                        class="flex-1 text-[11px] border border-[#C05A40] text-[#C05A40] rounded-md py-1 px-2 font-medium hover:bg-[#C05A40] hover:text-white transition-colors">
                        Editar
                    </button>
                </div>
            </div>
        `;
    }

    addCoupon() {
        this.createModalForm({
            id: 'formCouponAdd',
            data: { opc: 'addCoupon' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Nuevo Cupón' },
            json: this.jsonCoupon(),
            success: (r) => afterSave(r, () => this.lsCoupons())
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
            success: (r) => afterSave(r, () => this.lsCoupons())
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
            methods: { send: (r) => afterSave(r, () => this.lsCoupons()) }
        });
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

// -- Canjes --

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
            coffeesoft: true,
            data: [
                {
                    opc: 'button',
                    class: 'col-12 col-md-2',
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

// -- Usuarios (asignación de rol por sucursal) --

class Users extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Users';
    }

    render() {
        $('#container-usuarios').html(`
            <div id="filterbar-users" class="mb-2"></div>
            <div id="table-users"></div>
        `);
        this.createfilterBar({
            parent: 'filterbar-users',
            coffeesoft: true,
            data: [
                {
                    opc: 'button',
                    class: 'col-12 col-md-2',
                    id: 'btnRefreshUsers',
                    text: 'Actualizar',
                    onClick: () => this.lsUsers()
                }
            ]
        });
    }

    lsUsers() {
        this.createTable({
            parent: 'table-users',
            idFilterBar: 'filterbar-users',
            data: { opc: 'lsUsers' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: { id: 'tbUsers', theme: 'light', center: [4], right: [] }
        });
    }

    // Alta de asignación: el usuario ya viene fijado; se elige sucursal + rol.
    assign(userId) {
        if (!(dataInit.branches || []).length) {
            alert({ icon: 'info', text: 'No hay sucursales activas en la empresa', btn1: true });
            return;
        }
        if (!(dataInit.roles || []).length) {
            alert({ icon: 'info', text: 'Primero registra al menos un rol activo', btn1: true });
            return;
        }
        this.createModalForm({
            id: 'formUserAssign',
            data: { opc: 'assignUserRole', user_id: userId },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Asignar rol al usuario' },
            json: [
                { opc: 'select', id: 'branch_id', lbl: 'Sucursal', class: 'col-12 mb-3', required: true, data: dataInit.branches || [] },
                { opc: 'select', id: 'role_id', lbl: 'Rol', class: 'col-12 mb-3', required: true, data: dataInit.roles || [] }
            ],
            success: (r) => afterSave(r, () => this.lsUsers())
        });
    }

    // Edición: solo cambia el rol de una asignación existente.
    editAssignment(assignmentId, currentRoleId) {
        this.createModalForm({
            id: 'formUserRoleEdit',
            data: { opc: 'updateUserRole', assignment_id: assignmentId },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Cambiar rol del usuario' },
            autofill: { role_id: String(currentRoleId) },
            json: [
                { opc: 'select', id: 'role_id', lbl: 'Rol', class: 'col-12 mb-3', required: true, data: dataInit.roles || [] }
            ],
            success: (r) => afterSave(r, () => this.lsUsers())
        });
    }

    removeAssignment(assignmentId) {
        this.swalQuestion({
            opts: { title: '¿Quitar asignación?', text: 'El usuario quedará sin rol en esa sucursal.', icon: 'warning' },
            data: { opc: 'removeUserRole', assignment_id: assignmentId },
            methods: { send: (r) => afterSave(r, () => this.lsUsers()) }
        });
    }
}
