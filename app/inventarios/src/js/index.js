let api = '/app/inventarios/ctrl/ctrl-pos.php';
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
                title:    `Sistema de Inventarios - ${greet}`,
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
                titulo: 'Administrador',
                descripcion: 'Catalogo de productos, categorias, almacenes, areas, unidades y proveedores.',
                icon: 'settings-2',
                enlace: '/app/inventarios/admin-productos.php',
            },
            {
                titulo: 'Entradas',
                descripcion: 'Registra y revisa entradas de mercancia al inventario.',
                icon: 'package-plus',
                enlace: '/app/inventarios/pos-entradas.php',
            },
            {
                titulo:      'Mermas',
                descripcion: 'Captura y monitorea perdidas, caducidades y daños.',
                icon:        'trash-2',
                enlace:      '/app/inventarios/pos-mermas.php',
            },
            // {
            //     titulo:      'Stock',
            //     descripcion: 'Consulta existencias actuales por sucursal y categoria.',
            //     icon:        'boxes',
            //     enlace:      '/app/inventarios/pos-stock.php',
            // },
            // {
            //     titulo: 'Traspasos',
            //     descripcion: 'Envia y recibe mercancia entre sucursales.',
            //     icon: 'truck',
            //     enlace: '/app/inventarios/pos-traspasos.php',
            // },
           
            // {
            //     titulo:      'Movimientos',
            //     descripcion: 'Historial de movimientos internos y ajustes de stock.',
            //     icon:        'arrow-left-right',
            //     enlace:      '/app/inventarios/pos-movimientos.php',
            // },
          
          
        ];
    }
}
