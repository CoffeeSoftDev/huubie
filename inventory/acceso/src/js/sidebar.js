class Sidebar {
    init(options) {
        this.injectStyles();
        this.render(options);
        this.renderOverlay();
        this.initEvents();
        this.highlightCurrentRoute();
        this.loadDarkMode();
        this.handleResize();
        if (typeof lucide !== 'undefined') lucide.createIcons();
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

    render(options) {
        const defaults = {
            parent: "#menu-sidebar",
            logo: "../../src/img/logos/coffee_icon.png",
            menuItems: [
                { icon: "arrow-down-to-line", url: "/inventory/operacion/almacen/entradas.php", title: "Entradas" },
                // { icon: "contact", url: "/inventory/operacion/almacen/reporte.php", title: "Reportes" },
                // { icon: "gauge", url: "/inventory/finanzas/administrador/", title: "Dashboard" },
                { icon: "arrow-up-from-line", url: "/inventory/operacion/almacen/salidas.php", title: "Salidas" },
                { icon: "house", url: "/inventory/operacion/almacen/", title: "Admin" },
                { icon: "shield-user", url: "/inventory/admin/accesos/", title: "Accesos" },
            ],
        };

        this.settings = Object.assign({}, defaults, options);
        this.parent = $(this.settings.parent);
        this.isOpen = false;

        const sidebarHtml = `
            ${this.createMenuItems(this.settings.menuItems)}
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

$(async () => {
    let sidebar = new Sidebar();
    sidebar.init({});
});