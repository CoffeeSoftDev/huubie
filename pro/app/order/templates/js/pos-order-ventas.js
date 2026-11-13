// POS + Pedidos (Huubie PRO) · ventas: historial (ventas, pedidos, cotizaciones, por cobrar), tablero de pedidos,
// producción y entrega, cancelación, abonos, impresión y WhatsApp.
// Depende de data, venta, cobro y caja (emptyBox, actBtn, miniTable, showPaper, paperRow, PAPER_HR, isCashMethod, dayState).
// setView y refreshViews viven en pos-order-vistas.js.

// -- Historial: pestañas y filtros (vista Ventas; en CoffeePOS es «Consultar cuentas») --
const HIST_TABS = [
    { key: 'ventas', label: 'Ventas', icon: 'receipt', test: s => s.sale_type_id !== 1 && s.sale_status_id !== 1 },
    { key: 'pedidos', label: 'Pedidos', icon: 'calendar-days', test: s => s.sale_type_id === 1 && s.sale_status_id !== 1 },
    { key: 'cotizaciones', label: 'Cotizaciones', icon: 'file-text', test: s => s.sale_status_id === 1 },
    { key: 'cobrar', label: 'Por cobrar', icon: 'hand-coins', test: s => saleDue(s) > 0 },
];
const HIST_STATUS = [[0, 'Todos'], [2, 'Pendiente'], [3, 'Pagado'], [4, 'Cancelado']];
const histTab = key => HIST_TABS.find(x => x.key === key) || HIST_TABS[0];
// Fecha de cada pestaña: la del filtro en la actual; «Por cobrar», «Cotizaciones» y el filtro por cliente van sin fecha
const tabDate = key => key === S.hist.tab ? S.hist.date : ['cobrar', 'cotizaciones'].includes(key) || S.hist.customerId ? '' : S.hist.date || TODAY;

function histMatches(s, tab = S.hist.tab, ignoreStatus = false) {
    const h = S.hist, date = tabDate(tab), q = norm(h.search.trim());
    if (!histTab(tab).test(s)) return false;
    if (h.customerId && s.customer_id !== h.customerId) return false;
    if (date && (s.created_at || '').slice(0, 10) !== date && !(tab === 'pedidos' && s.delivery_date === date)) return false;
    if (!ignoreStatus && h.status && ['ventas', 'pedidos'].includes(tab) && s.sale_status_id !== h.status) return false;
    const c = customer(s.customer_id);
    return !q || [s.folio, c?.name, c?.phone].some(v => norm(v).includes(q));
}
// Cuentas con saldo sin venta (receivable.sale_id NULL): solo en «Por cobrar»
function histAccounts() {
    const h = S.hist, q = norm(h.search.trim());
    return DB.customer.filter(c => accountDebt(c.id) > 0 && (!h.customerId || c.id === h.customerId) && (!q || norm(c.name).includes(q) || norm(c.phone).includes(q)));
}

// q: número = filtrar por cliente · texto = búsqueda. selectId abre esa venta.
function openHistorial(tab = 'ventas', q = null, selectId = null) {
    const h = S.hist;
    Object.assign(h, { tab: histTab(tab).key, status: 0, selected: selectId, search: typeof q === 'string' ? q : '', customerId: typeof q === 'number' ? q : null });
    h.date = h.customerId || selectId || ['cobrar', 'cotizaciones'].includes(h.tab) ? '' : TODAY;
    $id('histSearch').value = h.search;
    $id('histDate').value = h.date;
    setView('ventas');
}
function setHistTab(key) {
    const date = tabDate(key);
    Object.assign(S.hist, { tab: key, status: 0, selected: null, date });
    $id('histDate').value = date;
    renderHistList();
}
function setHistStatus(id) { S.hist.status = id; renderHistList(); }
function setHistSearch(v) { S.hist.search = v; renderHistList(); }
function setHistDate(v) { S.hist.date = v || ''; $id('histDate').value = S.hist.date; renderHistList(); }
function clearHistCustomer() { S.hist.customerId = null; renderHistList(); }
function selectHist(key) { S.hist.selected = key; renderHistList(); }

// -- Historial: resumen y lista --
function renderHistSummary() {
    const el = $id('histSummary'); if (!el) return;
    const today = DB.sale.filter(s => (s.created_at || '').slice(0, 10) === TODAY && [2, 3].includes(s.sale_status_id));
    const due = round2(sum(DB.sale.filter(s => saleDue(s) > 0), saleDue) + sum(DB.customer, c => Math.max(0, accountDebt(c.id))));
    el.innerHTML = `<span class="po-chip t-gray">Hoy ${today.length} · ${fmt(sum(today, s => s.total))}</span>`
        + (due > 0 ? `<button type="button" class="po-chip t-orange" onclick="setHistTab('cobrar')"><i data-lucide="hand-coins"></i>Por cobrar ${fmt(due)}</button>` : '');
}

function histSaleRow(s) {
    const h = S.hist, c = customer(s.customer_id), due = saleDue(s), ped = s.sale_type_id === 1, [dTxt, dTone] = DELIVERY_TXT[s.delivery_status] || DELIVERY_TXT[0];
    const when = h.date && (s.created_at || '').slice(0, 10) === h.date ? hourOf(s.created_at) : fmtStamp(s.created_at);
    return `<div class="row-sale px-3 py-2.5 ${h.selected === s.id ? 'active' : ''}" onclick="selectHist(${s.id})">
        <div class="flex items-center gap-1.5 min-w-0">
            <b class="text-[13px] text-gray-900">#${esc(s.folio)}</b>
            <span class="po-chip ${STATUS_TONE[s.sale_status_id]}">${DB.sale_status[s.sale_status_id]}</span>
            ${ped && [2, 3].includes(s.sale_status_id) ? `<span class="po-chip ${dTone}">${dTxt}</span>` : ''}
            <span class="ml-auto text-[13px] font-bold whitespace-nowrap ${s.sale_status_id === 4 ? 'text-gray-500 line-through' : 'text-gray-900'}">${fmt(s.total)}</span>
        </div>
        <div class="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
            <span class="truncate">${esc(c?.name || '—')} · ${when} · ${esc(userName(s.user_id))}</span>
            ${due > 0 ? `<span class="ml-auto font-semibold text-orange-600 whitespace-nowrap">Saldo ${fmt(due)}</span>` : ''}
        </div>
        ${ped ? `<div class="flex items-center gap-1 mt-0.5 text-[11px] text-gray-400 min-w-0"><i data-lucide="truck" class="w-3 h-3 shrink-0"></i><span class="truncate">${esc(deliveryTxt(s))}</span></div>` : ''}
    </div>`;
}
const histAccountRow = c => `<div class="row-sale px-3 py-2.5 ${S.hist.selected === 'c' + c.id ? 'active' : ''}" onclick="selectHist('c${c.id}')">
    <div class="flex items-center gap-1.5 min-w-0"><i data-lucide="user-round" class="w-3.5 h-3.5 text-blue-600 shrink-0"></i><b class="text-[13px] text-gray-900 truncate">${esc(c.name)}</b>
        <span class="ml-auto text-[13px] font-bold text-rose-600 whitespace-nowrap">${fmt(accountDebt(c.id))}</span></div>
    <div class="text-[11px] text-gray-500 mt-0.5">Saldo de cuenta (sin venta)</div></div>`;

function renderHistList() {
    if (!$id('histList')) return;
    const h = S.hist, tab = h.tab, cust = h.customerId ? customer(h.customerId) : null;
    $id('histTabs').innerHTML = HIST_TABS.map(x => {
        const n = DB.sale.filter(s => histMatches(s, x.key, true)).length + (x.key === 'cobrar' ? histAccounts().length : 0);
        return `<button type="button" class="po-tab ${x.key === tab ? 'active' : ''}" onclick="setHistTab('${x.key}')"><i data-lucide="${x.icon}"></i><span>${x.label}</span><span class="po-tab-n">${n}</span></button>`;
    }).join('');

    const chipsOn = ['ventas', 'pedidos'].includes(tab), base = DB.sale.filter(s => histMatches(s, tab, true)), chips = $id('histStatusChips');
    chips.innerHTML = (chipsOn ? HIST_STATUS.map(([id, lbl]) =>
        `<button type="button" class="po-chip ${h.status === id ? (STATUS_TONE[id] || 't-blue') : 't-gray'}" onclick="setHistStatus(${id})">${lbl} · ${id ? base.filter(s => s.sale_status_id === id).length : base.length}</button>`).join('') : '')
        + (cust ? `<span class="po-chip t-purple ml-auto"><i data-lucide="user"></i>${esc(cust.name)}<button type="button" class="opacity-70 hover:opacity-100" title="Quitar filtro" onclick="clearHistCustomer()"><i data-lucide="x"></i></button></span>` : '');
    chips.classList.toggle('hidden', !chipsOn && !cust);

    const sales = DB.sale.filter(s => histMatches(s)).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '') || b.id - a.id);
    const accounts = tab === 'cobrar' ? histAccounts() : [];
    $id('histList').innerHTML = accounts.map(histAccountRow).join('') + sales.map(histSaleRow).join('')
        || emptyBox('inbox', `Sin resultados${h.date ? ` el ${fmtDate(h.date)}` : ''}`,
            h.date ? 'La lista muestra un solo día. Quita la fecha para ver todo.' : h.search ? 'Prueba con otro folio, nombre o teléfono.' : '',
            h.date ? actBtn('calendar-range', 'Todas las fechas', "setHistDate('')") : '');
    const total = tab === 'cobrar' ? `Por cobrar ${fmt(sum(sales, saleDue) + sum(accounts, c => accountDebt(c.id)))}`
        : `Total ${fmt(sum(sales.filter(s => s.sale_status_id !== 4), s => s.total))}`;
    $id('histFooter').innerHTML = `<span>${sales.length + accounts.length} registro(s)</span><span class="font-semibold text-gray-700">${total}</span>`;

    // Móvil: lista o detalle, uno a la vez (desde md se ven las dos columnas)
    $id('histListCol').classList.toggle('hidden', !!h.selected);
    $id('histDetail').classList.toggle('hidden', !h.selected);
    $id('histDetail').classList.toggle('flex', !!h.selected);
    renderHistSummary(); renderHistDetail(); icons();
}

// -- Historial: detalle (sale + detail_sale + payment + receivable + history_log) --
const detLine = (k, v, tone = 'text-gray-900') => `<div class="flex justify-between gap-3"><span class="text-gray-500">${k}</span><span class="font-semibold text-right ${tone}">${v}</span></div>`;
const detSec = (title, table, body) => `<div><div class="po-sec mb-1">${title} <span class="normal-case tracking-normal font-normal text-gray-400">· ${table}</span></div>${body}</div>`;
const detBtn = (cls, icon, txt, fn) => `<button type="button" class="po-btn sm ${cls}" onclick="${fn}"><i data-lucide="${icon}" class="w-3.5 h-3.5"></i><span>${txt}</span></button>`;
const BACK_TO_LIST = '<button type="button" class="md:hidden text-[12px] font-semibold text-blue-600 flex items-center gap-1" onclick="selectHist(null)"><i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>Volver a la lista</button>';

function renderHistDetail() {
    const box = $id('histDetail'), sel = S.hist.selected;
    if (typeof sel === 'string') return renderAccountDetail(Number(sel.slice(1)));
    const s = sel ? saleById(sel) : null;
    if (!s) {
        box.innerHTML = `<div class="flex-1 flex flex-col items-center justify-center text-center p-8">
            <i data-lucide="mouse-pointer-click" class="w-8 h-8 mb-2 text-gray-400"></i><div class="text-[12px] text-gray-500">Elige una venta para ver su detalle</div></div>`;
        return;
    }
    const c = customer(s.customer_id), card = s.card_id ? byId(DB.card, s.card_id) : null, ct = cardTypeOf(card);
    const ped = s.sale_type_id === 1, live = [2, 3].includes(s.sale_status_id), due = saleDue(s), paid = salePaid(s), credit = saleCredit(s.id);
    const [dTxt, dTone] = DELIVERY_TXT[s.delivery_status] || DELIVERY_TXT[0], tu = turnById(s.turn_id), dAt = deliveredAt(s);

    const lines = saleLines(s.id).map(d => {
        const imgs = DB.sale_image.filter(x => x.detail_sale_id === d.id && x.active), disc = round2(d.discount_amount);
        return `<div class="py-2 border-b border-gray-100 last:border-0">
            <div class="flex justify-between gap-2 text-[12px] font-semibold text-gray-900"><span>${d.quantity} × ${esc(d.name)}</span><span class="whitespace-nowrap">${fmt(d.price * d.quantity - disc)}</span></div>
            <div class="text-[11px] text-gray-500">${fmt(d.price)} c/u${disc ? ` · descuento −${fmt(disc)}${d.discount_reason_id ? ` (${esc(reason(d.discount_reason_id)?.name || '')})` : ''}` : ''}</div>
            ${d.details ? `<div class="text-[11px] text-gray-600 mt-0.5">${esc(d.details)}</div>` : ''}
            ${d.dedication ? `<div class="flex items-center gap-1 text-[11px] text-pink-600 mt-0.5"><i data-lucide="pen-line" class="w-3 h-3 shrink-0"></i><span>«${esc(d.dedication)}»</span></div>` : ''}
            ${imgs.length ? `<div class="flex gap-1 mt-1">${imgs.map(x => `<img src="${esc(x.url)}" alt="${esc(x.original_name)}" class="w-10 h-10 rounded object-cover border border-gray-200">`).join('')}</div>` : ''}
        </div>`;
    }).join('');

    const pays = DB.payment.filter(p => p.sale_id === s.id).sort((a, b) => (a.paid_at || '').localeCompare(b.paid_at || ''));
    const recs = DB.receivable.filter(r => r.sale_id === s.id);
    const moneyRow = (txt, amount, deleted, tone = 'text-gray-900') => `<div class="flex justify-between gap-2 text-[12px] ${deleted ? 'line-through text-gray-400' : 'text-gray-600'}">
        <span class="min-w-0">${txt}</span><span class="font-semibold whitespace-nowrap ${deleted ? '' : tone}">${fmt(amount)}</span></div>`;
    const money = pays.map(p => moneyRow(`${esc(method(p.payment_method_id)?.name || '—')} · ${esc(p.description || 'Pago')} · ${fmtStamp(p.paid_at)}${turnById(p.turn_id) ? ' · ' + turnById(p.turn_id).folio : ''}${p.change_amount > 0 ? ` · cambio ${fmt(p.change_amount)}` : ''}`, p.amount, p.deleted_at))
        .concat(recs.map(r => moneyRow(`${r.kind === 'cargo' ? 'Crédito' : 'Abono a crédito'} · ${fmtStamp(r.created_at)}${r.payment_method_id ? ' · ' + esc(method(r.payment_method_id)?.name || '') : ''}`, r.amount, r.deleted_at, r.kind === 'cargo' ? 'text-sky-600' : 'text-gray-900'))).join('');

    const logs = DB.history_log.filter(x => x.sale_id === s.id).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '') || a.id - b.id);
    const timeline = logs.map(x => `<div class="flex gap-2 text-[12px]">
        <span class="po-m-ico sm t-blue shrink-0"><i data-lucide="${LOG_ICON[x.type] || 'circle'}"></i></span>
        <div class="min-w-0"><div class="font-semibold text-gray-900">${esc(x.title)} <span class="font-normal text-gray-500">· ${fmtStamp(x.created_at)} · ${esc(userName(x.user_id))}</span></div>
            ${x.detail ? `<div class="text-[11px] text-gray-500">${esc(x.detail)}</div>` : ''}</div></div>`).join('');

    // Acciones de CoffeePOS (ver, reimprimir, recuperar, cancelar folio) + las de pedido
    const acts = [];
    if (s.sale_status_id === 1) acts.push(detBtn('po-btn-brand', 'shopping-cart', 'Cobrar / convertir', `loadSaleToTicket(${s.id})`));
    else if (canEdit(s)) acts.push(detBtn('po-btn-ghost', 'pencil', 'Editar', `loadSaleToTicket(${s.id})`));
    if (due > 0) acts.push(detBtn('po-btn-ok', 'hand-coins', 'Abonar', `openAbono(${s.id})`));
    if (ped && live && s.delivery_status === 2) acts.push(detBtn('po-btn-ghost', 'chef-hat', 'Producido', `markProduced(${s.id})`));
    if (ped && live && s.delivery_status !== 1) acts.push(detBtn('po-btn-main', 'truck', 'Entregar', `deliverSale(${s.id})`));
    acts.push(detBtn('po-btn-ghost', 'printer', 'Imprimir', `openImprimirModal(${s.id})`), detBtn('po-btn-ghost', 'message-circle', 'WhatsApp', `sendWhatsApp(${s.id})`));
    if (s.sale_status_id !== 4) acts.push(detBtn('po-btn-danger', 'circle-x', 'Cancelar', `openCancelModal(${s.id})`));

    box.innerHTML = `
        <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4 space-y-3">${BACK_TO_LIST}
            <div>
                <div class="flex items-center gap-2 flex-wrap"><span class="text-[16px] font-bold text-gray-900">${esc(folioLabel(s))}</span>
                    <span class="po-chip ${STATUS_TONE[s.sale_status_id]}">${DB.sale_status[s.sale_status_id]}</span><span class="po-chip t-gray">${DB.sale_type[s.sale_type_id]}</span>
                    ${ped && live ? `<span class="po-chip ${dTone}">${dTxt}</span>` : ''}</div>
                <div class="text-[11px] text-gray-500 mt-1">${fmtStamp(s.created_at)} · ${esc(userName(s.user_id))}${tu ? ' · ' + tu.folio : ''}${s.edit_user_id ? ` · editó ${esc(userName(s.edit_user_id))}` : ''}</div>
            </div>
            <div class="po-box text-[12px] space-y-1">${detLine('Cliente', esc(c?.name || '—'))}${c?.phone ? detLine('Teléfono', esc(c.phone)) : ''}${card ? detLine('Tarjeta', `${esc(card.number)} · ${esc(ct?.name || '')}`) : ''}</div>
            ${ped ? `<div class="po-box text-[12px] space-y-1">${detLine('Entrega', esc(deliveryTxt(s)))}${s.location ? detLine('Dirección', esc(s.location)) : ''}
                ${s.birthday_date ? detLine('Cumpleaños', fmtDate(s.birthday_date)) : ''}${s.produced_at ? detLine('Producido', `${fmtStamp(s.produced_at)} · ${esc(userName(s.produced_user_id))}`) : ''}
                ${dAt ? detLine('Entregado', fmtStamp(dAt), 'text-emerald-600') : ''}</div>` : ''}
            ${detSec('Partidas', 'detail_sale', `<div class="po-box !py-0">${lines || '<div class="py-3 text-[12px] text-gray-500">Sin partidas</div>'}</div>`)}
            <div class="po-box text-[12px] space-y-1">${detLine('Subtotal', fmt(s.subtotal))}
                ${s.discount_amount ? detLine(`Descuento${s.discount_note ? ' · ' + esc(s.discount_note) : ''}`, '−' + fmt(s.discount_amount), 'text-rose-600') : ''}
                ${detLine('<b class="text-gray-900">Total</b>', fmt(s.total), 'text-emerald-600 !font-bold text-[14px]')}${s.tip_amount ? detLine('Propina', fmt(s.tip_amount)) : ''}
                ${detLine('Pagado', fmt(paid))}${credit ? detLine('A crédito', fmt(credit), 'text-sky-600') : ''}${due > 0 ? detLine('Saldo', fmt(due), 'text-orange-600') : ''}</div>
            ${money ? detSec('Pagos', 'payment / receivable', `<div class="po-box space-y-1">${money}</div>`) : ''}
            ${s.note ? `<div class="po-note t-amber"><i data-lucide="sticky-note" class="w-3.5 h-3.5 shrink-0 mt-px"></i><span>${esc(s.note)}</span></div>` : ''}
            ${s.sale_status_id === 4 ? `<div class="po-note t-red"><i data-lucide="circle-x" class="w-3.5 h-3.5 shrink-0 mt-px"></i><div><b>Cancelada ${fmtStamp(s.cancelled_at)} · ${esc(userName(s.cancel_user_id))}</b>${s.cancel_reason ? `<div>${esc(s.cancel_reason)}</div>` : ''}</div></div>` : ''}
            ${detSec('Bitácora', 'history_log', `<div class="space-y-2">${timeline || '<div class="text-[12px] text-gray-500">Sin movimientos</div>'}</div>`)}
        </div>
        <div class="flex flex-wrap gap-1.5 p-3 border-t border-gray-200 shrink-0">${acts.join('')}</div>`;
}

function renderAccountDetail(cid) {
    const c = customer(cid), box = $id('histDetail'); if (!c) return;
    const rows = DB.receivable.filter(r => r.customer_id === c.id && !r.sale_id).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    const debt = accountDebt(c.id), inSales = round2(customerDebt(c.id) - debt);
    box.innerHTML = `
        <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4 space-y-3">${BACK_TO_LIST}
            <div><div class="text-[16px] font-bold text-gray-900">${esc(c.name)}</div>
                <div class="text-[11px] text-gray-500 mt-1">${esc(c.phone || 'Sin teléfono')} · cuenta por cobrar sin venta (receivable.sale_id NULL)</div></div>
            <div class="po-box flex justify-between items-center"><span class="text-[12px] text-gray-500">Saldo de la cuenta</span><span class="text-[18px] font-bold ${debt > 0 ? 'text-rose-600' : 'text-emerald-600'}">${fmt(debt)}</span></div>
            ${detSec('Movimientos', 'receivable', miniTable('1fr 76px 88px', ['Movimiento', 'Fecha', 'Importe'], rows.map(r => [
                `<span class="${r.deleted_at ? 'line-through' : ''}">${r.kind === 'cargo' ? 'Cargo' : 'Abono'} · ${esc(r.description || '')}${r.payment_method_id ? ' · ' + esc(method(r.payment_method_id)?.name || '') : ''}${turnById(r.turn_id) ? ' · ' + turnById(r.turn_id).folio : ''}</span>`,
                fmtDate(r.created_at), `<span class="${r.kind === 'cargo' ? 'text-rose-600' : 'text-emerald-600'}">${r.kind === 'cargo' ? '+' : '−'}${fmt(r.amount)}</span>`]), ['Saldo', '', fmt(debt)]))}
            ${inSales > 0 ? `<div class="po-note t-gray"><i data-lucide="info" class="w-3.5 h-3.5 shrink-0 mt-px"></i><span>Además debe ${fmt(inSales)} en ventas a crédito; aparecen en la lista como ventas.</span></div>` : ''}
        </div>
        <div class="flex flex-wrap gap-1.5 p-3 border-t border-gray-200 shrink-0">
            ${debt > 0 ? detBtn('po-btn-ok', 'hand-coins', 'Abonar a la cuenta', `openAbono({ customerId: ${c.id} })`) : ''}
            ${detBtn('po-btn-ghost', 'list-filter', 'Solo este cliente', `openHistorial('cobrar', ${c.id})`)}
        </div>`;
}

// -- Cargar una venta guardada al ticket (editar, cobrar saldo o convertir cotización) --
// detail_sale.details trae «Grupo: opción, opción ×2 · texto libre»: se separa lo que coincide con product_modifier
function parseMods(pid, details) {
    const avail = modsOf(pid), mods = [], rest = [];
    String(details || '').split(' · ').filter(Boolean).forEach(seg => {
        const g = seg.match(/^([^:]+):\s*(.+)$/);
        const found = g ? g[2].split(', ').map(n => {
            const x = n.match(/^(.*?)(?: ×(\d+))?$/);
            const m = avail.find(a => groupOf(a).name === g[1].trim() && a.name === x[1].trim());
            return m ? pickMod(m.id, Number(x[2] || 1)) : null;
        }) : null;
        if (found && found.every(Boolean)) mods.push(...found); else rest.push(seg);
    });
    return { mods, rest: rest.join(' · ') };
}
function lineToItem(d) {
    const p = d.product_id ? product(d.product_id) : null;
    const i = {
        uid: uid(), detail_id: d.id, product_id: d.product_id, name: d.name, details: d.details || '', dedication: d.dedication || '',
        price: d.price, quantity: d.quantity, disc: null, modifiers: [],
        images: DB.sale_image.filter(x => x.detail_sale_id === d.id && x.active).map(x => ({ name: x.name, original_name: x.original_name, url: x.url })),
        components: p ? recipeOf(p.id).map(r => ({ product_id: r.component_id, name: product(r.component_id).name, quantity: r.quantity })) : [],
    };
    if (p?.is_custom) {   // personalizado: la receta vive en product_modifier del propio product
        i.is_custom = true;
        i.custom_mods = DB.product_modifier.filter(pm => pm.product_id === p.id && pm.modifier_id).map(pm => pickMod(pm.modifier_id, pm.quantity || 1));
        const pre = modsText(i.custom_mods);
        if (pre && i.details.startsWith(pre)) i.details = i.details.slice(pre.length).replace(/^ · /, '');
    } else if (p && modsOf(p.id).length) {
        const k = parseMods(p.id, i.details);
        Object.assign(i, { modifiers: k.mods, details: k.rest, price: round2(d.price - sum(k.mods, m => m.price * m.quantity)) });
    }
    if (d.discount_percent > 0) i.disc = { type: 'pct', value: d.discount_percent, reason_id: d.discount_reason_id, note: '', user_id: null };
    else if (d.discount_amount > 0) i.disc = { type: 'amt', value: d.discount_amount, reason_id: d.discount_reason_id, note: '', user_id: null };
    return i;
}
function loadSaleToTicket(id) {
    const s = saleById(id); if (!s) return;
    if (!canEdit(s)) return swalWarn('No se puede editar', editBlock(s));
    if (dayState() === 'cerrado') return swalWarn('Día cerrado', 'Reabre el día para editar o cobrar ventas.');
    let t = S.tickets.find(x => x.editing_sale_id === s.id);
    if (t) S.activeId = t.uid;
    else {
        t = T();
        if (t.items.length || t.customer_id || t.editing_sale_id) { newTicket(); t = T(); }
        resetTicket(t, false);
        // sale.discount_amount junta cuenta + tarjeta: se despeja el de la cuenta
        const ct = cardTypeOf(s.card_id ? byId(DB.card, s.card_id) : null), cFrac = (ct?.discount_percent || 0) / 100;
        const note = String(s.discount_note || '').split(' · ').filter(x => x && !/^Tarjeta /.test(x)).join(' · ');
        Object.assign(t, {
            sale_type_id: s.sale_type_id, customer_id: isPublic(s.customer_id) ? null : s.customer_id, card_id: s.card_id || null, note: s.note || '',
            delivery_date: s.delivery_date || TODAY, delivery_time: s.delivery_time || '', delivery_method: Number(s.delivery_method) || 0,
            location: s.location || '', birthday_date: s.birthday_date || '', editing_sale_id: s.id, pedidoOpen: true,
            items: saleLines(s.id).map(lineToItem),
        });
        if (s.discount_percent > 0) t.discount = { type: 'pct', value: s.discount_percent, reason_id: s.discount_reason_id, note, user_id: s.discount_user_id };
        else if (s.discount_reason_id && s.discount_amount > 0) {
            const A = round2((s.discount_amount - s.subtotal * cFrac) / (1 - cFrac));
            if (A > 0) t.discount = { type: 'amt', value: A, reason_id: s.discount_reason_id, note, user_id: s.discount_user_id };
        }
        t.discount_orig = JSON.stringify(t.discount || null);
    }
    setView('vender');
    renderTicket();
    document.body.classList.add('ticket-open');
    toast(`${folioLabel(s)} cargado al ticket`);
}

// -- Producción y entrega (delivery_status: 2 para producir → 0 listo → 1 entregado) --
function markProduced(id) {
    const s = saleById(id); if (!s || s.delivery_status !== 2) return;
    const now = nowStamp();
    Object.assign(s, { delivery_status: 0, produced_at: now, produced_user_id: DB.user.id, updated_at: now });
    logH(s.id, 'delivery', 'Producción terminada', 'Listo para entregar', DB.user.id, now, 'produce');
    refreshViews(); toast(`${folioLabel(s)} listo para entregar`);
}
function finishDelivery(s) {
    const now = nowStamp();
    if (!s.produced_at) Object.assign(s, { produced_at: now, produced_user_id: DB.user.id });
    Object.assign(s, { delivery_status: 1, updated_at: now });
    logH(s.id, 'delivery', 'Pedido entregado', Number(s.delivery_method) ? `Envío a ${s.location}` : 'Recogió en tienda', DB.user.id, now, 'deliver');
}
// Con saldo fuera del crédito no se entrega: primero se cobra (abono con «entregar al liquidar»)
async function deliverSale(id) {
    const s = saleById(id); if (!s || ![2, 3].includes(s.sale_status_id) || s.delivery_status === 1) return;
    if (cashDue(s) > 0) return openAbono(s.id, true);
    if (!await swalConfirm('¿Entregar pedido?', `${folioLabel(s)} · ${customer(s.customer_id)?.name || '—'}${creditLeft(s) ? ` · queda a crédito ${fmt(creditLeft(s))}` : ''}`, 'Sí, entregar')) return;
    finishDelivery(s); refreshViews(); toast(`${folioLabel(s)} entregado`);
}

// -- Tablero de pedidos (vista Pedidos) --
const BOARD_RANGES = [['hoy', 'Hoy'], ['manana', 'Mañana'], ['semana', '7 días'], ['todos', 'Todos']];
const BOARD_COLS = [[2, 'Por producir', 'chef-hat', 't-amber'], [0, 'Listos para entregar', 'package-check', 't-sky'], [1, 'Entregados', 'circle-check', 't-green']];
function openPedidosBoard(range = null) { if (range) S.board.range = range; setView('pedidos'); }
function setBoardRange(r) { S.board.range = r; renderBoard(); }
function setBoardSearch(v) { S.board.search = v; renderBoard(); }
// Nuevo pedido: ticket limpio en modo Pedido (si el actual tiene algo, se abre otro)
function newPedido() {
    setView('vender');
    const t = T();
    if (t.items.length || t.customer_id || t.editing_sale_id) newTicket();
    setMode(1);
}
function boardPedidos() {
    const r = S.board.range, tomorrow = addDays(TODAY, 1), week = addDays(TODAY, 6), q = norm(S.board.search.trim());
    return DB.sale.filter(s => s.sale_type_id === 1 && [2, 3].includes(s.sale_status_id)).filter(s => {
        if (s.delivery_status === 1) return r === 'todos' || (r !== 'manana' && (deliveredAt(s) || '').slice(0, 10) === TODAY);
        const d = s.delivery_date || TODAY;   // «Hoy» incluye los atrasados
        return r === 'manana' ? d === tomorrow : r === 'hoy' ? d <= TODAY : r === 'semana' ? d <= week : true;
    }).filter(s => !q || [s.folio, customer(s.customer_id)?.name].some(v => norm(v).includes(q)))
        .sort((a, b) => `${a.delivery_date || ''}${a.delivery_time || '99:99'}`.localeCompare(`${b.delivery_date || ''}${b.delivery_time || '99:99'}`));
}
function boardCard(s) {
    const c = customer(s.customer_id), due = saleDue(s), late = s.delivery_status !== 1 && s.delivery_date && s.delivery_date < TODAY;
    const lines = saleLines(s.id), dAt = deliveredAt(s), ship = Number(s.delivery_method);
    return `<div class="kb-card">
        <div class="flex items-center gap-2"><b class="text-[13px] text-gray-900">#${esc(s.folio)}</b>
            ${due > 0 ? `<span class="po-chip t-orange ml-auto">Saldo ${fmt(due)}</span>` : '<span class="po-chip t-green ml-auto">Pagado</span>'}</div>
        <div class="text-[12px] text-gray-900 font-semibold truncate mt-0.5">${esc(c?.name || '—')}</div>
        <div class="flex items-center gap-1 text-[11px] mt-0.5 ${late ? 'text-rose-600 font-semibold' : 'text-gray-500'}"><i data-lucide="clock" class="w-3 h-3 shrink-0"></i>
            <span class="truncate">${s.delivery_date ? `${dayName(s.delivery_date)} ${fmtDate(s.delivery_date)}` : 'Sin fecha'}${s.delivery_time ? ' · ' + esc(s.delivery_time) : ''}${late ? ' · Atrasado' : ''}</span></div>
        <div class="flex items-center gap-1 text-[11px] text-gray-500"><i data-lucide="${ship ? 'truck' : 'store'}" class="w-3 h-3 shrink-0"></i><span class="truncate">${ship ? esc(s.location || 'Sin dirección') : 'Recoge en tienda'}</span></div>
        <div class="mt-1.5 text-[11px] text-gray-600 space-y-0.5">${lines.slice(0, 3).map(d => `<div class="truncate">${d.quantity} × ${esc(d.name)}</div>`).join('')}${lines.length > 3 ? `<div class="text-gray-400">+${lines.length - 3} más</div>` : ''}
            ${lines.filter(d => d.dedication).map(d => `<div class="text-pink-600 truncate">«${esc(d.dedication)}»</div>`).join('')}</div>
        <div class="flex items-center gap-1 mt-2">
            ${s.delivery_status === 2 ? detBtn('po-btn-ghost', 'chef-hat', 'Producido', `markProduced(${s.id})`) : ''}
            ${s.delivery_status !== 1 ? detBtn('po-btn-main', 'truck', 'Entregar', `deliverSale(${s.id})`)
                : `<span class="text-[11px] text-emerald-600 font-semibold">Entregado ${dAt ? (dAt.slice(0, 10) === TODAY ? hourOf(dAt) : fmtStamp(dAt)) : ''}</span>`}
            <button type="button" class="po-icon-btn sm ml-auto" title="Ver detalle" onclick="openHistorial('pedidos', null, ${s.id})"><i data-lucide="eye" class="w-3.5 h-3.5"></i></button>
        </div>
    </div>`;
}
function renderBoard() {
    if (!$id('boardCols')) return;
    $id('segBoard').innerHTML = BOARD_RANGES.map(([k, l]) => `<button type="button" class="${S.board.range === k ? 'active' : ''}" onclick="setBoardRange('${k}')">${l}</button>`).join('');
    const list = boardPedidos(), late = list.filter(s => s.delivery_status !== 1 && s.delivery_date && s.delivery_date < TODAY).length, due = round2(sum(list, saleDue));
    const sumEl = $id('boardSummary');
    if (sumEl) sumEl.innerHTML = (late ? `<span class="po-chip t-red"><i data-lucide="clock"></i>${late} atrasado${late > 1 ? 's' : ''}</span>` : '')
        + (due > 0 ? `<span class="po-chip t-orange">Saldo ${fmt(due)}</span>` : '');
    $id('boardCols').innerHTML = BOARD_COLS.map(([st, lbl, icon, tone]) => {
        const items = list.filter(s => s.delivery_status === st);
        return `<div class="kb-col">
            <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-200 shrink-0">
                <span class="po-m-ico sm ${tone}"><i data-lucide="${icon}"></i></span>
                <b class="text-[12px] text-gray-900">${lbl}</b><span class="po-chip ${tone} ml-auto">${items.length}</span>
            </div>
            <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-2 space-y-2">${items.map(boardCard).join('') || '<div class="text-[11px] text-gray-400 text-center py-6">Sin pedidos</div>'}</div>
        </div>`;
    }).join('');
    icons();
}
// Badge del menú: pedidos sin entregar con fecha de hoy o atrasados
function renderBadgePedidos() {
    const b = $id('badgePedidos'); if (!b) return;
    const n = DB.sale.filter(s => s.sale_type_id === 1 && [2, 3].includes(s.sale_status_id) && s.delivery_status !== 1 && (s.delivery_date || TODAY) <= TODAY).length;
    b.textContent = n; b.classList.toggle('hidden', !n);
}

// -- Cancelar (PIN de gerente; la devolución solo marca deleted_at) --
const CANCEL_QUICK = ['El cliente se arrepintió', 'Error de captura', 'Producto no disponible', 'Pedido duplicado', 'No se presentó'];
function openCancelModal(id) {
    const s = saleById(id); if (!s || s.sale_status_id === 4) return;
    if (s.daily_closure_id && dayState() === 'cerrado') return swalWarn('Día cerrado', 'Reabre el día para cancelar esta venta.');
    const paid = salePaid(s);
    S.cancelSaleId = s.id;
    $id('cancelSub').textContent = `${folioLabel(s)} · ${customer(s.customer_id)?.name || '—'} · ${fmt(s.total)}`;
    $id('cancelReason').value = '';
    $id('cancelQuick').innerHTML = CANCEL_QUICK.map(q => `<button type="button" class="po-chip t-gray" onclick="$id('cancelReason').value = this.textContent; $id('cancelReason').focus()">${q}</button>`).join('');
    $id('wrapCancelRefund').classList.toggle('hidden', !(paid > 0));
    $id('cancelRefund').checked = true;
    $id('cancelRefundInfo').textContent = paid > 0 ? `Cobrado ${fmt(paid)}. Los pagos y abonos se marcan con deleted_at.` : '';
    openModal('modalCancel'); setTimeout(() => $id('cancelReason').focus(), 60);
}
function confirmCancelSale() {
    const s = saleById(S.cancelSaleId); if (!s) return;
    const why = $id('cancelReason').value.trim();
    if (!why) return swalWarn('Falta el motivo', 'Escribe por qué se cancela.');
    const paid = salePaid(s), refund = paid > 0 && $id('cancelRefund').checked;
    if (refund && !requireTurn()) return;
    askPin(`Cancelar ${folioLabel(s)} · ${fmt(s.total)}`, authId => {
        const now = nowStamp();
        Object.assign(s, { sale_status_id: 4, cancelled_at: now, cancel_user_id: authId, cancel_reason: why.slice(0, 255), updated_at: now });
        if (refund) [...salePayments(s.id), ...saleAbonos(s.id)].forEach(p => Object.assign(p, { deleted_at: now, deleted_user_id: authId }));
        DB.receivable.filter(r => r.sale_id === s.id && r.kind === 'cargo' && !r.deleted_at).forEach(r => Object.assign(r, { deleted_at: now, deleted_user_id: authId }));
        logH(s.id, 'cancellation', 'Venta cancelada', `${why}${refund ? ` · se devolvieron ${fmt(paid)}` : paid ? ` · sin devolver ${fmt(paid)}` : ''} · autorizó ${userName(authId)}`, DB.user.id, now, 'cancel');
        closeModal('modalCancel'); refreshViews(); toast(`${folioLabel(s)} cancelada`);
    });
}

// -- Abonos: a una venta (payment, o receivable si tiene crédito) o a la cuenta del cliente (receivable sin venta) --
function openAbono(target, deliver = false) {
    if (!requireTurn()) return;
    const s = typeof target === 'number' ? saleById(target) : null, cid = s ? s.customer_id : Number(target?.customerId);
    const due = s ? saleDue(s) : accountDebt(cid);
    if (!(due > 0)) return swalInfo('Sin saldo', 'No hay nada por cobrar.');
    S.abono = { saleId: s?.id ?? null, customerId: cid, due, method: cashMethod().id };
    const c = customer(cid), ped = s?.sale_type_id === 1;
    $id('abTitle').textContent = s ? (ped ? 'Abono al pedido' : 'Abono a la venta') : 'Abono a la cuenta';
    $id('abSub').textContent = s ? `${folioLabel(s)} · ${c?.name || '—'}` : `${c?.name || '—'} · saldo sin venta`;
    $id('abSaldo').textContent = fmt(due);
    const canDeliver = ped && [2, 3].includes(s.sale_status_id) && s.delivery_status !== 1;
    $id('wrapAbonoDeliver').classList.toggle('hidden', !canDeliver);
    $id('abDeliver').checked = canDeliver && deliver;
    $id('abAmount').value = deliver && s ? cashDue(s) : '';
    $id('abTendered').value = '';
    renderAbonoMethods(); calcAbono();
    openModal('modalAbono');
    setTimeout(() => $id('abAmount').focus(), 60);
}
function renderAbonoMethods() {
    $id('abMethods').innerHTML = DB.payment_method.filter(m => m.is_visible && m.kind !== 'puntos').sort((a, b) => a.sort - b.sort).map(m =>
        `<button type="button" class="po-opt ${S.abono.method === m.id ? 'active' : ''}" onclick="setAbonoMethod(${m.id})">
            <i data-lucide="${m.icon || 'wallet'}" class="w-4 h-4 po-tone-ico" style="--tone:${methodTone(m)}"></i><span class="text-[12px] font-semibold">${esc(m.name)}</span></button>`).join('');
    icons();
}
function setAbonoMethod(id) { S.abono.method = id; renderAbonoMethods(); calcAbono(); }
function calcAbono() {
    const a = S.abono; if (!a) return;
    const cash = isCashMethod(a.method), amount = round2($id('abAmount').value);
    $id('abCashWrap').classList.toggle('hidden', !cash);
    const tendered = $id('abTendered').value === '' ? amount : round2($id('abTendered').value), diff = round2(tendered - amount), p = $id('abChange');
    p.textContent = !cash || !amount ? '' : diff >= 0 ? `Cambio ${fmt(diff)}` : `Faltan ${fmt(-diff)}`;
    p.className = `text-[12px] font-semibold mt-1 ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`;
}
function fillAbonoTotal() { if (!S.abono) return; $id('abAmount').value = S.abono.due; calcAbono(); }
function confirmAbono() {
    const a = S.abono; if (!a) return;
    const amount = round2($id('abAmount').value);
    if (!(amount > 0)) return swalWarn('Monto inválido', 'Escribe cuánto abona el cliente.');
    if (amount > a.due) return swalWarn('Monto mayor al saldo', `El saldo es ${fmt(a.due)}.`);
    const cash = isCashMethod(a.method), tendered = cash && $id('abTendered').value !== '' ? round2($id('abTendered').value) : amount;
    if (tendered < amount) return swalWarn('Efectivo insuficiente', `Recibiste ${fmt(tendered)} y el abono es de ${fmt(amount)}.`);
    const turn = openTurn(); if (!turn) return requireTurn();
    const s = a.saleId ? saleById(a.saleId) : null, now = nowStamp(), me = DB.user.id, change = round2(tendered - amount), m = method(a.method);
    // Primero baja el crédito (receivable abono); lo demás es un payment normal
    const toCredit = s ? Math.min(amount, creditLeft(s)) : amount, toPay = round2(amount - toCredit);
    if (toCredit > 0) DB.receivable.push({
        id: nextId(DB.receivable), kind: 'abono', description: s ? `Abono crédito venta #${s.folio}` : 'Abono a cuenta', amount: round2(toCredit),
        paid_at: now, deleted_at: null, created_at: now, updated_at: now, branch_id: DB.branch.id, user_id: me, deleted_user_id: null,
        customer_id: a.customerId, sale_id: s?.id ?? null, turn_id: turn.id, payment_method_id: m.id, active: 1,
    });
    if (toPay > 0) DB.payment.push({
        id: nextId(DB.payment), sale_id: s.id, payment_method_id: m.id, description: amount >= a.due ? 'Liquidación' : 'Abono', amount: toPay,
        tendered_amount: round2(toPay + change), change_amount: change, paid_at: now, deleted_at: null, deleted_user_id: null,
        branch_id: DB.branch.id, user_id: me, turn_id: turn.id, created_at: now, updated_at: now, active: 1,
    });
    if (s) {
        logH(s.id, 'payment', amount >= a.due ? 'Liquidación' : 'Abono', `${m.name} ${fmt(amount)}${toCredit > 0 ? ` · ${fmt(toCredit)} al crédito` : ''}${change > 0 ? ` · recibió ${fmt(tendered)} · cambio ${fmt(change)}` : ''}`, me, now, 'pay');
        if (saleDue(s) <= 0) s.sale_status_id = 3;
        s.updated_at = now;
        if ($id('abDeliver').checked && !$id('wrapAbonoDeliver').classList.contains('hidden') && cashDue(s) <= 0) finishDelivery(s);
    }
    closeModal('modalAbono'); S.abono = null; refreshViews();
    const left = s ? saleDue(s) : accountDebt(a.customerId);
    swalBase({ icon: 'success', title: 'Abono registrado', html: `<div class="text-[13px] text-left">
        <div class="flex justify-between py-1.5 border-b border-gray-200"><span class="text-gray-500">Abonó</span><b class="text-gray-900">${fmt(amount)}</b></div>
        <div class="flex justify-between py-1.5 border-b border-gray-200"><span class="text-gray-500">Saldo</span><b class="${left > 0 ? 'text-orange-600' : 'text-emerald-600'}">${left > 0 ? fmt(left) : 'Liquidado'}</b></div>
        ${change > 0 ? `<div class="mt-3 text-center"><div class="po-lbl">Cambio a entregar</div><div class="text-[30px] font-bold leading-tight text-emerald-600">${fmt(change)}</div></div>` : ''}</div>` });
}

// -- Ticket impreso (80 mm): pre-cuenta del ticket abierto o venta guardada --
function openImprimirModal(saleId = null) {
    const r = paperRow, head = `<p class="text-center font-bold text-[13px]">${esc(DB.branch.name)}</p>`;
    if (!saleId) {
        const t = T(), c = calcTicket(t), cu = t.customer_id ? customer(t.customer_id) : null;
        if (!t.items.length) return swalWarn('Ticket vacío', 'Agrega productos para imprimir la pre-cuenta.');
        return showPaper('Pre-cuenta · 80 mm', `${head}
            <p class="text-center font-bold">PRE-CUENTA · NO ES COMPROBANTE</p>
            <p class="text-center">${fmtDate(TODAY)} ${nowTime()} · ${esc(DB.user.name)}</p>${cu ? `<p class="text-center">${esc(cu.name)}</p>` : ''}${PAPER_HR}
            ${t.items.map(i => r(`${i.quantity} × ${esc(i.name)}`, fmt(lineGross(i) - lineDisc(i)))).join('')}${PAPER_HR}
            ${r('Subtotal', fmt(c.subtotal))}${c.accDisc ? r('Descuento', '−' + fmt(c.accDisc)) : ''}${c.cardDisc ? r(`Tarjeta ${esc(c.ct.name)}`, '−' + fmt(c.cardDisc)) : ''}
            ${r('TOTAL', fmt(c.total), true)}${c.paid ? r('Pagado', fmt(c.paid)) + r('Saldo', fmt(c.due), true) : ''}`);
    }
    const s = saleById(saleId); if (!s) return;
    const c = customer(s.customer_id), tu = turnById(s.turn_id), ped = s.sale_type_id === 1;
    const pays = salePayments(s.id), abs = saleAbonos(s.id), credit = saleCredit(s.id), due = saleDue(s);
    const kind = s.sale_status_id === 4 ? 'CANCELADA' : s.sale_status_id === 1 ? 'COTIZACIÓN · NO ES COMPROBANTE' : ped ? 'PEDIDO' : 'TICKET DE VENTA';
    showPaper(`${folioLabel(s)} · 80 mm`, `${head}
        <p class="text-center font-bold">${kind}</p>
        <p class="text-center">Folio ${esc(s.folio)} · ${fmtStamp(s.created_at)}</p>
        <p class="text-center">Cajero ${esc(userName(s.user_id))}${tu ? ' · ' + tu.folio : ''}</p>
        ${!isPublic(s.customer_id) ? `<p class="text-center">${esc(c?.name || '')}${c?.phone ? ' · ' + esc(c.phone) : ''}</p>` : ''}
        ${ped ? PAPER_HR + r('Entrega', esc(deliveryTxt(s))) + (s.location ? `<p>${esc(s.location)}</p>` : '') : ''}${PAPER_HR}
        ${saleLines(s.id).map(d => r(`${d.quantity} × ${esc(d.name)}`, fmt(d.price * d.quantity - d.discount_amount))
            + (d.details ? `<p class="text-[10px] text-[#555] pl-3">${esc(d.details)}</p>` : '')
            + (d.dedication ? `<p class="text-[10px] text-[#555] pl-3">«${esc(d.dedication)}»</p>` : '')).join('')}${PAPER_HR}
        ${r('Subtotal', fmt(s.subtotal))}${s.discount_amount ? r(`Descuento${s.discount_note ? ' · ' + esc(s.discount_note) : ''}`, '−' + fmt(s.discount_amount)) : ''}
        ${r('TOTAL', fmt(s.total), true)}${s.tip_amount ? r('Propina', fmt(s.tip_amount)) : ''}
        ${pays.length || abs.length ? PAPER_HR + pays.map(p => r(`${esc(method(p.payment_method_id)?.name || '')} ${hourOf(p.paid_at)}`, fmt(p.amount))
            + (p.change_amount > 0 ? r('&nbsp;&nbsp;Recibido / cambio', `${fmt(p.tendered_amount)} / ${fmt(p.change_amount)}`) : '')).join('')
            + abs.map(x => r(`Abono ${esc(method(x.payment_method_id)?.name || '')} ${hourOf(x.paid_at)}`, fmt(x.amount))).join('') : ''}
        ${credit ? r('A crédito', fmt(credit)) : ''}${due > 0 ? r('SALDO', fmt(due), true) : ''}${PAPER_HR}
        <p class="text-center">¡Gracias por su compra!</p>`, s.id);
}
function sendWhatsApp(id) {
    const s = id ? saleById(id) : null;
    if (!s) return swalWarn('Sin venta', 'Guarda la venta para enviarla por WhatsApp.');
    const c = customer(s.customer_id), phone = String(c?.phone || '').replace(/\D/g, '');
    if (isPublic(s.customer_id) || phone.length !== 10) return swalWarn('Sin teléfono', 'La venta necesita un cliente con teléfono de 10 dígitos.');
    const due = saleDue(s);
    const txt = [`*${DB.branch.name}*`, `${folioLabel(s)} · ${fmtStamp(s.created_at)}`, '',
        ...saleLines(s.id).map(d => `• ${d.quantity}× ${d.name} ${fmt(d.price * d.quantity - d.discount_amount)}`), '',
        `*Total: ${fmt(s.total)}*`, s.tip_amount ? `Propina: ${fmt(s.tip_amount)}` : null, `Pagado: ${fmt(salePaid(s))}`,
        due > 0 ? `*Saldo: ${fmt(due)}*` : null, s.sale_type_id === 1 ? `Entrega: ${deliveryTxt(s)}` : null, '', '¡Gracias por su compra!']
        .filter(x => x !== null).join('\n');
    window.open(`https://wa.me/52${phone}?text=${encodeURIComponent(txt)}`, '_blank', 'noopener');
}
