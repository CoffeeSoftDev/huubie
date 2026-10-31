let api = 'ctrl/ctrl-facturacion.php';
let app, companies, plans, billingModules, subscriptions, payments, coupons, redemptions;
let dataInit = {};

$(async () => {
    dataInit = await useFetch({ url: api, data: { opc: 'init' } }) || {};

    companies = new Companies(api, 'root');
    plans = new Plans(api, 'root');
    billingModules = new BillingModules(api, 'root');
    subscriptions = new Subscriptions(api, 'root');
    payments = new Payments(api, 'root');
    coupons = new Coupons(api, 'root');
    redemptions = new Redemptions(api, 'root');

    app = new App(api, 'root');
    app.render();
});

// Los selects de los modales (empresas, planes, módulos) salen de dataInit: tras
// dar de alta o cambiar algo de ellos se vuelve a pedir para que aparezca.
async function refreshInit() {
    const fresh = await useFetch({ url: api, data: { opc: 'init' } });
    if (fresh && fresh.status === 200) dataInit = fresh;
}

// -- App --

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Facturacion';
    }

    render() {
        this.layout();
        this.headerBar({ parent: `header${this.PROJECT_NAME}` });
        this.renderTabs();
        this.renderActiveTab();
    }

    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id: this.PROJECT_NAME,
                class: 'flex flex-col mx-2 flex-1',
                container: [
                    { type: 'div', id: `header${this.PROJECT_NAME}`, class: 'w-full' },
                    { type: 'div', id: `container${this.PROJECT_NAME}`, class: 'w-full rounded p-2 flex-1 min-h-0 flex flex-col' }
                ]
            }
        });
    }

    headerBar(options) {
        $(`#${options.parent}`).empty().append(
            $('<div>', { class: 'flex items-center gap-3 px-2 pt-2 pb-2' }).append(
                $('<div>', { class: 'flex items-center justify-center w-11 h-11 rounded-xl bg-blue-50 text-blue-600' })
                    .append($('<i>', { 'data-lucide': 'credit-card', class: 'w-6 h-6' })),
                $('<div>').append(
                    $('<h2>', { class: 'text-2xl font-semibold tracking-tight', text: 'Facturación' }),
                    $('<p>', { class: 'text-sm text-gray-400', text: 'Empresas, planes, cobros y promociones' })
                )
            )
        );
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    renderTabs() {
        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: 'light',
            type: 'button',
            content: { class: 'flex-1 min-h-0 flex flex-col' },
            json: [
                {
                    id: 'empresas',
                    tab: 'Empresas',
                    lucideIcon: 'building-2',
                    class: 'p-3 flex-1 min-h-0 flex flex-col',
                    active: true,
                    onClick: () => companies.render()
                },
                {
                    id: 'planes',
                    tab: 'Planes',
                    lucideIcon: 'layers',
                    class: 'p-3 flex-1 min-h-0 flex flex-col',
                    onClick: () => { plans.render(); plans.lsPlans(); }
                },
                {
                    id: 'modulos',
                    tab: 'Módulos',
                    lucideIcon: 'layout-grid',
                    class: 'p-3 flex-1 min-h-0 flex flex-col',
                    onClick: () => billingModules.render()
                },
                {
                    id: 'suscripciones',
                    tab: 'Suscripciones',
                    lucideIcon: 'receipt',
                    class: 'p-3 flex-1 min-h-0 flex flex-col',
                    onClick: () => { subscriptions.render(); subscriptions.lsSubscriptions(); }
                },
                {
                    id: 'pagos',
                    tab: 'Pagos',
                    lucideIcon: 'dollar-sign',
                    class: 'p-3 flex-1 min-h-0 flex flex-col',
                    onClick: () => payments.render()
                },
                {
                    id: 'cupones',
                    tab: 'Cupones',
                    lucideIcon: 'tag',
                    class: 'p-3 flex-1 min-h-0 flex flex-col',
                    onClick: () => { coupons.render(); coupons.lsCoupons(); }
                },
                {
                    id: 'canjes',
                    tab: 'Canjes',
                    lucideIcon: 'gift',
                    class: 'p-3 flex-1 min-h-0 flex flex-col',
                    onClick: () => { redemptions.render(); redemptions.lsRedemptions(); }
                }
            ]
        });
    }

    renderActiveTab() {
        companies.render();
    }
}

// -- Paneles de cobranza --
// Empresas (la cartera de clientes y el detalle de cada una), Pagos y Módulos
// comparten estos catálogos de estados y las piezas de BillingPanel.

const AVATAR_TONES = [
    'bg-blue-600/15 text-blue-600',
    'bg-[#059669]/15 text-[#059669]',
    'bg-[#2563EB]/15 text-[#2563EB]',
    'bg-[#D97706]/15 text-[#D97706]',
    'bg-[#7C3AED]/15 text-[#7C3AED]',
    'bg-[#0891B2]/15 text-[#0891B2]'
];

// Contornos con ring y no con border: Bootstrap marca .border con !important.
const PANEL_TONES = {
    ok: 'bg-emerald-50 text-emerald-700',
    warn: 'bg-amber-50 text-amber-700',
    bad: 'bg-red-50 text-red-600',
    info: 'bg-sky-50 text-sky-700',
    neutral: 'bg-gray-100 text-gray-600',
    pri: 'bg-blue-600/10 text-blue-700'
};

const SUBSCRIPTION_STATUS = {
    trial: { label: 'En prueba', tone: 'info' },
    active: { label: 'Activa', tone: 'ok' },
    past_due: { label: 'Pago vencido', tone: 'bad' },
    cancelled: { label: 'Cancelada', tone: 'neutral' },
    expired: { label: 'Expirada', tone: 'bad' }
};

// event: cómo se lee el pago en la actividad de la empresa.
const PAYMENT_STATUS = {
    paid: { label: 'Pagado', tone: 'ok', event: 'Pago recibido' },
    pending: { label: 'Pendiente', tone: 'warn', event: 'Pago pendiente' },
    failed: { label: 'Fallido', tone: 'bad', event: 'Pago fallido' },
    refunded: { label: 'Reembolsado', tone: 'neutral', event: 'Pago reembolsado' }
};

const USER_STATUS = {
    active: { label: 'Activo', tone: 'ok' },
    inactive: { label: 'Inactivo', tone: 'neutral' },
    pending: { label: 'Pendiente', tone: 'warn' }
};

// Piezas de interfaz y formatos que comparten los paneles de Empresas, Pagos y Módulos.
class BillingPanel extends Templates {

    // -- Complements --

    money(value, currency = 'MXN') {
        const n = Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        return `$${n}${currency && currency !== 'MXN' ? ` ${currency}` : ''}`;
    }

    date(iso) {
        if (!iso) return '—';
        const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
        if (isNaN(d)) return iso;
        return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    daysText(days) {
        if (days === null || days === undefined) return '';
        if (days < 0) return `venció hace ${-days} ${days === -1 ? 'día' : 'días'}`;
        if (days === 0) return 'vence hoy';
        return `en ${days} ${days === 1 ? 'día' : 'días'}`;
    }

    cycleText(plan) {
        return { monthly: 'al mes', yearly: 'al año', lifetime: 'pago único' }[plan.cycle] || '';
    }

    // Debajo del ingreso mensual: si no es mensual, lo que paga de verdad.
    priceText(plan) {
        if (!plan) return '—';
        return plan.cycle === 'monthly' ? 'al mes' : `${this.money(plan.price, plan.currency)} ${this.cycleText(plan)}`;
    }

    // "2 de 3 activas", o "2 activas · sin tope" cuando no hay plan que limite.
    ofLimit(value, max, noun) {
        if (max !== null && max !== undefined) return `${value} de ${max} ${noun}`;
        return `${value} ${value === 1 ? noun.replace(/s$/, '') : noun} · sin tope`;
    }

    companiesText(n) {
        return `${n} ${n === 1 ? 'empresa' : 'empresas'}`;
    }

    limitText(max) {
        return max === null || max === undefined ? 'sin tope' : max;
    }

    normalize(text) {
        return (text || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }

    icons() {
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // -- Piezas de la interfaz --

    card(extra = '') {
        return $('<div>', { class: `bg-white ring-1 ring-inset ring-gray-200 rounded-xl shadow-sm overflow-hidden ${extra}` });
    }

    cardHead(title, side) {
        return $('<div>', { class: 'flex items-center gap-2 flex-wrap px-4 py-3 border-b border-gray-100' }).append(
            $('<h3>', { class: 'text-base font-bold text-gray-900 mb-0', text: title }),
            ...side.filter(Boolean)
        );
    }

    pageHead(title, text) {
        return $('<div>').append(
            $('<h2>', { class: 'text-xl font-bold text-gray-900 mb-0', text: title }),
            $('<p>', { class: 'text-sm text-gray-500 mb-0', text: text })
        );
    }

    kpis(items) {
        const glow = { ok: 'bg-emerald-500/10', warn: 'bg-amber-500/10', bad: 'bg-red-500/10' };
        const grid = $('<div>', { class: 'grid grid-cols-2 xl:grid-cols-4 gap-3' });
        items.forEach((k) => grid.append(
            this.card('relative p-4').append(
                $('<span>', { class: `absolute -right-5 -bottom-8 w-24 h-24 rounded-full ${glow[k.tone] || 'bg-blue-600/10'}` }),
                $('<p>', { class: 'relative text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1', text: k.label }),
                $('<p>', { class: 'relative text-xl sm:text-2xl font-extrabold text-gray-900 truncate mb-0', text: k.value }),
                $('<p>', { class: 'relative text-xs text-gray-500 mb-0', text: k.sub })
            )
        ));
        return grid;
    }

    segmented(items, active, onPick) {
        const box = $('<div>', { class: 'inline-flex flex-wrap gap-0.5 p-1 rounded-xl bg-white ring-1 ring-inset ring-gray-200' });
        items.forEach((it) => {
            const on = it.key === active;
            box.append($('<button>', {
                type: 'button',
                class: 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition '
                    + (on ? 'bg-blue-600/10 text-blue-700' : 'text-gray-500 hover:text-gray-800')
            }).append(
                it.icon ? $('<i>', { 'data-lucide': it.icon, class: 'w-3.5 h-3.5' }) : null,
                $('<span>', { text: it.label }),
                it.count !== undefined ? $('<span>', { class: 'text-[10.5px] px-1.5 rounded-full bg-gray-100 text-gray-500', text: it.count }) : null
            ).on('click', () => onPick(it.key)));
        });
        return box;
    }

    select(options, value, onChange) {
        const $s = $('<select>', { class: 'rounded-lg ring-1 ring-inset ring-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600/30 cursor-pointer' });
        options.forEach((o) => $s.append($('<option>', { value: o.id, text: o.valor, selected: String(o.id) === String(value) })));
        return $s.on('change', () => onChange($s.val()));
    }

    searchInput(placeholder, value, onInput) {
        return $('<div>', { class: 'relative w-full sm:w-64' }).append(
            $('<i>', { 'data-lucide': 'search', class: 'w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2' }),
            $('<input>', {
                type: 'search',
                value: value,
                placeholder: placeholder,
                class: 'w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg ring-1 ring-inset ring-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30'
            }).on('input', (e) => onInput(e.currentTarget.value || ''))
        );
    }

    // headers: textos; right: índices de columnas alineadas a la derecha.
    table(headers, body, right = []) {
        const head = $('<tr>');
        headers.forEach((h, i) => head.append($('<th>', {
            class: 'px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 whitespace-nowrap ' + (right.includes(i) ? 'text-right' : 'text-left'),
            text: h
        })));
        return $('<div>', { class: 'overflow-x-auto' }).append(
            $('<table>', { class: 'w-full min-w-[720px]' }).append($('<thead>').append(head), body)
        );
    }

    chip(text, tone = 'neutral', dot = false) {
        return $('<span>', { class: `inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold ${PANEL_TONES[tone] || PANEL_TONES.neutral}` }).append(
            dot ? $('<span>', { class: 'w-1.5 h-1.5 rounded-full bg-current' }) : null,
            $('<span>', { text: text })
        );
    }

    // Barra de consumo: verde, ámbar desde 75 % y roja al llegar al tope. Sin tope, gris.
    bar(value, max, color = null) {
        const limited = max !== null && max !== undefined && max > 0;
        const pct = limited ? Math.min(100, Math.round(value / max * 100)) : 0;
        const tone = color || (!limited ? 'bg-gray-300' : (pct >= 100 ? 'bg-red-500' : (pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500')));
        return $('<div>', { class: 'h-1.5 rounded-full bg-gray-100 overflow-hidden min-w-[80px]' }).append(
            $('<div>', { class: `h-full rounded-full ${tone}`, css: { width: limited ? `${pct}%` : (value ? '100%' : '0%') } })
        );
    }

    // color: fijo cuando la barra no es un tope que se llena (adopción de un módulo).
    usageRow(label, value, max, color = null) {
        return $('<div>', { class: 'flex items-center gap-2.5' }).append(
            $('<span>', { class: 'w-32 shrink-0 text-xs text-gray-500', text: label }),
            $('<div>', { class: 'flex-1' }).append(this.bar(value, max, color)),
            $('<span>', { class: 'w-16 shrink-0 text-right text-xs font-semibold text-gray-700', text: `${value} / ${this.limitText(max)}` })
        );
    }

    stat(label, value, sub = '') {
        return $('<div>', { class: 'flex flex-col' }).append(
            this.statLabel(label),
            $('<span>', { class: 'text-[15px] font-bold text-gray-900', text: value }),
            sub ? $('<span>', { class: 'text-xs text-gray-500', text: sub }) : null
        );
    }

    statLabel(text) {
        return $('<span>', { class: 'block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1', text: text });
    }

    metaItem(icon, text) {
        return $('<span>', { class: 'inline-flex items-center gap-1' }).append(
            $('<i>', { 'data-lucide': icon, class: 'w-3.5 h-3.5 shrink-0' }),
            $('<span>', { text: text })
        );
    }

    nameCell(name, seed, sub) {
        return $('<div>', { class: 'flex items-center gap-3 min-w-0' }).append(
            this.avatar(name, seed, 'w-9 h-9 rounded-xl text-xs'),
            $('<div>', { class: 'min-w-0' }).append(
                $('<p>', { class: 'text-sm font-semibold text-gray-900 truncate mb-0', text: name }),
                $('<p>', { class: 'text-[11px] text-gray-400 truncate mb-0', text: sub })
            )
        );
    }

    // title con .attr(): como prop de $('<el>', {...}) jQuery llama a $.fn.title
    // (complementos.js), que lo vuelve popover y queda huérfano al re-pintar.
    iconButton(icon, label, onClick, hover = 'hover:text-blue-600') {
        return $('<button>', {
            type: 'button',
            'aria-label': label,
            class: `w-8 h-8 inline-flex items-center justify-center rounded-lg text-gray-400 ${hover} hover:bg-gray-100 transition`
        }).attr('title', label).append($('<i>', { 'data-lucide': icon, class: 'w-4 h-4' })).on('click', (e) => {
            e.stopPropagation();
            onClick();
        });
    }

    // Iniciales de las palabras que empiezan con letra: "Reginas - Pastelería" -> "RP".
    // color: el del colaborador (users.color), si lo tiene.
    avatar(name, seed, size, color = '') {
        const words = String(name || '').trim().split(/\s+/).filter(w => /\p{L}/u.test(w.charAt(0)));
        const text = words.slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?';
        const sum = String(seed).split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
        const custom = /^#[0-9A-Fa-f]{6}$/.test(color || '');

        return $('<span>', {
            class: `inline-flex items-center justify-center font-bold shrink-0 select-none ${custom ? 'text-white' : AVATAR_TONES[sum % AVATAR_TONES.length]} ${size}`,
            css: custom ? { backgroundColor: color } : {},
            text: text
        });
    }

    emptyState(icon, title, text) {
        return $('<div>', { class: 'flex flex-col items-center justify-center text-center gap-1.5 py-12 px-6' }).append(
            $('<i>', { 'data-lucide': icon, class: 'w-8 h-8 text-gray-300 mb-1' }),
            $('<p>', { class: 'text-sm font-semibold text-gray-600 mb-0', text: title }),
            $('<p>', { class: 'text-xs text-gray-400 mb-0 max-w-sm', text: text })
        );
    }

    loading() {
        return $('<div>', { class: 'flex items-center justify-center py-16 text-sm text-gray-400', text: 'Cargando…' });
    }

    // Si una carga falla, no se queda el «Cargando…» para siempre.
    failed(request) {
        notify(request);
        this.body().empty().append(this.card().append(
            this.emptyState('triangle-alert', 'No se pudo cargar', (request && request.message) || 'Vuelve a intentarlo en un momento.')
        ));
        this.icons();
    }

    /*  Tabla de pagos de Pagos y del detalle de una empresa. withCompany: columna
        con la empresa, que abre su detalle. onSaved: cómo refrescarse después de
        editar un pago o cambiar su estado desde su fila. */
    paymentsTable(list, withCompany, onSaved) {
        const body = $('<tbody>');
        list.forEach((p) => {
            const st = PAYMENT_STATUS[p.status] || { label: p.status, tone: 'neutral' };
            const company = withCompany
                ? $('<td>', { class: 'px-4 py-3' }).append(
                    $('<button>', { type: 'button', class: 'text-sm font-semibold text-blue-600 hover:underline text-left', text: p.company || `#${p.company_id}` })
                        .on('click', () => companies.show(p.company_id))
                )
                : null;

            body.append($('<tr>', { class: 'border-b border-gray-100 last:border-0 hover:bg-gray-50' }).append(
                $('<td>', { class: 'px-4 py-3 font-mono text-xs text-gray-600', text: p.reference || `#${p.id}` }),
                company,
                $('<td>', { class: 'px-4 py-3 text-sm text-gray-600', text: p.plan || '—' }),
                $('<td>', { class: 'px-4 py-3 text-sm text-gray-600', text: p.gateway || '—' }),
                $('<td>', { class: 'px-4 py-3 text-sm font-semibold text-gray-800 text-right whitespace-nowrap', text: this.money(p.amount, p.currency) }),
                $('<td>', { class: 'px-4 py-3 text-sm text-gray-600 whitespace-nowrap', text: this.date(p.date) }),
                $('<td>', { class: 'px-4 py-3' }).append(this.chip(st.label, st.tone, true)),
                $('<td>', { class: 'px-4 py-3' }).append($('<div>', { class: 'flex items-center justify-end gap-1' }).append(
                    p.invoice
                        ? $('<a>', { href: p.invoice, target: '_blank', rel: 'noopener', class: 'w-8 h-8 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-gray-100', 'aria-label': 'Ver factura' })
                            .attr('title', 'Ver factura').append($('<i>', { 'data-lucide': 'file-text', class: 'w-4 h-4' }))
                        : null,
                    this.iconButton('pencil', 'Editar pago', () => payments.editPayment(p.id, onSaved)),
                    this.iconButton('refresh-cw', 'Cambiar estado', () => payments.changeStatus(p.id, p.status, onSaved))
                ))
            ));
        });

        const head = ['Referencia'].concat(withCompany ? ['Empresa'] : []).concat(['Plan', 'Método', 'Monto', 'Fecha', 'Estado', '']);
        return this.table(head, body, [withCompany ? 4 : 3]);
    }
}

// -- Empresas --

class Companies extends BillingPanel {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Companies';
        this.list = [];
        this.plans = [];
        this.companyId = 0;
        this.detail = null;
        this.tab = 'resumen';
        this.filters = { q: '', state: 'todas', plan: 'todos', order: 'nombre' };
        this.branchFilter = 'todas';
        this.userFilter = { scope: 'todas', q: '' };
    }

    // -- Interface --

    render() {
        this.layout();
        this.open();
    }

    layout() {
        this.createLayout({
            parent: 'container-empresas',
            design: false,
            data: {
                id: 'companiesPanel',
                class: 'flex flex-col gap-3',
                container: [
                    { type: 'div', id: 'companiesBody', class: 'w-full flex flex-col gap-4' }
                ]
            }
        });
    }

    open() {
        return this.companyId ? this.loadDetail() : this.loadList();
    }

    body() {
        return $('#companiesBody');
    }

    // Abre el detalle de una empresa desde otra pestaña (la fila de un pago).
    show(id) {
        this.companyId = Number(id);
        this.tab = 'resumen';
        $('#tab-empresas').trigger('click');
    }

    // Tras guardar algo: el detalle abierto o el listado.
    refresh() {
        this.list = [];
        this.open();
    }

    // -- Vista: listado de empresas --

    async loadList() {
        this.body().html(this.loading());
        const request = await useFetch({ url: this._link, data: { opc: 'lsCompanyPanel' } });
        if (!request || request.status !== 200) {
            this.failed(request);
            return;
        }

        this.list = request.companies || [];
        this.plans = request.plans || [];
        this.renderList();
    }

    renderList() {
        const list = this.list;
        const sum = (fn) => list.reduce((s, c) => s + fn(c), 0);
        const groups = [
            { key: 'todas', label: 'Todas' },
            { key: 'activa', label: 'Activas' },
            { key: 'por_vencer', label: 'Por vencer' },
            { key: 'vencida', label: 'Vencidas' },
            { key: 'sin_plan', label: 'Sin plan' }
        ].map((g) => Object.assign(g, {
            count: g.key === 'todas' ? list.length : list.filter(c => this.stateGroup(c) === g.key).length
        }));

        const search = this.searchInput('Buscar empresa, RFC, ubicación o dueño…', this.filters.q, (value) => {
            this.filters.q = value;
            this.renderRows();
        });

        const plan = this.select(
            [{ id: 'todos', valor: 'Todos los planes' }].concat(this.plans),
            this.filters.plan,
            (value) => { this.filters.plan = value; this.renderRows(); }
        );

        const order = this.select([
            { id: 'nombre', valor: 'Ordenar: nombre' },
            { id: 'mensual', valor: 'Ordenar: mayor ingreso' },
            { id: 'vence', valor: 'Ordenar: vence antes' },
            { id: 'sucursales', valor: 'Ordenar: más sucursales' }
        ], this.filters.order, (value) => { this.filters.order = value; this.renderRows(); });

        this.body().empty().append(
            $('<div>', { class: 'flex items-start justify-between gap-3 flex-wrap' }).append(
                this.pageHead('Empresas cliente', 'Cada empresa que usa el sistema: su plan, lo que consume y cómo va su cobranza.'),
                actionButton('plus', 'Nueva empresa', () => this.addCompany(), true)
            ),
            this.kpis([
                { label: 'Empresas cliente', value: list.length, sub: `${list.filter(c => ['activa', 'por_vencer'].includes(c.state.key)).length} con plan vigente` },
                { label: 'Ingreso mensual', value: this.money(sum(c => c.monthly)), sub: 'de suscripciones activas', tone: 'ok' },
                { label: 'Sucursales', value: sum(c => c.branches), sub: `${sum(c => c.branches_active)} activas` },
                { label: 'Usuarios', value: sum(c => c.users), sub: `${sum(c => c.users_active)} activos` }
            ]),
            $('<div>', { class: 'flex items-center gap-2 flex-wrap' }).append(
                this.segmented(groups, this.filters.state, (key) => {
                    this.filters.state = key;
                    this.renderList();
                }),
                $('<div>', { class: 'flex-1' }),
                search, plan, order
            ),
            $('<div>', { id: 'companyRows' })
        );

        this.renderRows();
    }

    renderRows() {
        const rows = this.filteredList();
        const $box = $('#companyRows').empty();

        if (!rows.length) {
            $box.append(this.card().append(this.emptyState('building-2', this.list.length ? 'Sin empresas con ese filtro' : 'Todavía no hay empresas', this.list.length ? 'Cambia el estado, el plan o la búsqueda.' : 'Agrega la primera con «Nueva empresa».')));
            this.icons();
            return;
        }

        const body = $('<tbody>');
        rows.forEach((c) => {
            const plan = c.plan;
            const closed = this.closed(c.subscription);
            // Los topes solo aplican mientras el plan sigue contratado.
            const live = plan && !closed ? plan : null;
            const tr = $('<tr>', { class: 'border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition' }).append(
                $('<td>', { class: 'px-4 py-3' }).append(this.nameCell(c.name, c.id, [c.rfc, c.ubication].filter(Boolean).join(' · ') || 'Sin RFC ni ubicación')),
                $('<td>', { class: 'px-4 py-3' }).append(plan
                    ? (closed ? this.chip(plan.name, 'neutral').attr('title', 'Último plan que tuvo') : this.chip(plan.name, 'pri'))
                    : $('<span>', { class: 'text-xs italic text-gray-400', text: 'Sin plan' })),
                $('<td>', { class: 'px-4 py-3 min-w-[140px]' }).append(
                    $('<p>', { class: 'text-sm font-semibold text-gray-800 mb-0', text: `${c.branches_active} / ${this.limitText(live && live.max_branches)}` }),
                    $('<p>', { class: 'text-[11px] text-gray-400 mb-1', text: `${c.branches} en total` }),
                    this.bar(c.branches_active, live && live.max_branches)
                ),
                $('<td>', { class: 'px-4 py-3' }).append(
                    $('<span>', { class: 'text-sm font-semibold text-gray-800', text: c.users_active }),
                    $('<span>', { class: 'text-xs text-gray-400', text: ` / ${this.limitText(live && live.max_users)}` })
                ),
                $('<td>', { class: 'px-4 py-3' }).append(
                    $('<p>', { class: 'text-sm font-semibold text-gray-800 mb-0', text: this.money(c.monthly) }),
                    $('<p>', { class: 'text-[11px] text-gray-400 mb-0', text: this.priceText(live) })
                ),
                $('<td>', { class: 'px-4 py-3' }).append(this.chip(c.state.label, c.state.tone, true)),
                $('<td>', { class: 'px-4 py-3 whitespace-nowrap' }).append(
                    $('<p>', { class: 'text-sm text-gray-800 mb-0', text: this.date(this.endOf(c.subscription)) }),
                    $('<p>', { class: 'text-[11px] text-gray-400 mb-0', text: this.daysText(c.state.days) })
                ),
                $('<td>', { class: 'px-4 py-3 text-right text-gray-300' }).append($('<i>', { 'data-lucide': 'chevron-right', class: 'w-4 h-4 inline-block' }))
            ).on('click', () => this.openCompany(c.id));
            body.append(tr);
        });

        $box.append(this.card().append(this.table(['Empresa', 'Plan', 'Sucursales activas', 'Usuarios activos', 'Mensual', 'Estado', 'Vence', ''], body)));
        this.icons();
    }

    // -- Vista: detalle de una empresa --

    openCompany(id) {
        this.companyId = Number(id);
        this.branchFilter = 'todas';
        this.userFilter = { scope: 'todas', q: '' };
        this.loadDetail();
    }

    backToList() {
        this.companyId = 0;
        this.detail = null;
        this.loadList();
    }

    async loadDetail() {
        if (!this.detail || this.detail.company.id !== this.companyId) this.body().html(this.loading());

        // El selector de empresa del detalle sale del listado: si se llegó desde
        // la pestaña Pagos todavía no se había cargado.
        const requests = [useFetch({ url: this._link, data: { opc: 'getCompanyPanel', id: this.companyId } })];
        if (!this.list.length) requests.push(useFetch({ url: this._link, data: { opc: 'lsCompanyPanel' } }));
        const [request, listRequest] = await Promise.all(requests);

        if (listRequest && listRequest.status === 200) {
            this.list = listRequest.companies || [];
            this.plans = listRequest.plans || [];
        }
        if (!request || request.status !== 200) {
            this.failed(request);
            return;
        }

        this.detail = request;
        this.renderDetail();
    }

    // Tras guardar algo de la empresa: se recarga su detalle y el listado se
    // vuelve a pedir al regresar.
    reload() {
        this.list = [];
        this.loadDetail();
    }

    renderDetail() {
        const d = this.detail;
        const c = d.company;

        const switcher = $('<select>', { class: 'w-full', 'aria-label': 'Cambiar de empresa' });
        this.list.forEach((x) => switcher.append($('<option>', { value: x.id, text: x.name, selected: x.id === c.id })));

        const top = $('<div>', { class: 'flex items-center gap-3 flex-wrap' }).append(
            $('<button>', { type: 'button', class: 'inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700' })
                .append($('<i>', { 'data-lucide': 'arrow-left', class: 'w-4 h-4' }), $('<span>', { text: 'Empresas' }))
                .on('click', () => this.backToList()),
            $('<div>', { class: 'flex-1' }),
            $('<div>', { class: 'w-full sm:w-72' }).append(switcher)
        );

        const hero = this.card('p-4 sm:p-5').append(
            $('<div>', { class: 'flex items-center gap-4 flex-wrap' }).append(
                this.avatar(c.name, c.id, 'w-14 h-14 rounded-2xl text-lg'),
                $('<div>', { class: 'min-w-[200px] flex-1' }).append(
                    $('<h2>', { class: 'text-xl font-bold text-gray-900 mb-1', text: c.name }),
                    $('<div>', { class: 'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500' }).append(
                        c.rfc ? $('<span>', { class: 'font-mono', text: c.rfc }) : null,
                        c.ubication ? this.metaItem('map-pin', c.ubication) : null,
                        this.metaItem('calendar', `Cliente desde ${this.date(this.clientSince())}`),
                        c.database ? this.metaItem('database', c.database) : null
                    )
                ),
                $('<div>', { class: 'flex items-center gap-2 flex-wrap' }).append(
                    this.chip(c.state.label, c.state.tone, true),
                    actionButton('pencil', 'Editar', () => this.editCompany(c.id)),
                    actionButton('refresh-cw', 'Estado', () => this.changeStatus(c.id, c.status)),
                    actionButton('palette', 'Temas', () => this.editCompanyThemes(c.id))
                )
            )
        );

        const tabs = [
            ['resumen', 'Resumen'],
            ['sucursales', 'Sucursales', d.branches.length],
            ['usuarios', 'Usuarios', d.users.length],
            ['modulos', 'Módulos', d.modules.filter(m => m.in_plan).length],
            ['pagos', 'Pagos', d.payments.length],
            ['historial', 'Historial', d.subscriptions.length]
        ];

        // La línea de abajo va como sombra interior: con un borde y -mb-px el
        // overflow-x-auto sacaba una barra de scroll vertical de 1px.
        const tabBar = $('<div>', { class: 'flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_#E5E7EB]' });
        tabs.forEach(([key, label, count]) => {
            const on = this.tab === key;
            tabBar.append($('<button>', {
                type: 'button',
                class: 'shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold border-b-2 transition '
                    + (on ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800')
            }).append(
                $('<span>', { text: label }),
                count !== undefined ? $('<span>', { class: 'text-[10.5px] px-1.5 rounded-full bg-gray-100 text-gray-500', text: count }) : null
            ).on('click', () => {
                this.tab = key;
                this.renderDetail();
            }));
        });

        this.body().empty().append(
            top,
            hero,
            $('<div>', { class: 'grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4' }).append(this.planCard(), this.clientCard()),
            tabBar,
            $('<div>', { id: 'companyTab' })
        );

        if ($.fn.select2) {
            switcher.select2({ theme: 'bootstrap-5', width: '100%' });
        }
        switcher.on('change', () => {
            const id = Number(switcher.val());
            if (id && id !== this.companyId) this.openCompany(id);
        });

        this.renderTab();
    }

    planCard() {
        const d = this.detail;
        const c = d.company;
        const plan = c.plan;
        const sub = c.subscription;

        // El plan se asigna o se cambia con el modal de Suscripciones, ya con la empresa.
        const assign = () => subscriptions.addSubscription(c.id, () => this.reload());

        if (!plan) {
            return this.card('p-4 sm:p-5').append(
                $('<h3>', { class: 'text-base font-bold text-gray-900 mb-1', text: 'Sin plan vigente' }),
                $('<p>', { class: 'text-sm text-gray-500 mb-3', text: 'Esta empresa no tiene una suscripción. Asígnale un plan para ver sus límites y su vigencia.' }),
                actionButton('plus', 'Asignar plan', assign, true)
            );
        }

        const modulesInPlan = d.modules.filter(m => m.in_plan).length;
        const end = this.endOf(sub);

        return this.card('p-4 sm:p-5').append(
            $('<div>', { class: 'flex items-center gap-2 flex-wrap mb-3' }).append(
                $('<h3>', { class: 'text-base font-bold text-gray-900 mb-0 mr-auto', text: this.closed(sub) ? `Último plan: ${plan.name}` : `Plan ${plan.name}` }),
                this.chip(SUBSCRIPTION_STATUS[sub.status] ? SUBSCRIPTION_STATUS[sub.status].label : sub.status, SUBSCRIPTION_STATUS[sub.status] ? SUBSCRIPTION_STATUS[sub.status].tone : 'neutral'),
                this.closed(sub)
                    ? actionButton('plus', 'Asignar plan', assign, true)
                    : this.iconButton('pencil', 'Editar suscripción', () => subscriptions.editSubscription(sub.id, () => this.reload()))
            ),
            $('<div>', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-4' }).append(
                $('<div>', { class: 'flex flex-col gap-3' }).append(
                    this.stat('Sucursales contratadas', this.limitText(plan.max_branches)),
                    this.stat('Usuarios incluidos', this.limitText(plan.max_users)),
                    this.stat('Precio', `${this.money(plan.price, plan.currency)} ${this.cycleText(plan)}`)
                ),
                $('<div>', { class: 'flex flex-col gap-3' }).append(
                    this.usageRow('Sucursales activas', c.branches_active, plan.max_branches),
                    this.usageRow('Usuarios activos', c.users_active, plan.max_users),
                    this.usageRow('Módulos incluidos', modulesInPlan, d.modules.filter(m => m.is_active).length)
                )
            ),
            $('<div>', { class: 'h-px bg-gray-100 my-4' }),
            $('<div>', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-4' }).append(
                this.stat('Vigencia', end ? this.date(end) : 'Sin fecha de fin', this.daysText(c.state.days)),
                this.stat('Ingreso mensual de este cliente', this.money(c.monthly, plan.currency), sub.starts ? `Suscrito desde ${this.date(sub.starts)}` : '')
            )
        );
    }

    clientCard() {
        const d = this.detail;
        const owners = d.users.filter(u => u.is_owner);
        const paid = d.payments.filter(p => p.status === 'paid');
        const pending = d.payments.filter(p => p.status === 'pending');

        const ownerList = $('<div>', { class: 'flex flex-col gap-2' });
        if (owners.length) {
            owners.forEach((u) => ownerList.append(
                $('<div>', { class: 'flex items-center gap-2.5 min-w-0' }).append(
                    this.avatar(u.name, u.id, 'w-8 h-8 rounded-lg text-[11px]'),
                    $('<div>', { class: 'min-w-0' }).append(
                        $('<p>', { class: 'text-sm font-semibold text-gray-800 truncate mb-0', text: u.name }),
                        $('<p>', { class: 'text-xs text-gray-400 truncate mb-0', text: u.email || 'Sin correo' })
                    )
                )
            ));
        } else {
            ownerList.append($('<p>', { class: 'text-xs text-gray-400 mb-0', text: 'Nadie marcado como dueño. Márcalo en Accesos › Usuarios: es quien paga la suscripción.' }));
        }

        return this.card('p-4 sm:p-5').append(
            $('<h3>', { class: 'text-base font-bold text-gray-900 mb-3', text: 'Cliente' }),
            this.statLabel('Dueño de la empresa'),
            ownerList,
            $('<div>', { class: 'h-px bg-gray-100 my-4' }),
            $('<div>', { class: 'grid grid-cols-2 gap-4' }).append(
                this.stat('Total pagado', this.money(paid.reduce((s, p) => s + p.amount, 0))),
                this.stat('Pendiente', this.money(pending.reduce((s, p) => s + p.amount, 0)), pending.length ? `${pending.length} por confirmar` : ''),
                this.stat('Último pago', paid.length ? this.date(paid[0].date) : '—'),
                this.stat('Cupones canjeados', d.redemptions.length)
            )
        );
    }

    renderTab() {
        const render = {
            resumen: () => this.tabSummary(),
            sucursales: () => this.tabBranches(),
            usuarios: () => this.tabUsers(),
            modulos: () => this.tabModules(),
            pagos: () => this.tabPayments(),
            historial: () => this.tabHistory()
        };

        $('#companyTab').empty().append((render[this.tab] || render.resumen)());
        if (this.tab === 'usuarios') this.renderUserRows();
        this.icons();
    }

    // -- Pestaña: Resumen --

    tabSummary() {
        const d = this.detail;
        const c = d.company;
        const plan = this.livePlan();
        const events = this.events().slice(0, 10);

        const timeline = $('<div>', { class: 'relative pl-5' });
        if (events.length) {
            timeline.append($('<span>', { class: 'absolute left-[5px] top-1.5 bottom-1.5 w-0.5 rounded bg-gray-200' }));
            events.forEach((ev) => timeline.append(this.timelineItem(ev)));
        } else {
            timeline.append($('<p>', { class: 'text-xs text-gray-400 mb-0', text: 'Sin actividad registrada.' }));
        }

        const branches = $('<div>', { class: 'flex flex-col gap-2.5' });
        d.branches.slice().sort((a, b) => b.users - a.users).slice(0, 5).forEach((b) => branches.append(
            $('<div>', { class: 'flex items-center gap-2.5' }).append(
                this.avatar(b.name, b.id, 'w-8 h-8 rounded-lg text-[11px]'),
                $('<div>', { class: 'min-w-0 flex-1' }).append(
                    $('<p>', { class: 'text-sm font-semibold text-gray-800 truncate mb-0', text: b.name }),
                    $('<p>', { class: 'text-[11px] text-gray-400 mb-0', text: `${b.users} ${b.users === 1 ? 'usuario' : 'usuarios'} con acceso` })
                ),
                this.chip(b.is_active ? 'Activa' : 'Inactiva', b.is_active ? 'ok' : 'neutral')
            )
        ));
        if (!d.branches.length) branches.append($('<p>', { class: 'text-xs text-gray-400 mb-0', text: 'Sin sucursales todavía.' }));

        return $('<div>', { class: 'grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 items-start' }).append(
            this.card('p-4 sm:p-5').append($('<h3>', { class: 'text-base font-bold text-gray-900 mb-3', text: 'Actividad reciente' }), timeline),
            $('<div>', { class: 'flex flex-col gap-4' }).append(
                this.card('p-4 sm:p-5').append(
                    $('<h3>', { class: 'text-base font-bold text-gray-900 mb-3', text: 'Consumo del plan' }),
                    $('<div>', { class: 'flex flex-col gap-3' }).append(
                        this.usageRow('Sucursales activas', c.branches_active, plan && plan.max_branches),
                        this.usageRow('Usuarios activos', c.users_active, plan && plan.max_users),
                        this.usageRow('Módulos en uso', d.modules.filter(m => m.sections > 0).length, d.modules.filter(m => m.is_active).length)
                    )
                ),
                this.card('p-4 sm:p-5').append($('<h3>', { class: 'text-base font-bold text-gray-900 mb-3', text: 'Sucursales con más gente' }), branches)
            )
        );
    }

    // Lo que pasó en la empresa, de lo más nuevo a lo más viejo.
    events() {
        const d = this.detail;
        const events = [];

        if (d.company.created) events.push({ date: d.company.created, tone: 'pri', title: 'Alta de la empresa', text: '' });

        d.subscriptions.forEach((s) => {
            const st = SUBSCRIPTION_STATUS[s.status] || { label: s.status, tone: 'neutral' };
            events.push({
                date: s.starts || s.created,
                tone: st.tone === 'ok' ? 'pri' : st.tone,
                title: `Suscripción al plan ${s.plan}`,
                text: [st.label, s.ends ? `hasta ${this.date(s.ends)}` : ''].filter(Boolean).join(' · ')
            });
        });

        d.payments.forEach((p) => {
            const st = PAYMENT_STATUS[p.status] || { tone: 'neutral', event: `Pago ${p.status}` };
            events.push({ date: p.date, tone: st.tone, title: `${st.event} · ${this.money(p.amount, p.currency)}`, text: [p.plan, p.gateway].filter(Boolean).join(' · ') });
        });

        d.branches.forEach((b) => {
            if (b.created) events.push({ date: b.created, tone: 'neutral', title: `Sucursal «${b.name}» dada de alta`, text: b.ubication });
        });

        d.users.forEach((u) => {
            if (u.last_activity) events.push({ date: u.last_activity.slice(0, 10), tone: 'info', title: `Último acceso de ${u.name}`, text: u.last_activity.slice(11) });
        });

        d.redemptions.forEach((r) => events.push({ date: r.redeemed, tone: 'ok', title: `Canjeó el cupón ${r.code || ''}`, text: r.description || '' }));

        return events.filter(e => e.date).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    }

    timelineItem(ev) {
        const dot = { ok: 'border-emerald-500', warn: 'border-amber-500', bad: 'border-red-500', info: 'border-sky-500', pri: 'border-blue-600', neutral: 'border-gray-400' };
        return $('<div>', { class: 'relative pb-4 last:pb-0 pl-3' }).append(
            $('<span>', { class: `absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-white border-[2.5px] ${dot[ev.tone] || dot.neutral}` }),
            $('<p>', { class: 'text-[11px] text-gray-400 mb-0', text: this.date(ev.date) }),
            $('<p>', { class: 'text-sm font-semibold text-gray-800 mb-0', text: ev.title }),
            ev.text ? $('<p>', { class: 'text-xs text-gray-500 mb-0', text: ev.text }) : null
        );
    }

    // -- Pestaña: Sucursales --

    tabBranches() {
        const d = this.detail;
        const plan = this.livePlan();
        const active = d.branches.filter(b => b.is_active).length;
        const max = plan ? plan.max_branches : null;
        const full = max !== null && active >= max;

        const rows = d.branches.filter((b) => this.branchFilter === 'todas' || (this.branchFilter === 'activas' ? b.is_active : !b.is_active));

        const filter = this.select([
            { id: 'todas', valor: 'Todas' },
            { id: 'activas', valor: 'Activas' },
            { id: 'inactivas', valor: 'Inactivas' }
        ], this.branchFilter, (value) => { this.branchFilter = value; this.renderTab(); });

        const add = actionButton('plus', 'Agregar sucursal', () => this.addBranch(), true, full);
        if (full) add.attr('title', `El plan ${plan.name} permite ${max} sucursales activas`);

        const body = $('<tbody>');
        rows.forEach((b) => body.append($('<tr>', { class: 'border-b border-gray-100 last:border-0 hover:bg-gray-50' }).append(
            $('<td>', { class: 'px-4 py-3' }).append(
                $('<p>', { class: 'text-sm font-semibold text-gray-800 mb-0', text: b.name }),
                $('<p>', { class: 'text-[11px] text-gray-400 mb-0', text: b.ubication || 'Sin ubicación' })
            ),
            $('<td>', { class: 'px-4 py-3 text-sm font-semibold text-gray-800', text: b.users }),
            $('<td>', { class: 'px-4 py-3 text-sm text-gray-600', text: b.home }),
            $('<td>', { class: 'px-4 py-3 text-sm text-gray-600 whitespace-nowrap', text: this.date(b.created) }),
            $('<td>', { class: 'px-4 py-3' }).append(this.chip(b.is_active ? 'Activa' : 'Inactiva', b.is_active ? 'ok' : 'neutral', true)),
            $('<td>', { class: 'px-4 py-3' }).append($('<div>', { class: 'flex justify-end gap-1' }).append(
                this.iconButton('pencil', 'Editar sucursal', () => this.editBranch(b)),
                this.iconButton(b.is_active ? 'ban' : 'circle-check', b.is_active ? 'Desactivar sucursal' : 'Activar sucursal', () => this.toggleBranch(b), b.is_active ? 'hover:text-red-600' : 'hover:text-emerald-600')
            ))
        )));

        return this.card().append(
            this.cardHead('Sucursales', [
                this.chip(this.ofLimit(active, max, 'activas'), max === null ? 'neutral' : (full ? 'bad' : (active / max >= 0.75 ? 'warn' : 'ok'))),
                $('<div>', { class: 'flex-1' }),
                filter,
                add
            ]),
            rows.length
                ? this.table(['Sucursal', 'Con acceso', 'Pertenecen', 'Alta', 'Estado', ''], body)
                : this.emptyState('building-2', 'Sin sucursales en este filtro', d.branches.length ? 'Cambia el filtro.' : 'Agrega la primera con «Agregar sucursal».')
        );
    }

    addBranch() {
        const c = this.detail.company;
        this.createModalForm({
            id: 'formBranchAdd',
            data: { opc: 'addBranch', company_id: c.id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: `Nueva sucursal · <span class="text-blue-600 font-bold">${esc(c.name)}</span>` },
            json: this.jsonBranch(true),
            success: (r) => afterSave(r, () => this.reload())
        });
    }

    editBranch(b) {
        this.createModalForm({
            id: 'formBranchEdit',
            data: { opc: 'editBranch', id: b.id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: `Editar sucursal · <span class="text-blue-600 font-bold">${esc(b.name)}</span>` },
            autofill: { name: b.name, ubication: b.ubication || '' },
            json: this.jsonBranch(false),
            success: (r) => afterSave(r, () => this.reload())
        });
    }

    toggleBranch(b) {
        const active = b.is_active ? 0 : 1;
        let text = `«${b.name}» volverá a aceptar asignaciones.`;
        if (!active) {
            text = b.users
                ? `Sus ${b.users} asignaciones quedan guardadas para cuando la reactives.`
                : `«${b.name}» dejará de aceptar asignaciones.`;
        }

        this.swalQuestion({
            opts: { title: `¿${active ? 'Activar' : 'Desactivar'} sucursal?`, text: text, icon: 'warning' },
            data: { opc: 'toggleBranch', id: b.id, active: active },
            methods: { send: (r) => afterSave(r, () => this.reload()) }
        });
    }

    jsonBranch(isNew) {
        const fields = [
            { opc: 'input', id: 'name', lbl: 'Nombre', placeholder: 'Ej: Reginas Centro', class: 'col-12 mb-3', required: true },
            { opc: 'input', id: 'ubication', lbl: 'Ubicación', placeholder: 'Ej: Av. Central 128', class: 'col-12 mb-3', required: false }
        ];

        if (isNew) {
            const plan = this.livePlan();
            const active = this.detail.branches.filter(b => b.is_active).length;
            fields.push({
                opc: 'p',
                id: 'branchPlanHint',
                class: 'col-12',
                style: 'font-size:12px;color:#6B7280;margin:0',
                text: plan
                    ? `Plan ${plan.name}: ${active} de ${this.limitText(plan.max_branches)} sucursales activas.`
                    : 'Sin plan vigente: no hay tope de sucursales.'
            });
        }

        return fields;
    }

    // -- Pestaña: Usuarios --

    tabUsers() {
        const d = this.detail;
        const plan = this.livePlan();
        const c = d.company;

        const scope = this.select(
            [{ id: 'todas', valor: 'Todas las sucursales' }]
                .concat(d.branches.map(b => ({ id: `b${b.id}`, valor: b.name })))
                .concat([{ id: 'active', valor: 'Solo activos' }, { id: 'inactive', valor: 'Solo inactivos' }, { id: 'owners', valor: 'Solo dueños' }]),
            this.userFilter.scope,
            (value) => { this.userFilter.scope = value; this.renderUserRows(); }
        );

        const search = this.searchInput('Buscar usuario…', this.userFilter.q, (value) => {
            this.userFilter.q = value;
            this.renderUserRows();
        });

        // Usuarios por sucursal: con acceso a cada una.
        const perBranch = $('<div>', { class: 'flex flex-col gap-2.5' });
        const top = Math.max(1, ...d.branches.map(b => b.users));
        d.branches.forEach((b) => perBranch.append(
            $('<div>', { class: 'flex items-center gap-2' }).append(
                $('<span>', { class: 'w-28 shrink-0 text-xs text-gray-600 truncate', text: b.name }),
                $('<div>', { class: 'flex-1' }).append(this.bar(b.users, top, 'bg-blue-600')),
                $('<span>', { class: 'w-6 text-right text-xs font-semibold text-gray-700', text: b.users })
            )
        ));
        if (!d.branches.length) perBranch.append($('<p>', { class: 'text-xs text-gray-400 mb-0', text: 'Sin sucursales.' }));

        // Distribución por rol: una cuenta por asignación (sucursal + rol).
        const roles = {};
        d.users.forEach(u => u.access.forEach((a) => { roles[a.role_name] = (roles[a.role_name] || 0) + 1; }));
        const perRole = $('<div>', { class: 'flex flex-col gap-2' });
        Object.keys(roles).sort((a, b) => roles[b] - roles[a]).forEach((r) => perRole.append(
            $('<div>', { class: 'flex items-center justify-between gap-2' }).append(this.chip(r, 'pri'), $('<b>', { class: 'text-sm text-gray-800', text: roles[r] }))
        ));
        if (!Object.keys(roles).length) perRole.append($('<p>', { class: 'text-xs text-gray-400 mb-0', text: 'Nadie tiene acceso todavía.' }));

        return $('<div>', { class: 'grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 items-start' }).append(
            this.card().append(
                this.cardHead('Usuarios', [
                    this.chip(this.ofLimit(c.users_active, plan && plan.max_users, 'activos'), plan && plan.max_users !== null && c.users_active >= plan.max_users ? 'bad' : 'ok'),
                    $('<div>', { class: 'flex-1' }),
                    scope,
                    search,
                    // Usuarios, roles y accesos se administran en Accesos; aquí solo se consultan.
                    actionButton('external-link', 'Administrar en Accesos', () => { window.location.href = 'accesos.php'; })
                ]),
                $('<div>', { id: 'companyUserRows' })
            ),
            this.card('p-4 sm:p-5').append(
                $('<h3>', { class: 'text-base font-bold text-gray-900 mb-3', text: 'Usuarios por sucursal' }),
                perBranch,
                $('<div>', { class: 'h-px bg-gray-100 my-4' }),
                this.statLabel('Distribución por rol'),
                perRole
            )
        );
    }

    // Se pinta aparte para que escribir en el buscador no lo re-pinte y pierda el foco.
    renderUserRows() {
        const d = this.detail;
        const f = this.userFilter;
        const q = this.normalize(f.q.trim());

        const rows = d.users.filter((u) => {
            if (f.scope.startsWith('b') && !u.access.some(a => `b${a.branch_id}` === f.scope)) return false;
            if (f.scope === 'active' && u.status !== 'active') return false;
            if (f.scope === 'inactive' && u.status === 'active') return false;
            if (f.scope === 'owners' && !u.is_owner) return false;
            return !q || this.normalize(`${u.name} ${u.email}`).includes(q);
        });

        const $box = $('#companyUserRows').empty();
        if (!rows.length) {
            $box.append(this.emptyState('users', 'Sin usuarios', d.users.length ? 'Nadie coincide con el filtro o la búsqueda.' : 'Se dan de alta en Accesos › Usuarios.'));
            this.icons();
            return;
        }

        rows.forEach((u) => {
            const home = d.branches.find(b => b.id === u.branch_id);
            const st = USER_STATUS[u.status] || USER_STATUS.inactive;
            const access = $('<div>', { class: 'flex flex-wrap gap-1' });
            u.access.slice(0, 3).forEach(a => access.append(this.chip(`${a.branch_name} · ${a.role_name}`, 'pri')));
            if (u.access.length > 3) access.append(this.chip(`+${u.access.length - 3}`, 'neutral'));
            if (!u.access.length) access.append(this.chip('Sin acceso', 'warn'));

            // basis-[220px]: en pantallas angostas sucursal y estado bajan juntos
            // a una segunda línea en vez de apretar el nombre.
            $box.append($('<div>', { class: 'flex items-center gap-x-3 gap-y-2 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 flex-wrap' }).append(
                this.avatar(u.name, u.id, 'w-9 h-9 rounded-xl text-xs', u.color),
                $('<div>', { class: 'min-w-0 flex-1 basis-[220px]' }).append(
                    $('<p>', { class: 'flex items-center gap-2 text-sm font-semibold text-gray-800 mb-0' }).append(
                        $('<span>', { class: 'truncate', text: u.name }),
                        u.is_owner ? this.chip('Dueño', 'warn') : null
                    ),
                    $('<p>', { class: 'text-xs text-gray-400 truncate mb-1', text: u.email || 'Sin correo' }),
                    access
                ),
                $('<div>', { class: 'flex items-center gap-3 ml-auto' }).append(
                    $('<div>', { class: 'min-w-[130px]' }).append(
                        $('<p>', { class: 'text-xs font-semibold text-gray-700 truncate mb-0', text: home ? home.name : 'Sin sucursal' }),
                        $('<p>', { class: 'text-[11px] text-gray-400 mb-0', text: u.last_activity ? `Último acceso ${this.date(u.last_activity.slice(0, 10))}` : 'Sin accesos registrados' })
                    ),
                    this.chip(st.label, st.tone, true)
                )
            ));
        });

        this.icons();
    }

    // -- Pestaña: Módulos --

    tabModules() {
        const d = this.detail;
        const plan = this.livePlan();
        const modules = d.modules.filter(m => m.is_active || m.in_plan || m.sections > 0);

        const grid = $('<div>', { class: 'grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3 p-4' });
        modules.forEach((m) => {
            const unpaid = m.sections > 0 && !m.in_plan;
            const chips = $('<div>', { class: 'flex flex-wrap gap-1' }).append(
                this.chip(m.in_plan ? 'Incluido en el plan' : 'Fuera del plan', m.in_plan ? 'pri' : 'neutral'),
                this.chip(m.sections > 0 ? `En uso · ${m.sections} ${m.sections === 1 ? 'sección' : 'secciones'}` : 'Sin uso', m.sections > 0 ? 'ok' : 'neutral')
            );
            if (unpaid) chips.append(this.chip('Usa sin pagar', 'warn'));
            if (!m.is_active) chips.append(this.chip('Módulo apagado', 'neutral'));

            grid.append($('<div>', {
                class: 'flex flex-col gap-2 p-3.5 rounded-xl ring-1 ring-inset transition '
                    + (unpaid ? 'ring-amber-300 bg-amber-50/40' : 'ring-gray-200')
                    + (m.in_plan || m.sections > 0 ? '' : ' opacity-70')
            }).append(
                $('<div>', { class: 'flex items-center gap-2.5' }).append(
                    $('<span>', { class: 'shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-lg bg-blue-600/10 text-blue-600' })
                        .append($('<i>', { 'data-lucide': m.icon, class: 'w-4 h-4' })),
                    $('<p>', { class: 'text-sm font-bold text-gray-800 mb-0', text: m.name })
                ),
                $('<p>', { class: 'text-xs text-gray-500 mb-0 flex-1', text: m.description || 'Sin descripción.' }),
                chips
            ));
        });

        const using = d.modules.filter(m => m.sections > 0);
        const unpaid = using.filter(m => !m.in_plan);
        const idle = d.modules.filter(m => m.in_plan && !m.sections);

        return $('<div>', { class: 'grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 items-start' }).append(
            this.card().append(
                this.cardHead('Módulos', [this.chip(`${d.modules.filter(m => m.in_plan).length} en el plan`, 'pri'), this.chip(`${using.length} en uso`, 'ok')]),
                modules.length ? grid : this.emptyState('layout-grid', 'Sin módulos', 'Se crean en Accesos › Módulos.')
            ),
            this.card('p-4 sm:p-5').append(
                $('<h3>', { class: 'text-base font-bold text-gray-900 mb-3', text: 'Licenciamiento' }),
                $('<div>', { class: 'flex flex-col gap-3' }).append(
                    this.stat('Plan', plan ? plan.name : 'Sin plan'),
                    this.stat('Ingreso mensual', this.money(d.company.monthly, plan ? plan.currency : 'MXN')),
                    this.stat('Usa sin pagar', unpaid.length ? unpaid.map(m => m.name).join(', ') : 'Ninguno', unpaid.length ? 'Sus roles abren módulos que su plan no incluye.' : ''),
                    this.stat('Paga sin usar', idle.length ? idle.map(m => m.name).join(', ') : 'Ninguno')
                ),
                $('<p>', { class: 'text-[11px] text-gray-400 mt-4 mb-0', text: '«Incluido en el plan» sale de los módulos de su plan (pestaña Planes). «En uso» son los módulos que sus roles pueden abrir, según Accesos › Roles y Permisos.' })
            )
        );
    }

    // -- Pestaña: Pagos --

    tabPayments() {
        const d = this.detail;
        const paid = d.payments.filter(p => p.status === 'paid');
        const pending = d.payments.filter(p => p.status === 'pending');

        return this.card().append(
            this.cardHead('Historial de pagos', [
                this.chip(`Pagado: ${this.money(paid.reduce((s, p) => s + p.amount, 0))}`, 'ok'),
                pending.length ? this.chip(`Pendiente: ${this.money(pending.reduce((s, p) => s + p.amount, 0))}`, 'warn') : null,
                $('<div>', { class: 'flex-1' }),
                actionButton('plus', 'Registrar pago', () => payments.addPayment(d.company.id, () => this.reload()), true)
            ]),
            d.payments.length
                ? this.paymentsTable(d.payments, false, () => this.reload())
                : this.emptyState('credit-card', 'Sin pagos registrados', 'Registra el primero con «Registrar pago».')
        );
    }

    // -- Pestaña: Historial --

    tabHistory() {
        const d = this.detail;
        const subs = d.subscriptions.slice().sort((a, b) => String(b.starts || b.created).localeCompare(String(a.starts || a.created)));

        const timeline = $('<div>', { class: 'relative pl-5' });
        if (subs.length) {
            timeline.append($('<span>', { class: 'absolute left-[5px] top-1.5 bottom-1.5 w-0.5 rounded bg-gray-200' }));
            subs.forEach((s) => {
                const st = SUBSCRIPTION_STATUS[s.status] || { label: s.status, tone: 'neutral' };
                timeline.append($('<div>', { class: 'relative pb-5 last:pb-0 pl-3' }).append(
                    $('<span>', { class: 'absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-white border-[2.5px] border-blue-600' }),
                    $('<p>', { class: 'text-[11px] text-gray-400 mb-0', text: this.date(s.starts || s.created) }),
                    $('<p>', { class: 'flex items-center gap-2 flex-wrap text-sm font-semibold text-gray-800 mb-0' }).append(
                        $('<span>', { text: `Plan ${s.plan}` }),
                        this.chip(st.label, st.tone)
                    ),
                    $('<p>', { class: 'text-xs text-gray-500 mb-0', text: [
                        s.price !== null ? `${this.money(s.price, s.currency)} ${this.cycleText({ cycle: s.cycle })}` : '',
                        s.ends ? `hasta ${this.date(s.ends)}` : '',
                        s.next_billing ? `siguiente cobro ${this.date(s.next_billing)}` : ''
                    ].filter(Boolean).join(' · ') }),
                    s.reference ? $('<p>', { class: 'text-[11px] text-gray-400 font-mono mb-0', text: s.reference }) : null
                ));
            });
        } else {
            timeline.append($('<p>', { class: 'text-xs text-gray-400 mb-0', text: 'Sin suscripciones. Asígnale un plan desde la tarjeta del plan.' }));
        }

        const coupons = $('<div>', { class: 'flex flex-col gap-2' });
        d.redemptions.forEach((r) => coupons.append(
            $('<div>', { class: 'flex items-center justify-between gap-2' }).append(
                $('<span>', { class: 'text-xs font-mono font-semibold text-gray-700', text: r.code || 'Cupón' }),
                $('<span>', { class: 'text-[11px] text-gray-400', text: this.date(r.redeemed) })
            )
        ));
        if (!d.redemptions.length) coupons.append($('<p>', { class: 'text-xs text-gray-400 mb-0', text: 'No ha canjeado cupones.' }));

        // Cambios de plan: veces que la suscripción siguiente trae otro plan.
        const chrono = subs.slice().reverse();
        const changes = chrono.filter((s, i) => i > 0 && s.plan !== chrono[i - 1].plan).length;
        const since = this.clientSince();
        const months = since ? Math.max(0, Math.round((Date.now() - new Date(`${since}T12:00:00`)) / 2629800000)) : 0;

        return $('<div>', { class: 'grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 items-start' }).append(
            this.card('p-4 sm:p-5').append($('<h3>', { class: 'text-base font-bold text-gray-900 mb-4', text: 'Historial de suscripciones' }), timeline),
            this.card('p-4 sm:p-5').append(
                $('<h3>', { class: 'text-base font-bold text-gray-900 mb-3', text: 'Contrato' }),
                $('<div>', { class: 'flex flex-col gap-3' }).append(
                    this.stat('Plan actual', d.company.plan ? d.company.plan.name : 'Sin plan'),
                    this.stat('Cliente desde', this.date(since)),
                    this.stat('Antigüedad', `${months} ${months === 1 ? 'mes' : 'meses'}`),
                    this.stat('Suscripciones', d.subscriptions.length, changes ? `${changes} ${changes === 1 ? 'cambio' : 'cambios'} de plan` : '')
                ),
                $('<div>', { class: 'h-px bg-gray-100 my-4' }),
                this.statLabel('Cupones canjeados'),
                coupons
            )
        );
    }

    // -- Acciones de la empresa --

    addCompany() {
        this.createModalForm({
            id: 'formCompanyAdd',
            data: { opc: 'addCompany' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Nueva Empresa' },
            json: this.jsonCompany(true),
            success: (r) => afterSave(r, () => this.afterCompanySaved())
        });
    }

    // Empresas cambia también los selects de Suscripciones y Pagos (dataInit).
    async afterCompanySaved() {
        await refreshInit();
        this.refresh();
    }

    async editCompany(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getCompany', id: id } });
        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar la empresa', btn1: true });
            return;
        }

        const name  = request.data && request.data.name ? request.data.name : '';
        const title = name
            ? `Editar Empresa · <span class="text-blue-600 font-bold">${esc(name)}</span>`
            : 'Editar Empresa';

        this.createModalForm({
            id: 'formCompanyEdit',
            data: { opc: 'editCompany', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: title },
            autofill: request.data,
            json: this.jsonCompany(false),
            success: (r) => afterSave(r, () => this.afterCompanySaved())
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
            success: (r) => afterSave(r, () => this.afterCompanySaved())
        });
    }

    async editCompanyThemes(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getCompanyThemes', company_id: id } });
        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudieron cargar los temas', btn1: true });
            return;
        }

        this.createModalForm({
            id: 'formCompanyThemes',
            data: { opc: 'editCompanyThemes', company_id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: `Temas · <span class="text-blue-600 font-bold">${esc(request.company)}</span>` },
            json: this.jsonCompanyThemes(request.themes || [], request.selected || []),
            success: (r) => afterSave(r, () => this.afterCompanySaved())
        });
    }

    // Un checkbox por tema (theme_<id>). El de por defecto no se lista: lo ven todas.
    jsonCompanyThemes(themes, selected) {
        return [
            {
                opc: 'label',
                id: 'lblCompanyThemes',
                text: 'Temas que pueden elegir sus usuarios. Claro (por defecto) siempre está disponible.',
                class: 'col-12 mb-2 text-xs text-gray-500'
            },
            {
                opc: 'checkbox',
                id: 'themes',
                class: 'col-12 mb-3',
                required: false,
                data: themes.map((t) => ({
                    id: `theme_${t.id}`,
                    valor: t.valor,
                    checked: selected.includes(Number(t.id))
                }))
            }
        ];
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

    // -- Complements --

    // Cancelada o expirada: el plan ya no está contratado, solo se muestra como el último.
    closed(sub) {
        return !!sub && ['cancelled', 'expired'].includes(sub.status);
    }

    // Lo más viejo entre el alta de la empresa y su primera suscripción.
    clientSince() {
        const d = this.detail;
        const dates = [d.company.created].concat(d.subscriptions.map(s => s.starts || s.created)).filter(Boolean).sort();
        return dates[0] || null;
    }

    // El plan de la empresa abierta mientras sigue contratado: de él salen los topes.
    livePlan() {
        const c = this.detail.company;
        return c.plan && !this.closed(c.subscription) ? c.plan : null;
    }

    stateGroup(c) {
        return c.state.key === 'suspendida' ? 'vencida' : c.state.key;
    }

    filteredList() {
        const f = this.filters;
        const q = this.normalize(f.q.trim());
        const sorters = {
            nombre: (a, b) => a.name.localeCompare(b.name),
            mensual: (a, b) => b.monthly - a.monthly,
            vence: (a, b) => (a.state.days === null ? 1e9 : a.state.days) - (b.state.days === null ? 1e9 : b.state.days),
            sucursales: (a, b) => b.branches - a.branches
        };

        return this.list
            .filter(c => f.state === 'todas' || this.stateGroup(c) === f.state)
            .filter(c => f.plan === 'todos' || (c.plan && String(c.plan.id) === String(f.plan)))
            .filter(c => !q || this.normalize(`${c.name} ${c.rfc} ${c.ubication} ${c.owners}`).includes(q))
            .sort(sorters[f.order] || sorters.nombre);
    }

    endOf(sub) {
        return sub ? (sub.ends || sub.next_billing) : null;
    }
}

// -- Planes --

// Cómo se lee el ciclo junto al precio: "$299 MXN / mes + IVA".
const CYCLE_SUFFIX = { monthly: 'mes', yearly: 'año', lifetime: 'pago único' };

function money(value) {
    return '$' + Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Precio mensual de cada módulo que se vende, para el plan Personalizado.
function sellModuleLabel(m) {
    return m.price !== null && m.price !== '' ? `${m.valor} · ${money(m.price)}` : `${m.valor} · sin precio`;
}

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
        $wrap.html(`<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-1">${cards}</div>`);
    }

    buildPlanCard(p) {
        const isActive = parseInt(p.is_active) === 1;
        const isCustom = p.modules_mode === 'custom';
        const price    = parseFloat(p.price);
        const before   = parseFloat(p.price_before);
        const currency = esc(p.currency || 'MXN');
        const cycle    = CYCLE_SUFFIX[p.billing_cycle] || '';

        let priceHtml;
        if (isCustom) {
            priceHtml = `<span class="text-xl font-bold text-gray-800">Por módulo</span>`;
        } else if (!price) {
            priceHtml = `<span class="text-xl font-bold text-gray-800">Gratis</span>`;
        } else {
            priceHtml = `<span class="text-2xl font-bold text-gray-800">${money(price)}</span>
                         <span class="text-[11px] text-gray-400">${currency} / ${cycle} + IVA</span>`;
        }
        const beforeHtml = !isCustom && before > 0
            ? `<p class="text-[11px] text-gray-400 mb-0">antes <span class="line-through">${money(before)} ${currency}</span></p>`
            : '';

        const limits = [
            p.max_users != null && p.max_users !== '' ? `Hasta ${p.max_users} usuario${p.max_users == 1 ? '' : 's'}` : 'Usuarios ilimitados',
            p.max_branches != null && p.max_branches !== '' ? `${p.max_branches} sucursal${p.max_branches == 1 ? '' : 'es'}` : 'Sucursales ilimitadas'
        ];
        const trial = parseInt(p.trial_days);
        if (trial > 0) limits.push(`${trial} días de prueba`);

        const features = (p.features && p.features.length ? p.features : this.buildBullets(p)).map(f => `
            <li class="flex items-start gap-1.5 text-[11px] text-gray-600">
                <span class="text-blue-600 font-bold leading-none">✓</span>
                <span>${esc(f)}</span>
            </li>
        `).join('');

        const toggleChecked = isActive ? 'checked' : '';
        const toggleNext    = isActive ? 0 : 1;
        const cardBorder    = isActive ? 'border-blue-600' : 'border-gray-200 opacity-70';

        return `
            <div class="bg-white rounded-lg border ${cardBorder} shadow-sm flex flex-col p-3.5 gap-3 transition-all hover:shadow-md">
                <div class="flex items-start justify-between gap-1.5">
                    <div class="min-w-0">
                        <p class="text-[9px] font-semibold text-blue-600 uppercase tracking-wide">${esc(p.code || '')}</p>
                        <h3 class="text-sm font-bold text-gray-800 leading-tight truncate">${esc(p.name)}</h3>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5" title="${isActive ? 'Desactivar' : 'Activar'}">
                        <input type="checkbox" class="sr-only peer" ${toggleChecked}
                            onchange="plans.togglePlan(${p.id}, ${toggleNext})">
                        <div class="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer
                            peer-checked:bg-blue-600
                            after:content-[''] after:absolute after:top-0.5 after:left-0.5
                            after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all
                            peer-checked:after:translate-x-4">
                        </div>
                    </label>
                </div>

                <div>
                    ${beforeHtml}
                    <div class="flex items-baseline flex-wrap gap-1">${priceHtml}</div>
                </div>

                <div class="rounded-md bg-gray-50 px-2.5 py-2 flex flex-col gap-1">
                    <p class="text-[11px] font-semibold text-gray-700 mb-0">${esc(this.modulesText(p))}</p>
                    <p class="text-[11px] text-gray-500 mb-0">${limits.join(' · ')}</p>
                </div>

                <ul class="flex flex-col gap-1 flex-1 mb-0 ps-0">
                    ${features}
                </ul>

                <div class="flex gap-1.5 pt-2 border-t border-gray-100">
                    <button onclick="plans.editPlan(${p.id})"
                        class="flex-1 text-[11px] border border-blue-600 text-blue-600 rounded-md py-1 px-2 font-medium hover:bg-blue-600 hover:text-white transition-colors">
                        Editar
                    </button>
                    <button onclick="plans.configurePlan(${p.id})"
                        class="flex-1 text-[11px] bg-blue-600 text-white rounded-md py-1 px-2 font-medium hover:bg-blue-700 transition-colors">
                        Configurar
                    </button>
                </div>
            </div>
        `;
    }

    // Qué módulos trae: los elegidos, todos o (Personalizado) el precio de cada uno.
    modulesText(p) {
        const sell = dataInit.sellModules || [];
        if (p.modules_mode === 'all') return 'Todos los módulos';
        if (p.modules_mode === 'custom') {
            return sell.length ? 'Precio por módulo: ' + sell.map(sellModuleLabel).join(', ') : 'Precio por módulo';
        }
        const names = sell.filter(m => (p.module_ids || []).includes(Number(m.id))).map(m => m.valor);
        return names.length ? 'Módulos: ' + names.join(', ') : 'Sin módulos';
    }

    // Lo que se muestra si el plan no tiene escrita su lista de lo que incluye.
    buildBullets(p) {
        const bullets = [];

        const cycle = p.billing_cycle;
        if (cycle === 'monthly')  bullets.push('Facturación mensual');
        else if (cycle === 'yearly')  bullets.push('Facturación anual');
        else if (cycle === 'lifetime') bullets.push('Pago único');

        return bullets;
    }

    configurePlan(id) {
        Swal.fire({
            icon: 'info',
            title: 'Próximamente',
            text: 'La configuración avanzada del plan estará disponible pronto.',
            confirmButtonColor: 'rgb(var(--brand-600, 192 90 64))'
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
        this.wirePlanForm('formPlanAdd', []);
    }

    async editPlan(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getPlan', id: id } });
        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar el plan', btn1: true });
            return;
        }

        const data = request.data;
        if (data.billing_cycle != null) data.billing_cycle = String(data.billing_cycle);

        const title = data.name
            ? `Editar Plan · <span class="text-blue-600 font-bold">${esc(data.name)}</span>`
            : 'Editar Plan';

        this.createModalForm({
            id: 'formPlanEdit',
            data: { opc: 'editPlan', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: title },
            autofill: data,
            json: this.jsonPlan(),
            success: (r) => afterSave(r, () => this.lsPlans())
        });
        this.wirePlanForm('formPlanEdit', data.module_ids || []);
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
                id: 'name',
                lbl: 'Nombre del plan',
                class: 'col-12 col-md-6 mb-3',
                required: true
            },
            {
                opc: 'input',
                id: 'code',
                lbl: 'Código',
                class: 'col-12 col-md-6 mb-3',
                required: false
            },
            {
                opc: 'select',
                id: 'modules_mode',
                lbl: 'Módulos del plan',
                class: 'col-12 mb-3',
                data: dataInit.modulesModes || []
            },
            // Hueco vacío: lo rellena wirePlanForm() con el select de módulos.
            {
                opc: 'div',
                id: 'planModulesWrap',
                lbl: 'Módulos incluidos',
                class: 'col-12 mb-3',
                required: false
            },
            {
                opc: 'input',
                id: 'price',
                lbl: 'Precio sin IVA',
                type: 'number',
                class: 'col-12 col-md-4 mb-3',
                required: true
            },
            {
                opc: 'input',
                id: 'price_before',
                lbl: 'Precio antes (tachado)',
                type: 'number',
                class: 'col-12 col-md-4 mb-3',
                required: false
            },
            {
                opc: 'input',
                id: 'currency',
                lbl: 'Moneda',
                class: 'col-12 col-md-4 mb-3',
                value: 'MXN',
                required: false
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
                class: 'col-12 col-md-6 mb-3',
                required: false
            },
            {
                opc: 'input',
                id: 'max_users',
                lbl: 'Máx. usuarios',
                type: 'number',
                placeholder: 'Vacío: ilimitados',
                class: 'col-12 col-md-6 mb-3',
                required: false
            },
            {
                opc: 'input',
                id: 'max_branches',
                lbl: 'Máx. sucursales',
                type: 'number',
                placeholder: 'Vacío: ilimitadas',
                class: 'col-12 col-md-6 mb-3',
                required: false
            },
            {
                opc: 'textarea',
                id: 'features',
                lbl: 'Lo que incluye (uno por renglón)',
                class: 'col-12 mb-3',
                rows: 6,
                required: false
            }
        ];
    }

    // -- Complements --

    /*  Los módulos del plan van en un select2 múltiple y viajan como JSON en el
        hidden `module_ids` (el modal arma su envío con FormData y de un select
        múltiple solo quedaría el último). Se muestran solo con "Los módulos que
        elijas"; en Personalizado tampoco hay precio fijo: se cobra por módulo. */
    wirePlanForm(formId, selected) {
        const $form = $(`#${formId}`);
        const $wrap = $form.find('#planModulesWrap');
        if (!$wrap.length) return;

        const picked  = (selected || []).map(Number);
        const $input  = $('<input>', { type: 'hidden', name: 'module_ids' });
        const $select = $('<select>', { id: `${formId}Modules`, multiple: true, class: 'w-full' });
        (dataInit.sellModules || []).forEach((m) => $select.append($('<option>', {
            value: m.id,
            text: m.valor,
            selected: picked.includes(Number(m.id))
        })));
        $wrap.empty().append($select, $input);

        const sync = () => $input.val(JSON.stringify(($select.val() || []).map(Number)));
        $select.on('change', sync);
        sync();

        if ($.fn.select2) {
            const cfg = { theme: 'bootstrap-5', width: '100%', placeholder: 'Elige los módulos del plan', closeOnSelect: false };
            const $modal = $select.closest('.cf-modal, .modal, .bootbox');
            if ($modal.length) cfg.dropdownParent = $modal;
            $select.select2(cfg);
        }

        const $mode   = $form.find('[name="modules_mode"]');
        const $price  = $form.find('[name="price"]');
        const $before = $form.find('[name="price_before"]');
        const toggle  = () => {
            const mode = $mode.val();
            $wrap.closest('[class*="col-"]').toggle(mode === 'included');
            $price.prop('required', mode !== 'custom').closest('[class*="col-"]').toggle(mode !== 'custom');
            $before.closest('[class*="col-"]').toggle(mode !== 'custom');
        };
        $mode.on('change', toggle);
        toggle();
    }
}

// -- Módulos --
// La facturación de cada módulo que se vende: su precio en el plan
// Personalizado, qué ofrece, en qué planes viene, quién lo paga, quién lo usa y
// lo que deja al mes. Nombre, ícono, ruta y secciones se administran en
// Accesos › Módulos; Developer no se vende y no aparece aquí.

class BillingModules extends BillingPanel {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'BillingModules';
        this.data = null;
        this.filter = 'todos';
    }

    // -- Interface --

    render() {
        this.layout();
        this.load();
    }

    layout() {
        this.createLayout({
            parent: 'container-modulos',
            design: false,
            data: {
                id: 'billingModulesPanel',
                class: 'flex flex-col gap-3',
                container: [
                    { type: 'div', id: 'billingModulesBody', class: 'w-full flex flex-col gap-4' }
                ]
            }
        });
    }

    body() {
        return $('#billingModulesBody');
    }

    async load() {
        this.body().html(this.loading());
        const request = await useFetch({ url: this._link, data: { opc: 'lsBillingModules' } });
        if (!request || request.status !== 200) {
            this.failed(request);
            return;
        }

        this.data = request;
        this.renderModules();
    }

    renderModules() {
        const all = this.data.modules || [];
        const total = this.data.companies || 0;
        const priced = all.filter(m => m.price !== null);
        const revenue = all.reduce((s, m) => s + m.revenue, 0);
        const mostUsed = all.slice().sort((a, b) => b.using.length - a.using.length)[0];

        const pick = {
            todos: () => true,
            precio: m => m.price !== null,
            sin_precio: m => m.price === null,
            sin_uso: m => !m.using.length
        };
        const groups = [
            { key: 'todos', label: 'Todos' },
            { key: 'precio', label: 'Con precio' },
            { key: 'sin_precio', label: 'Sin precio' },
            { key: 'sin_uso', label: 'Sin uso' }
        ].map(g => Object.assign(g, { count: all.filter(pick[g.key]).length }));
        const list = all.filter(pick[this.filter] || pick.todos);

        const grid = $('<div>', { class: 'grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3' });
        list.forEach((m) => grid.append(this.moduleCard(m, total)));

        this.body().empty().append(
            $('<div>', { class: 'flex items-start justify-between gap-3 flex-wrap' }).append(
                this.pageHead('Módulos', 'Lo que se cobra por cada módulo, qué ofrece, en qué planes viene y quién lo usa.'),
                actionButton('external-link', 'Crear o editar en Accesos', () => { window.location.href = 'accesos.php'; })
            ),
            this.kpis([
                { label: 'Módulos a la venta', value: all.length, sub: `${priced.length} con precio para Personalizado` },
                { label: 'Ingreso por módulos', value: this.money(revenue), sub: 'al mes, de Personalizado activos', tone: 'ok' },
                { label: 'Más usado', value: mostUsed && mostUsed.using.length ? mostUsed.name : '—', sub: mostUsed && mostUsed.using.length ? `por ${this.companiesText(mostUsed.using.length)}` : 'sin uso todavía' },
                { label: 'Empresas', value: total, sub: 'en la cartera' }
            ]),
            this.data.hasFeatures ? null : $('<div>', { class: 'flex items-start gap-2 px-3.5 py-2.5 rounded-xl ring-1 ring-inset ring-amber-200 bg-amber-50 text-xs text-amber-700' }).append(
                $('<i>', { 'data-lucide': 'triangle-alert', class: 'w-4 h-4 shrink-0 mt-px' }),
                $('<span>', { text: 'Para escribir qué ofrece cada módulo falta aplicar la migración 2026-10-31_modulos-que-ofrece.sql. Lo demás ya funciona.' })
            ),
            $('<div>', { class: 'flex items-center gap-2 flex-wrap' }).append(
                this.segmented(groups, this.filter, (key) => {
                    this.filter = key;
                    this.renderModules();
                })
            ),
            list.length
                ? grid
                : this.card().append(this.emptyState('layout-grid', all.length ? 'Sin módulos con ese filtro' : 'Todavía no hay módulos a la venta', all.length ? 'Cambia el filtro.' : 'Se crean en Accesos › Módulos.'))
        );
        this.icons();
    }

    moduleCard(m, total) {
        const names = (list) => list.length ? list.slice(0, 4).join(', ') + (list.length > 4 ? ` +${list.length - 4}` : '') : 'Ninguna';
        // Lo abren sus roles pero no viene en lo que pagan.
        const unpaid = m.using.filter(n => !m.paying.includes(n));

        const plans = $('<div>', { class: 'flex flex-wrap gap-1' });
        m.plans.forEach(p => plans.append(this.chip(p, 'pri')));
        if (!m.plans.length) plans.append(this.chip('En ningún plan', 'warn'));

        const features = $('<ul>', { class: 'flex flex-col gap-1 mb-0 ps-0' });
        m.features.forEach(f => features.append($('<li>', { class: 'flex items-start gap-1.5 text-xs text-gray-600' }).append(
            $('<span>', { class: 'text-blue-600 font-bold leading-none', text: '✓' }),
            $('<span>', { text: f })
        )));
        if (!m.features.length) features.append($('<li>', { class: 'text-xs text-gray-400', text: 'Sin lista de lo que ofrece.' }));

        return this.card('p-4 flex flex-col gap-3' + (m.is_active ? '' : ' opacity-70')).append(
            $('<div>', { class: 'flex items-start gap-2.5' }).append(
                $('<span>', { class: 'shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-xl bg-blue-600/10 text-blue-600' })
                    .append($('<i>', { 'data-lucide': m.icon, class: 'w-5 h-5' })),
                $('<div>', { class: 'min-w-0 flex-1' }).append(
                    $('<p>', { class: 'text-sm font-bold text-gray-900 truncate mb-0', text: m.name }),
                    $('<p>', { class: 'text-xs text-gray-500 mb-0', text: m.description || 'Sin descripción.' })
                ),
                m.is_active ? null : this.chip('Apagado', 'neutral'),
                this.iconButton('pencil', 'Editar facturación', () => this.editBilling(m))
            ),
            $('<div>', { class: 'flex items-baseline flex-wrap gap-1' }).append(
                m.price !== null
                    ? [$('<span>', { class: 'text-2xl font-extrabold text-gray-900', text: this.money(m.price) }), $('<span>', { class: 'text-[11px] text-gray-400', text: 'MXN / mes + IVA · plan Personalizado' })]
                    : [$('<span>', { class: 'text-sm font-semibold text-amber-700', text: 'Sin precio' }), $('<span>', { class: 'text-[11px] text-gray-400', text: '· no se puede elegir en Personalizado' })]
            ),
            this.data.hasFeatures ? $('<div>').append(this.statLabel('Qué ofrece'), features) : null,
            $('<div>').append(this.statLabel('Viene en los planes'), plans),
            $('<div>', { class: 'flex flex-col gap-2' }).append(
                this.usageRow('Lo pagan', m.paying.length, total, 'bg-blue-600'),
                this.usageRow('Lo usan', m.using.length, total, 'bg-blue-600')
            ),
            $('<div>', { class: 'flex flex-col gap-0.5 text-[11px] text-gray-500' }).append(
                $('<p>', { class: 'mb-0 truncate', text: `Lo pagan: ${names(m.paying)}` }).attr('title', m.paying.join(', ')),
                $('<p>', { class: 'mb-0 truncate', text: `Lo usan: ${names(m.using)}` }).attr('title', m.using.join(', ')),
                $('<p>', { class: 'mb-0', text: m.custom_subs ? `Deja ${this.money(m.revenue)} al mes en ${m.custom_subs} ${m.custom_subs === 1 ? 'suscripción' : 'suscripciones'} Personalizado` : 'Sin suscripciones Personalizado activas' })
            ),
            unpaid.length ? $('<div>', { class: 'px-3 py-2 rounded-lg bg-amber-50 text-[11px] text-amber-700' }).text(`Lo usan sin pagarlo: ${unpaid.join(', ')}`) : null
        );
    }

    editBilling(m) {
        this.createModalForm({
            id: 'formModuleBilling',
            data: { opc: 'editModuleBilling', id: m.id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: `Facturación · <span class="text-blue-600 font-bold">${esc(m.name)}</span>` },
            autofill: { price: m.price !== null ? m.price : '', description: m.description, features: m.features.join('\n') },
            json: this.jsonBilling(),
            // El precio también sale en Planes y en el modal de Suscripciones (dataInit).
            success: (r) => afterSave(r, async () => { await refreshInit(); this.load(); })
        });
    }

    jsonBilling() {
        const fields = [
            {
                opc: 'input',
                id: 'price',
                lbl: 'Precio mensual sin IVA',
                type: 'number',
                placeholder: 'Vacío: no se vende por separado',
                class: 'col-12 col-md-5 mb-3',
                required: false
            },
            {
                opc: 'input',
                id: 'description',
                lbl: 'Descripción corta',
                placeholder: 'Texto de su tarjeta',
                class: 'col-12 col-md-7 mb-3',
                required: false
            }
        ];

        if (this.data && this.data.hasFeatures) {
            fields.push({ opc: 'textarea', id: 'features', lbl: 'Qué ofrece (uno por renglón)', rows: 6, class: 'col-12 mb-3', required: false });
        }

        fields.push({
            opc: 'p',
            id: 'billingPriceHint',
            class: 'col-12',
            style: 'font-size:12px;color:#6B7280;margin:0',
            text: 'Un precio nuevo aplica a las suscripciones que se den de alta; las que ya tienen el módulo conservan el suyo.'
        });
        return fields;
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
                striped: true,
                center: [4, 5, 6, 7],
                right: [3]
            }
        });
    }

    // companyId: el detalle de una empresa abre el modal con ella elegida.
    // onSaved: cómo se refresca quien lo abrió (esta tabla o ese detalle).
    addSubscription(companyId = null, onSaved = () => this.lsSubscriptions()) {
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
            autofill: companyId ? { company_id: String(companyId) } : false,
            json: this.jsonSubscription(),
            success: (r) => afterSave(r, onSaved)
        });
        this.wireModulesField('formSubscriptionAdd', []);
    }

    async editSubscription(id, onSaved = () => this.lsSubscriptions()) {
        const request = await useFetch({ url: this._link, data: { opc: 'getSubscription', id: id } });
        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar la suscripción', btn1: true });
            return;
        }

        // La suscripción no tiene nombre propio: se identifica por su empresa,
        // que getSubscription trae como company_name.
        const company = request.data && request.data.company_name ? request.data.company_name : '';
        const title   = company
            ? `Editar Suscripción · <span class="text-blue-600 font-bold">${esc(company)}</span>`
            : 'Editar Suscripción';

        this.createModalForm({
            id: 'formSubscriptionEdit',
            data: { opc: 'editSubscription', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: title },
            autofill: request.data,
            json: this.jsonSubscription(),
            success: (r) => afterSave(r, onSaved)
        });
        this.wireModulesField('formSubscriptionEdit', request.data ? request.data.modules : []);
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
            // Hueco vacío: wireModulesField() lo rellena si el plan es Personalizado.
            {
                opc: 'div',
                id: 'subModulesWrap',
                lbl: 'Módulos que contrata',
                class: 'col-12 mb-3',
                required: false
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
                class: 'col-12 col-md-6 mb-3',
                required: false
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
                // Las mensuales no tienen fin: se renuevan en el próximo cobro.
                class: 'col-12 col-md-4 mb-3',
                required: false
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

    // -- Complements --

    /*  Los módulos de un plan Personalizado: select2 múltiple con el precio de
        cada uno y el total debajo. Viajan como JSON en el hidden `module_ids` (de
        un select múltiple en FormData solo quedaría el último) y el campo solo se
        ve si el plan elegido es Personalizado.
        contracted: al editar, [{id, price}] con el precio con el que ya se
        contrató cada módulo; ese se respeta aunque el módulo haya cambiado de precio. */
    wireModulesField(formId, contracted) {
        const $form = $(`#${formId}`);
        const $wrap = $form.find('#subModulesWrap');
        if (!$wrap.length) return;

        const kept = {};
        (contracted || []).forEach((m) => { kept[Number(m.id)] = Number(m.price); });

        const sell    = dataInit.sellModules || [];
        const $input  = $('<input>', { type: 'hidden', name: 'module_ids' });
        const $select = $('<select>', { id: `${formId}Modules`, multiple: true, class: 'w-full' });
        const $total  = $('<p>', { class: 'text-xs text-gray-500 mt-1.5 mb-0' });
        const priceOf = (m) => (Number(m.id) in kept ? kept[Number(m.id)] : m.price);

        sell.forEach((m) => $select.append($('<option>', {
            value: m.id,
            text: sellModuleLabel(Object.assign({}, m, { price: priceOf(m) })),
            selected: Number(m.id) in kept,
            // Sin precio no se puede cobrar: se le pone en Accesos › Módulos.
            disabled: (m.price === null || m.price === '') && !(Number(m.id) in kept)
        })));
        $wrap.empty().append($select, $input, $total);

        const sync = () => {
            const ids = ($select.val() || []).map(Number);
            const sum = sell.filter(m => ids.includes(Number(m.id))).reduce((s, m) => s + Number(priceOf(m) || 0), 0);
            $input.val(JSON.stringify(ids));
            $total.text(ids.length ? `Total: ${money(sum)} MXN / mes + IVA` : 'Elige al menos un módulo.');
        };
        $select.on('change', sync);
        sync();

        if ($.fn.select2) {
            const cfg = { theme: 'bootstrap-5', width: '100%', placeholder: 'Elige los módulos', closeOnSelect: false };
            const $modal = $select.closest('.cf-modal, .modal, .bootbox');
            if ($modal.length) cfg.dropdownParent = $modal;
            $select.select2(cfg);
        }

        const $plan  = $form.find('[name="plan_id"]');
        const toggle = () => {
            const plan = (dataInit.plans || []).find(p => String(p.id) === String($plan.val()));
            $wrap.closest('[class*="col-"]').toggle(!!plan && plan.modules_mode === 'custom');
        };
        $plan.on('change', toggle);
        toggle();
    }
}

// -- Pagos --

class Payments extends BillingPanel {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Payments';
        this.payments = [];
        this.payFilters = { status: 'todos', company: 'todas' };
    }

    // -- Interface --

    render() {
        this.layout();
        this.loadPayments();
    }

    layout() {
        this.createLayout({
            parent: 'container-pagos',
            design: false,
            data: {
                id: 'paymentsPanel',
                class: 'flex flex-col gap-3',
                container: [
                    { type: 'div', id: 'paymentsBody', class: 'w-full flex flex-col gap-4' }
                ]
            }
        });
    }

    body() {
        return $('#paymentsBody');
    }

    // -- Vista: Pagos de todas las empresas --

    async loadPayments() {
        this.body().html(this.loading());
        const request = await useFetch({ url: this._link, data: { opc: 'lsPanelPayments' } });
        if (!request || request.status !== 200) {
            this.failed(request);
            return;
        }

        this.payments = request.payments || [];
        this.renderPayments();
    }

    renderPayments() {
        const all = this.payments;
        const sum = (list) => list.reduce((s, p) => s + p.amount, 0);
        const paid = all.filter(p => p.status === 'paid');
        const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const f = this.payFilters;

        const companies = [];
        all.forEach((p) => { if (!companies.some(c => c.id === p.company_id)) companies.push({ id: p.company_id, valor: p.company || `#${p.company_id}` }); });

        const statuses = [{ key: 'todos', label: 'Todos', count: all.length }].concat(
            Object.keys(PAYMENT_STATUS).map(k => ({ key: k, label: PAYMENT_STATUS[k].label, count: all.filter(p => p.status === k).length }))
        );

        const list = all.filter(p => (f.status === 'todos' || p.status === f.status) && (f.company === 'todas' || String(p.company_id) === String(f.company)));

        this.body().empty().append(
            $('<div>', { class: 'flex items-start justify-between gap-3 flex-wrap' }).append(
                this.pageHead('Pagos', 'Cobros de todas las empresas.'),
                actionButton('plus', 'Registrar pago', () => this.addPayment(), true)
            ),
            this.kpis([
                { label: 'Cobrado · 30 días', value: this.money(sum(paid.filter(p => p.date >= monthAgo))), sub: `${paid.length} pagos cobrados en total`, tone: 'ok' },
                { label: 'Pendiente', value: this.money(sum(all.filter(p => p.status === 'pending'))), sub: `${all.filter(p => p.status === 'pending').length} por confirmar`, tone: 'warn' },
                { label: 'Fallidos', value: this.money(sum(all.filter(p => p.status === 'failed'))), sub: `${all.filter(p => p.status === 'failed').length} cobros fallidos`, tone: 'bad' },
                { label: 'Ticket promedio', value: this.money(paid.length ? sum(paid) / paid.length : 0), sub: 'por pago cobrado' }
            ]),
            $('<div>', { class: 'flex items-center gap-2 flex-wrap' }).append(
                this.segmented(statuses, f.status, (key) => { f.status = key; this.renderPayments(); }),
                $('<div>', { class: 'flex-1' }),
                this.select([{ id: 'todas', valor: 'Todas las empresas' }].concat(companies), f.company, (value) => { f.company = value; this.renderPayments(); })
            ),
            this.card().append(list.length
                ? this.paymentsTable(list, true, () => this.loadPayments())
                : this.emptyState('credit-card', all.length ? 'Sin pagos con ese filtro' : 'Todavía no hay pagos', all.length ? 'Cambia el estado o la empresa.' : 'Registra el primero con «Registrar pago».'))
        );
        this.icons();
    }

    // -- Pago: registrar, editar, estado --
    // companyId: el detalle de una empresa abre el modal con ella elegida.
    // onSaved: cómo se refresca quien lo abrió (esta pestaña o ese detalle).

    addPayment(companyId = null, onSaved = () => this.loadPayments()) {
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
            autofill: companyId ? { company_id: String(companyId) } : false,
            json: this.jsonPayment(),
            success: (r) => afterSave(r, onSaved)
        });
    }

    async editPayment(id, onSaved = () => this.loadPayments()) {
        const request = await useFetch({ url: this._link, data: { opc: 'getPayment', id: id } });
        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar el pago', btn1: true });
            return;
        }

        // Mismo caso que la suscripción: el pago se identifica por su empresa.
        const company = request.data && request.data.company_name ? request.data.company_name : '';
        const title   = company
            ? `Editar Pago · <span class="text-blue-600 font-bold">${esc(company)}</span>`
            : 'Editar Pago';

        this.createModalForm({
            id: 'formPaymentEdit',
            data: { opc: 'editPayment', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: title },
            autofill: request.data,
            json: this.jsonPayment(),
            success: (r) => afterSave(r, onSaved)
        });
    }

    changeStatus(id, current, onSaved = () => this.loadPayments()) {
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
            success: (r) => afterSave(r, onSaved)
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
                required: false,
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
                class: 'col-12 col-md-6 mb-3',
                required: false
            },
            {
                opc: 'input',
                id: 'transaction_id',
                lbl: 'ID de transacción',
                type: 'number',
                class: 'col-12 col-md-6 mb-3',
                required: false
            },
            {
                opc: 'input',
                id: 'paid_at',
                lbl: 'Fecha de pago',
                type: 'date',
                class: 'col-12 col-md-6 mb-3',
                required: false
            },
            {
                opc: 'input',
                id: 'invoice_url',
                lbl: 'URL de factura',
                class: 'col-12 mb-3',
                required: false
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
        const cardBorder    = isActive ? 'border-blue-600' : 'border-gray-200 opacity-70';

        return `
            <div class="bg-white rounded-lg border ${cardBorder} shadow-sm flex flex-col p-3 gap-2.5 transition-all hover:shadow-md">
                <div class="flex items-start justify-between gap-1.5">
                    <div class="min-w-0">
                        <p class="text-[9px] font-semibold text-blue-600 uppercase tracking-wide">Cupón</p>
                        <h3 class="text-sm font-bold text-gray-800 leading-tight font-mono truncate">${c.code || ''}</h3>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5" title="${isActive ? 'Desactivar' : 'Activar'}">
                        <input type="checkbox" class="sr-only peer" ${toggleChecked}
                            onchange="coupons.toggleCoupon(${c.id}, ${toggleNext})">
                        <div class="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer
                            peer-checked:bg-blue-600
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
                        <span class="text-blue-600 font-bold leading-none">✓</span>
                        <span>${used} / ${max} usos</span>
                    </div>
                    <div class="flex items-center gap-1.5 text-[11px] text-gray-600">
                        <span class="text-blue-600 font-bold leading-none">✓</span>
                        <span>${desde} → ${hasta}</span>
                    </div>
                </div>

                <div class="flex gap-1.5 pt-2 border-t border-gray-100">
                    <button onclick="coupons.editCoupon(${c.id})"
                        class="flex-1 text-[11px] border border-blue-600 text-blue-600 rounded-md py-1 px-2 font-medium hover:bg-blue-600 hover:text-white transition-colors">
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

        const title = data.code
            ? `Editar Cupón · <span class="text-blue-600 font-bold">${esc(data.code)}</span>`
            : 'Editar Cupón';

        this.createModalForm({
            id: 'formCouponEdit',
            data: { opc: 'editCoupon', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: title },
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
                striped: true,
                center: [3, 4],
                right: []
            }
        });
    }
}
