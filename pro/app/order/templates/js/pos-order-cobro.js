// POS + Pedidos (Huubie PRO) · cobro: pantalla simple (pulpos), múltiples métodos, hecho y guardado de la venta.
// Depende de pos-order-data.js y pos-order-venta.js.

// -- Métodos y billetes --
const METHOD_TONE = { efectivo: '#059669', tarjeta: '#4f46e5', transferencia: '#0891b2', vales: '#d97706', puntos: '#7c3aed' };
const methodTone = m => METHOD_TONE[m.kind] || '#475569';
const cobroCustomer = () => { const t = T(); return !isPublic(t.customer_id) ? customer(t.customer_id) : null; };

// Visibles + todos si se pidió + monedero si el cliente tiene saldo
function cobroMethods() {
    const cu = cobroCustomer();
    return DB.payment_method
        .filter(m => m.is_visible || S.cobro.showAll || (m.kind === 'puntos' && cu && cu.wallet > 0))
        .sort((a, b) => a.sort - b.sort);
}

// El exacto y los dos billetes que siguen (170 -> 170, 200, 500).
function billetes(total) {
    const sig = [];
    [50, 100, 200, 500, 1000].forEach((d) => {
        const v = Math.ceil(total / d) * d;
        if (v > total && sig.indexOf(v) === -1) sig.push(v);
    });
    return [total].concat(sig.sort((a, b) => a - b).slice(0, 2));
}

// Monedero: el % de la tarjeta sobre lo que se cobra ahora, sin contar la propina
const pointsFor = (c, cu, earned) => cu && c.ct?.points_percent ? round2(Math.min(c.due, earned) * c.ct.points_percent / 100) : 0;

// -- Propina (solo venta) y anticipo (solo pedido) --
const TIP_OPTS = [[0, 'Sin'], [5, '5%'], [10, '10%'], [15, '15%'], ['custom', 'Otro']];
const tipOf = base => S.cobro.tip.mode === 'custom' ? Math.max(0, round2(S.cobro.tip.amount)) : round2(base * (Number(S.cobro.tip.mode) || 0) / 100);

function renderTipChips(k) {
    $id('tipChips').innerHTML = TIP_OPTS.map(([v, l]) => {
        const on = String(S.cobro.tip.mode) === String(v);
        const hint = typeof v === 'number' && v ? `<small class="block text-[10px] opacity-70">${fmtSmart(k.c.total * v / 100)}</small>` : '';
        return `<button type="button" class="po-opt po-opt-sm${on ? ' active' : ''}" onclick="setTip(${typeof v === 'number' ? v : `'${v}'`})">${l}${hint}</button>`;
    }).join('');
    $id('tipCustomWrap').classList.toggle('hidden', S.cobro.tip.mode !== 'custom');
}

function setTip(mode, v) {
    // Al teclear «Otro» no se repinta: el input perdería el foco
    if (mode === 'custom' && v !== undefined) { S.cobro.tip = { mode, amount: Number(v) || 0 }; return renderCobroState(); }
    S.cobro.tip = { mode, amount: mode === 'custom' ? Number($id('tipCustom').value) || 0 : 0 };
    renderCobro();
    if (mode === 'custom') $id('tipCustom').focus();
}

const GOALS = [['none', 'Sin anticipo'], ['half', '50 %'], ['all', 'Todo']];
const goalWord = k => k.sale && !k.isQuote ? 'abono' : 'anticipo';

function renderGoalChips(k) {
    const abono = goalWord(k) === 'abono';
    $id('goalChips').innerHTML = GOALS.map(([g, l]) => {
        const amt = g === 'none' ? 0 : g === 'half' ? round2(k.toPay / 2) : k.toPay;
        const label = abono && g === 'none' ? 'Sin abono' : abono && g === 'all' ? 'Liquidar' : l;
        return `<button type="button" class="po-opt po-opt-sm${S.cobro.goal === g ? ' active' : ''}" onclick="setGoal('${g}')">${label}<small class="block text-[10px] opacity-70">${fmt(amt)}</small></button>`;
    }).join('');
}

function setGoal(g) {
    S.cobro.goal = g;
    S.cobro.cashTyped = '';
    $id('cashInput').value = '';
    renderCobro();
    if (g !== 'none') $id('cashInput').focus();
}

// -- Abrir el cobro --
function openCobroModal() {
    const t = T(), c = calcTicket(t), ped = t.sale_type_id === 1;
    const sale = t.editing_sale_id ? saleById(t.editing_sale_id) : null, isQuote = sale?.sale_status_id === 1;
    if (!t.items.length) return swalWarn('Ticket vacío', 'Agrega al menos un producto para cobrar.');
    if (sale && round2(c.total + c.prevTip) < c.paid)
        return swalWarn('Total menor a lo pagado', `Ya se cobraron ${fmt(c.paid)} y el total nuevo es ${fmt(c.total)}. Para devolver dinero cancela la venta y captúrala de nuevo.`);
    if (ped) {
        if (isPublic(t.customer_id)) return swalWarn('Falta el cliente', 'Un pedido necesita cliente: búscalo o créalo arriba del ticket.');
        if (!t.delivery_date) return swalWarn('Falta la fecha de entrega', 'Indica el día en que se entrega el pedido.');
        if (!sale && t.delivery_date < TODAY) return swalWarn('Fecha de entrega pasada', 'La entrega no puede ser antes de hoy.');
        if (Number(t.delivery_method) === 1 && !String(t.location || '').trim()) return swalWarn('Falta la dirección', 'Con envío a domicilio la dirección es obligatoria.');
    }
    if (sale && !isQuote && c.due <= 0) return commitSale({});   // solo cambios: no pide turno
    if (!requireTurn()) return;

    S.cobro = { screen: 'simple', amounts: {}, tip: { mode: 0, amount: 0 }, credit: false, goal: 'all', showAll: false, cashTyped: '', lastMethod: cashMethod().id };
    S.done = null;
    $id('cobroTitle').textContent = isQuote ? 'Cobrar cotización' : sale ? 'Cobrar saldo' : ped ? 'Registrar pedido' : 'Registrar venta';
    const chip = $id('cobroModeChip');
    chip.className = `po-chip ${ped ? 't-orange' : 't-blue'}`;
    chip.textContent = ped ? 'Pedido' : 'Venta';
    $id('modalFolio').textContent = sale ? folioLabel(sale) : `${ped ? 'Pedido' : 'Venta'} #${nextId(DB.sale)}`;
    $id('modalCliente').textContent = customer(t.customer_id || 1).name;
    $id('tipCustom').value = '';
    $id('cashInput').value = '';
    showCobroScreen('simple');
    openModal('modalCobro');
    setTimeout(() => $id('cashInput').focus(), 30);
}

// -- Cálculo --
// Simple: un solo método; el efectivo recibe lo que dan. Multi: se reparte entre métodos y lo que falte puede ir a crédito.
function cobroCalc() {
    const t = T(), c = calcTicket(t), ped = t.sale_type_id === 1, co = S.cobro;
    const sale = t.editing_sale_id ? saleById(t.editing_sale_id) : null, isQuote = sale?.sale_status_id === 1;
    const cu = cobroCustomer(), wallet = cu ? round2(cu.wallet || 0) : 0;
    const canCredit = !!cu && !!cu.credit_enabled, avail = cu ? creditAvailable(cu.id) : 0;
    const tip = ped ? 0 : tipOf(c.total);
    const toPay = round2(c.due + tip);
    const goalAmt = !ped ? toPay : co.goal === 'none' ? 0 : co.goal === 'half' ? round2(toPay / 2) : toPay;
    const cm = cashMethod();
    let cap = goalAmt, cash = 0, nonCash = 0, appliedCash = 0, change = 0, applied = 0, rest = 0, credit = false, usedPts = 0, earned = 0, error = '';

    if (co.screen === 'multi') {
        cap = toPay;
        DB.payment_method.forEach(m => {
            const v = round2(co.amounts[m.id] || 0);
            if (!v) return;
            if (m.is_cash) cash = round2(cash + v); else nonCash = round2(nonCash + v);
            if (m.kind === 'puntos') usedPts = round2(usedPts + v);
            if (m.earns_points && !m.is_cash) earned = round2(earned + v);
        });
        appliedCash = Math.min(cash, Math.max(0, round2(toPay - nonCash)));
        change = round2(cash - appliedCash);
        applied = round2(nonCash + appliedCash);
        rest = Math.max(0, round2(toPay - applied));
        credit = co.credit && canCredit && rest > 0;
        if (cm.earns_points) earned = round2(earned + appliedCash);   // el efectivo cuenta solo por lo aplicado, no por lo recibido
        if (nonCash > toPay) error = 'Tarjeta, transferencia o monedero superan lo que se cobra: con ellos no se da cambio.';
        else if (usedPts > wallet) error = `El monedero solo tiene ${fmt(wallet)}.`;
        else if (credit && rest > avail) error = `El crédito disponible es ${fmt(avail)} y faltan ${fmt(rest)}.`;
    } else {
        cash = co.cashTyped === '' ? cap : Math.max(0, round2(co.cashTyped));
        appliedCash = Math.min(cash, cap);
        change = round2(cash - appliedCash);
        applied = appliedCash;
        rest = Math.max(0, round2(toPay - applied));
        earned = cm.earns_points ? applied : 0;
    }
    const points = pointsFor(c, cu, earned);
    return { t, c, ped, sale, isQuote, cu, wallet, canCredit, avail, tip, toPay, goalAmt, cap, cash, nonCash, appliedCash, change, applied, rest, credit, usedPts, points, error };
}

// -- Pintar --
function showCobroScreen(name) {
    S.cobro.screen = name;
    const done = name === 'done';
    ['cobroHead', 'cobro_pay', 'cobroFoot'].forEach(id => $id(id).classList.toggle('hidden', done));
    $id('cobro_done').classList.toggle('hidden', !done);
    if (!done) renderCobro();
}

// Repinta todo (chips e inputs de multi). Mientras se teclea solo se llama renderCobroState.
function renderCobro() {
    const k = cobroCalc(), multi = S.cobro.screen === 'multi';
    $id('cobro_simple').classList.toggle('hidden', multi);
    $id('cobro_multi').classList.toggle('hidden', !multi);
    $id('tipWrap').classList.toggle('hidden', k.ped);
    $id('goalWrap').classList.toggle('hidden', !k.ped || multi);
    if (!k.ped) renderTipChips(k);
    else if (!multi) renderGoalChips(k);
    if (multi) renderMultiRows(k);
    $id('btnCobroBack').textContent = multi ? 'Volver' : 'Cancelar';
    renderCobroState(k);
}

function renderCobroState(k = cobroCalc()) {
    $id('cobroTotalLbl').textContent = k.sale && !k.isQuote ? 'Saldo por cobrar' : k.ped ? 'Total del pedido' : 'Total a cobrar';
    $id('cobroTotal').textContent = fmt(k.toPay);
    const sub = [
        k.c.paid ? `Pagado antes ${fmt(k.c.paid)}` : '',
        k.tip ? `incluye propina ${fmt(k.tip)}` : '',
        k.c.cardDisc ? `tarjeta ${k.c.ct.name} −${fmt(k.c.cardDisc)}` : '',
    ].filter(Boolean);
    $id('cobroTotalSub').textContent = sub.length ? sub.join(' · ')
        : `${k.c.pieces} pza${k.c.pieces === 1 ? '' : 's'} · ${customer(k.t.customer_id || 1).name}`;
    if (S.cobro.screen === 'multi') renderMultiState(k); else renderSimpleState(k);
    const lines = [];
    if (k.points) lines.push(`${esc(k.cu.name)} gana <b>${fmt(k.points)}</b> en su monedero (${k.c.ct.points_percent}% de lo cobrado).`);
    if (k.usedPts) lines.push(`Usa <b>${fmt(k.usedPts)}</b> del monedero.`);
    const pts = $id('cobroPoints');
    pts.innerHTML = lines.join(' ');
    pts.classList.toggle('hidden', !lines.length);
    icons();
}

function setCobroButton(label, disabled = false) {
    const b = $id('btnCobrar'), warn = T().sale_type_id === 1;
    b.classList.toggle('po-btn-warn', warn);
    b.classList.toggle('po-btn-ok', !warn);
    b.disabled = disabled;
    b.innerHTML = `<span>${esc(label)}</span><span class="po-kbd">Enter</span>`;
}

// Fila de método (pulpos): ícono en cuadro de color, título, ayuda y chevron
function fpRow({ icon, tone, title, sub, onclick, disabled = false }) {
    return `<button type="button" class="po-fp" style="--tone:${tone}" onclick="${onclick}"${disabled ? ' disabled' : ''}>
        <span class="po-fp-ico"><i data-lucide="${icon}"></i></span>
        <span class="flex-1 min-w-0 text-left"><span class="block text-[13px] font-semibold text-gray-900">${title}</span><small class="block text-[11px] text-gray-500 truncate">${sub}</small></span>
        <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400 shrink-0"></i>
    </button>`;
}

// -- Pantalla simple --
function renderSimpleState(k) {
    $id('cashBlock').classList.toggle('hidden', k.cap <= 0);
    $id('cashBills').innerHTML = k.cap > 0 ? billetes(k.cap).map((v, n) => n === 0
        ? `<button type="button" class="po-bill exact" onclick="payCash(${v})"><b>${fmt(v)}</b><small>exacto</small></button>`
        : `<button type="button" class="po-bill" onclick="payCash(${v})"><b>${fmtShort(v)}</b><small>cambio ${fmt(round2(v - k.cap))}</small></button>`).join('') : '';

    const typed = S.cobro.cashTyped !== '', word = goalWord(k);
    let txt = 'Enter sin número cobra el exacto.', tone = 'text-gray-500';
    if (k.cap <= 0) txt = k.ped ? `Sin ${word}: quedan ${fmt(k.toPay)} para la entrega.` : 'No hay nada por cobrar.';
    else if (!k.ped && k.cash < k.cap) { txt = `Faltan ${fmt(round2(k.cap - k.cash))}. Usa múltiples métodos o déjalo a crédito.`; tone = 'text-rose-600'; }
    else if (k.ped && k.applied < k.toPay) {
        txt = `${word === 'abono' ? 'Abono' : 'Anticipo'} ${fmt(k.applied)} · quedan ${fmt(k.rest)} para la entrega${k.change ? ` · cambio ${fmt(k.change)}` : ''}`;
        tone = 'text-amber-600';
    }
    else if (k.change) { txt = `Cambio ${fmt(k.change)}`; tone = 'text-emerald-600'; }
    else if (typed) txt = 'Exacto, sin cambio.';
    const st = $id('cobroStatus');
    st.className = `text-[12px] font-semibold mt-2 ${tone}`;
    st.textContent = txt;

    $id('cobroRows').innerHTML = simpleRows(k);

    if (k.cap <= 0) setCobroButton(k.ped ? `Guardar sin ${word}` : 'Registrar sin cobro');
    else if (!k.ped && k.cash < k.cap) setCobroButton(`Faltan ${fmt(round2(k.cap - k.cash))}`, true);
    else if (k.ped && k.applied < k.toPay) setCobroButton(k.applied > 0 ? `Cobrar ${word} ${fmt(k.applied)}` : `Guardar sin ${word}`);
    else setCobroButton(`Cobrar ${fmt(k.applied)}`);
}

function simpleRows(k) {
    const rows = [], off = k.cap <= 0;
    DB.payment_method.filter(m => m.is_visible && !m.is_cash && m.kind !== 'puntos').sort((a, b) => a.sort - b.sort).forEach(m => rows.push(fpRow({
        icon: m.icon, tone: methodTone(m), title: esc(m.name), onclick: `payWith(${m.id})`, disabled: off,
        sub: off ? 'No hay nada por cobrar' : `Cobra ${fmt(k.cap)} exacto, sin cambio`,
    })));
    const w = walletMethod();
    if (w && k.cu && k.wallet > 0) rows.push(fpRow({
        icon: w.icon, tone: methodTone(w), title: esc(w.name), onclick: `payWith(${w.id})`, disabled: off,
        sub: `Saldo de ${esc(k.cu.name)}: ${fmt(k.wallet)}${k.wallet < k.cap ? ' (completa con otro método)' : ''}`,
    }));
    rows.push(fpRow({
        icon: 'landmark', tone: '#0369a1', title: 'A crédito', onclick: 'payCredit()', disabled: !k.canCredit || k.toPay <= 0,
        sub: !k.cu ? 'Elige un cliente' : !k.canCredit ? `${esc(k.cu.name)} no tiene crédito habilitado` : `Lo debe ${esc(k.cu.name)} · disponible ${fmt(k.avail)}`,
    }));
    rows.push('<div class="border-t border-gray-100 my-1"></div>' + fpRow({
        icon: 'split', tone: '#475569', title: 'Usar múltiples métodos', onclick: 'goMulti()',
        sub: 'Reparte el cobro entre efectivo, tarjeta, transferencia, monedero o crédito',
    }));
    return rows.join('');
}

function onCashInput(v) { S.cobro.cashTyped = String(v).trim(); renderCobroState(); }

// Tocar un billete cobra directo
function payCash(v) { S.cobro.cashTyped = String(v); $id('cashInput').value = v; confirmSimple(); }

function confirmSimple() {
    const k = cobroCalc();
    if (!k.ped && k.cap > 0 && k.cash < k.cap) { renderCobroState(k); const i = $id('cashInput'); i.focus(); i.select(); return; }
    const payments = k.appliedCash > 0 ? [{ method_id: cashMethod().id, amount: k.appliedCash, tendered: k.cash }] : [];
    commitSale({ payments, tip: k.tip, points: k.points });
}

// Tarjeta, transferencia o monedero: el importe exacto, sin cambio
function payWith(id) {
    const k = cobroCalc(), m = method(id);
    if (k.cap <= 0) return;
    if (m.kind === 'puntos' && k.wallet < k.cap) return goMulti({ [id]: k.wallet });
    commitSale({ payments: [{ method_id: id, amount: k.cap, tendered: k.cap }], tip: k.tip, points: pointsFor(k.c, k.cu, m.earns_points ? k.cap : 0) });
}

// Todo a crédito (receivable cargo): no cuenta como pagado
function payCredit() {
    const k = cobroCalc();
    if (!k.canCredit) return swalWarn('Sin crédito', k.cu ? `${k.cu.name} no tiene crédito habilitado.` : 'Elige un cliente con crédito habilitado.');
    if (k.toPay <= 0) return;
    if (k.avail < k.toPay) return goMulti({}, true);
    commitSale({ payments: [], tip: k.tip, credit: k.toPay });
}

// -- Múltiples métodos --
function goMulti(prefill = {}, credit = false) {
    const co = S.cobro, cm = cashMethod();
    co.amounts = {};
    if (co.cashTyped !== '' && Number(co.cashTyped) > 0) co.amounts[cm.id] = round2(co.cashTyped);
    Object.assign(co.amounts, prefill);
    co.credit = credit;
    co.screen = 'multi';
    renderCobro();
    const first = [...document.querySelectorAll('#multiMethods input[id^="pm_"]')].find(i => !i.disabled && !i.value);
    (first || $id('pm_' + cm.id))?.focus();
}

function backSimple() {
    S.cobro.screen = 'simple';
    S.cobro.amounts = {};
    S.cobro.credit = false;
    renderCobro();
    $id('cashInput').focus();
}

// Tiene inputs: solo se pinta al entrar a multi o al mostrar/ocultar métodos
function renderMultiRows(k) {
    $id('multiMethods').innerHTML = cobroMethods().map(m => {
        const pts = m.kind === 'puntos', off = pts && k.wallet <= 0;
        const hint = pts ? (k.wallet > 0 ? `Saldo ${fmt(k.wallet)}` : 'Sin saldo en monedero')
            : m.unseeded ? 'Sin semilla en payment_method (is_visible 0)'
            : m.is_cash ? 'Lo recibido; el cambio sale solo' : 'Importe exacto, sin cambio';
        const dis = off ? ' disabled' : '';
        return `<div class="po-mrow${off ? ' opacity-40' : ''}" style="--tone:${methodTone(m)}">
            <button type="button" class="po-fp-ico" onclick="fillMethod(${m.id})" title="Poner lo que falta"${dis}><i data-lucide="${m.icon}"></i></button>
            <button type="button" class="flex-1 min-w-0 text-left" onclick="fillMethod(${m.id})"${dis}>
                <span class="block text-[13px] font-semibold text-gray-900">${esc(m.name)}</span>
                <small class="block text-[11px] text-gray-500 truncate">${hint}</small>
            </button>
            <div class="po-money"><span>$</span><input id="pm_${m.id}" type="number" min="0" step="0.5" inputmode="decimal" placeholder="0.00"
                value="${S.cobro.amounts[m.id] || ''}"${dis} oninput="setMethodAmount(${m.id}, this.value)" onfocus="S.cobro.lastMethod = ${m.id}; this.select()"></div>
        </div>`;
    }).join('');
    $id('btnToggleAllMethods').textContent = S.cobro.showAll ? 'Solo visibles' : 'Mostrar todos';
}

function renderMultiState(k) {
    const chk = $id('chkCredito');
    chk.disabled = !k.canCredit;
    chk.checked = S.cobro.credit && k.canCredit;
    $id('boxCredito').classList.toggle('opacity-50', !k.canCredit);
    $id('lblCreditoTxt').textContent = k.cu ? `Dejar lo que falte a crédito de ${k.cu.name}` : 'Dejar lo que falte a crédito';
    $id('lblCreditoInfo').textContent = !k.cu ? 'Elige un cliente con crédito habilitado'
        : !k.canCredit ? 'Este cliente no tiene crédito habilitado' : `Disponible ${fmt(k.avail)} de ${fmt(k.cu.credit_limit)}`;

    const box = (lbl, val, tone = '') => `<div class="po-box ${tone}"><div class="text-[10px] uppercase tracking-wide opacity-70">${lbl}</div><div class="text-[15px] font-bold">${val}</div></div>`;
    const mid = k.rest <= 0 ? box('Falta', 'Completo', 't-green')
        : k.credit ? box('A crédito', fmt(k.rest), 't-sky')
        : k.ped ? box('Queda pendiente', fmt(k.rest), 't-amber')
        : box('Falta', fmt(k.rest), 't-red');
    $id('multiSummary').innerHTML = box('Cobrado', fmt(k.applied)) + mid + box('Cambio', fmt(k.change), k.change ? 't-green' : '');

    const err = $id('lblCobroError');
    err.textContent = k.error;
    err.classList.toggle('hidden', !k.error);

    const word = goalWord(k);
    if (k.error) setCobroButton('Revisa los importes', true);
    else if (k.rest > 0 && !k.ped && !k.credit) setCobroButton(`Faltan ${fmt(k.rest)}`, true);
    else if (k.rest > 0 && k.credit) setCobroButton(k.applied > 0 ? `Cobrar ${fmt(k.applied)} + crédito ${fmt(k.rest)}` : `Todo a crédito ${fmt(k.rest)}`);
    else if (k.rest > 0) setCobroButton(k.applied > 0 ? `Cobrar ${word} ${fmt(k.applied)}` : `Guardar sin ${word}`);
    else setCobroButton(`Cobrar ${fmt(k.applied)}`);
}

// Clic en el método: le pone lo que falta (o todo, si ya estaba completo)
function fillMethod(id) {
    const k = cobroCalc(), m = method(id);
    let v = k.rest > 0 ? round2((S.cobro.amounts[id] || 0) + k.rest) : k.toPay;
    if (k.rest <= 0) S.cobro.amounts = {};
    if (m.kind === 'puntos') v = Math.min(v, k.wallet);
    S.cobro.amounts[id] = v;
    S.cobro.lastMethod = id;
    syncMethodInputs();
    renderCobroState();
    $id('pm_' + id)?.focus();
}

function syncMethodInputs() {
    document.querySelectorAll('#multiMethods input[id^="pm_"]').forEach(el => { el.value = S.cobro.amounts[Number(el.id.slice(3))] || ''; });
}

function setMethodAmount(id, v) {
    S.cobro.amounts[id] = Math.max(0, round2(v));
    S.cobro.lastMethod = id;
    renderCobroState();
}

function toggleAllMethods() {
    S.cobro.showAll = !S.cobro.showAll;
    if (!S.cobro.showAll) {
        const keep = new Set(cobroMethods().map(m => m.id));
        Object.keys(S.cobro.amounts).forEach(id => { if (!keep.has(Number(id))) delete S.cobro.amounts[id]; });
    }
    renderCobro();
}

function confirmMulti() {
    const k = cobroCalc();
    if (k.error || (k.rest > 0 && !k.ped && !k.credit)) return renderCobroState(k);
    const payments = [];
    DB.payment_method.forEach(m => {
        const given = round2(S.cobro.amounts[m.id] || 0);
        if (!given) return;
        if (!m.is_cash) return payments.push({ method_id: m.id, amount: given, tendered: given });
        const amount = round2(k.appliedCash * given / k.cash);   // el efectivo se prorratea: lo demás es cambio
        if (amount > 0) payments.push({ method_id: m.id, amount, tendered: given });
    });
    commitSale({ payments, tip: k.tip, credit: k.credit ? k.rest : 0, points: k.points });
}

// -- Navegación y teclado --
function cobroBack() { if (S.cobro.screen === 'multi') backSimple(); else closeCobro(); }
const cobroEsc = () => S.cobro.screen === 'done' ? doneNew() : cobroBack();   // Esc (MODAL_CLOSE en vistas)
function cobroPrimary() { if (S.cobro.screen === 'multi') confirmMulti(); else confirmSimple(); }

// Enter en un input del cobro = botón principal. Un botón enfocado responde solo.
document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !$id('modalCobro')?.classList.contains('open') || topModal()?.id !== 'modalCobro') return;
    if (swalBlocking()) return;   // un toast no bloquea el Enter; un Swal de verdad sí
    const el = e.target;
    if (el.closest?.('button, a, textarea, select') || el.type === 'checkbox') return;
    e.preventDefault();
    if (S.cobro.screen === 'done') return doneNew();
    if (el.id === 'tipCustom') {
        const next = S.cobro.screen === 'multi' ? document.querySelector('#multiMethods input:not([disabled])') : $id('cashInput');
        return next?.focus();
    }
    cobroPrimary();
});

// -- Hecho --
function showDone(r) {
    S.done = r;
    const { sale, quote, credit, change, paidNow, points, usedPts, cu, ped, prev, converted, payments } = r;
    const pend = quote ? 0 : cashDue(sale);   // lo que falta fuera del crédito
    const plain = prev && !converted;
    $id('doneTitle').textContent = quote ? 'Cotización guardada'
        : plain && !paidNow && !credit ? 'Cambios guardados'
        : plain && !pend && !credit ? (ped ? 'Pedido liquidado' : 'Venta liquidada')
        : plain ? 'Cobro registrado'
        : ped ? 'Pedido registrado' : 'Venta registrada';
    $id('doneFolio').textContent = folioLabel(sale);
    const [ico, tone] = quote ? ['file-text', 't-purple'] : credit > 0 ? ['landmark', 't-sky'] : !paidNow ? ['save', 't-gray'] : ['circle-check', 't-green'];
    const di = $id('doneIcon');
    di.className = `po-done-ico ${tone}`;
    di.innerHTML = `<i data-lucide="${ico}"></i>`;
    $id('doneSub').textContent = quote ? 'Se guardó sin cobro. Conviértela desde Ventas › Cotizaciones.'
        : credit > 0 ? `Quedó a crédito de ${cu ? cu.name : 'el cliente'}: ${fmt(credit)}.`
        : pend > 0 ? `Quedan ${fmt(pend)} por cobrar${ped ? ' al entregar' : ''}.`
        : 'Pagado completo.';
    $id('doneChangeWrap').classList.toggle('hidden', !(change > 0));
    $id('doneChange').textContent = fmt(change);

    const row = (l, v, cls = '') => `<div class="flex items-center justify-between gap-3 py-1.5 ${cls}"><span class="text-gray-500">${l}</span><span class="font-semibold text-gray-900 text-right">${v}</span></div>`;
    const small = s => ` <small class="text-gray-500 font-normal">${s}</small>`;
    const lines = [row('Total', fmt(sale.total) + (sale.tip_amount ? small(`+ propina ${fmt(sale.tip_amount)}`) : ''))];
    if (paidNow) lines.push(row('Cobrado ahora', fmt(paidNow) + small(payments.map(p => esc(method(p.method_id).name)).join(' + '))));
    if (credit > 0) lines.push(row(`Quedó a crédito de ${esc(cu?.name || 'cliente')}`, fmt(credit)));
    if (pend > 0) lines.push(row('Saldo pendiente', fmt(pend) + (ped ? small('se cobra al entregar') : '')));
    if (points) lines.push(row(`${esc(cu.name)} ganó`, fmt(points) + small('en su monedero')));
    if (usedPts) lines.push(row('Monedero usado', `−${fmt(usedPts)}` + small(`saldo ${fmt(cu.wallet)}`)));
    if (ped && !quote) lines.push(row('Entrega', esc(deliveryTxt(sale))));
    $id('doneLines').innerHTML = lines.join('');

    $id('btnDoneWa').classList.toggle('hidden', !customer(sale.customer_id)?.phone || isPublic(sale.customer_id));
    $id('btnDoneNew').innerHTML = quote ? 'Cerrar' : 'Nueva venta <span class="po-kbd">Enter</span>';
    showCobroScreen('done');
    if (!$id('modalCobro').classList.contains('open')) openModal('modalCobro');
    icons();
    setTimeout(() => $id('btnDoneNew').focus(), 30);
}

function closeCobro() {
    closeModal('modalCobro');
    S.done = null;
    S.cobro.screen = 'simple';
    if (S.view === 'vender' && !topModal()) setTimeout(() => $id('inputSearch')?.focus(), 30);
}

function doneNew() {
    closeCobro();
    if (S.view !== 'vender') setView('vender');
    focusFinder();
}

// -- Guardado --
// Un personalizado editado reemplaza su producto (mismo id) con la receta nueva
function saveCustomProduct(i) {
    const old = i.product_id !== 90 ? product(i.product_id) : null;
    if (old) {
        DB.product.splice(DB.product.indexOf(old), 1);
        DB.product_modifier = DB.product_modifier.filter(pm => pm.product_id !== old.id);
    }
    return createCustomProduct(i.custom_mods, i.price, old ? old.id : undefined);
}

// detail_sale: actualiza las que siguen, agrega las nuevas y apaga (active 0) las que se quitaron
function saveLines(t, saleId, now) {
    const keep = new Set();
    t.items.forEach(i => {
        if (i.is_custom && (i.product_id === 90 || i.custom_dirty)) { i.product_id = saveCustomProduct(i); delete i.custom_dirty; }
        const mods = i.is_custom ? i.custom_mods : i.modifiers;
        const row = {
            sale_id: saleId, product_id: i.product_id || null, name: String(i.name).slice(0, 255),
            details: [mods?.length ? modsText(mods) : '', i.details].filter(Boolean).join(' · ').slice(0, 255),
            dedication: (i.dedication || '').slice(0, 255), price: round2(i.price + modsUnit(i)), quantity: i.quantity,
            discount_percent: i.disc?.type === 'pct' ? i.disc.value : 0, discount_amount: lineDisc(i), discount_reason_id: i.disc?.reason_id || null,
            status: 1, active: 1, updated_at: now,
        };
        let d = i.detail_id ? DB.detail_sale.find(x => x.id === i.detail_id && x.sale_id === saleId) : null;
        if (d) Object.assign(d, row);
        else DB.detail_sale.push(d = Object.assign({ id: nextId(DB.detail_sale), created_at: now }, row));
        keep.add(d.id);
        const imgs = i.images || [], names = new Set(imgs.map(m => m.name));
        DB.sale_image.filter(s => s.detail_sale_id === d.id && s.active && !names.has(s.name)).forEach(s => s.active = 0);
        imgs.filter(m => !DB.sale_image.some(s => s.detail_sale_id === d.id && s.active && s.name === m.name)).forEach(m => DB.sale_image.push({
            id: nextId(DB.sale_image), path: `uploads/sale/${saleId}/`, name: m.name, original_name: m.original_name,
            detail_sale_id: d.id, active: 1, created_at: now, url: m.url,
        }));
    });
    saleLines(saleId).filter(d => !keep.has(d.id)).forEach(d => {
        Object.assign(d, { active: 0, status: 0, updated_at: now });
        DB.sale_image.filter(s => s.detail_sale_id === d.id).forEach(s => s.active = 0);
    });
}

// Guarda la venta del ticket: sale + detail_sale + payment + receivable + history_log. No descuenta existencias.
function commitSale({ payments = [], tip = 0, credit = 0, points = 0, quote = false } = {}) {
    const t = T(), c = calcTicket(t), ped = t.sale_type_id === 1, now = nowStamp(), me = DB.user.id, turn = openTurn();
    const prev = t.editing_sale_id ? saleById(t.editing_sale_id) : null;
    const was = prev ? {
        status: prev.sale_status_id, type: prev.sale_type_id, delivery: prev.delivery_status, total: prev.total,
        paid: salePaid(prev), lineDisc: round2(sum(saleLines(prev.id), d => d.discount_amount)),
    } : null;
    const id = prev ? prev.id : nextId(DB.sale);
    const sale = prev || {
        id, folio: String(id), tip_amount: 0, cancel_reason: null, cancelled_at: null, produced_at: null, created_at: now,
        branch_id: DB.branch.id, user_id: me, edit_user_id: null, cancel_user_id: null, produced_user_id: null,
        turn_id: turn?.id ?? null, daily_closure_id: null, active: 1,
    };
    saveLines(t, id, now);
    const accAll = round2(c.accDisc + c.cardDisc), cardTxt = c.cardDisc ? `Tarjeta ${c.ct.name} ${c.ct.discount_percent}%` : '';
    const ship = ped && Number(t.delivery_method) === 1;
    Object.assign(sale, {
        note: (t.note || '').slice(0, 255), subtotal: c.subtotal, total: c.total,
        discount_amount: accAll, discount_percent: t.discount?.type === 'pct' ? t.discount.value : 0,
        discount_note: [t.discount?.note, cardTxt].filter(Boolean).join(' · ').slice(0, 255) || null,
        discount_reason_id: t.discount?.reason_id || null, discount_user_id: accAll ? t.discount?.user_id || me : null,
        customer_id: t.customer_id || 1, card_id: t.card_id || null, sale_type_id: t.sale_type_id,
        seller_id: t.seller_id || me,   // seller_id NO existe en fayxzvov_pos
        delivery_method: ship ? 1 : 0, location: ship ? String(t.location).trim().slice(0, 255) : null,
        delivery_date: ped ? t.delivery_date || null : null, delivery_time: ped ? t.delivery_time || null : null,
        birthday_date: ped ? t.birthday_date || null : null, updated_at: now,
    });
    if (prev) sale.edit_user_id = me; else DB.sale.push(sale);
    if (was?.status === 1 && !quote) sale.turn_id = turn?.id ?? sale.turn_id;
    sale.tip_amount = round2((sale.tip_amount || 0) + tip);
    sale.delivery_status = quote ? 0 : !ped ? 1 : was && was.type === 1 && was.status !== 1 ? was.delivery : 2;
    const paidNow = round2(sum(payments, p => p.amount)), paidBefore = was ? was.paid : 0;
    sale.sale_status_id = quote ? 1 : round2(paidBefore + paidNow) >= round2(sale.total + sale.tip_amount) ? 3 : 2;

    if (!prev) logH(id, 'edition', quote ? 'Cotización creada' : ped ? 'Pedido creado' : 'Venta registrada', `${t.items.length} partida(s) · ${fmt(sale.total)}`, me, now, 'create');
    else if (was.status === 1 && !quote) logH(id, 'edition', 'Cotización convertida', `Ahora es ${ped ? 'pedido' : 'venta'} · total ${fmt(sale.total)}`, me, now, 'convert');
    else logH(id, 'edition', 'Cambios guardados', was.total !== sale.total ? `Total ${fmt(was.total)} → ${fmt(sale.total)}` : 'Mismo total', me, now, 'edit');

    const discChanged = JSON.stringify(t.discount || null) !== (t.discount_orig ?? 'null');
    if (discChanged && t.discount) {
        const r = reason(t.discount.reason_id), by = t.discount.user_id && t.discount.user_id !== me ? ` · autorizó ${userName(t.discount.user_id)}` : '';
        logH(id, 'discount', 'Descuento aplicado', `${r?.name || 'Descuento'} · ${t.discount.type === 'pct' ? t.discount.value + '%' : fmt(t.discount.value)} (−${fmt(c.accDisc)})${t.discount.note ? ' · ' + t.discount.note : ''}${by}`, me, now, 'discount');
    } else if (discChanged && prev) logH(id, 'discount', 'Descuento retirado', 'Se quitó el descuento de la cuenta', me, now, 'discount');
    if (c.lineDiscounts !== (was ? was.lineDisc : 0) && c.lineDiscounts)
        logH(id, 'discount', 'Descuento en partidas', `${t.items.filter(i => i.disc).length} partida(s) · −${fmt(c.lineDiscounts)}`, me, now, 'discount');
    if (tip > 0) logH(id, 'payment', 'Propina', `${fmt(tip)} · va aparte del total de la venta`, me, now, 'tip');

    const desc = credit > 0 ? 'Pago parcial (resto a crédito)' : sale.sale_status_id === 3 ? (paidBefore ? 'Liquidación' : 'Pago total') : ped ? (paidBefore ? 'Abono' : 'Anticipo') : 'Pago';
    payments.forEach(p => {
        const m = method(p.method_id);
        DB.payment.push({
            id: nextId(DB.payment), sale_id: id, payment_method_id: m.id, description: desc, amount: p.amount,
            tendered_amount: p.tendered, change_amount: round2(p.tendered - p.amount), paid_at: now, deleted_at: null, deleted_user_id: null,
            branch_id: DB.branch.id, user_id: me, turn_id: turn?.id ?? null, created_at: now, updated_at: now, active: 1,
        });
        logH(id, 'payment', desc, `${m.name} ${fmt(p.amount)}${p.tendered > p.amount ? ` · recibió ${fmt(p.tendered)} · cambio ${fmt(p.tendered - p.amount)}` : ''}`, me, now, 'pay');
    });
    if (credit > 0) {
        DB.receivable.push({
            id: nextId(DB.receivable), kind: 'cargo', description: `Crédito venta #${sale.folio}`, amount: round2(credit), paid_at: null, deleted_at: null,
            created_at: now, updated_at: now, branch_id: DB.branch.id, user_id: me, deleted_user_id: null, customer_id: sale.customer_id, sale_id: id,
            turn_id: turn?.id ?? null, payment_method_id: null, active: 1,
        });
        logH(id, 'payment', 'Venta a crédito', `Cargo a la cuenta de ${customer(sale.customer_id).name} por ${fmt(credit)}`, me, now, 'credit');
    }
    const usedPts = round2(sum(payments.filter(p => method(p.method_id).kind === 'puntos'), p => p.amount));
    const cu = !isPublic(sale.customer_id) ? customer(sale.customer_id) : null;
    if (cu && (usedPts || points)) {
        cu.wallet = round2((cu.wallet || 0) - usedPts + points);
        logH(id, 'payment', 'Monedero', [points ? `+${fmt(points)} acumulados` : '', usedPts ? `−${fmt(usedPts)} usados` : '', `saldo ${fmt(cu.wallet)}`].filter(Boolean).join(' · '), me, now, 'points');
    }
    const change = round2(sum(payments, p => p.tendered - p.amount)), due = saleDue(sale);
    resetTicket(t, false);
    refreshViews();   // el modal sigue abierto: pasa a «hecho»
    showDone({ sale, quote, credit, change, due, paidNow, points, usedPts, cu, ped, prev: !!prev, converted: was?.status === 1 && !quote, payments, tip });
}

function saveQuote() {
    const t = T(), sale = t.editing_sale_id ? saleById(t.editing_sale_id) : null;
    if (!t.items.length) return swalWarn('Ticket vacío', 'Agrega productos para cotizar.');
    if (sale && sale.sale_status_id !== 1) return swalWarn('No se puede volver cotización', `${folioLabel(sale)} ya tiene cobros. Guarda los cambios con el botón de cobro.`);
    commitSale({ quote: true });
}
