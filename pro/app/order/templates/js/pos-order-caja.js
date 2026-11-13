// POS + Pedidos (Huubie PRO) · caja: turnos (abrir, retiros y depósitos, corte X y Z, reabrir), cierre del día y la vista Caja.
// Depende de pos-order-data.js y pos-order-venta.js (askPin). refreshViews y setView viven en pos-order-vistas.js.

// -- Piezas de pantalla (las usan también ventas y vistas) --
const kpiTile = (lbl, val, tone = 'text-gray-900', sub = '') => `<div class="po-box">
    <div class="po-lbl">${lbl}</div><div class="text-[16px] font-bold leading-tight ${tone}">${val}</div>
    ${sub ? `<div class="text-[11px] text-gray-500 mt-0.5 truncate">${sub}</div>` : ''}</div>`;

// Tabla compacta en rejilla: sin <table>, porque compact.css y dark-mode.css fuerzan th/td
function miniTable(cols, head, rows, foot) {
    const line = (cells, cls) => `<div class="grid gap-2 px-3 py-1.5 ${cls}" style="grid-template-columns:${cols}">${cells.map((c, n) => `<span class="${n ? 'text-right' : 'truncate'}">${c}</span>`).join('')}</div>`;
    return '<div class="rounded-lg border border-gray-200 overflow-hidden">'
        + line(head, 'bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500')
        + (rows.length ? rows.map(r => line(r, 'text-[12px] text-gray-600 border-t border-gray-100')).join('')
            : '<div class="px-3 py-3 text-[12px] text-gray-500 border-t border-gray-100">Sin movimientos</div>')
        + (foot && rows.length ? line(foot, 'text-[12px] font-bold text-gray-900 border-t border-gray-200 bg-gray-50') : '')
        + '</div>';
}

const panel = (title, icon, body, extra = '', cls = '') => `<section class="bg-white border border-gray-200 rounded-xl p-3 ${cls}">
    <div class="flex items-center justify-between gap-2 mb-2.5">
        <div class="flex items-center gap-2 text-[13px] font-semibold text-gray-900 min-w-0"><i data-lucide="${icon}" class="w-4 h-4 text-gray-400 shrink-0"></i><span class="truncate">${title}</span></div>${extra}
    </div>${body}</section>`;

const viewHead = (title, sub, actions = '', chip = '') => `<div class="flex flex-wrap items-start justify-between gap-3 mb-3">
    <div class="min-w-0">
        <div class="flex items-center gap-2 flex-wrap"><span class="text-[18px] font-bold text-gray-900">${title}</span>${chip}</div>
        <div class="text-[12px] text-gray-500 mt-0.5">${sub}</div>
    </div>
    <div class="flex flex-wrap gap-2">${actions}</div></div>`;

const actBtn = (icon, label, onclick, cls = 'po-btn-ghost') => `<button type="button" class="po-btn ${cls}" onclick="${onclick}"><i data-lucide="${icon}" class="w-4 h-4"></i><span>${label}</span></button>`;

const emptyBox = (icon, title, sub = '', action = '') => `<div class="flex flex-col items-center justify-center text-center py-10 px-4">
    <span class="po-m-ico t-gray mb-2"><i data-lucide="${icon}"></i></span>
    <div class="text-[13px] font-semibold text-gray-900">${title}</div>
    ${sub ? `<div class="text-[12px] text-gray-500 mt-0.5 max-w-xs">${sub}</div>` : ''}${action ? `<div class="mt-3">${action}</div>` : ''}</div>`;

const icoBox = (el, icon, tone) => { el.className = `po-m-ico ${tone}`; el.innerHTML = `<i data-lucide="${icon}"></i>`; };
const onEnter = (e, fn) => { if (e.key === 'Enter') { e.preventDefault(); fn(); } };

// -- Tablas de corte y números de un turno --
// Los cortes de fayxzvov_pos guardan sus totales en tablas de detalle; arrancan vacías.
Object.assign(DB, { turn_payment: [], turn_status: [], daily_closure_payment: [], daily_closure_status: [] });
const stampSec = () => `${nowStamp()}:${pad(new Date().getSeconds())}`;
const isCashMethod = id => !!method(id)?.is_cash;
const diffTxt = d => d === 0 ? 'cuadra' : `${d > 0 ? 'sobran' : 'faltan'} ${fmt(Math.abs(d))}`;
const diffTone = d => d === 0 ? 'text-emerald-600' : d > 0 ? 'text-amber-600' : 'text-rose-600';
const statusRows = statuses => statuses.filter(x => x.count).map(x => [`<span class="po-chip ${STATUS_TONE[x.id]}">${DB.sale_status[x.id]}</span>`, x.count, fmt(x.amount)]);

// Lo cobrado cuenta por payment.turn_id: un pedido de ayer liquidado hoy cae en el turno de hoy
function turnStats(turnId) {
    const tu = turnById(turnId);
    const pays = DB.payment.filter(p => p.turn_id === tu.id && !p.deleted_at);
    const abonos = DB.receivable.filter(r => r.turn_id === tu.id && r.kind === 'abono' && !r.deleted_at);
    const sales = DB.sale.filter(s => s.turn_id === tu.id), live = sales.filter(s => [2, 3].includes(s.sale_status_id));
    const moves = DB.cash_move.filter(m => m.turn_id === tu.id);
    const methods = DB.payment_method.map(m => {
        const ps = pays.filter(p => p.payment_method_id === m.id), ab = abonos.filter(r => r.payment_method_id === m.id);
        return { m, count: ps.length + ab.length, sales: round2(sum(ps, p => p.amount)), abonos: round2(sum(ab, r => r.amount)) };
    }).filter(x => x.count);
    const cashSales = round2(sum(pays.filter(p => isCashMethod(p.payment_method_id)), p => p.amount));
    const cashAbonos = round2(sum(abonos.filter(r => isCashMethod(r.payment_method_id)), r => r.amount));
    const cashIn = round2(sum(moves.filter(m => m.type === 'in'), m => m.amount));
    const cashOut = round2(sum(moves.filter(m => m.type === 'out'), m => m.amount));
    return {
        tu, sales, moves, methods, cashSales, cashAbonos, cashIn, cashOut,
        expected: round2(tu.opening_cash + cashSales + cashAbonos + cashIn - cashOut),
        collected: round2(sum(pays, p => p.amount) + sum(abonos, r => r.amount)),
        total_sales: round2(sum(live, s => s.total)), tips: round2(sum(live, s => s.tip_amount)),
        sales_count: live.filter(s => s.sale_type_id !== 1).length, orders_count: live.filter(s => s.sale_type_id === 1).length,
        statuses: Object.keys(DB.sale_status).map(Number).map(id => { const ss = sales.filter(s => s.sale_status_id === id); return { id, count: ss.length, amount: round2(sum(ss, s => s.total)) }; }),
    };
}

// Corte Z: congela los totales en turn + turn_payment + turn_status
function snapshotTurn(tu) {
    const k = turnStats(tu.id), now = nowStamp();
    Object.assign(tu, { expected_cash: k.expected, total_sales: k.total_sales, sales_count: k.sales_count, orders_count: k.orders_count, updated_at: now });
    DB.turn_payment.filter(d => d.turn_id === tu.id).forEach(d => d.active = 0);
    DB.turn_status.filter(d => d.turn_id === tu.id).forEach(d => d.active = 0);
    k.methods.forEach(x => DB.turn_payment.push({ id: nextId(DB.turn_payment), turn_id: tu.id, payment_method_id: x.m.id, amount: round2(x.sales + x.abonos), created_at: now, updated_at: now, active: 1 }));
    k.statuses.filter(x => x.count).forEach(x => DB.turn_status.push({ id: nextId(DB.turn_status), turn_id: tu.id, sale_status_id: x.id, amount: x.amount, created_at: now, updated_at: now, active: 1 }));
}
DB.turn.filter(t => t.status === 'closed').forEach(snapshotTurn);   // el turno 41 de ejemplo ya trae su corte Z

// Efectivo del cajón: fondo + efectivo cobrado + depósitos − retiros. Con cols muestra el nombre de la columna.
function cashBreakdown(k, cols = false) {
    const tu = k.tu, closed = tu.status !== 'open', expected = closed ? tu.expected_cash : k.expected;
    const col = c => cols && c ? ` <small class="text-gray-400 font-normal">${c}</small>` : '';
    const line = (lbl, v, c = '', sign = '', tone = 'text-gray-900') => `<div class="flex justify-between gap-2 py-0.5"><span class="text-gray-500">${lbl}${col(c)}</span><span class="font-semibold ${tone}">${sign}${fmt(v)}</span></div>`;
    const d = closed ? round2((tu.counted_cash || 0) - tu.expected_cash) : 0;
    return '<div class="text-[12px]">'
        + line('Fondo inicial', tu.opening_cash, 'opening_cash') + line('Ventas en efectivo', k.cashSales, '', '+') + line('Abonos en efectivo', k.cashAbonos, '', '+')
        + line('Depósitos', k.cashIn, '', '+') + line('Retiros', k.cashOut, '', '−', 'text-rose-600')
        + `<div class="flex justify-between gap-2 pt-1.5 mt-1 border-t border-gray-200"><span class="font-bold text-gray-900">Efectivo esperado${col('expected_cash')}</span><span class="font-bold text-emerald-600">${fmt(expected)}</span></div>`
        + (closed ? line('Contado', tu.counted_cash, 'counted_cash')
            + `<div class="flex justify-between gap-2 py-0.5"><span class="text-gray-500">Diferencia</span><span class="font-semibold ${diffTone(d)}">${diffTxt(d)}</span></div>` : '')
        + '</div>';
}

// -- Día: un daily_closure por sucursal y fecha; reabrir lo deja «REABIERTO» hasta volver a cerrar --
const dayClosure = () => DB.daily_closure.find(d => d.active && d.branch_id === DB.branch.id && (d.closure_date || '').slice(0, 10) === TODAY) || null;
const dayState = () => { const c = dayClosure(); return !c ? 'abierto' : c.reopened_at && c.reopened_at > c.closure_date ? 'reabierto' : 'cerrado'; };
const dayTurns = () => DB.turn.filter(t => (t.opened_at || '').slice(0, 10) === TODAY);

// -- Abrir turno (F2 de CoffeePOS) --
function openAbrirTurno() {
    const tu = openTurn();
    if (tu) return swalInfo('Ya hay un turno abierto', `${tu.folio} · ${userName(tu.user_id)} desde las ${hourOf(tu.opened_at)}.`);
    if (dayState() === 'cerrado') return swalWarn('El día ya está cerrado', 'Reábrelo desde «Cierre del día» para volver a vender.');
    $id('otUser').textContent = DB.user.name;
    $id('otTime').textContent = `${fmtDate(TODAY)} ${nowTime()}`;
    $id('otBranch').textContent = DB.branch.name;
    $id('otCash').value = '';
    $id('otQuick').innerHTML = [500, 1000, 1500, 2000].map(v =>
        `<button type="button" class="po-opt po-opt-sm" onclick="$id('otCash').value = ${v}; $id('otCash').focus()">${fmtShort(v)}</button>`).join('');
    openModal('modalAbrirTurno');
    setTimeout(() => $id('otCash').focus(), 60);
}

function confirmAbrirTurno() {
    const raw = $id('otCash').value, cash = round2(raw);
    if (raw === '' || cash < 0) return swalWarn('Falta el fondo de caja', 'Escribe con cuánto efectivo empieza el turno (puede ser $0).');
    if (openTurn() || dayState() === 'cerrado') return closeModal('modalAbrirTurno');
    const id = nextId(DB.turn), now = nowStamp(), folio = `T-${pad(id, 4)}`;
    DB.turn.push({
        id, folio, opening_cash: cash, counted_cash: null, expected_cash: 0, total_sales: 0, sales_count: 0, orders_count: 0,
        opened_at: now, closed_at: null, reopened_at: null, reopen_reason: null, created_at: now, updated_at: now, status: 'open',
        branch_id: DB.branch.id, user_id: DB.user.id, close_user_id: null, reopened_user_id: null, daily_closure_id: null, active: 1,
    });
    closeModal('modalAbrirTurno');
    refreshViews();
    toast(`Turno ${folio} abierto`);
}

// -- Retiros y depósitos (cash_move: tabla que fayxzvov_pos no tiene). Conceptos de CoffeePOS. --
const MOV_QUICK = {
    out: ['Envío a tesorería', 'Pago a proveedor', 'Gasto menor', 'Pago de propinas'],
    in: ['Cambio (monedas)', 'Reposición de fondo', 'Otro ingreso'],
};
const MOV_TXT = { out: ['Retiro de caja', 'arrow-up-from-line', 't-red'], in: ['Depósito a caja', 'arrow-down-to-line', 't-green'] };

const movRow = m => `<div class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-gray-50 border border-gray-100">
    <span class="po-m-ico sm ${MOV_TXT[m.type][2]}"><i data-lucide="${MOV_TXT[m.type][1]}"></i></span>
    <span class="flex-1 min-w-0"><span class="block truncate text-[12px] font-medium text-gray-900">${esc(m.concept)}</span>
        <span class="block text-[10px] text-gray-500">${hourOf(m.at)} · ${esc(userName(m.user_id))} · ${m.type === 'in' ? 'Depósito' : 'Retiro'}</span></span>
    <b class="text-[13px] ${m.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}">${m.type === 'in' ? '+' : '−'}${fmt(m.amount)}</b></div>`;

function openMovCaja(type) {
    if (!requireTurn()) return;
    $id('mcAmount').value = '';
    $id('mcConcept').value = '';
    setMovType(type);
    openModal('modalMovCaja');
    setTimeout(() => $id('mcAmount').focus(), 60);
}

function setMovType(type) {
    S.movType = type;
    const [title, icon, tone] = MOV_TXT[type];
    $id('segMov').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === type));
    icoBox($id('mcIcon'), icon, tone);
    $id('mcTitle').textContent = title;
    $id('mcQuick').innerHTML = MOV_QUICK[type].map(c => `<button type="button" class="po-opt po-opt-sm" onclick="pickMovConcept(this.textContent)">${c}</button>`).join('');
    const tu = openTurn(), moves = tu ? DB.cash_move.filter(m => m.turn_id === tu.id) : [];
    $id('mcList').innerHTML = moves.length ? moves.slice().reverse().map(movRow).join('') : '<div class="text-[12px] text-gray-500">Sin retiros ni depósitos en este turno.</div>';
    icons();
}

function pickMovConcept(txt) {
    $id('mcConcept').value = txt;
    $id(!$id('mcAmount').value ? 'mcAmount' : 'mcConcept').focus();
}

function confirmMovCaja() {
    const tu = openTurn();
    if (!tu) return closeModal('modalMovCaja');
    const amount = round2($id('mcAmount').value), concept = $id('mcConcept').value.trim(), out = S.movType === 'out';
    if (!(amount > 0)) return swalWarn('Monto inválido', 'Escribe un monto mayor a cero.');
    if (!concept) return swalWarn('Falta el concepto', 'Explica para qué es el movimiento.');
    const inDrawer = turnStats(tu.id).expected;
    if (out && amount > inDrawer) return swalWarn('No alcanza el efectivo', `En caja debería haber ${fmt(inDrawer)}.`);
    DB.cash_move.push({ id: nextId(DB.cash_move), turn_id: tu.id, type: S.movType, amount, concept: concept.slice(0, 255), at: nowStamp(), user_id: DB.user.id });
    closeModal('modalMovCaja');
    refreshViews();
    toast(`${out ? 'Retiro' : 'Depósito'} de ${fmt(amount)} registrado`);
}

// -- Corte X (consulta, no cierra) / corte Z (cierra el turno); sin turno abierto muestra el último cerrado --
function openCorte(mode, turnId = null) {
    const tu = turnId ? turnById(turnId) : openTurn() || DB.turn.filter(t => t.status === 'closed').slice(-1)[0];
    if (!tu || (mode === 'z' && tu.status !== 'open')) return requireTurn();
    S.corteMode = mode;
    S.corteTurnId = tu.id;
    renderCorte();
    openModal('modalCorte');
    if (mode === 'z') setTimeout(() => $id('corteCounted').focus(), 60);
}

function renderCorte() {
    const k = turnStats(S.corteTurnId), tu = k.tu, closed = tu.status !== 'open', z = S.corteMode === 'z' && !closed;
    $id('corteTitle').textContent = closed ? `Corte Z · ${tu.folio}` : z ? 'Cerrar turno (corte Z)' : 'Corte X (parcial)';
    $id('corteSub').textContent = `${tu.folio} · ${userName(tu.user_id)} · abrió ${hourOf(tu.opened_at)}${closed ? ` · cerró ${hourOf(tu.closed_at)} (${userName(tu.close_user_id)})` : ' · sigue abierto'}`;
    icoBox($id('corteIcon'), closed || z ? 'lock' : 'receipt-text', closed ? 't-gray' : z ? 't-orange' : 't-blue');
    $id('corteKpis').innerHTML = kpiTile('Ventas <small>total_sales</small>', fmt(k.total_sales), 'text-emerald-600') + kpiTile('Tickets / pedidos', `${k.sales_count} / ${k.orders_count}`)
        + kpiTile('Cobrado en el turno', fmt(k.collected)) + kpiTile('Propinas', fmt(k.tips));
    $id('cortePayments').innerHTML = miniTable('1fr 76px 76px 88px', ['Forma', 'Ventas', 'Abonos', 'Total'],
        k.methods.map(x => [esc(x.m.name), fmt(x.sales), fmt(x.abonos), `<b class="text-gray-900">${fmt(x.sales + x.abonos)}</b>`]),
        ['Total', fmt(sum(k.methods, x => x.sales)), fmt(sum(k.methods, x => x.abonos)), fmt(k.collected)]);
    $id('corteStatus').innerHTML = miniTable('1fr 36px 96px', ['Estado', '#', 'Importe'], statusRows(k.statuses));
    $id('corteCash').innerHTML = cashBreakdown(k, true);
    S.corteExpected = closed ? tu.expected_cash : k.expected;
    $id('corteCountWrap').classList.toggle('hidden', !z && !closed);
    $id('corteCounted').disabled = closed;
    $id('corteCounted').value = closed ? (tu.counted_cash ?? '') : '';
    calcCorteDiff();
    // El mismo botón cierra el turno (corte Z) o reabre el último turno cerrado de hoy
    const last = DB.turn[DB.turn.length - 1];
    const canReopen = closed && tu === last && !openTurn() && dayState() !== 'cerrado' && tu.opened_at.slice(0, 10) === TODAY;
    const btn = $id('btnCerrarTurno');
    btn.className = `po-btn ${canReopen ? 'po-btn-ghost' : 'po-btn-warn'}${!z && !canReopen ? ' hidden' : ''}`;
    btn.innerHTML = canReopen ? '<i data-lucide="rotate-ccw" class="w-4 h-4"></i><span>Reabrir turno</span>' : '<i data-lucide="lock" class="w-4 h-4"></i><span>Cerrar turno</span>';
    btn.onclick = canReopen ? reopenTurn : confirmCerrarTurno;
    icons();
}

function calcCorteDiff() {
    const raw = $id('corteCounted').value, el = $id('corteDiff');
    if (raw === '') { el.textContent = '—'; el.className = 'text-[15px] font-bold text-gray-400'; return; }
    const d = round2(round2(raw) - S.corteExpected);
    el.textContent = d === 0 ? 'Cuadra · $0.00' : `${d > 0 ? 'Sobran' : 'Faltan'} ${fmt(Math.abs(d))}`;
    el.className = `text-[15px] font-bold ${diffTone(d)}`;
}

async function confirmCerrarTurno() {
    const tu = turnById(S.corteTurnId), raw = $id('corteCounted').value;
    if (!tu || tu.status !== 'open') return;
    if (raw === '' || round2(raw) < 0) return swalWarn('Falta el efectivo contado', 'Cuenta el efectivo de la caja y escríbelo (counted_cash).');
    const counted = round2(raw), d = round2(counted - S.corteExpected);
    if (!await swalConfirm(`¿Cerrar el turno ${tu.folio}?`, `Esperado ${fmt(S.corteExpected)} · contado ${fmt(counted)} · ${diffTxt(d)}. Después ya no se puede cobrar en este turno.`, 'Sí, cerrar turno')) return;
    snapshotTurn(tu);
    Object.assign(tu, { counted_cash: counted, status: 'closed', closed_at: nowStamp(), close_user_id: DB.user.id });
    S.corteMode = 'x';
    renderCorte();
    refreshViews();
    toast(`Turno ${tu.folio} cerrado`);
}

async function reopenTurn() {
    const tu = turnById(S.corteTurnId);
    const r = await swalBase({ icon: 'question', title: `Reabrir ${tu.folio}`, input: 'textarea', inputPlaceholder: 'Motivo (reopen_reason)',
        showCancelButton: true, confirmButtonText: 'Continuar', inputValidator: v => !v.trim() && 'Escribe el motivo' });
    if (!r.isConfirmed) return;
    askPin(`Reabrir el turno ${tu.folio}`, mgr => {
        const now = nowStamp();
        Object.assign(tu, { status: 'open', reopened_at: now, reopened_user_id: mgr, updated_at: now,
            reopen_reason: [tu.reopen_reason, `${now} · ${r.value.trim()}`].filter(Boolean).join('\n') });
        renderCorte();
        refreshViews();
        toast(`Turno ${tu.folio} reabierto`);
    });
}

// -- Papel de 80 mm: ticket de venta y cortes (se abre encima de lo que esté abierto) --
function showPaper(sub, html, saleId = null) {
    S.printSaleId = saleId;
    $id('printSub').textContent = sub;
    $id('ticketPaper').innerHTML = html;
    const s = saleId ? saleById(saleId) : null;
    $id('btnPrintWa').classList.toggle('hidden', !s || isPublic(s.customer_id) || !customer(s.customer_id)?.phone);
    openModal('modalImprimir');
}
const paperRow = (a, b, bold) => `<div class="flex justify-between gap-2 ${bold ? 'font-bold' : ''}"><span>${a}</span><span class="text-right">${b}</span></div>`;
const PAPER_HR = '<div class="border-t border-dashed border-[#999] my-2"></div>';

function printCorte() {
    const k = turnStats(S.corteTurnId), tu = k.tu, closed = tu.status !== 'open', r = paperRow;
    showPaper(`${closed ? 'Corte Z' : 'Corte X'} · ${tu.folio} · 80 mm`, `
        <p class="text-center font-bold text-[13px]">${esc(DB.branch.name)}</p>
        <p class="text-center">${closed ? 'CORTE Z · CIERRE DE TURNO' : 'CORTE X · PARCIAL'}</p>
        <p class="text-center">${tu.folio} · ${esc(userName(tu.user_id))} · ${fmtDate(tu.opened_at)} ${hourOf(tu.opened_at)}–${closed ? hourOf(tu.closed_at) : nowTime()}</p>${PAPER_HR}
        ${k.methods.map(x => r(esc(x.m.name), fmt(x.sales + x.abonos))).join('')}${r('TOTAL COBRADO', fmt(k.collected), true)}${PAPER_HR}
        ${r('Ventas', fmt(k.total_sales))}${r('Tickets / pedidos', `${k.sales_count} / ${k.orders_count}`)}${r('Propinas', fmt(k.tips))}
        ${k.statuses.filter(x => x.count).map(x => r(DB.sale_status[x.id], `${x.count} · ${fmt(x.amount)}`)).join('')}${PAPER_HR}
        ${r('Fondo inicial', fmt(tu.opening_cash))}${r('+ Efectivo cobrado', fmt(k.cashSales + k.cashAbonos))}${r('+ Depósitos', fmt(k.cashIn))}${r('− Retiros', fmt(k.cashOut))}
        ${r('ESPERADO', fmt(S.corteExpected), true)}
        ${closed ? r('Contado', fmt(tu.counted_cash)) + r('Diferencia', diffTxt(round2(tu.counted_cash - tu.expected_cash))) : ''}${PAPER_HR}
        <p class="text-center">Impreso ${fmtDate(TODAY)} ${nowTime()} · ${esc(DB.user.name)}</p>`);
}

// -- Cierre del día: suma los turnos de hoy (daily_closure + sus dos tablas de detalle) --
function dayStats() {
    const turns = dayTurns(), ids = turns.map(t => t.id);
    const sales = DB.sale.filter(s => ids.includes(s.turn_id)), live = sales.filter(s => [2, 3].includes(s.sale_status_id));
    const pays = DB.payment.filter(p => ids.includes(p.turn_id) && !p.deleted_at);
    const abonos = DB.receivable.filter(r => ids.includes(r.turn_id) && r.kind === 'abono' && !r.deleted_at);
    const moves = DB.cash_move.filter(m => ids.includes(m.turn_id));
    // payment no tiene propina: la de cada venta se reparte entre sus pagos en proporción al importe
    const tipShare = p => { const s = saleById(p.sale_id), all = s ? sum(salePayments(s.id), x => x.amount) : 0; return s?.tip_amount && all ? s.tip_amount * p.amount / all : 0; };
    const rows = [];
    DB.payment_method.forEach(m => {
        const ps = pays.filter(p => p.payment_method_id === m.id), ab = abonos.filter(r => r.payment_method_id === m.id);
        if (ps.length) rows.push({ source: 'venta', m, payments_count: ps.length, amount: round2(sum(ps, p => p.amount)), tip: round2(sum(ps, tipShare)) });
        if (ab.length) rows.push({ source: 'abono', m, payments_count: ab.length, amount: round2(sum(ab, r => r.amount)), tip: 0 });
    });
    const folios = sales.filter(s => s.sale_status_id !== 1).map(s => Number(s.folio)).sort((a, b) => a - b);
    return {
        turns, sales, rows,
        sales_count: live.filter(s => s.sale_type_id !== 1).length, orders_count: live.filter(s => s.sale_type_id === 1).length,
        cancelled_count: sales.filter(s => s.sale_status_id === 4).length, turns_count: turns.length,
        subtotal: round2(sum(live, s => s.subtotal)), discount: round2(sum(live, s => s.discount_amount)),
        tip: round2(sum(live, s => s.tip_amount)), total: round2(sum(live, s => s.total)),
        total_shifts: round2(sum(rows, x => x.amount)), total_cash: round2(sum(rows.filter(x => x.m.is_cash), x => x.amount)),
        cash_in: round2(sum(moves.filter(m => m.type === 'in'), m => m.amount)), cash_out: round2(sum(moves.filter(m => m.type === 'out'), m => m.amount)),
        first_folio: folios.length ? String(folios[0]) : null, last_folio: folios.length ? String(folios[folios.length - 1]) : null,
        statuses: Object.keys(DB.sale_status).map(Number).map(id => { const ss = sales.filter(s => s.sale_status_id === id); return { id, count: ss.length, amount: round2(sum(ss, s => s.total)) }; }),
    };
}

// Renglón de turno: en el modal de cierre primero se cierra el modal y luego se abre el corte
function turnRow(t, inModal = false) {
    const s = turnStats(t.id), open = t.status === 'open', d = round2((t.counted_cash || 0) - t.expected_cash);
    const pre = inModal ? "closeModal('modalCierre'); " : '';
    const btn = open
        ? `<button type="button" class="po-btn po-btn-warn sm" onclick="${pre}openCorte('z')"><i data-lucide="lock" class="w-3.5 h-3.5"></i><span>Corte Z</span></button>`
        : `<button type="button" class="po-btn po-btn-ghost sm" onclick="${pre}openCorte('x', ${t.id})"><span>Ver corte</span></button>`;
    return `<div class="flex items-center gap-2 py-2 border-t border-gray-100 first:border-0 first:pt-0">
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5"><b class="text-[12px] text-gray-900">${t.folio}</b><span class="po-chip ${open ? 't-green' : 't-gray'}">${open ? 'Abierto' : 'Cerrado'}</span></div>
            <div class="text-[11px] text-gray-500 truncate">${esc(userName(t.user_id))} · ${hourOf(t.opened_at)}–${open ? 'ahora' : hourOf(t.closed_at)} · ventas ${fmt(s.total_sales)} · cobrado ${fmt(s.collected)}</div>
            ${open ? '' : `<div class="text-[11px] text-gray-500">Esperado ${fmt(t.expected_cash)} · contado ${fmt(t.counted_cash)} · <b class="${diffTone(d)}">${diffTxt(d)}</b></div>`}
        </div>${btn}</div>`;
}

function openCierreModal() { renderCierre(); openModal('modalCierre'); }

function renderCierre() {
    const st = dayState(), c = dayClosure(), tu = openTurn(), k = dayStats();
    const [chipTxt, chipTone] = { abierto: ['ABIERTO', 't-green'], cerrado: ['CERRADO', 't-gray'], reabierto: ['REABIERTO', 't-amber'] }[st];
    $id('cierreStatusChip').textContent = chipTxt;
    $id('cierreStatusChip').className = `po-chip ${chipTone}`;
    $id('cierreSub').textContent = `${dayName(TODAY)} ${fmtDate(TODAY)} · ${DB.branch.name}${c ? ` · ${c.folio} · cerró ${userName(c.user_id)} a las ${hourOf(c.closure_date)}` : ''}`;

    const warns = [];
    if (tu) warns.push(`Hay un turno abierto (${tu.folio} · ${userName(tu.user_id)}): ciérralo con corte Z antes de cerrar el día.`);
    if (!k.turns.length) warns.push('Hoy no hubo turnos.');
    const sinEntregar = DB.sale.filter(s => s.sale_type_id === 1 && [2, 3].includes(s.sale_status_id) && s.delivery_status !== 1 && s.delivery_date === TODAY).length;
    if (sinEntregar) warns.push(`${sinEntregar} pedido(s) con entrega hoy siguen sin entregar.`);
    const warn = $id('cierreWarn');
    warn.innerHTML = `<i data-lucide="triangle-alert" class="w-4 h-4 shrink-0 mt-px"></i><span>${esc(warns.join(' '))}</span>`;
    warn.classList.toggle('hidden', !warns.length || st === 'cerrado');

    $id('cierreKpis').innerHTML = kpiTile('Total del día', fmt(k.total), 'text-emerald-600') + kpiTile('Ventas', k.sales_count) + kpiTile('Pedidos', k.orders_count)
        + kpiTile('Canceladas', k.cancelled_count, k.cancelled_count ? 'text-rose-600' : 'text-gray-900') + kpiTile('Turnos', k.turns_count)
        + kpiTile('Folios', k.first_folio ? `${k.first_folio}–${k.last_folio}` : '—');
    $id('cierrePayments').innerHTML = miniTable('1fr 64px 32px 88px 68px', ['Forma', 'Origen', '#', 'Importe', 'Propina'],
        k.rows.map(x => [esc(x.m.name), `<span class="po-chip ${x.source === 'venta' ? 't-blue' : 't-purple'}">${x.source}</span>`, x.payments_count, fmt(x.amount), fmt(x.tip)]),
        ['Total', '', sum(k.rows, x => x.payments_count), fmt(k.total_shifts), fmt(sum(k.rows, x => x.tip))]);
    const line = (lbl, v, tone = 'text-gray-900') => `<div class="flex justify-between gap-2 py-0.5"><span class="text-gray-500">${lbl}</span><span class="font-semibold ${tone}">${v}</span></div>`;
    const col = c => ` <small class="text-gray-400">${c}</small>`;
    $id('cierreAmounts').innerHTML = line('Subtotal' + col('subtotal'), fmt(k.subtotal)) + line('Descuentos (cuenta + tarjeta)' + col('discount'), '−' + fmt(k.discount), 'text-rose-600')
        + line('IVA' + col('tax'), 'sale no tiene columna', 'text-gray-400') + line('Propinas' + col('tip'), fmt(k.tip))
        + line('<b class="text-gray-900">Total</b>' + col('total'), fmt(k.total), 'text-emerald-600 !font-bold')
        + '<div class="border-t border-gray-200 my-1.5"></div>'
        + line('Cobrado en turnos' + col('total_shifts'), fmt(k.total_shifts)) + line('Cobrado en efectivo' + col('total_cash'), fmt(k.total_cash))
        + line('Depósitos' + col('cash_in'), fmt(k.cash_in)) + line('Retiros' + col('cash_out'), '−' + fmt(k.cash_out), 'text-rose-600');
    $id('cierreStatus').innerHTML = miniTable('1fr 36px 96px', ['Estado', '#', 'Importe'], statusRows(k.statuses));
    $id('cierreTurns').innerHTML = k.turns.map(t => turnRow(t, true)).join('') || '<div class="text-[12px] text-gray-500">Sin turnos hoy.</div>';

    const info = $id('cierreReopenInfo');
    info.innerHTML = c?.reopened_at ? `<div class="po-note t-gray"><i data-lucide="rotate-ccw" class="w-4 h-4 shrink-0 mt-px"></i><span>Reabierto por <b>${esc(userName(c.reopened_user_id))}</b>
        el ${fmtDate(c.reopened_at)} a las ${hourOf(c.reopened_at)} (reopen_reason):<br>${esc(c.reopen_reason).replace(/\n/g, '<br>')}</span></div>` : '';
    info.classList.toggle('hidden', !c?.reopened_at);
    $id('cierreNote').value = c?.note || '';
    $id('cierreNote').disabled = st === 'cerrado';
    $id('btnCerrarDia').classList.toggle('hidden', st === 'cerrado');
    $id('btnCerrarDia').disabled = !!tu || !k.turns.length;
    $id('btnReabrirDia').classList.toggle('hidden', st !== 'cerrado');
    icons();
}

async function confirmCierreDia() {
    if (openTurn()) return swalWarn('Hay un turno abierto', 'Ciérralo con corte Z antes de cerrar el día.');
    const k = dayStats();
    if (!k.turns.length) return swalWarn('Sin turnos', 'Hoy no hubo turnos que cerrar.');
    if (!await swalConfirm('¿Cerrar el día?', `Total ${fmt(k.total)} en ${k.turns_count} turno(s). Para volver a vender hoy hará falta reabrirlo con PIN de gerente.`, 'Sí, cerrar el día')) return;
    const now = stampSec();
    let c = dayClosure();
    if (!c) {
        c = { id: nextId(DB.daily_closure), created_at: now, reopen_reason: null, reopened_at: null, reopened_user_id: null, branch_id: DB.branch.id, active: 1 };
        c.folio = `CD-${pad(c.id, 4)}`;
        DB.daily_closure.push(c);
    }
    Object.assign(c, {
        note: $id('cierreNote').value.trim().slice(0, 255) || null, first_folio: k.first_folio, last_folio: k.last_folio,
        sales_count: k.sales_count, cancelled_count: k.cancelled_count, orders_count: k.orders_count, turns_count: k.turns_count,
        subtotal: k.subtotal, discount: k.discount, tax: 0, tip: k.tip, total: k.total, total_shifts: k.total_shifts, total_cash: k.total_cash,
        cash_in: k.cash_in, cash_out: k.cash_out, closure_date: now, updated_at: now, user_id: DB.user.id,
    });
    // Volver a cerrar un día reabierto: los renglones viejos quedan con active = 0
    DB.daily_closure_payment.filter(d => d.daily_closure_id === c.id).forEach(d => d.active = 0);
    DB.daily_closure_status.filter(d => d.daily_closure_id === c.id).forEach(d => d.active = 0);
    k.rows.forEach(x => DB.daily_closure_payment.push({ id: nextId(DB.daily_closure_payment), daily_closure_id: c.id, payment_method_id: x.m.id,
        source: x.source, payments_count: x.payments_count, amount: x.amount, tip: x.tip, created_at: now, updated_at: now, active: 1 }));
    k.statuses.filter(x => x.count).forEach(x => DB.daily_closure_status.push({ id: nextId(DB.daily_closure_status), daily_closure_id: c.id,
        sale_status_id: x.id, amount: x.amount, created_at: now, updated_at: now, active: 1 }));
    k.turns.forEach(t => t.daily_closure_id = c.id);
    k.sales.forEach(s => s.daily_closure_id = c.id);
    renderCierre();
    refreshViews();
    toast(`Día cerrado · ${c.folio}`);
}

async function reopenDay() {
    const c = dayClosure();
    if (!c) return;
    const r = await swalBase({ icon: 'warning', title: 'Reabrir el día', text: 'Se podrá abrir turno y vender otra vez. Los totales se recalculan al volver a cerrar.',
        input: 'textarea', inputPlaceholder: 'Motivo (reopen_reason)', showCancelButton: true, confirmButtonText: 'Continuar', inputValidator: v => !v.trim() && 'Escribe el motivo' });
    if (!r.isConfirmed) return;
    askPin('Reabrir el día', mgr => {
        const now = stampSec();
        Object.assign(c, { reopened_at: now, reopened_user_id: mgr, updated_at: now,
            reopen_reason: [c.reopen_reason, `${now.slice(0, 16)} · ${r.value.trim()}`].filter(Boolean).join('\n') });
        renderCierre();
        refreshViews();
        toast('Día reabierto');
    });
}

// -- Turno en la barra superior y menú Caja --
function renderTurnHeader() {
    const tu = openTurn(), st = dayState(), k = tu ? turnStats(tu.id) : null;
    $id('lblBranch').textContent = `${DB.company.name} · ${DB.branch.name}`;
    $id('lblUser').textContent = DB.user.name;
    $id('turnBadge').className = `po-turn ${tu ? 't-green' : st === 'cerrado' ? 't-purple' : 't-red'}`;
    $id('turnDot').className = `w-1.5 h-1.5 rounded-full shrink-0 ${tu ? 'bg-emerald-500 pulse-dot' : 'bg-current'}`;
    $id('lblTurnName').textContent = tu ? `Turno ${tu.folio}` : st === 'cerrado' ? 'Día cerrado' : 'Sin turno';
    $id('lblTurnInfo').textContent = tu ? `${userName(tu.user_id)} · desde ${hourOf(tu.opened_at)}` : st === 'cerrado' ? 'Reabre el día para vender' : 'Abre un turno para cobrar';
    $id('lblTurnSales').textContent = fmtShort(k ? k.total_sales : 0);
    $id('lblTurnOrders').textContent = k ? k.sales_count + k.orders_count : 0;
    $id('ddAbrirTurno').classList.toggle('hidden', !!tu);
    document.querySelectorAll('.caja-needs-turn').forEach(b => b.classList.toggle('hidden', !tu));
}

// -- Vista Caja --
function renderCaja() {
    const el = $id('cajaWrap');
    if (!el) return;
    const tu = openTurn(), st = dayState();
    const shown = tu || DB.turn.filter(t => t.status === 'closed').slice(-1)[0] || null;
    const [chipTxt, chipTone] = tu ? ['Turno abierto', 't-green'] : st === 'cerrado' ? ['Día cerrado', 't-purple'] : ['Sin turno', 't-red'];
    const actions = (tu
        ? actBtn('arrow-up-from-line', 'Retiro', "openMovCaja('out')") + actBtn('arrow-down-to-line', 'Depósito', "openMovCaja('in')")
            + actBtn('receipt-text', 'Corte X', "openCorte('x')") + actBtn('lock', 'Cerrar turno', "openCorte('z')", 'po-btn-warn')
        : st === 'cerrado' ? '' : actBtn('door-open', 'Abrir turno', 'openAbrirTurno()', 'po-btn-brand'))
        + actBtn('calendar-check', 'Cierre del día', 'openCierreModal()', st === 'cerrado' ? 'po-btn-brand' : 'po-btn-ghost');
    const sub = tu ? `${tu.folio} · ${esc(userName(tu.user_id))} · desde las ${hourOf(tu.opened_at)} · fondo ${fmt(tu.opening_cash)}`
        : shown ? `Último turno: ${shown.folio} · ${esc(userName(shown.user_id))} · ${hourOf(shown.opened_at)}–${hourOf(shown.closed_at)}`
        : 'Aún no hay turnos hoy.';
    const head = viewHead('Caja', sub, actions, `<span class="po-chip ${chipTone}">${chipTxt}</span>`);
    if (!shown) {
        el.innerHTML = head + panel('Turno', 'wallet', emptyBox('door-open', 'No hay turno abierto', 'Abre un turno con su fondo de caja para empezar a cobrar.', actBtn('door-open', 'Abrir turno', 'openAbrirTurno()', 'po-btn-brand')));
        return icons();
    }
    const k = turnStats(shown.id), closed = shown.status !== 'open';
    const d = closed ? round2((shown.counted_cash || 0) - shown.expected_cash) : 0;
    const kpis = '<div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2 mb-3">'
        + kpiTile('Efectivo esperado', fmt(closed ? shown.expected_cash : k.expected), 'text-emerald-600', closed ? `contado ${fmt(shown.counted_cash)} · ${diffTxt(d)}` : 'lo que debe haber en el cajón')
        + kpiTile('Ventas del turno', fmt(k.total_sales), 'text-gray-900', `${k.sales_count} ticket(s) · ${k.orders_count} pedido(s)`)
        + kpiTile('Cobrado', fmt(k.collected), 'text-gray-900', 'ventas + abonos')
        + kpiTile('Propinas', fmt(k.tips))
        + kpiTile('Retiros / depósitos', `${fmtShort(k.cashOut)} / ${fmtShort(k.cashIn)}`, 'text-gray-900', `${k.moves.length} movimiento(s)`)
        + '</div>';
    const payments = miniTable('1fr 84px 84px 96px', ['Forma de pago', 'Ventas', 'Abonos', 'Total'],
        k.methods.map(x => [`<span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full shrink-0" style="background:${methodTone(x.m)}"></span>${esc(x.m.name)}</span>`, fmt(x.sales), fmt(x.abonos), `<b class="text-gray-900">${fmt(x.sales + x.abonos)}</b>`]),
        ['Total', fmt(sum(k.methods, x => x.sales)), fmt(sum(k.methods, x => x.abonos)), fmt(k.collected)]);
    const moves = k.moves.length ? `<div class="space-y-1.5">${k.moves.slice().reverse().map(movRow).join('')}</div>`
        : '<div class="text-[12px] text-gray-500">Sin retiros ni depósitos en este turno.</div>';
    const moveBtns = tu ? `<div class="flex gap-1.5">
        <button type="button" class="po-btn po-btn-ghost sm" onclick="openMovCaja('out')"><i data-lucide="arrow-up-from-line" class="w-3.5 h-3.5"></i><span>Retiro</span></button>
        <button type="button" class="po-btn po-btn-ghost sm" onclick="openMovCaja('in')"><i data-lucide="arrow-down-to-line" class="w-3.5 h-3.5"></i><span>Depósito</span></button></div>` : '';
    const turns = dayTurns();
    el.innerHTML = head + kpis + `<div class="grid lg:grid-cols-3 gap-3">
        <div class="lg:col-span-2 space-y-3">
            ${panel(closed ? `Cobros por forma de pago · ${shown.folio}` : 'Cobros por forma de pago', 'wallet', payments)}
            ${panel('Retiros y depósitos', 'arrow-right-left', moves, moveBtns)}
        </div>
        <div class="space-y-3">
            ${panel('Efectivo en caja', 'banknote', cashBreakdown(k))}
            ${panel('Turnos de hoy', 'history', turns.length ? turns.map(t => turnRow(t)).join('') : '<div class="text-[12px] text-gray-500">Sin turnos hoy.</div>')}
            ${panel('Ventas por estado', 'list-checks', miniTable('1fr 36px 96px', ['Estado', '#', 'Importe'], statusRows(k.statuses)))}
        </div></div>`;
    icons();
}
