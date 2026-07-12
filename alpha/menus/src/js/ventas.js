let apiAccess = '/alpha/access/ctrl/ctrl-access.php';
let ventas;

$(async () => {
    const data = await useFetch({ url: apiAccess, data: { opc: 'company' } });
    ventas = new Ventas(apiAccess, 'mainContainer');
    ventas.init(data);
});

// --- Ventas (hub de modulos) ---
// Mismo patron que app/menus: las cards se pintan con el componente ModuleCard
// (src/js/components/moduleCard.js), que trae saludo, buscador (Ctrl+K) y grid.
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
        const level = data['level'];

        data['routes'].forEach(route => {
            const title = level != '5' ? route['name'] : route['nickname'];
            cards.push({
                titulo:      title,
                descripcion: route['description'],
                imagen:      '/alpha/' + route['image'],
                enlace:      '/alpha/' + route['route'],
                padding:     route['padding'],
            });
        });

        const reportes = {
            titulo:      'Reportes',
            descripcion: 'Consulta cortes Z y cierres de turno por sucursal.',
            imagen:      '/alpha/src/img/reportes.svg',
            enlace:      '/alpha/order-visor/',
            padding:     '',
        };

        // Supervisor (rol 6): perfil de consulta. Solo ve Calendario (de las rutas
        // de BD) y Reportes; nada de operacion ni configuracion.
        if (level == '6') {
            const soloCalendario = cards.filter(c => /calendario/i.test(c.titulo || ''));
            return [...soloCalendario, reportes];
        }

        if (level == '1') {
            // Reportes va ANTES de Catalogos: se inserta en la posicion de esa card
            // (las rutas vienen de BD, con o sin acento). Si no existe, cae al final.
            const idxCatalogo = cards.findIndex(c => /^cat[aá]logo/i.test(c.titulo || ''));
            if (idxCatalogo !== -1) cards.splice(idxCatalogo, 0, reportes);
            else cards.push(reportes);

            cards.push({
                titulo:      'Configuración',
                descripcion: 'Agrega usuarios y sucursales.',
                imagen:      '/alpha/src/img/configuracion.svg',
                enlace:      '/alpha/admin/',
                padding:     '',
            });
        }

        return cards;
    }
}
