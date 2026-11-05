// Portado de inventory/acceso/src/js/sidebar.js: el rail de iconos con las
// secciones del modulo a las que el usuario tiene acceso.
class Sidebar {
    // Menu dinamico: las opciones salen de las secciones permitidas (ctrl-nav ::
    // menu), debajo del Inicio fijo. Fail-closed: si no hay permisos o falla la
    // carga, solo queda Inicio.
    // El rail se pinta de inmediato con el menu que ya trajo otra pagina del mismo
    // modulo en esta pestaña (sessionStorage) y se corrige cuando responde el servidor.
    async init(options) {
        this.injectStyles();

        const guardado = this.menuGuardado();
        this.render(Object.assign({ menuItems: guardado || [] }, options));
        this.renderOverlay();
        this.initEvents();
        this.highlightCurrentRoute();
        this.loadDarkMode();
        this.loadHidden();
        this.handleResize();
        this.paintIcons();

        const menuItems = await this.fetchMenu();
        this.guardarMenu(menuItems);
        if (JSON.stringify(menuItems) === JSON.stringify(guardado)) return;

        this.render(Object.assign({ menuItems }, options));
        this.highlightCurrentRoute();
        this.paintIcons();
    }

    paintIcons() {
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // -- Menu guardado --
    // Una clave por modulo (la carpeta de la pagina): todas sus paginas comparten el menu.

    claveMenu() {
        return Sidebar.CLAVE_MENU + this.currentModulePath().replace(/[^/]*$/, '');
    }

    menuGuardado() {
        try {
            const items = JSON.parse(sessionStorage.getItem(this.claveMenu()) || 'null');
            return Array.isArray(items) ? items : null;
        } catch (e) {
            return null;
        }
    }

    guardarMenu(items) {
        try {
            if (items.length) sessionStorage.setItem(this.claveMenu(), JSON.stringify(items));
            else sessionStorage.removeItem(this.claveMenu());
        } catch (e) { /* sin almacenamiento: se pinta igual, solo que sin adelanto */ }
    }

    static get CLAVE_MENU() {
        return 'pro:sidebar:';
    }

    // Preferencia de este navegador, no de la sesión: en localStorage y fuera del
    // prefijo pro:sidebar:, que el logout borra.
    static get CLAVE_OCULTO() {
        return 'huubie:pro:sidebar-hidden';
    }

    // Base del host hasta /pro (ej. "/huubie/pro" o "/pro").
    proBase() {
        const p = window.location.pathname;
        const i = p.indexOf('/pro/');
        return i >= 0 ? p.slice(0, i + '/pro'.length) : '/pro';
    }

    // Ruta de la pagina relativa a pro/ (ej. "app/developer/accesos.php"):
    // identifica el modulo para acotar las secciones del rail.
    currentModulePath() {
        const p = window.location.pathname;
        const i = p.indexOf('/pro/');
        return i >= 0 ? p.slice(i + '/pro/'.length) : '';
    }

    async fetchMenu() {
        const base = this.proBase();
        try {
            const res = await fetch(base + '/auth/ctrl/ctrl-nav.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'opc=menu&module=' + encodeURIComponent(this.currentModulePath())
            });
            const data = await res.json();
            return ((data && data.items) || []).map((it) => ({
                icon: it.icon || 'square',
                title: it.title || '',
                // route viene relativa a pro/ (ej. app/developer/accesos.php)
                url: base + '/' + String(it.route || '').replace(/^\/+/, '')
            }));
        } catch (e) {
            return []; // fail-closed
        }
    }

    injectStyles() {
        if ($('#sidebar-responsive-styles').length === 0) {
            $('head').append(`
                <style id="sidebar-responsive-styles">
                    /* Las transiciones esperan a sidebar-animated (loadHidden): sin eso,
                       entrar con el menú oculto lo vería salir deslizándose. */
                    body.sidebar-animated #menu-sidebar { transition: transform 0.3s ease-in-out; }
                    @media (max-width: 1023px) {
                        body { padding-left: 0 !important; width: 100% !important; overflow-x: hidden; }
                        main { width: 100% !important; max-width: 100vw !important; }
                        #main__content { width: 100% !important; max-width: 100% !important; overflow-x: auto; }
                        #menu-sidebar { transform: translateX(-100%); z-index: 40; }
                        #menu-sidebar.sidebar-open { transform: translateX(0); }
                    }
                    @media (min-width: 1024px) {
                        #menu-sidebar { transform: translateX(0) !important; }
                        #sidebar-overlay { display: none !important; }
                        /* Oculto con el botón de la navbar: el rail sale y el contenido
                           toma sus 60px (el padding-left que le reserva general.css). */
                        body.sidebar-hidden #menu-sidebar { transform: translateX(-100%) !important; }
                        body.sidebar-hidden { padding-left: 0; }
                        body.sidebar-animated { transition: padding-left 0.3s ease-in-out; }
                    }
                </style>
            `);
        }
    }

    // Inicio va siempre primero y no depende de permisos. index.php manda a cada
    // quien a su inicio (root a empresas).
    homeItem() {
        return {
            icon: 'house',
            title: 'Inicio',
            url: this.proBase() + '/index.php'
        };
    }

    render(options) {
        const defaults = {
            parent: '#menu-sidebar',
            menuItems: []
        };

        this.settings = Object.assign({}, defaults, options);
        this.parent = $(this.settings.parent);
        this.isOpen = false;

        this.parent.html(`
            ${this.createMenuItems([this.homeItem(), ...this.settings.menuItems])}
            <div class="flex-1"></div>
        `);
        this.parent.addClass('sidebar-container');
    }

    renderOverlay() {
        if ($('#sidebar-overlay').length === 0) {
            $('body').append('<div id="sidebar-overlay" class="fixed inset-0 bg-black bg-opacity-50 z-30 hidden"></div>');
        }
    }

    handleResize() {
        const checkWidth = () => {
            if (window.innerWidth >= 1024) {
                this.parent.removeClass('sidebar-open');
                $('#sidebar-overlay').addClass('hidden');
                this.isOpen = false;
            }
            this.syncButton();
        };
        checkWidth();
        $(window).on('resize', checkWidth);
    }

    // Escritorio: el botón oculta o muestra el rail. Móvil: abre el cajón con el fondo oscuro.
    toggle() {
        if (window.innerWidth >= 1024) {
            this.setHidden(!$('body').hasClass('sidebar-hidden'));
            return;
        }

        if (this.isOpen) {
            this.parent.removeClass('sidebar-open');
            $('#sidebar-overlay').addClass('hidden');
        } else {
            this.parent.addClass('sidebar-open');
            $('#sidebar-overlay').removeClass('hidden');
        }
        this.isOpen = !this.isOpen;
        this.syncButton();
    }

    // Las tablas y gráficas miden su ancho al pintarse: el resize al terminar la
    // transición les avisa que el contenido cambió de ancho.
    setHidden(hidden) {
        $('body').toggleClass('sidebar-hidden', hidden);
        try {
            localStorage.setItem(Sidebar.CLAVE_OCULTO, hidden ? 'true' : 'false');
        } catch (e) {}
        this.syncButton();
        setTimeout(() => window.dispatchEvent(new Event('resize')), 320);
    }

    // El estado guardado se aplica sin animar; las transiciones se encienden dos
    // cuadros después, ya pintada la página.
    loadHidden() {
        try {
            if (localStorage.getItem(Sidebar.CLAVE_OCULTO) === 'true') $('body').addClass('sidebar-hidden');
        } catch (e) {}
        requestAnimationFrame(() => requestAnimationFrame(() => $('body').addClass('sidebar-animated')));
    }

    syncButton() {
        const desktop = window.innerWidth >= 1024;
        const shown = desktop ? !$('body').hasClass('sidebar-hidden') : this.isOpen;

        $('#btn-menu').attr({
            title: desktop ? (shown ? 'Ocultar menú' : 'Mostrar menú') : 'Menú',
            'aria-expanded': shown ? 'true' : 'false'
        });
    }

    createMenuItems(menuItems) {
        return menuItems
            .map((item) => {
                const title = $('<div>').text(item.title || '').html();

                return `
                    <button class="menu-rail-item" data-url="${item.url}" title="${title}">
                        <i data-lucide="${item.icon}"></i>
                        <span class="menu-rail-label">${title}</span>
                    </button>
                `;
            })
            .join('');
    }

    initEvents() {
        this.parent.on('click', 'button[data-url]', (e) => {
            if (window.innerWidth < 1024) this.toggle();
            window.location.href = $(e.currentTarget).data('url');
        });

        $(document).on('click', '#sidebar-overlay', () => this.toggle());
        $(document).on('click', '#btn-menu', () => this.toggle());
    }

    loadDarkMode() {
        try {
            if (localStorage.getItem('huubie:pro:dark') === 'true') $('body').addClass('dark-mode');
        } catch (e) {}
    }

    highlightCurrentRoute() {
        // Sin index.php ni barra final, para comparar sin el prefijo del host.
        const norm = (p) => String(p || '').replace(/index\.php$/i, '').replace(/\/+$/, '');
        const currentUrl = norm(window.location.pathname);

        let matched = null;
        let matchedLen = -1;
        this.parent.find('button[data-url]').each(function () {
            const url = norm($(this).data('url'));
            if (!url) return;
            // El match mas largo gana: la seccion le gana a Inicio.
            if ((currentUrl === url || currentUrl.endsWith(url)) && url.length > matchedLen) {
                matched = $(this);
                matchedLen = url.length;
            }
        });

        if (matched) matched.addClass('is-active');
    }
}

// Arranca en cuanto se carga el script (va al final del body, cuando #menu-sidebar
// ya existe): la consulta del menu sale antes que las del modulo.
(() => {
    const sidebar = new Sidebar();
    if (document.getElementById('menu-sidebar')) sidebar.init({});
    else $(() => sidebar.init({}));
})();
