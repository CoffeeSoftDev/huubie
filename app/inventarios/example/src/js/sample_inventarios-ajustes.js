// ──────────────────────────────────────────────────────────────────────
//  SAMPLE — Ajustes de Inventario (FAKE)
//  Datos estaticos que alimentan el modulo inventarios-ajustes.js
//  Equivalentes a los del template estatico:
//    coffee/templates/inventarios/inventarios-ajustes.html
// ──────────────────────────────────────────────────────────────────────

const SAMPLE_VIEW_HEADER_AJUSTES = {
    title:    'Inventario',
    subtitle: 'Control de stock por sucursal',
    back:     { href: '/app/inventarios/index.php', title: 'Regresar al inicio' }
};

const SAMPLE_VIEW_FOOTER_AJUSTES = {
    info: 'Mostrando 4 de 4 ajustes',
    legends: [
        { tone: 'purple',  label: 'Ajuste individual' },
        { tone: 'warning', label: 'Inventario fisico' },
        { tone: 'success', label: 'Diferencia positiva' },
        { tone: 'danger',  label: 'Diferencia negativa' }
    ]
};

// ──────────────────────────────────────────────────────────────────────
//  Helpers de badges / formato (compatibles con createCoffeeTable3)
// ──────────────────────────────────────────────────────────────────────
const _badgeMotivo = (motivo) => {
    const map = {
        'Faltante sin explicar':    { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' },
        'Entrada no registrada':    { bg: 'rgba(63,193,137,0.15)', fg: '#3FC189' },
        'Entregados sin registrar': { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
        'Cierre mensual':           { bg: 'rgba(124,58,237,0.15)', fg: '#A78BFA' },
        'Producto encontrado':      { bg: 'rgba(28,100,242,0.15)', fg: '#60A5FA' },
        'Conteo fisico':            { bg: 'rgba(124,58,237,0.15)', fg: '#A78BFA' },
        'Correccion administrativa':{ bg: 'rgba(156,163,175,0.18)',fg: '#D1D5DB' }
    };
    const c = map[motivo] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold" style="background:${c.bg};color:${c.fg};">${motivo}</span>`;
};

const _badgeFolio = (folio, tipo) => {
    const color = tipo === 'fisico' ? 'text-yellow-400' : 'text-purple-400';
    return `<span class="text-xs font-bold ${color}">${folio}</span>`;
};

const _badgeEstadoAjuste = (estado) => {
    const map = {
        'Aplicado':   { bg: 'rgba(63,193,137,0.15)', fg: '#3FC189' },
        'Pendiente':  { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
        'Reversado':  { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' }
    };
    const c = map[estado] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
    return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold" style="background:${c.bg};color:${c.fg};">${estado.toUpperCase()}</span>`;
};

const _fmtDiferencia = (n) => {
    const num = Number(n || 0);
    if (num === 0) return `<span class="text-center text-xs font-bold text-gray-400">0</span>`;
    const sign  = num > 0 ? '+' : '';
    const color = num > 0 ? 'text-green-400' : 'text-red-400';
    return `<span class="text-center text-xs font-bold ${color}">${sign}${num}</span>`;
};

const _fmtCostoDif = (n) => {
    const num = Number(n || 0);
    if (num === 0) return `<span class="text-right text-xs text-gray-400">$0</span>`;
    const sign  = num > 0 ? '+' : '-';
    const abs   = Math.abs(num).toLocaleString('en-US');
    const color = num > 0 ? 'text-green-400' : 'text-red-400';
    return `<span class="text-right text-xs ${color} font-semibold">${sign}$${abs}</span>`;
};

const _fmtSistemaFisico = (n, tipo) => {
    if (tipo === 'fisico') return `<span class="text-center text-[10px] text-gray-500">&mdash;</span>`;
    return `<span class="text-center text-xs text-gray-400">${n}</span>`;
};

const _fmtFisicoVal = (n, tipo) => {
    if (tipo === 'fisico') return `<span class="text-center text-[10px] text-gray-500">&mdash;</span>`;
    return `<span class="text-center text-xs font-bold">${n}</span>`;
};

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

const _fmtMoneyShort = (n) => '$' + Number(n).toLocaleString('en-US');
const _fmtMoney      = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ──────────────────────────────────────────────────────────────────────
//  Ajustes completos (base fake) — usados por tabla y panel
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_AJUSTES_DB = {
    'AJU-042': {
        folio:       'AJU-042',
        tipo:        'individual',
        producto:    'Galleta Chocolate',
        sku:         'GAL-CHO-001',
        icon:        'cookie',
        bg:          'bg-teal-900/30',
        color:       'text-teal-400',
        sucursal:    'Reginas Kafeto',
        sucursalId:  'kafeto',
        sistema:     18,
        fisico:      15,
        diferencia:  -3,
        costoUnit:   20,
        costoDif:    -60,
        motivo:      'Faltante sin explicar',
        autorizo:    'Andrea M.',
        registrado:  'Andrea M.',
        fechaIso:    '2026-04-03T21:00:00',
        estado:      'Aplicado',
        nota:        'Se encontraron 3 galletas menos durante el conteo de cierre. Posible consumo interno no registrado.'
    },
    'AJU-041': {
        folio:       'AJU-041',
        tipo:        'individual',
        producto:    'Pay de Fresas',
        sku:         'PAY-FRE-001',
        icon:        'cherry',
        bg:          'bg-red-900/30',
        color:       'text-red-400',
        sucursal:    'Reginas Kafeto',
        sucursalId:  'kafeto',
        sistema:     10,
        fisico:      12,
        diferencia:  2,
        costoUnit:   140,
        costoDif:    280,
        motivo:      'Entrada no registrada',
        autorizo:    'Admin',
        registrado:  'Admin',
        fechaIso:    '2026-04-01T20:30:00',
        estado:      'Aplicado',
        nota:        'Pay extra encontrado en camara fria sin registro de entrada previa.'
    },
    'AJU-040': {
        folio:       'AJU-040',
        tipo:        'individual',
        producto:    'Pastel 3 Leches',
        sku:         'PAS-3LC-001',
        icon:        'cake',
        bg:          'bg-amber-900/30',
        color:       'text-amber-400',
        sucursal:    'Reginas Kafeto',
        sucursalId:  'kafeto',
        sistema:     12,
        fisico:      10,
        diferencia:  -2,
        costoUnit:   280,
        costoDif:    -560,
        motivo:      'Entregados sin registrar',
        autorizo:    'Andrea M.',
        registrado:  'Andrea M.',
        fechaIso:    '2026-04-01T20:30:00',
        estado:      'Aplicado',
        nota:        'Dos pasteles entregados a cliente VIP sin registrar venta previa.'
    },
    'AJU-039': {
        folio:       'AJU-039',
        tipo:        'fisico',
        producto:    'INVENTARIO FISICO',
        productoNota:'48 productos verificados',
        sku:         'INV-FIS-039',
        icon:        'clipboard-check',
        bg:          'bg-purple-900/30',
        color:       'text-purple-400',
        sucursal:    'Reginas Kafeto',
        sucursalId:  'kafeto',
        sistema:     null,
        fisico:      null,
        diferencia:  -5,
        costoUnit:   0,
        costoDif:    -340,
        motivo:      'Cierre mensual',
        autorizo:    'Admin',
        registrado:  'Admin',
        fechaIso:    '2026-04-01T20:30:00',
        estado:      'Aplicado',
        nota:        'Inventario fisico de cierre mensual marzo. 48 productos verificados, 5 con diferencia.'
    }
};

// ──────────────────────────────────────────────────────────────────────
//  Tabla de ajustes (formato compatible con createCoffeeTable3)
// ──────────────────────────────────────────────────────────────────────
const _ajusteRow = (e) => {
    const productoCell = e.tipo === 'fisico'
        ? `
            <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded ${e.bg} flex items-center justify-center">
                    <i data-lucide="${e.icon}" class="w-3 h-3 ${e.color}"></i>
                </div>
                <div>
                    <p class="text-[11px] font-bold text-yellow-400">${e.producto}</p>
                    <p class="text-[9px] text-gray-500">${e.productoNota || ''}</p>
                </div>
            </div>
        `
        : `
            <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded ${e.bg} flex items-center justify-center">
                    <i data-lucide="${e.icon}" class="w-4 h-4 ${e.color}"></i>
                </div>
                <p class="text-[11px] font-medium">${e.producto}</p>
            </div>
        `;

    return {
        id:           e.folio,
        Folio:        _badgeFolio(e.folio, e.tipo),
        Producto:     productoCell,
        Sistema:      _fmtSistemaFisico(e.sistema, e.tipo),
        Fisico:       _fmtFisicoVal(e.fisico, e.tipo),
        Diferencia:   _fmtDiferencia(e.diferencia),
        'Costo Dif':  _fmtCostoDif(e.costoDif),
        Motivo:       _badgeMotivo(e.motivo),
        Autorizo:     `<span class="text-[10px] text-gray-400">${e.autorizo}</span>`,
        Fecha:        `<span class="text-[10px] text-gray-500 whitespace-nowrap">${_fmtFechaCorta(e.fechaIso)}</span>`,
        a: [
            { class: 'inline-flex items-center justify-center w-7 h-7 rounded text-[12px] transition-colors me-1 bg-slate-600 hover:bg-slate-500 text-white', html: '<i class="icon-eye"></i>',    onclick: `app.selectAjuste('${e.folio}')` },
            { class: 'inline-flex items-center justify-center w-7 h-7 rounded text-[12px] transition-colors me-1 bg-red-600 hover:bg-red-500 text-white',    html: '<i class="icon-pencil"></i>', onclick: `app.editAjuste('${e.folio}')`   }
        ]
    };
};

const SAMPLE_AJUSTES_TABLE = {
    row: Object.values(SAMPLE_AJUSTES_DB).map(_ajusteRow)
};

// ──────────────────────────────────────────────────────────────────────
//  Conteos para KPIs (Ajustes Mes, Diferencia, Ultimo Inv., Precision)
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_AJUSTES_COUNTS = (() => {
    const all          = Object.values(SAMPLE_AJUSTES_DB);
    const total        = all.length;
    const ajustesMes   = 14;
    const diferencia   = all.reduce((s, e) => s + Number(e.costoDif || 0), 0);
    const fisicos      = all.filter(e => e.tipo === 'fisico');
    const ultimoFisico = fisicos.length
        ? new Date(fisicos[0].fechaIso)
        : new Date(all[0].fechaIso);
    const ultimoInv    = `${String(ultimoFisico.getDate()).padStart(2,'0')} ${_MON_ES[ultimoFisico.getMonth()]}`;
    const precision    = '96.8%';
    return {
        total:       total,
        ajustesMes:  ajustesMes,
        diferencia:  diferencia,
        ultimoInv:   ultimoInv,
        precision:   precision
    };
})();

// ──────────────────────────────────────────────────────────────────────
//  Catalogos (sucursales, motivos, estados, productos)
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_AJUSTES_SUCURSALES = [
    { id: '',        valor: 'Todas las sucursales' },
    { id: 'kafeto',  valor: 'Reginas Kafeto'       },
    { id: 'central', valor: 'Reginas Central'      },
    { id: 'norte',   valor: 'Reginas Norte'        },
    { id: 'sur',     valor: 'Reginas Sur'          }
];

const SAMPLE_AJUSTES_MOTIVOS = [
    { id: '',                          valor: 'Todos los motivos'          },
    { id: 'Conteo fisico',             valor: 'Conteo fisico / Inventario' },
    { id: 'Entrada no registrada',     valor: 'Entrada no registrada'      },
    { id: 'Entregados sin registrar',  valor: 'Entregados sin registrar'   },
    { id: 'Faltante sin explicar',     valor: 'Faltante sin explicar'      },
    { id: 'Producto encontrado',       valor: 'Producto encontrado'        },
    { id: 'Cierre mensual',            valor: 'Cierre mensual'             },
    { id: 'Correccion administrativa', valor: 'Correccion administrativa'  }
];

const SAMPLE_AJUSTES_ESTADOS = [
    { id: '',          valor: 'Todos los estados' },
    { id: 'Aplicado',  valor: 'Aplicado'          },
    { id: 'Pendiente', valor: 'Pendiente'         },
    { id: 'Reversado', valor: 'Reversado'         }
];

const SAMPLE_AJUSTES_TIPOS = [
    { id: '',           valor: 'Todos los tipos' },
    { id: 'individual', valor: 'Individual'      },
    { id: 'fisico',     valor: 'Inventario fisico' }
];

// ──────────────────────────────────────────────────────────────────────
//  Catalogo de productos (para el modal Nuevo Ajuste)
// ──────────────────────────────────────────────────────────────────────
const SAMPLE_AJUSTES_CATALOGO = [
    { sku: 'GAL-CHO-001', nombre: 'Galleta Chocolate',         stock: 18, icon: 'cookie',          bg: 'bg-teal-900/30',   color: 'text-teal-400',   costo: 20  },
    { sku: 'PAY-FRE-001', nombre: 'Pay de Fresas',             stock: 12, icon: 'cherry',          bg: 'bg-red-900/30',    color: 'text-red-400',    costo: 140 },
    { sku: 'PAS-3LC-001', nombre: 'Pastel 3 Leches',           stock: 4,  icon: 'cake',            bg: 'bg-amber-900/30',  color: 'text-amber-400',  costo: 280 },
    { sku: 'CUP-DEC-001', nombre: 'Cupcake Decorado',          stock: 24, icon: 'cup-soda',        bg: 'bg-orange-900/30', color: 'text-orange-400', costo: 22  },
    { sku: 'CHA-ALE-001', nombre: 'Choco Aleman',              stock: 12, icon: 'candy',           bg: 'bg-yellow-900/30', color: 'text-yellow-400', costo: 240 },
    { sku: 'CAF-AME-001', nombre: 'Cafe Americano',            stock: 40, icon: 'cup-soda',        bg: 'bg-gray-700',      color: 'text-gray-400',   costo: 12  }
];
