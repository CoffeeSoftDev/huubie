let apiFacture = '/app/facture/ctrl/ctrl-facture.php';
let facture;

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
            cards:  SAMPLE_MODULOS_CARDS,
        }).init();
    }

    // El nombre sale de FACTURE_USER (navbar-huubie.js) mientras el modulo no
    // tenga su propia base de datos.
    greeting() {
        const hour = new Date().getHours();
        return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    }
}
