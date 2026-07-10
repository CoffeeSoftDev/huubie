/* Barra de cuenta al pie del sidebar (estilo ChatGPT): muestra el usuario activo
 * y abre un menú con opciones. La única funcional por ahora es "Configuración",
 * que abre un modal para habilitar/deshabilitar qué modelos aparecen en TODOS los
 * chats (usa CoffeeModelConfig, la preferencia es global y compartida). */
(function (global) {
    'use strict';

    const PROFILE_KEY = 'coffeeia:profile:name';
    const DEFAULT_NAME = 'CoffeeSoft Dev';
    const PLAN_LABEL   = 'Go';

    function profileName() {
        try { return localStorage.getItem(PROFILE_KEY) || DEFAULT_NAME; }
        catch (e) { return DEFAULT_NAME; }
    }
    function saveProfileName(name) {
        try { localStorage.setItem(PROFILE_KEY, name || DEFAULT_NAME); } catch (e) {}
    }
    // Iniciales para el avatar (máx 2 letras).
    function initials(name) {
        const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return 'CS';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    let _toastTimer = null;
    function toast(msg, tone) {
        // Reusa el toast de la superficie actual (#visorToast/#pgToast/#chatToast,
        // todos con clase .visor-toast); si no hay, log discreto.
        const $t = global.jQuery ? global.jQuery('.visor-toast').first() : null;
        if (!$t || !$t.length) { console.log('[cuenta]', msg); return; }
        $t.text(msg).attr('data-tone', tone || 'info').addClass('visible');
        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(function () { $t.removeClass('visible'); }, 2400);
    }

    /* ---------- Botón de cuenta (rail) ---------- */
    function refreshAccountBar() {
        const $btn = global.jQuery('#accountBtn');
        if (!$btn.length) return;
        $btn.find('.account-avatar').text(initials(profileName()));
    }

    /* ---------- Menú emergente ---------- */
    const MENU_ITEMS = [
        { id: 'upgrade',  icon: 'sparkles',    label: 'Mejorar plan' },
        { id: 'custom',   icon: 'sliders-horizontal', label: 'Personalización' },
        { id: 'profile',  icon: 'user-round',  label: 'Perfil' },
        { id: 'settings', icon: 'settings',    label: 'Configuración' },
        { sep: true },
        { id: 'help',     icon: 'life-buoy',   label: 'Ayuda' },
        { id: 'logout',   icon: 'log-out',     label: 'Cerrar sesión' }
    ];

    function buildMenu() {
        if (global.jQuery('#accountMenu').length) return;
        const rows = MENU_ITEMS.map(function (it) {
            if (it.sep) return '<div class="account-menu-sep"></div>';
            return '<button type="button" class="account-menu-item" data-act="' + it.id + '">'
                 +   '<i data-lucide="' + it.icon + '" class="w-4 h-4"></i>'
                 +   '<span>' + it.label + '</span>'
                 + '</button>';
        }).join('');
        const html = '<div id="accountMenu" class="account-menu" role="menu" hidden>'
                   +   '<div class="account-menu-head">'
                   +     '<span class="account-avatar account-avatar-sm"></span>'
                   +     '<span class="account-menu-head-meta">'
                   +       '<span class="account-menu-head-name"></span>'
                   +       '<span class="account-menu-head-plan"></span>'
                   +     '</span>'
                   +   '</div>'
                   +   rows
                   + '</div>';
        global.jQuery('body').append(html);
        if (global.lucide) global.lucide.createIcons();
    }

    function positionMenu() {
        const $btn = global.jQuery('#accountBtn');
        const $menu = global.jQuery('#accountMenu');
        if (!$btn.length || !$menu.length) return;
        const r = $btn[0].getBoundingClientRect();
        // El botón vive en el rail (extremo izquierdo): el menú abre a su DERECHA,
        // con el borde inferior alineado al botón y creciendo hacia arriba.
        $menu.css({
            left: (r.right + 8) + 'px',
            width: '244px',
            bottom: Math.max(8, global.innerHeight - r.bottom) + 'px'
        });
    }

    function openMenu() {
        buildMenu();
        const name = profileName();
        global.jQuery('#accountMenu .account-avatar-sm').text(initials(name));
        global.jQuery('#accountMenu .account-menu-head-name').text(name);
        global.jQuery('#accountMenu .account-menu-head-plan').text(PLAN_LABEL);
        positionMenu();
        global.jQuery('#accountMenu').prop('hidden', false).addClass('is-open');
        global.jQuery('#accountBtn').addClass('is-active');
    }
    function closeMenu() {
        global.jQuery('#accountMenu').prop('hidden', true).removeClass('is-open');
        global.jQuery('#accountBtn').removeClass('is-active');
    }
    function menuOpen() { return global.jQuery('#accountMenu').hasClass('is-open'); }

    function onMenuAct(act) {
        closeMenu();
        switch (act) {
            case 'settings': openSettings(); break;
            case 'profile':  editProfile();  break;
            case 'logout':   doLogout();     break;
            case 'upgrade':
            case 'custom':
            case 'help':
                toast('Sección "' + labelFor(act) + '" próximamente', 'info');
                break;
        }
    }
    function labelFor(id) {
        const it = MENU_ITEMS.filter(function (m) { return m.id === id; })[0];
        return it ? it.label : id;
    }

    function editProfile() {
        const cur = profileName();
        const name = global.prompt('Nombre a mostrar en tu cuenta:', cur);
        if (name != null && name.trim()) { saveProfileName(name.trim()); refreshAccountBar(); }
    }

    function doLogout() {
        // Sin backend de auth: confirmamos y volvemos al inicio del visor.
        if (global.confirm('¿Cerrar sesión?')) { global.location.href = 'index.php'; }
    }

    /* ---------- Modal de Configuración (modelos) ---------- */
    function buildSettings() {
        if (global.jQuery('#accountSettings').length) return;
        const html = '<div id="accountSettings" class="acct-modal" hidden>'
                   +   '<div class="acct-modal-backdrop"></div>'
                   +   '<div class="acct-modal-card" role="dialog" aria-modal="true" aria-label="Configuración">'
                   +     '<div class="acct-modal-head">'
                   +       '<div class="acct-modal-title"><i data-lucide="settings" class="w-4 h-4"></i> Configuración</div>'
                   +       '<button type="button" class="acct-modal-x" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>'
                   +     '</div>'
                   +     '<div class="acct-modal-body">'
                   +       '<div class="acct-sec-head">'
                   +         '<div>'
                   +           '<div class="acct-sec-title">Modelos disponibles</div>'
                   +           '<div class="acct-sec-sub">Elige qué modelos aparecen en los selectores de todos los chats.</div>'
                   +         '</div>'
                   +         '<div class="acct-sec-actions">'
                   +           '<button type="button" class="acct-mini" data-bulk="all">Todos</button>'
                   +           '<button type="button" class="acct-mini" data-bulk="none">Ninguno</button>'
                   +         '</div>'
                   +       '</div>'
                   +       '<div id="acctModelList" class="acct-model-list"></div>'
                   +     '</div>'
                   +     '<div class="acct-modal-foot">'
                   +       '<span id="acctModelCount" class="acct-foot-count"></span>'
                   +       '<button type="button" class="acct-btn acct-btn-primary" data-close="1">Listo</button>'
                   +     '</div>'
                   +   '</div>'
                   + '</div>';
        global.jQuery('body').append(html);
        renderModelList();
        if (global.lucide) global.lucide.createIcons();
    }

    function renderModelList() {
        const MC = global.CoffeeModelConfig;
        if (!MC) return;
        const enabled = MC.getEnabled();
        const groups = MC.CATALOG.map(function (g) {
            const items = g.options.map(function (o) {
                const on = enabled.indexOf(o.value) !== -1;
                return '<label class="acct-model-item' + (on ? ' is-on' : '') + '">'
                     +   '<input type="checkbox" class="acct-model-cb" value="' + escAttr(o.value) + '"' + (on ? ' checked' : '') + '>'
                     +   '<span class="acct-model-name">' + escHtml(o.label) + '</span>'
                     +   '<span class="acct-model-val">' + escHtml(o.value) + '</span>'
                     + '</label>';
            }).join('');
            return '<div class="acct-model-group">'
                 +   '<div class="acct-model-group-label">' + escHtml(g.group) + '</div>'
                 +   items
                 + '</div>';
        }).join('');
        global.jQuery('#acctModelList').html(groups);
        updateCount();
    }

    function currentChecked() {
        return global.jQuery('#acctModelList .acct-model-cb:checked').map(function () { return this.value; }).get();
    }
    function updateCount() {
        const n = currentChecked().length;
        const total = global.CoffeeModelConfig ? global.CoffeeModelConfig.allValues().length : 0;
        global.jQuery('#acctModelCount').text(n + ' de ' + total + ' modelos habilitados');
    }
    // Aplica la selección actual a la preferencia global (propaga a todos los chats).
    function commitModels() {
        const MC = global.CoffeeModelConfig;
        if (!MC) return;
        MC.setEnabled(currentChecked());
        updateCount();
    }

    function openSettings() {
        buildSettings();
        renderModelList();
        global.jQuery('#accountSettings').prop('hidden', false).addClass('is-open');
    }
    function closeSettings() {
        global.jQuery('#accountSettings').prop('hidden', true).removeClass('is-open');
    }

    function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function escAttr(s) { return escHtml(s); }

    /* ---------- Wiring ---------- */
    function init($) {
        // La barra de cuenta solo existe en el sidebar del Visor: salir en silencio si no está.
        if (!$('#accountBtn').length) return;

        refreshAccountBar();
        if (global.lucide) global.lucide.createIcons();
        // Los <select> de modelo los engancha model-config.js (bindAll sobre .ia-model-pill).

        $('#accountBtn').on('click', function (e) {
            e.stopPropagation();
            menuOpen() ? closeMenu() : openMenu();
        });
        $(document).on('click', '.account-menu-item', function (e) {
            e.stopPropagation();
            onMenuAct($(this).data('act'));
        });
        // Cerrar menú al hacer clic fuera o con Escape.
        $(document).on('click', function () { if (menuOpen()) closeMenu(); });
        $(document).on('keydown', function (e) {
            if (e.key === 'Escape') { closeMenu(); closeSettings(); }
        });
        global.addEventListener('resize', function () { if (menuOpen()) positionMenu(); });

        // Modal de configuración (delegado, el nodo se crea al abrir).
        $(document).on('click', '#accountSettings .acct-modal-x, #accountSettings [data-close], #accountSettings .acct-modal-backdrop', function () { closeSettings(); });
        $(document).on('click', '#accountSettings .acct-modal-card', function (e) { e.stopPropagation(); });
        $(document).on('change', '#acctModelList .acct-model-cb', function () {
            // Evita dejar cero modelos: revertir el último desmarcado.
            if (currentChecked().length === 0) {
                this.checked = true;
                toast('Debe quedar al menos un modelo habilitado', 'warn');
            }
            $(this).closest('.acct-model-item').toggleClass('is-on', this.checked);
            commitModels();
        });
        $(document).on('click', '#accountSettings [data-bulk]', function () {
            const all = $(this).data('bulk') === 'all';
            $('#acctModelList .acct-model-cb').each(function () { this.checked = all; });
            if (!all) { $('#acctModelList .acct-model-cb').first().prop('checked', true); }
            $('#acctModelList .acct-model-item').each(function () { $(this).toggleClass('is-on', $(this).find('.acct-model-cb').prop('checked')); });
            commitModels();
        });
    }

    if (global.jQuery) {
        global.jQuery(function () { init(global.jQuery); });
    } else {
        document.addEventListener('DOMContentLoaded', function () { init(global.jQuery); });
    }

    global.CoffeeAccount = { openSettings: openSettings, refresh: refreshAccountBar };
})(window);
