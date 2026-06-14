// Núcleo del Administrador del Tenant: estado global, App y arranque.
// Las clases de cada dominio viven en saas.js y access.js (cargados antes).

let api = 'ctrl/ctrl-tenant.php';
let app, companies, plans, subscriptions, payments, coupons, redemptions;
let modules, submodules, sections, typePermissions, roles, permissions;
let dataInit = {};

// Éxito con timer; error con botón para poder leerse.
function notify(r) {
    if (r && r.status == 200) {
        alert({ icon: 'success', text: r.message, timer: 1400 });
    } else {
        alert({ icon: 'error', text: (r && r.message) || 'Ocurrió un error', btn1: true });
    }
}

$(async () => {
    dataInit = await useFetch({ url: api, data: { opc: 'init' } });

    app           = new App(api, 'root');
    companies     = new Companies(api, 'root');
    plans         = new Plans(api, 'root');
    subscriptions = new Subscriptions(api, 'root');
    payments      = new Payments(api, 'root');
    coupons       = new Coupons(api, 'root');
    redemptions   = new Redemptions(api, 'root');
    modules         = new Modules(api, 'root');
    submodules      = new Submodules(api, 'root');
    sections        = new Sections(api, 'root');
    typePermissions = new TypePermissions(api, 'root');
    roles           = new Roles(api, 'root');
    permissions     = new Permissions(api, 'root');

    app.render();
});

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Tenant';
    }

    render() {
        this.layout();
        companies.render();
        plans.render();
        subscriptions.render();
        payments.render();
        coupons.render();
        redemptions.render();
        modules.render();
        submodules.render();
        sections.render();
        typePermissions.render();
        roles.render();
        permissions.render();
        // Pestaña por defecto.
        companies.lsCompanies();
    }

    layout() {
        this.primaryLayout({
            parent: 'root',
            id: this.PROJECT_NAME,
            class: 'w-full',
            card: {
                filterBar: { class: 'w-full', id: `filterBar${this.PROJECT_NAME}` },
                container: { class: 'w-full h-full', id: `container${this.PROJECT_NAME}` }
            }
        });

        this.headerBar({ parent: `filterBar${this.PROJECT_NAME}` });
        this.layoutTabs();
    }

    headerBar(options) {
        const totalCompanies = (dataInit.companies || []).length;
        const totalPlans     = (dataInit.plans || []).length;

        const container = $('<div>', {
            class: 'flex justify-between items-center px-2 pt-3 pb-3'
        });

        container.html(`
            <div>
                <h2 class="text-2xl font-semibold">🏢 Administrador del Tenant</h2>
                <p class="text-gray-400">
                    Plataforma SaaS ·
                    <span class="font-semibold text-gray-600">${totalCompanies}</span>
                    empresa${totalCompanies !== 1 ? 's' : ''} activa${totalCompanies !== 1 ? 's' : ''} ·
                    <span class="font-semibold text-gray-600">${totalPlans}</span>
                    plan${totalPlans !== 1 ? 'es' : ''}
                </p>
            </div>
            <button class="bg-[#C05A40] hover:opacity-90 text-white font-semibold px-4 py-2 rounded transition flex items-center"
                onclick="app.render()">
                <i class="icon-arrows-cw mr-2"></i>Actualizar
            </button>
        `);

        $(`#${options.parent}`).html(container);
    }

    layoutTabs() {
        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: 'light',
            class: '',
            type: 'short',
            json: [
                {
                    id: 'empresas',
                    tab: 'Empresas',
                    lucideIcon: 'building-2',
                    class: 'mb-1',
                    active: true,
                    onClick: () => companies.lsCompanies()
                },
                {
                    id: 'planes',
                    tab: 'Planes',
                    lucideIcon: 'layers',
                    onClick: () => plans.lsPlans()
                },
                {
                    id: 'suscripciones',
                    tab: 'Suscripciones',
                    lucideIcon: 'credit-card',
                    onClick: () => subscriptions.lsSubscriptions()
                },
                {
                    id: 'pagos',
                    tab: 'Pagos',
                    lucideIcon: 'dollar-sign',
                    onClick: () => payments.lsPayments()
                },
                {
                    id: 'cupones',
                    tab: 'Cupones',
                    lucideIcon: 'ticket-percent',
                    onClick: () => coupons.lsCoupons()
                },
                {
                    id: 'canjes',
                    tab: 'Canjes',
                    lucideIcon: 'gift',
                    onClick: () => redemptions.lsRedemptions()
                },
                {
                    id: 'modulos',
                    tab: 'Módulos',
                    lucideIcon: 'layout-grid',
                    onClick: () => modules.lsModules()
                },
                {
                    id: 'submodulos',
                    tab: 'Submódulos',
                    lucideIcon: 'folder-tree',
                    onClick: () => submodules.lsSubmodules()
                },
                {
                    id: 'secciones',
                    tab: 'Secciones',
                    lucideIcon: 'layout-list',
                    onClick: () => sections.lsSections()
                },
                {
                    id: 'roles',
                    tab: 'Roles',
                    lucideIcon: 'shield',
                    onClick: () => roles.lsRoles()
                },
                {
                    id: 'tipos-permiso',
                    tab: 'Tipos de permiso',
                    lucideIcon: 'key-round',
                    onClick: () => typePermissions.lsTypePermissions()
                },
                {
                    id: 'permisos',
                    tab: 'Permisos',
                    lucideIcon: 'shield-check',
                    onClick: () => permissions.lsPermissions()
                }
            ]
        });

        $(`#content-tabs${this.PROJECT_NAME}`).removeClass('h-screen');
    }
}
