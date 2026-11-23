// Inventarios (Huubie PRO) · documentos: Entradas, Salidas (incluye mermas), Traspasos, Requisiciones y Surtir.
// Una sola captura (openDocForm) para entrada, producción, salida, traspaso y requisición; ventanas de
// surtir, recibir traspaso y conteo físico; visores de cada documento.

// =====================================================================
// LISTAS
// =====================================================================
const docRange = (f, p) => ({ from: f[`${p}From`], to: f[`${p}To`] });
const reasonCls = { consumo: r => !r.is_loss && !r.is_system, mermas: r => !!r.is_loss, ventas: r => r.code === 'SALIDA_POR_VENTA', surtidos: r => r.code === 'SURTIDO_SUC' };

VIEWS.entradas = {
    mount() {
        const f = UI.f.entradas = Object.assign({ enBranch: String(UI.branch), enOrigin: 'all', enStatus: 'all', enFrom: dayISO(-30), enTo: dayISO(0), enQ: '' }, UI.f.entradas || {});
        $id('view-entradas').innerHTML = frame({
            id: 'en', title: 'Entradas', sub: 'Compras, producción, devoluciones y surtidos que suman al almacén · folio <b>ENT-</b>',
            actions: btnIf(canProduce(), `<button type="button" class="iv-btn ${canBuy() ? 'iv-btn-ghost' : 'iv-btn-brand'}" onclick="openProduction()"><i data-lucide="chef-hat"></i>Producción del día</button>`) + btnIf(canBuy(), `<button type="button" class="iv-btn iv-btn-brand" onclick="openDocForm('in')"><i data-lucide="package-plus"></i>Nueva entrada</button>`),
            kpis: ' ',
            filters: fSelect('enBranch', 'Sucursal', branchOpts(), f.enBranch) + fSelect('enOrigin', 'Tipo de entrada', [opt('all', 'Todos'), ...DB.origins.filter(o => o.active && (canBuy() || o.code === 'PRODUCCION')).map(o => opt(o.id, o.name))], f.enOrigin) + fSelect('enStatus', 'Estado', [opt('all', 'Todos'), opt('pending', 'Pendiente'), opt('applied', 'Aplicada'), opt('cancelled', 'Cancelada')], f.enStatus, 'w-full sm:w-36') + fDate('enFrom', 'Desde', f.enFrom) + fDate('enTo', 'Hasta', f.enTo) + fSearch('enQ', 'Folio, proveedor, factura o artículo', f.enQ),
        });
        bindFilters('entradas', () => this.paint());
        this.paint();
    },
    paint() {
        const f = UI.f.entradas, q = norm(f.enQ);
        // Producción solo ve sus producciones; los demás, todos los tipos
        const rows = DB.inflows.filter(d => (canBuy() || originOf(d.inflow_origin_id).code === 'PRODUCCION') &&inBranch(d.branch_id, f.enBranch) && (f.enOrigin === 'all' || d.inflow_origin_id === Number(f.enOrigin)) && (f.enStatus === 'all' || d.status === f.enStatus) && inRange(d.operation_date, f.enFrom, f.enTo)
            && (!q || norm(`${d.folio} ${supplierOf(d.supplier_id)?.name} ${d.invoice_folio} ${d.lines.map(l => itemOf(l.item_id).name).join(' ')}`).includes(q))).sort((a, b) => b.created_at.localeCompare(a.created_at));
        const live = rows.filter(d => d.status !== 'cancelled');
        $id('enKpis').innerHTML = [
            kpi({ icon: 'package-plus', hex: '#059669', label: 'Entradas', value: num(live.length, 0) }),
            kpi({ icon: 'layers', hex: '#0369A1', label: 'Unidades', value: num(live.reduce((s, d) => s + d.total_units, 0)) }),
            kpi({ icon: 'wallet', hex: '#C05A40', label: 'Costo total', value: money(live.filter(d => d.status === 'applied').reduce((s, d) => s + d.total_cost, 0)), hide: !canCost('inv-entradas') }),
            kpi({ icon: 'chef-hat', hex: '#D97706', label: 'Producción por confirmar', value: num(rows.filter(d => d.status === 'pending').length, 0) }),
            kpi({ icon: 'package-check', hex: '#7C3AED', label: 'Surtidos sin «Recibí»', value: num(rows.filter(d => originOf(d.inflow_origin_id).code === 'SURTIDO_SUC' && d.status === 'applied' && !d.confirmed_at).length, 0) }),
        ].join('');
        $id('enBody').innerHTML = table({
            rows, rowAttr: d => `class="click ${d.status === 'cancelled' ? 'off' : ''}" data-open="in:${d.id}"`,
            cols: [
                { label: 'Folio', cell: d => `<span class="iv-folio">${d.folio}</span>` },
                { label: 'Fecha', cell: d => `<div class="text-[12.5px] whitespace-nowrap">${relDay(d.operation_date)}</div><div class="iv-meta">${ftime(d.created_at)}</div>` },
                { label: 'Tipo de entrada', cell: d => { const o = originOf(d.inflow_origin_id); return badge(o.name, o.color_hex, o.icon); } },
                { label: 'Origen → Destino', cell: d => `<div class="iv-name text-[12.5px]">${esc(whName(d.warehouse_id))}</div><div class="iv-meta">${esc(branchName(d.branch_id))} · ${esc(areaOf(d.warehouse_area_id)?.name || 'sin área')}</div>` },
                { label: 'Proveedor / referencia', cell: d => `<div class="text-[12.5px]">${esc(supplierOf(d.supplier_id)?.name || (d.requisition_id ? byId(DB.requisitions, d.requisition_id)?.folio : '') || '—')}</div><div class="iv-meta">${esc(d.invoice_folio || '')}${d.voucher_url ? ' · <i data-lucide="paperclip" class="inline w-3 h-3"></i>' : ''}</div>` },
                { label: 'Productos', cls: 'r', cell: d => `<span class="tabular-nums">${d.total_products}</span>` },
                { label: 'Total', cls: 'r', money: 1, cell: d => `<b class="tabular-nums">${money(d.total_cost)}</b>` },
                { label: 'Estado', cell: d => originOf(d.inflow_origin_id).code === 'SURTIDO_SUC' && d.status === 'applied' && !d.confirmed_at ? badge('Falta «Recibí»', '#7C3AED', 'package-check') : statusBadge(d.status) },
                { label: 'Registró', cell: d => userCell(d.user_id, d.created_at) },
            ],
            cost: canCost('inv-entradas'), footLabel: plural(rows.length, 'entrada', 'entradas'),
            foot: `<td colspan="6">${plural(rows.length, 'entrada', 'entradas')}</td><td class="r">${money(live.reduce((s, d) => s + d.total_cost, 0))}</td><td colspan="2"></td>`,
        });
        markActiveRow();
    },
};

VIEWS.salidas = {
    mount() {
        const f = UI.f.salidas = Object.assign({ seg: 'all', saBranch: String(UI.branch), saReason: 'all', saDept: 'all', saFrom: dayISO(-30), saTo: dayISO(0), saQ: '' }, UI.f.salidas || {});
        const segs = [['all', 'Todas'], ['consumo', 'Consumo'], ['mermas', 'Mermas'], ['ventas', 'Ventas POS'], ['surtidos', 'Surtidos']];
        $id('view-salidas').innerHTML = frame({
            id: 'sa', title: 'Salidas', sub: 'Consumo de producción, mermas, ventas del POS y surtidos · folio <b>S-</b> (la venta conserva el folio del POS)',
            actions: btnIf(can('inv-salidas', 'create') && roleReasons().some(r => r.is_loss), `<button type="button" class="iv-btn iv-btn-ghost danger" onclick="openDocForm('out', { loss: true })"><i data-lucide="trash-2"></i>Registrar merma</button>`) + btnIf(can('inv-salidas', 'create') && roleReasons().some(r => !r.is_loss), `<button type="button" class="iv-btn iv-btn-brand" onclick="openDocForm('out')"><i data-lucide="package-minus"></i>Nueva salida</button>`),
            kpis: ' ',
            tabs: `<div class="px-3 pt-3 shrink-0"><div class="iv-seg">${segs.map(([k, t]) => `<button type="button" data-seg="${k}" class="${f.seg === k ? 'active' : ''}">${t}</button>`).join('')}</div></div>`,
            filters: fSelect('saBranch', 'Sucursal', branchOpts(), f.saBranch) + fSelect('saReason', 'Motivo', [opt('all', 'Todos'), ...DB.reasons.filter(r => r.active && (f.seg === 'all' || reasonCls[f.seg](r))).map(r => opt(r.id, r.name))], f.saReason) + fSelect('saDept', 'Departamento', [opt('all', 'Todos'), ...DB.departments.filter(d => d.active).map(d => opt(d.id, d.name))], f.saDept) + fDate('saFrom', 'Desde', f.saFrom) + fDate('saTo', 'Hasta', f.saTo) + fSearch('saQ', 'Folio, nota o artículo', f.saQ),
        });
        $id('view-salidas').querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => { f.seg = b.dataset.seg; f.saReason = 'all'; this.mount(); icons(); }));
        bindFilters('salidas', () => this.paint());
        this.paint();
    },
    paint() {
        const f = UI.f.salidas, q = norm(f.saQ);
        const base = DB.outflows.filter(d => inBranch(d.branch_id, f.saBranch) && inRange(d.operation_date, f.saFrom, f.saTo));
        const rows = base.filter(d => { const r = reasonOf(d.outflow_reason_id); return (f.seg === 'all' || reasonCls[f.seg](r)) && (f.saReason === 'all' || r.id === Number(f.saReason)) && (f.saDept === 'all' || d.department_id === Number(f.saDept)) && (!q || norm(`${d.folio} ${d.note} ${d.lines.map(l => itemOf(l.item_id).name).join(' ')}`).includes(q)); }).sort((a, b) => b.created_at.localeCompare(a.created_at));
        const live = base.filter(d => d.status === 'applied');
        const tot = live.reduce((s, d) => s + d.total_cost, 0);
        const cost = canCost('inv-salidas');
        const by = fn => live.filter(d => fn(reasonOf(d.outflow_reason_id))).reduce((s, d) => s + d.total_cost, 0);
        const n = fn => num(live.filter(d => fn(reasonOf(d.outflow_reason_id))).length, 0);
        const loss = by(r => r.is_loss);
        // Sin «ver-costos»: cuántos documentos de cada tipo, sin pesos
        $id('saKpis').innerHTML = (cost ? [
            kpi({ icon: 'package-minus', hex: '#C05A40', label: 'Salidas', value: num(rows.filter(d => d.status === 'applied').length, 0) }),
            kpi({ icon: 'wallet', hex: '#0369A1', label: 'Costo de todas', value: money(tot) }),
            kpi({ icon: 'chef-hat', hex: '#B45309', label: 'Consumo', value: money(by(reasonCls.consumo)) }),
            kpi({ icon: 'trash-2', hex: '#E11D48', label: 'Mermas', value: money(loss), sub: tot ? `${num(loss / tot * 100, 1)} %` : '' }),
            kpi({ icon: 'shopping-cart', hex: '#059669', label: 'Ventas POS', value: money(by(reasonCls.ventas)) }),
        ] : [
            kpi({ icon: 'package-minus', hex: '#C05A40', label: 'Salidas', value: num(rows.filter(d => d.status === 'applied').length, 0) }),
            kpi({ icon: 'chef-hat', hex: '#B45309', label: 'Consumo', value: n(reasonCls.consumo), sub: 'registros' }),
            kpi({ icon: 'trash-2', hex: '#E11D48', label: 'Mermas', value: n(reasonCls.mermas), sub: 'registros' }),
            kpi({ icon: 'shopping-cart', hex: '#059669', label: 'Ventas POS', value: n(reasonCls.ventas), sub: 'tickets' }),
        ]).join('');
        $id('saBody').innerHTML = table({
            rows, rowAttr: d => `class="click ${d.status === 'cancelled' ? 'off' : ''}" data-open="out:${d.id}"`,
            cols: [
                { label: 'Folio', cell: d => `<span class="iv-folio">${d.folio}</span>` },
                { label: 'Fecha', cell: d => `<div class="text-[12.5px] whitespace-nowrap">${relDay(d.operation_date)}</div><div class="iv-meta">${ftime(d.created_at)}</div>` },
                { label: 'Motivo', cell: d => { const r = reasonOf(d.outflow_reason_id); return badge(r.name, r.color_hex, r.icon); } },
                { label: 'Departamento', cell: d => d.department_id ? `<span class="text-[12.5px]">${esc(deptOf(d.department_id).name)}</span>` : '<span class="iv-meta">—</span>' },
                { label: 'Sale de', cell: d => `<div class="iv-name text-[12.5px]">${esc(whName(d.warehouse_id))}</div><div class="iv-meta">${esc(branchName(d.branch_id))}</div>` },
                { label: 'Productos', cls: 'r', cell: d => `<span class="tabular-nums">${d.total_products}</span>` },
                { label: 'Costo', cls: 'r', money: 1, cell: d => `<span class="iv-minus">−${money(d.total_cost)}</span>` },
                { label: '', cls: 'c', cell: d => d.evidence_url ? '<i data-lucide="camera" class="w-4 h-4 text-gray-500 inline" title="Con foto"></i>' : '' },
                { label: 'Estado', cell: d => statusBadge(d.status) },
                { label: 'Registró', cell: d => userCell(d.user_id, d.created_at) },
            ],
            cost, footLabel: plural(rows.length, 'salida', 'salidas'),
            foot: `<td colspan="6">${plural(rows.length, 'salida', 'salidas')}</td><td class="r"><span class="iv-minus">−${money(rows.filter(d => d.status === 'applied').reduce((s, d) => s + d.total_cost, 0))}</span></td><td colspan="3"></td>`,
        });
        markActiveRow();
    },
};

VIEWS.traspasos = {
    mount() {
        const f = UI.f.traspasos = Object.assign({ seg: 'in', trStatus: 'all', trFrom: dayISO(-30), trTo: dayISO(0), trQ: '' }, UI.f.traspasos || {});
        const segs = [['in', 'Por recibir', 'log-in'], ['out', 'Enviados', 'log-out'], ['all', 'Todos', 'list']];
        $id('view-traspasos').innerHTML = frame({
            id: 'tr', title: 'Traspasos', sub: `Envíos entre almacenes y sucursales · quien envía lo crea y quien recibe lo confirma (ahí se mueve el stock) · <b>${esc(branchOf(UI.branch).short)}</b>`,
            actions: btnIf(can('inv-traspasos', 'create'), `<button type="button" class="iv-btn iv-btn-brand" onclick="openDocForm('tra')"><i data-lucide="arrow-right-left"></i>Nuevo traspaso</button>`),
            kpis: ' ',
            tabs: `<div class="px-3 pt-3 shrink-0"><div class="iv-seg">${segs.map(([k, t, i]) => `<button type="button" data-seg="${k}" class="${f.seg === k ? 'active' : ''}"><i data-lucide="${i}"></i>${t}</button>`).join('')}</div></div>`,
            filters: fSelect('trStatus', 'Estado', [opt('all', 'Todos'), ...DB.transferStatus.map(s => opt(s.id, s.name))], f.trStatus) + fDate('trFrom', 'Desde', f.trFrom) + fDate('trTo', 'Hasta', f.trTo) + fSearch('trQ', 'Folio o artículo', f.trQ),
        });
        $id('view-traspasos').querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => { f.seg = b.dataset.seg; this.mount(); icons(); }));
        bindFilters('traspasos', () => this.paint());
        this.paint();
    },
    paint() {
        const f = UI.f.traspasos, q = norm(f.trQ), me = UI.branch;
        const mine = DB.transfers.filter(t => t.origin_branch_id === me || t.destination_branch_id === me);
        const rows = mine.filter(t => (f.seg === 'all' || (f.seg === 'in' ? t.destination_branch_id === me : t.origin_branch_id === me)) && (f.trStatus === 'all' || t.transfer_status_id === Number(f.trStatus)) && inRange(t.created_at.slice(0, 10), f.trFrom, f.trTo) && (!q || norm(`${t.folio} ${t.lines.map(l => itemOf(l.item_id).name).join(' ')}`).includes(q))).sort((a, b) => b.created_at.localeCompare(a.created_at));
        const month = mine.filter(t => t.created_at.slice(0, 10) >= monthStart());
        $id('trKpis').innerHTML = [
            kpi({ icon: 'log-in', hex: '#D97706', label: 'Por recibir', value: num(mine.filter(t => trCode(t) === 'REQUESTED' && t.destination_branch_id === me).length, 0) }),
            kpi({ icon: 'send', hex: '#0369A1', label: 'Enviados sin confirmar', value: num(mine.filter(t => trCode(t) === 'REQUESTED' && t.origin_branch_id === me).length, 0) }),
            kpi({ icon: 'circle-check', hex: '#059669', label: 'Recibidos este mes', value: num(month.filter(t => trCode(t) === 'RECEIVED').length, 0) }),
            kpi({ icon: 'circle-x', hex: '#E11D48', label: 'Rechazados', value: num(month.filter(t => trCode(t) === 'REJECTED').length, 0) }),
            kpi({ icon: 'wallet', hex: '#C05A40', label: 'Valor enviado este mes', value: money(month.filter(t => t.origin_branch_id === me && trCode(t) === 'RECEIVED').reduce((s, t) => s + t.total_cost, 0)), hide: !canCost('inv-traspasos') }),
        ].join('');
        $id('trBody').innerHTML = table({
            rows, empty: f.seg === 'in' ? 'Nada por recibir' : 'Sin traspasos', rowAttr: t => `class="click ${['REJECTED', 'CANCELLED'].includes(trCode(t)) ? 'off' : ''}" data-open="tra:${t.id}"`,
            cols: [
                { label: 'Folio', cell: t => `<span class="iv-folio">${t.folio}</span>` },
                { label: 'Fecha', cell: t => `<div class="text-[12.5px] whitespace-nowrap">${relDay(t.created_at.slice(0, 10))}</div><div class="iv-meta">${ftime(t.created_at)}</div>` },
                { label: 'Ruta', cell: t => `<div class="flex items-center gap-1.5 text-[12.5px]"><b>${esc(branchName(t.origin_branch_id))}</b><i data-lucide="arrow-right" class="w-3.5 h-3.5 text-gray-400"></i><b>${esc(branchName(t.destination_branch_id))}</b></div><div class="iv-meta">${esc(whName(t.origin_warehouse_id))} → ${esc(whName(t.destination_warehouse_id))}</div>` },
                { label: 'Productos', cls: 'r', cell: t => `<span class="tabular-nums">${t.total_products}</span>` },
                { label: 'Unidades', cls: 'r', cell: t => `<span class="tabular-nums">${num(t.total_units)}</span>` },
                { label: 'Costo', cls: 'r', money: 1, cell: t => `<b class="tabular-nums">${money(t.total_cost)}</b>` },
                { label: 'Estado', cell: t => trBadge(t) },
                { label: 'Solicitó', cell: t => userCell(t.requested_user_id, t.requested_at) },
                { label: '', cls: 'r', cell: t => trCode(t) === 'REQUESTED' && t.destination_branch_id === me && can('inv-traspasos', 'update') ? `<button type="button" class="iv-btn iv-btn-ok sm" onclick="openReceive(${t.id})"><i data-lucide="package-check"></i>Recibir</button>` : '' },
            ],
            cost: canCost('inv-traspasos'),
        });
        markActiveRow();
    },
};

VIEWS.requisiciones = {
    mount() {
        const f = UI.f.requisiciones = Object.assign({ rqStatus: 'all', rqFrom: dayISO(-30), rqTo: dayISO(0), rqQ: '' }, UI.f.requisiciones || {});
        $id('view-requisiciones').innerHTML = frame({
            id: 'rq', title: 'Requisiciones', sub: isMatriz() ? `Lo que la cocina y los departamentos de <b>${esc(branchOf(UI.branch).short)}</b> le piden a su almacén` : `Lo que <b>${esc(branchOf(UI.branch).short)}</b> le pide a la Matriz · se surte y entra a tu almacén; tú confirmas con «Recibí»`,
            actions: btnIf(can('inv-requisiciones', 'create'), `<button type="button" class="iv-btn iv-btn-brand" onclick="openDocForm('req')"><i data-lucide="clipboard-plus"></i>Nueva requisición</button>`),
            kpis: ' ',
            filters: fSelect('rqStatus', 'Estado', [opt('all', 'Todos'), ...DB.reqStatus.map(s => opt(s.id, s.name))], f.rqStatus) + fDate('rqFrom', 'Desde', f.rqFrom) + fDate('rqTo', 'Hasta', f.rqTo) + fSearch('rqQ', 'Folio, nota o producto', f.rqQ),
        });
        bindFilters('requisiciones', () => this.paint());
        this.paint();
    },
    paint() {
        const f = UI.f.requisiciones, q = norm(f.rqQ);
        const mine = DB.requisitions.filter(r => r.branch_id === UI.branch);
        const rows = mine.filter(r => (f.rqStatus === 'all' || r.requisition_status_id === Number(f.rqStatus)) && inRange(r.created_at.slice(0, 10), f.rqFrom, f.rqTo) && (!q || norm(`${r.folio} ${r.note} ${r.lines.map(l => itemOf(l.item_id).name).join(' ')}`).includes(q))).sort((a, b) => b.created_at.localeCompare(a.created_at));
        const n = code => mine.filter(r => reqCode(r) === code).length;
        $id('rqKpis').innerHTML = [
            kpi({ icon: 'clock-3', hex: '#B45309', label: 'En espera', value: num(n('EN_ESPERA'), 0) }),
            kpi({ icon: 'circle-dashed', hex: '#0369A1', label: 'Surtido parcialmente', value: num(n('SURTIDO_PARCIAL'), 0) }),
            kpi({ icon: 'truck', hex: '#C05A40', label: 'Entregado · falta tu «Recibí»', value: num(n('ENTREGADO'), 0) }),
            kpi({ icon: 'circle-check', hex: '#059669', label: 'Confirmado', value: num(n('CONFIRMADO'), 0) }),
            kpi({ icon: 'pencil-line', hex: '#6B7280', label: 'Borradores', value: num(n('BORRADOR'), 0) }),
        ].join('');
        $id('rqBody').innerHTML = table({
            rows, empty: 'Sin requisiciones', rowAttr: r => `class="click ${['RECHAZADA', 'CANCELADA'].includes(reqCode(r)) ? 'off' : ''}" data-open="req:${r.id}"`,
            cols: reqCols('mine'), cost: canCost('inv-requisiciones'),
        });
        markActiveRow();
    },
};
function reqCols(side) {
    const pend = r => r.lines.filter(l => l.quantity_supplied < l.quantity);
    return [
        { label: 'Folio', cell: r => `<span class="iv-folio">${r.folio}</span>` },
        { label: 'Fecha de pedido', cell: r => `<div class="text-[12.5px] whitespace-nowrap">${relDay(r.created_at.slice(0, 10))}</div><div class="iv-meta">${ftime(r.created_at)}</div>` },
        { label: 'Lo necesita', cell: r => { const n = r.needed_date ? daysFromToday(r.needed_date) : null; return `<span class="text-[12.5px] font-semibold ${n !== null && n <= 0 && !['CONFIRMADO', 'ENTREGADO', 'CANCELADA', 'RECHAZADA'].includes(reqCode(r)) ? 'text-rose-600' : ''}">${relDay(r.needed_date)}</span>`; } },
        side === 'mine'
            ? { label: 'Le pide a', cell: r => `<div class="text-[12.5px] font-semibold">${esc(branchName(r.source_branch_id))}</div><div class="iv-meta">${esc(deptOf(r.department_id)?.name || 'Sin departamento')}</div>` }
            : { label: 'Pide', cell: r => `<div class="text-[12.5px] font-semibold">${esc(branchName(r.branch_id))}</div><div class="iv-meta">${esc(deptOf(r.department_id)?.name || 'Sin departamento')} · ${esc(userName(r.user_id))}</div>` },
        { label: 'Productos', cls: 'r', cell: r => `<span class="tabular-nums">${r.total_products}</span>` },
        { label: 'Surtido', cell: r => { const done = r.lines.filter(l => l.quantity_supplied >= l.quantity).length; return `<div class="flex items-center gap-2 min-w-[110px]"><span class="iv-progress flex-1"><span style="width:${r.lines.length ? done / r.lines.length * 100 : 0}%;--tone:#059669"></span></span><span class="text-[12px] tabular-nums">${done}/${r.lines.length}</span></div>`; } },
        side === 'source' ? { label: '¿Alcanza?', cell: r => { if (!['EN_ESPERA', 'SURTIDO_PARCIAL'].includes(reqCode(r))) return '<span class="iv-meta">—</span>'; const w = mainWh().id; const ok = pend(r).filter(l => qtyIn(w, l.item_id) >= l.quantity - l.quantity_supplied).length; const p = pend(r).length; return ok === p ? badge('Sí', '#059669') : ok === 0 ? badge('No hay', '#E11D48') : badge(`${ok} de ${p}`, '#D97706'); } } : { label: 'Costo est.', cls: 'r', money: 1, cell: r => `<span class="tabular-nums text-[12.5px]">${money(r.total_cost)}</span>` },
        { label: 'Estado', cell: r => reqBadge(r) },
        side === 'source' ? { label: '', cls: 'r', cell: r => ['EN_ESPERA', 'SURTIDO_PARCIAL'].includes(reqCode(r)) && can('inv-surtir', 'update') ?`<button type="button" class="iv-btn iv-btn-brand sm" onclick="openSupply(${r.id})"><i data-lucide="truck"></i>${reqCode(r) === 'SURTIDO_PARCIAL' ? 'Terminar' : 'Surtir'}</button>` : '' } : { label: 'Pidió', cell: r => `<span class="text-[12px]">${esc(userName(r.user_id))}</span>` },
    ];
}
VIEWS.surtir = {
    mount() {
        const f = UI.f.surtir = Object.assign({ suStatus: 'pend', suBranch: 'all', suQ: '' }, UI.f.surtir || {});
        $id('view-surtir').innerHTML = frame({
            id: 'su', title: 'Surtir', sub: `Requisiciones que las sucursales le piden a <b>${esc(branchOf(UI.branch).short)}</b> · surtir descuenta de tu almacén y lo manda al de quien pidió`,
            actions: isMatriz() ? '' : `<button type="button" class="iv-btn iv-btn-ghost" onclick="switchBranch(${mainBranch().id})"><i data-lucide="building-2"></i>Ir a la Matriz</button>`,
            kpis: ' ',
            filters: fSelect('suStatus', 'Estado', [opt('pend', 'Por surtir'), opt('done', 'Entregadas'), opt('all', 'Todas')], f.suStatus, 'w-full sm:w-36') + fSelect('suBranch', 'Sucursal que pide', [opt('all', 'Todas'), ...DB.branches.map(b => opt(b.id, b.main ? `${b.short} (cocina y departamentos)` : b.short))], f.suBranch) + fSearch('suQ', 'Folio o producto', f.suQ),
        });
        bindFilters('surtir', () => this.paint());
        this.paint();
    },
    paint() {
        const f = UI.f.surtir, q = norm(f.suQ);
        const mine = DB.requisitions.filter(r => r.source_branch_id === UI.branch && reqCode(r) !== 'BORRADOR');
        const group = { pend: ['EN_ESPERA', 'SURTIDO_PARCIAL'], done: ['ENTREGADO', 'CONFIRMADO'] };
        const rows = mine.filter(r => (f.suStatus === 'all' || group[f.suStatus].includes(reqCode(r))) && (f.suBranch === 'all' || r.branch_id === Number(f.suBranch)) && (!q || norm(`${r.folio} ${r.lines.map(l => itemOf(l.item_id).name).join(' ')}`).includes(q)))
            .sort((a, b) => (a.needed_date || '').localeCompare(b.needed_date || '') || a.created_at.localeCompare(b.created_at));
        const pend = mine.filter(r => group.pend.includes(reqCode(r)));
        $id('suKpis').innerHTML = [
            kpi({ icon: 'inbox', hex: '#C05A40', label: 'Por surtir', value: num(pend.length, 0) }),
            kpi({ icon: 'alarm-clock', hex: '#E11D48', label: 'Para hoy o atrasadas', value: num(pend.filter(r => r.needed_date && daysFromToday(r.needed_date) <= 0).length, 0) }),
            kpi({ icon: 'circle-dashed', hex: '#0369A1', label: 'Surtidas a medias', value: num(mine.filter(r => reqCode(r) === 'SURTIDO_PARCIAL').length, 0) }),
            kpi({ icon: 'truck', hex: '#D97706', label: 'Esperan su «Recibí»', value: num(mine.filter(r => reqCode(r) === 'ENTREGADO').length, 0) }),
            kpi({ icon: 'circle-check', hex: '#059669', label: 'Confirmadas', value: num(mine.filter(r => reqCode(r) === 'CONFIRMADO').length, 0) }),
        ].join('');
        $id('suBody').innerHTML = isMatriz() || mine.length ? table({ rows, empty: 'Nada por surtir', rowAttr: r => `class="click" data-open="req:${r.id}"`, cols: reqCols('source') })
            : `<div class="iv-empty"><i data-lucide="building-2" class="w-8 h-8"></i><b>Surte la Matriz</b><span>${esc(branchOf(UI.branch).short)} pide sus materiales en Requisiciones. Cambia a ${esc(mainBranch().short)} para surtir.</span></div>`;
        markActiveRow();
    },
};

// =====================================================================
// CAPTURA COMPARTIDA (entrada, producción, salida, traspaso, requisición)
// =====================================================================
const DOC_CFG = {
    in: { title: 'Nueva entrada', icon: 'package-plus', hex: '#059669', width: 1120 },
    prod: { title: 'Producción del día', icon: 'chef-hat', hex: '#C05A40', width: 1040, kinds: ['product'] },
    out: { title: 'Nueva salida', icon: 'package-minus', hex: '#C05A40', width: 1040 },
    tra: { title: 'Nuevo traspaso', icon: 'arrow-right-left', hex: '#0369A1', width: 1040 },
    req: { title: 'Nueva requisición', icon: 'clipboard-list', hex: '#0369A1', width: 980 },
};
let FORM = null;
const DOC_SEC = { in: 'inv-entradas', prod: 'inv-entradas', out: 'inv-salidas', tra: 'inv-traspasos', req: 'inv-requisiciones' };
function openDocForm(type, o = {}) {
    // Producción no captura compras: su «entrada» es la producción del día
    if (type === 'in' && !canBuy() && canProduce()) type = 'prod';
    if (!(type === 'prod' ? canProduce() : can(DOC_SEC[type], 'create'))) { toast('Tu rol no puede capturar esto', 'info'); return; }
    const cfg = DOC_CFG[type];
    let branch = Number(o.branch || (o.wh && whOf(o.wh).branch_id) || UI.branch);
    if (!myBranches().includes(branch)) branch = UI.branch;
    const wh = Number(o.wh && whOf(o.wh).branch_id === branch ? o.wh : defaultWh(branch)?.id);
    FORM = { type, cfg, o, key: 0, lines: [], pickIdx: 0, cost: canCost(DOC_SEC[type]), h: { branch, wh, date: dayISO(0), note: '' } };
    const h = FORM.h;
    const origins = roleOrigins().filter(x => x.code !== 'PRODUCCION');
    if (type === 'in') Object.assign(h, { origin: (origins.find(x => x.code === (o.origin || 'COMPRA')) || origins[0]).id, area: areaIn(wh, { warehouse_area_id: null })?.id || '', supplier: '', invoice: '', voucher: null, format: null });
    if (type === 'prod') Object.assign(h, { origin: originBy('PRODUCCION').id, format: null });
    if (type === 'out') {
        // El motivo pedido, si el rol lo puede usar; si no, el primero que sí (de merma si se pidió merma)
        const ok = roleReasons().filter(x => !o.loss || x.is_loss);
        const r = ok.find(x => x.code === (o.reason || (o.loss ? 'MERMA' : 'CONSUMO'))) || ok[0];
        Object.assign(h, { reason: r.id, dept: '', evidence: null, loss: !!o.loss });
    }
    if (type === 'tra') { const other = DB.warehouses.find(w => w.active && w.id !== wh && w.branch_id !== branch) || DB.warehouses.find(w => w.active && w.id !== wh); Object.assign(h, { dest: other?.id }); }
    if (type === 'req') Object.assign(h, { source: mainBranch().id, dept: '', need: dayISO(1), edit: o.edit || null });
    if (o.edit) {
        const r = byId(DB.requisitions, o.edit);
        Object.assign(h, { branch: r.branch_id, dept: r.department_id || '', need: r.needed_date, note: r.note });
        r.lines.forEach(l => addLine(l.item_id, l.quantity, { note: l.note }, false));
    }
    (o.lines || []).forEach(([id, q]) => addLine(id, q, {}, false));
    if (o.format) loadFormat(o.format, false);
    const title = type === 'out' && o.loss ? 'Registrar merma' : o.edit ? `Editar ${byId(DB.requisitions, o.edit).folio}` : cfg.title;
    modal({ id: 'mdlDoc', icon: type === 'out' && o.loss ? 'trash-2' : cfg.icon, hex: type === 'out' && o.loss ? '#E11D48' : cfg.hex, title, sub: docFormSub(), width: cfg.width, body: '<div id="dfHead"></div><div class="mt-3" id="dfLines"></div>', foot: '<div id="dfFoot" class="flex flex-wrap items-center gap-2 w-full"></div>' });
    $id('mdlDoc').dataset.esc = 'off';
    paintDocHead(); paintDocLines(); paintDocFoot();
    setTimeout(() => $id('dfPick')?.focus(), 60);
}
function docFormSub() {
    return { in: 'Suma al almacén; el costo pasa a último costo del artículo.', prod: 'Lo que salió del horno. Guárdala pendiente y confírmala cuando esté en vitrina: ahí suma.', out: 'Resta del almacén con el último costo (no se edita).', tra: 'Se crea como Solicitado; el stock se mueve cuando el destino confirma.', req: 'Pide material a la Matriz. No lleva costos: los pone quien surte.' }[FORM.type];
}
// -- Encabezado --
function paintDocHead() {
    const F = FORM, h = F.h, t = F.type;
    const sel = (k, label, opts, req = false, w = '') => `<div class="${w}"><label class="iv-lbl">${label}${req ? ' <b>*</b>' : ''}</label><select class="iv-inp" data-h="${k}">${opts.map(o => `<option value="${o.v}" ${String(o.v) === String(h[k]) ? 'selected' : ''}>${esc(o.t)}</option>`).join('')}</select></div>`;
    const inp = (k, label, type_ = 'text', extra = '', w = '') => `<div class="${w}"><label class="iv-lbl">${label}</label><input class="iv-inp" type="${type_}" data-h="${k}" value="${esc(h[k] ?? '')}" ${extra}></div>`;
    const brs = DB.branches.filter(b => myBranches().includes(b.id)).map(b => opt(b.id, b.name));
    const whs = whOfBranch(h.branch).map(w => opt(w.id, w.name));
    let html = '';
    if (t === 'in') {
        const origin = originOf(h.origin);
        html = sel('origin', 'Tipo de entrada', roleOrigins().map(o => opt(o.id, o.name)), true)
            + sel('branch', 'Sucursal', brs, true) + sel('wh', 'Origen · almacén donde entra', whs, true)
            + sel('area', 'Destino · área', [opt('', 'Sin área'), ...DB.areas.filter(a => a.warehouse_id === Number(h.wh) && a.active).map(a => opt(a.id, a.name))])
            + (origin.requires_supplier ? `<div><label class="iv-lbl">Proveedor <b>*</b></label><div class="flex gap-1.5"><select class="iv-inp" data-h="supplier"><option value="">Elige…</option>${DB.suppliers.filter(s => s.active).map(s => `<option value="${s.id}" ${String(s.id) === String(h.supplier) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select><button type="button" class="iv-icon-btn shrink-0" style="width:34px;height:34px" title="Proveedor nuevo" onclick="quickSupplier()"><i data-lucide="plus"></i></button></div></div>` : '')
            + inp('date', 'Fecha', 'date', `max="${dayISO(0)}"`) + inp('invoice', 'Factura o nota del proveedor', 'text', 'placeholder="F-0000"');
        html = `<div class="grid grid-cols-2 md:grid-cols-4 gap-2.5">${html}</div><p class="iv-meta mt-2"><i data-lucide="info" class="inline w-3 h-3"></i> ${esc(origin.description)}</p>`;
    } else if (t === 'prod') {
        const fmts = DB.formats.filter(f => f.active && originOf(f.inflow_origin_id).code === 'PRODUCCION');
        html = `<div class="grid grid-cols-2 md:grid-cols-4 gap-2.5">${sel('branch', 'Sucursal (cocina)', brs, true)}${sel('wh', 'Almacén', whs, true)}${inp('date', 'Fecha de producción', 'date', `max="${dayISO(0)}"`)}
            <div><label class="iv-lbl">Formato del día</label><div class="flex gap-1.5"><select class="iv-inp" id="dfFormatSel">${fmts.map(f => `<option value="${f.id}">${esc(f.name)} · ${f.lines.length}</option>`).join('')}</select><button type="button" class="iv-btn iv-btn-ghost shrink-0" onclick="loadFormat(Number($id('dfFormatSel').value))"><i data-lucide="download"></i>Cargar</button></div></div></div>
            <div class="iv-note mt-2"><i data-lucide="calendar-clock"></i><span>Cada producto lleva el lote <b>${prodBatch(h.date)}</b> y caduca según su vida útil (Catálogo). Así salen las alertas de «Por caducar».</span></div>`;
    } else if (t === 'out') {
        const r = reasonOf(h.reason);
        const reasons = roleReasons().filter(x => !h.loss || x.is_loss);
        html = `<div class="grid grid-cols-2 md:grid-cols-4 gap-2.5">${sel('reason', h.loss ? 'Motivo de la merma' : 'Motivo', reasons.map(x => opt(x.id, x.name + (x.is_loss && !h.loss ? ' · merma' : ''))), true)}
            ${sel('dept', 'Departamento', [opt('', r.requires_department ? 'Elige…' : 'Ninguno'), ...DB.departments.filter(d => d.active).map(d => opt(d.id, d.name))], !!r.requires_department)}
            ${sel('branch', 'Sucursal', brs, true)}${sel('wh', 'Sale de · almacén', whs, true)}</div>
            ${r.is_loss ? `<div class="iv-note mt-2" style="border-color:#FECDD3"><i data-lucide="trash-2" style="color:#e11d48"></i><span><b>${esc(r.name)}</b> cuenta como merma: sale en el reporte de mermas.${r.requires_evidence ? ' Pide foto de evidencia.' : ''}</span></div>` : `<p class="iv-meta mt-2"><i data-lucide="info" class="inline w-3 h-3"></i> ${esc(r.description)}</p>`}`;
    } else if (t === 'tra') {
        html = `<div class="grid grid-cols-2 md:grid-cols-4 gap-2.5">${sel('branch', 'Sucursal que envía', brs, true)}${sel('wh', 'Sale de', whs, true)}
            ${sel('dest', 'Va a', DB.warehouses.filter(w => w.active && w.id !== Number(h.wh)).map(w => opt(w.id, `${w.name} · ${branchName(w.branch_id)}`)), true)}
            <div><label class="iv-lbl">Fecha</label><input class="iv-inp" value="${fdate(h.date)}" readonly></div></div>
            <div class="iv-note mt-2"><i data-lucide="route"></i><span>${esc(branchName(h.branch))} lo envía como <b>Solicitado</b>. Cuando ${esc(branchName(whOf(h.dest)?.branch_id))} confirme la recepción se descuenta aquí y se suma allá, con lo que de verdad llegó.</span></div>`;
    } else if (t === 'req') {
        html = `<div class="grid grid-cols-2 md:grid-cols-4 gap-2.5">${sel('branch', 'Sucursal que pide', brs.filter(b => !branchOf(b.v).main || isMatriz()), true)}
            <div><label class="iv-lbl">Le pide a</label><input class="iv-inp" value="${esc(branchOf(h.source).name)} (Matriz)" readonly></div>
            ${sel('dept', 'Departamento', [opt('', 'Ninguno'), ...DB.departments.filter(d => d.active).map(d => opt(d.id, d.name))])}
            ${inp('need', 'Lo necesita para', 'date', `min="${dayISO(0)}"`)}</div>
            ${Number(h.branch) === h.source ? '<div class="iv-note mt-2"><i data-lucide="info"></i><span>Pedido de insumos al almacén de tu sucursal: no es compra.</span></div>' : ''}`;
    }
    $id('dfHead').innerHTML = html;
    $id('dfHead').querySelectorAll('[data-h]').forEach(el => el.addEventListener('change', () => {
        const k = el.dataset.h; h[k] = el.value;
        if (k === 'branch') { h.wh = defaultWh(h.branch)?.id; if (F.type === 'tra' && Number(h.dest) === Number(h.wh)) h.dest = DB.warehouses.find(w => w.active && w.id !== Number(h.wh))?.id; }
        if (k === 'wh' && F.type === 'tra' && Number(h.dest) === Number(h.wh)) h.dest = DB.warehouses.find(w => w.active && w.id !== Number(h.wh))?.id;
        if (k === 'wh' || k === 'branch') h.area = '';
        paintDocHead(); paintDocLines(); paintDocFoot();
    }));
    icons();
}
// -- Renglones --
function addLine(itemId, qty = '', extra = {}, paint = true) {
    const it = itemOf(itemId); if (!it) return;
    const same = FORM.lines.find(l => l.item_id === it.id && !l.pres);
    if (same) { if (qty !== '' && qty !== null) same.n = round((Number(same.n) || 0) + Number(qty)); if (paint) { paintDocLines(); focusLine(same.key); } return; }
    const line = { key: ++FORM.key, item_id: it.id, n: qty === '' ? '' : round(qty), pres: null, cost: it.cost, batch: '', expires: '', note: extra.note || '' };
    FORM.lines.push(line);
    if (paint) { paintDocLines(); focusLine(line.key); }
}
const focusLine = key => setTimeout(() => { const el = document.querySelector(`[data-line="${key}"][data-k="n"]`); el?.focus(); el?.select(); }, 20);
const lineFactor = l => l.pres ? presOf(l.pres).factor : 1;
const lineQty = l => round((Number(l.n) || 0) * lineFactor(l));
const lineCost = l => FORM.type === 'in' ? (Number(l.cost) || 0) / lineFactor(l) : itemOf(l.item_id).cost;
const lineSub = l => round(lineQty(l) * lineCost(l), 2);
function prodLot(l) {
    const it = itemOf(l.item_id), d = FORM.h.date;
    return { batch: prodBatch(d), expires: it.shelf_life_days ? isoOf(new Date(parseISO(d).getTime() + it.shelf_life_days * 864e5)) : '' };
}
function paintDocLines() {
    const F = FORM, t = F.type, h = F.h;
    const wh = Number(h.wh), dest = Number(h.dest);
    // Sin «ver-costos» no hay columnas de dinero: la entrada toma el último costo y lo revisa quien sí lo ve
    const showCost = t !== 'req' && F.cost;
    const cols = [
        ['#', 'w-8'], [t === 'prod' ? 'Producto' : 'Artículo', 'min-w-[220px]'],
        ...(t === 'req' ? [] : [[t === 'tra' ? 'Hay en origen' : t === 'out' ? 'Disponible' : 'Hay', 'r w-24']]),
        ...(t === 'tra' ? [['Hay en destino', 'r w-24']] : []),
        ['Cantidad', 'w-[150px]'], ['Unidad', 'w-16'],
        ...(showCost ? [[t === 'in' ? 'Costo u. sin IVA' : 'Costo u.', 'r w-28']] : []),
        ...(t === 'in' ? [['Lote', 'w-28'], ['Caduca', 'w-36']] : t === 'prod' ? [['Lote', 'w-24'], ['Caduca', 'w-28']] : []),
        ...(t === 'req' ? [['Observación', 'min-w-[200px]']] : []),
        ...(showCost ? [['Subtotal', 'r w-28']] : []), ['', 'w-10'],
    ];
    const rows = F.lines.map((l, i) => {
        const it = itemOf(l.item_id), pres = presOfItem(it.id), have = qtyIn(wh, it.id);
        const qtyCellHtml = `<div class="flex items-center gap-1"><input type="number" min="0" step="${allowsDecimals(it) || l.pres ? 'any' : '1'}" class="iv-inp num no-spin" style="width:72px" data-line="${l.key}" data-k="n" value="${l.n}">${(t === 'in' || t === 'out') && pres.length ? `<select class="iv-inp" style="width:auto;padding-right:22px;font-size:11.5px !important" data-line="${l.key}" data-k="pres"><option value="">${esc(unitCode(it))}</option>${pres.map(p => `<option value="${p.id}" ${l.pres === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>` : ''}</div><div class="iv-meta" id="dfEq${l.key}">${l.pres ? `= ${num(lineQty(l))} ${esc(unitCode(it))}` : ''}</div>`;
        const pl = t === 'prod' ? prodLot(l) : null;
        return `<tr>
            <td class="text-gray-400 text-[12px]">${i + 1}</td>
            <td><div class="iv-name text-[12.5px]">${esc(it.name)}</div><div class="iv-meta">${esc(it.sku)} · ${esc(catOf(it)?.name || '')}${it.track_lots && t === 'in' ? ' · pide caducidad' : ''}</div><div class="iv-warn-cell" id="dfWarn${l.key}">${lineWarn(l)}</div></td>
            ${t === 'req' ? '' : `<td class="r tabular-nums text-[12.5px] ${have <= 0 ? 'text-rose-600' : ''}">${num(have)}</td>`}
            ${t === 'tra' ? `<td class="r tabular-nums text-[12.5px] text-gray-500">${num(qtyIn(dest, it.id))}</td>` : ''}
            <td>${qtyCellHtml}</td>
            <td class="text-[12px] text-gray-500">${esc(unitCode(it))}</td>
            ${showCost ? `<td class="r">${t === 'in' ? `<input type="number" min="0" step="any" class="iv-inp num no-spin" data-line="${l.key}" data-k="cost" value="${l.cost}" title="${l.pres ? 'Costo de la presentación' : 'Costo por unidad'}">` : `<span class="tabular-nums text-[12.5px]">${money(lineCost(l))}</span>`}</td>` : ''}
            ${t === 'in' ? `<td><input class="iv-inp" data-line="${l.key}" data-k="batch" value="${esc(l.batch)}" placeholder="${it.track_lots ? 'L-0000' : '—'}"></td><td><input type="date" class="iv-inp ${it.track_lots && !l.expires && !it.shelf_life_days ? 'bad' : ''}" data-line="${l.key}" data-k="expires" value="${l.expires}" ${it.track_lots ? '' : 'disabled'} title="${it.track_lots && it.shelf_life_days ? `Vacío = hoy + ${it.shelf_life_days} días` : ''}"></td>` : ''}
            ${t === 'prod' ? `<td><span class="iv-folio">${pl.batch}</span></td><td class="text-[12px] tabular-nums">${pl.expires ? fdate(pl.expires) : '—'}</td>` : ''}
            ${t === 'req' ? `<td><input class="iv-inp" data-line="${l.key}" data-k="note" value="${esc(l.note)}" placeholder="Marca, tamaño, «si no hay…»"></td>` : ''}
            ${showCost ? `<td class="r"><b class="tabular-nums text-[12.5px] ${t === 'out' ? 'iv-minus' : ''}" id="dfSub${l.key}">${t === 'out' ? '−' : ''}${money(lineSub(l))}</b></td>` : ''}
            <td class="c"><button type="button" class="iv-icon-btn danger bare" title="Quitar" onclick="dropLine(${l.key})"><i data-lucide="x"></i></button></td></tr>`;
    }).join('');
    const span = cols.length - 1;
    $id('dfLines').innerHTML = `<div class="iv-grid-wrap"><table class="iv-grid"><thead><tr>${cols.map(([c, cls]) => `<th class="${cls}">${c}</th>`).join('')}</tr></thead><tbody>${rows}
        <tr class="draft"><td class="text-gray-400 text-[12px]">${F.lines.length + 1}</td><td colspan="${span}"><div class="relative"><div class="iv-inp-wrap"><i data-lucide="search"></i><input id="dfPick" class="iv-inp" placeholder="Escribe para agregar ${t === 'prod' ? 'un producto' : 'un artículo'} (nombre, SKU o sobrenombre) · ↓ abre la lista" autocomplete="off"></div><div id="dfPickList" class="iv-pick hidden"></div></div></td></tr>
        </tbody></table></div>
        <div class="flex flex-wrap items-center justify-between gap-2 mt-2 text-[12.5px]"><span class="iv-meta">Enter agrega · Tab pasa a la cantidad · Esc cierra la lista</span><span id="dfTot"></span></div>`;
    $id('dfLines').querySelectorAll('[data-line]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
        const l = F.lines.find(x => x.key === Number(el.dataset.line)); const k = el.dataset.k;
        if (k === 'pres') { l.pres = el.value ? Number(el.value) : null; l.cost = l.pres ? presOf(l.pres).cost : itemOf(l.item_id).cost; paintDocLines(); focusLine(l.key); return; }
        l[k] = el.value;
        const sub = $id(`dfSub${l.key}`); if (sub) sub.textContent = `${t === 'out' ? '−' : ''}${money(lineSub(l))}`;
        const eq = $id(`dfEq${l.key}`); if (eq) eq.textContent = l.pres ? `= ${num(lineQty(l))} ${unitCode(itemOf(l.item_id))}` : '';
        const w = $id(`dfWarn${l.key}`); if (w) w.innerHTML = lineWarn(l);
        paintDocTotals();
    }));
    $id('dfLines').querySelectorAll('[data-k="n"]').forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $id('dfPick').focus(); } }));
    bindPicker();
    paintDocTotals();
    icons();
}
function lineWarn(l) {
    const F = FORM, it = itemOf(l.item_id), q = lineQty(l);
    if (l.n !== '' && !allowsDecimals(it) && !l.pres && q % 1 !== 0) return `${esc(unitCode(it))} no lleva decimales`;
    if (F.type === 'out' || F.type === 'tra') { const have = qtyIn(Number(F.h.wh), it.id); if (q > have) return have <= 0 ? 'No hay en este almacén: quedará en negativo' : `Stock insuficiente: hay ${num(have)}`; }
    if (F.type === 'in' && it.stock_max > 0 && qtyIn(Number(F.h.wh), it.id) + q > it.stock_max) return `Supera el máximo (${num(it.stock_max)})`;
    return '';
}
function paintDocTotals() {
    const F = FORM, units = F.lines.reduce((s, l) => s + lineQty(l), 0), tot = F.lines.reduce((s, l) => s + lineSub(l), 0);
    $id('dfTot').innerHTML = `<span class="text-gray-500">${plural(F.lines.length, 'renglón', 'renglones')} · ${num(units)} unidades</span>${F.type !== 'req' && F.cost ? ` · <b class="${F.type === 'out' ? 'iv-minus' : ''}">Total ${F.type === 'out' ? '−' : ''}${money(tot)}</b>` : ''}`;
}
function dropLine(key) { FORM.lines = FORM.lines.filter(l => l.key !== key); paintDocLines(); $id('dfPick')?.focus(); }
// -- Buscador del renglón vacío --
function pickCandidates(q) {
    const F = FORM, w = Number(F.h.wh), qn = norm(q).trim();
    const kinds = F.cfg.kinds;
    return DB.items.filter(it => it.active && (F.type === 'req' || it.is_inventoriable) && (!kinds || kinds.includes(it.kind)))
        .map(it => {
            const name = norm(it.name), hay = norm(`${it.sku} ${it.description}`);
            let s = 0;
            if (!qn) s = 1;
            else if (name.startsWith(qn)) s = 4;
            else if (name.split(/\s+/).some(wd => wd.startsWith(qn))) s = 3;
            else if (name.includes(qn)) s = 2;
            else if (hay.includes(qn)) s = 1;
            else if (qn.split(/\s+/).every(p => name.includes(p))) s = 1.5;
            return { it, s, have: qtyIn(w, it.id) };
        }).filter(x => x.s > 0)
        .sort((a, b) => b.s - a.s || (F.type === 'out' || F.type === 'tra' ? (b.have > 0) - (a.have > 0) : 0) || a.it.name.localeCompare(b.it.name)).slice(0, 40);
}
function bindPicker() {
    const inp = $id('dfPick'), list = $id('dfPickList');
    const paint = () => {
        const c = FORM.pickList = pickCandidates(inp.value);
        FORM.pickIdx = Math.min(FORM.pickIdx, Math.max(0, c.length - 1));
        list.innerHTML = c.length ? c.map((x, i) => `<button type="button" class="iv-pick-item ${i === FORM.pickIdx ? 'active' : ''}" data-pick="${x.it.id}"><span class="iv-m-ico sm iv-tone" style="${tone(catOf(x.it)?.color_hex)}"><i data-lucide="${x.it.kind === 'product' ? 'cake' : (catOf(x.it)?.icon || 'package')}"></i></span><span class="flex-1 min-w-0"><span class="block iv-name text-[12.5px] truncate">${esc(x.it.name)}</span><span class="block iv-meta">${esc(x.it.sku)} · ${esc(catOf(x.it)?.name || '')}${x.it.kind === 'product' ? ' · Producto' : ''}</span></span><span class="text-[11px] tabular-nums ${x.have > 0 ? 'text-gray-500' : 'text-rose-600'}">${num(x.have)} ${esc(unitCode(x.it))}</span></button>`).join('')
            : `<div class="p-3 text-[12.5px] text-gray-500">Sin coincidencias. <button type="button" class="font-semibold" style="color:var(--iv-brand)" onclick="toast('En el módulo real se abre el alta exprés del Catálogo', 'info')">Crear artículo</button></div>`;
        list.classList.remove('hidden');
        icons();
        list.querySelector('.iv-pick-item.active')?.scrollIntoView({ block: 'nearest' });
    };
    const choose = id => { list.classList.add('hidden'); inp.value = ''; FORM.pickIdx = 0; addLine(id, FORM.type === 'req' || FORM.type === 'prod' ? 1 : ''); };
    inp.addEventListener('input', () => { FORM.pickIdx = 0; paint(); });
    inp.addEventListener('focus', () => { if (inp.value) paint(); });
    inp.addEventListener('keydown', e => {
        const open = !list.classList.contains('hidden');
        if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) { paint(); return; } FORM.pickIdx = Math.min(FORM.pickIdx + 1, (FORM.pickList || []).length - 1); paint(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); FORM.pickIdx = Math.max(0, FORM.pickIdx - 1); paint(); }
        else if ((e.key === 'Enter' || (e.key === 'Tab' && inp.value)) && open && FORM.pickList?.length) { e.preventDefault(); choose(FORM.pickList[FORM.pickIdx].it.id); }
        else if (e.key === 'Escape' && open) { e.stopPropagation(); list.classList.add('hidden'); }
    });
    inp.addEventListener('blur', () => setTimeout(() => list.classList.add('hidden'), 160));
    list.addEventListener('mousedown', e => { const b = e.target.closest('[data-pick]'); if (b) { e.preventDefault(); choose(Number(b.dataset.pick)); } });
}
// -- Pie: formatos, nota, comprobante o evidencia, botones --
function paintDocFoot() {
    const F = FORM, t = F.type, h = F.h;
    const r = t === 'out' ? reasonOf(h.reason) : null;
    const fileBtn = (k, label, icon, required) => `<label class="iv-drop ${h[k] ? 'has' : ''}" style="padding:6px 10px"><i data-lucide="${h[k] ? 'check' : icon}" class="w-4 h-4"></i><span>${h[k] ? esc(h[k]) : label}${required && !h[k] ? ' <b style="color:#e11d48">*</b>' : ''}</span><input type="file" accept="image/*,application/pdf" class="hidden" onchange="FORM.h.${k} = this.files[0]?.name || null; paintDocFoot()"></label>`;
    const fmtBtns = t === 'in' ? `<div class="relative"><button type="button" class="iv-btn iv-btn-ghost sm" onclick="toggleDropdown('ddFormats', event)"><i data-lucide="folder-open"></i>Cargar formato</button><div id="ddFormats" class="iv-dd" style="left:0;right:auto;bottom:calc(100% + 6px);top:auto">${DB.formats.filter(f => f.active).map(f => `<button type="button" class="iv-dd-item" onclick="loadFormat(${f.id})"><i data-lucide="file-text"></i><span>${esc(f.name)}</span><small>${f.lines.length}</small></button>`).join('')}</div></div><button type="button" class="iv-btn iv-btn-ghost sm" onclick="saveFormat()" ${F.lines.length ? '' : 'disabled'}><i data-lucide="save"></i>Guardar formato</button>` : '';
    const main = {
        in: `<button type="button" class="iv-btn iv-btn-ok" onclick="submitDoc()"><i data-lucide="package-plus"></i>Registrar entrada</button>`,
        prod: `<button type="button" class="iv-btn iv-btn-ghost" onclick="submitDoc(false)"><i data-lucide="clock-3"></i>Guardar pendiente</button><button type="button" class="iv-btn iv-btn-ok" onclick="submitDoc(true)"><i data-lucide="check"></i>Registrar y confirmar</button>`,
        out: `<button type="button" class="iv-btn ${h.loss || r?.is_loss ? 'iv-btn-danger' : 'iv-btn-brand'}" onclick="submitDoc()"><i data-lucide="${h.loss || r?.is_loss ? 'trash-2' : 'package-minus'}"></i>Registrar ${h.loss || r?.is_loss ? 'merma' : 'salida'}</button>`,
        tra: `<button type="button" class="iv-btn iv-btn-brand" onclick="submitDoc()"><i data-lucide="send"></i>Enviar traspaso</button>`,
        req: `<button type="button" class="iv-btn iv-btn-ghost" onclick="submitDoc(true)"><i data-lucide="save"></i>Guardar borrador</button><button type="button" class="iv-btn iv-btn-brand" onclick="submitDoc(false)"><i data-lucide="send"></i>${h.edit ? 'Guardar y enviar' : 'Enviar requisición'}</button>`,
    }[t];
    $id('dfFoot').innerHTML = `${fmtBtns}
        <div class="iv-inp-wrap flex-1 min-w-[180px]"><i data-lucide="sticky-note"></i><input class="iv-inp" id="dfNote" placeholder="Nota (opcional)" value="${esc(h.note)}" oninput="FORM.h.note = this.value"></div>
        ${t === 'in' ? fileBtn('voucher', 'Comprobante', 'paperclip', false) : ''}${t === 'out' ? fileBtn('evidence', 'Foto de evidencia', 'camera', !!r.requires_evidence) : ''}
        <span class="flex-1 hidden md:block"></span>
        <button type="button" class="iv-btn iv-btn-ghost" onclick="closeDocForm()">Cancelar</button>${main}`;
    icons();
}
function closeDocForm() {
    if (!FORM?.lines.length) { closeModal('mdlDoc'); FORM = null; return; }
    confirmBox('¿Salir sin guardar?', `Se pierden ${plural(FORM.lines.length, 'renglón', 'renglones')} capturados.`, 'Sí, salir', true).then(ok => { if (ok) { closeModal('mdlDoc'); FORM = null; } });
}
function loadFormat(id, paint = true) {
    const f = byId(DB.formats, id); if (!f) return;
    f.lines.forEach(l => addLine(l.item_id, l.quantity, {}, false));
    FORM.h.format = f.id;
    closeDropdowns();
    if (paint) { paintDocLines(); paintDocFoot(); toast(`Formato «${f.name}» cargado: revisa las cantidades`, 'info'); }
}
function saveFormat() {
    const day = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][parseISO(FORM.h.date).getDay()];
    swalBase({ title: 'Guardar como formato', input: 'text', inputValue: `Compra del ${day}`, inputLabel: 'Nombre del formato', showCancelButton: true, confirmButtonText: 'Guardar', inputValidator: v => !v.trim() && 'Escribe un nombre' })
        .then(r => { if (!r.isConfirmed) return; DB.formats.push({ id: nextId('format'), name: r.value.trim(), scope: 'user', branch_id: FORM.h.branch, inflow_origin_id: Number(FORM.h.origin), user_id: DB.user.id, active: 1, lines: FORM.lines.map(l => ({ item_id: l.item_id, quantity: lineQty(l) })) }); toast('Formato guardado'); paintDocFoot(); });
}
function quickSupplier() {
    swalBase({ title: 'Proveedor nuevo', html: '<input id="swSupName" class="swal2-input" placeholder="Nombre" style="width:100%;margin:6px 0"><input id="swSupPhone" class="swal2-input" placeholder="Teléfono (10 dígitos)" maxlength="10" style="width:100%;margin:6px 0">', showCancelButton: true, confirmButtonText: 'Dar de alta',
        preConfirm: () => { const n = $id('swSupName').value.trim(), p = $id('swSupPhone').value.replace(/\D/g, ''); if (!n) { Swal.showValidationMessage('Escribe el nombre'); return false; } if (p && p.length !== 10) { Swal.showValidationMessage('El teléfono lleva 10 dígitos'); return false; } return { n, p }; } })
        .then(r => { if (!r.isConfirmed) return; const s = { id: nextId('supplier') + 100, name: r.value.n, contact_name: '', phone: r.value.p, email: '', rfc: '', branch_id: null, note: '', active: 1 }; DB.suppliers.push(s); FORM.h.supplier = s.id; paintDocHead(); toast('Proveedor dado de alta'); });
}
// -- Guardar --
function submitDoc(flag) {
    const F = FORM, t = F.type, h = F.h;
    const fail = msg => { swalBase({ icon: 'warning', title: 'Falta algo', text: msg }); return false; };
    const lines = F.lines.filter(l => lineQty(l) > 0);
    if (!lines.length) return fail('Agrega al menos un renglón con cantidad.');
    if (F.lines.some(l => lineQty(l) <= 0)) return fail('Hay renglones sin cantidad: escríbela o quítalos.');
    const bad = lines.find(l => !allowsDecimals(itemOf(l.item_id)) && !l.pres && lineQty(l) % 1 !== 0);
    if (bad) return fail(`${itemOf(bad.item_id).name} se cuenta en ${unitCode(itemOf(bad.item_id))}: sin decimales.`);
    if ((t === 'in' || t === 'prod') && h.date > dayISO(0)) return fail('La fecha no puede ser futura.');
    const at = nowStamp();
    if (t === 'in') {
        const origin = originOf(h.origin);
        if (origin.requires_supplier && !h.supplier) return fail(`${origin.name} pide proveedor.`);
        const noExp = lines.find(l => itemOf(l.item_id).track_lots && !l.expires && !itemOf(l.item_id).shelf_life_days);
        if (noExp) return fail(`${itemOf(noExp.item_id).name} pide fecha de caducidad.`);
        confirmBox('¿Registrar la entrada?', `${plural(lines.length, 'producto', 'productos')} a <b>${esc(whName(h.wh))}</b>${F.cost ? ` por <b>${money(lines.reduce((s, l) => s + lineSub(l), 0))}</b>` : ''}.`, 'Sí, registrar').then(ok => {
            if (!ok) return;
            const doc = createInflow({ branch_id: Number(h.branch), warehouse_id: Number(h.wh), warehouse_area_id: Number(h.area) || null, inflow_origin_id: origin.id, supplier_id: Number(h.supplier) || null, invoice_folio: h.invoice, voucher_url: h.voucher, note: h.note, operation_date: h.date, at, user_id: DB.user.id, inflow_format_id: h.format,
                lines: lines.map(l => ({ item_id: l.item_id, quantity: lineQty(l), cost: lineCost(l), item_presentation_id: l.pres, presentation_quantity: l.pres ? Number(l.n) : null, batch_code: l.batch, expires_at: l.expires || null })) });
            docSaved(`Entrada ${doc.folio} registrada`, 'in', doc.id);
        });
    } else if (t === 'prod') {
        confirmBox(flag ? '¿Registrar y confirmar la producción?' : '¿Guardar la producción como pendiente?', flag ? `Suma ${num(lines.reduce((s, l) => s + lineQty(l), 0))} piezas a <b>${esc(whName(h.wh))}</b> ahora mismo.` : 'No suma al stock hasta que la confirmes (Entradas o Inicio › Pendientes).', flag ? 'Sí, confirmar' : 'Sí, guardar').then(ok => {
            if (!ok) return;
            const doc = createInflow({ branch_id: Number(h.branch), warehouse_id: Number(h.wh), inflow_origin_id: Number(h.origin), note: h.note || 'Producción del día', operation_date: h.date, at, user_id: DB.user.id, inflow_format_id: h.format, confirm: false,
                lines: lines.map(l => ({ item_id: l.item_id, quantity: lineQty(l), cost: itemOf(l.item_id).cost, ...(() => { const p = prodLot(l); return { batch_code: p.batch, expires_at: p.expires || null }; })() })) });
            if (flag) confirmInflow(doc, DB.user.id, at);
            docSaved(`Producción ${doc.folio} ${flag ? 'confirmada' : 'guardada como pendiente'}`, 'in', doc.id);
        });
    } else if (t === 'out') {
        const r = reasonOf(h.reason);
        if (r.requires_department && !h.dept) return fail(`${r.name} pide el departamento que lo consume.`);
        if (r.requires_evidence && !h.evidence) return fail(`${r.name} pide foto de evidencia.`);
        const short = lines.filter(l => lineQty(l) > qtyIn(Number(h.wh), l.item_id));
        confirmBox(`¿Registrar la ${r.is_loss ? 'merma' : 'salida'}?`, `${plural(lines.length, 'producto', 'productos')} de <b>${esc(whName(h.wh))}</b>${F.cost ? ` por <b>${money(lines.reduce((s, l) => s + lineSub(l), 0))}</b>` : ''}.${short.length ? `<br><span style="color:#B45309">${plural(short.length, 'renglón queda', 'renglones quedan')} en negativo.</span>` : ''}`, 'Sí, registrar', !!r.is_loss).then(ok => {
            if (!ok) return;
            const doc = createOutflow({ branch_id: Number(h.branch), warehouse_id: Number(h.wh), outflow_reason_id: r.id, department_id: Number(h.dept) || null, evidence_url: h.evidence, note: h.note, operation_date: h.date, at, user_id: DB.user.id, lines: lines.map(l => ({ item_id: l.item_id, quantity: lineQty(l), item_presentation_id: l.pres, presentation_quantity: l.pres ? Number(l.n) : null })) });
            docSaved(`${r.is_loss ? 'Merma' : 'Salida'} ${doc.folio} registrada`, 'out', doc.id);
        });
    } else if (t === 'tra') {
        if (!h.dest || Number(h.dest) === Number(h.wh)) return fail('Elige un almacén destino distinto.');
        confirmBox('¿Enviar el traspaso?', `${plural(lines.length, 'producto', 'productos')} de <b>${esc(whName(h.wh))}</b> a <b>${esc(whName(h.dest))}</b>. Se mueve cuando lo reciban.`, 'Sí, enviar').then(ok => {
            if (!ok) return;
            const doc = createTransfer({ origin_branch_id: Number(h.branch), origin_warehouse_id: Number(h.wh), destination_warehouse_id: Number(h.dest), note: h.note, at, user_id: DB.user.id, lines: lines.map(l => ({ item_id: l.item_id, quantity: lineQty(l) })) });
            docSaved(`Traspaso ${doc.folio} enviado a ${branchName(doc.destination_branch_id)}`, 'tra', doc.id);
        });
    } else if (t === 'req') {
        const draft = !!flag;
        const go = () => {
            let doc;
            if (h.edit) {
                doc = byId(DB.requisitions, h.edit);
                Object.assign(doc, { note: h.note, department_id: Number(h.dept) || null, needed_date: h.need, lines: lines.map(l => ({ id: nextId('drequisition'), item_id: l.item_id, quantity: lineQty(l), quantity_supplied: 0, note: l.note, delivered_item_id: null, unit_id: itemOf(l.item_id).unit_id })) });
                if (!draft) Object.assign(doc, { requisition_status_id: rStatusBy('EN_ESPERA').id, sent_at: at });
                reqTotals(doc);
            } else doc = createRequisition({ branch_id: Number(h.branch), department_id: Number(h.dept) || null, needed_date: h.need, note: h.note, draft, at, user_id: DB.user.id, lines: lines.map(l => ({ item_id: l.item_id, quantity: lineQty(l), note: l.note })) });
            docSaved(draft ? `Borrador ${doc.folio} guardado` : `Requisición ${doc.folio} enviada a ${branchName(doc.source_branch_id)}`, 'req', doc.id);
        };
        if (draft) go(); else confirmBox('¿Enviar la requisición?', `Folio nuevo para <b>${esc(branchName(h.branch))}</b>, solicitado a <b>${esc(branchName(h.source))}</b>, para el ${fdate(h.need)}: ${plural(lines.length, 'material', 'materiales')}.`, 'Sí, enviar').then(ok => ok && go());
    }
}
function docSaved(msg, kind, id) {
    closeModal('mdlDoc'); FORM = null;
    toast(msg);
    refresh();
    openDrawer(kind, id);
}
function openProduction() {
    const sat = new Date().getDay() === 6;
    const f = DB.formats.find(x => x.active && x.name === (sat ? 'Producción sábado' : 'Producción diaria'));
    const b = mainBranch().id;
    openDocForm('prod', { branch: UI.branch === b ? b : UI.branch, format: f?.id });
}

// =====================================================================
// VISORES DE DOCUMENTOS
// =====================================================================
const linesTable = (rows, cols, cost = true) => `<div class="iv-card overflow-hidden">${table({ cls: 'compact', rows, cols, cost })}</div>`;
DRAWERS.in = id => {
    const d = byId(DB.inflows, id); if (!d) return null;
    const o = originOf(d.inflow_origin_id), req = d.requisition_id && byId(DB.requisitions, d.requisition_id);
    const waitingRecibi = o.code === 'SURTIDO_SUC' && d.status === 'applied' && !d.confirmed_at;
    const cost = canCost('inv-entradas');
    const body = `
        <div class="flex flex-wrap items-center gap-2 mb-3">${badge(o.name, o.color_hex, o.icon)}${waitingRecibi ? badge('Falta «Recibí»', '#7C3AED', 'package-check') : statusBadge(d.status)}</div>
        ${infoGrid([['Fecha', `${fdate(d.operation_date)} ${ftime(d.created_at)}`], ['Sucursal', esc(branchOf(d.branch_id).name)], ['Origen · almacén', esc(whName(d.warehouse_id))], ['Destino · área', esc(areaOf(d.warehouse_area_id)?.name || '—')],
            d.supplier_id ? ['Proveedor', esc(supplierOf(d.supplier_id).name)] : null, d.invoice_folio ? ['Factura / nota', esc(d.invoice_folio)] : null, req ? ['Requisición', `<span class="iv-folio">${req.folio}</span>`] : null,
            ['Registró', `${esc(userName(d.user_id))} · ${fstamp(d.created_at)}`], d.confirmed_at ? [o.code === 'PRODUCCION' ? 'Confirmó' : 'Recibí', `${esc(userName(d.confirmed_user_id))} · ${fstamp(d.confirmed_at)}`] : null,
            d.inflow_format_id ? ['Formato', esc(byId(DB.formats, d.inflow_format_id)?.name || '—')] : null, d.voucher_url ? ['Comprobante', `<button type="button" class="font-semibold" style="color:var(--iv-brand)" onclick="toast('Aquí se abre la foto o el PDF', 'info')">Ver archivo</button>`] : null,
            d.cancelled_at ? ['Canceló', `${esc(userName(d.cancelled_user_id))}: ${esc(d.cancel_reason)}`] : null])}
        ${d.note ? `<div class="iv-note mt-3"><i data-lucide="sticky-note"></i><span>${esc(d.note)}</span></div>` : ''}
        ${d.status === 'pending' ? '<div class="iv-note mt-3" style="border-color:#FDE68A"><i data-lucide="clock-3" style="color:#D97706"></i><span>Pendiente: todavía no suma al stock. Confírmala cuando el producto esté listo.</span></div>' : ''}
        ${section('Renglones', linesTable(d.lines, [
            { label: 'Artículo', cell: l => `<div class="text-[12.5px] font-semibold">${esc(itemOf(l.item_id).name)}</div>${l.item_presentation_id ? `<div class="iv-meta" style="color:#0369A1">Entró como ${num(l.presentation_quantity)} × ${esc(presOf(l.item_presentation_id).name)}</div>` : ''}${l.batch_code || l.expires_at ? `<div class="iv-meta">${[l.batch_code ? `Lote ${esc(l.batch_code)}` : '', l.expires_at ? `caduca ${fdate(l.expires_at)}` : ''].filter(Boolean).join(' · ')}</div>` : ''}` },
            { label: 'Cant.', cls: 'r', cell: l => `<span class="tabular-nums">${num(l.quantity)}</span> <span class="iv-meta inline">${esc(unitCode(itemOf(l.item_id)))}</span>` },
            { label: 'Costo', cls: 'r', money: 1, cell: l => `<span class="tabular-nums">${money(l.cost)}</span>` },
            { label: 'Subtotal', cls: 'r', money: 1, cell: l => `<b class="tabular-nums">${money(l.subtotal)}</b>` },
            { label: 'Antes → Quedó', cls: 'r', cell: l => l.previous_stock === null ? '<span class="iv-meta">—</span>' : chain(l.previous_stock, l.resulting_stock) },
        ], cost), cost ? `<b class="text-[13px]">${money(d.total_cost)}</b>` : `<b class="text-[13px]">${num(d.total_units)} u.</b>`)}`;
    const mineBranch = d.branch_id === UI.branch;
    const foot = [
        btnIf(can('inv-entradas', 'print'), `<button type="button" class="iv-btn iv-btn-ghost sm" onclick="toast('En el módulo real se imprime el comprobante', 'info')"><i data-lucide="printer"></i>Imprimir</button>`),
        btnIf(d.status === 'applied' && !o.is_system && can('inv-entradas', 'cancel'), `<button type="button" class="iv-btn iv-btn-ghost danger sm" onclick="cancelDocUI('in', ${d.id})"><i data-lucide="ban"></i>Cancelar</button>`),
        btnIf(d.status === 'pending' && can('inv-entradas', 'update') && canProduce(),`<button type="button" class="iv-btn iv-btn-ghost danger sm" onclick="cancelDocUI('in', ${d.id})"><i data-lucide="trash-2"></i>Descartar</button><button type="button" class="iv-btn iv-btn-ok sm" onclick="confirmProdUI(${d.id})"><i data-lucide="check"></i>Confirmar producción</button>`),
        btnIf(waitingRecibi && mineBranch && req && can('inv-requisiciones', 'update'), `<button type="button" class="iv-btn iv-btn-ok sm" onclick="recibiUI(${req?.id})"><i data-lucide="package-check"></i>Recibí</button>`),
    ].join('');
    return { icon: o.icon, hex: o.color_hex, title: `Entrada ${d.folio}`, sub: `${esc(branchOf(d.branch_id).name)} · ${relDay(d.operation_date)}`, body, foot };
};
DRAWERS.out = id => {
    const d = byId(DB.outflows, id); if (!d) return null;
    const r = reasonOf(d.outflow_reason_id), req = d.requisition_id && byId(DB.requisitions, d.requisition_id);
    const body = `
        <div class="flex flex-wrap items-center gap-2 mb-3">${badge(r.name, r.color_hex, r.icon)}${r.is_loss ? badge('Merma', '#E11D48') : ''}${statusBadge(d.status)}</div>
        ${infoGrid([['Fecha', `${fdate(d.operation_date)} ${ftime(d.created_at)}`], ['Sucursal', esc(branchOf(d.branch_id).name)], ['Sale de', esc(whName(d.warehouse_id))], ['Departamento', esc(deptOf(d.department_id)?.name || '—')],
            d.sale_id ? ['Venta del POS', `<span class="iv-folio">${esc(d.folio)}</span>`] : null, req ? ['Requisición', `<span class="iv-folio">${req.folio}</span> · ${esc(branchName(req.branch_id))}`] : null,
            ['Registró', `${esc(userName(d.user_id))} · ${fstamp(d.created_at)}`], d.cancelled_at ? ['Canceló', `${esc(userName(d.cancelled_user_id))}: ${esc(d.cancel_reason)}`] : null])}
        ${d.evidence_url ? `<div class="iv-drop has mt-3"><i data-lucide="image" class="w-5 h-5"></i><span>Foto de evidencia adjunta</span></div>` : r.requires_evidence ? '<div class="iv-note mt-3"><i data-lucide="camera-off"></i><span>Sin foto de evidencia.</span></div>' : ''}
        ${d.note ? `<div class="iv-note mt-3"><i data-lucide="sticky-note"></i><span>${esc(d.note)}</span></div>` : ''}
        ${section('Renglones', linesTable(d.lines, [
            { label: 'Artículo', cell: l => `<div class="text-[12.5px] font-semibold">${esc(itemOf(l.item_id).name)}</div>${l.item_presentation_id ? `<div class="iv-meta" style="color:#0369A1">Salió como presentación: ${num(l.presentation_quantity)} × ${esc(presOf(l.item_presentation_id).name)}</div>` : ''}${l.lots?.length ? `<div class="iv-meta">Lote ${l.lots.map(t => esc(DB.lots.find(x => x.id === t.lot)?.batch_code || '—')).join(', ')}</div>` : ''}` },
            { label: 'Cant.', cls: 'r', cell: l => `<span class="iv-minus">−${num(l.quantity)}</span> <span class="iv-meta inline">${esc(unitCode(itemOf(l.item_id)))}</span>` },
            { label: 'Costo', cls: 'r', money: 1, cell: l => `<span class="tabular-nums">${money(l.cost)}</span>` },
            { label: 'Subtotal', cls: 'r', money: 1, cell: l => `<b class="tabular-nums iv-minus">−${money(l.subtotal)}</b>` },
            { label: 'Antes → Quedó', cls: 'r', cell: l => chain(l.previous_stock, l.resulting_stock) },
        ], canCost('inv-salidas')), canCost('inv-salidas') ? `<b class="text-[13px] iv-minus">−${money(d.total_cost)}</b>` : `<b class="text-[13px] iv-minus">−${num(d.total_units)} u.</b>`)}`;
    const foot = btnIf(can('inv-salidas', 'print'), `<button type="button" class="iv-btn iv-btn-ghost sm" onclick="toast('En el módulo real se imprime el movimiento de almacén con firmas', 'info')"><i data-lucide="printer"></i>Imprimir</button>`) + btnIf(d.status === 'applied' && !r.is_system && can('inv-salidas', 'cancel'), `<button type="button" class="iv-btn iv-btn-ghost danger sm" onclick="cancelDocUI('out', ${d.id})"><i data-lucide="ban"></i>Cancelar</button>`);
    return { icon: r.icon, hex: r.color_hex, title: `${r.is_loss ? 'Merma' : 'Salida'} ${d.folio}`, sub: `${esc(branchOf(d.branch_id).name)} · ${relDay(d.operation_date)}`, body, foot };
};
DRAWERS.tra = id => {
    const t = byId(DB.transfers, id); if (!t) return null;
    const code = trCode(t), done = code === 'RECEIVED';
    const end = (b, w, lbl) => `<div class="flex-1 min-w-0 iv-box"><div class="iv-meta">${lbl}</div><div class="iv-name truncate">${esc(branchOf(b).name)}</div><div class="iv-meta truncate">${esc(whName(w))}</div></div>`;
    const body = `
        <div class="flex items-center gap-2">${end(t.origin_branch_id, t.origin_warehouse_id, 'Sale de')}<i data-lucide="arrow-right" class="w-5 h-5 text-gray-400 shrink-0"></i>${end(t.destination_branch_id, t.destination_warehouse_id, 'Va a')}</div>
        <div class="flex flex-wrap items-center gap-2 my-3">${trBadge(t)}<span class="iv-meta">${plural(t.total_products, 'producto', 'productos')} · ${num(t.total_units)} unidades${canCost('inv-traspasos') ? ` · ${money(t.total_cost)}` : ''}</span></div>
        ${infoGrid([['Solicitó', `${esc(userName(t.requested_user_id))} · ${fstamp(t.requested_at)}`], ['Recibió', t.received_at ? `${esc(userName(t.received_user_id))} · ${fstamp(t.received_at)}` : '—'], t.reject_reason ? ['Motivo', esc(t.reject_reason)] : null])}
        ${t.note ? `<div class="iv-note mt-3"><i data-lucide="sticky-note"></i><span>${esc(t.note)}</span></div>` : ''}
        ${section('Productos', linesTable(t.lines, [
            { label: 'Artículo', cell: l => `<span class="text-[12.5px] font-semibold">${esc(itemOf(l.item_id).name)}</span>` },
            { label: 'Enviado', cls: 'r', cell: l => `<span class="tabular-nums">${num(l.quantity)}</span>` },
            { label: 'Recibido', cls: 'r', cell: l => l.quantity_received === null ? '<span class="iv-meta">—</span>' : `<b class="tabular-nums ${l.quantity_received < l.quantity ? 'text-rose-600' : ''}">${num(l.quantity_received)}</b>` },
            { label: 'Costo', cls: 'r', money: 1, cell: l => `<span class="tabular-nums">${money(l.subtotal)}</span>` },
            ...(done ? [{ label: 'Origen · destino', cls: 'r', cell: l => `<div class="iv-meta">${chain(l.origin_previous_stock, l.origin_resulting_stock)}</div><div class="iv-meta">${chain(l.destination_previous_stock, l.destination_resulting_stock)}</div>` }] : []),
        ], canCost('inv-traspasos')))}
        ${section('Historial', `<div class="iv-time">${t.history.map(h => { const s = tStatusOf(h.status); return `<div class="iv-time-item" style="${tone(s.color_hex)}"><div class="text-[12.5px] font-semibold">${esc(s.name)} <span class="iv-meta inline">· ${fstamp(h.at)}</span></div><div class="iv-meta">${esc(userName(h.user_id))} · ${esc(h.note)}</div></div>`; }).join('')}</div>`)}`;
    const foot = code !== 'REQUESTED' ? '' : t.destination_branch_id === UI.branch
        ? btnIf(can('inv-traspasos', 'update'), `<button type="button" class="iv-btn iv-btn-ghost danger sm" onclick="rejectTransferUI(${t.id})"><i data-lucide="circle-x"></i>Rechazar</button><button type="button" class="iv-btn iv-btn-ok sm" onclick="openReceive(${t.id})"><i data-lucide="package-check"></i>Confirmar recepción</button>`)
        : t.origin_branch_id === UI.branch ? btnIf(can('inv-traspasos', 'cancel'), `<button type="button" class="iv-btn iv-btn-ghost danger sm" onclick="cancelTransferUI(${t.id})"><i data-lucide="ban"></i>Cancelar traspaso</button>`)
            : myBranches().includes(t.destination_branch_id) ? `<span class="iv-meta">Lo confirma ${esc(branchName(t.destination_branch_id))}.</span><button type="button" class="iv-btn iv-btn-ghost sm" onclick="switchBranch(${t.destination_branch_id})">Cambiar a ${esc(branchName(t.destination_branch_id))}</button>` : `<span class="iv-meta">Lo confirma ${esc(branchName(t.destination_branch_id))}.</span>`;
    return { icon: 'arrow-right-left', hex: '#0369A1', title: `Traspaso ${t.folio}`, sub: `${relDay(t.created_at.slice(0, 10))} · ${ftime(t.created_at)}`, body, foot };
};
DRAWERS.req = id => {
    const r = byId(DB.requisitions, id); if (!r) return null;
    const code = reqCode(r), mine = r.branch_id === UI.branch, source = r.source_branch_id === UI.branch;
    const partial = code === 'SURTIDO_PARCIAL' || r.supplies.length > 1;
    const steps = [['EN_ESPERA', 'En espera'], ...(partial ? [['SURTIDO_PARCIAL', 'Surtido parcialmente']] : []), ['ENTREGADO', 'Entregado'], ['CONFIRMADO', 'Confirmado']];
    const order = steps.map(s => s[0]), at = order.indexOf(code);
    const stepper = ['BORRADOR', 'RECHAZADA', 'CANCELADA'].includes(code) ? `<div class="iv-note" style="${tone(rStatusOf(r.requisition_status_id).color_hex)}"><i data-lucide="${rStatusOf(r.requisition_status_id).icon}"></i><span>${code === 'BORRADOR' ? 'Borrador: nadie lo ve hasta que lo envíes.' : code === 'RECHAZADA' ? `Rechazada: ${esc(r.reject_reason || '')}` : 'Cancelada por quien la pidió.'}</span></div>`
        : `<div class="iv-steps">${steps.map(([c, n], i) => `<div class="iv-step ${i < at || code === 'CONFIRMADO' ? 'done' : i === at ? 'now' : ''}"><span class="iv-step-dot">${i < at || code === 'CONFIRMADO' ? '<i data-lucide="check"></i>' : ''}</span>${n}</div>`).join('')}</div>`;
    const body = `${stepper}
        <div class="mt-4">${infoGrid([['Pide', `${esc(branchOf(r.branch_id).name)}<div class="iv-meta">${esc(deptOf(r.department_id)?.name || 'Sin departamento')} · ${esc(userName(r.user_id))}</div>`], ['Le pide a', `${esc(branchOf(r.source_branch_id).name)}<div class="iv-meta">${esc(r.warehouse_id ? whName(r.warehouse_id) : 'Elige almacén al surtir')}</div>`], ['Fecha de pedido', fstamp(r.created_at)], ['Lo necesita para', relDay(r.needed_date)], r.confirmed_at ? ['Recibí', `${esc(userName(r.confirmed_user_id))} · ${fstamp(r.confirmed_at)}`] : null])}</div>
        ${r.note ? `<div class="iv-note mt-3"><i data-lucide="sticky-note"></i><span>${esc(r.note)}</span></div>` : ''}
        ${section('Materiales', linesTable(r.lines, [
            { label: 'Producto', cell: l => `<div class="text-[12.5px] font-semibold">${esc(itemOf(l.item_id).name)}</div>${l.delivered_item_id ? `<div class="iv-meta" style="color:#B45309">Pidió ${esc(itemOf(l.item_id).name)} · Se entregó ${esc(itemOf(l.delivered_item_id).name)}</div>` : ''}${l.note ? `<div class="iv-meta">${esc(l.note)}</div>` : ''}` },
            { label: 'Pedido', cls: 'r', cell: l => `<span class="tabular-nums">${num(l.quantity)}</span> <span class="iv-meta inline">${esc(unitCode(itemOf(l.item_id)))}</span>` },
            { label: 'Surtido', cls: 'r', cell: l => `<b class="tabular-nums ${l.quantity_supplied >= l.quantity ? 'iv-plus' : ''}">${num(l.quantity_supplied)}</b>` },
            { label: 'Pendiente', cls: 'r', cell: l => { const p = round(l.quantity - l.quantity_supplied); return p > 0 ? `<span class="text-rose-600 font-semibold tabular-nums">${num(p)}</span>` : '<span class="iv-meta">—</span>'; } },
        ]))}
        ${r.supplies.length ? section('Surtimientos', `<div class="space-y-2">${r.supplies.map((s, i) => `<div class="iv-box"><div class="flex items-center justify-between gap-2"><span class="text-[12.5px] font-semibold">${i + 1}. ${fstamp(s.at)} · ${esc(userName(s.user_id))}</span><span class="text-[12.5px] tabular-nums">${num(s.total_units)} u.${canCost('inv-surtir') || canCost('inv-requisiciones') ? ` · ${money(s.total_cost)}` : ''}</span></div>
            <div class="iv-meta mt-0.5">${s.moves_stock ? `Descontó de ${esc(whName(s.warehouse_id))}` : 'Solo se marcó surtido (no movió inventario)'}${s.outflow_id ? ` · <button type="button" class="iv-folio" onclick="openDrawer('out', ${s.outflow_id})">${byId(DB.outflows, s.outflow_id).folio}</button>` : ''}${s.inflow_id ? ` → <button type="button" class="iv-folio" onclick="openDrawer('in', ${s.inflow_id})">${byId(DB.inflows, s.inflow_id).folio}</button>` : ''}</div>${s.note ? `<div class="text-[12px] mt-1"><b>¿Por qué no se surtió todo?</b> ${esc(s.note)}</div>` : ''}</div>`).join('')}</div>`) : ''}`;
    // Quien pide (inv-requisiciones) y quien surte (inv-surtir) ven el mismo documento con botones distintos
    const asker = mine && can('inv-requisiciones');
    const b = [];
    if (asker && code === 'BORRADOR') b.push(btnIf(can('inv-requisiciones', 'cancel'), `<button type="button" class="iv-btn iv-btn-ghost danger sm" onclick="cancelReqUI(${r.id})"><i data-lucide="trash-2"></i>Cancelar</button>`) + btnIf(can('inv-requisiciones', 'update'), `<button type="button" class="iv-btn iv-btn-ghost sm" onclick="openDocForm('req', { edit: ${r.id} })"><i data-lucide="pencil"></i>Editar</button>`) + btnIf(can('inv-requisiciones', 'create'), `<button type="button" class="iv-btn iv-btn-brand sm" onclick="sendReqUI(${r.id})"><i data-lucide="send"></i>Enviar</button>`));
    if (asker && code === 'EN_ESPERA') b.push(btnIf(can('inv-requisiciones', 'cancel'), `<button type="button" class="iv-btn iv-btn-ghost danger sm" onclick="cancelReqUI(${r.id})"><i data-lucide="ban"></i>Cancelar</button>`));
    if (asker && code === 'ENTREGADO') b.push(btnIf(can('inv-requisiciones', 'update'), `<button type="button" class="iv-btn iv-btn-ok sm" onclick="recibiUI(${r.id})"><i data-lucide="package-check"></i>Recibí</button>`));
    if (source && ['EN_ESPERA', 'SURTIDO_PARCIAL'].includes(code)) b.push(btnIf(code === 'EN_ESPERA' && can('inv-surtir', 'cancel'), `<button type="button" class="iv-btn iv-btn-ghost danger sm" onclick="rejectReqUI(${r.id})"><i data-lucide="circle-x"></i>Rechazar</button>`) + btnIf(can('inv-surtir', 'update'), `<button type="button" class="iv-btn iv-btn-brand sm" onclick="openSupply(${r.id})"><i data-lucide="truck"></i>${code === 'SURTIDO_PARCIAL' ? 'Terminar de surtir' : 'Surtir'}</button>`));
    if (code !== 'BORRADOR' && (can('inv-requisiciones', 'print') || can('inv-surtir', 'print'))) b.unshift(`<button type="button" class="iv-btn iv-btn-ghost sm" onclick="toast('Abre WhatsApp con el enlace público de la requisición', 'info')"><i data-lucide="share-2"></i>Compartir</button>`);
    return { icon: 'clipboard-list', hex: rStatusOf(r.requisition_status_id).color_hex, title: `Requisición ${r.folio}`, sub: `${esc(branchName(r.branch_id))} → ${esc(branchName(r.source_branch_id))}`, body: `<div class="flex items-center gap-2 mb-3">${reqBadge(r)}</div>${body}`, foot: b.join('') };
};

// =====================================================================
// ACCIONES
// =====================================================================
function cancelDocUI(kind, id) {
    const d = byId(kind === 'in' ? DB.inflows : DB.outflows, id);
    if (kind === 'in' && d.status === 'pending') {
        return confirmBox('¿Descartar la producción pendiente?', 'No movió inventario: solo se marca como cancelada.', 'Sí, descartar', true).then(ok => { if (!ok) return; cancelInflow(d, 'Descartada antes de confirmar', DB.user.id, nowStamp()); toast(`${d.folio} descartada`); refresh(); });
    }
    askCancel(`${kind === 'in' ? 'la entrada' : 'la salida'} ${d.folio}`).then(reason => {
        if (!reason) return;
        (kind === 'in' ? cancelInflow : cancelOutflow)(d, reason, DB.user.id, nowStamp());
        toast(`${d.folio} cancelada; el inventario regresó`);
        refresh();
    });
}
function confirmProdUI(id) {
    const d = byId(DB.inflows, id);
    confirmBox('¿Confirmar la producción?', `Suma ${num(d.total_units)} piezas a <b>${esc(whName(d.warehouse_id))}</b> con sus lotes y caducidades.`, 'Sí, confirmar').then(ok => { if (!ok) return; confirmInflow(d, DB.user.id, nowStamp()); toast(`Producción ${d.folio} confirmada`); refresh(); });
}
function openReceive(id) {
    const t = byId(DB.transfers, id);
    modal({ id: 'mdlRecv', icon: 'package-check', hex: '#059669', title: `Recibir ${t.folio}`, sub: `De ${esc(branchOf(t.origin_branch_id).name)} · cuenta lo que llegó; si falta, cámbialo`, width: 640,
        body: `<div class="iv-grid-wrap"><table class="iv-grid"><thead><tr><th>Artículo</th><th class="r w-24">Enviado</th><th class="w-32">Llegó</th><th class="w-16">Unidad</th></tr></thead><tbody>${t.lines.map(l => `<tr><td class="text-[12.5px] font-semibold">${esc(itemOf(l.item_id).name)}</td><td class="r tabular-nums">${num(l.quantity)}</td><td><input type="number" min="0" step="any" class="iv-inp num no-spin" data-recv="${l.id}" value="${l.quantity}"></td><td class="text-[12px] text-gray-500">${esc(unitCode(itemOf(l.item_id)))}</td></tr>`).join('')}</tbody></table></div>
            <div class="iv-note mt-3"><i data-lucide="info"></i><span>Al confirmar se descuenta lo enviado en ${esc(branchName(t.origin_branch_id))} y se suma lo que llegó aquí. La diferencia queda anotada en el historial.</span></div>`,
        foot: `<button type="button" class="iv-btn iv-btn-ghost" onclick="closeModal('mdlRecv')">Cancelar</button><button type="button" class="iv-btn iv-btn-ok" onclick="doReceive(${t.id})"><i data-lucide="check"></i>Confirmar recepción</button>` });
}
function doReceive(id) {
    const t = byId(DB.transfers, id), rec = {};
    let bad = false;
    document.querySelectorAll('#mdlRecv [data-recv]').forEach(el => { const v = Number(el.value); const l = t.lines.find(x => x.id === Number(el.dataset.recv)); if (el.value === '' || v < 0 || v > l.quantity) { bad = true; el.classList.add('bad'); } else rec[l.id] = v; });
    if (bad) { swalBase({ icon: 'warning', title: 'Revisa las cantidades', text: 'No puede llegar más de lo enviado ni quedar vacío.' }); return; }
    receiveTransfer(t, rec, DB.user.id, nowStamp());
    closeModal('mdlRecv');
    toast(`Traspaso ${t.folio} recibido`);
    refresh();
}
function rejectTransferUI(id) {
    const t = byId(DB.transfers, id);
    swalBase({ icon: 'warning', title: `¿Rechazar ${t.folio}?`, input: 'text', inputPlaceholder: 'Motivo', showCancelButton: true, confirmButtonText: 'Rechazar', confirmButtonColor: '#e11d48', inputValidator: v => !v.trim() && 'Escribe el motivo' })
        .then(r => { if (!r.isConfirmed) return; closeTransfer(t, 'REJECTED', r.value.trim(), DB.user.id, nowStamp()); toast('Traspaso rechazado; no se movió nada', 'info'); refresh(); });
}
function cancelTransferUI(id) {
    const t = byId(DB.transfers, id);
    confirmBox(`¿Cancelar ${t.folio}?`, 'Todavía no se movía el stock: solo se cancela.', 'Sí, cancelar', true).then(ok => { if (!ok) return; closeTransfer(t, 'CANCELLED', 'Cancelado por quien lo envió', DB.user.id, nowStamp()); toast('Traspaso cancelado', 'info'); refresh(); });
}
function sendReqUI(id) {
    const r = byId(DB.requisitions, id);
    confirmBox('¿Enviar la requisición?', `${r.folio} a ${esc(branchName(r.source_branch_id))}: ${plural(r.total_products, 'material', 'materiales')}.`, 'Sí, enviar').then(ok => { if (!ok) return; Object.assign(r, { requisition_status_id: rStatusBy('EN_ESPERA').id, sent_at: nowStamp() }); toast(`${r.folio} enviada`); refresh(); });
}
function cancelReqUI(id) {
    const r = byId(DB.requisitions, id);
    confirmBox(`¿Cancelar ${r.folio}?`, 'Nadie la ha surtido: solo se cancela.', 'Sí, cancelar', true).then(ok => { if (!ok) return; r.requisition_status_id = rStatusBy('CANCELADA').id; toast('Requisición cancelada', 'info'); refresh(); });
}
function rejectReqUI(id) {
    const r = byId(DB.requisitions, id);
    swalBase({ icon: 'warning', title: `¿Rechazar ${r.folio}?`, input: 'text', inputPlaceholder: 'Motivo para la sucursal', showCancelButton: true, confirmButtonText: 'Rechazar', confirmButtonColor: '#e11d48', inputValidator: v => !v.trim() && 'Escribe el motivo' })
        .then(x => { if (!x.isConfirmed) return; Object.assign(r, { requisition_status_id: rStatusBy('RECHAZADA').id, reject_reason: x.value.trim() }); toast('Requisición rechazada', 'info'); refresh(); });
}
function recibiUI(id) {
    const r = byId(DB.requisitions, id);
    confirmBox('¿Te llegó todo?', `Confirmas que recibiste lo surtido de ${r.folio}. Ya está sumado en tu almacén; esto solo lo deja confirmado.`, 'Sí, recibí').then(ok => { if (!ok) return; confirmRequisition(r, DB.user.id, nowStamp()); toast(`${r.folio} confirmada`); refresh(); });
}
// -- Surtir una requisición: dos tablas en una (lo pedido | lo que se entrega) --
function openSupply(id) {
    const r = byId(DB.requisitions, id);
    const whs = whOfBranch(r.source_branch_id);
    const w = r.warehouse_id || mainWh().id;
    const body = () => {
        const wid = Number($id('suWh')?.value || w);
        const pend = r.lines.filter(l => l.quantity_supplied < l.quantity);
        return `<div class="grid grid-cols-2 md:grid-cols-3 gap-2.5"><div><label class="iv-lbl">Almacén que surte</label><select id="suWh" class="iv-inp" onchange="$id('mdlSupplyBody').innerHTML = SUPPLY_BODY(); bindSupply()">${whs.map(x => `<option value="${x.id}" ${x.id === wid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
            <div><label class="iv-lbl">Pide</label><input class="iv-inp" readonly value="${esc(branchOf(r.branch_id).name)} · ${esc(deptOf(r.department_id)?.name || 'sin depto.')}"></div><div><label class="iv-lbl">Lo necesita para</label><input class="iv-inp" readonly value="${relDay(r.needed_date)}"></div></div>
            ${r.note ? `<div class="iv-note mt-2"><i data-lucide="sticky-note"></i><span>${esc(r.note)}</span></div>` : ''}
            <div class="iv-grid-wrap mt-3"><table class="iv-grid"><thead><tr><th>Pidió</th><th class="r w-20">Falta</th><th class="min-w-[220px]">Producto a entregar</th><th class="r w-20">Hay</th><th class="w-28">A entregar</th><th class="w-28">¿Alcanza?</th></tr></thead><tbody>
            ${pend.map(l => { const it = itemOf(l.item_id), falta = round(l.quantity - l.quantity_supplied), have = qtyIn(wid, it.id);
                const subs = DB.items.filter(x => x.active && x.id !== it.id && x.item_category_id === it.item_category_id && x.kind === it.kind && qtyIn(wid, x.id) > 0);
                const give = Math.max(0, Math.min(falta, have));
                return `<tr data-sl="${l.id}"><td><div class="text-[12.5px] font-semibold">${num(falta)} ${esc(unitCode(it))} · ${esc(it.name)}</div>${l.note ? `<div class="iv-meta">${esc(l.note)}</div>` : ''}</td><td class="r tabular-nums">${num(falta)}</td>
                    <td><select class="iv-inp" data-sk="item"><optgroup label="Lo pedido"><option value="${it.id}">${esc(it.name)}</option></optgroup>${subs.length ? `<optgroup label="Otros de ${esc(catOf(it)?.name || '')}">${subs.map(x => `<option value="${x.id}">${esc(x.name)} · hay ${num(qtyIn(wid, x.id))}</option>`).join('')}</optgroup>` : ''}</select></td>
                    <td class="r tabular-nums" data-sk="have">${num(have)}</td><td><input type="number" min="0" step="any" class="iv-inp num no-spin" data-sk="qty" value="${give}"></td><td data-sk="ok"></td></tr>`; }).join('')}</tbody></table></div>
            <div class="mt-3" id="suWhy"><label class="iv-lbl">¿Por qué no se surtió todo?</label><input id="suNote" class="iv-inp" placeholder="Ej. la harina llega el lunes"></div>
            ${whOf(wid).supply_moves_stock ? '' : '<div class="iv-note mt-2"><i data-lucide="info"></i><span>Este almacén tiene apagado «Surtir mueve inventario» (Catálogo › Almacenes): se puede marcar surtido sin descontar.</span></div>'}`;
    };
    window.SUPPLY_BODY = body;
    window.SUPPLY_REQ = r;
    modal({ id: 'mdlSupply', icon: 'truck', hex: '#C05A40', title: `Surtiendo la requisición ${r.folio}`, sub: `${esc(branchOf(r.branch_id).name)} → descuenta de tu almacén y entra al suyo`, width: 980, body: body(),
        foot: `<button type="button" class="iv-btn iv-btn-ghost" onclick="closeModal('mdlSupply')">Cancelar</button><button type="button" class="iv-btn iv-btn-brand" id="suGo" onclick="doSupply()"><i data-lucide="truck"></i>Surtir</button>` });
    bindSupply();
}
function bindSupply() {
    const wid = Number($id('suWh').value);
    const sync = () => {
        let short = 0, n = 0;
        document.querySelectorAll('#mdlSupply tr[data-sl]').forEach(tr => {
            const l = SUPPLY_REQ.lines.find(x => x.id === Number(tr.dataset.sl)), falta = round(l.quantity - l.quantity_supplied);
            const item = Number(tr.querySelector('[data-sk="item"]').value), have = qtyIn(wid, item), q = Number(tr.querySelector('[data-sk="qty"]').value) || 0;
            tr.querySelector('[data-sk="have"]').textContent = num(have);
            tr.querySelector('[data-sk="ok"]').innerHTML = have >= falta ? badge('Sí', '#059669') : have > 0 ? badge(`Solo ${num(have)} de ${num(falta)}`, '#D97706') : badge('No hay', '#E11D48');
            if (q < falta) short++;
            if (q > 0) n++;
        });
        $id('suWhy').classList.toggle('hidden', !short);
        $id('suGo').innerHTML = `<i data-lucide="truck"></i>Surtir ${plural(n, 'producto', 'productos')}`;
        $id('suGo').disabled = !n;
        icons();
    };
    document.querySelectorAll('#mdlSupply [data-sk]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', sync));
    sync();
}
function doSupply() {
    const r = SUPPLY_REQ, wid = Number($id('suWh').value), qty = {}, sub = {};
    let short = 0;
    document.querySelectorAll('#mdlSupply tr[data-sl]').forEach(tr => { const id = Number(tr.dataset.sl), l = r.lines.find(x => x.id === id); qty[id] = Number(tr.querySelector('[data-sk="qty"]').value) || 0; const it = Number(tr.querySelector('[data-sk="item"]').value); if (it !== l.item_id) sub[id] = it; if (qty[id] < l.quantity - l.quantity_supplied) short++; });
    const note = $id('suNote')?.value.trim() || '';
    if (short && !note) { swalBase({ icon: 'warning', title: 'Falta el motivo', text: 'Escribe por qué no se surtió todo: la sucursal lo verá en el historial.' }); return; }
    const sameBranch = whOf(wid).branch_id === r.branch_id;
    swalBase({ icon: 'question', title: '¿Quieres descontarlo AHORA de tu almacén?', html: `Sí = salida <b>S-</b> en ${esc(whName(wid))}${sameBranch ? '' : ` y entrada <b>ENT-</b> en ${esc(branchName(r.branch_id))}, que espera su «Recibí»`}.<br>No = solo se marca surtido.`, showDenyButton: true, showCancelButton: true, confirmButtonText: 'Sí, descontar', denyButtonText: 'No, solo marcar', denyButtonColor: '#6B7280' })
        .then(x => {
            if (!x.isConfirmed && !x.isDenied) return;
            const sup = supplyRequisition(r, { warehouse_id: wid, qty, sub, note, user_id: DB.user.id, at: nowStamp(), moves: x.isConfirmed, force: x.isConfirmed });
            closeModal('mdlSupply');
            toast(sup ? `${r.folio}: ${reqCode(r) === 'ENTREGADO' ? 'entregada completa' : 'surtida parcialmente'}` : 'Nada que surtir', sup ? 'success' : 'info');
            refresh();
            openDrawer('req', r.id);
        });
}

// =====================================================================
// CONTEO FÍSICO
// =====================================================================
function openNewCount() {
    const whs = DB.warehouses.filter(w => w.active && myBranches().includes(w.branch_id));
    const draft = DB.adjustments.find(a => a.status === 'draft' && a.branch_id === UI.branch);
    // Quien no aplica ajustes cuenta siempre a ciegas: así no «cuadra» contra el sistema
    const reviewer = can('inv-stock', 'aplicar-ajuste');
    modal({ id: 'mdlNewCount', icon: 'clipboard-check', hex: '#7C3AED', title: '¿Deseas crear un conteo físico?', sub: 'Se toma lo que dice el sistema en este momento; tú capturas lo que hay de verdad.', width: 520,
        body: `<div class="grid grid-cols-2 gap-2.5"><div class="col-span-2"><label class="iv-lbl">Almacén</label><select id="ncWh" class="iv-inp" onchange="ncAreas()">${whs.map(w => `<option value="${w.id}" ${w.id === myWh()?.id ? 'selected' : ''}>${esc(w.name)} · ${esc(branchName(w.branch_id))}</option>`).join('')}</select></div>
            <div><label class="iv-lbl">Área</label><select id="ncArea" class="iv-inp"></select></div><div class="flex items-end pb-2"><label class="iv-check"><input type="checkbox" id="ncBlind" ${reviewer ? '' : 'checked disabled'}> A ciegas (no ve el sistema)</label></div></div>
            ${reviewer ? '' : '<p class="iv-meta mt-2">Tu rol cuenta a ciegas. Cuando termines, el Supervisor o la Dueña compara y aplica.</p>'}
            ${draft ? `<div class="iv-note mt-3"><i data-lucide="info"></i><span>Ya hay un conteo en borrador en esta sucursal (${draft.folio}). <button type="button" class="font-semibold" style="color:var(--iv-brand)" onclick="closeModal('mdlNewCount'); openCount(${draft.id})">Retomarlo</button></span></div>` : ''}`,
        foot: `<button type="button" class="iv-btn iv-btn-ghost" onclick="closeModal('mdlNewCount')">Cancelar</button><button type="button" class="iv-btn iv-btn-brand" onclick="startCount()"><i data-lucide="clipboard-pen"></i>Empezar conteo</button>` });
    ncAreas();
}
function ncAreas() { const w = Number($id('ncWh').value); $id('ncArea').innerHTML = `<option value="">Todas las áreas</option>${DB.areas.filter(a => a.warehouse_id === w && a.active).map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}`; }
function startCount() {
    const w = whOf(Number($id('ncWh').value));
    const doc = createCount({ branch_id: w.branch_id, warehouse_id: w.id, warehouse_area_id: Number($id('ncArea').value) || null, is_blind: $id('ncBlind').checked, operation_date: dayISO(0), at: nowStamp(), user_id: DB.user.id });
    closeModal('mdlNewCount');
    if (!doc.lines.length) { doc.status = 'cancelled'; swalBase({ icon: 'info', title: 'Nada que contar', text: 'Ese almacén o área no tiene artículos con existencia.' }); return; }
    refresh();
    openCount(doc.id);
}
function openCount(id) {
    const a = byId(DB.adjustments, id);
    const areas = [...new Set(a.lines.map(l => areaIn(a.warehouse_id, itemOf(l.item_id))?.name || 'Sin área'))].sort();
    window.COUNT = { a, area: 'all', q: '' };
    modal({ id: 'mdlCount', icon: 'clipboard-pen', hex: '#7C3AED', title: `Conteo físico ${a.folio}`, sub: `${esc(whName(a.warehouse_id))} · ${esc(areaOf(a.warehouse_area_id)?.name || 'todas las áreas')}${a.is_blind ? ' · a ciegas' : ''}`, width: 1000,
        body: `<div class="flex flex-wrap items-center justify-between gap-2"><div class="iv-tabs flex-1 min-w-0" id="ccTabs">${['all', ...areas].map(x => `<button type="button" class="iv-tab ${x === 'all' ? 'active' : ''}" data-ar="${esc(x)}">${x === 'all' ? 'Todas' : esc(x)}</button>`).join('')}</div>
            <div class="iv-inp-wrap w-64"><i data-lucide="search"></i><input id="ccQ" class="iv-inp" placeholder="Buscar producto o SKU" autocomplete="off"></div></div><div id="ccSheet" class="mt-3"></div>`,
        foot: `<span id="ccSum" class="text-[12.5px] text-gray-500 mr-auto"></span><button type="button" class="iv-btn iv-btn-ghost" onclick="closeModal('mdlCount'); refresh(); toast('Borrador guardado', 'info')"><i data-lucide="save"></i>Guardar borrador</button>${can('inv-stock', 'aplicar-ajuste') ? `<button type="button" class="iv-btn iv-btn-brand" onclick="applyCountUI()"><i data-lucide="check-check"></i>Aplicar ajuste</button>` : `<button type="button" class="iv-btn iv-btn-brand" onclick="closeModal('mdlCount'); refresh(); toast('Listo: el Supervisor lo revisa y lo aplica')"><i data-lucide="send"></i>Terminé de contar</button>`}` });
    $id('mdlCount').dataset.esc = 'off';
    document.querySelectorAll('#ccTabs [data-ar]').forEach(b => b.addEventListener('click', () => { COUNT.area = b.dataset.ar; document.querySelectorAll('#ccTabs .iv-tab').forEach(x => x.classList.toggle('active', x === b)); paintCount(); }));
    $id('ccQ').addEventListener('input', e => { COUNT.q = e.target.value; paintCount(); });
    paintCount();
}
function paintCount() {
    const { a, area, q } = COUNT, qn = norm(q);
    const rows = a.lines.filter(l => { const it = itemOf(l.item_id), ar = areaIn(a.warehouse_id, it)?.name || 'Sin área'; return (area === 'all' || ar === area) && (!qn || norm(`${it.name} ${it.sku}`).includes(qn)); });
    // A ciegas solo para quien cuenta: quien aplica el ajuste sí ve el sistema y la diferencia
    const blind = a.is_blind && !can('inv-stock', 'aplicar-ajuste');
    const mBlind = blind || !canCost('inv-stock');
    COUNT.blind = blind; COUNT.mBlind = mBlind;
    $id('ccSheet').innerHTML = `<div class="iv-grid-wrap" style="max-height:56vh"><table class="iv-grid" style="table-layout:fixed"><thead><tr><th class="w-10">#</th><th>Artículo</th><th class="w-20">Unidad</th><th class="r w-24">${blind ? '' : 'Sistema'}</th><th class="w-32">Físico</th><th class="r w-24">${blind ? '' : 'Diferencia'}</th><th class="r w-28">${mBlind ? '' : '$'}</th></tr></thead><tbody>
        ${rows.map((l, i) => { const it = itemOf(l.item_id); return `<tr><td class="text-gray-400 text-[12px]">${i + 1}</td><td><div class="iv-name text-[12.5px] truncate">${esc(it.name)}</div><div class="iv-meta">${esc(it.sku)} · ${esc(areaIn(a.warehouse_id, it)?.name || 'Sin área')}</div></td><td class="text-[12px] text-gray-500">${esc(unitCode(it))}</td>
            <td class="r tabular-nums"><span class="${blind ? 'invisible' : ''}">${num(l.system_quantity)}</span></td>
            <td><input type="number" min="0" step="any" class="iv-inp num no-spin" data-cl="${l.id}" value="${l.physical_quantity ?? ''}" placeholder="—"></td>
            <td class="r" id="ccD${l.id}"><span class="${blind ? 'invisible' : ''}">${l.physical_quantity === null ? '<span class="iv-meta">—</span>' : signed(l.difference)}</span></td>
            <td class="r" id="ccC${l.id}"><span class="${mBlind ? 'invisible' : ''}">${l.physical_quantity === null ? '<span class="iv-meta">—</span>' : signed(l.cost_difference, true)}</span></td></tr>`; }).join('') || '<tr><td colspan="7"><div class="iv-empty"><b>Sin artículos</b></div></td></tr>'}</tbody></table></div>`;
    const inputs = [...document.querySelectorAll('#ccSheet [data-cl]')];
    inputs.forEach((el, i) => {
        el.addEventListener('input', () => { const l = a.lines.find(x => x.id === Number(el.dataset.cl)); setCounted(a, l, el.value, nowStamp()); $id(`ccD${l.id}`).innerHTML = `<span class="${blind ? 'invisible' : ''}">${l.physical_quantity === null ? '—' : signed(l.difference)}</span>`; $id(`ccC${l.id}`).innerHTML = `<span class="${mBlind ? 'invisible' : ''}">${l.physical_quantity === null ? '—' : signed(l.cost_difference, true)}</span>`; paintCountSum(); });
        el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); inputs[i + 1]?.focus(); inputs[i + 1]?.select(); } if (e.key === 'ArrowUp') { e.preventDefault(); inputs[i - 1]?.focus(); inputs[i - 1]?.select(); } });
    });
    paintCountSum();
    icons();
}
function paintCountSum() { const a = COUNT.a; $id('ccSum').innerHTML = `Contados <b>${a.total_counted}</b> de ${a.total_products}${COUNT.blind ? '' : ` · con diferencia <b>${a.total_differences}</b>${COUNT.mBlind ? '' : ` · ${signed(a.total_diff_cost, true)}`}`}`; }
function applyCountUI() {
    const a = COUNT.a;
    if (!a.total_counted) { swalBase({ icon: 'warning', title: 'No has contado nada', text: 'Captura al menos un artículo.' }); return; }
    confirmBox('¿Aplicar el ajuste?', `Se ajustan ${plural(a.total_counted, 'artículo contado', 'artículos contados')} de ${esc(whName(a.warehouse_id))}. Lo no contado se queda igual.${a.is_blind ? '' : `<br>Diferencia: <b>${money(a.total_diff_cost)}</b>.`}`, 'Sí, aplicar').then(ok => {
        if (!ok) return;
        applyCount(a, DB.user.id, nowStamp());
        closeModal('mdlCount');
        toast(`Conteo ${a.folio} aplicado`);
        refresh();
        openDrawer('adj', a.id);
    });
}
function discardCount(id) {
    const a = byId(DB.adjustments, id);
    confirmBox('¿Descartar el borrador?', 'No movió inventario.', 'Sí, descartar', true).then(ok => { if (!ok) return; Object.assign(a, { status: 'cancelled', cancelled_at: nowStamp(), cancel_reason: 'Borrador descartado', cancelled_user_id: DB.user.id }); toast('Borrador descartado', 'info'); refresh(); });
}
function cancelCountUI(id) {
    const a = byId(DB.adjustments, id);
    askCancel(`el ajuste ${a.folio}`).then(reason => { if (!reason) return; cancelCount(a, reason, DB.user.id, nowStamp()); toast('Ajuste cancelado; la existencia regresó'); refresh(); });
}
