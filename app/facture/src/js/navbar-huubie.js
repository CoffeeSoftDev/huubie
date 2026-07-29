// -- Navbar del Facturador --

// Mismo aspecto que el navbar de app/ (app/src/js/navbar.js) pero propio del
// modulo y SIN fetch: el Facturador vivira en otra base de datos, asi que los
// datos del usuario son fijos por ahora. Cuando exista su backend, esta constante
// se reemplaza por la respuesta de su propio ctrl.
const FACTURE_USER = {
    name: 'Usuario',
    role: 'Facturacion'
};

class Navbar {

    init(options) {
        this.render(options);
        this.initEvents();
    }

    // -- Render --

    render(options) {
        // La paleta la sirve facture-theme.js: es la misma para navbar y rail.
        const defaults = {
            parent:   '#menu-navbar',
            logo:     '/app/src/img/logo/logo.svg',
            username: FACTURE_USER.name,
            role:     FACTURE_USER.role,

            navbar:   FACTURE_PALETTE.navbar,
            header:   FACTURE_PALETTE.header,
            dropdown: FACTURE_PALETTE.dropdown,
            badge:    FACTURE_PALETTE.badge,
            logout:   FACTURE_PALETTE.logout
        };

        this.settings = Object.assign({}, defaults, options);
        this.parent   = $(this.settings.parent);

        const navbar   = this.settings.navbar;
        const header   = this.settings.header;
        const dropdown = this.settings.dropdown;
        const badge    = this.settings.badge;
        const logout   = this.settings.logout;

        const avatar = `<div class="w-8 h-8 rounded-full border-2 border-white bg-purple-600 flex items-center justify-center"><i class="icon-user-7 text-white text-base"></i></div>`;
        const avatarLg = `<div class="w-20 h-20 rounded-full border-2 border-white shadow-lg bg-purple-600 flex items-center justify-center"><i class="icon-user-7 text-white text-4xl"></i></div>`;

        const navbarHtml = `
            <nav class="w-full px-4 py-1.5 h-12 z-50 flex items-center justify-between border-b shadow-lg shadow-black/20 shrink-0" style="background-color: ${navbar.bg}; border-bottom-color: ${navbar.border}4D; color: ${navbar.text};">
                <div class="flex items-center space-x-2">
                    <img src="${this.settings.logo}" alt="Logo" class="w-8 h-8" />
                    <button id="toggleSidebar" class="text-xl leading-none" style="color: ${navbar.text};">☰</button>
                    <span class="hidden md:inline text-xs border-l pl-2 ml-1" style="color: ${navbar.muted}; border-color: ${navbar.divider};">Facturador SAT</span>
                </div>
                <div class="flex items-center gap-3">
                    <button id="btnFactureTheme" title="${this.themeTitle()}" class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style="color: ${navbar.muted};">
                        ${this.themeIcon()}
                    </button>
                    <button id="btnUserMenu" class="ml-1 flex items-center gap-2 border-l pl-3" style="border-color: ${navbar.divider};">
                        ${avatar}
                        <div class="hidden md:flex flex-col items-start leading-tight text-left">
                            <span class="text-xs font-semibold" style="color: ${navbar.text};">${this.settings.username}</span>
                            <span class="text-[10px]" style="color: ${navbar.muted};">${this.settings.role}</span>
                        </div>
                    </button>
                </div>
            </nav>

            <div class="relative z-50">
                <div id="userMenuDropdown" class="absolute right-0 w-72 rounded-2xl shadow-lg opacity-0 scale-95 invisible transition-all duration-500 ease-out" style="background-color: ${dropdown.bg};">
                    <div class="relative flex items-center justify-center h-20 rounded-t-2xl" style="background-color: ${header.bg};">
                        <button id="btnCloseUserMenu" class="btn btn-sm p-1 absolute top-2 right-3 text-gray-400 hover:text-white focus:outline-none">
                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div class="absolute -bottom-10">
                            <div class="relative">
                                ${avatarLg}
                                <span class="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2" style="background-color: ${header.statusOnline}; border-color: ${header.bg};"></span>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-col items-center pt-4 pb-2 px-4 space-y-2">
                        <h2 class="font-semibold text-lg mt-3" style="color: ${navbar.text};">${this.settings.username}</h2>
                        <span class="inline-flex text-xs font-semibold px-2 py-1 rounded-full align-items-center" style="background-color: ${badge.bg}80; color: ${badge.text};">
                            <i class="icon-book-open"></i> ${this.settings.role}
                        </span>
                    </div>

                    <div class="w-full h-px my-2" style="background-color: ${dropdown.divider};"></div>

                    <div class="w-full px-5 mt-3 mb-4">
                        <button id="btnLogout" class="w-full flex items-center justify-center gap-2 px-2 py-2 border rounded-xl transition" style="border-color: ${logout.border}; color: ${logout.border};" onmouseover="this.style.backgroundColor='${logout.hover}'; this.style.color='#fff';" onmouseout="this.style.backgroundColor=''; this.style.color='${logout.border}';">
                            <i class="icon-logout-3"></i>
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.parent.prepend(navbarHtml);

        // El toggle solo tiene sentido si la pagina monta sidebar (el hub no).
        if (!$('#menu-sidebar').length) $('#toggleSidebar').hide();
    }

    // -- Tema --

    // El icono anuncia a que tema se cambia, no en cual se esta.
    themeIcon() {
        const attrs = 'width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

        if (FACTURE_THEME_IS_LIGHT) {
            return `<svg ${attrs}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
        }

        return `<svg ${attrs}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
    }

    themeTitle() {
        return FACTURE_THEME_IS_LIGHT ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro';
    }

    // -- Eventos --

    initEvents() {
        $('#btnUserMenu, #btnCloseUserMenu').on('click', () => this.toggleUserMenu());
        $('#btnLogout').on('click', () => this.logout());
        $('#btnFactureTheme').on('click', () => toggleFactureTheme());
    }

    toggleUserMenu() {
        $('#userMenuDropdown').toggleClass('opacity-0 scale-95 invisible');
    }

    logout() {
        Swal.fire({
            title:             '¿Está seguro?',
            text:              'Está a punto de cerrar su sesión actual.',
            icon:              'warning',
            showCancelButton:  true,
            confirmButtonText: 'Cerrar sesión',
            cancelButtonText:  'Cancelar',
            customClass: {
                popup:         FACTURE_PALETTE.swal.popup,
                title:         'text-2xl font-semibold',
                confirmButton: 'bg-[#1C64F2] hover:bg-[#0E9E6E] text-white py-2 px-4 rounded',
                cancelButton:  'bg-transparent border border-gray-500 py-2 px-4 rounded'
            },
            background:        FACTURE_PALETTE.swal.bg,
            allowOutsideClick: false,
            allowEscapeKey:    false
        }).then((result) => {
            if (result.isConfirmed) window.location.href = '/app/logout.php';
        });
    }
}

$(() => {
    const navbar = new Navbar();
    navbar.init({ parent: '#menu-navbar' });
});
