<<<<<<< HEAD
/*  Huubie · Barra superior de pro/

    La misma barra de erp-pro/pro (auth/src/js/navbar.js) en su version de
    Huubie, la que ya corria en inventory/acceso: marca, en que empresa y
    sucursal se esta, el selector de TEMAS y el menu del usuario.

    Un tema tiene dos mitades y esta barra reparte las dos:
      - la BARRA (color plano o imagen; `mode` decide si su texto va claro u
        oscuro) la pinta applyTheme() aqui mismo.
      - la PAGINA (acento, primario, secundario, rail y fondo) la pinta
        window.InventoryPalette (assets/js/tailwind-theme.js), que ademas la
        guarda para que la siguiente carga salga ya pintada desde el <head>.
    Por eso el tema se aplica en TODA pagina que lleve esta barra y ese script:
    los modulos, el inicio, el perfil, Developer y Empresas.

    El catalogo vive en la tabla themes y se administra en Developer ›
    Personalización. Cada quien ve los de su empresa (company_themes) mas el de
    por defecto; root, todos.

    Uso:  <div id="menu-navbar"></div>
          <script src=".../auth/src/js/navbar.js"></script>

    Todo sale de ctrl-nav :: session. Va con fetch y no con useFetch para no
    depender de coffeeSoft.js: la barra tiene que poder vivir en una pagina que
    no lo cargue. */
class Navbar {
    static get THEME_FALLBACK() {
        return { code: 'light', name: 'Claro', tipo: 'color', color: '#FFFFFF', image: '', accent: '#C05A40', primary: '#292524', secondary: '#C05A40', sidebar: '', scheme: 'light', mode: 'light', badge: '' };
    }

    /* El velo de los temas con imagen: la capa translucida entre la foto y el
       texto. Casi negro y no gris: un gris arrastra el color de la foto hacia
       el gris; uno oscuro la oscurece pero respeta el tono. Valores de erp-pro. */
    static get VEIL_DARK()  { return 'rgba(20, 22, 28, .34)'; }
    static get VEIL_LIGHT() { return 'rgba(255, 255, 255, .55)'; }

    // El fondo de pagina de cada scheme (assets/css/themes.css): la parte de
    // abajo de la muestra de cada tema.
    static get SCHEME_PAGE() {
        return { light: '#F3F4F6', huubie: '#111928', midnight: '#0B1420', rose: '#1A1216' };
    }

    // Como se veia la barra la ultima vez: se pinta asi antes de que conteste
    // el servidor, para que no parpadee en blanco con un tema oscuro.
    static get BAR_KEY() { return 'huubie:pro:bar'; }

    // Una recarga por tema, no mas: ver syncScheme().
    static get RELOAD_KEY() { return 'huubie:pro:theme-reload'; }

    async init() {
        this.base   = this.proBase();
        this.host   = document.getElementById('menu-navbar');
        this.themes = [];
        this.data   = {};

        if (!this.host) return;

        this.injectCSS();
        this.render();
        this.paintBar(this.savedBar());
        this.initEvents();

        const res = await this.post({ opc: 'session' });

=======
// Barra superior de pro: marca, en que empresa y sucursal se esta, quien entro, el
// tema y la salida. Los datos salen de ctrl-nav :: session y themes.
class Navbar {
    async init() {
        this.base   = this.proBase();
        this.themes = [];
        this.theme  = '';
        this.render();

        // Las dos a la vez: ctrl-nav suelta la sesion al leer y no se forman en fila.
        const [res, themes] = await Promise.all([this.post({ opc: 'session' }), this.post({ opc: 'themes' })]);

>>>>>>> 5beb47575ae2da067b536bf2e20567da0e6f2634
        if (res && res.status === 401) {
            window.location.href = this.base + '/index.php';
            return;
        }
<<<<<<< HEAD

        if (!res || res.status !== 200) return;

        this.data   = res.data;
        this.themes = res.data.themes || [];

        this.renderSession();
        this.buildThemeList();
        this.syncScheme(this.applyTheme(res.data.theme));

        // Para las paginas que quieran lo mismo sin volver a pedirlo.
        document.dispatchEvent(new CustomEvent('nav:session', { detail: res.data }));
=======
        if (res && res.status === 200) this.renderSession(res.data);
        if (themes && themes.status === 200) this.renderThemes(themes.themes, themes.current);
>>>>>>> 5beb47575ae2da067b536bf2e20567da0e6f2634
    }

    proBase() {
        const p = window.location.pathname;
        const i = p.indexOf('/pro/');
        return i >= 0 ? p.slice(0, i + '/pro'.length) : '/pro';
    }

<<<<<<< HEAD
=======
    // Una peticion a ctrl-nav. Si falla la red o la respuesta no es JSON, devuelve null.
>>>>>>> 5beb47575ae2da067b536bf2e20567da0e6f2634
    async post(data) {
        try {
            const res = await fetch(this.base + '/auth/ctrl/ctrl-nav.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(data).toString()
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    }

<<<<<<< HEAD
    esc(text) {
        return (text == null ? '' : String(text)).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    icons() {
=======
    render() {
        $('#menu-navbar').html(`
            <nav class="flex items-center justify-between gap-3 px-3 bg-white border-b border-gray-200">
                <div class="flex items-center gap-3 min-w-0">
                    <button type="button" id="btn-menu" class="p-2 rounded-md text-gray-500 hover:bg-gray-100" title="Menú" aria-controls="menu-sidebar">
                        <i data-lucide="menu" class="w-5 h-5"></i>
                    </button>
                    <a href="${this.base}/index.php" class="flex items-center gap-2 no-underline text-gray-900 shrink-0">
                        <span class="flex items-center justify-center w-8 h-8 rounded-lg bg-[#0A0A0A]">
                            <img src="${this.base}/assets/img/huubie.png" alt="" class="w-6 h-6">
                        </span>
                        <span class="font-semibold">Huubie</span>
                    </a>
                    <span id="nav-context" class="hidden md:flex items-center gap-1.5 text-sm text-gray-500 min-w-0"></span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <a id="nav-companies" href="${this.base}/app/empresas/" title="Cambiar empresa" class="hidden items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 no-underline">
                        <i data-lucide="building-2" class="w-4 h-4"></i><span class="hidden md:inline">Cambiar empresa</span>
                    </a>
                    <div id="nav-theme" class="relative hidden">
                        <button type="button" id="btn-theme" class="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="Tema" aria-haspopup="true" aria-expanded="false" aria-controls="nav-theme-menu">
                            <i data-lucide="palette" class="w-[18px] h-[18px]"></i>
                        </button>
                        <div id="nav-theme-menu" class="hidden absolute right-0 top-full mt-1 w-60 p-1 bg-white border border-gray-200 rounded-lg shadow-lg"></div>
                    </div>
                    <div id="nav-user" class="flex items-center gap-2"></div>
                    <button type="button" id="btn-logout" class="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="Cerrar sesión">
                        <i data-lucide="log-out" class="w-[18px] h-[18px]"></i>
                    </button>
                </div>
            </nav>
        `);

        $('#btn-logout').on('click', () => this.logout());

        // El menu de temas se cierra al elegir, con Escape o al hacer clic fuera.
        $('#btn-theme').on('click', () => this.toggleThemes());
        $('#nav-theme-menu').on('click', '[data-code]', (e) => this.selectTheme(e.currentTarget.dataset.code));
        $(document).on('click', (e) => { if (!$(e.target).closest('#nav-theme').length) this.closeThemes(); });
        $(document).on('keydown', (e) => { if (e.key === 'Escape') this.closeThemes(); });

>>>>>>> 5beb47575ae2da067b536bf2e20567da0e6f2634
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // -- Markup --

    render() {
        this.host.innerHTML = `
            <nav class="navbar-main">
                <div class="nav-left">
                    <a class="nav-brand" href="${this.base}/app/home/" title="Ir al inicio" aria-label="Ir al inicio">
                        <span class="nav-brand-mark"><img src="${this.base}/assets/img/huubie.png" alt=""></span>
                        <span class="nav-brand-text">
                            <span class="navbar-title">Huubie</span>
                            <span class="navbar-subtitle" id="navCompany"></span>
                        </span>
                    </a>
                    <span id="navViewing" class="nav-viewing" hidden>
                        <i data-lucide="eye"></i><span>Viendo como dueño</span>
                    </span>
                </div>

                <div class="nav-right">
                    <div class="nav-branch" id="navBranch"></div>

                    <div class="nav-tool" id="navNotifTool" hidden>
                        <button type="button" id="btnNotifs" class="nav-tool-btn" title="Notificaciones" aria-expanded="false">
                            <i data-lucide="bell"></i>
                            <span id="navNotifCount" class="nav-count"></span>
                        </button>
                        <div id="navNotifPanel" class="nav-color-menu nav-notif-panel" hidden>
                            <p class="nav-dd-label">Notificaciones</p>
                            <div id="navNotifList"></div>
                        </div>
                    </div>

                    <a id="btnEmpresas" class="nav-tool-btn nav-hide-compact" href="${this.base}/app/empresas/" title="Cambiar de empresa" hidden>
                        <i data-lucide="building-2"></i>
                    </a>

                    <div class="nav-tool" id="navThemeTool" hidden>
                        <button type="button" id="btnTheme" class="nav-tool-btn nav-hide-compact" title="Tema" aria-expanded="false">
                            <i data-lucide="palette"></i>
                        </button>
                        <div id="navColorMenu" class="nav-color-menu" hidden>
                            <p class="nav-dd-label">Tema</p>
                            <div id="navColorList"></div>
                        </div>
                    </div>

                    <div class="nav-user">
                        <button type="button" id="btnUserMenu" class="nav-user-pill" aria-expanded="false">
                            <span class="nav-avatar" id="navAvatar"><i data-lucide="user"></i></span>
                            <span class="nav-user-text">
                                <span class="nav-user-name" id="navUserName"></span>
                                <span class="nav-user-rol" id="navUserRol"></span>
                            </span>
                            <i data-lucide="chevron-down" class="nav-chevron"></i>
                        </button>

                        <div id="userMenuDropdown" class="nav-dropdown" hidden>
                            <div class="nav-user-head">
                                <span class="nav-head-avatar" id="navHeadAvatar"><i data-lucide="user"></i></span>
                                <div class="nav-head-text">
                                    <p class="nav-head-name" id="navHeadName"></p>
                                    <p class="nav-user-rol" id="navHeadRol"></p>
                                    <p class="nav-head-email" id="navHeadEmail"></p>
                                </div>
                            </div>

                            <div class="nav-divider"></div>

                            <div class="nav-menu">
                                <a class="nav-menu-row" href="${this.base}/app/perfil/">
                                    <i data-lucide="user-round"></i>Mi perfil
                                </a>
                                <a class="nav-menu-row nav-only-compact" id="rowEmpresas" href="${this.base}/app/empresas/" hidden>
                                    <i data-lucide="building-2"></i>Cambiar de empresa
                                </a>
                                <button type="button" class="nav-menu-row nav-only-compact" id="rowTheme" hidden>
                                    <i data-lucide="palette"></i>Tema
                                </button>
                            </div>

                            <div class="nav-logout">
                                <button type="button" id="btnLogout" class="nav-logout-btn">
                                    <i data-lucide="log-out"></i>Cerrar sesión
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>`;

        this.nav = this.host.querySelector('.navbar-main');
        this.icons();
    }

    renderSession() {
        const d = this.data;

        document.getElementById('navCompany').textContent = d.company || (d.is_root ? 'Plataforma' : '');
        document.getElementById('navViewing').hidden      = !d.viewing;

        document.getElementById('navUserName').textContent  = d.user || '';
        document.getElementById('navUserRol').textContent   = d.rol || '';
        document.getElementById('navHeadName').textContent  = d.user || '';
        document.getElementById('navHeadRol').textContent   = d.rol || '';
        document.getElementById('navHeadEmail').textContent = d.email || '';

        ['navAvatar', 'navHeadAvatar'].forEach((id) => this.paintAvatar(document.getElementById(id)));

        document.getElementById('btnEmpresas').hidden = !d.is_root;
        document.getElementById('rowEmpresas').hidden = !d.is_root;

        this.renderBranch();
        this.renderNotices();
        this.icons();
    }

    /* La campana solo existe cuando hay algo pendiente: sin avisos no hay
       boton, en vez de una campana que abre un panel vacio. */
    renderNotices() {
        const notices = this.data.notices || [];

        document.getElementById('navNotifTool').hidden = notices.length === 0;
        document.getElementById('navNotifCount').textContent = notices.length;

        document.getElementById('navNotifList').innerHTML = notices.map((n) => `
            <a class="nav-notif" href="${this.esc(this.base + '/' + String(n.route || '').replace(/^\/+/, ''))}">
                <span class="nav-notif-ico"><i data-lucide="${this.esc(n.icon)}"></i></span>
                <span class="nav-notif-text">
                    <b>${this.esc(n.title)}</b>
                    <small>${this.esc(n.text)}</small>
                </span>
            </a>`).join('');
    }

    /* La foto si tiene; si no, sus iniciales sobre SU color (users.color). Asi
       el respaldo no es un gris anonimo: se distingue de quien es. */
    paintAvatar(el) {
        const d     = this.data;
        const color = /^#[0-9A-Fa-f]{6}$/.test(d.color || '') ? d.color : '';

        el.style.background = color;
        el.innerHTML = d.photo
            ? `<img src="${this.esc(d.photo)}" alt="">`
            : `<span>${this.esc(this.initials(d.user || d.email))}</span>`;
    }

    initials(name) {
        const parts = String(name || '').trim().split(/\s+/);
        const first = parts[0] ? parts[0][0] : '';
        const last  = parts.length > 1 ? parts[parts.length - 1][0] : '';
        return (first + last).toUpperCase();
    }

    // -- Sucursal --

    renderBranch() {
        const box      = document.getElementById('navBranch');
        const branches = this.data.branches || [];
        const current  = branches.find((b) => b.selected) || { name: this.data.branch || '' };
        const multi    = branches.length > 1;

        if (!current.name) {
            box.innerHTML = '';
            return;
        }

        const cards = branches.map((b) => `
            <button type="button" class="branch-card ${b.selected ? 'branch-card-sel' : ''}" data-id="${b.id}">
                <span class="branch-card-avatar">${this.esc(this.initials(b.name))}</span>
                <span class="branch-card-text">
                    <span class="branch-card-name">${this.esc(b.name)}</span>
                    <span class="branch-card-place">${this.esc(b.ubication || 'Sin dirección')}</span>
                </span>
                <span class="branch-radio"><span class="branch-radio-inner"></span></span>
            </button>`).join('');

        box.innerHTML = `
            <button type="button" id="btnBranch" class="branch-pill ${multi ? '' : 'branch-pill-static'}" aria-expanded="false" ${multi ? '' : 'disabled'}>
                <span class="branch-pill-icon"><i data-lucide="store"></i></span>
                <span class="branch-pill-text">
                    <span class="branch-pill-label">Sucursal</span>
                    <span class="branch-pill-name">${this.esc(current.name)}</span>
                </span>
                ${multi ? '<i data-lucide="chevron-down" class="branch-pill-chev"></i>' : ''}
            </button>
            ${multi ? `
            <div id="branchDropdown" class="branch-dd" hidden>
                <div class="branch-dd-head">
                    <p class="branch-dd-label">Cambiar sucursal</p>
                    <p class="branch-dd-company">${this.esc(this.data.company || '')}</p>
                </div>
                <div class="branch-dd-list">${cards}</div>
            </div>` : ''}`;
    }

    async selectBranch(id) {
        const res = await this.post({ opc: 'switchBranch', id: id });

        if (!res || res.status !== 200) {
            this.alert('No se pudo cambiar de sucursal', (res && res.message) || 'Inténtalo nuevamente.');
            return;
        }

        // Todo lo que hay en pantalla es de la sucursal anterior.
        window.location.reload();
    }

    // -- Temas --

    hex(value, fallback) {
        return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value || '') ? value : fallback;
    }

    themeByCode(code) {
        return this.themes.find((t) => t.code === code) || null;
    }

    // Lo que se necesita de un tema, ya saneado: nada de esto llega a un
    // style="" sin pasar por aqui.
    look(theme) {
        const fb     = Navbar.THEME_FALLBACK;
        const accent = this.hex(theme.accent, fb.accent);

        return {
            code:      theme.code,
            name:      theme.name || '',
            color:     this.hex(theme.color, fb.color),
            image:     theme.tipo === 'imagen' && theme.image ? theme.image : '',
            dark:      theme.mode === 'dark',
            accent:    accent,
            primary:   this.hex(theme.primary, fb.primary),
            // Sin secundario propio, la barra sigue al acento.
            secondary: this.hex(theme.secondary, accent),
            // Sin color propio, cadena vacia: el rail sigue a la pagina.
            sidebar:   this.hex(theme.sidebar, ''),
            scheme:    Navbar.SCHEME_PAGE[theme.scheme] ? theme.scheme : 'light',
            badge:     theme.badge || ''
        };
    }

    // Barra con color (no blanca): con texto oscuro lleva .nav-tinted. Casi
    // blanco (todos los canales arriba de 235) cuenta como blanca.
    isTinted(color) {
        let hex = String(color || '').replace('#', '');
        if (hex.length === 3) hex = hex.replace(/(.)/g, '$1$1');
        if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return false;

        return [0, 2, 4].some((i) => parseInt(hex.substr(i, 2), 16) < 235);
    }

    savedBar() {
        try { return JSON.parse(localStorage.getItem(Navbar.BAR_KEY) || 'null'); } catch (e) { return null; }
    }

    /* Un tema de imagen va en tres capas: el color de base (se ve mientras
       carga y queda si la foto falla), el velo y la foto. El velo va como
       box-shadow interior porque se pinta encima del fondo y debajo del
       contenido. */
    paintBar(bar) {
        if (!bar || !this.nav) return;

        const color = this.hex(bar.color, '#FFFFFF');

        if (bar.image) {
            this.nav.style.setProperty('background', `url("${encodeURI(bar.image)}") center/cover no-repeat, ${color}`, 'important');
            this.nav.style.setProperty('box-shadow', `inset 0 0 0 9999px ${bar.dark ? Navbar.VEIL_DARK : Navbar.VEIL_LIGHT}`, 'important');
        } else {
            this.nav.style.setProperty('background', color, 'important');
            this.nav.style.removeProperty('box-shadow');
        }

        this.nav.classList.toggle('nav-dark', !!bar.dark);
        this.nav.classList.toggle('nav-imagen', !!bar.image);
        this.nav.classList.toggle('nav-tinted', !bar.dark && !bar.image && this.isTinted(color));
    }

    // Pinta barra y pagina. Devuelve el look aplicado.
    applyTheme(code) {
        const look = this.look(this.themeByCode(code) || Navbar.THEME_FALLBACK);
        const bar  = { color: look.color, image: look.image, dark: look.dark };

        if (window.InventoryPalette) {
            const palette = { accent: look.accent, primary: look.primary, secondary: look.secondary, sidebar: look.sidebar, scheme: look.scheme };

            InventoryPalette.apply(palette);
            InventoryPalette.save(palette);
        }

        this.paintBar(bar);
        try { localStorage.setItem(Navbar.BAR_KEY, JSON.stringify(bar)); } catch (e) {}

        this.current = look.code;

        this.host.querySelectorAll('.nav-color-opt').forEach((el) => {
            el.classList.toggle('is-active', el.dataset.code === look.code);
        });

        return look;
    }

    /*  Los componentes de coffeeSoft se arman UNA vez con la variante de la
        pagina (clara u oscura) que habia al pintarse. Si el tema del servidor
        no coincide con el que este navegador tenia guardado -- otro equipo,
        otra cuenta en el mismo navegador -- lo ya pintado quedaria en la
        variante vieja: se recarga, una sola vez por tema para que un fallo no
        deje la pagina dando vueltas. */
    syncScheme(look) {
        const wasDark = this.darkAtLoad;
        const isDark  = document.documentElement.classList.contains('dark');

        if (wasDark === isDark) return;

        let done = '';
        try { done = sessionStorage.getItem(Navbar.RELOAD_KEY) || ''; } catch (e) { return; }
        if (done === look.code) return;

        try { sessionStorage.setItem(Navbar.RELOAD_KEY, look.code); } catch (e) { return; }
        window.location.reload();
    }

    buildThemeList() {
        const tool = document.getElementById('navThemeTool');

        // Con un solo tema no hay nada que elegir: sin boton, en vez de un menu
        // de una opcion.
        if (this.themes.length < 2) {
            tool.hidden = true;
            document.getElementById('rowTheme').hidden = true;
            return;
        }

        tool.hidden = false;
        document.getElementById('rowTheme').hidden = false;

        /* La muestra es una ventanita del tema: la barra arriba (su color, o
           la foto), la pagina abajo, el rail si trae color y el acento y el
           primario como dos botones. Asi se distinguen hasta los que comparten
           barra blanca. */
        document.getElementById('navColorList').innerHTML = this.themes.map((t) => {
            const look = this.look(t);
            const bar  = look.image
                ? `background:url('${encodeURI(look.image)}') center/cover no-repeat, ${look.color};`
                : `background:${look.color};`;

            return `
                <button type="button" class="nav-color-opt" data-code="${this.esc(look.code)}">
                    <span class="nav-color-swatch ${look.sidebar ? 'has-side' : ''}" style="background:${Navbar.SCHEME_PAGE[look.scheme]};">
                        <span class="nav-swatch-bar" style="${bar}"></span>
                        ${look.sidebar ? `<span class="nav-swatch-side" style="background:${look.sidebar};"></span>` : ''}
                        <span class="nav-swatch-acc" style="background:${look.accent};"></span>
                        <span class="nav-swatch-pri" style="background:${look.primary};"></span>
                    </span>
                    <span class="nav-color-name">${this.esc(look.name)}</span>
                    ${look.badge ? `<span class="nav-color-badge">${this.esc(look.badge)}</span>` : ''}
                    <i data-lucide="check" class="nav-color-check"></i>
                </button>`;
        }).join('');

        this.icons();
    }

    /* El cambio corre detras del aviso "Aplicando tema": primero entra el velo
       y despues se pintan los colores. Si el tema nuevo cambia de pagina clara
       a oscura (o al reves) se recarga, por lo mismo que en syncScheme(). */
    async selectTheme(code) {
        if (code === this.current) return this.closeAll();

        const wasDark = document.documentElement.classList.contains('dark');
        const theme   = this.themeByCode(code);
        const loader  = window.InventoryPalette && InventoryPalette.loader;
        const started = Date.now();

        this.closeAll();

        if (loader) {
            loader.show(theme ? theme.name : '');
            await new Promise((resolve) => setTimeout(resolve, 180));
        }

        this.applyTheme(code);

        // Si no se guarda, el tema ya se ve: solo no queda para la proxima.
        await this.post({ opc: 'theme', code: code });

        if (document.documentElement.classList.contains('dark') !== wasDark) {
            try { sessionStorage.setItem(Navbar.RELOAD_KEY, code); } catch (e) {}
            if (loader) loader.carry(theme ? theme.name : '');
            window.location.reload();
            return;
        }

        // Tiempo minimo en pantalla para que el aviso alcance a leerse.
        if (loader) setTimeout(loader.hide, Math.max(0, 750 - (Date.now() - started)));
    }

    // -- Menus --

    panels() {
        return [
            { btn: 'btnUserMenu', panel: 'userMenuDropdown' },
            { btn: 'btnTheme',    panel: 'navColorMenu' },
            { btn: 'btnNotifs',   panel: 'navNotifPanel' },
            { btn: 'btnBranch',   panel: 'branchDropdown' }
        ];
    }

    toggle(panelId) {
        this.panels().forEach((p) => {
            const btn   = document.getElementById(p.btn);
            const panel = document.getElementById(p.panel);
            if (!panel) return;

            const open = p.panel === panelId && panel.hidden;

            panel.hidden = !open;
            if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }

    closeAll() {
        this.toggle('');
    }

    initEvents() {
        // Antes de que nada cambie el tema: con que variante se pinto la pagina.
        this.darkAtLoad = document.documentElement.classList.contains('dark');

        this.host.addEventListener('click', (e) => {
            const on = (selector) => e.target.closest(selector);

            if (on('#btnUserMenu')) return this.toggle('userMenuDropdown');
            if (on('#btnTheme'))    return this.toggle('navColorMenu');
            if (on('#btnNotifs'))   return this.toggle('navNotifPanel');
            if (on('#rowTheme'))    return this.toggle('navColorMenu');
            if (on('#btnBranch'))   return this.toggle('branchDropdown');
            if (on('#btnLogout'))   return this.logout();

            const theme = on('.nav-color-opt');
            if (theme) return this.selectTheme(theme.dataset.code);

            const branch = on('.branch-card');
            if (branch) {
                if (branch.classList.contains('branch-card-sel')) return this.closeAll();
                return this.selectBranch(branch.dataset.id);
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.host.contains(e.target)) this.closeAll();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAll();
        });
    }

    // -- Avisos --

    swalTheme() {
        const dark = document.body.classList.contains('dark-mode');
        return { background: dark ? '#1F2A37' : '#FFFFFF', color: dark ? '#F9FAFB' : '#111827', heightAuto: false, scrollbarPadding: false };
    }

    alert(title, text) {
        if (typeof Swal === 'undefined') return window.alert(title + '\n' + text);
        Swal.fire({ ...this.swalTheme(), icon: 'error', title: title, text: text, confirmButtonText: 'Ok', confirmButtonColor: '#0A0A0A' });
    }

    logout() {
        const go = () => {
            // El menu guardado es de esta sesion: el siguiente usuario no tiene por que verlo.
            try {
                Object.keys(sessionStorage).filter((k) => k.startsWith('pro:sidebar:')).forEach((k) => sessionStorage.removeItem(k));
            } catch (e) {}

            window.location.href = this.base + '/logout.php';
        };

        this.closeAll();

        if (typeof Swal === 'undefined') return go();

        Swal.fire({
            ...this.swalTheme(),
            title:              '¿Cerrar sesión?',
            text:               'Se cerrará tu sesión actual y volverás al inicio.',
            icon:               'question',
            showCancelButton:   true,
            confirmButtonText:  'Sí, cerrar sesión',
            cancelButtonText:   'Cancelar',
            confirmButtonColor: '#0A0A0A',
            cancelButtonColor:  '#9CA3AF',
            reverseButtons:     true
        }).then((result) => { if (result.isConfirmed) go(); });
    }

    // -- CSS --
    /*  Va inyectado y no en un .css aparte: la barra se entrega con un <script>,
        asi que atarle el CSS a ese script hace imposible tener uno sin el otro.

        Los colores de marca salen de la rampa del SECUNDARIO del tema
        (--accent-2-*), que escribe InventoryPalette. Las superficies de los
        desplegables, de los tokens de pagina (--surface, --line, --ink) y, en
        pagina oscura, de los --dk-*: asi siguen al tema sin saber cual es.

        Varias reglas llevan !important: Bootstrap (las paginas de Developer lo
        cargan) trae a:hover, button y p con sus propios colores y margenes. */
    injectCSS() {
        if (document.getElementById('navbarStyles')) return;

        const css = `
            :root {
                --nav-accent:      rgb(var(--accent-2-600, 192 90 64));
                --nav-accent-tint: rgb(var(--accent-2-600, 192 90 64) / .12);
                --nav-accent-line: rgb(var(--accent-2-600, 192 90 64) / .28);
                --nav-accent-glow: rgb(var(--accent-2-600, 192 90 64) / .35);
                --nav-pop:         var(--surface, #FFFFFF);
                --nav-pop-line:    var(--line, #E5E7EB);
                --nav-pop-ink:     var(--ink, #111827);
                --nav-pop-dim:     var(--ink-dim, #6B7280);
                --nav-pop-hover:   rgb(var(--gray-100, 243 244 246));
            }
            body.dark-mode {
                --nav-pop:       var(--dk-card, #1F2A37);
                --nav-pop-line:  var(--dk-line, #374151);
                --nav-pop-ink:   var(--dk-text, #F9FAFB);
                --nav-pop-dim:   var(--dk-muted, #9CA3AF);
                --nav-pop-hover: var(--dk-hover, #1a2332);
            }

            /* Sin general.css (Empresas) el anfitrion no trae alto ni capa. */
            #menu-navbar { flex:none; z-index:50; }
            .navbar-main { position:relative; height:64px; min-height:64px; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:0 16px; background:#FFFFFF; border-bottom:1px solid var(--nav-accent-line); font-family:'Inter',system-ui,sans-serif; transition:background .2s ease; }
            .navbar-main button { font-family:inherit; }
            .navbar-main [hidden] { display:none !important; }
            .navbar-main p { margin:0; }
            .navbar-main svg { flex-shrink:0; }
            .nav-left, .nav-right { display:flex; align-items:center; gap:10px; min-width:0; }
            .nav-right { flex-shrink:0; }

            /* Marca */
            .nav-brand { display:flex; align-items:center; gap:10px; text-decoration:none !important; min-width:0; }
            .nav-brand-mark { width:34px; height:34px; border-radius:10px; background:#0A0A0A; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
            .nav-brand-mark img { width:24px; height:24px; }
            .nav-brand-text { display:flex; flex-direction:column; line-height:1.15; min-width:0; }
            .navbar-title { font-size:15px; font-weight:700; color:#111827; }
            .navbar-subtitle { font-size:10px; color:#9CA3AF; letter-spacing:.12em; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:220px; }
            .navbar-subtitle:empty { display:none; }

            /* root dentro de una empresa: que no se le olvide que no es la suya. */
            .nav-viewing { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:9999px; font-size:11px; font-weight:600; color:#92400E; background:#FEF3C7; border:1px solid #FDE68A; white-space:nowrap; }
            .nav-viewing svg { width:13px; height:13px; }

            /* Botones de icono redondos, como .nav-tool-btn de erp-pro. */
            .nav-tool { position:relative; }
            .nav-tool-btn { width:38px; height:38px; display:flex; align-items:center; justify-content:center; color:#6B7280 !important; border:none; background:transparent; cursor:pointer; border-radius:9999px; transition:color .15s ease, background .15s ease; }
            .nav-tool-btn svg { width:18px; height:18px; }
            .nav-tool-btn:hover { color:#111827 !important; background:#F3F4F6; }
            .nav-tool-btn[aria-expanded="true"] { color:var(--nav-accent) !important; background:var(--nav-accent-tint); }

            /* Pildora de sucursal */
            .nav-branch { position:relative; min-width:0; }
            .nav-branch:empty { display:none; }
            .branch-pill { display:flex; align-items:center; gap:10px; padding:4px 10px; border:1px solid var(--nav-accent-line); border-radius:10px; background:var(--nav-accent-tint); cursor:pointer; transition:border-color .15s ease, background .15s ease, box-shadow .15s ease; max-width:100%; }
            .branch-pill:hover { border-color:var(--nav-accent); }
            .branch-pill.branch-pill-static { cursor:default; }
            .branch-pill.branch-pill-static:hover { border-color:var(--nav-accent-line); }
            .branch-pill-icon { width:30px; height:30px; border-radius:8px; background:var(--nav-accent-tint); display:flex; align-items:center; justify-content:center; color:var(--nav-accent); flex-shrink:0; }
            .branch-pill-icon svg { width:17px; height:17px; }
            .branch-pill-text { display:flex; flex-direction:column; align-items:flex-start; line-height:1.2; min-width:0; }
            .branch-pill-label { font-size:9px; text-transform:uppercase; letter-spacing:.14em; color:#9CA3AF; font-weight:600; }
            .branch-pill-name { font-size:13px; font-weight:700; color:#111827; max-width:150px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .branch-pill-chev { width:16px; height:16px; color:#9CA3AF; transition:transform .2s ease; }
            #btnBranch[aria-expanded="true"] .branch-pill-chev { transform:rotate(180deg); }

            /* Desplegables: una sola piel para los tres. */
            .branch-dd, .nav-color-menu, .nav-dropdown { position:absolute; right:0; top:calc(100% + 10px); background:var(--nav-pop); border:1px solid var(--nav-pop-line); border-radius:14px; box-shadow:0 16px 40px rgba(17,24,39,.16); z-index:60; color:var(--nav-pop-ink); text-align:left; }
            body.dark-mode .branch-dd, body.dark-mode .nav-color-menu, body.dark-mode .nav-dropdown { box-shadow:0 16px 40px rgba(0,0,0,.45); }
            .nav-dd-label { padding:8px 10px 4px; font-size:10px; text-transform:uppercase; letter-spacing:.12em; color:var(--nav-pop-dim); font-weight:700; }

            .branch-dd { width:300px; }
            .branch-dd-head { padding:12px 14px 10px; border-bottom:1px solid var(--nav-pop-line); }
            .branch-dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.12em; color:var(--nav-accent); font-weight:700; }
            .branch-dd-company { font-size:11px; color:var(--nav-pop-dim); margin-top:2px !important; }
            .branch-dd-list { padding:8px; display:flex; flex-direction:column; gap:6px; max-height:320px; overflow-y:auto; }
            .branch-card { width:100%; display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid var(--nav-pop-line); border-radius:10px; background:transparent; cursor:pointer; text-align:left; transition:border-color .15s ease, background .15s ease; }
            .branch-card:hover { border-color:var(--nav-accent-line); background:var(--nav-accent-tint); }
            .branch-card-sel { background:var(--nav-accent-tint); border-color:var(--nav-accent); }
            .branch-card-avatar { width:28px; height:28px; border-radius:9999px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:10px; letter-spacing:.5px; color:#FFFFFF; flex-shrink:0; background:linear-gradient(135deg, rgb(var(--accent-2-700, 168 74 51)) 0%, rgb(var(--accent-2-500, 200 105 76)) 100%); }
            .branch-card-text { flex:1; min-width:0; display:flex; flex-direction:column; }
            .branch-card-name { font-size:13px; font-weight:700; color:var(--nav-pop-ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .branch-card-place { font-size:11px; color:var(--nav-pop-dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .branch-radio { width:16px; height:16px; border-radius:9999px; border:2px solid var(--nav-pop-line); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
            .branch-card-sel .branch-radio { border-color:var(--nav-accent); }
            .branch-radio-inner { width:7px; height:7px; border-radius:9999px; background:var(--nav-accent); opacity:0; }
            .branch-card-sel .branch-radio-inner { opacity:1; }

            /* Selector de temas */
            .nav-color-menu { width:260px; padding:6px; }
            .nav-color-opt { width:100%; display:flex; align-items:center; gap:10px; padding:8px 10px; border:none; border-radius:10px; background:transparent; cursor:pointer; text-align:left; transition:background .15s ease; }
            .nav-color-opt:hover { background:var(--nav-pop-hover); }
            .nav-color-opt.is-active { background:var(--nav-accent-tint); }
            .nav-color-swatch { position:relative; width:30px; height:22px; border-radius:6px; overflow:hidden; flex-shrink:0; }
            .nav-color-swatch::after { content:""; position:absolute; inset:0; border-radius:inherit; box-shadow:inset 0 0 0 1px rgba(15,23,42,.16); pointer-events:none; }
            body.dark-mode .nav-color-swatch::after { box-shadow:inset 0 0 0 1px rgba(255,255,255,.18); }
            .nav-swatch-bar { position:absolute; left:0; right:0; top:0; height:7px; }
            .nav-swatch-acc, .nav-swatch-pri { position:absolute; bottom:4px; height:5px; border-radius:3px; }
            .nav-swatch-acc { left:4px; width:12px; }
            .nav-swatch-pri { right:4px; width:7px; }
            .nav-swatch-side { position:absolute; left:0; top:7px; bottom:0; width:6px; }
            .nav-color-swatch.has-side .nav-swatch-acc { left:9px; width:9px; }
            .nav-color-name { font-size:13px; font-weight:600; color:var(--nav-pop-ink); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
            .nav-color-badge { font-size:8.5px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; padding:2px 6px; border-radius:9999px; background:#7AAB20; color:#FFFFFF; flex-shrink:0; }
            .nav-color-check { width:16px; height:16px; color:var(--nav-accent); opacity:0; flex-shrink:0; }
            .nav-color-opt.is-active .nav-color-check { opacity:1; }

            /* Notificaciones */
            .nav-tool-btn { position:relative; }
            .nav-count { position:absolute; top:3px; right:3px; min-width:16px; height:16px; padding:0 4px; border-radius:9999px; background:#DC2626; color:#FFFFFF; font-size:10px; font-weight:700; line-height:16px; text-align:center; }
            .nav-notif-panel { width:300px; }
            .nav-notif { display:flex; align-items:flex-start; gap:10px; padding:10px; border-radius:10px; text-decoration:none !important; transition:background .15s ease; }
            .nav-notif:hover { background:var(--nav-pop-hover); }
            .nav-notif-ico { width:32px; height:32px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:var(--nav-accent-tint); color:var(--nav-accent); }
            .nav-notif-ico svg { width:16px; height:16px; }
            .nav-notif-text { display:flex; flex-direction:column; min-width:0; line-height:1.35; }
            .nav-notif-text b { font-size:13px; font-weight:700; color:var(--nav-pop-ink); }
            .nav-notif-text small { font-size:12px; color:var(--nav-pop-dim); }

            /* Usuario */
            .nav-user { position:relative; }
            .nav-user-pill { display:flex; align-items:center; gap:10px; padding:4px 8px 4px 13px; border:1px solid transparent; border-left:1px solid #E5E7EB; border-radius:8px; background:transparent; cursor:pointer; transition:background .15s ease, border-color .15s ease; }
            .nav-user-pill:hover { background:#F3F4F6; border-color:#E5E7EB; }
            .nav-avatar, .nav-head-avatar { border-radius:9999px; background:#9CA3AF; display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-weight:700; flex-shrink:0; overflow:hidden; }
            .nav-avatar { width:36px; height:36px; font-size:12.5px; }
            .nav-head-avatar { width:46px; height:46px; font-size:15px; }
            .nav-avatar img, .nav-head-avatar img { width:100%; height:100%; object-fit:cover; }
            .nav-avatar svg { width:18px; height:18px; }
            .nav-user-text { display:flex; flex-direction:column; align-items:flex-start; line-height:1.2; }
            .nav-user-name { font-size:13px; font-weight:600; color:#111827; white-space:nowrap; max-width:170px; overflow:hidden; text-overflow:ellipsis; }
            .nav-user-rol { font-size:11px; color:#6B7280; }
            .nav-user-rol:empty { display:none; }
            .nav-chevron { width:16px; height:16px; color:#9CA3AF; transition:transform .2s ease; }
            #btnUserMenu[aria-expanded="true"] .nav-chevron { transform:rotate(180deg); }

            .nav-dropdown { width:280px; overflow:hidden; }
            .nav-user-head { display:flex; align-items:center; gap:12px; padding:16px; }
            .nav-head-text { flex:1; min-width:0; }
            .nav-head-name { font-size:15px; font-weight:700; color:var(--nav-pop-ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .nav-dropdown .nav-user-rol { color:var(--nav-pop-dim); }
            .nav-head-email { font-size:12.5px; color:var(--nav-pop-dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .nav-divider { height:1px; background:var(--nav-pop-line); }
            .nav-menu { padding:8px; }
            .nav-menu-row { width:100%; display:flex; align-items:center; gap:10px; padding:10px 12px; border:none; border-radius:10px; background:transparent; color:var(--nav-pop-ink) !important; font-size:14px; font-weight:600; text-align:left; text-decoration:none !important; cursor:pointer; transition:background .15s ease; }
            .nav-menu-row svg { width:16px; height:16px; color:var(--nav-pop-dim); }
            .nav-menu-row:hover { background:var(--nav-pop-hover); }
            .nav-only-compact { display:none; }
            .nav-logout { padding:4px 12px 12px; }
            .nav-logout-btn { width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:11px; border:1px solid var(--nav-pop-line); color:#DC2626; border-radius:12px; font-weight:600; font-size:14px; background:transparent; cursor:pointer; transition:background .15s ease, border-color .15s ease; }
            .nav-logout-btn svg { width:16px; height:16px; }
            .nav-logout-btn:hover { background:rgba(220,38,38,.08); border-color:rgba(220,38,38,.35); }
            body.dark-mode .nav-logout-btn { color:#F87171; }

            /* ── Barra oscura (mode: dark): solo cambia la barra. ── */
            .navbar-main.nav-dark { border-bottom-color:rgba(255,255,255,.12); }
            .navbar-main.nav-dark .navbar-title,
            .navbar-main.nav-dark .nav-user-name,
            .navbar-main.nav-dark .branch-pill-name { color:#F8FAFC; }
            .navbar-main.nav-dark .navbar-subtitle,
            .navbar-main.nav-dark .nav-user-pill .nav-user-rol,
            .navbar-main.nav-dark .branch-pill-label { color:rgba(255,255,255,.62); }
            .navbar-main.nav-dark .nav-chevron,
            .navbar-main.nav-dark .branch-pill-chev { color:#CBD5E1; }
            .navbar-main.nav-dark .nav-brand-mark { box-shadow:0 0 0 1px rgba(255,255,255,.18); }
            .navbar-main.nav-dark .nav-user-pill { border-left-color:rgba(255,255,255,.15); }
            .navbar-main.nav-dark .nav-user-pill:hover { background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.15); }
            .navbar-main.nav-dark .nav-avatar { box-shadow:0 0 0 1px rgba(255,255,255,.25); }
            .navbar-main.nav-dark .branch-pill { background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.18); }
            .navbar-main.nav-dark .branch-pill:not(.branch-pill-static):hover { background:rgba(255,255,255,.14); border-color:rgba(255,255,255,.30); }
            .navbar-main.nav-dark .branch-pill-icon { background:rgba(255,255,255,.14); color:#FFFFFF; }
            .navbar-main.nav-dark .nav-tool-btn { color:#CBD5E1 !important; }
            .navbar-main.nav-dark .nav-tool-btn:hover,
            .navbar-main.nav-dark .nav-tool-btn[aria-expanded="true"] { color:#FFFFFF !important; background:rgba(255,255,255,.10); }

            /* ── Barra clara con color (rosa, menta...): los grises de la barra
               blanca se pierden sobre un color; aqui van en tinta translucida. ── */
            .navbar-main.nav-tinted { border-bottom-color:rgba(17,24,39,.10); }
            .navbar-main.nav-tinted .navbar-subtitle,
            .navbar-main.nav-tinted .nav-user-pill .nav-user-rol,
            .navbar-main.nav-tinted .branch-pill-label { color:rgba(17,24,39,.72); }
            .navbar-main.nav-tinted .nav-chevron,
            .navbar-main.nav-tinted .branch-pill-chev { color:rgba(17,24,39,.78); }
            .navbar-main.nav-tinted .nav-tool-btn { color:rgba(17,24,39,.78) !important; }
            .navbar-main.nav-tinted .nav-tool-btn:hover,
            .navbar-main.nav-tinted .nav-tool-btn[aria-expanded="true"] { color:#111827 !important; background:rgba(255,255,255,.45); }
            .navbar-main.nav-tinted .nav-user-pill { border-left-color:rgba(17,24,39,.14); }
            .navbar-main.nav-tinted .nav-user-pill:hover { background:rgba(255,255,255,.40); border-color:rgba(17,24,39,.10); }
            .navbar-main.nav-tinted .nav-avatar { box-shadow:0 0 0 2px rgba(255,255,255,.70); }
            .navbar-main.nav-tinted .branch-pill { background:rgba(255,255,255,.22); border-color:rgba(255,255,255,.40); }
            .navbar-main.nav-tinted .branch-pill:not(.branch-pill-static):hover { background:rgba(255,255,255,.34); border-color:rgba(255,255,255,.60); }
            .navbar-main.nav-tinted .branch-pill-icon { background:rgba(255,255,255,.32); color:rgba(17,24,39,.78); }

            /* ── Barra con imagen: el velo es flojo para que la foto se vea; lo
               que hace legible el texto es esta sombra. ── */
            .navbar-main.nav-imagen .navbar-title,
            .navbar-main.nav-imagen .nav-user-name,
            .navbar-main.nav-imagen .branch-pill-name { text-shadow:0 1px 3px rgba(0,0,0,.55); }
            .navbar-main.nav-imagen:not(.nav-dark) .navbar-title,
            .navbar-main.nav-imagen:not(.nav-dark) .nav-user-name,
            .navbar-main.nav-imagen:not(.nav-dark) .branch-pill-name { text-shadow:0 1px 3px rgba(255,255,255,.85); }
            .navbar-main.nav-imagen .nav-tool-btn { background:rgba(255,255,255,.14); }
            .navbar-main.nav-imagen.nav-dark .nav-tool-btn { background:rgba(0,0,0,.18); }

            /* ── Telefono (< 768px): quedan la marca sin texto, la sucursal
               (sin icono ni flecha) y el avatar. Empresas y Tema pasan al menu
               del usuario. Los desplegables van a lo ancho de la pantalla para
               no salirse por la izquierda. ── */
            @media (max-width: 767.98px) {
                .navbar-main { padding:0 10px; gap:8px; }
                .nav-right { gap:6px; flex-shrink:1; }
                .navbar-main .nav-brand-text,
                .navbar-main .nav-viewing span,
                .navbar-main .nav-hide-compact,
                .navbar-main .branch-pill-label,
                .navbar-main .branch-pill-icon,
                .navbar-main .nav-user-text,
                .navbar-main .nav-chevron { display:none !important; }
                .nav-viewing { padding:6px; }
                .nav-only-compact:not([hidden]) { display:flex; }
                .branch-pill { padding:7px 10px; }
                .branch-pill-name { font-size:12.5px; max-width:120px; }
                .nav-user-pill, .nav-user-pill:hover { padding:0; border:none; background:transparent; }
                .nav-tool { position:static; }
                .nav-branch { position:static; }
                .nav-user { position:static; }
                .branch-dd, .nav-color-menu, .nav-dropdown { position:fixed; left:10px; right:10px; top:70px; width:auto; }
            }`;

        const tag = document.createElement('style');

        tag.id = 'navbarStyles';
        tag.textContent = css;
        document.head.appendChild(tag);
    }
}

// Arranca en cuanto se carga el script (va al final del body, cuando
// #menu-navbar ya existe): la sesion se pide antes que lo del modulo.
(() => {
    const navbar = new Navbar();

    if (document.getElementById('menu-navbar')) navbar.init();
    else document.addEventListener('DOMContentLoaded', () => navbar.init());

    window.navbar = navbar;
})();
