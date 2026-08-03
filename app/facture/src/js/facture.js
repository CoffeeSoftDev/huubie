let apiFacture = '/app/facture/ctrl/ctrl-facture.php';
let facture;

// Las etapas del proceso fiscal, en el orden en que se recorren. Es la navegacion
// del hub, no datos: cada modulo abre en el ultimo periodo que tiene cargado, que
// resuelve su propio init().
const FACTURE_MODULOS = [
    {
        titulo:      'Importación',
        descripcion: 'Importación mensual de los exports del POS: reporte de ventas, pagos y comandas',
        icon:        'upload-cloud',
        enlace:      '/app/facture/cargas.php'
    },
    {
        titulo:      'Ventas',
        descripcion: 'Explorador de ventas y pagos con su estado fiscal, tasa y factura asociada',
        icon:        'receipt',
        enlace:      '/app/facture/ventas.php'
    },
    {
        titulo:      'Tickets',
        descripcion: 'Tickets virtuales con productos auxiliares para lo cobrado por banco',
        icon:        'printer',
        enlace:      '/app/facture/tickets.php'
    },
    {
        titulo:      'Catalogos',
        descripcion: 'Productos auxiliares y datos del emisor que aparecen en el ticket virtual',
        icon:        'library',
        enlace:      '/app/facture/catalogos.php'
    }
];

$(() => {
    facture = new Facture(apiFacture, 'mainContainer');
    facture.init();
});

// --- Facture ---
class Facture extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Facture';
    }

    init() {
        this.render();
    }

    render() {
        // Mismo componente y mismos defaults que el menu de app/menus (ventas.js):
        // grid lg:grid-cols-5, tarjeta h-[180px] #1F2A37.
        new ModuleCard('#mainContainer', {
            header: {
                title:    `¡${this.greeting()}, ${FACTURE_USER.name}! 👋`,
                subtitle: 'Cada etapa del proceso fiscal es un modulo independiente. Elige por donde empezar.',
            },
            cards:  FACTURE_MODULOS,
        }).init();
    }

    // El nombre sale de FACTURE_USER (navbar-huubie.js) mientras el modulo no
    // tenga su propia base de datos.
    greeting() {
        const hour = new Date().getHours();
        return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    }
}
