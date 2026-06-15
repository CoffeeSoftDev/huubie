// Dashboard de Módulos: navegador de tarjetas.
//  Nivel 1: cards de MÓDULOS. Click en una card -> abre sus SUBMÓDULOS.
//  Nivel 2: cards de SUBMÓDULOS. Click -> navega a la ruta del submódulo.
// Las SECCIONES no se muestran aquí: alimentan la sidebar del módulo/submódulo elegido.
let api = 'ctrl/ctrl-modulos.php';
let app;

// Base del host hasta /inventory (ej. "/huubie/inventory" o "/inventory").
function inventoryBase() {
    const p = window.location.pathname;
    const i = p.indexOf('/inventory/');
    return i >= 0 ? p.slice(0, i + '/inventory'.length) : '/inventory';
}

$(function () {
    useFetch({ url: api, data: { opc: 'init' } }).then((data) => {
        app = new App(api, 'root');
        app.render(data);
    });
});

class App {
    constructor(link, parent) {
        this.link   = link;
        this.parent = parent;
        this.user   = 'Usuario';
        this.card   = null; // instancia ModuleCard reutilizada entre niveles
    }

    render(data) {
        this.user = data.user || 'Usuario';
        this.showModules(data.modules || []);
    }

    // ---- Nivel 1: Módulos ----
    showModules(modules) {
        const hour  = new Date().getHours();
        const greet = hour < 12 ? 'Buen día' : hour < 19 ? 'Buena tarde' : 'Buena noche';

        const cards = modules.map((m) => ({
            titulo:      m.name,
            descripcion: m.description || '',
            icon:        m.icon || 'layout-grid',
            // Badge: solo el conteo de submódulos (sin "ACTIVO").
            badge: m.submodules > 0
                ? { text: `${m.submodules} SUBMÓDULO${m.submodules !== 1 ? 'S' : ''}` }
                : null,
            footer: 'Abrir módulo',
            // onClick: con submódulos abre el nivel 2; sin ellos navega directo a su ruta.
            onClick: () => {
                if (m.submodules > 0) this.openModule(m.id);
                else if (m.route)     window.location.href = inventoryBase() + '/' + String(m.route).replace(/^\/+/, '');
            },
        }));

        this.card = new ModuleCard('#' + this.parent, {
            header: {
                title:    `¡${greet}, ${this.user}! 👋`,
                subtitle: 'Elige un módulo para ver sus submódulos.',
            },
            grid: { cols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4', height: 'h-[150px]' },
            cards: cards,
        }).init();
    }

    // ---- Nivel 2: Submódulos de un módulo ----
    openModule(moduleId) {
        useFetch({ url: this.link, data: { opc: 'submodules', module_id: moduleId } }).then((res) => {
            if (!res || res.status !== 200) {
                Swal.fire({ icon: 'error', title: 'No se pudieron cargar los submódulos', heightAuto: false });
                return;
            }

            const mod  = res.module || {};
            const subs = res.submodules || [];

            const cards = subs.map((sm) => ({
                titulo:      sm.name,
                descripcion: sm.description || '',
                icon:        sm.icon || 'folder-tree',
                footer:      'Abrir submódulo',
                onClick: () => {
                    if (sm.route) window.location.href = inventoryBase() + '/' + String(sm.route).replace(/^\/+/, '');
                },
            }));

            // Tarjeta inicial para volver a los módulos (sin badge/footer).
            cards.unshift({
                titulo:      'Volver',
                descripcion: 'Regresar a módulos',
                icon:        'arrow-left',
                onClick: () => useFetch({ url: this.link, data: { opc: 'init' } }).then((d) => this.showModules(d.modules || [])),
            });

            // Reutiliza la instancia: cambia título y cards sin recrear el componente.
            this.card.setTitle(`${this.esc(mod.name || 'Módulo')}`);
            this.card.setSubtitle('Selecciona un submódulo.');
            this.card.setCards(cards);
        });
    }

    esc(t) {
        return (t == null ? '' : String(t)).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }
}
