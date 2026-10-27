let api = 'ctrl/ctrl-empresas.php';
let app;

// Rutas que devuelve el ctrl, relativas a pro/; esta pagina vive en pro/app/empresas/.
const PRO_ROOT = '../../';

$(async () => {
    initTheme();

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
            status:   company.branches > 0
                ? { text: `${company.branches} sucursal${company.branches !== 1 ? 'es' : ''} activa${company.branches !== 1 ? 's' : ''}`, tone: 'open' }
                : { text: 'Sin sucursales activas', tone: 'neutral' }
        })));
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

// Claro por defecto; la preferencia se guarda por navegador.
function initTheme() {
    const apply = (dark) => {
        document.body.classList.toggle('dark-mode', dark);
        $('#btn-theme').html(`<i data-lucide="${dark ? 'sun' : 'moon'}" class="w-[18px] h-[18px]"></i>`);
        if (window.lucide) lucide.createIcons();
    };

    let dark = false;
    try { dark = localStorage.getItem('huubie:pro:dark') === 'true'; } catch (e) {}

    apply(dark);

    $('#btn-theme').on('click', () => {
        const next = !document.body.classList.contains('dark-mode');
        try { localStorage.setItem('huubie:pro:dark', next ? 'true' : 'false'); } catch (e) {}
        apply(next);
    });
}

function swalTheme() {
    const dark = document.body.classList.contains('dark-mode');

    return {
        background: dark ? '#111928' : '#FFFFFF',
        color:      dark ? '#F9FAFB' : '#111827'
    };
}
