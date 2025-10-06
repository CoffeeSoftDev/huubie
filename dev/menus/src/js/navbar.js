class Navbar {
    init(options) {
        this.render(options);
        this.initEvents();
    }

    render(options) {
        const defaults = {
            logo: "/alpha/src/img/logo/logo.svg",
            imgPerfil: "/alpha/src/img/df-user.png",
            company: "Compañia",
            username: "Usuario",
            parent: "body",
        };

        this.settings = Object.assign({}, defaults, options);
        this.parent = $(this.settings.parent);

        const navbarHtml = `
            <nav class="bg-[#1A1A2E] fixed top-0 left-0 w-full text-white px-4 py-3 h-16 z-50 shadow flex items-center justify-between">
                <div class="flex items-center space-x-2">
                    <img src="${this.settings.logo}" alt="Logo" class="w-10 h-10" />
                    <button id="toggleSidebar" class="text-white text-2xl">☰</button>
                </div>
                <ul class="hidden md:flex flex-1 justify-end space-x-6">
                    <li class="invisible"><a href="#" class="hover:text-gray-400">Inicio</a></li>
                    <li class="invisible"><a href="#" class="hover:text-gray-400">Servicios</a></li>
                    <li>
                        <a href="/dev/menu/" class="hover:text-gray-400" title="Ir a Menús">
                            <i class="icon-th-large-3"></i>
                        </a>
                    </li>

                </ul>
                <button id="btnUserMenu" class="ml-2 flex items-center justify-center border-l border-gray-500 pl-2">
                    <img src="${this.settings.imgPerfil}" alt="Usuario" class="w-10 h-10 rounded-full border-2 border-white" />
                </button>
            </nav>
            <div class="relative mt-16 z-50">
                <div id="userMenuDropdown" class="absolute right-0 w-64 bg-[#111928] text-white rounded-2xl shadow-lg opacity-0 scale-95 invisible transition-all duration-500 ease-out">
                    
                <div class="relative flex flex-col items-center bg-[#1F2A37]  h-20 rounded-t-2xl">
                    <button id="btnCloseUserMenu" class="btn btn-sm p-1 absolute top-2 right-3 text-gray-400 hover:text-white focus:outline-none">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                   <div class="absolute -bottom-10">
                        <img src="${this.settings.imgPerfil}" alt="Usuario" class="w-20 h-20 rounded-full border-2 border-white shadow-lg" />
                    </div>
                </div>
                <div class="flex flex-col items-center pt-4 px-4 space-y-2">
                  <p class="text-white font-semibold text-lg mt-3">${this.settings.company}</p>
                    <p class="text-white font-medium mt-2 text-center">${this.settings.username}</p>
                    </div>
                    <div class="w-full text-center space-y-2 px-4 mt-2 mb-3">
                        <p class="block font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition px-3 py-2 rounded-lg cursor-pointer" id="btn_perfil">Mi Perfil</p>
                        <p class="block font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition px-3 py-2 rounded-lg cursor-pointer" id="btn_admin">Configuración</p>
                    </div>
                    <div class="w-full flex justify-center px-4 mt-2 mb-3">
                        <button id="btnLogout" class="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-all duration-300">Cerrar sesión</button>
                    </div>
                </div>
            </div>
        `;

        this.parent.prepend(navbarHtml);
    }

    initEvents() {
        // Evento para abrir el menu del usuario
        $("#btnUserMenu, #btnCloseUserMenu").on("click", () =>
            this.toggleUserMenu(),
        );
        // Evento para cerrar sesión
        $("#btnLogout").on("click", () => this.logout());
        // Evento para abrir/cerrar sidebar
        $("#toggleSidebar").on("click", () => this.toggleSidebar());
        $("#btn_perfil").on("click", () => window.location.href = "/dev/perfil/");
        $("#btn_admin").on("click", () => window.location.href = "/dev/admin/");
        $("#btn_pqts").on("click", () => window.location.href = "/dev/catalogos/");
    }

    toggleUserMenu() {
        $("#userMenuDropdown").toggleClass("opacity-0 scale-95 invisible");
    }


    toggleSidebar() {
        $("#sidebar").removeAttr("style").toggleClass("-translate-x-full");
    }

    logout() {
        Swal.fire({
            title: "¿Está seguro?",
            text: "Está a punto de cerrar su sesión actual.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Cerrar sesión",
            cancelButtonText: "Cancelar",
            customClass: {
                popup: "bg-[#1F2A37] text-white rounded-lg shadow-lg",
                title: "text-2xl font-semibold",
                content: "text-gray-300",
                confirmButton:
                    "bg-[#1C64F2] hover:bg-[#0E9E6E] text-white py-2 px-4 rounded",
                cancelButton:
                    "bg-transparent text-white border border-gray-500 py-2 px-4 rounded hover:bg-[#111928]",
            },
            background: "#111928",
            allowOutsideClick: false,
            allowEscapeKey: false,
        }).then((result) => {
            if (result.isConfirmed) window.location.href = "/dev/salir/";
        });
    }
}

$(async () => {
    const data = await useFetch({ url: "../access/ctrl/ctrl-access.php", data: { opc: 'company' } });

    let navbar = new Navbar();

    let user = '';
    if (data['user']) {
        user = data['user'];
    } else {
        user = 'Usuario';
    }

    navbar.init({
        logo: "/dev/src/img/logo/logo.svg",
        imgPerfil: data['photo'],
        company: data['company'],
        username: user,
        parent: "#menu-navbar",
    });
});
