// -- Vista --

const SAMPLE_VIEW_HEADER_RESUMEN = {
    title:    'Resumen del dia',
    subtitle: 'Meta de facturacion: 70% de la venta del dia facturada al 16% de IVA',
    back:     { href: '/app/facture/index.php', title: 'Regresar al Facturador' }
};

const SAMPLE_VIEW_FOOTER_RESUMEN = {
    info: '',
    legends: [
        { tone: 'success', label: 'Facturado'    },
        { tone: 'warning', label: 'Por facturar' },
        { tone: 'purple',  label: 'Efectivo'     },
        { tone: 'info',    label: 'Tarjeta'      }
    ]
};

// -- Helpers --

const _fmtMX = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const _badgeMetodo = (metodo) => {
    const cls = metodo === 'Efectivo' ? 'b-green' : 'b-terra';
    return `<span class="badge-base ${cls}">${metodo}</span>`;
};

const _badgeFolio = (folio) => `<span class="badge-base b-terra">${folio}</span>`;

const _cellId = (id) => `<span class="font-mono text-[10px] text-gray-400">${id}</span>`;

const _cellMonto = (n) => `<span class="font-semibold text-white">${_fmtMX(n)}</span>`;

const _checkPendiente = (e, checked) => `<input type="checkbox" class="chk-pending w-4 h-4 rounded border-[#374151] accent-[#1C64F2]" data-id="${e.id}" data-amount="${e.total}" onchange="app.onTogglePendiente(this)" ${checked ? 'checked' : ''}>`;

const _MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const _fmtFechaLarga = (iso) => {
    const parts = String(iso || '').split('-');
    if (parts.length !== 3) return iso || '';
    return `${parseInt(parts[2], 10)} de ${_MESES_ES[parseInt(parts[1], 10) - 1]} de ${parts[0]}`;
};

// -- Datos --

const SAMPLE_RESUMEN_DB = {
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

const SAMPLE_RESUMEN_PRESELECCION = ['461832', '461833', '461835', '461839', '4618310'];

// -- Filas --

const _resumenRowTodos = (e) => ({
    id:              e.id,
    ID:              _cellId(e.id),
    Orden:           `<span class="text-gray-400">${e.orden}</span>`,
    'Forma de pago': _badgeMetodo(e.metodo),
    Monto:           _cellMonto(e.total)
});

const _resumenRowPendiente = (e, checked) => ({
    id:    e.id,
    Sel:   _checkPendiente(e, checked),
    ID:    _cellId(e.id),
    Orden: `<span class="text-gray-400">${e.orden}</span>`,
    Monto: _cellMonto(e.total)
});

const _resumenRowFacturado = (e) => ({
    id:    e.id,
    ID:    _cellId(e.id),
    Orden: `<span class="text-gray-400">${e.orden}</span>`,
    Folio: _badgeFolio(e.factura),
    Monto: _cellMonto(e.total)
});

// -- Catalogos --

const SAMPLE_RESUMEN_METAS = [
    { id: '0.60', valor: '60% de la venta'  },
    { id: '0.70', valor: '70% de la venta'  },
    { id: '0.80', valor: '80% de la venta'  },
    { id: '1.00', valor: '100% de la venta' }
];

const SAMPLE_RESUMEN_PERIODOS = [
    { id: '2026-06', valor: 'Junio 2026' },
    { id: '2026-05', valor: 'Mayo 2026'  },
    { id: '2026-04', valor: 'Abril 2026' }
];
