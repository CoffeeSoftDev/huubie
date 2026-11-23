// Inventarios (Huubie PRO) · vistas de consulta: Inicio (tablero), Stock (actual, por caducar, conteos),
// Movimientos (kárdex) y Reportes (hoja carta horizontal). Visores de artículo y de conteo.

const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Buen día' : h < 19 ? 'Buena tarde' : 'Buena noche'; };
const scopeWhs = f => DB.warehouses.filter(w => w.active && inBranch(w.branch_id, f));
const monthStart = () => dayISO(0).slice(0, 8) + '01';
// Renglones (almacén, artículo) con saldo: los que alguna vez se movieron en ese almacén
function stockPairs(whs) {
    const out = [];
    whs.forEach(w => DB.items.forEach(it => { const r = stockRow(w.id, it.id); if (r && it.active && it.is_inventoriable) out.push({ w, it, r, q: r.quantity, lv: levelOf(r.quantity, minOf(it, w.id), maxOf(it, w.id)) }); }));
    return out;
}

// =====================================================================
// INICIO
// =====================================================================
VIEWS.inicio = {
    mount() {
        const f = UI.f.inicio = UI.f.inicio || { scope: 'branch' };
        if (!allBranches()) f.scope = 'branch';
        const tiles = [
            [canBuy(), 'package-plus', 'Nueva entrada', 'Compra, devolución o nota', "openDocForm('in')"],
            [canProduce(), 'chef-hat', 'Producción del día', 'Lo que salió del horno', 'openProduction()'],
            [can('inv-salidas', 'create') && roleReasons().some(r => !r.is_loss), 'package-minus', 'Nueva salida', 'Consumo de un departamento', "openDocForm('out')"],
            [can('inv-salidas', 'create') && roleReasons().some(r => r.is_loss), 'trash-2', 'Registrar merma', 'Caducidad, daño, error', "openDocForm('out', { loss: true })"],
            [can('inv-traspasos', 'create'), 'arrow-right-left', 'Nuevo traspaso', 'Envía a otra sucursal', "openDocForm('tra')"],
            [can('inv-requisiciones', 'create'), 'clipboard-list', 'Nueva requisición', isMatriz() ? 'Pide insumos al almacén' : 'Pide material a la Matriz', "openDocForm('req')"],
            [can('inv-surtir', 'update') && isMatriz(), 'truck', 'Surtir', 'Lo que piden las sucursales', "setView('surtir')"],
            [can('inv-stock', 'update'), 'clipboard-check', 'Conteo físico', can('inv-stock', 'aplicar-ajuste') ? 'Cuenta y ajusta' : 'Cuenta; lo aplica el supervisor', 'openNewCount()'],
            [can('inv-reportes'), 'file-chart-column', 'Reportes', 'Inventario rápido y más', "setView('reportes')"],
        ].filter(t => t[0]);
        const r = ROLE();
        $id('view-inicio').innerHTML = `
            <div class="iv-head shrink-0">
                <div class="min-w-0"><h1 class="iv-title">Inventarios · ${greet()}, ${esc(DB.users[r.user].split(' ')[0])}</h1><p class="iv-sub">${esc(DB.company.name)} · <b>${esc(branchOf(UI.branch).name)}</b> · ${esc(r.name)} · ${fdate(dayISO(0))}</p></div>
                <div class="flex flex-wrap items-center gap-2">
                    ${allBranches() ? `<div class="iv-seg"><button type="button" data-scope="branch" class="${f.scope === 'branch' ? 'active' : ''}">Mi sucursal</button><button type="button" data-scope="all" class="${f.scope === 'all' ? 'active' : ''}">Todas</button></div>` : ''}
                    ${btnIf(canProduce(), `<button type="button" class="iv-btn ${canBuy() ? 'iv-btn-ghost' : 'iv-btn-brand'}" onclick="openProduction()"><i data-lucide="chef-hat"></i>Producción del día</button>`)}
                    ${btnIf(canBuy(), `<button type="button" class="iv-btn iv-btn-brand" onclick="openDocForm('in')"><i data-lucide="package-plus"></i>Nueva entrada</button>`)}
                    ${btnIf(!canBuy() && !canProduce() && can('inv-requisiciones', 'create'), `<button type="button" class="iv-btn iv-btn-brand" onclick="openDocForm('req')"><i data-lucide="clipboard-plus"></i>Nueva requisición</button>`)}
                </div>
            </div>
            <div id="inicioKpis" class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 shrink-0"></div>
            <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin -mx-1 px-1 pb-1">
                <div class="grid grid-cols-1 xl:grid-cols-3 gap-3">
                    <div class="iv-card p-3 xl:col-span-2 flex flex-col"><div class="flex items-center justify-between mb-2"><span class="iv-sec">Atención</span><button type="button" class="iv-btn iv-btn-ghost sm" onclick="setView('stock')">Ver stock<i data-lucide="arrow-right"></i></button></div><div id="inicioAlerts"></div></div>
                    <div class="iv-card p-3 flex flex-col"><div class="flex items-center justify-between mb-2"><span class="iv-sec">Pendientes</span></div><div id="inicioPend"></div></div>
                    <div class="iv-card p-3"><div class="flex items-center justify-between mb-1"><span class="iv-sec">Últimos 7 días</span><span class="flex items-center gap-3 text-[11px] text-gray-500"><span class="flex items-center gap-1"><span class="iv-dot" style="color:#059669"></span>Entradas</span><span class="flex items-center gap-1"><span class="iv-dot" style="color:#C05A40"></span>Salidas</span></span></div><div id="inicioBars"></div></div>
                    <div class="iv-card p-3"><div class="flex items-center justify-between mb-2"><span class="iv-sec">Mermas del mes</span>${btnIf(can('inv-reportes'), `<button type="button" class="iv-btn iv-btn-ghost sm" onclick="setView('reportes', { rep: 'mermas' })">Reporte</button>`)}</div><div id="inicioMermas"></div></div>
                    <div class="iv-card p-3"><div class="flex items-center justify-between mb-2"><span class="iv-sec">Últimos movimientos</span>${btnIf(can('inv-kardex'), `<button type="button" class="iv-btn iv-btn-ghost sm" onclick="setView('movimientos')">Kárdex</button>`)}</div><div id="inicioMoves"></div></div>
                    ${tiles.length ? `<div class="iv-card p-3 xl:col-span-3"><span class="iv-sec">Accesos rápidos</span><div class="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-${Math.min(8, Math.max(4, tiles.length))} gap-2 mt-2">${tiles.map(([, i, t, s, fn]) => `<button type="button" class="iv-tile" onclick="${fn}"><span class="iv-m-ico sm iv-tone" style="${tone()}"><i data-lucide="${i}"></i></span><b>${t}</b><small>${s}</small></button>`).join('')}</div></div>` : ''}
                </div>
            </div>`;
        $id('view-inicio').querySelectorAll('[data-scope]').forEach(b => b.addEventListener('click', () => { f.scope = b.dataset.scope; this.mount(); icons(); }));
        this.paint();
    },
    paint() {
        const f = UI.f.inicio, scope = f.scope === 'all' ? 'all' : UI.branch;
        const whs = scopeWhs(scope), whIds = whs.map(w => w.id);
        const pairs = stockPairs(whs);
        const value = pairs.reduce((s, p) => s + Math.max(0, p.q) * p.it.cost, 0);
        const lots = liveLots(l => whIds.includes(l.warehouse_id) && daysFromToday(l.expires_at) <= 2).sort(byExpiry);
        const loss = DB.outflows.filter(o => o.status === 'applied' && reasonOf(o.outflow_reason_id).is_loss && inBranch(o.branch_id, scope) && o.operation_date >= monthStart());
        const lossCost = loss.reduce((s, o) => s + o.total_cost, 0);
        const costStock = canCost('inv-stock'), costOut = canCost('inv-salidas');
        $id('inicioKpis').innerHTML = [
            kpi({ icon: 'wallet', hex: '#C05A40', label: 'Valor del inventario', value: moneyK(value), hide: !costStock }),
            kpi({ icon: 'boxes', hex: '#0369A1', label: 'Con existencia', value: num(new Set(pairs.filter(p => p.q > 0).map(p => p.it.id)).size, 0) }),
            kpi({ icon: 'triangle-alert', hex: '#D97706', label: 'Stock bajo', value: num(pairs.filter(p => p.lv === 'low').length, 0) }),
            kpi({ icon: 'circle-x', hex: '#E11D48', label: 'Agotados', value: num(pairs.filter(p => p.lv === 'out').length, 0) }),
            kpi({ icon: 'calendar-clock', hex: '#B45309', label: 'Por caducar', value: num(lots.length, 0), sub: 'lotes ≤ 2 días' }),
            costOut ? kpi({ icon: 'trash-2', hex: '#E11D48', label: 'Merma del mes', value: money(lossCost) }) : kpi({ icon: 'trash-2', hex: '#E11D48', label: 'Mermas del mes', value: num(loss.length, 0) }),
        ].join('');
        const canDrop = can('inv-salidas', 'create') && roleReasons().some(x => x.code === 'CADUCIDAD');
        const canAsk = can('inv-requisiciones', 'create');

        // Atención: caducidades primero, luego agotados y bajos
        const alerts = [
            ...lots.map(l => { const it = itemOf(l.item_id), t = expiryTone(l.expires_at); return { hex: t.hex, icon: 'calendar-x', title: it.name, sub: `${t.label} · ${num(l.quantity)} ${unitCode(it)} · ${whName(l.warehouse_id)}${l.batch_code ? ` · lote ${l.batch_code}` : ''}`, btn: btnIf(canDrop, `<button type="button" class="iv-btn iv-btn-ghost danger sm" onclick="openDocForm('out', { loss: true, reason: 'CADUCIDAD', wh: ${l.warehouse_id}, lines: [[${it.id}, ${l.quantity}]] })"><i data-lucide="trash-2"></i>Dar de baja</button>`), open: `item:${it.id}` }; }),
            ...pairs.filter(p => p.lv === 'out' || p.lv === 'low').sort((a, b) => (a.lv === 'out' ? 0 : 1) - (b.lv === 'out' ? 0 : 1)).map(p => {
                const want = Math.max(1, round(maxOf(p.it, p.w.id) - p.q, 0));
                // En la Matriz se compra; en una sucursal (o la cocina de la Matriz) se pide
                const btn = p.w.branch_id === mainBranch().id && canBuy()
                    ? `<button type="button" class="iv-btn iv-btn-ghost sm" onclick="openDocForm('in', { origin: 'COMPRA', wh: ${p.w.id}, lines: [[${p.it.id}, ${want}]] })"><i data-lucide="shopping-bag"></i>Comprar</button>`
                    : btnIf(canAsk, `<button type="button" class="iv-btn iv-btn-ghost sm" onclick="openDocForm('req', { branch: ${p.w.branch_id}, lines: [[${p.it.id}, ${want}]] })"><i data-lucide="clipboard-list"></i>Pedir</button>`);
                return { hex: LEVEL[p.lv].hex, icon: LEVEL[p.lv].icon, title: p.it.name, sub: `${LEVEL[p.lv].label} · hay ${num(p.q)} de mín. ${num(minOf(p.it, p.w.id))} ${unitCode(p.it)} · ${p.w.name}`, open: `item:${p.it.id}`, btn };
            }),
        ];
        $id('inicioAlerts').innerHTML = alerts.length ? `<div class="divide-y">${alerts.slice(0, 9).map(a => `
            <div class="flex items-center gap-3 py-2"><span class="iv-m-ico sm iv-tone" style="${tone(a.hex)}"><i data-lucide="${a.icon}"></i></span>
            <button type="button" class="flex-1 min-w-0 text-left" onclick="openDrawer('${a.open.split(':')[0]}', ${a.open.split(':')[1]})"><div class="iv-name truncate">${esc(a.title)}</div><div class="iv-meta truncate">${esc(a.sub)}</div></button>${a.btn}</div>`).join('')}</div>
            ${alerts.length > 9 ? `<p class="iv-meta mt-2">Y ${alerts.length - 9} más en Stock.</p>` : ''}`
            : `<div class="iv-empty"><i data-lucide="party-popper" class="w-7 h-7"></i><b>Todo en orden</b><span>Sin caducidades ni faltantes.</span></div>`;

        // Pendientes de la sucursal
        // Pendientes: solo lo que este rol puede atender
        const pend = [
            ...(can('inv-entradas', 'update') && canProduce() ? DB.inflows.filter(i => i.status === 'pending' && inBranch(i.branch_id, scope)).map(i => ({ hex: '#C05A40', icon: 'chef-hat', title: `${i.folio} · Producción por confirmar`, sub: `${plural(i.total_products, 'producto', 'productos')} · ${num(i.total_units)} piezas · ${relDay(i.operation_date)}`, open: `in:${i.id}` })) : []),
            ...(can('inv-traspasos', 'update') ? DB.transfers.filter(t => trCode(t) === 'REQUESTED' && t.destination_branch_id === UI.branch).map(t => ({ hex: '#B45309', icon: 'truck', title: `${t.folio} · Traspaso por recibir`, sub: `De ${branchName(t.origin_branch_id)} · ${plural(t.total_products, 'producto', 'productos')}`, open: `tra:${t.id}` })) : []),
            ...(isMatriz() && can('inv-surtir', 'update') ? DB.requisitions.filter(r => r.source_branch_id === UI.branch && ['EN_ESPERA', 'SURTIDO_PARCIAL'].includes(reqCode(r))).map(r => ({ hex: '#0369A1', icon: 'clipboard-list', title: `${r.folio} · Por surtir`, sub: `${r.branch_id === UI.branch ? deptOf(r.department_id)?.name || 'Tu sucursal' : branchName(r.branch_id)} lo necesita ${relDay(r.needed_date).toLowerCase()} · ${plural(r.total_products, 'producto', 'productos')}`, open: `req:${r.id}` })) : []),
            ...(can('inv-requisiciones', 'update') ? DB.requisitions.filter(r => r.branch_id === UI.branch && reqCode(r) === 'ENTREGADO').map(r => ({ hex: '#047857', icon: 'package-check', title: `${r.folio} · Falta tu «Recibí»`, sub: `Surtida por ${branchName(r.source_branch_id)} ${relDay(r.approved_at).toLowerCase()}`, open: `req:${r.id}` })) : []),
            ...(can('inv-requisiciones') && !can('inv-surtir', 'update') ? DB.requisitions.filter(r => r.branch_id === UI.branch && ['EN_ESPERA', 'SURTIDO_PARCIAL'].includes(reqCode(r))).map(r => ({ hex: '#6B7280', icon: 'clock-3', title: `${r.folio} · ${rStatusOf(r.requisition_status_id).name}`, sub: `Esperando al almacén · lo necesitas ${relDay(r.needed_date).toLowerCase()}`, open: `req:${r.id}` })) : []),
            ...(can('inv-stock', 'update') ? DB.adjustments.filter(a => a.status === 'draft' && inBranch(a.branch_id, scope)).map(a => ({ hex: can('inv-stock', 'aplicar-ajuste') ? '#7C3AED' : '#6B7280', icon: 'clipboard-check', title: `${a.folio} · Conteo en borrador`, sub: `${whName(a.warehouse_id)} · ${a.total_counted} de ${a.total_products} contados${can('inv-stock', 'aplicar-ajuste') && a.total_counted ? ' · listo para aplicar' : ''}`, open: `adj:${a.id}` })) : []),
        ];
        $id('inicioPend').innerHTML = pend.length ? `<div class="divide-y">${pend.map(p => `<button type="button" class="w-full flex items-center gap-3 py-2 text-left hover:opacity-80" onclick="openDrawer('${p.open.split(':')[0]}', ${p.open.split(':')[1]})"><span class="iv-m-ico sm iv-tone" style="${tone(p.hex)}"><i data-lucide="${p.icon}"></i></span><div class="flex-1 min-w-0"><div class="iv-name truncate text-[12.5px]">${esc(p.title)}</div><div class="iv-meta truncate">${esc(p.sub)}</div></div><i data-lucide="chevron-right" class="w-4 h-4 text-gray-400"></i></button>`).join('')}</div>`
            : `<div class="iv-empty"><i data-lucide="check-check" class="w-7 h-7"></i><b>Sin pendientes</b></div>`;

        // Barras: entradas contra salidas en dinero, últimos 7 días
        const days = Array.from({ length: 7 }, (_, i) => dayISO(i - 6));
        // Sin «ver-costos» se cuentan unidades en vez de dinero
        const val = m => costStock ? Math.abs(m.total) : Math.abs(m.qty);
        const fmt = v => costStock ? money(v) : `${num(v)} u.`;
        const sums = days.map(d => {
            const ms = DB.moves.filter(m => m.at.slice(0, 10) === d && whIds.includes(m.warehouse_id));
            return { d, inn: ms.filter(m => m.qty > 0 && m.type !== 'AJUSTE').reduce((s, m) => s + val(m), 0), out: ms.filter(m => m.qty < 0 && m.type !== 'AJUSTE').reduce((s, m) => s + val(m), 0) };
        });
        const top = Math.max(1, ...sums.map(s => Math.max(s.inn, s.out)));
        const dn = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
        $id('inicioBars').innerHTML = `<div class="iv-bars mt-2">${sums.map(s => `<div><div class="flex items-end justify-center gap-[3px] w-full" style="height:100px"><span class="iv-bar" style="height:${s.inn / top * 100}%;--tone:#059669" title="Entradas ${fmt(s.inn)}"></span><span class="iv-bar" style="height:${s.out / top * 100}%;--tone:#C05A40" title="Salidas ${fmt(s.out)}"></span></div><small>${dn[parseISO(s.d).getDay()]} ${s.d.slice(8)}</small></div>`).join('')}</div>
            <div class="flex justify-between mt-2 text-[12px]"><span class="text-gray-500">Entraron <b class="iv-plus">${fmt(sums.reduce((s, x) => s + x.inn, 0))}</b></span><span class="text-gray-500">Salieron <b class="iv-minus">${fmt(sums.reduce((s, x) => s + x.out, 0))}</b></span></div>`;

        // Mermas por motivo (en dinero o en unidades)
        const byReason = {};
        loss.forEach(o => { byReason[o.outflow_reason_id] = (byReason[o.outflow_reason_id] || 0) + (costOut ? o.total_cost : o.total_units); });
        const rr = Object.entries(byReason).sort((a, b) => b[1] - a[1]);
        const tm = Math.max(1, ...rr.map(r => r[1]));
        $id('inicioMermas').innerHTML = rr.length ? `<div class="space-y-2">${rr.map(([id, v]) => { const r = reasonOf(id); return `<div class="iv-hbar"><span class="flex items-center gap-1.5"><i data-lucide="${r.icon}" class="w-3.5 h-3.5" style="color:${r.color_hex}"></i>${esc(r.name)}</span><span class="iv-progress"><span style="width:${v / tm * 100}%;--tone:${r.color_hex}"></span></span><span>${costOut ? money(v) : `${num(v)} u.`}</span></div>`; }).join('')}</div><p class="iv-meta mt-3">Merma = salida cuyo motivo cuenta como pérdida (Catálogo › Motivos de salida).</p>`
            : `<div class="iv-empty"><i data-lucide="sparkles" class="w-7 h-7"></i><b>Sin mermas este mes</b></div>`;

        // Últimos movimientos
        const ms = DB.moves.filter(m => whIds.includes(m.warehouse_id)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 7);
        $id('inicioMoves').innerHTML = ms.length ? `<div class="divide-y">${ms.map(m => { const it = itemOf(m.item_id), t = MOVE_TYPE[m.type]; return `<button type="button" class="w-full flex items-center gap-2.5 py-1.5 text-left" onclick="openDrawer('${m.doc.kind}', ${m.doc.id})"><span class="iv-m-ico sm iv-tone" style="${tone(t.hex)}"><i data-lucide="${m.qty >= 0 ? t.iconIn : t.iconOut}"></i></span><div class="flex-1 min-w-0"><div class="iv-name truncate text-[12.5px]">${esc(it.name)}</div><div class="iv-meta truncate">${esc(m.folio)} · ${esc(m.concept)} · ${relDay(m.at.slice(0, 10))} ${ftime(m.at)}</div></div><span class="text-[12.5px] whitespace-nowrap">${signed(m.qty)} <span class="iv-meta inline">${esc(unitCode(it))}</span></span></button>`; }).join('')}</div>`
            : `<div class="iv-empty"><b>Sin movimientos</b></div>`;
    },
};
const MOVE_TYPE = {
    ENTRADA: { label: 'Entrada', hex: '#059669', iconIn: 'arrow-down-to-line', iconOut: 'arrow-down-to-line' },
    SALIDA: { label: 'Salida', hex: '#C05A40', iconIn: 'arrow-up-from-line', iconOut: 'arrow-up-from-line' },
    TRANSFERENCIA: { label: 'Traspaso', hex: '#0369A1', iconIn: 'log-in', iconOut: 'log-out' },
    AJUSTE: { label: 'Ajuste', hex: '#7C3AED', iconIn: 'sliders-horizontal', iconOut: 'sliders-horizontal' },
};

// =====================================================================
// STOCK
// =====================================================================
VIEWS.stock = {
    mount(o = {}) {
        const f = UI.f.stock = Object.assign({ tab: 'actual', stBranch: String(UI.branch), stWh: 'all', stKind: 'all', stCat: 'all', stLevel: 'all', stQ: '', stWin: '2', stStatus: 'all' }, UI.f.stock || {}, o.f || {});
        const cats = [opt('all', 'Todas'), ...DB.posCategories.map(c => opt(`p${c.id}`, c.name)), ...DB.categories.filter(c => c.active).map(c => opt(`s${c.id}`, c.name))];
        const whs = [opt('all', 'Todos'), ...DB.warehouses.filter(w => w.active && inBranch(w.branch_id, f.stBranch)).map(w => opt(w.id, w.name))];
        const nLots = liveLots(l => inBranch(whOf(l.warehouse_id).branch_id, f.stBranch) && daysFromToday(l.expires_at) <= 2).length;
        const nCounts = DB.adjustments.filter(a => inBranch(a.branch_id, f.stBranch)).length;
        const tabs = `<div class="iv-tabs px-3 shrink-0">${[['actual', 'boxes', 'Stock actual', ''], ['caducar', 'calendar-clock', 'Por caducar', nLots], ['conteos', 'clipboard-check', 'Conteos físicos', nCounts]].map(([k, i, t, n]) => `<button type="button" class="iv-tab ${f.tab === k ? 'active' : ''}" data-tab="${k}"><i data-lucide="${i}"></i>${t}${n !== '' ? `<span class="iv-tab-n">${n}</span>` : ''}</button>`).join('')}</div>`;
        const filters = {
            actual: fSelect('stBranch', 'Sucursal', branchOpts(), f.stBranch) + fSelect('stWh', 'Almacén', whs, f.stWh) + fSelect('stKind', 'Tipo', [opt('all', 'Todos'), opt('supply', 'Insumos'), opt('product', 'Productos terminados')], f.stKind) + fSelect('stCat', 'Categoría', cats, f.stCat) + fSelect('stLevel', 'Nivel', [opt('all', 'Todos'), ...Object.entries(LEVEL).map(([k, v]) => opt(k, v.label))], f.stLevel, 'w-full sm:w-36') + fSearch('stQ', 'Artículo, SKU o sobrenombre', f.stQ),
            caducar: fSelect('stBranch', 'Sucursal', branchOpts(), f.stBranch) + fSelect('stKind', 'Tipo', [opt('all', 'Todos'), opt('supply', 'Insumos'), opt('product', 'Productos terminados')], f.stKind) + fSelect('stWin', 'Vence', [opt('0', 'Vencidos y hoy'), opt('2', 'En 2 días o menos'), opt('7', 'En 7 días o menos'), opt('all', 'Todos los lotes')], f.stWin) + fSearch('stQ', 'Artículo o lote', f.stQ),
            conteos: fSelect('stBranch', 'Sucursal', branchOpts(), f.stBranch) + fSelect('stStatus', 'Estado', [opt('all', 'Todos'), opt('draft', 'Borrador'), opt('applied', 'Aplicado'), opt('cancelled', 'Cancelado')], f.stStatus),
        }[f.tab];
        $id('view-stock').innerHTML = frame({
            id: 'stock', title: 'Stock', sub: `Existencias por almacén, lotes con caducidad y conteos físicos · <b>${esc(branchOf(UI.branch).short)}</b>`,
            actions: btnIf(can('inv-stock', 'update'), `<button type="button" class="iv-btn ${canBuy() ? 'iv-btn-ghost' : 'iv-btn-brand'}" onclick="openNewCount()"><i data-lucide="clipboard-check"></i>Conteo físico</button>`) + btnIf(canBuy(), `<button type="button" class="iv-btn iv-btn-brand" onclick="openDocForm('in')"><i data-lucide="package-plus"></i>Nueva entrada</button>`),
            kpis: ' ', tabs, filters,
        });
        $id('view-stock').querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { f.tab = b.dataset.tab; f.stQ = ''; this.mount(); icons(); }));
        bindFilters('stock', () => { if (document.activeElement?.id === 'stBranch') { f.stWh = 'all'; this.mount(); return; } this.paint(); });
        this.paint();
    },
    paint() {
        const f = UI.f.stock;
        if (f.tab === 'caducar') return this.paintLots();
        if (f.tab === 'conteos') return this.paintCounts();
        const whs = scopeWhs(f.stBranch).filter(w => f.stWh === 'all' || w.id === Number(f.stWh));
        const q = norm(f.stQ);
        const rows = [];
        DB.items.filter(it => it.active && it.is_inventoriable).forEach(it => {
            const here = whs.filter(w => stockRow(w.id, it.id));
            if (!here.length) return;
            if (f.stKind !== 'all' && it.kind !== f.stKind) return;
            if (f.stCat !== 'all' && (f.stCat[0] === 'p' ? `p${it.pos_category_id}` : `s${it.item_category_id}`) !== f.stCat) return;
            if (q && !norm(`${it.name} ${it.sku} ${it.description}`).includes(q)) return;
            const qty = round(here.reduce((s, w) => s + qtyIn(w.id, it.id), 0));
            const min = here.reduce((s, w) => s + minOf(it, w.id), 0), max = here.reduce((s, w) => s + maxOf(it, w.id), 0);
            const last = here.map(w => stockRow(w.id, it.id).last_movement_at).filter(Boolean).sort().pop();
            const lot = it.track_lots ? DB.lots.filter(l => here.some(w => w.id === l.warehouse_id) && l.item_id === it.id && l.quantity > 0 && l.expires_at).sort(byExpiry)[0] : null;
            rows.push({ it, qty, min, max, last, lot, lv: levelOf(qty, min, max), wh: here.length === 1 ? here[0] : null });
        });
        const count = lv => rows.filter(r => r.lv === lv).length;
        const value = rows.reduce((s, r) => s + Math.max(0, r.qty) * r.it.cost, 0);
        $id('stockKpis').innerHTML = [
            kpi({ icon: 'boxes', hex: '#C05A40', label: 'Artículos', value: num(rows.length, 0), key: 'all', active: f.stLevel === 'all' }),
            kpi({ icon: LEVEL.ok.icon, hex: LEVEL.ok.hex, label: 'OK', value: num(count('ok'), 0), key: 'ok', active: f.stLevel === 'ok' }),
            kpi({ icon: LEVEL.low.icon, hex: LEVEL.low.hex, label: 'Stock bajo', value: num(count('low'), 0), key: 'low', active: f.stLevel === 'low' }),
            kpi({ icon: LEVEL.out.icon, hex: LEVEL.out.hex, label: 'Agotados', value: num(count('out'), 0), key: 'out', active: f.stLevel === 'out' }),
            kpi({ icon: 'wallet', hex: '#0369A1', label: 'Valor del inventario', value: money(value), hide: !canCost('inv-stock') }),
        ].join('');
        $id('stockKpis').querySelectorAll('[data-kpi]').forEach(b => b.addEventListener('click', () => { f.stLevel = b.dataset.kpi; $id('stLevel').value = f.stLevel; this.paint(); icons(); }));
        const shown = rows.filter(r => f.stLevel === 'all' || r.lv === f.stLevel).sort((a, b) => a.it.name.localeCompare(b.it.name));
        $id('stockBody').innerHTML = table({
            rows: shown, rowAttr: r => `class="click" data-open="item:${r.it.id}"`,
            cols: [
                { label: 'Artículo', cell: r => itemCell(r.it, ` · ${r.it.kind === 'product' ? 'Producto' : 'Insumo'}`) },
                { label: 'Categoría', cell: r => `<span class="text-[12.5px]">${esc(catOf(r.it)?.name || '—')}</span>` },
                { label: 'Área', cell: r => `<span class="text-[12.5px] text-gray-500">${esc((r.wh ? areaIn(r.wh.id, r.it) : areaOf(r.it.warehouse_area_id))?.name || '—')}</span>` },
                { label: 'Existencia', cls: 'r', cell: r => r.qty < 0 ? `<span class="iv-minus">${num(r.qty)}</span> <span class="iv-meta inline">${esc(unitCode(r.it))}</span>` : qtyCell(r.qty, r.it) },
                { label: 'Mín / Máx', cls: 'r', cell: r => `<span class="tabular-nums text-[12.5px] text-gray-500">${num(r.min)} / ${r.max ? num(r.max) : '—'}</span>` },
                { label: 'Nivel', cell: r => `<div class="flex items-center gap-2"><span class="iv-level" style="${tone(LEVEL[r.lv].hex)}"><span style="width:${Math.min(100, r.max ? Math.max(0, r.qty) / r.max * 100 : (r.qty > 0 ? 100 : 0))}%"></span></span>${levelBadge(r.lv)}</div>` },
                { label: 'Últ. costo', cls: 'r', money: 1, cell: r => `<span class="tabular-nums">${money(r.it.cost)}</span>` },
                { label: 'Valor', cls: 'r', money: 1, cell: r => `<b class="tabular-nums">${money(Math.max(0, r.qty) * r.it.cost)}</b>` },
                { label: 'Caducidad', cell: r => r.lot ? badge(expiryTone(r.lot.expires_at).label, expiryTone(r.lot.expires_at).hex, 'calendar') : '<span class="iv-meta">—</span>' },
                { label: 'Últ. mov.', cell: r => `<span class="text-[12px] text-gray-500 whitespace-nowrap">${r.last ? `${relDay(r.last.slice(0, 10))} ${ftime(r.last)}` : '—'}</span>` },
            ],
            cost: canCost('inv-stock'), footLabel: plural(shown.length, 'artículo', 'artículos'),
            foot: `<td colspan="7">${plural(shown.length, 'artículo', 'artículos')}</td><td class="r">${money(shown.reduce((s, r) => s + Math.max(0, r.qty) * r.it.cost, 0))}</td><td colspan="2"></td>`,
        });
        markActiveRow();
    },
    paintLots() {
        const f = UI.f.stock, q = norm(f.stQ);
        const lots = liveLots(l => inBranch(whOf(l.warehouse_id).branch_id, f.stBranch))
            .filter(l => { const it = itemOf(l.item_id); return (f.stKind === 'all' || it.kind === f.stKind) && (f.stWin === 'all' || daysFromToday(l.expires_at) <= Number(f.stWin)) && (!q || norm(`${it.name} ${l.batch_code}`).includes(q)); })
            .sort(byExpiry);
        const val = l => l.quantity * itemOf(l.item_id).cost;
        $id('stockKpis').innerHTML = [
            kpi({ icon: 'calendar-x', hex: '#E11D48', label: 'Vencidos', value: num(lots.filter(l => daysFromToday(l.expires_at) < 0).length, 0) }),
            kpi({ icon: 'alarm-clock', hex: '#E11D48', label: 'Vencen hoy', value: num(lots.filter(l => daysFromToday(l.expires_at) === 0).length, 0) }),
            kpi({ icon: 'calendar-clock', hex: '#D97706', label: 'En 1 a 2 días', value: num(lots.filter(l => [1, 2].includes(daysFromToday(l.expires_at))).length, 0) }),
            kpi({ icon: 'layers', hex: '#0369A1', label: 'Lotes en la lista', value: num(lots.length, 0) }),
            kpi({ icon: 'wallet', hex: '#C05A40', label: 'Valor en riesgo', value: money(lots.reduce((s, l) => s + val(l), 0)), hide: !canCost('inv-stock') }),
        ].join('');
        const canMove = can('inv-traspasos', 'create'), canDrop = can('inv-salidas', 'create') && roleReasons().some(x => x.code === 'CADUCIDAD');
        $id('stockBody').innerHTML = table({
            rows: lots, empty: 'Ningún lote vence en ese plazo', rowAttr: l => `class="click" data-open="item:${l.item_id}"`,
            cols: [
                { label: 'Artículo', cell: l => itemCell(itemOf(l.item_id)) },
                { label: 'Almacén', cell: l => `<span class="text-[12.5px]">${esc(whName(l.warehouse_id))}</span>` },
                { label: 'Lote', cell: l => `<span class="iv-folio">${esc(l.batch_code || '—')}</span>` },
                { label: 'Queda', cls: 'r', cell: l => qtyCell(l.quantity, itemOf(l.item_id)) },
                { label: 'Producido', cell: l => `<span class="text-[12.5px] text-gray-500">${l.produced_at ? fdate(l.produced_at) : '—'}</span>` },
                { label: 'Caduca', cell: l => `<div class="flex items-center gap-2"><span class="text-[12.5px] tabular-nums">${fdate(l.expires_at)}</span>${badge(expiryTone(l.expires_at).label, expiryTone(l.expires_at).hex)}</div>` },
                { label: 'Valor', cls: 'r', money: 1, cell: l => `<span class="tabular-nums">${money(val(l))}</span>` },
                { label: '', cls: 'r', cell: l => `<div class="flex justify-end gap-1.5">${btnIf(canMove, `<button type="button" class="iv-btn iv-btn-ghost sm" title="Mandar a una sucursal que lo venda antes" onclick="openDocForm('tra', { wh: ${l.warehouse_id}, lines: [[${l.item_id}, ${l.quantity}]] })"><i data-lucide="arrow-right-left"></i></button>`)}${btnIf(canDrop, `<button type="button" class="iv-btn iv-btn-ghost danger sm" onclick="openDocForm('out', { loss: true, reason: 'CADUCIDAD', wh: ${l.warehouse_id}, lines: [[${l.item_id}, ${l.quantity}]] })"><i data-lucide="trash-2"></i>Dar de baja</button>`)}</div>` },
            ],
            cost: canCost('inv-stock'),
        });
        markActiveRow();
    },
    paintCounts() {
        const f = UI.f.stock;
        const rows = DB.adjustments.filter(a => inBranch(a.branch_id, f.stBranch) && (f.stStatus === 'all' || a.status === f.stStatus)).sort((a, b) => b.created_at.localeCompare(a.created_at));
        $id('stockKpis').innerHTML = [
            kpi({ icon: 'clipboard-check', hex: '#C05A40', label: 'Conteos', value: num(rows.length, 0) }),
            kpi({ icon: 'pencil-line', hex: '#D97706', label: 'En borrador', value: num(rows.filter(a => a.status === 'draft').length, 0) }),
            kpi({ icon: 'circle-check', hex: '#059669', label: 'Aplicados', value: num(rows.filter(a => a.status === 'applied').length, 0) }),
            kpi({ icon: 'scale', hex: '#7C3AED', label: 'Diferencias', value: num(rows.filter(a => a.status === 'applied').reduce((s, a) => s + a.total_differences, 0), 0) }),
            kpi({ icon: 'wallet', hex: '#E11D48', label: 'Dinero ajustado', value: money(rows.filter(a => a.status === 'applied').reduce((s, a) => s + a.total_diff_cost, 0)), hide: !canCost('inv-stock') }),
        ].join('');
        $id('stockBody').innerHTML = table({
            rows, empty: 'Sin conteos físicos', rowAttr: a => `class="click" data-open="adj:${a.id}"`,
            cols: [
                { label: 'Folio', cell: a => `<span class="iv-folio">${a.folio}</span>` },
                { label: 'Fecha', cell: a => `<div class="text-[12.5px]">${relDay(a.operation_date)}</div><div class="iv-meta">${ftime(a.created_at)}</div>` },
                { label: 'Almacén · Área', cell: a => `<div class="iv-name text-[12.5px]">${esc(whName(a.warehouse_id))}</div><div class="iv-meta">${esc(areaOf(a.warehouse_area_id)?.name || 'Todas las áreas')}</div>` },
                { label: 'Modo', cell: a => a.is_blind ? '<span class="iv-chip t-purple"><i data-lucide="eye-off"></i>A ciegas</span>' : '<span class="iv-chip t-gray"><i data-lucide="eye"></i>Con sistema</span>' },
                { label: 'Contados', cell: a => `<div class="flex items-center gap-2 min-w-[120px]"><span class="iv-progress flex-1"><span style="width:${a.total_products ? a.total_counted / a.total_products * 100 : 0}%"></span></span><span class="text-[12px] tabular-nums">${a.total_counted}/${a.total_products}</span></div>` },
                { label: 'Diferencias', cls: 'r', cell: a => `<span class="tabular-nums">${a.total_differences}</span>` },
                { label: 'Dinero', cls: 'r', money: 1, cell: a => signed(a.total_diff_cost, true) },
                { label: 'Estado', cell: a => countStatusBadge(a.status) },
                { label: 'Registró', cell: a => userCell(a.user_id, a.created_at) },
            ],
            cost: canCost('inv-stock'),
        });
        markActiveRow();
    },
};

// -- Visor del artículo --
DRAWERS.item = id => {
    const it = itemOf(id); if (!it) return null;
    const whs = DB.warehouses.filter(w => w.active && stockRow(w.id, it.id));
    const total = whs.reduce((s, w) => s + qtyIn(w.id, it.id), 0);
    const lots = DB.lots.filter(l => l.item_id === it.id && l.quantity > 0).sort(byExpiry);
    // Sin Kárdex solo ve los movimientos de sus sucursales
    const ms = DB.moves.filter(m => m.item_id === it.id && (can('inv-kardex') || myBranches().includes(m.branch_id))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
    const pres = presOfItem(it.id);
    const here = defaultWh(UI.branch)?.id;
    const cost = canCost('inv-stock');
    // Sin «ver-costos» solo se cuentan piezas: lo de la sucursal y lo de la empresa
    const boxes = cost ? [['En toda la empresa', `${num(total)} ${unitCode(it)}`], ['Último costo', money(it.cost)], ['Valor', money(Math.max(0, total) * it.cost)]]
        : [['En tu sucursal', `${num(qtyBranch(UI.branch, it.id))} ${unitCode(it)}`], ['En toda la empresa', `${num(total)} ${unitCode(it)}`], ['Mínimo', `${num(minOf(it, here))} ${unitCode(it)}`]];
    const body = `
        <div class="grid grid-cols-3 gap-2">${boxes.map(([k, v]) => `<div class="iv-box"><div class="iv-meta">${k}</div><div class="text-[15px] font-bold tabular-nums">${v}</div></div>`).join('')}</div>
        <div class="mt-4">${infoGrid([
            ['Tipo', it.kind === 'product' ? 'Producto terminado' : 'Insumo'], ['Categoría', esc(catOf(it)?.name || '—')],
            ['Unidad', `${esc(unitOf(it.unit_id)?.name || '—')} (${esc(unitCode(it))})`], ['Área sugerida', esc(areaOf(it.warehouse_area_id)?.name || '—')],
            ['Mínimo / Máximo', `${num(it.stock_min)} / ${it.stock_max ? num(it.stock_max) : 'sin máximo'}`], ['Vida útil', it.shelf_life_days ? `${it.shelf_life_days} días` : '—'],
            cost ? ['Costo promedio', money(it.average_cost)] : null, ['Lote y caducidad', it.track_lots ? 'Sí, se piden al entrar' : 'No'],
            it.kind === 'product' ? ['Precio en el POS', money(it.price)] : null, it.kind === 'product' ? ['Producto del POS', `#${it.product_id}`] : null,
            pres.length ? ['Presentaciones', pres.map(p => `${esc(p.name)} = ${num(p.factor)} ${esc(unitCode(it))}`).join('<br>')] : null,
        ])}</div>
        ${section('Existencias por almacén', table({ cls: 'compact', rows: whs, cols: [
            { label: 'Almacén', cell: w => `<div class="iv-name text-[12.5px]">${esc(w.name)}</div><div class="iv-meta">${esc(branchOf(w.branch_id).short)}${w.is_main ? ' · Matriz' : ''}</div>` },
            { label: 'Hay', cls: 'r', cell: w => qtyCell(qtyIn(w.id, it.id), it) },
            { label: 'Nivel', cell: w => levelBadge(levelOf(qtyIn(w.id, it.id), minOf(it, w.id), maxOf(it, w.id))) },
            { label: 'Últ. conteo', cell: w => `<span class="iv-meta">${stockRow(w.id, it.id).last_count_at ? fdate(stockRow(w.id, it.id).last_count_at) : '—'}</span>` },
        ] }))}
        ${it.track_lots ? section('Lotes vivos', lots.length ? table({ cls: 'compact', rows: lots, cols: [
            { label: 'Lote', cell: l => `<span class="iv-folio">${esc(l.batch_code || '—')}</span>` },
            { label: 'Almacén', cell: l => `<span class="text-[12px]">${esc(branchName(whOf(l.warehouse_id).branch_id))}</span>` },
            { label: 'Queda', cls: 'r', cell: l => `<span class="tabular-nums">${num(l.quantity)}</span>` },
            { label: 'Caduca', cell: l => l.expires_at ? badge(expiryTone(l.expires_at).label, expiryTone(l.expires_at).hex) : '—' },
        ] }) : '<p class="iv-meta">Sin lotes vivos.</p>') : ''}
        ${section('Últimos movimientos', ms.length ? `<div class="divide-y">${ms.map(m => `<button type="button" class="w-full flex items-center gap-2 py-1.5 text-left" onclick="openDrawer('${m.doc.kind}', ${m.doc.id})"><span class="iv-m-ico sm iv-tone" style="${tone(MOVE_TYPE[m.type].hex)}"><i data-lucide="${m.qty >= 0 ? MOVE_TYPE[m.type].iconIn : MOVE_TYPE[m.type].iconOut}"></i></span><div class="flex-1 min-w-0"><div class="text-[12.5px] font-semibold truncate">${esc(m.concept)} <span class="iv-folio ml-1">${esc(m.folio)}</span></div><div class="iv-meta">${esc(branchName(m.branch_id))} · ${relDay(m.at.slice(0, 10))} ${ftime(m.at)} · ${esc(userName(m.user_id))}</div></div><div class="text-right text-[12.5px]"><div>${signed(m.qty)}</div><div class="iv-meta">${chain(m.prev, m.post)}</div></div></button>`).join('')}</div>` : '<p class="iv-meta">Sin movimientos.</p>', btnIf(can('inv-kardex'), `<button type="button" class="iv-btn iv-btn-ghost sm" onclick="closeDrawer(); setView('movimientos', { f: { mvBranch: 'all', mvQ: ${JSON.stringify(it.name).replace(/"/g, '&quot;')} } })">Kárdex completo</button>`))}`;
    // Cada botón solo si el rol tiene la casilla (y el artículo cabe en lo que puede capturar)
    const produce = it.kind === 'product' && canProduce();
    const foot = [
        btnIf(canBuy() || produce, `<button type="button" class="iv-btn iv-btn-ghost sm" onclick="${produce && !canBuy() ? 'openDocForm(\'prod\', { lines: [[' + it.id + ', 1]] })' : `openDocForm('in', { lines: [[${it.id}, 1]] })`}"><i data-lucide="${produce && !canBuy() ? 'chef-hat' : 'package-plus'}"></i>${produce && !canBuy() ? 'Producir' : 'Entrada'}</button>`),
        btnIf(can('inv-salidas', 'create') && roleReasons().some(r => !r.is_loss), `<button type="button" class="iv-btn iv-btn-ghost sm" onclick="openDocForm('out', { lines: [[${it.id}, 1]] })"><i data-lucide="package-minus"></i>Salida</button>`),
        btnIf(can('inv-salidas', 'create') && roleReasons().some(r => r.is_loss), `<button type="button" class="iv-btn iv-btn-ghost danger sm" onclick="openDocForm('out', { loss: true, lines: [[${it.id}, 1]] })"><i data-lucide="trash-2"></i>Merma</button>`),
        btnIf(can('inv-traspasos', 'create'), `<button type="button" class="iv-btn iv-btn-ghost sm" onclick="openDocForm('tra', { lines: [[${it.id}, 1]] })"><i data-lucide="arrow-right-left"></i>Traspasar</button>`),
        btnIf(can('inv-requisiciones', 'create'), `<button type="button" class="iv-btn iv-btn-brand sm" onclick="openDocForm('req', { lines: [[${it.id}, ${Math.max(1, round(it.stock_max - qtyIn(here, it.id), 0))}]] })"><i data-lucide="clipboard-list"></i>Pedir</button>`),
    ].join('');
    return { icon: it.kind === 'product' ? 'cake' : (catOf(it)?.icon || 'package'), hex: catOf(it)?.color_hex, title: esc(it.name), sub: `${esc(it.sku)} · ${esc(catOf(it)?.name || '')} · ${it.kind === 'product' ? 'Producto terminado' : 'Insumo'}`, body, foot };
};

// -- Visor del conteo físico --
DRAWERS.adj = id => {
    const a = byId(DB.adjustments, id); if (!a) return null;
    const lines = a.status === 'draft' ? a.lines.filter(l => l.physical_quantity !== null) : a.lines.filter(l => l.difference !== 0);
    const body = `
        <div class="flex items-center gap-2 mb-3">${countStatusBadge(a.status)}${a.is_blind ? '<span class="iv-chip t-purple"><i data-lucide="eye-off"></i>A ciegas</span>' : ''}</div>
        ${infoGrid([['Almacén', esc(whName(a.warehouse_id))], ['Área', esc(areaOf(a.warehouse_area_id)?.name || 'Todas')], ['Fecha', fdate(a.operation_date)], ['Contados', `${a.total_counted} de ${a.total_products}`], ['Con diferencia', num(a.total_differences, 0)], canCost('inv-stock') ? ['Dinero', signed(a.total_diff_cost, true)] : null, ['Abrió', `${esc(userName(a.user_id))} · ${fstamp(a.created_at)}`], ['Aplicó', a.applied_at ? `${esc(userName(a.applied_user_id))} · ${fstamp(a.applied_at)}` : '—'], a.cancel_reason ? ['Canceló', `${esc(userName(a.cancelled_user_id))}: ${esc(a.cancel_reason)}`] : null])}
        ${a.status === 'draft' && !can('inv-stock', 'aplicar-ajuste') ? `<div class="iv-note mt-3"><i data-lucide="shield-check"></i><span>Cuando termines de contar, el Supervisor o la Dueña lo revisa y lo aplica (casilla «Aplicar ajuste»).</span></div>` : ''}
        ${a.status === 'applied' && canCancelCount(a) && can('inv-stock', 'cancel') ? `<div class="iv-note mt-3"><i data-lucide="info"></i><span>Se puede cancelar hasta 48 h después de aplicarlo: regresa la existencia y sale del kárdex.</span></div>` : ''}
        ${section(a.status === 'draft' ? 'Contados hasta ahora' : 'Renglones con diferencia', lines.length ? table({ cls: 'compact', rows: lines, cols: [
            { label: 'Artículo', cell: l => `<span class="text-[12.5px] font-semibold">${esc(itemOf(l.item_id).name)}</span>` },
            { label: 'Sistema', cls: 'r', cell: l => `<span class="tabular-nums">${num(l.system_quantity)}</span>` },
            { label: 'Físico', cls: 'r', cell: l => `<b class="tabular-nums">${num(l.physical_quantity)}</b>` },
            { label: 'Dif.', cls: 'r', cell: l => signed(l.difference) },
            { label: '$', cls: 'r', money: 1, cell: l => signed(l.cost_difference, true) },
        ], cost: canCost('inv-stock') }) : '<p class="iv-meta">Nada que mostrar todavía.</p>')}`;
    const foot = a.status === 'draft'
        ? btnIf(can('inv-stock', 'update'), `<button type="button" class="iv-btn iv-btn-ghost danger sm" onclick="discardCount(${a.id})"><i data-lucide="trash-2"></i>Descartar</button><button type="button" class="iv-btn iv-btn-brand sm" onclick="openCount(${a.id})"><i data-lucide="clipboard-pen"></i>${can('inv-stock', 'aplicar-ajuste') ? 'Revisar y aplicar' : 'Continuar conteo'}</button>`)
        : a.status === 'applied' && canCancelCount(a) && can('inv-stock', 'cancel') ? `<button type="button" class="iv-btn iv-btn-ghost danger sm" onclick="cancelCountUI(${a.id})"><i data-lucide="undo-2"></i>Cancelar ajuste</button>` : '';
    return { icon: 'clipboard-check', hex: '#7C3AED', title: `Conteo ${a.folio}`, sub: `${esc(branchOf(a.branch_id).name)} · ${relDay(a.operation_date)}`, body, foot };
};

// =====================================================================
// MOVIMIENTOS (kárdex = vista inventory_movement)
// =====================================================================
VIEWS.movimientos = {
    mount(o = {}) {
        const f = UI.f.movimientos = Object.assign({ mvBranch: String(UI.branch), mvWh: 'all', mvType: 'all', mvFrom: dayISO(-30), mvTo: dayISO(0), mvQ: '' }, UI.f.movimientos || {}, o.f || {});
        const whs = [opt('all', 'Todos'), ...DB.warehouses.filter(w => w.active && inBranch(w.branch_id, f.mvBranch)).map(w => opt(w.id, w.name))];
        $id('view-movimientos').innerHTML = frame({
            id: 'mov', title: 'Movimientos', sub: 'Kárdex: cada renglón de cada documento aplicado, con lo que había antes y lo que quedó',
            actions: btnIf(can('inv-kardex', 'print'), `<button type="button" class="iv-btn iv-btn-ghost" onclick="toast('En el módulo real se descarga el kárdex en .xlsx', 'info')"><i data-lucide="file-spreadsheet"></i>Excel</button>`),
            kpis: ' ',
            filters: fSelect('mvBranch', 'Sucursal', branchOpts(), f.mvBranch) + fSelect('mvWh', 'Almacén', whs, f.mvWh) + fSelect('mvType', 'Tipo', [opt('all', 'Todos'), ...Object.entries(MOVE_TYPE).map(([k, v]) => opt(k, v.label))], f.mvType, 'w-full sm:w-36') + fDate('mvFrom', 'Desde', f.mvFrom) + fDate('mvTo', 'Hasta', f.mvTo) + fSearch('mvQ', 'Artículo, folio o concepto', f.mvQ),
        });
        bindFilters('movimientos', () => { if (document.activeElement?.id === 'mvBranch') { f.mvWh = 'all'; this.mount(); return; } this.paint(); });
        this.paint();
    },
    paint() {
        const f = UI.f.movimientos, q = norm(f.mvQ);
        const rows = DB.moves.filter(m => inBranch(m.branch_id, f.mvBranch) && (f.mvWh === 'all' || m.warehouse_id === Number(f.mvWh)) && (f.mvType === 'all' || m.type === f.mvType) && inRange(m.at.slice(0, 10), f.mvFrom, f.mvTo) && (!q || norm(`${itemOf(m.item_id).name} ${m.folio} ${m.concept}`).includes(q)))
            .sort((a, b) => b.at.localeCompare(a.at) || b.uid.localeCompare(a.uid));
        const cost = canCost('inv-kardex');
        // Con «ver-costos» las tarjetas suman dinero; sin él, cuentan renglones
        const sum = (fn) => cost ? money(rows.filter(fn).reduce((s, m) => s + Math.abs(m.total), 0)) : num(rows.filter(fn).length, 0);
        $id('movKpis').innerHTML = [
            kpi({ icon: 'list', hex: '#C05A40', label: 'Movimientos', value: num(rows.length, 0) }),
            kpi({ icon: 'arrow-down-to-line', hex: '#059669', label: 'Entradas', value: sum(m => m.type === 'ENTRADA') }),
            kpi({ icon: 'arrow-up-from-line', hex: '#C05A40', label: 'Salidas', value: sum(m => m.type === 'SALIDA') }),
            kpi({ icon: 'arrow-right-left', hex: '#0369A1', label: 'Traspasos', value: sum(m => m.type === 'TRANSFERENCIA' && m.qty > 0) }),
            kpi({ icon: 'sliders-horizontal', hex: '#7C3AED', label: 'Ajustes', value: cost ? money(rows.filter(m => m.type === 'AJUSTE').reduce((s, m) => s + m.total, 0)) : num(rows.filter(m => m.type === 'AJUSTE').length, 0) }),
        ].join('');
        $id('movBody').innerHTML = table({
            rows: rows.slice(0, 400), rowAttr: m => `class="click" data-open="${m.doc.kind}:${m.doc.id}"`,
            cols: [
                { label: 'Fecha', cell: m => `<div class="text-[12.5px] whitespace-nowrap">${relDay(m.at.slice(0, 10))}</div><div class="iv-meta">${ftime(m.at)}</div>` },
                { label: 'Folio', cell: m => `<span class="iv-folio">${esc(m.folio)}</span>` },
                { label: 'Tipo', cell: m => badge(MOVE_TYPE[m.type].label, MOVE_TYPE[m.type].hex, m.qty >= 0 ? MOVE_TYPE[m.type].iconIn : MOVE_TYPE[m.type].iconOut) },
                { label: 'Concepto', cell: m => `<span class="text-[12.5px]">${esc(m.concept)}</span>` },
                { label: 'Artículo', cell: m => `<div class="iv-name text-[12.5px] max-w-[240px] truncate">${esc(itemOf(m.item_id).name)}</div><div class="iv-meta">${esc(itemOf(m.item_id).sku)}</div>` },
                { label: 'Cantidad', cls: 'r', cell: m => `${signed(m.qty)} <span class="iv-meta inline">${esc(unitCode(itemOf(m.item_id)))}</span>` },
                { label: 'Antes → Quedó', cls: 'r', cell: m => chain(m.prev, m.post) },
                { label: 'Costo u.', cls: 'r', money: 1, cell: m => `<span class="tabular-nums text-[12.5px]">${money(m.cost)}</span>` },
                { label: 'Importe', cls: 'r', money: 1, cell: m => signed(m.total, true) },
                { label: 'Almacén', cell: m => `<span class="text-[12px] text-gray-500">${esc(whName(m.warehouse_id))}</span>` },
                { label: 'Usuario', cell: m => `<span class="text-[12px]">${esc(userName(m.user_id))}</span>` },
            ],
            cost, footLabel: `${plural(rows.length, 'movimiento', 'movimientos')}${rows.length > 400 ? ' · se muestran los 400 más recientes' : ''}`,
            foot: `<td colspan="8">${plural(rows.length, 'movimiento', 'movimientos')}${rows.length > 400 ? ' · se muestran los 400 más recientes' : ''}</td><td class="r">${signed(rows.reduce((s, m) => s + m.total, 0), true)}</td><td colspan="2"></td>`,
        });
        markActiveRow();
    },
};

// =====================================================================
// REPORTES (vista previa en hoja carta horizontal; imprime solo la hoja)
// =====================================================================
const REPORTS = [
    { k: 'rapido', icon: 'clipboard-list', title: 'Inventario rápido', sub: 'Existencia inicial, entradas, salidas, teórico, físico y diferencia (formato de Soft).' },
    { k: 'valuacion', icon: 'wallet', title: 'Valuación del inventario', sub: 'Cuánto dinero hay en el almacén, por categoría.' },
    { k: 'mermas', icon: 'trash-2', title: 'Mermas', sub: 'Pérdidas por motivo y los productos que más se tiran.' },
    { k: 'consumo', icon: 'chef-hat', title: 'Consumo por departamento', sub: 'Qué insumos gasta cada departamento.' },
    { k: 'caducidad', icon: 'calendar-clock', title: 'Caducidades', sub: 'Lotes que vencen en los próximos 7 días.' },
];
VIEWS.reportes = {
    mount(o = {}) {
        const f = UI.f.reportes = Object.assign({ rep: 'rapido', rpBranch: String(UI.branch), rpPeriod: 'semana' }, UI.f.reportes || {}, o.rep ? { rep: o.rep } : {});
        $id('view-reportes').innerHTML = `
            <div class="iv-head shrink-0"><div><h1 class="iv-title">Reportes</h1><p class="iv-sub">Vista previa en hoja carta horizontal · imprime o descarga en Excel</p></div>
                <div class="flex flex-wrap items-end gap-2">${fSelect('rpBranch', 'Sucursal', branchOpts(), f.rpBranch)}${fSelect('rpPeriod', 'Periodo', [opt('semana', 'Últimos 7 días'), opt('mes', 'Este mes')], f.rpPeriod)}
                <button type="button" class="iv-btn iv-btn-ghost" onclick="toast('En el módulo real se descarga en .xlsx', 'info')"><i data-lucide="file-spreadsheet"></i>Excel</button><button type="button" class="iv-btn iv-btn-brand" onclick="window.print()"><i data-lucide="printer"></i>Imprimir</button></div></div>
            <div class="flex-1 min-h-0 flex flex-col lg:flex-row gap-3">
                <div class="iv-card p-2 lg:w-72 shrink-0 overflow-y-auto scrollbar-thin">${REPORTS.map(r => `<button type="button" class="iv-rep-item ${f.rep === r.k ? 'active' : ''}" data-rep="${r.k}"><span class="iv-m-ico sm iv-tone" style="${tone()}"><i data-lucide="${r.icon}"></i></span><span class="min-w-0"><span class="block iv-name text-[13px]">${r.title}</span><span class="block iv-meta">${r.sub}</span></span></button>`).join('')}</div>
                <div class="iv-card flex-1 min-h-0 overflow-auto scrollbar-thin p-4" style="background:var(--iv-sunken)"><div id="repSheet" class="iv-sheet"></div></div>
            </div>`;
        $id('view-reportes').querySelectorAll('[data-rep]').forEach(b => b.addEventListener('click', () => { f.rep = b.dataset.rep; this.mount(); icons(); }));
        bindFilters('reportes', () => this.paint());
        this.paint();
    },
    paint() {
        const f = UI.f.reportes;
        const from = f.rpPeriod === 'mes' ? monthStart() : dayISO(-6), to = dayISO(0);
        const rep = REPORTS.find(r => r.k === f.rep);
        const br = f.rpBranch === 'all' ? 'Todas las sucursales' : branchOf(f.rpBranch).name;
        const whIds = scopeWhs(f.rpBranch).map(w => w.id);
        const head = `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
            <div style="display:flex;gap:12px;align-items:center"><div style="width:42px;height:42px;border-radius:999px;background:#C05A40 !important;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px"><span style="color:#fff !important">R</span></div>
            <div><div style="font-size:15px;font-weight:800">${esc(DB.company.name)}</div><div>${esc(br)}</div></div></div>
            <div style="text-align:right"><div style="font-size:14px;font-weight:800;text-transform:uppercase">${rep.title}</div><div>Del ${fdate(from)} al ${fdate(to)}</div><div style="opacity:.7">Impreso ${fstamp(nowStamp())} · Hoja 1 de 1</div></div></div>`;
        const inPeriod = m => whIds.includes(m.warehouse_id) && inRange(m.at.slice(0, 10), from, to);
        let html = '';
        if (f.rep === 'rapido') {
            const groups = {};
            DB.items.filter(it => it.active).forEach(it => {
                if (!whIds.some(w => stockRow(w, it.id))) return;
                const ms = DB.moves.filter(m => m.item_id === it.id && inPeriod(m));
                const after = DB.moves.filter(m => m.item_id === it.id && whIds.includes(m.warehouse_id) && m.at.slice(0, 10) > to).reduce((s, m) => s + m.qty, 0);
                const now = whIds.reduce((s, w) => s + qtyIn(w, it.id), 0) - after;
                const inn = ms.filter(m => m.qty > 0 && m.type !== 'AJUSTE').reduce((s, m) => s + m.qty, 0);
                const out = ms.filter(m => m.qty < 0 && m.type !== 'AJUSTE').reduce((s, m) => s - m.qty, 0);
                const adj = ms.filter(m => m.type === 'AJUSTE').reduce((s, m) => s + m.qty, 0);
                const counted = DB.adjustments.some(a => a.status === 'applied' && whIds.includes(a.warehouse_id) && inRange(a.operation_date, from, to) && a.lines.some(l => l.item_id === it.id && l.physical_quantity !== null));
                const ini = round(now - inn + out - adj);
                const theo = round(ini + inn - out);
                const g = catOf(it)?.name || 'Sin categoría';
                (groups[g] = groups[g] || []).push({ it, ini, inn, out, theo, phys: counted ? round(theo + adj) : null, adj, now });
            });
            const dash = v => (v === null || Math.abs(v) < 0.0005) ? '-' : num(v);
            html = `<table><thead><tr><th>Clave</th><th>Descripción</th><th>Unidad</th><th class="r">Exist. inicial</th><th class="r">Entradas</th><th class="r">Salidas</th><th class="r">Teórico</th><th class="r">Físico</th><th class="r">Diferencia</th><th class="r">Costo</th><th class="r">Valor final</th></tr></thead><tbody>
                ${Object.entries(groups).sort().map(([g, rows]) => `<tr class="grp"><td colspan="11">${esc(g)}</td></tr>${rows.map(r => `<tr><td>${esc(r.it.sku)}</td><td>${esc(r.it.name)}</td><td>${esc(unitCode(r.it))}</td><td class="r">${dash(r.ini)}</td><td class="r">${dash(r.inn)}</td><td class="r">${dash(r.out)}</td><td class="r">${dash(r.theo)}</td><td class="r">${r.phys === null ? '-' : dash(r.phys)}</td><td class="r">${r.phys === null ? '-' : dash(r.adj)}</td><td class="r">${money(r.it.cost)}</td><td class="r">${money(Math.max(0, r.now) * r.it.cost)}</td></tr>`).join('')}`).join('')}
                </tbody></table><p style="margin-top:8px;opacity:.7">Teórico = inicial + entradas − salidas. Físico y diferencia solo si hubo conteo físico aplicado en el periodo; si no, «-».</p>`;
        } else if (f.rep === 'valuacion') {
            const g = {};
            DB.items.filter(it => it.active).forEach(it => { const q = whIds.reduce((s, w) => s + Math.max(0, qtyIn(w, it.id)), 0); if (!q) return; const c = catOf(it)?.name || 'Sin categoría'; g[c] = g[c] || { n: 0, v: 0, k: it.kind }; g[c].n++; g[c].v += q * it.cost; });
            const tot = Object.values(g).reduce((s, x) => s + x.v, 0) || 1;
            html = `<table><thead><tr><th>Categoría</th><th>Tipo</th><th class="r">Artículos</th><th class="r">Valor</th><th class="r">% del total</th></tr></thead><tbody>${Object.entries(g).sort((a, b) => b[1].v - a[1].v).map(([c, x]) => `<tr><td>${esc(c)}</td><td>${x.k === 'product' ? 'Producto terminado' : 'Insumo'}</td><td class="r">${x.n}</td><td class="r">${money(x.v)}</td><td class="r">${num(x.v / tot * 100, 1)} %</td></tr>`).join('')}<tr class="grp"><td colspan="3">Total</td><td class="r">${money(tot)}</td><td class="r">100 %</td></tr></tbody></table>`;
        } else if (f.rep === 'mermas') {
            const outs = DB.outflows.filter(o => o.status === 'applied' && whIds.includes(o.warehouse_id) && inRange(o.operation_date, from, to));
            const loss = outs.filter(o => reasonOf(o.outflow_reason_id).is_loss);
            const allOut = outs.reduce((s, o) => s + o.total_cost, 0) || 1;
            const byR = {}, byI = {};
            loss.forEach(o => { byR[o.outflow_reason_id] = (byR[o.outflow_reason_id] || 0) + o.total_cost; o.lines.forEach(l => { const x = byI[l.item_id] = byI[l.item_id] || { q: 0, v: 0 }; x.q += l.quantity; x.v += l.subtotal; }); });
            const tl = loss.reduce((s, o) => s + o.total_cost, 0);
            html = `<table><thead><tr><th>Motivo</th><th class="r">Documentos</th><th class="r">Pérdida</th><th class="r">% de todas las salidas</th></tr></thead><tbody>${Object.entries(byR).sort((a, b) => b[1] - a[1]).map(([r, v]) => `<tr><td>${esc(reasonOf(r).name)}</td><td class="r">${loss.filter(o => o.outflow_reason_id === Number(r)).length}</td><td class="r">${money(v)}</td><td class="r">${num(v / allOut * 100, 1)} %</td></tr>`).join('') || '<tr><td colspan="4">Sin mermas en el periodo</td></tr>'}<tr class="grp"><td colspan="2">Total de merma</td><td class="r">${money(tl)}</td><td class="r">${num(tl / allOut * 100, 1)} %</td></tr></tbody></table>
                <div style="height:14px"></div><table><thead><tr><th>Artículo</th><th class="r">Cantidad</th><th>Unidad</th><th class="r">Pérdida</th></tr></thead><tbody>${Object.entries(byI).sort((a, b) => b[1].v - a[1].v).slice(0, 15).map(([i, x]) => `<tr><td>${esc(itemOf(i).name)}</td><td class="r">${num(x.q)}</td><td>${esc(unitCode(itemOf(i)))}</td><td class="r">${money(x.v)}</td></tr>`).join('')}</tbody></table>
                <p style="margin-top:8px;opacity:.7">El «% de merma» se calcula contra todas las salidas del periodo (consumo, ventas, surtidos y mermas), no contra la venta.</p>`;
        } else if (f.rep === 'consumo') {
            const outs = DB.outflows.filter(o => o.status === 'applied' && o.department_id && whIds.includes(o.warehouse_id) && inRange(o.operation_date, from, to));
            const g = {};
            outs.forEach(o => { const x = g[o.department_id] = g[o.department_id] || { v: 0, n: 0, items: {} }; x.v += o.total_cost; x.n++; o.lines.forEach(l => { const y = x.items[l.item_id] = x.items[l.item_id] || { q: 0, v: 0 }; y.q += l.quantity; y.v += l.subtotal; }); });
            html = Object.keys(g).length ? `<table><thead><tr><th>Departamento / insumo</th><th class="r">Salidas</th><th class="r">Cantidad</th><th>Unidad</th><th class="r">Costo</th></tr></thead><tbody>${Object.entries(g).sort((a, b) => b[1].v - a[1].v).map(([d, x]) => `<tr class="grp"><td>${esc(deptOf(d).name)}</td><td class="r">${x.n}</td><td></td><td></td><td class="r">${money(x.v)}</td></tr>${Object.entries(x.items).sort((a, b) => b[1].v - a[1].v).map(([i, y]) => `<tr><td style="padding-left:18px">${esc(itemOf(i).name)}</td><td></td><td class="r">${num(y.q)}</td><td>${esc(unitCode(itemOf(i)))}</td><td class="r">${money(y.v)}</td></tr>`).join('')}`).join('')}</tbody></table>` : '<p>Sin consumo de departamentos en el periodo.</p>';
        } else {
            const lots = liveLots(l => whIds.includes(l.warehouse_id) && daysFromToday(l.expires_at) <= 7).sort(byExpiry);
            html = `<table><thead><tr><th>Caduca</th><th>Estado</th><th>Artículo</th><th>Almacén</th><th>Lote</th><th class="r">Queda</th><th>Unidad</th><th class="r">Valor</th></tr></thead><tbody>${lots.map(l => `<tr><td>${fdate(l.expires_at)}</td><td>${expiryTone(l.expires_at).label}</td><td>${esc(itemOf(l.item_id).name)}</td><td>${esc(whName(l.warehouse_id))}</td><td>${esc(l.batch_code || '-')}</td><td class="r">${num(l.quantity)}</td><td>${esc(unitCode(itemOf(l.item_id)))}</td><td class="r">${money(l.quantity * itemOf(l.item_id).cost)}</td></tr>`).join('') || '<tr><td colspan="8">Ningún lote vence en 7 días</td></tr>'}</tbody></table>`;
        }
        $id('repSheet').innerHTML = head + html;
    },
};
