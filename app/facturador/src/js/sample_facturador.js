// -- Vista --

const SAMPLE_MODULOS_TOPBAR = {
    icon:      'receipt-text',
    titulo:    'Facturador SAT',
    subtitulo: 'Control de tickets · Restaurant',
    usuario: {
        iniciales: 'AP',
        nombre:    'Administrador POS',
        sucursal:  'Sucursal Tapachula'
    }
};

const SAMPLE_MODULOS_FOOTER = {
    info: 'Facturador SAT · Boceto Fase 1 · CoffeeSoft 2026',
    legends: [
        { tone: 'purple',  label: 'Las notas se reinician cada dia'  },
        { tone: 'default', label: 'Efectivo no entra al generador'   }
    ]
};

const SAMPLE_MODULOS_FOOTER_CLASSES = {
    info:   'text-[10px] text-ink-400',
    legend: 'flex items-center gap-3 text-[10px] text-ink-400',
    item:   'flex items-center gap-1'
};

const SAMPLE_MODULOS_FOOTER_TONES = {
    default: '#6B7280',
    success: '#15803D',
    warning: '#B45309',
    danger:  '#B91C1C',
    info:    '#1D4ED8',
    purple:  '#A84A33'
};

// -- Datos --

const SAMPLE_MODULOS_DB = {
    resumen: {
        id:          'resumen',
        titulo:      'Resumen',
        descripcion: 'Resumen ejecutivo del dia: venta total, meta al 70%, facturado y por facturar',
        icon:        'layout-dashboard',
        enlace:      '/app/facturador/facturador-resumen.php',
        badge:       { text: 'Dashboard', bg: '#C05A40', color: '#fff' }
    },
    cargas: {
        id:          'cargas',
        titulo:      'Cargas',
        descripcion: 'Carga mensual de los exports del POS: reporte de ventas, pagos y comandas',
        icon:        'upload-cloud',
        enlace:      '/app/facturador/facturador-cargas.php',
        badge:       { text: 'Excel', bg: '#217346', color: '#fff' }
    },
    tickets: {
        id:          'tickets',
        titulo:      'Tickets',
        descripcion: 'Explorador de tickets y pagos con su estado fiscal, tasa y factura asociada',
        icon:        'receipt',
        enlace:      '/app/facturador/facturador-tickets.php',
        badge:       { text: 'Consulta', bg: '#1D4ED8', color: '#fff' }
    },
    generador: {
        id:          'generador',
        titulo:      'Generador',
        descripcion: 'Generador de tickets virtuales con productos puente para los pagos con tarjeta',
        icon:        'printer',
        enlace:      '/app/facturador/facturador-generador.php',
        badge:       { text: 'Operacion', bg: '#B45309', color: '#fff' }
    },
    catalogos: {
        id:          'catalogos',
        titulo:      'Catalogos',
        descripcion: 'Productos puente, meseros y datos del emisor que aparecen en el ticket virtual',
        icon:        'library',
        enlace:      '/app/facturador/facturador-catalogos.php',
        badge:       { text: 'Configuracion', bg: '#6B7280', color: '#fff' }
    }
};

const _moduloCard = (m) => ({
    titulo:      m.titulo,
    descripcion: m.descripcion,
    icon:        m.icon,
    enlace:      m.enlace,
    badge:       m.badge,
    bg:          'bg-white hover:bg-brand-50 border border-ink-200'
});

const SAMPLE_MODULOS_CARDS = Object.values(SAMPLE_MODULOS_DB).map(_moduloCard);

// -- Catalogos --

const SAMPLE_MODULOS_PERIODOS = [
    { id: '2026-06', valor: 'Junio 2026' },
    { id: '2026-05', valor: 'Mayo 2026'  },
    { id: '2026-04', valor: 'Abril 2026' }
];

const SAMPLE_MODULOS_COUNTS = (() => {
    const all = Object.values(SAMPLE_MODULOS_DB);
    return {
        total: all.length
    };
})();
