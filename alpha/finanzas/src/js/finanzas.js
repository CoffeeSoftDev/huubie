let api = 'ctrl/ctrl-finanzas.php';
let app;

$(document).ready(async function() {
    const data = await useFetch({ url: api, data: { opc: "init" } });
    window._finanzasData = {
        subsidiaries: data.subsidiaries || [],
        usr: data.usr,
        sub: data.sub,
        rol: data.rol
    };
    app = new App(api, 'root');

    ingresos = new Ingresos(api, 'root');
    compras  = new Compras(api, 'root');
    egresos  = new Egresos(api, 'root');

    app.init();
});

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Finanzas";
        this.subsidiaries = window._finanzasData.subsidiaries;
        this.usr = window._finanzasData.usr;
        this.sub = window._finanzasData.sub;
        this.rol = window._finanzasData.rol;
        this.selectedSub = this.sub || '0';
    }

    init() {
        this.render();
    }

    render() {
        this.layout();
        this.renderTabs();
        this.renderActiveTab();
    }

    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id: this.PROJECT_NAME,
                class: 'w-full min-h-screen p-2',
                container: [
                    {
                        type: 'div',
                        id: `container${this.PROJECT_NAME}`,
                        class: 'w-full'
                    }
                ]
            }
        });
    }

    renderTabs() {
        const activeModule = localStorage.getItem('finanzas_module') || 'ingresos';

        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: "dark",
            type: "short",
            showBorder: false,
            json: [
                {
                    id: "ingresos",
                    tab: "Ingresos",
                    lucideIcon: "trending-up",
                    iconColor: "text-green-400",
                    active: activeModule === 'ingresos',
                    onClick: () => {
                        localStorage.setItem('finanzas_module', 'ingresos');
                        this.renderActiveTab('ingresos');
                    }
                },
                {
                    id: "compras",
                    tab: "Compras",
                    lucideIcon: "shopping-cart",
                    iconColor: "text-blue-400",
                    active: activeModule === 'compras',
                    onClick: () => {
                        localStorage.setItem('finanzas_module', 'compras');
                        this.renderActiveTab('compras');
                    }
                },
                {
                    id: "egresos",
                    tab: "Egresos",
                    lucideIcon: "trending-down",
                    iconColor: "text-red-400",
                    active: activeModule === 'egresos',
                    onClick: () => {
                        localStorage.setItem('finanzas_module', 'egresos');
                        this.renderActiveTab('egresos');
                    }
                }
            ]
        });
    }

    renderActiveTab(module) {
        const activeModule = module || localStorage.getItem('finanzas_module') || 'ingresos';

        const tabActions = {
            'ingresos': () => ingresos.render(),
            'compras':  () => compras.render(),
            'egresos':  () => egresos.render()
        };

        if (tabActions[activeModule]) {
            tabActions[activeModule]();
        }
    }
}
