let api = 'ctrl/ctrl-empresas.php';
let app;

// Rutas que devuelve el ctrl, relativas a pro/; esta pagina vive en pro/app/empresas/.
const PRO_ROOT = '../../';

$(async () => {
    const data = await useFetch({ url: api, data: { opc: 'init' } });

    if (data && data.status === 401) {
        window.location.href = PRO_ROOT + 'index.php';
        return;
    }

    app = new App(api, 'root');
    app.render(data || {});
});

class App extends Templates {

    // -- Bootstrap --
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
                text:  'No hay empresas activas todavía.'
            },
            onSelect: (item) => this.onSelect(item),
            onLogout: () => this.logout()
        });
    }

    // -- Data --
    // Primero la tarjeta del modulo Developer y despues las empresas.
    jsonCards(data) {
        const cards = [];

        if (data.dev) {
            cards.push({
                id:           'dev',
                type:         'dev',
                title:        String(data.dev.name).toUpperCase(),
                icon:         data.dev.icon,
                // El anillo la despega de la tarjeta en tema oscuro (gray-800 ≈ el fondo).
                iconClass:    'bg-gray-800 ring-1 ring-inset ring-white/20',
                location:     data.dev.description,
                locationIcon: 'wrench',
                route:        data.dev.route,
                status:       { text: 'Módulo de root', tone: 'neutral' }
            });
        }

        return cards.concat((data.companies || []).map((company) => ({
            id:       company.id,
            type:     'company',
            title:    company.name,
            icon:     'building-2',
            location: company.ubication,
            badge:    company.current ? 'ACTUAL' : '',
            selected: !!company.current,
            status:   this.companyStatus(company)
        })));
    }

    /*  Lo que dice la tarjeta de cada empresa. Al corriente: su plan y sus
        sucursales. Si no lo esta, por que: es justo lo que root va a ver al
        entrar, el inicio con el aviso de pago. */
    companyStatus(company) {
        if (company.branches === 0) return { text: 'Sin sucursales activas', tone: 'neutral' };

        const branches = `${company.branches} sucursal${company.branches !== 1 ? 'es' : ''}`;

        if (company.ok) return { text: `${company.plan} · ${branches}`, tone: 'open' };

        const reason = { pending: 'Pendiente de activar', suspended: 'Suspendida', cancelled: 'Cancelada' }[company.status]
            || (company.trial_over ? 'Prueba terminada' : (company.plan ? 'Pago pendiente' : 'Sin plan'));

        return { text: `${reason} · ${branches}`, tone: 'warning' };
    }

    // -- Event handlers --
    onSelect(item) {
        if (item.type === 'dev') {
            window.location.href = PRO_ROOT + item.route + '/';
            return;
        }

        this.enterCompany(item);
    }

    async enterCompany(item) {
        const res = await useFetch({ url: this._link, data: { opc: 'enterCompany', id: item.id } });

        if (res && res.status === 200) {
            // El rail guardado en esta pestaña es de la empresa anterior
            // (auth/src/js/sidebar.js): se olvida para no pintarlo ni un instante.
            try {
                Object.keys(sessionStorage).filter((k) => k.startsWith('pro:sidebar:')).forEach((k) => sessionStorage.removeItem(k));
            } catch (e) {}

            window.location.href = PRO_ROOT + res.redirect;
            return;
        }

        Swal.fire({
            ...swalTheme(),
            icon:               'error',
            title:              'No se pudo entrar a la empresa',
            text:               (res && res.message) || 'Intenta de nuevo.',
            confirmButtonColor: '#0A0A0A',
            heightAuto:         false
        });
    }

    logout() {
        Swal.fire({
            ...swalTheme(),
            title:              '¿Cerrar sesión?',
            text:               'Se cerrará tu sesión actual y volverás al inicio.',
            icon:               'question',
            showCancelButton:   true,
            confirmButtonText:  'Sí, cerrar sesión',
            cancelButtonText:   'Cancelar',
            confirmButtonColor: '#0A0A0A',
            cancelButtonColor:  '#9CA3AF',
            reverseButtons:     true,
            scrollbarPadding:   false,
            heightAuto:         false
        }).then((result) => {
            if (result.isConfirmed) window.location.href = PRO_ROOT + 'logout.php';
        });
    }
}

// -- Tema --
// El tema lo elige la barra (auth/src/js/navbar.js) y lo pinta
// assets/js/tailwind-theme.js; aqui solo se viste el aviso igual que la pagina.

function swalTheme() {
    const dark = document.body.classList.contains('dark-mode');

    return {
        background: dark ? '#111928' : '#FFFFFF',
        color:      dark ? '#F9FAFB' : '#111827'
    };
}
