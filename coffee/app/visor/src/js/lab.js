/* Lab del Agente — banco de trabajo para afinar un agente probándolo.
 *
 * La tesis de esta pantalla: la configuración de un agente no se afina en un
 * formulario a ciegas, sino MIENTRAS se prueba. Por eso el panel de configuración y
 * el chat comparten pantalla, sin modales de por medio: mueves el prompt, mandas un
 * mensaje, ves cómo responde, ajustas. Cuando queda bien, el botón ↑ baja esa
 * configuración al agente real — respaldando la anterior, porque ese agente ya lo
 * están usando otros chats.
 *
 * La conversación es EFÍMERA a propósito: esto es un laboratorio, no un historial.
 * Lo único que persiste es lo que guardas al agente. Para conversar en serio está
 * CoffeeIA.
 *
 * A la derecha vive el mismo SANDBOX del Playground: un agente no se afina solo
 * leyendo su prosa, y si lo que produce es una pantalla hay que verla renderizada
 * para juzgarla. Cuando la respuesta trae un componente, el chat muestra la card
 * "Conjurando…" en vez de escupir el código y el resultado se pinta en el iframe.
 *
 * Datos: ctrl/ctrl-agents.php sobre data/agents.sqlite (el mismo registro que
 * administra agents.php). Chat: ctrl/ctrl-coffeeia-stream.php, el motor del visor.
 */
(function () {
    'use strict';

    const API        = 'ctrl/ctrl-agents.php';
    const API_STREAM = 'ctrl/ctrl-coffeeia-stream.php';
    const API_CHAT   = 'ctrl/ctrl-coffeeia.php';
    const API_VISOR  = 'ctrl/ctrl-visor.php';

    // Presupuesto por defecto cuando el modelo no declara maxTokens en el catálogo.
    const LAB_DEFAULT_MAX_TOKENS = 128000;
    // Mensajes finales que se conservan literales al compactar.
    const LAB_COMPACT_KEEP = 4;
    const LAB_SANDBOX_KEY  = 'lab:sandbox:v1';

    /* Sistemas de diseño que el sandbox sabe renderizar. Gemelo del catálogo del
     * Playground —mismas claves y mismos assets— para que un componente se vea
     * idéntico en las dos pantallas:
     *   grimoire  → grimorio que se INYECTA al agente para que use sus clases
     *   cssUrls   → hojas a cargar en el iframe (relativas a lab.php)
     *   cssFrom   → grimorio del que EXTRAER el <style> embebido (Coffee-Varoch)
     *   data      → valor de data-theme en <html>
     *   bodyClass → clase en <body> (Coffee-Varoch usa .coffee-varoch)
     *   bg/fg     → colores base del lienzo
     *   note      → directiva breve que se le pasa al agente */
    const LAB_THEMES = {
        'huubie-ui': {
            label: 'Huubie UI (dark)', grimoire: 'grimorio-huubie-ui.md',
            cssUrls: ['src/css/ui-kit.css'], cssFrom: null,
            data: 'dark', bodyClass: '', bg: '#111928', fg: '#E5E7EB',
            note: 'Sistema Huubie UI: usa clases .cs-* y tokens del grimorio. Tema DARK único (no generes toggle light/dark).'
        },
        'coffeesoft-light': {
            label: 'CoffeeSoft · Arcilla Invernal', grimoire: 'grimorio-coffeesoft.md',
            cssUrls: ['../../../inventory/src/css/colors.css', '../../../inventory/src/css/color-palette.css'],
            jsUrls: ['../../../inventory/src/js/tailwind-theme.js'], cssFrom: null,
            data: '', bodyClass: '', bg: '#F2F5F9', fg: '#1A1A1A',
            note: 'Sistema CoffeeSoft "Arcilla Invernal": Tailwind con la escala blue REMAPEADA a terracota (bg-blue-600 = #C05A40, hover blue-700 = #A84A33) — usa clases blue-* y rendirán terracota, NUNCA azul. También dispones de las variables --primary/--secondary y utilidades .btn-*/.badge-*/.alert-* de color-palette.css. Tema LIGHT únicamente (fondo #F2F5F9, cards #FAFCFF). No generes toggle ni variante oscura.'
        },
        'coffee-varoch-light': {
            label: 'Coffee-Varoch (light)', grimoire: 'grimorio-coffee-varoch.md',
            cssUrls: [], cssFrom: 'grimorio-coffee-varoch.md',
            data: '', bodyClass: 'coffee-varoch', bg: '#F2F5F9', fg: '#0f172a',
            note: 'Sistema Coffee-Varoch (Grupo Varoch): usa clases .cv-* y el <body class="coffee-varoch">. Tema LIGHT.'
        },
        'coffee-varoch-dark': {
            label: 'Coffee-Varoch (dark)', grimoire: 'grimorio-coffee-varoch.md',
            cssUrls: [], cssFrom: 'grimorio-coffee-varoch.md',
            data: 'dark', bodyClass: 'coffee-varoch', bg: '#0E1521', fg: '#E5E7EB',
            note: 'Sistema Coffee-Varoch (Grupo Varoch): clases .cv-* con <body class="coffee-varoch" data-theme="dark">. Tema DARK.'
        },
        'free': {
            label: 'Libre (sin paleta)', grimoire: null,
            cssUrls: [], cssFrom: null,
            data: '', bodyClass: '', bg: '#F8FAFC', fg: '#0F172A',
            note: 'Sin sistema de diseño impuesto. El lienzo es CLARO por defecto: NO generes un componente en tema oscuro salvo que el usuario lo pida explícitamente.'
        }
    };
    const LAB_DEFAULT_THEME = 'huubie-ui';

    /* El agente tiende a devolver maquetas inertes (solo markup) y entonces el
     * template "no hace nada" en el sandbox. Esta nota le exige el JS que cablea
     * la interacción dentro del MISMO bloque ```html; el iframe ejecuta los
     * <script> embebidos, así que basta con que vengan en la respuesta. */
    const LAB_INTERACTIVITY_NOTE =
          '\n\n## Funcionalidad obligatoria (no es una maqueta)\n'
        + 'El componente debe FUNCIONAR, no solo verse. Incluye SIEMPRE, dentro del mismo bloque ```html, '
        + 'un `<script>` con JavaScript vanilla (sin jQuery ni dependencias externas) que conecte TODA la '
        + 'interacción que el diseño implique: tabs, abrir/cerrar modales y dropdowns, acordeones, toggles, '
        + 'steppers, búsqueda/filtrado, validación básica, cálculos en vivo. Reglas:\n'
        + '- Usa `addEventListener` y `querySelector`/`data-*`; evita IDs globales que choquen.\n'
        + '- El `<script>` va al final del componente y se autoejecuta (IIFE o `DOMContentLoaded`).\n'
        + '- Si insertas iconos Lucide dinámicamente, llama a `window.lucide && lucide.createIcons()` tras inyectarlos.\n'
        + '- El resultado se renderiza en un lienzo a PANTALLA COMPLETA: empieza el markup con un contenedor '
        + '`<div class="w-full min-h-screen ...">` que llene el lienzo de borde a borde. Si el diseño ES una '
        + 'tarjeta pequeña, ENVUÉLVELA en ese contenedor con `flex items-center justify-center`.\n'
        + '- Si es un modal, el overlay (`fixed inset-0`) debe llevar `overflow-y-auto` y la tarjeta `my-8`.\n'
        + '- NO agregues un toggle de tema claro/oscuro.\n'
        + '- Si no hay datos reales, usa datos de muestra para que la interacción sea demostrable.';

    // Versiones viejas del template que ya no viajan al modelo (ver payloadMessages).
    const LAB_HTML_OMITTED = '[versión anterior del template omitida por brevedad; la versión VIGENTE es el último bloque de código HTML de la conversación]';
    const LAB_HTML_FENCE   = /```[ \t]*html[ \t]*\r?\n?[\s\S]*?```/gi;

    const LAB = {
        agents:   [],
        current:  null,     // ficha completa del agente abierto
        history:  [],       // conversación efímera [{role, content}]
        split:    { parts: [], level: 2 },
        sending:  false,
        dirty:    false,
        ctxReal:  0,        // tokens que reportó el servidor en el último turno
        spend:    { tokens: 0, cost: 0 },
        uiTheme:  'dark',

        // ── Sandbox ──
        theme:       LAB_DEFAULT_THEME,   // sistema de diseño del iframe
        canvas:      false,               // modo lienzo: exige componente renderizable
        sandboxOn:   true,                // panel derecho visible
        sbCollapsed: false,               // plegado a una franja (sigue visible)
        lastHtml:    '',                  // último render (descargar / abrir en pestaña)
        lastTheme:   LAB_DEFAULT_THEME,
        lastIsDoc:   false,
        templates:   [],                  // renders de la sesión: {id, html, theme, themeLabel, title}
        activeTplId: null,
        pinnedTplId: null,                // template FIJADO: el próximo mensaje lo modifica
        lastUserText: '',                 // titula las miniaturas
        splitW:      '',
        grimoires:   {},                  // file -> {file, raw, fullPath}
        libraryReq:  null,
        varochCss:   '',                  // CSS embebido extraído del grimorio Coffee-Varoch
        abort:       null,                // AbortController del turno en curso
        aborted:     false                // el turno lo cortó el usuario, no un fallo
    };

    /* pg-core.js —viewport y zoom del preview— es el motor COMPARTIDO con el
     * Playground y el Forge, y habla con la página anfitriona por un global `pg`
     * más dos hooks opcionales. El Lab no tiene ese objeto: aquí se le monta el
     * mínimo del contrato para no duplicar el motor. */
    window.pg = window.pg || { viewport: 'full', zoom: 100 };
    window.pgSaveSettings      = saveSandboxPrefs;
    window.pgOnViewportApplied = onViewportApplied;

    const esc = (v) => String(v === null || v === undefined ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const fmt = (n) => {
        n = Number(n || 0);
        return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
    };

    const initials = (name) => {
        const words = String(name || '?').replace(/[^A-Za-zÁÉÍÓÚÑ0-9 ]/g, '').split(' ').filter(Boolean);
        if (words.length > 1) return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
        const word = words[0] || '?';
        const caps = word.match(/[A-ZÁÉÍÓÚÑ]/g) || [];
        return (caps.length > 1 ? caps.slice(0, 2).join('') : word.slice(0, 2)).toUpperCase();
    };

    function toast(msg, kind) {
        const $t = $('#labToast');
        $t.removeClass('show error ok').addClass(kind === 'error' ? 'error' : 'ok').text(msg).addClass('show');
        setTimeout(() => $t.removeClass('show'), 3200);
    }

    function icons() {
        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    }

    function post(data) {
        return $.post(API, data).then(function (res) {
            if (!res || res.success === false) throw new Error((res && res.message) || 'La operación no se completó');
            return res;
        }).catch(function (err) {
            throw new Error((err && err.responseJSON && err.responseJSON.message) || (err && err.message) || 'Sin conexión con el servidor');
        });
    }

    function md(text) {
        if (window.IARender) {
            // Historias de usuario sin cercar: se envuelven para que postProcess
            // las convierta en la tarjeta en vez de dejarlas como YAML crudo.
            return IARender.markdownToHtml(IARender.normalizeErsYaml(IARender.normalizeStoriesYaml(String(text || ''))));
        }
        return '<p>' + esc(text).replace(/\n/g, '<br>') + '</p>';
    }

    /* postProcess transforma el mensaje YA MONTADO en el DOM (vista previa de HTML,
     * diagramas, botones de copiar): va despues de insertar, no sobre el string. */
    function enhance($body) {
        if (window.IARender && $body && $body.length) {
            try { IARender.postProcess($body); } catch (e) {}
        }
    }

    /* ═══════════════════════ Carga ═══════════════════════ */

    function loadAgents(pickId) {
        return post({ action: 'list' }).then(function (res) {
            LAB.agents = (res.agents || []).filter(a => a.active === 1);
            renderAgentMenu();
            const id = pickId || labRememberedId() || (LAB.agents.length ? LAB.agents[0].id : 0);
            if (id) return openAgent(id);
            $('#labAgentLabel').text('Sin agentes');
        }).catch(e => toast(e.message, 'error'));
    }

    function labRememberedId() {
        try {
            const id = Number(localStorage.getItem('lab:agent') || 0);
            return LAB.agents.some(a => a.id === id) ? id : 0;
        } catch (e) { return 0; }
    }

    function openAgent(id) {
        return post({ action: 'get', id: id }).then(function (res) {
            LAB.current = res;
            LAB.history = [];
            LAB.ctxReal = 0;
            // El render se conserva —sirve para probar otro agente sobre el mismo
            // template— pero las miniaturas se van con los mensajes que las
            // contenían: su registro no debe quedar huérfano.
            LAB.templates   = [];
            LAB.activeTplId = null;
            LAB.pinnedTplId = null;
            try { localStorage.setItem('lab:agent', String(id)); } catch (e) {}
            renderConfig();
            renderMessages();
            renderPinBanner();
            setDirty(false);
        }).catch(e => toast(e.message, 'error'));
    }

    /* ═══════════════════════ Panel de configuración ═══════════════════════ */

    function renderConfig() {
        const c = LAB.current;
        if (!c) return;
        const a = c.agent;

        $('#labAgentAvatar').text(initials(a.name));
        $('#labAgentLabel').text(a.name);
        $('#labChatAgent').text(a.name);
        $('#labRestore').toggleClass('hidden', !c.has_backup);

        $('#labPrompt').val(a.prompt_system);
        $('#labSoul').val(a.soul);
        $('#labTemp').val(a.temperature);
        $('#labTempVal').text(Number(a.temperature).toFixed(2));

        renderModelSelect(a.model);
        renderEffort(a.effort);
        renderRules();
        renderMemories();
        renderTools();
        $('.lab-ta').each(function () { updateCount(this); });
        updateCtxBar();
        icons();
    }

    function renderModelSelect(model) {
        const $sel = $('#labModel');
        if (window.CoffeeModelConfig) {
            CoffeeModelConfig.applyToSelect($sel[0]);
        } else if (!$sel.children().length) {
            $sel.append('<option value="glm-5.2:cloud">GLM 5.2</option>');
        }
        // El modelo del agente puede no estar en el catálogo habilitado: se agrega
        // para no perderlo silenciosamente al abrir su ficha.
        if (model && !$sel.find('option[value="' + model.replace(/"/g, '\\"') + '"]').length) {
            $sel.append('<option value="' + esc(model) + '">' + esc(model) + ' (del agente)</option>');
        }
        // Sin modelo en el agente se toma el activo global y, si tampoco lo hay, el
        // primero del catálogo. Se busca `option` y no `children`: applyToSelect
        // agrupa en <optgroup>, y el primer hijo sería el grupo, no un modelo.
        $sel.val(model || (window.CoffeeModelConfig ? CoffeeModelConfig.getActive() : ''));
        if (!$sel.val() && $sel.find('option[value="glm-5.2:cloud"]').length) $sel.val('glm-5.2:cloud');
        if (!$sel.val()) $sel.val($sel.find('option').first().val() || '');
        updateModelBadge();
    }

    function modelDef() {
        const id = $('#labModel').val();
        return (window.CoffeeModelConfig && id) ? CoffeeModelConfig.getModel(id) : null;
    }

    function updateModelBadge() {
        const m = modelDef();
        const max = (m && m.maxTokens) || LAB_DEFAULT_MAX_TOKENS;
        $('#labModelBadge').text(fmt(max) + ' tok');
    }

    /* Solo se ofrecen los niveles que el modelo declara aceptar: un selector con
     * opciones que el proveedor ignora es peor que no tenerlo. */
    function renderEffort(current) {
        const m = modelDef();
        const levels = (m && m.effortLevels) || [];
        const $row = $('#labEffortRow');
        const $box = $('#labEffort').empty();

        if (!levels.length) { $row.addClass('hidden'); return; }
        $row.removeClass('hidden');

        ['off'].concat(levels).forEach(function (lv) {
            const label = lv === 'off' ? 'auto' : lv;
            const on = (current || '') === lv || (!current && lv === 'off');
            $box.append('<button type="button" class="lab-eff' + (on ? ' on' : '') + '" data-eff="' + lv + '">' + label + '</button>');
        });
    }

    function currentEffort() {
        const $on = $('#labEffort .lab-eff.on');
        const v = $on.length ? $on.data('eff') : '';
        return v === 'off' ? '' : v;
    }

    function renderRules() {
        const c = LAB.current;
        const all = (c.rules || []).concat(c.borrowed || []);
        const active = all.filter(r => r.active === 1);
        $('#labRulesMeta').text(active.length ? active.length + ' activas · ' + fmt(c.budget.index_tokens) + ' tok de índice' : 'sin reglas');

        const $l = $('#labRules').empty();
        if (!all.length) {
            $l.append('<p class="lab-hint">Este agente no tiene reglas. Pega un documento y divídelo, o súbelas desde Agentes.</p>');
            return;
        }

        all.forEach(function (r) {
            const borrowed = !!r.owner;
            $l.append(
                '<div class="lab-rule' + (r.active ? '' : ' is-off') + (borrowed ? ' is-borrowed' : '') + '">' +
                    '<i data-lucide="' + (borrowed ? 'file-symlink' : 'file-text') + '" class="w-3.5 h-3.5"></i>' +
                    '<span class="lab-rule-name">' + esc(r.name) + '</span>' +
                    '<span class="lab-rule-size">' + fmt(r.tokens) + '</span>' +
                '</div>'
            );
        });
        icons();
    }

    function renderMemories() {
        const mem = LAB.current.memories || [];
        $('#labMemMeta').text(mem.length ? mem.length + ' hechos' : 'sin memorias');

        const $l = $('#labMem').empty();
        if (!mem.length) {
            $l.append('<p class="lab-hint">El agente las guarda solo con <code>save_memory</code>; aquí puedes sembrar las primeras.</p>');
            return;
        }
        mem.forEach(function (m) {
            $l.append(
                '<div class="lab-mem-row">' +
                    '<span class="lab-mem-id">[' + m.id + ']</span>' +
                    '<span class="lab-mem-text">' + esc(m.content) + '</span>' +
                    '<button class="lab-mem-del" data-id="' + m.id + '" title="Olvidar">' +
                        '<i data-lucide="x" class="w-3 h-3"></i></button>' +
                '</div>'
            );
        });
        icons();
    }

    function renderTools() {
        const tools = LAB.current.tools || [];
        const $l = $('#labTools').empty();
        const groups = {};
        tools.forEach(t => { (groups[t.category || 'Otras'] = groups[t.category || 'Otras'] || []).push(t); });

        Object.keys(groups).sort().forEach(function (g) {
            const $g = $('<div class="lab-tool-group"></div>').append('<h5>' + esc(g) + '</h5>');
            groups[g].forEach(function (t) {
                $g.append(
                    '<label class="lab-tool' + (t.active ? '' : ' is-off') + '" title="' + esc(t.name) + '">' +
                        '<input type="checkbox" class="lab-tool-cb" value="' + esc(t.name) + '"' + (t.assigned ? ' checked' : '') + '>' +
                        '<i data-lucide="' + esc(t.icon || 'wrench') + '" class="w-3.5 h-3.5"></i>' +
                        '<span>' + esc(t.label || t.name) + '</span>' +
                    '</label>'
                );
            });
            $l.append($g);
        });
        updateToolsMeta();
        icons();
    }

    function updateToolsMeta() {
        $('#labToolsMeta').text($('.lab-tool-cb:checked').length + ' activas');
    }

    function enabledTools() {
        return $('.lab-tool-cb:checked').map(function () { return this.value; }).get();
    }

    function updateCount(el) {
        $(el).closest('.lab-ta-wrap').find('.lab-ta-count').text(Number(el.value.length).toLocaleString('es-MX'));
    }

    function setDirty(on) {
        LAB.dirty = !!on;
        $('#labDirty').toggleClass('hidden', !on);
        $('#labSave').toggleClass('is-dirty', !!on);
    }

    /* ═══════════════════════ Anillo de contexto ═══════════════════════ */

    /* Estimación de lo que pesa el turno: prompt + alma + índice de reglas +
     * memoria + specs de las tools + historial + lo que hay escrito. Se toma el
     * mayor entre la estimación y lo que el servidor reportó de verdad, porque el
     * loop de herramientas infla el contexto del lado del servidor y desde aquí no
     * se ve. */
    function updateCtxBar() {
        const c = LAB.current;
        if (!c) return;

        const max = (modelDef() && modelDef().maxTokens) || LAB_DEFAULT_MAX_TOKENS;
        let chars = ($('#labPrompt').val() || '').length + ($('#labSoul').val() || '').length;
        chars += (c.budget.index_tokens + c.budget.memory_tokens) * 4;
        chars += enabledTools().length * 400;   // ~100 tokens de spec por herramienta
        LAB.history.forEach(m => { chars += String(m.content || '').length; });
        chars += ($('#labInput').val() || '').length;

        const used = Math.max(Math.ceil(chars / 4), LAB.ctxReal || 0);
        const pct  = Math.min(100, used / max * 100);
        const RING = 2 * Math.PI * 8;

        $('#labCtxWrap')
            .attr('title', 'Contexto: ≈' + used.toLocaleString('es-MX') + ' / ' + max.toLocaleString('es-MX') + ' tokens')
            .toggleClass('warn', pct >= 60 && pct < 85)
            .toggleClass('danger', pct >= 85);
        $('#labCtxFill').css('stroke-dashoffset', (RING * (1 - pct / 100)).toFixed(2));
        $('#labCtxPct').text(Math.round(pct) + '%');
        LAB.ctxPct = pct;
    }

    /* Comprime la cabecera de la conversación con el propio modelo y conserva los
     * últimos intercambios literales. Corre ENTRE turnos: dentro de uno no se puede,
     * porque ahí el contexto lo infla el servidor. */
    function compactContext(auto) {
        if (LAB.compacting) return Promise.resolve(false);
        if (LAB.history.length <= LAB_COMPACT_KEEP + 1) {
            if (!auto) toast('No hay suficiente conversación que compactar');
            return Promise.resolve(false);
        }

        LAB.compacting = true;
        const cut  = LAB.history.length - LAB_COMPACT_KEEP;
        const head = LAB.history.slice(0, cut);
        const tail = LAB.history.slice(cut);

        const transcript = head.map(function (m) {
            let t = String(m.content || '').trim();
            if (t.length > 1500) t = t.slice(0, 1500) + '…';
            return (m.role === 'user' ? 'Usuario' : 'Agente') + ': ' + t;
        }).join('\n\n');

        return oneShot(
            'Resume la conversación conservando decisiones tomadas, datos concretos y acuerdos. ' +
            'Escribe en viñetas, sin preámbulo. Es un resumen que otro agente leerá para continuar el trabajo.',
            transcript
        ).then(function (summary) {
            if (!summary || !summary.trim()) throw new Error('sin resumen');
            LAB.history = [{ role: 'user', content: '[Resumen de lo anterior]\n' + summary.trim() }].concat(tail);
            renderMessages();
            LAB.ctxReal = 0;
            updateCtxBar();
            toast(auto ? 'Conversación compactada automáticamente' : 'Conversación compactada');
            return true;
        }).catch(function () {
            if (!auto) toast('No se pudo compactar', 'error');
            return false;
        }).always(function () { LAB.compacting = false; });
    }

    /* ═══════════════════════ Llamada de un solo turno ═══════════════════════ */

    /* Para "Mejorar" y para el resumen del compactado: sin cerebro, sin herramientas
     * y sin agente, así no ensucia el contexto ni dispara el loop. */
    function oneShot(system, user) {
        return $.ajax({
            url: API_CHAT,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                messages:       [{ role: 'user', content: user }],
                systemOverride: system,
                model:          $('#labModel').val(),
                surface:        'lab'
            })
        }).then(res => (res && res.reply) || '');
    }

    function busy(sel, fn) {
        const $b = $(sel);
        const old = $b.html();
        $b.prop('disabled', true).addClass('is-busy');
        return $.when(fn()).always(function () {
            $b.prop('disabled', false).removeClass('is-busy').html(old);
            icons();
        });
    }

    function improve(taSel, btnSel, kind) {
        const current = $(taSel).val().trim();
        const system = kind === 'soul'
            ? 'Eres experto en diseño de personalidad para agentes. Reescribe la descripción de personalidad del usuario: tono, trato, manías y firma, en pocas líneas y sin instrucciones técnicas. Conserva su intención. Responde SOLO con el texto, sin comillas ni comentarios.'
            : 'Eres experto en prompt engineering. Mejora el prompt de sistema del usuario: claro, estructurado (rol, objetivo, instrucciones, restricciones) y accionable, conservando su intención. Responde SOLO con el prompt mejorado, sin comentarios, sin comillas ni bloques de código.';
        const seed = current || (kind === 'soul'
            ? 'Define una personalidad para un agente del ecosistema CoffeeSoft.'
            : 'Crea un prompt de sistema base para un agente de IA del ecosistema CoffeeSoft.');

        return busy(btnSel, function () {
            return oneShot(system, seed).then(function (out) {
                if (out && out.trim()) {
                    $(taSel).val(out.trim());
                    updateCount($(taSel)[0]);
                    setDirty(true);
                    updateCtxBar();
                    toast('Reescrito — revísalo antes de guardar');
                } else {
                    toast('El modelo no devolvió texto', 'error');
                }
            }).catch(() => toast('No se pudo reescribir', 'error'));
        });
    }

    /* ═══════════════════════ Guardar / Restaurar ═══════════════════════ */

    function saveConfig() {
        const c = LAB.current;
        if (!c) return;
        const a = c.agent;

        if (!window.confirm(
            'Vas a modificar la configuración REAL de "' + a.name + '", la que usan todos los chats.\n' +
            'La actual queda respaldada y podrás volver a ella.\n\n¿Guardar?'
        )) return;

        busy('#labSave', function () {
            return post({
                action:        'configSave',
                id:            a.id,
                prompt_system: $('#labPrompt').val(),
                soul:          $('#labSoul').val(),
                model:         $('#labModel').val(),
                temperature:   $('#labTemp').val(),
                effort:        currentEffort(),
                tools:         enabledTools().join(',')
            }).then(function (res) {
                setDirty(false);
                $('#labRestore').removeClass('hidden');
                $('#labSaveMsg').text('✓ ' + res.message).addClass('ok');
                setTimeout(() => $('#labSaveMsg').text('').removeClass('ok'), 3000);
                return openAgent(a.id);
            }).catch(function (e) {
                $('#labSaveMsg').text(e.message).addClass('err');
                setTimeout(() => $('#labSaveMsg').text('').removeClass('err'), 4000);
            });
        });
    }

    function restoreConfig() {
        const c = LAB.current;
        if (!c) return;
        if (!window.confirm('¿Volver a la configuración anterior de "' + c.agent.name + '"?')) return;

        busy('#labRestore', function () {
            return post({ action: 'configRestore', id: c.agent.id }).then(function (res) {
                toast(res.message);
                return openAgent(c.agent.id);
            }).catch(e => toast(e.message, 'error'));
        });
    }

    /* ═══════════════════════ Chat ═══════════════════════ */

    function renderMessages() {
        const $m = $('#labMessages').empty();

        if (!LAB.history.length) {
            const a = LAB.current ? LAB.current.agent : null;
            const bits = [];
            if (a && LAB.current.budget.fixed_tokens) bits.push(fmt(LAB.current.budget.fixed_tokens) + ' tokens de contexto fijo');
            if (a) bits.push(((LAB.current.rules || []).length + (LAB.current.borrowed || []).length) + ' reglas disponibles');

            $m.append(
                '<div class="pg-empty">' +
                    '<i data-lucide="microscope"></i>' +
                    '<div class="pg-empty-title">' + esc(a ? a.name : 'Selecciona un agente') + '</div>' +
                    '<div class="pg-empty-sub">' +
                        esc(a && a.description ? a.description : 'Prueba una instrucción y ajusta su configuración con lo que veas.') +
                        (bits.length ? '<br><span class="lab-empty-meta">' + esc(bits.join(' · ')) + '</span>' : '') +
                    '</div>' +
                '</div>'
            );
            icons();
            return;
        }

        // Al repintar el historial (tras compactar) los turnos que trajeron un
        // template vuelven a mostrar solo su prosa: el markup vive en el sandbox,
        // no en la conversación.
        LAB.history.forEach(function (m) {
            if (m.role === 'user') { $m.append(bubbleUser(m.content)); return; }
            $m.append(bubbleAI(md(htmlBlocks(m.content).length ? withRenderNote(m.content) : m.content)));
        });
        $m.find('.ia-msg.ai .ia-msg-text').each(function () { enhance($(this)); });
        scrollDown();
    }

    /* Burbujas con el markup del Visor y el Playground: .ia-msg user|ai. Igualarlas
     * no es cosmético — el markdown, las tablas, el código y la vista previa de HTML
     * cuelgan de .ia-msg-text, así que replicarlo con clases propias significaba
     * mantener dos veces el mismo estilo. */
    function bubbleUser(text) {
        return '<div class="ia-msg user"><div class="ia-msg-text"><p>' +
               esc(text).replace(/\n/g, '<br>') + '</p></div></div>';
    }

    function bubbleAI(html, id) {
        const name = LAB.current ? LAB.current.agent.name : 'Agente';
        return '<div class="ia-msg ai"' + (id ? ' id="' + id + '"' : '') + '>' +
                   '<div class="ia-msg-role"><span class="dot"></span><span>' + esc(name) + '</span></div>' +
                   '<div class="ia-msg-text">' + html + '</div>' +
               '</div>';
    }

    /* Mismo loader del Playground: el punto que muta de forma y color. Su CSS se
     * inyecta una vez (el keyframe no vive en ninguna hoja). */
    function loader(text) {
        if (!document.getElementById('coffeeia-loader-css')) {
            const style = document.createElement('style');
            style.id = 'coffeeia-loader-css';
            style.textContent = '@keyframes coffeeiaQuantum{0%{border-radius:50%;transform:translate(0,0);background:#ec4899}25%{background:#3b82f6}50%{border-radius:40% 60% 50% 50%;transform:translate(1px,-1px);background:#8b5cf6}75%{background:#a855f7}100%{border-radius:50%;transform:translate(0,0);background:#ec4899}}';
            document.head.appendChild(style);
        }
        return '<div class="coffeeia-loader" style="display:inline-flex;align-items:center;gap:8px">' +
                   '<div style="width:10px;height:10px;border-radius:50%;animation:coffeeiaQuantum 2s steps(8) infinite"></div>' +
                   '<span>' + esc(text || 'Pensando') + '</span>' +
               '</div>';
    }

    function scrollDown() {
        const el = document.getElementById('labMessages');
        if (el) el.scrollTop = el.scrollHeight;
    }

    function send() {
        if (LAB.sending || !LAB.current) return;
        const text = $('#labInput').val().trim();
        if (!text) return;

        const pinned = LAB.pinnedTplId ? LAB.templates.find(function (t) { return t.id === LAB.pinnedTplId; }) : null;
        LAB.lastUserText = text;
        LAB.history.push({ role: 'user', content: text });
        $('#labInput').val('').css('height', '');
        $('#labMessages').find('.pg-empty').remove();

        const $user = $(bubbleUser(text)).appendTo('#labMessages');
        if (pinned) {
            $user.find('.ia-msg-text').append(
                '<span class="ia-msg-pinref"><i data-lucide="pin" class="w-3 h-3"></i>sobre: ' + esc(pinned.title) + '</span>'
            );
        }

        const liveId = 'labLive' + Date.now();
        $('#labMessages').append(bubbleAI('', liveId));
        $('#' + liveId).find('.ia-msg-text').addClass('ia-typing-loader').html(loader('Pensando'));
        scrollDown();
        setSending(true);
        icons();

        // El prompt del agente va como systemOverride: es lo que hay EN PANTALLA, no
        // lo guardado. Sin eso no se podría probar un cambio antes de guardarlo — que
        // es el motivo de existir de esta pantalla. El cerebro (memoria + índice) lo
        // añade el servidor por agentKey.
        const payload = {
            messages:       payloadMessages(pinned),
            systemOverride: buildSystem(),
            model:          $('#labModel').val(),
            effort:         currentEffort(),
            surface:        'lab',
            agentKey:       LAB.current.agent.agent_key,
            canvasMode:     !!LAB.canvas,
            // En modo lienzo el grimorio del tema viaja como contexto anclado: sin
            // él el agente solo tiene la nota del tema, no sus clases ni tokens.
            pinnedFiles:    LAB.canvas ? themeContext() : []
        };

        let reply = '', conjuring = false, $conjSub = null;
        const $body = function () { return $('#' + liveId).find('.ia-msg-text'); };

        streamChat(payload, {
            onStatus: function (label) {
                if (!reply && !conjuring) $body().addClass('ia-typing-loader').html(loader(label));
            },
            onDelta: function (chunk) {
                reply += chunk;
                if (!conjuring && shouldConjure(reply)) {
                    conjuring = true;
                    $conjSub = enterConjuring($('#' + liveId));
                }
                if (conjuring) {
                    const lines = reply.split('\n').length;
                    if ($conjSub) $conjSub.text('Tejiendo el código · ' + lines + (lines === 1 ? ' línea' : ' líneas'));
                    return;
                }
                $body().removeClass('ia-typing-loader').html(md(reply));
                scrollDown();
            },
            onDone: function (meta) {
                const $msg = $('#' + liveId);
                leaveConjuring($msg);
                if (!reply.trim()) reply = '_(el modelo no devolvió respuesta)_';
                LAB.history.push({ role: 'assistant', content: reply });

                finalizeReply($msg, reply);
                $(metaFooter(meta)).appendTo($msg);
                $msg.find('.ia-copy-btn').on('click', function () {
                    navigator.clipboard.writeText(reply);
                    toast('Respuesta copiada');
                });

                if (meta && meta.prompt_tokens) LAB.ctxReal = Number(meta.prompt_tokens) || 0;
                addSpend(meta);
                setSending(false);
                updateCtxBar();
                maybeAutoCompact();
                icons();
                scrollDown();
            },
            onError: function (msg) {
                const $msg = $('#' + liveId);
                leaveConjuring($msg);
                // Abortar es una decisión del usuario, no un fallo: lo que llegó se
                // conserva (y se renderiza si ya era un componente).
                if (LAB.aborted) {
                    LAB.aborted = false;
                    if (reply.trim()) {
                        LAB.history.push({ role: 'assistant', content: reply });
                        finalizeReply($msg, reply);
                    } else {
                        LAB.history.pop();
                        $msg.remove();
                    }
                    toast('Generación detenida');
                } else {
                    $body().removeClass('ia-typing-loader')
                           .html('<p style="color:#F87171;margin:0;">' + esc(msg || 'Error en la respuesta') + '</p>');
                    LAB.history.pop();   // el turno no llegó a completarse
                }
                setSending(false);
                icons();
            }
        });
    }

    /* ── Card "Conjurando…" ──
     * En cuanto la respuesta empieza a ser código, el chat deja de pintar tokens y
     * muestra esta tarjeta: volcar cientos de líneas de HTML en la conversación no
     * le sirve a nadie, y el resultado se va a ver renderizado en el sandbox. */
    function shouldConjure(buf) {
        const HTML_FENCE = /```[ \t]*html/i;
        const ANY_FENCE  = /```[a-z0-9+-]+/i;
        const RAW_HTML   = /<(!doctype html|html|head|body|section|main|header|nav|article|aside|footer|form|table|ul|ol|div|button|h[1-6])[\s>]/i;
        // Sin modo lienzo solo un ```html explícito conjura: un agente de documento
        // que muestra un ```sql debe seguir viéndose como prosa en el chat.
        return HTML_FENCE.test(buf) || (LAB.canvas && (RAW_HTML.test(buf) || ANY_FENCE.test(buf)));
    }

    function enterConjuring($msg) {
        const $b = $msg.find('.ia-msg-text');
        $b.removeClass('ia-typing-loader').empty().hide();
        const $card = $(
            '<div class="ia-conjuring">' +
                '<span class="ia-conjuring-orb"><i data-lucide="wand-sparkles"></i></span>' +
                '<div class="ia-conjuring-info">' +
                    '<span class="ia-conjuring-title">Conjurando componente…</span>' +
                    '<span class="ia-conjuring-sub">Tejiendo el código</span>' +
                '</div>' +
            '</div>'
        );
        $card.insertBefore($b);
        icons();
        scrollDown();
        return $card.find('.ia-conjuring-sub');
    }

    function leaveConjuring($msg) {
        $msg.find('.ia-conjuring').remove();
        $msg.find('.ia-msg-text').show();
    }

    /* Reparte la respuesta entre el chat y el sandbox. Si trae un template
     * renderable, en la burbuja solo queda la prosa (el código se ve en el
     * sandbox y en su pestaña "Código") más la miniatura clicable. */
    function finalizeReply($msg, received) {
        const $b   = $msg.find('.ia-msg-text').removeClass('ia-typing-loader');
        const html = renderableHtml(received);

        if (!html) {
            $b.html(md(received));
            enhance($b);
            return;
        }

        $b.html(md(withRenderNote(received)));
        enhance($b);

        renderSandbox(html, false);
        const tpl = pushTemplate(html);
        if (tpl) appendTemplateCard($msg, tpl);
    }

    const LAB_RENDER_NOTE = '🪄 *Componente renderizado en el sandbox →*';

    /* La respuesta sin su código: fuera todo bloque ```…``` y, si lo que sobra
     * sigue siendo markup crudo, fuera también. Queda la explicación. */
    function proseOnly(received) {
        const rest = String(received || '').replace(/```[a-z0-9+-]*[ \t]*\r?\n?[\s\S]*?```/gi, '').trim();
        return looksLikeHtml(rest) ? '' : rest;
    }

    function withRenderNote(received) {
        const rest = proseOnly(received);
        return (rest ? rest + '\n\n' : '') + LAB_RENDER_NOTE;
    }

    /* Los mensajes que viajan al modelo. El HTML pesa: de todos los bloques
     * ```html de la conversación solo se conserva íntegro el del template VIGENTE
     * (el fijado, o el que está en el sandbox); los demás se sustituyen por una
     * marca. Sin esto cada iteración reenvía todas las versiones anteriores. */
    function payloadMessages(pinned) {
        const target  = pinned ? pinned.html : LAB.lastHtml;
        const vigente = htmlKey(target);
        let keepIdx = -1;
        for (let i = LAB.history.length - 1; i >= 0 && keepIdx === -1; i--) {
            const blocks = htmlBlocks(LAB.history[i].content);
            // Con render en el sandbox se busca ESE markup; sin render todavía vale
            // el último bloque real de la conversación.
            if (vigente ? blocks.some(function (b) { return htmlKey(b) === vigente; }) : blocks.length) keepIdx = i;
        }

        const msgs = LAB.history.map(function (m, i) {
            return {
                role: m.role,
                content: i === keepIdx ? m.content : String(m.content || '').replace(LAB_HTML_FENCE, LAB_HTML_OMITTED)
            };
        });

        const last = msgs[msgs.length - 1];
        if (vigente && keepIdx === -1 && last) {
            last.content += '\n\n=== TEMPLATE VIGENTE (el que está renderizado ahora en el sandbox) ===\n'
                + 'Es el markup sobre el que trabajas. Devuélvelo COMPLETO con el cambio aplicado.\n'
                + '```html\n' + target + '\n```';
        }
        return msgs;
    }

    // Contenido de cada fence ```html con markup de verdad (descarta las marcas
    // de omisión antiguas, que citan la secuencia del fence).
    function htmlBlocks(content) {
        const re = /```[ \t]*html[ \t]*\r?\n?([\s\S]*?)```/gi;
        const out = [];
        let m;
        while ((m = re.exec(String(content || '')))) {
            const b = m[1].trim();
            if (/<[a-z!]/i.test(b)) out.push(b);
        }
        return out;
    }

    // Clave laxa: el HTML del sandbox pasó por trim y fusión de bloques hermanos,
    // así que no coincide byte a byte con el del mensaje.
    function htmlKey(html) {
        return String(html || '').replace(/\s+/g, ' ').trim();
    }

    /* Prompt + alma tal como están en el panel. Es el equivalente a lo que el
     * servidor arma con la fila del agente, pero con lo que se está probando. */
    function buildSystem() {
        const prompt = $('#labPrompt').val().trim();
        const soul   = $('#labSoul').val().trim();
        let out = prompt || 'Eres un asistente del ecosistema CoffeeSoft. Responde en español, claro y directo.';
        if (soul) out += '\n\n## Personalidad\n' + soul;
        if (LAB.canvas) out += canvasDirective();
        return out;
    }

    /* Modo lienzo: al prompt EN PANTALLA se le anexa qué sistema de diseño usar y
     * la exigencia de que el componente funcione. Va anexado, no sustituye: lo que
     * se está afinando sigue siendo el prompt del agente. */
    function canvasDirective() {
        const t = LAB_THEMES[LAB.theme] || LAB_THEMES[LAB_DEFAULT_THEME];
        const head = t.grimoire
            ? '\n\n## Render en el sandbox del Lab\n'
              + 'Genera EXCLUSIVAMENTE el componente solicitado siguiendo el grimorio **' + t.label + '** incluido en el contexto. ' + t.note + '\n'
              + 'Devuelve UN solo bloque ```html con el componente listo para renderizar (sin explicaciones largas).'
            : '\n\n## Render en el sandbox del Lab (lienzo libre)\n'
              + 'Genera el componente solicitado con tu propio criterio de diseño. ' + (t.note || '') + '\n'
              + 'Tienes Tailwind disponible en el lienzo. Devuelve UN solo bloque ```html con el componente listo para renderizar (sin explicaciones largas).';
        return head + LAB_INTERACTIVITY_NOTE;
    }

    /* Mientras el agente genera, el botón Enviar se vuelve Detener: al pulsarlo
     * aborta el fetch y se conserva lo que ya llegó. */
    function setSending(on) {
        LAB.sending = on;
        const $btn = $('#labSend');
        if (on) {
            $btn.addClass('is-stop').attr('title', 'Detener generación')
                .html('<i data-lucide="square" class="w-3.5 h-3.5"></i>');
        } else {
            $btn.removeClass('is-stop').attr('title', 'Enviar (Enter)')
                .html('<i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>');
            LAB.abort = null;
            $('#labInput').trigger('focus');
        }
        icons();
    }

    function stopSending() {
        if (!LAB.abort) return;
        LAB.aborted = true;
        try { LAB.abort.abort(); } catch (e) {}
    }

    /* Pie de consumo con el mismo formato del Visor y el Playground: costo real si el
     * proveedor lo reporta, y si no el estimado por tokens de salida. */
    function metaFooter(meta) {
        if (!meta) return '';

        const cost = (meta.cost_usd != null && !isNaN(meta.cost_usd))
            ? '<span class="meta-item" title="Costo real del proveedor (USD)"><span class="dot"></span>Costo: <strong>' +
              (Number(meta.cost_usd) >= 0.0001 ? '$' + Number(meta.cost_usd).toFixed(4) : '&lt;$0.0001') + '</strong></span>'
            : '<span class="meta-item" title="Estimación por tokens de salida"><span class="dot"></span>Credits: <strong>' +
              (meta.credits_estimate != null ? meta.credits_estimate : '—') + '</strong></span>';

        const toks = (meta.prompt_tokens || meta.completion_tokens)
            ? '<span class="meta-item" title="Tokens entrada / salida">Tokens: <strong>' +
              fmt(meta.prompt_tokens || 0) + ' in / ' + fmt(meta.completion_tokens || 0) + ' out</strong></span>'
            : '';

        const time = '<span class="meta-item">Time: <strong>' +
                     (meta.elapsed_ms > 0 ? (meta.elapsed_ms / 1000).toFixed(1) + 's' : '—') + '</strong></span>';

        return '<div class="ia-msg-meta-footer">' + cost + toks + time +
                   '<span class="meta-actions">' +
                       '<button class="meta-iconbtn ia-copy-btn" title="Copiar respuesta"><i data-lucide="copy" class="w-3 h-3"></i></button>' +
                   '</span>' +
               '</div>';
    }

    function addSpend(meta) {
        if (!meta) return;
        LAB.spend.tokens += Number(meta.completion_tokens || 0);
        LAB.spend.cost   += Number(meta.cost_usd || 0);
        const parts = [];
        if (LAB.spend.tokens) parts.push(fmt(LAB.spend.tokens) + ' tok');
        if (LAB.spend.cost)   parts.push('$' + LAB.spend.cost.toFixed(4));
        $('#labSpend').text(parts.join(' · ') || '—');
    }

    function maybeAutoCompact() {
        if (LAB.ctxPct >= 85) compactContext(true);
    }

    /* Streaming SSE con el motor del visor. Si el proveedor no soporta streaming el
     * endpoint responde igual por eventos, así que no hace falta un segundo camino. */
    function streamChat(payload, cb) {
        const ac = new AbortController();
        LAB.abort = ac;
        fetch(API_STREAM, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
            signal: ac.signal
        }).then(function (res) {
            if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let buf = '', meta = null, event = '';

            (function pump() {
                reader.read().then(function (r) {
                    if (r.done) { cb.onDone(meta); return; }
                    buf += dec.decode(r.value, { stream: true });

                    const lines = buf.split('\n');
                    buf = lines.pop();
                    lines.forEach(function (line) {
                        line = line.replace(/\r$/, '');
                        if (line.indexOf('event:') === 0) { event = line.slice(6).trim(); return; }
                        if (line.indexOf('data:') !== 0) return;

                        const raw = line.slice(5).trim();
                        if (!raw || raw === '[DONE]') return;
                        let o; try { o = JSON.parse(raw); } catch (e) { return; }

                        // El endpoint emite `chunk` (texto), `thinking` (estado del
                        // loop de herramientas, ya entre corchetes), `done` y `error`.
                        if (event === 'chunk' && o.t)    cb.onDelta(o.t);
                        else if (event === 'thinking')   cb.onStatus(String(o.t || '').replace(/[\[\]\n]/g, '').trim() || 'trabajando…');
                        else if (event === 'done')       meta = o;
                        else if (event === 'error')      cb.onError(o.error);
                    });
                    pump();
                }).catch(function (e) { cb.onError(e.message); });
            })();
        }).catch(function (e) { cb.onError(e.message); });
    }

    /* ═══════════════════════ Sandbox ═══════════════════════ */

    function loadSandboxPrefs() {
        try {
            const s = JSON.parse(localStorage.getItem(LAB_SANDBOX_KEY) || '{}');
            if (s.theme && LAB_THEMES[s.theme])   LAB.theme     = s.theme;
            if (typeof s.canvas === 'boolean')    LAB.canvas    = s.canvas;
            if (typeof s.sandboxOn === 'boolean') LAB.sandboxOn = s.sandboxOn;
            if (typeof s.sbCollapsed === 'boolean') LAB.sbCollapsed = s.sbCollapsed;
            if (s.splitW)                         LAB.splitW    = s.splitW;
            if (typeof s.zoom === 'number')       pg.zoom       = s.zoom;
            if (s.viewport && PG_VIEWPORTS[s.viewport]) pg.viewport = s.viewport;
        } catch (e) {}
        LAB.lastTheme = LAB.theme;
    }

    function saveSandboxPrefs() {
        try {
            localStorage.setItem(LAB_SANDBOX_KEY, JSON.stringify({
                theme: LAB.theme, canvas: LAB.canvas, sandboxOn: LAB.sandboxOn,
                sbCollapsed: LAB.sbCollapsed,
                splitW: LAB.splitW, zoom: pg.zoom, viewport: pg.viewport
            }));
        } catch (e) {}
    }

    function applySandboxUI() {
        // Contraido es distinto de oculto: el panel sigue en pantalla como franja.
        // Solo aplica cuando el sandbox esta a la vista.
        const collapsed = LAB.sandboxOn && LAB.sbCollapsed;
        $('.lab-workspace').toggleClass('has-sandbox', LAB.sandboxOn)
                           .toggleClass('sb-collapsed', collapsed);
        $('#labSandboxToggle').toggleClass('is-on', LAB.sandboxOn)
            .attr('title', LAB.sandboxOn ? 'Ocultar el sandbox' : 'Mostrar el sandbox');
        $('.lab-sbtheme').toggleClass('is-off', !LAB.sandboxOn || collapsed);
        $('#labSandboxTheme').val(LAB.theme);
        if (LAB.sandboxOn && !collapsed) pgApplyZoom();
    }

    function applyCanvasUI() {
        $('#labCanvasToggle').toggleClass('is-active', LAB.canvas).attr('title', LAB.canvas
            ? 'Modo lienzo ACTIVO — el agente generará componentes HTML renderizables'
            : 'Activar modo lienzo (el agente generará componentes HTML renderizables)');
        $('#labInput').attr('placeholder', LAB.canvas
            ? 'Pídele una pantalla o componente y míralo en el sandbox…'
            : 'Prueba a tu agente aquí…');
    }

    /* Ancho del chat frente al sandbox. El chat NO empieza en el borde del
     * workspace (a su izquierda están el rail y el panel de configuración), así
     * que se mide desde donde el chat arranca de verdad. */
    function applySplit(w) {
        if (w && isFinite(parseInt(w, 10))) {
            document.documentElement.style.setProperty('--lab-chat-w', parseInt(w, 10) + 'px');
        }
    }

    function bindSplitter() {
        const $sp = $('#labSplitter');
        const $ws = $('.lab-workspace');
        if (!$sp.length || !$ws.length) return;
        let dragging = false;

        $sp.on('mousedown', function (e) {
            e.preventDefault();
            dragging = true;
            $sp.addClass('is-dragging');
            document.body.classList.add('pg-resizing');
        });
        $(document).on('mousemove.labSplit', function (e) {
            if (!dragging) return;
            const chat  = $('.lab-chat')[0];
            if (!chat) return;
            const left  = chat.getBoundingClientRect().left;
            const right = $ws[0].getBoundingClientRect().right;
            const w = Math.max(320, Math.min(right - left - 340, e.clientX - left));
            document.documentElement.style.setProperty('--lab-chat-w', w + 'px');
            LAB.splitW = w;
        });
        $(document).on('mouseup.labSplit', function () {
            if (!dragging) return;
            dragging = false;
            $sp.removeClass('is-dragging');
            document.body.classList.remove('pg-resizing');
            pgApplyZoom();
            saveSandboxPrefs();
        });
    }

    /* Hook de pg-core: al cambiar de viewport el fondo del panel cambia de dueño.
     * En móvil/laptop lo pinta el CSS (el "escritorio" alrededor del dispositivo);
     * a ancho completo vuelve a ser el color del tema, porque el iframe es
     * transparente y sin esto se vería el blanco del contenedor. */
    function onViewportApplied(mode) {
        const t = LAB_THEMES[LAB.theme] || LAB_THEMES[LAB_DEFAULT_THEME];
        $('.pg-sandbox-body').css('background', mode === 'full' ? (t.bg || '#fff') : '');
        pgApplyZoom();
    }

    function renderSandbox(html, isDoc) {
        // Llega algo que ver: el panel se abre y se despliega solo. Renderizar en una
        // franja de 34px no le sirve a nadie.
        if (!LAB.sandboxOn || LAB.sbCollapsed) {
            LAB.sandboxOn   = true;
            LAB.sbCollapsed = false;
            applySandboxUI();
            saveSandboxPrefs();
        }
        $('#pgSandboxEmpty').hide();

        LAB.lastHtml  = html;
        LAB.lastTheme = LAB.theme;
        LAB.lastIsDoc = !!isDoc;

        const t = LAB_THEMES[LAB.theme] || LAB_THEMES[LAB_DEFAULT_THEME];
        $('.pg-sandbox-body').css('background', (pg.viewport && pg.viewport !== 'full') ? '' : (t.bg || '#fff'));

        const fr = document.getElementById('pgSandboxFrame');
        fr.onload = function () { pgSyncStageViewport(); pgApplyZoom(); };
        fr.srcdoc = wrapHtml(html, LAB.theme, isDoc);

        // La pestaña "Código" refleja la fuente de lo que se está renderizando.
        const $code = $('#pgSandboxCode').find('code').removeAttr('data-highlighted').text(html);
        if (window.hljs) hljs.highlightElement($code[0]);

        $('.pg-tab[data-sbtab="preview"]').trigger('click');
    }

    function resetSandbox() {
        LAB.lastHtml    = '';
        LAB.lastIsDoc   = false;
        LAB.templates   = [];
        LAB.activeTplId = null;
        LAB.pinnedTplId = null;
        const fr = document.getElementById('pgSandboxFrame');
        if (fr) fr.srcdoc = '';
        $('#pgSandboxCode').find('code').removeAttr('data-highlighted').text('');
        $('#pgSandboxEmpty').show();
        $('.pg-sandbox-body').css('background', '');
        renderPinBanner();
    }

    /* Reune los assets del sistema de diseño: <link>, <style> embebido y <script>.
     * Las rutas se absolutizan contra lab.php porque dentro del iframe (srcdoc)
     * una ruta relativa no resuelve contra esta página. */
    function themeAssets(t) {
        const appBase = new URL('.', document.baseURI).href;
        const links = (t.cssUrls || []).map(function (u) {
            return '<link rel="stylesheet" href="' + new URL(u, document.baseURI).href + '">';
        }).join('');
        // Los scripts del tema (p.ej. tailwind-theme.js) DEBEN ir justo tras el CDN
        // de Tailwind para que su tailwind.config tenga efecto.
        const scripts = (t.jsUrls || []).map(function (u) {
            return '<script src="' + new URL(u, document.baseURI).href + '"><\/script>';
        }).join('');
        const style = (t.cssFrom === 'grimorio-coffee-varoch.md' && LAB.varochCss)
            ? '<style>' + LAB.varochCss + '</style>' : '';
        return { appBase: appBase, links: links, style: style, scripts: scripts };
    }

    /* Bridge inyectado en el <head> del preview: con el iframe sandboxeado el
     * padre no puede tocar su documento, así que el zoom y el modo edge llegan
     * por postMessage (pg-core los emite). */
    const LAB_BRIDGE_JS =
          '<script>(function(){window.addEventListener("message",function(e){var d=e.data||{};'
        + 'if(d.pgZoom!=null)document.documentElement.style.zoom=d.pgZoom;'
        + 'if(d.pgEdge!=null&&document.body)document.body.classList.toggle("pg-vp-edge",!!d.pgEdge);'
        + '});})();<\/script>';

    /* Parches del preview. El scroll horizontal del root es espurio (nace del
     * gutter de la barra vertical o de algún 100vw del template). Y un overlay
     * `fixed inset-0` se ancla al viewport del IFRAME sin generar scroll, así que
     * un modal más alto que el lienzo se recortaba arriba y abajo: aquí se hace
     * scrollable y su tarjeta se centra con margin auto, que colapsa a 0 al
     * desbordar en lugar de recortar. */
    const LAB_PREVIEW_FIX_CSS =
          'html,body{overflow-x:hidden;}'
        + '[class*="fixed"][class*="inset-0"]{overflow-y:auto;}'
        + '[class*="fixed"][class*="inset-0"] > *{margin-top:auto;margin-bottom:auto;}';

    function wrapHtml(body, themeKey, isDoc) {
        const t = LAB_THEMES[themeKey] || LAB_THEMES[LAB_DEFAULT_THEME];
        const a = themeAssets(t);
        const htmlAttr  = t.data ? ' data-theme="' + t.data + '"' : '';
        const bodyData  = (t.bodyClass && t.data) ? ' data-theme="' + t.data + '"' : '';
        const bodyClass = t.bodyClass ? ' class="' + t.bodyClass + '"' : '';

        // Documento completo: se conserva su markup, pero en su <head> se inyecta
        // el CSS del sistema (su <link> relativo suele estar roto dentro del
        // iframe), el <base> y el data-theme del tema elegido.
        if (!isDoc && pgIsFullDoc(body)) {
            let doc = body;
            if (/<html/i.test(doc)) {
                doc = doc.replace(/<html(\s[^>]*)?>/i, function (m, attrs) {
                    attrs = (attrs || '').replace(/\sdata-theme=("[^"]*"|'[^']*'|\S+)/i, '');
                    return '<html' + attrs + htmlAttr + '>';
                });
            } else {
                doc = '<html' + htmlAttr + '>' + doc + '</html>';
            }
            const inject = '<base href="' + a.appBase + '">' + LAB_BRIDGE_JS + a.scripts + a.links + a.style
                         + '<style>' + LAB_PREVIEW_FIX_CSS + '</style>';
            if (/<head(\s[^>]*)?>/i.test(doc)) {
                doc = doc.replace(/<head(\s[^>]*)?>/i, function (m) { return m + inject; });
            } else {
                doc = doc.replace(/<html(\s[^>]*)?>/i, function (m) { return m + '<head>' + inject + '</head>'; });
            }
            if (t.bodyClass) {
                if (/<body(\s[^>]*)?>/i.test(doc)) {
                    doc = doc.replace(/<body(\s[^>]*)?>/i, function (m, attrs) {
                        attrs = (attrs || '').replace(/\sdata-theme=("[^"]*"|'[^']*'|\S+)/i, '');
                        attrs = /class=/i.test(attrs)
                            ? attrs.replace(/class=("|')(.*?)\1/i, function (mm, q, c) { return 'class=' + q + c + ' ' + t.bodyClass + q; })
                            : ' class="' + t.bodyClass + '"' + attrs;
                        return '<body' + attrs + bodyData + '>';
                    });
                } else {
                    doc = doc.replace(/<\/head>/i, '</head><body class="' + t.bodyClass + '"' + bodyData + '>');
                }
            }
            return doc;
        }

        // Fragmento: se envuelve con Tailwind + el CSS del sistema. El stage ocupa
        // todo el lienzo, así que un componente con w-full lo llena y uno con
        // ancho propio (max-w-sm) se centra sin estirarse.
        const stage = isDoc
            ? 'body{display:block;padding:24px;}.lab-stage{max-width:860px;margin:0 auto;line-height:1.65;}'
              + '.lab-stage h1,.lab-stage h2,.lab-stage h3{margin:1.2em 0 .5em;font-weight:700;}'
              + '.lab-stage pre{background:rgba(0,0,0,.25);padding:12px;border-radius:8px;overflow:auto;}'
              + '.lab-stage table{border-collapse:collapse;}.lab-stage td,.lab-stage th{border:1px solid currentColor;padding:6px 10px;}'
            : 'body{min-height:100vh;}'
              + '.lab-stage{box-sizing:border-box;width:100%;min-height:100vh;padding:28px;'
              +            'display:flex;flex-direction:column;align-items:center;justify-content:flex-start;}'
              + '.lab-stage > *{width:100%;}'
              // pg-vp-edge la pone pgSyncStageViewport() (full/móvil): el template
              // ocupa el lienzo de borde a borde, sin el padding de presentación.
              + 'body.pg-vp-edge .lab-stage{padding:0;}';

        return '<!DOCTYPE html><html' + htmlAttr + '><head><meta charset="utf-8">'
            + '<base href="' + a.appBase + '">' + LAB_BRIDGE_JS
            + '<script src="https://cdn.tailwindcss.com"><\/script>'
            + a.scripts
            + '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">'
            + a.links + a.style
            + '<script src="https://unpkg.com/lucide@latest"><\/script>'
            + '<style>html,body{margin:0;}body{background:' + t.bg + ';color:' + t.fg + ';'
            + "font-family:'Inter',system-ui,sans-serif;}*{box-sizing:border-box;}" + stage + LAB_PREVIEW_FIX_CSS + '</style>'
            + '</head><body' + bodyClass + bodyData + '><div class="lab-stage">' + body + '</div>'
            + '<script>if(window.lucide)lucide.createIcons();<\/script></body></html>';
    }

    /* Librería de grimorios (.md en .claude/agents/). Se necesita para dos cosas:
     * inyectar el grimorio del tema al agente en modo lienzo, y extraer el CSS
     * embebido de Coffee-Varoch, que no tiene archivo que enlazar. Se pide una
     * sola vez y solo cuando hace falta. */
    function ensureLibrary() {
        if (LAB.libraryReq) return LAB.libraryReq;
        LAB.libraryReq = $.getJSON(API_VISOR + '?folder=agents').then(function (data) {
            ((data && data.grimoires) || []).forEach(function (f) { LAB.grimoires[f.file] = f; });
            const varoch = LAB.grimoires['grimorio-coffee-varoch.md'];
            const m = varoch && varoch.raw ? varoch.raw.match(/```css\s*\n([\s\S]*?)```/i) : null;
            if (m) LAB.varochCss = m[1];
        }).fail(function () { LAB.libraryReq = null; });
        return LAB.libraryReq;
    }

    /* Grimorio del tema activo, listo para viajar como contexto anclado. */
    function themeContext() {
        const t = LAB_THEMES[LAB.theme] || LAB_THEMES[LAB_DEFAULT_THEME];
        const f = t.grimoire ? LAB.grimoires[t.grimoire] : null;
        return f ? [{ file: f.file, fullPath: f.fullPath || '', content: f.raw || '' }] : [];
    }

    /* ── Qué se renderiza ──
     * Sin modo lienzo solo cuenta un bloque ```html explícito: así una respuesta
     * que cita un <div> al explicar algo NO pisa lo que ya está en el sandbox. */
    function renderableHtml(received) {
        const s = String(received || '');
        if (!LAB.canvas) return extractCode(s, 'html');
        const fenced = hasFencedHtml(s) ? extractHtml(s) : '';
        const raw    = (startsWithHtml(s) || isMostlyHtml(s)) ? extractHtml(s) : '';
        return fenced || patchLastHtml(s) || raw;
    }

    /* ¿Hay un bloque ```html (o un fence cuyo contenido sea HTML)? Señal fiable de
     * "componente construido" frente al ```sql de una consulta. */
    function hasFencedHtml(s) {
        if (/```[ \t]*html[ \t]*\r?\n/i.test(s || '')) return true;
        const m = /```[a-z0-9+-]*[ \t]*\r?\n?([\s\S]*?)```/i.exec(s || '');
        return !!(m && looksLikeHtml(m[1]));
    }

    /* ¿La respuesta EMPIEZA por HTML? Acepta un componente crudo sin fence y
     * descarta la prosa que solo menciona un <tag> a media explicación. */
    function startsWithHtml(s) {
        const t = String(s || '').replace(/^﻿/, '').replace(/^```[a-z0-9+-]*[ \t]*\r?\n/i, '').trim();
        return /^(<!doctype html\b|<html[\s>]|<(?:div|section|main|header|nav|article|aside|footer|form|table|ul|ol|button|h[1-6]|img|svg)[\s>])/i.test(t);
    }

    // ¿El texto es MAYORITARIAMENTE markup? Un componente trae muchos tags; un
    // plan en prosa que menciona uno o dos, no.
    function isMostlyHtml(s) {
        return (String(s || '').match(/<(?:div|section|main|header|nav|article|aside|footer|form|table|tr|td|th|ul|ol|li|button|h[1-6]|img|svg|input|label|span|p|a)\b/gi) || []).length >= 4;
    }

    function looksLikeHtml(text) {
        return /<!doctype html|<html[\s>]|<head[\s>]|<body[\s>]|<(div|section|main|header|nav|table|article|ul|ol|form|button|span|img|svg|h[1-6]|p)[\s>]/i.test(text || '');
    }

    function extractCode(text, lang) {
        const re = lang
            ? new RegExp('```' + lang + '[ \\t]*\\r?\\n?([\\s\\S]*?)```', 'i')
            : /```[a-z0-9+-]*[ \t]*\r?\n?([\s\S]*?)```/i;
        const m = String(text || '').match(re);
        return m ? m[1].trim() : '';
    }

    // Extrae HTML renderizable, tolerante a fences mal formados o markup crudo.
    function extractHtml(text) {
        const s = String(text || '');
        let m = s.match(/```[ \t]*html[ \t]*\r?\n?([\s\S]*?)```/i);
        if (m && m[1].trim()) return mergeSideBlocks(s, m[1].trim());
        m = s.match(/```[a-z0-9+-]*[ \t]*\r?\n?([\s\S]*?)```/i);
        if (m && looksLikeHtml(m[1])) return mergeSideBlocks(s, m[1].trim());
        // Fence ```html abierto y sin cerrar (respuesta truncada): tomamos lo que
        // sigue al fence, sin arrastrar el preámbulo en prosa.
        m = s.match(/```[ \t]*html[ \t]*\r?\n?([\s\S]*)$/i);
        if (m && looksLikeHtml(m[1])) return m[1].replace(/```\s*$/, '').trim();
        if (looksLikeHtml(s)) return s.replace(/```[a-z0-9+-]*[ \t]*/gi, '').trim();
        return '';
    }

    /* Fusiona el JS/CSS que el modelo dejó en bloques HERMANOS (```js / ```css,
     * fuera del ```html) dentro del propio HTML. Sin esto el template se renderiza
     * mudo: al pedir "agrégale eventos" el modelo suele contestar con el markup y
     * el script separados, y la interacción se perdía. */
    function mergeSideBlocks(src, html) {
        if (!html) return html;
        const rest = String(src || '').split(html).join(' ');   // solo lo que quedó FUERA del html
        const grab = function (re) {
            const out = [];
            let m;
            while ((m = re.exec(rest))) if (m[1].trim()) out.push(m[1].trim());
            return out;
        };
        const css = grab(/```[ \t]*css[ \t]*\r?\n?([\s\S]*?)```/gi);
        const js  = grab(/```[ \t]*(?:javascript|js)[ \t]*\r?\n?([\s\S]*?)```/gi);
        if (!css.length && !js.length) return html;

        // data-lab-merged marca lo inyectado por nosotros: patchLastHtml lo usa
        // para que un parche SUSTITUYA al anterior en vez de acumularse.
        let add = '';
        if (css.length) add += '\n<style data-lab-merged>\n' + css.join('\n') + '\n</style>';
        if (js.length)  add += '\n<script data-lab-merged>\n' + js.join('\n\n') + '\n<\/script>';
        return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, add + '\n</body>') : html + add;
    }

    /* Ajuste incremental sobre el template ya renderizado: al pedir "agrégale
     * eventos" el modelo suele contestar SOLO con el <script> del cambio, sin
     * repetir el markup. Sin esto el render se reemplazaba por el texto en
     * markdown y el template desaparecía. */
    function patchLastHtml(received) {
        if (!LAB.lastHtml) return '';
        const base    = LAB.lastHtml.replace(/\n?<(script|style) data-lab-merged>[\s\S]*?<\/\1>/gi, '');
        const patched = mergeSideBlocks(received, base);
        return patched === base ? '' : patched;
    }

    /* ── Historial de renders de la sesión ──
     * Cada componente que se vuelca al sandbox queda como miniatura clicable
     * DENTRO de la burbuja que lo generó. Vive solo en memoria: se vacía al
     * limpiar la conversación o al recargar. */
    function pushTemplate(html) {
        if (!html) return null;
        const raw = (LAB.lastUserText || '').trim();
        const tpl = {
            id:         'tpl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            html:       html,
            theme:      LAB.theme,
            themeLabel: (LAB_THEMES[LAB.theme] || {}).label || LAB.theme,
            title:      raw ? (raw.length > 46 ? raw.slice(0, 46) + '…' : raw) : 'Componente'
        };
        LAB.templates.push(tpl);
        if (LAB.templates.length > 50) LAB.templates.shift();
        LAB.activeTplId = tpl.id;
        return tpl;
    }

    function appendTemplateCard($msg, tpl) {
        if (!$msg || !$msg.length || !tpl) return;
        const pinned = tpl.id === LAB.pinnedTplId;
        const $card = $(
            '<div class="pg-chat-tpl' + (tpl.id === LAB.activeTplId ? ' is-active' : '') + '" data-tpl-id="' + tpl.id + '" title="Clic para ver en el sandbox">' +
                '<div class="pg-chat-tpl-thumb">' +
                    '<iframe class="pg-chat-tpl-frame" sandbox="allow-scripts" scrolling="no" tabindex="-1" aria-hidden="true"></iframe>' +
                '</div>' +
                '<div class="pg-chat-tpl-info">' +
                    '<span class="pg-chat-tpl-title">' + esc(tpl.title) + '</span>' +
                    '<span class="pg-chat-tpl-sub">' + esc(tpl.themeLabel) + '</span>' +
                    '<span class="pg-chat-tpl-actions">' +
                        '<button type="button" class="pg-tpl-ico pg-chat-tpl-view" title="Ver en el sandbox"><i data-lucide="eye" class="w-3.5 h-3.5"></i></button>' +
                        '<button type="button" class="pg-tpl-ico pg-chat-tpl-pin' + (pinned ? ' is-pinned' : '') + '" title="Fijar como referencia: el próximo mensaje lo modificará"><i data-lucide="pin" class="w-3.5 h-3.5"></i></button>' +
                        '<button type="button" class="pg-tpl-ico pg-chat-tpl-del" title="Quitar este render del chat"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>' +
                    '</span>' +
                '</div>' +
            '</div>'
        );
        $msg.append($card);

        const fr = $card.find('.pg-chat-tpl-frame')[0];
        if (fr) fr.srcdoc = wrapHtml(tpl.html, tpl.theme, false);

        $card.on('click', function () { restoreTemplate(tpl.id); });
        $card.find('.pg-chat-tpl-view').on('click', function (e) { e.stopPropagation(); restoreTemplate(tpl.id); });
        $card.find('.pg-chat-tpl-pin').on('click', function (e) { e.stopPropagation(); togglePin(tpl.id); });
        $card.find('.pg-chat-tpl-del').on('click', function (e) { e.stopPropagation(); deleteTemplate(tpl.id); });
        icons();
        scrollDown();
    }

    function restoreTemplate(id) {
        const t = LAB.templates.find(function (x) { return x.id === id; });
        if (!t) return;
        LAB.activeTplId = id;
        // Se restaura el tema con el que se generó: es el sistema con el que ese
        // markup tiene sentido.
        if (t.theme && LAB_THEMES[t.theme] && t.theme !== LAB.theme) {
            LAB.theme = t.theme;
            $('#labSandboxTheme').val(t.theme);
            saveSandboxPrefs();
        }
        renderSandbox(t.html, false);
        $('.pg-chat-tpl').removeClass('is-active');
        $('.pg-chat-tpl[data-tpl-id="' + id + '"]').addClass('is-active');
    }

    function deleteTemplate(id) {
        const i = LAB.templates.findIndex(function (x) { return x.id === id; });
        if (i === -1) return;
        LAB.templates.splice(i, 1);
        if (LAB.activeTplId === id) LAB.activeTplId = null;
        if (LAB.pinnedTplId === id) LAB.pinnedTplId = null;
        $('.pg-chat-tpl[data-tpl-id="' + id + '"]').remove();
        renderPinBanner();
        toast('Render quitado del chat');
    }

    function togglePin(id) {
        const t = LAB.templates.find(function (x) { return x.id === id; });
        if (!t) return;
        LAB.pinnedTplId = (LAB.pinnedTplId === id) ? null : id;
        $('.pg-chat-tpl-pin').each(function () {
            $(this).toggleClass('is-pinned', $(this).closest('.pg-chat-tpl').data('tpl-id') === LAB.pinnedTplId);
        });
        renderPinBanner();
        if (LAB.pinnedTplId) {
            if (LAB.activeTplId !== id) restoreTemplate(id);
            toast('Template fijado — el próximo mensaje lo modificará');
            $('#labInput').trigger('focus');
        } else {
            toast('Referencia liberada');
        }
    }

    /* Chip "Modificando: <título> ✕" sobre el input, solo si hay algo fijado. */
    function renderPinBanner() {
        const t = LAB.pinnedTplId ? LAB.templates.find(function (x) { return x.id === LAB.pinnedTplId; }) : null;
        $('#labPinBanner').remove();
        if (!t) return;
        const $banner = $(
            '<div id="labPinBanner" class="pg-pin-banner" title="El próximo mensaje modificará este template">' +
                '<i data-lucide="pin" class="w-3.5 h-3.5"></i>' +
                '<span class="pg-pin-banner-text">Modificando: <strong>' + esc(t.title || 'Componente') + '</strong></span>' +
                '<button type="button" class="pg-pin-banner-x" title="Liberar referencia"><i data-lucide="x" class="w-3 h-3"></i></button>' +
            '</div>'
        );
        $('.lab-chat .ia-input-wrap').prepend($banner);
        $banner.find('.pg-pin-banner-x').on('click', function () {
            LAB.pinnedTplId = null;
            $('.pg-chat-tpl-pin').removeClass('is-pinned');
            renderPinBanner();
        });
        icons();
    }

    /* ── Descargar / abrir ──
     * Ambas empaquetan el MISMO documento autocontenido que ve el iframe (tema,
     * CSS del sistema y Tailwind incluidos). */
    function downloadHtml() {
        if (!LAB.lastHtml) { toast('Aún no hay nada que descargar', 'error'); return; }
        const blob  = new Blob([wrapHtml(LAB.lastHtml, LAB.lastTheme, LAB.lastIsDoc)], { type: 'text/html;charset=utf-8' });
        const url   = URL.createObjectURL(blob);
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lab-' + (LAB.lastTheme || LAB.theme) + '-' + stamp + '.html';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        toast('HTML descargado');
    }

    function openInTab() {
        if (!LAB.lastHtml) { toast('Aún no hay nada que abrir', 'error'); return; }
        const w = window.open('', '_blank');
        if (w) { w.document.write(wrapHtml(LAB.lastHtml, LAB.lastTheme, LAB.lastIsDoc)); w.document.close(); }
    }

    function closeSbActions() {
        $('#labSbActionsPop').removeClass('is-open');
        $('#labSbActionsToggle').attr('aria-expanded', 'false').removeClass('is-active');
    }

    /* ═══════════════════════ Pegar y dividir ═══════════════════════ */

    /* Corta el markdown por encabezados del nivel elegido. Lo de antes del primer
     * encabezado se conserva como preámbulo del primer archivo: si se descartara, se
     * perdería justo la introducción del documento. */
    function splitMarkdown(text, level) {
        const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
        const re = new RegExp('^#{' + level + '}\\s+(.+)$');
        const parts = [];
        let current = null, fenced = false, preamble = [];

        lines.forEach(function (line) {
            if (/^\s*```/.test(line)) fenced = !fenced;
            const m = !fenced && line.match(re);
            if (m) {
                current = { title: m[1].trim(), body: [line] };
                parts.push(current);
                return;
            }
            if (current) current.body.push(line);
            else preamble.push(line);
        });

        if (parts.length && preamble.join('').trim()) {
            parts[0].body = preamble.concat(parts[0].body);
        }
        return parts
            .map(p => ({ title: p.title, content: p.body.join('\n').trim() }))
            .filter(p => p.content.length > 20);
    }

    function slug(text) {
        return String(text || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'seccion';
    }

    function splitScan() {
        const text = $('#labSplitText').val();
        if (!text.trim()) { splitMsg('Pega primero el documento', true); return; }

        LAB.split.parts = splitMarkdown(text, LAB.split.level).map(function (p) {
            return { name: slug(p.title) + '.md', title: p.title, content: p.content, on: true };
        });
        renderSplitList();
    }

    function renderSplitList() {
        const $l = $('#labSplitList').empty();
        const parts = LAB.split.parts;

        if (!parts.length) {
            $l.append('<p class="lab-hint">Sin secciones en ese nivel. Prueba con otro encabezado.</p>');
            $('#labSplitCreate').prop('disabled', true);
            splitMsg('No se encontró ningún encabezado H' + LAB.split.level, true);
            return;
        }

        parts.forEach(function (p, i) {
            $l.append(
                '<label class="lab-split-item">' +
                    '<input type="checkbox" class="lab-split-cb" data-i="' + i + '"' + (p.on ? ' checked' : '') + '>' +
                    '<span class="lab-split-name">' + esc(p.name) + '</span>' +
                    '<span class="lab-split-title">' + esc(p.title) + '</span>' +
                    '<span class="lab-meter">' + fmt(Math.round(p.content.length / 4)) + ' tok</span>' +
                '</label>'
            );
        });
        splitCount();
    }

    function splitCount() {
        const on = LAB.split.parts.filter(p => p.on);
        $('#labSplitCreate').prop('disabled', !on.length);
        splitMsg(on.length
            ? on.length + ' archivo(s) · ' + fmt(Math.round(on.reduce((s, p) => s + p.content.length, 0) / 4)) + ' tokens en total'
            : 'Marca al menos una sección');
    }

    function splitMsg(text, isError) {
        $('#labSplitMsg').text(text || '—').toggleClass('err', !!isError);
    }

    function splitCreate() {
        const parts = LAB.split.parts.filter(p => p.on);
        if (!parts.length || !LAB.current) return;

        const agentId = LAB.current.agent.id;
        let done = 0, failed = 0;

        splitMsg('Creando ' + parts.length + ' archivo(s)…');
        $('#labSplitCreate').prop('disabled', true);

        const chain = parts.reduce(function (prev, p) {
            return prev.then(function () {
                return post({
                    action:      'ruleSave',
                    id:          0,
                    agent_id:    agentId,
                    name:        p.name,
                    description: p.title,
                    priority:    'medium',
                    content:     p.content,
                    active:      1
                }).then(() => { done++; }).catch(() => { failed++; });
            });
        }, $.Deferred().resolve().promise());

        chain.then(function () {
            $('#labSplitModal').addClass('hidden');
            toast(done + ' archivo(s) creado(s)' + (failed ? ' · ' + failed + ' con error (¿nombre repetido?)' : ''));
            return openAgent(agentId);
        });
    }

    /* ═══════════════════════ Tema ═══════════════════════ */

    function applyTheme(theme) {
        LAB.uiTheme = (window.CoffeeTheme ? CoffeeTheme.set(theme) : (theme === 'light' ? 'light' : 'dark'));
        $('html, body').attr('data-theme', LAB.uiTheme);
        const dark = (window.CoffeeTheme ? CoffeeTheme.isDark(LAB.uiTheme) : LAB.uiTheme === 'dark');
        $('#labThemeToggle i').attr('data-lucide', (window.CoffeeTheme ? CoffeeTheme.info(CoffeeTheme.next(LAB.uiTheme)).icon : (dark ? 'sun' : 'moon')));
        $('#hljsTheme').attr('href', 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github' + (dark ? '-dark' : '') + '.min.css');
        icons();
    }

    /* ═══════════════════════ Menú de agentes ═══════════════════════ */

    function renderAgentMenu() {
        const $m = $('#labAgentMenu').empty();
        LAB.agents.forEach(function (a) {
            const total = a.rules_count + a.borrowed_count;
            $m.append(
                '<button type="button" class="lab-agent-item" data-id="' + a.id + '">' +
                    '<span class="lab-avatar sm">' + esc(initials(a.name)) + '</span>' +
                    '<span class="lab-agent-item-body">' +
                        '<span class="lab-agent-item-name">' + esc(a.name) + '</span>' +
                        '<span class="lab-agent-item-meta">' + (total ? total + ' reglas' : 'sin reglas') +
                            (a.memories_count ? ' · ' + a.memories_count + ' mem' : '') + '</span>' +
                    '</span>' +
                '</button>'
            );
        });
    }

    /* ═══════════════════════ Arranque ═══════════════════════ */

    $(function () {
        try { applyTheme(window.CoffeeTheme ? CoffeeTheme.load() : (localStorage.getItem('lab:theme') || 'dark')); } catch (e) { applyTheme('dark'); }

        $('#labThemeToggle').on('click', () => applyTheme(window.CoffeeTheme ? CoffeeTheme.next(LAB.uiTheme) : (LAB.uiTheme === 'dark' ? 'light' : 'dark')));
        $('#labHeaderToggle').on('click', function () {
            const open = $('#labHeaderRight').toggleClass('open').hasClass('open');
            $(this).attr('aria-expanded', open ? 'true' : 'false');
        });

        // Acordeón: abre la sección y cierra las demás, salvo que se pulse un
        // control marcado con data-no-toggle (Mejorar).
        $('.lab-sec-head').on('click', function (e) {
            if ($(e.target).closest('[data-no-toggle]').length) return;
            const $sec = $(this).closest('.lab-sec');
            const open = $sec.hasClass('open');
            $('.lab-sec').removeClass('open');
            if (!open) $sec.addClass('open');
        });
        $('.lab-sec[data-sec="prompt"]').addClass('open');

        $('#labRailToggle').on('click', function () {
            const railed = $('#labConfig').toggleClass('railed').hasClass('railed');
            $(this).find('i').attr('data-lucide', railed ? 'panel-left-open' : 'panel-left-close');
            try { localStorage.setItem('lab:rail', railed ? '1' : '0'); } catch (e) {}
            icons();
        });
        try {
            if (localStorage.getItem('lab:rail') === '1') $('#labRailToggle').trigger('click');
        } catch (e) {}

        // ── Selector de agente ──
        $('#labAgentBtn').on('click', function (e) {
            e.stopPropagation();
            $('#labAgentMenu').toggleClass('hidden');
        });
        $('#labAgentMenu').on('click', '.lab-agent-item', function () {
            const id = Number($(this).data('id'));
            $('#labAgentMenu').addClass('hidden');
            if (LAB.dirty && !confirm('Hay cambios sin guardar en este agente. ¿Descartarlos?')) return;
            openAgent(id);
        });
        $(document).on('click', () => $('#labAgentMenu').addClass('hidden'));

        // ── Campos de configuración ──
        $('#labPrompt, #labSoul').on('input', function () {
            updateCount(this);
            setDirty(true);
            updateCtxBar();
        });
        $('#labTemp').on('input', function () {
            $('#labTempVal').text(Number(this.value).toFixed(2));
            setDirty(true);
        });
        $('#labModel').on('change', function () {
            setDirty(true);
            updateModelBadge();
            renderEffort(currentEffort());
            updateCtxBar();
            icons();
        });
        $('#labEffort').on('click', '.lab-eff', function () {
            $('#labEffort .lab-eff').removeClass('on');
            $(this).addClass('on');
            setDirty(true);
        });
        $('#labTools').on('change', '.lab-tool-cb', function () {
            updateToolsMeta();
            setDirty(true);
            updateCtxBar();
        });

        $('#labImprovePrompt').on('click', () => improve('#labPrompt', '#labImprovePrompt', 'prompt'));
        $('#labImproveSoul').on('click', () => improve('#labSoul', '#labImproveSoul', 'soul'));

        $('#labSave').on('click', saveConfig);
        $('#labRestore').on('click', restoreConfig);

        // ── Memoria ──
        const addMemory = function () {
            const content = $('#labMemInput').val().trim();
            if (!content || !LAB.current) return;
            post({ action: 'memoryAdd', id: LAB.current.agent.id, content: content }).then(function () {
                $('#labMemInput').val('');
                return openAgent(LAB.current.agent.id).then(function () {
                    $('.lab-sec[data-sec="memory"]').addClass('open').siblings().removeClass('open');
                    toast('Memoria guardada');
                });
            }).catch(e => toast(e.message, 'error'));
        };
        $('#labMemAdd').on('click', addMemory);
        $('#labMemInput').on('keydown', function (e) { if (e.key === 'Enter') addMemory(); });
        $('#labMem').on('click', '.lab-mem-del', function () {
            const mid = Number($(this).data('id'));
            post({ action: 'memoryDelete', id: LAB.current.agent.id, memory_id: mid }).then(function () {
                return openAgent(LAB.current.agent.id).then(function () {
                    $('.lab-sec[data-sec="memory"]').addClass('open').siblings().removeClass('open');
                    toast('Memoria olvidada');
                });
            }).catch(e => toast(e.message, 'error'));
        });

        // ── Chat ──
        $('#labSend').on('click', function () { LAB.sending ? stopSending() : send(); });
        $('#labInput').on('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
        }).on('input', function () {
            // Auto-alto igual que el composer del Visor: crece con el texto y solo
            // scrollea al topar el máximo.
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 180) + 'px';
            this.style.overflowY = this.scrollHeight > 180 ? 'auto' : 'hidden';
            updateCtxBar();
        });

        $('#labReset').on('click', function () {
            LAB.history = [];
            LAB.ctxReal = 0;
            LAB.spend = { tokens: 0, cost: 0 };
            $('#labSpend').text('—');
            resetSandbox();
            renderMessages();
            updateCtxBar();
            toast('Conversación vaciada');
        });

        $('#labCompact').on('click', function (e) { e.stopPropagation(); compactContext(false); });

        // ── Sandbox ──
        loadSandboxPrefs();
        applySplit(LAB.splitW);
        applySandboxUI();
        applyCanvasUI();
        bindSplitter();
        pgApplyViewport();
        // Coffee-Varoch trae su CSS dentro del grimorio: sin la librería el preview
        // saldría sin estilos. En lienzo también hace falta para anclar el grimorio.
        if (LAB.canvas || (LAB_THEMES[LAB.theme] || {}).cssFrom) ensureLibrary();

        $('#labSandboxToggle').on('click', function () {
            LAB.sandboxOn = !LAB.sandboxOn;
            // Volver a mostrarlo lo trae desplegado: si no, reaparecia como una
            // franja y parecia que el boton no habia hecho nada.
            if (LAB.sandboxOn) LAB.sbCollapsed = false;
            applySandboxUI();
            saveSandboxPrefs();
        });

        // Contraer / desplegar. Al contraer, el chat se queda con todo el ancho y
        // el sandbox deja su franja para volver.
        $('#labSandboxCollapse').on('click', function (e) {
            e.stopPropagation();
            LAB.sbCollapsed = true;
            applySandboxUI();
            saveSandboxPrefs();
        });
        $('#labSandboxExpand').on('click', function (e) {
            e.stopPropagation();
            LAB.sbCollapsed = false;
            applySandboxUI();
            saveSandboxPrefs();
        });

        $('#labCanvasToggle').on('click', function () {
            LAB.canvas = !LAB.canvas;
            applyCanvasUI();
            saveSandboxPrefs();
            if (LAB.canvas) ensureLibrary();
        });

        $('.pg-tab').on('click', function () {
            $('.pg-tab').removeClass('active');
            $(this).addClass('active');
            const tab = $(this).data('sbtab');
            $('#pgSandboxFrame').toggleClass('hidden', tab === 'code');
            $('#pgSandboxCode').toggleClass('hidden', tab !== 'code');
        });

        $('#pgZoomIn').on('click', function () { pgSetZoom((pg.zoom || 100) + 10); });
        $('#pgZoomOut').on('click', function () { pgSetZoom((pg.zoom || 100) - 10); });
        $('#pgZoomLabel').on('click', function () { pgSetZoom(100); }).text((pg.zoom || 100) + '%');
        $('.pg-vp-btn').on('click', function () { pgSetViewport($(this).data('vp')); });

        // Cambiar de sistema de diseño re-envuelve el render vigente: el markup no
        // cambia, cambia el CSS con el que se interpreta.
        $('#labSandboxTheme').on('change', function () {
            LAB.theme = this.value;
            saveSandboxPrefs();
            const redraw = function () { if (LAB.lastHtml) renderSandbox(LAB.lastHtml, LAB.lastIsDoc); };
            if ((LAB_THEMES[LAB.theme] || {}).cssFrom && !LAB.varochCss) ensureLibrary().always(redraw);
            else redraw();
        });

        $('#labSandboxDownload').on('click', downloadHtml);
        $('#labSandboxOpen').on('click', openInTab);

        // El menú ⋯ solo existe en móvil (en escritorio los botones van sueltos).
        $('#labSbActionsToggle').on('click', function (e) {
            e.stopPropagation();
            const open = !$('#labSbActionsPop').hasClass('is-open');
            $('#labSbActionsPop').toggleClass('is-open', open);
            $(this).attr('aria-expanded', open ? 'true' : 'false').toggleClass('is-active', open);
        });
        $('#labSbActionsPop').on('click', '.pg-actionbtn', closeSbActions);
        $(document).on('click.labSbActions', function (e) {
            if (!$('#labSbActionsPop').hasClass('is-open')) return;
            if ($(e.target).closest('.pg-actions-menu').length) return;
            closeSbActions();
        });

        let resizeT = null;
        $(window).on('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(pgApplyZoom, 120); });

        // ── Dividir ──
        $('#labSplitOpen').on('click', function () {
            LAB.split = { parts: [], level: 2 };
            $('#labSplitText').val('');
            $('#labSplitList').empty();
            $('#labSplitCreate').prop('disabled', true);
            splitMsg('Pega el documento y pulsa Analizar');
            $('#labSplitModal').removeClass('hidden');
            icons();
            setTimeout(() => $('#labSplitText').trigger('focus'), 50);
        });
        $('#labSplitClose, #labSplitCancel').on('click', () => $('#labSplitModal').addClass('hidden'));
        $('#labSplitText').on('input', function () {
            $('#labSplitChars').text(Number(this.value.length).toLocaleString('es-MX') + ' chars');
        });
        $('.lab-lvl').on('click', function () {
            $('.lab-lvl').removeClass('on');
            $(this).addClass('on');
            LAB.split.level = Number($(this).data('lvl'));
            if (LAB.split.parts.length) splitScan();
        });
        $('#labSplitScan').on('click', splitScan);
        $('#labSplitList').on('change', '.lab-split-cb', function () {
            LAB.split.parts[Number($(this).data('i'))].on = this.checked;
            splitCount();
        });
        $('#labSplitCreate').on('click', splitCreate);
        $('#labSplitPolish').on('click', function () {
            const text = $('#labSplitText').val().trim();
            if (!text) { splitMsg('Pega primero el documento', true); return; }
            busy('#labSplitPolish', function () {
                return oneShot(
                    'Eres experto documentando reglas y convenciones de código para que un agente las siga. ' +
                    'Reestructura el contenido en Markdown claro y conciso (encabezados y listas), sin inventar reglas ' +
                    'que no estén implícitas ni perder ninguna. Responde SOLO con el Markdown resultante.',
                    text
                ).then(function (out) {
                    if (out && out.trim()) {
                        $('#labSplitText').val(out.trim()).trigger('input');
                        splitMsg('Reordenado — pulsa Analizar');
                    } else {
                        splitMsg('El modelo no devolvió texto', true);
                    }
                }).catch(() => splitMsg('No se pudo reordenar', true));
            });
        });

        $(document).on('keydown', function (e) {
            if (e.key === 'Escape' && !$('#labSplitModal').hasClass('hidden')) $('#labSplitModal').addClass('hidden');
        });

        // Salir con cambios sin guardar en el agente es perderlos: el navegador avisa.
        window.addEventListener('beforeunload', function (e) {
            if (!LAB.dirty) return;
            e.preventDefault();
            e.returnValue = '';
        });

        loadAgents();
        icons();
    });
})();
