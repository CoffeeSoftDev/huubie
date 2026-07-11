/* Configuración global de modelos, compartida por todas las superficies del visor
 * (Visor, Playground, Studio, Forge, Chat). Fuente única de verdad del catálogo y
 * de qué modelos están habilitados. La preferencia vive en localStorage bajo una
 * sola clave, así el ajuste aplica "en todos los chats".
 *
 * No modifica los <select> de cada app: solo OCULTA las <option> de modelos
 * deshabilitados (y las <optgroup> que quedan vacías). Auto-engancha cualquier
 * `select.ia-model-pill` presente en la página y reacciona a cambios en vivo. */
(function (global) {
    'use strict';

    // Catálogo canónico — fuente única de los modelos de todas las superficies
    // (los <select> de Visor/Lab lo espejan; el Chat se puebla directo de aquí).
    // Si se agrega un modelo, se agrega aquí. `tools: true` = soporta tool-calling
    // (run_select / lectura de carpeta); las superficies lo vuelcan a data-tools.
    const CATALOG = [
        { group: 'Ollama Cloud', options: [
            { value: 'qwen3-coder:480b-cloud',       label: 'Qwen3 Coder 480B (código · módulos ⭐)', tools: true },
            { value: 'glm-5.2:cloud',                label: 'GLM 5.2 (código)', tools: true },
            { value: 'glm-5:cloud',                  label: 'GLM 5 (flagship)', tools: true },
            { value: 'glm-5.1:cloud',                label: 'GLM 5.1 (código)', tools: true },
            { value: 'glm-4.7:cloud',                label: 'GLM 4.7 (código)', tools: true },
            { value: 'qwen3-coder-next:cloud',       label: 'Qwen3 Coder Next (código)', tools: true },
            { value: 'deepseek-v4-pro:cloud',        label: 'DeepSeek V4 Pro (razonamiento)' },
            { value: 'deepseek-v4-flash:cloud',      label: 'DeepSeek V4 Flash (razonamiento rápido)' },
            { value: 'gpt-oss:120b-cloud',           label: 'GPT-OSS 120B (razonamiento)', tools: true },
            { value: 'kimi-k2.7-code:cloud',         label: 'Kimi K2.7 Code (código · vision)', tools: true },
            { value: 'kimi-k2.6:cloud',              label: 'Kimi K2.6 (agéntico · vision)', tools: true },
            { value: 'kimi-k2.5:cloud',              label: 'Kimi K2.5 (agéntico · vision)', tools: true },
            { value: 'gemma4:31b-cloud',             label: 'Gemma4 31B (vision)' },
            { value: 'gemini-3-flash-preview:cloud', label: 'Gemini 3 Flash (rápido · vision)' },
            { value: 'minimax-m3:cloud',             label: 'MiniMax M3 (vision · débil en módulos)', tools: true }
        ] },
        { group: 'OpenRouter (free)', options: [
            { value: 'openai/gpt-oss-120b:free',               label: 'GPT-OSS 120B (free)', tools: true },
            { value: 'z-ai/glm-4.5-air:free',                  label: 'GLM 4.5 Air (free)', tools: true },
            { value: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 3 Super 120B (free)' },
            { value: 'google/gemma-4-31b-it:free',             label: 'Gemma 4 31B (free, vision)' },
            { value: 'nvidia/nemotron-nano-12b-v2-vl:free',    label: 'Nemotron Nano 12B VL (free, vision)' }
        ] },
        { group: 'OpenRouter (de pago)', options: [
            { value: 'qwen/qwen3.7-max', label: 'Qwen3.7 Max (pago)', tools: true },
            { value: 'qwen/qwen3.6-27b', label: 'Qwen3.6 27B (pago)', tools: true }
        ] }
    ];

    const ENABLED_KEY = 'coffeeia:global:enabledModels';
    const ACTIVE_KEY  = 'coffeeia:global:activeModel';
    const EVT         = 'coffeeia:models-changed';

    const _allValues = CATALOG.reduce((a, g) => a.concat(g.options.map(o => o.value)), []);
    function allValues() { return _allValues.slice(); }
    function isCatalog(v) { return _allValues.indexOf(v) !== -1; }

    // Modelos habilitados. Sin config guardada => todos. Nunca devuelve vacío
    // (dejar la app sin modelos sería peor que ignorar la preferencia).
    function getEnabled() {
        try {
            const raw = localStorage.getItem(ENABLED_KEY);
            if (!raw) return allValues();
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return allValues();
            const known = arr.filter(isCatalog);
            return known.length ? known : allValues();
        } catch (e) { return allValues(); }
    }

    function setEnabled(values) {
        const clean = (values || []).filter(isCatalog);
        try { localStorage.setItem(ENABLED_KEY, JSON.stringify(clean.length ? clean : _allValues)); } catch (e) {}
        broadcast();
    }

    function isEnabled(v) { return getEnabled().indexOf(v) !== -1; }

    function broadcast() {
        try { global.dispatchEvent(new CustomEvent(EVT, { detail: { enabled: getEnabled() } })); } catch (e) {}
    }

    /* ── Modelo ACTIVO global (compartido por todas las superficies) ──
     * El modelo elegido en cualquier selector se guarda aquí y se propaga a los
     * demás selectores enganchados (misma pestaña al instante; otras pestañas/vistas
     * al recargar vía localStorage). Así "la selección de modelo aplica para todos". */
    function getActive() { try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch (e) { return ''; } }
    function setActive(v) { try { localStorage.setItem(ACTIVE_KEY, v || ''); } catch (e) {} }

    function optionExists(el, v) {
        return Array.prototype.some.call(el.options, function (o) { return o.value === v; });
    }
    // Notifica a la app dueña del select vía jQuery (o evento nativo). Se usa jQuery
    // .trigger('change') a propósito: dispara los handlers de la app (jQuery) pero NO
    // nuestro listener nativo `onUserChange`, evitando bucles de propagación.
    function notifyApp(el) {
        if (global.jQuery) global.jQuery(el).trigger('change');
        else el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Primer modelo del catálogo que esté habilitado (fallback si el activo se apaga).
    function firstEnabled() {
        const en = getEnabled();
        for (let i = 0; i < CATALOG.length; i++) {
            const opts = CATALOG[i].options;
            for (let j = 0; j < opts.length; j++) if (en.indexOf(opts[j].value) !== -1) return opts[j].value;
        }
        return '';
    }
    // Fija en un select el modelo activo global (si existe, está habilitado y difiere).
    function applySelectActive(el) {
        const v = getActive();
        if (!v || !isCatalog(v) || !isEnabled(v) || !optionExists(el, v) || el.value === v) return;
        el.value = v;
        notifyApp(el);
    }
    function propagateActive(source) {
        _bound.forEach(function (el) { if (el !== source) applySelectActive(el); });
    }
    // Cambio GENUINO del usuario en un selector (evento nativo): pasa a ser el activo global.
    function onUserChange(e) {
        const el = e.currentTarget;
        if (!el || !isCatalog(el.value) || el.value === getActive()) return;
        setActive(el.value);
        propagateActive(el);
    }

    // Oculta en un <select> los modelos del catálogo que estén deshabilitados.
    // Solo toca <option> cuyo value pertenece al catálogo: cualquier otra opción
    // (p.ej. "" = modelo del servidor) se respeta. Si la opción seleccionada quedó
    // oculta, salta al primer modelo visible. `notify` dispara change (para que la
    // app persista el nuevo modelo) — solo en cambios provocados por el usuario.
    function applyToSelect(sel, notify) {
        const el = (typeof sel === 'string') ? document.querySelector(sel)
                 : (sel && sel.jquery ? sel[0] : sel);
        if (!el || el.tagName !== 'SELECT') return;
        const enabled = getEnabled();
        let selHidden = false;

        Array.prototype.forEach.call(el.options, function (opt) {
            const managed = isCatalog(opt.value);
            const on = !managed || enabled.indexOf(opt.value) !== -1;
            opt.hidden = !on;
            opt.disabled = !on;
            if (!on && opt.selected) selHidden = true;
        });
        Array.prototype.forEach.call(el.querySelectorAll('optgroup'), function (og) {
            const anyVisible = Array.prototype.some.call(og.querySelectorAll('option'), function (o) { return !o.hidden; });
            og.hidden = !anyVisible;
        });

        if (selHidden) {
            const first = Array.prototype.filter.call(el.options, function (o) { return !o.hidden; })[0];
            if (first) {
                el.value = first.value;
                if (notify) {
                    if (global.jQuery) global.jQuery(el).trigger('change');
                    else el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }
    }

    // Registra un <select> para que se re-filtre al cambiar la config y cuando la
    // app le agregue opciones tarde (chat las puebla por JS): un MutationObserver
    // vigila el childList y vuelve a aplicar el filtro (silencioso).
    const _bound = [];
    function bind(sel) {
        const el = (typeof sel === 'string') ? document.querySelector(sel)
                 : (sel && sel.jquery ? sel[0] : sel);
        if (!el || el.tagName !== 'SELECT' || _bound.indexOf(el) !== -1) return;
        _bound.push(el);
        applyToSelect(el, false);
        applySelectActive(el);
        el.addEventListener('change', onUserChange);
        try {
            const mo = new MutationObserver(function () { applyToSelect(el, false); applySelectActive(el); });
            mo.observe(el, { childList: true, subtree: true });
        } catch (e) {}
    }

    function bindAll() {
        Array.prototype.forEach.call(document.querySelectorAll('select.ia-model-pill'), bind);
    }

    // Re-filtra todo lo enganchado cuando cambia la preferencia (esta pestaña u otra).
    // Si el modelo activo quedó deshabilitado, adopta el primer modelo habilitado.
    global.addEventListener(EVT, function () {
        _bound.forEach(function (el) { applyToSelect(el, true); });
        const a = getActive();
        if (a && !isEnabled(a)) { const f = firstEnabled(); if (f) { setActive(f); propagateActive(null); } }
    });
    global.addEventListener('storage', function (e) {
        if (e.key === ENABLED_KEY) broadcast();
        else if (e.key === ACTIVE_KEY) _bound.forEach(applySelectActive);
    });
    // Tras la carga completa re-aplica el modelo activo: gana la carrera contra la
    // restauración por-superficie que hace cada app en su init (DOM ready).
    global.addEventListener('load', function () { _bound.forEach(applySelectActive); });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindAll);
    } else {
        bindAll();
    }

    global.CoffeeModelConfig = {
        CATALOG: CATALOG,
        KEY: ENABLED_KEY,
        EVENT: EVT,
        ACTIVE_KEY: ACTIVE_KEY,
        allValues: allValues,
        getEnabled: getEnabled,
        setEnabled: setEnabled,
        isEnabled: isEnabled,
        getActive: getActive,
        setActive: setActive,
        applyToSelect: applyToSelect,
        bind: bind,
        bindAll: bindAll
    };
})(window);
