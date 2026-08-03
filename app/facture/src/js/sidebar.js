// -- Rutas del modulo --

// Rail estatico: app/ no expone el endpoint de menus del ERP (ctrl-access.php
// opc=menu), asi que las secciones del Facturador viven aqui, sin fetch.
const FACTURE_MENU = [
    { icon: 'layout-grid',      title: 'Inicio',      url: '/app/facture/index.php'     },
    { icon: 'layout-dashboard', title: 'Resumen',     url: '/app/facture/resumen.php'   },
    { icon: 'upload-cloud',     title: 'Importación', url: '/app/facture/cargas.php'    },
    { icon: 'receipt',          title: 'Ventas',      url: '/app/facture/ventas.php'    },
    { icon: 'printer',          title: 'Tickets',     url: '/app/facture/tickets.php'   },
    { icon: 'library',          title: 'Catalogos',   url: '/app/facture/catalogos.php' }
];

// -- Sidebar --

class Sidebar {

    init(options) {
        this.injectStyles();
        this.render(Object.assign({ menuItems: FACTURE_MENU }, options));
        this.renderOverlay();
        this.initEvents();
        this.highlightCurrentRoute();
        this.loadDarkMode();
        this.handleResize();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // -- Estilos --

    injectStyles() {
        if ($('#sidebar-responsive-styles').length) return;

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

        $('head').append(styles);
    }

    // -- Render --

    render(options) {
        const defaults = {
            parent:    '#menu-sidebar',
            menuItems: []
        };

        this.settings = Object.assign({}, defaults, options);
        this.parent   = $(this.settings.parent);
        this.isOpen   = false;

        this.parent.html(`
            ${this.createMenuItems(this.settings.menuItems)}
            <div class="flex-1"></div>
        `);

        this.parent.addClass('sidebar-container');
    }

    createMenuItems(menuItems) {
        return menuItems.map((item) => {
            const title = item.title || '';

            // Estilo rail del Visor: icono arriba, nombre debajo.
            return `
                <button class="menu-rail-item" data-url="${item.url}" title="${title}">
                    <i data-lucide="${item.icon}"></i>
                    <span class="menu-rail-label">${title}</span>
                </button>
            `;
        }).join('');
    }

    renderOverlay() {
        if ($('#sidebar-overlay').length) return;
        $('body').append('<div id="sidebar-overlay" class="fixed inset-0 bg-black bg-opacity-50 z-30 hidden"></div>');
    }

    // -- Eventos --

    initEvents() {
        const self = this;

        this.parent.on('click', 'button[data-url]', (e) => {
            const url = $(e.currentTarget).data('url');
            if (window.innerWidth < 1024) self.toggle();
            window.location.href = url;
        });

        $(document).on('click', '#sidebar-overlay', () => self.toggle());
        $(document).on('click', '#btn-mobile-menu', () => self.toggle());
    }

    toggle() {
        if (this.isOpen) {
            this.parent.removeClass('sidebar-open');
            $('#sidebar-overlay').addClass('hidden');
        } else {
            this.parent.addClass('sidebar-open');
            $('#sidebar-overlay').removeClass('hidden');
        }

        this.isOpen = !this.isOpen;
    }

    handleResize() {
        const checkWidth = () => {
            if (window.innerWidth < 1024) return;
            this.parent.removeClass('sidebar-open');
            $('#sidebar-overlay').addClass('hidden');
            this.isOpen = false;
        };

        checkWidth();
        $(window).on('resize', checkWidth);
    }

    // -- Estado --

    highlightCurrentRoute() {
        // Normaliza rutas: sin index.php ni barra final, para comparar ignorando
        // el prefijo del host (p.ej. /huubie/app/...) y el archivo indice.
        const norm       = (p) => String(p || '').replace(/index\.php$/i, '').replace(/\/+$/, '');
        const currentUrl = norm(window.location.pathname);

        let matched    = null;
        let matchedLen = -1;

        this.parent.find('button[data-url]').each(function () {
            const url = norm($(this).data('url'));
            if (!url) return;

            // Coincide si la ruta actual termina con la url del item. Nos quedamos
            // con el match mas largo (el mas especifico).
            if ((currentUrl === url || currentUrl.endsWith(url)) && url.length > matchedLen) {
                matched    = $(this);
                matchedLen = url.length;
            }
        });

        if (matched) matched.addClass('is-active');
    }

    loadDarkMode() {
        if (localStorage.getItem('darkMode') === 'true') $('body').addClass('dark-mode');
    }
}

$(() => {
    const sidebar = new Sidebar();
    sidebar.init({});
});
