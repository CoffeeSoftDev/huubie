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
            email:    "",
            rol:      "",
            negocio:  "",
            sucursal: "",
            level:    0,
            parent:   "body",
            branches: [],
            current:  null,
        };

        this.settings = Object.assign({}, defaults, options);
        this.parent   = $(this.settings.parent);
        level = this.settings.level;

        const initials = this.getInitials(this.settings.user);
        const isAdmin  = parseInt(this.settings.level, 10) === 1;
        const isDark   = localStorage.getItem("darkMode") === "true";

        const navbarHtml = `
            ${this.styles()}
            <nav class="navbar-main border-bottom w-full px-4 py-2 h-16 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <button id="btn-mobile-menu" class="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition" title="Menú">
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

                    ${isAdmin ? `
                    <button id="btnAdmin" class="nav-admin-btn hidden sm:flex items-center gap-1.5" title="Administración">
                        <i data-lucide="shield" class="w-4 h-4"></i>
                        <span class="text-sm font-medium">Admin</span>
                    </button>` : ''}

                    <button id="btnThemeToggle" class="nav-theme-toggle" title="Cambiar tema claro/oscuro">
                        <i data-lucide="${isDark ? 'sun' : 'moon'}" class="w-[18px] h-[18px]"></i>
                    </button>

                    <button id="btnModulos" class="nav-theme-toggle" title="Módulos">
                        <i data-lucide="layout-grid" class="w-[18px] h-[18px]"></i>
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
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.parent.prepend(navbarHtml);

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    branchPillHtml() {
        const branches = this.settings.branches || [];
        const current  = this.settings.current || { id: 0, name: this.settings.sucursal || '' };
        const multi    = branches.length > 1;

        if (branches.length === 0 && !current.name) return '';

        const chevron = multi
            ? `<i data-lucide="chevron-down" class="branch-pill-chev w-4 h-4"></i>`
            : '';

        const dropdown = multi ? `
            <div id="branchDropdown" class="branch-dd" style="display:none;">
                <div class="branch-dd-head">
                    <div>
                        <p class="branch-dd-label">Cambiar sucursal</p>
                        <p class="text-[11px] text-gray-400 mt-0.5">${this.settings.company || ''}</p>
                    </div>
                    <button id="btnBranchClose" class="branch-dd-close">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        Cerrar
                    </button>
                </div>
                <div class="p-2 space-y-1.5 max-h-[320px] overflow-y-auto">
                    ${branches.map((b, i) => this.branchCardHtml(b, i)).join('')}
                </div>
            </div>` : '';

        return `
        <div class="relative">
            <button id="btnBranch" class="branch-pill flex items-center gap-2.5 ${multi ? '' : 'branch-pill-static'}" aria-expanded="false" ${multi ? '' : 'disabled'}>
                <span class="branch-pill-icon"><i data-lucide="building-2" class="w-[18px] h-[18px]"></i></span>
                <div class="flex flex-col items-start leading-tight">
                    <span class="branch-pill-label">Sucursal</span>
                    <span id="btnBranchName" class="branch-pill-name">${current.name || 'Seleccionar'}</span>
                </div>
                ${chevron}
            </button>
            ${dropdown}
        </div>`;
    }

    branchCardHtml(branch, index) {
        const gradients = [
            'linear-gradient(135deg,#C05A40 0%,#E8A68F 100%)',
            'linear-gradient(135deg,#A84A33 0%,#C05A40 100%)',
            'linear-gradient(135deg,#D97060 0%,#F0B89A 100%)',
            'linear-gradient(135deg,#8B3A28 0%,#C05A40 100%)',
            'linear-gradient(135deg,#E07050 0%,#F5C4A8 100%)',
        ];
        const grad     = gradients[index % gradients.length];
        const selClass = branch.selected ? 'branch-card-sel' : '';

        return `
        <div class="branch-card ${selClass}" data-id="${branch.id}" data-name="${branch.name}">
            <div class="flex items-center gap-2.5">
                <div class="branch-card-avatar" style="background:${grad};">${branch.initials || ''}</div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                        <p class="text-[13px] font-bold text-gray-800 truncate">${branch.name}</p>
                        <div class="branch-radio"><div class="branch-radio-inner"></div></div>
                    </div>
                    <p class="text-[11px] text-gray-400 mt-0.5 truncate">${branch.ubication || 'Sin direccion'}</p>
                </div>
            </div>
        </div>`;
    }

    styles() {
        if (document.getElementById('navbarUserStyles')) return '';
        return `
        <style id="navbarUserStyles">
            /* ── Navbar estilo Visor — acento terracota #C05A40 ── */
            .navbar-main { background:#FFFFFF; border-bottom:1px solid rgba(192,90,64,.22) !important; }

            .nav-logo { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,#C05A40 0%,#E8A68F 100%); display:flex; align-items:center; justify-content:center; color:#fff; box-shadow:0 4px 12px rgba(192,90,64,.35); flex-shrink:0; }
            .navbar-title { font-size:15px; font-weight:700; color:#111827; line-height:1.15; }
            .navbar-subtitle { font-size:10px; color:#9CA3AF; letter-spacing:.12em; text-transform:uppercase; }

            .nav-admin-btn { background:rgba(192,90,64,.10); color:#A84A33; border:1px solid rgba(192,90,64,.22); padding:6px 12px; border-radius:10px; transition:all .15s ease; }
            .nav-admin-btn:hover { background:#C05A40; color:#fff; border-color:#C05A40; }

            /* Solo ícono (sin recuadro de botón): sin borde ni fondo, hover de color. */
            .nav-theme-toggle { width:38px; height:38px; display:flex; align-items:center; justify-content:center; color:#6B7280; border:none; background:transparent; cursor:pointer; transition:color .15s ease; }
            .nav-theme-toggle:hover { color:#111827; }
            body.dark-mode .nav-theme-toggle { color:#9CA3AF; }
            body.dark-mode .nav-theme-toggle:hover { color:#F9FAFB; }

            /* ── Pill de sucursal (selector en la navbar, estilo app/) ── */
            .branch-pill { padding:4px 10px; border:1px solid rgba(192,90,64,.28); border-radius:10px; background:rgba(192,90,64,.06); transition:all .15s ease; cursor:pointer; }
            .branch-pill:hover { border-color:#C05A40; background:rgba(192,90,64,.12); }
            .branch-pill.branch-pill-static { cursor:default; }
            .branch-pill.branch-pill-static:hover { border-color:rgba(192,90,64,.28); background:rgba(192,90,64,.06); }
            .branch-pill-icon { width:30px; height:30px; border-radius:8px; background:rgba(192,90,64,.12); display:flex; align-items:center; justify-content:center; color:#C05A40; flex-shrink:0; }
            .branch-pill-label { font-size:9px; text-transform:uppercase; letter-spacing:.14em; color:#9CA3AF; font-weight:600; }
            .branch-pill-name { font-size:13px; font-weight:700; color:#111827; max-width:140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .branch-pill-chev { color:#9CA3AF; transition:transform .2s ease; }
            #btnBranch[aria-expanded="true"] .branch-pill-chev { transform:rotate(180deg); }

            .branch-dd { position:absolute; right:0; top:calc(100% + 10px); width:300px; background:#FFFFFF; border:1px solid rgba(192,90,64,.22); border-radius:14px; box-shadow:0 16px 40px rgba(17,24,39,.16); z-index:60; }
            .branch-dd-head { display:flex; align-items:flex-start; justify-content:space-between; padding:12px 14px 10px; border-bottom:1px solid #F3F4F6; }
            .branch-dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.12em; color:#C05A40; font-weight:700; }
            .branch-dd-close { display:flex; align-items:center; gap:4px; font-size:11px; color:#9CA3AF; padding:4px 8px; border-radius:8px; transition:all .15s ease; }
            .branch-dd-close:hover { color:#111827; background:#F3F4F6; }
            .branch-card { background:#FAFAFA; border:1px solid #E5E7EB; border-radius:10px; padding:8px 10px; cursor:pointer; transition:all .15s ease; }
            .branch-card:hover { border-color:rgba(192,90,64,.40); background:#FFF5F3; }
            .branch-card-sel { background:rgba(192,90,64,.07); border-color:#C05A40; box-shadow:0 0 0 1px rgba(192,90,64,.20); }
            .branch-card-avatar { width:28px; height:28px; border-radius:9999px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:10px; letter-spacing:.5px; color:#fff; box-shadow:0 4px 10px rgba(192,90,64,.30); flex-shrink:0; }
            .branch-radio { width:16px; height:16px; border-radius:9999px; border:2px solid #D1D5DB; display:flex; align-items:center; justify-content:center; transition:all .2s ease; flex-shrink:0; }
            .branch-card-sel .branch-radio { border-color:#C05A40; }
            .branch-radio-inner { width:7px; height:7px; border-radius:9999px; background:#C05A40; opacity:0; transition:opacity .2s ease; }
            .branch-card-sel .branch-radio-inner { opacity:1; }

            .nav-user-pill { padding:4px 8px 4px 13px; border:1px solid transparent; border-left:1px solid #E5E7EB; border-radius:8px; transition:all .15s ease; }
            .nav-user-pill:hover { background:#F3F4F6; border-color:#E5E7EB; }
            .nav-avatar { width:38px; height:38px; border-radius:9999px; background:#C05A40; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:13px; letter-spacing:.5px; box-shadow:0 4px 12px rgba(192,90,64,.32); }
            .nav-user-name { font-size:13px; font-weight:600; color:#111827; }
            .nav-user-rol  { font-size:11px; color:#6B7280; }
            .nav-chevron { color:#9CA3AF; transition:transform .2s ease; }
            #btnUserMenu.open .nav-chevron { transform:rotate(180deg); }

            .nav-dropdown { background:#FFFFFF; border:1px solid #E5E7EB; border-radius:16px; box-shadow:0 14px 38px rgba(17,24,39,.14); transition:all .22s ease; transform-origin:top right; overflow:hidden; }
            .nav-dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.12em; color:#9CA3AF; font-weight:600; }
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

            /* ── Soporte dark-mode ── */
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
            body.dark-mode .branch-dd { background:#1F2A37; border-color:rgba(192,90,64,.30); box-shadow:0 16px 40px rgba(0,0,0,.45); }
            body.dark-mode .branch-dd-head { border-bottom-color:rgba(55,65,81,.6); }
            body.dark-mode .branch-card { background:rgba(255,255,255,.04); border-color:rgba(55,65,81,.6); }
            body.dark-mode .branch-card:hover { background:rgba(192,90,64,.10); border-color:rgba(192,90,64,.40); }
            body.dark-mode .branch-card-sel { background:rgba(192,90,64,.15); border-color:#C05A40; }
            body.dark-mode .branch-card p.text-gray-800 { color:#F9FAFB; }
            body.dark-mode .branch-dd-close { color:#6B7280; }
            body.dark-mode .branch-dd-close:hover { color:#F9FAFB; background:rgba(255,255,255,.06); }
        </style>`;
    }

    initEvents() {
        $("#btnUserMenu").on("click", (e) => {
            e.stopPropagation();
            this.toggleUserMenu();
        });
        $("#btnLogout").on("click", () => this.logout());
        $("#btnModulos").on("click", () => {
            const base = window.location.pathname.split('/inventory/')[0];
            window.location.href = `${base}/inventory/modulos/`;
        });
        $("#btnAdmin").on("click", () => window.location.href = "/inventory/admin/");
        $("#btnThemeToggle").on("click", () => this.toggleTheme());

        $("#btnBranch").on("click", (e) => {
            e.stopPropagation();
            this.toggleBranchDropdown();
        });
        $(document).on("click", "#btnBranchClose", (e) => {
            e.stopPropagation();
            this.closeBranchDropdown();
        });
        $(document).on("click", ".branch-card", (e) => {
            const card = e.currentTarget;
            this.selectBranch(card.getAttribute("data-id"), card.getAttribute("data-name"), card);
        });

        $(document).on("click", (e) => {
            if (!$(e.target).closest("#btnUserMenu, #userMenuDropdown").length) {
                this.closeUserMenu();
            }
            if (!$(e.target).closest("#btnBranch, #branchDropdown").length) {
                this.closeBranchDropdown();
            }
        });
    }

    toggleBranchDropdown() {
        const btn = document.getElementById("btnBranch");
        const dd  = document.getElementById("branchDropdown");
        if (!btn || !dd) return;
        const expanded = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", !expanded);
        dd.style.display = expanded ? "none" : "block";
    }

    closeBranchDropdown() {
        const btn = document.getElementById("btnBranch");
        const dd  = document.getElementById("branchDropdown");
        if (btn) btn.setAttribute("aria-expanded", "false");
        if (dd)  dd.style.display = "none";
    }

    async selectBranch(id, name, cardEl) {
        if (cardEl.classList.contains("branch-card-sel")) {
            this.closeBranchDropdown();
            return;
        }

        const invBase  = window.location.pathname.split('/inventory/')[0];
        const response = await useFetch({
            url:  `${invBase}/inventory/acceso/ctrl/ctrl-access.php`,
            data: { opc: 'switchBranch', id: id }
        });

        if (response.status != 200) {
            Swal.fire({
                icon:              'error',
                title:             'No se pudo cambiar de sucursal',
                text:              response.message || 'Inténtalo nuevamente.',
                confirmButtonText: 'Ok',
            });
            return;
        }

        $("#btnBranchName").text(name);
        this.closeBranchDropdown();

        document.dispatchEvent(new CustomEvent('branchChanged', {
            detail: { id: parseInt(id, 10), name }
        }));

        window.location.reload();
    }

    toggleTheme() {
        const isDark = $("body").toggleClass("dark-mode").hasClass("dark-mode");
        localStorage.setItem("darkMode", isDark ? "true" : "false");
        $("#btnThemeToggle").html(`<i data-lucide="${isDark ? 'sun' : 'moon'}" class="w-[18px] h-[18px]"></i>`);
        if (typeof lucide !== 'undefined') lucide.createIcons();
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
            if (result.isConfirmed) {
                const base = window.location.pathname.split('/inventory/')[0];
                window.location.href = `${base}/inventory/salir`;
            }
        });
    }
}

$(async () => {
    const invBase = window.location.pathname.split('/inventory/')[0];
    const ctrlUrl = `${invBase}/inventory/acceso/ctrl/ctrl-access.php`;

    const data = await useFetch({ url: ctrlUrl, data: { opc: 'company' } });
    level = data.level;

    const branchInfo = await useFetch({ url: ctrlUrl, data: { opc: 'branches' } });
    const branches   = branchInfo?.branches || [];
    const company    = branchInfo?.company  || data.udn || '';
    const current    = branchInfo?.current  || { id: data.branch_id, name: data.sucursal || data.branch || '' };

    const navbar = new Navbar();
    navbar.init({
        user:     data.user     || 'Usuario',
        email:    data.email    || '',
        rol:      data.rol      || '',
        negocio:  data.negocio  || data.udn || '',
        company:  company,
        sucursal: data.sucursal || data.branch || '',
        level:    data.level    || 0,
        parent:   "#menu-navbar",
        branches: branches,
        current:  current,
    });
});
