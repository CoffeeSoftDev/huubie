// -- Vista --

const SAMPLE_VIEW_HEADER_CATALOGOS = {
    title:    'Catalogos',
    subtitle: 'Administra productos puente, meseros y los datos del emisor del ticket virtual',
    back:     { href: '/app/facturador/facturador.php', title: 'Regresar al Facturador' }
};

const SAMPLE_VIEW_FOOTER_CATALOGOS = {
    info: '',
    legends: [
        { tone: 'success', label: 'Producto puente' },
        { tone: 'warning', label: 'Modificador'     },
        { tone: 'default', label: 'Sin marcar'      }
    ]
};

const SAMPLE_CATALOGOS_HEADER_CLASSES = {
    title:    'text-base font-bold text-ink-900',
    subtitle: 'text-[11px] text-ink-500',
    groupLbl: 'text-[9px] text-ink-400 uppercase tracking-wider font-bold',
    btn:      'px-2.5 py-1 rounded text-[11px] border border-ink-200 text-ink-600 hover:bg-ink-50 transition-colors',
    btnActive:'px-2.5 py-1 rounded text-[11px] border border-brand-500 bg-brand-50 text-brand-600 font-bold',
    sep:      'text-ink-300',
    backBtn:  'w-8 h-8 rounded-full bg-white hover:bg-brand-50 border border-ink-200 hover:border-brand-500 flex items-center justify-center text-ink-500 hover:text-brand-600 transition-colors flex-shrink-0'
};

const SAMPLE_CATALOGOS_FOOTER_CLASSES = {
    info:   'text-[10px] text-ink-400',
    legend: 'flex items-center gap-3 text-[10px] text-ink-400',
    item:   'flex items-center gap-1'
};

const SAMPLE_CATALOGOS_FOOTER_TONES = {
    default: '#6B7280',
    success: '#15803D',
    warning: '#B45309',
    danger:  '#B91C1C',
    info:    '#1D4ED8',
    purple:  '#A84A33'
};

// -- Helpers --

const _fmtMX = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const _badgeSiNo = (valor, toneOn) => valor
    ? `<span class="badge-base ${toneOn}">Si</span>`
    : '<span class="badge-base b-gray">No</span>';

const _cellCodigo = (code) => `<span class="font-mono text-[10px] text-ink-500">${code}</span>`;

// -- Datos --

const SAMPLE_CATALOGOS_PRODUCTOS_DB = {
    'PAR-001': {
        code:        'PAR-001',
        nombre:      'Parrillada Argentina',
        precio:      645.00,
        puente:      1,
        modificador: 0
    },
    'RIB-003': {
        code:        'RIB-003',
        nombre:      'Rib Eye 400g',
        precio:      985.00,
        puente:      1,
        modificador: 0
    },
    'LIM-014': {
        code:        'LIM-014',
        nombre:      'Limonada mineral',
        precio:      65.00,
        puente:      1,
        modificador: 0
    },
    'CER-021': {
        code:        'CER-021',
        nombre:      'Cerveza artesanal',
        precio:      95.00,
        puente:      1,
        modificador: 0
    },
    'QUE-007': {
        code:        'QUE-007',
        nombre:      'Queso fundido',
        precio:      185.00,
        puente:      1,
        modificador: 0
    },
    'GUA-009': {
        code:        'GUA-009',
        nombre:      'Guacamole tradicional',
        precio:      110.00,
        puente:      1,
        modificador: 0
    },
    'FLA-002': {
        code:        'FLA-002',
        nombre:      'Flan napolitano',
        precio:      95.00,
        puente:      1,
        modificador: 0
    }
};

const SAMPLE_CATALOGOS_MESEROS_DB = {
    '03': {
        code:   '03',
        nombre: 'ANGEL ANTONIO'
    },
    '124': {
        code:   '124',
        nombre: 'JAZMIN DOMINGUEZ'
    },
    '46': {
        code:   '46',
        nombre: 'MOISES ROBLES'
    },
    '07': {
        code:   '07',
        nombre: 'OBED PEREZ'
    },
    '12': {
        code:   '12',
        nombre: 'ISMAEL CORTES'
    },
    '09': {
        code:   '09',
        nombre: 'JORGE GORDILLO'
    }
};

const SAMPLE_CATALOGOS_EMISOR = {
    razon:     'CAFE DE CHIAPAS SUC. POLIFORUM',
    rfc:       'CCD010101ABC',
    telefono:  '(962) 555-0134',
    lugar:     'Tapachula, Chiapas',
    domicilio: 'CALLE BRASIL, NUM 572, COL. EL RETIRO, TAPACHULA, CHIAPAS'
};

// -- Filas --

const _productoRow = (e) => ({
    id:           e.code,
    Codigo:       _cellCodigo(e.code),
    Nombre:       `<span class="font-semibold text-ink-800">${e.nombre}</span>`,
    Precio:       `<span class="text-ink-600">${_fmtMX(e.precio)}</span>`,
    Puente:       _badgeSiNo(e.puente, 'b-green'),
    Modificador:  _badgeSiNo(e.modificador, 'b-yellow'),
    a: [
        {
            class:   'btn-ghost !py-1 !px-2 text-[11px]',
            html:    '<i data-lucide="pencil" class="w-3.5 h-3.5"></i>Editar',
            onclick: `catalogosView.editProducto('${e.code}')`
        },
        {
            class:   'btn-ghost !py-1 !px-2 text-[11px]',
            html:    '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Baja',
            onclick: `catalogos.deleteProducto('${e.code}')`
        }
    ]
});

const _meseroRow = (e) => ({
    id:     e.code,
    Codigo: _cellCodigo(e.code),
    Nombre: `<span class="font-semibold text-ink-800">${e.nombre}</span>`,
    a: [
        {
            class:   'btn-ghost !py-1 !px-2 text-[11px]',
            html:    '<i data-lucide="pencil" class="w-3.5 h-3.5"></i>Editar',
            onclick: `catalogosView.editMesero('${e.code}')`
        },
        {
            class:   'btn-ghost !py-1 !px-2 text-[11px]',
            html:    '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Baja',
            onclick: `catalogos.deleteMesero('${e.code}')`
        }
    ]
});

const SAMPLE_CATALOGOS_PRODUCTOS_TABLE = {
    row: Object.values(SAMPLE_CATALOGOS_PRODUCTOS_DB).map(_productoRow)
};

const SAMPLE_CATALOGOS_MESEROS_TABLE = {
    row: Object.values(SAMPLE_CATALOGOS_MESEROS_DB).map(_meseroRow)
};

// -- Catalogos --

const SAMPLE_CATALOGOS_SINO = [
    { id: '1', valor: 'Si' },
    { id: '0', valor: 'No' }
];

const SAMPLE_CATALOGOS_TIPOS = [
    { id: '',            valor: 'Todos los catalogos' },
    { id: 'productos',   valor: 'Productos puente'    },
    { id: 'meseros',     valor: 'Meseros'             }
];

const SAMPLE_CATALOGOS_COUNTS = (() => {
    const productos = Object.values(SAMPLE_CATALOGOS_PRODUCTOS_DB);
    const meseros   = Object.values(SAMPLE_CATALOGOS_MESEROS_DB);
    return {
        productos: productos.length,
        puente:    productos.filter(p => p.puente).length,
        meseros:   meseros.length,
        precio:    productos.reduce((s, p) => s + Number(p.precio || 0), 0)
    };
})();
