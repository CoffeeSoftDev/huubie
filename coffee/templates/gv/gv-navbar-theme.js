/* Grupo Varoch · Tema de navbar compartido
   Inyecta el selector "Color de navbar" en cualquier navbar (.navbar-main),
   persiste la eleccion en localStorage y la aplica a todas las navbars GV.
   Uso: <script src="gv-navbar-theme.js"></script>  (o ../gv-navbar-theme.js en subcarpetas) */
(function () {
    'use strict';

    var KEY = 'gv_navbar_color';
    var OPTIONS = [
        { color: '#FFFFFF', mode: 'light', name: 'Blanco Corporativo' },
        { color: '#0F2740', mode: 'dark',  name: 'Azul Nocturno' },
        { color: '#003360', mode: 'dark',  name: 'Azul Marino' }
    ];

    function injectCSS() {
        if (document.getElementById('gv-navbar-theme-css')) return;
        var css = ''
            + ':root { --nav-bg:#FFFFFF; }'
            + '.navbar-main { position:relative; transition:background .2s ease; }'
            + '.nav-score-ring::before { background:var(--nav-bg) !important; }'

            + '.nav-color-btn { width:38px; height:38px; display:flex; align-items:center; justify-content:center; color:#64748B; border:none; background:transparent; cursor:pointer; border-radius:9999px; transition:color .15s ease; }'
            + '.nav-color-btn:hover { color:#003360; }'
            + '.nav-color-menu { position:absolute; top:58px; right:14px; width:236px; background:#fff; border:1px solid #E2E8F0; border-radius:12px; box-shadow:0 14px 34px rgba(15,23,42,.16); padding:8px; z-index:80; }'
            + '.nav-color-menu.hidden { display:none; }'
            + '.nav-color-menu-title { font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#94A3B8; padding:8px 10px 6px; }'
            + '.nav-color-opt { display:flex; align-items:center; gap:11px; padding:9px 10px; border-radius:8px; cursor:pointer; transition:background .15s ease; }'
            + '.nav-color-opt:hover { background:#F1F5F9; }'
            + '.nav-color-swatch { width:22px; height:22px; border-radius:9999px; border:1px solid rgba(15,23,42,.15); flex-shrink:0; }'
            + '.nav-color-name { flex:1; font-size:13px; font-weight:500; color:#334155; }'
            + '.nav-color-check { color:#003360; opacity:0; flex-shrink:0; }'
            + '.nav-color-opt.is-active .nav-color-check { opacity:1; }'

            + '.navbar-main.nav-dark { border-bottom-color:rgba(255,255,255,.12) !important; }'
            + '.navbar-main.nav-dark .navbar-title,'
            + '.navbar-main.nav-dark .nav-user-name,'
            + '.navbar-main.nav-dark .nav-head-name,'
            + '.navbar-main.nav-dark .branch-pill-name,'
            + '.navbar-main.nav-dark .nav-score-label { color:#F8FAFC; }'
            + '.navbar-main.nav-dark .navbar-subtitle,'
            + '.navbar-main.nav-dark .nav-user-rol,'
            + '.navbar-main.nav-dark .branch-pill-label,'
            + '.navbar-main.nav-dark .nav-score-sub { color:rgba(255,255,255,.62); }'
            + '.navbar-main.nav-dark .nav-theme-toggle,'
            + '.navbar-main.nav-dark .nav-color-btn,'
            + '.navbar-main.nav-dark .nav-chevron,'
            + '.navbar-main.nav-dark .branch-pill-chev { color:#CBD5E1; }'
            + '.navbar-main.nav-dark .nav-theme-toggle:hover,'
            + '.navbar-main.nav-dark .nav-color-btn:hover { color:#fff; }'
            + '.navbar-main.nav-dark .nav-user-pill { border-left-color:rgba(255,255,255,.15); }'
            + '.navbar-main.nav-dark .nav-user-pill:hover,'
            + '.navbar-main.nav-dark .nav-score-wrap:hover { background:rgba(255,255,255,.08); }'
            + '.navbar-main.nav-dark .nav-avatar { box-shadow:0 0 0 1px rgba(255,255,255,.25); }'
            + '.navbar-main.nav-dark .branch-pill { background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.18); }'
            + '.navbar-main.nav-dark .branch-pill:hover { background:rgba(255,255,255,.14); border-color:rgba(255,255,255,.30); }'
            + '.navbar-main.nav-dark .branch-pill-icon { background:rgba(255,255,255,.14); color:#fff; }';

        var style = document.createElement('style');
        style.id = 'gv-navbar-theme-css';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function buildMenu() {
        var menu = document.createElement('div');
        menu.className = 'nav-color-menu hidden';
        menu.id = 'navColorMenu';
        var html = '<p class="nav-color-menu-title">Color de navbar</p>';
        OPTIONS.forEach(function (o) {
            html += '<div class="nav-color-opt" data-color="' + o.color + '" data-mode="' + o.mode + '">'
                + '<span class="nav-color-swatch" style="background:' + o.color + ';"></span>'
                + '<span class="nav-color-name">' + o.name + '</span>'
                + '<i data-lucide="check" class="nav-color-check w-4 h-4"></i>'
                + '</div>';
        });
        menu.innerHTML = html;
        return menu;
    }

    function buildBtn() {
        var btn = document.createElement('button');
        btn.className = 'nav-color-btn';
        btn.id = 'navColorBtn';
        btn.title = 'Color de navbar';
        btn.innerHTML = '<i data-lucide="palette" class="w-[18px] h-[18px]"></i>';
        return btn;
    }

    function init() {
        var navbar = document.querySelector('.navbar-main');
        if (!navbar) return;

        injectCSS();

        var btn = document.getElementById('navColorBtn');
        var menu = document.getElementById('navColorMenu');

        if (!menu) { menu = buildMenu(); navbar.appendChild(menu); }
        if (!btn) {
            btn = buildBtn();
            var anchor = navbar.querySelector('#btnThemeToggle, #btnModulos, .nav-user-pill, #btnUserMenu, .nav-user');
            if (anchor && anchor.parentNode) {
                anchor.parentNode.insertBefore(btn, anchor);
            } else {
                var groups = navbar.querySelectorAll(':scope > div');
                (groups[groups.length - 1] || navbar).appendChild(btn);
            }
        }

        var opts = menu.querySelectorAll('.nav-color-opt');

        // paint=false: no toca el fondo (respeta el diseño original de la navbar, ej. gradiente dark).
        // paint=true: el usuario eligió un color, se aplica inline a cualquier navbar.
        function apply(color, mode, paint) {
            document.documentElement.style.setProperty('--nav-bg', color);
            opts.forEach(function (o) {
                o.classList.toggle('is-active', o.dataset.color.toUpperCase() === String(color).toUpperCase());
            });
            if (paint) {
                navbar.style.setProperty('background', color, 'important');
                navbar.classList.toggle('nav-dark', mode === 'dark');
            } else {
                navbar.style.removeProperty('background');
                navbar.classList.remove('nav-dark');
            }
        }

        var saved = null;
        try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
        if (saved && saved.color) apply(saved.color, saved.mode, true);
        else apply('#FFFFFF', 'light', false);

        btn.addEventListener('click', function (e) { e.stopPropagation(); menu.classList.toggle('hidden'); });
        document.addEventListener('click', function (e) {
            if (!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.add('hidden');
        });
        opts.forEach(function (o) {
            o.addEventListener('click', function () {
                apply(o.dataset.color, o.dataset.mode, true);
                localStorage.setItem(KEY, JSON.stringify({ color: o.dataset.color, mode: o.dataset.mode }));
                menu.classList.add('hidden');
            });
        });

        // Sincroniza el color entre pestanas / navbars abiertas a la vez.
        window.addEventListener('storage', function (e) {
            if (e.key === KEY && e.newValue) {
                try { var v = JSON.parse(e.newValue); apply(v.color, v.mode, true); } catch (err) {}
            }
        });

        if (window.lucide && lucide.createIcons) lucide.createIcons();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
