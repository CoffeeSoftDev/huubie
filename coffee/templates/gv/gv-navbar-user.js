/* Grupo Varoch · Menu de usuario compartido
   Inyecta el dropdown de la cuenta (perfil, permisos, cerrar sesion) y lo engancha
   al pill de usuario (.nav-user-pill / #btnUserMenu / .nav-user) de cualquier navbar (.navbar-main).
   Lee avatar / nombre / rol del propio pill; email y enlaces son configurables:
     - via data-* en el pill: data-email, data-profile, data-permisos, data-logout
     - o via window.GV_NAV_LINKS = { email, profile, permisos, logout }  (util en subcarpetas)
   Uso: <script src="gv-navbar-user.js"></script>  (o ../gv-navbar-user.js en subcarpetas)
   Nota: los estilos dark del dropdown los aporta gv-navbar-theme.js. */
(function () {
    'use strict';

    function injectCSS() {
        if (document.getElementById('gv-navbar-user-css')) return;
        var css = ''
            + '.nav-dropdown { background:#FFFFFF; border:1px solid #E2E8F0; border-radius:16px; box-shadow:0 14px 38px rgba(17,24,39,.14); transition:opacity .2s ease, transform .2s ease; transform-origin:top right; overflow:hidden; }'
            + '.nav-divider { height:1px; background:#E2E8F0; }'
            + '.nav-user-head { display:flex; align-items:center; gap:12px; padding:16px; }'
            + '.nav-head-avatar { position:relative; width:46px; height:46px; border-radius:9999px; background:#003360; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:15px; flex-shrink:0; }'
            + '.nav-status-dot { position:absolute; right:0; bottom:1px; width:12px; height:12px; border-radius:9999px; background:#7AAB20; border:2px solid #FFFFFF; }'
            + '.nav-head-name { font-size:15px; font-weight:700; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
            + '.nav-head-email { font-size:12.5px; color:#94A3B8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
            + '.nav-head-rol { display:inline-flex; align-items:center; gap:4px; margin-top:6px; font-size:11px; font-weight:600; padding:2px 8px; border-radius:8px; background:rgba(0,51,96,.10); color:#003360; border:1px solid rgba(0,51,96,.20); }'
            + '.nav-menu-link { display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:10px; font-size:13px; color:#334155; text-decoration:none; transition:background .15s ease; }'
            + '.nav-menu-link:hover { background:#F1F5F9; }'
            + '.nav-menu-link i { width:16px; height:16px; }'
            + '.nav-logout-btn { width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:11px; border:1px solid #E2E8F0; color:#9E1B32; border-radius:12px; font-weight:600; font-size:14px; background:#FFFFFF; cursor:pointer; transition:all .15s ease; }'
            + '.nav-logout-btn:hover { background:#FDECEA; border-color:#F3C0BD; }'
            + '.nav-user-pill.open .nav-chevron, #btnUserMenu.open .nav-chevron, .nav-user.open .nav-chev { transform:rotate(180deg); }';

        var style = document.createElement('style');
        style.id = 'gv-navbar-user-css';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function esc(t) {
        return (t == null ? '' : String(t)).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    function txt(el, sel) {
        var n = el.querySelector(sel);
        return n ? n.textContent.trim() : '';
    }

    function init() {
        var navbar = document.querySelector('.navbar-main');
        if (!navbar || document.getElementById('gvUserDd')) return;

        var pill = navbar.querySelector('#btnUserMenu, .nav-user-pill, .nav-user');
        if (!pill) return;

        injectCSS();

        var links   = window.GV_NAV_LINKS || {};
        var avatar  = txt(pill, '.nav-avatar, .nav-user-avatar') || 'GV';
        var name    = txt(pill, '.nav-user-name') || 'Usuario';
        var rol     = txt(pill, '.nav-user-rol')  || '';
        var email   = pill.dataset.email    || links.email    || 'rosy.a@grupovaroch.com';
        var profile = pill.dataset.profile  || links.profile  || 'gv-perfil.html';
        var permisos= pill.dataset.permisos || links.permisos || 'gv-permisos.html';
        var logout  = pill.dataset.logout   || links.logout   || 'login-varoch.html';

        var wrap = document.createElement('div');
        wrap.className = 'relative z-50';
        wrap.innerHTML = ''
            + '<div id="gvUserDd" class="nav-dropdown absolute right-3 mt-2 w-72 opacity-0 scale-95 invisible">'
            +   '<div class="nav-user-head">'
            +     '<div class="nav-head-avatar">' + esc(avatar) + '<span class="nav-status-dot"></span></div>'
            +     '<div class="flex-1 min-w-0">'
            +       '<p class="nav-head-name">' + esc(name) + '</p>'
            +       '<p class="nav-head-email">' + esc(email) + '</p>'
            +       (rol ? '<span class="nav-head-rol"><i data-lucide="shield" class="w-3 h-3"></i> ' + esc(rol) + '</span>' : '')
            +     '</div>'
            +   '</div>'
            +   '<div class="nav-divider"></div>'
            +   '<div class="px-3 py-2">'
            +     '<a href="' + esc(profile) + '" class="nav-menu-link"><i data-lucide="user"></i> Mi perfil</a>'
            +     '<a href="' + esc(permisos) + '" class="nav-menu-link"><i data-lucide="key-round"></i> Perfiles y permisos</a>'
            +   '</div>'
            +   '<div class="nav-divider"></div>'
            +   '<div class="px-3 py-3">'
            +     '<button class="nav-logout-btn" onclick="window.location.href=\'' + esc(logout) + '\'"><i data-lucide="log-out" class="w-4 h-4"></i> Cerrar sesión</button>'
            +   '</div>'
            + '</div>';

        navbar.parentNode.insertBefore(wrap, navbar.nextSibling);

        var dd = document.getElementById('gvUserDd');

        function open()  { dd.classList.remove('opacity-0', 'scale-95', 'invisible'); pill.classList.add('open'); }
        function close() { dd.classList.add('opacity-0', 'scale-95', 'invisible'); pill.classList.remove('open'); }

        pill.addEventListener('click', function (e) {
            e.stopPropagation();
            if (dd.classList.contains('invisible')) open(); else close();
        });
        document.addEventListener('click', function (e) {
            if (!dd.contains(e.target) && !pill.contains(e.target)) close();
        });

        if (window.lucide && lucide.createIcons) lucide.createIcons();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
