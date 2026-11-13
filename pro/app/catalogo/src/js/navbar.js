// -- Barra superior de Catálogo --
// Copia de inventory/acceso/src/js/navbar.js con las rutas de pro (proBase) y el servidor auth/ctrl/ctrl-nav.php.
// La barra de pro (auth/src/js/navbar.js) sigue igual: la usa developer.

let level = 0;

class Navbar {
    /* -- Modos --
       La aplicación solo tiene dos: claro y oscuro. Sus colores viven en
       window.InventoryPalette.MODES (assets/js/tailwind-theme.js) y el de cada
       quien llega con la sesión (ctrl-nav :: session, users.theme_code).
       Navbar.modes() los pasa a la forma de tema que pinta esta barra: color de
       la barra y `mode`, que decide si su texto va claro (.nav-dark) y qué logo
       se ve. Este fallback entra si la página no carga tailwind-theme.js. */
    static get THEME_FALLBACK() {
        return { code: 'light', name: 'Claro', tipo: 'color', color: '#FFFFFF', image: '', accent: '#5030A5', primary: '#5030A5', secondary: '#5030A5', sidebar: '', scheme: 'light', mode: 'light', badge: '' };
    }

    /* El velo de los temas con imagen: la capa translúcida entre la foto y el
       texto. Casi negro y no gris: un gris arrastra el color de la foto hacia
       el gris; uno oscuro la oscurece pero respeta el tono. Valores de erp-pro. */
    static get VEIL_DARK()  { return 'rgba(20, 22, 28, .34)'; }
    static get VEIL_LIGHT() { return 'rgba(255, 255, 255, .55)'; }

    // El color de la barra de cada modo: blanca en claro, bg-header de Huubie UI en oscuro.
    static modes() {
        const modes = window.InventoryPalette && InventoryPalette.MODES;
        if (!modes) return [Navbar.THEME_FALLBACK];

        return [
            Object.assign({ tipo: 'color', color: '#FFFFFF', image: '', mode: 'light', badge: '' }, modes.light),
            Object.assign({ tipo: 'color', color: '#141D2B', image: '', mode: 'dark',  badge: '' }, modes.dark)
        ];
    }

    // -- Rutas de pro --
    // La base sale de la ruta actual para que sirva igual en /pro/ que en /huubie/pro/.
    static proBase() {
        const p = window.location.pathname;
        const i = p.indexOf('/pro/');
        return i >= 0 ? p.slice(0, i + '/pro'.length) : '/pro';
    }

    proBase() {
        return Navbar.proBase();
    }

    ctrlUrl() {
        return `${this.proBase()}/auth/ctrl/ctrl-nav.php`;
    }

    // Una recarga por tema, no más: ver syncScheme(). La misma llave que auth/src/js/navbar.js.
    static get RELOAD_KEY() { return 'huubie:pro:theme-reload'; }

    init(options) {
        // Antes de que nada cambie el tema: con qué variante se pintó la página.
        this.darkAtLoad = document.documentElement.classList.contains('dark');

        this.render(options);
        this.initEvents();
        this.buildThemeList();
        this.applyTheme(this.settings.theme);
        this.syncScheme(this.settings.theme);
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
            superAdmin: false,
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
                <div class="nav-left flex items-center gap-3">
                    <a class="nav-brand-logo" href="${this.homeUrl()}" title="Ir al inicio" aria-label="Ir al inicio">
                        <img class="nav-logo nav-logo-light" src="${this.proBase()}/assets/img/huubie_light.png" alt="Huubie">
                        <img class="nav-logo nav-logo-dark" src="${this.proBase()}/assets/img/huubie.svg" alt="Huubie">
                    </a>
                    <div class="nav-brand-text">
                        <span class="nav-company">${this.escapeText(this.settings.negocio || this.settings.company)}</span>
                    </div>
                </div>

                <div class="nav-right flex items-center gap-2">
                    ${this.branchPillHtml()}

                    <div class="relative nav-tool">
                        <button id="btnTheme" class="nav-theme-toggle nav-hide-compact" title="Tema" aria-expanded="false">
                            <i data-lucide="palette" class="w-[18px] h-[18px]"></i>
                        </button>
                        <div id="navColorMenu" class="nav-color-menu hidden">
                            <div id="navColorList"></div>
                        </div>
                    </div>

                    ${this.settings.superAdmin ? `
                    <button id="btnEmpresas" class="nav-theme-toggle nav-hide-compact" title="Empresas">
                        <i data-lucide="building" class="w-[18px] h-[18px]"></i>
                    </button>` : ''}

                    <!-- Oculto: el logo ya lleva a Módulos. -->
                    <button id="btnModulos" class="nav-theme-toggle" title="Módulos" style="display:none;">
                        <i data-lucide="layout-grid" class="w-[18px] h-[18px]"></i>
                    </button>

                    <!-- Calendario y notificaciones, como la barra de corporativogv.
                         El contenido de cada panel lo pinta renderCalendar() /
                         renderNotifs() al abrirlo. -->
                    <div class="relative nav-tool">
                        <button id="btnCalendar" class="nav-theme-toggle nav-hide-compact" title="Mi calendario" aria-expanded="false">
                            <i data-lucide="calendar-days" class="w-[18px] h-[18px]"></i>
                        </button>
                        <div id="navCalendarPanel" class="nav-panel hidden"></div>
                    </div>

                    <div class="relative">
                        <button id="btnNotifs" class="nav-theme-toggle relative" title="Notificaciones" aria-expanded="false">
                            <i data-lucide="bell" class="w-[18px] h-[18px]"></i>
                            <span id="navNotifCount" class="nav-count hidden">0</span>
                        </button>
                        <div id="navNotifPanel" class="nav-panel hidden"></div>
                    </div>

                    <button id="btnUserMenu" class="nav-user-pill flex items-center gap-2.5">
                        <div class="nav-avatar" style="${avatarStyle}">${avatarHtml}</div>
                        <div class="hidden lg:flex flex-col items-start leading-tight">
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

                    <!-- En el teléfono lo que no cabe en la barra va aquí: Módulos, Empresas,
                         CoffeeIA (solo si el módulo lo trae), Tema y Calendario. -->
                    <div class="md:hidden px-2 pt-2">
                        <button type="button" class="nav-menu-row" data-nav-go="modulos">
                            <i data-lucide="layout-grid" class="w-4 h-4"></i>
                            Módulos
                        </button>
                        ${this.settings.superAdmin ? `
                        <button type="button" class="nav-menu-row" data-nav-go="empresas">
                            <i data-lucide="building" class="w-4 h-4"></i>
                            Empresas
                        </button>` : ''}
                        <button type="button" class="nav-menu-row" data-nav-go="ia" style="display:none;">
                            <i data-lucide="sparkles" class="w-4 h-4"></i>
                            CoffeeIA
                        </button>
                        <button type="button" class="nav-menu-row" data-nav-go="tema">
                            <i data-lucide="palette" class="w-4 h-4"></i>
                            Tema
                        </button>
                        <button type="button" class="nav-menu-row" data-nav-go="calendario">
                            <i data-lucide="calendar-days" class="w-4 h-4"></i>
                            Mi calendario
                        </button>
                    </div>

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
        <div class="nav-branch relative">
            <button id="btnBranch" class="branch-pill flex items-center gap-2.5 ${multi ? '' : 'branch-pill-static'}" aria-expanded="false" ${multi ? '' : 'disabled'}>
                <span class="branch-pill-icon"><i data-lucide="building-2" class="w-[18px] h-[18px]"></i></span>
                <div class="branch-pill-text flex flex-col items-start leading-tight">
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

            .navbar-title { font-size:15px; font-weight:700; color:#111827; line-height:1.15; }
            /* El logo lleva al inicio (los módulos). Uno por modo, igual que en la
               barra de pro (auth/src/js/navbar.js): morado sobre la barra clara,
               blanco sobre la oscura. A su lado, la empresa. */
            .nav-brand-logo { display:flex; align-items:center; flex:none; border-radius:8px; cursor:pointer; transition:opacity .15s ease; }
            .nav-brand-logo:hover { opacity:.8; }
            .nav-brand-logo:focus-visible { outline:2px solid var(--nav-accent); outline-offset:4px; }
            .nav-logo { height:42px; width:auto; display:block; }
            .nav-logo-dark { display:none; }
            .navbar-main.nav-dark .nav-logo-light { display:none; }
            .navbar-main.nav-dark .nav-logo-dark { display:block; }
            .nav-company { display:block; padding-left:12px; border-left:1px solid #E8E3F0; font-size:13px; font-weight:600; color:#16151C; line-height:22px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:240px; }
            .nav-company:empty { display:none; }


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
            .nav-user-name { font-size:13px; font-weight:600; color:#111827; white-space:nowrap; }
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

            .nav-menu-row { width:100%; display:flex; align-items:center; gap:10px; padding:10px 12px; border:none; border-radius:10px; background:transparent; color:#374151; font-size:14px; font-weight:600; text-align:left; transition:background .15s ease; }
            .nav-menu-row:hover { background:#F3F4F6; }

            /* ── Selector de temas (estilo del de erp-pro) ── */
            .nav-color-menu { position:absolute; right:0; top:calc(100% + 10px); width:250px; background:#FFFFFF; border:1px solid #E5E7EB; border-radius:14px; box-shadow:0 16px 40px rgba(17,24,39,.16); padding:6px; z-index:60; }
            .nav-color-opt { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px; cursor:pointer; transition:background .15s ease; }
            .nav-color-opt:hover { background:#F3F4F6; }
            /* La muestra es una ventanita del tema: la barra arriba (su color,
               o la foto si el tema es de imagen), la página abajo y el acento y
               el primario como dos botones. Así se distinguen hasta los que
               comparten barra blanca. La barra va en su propia pieza para que
               la foto se recorte (cover) en vez de estirarse, y el filo va en
               ::after para quedar encima de ella. Igual que en erp-pro/avatars. */
            .nav-color-swatch { position:relative; width:30px; height:22px; border-radius:6px; overflow:hidden; flex-shrink:0; }
            .nav-color-swatch::after { content:""; position:absolute; inset:0; border-radius:inherit; box-shadow:inset 0 0 0 1px rgba(15,23,42,.16); pointer-events:none; }
            .nav-swatch-bar { position:absolute; left:0; right:0; top:0; height:7px; }
            .nav-swatch-acc, .nav-swatch-pri { position:absolute; bottom:4px; height:5px; border-radius:3px; }
            .nav-swatch-acc { left:4px; width:12px; }
            .nav-swatch-pri { right:4px; width:7px; }
            .nav-swatch-side { position:absolute; left:0; top:7px; bottom:0; width:6px; }
            .nav-color-swatch.has-side .nav-swatch-acc { left:9px; width:9px; }
            .nav-color-name { font-size:13px; font-weight:600; color:#111827; flex:1; }
            .nav-color-badge { font-size:8.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; padding:2px 6px; border-radius:9999px; background:#7AAB20; color:#FFFFFF; flex-shrink:0; }
            .nav-color-check { color:var(--nav-accent); opacity:0; flex-shrink:0; }
            .nav-color-opt.is-active .nav-color-check { opacity:1; }
            .nav-color-opt.is-active { background:var(--nav-accent-tint); }

            /* ── Calendario y notificaciones (como la barra de corporativogv) ──
               .nav-panel no declara display: así .hidden (display:none) no
               compite con él por especificidad. */
            .nav-count { position:absolute; top:2px; right:2px; min-width:17px; height:17px; padding:0 4px; border-radius:9999px; background:var(--nav-accent); color:#FFFFFF; font-size:10px; font-weight:700; line-height:17px; text-align:center; box-shadow:0 0 0 2px #FFFFFF; }
            .nav-panel { position:absolute; right:0; top:calc(100% + 10px); width:300px; max-width:92vw; background:#FFFFFF; border:1px solid #E5E7EB; border-radius:14px; box-shadow:0 16px 40px rgba(17,24,39,.16); z-index:60; overflow:hidden; }
            .nav-panel-head { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 14px; border-bottom:1px solid #F3F4F6; }
            .nav-panel-title { font-size:13.5px; font-weight:700; color:#111827; }
            .nav-panel-sub { font-size:11px; color:#9CA3AF; margin-top:1px; }
            .nav-panel-sub::first-letter { text-transform:uppercase; }
            .nav-panel-body { padding:12px 14px; }
            .nav-panel-empty { display:flex; flex-direction:column; align-items:center; gap:6px; text-align:center; color:#9CA3AF; font-size:12px; padding:24px 14px; }
            .nav-panel-empty b { color:#4B5563; font-size:12.5px; }
            /* Avisos: ícono en el acento, qué pasó, el detalle y hace cuánto; el punto
               verde es el de "solicitud nueva" de Mis entregas. Al llegar uno nuevo la
               campana se sacude una vez (.nav-ring). */
            .nav-notif-list { max-height:360px; overflow-y:auto; }
            .nav-notif { display:flex; align-items:flex-start; gap:10px; padding:11px 14px; border-bottom:1px solid #F3F4F6; color:inherit; text-decoration:none; transition:background .15s ease; }
            .nav-notif:last-child { border-bottom:none; }
            .nav-notif:hover { background:#F9FAFB; }
            .nav-notif-ico { width:32px; height:32px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:var(--nav-accent-tint); color:var(--nav-accent); }
            .nav-notif-ico svg { width:16px; height:16px; }
            .nav-notif-tit { display:block; font-size:12.5px; font-weight:700; color:#111827; }
            .nav-notif-txt { display:block; font-size:12px; color:#4B5563; margin-top:1px; }
            .nav-notif-time { display:block; font-size:11px; color:#9CA3AF; margin-top:2px; }
            .nav-notif-dot { width:8px; height:8px; border-radius:9999px; background:#22C55E; flex-shrink:0; margin-top:6px; }
            @keyframes nav-ring { 0%, 100% { transform:rotate(0); } 15% { transform:rotate(14deg); } 30% { transform:rotate(-12deg); } 45% { transform:rotate(9deg); } 60% { transform:rotate(-6deg); } 75% { transform:rotate(3deg); } }
            .nav-ring svg { animation:nav-ring .9s ease; transform-origin:50% 3px; }
            /* Aviso de requisición por revisar: un solo punto en el acento del tema, junto al
               título de la tarjeta, que parpadea suave (sin mover nada más). */
            @keyframes nav-blink { 0%, 100% { opacity:1; } 50% { opacity:.25; } }
            .nav-toast-dot { display:inline-block; width:8px; height:8px; border-radius:9999px; background:var(--nav-accent); margin-right:6px; vertical-align:middle; animation:nav-blink 1.6s ease-in-out infinite; }
            @media (prefers-reduced-motion: reduce) { .nav-toast-dot { animation:none; } }
            .nav-limpiar { border:none; cursor:pointer; font-size:11px; font-weight:600; color:var(--nav-accent); background:var(--nav-accent-tint); border-radius:8px; padding:4px 10px; flex-shrink:0; }
            /* Tarjetas de aviso: al llegar uno nuevo suena y queda una tarjeta fija bajo la
               barra hasta su X o «Ver». Debajo de los modales (z 9999): no tapan sus botones. */
            .nav-toasts { position:fixed; top:70px; right:16px; z-index:9990; display:flex; flex-direction:column; gap:10px; width:390px; max-width:calc(100vw - 32px); pointer-events:none; }
            .nav-toast { pointer-events:auto; display:flex; align-items:center; gap:12px; padding:14px 12px 14px 14px; background:#FFFFFF; border:1px solid #E5E7EB; border-left:4px solid var(--nav-accent); border-radius:12px; box-shadow:0 10px 28px rgba(17,24,39,.16); animation:nav-toast-in .25s ease; }
            @keyframes nav-toast-in { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }
            .nav-toast-ico { width:38px; height:38px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:var(--nav-accent-tint); color:var(--nav-accent); }
            .nav-toast-ico svg { width:19px; height:19px; }
            .nav-toast-body { flex:1; min-width:0; line-height:1.35; }
            .nav-toast-tit { display:block; font-size:14px; font-weight:700; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .nav-toast-tit small { font-size:12px; font-weight:400; color:#9CA3AF; }
            .nav-toast-txt { display:block; margin-top:2px; font-size:13px; color:#4B5563; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .nav-toast-ver { flex-shrink:0; font-size:13px; font-weight:600; color:var(--nav-accent); background:var(--nav-accent-tint); border-radius:8px; padding:6px 14px; text-decoration:none; }
            .nav-toast-ver:hover { color:var(--nav-accent); filter:brightness(.96); }
            .nav-toast-x { border:none; background:transparent; color:#9CA3AF; cursor:pointer; padding:4px; border-radius:8px; display:flex; flex-shrink:0; }
            .nav-toast-x:hover { background:#F3F4F6; color:#111827; }
            .nav-toast-mas { pointer-events:auto; align-self:flex-end; border:1px solid #E5E7EB; cursor:pointer; font-size:12px; color:#4B5563; background:#FFFFFF; border-radius:9999px; padding:4px 12px; box-shadow:0 4px 12px rgba(17,24,39,.08); }
            .cal-nav { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
            .cal-mes { font-size:12.5px; font-weight:700; color:#111827; }
            .cal-mv { border:none; background:transparent; color:#6B7280; cursor:pointer; padding:4px; border-radius:8px; display:flex; }
            .cal-mv:hover { background:#F3F4F6; color:#111827; }
            .cal-hoy { border:none; cursor:pointer; font-size:11px; font-weight:600; color:var(--nav-accent); background:var(--nav-accent-tint); border-radius:8px; padding:4px 10px; }
            .cal-sem, .cal-grid { display:grid; grid-template-columns:repeat(7, 1fr); text-align:center; }
            .cal-sem { font-size:10px; font-weight:700; color:#9CA3AF; margin-bottom:3px; }
            .cal-grid { gap:2px; }
            .cal-d { height:30px; display:flex; align-items:center; justify-content:center; font-size:12px; color:#374151; border-radius:8px; }
            /* Hoy: velo y filo del acento con el número oscuro. Relleno de acento
               con número blanco no se leía con los acentos claros (azul pastel). */
            .cal-d.is-hoy { background:var(--nav-accent-tint); box-shadow:inset 0 0 0 1.5px var(--nav-accent); color:#111827; font-weight:700; }
            /* En el celular el panel va a todo el ancho: anclado al botón se
               salía por la izquierda de la pantalla. */
            @media (max-width: 640px) {
                .nav-panel { position:fixed; left:8px; right:8px; top:68px; width:auto; max-width:none; }
                .nav-toasts { left:8px; right:8px; width:auto; max-width:none; }
            }

            /* ── Barra oscura (mode: dark) ──
               Solo cambia la barra: los desplegables siguen blancos y la
               página sigue gris. Valores de erp-pro. */
            .navbar-main.nav-dark { border-bottom-color:rgba(255,255,255,.12) !important; }
            .navbar-main.nav-dark .nav-company { border-left-color:rgba(255,255,255,.15); }
            .navbar-main.nav-dark .nav-company,
            .navbar-main.nav-dark .nav-user-name,
            .navbar-main.nav-dark .branch-pill-name { color:#F8FAFC; }
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

            /* ── Barra clara con color (mode: light sobre rosa, menta...) ──
               Los grises de arriba son para la barra blanca: sobre un color se
               pierden (#9CA3AF sobre rosa #F5A3B2 da 1.3:1). Aquí van en tinta
               translúcida, que toma el tono de la barra y se lee en cualquier
               color claro (≈5:1 sobre ese rosa); la píldora y los hover, en
               blanco translúcido. Lo enciende applyTheme() (isTintedBar). */
            .navbar-main.nav-tinted { border-bottom-color:rgba(17,24,39,.10) !important; }
            .navbar-main.nav-tinted .navbar-subtitle,
            .navbar-main.nav-tinted .nav-user-rol,
            .navbar-main.nav-tinted .branch-pill-label { color:rgba(17,24,39,.72); }
            .navbar-main.nav-tinted .nav-chevron,
            .navbar-main.nav-tinted .branch-pill-chev,
            .navbar-main.nav-tinted .nav-theme-toggle,
            .navbar-main.nav-tinted #btn-mobile-menu { color:rgba(17,24,39,.78); }
            .navbar-main.nav-tinted .nav-theme-toggle:hover,
            .navbar-main.nav-tinted .nav-theme-toggle[aria-expanded="true"],
            .navbar-main.nav-tinted #btn-mobile-menu:hover { color:#111827; background:rgba(255,255,255,.45); }
            .navbar-main.nav-tinted .nav-user-pill { border-left-color:rgba(17,24,39,.14); }
            .navbar-main.nav-tinted .nav-user-pill:hover { background:rgba(255,255,255,.40); border-color:rgba(17,24,39,.10); }
            .navbar-main.nav-tinted .nav-avatar { box-shadow:0 0 0 2px rgba(255,255,255,.70); }
            /* La píldora de sucursal, como en la barra oscura: vidrio translúcido
               y el ícono en el color del texto (no en el acento), para que se
               lea como parte de la barra y no como un botón pegado encima. */
            .navbar-main.nav-tinted .branch-pill,
            .navbar-main.nav-tinted .branch-pill.branch-pill-static:hover { background:rgba(255,255,255,.22); border-color:rgba(255,255,255,.40); }
            .navbar-main.nav-tinted .branch-pill:hover { background:rgba(255,255,255,.34); border-color:rgba(255,255,255,.60); }
            .navbar-main.nav-tinted .branch-pill-icon { background:rgba(255,255,255,.32); color:rgba(17,24,39,.78); }

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

            /* ── Desplegables con página oscura (scheme huubie / midnight / rose) ──
               Toman las superficies de dark-mode.css (--dk-*). */
            body.dark-mode .nav-dropdown,
            body.dark-mode .nav-color-menu,
            body.dark-mode .branch-dd,
            body.dark-mode .nav-panel { background:var(--dk-card, #1F2A37); border-color:var(--dk-line, #374151); box-shadow:0 16px 40px rgba(0,0,0,.45); }
            body.dark-mode .nav-divider,
            body.dark-mode .branch-dd-head,
            body.dark-mode .nav-panel-head { background-color:transparent; border-color:var(--dk-line, #374151); }
            body.dark-mode .nav-panel-title,
            body.dark-mode .nav-panel-empty b,
            body.dark-mode .cal-mes,
            body.dark-mode .cal-d { color:var(--dk-text, #F9FAFB); }
            body.dark-mode .cal-mv:hover { background:var(--dk-hover, #1a2332); color:var(--dk-text, #F9FAFB); }
            body.dark-mode .nav-notif { border-color:var(--dk-line, #374151); }
            body.dark-mode .nav-notif:hover { background:var(--dk-hover, #1a2332); }
            body.dark-mode .nav-notif-tit { color:var(--dk-text, #F9FAFB); }
            body.dark-mode .nav-notif-txt { color:var(--dk-muted, #9CA3AF); }
            body.dark-mode .nav-count { box-shadow:0 0 0 2px var(--dk-card, #1F2A37); }
            body.dark-mode .nav-divider { background:var(--dk-line, #374151); }
            body.dark-mode .nav-head-name,
            body.dark-mode .nav-color-name,
            body.dark-mode .branch-card p.text-gray-800 { color:var(--dk-text, #F9FAFB); }
            body.dark-mode .nav-head-email,
            body.dark-mode .nav-user-rol { color:var(--dk-muted, #9CA3AF); }
            body.dark-mode .nav-color-opt:hover,
            body.dark-mode .branch-dd-close:hover { background:var(--dk-hover, #1a2332); }
            /* Sobre el menú oscuro, las muestras de los temas oscuros se
               perderían con el filo oscuro: aquí va claro. */
            body.dark-mode .nav-color-swatch::after { box-shadow:inset 0 0 0 1px rgba(255,255,255,.18); }
            body.dark-mode .nav-status-dot { border-color:var(--dk-card, #1F2A37); }
            body.dark-mode .nav-menu-row { color:var(--dk-text, #F9FAFB); }
            body.dark-mode .nav-menu-row:hover { background:var(--dk-hover, #1a2332); }
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

            /* ── Teléfono y tablet chica (< 768px, el md de Tailwind) ──
               Completa la barra pide unos 590px: en un teléfono de 390 se salía
               por la derecha. Quedan el menú, el logo (sin el texto Huubie), la
               sucursal (sin ícono ni flecha: se encoge y corta el nombre), Notificaciones
               y el avatar; Módulos, Empresas, CoffeeIA, Tema y Calendario pasan al menú
               del usuario (nav-hide-compact). Bootstrap trae .px-4/.gap-* con
               !important: por eso los !important de aquí. Los desplegables van
               fijos a lo ancho de la pantalla para no salirse por la izquierda.
               Va al final para ganarle por orden a las reglas de arriba. */
            @media (max-width: 767.98px) {
                .navbar-main { padding-left:10px !important; padding-right:10px !important; gap:8px; }
                .navbar-main .nav-left { gap:4px !important; flex-shrink:0; }
                .navbar-main #btn-mobile-menu { width:36px; }
                .navbar-main .nav-brand-text,
                .navbar-main .nav-hide-compact,
                .navbar-main .branch-pill-label,
                .navbar-main .branch-pill-icon,
                .navbar-main .branch-pill-chev,
                .navbar-main .nav-chevron { display:none !important; }
                .navbar-main .nav-right { gap:4px !important; min-width:0; }
                .navbar-main .nav-right > :not(.nav-branch) { flex-shrink:0; }
                .navbar-main .nav-branch { min-width:0; }
                .navbar-main .branch-pill { max-width:100%; padding:6px 10px; }
                .navbar-main .branch-pill-text { flex:1 1 auto; min-width:0; }
                .navbar-main .branch-pill-name { display:block; max-width:100%; font-size:12.5px; }
                .navbar-main .nav-theme-toggle { width:34px; height:34px; }
                .navbar-main .nav-user-pill,
                .navbar-main .nav-user-pill:hover { padding:0; border:none; background:transparent; }
                .navbar-main .nav-avatar { width:34px; height:34px; }
                .branch-dd,
                .nav-color-menu,
                .nav-tool > .nav-panel { position:fixed; left:10px; right:10px; top:70px; width:auto; max-width:none; }
                /* Tema y Calendario sin botón (se abren desde el menú del usuario): su
                   caja no ocupa lugar ni hueco en la barra. */
                .navbar-main .nav-tool { display:contents; }
            }
        </style>`;
    }

    // El inicio: index.php manda a cada quien a su pantalla ($_SESSION['home']).
    homeUrl() {
        return `${this.proBase()}/index.php`;
    }

    initEvents() {
        // Estos tres frenan el clic (stopPropagation) y el de documento no se
        // entera: por eso cierran ellos mismos el calendario y la campana.
        $("#btnUserMenu").on("click", (e) => {
            e.stopPropagation();
            this.closeToolPanels();
            this.toggleUserMenu();
        });
        $("#btnLogout").on("click", () => this.logout());

        // Renglones del menú en el teléfono. Frenan el clic: el de documento cerraría
        // el Tema o el Calendario que abren.
        $("#userMenuDropdown").on("click", "[data-nav-go]", (e) => {
            e.stopPropagation();
            this.closeUserMenu();

            const go = e.currentTarget.getAttribute("data-nav-go");
            if (go === 'modulos')    window.location.href = this.homeUrl();
            if (go === 'empresas')   this.goTo('empresas');
            if (go === 'ia')         $("[data-ia-nav]").first().trigger("click");
            if (go === 'tema')       { this.closeToolPanels(); this.toggleThemeMenu(); }
            if (go === 'calendario') this.toggleToolPanel('calendar');
        });

        $("#btnModulos").on("click", () => {
            window.location.href = this.homeUrl();
        });
        $("#btnEmpresas").on("click", () => this.goTo('empresas'));
        $("#btnTheme").on("click", (e) => {
            e.stopPropagation();
            this.closeToolPanels();
            this.toggleThemeMenu();
        });

        $("#btnCalendar").on("click", () => this.toggleToolPanel('calendar'));
        $("#btnNotifs").on("click", () => this.toggleToolPanel('notifs'));

        // Avisos: la X cierra su tarjeta; «Ver» (o el aviso en la campana) la cierra y abre
        // la requisición; «+N más» abre la campana; «Limpiar todo» la vacía.
        $(document).on("click", "[data-toast-x]", (e) => this.cerrarToast(Number(e.currentTarget.getAttribute("data-toast-x"))));
        $(document).on("click", "[data-aviso]", (e) => this.cerrarToast(Number(e.currentTarget.getAttribute("data-aviso"))));
        $(document).on("click", "[data-toast-mas]", () => this.toggleToolPanel('notifs'));
        $(document).on("click", "#btnLimpiarAvisos", () => this.limpiarAvisos());

        // El navegador no deja sonar una página en la que no se ha hecho clic: el primer
        // clic o tecla prepara el sonido de los avisos que lleguen después.
        $(document).one("pointerdown keydown", () => {
            const ctx = this.audioAvisos();
            if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
        });

        // Otra pestaña cerró una tarjeta o limpió la campana: aquí también.
        window.addEventListener("storage", (e) => {
            if (e.key !== this.avisosKey()) return;
            const estado = this.leerEstadoAvisos();
            if (estado) this.aplicarEstadoAvisos(estado);
        });
        $(document).on("click", "#navCalendarPanel [data-cal]", (e) => {
            const step  = e.currentTarget.getAttribute("data-cal");
            const today = new Date();
            this.calView = step === 'hoy'
                ? new Date(today.getFullYear(), today.getMonth(), 1)
                : new Date(this.calView.getFullYear(), this.calView.getMonth() + Number(step), 1);
            this.renderCalendar();
        });
        $(document).on("click", ".nav-color-opt", (e) => {
            this.selectTheme(e.currentTarget.dataset.code);
        });

        $("#btnBranch").on("click", (e) => {
            e.stopPropagation();
            this.closeToolPanels();
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
            // Lo clicado ya no está en la página: el panel se repintó durante el
            // clic (las flechas del calendario). No es un clic afuera.
            if (!document.contains(e.target)) return;

            if (!$(e.target).closest("#btnCalendar, #navCalendarPanel, #btnNotifs, #navNotifPanel, #navToasts").length) {
                this.closeToolPanels();
            }
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

    goTo(section) {
        window.location.href = `${this.proBase()}/app/${section}/`;
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

        const response = await useFetch({
            url:  this.ctrlUrl(),
            data: { opc: 'switchBranch', id: id }
        });

        if (!response || response.status != 200) {
            this.alertBox({
                type:       'error',
                title:      'No se pudo cambiar de sucursal',
                detailHtml: this.escapeText((response && response.message) || 'Inténtalo nuevamente.')
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

    themeColor(theme) {
        return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(theme.color || '') ? theme.color : Navbar.THEME_FALLBACK.color;
    }

    // Sin color propio, cadena vacía: el rail sigue a la página.
    themeSidebar(theme) {
        return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(theme.sidebar || '') ? theme.sidebar : '';
    }

    // Barra con color (no blanca): con texto oscuro lleva .nav-tinted. Casi blanco
    // (todos los canales arriba de 235, como el #F5F5F5 de Pulpos) cuenta como blanca.
    isTintedBar(color) {
        let hex = String(color || '').replace('#', '');
        if (/^[0-9A-Fa-f]{3}$/.test(hex)) hex = hex.replace(/(.)/g, '$1$1');
        if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return false;

        return [0, 2, 4].some((i) => parseInt(hex.substr(i, 2), 16) < 235);
    }

    // El fondo de la página de cada scheme, el de assets/css/themes.css (--bg y
    // --dk-bg): la parte de abajo de la muestra.
    static get SCHEME_PAGE() {
        return { light: '#F3F4F6', huubie: '#111928', midnight: '#0B1420', rose: '#1A1216' };
    }

    // Pinta las opciones del menú: muestra, nombre, badge opcional y palomita
    // en el activo. La muestra es el tema en chiquito: barra (color o foto),
    // página, acento y primario.
    buildThemeList() {
        const themes = this.settings.themes || [];

        // Sin catálogo no hay nada que elegir: se esconde el botón en vez de
        // dejar un menú vacío colgando.
        if (!themes.length) {
            $("#btnTheme").closest(".relative").addClass("hidden");
            $('[data-nav-go="tema"]').css("display", "none");
            return;
        }

        const rows = themes.map((t) => {
            const image = this.themeImage(t);
            const color = this.themeColor(t);
            const page  = Navbar.SCHEME_PAGE[t.scheme] || Navbar.SCHEME_PAGE.light;
            const side  = this.themeSidebar(t);
            const bar   = image
                ? `background:url('${image}') center/cover no-repeat, ${color};`
                : `background:${color};`;

            return `
            <div class="nav-color-opt ${t.code === this.settings.theme ? 'is-active' : ''}" data-code="${this.escapeText(t.code)}">
                <span class="nav-color-swatch ${side ? 'has-side' : ''}" style="background:${page};">
                    <span class="nav-swatch-bar" style="${bar}"></span>
                    ${side ? `<span class="nav-swatch-side" style="background:${side};"></span>` : ''}
                    <span class="nav-swatch-acc" style="background:${this.themeAccent(t)};"></span>
                    <span class="nav-swatch-pri" style="background:${this.themePrimary(t)};"></span>
                </span>
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
        const palette = { accent: this.themeAccent(theme), primary: this.themePrimary(theme), secondary: this.themeSecondary(theme), sidebar: this.themeSidebar(theme), scheme: theme.scheme || 'light' };
        const $nav    = this.parent.find(".navbar-main");
        const nav     = $nav[0];

        if (window.InventoryPalette) {
            InventoryPalette.apply(palette);
            // El respaldo no se guarda: así no escribe huubie:pro:palette, que lee la plantilla del POS.
            if (this.themeByCode(code)) InventoryPalette.save(palette);
        }

        if (nav) {
            if (image) {
                nav.style.setProperty("background", `url("${image}") center/cover no-repeat, ${theme.color}`, "important");
                nav.style.setProperty("box-shadow", `inset 0 0 0 9999px ${dark ? Navbar.VEIL_DARK : Navbar.VEIL_LIGHT}`, "important");
            } else {
                nav.style.setProperty("background", theme.color, "important");
                nav.style.removeProperty("box-shadow");
            }

            $nav.toggleClass("nav-dark", dark)
                .toggleClass("nav-imagen", !!image)
                .toggleClass("nav-tinted", !dark && !image && this.isTintedBar(theme.color));
        }

        this.settings.theme = theme.code;

        $("#navColorList .nav-color-opt").each((_, el) => {
            $(el).toggleClass("is-active", el.dataset.code === theme.code);
        });
    }

    /* El tema del servidor no coincide con el que este navegador tenía guardado
       (otro equipo, otra cuenta en el mismo navegador): la página cambió de clara
       a oscura después de que el módulo armó sus componentes. Se recarga, una
       sola vez por tema para que un fallo no la deje dando vueltas. */
    syncScheme(code) {
        if (this.darkAtLoad === document.documentElement.classList.contains('dark')) return;

        try {
            if (sessionStorage.getItem(Navbar.RELOAD_KEY) === code) return;
            sessionStorage.setItem(Navbar.RELOAD_KEY, code);
        } catch (e) { return; }

        window.location.reload();
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

        try {
            await useFetch({
                url:  this.ctrlUrl(),
                data: { opc: 'theme', code: code }
            });
        } catch (e) { /* el tema ya se ve; solo no quedó guardado */ }

        if (document.documentElement.classList.contains('dark') !== wasDark) {
            try { sessionStorage.setItem(Navbar.RELOAD_KEY, code); } catch (e) { /* sin almacenamiento */ }
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

    // CoffeeIA lo pone cada módulo en la barra (iaNavButton): el renglón del menú
    // solo sale si el botón está.
    toggleUserMenu() {
        $('[data-nav-go="ia"]').css("display", $("[data-ia-nav]").length ? "" : "none");
        $("#userMenuDropdown").toggleClass("opacity-0 scale-95 invisible");
        $("#btnUserMenu").toggleClass("open");
    }

    closeUserMenu() {
        $("#userMenuDropdown").addClass("opacity-0 scale-95 invisible");
        $("#btnUserMenu").removeClass("open");
    }

    // -- Calendario y notificaciones --
    // Rápido y sencillo: el calendario es el mes (sin eventos todavía) y la
    // campana lleva los avisos de loadAvisos(). El contador (#navNotifCount) se
    // queda oculto mientras no haya avisos.

    toolPanels() {
        return {
            calendar: { btn: '#btnCalendar', panel: '#navCalendarPanel', render: () => this.renderCalendar() },
            notifs:   { btn: '#btnNotifs',   panel: '#navNotifPanel',    render: () => this.renderNotifs() }
        };
    }

    // Abre uno y cierra el otro; si ya estaba abierto, lo cierra.
    toggleToolPanel(name) {
        const tool = this.toolPanels()[name];
        const open = $(tool.panel).hasClass('hidden');

        this.closeToolPanels();
        if (!open) return;

        if (name === 'calendar') this.calView = null;
        tool.render();
        $(tool.panel).removeClass('hidden');
        $(tool.btn).attr('aria-expanded', 'true');
        // Con la campana abierta las tarjetas de aviso se esconden: le caían encima.
        if (name === 'notifs') $('#navToasts').hide();
    }

    closeToolPanels() {
        Object.values(this.toolPanels()).forEach((tool) => {
            $(tool.panel).addClass('hidden');
            $(tool.btn).attr('aria-expanded', 'false');
        });
        $('#navToasts').show();
    }

    // El mes de calView (al abrir, el de hoy), con la semana empezando en lunes.
    renderCalendar() {
        const today = new Date();
        if (!this.calView) this.calView = new Date(today.getFullYear(), today.getMonth(), 1);

        const y       = this.calView.getFullYear();
        const m       = this.calView.getMonth();
        const blanks  = (new Date(y, m, 1).getDay() + 6) % 7;
        const days    = new Date(y, m + 1, 0).getDate();
        const current = y === today.getFullYear() && m === today.getMonth();

        let cells = '<div></div>'.repeat(blanks);
        for (let d = 1; d <= days; d++) {
            cells += `<div class="cal-d${current && d === today.getDate() ? ' is-hoy' : ''}">${d}</div>`;
        }

        // "octubre de 2026" -> "Octubre de 2026" (capitalize subía también el "De").
        const month = this.calView.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());
        const hoy   = today.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

        $('#navCalendarPanel').html(`
            <div class="nav-panel-head">
                <div>
                    <p class="nav-panel-title">Mi calendario</p>
                    <p class="nav-panel-sub">${hoy}</p>
                </div>
                ${current ? '' : '<button type="button" class="cal-hoy" data-cal="hoy">Hoy</button>'}
            </div>
            <div class="nav-panel-body">
                <div class="cal-nav">
                    <button type="button" class="cal-mv" data-cal="-1" title="Mes anterior"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>
                    <span class="cal-mes">${month}</span>
                    <button type="button" class="cal-mv" data-cal="1" title="Mes siguiente"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>
                </div>
                <div class="cal-sem"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
                <div class="cal-grid">${cells}</div>
            </div>`);

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Cada aviso lleva a su pantalla: url relativa a pro/.
    renderNotifs() {
        const avisos = this.avisos || [];
        const base   = this.proBase() + '/';

        const lista = avisos.map((a) => `
            <a class="nav-notif" href="${base}${this.escapeText(a.url)}" data-aviso="${Number(a.id)}">
                <span class="nav-notif-ico"><i data-lucide="clipboard-list"></i></span>
                <span class="flex-1 min-w-0">
                    <span class="nav-notif-tit">${this.escapeText(a.titulo)}</span>
                    <span class="nav-notif-txt"><b>${this.escapeText(a.folio)}</b> &middot; ${this.escapeText(a.detalle)}</span>
                    <span class="nav-notif-time">${this.haceCuanto(a.minutos, a.dias)}</span>
                </span>
                <span class="nav-notif-dot"></span>
            </a>`).join('');

        $('#navNotifPanel').html(`
            <div class="nav-panel-head">
                <div>
                    <p class="nav-panel-title">Notificaciones</p>
                    <p class="nav-panel-sub">${avisos.length ? `${avisos.length} ${avisos.length === 1 ? 'solicitud por revisar' : 'solicitudes por revisar'}` : 'Avisos del sistema'}</p>
                </div>
                ${avisos.length ? '<button type="button" id="btnLimpiarAvisos" class="nav-limpiar">Limpiar todo</button>' : ''}
            </div>
            ${avisos.length ? `<div class="nav-notif-list">${lista}</div>` : `
            <div class="nav-panel-empty">
                <i data-lucide="bell-off" class="w-8 h-8"></i>
                <b>No tienes notificaciones</b>
                <span>Aquí aparecerán los avisos del sistema.</span>
            </div>`}`);

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // -- Avisos --
    // En pro todavía no hay avisos: ctrl-nav lsAvisos responde vacío. La campana ya
    // está lista para cuando los haya. Se consultan al abrir la página y cada minuto.
    // Si llega uno que no había sonado: la campana se sacude, suena y sale su tarjeta
    // fija (renderToasts).
    //
    // Lo que ya sonó, las tarjetas abiertas y lo que «Limpiar todo» quitó se guardan en
    // este navegador, por usuario y sucursal (avisosKey), para que sigan igual al cambiar
    // de página. La primera vez (sin nada guardado) lo que ya había no suena.

    async loadAvisos() {
        const r = await useFetch({ url: this.ctrlUrl(), data: { opc: 'lsAvisos' } }).catch(() => null);
        if (!r || r.status !== 200) return;

        const todos  = r.items || [];
        const ids    = todos.map((a) => Number(a.id));
        const antes  = this.leerEstadoAvisos();
        // Tarjetas y limpiados solo de lo que sigue por revisar; lo que ya sonó se recuerda
        // aunque hoy no venga (los últimos 300), para que no vuelva a sonar.
        const estado = antes
            ? {
                anunciados: antes.anunciados.slice(-300),
                abiertos:   (antes.abiertos  || []).filter((id) => ids.includes(id)),
                limpiados:  (antes.limpiados || []).filter((id) => ids.includes(id))
            }
            : { anunciados: ids.slice(), abiertos: [], limpiados: [] };

        const nuevos = antes ? ids.filter((id) => !estado.anunciados.includes(id)) : [];
        nuevos.forEach((id) => {
            estado.anunciados.push(id);
            estado.abiertos.push(id);
        });

        this.todosAvisos = todos;
        this.guardarEstadoAvisos(estado);
        this.aplicarEstadoAvisos(estado);

        if (nuevos.length) {
            this.ringBell();
            this.sonarAviso();
        }
    }

    // La campana sin lo limpiado, el contador y las tarjetas abiertas.
    aplicarEstadoAvisos(estado) {
        const limpiados = estado.limpiados || [];
        const avisos    = (this.todosAvisos || []).filter((a) => !limpiados.includes(Number(a.id)));
        this.avisos     = avisos;

        $('#navNotifCount').text(avisos.length > 9 ? '9+' : avisos.length).toggleClass('hidden', !avisos.length);
        this.renderToasts(estado.abiertos || []);
        if (!$('#navNotifPanel').hasClass('hidden')) this.renderNotifs();
    }

    // Tarjetas fijas bajo la barra, la más nueva arriba (lsAvisos las manda así). Hasta
    // tres; las demás quedan en «+N más», que abre la campana.
    renderToasts(abiertos) {
        const avisos = (this.todosAvisos || []).filter((a) => abiertos.includes(Number(a.id)));
        let $box     = $('#navToasts');

        if (!avisos.length) {
            $box.remove();
            return;
        }
        if (!$box.length) $box = $('<div>', { id: 'navToasts', class: 'nav-toasts' }).appendTo('body');

        const base  = this.proBase() + '/';
        const mas   = avisos.length - 3;
        // Dos renglones: qué pasó y hace cuánto; folio y detalle (cortado con … si no cabe).
        const cards = avisos.slice(0, 3).map((a) => `
            <div class="nav-toast" role="alert" title="${this.escapeText(a.folio)} · ${this.escapeText(a.detalle)}">
                <span class="nav-toast-ico"><i data-lucide="clipboard-list"></i></span>
                <div class="nav-toast-body">
                    <span class="nav-toast-tit"><span class="nav-toast-dot" aria-hidden="true"></span>${this.escapeText(a.titulo)} <small>&middot; ${this.haceCuanto(a.minutos, a.dias)}</small></span>
                    <span class="nav-toast-txt"><b>${this.escapeText(a.folio)}</b> &middot; ${this.escapeText(a.detalle)}</span>
                </div>
                <a class="nav-toast-ver" href="${base}${this.escapeText(a.url)}" data-aviso="${Number(a.id)}">Ver</a>
                <button type="button" class="nav-toast-x" data-toast-x="${Number(a.id)}" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>`).join('');

        $box.html(cards + (mas > 0 ? `<button type="button" class="nav-toast-mas" data-toast-mas>+${mas} más en la campana</button>` : ''));
        $box.toggle($('#navNotifPanel').hasClass('hidden'));
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    cerrarToast(id) {
        const estado = this.leerEstadoAvisos();
        if (!estado) return;

        estado.abiertos = (estado.abiertos || []).filter((x) => x !== id);
        this.guardarEstadoAvisos(estado);
        this.aplicarEstadoAvisos(estado);
    }

    // «Limpiar todo»: quita de la campana y de las tarjetas lo que hay ahora; solo vuelve
    // a salir lo que llegue después.
    limpiarAvisos() {
        const estado = this.leerEstadoAvisos() || { anunciados: [], abiertos: [], limpiados: [] };
        const ids    = (this.todosAvisos || []).map((a) => Number(a.id));

        estado.limpiados  = [...new Set([...(estado.limpiados || []), ...ids])];
        estado.anunciados = [...new Set([...estado.anunciados, ...ids])];
        estado.abiertos   = [];
        this.guardarEstadoAvisos(estado);
        this.aplicarEstadoAvisos(estado);
    }

    avisosKey() {
        const s = this.settings || {};
        return `pro:avisos:v1:${s.email || ''}:${(s.current && s.current.id) || ''}`;
    }

    // { anunciados, abiertos, limpiados } o null si no hay nada guardado (o el navegador
    // no deja guardar: modo privado, datos bloqueados).
    leerEstadoAvisos() {
        try {
            const v = JSON.parse(localStorage.getItem(this.avisosKey()) || 'null');
            return v && Array.isArray(v.anunciados) ? v : null;
        } catch (e) {
            return null;
        }
    }

    guardarEstadoAvisos(estado) {
        try {
            localStorage.setItem(this.avisosKey(), JSON.stringify(estado));
        } catch (e) {}
    }

    // -- Sonido --
    // Dos notas cortas con Web Audio (sin archivo de sonido). Si la página aún no tiene
    // un clic o una tecla, el navegador no deja sonar: la tarjeta sale igual, sin sonido.

    audioAvisos() {
        if (!this.ctxAudio) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            this.ctxAudio = new Ctx();
        }
        return this.ctxAudio;
    }

    async sonarAviso() {
        const ctx = this.audioAvisos();
        if (!ctx) return;

        // Sin permiso, resume() se queda esperando el primer clic: no se espera más de 300 ms.
        if (ctx.state !== 'running') {
            await Promise.race([ctx.resume().catch(() => {}), new Promise((ok) => setTimeout(ok, 300))]);
        }
        if (ctx.state !== 'running') return;

        const t = ctx.currentTime;
        [[880, 0], [1318.5, 0.16]].forEach(([frecuencia, desde]) => {
            const osc = ctx.createOscillator();
            const vol = ctx.createGain();

            osc.type            = 'sine';
            osc.frequency.value = frecuencia;
            vol.gain.setValueAtTime(0.0001, t + desde);
            vol.gain.exponentialRampToValueAtTime(0.25, t + desde + 0.02);
            vol.gain.exponentialRampToValueAtTime(0.0001, t + desde + 0.45);
            osc.connect(vol).connect(ctx.destination);
            osc.start(t + desde);
            osc.stop(t + desde + 0.5);
        });
    }

    ringBell() {
        const $btn = $('#btnNotifs').removeClass('nav-ring');
        void $btn[0].offsetWidth;
        $btn.addClass('nav-ring');
    }

    // "hace 20 min", "hace 2 h", "ayer", "hace 3 días", "hace 1 semana" (minutos y días de MySQL).
    haceCuanto(minutos, dias) {
        const m = Math.max(0, Number(minutos) || 0);
        const d = Math.max(0, Number(dias) || 0);

        if (m < 1)   return 'ahora';
        if (m < 60)  return `hace ${m} min`;
        if (d === 0) return `hace ${Math.floor(m / 60)} h`;
        if (d === 1) return 'ayer';
        if (d < 7)   return `hace ${d} días`;
        if (d < 30)  { const s = Math.floor(d / 7);  return `hace ${s} ${s === 1 ? 'semana' : 'semanas'}`; }
        const meses = Math.floor(d / 30);
        return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    }

    // La barra no hereda de Templates: toma prestado su alertBox (no usa `this`).
    // En oscuro lo repinta dark-mode.css, que cargan Catálogo y Pedidos.
    alertBox(options) {
        return Templates.prototype.alertBox.call(this, options);
    }

    logout() {
        this.alertBox({
            type:       'cancel',
            title:      '¿Cerrar sesión?',
            detailHtml: 'Está a punto de cerrar su sesión actual.',
            okLabel:    'Cerrar sesión',
            onOk: () => {
                // El menú que la sidebar guardó en la pestaña es de este usuario.
                try {
                    Object.keys(sessionStorage).filter((k) => k.startsWith('pro:sidebar:')).forEach((k) => sessionStorage.removeItem(k));
                } catch (e) { /* sin almacenamiento: no hay menú guardado */ }
                window.location.href = `${this.proBase()}/logout.php`;
            }
        });
    }
}

// -- Arranque --
// La barra nace ya con los dos modos en la mano: init() la pinta y le aplica
// el de la sesión en el mismo tick, así que no hay parpadeo que evitar.
$(async () => {
    const base    = Navbar.proBase();
    const ctrlUrl = `${base}/auth/ctrl/ctrl-nav.php`;

    const session = await useFetch({ url: ctrlUrl, data: { opc: 'session' } });

    // Sesión vencida: index.php muestra el login.
    if (session && session.status === 401) {
        window.location.href = `${base}/index.php`;
        return;
    }

    const data = (session && session.data) || {};
    level = 0;

    // data-branches="off": una pantalla sin sucursal elegida, donde la píldora no aplica.
    const withBranches = $("#menu-navbar").data("branches") !== "off";

    const branchInfo = withBranches ? await useFetch({ url: ctrlUrl, data: { opc: 'branches' } }) : null;

    const branches = branchInfo?.branches || [];
    const company  = branchInfo?.company  || data.company || '';
    const current  = withBranches
        ? (branchInfo?.current || { id: data.branch_id || 0, name: data.branch || '' })
        : { id: 0, name: '' };

    const navbar = new Navbar();
    navbar.init({
        user:     data.user    || 'Usuario',
        email:    data.email   || '',
        color:    data.color   || '',
        photo:    data.photo   || '',
        rol:      data.rol     || '',
        negocio:  data.company || '',
        company:  company,
        sucursal: data.branch  || '',
        level:    0,
        superAdmin: parseInt(data.is_root, 10) === 1,
        parent:   "#menu-navbar",
        branches: branches,
        current:  current,
        themes:   Navbar.modes(),
        theme:    data.theme === 'dark' ? 'dark' : 'light',
    });

    // La barra nace asíncrona: quien quiera agregarle un botón espera este aviso
    // si llegó antes que ella.
    document.dispatchEvent(new CustomEvent('navbarReady'));

    // Avisos de la campana: al abrir y cada minuto, también con la pestaña escondida.
    navbar.loadAvisos();
    setInterval(() => navbar.loadAvisos(), 60000);
});
