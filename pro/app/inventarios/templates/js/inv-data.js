// Inventarios (Huubie PRO) · datos simulados con las columnas de fayxzvov_inventarios.
// Empresa Reginas (company 2 de fayxzvov_app): Guadalupe (2, Matriz), Kafeto (3) y Cuarta (4).
// Insumos, costos y unidades: los reales de Reginas en fayxzvov_inventory (ERP).
// Productos terminados: los de fayxzvov_pos.product (id real en product_id).
// Sin backend: los documentos de abajo se aplican al cargar con el mismo motor que usa la captura,
// así el stock, los lotes y el kárdex (Antes → Quedó) cuadran entre sí.

// -- Catálogos maestros (fayxzvov_app) --
const DB = {
    company: { id: 2, name: 'Reginas' },
    user: { id: 22, name: 'Andrea M.', role: 'Dueña', initials: 'AM' },
    users: { 22: 'Andrea M.', 23: 'Rosa P.', 24: 'Galilea R.', 25: 'Don Chuy', 26: 'Marisol T.', 27: 'Ramón L.', 28: 'Laura S.' },
    branches: [
        { id: 2, name: 'Reginas Guadalupe', short: 'Guadalupe', code: 'GUA', main: 1 },
        { id: 3, name: 'Reginas Kafeto', short: 'Kafeto', code: 'KAF', main: 0 },
        { id: 4, name: 'Reginas Cuarta', short: 'Cuarta', code: 'CUA', main: 0 },
    ],

    // -- Catálogos del módulo (fayxzvov_inventarios) --
    warehouses: [
        { id: 1, name: 'Almacén Guadalupe', branch_id: 2, is_main: 1, is_default: 1, supply_moves_stock: 1, active: 1 },
        { id: 2, name: 'Almacén Kafeto', branch_id: 3, is_main: 0, is_default: 1, supply_moves_stock: 1, active: 1 },
        { id: 3, name: 'Almacén Cuarta', branch_id: 4, is_main: 0, is_default: 1, supply_moves_stock: 1, active: 1 },
    ],
    areas: [],   // se arman abajo: 5 por almacén
    units: [
        { id: 1, code: 'PZA', name: 'Pieza', allows_decimals: 0 }, { id: 2, code: 'KG', name: 'Kilo', allows_decimals: 1 },
        { id: 3, code: 'G', name: 'Gramo', allows_decimals: 1 }, { id: 4, code: 'LT', name: 'Litro', allows_decimals: 1 },
        { id: 5, code: 'ML', name: 'Mililitro', allows_decimals: 1 }, { id: 6, code: 'CAJA', name: 'Caja', allows_decimals: 0 },
        { id: 7, code: 'PAQ', name: 'Paquete', allows_decimals: 0 }, { id: 8, code: 'BOLSA', name: 'Bolsa', allows_decimals: 0 },
        { id: 9, code: 'LATA', name: 'Lata', allows_decimals: 0 }, { id: 10, code: 'BOTE', name: 'Bote', allows_decimals: 0 },
        { id: 11, code: 'FRASCO', name: 'Frasco', allows_decimals: 0 }, { id: 12, code: 'ROLLO', name: 'Rollo', allows_decimals: 0 },
        { id: 13, code: 'BOT', name: 'Botella', allows_decimals: 0 }, { id: 14, code: 'REB', name: 'Rebanada', allows_decimals: 0 },
    ].map(u => ({ ...u, active: 1 })),
    categories: [
        { id: 1, name: 'Abarrotes', icon: 'wheat', color_hex: '#B45309' },
        { id: 2, name: 'Lácteos', icon: 'milk', color_hex: '#0369A1' },
        { id: 3, name: 'Refrigerados', icon: 'snowflake', color_hex: '#0891B2' },
        { id: 4, name: 'Rellenos y mermeladas', icon: 'cherry', color_hex: '#DB2777' },
        { id: 5, name: 'Decoración', icon: 'sparkles', color_hex: '#7C3AED' },
        { id: 6, name: 'Domos', icon: 'cake-slice', color_hex: '#0D9488' },
        { id: 7, name: 'Cajas y bases', icon: 'package', color_hex: '#A16207' },
        { id: 8, name: 'Desechables', icon: 'utensils', color_hex: '#4B5563' },
        { id: 9, name: 'Vinos y licores', icon: 'wine', color_hex: '#9F1239' },
        { id: 10, name: 'Limpieza', icon: 'spray-can', color_hex: '#475569' },
    ].map(c => ({ ...c, branch_id: null, active: 1 })),
    // Categorías de los productos terminados: vienen de fayxzvov_pos.category (no se editan aquí)
    posCategories: [
        { id: 101, name: 'Pasteles Tradicionales', color_hex: '#C05A40', icon: 'cake' },
        { id: 102, name: 'Pasteles Especialidades', color_hex: '#BE185D', icon: 'cake' },
        { id: 103, name: 'Postres', color_hex: '#DB2777', icon: 'ice-cream-cone' },
        { id: 104, name: 'Bocadillos', color_hex: '#0369A1', icon: 'sandwich' },
        { id: 105, name: 'Pan', color_hex: '#B45309', icon: 'croissant' },
    ],
    suppliers: [
        { id: 1, name: "Sam's Club Villahermosa", contact_name: 'Ventas mayoreo', phone: '9933150000', email: '', rfc: 'NWM9709244W4' },
        { id: 2, name: 'Lácteos del Sureste', contact_name: 'Jorge Peralta', phone: '9931234567', email: 'pedidos@lacteossureste.mx', rfc: '' },
        { id: 3, name: 'Abarrotera La Única', contact_name: 'Doña Lupita', phone: '9937654321', email: '', rfc: '' },
        { id: 4, name: 'Desechables Tabasco', contact_name: 'Mario Ruiz', phone: '9933334455', email: 'ventas@desechablestab.mx', rfc: '' },
        { id: 5, name: 'Dulce Arte Repostería', contact_name: 'Karla Méndez', phone: '9932223344', email: 'karla@dulcearte.mx', rfc: '' },
    ].map(s => ({ ...s, branch_id: null, note: '', active: 1 })),
    departments: [
        { id: 1, name: 'Pastelería', icon: 'cake-slice', color_hex: '#C05A40' },
        { id: 2, name: 'Panadería', icon: 'croissant', color_hex: '#B45309' },
        { id: 3, name: 'Postres', icon: 'ice-cream-cone', color_hex: '#DB2777' },
        { id: 4, name: 'Bocadillos', icon: 'sandwich', color_hex: '#0369A1' },
        { id: 5, name: 'Batidos', icon: 'cup-soda', color_hex: '#7C3AED' },
        { id: 6, name: 'Mostrador', icon: 'store', color_hex: '#047857' },
        { id: 7, name: 'Limpieza', icon: 'spray-can', color_hex: '#4B5563' },
    ].map(d => ({ ...d, active: 1 })),
    origins: [
        { id: 1, code: 'COMPRA', name: 'Compra', description: 'Mercancía que llega de un proveedor con factura o nota.', icon: 'shopping-bag', color_hex: '#047857', requires_supplier: 1, updates_cost: 1, starts_pending: 0, is_system: 0 },
        { id: 2, code: 'COMPRA_SP', name: 'Compra sin proveedor', description: 'Compra en tienda o mercado sin proveedor dado de alta.', icon: 'shopping-basket', color_hex: '#0369A1', requires_supplier: 0, updates_cost: 1, starts_pending: 0, is_system: 0 },
        { id: 3, code: 'PRODUCCION', name: 'Producción', description: 'Lo que salió del horno: nace pendiente y suma al confirmarla.', icon: 'chef-hat', color_hex: '#C05A40', requires_supplier: 0, updates_cost: 0, starts_pending: 1, is_system: 0 },
        { id: 4, code: 'DEVOLUCION', name: 'Devolución', description: 'Producto que regresa al almacén y se puede volver a usar.', icon: 'undo-2', color_hex: '#7C3AED', requires_supplier: 0, updates_cost: 0, starts_pending: 0, is_system: 0 },
        { id: 5, code: 'INICIAL', name: 'Inventario inicial', description: 'Carga de arranque del módulo.', icon: 'flag', color_hex: '#4B5563', requires_supplier: 0, updates_cost: 1, starts_pending: 0, is_system: 0 },
        { id: 6, code: 'AJUSTE', name: 'Entrada por ajuste', description: 'Corrección manual de existencia fuera de un conteo.', icon: 'sliders-horizontal', color_hex: '#B45309', requires_supplier: 0, updates_cost: 0, starts_pending: 0, is_system: 0 },
        { id: 7, code: 'EDA', name: 'Nota sencilla', description: 'Entrada rápida sin documento.', icon: 'sticky-note', color_hex: '#6B7280', requires_supplier: 0, updates_cost: 0, starts_pending: 0, is_system: 0 },
        { id: 8, code: 'SURTIDO_SUC', name: 'Surtido de la Matriz', description: 'La crea el sistema al surtir una requisición; espera tu «Recibí».', icon: 'truck', color_hex: '#0369A1', requires_supplier: 0, updates_cost: 0, starts_pending: 0, is_system: 1 },
    ].map(o => ({ ...o, active: 1 })),
    reasons: [
        { id: 1, code: 'CONSUMO', name: 'Consumo de producción', description: 'Insumos que usa un departamento para producir.', icon: 'chef-hat', color_hex: '#C05A40', is_loss: 0, requires_evidence: 0, requires_department: 1, is_system: 0 },
        { id: 2, code: 'PEDIDO_COMP', name: 'Pedido complementario', description: 'Material extra para un pedido especial.', icon: 'cake', color_hex: '#B45309', is_loss: 0, requires_evidence: 0, requires_department: 0, is_system: 0 },
        { id: 3, code: 'DEGUSTACION', name: 'Degustación', description: 'Producto que se da a probar.', icon: 'utensils', color_hex: '#7C3AED', is_loss: 0, requires_evidence: 0, requires_department: 0, is_system: 0 },
        { id: 4, code: 'MERMA', name: 'Merma', description: 'Pérdida sin otra clasificación.', icon: 'trash-2', color_hex: '#E11D48', is_loss: 1, requires_evidence: 1, requires_department: 0, is_system: 0 },
        { id: 5, code: 'CADUCIDAD', name: 'Caducidad', description: 'Venció la vida útil.', icon: 'calendar-x', color_hex: '#E11D48', is_loss: 1, requires_evidence: 1, requires_department: 0, is_system: 0 },
        { id: 6, code: 'DANO', name: 'Dañado', description: 'Golpeado, roto o derramado.', icon: 'package-x', color_hex: '#E11D48', is_loss: 1, requires_evidence: 1, requires_department: 0, is_system: 0 },
        { id: 7, code: 'ERROR_PROD', name: 'Error de producción', description: 'Salió mal del horno o de la decoración.', icon: 'flame', color_hex: '#E11D48', is_loss: 1, requires_evidence: 1, requires_department: 0, is_system: 0 },
        { id: 8, code: 'FALTANTE', name: 'Robo / Faltante', description: 'Desapareció sin explicación.', icon: 'shield-alert', color_hex: '#E11D48', is_loss: 1, requires_evidence: 0, requires_department: 0, is_system: 0 },
        { id: 9, code: 'SURTIDO_SUC', name: 'Surtido a sucursal', description: 'La crea el sistema al surtir una requisición.', icon: 'truck', color_hex: '#0369A1', is_loss: 0, requires_evidence: 0, requires_department: 0, is_system: 1 },
        { id: 10, code: 'SALIDA_POR_VENTA', name: 'Venta POS', description: 'La crea el POS al cobrar o entregar.', icon: 'shopping-cart', color_hex: '#047857', is_loss: 0, requires_evidence: 0, requires_department: 0, is_system: 1 },
    ].map(r => ({ ...r, active: 1 })),
    adjReasons: [
        { id: 1, code: 'CONTEO_FISICO', name: 'Conteo físico', icon: 'clipboard-check', color_hex: '#C05A40', affects_cost: 1, is_system: 0 },
        { id: 2, code: 'FALTANTE', name: 'Faltante sin explicar', icon: 'circle-minus', color_hex: '#E11D48', affects_cost: 1, is_system: 0 },
        { id: 3, code: 'SOBRANTE', name: 'Sobrante', icon: 'circle-plus', color_hex: '#047857', affects_cost: 1, is_system: 0 },
        { id: 4, code: 'CIERRE_MENSUAL', name: 'Cierre mensual', icon: 'calendar-check', color_hex: '#0369A1', affects_cost: 1, is_system: 0 },
        { id: 5, code: 'ENTRADA_NO_REG', name: 'Entrada no registrada', icon: 'file-question', color_hex: '#B45309', affects_cost: 0, is_system: 0 },
        { id: 6, code: 'PRESENTACION', name: 'Pasó a presentación', icon: 'boxes', color_hex: '#4B5563', affects_cost: 0, is_system: 1 },
    ].map(r => ({ ...r, active: 1 })),
    transferStatus: [
        { id: 1, code: 'REQUESTED', name: 'Solicitado', name_out: 'Enviado', name_in: 'Por recibir', icon: 'send', color_hex: '#B45309', is_terminal: 0 },
        { id: 2, code: 'RECEIVED', name: 'Recibido', name_out: 'Entregado', name_in: 'Recibido', icon: 'circle-check', color_hex: '#047857', is_terminal: 1 },
        { id: 3, code: 'REJECTED', name: 'Rechazado', name_out: 'Rechazado', name_in: 'Rechazado', icon: 'circle-x', color_hex: '#E11D48', is_terminal: 1 },
        { id: 4, code: 'CANCELLED', name: 'Cancelado', name_out: 'Cancelado', name_in: 'Cancelado', icon: 'ban', color_hex: '#6B7280', is_terminal: 1 },
    ].map(s => ({ ...s, active: 1 })),
    reqStatus: [
        { id: 1, code: 'BORRADOR', name: 'Borrador', icon: 'pencil-line', color_hex: '#6B7280', is_terminal: 0 },
        { id: 2, code: 'EN_ESPERA', name: 'En espera', icon: 'clock-3', color_hex: '#B45309', is_terminal: 0 },
        { id: 3, code: 'SURTIDO_PARCIAL', name: 'Surtido parcialmente', icon: 'circle-dashed', color_hex: '#0369A1', is_terminal: 0 },
        { id: 4, code: 'ENTREGADO', name: 'Entregado', icon: 'truck', color_hex: null, is_terminal: 0 },
        { id: 5, code: 'CONFIRMADO', name: 'Confirmado', icon: 'circle-check', color_hex: '#047857', is_terminal: 1 },
        { id: 6, code: 'RECHAZADA', name: 'Rechazada', icon: 'circle-x', color_hex: '#E11D48', is_terminal: 1 },
        { id: 7, code: 'CANCELADA', name: 'Cancelada', icon: 'ban', color_hex: '#6B7280', is_terminal: 1 },
    ].map(s => ({ ...s, active: 1 })),

    items: [],          // se arman abajo
    presentations: [],
    formats: [],
    // Productos del POS que todavía no llevan inventario (para «Producto del POS» en Catálogo)
    posFree: [
        { id: 31, name: 'Delicia de Mango 20', category_id: 102, price: 850 },
        { id: 33, name: 'Birthday Cake 18', category_id: 102, price: 700 },
        { id: 57, name: 'Tarta de Limón con Merengue Gde', category_id: 103, price: 550 },
        { id: 63, name: 'Gelatina de Mosaico', category_id: 103, price: 360 },
        { id: 74, name: 'Mini Berlinesa Zarzamora 15PZ', category_id: 103, price: 120 },
        { id: 168, name: 'Bollo de Queso Philadelphia Finas Hierbas', category_id: 104, price: 12 },
    ],

    // -- Saldo vivo y documentos (los llena el motor en inv-core.js) --
    stock: {},          // `${warehouse_id}:${item_id}` -> { quantity, stock_min, stock_max, last_movement_at, last_count_at }
    lots: [],
    inflows: [], outflows: [], transfers: [], adjustments: [], requisitions: [],
    moves: [],          // = vista inventory_movement
    folios: {},         // folio_series: `${doc_type}-${branch_code}` -> last_number
    seq: {},            // AUTO_INCREMENT simulado por tabla
};

// -- Roles de prueba («Ver como» en la barra) --
// Mismo modelo que pro: casillas por sección en permissions_roles (Developer › Accesos › Roles y Permisos).
// Secciones nuevas del módulo 3: inv-stock, inv-entradas, inv-salidas, inv-traspasos, inv-requisiciones,
// inv-surtir, inv-kardex, inv-reportes, inv-catalogo. Inicio no es sección: lo ve todo el que entra al módulo.
// Casillas de siempre: show, create, update, cancel, delete, print. Nuevas: 'ver-costos' (por sección: costos,
// valores e importes), 'aplicar-ajuste' (en inv-stock: aplicar un conteo físico) y 'producir' (en inv-entradas:
// producción del día; 'create' queda para compras, devoluciones y notas).
// Propuesta completa: pro/app/inventarios/docs/propuesta-roles.html
// Qué significa cada una por sección:
//   inv-stock          update = abrir y capturar un conteo · cancel = cancelar un ajuste aplicado (≤ 48 h)
//   inv-entradas       update = confirmar producción y editar · cancel = cancelar una entrada aplicada
//   inv-traspasos      update = confirmar la recepción o rechazar · cancel = cancelar un traspaso enviado
//   inv-requisiciones  update = editar borrador y dar «Recibí» · cancel = cancelar la propia
//   inv-surtir         update = surtir · cancel = rechazar
//   inv-catalogo       delete = desactivar
// Las sucursales NO son permiso: salen de users_braches, como en Pedidos.
const P = (...t) => t;
const ALL = ['show', 'create', 'update', 'cancel', 'delete', 'print', 'ver-costos'];
const ROLES = {
    dueno: {
        name: 'Dueña', user: 22, initials: 'AM', hex: '#C05A40', icon: 'crown', branch: 2, branches: [2, 3, 4],
        desc: 'Todo, en todas las sucursales. Es la única que da de alta y de baja en el Catálogo.',
        perms: { 'inv-stock': [...ALL, 'aplicar-ajuste'], 'inv-entradas': [...ALL, 'producir'],'inv-salidas': ALL, 'inv-traspasos': ALL, 'inv-requisiciones': ALL, 'inv-surtir': ALL, 'inv-kardex': P('show', 'print', 'ver-costos'), 'inv-reportes': P('show', 'print', 'ver-costos'), 'inv-catalogo': ALL },
    },
    supervisor: {
        name: 'Supervisor', user: 28, initials: 'LS', hex: '#7C3AED', icon: 'shield-check', branch: 2, branches: [2, 3, 4],
        desc: 'Revisa y corrige: aplica conteos, cancela documentos y ve el dinero. En el Catálogo solo edita.',
        perms: { 'inv-stock': P('show', 'update', 'cancel', 'print', 'ver-costos', 'aplicar-ajuste'), 'inv-entradas': P('show', 'create', 'producir', 'update', 'cancel', 'print', 'ver-costos'), 'inv-salidas': P('show', 'create', 'cancel', 'print', 'ver-costos'), 'inv-traspasos': P('show', 'create', 'update', 'cancel', 'print', 'ver-costos'), 'inv-requisiciones': P('show', 'create', 'update', 'cancel', 'print', 'ver-costos'), 'inv-surtir': P('show', 'update', 'cancel', 'print', 'ver-costos'), 'inv-kardex': P('show', 'print', 'ver-costos'), 'inv-reportes': P('show', 'print', 'ver-costos'), 'inv-catalogo': P('show', 'update', 'ver-costos') },
    },
    almacenista: {
        name: 'Almacenista', user: 27, initials: 'RL', hex: '#0369A1', icon: 'warehouse', branch: 2, branches: [2],
        desc: 'El almacén de la Matriz: recibe compras, surte requisiciones, envía traspasos y cuenta. No cancela ni aplica ajustes.',
        perms: { 'inv-stock': P('show', 'update', 'print'), 'inv-entradas': P('show', 'create', 'update', 'print', 'ver-costos'), 'inv-salidas': P('show', 'create', 'print'), 'inv-traspasos': P('show', 'create', 'update', 'print'), 'inv-surtir': P('show', 'update', 'print'), 'inv-kardex': P('show'), 'inv-catalogo': P('show') },
    },
    cajero: {
        name: 'Encargada de sucursal', user: 23, initials: 'RP', hex: '#047857', icon: 'store', branch: 3, branches: [3],
        desc: 'Su sucursal: pide a la Matriz, da «Recibí», recibe traspasos, registra mermas y cuenta a ciegas. No ve dinero.',
        perms: { 'inv-stock': P('show', 'update'), 'inv-entradas': P('show'), 'inv-salidas': P('show', 'create'), 'inv-traspasos': P('show', 'update'), 'inv-requisiciones': P('show', 'create', 'update', 'cancel') },
        reasons: ['MERMA', 'CADUCIDAD', 'DANO', 'DEGUSTACION', 'CONSUMO'],
    },
    produccion: {
        name: 'Producción', user: 25, initials: 'DC', hex: '#B45309', icon: 'chef-hat', branch: 2, branches: [2],
        desc: 'La cocina: registra y confirma la producción del día, pide insumos al almacén y anota lo que gasta o sale mal. No ve dinero.',
        perms: { 'inv-stock': P('show'), 'inv-entradas': P('show', 'producir', 'update'), 'inv-salidas': P('show', 'create'), 'inv-requisiciones': P('show', 'create', 'update', 'cancel') },
        reasons: ['CONSUMO', 'ERROR_PROD', 'MERMA'],
    },
};

// -- Áreas: 5 por almacén (warehouse_area) --
['Anaquel secos', 'Refrigerador', 'Congelador', 'Vitrina', 'Empaques'].forEach((name, i) => {
    DB.warehouses.forEach(w => DB.areas.push({
        id: (w.id - 1) * 5 + i + 1, name, warehouse_id: w.id, active: 1,
        color_hex: ['#B45309', '#0369A1', '#0891B2', '#C05A40', '#4B5563'][i],
    }));
});
DB.areas.sort((a, b) => a.id - b.id);
// Área por nombre (el artículo guarda la sugerida; en cada almacén se busca la del mismo nombre)
const AREA_NAME = { sec: 'Anaquel secos', ref: 'Refrigerador', con: 'Congelador', vit: 'Vitrina', emp: 'Empaques' };

// -- Insumos (kind = 'supply'): [nombre, categoría, unidad, costo, mín, máx, área, vida útil, lotes] --
const SUPPLIES = [
    ['Harina de trigo', 1, 'KG', 18.5, 40, 150, 'sec', 180, 0],
    ['Azúcar refinada', 1, 'KG', 26, 30, 120, 'sec', null, 0],
    ['Huevo', 1, 'PZA', 2.9, 180, 720, 'ref', 21, 1],
    ['Fécula de maíz 500 g', 1, 'PAQ', 35, 4, 20, 'sec', 365, 0],
    ['Polvo para hornear', 1, 'BOTE', 30, 3, 12, 'sec', 365, 0],
    ['Cocoa 500 g', 1, 'BOLSA', 85, 4, 16, 'sec', 365, 0],
    ['Chocolate Carat', 1, 'KG', 130, 8, 30, 'sec', 270, 0],
    ['Ganache oscuro', 1, 'KG', 150, 4, 16, 'ref', 60, 1],
    ['Lechera', 1, 'LATA', 32, 24, 96, 'sec', 365, 0],
    ['Carnation', 1, 'LATA', 48, 24, 96, 'sec', 365, 0],
    ['Nuez picada 500 g', 1, 'BOLSA', 95, 3, 12, 'sec', 120, 0],
    ['Galleta Marías', 1, 'ROLLO', 25, 10, 40, 'sec', 180, 0],
    ['Extracto de vainilla', 1, 'LT', 95, 2, 8, 'sec', 365, 0],
    ['Jarabe 3 leches', 2, 'LT', 90, 20, 80, 'ref', 7, 1],
    ['Crema para batir Bettercream', 2, 'CAJA', 320, 4, 16, 'ref', 30, 1],
    ['Queso crema Santa Cruz', 2, 'KG', 120, 6, 24, 'ref', 20, 1],
    ['Leche entera', 2, 'LT', 26, 24, 96, 'ref', 10, 1],
    ['Mantequilla Asturias', 3, 'KG', 130, 10, 40, 'ref', 60, 0],
    ['Margarina bizcocho', 3, 'KG', 110, 6, 24, 'ref', 90, 0],
    ['Manga de fresa', 4, 'KG', 120, 6, 24, 'ref', 30, 0],
    ['Manga de zarzamora', 4, 'KG', 125, 6, 24, 'ref', 30, 0],
    ['Mermelada de fresa', 4, 'FRASCO', 75, 4, 16, 'sec', 180, 0],
    ['Dulce de leche', 4, 'LATA', 55, 8, 30, 'sec', 270, 0],
    ['Cajeta', 4, 'KG', 90, 3, 12, 'sec', 180, 0],
    ['Fresas congeladas 2 kg', 4, 'BOLSA', 160, 3, 12, 'con', 180, 0],
    ['Granillo de colores', 5, 'BOLSA', 60, 3, 12, 'sec', 365, 0],
    ['Diamantina dorada', 5, 'PZA', 45, 2, 8, 'sec', null, 0],
    ['Cerezas 3.5 kg', 5, 'BOTE', 210, 1, 4, 'ref', 120, 0],
    ['Domo rebanadas', 6, 'PZA', 3.5, 150, 600, 'emp', null, 0],
    ['Domo cupcake', 6, 'PZA', 4.2, 100, 400, 'emp', null, 0],
    ['Domo C-15N', 6, 'PZA', 12, 30, 120, 'emp', null, 0],
    ['Caja pastel 25x25x6 cm', 7, 'PZA', 14, 40, 160, 'emp', null, 0],
    ['Caja de 6 cupcakes', 7, 'PZA', 9, 30, 120, 'emp', null, 0],
    ['Caja para tarta', 7, 'PZA', 11, 30, 120, 'emp', null, 0],
    ['Base 20 cm', 7, 'PZA', 11, 20, 80, 'emp', null, 0],
    ['Base 30 cm', 7, 'PZA', 17, 15, 60, 'emp', null, 0],
    ['Mangas de plástico', 8, 'PZA', 1.8, 60, 240, 'emp', null, 0],
    ['Paquete de tenedores', 8, 'PAQ', 35, 10, 40, 'emp', null, 0],
    ['Rompope', 9, 'BOT', 85, 3, 12, 'sec', 365, 0],
    ['Licor de Baileys', 9, 'BOT', 320, 2, 6, 'sec', 365, 0],
    ['Desengrasante 5 L', 10, 'PZA', 145, 2, 6, 'sec', null, 0],
    ['Jabón líquido 5 L', 10, 'PZA', 120, 2, 6, 'sec', null, 0],
];
// -- Productos terminados (kind = 'product'): [product_id, nombre, categoría POS, precio, costo, mín, máx, área, vida útil] --
const PRODUCTS = [
    [2, 'Tres Leches Manjar', 101, 240, 92, 4, 16, 'ref', 5],
    [8, 'Tres Leches Fresas con Crema', 101, 240, 96, 4, 16, 'ref', 4],
    [3, 'Tres Leches Manjar 12', 101, 360, 138, 2, 8, 'ref', 5],
    [11, 'Tres Leches Fresas con Crema 18', 101, 480, 185, 1, 6, 'ref', 4],
    [21, 'Pastel de Zanahoria', 101, 300, 105, 2, 8, 'vit', 7],
    [25, 'Red Velvet', 101, 480, 168, 2, 6, 'ref', 5],
    [27, 'Cheesecake de Fresa', 101, 480, 172, 2, 6, 'ref', 5],
    [23, 'Pastel de la Abuela', 101, 280, 98, 2, 8, 'vit', 6],
    [30, 'Delicia de Mango', 102, 450, 170, 1, 4, 'ref', 4],
    [38, 'Ferrero', 102, 550, 205, 1, 4, 'ref', 6],
    [55, 'Chocoflan', 103, 380, 130, 2, 6, 'ref', 5],
    [103, 'Tarta de Manzana', 103, 400, 140, 1, 4, 'vit', 5],
    [88, 'Cupcake de Vainilla pz', 103, 35, 11, 24, 96, 'vit', 3],
    [87, 'Cupcake de Chocolate pz', 103, 37.5, 12, 24, 96, 'vit', 3],
    [147, 'Galletas Mantequilla 500 g', 103, 180, 62, 6, 24, 'vit', 30],
    [140, 'Gelatina Mosaico pz 60 oz', 103, 15, 5, 12, 48, 'ref', 4],
    [66, 'Cuerno de Jamón con Queso Amarillo', 104, 15, 5.5, 20, 80, 'vit', 2],
    [171, 'Tarta Quiche Lorraine', 104, 25, 9, 12, 48, 'vit', 2],
    [65, 'Bolillo Integral', 105, 5.5, 1.6, 30, 120, 'vit', 2],
    [183, 'Polvorón', 105, 45, 14, 10, 40, 'vit', 15],
];

(() => {
    const unitId = code => DB.units.find(u => u.code === code).id;
    const areaOfWh1 = key => DB.areas.find(a => a.warehouse_id === 1 && a.name === AREA_NAME[key]).id;
    let id = 0;
    SUPPLIES.forEach(([name, cat, unit, cost, min, max, area, life, lots], i) => {
        id++;
        DB.items.push({
            id, kind: 'supply', name, sku: `${String(cat).padStart(2, '0')}${String(i + 1).padStart(3, '0')}`, barcode: '', description: '',
            cost, cost_tax: 0, average_cost: cost, stock_min: min, stock_max: max, shelf_life_days: life, track_lots: lots, is_inventoriable: 1,
            branch_id: 2, item_category_id: cat, unit_id: unitId(unit), warehouse_area_id: areaOfWh1(area), product_id: null, active: 1,
        });
    });
    PRODUCTS.forEach(([pid, name, cat, price, cost, min, max, area, life]) => {
        id++;
        DB.items.push({
            id, kind: 'product', name, sku: `PT${String(pid).padStart(4, '0')}`, barcode: '', description: '',
            cost, cost_tax: 0, average_cost: cost, stock_min: min, stock_max: max, shelf_life_days: life, track_lots: 1, is_inventoriable: 1,
            branch_id: 2, item_category_id: null, pos_category_id: cat, price, unit_id: unitId('PZA'), warehouse_area_id: areaOfWh1(area), product_id: pid, active: 1,
        });
    });
    DB.seq.item = id;
    const byName = n => DB.items.find(i => i.name === n).id;
    DB.presentations = [
        { id: 1, item_id: byName('Harina de trigo'), name: 'Bulto 25 kg', description: '', sku: '01001-25', factor: 25, cost: 440, unit_id: unitId('BOLSA'), active: 1 },
        { id: 2, item_id: byName('Crema para batir Bettercream'), name: 'Caja master 12', description: '', sku: '02015-12', factor: 12, cost: 3720, unit_id: unitId('CAJA'), active: 1 },
        { id: 3, item_id: byName('Domo rebanadas'), name: 'Paquete 50 pz', description: '', sku: '06029-50', factor: 50, cost: 165, unit_id: unitId('PAQ'), active: 1 },
        { id: 4, item_id: byName('Huevo'), name: 'Caja 360 pz', description: '', sku: '01003-360', factor: 360, cost: 1010, unit_id: unitId('CAJA'), active: 1 },
    ];
    DB.seq.presentation = 4;
})();

// -- Documentos de arranque. d = días contra hoy (0 = hoy, -1 = ayer). Renglones por NOMBRE del artículo. --
// El motor los aplica en orden de fecha (inv-core.js › seedRun).
const SEED_DOCS = [
    // Inventario inicial de los tres almacenes
    { t: 'in', d: -21, h: '07:10', branch: 2, wh: 1, origin: 'INICIAL', user: 22, note: 'Carga de arranque del módulo', lines: 'supplies:1.0' },
    { t: 'in', d: -21, h: '07:40', branch: 3, wh: 2, origin: 'INICIAL', user: 23, note: 'Carga de arranque del módulo', lines: 'supplies:0.25' },
    { t: 'in', d: -21, h: '08:05', branch: 4, wh: 3, origin: 'INICIAL', user: 26, note: 'Carga de arranque del módulo', lines: 'supplies:0.2' },

    // Compras
    { t: 'in', d: -9, h: '10:15', branch: 2, wh: 1, origin: 'COMPRA', supplier: 3, invoice: 'NV-2291', user: 22, lines: [['Galleta Marías', 20, 24], ['Nuez picada 500 g', 6, 98], ['Dulce de leche', 12, 55], ['Cajeta', 4, 90]] },
    { t: 'in', d: -6, h: '09:30', branch: 2, wh: 1, origin: 'COMPRA', supplier: 1, invoice: 'F-88213', user: 22, voucher: 1,
        lines: [['Harina de trigo', 50, 18.9, 'p1:2'], ['Azúcar refinada', 40, 25.5], ['Mantequilla Asturias', 15, 132], ['Lechera', 48, 31.5], ['Carnation', 48, 47], ['Crema para batir Bettercream', 6, 318]] },
    { t: 'in', d: -3, h: '08:20', branch: 2, wh: 1, origin: 'COMPRA', supplier: 2, invoice: 'LS-10457', user: 25,
        lines: [['Jarabe 3 leches', 30, 92, 'L-1119', 5], ['Queso crema Santa Cruz', 10, 121, 'L-3381', 18], ['Leche entera', 36, 26.5, 'L-7740', 7], ['Huevo', 360, 2.85, 'p4:1', 18]] },
    { t: 'in', d: -4, h: '12:40', branch: 3, wh: 2, origin: 'COMPRA_SP', user: 23, note: 'Compra en Chedraui por falta de leche', lines: [['Leche entera', 12, 28, 'CH-221', 8], ['Paquete de tenedores', 4, 38]] },

    // Producción en la Matriz (cocina en Guadalupe): nace pendiente, se confirma y suma
    { t: 'prod', d: -2, h: '06:30', branch: 2, wh: 1, user: 25, confirm: '07:45', lines: [['Tres Leches Manjar', 12], ['Tres Leches Fresas con Crema', 10], ['Tres Leches Manjar 12', 4], ['Pastel de Zanahoria', 6], ['Red Velvet', 5], ['Cheesecake de Fresa', 6], ['Cupcake de Vainilla pz', 48], ['Cupcake de Chocolate pz', 48], ['Cuerno de Jamón con Queso Amarillo', 40], ['Tarta Quiche Lorraine', 24], ['Bolillo Integral', 80], ['Chocoflan', 4], ['Galletas Mantequilla 500 g', 12], ['Polvorón', 20]] },
    { t: 'prod', d: -1, h: '06:20', branch: 2, wh: 1, user: 25, confirm: '07:30', lines: [['Tres Leches Manjar', 8], ['Tres Leches Fresas con Crema', 8], ['Tres Leches Fresas con Crema 18', 2], ['Pastel de la Abuela', 5], ['Delicia de Mango', 2], ['Ferrero', 2], ['Tarta de Manzana', 3], ['Cupcake de Vainilla pz', 36], ['Cupcake de Chocolate pz', 36], ['Cuerno de Jamón con Queso Amarillo', 30], ['Tarta Quiche Lorraine', 18], ['Bolillo Integral', 70], ['Gelatina Mosaico pz 60 oz', 24]] },
    { t: 'prod', d: 0, h: '06:15', branch: 2, wh: 1, user: 25, lines: [['Tres Leches Manjar', 10], ['Tres Leches Fresas con Crema', 8], ['Red Velvet', 3], ['Cheesecake de Fresa', 3], ['Cupcake de Vainilla pz', 36], ['Cupcake de Chocolate pz', 24], ['Cuerno de Jamón con Queso Amarillo', 30], ['Bolillo Integral', 60]] },

    // Consumo de producción (salidas con departamento)
    { t: 'out', d: -2, h: '06:00', branch: 2, wh: 1, reason: 'CONSUMO', dept: 1, user: 25, lines: [['Harina de trigo', 14], ['Azúcar refinada', 9], ['Huevo', 150], ['Mantequilla Asturias', 4], ['Lechera', 12], ['Carnation', 12], ['Jarabe 3 leches', 9], ['Crema para batir Bettercream', 2], ['Queso crema Santa Cruz', 3], ['Manga de fresa', 2]] },
    { t: 'out', d: -1, h: '05:50', branch: 2, wh: 1, reason: 'CONSUMO', dept: 2, user: 25, lines: [['Harina de trigo', 11], ['Azúcar refinada', 3], ['Huevo', 60], ['Margarina bizcocho', 3], ['Mantequilla Asturias', 2]] },
    { t: 'out', d: -1, h: '06:05', branch: 2, wh: 1, reason: 'CONSUMO', dept: 1, user: 25, lines: [['Jarabe 3 leches', 8], ['Lechera', 10], ['Carnation', 10], ['Crema para batir Bettercream', 1], ['Fresas congeladas 2 kg', 1], ['Chocolate Carat', 2]] },
    { t: 'out', d: -6, h: '16:20', branch: 3, wh: 2, reason: 'CONSUMO', dept: 5, user: 23, lines: [['Leche entera', 6]] },

    // Traspasos de producto terminado de la Matriz a las sucursales
    { t: 'tra', d: -2, h: '08:10', branch: 2, wh: 1, to: 2, user: 22, recv: { h: '09:05', user: 23 }, lines: [['Tres Leches Manjar', 4], ['Tres Leches Fresas con Crema', 3], ['Cupcake de Vainilla pz', 12], ['Cupcake de Chocolate pz', 12], ['Cuerno de Jamón con Queso Amarillo', 10], ['Bolillo Integral', 20]] },
    { t: 'tra', d: -2, h: '08:25', branch: 2, wh: 1, to: 3, user: 22, recv: { h: '09:40', user: 26 }, lines: [['Tres Leches Manjar', 3], ['Pastel de Zanahoria', 2], ['Cupcake de Vainilla pz', 12], ['Tarta Quiche Lorraine', 8], ['Bolillo Integral', 20]] },
    { t: 'tra', d: -1, h: '08:00', branch: 2, wh: 1, to: 2, user: 22, recv: { h: '08:50', user: 23, short: { 'Cupcake de Chocolate pz': 10 } }, lines: [['Tres Leches Fresas con Crema', 3], ['Pastel de la Abuela', 2], ['Cupcake de Chocolate pz', 12], ['Gelatina Mosaico pz 60 oz', 8], ['Cuerno de Jamón con Queso Amarillo', 10]] },
    { t: 'tra', d: -5, h: '17:30', branch: 4, wh: 3, to: 1, user: 26, reject: { h: '18:10', user: 22, reason: 'La Matriz no lo necesita; quédatelo en Cuarta.' }, lines: [['Rompope', 1]] },
    { t: 'tra', d: 0, h: '08:05', branch: 2, wh: 1, to: 2, user: 22, lines: [['Red Velvet', 2], ['Cheesecake de Fresa', 2], ['Tarta Quiche Lorraine', 8], ['Delicia de Mango', 1]] },

    // Ventas del POS (las crea el POS al cobrar o entregar; folio de la venta)
    { t: 'sale', d: -2, h: '13:20', branch: 2, wh: 1, folio: 'P1652', user: 24, lines: [['Tres Leches Manjar 12', 2], ['Red Velvet', 1]] },
    { t: 'sale', d: -2, h: '17:45', branch: 3, wh: 2, folio: 'V1688', user: 23, lines: [['Cupcake de Vainilla pz', 9], ['Cupcake de Chocolate pz', 7], ['Tres Leches Manjar', 2], ['Bolillo Integral', 12]] },
    { t: 'sale', d: -1, h: '12:10', branch: 2, wh: 1, folio: 'P1655', user: 24, lines: [['Tres Leches Fresas con Crema', 6], ['Cheesecake de Fresa', 2], ['Cupcake de Vainilla pz', 24]] },
    { t: 'sale', d: -1, h: '18:30', branch: 3, wh: 2, folio: 'V1701', user: 23, lines: [['Cupcake de Chocolate pz', 6], ['Tres Leches Fresas con Crema', 1], ['Cuerno de Jamón con Queso Amarillo', 14], ['Gelatina Mosaico pz 60 oz', 3]] },
    { t: 'sale', d: -1, h: '19:05', branch: 4, wh: 3, folio: 'V1703', user: 26, lines: [['Tres Leches Manjar', 2], ['Tarta Quiche Lorraine', 6], ['Bolillo Integral', 15]] },
    { t: 'sale', d: 0, h: '10:40', branch: 2, wh: 1, folio: 'V1709', user: 24, lines: [['Cuerno de Jamón con Queso Amarillo', 12], ['Polvorón', 3], ['Galletas Mantequilla 500 g', 2]] },

    // Mermas (motivo de salida con is_loss = 1)
    { t: 'out', d: -1, h: '20:10', branch: 3, wh: 2, reason: 'CADUCIDAD', user: 23, evidence: 1, note: 'Vencieron en vitrina', lines: [['Tres Leches Manjar', 1], ['Bolillo Integral', 6]] },
    { t: 'out', d: -1, h: '07:00', branch: 2, wh: 1, reason: 'ERROR_PROD', user: 25, evidence: 1, note: 'Se quemó la base', lines: [['Red Velvet', 1]] },
    { t: 'out', d: -3, h: '15:30', branch: 4, wh: 3, reason: 'DANO', user: 26, evidence: 1, note: 'Se cayó la charola al acomodar', lines: [['Leche entera', 2], ['Domo rebanadas', 6]] },
    { t: 'out', d: 0, h: '09:15', branch: 2, wh: 1, reason: 'DEGUSTACION', user: 22, note: 'Degustación de boda Martínez', lines: [['Cupcake de Chocolate pz', 4], ['Cheesecake de Fresa', 1]] },
    { t: 'out', d: -8, h: '19:40', branch: 2, wh: 1, reason: 'FALTANTE', user: 22, note: 'No apareció en el anaquel', lines: [['Licor de Baileys', 1]] },

    // Requisiciones: las sucursales piden a la Matriz
    { t: 'req', d: -3, h: '11:20', branch: 3, user: 23, dept: 6, need: -2, note: 'Para el fin de semana',
        lines: [['Domo rebanadas', 80], ['Caja de 6 cupcakes', 30], ['Mangas de plástico', 60]],
        supply: [{ d: -2, h: '09:30', user: 22, qty: { 'Domo rebanadas': 80, 'Caja de 6 cupcakes': 30, 'Mangas de plástico': 60 } }], recibi: { d: -2, h: '12:15', user: 23 } },
    { t: 'req', d: -2, h: '16:00', branch: 4, user: 26, dept: 1, need: -1,
        lines: [['Harina de trigo', 10], ['Azúcar refinada', 6], ['Mantequilla Asturias', 3]],
        supply: [{ d: -1, h: '10:05', user: 22, note: 'La harina llega el lunes; mando lo que hay.', qty: { 'Mantequilla Asturias': 3, 'Azúcar refinada': 4 } }] },
    { t: 'req', d: -2, h: '18:40', branch: 3, user: 23, dept: 6, need: -1,
        lines: [['Caja pastel 25x25x6 cm', 20], ['Base 20 cm', 20], ['Domo C-15N', 10, 'Si no hay, Domo rebanadas']],
        supply: [{ d: -1, h: '09:10', user: 22, qty: { 'Caja pastel 25x25x6 cm': 20, 'Base 20 cm': 20 }, sub: { 'Domo C-15N': ['Domo rebanadas', 10] } }] },
    { t: 'req', d: -1, h: '19:30', branch: 3, user: 23, dept: 5, need: 0, note: 'Se acabó la leche para frappés',
        lines: [['Leche entera', 12], ['Crema para batir Bettercream', 2], ['Paquete de tenedores', 3]] },
    { t: 'req', d: 0, h: '08:40', branch: 4, user: 26, dept: 1, need: 1,
        lines: [['Jarabe 3 leches', 6], ['Lechera', 12], ['Carnation', 12], ['Queso crema Santa Cruz', 2, 'Para cheesecake del sábado']] },
    { t: 'req', d: 0, h: '09:50', branch: 4, user: 26, dept: 7, need: 2, draft: 1, lines: [['Desengrasante 5 L', 1], ['Jabón líquido 5 L', 1]] },
    // La cocina de la Matriz le pide al almacén de su misma sucursal
    { t: 'req', d: 0, h: '05:40', branch: 2, user: 25, dept: 1, need: 0, note: 'Para los tres leches de hoy',
        lines: [['Jarabe 3 leches', 10], ['Crema para batir Bettercream', 2], ['Huevo', 120], ['Lechera', 12]] },

    // Conteos físicos
    { t: 'count', d: -7, h: '20:30', branch: 2, wh: 1, area: 'Anaquel secos', user: 22, apply: '21:10', blind: 0, diff: { 'Azúcar refinada': -1.5, 'Galleta Marías': -2, 'Lechera': 1, 'Cocoa 500 g': -1 } },
    { t: 'count', d: 0, h: '07:30', branch: 3, wh: 2, area: null, user: 23, blind: 1, partial: 0.6 },
];

// Formatos de entrada guardados (inflow_format): «Producción lunes» se usa en Producción del día
const SEED_FORMATS = [
    { name: 'Producción diaria', scope: 'branch', branch: 2, origin: 'PRODUCCION', user: 25,
        lines: [['Tres Leches Manjar', 10], ['Tres Leches Fresas con Crema', 8], ['Cupcake de Vainilla pz', 36], ['Cupcake de Chocolate pz', 36], ['Cuerno de Jamón con Queso Amarillo', 30], ['Tarta Quiche Lorraine', 18], ['Bolillo Integral', 60]] },
    { name: 'Producción sábado', scope: 'branch', branch: 2, origin: 'PRODUCCION', user: 25,
        lines: [['Tres Leches Manjar', 14], ['Tres Leches Fresas con Crema', 12], ['Tres Leches Manjar 12', 4], ['Red Velvet', 4], ['Cheesecake de Fresa', 4], ['Ferrero', 2], ['Cupcake de Vainilla pz', 48], ['Cupcake de Chocolate pz', 48], ['Bolillo Integral', 90]] },
    { name: 'Compra semanal Sam\'s', scope: 'user', branch: 2, origin: 'COMPRA', user: 22,
        lines: [['Harina de trigo', 50], ['Azúcar refinada', 40], ['Mantequilla Asturias', 15], ['Lechera', 48], ['Carnation', 48]] },
];
