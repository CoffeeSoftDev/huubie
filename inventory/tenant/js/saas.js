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

// -- Usuarios (CRUD completo con rol) --

const USER_COLOR_PALETTE = [
    '#F4B8A4', '#A9CBD4', '#B8C4E0', '#B7D9A0',
    '#E8CBA0', '#C7B8E3', '#A3D0DE', '#E6B4C0',
    '#A6DDBF', '#E0C68A'
];

/*  La foto del colaborador se reduce a 320px y se entrega como dataURL: va a
    salir siempre dentro de un círculo de 64px o menos, y así el POST no carga
    con la foto original del celular. */
function compressAvatar(file, cb) {
    const reader = new FileReader();

    reader.onload = (ev) => {
        const img = new Image();

        img.onload = () => {
            const max = 320;
            let w = img.width, h = img.height;
            if (w > max || h > max) {
                const s = max / Math.max(w, h);
                w = Math.round(w * s);
                h = Math.round(h * s);
            }

            const canvas = document.createElement('canvas');
            canvas.width  = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);

            cb(canvas.toDataURL('image/jpeg', 0.85));
        };

        img.onerror = () => cb(ev.target.result);
        img.src = ev.target.result;
    };

    reader.readAsDataURL(file);
}

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
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    class: 'col-12 col-md-3',
                    data: dataInit.userStatusFilter || [],
                    onchange: 'users.lsUsers()'
                },
                {
                    opc: 'button',
                    class: 'col-12 col-md-3',
                    id: 'btnNewUser',
                    text: 'Nuevo Usuario',
                    onClick: () => this.addUser()
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
            attr: { id: 'tbUsers', theme: 'light', center: [5], right: [] }
        });
    }

    addUser() {
        if (!(dataInit.roles || []).length) {
            alert({ icon: 'info', text: 'Primero registra al menos un rol activo', btn1: true });
            return;
        }

        const modal = this.createModalForm({
            id: 'formUserAdd',
            data: { opc: 'addUser' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Nuevo Usuario' },
            json: this.jsonUser(false),
            success: (r) => afterSave(r, () => this.lsUsers())
        });
        this.injectSucursalChips('add_sucursales_chips', []);
        this.renderPhotoPicker('formUserAdd', '', null);
        this.renderColorSwatches('formUserAdd', null);
        this.guardPasswordMatch(modal);
        this.mountPasswordEyes();
    }

    async editUser(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getUser', id: id } });
        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar el usuario', btn1: true });
            return;
        }

        const data = request.data;
        const branchIds = Array.isArray(data.branch_ids) ? data.branch_ids.map(String) : [];
        const color = data.color || null;

        const modal = this.createModalForm({
            id: 'formUserEdit',
            data: { opc: 'editUser', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Editar Usuario' },
            autofill: Object.assign({}, data, { role_id: String(data.role_id || '') }),
            json: this.jsonUser(true),
            success: (r) => afterSave(r, () => this.lsUsers())
        });
        this.injectSucursalChips('edit_sucursales_chips', branchIds);
        this.renderPhotoPicker('formUserEdit', data.photo_url || '', color);
        this.renderColorSwatches('formUserEdit', color);
        this.guardPasswordMatch(modal);
        this.mountPasswordEyes();
    }

    toggleUser(id, active) {
        const action = active == 1 ? 'activar' : 'desactivar';
        this.swalQuestion({
            opts: {
                title: `¿${active == 1 ? 'Activar' : 'Desactivar'} usuario?`,
                text: `¿Deseas ${action} este usuario?`,
                icon: 'warning'
            },
            data: { opc: 'toggleUser', id: id, active: active },
            methods: { send: (r) => afterSave(r, () => this.lsUsers()) }
        });
    }

    // -- Selector multiple de sucursal --

    renderSucursalChips(containerId, selectedIds = []) {
        const $container = $('#' + containerId).empty();

        (dataInit.branches || []).forEach(s => {
            const isSelected = selectedIds.includes(String(s.id));

            const $chip = $('<span>', {
                class: 'inline-flex items-center gap-1 me-1 mb-1 px-3 py-1 rounded-full border text-sm font-medium cursor-pointer select-none transition ' +
                       (isSelected
                           ? 'bg-blue-100 text-blue-700 border-blue-200'
                           : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300')
            });

            $chip.append($('<span>', { text: s.valor }));
            if (isSelected) $chip.append($('<span>', { html: '&times;' }));

            $chip.on('click', () => {
                const idx = selectedIds.indexOf(String(s.id));
                if (idx > -1) selectedIds.splice(idx, 1);
                else selectedIds.push(String(s.id));
                this.renderSucursalChips(containerId, selectedIds);
            });

            $container.append($chip);
        });

        $('#branch_ids').val(selectedIds.join(','));
    }

    // jsonUser() pinta branch_ids como <select>; aqui se saca ese select y en
    // su lugar quedan el hidden que viaja al ctrl y la caja de chips.
    injectSucursalChips(chipsId, selectedIds = []) {
        const $hidden = $('<input>', {
            type: 'hidden', id: 'branch_ids', name: 'branch_ids', value: selectedIds.join(',')
        });
        const $box = $('<div>', {
            id: chipsId, class: 'flex flex-wrap bg-white border border-gray-200 rounded-lg p-2'
        });

        const $select = $('#branch_ids');
        $select.siblings().remove(); // quita el chevron que dejo el <select>
        $select.replaceWith($hidden);
        $hidden.after($box);

        this.renderSucursalChips(chipsId, selectedIds);
    }

    // -- Foto del colaborador --

    /*  La foto NO viaja como archivo: createModalForm manda el formulario por
        useFetch, que arma un URLSearchParams, y ahí un File se vuelve
        "[object File]". Por eso la imagen se comprime en el navegador y se
        manda como dataURL en un campo de texto (`photo_b64`). `photo_clear`
        avisa cuando se quitó. Mismo widget que admin/accesos. */
    renderPhotoPicker(formId, photoUrl, color) {
        const $form = $('#' + formId);

        const $b64   = $('<input>', { type: 'hidden', name: 'photo_b64',   value: '' });
        const $clear = $('<input>', { type: 'hidden', name: 'photo_clear', value: '' });

        const $avatar = $('<span>', {
            class: 'w-16 h-16 rounded-full flex items-center justify-center shrink-0 text-white',
            css: { backgroundColor: color || '#9CA3AF' }
        });

        const $file = $('<input>', {
            type: 'file', accept: 'image/*', class: 'hidden', id: formId + '_file'
        });

        const $pick = $('<label>', {
            class: 'px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer',
            text: 'Subir foto',
            for: formId + '_file'
        });

        const $remove = $('<button>', {
            type: 'button',
            class: 'px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-800',
            text: 'Quitar'
        });

        // Sin foto queda el ícono blanco sobre el color, lo mismo que enseñan la
        // navbar y el login.
        const paint = (src) => {
            $avatar.empty().append(src
                ? $('<img>', { src: src, class: 'w-full h-full rounded-full object-cover' })
                : $('<i>', { 'data-lucide': 'user', class: 'w-7 h-7' }));
            $remove.toggle(!!src);
            if (typeof lucide !== 'undefined') lucide.createIcons();
        };

        $file.on('change', function () {
            const file = this.files && this.files[0];
            if (!file) return;
            compressAvatar(file, (dataUrl) => {
                paint(dataUrl);
                $b64.val(dataUrl);
                $clear.val('');
            });
        });

        $remove.on('click', () => {
            paint('');
            $b64.val('');
            $clear.val('1');
            $file.val('');
        });

        const $wrap = $('<div>', { class: 'col-span-12 mb-3 flex items-center gap-3' })
            .append($avatar, $pick, $remove, $file, $b64, $clear);

        $form.prepend($wrap);
        paint(photoUrl || '');
    }

    // El color elegido repinta el fondo del avatar sin recargar el formulario.
    repaintPhotoBg(formId, hex) {
        $('#' + formId).find('.w-16.h-16.rounded-full').css('backgroundColor', hex);
    }

    // -- Color del colaborador --

    renderColorSwatches(formId, selectedColor) {
        const $form = $('#' + formId);

        const $colorWrap = $('<div>', { class: 'col-span-12 mb-3' });
        $colorWrap.append($('<label>', { class: 'form-label fw-semibold', text: 'Color del colaborador' }));
        const $swatches = $('<div>', { class: 'flex flex-wrap gap-2 mt-1' });

        USER_COLOR_PALETTE.forEach(hex => {
            const isActive = hex === selectedColor;
            const $swatch = $('<button>', {
                type: 'button',
                class: 'w-7 h-7 rounded-full border-2 transition ' + (isActive ? 'border-gray-800 scale-110' : 'border-transparent'),
                css: { backgroundColor: hex }
            });
            $swatch.on('click', () => {
                $swatches.find('button').removeClass('border-gray-800 scale-110').addClass('border-transparent');
                $swatch.removeClass('border-transparent').addClass('border-gray-800 scale-110');
                $form.find('[name="color"]').val(hex);
                this.repaintPhotoBg(formId, hex);
            });
            $swatches.append($swatch);
        });

        if (selectedColor) {
            $form.find('[name="color"]').val(selectedColor);
        }

        $colorWrap.append($swatches);
        $form.find('[name="color"]').closest('div').after($colorWrap);
    }

    // -- Doble confirmacion de contrasena --

    // El cfModal no expone un hook previo al envio: el boton Aceptar dispara
    // cfModalForm.trigger('submit') desde su propio click, y el atajo Enter
    // llama onOk() desde un keydown en document. Se frenan los dos en fase de
    // captura sobre el overlay, que corre antes que ambos manejadores.
    guardPasswordMatch(modal) {
        const btnOk = modal.footer.find('button').last()[0];
        if (!btnOk) return;

        const match = () => $('#password').val() === $('#password_confirmation').val();
        const block = (e) => {
            e.preventDefault();
            e.stopPropagation();
            alert({ icon: 'error', text: 'Las contraseñas no coinciden', btn1: true });
        };

        modal.el[0].addEventListener('click', (e) => {
            if (e.target.closest('button') !== btnOk) return;
            if (match()) return;
            block(e);
        }, true);

        modal.el[0].addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag !== 'input' && tag !== 'select') return;
            if (match()) return;
            block(e);
        }, true);

        $('#password, #password_confirmation').on('input', function () {
            const confirm = $('#password_confirmation').val();
            const mismatch = confirm !== '' && confirm !== $('#password').val();
            $('#password_confirmation').css('border-color', mismatch ? '#9D3434' : '');
        });
    }

    // -- Ojo de contraseña --

    mountPasswordEyes() {
        ['password', 'password_confirmation'].forEach((id) => {
            const $input = $('#' + id);
            if (!$input.length) return;

            $input.wrap($('<div>', { class: 'relative' }));
            $input.addClass('pr-9');

            const $btn = $('<button>', {
                type: 'button',
                id: id + '_eye',
                class: 'absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-gray-600'
            }).append($('<i>', { 'data-lucide': 'eye', class: 'w-4 h-4' }));

            $btn.on('click', () => this.togglePasswordVisibility(id));

            $input.after($btn);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    togglePasswordVisibility(id) {
        const $input = $('#' + id);
        const show = $input.attr('type') === 'password';
        $input.attr('type', show ? 'text' : 'password');

        $('#' + id + '_eye').empty().append($('<i>', {
            'data-lucide': show ? 'eye-off' : 'eye',
            class: 'w-4 h-4'
        }));
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    jsonUser(isEdit) {
        const fields = [
            {
                opc: 'input',
                id: 'name',
                lbl: 'Nombre(s)',
                class: 'col-12 col-md-6 mb-3',
                required: true
            },
            {
                opc: 'input',
                id: 'last_name',
                lbl: 'Apellidos',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'email',
                lbl: 'Correo (con el que inicia sesión)',
                type: 'email',
                class: 'col-12 mb-3',
                required: true
            },
            {
                opc: 'select',
                id: 'role_id',
                lbl: 'Rol',
                class: 'col-12 mb-3',
                required: true,
                selected: 'Elige un rol',
                data: dataInit.roles || []
            },
            {
                opc: 'select',
                id: 'branch_ids',
                lbl: 'Sucursales asignadas',
                class: 'col-12 mb-3',
                data: dataInit.branches || []
            },
            {
                opc: 'input',
                id: 'color',
                type: 'hidden',
                lbl: '',
                class: 'col-12',
                required: false
            }
        ];

        if (isEdit) {
            fields.push(
                {
                    opc: 'input',
                    id: 'password',
                    lbl: 'Nueva contraseña (vacío = no se modifica)',
                    type: 'password',
                    class: 'col-12 mb-3',
                    required: false
                },
                {
                    opc: 'input',
                    id: 'password_confirmation',
                    lbl: 'Confirmar nueva contraseña',
                    type: 'password',
                    class: 'col-12 mb-3',
                    required: false
                }
            );
        } else {
            fields.push(
                {
                    opc: 'input',
                    id: 'password',
                    lbl: 'Contraseña',
                    type: 'password',
                    class: 'col-12 mb-3',
                    required: true
                },
                {
                    opc: 'input',
                    id: 'password_confirmation',
                    lbl: 'Confirmar contraseña',
                    type: 'password',
                    class: 'col-12 mb-3',
                    required: true
                }
            );
        }

        return fields;
    }
}
