/* Grupo Varoch · Navbar ESPECIAL de módulos Costsys
   Navbar azul institucional de color FIJO (no cambia de tema), sin rueda de Valores
   y sin rail lateral. Reemplaza a gv-navbar-theme.js en las páginas de costsys.
   Conserva selector de UDN (gv-navbar-branch.js), launcher, notificaciones y menú de usuario.
   Uso (en costsys): cargar este script + gv-navbar-branch.js + gv-navbar-user.js
   (NO cargar gv-navbar-theme.js ni gv-navbar-score.js). */
(function () {
    'use strict';

    function injectCSS() {
        if (document.getElementById('gv-navbar-costsys-css')) return;
        var css = ''
            // Fondo azul institucional fijo
            + '.navbar-main { background:linear-gradient(115deg,#003360 0%,#00264A 100%) !important; border-bottom:1px solid rgba(255,255,255,.10) !important; box-shadow:0 2px 16px rgba(2,10,24,.35) !important; }'
            // Alineación: todos los controles en una sola fila, centrados verticalmente
            + '.navbar-main .navbar-top { flex-wrap:nowrap !important; align-items:center !important; }'
            + '.navbar-main .navbar-top > * { align-self:center; }'
            + '.navbar-main .nav-spacer { flex:1 1 auto !important; min-width:8px; }'
            + '.navbar-main .nav-notif-wrap, .navbar-main .nav-launcher-wrap, .navbar-main #gvBranchWrap, .navbar-main .nav-user, .navbar-main .nav-icon-btn, .navbar-main .nav-divider { flex-shrink:0; }'
            // Pill de UDN COMPACTO en costsys: una sola línea (sin la etiqueta "Unidad de negocio"),
            // misma altura que los botones de ícono para que todo quede alineado.
            + '.navbar-main #gvBranchWrap { display:flex; align-items:center; align-self:center; }'
            + '.navbar-main .branch-pill { height:38px; padding:0 10px !important; }'
            + '.navbar-main .branch-pill-label { display:none !important; }'
            + '.navbar-main .branch-pill-icon { width:24px !important; height:24px !important; }'
            // Logo claro que contrasta sobre el azul
            + '.navbar-main .nav-logo { background:linear-gradient(135deg,#F4F8FF,#DCE8FA) !important; color:#06264A !important; box-shadow:0 3px 10px rgba(0,0,0,.28) !important; }'
            + '.navbar-main .nav-brand-grupo { color:#FFFFFF !important; }'
            + '.navbar-main .nav-brand-varoch { color:#9FC0E4 !important; }'
            + '.navbar-main .navbar-title { color:#FFFFFF !important; }'
            + '.navbar-main .navbar-subtitle { color:#9FC0E4 !important; }'
            // Botones de ícono (tema/notif/launcher)
            + '.navbar-main .nav-icon-btn { color:#BFD3E6 !important; background:rgba(255,255,255,.06) !important; }'
            + '.navbar-main .nav-icon-btn:hover { color:#FFFFFF !important; background:rgba(255,255,255,.14) !important; }'
            + '.navbar-main .nav-divider { background:rgba(255,255,255,.14) !important; }'
            + '.navbar-main .nav-notif-badge { border-color:#00264A !important; }'
            // Pill de usuario
            + '.navbar-main .nav-user:hover { background:rgba(255,255,255,.08) !important; }'
            + '.navbar-main .nav-user-name { color:#FFFFFF !important; }'
            + '.navbar-main .nav-user-rol { color:#9FC0E4 !important; }'
            + '.navbar-main .nav-chev { color:#9FC0E4 !important; }'
            // Selector de UDN inyectado (gv-navbar-branch.js) sobre azul
            + '.navbar-main .branch-pill { background:rgba(255,255,255,.08) !important; border-color:rgba(255,255,255,.18) !important; }'
            + '.navbar-main .branch-pill:hover { background:rgba(255,255,255,.14) !important; border-color:rgba(255,255,255,.32) !important; }'
            + '.navbar-main .branch-pill-icon { background:rgba(255,255,255,.14) !important; color:#FFFFFF !important; }'
            + '.navbar-main .branch-pill-name { color:#F8FAFC !important; }'
            + '.navbar-main .branch-pill-label { color:rgba(255,255,255,.62) !important; }'
            + '.navbar-main .branch-pill-chev { color:#CBD5E1 !important; }';

        var style = document.createElement('style');
        style.id = 'gv-navbar-costsys-css';
        style.textContent = css;
        // Se agrega al FINAL del body (no al head) para ganar el cascade a los <style>
        // inline que algunas páginas de costsys tienen dentro del <body>.
        (document.body || document.head || document.documentElement).appendChild(style);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectCSS);
    else injectCSS();
})();
