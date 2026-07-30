// -- Rutas del modulo --

// Menu propio del Facturador: no consulta ctrl-access.php de app/ porque el
// modulo vivira en otra base de datos. Las secciones son fijas.
// El icono es de Lucide: el rail lo pinta arriba y el nombre debajo.
const FACTURE_MENU = [
    { icon: 'home',             title: 'Inicio',    url: '/app/facture/index.php'     },
    // Resumen queda oculto del rail: la pagina sigue viva en /app/facture/resumen.php.
    // { icon: 'layout-dashboard', title: 'Resumen',   url: '/app/facture/resumen.php'   },
    { icon: 'upload',           title: 'Cargas',    url: '/app/facture/cargas.php'    },
    { icon: 'receipt-text',     title: 'Ventas',    url: '/app/facture/ventas.php'    },
    { icon: 'file-text',        title: 'Tickets',   url: '/app/facture/tickets.php'   },
    { icon: 'book-open',        title: 'Catalogos', url: '/app/facture/catalogos.php' }
];

// Alto real del navbar (nav h-12 en navbar-huubie.js). El rail arranca debajo.
const FACTURE_NAVBAR_H = 48;

// -- Sidebar --

// Rail portado de inventory/acceso/src/js/sidebar.js: icono arriba, nombre
// debajo y marcador de acento en el item activo. Diferencias con el original:
// el menu es fijo (alla sale de permisos via fetch) y la paleta es la dark del
// Facturador, no la clara de inventory.
class Sidebar {

    init(options) {
        this.injectStyles();
        this.render(options);
        this.renderOverlay();
        this.initEvents();
        this.highlightCurrentRoute();
        this.handleResize();
        if (window.lucide) lucide.createIcons();

        // Ya asentado el layout: a partir de aqui si se anima el toggle movil.
        requestAnimationFrame(() => this.parent.addClass('is-ready'));
    }

    // -- Estilos --

    // Van inyectados y no en facture.css porque ese archivo esta scopeado bajo
    // #root justamente para no pisar navbar ni sidebar.
    injectStyles() {
        if ($('#sidebar-huubie-styles').length) return;

        const rail = FACTURE_PALETTE.rail;

        $('head').append(`
            <style id="sidebar-huubie-styles">
                #menu-sidebar {
                    position: fixed;
                    left: 0;
                    top: ${FACTURE_NAVBAR_H}px;
                    width: 60px;
                    height: calc(100vh - ${FACTURE_NAVBAR_H}px);
                    z-index: 40;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    padding: 16px 6px;
                    background: ${rail.bg};
                    border-right: 1px solid ${rail.border};
                    /* overflow-x explicito: con solo overflow-y:auto el navegador
                       calcula overflow-x:auto y, como los items ocupan los 60px
                       exactos del rail, salia una barra horizontal al pie. */
                    overflow-y: auto;
                    overflow-x: hidden;
                    scrollbar-width: none;
                }

                #menu-sidebar::-webkit-scrollbar { width: 0; height: 0; }

                /* La transicion entra un frame despues del render (clase is-ready):
                   si viviera en la regla de arriba, el rail se deslizaria solo al
                   cargar, porque el transform pasa de none a su valor inicial. */
                #menu-sidebar.is-ready { transition: transform .3s ease-in-out; }

                /* El rail es fixed (fuera del flujo), asi que el contenido se
                   aparta con padding, igual que el body de inventory.
                   transition:none anula el transition-all duration-500 que
                   #mainContainer trae en el HTML: sin esto el padding se animaba
                   de 0 a 60px en cada carga y el modulo entraba desplazandose. */
                #mainContainer {
                    padding-left: 60px;
                    transition: none;
                }

                .menu-rail-item {
                    position: relative;
                    width: 48px;
                    min-height: 46px;
                    border-radius: 11px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 3px;
                    padding: 7px 2px;
                    color: ${rail.item};
                    background: transparent;
                    border: 1px solid transparent;
                    cursor: pointer;
                    text-align: center;
                    transition: color .15s ease, background .15s ease, border-color .15s ease;
                }

                .menu-rail-item i,
                .menu-rail-item svg { width: 19px; height: 19px; flex-shrink: 0; }

                .menu-rail-label {
                    font-size: 8.5px;
                    font-weight: 600;
                    letter-spacing: .01em;
                    line-height: 1;
                    white-space: nowrap;
                }

                .menu-rail-item:hover {
                    color: ${rail.hoverText};
                    background: ${rail.hoverBg};
                    border-color: rgba(55, 65, 81, .4);
                }

                .menu-rail-item.is-active {
                    color: ${rail.activeText};
                    background: rgba(28, 100, 242, .18);
                    border-color: rgba(28, 100, 242, .22);
                }

                @media (max-width: 1023px) {
                    #menu-sidebar { transform: translateX(-100%); }
                    #menu-sidebar.sidebar-open { transform: translateX(0); }
                    #mainContainer { padding-left: 0; }
                }

                @media (min-width: 1024px) {
                    #menu-sidebar { transform: translateX(0) !important; }
                    /* En escritorio el rail siempre esta visible: el toggle del
                       navbar y el velo solo aplican en movil. */
                    #sidebar-overlay, #toggleSidebar { display: none !important; }
                }
            </style>
        `);
    }

    // -- Render --

    render(options) {
        const defaults = {
            parent:    '#menu-sidebar',
            menuItems: FACTURE_MENU
        };

        this.settings = Object.assign({}, defaults, options);
        this.parent   = $(this.settings.parent);
        this.isOpen   = false;

        this.parent.html(this.createMenuItems(this.settings.menuItems));
    }

    createMenuItems(menuItems) {
        return menuItems.map((item) => `
            <button class="menu-rail-item" data-url="${item.url}" title="${item.title}">
                <i data-lucide="${item.icon}"></i>
                <span class="menu-rail-label">${item.title}</span>
            </button>`).join('');
    }

    renderOverlay() {
        if ($('#sidebar-overlay').length) return;
        $('body').append('<div id="sidebar-overlay" class="fixed inset-0 bg-black bg-opacity-50 z-30 hidden"></div>');
    }

    // -- Eventos --

    initEvents() {
        this.parent.on('click', 'button[data-url]', (e) => {
            const url = $(e.currentTarget).data('url');
            if (window.innerWidth < 1024) this.toggle();
            window.location.href = url;
        });

        // El boton ☰ lo pinta navbar-huubie.js, que se carga antes que este script.
        $('#toggleSidebar').on('click', () => this.toggle());
        $(document).on('click', '#sidebar-overlay', () => this.toggle());
    }

    toggle() {
        this.parent.toggleClass('sidebar-open', !this.isOpen);
        $('#sidebar-overlay').toggleClass('hidden', this.isOpen);
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
        // Normaliza rutas para que index.php y la carpeta cuenten como la misma,
        // y se queda con el match mas largo (el mas especifico).
        const norm       = (p) => String(p || '').replace(/index\.php$/i, '').replace(/\/+$/, '');
        const currentUrl = norm(window.location.pathname);

        let matched    = null;
        let matchedLen = -1;

        this.parent.find('button[data-url]').each(function () {
            const url = norm($(this).data('url'));
            if (!url) return;
            if ((currentUrl === url || currentUrl.endsWith(url)) && url.length > matchedLen) {
                matched    = $(this);
                matchedLen = url.length;
            }
        });

        if (matched) matched.addClass('is-active');
    }
}

$(() => {
    const sidebar = new Sidebar();
    sidebar.init({ parent: '#menu-sidebar' });
});
