let level = 0;

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
        level = this.settings.level;
        let className = ''
        if (level == 1) {
            className = 'icon-shield';
        } else if (level == 2) {
            className = 'icon-basket-alt'   
        } else if (level == 3) {
            className = 'icon-user-1'   
        } else if (level == 4) {
            className = 'icon-book-open'   
        } else if (level == 5) {
            className = 'icon-crown text-[14px] text-yellow-400'   
        }

        const navbarHtml = `
            <nav class="bg-[#111827] fixed top-0 left-0 w-full text-white px-4 py-3 h-16 z-50 flex items-center justify-between border-b-2 border-pink-500">
                <div class="flex items-center space-x-2">
                    <img src="${this.settings.logo}" alt="Logo" class="w-10 h-10" />
                    <button id="toggleSidebar" class="text-white text-2xl">☰</button>
                </div>
                <ul class="hidden md:flex flex-1 justify-end space-x-6">
                    <li class="invisible"><a href="#" class="hover:text-gray-400">Inicio</a></li>
                    <li class="invisible"><a href="#" class="hover:text-gray-400">Servicios</a></li>
                    <li>
                        <a href="/alpha/menu/" class="hover:text-gray-400" title="Ir a Menús">
                            <i class="icon-th-large-3"></i>
                        </a>
                    </li>

                </ul>
                <button id="btnUserMenu" class="ml-2 flex items-center justify-center border-l border-gray-500 pl-2">
                    <img src="${this.settings.imgPerfil}" alt="Usuario" class="w-10 h-10 rounded-full border-2 border-white" />
                </button>
            </nav>
            <div class="relative mt-16 z-50">
                <div id="userMenuDropdown" class="absolute right-0 w-72 bg-[#111928] rounded-2xl shadow-lg opacity-0 scale-95 invisible transition-all duration-500 ease-out">
                    <div class="relative flex items-center justify-center bg-[#1F2A37] h-20 rounded-t-2xl">
                        <button id="btnCloseUserMenu" class="btn btn-sm p-1 absolute top-2 right-3 text-gray-400 hover:text-white focus:outline-none">
                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div class="absolute -bottom-10">
                            <div class="relative">
                                <img src="${this.settings.imgPerfil}" alt="Usuario" class="w-20 h-20 rounded-full border-2 border-white shadow-lg object-cover" />
                                <span class="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#1F2A37]"></span>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col items-center pt-4 pb-2 px-4 space-y-2">
                        <h2 class="text-white font-semibold text-lg mt-3">${this.settings.username}</h2>
                        <span class="inline-flex bg-blue-900/50 text-blue-200 text-xs font-semibold px-2 py-1 rounded-full align-items-center">
                            <i class="${className}"></i> ${this.settings.role || 'Sin rol'}
                        </span>
                    </div>
                    <div class="w-full h-px bg-[#1F2937] my-2"></div>
                    <div class="w-full px-3 space-y-2">
                        <button id="btn_perfil" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#1F2937] transition">
                            <div class="flex items-center space-x-3">
                               <div class="flex items-center justify-center h-10 w-10 rounded-xl transition-colors duration-200 bg-[#333D4C] group-hover:bg-[#172958]">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user h-5 w-5 transition-colors duration-200 text-gray-400 group-hover:text-[#BDD9FC]">
                                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2">
                                    </path>
                                    <circle cx="12" cy="7" r="4">
                                    </circle>
                                    </svg>
                               </div>
                                <div class="text-left">
                                    <p class="text-white font-medium leading-tight">Mi Perfil</p>
                                    <p class="text-gray-400 text-xs">Ver y editar tu información</p>
                                </div>
                            </div>
                            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        ${level == 1 ? `
                        <button id="btn_admin" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#1F2937] transition">
                            <div class="flex items-center space-x-3">
                               <div class="flex items-center justify-center h-10 w-10 rounded-xl transition-colors duration-200 bg-[#333D4C] group-hover:bg-[#172958]">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings h-5 w-5 transition-colors duration-200 text-gray-400 group-hover:text-[#BDD9FC]">
                                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z">
                                    </path>
                                    <circle cx="12" cy="12" r="3">
                                    </circle>
                                    </svg>
                               </div>
                                <div class="text-left">
                                    <p class="text-white font-medium leading-tight">Configuración</p>
                                    <p class="text-gray-400 text-xs">Preferencias de la cuenta</p>
                                </div>
                            </div>
                            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        ` : ''}
                    </div>
                    <div class="w-full px-5 mt-3 mb-4">
                        <button id="btnLogout" class="w-full flex items-center justify-center gap-2 px-2 py-2 border-1 border-red-500 text-red-500 rounded-xl transition hover:bg-red-600 hover:text-white">
                            <i class="icon-logout-3"></i>
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            </div>
        `;
        //   <p class="text-white font-semibold text-lg mt-3">${this.settings.company}</p>
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
        $("#btn_perfil").on("click", () => window.location.href = "/alpha/perfil/");
        $("#btn_admin").on("click", () => window.location.href = "/alpha/admin/");
        $("#btn_pqts").on("click", () => window.location.href = "/alpha/catalogos/");
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
            if (result.isConfirmed) window.location.href = "/alpha/salir/";
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

    level = data.level;

    console.log('level: ',level)


    navbar.init({
        logo: "/alpha/src/img/logo/logo.svg",
        imgPerfil: data['photo'],
        company: data['company'],
        username: user,
        role: data.rol,
        level: data.level,
        parent: "#menu-navbar",
    });
});
