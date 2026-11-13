// POS + Pedidos (Huubie PRO) · datos simulados, reglas de dinero y estado de la pantalla.
// Columnas reales de fayxzvov_pos; usuarios y sucursales de fayxzvov_app. Sin backend.

// -- Utilidades --
const $id = id => document.getElementById(id);
const pad = (n, l = 2) => String(n).padStart(l, '0');
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDate(d); };
const TODAY = isoDate(new Date());
const YESTERDAY = addDays(TODAY, -1);
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const nowStamp = () => `${TODAY} ${nowTime()}`;
const fmt = n => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = n => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const fmtSmart = n => Number.isInteger(round2(n)) ? fmtShort(n) : fmt(n);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = iso => { if (!iso) return '—'; const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const dayName = iso => DAYS[new Date(iso.slice(0, 10) + 'T12:00:00').getDay()];
const hourOf = stamp => (stamp || '').slice(11, 16);
const fmtStamp = st => st ? `${fmtDate(st)} ${hourOf(st)}` : '—';
const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const uid = () => Math.random().toString(36).slice(2, 9);
const sum = (arr, fn) => arr.reduce((a, x) => a + (Number(fn(x)) || 0), 0);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const icons = () => { if (window.lucide) lucide.createIcons(); };

// -- SweetAlert --
const swalBase = opts => Swal.fire(Object.assign({ customClass: { popup: 'huubie-swal' }, confirmButtonText: 'Aceptar', cancelButtonText: 'Cancelar' }, opts));
const swalInfo = (title, text) => swalBase({ icon: 'info', title, text });
const swalWarn = (title, text) => swalBase({ icon: 'warning', title, text });
const swalError = (title, text) => swalBase({ icon: 'error', title, text });
const swalConfirm = (title, text, confirmButtonText = 'Sí, continuar') => swalBase({ icon: 'question', title, text, showCancelButton: true, confirmButtonText }).then(r => r.isConfirmed);
const toast = (title, icon = 'success') => Swal.fire({ toast: true, position: 'top-end', icon, title, timer: 1700, showConfirmButton: false, customClass: { popup: 'huubie-swal' } });

// -- Datos simulados --
const DB = {
    company: { id: 2, name: 'Café Ligero' },                      // fayxzvov_app.companies
    branch: { id: 3, name: 'Reginas Kafeto', company_id: 2 },      // fayxzvov_app.branches
    user: { id: 3, name: 'Andrea M.', role: 'Cajera', color: '#C05A40' },   // sesión
    users: { 1: 'Dev', 2: 'Rosa', 3: 'Andrea M.' },
    sellers: [3, 2],   // quién atendió: seller_id NO existe en fayxzvov_pos
    managers: [{ user_id: 2, name: 'Rosa (gerente)', pin: '1234' }],   // el PIN no vive en fayxzvov_pos

    // Semillas reales del DDL
    sale_type: { 1: 'Pedido', 2: 'Mostrador', 3: 'POS', 4: 'E-commerce' },
    sale_status: { 1: 'Cotización', 2: 'Pendiente', 3: 'Pagado', 4: 'Cancelado' },
    payment_method: [
        { id: 1, name: 'Efectivo', code: 'CASH', kind: 'efectivo', commission: 0, sort: 1, is_cash: 1, is_visible: 1, earns_points: 1, icon: 'banknote' },
        { id: 2, name: 'Tarjeta', code: 'CARD', kind: 'tarjeta', commission: 0, sort: 2, is_cash: 0, is_visible: 1, earns_points: 1, icon: 'credit-card' },
        { id: 3, name: 'Transferencia', code: 'TRANSFER', kind: 'transferencia', commission: 0, sort: 3, is_cash: 0, is_visible: 1, earns_points: 1, icon: 'arrow-right-left' },
        // kind válido en el DDL pero sin semilla
        { id: 4, name: 'Vales de despensa', code: 'VALES', kind: 'vales', commission: 0, sort: 4, is_cash: 0, is_visible: 0, earns_points: 0, unseeded: true, icon: 'ticket' },
        { id: 5, name: 'Monedero', code: 'PUNTOS', kind: 'puntos', commission: 0, sort: 5, is_cash: 0, is_visible: 0, earns_points: 0, unseeded: true, icon: 'wallet' },
    ],
    discount_reason: [
        { id: 1, code: 'CORTESIA', name: 'Cortesía de la casa', max_percent: 100, requires_authorization: 1 },
        { id: 2, code: 'CLIENTE_FREC', name: 'Cliente frecuente', max_percent: 20, requires_authorization: 0 },
        { id: 3, code: 'PROMO', name: 'Promoción vigente', max_percent: 50, requires_authorization: 0 },
        { id: 4, code: 'EMPLEADO', name: 'Descuento empleado', max_percent: 20, requires_authorization: 1 },
        { id: 5, code: 'OTRO', name: 'Otro motivo', max_percent: 100, requires_authorization: 1 },
    ],

    // Catálogo (simulado)
    category: [
        { id: 1, name: 'Cafetería', icon: 'coffee', tone: '#7c5a3a' },
        { id: 2, name: 'Pastelería', icon: 'cake-slice', tone: '#9d4b73' },
        { id: 3, name: 'Panadería', icon: 'croissant', tone: '#a16207' },
        { id: 4, name: 'Bebidas frías', icon: 'cup-soda', tone: '#0e7490' },
        { id: 5, name: 'Paquetes', icon: 'gift', tone: '#6d28d9' },
        { id: 6, name: 'Extras', icon: 'sparkles', tone: '#475569' },
    ],
    subcategory: [
        { id: 1, category_id: 1, name: 'Espresso' }, { id: 2, category_id: 1, name: 'Especialidad' },
        { id: 3, category_id: 2, name: 'Rebanadas' }, { id: 4, category_id: 2, name: 'Pasteles enteros' },
        { id: 5, category_id: 3, name: 'Dulce' }, { id: 6, category_id: 3, name: 'Salado' },
        { id: 7, category_id: 4, name: 'Frappés' }, { id: 8, category_id: 4, name: 'Embotellados' },
    ],
    // stock viene de Inventarios, NO de fayxzvov_pos (null = no inventariable)
    product: [
        { id: 1, name: 'Americano 12 oz', sku: 'CAF-001', barcode: '7501000000011', price: 38, category_id: 1, subcategory_id: 1, kind: 'product', stock: null },
        { id: 2, name: 'Capuchino 12 oz', sku: 'CAF-002', barcode: '7501000000028', price: 52, category_id: 1, subcategory_id: 1, kind: 'product', stock: null },
        { id: 3, name: 'Latte vainilla 16 oz', sku: 'CAF-003', barcode: '7501000000035', price: 62, category_id: 1, subcategory_id: 2, kind: 'product', stock: null },
        { id: 4, name: 'Espresso doble', sku: 'CAF-004', barcode: '7501000000042', price: 34, category_id: 1, subcategory_id: 1, kind: 'product', stock: null },
        { id: 5, name: 'Chocolate caliente', sku: 'CAF-005', barcode: '7501000000059', price: 48, category_id: 1, subcategory_id: 2, kind: 'product', stock: null },
        { id: 6, name: 'Chai latte', sku: 'CAF-006', barcode: '7501000000066', price: 58, category_id: 1, subcategory_id: 2, kind: 'product', stock: null },
        { id: 7, name: 'Rebanada de chocolate', sku: 'PAS-001', barcode: '7502000000010', price: 65, category_id: 2, subcategory_id: 3, kind: 'product', stock: 8 },
        { id: 8, name: 'Cheesecake frutos rojos', sku: 'PAS-002', barcode: '7502000000027', price: 72, category_id: 2, subcategory_id: 3, kind: 'product', stock: 2 },
        { id: 9, name: 'Rebanada tres leches', sku: 'PAS-003', barcode: '7502000000034', price: 60, category_id: 2, subcategory_id: 3, kind: 'product', stock: 0 },
        { id: 10, name: 'Pastel de chocolate', sku: 'PAS-010', barcode: '7502000000102', price: 520, category_id: 2, subcategory_id: 4, kind: 'product', stock: 2, portion_qty: 12, shelf_life_days: 3 },
        { id: 11, name: 'Pastel tres leches', sku: 'PAS-011', barcode: '7502000000119', price: 640, category_id: 2, subcategory_id: 4, kind: 'product', stock: 1, portion_qty: 16, shelf_life_days: 2 },
        { id: 12, name: 'Concha de vainilla', sku: 'PAN-001', barcode: '7503000000019', price: 18, category_id: 3, subcategory_id: 5, kind: 'product', stock: 24 },
        { id: 13, name: 'Croissant de mantequilla', sku: 'PAN-002', barcode: '7503000000026', price: 32, category_id: 3, subcategory_id: 5, kind: 'product', stock: 12 },
        { id: 14, name: 'Rol de canela', sku: 'PAN-003', barcode: '7503000000033', price: 38, category_id: 3, subcategory_id: 5, kind: 'product', stock: 9 },
        { id: 15, name: 'Cuernito jamón y queso', sku: 'PAN-010', barcode: '7503000000101', price: 55, category_id: 3, subcategory_id: 6, kind: 'product', stock: 6 },
        { id: 16, name: 'Empanada de pollo', sku: 'PAN-011', barcode: '7503000000118', price: 42, category_id: 3, subcategory_id: 6, kind: 'product', stock: 4 },
        { id: 17, name: 'Frappé moka', sku: 'BEB-001', barcode: '7504000000018', price: 68, category_id: 4, subcategory_id: 7, kind: 'product', stock: null },
        { id: 18, name: 'Frappé taro', sku: 'BEB-002', barcode: '7504000000025', price: 70, category_id: 4, subcategory_id: 7, kind: 'product', stock: null },
        { id: 19, name: 'Agua mineral 355 ml', sku: 'BEB-010', barcode: '7504000000100', price: 28, category_id: 4, subcategory_id: 8, kind: 'product', stock: 30 },
        { id: 20, name: 'Refresco de lata', sku: 'BEB-011', barcode: '7504000000117', price: 25, category_id: 4, subcategory_id: 8, kind: 'product', stock: 18 },
        { id: 21, name: 'Paquete desayuno', sku: 'PAQ-001', barcode: '7505000000017', price: 69, category_id: 5, subcategory_id: null, kind: 'bundle', stock: null },
        { id: 22, name: 'Paquete cumpleaños', sku: 'PAQ-002', barcode: '7505000000024', price: 560, category_id: 5, subcategory_id: null, kind: 'bundle', stock: null },
        { id: 23, name: 'Velas de cumpleaños (12)', sku: 'EXT-001', barcode: '7506000000016', price: 35, category_id: 6, subcategory_id: null, kind: 'product', stock: 40 },
        { id: 24, name: 'Tarjeta de felicitación', sku: 'EXT-002', barcode: '7506000000023', price: 25, category_id: 6, subcategory_id: null, kind: 'product', stock: 15 },
        // Fuera del catálogo (in_catalog = 0)
        { id: 90, name: 'Pastel personalizado', sku: 'PERS', price: 0, category_id: 2, subcategory_id: 4, kind: 'product', stock: null, is_custom: 1, in_catalog: 0 },
        // La captura manual NO usa producto: detail_sale.product_id es NULL-able
    ],
    product_recipe: [
        { product_id: 21, component_id: 1, quantity: 1 }, { product_id: 21, component_id: 12, quantity: 2 },
        { product_id: 22, component_id: 10, quantity: 1 }, { product_id: 22, component_id: 23, quantity: 1 }, { product_id: 22, component_id: 24, quantity: 1 },
    ],
    // modifier_group.is_extra: 0 = se elige uno · 1 = varios con cantidad (regla supuesta, el DDL no la trae)
    modifier_group: [
        { id: 1, name: 'Tamaño', is_extra: 0 }, { id: 2, name: 'Pan', is_extra: 0 }, { id: 3, name: 'Relleno', is_extra: 0 },
        { id: 4, name: 'Betún', is_extra: 0 }, { id: 5, name: 'Decoración', is_extra: 1 },
        { id: 6, name: 'Leche', is_extra: 0 }, { id: 7, name: 'Extras', is_extra: 1 },
    ],
    // modifier.quantity = porciones que aporta (solo Tamaño)
    modifier: [
        { id: 1, modifier_group_id: 1, name: 'Chico', description: '10 porciones', price: 380, quantity: 10 },
        { id: 2, modifier_group_id: 1, name: 'Mediano', description: '20 porciones', price: 620, quantity: 20 },
        { id: 3, modifier_group_id: 1, name: 'Grande', description: '30 porciones', price: 880, quantity: 30 },
        { id: 4, modifier_group_id: 2, name: 'Vainilla', price: 0 }, { id: 5, modifier_group_id: 2, name: 'Chocolate', price: 0 },
        { id: 6, modifier_group_id: 2, name: 'Red velvet', price: 60 }, { id: 7, modifier_group_id: 2, name: 'Zanahoria', price: 45 },
        { id: 8, modifier_group_id: 3, name: 'Sin relleno', price: 0 }, { id: 9, modifier_group_id: 3, name: 'Cajeta', price: 40 },
        { id: 10, modifier_group_id: 3, name: 'Nutella', price: 70 }, { id: 11, modifier_group_id: 3, name: 'Frutos rojos', price: 60 },
        { id: 12, modifier_group_id: 4, name: 'Chantilly', price: 0 }, { id: 13, modifier_group_id: 4, name: 'Queso crema', price: 50 },
        { id: 14, modifier_group_id: 4, name: 'Fondant', price: 150 }, { id: 15, modifier_group_id: 4, name: 'Ganache', price: 80 },
        { id: 16, modifier_group_id: 5, name: 'Flores naturales', price: 120 }, { id: 17, modifier_group_id: 5, name: 'Figura de fondant', price: 90 },
        { id: 18, modifier_group_id: 5, name: 'Letrero de chocolate', price: 45 }, { id: 19, modifier_group_id: 5, name: 'Foto comestible', price: 150 },
        { id: 20, modifier_group_id: 5, name: 'Macarons (6)', price: 110 },
        { id: 21, modifier_group_id: 6, name: 'Entera', price: 0 }, { id: 22, modifier_group_id: 6, name: 'Deslactosada', price: 6 },
        { id: 23, modifier_group_id: 6, name: 'Avena', price: 12 }, { id: 24, modifier_group_id: 6, name: 'Almendra', price: 14 },
        { id: 25, modifier_group_id: 7, name: 'Shot extra', price: 14 }, { id: 26, modifier_group_id: 7, name: 'Jarabe de vainilla', price: 8 },
        { id: 27, modifier_group_id: 7, name: 'Crema batida', price: 10 },
    ],
    product_modifier: [],   // se llena abajo: qué modificadores ofrece cada producto

    customer: [
        { id: 1, name: 'Público en general', phone: '', email: '', wallet: 0, credit_limit: 0, credit_enabled: 0 },
        { id: 2, name: 'María Fernanda López', phone: '9611234567', email: 'mafer@correo.com', wallet: 85.5, credit_limit: 2000, credit_enabled: 1 },
        { id: 3, name: 'Carlos Ruiz Pérez', phone: '9617654321', email: '', wallet: 0, credit_limit: 0, credit_enabled: 0 },
        { id: 4, name: 'Cafetería Los Arcos', phone: '9619988776', email: 'compras@losarcos.mx', wallet: 0, credit_limit: 5000, credit_enabled: 1 },
        { id: 5, name: 'Ana Sofía Gómez', phone: '9615551234', email: 'anasofia@correo.com', wallet: 240, credit_limit: 0, credit_enabled: 0 },
        { id: 6, name: 'Jorge Hernández', phone: '9613332211', email: '', wallet: 12, credit_limit: 1000, credit_enabled: 1 },
    ],
    card_type: [
        { id: 1, name: 'Clásica', discount_percent: 0, points_percent: 3 },
        { id: 2, name: 'Oro', discount_percent: 5, points_percent: 5 },
        { id: 3, name: 'Colaborador', discount_percent: 15, points_percent: 0 },
    ],
    card: [
        { id: 1, number: 'RK-000123', holder: 'María Fernanda López', card_type_id: 2, customer_id: 2 },
        { id: 2, number: 'RK-000456', holder: 'Ana Sofía Gómez', card_type_id: 1, customer_id: 5 },
        { id: 3, number: 'RK-000789', holder: 'Jorge Hernández', card_type_id: 1, customer_id: 6 },
    ],

    // Caja
    turn: [
        { id: 41, folio: 'T-0041', opening_cash: 1000, counted_cash: 1180, opened_at: `${TODAY} 07:02`, closed_at: `${TODAY} 14:01`, status: 'closed', user_id: 2, close_user_id: 2, daily_closure_id: null },
        { id: 42, folio: 'T-0042', opening_cash: 1500, counted_cash: null, opened_at: `${TODAY} 14:05`, closed_at: null, status: 'open', user_id: 3, close_user_id: null, daily_closure_id: null },
    ],
    cash_move: [   // NO existe en fayxzvov_pos: hoy solo hay daily_closure.cash_in / cash_out
        { id: 1, turn_id: 41, type: 'out', amount: 500, concept: 'Envío a tesorería', at: `${TODAY} 12:30`, user_id: 2 },
    ],
    daily_closure: [],

    // Movimientos (se llenan con seedSale)
    sale: [], detail_sale: [], payment: [], receivable: [], history_log: [], sale_image: [],
};

// -- Búsquedas --
const byId = (arr, id) => arr.find(x => x.id === Number(id));
const product = id => byId(DB.product, id);
const customer = id => byId(DB.customer, id);
const method = id => byId(DB.payment_method, id);
const reason = id => byId(DB.discount_reason, id);
const saleById = id => byId(DB.sale, id);
const turnById = id => byId(DB.turn, id);
const userName = id => DB.users[id] || '—';
const nextId = arr => arr.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
const cardOf = cid => DB.card.find(c => c.customer_id === Number(cid)) || null;
const cardTypeOf = card => card ? byId(DB.card_type, card.card_type_id) : null;
const openTurn = () => DB.turn.find(t => t.status === 'open') || null;
const groupOf = m => byId(DB.modifier_group, m.modifier_group_id);
const modsOf = pid => DB.product_modifier.filter(pm => pm.product_id === Number(pid) && pm.modifier_id).map(pm => byId(DB.modifier, pm.modifier_id));
const pickMod = (id, quantity = 1) => { const m = byId(DB.modifier, id); return { modifier_id: m.id, name: m.name, group: groupOf(m).name, price: m.price, quantity }; };
const saleLines = id => DB.detail_sale.filter(d => d.sale_id === Number(id) && d.active !== 0);
const isPublic = cid => !cid || Number(cid) === 1;
const cashMethod = () => DB.payment_method.find(m => m.is_cash);
const walletMethod = () => DB.payment_method.find(m => m.kind === 'puntos');

// Modificadores → texto de detail_sale.details (VARCHAR 255): no hay tabla detail_sale_modifier
const modsText = mods => {
    const g = {};
    mods.forEach(m => (g[m.group] = g[m.group] || []).push(m.name + (m.quantity > 1 ? ` ×${m.quantity}` : '')));
    return Object.entries(g).map(([k, v]) => `${k}: ${v.join(', ')}`).join(' · ').slice(0, 255);
};

// -- Dinero de una venta --
const saleKind = s => s.sale_status_id === 1 ? 'Cotización' : s.sale_type_id === 1 ? 'Pedido' : 'Venta';
const folioLabel = s => `${saleKind(s)} #${s.folio}`;
const salePayments = id => DB.payment.filter(p => p.sale_id === id && !p.deleted_at);
const saleAbonos = id => DB.receivable.filter(r => r.sale_id === id && r.kind === 'abono' && !r.deleted_at);
const saleCredit = id => round2(sum(DB.receivable.filter(r => r.sale_id === id && r.kind === 'cargo' && !r.deleted_at), r => r.amount));
const salePaid = s => round2(sum(salePayments(s.id), p => p.amount) + sum(saleAbonos(s.id), r => r.amount));   // el crédito NO cuenta como pagado
const saleDue = s => [1, 4].includes(s.sale_status_id) ? 0 : Math.max(0, round2(s.total + s.tip_amount - salePaid(s)));
const customerDebt = cid => round2(sum(DB.receivable.filter(r => r.customer_id === Number(cid) && !r.deleted_at), r => r.kind === 'cargo' ? r.amount : -r.amount));
const creditAvailable = cid => { const c = customer(cid); return c && c.credit_enabled ? Math.max(0, round2(c.credit_limit - customerDebt(c.id))) : 0; };

// -- Saldos y reglas de edición --
const creditLeft = s => Math.max(0, round2(saleCredit(s.id) - sum(saleAbonos(s.id), r => r.amount)));   // crédito que sigue sin abonarse
const cashDue = s => Math.max(0, round2(saleDue(s) - creditLeft(s)));                                    // lo que falta pagar fuera del crédito
const accountDebt = cid => round2(sum(DB.receivable.filter(r => r.customer_id === Number(cid) && !r.sale_id && !r.deleted_at), r => r.kind === 'cargo' ? r.amount : -r.amount));
const deliveredAt = s => DB.history_log.filter(h => h.sale_id === s.id && h.action === 'deliver').map(h => h.created_at).sort().pop() || null;   // no hay delivered_at
const canEdit = s => s.sale_status_id !== 4 && !saleCredit(s.id) && (s.sale_type_id === 1 ? s.delivery_status !== 1 : s.sale_status_id !== 3);
const editBlock = s => s.sale_status_id === 4 ? 'Está cancelada.' : saleCredit(s.id) ? 'Tiene crédito: liquídala o cancélala.'
    : s.sale_type_id === 1 ? 'El pedido ya se entregó.' : 'Ya está pagada. Para cambiarla, cancélala y captúrala de nuevo.';
const STATUS_TONE = { 1: 't-purple', 2: 't-amber', 3: 't-green', 4: 't-red' };
const DELIVERY_TXT = { 2: ['Por producir', 't-amber'], 0: ['Listo para entregar', 't-sky'], 1: ['Entregado', 't-green'] };
const LOG_ICON = { payment: 'banknote', discount: 'tag', edition: 'pencil', cancellation: 'circle-x', delivery: 'truck', comment: 'message-square' };
const deliveryTxt = s => [s.delivery_date ? `${dayName(s.delivery_date)} ${fmtDate(s.delivery_date)}` : 'Sin fecha', s.delivery_time, Number(s.delivery_method) ? 'A domicilio' : 'Recoge'].filter(Boolean).join(' · ');

// -- Relaciones de catálogo --
// product_modifier sirve para dos cosas: lo que OFRECE un producto y la receta de un personalizado
const linkMods = (pid, groups) => DB.modifier.filter(m => groups.includes(m.modifier_group_id)).forEach(m =>
    DB.product_modifier.push({ id: nextId(DB.product_modifier), product_id: pid, modifier_id: m.id, details: null, quantity: 0, price: m.price }));
[2, 3, 6].forEach(pid => linkMods(pid, [6, 7]));
linkMods(90, [1, 2, 3, 4, 5]);

// Un personalizado se guarda como product.is_custom = 1 con su receta en product_modifier
function createCustomProduct(mods, price, id = nextId(DB.product)) {
    const size = mods.find(m => m.group === 'Tamaño');
    DB.product.push({
        id, name: 'Pastel personalizado', sku: `PERS-${id}`, price, suggested_price: round2(sum(mods, m => m.price * m.quantity)),
        category_id: 2, subcategory_id: 4, kind: 'product', stock: null, is_custom: 1, in_catalog: 0,
        portion_qty: size ? byId(DB.modifier, size.modifier_id).quantity : 0,
    });
    mods.forEach(m => DB.product_modifier.push({ id: nextId(DB.product_modifier), product_id: id, modifier_id: m.modifier_id, details: m.name, quantity: m.quantity, price: m.price }));
    return id;
}
const MOD91 = [2, 5, 10, 12, 19].map(id => pickMod(id));   // 620 + 0 + 70 + 0 + 150 = 840
const MOD92 = [1, 4, 8, 12, 18].map(id => pickMod(id));    // 380 + 0 + 0 + 0 + 45 = 425
createCustomProduct(MOD91, 840, 91);
createCustomProduct(MOD92, 425, 92);

// -- Bitácora (history_log) --
function logH(sale_id, type, title, detail, user_id = DB.user.id, created_at = nowStamp(), action = '') {
    DB.history_log.push({ id: nextId(DB.history_log), sale_id, type, title: String(title).slice(0, 50), action, detail: detail || '', user_id, created_at });
}

// -- Ventas de ejemplo: turno 41 (cerrado, Rosa) y 42 (abierto, Andrea) --
function seedSale(r) {
    const at = h => h ? `${r.date || TODAY} ${h}` : null;
    const created = at(r.at);
    r.items.forEach(([pid, quantity, extra]) => {
        const p = product(pid);
        DB.detail_sale.push(Object.assign({
            id: nextId(DB.detail_sale), sale_id: r.id, product_id: pid, name: p.name, details: '', dedication: '', price: p.price, quantity,
            discount_percent: 0, discount_amount: 0, discount_reason_id: null, status: 1, created_at: created,
        }, extra));
    });
    const lines = DB.detail_sale.filter(d => d.sale_id === r.id);
    const subtotal = round2(sum(lines, d => d.price * d.quantity - d.discount_amount));
    const accDisc = round2(subtotal * (r.discPct || 0) / 100);
    const ct = cardTypeOf(cardOf(r.customer));
    const cardDisc = ct ? round2((subtotal - accDisc) * ct.discount_percent / 100) : 0;   // sin columna propia: se suma al descuento
    DB.sale.push({
        id: r.id, folio: String(r.id), note: r.note || '', location: r.location || null,
        delivery_method: r.delivery_method || 0, delivery_status: r.delivery_status ?? (r.type === 1 ? 0 : 1),   // DDL: 0 no entregado · 1 entregado · 2 para producir
        cancel_reason: r.cancel_reason || null,
        discount_note: [r.discount_note, cardDisc ? `Tarjeta ${ct.name} ${ct.discount_percent}%` : ''].filter(Boolean).join(' · ') || null,
        subtotal, discount_amount: round2(accDisc + cardDisc), discount_percent: r.discPct || 0, tip_amount: 0,
        total: round2(subtotal - accDisc - cardDisc),
        delivery_date: r.delivery_date || null, delivery_time: r.delivery_time || null, birthday_date: r.birthday_date || null,
        cancelled_at: at(r.cancelled_at), produced_at: at(r.produced_at), created_at: created, updated_at: created,
        branch_id: DB.branch.id, user_id: r.user, seller_id: r.user, edit_user_id: null,
        cancel_user_id: r.cancelled_at ? r.user : null, produced_user_id: r.produced_at ? 2 : null,
        discount_user_id: r.discPct ? r.user : null, sale_status_id: r.status, sale_type_id: r.type,
        customer_id: r.customer, card_id: cardOf(r.customer)?.id || null, discount_reason_id: r.discReason || null,
        turn_id: r.turn, daily_closure_id: null,
    });
    const kind = r.status === 1 ? 'Cotización creada' : r.type === 1 ? 'Pedido creado' : 'Venta registrada';
    logH(r.id, 'edition', kind, `${lines.length} partida(s) · ${fmt(subtotal)}`, r.user, created, 'create');
    if (r.discPct) logH(r.id, 'discount', 'Descuento aplicado', `${reason(r.discReason).name} · ${r.discPct}% (−${fmt(accDisc)})`, r.user, created, 'discount');
    (r.pays || []).forEach(([mid, amount, tendered = amount, h = r.at, deleted = null]) => {
        DB.payment.push({
            id: nextId(DB.payment), sale_id: r.id, payment_method_id: mid, amount, tendered_amount: tendered,
            change_amount: round2(tendered - amount), paid_at: at(h), deleted_at: at(deleted), deleted_user_id: deleted ? r.user : null,
            branch_id: DB.branch.id, user_id: r.user, turn_id: r.turn, created_at: at(h),
        });
        logH(r.id, 'payment', 'Pago registrado', `${method(mid).name} ${fmt(amount)}${tendered > amount ? ` · recibió ${fmt(tendered)} · cambio ${fmt(tendered - amount)}` : ''}`, r.user, at(h), 'pay');
    });
    if (r.credit) {
        DB.receivable.push({
            id: nextId(DB.receivable), kind: 'cargo', description: `Crédito venta #${r.id}`, amount: r.credit, paid_at: null, deleted_at: null,
            created_at: created, branch_id: DB.branch.id, user_id: r.user, deleted_user_id: null, customer_id: r.customer, sale_id: r.id,
            turn_id: r.turn, payment_method_id: null,
        });
        logH(r.id, 'payment', 'Venta a crédito', `Cargo a la cuenta del cliente por ${fmt(r.credit)}`, r.user, created, 'credit');
    }
    if (r.cancelled_at) logH(r.id, 'cancellation', 'Venta cancelada', `${r.cancel_reason} · se eliminó el pago`, r.user, at(r.cancelled_at), 'cancel');
    if (r.produced_at) logH(r.id, 'delivery', 'Producción terminada', 'Marcado como producido', 2, at(r.produced_at), 'produce');
    if (r.delivered_at) logH(r.id, 'delivery', 'Pedido entregado', r.delivery_method ? `Envío a ${r.location}` : 'Recogió en tienda', r.user, at(r.delivered_at), 'deliver');
}

[
    { id: 1031, turn: 41, user: 2, at: '07:30', type: 1, status: 3, customer: 4, delivery_method: 1, delivery_status: 1,
      location: 'Calle 5a Sur 210, Los Arcos', delivery_date: TODAY, delivery_time: '13:00', produced_at: '12:30', delivered_at: '13:10',
      items: [[13, 12], [12, 24]], pays: [[3, 816]] },
    { id: 1032, turn: 41, user: 2, at: '08:15', type: 3, status: 3, customer: 1, items: [[1, 1], [14, 1], [12, 2]], pays: [[1, 112, 200]] },
    { id: 1033, turn: 41, user: 2, at: '09:40', type: 3, status: 3, customer: 5, items: [[2, 1], [13, 1]], pays: [[2, 84]] },
    { id: 1034, turn: 41, user: 2, at: '10:20', type: 3, status: 3, customer: 1, items: [[17, 2]], pays: [[3, 136]] },
    { id: 1035, turn: 41, user: 2, at: '11:05', type: 1, status: 2, customer: 2, delivery_status: 2, delivery_date: TODAY, delivery_time: '17:00',
      birthday_date: TODAY, note: 'Llamar al llegar',
      items: [[91, 1, { details: modsText(MOD91), dedication: '¡Feliz cumpleaños, Sofi!' }]], pays: [[1, 420, 500]] },
    { id: 1036, turn: 41, user: 2, at: '11:30', type: 3, status: 4, customer: 1, cancelled_at: '11:40', cancel_reason: 'El cliente se arrepintió',
      items: [[7, 1]], pays: [[1, 65, 100, '11:30', '11:40']] },
    { id: 1037, turn: 41, user: 2, at: '12:10', type: 3, status: 3, customer: 1, discPct: 10, discReason: 3, discount_note: 'Martes de pastel',
      items: [[10, 1]], pays: [[2, 468]] },
    { id: 1038, turn: 42, user: 3, at: '14:20', type: 3, status: 3, customer: 1, items: [[18, 1], [8, 1], [6, 1]], pays: [[1, 200, 500]] },
    { id: 1039, turn: 42, user: 3, at: '14:40', type: 1, status: 2, customer: 5, delivery_status: 2, delivery_date: addDays(TODAY, 1), delivery_time: '10:00',
      items: [[11, 1, { dedication: 'Felicidades, mamá' }]], pays: [[2, 300]] },
    { id: 1040, turn: 42, user: 3, at: '14:50', type: 1, status: 3, customer: 6, delivery_method: 1, delivery_status: 0,
      location: 'Av. Central 145, Col. Centro', delivery_date: TODAY, delivery_time: '18:30', produced_at: '16:40',
      items: [[10, 1, { dedication: 'Feliz aniversario' }], [23, 1]], pays: [[1, 555, 600]] },
    { id: 1041, turn: 42, user: 3, at: '15:00', type: 1, status: 1, customer: 4, delivery_date: addDays(TODAY, 5), delivery_time: '12:00',
      note: 'Evento de fin de año', items: [[22, 3]] },
    { id: 1042, turn: 42, user: 3, at: '15:30', type: 3, status: 2, customer: 4, items: [[10, 1], [14, 5], [15, 4]], pays: [[1, 330]], credit: 600 },
    { id: 1043, turn: 42, user: 3, at: '16:00', type: 1, status: 2, customer: 3, delivery_status: 2, delivery_date: addDays(TODAY, 3), delivery_time: '12:00',
      items: [[92, 1, { details: modsText(MOD92), dedication: 'Bienvenido, Leo' }]], pays: [[3, 200]] },
].forEach(seedSale);

// Saldo anterior de María Fernanda: cargo de ayer y abono en efectivo hoy (turno 41)
DB.receivable.push({ id: nextId(DB.receivable), kind: 'cargo', description: 'Saldo anterior', amount: 350, paid_at: null, deleted_at: null,
    created_at: `${YESTERDAY} 18:20`, branch_id: DB.branch.id, user_id: 2, deleted_user_id: null, customer_id: 2, sale_id: null, turn_id: null, payment_method_id: null });
DB.receivable.push({ id: nextId(DB.receivable), kind: 'abono', description: 'Abono a saldo anterior', amount: 150, paid_at: `${TODAY} 10:00`, deleted_at: null,
    created_at: `${TODAY} 10:00`, branch_id: DB.branch.id, user_id: 2, deleted_user_id: null, customer_id: 2, sale_id: null, turn_id: 41, payment_method_id: 1 });

// -- Estado de la pantalla --
const LS_KEY = 'pro:pos-order:tickets:v1';
const LS_VIEW = 'pro:pos-order:view';
const S = {
    view: 'vender',
    tickets: [], activeId: null,
    category: 0, subcategory: 0,
    finder: { q: '', idx: 0, list: [] },
    custom: null, lineUid: null, lineImages: [], printSaleId: null,
    cobro: { screen: 'simple', amounts: {}, tip: { mode: 0, amount: 0 }, credit: false, goal: 'all', showAll: false },
    done: null,
    disc: { target: 'cuenta', uid: null, type: 'pct', reason_id: null },
    pin: null, movType: 'in', corteMode: 'x',
    hist: { tab: 'ventas', search: '', date: TODAY, status: 0, selected: null, customerId: null },
    board: { range: 'hoy', search: '' },
    clientes: { search: '' },
    reportes: { range: 'hoy' },
    cancelSaleId: null, abono: null,
};

const blankTicket = n => ({
    uid: uid(), label: `Ticket ${n}`, sale_type_id: 3, customer_id: null, card_id: null, seller_id: DB.user.id, note: '', discount: null,
    delivery_date: TODAY, delivery_time: '', delivery_method: 0, location: '', birthday_date: '',
    editing_sale_id: null, pedidoOpen: true, items: [],
});
const T = () => S.tickets.find(t => t.uid === S.activeId);

// localStorage solo guarda los tickets abiertos de este navegador (sin imágenes: son URLs temporales)
function saveTickets() {
    try {
        const tickets = S.tickets.map(t => ({ ...t, items: t.items.map(i => ({ ...i, images: [] })) }));
        localStorage.setItem(LS_KEY, JSON.stringify({ activeId: S.activeId, tickets }));
    } catch (e) { /* almacenamiento bloqueado: la pantalla sigue sin guardar */ }
}
function loadTickets() {
    try {
        const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
        if (raw && Array.isArray(raw.tickets) && raw.tickets.length) { S.tickets = raw.tickets; S.activeId = raw.activeId; }
    } catch (e) { /* sin almacenamiento */ }
    S.tickets.forEach(t => {
        if (t.editing_sale_id && !saleById(t.editing_sale_id)) t.editing_sale_id = null;
        if (!DB.users[t.seller_id]) t.seller_id = DB.user.id;
    });
    if (!S.tickets.length) { const t = blankTicket(1); S.tickets = [t]; S.activeId = t.uid; }
    if (!T()) S.activeId = S.tickets[0].uid;
}

// -- Modales --
// La última que se abre queda arriba (el PIN incluido). SweetAlert vive en z-index 9998: siempre encima.
function openModal(id) {
    const el = $id(id);
    const top = Math.max(60, ...[...document.querySelectorAll('.po-modal.open')].filter(m => m !== el).map(m => Number(m.style.zIndex) || 60));
    el.style.zIndex = top + 1;
    el.classList.add('open');
    icons();
}
function closeModal(id) { $id(id).classList.remove('open'); }
const topModal = () => [...document.querySelectorAll('.po-modal.open')].reduce((a, m) => !a || (Number(m.style.zIndex) || 60) >= (Number(a.style.zIndex) || 60) ? m : a, null);

function requireTurn() {
    if (openTurn()) return true;
    swalBase({ icon: 'warning', title: 'No hay turno abierto', text: 'Abre un turno de caja para cobrar.', showCancelButton: true, confirmButtonText: 'Abrir turno' })
        .then(r => { if (r.isConfirmed) openAbrirTurno(); });
    return false;
}
