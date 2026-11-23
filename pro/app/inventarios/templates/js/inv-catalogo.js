// Inventarios (Huubie PRO) · Catálogo: 12 pestañas con un solo motor de tabla + formulario.
// Artículos (insumos y productos del POS), presentaciones, categorías, unidades, almacenes, áreas,
// proveedores, departamentos, tipos de entrada, motivos de salida, motivos de ajuste y estados.

const colorDot = hex => hex ? `<span class="inline-flex items-center gap-1.5 text-[12px]"><span class="w-3.5 h-3.5 rounded" style="background:${hex}"></span>${esc(hex)}</span>` : '<span class="iv-meta">Color del tema</span>';
const iconCell = (icon, hex) => `<span class="iv-m-ico sm iv-tone" style="${tone(hex)}"><i data-lucide="${icon || 'square'}"></i></span>`;
const yes = v => v ? '<span class="iv-chip t-green"><i data-lucide="check"></i>Sí</span>' : '<span class="iv-meta">No</span>';
const activeChip = r => r.active ? badge('Activo', '#059669') : badge('Inactivo', '#6B7280');
const sysChip = r => r.is_system ? ' <span class="iv-chip sq t-gray" title="Lo usa el sistema: no sale al capturar">Sistema</span>' : '';
const ICONS = ['package', 'wheat', 'milk', 'snowflake', 'cherry', 'sparkles', 'cake', 'cake-slice', 'croissant', 'cookie', 'ice-cream-cone', 'sandwich', 'cup-soda', 'store', 'truck', 'chef-hat', 'shopping-bag', 'shopping-basket', 'trash-2', 'calendar-x', 'package-x', 'flame', 'shield-alert', 'utensils', 'spray-can', 'wine', 'flag', 'undo-2', 'sticky-note', 'clipboard-check', 'circle-check', 'circle-x', 'clock-3', 'send', 'ban', 'boxes', 'tag'];
const COLORS = ['#C05A40', '#B45309', '#D97706', '#059669', '#047857', '#0D9488', '#0891B2', '#0369A1', '#7C3AED', '#DB2777', '#E11D48', '#4B5563'];
const usesUnit = id => DB.items.some(i => i.active && i.unit_id === id) || DB.presentations.some(p => p.active && p.unit_id === id);

const CAT = {
    items: {
        t: 'Artículos', icon: 'package', newLabel: 'Nuevo artículo', arr: () => DB.items,
        sub: 'Insumos (harina, domos, cajas) y productos terminados del POS (pasteles, postres). Solo el producto del POS con «Inventario» activo aparece aquí.',
        filters: f => fSelect('caKind', 'Tipo', [opt('all', 'Todos'), opt('supply', 'Insumos'), opt('product', 'Productos terminados')], f.caKind) + fSelect('caCat', 'Categoría', [opt('all', 'Todas'), ...DB.posCategories.map(c => opt(`p${c.id}`, c.name)), ...DB.categories.filter(c => c.active).map(c => opt(`s${c.id}`, c.name))], f.caCat),
        match: (r, f) => (f.caKind === 'all' || r.kind === f.caKind) && (f.caCat === 'all' || (f.caCat[0] === 'p' ? `p${r.pos_category_id}` : `s${r.item_category_id}`) === f.caCat),
        text: r => `${r.name} ${r.sku} ${r.description}`,
        cols: [
            { label: 'Artículo', cell: r => itemCell(r, r.description ? ` · ${esc(r.description)}` : '') },
            { label: 'Tipo', cell: r => kindChip(r) },
            { label: 'Categoría', cell: r => `<span class="text-[12.5px]">${esc(catOf(r)?.name || '—')}</span>` },
            { label: 'Unidad', cell: r => `<span class="text-[12.5px]">${esc(unitCode(r))}</span>` },
            { label: 'Área', cell: r => `<span class="text-[12.5px] text-gray-500">${esc(areaOf(r.warehouse_area_id)?.name || '—')}</span>` },
            { label: 'Últ. costo', cls: 'r', money: 1, cell: r => `<span class="tabular-nums">${money(r.cost)}</span>` },
            { label: 'Precio POS', cls: 'r', cell: r => r.kind === 'product' ? `<span class="tabular-nums">${money(r.price)}</span>` : '<span class="iv-meta">—</span>' },
            { label: 'Mín / Máx', cls: 'r', cell: r => `<span class="tabular-nums text-[12.5px]">${num(r.stock_min)} / ${r.stock_max ? num(r.stock_max) : '—'}</span>` },
            { label: 'Vida útil', cls: 'r', cell: r => r.shelf_life_days ? `<span class="tabular-nums">${r.shelf_life_days} d</span>` : '<span class="iv-meta">—</span>' },
            { label: 'Lotes', cls: 'c', cell: r => r.track_lots ? '<i data-lucide="calendar-check" class="w-4 h-4 inline" style="color:#059669" title="Pide lote y caducidad"></i>' : '<span class="iv-meta">—</span>' },
            { label: 'Present.', cls: 'c', cell: r => { const n = presOfItem(r.id).length; return n ? `<span class="iv-chip t-sky">${n}</span>` : '<span class="iv-meta">—</span>'; } },
        ],
        fields: [
            { k: 'kind', label: 'Tipo', type: 'select', req: 1, opts: () => [opt('supply', 'Insumo'), opt('product', 'Producto terminado (del POS)')], newOnly: 1 },
            { k: 'product_id', label: 'Producto del POS', type: 'select', req: 1, show: v => v.kind === 'product' && !v.id, opts: () => [opt('', 'Elige…'), ...DB.posFree.map(p => opt(p.id, `${p.name} · ${money(p.price)}`))], hint: 'Los que en Catálogo del POS tienen «Inventario» y aún no están aquí.' },
            { k: 'name', label: 'Nombre', req: 1, w: 'col-span-2' },
            { k: 'sku', label: 'SKU', hint: 'Vacío = se arma con la categoría (01043)' },
            { k: 'barcode', label: 'Código de barras' },
            { k: 'item_category_id', label: 'Categoría', type: 'select', show: v => v.kind !== 'product', opts: () => [opt('', 'Sin categoría'), ...DB.categories.filter(c => c.active).map(c => opt(c.id, c.name))] },
            { k: 'pos_category_id', label: 'Categoría (POS)', type: 'select', show: v => v.kind === 'product', ro: 1, opts: () => DB.posCategories.map(c => opt(c.id, c.name)), hint: 'Se cambia en el Catálogo del POS' },
            { k: 'unit_id', label: 'Unidad', type: 'select', req: 1, opts: () => DB.units.filter(u => u.active).map(u => opt(u.id, `${u.code} · ${u.name}`)) },
            { k: 'warehouse_area_id', label: 'Área donde se guarda', type: 'select', opts: () => [opt('', 'Sin área'), ...DB.areas.filter(a => a.warehouse_id === mainWh().id).map(a => opt(a.id, a.name))] },
            { k: 'cost', label: 'Último costo sin IVA', type: 'number', hint: 'Lo actualiza cada entrada de compra' },
            { k: 'cost_tax', label: 'IVA del costo', type: 'select', opts: () => [opt(0, '0 %'), opt(8, '8 %'), opt(16, '16 %')] },
            { k: 'stock_min', label: 'Mínimo', type: 'number', hint: 'Debajo de esto sale «Stock bajo»' },
            { k: 'stock_max', label: 'Máximo', type: 'number', hint: '0 = sin máximo' },
            { k: 'shelf_life_days', label: 'Vida útil (días)', type: 'number', hint: 'Tres leches 5, galletas 30' },
            { k: 'track_lots', label: 'Pide lote y caducidad al entrar', type: 'check' },
            { k: 'is_inventoriable', label: 'Lleva existencia', type: 'check', hint: 'Apagado = solo se pide, no se cuenta' },
            { k: 'description', label: 'Sobrenombres (el buscador también los lee)', type: 'textarea', w: 'col-span-2' },
        ],
        blank: () => ({ kind: 'supply', name: '', sku: '', barcode: '', description: '', cost: 0, cost_tax: 0, stock_min: 0, stock_max: 0, shelf_life_days: '', track_lots: 0, is_inventoriable: 1, item_category_id: '', unit_id: 1, warehouse_area_id: '', product_id: '', active: 1 }),
        onField: (v, k) => { if (k === 'product_id' && v.product_id) { const p = DB.posFree.find(x => x.id === Number(v.product_id)); Object.assign(v, { name: p.name, pos_category_id: p.category_id, price: p.price, track_lots: 1 }); } if (k === 'kind' && v.kind === 'product') Object.assign(v, { unit_id: 1, track_lots: 1, item_category_id: '' }); },
        save: v => {
            if (DB.items.some(i => i.id !== v.id && norm(i.name) === norm(v.name))) return 'Ya hay un artículo con ese nombre.';
            if (!v.sku) v.sku = v.kind === 'product' ? `PT${String(v.product_id).padStart(4, '0')}` : `${String(v.item_category_id || 0).padStart(2, '0')}${String(DB.items.length + 1).padStart(3, '0')}`;
            ['cost', 'cost_tax', 'stock_min', 'stock_max'].forEach(k => { v[k] = Number(v[k]) || 0; });
            v.shelf_life_days = Number(v.shelf_life_days) || null;
            ['item_category_id', 'unit_id', 'warehouse_area_id', 'product_id', 'pos_category_id'].forEach(k => { v[k] = Number(v[k]) || null; });
            if (!v.id) { v.average_cost = v.cost; v.branch_id = mainBranch().id; if (v.kind === 'product') DB.posFree = DB.posFree.filter(p => p.id !== v.product_id); }
        },
    },
    pres: {
        t: 'Presentaciones', icon: 'boxes', newLabel: 'Nueva presentación', arr: () => DB.presentations,
        sub: 'Cómo se compra: «Bulto 25 kg», «Caja master 12». Al capturar se convierte a la unidad del artículo; el stock vive en el artículo base.',
        text: r => `${r.name} ${itemOf(r.item_id)?.name} ${r.sku}`,
        cols: [
            { label: 'Presentación', cell: r => `<div class="iv-name">${esc(r.name)}</div><div class="iv-meta">${esc(r.sku || '')}</div>` },
            { label: 'Artículo base', cell: r => `<span class="text-[12.5px]">${esc(itemOf(r.item_id).name)}</span>` },
            { label: 'Equivale a', cell: r => `<span class="iv-chip t-sky">= ${num(r.factor)} ${esc(unitCode(itemOf(r.item_id)))}</span>` },
            { label: 'Costo', cls: 'r', money: 1, cell: r => `<span class="tabular-nums">${money(r.cost)}</span>` },
            { label: 'Costo por unidad', cls: 'r', money: 1, cell: r => `<span class="tabular-nums text-gray-500">${money(r.cost / r.factor)}</span>` },
        ],
        fields: [
            { k: 'item_id', label: 'Artículo base', type: 'select', req: 1, w: 'col-span-2', opts: () => [opt('', 'Elige…'), ...DB.items.filter(i => i.active && i.kind === 'supply').map(i => opt(i.id, `${i.name} (${unitCode(i)})`))] },
            { k: 'name', label: 'Nombre', req: 1 }, { k: 'sku', label: 'SKU' },
            { k: 'factor', label: 'Cuántas unidades trae', type: 'number', req: 1, hint: 'Con 1 sería el artículo base' }, { k: 'cost', label: 'Costo de la presentación', type: 'number' },
            { k: 'unit_id', label: 'Unidad de la presentación', type: 'select', opts: () => [opt('', '—'), ...DB.units.filter(u => u.active).map(u => opt(u.id, `${u.code} · ${u.name}`))] },
        ],
        blank: () => ({ item_id: '', name: '', sku: '', factor: '', cost: '', unit_id: 6, active: 1 }),
        save: v => { v.factor = Number(v.factor); v.cost = Number(v.cost) || 0; v.item_id = Number(v.item_id); v.unit_id = Number(v.unit_id) || null; if (!(v.factor >= 2)) return 'Una presentación trae al menos 2 unidades del base.'; if (!v.cost) v.cost = round(v.factor * itemOf(v.item_id).cost, 2); },
    },
    categories: {
        t: 'Categorías', icon: 'tags', newLabel: 'Nueva categoría', arr: () => DB.categories, sub: 'Qué es el insumo (Abarrotes, Lácteos, Domos). El lugar donde se guarda va en Áreas.',
        text: r => r.name,
        cols: [{ label: '', cell: r => iconCell(r.icon, r.color_hex) }, { label: 'Categoría', cell: r => `<span class="iv-name">${esc(r.name)}</span>` }, { label: 'Artículos', cls: 'r', cell: r => `<span class="tabular-nums">${DB.items.filter(i => i.active && i.item_category_id === r.id).length}</span>` }, { label: 'Color', cell: r => colorDot(r.color_hex) }],
        fields: [{ k: 'name', label: 'Nombre', req: 1, w: 'col-span-2' }, { k: 'icon', label: 'Ícono', type: 'icon' }, { k: 'color_hex', label: 'Color', type: 'color' }],
        blank: () => ({ name: '', icon: 'package', color_hex: '#C05A40', branch_id: null, active: 1 }),
    },
    units: {
        t: 'Unidades', icon: 'ruler', newLabel: 'Nueva unidad', arr: () => DB.units, sub: 'Una unidad que usa algún artículo no se puede desactivar.',
        text: r => `${r.code} ${r.name}`,
        cols: [{ label: 'Clave', cell: r => `<span class="iv-folio">${esc(r.code)}</span>` }, { label: 'Nombre', cell: r => `<span class="iv-name">${esc(r.name)}</span>` }, { label: 'Decimales', cell: r => yes(r.allows_decimals) }, { label: 'En uso', cls: 'r', cell: r => `<span class="tabular-nums">${DB.items.filter(i => i.active && i.unit_id === r.id).length}</span>` }],
        fields: [{ k: 'code', label: 'Clave', req: 1 }, { k: 'name', label: 'Nombre', req: 1 }, { k: 'allows_decimals', label: 'Acepta decimales (kilo, litro)', type: 'check', w: 'col-span-2' }],
        blank: () => ({ code: '', name: '', allows_decimals: 0, active: 1 }),
        save: v => { v.code = v.code.toUpperCase().trim(); if (DB.units.some(u => u.id !== v.id && u.code === v.code)) return 'Ya existe esa clave.'; },
        canOff: r => usesUnit(r.id) ? 'Está en uso por algún artículo o presentación.' : '',
    },
    warehouses: {
        t: 'Almacenes', icon: 'warehouse', newLabel: 'Nuevo almacén', arr: () => DB.warehouses, sub: 'Uno principal por empresa (la Matriz: ahí se piden las requisiciones) y uno predeterminado por sucursal.',
        text: r => `${r.name} ${branchOf(r.branch_id).name}`,
        cols: [
            { label: 'Almacén', cell: r => `<div class="iv-name">${esc(r.name)}</div><div class="iv-meta">${esc(branchOf(r.branch_id).name)}</div>` },
            { label: 'Principal', cell: r => r.is_main ? '<span class="iv-chip t-brand"><i data-lucide="building-2"></i>Matriz</span>' : '<span class="iv-meta">—</span>' },
            { label: 'Predeterminado', cell: r => yes(r.is_default) },
            { label: 'Surtir mueve inventario', cell: r => yes(r.supply_moves_stock) },
            { label: 'Áreas', cls: 'r', cell: r => `<span class="tabular-nums">${DB.areas.filter(a => a.warehouse_id === r.id && a.active).length}</span>` },
            { label: 'Artículos con stock', cls: 'r', cell: r => `<span class="tabular-nums">${DB.items.filter(i => qtyIn(r.id, i.id) > 0).length}</span>` },
        ],
        fields: [
            { k: 'name', label: 'Nombre', req: 1, w: 'col-span-2' }, { k: 'branch_id', label: 'Sucursal', type: 'select', req: 1, opts: () => DB.branches.map(b => opt(b.id, b.name)) },
            { k: 'is_main', label: 'Almacén principal (Matriz)', type: 'check' }, { k: 'is_default', label: 'Predeterminado de la sucursal', type: 'check' },
            { k: 'supply_moves_stock', label: 'Surtir requisiciones de otra sucursal mueve inventario', type: 'check', w: 'col-span-2' },
        ],
        blank: () => ({ name: '', branch_id: UI.branch, is_main: 0, is_default: 0, supply_moves_stock: 1, active: 1 }),
        save: v => {
            v.branch_id = Number(v.branch_id);
            if (v.is_main) DB.warehouses.forEach(w => { if (w.id !== v.id) w.is_main = 0; });
            if (v.is_default) DB.warehouses.forEach(w => { if (w.id !== v.id && w.branch_id === v.branch_id) w.is_default = 0; });
            if (!v.id) ['Anaquel secos', 'Refrigerador', 'Vitrina'].forEach(n => DB.areas.push({ id: nextId('area') + 100, name: n, warehouse_id: null, color_hex: '#4B5563', active: 1, _new: 1 }));
        },
        after: v => DB.areas.filter(a => a._new).forEach(a => { a.warehouse_id = v.id; delete a._new; }),
        canOff: r => r.is_main ? 'Es el almacén principal: marca otro antes.' : DB.items.some(i => qtyIn(r.id, i.id) > 0) ? 'Todavía tiene existencias: traspásalas antes.' : '',
    },
    areas: {
        t: 'Áreas', icon: 'map-pin', newLabel: 'Nueva área', arr: () => DB.areas, sub: 'Dónde está dentro del almacén (Refrigerador, Anaquel 1). El conteo físico se puede hacer por área.',
        filters: f => fSelect('caWh', 'Almacén', [opt('all', 'Todos'), ...DB.warehouses.filter(w => w.active).map(w => opt(w.id, w.name))], f.caWh),
        match: (r, f) => !f.caWh || f.caWh === 'all' || r.warehouse_id === Number(f.caWh),
        text: r => `${r.name} ${whName(r.warehouse_id)}`,
        cols: [{ label: 'Área', cell: r => `<div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full" style="background:${r.color_hex}"></span><span class="iv-name">${esc(r.name)}</span></div>` }, { label: 'Almacén', cell: r => `<span class="text-[12.5px]">${esc(whName(r.warehouse_id))}</span>` }, { label: 'Artículos', cls: 'r', cell: r => `<span class="tabular-nums">${DB.items.filter(i => i.active && areaIn(r.warehouse_id, i)?.id === r.id && stockRow(r.warehouse_id, i.id)).length}</span>` }],
        fields: [{ k: 'warehouse_id', label: 'Almacén', type: 'select', req: 1, opts: () => DB.warehouses.filter(w => w.active).map(w => opt(w.id, w.name)) }, { k: 'name', label: 'Nombre', req: 1 }, { k: 'description', label: 'Descripción', w: 'col-span-2' }, { k: 'color_hex', label: 'Color', type: 'color' }],
        blank: () => ({ warehouse_id: myWh()?.id, name: '', description: '', color_hex: '#4B5563', active: 1 }),
        save: v => { v.warehouse_id = Number(v.warehouse_id); },
    },
    suppliers: {
        t: 'Proveedores', icon: 'truck', newLabel: 'Nuevo proveedor', arr: () => DB.suppliers, sub: 'Los pide el tipo de entrada «Compra».',
        text: r => `${r.name} ${r.contact_name} ${r.phone} ${r.rfc}`,
        cols: [{ label: 'Proveedor', cell: r => `<div class="iv-name">${esc(r.name)}</div><div class="iv-meta">${esc(r.rfc || 'Sin RFC')}</div>` }, { label: 'Contacto', cell: r => `<span class="text-[12.5px]">${esc(r.contact_name || '—')}</span>` }, { label: 'Teléfono', cell: r => `<span class="tabular-nums text-[12.5px]">${esc(r.phone || '—')}</span>` }, { label: 'Correo', cell: r => `<span class="text-[12.5px]">${esc(r.email || '—')}</span>` }, { label: 'Entradas', cls: 'r', cell: r => `<span class="tabular-nums">${DB.inflows.filter(i => i.supplier_id === r.id && i.status === 'applied').length}</span>` }],
        fields: [{ k: 'name', label: 'Nombre', req: 1, w: 'col-span-2' }, { k: 'contact_name', label: 'Contacto' }, { k: 'phone', label: 'Teléfono (10 dígitos)' }, { k: 'email', label: 'Correo' }, { k: 'rfc', label: 'RFC' }, { k: 'note', label: 'Nota', type: 'textarea', w: 'col-span-2' }],
        blank: () => ({ name: '', contact_name: '', phone: '', email: '', rfc: '', note: '', branch_id: null, active: 1 }),
        save: v => { v.phone = String(v.phone || '').replace(/\D/g, ''); if (v.phone && v.phone.length !== 10) return 'El teléfono lleva 10 dígitos.'; },
    },
    departments: {
        t: 'Departamentos', icon: 'users', newLabel: 'Nuevo departamento', arr: () => DB.departments, sub: 'Quién consume las salidas y quién pide en las requisiciones.',
        text: r => r.name,
        cols: [{ label: '', cell: r => iconCell(r.icon, r.color_hex) }, { label: 'Departamento', cell: r => `<span class="iv-name">${esc(r.name)}</span>` }, { label: 'Consumo del mes', cls: 'r', money: 1, cell: r => `<span class="tabular-nums">${money(DB.outflows.filter(o => o.status === 'applied' && o.department_id === r.id && o.operation_date >= dayISO(0).slice(0, 8) + '01').reduce((s, o) => s + o.total_cost, 0))}</span>` }],
        fields: [{ k: 'name', label: 'Nombre', req: 1, w: 'col-span-2' }, { k: 'icon', label: 'Ícono', type: 'icon' }, { k: 'color_hex', label: 'Color', type: 'color' }],
        blank: () => ({ name: '', icon: 'users', color_hex: '#4B5563', active: 1 }),
    },
    origins: {
        t: 'Tipos de entrada', icon: 'log-in', newLabel: 'Nuevo tipo', arr: () => DB.origins, sub: 'Cómo entra la mercancía. «Producción» nace pendiente y suma al confirmarla.',
        text: r => `${r.code} ${r.name} ${r.description}`,
        cols: [{ label: '', cell: r => iconCell(r.icon, r.color_hex) }, { label: 'Tipo', cell: r => `<div class="iv-name">${esc(r.name)}${sysChip(r)}</div><div class="iv-meta max-w-[360px] truncate">${esc(r.description)}</div>` }, { label: 'Clave', cell: r => `<span class="iv-folio">${esc(r.code)}</span>` }, { label: 'Pide proveedor', cell: r => yes(r.requires_supplier) }, { label: 'Cambia el costo', cell: r => yes(r.updates_cost) }, { label: 'Nace pendiente', cell: r => yes(r.starts_pending) }],
        fields: [{ k: 'code', label: 'Clave', req: 1, roEdit: 1 }, { k: 'name', label: 'Nombre', req: 1 }, { k: 'description', label: 'Descripción (sale debajo al capturar)', type: 'textarea', w: 'col-span-2' }, { k: 'icon', label: 'Ícono', type: 'icon' }, { k: 'color_hex', label: 'Color', type: 'color' }, { k: 'requires_supplier', label: 'Pide proveedor', type: 'check' }, { k: 'updates_cost', label: 'Su costo pasa a último costo', type: 'check' }, { k: 'starts_pending', label: 'Nace pendiente (se confirma después)', type: 'check', w: 'col-span-2' }],
        blank: () => ({ code: '', name: '', description: '', icon: 'log-in', color_hex: '#059669', requires_supplier: 0, updates_cost: 0, starts_pending: 0, is_system: 0, active: 1 }),
        canOff: r => r.is_system ? 'Lo usa el sistema.' : '',
    },
    reasons: {
        t: 'Motivos de salida', icon: 'log-out', newLabel: 'Nuevo motivo', arr: () => DB.reasons, sub: 'Merma no es un tipo de movimiento: es un motivo de salida que cuenta como pérdida.',
        text: r => `${r.code} ${r.name}`,
        cols: [{ label: '', cell: r => iconCell(r.icon, r.color_hex) }, { label: 'Motivo', cell: r => `<div class="iv-name">${esc(r.name)}${sysChip(r)}</div><div class="iv-meta max-w-[320px] truncate">${esc(r.description)}</div>` }, { label: 'Clave', cell: r => `<span class="iv-folio">${esc(r.code)}</span>` }, { label: 'Es merma', cell: r => r.is_loss ? badge('Merma', '#E11D48', 'trash-2') : '<span class="iv-meta">No</span>' }, { label: 'Pide foto', cell: r => yes(r.requires_evidence) }, { label: 'Pide departamento', cell: r => yes(r.requires_department) }],
        fields: [{ k: 'code', label: 'Clave', req: 1, roEdit: 1 }, { k: 'name', label: 'Nombre', req: 1 }, { k: 'description', label: 'Descripción', type: 'textarea', w: 'col-span-2' }, { k: 'icon', label: 'Ícono', type: 'icon' }, { k: 'color_hex', label: 'Color', type: 'color' }, { k: 'is_loss', label: 'Cuenta como merma', type: 'check' }, { k: 'requires_evidence', label: 'Pide foto de evidencia', type: 'check' }, { k: 'requires_department', label: 'Pide departamento', type: 'check' }],
        blank: () => ({ code: '', name: '', description: '', icon: 'log-out', color_hex: '#C05A40', is_loss: 0, requires_evidence: 0, requires_department: 0, is_system: 0, active: 1 }),
        canOff: r => r.is_system ? 'Lo usa el sistema (ventas y surtidos).' : '',
    },
    adjReasons: {
        t: 'Motivos de ajuste', icon: 'sliders-horizontal', newLabel: 'Nuevo motivo', arr: () => DB.adjReasons, sub: 'Por qué se corrige la existencia en un conteo.',
        text: r => `${r.code} ${r.name}`,
        cols: [{ label: '', cell: r => iconCell(r.icon, r.color_hex) }, { label: 'Motivo', cell: r => `<span class="iv-name">${esc(r.name)}</span>${sysChip(r)}` }, { label: 'Clave', cell: r => `<span class="iv-folio">${esc(r.code)}</span>` }, { label: 'Cuenta como dinero', cell: r => yes(r.affects_cost) }],
        fields: [{ k: 'code', label: 'Clave', req: 1, roEdit: 1 }, { k: 'name', label: 'Nombre', req: 1 }, { k: 'icon', label: 'Ícono', type: 'icon' }, { k: 'color_hex', label: 'Color', type: 'color' }, { k: 'affects_cost', label: 'La diferencia cuenta como dinero', type: 'check', w: 'col-span-2' }],
        blank: () => ({ code: '', name: '', icon: 'sliders-horizontal', color_hex: '#7C3AED', affects_cost: 1, is_system: 0, active: 1 }),
        canOff: r => r.is_system ? 'Lo usa el sistema.' : '',
    },
    states: {
        t: 'Estados', icon: 'flag', arr: () => [...DB.transferStatus.map(s => Object.assign(s, { _flow: 'Traspaso' })), ...DB.reqStatus.map(s => Object.assign(s, { _flow: 'Requisición' }))],
        sub: 'Los nombres son fijos (el flujo depende de ellos); solo se cambian ícono y color.', noNew: 1, noOff: 1,
        text: r => `${r.name} ${r._flow}`,
        cols: [{ label: '', cell: r => iconCell(r.icon, r.color_hex) }, { label: 'Estado', cell: r => badge(r.name, r.color_hex, r.icon) }, { label: 'Flujo', cell: r => `<span class="text-[12.5px]">${r._flow}</span>` }, { label: 'Clave', cell: r => `<span class="iv-folio">${esc(r.code)}</span>` }, { label: 'Cierra el flujo', cell: r => yes(r.is_terminal) }, { label: 'Color', cell: r => colorDot(r.color_hex) }],
        fields: [{ k: 'name', label: 'Nombre', ro: 1, w: 'col-span-2' }, { k: 'icon', label: 'Ícono', type: 'icon' }, { k: 'color_hex', label: 'Color', type: 'color' }],
        key: r => `${r._flow === 'Traspaso' ? 't' : 'r'}${r.id}`,
        find: key => (key[0] === 't' ? DB.transferStatus : DB.reqStatus).find(s => s.id === Number(key.slice(1))),
    },
};

VIEWS.catalogo = {
    mount() {
        const f = UI.f.catalogo = Object.assign({ tab: 'items', caKind: 'all', caCat: 'all', caWh: 'all', caStatus: '1', caQ: '' }, UI.f.catalogo || {});
        const c = CAT[f.tab];
        const tabs = `<div class="iv-tabs px-3 shrink-0">${Object.entries(CAT).map(([k, x]) => `<button type="button" class="iv-tab ${f.tab === k ? 'active' : ''}" data-tab="${k}"><i data-lucide="${x.icon}"></i>${x.t}<span class="iv-tab-n">${x.arr().filter(r => r.active).length}</span></button>`).join('')}</div>`;
        $id('view-catalogo').innerHTML = frame({
            id: 'ca', title: 'Catálogo', sub: c.sub,
            actions: c.noNew || !can('inv-catalogo', 'create') ? '' : `<button type="button" class="iv-btn iv-btn-brand" onclick="catForm('${f.tab}')"><i data-lucide="plus"></i>${c.newLabel}</button>`,
            tabs, filters: (c.filters ? c.filters(f) : '') + (c.noOff ? '' : fSelect('caStatus', 'Estado', [opt('1', 'Activos'), opt('0', 'Inactivos'), opt('all', 'Todos')], f.caStatus, 'w-full sm:w-32')) + fSearch('caQ', 'Buscar', f.caQ),
        });
        $id('view-catalogo').querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { f.tab = b.dataset.tab; f.caQ = ''; this.mount(); icons(); }));
        bindFilters('catalogo', () => this.paint());
        this.paint();
    },
    paint() {
        const f = UI.f.catalogo, c = CAT[f.tab], q = norm(f.caQ);
        const key = c.key || (r => r.id);
        const rows = c.arr().filter(r => (c.noOff || f.caStatus === 'all' || String(r.active) === f.caStatus) && (!c.match || c.match(r, f)) && (!q || norm(c.text(r)).includes(q)));
        // Editar pide «update»; desactivar o activar pide «delete»
        const edit = can('inv-catalogo', 'update'), off = !c.noOff && can('inv-catalogo', 'delete');
        $id('caBody').innerHTML = table({
            rows, rowAttr: r => `class="${r.active ? '' : 'off'}"`,
            cols: [...c.cols, ...(c.noOff ? [] : [{ label: 'Estado', cell: activeChip }]), ...(edit || off ? [{ label: '', cls: 'r', cell: r => `<div class="flex justify-end gap-1">${btnIf(edit, `<button type="button" class="iv-icon-btn" title="Editar" onclick="catForm('${f.tab}', '${key(r)}')"><i data-lucide="pencil"></i></button>`)}${btnIf(off, `<button type="button" class="iv-icon-btn ${r.active ? 'danger' : 'ok'}" title="${r.active ? 'Desactivar' : 'Activar'}" onclick="catToggle('${f.tab}', '${key(r)}')"><i data-lucide="${r.active ? 'power-off' : 'power'}"></i></button>`)}</div>` }] : [])],
            cost: canCost('inv-catalogo'), footLabel: plural(rows.length, 'registro', 'registros'),
            foot: `<td colspan="${c.cols.length + (c.noOff ? 0 : 1) + (edit || off ? 1 : 0)}">${plural(rows.length, 'registro', 'registros')}</td>`,
        });
    },
};
const catFind = (tab, key) => { const c = CAT[tab]; return c.find ? c.find(key) : c.arr().find(r => String(r.id) === String(key)); };
function catToggle(tab, key) {
    const c = CAT[tab], r = catFind(tab, key);
    const why = r.active && c.canOff ? c.canOff(r) : '';
    if (why) { swalBase({ icon: 'info', title: 'No se puede desactivar', text: why }); return; }
    r.active = r.active ? 0 : 1;
    toast(r.active ? 'Activado' : 'Desactivado', 'info');
    VIEWS.catalogo.mount();
}
// -- Formulario genérico del Catálogo --
let CATF = null;
function catForm(tab, key) {
    const c = CAT[tab], row = key !== undefined ? catFind(tab, key) : null;
    CATF = { tab, row, v: row ? { ...row } : c.blank() };
    modal({ id: 'mdlCat', icon: c.icon, title: row ? `Editar ${esc(row.name || row.code)}` : c.newLabel, sub: c.t, width: 640, body: '<div id="cfBody" class="grid grid-cols-2 gap-3"></div>',
        foot: `<button type="button" class="iv-btn iv-btn-ghost" onclick="closeModal('mdlCat')">Cancelar</button><button type="button" class="iv-btn iv-btn-brand" onclick="catSave()"><i data-lucide="save"></i>Guardar</button>` });
    paintCatForm();
}
function paintCatForm() {
    const { tab, v, row } = CATF, c = CAT[tab];
    $id('cfBody').innerHTML = c.fields.filter(fd => !fd.show || fd.show(v)).map(fd => {
        const ro = fd.ro || (fd.roEdit && row) || (fd.newOnly && row);
        const lbl = `<label class="iv-lbl">${fd.label}${fd.req && !ro ? ' <b>*</b>' : ''}</label>`;
        const hint = fd.hint ? `<p class="iv-meta mt-1">${fd.hint}</p>` : '';
        const val = v[fd.k] ?? '';
        let input;
        if (fd.type === 'select') input = `<select class="iv-inp" data-cf="${fd.k}" ${ro ? 'disabled' : ''}>${fd.opts().map(o => `<option value="${o.v}" ${String(o.v) === String(val) ? 'selected' : ''}>${esc(o.t)}</option>`).join('')}</select>`;
        else if (fd.type === 'check') return `<div class="${fd.w || ''} flex flex-col justify-end"><label class="iv-check"><input type="checkbox" data-cf="${fd.k}" ${val ? 'checked' : ''} ${ro ? 'disabled' : ''}>${fd.label}</label>${hint}</div>`;
        else if (fd.type === 'textarea') input = `<textarea class="iv-inp" data-cf="${fd.k}" rows="2" ${ro ? 'readonly' : ''}>${esc(val)}</textarea>`;
        else if (fd.type === 'color') input = `<div class="flex flex-wrap gap-1.5">${COLORS.map(h => `<button type="button" class="w-7 h-7 rounded-lg border-2 ${String(val).toUpperCase() === h ? 'border-gray-900' : 'border-transparent'}" style="background:${h}" data-color="${h}" title="${h}"></button>`).join('')}</div>`;
        else if (fd.type === 'icon') input = `<div class="flex flex-wrap gap-1 max-h-[92px] overflow-y-auto scrollbar-thin">${ICONS.map(i => `<button type="button" class="iv-icon-btn ${val === i ? 'iv-tone' : ''}" style="${val === i ? tone(v.color_hex) : ''}" data-icon="${i}" title="${i}"><i data-lucide="${i}"></i></button>`).join('')}</div>`;
        else input = `<input class="iv-inp ${fd.type === 'number' ? 'num' : ''}" type="${fd.type === 'number' ? 'number' : 'text'}" step="any" data-cf="${fd.k}" value="${esc(val)}" ${ro ? 'readonly' : ''}>`;
        return `<div class="${fd.w || ''}">${lbl}${input}${hint}</div>`;
    }).join('');
    $id('cfBody').querySelectorAll('[data-cf]').forEach(el => el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', () => {
        const k = el.dataset.cf;
        CATF.v[k] = el.type === 'checkbox' ? (el.checked ? 1 : 0) : el.value;
        if (el.tagName === 'SELECT' || el.type === 'checkbox') { c.onField?.(CATF.v, k); paintCatForm(); }
    }));
    $id('cfBody').querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => { CATF.v.color_hex = b.dataset.color; paintCatForm(); }));
    $id('cfBody').querySelectorAll('[data-icon]').forEach(b => b.addEventListener('click', () => { CATF.v.icon = b.dataset.icon; paintCatForm(); }));
    icons();
}
function catSave() {
    const { tab, v, row } = CATF, c = CAT[tab];
    const miss = c.fields.filter(fd => fd.req && !fd.ro && !(fd.roEdit && row) && (!fd.show || fd.show(v)) && (v[fd.k] === '' || v[fd.k] === null || v[fd.k] === undefined));
    if (miss.length) { swalBase({ icon: 'warning', title: 'Falta algo', text: `Llena: ${miss.map(m => m.label).join(', ')}.` }); return; }
    const err = c.save?.(v);
    if (err) { swalBase({ icon: 'warning', title: 'Revisa', text: err }); return; }
    if (row) Object.assign(row, v);
    else { v.id = (Math.max(0, ...c.arr().map(r => r.id)) || 0) + 1; c.arr().push(v); }
    c.after?.(row || v);
    closeModal('mdlCat');
    toast(row ? 'Cambios guardados' : 'Dado de alta');
    VIEWS.catalogo.mount();
    refreshDrawer();
    icons();
}

// -- Arranque: este archivo va al último --
boot();
