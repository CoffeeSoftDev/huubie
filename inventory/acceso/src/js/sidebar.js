class Sidebar {
    // Menú dinámico: las opciones salen de las secciones a las que el usuario tiene
    // permiso (endpoint menu), debajo del Inicio fijo. Fail-closed: si no hay permisos o
    // falla la carga, solo queda Inicio.
    // El rail se pinta de inmediato con el menú que ya trajo otra página del mismo módulo
    // en esta pestaña (sessionStorage) y se corrige cuando responde el servidor: antes
    // quedaba vacío hasta que llegaba la respuesta.
    async init(options) {
        this.injectStyles();

        const guardado = this.menuGuardado();
        this.render(Object.assign({ menuItems: guardado || [] }, options));
        this.renderOverlay();
        this.initEvents();
        this.highlightCurrentRoute();
        this.loadDarkMode();
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

    // -- Menú guardado --
    // Una clave por módulo (la carpeta de la página): todas sus páginas comparten el menú.
    // sessionStorage vive lo que la pestaña; al cerrar sesión se borra (navbar.logout).

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

    static olvidarMenus() {
        try {
            Object.keys(sessionStorage).filter(k => k.startsWith(Sidebar.CLAVE_MENU)).forEach(k => sessionStorage.removeItem(k));
        } catch (e) { /* nada que borrar */ }
    }

    static get CLAVE_MENU() {
        return 'inv:sidebar:';
    }

    // Base del host hasta /inventory/ (ej. "/huubie/inventory" o "/inventory").
    inventoryBase() {
        const p = window.location.pathname;
        const i = p.indexOf('/inventory/');
        return i >= 0 ? p.slice(0, i + '/inventory'.length) : '/inventory';
    }

    // Ruta de la pagina actual relativa a /inventory/ (ej. "operacion/almacen/stock.php"
    // o "configuracion/"). Identifica el modulo para acotar las secciones del rail.
    currentModulePath() {
        const p = window.location.pathname;
        const i = p.indexOf('/inventory/');
        return i >= 0 ? p.slice(i + '/inventory/'.length) : '';
    }

    // Trae las secciones permitidas del modulo actual y las mapea a items del rail.
    async fetchMenu() {
        const base = this.inventoryBase();
        const modulePath = this.currentModulePath();
        try {
            const res = await fetch(base + '/acceso/ctrl/ctrl-access.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'opc=menu&module=' + encodeURIComponent(modulePath)
            });
            const data = await res.json();
            const items = (data && data.items) || [];
            return items.map((it) => ({
                icon: it.icon || 'square',
                title: it.title || '',
                // route viene relativa a inventory/ (ej. operacion/almacen/stock.php)
                url: base + '/' + String(it.route || '').replace(/^\/+/, '')
            }));
        } catch (e) {
            return []; // fail-closed
        }
    }

    injectStyles() {
        if ($("#sidebar-responsive-styles").length === 0) {
            const styles = `
                <style id="sidebar-responsive-styles">
                    #menu-sidebar { transition: transform 0.3s ease-in-out; }
                    @media (max-width: 1023px) {
                        body { 
                            padding-left: 0 !important; 
                            width: 100% !important;
                            overflow-x: hidden;
                        }
                        main {
                            width: 100% !important;
                            max-width: 100vw !important;
                        }
                        #main__content {
                            width: 100% !important;
                            max-width: 100% !important;
                            overflow-x: auto;
                        }
                        #menu-sidebar {
                            transform: translateX(-100%);
                            z-index: 40;
                        }
                        #menu-sidebar.sidebar-open { transform: translateX(0); }
                    }
                    @media (min-width: 1024px) {
                        #menu-sidebar { transform: translateX(0) !important; }
                        #sidebar-overlay, #btn-mobile-menu { display: none !important; }
                    }
                </style>
            `;
            $("head").append(styles);
        }
    }

    // Inicio: las cards de módulos. Va siempre primero y no depende de permisos.
    homeItem() {
        return {
            icon: "house",
            title: "Inicio",
            url: this.inventoryBase() + "/modulos/"
        };
    }

    render(options) {
        // Fail-closed: sin items (sin permisos o fallo de carga) el rail solo trae Inicio.
        const defaults = {
            parent: "#menu-sidebar",
            logo: "../../src/img/logos/coffee_icon.png",
            menuItems: [],
        };

        this.settings = Object.assign({}, defaults, options);
        this.parent = $(this.settings.parent);
        this.isOpen = false;

        const sidebarHtml = `
            ${this.createMenuItems([this.homeItem(), ...this.settings.menuItems])}
            <div class="flex-1"></div>
        `;

        this.parent.html(sidebarHtml);
        this.parent.addClass("sidebar-container");
    }

    renderOverlay() {
        if ($("#sidebar-overlay").length === 0) {
            $("body").append('<div id="sidebar-overlay" class="fixed inset-0 bg-black bg-opacity-50 z-30 hidden"></div>');
        }
    }

    handleResize() {
        const checkWidth = () => {
            if (window.innerWidth >= 1024) {
                this.parent.removeClass("sidebar-open");
                $("#sidebar-overlay").addClass("hidden");
                this.isOpen = false;
            }
        };
        checkWidth();
        $(window).on("resize", checkWidth);
    }

    toggle() {
        if (this.isOpen) {
            this.parent.removeClass("sidebar-open");
            $("#sidebar-overlay").addClass("hidden");
        } else {
            this.parent.addClass("sidebar-open");
            $("#sidebar-overlay").removeClass("hidden");
        }
        this.isOpen = !this.isOpen;
    }

    createMenuItems(menuItems) {
        return menuItems
            .map((item) => {
                const activeClass = item.active ? "is-active" : "";
                const dataAttr = item.url ? `data-url="${item.url}"` : item.action ? `data-action="${item.action}"` : "";
                const title = item.title || "";

                // Estilo rail del Visor: icono arriba, nombre debajo.
                return `
                    <button class="menu-rail-item ${activeClass}" ${dataAttr} title="${title}">
                        <i data-lucide="${item.icon}"></i>
                        <span class="menu-rail-label">${title}</span>
                    </button>
                `;
            })
            .join("");
    }

    initEvents() {
        const self = this;

        this.parent.on("click", "button[data-url]", (e) => {
            const url = $(e.currentTarget).data("url");
            if (window.innerWidth < 1024) self.toggle();
            window.location.href = url;
        });

        this.parent.on("click", "button[data-action='search']", () => this.handleSearch());
        this.parent.on("click", "button[data-action='notifications']", () => this.handleNotifications());

        $(document).on("click", "#sidebar-overlay", () => self.toggle());
        $(document).on("click", "#btn-mobile-menu", () => self.toggle());
    }

    handleSearch() {
        console.log("Búsqueda activada");
    }

    handleNotifications() {
        console.log("Notificaciones");
    }

    loadDarkMode() {
        if (localStorage.getItem("darkMode") === "true") {
            $("body").addClass("dark-mode");
        }
    }

    highlightCurrentRoute() {
        // Normaliza rutas: sin index.php ni barra final, para comparar
        // ignorando el prefijo del host (p.ej. /huubie/...) y el archivo.
        const norm = (p) => String(p || "").replace(/index\.php$/i, "").replace(/\/+$/, "");
        const currentUrl = norm(window.location.pathname);

        let matched = null;
        let matchedLen = -1;
        this.parent.find("button[data-url]").each(function () {
            const url = norm($(this).data("url"));
            if (!url) return;
            // Coincide si la ruta actual termina con la url del item.
            // Nos quedamos con el match mas largo (mas especifico).
            if ((currentUrl === url || currentUrl.endsWith(url)) && url.length > matchedLen) {
                matched = $(this);
                matchedLen = url.length;
            }
        });

        if (matched) {
            matched.addClass("is-active");
        }
    }
}

// Arranca en cuanto se carga el script (va al final del body, cuando #menu-sidebar ya
// existe): la consulta del menú sale antes que las del módulo, que esperan al DOM, y no
// se forma detrás de ellas por el candado de la sesión. Sin el contenedor, espera al DOM.
(() => {
    const sidebar = new Sidebar();
    if (document.getElementById('menu-sidebar')) sidebar.init({});
    else $(() => sidebar.init({}));
})();