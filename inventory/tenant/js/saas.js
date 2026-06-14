// Dominio SaaS: Empresas, Planes, Suscripciones, Pagos, Cupones, Canjes.

/* ===== Empresas ===== */

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

/* ===== Planes ===== */

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

/* ===== Suscripciones ===== */

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

/* ===== Pagos ===== */

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

/* ===== Cupones ===== */

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

/* ===== Canjes ===== */

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
