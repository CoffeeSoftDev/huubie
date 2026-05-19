// ──────────────────────────────────────────────────────────────────────
//  SAMPLE — Administrador de Inventarios (Productos y Almacenes)
//  Productos extraidos de fayxzvov_reginas.order_products + order_category.
//  Sucursales extraidas de fayxzvov_alpha.subsidiaries.
//  Reginas es una pasteleria — las "areas" del inventario equivalen
//  a las categorias del POS (PASTELES, POSTRES, BOCADILLOS, etc.).
//  Snapshot via MySQL local — 2026-05-19.
// ──────────────────────────────────────────────────────────────────────

const SAMPLE_VIEW_HEADER_ADMIN = {
    title:    'Administrador de Inventarios',
    subtitle: 'Productos y almacenes — Reginas',
    back:     { href: '/app/inventarios/index.php', title: 'Regresar al inicio' }
};

const SAMPLE_VIEW_FOOTER_ADMIN = {
    info: 'Mostrando registros del catalogo',
    legends: [
        { tone: 'success', label: 'Activos'             },
        { tone: 'danger',  label: 'Inactivos'           },
        { tone: 'warning', label: 'Pasteles'            },
        { tone: 'info',    label: 'Postres'             },
        { tone: 'purple',  label: 'Bocadillos'          },
        { tone: 'success', label: 'Pan / Galletas'      }
    ]
};

const _AREA_THEME = {
    'PASTELES TRADICIONALES':  { iconBg: 'bg-amber-900/30',   iconText: 'text-amber-400',   badgeBg: 'rgba(251,191,36,0.15)',  badgeFg: '#FBBF24', category: 'Pasteleria'  },
    'PASTELES ESPECIALIDADES': { iconBg: 'bg-pink-900/30',    iconText: 'text-pink-400',    badgeBg: 'rgba(236,72,153,0.15)',  badgeFg: '#F472B6', category: 'Pasteleria'  },
    'POSTRES':                 { iconBg: 'bg-purple-900/30',  iconText: 'text-purple-400',  badgeBg: 'rgba(167,139,250,0.15)', badgeFg: '#A78BFA', category: 'Postres'     },
    'BOCADILLOS':              { iconBg: 'bg-orange-900/30',  iconText: 'text-orange-400',  badgeBg: 'rgba(251,146,60,0.15)',  badgeFg: '#FB923C', category: 'Salados'     },
    'CHAROLAS':                { iconBg: 'bg-rose-900/30',    iconText: 'text-rose-400',    badgeBg: 'rgba(251,113,133,0.15)', badgeFg: '#FB7185', category: 'Eventos'     },
    'PAN':                     { iconBg: 'bg-yellow-900/30',  iconText: 'text-yellow-400',  badgeBg: 'rgba(250,204,21,0.15)',  badgeFg: '#FACC15', category: 'Panaderia'   },
    'GALLETAS':                { iconBg: 'bg-emerald-900/30', iconText: 'text-emerald-400', badgeBg: 'rgba(63,193,137,0.15)',  badgeFg: '#3FC189', category: 'Galletas'    },
    'SOBRE PEDIDO':            { iconBg: 'bg-cyan-900/30',    iconText: 'text-cyan-400',    badgeBg: 'rgba(34,211,238,0.15)',  badgeFg: '#22D3EE', category: 'Sobre Pedido'}
};

const _SUCURSAL_BADGE = {
    'Marinni Centro':      { bg: 'rgba(167,139,250,0.15)', fg: '#A78BFA' },
    'Club Campestre':      { bg: 'rgba(28,100,242,0.15)',  fg: '#60A5FA' },
    'Reginas Central Gpe': { bg: 'rgba(251,146,60,0.15)',  fg: '#FB923C' },
    'Altozano':            { bg: 'rgba(63,193,137,0.15)',  fg: '#3FC189' },
    'Club campestre tap':  { bg: 'rgba(236,72,153,0.15)',  fg: '#F472B6' },
    'Reginas cuarta':      { bg: 'rgba(34,211,238,0.15)',  fg: '#22D3EE' },
    'Reginas kafeto':      { bg: 'rgba(251,191,36,0.15)',  fg: '#FBBF24' }
};

const _badgeArea = (area) => {
    const t = _AREA_THEME[area] || { badgeBg: 'rgba(156,163,175,0.18)', badgeFg: '#9CA3AF' };
    return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background:${t.badgeBg};color:${t.badgeFg};">${area}</span>`;
};

const _badgeSucursal = (sucursal) => {
    const c = _SUCURSAL_BADGE[sucursal] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
    return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background:${c.bg};color:${c.fg};">${sucursal}</span>`;
};

const _badgeEstadoActive = (active) => {
    if (active) {
        return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold" style="background:rgba(63,193,137,0.15);color:#3FC189;">ACTIVO</span>`;
    }
    return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold" style="background:rgba(244,63,94,0.15);color:#F43F5E;">INACTIVO</span>`;
};

const _productoIconCell = (p) => {
    const t = _AREA_THEME[p.area] || { iconBg: 'bg-gray-700/30', iconText: 'text-gray-400' };
    return `
        <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded ${t.iconBg} flex items-center justify-center">
                <i data-lucide="box" class="w-3 h-3 ${t.iconText}"></i>
            </div>
            <div>
                <p class="text-[11px] font-bold text-white leading-tight">${p.name}</p>
                <p class="text-[9px] text-gray-500 leading-tight">${p.category || ''}</p>
            </div>
        </div>`;
};

const _almacenIconCell = (a) => {
    return `
        <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded bg-[#1a2332] flex items-center justify-center">
                <i data-lucide="warehouse" class="w-3 h-3 text-gray-400"></i>
            </div>
            <div>
                <p class="text-[11px] font-bold text-white leading-tight">${a.name}</p>
                <p class="text-[9px] text-gray-500 leading-tight">${a.address || ''}</p>
            </div>
        </div>`;
};

const _fmtCosto = (n) => '$' + Number(n).toFixed(2);

// ──────────────────────────────────────────────────────────────────────
//  Productos — 96 reales de fayxzvov_reginas.order_products (subsidiaries_id=4).
//  Mapeo: id, name, price→precio_venta, active, category_id→area.
//  costo = price * 0.55 (margen estimado); max/min/vida_util fijados por
//  categoria (no existen en BD) y son placeholders editables.
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_PRODUCTOS_DB = {
    1:  { id: 1,  sku: 'RG-001', name: 'Pastel Tradicional de Mantequilla Relleno de Manjar', category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 253.00, vida_util: 5,  active: 1 },
    2:  { id: 2,  sku: 'RG-002', name: 'Tres Leches Manjar',                                  category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 132.00, vida_util: 5,  active: 1 },
    3:  { id: 3,  sku: 'RG-003', name: 'Tres Leches Manjar 12',                               category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 198.00, vida_util: 5,  active: 1 },
    4:  { id: 4,  sku: 'RG-004', name: 'Tres Leches Manjar 18',                               category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 264.00, vida_util: 5,  active: 1 },
    5:  { id: 5,  sku: 'RG-005', name: 'Tres Leches Moka',                                    category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 132.00, vida_util: 5,  active: 1 },
    6:  { id: 6,  sku: 'RG-006', name: 'Tres Leches Moka 12',                                 category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 198.00, vida_util: 5,  active: 1 },
    7:  { id: 7,  sku: 'RG-007', name: 'Tres Leches Moka 18',                                 category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 264.00, vida_util: 5,  active: 1 },
    8:  { id: 8,  sku: 'RG-008', name: 'Tres Leches Fresas con Crema',                        category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 132.00, vida_util: 5,  active: 1 },
    9:  { id: 9,  sku: 'RG-009', name: 'Bolsa de Chispas de Chocolate',                       category: 'Galletas',    area: 'GALLETAS',                 max: 200, min: 30, costo: 24.75,  vida_util: 30, active: 0 },
    10: { id: 10, sku: 'RG-010', name: 'Tres Leches Fresas con Crema 12',                     category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 198.00, vida_util: 5,  active: 1 },
    11: { id: 11, sku: 'RG-011', name: 'Tres Leches Fresas con Crema 18',                     category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 264.00, vida_util: 5,  active: 1 },
    12: { id: 12, sku: 'RG-012', name: 'Tres Leches Capuccino',                               category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 132.00, vida_util: 5,  active: 1 },
    13: { id: 13, sku: 'RG-013', name: 'Tres Leches Capuccino 12',                            category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 198.00, vida_util: 5,  active: 1 },
    14: { id: 14, sku: 'RG-014', name: 'Tres Leches Capuccino 18',                            category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 264.00, vida_util: 5,  active: 1 },
    15: { id: 15, sku: 'RG-015', name: 'Tres Leches Zarzamora con Queso',                     category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 132.00, vida_util: 5,  active: 1 },
    16: { id: 16, sku: 'RG-016', name: 'Tres Leches Zarzamora con Queso 12',                  category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 198.00, vida_util: 5,  active: 1 },
    17: { id: 17, sku: 'RG-017', name: 'Tres Leches Zarzamora con Queso 18',                  category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 264.00, vida_util: 5,  active: 1 },
    18: { id: 18, sku: 'RG-018', name: 'Tres Leches Cajeta',                                  category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 132.00, vida_util: 5,  active: 1 },
    19: { id: 19, sku: 'RG-019', name: 'Tres Leches Cajeta 12',                               category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 198.00, vida_util: 5,  active: 1 },
    20: { id: 20, sku: 'RG-020', name: 'Tres Leches Cajeta 18',                               category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 264.00, vida_util: 5,  active: 1 },
    21: { id: 21, sku: 'RG-021', name: 'Pastel de Zanahoria',                                 category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 165.00, vida_util: 5,  active: 1 },
    22: { id: 22, sku: 'RG-022', name: 'Pastel de Zanahoria 15',                              category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 275.00, vida_util: 5,  active: 1 },
    23: { id: 23, sku: 'RG-023', name: 'Pastel de la Abuela',                                 category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 154.00, vida_util: 5,  active: 1 },
    24: { id: 24, sku: 'RG-024', name: 'Pastel de la Abuela 10',                              category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 253.00, vida_util: 5,  active: 1 },
    25: { id: 25, sku: 'RG-025', name: 'Red Velvet',                                          category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 264.00, vida_util: 5,  active: 1 },
    26: { id: 26, sku: 'RG-026', name: 'Cheesecake Tortuga',                                  category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 264.00, vida_util: 5,  active: 1 },
    27: { id: 27, sku: 'RG-027', name: 'Cheesecake de Fresa',                                 category: 'Pasteleria',  area: 'PASTELES TRADICIONALES',  max: 40,  min: 8,  costo: 264.00, vida_util: 5,  active: 1 },
    28: { id: 28, sku: 'RG-028', name: 'Lili Cake',                                           category: 'Pasteleria',  area: 'PASTELES ESPECIALIDADES', max: 30,  min: 5,  costo: 247.50, vida_util: 5,  active: 1 },
    29: { id: 29, sku: 'RG-029', name: 'Lili Cake 20',                                        category: 'Pasteleria',  area: 'PASTELES ESPECIALIDADES', max: 30,  min: 5,  costo: 467.50, vida_util: 5,  active: 1 },
    30: { id: 30, sku: 'RG-030', name: 'Delicia de Mango',                                    category: 'Pasteleria',  area: 'PASTELES ESPECIALIDADES', max: 30,  min: 5,  costo: 247.50, vida_util: 5,  active: 1 },
    31: { id: 31, sku: 'RG-031', name: 'Delicia de Mango 20',                                 category: 'Pasteleria',  area: 'PASTELES ESPECIALIDADES', max: 30,  min: 5,  costo: 467.50, vida_util: 5,  active: 1 },
    32: { id: 32, sku: 'RG-032', name: 'Birthday Cake',                                       category: 'Pasteleria',  area: 'PASTELES ESPECIALIDADES', max: 30,  min: 5,  costo: 225.50, vida_util: 5,  active: 1 },
    33: { id: 33, sku: 'RG-033', name: 'Birthday Cake 18',                                    category: 'Pasteleria',  area: 'PASTELES ESPECIALIDADES', max: 30,  min: 5,  costo: 385.00, vida_util: 5,  active: 1 },
    34: { id: 34, sku: 'RG-034', name: 'Conffeti Cake',                                       category: 'Pasteleria',  area: 'PASTELES ESPECIALIDADES', max: 30,  min: 5,  costo: 286.00, vida_util: 5,  active: 1 },
    35: { id: 35, sku: 'RG-035', name: 'Pastel de Berries',                                   category: 'Pasteleria',  area: 'PASTELES ESPECIALIDADES', max: 30,  min: 5,  costo: 242.00, vida_util: 5,  active: 1 },
    36: { id: 36, sku: 'RG-036', name: 'Dulce de Leche',                                      category: 'Pasteleria',  area: 'PASTELES ESPECIALIDADES', max: 30,  min: 5,  costo: 209.00, vida_util: 5,  active: 1 },
    37: { id: 37, sku: 'RG-037', name: 'Triple Chocolate',                                    category: 'Pasteleria',  area: 'PASTELES ESPECIALIDADES', max: 30,  min: 5,  costo: 264.00, vida_util: 5,  active: 1 },
    38: { id: 38, sku: 'RG-038', name: 'Ferrero',                                             category: 'Pasteleria',  area: 'PASTELES ESPECIALIDADES', max: 30,  min: 5,  costo: 302.50, vida_util: 5,  active: 1 },
    39: { id: 39, sku: 'RG-039', name: 'Brucecake',                                           category: 'Pasteleria',  area: 'PASTELES ESPECIALIDADES', max: 30,  min: 5,  costo: 225.50, vida_util: 5,  active: 1 },
    40: { id: 40, sku: 'RG-040', name: 'Bicolor',                                             category: 'Pasteleria',  area: 'PASTELES ESPECIALIDADES', max: 30,  min: 5,  costo: 242.00, vida_util: 5,  active: 1 },
    41: { id: 41, sku: 'RG-041', name: 'Fresa Bariloche',                                     category: 'Pasteleria',  area: 'PASTELES ESPECIALIDADES', max: 30,  min: 5,  costo: 231.00, vida_util: 5,  active: 1 },
    42: { id: 42, sku: 'RG-042', name: 'Triplecake',                                          category: 'Pasteleria',  area: 'PASTELES ESPECIALIDADES', max: 30,  min: 5,  costo: 302.50, vida_util: 5,  active: 1 },
    43: { id: 43, sku: 'RG-043', name: 'Tarta de Limón',                                      category: 'Sobre Pedido',area: 'SOBRE PEDIDO',            max: 20,  min: 2,  costo: 192.50, vida_util: 3,  active: 1 },
    44: { id: 44, sku: 'RG-044', name: 'Pan de Manzana',                                      category: 'Sobre Pedido',area: 'SOBRE PEDIDO',            max: 20,  min: 2,  costo: 220.00, vida_util: 3,  active: 1 },
    45: { id: 45, sku: 'RG-045', name: 'Volovanes de Pollo Enchipotlado',                     category: 'Sobre Pedido',area: 'SOBRE PEDIDO',            max: 200, min: 20, costo: 7.70,   vida_util: 2,  active: 1 },
    46: { id: 46, sku: 'RG-046', name: 'Volovan de Jamon con Queso',                          category: 'Sobre Pedido',area: 'SOBRE PEDIDO',            max: 200, min: 20, costo: 6.60,   vida_util: 2,  active: 1 },
    47: { id: 47, sku: 'RG-047', name: 'Chino',                                               category: 'Panaderia',   area: 'PAN',                      max: 300, min: 40, costo: 9.90,   vida_util: 2,  active: 1 },
    48: { id: 48, sku: 'RG-048', name: 'Cupcake Relleno de Limon',                            category: 'Sobre Pedido',area: 'SOBRE PEDIDO',            max: 20,  min: 2,  costo: 253.00, vida_util: 3,  active: 1 },
    49: { id: 49, sku: 'RG-049', name: 'Empanadas Dulces de Vitrina',                         category: 'Sobre Pedido',area: 'SOBRE PEDIDO',            max: 200, min: 20, costo: 9.90,   vida_util: 2,  active: 1 },
    50: { id: 50, sku: 'RG-050', name: 'Charola Casual',                                      category: 'Eventos',     area: 'CHAROLAS',                 max: 30,  min: 4,  costo: 145.75, vida_util: 5,  active: 1 },
    51: { id: 51, sku: 'RG-051', name: 'Charola Basica',                                      category: 'Eventos',     area: 'CHAROLAS',                 max: 30,  min: 4,  costo: 297.00, vida_util: 5,  active: 1 },
    52: { id: 52, sku: 'RG-052', name: 'Charola Suprema',                                     category: 'Eventos',     area: 'CHAROLAS',                 max: 30,  min: 4,  costo: 330.00, vida_util: 5,  active: 1 },
    53: { id: 53, sku: 'RG-053', name: 'Charola Cumpleañera',                                 category: 'Eventos',     area: 'CHAROLAS',                 max: 30,  min: 4,  costo: 288.75, vida_util: 5,  active: 1 },
    54: { id: 54, sku: 'RG-054', name: 'Charola Reginas Sweet',                               category: 'Eventos',     area: 'CHAROLAS',                 max: 30,  min: 4,  costo: 407.00, vida_util: 5,  active: 1 },
    55: { id: 55, sku: 'RG-055', name: 'Chocoflan',                                           category: 'Postres',     area: 'POSTRES',                  max: 80,  min: 12, costo: 209.00, vida_util: 7,  active: 1 },
    56: { id: 56, sku: 'RG-056', name: 'Pay',                                                 category: 'Postres',     area: 'POSTRES',                  max: 80,  min: 12, costo: 198.00, vida_util: 7,  active: 1 },
    57: { id: 57, sku: 'RG-057', name: 'Tarta de Limón con Merengue Grande',                  category: 'Postres',     area: 'POSTRES',                  max: 80,  min: 12, costo: 302.50, vida_util: 7,  active: 1 },
    58: { id: 58, sku: 'RG-058', name: 'Tarta Limón con Merengue',                            category: 'Postres',     area: 'POSTRES',                  max: 80,  min: 12, costo: 165.00, vida_util: 7,  active: 1 },
    59: { id: 59, sku: 'RG-059', name: 'Tarta Limón sin Hornear',                             category: 'Postres',     area: 'POSTRES',                  max: 80,  min: 12, costo: 115.50, vida_util: 7,  active: 1 },
    60: { id: 60, sku: 'RG-060', name: 'Tarta Manjar con Frutas',                             category: 'Postres',     area: 'POSTRES',                  max: 80,  min: 12, costo: 148.50, vida_util: 7,  active: 1 },
    61: { id: 61, sku: 'RG-061', name: 'Tarta de Cremoso de Queso con Fresa',                 category: 'Salados',     area: 'BOCADILLOS',               max: 150, min: 20, costo: 154.00, vida_util: 3,  active: 1 },
    62: { id: 62, sku: 'RG-062', name: 'Gelatina de Cafe',                                    category: 'Postres',     area: 'POSTRES',                  max: 80,  min: 12, costo: 198.00, vida_util: 7,  active: 1 },
    63: { id: 63, sku: 'RG-063', name: 'Gelatina de Mosaico',                                 category: 'Postres',     area: 'POSTRES',                  max: 80,  min: 12, costo: 198.00, vida_util: 7,  active: 1 },
    64: { id: 64, sku: 'RG-064', name: 'Torta de Pan Dulce',                                  category: 'Panaderia',   area: 'PAN',                      max: 300, min: 40, costo: 41.25,  vida_util: 2,  active: 1 },
    65: { id: 65, sku: 'RG-065', name: 'Bolillo Integral',                                    category: 'Panaderia',   area: 'PAN',                      max: 300, min: 40, costo: 3.03,   vida_util: 2,  active: 1 },
    66: { id: 66, sku: 'RG-066', name: 'Cuerno de Jamon con Queso Amarillo',                  category: 'Salados',     area: 'BOCADILLOS',               max: 150, min: 20, costo: 8.25,   vida_util: 3,  active: 1 },
    67: { id: 67, sku: 'RG-067', name: 'Cuerno de Atun',                                      category: 'Salados',     area: 'BOCADILLOS',               max: 150, min: 20, costo: 9.90,   vida_util: 3,  active: 1 },
    68: { id: 68, sku: 'RG-068', name: 'Cuerno de Finas Hierbas',                             category: 'Salados',     area: 'BOCADILLOS',               max: 150, min: 20, costo: 9.90,   vida_util: 3,  active: 1 },
    69: { id: 69, sku: 'RG-069', name: 'Cuerno Relleno de Parmesano',                         category: 'Salados',     area: 'BOCADILLOS',               max: 150, min: 20, costo: 9.90,   vida_util: 3,  active: 1 },
    70: { id: 70, sku: 'RG-070', name: 'Cuerno Relleno de Jamon y Vegetales',                 category: 'Salados',     area: 'BOCADILLOS',               max: 150, min: 20, costo: 13.75,  vida_util: 3,  active: 1 },
    71: { id: 71, sku: 'RG-071', name: 'Cuernito Relleno de Pepperoni',                       category: 'Salados',     area: 'BOCADILLOS',               max: 150, min: 20, costo: 16.50,  vida_util: 3,  active: 1 },
    72: { id: 72, sku: 'RG-072', name: 'Mini Berlineza de Cajeta 1pz',                        category: 'Postres',     area: 'POSTRES',                  max: 200, min: 30, costo: 4.95,   vida_util: 5,  active: 1 },
    73: { id: 73, sku: 'RG-073', name: 'Mini Berlinesa Crema Pastelera 15pz',                 category: 'Postres',     area: 'POSTRES',                  max: 80,  min: 12, costo: 66.00,  vida_util: 5,  active: 1 },
    74: { id: 74, sku: 'RG-074', name: 'Mini Berlinesa Zarzamora 15pz',                       category: 'Postres',     area: 'POSTRES',                  max: 80,  min: 12, costo: 66.00,  vida_util: 5,  active: 1 },
    75: { id: 75, sku: 'RG-075', name: 'Mini Berlinesa Rellena de Cajeta 15pz',               category: 'Postres',     area: 'POSTRES',                  max: 80,  min: 12, costo: 71.50,  vida_util: 5,  active: 1 },
    76: { id: 76, sku: 'RG-076', name: 'Mini Berlinesa Cubierta de Chocolate c/Relleno 15pz', category: 'Postres',     area: 'POSTRES',                  max: 80,  min: 12, costo: 82.50,  vida_util: 5,  active: 1 },
    77: { id: 77, sku: 'RG-077', name: 'Salchicha en Hojaldre Pz',                            category: 'Salados',     area: 'BOCADILLOS',               max: 200, min: 30, costo: 4.40,   vida_util: 3,  active: 1 },
    78: { id: 78, sku: 'RG-078', name: 'Trufas de Nuez Pz',                                   category: 'Salados',     area: 'BOCADILLOS',               max: 150, min: 20, costo: 6.60,   vida_util: 7,  active: 1 },
    79: { id: 79, sku: 'RG-079', name: 'Trufas con Pan Pz',                                   category: 'Salados',     area: 'BOCADILLOS',               max: 150, min: 20, costo: 8.25,   vida_util: 3,  active: 1 },
    80: { id: 80, sku: 'RG-080', name: 'Brochetas de Carnes Frias con Queso y Aceitunas Pz',  category: 'Salados',     area: 'BOCADILLOS',               max: 150, min: 20, costo: 8.25,   vida_util: 2,  active: 1 },
    81: { id: 81, sku: 'RG-081', name: 'Pz de Rollito de Jamon con Queso',                    category: 'Salados',     area: 'BOCADILLOS',               max: 200, min: 30, costo: 5.50,   vida_util: 3,  active: 1 },
    82: { id: 82, sku: 'RG-082', name: 'Pz Serpentina',                                       category: 'Salados',     area: 'BOCADILLOS',               max: 200, min: 30, costo: 6.60,   vida_util: 3,  active: 1 },
    83: { id: 83, sku: 'RG-083', name: 'Pz Finger Sandwich',                                  category: 'Salados',     area: 'BOCADILLOS',               max: 200, min: 30, costo: 5.50,   vida_util: 2,  active: 1 },
    84: { id: 84, sku: 'RG-084', name: 'Pz Volovan Mousse de Ostion Ahumado',                 category: 'Salados',     area: 'BOCADILLOS',               max: 150, min: 20, costo: 8.80,   vida_util: 2,  active: 1 },
    85: { id: 85, sku: 'RG-085', name: 'Volovan Mousse de Queso con Finas Hierbas',           category: 'Salados',     area: 'BOCADILLOS',               max: 150, min: 20, costo: 6.60,   vida_util: 2,  active: 1 },
    86: { id: 86, sku: 'RG-086', name: 'Pz Volovan Camaron con Queso Philadelphia',           category: 'Salados',     area: 'BOCADILLOS',               max: 150, min: 20, costo: 11.00,  vida_util: 2,  active: 1 },
    87: { id: 87, sku: 'RG-087', name: 'Cupcake de Chocolate Pz',                             category: 'Postres',     area: 'POSTRES',                  max: 200, min: 30, costo: 20.63,  vida_util: 5,  active: 1 },
    88: { id: 88, sku: 'RG-088', name: 'Cupcake de Vainilla Pz',                              category: 'Postres',     area: 'POSTRES',                  max: 200, min: 30, costo: 19.25,  vida_util: 5,  active: 1 },
    89: { id: 89, sku: 'RG-089', name: 'Cupcake Relleno de Limón Pz',                         category: 'Salados',     area: 'BOCADILLOS',               max: 200, min: 30, costo: 21.18,  vida_util: 5,  active: 1 },
    90: { id: 90, sku: 'RG-090', name: 'Pz de Cupcake Cheesecake',                            category: 'Postres',     area: 'POSTRES',                  max: 200, min: 30, costo: 22.00,  vida_util: 5,  active: 1 },
    91: { id: 91, sku: 'RG-091', name: 'Extra al Cupcake Relleno de Fresa',                   category: 'Postres',     area: 'POSTRES',                  max: 200, min: 30, costo: 22.00,  vida_util: 5,  active: 1 },
    92: { id: 92, sku: 'RG-092', name: 'Extra al Cupcake Relleno de Nutella',                 category: 'Postres',     area: 'POSTRES',                  max: 200, min: 30, costo: 55.00,  vida_util: 5,  active: 1 },
    93: { id: 93, sku: 'RG-093', name: 'Extra al Cupcake Relleno de Ferrero',                 category: 'Postres',     area: 'POSTRES',                  max: 200, min: 30, costo: 55.00,  vida_util: 5,  active: 1 },
    94: { id: 94, sku: 'RG-094', name: 'Extra al Cupcake Relleno de Rafaello',                category: 'Postres',     area: 'POSTRES',                  max: 200, min: 30, costo: 66.00,  vida_util: 5,  active: 1 },
    95: { id: 95, sku: 'RG-095', name: 'Pz de Mini Carlota de Fresa',                         category: 'Postres',     area: 'POSTRES',                  max: 200, min: 30, costo: 13.75,  vida_util: 5,  active: 1 },
    96: { id: 96, sku: 'RG-096', name: 'Pz de Mini Carlota de Queso con Cafe',                category: 'Postres',     area: 'POSTRES',                  max: 200, min: 30, costo: 13.75,  vida_util: 5,  active: 1 },
    97: { id: 97, sku: 'RG-097', name: 'Galleta Personalizada',                               category: 'Galletas',    area: 'GALLETAS',                 max: 200, min: 30, costo: 27.50,  vida_util: 30, active: 1 }
};

// ──────────────────────────────────────────────────────────────────────
//  Almacenes — mapeados desde fayxzvov_alpha.subsidiaries (1 por sucursal activa).
//  No existe tabla `warehouse` en BD; se usa subsidiary como almacen general.
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_ALMACENES_DB = {
    1:  { id: 1,  name: 'Almacen Marinni Centro',      address: 'Tapachula, Chiapas',          sucursal: 'Marinni Centro',      general_default: 1, active: 1 },
    2:  { id: 2,  name: 'Almacen Club Campestre',      address: '',                            sucursal: 'Club Campestre',      general_default: 1, active: 1 },
    4:  { id: 4,  name: 'Almacen Reginas Central Gpe', address: 'Av. Centro Tapachula Chiapas',sucursal: 'Reginas Central Gpe', general_default: 1, active: 1 },
    18: { id: 18, name: 'Almacen Altozano',            address: 'Tabasco',                     sucursal: 'Altozano',            general_default: 1, active: 1 },
    21: { id: 21, name: 'Almacen Club campestre tap',  address: 'Tapachula Chis',              sucursal: 'Club campestre tap',  general_default: 1, active: 1 },
    22: { id: 22, name: 'Almacen Reginas cuarta',      address: 'Tapachula',                   sucursal: 'Reginas cuarta',      general_default: 1, active: 1 },
    25: { id: 25, name: 'Almacen Reginas kafeto',      address: 'Plaza Kafeto',                sucursal: 'Reginas kafeto',      general_default: 1, active: 1 }
};

const _productoRow = (p) => {
    return {
        id:             p.id,
        Producto:       _productoIconCell(p),
        SKU:            `<span class="text-[10px] text-gray-400 font-mono">${p.sku}</span>`,
        Area:           _badgeArea(p.area),
        'Maximo':       `<span class="text-[11px] text-white">${Number(p.max).toLocaleString()}</span>`,
        'Minimo':       `<span class="text-[11px] text-white">${p.min}</span>`,
        'Costo prod.': `<span class="text-[11px] font-bold text-white">${_fmtCosto(p.costo)}</span>`,
        'Vida util':    `<span class="text-[10px] text-gray-400">${p.vida_util} dias</span>`,
        Estado:         _badgeEstadoActive(p.active),
        a: [
            { class: 'inline-flex items-center justify-center w-7 h-7 rounded text-[12px] transition-colors me-1 bg-purple-600 hover:bg-purple-500 text-white', html: '<i class="icon-pencil"></i>',       onclick: `productos.edit(${p.id})`   },
            { class: `inline-flex items-center justify-center w-7 h-7 rounded text-[12px] transition-colors me-1 ${p.active ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'} text-white`, html: `<i class="icon-${p.active ? 'toggle-right' : 'toggle-left'}"></i>`, onclick: `productos.toggleStatus(${p.id}, ${p.active ? 0 : 1})` }
        ]
    };
};

const _almacenRow = (a) => {
    return {
        id:                       a.id,
        Almacen:                  _almacenIconCell(a),
        Sucursal:                 _badgeSucursal(a.sucursal),
        'General por defecto':    `<span class="inline-flex items-center justify-center w-5 h-5 rounded ${a.general_default ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-600/20 text-gray-500'}"><i data-lucide="${a.general_default ? 'check' : 'minus'}" class="w-3 h-3"></i></span>`,
        Estado:                   _badgeEstadoActive(a.active),
        a: [
            { class: 'inline-flex items-center justify-center w-7 h-7 rounded text-[12px] transition-colors me-1 bg-purple-600 hover:bg-purple-500 text-white', html: '<i class="icon-pencil"></i>',       onclick: `almacenes.edit(${a.id})`   },
            { class: `inline-flex items-center justify-center w-7 h-7 rounded text-[12px] transition-colors me-1 ${a.active ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'} text-white`, html: `<i class="icon-${a.active ? 'toggle-right' : 'toggle-left'}"></i>`, onclick: `almacenes.toggleStatus(${a.id}, ${a.active ? 0 : 1})` }
        ]
    };
};

const SAMPLE_PRODUCTOS_TABLE = {
    row: Object.values(SAMPLE_PRODUCTOS_DB).map(_productoRow)
};

const SAMPLE_ALMACENES_TABLE = {
    row: Object.values(SAMPLE_ALMACENES_DB).map(_almacenRow)
};

// ──────────────────────────────────────────────────────────────────────
//  Catalogos — areas son las categorias reales de Reginas (order_category);
//  sucursales son las activas de fayxzvov_alpha.subsidiaries.
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_ADMIN_AREAS = [
    { id: '',                         valor: 'Selecciona un area'      },
    { id: 'PASTELES TRADICIONALES',   valor: 'Pasteles Tradicionales'  },
    { id: 'PASTELES ESPECIALIDADES',  valor: 'Pasteles Especialidades' },
    { id: 'POSTRES',                  valor: 'Postres'                 },
    { id: 'BOCADILLOS',               valor: 'Bocadillos'              },
    { id: 'CHAROLAS',                 valor: 'Charolas'                },
    { id: 'PAN',                      valor: 'Pan'                     },
    { id: 'GALLETAS',                 valor: 'Galletas'                },
    { id: 'SOBRE PEDIDO',             valor: 'Sobre Pedido'            }
];

const SAMPLE_ADMIN_SUCURSALES = [
    { id: '',                     valor: 'Selecciona una sucursal' },
    { id: 'Marinni Centro',       valor: 'Marinni Centro'          },
    { id: 'Club Campestre',       valor: 'Club Campestre'          },
    { id: 'Reginas Central Gpe',  valor: 'Reginas Central Gpe'     },
    { id: 'Altozano',             valor: 'Altozano'                },
    { id: 'Club campestre tap',   valor: 'Club campestre tap'      },
    { id: 'Reginas cuarta',       valor: 'Reginas cuarta'          },
    { id: 'Reginas kafeto',       valor: 'Reginas kafeto'          }
];

const SAMPLE_ADMIN_ESTADOS = [
    { id: '1', valor: 'Activos'   },
    { id: '0', valor: 'Inactivos' }
];

const SAMPLE_ADMIN_TABS = [
    { id: 'productos', tab: 'Productos', lucideIcon: 'box',       active: true  },
    { id: 'almacenes', tab: 'Almacenes', lucideIcon: 'warehouse', active: false }
];
