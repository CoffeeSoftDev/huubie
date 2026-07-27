/* Catálogo de HERRAMIENTAS del chat, compartido por las superficies del visor.
 * Gemelo de model-config.js, pero la fuente de verdad vive en el SERVIDOR
 * (ctrl/ctrl-tools.php sobre data/tools.sqlite): quien ejecuta las tools es PHP,
 * así que el navegador solo cachea el catálogo para pintarlo.
 *
 * Dos familias: las BASE del visor (lectura de carpeta, consulta a la base, descarga
 * de URL) que solo se activan/desactivan, y las PROPIAS del usuario (HTTP), que se
 * crean, editan y prueban desde Configuración → Herramientas.
 *
 * Al cambiar algo dispara `coffeeia:tools-changed` para que quien las tenga en
 * pantalla (menú del chat, panel de configuración) se repinte. */
(function (global) {
    'use strict';

    const API = 'ctrl/ctrl-tools.php';
    const EVT = 'coffeeia:tools-changed';

    let _tools   = null;    // catálogo cacheado (null = aún no cargado)
    let _loading = null;    // promesa en vuelo (evita cargas duplicadas)
    // Destinos posibles (los manda el servidor con el catálogo; estos son el respaldo
    // si aún no respondió, para que el editor pueda pintarse igual).
    let _surfaces = [
        { key: 'visor',      label: 'Visor',      description: 'Chat del documento abierto' },
        { key: 'coffeeia',   label: 'CoffeeIA',   description: 'Chat de pantalla completa' },
        { key: 'playground', label: 'Playground', description: 'Sandbox de agentes' }
    ];
    let _agents = [
        { key: 'CoffeeIA.md',            label: 'CoffeeIA',           description: 'Framework y módulos' },
        { key: 'CoffeeMagic.md',         label: 'CoffeeMagic',        description: 'Templates y UI' },
        { key: 'coffee-intelligence.md', label: 'CoffeeIntelligence', description: 'Modelado de datos' }
    ];

    function broadcast() {
        try { global.dispatchEvent(new CustomEvent(EVT, { detail: { tools: _tools || [] } })); } catch (e) {}
    }

    function post(data) {
        return global.jQuery.post(API, data).then(function (res) {
            if (!res || res.success === false) {
                throw new Error((res && res.message) || 'La operación no se completó');
            }
            return res;
        });
    }

    // Carga el catálogo. `force` reconsulta aunque ya esté cacheado.
    function load(force) {
        if (_loading && !force) return _loading;
        if (_tools && !force) return global.jQuery.Deferred().resolve(_tools).promise();

        _loading = global.jQuery.get(API, { action: 'list' })
            .then(function (res) {
                _tools = (res && res.tools) || [];
                if (res && res.surfaces && res.surfaces.length) _surfaces = res.surfaces;
                if (res && res.agents && res.agents.length) _agents = res.agents;
                _loading = null;
                broadcast();
                return _tools;
            })
            .catch(function () {
                _tools = _tools || [];
                _loading = null;
                return _tools;
            });
        return _loading;
    }

    function getTools() { return _tools || []; }
    function isLoaded() { return _tools !== null; }
    function getTool(id) {
        const list = getTools();
        for (let i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
        return null;
    }
    function getByName(name) {
        const list = getTools();
        for (let i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
        return null;
    }
    function actives() { return getTools().filter(function (t) { return Number(t.active) === 1; }); }
    function categories() {
        const out = [];
        getTools().forEach(function (t) {
            const c = t.category || 'Otras';
            if (out.indexOf(c) === -1) out.push(c);
        });
        return out.sort();
    }

    // ── Destinos (a qué chats y agentes se le declara) ───────────────────────────
    function surfaces() { return _surfaces.slice(); }
    function agents() { return _agents.slice(); }
    function surfaceLabel(key) {
        const s = _surfaces.filter(function (x) { return x.key === key; })[0];
        return s ? s.label : key;
    }
    function agentLabel(key) {
        const a = _agents.filter(function (x) { return x.key === key; })[0];
        return a ? a.label : String(key || '').replace(/\.md$/, '');
    }
    // ¿Esta tool le toca a este chat? Misma regla que el servidor: lista vacía o
    // completa = a todos.
    function appliesTo(tool, surface, agent) {
        const inList = function (list, all, value) {
            if (!value) return true;
            if (!Array.isArray(list) || !list.length || list.length === all.length) return true;
            return list.indexOf(value) !== -1;
        };
        return inList(tool.surfaces, _surfaces, surface) && inList(tool.agents, _agents, agent);
    }

    // ── Escrituras ───────────────────────────────────────────────────────────────
    function save(tool) {
        return post({
            action:      'save',
            id:          tool.id || 0,
            name:        tool.name || '',
            label:       tool.label || '',
            description: tool.description || '',
            category:    tool.category || '',
            icon:        tool.icon || 'wrench',
            method:      tool.method || 'GET',
            endpoint:    tool.endpoint || '',
            params:      JSON.stringify(tool.params || []),
            headers:     JSON.stringify(tool.headers || []),
            surfaces:    (tool.surfaces || []).join(','),
            agents:      (tool.agents || []).join(',')
        }).then(function (res) { return load(true).then(function () { return res; }); });
    }

    // Asignación rápida (sin pasar por el editor completo).
    function assign(id, surfaceKeys, agentKeys) {
        return post({
            action:   'assign',
            id:       id,
            surfaces: (surfaceKeys || []).join(','),
            agents:   (agentKeys || []).join(',')
        }).then(function (res) { return load(true).then(function () { return res; }); });
    }

    function setActive(id, on) {
        // Optimista: el switch responde de inmediato y la recarga confirma.
        const t = getTool(id);
        if (t) { t.active = on ? 1 : 0; broadcast(); }
        return post({ action: 'status', id: id, active: on ? 1 : 0 })
            .then(function (res) { return load(true).then(function () { return res; }); })
            .catch(function (err) { return load(true).then(function () { throw err; }); });
    }

    function remove(id) {
        return post({ action: 'delete', id: id })
            .then(function (res) { return load(true).then(function () { return res; }); });
    }

    // Prueba manual desde el editor: ejecuta la tool con argumentos de ejemplo.
    function test(tool, args) {
        return post({
            action:   'test',
            id:       tool.id || 0,
            name:     tool.name || '',
            label:    tool.label || '',
            method:   tool.method || 'GET',
            endpoint: tool.endpoint || '',
            params:   JSON.stringify(tool.params || []),
            headers:  JSON.stringify(tool.headers || []),
            args:     JSON.stringify(args || {})
        });
    }

    // Schema que verá el modelo, armado con lo que hay en el formulario (preview).
    function buildSchema(tool) {
        const props = {};
        const required = [];
        (tool.params || []).forEach(function (p) {
            if (!p.name) return;
            props[p.name] = { type: p.type || 'string', description: p.description || '' };
            if (p.required) required.push(p.name);
        });
        return {
            type: 'function',
            function: {
                name: tool.name || 'sin_nombre',
                description: tool.description || '',
                parameters: { type: 'object', properties: props, required: required }
            }
        };
    }

    // Íconos disponibles para una herramienta (lucide).
    const ICONS = ['wrench', 'globe', 'search', 'database', 'folder-tree', 'file-text', 'code-2',
                   'terminal', 'mail', 'message-circle', 'calendar', 'image', 'calculator', 'zap',
                   'clock', 'bar-chart-3', 'package', 'shield', 'sparkles', 'plug', 'cloud', 'bot'];
    const PARAM_TYPES = ['string', 'number', 'integer', 'boolean', 'array', 'object'];

    global.CoffeeToolConfig = {
        API: API,
        EVENT: EVT,
        ICONS: ICONS,
        PARAM_TYPES: PARAM_TYPES,
        load: load,
        isLoaded: isLoaded,
        getTools: getTools,
        getTool: getTool,
        getByName: getByName,
        actives: actives,
        categories: categories,
        surfaces: surfaces,
        agents: agents,
        surfaceLabel: surfaceLabel,
        agentLabel: agentLabel,
        appliesTo: appliesTo,
        save: save,
        assign: assign,
        setActive: setActive,
        remove: remove,
        test: test,
        buildSchema: buildSchema
    };

    if (global.jQuery) global.jQuery(function () { load(); });
})(window);
