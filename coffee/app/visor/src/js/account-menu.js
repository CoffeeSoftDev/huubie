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

    function profileName() {
        if (_currentUser && _currentUser.name) return _currentUser.name;
        try { return localStorage.getItem(PROFILE_KEY) || DEFAULT_NAME; }
        catch (e) { return DEFAULT_NAME; }
    }
    function loadCurrentUser() {
        global.jQuery.get('../ctrl/ctrl-auth.php', { action: 'me' })
            .done(function (res) {
                if (res && res.success && res.user) {
                    _currentUser = res.user;
                    refreshAccountBar();
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

    function editProfile() {
        toast('Sección "Perfil" próximamente', 'info');
    }

    function doLogout() {
        if (!global.confirm('¿Cerrar sesión?')) return;
        global.jQuery.post('../ctrl/ctrl-auth.php', { action: 'logout' })
            .always(function () { global.location.href = '../index.php'; });
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
        try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list || [])); } catch (e) {}
    }
    function uid() { return 'acc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

    // Recordatorios ya disparados hoy (id -> 'YYYY-M-D'), para no repetir la notificación.
    const REMINDER_KEY = 'coffeeia:claude:reminderFired';
    function loadReminderFired() { try { return JSON.parse(localStorage.getItem(REMINDER_KEY)) || {}; } catch (e) { return {}; } }
    function saveReminderFired(m) { try { localStorage.setItem(REMINDER_KEY, JSON.stringify(m || {})); } catch (e) {} }
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
                    // Hora protagonista (rápida) con la fecha implícita HOY; la fecha solo se
                    // despliega con el botón de calendario o si el recordatorio ya es de otro día.
                    const rem      = r.acc.reminderAt || '';
                    const remTime  = rem.slice(11, 16) || fmtTimeLocal(new Date());
                    const today    = fmtDateLocal(new Date());
                    const remDate  = rem.slice(0, 10) || today;
                    const showDate = _cpopShowDate || remDate !== today;
                    h += '<div class="cpop-edit">'
                       +   '<div class="cpop-quick">'
                       +     '<button type="button" class="cpop-chip" data-quick-h="1">En 1 h</button>'
                       +     '<button type="button" class="cpop-chip" data-quick-h="3">En 3 h</button>'
                       +     '<button type="button" class="cpop-chip" data-quick-h="5">En 5 h</button>'
                       +   '</div>'
                       +   '<div class="cpop-when-row">'
                       +     '<input type="time" class="cpop-rem-input cpop-rem-time" value="' + escAttr(remTime) + '">'
                       +     '<button type="button" class="cpop-mini cpop-date-toggle" title="Elegir otra fecha (por defecto hoy)"><i data-lucide="calendar" class="w-3.5 h-3.5"></i></button>'
                       +   '</div>'
                       +   '<input type="date" class="cpop-rem-input cpop-rem-date" value="' + escAttr(remDate) + '"' + (showDate ? '' : ' hidden') + '>'
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
        $pop.css({ left: (r.right + 8) + 'px', width: '238px', top: 'auto',
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
    let _alerted = {};   // ids ya avisados en su ventana inminente actual (evita repetir el toast)
    function clockTick() {
        refreshClockBadge();
        checkReminders();
        loadAccounts().forEach(function (a) {
            const info = resetInfo(a);
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
        startClockTick();
        if (global.lucide) global.lucide.createIcons();
        // Los <select> de modelo los engancha model-config.js (bindAll sobre .ia-model-pill).

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
        // Chips rápidos: fijan la hora a ahora+N; si el resultado cae mañana, muestran la fecha.
        $(document).on('click', '#creditPop .cpop-chip', function (e) {
            e.stopPropagation();
            const hrs = parseInt($(this).data('quick-h'), 10) || 0;
            const d = new Date(Date.now() + hrs * 3600000);
            const $item = $(this).closest('.cpop-item');
            $item.find('.cpop-rem-time').val(fmtTimeLocal(d));
            const dv = fmtDateLocal(d);
            const $date = $item.find('.cpop-rem-date').val(dv);
            if (dv !== fmtDateLocal(new Date())) { _cpopShowDate = true; $date.prop('hidden', false); }
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
            setAccountReminder($item.data('id'), date + 'T' + time);
            _cpopEditId = null;
            renderClockPop(); positionClockPop(); refreshClockBadge();
            toast('Recordatorio guardado', 'ok');
        });
        $(document).on('click', '#creditPop .cpop-rem-clear', function (e) {
            e.stopPropagation();
            const $item = $(this).closest('.cpop-item');
            setAccountReminder($item.data('id'), '');
            _cpopEditId = null;
            renderClockPop(); positionClockPop();
            toast('Recordatorio quitado', 'info');
        });
        $(document).on('click', '#creditPop [data-up-openall]', function (e) {
            e.stopPropagation();
            closeClockPop();
            openUpgrade();
        });
        // Cerrar una notificación flotante de recordatorio.
        $(document).on('click', '.credit-note-x', function () { $(this).closest('.credit-note').remove(); });
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
