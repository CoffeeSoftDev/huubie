let level = 0;

class Navbar {
    /* -- Temas --
       El catálogo real vive en `fayxzvov_erp.themes` y llega en options.themes.
       Este fallback solo entra si la petición falla: sin él la barra se quedaría
       sin acento y sin selector. */
    static get THEME_FALLBACK() {
        return { code: 'light', name: 'Claro', color: '#F3F4F6', accent: '#C05A40', mode: 'light', badge: '' };
    }

    // Copia local del tema elegido. Se aplica antes de que conteste el servidor
    // para que la barra no parpadee con el acento del tema anterior.
    static get THEME_KEY() { return 'inventory:theme'; }

    init(options) {
        this.render(options);
        this.initEvents();
        this.buildThemeList();
        this.applyTheme(this.settings.theme);
    }

    /* El color del usuario (users.color) pintando su avatar. Sin color elegido
       se devuelve cadena vacía y manda el gris del CSS. */
    avatarStyle(color) {
        const hex = /^#[0-9A-Fa-f]{6}$/.test(color || '') ? color : '';

        return hex === '' ? '' : `background:${hex};`;
    }

    /* Qué va dentro del avatar: la foto del usuario si tiene, y si no el ícono
       blanco. El color de atrás sigue siendo suyo, así que el respaldo no es un
       gris anónimo: se distingue de quién es aunque no haya subido nada. */
    avatarHtml() {
        const photo = this.settings.photo || '';

        return photo !== ''
             ? `<img src="${photo}" alt="">`
             : `<i data-lucide="user"></i>`;
    }

    render(options) {
        const defaults = {
            company:  "N/A",
            user:     "Usuario",
            email:    "",
            color:    "",
            photo:    "",
            rol:      "",
            negocio:  "",
            sucursal: "",
            level:    0,
            parent:   "body",
            branches: [],
            current:  null,
            themes:   [],
            theme:    Navbar.THEME_FALLBACK.code,
        };

        this.settings = Object.assign({}, defaults, options);
        this.parent   = $(this.settings.parent);
        level = this.settings.level;

        const avatarHtml  = this.avatarHtml();
        const avatarStyle = this.avatarStyle(this.settings.color);

        const navbarHtml = `
            ${this.styles()}
            <nav class="navbar-main border-bottom w-full px-4 py-2 h-16 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <button id="btn-mobile-menu" class="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition" title="Menú">
                        <i data-lucide="menu" class="w-6 h-6"></i>
                    </button>
                    <div class="flex flex-col leading-tight">
                        <span class="navbar-title">CoffeeSoft</span>
                        <span class="navbar-subtitle">${this.settings.negocio || this.settings.company}</span>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    ${this.branchPillHtml()}

                    <div class="relative">
                        <button id="btnTheme" class="nav-theme-toggle" title="Tema" aria-expanded="false">
                            <i data-lucide="palette" class="w-[18px] h-[18px]"></i>
                        </button>
                        <div id="navColorMenu" class="nav-color-menu hidden">
                            <div id="navColorList"></div>
                        </div>
                    </div>

                    <button id="btnModulos" class="nav-theme-toggle" title="Módulos">
                        <i data-lucide="layout-grid" class="w-[18px] h-[18px]"></i>
                    </button>

                    <button id="btnUserMenu" class="nav-user-pill flex items-center gap-2.5">
                        <div class="nav-avatar" style="${avatarStyle}">${avatarHtml}</div>
                        <div class="hidden sm:flex flex-col items-start leading-tight">
                            <span class="nav-user-name">${this.settings.user}</span>
                        </div>
                        <i data-lucide="chevron-down" class="nav-chevron w-4 h-4"></i>
                    </button>
                </div>
            </nav>

            <div class="relative z-50">
                <div id="userMenuDropdown" class="nav-dropdown absolute right-3 mt-2 w-72 opacity-0 scale-95 invisible">
                    <div class="nav-user-head">
                        <div class="nav-head-avatar" style="${avatarStyle}">
                            ${avatarHtml}
                            <span class="nav-status-dot"></span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="nav-head-name">${this.settings.user}</p>
                            ${this.settings.rol ? `<p class="nav-user-rol">${this.settings.rol}</p>` : ''}
                            <p class="nav-head-email">${this.settings.email || ''}</p>
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
            /* ── Acento por tema ──
               Los tres temas son CLAROS y comparten la barra blanca: lo único
               que cambia es el acento, así que vive en variables y las reglas
               de abajo las consumen. Un tema nuevo = un bloque de 6 líneas
               aquí, no repintar veinte reglas. */

            /* Claro: el de siempre en inventory (Arcilla Invernal). */
            :root, :root[data-theme="light"] {
                --nav-accent:      #C05A40;
                --nav-accent-soft: #E8A68F;
                --nav-accent-deep: #8e3f2c;
                --nav-accent-tint: rgba(192,90,64,.12);
                --nav-accent-line: rgba(192,90,64,.28);
                --nav-accent-glow: rgba(192,90,64,.35);
            }

            /* Agents: shadcn neutro de erp-pro/ERP24/agents. Ahí el acento NO es
               un color sino el contraste — un casi negro sobre blanco—, por eso
               esta rampa es de grises y no un descuido. */
            :root[data-theme="agents"] {
                --nav-accent:      #171717;
                --nav-accent-soft: #404040;
                --nav-accent-deep: #0D0D0D;
                --nav-accent-tint: rgba(23,23,23,.06);
                --nav-accent-line: #E5E5E5;
                --nav-accent-glow: rgba(23,23,23,.16);
            }

            /* Avatar: claro con violeta, de erp-pro/ERP24/avatars. */
            :root[data-theme="avatar"] {
                --nav-accent:      #7C3AED;
                --nav-accent-soft: #6D28D9;
                --nav-accent-deep: #5B21B6;
                --nav-accent-tint: rgba(124,58,237,.10);
                --nav-accent-line: rgba(124,58,237,.22);
                --nav-accent-glow: rgba(124,58,237,.28);
            }

            /* ── Navbar estilo Visor ── */
            .navbar-main { background:#FFFFFF; border-bottom:1px solid var(--nav-accent-line) !important; }

            .nav-logo { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,var(--nav-accent) 0%,var(--nav-accent-soft) 100%); display:flex; align-items:center; justify-content:center; color:#fff; box-shadow:0 4px 12px var(--nav-accent-glow); flex-shrink:0; }
            .navbar-title { font-size:15px; font-weight:700; color:#111827; line-height:1.15; }
            .navbar-subtitle { font-size:10px; color:#9CA3AF; letter-spacing:.12em; text-transform:uppercase; }


            /* Solo ícono (sin recuadro de botón): sin borde ni fondo, hover de color. */
            .nav-theme-toggle { width:38px; height:38px; display:flex; align-items:center; justify-content:center; color:#6B7280; border:none; background:transparent; cursor:pointer; transition:color .15s ease; }
            .nav-theme-toggle:hover { color:#111827; }
            body.dark-mode .nav-theme-toggle { color:#9CA3AF; }
            body.dark-mode .nav-theme-toggle:hover { color:#F9FAFB; }
            .nav-theme-toggle[aria-expanded="true"] { color:var(--nav-accent); }

            /* ── Pill de sucursal (selector en la navbar, estilo app/) ── */
            .branch-pill { padding:4px 10px; border:1px solid var(--nav-accent-line); border-radius:10px; background:var(--nav-accent-tint); transition:all .15s ease; cursor:pointer; }
            .branch-pill:hover { border-color:var(--nav-accent); background:var(--nav-accent-tint); }
            .branch-pill.branch-pill-static { cursor:default; }
            .branch-pill.branch-pill-static:hover { border-color:var(--nav-accent-line); background:var(--nav-accent-tint); }
            .branch-pill-icon { width:30px; height:30px; border-radius:8px; background:var(--nav-accent-tint); display:flex; align-items:center; justify-content:center; color:var(--nav-accent); flex-shrink:0; }
            .branch-pill-label { font-size:9px; text-transform:uppercase; letter-spacing:.14em; color:#9CA3AF; font-weight:600; }
            .branch-pill-name { font-size:13px; font-weight:700; color:#111827; max-width:140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .branch-pill-chev { color:#9CA3AF; transition:transform .2s ease; }
            #btnBranch[aria-expanded="true"] .branch-pill-chev { transform:rotate(180deg); }

            .branch-dd { position:absolute; right:0; top:calc(100% + 10px); width:300px; background:#FFFFFF; border:1px solid var(--nav-accent-line); border-radius:14px; box-shadow:0 16px 40px rgba(17,24,39,.16); z-index:60; }
            .branch-dd-head { display:flex; align-items:flex-start; justify-content:space-between; padding:12px 14px 10px; border-bottom:1px solid #F3F4F6; }
            .branch-dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.12em; color:var(--nav-accent); font-weight:700; }
            .branch-dd-close { display:flex; align-items:center; gap:4px; font-size:11px; color:#9CA3AF; padding:4px 8px; border-radius:8px; transition:all .15s ease; }
            .branch-dd-close:hover { color:#111827; background:#F3F4F6; }
            .branch-card { background:#FAFAFA; border:1px solid #E5E7EB; border-radius:10px; padding:8px 10px; cursor:pointer; transition:all .15s ease; }
            .branch-card:hover { border-color:var(--nav-accent-line); background:var(--nav-accent-tint); }
            .branch-card-sel { background:var(--nav-accent-tint); border-color:var(--nav-accent); box-shadow:0 0 0 1px var(--nav-accent-line); }
            .branch-card-avatar { width:28px; height:28px; border-radius:9999px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:10px; letter-spacing:.5px; color:#fff; box-shadow:0 4px 10px var(--nav-accent-glow); flex-shrink:0; }
            .branch-radio { width:16px; height:16px; border-radius:9999px; border:2px solid #D1D5DB; display:flex; align-items:center; justify-content:center; transition:all .2s ease; flex-shrink:0; }
            .branch-card-sel .branch-radio { border-color:var(--nav-accent); }
            .branch-radio-inner { width:7px; height:7px; border-radius:9999px; background:var(--nav-accent); opacity:0; transition:opacity .2s ease; }
            .branch-card-sel .branch-radio-inner { opacity:1; }

            .nav-user-pill { padding:4px 8px 4px 13px; border:1px solid transparent; border-left:1px solid #E5E7EB; border-radius:8px; transition:all .15s ease; }
            .nav-user-pill:hover { background:#F3F4F6; border-color:#E5E7EB; }
            /* Mismo gris claro que el avatar del perfil (.nav-head-avatar). */
            /* El ícono va SIEMPRE en blanco, así que el fondo por defecto --el de
               quien no tiene color elegido-- es un gris que lo sostenga. */
            .nav-avatar { width:38px; height:38px; border-radius:9999px; background:#9CA3AF; display:flex; align-items:center; justify-content:center; color:#FFFFFF; flex-shrink:0; }
            .nav-avatar svg { width:19px; height:19px; }
            /* La foto se redondea ella misma: con overflow:hidden en el contenedor
               el círculo le cortaría el punto verde de estado al avatar del perfil. */
            .nav-avatar img, .nav-head-avatar img { width:100%; height:100%; border-radius:9999px; object-fit:cover; }
            .nav-user-name { font-size:13px; font-weight:600; color:#111827; }
            .nav-user-rol  { font-size:11px; color:#6B7280; }
            .nav-chevron { color:#9CA3AF; transition:transform .2s ease; }
            #btnUserMenu.open .nav-chevron { transform:rotate(180deg); }

            .nav-dropdown { background:#FFFFFF; border:1px solid #E5E7EB; border-radius:16px; box-shadow:0 14px 38px rgba(17,24,39,.14); transition:all .22s ease; transform-origin:top right; overflow:hidden; }
            .nav-dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.12em; color:#9CA3AF; font-weight:600; }
            .nav-divider { height:1px; background:#E5E7EB; }

            /* Encabezado de usuario */
            .nav-user-head { display:flex; align-items:center; gap:12px; padding:16px; }
            .nav-head-avatar { position:relative; width:46px; height:46px; border-radius:9999px; background:#9CA3AF; display:flex; align-items:center; justify-content:center; color:#FFFFFF; flex-shrink:0; }
            .nav-head-avatar svg { width:23px; height:23px; }
            .nav-status-dot { position:absolute; right:0; bottom:1px; width:12px; height:12px; border-radius:9999px; background:#22C55E; border:2px solid #FFFFFF; }
            .nav-head-name { font-size:15px; font-weight:700; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .nav-head-email { font-size:12.5px; color:#9CA3AF; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

            .nav-logout-btn { width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:11px; border:1px solid #E5E7EB; color:#DC2626; border-radius:12px; font-weight:600; font-size:14px; background:#FFFFFF; transition:all .15s ease; }
            .nav-logout-btn:hover { background:#FEF2F2; border-color:#FECACA; }

            /* ── Selector de temas (estilo del de erp-pro) ── */
            .nav-color-menu { position:absolute; right:0; top:calc(100% + 10px); width:230px; background:#FFFFFF; border:1px solid #E5E7EB; border-radius:14px; box-shadow:0 16px 40px rgba(17,24,39,.16); padding:6px; z-index:60; }
            .nav-color-opt { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px; cursor:pointer; transition:background .15s ease; }
            .nav-color-opt:hover { background:#F3F4F6; }
            /* La muestra va partida en diagonal: arriba el fondo de la barra,
               abajo el acento. Los dos temas oscuros comparten fondo, así que
               un círculo de un solo color los dejaría idénticos. */
            .nav-color-swatch { width:22px; height:22px; border-radius:9999px; border:1px solid rgba(0,0,0,.12); flex-shrink:0; }
            .nav-color-name { font-size:13px; font-weight:600; color:#111827; flex:1; }
            .nav-color-badge { font-size:9px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; padding:2px 6px; border-radius:6px; background:var(--nav-accent-tint); color:var(--nav-accent); }
            .nav-color-check { color:var(--nav-accent); opacity:0; flex-shrink:0; }
            .nav-color-opt.is-active .nav-color-check { opacity:1; }
            .nav-color-opt.is-active { background:var(--nav-accent-tint); }

            /* ── Soporte dark-mode ──
               Base navy compartida por los dos temas oscuros (#141d2b barra,
               #1F2A37 tarjetas); lo único que los separa es --nav-accent, que se
               define arriba. Por eso aquí no hay un solo hex de acento. */
            body.dark-mode .navbar-title,
            body.dark-mode .nav-user-name,
            body.dark-mode .nav-head-name,
            body.dark-mode .branch-pill-name { color:#F9FAFB; }
            body.dark-mode .navbar-subtitle,
            body.dark-mode .nav-dd-label,
            body.dark-mode .nav-chevron,
            body.dark-mode .branch-pill-chev,
            body.dark-mode .branch-pill-label,
            body.dark-mode .nav-user-rol,
            body.dark-mode .nav-head-email { color:#9CA3AF; }

            body.dark-mode .nav-avatar { background:#6B7280; color:#FFFFFF; }
            body.dark-mode .nav-user-pill { border-left-color:rgba(148,163,184,.18); }
            body.dark-mode .nav-user-pill:hover { background:rgba(148,163,184,.10); border-color:rgba(148,163,184,.18); }
            body.dark-mode .nav-dropdown { background:#1F2A37; border-color:rgba(55,65,81,.6); box-shadow:0 14px 38px rgba(0,0,0,.45); }
            body.dark-mode .nav-divider { background:rgba(55,65,81,.6); }
            body.dark-mode .nav-head-avatar { background:#6B7280; color:#FFFFFF; }
            body.dark-mode .nav-status-dot { border-color:#1F2A37; }
            body.dark-mode .nav-logout-btn { background:transparent; border-color:rgba(55,65,81,.6); color:#F87171; }
            body.dark-mode .nav-logout-btn:hover { background:rgba(220,38,38,.12); border-color:rgba(220,38,38,.35); }

            body.dark-mode .nav-color-menu { background:#1F2A37; border-color:rgba(55,65,81,.6); box-shadow:0 16px 40px rgba(0,0,0,.45); }
            body.dark-mode .nav-color-opt:hover { background:rgba(148,163,184,.10); }
            body.dark-mode .nav-color-name { color:#F9FAFB; }

            body.dark-mode .branch-dd { background:#1F2A37; box-shadow:0 16px 40px rgba(0,0,0,.45); }
            body.dark-mode .branch-dd-head { border-bottom-color:rgba(55,65,81,.6); }
            body.dark-mode .branch-card { background:rgba(255,255,255,.04); border-color:rgba(55,65,81,.6); }
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
        $("#btnTheme").on("click", (e) => {
            e.stopPropagation();
            this.toggleThemeMenu();
        });
        $(document).on("click", ".nav-color-opt", (e) => {
            this.selectTheme(e.currentTarget.dataset.code);
        });

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
            if (!$(e.target).closest("#btnTheme, #navColorMenu").length) {
                this.closeThemeMenu();
            }
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

    // -- Selector de temas --

    themeByCode(code) {
        return (this.settings.themes || []).find((t) => t.code === code) || null;
    }

    // Pinta las opciones del menú: muestra de color, nombre, badge opcional y
    // palomita en el activo. La muestra va partida en diagonal (fondo arriba,
    // acento abajo) porque los dos temas oscuros comparten fondo.
    buildThemeList() {
        const themes = this.settings.themes || [];

        // Sin catálogo no hay nada que elegir: se esconde el botón en vez de
        // dejar un menú vacío colgando.
        if (!themes.length) {
            $("#btnTheme").closest(".relative").addClass("hidden");
            return;
        }

        const rows = themes.map((t) => `
            <div class="nav-color-opt ${t.code === this.settings.theme ? 'is-active' : ''}" data-code="${t.code}">
                <span class="nav-color-swatch" style="background:linear-gradient(135deg, ${t.color} 50%, ${t.accent} 50%);"></span>
                <span class="nav-color-name">${t.name}</span>
                ${t.badge ? `<span class="nav-color-badge">${t.badge}</span>` : ''}
                <i data-lucide="check" class="nav-color-check w-4 h-4"></i>
            </div>`).join('');

        $("#navColorList").html(rows);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Estampa el tema. `data-theme` va en el <html> —como en erp-pro/pro— porque
    // de ahí cuelgan los tokens que consumen Tailwind (themes.css) y esta barra.
    // La clase `dark-mode` sigue yendo en el <body>, que es donde la buscan las
    // hojas que solo saben de claro/oscuro.
    applyTheme(code) {
        const theme = this.themeByCode(code) || Navbar.THEME_FALLBACK;
        const dark  = theme.mode === 'dark';

        document.documentElement.setAttribute("data-theme", theme.code);
        $("body")
            .toggleClass("dark-mode", dark)
            .attr("data-bs-theme", dark ? "dark" : "light");

        this.settings.theme = theme.code;

        // `darkMode` se sigue escribiendo: lo leen el sidebar y las páginas que
        // aplican el tema en un script inline, antes de que exista el navbar.
        try {
            localStorage.setItem("darkMode", dark ? "true" : "false");
            localStorage.setItem(Navbar.THEME_KEY, theme.code);
        } catch (e) { /* modo privado: el tema se aplica pero no se recuerda */ }

        $("#navColorList .nav-color-opt").each((_, el) => {
            $(el).toggleClass("is-active", el.dataset.code === theme.code);
        });
    }

    async selectTheme(code) {
        this.applyTheme(code);
        this.closeThemeMenu();

        const invBase = window.location.pathname.split('/inventory/')[0];
        await useFetch({
            url:  `${invBase}/inventory/acceso/ctrl/ctrl-access.php`,
            data: { opc: 'saveTheme', code: code }
        });
    }

    toggleThemeMenu() {
        const open = $("#navColorMenu").hasClass("hidden");
        $("#navColorMenu").toggleClass("hidden", !open);
        $("#btnTheme").attr("aria-expanded", open ? "true" : "false");
    }

    closeThemeMenu() {
        $("#navColorMenu").addClass("hidden");
        $("#btnTheme").attr("aria-expanded", "false");
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

    // El repintado temprano ya lo hace tailwind-theme.js desde el <head>, que es
    // donde hay que hacerlo para que no parpadee. Aquí solo se sincroniza con lo
    // que diga el servidor, más abajo en init().

    const data = await useFetch({ url: ctrlUrl, data: { opc: 'company' } });
    level = data.level;

    const themeInfo = await useFetch({ url: ctrlUrl, data: { opc: 'themes' } });

    const branchInfo = await useFetch({ url: ctrlUrl, data: { opc: 'branches' } });
    const branches   = branchInfo?.branches || [];
    const company    = branchInfo?.company  || data.udn || '';
    const current    = branchInfo?.current  || { id: data.branch_id, name: data.sucursal || data.branch || '' };

    const navbar = new Navbar();
    navbar.init({
        user:     data.user     || 'Usuario',
        email:    data.email    || '',
        color:    data.color    || '',
        photo:    data.photo    || '',
        rol:      data.rol      || '',
        negocio:  data.negocio  || data.udn || '',
        company:  company,
        sucursal: data.sucursal || data.branch || '',
        level:    data.level    || 0,
        parent:   "#menu-navbar",
        branches: branches,
        current:  current,
        themes:   themeInfo?.themes  || [],
        theme:    themeInfo?.current || Navbar.THEME_FALLBACK.code,
    });
});
