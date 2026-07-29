// -- Datos --

// El dia que el hub arrastra a los modulos por querystring.
const FACTURE_DIA = '2026-06-10';

// Tarjetas en el formato de ModuleCard (app/src/js/components): titulo,
// descripcion, icon de Lucide y enlace. El icono va dentro del cuadro azul.
const SAMPLE_MODULOS_DB = {
    resumen: {
        id:          'resumen',
        titulo:      'Resumen',
        descripcion: 'Resumen ejecutivo del dia: venta total, meta al 70%, facturado y por facturar',
        icon:        'layout-dashboard',
        enlace:      '/app/facture/resumen.php'
    },
    cargas: {
        id:          'cargas',
        titulo:      'Cargas',
        descripcion: 'Carga mensual de los exports del POS: reporte de ventas, pagos y comandas',
        icon:        'upload-cloud',
        enlace:      '/app/facture/cargas.php'
    },
    tickets: {
        id:          'tickets',
        titulo:      'Tickets',
        descripcion: 'Explorador de tickets y pagos con su estado fiscal, tasa y factura asociada',
        icon:        'receipt',
        enlace:      '/app/facture/tickets.php'
    },
    generador: {
        id:          'generador',
        titulo:      'Generador',
        descripcion: 'Generador de tickets virtuales con productos puente para los pagos con tarjeta',
        icon:        'printer',
        enlace:      '/app/facture/generador.php'
    },
    catalogos: {
        id:          'catalogos',
        titulo:      'Catalogos',
        descripcion: 'Productos puente, meseros y datos del emisor que aparecen en el ticket virtual',
        icon:        'library',
        enlace:      '/app/facture/catalogos.php'
    }
};

const _moduloCard = (m) => ({
    titulo:      m.titulo,
    descripcion: m.descripcion,
    icon:        m.icon,
    enlace:      `${m.enlace}?dia=${encodeURIComponent(FACTURE_DIA)}`
});

const SAMPLE_MODULOS_CARDS = Object.values(SAMPLE_MODULOS_DB).map(_moduloCard);
