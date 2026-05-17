// ──────────────────────────────────────────────────────────────────────
//  SAMPLE — Visor de Traspasos entre Sucursales (POS FAKE)
//  Datos estaticos que alimentan el modulo pos-traspasos.js
//  Equivalentes a los del template estatico:
//    coffee/templates/inventarios/inventarios-traspasos.html
// ──────────────────────────────────────────────────────────────────────

const SAMPLE_VIEW_HEADER_TRASPASOS = {
    title:    'Traspasos entre Sucursales',
    subtitle: 'Movimientos de producto entre almacenes con flujo de aprobacion y confirmacion',
    back:     { href: '/app/inventarios/index.php', title: 'Regresar al inicio' }
};

const SAMPLE_VIEW_FOOTER_TRASPASOS = {
    info: 'Mostrando 5 de 24 traspasos',
    legends: [
        { tone: 'warning', label: 'Pendiente'    },
        { tone: 'warning', label: 'En Transito'  },
        { tone: 'success', label: 'Recibido'     },
        { tone: 'danger',  label: 'Rechazado'    }
    ]
};

// ──────────────────────────────────────────────────────────────────────
//  Helpers de badges / formato (compatibles con createCoffeeTable3)
// ──────────────────────────────────────────────────────────────────────
const _badgeEstadoTras = (estado) => {
    const map = {
        'Pendiente':    { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
        'En Transito':  { bg: 'rgba(251,146,60,0.15)', fg: '#FB923C' },
        'Recibido':     { bg: 'rgba(63,193,137,0.15)', fg: '#3FC189' },
        'Rechazado':    { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' }
    };
    const c = map[estado] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap" style="background:${c.bg};color:${c.fg};">${estado}</span>`;
};

const _sucIcon = (sucId) => {
    const map = {
        'kafeto':  { bg: 'bg-green-500/15',            color: 'text-green-400'  },
        'central': { bg: 'bg-[rgba(28,100,242,0.15)]', color: 'text-[#76A9FA]'  },
        'norte':   { bg: 'bg-purple-500/15',           color: 'text-purple-400' },
        'sur':     { bg: 'bg-pink-500/15',             color: 'text-pink-400'   }
    };
    return map[sucId] || { bg: 'bg-gray-700', color: 'text-gray-400' };
};

const _sucBadge = (suc) => {
    const ic = _sucIcon(suc.id);
    return `<div class="flex items-center gap-1.5">
              <div class="w-5 h-5 rounded ${ic.bg} flex items-center justify-center"><i data-lucide="store" class="w-3 h-3 ${ic.color}"></i></div>
              <span class="text-[10px]">${suc.nombre}</span>
            </div>`;
};

const _fmtMoneyTras = (n) => '$' + Number(n).toLocaleString('en-US');

const _DOW_ES_TR = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
const _MON_ES_TR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const _fmtFechaTras = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const dow = _DOW_ES_TR[d.getDay()];
    const day = String(d.getDate()).padStart(2, '0');
    const mon = _MON_ES_TR[d.getMonth()];
    let h     = d.getHours();
    const m   = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return `${dow} ${day} ${mon} ${String(h).padStart(2, '0')}:${m} ${ampm}`;
};

// ──────────────────────────────────────────────────────────────────────
//  Traspasos completos (base fake) — usados por tabla y panel
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_TRASPASOS_DB = {
    'TRA-042': {
        folio:    'TRA-042',
        origen:   { id: 'central', nombre: 'Suc. Centro'      },
        destino:  { id: 'kafeto',  nombre: 'Reginas Kafeto'   },
        estado:   'En Transito',
        solicito: 'Admin',
        autoriza: 'Carlos G.',
        fechaIso: '2026-04-04T10:00:00',
        fechaEnvio: '2026-04-04T11:30:00',
        nota:     'Reabastecimiento urgente por aumento de demanda fin de semana. Confirmar recepcion al llegar.',
        productos: [
            { nombre: 'Choco Aleman',  sku: 'CHA-ALE-001', icon: 'candy',  bg: 'bg-yellow-900/30', color: 'text-yellow-400', cant: 5, costo: 240, stockOrigenPrev: 12, stockDestinoPrev: 5  },
            { nombre: 'Pay de Fresas', sku: 'PAY-FRE-001', icon: 'cherry', bg: 'bg-red-900/30',    color: 'text-red-400',    cant: 3, costo: 140, stockOrigenPrev: 8,  stockDestinoPrev: 12 }
        ],
        timeline: [
            { estado: 'En Transito', usuario: 'Carlos G.', fechaIso: '2026-04-04T11:30:00' },
            { estado: 'Autorizado',  usuario: 'Carlos G.', fechaIso: '2026-04-04T10:30:00' },
            { estado: 'Solicitado',  usuario: 'Admin',     fechaIso: '2026-04-04T10:00:00' }
        ]
    },
    'TRA-041': {
        folio:    'TRA-041',
        origen:   { id: 'kafeto', nombre: 'Reginas Kafeto' },
        destino:  { id: 'norte',  nombre: 'Suc. Norte'     },
        estado:   'Recibido',
        solicito: 'Carlos G.',
        autoriza: 'Admin',
        fechaIso: '2026-04-04T09:15:00',
        fechaEnvio: '2026-04-04T10:00:00',
        nota:     'Reabasto programado de pastel 3 leches.',
        productos: [
            { nombre: 'Pastel 3 Leches Chocolate', sku: 'PAS-3LC-001', icon: 'cake', bg: 'bg-amber-900/30', color: 'text-amber-400', cant: 4, costo: 280, stockOrigenPrev: 6, stockDestinoPrev: 2 }
        ],
        timeline: [
            { estado: 'Recibido',    usuario: 'Suc. Norte', fechaIso: '2026-04-04T12:00:00' },
            { estado: 'En Transito', usuario: 'Carlos G.',  fechaIso: '2026-04-04T10:00:00' },
            { estado: 'Solicitado',  usuario: 'Carlos G.',  fechaIso: '2026-04-04T09:15:00' }
        ]
    },
    'TRA-040': {
        folio:    'TRA-040',
        origen:   { id: 'sur',    nombre: 'Suc. Sur'       },
        destino:  { id: 'kafeto', nombre: 'Reginas Kafeto' },
        estado:   'Pendiente',
        solicito: 'Andrea M.',
        autoriza: '-',
        fechaIso: '2026-04-03T16:30:00',
        fechaEnvio: null,
        nota:     'Surtido semanal pendiente de autorizacion.',
        productos: [
            { nombre: 'Cupcake Decorado', sku: 'CUP-DEC-001', icon: 'cup-soda', bg: 'bg-orange-900/30', color: 'text-orange-400', cant: 6, costo: 22,  stockOrigenPrev: 18, stockDestinoPrev: 0  },
            { nombre: 'Galleta Chocolate', sku: 'GAL-CHO-001', icon: 'cookie',   bg: 'bg-teal-900/30',   color: 'text-teal-400',   cant: 5, costo: 20,  stockOrigenPrev: 22, stockDestinoPrev: 15 },
            { nombre: 'Pastel 3 Leches Chocolate', sku: 'PAS-3LC-001', icon: 'cake', bg: 'bg-amber-900/30', color: 'text-amber-400', cant: 4, costo: 280, stockOrigenPrev: 7, stockDestinoPrev: 3 }
        ],
        timeline: [
            { estado: 'Solicitado',  usuario: 'Andrea M.', fechaIso: '2026-04-03T16:30:00' }
        ]
    },
    'TRA-039': {
        folio:    'TRA-039',
        origen:   { id: 'kafeto',  nombre: 'Reginas Kafeto' },
        destino:  { id: 'central', nombre: 'Suc. Centro'    },
        estado:   'Rechazado',
        solicito: 'Andrea M.',
        autoriza: 'Suc. Centro',
        fechaIso: '2026-04-02T11:20:00',
        fechaEnvio: null,
        nota:     'Rechazado por falta de stock disponible en origen.',
        productos: [
            { nombre: 'Tres Leches Strawberry', sku: 'TLS-STR-001', icon: 'cake', bg: 'bg-rose-900/30', color: 'text-rose-400', cant: 6, costo: 260, stockOrigenPrev: 3, stockDestinoPrev: 2 }
        ],
        timeline: [
            { estado: 'Rechazado',  usuario: 'Suc. Centro', fechaIso: '2026-04-02T13:45:00' },
            { estado: 'Solicitado', usuario: 'Andrea M.',   fechaIso: '2026-04-02T11:20:00' }
        ]
    },
    'TRA-038': {
        folio:    'TRA-038',
        origen:   { id: 'norte',  nombre: 'Suc. Norte'     },
        destino:  { id: 'kafeto', nombre: 'Reginas Kafeto' },
        estado:   'Recibido',
        solicito: 'Admin',
        autoriza: 'Suc. Norte',
        fechaIso: '2026-04-01T14:45:00',
        fechaEnvio: '2026-04-01T15:30:00',
        nota:     'Galletas para reposicion de barra.',
        productos: [
            { nombre: 'Galleta Chocolate', sku: 'GAL-CHO-001', icon: 'cookie', bg: 'bg-teal-900/30', color: 'text-teal-400', cant: 20, costo: 20, stockOrigenPrev: 35, stockDestinoPrev: 5 }
        ],
        timeline: [
            { estado: 'Recibido',    usuario: 'Reginas Kafeto', fechaIso: '2026-04-01T18:10:00' },
            { estado: 'En Transito', usuario: 'Suc. Norte',     fechaIso: '2026-04-01T15:30:00' },
            { estado: 'Solicitado',  usuario: 'Admin',          fechaIso: '2026-04-01T14:45:00' }
        ]
    }
};

// ──────────────────────────────────────────────────────────────────────
//  Totales por traspaso
// ──────────────────────────────────────────────────────────────────────
const _totalsTras = (t) => {
    const items = (t.productos || []).length;
    const uds   = (t.productos || []).reduce((s, p) => s + Number(p.cant || 0), 0);
    const costo = (t.productos || []).reduce((s, p) => s + Number(p.cant || 0) * Number(p.costo || 0), 0);
    return { items, uds, costo };
};

// ──────────────────────────────────────────────────────────────────────
//  Productos resumidos (texto + iconos apilados)
// ──────────────────────────────────────────────────────────────────────
const _productosResumen = (t) => {
    const prods = t.productos || [];
    if (!prods.length) return '<span class="text-[10px] text-gray-500 italic">Sin productos</span>';
    const iconos = prods.slice(0, 3).map(p => `
        <div class="w-5 h-5 rounded ${p.bg} flex items-center justify-center border border-[#141d2b]"><i data-lucide="${p.icon}" class="w-3 h-3 ${p.color}"></i></div>
    `).join('');
    const nombres = prods.length === 1
        ? prods[0].nombre
        : prods.slice(0, 2).map(p => p.nombre.split(' ').slice(0, 2).join(' ')).join(', ') + (prods.length > 2 ? '...' : '');
    return `<div class="flex items-center gap-1.5">
              <div class="flex -space-x-1">${iconos}</div>
              <p class="text-[11px] font-medium">${nombres}</p>
            </div>`;
};

// ──────────────────────────────────────────────────────────────────────
//  Tabla de traspasos (formato compatible con createCoffeeTable3)
// ──────────────────────────────────────────────────────────────────────
const _trasRow = (t) => {
    const { items, uds, costo } = _totalsTras(t);
    const fechaCorta = _fmtFechaTras(t.fechaIso);
    const udsColor   = t.estado === 'Rechazado' ? 'text-red-400' : 'text-blue-400';
    return {
        id:           t.folio,
        Folio:        `<span class="text-xs font-bold text-[#c4b5fd]">${t.folio}</span>`,
        Origen:       _sucBadge(t.origen),
        '':           `<i data-lucide="arrow-right" class="w-3 h-3 text-[#c4b5fd] mx-auto"></i>`,
        Destino:      _sucBadge(t.destino),
        Productos:    _productosResumen(t),
        Items:        `<span class="text-xs font-bold">${items}</span>`,
        Uds:          `<span class="text-xs font-bold ${udsColor}">${uds}</span>`,
        Costo:        `<span class="text-xs font-bold">${_fmtMoneyTras(costo)}</span>`,
        Solicito:     `<span class="text-[10px] text-gray-400">${t.solicito}</span>`,
        Fecha:        `<span class="text-[10px] text-gray-500 whitespace-nowrap">${fechaCorta}</span>`,
        Estado:       _badgeEstadoTras(t.estado),
        a: [
            { class: 'btn btn-sm btn-secondary', html: '<i class="icon-eye"></i>', onclick: `app.selectTraspaso('${t.folio}')` }
        ]
    };
};

const SAMPLE_TRASPASOS_TABLE = {
    row: Object.values(SAMPLE_TRASPASOS_DB).map(_trasRow)
};

// ──────────────────────────────────────────────────────────────────────
//  Conteos para KPIs (Total, Pendientes, En Transito, Recibidos, Rechazados)
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_TRASPASOS_COUNTS = (() => {
    const all = Object.values(SAMPLE_TRASPASOS_DB);
    return {
        total:        all.length,
        pendientes:   all.filter(t => t.estado === 'Pendiente').length,
        enTransito:   all.filter(t => t.estado === 'En Transito').length,
        recibidos:    all.filter(t => t.estado === 'Recibido').length,
        rechazados:   all.filter(t => t.estado === 'Rechazado').length
    };
})();

// ──────────────────────────────────────────────────────────────────────
//  Catalogos (sucursales, estados)
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_TRASPASOS_SUCURSALES = [
    { id: '',        valor: 'Todas las sucursales' },
    { id: 'kafeto',  valor: 'Reginas Kafeto'       },
    { id: 'central', valor: 'Suc. Centro'          },
    { id: 'norte',   valor: 'Suc. Norte'           },
    { id: 'sur',     valor: 'Suc. Sur'             }
];

const SAMPLE_TRASPASOS_ESTADOS = [
    { id: '',            valor: 'Todos los estados' },
    { id: 'Pendiente',   valor: 'Pendiente'         },
    { id: 'En Transito', valor: 'En Transito'       },
    { id: 'Recibido',    valor: 'Recibido'          },
    { id: 'Rechazado',   valor: 'Rechazado'         }
];
