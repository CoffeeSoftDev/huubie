// -- Vista --

const SAMPLE_MODULOS_FOOTER = {
    info: 'Facturador SAT · Fase 1 · CoffeeSoft 2026',
    legends: [
        { tone: 'purple',  label: 'Las notas se reinician cada dia' },
        { tone: 'default', label: 'Efectivo no entra al generador'  }
    ]
};

// -- Datos --

const SAMPLE_MODULOS_DB = {
    resumen: {
        id:          'resumen',
        titulo:      'Resumen',
        descripcion: 'Resumen ejecutivo del dia: venta total, meta al 70%, facturado y por facturar',
        icon:        'layout-dashboard',
        enlace:      '/app/facture/resumen.php',
        badge:       { text: 'Dashboard', bg: '#C05A40', color: '#fff' }
    },
    cargas: {
        id:          'cargas',
        titulo:      'Cargas',
        descripcion: 'Carga mensual de los exports del POS: reporte de ventas, pagos y comandas',
        icon:        'upload-cloud',
        enlace:      '/app/facture/cargas.php',
        badge:       { text: 'Excel', bg: '#217346', color: '#fff' }
    },
    tickets: {
        id:          'tickets',
        titulo:      'Tickets',
        descripcion: 'Explorador de tickets y pagos con su estado fiscal, tasa y factura asociada',
        icon:        'receipt',
        enlace:      '/app/facture/tickets.php',
        badge:       { text: 'Consulta', bg: '#1D4ED8', color: '#fff' }
    },
    generador: {
        id:          'generador',
        titulo:      'Generador',
        descripcion: 'Generador de tickets virtuales con productos puente para los pagos con tarjeta',
        icon:        'printer',
        enlace:      '/app/facture/generador.php',
        badge:       { text: 'Operacion', bg: '#B45309', color: '#fff' }
    },
    catalogos: {
        id:          'catalogos',
        titulo:      'Catalogos',
        descripcion: 'Productos puente, meseros y datos del emisor que aparecen en el ticket virtual',
        icon:        'library',
        enlace:      '/app/facture/catalogos.php',
        badge:       { text: 'Configuracion', bg: '#6B7280', color: '#fff' }
    }
};

const _moduloCard = (m) => ({
    titulo:      m.titulo,
    descripcion: m.descripcion,
    icon:        m.icon,
    enlace:      m.enlace,
    badge:       m.badge
});

const SAMPLE_MODULOS_CARDS = Object.values(SAMPLE_MODULOS_DB).map(_moduloCard);

// -- Catalogos --

const SAMPLE_MODULOS_PERIODOS = [
    { id: '2026-06', valor: 'Junio 2026' },
    { id: '2026-05', valor: 'Mayo 2026'  },
    { id: '2026-04', valor: 'Abril 2026' }
];
