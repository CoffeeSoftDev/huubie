/* Pagina de AGENTES: su ficha, sus archivos de reglas y su memoria.
 *
 * La fuente de verdad vive en el servidor (ctrl/ctrl-agents.php sobre
 * data/agents.sqlite): quien arma el prompt y ejecuta las herramientas es PHP, asi
 * que aqui solo se pinta y se edita.
 *
 * Lo que hay que entender de esta pantalla: el contenido de las reglas NO viaja al
 * prompt. Solo su linea de indice (nombre — descripcion · cuando), y el agente abre
 * el archivo que necesita con read_rules. El medidor del pie es la prueba: compara lo
 * que se paga en cada turno contra lo que costaria inyectarlo todo.
 */
(function () {
    'use strict';

    const API = 'ctrl/ctrl-agents.php';

    const AGT = {
        agents:   [],
        current:  null,     // ficha completa del agente abierto
        rule:     null,     // regla abierta en el editor
        tab:      'identity',
        dirty:    false,
        uiTheme:  'dark'
    };

    const esc = (v) => String(v === null || v === undefined ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const tokens = (chars) => Math.round(Number(chars || 0) / 4);

    const fmtTokens = (n) => {
        n = Number(n || 0);
        return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n);
    };

    /* Iniciales del avatar. Con dos palabras toma una de cada una; con una sola
     * (CoffeeMagic, CoffeeIA) toma sus dos mayusculas — "C" a secas no distingue a
     * ningun agente del ecosistema, que empiezan todos igual. */
    const initials = (name) => {
        const words = String(name || '?').replace(/[^A-Za-zÁÉÍÓÚÑ0-9 ]/g, '').split(' ').filter(Boolean);
        if (words.length > 1) return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();

        const word = words[0] || '?';
        const caps = word.match(/[A-ZÁÉÍÓÚÑ]/g) || [];
        return (caps.length > 1 ? caps.slice(0, 2).join('') : word.slice(0, 2)).toUpperCase();
    };

    const PRIORITY = {
        critical: { label: 'Crítica', cls: 'p1' },
        high:     { label: 'Alta',    cls: 'p2' },
        medium:   { label: 'Media',   cls: 'p3' },
        low:      { label: 'Baja',    cls: 'p4' }
    };

    function toast(msg, kind) {
        const $t = $('#agtToast');
        $t.removeClass('show error ok').addClass(kind === 'error' ? 'error' : 'ok').text(msg).addClass('show');
        setTimeout(() => $t.removeClass('show'), 3200);
    }

    function icons() {
        if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    }

    function post(data) {
        return $.post(API, data).then(function (res) {
            if (!res || res.success === false) {
                throw new Error((res && res.message) || 'La operación no se completó');
            }
            return res;
        }).catch(function (err) {
            const msg = (err && err.responseJSON && err.responseJSON.message)
                     || (err && err.message) || 'No se pudo contactar al servidor';
            throw new Error(msg);
        });
    }

    /* ═══════════════════════ Lista de agentes ═══════════════════════ */

    function loadAgents(selectId) {
        return post({ action: 'list' }).then(function (res) {
            AGT.agents = res.agents || [];
            renderList();
            const pick = selectId || (AGT.agents.length ? AGT.agents[0].id : 0);
            if (pick) openAgent(pick);
        }).catch(e => toast(e.message, 'error'));
    }

    function renderList() {
        const $list = $('#agtList').empty();
        $('#agtCount').text(AGT.agents.length);

        if (!AGT.agents.length) {
            $list.append('<p class="pg-hint agt-empty">Aún no hay agentes registrados.</p>');
            return;
        }

        AGT.agents.forEach(function (a) {
            const active = AGT.current && AGT.current.agent.id === a.id ? ' active' : '';
            const off    = a.active ? '' : ' is-off';
            const total  = a.rules_count + a.borrowed_count;

            $list.append(`
                <button class="agt-item${active}${off}" data-id="${a.id}" type="button">
                    <span class="agt-avatar sm">${esc(initials(a.name))}</span>
                    <span class="agt-item-body">
                        <span class="agt-item-name">${esc(a.name)}${a.active ? '' : ' <em>inactivo</em>'}</span>
                        <span class="agt-item-meta">
                            ${total ? total + ' regla' + (total === 1 ? '' : 's') : 'sin reglas'}
                            ${a.memories_count ? ' · ' + a.memories_count + ' memoria' + (a.memories_count === 1 ? '' : 's') : ''}
                        </span>
                    </span>
                </button>
            `);
        });
    }

    function openAgent(id) {
        return post({ action: 'get', id: id }).then(function (res) {
            AGT.current = res;
            AGT.dirty   = false;
            renderList();
            renderDetail();
        }).catch(e => toast(e.message, 'error'));
    }

    /* ═══════════════════════ Ficha ═══════════════════════ */

    function renderDetail() {
        const c = AGT.current;
        if (!c) return;
        const a = c.agent;

        $('#agtAvatar').text(initials(a.name));
        $('#agtName').text(a.name);
        $('#agtMeta').html(
            esc(a.description || 'Sin descripción') +
            (a.model ? ' · <code>' + esc(a.model) + '</code>' : '') +
            ' · <code>' + esc(a.agent_key) + '</code>'
        );

        $('#agtStale').toggleClass('hidden', !a.source_stale);

        $('#agtFName').val(a.name);
        $('#agtFKey').val(a.agent_key);
        $('#agtFDesc').val(a.description);
        $('#agtFModel').val(a.model);
        $('#agtFRender').val(a.render);
        $('#agtFTags').val((a.tags || []).join(', '));
        $('#agtFActive').prop('checked', a.active === 1);
        $('#agtFStandalone').prop('checked', a.brain_standalone === 1);
        $('#agtFPrompt').val(a.prompt_system);
        $('#agtFSoul').val(a.soul);

        $('#agtSource').html(a.source_file
            ? 'Importado de <code>' + esc(a.source_file) + '</code>'
            : 'Creado desde esta pantalla, sin archivo de origen.');

        updateMeters();
        renderRules();
        renderMemories();
        renderTools();
        renderBudget();
        setDirty(false);
        icons();
    }

    function updateMeters() {
        $('#agtPromptMeter').text(fmtTokens(tokens($('#agtFPrompt').val().length)) + ' tokens');
        $('#agtSoulMeter').text(fmtTokens(tokens($('#agtFSoul').val().length)) + ' tokens');
    }

    /* El medidor que explica la pantalla: lo que se paga cada turno contra lo que
     * costaria inyectar todas las reglas completas, que es como se hacia antes. */
    function renderBudget() {
        const b = AGT.current.budget;
        const saved = Math.max(0, b.legacy_tokens - b.fixed_tokens);
        const pct   = b.legacy_tokens > 0 ? Math.round(100 * b.fixed_tokens / b.legacy_tokens) : 100;

        $('#agtBudget').html(`
            <div class="agt-budget-head">
                <span>Contexto por turno</span>
                <b>${fmtTokens(b.fixed_tokens)} tok</b>
            </div>
            <div class="agt-budget-bar"><span style="width:${Math.min(100, Math.max(2, pct))}%"></span></div>
            <ul class="agt-budget-rows">
                <li><span>Prompt + alma</span><b>${fmtTokens(b.prompt_tokens)}</b></li>
                <li><span>Índice de reglas</span><b>${fmtTokens(b.index_tokens)}</b></li>
                <li><span>Memoria</span><b>${fmtTokens(b.memory_tokens)}</b></li>
                <li class="agt-budget-pool"><span>Disponible bajo demanda</span><b>${fmtTokens(b.pool_tokens)}</b></li>
            </ul>
            ${saved > 0 ? `<p class="agt-budget-note">Inyectarlo todo costaría ${fmtTokens(b.legacy_tokens)} tok por turno: se ahorran <b>${fmtTokens(saved)}</b>.</p>` : ''}
        `);
    }

    /* ═══════════════════════ Reglas ═══════════════════════ */

    function renderRules() {
        const rules = AGT.current.rules || [];
        const $list = $('#agtRulesList').empty();
        $('#agtRulesCount').text(rules.length + (AGT.current.borrowed || []).length);

        if (!rules.length) {
            $list.append('<p class="pg-hint agt-empty">Sin archivos propios. Sube un <code>.md</code> o crea uno nuevo.</p>');
        }

        rules.forEach(function (r) {
            const p = PRIORITY[r.priority] || PRIORITY.medium;
            $list.append(`
                <div class="agt-rule${r.active ? '' : ' is-off'}" data-id="${r.id}">
                    <i data-lucide="file-text" class="agt-rule-icon"></i>
                    <div class="agt-rule-body">
                        <div class="agt-rule-name">${esc(r.name)}</div>
                        <div class="agt-rule-meta">
                            ${esc(r.description || 'sin descripción')}
                        </div>
                    </div>
                    <div class="agt-rule-chips">
                        <span class="agt-pri ${p.cls}">${p.label}</span>
                        <span class="agt-size">${fmtTokens(r.tokens)} tok</span>
                        ${r.shared_with.length ? `<span class="agt-shared" title="Compartida con ${r.shared_with.length} agente(s)"><i data-lucide="share-2" class="w-3 h-3"></i>${r.shared_with.length}</span>` : ''}
                    </div>
                    <div class="agt-rule-acts">
                        <button class="pg-iconbtn agt-rule-toggle" data-id="${r.id}" data-active="${r.active}"
                                title="${r.active ? 'Desactivar' : 'Activar'}">
                            <i data-lucide="${r.active ? 'eye' : 'eye-off'}" class="w-3.5 h-3.5"></i>
                        </button>
                        <button class="pg-iconbtn agt-rule-edit" data-id="${r.id}" title="Editar">
                            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>
            `);
        });

        const borrowed = AGT.current.borrowed || [];
        const $b = $('#agtBorrowed').empty();
        if (borrowed.length) {
            $b.append('<h4 class="agt-sub">Compartidas con este agente</h4>');
            borrowed.forEach(function (r) {
                const p = PRIORITY[r.priority] || PRIORITY.medium;
                $b.append(`
                    <div class="agt-rule is-borrowed">
                        <i data-lucide="file-symlink" class="agt-rule-icon"></i>
                        <div class="agt-rule-body">
                            <div class="agt-rule-name">${esc(r.name)}</div>
                            <div class="agt-rule-meta">de ${esc(r.owner)} · solo lectura</div>
                        </div>
                        <div class="agt-rule-chips">
                            <span class="agt-pri ${p.cls}">${p.label}</span>
                            <span class="agt-size">${fmtTokens(r.tokens)} tok</span>
                        </div>
                    </div>
                `);
            });
        }
        icons();
    }

    function openRule(id) {
        const done = function (rule) {
            AGT.rule = rule;
            $('#agtRuleTitle').text(rule.id ? rule.name : 'Nuevo archivo de reglas');
            $('#agtRName').val(rule.name);
            $('#agtRDesc').val(rule.description);
            $('#agtRPriority').val(rule.priority || 'medium');
            $('#agtRWhen').val(rule.when_to_use);
            $('#agtRTags').val((rule.tags || []).join(', '));
            $('#agtRContent').val(rule.content);
            $('#agtRActive').prop('checked', rule.active !== 0);
            $('#agtRuleDelete').toggleClass('hidden', !rule.id);
            renderShare(rule);
            updateRuleMeter();
            switchRuleTab('content');
            $('#agtRuleModal').removeClass('hidden');
            icons();
        };

        if (!id) {
            done({ id: 0, name: '', description: '', priority: 'medium', when_to_use: '', tags: [], content: '', active: 1 });
            return;
        }
        post({ action: 'rule', id: id }).then(res => done(res.rule)).catch(e => toast(e.message, 'error'));
    }

    function renderShare(rule) {
        const $l = $('#agtRShareList').empty();
        if (!rule.id) {
            $l.append('<p class="pg-hint">Guarda el archivo primero para poder compartirlo.</p>');
            return;
        }

        const row = (AGT.current.rules || []).find(r => r.id === rule.id);
        const shared = row ? row.shared_with : [];

        AGT.agents.forEach(function (a) {
            if (a.id === AGT.current.agent.id) return;
            const on = shared.indexOf(a.id) !== -1;
            $l.append(`
                <label class="agt-share-item">
                    <input type="checkbox" class="agt-share-cb" value="${a.id}" ${on ? 'checked' : ''}>
                    <span class="agt-avatar sm">${esc(initials(a.name))}</span>
                    <span>${esc(a.name)}</span>
                </label>
            `);
        });
        if (!$l.children().length) $l.append('<p class="pg-hint">No hay otros agentes con quien compartir.</p>');
    }

    function updateRuleMeter() {
        const len = $('#agtRContent').val().length;
        $('#agtRMeter').text(fmtTokens(tokens(len)) + ' tokens · ' + len.toLocaleString('es-MX') + ' chars');
    }

    function saveRule() {
        const name = $('#agtRName').val().trim();
        if (!name) { toast('Escribe el nombre del archivo', 'error'); return; }

        const tags = $('#agtRTags').val().split(',').map(t => t.trim()).filter(Boolean);
        const payload = {
            action:      'ruleSave',
            id:          AGT.rule.id || 0,
            agent_id:    AGT.current.agent.id,
            name:        name,
            description: $('#agtRDesc').val(),
            priority:    $('#agtRPriority').val(),
            when_to_use: $('#agtRWhen').val(),
            tags:        JSON.stringify(tags),
            content:     $('#agtRContent').val(),
            active:      $('#agtRActive').is(':checked') ? 1 : 0
        };

        post(payload).then(function (res) {
            const ids = $('.agt-share-cb:checked').map(function () { return this.value; }).get();
            const after = () => openAgent(AGT.current.agent.id).then(function () {
                $('#agtRuleModal').addClass('hidden');
                toast('Regla guardada');
            });
            // El compartir es una segunda escritura: solo tiene sentido con id ya asignado.
            return AGT.rule.id || res.id
                ? post({ action: 'ruleShare', id: AGT.rule.id || res.id, agent_ids: ids.join(',') }).then(after)
                : after();
        }).catch(e => toast(e.message, 'error'));
    }

    /* ═══════════════════════ Memoria ═══════════════════════ */

    function renderMemories() {
        const mem = AGT.current.memories || [];
        const $l  = $('#agtMemList').empty();
        $('#agtMemCount').text(mem.length);
        $('#agtMemMeter').text(mem.length + ' / 100');

        if (!mem.length) {
            $l.append('<p class="pg-hint agt-empty">Sin memorias todavía. El agente las guarda solo cuando algo merece recordarse, y tú puedes sembrar las primeras aquí.</p>');
            return;
        }

        mem.forEach(function (m) {
            $l.append(`
                <div class="agt-mem" data-id="${m.id}">
                    <span class="agt-mem-id">[${m.id}]</span>
                    <span class="agt-mem-text">${esc(m.content)}</span>
                    <span class="agt-mem-date">${esc((m.date_creation || '').slice(0, 16))}</span>
                    <button class="pg-iconbtn agt-mem-del" data-id="${m.id}" title="Olvidar">
                        <i data-lucide="eraser" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            `);
        });
        icons();
    }

    /* ═══════════════════════ Herramientas ═══════════════════════ */

    function renderTools() {
        const tools = AGT.current.tools || [];
        const $l = $('#agtToolsList').empty();
        const groups = {};

        tools.forEach(function (t) {
            const g = t.category || 'Otras';
            (groups[g] = groups[g] || []).push(t);
        });

        Object.keys(groups).sort().forEach(function (g) {
            const $g = $('<div class="agt-tool-group"></div>').append('<h4 class="agt-sub">' + esc(g) + '</h4>');
            groups[g].forEach(function (t) {
                $g.append(`
                    <label class="agt-tool${t.active ? '' : ' is-off'}">
                        <input type="checkbox" class="agt-tool-cb" value="${esc(t.name)}" ${t.assigned ? 'checked' : ''}>
                        <i data-lucide="${esc(t.icon || 'wrench')}" class="w-4 h-4"></i>
                        <span class="agt-tool-body">
                            <span class="agt-tool-name">${esc(t.label || t.name)}</span>
                            <span class="agt-tool-key">${esc(t.name)}${t.active ? '' : ' · desactivada en el catálogo'}</span>
                        </span>
                    </label>
                `);
            });
            $l.append($g);
        });
        icons();
    }

    /* Escribe la asignacion en tools.sqlite (columna `agents`), que es donde ya vivia:
     * este agente se agrega o se quita de la lista de cada herramienta. */
    function saveToolAssign(name, checked) {
        const key = AGT.current.agent.agent_key;
        const tool = (AGT.current.tools || []).find(t => t.name === name);
        if (!tool) return;

        // Se relee la fila antes de escribir: la asignacion es un CSV compartido con
        // las demas superficies y pisarlo con lo que hay en pantalla borraria lo suyo.
        $.get('ctrl/ctrl-tools.php', { action: 'get', id: tool.id }).then(function (res) {
            if (!res || !res.tool) { toast('No se encontró la herramienta', 'error'); return; }
            let agents = (res.tool.agents || []).slice();
            const has  = agents.indexOf(key) !== -1;

            if (checked && !has) agents.push(key);
            if (!checked && has) agents = agents.filter(k => k !== key);

            return $.post('ctrl/ctrl-tools.php', {
                action:   'assign',
                id:       tool.id,
                surfaces: (res.tool.surfaces || []).join(','),
                agents:   agents.join(',')
            }).then(function () {
                tool.assigned = checked;
                toast(checked ? 'Herramienta asignada' : 'Herramienta retirada');
            });
        }).catch(() => toast('No se pudo guardar la asignación', 'error'));
    }

    /* ═══════════════════════ Guardar el agente ═══════════════════════ */

    function setDirty(on) {
        AGT.dirty = !!on;
        $('#agtSaveBtn').prop('disabled', !on);
    }

    function saveAgent() {
        const name = $('#agtFName').val().trim();
        if (!name) { toast('Escribe el nombre del agente', 'error'); return; }

        const tags = $('#agtFTags').val().split(',').map(t => t.trim()).filter(Boolean);
        post({
            action:           'save',
            id:               AGT.current ? AGT.current.agent.id : 0,
            agent_key:        $('#agtFKey').val().trim(),
            name:             name,
            description:      $('#agtFDesc').val(),
            model:            $('#agtFModel').val(),
            render:           $('#agtFRender').val(),
            tags:             JSON.stringify(tags),
            prompt_system:    $('#agtFPrompt').val(),
            soul:             $('#agtFSoul').val(),
            active:           $('#agtFActive').is(':checked') ? 1 : 0,
            brain_standalone: $('#agtFStandalone').is(':checked') ? 1 : 0
        }).then(function (res) {
            toast('Agente guardado');
            return loadAgents(res.id);
        }).catch(e => toast(e.message, 'error'));
    }

    function newAgent() {
        AGT.current = {
            agent: {
                id: 0, agent_key: '', name: '', description: '', tags: [], img: '',
                prompt_system: '', soul: '', render: 'markdown', model: '',
                source_file: '', source_stale: false, brain_standalone: 0, active: 1,
                prompt_chars: 0, soul_chars: 0
            },
            rules: [], borrowed: [], memories: [], tools: [],
            budget: { prompt_tokens: 0, index_tokens: 0, memory_tokens: 0, fixed_tokens: 0, pool_tokens: 0, legacy_tokens: 0 }
        };
        renderDetail();
        switchTab('identity');
        setDirty(true);
        $('#agtFName').trigger('focus');
    }

    /* ═══════════════════════ Pestañas ═══════════════════════ */

    function switchTab(tab) {
        AGT.tab = tab;
        $('.agt-tab[data-tab]').removeClass('active').filter('[data-tab="' + tab + '"]').addClass('active');
        $('.agt-pane').removeClass('active').filter('[data-pane="' + tab + '"]').addClass('active');
    }

    function switchRuleTab(tab) {
        $('.agt-tab[data-rtab]').removeClass('active').filter('[data-rtab="' + tab + '"]').addClass('active');
        $('.agt-rule-pane').removeClass('active').filter('[data-rpane="' + tab + '"]').addClass('active');
    }

    /* ═══════════════════════ Tema ═══════════════════════ */

    function applyTheme(theme) {
        AGT.uiTheme = (window.CoffeeTheme ? CoffeeTheme.normalize(theme) : (theme === 'light' ? 'light' : 'dark'));
        $('html, body').attr('data-theme', AGT.uiTheme);
        const $i = $('#agtThemeToggle i');
        $i.attr('data-lucide', AGT.uiTheme === 'dark' ? 'sun' : 'moon');
        try { localStorage.setItem('agents:theme', AGT.uiTheme); } catch (e) {}
        icons();
    }

    /* ═══════════════════════ Arranque ═══════════════════════ */

    $(function () {
        try { applyTheme(localStorage.getItem('agents:theme') || 'dark'); } catch (e) { applyTheme('dark'); }

        $('#agtThemeToggle').on('click', () => applyTheme(AGT.uiTheme === 'dark' ? 'light' : 'dark'));
        $('#agtHeaderToggle').on('click', function () {
            const open = $('#agtHeaderRight').toggleClass('open').hasClass('open');
            $(this).attr('aria-expanded', open ? 'true' : 'false');
        });

        $('.agt-tab[data-tab]').on('click', function () { switchTab($(this).data('tab')); });
        $('.agt-tab[data-rtab]').on('click', function () { switchRuleTab($(this).data('rtab')); });

        $('#agtList').on('click', '.agt-item', function () {
            const id = Number($(this).data('id'));
            if (AGT.dirty && !confirm('Hay cambios sin guardar en este agente. ¿Descartarlos?')) return;
            openAgent(id);
        });

        $('#agtNewBtn').on('click', newAgent);
        $('#agtSaveBtn').on('click', saveAgent);

        // Cualquier cambio en la ficha habilita Guardar (las reglas, la memoria y las
        // herramientas se guardan solas: son entidades aparte).
        $('#agtFName, #agtFKey, #agtFDesc, #agtFModel, #agtFRender, #agtFTags, #agtFPrompt, #agtFSoul')
            .on('input change', function () { setDirty(true); updateMeters(); });
        $('#agtFActive, #agtFStandalone').on('change', () => setDirty(true));

        $('#agtReloadBtn').on('click', function (e) {
            e.stopPropagation();
            post({ action: 'reload', id: AGT.current.agent.id })
                .then(function (res) { toast(res.message); return openAgent(AGT.current.agent.id); })
                .catch(e => toast(e.message, 'error'));
        });

        $('#agtDeleteBtn').on('click', function () {
            if (!AGT.current || !AGT.current.agent.id) return;
            if (!confirm('Se eliminará "' + AGT.current.agent.name + '" con sus reglas y memorias. ¿Continuar?')) return;
            post({ action: 'delete', id: AGT.current.agent.id })
                .then(function () { toast('Agente eliminado'); AGT.current = null; return loadAgents(); })
                .catch(e => toast(e.message, 'error'));
        });

        // ── Reglas ──
        $('#agtRuleNew').on('click', () => openRule(0));
        $('#agtRulesList').on('click', '.agt-rule-edit', function () { openRule(Number($(this).data('id'))); });
        $('#agtRulesList').on('click', '.agt-rule-toggle', function () {
            const id = Number($(this).data('id'));
            const on = Number($(this).data('active')) === 1 ? 0 : 1;
            post({ action: 'ruleStatus', id: id, active: on })
                .then(function (res) { toast(res.message); return openAgent(AGT.current.agent.id); })
                .catch(e => toast(e.message, 'error'));
        });

        $('#agtRuleClose, #agtRuleCancel').on('click', () => $('#agtRuleModal').addClass('hidden'));
        $('#agtRuleSave').on('click', saveRule);
        $('#agtRContent').on('input', updateRuleMeter);
        $('#agtRuleDelete').on('click', function () {
            if (!AGT.rule || !AGT.rule.id) return;
            if (!confirm('Se borrará "' + AGT.rule.name + '". ¿Continuar?')) return;
            post({ action: 'ruleDelete', id: AGT.rule.id }).then(function () {
                $('#agtRuleModal').addClass('hidden');
                toast('Regla borrada');
                return openAgent(AGT.current.agent.id);
            }).catch(e => toast(e.message, 'error'));
        });

        // Subir .md: el nombre del archivo es el nombre de la regla y su primer
        // encabezado la descripcion, igual que hace el seed con los grimorios.
        $('#agtRuleUpload').on('change', function () {
            const files = Array.from(this.files || []);
            this.value = '';
            if (!files.length || !AGT.current || !AGT.current.agent.id) return;

            let pending = files.length;
            files.forEach(function (file) {
                const reader = new FileReader();
                reader.onload = function () {
                    const content = String(reader.result || '');
                    const first = content.split('\n').map(l => l.trim())
                        .find(l => l && l.indexOf('---') !== 0 && l.indexOf('name:') !== 0 && l.indexOf('description:') !== 0) || '';

                    post({
                        action:      'ruleSave',
                        id:          0,
                        agent_id:    AGT.current.agent.id,
                        name:        file.name,
                        description: first.replace(/^#+\s*/, '').slice(0, 200),
                        priority:    'medium',
                        content:     content,
                        active:      1
                    }).catch(e => toast(file.name + ': ' + e.message, 'error'))
                      .then(function () {
                          if (--pending === 0) {
                              openAgent(AGT.current.agent.id).then(() => toast('Archivos subidos'));
                          }
                      });
                };
                reader.readAsText(file, 'UTF-8');
            });
        });

        // ── Memoria ──
        const addMemory = function () {
            const content = $('#agtMemInput').val().trim();
            if (!content || !AGT.current || !AGT.current.agent.id) return;
            post({ action: 'memoryAdd', id: AGT.current.agent.id, content: content }).then(function () {
                $('#agtMemInput').val('');
                toast('Memoria guardada');
                return openAgent(AGT.current.agent.id).then(() => switchTab('memory'));
            }).catch(e => toast(e.message, 'error'));
        };
        $('#agtMemAdd').on('click', addMemory);
        $('#agtMemInput').on('keydown', function (e) { if (e.key === 'Enter') addMemory(); });

        $('#agtMemList').on('click', '.agt-mem-del', function () {
            const mid = Number($(this).data('id'));
            post({ action: 'memoryDelete', id: AGT.current.agent.id, memory_id: mid }).then(function () {
                toast('Memoria olvidada');
                return openAgent(AGT.current.agent.id).then(() => switchTab('memory'));
            }).catch(e => toast(e.message, 'error'));
        });

        // ── Herramientas ──
        $('#agtToolsList').on('change', '.agt-tool-cb', function () {
            saveToolAssign($(this).val(), this.checked);
        });

        $(document).on('keydown', function (e) {
            if (e.key === 'Escape' && !$('#agtRuleModal').hasClass('hidden')) $('#agtRuleModal').addClass('hidden');
        });

        loadAgents();
        icons();
    });
})();
