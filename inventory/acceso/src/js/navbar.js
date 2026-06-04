let level = 0;

class Navbar {
    init(options) {
        this.render(options);
        this.initEvents();
    }

    getInitials(name) {
        if (!name) return "U";
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.trim().slice(0, 2).toUpperCase();
    }

    render(options) {
        const defaults = {
            company:  "N/A",
            user:     "Usuario",
            rol:      "",
            negocio:  "",
            level:    0,
            parent:   "body",
        };

        this.settings = Object.assign({}, defaults, options);
        this.parent   = $(this.settings.parent);
        level = this.settings.level;

        const initials = this.getInitials(this.settings.user);
        const isAdmin  = parseInt(this.settings.level, 10) === 1;

        const navbarHtml = `
            ${this.styles()}
            <nav class="navbar-main border-bottom w-full px-4 py-2 h-16 flex items-center justify-between">
                <div class="flex items-center space-x-2">
                    <button id="btn-mobile-menu" class="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition" title="Menú">
                        <i data-lucide="menu" class="w-6 h-6"></i>
                    </button>
                    <span class='navbar-title text-xl font-bold'>${this.settings.negocio || this.settings.company}</span>
                </div>

                <div class="flex items-center gap-2">
                    ${isAdmin ? `
                    <button id="btnAdmin" class="nav-admin-btn hidden sm:flex items-center gap-1.5" title="Administración">
                        <i data-lucide="shield" class="w-4 h-4"></i>
                        <span class="text-sm font-medium">Admin</span>
                    </button>` : ''}

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
                    <!-- Negocio -->
                    <div class="px-4 pt-4 pb-3">
                        <p class="nav-dd-label">Negocio</p>
                        <div class="flex items-center gap-2.5 mt-1.5">
                            <div class="nav-biz-icon"><i data-lucide="building-2" class="w-4 h-4"></i></div>
                            <span class="nav-biz-name">${this.settings.negocio || '—'}</span>
                        </div>
                    </div>

                    <div class="nav-divider"></div>

                    <!-- Sesión activa -->
                    <div class="px-3 py-3">
                        <p class="nav-dd-label px-1 mb-2">Sesión iniciada</p>
                        <div class="nav-account-card active">
                            <div class="nav-acc-avatar">${initials}</div>
                            <div class="flex-1 min-w-0">
                                <p class="nav-acc-name">${this.settings.user}</p>
                                <p class="nav-acc-rol">${this.settings.rol || 'Sin rol'}</p>
                            </div>
                            <i data-lucide="check" class="nav-check w-5 h-5"></i>
                        </div>
                    </div>

                    <div class="nav-divider"></div>

                    <!-- Acciones -->
                    <div class="px-4 py-3">
                        <button id="btnLogout" class="nav-logout-btn">
                            <i data-lucide="log-out" class="w-4 h-4"></i>
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.parent.prepend(navbarHtml);

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    styles() {
        if (document.getElementById('navbarUserStyles')) return '';
        return `
        <style id="navbarUserStyles">
            .nav-admin-btn { background:#1C64F2; color:#fff; padding:6px 12px; border-radius:10px; transition:all .15s ease; }
            .nav-admin-btn:hover { background:#1A56DB; }
            .nav-user-pill { padding:4px 8px; border-radius:12px; transition:all .15s ease; }
            .nav-user-pill:hover { background:rgba(124,58,237,.10); }
            .nav-avatar { width:38px; height:38px; border-radius:9999px; background:linear-gradient(135deg,#7C3AED 0%,#EC4899 100%); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:13px; letter-spacing:.5px; box-shadow:0 4px 12px rgba(124,58,237,.35); }
            .nav-user-name { font-size:13px; font-weight:600; color:#111827; }
            .nav-user-rol  { font-size:11px; color:#6B7280; }
            body.dark-mode .nav-user-name { color:#F9FAFB; }
            .nav-chevron { color:#9CA3AF; transition:transform .2s ease; }
            #btnUserMenu.open .nav-chevron { transform:rotate(180deg); }

            .nav-dropdown { background:#FFFFFF; border:1px solid #E5E7EB; border-radius:16px; box-shadow:0 12px 32px rgba(0,0,0,.12); transition:all .25s ease; transform-origin:top right; }
            .nav-dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.12em; color:#6B7280; font-weight:600; }
            .nav-biz-icon { width:34px; height:34px; border-radius:10px; background:rgba(124,58,237,.10); border:1px solid rgba(124,58,237,.20); display:flex; align-items:center; justify-content:center; color:#7C3AED; }
            .nav-biz-name { font-size:15px; font-weight:700; color:#111827; }
            .nav-divider { height:1px; background:#E5E7EB; }

            .nav-account-card { display:flex; align-items:center; gap:12px; padding:10px; border-radius:12px; border:1px solid transparent; transition:all .15s ease; }
            .nav-account-card.active { background:linear-gradient(135deg,rgba(124,58,237,.08) 0%,rgba(236,72,153,.05) 100%); border-color:rgba(168,85,247,.25); }
            .nav-acc-avatar { width:40px; height:40px; border-radius:9999px; background:linear-gradient(135deg,#7C3AED 0%,#EC4899 100%); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:14px; box-shadow:0 4px 12px rgba(124,58,237,.35); flex-shrink:0; }
            .nav-acc-name { font-size:14px; font-weight:700; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .nav-acc-rol  { font-size:12px; color:#6B7280; }
            .nav-check { color:#16A34A; flex-shrink:0; }

            .nav-logout-btn { width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:9px; border:1px solid #ef4444; color:#ef4444; border-radius:12px; font-weight:600; font-size:14px; transition:all .15s ease; }
            .nav-logout-btn:hover { background:#dc2626; color:#fff; }
        </style>`;
    }

    initEvents() {
        $("#btnUserMenu").on("click", (e) => {
            e.stopPropagation();
            this.toggleUserMenu();
        });
        $("#btnLogout").on("click", () => this.logout());
        $("#btnAdmin").on("click", () => window.location.href = "/inventory/admin/");

        $(document).on("click", (e) => {
            if (!$(e.target).closest("#btnUserMenu, #userMenuDropdown").length) {
                this.closeUserMenu();
            }
        });
    }

    toggleUserMenu() {
        $("#userMenuDropdown").toggleClass("opacity-0 scale-95 invisible");
        $("#btnUserMenu").toggleClass("open");
    }

    closeUserMenu() {
        $("#userMenuDropdown").addClass("opacity-0 scale-95 invisible");
        $("#btnUserMenu").removeClass("open");
    }

    logout() {
        Swal.fire({
            title: "¿Está seguro?",
            text: "Está a punto de cerrar su sesión actual.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Cerrar sesión",
            cancelButtonText: "Cancelar",
            customClass: {
                popup: "rounded-lg shadow-lg",
                title: "text-2xl font-semibold",
                confirmButton: "py-2 px-4 rounded",
                cancelButton: "bg-secondary border border-gray-500 py-2 px-4 rounded hover:bg-[#555555]",
            },
            background: "#ffff",
            allowOutsideClick: false,
            allowEscapeKey: false,
        }).then((result) => {
            if (result.isConfirmed) window.location.href = "../../salir";
        });
    }
}

$(async () => {
    const data = await useFetch({ url: "../../acceso/ctrl/ctrl-access.php", data: { opc: 'company' } });

    level = data.level;

    let navbar = new Navbar();
    navbar.init({
        user:    data.user    || 'Usuario',
        rol:     data.rol     || '',
        negocio: data.negocio || data.udn || '',
        company: data.udn     || '',
        level:   data.level   || 0,
        parent:  "#menu-navbar",
    });
});
