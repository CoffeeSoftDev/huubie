let apiPos = '/app/facture2/ctrl/ctrl-facture2-pos.php';
let app, admin;

$(() => {
    admin = new Admin(apiPos, 'root');
    app   = new App(apiPos, 'root');

    app.init();
});

// -- Clase principal --

class App extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'pos';
    }

    // -- Interface --

    init() {
        this.render();
    }

    render() {
        this.layout();

        admin.renderMenu();
    }

    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:    this.PROJECT_NAME,
                class: 'flex-1 min-h-0 w-full flex flex-col overflow-hidden ws-app',
                container: [
                    {
                        type:  'div',
                        id:    'contentRow',
                        class: 'flex-1 min-h-0 overflow-auto flex justify-center pt-12 px-6'
                    }
                ]
            }
        });
    }
}

// -- Admin --

class Admin extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'admin';
    }

    // -- Interface --

    renderMenu() {
        this.menuLayout();

        moduleCard({
            parent: 'menuRow',
            id:     'cardAdmin',
            cols:   4,
            json:   this.cardsJson(),
            footer: this.footerJson()
        });
    }

    menuLayout() {
        this.createLayout({
            parent: 'contentRow',
            design: false,
            data: {
                id:    'adminWrap',
                class: 'w-full max-w-3xl',
                container: [
                    {
                        type:  'div',
                        id:    'menuRow',
                        class: 'w-full'
                    }
                ]
            }
        });
    }


    cardsJson() {
        return [
            {
                id: 'tlCatalogos',
                text: 'Catálogos',
                fn: () => posGo('/app/facture2/catalogos.php')
            },
            {
                id:   'tlEmisor',
                text: 'Ticket / Emisor',
                fn:   () => posGo('/app/facture2/emisor.php')
            },
            // {
            //     id:   'tlCuentas',
            //     text: 'Cuentas',
            //     fn:   () => posGo('cuentas')
            // },
          
            {
                id:   'tlCargas',
                text: 'Importación',
                fn:   () => posGo('/app/facture2/cargas.php')
            },
            {
                id:   'tlHistorial',
                text: 'Historial',
                fn:   () => posGo('/app/facture2/historial.php')
            },
            // {
            //     id:   'tlTicket',
            //     text: 'Reimprimir ticket',
            //     fn:   () => posGo('/app/facture2/tickets.php')
            // },
            {
                id:     'tlUsuario',
                text:   'Crear usuario',
                locked: true
            },
            {
                id:     'tlHuella',
                text:   'Huella digital',
                locked: true
            },
            {
                id:     'tlCajon',
                text:   'Abrir Cajón',
                locked: true
            }
        ];
    }

    footerJson() {
        return [
            {
                id:   'tlRegresar',
                text: 'Regresar',
                fn:   () => posGo('inicio')
            },
            {
                id:   'tlSalir',
                text: 'Salir del sistema',
                fn:   () => posExit()
            }
        ];
    }
}
