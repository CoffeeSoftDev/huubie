// -- Vista --

const SAMPLE_VIEW_HEADER_TICKETS = {
    title:    'Tickets y pagos',
    subtitle: 'Explora tickets, pagos y su estado fiscal. Filtra por dia, forma de pago o estado',
    back:     { href: '/app/facturador/facturador.php', title: 'Regresar al Facturador' }
};

const SAMPLE_VIEW_FOOTER_TICKETS = {
    info: '',
    legends: [
        { tone: 'success', label: 'Facturado'    },
        { tone: 'warning', label: 'IVA 0%'       },
        { tone: 'default', label: 'Pendiente'    },
        { tone: 'purple',  label: 'Tarjeta'      }
    ]
};

const SAMPLE_TICKETS_HEADER_CLASSES = {
    title:    'text-base font-bold text-ink-900',
    subtitle: 'text-[11px] text-ink-500',
    groupLbl: 'text-[9px] text-ink-400 uppercase tracking-wider font-bold',
    btn:      'px-2.5 py-1 rounded text-[11px] border border-ink-200 text-ink-600 hover:bg-ink-50 transition-colors',
    btnActive:'px-2.5 py-1 rounded text-[11px] border border-brand-500 bg-brand-50 text-brand-600 font-bold',
    sep:      'text-ink-300',
    backBtn:  'w-8 h-8 rounded-full bg-white hover:bg-brand-50 border border-ink-200 hover:border-brand-500 flex items-center justify-center text-ink-500 hover:text-brand-600 transition-colors flex-shrink-0'
};

const SAMPLE_TICKETS_FOOTER_CLASSES = {
    info:   'text-[10px] text-ink-400',
    legend: 'flex items-center gap-3 text-[10px] text-ink-400',
    item:   'flex items-center gap-1'
};

const SAMPLE_TICKETS_FOOTER_TONES = {
    default: '#6B7280',
    success: '#15803D',
    warning: '#B45309',
    danger:  '#B91C1C',
    info:    '#1D4ED8',
    purple:  '#A84A33'
};

// -- Helpers --

const _fmtMX = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const _fmtFechaCorta = (iso) => String(iso || '').split('-').reverse().join('/');

const _badgeMetodo = (metodo) => {
    const cls = metodo === 'Efectivo' ? 'b-green' : 'b-terra';
    return `<span class="badge-base ${cls}">${metodo}</span>`;
};

const _badgeEstadoFiscal = (e) => {
    if (e.fiscal === 'invoiced') return '<span class="badge-base b-green"><i data-lucide="lock" class="w-3 h-3"></i>Facturado</span>';
    if (e.tasa === 0)            return '<span class="badge-base b-yellow">IVA 0%</span>';
    return '<span class="badge-base b-gray">Pendiente</span>';
};

const _badgeTasa = (tasa) => tasa === 0
    ? '<span class="badge-base b-yellow">0%</span>'
    : '<span class="badge-base b-terra">16%</span>';

const _badgeFactura = (folio) => folio
    ? `<span class="badge-base b-terra">${folio}</span>`
    : '<span class="cell-null">Sin factura</span>';

const _cellId = (id) => `<span class="font-mono text-[10px] text-ink-500">${id}</span>`;

// -- Datos --

const SAMPLE_TICKETS_DB = {
    '461831': {
        id:      '461831',
        orden:   1,
        fecha:   '2026-06-10',
        metodo:  'Efectivo',
        mesero:  'JORGE GORDILLO',
        total:   1058.20,
        fiscal:  'pending',
        tasa:    0.16,
        factura: null
    },
    '461832': {
        id:      '461832',
        orden:   2,
        fecha:   '2026-06-10',
        metodo:  'Tarjeta de credito',
        mesero:  'ANGEL ANTONIO',
        total:   1282.00,
        fiscal:  'pending',
        tasa:    0.16,
        factura: null
    },
    '461833': {
        id:      '461833',
        orden:   3,
        fecha:   '2026-06-10',
        metodo:  'Tarjeta de credito',
        mesero:  'JAZMIN DOMINGUEZ',
        total:   2274.80,
        fiscal:  'pending',
        tasa:    0.16,
        factura: null
    },
    '461834': {
        id:      '461834',
        orden:   4,
        fecha:   '2026-06-10',
        metodo:  'Efectivo',
        mesero:  'ISMAEL CORTES',
        total:   1610.40,
        fiscal:  'pending',
        tasa:    0.16,
        factura: null
    },
    '461835': {
        id:      '461835',
        orden:   5,
        fecha:   '2026-06-10',
        metodo:  'Tarjeta de credito',
        mesero:  'MOISES ROBLES',
        total:   1271.00,
        fiscal:  'pending',
        tasa:    0.16,
        factura: null
    },
    '461836': {
        id:      '461836',
        orden:   6,
        fecha:   '2026-06-10',
        metodo:  'Tarjeta de credito',
        mesero:  'OBED PEREZ',
        total:   1633.00,
        fiscal:  'invoiced',
        tasa:    0.16,
        factura: 'A134'
    },
    '461837': {
        id:      '461837',
        orden:   7,
        fecha:   '2026-06-10',
        metodo:  'Efectivo',
        mesero:  'ANGEL ANTONIO',
        total:   1533.40,
        fiscal:  'pending',
        tasa:    0.16,
        factura: null
    },
    '461838': {
        id:      '461838',
        orden:   8,
        fecha:   '2026-06-10',
        metodo:  'Tarjeta de credito',
        mesero:  'JAZMIN DOMINGUEZ',
        total:   1345.30,
        fiscal:  'invoiced',
        tasa:    0.16,
        factura: 'A135'
    },
    '461839': {
        id:      '461839',
        orden:   9,
        fecha:   '2026-06-10',
        metodo:  'Tarjeta de credito',
        mesero:  'ISMAEL CORTES',
        total:   2024.00,
        fiscal:  'pending',
        tasa:    0.16,
        factura: null
    },
    '4618310': {
        id:      '4618310',
        orden:   10,
        fecha:   '2026-06-10',
        metodo:  'Tarjeta de credito',
        mesero:  'MOISES ROBLES',
        total:   1422.55,
        fiscal:  'pending',
        tasa:    0.16,
        factura: null
    },
    '4618311': {
        id:      '4618311',
        orden:   11,
        fecha:   '2026-06-10',
        metodo:  'Tarjeta de credito',
        mesero:  'OBED PEREZ',
        total:   1699.70,
        fiscal:  'pending',
        tasa:    0,
        factura: null
    },
    '4618312': {
        id:      '4618312',
        orden:   12,
        fecha:   '2026-06-10',
        metodo:  'Tarjeta de credito',
        mesero:  'ANGEL ANTONIO',
        total:   3034.90,
        fiscal:  'pending',
        tasa:    0,
        factura: null
    },
    '4618313': {
        id:      '4618313',
        orden:   13,
        fecha:   '2026-06-10',
        metodo:  'Tarjeta de credito',
        mesero:  'JAZMIN DOMINGUEZ',
        total:   355.30,
        fiscal:  'pending',
        tasa:    0,
        factura: null
    },
    '4618314': {
        id:      '4618314',
        orden:   14,
        fecha:   '2026-06-10',
        metodo:  'Tarjeta de credito',
        mesero:  'ISMAEL CORTES',
        total:   503.80,
        fiscal:  'pending',
        tasa:    0,
        factura: null
    },
    '4618315': {
        id:      '4618315',
        orden:   15,
        fecha:   '2026-06-10',
        metodo:  'Tarjeta de credito',
        mesero:  'MOISES ROBLES',
        total:   1093.00,
        fiscal:  'pending',
        tasa:    0,
        factura: null
    },
    '4618316': {
        id:      '4618316',
        orden:   16,
        fecha:   '2026-06-10',
        metodo:  'Tarjeta de credito',
        mesero:  'OBED PEREZ',
        total:   969.10,
        fiscal:  'pending',
        tasa:    0,
        factura: null
    }
};

const _totalsOf = (e) => {
    const subtotal = Number(e.total || 0) / (1 + Number(e.tasa || 0));
    return {
        subtotal: subtotal,
        iva:      Number(e.total || 0) - subtotal,
        ieps:     0
    };
};

// -- Filas --

const _ticketRow = (e) => {
    const t = _totalsOf(e);
    return {
        id:               e.id,
        Folio:            _cellId(e.id),
        Orden:            `<span class="text-ink-600">${e.orden}</span>`,
        Fecha:            `<span class="text-ink-600 whitespace-nowrap">${_fmtFechaCorta(e.fecha)}</span>`,
        'Forma de pago':  _badgeMetodo(e.metodo),
        Metodo:           '<span class="text-ink-500">PUE</span>',
        'Estado fiscal':  _badgeEstadoFiscal(e),
        Tasa:             _badgeTasa(e.tasa),
        Subtotal:         `<span class="text-ink-600">${_fmtMX(t.subtotal)}</span>`,
        IVA:              `<span class="text-ink-600">${_fmtMX(t.iva)}</span>`,
        IEPS:             `<span class="text-ink-600">${_fmtMX(t.ieps)}</span>`,
        Total:            `<span class="font-semibold text-ink-900">${_fmtMX(e.total)}</span>`,
        Factura:          _badgeFactura(e.factura),
        a: [
            {
                class:   'btn-ghost !py-1 !px-2 text-[11px]',
                html:    '<i data-lucide="eye" class="w-3.5 h-3.5"></i>Ver',
                onclick: `app.selectTicket('${e.id}')`
            },
            {
                class:   'btn-ghost !py-1 !px-2 text-[11px]',
                html:    '<i data-lucide="printer" class="w-3.5 h-3.5"></i>Ticket',
                onclick: `tickets.openGenerador('${e.id}')`
            }
        ]
    };
};

const SAMPLE_TICKETS_TABLE = {
    row: Object.values(SAMPLE_TICKETS_DB).map(_ticketRow)
};

// -- Catalogos --

const SAMPLE_TICKETS_FORMAS = [
    { id: '',                    valor: 'Todas las formas'   },
    { id: 'Efectivo',            valor: 'Efectivo'           },
    { id: 'Tarjeta de credito',  valor: 'Tarjeta de credito' }
];

const SAMPLE_TICKETS_ESTADOS = [
    { id: '',         valor: 'Todos los estados' },
    { id: 'pending',  valor: 'Pendiente'         },
    { id: 'invoiced', valor: 'Facturado'         },
    { id: 'zero',     valor: 'IVA 0%'            }
];

const SAMPLE_TICKETS_COUNTS = (() => {
    const all = Object.values(SAMPLE_TICKETS_DB);
    return {
        total:      all.length,
        facturados: all.filter(e => e.fiscal === 'invoiced').length,
        cero:       all.filter(e => e.tasa === 0).length,
        monto:      all.reduce((s, e) => s + Number(e.total || 0), 0)
    };
})();
