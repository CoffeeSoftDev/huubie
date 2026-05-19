// ──────────────────────────────────────────────────────────────────────
//  SAMPLE — POS Main (FAKE)
//  Datos estaticos que alimentan el modulo pos-main.js
//  Equivalentes a los del template estatico:
//    app/templates/pos-2/pos-main copy.html
// ──────────────────────────────────────────────────────────────────────

const SAMPLE_VIEW_HEADER_POSMAIN = {
    title:    'Punto de Venta',
    subtitle: 'Catalogo + carrito + cobro en una sola vista',
    back:     { href: '/app/inventarios/index.php', title: 'Regresar al inicio' }
};

const SAMPLE_VIEW_FOOTER_POSMAIN = {
    info: 'Mostrando 18 productos · 2 combos · 2 promociones BXGY activas',
    legends: [
        { tone: 'success', label: 'Disponible' },
        { tone: 'warning', label: 'Bajo stock' },
        { tone: 'danger',  label: 'Agotado'    },
        { tone: 'purple',  label: 'Combo'      },
        { tone: 'info',    label: 'Promo BXGY' }
    ]
};

// ──────────────────────────────────────────────────────────────────────
//  Helpers de formato / colores
// ──────────────────────────────────────────────────────────────────────
const _fmtMoney      = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const _fmtMoneyShort = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });

const _COLOR_MAP = {
    amber:   { gradient: 'linear-gradient(135deg, rgba(120,53,15,0.30), rgba(146,64,14,0.10))',  fg: '#FBBF24', bg: 'rgba(120,53,15,0.30)'  },
    pink:    { gradient: 'linear-gradient(135deg, rgba(131,24,67,0.30),  rgba(157,23,77,0.10))', fg: '#F472B6', bg: 'rgba(131,24,67,0.30)'  },
    red:     { gradient: 'linear-gradient(135deg, rgba(127,29,29,0.30),  rgba(153,27,27,0.10))', fg: '#F87171', bg: 'rgba(127,29,29,0.30)'  },
    yellow:  { gradient: 'linear-gradient(135deg, rgba(113,63,18,0.30),  rgba(133,77,14,0.10))', fg: '#FACC15', bg: 'rgba(113,63,18,0.30)'  },
    emerald: { gradient: 'linear-gradient(135deg, rgba(6,78,59,0.30),    rgba(6,95,70,0.10))',   fg: '#34D399', bg: 'rgba(6,78,59,0.30)'    },
    orange:  { gradient: 'linear-gradient(135deg, rgba(124,45,18,0.30),  rgba(154,52,18,0.10))', fg: '#FB923C', bg: 'rgba(124,45,18,0.30)'  },
    rose:    { gradient: 'linear-gradient(135deg, rgba(136,19,55,0.30),  rgba(159,18,57,0.10))', fg: '#FB7185', bg: 'rgba(136,19,55,0.30)'  },
    teal:    { gradient: 'linear-gradient(135deg, rgba(19,78,74,0.30),   rgba(17,94,89,0.10))',  fg: '#2DD4BF', bg: 'rgba(19,78,74,0.30)'   },
    indigo:  { gradient: 'linear-gradient(135deg, rgba(49,46,129,0.30),  rgba(55,48,163,0.10))', fg: '#818CF8', bg: 'rgba(49,46,129,0.30)'  },
    lime:    { gradient: 'linear-gradient(135deg, rgba(54,83,20,0.30),   rgba(63,98,18,0.10))',  fg: '#A3E635', bg: 'rgba(54,83,20,0.30)'   }
};

const _productStatus = (p) => {
    if (p.stock <= 0) return { key: 'out',   label: 'Agotado',    fg: '#EA0234', bg: 'rgba(234,2,52,0.15)'  };
    if (p.stock <= 3) return { key: 'low',   label: 'Bajo stock', fg: '#FBBF24', bg: 'rgba(251,191,36,0.15)' };
    return                    { key: 'ok',    label: 'Disponible', fg: '#3FC189', bg: 'rgba(63,193,137,0.15)' };
};

// ──────────────────────────────────────────────────────────────────────
//  Promociones BXGY (Buy X, Get Y Free) — 3x2 / 2x1
//  En produccion vendran de la tabla pos_promotion.
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_POSMAIN_PROMOCIONES = {
    1: {
        id:         1,
        code:       'PROMO_3X2_CAFE_MAT',
        name:       '3x2 cafe matutino',
        type:       'BXGY',
        label:      '3x2',
        buy:        3,
        pay:        2,
        badgeClass: 'badge-3x2',
        tagline:    'Lleva 3, paga 2'
    },
    2: {
        id:         2,
        code:       'PROMO_2X1_GALLETAS',
        name:       '2x1 galletas tarde',
        type:       'BXGY',
        label:      '2x1',
        buy:        2,
        pay:        1,
        badgeClass: 'badge-2x1',
        tagline:    'Lleva 2, paga 1'
    }
};

// ──────────────────────────────────────────────────────────────────────
//  Catalogo de productos (incluye combos + items con promoId BXGY)
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_POSMAIN_PRODUCTOS = [
    { id: 'p001', name: '3 Leches Choco',   category: 'Pasteles Tradicional', price: 700,  stock: 3,   icon: 'cake',       color: 'amber',   promoId: null, promoType: null },
    { id: 'p002', name: 'Carlos V',          category: 'Pasteles Tradicional', price: 390,  stock: 12,  icon: 'candy',      color: 'pink',    promoId: null, promoType: null },
    { id: 'p003', name: 'Pay de Fresas',     category: 'Pasteles Tradicional', price: 350,  stock: 8,   icon: 'pie-chart',  color: 'red',     promoId: null, promoType: null },
    { id: 'p004', name: 'Choco Aleman',      category: 'Pasteles Tradicional', price: 600,  stock: 5,   icon: 'cake',       color: 'yellow',  promoId: null, promoType: null },
    { id: 'p005', name: 'Choco Forest',      category: 'Premium',              price: 600,  stock: 2,   icon: 'cake-slice', color: 'emerald', promoId: null, promoType: null },
    { id: 'p006', name: 'Cupcake',           category: 'Cupcakes',             price: 55,   stock: 25,  icon: 'cookie',     color: 'orange',  promoId: null, promoType: null },
    { id: 'p007', name: '3 Leches Fresa',    category: 'Pasteles Tradicional', price: 650,  stock: 4,   icon: 'cake',       color: 'rose',    promoId: null, promoType: null },
    { id: 'p008', name: 'Choco Roll',        category: 'Cafes',                price: 700,  stock: 6,   icon: 'coffee',     color: 'amber',   promoId: 1,    promoType: 'BXGY' },
    { id: 'p009', name: 'Decorated',         category: 'Premium',              price: 650,  stock: 3,   icon: 'sparkles',   color: 'pink',    promoId: null, promoType: null },
    { id: 'p010', name: 'Sponge Cake',       category: 'Pasteles Tradicional', price: 600,  stock: 7,   icon: 'cake',       color: 'amber',   promoId: null, promoType: null },
    { id: 'p011', name: 'Strawberry Pie',    category: 'Pasteles Tradicional', price: 600,  stock: 0,   icon: 'pie-chart',  color: 'red',     promoId: null, promoType: null },
    { id: 'p012', name: 'Galleta Choco',     category: 'Galletas',             price: 45,   stock: 50,  icon: 'cookie',     color: 'teal',    promoId: 2,    promoType: 'BXGY' },
    { id: 'p013', name: 'Blueberry Cake',    category: 'Premium',              price: 580,  stock: 5,   icon: 'cake-slice', color: 'indigo',  promoId: null, promoType: null },
    { id: 'p014', name: 'Limon Cake',        category: 'Pasteles Tradicional', price: 520,  stock: 9,   icon: 'cake',       color: 'lime',    promoId: null, promoType: null },
    { id: 'p015', name: 'Latte Vainilla',    category: 'Cafes',                price: 65,   stock: 30,  icon: 'coffee',     color: 'amber',   promoId: 1,    promoType: 'BXGY' },
    { id: 'p016', name: 'Mocaccino',         category: 'Cafes',                price: 75,   stock: 20,  icon: 'coffee',     color: 'amber',   promoId: 1,    promoType: 'BXGY' },
    {
        id: 'c001', name: 'Combo Familiar',   category: 'Combos', price: 1200, stock: 999, icon: 'gift', color: 'indigo',
        isCombo: 1, promoId: null, promoType: null,
        components: [
            { productId: 'p001', quantity: 1 },
            { productId: 'p008', quantity: 2 },
            { productId: 'p012', quantity: 4 }
        ]
    },
    {
        id: 'c002', name: 'Combo Cafe Pareja', category: 'Combos', price: 240, stock: 999, icon: 'gift', color: 'pink',
        isCombo: 1, promoId: null, promoType: null,
        components: [
            { productId: 'p015', quantity: 2 },
            { productId: 'p006', quantity: 2 }
        ]
    }
];

// ──────────────────────────────────────────────────────────────────────
//  Categorias derivadas de los productos
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_POSMAIN_CATEGORIAS = (() => {
    const set = new Set(SAMPLE_POSMAIN_PRODUCTOS.map(p => p.category));
    return ['Todos', ...Array.from(set)];
})();

// ──────────────────────────────────────────────────────────────────────
//  Metodos de pago (concepto base — luego se cruzan con el cobro)
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_POSMAIN_METODOS_PAGO = [
    { id: 'efe',    clave: 'EFE',    name: 'Efectivo',                  active: true,  amount: 0 },
    { id: 'tdc',    clave: 'TDC',    name: 'Tarjeta de Credito',        active: false, amount: 0 },
    { id: 'tdd',    clave: 'TDD',    name: 'Tarjeta de Debito',         active: false, amount: 0 },
    { id: 'visa',   clave: 'VISA',   name: 'Visa',                      active: false, amount: 0 },
    { id: 'mc',     clave: 'MC',     name: 'MasterCard',                active: false, amount: 0 },
    { id: 'amex',   clave: 'AMEX',   name: 'American Express',          active: false, amount: 0 },
    { id: 'trf',    clave: 'TRF',    name: 'Transferencia bancaria',    active: false, amount: 0 },
    { id: 'spei',   clave: 'SPEI',   name: 'SPEI',                      active: false, amount: 0 },
    { id: 'chq',    clave: 'CHQ',    name: 'Cheque',                    active: false, amount: 0 },
    { id: 'vale',   clave: 'VALE',   name: 'Vale / Monedero',           active: false, amount: 0 },
    { id: 'cupon',  clave: 'CUPON',  name: 'Cupon / Promocion',         active: false, amount: 0 },
    { id: 'puntos', clave: 'PTS',    name: 'Puntos de lealtad',         active: false, amount: 0 },
    { id: 'paypal', clave: 'PP',     name: 'PayPal',                    active: false, amount: 0 },
    { id: 'mpago',  clave: 'MP',     name: 'Mercado Pago',              active: false, amount: 0 },
    { id: 'qr',     clave: 'QR',     name: 'Pago con QR',               active: false, amount: 0 },
    { id: 'cxc',    clave: 'CXC',    name: 'Cuenta por cobrar',         active: false, amount: 0 },
    { id: 'cortes', clave: 'CORT',   name: 'Cortesia',                  active: false, amount: 0 },
    { id: 'otro',   clave: 'OTRO',   name: 'Otro concepto',             active: false, amount: 0 }
];

// ──────────────────────────────────────────────────────────────────────
//  Turno + datos cabecera
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_POSMAIN_TURNO = {
    label:     'TURNO MANANA',
    sucursal:  'Reginas Kafeto',
    cajero:    'Andrea M.',
    ventas:    4850,
    ordenes:   12,
    ventaCode: 'Venta #1043'
};

// ──────────────────────────────────────────────────────────────────────
//  Clientes (autocomplete)
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_POSMAIN_CLIENTES = [
    { id: 'c01', name: 'Andrea Martinez',   phone: '9611234567', email: 'andrea.m@example.com' },
    { id: 'c02', name: 'Carlos Ramirez',    phone: '9612345678', email: 'carlos.r@example.com' },
    { id: 'c03', name: 'Maria Gonzalez',    phone: '9613456789', email: '' },
    { id: 'c04', name: 'Juan Lopez',        phone: '',           email: 'juan.lopez@example.com' },
    { id: 'c05', name: 'Sofia Hernandez',   phone: '9615678901', email: '' },
    { id: 'c06', name: 'Roberto Dominguez', phone: '9616789012', email: 'rdominguez@example.com' }
];

// ──────────────────────────────────────────────────────────────────────
//  Sucursales (catalogo en formato { id, valor })
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_POSMAIN_SUCURSALES = [
    { id: '',         valor: 'Todas las sucursales' },
    { id: 'kafeto',   valor: 'Reginas Kafeto'       },
    { id: 'centro',   valor: 'Sucursal Centro'      },
    { id: 'plaza',    valor: 'Sucursal Plaza'       }
];
