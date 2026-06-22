/* ──────────────────────────────────────────────────────────────
   Forge — Fábrica de Módulos. Copia AISLADA del Playground (no lo toca).
   Mismo motor de chat (typewriter, "Conjurando…", adjuntos, lienzo) y
   mismos endpoints/modelos (Ollama Cloud / OpenRouter) + agentes .md.
   Diverge del Playground en que el resultado del agente puede ser un
   MÓDULO multi-archivo (ctrl PHP + mdl PHP + JS) que se materializa a
   disco en un proyecto destino — no solo una maqueta para el iframe.
     - ctrl/ctrl-visor.php           → lista agentes + grimorios (con raw)
     - ctrl/ctrl-coffeeia-stream.php  → chat SSE (acepta systemOverride opcional)
   ────────────────────────────────────────────────────────────── */

const PG_API        = 'ctrl/ctrl-visor.php';
const PG_API_STREAM = 'ctrl/ctrl-coffeeia-stream.php';
const FG_API        = 'ctrl/ctrl-forge.php';   // backend de la fábrica (projects/preview/materialize)

// Extensiones tratadas como TEXTO plano (gemelo del Visor): se leen con readAsText
// y se embeben al contexto del chat. Los binarios (pdf/docx/xlsx) no entran aqui.
const PG_TEXT_EXTS = [
    'txt', 'md', 'markdown', 'rtf', 'log', 'csv', 'tsv',
    'html', 'htm', 'xml', 'svg', 'json', 'json5', 'yaml', 'yml', 'toml', 'ini', 'env', 'conf',
    'js', 'mjs', 'cjs', 'ts', 'jsx', 'tsx', 'css', 'scss', 'less',
    'php', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'h', 'cpp', 'cs', 'swift',
    'sql', 'sh', 'bash', 'ps1', 'bat', 'vue', 'astro'
];
const PG_TEXT_MIME_RE = /^(text\/|application\/(json|xml|javascript|x-yaml|x-sh|sql)|image\/svg)/i;

/** Decide si un File es texto plano (por extension o MIME). */
function pgIsTextFile(file) {
    if (!file) return false;
    const ext = (file.name || '').split('.').pop().toLowerCase();
    if (PG_TEXT_EXTS.indexOf(ext) !== -1) return true;
    return PG_TEXT_MIME_RE.test(file.type || '');
}

/**
 * Footer de metadatos de un mensaje IA (gemelo del helper del Visor).
 * Prioriza el COSTO REAL en USD (OpenRouter via usage.cost); si no hay costo
 * (modelos Ollama) cae al "Credits" estimado por tokens. Suma tokens in/out y tiempo.
 */
function pgMetaItems(meta) {
    if (!meta) return '';
    const elapsedSec = meta.elapsed_ms > 0 ? (meta.elapsed_ms / 1000).toFixed(1) + 's' : '—';

    let costItem;
    if (meta.cost != null && !isNaN(meta.cost)) {
        const c   = Number(meta.cost);
        const txt = (c === 0 || c >= 0.0001) ? '$' + c.toFixed(4) : '<$0.0001';
        costItem = `<span class="meta-item" title="Costo real de OpenRouter (USD)"><span class="dot"></span>Costo: <strong>${txt}</strong></span>`;
    } else {
        costItem = `<span class="meta-item" title="Estimacion por tokens de salida"><span class="dot"></span>Credits: <strong>${meta.credits ?? '—'}</strong></span>`;
    }

    let toksItem = '';
    if (meta.promptTokens != null || meta.completionTokens != null) {
        const fmt = n => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n || 0));
        toksItem = `<span class="meta-item" title="Tokens entrada / salida">Tokens: <strong>${fmt(meta.promptTokens)} in / ${fmt(meta.completionTokens)} out</strong></span>`;
    }

    return costItem + toksItem + `<span class="meta-item">Time: <strong>${elapsedSec}</strong></span>`;
}

const PG_STORE_KEY  = 'forge:settings:v1';   // copia aislada — no comparte ajustes con el Playground

// Agentes que el playground sabe presentar. `render` define como interpretar
// la salida en el sandbox: 'html' (renderiza), 'code' (modulo), 'markdown' (doc).
const PG_AGENTS = {
    'CoffeeIA.md':            { key: 'CoffeeIA.md',            label: 'CoffeeIA',          icon: 'sparkles',      render: 'code'     },
    'CoffeeMagic.md':         { key: 'CoffeeMagic.md',         label: 'CoffeeMagic',       icon: 'wand-sparkles', render: 'html'     },
    'coffee-intelligence.md': { key: 'coffee-intelligence.md', label: 'CoffeeIntelligence', icon: 'database',     render: 'markdown' }
};

// Sistemas de diseño que el sandbox sabe renderizar. Cada uno define:
//   grimoire  → grimorio que se INYECTA al agente para que genere con sus clases
//   cssUrls   → hojas de estilo a cargar en el iframe (ruta relativa a playground.php)
//   cssFrom   → grimorio del que EXTRAER el <style> embebido (Coffee-Varoch)
//   data      → valor de data-theme en <html>
//   bodyClass → clase en <body> (Coffee-Varoch usa .coffee-varoch)
//   bg/fg     → colores base del lienzo
//   note      → directiva breve que se le pasa al agente
const PG_THEMES = {
    'huubie-ui': {
        label: 'Huubie UI (dark)', grimoire: 'grimorio-huubie-ui.md',
        cssUrls: ['src/css/ui-kit.css'], cssFrom: null,
        data: 'dark', bodyClass: '', bg: '#111928', fg: '#E5E7EB',
        note: 'Sistema Huubie UI: usa clases .cs-* y tokens del grimorio. Tema DARK único (no generes toggle light/dark).'
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
    // CoffeeSoft "Arcilla Invernal" (módulo inventory). Tailwind con la escala
    // `blue` remapeada a terracota vía tailwind-theme.js (jsUrls, va tras el CDN)
    // + variables CSS y utilidades de colors.css/color-palette.css. Solo LIGHT.
    'coffeesoft-light': {
        label: 'CoffeeSoft · Arcilla Invernal', grimoire: 'grimorio-coffeesoft.md',
        cssUrls: ['../../../inventory/src/css/colors.css', '../../../inventory/src/css/color-palette.css'],
        jsUrls: ['../../../inventory/src/js/tailwind-theme.js'], cssFrom: null,
        data: '', bodyClass: '', bg: '#F2F5F9', fg: '#1A1A1A',
        note: 'Sistema CoffeeSoft "Arcilla Invernal": Tailwind con la escala blue REMAPEADA a terracota (bg-blue-600 = #C05A40, hover blue-700 = #A84A33) — usa clases blue-* y rendirán terracota, NUNCA azul. También dispones de las variables --primary/--secondary y utilidades .btn-*/.badge-*/.alert-* de color-palette.css. Tema LIGHT únicamente (fondo #F2F5F9, cards #FAFCFF). No generes toggle ni variante oscura.'
    },
    // Lienzo libre: sin grimorio ni paleta impuesta. El agente conjura solo con
    // su propio conocimiento (Tailwind disponible en el sandbox). Canvas neutro.
    'free': {
        label: 'Libre (sin paleta)', grimoire: null,
        cssUrls: [], cssFrom: null,
        data: '', bodyClass: '', bg: '#F8FAFC', fg: '#0F172A',
        note: 'Sin sistema de diseño impuesto: elige tú la paleta y los estilos según tu criterio.'
    }
};
const PG_DEFAULT_THEME = 'huubie-ui';

// Modelos del selector con capacidad de visión (aceptan imágenes). Solo
// informativo: al capturar el Live como imagen avisamos si el modelo activo no
// está aquí, para que el usuario cambie a uno que sí procese la captura.
const PG_VISION_MODELS = new Set([
    'minimax-m3:cloud', 'gemma4:31b-cloud', 'gemini-3-flash-preview:cloud',
    'kimi-k2.6:cloud', 'google/gemma-4-31b-it:free'
]);

const pg = {
    agents:    {},   // file -> {file, raw, fullPath, frontmatter}
    grimoires: {},   // file -> {file, raw, fullPath}
    agentKey:  'CoffeeIA.md',
    theme:     'huubie-ui',     // sistema de diseño del SANDBOX (iframe)
    uiTheme:   'dark',          // tema de la UI del playground (chrome)
    model:     '',
    prompt:    '',           // prompt vivo (puede estar editado sin guardar)
    knowledge: new Set(),    // grimorios seleccionados como contexto
    canvasMode: false,       // modo lienzo (genera HTML renderizable)
    liveContext: false,      // adjuntar la vista renderizada del Live al chat en cada envío
    pendingImages: [],       // [{ dataUrl, base64, mime, name }]
    pendingDocs: [],         // [{ name, content, size }] documentos de texto adjuntos
    history:   [],
    isBusy:    false,
    _abort:    null,         // AbortController de la consulta en curso (botón Detener)
    lastHtml:  '',           // ultimo HTML generado (para "abrir en pestaña")
    lastTheme: 'huubie-ui',
    templates: [],           // historial de templates renderizados (sesión): {id, html, isDoc, theme, themeLabel, title, ts}
    _savedTemplates: [],     // plantillas persistentes leídas de documents/template/ (cache del modal)
    _activeTplId: null,      // template actualmente cargado en el sandbox
    // ── Hilos ── un hilo es una plantilla con seguimiento: se crea al generar el
    // primer diseño y se AUTOGUARDA en su carpeta conforme se itera (sin tocar el
    // proyecto). threadSlug identifica el hilo activo; se persiste para retomarlo.
    threadSlug: null,        // slug del hilo activo (carpeta documents/template/<slug>/)
    threadName: '',          // nombre legible del hilo activo
    _autosaveTimer: null,    // debounce del autoguardado del hilo
    _chipTimer: null,        // limpia el indicador "guardado" del chip
    _lastUserText: '',       // último prompt del usuario (titula los templates)
    splitW:    '',           // ancho del panel de chat (px) — splitter
    zoom:      100,          // zoom del preview (%) — escala el contenido del iframe
    viewport:  'full',       // ancho de la vista: 'mobile' | 'laptop' | 'full'
    _popSound: null,
    _varochCss: '',          // CSS embebido extraido del grimorio Coffee-Varoch
    // ── Fábrica ──
    module:   { files: [] }, // último módulo multi-archivo parseado de la respuesta
    project:  '',            // proyecto destino elegido para materializar
    projects: [],            // proyectos destino disponibles (subcarpetas de www)
    vhosts:   [],            // vhosts de Apache dentro de www: [{server, rel, docRoot}]
    // ── Hilos paralelos (sesiones en memoria) ── inicializados aquí para que
    // fgActiveThread()/fgMaybeAutoName() nunca operen sobre undefined.
    threads:      [],
    activeThread: null
};

$(async () => {
    pgLoadSettings();
    const wantedTab = pg.sandboxTab;   // pestaña que el usuario tenía abierta (se restaura al final)
    pgApplyUiTheme(pg.uiTheme);
    pgApplySplit(pg.splitW);
    pgBind();
    fgBind();
    await pgLoadLibrary();
    await fgLoadProjects();
    pgApplyAgent(pg.agentKey, true);
    pgApplyCanvasUI();
    pgApplyLiveUI();
    pgApplyViewport();        // restaura el ancho de vista (móvil/laptop/desktop) guardado
    fgRenderModulePanel();
    await fgResumeThread();   // si había un hilo activo, lo retoma (diseño + conversación)
    fgRestoreLastModule();    // reabre en Live el último módulo que se había abierto
    // Si la Vista Live venía activada pero no hay módulo para leer, la apagamos.
    if (pg.liveContext && !pg._liveModule) { pg.liveContext = false; pgApplyLiveUI(); pgSaveSettings(); }
    fgInitThreads();          // crea el "Hilo 1" (sesión en memoria) + pinta la barra de hilos
    // Restaurar la pestaña activa que el usuario dejó (p.ej. Live) para que el
    // módulo recordado se siga viendo sin tener que reabrirlo. Solo si tiene
    // contenido: Live necesita módulo; Módulo necesita archivos generados.
    if (wantedTab && wantedTab !== 'preview') {
        const hasLive = wantedTab === 'live' && pg._liveModule;
        const hasMod  = wantedTab === 'module' && pg.module.files.length;
        const hasCode = wantedTab === 'code' && pg.lastHtml;
        if (hasLive || hasMod || hasCode) $('.pg-tab[data-sbtab="' + wantedTab + '"]').trigger('click');
    }
    if (window.lucide) lucide.createIcons();
});

/* ── Ancho del panel de chat (splitter) ── */
function pgApplySplit(w) {
    if (w && isFinite(parseInt(w, 10))) {
        document.documentElement.style.setProperty('--pg-chat-w', parseInt(w, 10) + 'px');
    }
}
function pgBindSplitter() {
    const $sp = $('#pgSplitter');
    const $ws = $('.pg-workspace');
    if (!$sp.length || !$ws.length) return;
    let dragging = false;

    $sp.on('mousedown', e => {
        e.preventDefault();
        dragging = true;
        $sp.addClass('is-dragging');
        document.body.classList.add('pg-resizing');
    });
    $(document).on('mousemove.pgSplit', e => {
        if (!dragging) return;
        const rect = $ws[0].getBoundingClientRect();
        let w = e.clientX - rect.left;
        w = Math.max(320, Math.min(rect.width - 340, w)); // respeta min de ambos paneles
        document.documentElement.style.setProperty('--pg-chat-w', w + 'px');
        pg.splitW = w;
    });
    $(document).on('mouseup.pgSplit', () => {
        if (!dragging) return;
        dragging = false;
        $sp.removeClass('is-dragging');
        document.body.classList.remove('pg-resizing');
        pgApplyZoom();   // el escalado externo usa px del contenedor: recalcular tras redimensionar
        pgSaveSettings();
    });
}

/* ── Tema de la UI (claro/oscuro) — mismo mecanismo que el Visor ── */
function pgApplyUiTheme(theme) {
    const t = theme === 'light' ? 'light' : 'dark';
    pg.uiTheme = t;
    document.documentElement.setAttribute('data-theme', t);
    document.body.setAttribute('data-theme', t);
    $('#pgThemeToggle').html(`<i data-lucide="${t === 'dark' ? 'sun' : 'moon'}" class="w-4 h-4"></i>`);
    const hljs = document.getElementById('hljsTheme');
    if (hljs) {
        const base = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/';
        hljs.href = base + (t === 'dark' ? 'github-dark.min.css' : 'github.min.css');
    }
    if (window.lucide) lucide.createIcons();
}

/* ── Settings ── */
function pgLoadSettings() {
    try {
        const s = JSON.parse(localStorage.getItem(PG_STORE_KEY) || '{}');
        if (s.agentKey && PG_AGENTS[s.agentKey]) pg.agentKey = s.agentKey;
        if (s.theme && PG_THEMES[s.theme])       pg.theme    = s.theme;
        if (s.uiTheme === 'light' || s.uiTheme === 'dark') pg.uiTheme = s.uiTheme;
        if (s.splitW) pg.splitW = s.splitW;
        if (typeof s.zoom === 'number')          pg.zoom     = s.zoom;
        if (PG_VIEWPORTS[s.viewport])            pg.viewport = s.viewport;
        if (typeof s.model === 'string')         pg.model    = s.model;
        if (typeof s.canvasMode === 'boolean')   pg.canvasMode = s.canvasMode;
        if (typeof s.liveContext === 'boolean')  pg.liveContext = s.liveContext;
        if (typeof s.project === 'string')       pg.project  = s.project;
        if (typeof s.threadSlug === 'string')    pg.threadSlug = s.threadSlug || null;
        if (typeof s.threadName === 'string')    pg.threadName = s.threadName;
        if (typeof s.sandboxTab === 'string')    pg.sandboxTab = s.sandboxTab;
        if (Array.isArray(s.knowledge))          pg.knowledge = new Set(s.knowledge);
    } catch (e) {}
}
function pgSaveSettings() {
    try {
        localStorage.setItem(PG_STORE_KEY, JSON.stringify({
            agentKey: pg.agentKey, theme: pg.theme, uiTheme: pg.uiTheme, model: pg.model,
            canvasMode: pg.canvasMode, liveContext: pg.liveContext, splitW: pg.splitW, zoom: pg.zoom, viewport: pg.viewport, project: pg.project,
            threadSlug: pg.threadSlug || '', threadName: pg.threadName || '', sandboxTab: pg.sandboxTab || 'preview',
            knowledge: Array.from(pg.knowledge)
        }));
    } catch (e) {}
}

/* ── Carga de libreria (agentes + grimorios) ── */
async function pgLoadLibrary() {
    try {
        const res  = await fetch(`${PG_API}?folder=agents`, { cache: 'no-store' });
        const data = await res.json();
        (data.agents    || []).forEach(f => { pg.agents[f.file]    = f; });
        (data.grimoires || []).forEach(f => { pg.grimoires[f.file] = f; });
    } catch (e) {
        pgToast('No se pudo cargar la librería de agentes', 'error');
    }

    // Coffee-Varoch declara su CSS embebido en un bloque ```css dentro del
    // grimorio ("NO requiere archivos externos"). Lo extraemos para el sandbox.
    const varoch = pg.grimoires['grimorio-coffee-varoch.md'];
    if (varoch && varoch.raw) {
        const m = varoch.raw.match(/```css\s*\n([\s\S]*?)```/i);
        if (m) pg._varochCss = m[1];
    }

    const $sel = $('#pgAgentSelect').empty();
    Object.values(PG_AGENTS).forEach(a => {
        if (pg.agents[a.key]) $sel.append(`<option value="${a.key}">${a.label}</option>`);
    });
    if (!pg.agents[pg.agentKey]) {
        const first = Object.keys(PG_AGENTS).find(k => pg.agents[k]);
        if (first) pg.agentKey = first;
    }
    $sel.val(pg.agentKey);
    $('#pgThemeSelect').val(pg.theme);
    if (pg.model) $('#pgModelSelect').val(pg.model);
    else pg.model = $('#pgModelSelect').val() || '';

    pgRenderContextList();
}

/* ── Aplicar agente seleccionado ── */
function pgApplyAgent(key, keepHistory) {
    pg.agentKey = key;
    const cfg = PG_AGENTS[key] || { label: key, icon: 'bot', render: 'markdown' };
    const file = pg.agents[key];

    pg.prompt = file ? (file.raw || '') : '';
    $('#pgChatAgentName').text(cfg.label);
    $('#pgKnowAgentName').text(cfg.label);
    $('#pgChatAgentIcon').attr('data-lucide', cfg.icon);
    $('#pgPromptEditor').val(pg.prompt);
    $('#pgPromptPath').text(file && file.fullPath ? file.fullPath : '.claude/agents/' + key);

    if (!keepHistory) pgClearChat();
    pgUpdateKnowledgeCount();
    pgSaveSettings();
    if (window.lucide) lucide.createIcons();
}

/* ── Bindings ── */
function pgBind() {
    $('#pgAgentSelect').on('change', e => pgApplyAgent(e.target.value, false));

    $('#pgThemeSelect').on('change', e => {
        pg.theme = e.target.value;
        $('#pgSandboxTheme').text(PG_THEMES[pg.theme]?.label || pg.theme);
        pgSaveSettings();

        // Si ya hay una respuesta del agente y el agente usa sistema de diseño,
        // regeneramos el resultado adaptándolo al nuevo tema (re-preguntamos).
        const cfg = PG_AGENTS[pg.agentKey] || {};
        const usesDesignSystem = (cfg.render === 'html' || cfg.render === 'code');
        const hasAnswer = pg.history.some(m => m.role === 'assistant');
        if (usesDesignSystem && hasAnswer && !pg.isBusy) {
            pgRegenerateForTheme();
        } else if (pg.lastHtml) {
            pgRenderSandbox(pg.lastHtml, pg._lastIsDoc); // sin respuesta nueva: solo re-pinta
        }
    });
    $('#pgSandboxTheme').text(PG_THEMES[pg.theme]?.label || pg.theme);

    $('#pgModelSelect').on('change', e => { pg.model = e.target.value || ''; pgSaveSettings(); });

    $('#pgThemeToggle').on('click', () => {
        pgApplyUiTheme(pg.uiTheme === 'dark' ? 'light' : 'dark');
        pgSaveSettings();
    });

    $('#pgClearBtn, #pgResetBtn').on('click', () => pgClearChat());

    pgBindSplitter();

    // Reaplicar el zoom al redimensionar la ventana (el escalado externo del Live
    // cross-origin usa px del contenedor, así que debe seguir el nuevo tamaño).
    let _rzT;
    $(window).on('resize', () => { clearTimeout(_rzT); _rzT = setTimeout(pgApplyZoom, 120); });

    $('#pgSendBtn').on('click', () => { if (pg.isBusy) pgStop(); else pgSubmit(); });
    $('#pgInput').on('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); pgSubmit(); }
    }).on('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 180) + 'px';
    });

    // Modo lienzo
    $('#pgCanvasToggle').on('click', () => {
        pg.canvasMode = !pg.canvasMode;
        pgApplyCanvasUI();
        pgSaveSettings();
    });

    // Vista Live: adjunta el módulo renderizado al chat en cada envío.
    $('#pgLiveToggle').on('click', () => fgToggleLiveContext());
    // Capturar el Live como imagen (visión): foto puntual adjunta al chat.
    $('#pgLiveShotBtn').on('click', () => fgCaptureLiveImage());

    // Adjuntar archivos: imagenes -> vision; texto/codigo/html/md/csv/json -> contexto.
    $('#pgAttachBtn').on('click', () => $('#pgImageInput').trigger('click'));
    $('#pgImageInput').on('change', e => {
        Array.from(e.target.files || []).forEach(f => pgAddFile(f));
        $(e.target).val('');
    });
    // Pegar (Ctrl+V) a nivel de toda la pagina: puedes pegar un screenshot o archivo
    // sin tener el foco dentro del textarea del chat.
    $(document).on('paste', e => {
        // No interceptar si el foco esta en un campo de edicion de texto (ej. el
        // editor de prompt del modal de conocimiento): ahi se pega texto normal.
        const isPromptEditor = e.target && e.target.id === 'pgPromptEditor';
        if (isPromptEditor) return;
        const cd = e.originalEvent && e.originalEvent.clipboardData;
        if (!cd || !cd.items) return;
        let pasted = 0;
        for (const it of cd.items) {
            if (it.kind !== 'file') continue;
            const f = it.getAsFile();
            if (f && (/^image\//.test(it.type) || pgIsTextFile(f))) { pgAddFile(f); pasted++; }
        }
        if (pasted) {
            e.preventDefault();
            pgToast(pasted === 1 ? 'Adjunto pegado' : pasted + ' adjuntos pegados', 'success');
        }
    });
    const $wrap = $('.ia-input-wrap');
    $wrap.on('dragover', e => { e.preventDefault(); $wrap.addClass('is-drag-over'); });
    $wrap.on('dragleave', () => $wrap.removeClass('is-drag-over'));
    $wrap.on('drop', e => {
        e.preventDefault();
        $wrap.removeClass('is-drag-over');
        const dt = e.originalEvent && e.originalEvent.dataTransfer;
        (dt ? Array.from(dt.files || []) : []).forEach(f => pgAddFile(f));
    });

    // Tabs del sandbox. "Live" (módulo real) y "Preview" (diseños generados) son
    // iframes SEPARADOS: generar un diseño nunca pisa el módulo en vivo.
    $('.pg-tab').on('click', function () {
        $('.pg-tab').removeClass('active');
        $(this).addClass('active');
        const tab = $(this).data('sbtab');
        pg.sandboxTab = tab; pgSaveSettings();   // recordar la pestaña para reabrir Forge en ella
        $('#pgSandboxFrame').toggleClass('hidden', tab !== 'preview');
        $('#fgLiveFrame').toggleClass('hidden', tab !== 'live');
        $('#pgSandboxCode').toggleClass('hidden', tab !== 'code');
        $('#pgModulePanel').toggleClass('hidden', tab !== 'module');
        pgUpdateSandboxBg();   // fondo según viewport + vista activa
        $('#fgLiveEmpty').toggleClass('hidden', !(tab === 'live' && !pg._liveModule));
        // Los botones de recrear (módulo completo · seleccionar) solo viendo el Live.
        $('#fgRecFabWrap').toggleClass('hidden', !(tab === 'live' && pg._liveModule));
        fgReflectRecreate();
        if (tab !== 'live' && pg._recActive) fgStopSelectRecreate();
        // El "empty" del preview solo aplica a la pestaña Preview sin render.
        if (tab === 'preview' && !pg.lastHtml) $('#pgSandboxEmpty').show();
        else $('#pgSandboxEmpty').hide();
        pgApplyZoom();
    });
    $('#fgRecFab').on('click', () => fgCopyModuleToAgent());
    $('#fgRecSelectFab').on('click', () => fgToggleSelectRecreate());

    $('#pgSandboxOpen').on('click', () => {
        if (!pg.lastHtml) { pgToast('Aún no hay nada que abrir', 'warn'); return; }
        const w = window.open('', '_blank');
        if (w) { w.document.write(pgWrapHtml(pg.lastHtml, pg.lastTheme, pg._lastIsDoc)); w.document.close(); }
    });

    $('#pgSandboxDownload').on('click', () => pgDownloadHtml());

    // Menú "puntitos": abre/cierra el panel de acciones secundarias.
    $('#pgMoreBtn').on('click', (e) => {
        e.stopPropagation();
        const open = $('#pgMoreMenu').hasClass('hidden');
        $('#pgMoreMenu').toggleClass('hidden', !open);
        $('#pgMoreBtn').attr('aria-expanded', open ? 'true' : 'false');
    });
    // Elegir una acción cierra el menú (su handler propio sigue corriendo por id).
    $('#pgMoreMenu').on('click', '.pg-more-item', () => {
        $('#pgMoreMenu').addClass('hidden');
        $('#pgMoreBtn').attr('aria-expanded', 'false');
    });
    // Clic fuera del menú lo cierra.
    $(document).on('click', (e) => {
        if (!$(e.target).closest('#pgMoreWrap').length) {
            $('#pgMoreMenu').addClass('hidden');
            $('#pgMoreBtn').attr('aria-expanded', 'false');
        }
    });

    // Zoom del preview
    $('#pgZoomIn').on('click', () => pgSetZoom((pg.zoom || 100) + 10));
    $('#pgZoomOut').on('click', () => pgSetZoom((pg.zoom || 100) - 10));
    $('#pgZoomLabel').on('click', () => pgSetZoom(100));   // clic en el % restablece a 100%
    $('#pgZoomLabel').text((pg.zoom || 100) + '%');

    // Viewport (móvil/laptop/desktop): fija el ancho de la vista.
    $('.pg-vp-btn').on('click', function () { pgSetViewport($(this).data('vp')); });

    // Modal de conocimiento
    $('#pgKnowledgeBtn').on('click', () => pgOpenKnowledge());
    $('#pgKnowClose, #pgKnowDone').on('click', () => pgCloseKnowledge());
    $('#pgKnowledgeModal .pg-modal-backdrop').on('click', () => pgCloseKnowledge());
    $('.pg-ktab').on('click', function () {
        $('.pg-ktab').removeClass('active');
        $(this).addClass('active');
        const tab = $(this).data('ktab');
        $('#pgKtabPrompt').toggleClass('hidden', tab !== 'prompt');
        $('#pgKtabContext').toggleClass('hidden', tab !== 'context');
    });

    $('#pgPromptEditor').on('input', function () { pg.prompt = this.value; });
    $('#pgPromptReset').on('click', () => {
        const file = pg.agents[pg.agentKey];
        pg.prompt = file ? (file.raw || '') : '';
        $('#pgPromptEditor').val(pg.prompt);
        pgToast('Prompt revertido al de disco', 'success');
    });
    $('#pgPromptSave').on('click', () => pgSavePrompt());

    // Guardar plantilla
    $('#pgSaveTplBtn').on('click', () => pgOpenSaveTemplate());
    $('#pgSaveTplClose, #pgSaveTplCancel').on('click', () => pgCloseSaveTemplate());
    $('#pgSaveTplModal .pg-modal-backdrop').on('click', () => pgCloseSaveTemplate());
    $('#pgSaveTplConfirm').on('click', () => pgConfirmSaveTemplate());
    $('#pgSaveTplName').on('input', function () {
        $('#pgSaveTplSlug').text(this.value.trim() ? 'Carpeta: documents/template/' + pgSlugify(this.value) + '/' : '');
    }).on('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); pgConfirmSaveTemplate(); } });

    // Hilos guardados (el chip del hilo activo también abre la lista)
    $('#pgTemplatesBtn').on('click', () => pgOpenTemplates());
    $('#pgThreadChip').on('click', () => pgOpenTemplates());
    $('#pgTemplatesClose, #pgTemplatesDone').on('click', () => pgCloseTemplates());
    $('#pgTemplatesModal .pg-modal-backdrop').on('click', () => pgCloseTemplates());

    $(document).on('keydown', e => {
        if (e.key === 'Escape') { pgCloseKnowledge(); pgCloseSaveTemplate(); pgCloseTemplates(); }
    });
}

/* ── Modo lienzo ── */
function pgApplyCanvasUI() {
    const $btn = $('#pgCanvasToggle');
    $btn.toggleClass('is-active', pg.canvasMode);
    $btn.attr('title', pg.canvasMode
        ? 'Modo lienzo ACTIVO — la IA generará componentes HTML renderizables'
        : 'Activar modo lienzo (la IA generará componentes HTML renderizables)');
    $('#pgInput').attr('placeholder', pg.canvasMode
        ? 'Pide un componente UI (ej: "una card de producto con precio y botón")...'
        : 'Pide algo al agente...');
}

/* ── Imagenes adjuntas ── */
// Dispatcher: enruta el File a imagen (vision) o documento de texto (contexto).
function pgAddFile(file) {
    if (!file) return;
    if (/^image\//.test(file.type)) { pgAddImageFile(file); return; }
    if (pgIsTextFile(file))         { pgAddDocFile(file);   return; }
    pgToast('Formato no soportado: ' + (file.name || 'archivo') + ' (solo imágenes y texto)', 'warn');
}
function pgAddImageFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    if (file.size > 8 * 1024 * 1024) { pgToast('Imagen demasiado grande (máx 8 MB)', 'warn'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
        const dataUrl = String(ev.target.result || '');
        pg.pendingImages.push({
            dataUrl,
            base64: dataUrl.replace(/^data:[^;]+;base64,/, ''),
            mime: file.type,
            name: file.name || 'imagen'
        });
        pgRenderImageStrip();
    };
    reader.readAsDataURL(file);
}
function pgRemoveImage(idx) {
    if (idx < 0 || idx >= pg.pendingImages.length) return;
    pg.pendingImages.splice(idx, 1);
    pgRenderImageStrip();
}
function pgAddDocFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { pgToast('Archivo demasiado grande (máx 5 MB de texto)', 'warn'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
        pg.pendingDocs.push({
            name:    file.name || 'documento',
            content: String(ev.target.result || ''),
            size:    file.size || 0
        });
        pgRenderImageStrip();
    };
    reader.readAsText(file);
}
function pgRemoveDoc(idx) {
    if (idx < 0 || idx >= pg.pendingDocs.length) return;
    pg.pendingDocs.splice(idx, 1);
    pgRenderImageStrip();
}
// Render unificado del strip de adjuntos (imagenes + documentos de texto).
function pgRenderImageStrip() {
    const $strip = $('#pgImageStrip');
    if (!pg.pendingImages.length && !pg.pendingDocs.length) { $strip.hide().empty(); return; }

    const imgHtml = pg.pendingImages.map((img, i) => `
        <div class="ia-img-chip" title="${pgEscape(img.name)}">
            <img src="${img.dataUrl}" alt="">
            <button type="button" class="ia-img-chip-remove" data-idx="${i}" title="Quitar"><i data-lucide="x"></i></button>
        </div>
    `).join('');

    const fmtKb = (b) => b >= 1024 ? (b / 1024).toFixed(b >= 10240 ? 0 : 1) + ' KB' : b + ' B';
    const docHtml = pg.pendingDocs.map((doc, i) => `
        <div class="ia-doc-chip" title="${pgEscape(doc.name)} (${fmtKb(doc.size)})">
            <i data-lucide="file-text" class="ia-doc-chip-icon"></i>
            <span class="ia-doc-chip-name">${pgEscape(doc.name)}</span>
            <button type="button" class="ia-doc-chip-remove" data-doc-idx="${i}" title="Quitar"><i data-lucide="x"></i></button>
        </div>
    `).join('');

    $strip.html(imgHtml + docHtml).show();
    $strip.find('.ia-img-chip-remove').off('click').on('click', e => pgRemoveImage(parseInt($(e.currentTarget).data('idx'), 10)));
    $strip.find('.ia-doc-chip-remove').off('click').on('click', e => pgRemoveDoc(parseInt($(e.currentTarget).data('doc-idx'), 10)));
    if (window.lucide) lucide.createIcons();
}

/* ── Modal conocimiento ── */
function pgOpenKnowledge() {
    pgRenderContextList();
    $('#pgKnowledgeModal').removeClass('hidden').attr('aria-hidden', 'false');
    if (window.lucide) lucide.createIcons();
}
function pgCloseKnowledge() {
    $('#pgKnowledgeModal').addClass('hidden').attr('aria-hidden', 'true');
}
function pgRenderContextList() {
    const items = Object.values(pg.grimoires);
    const $list = $('#pgContextList').empty();
    const cfg = PG_AGENTS[pg.agentKey] || {};
    const t   = PG_THEMES[pg.theme] || {};
    if ((cfg.render === 'html' || cfg.render === 'code') && t.grimoire) {
        $list.append(`<p class="pg-hint" style="border-left:2px solid var(--vsr-accent);padding-left:8px;">🪄 El grimorio del sistema de diseño activo (<code>${t.grimoire}</code>) se <strong>inyecta automáticamente</strong> según el tema seleccionado, para que ${cfg.render === 'code' ? 'el módulo use ese estilo' : 'el componente se genere con sus clases'}. Aquí solo añades contexto extra.</p>`);
    }
    if (!items.length) { $list.append('<p class="pg-hint">No se encontraron grimorios en <code>.claude/agents/grimorios</code>.</p>'); }
    items.forEach(f => {
        const checked = pg.knowledge.has(f.file) ? 'checked' : '';
        $list.append(`
            <label class="pg-context-item">
                <input type="checkbox" data-ctx="${f.file}" ${checked}>
                <span class="ci-name">${f.file}</span>
                <span class="ci-meta">${f.size || ''}</span>
            </label>
        `);
    });
    $('#pgContextList input[type=checkbox]').on('change', function () {
        const name = $(this).data('ctx');
        if (this.checked) pg.knowledge.add(name); else pg.knowledge.delete(name);
        pgUpdateKnowledgeCount();
        pgSaveSettings();
    });
    pgUpdateKnowledgeCount();
}
function pgUpdateKnowledgeCount() {
    $('#pgKnowledgeCount').text(pg.knowledge.size);
    $('#pgKnowSummary').text(
        pg.knowledge.size
            ? `${pg.knowledge.size} grimorio(s) inyectado(s) como contexto`
            : 'Sin contexto extra — el agente usa solo su prompt'
    );
}
async function pgSavePrompt() {
    const file = pg.agents[pg.agentKey];
    if (!file || !file.fullPath) { pgToast('Ruta del agente no disponible', 'warn'); return; }
    const content = $('#pgPromptEditor').val();
    const $btn = $('#pgPromptSave').prop('disabled', true);
    try {
        const form = new FormData();
        form.append('action', 'save');
        form.append('fullPath', file.fullPath);
        form.append('content', content);
        const res  = await fetch(PG_API, { method: 'POST', body: form });
        const data = await res.json();
        if (data.success) {
            file.raw = content; pg.prompt = content;
            pgToast('Prompt guardado a disco', 'success');
        } else {
            pgToast(data.message || 'Error al guardar', 'error');
        }
    } catch (e) {
        pgToast('Error de red al guardar', 'error');
    }
    $btn.prop('disabled', false);
}

/* ── Chat ── */
function pgClearChat() {
    pg.history = [];
    pg.templates = [];
    pg._activeTplId = null;
    // Cerrar el hilo activo: el próximo diseño abrirá un hilo nuevo. (Al cargar un
    // hilo existente, pgLoadSavedTemplate vuelve a fijar su identidad acto seguido.)
    clearTimeout(pg._autosaveTimer);
    pg.threadSlug = null;
    pg.threadName = '';
    fgUpdateThreadChip();
    pgSaveSettings();
    $('#pgChatBody').html(`
        <div class="pg-empty">
            <i data-lucide="sparkles"></i>
            <div class="pg-empty-title">Pon a prueba a tu agente</div>
            <div class="pg-empty-sub">Escríbele una instrucción y observa el resultado en el sandbox.</div>
        </div>`);
    if (window.lucide) lucide.createIcons();
}

function pgSubmit() {
    if (pg.isBusy) return;
    const $ta  = $('#pgInput');
    const text = $ta.val().trim();
    const hasImages = pg.pendingImages.length > 0;
    const hasDocs   = pg.pendingDocs.length > 0;
    if (!text && !hasImages && !hasDocs) return;
    if (text) { pg._lastUserText = text; fgMaybeAutoName(text); }   // titula templates + hilo
    $ta.val('').css('height', 'auto');
    const images = pg.pendingImages.slice();
    const docs   = pg.pendingDocs.slice();
    pg.pendingImages = [];
    pg.pendingDocs   = [];
    pgRenderImageStrip();
    const fallback = hasImages ? 'Describe esta imagen.' : (hasDocs ? 'Analiza el documento adjunto.' : '');
    pgSend(text || fallback, images, docs);
}

/* Re-pregunta al agente para que rehaga el último resultado con el sistema de
 * diseño del tema recién elegido. Reusa pgSend, así que el grimorio del nuevo
 * tema y su directiva ya viajan en el payload; el agente ve su respuesta previa
 * en el historial y solo cambia clases/tokens. */
function pgRegenerateForTheme() {
    if (pg.isBusy) return;
    const t   = PG_THEMES[pg.theme] || PG_THEMES[PG_DEFAULT_THEME];
    const cfg = PG_AGENTS[pg.agentKey] || { render: 'markdown' };
    const what = cfg.render === 'code' ? 'el módulo' : 'el componente';
    const sys  = t.grimoire
        ? `al sistema de diseño **${t.label}**`
        : 'a un diseño libre (sin paleta impuesta, tú eliges los estilos)';
    pgToast(`Regenerando con ${t.label}…`, 'info');
    pgSend(`Adapta ${what} anterior ${sys}. Conserva la misma estructura y funcionalidad; cambia solo clases, tokens y estilos para respetar ese sistema de diseño.`, []);
}

function pgAppendUser(text, previews, docsMeta) {
    $('#pgChatBody .pg-empty').remove();
    let imgs = '';
    if (Array.isArray(previews) && previews.length) {
        imgs = '<div class="ia-msg-imgs">' + previews.map(u => `<img src="${u}" alt="imagen adjunta" loading="lazy">`).join('') + '</div>';
    }
    let docs = '';
    if (Array.isArray(docsMeta) && docsMeta.length) {
        const fmtKb = (b) => b >= 1024 ? (b / 1024).toFixed(b >= 10240 ? 0 : 1) + ' KB' : (b || 0) + ' B';
        docs = '<div class="ia-msg-docs">' + docsMeta.map(d => `
            <span class="ia-msg-doc-chip" title="${pgEscape(d.name)} (${fmtKb(d.size)})">
                <i data-lucide="file-text"></i><span>${pgEscape(d.name)}</span>
            </span>`).join('') + '</div>';
    }
    const $m = $(`<div class="ia-msg user"><div class="ia-msg-text">${imgs}${docs}${text ? `<p>${pgEscape(text)}</p>` : ''}</div></div>`);
    $m.find('.ia-msg-imgs img').on('click', function () { const s = $(this).attr('src'); if (s) window.open(s, '_blank'); });
    $('#pgChatBody').append($m);
    if (window.lucide) lucide.createIcons();
    pgScroll();
}
function pgAppendTyping() {
    // Mismo indicador que el Visor: loader "quantum" + texto "Analizando…".
    const $t = $(`<div class="ia-msg ai ia-typing-msg" id="pgTyping"><div class="ia-typing-loader">${pgQuantumLoader('Analizando')}</div></div>`);
    $('#pgChatBody').append($t);
    pgScroll();
    return $t;
}
function pgStopTyping() { clearInterval(pg._typingTimer); }   // sin temporizador activo: no-op seguro
// Loader "quantum" replicado de Templates.loader() (coffeeSoft.js) para no cargar
// todo el framework en el Playground: un orbe que muta forma y color. visor.css
// le añade el texto atenuado y los puntos "…" animados, idéntico al Visor.
function pgQuantumLoader(text) {
    if (!document.getElementById('coffeeia-loader-css')) {
        const style = document.createElement('style');
        style.id = 'coffeeia-loader-css';
        style.textContent = '@keyframes coffeeiaQuantum{0%{border-radius:50%;transform:translate(0,0);background:#ec4899}25%{background:#3b82f6}50%{border-radius:40% 60% 50% 50%;transform:translate(1px,-1px);background:#8b5cf6}75%{background:#a855f7}100%{border-radius:50%;transform:translate(0,0);background:#ec4899}}';
        document.head.appendChild(style);
    }
    const txt = text ? `<span style="color:#374151;font-weight:500;font-size:12px">${text}</span>` : '';
    return `<div class="coffeeia-loader" style="display:inline-flex;align-items:center;gap:8px">`
         + `<div style="width:10px;height:10px;border-radius:50%;animation:coffeeiaQuantum 2s steps(8) infinite"></div>`
         + txt + `</div>`;
}

async function pgSend(text, images, docs) {
    pgSetBusy(true);
    images = Array.isArray(images) ? images : [];
    docs   = Array.isArray(docs)   ? docs   : [];

    // Documentos de texto adjuntos: su contenido se embebe en el content (asi el
    // modelo lo recuerda via history); en la burbuja solo mostramos texto + chips.
    let contentForModel = text;
    if (docs.length) {
        const blocks = docs.map(d =>
            `--- INICIO DOC ADJUNTO: ${d.name} ---\n${d.content}\n--- FIN DOC: ${d.name} ---`
        ).join('\n\n');
        contentForModel = (text ? text + '\n\n' : '') +
            '=== DOCUMENTOS ADJUNTOS POR EL USUARIO ===\n' + blocks;
    }

    const userMsg = { role: 'user', content: contentForModel };
    if (images.length) { userMsg.images = images.map(i => i.base64); userMsg.imagesPreview = images.map(i => i.dataUrl); }
    if (docs.length) userMsg.docsMeta = docs.map(d => ({ name: d.name, size: d.size }));
    pg.history.push(userMsg);
    pgAppendUser(text, userMsg.imagesPreview, userMsg.docsMeta);

    // Vista Live: foto fresca del módulo renderizado SOLO para este request (no se
    // guarda en el history para no inflarlo con copias del DOM en cada turno).
    const liveBlock = fgLiveContextBlock();
    if (liveBlock) fgTagUserMsgLive();
    else if (pg.liveContext) pgToast('No pude leer la vista del Live (¿cross-origin o sin módulo?); envío sin ella', 'warn');

    const $typing = pgAppendTyping();
    pgScroll();

    const cfgAgent = PG_AGENTS[pg.agentKey] || { render: 'markdown' };
    const themeCfg = PG_THEMES[pg.theme] || PG_THEMES[PG_DEFAULT_THEME];

    // Conjunto de grimorios a inyectar: los que ancló el usuario + (para agentes
    // que producen UI — HTML renderizable o módulos de código) el grimorio del
    // sistema de diseño seleccionado, para que generen con sus clases/tokens y
    // el módulo respete el estilo del sistema. (BD/markdown no usa estilo visual.)
    const usesDesignSystem = (cfgAgent.render === 'html' || cfgAgent.render === 'code');
    const ctxNames = new Set(pg.knowledge);
    if (usesDesignSystem && themeCfg.grimoire && pg.grimoires[themeCfg.grimoire]) {
        ctxNames.add(themeCfg.grimoire);
    }
    const pinned = Array.from(ctxNames).map(name => {
        const f = pg.grimoires[name];
        return f ? { file: f.file, fullPath: f.fullPath || '', content: f.raw || '' } : null;
    }).filter(Boolean);

    // Directiva de render: le indica al agente qué sistema de diseño usar. En
    // modo libre (sin grimorio) no se impone paleta: conjura con su conocimiento.
    let systemOverride = pg.prompt || '';
    if (cfgAgent.render === 'html') {
        systemOverride += themeCfg.grimoire
            ? `\n\n## Render en Playground\n`
              + `Genera EXCLUSIVAMENTE el componente solicitado siguiendo el grimorio **${themeCfg.label}** incluido en el contexto. ${themeCfg.note}\n`
              + `Devuelve UN solo bloque \`\`\`html con el componente listo para renderizar (sin explicaciones largas).`
            : `\n\n## Render en Playground (lienzo libre)\n`
              + `Genera el componente solicitado con tu propio criterio de diseño. ${themeCfg.note || ''}\n`
              + `Tienes Tailwind disponible en el lienzo. Devuelve UN solo bloque \`\`\`html con el componente listo para renderizar (sin explicaciones largas).`;
    } else if (cfgAgent.render === 'code' && themeCfg.grimoire) {
        // El tema también modela el módulo: su UI/frontend debe usar el sistema
        // de diseño elegido. En modo libre (sin grimorio) no se impone estilo.
        systemOverride += `\n\n## Estilo del sistema (Playground)\n`
            + `La UI/frontend del módulo que generes debe construirse con el sistema de diseño **${themeCfg.label}** (grimorio incluido en el contexto): usa sus clases y tokens, no inventes otra paleta. ${themeCfg.note}`;
    }

    // Contrato de la Fábrica: para que Forge pueda materializar el módulo a
    // disco, cada archivo debe venir en su propio bloque cercado con su ruta
    // relativa en la PRIMERA línea, marcada con `@file:`.
    if (cfgAgent.render === 'code') {
        systemOverride += `\n\n## Salida como módulo (Forge)\n`
            + `Entrega CADA archivo del módulo en su propio bloque cercado. La PRIMERA línea dentro del bloque debe ser su ruta relativa al proyecto, con el marcador \`@file:\` usando el comentario propio del lenguaje. Ejemplo:\n`
            + "```php\n// @file: ctrl/ctrl-productos.php\n<?php /* ... */\n```\n"
            + "```js\n// @file: src/js/productos.js\n/* ... */\n```\n"
            + `Usa \`//\` para php/js/css, \`#\` para yaml, \`<!-- -->\` para html, \`--\` para sql. No mezcles varios archivos en un mismo bloque. La ruta es relativa a la raíz del proyecto destino (ej. \`alpha/pedidos/src/js/app.js\`).`;
    }

    const payload = {
        messages: pg.history.map(m => {
            const o = { role: m.role, content: m.content };
            if (m.images && m.images.length) o.images = m.images;
            return o;
        }),
        systemOverride: systemOverride,
    };
    // Anexa la vista del Live al último mensaje del request (no al history).
    if (liveBlock && payload.messages.length) {
        const last = payload.messages[payload.messages.length - 1];
        last.content = (last.content ? last.content + '\n\n' : '') + liveBlock;
    }
    Object.assign(payload, {
        pinnedFiles:    pinned,
        canvasMode:     !!pg.canvasMode,
        model:          pg.model || ''
    });

    let stream = null, received = '', meta = {}, firstToken = false, streamErr = null;

    // Controlador para abortar la consulta desde el botón Detener.
    const ac = new AbortController();
    pg._abort = ac;

    try {
        const res = await fetch(PG_API_STREAM, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ac.signal
        });
        if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let idx;
            while ((idx = buf.indexOf('\n\n')) !== -1) {
                const rawEvent = buf.slice(0, idx);
                buf = buf.slice(idx + 2);
                let ev = 'message', dataStr = '';
                rawEvent.split('\n').forEach(l => {
                    if (l.startsWith('event:')) ev = l.slice(6).trim();
                    else if (l.startsWith('data:')) dataStr += l.slice(5).trim();
                });
                let obj = {};
                try { obj = dataStr ? JSON.parse(dataStr) : {}; } catch (_) { continue; }
                if (ev === 'chunk') {
                    if (!firstToken) { firstToken = true; pgStopTyping(); $typing.remove(); stream = pgCreateAIStream(); }
                    received += obj.t || '';
                    stream.push(obj.t || '');
                } else if (ev === 'done') {
                    meta = obj;
                } else if (ev === 'error') {
                    streamErr = obj.error || 'Error';
                }
            }
        }
    } catch (err) {
        // Conexión/lectura cortada (típico con HTML grande + timeout) o detenida
        // por el usuario (AbortError): si ya recibimos algo, lo rescatamos.
        pgStopTyping();
        $typing.remove();
        const aborted = err && err.name === 'AbortError';
        if (await pgTryRescuePartial(stream, received, aborted ? 'Generación detenida' : err.message)) { pgFinish(); return; }
        const msg = aborted ? '⏹ Generación detenida.' : ('⚠️ No se obtuvo respuesta. ' + (err.message || ''));
        if (stream) { await stream.drain(); stream.fail(msg); } else { pgAppendAI(msg); }
        pgFinish(); return;
    }

    if (streamErr) {
        $typing.remove();
        if (await pgTryRescuePartial(stream, received, streamErr)) { pgFinish(); return; }
        const m = '⚠️ ' + streamErr;
        if (stream) { await stream.drain(); stream.fail(m); } else { pgAppendAI(m); }
        pgFinish(); return;
    }
    if (!firstToken) { $typing.remove(); pgAppendAI('⚠️ El agente no devolvió respuesta.'); pgFinish(); return; }

    await stream.drain();
    pg.history.push({ role: 'assistant', content: received });
    pgFinalizeResponse(stream, received, {
        credits:          meta.credits_estimate,
        cost:             meta.cost_usd,            // costo real USD (OpenRouter) o null (Ollama)
        promptTokens:     meta.prompt_tokens,
        completionTokens: meta.completion_tokens,
        elapsed_ms:       meta.elapsed_ms
    }, false);
    pgPlayPopSound();
    pgFinish();
}

/* ── Cierre de respuesta ──
 * Acuerdo con el usuario: el CÓDIGO NUNCA se muestra crudo en el chat. Si el
 * agente produce UI/código (render 'html' o 'code') o está activo el modo
 * lienzo, el resultado se vuelca al sandbox (preview + pestaña "Código") y en la
 * burbuja solo queda el texto explicativo + una nota + la miniatura clicable.
 * Solo los agentes de documento (markdown, p.ej. coffee-intelligence) muestran
 * su contenido tal cual en el chat. `interrupted` marca respuestas cortadas. */
function pgFinalizeResponse(stream, received, meta, interrupted) {
    const cfg    = PG_AGENTS[pg.agentKey] || { render: 'markdown' };
    const usesUI = pg.canvasMode || cfg.render === 'html' || cfg.render === 'code';

    let displayText = received;
    if (usesUI) {
        // Quitar TODO bloque ```...``` (html/js/php/...) y cualquier HTML crudo
        // suelto: en el chat solo debe quedar la explicación en prosa.
        let rest = received.replace(/```[a-z0-9+-]*[ \t]*\r?\n?[\s\S]*?```/gi, '').trim();
        if (pgLooksLikeHtml(rest)) rest = '';   // lo que queda sigue siendo HTML/código crudo (sin fence)
        const what = cfg.render === 'code' ? 'Módulo' : 'Componente';
        const note = interrupted
            ? `⚠️ *Respuesta cortada — ${what.toLowerCase()} parcial en el sandbox →*`
            : `🪄 *${what} renderizado en el sandbox →*`;
        displayText = (rest ? rest + '\n\n' : '') + note;
    } else if (interrupted) {
        displayText = received + '\n\n⚠️ *La respuesta se cortó antes de terminar.*';
    }

    stream.complete(displayText, meta, received);
    if (usesUI) {
        const tpl = pgRenderToSandbox(received);
        if (tpl) pgAppendTemplateCard(stream.$msg, tpl);   // miniatura clicable dentro del chat
    }

    // Fábrica: detectar módulo multi-archivo (marcadores @file) y, si lo hay,
    // poblar el panel Módulo y saltar a su pestaña.
    const modFiles = fgParseModule(received);
    fgSetModule(modFiles);
    if (modFiles.length) fgActivateModuleTab();

    // Hilos: abre/actualiza el hilo activo con el último diseño + la conversación.
    fgThreadTrack();
}

/* Rescata el contenido parcial cuando el stream se corta a media generación.
 * Evita el síntoma "mucho HTML se corta y ya no lo renderiza": lo que llegó ya
 * está en `received`, así que lo pintamos (y, en lienzo, lo renderizamos). */
async function pgTryRescuePartial(stream, received, reason) {
    if (!stream || !received) return false;
    await stream.drain();
    pg.history.push({ role: 'assistant', content: received });
    pgFinalizeResponse(stream, received, {}, true);
    pgToast(reason ? ('Respuesta cortada: ' + reason) : 'La respuesta se cortó antes de terminar', 'warn');
    return true;
}

function pgFinish() {
    pgStopTyping();
    pgSetBusy(false);
    pg._abort = null;
    pgScroll();
}

/* ── Estado ocupado ──
 * Mientras el agente genera, el botón Enviar (flecha) se transforma en Detener
 * (cuadrado) y al pulsarlo aborta el fetch en curso, conservando lo ya generado. */
function pgSetBusy(busy) {
    pg.isBusy = !!busy;
    const $btn = $('#pgSendBtn');
    if (busy) {
        $btn.addClass('is-stop').attr('title', 'Detener generación')
            .html('<i data-lucide="square" class="w-3.5 h-3.5"></i>');
    } else {
        $btn.removeClass('is-stop').attr('title', 'Enviar (Enter)')
            .html('<i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>');
    }
    if (window.lucide) lucide.createIcons();
}
function pgStop() {
    if (pg._abort) { try { pg._abort.abort(); } catch (e) {} }
    pgToast('Deteniendo…', 'info');
}

function pgAppendAI(text) {
    $('#pgChatBody').append(`<div class="ia-msg ai"><div class="ia-msg-role"><span class="dot"></span><span>${pgAgentLabel()}</span></div><div class="ia-msg-text">${pgMarkdown(text)}</div></div>`);
    pgScroll();
}

/* ── Motor de streaming (portado del Visor): typewriter + card "Conjurando…" ── */
function pgCreateAIStream() {
    const msgId = 'pgMsg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const $msg = $(`<div class="ia-msg ai" id="${msgId}"><div class="ia-msg-role"><span class="dot"></span><span>${pgAgentLabel()}</span></div><div class="ia-msg-text"></div></div>`);
    $('#pgChatBody').append($msg);
    const $text = $msg.find('.ia-msg-text');

    let pending = '', shown = '', streamDone = false, raf = null, drainCb = null;
    let last = performance.now(), credit = 0;
    let conjuring = false, fullBuf = '', $conjSub = null;
    const HTML_FENCE = /```[ \t]*html/i;
    const ANY_FENCE  = /```[a-z0-9+-]+/i;   // cualquier fence de código (php/js/html/...)
    // HTML crudo sin fence: agentes de UI suelen devolver el componente directo
    // (sin ```). En cuanto aparece un fence de código o un tag estructural entramos
    // a "Conjurando…" para NO pintar el código en el chat (va a la pestaña "Código").
    const RAW_HTML = /<(!doctype html|html|head|body|section|main|header|nav|article|aside|footer|form|table|ul|ol|div|button|h[1-6])[\s>]/i;
    // Agentes que producen UI/código (o modo lienzo): su salida va al sandbox, nunca
    // al chat como código crudo. Los de documento (markdown) sí lo muestran en prosa.
    const cfgStream = PG_AGENTS[pg.agentKey] || {};
    const usesUI    = pg.canvasMode || cfgStream.render === 'html' || cfgStream.render === 'code';
    const shouldConjure = (buf) => HTML_FENCE.test(buf) || (usesUI && (RAW_HTML.test(buf) || ANY_FENCE.test(buf)));

    const isCode  = cfgStream.render === 'code';
    const conjNoun = isCode ? 'módulo' : 'componente';
    function enterConjuring() {
        conjuring = true;
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        pending = '';
        $text.hide().empty();
        const $card = $(`
            <div class="ia-conjuring">
                <span class="ia-conjuring-orb"><i data-lucide="wand-sparkles"></i></span>
                <div class="ia-conjuring-info">
                    <span class="ia-conjuring-title">Conjurando ${conjNoun}…</span>
                    <span class="ia-conjuring-sub">Tejiendo el código</span>
                </div>
            </div>`);
        $card.insertBefore($text);
        $conjSub = $card.find('.ia-conjuring-sub');
        if (window.lucide) lucide.createIcons();
        pgScroll();
    }
    function takeWord() {
        const m = pending.match(/^\s*\S+\s*/);
        const len = m ? m[0].length : pending.length;
        const piece = pending.slice(0, len);
        pending = pending.slice(len);
        return piece;
    }
    function paint() {
        $text.html(pgMarkdown(shown) + '<span class="ia-stream-cursor">▍</span>');
        pgScroll();
    }
    function pump(now) {
        now = now || performance.now();
        const dt = Math.min(100, now - last);
        last = now;
        const wps = 14 + Math.min(46, pending.length / 40);
        credit += (dt / 1000) * wps;
        let painted = false;
        while (credit >= 1 && pending.length) { shown += takeWord(); credit -= 1; painted = true; }
        if (painted) paint();
        if (!pending.length) credit = 0;
        if (streamDone && !pending.length) { raf = null; const cb = drainCb; drainCb = null; if (cb) cb(); return; }
        raf = requestAnimationFrame(pump);
    }
    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(pump); } };

    return {
        $msg,
        push(piece) {
            if (!piece) return;
            fullBuf += piece;
            if (!conjuring && shouldConjure(fullBuf)) enterConjuring();
            if (conjuring) {
                const lines = fullBuf.split('\n').length;
                if ($conjSub) $conjSub.text('Tejiendo el código · ' + lines + (lines === 1 ? ' línea' : ' líneas'));
                return;
            }
            pending += piece; kick();
        },
        drain() {
            if (conjuring) return Promise.resolve();
            return new Promise(res => { streamDone = true; drainCb = res; kick(); });
        },
        complete(displayedText, meta, copyText) {
            if (conjuring) { $msg.find('.ia-conjuring').remove(); $text.show(); }
            let metaHtml = '';
            if (meta) {
                metaHtml = `
                    <div class="ia-msg-meta-footer">
                        ${pgMetaItems(meta)}
                        <span class="meta-actions">
                            <button class="meta-iconbtn ia-copy-btn" title="Copiar respuesta"><i data-lucide="copy" class="w-3 h-3"></i></button>
                        </span>
                    </div>`;
            }
            $text.html(pgMarkdown(displayedText));
            $(metaHtml).appendTo($msg);
            $msg.find('.ia-copy-btn').on('click', () => {
                const t = copyText != null ? copyText : displayedText;
                if (navigator.clipboard) navigator.clipboard.writeText(t);
                pgToast('Respuesta copiada', 'success');
            });
            $msg.find('pre code').each((i, el) => { if (window.hljs) hljs.highlightElement(el); });
            if (window.lucide) lucide.createIcons();
            pgScroll();
        },
        fail(msg) {
            if (conjuring) { $msg.find('.ia-conjuring').remove(); $text.show(); }
            streamDone = true; pending = '';
            if (raf) { cancelAnimationFrame(raf); raf = null; }
            $text.html(pgMarkdown(msg));
            if (window.lucide) lucide.createIcons();
            pgScroll();
        }
    };
}

/* ── Sonido al terminar de responder (pop) ── */
function pgPlayPopSound() {
    try {
        if (!pg._popSound) { pg._popSound = new Audio('src/audio/pop_up.ogg'); pg._popSound.volume = 0.6; }
        pg._popSound.currentTime = 0;
        const p = pg._popSound.play();
        if (p && p.catch) p.catch(() => {});
    } catch (e) {}
}

/* ── Render al sandbox ── */
function pgRenderToSandbox(received) {
    const cfg = PG_AGENTS[pg.agentKey] || { render: 'markdown' };

    if (cfg.render === 'html') {
        const html = pgExtractHtml(received);   // tolerante: fence o crudo
        pgRenderSandbox(html || pgMarkdown(received), !html);
        return html ? pgPushTemplate(html, false) : null;   // solo componentes reales al historial
    }
    if (cfg.render === 'code') {
        pgShowSandboxCode(pgExtractCode(received) || received);
        const html = pgExtractHtml(received);
        if (html) { pgRenderSandbox(html, false); return pgPushTemplate(html, false); }
        return null;
    }
    // Agente markdown: documento. Solo desvía a HTML si vino en fence explícito.
    const fenced = pgExtractCode(received, 'html');
    if (fenced) { pgRenderSandbox(fenced, false); return pgPushTemplate(fenced, false); }
    pgRenderSandbox(pgMarkdown(received), true);
    return null;
}

/* ── Historial de templates renderizados (sesión) ──
 * Cada componente HTML que se vuelca al sandbox se registra y se muestra como
 * una tarjeta-miniatura clicable DENTRO de la burbuja del chat que lo generó.
 * Al hacer clic se vuelve a renderizar en el sandbox (restaurando su tema).
 * Vive solo en memoria: se vacía al limpiar la conversación o recargar. */
function pgPushTemplate(html, isDoc) {
    if (!html) return null;
    const id = 'tpl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const rawTitle = (pg._lastUserText || '').trim();
    const title = rawTitle
        ? (rawTitle.length > 46 ? rawTitle.slice(0, 46) + '…' : rawTitle)
        : 'Componente';
    const tpl = {
        id, html, isDoc: !!isDoc,
        theme:      pg.theme,
        themeLabel: (PG_THEMES[pg.theme] || {}).label || pg.theme,
        title, ts: Date.now()
    };
    pg.templates.push(tpl);
    if (pg.templates.length > 50) pg.templates.shift();   // tope de sesión
    pg._activeTplId = id;
    return tpl;
}

/* Inserta la tarjeta-miniatura clicable al final de la burbuja del chat. */
function pgAppendTemplateCard($msg, tpl) {
    if (!$msg || !$msg.length || !tpl) return;
    const $card = $(`
        <div class="pg-chat-tpl${tpl.id === pg._activeTplId ? ' is-active' : ''}" data-tpl-id="${tpl.id}" title="Clic para ver en el sandbox">
            <div class="pg-chat-tpl-thumb"><iframe class="pg-chat-tpl-frame" sandbox="allow-scripts" scrolling="no" tabindex="-1" aria-hidden="true"></iframe></div>
            <div class="pg-chat-tpl-info">
                <span class="pg-chat-tpl-title">${pgEscape(tpl.title)}</span>
                <span class="pg-chat-tpl-sub">${pgEscape(tpl.themeLabel)}</span>
                <span class="pg-chat-tpl-cta"><i data-lucide="eye" class="w-3 h-3"></i>Ver en el sandbox</span>
            </div>
        </div>`);
    $msg.append($card);
    const fr = $card.find('.pg-chat-tpl-frame')[0];
    if (fr) fr.srcdoc = pgWrapHtml(tpl.html, tpl.theme, tpl.isDoc);
    $card.on('click', () => pgRestoreTemplate(tpl.id));
    if (window.lucide) lucide.createIcons();
    pgScroll();
}

function pgRestoreTemplate(id) {
    const t = pg.templates.find(x => x.id === id);
    if (!t) return;
    pg._activeTplId = id;
    // Restaurar el tema con el que se generó (el sandbox lo envuelve con ese sistema).
    if (t.theme && PG_THEMES[t.theme] && t.theme !== pg.theme) {
        pg.theme = t.theme;
        $('#pgThemeSelect').val(t.theme);
        $('#pgSandboxTheme').text((PG_THEMES[t.theme] || {}).label || t.theme);
        pgSaveSettings();
    }
    pgRenderSandbox(t.html, t.isDoc);
    // Resalta en el chat la tarjeta activa.
    $('.pg-chat-tpl').removeClass('is-active');
    $(`.pg-chat-tpl[data-tpl-id="${id}"]`).addClass('is-active');
    pgToast('Template cargado en el sandbox', 'success');
}
function pgRenderSandbox(htmlBody, isDoc) {
    $('#pgSandboxEmpty').hide();
    pg.lastHtml = htmlBody; pg.lastTheme = pg.theme; pg._lastIsDoc = !!isDoc;
    // El iframe es transparente: si el contenido (sobre todo un documento
    // completo) no pinta su propio fondo, se vería el blanco del contenedor.
    // Pintamos el contenedor con el fondo del tema para que cubra TODO el preview.
    pgUpdateSandboxBg();
    const fr = document.getElementById('pgSandboxFrame');
    fr.onload = () => pgApplyZoom();   // el scroll lo hace el iframe interno; reaplicamos el zoom al cargar
    fr.srcdoc = pgWrapHtml(htmlBody, pg.theme, isDoc);
    // La pestaña "Código" refleja la fuente de lo que se está renderizando.
    if (!isDoc) {
        const $code = $('#pgSandboxCode').find('code').removeAttr('data-highlighted').text(htmlBody);
        if (window.hljs) hljs.highlightElement($code[0]);
    }
    $('.pg-tab[data-sbtab="preview"]').click();
}
function pgShowSandboxCode(code) {
    $('#pgSandboxEmpty').hide();
    const $code = $('#pgSandboxCode').find('code').text(code);
    if (window.hljs) hljs.highlightElement($code[0]);
    $('.pg-tab[data-sbtab="code"]').click();
}

/* ── Viewport del preview/live (móvil/laptop/desktop) ──
 * Fija el ancho del iframe para previsualizar diseños/módulos responsive. 'full'
 * deja el iframe al 100%; 'mobile'/'laptop' centran un ancho concreto (clase
 * .pg-vp-fixed + var --pg-vp-w en el CSS). Mismo patrón que el Playground. */
const PG_VIEWPORTS = {
    mobile: { w: 390 },
    laptop: { w: 1280 },
    full:   { w: 0 }
};
function pgApplyViewport() {
    const mode = PG_VIEWPORTS[pg.viewport] ? pg.viewport : 'full';
    pg.viewport = mode;
    const $body = $('.pg-sandbox-body');
    const fixed = mode !== 'full';
    $body.toggleClass('pg-vp-fixed', fixed);
    $body.css('--pg-vp-w', fixed ? PG_VIEWPORTS[mode].w + 'px' : '');
    $('.pg-vp-btn').each(function () { $(this).toggleClass('is-active', $(this).data('vp') === mode); });
    pgUpdateSandboxBg();
    pgApplyZoom();   // el ancho cambió: reaplicar el zoom acorde al nuevo modo
}
function pgSetViewport(mode) {
    pg.viewport = PG_VIEWPORTS[mode] ? mode : 'full';
    pgApplyViewport();
    pgSaveSettings();
}
// Decide el fondo del área del sandbox según el viewport y la vista activa:
//  - viewport fijo (móvil/laptop): lo deja al CSS (.pg-vp-fixed = fondo escritorio).
//  - full + Live: blanco (los módulos reales son light).
//  - full + Preview: el fondo del tema de diseño activo.
function pgUpdateSandboxBg() {
    const $body = $('.pg-sandbox-body');
    if (pg.viewport && pg.viewport !== 'full') { $body.css('background', ''); return; }
    if (!$('#fgLiveFrame').hasClass('hidden')) { $body.css('background', '#ffffff'); return; }
    const t = PG_THEMES[pg.theme] || PG_THEMES[PG_DEFAULT_THEME];
    $body.css('background', t.bg || '#fff');
}

/* ── Zoom del preview ──
 * Escala el CONTENIDO del iframe (no el tamaño del iframe), que es el único que
 * hace scroll. Usa la propiedad CSS `zoom` (reflowea el layout, a diferencia de
 * transform:scale). Se reaplica en cada render (onload) porque el iframe recarga. */
function pgApplyZoom() {
    const z = (pg.zoom || 100) / 100;
    $('#pgZoomLabel').text((pg.zoom || 100) + '%');
    // Aplica el zoom al iframe visible (Preview o Live).
    const id = $('#fgLiveFrame').hasClass('hidden') ? 'pgSandboxFrame' : 'fgLiveFrame';
    const fr = document.getElementById(id);
    if (!fr) return;

    // Con viewport fijo (móvil/laptop) el ANCHO lo controla el CSS (.pg-vp-fixed);
    // no debemos sobreescribirlo con escalado externo.
    const vpFixed = $('.pg-sandbox-body').hasClass('pg-vp-fixed');

    // 1º intento: zoom "interno" (escala el documento del iframe y respeta su
    // propio scroll). Solo es posible same-origin. Si el módulo Live vive en otro
    // dominio, el navegador prohíbe tocar su documento → lanza excepción y caemos
    // a escalar el ELEMENTO iframe desde fuera (transform), que sí funciona
    // cross-origin. Sin esto, el zoom fallaba en silencio y el módulo no se
    // ajustaba al panel (síntoma "no se visualiza correctamente").
    let innerOk = false;
    try {
        const doc = fr.contentDocument || (fr.contentWindow && fr.contentWindow.document);
        if (doc && doc.documentElement) { doc.documentElement.style.zoom = z; innerOk = true; }
    } catch (e) { innerOk = false; }

    if (innerOk || vpFixed) {
        // Zoom interno OK (o ancho fijo por CSS): limpiar cualquier escalado
        // externo previo y volver al iframe normal (el width lo da CSS).
        fr.style.position = fr.style.top = fr.style.left = '';
        fr.style.transform = fr.style.width = fr.style.height = '';
    } else {
        // Escalado externo (cross-origin): posicionamos el iframe en ABSOLUTO
        // dentro de .pg-sandbox-body (position:relative) y lo dimensionamos en
        // PÍXELES reales del contenedor divididos por el zoom; al escalarlo ocupa
        // EXACTAMENTE el contenedor sin huecos. Usamos px (no %) porque el height
        // en % no siempre resuelve y dejaba el panel recortado mostrando el fondo.
        const host = fr.parentElement;                       // .pg-sandbox-body
        const r = host ? host.getBoundingClientRect() : { width: 0, height: 0 };
        fr.style.position = 'absolute';
        fr.style.top = '0';
        fr.style.left = '0';
        fr.style.transformOrigin = 'top left';
        fr.style.transform = 'scale(' + z + ')';
        fr.style.width  = (r.width  / z) + 'px';
        fr.style.height = (r.height / z) + 'px';
    }
}
function pgSetZoom(z) {
    pg.zoom = Math.max(25, Math.min(200, Math.round(z / 5) * 5));   // 25%–200%, pasos de 5
    pgApplyZoom();
    pgSaveSettings();
}
// Detecta si el HTML ya es un documento completo (head/tailwind/tema propios).
function pgIsFullDoc(html) {
    return /<!doctype\s+html/i.test(html) || /<html[\s>]/i.test(html) ||
           /<head[\s>]/i.test(html) || /<body[\s>]/i.test(html);
}

// Reune los assets de un sistema de diseño: <link> + <style> embebido + <script> + atributos.
function pgThemeAssets(t) {
    const appBase = new URL('.', document.baseURI).href;
    let links = (t.cssUrls || []).map(u =>
        `<link rel="stylesheet" href="${new URL(u, document.baseURI).href}">`).join('');
    // Scripts del tema (p.ej. tailwind-theme.js de CoffeeSoft). DEBEN inyectarse
    // justo después del CDN de Tailwind para que su tailwind.config tenga efecto.
    let scripts = (t.jsUrls || []).map(u =>
        `<script src="${new URL(u, document.baseURI).href}"><\/script>`).join('');
    let style = '';
    if (t.cssFrom === 'grimorio-coffee-varoch.md' && pg._varochCss) {
        style = `<style>${pg._varochCss}</style>`;
    }
    return { appBase, links, style, scripts };
}

function pgWrapHtml(body, themeKey, isDoc) {
    const t = PG_THEMES[themeKey] || PG_THEMES[PG_DEFAULT_THEME];
    const { appBase, links, style, scripts } = pgThemeAssets(t);
    const htmlAttr = t.data ? ` data-theme="${t.data}"` : '';
    // Coffee-Varoch matchea por `.coffee-varoch[data-theme]` en el MISMO elemento
    // (el body), por eso el data-theme también va en el <body> cuando hay bodyClass.
    const bodyData  = (t.bodyClass && t.data) ? ` data-theme="${t.data}"` : '';
    const bodyClass = t.bodyClass ? ` class="${t.bodyClass}"` : '';

    // ── Documento completo: conservar su markup, pero inyectar en su <head> el
    // CSS correcto del sistema de diseño (su <link> relativo suele estar roto en
    // el iframe) + <base> + forzar data-theme/clase de body del tema elegido.
    if (!isDoc && pgIsFullDoc(body)) {
        let doc = body;
        if (/<html/i.test(doc)) {
            doc = doc.replace(/<html(\s[^>]*)?>/i, (m, a) => {
                a = (a || '').replace(/\sdata-theme=("[^"]*"|'[^']*'|\S+)/i, '');
                return `<html${a}${htmlAttr}>`;
            });
        } else {
            doc = `<html${htmlAttr}>` + doc + '</html>';
        }
        const headInject = `<base href="${appBase}">${scripts}${links}${style}`;
        if (/<head(\s[^>]*)?>/i.test(doc)) {
            doc = doc.replace(/<head(\s[^>]*)?>/i, m => `${m}${headInject}`);
        } else {
            doc = doc.replace(/<html(\s[^>]*)?>/i, m => `${m}<head>${headInject}</head>`);
        }
        // Asegurar clase + data-theme del sistema en el <body> (Coffee-Varoch).
        if (t.bodyClass) {
            const dt = t.data ? ` data-theme="${t.data}"` : '';
            if (/<body(\s[^>]*)?>/i.test(doc)) {
                doc = doc.replace(/<body(\s[^>]*)?>/i, (m, a) => {
                    a = (a || '').replace(/\sdata-theme=("[^"]*"|'[^']*'|\S+)/i, '');
                    if (/class=/i.test(a)) a = a.replace(/class=("|')(.*?)\1/i, (mm, q, c) => `class=${q}${c} ${t.bodyClass}${q}`);
                    else a = ` class="${t.bodyClass}"` + a;
                    return `<body${a}${dt}>`;
                });
            } else {
                doc = doc.replace(/<\/head>/i, `</head><body class="${t.bodyClass}"${dt}>`);
            }
        }
        return doc;
    }

    // ── Fragmento o documento markdown: lo envolvemos con Tailwind + el CSS del
    // sistema de diseño + fuente. El componente se CENTRA en el lienzo.
    const center = isDoc
        ? `body{display:block;padding:24px;}.pg-stage{max-width:860px;margin:0 auto;line-height:1.65;}
           .pg-stage h1,.pg-stage h2,.pg-stage h3{margin:1.2em 0 .5em;font-weight:700;}
           .pg-stage pre{background:rgba(0,0,0,.25);padding:12px;border-radius:8px;overflow:auto;}
           .pg-stage table{border-collapse:collapse;}.pg-stage td,.pg-stage th{border:1px solid currentColor;padding:6px 10px;}`
        // `safe center`: centra el componente cuando cabe, pero si es más alto
        // que el iframe alinea al inicio en vez de recortar — así se puede
        // scrollear y ver TODO el componente (login, formularios largos, etc.).
        : `body{min-height:100vh;display:grid;place-content:safe center;padding:28px;}.pg-stage{width:auto;max-width:100%;min-width:0;}`;

    return `<!DOCTYPE html><html${htmlAttr}><head><meta charset="utf-8">
        <base href="${appBase}">
        <script src="https://cdn.tailwindcss.com"><\/script>
        ${scripts}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
        ${links}${style}
        <script src="https://unpkg.com/lucide@latest"><\/script>
        <style>html,body{margin:0;}body{background:${t.bg};color:${t.fg};font-family:'Inter',system-ui,sans-serif;}*{box-sizing:border-box;}${center}</style>
        </head><body${bodyClass}${bodyData}><div class="pg-stage">${body}</div><script>if(window.lucide)lucide.createIcons();<\/script></body></html>`;
}

/* ── Descargar el render como .html ──
 * Empaqueta el MISMO documento autocontenido que "abrir en pestaña" (con su
 * tema, CSS del sistema de diseño embebido y Tailwind) y lo baja como archivo. */
function pgDownloadHtml() {
    if (!pg.lastHtml) { pgToast('Aún no hay nada que descargar', 'warn'); return; }
    const doc  = pgWrapHtml(pg.lastHtml, pg.lastTheme, pg._lastIsDoc);
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const a = document.createElement('a');
    a.href = url;
    a.download = `playground-${pg.lastTheme || pg.theme}-${stamp}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    pgToast('HTML descargado', 'success');
}

/* ── Plantillas persistentes (documents/template/<slug>/) ──
 * A diferencia del historial de sesión (pg.templates, en memoria), estas se
 * guardan a disco: el render + su tema + la conversación que lo generó, para
 * reabrirlas más tarde en un chat independiente. */

// Gemelo JS del slug del backend: minúsculas, sin acentos, separadores a guion.
function pgSlugify(name) {
    return String(name || '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quita acentos
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'plantilla';
}

function pgOpenSaveTemplate() {
    if (!pg.lastHtml) { pgToast('Aún no hay render para guardar', 'warn'); return; }
    const suggested = (pg._lastUserText || '').trim().slice(0, 46);
    $('#pgSaveTplName').val(suggested);
    $('#pgSaveTplSlug').text(suggested ? 'Carpeta: documents/template/' + pgSlugify(suggested) + '/' : '');
    $('#pgSaveTplModal').removeClass('hidden').attr('aria-hidden', 'false');
    setTimeout(() => $('#pgSaveTplName').trigger('focus'), 30);
    if (window.lucide) lucide.createIcons();
}
function pgCloseSaveTemplate() {
    $('#pgSaveTplModal').addClass('hidden').attr('aria-hidden', 'true');
}

async function pgConfirmSaveTemplate() {
    const name = $('#pgSaveTplName').val().trim();
    if (!name) { pgToast('Escribe un nombre para la plantilla', 'warn'); return; }
    if (!pg.lastHtml) { pgToast('No hay render para guardar', 'warn'); return; }

    const t = PG_THEMES[pg.lastTheme] || PG_THEMES[pg.theme] || {};
    const meta = {
        title:      (pg._lastUserText || name).slice(0, 120),
        theme:      pg.lastTheme || pg.theme,
        themeLabel: t.label || (pg.lastTheme || pg.theme),
        agentKey:   pg.agentKey,
        agentLabel: pgAgentLabel(),
        model:      pg.model || '',
        prompt:     pg.prompt || '',
        userText:   pg._lastUserText || '',
        isDoc:      !!pg._lastIsDoc,
        history:    pg.history
    };

    const $btn = $('#pgSaveTplConfirm').prop('disabled', true);
    try {
        const form = new FormData();
        form.append('action', 'savetemplate');
        form.append('name', name);
        form.append('html', pg.lastHtml);
        form.append('meta', JSON.stringify(meta));
        const res  = await fetch(PG_API, { method: 'POST', body: form });
        const data = await res.json();
        if (data.success) {
            pgCloseSaveTemplate();
            pgToast('Plantilla guardada en ' + data.path, 'success');
        } else {
            pgToast(data.message || 'No se pudo guardar', 'error');
        }
    } catch (e) {
        pgToast('Error de red al guardar la plantilla', 'error');
    }
    $btn.prop('disabled', false);
}

async function pgOpenTemplates() {
    $('#pgTemplatesModal').removeClass('hidden').attr('aria-hidden', 'false');
    $('#pgTemplatesList').html('<p class="pg-hint">Cargando plantillas…</p>');
    if (window.lucide) lucide.createIcons();
    try {
        const res  = await fetch(`${PG_API}?action=listtemplates`, { cache: 'no-store' });
        const data = await res.json();
        pg._savedTemplates = data.templates || [];
        pgRenderTemplatesList();
    } catch (e) {
        $('#pgTemplatesList').html('<p class="pg-hint">No se pudieron cargar las plantillas.</p>');
    }
}
function pgCloseTemplates() {
    $('#pgTemplatesModal').addClass('hidden').attr('aria-hidden', 'true');
}
function pgRenderTemplatesList() {
    const items = pg._savedTemplates || [];
    const $list = $('#pgTemplatesList').empty();
    $('#pgTemplatesSummary').text(items.length ? `${items.length} plantilla(s)` : 'Sin plantillas');
    if (!items.length) {
        $list.append('<p class="pg-hint">Aún no has guardado plantillas. Usa el botón <i data-lucide="bookmark-plus" class="w-3 h-3" style="display:inline"></i> del sandbox.</p>');
        if (window.lucide) lucide.createIcons();
        return;
    }
    items.forEach(t => {
        const meta = [t.themeLabel, t.agentLabel, t.savedAt].filter(Boolean).join(' · ');
        const $row = $(`
            <div class="pg-context-item" style="cursor:pointer;align-items:flex-start;flex-direction:column;gap:4px;">
                <div style="display:flex;width:100%;align-items:center;gap:8px;">
                    <i data-lucide="layout-template" class="w-4 h-4" style="color:var(--vsr-accent-soft);"></i>
                    <span class="ci-name">${pgEscape(t.name)}</span>
                    <span class="ci-meta">${pgEscape(t.size || '')}</span>
                    <button type="button" class="pg-tpl-del" title="Eliminar plantilla"><i data-lucide="trash-2"></i></button>
                </div>
                <span class="pg-hint" style="margin:0 0 0 24px;">${pgEscape(meta)}</span>
            </div>`);
        $row.on('click', () => pgLoadSavedTemplate(t));
        $row.find('.pg-tpl-del').on('click', function (e) { e.stopPropagation(); pgDeleteSavedTemplate(t, $(this)); });
        $list.append($row);
    });
    if (window.lucide) lucide.createIcons();
}

/* Carga un hilo/plantilla de disco: restaura su tema, lo pinta en el sandbox y
 * rehidrata su conversación. Fija ese hilo como activo, de modo que seguir
 * iterando autoguarda en él. `resume` (arranque silencioso) evita el toast. */
function pgLoadSavedTemplate(t, resume) {
    if (!t || !t.html) { pgToast('Hilo sin contenido', 'warn'); return; }

    // Restaurar el tema con el que se generó.
    if (t.theme && PG_THEMES[t.theme]) {
        pg.theme = t.theme;
        $('#pgThemeSelect').val(t.theme);
        $('#pgSandboxTheme').text((PG_THEMES[t.theme] || {}).label || t.theme);
        pgSaveSettings();
    }
    // Restaurar agente si difiere.
    if (t.agentKey && PG_AGENTS[t.agentKey] && t.agentKey !== pg.agentKey) {
        $('#pgAgentSelect').val(t.agentKey);
        pgApplyAgent(t.agentKey, true);
    }

    // Arrancamos un chat independiente: limpiamos y, si la plantilla traía
    // conversación, la rehidratamos para que el agente recuerde el contexto.
    pgClearChat();
    pg._lastUserText = t.userText || t.title || t.name || '';
    if (Array.isArray(t.history) && t.history.length) {
        pg.history = t.history.slice();
        $('#pgChatBody .pg-empty').remove();
        pg.history.forEach(m => {
            if (m.role === 'user') {
                pgAppendUser(
                    (m.content || '').replace(/\n\n=== DOCUMENTOS ADJUNTOS[\s\S]*$/, '').trim(),
                    m.imagesPreview, m.docsMeta
                );
            } else if (m.role === 'assistant') {
                pgAppendAI(m.content || '');
            }
        });
    }

    pgRenderSandbox(t.html, !!t.isDoc);
    // Registrar la plantilla en el historial de sesión + su tarjeta en el chat.
    const tpl = pgPushTemplate(t.html, !!t.isDoc);
    if (tpl) {
        tpl.title = t.name || tpl.title;
        const $last = $('#pgChatBody .ia-msg.ai').last();
        pgAppendTemplateCard($last.length ? $last : $('#pgChatBody'), tpl);
    }

    // Fijar este hilo como activo: seguir iterando autoguarda sobre su carpeta.
    pg.threadSlug = t.slug || null;
    pg.threadName = t.name || t.title || pg.threadSlug || '';
    fgUpdateThreadChip();
    pgSaveSettings();

    pgCloseTemplates();
    if (!resume) pgToast('Hilo "' + (t.name || '') + '" abierto', 'success');
}

/* Elimina una plantilla del disco. Confirmación en dos pasos sobre el propio
 * botón: el primer clic lo "arma" (rojo) y el segundo confirma; si no se
 * confirma en 3 s vuelve a su estado normal. */
async function pgDeleteSavedTemplate(t, $btn) {
    if (!t || !t.slug) return;

    if (!$btn.hasClass('is-armed')) {
        $btn.addClass('is-armed').attr('title', 'Pulsa otra vez para eliminar');
        clearTimeout($btn.data('armTimer'));
        $btn.data('armTimer', setTimeout(() => {
            $btn.removeClass('is-armed').attr('title', 'Eliminar plantilla');
        }, 3000));
        return;
    }

    clearTimeout($btn.data('armTimer'));
    $btn.prop('disabled', true);
    try {
        const form = new FormData();
        form.append('action', 'deletetemplate');
        form.append('slug', t.slug);
        const res  = await fetch(PG_API, { method: 'POST', body: form });
        const data = await res.json();
        if (data.success) {
            pg._savedTemplates = (pg._savedTemplates || []).filter(x => x.slug !== t.slug);
            pgRenderTemplatesList();
            pgToast('Plantilla "' + (t.name || t.slug) + '" eliminada', 'success');
        } else {
            pgToast(data.message || 'No se pudo eliminar', 'error');
            $btn.prop('disabled', false).removeClass('is-armed');
        }
    } catch (e) {
        pgToast('Error de red al eliminar la plantilla', 'error');
        $btn.prop('disabled', false).removeClass('is-armed');
    }
}

/* ── Hilos (seguimiento del diseño) ──────────────────────────────
 * Un hilo evoluciona una plantilla: se crea automáticamente al generar el primer
 * diseño y se AUTOGUARDA en su carpeta (documents/template/<slug>/) conforme se
 * itera, persistiendo el último render + la conversación completa. Reabrir un
 * hilo continúa el trabajo EN ESE mismo hilo. Nada de esto toca el proyecto: la
 * materialización sigue siendo un paso aparte explícito. */

// Tras cada respuesta con diseño: si no hay hilo activo lo crea; en cualquier
// caso, autoguarda el estado actual del hilo.
function fgThreadTrack() {
    if (!pg.lastHtml) return;   // sin diseño renderizado no hay hilo que seguir
    if (!pg.threadSlug) {
        const base = (pg._lastUserText || 'Hilo').trim().slice(0, 46) || 'Hilo';
        pg.threadName = base;
        pg.threadSlug = pgSlugify(base) + '-' + Date.now().toString(36);   // único
        fgUpdateThreadChip();
        pgSaveSettings();
        pgToast('Hilo iniciado: ' + pg.threadName, 'info');
    }
    fgThreadSave();
}

// Autoguardado con debounce: vuelca el hilo activo a disco (mismo endpoint que
// las plantillas, pasando el slug fijo del hilo para sobrescribir su carpeta).
function fgThreadSave() {
    if (!pg.threadSlug || !pg.lastHtml) return;
    clearTimeout(pg._autosaveTimer);
    pg._autosaveTimer = setTimeout(fgThreadSaveNow, 500);
}
async function fgThreadSaveNow() {
    if (!pg.threadSlug || !pg.lastHtml) return;
    const t = PG_THEMES[pg.lastTheme] || PG_THEMES[pg.theme] || {};
    const meta = {
        title:      (pg._lastUserText || pg.threadName).slice(0, 120),
        theme:      pg.lastTheme || pg.theme,
        themeLabel: t.label || (pg.lastTheme || pg.theme),
        agentKey:   pg.agentKey,
        agentLabel: pgAgentLabel(),
        model:      pg.model || '',
        prompt:     pg.prompt || '',
        userText:   pg._lastUserText || '',
        isDoc:      !!pg._lastIsDoc,
        history:    pg.history
    };
    try {
        const form = new FormData();
        form.append('action', 'savetemplate');
        form.append('name', pg.threadName || pg.threadSlug);
        form.append('slug', pg.threadSlug);     // hilo fijo: autoguarda sobre su carpeta
        form.append('html', pg.lastHtml);
        form.append('meta', JSON.stringify(meta));
        const res  = await fetch(PG_API, { method: 'POST', body: form });
        const data = await res.json();
        if (data && data.success) fgUpdateThreadChip('saved');
    } catch (e) { /* autoguardado silencioso: no interrumpe la iteración */ }
}

// Pinta el chip del hilo activo en la cabecera del chat.
function fgUpdateThreadChip(state) {
    const $chip = $('#pgThreadChip');
    if (!$chip.length) return;
    if (!pg.threadSlug) { $chip.hide(); return; }
    $chip.css('display', 'inline-flex');
    $('#pgThreadName').text(pg.threadName || pg.threadSlug);
    if (state === 'saved') {
        $('#pgThreadState').text('· guardado');
        clearTimeout(pg._chipTimer);
        pg._chipTimer = setTimeout(() => $('#pgThreadState').text(''), 1500);
    }
    if (window.lucide) lucide.createIcons();
}

// Al arrancar: si había un hilo activo persistido, lo retoma (diseño + chat).
async function fgResumeThread() {
    if (!pg.threadSlug) { fgUpdateThreadChip(); return; }
    try {
        const res  = await fetch(`${PG_API}?action=listtemplates`, { cache: 'no-store' });
        const data = await res.json();
        const t = (data.templates || []).find(x => x.slug === pg.threadSlug);
        if (t) { pgLoadSavedTemplate(t, true); return; }
    } catch (e) {}
    // El hilo ya no existe en disco: limpiar la referencia.
    pg.threadSlug = null; pg.threadName = '';
    pgSaveSettings();
    fgUpdateThreadChip();
}

/* ── Helpers ── */
function pgAgentLabel() { return (PG_AGENTS[pg.agentKey] || {}).label || 'Agente'; }
function pgScroll() { const el = document.getElementById('pgChatBody'); if (el) el.scrollTop = el.scrollHeight; }
function pgMarkdown(text) {
    if (typeof marked !== 'undefined' && marked.parse) {
        const html = marked.parse(text);
        return (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(html, { ADD_ATTR: ['target'] }) : html;
    }
    return '<p>' + pgEscape(text).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
}
function pgExtractCode(text, lang) {
    const re = lang
        ? new RegExp('```' + lang + '[ \\t]*\\r?\\n?([\\s\\S]*?)```', 'i')
        : /```[a-z0-9+-]*[ \t]*\r?\n?([\s\S]*?)```/i;
    const m = text.match(re);
    return m ? m[1].trim() : '';
}
// ¿El texto parece HTML (tiene tags estructurales)?
function pgLooksLikeHtml(text) {
    return /<!doctype html|<html[\s>]|<head[\s>]|<body[\s>]|<(div|section|main|header|nav|table|article|ul|ol|form|button|span|img|svg|h[1-6]|p)[\s>]/i.test(text || '');
}
// Extrae HTML renderizable de la respuesta, tolerante a fences mal formados o
// HTML crudo sin fence (causa frecuente de "no renderiza").
function pgExtractHtml(text) {
    const s = text || '';
    // 1) bloque ```html cerrado (con/sin salto, espacios, mayúsculas)
    let m = s.match(/```[ \t]*html[ \t]*\r?\n?([\s\S]*?)```/i);
    if (m && m[1].trim()) return m[1].trim();
    // 2) cualquier fence cerrado cuyo contenido parezca HTML
    m = s.match(/```[a-z0-9+-]*[ \t]*\r?\n?([\s\S]*?)```/i);
    if (m && pgLooksLikeHtml(m[1])) return m[1].trim();
    // 3) fence ```html ABIERTO pero sin cerrar (respuesta truncada): tomamos
    //    todo lo que sigue al fence — sin arrastrar el preámbulo de texto.
    m = s.match(/```[ \t]*html[ \t]*\r?\n?([\s\S]*)$/i);
    if (m && pgLooksLikeHtml(m[1])) return m[1].replace(/```\s*$/, '').trim();
    // 4) HTML crudo / fence suelto → quitamos marcadores ``` sueltos
    if (pgLooksLikeHtml(s)) return String(s).replace(/```[a-z0-9+-]*[ \t]*/gi, '').trim();
    return '';
}
function pgEscape(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function pgToast(msg, type, ms) {
    const $t = $('#pgToast');
    $t.text(msg).attr('data-tone', type || 'info').addClass('visible');
    clearTimeout(pg._toast);
    pg._toast = setTimeout(() => $t.removeClass('visible'), ms || 2800);
}

/* ════════════════════════════════════════════════════════════════
   FÁBRICA — parseo de módulos multi-archivo y materialización a disco.
   El agente marca cada archivo con `@file: ruta` (primera línea del
   bloque). Aquí se extraen, se muestran, se previsualizan contra el
   proyecto destino (diff) y se escriben sólo tras confirmación.
   ════════════════════════════════════════════════════════════════ */

// Marcador de archivo: tolera el comentario propio de cada lenguaje
// (// , # , -- , ; , /* */ , <!-- -->) o el @file desnudo.
const FG_FILE_MARKER = /^[ \t]*(?:\/\/|#|--|;|\/\*|<!--)?[ \t]*@file:[ \t]*(.+?)[ \t]*(?:\*\/|-->)?[ \t]*$/i;

/** Extrae [{path, lang, content}] de la respuesta del agente. */
function fgParseModule(text) {
    if (!text) return [];
    const files = [];
    const fenceRe = /```([a-z0-9+\-.]*)[ \t]*\r?\n([\s\S]*?)```/gi;
    let m;
    while ((m = fenceRe.exec(text)) !== null) {
        const lang = (m[1] || '').toLowerCase();
        let body   = m[2];
        let path   = null;

        // (a) el marcador es la primera línea no vacía DENTRO del bloque
        const lines = body.split('\n');
        let i = 0;
        while (i < lines.length && lines[i].trim() === '') i++;
        const inner = lines[i] != null ? lines[i].match(FG_FILE_MARKER) : null;
        if (inner) {
            path = inner[1].trim();
            lines.splice(0, i + 1);
            body = lines.join('\n').replace(/^\s*\r?\n/, '');
        } else {
            // (b) el marcador está en la línea justo ANTES del bloque cercado
            const before = text.slice(0, m.index).split('\n').filter(l => l.trim() !== '');
            const prev   = before.length ? before[before.length - 1] : '';
            const pm = prev.match(FG_FILE_MARKER);
            if (pm) path = pm[1].trim();
        }
        if (path) {
            path = path.replace(/^["'`]+|["'`]+$/g, '').replace(/^\.\//, '');
            files.push({ path, lang, content: body.replace(/\s+$/, '') });
        }
    }
    return files;
}

/** Icono lucide por extensión de archivo. */
function fgFileIcon(path) {
    const ext = (String(path).split('.').pop() || '').toLowerCase();
    if (ext === 'php') return 'file-code';
    if (['js', 'mjs', 'ts'].indexOf(ext) !== -1) return 'file-code-2';
    if (['css', 'scss', 'less'].indexOf(ext) !== -1) return 'palette';
    if (['html', 'htm'].indexOf(ext) !== -1) return 'code-2';
    if (['md', 'markdown', 'txt'].indexOf(ext) !== -1) return 'file-text';
    if (['json', 'yml', 'yaml', 'xml'].indexOf(ext) !== -1) return 'braces';
    if (ext === 'sql') return 'database';
    return 'file';
}

/** Carga los proyectos destino (subcarpetas de www) en el selector. */
async function fgLoadProjects() {
    try {
        const res  = await fetch(`${FG_API}?action=projects`, { cache: 'no-store' });
        const data = await res.json();
        pg.projects = data.projects || [];
        pg.vhosts = data.vhosts || [];          // vhosts dentro de www (para abrir en su URL real)
        pg._container = data.container || '';   // proyecto que aloja al visor
    } catch (e) { pg.projects = []; pg.vhosts = []; }
    const $sel = $('#fgProjectSelect').empty();
    pg.projects.forEach(p => $sel.append(`<option value="${pgEscape(p.key)}">${pgEscape(p.name)}</option>`));
    if (pg.project && pg.projects.some(p => p.key === pg.project)) $sel.val(pg.project);
    else pg.project = $sel.val() || '';
}

/** Guarda el módulo parseado y refresca badge + panel. */
function fgSetModule(files) {
    pg.module.files = Array.isArray(files) ? files : [];
    const n = pg.module.files.length;
    const $count = $('#fgModuleCount');
    if (n > 0) $count.text(n).show(); else $count.hide();
    fgRenderModulePanel();
}

/** Si hay módulo, salta a la pestaña Módulo. */
function fgActivateModuleTab() {
    if (!pg.module.files.length) return;
    $('#pgSandboxEmpty').hide();
    $('.pg-tab[data-sbtab="module"]').trigger('click');
}

function fgRenderModulePanel() {
    const $list = $('#fgModuleList').empty();
    const files = pg.module.files;
    if (!files.length) {
        $list.html('<div class="fg-module-empty"><i data-lucide="package-open"></i><p>El agente aún no generó un módulo. Pídele los archivos con el marcador <code>// @file: ruta</code> en cada bloque.</p></div>');
        if (window.lucide) lucide.createIcons();
        return;
    }
    files.forEach((f, i) => {
        const lines = f.content ? f.content.split('\n').length : 0;
        $list.append(`
            <div class="fg-file" data-idx="${i}" title="Ver contenido">
                <i data-lucide="${fgFileIcon(f.path)}" class="fg-file-icon"></i>
                <span class="fg-file-path">${pgEscape(f.path)}</span>
                <span class="fg-file-meta">${pgEscape(f.lang || '')}${f.lang ? ' · ' : ''}${lines} ln</span>
            </div>`);
    });
    $list.find('.fg-file').on('click', function () {
        const f = pg.module.files[parseInt($(this).data('idx'), 10)];
        if (f) pgShowSandboxCode(f.content);
    });
    if (window.lucide) lucide.createIcons();
}

/** Previsualiza el módulo contra el proyecto destino (diff, sin escribir). */
async function fgPreview() {
    if (!pg.module.files.length) { pgToast('No hay módulo que previsualizar', 'warn'); return; }
    if (!pg.project)             { pgToast('Elige un proyecto destino', 'warn'); return; }
    const $b1 = $('#fgPreviewBtn').prop('disabled', true);
    const $b2 = $('#fgMaterializeBtn').prop('disabled', true);
    try {
        const form = new FormData();
        form.append('action', 'preview');
        form.append('project', pg.project);
        form.append('files', JSON.stringify(pg.module.files.map(f => ({ path: f.path, content: f.content }))));
        const res  = await fetch(FG_API, { method: 'POST', body: form });
        const data = await res.json();
        if (!data.success) pgToast(data.message || 'Error al previsualizar', 'error');
        else fgOpenPreviewModal(data);
    } catch (e) { pgToast('Error de red al previsualizar', 'error'); }
    $b1.prop('disabled', false); $b2.prop('disabled', false);
}

function fgOpenPreviewModal(data) {
    $('#fgPreviewProject').text(data.project || pg.project);
    const $list = $('#fgPreviewList').empty();
    let nNew = 0, nMod = 0, nBlocked = 0;
    (data.files || []).forEach(f => {
        let badge, tone;
        if (f.status === 'new')            { badge = 'NUEVO';       tone = 'new';     nNew++; }
        else if (f.status === 'modified')  { badge = 'SOBRESCRIBE'; tone = 'mod';     nMod++; }
        else if (f.status === 'identical') { badge = 'SIN CAMBIOS'; tone = 'same';            }
        else                               { badge = 'BLOQUEADO';   tone = 'blocked'; nBlocked++; }
        const meta = f.status === 'blocked'
            ? pgEscape(f.reason || '')
            : (f.status === 'modified' ? `${f.oldLines} → ${f.newLines} ln` : `${f.newLines || 0} ln`);
        $list.append(`
            <div class="fg-prev-row tone-${tone}">
                <span class="fg-prev-badge">${badge}</span>
                <span class="fg-prev-path">${pgEscape(f.path)}</span>
                <span class="fg-prev-meta">${meta}</span>
            </div>`);
    });
    const parts = [];
    if (nNew)     parts.push(`${nNew} nuevo(s)`);
    if (nMod)     parts.push(`${nMod} sobrescribe(n)`);
    if (nBlocked) parts.push(`${nBlocked} bloqueado(s)`);
    $('#fgPreviewSummary').text(parts.join(' · ') || 'Sin archivos');
    $('#fgPreviewConfirm').prop('disabled', (nNew + nMod) === 0);
    $('#fgPreviewModal').removeClass('hidden').attr('aria-hidden', 'false');
    if (window.lucide) lucide.createIcons();
}
function fgClosePreviewModal() {
    $('#fgPreviewModal').addClass('hidden').attr('aria-hidden', 'true');
}

/** Escribe el módulo al proyecto (tras confirmar en el modal de diff). */
async function fgMaterialize() {
    if (!pg.module.files.length || !pg.project) return;
    const $btn = $('#fgPreviewConfirm').prop('disabled', true);
    try {
        const form = new FormData();
        form.append('action', 'materialize');
        form.append('project', pg.project);
        form.append('files', JSON.stringify(pg.module.files.map(f => ({ path: f.path, content: f.content }))));
        const res  = await fetch(FG_API, { method: 'POST', body: form });
        const data = await res.json();
        if (data.success) {
            pgToast(`Materializado: ${(data.written || []).length} archivo(s) en ${pg.project}`, 'success');
            fgClosePreviewModal();
        } else {
            const errs = (data.errors || []).map(e => e.path + ': ' + e.reason).join('; ');
            pgToast(errs ? ('No se escribieron: ' + errs) : (data.message || 'Error al materializar'), 'error');
        }
    } catch (e) { pgToast('Error de red al materializar', 'error'); }
    $btn.prop('disabled', false);
}

/* ── Trabajar sobre un módulo EXISTENTE ──
 * Carga el módulo real (su URL pública) en el sandbox: corre con su backend,
 * sesión y datos reales. Importa los archivos fuente al contexto del agente para
 * que los modifique, y luego el ciclo normal (módulo → diff → materializar) los
 * reescribe. No hay edición visual que se guarde sola: el preview es para VER,
 * el agente + diff es quien toca el código. */

// URL base del proyecto que contiene al visor: el visor vive en
// <base>/coffee/app/visor/, así que <base> es justo lo que va antes. Sirve para
// el caso normal (vhost con docroot = el proyecto, p.ej. www.cs-huubie.com → /).
function fgContainerBase() {
    const p = location.pathname;
    const i = p.indexOf('/coffee/app/visor/');
    const before = i >= 0 ? p.slice(0, i) : '';   // '' (docroot=proyecto) o '/huubie' (docroot=www)
    return location.origin + before + '/';
}

// Busca, entre los vhosts detectados dentro de www, el DocumentRoot que sirve
// `project/relPath` y compone la URL pública recortando ese docroot (p.ej.
// grupovaroch/erp-gv/index.php → http://www.erp-pro.com/index.php). Gana el
// docroot más específico. Devuelve '' si ninguna ruta cae bajo un vhost.
function fgVhostUrlFor(project, relPath) {
    const key = (project + '/' + relPath).replace(/\/+/g, '/').replace(/^\//, '');
    const keyLc = key.toLowerCase();
    let best = null;
    (pg.vhosts || []).forEach(v => {
        const root = String(v.rel || '').replace(/^\/+|\/+$/g, '');   // docroot relativo a www
        if (!root) return;                                            // www-root (localhost): no secuestra
        const rootLc = root.toLowerCase();
        const isPrefix = keyLc === rootLc || keyLc.indexOf(rootLc + '/') === 0;
        if (isPrefix && (!best || root.length > best.len)) best = { len: root.length, server: v.server };
    });
    if (!best) return '';
    const rest = key.slice(best.len).replace(/^\/+/, '');             // ruta relativa al docroot del vhost
    return location.protocol + '//' + best.server + '/' + rest;
}

// Base same-origin de www cuando el visor se sirve con docroot=www (p.ej.
// localhost/huubie/coffee/app/visor/…). En ese caso CUALQUIER proyecto de www es
// alcanzable bajo el MISMO origen que Forge (localhost/<project>/…), lo que
// preserva "Recrear" (leer el DOM del iframe) y la herencia de cookies de sesión.
// Devuelve '' si no es deducible (docroot=proyecto, p.ej. servido por vhost).
function fgWwwOriginBase() {
    const p = location.pathname;
    const i = p.indexOf('/coffee/app/visor/');
    const before = i >= 0 ? p.slice(0, i) : '';        // '/huubie' (docroot=www) o '' (docroot=proyecto)
    const cont   = pg._container ? '/' + pg._container : '';
    if (before && cont && before.toLowerCase() === cont.toLowerCase()) {
        return location.origin + '/';                  // www vive en el origen actual
    }
    return '';
}

// URL de apertura propuesta para un archivo. Prioridad:
//   1) base recordada por el usuario (override manual explícito),
//   2) proyecto que aloja al visor → su mismo origen,
//   3) MISMO origen que Forge si www es alcanzable así (preserva Recrear +
//      cookies de sesión; evita abrir el módulo en otro dominio),
//   4) vhost real detectado para esa ruta (cuando no hay same-origin posible),
//   5) base del proyecto contenedor del visor (último recurso).
function fgComposeOpenUrl(project, relPath) {
    const rel    = String(relPath || '').replace(/^\/+/, '');
    const stored = localStorage.getItem('forge:openbase:' + project);
    if (stored) {
        let base = stored;
        if (!/\/$/.test(base)) base += '/';
        return base + rel;
    }
    if (project === pg._container) {
        let base = fgContainerBase();
        if (!/\/$/.test(base)) base += '/';
        return base + rel;
    }
    const wwwBase = fgWwwOriginBase();
    if (wwwBase) return wwwBase + project + '/' + rel;
    const vurl = fgVhostUrlFor(project, rel);
    if (vurl) return vurl;
    let base = fgContainerBase();
    if (!/\/$/.test(base)) base += '/';
    return base + rel;
}
// Prellena el campo de URL con el mejor intento y la abre (el usuario puede
// corregirla y reabrir con "Abrir URL" si su app usa otra base).
function fgOpenModuleInSandbox(project, relPath) {
    pg._openProject = project;
    pg._openRel     = String(relPath || '').replace(/^\/+/, '');
    const url = fgComposeOpenUrl(project, relPath);
    $('#fgOpenUrl').val(url);
    fgLoadUrlInSandbox(url);
}
// Abre lo que haya escrito el usuario y RECUERDA la base por proyecto (la URL
// sin la ruta relativa al final), para que el próximo "Abrir" ya salga bien.
function fgOpenManualUrl() {
    const url = ($('#fgOpenUrl').val() || '').trim();
    if (!url) { pgToast('Escribe una URL', 'warn'); return; }
    if (pg._openProject && pg._openRel && url.endsWith(pg._openRel)) {
        localStorage.setItem('forge:openbase:' + pg._openProject, url.slice(0, url.length - pg._openRel.length));
        fgUpdateBaseHint();
    }
    fgLoadUrlInSandbox(url);
}
// Carga el módulo real en el iframe LIVE (separado del Preview de diseños).
// `restore` = true cuando se reabre solo al iniciar Forge (recuerdo del último
// módulo): no roba el foco del tab ni grita en el toast.
function fgLoadUrlInSandbox(url, restore) {
    const fr = document.getElementById('fgLiveFrame');
    pgUpdateSandboxBg();   // fondo neutro claro en full (módulos reales son light); en viewport fijo lo da el CSS
    // Para "Recrear" hay que leer el DOM del iframe → solo si es mismo origen.
    let sameOrigin = false;
    try { sameOrigin = new URL(url, location.href).origin === location.origin; } catch (e) { sameOrigin = false; }
    fr.onload = () => pgApplyZoom();
    fr.src = url;
    pg._liveModule = { url, sameOrigin };
    fgReflectRecreate();
    $('#fgLiveDot').show();
    // Recordar el último módulo abierto para reabrirlo en la próxima sesión.
    try {
        localStorage.setItem('forge:lastmodule', JSON.stringify({
            url, project: pg._openProject || '', rel: pg._openRel || ''
        }));
    } catch (e) {}
    if (restore) {
        pgToast('Módulo recordado: ' + url, 'info');
        return;   // al restaurar dejamos el tab donde esté; el dot avisa que hay Live
    }
    $('.pg-tab[data-sbtab="live"]').click();
    fgCloseBrowser();   // cerramos para ver el resultado; el campo recuerda la URL
    pgToast('Módulo en vivo: ' + url, 'info');
    if (!sameOrigin) {
        pgToast('Ojo: el módulo está en otro dominio; "Recrear" no podrá copiarlo. Abre Forge en ' + (new URL(url, location.href)).origin, 'warn');
    }
}
// Reabre el último módulo que se cargó en Live (persistido en localStorage), de
// modo que al volver a Forge el módulo siga disponible sin volver a navegarlo.
function fgRestoreLastModule() {
    let m = null;
    try { m = JSON.parse(localStorage.getItem('forge:lastmodule') || 'null'); } catch (e) {}
    if (!m || !m.url) return;
    pg._openProject = m.project || null;
    pg._openRel     = m.rel || '';
    $('#fgOpenUrl').val(m.url);
    fgLoadUrlInSandbox(m.url, true);
}

/* ── Copiar el módulo del Live al chat del agente ──
 * El Live es same-origin, así que leemos su DOM ya renderizado (con datos) y
 * copiamos el módulo COMPLETO tal cual al contexto del agente para iterarlo. */
function fgLiveDoc() {
    const fr = document.getElementById('fgLiveFrame');
    try { return fr.contentDocument || (fr.contentWindow && fr.contentWindow.document); } catch (e) { return null; }
}
// Para que "Recrear" funcione, Forge y el módulo deben compartir ORIGEN. El host
// `localhost` sirve TODA www, así que abrir Forge por localhost hace que cualquier
// proyecto de www (erp-gv, etc.) se cargue como localhost/<proyecto>/… → mismo
// origen → se puede leer su DOM. Devuelve esa URL recomendada de Forge.
function fgLocalhostForgeUrl() {
    const p = location.pathname;
    const i = p.indexOf('/coffee/app/visor/');
    const rest = i >= 0 ? p.slice(i + 1) : 'coffee/app/visor/forge.php';   // coffee/app/visor/forge.php
    return location.protocol + '//localhost/' + (pg._container || 'huubie') + '/' + rest;
}
// Refleja en los botones de recrear si el Live es alcanzable (same-origin) o no.
// Ambas opciones (módulo completo y selección) leen el DOM del iframe, así que en
// cross-origin las atenuamos y guiamos a abrir Forge por localhost o usar Importar.
function fgReflectRecreate() {
    const cross = !!(pg._liveModule && pg._liveModule.sameOrigin === false);
    $('#fgRecFab, #fgRecSelectFab').toggleClass('fg-disabled', cross);
    if (cross) {
        const origin = pg._liveModule.url ? (new URL(pg._liveModule.url, location.href)).origin : 'otro dominio';
        const msg = 'No disponible: el módulo está en ' + origin + ' (otro dominio que Forge). Para recrearlo, abre Forge por ' + fgLocalhostForgeUrl() + ' (mismo origen). Alternativa: "Abrir módulo existente" (📂) → Importar trae el fuente al contexto.';
        $('#fgRecFab, #fgRecSelectFab').attr('title', msg);
    } else {
        $('#fgRecFab').attr('title', 'Copiar el módulo completo (HTML renderizado) al chat del agente');
        $('#fgRecSelectFab').attr('title', 'Seleccionar un componente del Live y recrearlo');
    }
    // La "Vista Live" del chat lee el DOM del iframe: si el nuevo módulo es
    // cross-origin no se puede leer, así que la apagamos para no engañar.
    if (cross && pg.liveContext) {
        pg.liveContext = false;
        pgSaveSettings();
        pgToast('Vista Live desactivada: el módulo abierto está en otro dominio que Forge', 'warn');
    }
    pgApplyLiveUI();
}

/* ── Vista Live en el chat ──
 * Toggle de la barra de input: con él ENCENDIDO, cada mensaje que mandes lleva
 * adjunto el HTML renderizado del Live (foto fresca en cada envío). Así puedes
 * preguntar "viendo este layout, ¿qué mejorarías?" sin copiar nada a mano. */
function fgToggleLiveContext() {
    if (!pg.liveContext) {
        // Activar exige un Live legible (same-origin). Sin módulo → guiamos a abrirlo.
        if (!pg._liveModule) {
            pgToast('Primero abre un módulo en Live (📂) para que el agente lo vea', 'warn');
            fgOpenBrowser();
            return;
        }
        if (pg._liveModule.sameOrigin === false || !fgLiveDoc()) {
            const origin = pg._liveModule.url ? (new URL(pg._liveModule.url, location.href)).origin : 'otro dominio';
            pgToast('El Live está en ' + origin + ' (otro dominio que Forge): no puedo leer su vista. Abre Forge por ' + fgLocalhostForgeUrl() + ', o usa 📂 → Importar para traer el fuente.', 'error', 9000);
            return;
        }
        pg.liveContext = true;
        pgToast('Vista Live activada: el agente verá el módulo en cada mensaje', 'success');
    } else {
        pg.liveContext = false;
        pgToast('Vista Live desactivada', 'info');
    }
    pgApplyLiveUI();
    pgSaveSettings();
}

function pgApplyLiveUI() {
    const $btn = $('#pgLiveToggle');
    if (!$btn.length) return;
    const hasLive = !!pg._liveModule;
    $btn.toggleClass('is-active', !!pg.liveContext);
    $btn.attr('title', pg.liveContext
        ? 'Vista Live ACTIVA — el agente recibe el módulo renderizado en cada mensaje'
        : (hasLive ? 'Adjuntar la vista del Live al chat (el agente verá el módulo)'
                   : 'Abre un módulo en Live (📂) y actívalo para que el agente lo vea'));
}

// Bloque de contexto con la foto fresca del Live para el request actual. Vacío
// si la Vista Live está apagada o el Live no se puede leer (cross-origin).
function fgLiveContextBlock() {
    if (!pg.liveContext) return '';
    const cap = fgCaptureLiveHtml();
    if (!cap) return '';
    const url = (pg._liveModule && pg._liveModule.url) || '';
    return '=== VISTA ACTUAL DEL MÓDULO EN VIVO (Live) ===\n'
        + 'Esto es el HTML YA RENDERIZADO (con datos reales) del módulo que el usuario está viendo'
        + (url ? ' en ' + url : '') + '. Tómalo como referencia visual y estructural para responder; '
        + 'no lo repitas en tu respuesta.\n'
        + '--- INICIO VISTA LIVE ---\n' + cap.html + '\n--- FIN VISTA LIVE ---';
}

// Marca la última burbuja del usuario con un chip que indica que el agente
// recibió la vista del Live (para que quede claro en el historial del chat).
function fgTagUserMsgLive() {
    const url = (pg._liveModule && pg._liveModule.url) || '';
    const $text = $('#pgChatBody .ia-msg.user').last().find('.ia-msg-text');
    if (!$text.length) return;
    $text.prepend(
        '<div class="ia-msg-docs"><span class="ia-msg-doc-chip fg-live-chip" title="El agente recibió la vista renderizada del Live'
        + (url ? ': ' + pgEscape(url) : '') + '"><i data-lucide="radio"></i><span>Vista Live</span></span></div>'
    );
    if (window.lucide) lucide.createIcons();
}

/* ── Capturar el Live como IMAGEN (para modelos con visión) ──
 * Alternativa barata a la "Vista Live" en HTML: rasteriza el DOM del Live con
 * html2canvas y lo adjunta como imagen al chat (pipeline de visión existente).
 * Para preguntas de layout una foto cuesta muchísimos menos tokens que el HTML.
 * Requiere same-origin (leer el DOM del iframe), igual que "Recrear". */
let _fgH2CPromise = null;
function fgLoadHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    if (_fgH2CPromise) return _fgH2CPromise;
    _fgH2CPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload  = () => resolve(window.html2canvas);
        s.onerror = () => { _fgH2CPromise = null; reject(new Error('no se pudo cargar html2canvas')); };
        document.head.appendChild(s);
    });
    return _fgH2CPromise;
}
// Reescala un canvas a un ancho máximo y lo exporta como JPEG (limita el peso de
// la captura). Si ya cabe, exporta directo.
function fgCanvasToScaledJpeg(canvas, maxW, quality) {
    if (canvas.width <= maxW) return canvas.toDataURL('image/jpeg', quality);
    const ratio = maxW / canvas.width;
    const c2 = document.createElement('canvas');
    c2.width = maxW; c2.height = Math.max(1, Math.round(canvas.height * ratio));
    const ctx = c2.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c2.width, c2.height);
    ctx.drawImage(canvas, 0, 0, c2.width, c2.height);
    return c2.toDataURL('image/jpeg', quality);
}
async function fgCaptureLiveImage() {
    if (!pg._liveModule) { pgToast('Primero abre un módulo en Live (📂) para capturarlo', 'warn'); fgOpenBrowser(); return; }
    const doc = fgLiveDoc();
    if (!doc || !doc.body) {
        const origin = pg._liveModule.url ? (new URL(pg._liveModule.url, location.href)).origin : 'otro dominio';
        pgToast('No puedo capturar: el Live está en ' + origin + ' (otro dominio que Forge). Abre Forge por ' + fgLocalhostForgeUrl() + ' y reabre el módulo.', 'error', 9000);
        return;
    }
    const $btn = $('#pgLiveShotBtn');
    if ($btn.hasClass('is-busy')) return;
    const prevHtml = $btn.html();
    $btn.addClass('is-busy').html('<i data-lucide="loader-2" class="w-3 h-3 fg-spin"></i>');
    if (window.lucide) lucide.createIcons();
    pgToast('Capturando la vista del Live…', 'info');
    try {
        const h2c = await fgLoadHtml2Canvas();
        const el  = doc.body;
        const canvas = await h2c(el, {
            useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false,
            scale: Math.min(window.devicePixelRatio || 1, 1.5),
            width: el.scrollWidth, height: el.scrollHeight,
            windowWidth: el.scrollWidth, windowHeight: el.scrollHeight
        });
        const dataUrl = fgCanvasToScaledJpeg(canvas, 1600, 0.85);
        pg.pendingImages.push({
            dataUrl, base64: dataUrl.replace(/^data:[^;]+;base64,/, ''),
            mime: 'image/jpeg', name: 'vista-live.jpg'
        });
        pgRenderImageStrip();
        const kb = Math.round((dataUrl.length * 0.75) / 1024);
        pgToast('Captura del Live adjunta (' + kb + ' KB). Escríbele tu pregunta sobre el diseño.', 'success', 5000);
        if (pg.model && !PG_VISION_MODELS.has(pg.model)) {
            pgToast('Ojo: el modelo activo quizá no procesa imágenes. Para que "vea" la captura usa uno con visión (MiniMax, Gemini, Gemma o Kimi).', 'warn', 8000);
        }
    } catch (e) {
        pgToast('No se pudo capturar el Live: ' + (e && e.message ? e.message : e), 'error', 8000);
    } finally {
        $btn.removeClass('is-busy').html(prevHtml);
        if (window.lucide) lucide.createIcons();
    }
}
// Copia el MÓDULO COMPLETO (su HTML ya renderizado, con datos) al chat del
// agente — "tal cual". Clona el documento del Live, inyecta <base> para que las
// rutas relativas (CSS/imágenes) resuelvan, lo serializa y lo adjunta como
// contexto (pendingDocs) para pedirle cambios. También lo refleja en Preview y
// Código. Requiere same-origin (leer el DOM del iframe): cross-origin no se puede.
// Serializa el DOM YA RENDERIZADO del Live (con datos reales) a un HTML completo,
// inyectando <base> para que las rutas relativas resuelvan. Devuelve { html,
// baseHref } o null si no se puede leer (sin módulo / cross-origin). Sin toasts:
// el llamador decide el mensaje. Lo comparten "Recrear" y la "Vista Live".
function fgCaptureLiveHtml() {
    if (!pg._liveModule) return null;
    const doc = fgLiveDoc();
    if (!doc || !doc.body) return null;   // cross-origin o aún sin contenido
    const fr = document.getElementById('fgLiveFrame');
    let baseHref = '';
    try { baseHref = fr.contentWindow.location.href; } catch (e) { baseHref = pg._liveModule.url || ''; }
    const root = doc.documentElement.cloneNode(true);
    const head = root.querySelector('head');
    if (head && baseHref && !head.querySelector('base')) {
        const base = doc.createElement('base');
        base.setAttribute('href', baseHref);
        head.insertBefore(base, head.firstChild);
    }
    return { html: '<!DOCTYPE html>\n' + root.outerHTML, baseHref };
}

function fgCopyModuleToAgent() {
    if (!pg._liveModule) { pgToast('Primero abre un módulo en Live (📂)', 'warn'); return; }
    $('.pg-tab[data-sbtab="live"]').click();   // asegurar que el Live esté visible
    const cap = fgCaptureLiveHtml();
    if (!cap) {
        // Cross-origin: el navegador prohíbe leer el iframe → no se puede copiar
        // su HTML. Forge y el módulo deben compartir origen (abrir Forge por
        // localhost). Alternativa entre dominios: Importar el fuente desde disco.
        const liveOrigin = pg._liveModule && pg._liveModule.url ? (new URL(pg._liveModule.url, location.href)).origin : '?';
        pgToast('No puedo copiar el módulo: el Live está en ' + liveOrigin + ', distinto al de Forge (' + location.origin + '). Abre Forge por ' + fgLocalhostForgeUrl() + ' y reabre el módulo. O usa "Abrir módulo existente" (📂) → Importar para traer el fuente.', 'error', 9000);
        return;
    }
    const fullHtml = cap.html;

    // Copia al chat del agente (adjunto de contexto).
    const name = 'modulo-live.html';
    pg.pendingDocs = pg.pendingDocs.filter(d => d.name !== name);
    pg.pendingDocs.push({ name, content: fullHtml, size: fullHtml.length });
    pgRenderImageStrip();

    // Reflejo en Preview (estático) y en la pestaña Código.
    $('#pgSandboxEmpty').hide();
    const pf = document.getElementById('pgSandboxFrame');
    pf.removeAttribute('src');
    pf.onload = () => pgApplyZoom();
    pf.srcdoc = fullHtml;
    pg.lastHtml = fullHtml; pg.lastTheme = pg.theme; pg._lastIsDoc = true;
    const $code = $('#pgSandboxCode').find('code').removeAttr('data-highlighted').text(fullHtml);
    if (window.hljs) hljs.highlightElement($code[0]);

    pgToast('Módulo copiado al chat del agente (' + Math.round(fullHtml.length / 1024) + ' KB). Escríbele los cambios que quieras.', 'success', 5000);
}

/* ── Modo selección: recrear un COMPONENTE concreto del Live ──
 * Alternativa a "Recrear template" (módulo completo): el usuario activa el modo,
 * el cursor resalta los elementos y al hacer clic en uno, ese nodo se calca al
 * Preview como HTML estático y se copia al chat del agente. Requiere same-origin. */
function fgToggleSelectRecreate() {
    if (pg._recActive) { fgStopSelectRecreate(); return; }
    if (!pg._liveModule) { pgToast('Primero abre un módulo en Live (📂)', 'warn'); return; }
    $('.pg-tab[data-sbtab="live"]').click();   // asegurar que el Live esté visible
    const doc = fgLiveDoc();
    if (!doc || !doc.body) {
        const liveOrigin = pg._liveModule && pg._liveModule.url ? (new URL(pg._liveModule.url, location.href)).origin : '?';
        pgToast('No puedo leer el Live: está en ' + liveOrigin + ', distinto al de Forge (' + location.origin + '). Abre Forge por ' + fgLocalhostForgeUrl() + ' y reabre el módulo. O usa "Abrir módulo existente" (📂) → Importar.', 'error', 9000);
        return;
    }
    pg._recActive = true;
    pg._recDoc = doc;
    $('#fgRecSelectFab').addClass('is-on').html('<i data-lucide="x" class="w-4 h-4"></i> Cancelar');
    $('#fgRecBanner').removeClass('hidden');
    if (window.lucide) lucide.createIcons();
    if (!doc.getElementById('fgRecStyle')) {
        const st = doc.createElement('style');
        st.id = 'fgRecStyle';
        st.textContent = '.fg-rec-hover{outline:2px solid #22c55e!important;outline-offset:-2px;cursor:copy!important;}';
        doc.head.appendChild(st);
    }
    doc.addEventListener('mouseover', fgRecOver, true);
    doc.addEventListener('mouseout', fgRecOut, true);
    doc.addEventListener('click', fgRecClick, true);
    pgToast('Clic en el componente del Live que quieres recrear (Esc para cancelar)', 'info');
}
function fgStopSelectRecreate() {
    pg._recActive = false;
    $('#fgRecSelectFab').removeClass('is-on').html('<i data-lucide="mouse-pointer-click" class="w-4 h-4"></i> Seleccionar');
    $('#fgRecBanner').addClass('hidden');
    if (window.lucide) lucide.createIcons();
    const doc = pg._recDoc;
    if (doc) {
        try {
            doc.removeEventListener('mouseover', fgRecOver, true);
            doc.removeEventListener('mouseout', fgRecOut, true);
            doc.removeEventListener('click', fgRecClick, true);
            doc.querySelectorAll('.fg-rec-hover').forEach(n => n.classList.remove('fg-rec-hover'));
        } catch (e) {}
    }
    pg._recDoc = null;
}
function fgRecOver(e) { if (e.target && e.target.classList && e.target !== e.currentTarget.body) e.target.classList.add('fg-rec-hover'); }
function fgRecOut(e)  { if (e.target && e.target.classList) e.target.classList.remove('fg-rec-hover'); }
function fgRecClick(e) {
    e.preventDefault(); e.stopPropagation();
    const el = e.target;
    if (el && el.tagName) fgRecreateFromNode(el);
    fgStopSelectRecreate();
}
// Calca un nodo del Live → Preview (HTML estático con los estilos del Live +
// <base> para resolver rutas) y lo copia al chat del agente como 'componente-live.html'.
function fgRecreateFromNode(el) {
    const liveDoc = el.ownerDocument;
    const fr = document.getElementById('fgLiveFrame');
    let baseHref = '';
    try { baseHref = fr.contentWindow.location.href; } catch (e) { baseHref = pg._liveModule ? pg._liveModule.url : ''; }

    const clone = el.cloneNode(true);
    if (clone.classList) clone.classList.remove('fg-rec-hover');
    const nodeHtml = clone.outerHTML;

    const headBits = Array.from(liveDoc.querySelectorAll('link[rel="stylesheet"], style')).map(n => n.outerHTML).join('\n');
    const tw = liveDoc.querySelector('script[src*="tailwindcss"]') ? '<script src="https://cdn.tailwindcss.com"><\/script>' : '';
    const bodyClass = liveDoc.body.getAttribute('class') || '';
    const bodyStyle = liveDoc.body.getAttribute('style') || '';
    const docHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><base href="${pgEscape(baseHref)}">`
        + `${tw}\n${headBits}\n<style>body{padding:16px;}</style></head>`
        + `<body class="${pgEscape(bodyClass)}" style="${pgEscape(bodyStyle)}">${nodeHtml}</body></html>`;

    // Preview (estático, con los estilos reales del Live).
    $('#pgSandboxEmpty').hide();
    const pf = document.getElementById('pgSandboxFrame');
    pf.removeAttribute('src');
    pf.onload = () => pgApplyZoom();
    pf.srcdoc = docHtml;
    pg.lastHtml = nodeHtml; pg.lastTheme = pg.theme; pg._lastIsDoc = false;

    const $code = $('#pgSandboxCode').find('code').removeAttr('data-highlighted').text(nodeHtml);
    if (window.hljs) hljs.highlightElement($code[0]);

    // Copia al chat del agente para iterarlo.
    const name = 'componente-live.html';
    pg.pendingDocs = pg.pendingDocs.filter(d => d.name !== name);
    pg.pendingDocs.push({ name, content: nodeHtml, size: nodeHtml.length });
    pgRenderImageStrip();

    $('.pg-tab[data-sbtab="preview"]').click();
    pgToast('Componente recreado y copiado al chat del agente', 'success');
}

// Lee un archivo del proyecto y lo añade como contexto del agente (pendingDocs).
async function fgImportSource(project, relPath) {
    if (pg.pendingDocs.some(d => d.name === relPath)) { pgToast('Ya estaba importado', 'info'); return; }
    try {
        const res  = await fetch(`${FG_API}?action=readfile&project=${encodeURIComponent(project)}&path=${encodeURIComponent(relPath)}`, { cache: 'no-store' });
        const data = await res.json();
        if (!data.success) { pgToast(data.message || 'No se pudo leer', 'error'); return; }
        pg.pendingDocs.push({ name: relPath, content: data.content, size: data.bytes || data.content.length });
        pgRenderImageStrip();
        pgToast('Importado al contexto: ' + relPath, 'success');
    } catch (e) { pgToast('Error de red al importar', 'error'); }
}

/* ── Explorador del proyecto ── */
function fgOpenBrowser() {
    const $sel = $('#fgBrowserProject').empty();
    pg.projects.forEach(p => $sel.append(`<option value="${pgEscape(p.key)}">${pgEscape(p.name)}</option>`));
    $sel.val(pg.project || ($sel.val() || ''));
    pg._browseProject = $sel.val();
    pg._browsePath = '';
    $('#fgBrowserModal').removeClass('hidden').attr('aria-hidden', 'false');
    fgUpdateBaseHint();
    fgBrowseTo('');
    if (window.lucide) lucide.createIcons();
}
// Muestra la base que se usará para abrir el proyecto actual: automática para el
// proyecto que aloja al visor, recordada si ya se ajustó, o por confirmar.
function fgUpdateBaseHint() {
    const proj   = pg._browseProject;
    const stored = localStorage.getItem('forge:openbase:' + proj);
    const base   = stored || fgContainerBase();
    // Vhosts (dentro de www) que sirven este proyecto: su docroot es el proyecto o
    // una subcarpeta suya (p.ej. grupovaroch/erp-gv → www.erp-pro.com).
    const projLc = String(proj || '').toLowerCase();
    const hosts = (pg.vhosts || []).filter(v => {
        const r = String(v.rel || '').toLowerCase();
        return r && (r === projLc || r.indexOf(projLc + '/') === 0);
    });
    let msg;
    if (stored)                       msg = `Base recordada para <strong>${pgEscape(proj)}</strong>: <code>${pgEscape(base)}</code>`;
    else if (proj === pg._container)  msg = `Base detectada para <strong>${pgEscape(proj)}</strong>: <code>${pgEscape(base)}</code> (aloja al visor).`;
    else if (hosts.length)            msg = `Vhost(s) detectado(s) para <strong>${pgEscape(proj)}</strong>: ` +
                                            hosts.map(v => `<code>${location.protocol}//${pgEscape(v.server)}/</code> → <code>${pgEscape(v.rel)}</code>`).join(', ') +
                                            `. Al abrir, Forge usará la URL real automáticamente.`;
    else                              msg = `Base propuesta: <code>${pgEscape(base)}</code>. Si <strong>${pgEscape(proj)}</strong> se sirve en otro vhost, ajusta la URL al abrir y se recordará.`;
    $('#fgBrowserBaseHint').html(msg);
    // Reflejar la base efectiva (recordada o automática) en el campo editable.
    $('#fgProjectBase').val(fgEffectiveBase(proj));
}

// Base (sin ruta de archivo) que se usaría hoy para abrir el proyecto: respeta el
// override recordado y, si no hay, la que deduce fgComposeOpenUrl (same-origin / vhost).
function fgEffectiveBase(project) {
    return fgComposeOpenUrl(project, '');
}
// Guarda el host/base que el usuario escribió como override del proyecto. Gana
// sobre la detección automática en todas las aperturas futuras de ese proyecto.
function fgSaveProjectBase() {
    const proj = pg._browseProject;
    if (!proj) { pgToast('Elige un proyecto primero', 'warn'); return; }
    let base = ($('#fgProjectBase').val() || '').trim();
    if (!base) { pgToast('Escribe un host/base (ej. http://localhost/ERP-GV/)', 'warn'); return; }
    if (!/\/$/.test(base)) base += '/';
    localStorage.setItem('forge:openbase:' + proj, base);
    fgUpdateBaseHint();
    pgToast('Host guardado para ' + proj + ': ' + base, 'success');
}
// Olvida el override y vuelve a la detección automática (same-origin / vhost).
function fgClearProjectBase() {
    const proj = pg._browseProject;
    if (!proj) return;
    localStorage.removeItem('forge:openbase:' + proj);
    fgUpdateBaseHint();
    pgToast('Host en automático para ' + proj, 'info');
}
function fgCloseBrowser() {
    $('#fgBrowserModal').addClass('hidden').attr('aria-hidden', 'true');
}
async function fgBrowseTo(rel) {
    const project = pg._browseProject;
    if (!project) return;
    pg._browsePath = rel;
    const $list = $('#fgBrowserList').html('<p class="pg-hint" style="padding:14px;">Cargando…</p>');
    try {
        const res  = await fetch(`${FG_API}?action=listdir&project=${encodeURIComponent(project)}&path=${encodeURIComponent(rel)}`, { cache: 'no-store' });
        const data = await res.json();
        if (!data.success) { $list.html(`<p class="pg-hint" style="padding:14px;">${pgEscape(data.message || 'Error')}</p>`); return; }
        fgRenderBrowser(data);
    } catch (e) { $list.html('<p class="pg-hint" style="padding:14px;">Error de red.</p>'); }
}
function fgRenderBrowser(data) {
    // Breadcrumbs navegables.
    const parts = (data.path || '').split('/').filter(Boolean);
    let acc = '';
    let crumbs = `<button class="fg-crumb" data-rel="">${pgEscape(data.project)}</button>`;
    parts.forEach(seg => { acc += (acc ? '/' : '') + seg; crumbs += `<span class="fg-crumb-sep">/</span><button class="fg-crumb" data-rel="${pgEscape(acc)}">${pgEscape(seg)}</button>`; });
    $('#fgBrowserPath').html(crumbs);

    const $list = $('#fgBrowserList').empty();
    const entries = data.entries || [];
    if (!entries.length) { $list.html('<p class="pg-hint" style="padding:14px;">Carpeta vacía.</p>'); }

    entries.forEach(en => {
        if (en.type === 'dir') {
            $list.append(`
                <div class="fg-br-row fg-br-dir" data-rel="${pgEscape(en.rel)}">
                    <i data-lucide="folder" class="fg-br-icon"></i>
                    <span class="fg-br-name">${pgEscape(en.name)}</span>
                    <i data-lucide="chevron-right" class="fg-br-go"></i>
                </div>`);
        } else {
            const open = en.openable ? `<button class="fg-br-act fg-br-open" data-rel="${pgEscape(en.rel)}" title="Abrir en el sandbox con datos reales">Abrir</button>` : '';
            const imp  = en.readable ? `<button class="fg-br-act fg-br-import" data-rel="${pgEscape(en.rel)}" title="Importar al contexto del agente">Importar</button>` : '<span class="fg-br-na" title="No es archivo de texto">—</span>';
            $list.append(`
                <div class="fg-br-row">
                    <i data-lucide="${fgFileIcon(en.name)}" class="fg-br-icon"></i>
                    <span class="fg-br-name">${pgEscape(en.name)}</span>
                    <span class="fg-br-acts">${open}${imp}</span>
                </div>`);
        }
    });

    $('#fgBrowserPath .fg-crumb').on('click', function () { fgBrowseTo($(this).data('rel') || ''); });
    $list.find('.fg-br-dir').on('click', function () { fgBrowseTo($(this).data('rel')); });
    $list.find('.fg-br-open').on('click', function (e) { e.stopPropagation(); fgOpenModuleInSandbox(pg._browseProject, $(this).data('rel')); });
    $list.find('.fg-br-import').on('click', function (e) { e.stopPropagation(); fgImportSource(pg._browseProject, $(this).data('rel')); });

    const nDir = entries.filter(x => x.type === 'dir').length;
    const nFile = entries.length - nDir;
    $('#fgBrowserSummary').text(`${nDir} carpeta(s) · ${nFile} archivo(s)`);
    if (window.lucide) lucide.createIcons();
}

/** Bindings de la capa fábrica. */
function fgBind() {
    $('#fgProjectSelect').on('change', e => { pg.project = e.target.value || ''; pgSaveSettings(); });
    // Ambos botones pasan por el diff: nunca se escribe sin previsualizar.
    $('#fgPreviewBtn, #fgMaterializeBtn').on('click', () => fgPreview());
    $('#fgPreviewConfirm').on('click', () => fgMaterialize());
    $('#fgPreviewClose, #fgPreviewCancel').on('click', () => fgClosePreviewModal());
    $('#fgPreviewModal .pg-modal-backdrop').on('click', () => fgClosePreviewModal());

    // Explorador "Abrir módulo existente".
    $('#fgOpenModuleBtn').on('click', () => fgOpenBrowser());
    $('#fgBrowserClose, #fgBrowserDone').on('click', () => fgCloseBrowser());
    $('#fgBrowserModal .pg-modal-backdrop').on('click', () => fgCloseBrowser());
    $('#fgBrowserProject').on('change', e => { pg._browseProject = e.target.value || ''; fgUpdateBaseHint(); fgBrowseTo(''); });
    $('#fgOpenUrlBtn').on('click', () => fgOpenManualUrl());
    // Host/base del proyecto: el usuario lo fija y se persiste con prioridad.
    $('#fgSaveBaseBtn').on('click', () => fgSaveProjectBase());
    $('#fgClearBaseBtn').on('click', () => fgClearProjectBase());
    $('#fgProjectBase').on('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fgSaveProjectBase(); } });
    $('#fgOpenUrl').on('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fgOpenManualUrl(); } });

    // Recrear: el botón del header copia el módulo completo; Esc cancela el modo selección.
    $('#fgRecreateBtn').on('click', () => fgCopyModuleToAgent());
    $(document).on('keydown', e => { if (e.key === 'Escape' && pg._recActive) fgStopSelectRecreate(); });

    // Hilos paralelos.
    $('#fgNewThreadBtn').on('click', () => fgNewThread());
}

/* ── Hilos paralelos ──
 * Cada hilo es una SESIÓN completa e independiente: su agente/modelo/tema, su
 * conversación, su Live, su Preview, sus adjuntos y su módulo generado. Al
 * cambiar de hilo se guarda el estado vivo del actual y se restaura el destino.
 * Viven en memoria (se pierden al recargar). */
function fgThreadId() { return 'th-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5); }

// Captura el estado de sesión actual desde pg (arrays por referencia: se
// re-capturan en cada cambio de hilo, así que se mantienen consistentes).
function fgSnapshotSession() {
    return {
        agentKey: pg.agentKey, theme: pg.theme, model: pg.model, prompt: pg.prompt,
        knowledge: Array.from(pg.knowledge || []), canvasMode: !!pg.canvasMode,
        history: pg.history, templates: pg.templates, activeTplId: pg._activeTplId,
        lastUserText: pg._lastUserText, lastIsDoc: pg._lastIsDoc, lastHtml: pg.lastHtml, lastTheme: pg.lastTheme,
        pendingDocs: pg.pendingDocs, pendingImages: pg.pendingImages,
        moduleFiles: (pg.module && pg.module.files) || [], project: pg.project,
        liveModule: pg._liveModule || null, openProject: pg._openProject || '', openRel: pg._openRel || ''
    };
}
// Vuelca una sesión a pg y reconstruye toda la UI.
function fgApplySession(s) {
    pg.agentKey = s.agentKey;
    $('#pgAgentSelect').val(s.agentKey);
    pgApplyAgent(s.agentKey, true);                 // labels/icono sin limpiar chat
    pg.prompt = s.prompt || '';                     // conservar el prompt del hilo
    $('#pgPromptEditor').val(pg.prompt);

    pg.theme = s.theme; $('#pgThemeSelect').val(s.theme);
    $('#pgSandboxTheme').text((PG_THEMES[s.theme] || {}).label || s.theme);
    pg.model = s.model || ''; if (s.model) $('#pgModelSelect').val(s.model);
    pg.knowledge = new Set(s.knowledge || []);
    pg.canvasMode = !!s.canvasMode; pgApplyCanvasUI();

    pg.history = s.history || [];
    pg.templates = s.templates || [];
    pg._activeTplId = s.activeTplId || null;
    pg._lastUserText = s.lastUserText || '';
    pg._lastIsDoc = !!s.lastIsDoc;
    pg.lastHtml = s.lastHtml || '';
    pg.lastTheme = s.lastTheme || s.theme;
    pg.pendingDocs = s.pendingDocs || [];
    pg.pendingImages = s.pendingImages || [];
    pg.module = { files: s.moduleFiles || [] };
    pg.project = s.project || ''; if (pg.project) $('#fgProjectSelect').val(pg.project);
    pg._liveModule = s.liveModule || null;
    pg._openProject = s.openProject || ''; pg._openRel = s.openRel || '';

    fgRebuildChat();
    pgRenderImageStrip();
    fgSetModule(pg.module.files);
    pgUpdateKnowledgeCount();
    fgRestoreSandbox();
    if (window.lucide) lucide.createIcons();
}
// Solo el texto del usuario (sin el bloque de documentos embebidos).
function fgUserText(c) {
    c = String(c || '');
    const i = c.indexOf('\n\n=== DOCUMENTOS ADJUNTOS');
    return i >= 0 ? c.slice(0, i) : c;
}
function fgRebuildChat() {
    const $b = $('#pgChatBody').empty();
    if (!pg.history.length) {
        $b.html(`<div class="pg-empty"><i data-lucide="sparkles"></i>
            <div class="pg-empty-title">Pon a prueba a tu agente</div>
            <div class="pg-empty-sub">Escríbele una instrucción y observa el resultado en el sandbox.</div></div>`);
        return;
    }
    pg.history.forEach(m => {
        if (m.role === 'user') pgAppendUser(fgUserText(m.content), m.imagesPreview, m.docsMeta);
        else pgAppendAI(m.content);
    });
    pgScroll();
}
// Restaura Live (src) y Preview (lastHtml) del hilo, eligiendo la pestaña visible.
function fgRestoreSandbox() {
    const lf = document.getElementById('fgLiveFrame');
    if (pg._liveModule && pg._liveModule.url) { lf.src = pg._liveModule.url; $('#fgLiveDot').show(); }
    else { lf.removeAttribute('src'); $('#fgLiveDot').hide(); }

    const pf = document.getElementById('pgSandboxFrame');
    if (pg.lastHtml) {
        pgRenderSandbox(pg.lastHtml, pg._lastIsDoc);   // pinta Preview y activa esa pestaña
    } else {
        pf.removeAttribute('srcdoc');
        if (pg._liveModule) { $('#pgSandboxEmpty').hide(); $('.pg-tab[data-sbtab="live"]').click(); }
        else { $('#pgSandboxEmpty').show(); $('.pg-tab[data-sbtab="preview"]').click(); }
    }
}

function fgActiveThread() { return pg.threads.find(t => t.id === pg.activeThread); }
function fgInitThreads() {
    const id = fgThreadId();
    pg.threads = [{ id, name: 'Hilo 1', session: fgSnapshotSession() }];
    pg.activeThread = id;
    fgRenderThreadBar();
}
function fgNewThread() {
    if (pg.isBusy) { pgToast('Espera a que termine la respuesta actual', 'warn'); return; }
    const cur = fgActiveThread(); if (cur) cur.session = fgSnapshotSession();
    const id = fgThreadId();
    // Hereda agente/modelo/tema actuales, pero arranca conversación y sandbox vacíos.
    const fresh = fgSnapshotSession();
    fresh.history = []; fresh.templates = []; fresh.activeTplId = null;
    fresh.lastUserText = ''; fresh.lastHtml = ''; fresh.lastIsDoc = false;
    fresh.pendingDocs = []; fresh.pendingImages = []; fresh.moduleFiles = []; fresh.liveModule = null;
    pg.threads.push({ id, name: 'Hilo ' + (pg.threads.length + 1), session: fresh });
    pg.activeThread = id;
    fgApplySession(fresh);
    fgRenderThreadBar();
    pgToast('Nuevo hilo creado', 'success');
}
function fgSwitchThread(id) {
    if (id === pg.activeThread) return;
    if (pg.isBusy) { pgToast('Espera a que termine la respuesta actual', 'warn'); return; }
    const cur = fgActiveThread(); if (cur) cur.session = fgSnapshotSession();
    const dst = pg.threads.find(t => t.id === id); if (!dst) return;
    pg.activeThread = id;
    fgApplySession(dst.session);
    fgRenderThreadBar();
}
function fgCloseThread(id) {
    if (pg.threads.length === 1) { pgToast('Debe quedar al menos un hilo', 'warn'); return; }
    const idx = pg.threads.findIndex(t => t.id === id); if (idx < 0) return;
    const wasActive = pg.activeThread === id;
    pg.threads.splice(idx, 1);
    if (wasActive) {
        const next = pg.threads[Math.max(0, idx - 1)];
        pg.activeThread = next.id;
        fgApplySession(next.session);
    }
    fgRenderThreadBar();
}
function fgRenameThread(id) {
    const t = pg.threads.find(x => x.id === id); if (!t) return;
    const name = window.prompt('Nombre del hilo:', t.name);
    if (name && name.trim()) { t.name = name.trim().slice(0, 40); fgRenderThreadBar(); }
}
// Auto-nombra el hilo con el primer mensaje (si sigue con el nombre por defecto).
function fgMaybeAutoName(text) {
    const t = fgActiveThread();
    if (t && /^Hilo \d+$/.test(t.name) && text) { t.name = text.trim().slice(0, 28); fgRenderThreadBar(); }
}
function fgRenderThreadBar() {
    const $w = $('#fgThreads').empty();
    pg.threads.forEach(t => {
        const $t = $(`<div class="fg-thread${t.id === pg.activeThread ? ' active' : ''}" data-id="${t.id}" title="Doble clic para renombrar">
            <i data-lucide="message-square" class="fg-thread-ic"></i>
            <span class="fg-thread-name">${pgEscape(t.name)}</span>
            <button class="fg-thread-x" title="Cerrar hilo"><i data-lucide="x"></i></button>
        </div>`);
        $t.on('click', e => { if ($(e.target).closest('.fg-thread-x').length) return; fgSwitchThread(t.id); });
        $t.on('dblclick', () => fgRenameThread(t.id));
        $t.find('.fg-thread-x').on('click', e => { e.stopPropagation(); fgCloseThread(t.id); });
        $w.append($t);
    });
    if (window.lucide) lucide.createIcons();
}
