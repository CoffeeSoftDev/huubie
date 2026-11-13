// POS + Pedidos (Huubie PRO) · vender: catálogo, buscador, ticket, partidas, descuento, PIN y personalizado.
// Depende de pos-order-data.js.

// -- Catálogo --
const catOf = p => byId(DB.category, p.category_id);
const productIcon = p => p.kind === 'bundle' ? 'gift' : (catOf(p)?.icon || 'package');
const productTone = p => catOf(p)?.tone || '#6B7280';
const recipeOf = pid => DB.product_recipe.filter(r => r.product_id === Number(pid));
const stockLeft = (p, t = T(), skipUid = null) => p.stock == null ? Infinity : p.stock - sum(t.items.filter(i => i.product_id === p.id && i.uid !== skipUid), i => i.quantity);
const inCatalog = () => DB.product.filter(p => p.in_catalog !== 0);

function renderCategories() {
    const cats = [{ id: 0, name: 'Todos', icon: 'layout-grid' }, ...DB.category];
    $id('catContainer').innerHTML = cats.map(c => {
        const n = inCatalog().filter(p => !c.id || p.category_id === c.id).length;
        return `<button type="button" class="cat-btn ${S.category === c.id ? 'active' : ''}" onclick="setCategory(${c.id})"><i data-lucide="${c.icon}"></i><span>${esc(c.name)}</span><small>${n}</small></button>`;
    }).join('');
    const subs = DB.subcategory.filter(s => s.category_id === S.category), wrap = $id('subcatContainer');
    wrap.classList.toggle('hidden', !subs.length);
    wrap.innerHTML = subs.length ? [{ id: 0, name: 'Todas' }, ...subs].map(s =>
        `<button type="button" class="sub-btn ${S.subcategory === s.id ? 'active' : ''}" onclick="setSubcategory(${s.id})">${esc(s.name)}</button>`).join('') : '';
    icons();
}
function setCategory(id) { S.category = id; S.subcategory = 0; renderCategories(); renderProducts(); }
function setSubcategory(id) { S.subcategory = id; renderCategories(); renderProducts(); }
const visibleProducts = () => inCatalog().filter(p => (!S.category || p.category_id === S.category) && (!S.subcategory || p.subcategory_id === S.subcategory));

function productBadge(p) {
    if (p.stock === 0) return ['Agotado', 't-red'];
    if (p.stock != null && p.stock <= 3) return [`Quedan ${p.stock}`, 't-amber'];
    if (p.kind === 'bundle') return ['Paquete', 't-purple'];
    if (modsOf(p.id).length) return ['Opciones', 't-sky'];
    return null;
}

function renderProducts() {
    const list = visibleProducts();
    $id('productGrid').innerHTML = list.map(p => {
        const b = productBadge(p);
        return `<button type="button" class="product-card ${p.stock === 0 ? 'is-out' : ''}" onclick="clickProduct(${p.id})" title="${esc(p.sku)}${p.barcode ? ' · ' + esc(p.barcode) : ''}">
            <span class="pc-top" style="--tone:${productTone(p)}"><i data-lucide="${productIcon(p)}" class="po-tone-ico w-7 h-7"></i>
                ${b ? `<span class="po-chip ${b[1]} pc-badge">${b[0]}</span>` : ''}
                ${p.stock > 0 ? `<span class="pc-stock" title="Existencia (Inventarios)">${p.stock}</span>` : ''}</span>
            <span class="pc-body"><span class="pc-name">${esc(p.name)}</span>
                <span class="pc-foot"><b>${fmt(p.price)}</b><span class="pc-add"><i data-lucide="plus" class="w-3.5 h-3.5"></i></span></span></span>
        </button>`;
    }).join('');
    $id('productEmpty').classList.toggle('hidden', list.length > 0);
    icons();
}

function clickProduct(id) {
    const p = product(id);
    if (!p) return;
    if (p.stock === 0) return swalWarn('Sin existencia', `${p.name} está agotado según Inventarios.`);
    if (modsOf(p.id).length) return openCustomModal(p.id);
    addItem(p);
}

// Mismo producto sin opciones ni notas → suma cantidad; si no, partida nueva
function addItem(p, extra = {}) {
    const t = T(), qty = extra.quantity || 1;
    if (stockLeft(p, t) < qty) return swalWarn('Existencia insuficiente', `Solo hay ${p.stock} de ${p.name} según Inventarios.`);
    const same = !extra.modifiers?.length && t.items.find(i => i.product_id === p.id && !i.modifiers.length && !i.dedication && !i.details && !i.disc);
    if (same) same.quantity += qty;
    else t.items.push(Object.assign({
        uid: uid(), product_id: p.id, name: p.name, details: '', dedication: '', price: p.price, quantity: qty, disc: null, modifiers: [], images: [],
        components: recipeOf(p.id).map(r => ({ product_id: r.component_id, name: product(r.component_id).name, quantity: r.quantity })),
    }, extra));
    renderTicket();
}

// -- Buscador (Ctrl+K): nombre, SKU o código de barras --
const FINDER_MAX = 8;
function finderList(q) {
    const n = norm(q).trim(), raw = q.trim();
    if (!n) return [];
    return inCatalog().filter(p => norm(p.name).includes(n) || norm(p.sku).includes(n) || String(p.barcode || '').includes(raw)).slice(0, FINDER_MAX);
}
// Lector de código de barras: el código o el SKU exacto agregan directo
const finderExact = q => { const raw = q.trim(); return raw ? inCatalog().find(p => p.barcode === raw || norm(p.sku) === norm(raw)) : null; };

function renderFinder() {
    const f = S.finder, box = $id('searchResults'), q = f.q.trim();
    if (!q) return box.classList.add('hidden');
    const rows = f.list.map((p, k) => {
        const b = productBadge(p);
        return `<button type="button" class="fd-item ${k === f.idx ? 'active' : ''}" onmousedown="event.preventDefault()" onclick="pickFinder(${k})" onmousemove="hoverFinder(${k})">
            <span class="fd-ico" style="--tone:${productTone(p)}"><i data-lucide="${productIcon(p)}" class="po-tone-ico w-4 h-4"></i></span>
            <span class="flex-1 min-w-0"><span class="block truncate text-[13px] font-semibold text-gray-900">${esc(p.name)}</span>
                <span class="block truncate text-[11px] text-gray-500">${esc(p.sku)}${p.stock != null ? ` · Existencia ${p.stock}` : ''}</span></span>
            ${b ? `<span class="po-chip ${b[1]}">${b[0]}</span>` : ''}<b class="text-[13px] text-gray-900">${fmt(p.price)}</b></button>`;
    });
    const k = f.list.length;
    rows.push(`<button type="button" class="fd-item fd-create ${f.idx === k ? 'active' : ''}" onmousedown="event.preventDefault()" onclick="pickFinder(${k})" onmousemove="hoverFinder(${k})">
        <span class="fd-ico"><i data-lucide="plus" class="w-4 h-4"></i></span><span class="flex-1 min-w-0 truncate text-[13px]">Crear producto «<b>${esc(q)}</b>»</span>
        <span class="text-[11px] text-gray-500">captura manual</span></button>`);
    box.innerHTML = (k ? '' : '<p class="px-3 pt-2.5 pb-1 text-[11px] text-gray-500">Sin coincidencias en el catálogo.</p>') + rows.join('');
    box.classList.remove('hidden');
    icons();
    box.querySelector('.fd-item.active')?.scrollIntoView({ block: 'nearest' });
}
function hoverFinder(k) {
    if (S.finder.idx === k) return;
    S.finder.idx = k;
    $id('searchResults').querySelectorAll('.fd-item').forEach((el, n) => el.classList.toggle('active', n === k));
}
function openFinder() { const v = $id('inputSearch').value; S.finder = { q: v, idx: 0, list: finderList(v) }; renderFinder(); }
function closeFinder() { $id('searchResults').classList.add('hidden'); }
function resetFinder() { $id('inputSearch').value = ''; S.finder = { q: '', idx: 0, list: [] }; closeFinder(); }
function pickFinder(k) {
    const f = S.finder, q = f.q.trim();
    if (k < f.list.length) { const p = f.list[k]; resetFinder(); clickProduct(p.id); }
    else if (q) { resetFinder(); openManualModal(q); }
    if (!topModal()) $id('inputSearch').focus();   // escaneo seguido
}
function focusFinder() {
    if (S.view !== 'vender') setView('vender');
    document.body.classList.remove('ticket-open');
    const inp = $id('inputSearch');
    inp.focus(); inp.select();
}
function bindFinder() {
    const inp = $id('inputSearch');
    inp.addEventListener('input', openFinder);
    inp.addEventListener('focus', () => { if (inp.value.trim()) openFinder(); });
    inp.addEventListener('keydown', e => {
        const open = !$id('searchResults').classList.contains('hidden');
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (!inp.value.trim()) return;
            e.preventDefault();
            if (!open || S.finder.q !== inp.value) return openFinder();
            const n = S.finder.list.length + 1;
            S.finder.idx = (S.finder.idx + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
            renderFinder();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (!inp.value.trim()) return;
            const exact = finderExact(inp.value);
            if (exact) { resetFinder(); clickProduct(exact.id); if (!topModal()) inp.focus(); return; }
            if (S.finder.q !== inp.value) openFinder();
            pickFinder(S.finder.idx);
        } else if (e.key === 'Escape') {
            e.stopPropagation();
            if (open) closeFinder(); else if (inp.value) resetFinder(); else inp.blur();
        } else if (e.key === 'Tab') closeFinder();
    });
    document.addEventListener('mousedown', e => { if (!e.target.closest('#finderWrap')) closeFinder(); });
}

// -- Totales --
const modsUnit = i => round2(sum(i.modifiers || [], m => m.price * m.quantity));
const lineGross = i => round2((i.price + modsUnit(i)) * i.quantity);
const discAmount = (d, base) => !d ? 0 : Math.min(base, round2(d.type === 'pct' ? base * d.value / 100 : d.value));
const lineDisc = i => discAmount(i.disc, lineGross(i));

// Orden: descuento de partida → descuento de cuenta → descuento de tarjeta. La propina va aparte.
function calcTicket(t = T()) {
    const gross = round2(sum(t.items, lineGross));
    const lineDiscounts = round2(sum(t.items, lineDisc));
    const subtotal = round2(gross - lineDiscounts);              // sale.subtotal
    const accDisc = discAmount(t.discount, subtotal);
    const ct = cardTypeOf(t.card_id ? byId(DB.card, t.card_id) : null);
    const cardDisc = ct ? round2((subtotal - accDisc) * ct.discount_percent / 100) : 0;
    const total = round2(subtotal - accDisc - cardDisc);         // sale.total
    const sale = t.editing_sale_id ? saleById(t.editing_sale_id) : null;
    const prevTip = sale ? sale.tip_amount || 0 : 0, paid = sale ? salePaid(sale) : 0;   // la propina ya cobrada también cuenta
    return { gross, lineDiscounts, subtotal, accDisc, cardDisc, ct, total, prevTip, paid, due: Math.max(0, round2(total + prevTip - paid)), pieces: sum(t.items, i => i.quantity) };
}

// -- Pestañas y modo (venta / pedido) --
function renderTabs() {
    $id('ticketTabs').innerHTML = S.tickets.map(t => {
        const n = sum(t.items, i => i.quantity), ped = t.sale_type_id === 1;
        return `<button type="button" class="tab-ticket ${t.uid === S.activeId ? 'active' : ''}" onclick="switchTicket('${t.uid}')" title="${esc(t.label)}">
            <i data-lucide="${ped ? 'calendar-days' : 'receipt'}" class="w-3.5 h-3.5 ${ped ? 'text-orange-600' : ''}"></i><span>${esc(t.label)}</span>${n ? `<span class="tab-n">${n}</span>` : ''}
            ${S.tickets.length > 1 ? `<span role="button" class="tab-x" onclick="event.stopPropagation(); closeTicket('${t.uid}')" title="Cerrar ticket"><i data-lucide="x" class="w-3 h-3"></i></span>` : ''}</button>`;
    }).join('') + `<button type="button" class="tab-add" onclick="newTicket()" title="Nuevo ticket"><i data-lucide="plus" class="w-4 h-4"></i></button>`;
}
function newTicket() {
    const n = Math.max(0, ...S.tickets.map(t => Number((t.label.match(/\d+/) || [0])[0]))) + 1;
    const t = blankTicket(n);
    S.tickets.push(t); S.activeId = t.uid; renderTicket();
}
function switchTicket(id) { S.activeId = id; renderTicket(); }
async function closeTicket(id) {
    const t = S.tickets.find(x => x.uid === id);
    if (t.items.length && !(await swalConfirm('¿Cerrar ticket?', `${t.label} tiene ${t.items.length} partida(s) sin cobrar.`, 'Sí, cerrar'))) return;
    S.tickets = S.tickets.filter(x => x.uid !== id);
    if (!S.tickets.length) S.tickets.push(blankTicket(1));
    if (!T()) S.activeId = S.tickets[S.tickets.length - 1].uid;
    renderTicket();
}
// Cuenta en espera (CoffeePOS): el ticket se queda en su pestaña y se abre uno nuevo
function holdTicket() {
    const t = T();
    if (!t.items.length) return toast('El ticket está vacío', 'info');
    newTicket();
    toast(`${t.label} quedó en espera`);
}
function setMode(m) {
    const t = T();
    t.sale_type_id = m;
    if (m === 1) { t.pedidoOpen = true; if (isPublic(t.customer_id)) setTimeout(focusCustomer, 50); }
    renderTicket();
}

// -- Cliente (F8) --
function renderCustomer() {
    const t = T(), c = t.customer_id ? customer(t.customer_id) : null, searching = !c || !!S.custSearch;
    const sel = $id('customerSelected');
    sel.classList.toggle('hidden', searching); sel.classList.toggle('flex', !searching);
    $id('customerSearchWrap').classList.toggle('hidden', !searching);
    $id('btnCancelCustSearch').classList.toggle('hidden', !(c && S.custSearch));
    const chips = [];
    if (c) {
        const card = t.card_id ? byId(DB.card, t.card_id) : null, ct = cardTypeOf(card), debt = customerDebt(c.id);
        $id('custAvatar').textContent = initials(c.name);
        $id('custName').textContent = c.name;
        $id('custPhone').textContent = [c.phone, card ? `Tarjeta ${card.number}` : ''].filter(Boolean).join(' · ') || 'Sin teléfono';
        if (ct) chips.push(`<span class="po-chip t-purple"><i data-lucide="id-card"></i>${esc(ct.name)}${ct.discount_percent ? ` · −${ct.discount_percent}%` : ''}${ct.points_percent ? ` · ${ct.points_percent}% en monedero` : ''}</span>`);
        if (c.wallet > 0) chips.push(`<span class="po-chip t-green"><i data-lucide="wallet"></i>Monedero ${fmt(c.wallet)}</span>`);
        if (c.credit_enabled) chips.push(`<span class="po-chip t-sky"><i data-lucide="landmark"></i>Crédito disponible ${fmt(creditAvailable(c.id))}</span>`);
        if (debt > 0) chips.push(`<button type="button" class="po-chip t-red" onclick="openHistorial('cobrar', ${c.id})"><i data-lucide="circle-alert"></i>Debe ${fmt(debt)}</button>`);
        const pend = DB.sale.filter(s => s.customer_id === c.id && s.sale_type_id === 1 && s.sale_status_id === 2).length;
        if (pend) chips.push(`<button type="button" class="po-chip t-orange" onclick="openHistorial('pedidos', ${c.id})"><i data-lucide="calendar-clock"></i>${pend} pedido(s) pendiente(s)</button>`);
    }
    $id('customerChips').innerHTML = chips.join('');
    $id('customerChips').classList.toggle('hidden', !chips.length || searching);
}
function focusCustomer() {
    if (S.view !== 'vender') setView('vender');
    document.body.classList.add('ticket-open');
    if (T().customer_id) { S.custSearch = true; renderCustomer(); icons(); }
    const inp = $id('inputCustomer');
    inp.focus(); inp.select();
}
function endCustomerSearch() {
    $id('customerResults').classList.add('hidden');
    if (!S.custSearch) return;
    S.custSearch = false;
    $id('inputCustomer').value = '';
    renderCustomer(); icons();
}
function bindCustomerSearch() {
    const inp = $id('inputCustomer'), box = $id('customerResults');
    const show = () => {
        const raw = inp.value.trim(), q = norm(raw);
        if (!q) return box.classList.add('hidden');
        const list = DB.customer.filter(c => norm(c.name).includes(q) || (c.phone || '').includes(q)
            || DB.card.some(k => k.customer_id === c.id && norm(k.number).includes(q))).slice(0, 8);
        box.innerHTML = (list.length ? '' : '<p class="px-3 pt-2.5 pb-1 text-[11px] text-gray-500">Sin resultados.</p>') + list.map(c => {
            const card = cardOf(c.id);
            return `<button type="button" class="fd-item" onmousedown="event.preventDefault()" onclick="pickCustomer(${c.id})">
                <span class="po-avatar">${initials(c.name)}</span>
                <span class="flex-1 min-w-0"><span class="block truncate text-[13px] font-semibold text-gray-900">${esc(c.name)}</span>
                    <span class="block truncate text-[11px] text-gray-500">${esc(c.phone || 'Sin teléfono')}${card ? ` · ${esc(card.number)}` : ''}</span></span>
                ${card ? `<span class="po-chip t-purple">${esc(cardTypeOf(card).name)}</span>` : ''}</button>`;
        }).join('') + `<button type="button" class="fd-item fd-create" onmousedown="event.preventDefault()" onclick="openCustomerModal()">
                <span class="fd-ico"><i data-lucide="user-plus" class="w-4 h-4"></i></span><span class="flex-1 min-w-0 truncate text-[13px]">Crear cliente «<b>${esc(raw)}</b>»</span></button>`;
        box.classList.remove('hidden');
        icons();
    };
    inp.addEventListener('input', show);
    inp.addEventListener('focus', show);
    inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); (box.querySelector('button[onclick^="pickCustomer"]') || (inp.value.trim() ? box.querySelector('.fd-create') : null))?.click(); }
        if (e.key === 'Escape') { e.stopPropagation(); endCustomerSearch(); inp.blur(); }
    });
    document.addEventListener('mousedown', e => { if (!e.target.closest('#customerSearchWrap, #customerResults')) endCustomerSearch(); });
}
function pickCustomer(id) {
    const t = T();
    t.customer_id = Number(id); t.card_id = cardOf(id)?.id || null;
    S.custSearch = false;
    $id('inputCustomer').value = ''; $id('customerResults').classList.add('hidden');
    renderTicket();
}
function clearCustomer() { const t = T(); t.customer_id = null; t.card_id = null; S.custSearch = false; renderTicket(); }

// -- Vendedor: quién atendió (seller_id NO existe en fayxzvov_pos) --
function renderSeller() { $id('lblSeller').textContent = userName(T().seller_id); }
function openSellerModal() {
    const t = T();
    $id('sellerList').innerHTML = DB.sellers.map(id => `<button type="button" class="po-opt ${t.seller_id === id ? 'active' : ''}" onclick="pickSeller(${id})">
        <span class="flex items-center gap-2"><span class="po-avatar">${initials(userName(id))}</span><span class="text-[13px] font-semibold text-gray-900">${esc(userName(id))}</span></span>
        <span class="text-[11px] text-gray-500">${id === DB.user.id ? 'Tú · sesión actual' : 'Vendedor'}</span></button>`).join('');
    openModal('modalVendedor');
}
function pickSeller(id) { T().seller_id = Number(id); closeModal('modalVendedor'); renderTicket(); toast(`Atiende ${userName(id)}`); }

// -- Datos del pedido --
function renderPedidoPanel() {
    const t = T(), ped = t.sale_type_id === 1;
    $id('pedidoPanel').classList.toggle('hidden', !ped);
    if (!ped) return;
    $id('pedidoBody').classList.toggle('hidden', !t.pedidoOpen);
    $id('icoPedidoPanel').style.transform = t.pedidoOpen ? 'rotate(180deg)' : '';
    $id('pDeliveryDate').value = t.delivery_date || '';
    $id('pDeliveryTime').value = t.delivery_time || '';
    $id('pBirthday').value = t.birthday_date || '';
    if (document.activeElement !== $id('pLocation')) $id('pLocation').value = t.location || '';
    $id('segDelivery').querySelectorAll('button').forEach(b => b.classList.toggle('active', Number(b.dataset.v) === Number(t.delivery_method)));
    $id('wrapLocation').classList.toggle('hidden', Number(t.delivery_method) !== 1);
    $id('lblPedidoResumen').textContent = [t.delivery_date ? `${dayName(t.delivery_date)} ${fmtDate(t.delivery_date)}` : 'Sin fecha',
        t.delivery_time, Number(t.delivery_method) ? 'A domicilio' : 'Recoge'].filter(Boolean).join(' · ');
}
function togglePedidoPanel() { const t = T(); t.pedidoOpen = !t.pedidoOpen; renderPedidoPanel(); saveTickets(); }
function setPedidoField(f, v) {
    const t = T();
    t[f] = f === 'delivery_method' ? Number(v) : v;
    if (f !== 'location') renderPedidoPanel();   // la dirección no se re-pinta para no perder el cursor
    saveTickets();
}

// -- Ticket: pintar --
function renderTicket() {
    const t = T();
    renderTabs();
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.mode) === t.sale_type_id));
    const editing = t.editing_sale_id ? saleById(t.editing_sale_id) : null, chip = $id('chipEditing');
    chip.classList.toggle('hidden', !editing);
    chip.innerHTML = editing ? `<i data-lucide="pencil"></i>Editando ${esc(folioLabel(editing))}` : '';
    $id('lblFolio').textContent = '#' + (editing ? editing.folio : nextId(DB.sale));
    $id('lblBtnNota').textContent = t.note ? 'Nota •' : 'Nota';
    renderCustomer(); renderSeller(); renderPedidoPanel(); renderCart(); renderTotals();
    saveTickets(); icons();
}

// -- Ticket: partidas --
const cartIcon = i => i.is_custom ? 'cake' : i.product_id && product(i.product_id) ? productIcon(product(i.product_id)) : 'pencil-line';
const discTag = d => !d ? '' : d.type === 'pct' ? `-${d.value}%` : `-${fmtSmart(d.value)}`;

// Renglones bajo el nombre: opciones, detalles, componentes, dedicatoria y fotos
function lineSub(i) {
    const out = [], mods = i.is_custom ? i.custom_mods : i.modifiers;
    if (mods?.length) out.push(`<p class="ci-sub text-blue-600" title="${esc(modsText(mods))}">${esc(modsText(mods))}</p>`);
    if (i.details) out.push(`<p class="ci-sub text-gray-500" title="${esc(i.details)}">${esc(i.details)}</p>`);
    if (i.components?.length) out.push(`<p class="ci-sub text-violet-600">Incluye: ${esc(i.components.map(c => `${c.quantity}× ${c.name}`).join(', '))}</p>`);
    if (i.dedication) out.push(`<p class="ci-sub text-amber-600 italic">«${esc(i.dedication)}»</p>`);
    if (i.images?.length) out.push(`<p class="ci-sub text-gray-500 flex items-center gap-1"><i data-lucide="image" class="w-3 h-3"></i>${i.images.length} foto(s)</p>`);
    return out.join('');
}

function renderCart() {
    const t = T(), has = t.items.length > 0, prev = new Set(S.renderedUids || []);
    $id('contenedorProductos').classList.toggle('hidden', !has);
    $id('cartEmpty').classList.toggle('hidden', has);
    $id('contenedorProductos').innerHTML = t.items.map(i => {
        const gross = lineGross(i), disc = lineDisc(i), unit = round2(i.price + modsUnit(i));
        const badge = i.is_custom ? '<span class="po-chip t-purple">Personalizado</span>' : !i.product_id ? '<span class="po-chip t-gray">Manual</span>' : '';
        return `<div class="cart-item ${prev.has(i.uid) ? '' : 'is-new'} ${disc ? 'has-disc' : ''}">
            <button type="button" class="ci-ico" onclick="openLineModal('${i.uid}')" title="Editar partida"><i data-lucide="${cartIcon(i)}" class="w-4 h-4"></i></button>
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 min-w-0"><button type="button" class="ci-name" onclick="openLineModal('${i.uid}')" title="${esc(i.name)}">${esc(i.name)}</button>${badge}</div>
                ${lineSub(i)}
                <div class="flex items-center gap-2 mt-1.5">
                    <div class="po-qty">
                        <button type="button" onclick="changeQty('${i.uid}', -1)" title="${i.quantity === 1 ? 'Quitar' : 'Uno menos'}"><i data-lucide="${i.quantity === 1 ? 'trash-2' : 'minus'}"></i></button>
                        <b>${i.quantity}</b>
                        <button type="button" onclick="changeQty('${i.uid}', 1)" title="Uno más"><i data-lucide="plus"></i></button>
                    </div>
                    <span class="text-[11px] text-gray-500">× ${fmtSmart(unit)}</span>
                    ${i.disc ? `<span class="po-chip t-amber" title="${esc(reason(i.disc.reason_id)?.name || 'Descuento')}">${discTag(i.disc)}</span>` : ''}
                </div>
            </div>
            <div class="flex flex-col items-end gap-1 flex-shrink-0">
                ${disc ? `<span class="text-[11px] text-gray-400 line-through leading-none">${fmtSmart(gross)}</span>` : ''}
                <b class="text-[14px] text-gray-900 leading-tight">${fmtSmart(gross - disc)}</b>
                <div class="ci-actions">
                    <button type="button" class="po-icon-btn sm" onclick="openDiscountModal('linea', '${i.uid}')" title="Descuento a la partida"><i data-lucide="tag"></i></button>
                    <button type="button" class="po-icon-btn sm danger" onclick="removeItem('${i.uid}')" title="Quitar"><i data-lucide="x"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
    S.renderedUids = t.items.map(i => i.uid);
}

// -- Ticket: totales y botón de cobro --
function renderTotals() {
    const t = T(), c = calcTicket(t), editing = !!t.editing_sale_id, ped = t.sale_type_id === 1;
    const r = t.discount ? reason(t.discount.reason_id) : null;
    $id('lblSubtotal').textContent = fmt(c.subtotal);
    $id('rowDescuento').classList.toggle('hidden', !c.accDisc);
    $id('lblDescuentoTxt').textContent = ['Descuento', r?.name, t.discount?.type === 'pct' ? `${t.discount.value}%` : ''].filter(Boolean).join(' · ');
    $id('lblDescuento').textContent = '-' + fmt(c.accDisc);
    $id('rowTarjeta').classList.toggle('hidden', !c.cardDisc);
    $id('lblTarjetaTxt').textContent = c.ct ? `Tarjeta ${c.ct.name} ${c.ct.discount_percent}%` : 'Tarjeta';
    $id('lblTarjeta').textContent = '-' + fmt(c.cardDisc);
    $id('lblIva').textContent = fmt(round2(c.total - c.total / 1.16));   // informativo: fayxzvov_pos no guarda impuestos
    $id('lblTotal').textContent = fmt(c.total);
    $id('rowPagado').classList.toggle('hidden', !c.paid);
    $id('lblPagado').textContent = '-' + fmt(c.paid);
    $id('rowSaldo').classList.toggle('hidden', !c.paid);
    $id('lblSaldo').textContent = fmt(c.due);
    const n = t.items.length;
    $id('lblItemsCount').textContent = `${n} partida${n === 1 ? '' : 's'} · ${c.pieces} pza${c.pieces === 1 ? '' : 's'}`
        + (c.lineDiscounts ? ` · −${fmt(c.lineDiscounts)} en partidas` : '');
    $id('lblMobileCount').textContent = c.pieces;
    $id('lblMobileTotal').textContent = fmt(c.total);
    const sale = editing ? saleById(t.editing_sale_id) : null, isQuote = sale?.sale_status_id === 1;
    const [label, amount] = isQuote ? ['Cobrar cotización', c.due] : editing ? (c.due > 0 ? ['Cobrar saldo', c.due] : ['Guardar cambios', null])
        : ped ? ['Cobrar pedido', c.total] : ['Cobrar', c.total];
    $id('lblBtnPagar').textContent = label;
    $id('lblBtnPagarAmt').textContent = amount == null ? '' : fmt(amount);
    const btn = $id('btnPagar'), warn = ped && (!editing || isQuote);
    btn.classList.toggle('po-btn-warn', warn);
    btn.classList.toggle('po-btn-ok', !warn);
    btn.disabled = !t.items.length;
    $id('btnCotizar').classList.toggle('hidden', editing && !isQuote);
}

// -- Ticket: cantidades y limpieza --
function changeQty(id, d) {
    const t = T(), i = t.items.find(x => x.uid === id);
    if (!i) return;
    const q = i.quantity + d;
    if (q <= 0) return removeItem(id);
    const p = i.product_id ? product(i.product_id) : null;
    if (d > 0 && p && stockLeft(p, t, id) < q) return swalWarn('Existencia insuficiente', `Solo hay ${p.stock} de ${p.name} según Inventarios.`);
    i.quantity = q;
    renderTicket();
}
function removeItem(id) { const t = T(); t.items = t.items.filter(x => x.uid !== id); renderTicket(); }
// F3 (CoffeePOS): quita la última partida
function removeLastItem() {
    const t = T(), i = t.items[t.items.length - 1];
    if (!i) return toast('El ticket está vacío', 'info');
    removeItem(i.uid);
    toast(`Se quitó ${i.name}`, 'info');
}
// F5 (CoffeePOS): descuento a la última partida
function discountLastLine() {
    const t = T(), i = t.items[t.items.length - 1];
    if (!i) return swalWarn('Ticket vacío', 'Agrega productos antes de aplicar un descuento.');
    openDiscountModal('linea', i.uid);
}
function resetTicket(t, keepType = true) {
    const keep = { uid: t.uid, label: t.label, sale_type_id: keepType ? t.sale_type_id : 3 };
    Object.keys(t).forEach(k => delete t[k]);
    Object.assign(t, blankTicket(1), keep);
}
async function clearTicket() {
    const t = T();
    if (!t.items.length && !t.customer_id && !t.note && !t.discount && !t.editing_sale_id) return;
    const msg = t.editing_sale_id ? 'Se descartan los cambios. La venta guardada no cambia.' : 'Se quitan productos, cliente, nota y descuento.';
    if (!(await swalConfirm('¿Vaciar ticket?', msg, 'Sí, vaciar'))) return;
    resetTicket(t);
    renderTicket();
}
// Abrir cajón (CoffeePOS): sin tabla en fayxzvov_pos, solo aviso
function openDrawer() { if (!requireTurn()) return; toast('Cajón abierto'); }

// -- Nota de la venta (sale.note) --
const NOTA_QUICK = ['Sin azúcar', 'Para llevar', 'Llamar al llegar', 'Entregar en recepción', 'Empaque de regalo', 'Pagará al recoger'];
function openNotaModal() {
    $id('notaText').value = T().note || '';
    $id('notaQuick').innerHTML = NOTA_QUICK.map(q => `<button type="button" class="po-chip t-gray" onclick="appendNota('${q}')">+ ${q}</button>`).join('');
    openModal('modalNota');
    setTimeout(() => $id('notaText').focus(), 60);
}
function appendNota(q) { const el = $id('notaText'), cur = el.value.trim(); el.value = cur ? `${cur.replace(/[.\s]+$/, '')}. ${q}` : q; el.focus(); }
function saveNota() { T().note = $id('notaText').value.trim(); closeModal('modalNota'); renderTicket(); }

// -- Captura manual (detail_sale.product_id = NULL) --
function openManualModal(name = '') {
    ['maPrice', 'maDetails'].forEach(id => $id(id).value = '');
    $id('maName').value = name; $id('maQty').value = 1;
    openModal('modalManual');
    setTimeout(() => $id(name ? 'maPrice' : 'maName').focus(), 60);
}
function addManualToCart() {
    const name = $id('maName').value.trim(), price = round2($id('maPrice').value), quantity = Math.floor(Number($id('maQty').value));
    if (!name) return swalWarn('Falta la descripción', 'Escribe qué se está vendiendo.');
    if (!(price > 0)) return swalWarn('Precio inválido', 'El precio debe ser mayor a cero.');
    if (!(quantity >= 1)) return swalWarn('Cantidad inválida', 'La cantidad mínima es 1.');
    T().items.push({ uid: uid(), product_id: null, name: name.slice(0, 255), details: $id('maDetails').value.trim().slice(0, 255), dedication: '', price, quantity, disc: null, modifiers: [], images: [], components: [] });
    closeModal('modalManual'); renderTicket();
}

// -- Detalle de la partida --
function openLineModal(id) {
    const i = T().items.find(x => x.uid === id);
    if (!i) return;
    const p = i.product_id ? product(i.product_id) : null, mods = i.is_custom ? i.custom_mods : i.modifiers;
    S.lineUid = id; S.lineImages = [...(i.images || [])];
    $id('lineName').textContent = i.name + (i.is_custom ? ' · personalizado' : p ? ` · ${p.sku}` : ' · captura manual');
    $id('lineQty').value = i.quantity; $id('linePrice').value = i.price;
    $id('linePriceHint').textContent = i.is_custom ? 'Precio acordado del personalizado'
        : p ? `Catálogo ${fmt(p.price)}${modsUnit(i) ? ` · opciones +${fmt(modsUnit(i))} por pieza` : ''}` : 'Precio abierto (captura manual)';
    const canMods = i.is_custom || (p && modsOf(p.id).length);
    $id('lineMods').classList.toggle('hidden', !canMods);
    $id('lineMods').innerHTML = !canMods ? '' : `<div class="flex items-start gap-2">
        <i data-lucide="sliders-horizontal" class="w-3.5 h-3.5 mt-0.5 text-blue-600 flex-shrink-0"></i>
        <p class="flex-1">${mods?.length ? esc(modsText(mods)) : 'Sin opciones elegidas'}</p>
        <button type="button" class="text-blue-600 font-semibold hover:underline" onclick="closeModal('modalLine'); openCustomModal(${i.is_custom ? 'null' : p.id}, '${i.uid}')">Cambiar</button></div>`;
    $id('lineDedication').value = i.dedication || ''; $id('lineDetails').value = i.details || '';
    renderImages('line'); openModal('modalLine');
}
function stepInput(id, d) { const el = $id(id); el.value = Math.max(Number(el.min || 0), (Number(el.value) || 0) + d); }
function saveLine() {
    const t = T(), i = t.items.find(x => x.uid === S.lineUid);
    if (!i) return closeModal('modalLine');
    const quantity = Math.floor(Number($id('lineQty').value)), price = round2($id('linePrice').value);
    if (!(quantity >= 1)) return swalWarn('Cantidad inválida', 'La cantidad mínima es 1.');
    if ($id('linePrice').value === '' || price < 0) return swalWarn('Precio inválido', 'Escribe un precio válido.');
    const p = i.product_id ? product(i.product_id) : null;
    if (p && quantity > i.quantity && stockLeft(p, t, i.uid) < quantity) return swalWarn('Existencia insuficiente', `Solo hay ${p.stock} de ${p.name} según Inventarios.`);
    const apply = () => {
        Object.assign(i, { quantity, price, images: [...S.lineImages], dedication: $id('lineDedication').value.trim().slice(0, 255), details: $id('lineDetails').value.trim().slice(0, 255) });
        closeModal('modalLine'); renderTicket();
    };
    // Bajar el precio de catálogo es un descuento sin motivo: lo autoriza un gerente
    const base = p && !i.is_custom ? p.price : null;
    if (base != null && price < base) return askPin(`Precio menor al de catálogo (${fmt(base)} → ${fmt(price)})`, apply);
    apply();
}

// -- Fotos de la partida (sale_image) --
const imgList = target => target === 'custom' ? S.custom.images : S.lineImages;
function addImages(input, target) {
    [...input.files].forEach(f => imgList(target).push({ name: `${Date.now()}-${f.name}`, original_name: f.name, url: URL.createObjectURL(f) }));
    input.value = '';
    renderImages(target);
}
function removeImage(target, idx) { imgList(target).splice(idx, 1); renderImages(target); }
function renderImages(target) {
    $id(target === 'custom' ? 'customImages' : 'lineImages').innerHTML = imgList(target).map((img, k) => `
        <div class="relative aspect-square rounded-md overflow-hidden border border-gray-200">
            <img src="${img.url}" alt="${esc(img.original_name)}" class="w-full h-full object-cover">
            <button type="button" onclick="removeImage('${target}', ${k})" class="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center" title="Quitar foto"><i data-lucide="x" class="w-2.5 h-2.5"></i></button>
        </div>`).join('');
    icons();
}

// -- Cliente nuevo (customer + card) --
function openCustomerModal() {
    const q = $id('inputCustomer').value.trim(), isPhone = /^[\d\s()+-]{7,}$/.test(q);
    $id('cuName').value = isPhone ? '' : q;
    $id('cuPhone').value = isPhone ? q.replace(/\D/g, '').slice(-10) : '';
    ['cuEmail', 'cuCreditLimit', 'cuCardNumber'].forEach(id => $id(id).value = '');
    $id('cuCredit').checked = false; $id('cuCreditLimit').disabled = true;
    $id('cuCardType').innerHTML = DB.card_type.map(ct => `<option value="${ct.id}">${esc(ct.name)}${ct.discount_percent ? ` · −${ct.discount_percent}%` : ''}${ct.points_percent ? ` · ${ct.points_percent}% en monedero` : ''}</option>`).join('');
    $id('customerResults').classList.add('hidden');
    openModal('modalCustomer');
    setTimeout(() => $id(q && !isPhone ? 'cuPhone' : 'cuName').focus(), 60);
}
function saveCustomer() {
    const name = $id('cuName').value.trim(), phone = $id('cuPhone').value.replace(/\D/g, ''), email = $id('cuEmail').value.trim();
    const credit = $id('cuCredit').checked, limit = round2($id('cuCreditLimit').value), number = $id('cuCardNumber').value.trim().toUpperCase();
    if (!name) return swalWarn('Falta el nombre', 'El nombre del cliente es obligatorio.');
    if (phone && phone.length !== 10) return swalWarn('Teléfono inválido', 'Escribe 10 dígitos.');
    if (phone && DB.customer.some(c => c.phone === phone)) return swalWarn('Teléfono repetido', `Ya existe un cliente con el teléfono ${phone}.`);
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return swalWarn('Correo inválido', 'Revisa el formato del correo.');
    if (credit && !(limit > 0)) return swalWarn('Falta el límite', 'Con crédito habilitado, el límite debe ser mayor a cero.');
    if (number && DB.card.some(k => k.number.toUpperCase() === number)) return swalWarn('Tarjeta repetida', `La tarjeta ${number} ya está asignada.`);
    const id = nextId(DB.customer), now = nowStamp();
    DB.customer.push({ id, name: name.slice(0, 255), phone, email, wallet: 0, credit_limit: credit ? limit : 0, credit_enabled: credit ? 1 : 0, created_at: now, updated_at: now, branch_id: DB.branch.id, active: 1 });
    if (number) DB.card.push({ id: nextId(DB.card), number: number.slice(0, 40), holder: name.slice(0, 150), branch_id: DB.branch.id, card_type_id: Number($id('cuCardType').value), customer_id: id, active: 1 });
    closeModal('modalCustomer');
    if (S.view === 'clientes' && typeof renderClientes === 'function') renderClientes();
    if (S.view === 'vender') pickCustomer(id);
    toast('Cliente guardado');
}

// -- Consulta de precios (F6, CoffeePOS) --
function openPreciosModal() {
    $id('prSearch').value = '';
    renderPrecios();
    openModal('modalPrecios');
    setTimeout(() => $id('prSearch').focus(), 60);
}
function renderPrecios() {
    const raw = $id('prSearch').value.trim(), q = norm(raw);
    const list = inCatalog().filter(p => !q || norm(p.name).includes(q) || norm(p.sku).includes(q) || String(p.barcode || '').includes(raw));
    $id('prList').innerHTML = !list.length ? '<p class="py-8 text-center text-[13px] text-gray-500">Sin coincidencias en el catálogo.</p>'
        : `<table class="po-table w-full"><thead><tr><th>Producto</th><th class="hidden sm:table-cell">Código</th><th class="text-right">Existencia</th><th class="text-right">Precio</th><th></th></tr></thead>
        <tbody>${list.map(p => `<tr>
            <td><span class="block font-semibold text-gray-900">${esc(p.name)}</span><span class="block text-[11px] text-gray-500">${esc(p.sku)}</span></td>
            <td class="hidden sm:table-cell text-gray-500">${esc(p.barcode || '—')}</td>
            <td class="text-right">${p.stock == null ? '<span class="text-gray-400">—</span>' : `<span class="po-chip ${p.stock === 0 ? 't-red' : p.stock <= 3 ? 't-amber' : 't-gray'}">${p.stock}</span>`}</td>
            <td class="text-right font-semibold text-gray-900">${fmt(p.price)}</td>
            <td class="text-right"><button type="button" class="po-btn po-btn-ghost sm" ${p.stock === 0 ? 'disabled' : ''} onclick="closeModal('modalPrecios'); if (S.view !== 'vender') setView('vender'); clickProduct(${p.id})">Agregar</button></td>
        </tr>`).join('')}</tbody></table>`;
    icons();
}

// -- Descuento (cuenta o partida): motivo, tope y autorización --
function openDiscountModal(target, uidLine) {
    const t = T(), i = target === 'linea' ? t.items.find(x => x.uid === uidLine) : null;
    if (!t.items.length) return swalWarn('Ticket vacío', 'Agrega productos antes de aplicar un descuento.');
    if (target === 'linea' && !i) return;
    const cur = i ? i.disc : t.discount;
    S.disc = { target, uid: i?.uid || null, type: cur?.type || 'pct', reason_id: cur?.reason_id || null };
    $id('discTarget').textContent = i ? `Partida: ${i.name}` : 'A toda la cuenta (después de los descuentos por partida)';
    $id('discValue').value = cur ? cur.value : '';
    $id('discNote').value = cur?.note || '';
    $id('btnQuitarDesc').classList.toggle('hidden', !cur);
    renderDiscReasons(); setDiscType(S.disc.type);
    openModal('modalDescuento');
    setTimeout(() => $id('discValue').focus(), 60);
}
function renderDiscReasons() {
    $id('discReasons').innerHTML = DB.discount_reason.map(r => `<button type="button" class="po-opt ${S.disc.reason_id === r.id ? 'active' : ''}" onclick="setDiscReason(${r.id})">
        <span class="text-[13px] font-semibold text-gray-900">${esc(r.name)}</span>
        <span class="text-[11px] text-gray-500">Tope ${r.max_percent}%${r.requires_authorization ? ' · pide PIN' : ''}</span></button>`).join('');
}
function setDiscReason(id) { S.disc.reason_id = id; renderDiscReasons(); calcDiscount(); }
function setDiscType(type) {
    S.disc.type = type;
    $id('segDiscType').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === type));
    const quick = type === 'pct' ? [5, 10, 15, 20, 50, 100] : [10, 20, 50, 100, 200, 500];
    $id('discQuick').innerHTML = quick.map(v => `<button type="button" class="po-btn po-btn-ghost sm" onclick="$id('discValue').value = ${v}; calcDiscount()">${type === 'pct' ? v + '%' : '$' + v}</button>`).join('');
    calcDiscount();
}
const discBase = () => { const t = T(), i = S.disc.target === 'linea' ? t.items.find(x => x.uid === S.disc.uid) : null; return i ? lineGross(i) : calcTicket(t).subtotal; };
function discCheck() {
    const base = discBase(), value = Math.max(0, round2($id('discValue').value)), r = reason(S.disc.reason_id);
    const amount = discAmount({ type: S.disc.type, value }, base), pct = base ? round2(amount * 100 / base) : 0;
    const overCap = !!r && pct > r.max_percent;
    return { base, value, r, amount, pct, overCap, needPin: !!r && (!!r.requires_authorization || overCap) };
}
function calcDiscount() {
    const k = discCheck();
    $id('discBase').textContent = fmt(k.base);
    $id('discCalc').textContent = `-${fmt(k.amount)} (${k.pct} %)`;
    $id('discFinal').textContent = fmt(round2(k.base - k.amount));
    const msgs = !k.r ? ['Elige un motivo: se guarda en discount_reason_id.'] : [
        k.overCap ? `${k.r.name} permite hasta ${k.r.max_percent}%; arriba de eso autoriza un gerente.` : '',
        k.r.requires_authorization ? `${k.r.name} requiere PIN de gerente.` : '',
        k.r.code === 'OTRO' ? 'Con «Otro motivo» la nota es obligatoria.' : '',
    ].filter(Boolean);
    $id('discWarnTxt').textContent = msgs.join(' ');
    $id('discWarn').classList.toggle('hidden', !msgs.length);
}
function applyDiscount() {
    const k = discCheck(), note = $id('discNote').value.trim();
    if (!k.r) return swalWarn('Falta el motivo', 'Elige por qué se hace el descuento.');
    if (!(k.value > 0)) return swalWarn('Valor inválido', 'Escribe un descuento mayor a cero.');
    if (S.disc.type === 'pct' && k.value > 100) return swalWarn('Porcentaje inválido', 'El máximo es 100%.');
    if (S.disc.type === 'amt' && k.value > k.base) return swalWarn('Descuento mayor al importe', `El importe es ${fmt(k.base)}.`);
    if (k.r.code === 'OTRO' && !note) return swalWarn('Falta la nota', 'Con «Otro motivo» explica el descuento.');
    const save = (user_id = DB.user.id) => {
        const t = T(), d = { type: S.disc.type, value: k.value, reason_id: k.r.id, note: note.slice(0, 255), user_id };
        if (S.disc.target === 'linea') { const i = t.items.find(x => x.uid === S.disc.uid); if (i) i.disc = d; }
        else t.discount = d;
        closeModal('modalDescuento'); renderTicket();
    };
    if (k.needPin) return askPin(`${k.r.name} · ${k.pct}% (−${fmt(k.amount)})`, save);
    save();
}
function removeDiscount() {
    const t = T();
    if (S.disc.target === 'linea') { const i = t.items.find(x => x.uid === S.disc.uid); if (i) i.disc = null; }
    else t.discount = null;
    closeModal('modalDescuento'); renderTicket();
}

// -- PIN de gerente (simulado: no vive en fayxzvov_pos) --
function askPin(reasonTxt, onOk) {
    S.pin = { value: '', onOk };
    $id('pinReason').textContent = reasonTxt;
    $id('pinError').textContent = '';
    $id('pinPad').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'del'].map(k =>
        `<button type="button" class="pin-key" onclick="pinKey('${k}')">${k === 'del' ? '<i data-lucide="delete" class="w-5 h-5"></i>' : k}</button>`).join('');
    renderPinDots();
    openModal('modalPin');
}
const renderPinDots = () => $id('pinDots').innerHTML = [0, 1, 2, 3].map(n => `<span class="pin-dot ${n < (S.pin?.value.length || 0) ? 'on' : ''}"></span>`).join('');
function pinKey(k) {
    if (!S.pin) return;
    if (k === 'C') S.pin.value = '';
    else if (k === 'del') S.pin.value = S.pin.value.slice(0, -1);
    else if (S.pin.value.length < 4) S.pin.value += k;
    $id('pinError').textContent = '';
    renderPinDots();
    if (S.pin.value.length === 4) setTimeout(checkPin, 120);
}
function checkPin() {
    if (!S.pin) return;
    const m = DB.managers.find(x => x.pin === S.pin.value);
    if (!m) {
        S.pin.value = ''; renderPinDots();
        $id('pinError').textContent = 'PIN incorrecto';
        const dots = $id('pinDots'); dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake');
        return;
    }
    const ok = S.pin.onOk;
    closePin();
    toast(`Autorizó ${m.name}`);
    ok(m.user_id);
}
function closePin() { S.pin = null; closeModal('modalPin'); }
document.addEventListener('keydown', e => {
    if (!S.pin || !$id('modalPin').classList.contains('open')) return;
    if (/^\d$/.test(e.key)) pinKey(e.key);
    else if (e.key === 'Backspace') pinKey('del');
    else if (e.key === 'Enter') checkPin();
    else if (e.key === 'Escape') closePin();
    else return;
    e.preventDefault(); e.stopPropagation();
}, true);

// -- Personalizado: pastel (product 90) o producto con opciones --
const optGroups = pid => [...new Set(modsOf(pid).map(m => m.modifier_group_id))].map(id => byId(DB.modifier_group, id));
const customMods = () => modsOf(S.custom.base).filter(m => S.custom.sel[m.id]).map(m => pickMod(m.id, S.custom.sel[m.id]));
function openCustomModal(pid = null, editUid = null) {
    const t = T(), old = editUid ? t.items.find(x => x.uid === editUid) : null;
    const isCake = !pid || !!old?.is_custom, base = isCake ? 90 : Number(pid), p = product(base), sel = {};
    const from = old ? (old.is_custom ? old.custom_mods : old.modifiers) : null;
    if (from?.length) from.forEach(m => sel[m.modifier_id] = m.quantity);
    else if (!isCake) optGroups(base).filter(g => !g.is_extra).forEach(g => sel[modsOf(base).find(m => m.modifier_group_id === g.id).id] = 1);   // bebida: opción de la casa
    S.custom = { base, isCake, editUid: old?.uid || null, sel, images: old ? [...(old.images || [])] : [], priceTouched: !!(old && isCake) };
    $id('customTitle').textContent = isCake ? 'Pastel personalizado' : p.name;
    $id('customSub').textContent = isCake ? 'Se guarda como product con is_custom = 1 (no sale en el catálogo)'
        : `Catálogo ${fmt(p.price)} · las opciones se guardan como texto en detail_sale.details`;
    $id('customPrice').value = old && isCake ? old.price : '';
    $id('customDedication').value = old?.dedication || '';
    $id('customDetails').value = old?.details || '';
    $id('customQty').value = old?.quantity || 1;
    $id('wrapCustomPrice').classList.toggle('hidden', !isCake);
    $id('rowCustomPortions').classList.toggle('hidden', !isCake);
    renderCustomGroups(); renderImages('custom');
    openModal('modalCustom');
}
function renderCustomGroups() {
    const c = S.custom;
    $id('customGroups').innerHTML = optGroups(c.base).map(g => {
        const opts = modsOf(c.base).filter(m => m.modifier_group_id === g.id), picked = opts.some(m => c.sel[m.id]);
        return `<div>
            <div class="flex items-center justify-between mb-1.5"><p class="po-sec">${esc(g.name)}</p>
                <span class="text-[11px] font-semibold ${g.is_extra ? 'text-gray-500' : picked ? 'text-emerald-600' : 'text-amber-600'}">${g.is_extra ? 'Opcional · varios' : picked ? 'Listo' : 'Elige uno'}</span></div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">${opts.map(m => {
                const q = c.sel[m.id] || 0;
                return `<button type="button" class="po-opt ${q ? 'active' : ''}" onclick="toggleOpt(${g.id}, ${m.id})">
                    <span class="text-[13px] font-semibold text-gray-900">${esc(m.name)}</span>
                    <span class="text-[11px] text-gray-500">${m.price ? '+' + fmtSmart(m.price) : 'Sin costo'}${m.description ? ' · ' + esc(m.description) : ''}</span>
                    ${g.is_extra && q ? `<span class="po-qty mt-1" onclick="event.stopPropagation()">
                        <span role="button" onclick="stepOpt(${m.id}, -1)">−</span><b>${q}</b><span role="button" onclick="stepOpt(${m.id}, 1)">+</span></span>` : ''}
                </button>`;
            }).join('')}</div>
        </div>`;
    }).join('');
    renderCustomTotals();
}
function toggleOpt(gid, mid) {
    const sel = S.custom.sel;
    if (byId(DB.modifier_group, gid).is_extra) { if (sel[mid]) delete sel[mid]; else sel[mid] = 1; }
    else { modsOf(S.custom.base).filter(m => m.modifier_group_id === gid).forEach(m => delete sel[m.id]); sel[mid] = 1; }
    renderCustomGroups();
}
function stepOpt(mid, d) { const sel = S.custom.sel; sel[mid] = (sel[mid] || 0) + d; if (sel[mid] <= 0) delete sel[mid]; renderCustomGroups(); }
function renderCustomTotals() {
    const c = S.custom, mods = customMods(), p = product(c.base);
    const suggested = round2((c.isCake ? 0 : p.price) + sum(mods, m => m.price * m.quantity));
    if (c.isCake && !c.priceTouched) $id('customPrice').value = suggested || '';
    const unit = c.isCake ? round2($id('customPrice').value) : suggested, qty = Math.max(1, Math.floor(Number($id('customQty').value)) || 1);
    const row = (k, v) => `<div class="flex justify-between gap-2"><span class="text-gray-500 truncate">${esc(k)}</span><span class="text-gray-900 font-semibold">${v}</span></div>`;
    $id('customSummary').innerHTML = (c.isCake ? '' : row(p.name, fmt(p.price)))
        + (mods.length ? mods.map(m => row(`${m.group}: ${m.name}${m.quantity > 1 ? ' ×' + m.quantity : ''}`, m.price ? '+' + fmt(m.price * m.quantity) : '—')).join('')
            : '<p class="text-gray-500">Sin opciones elegidas</p>');
    $id('customSuggested').textContent = fmt(suggested);
    const size = mods.find(m => m.group === 'Tamaño');
    $id('customPortions').textContent = size ? `${byId(DB.modifier, size.modifier_id).quantity} porciones` : '—';
    $id('customBtnTotal').textContent = fmt(unit * qty);
}
function addCustomToCart() {
    const c = S.custom, mods = customMods(), qty = Math.floor(Number($id('customQty').value));
    const missing = optGroups(c.base).filter(g => !g.is_extra && !modsOf(c.base).some(m => m.modifier_group_id === g.id && c.sel[m.id]));
    if (missing.length) return swalWarn('Faltan opciones', `Elige: ${missing.map(g => g.name).join(', ')}.`);
    if (!(qty >= 1)) return swalWarn('Cantidad inválida', 'La cantidad mínima es 1.');
    const price = c.isCake ? round2($id('customPrice').value) : product(c.base).price;
    if (c.isCake && !(price > 0)) return swalWarn('Precio inválido', 'Escribe el precio final del pastel.');
    const t = T(), old = c.editUid ? t.items.find(x => x.uid === c.editUid) : null;
    const fields = { quantity: qty, price, images: [...c.images], dedication: $id('customDedication').value.trim().slice(0, 255), details: $id('customDetails').value.trim().slice(0, 255) };
    if (c.isCake) Object.assign(fields, { is_custom: true, custom_mods: mods, modifiers: [], name: 'Pastel personalizado', product_id: old?.is_custom ? old.product_id : 90, custom_dirty: true });
    else fields.modifiers = mods;
    closeModal('modalCustom');
    if (old) { Object.assign(old, fields); renderTicket(); }
    else if (c.isCake) { t.items.push(Object.assign({ uid: uid(), disc: null, components: [] }, fields)); renderTicket(); }
    else addItem(product(c.base), fields);
}
