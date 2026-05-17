// ──────────────────────────────────────────────────────────────────────
//  SAMPLE — Visor de Entradas (POS FAKE)
//  Datos estaticos que alimentan el modulo pos-entradas.js
//  Equivalentes a los del template estatico:
//    coffee/templates/inventarios/inventarios-entradas.html
// ──────────────────────────────────────────────────────────────────────

const SAMPLE_VIEW_HEADER_ENTRADAS = {
    title:    'Visor de Entradas',
    subtitle: 'Recepciones de produccion, compras y transferencias por sucursal',
    back:     { href: '/app/inventarios/index.php', title: 'Regresar al inicio' }
};

const SAMPLE_VIEW_FOOTER_ENTRADAS = {
    info: 'Mostrando 3 de 3 entradas',
    legends: [
        { tone: 'purple',  label: 'Produccion'    },
        { tone: 'warning', label: 'Proveedor'     },
        { tone: 'info',    label: 'Transferencia' },
        { tone: 'danger',  label: 'Devolucion'    }
    ]
};

// ──────────────────────────────────────────────────────────────────────
//  Helpers de badges / formato (compatibles con createCoffeeTable3)
// ──────────────────────────────────────────────────────────────────────
const _badgeOrigen = (origen) => {
    const map = {
        'Produccion':    { bg: 'rgba(124,58,237,0.15)', fg: '#A78BFA' },
        'Proveedor':     { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
        'Transferencia': { bg: 'rgba(28,100,242,0.15)', fg: '#60A5FA' },
        'Devolucion':    { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' }
    };
    const c = map[origen] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold" style="background:${c.bg};color:${c.fg};">${origen}</span>`;
};

const _badgeEstadoEntrada = (estado) => {
    const map = {
        'Aplicada':  { bg: 'rgba(63,193,137,0.15)', fg: '#3FC189' },
        'Pendiente': { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
        'Reversada': { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' }
    };
    const c = map[estado] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
    return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold" style="background:${c.bg};color:${c.fg};">${estado.toUpperCase()}</span>`;
};

const _fmtMoneyShort = (n) => '$' + Number(n).toLocaleString('en-US');
const _fmtMoney      = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const _DOW_ES = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
const _MON_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const _fmtFechaCorta = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const dow = _DOW_ES[d.getDay()];
    const day = String(d.getDate()).padStart(2, '0');
    const mon = _MON_ES[d.getMonth()];
    let h     = d.getHours();
    const m   = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return `${dow} ${day} ${mon} ${String(h).padStart(2, '0')}:${m} ${ampm}`;
};

// ──────────────────────────────────────────────────────────────────────
//  Entradas completas (base fake) — usadas por tabla y panel
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_ENTRADAS_DB = {
    'ENT-089': {
        folio:       'ENT-089',
        origen:      'Produccion',
        sucursal:    'Reginas Kafeto',
        sucursalId:  'kafeto',
        registrado:  'Somx',
        fechaIso:    '2026-04-04T08:30:00',
        estado:      'Aplicada',
        nota:        'Produccion matutina del turno de manana. Se produjeron cupcakes de chocolate y vainilla, pasteles 3 leches y galletas decoradas.',
        productos: [
            { nombre: 'Cupcake Decorado',           sku: 'CUP-DEC-001', icon: 'cup-soda', bg: 'bg-orange-900/30', color: 'text-orange-400', cant: 24, costo: 22,  stockPrev: 0  },
            { nombre: 'Pastel 3 Leches Chocolate',  sku: 'PAS-3LC-001', icon: 'cake',     bg: 'bg-amber-900/30',  color: 'text-amber-400',  cant: 10, costo: 280, stockPrev: 6  },
            { nombre: 'Galleta Chocolate',          sku: 'GAL-CHO-001', icon: 'cookie',   bg: 'bg-teal-900/30',   color: 'text-teal-400',   cant: 14, costo: 20,  stockPrev: 15 }
        ]
    },
    'ENT-088': {
        folio:       'ENT-088',
        origen:      'Proveedor',
        sucursal:    'Reginas Kafeto',
        sucursalId:  'kafeto',
        registrado:  'Rosy',
        fechaIso:    '2026-04-03T15:00:00',
        estado:      'Aplicada',
        nota:        'Recepcion de orden de compra OC-2024-115 de proveedor Lacteos del Valle.',
        productos: [
            { nombre: 'Pay de Fresas', sku: 'PAY-FRE-001', icon: 'cherry', bg: 'bg-red-900/30', color: 'text-red-400', cant: 10, costo: 240, stockPrev: 5 }
        ]
    },
    'ENT-087': {
        folio:       'ENT-087',
        origen:      'Transferencia',
        sucursal:    'Reginas Kafeto',
        sucursalId:  'kafeto',
        registrado:  'Admin',
        fechaIso:    '2026-04-03T17:00:00',
        estado:      'Aplicada',
        nota:        'Transferencia desde Reginas Central por reabasto de productos secos.',
        productos: [
            { nombre: 'Choco Aleman',    sku: 'CHA-ALE-001', icon: 'candy',    bg: 'bg-yellow-900/30', color: 'text-yellow-400', cant: 4, costo: 240, stockPrev: 12 },
            { nombre: 'Cafe Americano',  sku: 'CAF-AME-001', icon: 'cup-soda', bg: 'bg-gray-700',      color: 'text-gray-400',   cant: 4, costo: 220, stockPrev: 40 }
        ]
    }
};

// ──────────────────────────────────────────────────────────────────────
//  Totales por entrada
// ──────────────────────────────────────────────────────────────────────
const _totalsOf = (e) => {
    const uds   = (e.productos || []).reduce((s, p) => s + Number(p.cant  || 0), 0);
    const costo = (e.productos || []).reduce((s, p) => s + Number(p.cant  || 0) * Number(p.costo || 0), 0);
    return { uds, costo };
};

// ──────────────────────────────────────────────────────────────────────
//  Tabla de entradas (formato compatible con createCoffeeTable3)
// ──────────────────────────────────────────────────────────────────────
const _entradaRow = (e) => {
    const { uds, costo } = _totalsOf(e);
    const fechaCorta = _fmtFechaCorta(e.fechaIso);
    const folioColor = e.origen === 'Transferencia' ? 'text-blue-400' : 'text-green-400';
    const udsColor   = e.origen === 'Transferencia' ? 'text-blue-400' : 'text-green-400';
    return {
        id:           e.folio,
        Folio:        `<span class="text-xs font-bold ${folioColor}">${e.folio}</span>`,
        Origen:       _badgeOrigen(e.origen),
        Productos:    `<span class="text-xs font-bold">${e.productos.length}</span>`,
        'Total Uds':  `<span class="text-xs font-bold ${udsColor}">${uds}</span>`,
        'Costo Total':`<span class="text-xs font-bold">${_fmtMoneyShort(costo)}</span>`,
        Registrado:   `<span class="text-[10px] text-gray-400">${e.registrado}</span>`,
        Fecha:        `<span class="text-[10px] text-gray-500 whitespace-nowrap">${fechaCorta}</span>`,
        Estado:       _badgeEstadoEntrada(e.estado),
        a: [
            { class: 'inline-flex items-center justify-center w-7 h-7 rounded text-[12px] transition-colors me-1 bg-slate-600 hover:bg-slate-500 text-white', html: '<i class="icon-eye"></i>',    onclick: `app.selectEntrada('${e.folio}')` },
            { class: 'inline-flex items-center justify-center w-7 h-7 rounded text-[12px] transition-colors me-1 bg-red-600 hover:bg-red-500 text-white',    html: '<i class="icon-pencil"></i>', onclick: `app.editEntrada('${e.folio}')`   }
        ]
    };
};

const SAMPLE_ENTRADAS_TABLE = {
    row: Object.values(SAMPLE_ENTRADAS_DB).map(_entradaRow)
};

// ──────────────────────────────────────────────────────────────────────
//  Conteos para KPIs (Entradas Hoy, Costo Hoy, Semana, Origen principal)
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_ENTRADAS_COUNTS = (() => {
    const all      = Object.values(SAMPLE_ENTRADAS_DB);
    const totals   = all.map(_totalsOf);
    const costoTot = totals.reduce((s, t) => s + t.costo, 0);
    const origenCount = {};
    all.forEach(e => { origenCount[e.origen] = (origenCount[e.origen] || 0) + 1; });
    const principal = Object.keys(origenCount).reduce(
        (a, b) => (origenCount[a] > origenCount[b] ? a : b),
        Object.keys(origenCount)[0] || '-'
    );
    return {
        total_entradas: all.length,
        total_costo:    costoTot,
        total_semana:   all.length,
        principal:      principal
    };
})();

// ──────────────────────────────────────────────────────────────────────
//  Catalogos (sucursales, origenes, estados)
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_ENTRADAS_SUCURSALES = [
    { id: '',        valor: 'Todas las sucursales' },
    { id: 'kafeto',  valor: 'Reginas Kafeto'       },
    { id: 'central', valor: 'Reginas Central'      },
    { id: 'norte',   valor: 'Reginas Norte'        },
    { id: 'sur',     valor: 'Reginas Sur'          }
];

const SAMPLE_ENTRADAS_ORIGENES = [
    { id: '',              valor: 'Todos los origenes' },
    { id: 'Produccion',    valor: 'Produccion'         },
    { id: 'Proveedor',     valor: 'Proveedor'          },
    { id: 'Transferencia', valor: 'Transferencia'      },
    { id: 'Devolucion',    valor: 'Devolucion'         }
];

const SAMPLE_ENTRADAS_ESTADOS = [
    { id: '',          valor: 'Todos los estados' },
    { id: 'Aplicada',  valor: 'Aplicada'          },
    { id: 'Pendiente', valor: 'Pendiente'         },
    { id: 'Reversada', valor: 'Reversada'         }
];

// ──────────────────────────────────────────────────────────────────────
//  Catalogo de productos (para el modal Nueva Entrada, si se necesita)
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_ENTRADAS_CATALOGO = [
    { sku: 'CUP-DEC-001', nombre: 'Cupcake Decorado',          stock: 0,  icon: 'cup-soda', bg: 'bg-orange-900/30', color: 'text-orange-400', costo: 22  },
    { sku: 'CUP-RDV-001', nombre: 'Cupcake Red Velvet',        stock: 8,  icon: 'cup-soda', bg: 'bg-orange-900/30', color: 'text-orange-400', costo: 25  },
    { sku: 'PAS-3LC-001', nombre: 'Pastel 3 Leches Chocolate', stock: 3,  icon: 'cake',     bg: 'bg-amber-900/30',  color: 'text-amber-400',  costo: 280 },
    { sku: 'PAY-FRE-001', nombre: 'Pay de Fresas',             stock: 5,  icon: 'cherry',   bg: 'bg-red-900/30',    color: 'text-red-400',    costo: 260 },
    { sku: 'GAL-CHO-001', nombre: 'Galleta Chocolate',         stock: 15, icon: 'cookie',   bg: 'bg-teal-900/30',   color: 'text-teal-400',   costo: 20  },
    { sku: 'CHA-ALE-001', nombre: 'Choco Aleman',              stock: 12, icon: 'candy',    bg: 'bg-yellow-900/30', color: 'text-yellow-400', costo: 240 },
    { sku: 'CAF-AME-001', nombre: 'Cafe Americano',            stock: 40, icon: 'cup-soda', bg: 'bg-gray-700',      color: 'text-gray-400',   costo: 12  }
];
