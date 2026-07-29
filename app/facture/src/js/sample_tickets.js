// -- Vista --

const SAMPLE_VIEW_HEADER_TICKETS = {
    title:    'Tickets y pagos',
    subtitle: 'Explora tickets, pagos y su estado fiscal. Filtra por periodo, forma de pago o estado',
    back:     { href: '/app/facture/index.php', title: 'Regresar al Facturador' }
};

const SAMPLE_VIEW_FOOTER_TICKETS = {
    info: '',
    legends: [
        { tone: 'success', label: 'Facturado' },
        { tone: 'warning', label: 'IVA 0%'    },
        { tone: 'default', label: 'Pendiente' },
        { tone: 'purple',  label: 'Tarjeta'   }
    ]
};
