let level = 0;

class Navbar {
    /* -- Temas --
       Un tema tiene cuatro partes:
         - la BARRA, como en erp-pro/pro: color plano o imagen de temporada,
           y `mode` decide si su texto va oscuro o claro.
         - el ACENTO (hex): pestañas, chips, selección.
         - el PRIMARIO (hex): los botones principales.
         - el SECUNDARIO (hex): los detalles de esta barra (sucursal,
           selección, checks), el foco y el hover de las cards.
       Los colores los pinta en toda la página window.InventoryPalette
       (src/js/tailwind-theme.js). El fondo de la página no cambia nunca:
       siempre gris. El catálogo vive en `fayxzvov_erp.themes` y se administra
       en tenant/ (Personalización). Este fallback solo entra si la petición
       falla. */
    static get THEME_FALLBACK() {
        return { code: 'light', name: 'Claro', tipo: 'color', color: '#FFFFFF', image: '', accent: '#C05A40', primary: '#292524', secondary: '#C05A40', scheme: 'light', mode: 'light', badge: '' };
    }

    /* El velo de los temas con imagen: la capa translúcida entre la foto y el
       texto. Casi negro y no gris: un gris arrastra el color de la foto hacia
       el gris; uno oscuro la oscurece pero respeta el tono. Valores de erp-pro. */
    static get VEIL_DARK()  { return 'rgba(20, 22, 28, .34)'; }
    static get VEIL_LIGHT() { return 'rgba(255, 255, 255, .55)'; }

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
                            ${this.settings.rol ? `<span class="nav-user-rol">${this.settings.rol}</span>` : ''}
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
        // Tonos de la rampa del secundario, el color de la barra: siguen al tema.
        const gradients = [
            'linear-gradient(135deg,rgb(var(--accent-2-600, 192 90 64)) 0%,rgb(var(--accent-2-300, 232 166 143)) 100%)',
            'linear-gradient(135deg,rgb(var(--accent-2-700, 168 74 51)) 0%,rgb(var(--accent-2-600, 192 90 64)) 100%)',
            'linear-gradient(135deg,rgb(var(--accent-2-500, 200 105 76)) 0%,rgb(var(--accent-2-200, 239 201 188)) 100%)',
            'linear-gradient(135deg,rgb(var(--accent-2-800, 143 61 42)) 0%,rgb(var(--accent-2-600, 192 90 64)) 100%)',
            'linear-gradient(135deg,rgb(var(--accent-2-400, 217 130 106)) 0%,rgb(var(--accent-2-100, 247 227 220)) 100%)',
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
            /* ── Color de la barra ──
               Sale de la rampa del SECUNDARIO del tema (--accent-2-*), que
               escribe window.InventoryPalette: morado en Huubie, azul marino
               en ERP; en los demás es el acento. Respaldo: terracota de Claro. */
            :root {
                --nav-accent:      rgb(var(--accent-2-600, 192 90 64));
                --nav-accent-soft: rgb(var(--accent-2-300, 232 166 143));
                --nav-accent-deep: rgb(var(--accent-2-800, 143 61 42));
                --nav-accent-tint: rgb(var(--accent-2-600, 192 90 64) / .12);
                --nav-accent-line: rgb(var(--accent-2-600, 192 90 64) / .28);
                --nav-accent-glow: rgb(var(--accent-2-600, 192 90 64) / .35);
            }

            /* ── Navbar estilo Visor ──
               El fondo real lo pone applyTheme() en línea; este blanco es el
               del instante antes de aplicarlo. */
            .navbar-main { background:#FFFFFF; border-bottom:1px solid var(--nav-accent-line) !important; transition:background .2s ease; }

            .nav-logo { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,var(--nav-accent) 0%,var(--nav-accent-soft) 100%); display:flex; align-items:center; justify-content:center; color:#fff; box-shadow:0 4px 12px var(--nav-accent-glow); flex-shrink:0; }
            .navbar-title { font-size:15px; font-weight:700; color:#111827; line-height:1.15; }
            .navbar-subtitle { font-size:10px; color:#9CA3AF; letter-spacing:.12em; text-transform:uppercase; }


            /* Botones de ícono redondos, como .nav-tool-btn de erp-pro. */
            .nav-theme-toggle { width:38px; height:38px; display:flex; align-items:center; justify-content:center; color:#6B7280; border:none; background:transparent; cursor:pointer; border-radius:9999px; transition:color .15s ease, background .15s ease; }
            .nav-theme-toggle:hover { color:#111827; background:#F3F4F6; }
            .nav-theme-toggle[aria-expanded="true"] { color:var(--nav-accent); background:var(--nav-accent-tint); }

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
            /* La muestra enseña lo que va a quedar en la barra: el color, o la
               foto si el tema es de imagen. */
            .nav-color-swatch { width:22px; height:22px; border-radius:9999px; border:1px solid rgba(0,0,0,.12); box-shadow:inset 0 0 0 1px rgba(15,23,42,.10); flex-shrink:0; }
            .nav-color-name { font-size:13px; font-weight:600; color:#111827; flex:1; }
            .nav-color-badge { font-size:8.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; padding:2px 6px; border-radius:9999px; background:#7AAB20; color:#FFFFFF; flex-shrink:0; }
            .nav-color-check { color:var(--nav-accent); opacity:0; flex-shrink:0; }
            .nav-color-opt.is-active .nav-color-check { opacity:1; }
            .nav-color-opt.is-active { background:var(--nav-accent-tint); }

            /* ── Barra oscura (mode: dark) ──
               Solo cambia la barra: los desplegables siguen blancos y la
               página sigue gris. Valores de erp-pro. */
            .navbar-main.nav-dark { border-bottom-color:rgba(255,255,255,.12) !important; }
            .navbar-main.nav-dark .navbar-title,
            .navbar-main.nav-dark .nav-user-name,
            .navbar-main.nav-dark .branch-pill-name { color:#F8FAFC; }
            .navbar-main.nav-dark .navbar-subtitle,
            .navbar-main.nav-dark .nav-user-rol,
            .navbar-main.nav-dark .branch-pill-label { color:rgba(255,255,255,.62); }
            .navbar-main.nav-dark .nav-chevron,
            .navbar-main.nav-dark .branch-pill-chev { color:#CBD5E1; }
            .navbar-main.nav-dark .nav-user-pill { border-left-color:rgba(255,255,255,.15); }
            .navbar-main.nav-dark .nav-user-pill:hover { background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.15); }
            .navbar-main.nav-dark .nav-avatar { box-shadow:0 0 0 1px rgba(255,255,255,.25); }
            .navbar-main.nav-dark .branch-pill,
            .navbar-main.nav-dark .branch-pill.branch-pill-static:hover { background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.18); }
            .navbar-main.nav-dark .branch-pill:hover { background:rgba(255,255,255,.14); border-color:rgba(255,255,255,.30); }
            .navbar-main.nav-dark .branch-pill-icon { background:rgba(255,255,255,.14); color:#FFFFFF; }
            .navbar-main.nav-dark .nav-theme-toggle,
            .navbar-main.nav-dark #btn-mobile-menu { color:#CBD5E1; }
            .navbar-main.nav-dark .nav-theme-toggle:hover,
            .navbar-main.nav-dark .nav-theme-toggle[aria-expanded="true"],
            .navbar-main.nav-dark #btn-mobile-menu:hover { color:#FFFFFF; background:rgba(255,255,255,.10); }

            /* ── Barra con imagen (tipo: imagen) ──
               El velo es flojo a propósito para que la foto se vea; lo que
               hace legible el texto es esta sombra. En barra clara la sombra
               va blanca, para separar el texto oscuro de las zonas oscuras. */
            .navbar-main.nav-imagen .navbar-title,
            .navbar-main.nav-imagen .nav-user-name,
            .navbar-main.nav-imagen .branch-pill-name { text-shadow:0 1px 3px rgba(0,0,0,.55); }
            .navbar-main.nav-imagen.nav-dark .navbar-subtitle,
            .navbar-main.nav-imagen.nav-dark .nav-user-rol,
            .navbar-main.nav-imagen.nav-dark .branch-pill-label { color:rgba(255,255,255,.80); text-shadow:0 1px 3px rgba(0,0,0,.5); }
            .navbar-main.nav-imagen:not(.nav-dark) .navbar-title,
            .navbar-main.nav-imagen:not(.nav-dark) .nav-user-name,
            .navbar-main.nav-imagen:not(.nav-dark) .branch-pill-name { text-shadow:0 1px 3px rgba(255,255,255,.85); }
            /* Un ícono de línea fina sobre una foto se pierde: se le da disco. */
            .navbar-main.nav-imagen .nav-theme-toggle { background:rgba(255,255,255,.14); }
            .navbar-main.nav-imagen.nav-dark .nav-theme-toggle { background:rgba(0,0,0,.18); }

            /* ── Desplegables con página oscura (scheme huubie / midnight) ──
               Toman las superficies de dark-mode.css (--dk-*). */
            body.dark-mode .nav-dropdown,
            body.dark-mode .nav-color-menu,
            body.dark-mode .branch-dd { background:var(--dk-card, #1F2A37); border-color:var(--dk-line, #374151); box-shadow:0 16px 40px rgba(0,0,0,.45); }
            body.dark-mode .nav-divider,
            body.dark-mode .branch-dd-head { background-color:transparent; border-color:var(--dk-line, #374151); }
            body.dark-mode .nav-divider { background:var(--dk-line, #374151); }
            body.dark-mode .nav-head-name,
            body.dark-mode .nav-color-name,
            body.dark-mode .branch-card p.text-gray-800 { color:var(--dk-text, #F9FAFB); }
            body.dark-mode .nav-head-email,
            body.dark-mode .nav-user-rol { color:var(--dk-muted, #9CA3AF); }
            body.dark-mode .nav-color-opt:hover,
            body.dark-mode .branch-dd-close:hover { background:var(--dk-hover, #1a2332); }
            body.dark-mode .nav-status-dot { border-color:var(--dk-card, #1F2A37); }
            body.dark-mode .nav-logout-btn { background:transparent; border-color:var(--dk-line, #374151); color:#F87171; }
            body.dark-mode .nav-logout-btn:hover { background:rgba(220,38,38,.12); border-color:rgba(220,38,38,.35); }
            body.dark-mode .branch-card { background:rgba(255,255,255,.04); border-color:var(--dk-line, #374151); }
            /* Como la barra de alpha/pedidos: la sucursal se enciende con el
               secundario al pasar encima, y el avatar sin color propio lo lleva
               de fondo (el color elegido por el usuario va en línea y gana). */
            body.dark-mode .navbar-main .branch-pill:not(.branch-pill-static):hover { border-color:var(--nav-accent); box-shadow:0 0 0 3px var(--nav-accent-tint); }
            body.dark-mode .branch-card:hover { border-color:var(--nav-accent); }
            body.dark-mode .nav-avatar,
            body.dark-mode .nav-head-avatar { background:var(--nav-accent); }
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

    escapeText(text) {
        return (text == null ? '' : String(text)).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    themeImage(theme) {
        return theme.tipo === 'imagen' && theme.image ? theme.image : '';
    }

    themeAccent(theme) {
        return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(theme.accent || '') ? theme.accent : Navbar.THEME_FALLBACK.accent;
    }

    themePrimary(theme) {
        return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(theme.primary || '') ? theme.primary : Navbar.THEME_FALLBACK.primary;
    }

    // Sin secundario propio, la barra sigue al acento, como antes de que existiera.
    themeSecondary(theme) {
        return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(theme.secondary || '') ? theme.secondary : this.themeAccent(theme);
    }

    // Pinta las opciones del menú: muestra, nombre, badge opcional y palomita
    // en el activo. La muestra es un solo color, el que distingue al tema: en
    // los de barra oscura, la barra; en los de barra blanca (Claro, Agents,
    // Avatar) la barra es igual en todos, así que va el acento. Con imagen,
    // la muestra es la foto.
    buildThemeList() {
        const themes = this.settings.themes || [];

        // Sin catálogo no hay nada que elegir: se esconde el botón en vez de
        // dejar un menú vacío colgando.
        if (!themes.length) {
            $("#btnTheme").closest(".relative").addClass("hidden");
            return;
        }

        const rows = themes.map((t) => {
            const image  = this.themeImage(t);
            const tone   = t.mode === 'dark' ? t.color : this.themeAccent(t);
            const swatch = image
                ? `background:url('${image}') center/cover no-repeat, ${t.color};`
                : `background:${tone};`;

            return `
            <div class="nav-color-opt ${t.code === this.settings.theme ? 'is-active' : ''}" data-code="${this.escapeText(t.code)}">
                <span class="nav-color-swatch" style="${swatch}"></span>
                <span class="nav-color-name">${this.escapeText(t.name)}</span>
                ${t.badge ? `<span class="nav-color-badge">${this.escapeText(t.badge)}</span>` : ''}
                <i data-lucide="check" class="nav-color-check w-4 h-4"></i>
            </div>`;
        }).join('');

        $("#navColorList").html(rows);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /* Pinta el tema. La barra, como applyTheme() de erp-pro: un tema de
       imagen va en tres capas —el color de base (se ve mientras carga y queda
       si la foto falla), el velo y la foto—; el velo va como box-shadow
       interior porque se pinta encima del fondo y debajo del contenido.
       `mode: dark` solo aclara el texto de la barra (.nav-dark).
       Acento, primario y fondo de página (`scheme`) los reparte
       InventoryPalette por toda la página y se guardan para que la siguiente
       carga los pinte desde el <head>. */
    applyTheme(code) {
        const theme   = this.themeByCode(code) || Navbar.THEME_FALLBACK;
        const dark    = theme.mode === 'dark';
        const image   = this.themeImage(theme);
        const palette = { accent: this.themeAccent(theme), primary: this.themePrimary(theme), secondary: this.themeSecondary(theme), scheme: theme.scheme || 'light' };
        const $nav    = this.parent.find(".navbar-main");
        const nav     = $nav[0];

        if (window.InventoryPalette) {
            InventoryPalette.apply(palette);
            InventoryPalette.save(palette);
        }

        if (nav) {
            if (image) {
                nav.style.setProperty("background", `url("${image}") center/cover no-repeat, ${theme.color}`, "important");
                nav.style.setProperty("box-shadow", `inset 0 0 0 9999px ${dark ? Navbar.VEIL_DARK : Navbar.VEIL_LIGHT}`, "important");
            } else {
                nav.style.setProperty("background", theme.color, "important");
                nav.style.removeProperty("box-shadow");
            }

            $nav.toggleClass("nav-dark", dark).toggleClass("nav-imagen", !!image);
        }

        this.settings.theme = theme.code;

        $("#navColorList .nav-color-opt").each((_, el) => {
            $(el).toggleClass("is-active", el.dataset.code === theme.code);
        });
    }

    // Los componentes de coffeeSoft se arman una vez con la variante de la
    // página (clara u oscura). Si el tema nuevo cambia eso, lo ya pintado
    // quedaría en la variante vieja: se recarga para rearmarlo todo igual.
    // El cambio corre detrás del aviso "Aplicando tema" (InventoryPalette.loader):
    // primero entra el velo y después se pintan los colores nuevos.
    async selectTheme(code) {
        const wasDark = document.documentElement.classList.contains('dark');
        const theme   = this.themeByCode(code);
        const label   = theme ? theme.name : '';
        const loader  = window.InventoryPalette && InventoryPalette.loader;
        const started = Date.now();

        this.closeThemeMenu();

        if (loader) {
            loader.show(label);
            await new Promise((resolve) => setTimeout(resolve, 180));
        }

        this.applyTheme(code);

        const invBase = window.location.pathname.split('/inventory/')[0];
        try {
            await useFetch({
                url:  `${invBase}/inventory/acceso/ctrl/ctrl-access.php`,
                data: { opc: 'saveTheme', code: code }
            });
        } catch (e) { /* el tema ya se ve; solo no quedó guardado */ }

        if (document.documentElement.classList.contains('dark') !== wasDark) {
            if (loader) loader.carry(label);
            window.location.reload();
            return;
        }

        // Tiempo mínimo en pantalla para que el aviso alcance a leerse.
        if (loader) setTimeout(loader.hide, Math.max(0, 750 - (Date.now() - started)));
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

    // La barra nace ya con el catálogo en la mano: init() la pinta y le aplica
    // el tema en el mismo tick, así que no hay parpadeo que evitar.
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
