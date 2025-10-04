class Sidebar {
    init(options) {
        this.render(options);
        this.initEvents();
        this.highlightCurrentRoute(); // Resalta la ruta actual al iniciar
    }

    render(options) {
        const defaults = {
            parent: "body",
            menuItems: [
                {
                    text: "Ventas",
                    submenu: [
                        { text: "Eventos", url: "/dev/eventos/" },
                        { text: "Pedidos", url: "/dev/pedidos/" },
                    ],
                },
            ],
        };

        this.settings = Object.assign({}, defaults, options);
        this.parent = $(this.settings.parent);

        const sidebarHtml =
            `<div id="sidebar" class="mt-14 fixed top-0 left-0 h-[calc(100vh-3.5rem)] bg-[#1F2A37] w-full md:w-72 transform -translate-x-full transition-transform duration-500 ease-in-out z-40 overflow-y-auto" style="transform: translateX(-100%);">
                <h5 class="text-white pt-4 font-semibold ps-7">Huubie</h5>
            <ul class="space-y-4 p-6" id="menuSidebar">
                    ${this.createMenuItems(this.settings.menuItems)}
                </ul>
            </div>`
            ;
        this.parent.prepend(sidebarHtml);
    }

    createMenuItems(menuItems) {
        return menuItems
            .map((item) => {
                if (item.submenu) {
                    return `<li class="submenu text-gray-400">
                        <button class="submenucito w-full text-left flex items-center justify-between text-base font-medium px-3 py-2 rounded-lg hover:bg-gray-700 hover:text-white transition">
                            <span class="flex items-center gap-2">
                               <img src="https://huubie.com.mx/dev/src/img/ventas-menu.svg" alt="icono" class="w-5 h-5" />
                                ${item.text}
                            </span>
                            <svg class="h-5 w-5 text-gray-400 group-hover:text-white transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                        <ul class="mt-2 pl-4 space-y-2 hidden">
                            ${this.createMenuItems(item.submenu)}
                        </ul>
                    </li>`;
                }
                return `<li class='rounded-lg'><a href="${item.url}" class="block text-sm text-gray-400 hover:text-white hover:bg-gray-700 transition px-3 py-2 rounded-lg">${item.text}</a></li>`;
            })
            .join("");
    }

    initEvents() {
        // Evento para manejar el despliegue de submenús
        $(".submenu > button").on("click", (e) => this.toggleSubmenu(e));
    }

    toggleSubmenu(e) {
        const submenu = $(e.target).closest("li").find("ul");

        // Cerrar todos los submenús antes de abrir el actual con animación
        $(".submenu > ul").not(submenu).slideUp(300);

        // Abrir o cerrar el submenú clicado con animación
        submenu.stop(true, true).slideToggle(300);
    }

    highlightCurrentRoute() {
        const currentUrl = window.location.pathname;

        $("#menuSidebar a").each(function () {
            const url = $(this);
            if (url.attr("href") === currentUrl) {
                url.addClass("text-white font-bold"); // Resalta el enlace
                url.closest("ul").slideDown(300); // Abre el submenú si está cerrado
                url.closest("li").addClass("text-white"); // Cambia el color del texto del li
                url.closest("li").addClass("bg-[#374151]"); // Cambia el color del texto del li
            }
        });
    }
}

$(async () => {
    rutes = await useFetch({ url: "/dev/access/ctrl/ctrl-access.php", data: { opc: 'sidebar' } });

    let sidebar = new Sidebar();
    sidebar.init({
        parent: "#menu-sidebar", // Si deseas cambiar el contenedor padre
        menuItems: rutes
    });
});