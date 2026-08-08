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
        { id: 'glm-5.2:cloud',                name: 'GLM 5.2 (código ⭐)', group: 'Ollama Cloud', tools: true, thinking: true, effortLevels: ['low', 'medium', 'high'], tags: ['code'] },
        { id: 'deepseek-v4-pro:cloud',        name: 'DeepSeek V4 Pro (razonamiento)', group: 'Ollama Cloud', thinking: true, effortLevels: ['low', 'medium', 'high', 'max'], tags: ['reasoning'] },
        { id: 'gpt-oss:120b-cloud',           name: 'GPT-OSS 120B (razonamiento)', group: 'Ollama Cloud', tools: true, thinking: true, effortLevels: ['low', 'medium', 'high'], tags: ['reasoning'] },
        { id: 'kimi-k2.7-code:cloud',         name: 'Kimi K2.7 Code (código · vision)', group: 'Ollama Cloud', tools: true, vision: true, thinking: true, effortLevels: ['low', 'medium', 'high'], tags: ['code', 'vision'] },
        { id: 'gemma4:31b-cloud',             name: 'Gemma4 31B (vision)', group: 'Ollama Cloud', vision: true, thinking: true, effortLevels: ['low', 'medium', 'high'], tags: ['vision', '31b'] },
        { id: 'minimax-m3:cloud',             name: 'MiniMax M3 (vision · débil en módulos)', group: 'Ollama Cloud', tools: true, vision: true, thinking: true, effortLevels: ['low', 'medium', 'high'], tags: ['vision'] },
        // OpenCode Zen (free) — responden SIN API key y con costo 0. OJO: el tier free
        // entrena con lo que se le manda; no mandar código de clientes.
        { id: 'opencode/deepseek-v4-flash-free', name: 'DeepSeek V4 Flash (free)', group: 'OpenCode Zen (free)', provider: 'opencode', thinking: true, effortLevels: ['low', 'medium', 'high'], tags: ['reasoning', 'free'] },
        { id: 'opencode/mimo-v2.5-free',         name: 'MiMo V2.5 (free · vision)', group: 'OpenCode Zen (free)', provider: 'opencode', tools: true, vision: true, thinking: true, effortLevels: ['low', 'medium', 'high'], tags: ['free', 'vision'] },
        { id: 'opencode/big-pickle',             name: 'Big Pickle (free)', group: 'OpenCode Zen (free)', provider: 'opencode', tools: true, thinking: true, effortLevels: ['low', 'medium', 'high'], tags: ['free'] },
        { id: 'opencode/nemotron-3-ultra-free',  name: 'Nemotron 3 Ultra (free · sin razonamiento)', group: 'OpenCode Zen (free)', provider: 'opencode', tags: ['free'] },
        { id: 'opencode/laguna-s-2.1-free',      name: 'Laguna S 2.1 (free · razona mucho)', group: 'OpenCode Zen (free)', provider: 'opencode', thinking: true, effortLevels: ['low', 'medium', 'high'], tags: ['reasoning', 'free'] },
        // OpenCode Go — suscripción de tarifa plana (topes en dólares). Requiere key.
        { id: 'opencode/kimi-k3',      name: 'Kimi K3 (agéntico · vision)', group: 'OpenCode Go', provider: 'opencode', tools: true, vision: true, thinking: true, effortLevels: ['low', 'medium', 'high', 'max'], tags: ['agentic', 'vision'] },
        { id: 'opencode/qwen3.8-max',  name: 'Qwen3.8 Max (razonamiento)', group: 'OpenCode Go', provider: 'opencode', tools: true, thinking: true, effortLevels: ['low', 'medium', 'high'], tags: ['flagship', 'reasoning'] },
        { id: 'opencode/gpt-5.6-luna', name: 'GPT-5.6 Luna (vision · razonamiento)', group: 'OpenCode Go', provider: 'opencode', tools: true, vision: true, thinking: true, effortLevels: ['low', 'medium', 'high'], tags: ['vision', 'reasoning'] },
        { id: 'opencode/grok-4.5',     name: 'Grok 4.5 (vision · razonamiento)', group: 'OpenCode Go', provider: 'opencode', tools: true, vision: true, thinking: true, effortLevels: ['low', 'medium', 'high'], tags: ['vision', 'reasoning'] }
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
        // El prefijo 'opencode/' se revisa antes que la diagonal suelta: los ids de
        // OpenCode son pelones ('glm-5.2') y sin él no se distinguirían de Ollama.
        const provider = m.provider || (id.indexOf('opencode/') === 0 ? 'opencode'
                                     : (id.indexOf('/') !== -1 ? 'openrouter' : 'ollama'));
        const GROUP_BY_PROVIDER = { opencode: 'OpenCode Go', openrouter: 'OpenRouter', ollama: 'Ollama Cloud' };
        const group = m.group || GROUP_BY_PROVIDER[provider] || 'Ollama Cloud';
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

    // Etiqueta del proveedor a partir del id. Gemela de llm_provider_label() en
    // ctrl/llm-client.php: el prefijo 'opencode/' manda sobre la diagonal suelta.
    function providerLabel(id) {
        id = String(id || '');
        if (id.indexOf('opencode/') === 0) return 'OpenCode';
        return id.indexOf('/') !== -1 ? 'OpenRouter' : 'Ollama';
    }

    // ── Persistencia ─────────────────────────────────────────────────────────────
    function persist(key, raw) { if (global.CoffeePrefs) global.CoffeePrefs.push(key, raw); }

    function readList(key) {
        try {
            const raw = localStorage.getItem(key);
            const arr = raw ? JSON.parse(raw) : null;
            return Array.isArray(arr) ? arr : null;
        } catch (e) { return null; }
    }
    function writeList(key, arr) {
        const raw = JSON.stringify(arr);
        try { localStorage.setItem(key, raw); } catch (e) {}
        persist(key, raw);
    }

    // Ids del SEED que el usuario todavía no tenía. getEnabled() los da por
    // habilitados: un modelo nuevo que nace apagado se ve igual que uno que no existe.
    let _fresh = [];

    /**
     * Catálogo vivo. EL SEED MANDA: los modelos de fábrica son siempre los que
     * declara este archivo, con sus nombres y capacidades al día. Del catálogo
     * guardado solo sobreviven los modelos PROPIOS del usuario — lo suyo se respeta,
     * lo del sistema no se bifurca.
     *
     * Consecuencias buscadas: un modelo agregado aquí aparece en todos lados sin que
     * nadie tenga que restablecer nada, y uno retirado desaparece de verdad. Para
     * quitar de la vista un modelo de fábrica se DESHABILITA, no se borra.
     */
    let _catalog = null;
    function loadCatalog() {
        _fresh = [];
        const saved = readList(CATALOG_KEY);
        if (!saved || !saved.length) return _seed.slice();

        const previos = saved.map(normalizeModel).filter(function (m) { return m.id; });
        const enSeed  = {};
        _seed.forEach(function (m) { enSeed[m.id] = true; });

        // Propios = los que creó el usuario. Un builtin guardado que ya no está en el
        // SEED se retiró a propósito del producto: no se conserva.
        const propios = previos.filter(function (m) { return !enSeed[m.id] && !m.builtin; });
        const list    = _seed.slice().concat(propios);

        const tenia = {};
        previos.forEach(function (m) { tenia[m.id] = true; });
        _fresh = _seed.filter(function (m) { return !tenia[m.id]; }).map(function (m) { return m.id; });

        // Se realinea lo guardado con el catálogo del sistema.
        if (_fresh.length || list.length !== previos.length) writeList(CATALOG_KEY, list);
        return list;
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
        const m = getModel(id);
        // Un modelo de fábrica no se puede borrar: el SEED lo repondría en la
        // siguiente carga y parecería que la acción no sirvió. Sobre esos, "eliminar"
        // es apagarlo — que sí perdura y es reversible.
        if (m && m.builtin) {
            setEnabled(getEnabled().filter(function (v) { return v !== id; }));
            return;
        }
        saveCatalog(getModels().filter(function (x) { return x.id !== id; }));
        // Si el borrado estaba habilitado/activo, se limpia solo por getEnabled/firstEnabled.
    }
    function resetCatalog() { saveCatalog(_seed.slice()); }

    // CATALOG legacy [{group, options:[{value,label,tools}]}] derivado del catálogo rico,
    // para las superficies que lo consumen (coffeeia/chat lo espejan; account-menu lista).
    // `onlyEnabled` deja fuera los deshabilitados: así quien pinta un <select> ya nace
    // filtrado y no depende de que applyToSelect llegue después a ocultar opciones.
    function catalogGrouped(onlyEnabled) {
        const order = [];
        const byGroup = {};
        const enabled = onlyEnabled ? getEnabled() : null;
        getModels().forEach(function (m) {
            if (enabled && enabled.indexOf(m.id) === -1) return;
            if (!byGroup[m.group]) { byGroup[m.group] = []; order.push(m.group); }
            byGroup[m.group].push({ value: m.id, label: m.name, tools: m.tools, model: m });
        });
        return order.map(function (g) { return { group: g, options: byGroup[g] }; });
    }

    // ── Habilitados / activo ─────────────────────────────────────────────────────
    function allValues() { return getModels().map(function (m) { return m.id; }); }
    function isCatalog(v) { return !!getModel(v); }

    // Cuando la preferencia guardada se descarta, la app vuelve a mostrar TODOS los modelos.
    // Eso se parece demasiado a "el ajuste no se aplicó", así que se anuncia en vez de
    // pasar callado: `issue` guarda el motivo y se avisa una vez por página.
    let _issue = null;
    function discard(reason) {
        if (_issue !== reason) {
            _issue = reason;
            console.warn('[modelos] la lista de habilitados se ignoró (' + reason + '): se muestran todos los modelos.');
            try { global.dispatchEvent(new CustomEvent('coffeeia:models-issue', { detail: { reason: reason } })); } catch (e) {}
        }
        return allValues();
    }

    function getEnabled() {
        try {
            const raw = localStorage.getItem(ENABLED_KEY);
            if (!raw) return allValues();                      // nunca se configuró: todos
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return discard('la preferencia guardada no es una lista');
            const known = arr.filter(isCatalog);
            if (!known.length) return discard('ninguno de los ' + arr.length + ' modelos guardados existe en el catálogo actual');
            if (known.length !== arr.length) {
                console.warn('[modelos] ' + (arr.length - known.length) + ' modelo(s) habilitados ya no existen en el catálogo y se ignoran.');
            }
            // Novedades de fábrica: nacen habilitadas. isCatalog() de arriba ya forzó
            // la carga del catálogo, así que _fresh viene poblado.
            if (_fresh.length) {
                const nuevos = _fresh.filter(function (id) { return known.indexOf(id) === -1; });
                if (nuevos.length) {
                    console.info('[modelos] ' + nuevos.length + ' modelo(s) nuevos de fábrica se habilitaron solos: ' + nuevos.join(', '));
                    writeList(ENABLED_KEY, known.concat(nuevos));
                    _fresh = [];
                    return known.concat(nuevos);
                }
            }
            _issue = null;
            return known;
        } catch (e) { return discard('la preferencia guardada está corrupta'); }
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
        // Se conserva el nivel elegido si el modelo nuevo también lo acepta. Si no lo
        // acepta —o si nadie ha elegido nada (Auto)— manda el "Nivel por defecto" que
        // el modelo declara en el catálogo; sin él, Auto.
        const def  = effortDefaultFor(modelEl.value);
        const prev = eff.value;
        if (eff.innerHTML !== html) {
            eff.innerHTML = html;
        }
        const sirve = Array.prototype.some.call(eff.options, function (o) { return o.value === prev; });
        const next  = (sirve && prev !== '') ? prev
                    : (def && levels.indexOf(def) !== -1 ? def : '');
        if (eff.value !== next) { eff.value = next; notifyApp(eff); }
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
    // `data-model-sync="off"` en el select: no se le inyecta el catálogo (conserva su
    // lista curada, p.ej. un chat especializado) pero sí se le ocultan los deshabilitados.
    let _applying = false;
    function syncSelectOptions(el) {
        if (el.getAttribute('data-model-sync') === 'off') return;
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
                // El catálogo manda también aquí: una <option> escrita a mano en el HTML
                // cuyo modelo ya no existe se OCULTA. Antes se daba por buena por no estar
                // catalogada, y así seguían saliendo modelos retirados del producto.
                // Única excepción: la opción sin valor ("— Default del proveedor —").
                const on = opt.value === '' || enabled.indexOf(opt.value) !== -1;
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
        // Lo mismo con el de AGENTE: lo llena cada pagina con su catalogo de agentes.
        // Sin esta salida, aqui se le inyectaban modelos y el observador de abajo los
        // volvia a poner cada vez que la pagina intentaba repoblarlo.
        if (/AgentSelect$/i.test(el.id) || el.classList.contains('ia-agent-pill') ||
            el.classList.contains('cia-agent-pill')) return;
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
        // Igual que CATALOG pero ya sin los deshabilitados (para poblar selects).
        get ENABLED_CATALOG() { return catalogGrouped(true); },
        // Motivo por el que se ignoró la preferencia guardada (null = todo en orden).
        lastIssue: function () { return _issue; },
        // Nombre del proveedor a partir del id, para las metas de cada respuesta.
        providerLabel: providerLabel,
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
