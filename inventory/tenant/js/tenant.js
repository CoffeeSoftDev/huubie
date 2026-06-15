let api = 'ctrl/ctrl-tenant.php';
let app, facturacion, promociones, accesos;
let companies, plans, subscriptions, payments, coupons, redemptions;
let modules, submodules, sections, typePermissions, roles, permissions, users;
let dataInit = {};

// -- Helpers --

function notify(r) {
    if (r && r.status == 200) {
        alert({ icon: 'success', text: r.message, timer: 1400 });
    } else {
        alert({ icon: 'error', text: (r && r.message) || 'Ocurrió un error', btn1: true });
    }
}

function afterSave(response, reload) {
    notify(response);
    if (response && response.status == 200 && typeof reload === 'function') reload();
}

// Convierte un texto a slug: minúsculas, sin acentos, espacios -> guiones.
// 'Inventarios Productos' -> 'inventarios-productos'
function slugify(text) {
    return (text || '')
        .toString()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos (diacríticos)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')   // todo lo no alfanumérico -> guion
        .replace(/^-+|-+$/g, '');       // sin guiones al inicio/fin
}

// Mientras se escribe el Nombre, autogenera el Código (campo de solo lectura).
// Se llama desde el onkeyup del input de nombre en los formularios.
function autoCode(value) {
    $('#code').val(slugify(value));
}

$(async () => {
    dataInit = await useFetch({ url: api, data: { opc: 'init' } });

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
    users           = new Users(api, 'root');

    facturacion = new FacturacionGroup(api, 'root');
    promociones = new PromocionesGroup(api, 'root');
    accesos     = new AccesosGroup(api, 'root');

    app = new App(api, 'root');
    app.render();
});

// -- App --

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Tenant';
    }

    render() {
        this.layout();
        this.headerBar({ parent: `header${this.PROJECT_NAME}` });
        this.renderTabs();
        this.renderActiveTab();
    }

    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id: this.PROJECT_NAME,
                class: 'flex flex-col mx-2',
                container: [
                    { type: 'div', id: `header${this.PROJECT_NAME}`, class: 'w-full' },
                    { type: 'div', id: `container${this.PROJECT_NAME}`, class: 'w-full  rounded p-2' }
                ]
            }
        });
    }

    headerBar(options) {
        $(`#${options.parent}`).html(`
            <div class="flex items-center gap-3 px-2 pt-2 pb-2">
                <div class="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-50 text-blue-600">
                    <i data-lucide="building-2" class="w-6 h-6"></i>
                </div>
                <div>
                    <h2 class="text-2xl font-semibold tracking-tight">Administrador CoffeeSoft</h2>
                    <p class="text-sm text-gray-400 flex items-center gap-1.5">
                        <i data-lucide="cloud" class="w-3.5 h-3.5"></i>
                        Plataforma SaaS
                    </p>
                </div>
            </div>
        `);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    renderTabs() {
        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `groups${this.PROJECT_NAME}`,
            theme: 'light',
            type: 'short',
            json: [
                {
                    id: 'grp-facturacion',
                    tab: 'Facturación',
                    lucideIcon: 'credit-card',
                    class:'p-3',
                    active: true,
                    onClick: () => facturacion.render()
                },
                {
                    id: 'grp-accesos',
                    tab: 'Accesos y permisos',
                    lucideIcon: 'shield',
                    class: 'p-3',
                    onClick: () => accesos.render()
                },
                {
                    id: 'grp-promociones',
                    tab: 'Promociones',
                    class: 'p-3',
                    lucideIcon: 'ticket-percent',
                    onClick: () => promociones.render()
                },
            ]
        });
    }

    renderActiveTab() {
        facturacion.render();
    }
}

// -- FacturacionGroup --

class FacturacionGroup extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Facturacion';
    }

    render() {
        if ($(`#tabsFacturacion`).length) {
            return;
        }
        this.renderTabs();
        this.renderActiveTab();
    }

    renderTabs() {
        this.tabLayout({
            parent: 'container-grp-facturacion',
            id: 'tabsFacturacion',
            theme: 'light',
            type: 'button',
            json: [
                {
                    id: 'empresas',
                    tab: 'Empresas',
                    lucideIcon: 'building-2',
                    active: true,
                    onClick: () => { companies.render(); companies.lsCompanies(); }
                },
                {
                    id: 'planes',
                    tab: 'Planes',
                    lucideIcon: 'layers',
                    onClick: () => { plans.render(); plans.lsPlans(); }
                },
                {
                    id: 'suscripciones',
                    tab: 'Suscripciones',
                    lucideIcon: 'receipt',
                    onClick: () => { subscriptions.render(); subscriptions.lsSubscriptions(); }
                },
                {
                    id: 'pagos',
                    tab: 'Pagos',
                    lucideIcon: 'dollar-sign',
                    onClick: () => { payments.render(); payments.lsPayments(); }
                }
            ]
        });
    }

    renderActiveTab() {
        companies.render();
        companies.lsCompanies();
    }
}

// -- PromocionesGroup --

class PromocionesGroup extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Promociones';
    }

    render() {
        if ($(`#tabsPromociones`).length) {
            return;
        }
        this.renderTabs();
        this.renderActiveTab();
    }

    renderTabs() {
        this.tabLayout({
            parent: 'container-grp-promociones',
            id: 'tabsPromociones',
            theme: 'light',
            type: 'button',
            json: [
                {
                    id: 'cupones',
                    tab: 'Cupones',
                    lucideIcon: 'tag',
                    active: true,
                    onClick: () => { coupons.render(); coupons.lsCoupons(); }
                },
                {
                    id: 'canjes',
                    tab: 'Canjes',
                    lucideIcon: 'gift',
                    onClick: () => { redemptions.render(); redemptions.lsRedemptions(); }
                }
            ]
        });
    }

    renderActiveTab() {
        coupons.render();
        coupons.lsCoupons();
    }
}

// -- AccesosGroup --

class AccesosGroup extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Accesos';
    }

    render() {
        if ($(`#tabsAccesos`).length) {
            return;
        }
        this.renderTabs();
        this.renderActiveTab();
    }

    renderTabs() {
        this.tabLayout({
            parent: 'container-grp-accesos',
            id: 'tabsAccesos',
            theme: 'light',
            type: 'button',
            json: [
                {
                    id: 'permisos',
                    tab: 'Permisos',
                    lucideIcon: 'shield-check',
                    active: true,
                    onClick: () => { permissions.render(); permissions.lsPermissions(); }
                },
                {
                    id: 'modulos',
                    tab: 'Módulos',
                    lucideIcon: 'layout-grid',
               
                    onClick: () => { modules.render(); modules.lsModules(); }
                },
                {
                    id: 'submodulos',
                    tab: 'Submódulos',
                    lucideIcon: 'folder-tree',
                    onClick: () => { submodules.render(); submodules.lsSubmodules(); }
                },
                {
                    id: 'secciones',
                    tab: 'Secciones',
                    lucideIcon: 'layout-list',
                    onClick: () => { sections.render(); sections.lsSections(); }
                },
                {
                    id: 'roles',
                    tab: 'Roles',
                    lucideIcon: 'users',
                    onClick: () => { roles.render(); roles.lsRoles(); }
                },
                {
                    id: 'usuarios',
                    tab: 'Usuarios',
                    lucideIcon: 'user-cog',
                    onClick: () => { users.render(); users.lsUsers(); }
                },
                {
                    id: 'tipos-permiso',
                    tab: 'Tipos de permiso',
                    lucideIcon: 'key-round',
                    onClick: () => { typePermissions.render(); typePermissions.lsTypePermissions(); }
                },
           
            ]
        });
    }

    renderActiveTab() {
        permissions.render();
        permissions.lsPermissions();
    }
}
