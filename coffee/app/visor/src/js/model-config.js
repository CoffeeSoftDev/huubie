/* Configuración global de modelos, compartida por todas las superficies del visor
 * (Visor, Playground, Studio, Forge, Chat). Fuente única de verdad del CATÁLOGO
 * EDITABLE (CRUD desde el admin de modelos), de qué modelos están habilitados y del
 * modelo activo. Todo persiste en localStorage y se espeja en SQLite (prefs-store.js),
 * así el ajuste aplica "en todos los chats".
 *
 * El catálogo dejó de estar hardcodeado: hay un SEED (modelos de fábrica) y encima el
 * catálogo guardado por el usuario. Cada modelo lleva metadata rica (capacidades,
 * niveles de reasoning_effort, tokens, precios) que MANEJA comportamiento: el selector
 * de Esfuerzo muestra solo los niveles que el modelo acepta, vision/tools activan
 * features, etc.
 *
 * Sobre los <select> de cada app: sincroniza sus <option> con el catálogo (agrega los
 * modelos que falten, ajusta la etiqueta y data-tools) y OCULTA los deshabilitados.
 * Auto-engancha cualquier `select.ia-model-pill` y reacciona a cambios en vivo. */
(function (global) {
    'use strict';

    // ── SEED: catálogo de fábrica ────────────────────────────────────────────────
    // Metadata mínima; normalizeModel() rellena el resto. `name` conserva la etiqueta
    // descriptiva actual para no alterar los selectores existentes (el usuario puede
    // acortarla en el editor). effortLevels no vacío = el modelo acepta reasoning_effort.
    const SEED = [
        // Ollama Cloud
        { id: 'qwen3-coder:480b-cloud',       name: 'Qwen3 Coder 480B (código · módulos ⭐)', group: 'Ollama Cloud', tools: true, tags: ['code'] },
        { id: 'glm-5.2:cloud',                name: 'GLM 5.2 (código)', group: 'Ollama Cloud', tools: true, tags: ['code'] },
        { id: 'glm-5:cloud',                  name: 'GLM 5 (flagship)', group: 'Ollama Cloud', tools: true, tags: ['flagship'] },
        { id: 'glm-5.1:cloud',                name: 'GLM 5.1 (código)', group: 'Ollama Cloud', tools: true, tags: ['code'] },
        { id: 'glm-4.7:cloud',                name: 'GLM 4.7 (código)', group: 'Ollama Cloud', tools: true, tags: ['code'] },
        { id: 'qwen3-coder-next:cloud',       name: 'Qwen3 Coder Next (código)', group: 'Ollama Cloud', tools: true, tags: ['code'] },
        { id: 'deepseek-v4-pro:cloud',        name: 'DeepSeek V4 Pro (razonamiento)', group: 'Ollama Cloud', thinking: true, effortLevels: ['low', 'medium', 'high', 'max'], tags: ['reasoning'] },
        { id: 'deepseek-v4-flash:cloud',      name: 'DeepSeek V4 Flash (razonamiento rápido)', group: 'Ollama Cloud', thinking: true, effortLevels: ['low', 'medium', 'high', 'max'], tags: ['reasoning'] },
        { id: 'gpt-oss:120b-cloud',           name: 'GPT-OSS 120B (razonamiento)', group: 'Ollama Cloud', tools: true, thinking: true, effortLevels: ['low', 'medium', 'high'], tags: ['reasoning'] },
        { id: 'kimi-k2.7-code:cloud',         name: 'Kimi K2.7 Code (código · vision)', group: 'Ollama Cloud', tools: true, vision: true, tags: ['code', 'vision'] },
        { id: 'kimi-k2.6:cloud',              name: 'Kimi K2.6 (agéntico · vision)', group: 'Ollama Cloud', tools: true, vision: true, thinking: true, effortLevels: ['low', 'medium', 'high', 'max'], tags: ['agentic', 'vision'] },
        { id: 'kimi-k2.5:cloud',              name: 'Kimi K2.5 (agéntico · vision)', group: 'Ollama Cloud', tools: true, vision: true, tags: ['agentic', 'vision'] },
        { id: 'gemma4:31b-cloud',             name: 'Gemma4 31B (vision)', group: 'Ollama Cloud', vision: true, tags: ['vision', '31b'] },
        { id: 'gemini-3-flash-preview:cloud', name: 'Gemini 3 Flash (rápido · vision)', group: 'Ollama Cloud', vision: true, tags: ['fast', 'vision'] },
        { id: 'minimax-m3:cloud',             name: 'MiniMax M3 (vision · débil en módulos)', group: 'Ollama Cloud', tools: true, vision: true, tags: ['vision'] },
        // OpenRouter (free)
        { id: 'openai/gpt-oss-120b:free',               name: 'GPT-OSS 120B (free)', group: 'OpenRouter (free)', provider: 'openrouter', tools: true, thinking: true, effortLevels: ['low', 'medium', 'high'], tags: ['reasoning', 'free'] },
        { id: 'z-ai/glm-4.5-air:free',                  name: 'GLM 4.5 Air (free)', group: 'OpenRouter (free)', provider: 'openrouter', tools: true, tags: ['free'] },
        { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super 120B (free)', group: 'OpenRouter (free)', provider: 'openrouter', tags: ['free'] },
        { id: 'google/gemma-4-31b-it:free',             name: 'Gemma 4 31B (free, vision)', group: 'OpenRouter (free)', provider: 'openrouter', vision: true, tags: ['free', 'vision'] },
        { id: 'nvidia/nemotron-nano-12b-v2-vl:free',    name: 'Nemotron Nano 12B VL (free, vision)', group: 'OpenRouter (free)', provider: 'openrouter', vision: true, tags: ['free', 'vision'] },
        // OpenRouter (de pago)
        { id: 'qwen/qwen3.7-max', name: 'Qwen3.7 Max (pago)', group: 'OpenRouter (de pago)', provider: 'openrouter', tools: true, tags: ['paid'] },
        { id: 'qwen/qwen3.6-27b', name: 'Qwen3.6 27B (pago)', group: 'OpenRouter (de pago)', provider: 'openrouter', tools: true, tags: ['paid'] }
    ];

    const ENABLED_KEY = 'coffeeia:global:enabledModels';
    const ACTIVE_KEY  = 'coffeeia:global:activeModel';
    const CATALOG_KEY = 'coffeeia:global:modelCatalog';
    const EVT         = 'coffeeia:models-changed';
    const EFFORT_LEVELS = ['low', 'medium', 'high', 'max'];   // orden canónico

    // ── Normalización / esquema del modelo ───────────────────────────────────────
    function normalizeModel(m) {
        m = m || {};
        const id = String(m.id || '').trim();
        const provider = m.provider || (id.indexOf('/') !== -1 ? 'openrouter' : 'ollama');
        const group = m.group || (provider === 'openrouter' ? 'OpenRouter' : 'Ollama Cloud');
        const effortLevels = Array.isArray(m.effortLevels)
            ? m.effortLevels.filter(function (l) { return EFFORT_LEVELS.indexOf(l) !== -1; })
            : [];
        return {
            id: id,
            name: String(m.name || id),
            desc: String(m.desc || ''),
            provider: provider,
            group: group,
            tags: Array.isArray(m.tags) ? m.tags.slice() : [],
            vision: !!m.vision,
            tools: !!m.tools,
            thinking: !!m.thinking,
            thinkingObject: !!m.thinkingObject,
            effortLevels: effortLevels,
            effortDefault: (EFFORT_LEVELS.indexOf(m.effortDefault) !== -1) ? m.effortDefault : '',
            maxTokens: (m.maxTokens === 0 || m.maxTokens) ? Number(m.maxTokens) : null,
            tempMin: (m.tempMin === 0 || m.tempMin) ? Number(m.tempMin) : null,
            priceIn: Number(m.priceIn) || 0,
            priceOut: Number(m.priceOut) || 0,
            builtin: !!m.builtin
        };
    }
    const _seed = SEED.map(function (m) { m.builtin = true; return normalizeModel(m); });

    // ── Persistencia ─────────────────────────────────────────────────────────────
    function persist(key, raw) { if (global.CoffeePrefs) global.CoffeePrefs.push(key, raw); }

    // Catálogo vivo: el guardado por el usuario o el SEED. Si el guardado existe pero
    // es inválido/vacío, cae al SEED (dejar la app sin modelos sería peor).
    let _catalog = null;
    function loadCatalog() {
        try {
            const raw = localStorage.getItem(CATALOG_KEY);
            if (!raw) return _seed.slice();
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr) || !arr.length) return _seed.slice();
            return arr.map(normalizeModel).filter(function (m) { return m.id; });
        } catch (e) { return _seed.slice(); }
    }
    function getModels() { if (!_catalog) _catalog = loadCatalog(); return _catalog; }
    function saveCatalog(models) {
        _catalog = (models || []).map(normalizeModel).filter(function (m) { return m.id; });
        const raw = JSON.stringify(_catalog);
        try { localStorage.setItem(CATALOG_KEY, raw); } catch (e) {}
        persist(CATALOG_KEY, raw);
        broadcast();
    }
    function getModel(id) {
        const list = getModels();
        for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
        return null;
    }
    // Alta/edición por id (upsert). Devuelve el catálogo resultante.
    function upsertModel(model) {
        const m = normalizeModel(model);
        if (!m.id) return getModels();
        const list = getModels().slice();
        const i = list.findIndex(function (x) { return x.id === m.id; });
        if (i === -1) list.push(m); else list[i] = m;
        saveCatalog(list);
        return _catalog;
    }
    function deleteModel(id) {
        saveCatalog(getModels().filter(function (m) { return m.id !== id; }));
        // Si el borrado estaba habilitado/activo, se limpia solo por getEnabled/firstEnabled.
    }
    function resetCatalog() { saveCatalog(_seed.slice()); }

    // CATALOG legacy [{group, options:[{value,label,tools}]}] derivado del catálogo rico,
    // para las superficies que lo consumen (coffeeia/chat lo espejan; account-menu lista).
    function catalogGrouped() {
        const order = [];
        const byGroup = {};
        getModels().forEach(function (m) {
            if (!byGroup[m.group]) { byGroup[m.group] = []; order.push(m.group); }
            byGroup[m.group].push({ value: m.id, label: m.name, tools: m.tools, model: m });
        });
        return order.map(function (g) { return { group: g, options: byGroup[g] }; });
    }

    // ── Habilitados / activo ─────────────────────────────────────────────────────
    function allValues() { return getModels().map(function (m) { return m.id; }); }
    function isCatalog(v) { return !!getModel(v); }

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
        const raw   = JSON.stringify(clean.length ? clean : allValues());
        try { localStorage.setItem(ENABLED_KEY, raw); } catch (e) {}
        persist(ENABLED_KEY, raw);
        broadcast();
    }
    function isEnabled(v) { return getEnabled().indexOf(v) !== -1; }

    function broadcast() {
        try { global.dispatchEvent(new CustomEvent(EVT, { detail: { enabled: getEnabled() } })); } catch (e) {}
    }

    function getActive() { try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch (e) { return ''; } }
    function setActive(v) {
        try { localStorage.setItem(ACTIVE_KEY, v || ''); } catch (e) {}
        persist(ACTIVE_KEY, v || '');
    }

    // ── Helpers de COMPORTAMIENTO (los usan las superficies) ─────────────────────
    // Niveles de esfuerzo que el modelo acepta ([] = no acepta reasoning_effort).
    function effortLevelsFor(id) { const m = getModel(id); return m ? m.effortLevels.slice() : []; }
    function effortDefaultFor(id) { const m = getModel(id); return m ? m.effortDefault : ''; }
    function acceptsEffort(id) { return effortLevelsFor(id).length > 0; }
    function hasVision(id) { const m = getModel(id); return !!(m && m.vision); }
    function hasTools(id)  { const m = getModel(id); return !!(m && m.tools); }
    function isThinking(id) { const m = getModel(id); return !!(m && m.thinking); }

    // ── Selector de ESFUERZO gobernado por el modelo ─────────────────────────────
    // Cada selector de modelo (#...ModelSelect) tiene un selector de esfuerzo hermano
    // (#...EffortSelect). Según los niveles que el modelo acepta, se repuebla el de
    // esfuerzo (Auto + Rápido + esos niveles) o se OCULTA (el modelo no razona) y se
    // fuerza a Auto para no mandar un reasoning_effort que el modelo rechazaría.
    const EFFORT_LABELS = { off: 'Rápido', low: 'Bajo', medium: 'Medio', high: 'Alto', max: 'Máximo' };
    function effortSelectFor(modelEl) {
        const id = (modelEl && modelEl.id) || '';
        let effId = '';
        if (/ModelSelect$/.test(id)) effId = id.replace(/ModelSelect$/, 'EffortSelect');
        else if (/modelSelect$/.test(id)) effId = id.replace(/modelSelect$/, 'effortSelect');
        return effId ? document.getElementById(effId) : null;
    }
    function syncEffortFor(modelEl) {
        const eff = effortSelectFor(modelEl);
        if (!eff) return;
        const levels = effortLevelsFor(modelEl.value);
        if (!levels.length) {
            eff.style.display = 'none';                       // el modelo no maneja esfuerzo
            if (eff.value !== '') { eff.value = ''; notifyApp(eff); }
            return;
        }
        eff.style.display = '';
        let html = '<option value="">Auto</option><option value="off">Rápido</option>';
        levels.forEach(function (lv) { html += '<option value="' + lv + '">' + (EFFORT_LABELS[lv] || lv) + '</option>'; });
        if (eff.innerHTML !== html) {
            const prev = eff.value;
            eff.innerHTML = html;
            const ok = Array.prototype.some.call(eff.options, function (o) { return o.value === prev; });
            const next = ok ? prev : '';
            if (eff.value !== next) { eff.value = next; notifyApp(eff); }
        }
    }

    // ── Selects: sincronización + filtrado ───────────────────────────────────────
    function optionExists(el, v) {
        return Array.prototype.some.call(el.options, function (o) { return o.value === v; });
    }
    function notifyApp(el) {
        if (global.jQuery) global.jQuery(el).trigger('change');
        else el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function firstEnabled() {
        const en = getEnabled();
        const list = getModels();
        for (let i = 0; i < list.length; i++) if (en.indexOf(list[i].id) !== -1) return list[i].id;
        return '';
    }
    function applySelectActive(el) {
        const v = getActive();
        if (!v || !isCatalog(v) || !isEnabled(v) || !optionExists(el, v) || el.value === v) return;
        el.value = v;
        notifyApp(el);
    }
    function propagateActive(source) {
        _bound.forEach(function (el) { if (el !== source) applySelectActive(el); syncEffortFor(el); });
    }
    function onUserChange(e) {
        const el = e.currentTarget;
        if (!el || !isCatalog(el.value) || el.value === getActive()) return;
        setActive(el.value);
        propagateActive(el);
    }

    // Sincroniza las <option> del select con el catálogo (aditivo): agrega los modelos
    // que aún no tienen opción (los que registró el usuario), refresca su etiqueta y
    // data-tools. No borra opciones ajenas (p.ej. "" = default del servidor).
    let _applying = false;
    function syncSelectOptions(el) {
        const byGroup = {};
        const order = [];
        getModels().forEach(function (m) {
            if (!byGroup[m.group]) { byGroup[m.group] = []; order.push(m.group); }
            byGroup[m.group].push(m);
        });
        const existing = {};
        Array.prototype.forEach.call(el.options, function (o) { existing[o.value] = o; });

        order.forEach(function (group) {
            let og = Array.prototype.filter.call(el.querySelectorAll('optgroup'), function (g) { return g.label === group; })[0];
            byGroup[group].forEach(function (m) {
                let opt = existing[m.id];
                if (!opt) {
                    opt = document.createElement('option');
                    opt.value = m.id;
                    if (!og) { og = document.createElement('optgroup'); og.label = group; el.appendChild(og); }
                    og.appendChild(opt);
                }
                if (opt.textContent !== m.name) opt.textContent = m.name;   // evita mutaciones inútiles
                if (m.tools) opt.setAttribute('data-tools', '1'); else opt.removeAttribute('data-tools');
            });
        });
    }

    function applyToSelect(sel, notify) {
        const el = (typeof sel === 'string') ? document.querySelector(sel)
                 : (sel && sel.jquery ? sel[0] : sel);
        if (!el || el.tagName !== 'SELECT' || _applying) return;
        _applying = true;
        try {
            syncSelectOptions(el);

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
                    if (notify) notifyApp(el);
                }
            }
        } finally {
            _applying = false;
        }
    }

    const _bound = [];
    function bind(sel) {
        const el = (typeof sel === 'string') ? document.querySelector(sel)
                 : (sel && sel.jquery ? sel[0] : sel);
        if (!el || el.tagName !== 'SELECT' || _bound.indexOf(el) !== -1) return;
        // Los selectores de ESFUERZO comparten la clase .ia-model-pill por estilo, pero
        // NO son de modelo: excluirlos para no inyectarles el catálogo. Los gobierna
        // syncEffortFor a partir de su selector de modelo hermano.
        if (/EffortSelect$/.test(el.id) || /effortSelect$/.test(el.id)) return;
        _bound.push(el);
        applyToSelect(el, false);
        applySelectActive(el);
        syncEffortFor(el);
        el.addEventListener('change', onUserChange);
        el.addEventListener('change', function () { syncEffortFor(el); });
        try {
            const mo = new MutationObserver(function () { if (!_applying) { applyToSelect(el, false); applySelectActive(el); } });
            mo.observe(el, { childList: true, subtree: true });
        } catch (e) {}
    }
    function bindAll() {
        Array.prototype.forEach.call(document.querySelectorAll('select.ia-model-pill'), bind);
    }
    // Re-sincroniza todos los selects enganchados (tras editar el catálogo o habilitados).
    function refreshAll(notify) { _bound.forEach(function (el) { applyToSelect(el, notify !== false); applySelectActive(el); syncEffortFor(el); }); }

    global.addEventListener(EVT, function () {
        refreshAll(true);
        const a = getActive();
        if (a && !isEnabled(a)) { const f = firstEnabled(); if (f) { setActive(f); propagateActive(null); } }
    });
    global.addEventListener('storage', function (e) {
        if (e.key === ENABLED_KEY || e.key === CATALOG_KEY) { _catalog = null; broadcast(); }
        else if (e.key === ACTIVE_KEY) _bound.forEach(applySelectActive);
    });
    global.addEventListener('coffeeia:prefs-synced', function (e) {
        const keys = (e.detail && e.detail.keys) || [];
        if (keys.indexOf(CATALOG_KEY) !== -1) { _catalog = null; }
        if (keys.indexOf(ENABLED_KEY) !== -1 || keys.indexOf(CATALOG_KEY) !== -1) broadcast();
        if (keys.indexOf(ACTIVE_KEY)  !== -1) _bound.forEach(applySelectActive);
    });
    global.addEventListener('load', function () { _bound.forEach(function (el) { applySelectActive(el); syncEffortFor(el); }); });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindAll);
    } else {
        bindAll();
    }

    global.CoffeeModelConfig = {
        KEY: ENABLED_KEY,
        CATALOG_KEY: CATALOG_KEY,
        EVENT: EVT,
        ACTIVE_KEY: ACTIVE_KEY,
        EFFORT_LEVELS: EFFORT_LEVELS,
        // CATALOG legacy (getter): las superficies que lo consumen releen el vivo.
        get CATALOG() { return catalogGrouped(); },
        // catálogo rico + CRUD
        getModels: getModels,
        getModel: getModel,
        upsertModel: upsertModel,
        deleteModel: deleteModel,
        saveCatalog: saveCatalog,
        resetCatalog: resetCatalog,
        seed: function () { return _seed.slice(); },
        // habilitados / activo
        allValues: allValues,
        getEnabled: getEnabled,
        setEnabled: setEnabled,
        isEnabled: isEnabled,
        getActive: getActive,
        setActive: setActive,
        // comportamiento
        effortLevelsFor: effortLevelsFor,
        effortDefaultFor: effortDefaultFor,
        acceptsEffort: acceptsEffort,
        hasVision: hasVision,
        hasTools: hasTools,
        isThinking: isThinking,
        // selects
        applyToSelect: applyToSelect,
        refreshAll: refreshAll,
        bind: bind,
        bindAll: bindAll
    };
})(window);
