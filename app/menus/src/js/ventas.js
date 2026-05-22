let api = '/app/access/ctrl/ctrl-access.php';
let ventas;

$(async () => {
    const data = await useFetch({ url: api, data: { opc: 'company' } });
    ventas = new Ventas(api, 'mainContainer');
    ventas.init(data);
});

// --- Ventas ---
class Ventas extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Ventas';
    }

    init(data) {
        this.render(data);
    }

    render(data) {
        const cards = this.buildCards(data);
        const hour  = new Date().getHours();
        const greet = hour < 12 ? 'Buen dia' : hour < 19 ? 'Buena tarde' : 'Buena noche';

        new ModuleCard('#mainContainer', {
            header: {
                title:    `¡${greet}, ${data['user'] || 'Usuario'}! 👋`,
                subtitle: 'Nos da gusto verte de vuelta. ¿Por donde quieres empezar hoy?',
            },
            cards: cards,
        }).init();
    }

    buildCards(data) {
        const cards = [];

        data['routes'].forEach(route => {
            const title = data['level'] != '5' ? route['name'] : route['nickname'];
            cards.push({
                titulo:      title,
                descripcion: route['description'],
                imagen:      '/app/' + route['image'],
                enlace:      '/app/' + route['route'],
                padding:     route['padding'],
            });
        });

        cards.push({
            titulo:      'POS',
            descripcion: 'Punto de venta para registrar pedidos.',
            imagen:      '',
            icon:        'shopping-cart',
            enlace:      '/app/pos/',
            padding:     '',
        });

        cards.push({
            titulo:      'Inventarios',
            descripcion: 'Controla entradas, salidas y existencias de productos.',
            imagen:      '',
            icon:        'package',
            enlace:      '/app/inventarios/',
            padding:     '',
        });

        // cards.push({
        //     titulo:      'POS Inventario',
        //     descripcion: 'Visores fake de stock, entradas, movimientos, traspasos y mermas.',
        //     imagen:      '',
        //     icon:        'boxes',
        //     enlace:      '/app/inventarios/index.php',
        //     padding:     '',
        // });

        if (data['level'] == '1') {
            cards.push({
                titulo:      'Reportes',
                descripcion: 'Genera reportes detallados de ventas y turnos.',
                imagen:      '/app/src/img/reportes.svg',
                enlace:      '/app/pedidos-reportes/',
                padding:     '',
            });
            cards.push({
                titulo:      'Configuracion',
                descripcion: 'Agrega usuarios y sucursales.',
                imagen:      '/app/src/img/configuracion.svg',
                enlace:      '/app/admin/',
                padding:     '',
            });
        }

        return cards;
    }
}
