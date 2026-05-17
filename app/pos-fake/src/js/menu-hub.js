let api = '/app/pos-fake/ctrl/ctrl-pos.php';
let menuHub;

$(async () => {
    menuHub = new MenuHub(api, 'mainContainer');
    menuHub.init();
});

// --- Menu Hub: Inventario POS ---
class MenuHub extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'MenuHub';
    }

    init() {
        this.render();
    }

    render() {
        const cards = this.buildCards();
        const hour  = new Date().getHours();
        const greet = hour < 12 ? 'Buen dia' : hour < 19 ? 'Buena tarde' : 'Buena noche';

        new ModuleCard('#mainContainer', {
            header: {
                title:    `Inventario POS - ${greet}`,
                subtitle: 'Gestiona stock, entradas, movimientos, mermas y traspasos del punto de venta.',
                search: {
                    show:        true,
                    placeholder: 'Buscar submodulo de inventario...',
                    shortcut:    'Ctrl+K',
                    width:       'w-full md:w-[380px]',
                },
            },
            grid: {
                cols:   'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
                gap:    'gap-x-3 gap-y-6',
                height: 'h-[180px]',
            },
            cards: cards,
        }).init();
    }

    buildCards() {
        return [
            {
                titulo:      'Stock',
                descripcion: 'Consulta existencias actuales por sucursal y categoria.',
                icon:        'boxes',
                enlace:      '/app/pos-fake/pos-stock.php',
            },
            {
                titulo:      'Entradas',
                descripcion: 'Registra y revisa entradas de mercancia al inventario.',
                icon:        'package-plus',
                enlace:      '/app/pos-fake/pos-entradas.php',
            },
            {
                titulo:      'Movimientos',
                descripcion: 'Historial de movimientos internos y ajustes de stock.',
                icon:        'arrow-left-right',
                enlace:      '/app/pos-fake/pos-movimientos.php',
            },
            {
                titulo:      'Mermas',
                descripcion: 'Captura y monitorea perdidas, caducidades y daños.',
                icon:        'trash-2',
                enlace:      '/app/pos-fake/pos-mermas.php',
            },
            {
                titulo:      'Traspasos',
                descripcion: 'Envia y recibe mercancia entre sucursales.',
                icon:        'truck',
                enlace:      '/app/pos-fake/pos-traspasos.php',
            },
        ];
    }
}
