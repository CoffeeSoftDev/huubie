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
                { icon: "house", url: "/inventory/operacion/almacen/", title: "Inicio" },
                { icon: "contact", url: "/inventory/operacion/almacen/reporte.php", title: "Reportes" },
                { icon: "gauge", url: "/inventory/finanzas/administrador/", title: "Dashboard" },
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
                const activeClass = item.active ? "bg-[#C05A40]" : "";
                const dataAttr = item.url ? `data-url="${item.url}"` : item.action ? `data-action="${item.action}"` : "";
                const title = item.title || "";
                
                return `
                    <button class="w-12 h-12 ${activeClass} hover:bg-[#C05A40] rounded-xl flex items-center justify-center transition" ${dataAttr} title="${title}">
                        <i data-lucide="${item.icon}" class="${item.active ? 'text-white' : 'text-gray-400 hover:text-white'} w-6 h-6"></i>
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
            matched.addClass("bg-[#C05A40]");
            matched.find("i").removeClass("text-gray-400").addClass("text-white");
        }
    }
}

$(async () => {
    let sidebar = new Sidebar();
    sidebar.init({});
});