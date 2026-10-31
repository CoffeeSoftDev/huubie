// Barra superior de pro: marca, en que empresa y sucursal se esta, quien entro y
// la salida. Los datos salen de ctrl-nav :: session.
class Navbar {
    async init() {
        this.base = this.proBase();
        this.render();

        const res = await this.fetchSession();
        if (res && res.status === 401) {
            window.location.href = this.base + '/index.php';
            return;
        }
        if (res && res.status === 200) this.renderSession(res.data);
    }

    proBase() {
        const p = window.location.pathname;
        const i = p.indexOf('/pro/');
        return i >= 0 ? p.slice(0, i + '/pro'.length) : '/pro';
    }

    async fetchSession() {
        try {
            const res = await fetch(this.base + '/auth/ctrl/ctrl-nav.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'opc=session'
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    }

    render() {
        $('#menu-navbar').html(`
            <nav class="flex items-center justify-between gap-3 px-3 bg-white border-b border-gray-200">
                <div class="flex items-center gap-3 min-w-0">
                    <button type="button" id="btn-menu" class="p-2 rounded-md text-gray-500 hover:bg-gray-100" title="Menú" aria-controls="menu-sidebar">
                        <i data-lucide="menu" class="w-5 h-5"></i>
                    </button>
                    <a href="${this.base}/index.php" class="flex items-center gap-2 no-underline text-gray-900 shrink-0">
                        <span class="flex items-center justify-center w-8 h-8 rounded-lg bg-[#0A0A0A]">
                            <img src="${this.base}/assets/img/huubie.png" alt="" class="w-6 h-6">
                        </span>
                        <span class="font-semibold">Huubie</span>
                    </a>
                    <span id="nav-context" class="hidden md:flex items-center gap-1.5 text-sm text-gray-500 min-w-0"></span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <a id="nav-companies" href="${this.base}/app/empresas/" title="Cambiar empresa" class="hidden items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 no-underline">
                        <i data-lucide="building-2" class="w-4 h-4"></i><span class="hidden md:inline">Cambiar empresa</span>
                    </a>
                    <div id="nav-user" class="flex items-center gap-2"></div>
                    <button type="button" id="btn-logout" class="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="Cerrar sesión">
                        <i data-lucide="log-out" class="w-[18px] h-[18px]"></i>
                    </button>
                </div>
            </nav>
        `);

        $('#btn-logout').on('click', () => this.logout());
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    renderSession(data) {
        const context = [data.company, data.branch].filter(Boolean);

        if (context.length) {
            $('#nav-context').empty().append(
                $('<span>', { class: 'text-gray-300', text: '/' }),
                $('<span>', { class: 'truncate', text: context.join(' · ') })
            );
        }

        // Con clases y no con show(): show() le ponía display:inline y en celular el
        // texto se partía. En celular queda solo el ícono; el texto, desde md.
        if (data.is_root) $('#nav-companies').removeClass('hidden').addClass('inline-flex');

        const color  = /^#[0-9A-Fa-f]{6}$/.test(data.color || '') ? data.color : '#111827';
        const avatar = data.photo
            ? $('<img>', { src: data.photo, alt: '', class: 'w-8 h-8 rounded-full object-cover' })
            : $('<span>', {
                class: 'flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-semibold',
                style: `background:${color}`,
                text:  this.initials(data.user || data.email)
            });

        $('#nav-user').empty().append(
            avatar,
            $('<div>', { class: 'hidden sm:flex flex-col leading-tight' }).append(
                $('<span>', { class: 'text-sm font-medium text-gray-900', text: data.user }),
                $('<span>', { class: 'text-xs text-gray-500', text: data.rol || '' })
            )
        );
    }

    initials(name) {
        const parts = String(name || '').trim().split(/\s+/);
        const first = parts[0] ? parts[0][0] : '';
        const last  = parts.length > 1 ? parts[parts.length - 1][0] : '';
        return (first + last).toUpperCase();
    }

    logout() {
        Swal.fire({
            title:              '¿Cerrar sesión?',
            text:               'Se cerrará tu sesión actual y volverás al inicio.',
            icon:               'question',
            showCancelButton:   true,
            confirmButtonText:  'Sí, cerrar sesión',
            cancelButtonText:   'Cancelar',
            confirmButtonColor: '#0A0A0A',
            cancelButtonColor:  '#9CA3AF',
            reverseButtons:     true,
            heightAuto:         false
        }).then((result) => {
            if (!result.isConfirmed) return;

            // El menu guardado es de esta sesion: el siguiente usuario no tiene por que verlo.
            try {
                Object.keys(sessionStorage).filter((k) => k.startsWith('pro:sidebar:')).forEach((k) => sessionStorage.removeItem(k));
            } catch (e) {}

            window.location.href = this.base + '/logout.php';
        });
    }
}

(() => {
    const navbar = new Navbar();
    if (document.getElementById('menu-navbar')) navbar.init();
    else $(() => navbar.init());
})();
