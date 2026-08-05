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
 * CoffeeIA; para generar UI, el Playground.
 *
 * Datos: ctrl/ctrl-agents.php sobre data/agents.sqlite (el mismo registro que
 * administra agents.php). Chat: ctrl/ctrl-coffeeia-stream.php, el motor del visor.
 */
(function () {
    'use strict';

    const API        = 'ctrl/ctrl-agents.php';
    const API_STREAM = 'ctrl/ctrl-coffeeia-stream.php';
    const API_CHAT   = 'ctrl/ctrl-coffeeia.php';

    // Presupuesto por defecto cuando el modelo no declara maxTokens en el catálogo.
    const LAB_DEFAULT_MAX_TOKENS = 128000;
    // Mensajes finales que se conservan literales al compactar.
    const LAB_COMPACT_KEEP = 4;

    const LAB = {
        agents:   [],
        current:  null,     // ficha completa del agente abierto
        history:  [],       // conversación efímera [{role, content}]
        split:    { parts: [], level: 2 },
        sending:  false,
        dirty:    false,
        ctxReal:  0,        // tokens que reportó el servidor en el último turno
        spend:    { tokens: 0, cost: 0 },
        uiTheme:  'dark'
    };

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
            return IARender.markdownToHtml(IARender.normalizeStoriesYaml(String(text || '')));
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
            try { localStorage.setItem('lab:agent', String(id)); } catch (e) {}
            renderConfig();
            renderMessages();
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

        LAB.history.forEach(function (m) {
            $m.append(m.role === 'user'
                ? bubbleUser(m.content)
                : bubbleAI(md(m.content)));
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

        LAB.history.push({ role: 'user', content: text });
        $('#labInput').val('').css('height', '');
        $('#labMessages').find('.pg-empty').remove();
        $('#labMessages').append(bubbleUser(text));

        const liveId = 'labLive' + Date.now();
        $('#labMessages').append(bubbleAI('', liveId));
        $('#' + liveId).find('.ia-msg-text').addClass('ia-typing-loader').html(loader('Pensando'));
        scrollDown();
        setSending(true);

        // El prompt del agente va como systemOverride: es lo que hay EN PANTALLA, no
        // lo guardado. Sin eso no se podría probar un cambio antes de guardarlo — que
        // es el motivo de existir de esta pantalla. El cerebro (memoria + índice) lo
        // añade el servidor por agentKey.
        const payload = {
            messages:       LAB.history.slice(),
            systemOverride: buildSystem(),
            model:          $('#labModel').val(),
            effort:         currentEffort(),
            surface:        'lab',
            agentKey:       LAB.current.agent.agent_key
        };

        let reply = '';
        const $body = () => $('#' + liveId).find('.ia-msg-text');

        streamChat(payload, {
            onStatus: (label) => { if (!reply) $body().addClass('ia-typing-loader').html(loader(label)); },
            onDelta:  function (chunk) {
                reply += chunk;
                $body().removeClass('ia-typing-loader').html(md(reply));
                scrollDown();
            },
            onDone: function (meta) {
                if (!reply.trim()) reply = '_(el modelo no devolvió respuesta)_';
                LAB.history.push({ role: 'assistant', content: reply });
                $body().removeClass('ia-typing-loader').html(md(reply));
                enhance($body());
                $(metaFooter(meta)).appendTo('#' + liveId);
                $('#' + liveId).find('.ia-copy-btn').on('click', function () {
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
                $body().removeClass('ia-typing-loader')
                       .html('<p style="color:#F87171;margin:0;">' + esc(msg || 'Error en la respuesta') + '</p>');
                LAB.history.pop();   // el turno no llegó a completarse
                setSending(false);
            }
        });
    }

    /* Prompt + alma tal como están en el panel. Es el equivalente a lo que el
     * servidor arma con la fila del agente, pero con lo que se está probando. */
    function buildSystem() {
        const prompt = $('#labPrompt').val().trim();
        const soul   = $('#labSoul').val().trim();
        let out = prompt || 'Eres un asistente del ecosistema CoffeeSoft. Responde en español, claro y directo.';
        if (soul) out += '\n\n## Personalidad\n' + soul;
        return out;
    }

    function setSending(on) {
        LAB.sending = on;
        $('#labSend').prop('disabled', on).css('opacity', on ? .5 : '');
        $('#labInput').prop('disabled', on);
        if (!on) $('#labInput').trigger('focus');
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
        fetch(API_STREAM, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
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
        LAB.uiTheme = (window.CoffeeTheme ? CoffeeTheme.normalize(theme) : (theme === 'light' ? 'light' : 'dark'));
        $('html, body').attr('data-theme', LAB.uiTheme);
        $('#labThemeToggle i').attr('data-lucide', LAB.uiTheme === 'dark' ? 'sun' : 'moon');
        $('#hljsTheme').attr('href', 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github' + (LAB.uiTheme === 'dark' ? '-dark' : '') + '.min.css');
        try { localStorage.setItem('lab:theme', LAB.uiTheme); } catch (e) {}
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
        try { applyTheme(localStorage.getItem('lab:theme') || 'dark'); } catch (e) { applyTheme('dark'); }

        $('#labThemeToggle').on('click', () => applyTheme(LAB.uiTheme === 'dark' ? 'light' : 'dark'));
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
        $('#labSend').on('click', send);
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
            renderMessages();
            updateCtxBar();
            toast('Conversación vaciada');
        });

        $('#labCompact').on('click', function (e) { e.stopPropagation(); compactContext(false); });

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
