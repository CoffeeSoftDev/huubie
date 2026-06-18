/* ──────────────────────────────────────────────────────────────
   Playground de Agentes — pagina hermana del Visor.
   Reusa los endpoints del visor SIN tocarlo:
     - ctrl/ctrl-visor.php          → lista agentes + grimorios (con raw)
     - ctrl/ctrl-coffeeia-stream.php → chat SSE (acepta systemOverride opcional)
   Porta el motor de chat del Visor: typewriter, card "Conjurando…",
   sonido al terminar, adjuntar imagenes y modo lienzo.
   ────────────────────────────────────────────────────────────── */

const PG_API        = 'ctrl/ctrl-visor.php';
const PG_API_STREAM = 'ctrl/ctrl-coffeeia-stream.php';

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

const PG_STORE_KEY  = 'playground:settings:v1';

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
        note: 'Sin sistema de diseño impuesto. El lienzo es CLARO por defecto (fondo claro): NO generes un componente en tema oscuro salvo que el usuario lo pida explícitamente o la imagen de referencia sea oscura. Si el usuario adjunta una imagen, RESPETA sus colores, tipografía y estilo (claro u oscuro) y replícalos; no inventes una paleta oscura por tu cuenta.'
    }
};
const PG_DEFAULT_THEME = 'huubie-ui';

// Directiva de FUNCIONALIDAD: el agente tiende a devolver maquetas estáticas
// (solo markup), por eso los templates "no hacen nada" en el sandbox. Esta nota
// le exige incluir el JavaScript vanilla que cablea toda la interacción dentro
// del MISMO bloque ```html. El sandbox (srcdoc, sin atributo sandbox) ejecuta los
// <script> embebidos, así que basta con que vengan en la respuesta.
const PG_INTERACTIVITY_NOTE =
    `\n\n## Funcionalidad obligatoria (no es una maqueta)\n`
    + `El componente debe FUNCIONAR, no solo verse. Incluye SIEMPRE, dentro del mismo bloque \`\`\`html, `
    + `un \`<script>\` con JavaScript vanilla (sin jQuery, React ni dependencias externas) que conecte TODA `
    + `la interacción que el diseño implique: tabs, abrir/cerrar modales y dropdowns, acordeones, toggles/switches, `
    + `steppers de cantidad, búsqueda/filtrado de listas, validación básica de formularios, copiar al portapapeles, `
    + `cálculos en vivo (totales, contadores), etc. Reglas:\n`
    + `- Usa \`addEventListener\` y \`querySelector\`/\`data-*\`; evita IDs globales que choquen.\n`
    + `- El \`<script>\` va al final del componente y se autoejecuta (envuélvelo en un IIFE o \`DOMContentLoaded\`).\n`
    + `- Si insertas iconos Lucide dinámicamente, llama a \`window.lucide && lucide.createIcons()\` tras inyectarlos.\n`
    + `- El componente se renderiza en un contenedor a pantalla completa: debe LLENAR el ancho disponible (usa \`w-full\`/grid/flex), no quedar encogido en una columna estrecha.\n`
    + `- Si es un modal/diálogo, el overlay (\`fixed inset-0\`) debe llevar \`overflow-y-auto\` y la tarjeta márgenes verticales (\`my-8\`) para que se vea COMPLETO y haga scroll cuando sea alto — nunca recortado arriba o abajo.\n`
    + `- NO agregues un toggle de tema claro/oscuro.\n`
    + `- Si no hay datos reales, usa datos de muestra para que la interacción sea demostrable haciendo clic.`;

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
    pinnedTplId: null,       // template FIJADO como referencia: el próximo mensaje pedirá modificarlo
    _lastUserText: '',       // último prompt del usuario (titula los templates)
    splitW:    '',           // ancho del panel de chat (px) — splitter
    zoom:      100,          // zoom del preview (%) — escala el contenido del iframe
    _popSound: null,
    _varochCss: ''           // CSS embebido extraido del grimorio Coffee-Varoch
};

$(async () => {
    pgLoadSettings();
    pgApplyUiTheme(pg.uiTheme);
    pgApplySplit(pg.splitW);
    pgBind();
    await pgLoadLibrary();
    pgApplyAgent(pg.agentKey, true);
    pgApplyCanvasUI();
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
        if (typeof s.model === 'string')         pg.model    = s.model;
        if (typeof s.canvasMode === 'boolean')   pg.canvasMode = s.canvasMode;
        if (Array.isArray(s.knowledge))          pg.knowledge = new Set(s.knowledge);
    } catch (e) {}
}
function pgSaveSettings() {
    try {
        localStorage.setItem(PG_STORE_KEY, JSON.stringify({
            agentKey: pg.agentKey, theme: pg.theme, uiTheme: pg.uiTheme, model: pg.model,
            canvasMode: pg.canvasMode, splitW: pg.splitW, zoom: pg.zoom, knowledge: Array.from(pg.knowledge)
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

    // Tabs del sandbox
    $('.pg-tab').on('click', function () {
        $('.pg-tab').removeClass('active');
        $(this).addClass('active');
        const tab = $(this).data('sbtab');
        $('#pgSandboxFrame').toggleClass('hidden', tab !== 'preview');
        $('#pgSandboxCode').toggleClass('hidden', tab !== 'code');
    });

    $('#pgSandboxOpen').on('click', () => {
        if (!pg.lastHtml) { pgToast('Aún no hay nada que abrir', 'warn'); return; }
        const w = window.open('', '_blank');
        if (w) { w.document.write(pgWrapHtml(pg.lastHtml, pg.lastTheme, pg._lastIsDoc)); w.document.close(); }
    });

    $('#pgSandboxDownload').on('click', () => pgDownloadHtml());

    // Zoom del preview
    $('#pgZoomIn').on('click', () => pgSetZoom((pg.zoom || 100) + 10));
    $('#pgZoomOut').on('click', () => pgSetZoom((pg.zoom || 100) - 10));
    $('#pgZoomLabel').on('click', () => pgSetZoom(100));   // clic en el % restablece a 100%
    $('#pgZoomLabel').text((pg.zoom || 100) + '%');

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

    // Plantillas guardadas
    $('#pgTemplatesBtn').on('click', () => pgOpenTemplates());
    $('#pgTemplatesClose, #pgTemplatesDone').on('click', () => pgCloseTemplates());
    $('#pgTemplatesModal .pg-modal-backdrop').on('click', () => pgCloseTemplates());

    $(document).on('keydown', e => {
        if (e.key === 'Escape') { pgCloseKnowledge(); pgCloseSaveTemplate(); pgCloseTemplates(); }
    });

    // Conmutador Chat/Sandbox (solo visible en móvil vía CSS). Cambia qué panel
    // se muestra alternando data-mview en el workspace; en desktop es inocuo.
    $('.pg-mswitch').on('click', function () {
        const view = $(this).data('mview');
        $('.pg-mswitch').removeClass('active');
        $(this).addClass('active');
        $('.pg-workspace').attr('data-mview', view);
    });

    // Botón Ajustes (solo móvil): despliega/colapsa la barra de controles del
    // header (agente, tema, modelo, conocimiento). En desktop el botón está
    // oculto por CSS y la barra siempre se ve.
    $('#pgHeaderToggle').on('click', function () {
        const open = !$('#pgHeaderRight').hasClass('is-open');
        $('#pgHeaderRight').toggleClass('is-open', open);
        $(this).attr('aria-expanded', open ? 'true' : 'false').toggleClass('is-active', open);
    });
    // Al elegir un valor en cualquier control, recoger el panel (UX móvil).
    $('#pgHeaderRight').on('change', 'select', () => {
        if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) {
            $('#pgHeaderRight').removeClass('is-open');
            $('#pgHeaderToggle').attr('aria-expanded', 'false').removeClass('is-active');
        }
    });
    // Tocar fuera del panel (ni en él ni en el botón) lo cierra.
    $(document).on('click.pgHeader', e => {
        if (!$('#pgHeaderRight').hasClass('is-open')) return;
        if ($(e.target).closest('#pgHeaderRight, #pgHeaderToggle').length) return;
        $('#pgHeaderRight').removeClass('is-open');
        $('#pgHeaderToggle').attr('aria-expanded', 'false').removeClass('is-active');
    });

    // Menú ⋯ de acciones del sandbox (cargar/guardar/descargar/abrir). En móvil
    // colapsa esas acciones; en desktop el botón ⋯ está oculto y van sueltas.
    $('#pgActionsToggle').on('click', function (e) {
        e.stopPropagation();
        const open = !$('#pgActionsPop').hasClass('is-open');
        $('#pgActionsPop').toggleClass('is-open', open);
        $(this).attr('aria-expanded', open ? 'true' : 'false').toggleClass('is-active', open);
    });
    // Al elegir una acción o tocar fuera, cerrar el menú.
    $('#pgActionsPop').on('click', '.pg-actionbtn', () => pgCloseActionsMenu());
    $(document).on('click.pgActions', e => {
        if (!$('#pgActionsPop').hasClass('is-open')) return;
        if ($(e.target).closest('.pg-actions-menu').length) return;
        pgCloseActionsMenu();
    });
}

function pgCloseActionsMenu() {
    $('#pgActionsPop').removeClass('is-open');
    $('#pgActionsToggle').attr('aria-expanded', 'false').removeClass('is-active');
}

/* En móvil, al renderizarse un resultado conviene saltar automáticamente a la
 * vista Sandbox para que el usuario vea el render sin tener que conmutar a mano.
 * En desktop no hace nada (el conmutador está oculto y ambos paneles se ven). */
function pgMobileShowSandbox() {
    if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
        $('.pg-mswitch[data-mview="sandbox"]').trigger('click');
    }
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
    pg.pinnedTplId = null;
    pgRenderPinBanner();   // quita el chip "Modificando…" si quedaba
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
    if (text) pg._lastUserText = text;   // titula los templates del historial
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
/* Nota dentro de la burbuja del usuario: indica que ese mensaje pidió modificar
 * un template fijado (el HTML viajó al modelo pero no se muestra crudo). */
function pgAppendPinNote($msg, tpl) {
    if (!$msg || !$msg.length || !tpl) return;
    const title = tpl.title || 'Componente';
    $msg.find('.ia-msg-text').append(
        `<div class="ia-msg-pinref" title="Este mensaje pidió modificar un template fijado">`
        + `<i data-lucide="pin" class="w-3 h-3"></i><span>sobre: ${pgEscape(title)}</span></div>`
    );
    if (window.lucide) lucide.createIcons();
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

// ¿El modelo dado tiene VISIÓN? Se deriva del texto del <option> en el selector
// (los modelos con visión llevan "vision" en su etiqueta), así no hay que
// mantener una lista aparte: basta con etiquetar el option en el HTML.
function pgModelHasVision(model) {
    const m = model || pg.model;
    if (!m) return false;
    const opt = document.querySelector(`#pgModelSelect option[value="${m.replace(/"/g, '\\"')}"]`);
    return !!opt && /vision/i.test(opt.textContent || '');
}

async function pgSend(text, images, docs) {
    pgSetBusy(true);
    images = Array.isArray(images) ? images : [];
    docs   = Array.isArray(docs)   ? docs   : [];

    // Aviso: si se adjuntó imagen pero el modelo activo no tiene visión, no la
    // procesará (de ahí que el render no respete la imagen). Sugerir cambiarlo.
    if (images.length && pg.model && !pgModelHasVision(pg.model)) {
        pgToast('Este modelo no analiza imágenes. Elige uno con visión (los marcados con “vision”).', 'warn');
    }

    // Template fijado como referencia: su HTML se inyecta al content para que el
    // agente sepa EXACTAMENTE qué markup modificar. La referencia es de un solo
    // uso (se libera tras enviar), igual que los adjuntos pendientes.
    const pinnedTpl = pg.pinnedTplId ? pg.templates.find(x => x.id === pg.pinnedTplId) : null;

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
    if (pinnedTpl && pinnedTpl.html) {
        contentForModel = (contentForModel ? contentForModel + '\n\n' : '') +
            '=== TEMPLATE A MODIFICAR (referencia fijada por el usuario) ===\n' +
            'Modifica EXCLUSIVAMENTE el siguiente componente según la instrucción de arriba. ' +
            'Conserva su estructura, IDs y lógica salvo lo que se pida cambiar; NO lo reescribas desde cero ni cambies de tema. ' +
            'Devuelve el componente completo y actualizado.\n' +
            '```html\n' + pinnedTpl.html + '\n```';
    }

    const userMsg = { role: 'user', content: contentForModel };
    if (images.length) { userMsg.images = images.map(i => i.base64); userMsg.imagesPreview = images.map(i => i.dataUrl); }
    if (docs.length) userMsg.docsMeta = docs.map(d => ({ name: d.name, size: d.size }));
    pg.history.push(userMsg);
    // En la burbuja mostramos solo el texto del usuario + una nota de referencia
    // si se fijó un template; el HTML inyectado no se vuelca al chat.
    pgAppendUser(text, userMsg.imagesPreview, userMsg.docsMeta);
    if (pinnedTpl) pgAppendPinNote($('#pgChatBody .ia-msg.user').last(), pinnedTpl);

    // La referencia es de un solo uso: liberar y limpiar el chip del input.
    if (pg.pinnedTplId) { pg.pinnedTplId = null; pgRefreshPinUI(); }

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
        systemOverride += PG_INTERACTIVITY_NOTE;
    } else if (cfgAgent.render === 'code' && themeCfg.grimoire) {
        // El tema también modela el módulo: su UI/frontend debe usar el sistema
        // de diseño elegido. En modo libre (sin grimorio) no se impone estilo.
        systemOverride += `\n\n## Estilo del sistema (Playground)\n`
            + `La UI/frontend del módulo que generes debe construirse con el sistema de diseño **${themeCfg.label}** (grimorio incluido en el contexto): usa sus clases y tokens, no inventes otra paleta. ${themeCfg.note}`;
    }

    // Si el usuario adjuntó imagen(es), exigir fidelidad visual: el render debe
    // reproducir colores, tono (claro/oscuro), tipografía y composición de la
    // imagen, no una interpretación libre del agente.
    if (images.length && usesDesignSystem) {
        systemOverride += `\n\n## Fidelidad a la imagen de referencia\n`
            + `El usuario adjuntó imagen(es). Analízalas y REPRODUCE fielmente su estilo visual: `
            + `paleta de colores exacta, tono (si la imagen es CLARA, el componente va claro; si es OSCURA, oscuro), `
            + `tipografía, espaciados y composición. No cambies el tema de la imagen ni impongas un estilo propio.`;
    }

    // Modo lienzo sobre un agente que no es de UI (p.ej. markdown): igual debe
    // entregar un componente HTML funcional, no una maqueta inerte.
    if (pg.canvasMode && cfgAgent.render !== 'html') {
        systemOverride += PG_INTERACTIVITY_NOTE;
    }

    const payload = {
        messages: pg.history.map(m => {
            const o = { role: m.role, content: m.content };
            if (m.images && m.images.length) o.images = m.images;
            return o;
        }),
        systemOverride: systemOverride,
        pinnedFiles:    pinned,
        canvasMode:     !!pg.canvasMode,
        model:          pg.model || ''
    };

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
    const $m = $(`<div class="ia-msg ai"><div class="ia-msg-role"><span class="dot"></span><span>${pgAgentLabel()}</span></div><div class="ia-msg-text">${pgMarkdown(text)}</div></div>`);
    $('#pgChatBody').append($m);
    const $body = $m.find('.ia-msg-text');
    $body.find('pre code').each((i, el) => { if (window.hljs) hljs.highlightElement(el); });
    pgCollapseCode($body);
    pgScroll();
}

/* Colapsa los bloques de código (<pre><code>) de una burbuja ya renderizada en
 * una card contraída: rotula el lenguaje (HTML, JS, …) y las líneas, y se abre
 * con un clic. Evita volcar cientos de líneas de código crudo en el chat —
 * sobre todo el HTML que los agentes de documento explican en prosa. */
function pgCollapseCode($scope) {
    if (!$scope || !$scope.length) return;
    $scope.find('pre').each(function () {
        const $pre = $(this);
        if ($pre.closest('.pg-codecard').length) return;   // ya colapsado
        const $code = $pre.find('code').first();
        if (!$code.length) return;
        const raw   = $code.text();
        const lines = raw ? raw.split(/\r?\n/).length : 0;
        // Lenguaje desde la clase (language-xxx de marked/hljs) o heurística HTML.
        const m    = ($code.attr('class') || '').match(/language-([a-z0-9+-]+)/i);
        const lang = m ? m[1] : (pgLooksLikeHtml(raw) ? 'html' : 'código');
        const $card = $(`
            <div class="pg-codecard">
                <button type="button" class="pg-codecard-head" aria-expanded="false">
                    <span class="pg-codecard-ic"><i data-lucide="code-xml" class="w-4 h-4"></i></span>
                    <span class="pg-codecard-info">
                        <span class="pg-codecard-title"><span class="pg-codecard-badge">${pgEscape(lang.toUpperCase())}</span>${lines} línea${lines === 1 ? '' : 's'}</span>
                        <span class="pg-codecard-sub">Clic para ver el código</span>
                    </span>
                    <i data-lucide="chevron-down" class="pg-codecard-caret w-4 h-4"></i>
                </button>
                <div class="pg-codecard-body"></div>
            </div>`);
        $pre.before($card);
        $card.find('.pg-codecard-body').append($pre);   // mueve el <pre> dentro del cuerpo colapsable
        $card.find('.pg-codecard-head').on('click', function () {
            const open = !$card.hasClass('is-open');
            $card.toggleClass('is-open', open);
            $(this).attr('aria-expanded', open ? 'true' : 'false');
            $card.find('.pg-codecard-sub').text(open ? 'Clic para ocultar' : 'Clic para ver el código');
        });
    });
    if (window.lucide) lucide.createIcons();
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
            pgCollapseCode($text);
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
        agentKey:   pg.agentKey,
        // Corte del history en el momento de generar este template: incluye el
        // mensaje user que lo pidió y el assistant que lo produjo (ambos ya están
        // empujados a pg.history cuando se llama pgPushTemplate). Es el contexto
        // exacto a heredar al "Bifurcar aquí".
        histLen:    pg.history.length,
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
                <span class="pg-chat-tpl-actions">
                    <span class="pg-chat-tpl-cta"><i data-lucide="eye" class="w-3 h-3"></i>Ver en el sandbox</span>
                    <button type="button" class="pg-chat-tpl-pin${tpl.id === pg.pinnedTplId ? ' is-pinned' : ''}" title="Fijar este template como referencia: el próximo mensaje pedirá modificarlo"><i data-lucide="pin" class="w-3 h-3"></i><span class="pg-pin-label">${tpl.id === pg.pinnedTplId ? 'Fijado' : 'Fijar referencia'}</span></button>
                    <button type="button" class="pg-chat-tpl-fork" title="Abrir un hilo nuevo heredando este sandbox como contexto"><i data-lucide="git-branch" class="w-3 h-3"></i>Bifurcar aquí</button>
                </span>
            </div>
        </div>`);
    $msg.append($card);
    const fr = $card.find('.pg-chat-tpl-frame')[0];
    if (fr) fr.srcdoc = pgWrapHtml(tpl.html, tpl.theme, tpl.isDoc);
    $card.on('click', () => pgRestoreTemplate(tpl.id));
    $card.find('.pg-chat-tpl-pin').on('click', e => { e.stopPropagation(); pgTogglePinTemplate(tpl.id); });
    $card.find('.pg-chat-tpl-fork').on('click', e => { e.stopPropagation(); pgForkFromTemplate(tpl.id); });
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

/* ── Bifurcar hilo desde un sandbox de la sesión ──
 * Abre un chat NUEVO e independiente que hereda como contexto la conversación
 * hasta el punto que generó este template (su `histLen`), más su tema y agente.
 * A diferencia de "Ver en el sandbox" (que solo re-renderiza en el mismo hilo),
 * aquí se corta el historial: lo que venga después es una rama propia. Reusa la
 * rehidratación de pgLoadSavedTemplate pero sobre un tpl en memoria. */
function pgForkFromTemplate(id) {
    if (pg.isBusy) { pgToast('Espera a que termine la generación en curso', 'warn'); return; }
    const t = pg.templates.find(x => x.id === id);
    if (!t) return;

    // Corte del contexto a heredar: los mensajes hasta (incluido) el que produjo
    // este template. Si por algún motivo no se ancló histLen, hereda todo.
    const cut = (typeof t.histLen === 'number' && t.histLen > 0)
        ? pg.history.slice(0, t.histLen)
        : pg.history.slice();

    // Restaurar tema con el que se generó el sandbox.
    if (t.theme && PG_THEMES[t.theme] && t.theme !== pg.theme) {
        pg.theme = t.theme;
        $('#pgThemeSelect').val(t.theme);
        $('#pgSandboxTheme').text((PG_THEMES[t.theme] || {}).label || t.theme);
        pgSaveSettings();
    }
    // Restaurar agente si difiere (mantiene historial: keepHistory=true).
    if (t.agentKey && PG_AGENTS[t.agentKey] && t.agentKey !== pg.agentKey) {
        $('#pgAgentSelect').val(t.agentKey);
        pgApplyAgent(t.agentKey, true);
    }

    // Hilo nuevo: limpiamos y rehidratamos solo el corte heredado.
    pgClearChat();
    pg.history = cut.slice();
    pg._lastUserText = t.title || '';
    if (pg.history.length) {
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

    // Pinta el sandbox heredado y lo registra como template del nuevo hilo, con
    // su tarjeta enganchada a la última burbuja IA.
    pgRenderSandbox(t.html, !!t.isDoc);
    const tpl = pgPushTemplate(t.html, !!t.isDoc);
    if (tpl) {
        tpl.title = t.title || tpl.title;
        const $last = $('#pgChatBody .ia-msg.ai').last();
        pgAppendTemplateCard($last.length ? $last : $('#pgChatBody'), tpl);
    }
    $('#pgInput').trigger('focus');
    pgToast('Hilo bifurcado desde este sandbox — sigue iterando', 'success');
}

/* ── Fijar template como referencia ──
 * Marca un template de la sesión como el objetivo a MODIFICAR. Mientras esté
 * fijado, el próximo mensaje inyecta su HTML al agente con la instrucción de
 * editarlo (en vez de crear uno nuevo desde cero). A diferencia de "Bifurcar"
 * (que crea un hilo aparte), aquí seguimos en el MISMO hilo: es "trabaja sobre
 * este". La referencia se libera al enviar o al desfijar. */
function pgTogglePinTemplate(id) {
    const t = pg.templates.find(x => x.id === id);
    if (!t) return;
    pg.pinnedTplId = (pg.pinnedTplId === id) ? null : id;
    pgRefreshPinUI();
    if (pg.pinnedTplId) {
        // Si el template fijado no es el que se ve en el sandbox, lo cargamos para
        // que el usuario vea exactamente lo que va a modificar.
        if (pg._activeTplId !== id) pgRestoreTemplate(id);
        pgToast('Template fijado — el próximo mensaje lo modificará', 'success');
        $('#pgInput').trigger('focus');
    } else {
        pgToast('Referencia liberada', 'info');
    }
}

/* Sincroniza la UI con pg.pinnedTplId: estado de los botones de las tarjetas y
 * el chip indicador sobre el input. Idempotente: se puede llamar siempre. */
function pgRefreshPinUI() {
    $('.pg-chat-tpl-pin').each(function () {
        const card = $(this).closest('.pg-chat-tpl');
        const isPinned = card.data('tpl-id') === pg.pinnedTplId;
        $(this).toggleClass('is-pinned', isPinned);
        $(this).find('.pg-pin-label').text(isPinned ? 'Fijado' : 'Fijar referencia');
    });
    pgRenderPinBanner();
}

/* Chip "Modificando: <título> ✕" encima del input, visible solo si hay un
 * template fijado. Lo monta/desmonta bajo demanda dentro de .ia-input-wrap. */
function pgRenderPinBanner() {
    const t = pg.pinnedTplId ? pg.templates.find(x => x.id === pg.pinnedTplId) : null;
    $('#pgPinBanner').remove();
    if (!t) return;
    const title = t.title || 'Componente';
    const $banner = $(`
        <div id="pgPinBanner" class="pg-pin-banner" title="El próximo mensaje modificará este template">
            <i data-lucide="pin" class="w-3.5 h-3.5"></i>
            <span class="pg-pin-banner-text">Modificando: <strong>${pgEscape(title)}</strong></span>
            <button type="button" class="pg-pin-banner-x" title="Liberar referencia"><i data-lucide="x" class="w-3 h-3"></i></button>
        </div>`);
    // Lo insertamos al inicio del wrapper del input (arriba del textarea).
    const $wrap = $('.ia-input-wrap');
    if ($wrap.length) $wrap.prepend($banner); else $('#pgInput').before($banner);
    $banner.find('.pg-pin-banner-x').on('click', () => { pg.pinnedTplId = null; pgRefreshPinUI(); });
    if (window.lucide) lucide.createIcons();
}

function pgRenderSandbox(htmlBody, isDoc) {
    $('#pgSandboxEmpty').hide();
    pg.lastHtml = htmlBody; pg.lastTheme = pg.theme; pg._lastIsDoc = !!isDoc;
    // El iframe es transparente: si el contenido (sobre todo un documento
    // completo) no pinta su propio fondo, se vería el blanco del contenedor.
    // Pintamos el contenedor con el fondo del tema para que cubra TODO el preview.
    const t = PG_THEMES[pg.theme] || PG_THEMES[PG_DEFAULT_THEME];
    $('.pg-sandbox-body').css('background', t.bg || '#fff');
    const fr = document.getElementById('pgSandboxFrame');
    fr.onload = () => pgApplyZoom();   // el scroll lo hace el iframe interno; reaplicamos el zoom al cargar
    fr.srcdoc = pgWrapHtml(htmlBody, pg.theme, isDoc);
    // La pestaña "Código" refleja la fuente de lo que se está renderizando.
    if (!isDoc) {
        const $code = $('#pgSandboxCode').find('code').removeAttr('data-highlighted').text(htmlBody);
        if (window.hljs) hljs.highlightElement($code[0]);
    }
    $('.pg-tab[data-sbtab="preview"]').click();
    pgMobileShowSandbox();   // en móvil, saltar a la vista Sandbox para ver el render
}
function pgShowSandboxCode(code) {
    $('#pgSandboxEmpty').hide();
    const $code = $('#pgSandboxCode').find('code').text(code);
    if (window.hljs) hljs.highlightElement($code[0]);
    $('.pg-tab[data-sbtab="code"]').click();
    pgMobileShowSandbox();
}

/* ── Zoom del preview ──
 * Escala el CONTENIDO del iframe (no el tamaño del iframe), que es el único que
 * hace scroll. Usa la propiedad CSS `zoom` (reflowea el layout, a diferencia de
 * transform:scale). Se reaplica en cada render (onload) porque el iframe recarga. */
function pgApplyZoom() {
    const fr = document.getElementById('pgSandboxFrame');
    $('#pgZoomLabel').text((pg.zoom || 100) + '%');
    if (!fr) return;
    let doc;
    try { doc = fr.contentDocument || (fr.contentWindow && fr.contentWindow.document); } catch (e) { return; }
    if (doc && doc.documentElement) doc.documentElement.style.zoom = (pg.zoom || 100) / 100;
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

// Parche del preview para overlays/modales a pantalla completa (fixed inset-0).
// Un position:fixed se ancla al viewport del IFRAME y NO genera scroll, así que
// un modal más alto que el lienzo se recorta arriba y abajo (el contenido queda
// cortado). Aquí lo hacemos scrollable (overflow-y:auto en el overlay) y
// centramos su tarjeta con margin:auto: a diferencia de align-items:center, los
// márgenes automáticos colapsan a 0 al desbordar en lugar de recortar la parte
// superior. Resultado: el componente SIEMPRE se ve completo dentro del contenedor.
// Vive dentro del srcdoc del iframe, por eso el selector global es seguro.
const PG_PREVIEW_FIX_CSS =
      '[class*="fixed"][class*="inset-0"]{overflow-y:auto;}'
    + '[class*="fixed"][class*="inset-0"] > *{margin-top:auto;margin-bottom:auto;}';

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
        const headInject = `<base href="${appBase}">${scripts}${links}${style}<style>${PG_PREVIEW_FIX_CSS}</style>`;
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
        // El stage ocupa TODO el ancho/alto del lienzo: un componente con w-full,
        // grid o flex llena el sandbox; uno con ancho propio (max-w-sm, etc.) se
        // centra horizontalmente sin estirarse. Así no queda "encogido" en medio.
        // align-items:flex-start evita recortar componentes altos (se scrollea).
        : `body{min-height:100vh;}`
          + `.pg-stage{box-sizing:border-box;width:100%;min-height:100vh;padding:28px;`
          +           `display:flex;flex-direction:column;align-items:center;justify-content:flex-start;}`
          // Hijo directo a ancho completo (la mayoría de componentes que deben
          // llenar el lienzo) pero respetando su propio max-width si lo declaran.
          + `.pg-stage > *{width:100%;}`;

    return `<!DOCTYPE html><html${htmlAttr}><head><meta charset="utf-8">
        <base href="${appBase}">
        <script src="https://cdn.tailwindcss.com"><\/script>
        ${scripts}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
        ${links}${style}
        <script src="https://unpkg.com/lucide@latest"><\/script>
        <style>html,body{margin:0;}body{background:${t.bg};color:${t.fg};font-family:'Inter',system-ui,sans-serif;}*{box-sizing:border-box;}${center}${PG_PREVIEW_FIX_CSS}</style>
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
// Tono determinista (0–359) derivado del nombre: cada plantilla tiene su color.
function pgTplHue(name) {
    let h = 0;
    const s = String(name || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
}

function pgRenderTemplatesList() {
    const items = pg._savedTemplates || [];
    const $list = $('#pgTemplatesList').empty();
    $('#pgTemplatesSummary').text(items.length ? `${items.length} plantilla(s)` : 'Sin plantillas');
    if (!items.length) {
        $list.append('<p class="pg-hint pg-tpl-empty">Aún no has guardado plantillas. Usa el botón <i data-lucide="bookmark-plus" class="w-3 h-3" style="display:inline"></i> del sandbox.</p>');
        if (window.lucide) lucide.createIcons();
        return;
    }
    items.forEach(t => {
        const hue       = pgTplHue(t.name);
        const dateShort = (t.savedAt || '').slice(0, 10);
        // Tema sin el paréntesis aclaratorio: "Libre (sin paleta)" → "Libre".
        const themeShort = (t.themeLabel || '').replace(/\s*\(.*\)\s*$/, '').trim();
        // Descripción: el prompt/título que originó la plantilla (si aporta algo
        // distinto al nombre del archivo).
        let desc = (t.title || t.userText || '').trim();
        if (desc.toLowerCase() === (t.name || '').toLowerCase()) desc = '';
        const $cell = $('<div class="pg-tpl-cell"></div>');
        const $card = $(`
            <button type="button" class="pg-tpl-card" style="--tpl-hue:${hue};" title="Cargar «${pgEscape(t.name)}» en el sandbox">
                <span class="pg-tpl-head">
                    <span class="pg-tpl-ic"><i data-lucide="layout-template"></i></span>
                    ${t.size ? `<span class="pg-tpl-size">${pgEscape(t.size)}</span>` : ''}
                </span>
                <span class="pg-tpl-name">${pgEscape(t.name)}</span>
                ${desc ? `<span class="pg-tpl-desc">${pgEscape(desc)}</span>` : ''}
                <span class="pg-tpl-foot">
                    <span class="pg-tpl-chips">
                        ${themeShort ? `<span class="pg-tpl-chip">${pgEscape(themeShort)}</span>` : ''}
                        ${t.agentLabel ? `<span class="pg-tpl-chip is-agent">${pgEscape(t.agentLabel)}</span>` : ''}
                    </span>
                    ${dateShort ? `<span class="pg-tpl-date">${pgEscape(dateShort)}</span>` : ''}
                </span>
            </button>`);
        const $del = $(`<button type="button" class="pg-tpl-del" title="Eliminar plantilla"><i data-lucide="trash-2"></i></button>`);
        $card.on('click', () => pgLoadSavedTemplate(t));
        $del.on('click', function (e) { e.stopPropagation(); pgDeleteSavedTemplate(t, $(this)); });
        $cell.append($card, $del);
        $list.append($cell);
    });
    if (window.lucide) lucide.createIcons();
}

/* Carga una plantilla de disco: restaura su tema, la pinta en el sandbox y deja
 * su conversación lista para seguir iterando en un chat independiente. */
function pgLoadSavedTemplate(t) {
    if (!t || !t.html) { pgToast('Plantilla sin contenido', 'warn'); return; }

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
    pgCloseTemplates();
    pgToast('Plantilla "' + (t.name || '') + '" cargada', 'success');
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
function pgToast(msg, type) {
    const $t = $('#pgToast');
    $t.text(msg).attr('data-tone', type || 'info').addClass('visible');
    clearTimeout(pg._toast);
    pg._toast = setTimeout(() => $t.removeClass('visible'), 2800);
}
