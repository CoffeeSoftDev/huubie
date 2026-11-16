/*  Ventas › Tienda en línea (V8 del plan de Ventas): la página interna.

    Arriba, la tienda: si está abierta, su enlace y lo que acepta (entrega,
    pago, anticipación). Abajo, dos pestañas:
      - «Pedidos»: la bandeja de lo que llega por el enlace. Aceptar lo pasa a
        Pedidos (pide turno abierto); rechazar pide motivo. Los dos ofrecen
        avisarle al cliente por WhatsApp con el mensaje ya escrito.
      - «Productos»: qué sale en la tienda. Un producto de la Matriz es de
        todas las sucursales que lo comparten: cambiarlo aquí lo cambia allá.

    La página pública (pedir.php) es otra: no usa esta clase.
    Los estilos tnd-* se inyectan desde aquí (storeCSS) para no tocar order.css.
    El detalle, el turno y el cobro llaman a orders.lsOrders(), orders.can() y
    orders.paintTurn(): aquí `orders` es la misma instancia que `store`. */

let api = 'ctrl/ctrl-tienda.php';
let store, orders, orderDetail, orderTurn, orderPay, orderClosure;
let dataInit = {};

$(async () => {
    dataInit = (await useFetch({ url: api, data: { opc: 'init' } })) || {};

    orderDetail          = new OrderDetail('ctrl/ctrl-pedidos.php', 'root');
    orderDetail.editable = false;
    orderTurn            = new OrderTurn('ctrl/ctrl-turno.php', 'root');
    orderPay             = new OrderPay('ctrl/ctrl-cobro.php', 'root');
    orderClosure         = new OrderClosure('ctrl/ctrl-cierre.php', 'root');
    store                = new OnlineShop(api, 'root');
    orders               = store;
    store.init();
});

// -- Miniaturas --

/*  La foto falla en local porque las imágenes viven en el servidor: primero
    prueba la misma ruta en huubie.com.mx; si tampoco, pone las iniciales. */
function storeThumbError(img) {
    if (!img.dataset.retry) {
        img.dataset.retry = '1';

        try {
            const path = new URL(img.src, location.href).pathname;

            if (location.hostname !== 'huubie.com.mx') {
                img.src = 'https://huubie.com.mx' + path;
                return;
            }
        } catch (e) {}
    }

    const span = document.createElement('span');

    span.className   = 'tnd-thumb tnd-thumb-vacia';
    span.textContent = img.dataset.initials || '?';
    img.replaceWith(span);
}

// -- CSS --

function storeCSS() {
    if (document.getElementById('tnd-css')) return;

    const line  = 'rgb(var(--gray-200, 231 229 228))';
    const soft  = 'rgb(var(--gray-50, 250 250 249))';
    const ink   = 'rgb(var(--gray-900, 28 25 23))';
    const mute  = 'rgb(var(--gray-500, 120 113 108))';
    const body  = 'rgb(var(--gray-600, 87 83 78))';

    const css = `
        .tnd-hero { position: relative; display: flex; flex-wrap: wrap; gap: 16px 24px; align-items: stretch; justify-content: space-between;
            padding: 18px 20px 18px 24px; border: 1px solid ${line}; border-radius: 14px; background: #FFFFFF; overflow: hidden; }
        .tnd-hero::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 5px; background: var(--tnd-accent, #233876); }
        .tnd-hero-main { flex: 1 1 340px; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
        .tnd-hero-side { flex: 0 1 380px; min-width: 0; display: flex; flex-direction: column; gap: 6px; justify-content: center; }
        .tnd-state { display: inline-flex; align-items: center; gap: 7px; width: max-content; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
        .tnd-state.is-on  { background: #ECFDF5; color: #047857; }
        .tnd-state.is-off { background: rgb(var(--gray-100, 245 245 244)); color: ${body}; }
        .tnd-state-dot { width: 7px; height: 7px; border-radius: 999px; background: currentColor; }
        .tnd-state.is-on .tnd-state-dot { animation: tnd-pulse 2.6s ease-in-out infinite; }
        @keyframes tnd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        .tnd-title { margin: 0; font-size: 19px !important; font-weight: 700; line-height: 1.25; color: ${ink}; overflow-wrap: anywhere; }
        .tnd-msg { margin: 0; font-size: 13px; line-height: 1.45; color: ${body}; overflow-wrap: anywhere; }
        .tnd-msg.is-empty { color: ${mute}; font-style: italic; }
        .tnd-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
        .tnd-tag { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border: 1px solid ${line}; border-radius: 999px;
            background: #FFFFFF; font-size: 12px; font-weight: 500; color: ${body}; }
        .tnd-tag svg { width: 14px; height: 14px; flex-shrink: 0; }
        .tnd-tag.is-warn { border-color: #FDE68A; background: #FFFBEB; color: #B45309; }
        .tnd-label { font-size: 11.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: ${mute}; }
        .tnd-link { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 9px 12px; border: 1px dashed rgb(var(--gray-300, 214 211 209));
            border-radius: 10px; background: ${soft}; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px;
            color: var(--tnd-accent, #233876); text-decoration: none; }
        .tnd-link:hover { border-style: solid; text-decoration: none; }
        .tnd-link svg { width: 15px; height: 15px; flex-shrink: 0; }
        .tnd-link span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tnd-hint { font-size: 12px; line-height: 1.4; color: ${mute}; }

        .ord-kpis.tnd-kpis { margin-top: 12px; }
        @media (min-width: 768px) { .ord-kpis.tnd-kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        .ord-kpi.is-alert { border-color: #FCD34D; background: #FFFBEB; }
        .ord-kpi.is-alert .ord-kpi-value { color: #B45309; }

        .tnd-prod { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .tnd-thumb { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; flex-shrink: 0; background: rgb(var(--gray-100, 245 245 244)); }
        .tnd-thumb-vacia { display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: ${mute}; }
        .tnd-desc { max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        #containerOnlineShop .ord-dt-top { display: flex; align-items: center; min-height: 42px; margin-bottom: 10px; }
        #containerOnlineShop .ord-dt-scroll { overflow-x: auto; }
        #containerOnlineShop .ord-dt-foot { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
        #containerOnlineShop .dataTables_paginate .pagination { margin: 0; }
        #containerOnlineShop .dataTables_info { font-size: 12.5px; color: ${mute}; padding-top: 12px !important; }
        #containerOnlineShop .dataTables_paginate { padding-top: 8px; }
        #tbStoreOrders thead th, #tbStoreProducts thead th { text-transform: none; white-space: nowrap; }
        #tbStoreOrders td, #tbStoreProducts td { vertical-align: middle; }
        #formHeaderStore label { display: none; }
        #formHeaderStore > div { margin-top: 0 !important; }
        #formHeaderStore button { white-space: nowrap; }

        .tnd-accent-demo { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 4px; }
        .tnd-accent-btn { display: inline-flex; align-items: center; padding: 7px 14px; border-radius: 999px; background: var(--tnd-accent, #233876);
            color: #FFFFFF; font-size: 12.5px; font-weight: 600; }
        .tnd-accent-chip { display: inline-flex; align-items: center; padding: 5px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 600;
            color: var(--tnd-accent, #233876); background: color-mix(in srgb, var(--tnd-accent, #233876) 12%, transparent); }
        .tnd-section { margin: 6px 0 -4px; padding-top: 12px; border-top: 1px solid ${line}; font-size: 12px; font-weight: 700; letter-spacing: .04em;
            text-transform: uppercase; color: ${mute}; }
        .tnd-section.is-first { margin-top: 0; padding-top: 0; border-top: 0; }

        .tnd-det { display: flex; flex-direction: column; gap: 14px; padding: 1.5rem; }
        .tnd-det-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        .tnd-det-folio { margin: 0; font-size: 13px; color: ${mute}; }
        .tnd-det-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
        @media (min-width: 640px) { .tnd-det-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        .tnd-det-box { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 10px 12px; border: 1px solid ${line}; border-radius: 12px; }
        .tnd-det-box p { margin: 0; }
        .tnd-det-label { font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: ${mute}; }
        .tnd-det-value { font-size: 14px; font-weight: 600; color: ${ink}; overflow-wrap: anywhere; }
        .tnd-det-sub { font-size: 12.5px; line-height: 1.4; color: ${mute}; overflow-wrap: anywhere; }
        .tnd-det-sub a { color: inherit; text-decoration: underline; }
        .tnd-det-lines { border: 1px solid ${line}; border-radius: 12px; overflow: hidden; }
        .tnd-det-line { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-bottom: 1px solid rgb(var(--gray-100, 245 245 244)); }
        .tnd-det-line p { margin: 0; }
        .tnd-det-qty { min-width: 36px; padding: 3px 0; border-radius: 8px; background: ${soft}; text-align: center; font-size: 13px; font-weight: 700; color: ${ink}; }
        .tnd-det-name { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; color: ${ink}; }
        .tnd-det-amount { font-size: 13.5px; font-weight: 600; white-space: nowrap; color: ${ink}; }
        .tnd-det-total { display: flex; justify-content: space-between; padding: 11px 12px; background: ${soft}; font-size: 15px; font-weight: 700; color: ${ink}; }
        .tnd-det-note { margin: 0; padding: 10px 12px; border-radius: 12px; background: #FFFBEB; font-size: 13px; line-height: 1.45; color: #92400E; white-space: pre-wrap; overflow-wrap: anywhere; }
        .tnd-det-note.is-cancel { background: rgb(var(--gray-100, 245 245 244)); color: ${body}; }
        .tnd-det-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        .tnd-det-foot p { margin: 0; font-size: 12.5px; color: ${mute}; }
        button.tnd-det-reject { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid #FECACA; border-radius: 8px;
            background: transparent; font-size: 13px; font-weight: 600; color: #DC2626; }
        button.tnd-det-reject:hover { background: #FEF2F2; }
        button.tnd-det-reject svg { width: 15px; height: 15px; }

        body.dark-mode .tnd-hero,
        body.dark-mode .tnd-tag,
        body.dark-mode .tnd-det-box,
        body.dark-mode .tnd-det-lines { background: var(--dk-card, #1F2A37); border-color: var(--dk-line, #374151); }
        body.dark-mode .tnd-link,
        body.dark-mode .tnd-det-qty,
        body.dark-mode .tnd-det-total,
        body.dark-mode .tnd-thumb,
        body.dark-mode .tnd-state.is-off,
        body.dark-mode .tnd-det-note.is-cancel { background: rgba(255, 255, 255, .06); border-color: var(--dk-line, #374151); }
        body.dark-mode .tnd-title,
        body.dark-mode .tnd-det-value,
        body.dark-mode .tnd-det-name,
        body.dark-mode .tnd-det-amount,
        body.dark-mode .tnd-det-qty,
        body.dark-mode .tnd-det-total { color: var(--dk-text, #F3F4F6); }
        body.dark-mode .tnd-msg,
        body.dark-mode .tnd-tag,
        body.dark-mode .tnd-state.is-off,
        body.dark-mode .tnd-det-note.is-cancel { color: #D1D5DB; }
        body.dark-mode .tnd-link { color: #93C5FD; }
        body.dark-mode .tnd-state.is-on { background: rgba(16, 185, 129, .15); color: #6EE7B7; }
        body.dark-mode .tnd-tag.is-warn,
        body.dark-mode .ord-kpi.is-alert { background: rgba(245, 158, 11, .12); border-color: rgba(245, 158, 11, .45); }
        body.dark-mode .tnd-tag.is-warn,
        body.dark-mode .ord-kpi.is-alert .ord-kpi-value { color: #FCD34D; }
        body.dark-mode .tnd-det-line { border-color: var(--dk-line, #374151); }
        body.dark-mode .tnd-det-note { background: rgba(245, 158, 11, .12); color: #FDE68A; }
        body.dark-mode .tnd-section { border-color: var(--dk-line, #374151); }
        body.dark-mode #tbStoreOrders tbody tr.ct3-hoverable:hover td,
        body.dark-mode #tbStoreProducts tbody tr.ct3-hoverable:hover td { background-color: var(--dk-row-hover, #334155) !important; }

        @media (prefers-reduced-motion: reduce) { .tnd-state.is-on .tnd-state-dot { animation: none; } }
    `;

    $('<style id="tnd-css">').text(css).appendTo('head');
}

// -- OnlineShop --

class OnlineShop extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'OnlineShop';
        this.tab          = 'orders';
        this.requests     = { store: 0, orders: 0, products: 0 };
        this.pageLength   = { orders: 15, products: 15 };
        this.saving       = false;
        this.terms        = { orders: '', products: '' };
        this.category     = '';
        this.shop         = null;
        this.counts       = {};
        this.wa           = {};

        // Una entrada por fila de la tabla de productos, en el orden en que llegaron (el índice de DataTables).
        this.productIds  = [];
        this.productCats = [];

        // Colores rápidos de la tienda. El primero es el azul de Huubie (el que queda si no se elige otro).
        this.colors = ['#233876', '#0F766E', '#7C3AED', '#BE185D', '#C2410C', '#B45309', '#15803D', '#1F2937'];

        // Filtro propio de DataTables: el buscador de cada pestaña y la categoría de productos.
        $.fn.dataTable.ext.search.push((settings, row, index) => {
            const table = settings.nTable.id;

            if (table === 'tbStoreOrders') return this.matches('orders', `${row[0]} ${row[1]}`);
            if (table !== 'tbStoreProducts') return true;
            if (this.category && this.productCats[index] !== this.category) return false;

            return this.matches('products', `${row[0]} ${row[1]}`);
        });
    }

    // -- Interface --

    init() {
        this.render();
    }

    render() {
        storeCSS();
        this.layout();
        this.header();

        if (dataInit.status != 200) return this.blocked(dataInit.message || 'No se pudo cargar la Tienda en línea. Recarga la página.');

        if (!this.allow('show')) return this.blocked('Tu rol no tiene permiso para ver la tienda en línea de esta sucursal.');

        this.loadStore(true);
    }

    // createLayout reemplaza a su padre: encabezado, resumen y cuerpo van en contenedores aparte.
    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:    `page${this.PROJECT_NAME}`,
                class: 'flex flex-1 flex-col gap-[16px]',
                container: [
                    { type: 'div', id: `header${this.PROJECT_NAME}`, class: 'w-full' },
                    { type: 'div', id: `summary${this.PROJECT_NAME}`, class: 'w-full' },
                    { type: 'div', id: `body${this.PROJECT_NAME}`, class: 'w-full flex flex-1 flex-col' }
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
                    { type: 'h1', class: 'cp-pagina-titulo', text: 'Tienda en línea' },
                    { type: 'p', class: 'cp-pagina-subtitulo', text: [scope.company, scope.branch].filter(Boolean).join(' · ') || 'Pedidos por enlace' }
                ]
            }
        });
    }

    // Botones del encabezado: cambian con la tienda abierta o cerrada.
    headerActions() {
        const parent = `headerActions${this.PROJECT_NAME}`;
        const open   = Number(this.shop.active) === 1;
        const json   = [
            { opc: 'button', id: 'btnStoreCopy', class: 'col-auto', text: 'Copiar enlace', icon: 'icon-link', color_btn: 'outline', onClick: () => this.copyLink() }
        ];

        if (this.allow('update')) {
            json.push({ opc: 'button', id: 'btnStoreConfig', class: 'col-auto', text: 'Configurar', icon: 'icon-cog', color_btn: 'outline', onClick: () => this.formStore() });
            json.push({ opc: 'button', id: 'btnStoreToggle', class: 'col-auto', text: open ? 'Cerrar tienda' : 'Abrir tienda', icon: 'icon-power', color_btn: open ? 'outline' : 'primary', onClick: () => this.toggleStore() });
        }

        $(`#${parent}`).empty();

        this.coffeeForm({
            parent:       parent,
            id:           'formHeaderStore',
            class:        'flex gap-[8px] flex-wrap',
            showRequired: false,
            json:         json
        });
    }

    // La tienda en una franja y sus cuatro cifras. Todo lo que viene de la base pasa por esc().
    summary() {
        const s      = this.shop;
        const c      = this.counts || {};
        const scope  = dataInit.scope || {};
        const open   = Number(s.active) === 1;
        const accent = /^#[0-9A-F]{6}$/i.test(s.accent || '') ? s.accent : (dataInit.accent || '#233876');
        const lead   = Number(s.lead_days) || 0;
        const tag    = (icon, text, cls = '') => `<span class="tnd-tag ${cls}"><i data-lucide="${icon}"></i>${esc(text)}</span>`;
        const tags   = [];

        if (Number(s.pickup))       tags.push(tag('store', 'Recoge en tienda'));
        if (Number(s.delivery))     tags.push(tag('truck', 'Envío a domicilio'));
        if (Number(s.pay_store))    tags.push(tag('wallet', 'Paga en tienda'));
        if (Number(s.pay_transfer)) tags.push(tag('landmark', 'Transferencia'));

        tags.push(tag('calendar-clock', lead === 0 ? 'Acepta pedidos para hoy' : (lead === 1 ? 'Con 1 día de anticipación' : `Con ${lead} días de anticipación`)));
        tags.push(s.whatsapp ? tag('message-circle', `WhatsApp ${this.phone(s.whatsapp)}`) : tag('message-circle', 'Sin WhatsApp de la sucursal', 'is-warn'));

        if (!Number(c.products)) tags.push(tag('package', 'Sin productos en la tienda', 'is-warn'));

        const kpi = (label, value, hint, alertOn) => `
            <div class="ord-kpi${alertOn ? ' is-alert' : ''}">
                <p class="ord-kpi-label">${esc(label)}</p>
                <p class="ord-kpi-value">${Number(value) || 0}</p>
                <p class="ord-kpi-hint">${esc(hint)}</p>
            </div>`;

        const pending = Number(c.pending) || 0;

        $(`#summary${this.PROJECT_NAME}`).html(`
            <div class="tnd-hero" style="--tnd-accent:${esc(accent)}">
                <div class="tnd-hero-main">
                    <span class="tnd-state ${open ? 'is-on' : 'is-off'}"><span class="tnd-state-dot" aria-hidden="true"></span>${open ? 'Abierta: recibe pedidos' : 'Cerrada: no recibe pedidos'}</span>
                    <h2 class="tnd-title">${esc(s.title || scope.company || scope.branch || 'Tienda en línea')}</h2>
                    ${s.message ? `<p class="tnd-msg">${esc(s.message)}</p>` : '<p class="tnd-msg is-empty">Sin mensaje de bienvenida.</p>'}
                    <div class="tnd-tags">${tags.join('')}</div>
                </div>
                <div class="tnd-hero-side">
                    <span class="tnd-label">Enlace para tus clientes</span>
                    <a class="tnd-link" href="${esc(s.link)}" target="_blank" rel="noopener"><i data-lucide="external-link"></i><span>${esc(s.link)}</span></a>
                    <span class="tnd-hint">${open ? 'Compártelo por WhatsApp, Instagram o Facebook.' : 'Puedes abrirlo para revisarlo: tus clientes verán «Tienda cerrada».'}</span>
                </div>
            </div>
            <div class="ord-kpis tnd-kpis">
                ${kpi('Por aceptar', pending, pending ? 'Revísalos en la bandeja de abajo' : 'Nada pendiente', pending > 0)}
                ${kpi('Recibidos hoy', c.today, 'Llegaron por el enlace hoy')}
                ${kpi('Aceptados', c.accepted, 'Ya están en Pedidos')}
                ${kpi('Productos en tienda', c.products, 'Los que ve el cliente')}
            </div>`);

        if (window.lucide) lucide.createIcons();
    }

    // El id empieza con «tabs»: así lo cubre el modo oscuro de dark-mode.css.
    tabs() {
        this.createLayout({
            parent: `body${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `card${this.PROJECT_NAME}`,
                class: 'ord-card flex-1',
                container: [
                    { type: 'div', id: `container${this.PROJECT_NAME}`, class: 'w-full' }
                ]
            }
        });

        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id:     'tabsStore',
            theme:  'light',
            type:   'button',
            json: [
                { id: 'stOrders', tab: 'Pedidos', lucideIcon: 'inbox', active: true, onClick: () => this.showTab('orders') },
                { id: 'stProducts', tab: 'Productos', lucideIcon: 'package', onClick: () => this.showTab('products') }
            ]
        });

        // Los filtros van fuera de la tabla: createCoffeeTable3 la reescribe y el buscador perdería el foco.
        this.createLayout({
            parent: 'container-stOrders',
            design: false,
            data: {
                id:    'listStoreOrders',
                class: 'w-full',
                container: [
                    { type: 'div', id: 'filterStoreOrders', class: 'w-full mb-[14px]' },
                    { type: 'div', id: 'tableStoreOrders', class: 'w-full' }
                ]
            }
        });

        this.createLayout({
            parent: 'container-stProducts',
            design: false,
            data: {
                id:    'listStoreProducts',
                class: 'w-full',
                container: [
                    { type: 'div', id: 'filterStoreProducts', class: 'w-full mb-[14px]' },
                    { type: 'div', id: 'tableStoreProducts', class: 'w-full' }
                ]
            }
        });
    }

    filterOrders() {
        this.createfilterBar({
            parent:     'filterStoreOrders',
            id:         'fbStoreOrders',
            prefijo:    'sto_',
            coffeesoft: true,
            data: [
                {
                    opc:      'select',
                    id:       'state',
                    lbl:      'Estado',
                    required: false,
                    class:    'col-6 col-md-4 col-lg-3 col-xl-2',
                    data:     [{ id: 'new', valor: 'Por aceptar' }, { id: 'accepted', valor: 'Aceptados' }, { id: 'cancelled', valor: 'Rechazados' }, { id: 'all', valor: 'Todos' }],
                    onchange: 'store.lsWebOrders()'
                },
                {
                    opc:      'select',
                    id:       'period',
                    lbl:      'Llegaron',
                    required: false,
                    class:    'col-6 col-md-4 col-lg-3 col-xl-2',
                    data:     [{ id: '30', valor: 'Últimos 30 días' }, { id: '7', valor: 'Últimos 7 días' }, { id: 'today', valor: 'Hoy' }, { id: 'all', valor: 'Todo' }],
                    onchange: 'store.lsWebOrders()'
                },
                {
                    opc:         'input',
                    id:          'q',
                    lbl:         'Buscar',
                    type:        'search',
                    placeholder: 'Folio, cliente o teléfono',
                    required:    false,
                    class:       'col-12 col-md-4 col-lg-4 col-xl-3'
                }
            ]
        });

        $('#sto_q')
            .attr({ maxlength: 60, autocomplete: 'off', 'aria-label': 'Buscar pedido' })
            .on('input', (e) => this.onSearchInput('orders', e));
    }

    filterProducts() {
        const data = [
            {
                opc:      'select',
                id:       'state',
                lbl:      'Estado',
                required: false,
                class:    'col-6 col-md-3 col-xl-2',
                data:     [{ id: 'all', valor: 'Todos' }, { id: 'on', valor: 'En la tienda' }, { id: 'off', valor: 'Fuera de la tienda' }],
                onchange: 'store.lsStoreProducts()'
            },
            {
                opc:      'select',
                id:       'category',
                lbl:      'Categoría',
                required: false,
                class:    'col-6 col-md-3 col-xl-2',
                data:     [{ id: '', valor: 'Todas' }],
                onchange: 'store.onCategory()'
            },
            {
                opc:         'input',
                id:          'q',
                lbl:         'Buscar',
                type:        'search',
                placeholder: 'Producto o descripción',
                required:    false,
                class:       'col-12 col-md-6 col-xl-4'
            }
        ];

        // Agregar y quitar en bloque actúa sobre lo que deja ver el filtro (todas las páginas); el aviso dice cuántos.
        // Anchos con col-N: la barra es una rejilla de 12 y col-auto ahí vale una sola columna (el texto se dobla).
        if (this.allow('update')) {
            data.push({ opc: 'button', id: 'btnStoreAddAll', class: 'col-12 col-sm-6 col-md-4 col-xl-2', text: 'Agregar todos', icon: 'icon-eye', color_btn: 'outline', onClick: () => this.bulkProducts(1) });
            data.push({ opc: 'button', id: 'btnStoreRemoveAll', class: 'col-12 col-sm-6 col-md-4 col-xl-2', text: 'Quitar todos', icon: 'icon-eye-off', color_btn: 'outline', onClick: () => this.bulkProducts(0) });
        }

        this.createfilterBar({
            parent:     'filterStoreProducts',
            id:         'fbStoreProducts',
            prefijo:    'stp_',
            coffeesoft: true,
            data:       data
        });

        $('#stp_q')
            .attr({ maxlength: 60, autocomplete: 'off', 'aria-label': 'Buscar producto' })
            .on('input', (e) => this.onSearchInput('products', e));
    }

    // tabLayout no corre el onClick de la pestaña activa al crearla: la primera lista se pide en loadStore().
    showTab(tab) {
        this.tab = tab;

        if (tab === 'orders') return this.lsWebOrders();

        this.lsStoreProducts();
    }

    blocked(message, text) {
        $(`#summary${this.PROJECT_NAME}`).empty();

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
                            { type: 'p', class: 'ord-aviso-texto', text: text || 'Si crees que es un error, pide acceso a quien administra Huubie.' }
                        ]
                    }
                ]
            }
        });
    }

    // -- Tienda --

    // La primera vez arma las pestañas; después solo repinta el encabezado y las cifras.
    async loadStore(first) {
        const request = ++this.requests.store;
        const data    = await useFetch({ url: this._link, data: { opc: 'getStore' } });

        if (request !== this.requests.store) return;

        if (!data || data.status != 200) {
            if (first) return this.blocked((data && data.message) || 'No se pudo abrir la tienda en línea. Recarga la página.');

            return this.fail(data, 'No se pudo actualizar la tienda');
        }

        this.shop   = data.store;
        this.counts = data.counts || {};

        if (!this.shop) return this.blocked('La tienda de esta sucursal todavía no se configura.', 'La crea quien tenga permiso de modificar la Tienda en línea, con solo abrir esta página.');

        this.headerActions();
        this.summary();

        if (!first) return;

        this.tabs();
        this.filterOrders();
        this.filterProducts();
        this.lsWebOrders();
    }

    formStore() {
        if (this.saving || !this.shop) return;

        const s       = this.shop;
        const scope   = dataInit.scope || {};
        const accent  = s.accent || dataInit.accent || '#233876';
        const section = (text, first) => `<p class="tnd-section${first ? ' is-first' : ''}">${text}</p>`;

        this.csModal({
            id:         'modalStoreConfig',
            title:      'Configurar tienda',
            subtitle:   scope.branch ? `Sucursal ${scope.branch}` : '',
            lucideIcon: 'settings',
            width:      'max-w-3xl',
            saveText:   'Guardar cambios',
            cancelText: 'Cancelar',
            action:     { text: 'Nuevo enlace', lucideIcon: 'refresh-cw', onClick: () => this.newLink() },
            json: [
                { id: 'ts_s1', tipo: 'html', class: 'w-full', html: section('Cómo se ve', true) },
                { id: 'ts_title', lbl: 'Nombre de la tienda', maxlength: 80, ph: scope.company || 'Ej. Pastelería Reginas', value: s.title, help: 'Vacío: sale el nombre de la empresa.', class: 'w-full sm:w-1/2' },
                { id: 'ts_whatsapp', lbl: 'WhatsApp de la sucursal', maxlength: 14, ph: '10 dígitos', value: s.whatsapp, help: 'El cliente te escribe aquí al terminar su pedido.', class: 'w-full sm:w-1/2' },
                { id: 'ts_message', lbl: 'Mensaje de bienvenida', tipo: 'textarea', rows: 2, maxlength: 255, ph: 'Ej. Pasteles por encargo. Pide con un día de anticipación.', value: s.message, class: 'w-full' },
                { id: 'ts_accent', lbl: 'Color de la tienda', tipo: 'color', ph: '#233876', value: accent, class: 'w-full sm:w-1/2' },
                { id: 'ts_swatches', tipo: 'html', class: 'w-full sm:w-1/2', html: this.swatchesHtml() },
                { id: 'ts_s2', tipo: 'html', class: 'w-full', html: section('Entrega') },
                { id: 'ts_pickup', lbl: 'Recoge en tienda', tipo: 'switch', value: Number(s.pickup) ? 1 : 0, class: 'w-full sm:w-1/2' },
                { id: 'ts_delivery', lbl: 'Envío a domicilio', tipo: 'switch', value: Number(s.delivery) ? 1 : 0, help: 'Pide la dirección. El costo del envío se acuerda por WhatsApp.', class: 'w-full sm:w-1/2' },
                { id: 'ts_lead_days', lbl: 'Días de anticipación', tipo: 'number', min: 0, max: 30, step: '1', value: Number(s.lead_days) || 0, help: '0 = acepta pedidos para el mismo día.', class: 'w-full sm:w-1/2' },
                { id: 'ts_s3', tipo: 'html', class: 'w-full', html: section('Pago') },
                { id: 'ts_pay_store', lbl: 'Paga en tienda', tipo: 'switch', value: Number(s.pay_store) ? 1 : 0, class: 'w-full sm:w-1/2' },
                { id: 'ts_pay_transfer', lbl: 'Transferencia', tipo: 'switch', value: Number(s.pay_transfer) ? 1 : 0, class: 'w-full sm:w-1/2' },
                { id: 'ts_bank_info', lbl: 'Datos para transferir', tipo: 'textarea', rows: 3, maxlength: 500, ph: 'Banco, titular y CLABE o número de tarjeta', value: s.bank_info, help: 'El cliente los ve al confirmar su pedido.', class: 'w-full' }
            ],
            onSave: (values, close) => this.saveStore(values, close)
        });

        const modal = $('#modalStoreConfig');

        // Un color rápido escribe en el campo; el evento input mueve la muestra y repinta.
        modal.on('click', '.loy-color', (e) => $('#ts_accent').val(String($(e.currentTarget).data('color')).toUpperCase()).trigger('input'));
        modal.on('input change', '#ts_accent, #ts_accent__pick', () => this.paintAccent());
        modal.on('change', '#ts_pay_transfer', () => this.paintBank());

        this.paintAccent();
        this.paintBank();
    }

    swatchesHtml() {
        const buttons = this.colors.map((color) => `<button type="button" class="loy-color" data-color="${color}" style="background-color:${color}" aria-label="Color ${color}" aria-pressed="false"></button>`).join('');

        return '<label class="block text-xs font-semibold text-gray-500 mb-1.5">Colores rápidos</label>'
             + `<div class="loy-colores">${buttons}</div>`
             + '<div class="tnd-accent-demo" aria-hidden="true"><span class="tnd-accent-btn">Agregar</span><span class="tnd-accent-chip">Pasteles</span></div>';
    }

    // Marca el color rápido elegido y pinta la muestra (botón y categoría como en la tienda).
    paintAccent() {
        const modal = $('#modalStoreConfig');
        const text  = String($('#ts_accent').val() || '').trim();
        const color = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(text) ? hex6(text).toUpperCase() : hex6($('#ts_accent__pick').val() || '#233876').toUpperCase();

        modal.find('.tnd-accent-demo')[0].style.setProperty('--tnd-accent', color);

        modal.find('.loy-color').each((i, el) => {
            const on = String($(el).data('color')).toUpperCase() === color;

            $(el).toggleClass('is-active', on).attr('aria-pressed', String(on));
        });
    }

    // Los datos de la cuenta solo importan con transferencia.
    paintBank() {
        const on = $('#ts_pay_transfer').is(':checked');

        $('#ts_bank_info').prop('disabled', false).closest('div').toggleClass('opacity-50', !on);
    }

    async saveStore(values, close) {
        if (this.saving) return;

        const whatsapp = String(values.ts_whatsapp || '').replace(/[\s\-().]/g, '');
        const accent   = String(values.ts_accent || '').trim();
        const lead     = String(values.ts_lead_days === undefined || values.ts_lead_days === null ? '' : values.ts_lead_days).trim();
        const bank     = String(values.ts_bank_info || '').trim();

        if (whatsapp && !/^\d{10}$/.test(whatsapp)) return this.warn('El WhatsApp de la sucursal va a 10 dígitos, sin lada de país.');
        if (accent && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(accent)) return this.warn('El color va como # y 6 letras o números, por ejemplo #233876.');
        if (!/^\d{1,2}$/.test(lead) || Number(lead) > 30) return this.warn('La anticipación va de 0 a 30 días.');
        if (!values.ts_pickup && !values.ts_delivery) return this.warn('Deja al menos una forma de entrega: recoger en tienda o envío a domicilio.');
        if (!values.ts_pay_store && !values.ts_pay_transfer) return this.warn('Deja al menos una forma de pago: en tienda o transferencia.');
        if (values.ts_pay_transfer && !bank) return this.warn('Con transferencia, escribe los datos de la cuenta: el cliente los ve al terminar su pedido.');

        this.saving = true;

        const button = $('#modalStoreConfig .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({
            url:  this._link,
            data: {
                opc:          'saveStore',
                title:        String(values.ts_title || '').trim(),
                message:      String(values.ts_message || '').trim(),
                whatsapp:     whatsapp,
                accent:       accent ? hex6(accent).toUpperCase() : '',
                bank_info:    bank,
                pickup:       values.ts_pickup ? '1' : '0',
                delivery:     values.ts_delivery ? '1' : '0',
                pay_transfer: values.ts_pay_transfer ? '1' : '0',
                pay_store:    values.ts_pay_store ? '1' : '0',
                lead_days:    lead
            }
        });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) return this.fail(data, 'No se guardó la tienda');

        close();
        alert({ icon: 'success', title: data.message, timer: 1400 });
        this.loadStore(false);
    }

    async toggleStore() {
        if (this.saving || !this.shop) return;

        const open = Number(this.shop.active) !== 1;
        const none = open && !Number(this.counts.products);
        const r    = await alert({
            icon:     open ? 'question' : 'warning',
            title:    open ? '¿Abrir la tienda?' : '¿Cerrar la tienda?',
            text:     open
                ? (none ? 'Todavía no hay productos en la tienda: el cliente verá la página vacía. Elígelos en la pestaña «Productos».' : 'El enlace empezará a recibir pedidos.')
                : 'Quien abra el enlace verá «Tienda cerrada». Los pedidos que ya llegaron no cambian.',
            btn1:     true,
            btn1Text: open ? 'Abrir tienda' : 'Cerrar tienda',
            btn2:     true,
            btn2Text: 'Cancelar'
        });

        if (!r || !r.isConfirmed || this.saving) return;

        this.saving = true;

        const res = await useFetch({ url: this._link, data: { opc: 'toggleStore', active: open ? '1' : '0' } });

        this.saving = false;

        if (!res || res.status != 200) return this.fail(res, 'No se cambió la tienda');

        alert({ icon: 'success', title: res.message, timer: 2200 });
        this.loadStore(false);
    }

    // Cambia el token: el enlace anterior deja de abrir la tienda.
    async newLink() {
        if (this.saving) return;

        const r = await alert({
            icon:     'warning',
            title:    '¿Cambiar el enlace?',
            text:     'El enlace de ahora dejará de abrir la tienda. Tendrás que compartir el nuevo.',
            btn1:     true,
            btn1Text: 'Cambiar enlace',
            btn2:     true,
            btn2Text: 'Cancelar'
        });

        if (!r || !r.isConfirmed || this.saving) return;

        this.saving = true;

        const res = await useFetch({ url: this._link, data: { opc: 'newStoreLink' } });

        this.saving = false;

        if (!res || res.status != 200) return this.fail(res, 'No se cambió el enlace');

        this.shop.link = res.link;
        this.summary();

        alert({ icon: 'success', title: res.message, timer: 2200 });
    }

    // Sin permiso del portapapeles (http fuera de localhost) copia a la antigua; si tampoco, muestra el enlace.
    async copyLink() {
        const link = this.shop && this.shop.link;

        if (!link) return;

        let done = false;

        try {
            await navigator.clipboard.writeText(link);
            done = true;
        } catch (e) {
            done = this.copyOld(link);
        }

        if (done) return alert({ icon: 'success', title: 'Enlace copiado', text: link, timer: 1800 });

        alert({ icon: 'info', title: 'Copia el enlace', text: link, btn1: true, btn1Text: 'Entendido' });
    }

    copyOld(text) {
        const area = $('<textarea readonly>').val(text).css({ position: 'fixed', top: 0, left: 0, opacity: 0 }).appendTo('body');

        try {
            area[0].select();

            return document.execCommand('copy');
        } catch (e) {
            return false;
        } finally {
            area.remove();
        }
    }

    // -- Productos --

    // keep = true conserva la página de la tabla (al prender o apagar uno).
    async lsStoreProducts(keep) {
        const request = ++this.requests.products;
        const table   = '#tbStoreProducts';
        const page    = keep && $.fn.DataTable.isDataTable(table) ? $(table).DataTable().page() : 0;

        $('#tableStoreProducts').addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'lsStoreProducts', state: $('#stp_state').val() || 'all' } });

        if (request !== this.requests.products) return;

        const loaded = Boolean(data && data.status == 200);
        const rows   = loaded && data.row ? data.row : [];

        if (!loaded) alert({ icon: 'error', title: 'No se pudo cargar la lista', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

        this.productIds  = rows.map((row) => Number(row.id));
        this.productCats = rows.map((row) => this.textOf(row['Categoría']));

        if (loaded) this.paintCategories(data.categories || []);

        $('#tableStoreProducts').removeClass('opacity-50');

        this.createCoffeeTable3({
            parent:  'tableStoreProducts',
            id:      'tbStoreProducts',
            theme:   'light',
            data:    loaded && data.row ? data : { thead: [], row: [] },
            striped: true,
            hover:   true,
            f_size:  13,
            center:  [3, 4],
            ...ORD_TABLE,
            ...this.emptyProducts(loaded)
        });

        if (!rows.length) return;

        this.dataTable('tbStoreProducts', 'products', 'productos', 'Ningún producto coincide con el filtro');

        if (page > 0) {
            const dt = $(table).DataTable();

            dt.page(Math.min(page, Math.max(dt.page.info().pages - 1, 0))).draw(false);
        }
    }

    // Las categorías del catálogo de la sucursal; la elegida se queda si sigue existiendo.
    paintCategories(list) {
        const select = $('#stp_category');
        const keep   = list.some((c) => c.id === this.category);

        select.empty().append(new Option('Todas', ''));
        list.forEach((c) => select.append(new Option(c.valor, c.id)));

        this.category = keep ? this.category : '';
        select.val(this.category).trigger('change.select2');
    }

    onCategory() {
        this.category = String($('#stp_category').val() || '');

        if ($.fn.DataTable.isDataTable('#tbStoreProducts')) $('#tbStoreProducts').DataTable().draw();
    }

    // Uno de la Matriz se confirma: el cambio es de todas las sucursales que lo comparten.
    async toggleProduct(id, on, shared) {
        if (this.saving) return;

        if (shared) {
            const r = await alert({
                icon:     'question',
                title:    on ? '¿Agregarlo a la tienda?' : '¿Quitarlo de la tienda?',
                text:     'Es un producto de la Matriz: el cambio aplica en la tienda de todas las sucursales que lo venden.',
                btn1:     true,
                btn1Text: on ? 'Agregar' : 'Quitar',
                btn2:     true,
                btn2Text: 'Cancelar'
            });

            if (!r || !r.isConfirmed) return;
        }

        this.setProducts([id], on, false);
    }

    async bulkProducts(on) {
        if (this.saving) return;

        if (!$.fn.DataTable.isDataTable('#tbStoreProducts')) return this.warn('No hay productos en la lista.');

        const indexes = $('#tbStoreProducts').DataTable().rows({ search: 'applied' }).indexes().toArray();
        const ids     = indexes.map((i) => this.productIds[i]).filter((id) => id > 0);
        const count   = ids.length;

        if (!count) return this.warn('Ningún producto coincide con el filtro.');
        if (count > 500) return this.warn('Son más de 500 productos: filtra por categoría o búsqueda y vuelve a intentar.');

        const what = count === 1 ? '1 producto' : `${count} productos`;
        const r    = await alert({
            icon:     'question',
            title:    on ? `¿Agregar ${what} a la tienda?` : `¿Quitar ${what} de la tienda?`,
            text:     'Son los que deja ver el filtro de ahora, en todas las páginas. Los de la Matriz cambian también en las demás sucursales.',
            btn1:     true,
            btn1Text: on ? 'Agregar' : 'Quitar',
            btn2:     true,
            btn2Text: 'Cancelar'
        });

        if (!r || !r.isConfirmed) return;

        this.setProducts(ids, on, true);
    }

    // Uno solo no avisa (la fila cambia sola y la tabla se queda en su página); en bloque sí.
    async setProducts(ids, on, notify) {
        if (this.saving) return;

        this.saving = true;

        const res = await useFetch({ url: this._link, data: { opc: 'setStoreProducts', ids: JSON.stringify(ids), on: on ? '1' : '0' } });

        this.saving = false;

        if (!res || res.status != 200) return this.fail(res, 'No se cambió el producto');

        if (notify) alert({ icon: 'success', title: res.message, timer: 1600 });

        this.lsStoreProducts(!notify);
        this.loadStore(false);
    }

    // -- Pedidos que llegan --

    async lsWebOrders() {
        const request = ++this.requests.orders;
        const state   = $('#sto_state').val() || 'new';

        // «Por aceptar» trae todos, sin importar cuándo llegaron.
        $('#sto_period').prop('disabled', state === 'new');
        $('#tableStoreOrders').addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'lsWebOrders', state: state, period: $('#sto_period').val() || '30' } });

        if (request !== this.requests.orders) return;

        const loaded = Boolean(data && data.status == 200);

        if (!loaded) alert({ icon: 'error', title: 'No se pudo cargar la bandeja', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

        this.wa = loaded && data.wa ? data.wa : {};

        $('#tableStoreOrders').removeClass('opacity-50');

        this.createCoffeeTable3({
            parent:  'tableStoreOrders',
            id:      'tbStoreOrders',
            theme:   'light',
            data:    loaded && data.row ? data : { thead: [], row: [] },
            striped: true,
            hover:   true,
            f_size:  13,
            center:  [5],
            ...ORD_TABLE,
            ...this.emptyOrders(loaded, state)
        });

        if (!loaded || !data.row || !data.row.length) return;

        this.dataTable('tbStoreOrders', 'orders', 'pedidos', 'Ningún pedido coincide con la búsqueda');
    }

    async viewOrder(id) {
        const data = await useFetch({ url: this._link, data: { opc: 'getWebOrder', id: id } });

        if (!data || data.status != 200 || !data.row) return this.fail(data, 'No se pudo abrir el pedido');

        const o     = data.row;
        const modal = this.csModal({
            id:         'modalStoreOrder',
            title:      `Pedido ${o.folio}`,
            subtitle:   `Llegó el ${o.created}`,
            lucideIcon: 'shopping-bag',
            width:      'max-w-2xl',
            action:     o.wa ? { text: 'WhatsApp', lucideIcon: 'message-circle', onClick: () => this.openUrl(o.wa) } : null,
            saveText:   o.can_accept ? 'Aceptar pedido' : false,
            cancelText: 'Cerrar',
            body:       this.orderBody(o),
            onSave:     (values, close) => {
                close();
                this.acceptOrder(o.id);
            }
        });

        $('#modalStoreOrder').on('click', '.tnd-det-reject', () => {
            modal.close();
            this.cancelOrder(o.id);
        });
    }

    // Lo que el cliente pidió, tal como lo escribió. Todo pasa por esc().
    orderBody(o) {
        const pills = {
            new:       '<span class="ord-pill bg-amber-50 text-amber-700">Por aceptar</span>',
            accepted:  '<span class="ord-pill bg-emerald-50 text-emerald-700">En Pedidos</span>',
            cancelled: o.rejected
                ? '<span class="ord-pill bg-rose-50 text-rose-700">Rechazado</span>'
                : '<span class="ord-pill bg-slate-100 text-slate-600">Cancelado en Pedidos</span>'
        };
        const hint = {
            new:       'Al aceptarlo pasa a Pedidos como cotización: ahí se cobra y se edita.',
            accepted:  'Ya está en Pedidos: cóbralo o edítalo desde ahí.',
            cancelled: o.rejected ? 'Rechazado: no pasó a Pedidos.' : 'Se aceptó y después se canceló en Pedidos.'
        };
        const box = (label, value, subs) => `
            <div class="tnd-det-box">
                <p class="tnd-det-label">${label}</p>
                <p class="tnd-det-value">${value}</p>
                ${subs.filter(Boolean).map((s) => `<p class="tnd-det-sub">${s}</p>`).join('')}
            </div>`;

        const lines = (o.lines || []).map((l) => {
            const qty = Number(l.quantity) || 0;

            return `
                <div class="tnd-det-line">
                    <span class="tnd-det-qty">${qty}×</span>
                    <div class="tnd-det-name">
                        <p>${esc(l.name)}</p>
                        ${l.details ? `<p class="tnd-det-sub">${esc(l.details)}</p>` : ''}
                        <p class="tnd-det-sub">${money(l.price)} c/u</p>
                    </div>
                    <span class="tnd-det-amount">${money(Number(l.price) * qty)}</span>
                </div>`;
        }).join('');

        const phone   = esc(this.phone(o.phone));
        const contact = o.wa ? `<a href="${esc(o.wa)}" target="_blank" rel="noopener">${phone}</a>` : phone;
        const reject  = o.can_cancel ? '<button type="button" class="tnd-det-reject"><i data-lucide="ban"></i>Rechazar pedido</button>' : '';

        return `
            <div class="tnd-det">
                <div class="tnd-det-head">
                    <p class="tnd-det-folio">${esc(hint[o.state] || '')}</p>
                    ${pills[o.state] || ''}
                </div>
                <div class="tnd-det-grid">
                    ${box('Cliente', esc(o.customer), [contact, o.email ? esc(o.email) : ''])}
                    ${box('Entrega', esc(o.delivery), [esc(`${o.date} · ${o.time}`), o.address ? esc(o.address) : ''])}
                    ${box('Pago', esc(o.payment), [Number(o.paid) > 0 ? `Abonado ${money(o.paid)}` : 'Sin abonos'])}
                </div>
                <div class="tnd-det-lines">
                    ${lines || '<div class="tnd-det-line"><p class="tnd-det-sub">Sin productos.</p></div>'}
                    <div class="tnd-det-total"><span>Total</span><span>${money(o.total)}</span></div>
                </div>
                ${o.note ? `<p class="tnd-det-note">${esc(o.note)}</p>` : ''}
                ${o.cancel_reason ? `<p class="tnd-det-note is-cancel">Motivo del rechazo: ${esc(o.cancel_reason)}</p>` : ''}
                ${reject ? `<div class="tnd-det-foot"><p>¿No se puede atender?</p>${reject}</div>` : ''}
            </div>`;
    }

    openWa(id) {
        const url = this.wa[id] || this.wa[String(id)];

        if (url) this.openUrl(url);
    }

    openUrl(url) {
        window.open(url, '_blank', 'noopener');
    }

    async acceptOrder(id) {
        if (this.saving) return;

        const r = await alert({
            icon:     'question',
            title:    `¿Aceptar el pedido P${id}?`,
            text:     'Pasa a Pedidos como cotización, en el turno abierto de hoy. Ahí se cobra y se edita como cualquier pedido.',
            btn1:     true,
            btn1Text: 'Aceptar pedido',
            btn2:     true,
            btn2Text: 'Cancelar'
        });

        if (!r || !r.isConfirmed) return;

        this.sendAccept(id);
    }

    // Sin turno abierto (423) ofrece abrirlo y, abierto, vuelve a intentar.
    async sendAccept(id) {
        if (this.saving) return;

        this.saving = true;

        const res = await useFetch({ url: this._link, data: { opc: 'acceptWebOrder', id: id } });

        this.saving = false;

        if (res && res.status == 423) return orderTurn.locked(res, () => this.sendAccept(id));

        if (!res || res.status != 200) return this.fail(res, 'No se aceptó el pedido');

        this.reload();
        this.notify(res, 'Avísale al cliente que su pedido quedó confirmado.');
    }

    cancelOrder(id) {
        if (this.saving) return;

        this.csModal({
            id:         'modalStoreCancel',
            title:      `Rechazar pedido P${id}`,
            subtitle:   'El pedido no pasa a Pedidos',
            lucideIcon: 'ban',
            width:      'max-w-lg',
            saveText:   'Rechazar pedido',
            cancelText: 'Volver',
            json: [
                { id: 'tc_reason', lbl: 'Motivo', tipo: 'textarea', rows: 3, maxlength: 200, required: true, ph: 'Ej. No tenemos ese pastel para la fecha que pides', help: 'Queda en la bitácora y va en el mensaje de WhatsApp al cliente.', class: 'w-full' }
            ],
            onSave: (values, close) => this.sendCancel(id, values, close)
        });
    }

    async sendCancel(id, values, close) {
        if (this.saving) return;

        const reason = String(values.tc_reason || '').trim().replace(/\s+/g, ' ');

        if (!reason) return this.warn('Escribe por qué no se puede atender el pedido.');

        this.saving = true;

        const button = $('#modalStoreCancel .cs-modal-save').prop('disabled', true);
        const res    = await useFetch({ url: this._link, data: { opc: 'cancelWebOrder', id: id, reason: reason } });

        this.saving = false;
        button.prop('disabled', false);

        if (!res || res.status != 200) return this.fail(res, 'No se rechazó el pedido');

        close();
        this.reload();
        this.notify(res, 'Avísale al cliente por qué no se puede atender.');
    }

    // Después de aceptar o rechazar: ofrece el WhatsApp con el mensaje ya escrito.
    async notify(res, text) {
        if (!res.wa) return alert({ icon: 'success', title: res.message, timer: 1800 });

        const r = await alert({
            icon:     'success',
            title:    res.message,
            text:     text,
            btn1:     true,
            btn1Text: 'Avisar por WhatsApp',
            btn2:     true,
            btn2Text: 'Ahora no'
        });

        if (r && r.isConfirmed) this.openUrl(res.wa);
    }

    // -- Complements --

    onBranchChange() {
        location.reload();
    }

    // Cifras arriba y la lista de la pestaña abierta.
    reload() {
        this.loadStore(false);
        this.lsOrders();
    }

    dataTable(id, key, noun, zero) {
        $(`#${id}`).DataTable({
            dom:          '<"ord-dt-top"l><"ord-dt-scroll"t><"ord-dt-foot"ip>',
            pageLength:   this.pageLength[key],
            lengthMenu:   [10, 15, 25, 50],
            ordering:     false,
            searching:    true,
            lengthChange: true,
            destroy:      true,
            autoWidth:    false,
            language: {
                lengthMenu:   'Mostrar _MENU_ registros por página',
                info:         `Mostrando _START_ a _END_ de _TOTAL_ ${noun}`,
                infoEmpty:    `Sin ${noun}`,
                infoFiltered: '(de _MAX_ en total)',
                emptyTable:   `Sin ${noun}`,
                zeroRecords:  zero,
                paginate:     { first: 'Primera', last: 'Última', next: '›', previous: '‹' }
            },
            drawCallback: () => {
                if (window.lucide) lucide.createIcons();
            }
        }).on('length.dt', (e, settings, len) => { this.pageLength[key] = len; });
    }

    onSearchInput(key, e) {
        const table = key === 'orders' ? '#tbStoreOrders' : '#tbStoreProducts';

        this.terms[key] = this.plain(e.target.value.trim());

        if ($.fn.DataTable.isDataTable(table)) $(table).DataTable().draw();
    }

    // Sin acentos ni mayúsculas.
    matches(key, cells) {
        const term = this.terms[key];

        if (!term) return true;

        return this.plain(String(cells || '').replace(/<[^>]*>/g, ' ')).includes(term);
    }

    plain(text) {
        return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }

    // El texto de una celda (viene escapada): DOMParser no ejecuta ni carga nada.
    textOf(html) {
        return new DOMParser().parseFromString(String(html || ''), 'text/html').documentElement.textContent.trim();
    }

    // 9931234567 → 993 123 4567.
    phone(text) {
        const digits = String(text || '').replace(/\D/g, '');

        return digits.length === 10 ? digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3') : String(text || '');
    }

    // Permisos de la sección Tienda en línea.
    allow(action) {
        return (dataInit.store || []).includes(action);
    }

    // Permisos de Pedidos: los piden el detalle, el turno y el cobro.
    can(action) {
        return (dataInit.actions || []).includes(action);
    }

    lsOrders() {
        if (this.tab === 'products') return this.lsStoreProducts(true);

        this.lsWebOrders();
    }

    // Esta página no pinta el chip del turno.
    paintTurn() {}

    emptyOrders(loaded, state) {
        if (!loaded) return { emptyMessage: 'No se pudo cargar la bandeja de pedidos', emptyIcon: 'icon-attention' };

        if (state === 'new') return { emptyMessage: 'No hay pedidos por aceptar. Comparte el enlace para recibirlos', emptyIcon: 'icon-basket' };

        return { emptyMessage: 'No hay pedidos con este filtro', emptyIcon: 'icon-basket' };
    }

    emptyProducts(loaded) {
        if (!loaded) return { emptyMessage: 'No se pudo cargar la lista de productos', emptyIcon: 'icon-attention' };

        return { emptyMessage: 'No hay productos con este filtro', emptyIcon: 'icon-tags' };
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
