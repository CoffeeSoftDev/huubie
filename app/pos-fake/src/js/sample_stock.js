// ──────────────────────────────────────────────────────────────────────
//  SAMPLE — Visor de Stock (POS FAKE)
//  Datos estaticos que alimentan el modulo pos-stock.js
//  Equivalentes a los del template estatico:
//    coffee/templates/inventarios/inventarios-stock.html
// ──────────────────────────────────────────────────────────────────────

const SAMPLE_VIEW_HEADER_STOCK = {
    title:    'Visor de Stock',
    subtitle: 'Control de existencias por sucursal, categoria y nivel'
};

const SAMPLE_VIEW_FOOTER_STOCK = {
    info: 'Mostrando 4 de 4 productos',
    legends: [
        { tone: 'success', label: 'Stock OK'      },
        { tone: 'warning', label: 'Stock Bajo'    },
        { tone: 'danger',  label: 'Agotado'       },
        { tone: 'warning', label: 'Vida util'     }
    ]
};

// Helpers reutilizables para badges
const _badgeEstado = (estado) => {
    const map = {
        'ok':      { bg: 'rgba(63,193,137,0.15)',  fg: '#3FC189', label: 'OK'      },
        'bajo':    { bg: 'rgba(251,146,60,0.15)',  fg: '#FB923C', label: 'BAJO'    },
        'agotado': { bg: 'rgba(244,63,94,0.15)',   fg: '#F43F5E', label: 'AGOTADO' }
    };
    const c = map[estado] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF', label: estado.toUpperCase() };
    return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold" style="background:${c.bg};color:${c.fg};">${c.label}</span>`;
};

const _badgeVida = (vida, dias) => {
    if (vida === 'na' || dias == null) {
        return `<span class="text-[10px] text-gray-500">N/A</span>`;
    }
    const map = {
        'critico': { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' },
        'proximo': { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
        'ok':      { bg: 'rgba(63,193,137,0.15)', fg: '#3FC189' }
    };
    const c = map[vida] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
    return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold" style="background:${c.bg};color:${c.fg};">${dias} dias</span>`;
};

const _badgeCategoria = (categoria) => {
    const map = {
        'Tradicional': { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
        'Premium':     { bg: 'rgba(124,58,237,0.15)', fg: '#A78BFA' },
        'Cupcakes':    { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
        'Galletas':    { bg: 'rgba(28,100,242,0.15)', fg: '#60A5FA' }
    };
    const c = map[categoria] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold" style="background:${c.bg};color:${c.fg};">${categoria}</span>`;
};

const _stockCell = (stock, estado) => {
    const map = {
        'ok':      'text-green-400',
        'bajo':    'text-orange-400',
        'agotado': 'text-red-400'
    };
    const color = map[estado] || 'text-white';
    return `<span class="text-xs font-bold ${color}">${stock}</span>`;
};

// ──────────────────────────────────────────────────────────────────────
//  Productos completos (base de datos fake) — usados por tabla y panel
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_PRODUCTS_DB = {
    p3: {
        id: 'p3',
        name:      'Pastel 3 Leches Chocolate',
        sku:       'PAS-3LC-001',
        categoria: 'Tradicional',
        stock:     3,
        min:       5,
        max:       20,
        precio:    700,
        costo:     280,
        estado:    'bajo',
        vida:      { dias: 2, label: 'critico' },
        iconBg:    'bg-amber-900/30',
        iconText:  'text-amber-400',
        stockSuc: { '': 27, kafeto: 3, central: 14, norte: 10, sur: 0 },
        almacenes: [
            { name: 'ALM-Central', type: 'info'   },
            { name: 'ALM-Norte',   type: 'info'   },
            { name: 'Refrig-01',   type: 'purple' }
        ],
        movs: [
            { type: 'in',     label: 'Entrada · Compra',       qty: '+12', when: 'Hace 2 dias · Reginas Kafeto' },
            { type: 'out',    label: 'Salida · Venta',         qty: '-5',  when: 'Hace 1 dia · POS-04' },
            { type: 'tr',     label: 'Traspaso · A Centro',    qty: '-4',  when: 'Hoy · 09:42' },
            { type: 'adjust', label: 'Ajuste · Conteo fisico', qty: '+/-0', when: 'Hoy · 11:15' },
            { type: 'out',    label: 'Salida · Venta',         qty: '-2',  when: 'Hoy · POS-02' },
            { type: 'out',    label: 'Salida · Venta',         qty: '-3',  when: 'Hoy · POS-01' },
            { type: 'in',     label: 'Entrada · Devolucion',   qty: '+1',  when: 'Hoy · POS-03' },
            { type: 'tr',     label: 'Traspaso · De Norte',    qty: '+2',  when: 'Ayer · 14:20' },
            { type: 'out',    label: 'Salida · Merma',         qty: '-1',  when: 'Ayer · 17:45' },
            { type: 'in',     label: 'Entrada · Produccion',   qty: '+6',  when: 'Hace 2 dias · ALM-Central' },
            { type: 'out',    label: 'Salida · Venta',         qty: '-3',  when: 'Hace 3 dias · POS-04' },
            { type: 'adjust', label: 'Ajuste · Sistema',       qty: '+1',  when: 'Hace 4 dias · 10:00' }
        ]
    },
    pf: {
        id: 'pf',
        name:      'Pay de Fresas',
        sku:       'PAY-FRS-001',
        categoria: 'Premium',
        stock:     12,
        min:       5,
        max:       25,
        precio:    350,
        costo:     140,
        estado:    'ok',
        vida:      { dias: 3, label: 'critico' },
        iconBg:    'bg-red-900/30',
        iconText:  'text-red-400',
        stockSuc: { '': 44, kafeto: 12, central: 18, norte: 9, sur: 5 },
        almacenes: [
            { name: 'ALM-Central', type: 'info'   },
            { name: 'Refrig-01',   type: 'purple' }
        ],
        movs: [
            { type: 'in',  label: 'Entrada · Produccion', qty: '+20', when: 'Hace 3 dias · ALM-Central' },
            { type: 'out', label: 'Salida · Venta',       qty: '-8',  when: 'Hoy · POS-02' }
        ]
    },
    cd: {
        id: 'cd',
        name:      'Cupcake Decorado',
        sku:       'CUP-DEC-001',
        categoria: 'Cupcakes',
        stock:     0,
        min:       10,
        max:       50,
        precio:    55,
        costo:     22,
        estado:    'agotado',
        vida:      { dias: null, label: 'na' },
        iconBg:    'bg-orange-900/30',
        iconText:  'text-orange-400',
        stockSuc: { '': 0, kafeto: 0, central: 0, norte: 0, sur: 0 },
        almacenes: [
            { name: 'ALM-Central', type: 'info' }
        ],
        movs: [
            { type: 'out', label: 'Salida · Venta', qty: '-10', when: 'Ayer · POS-01' }
        ]
    },
    ca: {
        id: 'ca',
        name:      'Choco Aleman',
        sku:       'PAS-CHA-001',
        categoria: 'Premium',
        stock:     8,
        min:       3,
        max:       15,
        precio:    600,
        costo:     240,
        estado:    'ok',
        vida:      { dias: 5, label: 'proximo' },
        iconBg:    'bg-yellow-900/30',
        iconText:  'text-yellow-400',
        stockSuc: { '': 25, kafeto: 8, central: 7, norte: 6, sur: 4 },
        almacenes: [
            { name: 'ALM-Central', type: 'info'   },
            { name: 'Refrig-01',   type: 'purple' }
        ],
        movs: [
            { type: 'in', label: 'Entrada · Compra', qty: '+15', when: 'Hace 4 dias · ALM-Central' }
        ]
    }
};

// ──────────────────────────────────────────────────────────────────────
//  Tabla de productos (formato compatible con createCoffeeTable3)
// ──────────────────────────────────────────────────────────────────────
const _productRow = (p) => ({
    id:           p.id,
    Producto:     `
        <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded ${p.iconBg} flex items-center justify-center ${p.iconText}">
                <i data-lucide="cake" class="w-3.5 h-3.5"></i>
            </div>
            <div>
                <p class="text-xs font-medium">${p.name}</p>
                <p class="text-[9px] text-gray-500">SKU: ${p.sku}</p>
            </div>
        </div>`,
    Categoria:    _badgeCategoria(p.categoria),
    Stock:        _stockCell(p.stock, p.estado),
    Min:          `<span class="text-[10px] text-gray-500">${p.min}</span>`,
    Max:          `<span class="text-[10px] text-gray-500">${p.max}</span>`,
    Precio:       `<span class="text-xs font-semibold">$${p.precio.toLocaleString('es-MX')}</span>`,
    Costo:        `<span class="text-xs text-gray-400">$${p.costo.toLocaleString('es-MX')}</span>`,
    Estado:       _badgeEstado(p.estado),
    'Vida util':  _badgeVida(p.vida.label, p.vida.dias),
    a: [
        { class: 'btn btn-sm btn-secondary', html: '<i class="icon-eye"></i>', onclick: `app.selectProduct('${p.id}')` }
    ]
});

const SAMPLE_STOCK_TABLE = {
    row: [
        _productRow(SAMPLE_PRODUCTS_DB.p3),
        _productRow(SAMPLE_PRODUCTS_DB.pf),
        _productRow(SAMPLE_PRODUCTS_DB.cd),
        _productRow(SAMPLE_PRODUCTS_DB.ca)
    ]
};

// ──────────────────────────────────────────────────────────────────────
//  Conteos para KPIs (Total, OK, Bajo, Agotado, Vida util)
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_STOCK_COUNTS = {
    total_productos: 4,
    total_ok:        2,
    total_bajo:      1,
    total_agotado:   1,
    total_vida:      2   // criticos + proximos
};

// ──────────────────────────────────────────────────────────────────────
//  Catalogos (sucursales, categorias, niveles)
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_STOCK_SUCURSALES = [
    { id: '',        valor: 'Todas las sucursales' },
    { id: 'kafeto',  valor: 'Reginas Kafeto'       },
    { id: 'central', valor: 'Reginas Central'      },
    { id: 'norte',   valor: 'Reginas Norte'        },
    { id: 'sur',     valor: 'Reginas Sur'          }
];

const SAMPLE_STOCK_CATEGORIAS = [
    { id: '',            valor: 'Todas las categorias' },
    { id: 'Tradicional', valor: 'Tradicional'          },
    { id: 'Premium',     valor: 'Premium'              },
    { id: 'Cupcakes',    valor: 'Cupcakes'             },
    { id: 'Galletas',    valor: 'Galletas'             }
];

const SAMPLE_STOCK_NIVELES = [
    { id: '',        valor: 'Todos los niveles' },
    { id: 'ok',      valor: 'Stock OK'          },
    { id: 'bajo',    valor: 'Stock Bajo'        },
    { id: 'agotado', valor: 'Agotado'           }
];
