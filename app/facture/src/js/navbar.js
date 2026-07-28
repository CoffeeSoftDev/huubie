// -- Navbar --

// Sin fetch: los datos del usuario los inyecta PHP desde la sesion de app/
// en la constante global FACTURE_SESSION (ver layout/head.php).
class Navbar {

    init(options) {
        this.render(options);
        this.initEvents();
    }

    // -- Render --

    render(options) {
        const defaults = {
            parent:   'body',
            company:  '',
            user:     'Usuario',
            email:    '',
            rol:      '',
            negocio:  '',
            sucursal: ''
        };

        this.settings = Object.assign({}, defaults, options);
        this.parent   = $(this.settings.parent);

        const initials = this.getInitials(this.settings.user);
        const isDark   = localStorage.getItem('darkMode') === 'true';

        const navbarHtml = `
            ${this.styles()}
            <nav class="navbar-main border-bottom w-full px-4 py-2 h-16 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <button id="btn-mobile-menu" class="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-200 transition" title="Menu">
                        <i data-lucide="menu" class="w-6 h-6"></i>
                    </button>
                    <div class="nav-logo"><i data-lucide="coffee" class="w-5 h-5"></i></div>
                    <div class="flex flex-col leading-tight">
                        <span class="navbar-title">CoffeeSoft</span>
                        <span class="navbar-subtitle">${this.settings.negocio || this.settings.company}</span>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    ${this.branchPillHtml()}

                    <button id="btnThemeToggle" class="nav-theme-toggle" title="Cambiar tema claro u oscuro">
                        <i data-lucide="${isDark ? 'sun' : 'moon'}" class="w-[18px] h-[18px]"></i>
                    </button>

                    <button id="btnUserMenu" class="nav-user-pill flex items-center gap-2.5">
                        <div class="nav-avatar">${initials}</div>
                        <div class="hidden sm:flex flex-col items-start leading-tight">
                            <span class="nav-user-name">${this.settings.user}</span>
                            <span class="nav-user-rol">${this.settings.rol || 'Sin rol'}</span>
                        </div>
                        <i data-lucide="chevron-down" class="nav-chevron w-4 h-4"></i>
                    </button>
                </div>
            </nav>

            <div class="relative z-50">
                <div id="userMenuDropdown" class="nav-dropdown absolute right-3 mt-2 w-72 opacity-0 scale-95 invisible">
                    <div class="nav-user-head">
                        <div class="nav-head-avatar">
                            ${initials}
                            <span class="nav-status-dot"></span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="nav-head-name">${this.settings.user}</p>
                            <p class="nav-head-email">${this.settings.email || ''}</p>
                            ${this.settings.rol ? `<span class="nav-head-rol"><i data-lucide="shield" class="w-3 h-3"></i> ${this.settings.rol}</span>` : ''}
                        </div>
                    </div>

                    <div class="nav-divider"></div>

                    <div class="px-3 py-3">
                        <button id="btnLogout" class="nav-logout-btn">
                            <i data-lucide="log-out" class="w-4 h-4"></i>
                            Cerrar sesion
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.parent.prepend(navbarHtml);

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Pildora informativa: app/facture no cambia de sucursal, solo la muestra.
    branchPillHtml() {
        const sucursal = this.settings.sucursal || '';
        if (!sucursal) return '';

        return `
        <div class="relative">
            <button id="btnBranch" class="branch-pill branch-pill-static flex items-center gap-2.5" disabled>
                <span class="branch-pill-icon"><i data-lucide="building-2" class="w-[18px] h-[18px]"></i></span>
                <div class="flex flex-col items-start leading-tight">
                    <span class="branch-pill-label">Sucursal</span>
                    <span id="btnBranchName" class="branch-pill-name">${sucursal}</span>
                </div>
            </button>
        </div>`;
    }

    getInitials(name) {
        if (!name) return 'U';

        const parts = String(name).trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();

        return String(name).trim().slice(0, 2).toUpperCase();
    }

    // -- Estilos --

    styles() {
        if (document.getElementById('navbarUserStyles')) return '';

        return `
        <style id="navbarUserStyles">
            /* Navbar estilo Visor con acento Arcilla Invernal #C05A40 */
            .navbar-main { background:#FFFFFF; border-bottom:1px solid rgba(192,90,64,.22) !important; }

            .nav-logo { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,#C05A40 0%,#E8A68F 100%); display:flex; align-items:center; justify-content:center; color:#fff; box-shadow:0 4px 12px rgba(192,90,64,.35); flex-shrink:0; }
            .navbar-title { font-size:15px; font-weight:700; color:#111827; line-height:1.15; }
            .navbar-subtitle { font-size:10px; color:#9CA3AF; letter-spacing:.12em; text-transform:uppercase; }

            /* Solo icono (sin recuadro de boton): sin borde ni fondo, hover de color. */
            .nav-theme-toggle { width:38px; height:38px; display:flex; align-items:center; justify-content:center; color:#6B7280; border:none; background:transparent; cursor:pointer; transition:color .15s ease; }
            .nav-theme-toggle:hover { color:#111827; }
            body.dark-mode .nav-theme-toggle { color:#9CA3AF; }
            body.dark-mode .nav-theme-toggle:hover { color:#F9FAFB; }

            /* Pildora de sucursal */
            .branch-pill { padding:4px 10px; border:1px solid rgba(192,90,64,.28); border-radius:10px; background:rgba(192,90,64,.06); transition:all .15s ease; cursor:pointer; }
            .branch-pill.branch-pill-static { cursor:default; }
            .branch-pill-icon { width:30px; height:30px; border-radius:8px; background:rgba(192,90,64,.12); display:flex; align-items:center; justify-content:center; color:#C05A40; flex-shrink:0; }
            .branch-pill-label { font-size:9px; text-transform:uppercase; letter-spacing:.14em; color:#9CA3AF; font-weight:600; }
            .branch-pill-name { font-size:13px; font-weight:700; color:#111827; max-width:140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

            .nav-user-pill { padding:4px 8px 4px 13px; border:1px solid transparent; border-left:1px solid #E5E7EB; border-radius:8px; transition:all .15s ease; }
            .nav-user-pill:hover { background:#F3F4F6; border-color:#E5E7EB; }
            .nav-avatar { width:38px; height:38px; border-radius:9999px; background:#C05A40; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:13px; letter-spacing:.5px; box-shadow:0 4px 12px rgba(192,90,64,.32); }
            .nav-user-name { font-size:13px; font-weight:600; color:#111827; }
            .nav-user-rol  { font-size:11px; color:#6B7280; }
            .nav-chevron { color:#9CA3AF; transition:transform .2s ease; }
            #btnUserMenu.open .nav-chevron { transform:rotate(180deg); }

            .nav-dropdown { background:#FFFFFF; border:1px solid #E5E7EB; border-radius:16px; box-shadow:0 14px 38px rgba(17,24,39,.14); transition:all .22s ease; transform-origin:top right; overflow:hidden; }
            .nav-divider { height:1px; background:#E5E7EB; }

            /* Encabezado de usuario */
            .nav-user-head { display:flex; align-items:center; gap:12px; padding:16px; }
            .nav-head-avatar { position:relative; width:46px; height:46px; border-radius:9999px; background:#EEF1F5; display:flex; align-items:center; justify-content:center; color:#6B7280; font-weight:700; font-size:15px; letter-spacing:.5px; flex-shrink:0; }
            .nav-status-dot { position:absolute; right:0; bottom:1px; width:12px; height:12px; border-radius:9999px; background:#22C55E; border:2px solid #FFFFFF; }
            .nav-head-name { font-size:15px; font-weight:700; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .nav-head-email { font-size:12.5px; color:#9CA3AF; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .nav-head-rol { display:inline-flex; align-items:center; gap:4px; margin-top:6px; font-size:11px; font-weight:600; padding:2px 8px; border-radius:8px; background:rgba(192,90,64,.10); color:#A84A33; border:1px solid rgba(192,90,64,.22); }
            body.dark-mode .nav-head-rol { background:rgba(192,90,64,.18); color:#E8A68F; border-color:rgba(192,90,64,.30); }

            .nav-logout-btn { width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:11px; border:1px solid #E5E7EB; color:#DC2626; border-radius:12px; font-weight:600; font-size:14px; background:#FFFFFF; transition:all .15s ease; }
            .nav-logout-btn:hover { background:#FEF2F2; border-color:#FECACA; }

            /* Soporte dark-mode */
            body.dark-mode .navbar-title,
            body.dark-mode .nav-user-name,
            body.dark-mode .nav-head-name,
            body.dark-mode .branch-pill-name { color:#F9FAFB; }
            body.dark-mode .nav-user-rol,
            body.dark-mode .nav-head-email { color:#9CA3AF; }
            body.dark-mode .nav-user-pill { border-left-color:rgba(148,163,184,.18); }
            body.dark-mode .nav-user-pill:hover { background:rgba(148,163,184,.10); border-color:rgba(148,163,184,.18); }
            body.dark-mode .nav-dropdown { background:#1F2A37; border-color:rgba(55,65,81,.6); box-shadow:0 14px 38px rgba(0,0,0,.45); }
            body.dark-mode .nav-divider { background:rgba(55,65,81,.6); }
            body.dark-mode .nav-head-avatar { background:rgba(148,163,184,.14); color:#CBD5E1; }
            body.dark-mode .nav-status-dot { border-color:#1F2A37; }
            body.dark-mode .nav-logout-btn { background:transparent; border-color:rgba(55,65,81,.6); color:#F87171; }
            body.dark-mode .nav-logout-btn:hover { background:rgba(220,38,38,.12); border-color:rgba(220,38,38,.35); }
            body.dark-mode .branch-pill { background:rgba(192,90,64,.12); border-color:rgba(192,90,64,.35); }
        </style>`;
    }

    // -- Eventos --

    initEvents() {
        $('#btnUserMenu').on('click', (e) => {
            e.stopPropagation();
            this.toggleUserMenu();
        });

        $('#btnLogout').on('click', () => this.logout());
        $('#btnThemeToggle').on('click', () => this.toggleTheme());

        $(document).on('click', (e) => {
            if ($(e.target).closest('#btnUserMenu, #userMenuDropdown').length) return;
            this.closeUserMenu();
        });
    }

    toggleUserMenu() {
        $('#userMenuDropdown').toggleClass('opacity-0 scale-95 invisible');
        $('#btnUserMenu').toggleClass('open');
    }

    closeUserMenu() {
        $('#userMenuDropdown').addClass('opacity-0 scale-95 invisible');
        $('#btnUserMenu').removeClass('open');
    }

    toggleTheme() {
        const isDark = $('body').toggleClass('dark-mode').hasClass('dark-mode');
        localStorage.setItem('darkMode', isDark ? 'true' : 'false');
        $('#btnThemeToggle').html(`<i data-lucide="${isDark ? 'sun' : 'moon'}" class="w-[18px] h-[18px]"></i>`);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    logout() {
        Swal.fire({
            title:             'Esta seguro?',
            text:              'Esta a punto de cerrar su sesion actual.',
            icon:              'warning',
            showCancelButton:  true,
            confirmButtonText: 'Cerrar sesion',
            cancelButtonText:  'Cancelar',
            customClass: {
                popup:         'rounded-lg shadow-lg',
                title:         'text-2xl font-semibold',
                confirmButton: 'py-2 px-4 rounded',
                cancelButton:  'bg-secondary border border-gray-500 py-2 px-4 rounded hover:bg-[#555555]'
            },
            background:        '#ffff',
            allowOutsideClick: false,
            allowEscapeKey:    false
        }).then((result) => {
            if (result.isConfirmed) window.location.href = '/app/logout.php';
        });
    }
}

$(() => {
    const session = window.FACTURE_SESSION || {};

    const navbar = new Navbar();
    navbar.init({
        parent:   '#menu-navbar',
        user:     session.user     || 'Usuario',
        email:    session.email    || '',
        rol:      session.rol      || '',
        negocio:  session.negocio  || session.company || '',
        company:  session.company  || '',
        sucursal: session.sucursal || ''
    });
});
