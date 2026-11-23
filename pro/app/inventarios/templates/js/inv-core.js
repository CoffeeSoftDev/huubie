// Inventarios (Huubie PRO) · núcleo: utilidades, motor de stock, arranque con SEED_DOCS,
// shell de pro (rail, barra, sucursal, oscuro), modales, visor lateral y avisos.
// El motor hace lo que hará el mdl real: cada documento aplicado mueve `stock`, `stock_lot`
// y deja su renglón en el kárdex (= vista inventory_movement) con Antes → Quedó.

// -- Utilidades --
const $id = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = () => { if (window.lucide) lucide.createIcons(); };
const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = n => MXN.format(Number(n) || 0);
const moneyK = n => { const v = Number(n) || 0; return Math.abs(v) >= 100000 ? `$${(v / 1000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} mil` : money(v); };
const num = (n, d = 2) => (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: d });
const round = (n, d = 3) => Math.round((Number(n) || 0) * 10 ** d) / 10 ** d;
const pad = (n, l = 2) => String(n).padStart(l, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
const dayISO = n => { const d = new Date(TODAY); d.setDate(d.getDate() + n); return isoOf(d); };
const parseISO = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const daysFromToday = iso => Math.round((parseISO(iso) - TODAY) / 864e5);
const nowStamp = () => { const d = new Date(); return `${isoOf(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fdate = iso => { if (!iso) return '—'; const d = parseISO(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
const ftime = s => (s && s.length > 10) ? s.slice(11, 16) : '';
const fstamp = s => s ? `${fdate(s)} ${ftime(s)}`.trim() : '—';
const relDay = iso => { if (!iso) return '—'; const n = daysFromToday(iso); return n === 0 ? 'Hoy' : n === -1 ? 'Ayer' : n === 1 ? 'Mañana' : fdate(iso); };
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Lote de producción: PRD-20NOV (día + mes en letras; con números «2011» parecía un año)
const prodBatch = iso => `PRD-${iso.slice(8, 10)}${['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][Number(iso.slice(5, 7)) - 1]}`;
const tone = hex =>`--tone:${hex || 'rgb(var(--brand-600,192 90 64))'}`;
const plural = (n, one, many) => `${num(n, 0)} ${n === 1 ? one : many}`;

// -- Búsquedas en catálogos --
const byId = (arr, id) => arr.find(x => x.id === Number(id));
const branchOf = id => byId(DB.branches, id);
const whOf = id => byId(DB.warehouses, id);
const itemOf = id => byId(DB.items, id);
const unitOf = id => byId(DB.units, id);
const areaOf = id => byId(DB.areas, id);
const originOf = id => byId(DB.origins, id);
const reasonOf = id => byId(DB.reasons, id);
const deptOf = id => byId(DB.departments, id);
const supplierOf = id => byId(DB.suppliers, id);
const adjReasonOf = id => byId(DB.adjReasons, id);
const tStatusOf = id => byId(DB.transferStatus, id);
const rStatusOf = id => byId(DB.reqStatus, id);
const presOf = id => byId(DB.presentations, id);
const originBy = code => DB.origins.find(o => o.code === code);
const reasonBy = code => DB.reasons.find(r => r.code === code);
const tStatusBy = code => DB.transferStatus.find(s => s.code === code);
const rStatusBy = code => DB.reqStatus.find(s => s.code === code);
const itemByName = n => DB.items.find(i => i.name === n);
const userName = id => DB.users[id] || '—';
const unitCode = it => unitOf(it?.unit_id)?.code || '';
const catOf = it => it.kind === 'product' ? byId(DB.posCategories, it.pos_category_id) : byId(DB.categories, it.item_category_id);
const presOfItem = id => DB.presentations.filter(p => p.item_id === Number(id) && p.active);
const whName = id => whOf(id)?.name || '—';
const branchName = id => branchOf(id)?.short || '—';
const mainBranch = () => DB.branches.find(b => b.main);
const mainWh = () => DB.warehouses.find(w => w.is_main && w.active);
const whOfBranch = bid => DB.warehouses.filter(w => w.branch_id === Number(bid) && w.active);
const defaultWh = bid => whOfBranch(bid).find(w => w.is_default) || whOfBranch(bid)[0];
// El artículo guarda su área sugerida; en otro almacén se usa la del mismo nombre
const areaIn = (whId, it) => { const a = areaOf(it.warehouse_area_id); return a ? DB.areas.find(x => x.warehouse_id === Number(whId) && x.name === a.name) : null; };
const allowsDecimals = it => !!unitOf(it?.unit_id)?.allows_decimals;

// -- Saldo vivo (stock) --
const skey = (w, i) => `${w}:${i}`;
function stockRow(w, i, create = false) {
    let r = DB.stock[skey(w, i)];
    if (!r && create) r = DB.stock[skey(w, i)] = { quantity: 0, stock_min: null, stock_max: null, last_movement_at: null, last_count_at: null };
    return r || null;
}
const qtyIn = (w, i) => stockRow(w, i)?.quantity || 0;
const qtyBranch = (b, i) => whOfBranch(b).reduce((s, w) => s + qtyIn(w.id, i), 0);
const qtyAll = i => DB.warehouses.reduce((s, w) => s + qtyIn(w.id, i), 0);
const minOf = (it, w) => stockRow(w, it.id)?.stock_min ?? it.stock_min;
const maxOf = (it, w) => stockRow(w, it.id)?.stock_max ?? it.stock_max;
function levelOf(q, min, max) {
    if (q <= 0) return 'out';
    if (q < min) return 'low';
    if (max > 0 && q > max) return 'over';
    return 'ok';
}
const LEVEL = {
    ok: { label: 'OK', hex: '#059669', icon: 'circle-check' },
    low: { label: 'Bajo', hex: '#D97706', icon: 'triangle-alert' },
    out: { label: 'Agotado', hex: '#E11D48', icon: 'circle-x' },
    over: { label: 'Sobre máximo', hex: '#0369A1', icon: 'arrow-up-wide-narrow' },
};
// Lotes vivos con caducidad (vencido < 0 días)
const liveLots = (filter = () => true) => DB.lots.filter(l => l.quantity > 0 && l.expires_at && filter(l));
const lotsOf = (w, i) => DB.lots.filter(l => l.warehouse_id === Number(w) && l.item_id === Number(i) && l.quantity > 0).sort(byExpiry);
function byExpiry(a, b) {
    const x = a.expires_at || '9999-12-31', y = b.expires_at || '9999-12-31';
    return x < y ? -1 : x > y ? 1 : a.id - b.id;
}
function expiryTone(iso) {
    const n = daysFromToday(iso);
    if (n < 0) return { label: `Venció ${n === -1 ? 'ayer' : `hace ${-n} días`}`, hex: '#E11D48' };
    if (n === 0) return { label: 'Vence hoy', hex: '#E11D48' };
    if (n <= 2) return { label: n === 1 ? 'Vence mañana' : 'Vence en 2 días', hex: '#D97706' };
    return { label: `Vence en ${n} días`, hex: '#059669' };
}

// =====================================================================
// MOTOR: lo mismo que hará el mdl real dentro de una transacción
// =====================================================================
function nextId(table) { DB.seq[table] = (DB.seq[table] || 0) + 1; return DB.seq[table]; }
// folio_series: ENT-KAF-0001 (un consecutivo por documento y sucursal)
function nextFolio(type, branchId) {
    const k = `${type}-${branchOf(branchId).code}`;
    DB.folios[k] = (DB.folios[k] || 0) + 1;
    return `${k}-${pad(DB.folios[k], 4)}`;
}
// Suma o resta del saldo; devuelve [antes, quedó]. Puede quedar negativo (surtir sin stock, salida sin renglón).
function bump(w, i, delta, at) {
    const r = stockRow(w, i, true);
    const prev = round(r.quantity);
    r.quantity = round(prev + delta);
    r.last_movement_at = at;
    return [prev, r.quantity];
}
function addLot(w, it, qty, o) {
    if (!it.track_lots || qty <= 0) return null;
    const lot = { id: nextId('lot'), item_id: it.id, warehouse_id: Number(w), batch_code: o.batch || null, initial_quantity: qty, quantity: qty, cost: o.cost || it.cost, produced_at: o.produced || null, expires_at: o.expires || null, created_at: o.at, detail: o.detail || null };
    DB.lots.push(lot);
    return lot;
}
// Saca de los lotes empezando por el que vence primero; devuelve lo que tomó de cada uno
function takeLots(w, it, qty) {
    const taken = [];
    if (!it.track_lots) return taken;
    let rest = qty;
    for (const l of lotsOf(w, it.id)) {
        if (rest <= 0) break;
        const t = Math.min(l.quantity, rest);
        l.quantity = round(l.quantity - t);
        rest = round(rest - t);
        taken.push({ lot: l.id, qty: t });
    }
    return taken;
}
const giveBackLots = taken => (taken || []).forEach(t => { const l = DB.lots.find(x => x.id === t.lot); if (l) l.quantity = round(l.quantity + t.qty); });
const move = row => DB.moves.push(row);
const dropMoves = src => { DB.moves = DB.moves.filter(m => m.src !== src); };
function lineTotals(doc, qtyKey = 'quantity', costKey = 'cost') {
    doc.total_products = doc.lines.length;
    doc.total_units = round(doc.lines.reduce((s, l) => s + (Number(l[qtyKey]) || 0), 0));
    doc.total_cost = round(doc.lines.reduce((s, l) => s + (Number(l[qtyKey]) || 0) * (Number(l[costKey]) || 0), 0), 2);
}
// Costo promedio ponderado con lo que hay en toda la empresa
function averageCost(it, qty, cost) {
    const have = Math.max(0, qtyAll(it.id) - qty);
    it.average_cost = (have + qty) > 0 ? round((have * (it.average_cost || it.cost) + qty * cost) / (have + qty), 4) : cost;
}

// -- Entradas (inventory_inflow) --
function createInflow(d) {
    const origin = originOf(d.inflow_origin_id);
    const doc = {
        id: nextId('inflow'), folio: d.folio || nextFolio('ENT', d.branch_id), note: d.note || '', invoice_folio: d.invoice_folio || '',
        voucher_url: d.voucher_url || null, operation_date: d.operation_date, created_at: d.at, confirmed_at: null, cancelled_at: null, cancel_reason: null,
        status: origin.starts_pending && !d.confirm ? 'pending' : 'applied', user_id: d.user_id, confirmed_user_id: null, cancelled_user_id: null,
        branch_id: d.branch_id, warehouse_id: d.warehouse_id, warehouse_area_id: d.warehouse_area_id || null, inflow_origin_id: origin.id,
        supplier_id: d.supplier_id || null, inflow_format_id: d.inflow_format_id || null, requisition_id: d.requisition_id || null,
        lines: d.lines.map(l => ({ id: nextId('dinflow'), item_id: l.item_id, quantity: round(l.quantity), presentation_quantity: l.presentation_quantity ?? null, item_presentation_id: l.item_presentation_id || null, cost: round(l.cost, 4), tax: l.tax || 0, subtotal: round(l.quantity * l.cost, 2), batch_code: l.batch_code || null, expires_at: l.expires_at || null, previous_stock: null, resulting_stock: null })),
    };
    lineTotals(doc);
    doc.subtotal = doc.total_cost; doc.tax = 0; doc.total = doc.total_cost;
    DB.inflows.push(doc);
    if (doc.status === 'applied') applyInflow(doc, d.at, d.user_id);
    return doc;
}
function applyInflow(doc, at, userId) {
    const origin = originOf(doc.inflow_origin_id);
    doc.lines.forEach(l => {
        const it = itemOf(l.item_id);
        [l.previous_stock, l.resulting_stock] = bump(doc.warehouse_id, it.id, l.quantity, at);
        const produced = origin.code === 'PRODUCCION' ? doc.operation_date : null;
        if (it.track_lots && !l.expires_at && it.shelf_life_days) l.expires_at = isoOf(new Date(parseISO(doc.operation_date).getTime() + it.shelf_life_days * 864e5));
        addLot(doc.warehouse_id, it, l.quantity, { batch: l.batch_code, expires: l.expires_at, produced, cost: l.cost, at, detail: l.id });
        if (origin.updates_cost && l.cost > 0) { averageCost(it, l.quantity, l.cost); it.cost = l.cost; }
        move({ src: `in:${doc.id}`, uid: `IN-${l.id}`, type: 'ENTRADA', folio: doc.folio, concept: origin.name, qty: l.quantity, prev: l.previous_stock, post: l.resulting_stock, cost: l.cost, total: l.subtotal, at: `${doc.operation_date} ${ftime(doc.created_at) || '00:00'}`, item_id: it.id, warehouse_id: doc.warehouse_id, branch_id: doc.branch_id, user_id: userId || doc.user_id, doc: { kind: 'in', id: doc.id } });
    });
}
function confirmInflow(doc, userId, at) {
    if (doc.status !== 'pending') return;
    doc.status = 'applied'; doc.confirmed_at = at; doc.confirmed_user_id = userId;
    applyInflow(doc, at, userId);
}
function cancelInflow(doc, reason, userId, at) {
    if (doc.status === 'applied') {
        doc.lines.forEach(l => {
            bump(doc.warehouse_id, l.item_id, -l.quantity, at);
            const lot = DB.lots.find(x => x.detail === l.id && x.warehouse_id === doc.warehouse_id);
            if (lot) lot.quantity = round(Math.max(0, lot.quantity - l.quantity));
        });
        dropMoves(`in:${doc.id}`);
    }
    Object.assign(doc, { status: 'cancelled', cancelled_at: at, cancel_reason: reason, cancelled_user_id: userId });
}

// -- Salidas (inventory_outflow). Merma = motivo con is_loss --
function createOutflow(d) {
    const reason = reasonOf(d.outflow_reason_id);
    const doc = {
        id: nextId('outflow'), folio: d.folio || nextFolio('S', d.branch_id), note: d.note || '', evidence_url: d.evidence_url || null,
        operation_date: d.operation_date, created_at: d.at, cancelled_at: null, cancel_reason: null, status: 'applied',
        user_id: d.user_id, cancelled_user_id: null, branch_id: d.branch_id, warehouse_id: d.warehouse_id,
        outflow_reason_id: reason.id, department_id: d.department_id || null, sale_id: d.sale_id || null, requisition_id: d.requisition_id || null,
        lines: d.lines.map(l => {
            const it = itemOf(l.item_id);
            return { id: nextId('doutflow'), item_id: it.id, quantity: round(l.quantity), presentation_quantity: l.presentation_quantity ?? null, item_presentation_id: l.item_presentation_id || null, cost: it.cost, subtotal: round(l.quantity * it.cost, 2), previous_stock: null, resulting_stock: null, note: l.note || '', lots: [] };
        }),
    };
    lineTotals(doc);
    doc.lines.forEach(l => {
        const it = itemOf(l.item_id);
        [l.previous_stock, l.resulting_stock] = bump(doc.warehouse_id, it.id, -l.quantity, d.at);
        l.lots = takeLots(doc.warehouse_id, it, l.quantity);
        move({ src: `out:${doc.id}`, uid: `OUT-${l.id}`, type: 'SALIDA', folio: doc.folio, concept: reason.name, qty: -l.quantity, prev: l.previous_stock, post: l.resulting_stock, cost: l.cost, total: -l.subtotal, at: `${doc.operation_date} ${ftime(doc.created_at) || '00:00'}`, item_id: it.id, warehouse_id: doc.warehouse_id, branch_id: doc.branch_id, user_id: doc.user_id, doc: { kind: 'out', id: doc.id } });
    });
    DB.outflows.push(doc);
    return doc;
}
function cancelOutflow(doc, reason, userId, at) {
    if (doc.status !== 'applied') return;
    doc.lines.forEach(l => { bump(doc.warehouse_id, l.item_id, l.quantity, at); giveBackLots(l.lots); });
    dropMoves(`out:${doc.id}`);
    Object.assign(doc, { status: 'cancelled', cancelled_at: at, cancel_reason: reason, cancelled_user_id: userId });
}

// -- Traspasos (inventory_transfer): Solicitado -> Recibido (mueve los dos almacenes a la vez) --
function createTransfer(d) {
    const st = tStatusBy('REQUESTED');
    const to = whOf(d.destination_warehouse_id);
    const doc = {
        id: nextId('transfer'), folio: nextFolio('TRA', d.origin_branch_id), note: d.note || '', requested_at: d.at, received_at: null, reject_reason: null,
        created_at: d.at, transfer_status_id: st.id, requested_user_id: d.user_id, received_user_id: null,
        origin_branch_id: d.origin_branch_id, destination_branch_id: to.branch_id, origin_warehouse_id: d.origin_warehouse_id, destination_warehouse_id: to.id,
        lines: d.lines.map(l => { const it = itemOf(l.item_id); return { id: nextId('dtransfer'), item_id: it.id, quantity: round(l.quantity), quantity_received: null, cost: it.cost, subtotal: round(l.quantity * it.cost, 2), origin_previous_stock: null, origin_resulting_stock: null, destination_previous_stock: null, destination_resulting_stock: null }; }),
        history: [{ status: st.id, at: d.at, user_id: d.user_id, note: 'Creó el traspaso' }],
    };
    lineTotals(doc);
    DB.transfers.push(doc);
    return doc;
}
function receiveTransfer(doc, received, userId, at) {
    const st = tStatusBy('RECEIVED');
    let short = 0;
    doc.lines.forEach(l => {
        const it = itemOf(l.item_id);
        const qr = round(received?.[l.id] ?? l.quantity);
        l.quantity_received = qr;
        if (qr < l.quantity) short += l.quantity - qr;
        [l.origin_previous_stock, l.origin_resulting_stock] = bump(doc.origin_warehouse_id, it.id, -l.quantity, at);
        const taken = takeLots(doc.origin_warehouse_id, it, l.quantity);
        [l.destination_previous_stock, l.destination_resulting_stock] = bump(doc.destination_warehouse_id, it.id, qr, at);
        // Los lotes viajan con su caducidad; si llegó menos, se recorta del último
        let rest = qr;
        taken.forEach(t => { const src = DB.lots.find(x => x.id === t.lot); const q = Math.min(t.qty, rest); rest = round(rest - q); if (q > 0) addLot(doc.destination_warehouse_id, it, q, { batch: src.batch_code, expires: src.expires_at, produced: src.produced_at, cost: src.cost, at }); });
        if (it.track_lots && rest > 0) addLot(doc.destination_warehouse_id, it, rest, { at, cost: it.cost });
        const when = at;
        move({ src: `tra:${doc.id}`, uid: `TR-OUT-${l.id}`, type: 'TRANSFERENCIA', folio: doc.folio, concept: `Traspaso a ${branchName(doc.destination_branch_id)}`, qty: -l.quantity, prev: l.origin_previous_stock, post: l.origin_resulting_stock, cost: l.cost, total: -l.subtotal, at: when, item_id: it.id, warehouse_id: doc.origin_warehouse_id, branch_id: doc.origin_branch_id, user_id: userId, doc: { kind: 'tra', id: doc.id } });
        move({ src: `tra:${doc.id}`, uid: `TR-IN-${l.id}`, type: 'TRANSFERENCIA', folio: doc.folio, concept: `Traspaso de ${branchName(doc.origin_branch_id)}`, qty: qr, prev: l.destination_previous_stock, post: l.destination_resulting_stock, cost: l.cost, total: round(qr * l.cost, 2), at: when, item_id: it.id, warehouse_id: doc.destination_warehouse_id, branch_id: doc.destination_branch_id, user_id: userId, doc: { kind: 'tra', id: doc.id } });
    });
    Object.assign(doc, { transfer_status_id: st.id, received_at: at, received_user_id: userId });
    doc.history.push({ status: st.id, at, user_id: userId, note: short > 0 ? `Confirmó la recepción · ${short === 1 ? 'faltó 1 unidad' : `faltaron ${num(short)} unidades`} en el camino` : 'Confirmó la recepción completa' });
}
function closeTransfer(doc, code, reason, userId, at) {
    const st = tStatusBy(code);
    Object.assign(doc, { transfer_status_id: st.id, reject_reason: reason || null });
    doc.history.push({ status: st.id, at, user_id: userId, note: reason || st.name });
}

// -- Conteo físico (inventory_adjustment): Borrador -> Aplicado | Cancelado --
function createCount(d) {
    const area = d.warehouse_area_id ? areaOf(d.warehouse_area_id) : null;
    const items = DB.items.filter(it => it.active && it.is_inventoriable && (stockRow(d.warehouse_id, it.id) || (!it.kind || it.kind === 'supply') && d.allItems))
        .filter(it => !area || areaIn(d.warehouse_id, it)?.id === area.id)
        // Ordenada como se camina el almacén: por área y luego por nombre
        .sort((a, b) => (areaIn(d.warehouse_id, a)?.name || 'zz').localeCompare(areaIn(d.warehouse_id, b)?.name || 'zz') || a.name.localeCompare(b.name));
    const doc = {
        id: nextId('adjustment'), folio: nextFolio('AJU', d.branch_id), note: d.note || '', adjustment_type: 'fisico', is_blind: d.is_blind ? 1 : 0,
        operation_date: d.operation_date, applied_at: null, cancelled_at: null, cancel_reason: null, created_at: d.at, status: 'draft',
        user_id: d.user_id, applied_user_id: null, branch_id: d.branch_id, warehouse_id: d.warehouse_id, warehouse_area_id: area?.id || null,
        adjustment_reason_id: DB.adjReasons.find(r => r.code === 'CONTEO_FISICO').id,
        lines: items.map(it => ({ id: nextId('dadjustment'), item_id: it.id, system_quantity: qtyIn(d.warehouse_id, it.id), physical_quantity: null, difference: 0, cost: it.cost, cost_difference: 0, previous_stock: null, resulting_stock: null, counted_at: null })),
    };
    countTotals(doc);
    DB.adjustments.push(doc);
    return doc;
}
function setCounted(doc, line, value, at) {
    if (value === '' || value === null || isNaN(Number(value))) { line.physical_quantity = null; line.difference = 0; line.cost_difference = 0; line.counted_at = null; }
    else { line.physical_quantity = round(Number(value)); line.difference = round(line.physical_quantity - line.system_quantity); line.cost_difference = round(line.difference * line.cost, 2); line.counted_at = at; }
    countTotals(doc);
}
function countTotals(doc) {
    doc.total_products = doc.lines.length;
    doc.total_counted = doc.lines.filter(l => l.physical_quantity !== null).length;
    doc.total_differences = doc.lines.filter(l => l.physical_quantity !== null && l.difference !== 0).length;
    doc.total_diff_units = round(doc.lines.reduce((s, l) => s + (l.physical_quantity !== null ? l.difference : 0), 0));
    doc.total_diff_cost = round(doc.lines.reduce((s, l) => s + (l.physical_quantity !== null ? l.cost_difference : 0), 0), 2);
}
function applyCount(doc, userId, at) {
    const reason = adjReasonOf(doc.adjustment_reason_id);
    doc.lines.filter(l => l.physical_quantity !== null).forEach(l => {
        const it = itemOf(l.item_id);
        // La diferencia se calcula contra lo que hay AL APLICAR (pudo moverse mientras se contaba)
        const now = qtyIn(doc.warehouse_id, it.id);
        l.system_quantity = now;
        l.difference = round(l.physical_quantity - now);
        l.cost_difference = round(l.difference * l.cost, 2);
        if (l.difference === 0) { stockRow(doc.warehouse_id, it.id, true).last_count_at = at; return; }
        [l.previous_stock, l.resulting_stock] = bump(doc.warehouse_id, it.id, l.difference, at);
        stockRow(doc.warehouse_id, it.id).last_count_at = at;
        if (l.difference < 0) l.lots = takeLots(doc.warehouse_id, it, -l.difference);
        else if (it.track_lots) addLot(doc.warehouse_id, it, l.difference, { at, cost: it.cost, batch: 'AJUSTE' });
        move({ src: `adj:${doc.id}`, uid: `ADJ-${l.id}`, type: 'AJUSTE', folio: doc.folio, concept: reason.name, qty: l.difference, prev: l.previous_stock, post: l.resulting_stock, cost: l.cost, total: l.cost_difference, at, item_id: it.id, warehouse_id: doc.warehouse_id, branch_id: doc.branch_id, user_id: userId, doc: { kind: 'adj', id: doc.id } });
    });
    countTotals(doc);
    Object.assign(doc, { status: 'applied', applied_at: at, applied_user_id: userId });
}
// Cancelar = revertir un ajuste YA aplicado, hasta 48 h después
const COUNT_CANCEL_HOURS = 48;
const canCancelCount = doc => doc.status === 'applied' && (Date.now() - new Date(doc.applied_at.replace(' ', 'T')).getTime()) <= COUNT_CANCEL_HOURS * 36e5;
function cancelCount(doc, reason, userId, at) {
    if (doc.status === 'applied') {
        doc.lines.filter(l => l.previous_stock !== null).forEach(l => { bump(doc.warehouse_id, l.item_id, -(l.resulting_stock - l.previous_stock), at); giveBackLots(l.lots); });
        dropMoves(`adj:${doc.id}`);
    }
    Object.assign(doc, { status: 'cancelled', cancelled_at: at, cancel_reason: reason, cancelled_user_id: userId });
}

// -- Requisiciones (requisition): la sucursal pide a la Matriz; aprobar = surtir --
function createRequisition(d) {
    const st = rStatusBy(d.draft ? 'BORRADOR' : 'EN_ESPERA');
    const doc = {
        id: nextId('requisition'), folio: nextFolio('REQ', d.branch_id), note: d.note || '', approval_note: '', reject_reason: null,
        needed_date: d.needed_date || null, sent_at: d.draft ? null : d.at, approved_at: null, confirmed_at: null, created_at: d.at,
        requisition_status_id: st.id, user_id: d.user_id, approved_user_id: null, confirmed_user_id: null,
        branch_id: d.branch_id, source_branch_id: d.source_branch_id || mainBranch().id, warehouse_id: null, department_id: d.department_id || null,
        lines: d.lines.map(l => ({ id: nextId('drequisition'), item_id: l.item_id, quantity: round(l.quantity), quantity_supplied: 0, note: l.note || '', delivered_item_id: null, unit_id: itemOf(l.item_id).unit_id })),
        supplies: [],
    };
    reqTotals(doc);
    DB.requisitions.push(doc);
    return doc;
}
function reqTotals(doc) {
    doc.total_products = doc.lines.length;
    doc.total_units = round(doc.lines.reduce((s, l) => s + l.quantity, 0));
    doc.total_cost = round(doc.lines.reduce((s, l) => s + l.quantity * itemOf(l.item_id).cost, 0), 2);
}
// Surtir: salida S- en quien surte + entrada ENT- (Surtido de la Matriz) en quien pidió, que espera su «Recibí»
function supplyRequisition(doc, o) {
    const wh = whOf(o.warehouse_id);
    const moves = o.moves !== false && (wh.branch_id === doc.branch_id || wh.supply_moves_stock || o.force);
    const rows = doc.lines.map(l => ({ l, q: round(Number(o.qty[l.id]) || 0), item: Number(o.sub?.[l.id]) || l.item_id })).filter(r => r.q > 0);
    if (!rows.length) return null;
    const sup = { id: nextId('supply'), at: o.at, user_id: o.user_id, note: o.note || '', moves_stock: moves ? 1 : 0, warehouse_id: wh.id, outflow_id: null, inflow_id: null, total_products: rows.length, total_units: round(rows.reduce((s, r) => s + r.q, 0)), total_cost: round(rows.reduce((s, r) => s + r.q * itemOf(r.item).cost, 0), 2) };
    if (moves) {
        const out = createOutflow({ branch_id: wh.branch_id, warehouse_id: wh.id, outflow_reason_id: reasonBy('SURTIDO_SUC').id, operation_date: o.at.slice(0, 10), at: o.at, user_id: o.user_id, note: `Surtido de ${doc.folio} a ${branchName(doc.branch_id)}`, requisition_id: doc.id, lines: rows.map(r => ({ item_id: r.item, quantity: r.q })) });
        sup.outflow_id = out.id;
        if (wh.branch_id !== doc.branch_id) {
            const dest = defaultWh(doc.branch_id);
            const inn = createInflow({ branch_id: doc.branch_id, warehouse_id: dest.id, inflow_origin_id: originBy('SURTIDO_SUC').id, operation_date: o.at.slice(0, 10), at: o.at, user_id: o.user_id, note: `Surtido de ${doc.folio} desde ${branchName(wh.branch_id)}`, requisition_id: doc.id, lines: rows.map(r => ({ item_id: r.item, quantity: r.q, cost: itemOf(r.item).cost })) });
            sup.inflow_id = inn.id;
        }
    }
    rows.forEach(r => { r.l.quantity_supplied = round(r.l.quantity_supplied + r.q); if (r.item !== r.l.item_id) r.l.delivered_item_id = r.item; });
    doc.supplies.push(sup);
    const complete = doc.lines.every(l => l.quantity_supplied >= l.quantity);
    Object.assign(doc, { requisition_status_id: rStatusBy(complete ? 'ENTREGADO' : 'SURTIDO_PARCIAL').id, approved_at: o.at, approved_user_id: o.user_id, warehouse_id: wh.id, approval_note: o.note || doc.approval_note });
    return sup;
}
function confirmRequisition(doc, userId, at) {
    Object.assign(doc, { requisition_status_id: rStatusBy('CONFIRMADO').id, confirmed_at: at, confirmed_user_id: userId });
    doc.supplies.forEach(s => { const inn = s.inflow_id && byId(DB.inflows, s.inflow_id); if (inn && !inn.confirmed_at) Object.assign(inn, { confirmed_at: at, confirmed_user_id: userId }); });
}
const reqCode = doc => rStatusOf(doc.requisition_status_id).code;
const trCode = doc => tStatusOf(doc.transfer_status_id).code;

// =====================================================================
// ARRANQUE: aplica SEED_DOCS en orden de fecha con el mismo motor
// =====================================================================
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function seedLines(spec, wh) {
    if (typeof spec !== 'string') return spec;
    const factor = Number(spec.split(':')[1]);
    const rnd = rng(1000 + wh);
    const branchCats = [2, 6, 7, 8, 10];
    // Faltas a propósito en la Matriz para que se vean bajos y agotados
    const fixed = wh === 1 ? { 'Nuez picada 500 g': 1, 'Licor de Baileys': 1, 'Diamantina dorada': 0, 'Cerezas 3.5 kg': 0, 'Fresas congeladas 2 kg': 3, 'Ganache oscuro': 3, 'Extracto de vainilla': 1, 'Fécula de maíz 500 g': 3 } : {};
    return DB.items.filter(it => it.kind === 'supply' && (factor >= 1 || branchCats.includes(it.item_category_id)))
        .map(it => {
            let q = it.name in fixed ? fixed[it.name] : it.stock_max * factor * (0.55 + rnd() * 0.5);
            q = allowsDecimals(it) ? round(q, 1) : Math.round(q);
            return [it.name, q, it.cost];
        }).filter(l => l[1] > 0);
}
function seedRun() {
    const docs = SEED_DOCS.map((s, i) => ({ ...s, i })).sort((a, b) => a.d - b.d || a.h.localeCompare(b.h) || a.i - b.i);
    docs.forEach(s => {
        const date = dayISO(s.d), at = `${date} ${s.h}`;
        const line = l => {
            const it = itemByName(l[0]); if (!it) throw new Error(`Artículo de prueba no existe: ${l[0]}`);
            const r = { item_id: it.id, quantity: l[1], cost: l[2] ?? it.cost };
            if (typeof l[3] === 'string' && /^p\d+:/.test(l[3])) { const [p, n] = l[3].slice(1).split(':').map(Number); r.item_presentation_id = p; r.presentation_quantity = n; }
            else if (l[3]) r.batch_code = l[3];
            if (l[4] !== undefined) r.expires_at = dayISO(s.d + l[4]);
            if (l[2] && typeof l[2] === 'string') { r.note = l[2]; r.cost = it.cost; }
            return r;
        };
        if (s.t === 'in') {
            const lines = seedLines(s.lines, s.wh).map(line);
            if (s.origin === 'INICIAL') lines.forEach(l => { const it = itemOf(l.item_id); if (it.track_lots && it.shelf_life_days) l.expires_at = dayISO(Math.ceil(it.shelf_life_days / 2)); if (it.name === 'Leche entera' && s.wh === 3) l.expires_at = dayISO(-1); l.batch_code = 'INICIAL'; });
            createInflow({ branch_id: s.branch, warehouse_id: s.wh, inflow_origin_id: originBy(s.origin).id, supplier_id: s.supplier, invoice_folio: s.invoice, voucher_url: s.voucher ? 'uploads/entradas/factura.jpg' : null, note: s.note, operation_date: date, at, user_id: s.user, lines });
        } else if (s.t === 'prod') {
            const doc = createInflow({ branch_id: s.branch, warehouse_id: s.wh, inflow_origin_id: originBy('PRODUCCION').id, note: 'Producción del día', operation_date: date, at, user_id: s.user, inflow_format_id: 1, lines: s.lines.map(l => ({ ...line(l), cost: itemByName(l[0]).cost, batch_code: prodBatch(date) })) });
            if (s.confirm) confirmInflow(doc, s.user, `${date} ${s.confirm}`);
        } else if (s.t === 'out') {
            createOutflow({ branch_id: s.branch, warehouse_id: s.wh, outflow_reason_id: reasonBy(s.reason).id, department_id: s.dept, note: s.note, evidence_url: s.evidence ? 'uploads/mermas/foto.jpg' : null, operation_date: date, at, user_id: s.user, lines: s.lines.map(line) });
        } else if (s.t === 'sale') {
            createOutflow({ folio: s.folio, branch_id: s.branch, warehouse_id: s.wh, outflow_reason_id: reasonBy('SALIDA_POR_VENTA').id, sale_id: Number(s.folio.slice(1)), note: s.folio.startsWith('P') ? 'Pedido entregado en el POS' : 'Venta de mostrador', operation_date: date, at, user_id: s.user, lines: s.lines.map(line) });
        } else if (s.t === 'tra') {
            const doc = createTransfer({ origin_branch_id: s.branch, origin_warehouse_id: s.wh, destination_warehouse_id: s.to, note: s.note, at, user_id: s.user, lines: s.lines.map(line) });
            if (s.recv) { const rec = {}; doc.lines.forEach(l => { const n = itemOf(l.item_id).name; if (s.recv.short?.[n] !== undefined) rec[l.id] = s.recv.short[n]; }); receiveTransfer(doc, rec, s.recv.user, `${date} ${s.recv.h}`); }
            if (s.reject) closeTransfer(doc, 'REJECTED', s.reject.reason, s.reject.user, `${date} ${s.reject.h}`);
        } else if (s.t === 'req') {
            const doc = createRequisition({ branch_id: s.branch, user_id: s.user, department_id: s.dept, needed_date: dayISO(s.need), note: s.note, draft: s.draft, at, lines: s.lines.map(l => ({ item_id: itemByName(l[0]).id, quantity: l[1], note: l[2] || '' })) });
            (s.supply || []).forEach(sp => {
                const q = {}, sub = {};
                doc.lines.forEach(l => { const n = itemOf(l.item_id).name; if (sp.qty[n]) q[l.id] = sp.qty[n]; if (sp.sub?.[n]) { q[l.id] = sp.sub[n][1]; sub[l.id] = itemByName(sp.sub[n][0]).id; } });
                supplyRequisition(doc, { warehouse_id: mainWh().id, qty: q, sub, note: sp.note, user_id: sp.user, at: `${dayISO(sp.d)} ${sp.h}` });
            });
            if (s.recibi) confirmRequisition(doc, s.recibi.user, `${dayISO(s.recibi.d)} ${s.recibi.h}`);
        } else if (s.t === 'count') {
            const area = s.area ? DB.areas.find(a => a.warehouse_id === s.wh && a.name === s.area) : null;
            const doc = createCount({ branch_id: s.branch, warehouse_id: s.wh, warehouse_area_id: area?.id, is_blind: s.blind, operation_date: date, at, user_id: s.user });
            if (s.diff) doc.lines.forEach(l => setCounted(doc, l, l.system_quantity + (s.diff[itemOf(l.item_id).name] || 0), at));
            if (s.partial) { const rnd = rng(77); doc.lines.forEach(l => { if (rnd() < s.partial) setCounted(doc, l, Math.max(0, l.system_quantity + (rnd() < 0.2 ? (rnd() < 0.5 ? -1 : 1) : 0)), at); }); }
            if (s.apply) applyCount(doc, s.user, `${date} ${s.apply}`);
        }
    });
    SEED_FORMATS.forEach((f, i) => DB.formats.push({ id: i + 1, name: f.name, scope: f.scope, branch_id: f.branch, inflow_origin_id: originBy(f.origin).id, user_id: f.user, active: 1, lines: f.lines.map(l => ({ item_id: itemByName(l[0]).id, quantity: l[1] })) }));
    DB.seq.format = SEED_FORMATS.length;
}

// =====================================================================
// SHELL DE PRO
// =====================================================================
const UI = { view: 'inicio', branch: 2, role: 'dueno', f: {}, drawer: null };
const LS_VIEW = 'huubie:pro:inv:view';
const LS_BRANCH = 'huubie:pro:inv:branch';
const LS_ROLE = 'huubie:pro:inv:role';

// -- Permisos del rol (= permissions_roles de pro) --
const ROLE = () => ROLES[UI.role];
const can = (sec, type = 'show') => !!ROLE().perms[sec]?.includes(type);
const canCost = sec => can(sec, 'ver-costos');
const VIEW_SEC = { stock: 'inv-stock', entradas: 'inv-entradas', salidas: 'inv-salidas', traspasos: 'inv-traspasos', requisiciones: 'inv-requisiciones', surtir: 'inv-surtir', movimientos: 'inv-kardex', reportes: 'inv-reportes', catalogo: 'inv-catalogo' };
const KIND_SEC = { in: 'inv-entradas', out: 'inv-salidas', tra: 'inv-traspasos', req: 'inv-requisiciones', adj: 'inv-stock', item: 'inv-stock' };
const canView = v => !VIEW_SEC[v] || can(VIEW_SEC[v]);
const myBranches = () => ROLE().branches;
const allBranches = () => myBranches().length === DB.branches.length;
// En Entradas: 'producir' = producción del día; 'create' = compras, devoluciones y notas
const canProduce = () => can('inv-entradas', 'producir');
const canBuy = () => can('inv-entradas', 'create');
const roleOrigins = () => DB.origins.filter(o => o.active && !o.is_system && (o.code === 'PRODUCCION' ? canProduce() : canBuy()));
// Motivos de salida: si el rol trae lista, solo esos (Producción: consumo, error y merma)
const roleReasons = () => DB.reasons.filter(r => r.active && !r.is_system && (!ROLE().reasons || ROLE().reasons.includes(r.code)));
const LS_SIDEBAR = 'huubie:pro:sidebar-hidden';
const LS_DARK = 'huubie:pro:dark';
const isDesktop = () => window.innerWidth >= 1024;
const isMatriz = () => !!branchOf(UI.branch)?.main;
const myWh = () => defaultWh(UI.branch);
const VIEWS = {};

function setView(name, opts = {}) {
    if (!VIEWS[name] || !canView(name)) name = 'inicio';
    UI.view = name;
    document.querySelectorAll('.iv-view').forEach(v => { const on = v.id === `view-${name}`; v.classList.toggle('hidden', !on); v.classList.toggle('flex', on); });
    document.querySelectorAll('.menu-rail-item[data-view]').forEach(b => {
        const on = b.dataset.view === name;
        b.classList.toggle('is-active', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    try { localStorage.setItem(LS_VIEW, name); } catch (e) { /* sin almacenamiento */ }
    if (!isDesktop()) closeSidebar();
    closeDropdowns();
    closeDrawer();
    VIEWS[name].mount(opts);
    icons();
}
// Después de cualquier movimiento: repinta la vista, el visor abierto y los avisos del rail
function refresh() {
    const v = VIEWS[UI.view];
    if (v.paint) v.paint(); else v.mount({});
    refreshDrawer();
    renderBadges();
    icons();
}

// -- Menú lateral: mismas claves que pro/auth/src/js/sidebar.js --
function syncMenuButton() {
    const b = $id('btn-menu'); if (!b) return;
    const shown = isDesktop() ? !document.body.classList.contains('sidebar-hidden') : $id('menu-sidebar').classList.contains('sidebar-open');
    b.setAttribute('aria-expanded', shown ? 'true' : 'false');
}
function toggleSidebar() {
    if (isDesktop()) {
        const hidden = document.body.classList.toggle('sidebar-hidden');
        try { localStorage.setItem(LS_SIDEBAR, hidden ? 'true' : 'false'); } catch (e) { /* sin almacenamiento */ }
    } else {
        const open = $id('menu-sidebar').classList.toggle('sidebar-open');
        $id('sidebar-overlay').classList.toggle('hidden', !open);
    }
    syncMenuButton();
}
function closeSidebar() { $id('menu-sidebar')?.classList.remove('sidebar-open'); $id('sidebar-overlay')?.classList.add('hidden'); syncMenuButton(); }
window.addEventListener('resize', () => { if (isDesktop()) closeSidebar(); });

// -- Modo oscuro: mismas claves que pro --
const isDark = () => document.body.classList.contains('dark-mode');
function setDark(dark) {
    const P = window.InventoryPalette;
    let p = null;
    try { p = JSON.parse(localStorage.getItem('huubie:pro:palette') || 'null'); } catch (e) { /* sin almacenamiento */ }
    p = Object.assign({ accent: '#C05A40', primary: '#292524' }, p || {});
    p.scheme = dark ? 'huubie' : 'light';
    if (P && typeof P.apply === 'function') { try { P.apply(p); if (typeof P.save === 'function') P.save(p); } catch (e) { /* tema sin paleta */ } }
    document.body.classList.toggle('dark-mode', dark);
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem(LS_DARK, dark ? 'true' : 'false'); } catch (e) { /* sin almacenamiento */ }
    syncDarkButton();
}
function syncDarkButton() { const b = $id('btnDark'); if (!b) return; b.innerHTML = `<i data-lucide="${isDark() ? 'sun' : 'moon'}" class="w-[18px] h-[18px]"></i>`; b.title = isDark() ? 'Modo claro' : 'Modo oscuro'; icons(); }
function toggleDark() { setDark(!isDark()); }

// -- Sucursal de la sesión (navbar): solo las del usuario (users_braches) --
function renderBranchPill() {
    const b = branchOf(UI.branch), mine = DB.branches.filter(x => myBranches().includes(x.id));
    $id('lblBranch').textContent = b.short;
    $id('lblBranchRole').textContent = b.main ? 'Matriz' : 'Sucursal';
    $id('btnBranch').classList.toggle('pointer-events-none', mine.length < 2);
    $id('icoBranchMore').classList.toggle('hidden', mine.length < 2);
    $id('ddBranch').innerHTML = mine.map(x => `<button type="button" class="iv-dd-item ${x.id === UI.branch ? 'active' : ''}" onclick="switchBranch(${x.id})"><i data-lucide="${x.main ? 'building-2' : 'store'}"></i><span>${esc(x.name)}</span>${x.main ? '<small>Matriz</small>' : ''}</button>`).join('');
}
// -- Rol de prueba («Ver como»): cambia usuario, sucursal, menú y lo que se puede hacer --
function renderRole() {
    const r = ROLE();
    DB.user = { id: r.user, name: DB.users[r.user], role: r.name, initials: r.initials };   // quien firma lo que se captura
    $id('lblUser').textContent = DB.users[r.user];
    $id('lblRole').textContent = r.name;
    $id('lblAvatar').textContent = r.initials;
    $id('lblAvatar').style.background = r.hex;
    $id('lblRoleAs').textContent = r.name;
    $id('icoRoleAs').innerHTML = `<i data-lucide="${r.icon}"></i>`;
    $id('icoRoleAs').style.cssText = tone(r.hex);
    $id('ddRole').innerHTML = `<div class="px-2.5 pt-1.5 pb-2 iv-meta">Ver la plantilla como… (en el módulo real lo decide el rol del usuario)</div>` + Object.entries(ROLES).map(([k, x]) => `<button type="button" class="iv-dd-item ${k === UI.role ? 'active' : ''}" style="white-space:normal;align-items:flex-start" onclick="switchRole('${k}')"><span class="iv-m-ico sm iv-tone" style="${tone(x.hex)}"><i data-lucide="${x.icon}"></i></span><span class="min-w-0"><b class="block text-[13px]">${esc(x.name)} · ${esc(DB.users[x.user])}</b><span class="block iv-meta">${esc(x.desc)}</span></span></button>`).join('');
    document.querySelectorAll('.menu-rail-item[data-view]').forEach(b => b.classList.toggle('hidden', !canView(b.dataset.view)));
}
function switchRole(code) {
    UI.role = code;
    try { localStorage.setItem(LS_ROLE, code); } catch (e) { /* sin almacenamiento */ }
    if (!myBranches().includes(UI.branch)) UI.branch = ROLE().branch;
    UI.f = {};
    closeDrawer();
    renderRole();
    renderBranchPill();
    renderBadges();
    setView(canView(UI.view) ? UI.view : 'inicio');
    toast(`Viendo como ${ROLE().name}`, 'info');
}
function switchBranch(id) {
    if (!myBranches().includes(Number(id))) return;
    UI.branch = Number(id);
    try { localStorage.setItem(LS_BRANCH, String(id)); } catch (e) { /* sin almacenamiento */ }
    UI.f = {};
    closeDrawer();
    renderBranchPill();
    renderBadges();
    setView(UI.view);
    toast(`Trabajando en ${branchOf(id).name}`, 'info');
}
function toggleDropdown(id, e) {
    e?.stopPropagation();
    const dd = $id(id), open = !dd.classList.contains('open');
    closeDropdowns();
    dd.classList.toggle('open', open);
    if (open) icons();
}
function closeDropdowns() { document.querySelectorAll('.iv-dd.open').forEach(d => d.classList.remove('open')); }
document.addEventListener('click', e => { if (!e.target.closest?.('.iv-dd') || e.target.closest('.iv-dd-item')) closeDropdowns(); });

// -- Avisos en el rail --
function renderBadges() {
    const set = (id, n) => { const el = $id(id); if (!el) return; el.textContent = n > 9 ? '9+' : n; el.classList.toggle('hidden', !n); };
    // Solo avisa de lo que el rol puede atender
    set('badgeTraspasos', can('inv-traspasos', 'update') ? DB.transfers.filter(t => trCode(t) === 'REQUESTED' && t.destination_branch_id === UI.branch).length : 0);
    set('badgeReq', can('inv-requisiciones', 'update') ? DB.requisitions.filter(r => r.branch_id === UI.branch && reqCode(r) === 'ENTREGADO').length : 0);
    set('badgeSurtir', can('inv-surtir', 'update') && isMatriz() ? DB.requisitions.filter(r => r.source_branch_id === UI.branch && ['EN_ESPERA', 'SURTIDO_PARCIAL'].includes(reqCode(r))).length : 0);
    set('badgeEntradas', can('inv-entradas', 'update') && canProduce() ?DB.inflows.filter(i => i.status === 'pending' && i.branch_id === UI.branch).length : 0);
}

// =====================================================================
// PIEZAS DE INTERFAZ
// =====================================================================
const badge = (label, hex, icon, extra = '') => `<span class="iv-chip iv-tone ${extra}" style="${tone(hex)}">${icon ? `<i data-lucide="${icon}"></i>` : ''}${esc(label)}</span>`;
const kindChip = it => it.kind === 'product' ? '<span class="iv-chip sq t-brand">Producto</span>' : '<span class="iv-chip sq t-gray">Insumo</span>';
const levelBadge = lv => badge(LEVEL[lv].label, LEVEL[lv].hex, LEVEL[lv].icon);
const statusBadge = s => ({
    pending: badge('Pendiente', '#D97706', 'clock-3'), applied: badge('Aplicada', '#059669', 'circle-check'),
    cancelled: badge('Cancelada', '#6B7280', 'ban'), draft: badge('Borrador', '#6B7280', 'pencil-line'),
}[s] || esc(s));
const countStatusBadge = s => ({ draft: badge('Borrador', '#D97706', 'pencil-line'), applied: badge('Aplicado', '#059669', 'circle-check'), cancelled: badge('Cancelado', '#6B7280', 'ban') }[s]);
const reqBadge = doc => { const s = rStatusOf(doc.requisition_status_id); return badge(s.name, s.color_hex, s.icon); };
// Traspaso: el nombre cambia según quién lo mira (name_out / name_in)
const trBadge = doc => { const s = tStatusOf(doc.transfer_status_id); const name = doc.destination_branch_id === UI.branch ? s.name_in : doc.origin_branch_id === UI.branch ? s.name_out : s.name; return badge(name, s.color_hex, s.icon); };
const qtyCell = (q, it) => `<b class="tabular-nums">${num(q)}</b> <span class="iv-meta inline">${esc(unitCode(it))}</span>`;
const itemCell = (it, extra = '') => `<div class="flex items-center gap-2.5 min-w-0"><span class="iv-m-ico sm iv-tone" style="${tone(catOf(it)?.color_hex)}"><i data-lucide="${it.kind === 'product' ? (catOf(it)?.icon || 'cake') : (catOf(it)?.icon || 'package')}"></i></span><div class="min-w-0"><div class="iv-name truncate">${esc(it.name)}</div><div class="iv-meta">${esc(it.sku)}${extra}</div></div></div>`;
const userCell = (id, at) => `<div class="iv-name text-[12.5px]">${esc(userName(id))}</div><div class="iv-meta">${fstamp(at)}</div>`;
const signed = (n, money_ = false) => { const v = Number(n) || 0; const t = money_ ? money(Math.abs(v)) : num(Math.abs(v)); return v > 0 ? `<span class="iv-plus">+${t}</span>` : v < 0 ? `<span class="iv-minus">−${t}</span>` : `<span class="iv-meta inline">${money_ ? money(0) : '0'}</span>`; };
const chain = (a, b) => `<span class="tabular-nums whitespace-nowrap">${num(a)} <span class="iv-meta inline">→</span> <b>${num(b)}</b></span>`;

// hide: la tarjeta es de dinero y el rol no tiene «ver-costos»
function kpi({ icon, hex, label, value, sub = '', key = '', active = false, hide = false }) {
    if (hide) return '';
    const tag = key ? 'button' : 'div';
    return `<${tag} ${key ? `type="button" data-kpi="${key}"` : ''} class="iv-kpi ${active ? 'active' : ''}"><span class="iv-kpi-ico iv-tone" style="${tone(hex)}"><i data-lucide="${icon}"></i></span><div class="min-w-0"><div class="iv-kpi-val">${value}</div><div class="iv-kpi-lbl">${esc(label)}${sub ? ` · ${sub}` : ''}</div></div></${tag}>`;
}
// Columnas con money: true se quitan si cost === false; el pie entonces queda solo con footLabel
function table({ cols, rows, empty = 'Sin registros con estos filtros', rowAttr, foot, footLabel, cls = '', cost = true }) {
    if (!cost) { cols = cols.filter(c => !c.money); foot = footLabel ? `<td colspan="${cols.length}">${footLabel}</td>` : ''; }
    const body = rows.length
        ? rows.map(r => `<tr ${rowAttr ? rowAttr(r) : ''}>${cols.map(c => `<td class="${c.cls || ''}">${c.cell(r)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${cols.length}"><div class="iv-empty"><i data-lucide="inbox" class="w-7 h-7"></i><b>${empty}</b><span>Prueba con otro filtro o sucursal.</span></div></td></tr>`;
    return `<table class="iv-table ${cls}"><thead><tr>${cols.map(c => `<th class="${c.cls || ''}">${c.label}</th>`).join('')}</tr></thead><tbody>${body}</tbody>${foot && rows.length ? `<tfoot><tr>${foot}</tr></tfoot>` : ''}</table>`;
}
// Filtros
const opt = (v, t) => ({ v, t });
const fSelect = (id, label, opts, val, w = 'w-full sm:w-44') => `<div class="${w}"><label class="iv-lbl" for="${id}">${label}</label><select id="${id}" class="iv-inp" data-f="${id}">${opts.map(o => `<option value="${o.v}" ${String(o.v) === String(val) ? 'selected' : ''}>${esc(o.t)}</option>`).join('')}</select></div>`;
const fSearch = (id, ph, val = '') => `<div class="flex-1 min-w-[200px]"><label class="iv-lbl" for="${id}">Buscar</label><div class="iv-inp-wrap"><i data-lucide="search"></i><input id="${id}" class="iv-inp" placeholder="${esc(ph)}" value="${esc(val)}" data-f="${id}" autocomplete="off"></div></div>`;
const fDate = (id, label, val) => `<div class="w-[150px]"><label class="iv-lbl" for="${id}">${label}</label><input id="${id}" type="date" class="iv-inp" value="${val || ''}" data-f="${id}"></div>`;
const branchOpts = (all = true) => [...(all && allBranches() ? [opt('all', 'Todas las sucursales')] : []), ...DB.branches.filter(b => myBranches().includes(b.id)).map(b => opt(b.id, b.short))];
// Botón solo si el rol tiene la casilla
const btnIf = (ok, html) => ok ? html : '';
const inBranch = (bid, f) => f === 'all' || Number(f) === Number(bid);
const inRange = (iso, from, to) => (!from || iso >= from) && (!to || iso <= to);
// Lee los filtros de una vista y repinta al cambiar (sin volver a pintar el campo de búsqueda)
function bindFilters(view, onChange) {
    const sec = $id(`view-${view}`);
    const read = () => { const f = UI.f[view] = UI.f[view] || {}; sec.querySelectorAll('[data-f]').forEach(el => { f[el.dataset.f] = el.value; }); onChange(); icons(); };
    sec.querySelectorAll('[data-f]').forEach(el => el.addEventListener(el.tagName === 'INPUT' && el.type !== 'date' ? 'input' : 'change', read));
}
function frame({ title, sub, actions = '', kpis = '', tabs = '', filters = '', body = '', id }) {
    return `<div class="iv-head shrink-0"><div class="min-w-0"><h1 class="iv-title">${title}</h1><p class="iv-sub">${sub}</p></div><div class="flex flex-wrap gap-2">${actions}</div></div>
        ${kpis ? `<div id="${id}Kpis" class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 shrink-0">${kpis}</div>` : ''}
        <div class="iv-card flex-1 min-h-[320px] flex flex-col">${tabs}${filters ? `<div class="p-3 border-b flex flex-wrap items-end gap-2.5 shrink-0">${filters}</div>` : ''}<div id="${id}Body" class="iv-table-wrap">${body}</div></div>`;
}

// -- Modales (se crean al vuelo; Esc cierra el de arriba) --
function modal({ id, icon, hex, title, sub = '', width = 560, body = '', foot = '', closeX = true }) {
    $id(id)?.remove();
    const el = document.createElement('div');
    el.id = id; el.className = 'iv-modal open';
    const top = Math.max(60, ...[...document.querySelectorAll('.iv-modal')].map(m => Number(m.style.zIndex) || 60));
    el.style.zIndex = top + 1;
    el.innerHTML = `<div class="iv-dialog" style="max-width:${width}px" role="dialog" aria-modal="true" aria-labelledby="${id}T">
        <div class="iv-dialog-head">${icon ? `<span class="iv-m-ico iv-tone" style="${tone(hex)}"><i data-lucide="${icon}"></i></span>` : ''}<div class="flex-1 min-w-0"><div id="${id}T" class="iv-dialog-title">${title}</div>${sub ? `<div class="iv-dialog-sub">${sub}</div>` : ''}</div>${closeX ? `<button type="button" class="iv-icon-btn bare" onclick="closeModal('${id}')" title="Cerrar (Esc)"><i data-lucide="x"></i></button>` : ''}</div>
        <div class="iv-dialog-body" id="${id}Body">${body}</div>${foot ? `<div class="iv-dialog-foot" id="${id}Foot">${foot}</div>` : ''}</div>`;
    document.body.appendChild(el);
    icons();
    return el;
}
function closeModal(id) { $id(id)?.remove(); }
const topModal = () => [...document.querySelectorAll('.iv-modal.open')].sort((a, b) => (Number(b.style.zIndex) || 0) - (Number(a.style.zIndex) || 0))[0];

// -- Visor lateral (detalle de un documento o artículo) --
const DRAWERS = {};   // kind -> (id) => { icon, hex, title, sub, body, foot }
function openDrawer(kind, id) {
    // Sin la sección no se abre el documento (la requisición también la abre quien surte)
    const ok = kind === 'req' ? can('inv-requisiciones') || can('inv-surtir') : can(KIND_SEC[kind]);
    if (!ok) { toast('Tu rol no tiene acceso a ese documento', 'info'); return; }
    UI.drawer = { kind, id };
    paintDrawer();
    $id('drawer').classList.add('open');
    $id('drawerVeil').classList.add('open');
    markActiveRow();
}
function paintDrawer() {
    const d = UI.drawer; if (!d) return;
    const r = DRAWERS[d.kind](d.id);
    if (!r) { closeDrawer(); return; }
    $id('drawerHead').innerHTML = `<span class="iv-m-ico iv-tone" style="${tone(r.hex)}"><i data-lucide="${r.icon}"></i></span><div class="flex-1 min-w-0"><div class="iv-dialog-title truncate">${r.title}</div><div class="iv-dialog-sub">${r.sub || ''}</div></div><button type="button" class="iv-icon-btn bare" onclick="closeDrawer()" title="Cerrar (Esc)"><i data-lucide="x"></i></button>`;
    $id('drawerBody').innerHTML = r.body;
    $id('drawerFoot').innerHTML = r.foot || '';
    $id('drawerFoot').classList.toggle('hidden', !r.foot);
    icons();
}
const refreshDrawer = () => { if (UI.drawer && $id('drawer').classList.contains('open')) { paintDrawer(); markActiveRow(); } };
function closeDrawer() { UI.drawer = null; $id('drawer')?.classList.remove('open'); $id('drawerVeil')?.classList.remove('open'); markActiveRow(); }
function markActiveRow() {
    document.querySelectorAll('tr[data-open]').forEach(tr => tr.classList.toggle('active', !!UI.drawer && tr.dataset.open === `${UI.drawer.kind}:${UI.drawer.id}`));
}
// Una fila con data-open="kind:id" abre su visor
document.addEventListener('click', e => {
    const tr = e.target.closest?.('tr[data-open]');
    if (!tr || e.target.closest('button, a, input, select')) return;
    const [kind, id] = tr.dataset.open.split(':');
    openDrawer(kind, Number(id));
});
const infoGrid = pairs => `<dl class="iv-info">${pairs.filter(Boolean).map(([k, v]) => `<div><dt>${k}</dt><dd title="${esc(String(v).replace(/<[^>]+>/g, ''))}">${v || '—'}</dd></div>`).join('')}</dl>`;
const section = (title, html, right = '') => `<div class="mt-4"><div class="flex items-center justify-between mb-2"><span class="iv-sec">${title}</span>${right}</div>${html}</div>`;

// -- Avisos y confirmaciones (SweetAlert con el tema de pro) --
const swalBase = o => Swal.fire(Object.assign({ customClass: { popup: 'huubie-swal' }, confirmButtonColor: '#C05A40', cancelButtonText: 'Cancelar', reverseButtons: true, focusCancel: false }, o));
const toast = (title, icon = 'success') => Swal.fire({ toast: true, position: 'top-end', timer: 2400, showConfirmButton: false, icon, title, customClass: { popup: 'huubie-swal' } });
const confirmBox = (title, html, confirmButtonText = 'Sí, continuar', danger = false) => swalBase({ icon: danger ? 'warning' : 'question', title, html, showCancelButton: true, confirmButtonText, confirmButtonColor: danger ? '#e11d48' : '#C05A40' }).then(r => r.isConfirmed);
// Cancelar documentos pide la contraseña del login (aquí, simulada: 1234) y un motivo
function askCancel(what) {
    return swalBase({
        icon: 'warning', title: `¿Cancelar ${what}?`, showCancelButton: true, confirmButtonText: 'Sí, cancelar', confirmButtonColor: '#e11d48', cancelButtonText: 'No',
        html: `<p class="text-[13px] mb-3">Se regresa el inventario y queda registrado quién lo canceló.</p>
            <input id="swCancelReason" class="swal2-input" placeholder="Motivo (obligatorio)" style="margin:6px 0;width:100%">
            <input id="swCancelPass" type="password" class="swal2-input" placeholder="Tu contraseña" style="margin:6px 0;width:100%">
            <p class="text-[11px] text-gray-500 mt-1">Contraseña de prueba: 1234</p>`,
        preConfirm: () => {
            const reason = $id('swCancelReason').value.trim(), pass = $id('swCancelPass').value;
            if (!reason) { Swal.showValidationMessage('Escribe el motivo'); return false; }
            if (pass !== '1234') { Swal.showValidationMessage('Contraseña incorrecta'); return false; }
            return reason;
        },
    }).then(r => r.isConfirmed ? r.value : null);
}

// -- Teclado: Esc cierra por capas (Swal → modal → visor → menú) --
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (window.Swal && Swal.isVisible()) return;
    if (document.querySelector('.iv-pick:not(.hidden)')) return;
    const m = topModal();
    if (m) { if (m.dataset.esc !== 'off') m.remove(); return; }
    if (UI.drawer) { closeDrawer(); return; }
    closeDropdowns();
});
function logoutDemo() { swalBase({ icon: 'info', title: 'Plantilla sin sesión', text: 'En el módulo real aquí se cierra la sesión de pro.' }); }

// -- Arranque --
function boot() {
    seedRun();
    try { const r = localStorage.getItem(LS_ROLE); if (ROLES[r]) UI.role = r; } catch (e) { /* sin almacenamiento */ }
    // ?rol=almacenista en la URL gana (lo usan las capturas de la propuesta de roles)
    const qr = new URLSearchParams(location.search).get('rol'); if (ROLES[qr]) UI.role = qr;
    try { const b = Number(localStorage.getItem(LS_BRANCH)); if (branchOf(b)) UI.branch = b; } catch (e) { /* sin almacenamiento */ }
    if (!myBranches().includes(UI.branch)) UI.branch = ROLE().branch;
    try { if (localStorage.getItem(LS_SIDEBAR) === 'true') document.body.classList.add('sidebar-hidden'); } catch (e) { /* sin almacenamiento */ }
    try { const d = localStorage.getItem(LS_DARK) === 'true'; document.body.classList.toggle('dark-mode', d); document.documentElement.classList.toggle('dark', d); } catch (e) { /* sin almacenamiento */ }
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('sidebar-animated')));
    renderRole();
    syncDarkButton();
    syncMenuButton();
    renderBranchPill();
    renderBadges();
    let v = 'inicio';
    try { v = localStorage.getItem(LS_VIEW) || 'inicio'; } catch (e) { /* sin almacenamiento */ }
    // ?vista=stock en la URL gana: la manda el menú de pro (sections.route)
    const qv = new URLSearchParams(location.search).get('vista'); if (qv) v = qv;
    setView(v);
}
