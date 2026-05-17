// ──────────────────────────────────────────────────────────────────────
//  SAMPLE — Visor de Movimientos / Historial (POS FAKE)
//  Datos estaticos que alimentan el modulo pos-movimientos.js
//  Equivalentes a los del template estatico:
//    coffee/templates/inventarios/inventarios-movimientos.html
// ──────────────────────────────────────────────────────────────────────

const SAMPLE_VIEW_HEADER_MOVIMIENTOS = {
    title:    'Historial de Movimientos',
    subtitle: 'Bitacora completa de entradas, salidas, mermas, transferencias, ajustes y devoluciones'
};

const SAMPLE_VIEW_FOOTER_MOVIMIENTOS = {
    info: 'Mostrando 8 de 156 movimientos',
    legends: [
        { tone: 'success', label: 'Entrada'       },
        { tone: 'danger',  label: 'Salida POS'    },
        { tone: 'warning', label: 'Salida pedido' },
        { tone: 'warning', label: 'Merma'         },
        { tone: 'info',    label: 'Transferencia' },
        { tone: 'purple',  label: 'Ajuste'        },
        { tone: 'info',    label: 'Devolucion'    }
    ]
};

// ──────────────────────────────────────────────────────────────────────
//  Helpers de badges / formato (compatibles con createCoffeeTable3)
// ──────────────────────────────────────────────────────────────────────
const _badgeTipoMov = (tipo) => {
    const map = {
        'ENTRADA':       { bg: 'rgba(63,193,137,0.15)', fg: '#3FC189' },
        'SALIDA POS':    { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' },
        'SALIDA PED':    { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
        'MERMA':         { bg: 'rgba(251,146,60,0.15)', fg: '#FB923C' },
        'TRANSFERENCIA': { bg: 'rgba(28,100,242,0.15)', fg: '#60A5FA' },
        'AJUSTE':        { bg: 'rgba(124,58,237,0.15)', fg: '#A78BFA' },
        'DEVOLUCION':    { bg: 'rgba(34,211,238,0.15)', fg: '#22D3EE' }
    };
    const c = map[tipo] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap" style="background:${c.bg};color:${c.fg};">${tipo}</span>`;
};

const _signedQty = (tipo, cant) => {
    const positivos = ['ENTRADA', 'TRANSFERENCIA', 'DEVOLUCION'];
    const isPos = positivos.includes(tipo);
    const sign  = isPos ? '+' : '-';
    const color = {
        'ENTRADA':       'text-green-400',
        'TRANSFERENCIA': 'text-blue-400',
        'DEVOLUCION':    'text-cyan-400',
        'SALIDA POS':    'text-red-400',
        'SALIDA PED':    'text-red-400',
        'MERMA':         'text-orange-400',
        'AJUSTE':        'text-purple-400'
    }[tipo] || 'text-gray-400';
    return `<span class="text-xs font-bold ${color}">${sign}${Math.abs(cant)}</span>`;
};

const _signedMoney = (tipo, cant, costoUnit) => {
    const positivos = ['ENTRADA', 'TRANSFERENCIA', 'DEVOLUCION'];
    const isPos = positivos.includes(tipo);
    const sign  = isPos ? '+' : '-';
    const total = Math.abs(cant) * Number(costoUnit || 0);
    const color = {
        'ENTRADA':       'text-green-400',
        'TRANSFERENCIA': 'text-blue-400',
        'DEVOLUCION':    'text-cyan-400',
        'SALIDA POS':    'text-red-400',
        'SALIDA PED':    'text-red-400',
        'MERMA':         'text-orange-400',
        'AJUSTE':        'text-purple-400'
    }[tipo] || 'text-gray-400';
    return `<span class="text-xs font-bold ${color}">${sign}$${total.toLocaleString('en-US')}</span>`;
};

const _fmtMoneyMov = (n) => '$' + Number(n).toLocaleString('en-US');

const _DOW_ES_MV = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
const _MON_ES_MV = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const _fmtFechaMov = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const dow = _DOW_ES_MV[d.getDay()];
    const day = String(d.getDate()).padStart(2, '0');
    const mon = _MON_ES_MV[d.getMonth()];
    let h     = d.getHours();
    const m   = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return `${dow} ${day} ${mon} ${String(h).padStart(2, '0')}:${m} ${ampm}`;
};

// ──────────────────────────────────────────────────────────────────────
//  Movimientos completos (base fake) — usados por tabla y panel
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_MOVIMIENTOS_DB = {
    'M-301': {
        id:        'M-301',
        producto:  'Pastel 3 Leches Chocolate',
        sku:       'PAS-3LC-001',
        icon:      'cake',
        bg:        'bg-amber-900/30',
        color:     'text-amber-400',
        tipo:      'SALIDA POS',
        cant:      1,
        stockPrev: 4,
        stockPost: 3,
        costoUnit: 280,
        referencia:'Venta #1043',
        refLink:   true,
        sucursal:  'Reginas Kafeto',
        sucursalId:'kafeto',
        usuario:   'Andrea M.',
        fechaIso:  '2026-04-04T10:45:00'
    },
    'M-300': {
        id:        'M-300',
        producto:  'Pay de Fresas',
        sku:       'PAY-FRE-001',
        icon:      'cherry',
        bg:        'bg-red-900/30',
        color:     'text-red-400',
        tipo:      'SALIDA POS',
        cant:      2,
        stockPrev: 14,
        stockPost: 12,
        costoUnit: 140,
        referencia:'Venta #1043',
        refLink:   true,
        sucursal:  'Reginas Kafeto',
        sucursalId:'kafeto',
        usuario:   'Andrea M.',
        fechaIso:  '2026-04-04T10:45:00'
    },
    'M-299': {
        id:        'M-299',
        producto:  'Cupcake Decorado',
        sku:       'CUP-DEC-001',
        icon:      'cup-soda',
        bg:        'bg-orange-900/30',
        color:     'text-orange-400',
        tipo:      'ENTRADA',
        cant:      24,
        stockPrev: 0,
        stockPost: 24,
        costoUnit: 22,
        referencia:'Produccion diaria',
        refLink:   false,
        sucursal:  'Reginas Kafeto',
        sucursalId:'kafeto',
        usuario:   'Carlos G.',
        fechaIso:  '2026-04-04T08:30:00'
    },
    'M-298': {
        id:        'M-298',
        producto:  'Pastel 3 Leches Chocolate',
        sku:       'PAS-3LC-001',
        icon:      'cake',
        bg:        'bg-amber-900/30',
        color:     'text-amber-400',
        tipo:      'MERMA',
        cant:      2,
        stockPrev: 6,
        stockPost: 4,
        costoUnit: 280,
        referencia:'Caducidad',
        refLink:   false,
        sucursal:  'Reginas Kafeto',
        sucursalId:'kafeto',
        usuario:   'Andrea M.',
        fechaIso:  '2026-04-04T09:15:00'
    },
    'M-297': {
        id:        'M-297',
        producto:  'Choco Aleman',
        sku:       'CHA-ALE-001',
        icon:      'candy',
        bg:        'bg-yellow-900/30',
        color:     'text-yellow-400',
        tipo:      'TRANSFERENCIA',
        cant:      3,
        stockPrev: 5,
        stockPost: 8,
        costoUnit: 240,
        referencia:'Desde: Suc. Centro',
        refLink:   false,
        sucursal:  'Reginas Kafeto',
        sucursalId:'kafeto',
        usuario:   'Admin',
        fechaIso:  '2026-04-03T17:00:00'
    },
    'M-296': {
        id:        'M-296',
        producto:  'Galleta Chocolate',
        sku:       'GAL-CHO-001',
        icon:      'cookie',
        bg:        'bg-teal-900/30',
        color:     'text-teal-400',
        tipo:      'AJUSTE',
        cant:      3,
        stockPrev: 18,
        stockPost: 15,
        costoUnit: 20,
        referencia:'Conteo fisico',
        refLink:   false,
        sucursal:  'Reginas Kafeto',
        sucursalId:'kafeto',
        usuario:   'Andrea M.',
        fechaIso:  '2026-04-03T21:00:00'
    },
    'M-295': {
        id:        'M-295',
        producto:  'Pastel 3 Leches Chocolate',
        sku:       'PAS-3LC-001',
        icon:      'cake',
        bg:        'bg-amber-900/30',
        color:     'text-amber-400',
        tipo:      'SALIDA PED',
        cant:      1,
        stockPrev: 7,
        stockPost: 6,
        costoUnit: 280,
        referencia:'Pedido #1042',
        refLink:   true,
        sucursal:  'Reginas Kafeto',
        sucursalId:'kafeto',
        usuario:   'Andrea M.',
        fechaIso:  '2026-04-03T16:20:00'
    },
    'M-294': {
        id:        'M-294',
        producto:  'Tres Leches Strawberry',
        sku:       'TLS-STR-001',
        icon:      'cake',
        bg:        'bg-rose-900/30',
        color:     'text-rose-400',
        tipo:      'DEVOLUCION',
        cant:      1,
        stockPrev: 6,
        stockPost: 7,
        costoUnit: 260,
        referencia:'Devol #1038',
        refLink:   true,
        sucursal:  'Reginas Kafeto',
        sucursalId:'kafeto',
        usuario:   'Carlos G.',
        fechaIso:  '2026-04-03T14:10:00'
    }
};

// ──────────────────────────────────────────────────────────────────────
//  Tabla de movimientos (formato compatible con createCoffeeTable3)
// ──────────────────────────────────────────────────────────────────────
const _movRow = (m) => {
    const fechaCorta = _fmtFechaMov(m.fechaIso);
    const refHtml    = m.refLink
        ? `<span class="text-[10px] text-blue-400 hover:underline cursor-pointer">${m.referencia}</span>`
        : `<span class="text-[10px] text-gray-400">${m.referencia}</span>`;
    return {
        id:           m.id,
        '#':          `<span class="text-[10px] text-gray-500">${m.id}</span>`,
        Producto:     `<div class="flex items-center gap-2">
                         <div class="w-6 h-6 rounded ${m.bg} flex items-center justify-center"><i data-lucide="${m.icon}" class="w-4 h-4 ${m.color}"></i></div>
                         <p class="text-[11px] font-medium">${m.producto}</p>
                       </div>`,
        Tipo:         _badgeTipoMov(m.tipo),
        Cant:         _signedQty(m.tipo, m.cant),
        Antes:        `<span class="text-[10px] text-gray-500">${m.stockPrev}</span>`,
        Desp:         `<span class="text-xs font-bold">${m.stockPost}</span>`,
        'Costo Unit': `<span class="text-[10px] text-gray-400">${_fmtMoneyMov(m.costoUnit)}</span>`,
        'Costo Total':_signedMoney(m.tipo, m.cant, m.costoUnit),
        Referencia:   refHtml,
        Usuario:      `<span class="text-[10px] text-gray-400">${m.usuario}</span>`,
        Fecha:        `<span class="text-[10px] text-gray-500 whitespace-nowrap">${fechaCorta}</span>`,
        a: [
            { class: 'btn btn-sm btn-secondary', html: '<i class="icon-eye"></i>', onclick: `app.selectMovimiento('${m.id}')` }
        ]
    };
};

const SAMPLE_MOVIMIENTOS_TABLE = {
    row: Object.values(SAMPLE_MOVIMIENTOS_DB).map(_movRow)
};

// ──────────────────────────────────────────────────────────────────────
//  Conteos para KPIs (Total, Entradas, Salidas, Merma, Transferencias)
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_MOVIMIENTOS_COUNTS = (() => {
    const all = Object.values(SAMPLE_MOVIMIENTOS_DB);
    return {
        total:          all.length,
        entradas:       all.filter(m => m.tipo === 'ENTRADA' || m.tipo === 'DEVOLUCION').length,
        salidas:        all.filter(m => m.tipo === 'SALIDA POS' || m.tipo === 'SALIDA PED').length,
        merma:          all.filter(m => m.tipo === 'MERMA').length,
        transferencias: all.filter(m => m.tipo === 'TRANSFERENCIA').length
    };
})();

// ──────────────────────────────────────────────────────────────────────
//  Catalogos (sucursales, tipos)
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_MOVIMIENTOS_SUCURSALES = [
    { id: '',        valor: 'Todas las sucursales' },
    { id: 'kafeto',  valor: 'Reginas Kafeto'       },
    { id: 'central', valor: 'Reginas Central'      },
    { id: 'norte',   valor: 'Reginas Norte'        },
    { id: 'sur',     valor: 'Reginas Sur'          }
];

const SAMPLE_MOVIMIENTOS_TIPOS = [
    { id: '',              valor: 'Todos los tipos' },
    { id: 'ENTRADA',       valor: 'Entrada'         },
    { id: 'SALIDA POS',    valor: 'Salida POS'      },
    { id: 'SALIDA PED',    valor: 'Salida pedido'   },
    { id: 'MERMA',         valor: 'Merma'           },
    { id: 'TRANSFERENCIA', valor: 'Transferencia'   },
    { id: 'AJUSTE',        valor: 'Ajuste'          },
    { id: 'DEVOLUCION',    valor: 'Devolucion'      }
];

// ──────────────────────────────────────────────────────────────────────
//  Historial reciente del producto (para panel detalle, timeline)
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_MOV_TIMELINE = {
    'PAS-3LC-001': [
        { tipo: 'SALIDA POS',  cant: 1,  ref: 'Venta #1043',  fechaIso: '2026-04-04T10:45:00' },
        { tipo: 'MERMA',       cant: 2,  ref: 'Caducidad',    fechaIso: '2026-04-04T09:15:00' },
        { tipo: 'SALIDA PED',  cant: 1,  ref: 'Pedido #1042', fechaIso: '2026-04-03T16:20:00' },
        { tipo: 'ENTRADA',     cant: 10, ref: 'Produccion',   fechaIso: '2026-04-03T08:00:00' }
    ]
};
