/*  Huubie · Barra superior de pro/

    La marca, en que empresa y sucursal se esta, el modo (claro u oscuro) y el
    menu del usuario.

    La aplicacion tiene DOS MODOS y nada mas. Sus colores viven en
    window.InventoryPalette.MODES (assets/js/tailwind-theme.js), que pinta la
    pagina y deja el modo guardado para que la siguiente carga salga ya pintada
    desde el <head>. Esta barra solo lo conmuta, se viste con .nav-dark y cambia
    de logo:
      claro   barra blanca,   assets/img/huubie_light.png (morado y rojo)
      oscuro  barra #141D2B,  assets/img/huubie.svg       (blanco)

    El modo de cada quien se guarda en users.theme_code ('light' | 'dark').

    Uso:  <div id="menu-navbar"></div>
          <script src=".../auth/src/js/navbar.js"></script>

    Todo sale de ctrl-nav :: session. Va con fetch y no con useFetch para no
    depender de coffeeSoft.js: la barra tiene que poder vivir en una pagina que
    no lo cargue. */
class Navbar {
    // Una recarga por modo, no mas: ver syncScheme().
    static get RELOAD_KEY() { return 'huubie:pro:theme-reload'; }

    async init() {
        this.base = this.proBase();
        this.host = document.getElementById('menu-navbar');
        this.data = {};

        if (!this.host) return;

        this.injectCSS();
        this.render();
        this.initEvents();

        const res = await this.post({ opc: 'session' });

        if (res && res.status === 401) {
            window.location.href = this.base + '/index.php';
            return;
        }

        if (!res || res.status !== 200) return;

        this.data = res.data;

        this.renderSession();
        this.applyMode(res.data.theme);
        this.syncScheme();

        // Para las paginas que quieran lo mismo sin volver a pedirlo.
        document.dispatchEvent(new CustomEvent('nav:session', { detail: res.data }));
    }

    proBase() {
        const p = window.location.pathname;
        const i = p.indexOf('/pro/');
        return i >= 0 ? p.slice(0, i + '/pro'.length) : '/pro';
    }

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

    esc(text) {
        return (text == null ? '' : String(text)).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    icons() {
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // -- Markup --

    render() {
        this.host.innerHTML = `
            <nav class="navbar-main">
                <div class="nav-left">
                    <a class="nav-brand" href="${this.base}/app/home/" title="Ir al inicio" aria-label="Ir al inicio">
                        <img class="nav-logo nav-logo-light" src="${this.base}/assets/img/huubie_light.png" alt="Huubie">
                        <img class="nav-logo nav-logo-dark" src="${this.base}/assets/img/huubie.svg" alt="Huubie">
                        <span class="nav-company" id="navCompany"></span>
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
                        <div id="navNotifPanel" class="nav-panel nav-notif-panel" hidden>
                            <p class="nav-dd-label">Notificaciones</p>
                            <div id="navNotifList"></div>
                        </div>
                    </div>

                    <a id="btnEmpresas" class="nav-tool-btn nav-hide-compact" href="${this.base}/app/empresas/" title="Cambiar de empresa" hidden>
                        <i data-lucide="building-2"></i>
                    </a>

                    <button type="button" id="btnMode" class="nav-tool-btn nav-hide-compact">
                        <span class="nav-mode-to-dark"><i data-lucide="moon"></i></span>
                        <span class="nav-mode-to-light"><i data-lucide="sun"></i></span>
                    </button>

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
                            </div>

                            <div class="nav-divider"></div>

                            <div class="nav-mode" role="group" aria-label="Modo de la aplicación">
                                <button type="button" class="nav-mode-opt" data-mode="light" aria-pressed="false">
                                    <i data-lucide="sun"></i>Claro
                                </button>
                                <button type="button" class="nav-mode-opt" data-mode="dark" aria-pressed="false">
                                    <i data-lucide="moon"></i>Oscuro
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

        // Como quedo la pagina desde el <head> (tailwind-theme.js): la barra nace
        // ya en su modo, sin esperar al servidor.
        this.paintMode(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
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

    // -- Modo: claro u oscuro --

    // La barra: su color y su logo cuelgan de .nav-dark; el boton y el
    // selector del menu marcan en cual se esta.
    paintMode(mode) {
        const dark = mode === 'dark';

        this.current = dark ? 'dark' : 'light';
        this.nav.classList.toggle('nav-dark', dark);

        const btn   = document.getElementById('btnMode');
        const label = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

        btn.title = label;
        btn.setAttribute('aria-label', label);

        this.host.querySelectorAll('.nav-mode-opt').forEach((el) => {
            el.setAttribute('aria-pressed', el.dataset.mode === this.current ? 'true' : 'false');
        });
    }

    // Pinta la pagina (InventoryPalette) y la barra.
    applyMode(mode) {
        mode = mode === 'dark' ? 'dark' : 'light';

        if (window.InventoryPalette) InventoryPalette.setMode(mode);
        this.paintMode(mode);
    }

    /*  Los componentes de coffeeSoft se arman UNA vez con la variante de la
        pagina (clara u oscura) que habia al pintarse. Si el modo del servidor
        no coincide con el que este navegador tenia guardado -- otro equipo,
        otra cuenta en el mismo navegador -- lo ya pintado quedaria en la
        variante vieja: se recarga, una sola vez por modo para que un fallo no
        deje la pagina dando vueltas. */
    syncScheme() {
        const wasDark = this.darkAtLoad;
        const isDark  = document.documentElement.classList.contains('dark');

        if (wasDark === isDark) return;

        let done = '';
        try { done = sessionStorage.getItem(Navbar.RELOAD_KEY) || ''; } catch (e) { return; }
        if (done === this.current) return;

        try { sessionStorage.setItem(Navbar.RELOAD_KEY, this.current); } catch (e) { return; }
        window.location.reload();
    }

    /* El cambio corre detras del aviso "Aplicando tema": primero entra el velo
       y despues se pintan los colores. Cambiar de modo siempre cambia la
       variante de la pagina: se recarga, por lo mismo que en syncScheme(). */
    async selectMode(mode) {
        if (mode === this.current) return this.closeAll();

        const P      = window.InventoryPalette;
        const loader = P && P.loader;
        const name   = P && P.MODES[mode] ? P.MODES[mode].name : '';

        this.closeAll();

        if (loader) {
            loader.show(name);
            await new Promise((resolve) => setTimeout(resolve, 180));
        }

        this.applyMode(mode);

        // Si no se guarda, el modo ya se ve: solo no queda para otro equipo.
        await this.post({ opc: 'theme', code: mode });

        try { sessionStorage.setItem(Navbar.RELOAD_KEY, mode); } catch (e) {}
        if (loader) loader.carry(name);
        window.location.reload();
    }

    // -- Menus --

    panels() {
        return [
            { btn: 'btnUserMenu', panel: 'userMenuDropdown' },
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
        // Antes de que nada cambie el modo: con que variante se pinto la pagina.
        this.darkAtLoad = document.documentElement.classList.contains('dark');

        this.host.addEventListener('click', (e) => {
            const on = (selector) => e.target.closest(selector);

            if (on('#btnUserMenu')) return this.toggle('userMenuDropdown');
            if (on('#btnMode'))     return this.selectMode(this.current === 'dark' ? 'light' : 'dark');
            if (on('#btnNotifs'))   return this.toggle('navNotifPanel');
            if (on('#btnBranch'))   return this.toggle('branchDropdown');
            if (on('#btnLogout'))   return this.logout();

            const mode = on('.nav-mode-opt');
            if (mode) return this.selectMode(mode.dataset.mode);

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

        La barra clara lleva los neutros del login y la landing (tinta #16151C,
        linea #E8E3F0, hover #F1EDF9); la oscura (.nav-dark), los de Huubie UI.
        Los colores de marca salen de la rampa del SECUNDARIO del modo
        (--accent-2-*), que escribe InventoryPalette. Las superficies de los
        desplegables, de los tokens de pagina (--surface, --line, --ink) y, en
        pagina oscura, de los --dk-*.

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
            .navbar-main { position:relative; height:64px; min-height:64px; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:0 16px; background:#FFFFFF; border-bottom:1px solid #E8E3F0; font-family:'Inter',system-ui,sans-serif; transition:background .2s ease; }
            .navbar-main button { font-family:inherit; }
            .navbar-main [hidden] { display:none !important; }
            .navbar-main p { margin:0; }
            .navbar-main svg { flex-shrink:0; }
            .nav-left, .nav-right { display:flex; align-items:center; gap:10px; min-width:0; }
            .nav-right { flex-shrink:0; }

            /* Marca: un logo por modo y, a su lado, la empresa. */
            .nav-brand { display:flex; align-items:center; gap:12px; text-decoration:none !important; min-width:0; border-radius:8px; }
            .nav-brand:focus-visible { outline:2px solid var(--nav-accent); outline-offset:4px; }
            .nav-logo { height:42px; width:auto; display:block; flex-shrink:0; }
            .nav-logo-dark { display:none; }
            .navbar-main.nav-dark .nav-logo-light { display:none; }
            .navbar-main.nav-dark .nav-logo-dark { display:block; }
            .nav-company { padding-left:12px; border-left:1px solid #E8E3F0; font-size:13px; font-weight:600; color:#16151C; line-height:22px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:240px; }
            .nav-company:empty { display:none; }

            /* root dentro de una empresa: que no se le olvide que no es la suya. */
            .nav-viewing { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:9999px; font-size:11px; font-weight:600; color:#92400E; background:#FEF3C7; border:1px solid #FDE68A; white-space:nowrap; }
            .nav-viewing svg { width:13px; height:13px; }

            /* Botones de icono redondos, como .nav-tool-btn de erp-pro. */
            .nav-tool { position:relative; }
            .nav-tool-btn { width:38px; height:38px; display:flex; align-items:center; justify-content:center; color:#6D6977 !important; border:none; background:transparent; cursor:pointer; border-radius:9999px; transition:color .15s ease, background .15s ease; }
            .nav-tool-btn svg { width:18px; height:18px; }
            .nav-tool-btn:hover { color:#16151C !important; background:#F1EDF9; }
            .nav-tool-btn:focus-visible { outline:2px solid var(--nav-accent); outline-offset:2px; }
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
            .branch-pill-label { font-size:9px; text-transform:uppercase; letter-spacing:.14em; color:#6D6977; font-weight:600; }
            .branch-pill-name { font-size:13px; font-weight:700; color:#16151C; max-width:150px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .branch-pill-chev { width:16px; height:16px; color:#6D6977; transition:transform .2s ease; }
            #btnBranch[aria-expanded="true"] .branch-pill-chev { transform:rotate(180deg); }

            /* Desplegables: una sola piel para los tres. */
            .branch-dd, .nav-panel, .nav-dropdown { position:absolute; right:0; top:calc(100% + 10px); background:var(--nav-pop); border:1px solid var(--nav-pop-line); border-radius:14px; box-shadow:0 16px 40px rgba(17,24,39,.16); z-index:60; color:var(--nav-pop-ink); text-align:left; }
            body.dark-mode .branch-dd, body.dark-mode .nav-panel, body.dark-mode .nav-dropdown { box-shadow:0 16px 40px rgba(0,0,0,.45); }
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

            /* Modo. En la barra, un boton que muestra a donde se va: luna en
               claro, sol en oscuro. En el menu del usuario, las dos opciones. */
            .nav-mode-to-dark, .nav-mode-to-light { display:flex; }
            .nav-mode-to-light { display:none; }
            .navbar-main.nav-dark .nav-mode-to-dark { display:none; }
            .navbar-main.nav-dark .nav-mode-to-light { display:flex; }

            .nav-mode { display:flex; gap:4px; margin:12px; padding:4px; border:1px solid var(--nav-pop-line); border-radius:12px; }
            .nav-mode-opt { flex:1; display:flex; align-items:center; justify-content:center; gap:7px; height:34px; border:none; border-radius:9px; background:transparent; color:var(--nav-pop-dim); font-size:13px; font-weight:600; cursor:pointer; transition:color .15s ease, background .15s ease; }
            .nav-mode-opt svg { width:15px; height:15px; }
            .nav-mode-opt:hover { color:var(--nav-pop-ink); }
            .nav-mode-opt:focus-visible { outline:2px solid var(--nav-accent); outline-offset:2px; }
            .nav-mode-opt[aria-pressed="true"] { background:rgb(var(--primary-rgb, 80 48 165)); color:#FFFFFF; }

            /* Notificaciones */
            .nav-tool-btn { position:relative; }
            .nav-count { position:absolute; top:3px; right:3px; min-width:16px; height:16px; padding:0 4px; border-radius:9999px; background:#DC2626; color:#FFFFFF; font-size:10px; font-weight:700; line-height:16px; text-align:center; }
            .nav-notif-panel { width:300px; padding:6px; }
            .nav-notif { display:flex; align-items:flex-start; gap:10px; padding:10px; border-radius:10px; text-decoration:none !important; transition:background .15s ease; }
            .nav-notif:hover { background:var(--nav-pop-hover); }
            .nav-notif-ico { width:32px; height:32px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:var(--nav-accent-tint); color:var(--nav-accent); }
            .nav-notif-ico svg { width:16px; height:16px; }
            .nav-notif-text { display:flex; flex-direction:column; min-width:0; line-height:1.35; }
            .nav-notif-text b { font-size:13px; font-weight:700; color:var(--nav-pop-ink); }
            .nav-notif-text small { font-size:12px; color:var(--nav-pop-dim); }

            /* Usuario */
            .nav-user { position:relative; }
            .nav-user-pill { display:flex; align-items:center; gap:10px; padding:4px 8px 4px 13px; border:1px solid transparent; border-left:1px solid #E8E3F0; border-radius:8px; background:transparent; cursor:pointer; transition:background .15s ease, border-color .15s ease; }
            .nav-user-pill:hover { background:#F1EDF9; border-color:#E8E3F0; }
            .nav-avatar, .nav-head-avatar { border-radius:9999px; background:#9CA3AF; display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-weight:700; flex-shrink:0; overflow:hidden; }
            .nav-avatar { width:36px; height:36px; font-size:12.5px; }
            .nav-head-avatar { width:46px; height:46px; font-size:15px; }
            .nav-avatar img, .nav-head-avatar img { width:100%; height:100%; object-fit:cover; }
            .nav-avatar svg { width:18px; height:18px; }
            .nav-user-text { display:flex; flex-direction:column; align-items:flex-start; line-height:1.2; }
            .nav-user-name { font-size:13px; font-weight:600; color:#16151C; white-space:nowrap; max-width:170px; overflow:hidden; text-overflow:ellipsis; }
            .nav-user-rol { font-size:11px; color:#6D6977; }
            .nav-user-rol:empty { display:none; }
            .nav-chevron { width:16px; height:16px; color:#6D6977; transition:transform .2s ease; }
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
            .nav-logout { padding:0 12px 12px; }
            .nav-logout-btn { width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:11px; border:1px solid var(--nav-pop-line); color:#DC2626; border-radius:12px; font-weight:600; font-size:14px; background:transparent; cursor:pointer; transition:background .15s ease, border-color .15s ease; }
            .nav-logout-btn svg { width:16px; height:16px; }
            .nav-logout-btn:hover { background:rgba(220,38,38,.08); border-color:rgba(220,38,38,.35); }
            body.dark-mode .nav-logout-btn { color:#F87171; }

            /* ── Modo oscuro: la barra de Huubie UI (bg-header #141D2B). ── */
            .navbar-main.nav-dark { background:#141D2B; border-bottom-color:#374151; }
            .navbar-main.nav-dark .nav-company { border-left-color:rgba(255,255,255,.15); }
            .navbar-main.nav-dark .nav-company,
            .navbar-main.nav-dark .nav-user-name,
            .navbar-main.nav-dark .branch-pill-name { color:#F8FAFC; }
            .navbar-main.nav-dark .nav-user-pill .nav-user-rol,
            .navbar-main.nav-dark .branch-pill-label { color:rgba(255,255,255,.62); }
            .navbar-main.nav-dark .nav-chevron,
            .navbar-main.nav-dark .branch-pill-chev { color:#CBD5E1; }
            .navbar-main.nav-dark .nav-user-pill { border-left-color:rgba(255,255,255,.15); }
            .navbar-main.nav-dark .nav-user-pill:hover { background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.15); }
            .navbar-main.nav-dark .nav-avatar { box-shadow:0 0 0 1px rgba(255,255,255,.25); }
            .navbar-main.nav-dark .branch-pill { background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.18); }
            .navbar-main.nav-dark .branch-pill:not(.branch-pill-static):hover { background:rgba(255,255,255,.14); border-color:rgba(255,255,255,.30); }
            .navbar-main.nav-dark .branch-pill-icon { background:rgba(255,255,255,.14); color:#FFFFFF; }
            .navbar-main.nav-dark .nav-tool-btn { color:#CBD5E1 !important; }
            .navbar-main.nav-dark .nav-tool-btn:hover,
            .navbar-main.nav-dark .nav-tool-btn[aria-expanded="true"] { color:#FFFFFF !important; background:rgba(255,255,255,.10); }

            /* ── Telefono (< 768px): quedan el logo sin la empresa, la sucursal
               (sin icono ni flecha) y el avatar. Empresas pasa al menu del
               usuario, donde tambien esta el modo. Los desplegables van a lo
               ancho de la pantalla para no salirse por la izquierda. ── */
            @media (max-width: 767.98px) {
                .navbar-main { padding:0 10px; gap:8px; }
                .nav-right { gap:6px; flex-shrink:1; }
                .navbar-main .nav-company,
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
                .branch-dd, .nav-panel, .nav-dropdown { position:fixed; left:10px; right:10px; top:70px; width:auto; }
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
