// ──────────────────────────────────────────────────────────────────────
//  SAMPLE — Visor de Mermas (POS FAKE)
//  Datos estaticos que alimentan el modulo pos-mermas.js
// ──────────────────────────────────────────────────────────────────────

const SAMPLE_VIEW_HEADER_MERMAS = {
    title:    'Visor de Mermas',
    subtitle: 'Control de perdidas por sucursal, motivo y periodo',
    back:     { href: '/app/inventarios/index.php', title: 'Regresar al inicio' }
};

const SAMPLE_VIEW_FOOTER_MERMAS = {
    info: 'Mostrando 6 de 6 mermas',
    legends: [
        { tone: 'danger',  label: 'Caducidad'        },
        { tone: 'warning', label: 'Daniado'          },
        { tone: 'info',    label: 'Error produccion' },
        { tone: 'purple',  label: 'Robo / Faltante'  },
        { tone: 'success', label: 'Devolucion'       }
    ]
};

// Helpers reutilizables para badges de motivo
const _badgeMotivo = (motivo) => {
    const map = {
        'Caducidad':       { bg: 'rgba(224,36,36,0.18)',  fg: '#E02424' },
        'Daniado':         { bg: 'rgba(251,191,36,0.18)', fg: '#FBBF24' },
        'Daniado/Roto':    { bg: 'rgba(251,191,36,0.18)', fg: '#FBBF24' },
        'Error produccion':{ bg: 'rgba(28,100,242,0.18)', fg: '#1C64F2' },
        'Robo/Faltante':   { bg: 'rgba(124,58,237,0.18)', fg: '#7C3AED' },
        'Devolucion':      { bg: 'rgba(63,193,137,0.18)', fg: '#3FC189' }
    };
    const c = map[motivo] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold" style="background:${c.bg};color:${c.fg};">${motivo.toUpperCase()}</span>`;
};

const SAMPLE_MERMAS_TABLE = {
    row: [
        {
            id: 4521,
            Folio:    'M-4521',
            Motivo:   _badgeMotivo('Caducidad'),
            Productos:'<span class="text-white font-bold">3</span>',
            'Total Uds': '<span class="text-orange-400 font-bold">18</span>',
            'Costo Perdida': '<span class="text-red-400 font-bold">-$1,240.00</span>',
            Registrado:'Andrea Martinez',
            Fecha:    '16/05/2026 09:14',
            a: [
                { class:'btn btn-sm btn-secondary me-1', html:'<i class="icon-eye"></i>',        onclick:'app.renderDetail(SAMPLE_MERMA_DETAIL)' },
                { class:'btn btn-sm btn-primary me-1',   html:'<i class="icon-print"></i>',       onclick:'app.printMerma(4521)' },
                { class:'btn btn-sm btn-danger',         html:'<i class="icon-trash-empty"></i>', onclick:'app.reverseMerma(4521)' }
            ]
        },
        {
            id: 4520,
            Folio:    'M-4520',
            Motivo:   _badgeMotivo('Daniado'),
            Productos:'<span class="text-white font-bold">2</span>',
            'Total Uds': '<span class="text-orange-400 font-bold">7</span>',
            'Costo Perdida': '<span class="text-red-400 font-bold">-$485.50</span>',
            Registrado:'Carlos Ramirez',
            Fecha:    '16/05/2026 08:42',
            a: [
                { class:'btn btn-sm btn-secondary me-1', html:'<i class="icon-eye"></i>',        onclick:'app.renderDetail(SAMPLE_MERMA_DETAIL)' },
                { class:'btn btn-sm btn-primary me-1',   html:'<i class="icon-print"></i>',       onclick:'app.printMerma(4520)' },
                { class:'btn btn-sm btn-danger',         html:'<i class="icon-trash-empty"></i>', onclick:'app.reverseMerma(4520)' }
            ]
        },
        {
            id: 4519,
            Folio:    'M-4519',
            Motivo:   _badgeMotivo('Error produccion'),
            Productos:'<span class="text-white font-bold">1</span>',
            'Total Uds': '<span class="text-orange-400 font-bold">12</span>',
            'Costo Perdida': '<span class="text-red-400 font-bold">-$720.00</span>',
            Registrado:'Maria Gonzalez',
            Fecha:    '15/05/2026 19:08',
            a: [
                { class:'btn btn-sm btn-secondary me-1', html:'<i class="icon-eye"></i>',        onclick:'app.renderDetail(SAMPLE_MERMA_DETAIL)' },
                { class:'btn btn-sm btn-primary me-1',   html:'<i class="icon-print"></i>',       onclick:'app.printMerma(4519)' },
                { class:'btn btn-sm btn-danger',         html:'<i class="icon-trash-empty"></i>', onclick:'app.reverseMerma(4519)' }
            ]
        },
        {
            id: 4518,
            Folio:    'M-4518',
            Motivo:   _badgeMotivo('Robo/Faltante'),
            Productos:'<span class="text-white font-bold">4</span>',
            'Total Uds': '<span class="text-orange-400 font-bold">9</span>',
            'Costo Perdida': '<span class="text-red-400 font-bold">-$2,150.00</span>',
            Registrado:'Luis Hernandez',
            Fecha:    '15/05/2026 14:30',
            a: [
                { class:'btn btn-sm btn-secondary me-1', html:'<i class="icon-eye"></i>',        onclick:'app.renderDetail(SAMPLE_MERMA_DETAIL)' },
                { class:'btn btn-sm btn-primary me-1',   html:'<i class="icon-print"></i>',       onclick:'app.printMerma(4518)' },
                { class:'btn btn-sm btn-danger',         html:'<i class="icon-trash-empty"></i>', onclick:'app.reverseMerma(4518)' }
            ]
        },
        {
            id: 4517,
            Folio:    'M-4517',
            Motivo:   _badgeMotivo('Devolucion'),
            Productos:'<span class="text-white font-bold">1</span>',
            'Total Uds': '<span class="text-orange-400 font-bold">2</span>',
            'Costo Perdida': '<span class="text-red-400 font-bold">-$180.00</span>',
            Registrado:'Andrea Martinez',
            Fecha:    '15/05/2026 11:55',
            a: [
                { class:'btn btn-sm btn-secondary me-1', html:'<i class="icon-eye"></i>',        onclick:'app.renderDetail(SAMPLE_MERMA_DETAIL)' },
                { class:'btn btn-sm btn-primary me-1',   html:'<i class="icon-print"></i>',       onclick:'app.printMerma(4517)' },
                { class:'btn btn-sm btn-danger',         html:'<i class="icon-trash-empty"></i>', onclick:'app.reverseMerma(4517)' }
            ]
        },
        {
            id: 4516,
            Folio:    'M-4516',
            Motivo:   _badgeMotivo('Caducidad'),
            Productos:'<span class="text-white font-bold">2</span>',
            'Total Uds': '<span class="text-orange-400 font-bold">15</span>',
            'Costo Perdida': '<span class="text-red-400 font-bold">-$890.00</span>',
            Registrado:'Carlos Ramirez',
            Fecha:    '14/05/2026 20:12',
            a: [
                { class:'btn btn-sm btn-secondary me-1', html:'<i class="icon-eye"></i>',        onclick:'app.renderDetail(SAMPLE_MERMA_DETAIL)' },
                { class:'btn btn-sm btn-primary me-1',   html:'<i class="icon-print"></i>',       onclick:'app.printMerma(4516)' },
                { class:'btn btn-sm btn-danger',         html:'<i class="icon-trash-empty"></i>', onclick:'app.reverseMerma(4516)' }
            ]
        }
    ]
};

const SAMPLE_MERMAS_COUNTS = {
    total_mermas:    6,
    total_costo:     5665.50,
    total_unidades:  63,
    motivo_top:      'Caducidad'
};

const SAMPLE_PRODUCT_CATALOG = [
    { id: 1,  name: 'Leche entera 1L',          sku: 'LE-001', costo_unit:  32.50, stock: 24 },
    { id: 2,  name: 'Leche deslactosada 1L',    sku: 'LE-002', costo_unit:  36.00, stock: 18 },
    { id: 3,  name: 'Yogurt natural 250g',      sku: 'YN-022', costo_unit:  28.00, stock: 36 },
    { id: 4,  name: 'Yogurt griego 200g',       sku: 'YG-015', costo_unit:  42.00, stock: 22 },
    { id: 5,  name: 'Crema acida 200ml',        sku: 'CR-011', costo_unit:  24.00, stock: 30 },
    { id: 6,  name: 'Queso panela 500g',        sku: 'QP-040', costo_unit:  78.00, stock: 14 },
    { id: 7,  name: 'Queso oaxaca 400g',        sku: 'QO-041', costo_unit:  92.00, stock: 12 },
    { id: 8,  name: 'Pastel 3 Leches',          sku: 'PT-3L1', costo_unit: 203.00, stock:  8 },
    { id: 9,  name: 'Pastel de chocolate',      sku: 'PT-CH2', costo_unit: 215.00, stock:  6 },
    { id: 10, name: 'Galletas avena pq',        sku: 'GA-101', costo_unit:  18.00, stock: 48 },
    { id: 11, name: 'Pan integral 500g',        sku: 'PI-050', costo_unit:  45.00, stock: 20 },
    { id: 12, name: 'Mantequilla 200g',         sku: 'MT-008', costo_unit:  54.00, stock: 16 },
    { id: 13, name: 'Cafe molido 250g',         sku: 'CF-250', costo_unit: 125.00, stock: 25 },
    { id: 14, name: 'Te verde caja 25 sobres',  sku: 'TV-025', costo_unit:  68.00, stock: 32 },
    { id: 15, name: 'Mermelada fresa 300g',     sku: 'MF-300', costo_unit:  62.00, stock: 19 }
];

const SAMPLE_MERMA_DETAIL = {
    id: 4521,
    folio: 'M-4521',
    motivo: 'Caducidad',
    fecha: '2026-05-16T09:14:00',
    sucursal: 'kafeto',
    registrado_por: {
        name:  'Andrea Martinez',
        rol:   'Cajero',
        email: 'andrea.m@example.com'
    },
    nota: 'Productos lacteos vencidos detectados en revision matutina del refrigerador #2.',
    foto: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=200&fit=crop',
    items: [
        { name: 'Leche entera 1L',     sku: 'LE-001', qty: 8,  costo_unit: 32.50, costo_total: 260.00 },
        { name: 'Yogurt natural 250g', sku: 'YN-022', qty: 6,  costo_unit: 28.00, costo_total: 168.00 },
        { name: 'Pastel 3 Leches',     sku: 'PT-3L1', qty: 4,  costo_unit: 203.00, costo_total: 812.00 }
    ],
    total_unidades: 18,
    total_costo:    1240.00
};
