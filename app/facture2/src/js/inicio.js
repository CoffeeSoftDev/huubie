let apiPos = '/app/facture2/ctrl/ctrl-facture2-pos.php';
let app, inicio;

$(() => {
    inicio = new Inicio(apiPos, 'root');
    app    = new App(apiPos, 'root');

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

        inicio.renderInicio();
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

// -- Inicio --

class Inicio extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'inicio';
    }

    // -- Interface --

    renderInicio() {
        this.inicioLayout();

        moduleCard({
            parent:    'menuRow',
            id:        'cardInicio',
            cols:      4,
            cardClass:   'ws-btn ws-btn-card',
            footerClass: 'ws-btn ws-btn-tile',
            json:        this.cardsJson(),
            footer:      this.footerJson()
        });
    }

    inicioLayout() {
        this.createLayout({
            parent: 'contentRow',
            design: false,
            data: {
                id:    'inicioWrap',
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
                id:   'tcGenerar',
                icon: 'ticket',
                text: 'Tickets',
                fn:   () => posGo('/app/facture2/tickets.php')
            },
            {
                id:   'tcReimprimir',
                icon: 'printer',
                text: 'Reimpresión de Tickets',
                fn:   () => posGo('/app/facture2/tickets.php')
            },
            {
                id:     'tcConfiguracion',
                icon:   'settings',
                text:   'Configuración',
                locked: true
            },
            {
                id:     'tcReportes',
                icon:   'chart-column',
                text:   'Reportes',
                locked: true
            },
            {
                id:     'tcConsultas',
                icon:   'search',
                text:   'Consultas',
                locked: true
            },
            {
                id:     'tcUsuarios',
                icon:   'users',
                text:   'Usuarios',
                locked: true
            },
            {
                id:     'tcUtilidades',
                icon:   'wrench',
                text:   'Utilidades',
                locked: true
            }
        ];
    }

    footerJson() {
        return [
            {
                id:   'tcBloquear',
                text: 'Bloquear',
                fn:   () => posGo('acceso')
            },
            {
                id:   'tcSalir',
                text: 'Salir del sistema',
                fn:   () => posExit()
            }
        ];
    }
}
