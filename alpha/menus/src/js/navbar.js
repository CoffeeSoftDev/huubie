let level = 0;

/* Iconos Lucide inline para la navbar (se carga antes que el helper global
   lucideIcon de los modulos). stroke=currentColor: heredan el color del texto. */
const NAV_ICONS = {
    'house'          : '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    'layout-grid'    : '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    'user'           : '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'log-out'        : '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    'chevron-down'   : '<path d="m6 9 6 6 6-6"/>',
    'shield'         : '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    'shopping-basket': '<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="M4.5 15.5h15"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>',
    'book-open'      : '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    'crown'          : '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>'
};

function navIcon(name, cls = 'w-4 h-4') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}">${NAV_ICONS[name] || ''}</svg>`;
}

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
        const roleIconMap = { 1: 'shield', 2: 'shopping-basket', 3: 'user', 4: 'book-open', 5: 'crown' };
        const roleIcon = navIcon(roleIconMap[level] || 'user', level == 5 ? 'w-3.5 h-3.5 text-yellow-400' : 'w-3.5 h-3.5');

        const hasPhoto = this.settings.imgPerfil
            && this.settings.imgPerfil.trim() !== ''
            && !/df-user\.png$/.test(this.settings.imgPerfil);
        const avatarFallback = `<div class="w-8 h-8 rounded-full bg-[#7C3AED] flex items-center justify-center text-white">${navIcon('user', 'w-[18px] h-[18px]')}</div>`;
        const navbarAvatar = hasPhoto
            ? `<img src="${this.settings.imgPerfil}" alt="Usuario" class="w-8 h-8 rounded-full border-2 border-white object-cover" onerror="navbar.onAvatarError(this)" />`
            : avatarFallback;

        // Control de sucursal (las paginas hub lo ocultan con showSubsidiary: false):
        // - Admin (ROLID==1): el selector FILTRA la vista, incluye "Todas las
        //   sucursales" y dispara subsidiaryChanged. No toca la sesion.
        // - Operador (no-admin) con 2+ sucursales: el selector hace SWITCH DE
        //   SESION (reescribe $_SESSION['SUB'] y recarga). Es como re-loguear.
        // - Con una sola sucursal: etiqueta fija (sin chevron, sin select).
        const subsidiaries = Array.isArray(this.settings.subsidiaries) ? this.settings.subsidiaries : [];
        const isAdmin      = this.settings.isAdmin;
        const currentSubId = this.settings.subsidiaryId;
        const canFilter    = isAdmin && subsidiaries.length > 0;
        const canSwitch    = !isAdmin && subsidiaries.length > 1;

        const selectCls       = 'appearance-none bg-transparent text-white text-xs font-medium pl-8 pr-7 py-1.5 focus:outline-none cursor-pointer max-w-[200px]';
        const selectWrapOpen  = `<div class="relative flex items-center bg-[#1F2A37] border border-[#374151] rounded-md hover:bg-[#2D3748] transition">
                    <span class="text-pink-500 absolute left-2.5 pointer-events-none">${navIcon('house', 'w-3.5 h-3.5')}</span>`;
        const selectWrapClose = `<span class="text-gray-400 absolute right-2 pointer-events-none">${navIcon('chevron-down', 'w-3.5 h-3.5')}</span>
                </div>`;
        const optionsHtml     = subsidiaries.map(s => `<option value="${s.id}" class="bg-[#1F2A37] text-white" ${currentSubId == s.id ? 'selected' : ''}>${s.valor}</option>`).join('');

        let subsidiaryControl;
        if (this.settings.showSubsidiary === false) {
            subsidiaryControl = '';
        } else if (canFilter) {
            subsidiaryControl = `${selectWrapOpen}
                    <select id="subsidiaries_id" onchange="navbar.onSubsidiaryChange(this.value)" class="${selectCls}">
                        <option value="0" class="bg-[#1F2A37] text-white">Todas las sucursales</option>
                        ${optionsHtml}
                    </select>
                    ${selectWrapClose}`;
        } else if (canSwitch) {
            // Hibrido: "Todas" filtra la vista (no toca la sesion, como el admin);
            // elegir una sucursal concreta hace switch de sesion. Decide
            // onSubsidiarySelect segun el valor.
            subsidiaryControl = `${selectWrapOpen}
                    <select id="subsidiaries_id" onchange="navbar.onSubsidiarySelect(this.value)" class="${selectCls}">
                        <option value="0" class="bg-[#1F2A37] text-white">Todas las sucursales</option>
                        ${optionsHtml}
                    </select>
                    ${selectWrapClose}`;
        } else {
            subsidiaryControl = `<div class="flex items-center gap-2 bg-[#1F2A37] border border-[#374151] rounded-md px-2.5 py-1.5">
                    <span class="text-pink-500">${navIcon('house', 'w-3.5 h-3.5')}</span>
                    <span class="text-xs font-medium text-white truncate max-w-[160px]">${this.settings.subsidiary || 'Sucursal'}</span>
                </div>`;
        }

        const dropdownAvatar = hasPhoto
            ? `<img src="${this.settings.imgPerfil}" alt="Usuario" class="w-20 h-20 rounded-full border-2 border-white shadow-lg object-cover" onerror="navbar.onAvatarError(this, 'lg')" />`
            : `<div class="w-20 h-20 rounded-full border-2 border-white shadow-lg bg-[#7C3AED] flex items-center justify-center text-white">${navIcon('user', 'w-10 h-10')}</div>`;

        const navbarHtml = `
            <nav class="bg-[#111827] fixed top-0 left-0 w-full text-white px-4 py-1.5 h-12 z-50 flex items-center justify-between border-b border-pink-500">
                <div class="flex items-center space-x-2">
                    <button id="toggleSidebar" class="text-white text-xl">☰</button>
                </div>
                <div class="flex items-center gap-2">
                    ${subsidiaryControl}
                    <a href="/alpha/menu/" class="flex items-center justify-center w-8 h-8 rounded-lg text-gray-300 hover:text-white hover:bg-[#1F2A37] transition" title="Ir a Menús">
                        ${navIcon('layout-grid', 'w-[18px] h-[18px]')}
                    </a>
                    <button id="btnUserMenu" class="flex items-center gap-2 border-l border-gray-600 pl-2">
                        ${navbarAvatar}
                        <div class="hidden md:flex flex-col items-start leading-tight text-left">
                            <span class="text-xs font-medium text-white">${this.settings.username}</span>
                            <span class="text-[10px] text-gray-400">${this.settings.role || 'Sin rol'}</span>
                        </div>
                    </button>
                </div>
            </nav>
            <div class="relative mt-12 z-50">
                <div id="userMenuDropdown" class="absolute right-0 w-72 bg-[#111928] rounded-2xl shadow-lg opacity-0 scale-95 invisible transition-all duration-500 ease-out">
                    <div class="relative flex items-center justify-center bg-[#1F2A37] h-20 rounded-t-2xl">
                        <button id="btnCloseUserMenu" class="btn btn-sm p-1 absolute top-2 right-3 text-gray-400 hover:text-white focus:outline-none">
                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div class="absolute -bottom-10">
                            <div class="relative">
                                ${dropdownAvatar}
                                <span class="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#1F2A37]"></span>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col items-center pt-4 pb-2 px-4 space-y-2">
                        <h2 class="text-white font-semibold text-lg mt-3">${this.settings.username}</h2>
                        <span class="inline-flex items-center gap-1 bg-blue-900/50 text-blue-200 text-xs font-semibold px-2 py-1 rounded-full">
                            ${roleIcon} ${this.settings.role || 'Sin rol'}
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
                            ${navIcon('log-out', 'w-4 h-4')}
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

    // Fallback cuando la foto de perfil no carga: avatar morado con icono lucide.
    onAvatarError(img, size = 'sm') {
        const big  = size === 'lg';
        const box  = big ? 'w-20 h-20 border-2 border-white shadow-lg' : 'w-8 h-8';
        const icon = navIcon('user', big ? 'w-10 h-10' : 'w-[18px] h-[18px]');
        img.outerHTML = `<div class="${box} rounded-full bg-[#7C3AED] flex items-center justify-center text-white">${icon}</div>`;
    }

    // Al cambiar de sucursal desde la navbar, notificar al modulo activo.
    // Cada modulo decide como reaccionar escuchando el evento 'subsidiaryChanged'.
    onSubsidiaryChange(value) {
        document.dispatchEvent(new CustomEvent('subsidiaryChanged', { detail: { id: value } }));
    }

    // Selector hibrido (operadores con 2+ sucursales): "Todas" (0) filtra la
    // vista como el admin (sin tocar la sesion); volver a "mi sucursal" tambien
    // re-filtra sin recargar; cualquier OTRA sucursal hace switch de sesion.
    onSubsidiarySelect(value) {
        const current = String(this.settings.subsidiaryId ?? '');
        if (value === '0' || value == 0 || String(value) === current) {
            this.onSubsidiaryChange(value);
        } else {
            this.switchSubsidiary(value);
        }
    }

    // Switch de sucursal con persistencia en sesion (operadores no-admin):
    // reescribe la sucursal activa en el backend y recarga para que todos los
    // modulos tomen la nueva sucursal. Equivale a re-loguear con otro usuario.
    async switchSubsidiary(value) {
        const current = this.settings.subsidiaryId;
        if (value == current) return;

        const result = await Swal.fire({
            title: "¿Cambiar de sucursal?",
            text: "Se recargará la página y trabajarás sobre la sucursal seleccionada.",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Cambiar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#1C64F2",
            background: "#1F2A37",
            color: "#fff",
        });

        if (!result.isConfirmed) {
            $("#subsidiaries_id").val(current);
            return;
        }

        const res = await useFetch({
            url: "../access/ctrl/ctrl-access.php",
            data: { opc: "switchSubsidiary", subsidiaries_id: value },
        });

        if (res.status === 200) {
            window.location.reload();
        } else {
            $("#subsidiaries_id").val(current);
            Swal.fire({
                icon: "error",
                title: "No se pudo cambiar de sucursal",
                text: res.message || "Intenta nuevamente.",
                background: "#1F2A37",
                color: "#fff",
            });
        }
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

    const navbar = new Navbar();
    window.navbar = navbar;

    let user = '';
    if (data['user']) {
        user = data['user'];
    } else {
        user = 'Usuario';
    }

    level = data.level;

    navbar.init({
        logo: "/alpha/src/img/logo/logo.svg",
        imgPerfil: data['photo'],
        company: data['company'],
        subsidiary: data['subsidiary'],
        subsidiaryId: data['subsidiary_id'],
        isAdmin: data['is_admin'],
        subsidiaries: data['subsidiaries'],
        showSubsidiary: !window.HIDE_SUBSIDIARY_SWITCH,
        username: user,
        role: data.rol,
        level: data.level,
        parent: "#menu-navbar",
    });
});
