// -- Vista --

const SAMPLE_VIEW_HEADER_TICKETS = {
    title:    'Tickets',
    subtitle: 'Tickets virtuales del dia, pagados con tarjeta. Los tickets en efectivo no se muestran. Las notas se reinician cada dia',
    back:     { href: '/app/facture/index.php', title: 'Regresar al Facturador' }
};

const SAMPLE_VIEW_FOOTER_TICKETS = {
    info: '',
    legends: [
        { tone: 'success', label: 'Bloqueado'               },
        { tone: 'warning', label: 'Requiere ticket virtual' },
        { tone: 'default', label: 'Pendiente de facturar'   }
    ]
};

// -- Helpers --

const _fmtMX = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const _fmtFechaCorta = (iso) => String(iso || '').split('-').reverse().join('/');

const _badgeTasa = (tasa) => tasa === 0
    ? '<span class="badge-base b-yellow">0%</span>'
    : '<span class="badge-base b-terra">16%</span>';

const _badgeEstadoTicket = (e) => {
    if (e.fiscal === 'invoiced') return `<span class="badge-base b-green"><i data-lucide="lock" class="w-3 h-3"></i>Facturado ${e.factura}</span>`;
    if (e.tasa === 0)            return '<span class="badge-base b-yellow">Requiere ticket virtual</span>';
    return '<span class="badge-base b-gray">Pendiente de facturar</span>';
};

const _accionTicket = (e) => {
    if (e.fiscal === 'invoiced') {
        return [
            {
                class:   'btn-ghost !px-2.5 !py-1 text-[11px]',
                html:    'Bloqueado',
                onclick: `tickets.lockedNotice('${e.id}')`
            }
        ];
    }
    if (e.tasa === 0) {
        return [
            {
                class:   'btn-ghost !px-2.5 !py-1 text-[11px]',
                html:    `<i data-lucide="wand-2" class="w-3.5 h-3.5"></i>${e.generado ? 'Regenerar' : 'Generar'}`,
                onclick: `app.selectTicket('${e.id}')`
            }
        ];
    }
    return [
        {
            class:   'btn-ghost !px-2.5 !py-1 text-[11px]',
            html:    '<i data-lucide="eye" class="w-3.5 h-3.5"></i>Ver',
            onclick: `app.selectTicket('${e.id}')`
        }
    ];
};

// -- Datos --

const SAMPLE_TICKETS_EMISOR = {
    razon:     'RESTAURANT',
    domicilio: 'Av. Central Norte 45, Tapachula, Chis.',
    telefono:  'Tel. (962) 555-0134',
    terminal:  'SERVER1',
    leyenda:   'Este ticket no es un comprobante fiscal'
};

const SAMPLE_TICKETS_PUENTE = [
    { code: 'PAR-001', nombre: 'Parrillada Argentina',  precio: 645.00 },
    { code: 'RIB-003', nombre: 'Rib Eye 400g',          precio: 985.00 },
    { code: 'LIM-014', nombre: 'Limonada mineral',      precio: 65.00  },
    { code: 'CER-021', nombre: 'Cerveza artesanal',     precio: 95.00  },
    { code: 'QUE-007', nombre: 'Queso fundido',         precio: 185.00 },
    { code: 'GUA-009', nombre: 'Guacamole tradicional', precio: 110.00 },
    { code: 'FLA-002', nombre: 'Flan napolitano',       precio: 95.00  }
];

const SAMPLE_TICKETS_DB = {
    '461831': {
        id:       '461831',
        orden:    1,
        fecha:    '2026-06-10',
        metodo:   'Efectivo',
        mesero:   'JORGE GORDILLO',
        mesa:     3,
        total:    1058.20,
        fiscal:   'pending',
        tasa:     0.16,
        factura:  null,
        generado: false
    },
    '461832': {
        id:       '461832',
        orden:    2,
        fecha:    '2026-06-10',
        metodo:   'Tarjeta de credito',
        mesero:   'ANGEL ANTONIO',
        mesa:     5,
        total:    1282.00,
        fiscal:   'pending',
        tasa:     0.16,
        factura:  null,
        generado: false
    },
    '461833': {
        id:       '461833',
        orden:    3,
        fecha:    '2026-06-10',
        metodo:   'Tarjeta de credito',
        mesero:   'JAZMIN DOMINGUEZ',
        mesa:     7,
        total:    2274.80,
        fiscal:   'pending',
        tasa:     0.16,
        factura:  null,
        generado: false
    },
    '461835': {
        id:       '461835',
        orden:    5,
        fecha:    '2026-06-10',
        metodo:   'Tarjeta de credito',
        mesero:   'MOISES ROBLES',
        mesa:     2,
        total:    1271.00,
        fiscal:   'pending',
        tasa:     0.16,
        factura:  null,
        generado: false
    },
    '461836': {
        id:       '461836',
        orden:    6,
        fecha:    '2026-06-10',
        metodo:   'Tarjeta de credito',
        mesero:   'OBED PEREZ',
        mesa:     11,
        total:    1633.00,
        fiscal:   'invoiced',
        tasa:     0.16,
        factura:  'A134',
        generado: false
    },
    '461838': {
        id:       '461838',
        orden:    8,
        fecha:    '2026-06-10',
        metodo:   'Tarjeta de credito',
        mesero:   'JAZMIN DOMINGUEZ',
        mesa:     4,
        total:    1345.30,
        fiscal:   'invoiced',
        tasa:     0.16,
        factura:  'A135',
        generado: false
    },
    '461839': {
        id:       '461839',
        orden:    9,
        fecha:    '2026-06-10',
        metodo:   'Tarjeta de credito',
        mesero:   'ISMAEL CORTES',
        mesa:     8,
        total:    2024.00,
        fiscal:   'pending',
        tasa:     0.16,
        factura:  null,
        generado: false
    },
    '4618310': {
        id:       '4618310',
        orden:    10,
        fecha:    '2026-06-10',
        metodo:   'Tarjeta de credito',
        mesero:   'MOISES ROBLES',
        mesa:     6,
        total:    1422.55,
        fiscal:   'pending',
        tasa:     0.16,
        factura:  null,
        generado: false
    },
    '4618311': {
        id:       '4618311',
        orden:    11,
        fecha:    '2026-06-10',
        metodo:   'Tarjeta de credito',
        mesero:   'OBED PEREZ',
        mesa:     14,
        total:    1699.70,
        fiscal:   'pending',
        tasa:     0,
        factura:  null,
        generado: false
    },
    '4618312': {
        id:       '4618312',
        orden:    12,
        fecha:    '2026-06-10',
        metodo:   'Tarjeta de credito',
        mesero:   'ANGEL ANTONIO',
        mesa:     9,
        total:    3034.90,
        fiscal:   'pending',
        tasa:     0,
        factura:  null,
        generado: true
    },
    '4618313': {
        id:       '4618313',
        orden:    13,
        fecha:    '2026-06-10',
        metodo:   'Tarjeta de credito',
        mesero:   'JAZMIN DOMINGUEZ',
        mesa:     1,
        total:    355.30,
        fiscal:   'pending',
        tasa:     0,
        factura:  null,
        generado: false
    },
    '4618314': {
        id:       '4618314',
        orden:    14,
        fecha:    '2026-06-10',
        metodo:   'Tarjeta de credito',
        mesero:   'ISMAEL CORTES',
        mesa:     12,
        total:    503.80,
        fiscal:   'pending',
        tasa:     0,
        factura:  null,
        generado: false
    },
    '4618315': {
        id:       '4618315',
        orden:    15,
        fecha:    '2026-06-10',
        metodo:   'Tarjeta de credito',
        mesero:   'MOISES ROBLES',
        mesa:     15,
        total:    1093.00,
        fiscal:   'pending',
        tasa:     0,
        factura:  null,
        generado: false
    },
    '4618316': {
        id:       '4618316',
        orden:    16,
        fecha:    '2026-06-10',
        metodo:   'Tarjeta de credito',
        mesero:   'OBED PEREZ',
        mesa:     10,
        total:    969.10,
        fiscal:   'pending',
        tasa:     0,
        factura:  null,
        generado: false
    }
};

// Arma la lista de productos puente que suman el total del ticket y calcula el
// descuento de cuadre cuando la combinacion se pasa del monto.
const _prepararTicketVirtual = (e) => {
    let restante = Number(e.total || 0);
    const lineas = [];
    const pool   = SAMPLE_TICKETS_PUENTE.slice().sort(() => Math.random() - 0.5);

    pool.forEach(prod => {
        if (restante <= 0) return;
        const maxQty = Math.floor(restante / prod.precio);
        if (maxQty <= 0) return;
        const cant    = Math.min(maxQty, 3) || 1;
        const importe = cant * prod.precio;
        lineas.push({ cant: cant, nombre: prod.nombre, importe: importe });
        restante -= importe;
    });

    const subtotal = lineas.reduce((s, l) => s + l.importe, 0);
    return {
        lineas:    lineas,
        subtotal:  subtotal,
        descuento: subtotal - Number(e.total || 0)
    };
};

// -- Filas --

const _ticketRow = (e) => ({
    id:     e.id,
    Nota:   `<span class="font-bold text-gray-300">#${e.orden}</span>`,
    ID:     `<span class="font-mono text-[10px] text-gray-400">${e.id}</span>`,
    Tasa:   _badgeTasa(e.tasa),
    Estado: _badgeEstadoTicket(e),
    Monto:  `<span class="font-semibold text-white">${_fmtMX(e.total)}</span>`,
    a:      _accionTicket(e)
});

