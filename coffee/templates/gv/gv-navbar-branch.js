/* Grupo Varoch · Selector de sucursal (UDN) compartido
   Inyecta el pill + dropdown de Unidad de Negocio en cualquier navbar (.navbar-main),
   persiste la eleccion en localStorage y la sincroniza entre pestanas / navbars GV.
   Emite el evento "gv:branchChange" con { id, name } al cambiar de UDN.
   Uso: <script src="gv-navbar-branch.js"></script>  (o ../gv-navbar-branch.js en subcarpetas)
   Nota: los estilos dark del pill los aporta gv-navbar-theme.js (.navbar-main.nav-dark .branch-pill). */
(function () {
    'use strict';

    var KEY = 'gv_branch';

    // Catalogo de UDN de Grupo Varoch (mismo que el dropdown de gv-navbar).
    var BRANCHES = [
        { id: 1, name: 'Sonoras Meat',       avatar: 'SM', grad: 'linear-gradient(135deg,#5E3A1E,#8B5E34)' },
        { id: 2, name: 'Fogaza',             avatar: 'FG', grad: 'linear-gradient(135deg,#111318,#3F4650)' },
        { id: 3, name: 'Baos',               avatar: 'BA', grad: 'linear-gradient(135deg,#003360,#2563EB)' },
        { id: 4, name: 'Punto Modelo',       avatar: 'PM', grad: 'linear-gradient(135deg,#5d8418,#7AAB20)' },
        { id: 5, name: 'Quinta Tabachines',  avatar: 'QT', grad: 'linear-gradient(135deg,#4A0D22,#7E1537)' }
    ];

    function injectCSS() {
        if (document.getElementById('gv-navbar-branch-css')) return;
        var css = ''
            + '.branch-pill { padding:4px 10px; border:1px solid rgba(0,51,96,.24); border-radius:10px; background:rgba(0,51,96,.05); transition:all .15s ease; cursor:pointer; display:flex; align-items:center; gap:10px; }'
            + '.branch-pill:hover { border-color:#003360; background:rgba(0,51,96,.10); }'
            + '.branch-pill-icon { width:30px; height:30px; border-radius:8px; background:rgba(0,51,96,.10); display:flex; align-items:center; justify-content:center; color:#003360; flex-shrink:0; }'
            + '.branch-pill-label { font-size:9px; text-transform:uppercase; letter-spacing:.14em; color:#94A3B8; font-weight:600; }'
            + '.branch-pill-name { font-size:13px; font-weight:700; color:#111827; max-width:140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
            + '.branch-pill-chev { color:#94A3B8; transition:transform .2s ease; }'
            + '#gvBranchBtn[aria-expanded="true"] .branch-pill-chev { transform:rotate(180deg); }'

            + '.branch-dd { position:absolute; right:0; top:calc(100% + 10px); width:300px; background:#FFFFFF; border:1px solid rgba(0,51,96,.18); border-radius:14px; box-shadow:0 16px 40px rgba(17,24,39,.16); z-index:70; }'
            + '.branch-dd.hidden { display:none; }'
            + '.branch-dd-head { display:flex; align-items:flex-start; justify-content:space-between; padding:12px 14px 10px; border-bottom:1px solid #F1F5F9; }'
            + '.branch-dd-label { font-size:10px; text-transform:uppercase; letter-spacing:.12em; color:#003360; font-weight:700; }'
            + '.branch-dd-sub { font-size:11px; color:#94A3B8; margin-top:2px; }'
            + '.branch-dd-close { display:flex; align-items:center; gap:4px; font-size:11px; color:#94A3B8; padding:4px 8px; border-radius:8px; cursor:pointer; transition:all .15s ease; border:none; background:transparent; }'
            + '.branch-dd-close:hover { color:#111827; background:#F1F5F9; }'
            + '.branch-dd-body { padding:8px; display:flex; flex-direction:column; gap:6px; max-height:320px; overflow-y:auto; }'
            + '.branch-card { background:#FAFBFD; border:1px solid #E2E8F0; border-radius:10px; padding:8px 10px; cursor:pointer; transition:all .15s ease; }'
            + '.branch-card:hover { border-color:rgba(0,51,96,.40); background:#F0F5FB; }'
            + '.branch-card-sel { background:rgba(0,51,96,.06); border-color:#003360; box-shadow:0 0 0 1px rgba(0,51,96,.20); }'
            + '.branch-card-inner { display:flex; align-items:center; gap:10px; }'
            + '.branch-card-avatar { width:28px; height:28px; border-radius:9999px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:10px; color:#fff; box-shadow:0 4px 10px rgba(0,51,96,.30); flex-shrink:0; }'
            + '.branch-card-name { font-size:13px; font-weight:700; color:#1E293B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
            + '.branch-card-sub { font-size:11px; color:#94A3B8; margin-top:1px; }'
            + '.branch-radio { width:16px; height:16px; border-radius:9999px; border:2px solid #CBD5E1; display:flex; align-items:center; justify-content:center; transition:all .2s ease; flex-shrink:0; }'
            + '.branch-card-sel .branch-radio { border-color:#003360; }'
            + '.branch-radio-inner { width:7px; height:7px; border-radius:9999px; background:#003360; opacity:0; transition:opacity .2s ease; }'
            + '.branch-card-sel .branch-radio-inner { opacity:1; }';

        var style = document.createElement('style');
        style.id = 'gv-navbar-branch-css';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function esc(t) {
        return (t == null ? '' : String(t)).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    function currentId() {
        var saved = null;
        try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
        return saved && saved.id ? saved.id : BRANCHES[0].id;
    }

    function build() {
        var wrap = document.createElement('div');
        wrap.className = 'relative';
        wrap.id = 'gvBranchWrap';

        var cards = BRANCHES.map(function (b) {
            return ''
                + '<div class="branch-card" data-id="' + b.id + '">'
                +   '<div class="branch-card-inner">'
                +     '<div class="branch-card-avatar" style="background:' + b.grad + ';">' + esc(b.avatar) + '</div>'
                +     '<div class="flex-1 min-w-0">'
                +       '<div class="flex items-center justify-between gap-2">'
                +         '<p class="branch-card-name">' + esc(b.name) + '</p>'
                +         '<div class="branch-radio"><div class="branch-radio-inner"></div></div>'
                +       '</div>'
                +       '<p class="branch-card-sub">Grupo Varoch</p>'
                +     '</div>'
                +   '</div>'
                + '</div>';
        }).join('');

        wrap.innerHTML = ''
            + '<button id="gvBranchBtn" class="branch-pill" aria-expanded="false">'
            +   '<span class="branch-pill-icon"><i data-lucide="building-2" class="w-[18px] h-[18px]"></i></span>'
            +   '<div class="flex flex-col items-start leading-tight">'
            +     '<span class="branch-pill-label">Unidad de negocio</span>'
            +     '<span id="gvBranchName" class="branch-pill-name"></span>'
            +   '</div>'
            +   '<i data-lucide="chevron-down" class="branch-pill-chev w-4 h-4"></i>'
            + '</button>'
            + '<div id="gvBranchDd" class="branch-dd hidden">'
            +   '<div class="branch-dd-head">'
            +     '<div><p class="branch-dd-label">Cambiar unidad de negocio</p><p class="branch-dd-sub">Grupo Varoch</p></div>'
            +     '<button class="branch-dd-close" id="gvBranchClose"><i data-lucide="x" class="w-3.5 h-3.5"></i> Cerrar</button>'
            +   '</div>'
            +   '<div class="branch-dd-body">' + cards + '</div>'
            + '</div>';
        return wrap;
    }

    function init() {
        var navbar = document.querySelector('.navbar-main');
        if (!navbar || document.getElementById('gvBranchWrap')) return;

        injectCSS();
        var wrap = build();

        // Inserta el pill como primer control del grupo derecho de la navbar.
        // Se prefieren los WRAPPERS (.nav-notif-wrap/.nav-launcher-wrap) que son hijos
        // directos de la fila, no los botones anidados dentro de ellos (evita apilado vertical).
        var anchor = navbar.querySelector('#navScore, .nav-notif-wrap, #navNotifBtn, .nav-launcher-wrap, #navLauncherBtn, #btnThemeToggle, #btnModulos, #navColorBtn, .nav-user-pill, #btnUserMenu, .nav-user');
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(wrap, anchor);
        } else {
            var groups = navbar.querySelectorAll(':scope > div, :scope > .navbar-top');
            (groups[groups.length - 1] || navbar).appendChild(wrap);
        }

        var btn   = document.getElementById('gvBranchBtn');
        var dd    = document.getElementById('gvBranchDd');
        var name  = document.getElementById('gvBranchName');
        var cards = wrap.querySelectorAll('.branch-card');

        function apply(id, emit) {
            var b = BRANCHES.filter(function (x) { return String(x.id) === String(id); })[0] || BRANCHES[0];
            name.textContent = b.name;
            cards.forEach(function (c) {
                c.classList.toggle('branch-card-sel', String(c.dataset.id) === String(b.id));
            });
            if (emit) {
                document.dispatchEvent(new CustomEvent('gv:branchChange', { detail: { id: b.id, name: b.name } }));
            }
        }

        apply(currentId(), false);

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = btn.getAttribute('aria-expanded') === 'true';
            btn.setAttribute('aria-expanded', String(!open));
            dd.classList.toggle('hidden', open);
        });
        document.getElementById('gvBranchClose').addEventListener('click', function () {
            dd.classList.add('hidden');
            btn.setAttribute('aria-expanded', 'false');
        });
        document.addEventListener('click', function (e) {
            if (!dd.contains(e.target) && !btn.contains(e.target)) {
                dd.classList.add('hidden');
                btn.setAttribute('aria-expanded', 'false');
            }
        });
        cards.forEach(function (c) {
            c.addEventListener('click', function () {
                var id = c.dataset.id;
                apply(id, true);
                localStorage.setItem(KEY, JSON.stringify({ id: Number(id) }));
                dd.classList.add('hidden');
                btn.setAttribute('aria-expanded', 'false');
            });
        });

        // Sincroniza la UDN entre pestanas abiertas.
        window.addEventListener('storage', function (e) {
            if (e.key === KEY && e.newValue) {
                try { apply(JSON.parse(e.newValue).id, true); } catch (err) {}
            }
        });

        if (window.lucide && lucide.createIcons) lucide.createIcons();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
