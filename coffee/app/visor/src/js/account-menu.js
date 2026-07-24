/* Barra de cuenta al pie del sidebar (estilo ChatGPT): muestra el usuario activo
 * y abre un menú con opciones. La única funcional por ahora es "Configuración",
 * que abre un modal para habilitar/deshabilitar qué modelos aparecen en TODOS los
 * chats (usa CoffeeModelConfig, la preferencia es global y compartida). */
(function (global) {
    'use strict';

    const PROFILE_KEY = 'coffeeia:profile:name';
    const DEFAULT_NAME = 'CoffeeSoft Dev';
    const PLAN_LABEL   = 'Go';

    // Usuario real de la sesion (cargado via AJAX en init). Si la llamada falla
    // o aun no responde, se cae al nombre guardado en localStorage.
    let _currentUser = null;
    let _activeProfile = null;
    let _profiles = [];

    function profileName() {
        if (_activeProfile) return profileDisplayName(_activeProfile);
        if (_currentUser && _currentUser.name) return _currentUser.name;
        try { return localStorage.getItem(PROFILE_KEY) || DEFAULT_NAME; }
        catch (e) { return DEFAULT_NAME; }
    }
    function profileDisplayName(profile) {
        if (!profile) return '';
        return profile.short_name || profile.display_name || profile.name || '';
    }
    function specialtyLabel(value) {
        const labels = {
            frontend: 'Frontend',
            backend: 'Backend',
            design: 'Diseño',
            analysis: 'Análisis',
            qa: 'QA',
            administration: 'Administración'
        };
        return labels[value] || '';
    }
    function profileAvatar(profile, className) {
        const item = profile || {};
        const name = profileDisplayName(item) || item.name || DEFAULT_NAME;
        const type = item.avatar_type || (item.avatar_url ? 'image' : 'initials');
        const value = item.avatar_value || item.avatar_url || '';
        const color = item.color || 'var(--vsr-accent)';
        let content = escHtml(item.initials || initials(name));
        if (type === 'emoji' && value) content = '<span aria-hidden="true">' + escHtml(value) + '</span>';
        if (type === 'icon' && value) content = '<i data-lucide="' + escAttr(value) + '"></i>';
        if (type === 'image' && value) {
            const source = /^(https?:\/\/|data:|blob:|\/)/i.test(value) ? value : '../' + value.replace(/^\.\//, '');
            content = '<img src="' + escAttr(source) + '" alt="">';
        }
        return '<span class="' + escAttr(className) + '" style="background:' + escAttr(color) + '">' + content + '</span>';
    }
    function notifyIdentity() {
        global.dispatchEvent(new CustomEvent('coffeeia:identity-changed', {
            detail: { user: _currentUser, profile: _activeProfile }
        }));
    }
    function loadCurrentUser(done) {
        global.jQuery.get('../ctrl/ctrl-auth.php', { action: 'me' })
            .done(function (res) {
                if (res && res.success && res.user) {
                    _currentUser = res.user;
                    _activeProfile = res.active_profile || null;
                    refreshAccountBar();
                    notifyIdentity();
                    if (typeof done === 'function') done(res);
                }
            });
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
        const accountButton = global.jQuery('#accountBtn');
        if (!accountButton.length) return;
        const identity = _activeProfile || _currentUser || { name: profileName() };
        accountButton.find('.account-avatar').replaceWith(profileAvatar(identity, 'account-avatar'));
        accountButton.attr('title', profileName() + ' · Cuenta y configuración');
        if (global.lucide) global.lucide.createIcons();
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
        const identity = _activeProfile || _currentUser || { name: profileName() };
        const name = profileDisplayName(identity) || profileName();
        global.jQuery('#accountMenu .account-avatar-sm').replaceWith(profileAvatar(identity, 'account-avatar account-avatar-sm'));
        global.jQuery('#accountMenu .account-menu-head-name').text(name);
        global.jQuery('#accountMenu .account-menu-head-plan').text(_activeProfile ? (specialtyLabel(_activeProfile.specialty) || _activeProfile.role || PLAN_LABEL) : PLAN_LABEL);
        positionMenu();
        global.jQuery('#accountMenu').prop('hidden', false).addClass('is-open');
        global.jQuery('#accountBtn').addClass('is-active');
        if (global.lucide) global.lucide.createIcons();
    }
    function closeMenu() {
        global.jQuery('#accountMenu').prop('hidden', true).removeClass('is-open');
        global.jQuery('#accountBtn').removeClass('is-active');
    }
    function menuOpen() { return global.jQuery('#accountMenu').hasClass('is-open'); }

    function onMenuAct(act) {
        closeMenu();
        switch (act) {
            case 'settings': openSettings('account'); break;
            case 'profile':  openSettings('profiles'); break;
            case 'logout':   doLogout();     break;
            case 'upgrade': openUpgrade(); break;
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

    function doLogout() {
        if (!global.confirm('¿Cerrar sesión?')) return;
        global.jQuery.post('../ctrl/ctrl-auth.php', { action: 'logout' })
            .always(function () { global.location.href = '../index.php'; });
    }

    /* ---------- Modal de Configuración (modelos) ---------- */
    // Vista del panel de modelos: 'list' (habilitar + CRUD) o 'form' (editor del modelo).
    let _modelView = 'list';
    let _modelEditId = null;
    let _mfTags = [];       // etiquetas en edición (chips)
    let _mfEffort = [];     // niveles reasoning_effort en edición (chips)
    const EFFORT_ALL = ['low', 'medium', 'high', 'max'];

    function buildSettings() {
        if (global.jQuery('#accountSettings').length) return;
        const html = '<div id="accountSettings" class="acct-modal acct-settings-modal" hidden>'
                   +   '<div class="acct-modal-backdrop"></div>'
                   +   '<div class="acct-modal-card" role="dialog" aria-modal="true" aria-label="Configuración">'
                   +     '<div class="acct-modal-head">'
                   +       '<div class="acct-modal-title"><i data-lucide="settings" class="w-4 h-4"></i> Configuración</div>'
                   +       '<button type="button" class="acct-modal-x" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>'
                   +     '</div>'
                   +     '<div class="acct-settings-layout">'
                   +       '<nav class="acct-settings-nav" aria-label="Secciones de configuración">'
                   +         '<button type="button" data-settings-section="account"><i data-lucide="user-round"></i><span>Mi cuenta</span></button>'
                   +         '<button type="button" data-settings-section="profiles"><i data-lucide="users-round"></i><span>Perfiles</span></button>'
                   +         '<button type="button" data-settings-section="models"><i data-lucide="bot"></i><span>Modelos</span></button>'
                   +       '</nav>'
                   +       '<div class="acct-modal-body acct-settings-content">'
                   +         '<div id="acctUserPanel"></div>'
                   +         '<div id="acctProfilesPanel" hidden></div>'
                   +         '<div id="acctModelPanel" hidden></div>'
                   +       '</div>'
                   +     '</div>'
                   +     '<div class="acct-modal-foot">'
                   +       '<span id="acctModelCount" class="acct-foot-count"></span>'
                   +       '<button type="button" class="acct-btn acct-btn-primary" data-close="1">Listo</button>'
                   +     '</div>'
                   +   '</div>'
                   + '</div>';
        global.jQuery('body').append(html);
        if (global.lucide) global.lucide.createIcons();
    }

    function renderSettingsSection(section) {
        const valid = ['account', 'profiles', 'models'];
        const active = valid.indexOf(section) !== -1 ? section : 'account';
        const panels = { account: '#acctUserPanel', profiles: '#acctProfilesPanel', models: '#acctModelPanel' };

        global.jQuery('#accountSettings [data-settings-section]').each(function () {
            global.jQuery(this).toggleClass('is-active', global.jQuery(this).data('settings-section') === active);
        });
        Object.keys(panels).forEach(function (key) {
            global.jQuery(panels[key]).prop('hidden', key !== active);
        });

        if (active === 'account') renderUserPanel();
        if (active === 'profiles') loadProfiles();
        if (active === 'models') renderModelPanel();
        if (active !== 'models') global.jQuery('#accountSettings').removeClass('is-editing');
        if (global.lucide) global.lucide.createIcons();
    }

    function renderModelPanel() {
        if (_modelView === 'form') renderModelForm();
        else renderModelList();
        global.jQuery('#accountSettings').toggleClass('is-editing', _modelView === 'form');
        if (global.lucide) global.lucide.createIcons();
    }

    // ── Vista LISTA: habilitar/deshabilitar + editar/eliminar + agregar ───────────
    function renderModelList() {
        const MC = global.CoffeeModelConfig;
        if (!MC) return;

        const enabled = MC.getEnabled();
        const models = MC.getModels();
        const formatTokens = function (value) {
            const amount = Number(value);
            if (!amount) return '';
            if (amount >= 1000000) return (amount / 1000000).toFixed(amount % 1000000 ? 1 : 0) + 'M';
            if (amount >= 1000) return (amount / 1000).toFixed(amount % 1000 ? 1 : 0) + 'k';
            return String(amount);
        };
        const providers = [];
        models.forEach(function (model) {
            const provider = model.provider || 'ollama';
            if (providers.indexOf(provider) === -1) providers.push(provider);
        });

        const groups = MC.CATALOG.map(function (group) {
            let activeInGroup = 0;
            const items = group.options.map(function (option) {
                const model = option.model || {};
                const on = enabled.indexOf(option.value) !== -1;
                if (on) activeInGroup++;

                const provider = model.provider || 'ollama';
                const providerName = provider === 'openrouter' ? 'OpenRouter' : 'Ollama';
                const providerMark = provider === 'openrouter' ? 'OR' : 'OL';
                const capabilities = []
                    .concat(model.vision ? [{ key: 'vision', icon: 'eye', label: 'Visión' }] : [])
                    .concat(model.tools ? [{ key: 'tools', icon: 'wrench', label: 'Tools' }] : [])
                    .concat((model.effortLevels && model.effortLevels.length) || model.thinking
                        ? [{ key: 'thinking', icon: 'brain', label: 'Razonamiento' }]
                        : [])
                    .map(function (capability) {
                        return '<span class="acct-cap acct-cap-' + capability.key + '"><i data-lucide="' + capability.icon + '"></i>' + capability.label + '</span>';
                    }).join('');
                const tags = (model.tags || []).slice(0, 2).map(function (tag) {
                    return '<span class="acct-model-tag">' + escHtml(tag) + '</span>';
                }).join('');
                const context = formatTokens(model.maxTokens);
                const pricing = Number(model.priceIn) || Number(model.priceOut)
                    ? '<span><i data-lucide="circle-dollar-sign"></i>$' + Number(model.priceIn || 0).toFixed(2) + ' / $' + Number(model.priceOut || 0).toFixed(2) + ' por M</span>'
                    : '';
                const searchValue = [option.label, option.value, providerName, group.group].concat(model.tags || []).join(' ').toLowerCase();

                return '<div class="acct-model-item' + (on ? ' is-on' : '') + '" data-id="' + escAttr(option.value) + '" data-provider="' + escAttr(provider) + '" data-search="' + escAttr(searchValue) + '">'
                     +   '<span class="acct-provider-avatar acct-provider-' + escAttr(provider) + '">' + providerMark + '</span>'
                     +   '<span class="acct-model-main">'
                     +     '<span class="acct-model-title-row"><span class="acct-model-name">' + escHtml(option.label) + '</span>' + (model.builtin ? '<span class="acct-model-base">Base</span>' : '') + '</span>'
                     +     '<span class="acct-model-val">' + escHtml(option.value) + '</span>'
                     +     (model.desc ? '<span class="acct-model-desc">' + escHtml(model.desc) + '</span>' : '')
                     +     '<span class="acct-model-caps">' + capabilities + tags + '</span>'
                     +     '<span class="acct-model-meta">'
                     +       '<span><i data-lucide="cloud"></i>' + providerName + '</span>'
                     +       (context ? '<span><i data-lucide="braces"></i>' + context + ' tokens</span>' : '')
                     +       pricing
                     +     '</span>'
                     +   '</span>'
                     +   '<label class="acct-model-switch" title="Habilitar o deshabilitar modelo">'
                     +     '<input type="checkbox" class="acct-model-cb" value="' + escAttr(option.value) + '"' + (on ? ' checked' : '') + '>'
                     +     '<span class="acct-switch-track"><span></span></span>'
                     +     '<span class="acct-model-state acct-state-on">Activo</span><span class="acct-model-state acct-state-off">Inactivo</span>'
                     +   '</label>'
                     +   '<details class="acct-model-menu">'
                     +     '<summary title="Acciones"><i data-lucide="more-horizontal"></i></summary>'
                     +     '<span class="acct-model-menu-pop">'
                     +       '<button type="button" data-model-edit><i data-lucide="pencil"></i>Editar</button>'
                     +       '<button type="button" class="is-danger" data-model-del><i data-lucide="trash-2"></i>Eliminar</button>'
                     +     '</span>'
                     +   '</details>'
                     + '</div>';
            }).join('');

            return '<section class="acct-model-group" data-group="' + escAttr(group.group) + '">'
                 +   '<header class="acct-model-group-head">'
                 +     '<span><i data-lucide="layers-3"></i><strong>' + escHtml(group.group) + '</strong></span>'
                 +     '<span>' + activeInGroup + ' activos de ' + group.options.length + '</span>'
                 +   '</header>'
                 +   '<div class="acct-model-group-body">' + items + '</div>'
                 + '</section>';
        }).join('');

        const providerButtons = providers.map(function (provider) {
            const label = provider === 'openrouter' ? 'OpenRouter' : 'Ollama';
            return '<button type="button" class="acct-provider-chip" data-provider-filter="' + escAttr(provider) + '">' + label + '</button>';
        }).join('');
        const head = '<div class="acct-model-hero">'
                   +   '<div><div class="acct-sec-title">Modelos de CoffeeIA</div><div class="acct-sec-sub">Configura los modelos disponibles en todas las conversaciones.</div></div>'
                   +   '<button type="button" class="acct-mini acct-mini-primary" data-model-add><i data-lucide="plus"></i>Nuevo modelo</button>'
                   + '</div>';
        const toolbar = '<div class="acct-model-toolbar">'
                      +   '<label class="acct-model-search"><i data-lucide="search"></i><input id="acctModelSearch" type="search" placeholder="Buscar modelos..."></label>'
                      +   '<div class="acct-provider-filters"><button type="button" class="acct-provider-chip is-active" data-provider-filter="">Todos</button>' + providerButtons + '</div>'
                      + '</div>';
        const empty = '<div id="acctModelEmpty" class="acct-model-empty" hidden><i data-lucide="search-x"></i><strong>Sin coincidencias</strong><span>Prueba con otro nombre, proveedor o estado.</span></div>';
        const panel = global.jQuery('#acctModelPanel');
        panel.html(head + toolbar + '<div class="acct-model-results"><span id="acctModelVisible"></span></div><div id="acctModelList" class="acct-model-list">' + groups + '</div>' + empty);

        const applyFilters = function () {
            const term = String(panel.find('#acctModelSearch').val() || '').trim().toLowerCase();
            const provider = String(panel.find('.acct-provider-chip.is-active').data('provider-filter') || '');
            let visible = 0;

            panel.find('.acct-model-item').each(function () {
                const card = global.jQuery(this);
                const matchesTerm = !term || String(card.data('search') || '').indexOf(term) !== -1;
                const matchesProvider = !provider || card.data('provider') === provider;
                const show = matchesTerm && matchesProvider;
                this.hidden = !show;
                if (show) visible++;
            });
            panel.find('.acct-model-group').each(function () {
                this.hidden = global.jQuery(this).find('.acct-model-item').filter(function () { return !this.hidden; }).length === 0;
            });
            panel.find('#acctModelVisible').text(visible + (visible === 1 ? ' modelo' : ' modelos'));
            panel.find('#acctModelEmpty').prop('hidden', visible !== 0);
        };

        panel.off('.modelFilters')
            .on('input.modelFilters', '#acctModelSearch', applyFilters)
            .on('click.modelFilters', '.acct-provider-chip', function () {
                panel.find('.acct-provider-chip').removeClass('is-active');
                global.jQuery(this).addClass('is-active');
                applyFilters();
            });
        applyFilters();
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
    function commitModels() {
        const MC = global.CoffeeModelConfig;
        if (!MC) return;
        MC.setEnabled(currentChecked());
        updateCount();
    }

    // ── Vista FORMULARIO: editor completo del modelo (el mockup) ──────────────────
    function fieldRow(label, inner, hint) {
        return '<label class="acct-f">'
             +   '<span class="acct-f-label">' + label + '</span>' + inner
             +   (hint ? '<span class="acct-f-hint">' + hint + '</span>' : '')
             + '</label>';
    }
    function renderTagChips() {
        return _mfTags.map(function (t, i) {
            return '<span class="acct-chip" data-tag-i="' + i + '">' + escHtml(t) + ' <i data-lucide="x" class="w-3 h-3" data-tag-del="' + i + '"></i></span>';
        }).join('');
    }
    function renderEffortChips() {
        return EFFORT_ALL.map(function (lv) {
            const on = _mfEffort.indexOf(lv) !== -1;
            return '<button type="button" class="acct-effort-chip' + (on ? ' is-on' : '') + '" data-effort="' + lv + '">' + lv + '</button>';
        }).join('');
    }
    function effortDefaultOptions(sel) {
        let out = '<option value="">— sin definir —</option>';
        _mfEffort.forEach(function (lv) {
            out += '<option value="' + lv + '"' + (sel === lv ? ' selected' : '') + '>' + lv + '</option>';
        });
        return out;
    }

    function renderModelForm() {
        const MC = global.CoffeeModelConfig;
        const editing = !!_modelEditId;
        const m = (editing && MC) ? (MC.getModel(_modelEditId) || {}) : {};
        _mfTags   = Array.isArray(m.tags) ? m.tags.slice() : [];
        _mfEffort = Array.isArray(m.effortLevels) ? m.effortLevels.slice() : [];

        const identity =
            '<div class="acct-card"><div class="acct-card-title"><i data-lucide="info" class="w-4 h-4"></i> Identidad</div>'
          +   '<div class="acct-grid2">'
          +     fieldRow('Nombre <span class="req">*</span>', '<input type="text" class="acct-input" id="mfName" value="' + escAttr(m.name || '') + '" placeholder="Ej. Gemma 4">')
          +     fieldRow('Identificador del modelo <span class="req">*</span>', '<input type="text" class="acct-input mono" id="mfId" value="' + escAttr(m.id || '') + '" placeholder="gemma4:31b-cloud"' + (editing ? ' readonly' : '') + '>', 'Es el id que se manda al proveedor')
          +   '</div>'
          +   fieldRow('Descripción', '<textarea class="acct-input" id="mfDesc" rows="2" placeholder="Fortalezas, uso recomendado...">' + escHtml(m.desc || '') + '</textarea>')
          +   '<div class="acct-grid2">'
          +     fieldRow('Proveedor', '<select class="acct-input" id="mfProvider">'
                  + '<option value="ollama"' + (m.provider === 'openrouter' ? '' : ' selected') + '>ollama</option>'
                  + '<option value="openrouter"' + (m.provider === 'openrouter' ? ' selected' : '') + '>openrouter</option>'
                  + '</select>')
          +     fieldRow('Grupo', '<input type="text" class="acct-input" id="mfGroup" value="' + escAttr(m.group || '') + '" placeholder="Ollama Cloud">', 'Encabezado bajo el que aparece en los selectores')
          +   '</div>'
          +   fieldRow('Etiquetas', '<div class="acct-tags"><span id="mfTagChips">' + renderTagChips() + '</span><input type="text" class="acct-tag-input" id="mfTagInput" placeholder="Escribe una etiqueta y presiona Enter..."></div>')
          + '</div>';

        const caps =
            '<div class="acct-card"><div class="acct-card-title"><i data-lucide="sparkles" class="w-4 h-4"></i> Capacidades</div>'
          +   '<div class="acct-checks">'
          +     '<label class="acct-check"><input type="checkbox" id="mfVision"' + (m.vision ? ' checked' : '') + '> Visión (imágenes)</label>'
          +     '<label class="acct-check"><input type="checkbox" id="mfTools"' + (m.tools ? ' checked' : '') + '> Tools (tool-calling: run_select / lectura de carpeta)</label>'
          +   '</div>'
          + '</div>';

        const params =
            '<div class="acct-card"><div class="acct-card-title"><i data-lucide="sliders-horizontal" class="w-4 h-4"></i> Parámetros</div>'
          +   '<div class="acct-grid2">'
          +     fieldRow('Máx. tokens', '<input type="number" class="acct-input" id="mfMaxTokens" value="' + (m.maxTokens != null ? m.maxTokens : '') + '" placeholder="p.ej. 256000">')
          +     fieldRow('Temp. mínima', '<input type="number" step="0.1" class="acct-input" id="mfTempMin" value="' + (m.tempMin != null ? m.tempMin : '') + '" placeholder="vacío = sin mínimo">')
          +   '</div>'
          +   '<div class="acct-grid2">'
          +     fieldRow('Precio entrada ($/M)', '<input type="number" step="0.01" class="acct-input" id="mfPriceIn" value="' + (m.priceIn || 0) + '">')
          +     fieldRow('Precio salida ($/M)', '<input type="number" step="0.01" class="acct-input" id="mfPriceOut" value="' + (m.priceOut || 0) + '">')
          +   '</div>'
          + '</div>';

        const reasoning =
            '<div class="acct-card"><div class="acct-card-title"><i data-lucide="brain" class="w-4 h-4"></i> Razonamiento</div>'
          +   '<div class="acct-checks">'
          +     '<label class="acct-check"><input type="checkbox" id="mfThinking"' + (m.thinking ? ' checked' : '') + '> Muestra razonamiento (thinking)</label>'
          +     '<label class="acct-check"><input type="checkbox" id="mfThinkObj"' + (m.thinkingObject ? ' checked' : '') + '> Requiere objeto thinking <code>{"type":"enabled"}</code></label>'
          +   '</div>'
          +   '<div class="acct-f-label" style="margin-top:10px">Niveles de <code>reasoning_effort</code> aceptados</div>'
          +   '<div class="acct-effort-chips" id="mfEffortChips">' + renderEffortChips() + '</div>'
          +   '<div class="acct-f-hint">Vacío = el modelo no acepta reasoning_effort (el selector de Esfuerzo se ocultará para él).</div>'
          +   fieldRow('Nivel por defecto', '<select class="acct-input" id="mfEffortDefault">' + effortDefaultOptions(m.effortDefault || '') + '</select>')
          + '</div>';

        const foot =
            '<div class="acct-form-foot">'
          +   (editing ? '<button type="button" class="acct-btn acct-btn-danger" data-model-del-form>Eliminar</button>' : '<span></span>')
          +   '<span class="acct-form-foot-r">'
          +     '<button type="button" class="acct-btn" data-model-cancel>Cancelar</button>'
          +     '<button type="submit" class="acct-btn acct-btn-primary"><i data-lucide="save" class="w-4 h-4"></i> Guardar modelo</button>'
          +   '</span>'
          + '</div>';

        global.jQuery('#acctModelPanel').html('<form id="acctModelForm" class="acct-model-form">' + identity + caps + params + reasoning + foot + '</form>');
    }

    function openModelForm(id) { _modelView = 'form'; _modelEditId = id || null; renderModelPanel(); }
    function backToModelList() { _modelView = 'list'; _modelEditId = null; renderModelPanel(); }

    function saveModelForm() {
        const MC = global.CoffeeModelConfig;
        if (!MC) return;
        const $ = global.jQuery;
        const id = ($('#mfId').val() || '').trim();
        const name = ($('#mfName').val() || '').trim();
        if (!id)   { toast('El identificador del modelo es obligatorio', 'warn'); return; }
        if (!name) { toast('El nombre es obligatorio', 'warn'); return; }
        // Alta (no edición) con id ya existente: evitar duplicado silencioso.
        if (!_modelEditId && MC.getModel(id)) { toast('Ya existe un modelo con ese identificador', 'warn'); return; }

        const numOrNull = function (sel) { const v = $(sel).val(); return v === '' || v == null ? null : Number(v); };
        MC.upsertModel({
            id: id,
            name: name,
            desc: ($('#mfDesc').val() || '').trim(),
            provider: $('#mfProvider').val() || 'ollama',
            group: ($('#mfGroup').val() || '').trim(),
            tags: _mfTags.slice(),
            vision: $('#mfVision').prop('checked'),
            tools: $('#mfTools').prop('checked'),
            thinking: $('#mfThinking').prop('checked'),
            thinkingObject: $('#mfThinkObj').prop('checked'),
            effortLevels: _mfEffort.slice(),
            effortDefault: $('#mfEffortDefault').val() || '',
            maxTokens: numOrNull('#mfMaxTokens'),
            tempMin: numOrNull('#mfTempMin'),
            priceIn: Number($('#mfPriceIn').val()) || 0,
            priceOut: Number($('#mfPriceOut').val()) || 0,
            builtin: _modelEditId ? (MC.getModel(_modelEditId) || {}).builtin : false
        });
        toast('Modelo guardado', 'ok');
        backToModelList();
    }

    function deleteModelFromList(id) {
        const MC = global.CoffeeModelConfig;
        if (!MC || !id) return;
        if (MC.getModels().length <= 1) { toast('Debe quedar al menos un modelo', 'warn'); return; }
        if (!global.confirm('¿Eliminar el modelo "' + id + '" del catálogo?')) return;
        MC.deleteModel(id);
        toast('Modelo eliminado', 'info');
        if (_modelView === 'form') backToModelList(); else renderModelPanel();
    }

    function renderUserPanel() {
        if (!_currentUser) {
            global.jQuery('#acctUserPanel').html('<div class="acct-empty">Cargando cuenta...</div>');
            loadCurrentUser(function () { renderUserPanel(); });
            return;
        }

        const passwordFields = _currentUser.has_password
            ? fieldRow('Contraseña actual', '<input type="password" class="acct-input" id="accountCurrentPassword" autocomplete="current-password">', 'Requerida si cambias la contraseña o el PIN.')
            : '';

        const pinStatus = _currentUser.has_pin
            ? '<div class="acct-f-hint" style="margin:2px 0 10px"><i data-lucide="shield-check"></i> Tienes un PIN de acceso rápido configurado.</div>'
            : '<div class="acct-f-hint" style="margin:2px 0 10px">Configura un PIN de 4 a 6 dígitos para iniciar sesión rápido, sin escribir tu contraseña.</div>';
        const pinCard = '<div class="acct-card"><div class="acct-card-title"><i data-lucide="lock-keyhole"></i> PIN de acceso rápido</div>'
                      +   pinStatus
                      +   '<div class="acct-grid2">'
                      +     fieldRow(_currentUser.has_pin ? 'Nuevo PIN' : 'PIN (4-6 dígitos)', '<input type="password" class="acct-input" id="accountNewPin" inputmode="numeric" maxlength="6" autocomplete="off">', _currentUser.has_pin ? 'Déjalo vacío para conservar el actual.' : 'Solo números, de 4 a 6 dígitos.')
                      +     fieldRow('Confirmar PIN', '<input type="password" class="acct-input" id="accountPinConfirm" inputmode="numeric" maxlength="6" autocomplete="off">')
                      +   '</div>'
                      +   (_currentUser.has_pin ? '<label class="acct-check" style="margin-top:8px"><input type="checkbox" id="accountRemovePin"> Quitar mi PIN de acceso</label>' : '')
                      + '</div>';
        const html = '<div class="acct-sec-head">'
                   +   '<div><div class="acct-sec-title">Mi cuenta</div><div class="acct-sec-sub">Actualiza los datos usados para iniciar sesión en CoffeeSoft.</div></div>'
                   + '</div>'
                   + '<div class="acct-user-summary">'
                   +   '<span class="acct-profile-avatar" style="background:var(--vsr-accent)">' + escHtml(_currentUser.initials || initials(_currentUser.name)) + '</span>'
                   +   '<div><strong>' + escHtml(_currentUser.name) + '</strong><span>' + escHtml(_currentUser.email) + '</span></div>'
                   + '</div>'
                   + '<form id="acctUserForm" class="acct-model-form">'
                   +   '<div class="acct-card"><div class="acct-card-title"><i data-lucide="contact"></i> Datos personales</div>'
                   +     '<div class="acct-grid2">'
                   +       fieldRow('Nombre <span class="req">*</span>', '<input type="text" class="acct-input" id="accountName" value="' + escAttr(_currentUser.name) + '" autocomplete="name">')
                   +       fieldRow('Correo <span class="req">*</span>', '<input type="email" class="acct-input" id="accountEmail" value="' + escAttr(_currentUser.email) + '" autocomplete="email">')
                   +     '</div>'
                   +   '</div>'
                   +   '<div class="acct-card"><div class="acct-card-title"><i data-lucide="key-round"></i> Seguridad</div>'
                   +     passwordFields
                   +     '<div class="acct-grid2">'
                   +       fieldRow('Nueva contraseña', '<input type="password" class="acct-input" id="accountNewPassword" minlength="8" autocomplete="new-password">', 'Déjala vacía para conservar la actual.')
                   +       fieldRow('Confirmar contraseña', '<input type="password" class="acct-input" id="accountPasswordConfirm" minlength="8" autocomplete="new-password">')
                   +     '</div>'
                   +   '</div>'
                   +   pinCard
                   +   '<div class="acct-form-foot"><span></span><button type="submit" class="acct-btn acct-btn-primary"><i data-lucide="save"></i> Guardar cuenta</button></div>'
                   + '</form>';
        global.jQuery('#acctUserPanel').html(html);
        global.jQuery('#acctModelCount').text('Usuario #' + _currentUser.id);
        if (global.lucide) global.lucide.createIcons();
    }

    function saveUser() {
        global.jQuery.post('../ctrl/ctrl-auth.php', {
            action: 'update_me',
            name: global.jQuery('#accountName').val(),
            email: global.jQuery('#accountEmail').val(),
            current_password: global.jQuery('#accountCurrentPassword').val() || '',
            new_password: global.jQuery('#accountNewPassword').val() || '',
            password_confirm: global.jQuery('#accountPasswordConfirm').val() || '',
            new_pin: global.jQuery('#accountNewPin').val() || '',
            pin_confirm: global.jQuery('#accountPinConfirm').val() || '',
            remove_pin: global.jQuery('#accountRemovePin').prop('checked') ? '1' : ''
        }).done(function (res) {
            if (!res || !res.success) { toast((res && res.message) || 'No se pudo actualizar la cuenta', 'warn'); return; }
            _currentUser = res.user;
            try { localStorage.setItem(PROFILE_KEY, _currentUser.name); } catch (e) {}
            refreshAccountBar();
            notifyIdentity();
            renderUserPanel();
            toast(res.message, 'ok');
        }).fail(function (xhr) {
            toast((xhr.responseJSON && xhr.responseJSON.message) || 'No se pudo actualizar la cuenta', 'warn');
        });
    }

    function loadProfiles() {
        global.jQuery('#acctProfilesPanel').html('<div class="acct-empty">Cargando perfiles...</div>');
        global.jQuery.get('../ctrl/ctrl-auth.php', { action: 'profiles' })
            .done(function (res) {
                if (!res || !res.success) { toast((res && res.message) || 'No se pudieron cargar los perfiles', 'warn'); return; }
                _profiles = res.profiles || [];
                _activeProfile = _profiles.filter(function (profile) { return profile.is_active; })[0] || null;
                renderProfiles();
                refreshAccountBar();
                notifyIdentity();
            })
            .fail(function () {
                global.jQuery('#acctProfilesPanel').html('<div class="acct-empty">No se pudieron cargar los perfiles.</div>');
            });
    }

    function renderProfiles() {
        const rows = _profiles.map(function (profile) {
            const displayName = profileDisplayName(profile);
            const specialty = specialtyLabel(profile.specialty);
            const meta = [specialty, profile.role].filter(Boolean).join(' · ') || 'Sin especialidad';
            const detail = profile.short_name && profile.short_name !== profile.name ? profile.name : profile.description;
            return '<div class="acct-profile-card' + (profile.is_active ? ' is-active' : '') + '" data-profile-id="' + profile.id + '">'
                 +   profileAvatar(profile, 'acct-profile-avatar')
                 +   '<span class="acct-profile-info"><strong>' + escHtml(displayName) + '</strong><span class="acct-profile-specialty">' + escHtml(meta) + '</span>'
                 +     (detail ? '<small>' + escHtml(detail) + '</small>' : '') + '</span>'
                 +   (profile.is_active ? '<span class="acct-active-badge"><i data-lucide="check"></i> Activo</span>' : '<button type="button" class="acct-mini" data-profile-activate>Usar</button>')
                 +   '<span class="acct-model-row-actions">'
                 +     '<button type="button" class="acct-icon-btn" data-profile-edit title="Editar"><i data-lucide="pencil"></i></button>'
                 +     '<button type="button" class="acct-icon-btn acct-icon-danger" data-profile-delete title="Eliminar"><i data-lucide="trash-2"></i></button>'
                 +   '</span>'
                 + '</div>';
        }).join('');
        const html = '<div class="acct-sec-head">'
                   +   '<div><div class="acct-sec-title">Perfiles</div><div class="acct-sec-sub">Crea identidades de trabajo y elige cuál estará activa en el visor.</div></div>'
                   +   '<div class="acct-sec-actions"><button type="button" class="acct-mini acct-mini-primary" data-profile-add><i data-lucide="plus"></i> Nuevo perfil</button></div>'
                   + '</div>'
                   + (rows ? '<div class="acct-profile-list">' + rows + '</div>' : '<div class="acct-empty"><i data-lucide="users-round"></i><strong>Aún no tienes perfiles</strong><span>Crea uno para separar tus identidades de trabajo.</span></div>');
        global.jQuery('#acctProfilesPanel').html(html);
        global.jQuery('#acctModelCount').text(_profiles.length + (_profiles.length === 1 ? ' perfil' : ' perfiles'));
        if (global.lucide) global.lucide.createIcons();
    }

    function updateProfileAvatarPreview(imageSource) {
        const form = global.jQuery('#acctProfileForm');
        if (!form.length) return;
        const avatarType = form.find('#profileAvatarType').val() || 'initials';
        if (imageSource) form.attr('data-avatar-preview', imageSource);
        let avatarValue = '';
        if (avatarType === 'emoji') avatarValue = form.find('#profileAvatarEmoji').val() || '🙂';
        if (avatarType === 'icon') avatarValue = form.find('#profileAvatarIcon').val() || 'user-round';
        if (avatarType === 'image') avatarValue = form.attr('data-avatar-preview') || form.attr('data-avatar-value') || '';
        const preview = {
            name: form.find('#profileName').val() || 'Perfil',
            short_name: form.find('#profileShortName').val() || '',
            color: form.find('#profileColor').val() || '#6366F1',
            avatar_type: avatarType,
            avatar_value: avatarValue
        };
        form.find('#profileAvatarPreviewWrap').html(profileAvatar(preview, 'acct-avatar-preview'));
        form.find('[data-avatar-type]').toggleClass('is-active', false).filter('[data-avatar-type="' + avatarType + '"]').addClass('is-active');
        form.find('[data-avatar-panel]').prop('hidden', true).filter('[data-avatar-panel="' + avatarType + '"]').prop('hidden', false);
        if (global.lucide) global.lucide.createIcons();
    }

    function openProfileForm(id) {
        const profile = _profiles.filter(function (item) { return Number(item.id) === Number(id); })[0] || null;
        const avatarType = profile ? profile.avatar_type : 'initials';
        const avatarValue = profile ? profile.avatar_value : '';
        const specialties = [
            ['', 'Seleccionar especialidad'],
            ['frontend', 'Frontend'],
            ['backend', 'Backend'],
            ['design', 'Diseño'],
            ['analysis', 'Análisis'],
            ['qa', 'QA'],
            ['administration', 'Administración']
        ].map(function (option) {
            return '<option value="' + option[0] + '"' + (profile && profile.specialty === option[0] ? ' selected' : '') + '>' + option[1] + '</option>';
        }).join('');
        const icons = [
            ['user-round', 'Usuario'],
            ['code-2', 'Código'],
            ['palette', 'Diseño'],
            ['chart-no-axes-combined', 'Análisis'],
            ['bug', 'QA'],
            ['shield-check', 'Administración'],
            ['briefcase-business', 'Trabajo'],
            ['coffee', 'CoffeeSoft']
        ].map(function (option) {
            return '<option value="' + option[0] + '"' + (avatarValue === option[0] ? ' selected' : '') + '>' + option[1] + '</option>';
        }).join('');
        const avatarButtons = [
            ['image', 'Imagen'],
            ['initials', 'Iniciales'],
            ['emoji', 'Emoji'],
            ['icon', 'Icono']
        ].map(function (option) {
            return '<button type="button" class="acct-avatar-type' + (avatarType === option[0] ? ' is-active' : '') + '" data-avatar-type="' + option[0] + '">' + option[1] + '</button>';
        }).join('');
        const html = '<div class="acct-sec-head"><div><div class="acct-sec-title">' + (profile ? 'Editar perfil' : 'Nuevo perfil') + '</div><div class="acct-sec-sub">Configura la identidad que usarás dentro de CoffeeIA.</div></div></div>'
                   + '<form id="acctProfileForm" class="acct-model-form" data-profile-id="' + (profile ? profile.id : '') + '" data-avatar-value="' + escAttr(avatarValue) + '">'
                   +   '<input type="hidden" id="profileAvatarType" value="' + escAttr(avatarType) + '">'
                   +   '<div class="acct-card"><div class="acct-card-title"><i data-lucide="badge-check"></i> Identidad</div>'
                   +     '<div class="acct-avatar-editor">'
                   +       '<div id="profileAvatarPreviewWrap">' + profileAvatar(profile || { name: 'Perfil', color: '#6366F1' }, 'acct-avatar-preview') + '</div>'
                   +       '<div class="acct-avatar-controls"><div class="acct-avatar-types">' + avatarButtons + '</div>'
                   +         '<div class="acct-avatar-panel" data-avatar-panel="image"' + (avatarType === 'image' ? '' : ' hidden') + '><input type="file" class="acct-avatar-file" id="profileAvatarFile" accept="image/jpeg,image/png,image/webp"><div class="acct-avatar-note">JPG, PNG o WebP · máximo 2 MB.</div></div>'
                   +         '<div class="acct-avatar-panel acct-avatar-note" data-avatar-panel="initials"' + (avatarType === 'initials' ? '' : ' hidden') + '>Se generan automáticamente desde el nombre corto.</div>'
                   +         '<div class="acct-avatar-panel" data-avatar-panel="emoji"' + (avatarType === 'emoji' ? '' : ' hidden') + '><input type="text" class="acct-input" id="profileAvatarEmoji" value="' + escAttr(avatarType === 'emoji' ? avatarValue : '🙂') + '" maxlength="8" placeholder="🙂"></div>'
                   +         '<div class="acct-avatar-panel" data-avatar-panel="icon"' + (avatarType === 'icon' ? '' : ' hidden') + '><select class="acct-input" id="profileAvatarIcon">' + icons + '</select></div>'
                   +       '</div>'
                   +     '</div>'
                   +     '<div class="acct-grid2">'
                   +       fieldRow('Nombre <span class="req">*</span>', '<input type="text" class="acct-input" id="profileName" value="' + escAttr(profile ? profile.name : '') + '" maxlength="80">')
                   +       fieldRow('Nombre corto', '<input type="text" class="acct-input" id="profileShortName" value="' + escAttr(profile ? profile.short_name : '') + '" maxlength="40" placeholder="Alias visible en CoffeeIA">')
                   +     '</div>'
                   +     '<div class="acct-grid2">'
                   +       fieldRow('Rol', '<input type="text" class="acct-input" id="profileRole" value="' + escAttr(profile ? profile.role : '') + '" placeholder="Desarrollador, Analista..." maxlength="80">')
                   +       fieldRow('Especialidad', '<select class="acct-input" id="profileSpecialty">' + specialties + '</select>')
                   +     '</div>'
                   +     fieldRow('Descripción', '<textarea class="acct-input" id="profileDescription" rows="3" maxlength="280">' + escHtml(profile ? profile.description : '') + '</textarea>')
                   +     fieldRow('Color', '<input type="color" class="acct-color-input" id="profileColor" value="' + escAttr(profile ? profile.color : '#6366F1') + '">')
                   +   '</div>'
                   +   '<div class="acct-form-foot"><button type="button" class="acct-btn" data-profile-cancel>Cancelar</button><button type="submit" class="acct-btn acct-btn-primary"><i data-lucide="save"></i> Guardar perfil</button></div>'
                   + '</form>';
        global.jQuery('#acctProfilesPanel').html(html);
        updateProfileAvatarPreview();
    }

    function saveProfile() {
        const form = global.jQuery('#acctProfileForm');
        const avatarType = form.find('#profileAvatarType').val() || 'initials';
        const data = new FormData();
        data.append('action', 'save_profile');
        data.append('id', form.data('profile-id') || '');
        data.append('name', form.find('#profileName').val());
        data.append('short_name', form.find('#profileShortName').val());
        data.append('role', form.find('#profileRole').val());
        data.append('specialty', form.find('#profileSpecialty').val());
        data.append('description', form.find('#profileDescription').val());
        data.append('color', form.find('#profileColor').val());
        data.append('avatar_type', avatarType);
        data.append('avatar_value', avatarType === 'emoji' ? form.find('#profileAvatarEmoji').val() : (avatarType === 'icon' ? form.find('#profileAvatarIcon').val() : ''));

        const fileInput = form.find('#profileAvatarFile')[0];
        if (avatarType === 'image' && fileInput && fileInput.files.length) data.append('avatar_file', fileInput.files[0]);

        global.jQuery.ajax({
            url: '../ctrl/ctrl-auth.php',
            method: 'POST',
            data: data,
            processData: false,
            contentType: false
        }).done(function (res) {
            if (!res || !res.success) { toast((res && res.message) || 'No se pudo guardar el perfil', 'warn'); return; }
            toast(res.message, 'ok');
            loadProfiles();
        }).fail(function (xhr) {
            toast((xhr.responseJSON && xhr.responseJSON.message) || 'No se pudo guardar el perfil', 'warn');
        });
    }

    function activateProfile(id) {
        global.jQuery.post('../ctrl/ctrl-auth.php', { action: 'activate_profile', id: id })
            .done(function (res) {
                if (!res || !res.success) { toast((res && res.message) || 'No se pudo activar el perfil', 'warn'); return; }
                _activeProfile = res.profile;
                notifyIdentity();
                toast(res.message, 'ok');
                loadProfiles();
            });
    }

    function deleteProfile(id) {
        const profile = _profiles.filter(function (item) { return Number(item.id) === Number(id); })[0];
        if (!profile || !global.confirm('¿Eliminar el perfil "' + profile.name + '"? Esta acción no se puede deshacer.')) return;
        global.jQuery.post('../ctrl/ctrl-auth.php', { action: 'delete_profile', id: id })
            .done(function (res) {
                if (!res || !res.success) { toast((res && res.message) || 'No se pudo eliminar el perfil', 'warn'); return; }
                toast(res.message, 'info');
                loadProfiles();
                loadCurrentUser();
            });
    }

    function openSettings(section) {
        buildSettings();
        _modelView = 'list';
        _modelEditId = null;
        global.jQuery('#accountSettings').prop('hidden', false).addClass('is-open');
        renderSettingsSection(section || 'account');
    }
    function closeSettings() {
        global.jQuery('#accountSettings').prop('hidden', true).removeClass('is-open is-editing');
    }

    function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function escAttr(s) { return escHtml(s); }

    /* ---------- Modal "Mejorar plan" (registro manual de cuentas Claude) ----------
     * Anthropic no expone una API de consumo/límites de las suscripciones (Pro/Max)
     * ni de Claude Code. Este panel es un registro 100% manual guardado en este
     * navegador: alias, plan, notas y el inicio de la ventana actual. Con ese inicio
     * estimamos la cuenta regresiva al reinicio (ventana rolling de ~5 h de Claude Code). */
    const ACCOUNTS_KEY = 'coffeeia:claude:accounts';
    const DOW_LABELS   = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const URGENT_MIN   = 15;   // avisar cuando falten ≤ estos minutos para el reinicio
    const PLAN_OPTS = [
        { value: 'free',  label: 'Free' },
        { value: 'pro',   label: 'Pro' },
        { value: 'max5',  label: 'Max 5×' },
        { value: 'max20', label: 'Max 20×' },
        { value: 'team',  label: 'Team' },
        { value: 'api',   label: 'API (consola)' }
    ];
    let _upView   = 'list'; // 'list' | 'form'
    let _upEditId = null;
    let _upTimer  = null;
    let _cpopEditId = null;    // cuenta con el editor de recordatorio abierto en el popover
    let _cpopShowDate = false; // editor con el selector de fecha visible (por defecto la fecha es HOY)

    function planLabel(v) {
        const o = PLAN_OPTS.filter(function (p) { return p.value === v; })[0];
        return o ? o.label : (v || '—');
    }
    function loadAccounts() {
        try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || []; }
        catch (e) { return []; }
    }
    function saveAccounts(list) {
        const raw = JSON.stringify(list || []);
        try { localStorage.setItem(ACCOUNTS_KEY, raw); } catch (e) {}
        persist(ACCOUNTS_KEY, raw);
    }
    // Espeja la preferencia en SQLite (prefs-store.js). Sin él, todo sigue funcionando
    // contra localStorage, igual que antes.
    function persist(key, raw) {
        if (global.CoffeePrefs) global.CoffeePrefs.push(key, raw);
    }
    function uid() { return 'acc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

    // Recordatorios ya disparados hoy (id -> 'YYYY-M-D'), para no repetir la notificación.
    const REMINDER_KEY = 'coffeeia:claude:reminderFired';
    function loadReminderFired() { try { return JSON.parse(localStorage.getItem(REMINDER_KEY)) || {}; } catch (e) { return {}; } }
    function saveReminderFired(m) {
        const raw = JSON.stringify(m || {});
        try { localStorage.setItem(REMINDER_KEY, raw); } catch (e) {}
        persist(REMINDER_KEY, raw);
    }
    // Fija/limpia el recordatorio (datetime) de una cuenta; reactiva el aviso si cambió.
    function setAccountReminder(id, val) {
        const list = loadAccounts();
        const i = list.map(function (a) { return a.id; }).indexOf(id);
        if (i === -1) return;
        list[i].reminderAt = val || '';
        saveAccounts(list);
        const fired = loadReminderFired();
        if (fired[id] !== undefined && fired[id] !== (val || '')) { delete fired[id]; saveReminderFired(fired); }
    }

    // Hora en formato 12 h con a.m./p.m. (p. ej. "3:00 p.m.").
    function fmt12(h, m) {
        const ap = h < 12 ? 'a.m.' : 'p.m.';
        let hh = h % 12; if (hh === 0) hh = 12;
        return hh + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
    }
    // Etiqueta de fecha/hora del reinicio: "Jueves 10 jul · 3:00 p.m.".
    function fmtDate(d) {
        const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        return DOW_LABELS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()]
             + ' · ' + fmt12(d.getHours(), d.getMinutes());
    }

    // Ocurrencia del día de reinicio semanal (0=Dom … 6=Sáb) en la semana ACTUAL.
    // Si el día es hoy, se queda en hoy aunque la hora ya haya pasado (no salta a la próxima semana).
    function nextWeeklyReset(dow, time) {
        const now   = new Date();
        const parts = String(time || '00:00').split(':');
        const reset = new Date(now);
        reset.setHours(Number(parts[0]) || 0, Number(parts[1]) || 0, 0, 0);
        reset.setDate(reset.getDate() + ((dow - now.getDay() + 7) % 7));
        return reset;
    }

    // Formato corto de duración: "45 min", "2 h", "2h 15m".
    function fmtHM(ms) {
        const min = Math.max(1, Math.ceil(ms / 60000));
        const h = Math.floor(min / 60);
        const m = min % 60;
        if (h <= 0) return m + ' min';
        if (m === 0) return h + ' h';
        return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
    }

    // Cuánto falta para el reinicio semanal: días si es a futuro, horas/min si es hoy.
    function resetInfo(acc) {
        if (acc.resetDow === undefined || acc.resetDow === null || acc.resetDow === '') return { state: 'none' };
        const dow = Number(acc.resetDow);
        if (isNaN(dow)) return { state: 'none' };
        const reset = nextWeeklyReset(dow, acc.resetTime);
        const now   = new Date();
        const ms    = reset.getTime() - now.getTime();
        const t0 = new Date(now);   t0.setHours(0, 0, 0, 0);
        const t1 = new Date(reset); t1.setHours(0, 0, 0, 0);
        const days = Math.round((t1 - t0) / 86400e3);
        const last = reset.getTime() - 7 * 86400e3;
        const pct  = Math.max(2, Math.min(100, Math.round(((now.getTime() - last) / (7 * 86400e3)) * 100)));
        let state, primary;
        if (days >= 1) {
            state = 'wait';
            primary = days === 1 ? 'Falta 1 día' : 'Faltan ' + days + ' días';
        } else {
            state = 'today';                       // se reinicia hoy
            primary = ms > 0 ? 'Faltan ' + fmtHM(ms) : 'Se reinició hoy';
        }
        const urgent = (state === 'today' && ms > 0 && ms <= URGENT_MIN * 60000);
        // Semáforo: verde = reinició hoy / lejos; naranja = faltan 2 días; rojo = ≤1 día o por venir hoy.
        let level;
        if (days <= 0 && ms <= 0) level = 'green';   // reinició hoy → verde
        else level = 'orange';                        // por venir hoy, 1 día o más → naranja
        return { state: state, primary: primary, secondary: fmtDate(reset), pct: pct, days: days, ms: ms, urgent: urgent, level: level };
    }

    // Bloque visual: días restantes + fecha + barra de progreso de la semana.
    function resetHtml(info) {
        if (info.state === 'none') {
            return '<div class="up-reset up-reset-none">'
                 +   '<i data-lucide="circle-help" class="w-3.5 h-3.5"></i>'
                 +   '<span>Sin día de reinicio configurado</span>'
                 + '</div>';
        }
        const icon = info.level === 'green' ? 'circle-check'
                   : info.level === 'red' ? 'alarm-clock'
                   : 'calendar-clock';
        return '<div class="up-reset up-reset-' + info.level + '">'
             +   '<div class="up-reset-row">'
             +     '<i data-lucide="' + icon + '" class="w-4 h-4"></i>'
             +     '<div class="up-reset-texts">'
             +       '<span class="up-reset-days">' + escHtml(info.primary) + '</span>'
             +       '<span class="up-reset-date">' + escHtml(info.secondary) + '</span>'
             +     '</div>'
             +   '</div>'
             +   '<div class="up-progress"><span style="width:' + info.pct + '%"></span></div>'
             + '</div>';
    }

    function buildUpgrade() {
        if (global.jQuery('#accountUpgrade').length) return;
        const html = '<div id="accountUpgrade" class="acct-modal" hidden>'
                   +   '<div class="acct-modal-backdrop"></div>'
                   +   '<div class="acct-modal-card" role="dialog" aria-modal="true" aria-label="Mejorar plan">'
                   +     '<div class="acct-modal-head">'
                   +       '<div class="acct-modal-title"><i data-lucide="sparkles" class="w-4 h-4"></i> Mejorar plan</div>'
                   +       '<button type="button" class="acct-modal-x" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>'
                   +     '</div>'
                   +     '<div id="upBody" class="acct-modal-body"></div>'
                   +     '<div class="acct-modal-foot">'
                   +       '<span id="upCount" class="acct-foot-count"></span>'
                   +       '<button type="button" class="acct-btn acct-btn-primary" data-close="1">Listo</button>'
                   +     '</div>'
                   +   '</div>'
                   + '</div>';
        global.jQuery('body').append(html);
        if (global.lucide) global.lucide.createIcons();
    }

    function cardHtml(acc) {
        const info  = resetInfo(acc);
        const notes = acc.notes ? '<div class="up-notes">' + escHtml(acc.notes) + '</div>' : '';
        return '<div class="up-card" data-id="' + escAttr(acc.id) + '">'
             +   '<div class="up-card-main">'
             +     '<div class="up-card-top">'
             +       '<span class="up-alias">' + escHtml(acc.alias) + '</span>'
             +       '<span class="up-plan-badge">' + escHtml(planLabel(acc.plan)) + '</span>'
             +     '</div>'
             +     resetHtml(info)
             +     notes
             +   '</div>'
             +   '<div class="up-card-actions">'
             +     '<button type="button" class="up-icon-btn" data-up-edit title="Editar"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>'
             +     '<button type="button" class="up-icon-btn" data-up-del title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>'
             +   '</div>'
             + '</div>';
    }

    function renderAccountList() {
        const list  = loadAccounts();
        const intro = '<p class="up-note">Claude no expone una API de consumo de las suscripciones. '
                    + 'Este panel es un registro manual (solo en este navegador): anota el día de reinicio '
                    + 'semanal de cada cuenta y verás cuántos días faltan.</p>';
        const head  = '<div class="acct-sec-head">'
                    +   '<div><div class="acct-sec-title">Mis cuentas Claude</div>'
                    +     '<div class="acct-sec-sub">Organiza tus cuentas y ventanas de reinicio.</div></div>'
                    +   '<div class="acct-sec-actions">'
                    +     '<button type="button" class="up-add-btn" data-up-add><i data-lucide="plus" class="w-4 h-4"></i><span>Añadir cuenta</span></button>'
                    +   '</div></div>';
        let body;
        if (!list.length) {
            body = '<div class="up-empty"><i data-lucide="users-round" class="w-6 h-6"></i>'
                 + '<span>Aún no registras cuentas.</span></div>';
        } else {
            body = '<div id="upList" class="up-list">' + list.map(cardHtml).join('') + '</div>';
        }
        global.jQuery('#upBody').html(intro + head + body);
        global.jQuery('#upCount').text(list.length + (list.length === 1 ? ' cuenta' : ' cuentas'));
        if (global.lucide) global.lucide.createIcons();
    }

    function renderAccountForm() {
        const list = loadAccounts();
        const acc  = _upEditId ? (list.filter(function (a) { return a.id === _upEditId; })[0] || {}) : {};
        const opts = PLAN_OPTS.map(function (p) {
            const sel = (acc.plan || 'pro') === p.value ? ' selected' : '';
            return '<option value="' + p.value + '"' + sel + '>' + escHtml(p.label) + '</option>';
        }).join('');
        const noDow  = (acc.resetDow === undefined || acc.resetDow === null || acc.resetDow === '');
        const dowOpts = '<option value="" disabled' + (noDow ? ' selected' : '') + '>Elige un día…</option>'
            + DOW_LABELS.map(function (lbl, i) {
                const sel = String(acc.resetDow) === String(i) ? ' selected' : '';
                return '<option value="' + i + '"' + sel + '>' + escHtml(lbl) + '</option>';
            }).join('');
        const html = '<form id="upForm" class="up-form">'
            +   '<label class="up-field"><span class="up-label">Alias</span>'
            +     '<input id="upAlias" class="up-input" type="text" maxlength="40" placeholder="Ej. Cuenta Huubie" value="' + escAttr(acc.alias || '') + '"></label>'
            +   '<label class="up-field"><span class="up-label">Plan</span>'
            +     '<select id="upPlan" class="up-input up-select">' + opts + '</select></label>'
            +   '<label class="up-field"><span class="up-label">Día de reinicio semanal</span>'
            +     '<select id="upResetDow" class="up-input up-select">' + dowOpts + '</select></label>'
            +   '<div class="up-field"><span class="up-label">Hora del reinicio</span>'
            +     '<input id="upResetTime" class="up-input" type="time" value="' + escAttr(acc.resetTime || '00:00') + '">'
            +     '<span class="up-hint">Formato 24 h: 3 de la tarde es 15:00 (no 03:00). Revísalo en la app de Claude.</span>'
            +   '</div>'
            +   '<div class="up-field"><span class="up-label">Recordatorio (fecha y hora, opcional)</span>'
            +     '<input id="upReminder" class="up-input" type="datetime-local" value="' + escAttr(acc.reminderAt || '') + '">'
            +     '<span class="up-hint">En ese momento aparece una notificación fija avisándote del reinicio.</span>'
            +   '</div>'
            +   '<label class="up-field"><span class="up-label">Notas</span>'
            +     '<textarea id="upNotes" class="up-input up-textarea" rows="2" maxlength="160" placeholder="Proyecto asociado, tope semanal, etc.">' + escHtml(acc.notes || '') + '</textarea></label>'
            +   '<div class="up-form-actions">'
            +     '<button type="button" class="acct-btn" data-up-cancel>Cancelar</button>'
            +     '<button type="submit" class="acct-btn acct-btn-primary">Guardar</button>'
            +   '</div>'
            + '</form>';
        global.jQuery('#upBody').html(html);
        global.jQuery('#upCount').text(_upEditId ? 'Editando cuenta' : 'Nueva cuenta');
        if (global.lucide) global.lucide.createIcons();
        global.jQuery('#upAlias').focus();
    }

    function renderUpgrade() {
        if (_upView === 'form') renderAccountForm();
        else renderAccountList();
    }

    // Refresca solo la cuenta regresiva de cada tarjeta (ticker cada 30 s).
    function refreshResets() {
        const list = loadAccounts();
        global.jQuery('#upList .up-card').each(function () {
            const $c  = global.jQuery(this);
            const acc = list.filter(function (a) { return a.id === $c.data('id'); })[0];
            if (!acc) return;
            $c.find('.up-reset').replaceWith(resetHtml(resetInfo(acc)));
        });
        if (global.lucide) global.lucide.createIcons();
    }
    function startUpTicker() {
        stopUpTicker();
        _upTimer = global.setInterval(function () {
            if (_upView === 'list' && global.jQuery('#accountUpgrade').hasClass('is-open')) refreshResets();
        }, 30000);
    }
    function stopUpTicker() { if (_upTimer) { global.clearInterval(_upTimer); _upTimer = null; } }

    function openAccountForm(id) { _upView = 'form'; _upEditId = id || null; renderUpgrade(); }
    function saveAccountForm() {
        const $ = global.jQuery;
        const alias = ($('#upAlias').val() || '').trim();
        if (!alias) { toast('Ponle un alias a la cuenta', 'warn'); $('#upAlias').focus(); return; }
        const rec = {
            alias: alias,
            plan: $('#upPlan').val() || 'pro',
            resetDow: $('#upResetDow').val() || '',
            resetTime: $('#upResetTime').val() || '00:00',
            reminderAt: $('#upReminder').val() || '',
            notes: ($('#upNotes').val() || '').trim()
        };
        const list = loadAccounts();
        if (_upEditId) {
            const i = list.map(function (a) { return a.id; }).indexOf(_upEditId);
            if (i !== -1) { rec.id = _upEditId; list[i] = rec; } else { rec.id = uid(); list.push(rec); }
        } else { rec.id = uid(); list.push(rec); }
        saveAccounts(list);
        _upView = 'list'; _upEditId = null;
        renderUpgrade();
        refreshClockBadge();
        toast('Cuenta guardada', 'ok');
    }
    function deleteAccount(id) {
        if (!global.confirm('¿Eliminar esta cuenta del registro?')) return;
        saveAccounts(loadAccounts().filter(function (a) { return a.id !== id; }));
        renderUpgrade();
        refreshClockBadge();
        toast('Cuenta eliminada', 'info');
    }

    function openUpgrade() {
        buildUpgrade();
        _upView = 'list'; _upEditId = null;
        renderUpgrade();
        global.jQuery('#accountUpgrade').prop('hidden', false).addClass('is-open');
        startUpTicker();
    }
    function closeUpgrade() {
        stopUpTicker();
        global.jQuery('#accountUpgrade').prop('hidden', true).removeClass('is-open');
    }

    /* ---------- Relojito de créditos en el rail ----------
     * Botón en el rail con un popover de vistazo rápido: qué cuentas se reinician
     * antes (ordenadas por proximidad) y un badge con las que vencen hoy/mañana. */
    function injectClock($) {
        if ($('#creditClock').length) return;
        const $account = $('#accountBtn');
        if (!$account.length) return;
        // Pie del rail: relojito + botón de cuenta, anclados abajo (el reloj justo encima del avatar).
        const $foot = $('<div class="rail-foot"></div>');
        $account.before($foot);
        $foot.append(
            '<button id="creditClock" class="app-rail-item rail-clock" type="button" title="Reinicios de créditos">'
          +   '<span class="rail-clock-ico"><i data-lucide="alarm-clock"></i>'
          +     '<span id="creditClockBadge" class="rail-clock-badge" hidden>0</span></span>'
          +   '<span class="app-rail-label">Créditos</span>'
          + '</button>'
        );
        $foot.append($account);
        if (global.lucide) global.lucide.createIcons();
    }

    // Cuentas ordenadas por reinicio más próximo (las 'none' al final).
    function accountsSorted() {
        return loadAccounts().map(function (a) { return { acc: a, info: resetInfo(a) }; })
            .sort(function (x, y) {
                const mx = (x.info.ms == null) ? Infinity : x.info.ms;
                const my = (y.info.ms == null) ? Infinity : y.info.ms;
                return mx - my;
            });
    }
    function refreshClockBadge() {
        const $clock = global.jQuery('#creditClock');
        const $b = global.jQuery('#creditClockBadge');
        if (!$clock.length || !$b.length) return;
        const infos = loadAccounts().map(resetInfo).filter(function (i) { return i.state !== 'none'; });
        const soon  = infos.filter(function (i) { return i.days <= 1; });   // hoy o ≤1 día
        // El reloj vive SIEMPRE en el rail; el badge solo cuenta lo que vence en ≤ 1 día.
        // El rail queda neutro (como los demás íconos); solo se pone ROJO + pulso cuando falta ≤15 min.
        const imminent = soon.some(function (i) { return i.urgent; });
        $clock.removeClass('is-off lvl-green lvl-red');
        $b.removeClass('lvl-green lvl-red is-urgent');
        if (imminent) { $clock.addClass('lvl-red'); $b.addClass('lvl-red is-urgent'); }
        if (soon.length === 0) { $b.prop('hidden', true); return; }
        $b.text(soon.length).prop('hidden', false);
    }

    function buildClockPop() {
        if (global.jQuery('#creditPop').length) return;
        const html = '<div id="creditPop" class="credit-pop" role="menu" hidden>'
                   +   '<div class="credit-pop-head"><i data-lucide="alarm-clock" class="w-4 h-4"></i><span>Reinicios de créditos</span></div>'
                   +   '<div id="creditPopList" class="credit-pop-list"></div>'
                   +   '<button type="button" class="credit-pop-all" data-up-openall><i data-lucide="settings-2" class="w-3.5 h-3.5"></i><span>Ver todo</span></button>'
                   + '</div>';
        global.jQuery('body').append(html);
        if (global.lucide) global.lucide.createIcons();
    }
    function two(n) { return (n < 10 ? '0' : '') + n; }
    function fmtDateLocal(d) { return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()); }
    function fmtTimeLocal(d) { return two(d.getHours()) + ':' + two(d.getMinutes()); }

    function renderClockPop() {
        const rows = accountsSorted();
        let body;
        if (!rows.length) {
            body = '<div class="credit-pop-empty">Sin cuentas registradas.</div>';
        } else {
            body = rows.map(function (r) {
                const info = r.info;
                const when = info.state === 'none' ? 'Sin día' : info.primary;
                const hasRem = !!r.acc.reminderAt;
                const bell = hasRem ? '<i data-lucide="bell" class="cpop-bell"></i>' : '';
                let h = '<div class="cpop-item" data-id="' + escAttr(r.acc.id) + '">'
                    + '<button type="button" class="cpop-row cpop-' + (info.level || 'none') + '" data-rem-toggle title="Agregar recordatorio">'
                    +   '<span class="cpop-dot"></span>'
                    +   '<span class="cpop-alias">' + escHtml(r.acc.alias) + '</span>'
                    +   bell
                    +   '<span class="cpop-when">' + escHtml(when) + '</span>'
                    + '</button>';
                if (_cpopEditId === r.acc.id) {
                    // El recordatorio se fija solo con los chips rápidos (en N horas);
                    // la hora/fecha se calculan solas y viajan en campos ocultos.
                    const rem      = r.acc.reminderAt || '';
                    const remTime  = rem.slice(11, 16) || fmtTimeLocal(new Date());
                    const today    = fmtDateLocal(new Date());
                    const remDate  = rem.slice(0, 10) || today;
                    h += '<div class="cpop-edit">'
                       +   '<div class="cpop-quick">'
                       +     '<button type="button" class="cpop-chip" data-quick-h="1">1 h</button>'
                       +     '<button type="button" class="cpop-chip" data-quick-h="2">2 h</button>'
                       +     '<button type="button" class="cpop-chip" data-quick-h="3">3 h</button>'
                       +     '<button type="button" class="cpop-chip" data-quick-h="4">4 h</button>'
                       +     '<button type="button" class="cpop-chip" data-quick-h="5">5 h</button>'
                       +   '</div>'
                       +   '<input type="hidden" class="cpop-rem-time" value="' + escAttr(remTime) + '">'
                       +   '<input type="hidden" class="cpop-rem-date" value="' + escAttr(remDate) + '">'
                       +   '<div class="cpop-edit-actions">'
                       +     (hasRem ? '<button type="button" class="cpop-mini cpop-rem-clear">Quitar</button>' : '')
                       +     '<button type="button" class="cpop-mini cpop-rem-save">Guardar</button>'
                       +   '</div>'
                       + '</div>';
                }
                return h + '</div>';
            }).join('');
        }
        global.jQuery('#creditPopList').html(body);
        if (global.lucide) global.lucide.createIcons();
    }
    function positionClockPop() {
        const $btn = global.jQuery('#creditClock');
        const $pop = global.jQuery('#creditPop');
        if (!$btn.length || !$pop.length) return;
        const r = $btn[0].getBoundingClientRect();
        // A la derecha del relojito, alineado al fondo (crece hacia arriba), como el menú de cuenta.
        $pop.css({ left: (r.right + 8) + 'px', width: '320px', top: 'auto',
                   bottom: Math.max(8, global.innerHeight - r.bottom) + 'px' });
    }
    function clockPopOpen() { return global.jQuery('#creditPop').hasClass('is-open'); }
    function openClockPop() {
        buildClockPop();
        renderClockPop();
        global.jQuery('#creditPop').prop('hidden', false).addClass('is-open');
        global.jQuery('#creditClock').addClass('is-open');
        positionClockPop();
    }
    function closeClockPop() {
        _cpopEditId = null;
        global.jQuery('#creditPop').prop('hidden', true).removeClass('is-open');
        global.jQuery('#creditClock').removeClass('is-open');
    }

    /* ---------- Recordatorio con notificación flotante fija ---------- */
    function buildNotes() {
        if (global.jQuery('#creditNotes').length) return;
        global.jQuery('body').append('<div id="creditNotes"></div>');
    }
    function showNotice(title, msg) {
        buildNotes();
        global.jQuery('#creditNotes').append(
            '<div class="credit-note" role="alert">'
          +   '<span class="credit-note-ico"><i data-lucide="party-popper" class="w-5 h-5"></i></span>'
          +   '<div class="credit-note-body">'
          +     '<div class="credit-note-title">' + escHtml(title) + '</div>'
          +     '<div class="credit-note-msg">' + escHtml(msg) + '</div>'
          +   '</div>'
          +   '<button type="button" class="credit-note-x" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>'
          + '</div>'
        );
        if (global.lucide) global.lucide.createIcons();
    }
    // Constructor genérico de nota flotante (con X para cerrar), identificada por cuenta.
    // `cls` distingue el tipo (timer / reinicio); `key` marca la ocurrencia; `ttl` (ms) la auto-cierra.
    function pinNote(cls, accId, key, icon, title, msg, ttl) {
        buildNotes();
        const inner =
              '<span class="credit-note-ico"><i data-lucide="' + icon + '" class="w-5 h-5"></i></span>'
            + '<div class="credit-note-body">'
            +   '<div class="credit-note-title">' + escHtml(title) + '</div>'
            +   '<div class="credit-note-msg">' + escHtml(msg) + '</div>'
            + '</div>'
            + '<button type="button" class="credit-note-x" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>';
        const $notes = global.jQuery('#creditNotes');
        const $ex    = $notes.find('.' + cls + '[data-note-acc="' + accId + '"]');
        const keyAt  = (key == null) ? '' : ' data-note-key="' + escAttr(key) + '"';
        if ($ex.length) { $ex.html(inner); if (key != null) $ex.attr('data-note-key', key); }
        else { $notes.append('<div class="credit-note ' + cls + '" data-note-acc="' + escAttr(accId) + '"' + keyAt + ' role="status">' + inner + '</div>'); }
        if (global.lucide) global.lucide.createIcons();
        if (ttl) {   // aviso temporal: desaparece solo tras `ttl` ms
            const sel = '.' + cls + '[data-note-acc="' + accId + '"]';
            global.setTimeout(function () { global.jQuery('#creditNotes').find(sel).remove(); }, ttl);
        }
    }
    // (A) Timer de horas: cuenta regresiva al recordatorio que puso el usuario (los chips 1h–5h).
    function showTimerPin(acc) {
        if (!acc.reminderAt) return;
        const ms = new Date(acc.reminderAt).getTime() - Date.now();
        if (isNaN(ms)) return;
        const msg = ms > 0 ? 'Falta ' + fmtHM(ms) + ' para tu recordatorio' : 'Se cumplió tu recordatorio';
        pinNote('credit-note-timer', acc.id, null, 'timer', acc.alias, msg);
    }
    // Reconstruye las notas de timer de los recordatorios aún vigentes: quedan fijas
    // aunque se recargue la página (el reminderAt persiste en las cuentas).
    function restoreTimerPins() {
        loadAccounts().forEach(function (a) {
            if (!a.reminderAt) return;
            const ms = new Date(a.reminderAt).getTime() - Date.now();
            if (isNaN(ms) || ms <= 0) return;   // solo recordatorios que aún no vencen
            showTimerPin(a);
        });
    }
    // (B) Reinicio de créditos. El día del reinicio queda FIJO; el día antes ("Mañana…")
    // es un aviso que desaparece solo (autoHide = true) y dice a qué hora se reinician.
    function showResetPin(acc, key, autoHide) {
        const info  = resetInfo(acc);
        const reset = nextWeeklyReset(Number(acc.resetDow), acc.resetTime);
        const hora  = fmt12(reset.getHours(), reset.getMinutes());
        const msg   = info.days <= 0 ? 'Se reinician hoy a las ' + hora
                                     : 'Se reinician mañana a las ' + hora;
        pinNote('credit-note-reset', acc.id, key, 'alarm-clock', acc.alias, msg, autoHide ? 15000 : 0);
    }
    // El día del reinicio, al llegar la hora del recordatorio, muestra la notificación fija (una vez).
    function checkReminders() {
        const now = Date.now();
        const fired = loadReminderFired();
        let changed = false;
        loadAccounts().forEach(function (a) {
            if (!a.reminderAt) return;
            const t = new Date(a.reminderAt).getTime();
            if (isNaN(t)) return;
            if (now >= t && fired[a.id] !== a.reminderAt) {   // clave = el datetime, para no repetir
                fired[a.id] = a.reminderAt; changed = true;
                showNotice('Recordatorio de créditos', 'Los créditos de ' + a.alias + ' se reinician (' + fmtDate(new Date(a.reminderAt)) + ').');
            }
        });
        if (changed) saveReminderFired(fired);
    }

    let _clockTimer = null;
    let _alerted = {};             // ids ya avisados en su ventana inminente actual (evita repetir el toast)
    let _resetPinDismissed = {};   // ocurrencia de reinicio (día del) que el usuario cerró con la X (id -> key)
    let _resetTomorrowShown = {};  // ocurrencia cuyo aviso "Mañana…" ya se mostró (id -> key), para no repetir
    function clockTick() {
        refreshClockBadge();
        checkReminders();
        const accs = loadAccounts();
        // (A) Refrescar el timer de horas de las notas que sigan visibles (no las recrea si se cerraron).
        global.jQuery('#creditNotes .credit-note-timer').each(function () {
            const $n  = global.jQuery(this);
            const acc = accs.filter(function (a) { return String(a.id) === String($n.attr('data-note-acc')); })[0];
            if (acc && acc.reminderAt) showTimerPin(acc); else $n.remove();
        });
        accs.forEach(function (a) {
            const info = resetInfo(a);
            // (B) Aviso del reinicio de créditos.
            if (info.state !== 'none') {
                if (info.days <= 0) {
                    // Día del reinicio: pop-up FIJO (se cierra con la X).
                    if (_resetPinDismissed[a.id] !== info.secondary) showResetPin(a, info.secondary, false);
                } else if (info.days === 1) {
                    // Un día antes: aviso "Mañana…" que desaparece solo, una sola vez por ocurrencia.
                    if (_resetTomorrowShown[a.id] !== info.secondary) {
                        _resetTomorrowShown[a.id] = info.secondary;
                        showResetPin(a, info.secondary, true);
                    }
                }
            }
            if (info.urgent) {
                if (!_alerted[a.id]) {
                    _alerted[a.id] = true;
                    toast('⏰ ' + a.alias + ' se reinicia en ' + fmtHM(info.ms), 'warn');
                }
            } else if (_alerted[a.id]) {
                delete _alerted[a.id];
            }
        });
        if (clockPopOpen() && _cpopEditId === null) { renderClockPop(); positionClockPop(); }
    }
    function startClockTick() {
        if (_clockTimer) return;
        _clockTimer = global.setInterval(clockTick, 30000);
    }

    /* ---------- Wiring ---------- */
    function init($) {
        // La barra de cuenta solo existe en el sidebar del Visor: salir en silencio si no está.
        if (!$('#accountBtn').length) return;

        refreshAccountBar();
        loadCurrentUser();
        injectClock($);
        refreshClockBadge();
        checkReminders();
        restoreTimerPins();
        startClockTick();
        if (global.lucide) global.lucide.createIcons();
        // Los <select> de modelo los engancha model-config.js (bindAll sobre .ia-model-pill).

        // Las cuentas guardadas en SQLite llegaron (prefs-store.js) y pisaron a las locales:
        // repintar el reloj y lo que esté abierto en pantalla.
        global.addEventListener('coffeeia:prefs-synced', function (e) {
            const keys = (e.detail && e.detail.keys) || [];
            if (keys.indexOf(ACCOUNTS_KEY) === -1) return;
            refreshClockBadge();
            checkReminders();
            restoreTimerPins();
            if (clockPopOpen()) { renderClockPop(); positionClockPop(); }
            if ($('#accountUpgrade').hasClass('is-open') && _upView === 'list') renderUpgrade();
        });

        $('#accountBtn').on('click', function (e) {
            e.stopPropagation();
            menuOpen() ? closeMenu() : openMenu();
        });
        // Relojito de créditos: toggle del popover; fila o "Ver todo" abren el modal completo.
        $('#creditClock').on('click', function (e) {
            e.stopPropagation();
            clockPopOpen() ? closeClockPop() : openClockPop();
        });
        $(document).on('click', '#creditPop', function (e) { e.stopPropagation(); });
        // Clic en una cuenta: despliega el editor inline de recordatorio (fecha+hora).
        $(document).on('click', '#creditPop [data-rem-toggle]', function (e) {
            e.stopPropagation();
            const id = $(this).closest('.cpop-item').data('id');
            _cpopEditId = (_cpopEditId === id) ? null : id;
            _cpopShowDate = false;
            renderClockPop(); positionClockPop();
        });
        // Chips rápidos: fijan la hora/fecha a ahora+N y marcan el chip elegido.
        $(document).on('click', '#creditPop .cpop-chip', function (e) {
            e.stopPropagation();
            const hrs = parseInt($(this).data('quick-h'), 10) || 0;
            const d = new Date(Date.now() + hrs * 3600000);
            const $item = $(this).closest('.cpop-item');
            $item.find('.cpop-rem-time').val(fmtTimeLocal(d));
            $item.find('.cpop-rem-date').val(fmtDateLocal(d));
            $item.find('.cpop-chip').removeClass('is-active');
            $(this).addClass('is-active');
        });
        $(document).on('click', '#creditPop .cpop-date-toggle', function (e) {
            e.stopPropagation();
            const $date = $(this).closest('.cpop-edit').find('.cpop-rem-date');
            _cpopShowDate = $date.prop('hidden');
            $date.prop('hidden', !_cpopShowDate);
            positionClockPop();
        });
        $(document).on('click', '#creditPop .cpop-rem-save', function (e) {
            e.stopPropagation();
            const $item = $(this).closest('.cpop-item');
            const time = $item.find('.cpop-rem-time').val() || '';
            if (!time) { toast('Elige una hora', 'warn'); return; }
            // Sin fecha elegida se asume HOY (el selector de fecha es opcional).
            const date = $item.find('.cpop-rem-date').val() || fmtDateLocal(new Date());
            const id   = $item.data('id');
            setAccountReminder(id, date + 'T' + time);
            _cpopEditId = null;
            renderClockPop(); positionClockPop(); refreshClockBadge();
            // Nota flotante fija con la cuenta regresiva del timer de horas (se cierra con la X).
            const acc = loadAccounts().filter(function (a) { return String(a.id) === String(id); })[0];
            if (acc) showTimerPin(acc);
            toast('Recordatorio guardado', 'ok');
        });
        $(document).on('click', '#creditPop .cpop-rem-clear', function (e) {
            e.stopPropagation();
            const $item = $(this).closest('.cpop-item');
            const id = $item.data('id');
            setAccountReminder(id, '');
            $('#creditNotes .credit-note-timer[data-note-acc="' + id + '"]').remove();
            _cpopEditId = null;
            renderClockPop(); positionClockPop();
            toast('Recordatorio quitado', 'info');
        });
        $(document).on('click', '#creditPop [data-up-openall]', function (e) {
            e.stopPropagation();
            closeClockPop();
            openUpgrade();
        });
        // Cerrar una notificación flotante. Si es el pop-up de reinicio, recordar que se cerró
        // para no volver a mostrarlo hasta la siguiente ocurrencia del reinicio.
        $(document).on('click', '.credit-note-x', function () {
            const $n = $(this).closest('.credit-note');
            if ($n.hasClass('credit-note-reset')) {
                _resetPinDismissed[$n.attr('data-note-acc')] = $n.attr('data-note-key') || '1';
            }
            $n.remove();
        });
        $(document).on('click', '.account-menu-item', function (e) {
            e.stopPropagation();
            onMenuAct($(this).data('act'));
        });
        // Cerrar menú/popover al hacer clic fuera o con Escape.
        $(document).on('click', function () { if (menuOpen()) closeMenu(); if (clockPopOpen()) closeClockPop(); });
        $(document).on('keydown', function (e) {
            if (e.key === 'Escape') { closeMenu(); closeSettings(); closeUpgrade(); closeClockPop(); }
        });
        global.addEventListener('resize', function () {
            if (menuOpen()) positionMenu();
            if (clockPopOpen()) positionClockPop();
        });

        // Modal de configuración (delegado, el nodo se crea al abrir).
        $(document).on('click', '#accountSettings .acct-modal-x, #accountSettings [data-close], #accountSettings .acct-modal-backdrop', function () { closeSettings(); });
        $(document).on('click', '#accountSettings .acct-modal-card', function (e) { e.stopPropagation(); });
        $(document).on('click', '#accountSettings [data-settings-section]', function () { renderSettingsSection($(this).data('settings-section')); });
        $(document).on('submit', '#acctUserForm', function (e) { e.preventDefault(); saveUser(); });
        $(document).on('click', '#accountSettings [data-profile-add]', function () { openProfileForm(null); });
        $(document).on('click', '#accountSettings [data-profile-edit]', function () { openProfileForm($(this).closest('.acct-profile-card').data('profile-id')); });
        $(document).on('click', '#accountSettings [data-profile-cancel]', function () { renderProfiles(); });
        $(document).on('submit', '#acctProfileForm', function (e) { e.preventDefault(); saveProfile(); });
        $(document).on('click', '#acctProfileForm [data-avatar-type]', function () {
            global.jQuery('#profileAvatarType').val(global.jQuery(this).data('avatar-type'));
            updateProfileAvatarPreview();
        });
        $(document).on('input change', '#profileName, #profileShortName, #profileAvatarEmoji, #profileAvatarIcon, #profileColor', function () {
            updateProfileAvatarPreview();
        });
        $(document).on('change', '#profileAvatarFile', function () {
            const file = this.files && this.files[0];
            if (!file) { updateProfileAvatarPreview(); return; }
            if (file.size > 2097152) {
                this.value = '';
                toast('La imagen no debe superar 2 MB', 'warn');
                return;
            }
            if (['image/jpeg', 'image/png', 'image/webp'].indexOf(file.type) === -1) {
                this.value = '';
                toast('Usa una imagen JPG, PNG o WebP', 'warn');
                return;
            }
            const reader = new FileReader();
            reader.onload = function (event) { updateProfileAvatarPreview(event.target.result); };
            reader.readAsDataURL(file);
        });
        $(document).on('click', '#accountSettings [data-profile-activate]', function () { activateProfile($(this).closest('.acct-profile-card').data('profile-id')); });
        $(document).on('click', '#accountSettings [data-profile-delete]', function () { deleteProfile($(this).closest('.acct-profile-card').data('profile-id')); });
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

        // ── Editor de modelos (CRUD) ──
        $(document).on('click', '#accountSettings [data-model-add]', function () { openModelForm(null); });
        $(document).on('click', '#accountSettings [data-model-edit]', function (e) { e.stopPropagation(); openModelForm($(this).closest('.acct-model-item').data('id')); });
        $(document).on('click', '#accountSettings [data-model-del]', function (e) { e.stopPropagation(); deleteModelFromList($(this).closest('.acct-model-item').data('id')); });
        $(document).on('click', '#accountSettings [data-model-del-form]', function () { deleteModelFromList(_modelEditId); });
        $(document).on('click', '#accountSettings [data-model-cancel]', function () { backToModelList(); });
        $(document).on('submit', '#acctModelForm', function (e) { e.preventDefault(); saveModelForm(); });
        // Fila: clic en el nombre marca/desmarca el habilitado (recupera la comodidad del label).
        $(document).on('click', '#acctModelList .acct-model-main', function () {
            const $cb = $(this).closest('.acct-model-item').find('.acct-model-cb');
            $cb.prop('checked', !$cb.prop('checked')).trigger('change');
        });
        // Etiquetas (chips): Enter agrega, clic en la x quita.
        $(document).on('keydown', '#mfTagInput', function (e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const v = ($(this).val() || '').trim().toLowerCase();
            if (v && _mfTags.indexOf(v) === -1) { _mfTags.push(v); $('#mfTagChips').html(renderTagChips()); if (global.lucide) global.lucide.createIcons(); }
            $(this).val('');
        });
        $(document).on('click', '#mfTagChips [data-tag-del]', function () {
            const i = parseInt($(this).attr('data-tag-del'), 10);
            if (i >= 0) { _mfTags.splice(i, 1); $('#mfTagChips').html(renderTagChips()); if (global.lucide) global.lucide.createIcons(); }
        });
        // Niveles de esfuerzo (chips toggle): sincroniza el select "Nivel por defecto".
        $(document).on('click', '#accountSettings [data-effort]', function () {
            const lv = $(this).attr('data-effort');
            const i = _mfEffort.indexOf(lv);
            if (i === -1) _mfEffort.push(lv); else _mfEffort.splice(i, 1);
            _mfEffort = EFFORT_ALL.filter(function (x) { return _mfEffort.indexOf(x) !== -1; });
            $('#mfEffortChips').html(renderEffortChips());
            const $def = $('#mfEffortDefault');
            const cur = $def.val();
            $def.html(effortDefaultOptions(_mfEffort.indexOf(cur) !== -1 ? cur : ''));
        });

        // Modal "Mejorar plan" (registro manual de cuentas Claude; nodo creado al abrir).
        $(document).on('click', '#accountUpgrade .acct-modal-x, #accountUpgrade [data-close], #accountUpgrade .acct-modal-backdrop', function () { closeUpgrade(); });
        $(document).on('click', '#accountUpgrade .acct-modal-card', function (e) { e.stopPropagation(); });
        $(document).on('click', '#accountUpgrade [data-up-add]', function () { openAccountForm(null); });
        $(document).on('click', '#accountUpgrade [data-up-edit]', function () { openAccountForm($(this).closest('.up-card').data('id')); });
        $(document).on('click', '#accountUpgrade [data-up-del]', function () { deleteAccount($(this).closest('.up-card').data('id')); });
        $(document).on('click', '#accountUpgrade [data-up-cancel]', function () { _upView = 'list'; renderUpgrade(); });
        $(document).on('submit', '#upForm', function (e) { e.preventDefault(); saveAccountForm(); });
    }

    if (global.jQuery) {
        global.jQuery(function () { init(global.jQuery); });
    } else {
        document.addEventListener('DOMContentLoaded', function () { init(global.jQuery); });
    }

    global.CoffeeAccount = { openSettings: openSettings, refresh: refreshAccountBar };
})(window);
