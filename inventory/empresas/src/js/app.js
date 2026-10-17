// Pantalla de Empresas (solo Super Admin): la misma interfaz del selector de
// sucursales, con una tarjeta por empresa y la del módulo DEV. Entrar a una
// empresa deja la sesión en ella y abre sus módulos; desde ahí la navbar lista
// las sucursales de esa empresa.
let api = 'ctrl/ctrl-empresas.php';
let app;

// Base del host hasta /inventory (ej. "/huubie/inventory" o "/inventory").
function inventoryBase() {
    const p = window.location.pathname;
    const i = p.indexOf('/inventory/');
    return i >= 0 ? p.slice(0, i + '/inventory'.length) : '/inventory';
}

// Colores para los diálogos SweetAlert según el tema activo.
function swalTheme() {
    const dark = document.body.classList.contains('dark-mode');
    return {
        background: dark ? '#111928' : '#FFFFFF',
        color:      dark ? '#F9FAFB' : '#111827'
    };
}

$(async () => {
    const data = await useFetch({ url: api, data: { opc: 'init' } });

    app = new App(api, 'root');
    app.render(data || {});
});

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Empresas';
    }

    render(data) {
        this.csSelectorCards({
            parent:   this._div_modulo,
            id:       `selector${this.PROJECT_NAME}`,
            title:    'Selecciona tu empresa',
            subtitle: 'Elige a qué empresa quieres entrar hoy',
            user:     data.user || 'Usuario',
            json:     this.jsonCards(data),
            empty: {
                icon:  'building-2',
                title: 'Sin empresas disponibles',
                text:  'No hay empresas activas todavía. Dalas de alta desde el módulo DEV.'
            },
            onSelect: (item) => this.onSelect(item),
            onLogout: () => this.logout()
        });
    }

    jsonCards(data) {
        const cards = (data.companies || []).map((c) => ({
            id:       c.id,
            type:     'company',
            title:    c.name,
            icon:     'building-2',
            location: c.ubication,
            badge:    c.current ? 'ACTUAL' : '',
            selected: !!c.current,
            status:   c.branches > 0
                ? { text: `${c.branches} sucursal${c.branches !== 1 ? 'es' : ''} activa${c.branches !== 1 ? 's' : ''}`, tone: 'open' }
                : { text: 'Sin sucursales activas', tone: 'neutral' }
        }));

        if (data.dev && data.dev.route) {
            cards.push({
                id:           'dev',
                type:         'dev',
                title:        String(data.dev.name || 'DEV').toUpperCase(),
                icon:         data.dev.icon || 'code-xml',
                iconClass:    'bg-gray-800',
                location:     data.dev.description || 'Administrador CoffeeSoft',
                locationIcon: 'wrench',
                route:        data.dev.route,
                status:       { text: 'Módulo del Super Admin', tone: 'neutral' }
            });
        }

        return cards;
    }

    onSelect(item) {
        if (item.type === 'dev') {
            this.openRoute(item.route);
            return;
        }
        this.enterCompany(item);
    }

    async enterCompany(item) {
        const res = await useFetch({ url: this._link, data: { opc: 'enterCompany', id: item.id } });

        if (res && res.status === 200) {
            this.openRoute('modulos/');
            return;
        }

        Swal.fire({
            ...swalTheme(),
            icon:               'error',
            title:              'No se pudo entrar a la empresa',
            text:               (res && res.message) || 'Intenta de nuevo.',
            confirmButtonColor: 'rgb(var(--brand-600, 192 90 64))',
            heightAuto:         false
        });
    }

    // Mismo aviso que el selector de sucursales; la sesión la cierra salir
    // (acceso/ctrl/ctrl-logout.php).
    logout() {
        Swal.fire({
            ...swalTheme(),
            title:              '¿Cerrar sesión?',
            text:               'Se cerrará tu sesión actual y volverás al inicio.',
            icon:               'question',
            showCancelButton:   true,
            confirmButtonText:  'Sí, cerrar sesión',
            cancelButtonText:   'Cancelar',
            confirmButtonColor: 'rgb(var(--brand-600, 192 90 64))',
            cancelButtonColor:  '#9CA3AF',
            reverseButtons:     true,
            scrollbarPadding:   false,
            heightAuto:         false
        }).then((result) => {
            if (result.isConfirmed) this.openRoute('salir');
        });
    }

    openRoute(route) {
        window.location.href = inventoryBase() + '/' + String(route).replace(/^\/+/, '');
    }
}
