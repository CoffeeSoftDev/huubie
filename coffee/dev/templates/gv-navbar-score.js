/* Grupo Varoch · Rueda de Valores corporativos compartida
   Inyecta el anillo de calificacion de valores (0–5) en cualquier navbar (.navbar-main).
   Calcula el conic-gradient y el color segun el umbral (mismos que gv-navbar / gv-perfil).
   Valor configurable: window.GV_NAV_SCORE (numero) o data-score en la navbar. Default 4.49.
   Si la navbar ya trae una .nav-score-wrap inline, no hace nada (evita duplicar).
   Uso: <script src="gv-navbar-score.js"></script>  (o ../gv-navbar-score.js en subcarpetas)
   Nota: el theming dark del anillo (hueco, pista --nav-score-track y relleno --score-fill)
   lo aporta gv-navbar-theme.js; aqui solo se declaran --score-color / --score-color-dark. */
(function () {
    'use strict';

    function injectCSS() {
        if (document.getElementById('gv-navbar-score-css')) return;
        var css = ''
            + '.nav-score-wrap { display:flex; align-items:center; gap:8px; padding:3px 10px 3px 4px; border-radius:9999px; cursor:pointer; transition:background .15s ease; }'
            + '.nav-score-wrap:hover { background:#F1F5F9; }'
            + '.nav-score-ring { position:relative; width:40px; height:40px; border-radius:9999px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }'
            + '.nav-score-ring::before { content:\'\'; position:absolute; inset:4px; background:#fff; border-radius:9999px; }'
            + '.nav-score-ring span { position:relative; font-size:10.5px; font-weight:800; line-height:1; }'
            + '.nav-score-label { font-size:11.5px; font-weight:600; color:#111827; }'
            + '.nav-score-sub { font-size:9.5px; color:#94A3B8; }';

        var style = document.createElement('style');
        style.id = 'gv-navbar-score-css';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function colorFor(v) {
        return v >= 4.5 ? '#7AAB20' : v >= 4 ? '#2563EB' : v >= 3.5 ? '#D97706' : '#9E1B32';
    }

    // En navbars azules el azul se camuflajea: el nivel azul usa el verde corporativo.
    function colorForDark(v) {
        return v >= 4 ? '#7AAB20' : colorFor(v);
    }

    function init() {
        var navbar = document.querySelector('.navbar-main');
        if (!navbar || document.getElementById('gvNavScore') || navbar.querySelector('.nav-score-wrap')) return;

        injectCSS();

        var val = parseFloat(navbar.getAttribute('data-score'));
        if (isNaN(val)) val = (typeof window.GV_NAV_SCORE === 'number') ? window.GV_NAV_SCORE : 4.49;
        val = Math.max(0, Math.min(5, val));

        var pct       = (val / 5) * 100;
        var color     = colorFor(val);
        var colorDark = colorForDark(val);

        var wrap = document.createElement('div');
        wrap.className = 'nav-score-wrap';
        wrap.id = 'gvNavScore';
        wrap.title = 'Calificación de valores corporativos';
        wrap.innerHTML = ''
            + '<div class="nav-score-ring" style="--score-color:' + color + '; --score-color-dark:' + colorDark + '; background:conic-gradient(var(--score-fill,' + color + ') ' + pct + '%, var(--nav-score-track,#EEF3F8) ' + pct + '%);">'
            +   '<span style="color:var(--score-fill,' + color + ');">' + val.toFixed(2) + '</span>'
            + '</div>'
            + '<div class="hidden sm:flex flex-col items-start leading-tight">'
            +   '<span class="nav-score-label">Valores</span>'
            +   '<span class="nav-score-sub">de 5.00</span>'
            + '</div>';

        // Se coloca junto a los controles de la derecha, antes de tema / módulos / usuario.
        var anchor = navbar.querySelector('#navNotifBtn, #navLauncherBtn, #btnThemeToggle, #btnModulos, #navColorBtn, .nav-user-pill, #btnUserMenu, .nav-user');
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(wrap, anchor);
        } else {
            var groups = navbar.querySelectorAll(':scope > div, :scope > .navbar-top');
            (groups[groups.length - 1] || navbar).appendChild(wrap);
        }

        if (window.lucide && lucide.createIcons) lucide.createIcons();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
