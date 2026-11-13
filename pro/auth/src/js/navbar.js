// Barra superior de pro: marca, en que empresa y sucursal se esta, quien entro, el
// tema y la salida. Los datos salen de ctrl-nav :: session y themes.
class Navbar {
    async init() {
        this.base   = this.proBase();
        this.themes = [];
        this.theme  = '';
        this.render();

        // Las dos a la vez: ctrl-nav suelta la sesion al leer y no se forman en fila.
        const [res, themes] = await Promise.all([this.post({ opc: 'session' }), this.post({ opc: 'themes' })]);

        if (res && res.status === 401) {
            window.location.href = this.base + '/index.php';
            return;
        }
        if (res && res.status === 200) this.renderSession(res.data);
        if (themes && themes.status === 200) this.renderThemes(themes.themes, themes.current);
    }

    proBase() {
        const p = window.location.pathname;
        const i = p.indexOf('/pro/');
        return i >= 0 ? p.slice(0, i + '/pro'.length) : '/pro';
    }

    // Una peticion a ctrl-nav. Si falla la red o la respuesta no es JSON, devuelve null.
    async post(data) {
        try {
            const res = await fetch(this.base + '/auth/ctrl/ctrl-nav.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(data).toString()
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
                    <div id="nav-theme" class="relative hidden">
                        <button type="button" id="btn-theme" class="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="Tema" aria-haspopup="true" aria-expanded="false" aria-controls="nav-theme-menu">
                            <i data-lucide="palette" class="w-[18px] h-[18px]"></i>
                        </button>
                        <div id="nav-theme-menu" class="hidden absolute right-0 top-full mt-1 w-60 p-1 bg-white border border-gray-200 rounded-lg shadow-lg"></div>
                    </div>
                    <div id="nav-user" class="flex items-center gap-2"></div>
                    <button type="button" id="btn-logout" class="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="Cerrar sesión">
                        <i data-lucide="log-out" class="w-[18px] h-[18px]"></i>
                    </button>
                </div>
            </nav>
        `);

        $('#btn-logout').on('click', () => this.logout());

        // El menu de temas se cierra al elegir, con Escape o al hacer clic fuera.
        $('#btn-theme').on('click', () => this.toggleThemes());
        $('#nav-theme-menu').on('click', '[data-code]', (e) => this.selectTheme(e.currentTarget.dataset.code));
        $(document).on('click', (e) => { if (!$(e.target).closest('#nav-theme').length) this.closeThemes(); });
        $(document).on('keydown', (e) => { if (e.key === 'Escape') this.closeThemes(); });

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

    // -- Tema --
    // El mismo catálogo y el mismo guardado que la barra de Catálogo (ctrl-nav :: themes
    // y saveTheme). Aquí la barra no se pinta con el color del tema: sigue a la página.

    // El fondo de página de cada scheme (assets/css/themes.css): la base de la muestra.
    static get SCHEME_PAGE() {
        return { light: '#F3F4F6', huubie: '#111928', midnight: '#0B1420', rose: '#1A1216' };
    }

    hex(value, fallback) {
        return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value || '') ? value : fallback;
    }

    // Pinta el menú: muestra, nombre y palomita en el activo. Sin catálogo no hay
    // nada que elegir y el botón se queda escondido.
    renderThemes(themes, current) {
        this.themes = Array.isArray(themes) ? themes : [];
        this.theme  = current || '';
        if (!this.themes.length) return;

        const $menu = $('#nav-theme-menu').empty();

        this.themes.forEach((t) => {
            const active = t.code === this.theme;

            $menu.append(
                $('<button>', {
                    type:           'button',
                    class:          'flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm text-left text-gray-700 hover:bg-gray-100',
                    'data-code':    t.code,
                    'aria-pressed': active ? 'true' : 'false'
                }).append(
                    this.themeSwatch(t),
                    $('<span>', { class: 'flex-1 truncate', text: t.name }),
                    $('<i>', { 'data-lucide': 'check', class: 'w-4 h-4 shrink-0' + (active ? '' : ' invisible') })
                )
            );
        });

        $('#nav-theme').removeClass('hidden');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // El tema en chiquito: la página de fondo, la barra arriba y los puntos del acento y el primario.
    themeSwatch(t) {
        const page = Navbar.SCHEME_PAGE[t.scheme] || Navbar.SCHEME_PAGE.light;
        const dot  = (color) => $('<span>', { class: 'w-1.5 h-1.5 rounded-full', style: `background:${color}` });

        return $('<span>', { class: 'relative flex items-end gap-0.5 w-8 h-6 p-1 rounded overflow-hidden shrink-0 border border-gray-200', style: `background:${page}` }).append(
            $('<span>', { class: 'absolute inset-x-0 top-0 h-1.5', style: `background:${this.hex(t.color, '#FFFFFF')}` }),
            dot(this.hex(t.accent, '#C05A40')),
            dot(this.hex(t.primary, '#292524'))
        );
    }

    // Los colores los reparte InventoryPalette (assets/js/tailwind-theme.js) y se guardan
    // para que la siguiente carga, aquí o en Catálogo, los pinte desde el <head>.
    applyTheme(theme) {
        if (!window.InventoryPalette) return;

        const accent  = this.hex(theme.accent, '#C05A40');
        const palette = {
            accent:    accent,
            primary:   this.hex(theme.primary, '#292524'),
            secondary: this.hex(theme.secondary, accent),
            sidebar:   this.hex(theme.sidebar, ''),
            scheme:    theme.scheme || 'light'
        };

        InventoryPalette.apply(palette);
        InventoryPalette.save(palette);
    }

    // Los componentes de coffeeSoft se arman una vez con la variante de la página
    // (clara u oscura). Si el tema nuevo cambia eso, se recarga para rearmarlo todo;
    // el aviso "Aplicando tema" tapa el cambio y sigue en la carga nueva.
    async selectTheme(code) {
        const theme = this.themes.find((t) => t.code === code);
        if (!theme) return;

        const wasDark = document.documentElement.classList.contains('dark');
        const loader  = window.InventoryPalette && InventoryPalette.loader;
        const started = Date.now();

        this.closeThemes();

        if (loader) {
            loader.show(theme.name);
            await new Promise((resolve) => setTimeout(resolve, 180));
        }

        this.applyTheme(theme);
        this.renderThemes(this.themes, code);

        // Si no se guarda, el tema ya se ve; solo no queda como el del usuario.
        await this.post({ opc: 'saveTheme', code: code });

        if (document.documentElement.classList.contains('dark') !== wasDark) {
            if (loader) loader.carry(theme.name);
            window.location.reload();
            return;
        }

        // Tiempo mínimo en pantalla para que el aviso alcance a leerse.
        if (loader) setTimeout(loader.hide, Math.max(0, 750 - (Date.now() - started)));
    }

    toggleThemes() {
        const open = $('#nav-theme-menu').hasClass('hidden');

        $('#nav-theme-menu').toggleClass('hidden', !open);
        $('#btn-theme').attr('aria-expanded', open ? 'true' : 'false');
    }

    closeThemes() {
        $('#nav-theme-menu').addClass('hidden');
        $('#btn-theme').attr('aria-expanded', 'false');
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
