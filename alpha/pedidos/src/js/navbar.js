let level = 0;

class Navbar {
    init(options) {
        this.render(options);
        this.initEvents();
    }

    render(options) {
        const defaults = {
            logo:      "/alpha/src/img/logo/logo.svg",
            imgPerfil: "/alpha/src/img/df-user.png",
            company:   "Compañia",
            username:  "Usuario",
            parent:    "body",

            isAdmin:       false,
            subsidiary:    "Sucursal",
            subsidiaryId:  0,
            branches:      [],

            navbar: {
                bg:     '#141d2b',
                border: '#EC4899',
            },
            header: {
                bg:           '#1F2A37',
                statusOnline: '#22c55e',
            },
            dropdown: {
                bg:           '#111928',
                hover:        '#1F2937',
                divider:      '#1F2937',
                iconBox:      '#333D4C',
                iconBoxHover: '#172958',
            },
            badge: {
                bg:   '#1e3a8a',
                text: '#bfdbfe',
            },
            logout: {
                border: '#ef4444',
                hover:  '#dc2626',
            },
        };

        this.settings = Object.assign({}, defaults, options);
        this.settings.navbar   = Object.assign({}, defaults.navbar,   options?.navbar   || {});
        this.settings.header   = Object.assign({}, defaults.header,   options?.header   || {});
        this.settings.dropdown = Object.assign({}, defaults.dropdown, options?.dropdown || {});
        this.settings.badge    = Object.assign({}, defaults.badge,    options?.badge    || {});
        this.settings.logout   = Object.assign({}, defaults.logout,   options?.logout   || {});

        const navbar   = this.settings.navbar;
        const header   = this.settings.header;
        const dropdown = this.settings.dropdown;
        const badge    = this.settings.badge;
        const logout   = this.settings.logout;
        this.parent = $(this.settings.parent);
        level = this.settings.level;
        let className = '';
        if (level == 1) {
            className = 'icon-shield';
        } else if (level == 2) {
            className = 'icon-basket-alt';
        } else if (level == 3) {
            className = 'icon-user-1';
        } else if (level == 4) {
            className = 'icon-book-open';
        } else if (level == 5) {
            className = 'icon-crown text-[14px] text-yellow-400';
        }

        const hasPhoto = this.settings.imgPerfil
            && this.settings.imgPerfil.trim() !== ''
            && !/df-user\.png$/.test(this.settings.imgPerfil);
        const navbarAvatar = hasPhoto
            ? `<img src="${this.settings.imgPerfil}" alt="Usuario" class="w-8 h-8 rounded-full border-2 border-white object-cover" onerror="this.outerHTML='<div class=\\'w-8 h-8 rounded-full border-2 border-white bg-purple-600 flex items-center justify-center\\'><i class=\\'icon-user-7 text-white text-base\\'></i></div>'" />`
            : `<div class="w-8 h-8 rounded-full border-2 border-white bg-purple-600 flex items-center justify-center"><i class="icon-user-7 text-white text-base"></i></div>`;

        const dropdownAvatar = hasPhoto
            ? `<img src="${this.settings.imgPerfil}" alt="Usuario" class="w-20 h-20 rounded-full border-2 border-white shadow-lg object-cover" onerror="this.outerHTML='<div class=\\'w-20 h-20 rounded-full border-2 border-white shadow-lg bg-purple-600 flex items-center justify-center\\'><i class=\\'icon-user-7 text-white text-4xl\\'></i></div>'" />`
            : `<div class="w-20 h-20 rounded-full border-2 border-white shadow-lg bg-purple-600 flex items-center justify-center"><i class="icon-user-7 text-white text-4xl"></i></div>`;

        const branchStyles   = this.branchStylesHtml();
        const branchControl  = this.branchControlHtml();
        const hiddenSelect   = this.hiddenSelectHtml();

        const navbarHtml = `
            ${branchStyles}
            <nav class="fixed top-0 left-0 w-full text-white px-4 py-1.5 h-12 z-50 flex items-center justify-between border-b shadow-lg shadow-black/20 shrink-0" style="background-color: ${navbar.bg}; border-bottom-color: ${navbar.border}4D;">
                <div class="flex items-center space-x-2">
                    <img src="${this.settings.logo}" alt="Logo" class="w-8 h-8" />
                    <button id="toggleSidebar" class="text-white text-xl leading-none">☰</button>
                </div>
                <div class="flex items-center gap-3">
                    ${branchControl}
                    ${hiddenSelect}
                    <a href="/alpha/menu/" class="hidden md:flex w-8 h-8 items-center justify-center rounded-lg hover:bg-white/5 transition" title="Menus">
                        <i class="icon-th-large-3 text-gray-300 text-base"></i>
                    </a>
                    <button id="btnUserMenu" class="ml-1 flex items-center justify-center border-l border-gray-700 pl-3">
                        ${navbarAvatar}
                    </button>
                </div>
            </nav>
            <div class="relative mt-12 z-50">
                <div id="userMenuDropdown" class="absolute right-0 w-72 rounded-2xl shadow-lg opacity-0 scale-95 invisible transition-all duration-500 ease-out" style="background-color: ${dropdown.bg};">
                    <div class="relative flex items-center justify-center h-20 rounded-t-2xl" style="background-color: ${header.bg};">
                        <button id="btnCloseUserMenu" class="btn btn-sm p-1 absolute top-2 right-3 text-gray-400 hover:text-white focus:outline-none">
                            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div class="absolute -bottom-10">
                            <div class="relative">
                                ${dropdownAvatar}
                                <span class="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2" style="background-color: ${header.statusOnline}; border-color: ${header.bg};"></span>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col items-center pt-4 pb-2 px-4 space-y-2">
                        <h2 class="text-white font-semibold text-lg mt-3">${this.settings.username}</h2>
                        <span class="inline-flex text-xs font-semibold px-2 py-1 rounded-full align-items-center" style="background-color: ${badge.bg}80; color: ${badge.text};">
                            <i class="${className}"></i> ${this.settings.role || 'Sin rol'}
                        </span>
                    </div>
                    <div class="w-full h-px my-2" style="background-color: ${dropdown.divider};"></div>
                    <div class="w-full px-3 space-y-2">
                        <button id="btn_perfil" class="w-full flex items-center justify-between px-3 py-2 rounded-xl transition" onmouseover="this.style.backgroundColor='${dropdown.hover}'" onmouseout="this.style.backgroundColor=''">
                            <div class="flex items-center space-x-3">
                               <div class="flex items-center justify-center h-10 w-10 rounded-xl transition-colors duration-200" style="background-color: ${dropdown.iconBox};">
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
                        <button id="btn_admin" class="w-full flex items-center justify-between px-3 py-2 rounded-xl transition" onmouseover="this.style.backgroundColor='${dropdown.hover}'" onmouseout="this.style.backgroundColor=''">
                            <div class="flex items-center space-x-3">
                               <div class="flex items-center justify-center h-10 w-10 rounded-xl transition-colors duration-200" style="background-color: ${dropdown.iconBox};">
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
                        <button id="btnLogout" class="w-full flex items-center justify-center gap-2 px-2 py-2 border rounded-xl transition" style="border-color: ${logout.border}; color: ${logout.border};" onmouseover="this.style.backgroundColor='${logout.hover}'; this.style.color='#fff';" onmouseout="this.style.backgroundColor=''; this.style.color='${logout.border}';">
                            <i class="icon-logout-3"></i>
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            </div>
            ${this.branchToastHtml()}
        `;
        this.parent.prepend(navbarHtml);
    }

    // Select oculto: es el puente de compatibilidad con el modulo de pedidos,
    // que lee la sucursal activa via $('#subsidiaries_id') (getSubsidiaryLabel /
    // getListFilterSubsidiary). Solo se emite para el admin (filtro de vista).
    hiddenSelectHtml() {
        if (!this.settings.isAdmin) return '';

        const branches     = this.settings.branches || [];
        const currentSubId = this.settings.subsidiaryId;
        const options = branches.map(b =>
            `<option value="${b.id}" ${currentSubId == b.id ? 'selected' : ''}>${b.name}</option>`
        ).join('');

        return `
            <select id="subsidiaries_id" class="hidden">
                <option value="0">Todas las sucursales</option>
                ${options}
            </select>`;
    }

    branchControlHtml() {
        const branches = this.settings.branches || [];

        // Operador / sin sucursales: etiqueta fija con la sucursal de sesion.
        if (!this.settings.isAdmin || branches.length == 0) {
            return `
            <div class="flex items-center gap-2 branch-pill">
                <span class="branch-status-dot bg-green-500 ring-2 ring-green-500/20"></span>
                <span class="text-sm font-semibold text-white truncate max-w-[160px]">${this.settings.subsidiary || 'Sucursal'}</span>
            </div>`;
        }

        return this.branchPillHtml();
    }

    branchStylesHtml() {
        if (document.getElementById('branchSelectorStyles')) return '';

        return `
        <style id="branchSelectorStyles">
            .branch-pill { background: linear-gradient(180deg, #1F2A37 0%, #1a2332 100%); border: 1px solid rgba(124,58,237,0.35); border-radius: 10px; padding: 3px 10px; transition: all .2s ease; }
            .branch-pill:hover { border-color: #7C3AED; box-shadow: 0 0 0 3px rgba(124,58,237,0.12); }
            .branch-status-dot { width: 7px; height: 7px; border-radius: 9999px;  display: inline-block; }
            .branch-avatar { width: 28px; height: 28px; border-radius: 9999px; background: linear-gradient(135deg, #7C3AED 0%, #EC4899 100%); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 10px; letter-spacing: .5px; color: #fff; box-shadow: 0 4px 12px rgba(124,58,237,.35); }
            .branch-dropdown { background: #111928; border: 1px solid rgba(124,58,237,0.18); border-radius: 14px; box-shadow: 0 24px 48px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.02); }
            .branch-card { background: #1F2A37; border: 1px solid rgba(55,65,81,.55); border-radius: 10px; padding: 8px 10px; transition: all .15s ease; cursor: pointer; }
            .branch-card:hover { border-color: #7C3AED; background: #1F2937; }
            .branch-card.selected { background: linear-gradient(135deg, rgba(124,58,237,.18) 0%, rgba(236,72,153,.10) 100%); border-color: #A855F7; box-shadow: 0 0 0 1px rgba(168,85,247,.25); }
            .radio-mark { width: 16px; height: 16px; border-radius: 9999px; border: 2px solid #4B5563; display: flex; align-items: center; justify-content: center; transition: all .2s ease; }
            .branch-card.selected .radio-mark { border-color: #A855F7; }
            .radio-mark .inner { width: 7px; height: 7px; border-radius: 9999px; background: #A855F7; opacity: 0; transition: opacity .2s ease; }
            .branch-card.selected .radio-mark .inner { opacity: 1; }
            .toast-card { position: relative; background: #1F2A37; border: 1px solid rgba(55,65,81,.55); border-radius: 14px; padding: 14px 18px; overflow: hidden; }
            @keyframes branchSlideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            .toast-anim { animation: branchSlideIn .35s ease-out; }
            @keyframes branchFadeOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(20px); } }
            .toast-fade-out { animation: branchFadeOut .4s ease-in forwards; }
            .chev { transition: transform .2s ease; }
            .branch-pill[aria-expanded="true"] .chev { transform: rotate(180deg); }
            .btn-ghost { color: #9CA3AF; font-size: 11px; padding: 4px 10px; border-radius: 8px; transition: all .15s ease; }
            .btn-ghost:hover { color: #fff; background: rgba(255,255,255,.06); }
        </style>`;
    }

    branchPillHtml() {
        const branches = this.settings.branches || [];
        const currentSubId = this.settings.subsidiaryId;
        const currentFull  = branches.find(b => b.id == currentSubId);
        const currentName  = currentFull ? currentFull.name : (this.settings.subsidiary || 'Seleccionar');

        return `
        <div class="relative">
            <button id="btnBranch" class="branch-pill flex items-center gap-3" aria-expanded="false">
                <div class="flex flex-col items-start leading-tight">
                    <span class="text-[9px] uppercase tracking-[.14em] text-gray-500 font-semibold">Sucursal</span>
                    <div class="flex items-center gap-2">
                        <span class="branch-status-dot bg-green-500 ring-2 ring-green-500/20"></span>
                        <span id="btnBranchName" class="text-sm font-semibold text-white">${currentName}</span>
                    </div>
                </div>
                <svg class="chev w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
            </button>
            <div id="branchDropdown" class="branch-dropdown absolute right-0 top-[calc(100%+10px)] w-[320px] z-40" style="display: none;">
                <div class="px-3 pt-3 pb-2 flex items-start justify-between border-b border-gray-800/60">
                    <div>
                        <p class="text-[10px] uppercase tracking-[.14em] text-purple-400 font-semibold">Filtrar por sucursal</p>
                        <p class="text-[11px] text-gray-400 mt-0.5">de ${this.settings.company || ''}</p>
                    </div>
                    <button id="btnBranchClose" class="btn-ghost flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                        Cerrar
                    </button>
                </div>
                <div class="p-2 space-y-1.5 max-h-[360px] overflow-y-auto">
                    ${this.allBranchesCardHtml()}
                    ${branches.map((branch, i) => this.branchCardHtml(branch, i, currentSubId)).join('')}
                </div>
            </div>
        </div>`;
    }

    allBranchesCardHtml() {
        const selected = (this.settings.subsidiaryId == 0) ? 'selected' : '';
        return `
        <div class="branch-card ${selected}" data-id="0" data-name="Todas las sucursales">
            <div class="flex items-center gap-2.5">
                <div class="branch-avatar" style="background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                        <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/>
                        <rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
                    </svg>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                        <p class="text-[13px] font-bold text-white truncate">Todas las sucursales</p>
                        <div class="radio-mark"><div class="inner"></div></div>
                    </div>
                    <p class="text-[11px] text-gray-400 mt-1 truncate">Ver la operación completa</p>
                </div>
            </div>
        </div>`;
    }

    branchCardHtml(branch, index, currentSubId) {
        const gradients = [
            'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
            'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            'linear-gradient(135deg, #F472B6 0%, #C084FC 100%)',
            'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
            'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        ];
        const gradient = gradients[index % gradients.length];
        const selectedClass = (branch.id == currentSubId) ? 'selected' : '';
        const subRow = branch.ubication
            ? `<p class="text-[11px] text-gray-400 mt-1 truncate">${branch.ubication}</p>`
            : '';

        return `
        <div class="branch-card ${selectedClass}" data-id="${branch.id}" data-name="${branch.name}">
            <div class="flex items-center gap-2.5">
                <div class="branch-avatar" style="background: ${gradient};">${branch.initials || ''}</div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                        <p class="text-[13px] font-bold text-white truncate">${branch.name}</p>
                        <div class="radio-mark"><div class="inner"></div></div>
                    </div>
                    ${subRow}
                </div>
            </div>
        </div>`;
    }

    branchToastHtml() {
        return `
        <div id="branchToast" class="fixed top-[88px] right-6 z-40 w-[340px] hidden">
            <div class="toast-card">
                <div class="flex items-start gap-3">
                    <div class="relative shrink-0">
                        <div class="w-10 h-10 rounded-xl bg-[#7C3AED]/15 flex items-center justify-center border border-[#7C3AED]/25">
                            <svg class="w-5 h-5 text-[#A855F7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                            </svg>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-white">Mostrando <span id="branchToastName" class="text-[#A855F7]">Sucursal</span></p>
                        <div class="mt-1.5 pt-1.5 border-t border-white/5">
                            <p class="text-[11px] text-gray-400">
                                <span class="text-gray-500">Empresa</span> ·
                                <span class="text-gray-300">${this.settings.company || ''}</span>
                            </p>
                        </div>
                    </div>
                    <button id="btnBranchToastClose" class="text-gray-500 hover:text-white transition shrink-0">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
            </div>
        </div>`;
    }

    initEvents() {
        $("#btnUserMenu, #btnCloseUserMenu").on("click", () => this.toggleUserMenu());
        $("#btnLogout").on("click", () => this.logout());
        $("#toggleSidebar").on("click", () => this.toggleSidebar());
        $("#btn_perfil").on("click", () => window.location.href = "/alpha/perfil/");
        $("#btn_admin").on("click", () => window.location.href = "/alpha/admin/");

        $("#btnBranch").on("click", (e) => {
            e.stopPropagation();
            this.toggleBranchDropdown();
        });
        $("#btnBranchClose").on("click", (e) => {
            e.stopPropagation();
            this.closeBranchDropdown();
        });
        $(document).on("click.branchDropdown", (e) => {
            if (!$(e.target).closest("#btnBranch, #branchDropdown").length) {
                this.closeBranchDropdown();
            }
        });
        $(document).on("click", ".branch-card", (e) => {
            const card = e.currentTarget;
            const id   = card.getAttribute("data-id");
            const name = card.getAttribute("data-name");
            this.selectBranch(id, name, card);
        });
        $("#btnBranchToastClose").on("click", () => this.hideToast());
    }

    toggleUserMenu() {
        $("#userMenuDropdown").toggleClass("opacity-0 scale-95 invisible");
    }

    toggleSidebar() {
        $("#sidebar").removeAttr("style").toggleClass("-translate-x-full");
    }

    toggleBranchDropdown() {
        const btn = document.getElementById("btnBranch");
        const dd  = document.getElementById("branchDropdown");
        if (!btn || !dd) return;

        const expanded = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", !expanded);
        dd.style.display = expanded ? "none" : "block";
    }

    closeBranchDropdown() {
        const btn = document.getElementById("btnBranch");
        const dd  = document.getElementById("branchDropdown");
        if (!btn || !dd) return;

        btn.setAttribute("aria-expanded", "false");
        dd.style.display = "none";
    }

    // En pedidos el cambio de sucursal es un FILTRO de vista (no toca la sesion):
    // se sincroniza el <select id="subsidiaries_id"> oculto, se notifica al modulo
    // con 'branchChanged' y se muestra el toast. El backend conserva la sesion.
    selectBranch(id, name, cardEl) {
        if (cardEl.classList.contains("selected")) {
            this.closeBranchDropdown();
            return;
        }

        document.querySelectorAll(".branch-card").forEach((c) => c.classList.remove("selected"));
        cardEl.classList.add("selected");

        this.settings.subsidiaryId = id;
        $("#subsidiaries_id").val(id);
        $("#btnBranchName").text(name);

        this.closeBranchDropdown();
        this.showToast(name);

        document.dispatchEvent(new CustomEvent('branchChanged', {
            detail: { id: parseInt(id, 10), name }
        }));
    }

    showToast(name) {
        const toast = document.getElementById("branchToast");
        if (!toast) return;

        $("#branchToastName").text(name);
        toast.classList.remove("hidden", "toast-fade-out");
        toast.classList.add("toast-anim");

        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => this.hideToast(), 3000);
    }

    hideToast() {
        const toast = document.getElementById("branchToast");
        if (!toast) return;

        toast.classList.remove("toast-anim");
        toast.classList.add("toast-fade-out");
        const handler = () => {
            toast.classList.add("hidden");
            toast.classList.remove("toast-fade-out");
            toast.removeEventListener("animationend", handler);
        };
        toast.addEventListener("animationend", handler);
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

    const branches = (data['subsidiaries'] || []).map(s => {
        const parts = String(s.valor || '').trim().split(/\s+/);
        let initials = (parts[0] || '').charAt(0).toUpperCase();
        if (parts.length > 1) initials += (parts[parts.length - 1] || '').charAt(0).toUpperCase();
        return {
            id:        s.id,
            name:      s.valor,
            ubication: s.ubication || '',
            initials:  initials,
        };
    });

    navbar.init({
        logo:         "/alpha/src/img/logo/logo.svg",
        imgPerfil:    data['photo'],
        company:      data['company'],
        username:     user,
        role:         data.rol,
        level:        data.level,
        parent:       "#menu-navbar",
        isAdmin:      data['is_admin'],
        subsidiary:   data['subsidiary'],
        subsidiaryId: data['subsidiary_id'],
        branches:     branches,
    });
});
