// POS + Pedidos (Huubie PRO) · vistas: shell de pro (rail, navbar, modo oscuro), navegación entre vistas,
// teclado (F2–F9, Ctrl+K, Esc), vistas Inicio, Clientes y Reportes, refresco general y arranque.
// Se carga al último: usa data, venta, cobro, caja y ventas.

// -- Swal que bloquea --
// Un toast no bloquea el teclado; un Swal de verdad sí (cobro.js lo usa para el Enter)
const swalBlocking = () => !!(window.Swal && Swal.isVisible() && !Swal.getPopup()?.classList.contains('swal2-toast'));

// -- Vistas (cada botón del rail enseña una sección y la vuelve a pintar) --
const VIEW_RENDER = {
    inicio: () => renderInicio(),
    vender: () => { renderCategories(); renderProducts(); renderTicket(); },
    pedidos: () => renderBoard(),
    ventas: () => renderHistList(),
    caja: () => renderCaja(),
    clientes: () => renderClientes(),
    reportes: () => renderReportes(),
};
function setView(name) {
    if (!VIEW_RENDER[name]) name = 'vender';
    S.view = name;
    document.querySelectorAll('.po-view').forEach(v => { const on = v.id === `view-${name}`; v.classList.toggle('hidden', !on); v.classList.toggle('flex', on); });
    document.querySelectorAll('.menu-rail-item[data-view]').forEach(b => {
        const on = b.dataset.view === name;
        b.classList.toggle('is-active', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (name !== 'vender') document.body.classList.remove('ticket-open');
    try { localStorage.setItem(LS_VIEW, name); } catch (e) { /* sin almacenamiento */ }
    if (!isDesktop()) closeSidebar();
    closeDropdowns();
    VIEW_RENDER[name]();
    icons();
}
// Tickets que editaban una venta que ya no se puede tocar (cobrada, entregada, cancelada): vuelven a ser tickets limpios
function dropStaleEdits() {
    S.tickets.filter(t => t.editing_sale_id).forEach(t => { const s = saleById(t.editing_sale_id); if (!s || !canEdit(s)) resetTicket(t, false); });
}
// Después de cobrar, cancelar, abonar, entregar o mover caja
function refreshViews() {
    dropStaleEdits();
    renderTicket(); renderTurnHeader(); renderBadgePedidos();
    if (S.view !== 'vender') VIEW_RENDER[S.view]();
    icons();
}
// Móvil: el ticket se abre encima del catálogo
function toggleTicketPanel(open = !document.body.classList.contains('ticket-open')) {
    document.body.classList.toggle('ticket-open', open);
    if (open) icons();
}

// -- Menú lateral: réplica de pro/auth/src/js/sidebar.js (mismas claves, sin fetch) --
const LS_SIDEBAR = 'huubie:pro:sidebar-hidden';   // 'true' | 'false', igual que pro
const isDesktop = () => window.innerWidth >= 1024;
function syncMenuButton() {
    const b = $id('btn-menu'); if (!b) return;
    const desk = isDesktop(), shown = desk ? !document.body.classList.contains('sidebar-hidden') : $id('menu-sidebar').classList.contains('sidebar-open');
    b.title = desk ? (shown ? 'Ocultar menú' : 'Mostrar menú') : 'Menú';
    b.setAttribute('aria-expanded', shown ? 'true' : 'false');
}
function toggleSidebar() {
    if (isDesktop()) {
        const hidden = document.body.classList.toggle('sidebar-hidden');
        try { localStorage.setItem(LS_SIDEBAR, hidden ? 'true' : 'false'); } catch (e) { /* sin almacenamiento */ }
        setTimeout(() => window.dispatchEvent(new Event('resize')), 320);   // como pro: lo que mide su ancho se reacomoda
    } else {
        const open = $id('menu-sidebar').classList.toggle('sidebar-open');
        $id('sidebar-overlay').classList.toggle('hidden', !open);
    }
    syncMenuButton();
}
function closeSidebar() {
    $id('menu-sidebar')?.classList.remove('sidebar-open');
    $id('sidebar-overlay')?.classList.add('hidden');
    syncMenuButton();
}
function loadSidebarState() {
    let hidden = false;
    try { hidden = localStorage.getItem(LS_SIDEBAR) === 'true'; } catch (e) { /* sin almacenamiento */ }
    document.body.classList.toggle('sidebar-hidden', hidden);
    syncMenuButton();
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('sidebar-animated')));   // sin animación al cargar
}
window.addEventListener('resize', () => { if (isDesktop()) closeSidebar(); else syncMenuButton(); });

// -- Modo oscuro: mismas claves que pro ('huubie:pro:dark' y la paleta de tailwind-theme.js) --
const LS_DARK = 'huubie:pro:dark';
const isDark = () => document.body.classList.contains('dark-mode');
// La paleta guarda el esquema: si no se actualiza, tailwind-theme.js deshace el cambio al recargar
function setDark(dark) {
    const P = window.InventoryPalette;
    let p = null;
    try { p = JSON.parse(localStorage.getItem('huubie:pro:palette') || 'null'); } catch (e) { /* sin almacenamiento */ }
    p = Object.assign({ accent: '#C05A40', primary: '#292524' }, p || {});
    p.scheme = dark ? 'huubie' : 'light';
    if (P && typeof P.apply === 'function') {
        try { P.apply(p); if (typeof P.save === 'function') P.save(p); } catch (e) { /* tema sin paleta */ }
    }
    document.body.classList.toggle('dark-mode', dark);
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem(LS_DARK, dark ? 'true' : 'false'); } catch (e) { /* sin almacenamiento */ }
}
function syncDarkButton() {
    const b = $id('btnDark'); if (!b) return;
    const d = isDark();
    b.title = d ? 'Modo claro' : 'Modo oscuro';
    b.setAttribute('aria-pressed', d ? 'true' : 'false');
    b.innerHTML = `<i data-lucide="${d ? 'sun' : 'moon'}" class="w-[18px] h-[18px]"></i>`;
    icons();
}
function toggleDark() { setDark(!isDark()); syncDarkButton(); }
// Al cargar solo se lee la clave: no se re-aplica la paleta (no pisa un esquema 'midnight')
function loadDarkMode() {
    let d = false;
    try { d = localStorage.getItem(LS_DARK) === 'true'; } catch (e) { /* sin almacenamiento */ }
    document.body.classList.toggle('dark-mode', d);
    document.documentElement.classList.toggle('dark', d);
    syncDarkButton();
}

// -- Menús desplegables (Caja en la barra) --
function toggleDropdown(id, e) {
    e?.stopPropagation();
    const dd = $id(id), open = !dd.classList.contains('open');
    closeDropdowns();
    dd.classList.toggle('open', open);
    document.querySelector(`[data-dd="${id}"]`)?.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) icons();
}
function closeDropdowns() {
    document.querySelectorAll('.po-dd.open').forEach(d => d.classList.remove('open'));
    document.querySelectorAll('[data-dd][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}
// Un clic fuera del menú o en una de sus opciones lo cierra
document.addEventListener('click', e => {
    if (!e.target.closest?.('.po-dd') || e.target.closest('.po-dd-item')) closeDropdowns();
});

// -- Teclado (CoffeePOS: F2 pagar · F3 elimina · F5 desc. producto · F6 precios · F8 cliente · F9 descto. general · pulpos: Ctrl+K) --
// Enter del cobro, flechas de los buscadores y teclas del PIN viven en su propio archivo
const MODAL_CLOSE = { modalCobro: () => cobroEsc(), modalPin: () => closePin() };
const FKEYS = {
    F2: () => openCobroModal(),
    F3: () => removeLastItem(),
    F5: () => discountLastLine(),
    F6: () => openPreciosModal(),
    F8: () => focusCustomer(),
    F9: () => openDiscountModal('cuenta'),
};
const FKEYS_SELL = ['F2', 'F3', 'F5', 'F9'];   // trabajan sobre el ticket: primero llevan a Vender
document.addEventListener('keydown', e => {
    const modal = topModal();
    if (FKEYS[e.key]) {
        e.preventDefault();   // F5 recargaría la página y F6 enfoca la barra del navegador
        if (modal || swalBlocking() || e.repeat) return;
        if (FKEYS_SELL.includes(e.key) && S.view !== 'vender') setView('vender');
        FKEYS[e.key]();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key || '').toLowerCase() === 'k') {
        e.preventDefault();
        if (!modal && !swalBlocking()) focusFinder();
        return;
    }
    if (e.key !== 'Escape' || S.pin || swalBlocking() || e.defaultPrevented) return;
    if (modal) {
        e.preventDefault();
        (MODAL_CLOSE[modal.id] || (() => closeModal(modal.id)))();
        return;
    }
    if (e.target.closest?.('input, textarea, select')) return;
    closeDropdowns();
    if (!isDesktop()) closeSidebar();
    document.body.classList.remove('ticket-open');
});

// -- Inicio: el día de un vistazo (tareas, accesos rápidos y próximos pedidos) --
// Por cobrar = ventas con saldo + cuentas con saldo sin venta (la misma cuenta que el historial)
const owedTotal = () => round2(sum(DB.sale.filter(s => saleDue(s) > 0), saleDue) + sum(DB.customer, c => Math.max(0, accountDebt(c.id))));
const pendingOrders = () => DB.sale.filter(s => s.sale_type_id === 1 && [2, 3].includes(s.sale_status_id) && s.delivery_status !== 1);
const deliveryKey = s => `${s.delivery_date || TODAY}${s.delivery_time || '99:99'}`;

// Anillo de avance: circunferencia de r 15.5 = 97.4
function ringSvg(pct, label = `${pct}%`) {
    const c = 97.4, off = (c * (1 - Math.min(100, pct) / 100)).toFixed(1);
    return `<div class="relative w-16 h-16 shrink-0">
        <svg viewBox="0 0 36 36" class="w-16 h-16 -rotate-90" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke-width="3.5" class="po-ring-bg"></circle>
            ${pct > 0 ? `<circle cx="18" cy="18" r="15.5" fill="none" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" class="po-ring-fg"></circle>` : ''}
        </svg>
        <span class="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-gray-900">${label}</span></div>`;
}
const taskRow = (icon, tone, title, sub, action = '', done = false) => `<div class="flex items-center gap-2.5 py-2 border-t border-gray-100 first:border-t-0">
    <span class="po-m-ico sm ${done ? 't-green' : tone}"><i data-lucide="${done ? 'circle-check' : icon}"></i></span>
    <div class="min-w-0 flex-1"><div class="text-[13px] font-semibold text-gray-900 truncate">${title}</div>
        <div class="text-[11px] truncate ${done ? 'text-emerald-600' : 'text-gray-500'}">${sub}</div></div>${action}</div>`;
const taskBtn = (label, fn) => `<button type="button" class="po-btn po-btn-ghost sm shrink-0" onclick="${fn}">${label}</button>`;
const quickTile = (icon, label, fn, key = '') => `<button type="button" class="po-tile" onclick="${fn}"><i data-lucide="${icon}"></i><span>${label}</span>${key ? `<span class="po-kbd">${key}</span>` : ''}</button>`;

function upcomingRow(s) {
    const c = customer(s.customer_id), late = s.delivery_date && s.delivery_date < TODAY, due = saleDue(s);
    const [dTxt, dTone] = late ? ['Atrasado', 't-red'] : DELIVERY_TXT[s.delivery_status] || DELIVERY_TXT[0];
    const when = s.delivery_date === TODAY ? 'Hoy' : s.delivery_date === addDays(TODAY, 1) ? 'Mañana' : s.delivery_date ? `${dayName(s.delivery_date)} ${fmtDate(s.delivery_date)}` : 'Sin fecha';
    return `<button type="button" class="row-sale w-full text-left px-3 py-2" onclick="openHistorial('pedidos', null, ${s.id})">
        <div class="flex items-center gap-1.5 min-w-0"><b class="text-[13px] text-gray-900">#${esc(s.folio)}</b><span class="po-chip ${dTone}">${dTxt}</span>
            <span class="ml-auto text-[12px] font-semibold whitespace-nowrap ${late ? 'text-rose-600' : 'text-gray-700'}">${when}${s.delivery_time ? ' · ' + esc(s.delivery_time) : ''}</span></div>
        <div class="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500"><span class="truncate">${esc(c?.name || '—')} · ${saleLines(s.id).length} partida(s)</span>
            ${due > 0 ? `<span class="ml-auto font-semibold text-orange-600 whitespace-nowrap">Saldo ${fmt(due)}</span>` : ''}</div></button>`;
}

function renderInicio() {
    const el = $id('inicioWrap'); if (!el) return;
    const tu = openTurn(), st = dayState(), k = tu ? turnStats(tu.id) : null;
    const hr = new Date().getHours(), hello = hr < 12 ? 'Buenos días' : hr < 19 ? 'Buenas tardes' : 'Buenas noches';
    const today = DB.sale.filter(s => (s.created_at || '').slice(0, 10) === TODAY && [2, 3].includes(s.sale_status_id)), sold = round2(sum(today, s => s.total));
    const pend = pendingOrders(), dueNow = pend.filter(s => (s.delivery_date || TODAY) <= TODAY), late = dueNow.filter(s => s.delivery_date && s.delivery_date < TODAY);
    const toMake = dueNow.filter(s => s.delivery_status === 2), ready = dueNow.filter(s => s.delivery_status === 0);
    const delivered = DB.sale.filter(s => s.sale_type_id === 1 && [2, 3].includes(s.sale_status_id) && s.delivery_status === 1 && (deliveredAt(s) || '').slice(0, 10) === TODAY).length;
    const owed = owedTotal(), owedCount = DB.sale.filter(s => saleDue(s) > 0).length + DB.customer.filter(c => accountDebt(c.id) > 0).length;
    const quotes = DB.sale.filter(s => s.sale_status_id === 1).length;
    const [chipTxt, chipTone] = tu ? ['Turno abierto', 't-green'] : st === 'cerrado' ? ['Día cerrado', 't-purple'] : st === 'reabierto' ? ['Día reabierto', 't-amber'] : ['Sin turno', 't-red'];

    const head = viewHead(`${hello}, ${esc(DB.user.name.split(' ')[0])}`, `${dayName(TODAY)} ${fmtDate(TODAY)} · ${esc(DB.company.name)} · ${esc(DB.branch.name)}`,
        actBtn('cake', 'Nuevo pedido', 'newPedido()') + actBtn('shopping-cart', 'Nueva venta', "setView('vender')", 'po-btn-brand'),
        `<span class="po-chip ${chipTone}">${chipTxt}</span>`);
    const kpis = '<div class="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-3">'
        + kpiTile('Vendido hoy', fmt(sold), 'text-gray-900', `${today.length} venta(s) y pedido(s)`)
        + kpiTile('Ticket promedio', today.length ? fmt(sold / today.length) : '—')
        + kpiTile('Pedidos por entregar', dueNow.length, late.length ? 'text-rose-600' : 'text-gray-900', late.length ? `${late.length} atrasado(s)` : 'con fecha de hoy')
        + kpiTile('Por cobrar', fmt(owed), owed > 0 ? 'text-orange-600' : 'text-gray-900', `${owedCount} cuenta(s)`)
        + kpiTile('Turno', tu ? `Turno ${esc(tu.folio)}` : chipTxt, tu ? 'text-emerald-600' : 'text-gray-900',
            tu ? `Efectivo esperado ${fmt(k.expected)}` : st === 'cerrado' ? 'Reabre el día para vender' : 'Abre un turno para cobrar')
        + '</div>';

    // Entregas de hoy: entregados hoy contra lo que vence hoy o ya venció
    const total = delivered + dueNow.length, pct = total ? Math.round(delivered / total * 100) : 0;
    const ring = `<div class="flex items-center gap-3 pb-3 mb-1 border-b border-gray-100">${ringSvg(pct, total ? `${pct}%` : '—')}
        <div class="min-w-0"><div class="text-[13px] font-semibold text-gray-900">Entregas de hoy</div>
            <div class="text-[12px] text-gray-500">${total ? `${delivered} de ${total} pedido(s) entregado(s)` : 'No hay pedidos para hoy'}</div>
            ${late.length ? `<div class="text-[11px] font-semibold text-rose-600 mt-0.5">Incluye ${late.length} atrasado(s)</div>` : ''}</div></div>`;
    const tasks = [
        tu ? taskRow('wallet', 't-green', `Turno ${esc(tu.folio)} abierto`, `${esc(userName(tu.user_id))} · desde ${hourOf(tu.opened_at)} · esperado ${fmt(k.expected)}`, taskBtn('Corte X', "openCorte('x')"))
            : st === 'cerrado' ? taskRow('lock', 't-purple', 'Día cerrado', 'Reábrelo desde el cierre para volver a vender', taskBtn('Ver cierre', 'openCierreModal()'))
            : taskRow('door-open', 't-red', 'Abre el turno', 'Sin turno abierto no se puede cobrar', taskBtn('Abrir', 'openAbrirTurno()')),
        taskRow('chef-hat', 't-amber', 'Por producir', toMake.length ? `${toMake.length} pedido(s) de hoy o atrasados` : 'Al día', toMake.length ? taskBtn('Ver', "openPedidosBoard('hoy')") : '', !toMake.length),
        taskRow('package-check', 't-sky', 'Listos para entregar', ready.length ? `${ready.length} esperan al cliente` : 'Al día', ready.length ? taskBtn('Ver', "openPedidosBoard('hoy')") : '', !ready.length),
        late.length ? taskRow('triangle-alert', 't-red', 'Atrasados', `${late.length} pedido(s) con fecha vencida`, taskBtn('Ver', "openPedidosBoard('hoy')")) : '',
        taskRow('hand-coins', 't-orange', 'Por cobrar', owed > 0 ? `${owedCount} cuenta(s) · ${fmt(owed)}` : 'Al día', owed > 0 ? taskBtn('Cobrar', "openHistorial('cobrar')") : '', !(owed > 0)),
        taskRow('file-text', 't-purple', 'Cotizaciones', quotes ? `${quotes} sin convertir en venta` : 'Al día', quotes ? taskBtn('Ver', "openHistorial('cotizaciones')") : '', !quotes),
        taskRow('calendar-check', 't-blue', 'Cierre del día', st === 'cerrado' ? 'Hecho' : tu ? 'Primero cierra el turno con el corte Z' : 'Cuando termine el último turno',
            taskBtn(st === 'cerrado' ? 'Ver' : 'Cerrar día', 'openCierreModal()'), st === 'cerrado'),
    ].join('');

    const quick = '<div class="grid grid-cols-3 gap-2">'
        + quickTile('shopping-cart', 'Nueva venta', "setView('vender')")
        + quickTile('cake', 'Nuevo pedido', 'newPedido()')
        + quickTile('hand-coins', 'Cobrar saldo', "openHistorial('cobrar')")
        + quickTile('arrow-right-left', 'Retiro / depósito', "openMovCaja('out')")
        + quickTile('receipt-text', 'Corte X', "openCorte('x')")
        + quickTile('tag', 'Precios', 'openPreciosModal()', 'F6')
        + '</div>';
    const next = pend.slice().sort((a, b) => deliveryKey(a).localeCompare(deliveryKey(b))).slice(0, 5);
    const upcoming = next.length ? `<div class="rounded-lg border border-gray-200 overflow-hidden">${next.map(upcomingRow).join('')}</div>`
        : emptyBox('calendar-check', 'Sin pedidos pendientes', 'Los pedidos por entregar aparecen aquí.', actBtn('cake', 'Nuevo pedido', 'newPedido()'));

    el.innerHTML = head + kpis + `<div class="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-3 items-start">
        ${panel('Tareas de hoy', 'list-checks', ring + `<div>${tasks}</div>`)}
        <div class="space-y-3 min-w-0">
            ${panel('Accesos rápidos', 'layout-grid', quick)}
            ${panel('Próximos pedidos', 'calendar-clock', upcoming, `<button type="button" class="text-[12px] font-semibold text-blue-600 hover:underline shrink-0" onclick="openPedidosBoard('todos')">Ver tablero</button>`)}
        </div></div>`;
    icons();
}

// -- Clientes: cuenta, monedero, tarjeta de lealtad y crédito (customer + card + card_type + receivable) --
const AVATAR_TONES = ['#C05A40', '#0f766e', '#6d28d9', '#b45309', '#0369a1', '#be185d', '#4d7c0f'];
const avatarTone = id => AVATAR_TONES[Number(id) % AVATAR_TONES.length];
// Lo que debe un cliente: sus ventas con saldo + su saldo de cuenta sin venta (igual que «Por cobrar»)
const clientOwed = id => round2(sum(DB.sale.filter(s => s.customer_id === id && saleDue(s) > 0), saleDue) + Math.max(0, accountDebt(id)));
function clientStats(id) {
    const ss = DB.sale.filter(s => s.customer_id === id && [2, 3].includes(s.sale_status_id));
    return { count: ss.length, total: round2(sum(ss, s => s.total)), last: ss.map(s => s.created_at || '').sort().pop() || '' };
}
// «Ver cuenta» abre la pestaña donde el cliente sí tiene movimientos
function clientTab(id, owed) {
    if (owed > 0) return 'cobrar';
    const mine = DB.sale.filter(s => s.customer_id === id);
    return mine.some(s => s.sale_status_id !== 1 && s.sale_type_id !== 1) ? 'ventas' : mine.some(s => s.sale_status_id !== 1) ? 'pedidos' : mine.length ? 'cotizaciones' : 'ventas';
}
const clientMini = (lbl, val) => `<div class="bg-gray-50 rounded-lg px-1.5 py-1.5 min-w-0"><div class="text-[10px] text-gray-500">${lbl}</div><div class="text-[12px] font-semibold text-gray-900 truncate">${val}</div></div>`;

function setClientesSearch(v) { S.clientes.search = v; renderClientes(); }
// El modal de cliente toma nombre o teléfono de #inputCustomer: se le presta lo buscado aquí
function newCustomerFromList() {
    const inp = $id('inputCustomer'), prev = inp.value;
    inp.value = S.clientes.search.trim();
    openCustomerModal();
    inp.value = prev;
}
function newSaleFor(id) {
    setView('vender');
    const t = T();
    if (t.items.length || t.customer_id || t.editing_sale_id) newTicket();
    pickCustomer(id);
}
// Un solo saldo: se abona directo. Varios: se abren en «Por cobrar» filtrados por el cliente
function abonarCliente(id) {
    const sales = DB.sale.filter(s => s.customer_id === id && saleDue(s) > 0), acc = accountDebt(id);
    if (!sales.length && acc > 0) return openAbono({ customerId: id });
    if (sales.length === 1 && !(acc > 0)) return openAbono(sales[0].id);
    openHistorial('cobrar', id);
}

function clientCard(c) {
    const st = clientStats(c.id), owed = clientOwed(c.id), card = cardOf(c.id), ct = card ? cardTypeOf(card) : null;
    const chips = (c.wallet > 0 ? `<span class="po-chip t-purple"><i data-lucide="piggy-bank"></i>Monedero ${fmt(c.wallet)}</span>` : '')
        + (card ? `<span class="po-chip t-blue"><i data-lucide="id-card"></i>${esc(ct?.name || 'Tarjeta')} · ${esc(card.number)}</span>` : '')
        + (c.credit_enabled ? `<span class="po-chip t-sky"><i data-lucide="landmark"></i>Crédito ${fmt(creditAvailable(c.id))} de ${fmt(c.credit_limit)}</span>` : '');
    return `<div class="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-2.5 min-w-0">
        <div class="flex items-center gap-2.5 min-w-0">
            <span class="po-avatar" style="background:${avatarTone(c.id)}">${esc(initials(c.name))}</span>
            <div class="min-w-0 flex-1"><div class="text-[13px] font-semibold text-gray-900 truncate">${esc(c.name)}</div>
                <div class="text-[11px] text-gray-500 truncate">${esc([c.phone, c.email].filter(Boolean).join(' · ') || 'Sin teléfono ni correo')}</div></div>
            ${owed > 0 ? `<span class="po-chip t-orange shrink-0">Debe ${fmt(owed)}</span>` : ''}
        </div>
        <div class="grid grid-cols-3 gap-1.5 text-center">${clientMini('Compras', st.count)}${clientMini('Total', fmtShort(st.total))}${clientMini('Última', st.last ? fmtDate(st.last) : '—')}</div>
        ${chips ? `<div class="flex flex-wrap gap-1">${chips}</div>` : ''}
        <div class="flex gap-1.5 mt-auto">
            ${detBtn('po-btn-ghost flex-1', 'eye', 'Ver cuenta', `openHistorial('${clientTab(c.id, owed)}', ${c.id})`)}
            ${detBtn('po-btn-ghost flex-1', 'shopping-cart', 'Vender', `newSaleFor(${c.id})`)}
            ${owed > 0 ? detBtn('po-btn-main flex-1', 'hand-coins', 'Abonar', `abonarCliente(${c.id})`) : ''}
        </div></div>`;
}

function renderClientes() {
    const list = $id('clientesList'); if (!list) return;
    const all = DB.customer.filter(c => !isPublic(c.id) && c.active !== 0), q = norm(S.clientes.search.trim());
    const rows = all.filter(c => !q || [c.name, c.phone, c.email, cardOf(c.id)?.number].some(v => norm(v).includes(q)));
    const owing = all.filter(c => clientOwed(c.id) > 0);
    const chips = `<span class="po-chip t-gray">${all.length} cliente(s)</span>`
        + (owing.length ? `<button type="button" class="po-chip t-orange" onclick="openHistorial('cobrar')"><i data-lucide="hand-coins"></i>${owing.length} con saldo · ${fmt(sum(owing, c => clientOwed(c.id)))}</button>` : '');
    $id('clientesHead').innerHTML = viewHead('Clientes', 'Cuentas, monedero, tarjeta de lealtad y crédito', actBtn('user-plus', 'Nuevo cliente', 'newCustomerFromList()', 'po-btn-brand'), chips);
    list.innerHTML = rows.length ? `<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">${rows.map(clientCard).join('')}</div>`
        : emptyBox('users', q ? 'Sin coincidencias' : 'Aún no hay clientes', q ? 'Prueba con otro nombre, teléfono, correo o número de tarjeta.' : 'Da de alta al primero.',
            actBtn('user-plus', 'Nuevo cliente', 'newCustomerFromList()', 'po-btn-brand'));
    icons();
}

// -- Reportes (Monitor de CoffeePOS: por hora, por forma de pago, por categoría y lo más vendido) --
const REP_RANGES = [['hoy', 'Hoy'], ['turno', 'Turno actual'], ['semana', '7 días'], ['mes', '30 días']];
function setRepRange(r) { S.reportes.range = r; renderReportes(); }
// Ventas del periodo por created_at; «Turno actual» por sale.turn_id
function repSales(statuses = [2, 3]) {
    const r = S.reportes.range, tu = openTurn(), from = addDays(TODAY, r === 'semana' ? -6 : r === 'mes' ? -29 : 0);
    return DB.sale.filter(s => {
        if (!statuses.includes(s.sale_status_id)) return false;
        if (r === 'turno') return !!tu && s.turn_id === tu.id;
        const d = (s.created_at || '').slice(0, 10);
        return d >= from && d <= TODAY;
    });
}
const hbar = (label, value, max, color = '', txt = fmt(value)) => `<div class="flex items-center gap-2 text-[12px]">
    <span class="w-28 shrink-0 truncate text-gray-600" title="${esc(label)}">${esc(label)}</span>
    <div class="flex-1 min-w-0 h-2 rounded-full bg-gray-100 overflow-hidden"><div class="h-full rounded-full ${color ? '' : 'bg-blue-600'}" style="width:${max > 0 ? Math.max(2, value / max * 100).toFixed(1) : 0}%${color ? `;background:${color}` : ''}"></div></div>
    <span class="w-20 shrink-0 text-right font-semibold text-gray-900">${txt}</span></div>`;

function renderReportes() {
    const el = $id('reportesWrap'); if (!el) return;
    const r = S.reportes.range, tu = openTurn();
    const seg = `<div class="po-seg">${REP_RANGES.map(([key, lbl]) => `<button type="button" class="${r === key ? 'active' : ''}" onclick="setRepRange('${key}')">${lbl}</button>`).join('')}</div>`;
    const period = r === 'turno' ? (tu ? `Turno ${esc(tu.folio)} · desde ${hourOf(tu.opened_at)}` : 'Sin turno abierto')
        : r === 'hoy' ? `${dayName(TODAY)} ${fmtDate(TODAY)}` : `${fmtDate(addDays(TODAY, r === 'semana' ? -6 : -29))} al ${fmtDate(TODAY)}`;
    const head = viewHead('Reportes', `Monitor de ventas · ${period}`, seg);
    if (r === 'turno' && !tu) {
        el.innerHTML = head + panel('Turno actual', 'lock', emptyBox('lock', 'No hay turno abierto', 'Abre un turno o elige otro periodo.', actBtn('door-open', 'Abrir turno', 'openAbrirTurno()', 'po-btn-brand')));
        return icons();
    }
    const sales = repSales(), cancelled = repSales([4]), ids = new Set(sales.map(s => s.id));
    const lines = sales.flatMap(s => saleLines(s.id)), lineNet = d => round2(d.price * d.quantity - (d.discount_amount || 0));
    const total = round2(sum(sales, s => s.total)), orders = sales.filter(s => s.sale_type_id === 1).length;
    const disc = round2(sum(sales, s => s.discount_amount) + sum(lines, d => d.discount_amount));   // cuenta + partidas: columnas distintas
    const kpis = '<div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 mb-3">'
        + kpiTile('Venta total', fmt(total))
        + kpiTile('Tickets', sales.length, 'text-gray-900', `${sales.length - orders} venta(s) · ${orders} pedido(s)`)
        + kpiTile('Ticket promedio', sales.length ? fmt(total / sales.length) : '—')
        + kpiTile('Piezas', round2(sum(lines, d => d.quantity)))
        + kpiTile('Descuentos', fmt(disc), disc > 0 ? 'text-rose-600' : 'text-gray-900')
        + kpiTile('Propinas', fmt(sum(sales, s => s.tip_amount)), 'text-gray-900', 'van aparte del total')
        + kpiTile('Canceladas', cancelled.length, cancelled.length ? 'text-rose-600' : 'text-gray-900', cancelled.length ? fmt(sum(cancelled, s => s.total)) : '')
        + '</div>';
    if (!sales.length) {
        el.innerHTML = head + kpis + panel('Ventas', 'chart-column', emptyBox('chart-column', 'Sin ventas en este periodo', 'Elige otro periodo para ver el monitor.'));
        return icons();
    }

    // Ventas por hora: de la primera a la última hora con ventas
    const byHour = {};
    sales.forEach(s => { const hh = (s.created_at || '').slice(11, 13); if (!hh) return; const x = byHour[Number(hh)] || (byHour[Number(hh)] = { v: 0, n: 0 }); x.v += s.total; x.n++; });
    const hs = Object.keys(byHour).map(Number);
    const bars = !hs.length ? '<div class="text-[12px] text-gray-500">Sin hora registrada.</div>' : (() => {
        const h0 = Math.min(...hs), h1 = Math.max(...hs), maxH = Math.max(...hs.map(h => byHour[h].v));
        return `<div class="flex items-stretch gap-1 h-44">${Array.from({ length: h1 - h0 + 1 }, (_, n) => {
            const h = h0 + n, x = byHour[h] || { v: 0, n: 0 };
            return `<div class="flex-1 min-w-0 flex flex-col items-center" title="${pad(h)}:00 · ${x.n} ticket(s) · ${fmt(x.v)}">
                <div class="w-full flex-1 flex flex-col justify-end items-center border-b border-gray-200">
                    ${x.v ? `<span class="hidden sm:block text-[10px] text-gray-500 mb-0.5 whitespace-nowrap">${fmtShort(x.v)}</span>` : ''}
                    <div class="w-full max-w-[32px] bg-blue-600 rounded-t-md" style="height:${x.v ? Math.max(3, x.v / maxH * 85).toFixed(1) : 0}%"></div>
                </div>
                <span class="text-[10px] text-gray-500 mt-1">${pad(h)}h</span></div>`;
        }).join('')}</div>`;
    })();

    // Cobrado por forma de pago: pagos + abonos de estas ventas; el crédito no es cobro
    const pays = DB.payment.filter(p => ids.has(p.sale_id) && !p.deleted_at);
    const abonos = DB.receivable.filter(x => x.kind === 'abono' && !x.deleted_at && ids.has(x.sale_id));
    const byMethod = DB.payment_method.map(m => ({ m, v: round2(sum(pays.filter(p => p.payment_method_id === m.id), p => p.amount) + sum(abonos.filter(a => a.payment_method_id === m.id), a => a.amount)) }))
        .filter(x => x.v > 0).sort((a, b) => b.v - a.v);
    const maxM = Math.max(0, ...byMethod.map(x => x.v)), credit = round2(sum(sales, s => saleCredit(s.id))), owed = round2(sum(sales, saleDue));
    const methodsBody = (byMethod.length ? `<div class="space-y-2">${byMethod.map(x => hbar(x.m.name, x.v, maxM, methodTone(x.m))).join('')}</div>` : '<div class="text-[12px] text-gray-500">Sin cobros en este periodo.</div>')
        + `<div class="flex flex-wrap justify-between gap-2 mt-3 pt-2 border-t border-gray-100 text-[12px] text-gray-500">
            <span>Cobrado <b class="text-gray-900">${fmt(sum(byMethod, x => x.v))}</b></span>
            ${credit ? `<span>A crédito <b class="text-gray-900">${fmt(credit)}</b></span>` : ''}
            <span>Por cobrar <b class="${owed > 0 ? 'text-orange-600' : 'text-gray-900'}">${fmt(owed)}</b></span></div>`;

    // Por categoría y lo más vendido: importe de cada partida (precio × cantidad − su descuento)
    const cats = {}, top = {};
    lines.forEach(d => {
        const p = d.product_id ? product(d.product_id) : null, c = p ? catOf(p) : null, ck = c ? c.name : p ? 'Sin categoría' : 'Captura manual';
        cats[ck] = round2((cats[ck] || 0) + lineNet(d));
        const tk = norm(d.name), x = top[tk] || (top[tk] = { name: d.name, q: 0, v: 0 });
        x.q += Number(d.quantity) || 0; x.v = round2(x.v + lineNet(d));
    });
    const catRows = Object.entries(cats).sort((a, b) => b[1] - a[1]), maxC = Math.max(0, ...catRows.map(x => x[1]));
    const catBody = `<div class="space-y-2">${catRows.map(([n, v]) => hbar(n, v, maxC)).join('')}</div>
        <div class="text-[11px] text-gray-500 mt-2">Importe de las partidas, antes del descuento de la cuenta.</div>`;
    const topRows = Object.values(top).sort((a, b) => b.v - a.v).slice(0, 10);
    const topBody = miniTable('minmax(0,1fr) 3.5rem 6rem', ['Producto', 'Piezas', 'Importe'], topRows.map(x => [esc(x.name), round2(x.q), fmt(x.v)]));

    el.innerHTML = head + kpis + `<div class="grid lg:grid-cols-2 gap-3 items-start">
        ${panel('Ventas por hora', 'chart-column', bars, `<span class="text-[11px] text-gray-500 shrink-0">${sales.length} ticket(s)</span>`)}
        ${panel('Cobrado por forma de pago', 'wallet', methodsBody)}
        ${panel('Por categoría', 'layout-grid', catBody)}
        ${panel('Lo más vendido', 'trophy', topBody)}
    </div>`;
    icons();
}

// -- Salir (en pro cierra la sesión; aquí es plantilla) --
function logoutDemo() { toast('Plantilla: en el módulo real aquí se cierra la sesión', 'info'); }

// -- Arranque --
document.addEventListener('DOMContentLoaded', () => {
    loadTickets();
    // Tickets guardados de otra sesión: se limpian referencias que ya no existen
    S.tickets.forEach(t => {
        t.items = (t.items || []).filter(i => !i.product_id || i.is_custom || product(i.product_id));
        t.items.forEach(i => {
            if (i.is_custom && !product(i.product_id)) { i.product_id = 90; i.custom_dirty = true; }
            if (!t.editing_sale_id) delete i.detail_id;
        });
        if (t.customer_id && !customer(t.customer_id)) { t.customer_id = null; t.card_id = null; }
        if (t.card_id && !byId(DB.card, t.card_id)) t.card_id = null;
    });
    dropStaleEdits();
    loadSidebarState(); loadDarkMode();
    bindFinder(); bindCustomerSearch();
    const hd = $id('histDate'); if (hd) hd.value = S.hist.date;   // el filtro arranca en hoy: el campo lo dice
    renderCategories(); renderProducts(); renderTicket();
    renderTurnHeader(); renderBadgePedidos();
    let view = 'vender';
    try { view = localStorage.getItem(LS_VIEW) || 'vender'; } catch (e) { /* sin almacenamiento */ }
    setView(view);
});
