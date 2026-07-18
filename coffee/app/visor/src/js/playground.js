/* ──────────────────────────────────────────────────────────────
   Playground de Agentes — pagina hermana del Visor.
   Reusa los endpoints del visor SIN tocarlo:
     - ctrl/ctrl-visor.php          → lista agentes + grimorios (con raw)
     - ctrl/ctrl-coffeeia-stream.php → chat SSE (acepta systemOverride opcional)
   Porta el motor de chat del Visor: typewriter, card "Conjurando…",
   sonido al terminar, adjuntar imagenes y modo lienzo.
   ────────────────────────────────────────────────────────────── */

const PG_API         = 'ctrl/ctrl-visor.php';
const PG_API_STREAM  = 'ctrl/ctrl-coffeeia-stream.php';
const PG_API_THREADS = 'ctrl/ctrl-pg-threads.php';   // hilos de conversación (SQLite)

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

    // Aviso persistente cuando el tool-calling no funcionó en este turno: el
    // template pudo salir sin datos reales (el title trae el motivo completo).
    const warnItem = meta.toolsFallback
        ? `<span class="meta-item" style="color:#f59e0b;" title="${pgEscape(meta.toolsFallback)}">⚠ sin consultas en vivo</span>`
        : '';

    return costItem + toksItem + warnItem + `<span class="meta-item">Time: <strong>${elapsedSec}</strong></span>`;
}

const PG_STORE_KEY  = 'playground:settings:v1';

// Revision del valor por DEFECTO del lienzo. Los ajustes guardados antes de que el
// lienzo pasara a venir encendido traen canvasMode:false por el default viejo, no
// porque el usuario lo apagara: se descartan una vez y se adopta el default nuevo.
// Subir este numero si el default vuelve a cambiar.
const PG_CANVAS_REV  = 2;

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
    + `- El resultado se renderiza en un lienzo a PANTALLA COMPLETA: su nodo raíz debe ocupar TODO el ancho y alto. Empieza SIEMPRE el markup con un contenedor de pantalla \`<div class="w-full min-h-screen ...">\` (o \`h-screen\` + \`flex\`/\`grid\`) que llene el lienzo de borde a borde. NUNCA entregues como raíz una card o panel suelto centrado con \`max-w-*\` ni un fragmento (una sola barra/fila): eso deja el render "encogido" arriba con huecos alrededor. Si el diseño ES una tarjeta o formulario pequeño, ENVUÉLVELO en ese contenedor de pantalla completa (con \`flex items-center justify-center\`) para que quede centrado dentro de un lienzo que sí llena todo.\n`
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
    canvasMode: true,        // modo lienzo (genera HTML renderizable): ENCENDIDO por defecto
    planMode:   false,       // planear primero: propone un plan y espera OK antes de construir
    dbToolsOn:  false,       // tools de base de datos (run_select + conexión automática al nombrar una base) — apagadas hasta activarlas con clic
    fsToolsOn:  false,       // tools de archivos (list_dir/read_file/grep_files + conexión automática de carpeta) — apagadas hasta activarlas con clic
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
    targetFrag: null,        // componente ANCLADO desde el preview: {html, label} — el próximo mensaje edita solo ese fragmento
    _lastUserText: '',       // último prompt del usuario (titula los templates)
    _transmute: null,        // parámetros del último transmute del diseño activo (modulo/entidad/dir/pivote)
    splitW:    '',           // ancho del panel de chat (px) — splitter
    zoom:      100,          // zoom del preview (%) — escala el contenido del iframe
    _popSound: null,
    _varochCss: '',          // CSS embebido extraido del grimorio Coffee-Varoch
    threadUid:   null,       // uid del hilo activo (null = aún no persistido)
    threadTitle: '',         // título del hilo activo
    _threadSaveTimer: null,  // debounce del autosave del hilo
    threadsView: 'list',     // vista del modal de hilos: 'list' | 'grid' (miniaturas)
    _threadRows: [],         // cache de la última respuesta de list (para alternar sin re-fetch)
    _threadThumbObs: null,   // IntersectionObserver que carga las miniaturas al entrar en viewport
    activeDb:    null,       // base MySQL conectada (conexión pegajosa de la conversación)
    activeFolder: null       // carpeta local conectada (conexión pegajosa de la conversación)
};

$(async () => {
    pgLoadSettings();
    pgApplyUiTheme(pg.uiTheme);
    pgApplySplit(pg.splitW);
    pgBind();
    await pgLoadLibrary();
    pgApplyAgent(pg.agentKey, true);
    pgApplyCanvasUI();
    pgApplyPlanUI();
    pgApplyToolsUI();
    pgApplyViewport();
    pgRestoreSession();   // retoma la última sesión (chat + render) si la había
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
        // Solo se respeta el lienzo guardado si viene de la revision actual del default
        // (ver PG_CANVAS_REV); si no, gana el default y el usuario puede volver a apagarlo.
        if (typeof s.canvasMode === 'boolean' && s.canvasRev === PG_CANVAS_REV) pg.canvasMode = s.canvasMode;
        if (typeof s.planMode === 'boolean')     pg.planMode   = s.planMode;
        // Las tools NO se restauran a propósito: arrancan siempre apagadas en cada
        // carga y solo se habilitan al darles clic (dbToolsOn/fsToolsOn se quedan en false).
        if (PG_VIEWPORTS[s.viewport])            pg.viewport = s.viewport;
        if (s.threadsView === 'list' || s.threadsView === 'grid') pg.threadsView = s.threadsView;
        if (Array.isArray(s.knowledge))          pg.knowledge = new Set(s.knowledge);
    } catch (e) {}
}
function pgSaveSettings() {
    try {
        localStorage.setItem(PG_STORE_KEY, JSON.stringify({
            agentKey: pg.agentKey, theme: pg.theme, uiTheme: pg.uiTheme, model: pg.model,
            canvasMode: pg.canvasMode, canvasRev: PG_CANVAS_REV, planMode: pg.planMode, splitW: pg.splitW, zoom: pg.zoom, viewport: pg.viewport,
            dbToolsOn: pg.dbToolsOn, fsToolsOn: pg.fsToolsOn, threadsView: pg.threadsView,
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
    // "Coffee" en color de texto (negro) y el sufijo ("IA"/"Magic"/…) en el
    // tono del tema, para el lockup de marca junto al grano.
    const label = cfg.label || '';
    const m = label.match(/^(Coffee)(.*)$/i);
    $('#pgChatAgentName').html(m
        ? `<span class="pg-agent-coffee">${pgEscape(m[1])}</span><span class="pg-agent-suffix">${pgEscape(m[2])}</span>`
        : pgEscape(label));
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

    $('#pgModelSelect').on('change', e => { pg.model = e.target.value || ''; pgSaveSettings(); pgWarnModelTools(); });

    $('#pgThemeToggle').on('click', () => {
        pgApplyUiTheme(pg.uiTheme === 'dark' ? 'light' : 'dark');
        pgSaveSettings();
    });

    // "Limpiar" solo suelta los datos conectados; "Reiniciar" sí abre hilo nuevo.
    $('#pgClearBtn').on('click', () => pgClearData());
    $('#pgResetBtn').on('click', () => pgNewThread());

    // Hilos de conversación
    $('#pgNewThreadBtn').on('click', () => pgNewThread());
    $('#pgDelThreadBtn').on('click', () => pgDeleteCurrentThread());
    $('#pgThreadChip').on('click', () => pgRenameThreadChipInline());
    $('#pgThreadsBtn').on('click', () => pgOpenThreads());
    $('#pgThreadsClose, #pgThreadsDone').on('click', () => pgCloseThreads());
    $('#pgThreadsModal .pg-modal-backdrop').on('click', () => pgCloseThreads());
    $('#pgThreadsNew').on('click', () => { pgNewThread(); pgCloseThreads(); });
    $('#pgThreadsViewList').on('click', () => pgSetThreadsView('list'));
    $('#pgThreadsViewGrid').on('click', () => pgSetThreadsView('grid'));

    pgBindSplitter();

    $('#pgSendBtn').on('click', () => { if (pg.isBusy) pgStop(); else pgSubmit(); });
    $('#pgInput').on('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); pgSubmit(); }
    }).on('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 180) + 'px';
    });

    // Modo lienzo
    $('#pgPlanToggle').on('click', () => {
        pg.planMode = !pg.planMode;
        pgApplyPlanUI();
        pgSaveSettings();
    });

    $('#pgCanvasToggle').on('click', () => {
        pg.canvasMode = !pg.canvasMode;
        pgApplyCanvasUI();
        pgSaveSettings();
    });

    // Menú "Tools" (planear + interruptores de BD/archivos). Se queda abierto al
    // conmutar cada opción; se cierra tocando fuera o pulsando el botón otra vez.
    $('#pgToolsToggle').on('click', function (e) {
        e.stopPropagation();
        const open = !$('#pgToolsPop').hasClass('is-open');
        $('#pgToolsPop').toggleClass('is-open', open);
        $(this).attr('aria-expanded', open ? 'true' : 'false');
    });
    $(document).on('click.pgTools', e => {
        if (!$('#pgToolsPop').hasClass('is-open')) return;
        if ($(e.target).closest('.pg-tools-menu').length) return;
        $('#pgToolsPop').removeClass('is-open');
        $('#pgToolsToggle').attr('aria-expanded', 'false');
    });

    // Interruptores de tools: apagarlas evita la conexión automática (la detección
    // por lenguaje natural se activa sola al nombrar bases/tablas o rutas) y suelta
    // la conexión pegajosa que hubiera.
    $('#pgDbToolsToggle').on('click', () => {
        pg.dbToolsOn = !pg.dbToolsOn;
        if (!pg.dbToolsOn && pg.activeDb) pgSetActiveDb(null);
        pgApplyToolsUI();
        pgSaveSettings();
        pgToast(pg.dbToolsOn ? 'Tools de base de datos activadas' : 'Tools de base de datos desactivadas', 'info');
    });
    $('#pgFsToolsToggle').on('click', () => {
        pg.fsToolsOn = !pg.fsToolsOn;
        if (!pg.fsToolsOn && pg.activeFolder) pgSetActiveFolder(null);
        pgApplyToolsUI();
        pgSaveSettings();
        pgToast(pg.fsToolsOn ? 'Tools de archivos activadas' : 'Tools de archivos desactivadas', 'info');
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
        // En "Estilos" el iframe sigue visible (es lo que se inspecciona); solo
        // se oculta en "Código".
        $('#pgSandboxFrame').toggleClass('hidden', tab === 'code');
        $('#pgSandboxCode').toggleClass('hidden', tab !== 'code');
        if (tab === 'styles') pgEnterInspect(); else pgExitInspect();
    });

    // Apuntar un componente del preview para anclarlo como objetivo de edición.
    $('#pgTargetBtn').on('click', () => pg._targeting ? pgExitTarget() : pgEnterTarget());

    // Copiar la configuración del elemento inspeccionado: CSS resuelto o clases Tailwind.
    $('#pgStylesContent').on('click', '#pgStyCopyBtn', function (e) { e.stopPropagation(); pgCopyStyleConfig(); });
    $('#pgStylesContent').on('click', '#pgStyCopyCls', function (e) { e.stopPropagation(); pgCopyClasses(); });
    $('#pgStylesContent').on('click', '#pgStyCopyHtml', function (e) { e.stopPropagation(); pgCopyStructurePrompt(); });
    $('#pgStylesContent').on('click', '#pgStyParent', function (e) { e.stopPropagation(); pgInsSelectParent(); });

    // Copiar un valor/clase suelto desde el inspector de estilos (delegado).
    $('#pgStylesContent').on('click', '[data-copy]', function () {
        const v = $(this).attr('data-copy');
        if (v) pgCopyText(v, 'Copiado: ' + v);
    });

    // Tooltip explicativo de cada chip de clase (qué hace esa utilidad).
    $('#pgStylesContent')
        .on('mouseenter', '.pg-sty-chip', function () {
            const d = $(this).attr('data-desc'); if (!d) return;
            const t = pgChipTip(); t.textContent = d; t.classList.add('visible');
        })
        .on('mousemove', '.pg-sty-chip', function (e) {
            const t = pgChipTip();
            let x = e.clientX + 14, y = e.clientY + 16;
            if (x + t.offsetWidth > window.innerWidth - 8) x = window.innerWidth - 8 - t.offsetWidth;
            if (y + t.offsetHeight > window.innerHeight - 8) y = e.clientY - t.offsetHeight - 10;
            t.style.left = x + 'px'; t.style.top = y + 'px';
        })
        .on('mouseleave', '.pg-sty-chip', function () { pgChipTip().classList.remove('visible'); });

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

    // Viewport del preview (móvil / laptop / completo)
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
    $('#pgSaveTplUpdate').on('click', () => pgConfirmSaveTemplate(pg._loadedSlug));
    $('#pgSaveTplName').on('input', function () {
        $('#pgSaveTplSlug').text(this.value.trim() ? 'Carpeta: documents/template/' + pgSlugify(this.value) + '/' : '');
    }).on('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); pgConfirmSaveTemplate(); } });

    // Transmutación: diseño aprobado -> módulo coffeeSoft en Coffee Studio
    $('#pgTransmuteBtn').on('click', () => pgOpenTransmute());
    $('#pgTransmuteClose, #pgTransmuteCancel').on('click', () => pgCloseTransmute());
    $('#pgTransmuteModal .pg-modal-backdrop').on('click', () => pgCloseTransmute());
    $('#pgTransmuteConfirm').on('click', () => pgConfirmTransmute());
    // El módulo dicta entidad y carpeta sugeridas mientras no se toquen a mano.
    $('#pgTmModulo').on('input', function () {
        const mod = pgSlugify(this.value);
        $('#pgTmSlug').text(this.value.trim() ? 'Plantilla: documents/template/' + mod + '/' : '');
        if (!$('#pgTmEntidad').data('touched')) $('#pgTmEntidad').val(pgPascalize(this.value));
    });
    $('#pgTmEntidad').on('input', function () { $(this).data('touched', true); });

    // Plantillas guardadas
    $('#pgTemplatesBtn').on('click', () => pgOpenTemplates());
    $('#pgTemplatesClose, #pgTemplatesDone').on('click', () => pgCloseTemplates());
    $('#pgTemplatesModal .pg-modal-backdrop').on('click', () => pgCloseTemplates());

    $(document).on('keydown', e => {
        if (e.key === 'Escape') { pgCloseKnowledge(); pgCloseSaveTemplate(); pgCloseTemplates(); pgCloseThreads(); }
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

function pgApplyPlanUI() {
    const $btn = $('#pgPlanToggle');
    $btn.toggleClass('is-on', pg.planMode);
    $btn.attr('title', pg.planMode
        ? 'Planear primero ACTIVO — el agente propone un plan y espera tu OK antes de generar el template'
        : 'Planear antes de construir: el agente propone un plan y espera tu OK antes de generar el template');
    pgApplyToolsBadge();
}

function pgApplyToolsUI() {
    const $db = $('#pgDbToolsToggle');
    $db.toggleClass('is-on', pg.dbToolsOn);
    $db.attr('title', pg.dbToolsOn
        ? 'Tools de base de datos ACTIVAS (run_select y conexión automática al nombrar una base) — clic para desactivar'
        : 'Tools de base de datos DESACTIVADAS — el agente no se conectará a ninguna base aunque la nombres');
    const $fs = $('#pgFsToolsToggle');
    $fs.toggleClass('is-on', pg.fsToolsOn);
    $fs.attr('title', pg.fsToolsOn
        ? 'Tools de archivos ACTIVAS (list_dir/read_file/grep_files y conexión automática al nombrar una carpeta) — clic para desactivar'
        : 'Tools de archivos DESACTIVADAS — el agente no se conectará a ninguna carpeta aunque la nombres');
    pgApplyToolsBadge();
}

// El botón "Tools" se enciende SOLO cuando hay algo activo dentro del menú
// (planear, tools de BD o tools de archivos). Si no hay ninguna activa, el badge
// queda apagado para que refleje el estado real y no confunda.
function pgApplyToolsBadge() {
    const active = pg.planMode || pg.dbToolsOn || pg.fsToolsOn;
    $('#pgToolsToggle').toggleClass('is-active', active);
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

/* "Limpiar" (junto al input): suelta SOLO los datos conectados — base, carpeta y
 * template fijado — conservando la conversación y el hilo. Antes estaba cableado
 * a pgNewThread() y borraba todo; para empezar de cero están "Nuevo hilo" (+) y
 * "Reiniciar" (⟲) en la cabecera. */
function pgClearData() {
    const had = !!(pg.activeDb || pg.activeFolder || pg.pinnedTplId);
    pg.activeDb = null;
    pgRenderDbChip();
    pg.activeFolder = null;
    pgRenderFolderChip();
    pg.pinnedTplId = null;
    pgRefreshPinUI();
    pgSaveSession();
    pgToast(had
        ? 'Datos desconectados (base/carpeta/referencia). La conversación se conserva.'
        : 'No había base, carpeta ni referencia conectadas.', 'info');
}

function pgClearChat() {
    pg.history = [];
    pg.templates = [];
    pg._activeTplId = null;
    pg.pinnedTplId = null;
    pg.threadUid = null;
    pg.threadTitle = '';
    pg._loadedSlug = null;
    pg._loadedName = '';
    pg._transmute = null;
    pg.activeDb = null;    // limpiar el chat suelta la conexión a la base (como el Visor)
    pgRenderDbChip();
    pg.activeFolder = null; // ...y también la conexión a la carpeta
    pgRenderFolderChip();
    clearTimeout(pg._threadSaveTimer);
    pgClearSession();      // al limpiar el chat, no hay sesión que retomar
    pgUpdateThreadChip();
    pgRenderPinBanner();   // quita el chip "Modificando…" si quedaba
    pg.targetFrag = null;
    pgRenderTargetBanner();
    if (pg._targeting) pgExitTarget();
    $('#pgChatBody').html(`
        <div class="pg-empty">
            <i data-lucide="coffee"></i>
            <div class="pg-empty-title">Pon a prueba a tu agente</div>
            <div class="pg-empty-sub">Escríbele una instrucción y observa el resultado en el sandbox.</div>
        </div>`);
    if (window.lucide) lucide.createIcons();
}

/* ── Conexión a base de datos (conexión pegajosa por conversación) ──
 * Gemelo del patrón del Visor: la base se reenvía como `dbConnect` en cada turno
 * y el agente la consulta con run_select (solo lectura) para poblar el template
 * del sandbox con datos reales. La resolución y las credenciales son server-side. */

// Fija (o suelta, con null) la base conectada y refresca el chip indicador.
function pgSetActiveDb(schema) {
    const next = schema || null;
    const changed = next !== pg.activeDb;
    pg.activeDb = next;
    pgRenderDbChip();
    if (changed && next) {
        pgToast('🛢 Conectado a la base ' + next, 'success');
        pgWarnModelTools();   // recién conectada + modelo sin tools = avisar ya, no al fallar
    }
}

// Chip "🛢 <base> ✕" sobre el input. La ✕ desconecta (sin borrar el chat).
// La base se conecta nombrándola en el chat ("conéctate a reginas…"); el backend
// la resuelve y la devuelve en el evento `done`, igual que el Visor.
function pgRenderDbChip() {
    const $chip = $('#pgDbChip');
    if (!$chip.length) return;
    if (!pg.activeDb) { $chip.hide().empty(); return; }
    $chip.html(`
        <i data-lucide="database" class="w-3 h-3"></i>
        <span class="ia-db-chip-name" title="Base conectada: ${pgEscape(pg.activeDb)}">${pgEscape(pg.activeDb)}</span>
        <button type="button" class="ia-db-chip-x" title="Desconectar de la base"><i data-lucide="x" class="w-3 h-3"></i></button>
    `).show();
    $chip.find('.ia-db-chip-x').off('click').on('click', () => {
        pgSetActiveDb(null);
        pgToast('Desconectado de la base', 'info');
    });
    if (window.lucide) lucide.createIcons();
}

/* ── Conexión a una carpeta local (conexión pegajosa por conversación) ──
 * Gemelo del patrón del Visor: la carpeta se reenvía como `folderConnect` en cada
 * turno y el agente la navega en SOLO LECTURA (list_dir/read_file/grep_files) para
 * responder con el código real. La resolución y el sandbox son server-side. */

// Fija (o suelta, con null) la carpeta conectada y refresca el chip indicador.
function pgSetActiveFolder(path) {
    const next = path || null;
    const changed = next !== pg.activeFolder;
    pg.activeFolder = next;
    pgRenderFolderChip();
    if (changed && next) {
        const fname = String(next).replace(/[\/\\]+$/, '').split(/[\/\\]/).pop();
        pgToast('📁 Conectado a la carpeta ' + fname, 'success');
    }
}

// Chip "📁 <carpeta> ✕" sobre el input. La ✕ desconecta (sin borrar el chat).
// La carpeta se conecta nombrándola en el chat ("conéctate a costsys de coffee…");
// el backend la resuelve y la devuelve en el evento `done`, igual que el Visor.
function pgRenderFolderChip() {
    const $chip = $('#pgFolderChip');
    if (!$chip.length) return;
    if (!pg.activeFolder) { $chip.hide().empty(); return; }
    const name = String(pg.activeFolder).replace(/[\/\\]+$/, '').split(/[\/\\]/).pop();
    $chip.html(`
        <i data-lucide="folder-open" class="w-3 h-3"></i>
        <span class="ia-db-chip-name" title="Carpeta conectada: ${pgEscape(pg.activeFolder)}">${pgEscape(name)}</span>
        <button type="button" class="ia-db-chip-x" title="Desconectar de la carpeta"><i data-lucide="x" class="w-3 h-3"></i></button>
    `).show();
    $chip.find('.ia-db-chip-x').off('click').on('click', () => {
        pgSetActiveFolder(null);
        pgToast('Desconectado de la carpeta', 'info');
    });
    if (window.lucide) lucide.createIcons();
}

/* ── Sesión persistente (retomar al recargar) ──
 * El Lab guarda en localStorage la conversación + el último render + las
 * miniaturas de la sesión, y los restaura al abrir, igual que Forge retoma su
 * hilo. Se autoguarda al terminar cada respuesta, al renderizar y al cargar una
 * plantilla; se borra al limpiar el chat. */
const PG_SESSION_KEY = 'playground:session:v1';

function pgSnapshotSession() {
    // Historial LIGERO: sin base64 de vision ni previews. Con imagenes adjuntas el
    // JSON superaba la cuota de localStorage, setItem lanzaba y la sesion no se
    // guardaba en silencio -> al recargar el chat aparecia vacio ("sin historial").
    const history = pg.history.map(m => {
        if (!m.images && !m.imagesPreview) return m;
        const rest = Object.assign({}, m);
        delete rest.images;
        delete rest.imagesPreview;
        return rest;
    });
    return {
        history:      history,
        templates:    pg.templates,
        threadUid:    pg.threadUid,
        threadTitle:  pg.threadTitle,
        activeTplId:  pg._activeTplId,
        pinnedTplId:  pg.pinnedTplId,
        lastUserText: pg._lastUserText,
        lastIsDoc:    pg._lastIsDoc,
        lastHtml:     pg.lastHtml,
        lastTheme:    pg.lastTheme,
        loadedSlug:   pg._loadedSlug || null,
        loadedName:   pg._loadedName || '',
        transmute:    pg._transmute || null,
        agentKey:     pg.agentKey,
        theme:        pg.theme,
        activeDb:     pg.activeDb || null,
        activeFolder: pg.activeFolder || null,
        ts:           Date.now()
    };
}
function pgSaveSession() {
    try {
        localStorage.setItem(PG_SESSION_KEY, JSON.stringify(pgSnapshotSession()));
    } catch (e) {
        // Sesión muy grande para localStorage: reintenta sin las miniaturas ni el
        // último render (conserva la conversación, que es lo esencial; el hilo del
        // servidor guarda la versión completa).
        try {
            const snap = pgSnapshotSession();
            snap.templates = [];
            snap.lastHtml  = '';
            localStorage.setItem(PG_SESSION_KEY, JSON.stringify(snap));
        } catch (e2) { /* sin espacio: no se persiste */ }
    }
}
function pgClearSession() {
    try { localStorage.removeItem(PG_SESSION_KEY); } catch (e) {}
}
// Reconstruye el chat (texto) desde pg.history y re-asocia las miniaturas.
function pgRebuildChat() {
    const $b = $('#pgChatBody').empty();
    if (!pg.history.length) {
        $b.html(`
            <div class="pg-empty">
                <i data-lucide="coffee"></i>
                <div class="pg-empty-title">Pon a prueba a tu agente</div>
                <div class="pg-empty-sub">Escríbele una instrucción y observa el resultado en el sandbox.</div>
            </div>`);
        if (window.lucide) lucide.createIcons();
        return;
    }
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
    // Re-pintar las miniaturas de la sesión sobre el último mensaje de IA.
    if (Array.isArray(pg.templates) && pg.templates.length) {
        const $lastAI = $('#pgChatBody .ia-msg.ai').last();
        const $target = $lastAI.length ? $lastAI : $('#pgChatBody');
        pg.templates.forEach(tpl => pgAppendTemplateCard($target, tpl));
    }
    pgScroll();
}
// Restaura la última sesión guardada. Devuelve true si había algo que retomar.
function pgRestoreSession() {
    let s;
    try { s = JSON.parse(localStorage.getItem(PG_SESSION_KEY) || 'null'); } catch (e) { s = null; }
    if (!s || !Array.isArray(s.history) || !s.history.length) return false;

    if (s.theme && PG_THEMES[s.theme]) {
        pg.theme = s.theme;
        $('#pgThemeSelect').val(s.theme);
        $('#pgSandboxTheme').text((PG_THEMES[s.theme] || {}).label || s.theme);
    }
    pg.history       = s.history || [];
    pg.templates     = s.templates || [];
    // Reasociar el hilo guardado: sin esto, el siguiente autosave creaba un hilo
    // DUPLICADO en el servidor (misma conversacion, uid nuevo) tras cada recarga.
    pg.threadUid     = s.threadUid || null;
    pg.threadTitle   = s.threadTitle || '';
    pgUpdateThreadChip();
    pg._activeTplId  = s.activeTplId || null;
    pg.pinnedTplId   = s.pinnedTplId || null;
    pg._lastUserText = s.lastUserText || '';
    pg._lastIsDoc    = !!s.lastIsDoc;
    pg.lastHtml      = s.lastHtml || '';
    pg.lastTheme     = s.lastTheme || s.theme;
    pg._loadedSlug   = s.loadedSlug || null;
    pg._loadedName   = s.loadedName || '';
    pg._transmute    = s.transmute || null;
    pg.activeDb      = s.activeDb || null;
    pgRenderDbChip();
    pg.activeFolder  = s.activeFolder || null;
    pgRenderFolderChip();

    pgRebuildChat();
    if (pg.lastHtml) pgRenderSandbox(pg.lastHtml, pg._lastIsDoc);
    pgRefreshPinUI();
    return true;
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

/* ── Hilos de conversación (persistencia SQLite vía ctrl-pg-threads.php) ──
 * Cada hilo guarda el historial + los templates del sandbox + meta (tema/agente/
 * modelo). Se autoguarda tras cada respuesta del agente; el usuario puede crear
 * hilos nuevos y reabrir cualquiera para seguir iterando donde lo dejó. */

function pgUpdateThreadChip() {
    const $chip = $('#pgThreadChip');
    if (pg.threadUid && pg.threadTitle) {
        const t = pg.threadTitle;
        $('#pgThreadChipTitle').text(t.length > 28 ? t.slice(0, 28) + '…' : t);
        $chip.removeClass('hidden').attr('title', 'Hilo activo: ' + t + ' — clic para renombrar');
    } else {
        $chip.addClass('hidden');
    }
    if (window.lucide) lucide.createIcons();
}

// Título del hilo: el guardado si existe, si no el primer mensaje del usuario
// (limpio de los bloques de docs/template embebidos en el content).
function pgThreadTitle() {
    if (pg.threadTitle) return pg.threadTitle;
    const first = pg.history.find(m => m.role === 'user');
    let t = first && first.content ? String(first.content) : '';
    t = t.replace(/\n*===\s*DOCUMENTOS ADJUNTOS[\s\S]*$/i, '')
         .replace(/\n*===\s*TEMPLATE A MODIFICAR[\s\S]*$/i, '')
         .replace(/\n*===\s*TEMPLATE VIGENTE[\s\S]*$/i, '')
         .replace(/\n*===\s*COMPONENTE OBJETIVO[\s\S]*$/i, '')
         .replace(/\s+/g, ' ').trim();
    return t ? t.slice(0, 80) : ('Hilo ' + new Date().toLocaleString());
}

function pgResetSandbox() {
    $('#pgSandboxEmpty').show();
    const fr = document.getElementById('pgSandboxFrame');
    if (fr) fr.srcdoc = '';
    $('#pgSandboxCode').find('code').text('');
    pg.lastHtml = '';
}

function pgNewThread() {
    if (pg.isBusy) { pgToast('Espera a que termine la generación en curso', 'warn'); return; }
    pgClearChat();        // ya resetea threadUid/título/templates/historial
    pgResetSandbox();
    pgToast('Nuevo hilo', 'info');
}

// Empuja un guardado del hilo con debounce, para no saturar al iterar rápido.
function pgAutoSaveThread() {
    clearTimeout(pg._threadSaveTimer);
    pg._threadSaveTimer = setTimeout(() => pgSaveThread(true), 600);
}

async function pgSaveThread(silent) {
    if (!pg.history.length) return;
    const meta = {
        theme: pg.theme, agentKey: pg.agentKey,
        canvasMode: !!pg.canvasMode, planMode: !!pg.planMode, lastUserText: pg._lastUserText || '',
        activeDb: pg.activeDb || '',
        activeFolder: pg.activeFolder || ''
    };
    try {
        const form = new FormData();
        form.append('action', 'save');
        if (pg.threadUid) form.append('uid', pg.threadUid);
        form.append('title',     pgThreadTitle());
        form.append('model',     pg.model || '');
        form.append('meta',      JSON.stringify(meta));
        form.append('messages',  JSON.stringify(pg.history));
        form.append('templates', JSON.stringify(pg.templates));
        const res  = await fetch(PG_API_THREADS, { method: 'POST', body: form });
        const data = await res.json();
        if (!data.success) { if (!silent) pgToast(data.message || 'No se pudo guardar el hilo', 'error'); return; }
        pg.threadUid   = data.uid;
        pg.threadTitle = data.title;
        pgUpdateThreadChip();
        if (!silent) pgToast('Hilo guardado', 'success');
    } catch (e) {
        if (!silent) pgToast('Error de red al guardar el hilo', 'error');
    }
}

function pgCloseThreads() {
    $('#pgThreadsModal').addClass('hidden').attr('aria-hidden', 'true');
    if (pg._threadThumbObs) { pg._threadThumbObs.disconnect(); pg._threadThumbObs = null; }
}

async function pgOpenThreads() {
    $('#pgThreadsModal').removeClass('hidden').attr('aria-hidden', 'false');
    pgApplyThreadsViewButtons();
    $('#pgThreadsList').removeClass('is-grid').html('<p class="pg-hint" style="text-align:center;padding:20px 0;">Cargando…</p>');
    if (window.lucide) lucide.createIcons();
    try {
        // thumb=1 trae, por hilo, el último render para la miniatura de la vista tarjetas.
        const sep = PG_API_THREADS.indexOf('?') === -1 ? '?' : '&';
        const res  = await fetch(PG_API_THREADS + sep + 'action=list&thumb=1', { cache: 'no-store' });
        const data = await res.json();
        if (!data.success) { $('#pgThreadsList').html('<p class="pg-hint">' + (data.message || 'Error al listar') + '</p>'); return; }
        pg._threadRows = data.rows || [];
        pgRenderThreadsList(pg._threadRows);
    } catch (e) {
        $('#pgThreadsList').html('<p class="pg-hint">Error de red al cargar los hilos.</p>');
    }
}

/* Alterna lista/miniaturas sin re-pedir al backend (usa la cache pg._threadRows). */
function pgSetThreadsView(view) {
    const next = view === 'grid' ? 'grid' : 'list';
    if (next === pg.threadsView) return;
    pg.threadsView = next;
    pgSaveSettings();
    pgApplyThreadsViewButtons();
    pgRenderThreadsList(pg._threadRows || []);
}
function pgApplyThreadsViewButtons() {
    $('#pgThreadsViewList').toggleClass('is-active', pg.threadsView === 'list');
    $('#pgThreadsViewGrid').toggleClass('is-active', pg.threadsView === 'grid');
}

function pgRenderThreadsList(rows) {
    pg._threadRows = rows;
    $('#pgThreadsSummary').text(rows.length ? (rows.length + ' hilo(s) guardado(s)') : 'Sin hilos guardados');
    const $list = $('#pgThreadsList').toggleClass('is-grid', pg.threadsView === 'grid');
    if (pg._threadThumbObs) { pg._threadThumbObs.disconnect(); pg._threadThumbObs = null; }
    if (!rows.length) {
        $list.removeClass('is-grid').html('<p class="pg-hint" style="text-align:center;padding:24px 0;">No hay hilos guardados todavía. Empieza a conversar y el hilo se guardará solo.</p>');
        return;
    }
    if (pg.threadsView === 'grid') pgRenderThreadsGrid(rows);
    else pgRenderThreadsListView(rows);
    pgBindThreadItems();
    if (window.lucide) lucide.createIcons();
}

/* Vista LISTA (compacta): una fila por hilo. */
function pgRenderThreadsListView(rows) {
    const html = rows.map(r => `
        <div class="pg-thread-item${r.uid === pg.threadUid ? ' is-active' : ''}" data-thread="${r.uid}" title="Abrir este hilo">
            <div class="pg-thread-main">
                <span class="pg-thread-title">${pgEscape(r.title)}</span>
                <span class="pg-thread-meta">
                    <i data-lucide="message-circle" class="w-3 h-3"></i> ${r.msg_count}
                    ${Number(r.tpl_count) ? '· <i data-lucide="layout-template" class="w-3 h-3"></i> ' + r.tpl_count : ''}
                    ${r.model ? '· ' + pgEscape(r.model) : ''}
                    · ${pgEscape(r.updated_at || '')}
                </span>
            </div>
            <button class="pg-thread-edit" data-thread-edit="${r.uid}" title="Renombrar hilo"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
            <button class="pg-thread-del" data-thread-del="${r.uid}" title="Eliminar hilo"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>`).join('');
    $('#pgThreadsList').html(html);
}

/* Vista MINIATURAS: tarjeta por hilo con el último render del sandbox. Los iframes
 * se cargan de forma perezosa (IntersectionObserver) para no montar 30 previews de
 * golpe; cada uno vuelve a envolverse con pgWrapHtml (Tailwind + tema del hilo). */
function pgRenderThreadsGrid(rows) {
    const html = rows.map((r, i) => {
        const hasThumb = !!(r.thumb_html && String(r.thumb_html).trim());
        const thumb = hasThumb
            ? `<iframe class="pg-thread-card-frame" data-thumb-idx="${i}" sandbox="allow-scripts" scrolling="no" tabindex="-1" aria-hidden="true"></iframe>`
            : `<div class="pg-thread-card-noimg"><i data-lucide="message-square-text"></i><span>Sin render</span></div>`;
        return `
        <div class="pg-thread-card${r.uid === pg.threadUid ? ' is-active' : ''}" data-thread="${r.uid}" title="Abrir este hilo">
            <div class="pg-thread-card-thumb">${thumb}</div>
            <div class="pg-thread-card-info">
                <span class="pg-thread-title">${pgEscape(r.title)}</span>
                <span class="pg-thread-meta">
                    <i data-lucide="message-circle" class="w-3 h-3"></i> ${r.msg_count}
                    ${Number(r.tpl_count) ? '· <i data-lucide="layout-template" class="w-3 h-3"></i> ' + r.tpl_count : ''}
                    · ${pgEscape(r.updated_at || '')}
                </span>
            </div>
            <div class="pg-thread-card-actions">
                <button class="pg-thread-edit pg-iconbtn" data-thread-edit="${r.uid}" title="Renombrar hilo"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                <button class="pg-thread-del pg-iconbtn" data-thread-del="${r.uid}" title="Eliminar hilo"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
        </div>`;
    }).join('');
    $('#pgThreadsList').html(html);
    pgSetupThumbObserver(rows);
}

function pgSetupThumbObserver(rows) {
    const frames = document.querySelectorAll('#pgThreadsList .pg-thread-card-frame');
    if (!frames.length) return;
    const load = (fr) => {
        if (fr.dataset.loaded) return;
        const r = rows[parseInt(fr.getAttribute('data-thumb-idx'), 10)];
        if (!r || !r.thumb_html) return;
        fr.dataset.loaded = '1';
        fr.srcdoc = pgWrapHtml(r.thumb_html, r.thumb_theme || pg.theme, !!r.thumb_is_doc);
    };
    if (!('IntersectionObserver' in window)) { frames.forEach(load); return; }
    pg._threadThumbObs = new IntersectionObserver((entries, obs) => {
        entries.forEach(en => { if (en.isIntersecting) { load(en.target); obs.unobserve(en.target); } });
    }, { root: document.getElementById('pgThreadsList'), rootMargin: '150px' });
    frames.forEach(fr => pg._threadThumbObs.observe(fr));
}

/* Clic (abrir), renombrar y eliminar — compartido por lista y tarjetas. */
function pgBindThreadItems() {
    const sel = '#pgThreadsList .pg-thread-item, #pgThreadsList .pg-thread-card';
    $(sel).off('click').on('click', function () { pgLoadThread($(this).data('thread')); });
    $('#pgThreadsList .pg-thread-edit').off('click').on('click', function (e) {
        e.stopPropagation(); pgRenameThreadInline($(this).closest('.pg-thread-item, .pg-thread-card'));
    });
    $('#pgThreadsList .pg-thread-del').off('click').on('click', function (e) {
        e.stopPropagation(); pgDeleteThread($(this).data('thread-del'));
    });
}

// Edición inline del título: convierte el <span> del título en un <input>.
// Enter o blur confirma; Escape cancela. stopPropagation evita que el clic/teclas
// abran el hilo o cierren el modal (handler global de Escape).
function pgRenameThreadInline($item) {
    if (!$item || !$item.length) return;
    if ($item.find('.pg-thread-rename-input').length) return;   // ya en edición
    const uid      = $item.data('thread');
    const $titleEl = $item.find('.pg-thread-title');
    const current  = $titleEl.text();
    const $input   = $('<input type="text" class="pg-thread-rename-input" maxlength="160">').val(current);
    $titleEl.replaceWith($input);
    $input.trigger('focus').trigger('select');

    let done = false;
    const finish = async (save) => {
        if (done) return; done = true;
        const val = ($input.val() || '').trim();
        let title = current;
        if (save && val && val !== current) {
            const ok = await pgRenameThread(uid, val);
            if (ok) title = val;
        }
        $input.replaceWith($('<span class="pg-thread-title"></span>').text(title));
    };
    $input
        .on('click', e => e.stopPropagation())
        .on('keydown', e => {
            e.stopPropagation();   // no disparar handlers globales (Escape cierra modal)
            if (e.key === 'Enter')      { e.preventDefault(); finish(true); }
            else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        })
        .on('blur', () => finish(true));
}

// Renombra un hilo en el backend (solo título). Si es el hilo activo, refresca el
// chip y pg.threadTitle para que el autosave conserve el nombre.
async function pgRenameThread(uid, title) {
    try {
        const form = new FormData();
        form.append('action', 'rename');
        form.append('uid', uid);
        form.append('title', title);
        const res  = await fetch(PG_API_THREADS, { method: 'POST', body: form });
        const data = await res.json();
        if (!data.success) { pgToast(data.message || 'No se pudo renombrar el hilo', 'error'); return false; }
        if (pg.threadUid === uid) { pg.threadTitle = data.title; pgUpdateThreadChip(); }
        pgToast('Hilo renombrado', 'success');
        return true;
    } catch (e) {
        pgToast('Error de red al renombrar el hilo', 'error');
        return false;
    }
}

/* ── Renombrar el hilo activo desde el chip de la cabecera ──
 * Clic en el chip convierte el título en un <input> inline (mismo patrón que
 * pgRenameThreadInline del modal): Enter o blur confirma, Escape cancela. */
function pgRenameThreadChipInline() {
    if (!pg.threadUid) return;
    const $chip = $('#pgThreadChip');
    if ($chip.find('.pg-thread-rename-input').length) return;   // ya en edición
    const $titleEl = $('#pgThreadChipTitle');
    const current  = pg.threadTitle;
    const $input   = $('<input type="text" class="pg-thread-rename-input" maxlength="160">').val(current);
    $titleEl.hide().after($input);
    $input.trigger('focus').trigger('select');

    let done = false;
    const finish = async (save) => {
        if (done) return; done = true;
        const val = ($input.val() || '').trim();
        $input.remove();
        $titleEl.show();
        if (save && val && val !== current) await pgRenameThread(pg.threadUid, val);
        else pgUpdateThreadChip();
    };
    $input
        .on('click', e => e.stopPropagation())
        .on('keydown', e => {
            e.stopPropagation();   // no disparar handlers globales (Escape)
            if (e.key === 'Enter')      { e.preventDefault(); finish(true); }
            else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        })
        .on('blur', () => finish(true));
}

async function pgLoadThread(uid) {
    if (pg.isBusy) { pgToast('Espera a que termine la generación en curso', 'warn'); return; }
    try {
        const res  = await fetch(PG_API_THREADS + '?action=get&uid=' + encodeURIComponent(uid), { cache: 'no-store' });
        const data = await res.json();
        if (!data.success || !data.thread) { pgToast(data.message || 'No se pudo abrir el hilo', 'error'); return; }
        const th = data.thread;

        pgClearChat();
        pg.threadUid   = th.uid;
        pg.threadTitle = th.title;
        pg.history     = Array.isArray(th.messages)  ? th.messages  : [];
        pg.templates   = Array.isArray(th.templates) ? th.templates : [];

        const meta = th.meta || {};
        if (meta.theme && PG_THEMES[meta.theme]) {
            pg.theme = meta.theme;
            $('#pgThemeSelect').val(meta.theme);
            $('#pgSandboxTheme').text((PG_THEMES[meta.theme] || {}).label || meta.theme);
        }
        if (meta.agentKey && PG_AGENTS[meta.agentKey] && meta.agentKey !== pg.agentKey) {
            $('#pgAgentSelect').val(meta.agentKey);
            pgApplyAgent(meta.agentKey, true);   // keepHistory: no borra lo recién cargado
        }
        if (typeof meta.canvasMode === 'boolean') { pg.canvasMode = meta.canvasMode; pgApplyCanvasUI(); }
        if (typeof meta.planMode === 'boolean')   { pg.planMode   = meta.planMode;   pgApplyPlanUI();   }
        pgSetActiveDb(meta.activeDb || null);   // reconecta la base que tenía el hilo (o suelta)
        pgSetActiveFolder(meta.activeFolder || null); // ...y la carpeta que tenía el hilo (o suelta)
        pg._lastUserText = meta.lastUserText || '';
        if (th.model) { pg.model = th.model; $('#pgModelSelect').val(th.model); }
        pgSaveSettings();

        pgRebuildChat();

        // Restaurar el último render al sandbox para seguir iterando sobre él.
        const lastTpl = pg.templates[pg.templates.length - 1];
        if (lastTpl && lastTpl.html) { pg._activeTplId = lastTpl.id; pgRenderSandbox(lastTpl.html, lastTpl.isDoc); }
        else pgResetSandbox();

        pgUpdateThreadChip();
        pgCloseThreads();
        pgToast('Hilo abierto: ' + th.title, 'success');
    } catch (e) {
        pgToast('Error de red al abrir el hilo', 'error');
    }
}

// Reconstruye las burbujas del chat desde pg.history, re-anclando las tarjetas
// de template a la respuesta del agente que las generó (por su histLen).
function pgRebuildChat() {
    $('#pgChatBody').empty();
    pg.history.forEach((m, i) => {
        if (m.role === 'user') {
            const text = String(m.content || '')
                .replace(/\n*===\s*DOCUMENTOS ADJUNTOS[\s\S]*$/i, '')
                .replace(/\n*===\s*TEMPLATE A MODIFICAR[\s\S]*$/i, '')
                .replace(/\n*===\s*TEMPLATE VIGENTE[\s\S]*$/i, '')
                .replace(/\n*===\s*COMPONENTE OBJETIVO[\s\S]*$/i, '').trim();
            pgAppendUser(text, m.imagesPreview, m.docsMeta);
        } else {
            const tpl = pg.templates.find(t => t.histLen === i + 1);
            if (tpl) {
                let rest = String(m.content || '').replace(/```[a-z0-9+-]*[ \t]*\r?\n?[\s\S]*?```/gi, '').trim();
                if (pgLooksLikeHtml(rest)) rest = '';
                pgAppendAI((rest ? rest + '\n\n' : '') + '🪄 *Render en el sandbox →*');
                pgAppendTemplateCard($('#pgChatBody .ia-msg.ai').last(), tpl);
            } else {
                pgAppendAI(String(m.content || ''));
            }
        }
    });
    pgScroll();
}

// Borrado en el backend, compartido por el modal de hilos y el botón de cabecera.
async function pgDeleteThreadApi(uid) {
    const form = new FormData();
    form.append('action', 'delete');
    form.append('uid', uid);
    const res  = await fetch(PG_API_THREADS, { method: 'POST', body: form });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'No se pudo eliminar');
}

// Eliminación con confirmación de un solo clic.
async function pgDeleteThread(uid) {
    if (!window.confirm('¿Eliminar este hilo? Esta acción no se puede deshacer.')) return;
    try {
        await pgDeleteThreadApi(uid);
        if (pg.threadUid === uid) { pg.threadUid = null; pg.threadTitle = ''; pgUpdateThreadChip(); }
        pgOpenThreads();   // refrescar lista
        pgToast('Hilo eliminado', 'success');
    } catch (e) {
        pgToast(e.message || 'Error de red al eliminar', 'error');
    }
}

/* ── Eliminar el hilo ACTIVO desde la cabecera del chat ──
 * A diferencia de "Reiniciar" (que abre hilo nuevo pero conserva el guardado),
 * esto borra la conversación del disco y deja el chat en blanco. El autosave
 * pendiente se cancela ANTES del borrado para que el debounce no re-cree el
 * hilo recién eliminado. */
async function pgDeleteCurrentThread() {
    if (pg.isBusy) { pgToast('Espera a que termine la generación en curso', 'warn'); return; }
    if (!pg.threadUid && !pg.history.length) { pgToast('No hay conversación que eliminar', 'info'); return; }
    if (!window.confirm('¿Eliminar esta conversación? Esta acción no se puede deshacer.')) return;
    clearTimeout(pg._threadSaveTimer);
    if (pg.threadUid) {
        try { await pgDeleteThreadApi(pg.threadUid); }
        catch (e) { pgToast(e.message || 'Error de red al eliminar', 'error'); return; }
    }
    pgClearChat();
    pgResetSandbox();
    pgToast('Hilo eliminado', 'success');
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

/* Cambia el texto del indicador "Analizando…" para reflejar el estado de las
 * rondas de tool-calling de la base (p.ej. la consulta SELECT en curso). Solo se
 * usa mientras aún no llega ningún token (el indicador sigue montado). */
function pgTypingStatus($typing, text) {
    if (!$typing || !$typing.length) return;
    let t = String(text || '').replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim();
    if (/^consultando/i.test(t)) t = 'Consultando: ' + t.replace(/^consultando\s*/i, '');
    if (t.length > 70) t = t.slice(0, 70) + '…';
    // "Razonando…" (cadena de pensamiento) lleva un cerebro pulsante en vez del
    // orbe. Se monta una sola vez y solo se refresca el contador de tokens: este
    // status llega en cada fragmento y re-renderizar el icono parpadearía.
    if (/^razonando/i.test(t)) {
        const $loader = $typing.find('.ia-typing-loader');
        const $txt = $loader.find('.pg-think-txt');
        if ($txt.length) { $txt.text(t); return; }
        $loader.html(
            `<div style="display:inline-flex;align-items:center;gap:8px">`
          + `<i data-lucide="brain" class="pg-think-brain"></i>`
          + `<span class="pg-think-txt" style="color:#374151;font-weight:500;font-size:12px"></span></div>`);
        $loader.find('.pg-think-txt').text(t);
        if (window.lucide) lucide.createIcons();
        return;
    }
    $typing.find('.ia-typing-loader').html(pgQuantumLoader(t || 'Consultando la base…'));
}
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

// ¿El modelo dado soporta TOOL-CALLING (run_select / lectura de carpeta)? Se
// deriva del atributo data-tools="1" del <option> (mismo patrón que la visión).
// Un modelo desconocido (p.ej. restaurado de un hilo viejo) no genera aviso.
function pgModelSupportsTools(model) {
    const m = model || pg.model;
    if (!m) return true;   // sin modelo explícito decide el backend (default tool-capable)
    const opt = document.querySelector(`#pgModelSelect option[value="${m.replace(/"/g, '\\"')}"]`);
    return !opt || opt.getAttribute('data-tools') === '1';
}

// Heurística: ¿el texto del usuario nombra una RUTA/carpeta/archivo local? Se usa
// para explicar respuestas vacías cuando las tools de archivos están apagadas (el
// agente narra que "va a explorar" pero el backend no resuelve la carpeta).
function pgTextMentionsPath(text) {
    const t = String(text || '');
    return /[A-Za-z]:[\\/]/.test(t)                        // ruta Windows (C:\... o C:/...)
        || /(^|\s)\/[\w.-]+\/[\w.-]+/.test(t)              // ruta unix (/foo/bar)
        || /[\w.-]+[\\/][\w.-]+[\\/]/.test(t)              // dos o más segmentos con separador
        || /\b(carpeta|m[oó]dulo|directorio|archivo|fichero|ruta)\b/i.test(t);
}

// Detección ESTRICTA de una ruta real del disco (C:\..., /a/b, a\b\c). A diferencia
// de pgTextMentionsPath, NO se dispara con la palabra suelta "módulo/carpeta", así
// que es segura para BLOQUEAR el envío antes de gastar el turno.
function pgTextHasRealPath(text) {
    // Una URL no es una carpeta del disco: fuera antes de evaluar, si no
    // "https://sitio.com/img/foo.png" se leería como ruta local.
    const t = String(text || '').replace(/\b[a-z][\w+.-]*:\/\/\S+/gi, ' ');
    return /(^|[\s"'(<[])[A-Za-z]:[\\/]/.test(t)         // Windows: C:\ o C:/ — la letra sola, no el "s:" de https://
        || /[\w.-]+\\[\w.-]+/.test(t)                    // separador backslash: no aparece en prosa
        || /(^|\s)\.{0,2}\/[\w.-]+\/[\w.-]+/.test(t)     // Unix: /a/b, ./a/b, ../a/b
        || /[\w.-]+\/[\w-]+\.[a-z0-9]{1,4}\b/i.test(t);  // a/b.js — segmento + archivo con extensión
}

// Intención EXPLÍCITA de conectar a datos: "conecta a reginas", "conéctate a la
// carpeta X", "conecta con la base". Exige el verbo + preposición (a/al/con) para
// no confundir con pedidos de UI ("un botón que conecta los puntos"). Como desde
// el front no se sabe si el destino es base o carpeta, se usa solo cuando NINGUNA
// tool está encendida (ahí, con seguridad, no hay forma de conectar a nada).
function pgTextIsConnectIntent(text) {
    return /\bcon[eé]ct\w*\s+(a|al|con)\b/i.test(String(text || ""));
}

// Heurística gemela para las tools de BASE DE DATOS: ¿el texto nombra una base,
// tabla o consulta? Mismo fin (explicar el vacío cuando run_select está apagado).
function pgTextMentionsDb(text) {
    return /\b(base de datos|bases de datos|bd|tabla|tablas|select|consulta|query|esquema|schema)\b/i.test(String(text || ''));
}

// Aviso suave cuando el modelo activo puede no soportar consultas en vivo: sin
// tools, la base/carpeta conectada no se lee y el template sale sin datos reales.
function pgWarnModelTools() {
    if (pgModelSupportsTools(pg.model)) return;
    const target = pg.activeDb ? `la base conectada ("${pg.activeDb}")` :
                   pg.activeFolder ? 'la carpeta conectada' : 'bases de datos y carpetas';
    pgToast(`Este modelo puede no soportar consultas en vivo (tools): ${target} podría no leerse. Para datos reales usa GLM, Qwen3 Coder o Kimi.`, 'warn');
}

async function pgSend(text, images, docs) {
    pgSetBusy(true);
    images = Array.isArray(images) ? images : [];
    docs   = Array.isArray(docs)   ? docs   : [];

    // Si el modelo activo NO tiene visión, las imágenes no viajan al modelo: se
    // OMITEN del payload (las seguimos mostrando en el chat y conservando en el
    // history por si luego se cambia a un modelo con visión). Avisar al usuario.
    const dropImages = !!pg.model && !pgModelHasVision(pg.model);
    if (images.length && dropImages) {
        pgToast('Este modelo no tiene visión: la imagen no se enviará. Elige uno con visión (los marcados con “vision”).', 'warn');
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

    // Componente objetivo anclado desde el preview: viaja el template vigente
    // (si no viajó ya con el pin) + el fragmento a editar. El agente devuelve el
    // template COMPLETO con el cambio aplicado solo a ese componente.
    const targetFrag = pg.targetFrag;
    if (targetFrag && targetFrag.html) {
        if (!(pinnedTpl && pinnedTpl.html) && pg.lastHtml) {
            contentForModel = (contentForModel ? contentForModel + '\n\n' : '') +
                '=== TEMPLATE VIGENTE (contexto completo) ===\n' +
                '```html\n' + pg.lastHtml + '\n```';
        }
        contentForModel += '\n\n=== COMPONENTE OBJETIVO (seleccionado por el usuario en el preview) ===\n' +
            'Aplica la instrucción del usuario ÚNICAMENTE a este componente dentro del template. ' +
            'TODO lo demás del template se conserva IDÉNTICO: markup, clases, IDs, textos y scripts. ' +
            'El fragmento proviene del DOM ya renderizado (los iconos pueden aparecer como <svg> en lugar de <i data-lucide>); ' +
            'ubícalo en el fuente por su estructura, clases e IDs. ' +
            'Devuelve el template COMPLETO actualizado en un solo bloque ```html.\n' +
            '```html\n' + targetFrag.html + '\n```';
    }

    const userMsg = { role: 'user', content: contentForModel };
    if (images.length) { userMsg.images = images.map(i => i.base64); userMsg.imagesPreview = images.map(i => i.dataUrl); }
    if (docs.length) userMsg.docsMeta = docs.map(d => ({ name: d.name, size: d.size }));
    pg.history.push(userMsg);
    // En la burbuja mostramos solo el texto del usuario + una nota de referencia
    // si se fijó un template; el HTML inyectado no se vuelca al chat.
    pgAppendUser(text, userMsg.imagesPreview, userMsg.docsMeta);
    if (pinnedTpl) pgAppendPinNote($('#pgChatBody .ia-msg.user').last(), pinnedTpl);
    if (targetFrag) pgAppendTargetNote($('#pgChatBody .ia-msg.user').last(), targetFrag);

    // La referencia es de un solo uso: liberar y limpiar el chip del input.
    if (pg.pinnedTplId) { pg.pinnedTplId = null; pgRefreshPinUI(); }
    if (pg.targetFrag) { pg.targetFrag = null; pgRenderTargetBanner(); }

    // Guarda proactiva: si nombraste una carpeta del disco pero las Tools de
    // archivos están apagadas, el agente no podría leerla (solo "narraría" que va a
    // explorar). Te lo decimos de una vez y no gastamos el turno con el modelo.
    if (pgTextHasRealPath(text) && !pg.fsToolsOn) {
        pgAppendAI('📁 Nombraste una carpeta del disco, pero las **Tools de archivos** están apagadas, '
            + 'así que no puedo leerla. Enciéndelas en el menú **«Tools»** (abajo, junto a «Limpiar») y vuelve a enviar tu mensaje.');
        pgFinish();
        return;
    }

    // Guarda gemela para "conéctate a X": si pides conectar a datos pero NINGUNA
    // tool está encendida, no hay forma de conectar (ni base ni carpeta). Como no
    // sabemos si X es base o carpeta, ofrecemos las dos opciones.
    if (pgTextIsConnectIntent(text) && !pg.dbToolsOn && !pg.fsToolsOn) {
        pgAppendAI('🔌 Para conectarme a datos primero enciende las **Tools** (abajo, junto a «Limpiar»): '
            + 'usa **Tools de base de datos** si es una base (p. ej. reginas), o **Tools de archivos** si es una carpeta. '
            + 'Enciende la que necesites y vuelve a enviar tu mensaje.');
        pgFinish();
        return;
    }

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

    // Directiva de sandbox para agentes de código (p.ej. CoffeeIA): su prompt está
    // pensado para Claude Code (leer MDL.md/CTRL.md/coffeSoft.js vía tools + escalar
    // de modelo). Aquí NO hay acceso a archivos ni cambio de modelo, así que los
    // modelos flojos se quedan "narrando" ("primero consulto las reglas…") y nunca
    // generan. Esta nota los desbloquea: aplica las convenciones de MEMORIA y genera
    // directo, sin anunciar consultas ni proponer Opus/Sonnet.
    if (cfgAgent.render === 'code') {
        systemOverride += `\n\n## Entorno sandbox — genera directo\n`
            + `Corres en un lienzo aislado (Playground) SIN acceso a los archivos del proyecto (MDL.md, CTRL.md, coffeSoft.js, DOC-COFFEESOFT.md, new-component.md) ni a herramientas de lectura, y SIN opción de cambiar de modelo. `
            + `Por eso: NO anuncies que vas a "consultar las reglas" ni "la librería base", ni propongas escalar a Opus/Sonnet — no puedes hacerlo aquí. `
            + `Aplica de memoria las convenciones del framework CoffeeSoft (nomenclatura ls/get, patrón pivote, createTable/createForm/createModalForm, etc.).`;
        if (!pg.planMode) systemOverride += ` Genera el componente DIRECTAMENTE en un bloque de código; no entregues solo un plan en prosa.`;
    }

    // Si el usuario adjuntó imagen(es), exigir fidelidad visual: el render debe
    // reproducir colores, tono (claro/oscuro), tipografía y composición de la
    // imagen, no una interpretación libre del agente.
    if (images.length && usesDesignSystem && !dropImages) {
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

    // Modo planeación: el agente propone un plan en prosa y espera el OK del
    // usuario antes de generar el template (salvo pedido directo o ajuste menor).
    if (pg.planMode && (usesDesignSystem || pg.canvasMode)) {
        systemOverride += `\n\n## Modo planeación (activado por el usuario)\n`
            + `Antes de construir un template NUEVO o hacer un rediseño grande, NO generes código todavía: `
            + `responde en prosa con un PLAN breve (máx 6-8 puntos: objetivo, secciones/layout, componentes, estilo/tema, datos que mostrará) `
            + `y termina preguntando si lo construyes así.\n`
            + `Genera el código directamente, SIN plan previo, solo cuando: `
            + `(a) el usuario apruebe el plan o pida construir ("hazlo", "constrúyelo", "dale", "adelante"), `
            + `(b) el mensaje pida explícitamente ir directo al código, o `
            + `(c) sea un AJUSTE PEQUEÑO sobre el template ya renderizado (p.ej. "cambia el fondo a blanco").`;
    }

    // Base de datos conectada + agente que produce UI: el template del sandbox
    // debe poblarse con datos REALES (no de muestra). El backend ya inyecta el
    // esquema y expone run_select; aquí solo se lo exigimos de forma explícita.
    if (pg.activeDb && (usesDesignSystem || pg.canvasMode)) {
        systemOverride += `\n\n## Datos reales de la base conectada\n`
            + `Hay una base de datos MySQL conectada ("${pg.activeDb}") y su esquema está en el contexto. `
            + `Si el componente muestra datos (tablas, listas, tarjetas, KPIs, gráficas, selects…), DEBES poblarlo con datos REALES: `
            + `ejecuta consultas \`SELECT\` de SOLO LECTURA con la herramienta \`run_select\` usando los nombres reales de tablas y columnas del esquema, `
            + `y escribe esos valores directamente en el HTML que devuelves. `
            + `NO inventes datos de muestra cuando hay una base conectada. `
            + `Si una consulta no devuelve filas, refléjalo con un estado vacío en el componente.`;
    }

    // Poda del PAYLOAD (pg.history no se toca: chat, sesión e hilos guardan todo).
    // Cada iteración deja un template HTML completo en el historial y todo viajaba
    // en cada turno — y en CADA ronda del loop de herramientas — así que el modelo
    // releía miles de tokens de versiones obsoletas. Solo el ÚLTIMO bloque ```html
    // de la conversación viaja completo (es la versión vigente, la que se modifica);
    // los anteriores se sustituyen por una marca.
    let lastHtmlIdx = -1;
    pg.history.forEach((m, i) => {
        if (/```html/i.test(m.content || '')) lastHtmlIdx = i;
    });
    const payload = {
        messages: pg.history.map((m, i) => {
            let content = m.content;
            if (i !== lastHtmlIdx && /```html/i.test(content || '')) {
                content = content.replace(/```html[\s\S]*?```/gi,
                    '[versión anterior del template omitida por brevedad; la versión VIGENTE es el último bloque ```html de la conversación]');
            }
            const o = { role: m.role, content };
            // Solo adjuntar imágenes si el modelo activo tiene visión.
            if (!dropImages && m.images && m.images.length) o.images = m.images;
            return o;
        }),
        systemOverride: systemOverride,
        pinnedFiles:    pinned,
        canvasMode:     !!pg.canvasMode,
        dbConnect:      (pg.dbToolsOn && pg.activeDb) || '',   // base conectada (conexión pegajosa)
        folderConnect:  (pg.fsToolsOn && pg.activeFolder) || '', // carpeta conectada (conexión pegajosa)
        dbTools:        !!pg.dbToolsOn,   // apagado: el backend no resuelve base ni al nombrarla
        fsTools:        !!pg.fsToolsOn,   // apagado: el backend no resuelve carpeta ni al nombrarla
        // 'data': el agente construye una UI poblada con datos reales (run_select), sin
        // el formato de cajas ASCII del Visor. Depende del TIPO de agente (produce UI),
        // NO de si ya hay base conectada: así el PRIMER mensaje que nombra la base —el
        // que establece la conexión— también evita el conflicto de cajas. Inocuo cuando
        // no hay base (el backend solo lo usa si resuelve un esquema).
        dbMode:         (usesDesignSystem || pg.canvasMode) ? 'data' : '',
        model:          pg.model || ''
    };

    let stream = null, received = '', meta = {}, firstToken = false, streamErr = null;
    let thinkChars = 0;   // razonamiento acumulado (modelos thinking) antes del 1er token

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
                } else if (ev === 'thinking') {
                    // Llega ANTES de cualquier chunk, mientras el indicador sigue visible.
                    // Dos formas: etiqueta de tool-calling COMPLETA ("[consultando SELECT …]",
                    // "[leyendo archivo]") o razonamiento de modelos thinking que streamea en
                    // fragmentos sueltos ("lo", " que"…) — esos NO se pintan tal cual: se
                    // acumulan y se muestra el progreso, como hace el Visor.
                    if (!firstToken) {
                        const t = obj.t || '';
                        if (/\[[^\]]*\]/.test(t)) {
                            pgTypingStatus($typing, t);
                        } else {
                            thinkChars += t.length;
                            pgTypingStatus($typing, 'Razonando… ≈ ' + Math.max(1, Math.round(thinkChars / 4)) + ' tokens');
                        }
                    }
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
    if (!firstToken) {
        $typing.remove();
        // Respuesta vacía: antes de culpar al modelo, revisar si el usuario nombró
        // una carpeta/base con las tools correspondientes APAGADAS. En ese caso el
        // backend no resuelve nada al nombrarla y el agente se queda sin qué leer.
        const needFs = !pg.fsToolsOn && pgTextMentionsPath(text);
        const needDb = !pg.dbToolsOn && pgTextMentionsDb(text);
        if (needFs || needDb) {
            const que = needFs && needDb ? 'esa carpeta ni esa base de datos'
                      : needFs           ? 'esa carpeta'
                      :                    'esa base de datos';
            const cual = needFs && needDb ? '**Tools de archivos** y **Tools de base de datos**'
                       : needFs           ? '**Tools de archivos**'
                       :                    '**Tools de base de datos**';
            pgAppendAI('📁 No pude leer ' + que + ' porque las ' + cual + ' están apagadas. '
                + 'Enciéndelas en el menú **«Tools»** (abajo, junto a «Limpiar») y vuelve a enviar tu mensaje.');
        } else {
            pgAppendAI('⚠️ El agente no devolvió respuesta. El modelo actual puede no soportar esta tarea (minimax suele quedarse vacío en respuestas largas). Prueba con **glm-5.2** para código, o **kimi-k2.7-code** si necesitas visión.');
        }
        pgFinish(); return;
    }

    await stream.drain();
    // Conexión pegajosa: si el backend resolvió una base (la nombrada en el mensaje o
    // la reenviada en dbConnect), la recordamos para los siguientes turnos.
    if (meta && meta.db) pgSetActiveDb(meta.db);
    // Igual para la carpeta local conectada (list_dir/read_file/grep_files).
    if (meta && meta.fs) pgSetActiveFolder(meta.fs);
    // El backend avisa cuando el tool-calling no funcionó (modelo sin tools o que
    // no consultó): toast inmediato + chip persistente en el pie del mensaje.
    if (meta && meta.tools_fallback) pgToast('⚠ ' + meta.tools_fallback, 'warn');
    pg.history.push({ role: 'assistant', content: received });
    pgFinalizeResponse(stream, received, {
        credits:          meta.credits_estimate,
        cost:             meta.cost_usd,            // costo real USD (OpenRouter) o null (Ollama)
        promptTokens:     meta.prompt_tokens,
        completionTokens: meta.completion_tokens,
        elapsed_ms:       meta.elapsed_ms,
        toolsFallback:    meta.tools_fallback || null
    }, false);
    pgPlayPopSound();
    pgAutoSaveThread();
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
    const hadCode = /```[a-z0-9+-]*[ \t]*\r?\n?[\s\S]*?```/i.test(received) || pgLooksLikeHtml(received);
    if (usesUI && hadCode) {
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
    // Solo se vuelca al sandbox si la respuesta trajo codigo: una respuesta en
    // prosa (p.ej. el plan del modo planeacion) no debe pisar el render actual.
    if (usesUI && hadCode) {
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
    pgAutoSaveThread();
    pgToast(reason ? ('Respuesta cortada: ' + reason) : 'La respuesta se cortó antes de terminar', 'warn');
    return true;
}

function pgFinish() {
    pgStopTyping();
    pgSetBusy(false);
    pg._abort = null;
    pgScroll();
    pgSaveSession();   // autoguarda la sesión para poder retomarla al recargar
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

/* Ajuste incremental sobre el template ya renderizado: al pedir "agrégale eventos"
 * el modelo suele contestar SOLO con el <script>/CSS del cambio, sin repetir el
 * markup. Sin esto pgExtractHtml devolvía vacío y el render se reemplazaba por el
 * texto en markdown: el template desaparecía y el ajuste se perdía. */
function pgPatchLastHtml(received) {
    if (!pg.lastHtml) return '';
    // Un parche sustituye al anterior: si se acumularan, cada ajuste volvería a
    // enganchar los mismos listeners sobre el template.
    const base    = pg.lastHtml.replace(/\n?<(script|style) data-pg-merged>[\s\S]*?<\/\1>/gi, '');
    const patched = pgMergeSideBlocks(received, base);
    return patched === base ? '' : patched;
}

/* ── Render al sandbox ── */
function pgRenderToSandbox(received) {
    const cfg = PG_AGENTS[pg.agentKey] || { render: 'markdown' };

    if (cfg.render === 'html') {
        const html = pgExtractHtml(received)    // tolerante: fence o crudo
                  || pgPatchLastHtml(received); // ...o solo el script del ajuste
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
    const pinned = tpl.id === pg.pinnedTplId;
    const $card = $(`
        <div class="pg-chat-tpl${tpl.id === pg._activeTplId ? ' is-active' : ''}" data-tpl-id="${tpl.id}" title="Clic para ver en el sandbox">
            <div class="pg-chat-tpl-thumb">
                <iframe class="pg-chat-tpl-frame" sandbox="allow-scripts" scrolling="no" tabindex="-1" aria-hidden="true"></iframe>
                <button type="button" class="pg-chat-tpl-thread" title="Abrir un hilo nuevo heredando este sandbox como contexto"><i data-lucide="git-branch" class="w-3.5 h-3.5"></i></button>
            </div>
            <div class="pg-chat-tpl-info">
                <span class="pg-chat-tpl-title">${pgEscape(tpl.title)}</span>
                <span class="pg-chat-tpl-sub">${pgEscape(tpl.themeLabel)}</span>
                <span class="pg-chat-tpl-actions">
                    <button type="button" class="pg-tpl-ico pg-chat-tpl-view" title="Ver en el sandbox"><i data-lucide="eye" class="w-3.5 h-3.5"></i></button>
                    <button type="button" class="pg-tpl-ico pg-chat-tpl-pin${pinned ? ' is-pinned' : ''}" title="${pinned ? 'Fijado como referencia' : 'Fijar este template como referencia: el próximo mensaje pedirá modificarlo'}"><i data-lucide="pin" class="w-3.5 h-3.5"></i></button>
                    <button type="button" class="pg-tpl-ico pg-chat-tpl-fork" title="Bifurcar: abrir un hilo nuevo heredando este sandbox como contexto"><i data-lucide="git-branch" class="w-3.5 h-3.5"></i></button>
                    <button type="button" class="pg-tpl-ico pg-chat-tpl-newchat" title="Clonar a un chat nuevo con contexto LIMPIO (sin historial); queda fijada para modificarla"><i data-lucide="message-square-plus" class="w-3.5 h-3.5"></i></button>
                    <button type="button" class="pg-tpl-ico pg-chat-tpl-del" title="Quitar este render del chat"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                </span>
            </div>
        </div>`);
    $msg.append($card);
    const fr = $card.find('.pg-chat-tpl-frame')[0];
    if (fr) fr.srcdoc = pgWrapHtml(tpl.html, tpl.theme, tpl.isDoc);
    $card.on('click', () => pgRestoreTemplate(tpl.id));
    $card.find('.pg-chat-tpl-view').on('click', e => { e.stopPropagation(); pgRestoreTemplate(tpl.id); });
    $card.find('.pg-chat-tpl-pin').on('click', e => { e.stopPropagation(); pgTogglePinTemplate(tpl.id); });
    $card.find('.pg-chat-tpl-thread, .pg-chat-tpl-fork').on('click', e => { e.stopPropagation(); pgForkFromTemplate(tpl.id); });
    $card.find('.pg-chat-tpl-newchat').on('click', e => { e.stopPropagation(); pgCloneToCleanChat(tpl.id); });
    $card.find('.pg-chat-tpl-del').on('click', e => { e.stopPropagation(); pgDeleteTemplate(tpl.id); });
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
    pgSaveSession();
    pgToast('Template cargado en el sandbox', 'success');
}

/* ── Quitar un render del chat ──
 * Elimina la tarjeta-miniatura y su registro de la sesión (pg.templates), y lo
 * persiste (sesión + hilo). No toca el sandbox: si el template estaba visible
 * ahí, el render queda como "último render" pero ya no es restaurable desde el
 * chat. Si estaba fijado como referencia, se libera el pin. */
function pgDeleteTemplate(id) {
    const idx = pg.templates.findIndex(x => x.id === id);
    if (idx === -1) return;
    pg.templates.splice(idx, 1);
    if (pg.pinnedTplId === id) { pg.pinnedTplId = null; pgRefreshPinUI(); }
    if (pg._activeTplId === id) pg._activeTplId = null;
    $(`.pg-chat-tpl[data-tpl-id="${id}"]`).remove();
    pgSaveSession();
    pgAutoSaveThread();
    pgToast('Render quitado del chat', 'info');
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

/* ── Clonar a un chat nuevo con contexto LIMPIO ──
 * Abre un chat NUEVO y VACÍO (no hereda NADA de la conversación) partiendo solo de
 * este sandbox: lo renderiza, lo registra como template del hilo nuevo y lo FIJA
 * como referencia, de modo que el próximo mensaje lo modifique sin arrastrar el
 * historial viejo. Es "me gustó esto, empiezo de cero sobre ello".
 * A diferencia de "Bifurcar" (que hereda el historial hasta el template), aquí el
 * ÚNICO contexto que viaja al agente es el HTML fijado. El chat actual no se pierde:
 * ya se autoguardó como hilo y se reabre desde el modal de hilos. */
function pgCloneToCleanChat(id) {
    if (pg.isBusy) { pgToast('Espera a que termine la generación en curso', 'warn'); return; }
    const t = pg.templates.find(x => x.id === id);
    if (!t) return;

    // Restaurar el tema con el que se generó el sandbox.
    if (t.theme && PG_THEMES[t.theme] && t.theme !== pg.theme) {
        pg.theme = t.theme;
        $('#pgThemeSelect').val(t.theme);
        $('#pgSandboxTheme').text((PG_THEMES[t.theme] || {}).label || t.theme);
        pgSaveSettings();
    }
    // Restaurar agente si difiere (keepHistory=true: aún no hay historial que perder).
    if (t.agentKey && PG_AGENTS[t.agentKey] && t.agentKey !== pg.agentKey) {
        $('#pgAgentSelect').val(t.agentKey);
        pgApplyAgent(t.agentKey, true);
    }

    // Chat nuevo y VACÍO: sin heredar historial (a diferencia de Bifurcar).
    pgClearChat();
    pg._lastUserText = t.title || '';

    // Pinta el sandbox heredado y lo registra como template del hilo nuevo.
    pgRenderSandbox(t.html, !!t.isDoc);
    const tpl = pgPushTemplate(t.html, !!t.isDoc);

    // Burbuja "semilla" (SOLO visual: no entra a pg.history, no viaja al modelo).
    // Deja el punto de partida a la vista con su tarjeta clicable.
    $('#pgChatBody .pg-empty').remove();
    const $seed = $(`<div class="ia-msg ai"><div class="ia-msg-role"><span class="dot"></span><span>${pgAgentLabel()}</span></div><div class="ia-msg-text">${pgMarkdown('🪄 Contexto nuevo — partiendo de esta plantilla. Escribe cómo quieres modificarla.')}</div></div>`);
    $('#pgChatBody').append($seed);
    if (window.lucide) lucide.createIcons();

    if (tpl) {
        tpl.title = t.title || tpl.title;
        // Fijar como referencia ANTES de pintar la tarjeta para que salga con el pin
        // activo; el pin inyecta su HTML como "TEMPLATE A MODIFICAR" en el próximo turno.
        pg.pinnedTplId = tpl.id;
        pgAppendTemplateCard($seed, tpl);
        pgRefreshPinUI();   // marca el botón + muestra el chip "Modificando…" sobre el input
    }

    pgSaveSession();   // el chat limpio pasa a ser la sesión activa
    $('#pgInput').trigger('focus');
    pgToast('Plantilla clonada a un chat limpio — el próximo mensaje la modificará', 'success');
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
        $(this).attr('title', isPinned ? 'Fijado como referencia' : 'Fijar este template como referencia: el próximo mensaje pedirá modificarlo');
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
    // En viewport de dispositivo (móvil/laptop) el fondo "escritorio" lo pinta el
    // CSS; el color del tema solo aplica a ancho completo (iframe llenando todo).
    $('.pg-sandbox-body').css('background', (pg.viewport && pg.viewport !== 'full') ? '' : (t.bg || '#fff'));
    const fr = document.getElementById('pgSandboxFrame');
    fr.onload = () => { pgSyncStageViewport(); pgApplyZoom(); if (pg._inspecting) pgBindInspect(); if (pg._targeting) pgBindTarget(); };   // el scroll lo hace el iframe interno; reaplicamos el zoom al cargar
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

/* ── Inspector de estilos ──
 * La pestaña "Estilos" mantiene el preview visible y, al hacer clic en cualquier
 * elemento (input, card, botón…), muestra su CSS resuelto: color, fondo, borde,
 * tipografía, espaciado y las reglas :hover que le aplican. Como el iframe es
 * srcdoc del mismo origen, leemos su computed style y sus styleSheets directamente. */
function pgInspectDoc() {
    const fr = document.getElementById('pgSandboxFrame');
    try { return fr.contentDocument || (fr.contentWindow && fr.contentWindow.document); } catch (e) { return null; }
}
// Tooltip flotante (position:fixed, fuera del panel para no recortarse) reutilizable.
function pgChipTip() {
    let t = document.getElementById('pgChipTip');
    if (!t) { t = document.createElement('div'); t.id = 'pgChipTip'; t.className = 'pg-chip-tip'; document.body.appendChild(t); }
    return t;
}
function pgEnterInspect() {
    if (pg._targeting) pgExitTarget();   // los modos comparten el iframe: excluyentes
    pg._inspecting = true;
    // El inspector lee el documento del iframe: requiere same-origin. Se relaja
    // el sandbox y el preview recarga; su onload llama a pgBindInspect de nuevo.
    pgSetFrameSandbox(false);
    $('.pg-sandbox-body').addClass('is-inspecting');
    $('#pgStylesPanel').attr('aria-hidden', 'false');
    pgBindInspect();
    if (window.lucide) lucide.createIcons();
}
function pgExitInspect() {
    pg._inspecting = false;
    $('.pg-sandbox-body').removeClass('is-inspecting');
    $('#pgStylesPanel').attr('aria-hidden', 'true');
    pgUnbindInspect();
    if (!pg._targeting) pgSetFrameSandbox(true);   // fuera del inspector, el preview vuelve aislado
}

/* ── Componente objetivo (apuntar y anclar) ──
 * Modo "apuntar": clic en un elemento del preview y ese fragmento queda ANCLADO
 * al chat como objetivo del próximo mensaje — el agente modifica únicamente ese
 * componente del template vigente y devuelve el template completo actualizado.
 * Reutiliza el resaltado del inspector y, como él, requiere same-origin (se
 * relaja el sandbox del iframe mientras el modo está activo). */
function pgEnterTarget() {
    if (!pg.lastHtml || pg._lastIsDoc) { pgToast('Primero renderiza un componente en el sandbox', 'warn'); return; }
    if (pg._inspecting) $('.pg-tab[data-sbtab="preview"]').trigger('click');   // los modos son excluyentes
    pg._targeting = true;
    $('#pgTargetBtn').addClass('is-on');
    $('.pg-sandbox-body').addClass('is-inspecting');
    pgSetFrameSandbox(false);
    pgBindTarget();
    pgToast('Haz clic en el componente del preview que quieres editar', 'info');
}
function pgExitTarget() {
    pg._targeting = false;
    $('#pgTargetBtn').removeClass('is-on');
    if (!pg._inspecting) {
        $('.pg-sandbox-body').removeClass('is-inspecting');
        pgSetFrameSandbox(true);
    }
    pgUnbindTarget();
}
function pgBindTarget() {
    const doc = pgInspectDoc();
    if (!doc || !doc.body) return;
    pgUnbindTarget(doc);
    if (!doc.getElementById('pgInspectStyle')) {
        const st = doc.createElement('style');
        st.id = 'pgInspectStyle';
        st.textContent = '.pg-ins-hover{outline:2px solid #C05A40!important;outline-offset:-2px;cursor:crosshair!important;}'
                       + '.pg-ins-sel{outline:2px solid #E8A68F!important;outline-offset:-2px;}';
        doc.head.appendChild(st);
    }
    doc.addEventListener('mousedown', pgInsDown, true);
    doc.addEventListener('mouseover', pgInsOver, true);
    doc.addEventListener('mouseout', pgInsOut, true);
    doc.addEventListener('click', pgTargetClick, true);
    pg._tgtDoc = doc;
}
function pgUnbindTarget(passedDoc) {
    const doc = passedDoc || pg._tgtDoc;
    if (!doc) return;
    try {
        doc.removeEventListener('mousedown', pgInsDown, true);
        doc.removeEventListener('mouseover', pgInsOver, true);
        doc.removeEventListener('mouseout', pgInsOut, true);
        doc.removeEventListener('click', pgTargetClick, true);
        doc.querySelectorAll('.pg-ins-hover, .pg-ins-sel').forEach(el => el.classList.remove('pg-ins-hover', 'pg-ins-sel'));
    } catch (e) {}
    if (!passedDoc) pg._tgtDoc = null;
}
function pgTargetClick(e) {
    e.preventDefault(); e.stopPropagation();
    const el = e.target;
    if (!el || !el.tagName) return;
    const doc = pg._tgtDoc;
    // El body y el escenario del wrap no son componentes: sería anclar todo el template.
    if (el === doc.body || el.classList.contains('pg-stage')) {
        pgToast('Eso es el lienzo completo — apunta a un componente concreto', 'warn');
        return;
    }
    pg.targetFrag = { html: pgTargetFragHtml(el), label: pgElLabel(el) };
    pgExitTarget();
    pgRenderTargetBanner();
    pgToast('Componente anclado — describe el cambio y envía', 'success');
    $('#pgInput').trigger('focus');
}
// Etiqueta legible del elemento (tag#id.clase.clase) para el chip y la nota.
function pgElLabel(el) {
    const cls = Array.from(el.classList || []).filter(c => !/^pg-ins-/.test(c)).slice(0, 2);
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls.length ? '.' + cls.join('.') : '');
}
// outerHTML del fragmento SIN las clases del resaltado, con tope de tamaño.
// maxLen=0 desactiva el truncado (p.ej. al copiar el contenedor completo).
function pgTargetFragHtml(el, maxLen) {
    const cap   = (maxLen === undefined) ? 8000 : maxLen;
    const clone = el.cloneNode(true);
    [clone, ...clone.querySelectorAll('.pg-ins-hover, .pg-ins-sel')].forEach(n => {
        if (!n.classList) return;
        n.classList.remove('pg-ins-hover', 'pg-ins-sel');
        if (!n.classList.length) n.removeAttribute('class');
    });
    let html = clone.outerHTML || '';
    if (cap && html.length > cap) html = html.slice(0, cap) + '\n<!-- fragmento truncado -->';
    return html;
}
/* Chip "Editando componente: <label> ✕" encima del input, hermano del banner
 * del pin. Visible solo mientras hay un fragmento anclado (se libera al enviar). */
function pgRenderTargetBanner() {
    $('#pgTargetBanner').remove();
    if (!pg.targetFrag) return;
    const $banner = $(`
        <div id="pgTargetBanner" class="pg-pin-banner" title="El próximo mensaje editará únicamente este componente">
            <i data-lucide="mouse-pointer-click" class="w-3.5 h-3.5"></i>
            <span class="pg-pin-banner-text">Editando componente: <strong>${pgEscape(pg.targetFrag.label)}</strong></span>
            <button type="button" class="pg-pin-banner-x" title="Soltar componente"><i data-lucide="x" class="w-3 h-3"></i></button>
        </div>`);
    const $wrap = $('.ia-input-wrap');
    if ($wrap.length) $wrap.prepend($banner); else $('#pgInput').before($banner);
    $banner.find('.pg-pin-banner-x').on('click', () => { pg.targetFrag = null; pgRenderTargetBanner(); });
    if (window.lucide) lucide.createIcons();
}
// Nota dentro de la burbuja del usuario: ese mensaje editó solo un componente.
function pgAppendTargetNote($msg, frag) {
    if (!$msg || !$msg.length || !frag) return;
    $msg.find('.ia-msg-text').append(
        `<div class="ia-msg-pinref" title="Este mensaje editó únicamente el componente seleccionado">`
        + `<i data-lucide="mouse-pointer-click" class="w-3 h-3"></i><span>solo: ${pgEscape(frag.label)}</span></div>`
    );
    if (window.lucide) lucide.createIcons();
}
function pgBindInspect() {
    const doc = pgInspectDoc();
    if (!doc || !doc.body) return;
    pgUnbindInspect(doc);   // idempotente: evita listeners duplicados al recargar
    if (!doc.getElementById('pgInspectStyle')) {
        const st = doc.createElement('style');
        st.id = 'pgInspectStyle';
        st.textContent = '.pg-ins-hover{outline:2px solid #C05A40!important;outline-offset:-2px;cursor:crosshair!important;}'
                       + '.pg-ins-sel{outline:2px solid #E8A68F!important;outline-offset:-2px;}';
        doc.head.appendChild(st);
    }
    doc.addEventListener('mousedown', pgInsDown, true);
    doc.addEventListener('mouseover', pgInsOver, true);
    doc.addEventListener('mouseout', pgInsOut, true);
    doc.addEventListener('click', pgInsClick, true);
    pg._insDoc = doc;
}
function pgUnbindInspect(passedDoc) {
    const doc = passedDoc || pg._insDoc;
    if (!doc) return;
    try {
        doc.removeEventListener('mousedown', pgInsDown, true);
        doc.removeEventListener('mouseover', pgInsOver, true);
        doc.removeEventListener('mouseout', pgInsOut, true);
        doc.removeEventListener('click', pgInsClick, true);
        doc.querySelectorAll('.pg-ins-hover, .pg-ins-sel').forEach(el => el.classList.remove('pg-ins-hover', 'pg-ins-sel'));
    } catch (e) {}
    if (!passedDoc) pg._insDoc = null;
}
// Evita que el elemento tome foco al inspeccionarlo (el foco cambiaría su estilo
// computado: leeríamos el borde/color de :focus en vez del estado real).
function pgInsDown(e) { e.preventDefault(); }
function pgInsOver(e) { if (e.target && e.target.classList && e.target !== e.currentTarget.body) e.target.classList.add('pg-ins-hover'); }
function pgInsOut(e)  { if (e.target && e.target.classList) e.target.classList.remove('pg-ins-hover'); }
function pgInsClick(e) {
    e.preventDefault(); e.stopPropagation();
    pgInsSelectEl(e.target);
}
// Marca visualmente un elemento como seleccionado en el doc inspeccionado y
// refresca el panel de estilos. Punto único de selección (clic o navegar al padre).
function pgInsSelectEl(el) {
    if (!el || !el.tagName) return;
    const doc = pg._insDoc || el.ownerDocument;
    if (doc) doc.querySelectorAll('.pg-ins-sel').forEach(n => n.classList.remove('pg-ins-sel'));
    el.classList.remove('pg-ins-hover');
    el.classList.add('pg-ins-sel');
    pgRenderStyles(el);
}
// Sube al contenedor padre del elemento seleccionado (sin pasar de <body>).
function pgInsSelectParent() {
    const el = pg._styleEl;
    if (!el) { pgToast('Selecciona un elemento primero', 'warn'); return; }
    const doc = pg._insDoc || el.ownerDocument;
    const parent = el.parentElement;
    if (!parent || parent === (doc && doc.body) || parent.tagName === 'BODY' || parent.tagName === 'HTML') {
        pgToast('Ya estás en el contenedor raíz', 'warn'); return;
    }
    pgInsSelectEl(parent);
}

// ¿El valor parece un color (para pintar el swatch junto a la propiedad)?
function pgIsColor(v) { return /^(#|rgb|hsl)/i.test(String(v).trim()); }
function pgSwatch(v) { return pgIsColor(v) ? `<span class="pg-sty-swatch" style="background:${pgEscape(v)}"></span>` : ''; }

// rgb()/rgba() → #HEX legible (o rgba si tiene transparencia; 'transparent' si alpha 0).
function pgToHex(r, g, b) {
    const h = n => ('0' + Math.max(0, Math.min(255, n | 0)).toString(16)).slice(-2);
    return ('#' + h(r) + h(g) + h(b)).toUpperCase();
}
function pgFmtColor(v) {
    if (!v) return '';
    v = String(v).trim();
    const m = v.match(/^rgba?\(([^)]+)\)/i);
    if (!m) return v;
    const p = m[1].split(',').map(s => s.trim());
    const a = p[3] !== undefined ? parseFloat(p[3]) : 1;
    if (a === 0) return 'transparent';
    if (a < 1)  return `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${a})`;
    return pgToHex(+p[0], +p[1], +p[2]);
}
function pgIsTransparent(v) {
    if (!v) return true;
    if (/transparent/i.test(v)) return true;
    const m = String(v).match(/^rgba?\(([^)]+)\)/i);
    if (m) { const p = m[1].split(','); return p[3] !== undefined && parseFloat(p[3]) === 0; }
    return false;
}

// Una propiedad agrupada de 4 lados (padding/margin/border-width) → valor compacto.
function pgBoxVal(cs, prop) {
    const t = cs.getPropertyValue(prop + '-top'), r = cs.getPropertyValue(prop + '-right'),
          b = cs.getPropertyValue(prop + '-bottom'), l = cs.getPropertyValue(prop + '-left');
    return (t === r && r === b && b === l) ? t : `${t} ${r} ${b} ${l}`;
}

// Fila etiqueta→valor (etiqueta legible en español; el valor se copia al clic).
function pgStyRow(label, val) {
    if (val === '' || val == null) return '';
    return `<div class="pg-sty-row" data-copy="${pgEscape(val)}" title="Clic para copiar">`
         + `<span class="pg-sty-key">${label}</span>`
         + `<span class="pg-sty-val">${pgSwatch(val)}${pgEscape(val)}</span></div>`;
}
// Fila de color destacada: swatch grande + nombre + valor en HEX.
function pgColorRow(label, val) {
    if (!val) return '';
    const sw = val === 'transparent'
        ? `<span class="pg-sty-swatch-lg pg-sty-swatch-transp"></span>`
        : `<span class="pg-sty-swatch-lg" style="background:${pgEscape(val)}"></span>`;
    return `<div class="pg-sty-color-row" data-copy="${pgEscape(val)}" title="Clic para copiar">${sw}`
         + `<div class="pg-sty-color-meta"><span class="pg-sty-color-label">${label}</span>`
         + `<span class="pg-sty-color-val">${pgEscape(val)}</span></div></div>`;
}
function pgStySec(title, icon, rows) {
    const body = rows.filter(Boolean).join('');
    return body
        ? `<div class="pg-sty-sec"><div class="pg-sty-sec-title"><i data-lucide="${icon}"></i> ${title}</div>${body}</div>`
        : '';
}

/* ── Clasificación de clases utilitarias (Tailwind) ──
 * Agrupa las clases por categoría (Color, Texto, Espaciado, Layout, Efectos,
 * Estado, Otros) y genera una descripción legible para el tooltip de cada chip. */
const PG_SP = { 0: '0', 0.5: '2px', 1: '4px', 1.5: '6px', 2: '8px', 2.5: '10px', 3: '12px', 3.5: '14px',
    4: '16px', 5: '20px', 6: '24px', 7: '28px', 8: '32px', 9: '36px', 10: '40px', 11: '44px', 12: '48px',
    14: '56px', 16: '64px', 20: '80px', 24: '96px', 28: '112px', 32: '128px' };
function pgSpacePx(n) { const v = PG_SP[n]; return v !== undefined && v !== '0' ? ` (${v})` : ''; }
function pgSizeLabel(v, arbVal) {
    if (v === 'full') return '100%';
    if (v === 'screen') return '100vw/vh';
    if (v === 'auto') return 'automático';
    if (v === 'min' || v === 'max' || v === 'fit') return v + '-content';
    if (/^\[/.test(v)) return arbVal || v;
    const fr = v.match(/^(\d+)\/(\d+)$/);
    if (fr) return Math.round(100 * (+fr[1] / +fr[2])) + '%';
    const n = parseFloat(v);
    if (!isNaN(n)) { const px = PG_SP[n]; return px !== undefined ? px : (n * 0.25) + 'rem'; }
    return v;
}
function pgVariantLabel(v) {
    const map = { hover: 'hover (mouse encima)', focus: 'focus (enfocado)', 'focus-within': 'focus interno',
        'focus-visible': 'focus visible', active: 'active (presionado)', disabled: 'deshabilitado',
        checked: 'marcado', visited: 'visitado', 'group-hover': 'hover del grupo', 'group-focus': 'focus del grupo',
        dark: 'modo oscuro', sm: '≥640px', md: '≥768px', lg: '≥1024px', xl: '≥1280px', '2xl': '≥1536px' };
    return v.split(':').map(x => map[x] || x).join(' · ');
}
function pgBaseMeta(b) {
    const C = (cat, desc) => ({ cat, desc });
    const arb = b.match(/\[(.+)\]$/); const arbVal = arb ? arb[1] : '';

    // Texto: tamaño / alineación / fuente (antes que color, por text-*)
    if (/^text-(xs|sm|base|lg|xl|\d?xl)$/.test(b)) return C('text', `Tamaño de texto (${b.slice(5)})`);
    if (/^text-\[/.test(b)) return C('text', `Tamaño de texto (${arbVal})`);
    if (/^text-(left|center|right|justify|start|end)$/.test(b)) return C('text', `Alineación del texto (${b.slice(5)})`);
    if (/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/.test(b)) return C('text', `Grosor de fuente (${b.slice(5)})`);
    if (/^font-(sans|serif|mono)$/.test(b)) return C('text', `Familia tipográfica (${b.slice(5)})`);
    if (/^leading-/.test(b)) return C('text', `Interlineado (${b.slice(8)})`);
    if (/^tracking-/.test(b)) return C('text', `Espaciado entre letras (${b.slice(9)})`);
    if (/^(uppercase|lowercase|capitalize|normal-case)$/.test(b)) return C('text', 'Mayúsculas/minúsculas');
    if (/^(italic|not-italic)$/.test(b)) return C('text', 'Estilo cursiva');
    if (/^(underline|line-through|no-underline|overline)$/.test(b)) return C('text', 'Decoración del texto');
    if (/^truncate$/.test(b)) return C('text', 'Texto truncado con «…»');
    if (/^whitespace-/.test(b)) return C('text', 'Manejo de espacios en blanco');
    if (/^break-/.test(b)) return C('text', 'Quiebre de palabras/líneas');

    // Color
    if (/^bg-/.test(b)) return C('color', `Color de fondo (${arb ? arbVal : b.slice(3)})`);
    if (/^text-/.test(b)) return C('color', `Color de texto (${arb ? arbVal : b.slice(5)})`);
    if (/^border-(\[|[a-z]+-\d|white$|black$|transparent$|current$|inherit$)/.test(b)) return C('color', `Color del borde (${arb ? arbVal : b.slice(7)})`);
    if (/^(from|via|to)-/.test(b)) return C('color', 'Parada de degradado');
    if (/^(ring|divide|placeholder|caret|accent|fill|stroke|decoration)-(\[|[a-z]+-\d|white|black)/.test(b)) return C('color', 'Color (anillo/relleno/etc.)');

    // Espaciado
    const sp = b.match(/^(-?)(p|m)([xytrbl]?)-(.+)$/);
    if (sp) {
        const kind = sp[2] === 'p' ? 'Padding' : 'Margen';
        const side = { '': '', x: ' horizontal', y: ' vertical', t: ' superior', r: ' derecho', b: ' inferior', l: ' izquierdo' }[sp[3]];
        const val = arb ? arbVal : sp[1] + sp[4] + pgSpacePx(parseFloat(sp[4]));
        return C('space', `${kind}${side}: ${val}`);
    }
    if (/^gap(-[xy])?-/.test(b)) return C('space', 'Separación (gap) entre celdas');
    if (/^space-[xy]-/.test(b)) return C('space', 'Separación entre elementos hijos');

    // Layout / caja
    if (/^w-/.test(b)) return C('layout', `Ancho: ${pgSizeLabel(b.slice(2), arbVal)}`);
    if (/^h-/.test(b)) return C('layout', `Alto: ${pgSizeLabel(b.slice(2), arbVal)}`);
    if (/^(min-w|max-w|min-h|max-h)-/.test(b)) return C('layout', 'Tamaño mínimo/máximo');
    if (/^(flex|inline-flex|grid|inline-grid|block|inline-block|inline|hidden|table|contents|flow-root)$/.test(b)) return C('layout', `Display: ${b}`);
    if (/^(items|justify|content|self|place)-/.test(b)) return C('layout', `Alineación (${b})`);
    if (/^(flex|grid|col|row|order|basis|grow|shrink)-?/.test(b)) return C('layout', `Flujo flex/grid (${b})`);
    if (/^rounded/.test(b)) return C('layout', `Esquinas redondeadas (${b.replace(/^rounded-?/, '') || 'base'})`);
    if (/^border$/.test(b)) return C('layout', 'Borde de 1px');
    if (/^border-(\d+|x|y|t|r|b|l)(-\d+)?$/.test(b)) return C('layout', `Grosor/lado del borde (${b.slice(7)})`);
    if (/^(absolute|relative|fixed|sticky|static)$/.test(b)) return C('layout', `Posición: ${b}`);
    if (/^(top|right|bottom|left|inset)-/.test(b)) return C('layout', 'Posición (desplazamiento)');
    if (/^z-/.test(b)) return C('layout', `Capa z-index (${b.slice(2)})`);
    if (/^overflow-/.test(b)) return C('layout', `Desbordamiento (${b.slice(9)})`);
    if (/^(object|aspect)-/.test(b)) return C('layout', 'Ajuste de contenido');
    if (/^appearance-none$/.test(b)) return C('layout', 'Quita la apariencia nativa del control');
    if (/^container$/.test(b)) return C('layout', 'Contenedor responsive');

    // Efectos
    if (/^shadow/.test(b)) return C('fx', `Sombra (${b.replace(/^shadow-?/, '') || 'base'})`);
    if (/^opacity-/.test(b)) return C('fx', `Opacidad ${b.slice(8)}%`);
    if (/^(transition|duration|delay|ease)/.test(b)) return C('fx', 'Transición / temporización');
    if (/^animate-/.test(b)) return C('fx', `Animación (${b.slice(8)})`);
    if (/^(transform|scale|rotate|translate|skew|origin)-?/.test(b)) return C('fx', 'Transformación');
    if (/^cursor-/.test(b)) return C('fx', `Cursor (${b.slice(7)})`);
    if (/^ring(-|$)/.test(b)) return C('fx', 'Anillo de enfoque (ring)');
    if (/^outline/.test(b)) return C('fx', 'Contorno (outline)');
    if (/^(blur|brightness|contrast|grayscale|backdrop)/.test(b)) return C('fx', 'Filtro visual');

    return C('other', /^cs-/.test(b) ? 'Clase del sistema CoffeeSoft' : 'Clase sin descripción');
}
function pgClassMeta(raw) {
    const parts = raw.split(':');
    const base = parts.pop();
    const variants = parts;
    const meta = pgBaseMeta(base);
    let cat = meta.cat, desc = meta.desc;
    if (variants.length) {
        const isState = variants.some(v => /^(hover|focus|focus-within|focus-visible|active|disabled|checked|visited|target)$/.test(v) || /^(group|peer)(-|$)/.test(v));
        if (isState) cat = 'state';
        desc = `En ${pgVariantLabel(variants.join(':'))}: ` + desc.charAt(0).toLowerCase() + desc.slice(1);
    }
    return { cat, desc };
}
// Construye los chips de clases agrupados por categoría (con data-desc para tooltip).
function pgClassChips(clsArr) {
    if (!clsArr.length) return '';
    const cats = { color: [], text: [], space: [], layout: [], fx: [], state: [], other: [] };
    clsArr.forEach(c => { const m = pgClassMeta(c); cats[m.cat].push({ cls: c, desc: m.desc }); });
    const order = [['color', 'Color'], ['text', 'Texto'], ['space', 'Espaciado'], ['layout', 'Layout'], ['fx', 'Efectos'], ['state', 'Estado'], ['other', 'Otros']];
    let html = '';
    order.forEach(([key, label]) => {
        if (!cats[key].length) return;
        html += `<div class="pg-sty-cls-group cat-${key}"><span class="pg-sty-cls-cat">${label}</span><div class="pg-sty-cls-chips">`
            + cats[key].map(o => `<span class="pg-sty-chip" data-copy="${pgEscape(o.cls)}" data-desc="${pgEscape(o.desc)}" title="${pgEscape(o.desc)}">${pgEscape(o.cls)}</span>`).join('')
            + `</div></div>`;
    });
    return `<div class="pg-sty-classes">${html}</div>`;
}

function pgRenderStyles(el) {
    const win = el.ownerDocument.defaultView;
    const r   = el.getBoundingClientRect();
    const disp = win.getComputedStyle(el).display;

    // El estilo se mide sobre un clon FUERA DE PANTALLA: así getComputedStyle
    // devuelve el estado BASE (sin :hover ni :focus). De lo contrario, si el
    // elemento estaba enfocado/bajo el cursor, mostraría el borde/color del hover.
    const probe = pgBaseProbe(el);
    const cs    = probe.cs;

    const tag    = el.tagName.toLowerCase();
    const id     = el.id ? '#' + el.id : '';
    const selName = tag + id;
    const clsArr = (el.getAttribute('class') || '').split(/\s+/).filter(c => c && !/^pg-ins-/.test(c));

    const hasBorder = ['Top', 'Right', 'Bottom', 'Left'].some(s => parseFloat(cs['border' + s + 'Width']) > 0);
    const hover = pgHoverDecls(el);

    // Config copiable: snippet CSS (con su :hover) y las clases Tailwind tal cual.
    pg._styleSnippet = pgBuildSnippet(selName || tag, cs, hasBorder, hover);
    pg._styleClasses = clsArr.join(' ');
    pg._styleEl      = el;

    const kidCount = el.querySelectorAll('*').length;
    const canUp = el.parentElement && el.parentElement.tagName !== 'BODY' && el.parentElement.tagName !== 'HTML';
    const head = `<div class="pg-sty-head">`
        + `<div class="pg-sty-tagrow">`
        +   `<div class="pg-sty-tag">&lt;${tag}${id}&gt;</div>`
        +   (canUp ? `<button id="pgStyParent" class="pg-sty-parent" title="Seleccionar el contenedor padre"><i data-lucide="corner-left-up" class="w-3.5 h-3.5"></i> padre</button>` : '')
        + `</div>`
        + `<div class="pg-sty-dims">${Math.round(r.width)} × ${Math.round(r.height)} px · ${disp}${kidCount ? ` · ${kidCount} ${kidCount === 1 ? 'hijo' : 'hijos'}` : ''}</div>`
        + `<div class="pg-sty-actions">`
        +   `<button id="pgStyCopyBtn" class="pg-sty-copy" title="Copiar el CSS resuelto del elemento"><i data-lucide="clipboard-copy" class="w-3.5 h-3.5"></i> Copiar CSS</button>`
        +   `<button id="pgStyCopyCls" class="pg-sty-copy pg-sty-copy-alt" title="Copiar las clases Tailwind del elemento"><i data-lucide="code-2" class="w-3.5 h-3.5"></i> Copiar clases</button>`
        +   `<button id="pgStyCopyHtml" class="pg-sty-copy pg-sty-copy-prompt" title="Copiar la estructura HTML con un prompt para recrearla"><i data-lucide="wand-2" class="w-3.5 h-3.5"></i> Copiar estructura</button>`
        + `</div></div>`;

    const chips = pgClassChips(clsArr);

    // Colores (lo que más se consulta: texto, fondo, borde) con swatch grande.
    const colors = pgStySec('Colores', 'palette', [
        pgColorRow('Texto', pgFmtColor(cs.color)),
        pgColorRow('Fondo', pgIsTransparent(cs.backgroundColor) ? 'transparent' : pgFmtColor(cs.backgroundColor)),
        hasBorder ? pgColorRow('Borde', pgFmtColor(cs.borderTopColor)) : ''
    ]);

    const typo = pgStySec('Tipografía', 'type', [
        pgStyRow('Tamaño', cs.fontSize),
        pgStyRow('Grosor', cs.fontWeight),
        pgStyRow('Interlineado', cs.lineHeight),
        cs.letterSpacing !== 'normal' ? pgStyRow('Espaciado letras', cs.letterSpacing) : '',
        pgStyRow('Alineación', cs.textAlign),
        pgStyRow('Fuente', cs.fontFamily.replace(/"/g, ''))
    ]);

    const box = pgStySec('Caja y espaciado', 'box-select', [
        hasBorder ? pgStyRow('Borde', `${cs.borderTopWidth} ${cs.borderTopStyle} ${pgFmtColor(cs.borderTopColor)}`) : '',
        cs.borderTopLeftRadius !== '0px' ? pgStyRow('Radio', cs.borderRadius) : '',
        pgBoxVal(cs, 'padding') !== '0px' ? pgStyRow('Padding', pgBoxVal(cs, 'padding')) : '',
        pgBoxVal(cs, 'margin')  !== '0px' ? pgStyRow('Margen', pgBoxVal(cs, 'margin')) : '',
        (cs.gap && cs.gap !== 'normal' && cs.gap !== '0px') ? pgStyRow('Separación', cs.gap) : ''
    ]);

    const fx = pgStySec('Efectos', 'sparkles', [
        cs.boxShadow !== 'none' ? pgStyRow('Sombra', cs.boxShadow) : '',
        cs.opacity !== '1' ? pgStyRow('Opacidad', cs.opacity) : '',
        (cs.transition && cs.transition !== 'all 0s ease 0s') ? pgStyRow('Transición', cs.transition) : ''
    ]);

    probe.cleanup();
    $('#pgStylesHint').hide();
    $('#pgStylesContent').html(head + chips + colors + typo + box + fx + pgHoverHtml(hover));
    if (window.lucide) lucide.createIcons();
}

/* Mide el estilo del elemento en su estado BASE (sin :hover ni :focus) usando un
 * clon superficial insertado fuera de pantalla. Devuelve { cs, cleanup }: cs es
 * un CSSStyleDeclaration VIVO del clon, por lo que debe leerse antes de cleanup(). */
function pgBaseProbe(el) {
    const win = el.ownerDocument.defaultView;
    if (!el.parentNode || el === el.ownerDocument.body || el === el.ownerDocument.documentElement) {
        return { cs: win.getComputedStyle(el), cleanup() {} };
    }
    const clone = el.cloneNode(false);
    clone.removeAttribute('id');
    if (clone.classList) clone.classList.remove('pg-ins-hover', 'pg-ins-sel');
    clone.setAttribute('aria-hidden', 'true');
    ['position:absolute', 'left:-99999px', 'top:0', 'pointer-events:none', 'visibility:hidden'].forEach(d => {
        const [p, v] = d.split(':'); clone.style.setProperty(p, v, 'important');
    });
    el.parentNode.insertBefore(clone, el);
    return { cs: win.getComputedStyle(clone), cleanup() { try { clone.remove(); } catch (e) {} } };
}

// Texto CSS listo para pegar con la configuración del elemento y su :hover.
function pgBuildSnippet(sel, cs, hasBorder, hover) {
    const L = [];
    const add = (prop, val) => { if (val && val !== 'none') L.push(`  ${prop}: ${val};`); };
    if (!pgIsTransparent(cs.backgroundColor)) add('background', pgFmtColor(cs.backgroundColor));
    if (cs.backgroundImage !== 'none') add('background-image', cs.backgroundImage);
    add('color', pgFmtColor(cs.color));
    if (hasBorder) add('border', `${cs.borderTopWidth} ${cs.borderTopStyle} ${pgFmtColor(cs.borderTopColor)}`);
    if (cs.borderTopLeftRadius !== '0px') add('border-radius', cs.borderRadius);
    add('font-family', cs.fontFamily);
    add('font-size', cs.fontSize);
    add('font-weight', cs.fontWeight);
    add('line-height', cs.lineHeight);
    if (cs.letterSpacing !== 'normal') add('letter-spacing', cs.letterSpacing);
    add('text-align', cs.textAlign);
    if (pgBoxVal(cs, 'padding') !== '0px') add('padding', pgBoxVal(cs, 'padding'));
    if (pgBoxVal(cs, 'margin')  !== '0px') add('margin', pgBoxVal(cs, 'margin'));
    if (cs.gap && cs.gap !== 'normal' && cs.gap !== '0px') add('gap', cs.gap);
    if (cs.boxShadow !== 'none') add('box-shadow', cs.boxShadow);
    if (cs.opacity !== '1') add('opacity', cs.opacity);
    if (cs.transition && cs.transition !== 'all 0s ease 0s') add('transition', cs.transition);

    let out = `${sel} {\n${L.join('\n')}\n}`;
    hover.forEach(h => {
        const hl = h.decls.map(d => `  ${d.prop}: ${pgIsColor(d.val) ? pgFmtColor(d.val) : d.val};`).join('\n');
        if (hl) out += `\n\n${sel}:hover {\n${hl}\n}`;
    });
    return out;
}
function pgCopyStyleConfig() {
    if (!pg._styleSnippet) { pgToast('Selecciona un elemento primero', 'warn'); return; }
    pgCopyText(pg._styleSnippet, 'Configuración CSS copiada');
}
function pgCopyClasses() {
    if (!pg._styleClasses) { pgToast('Selecciona un elemento primero', 'warn'); return; }
    pgCopyText(pg._styleClasses, 'Clases Tailwind copiadas');
}
// Clasifica lo seleccionado para adaptar el verbo del prompt: un contenedor grande
// es un "módulo", un bloque con estructura interna un "componente", un control de
// formulario "código" y una hoja simple un "elemento".
function pgStructKind(el) {
    const tag  = el.tagName.toLowerCase();
    const kids = el.querySelectorAll('*').length;
    if (['input', 'select', 'textarea', 'button', 'a', 'label'].includes(tag) && kids <= 2) return 'código';
    if (tag === 'form' || tag === 'table' || tag === 'nav' || kids >= 20) return 'módulo';
    if (kids >= 3) return 'componente';
    return 'elemento';
}
// Copia la estructura HTML del elemento seleccionado envuelta en un prompt listo
// para pegar en el chat: "Recrea este <módulo|componente|código|elemento>…".
function pgCopyStructurePrompt() {
    const el = pg._styleEl;
    if (!el) { pgToast('Selecciona un elemento primero', 'warn'); return; }
    const kind = pgStructKind(el);
    const html = pgTargetFragHtml(el, 0);
    const prompt = `Recrea este ${kind} respetando su estructura, clases y estilo visual:\n\n\`\`\`html\n${html}\n\`\`\``;
    pgCopyText(prompt, `Prompt de ${kind} copiado`);
}
// Copia robusta: usa la Clipboard API si está disponible (contexto seguro) y, si
// no (p.ej. http por IP/hostname), cae al método clásico con execCommand.
function pgCopyText(text, okMsg) {
    if (text == null || text === '') { pgToast('Nada que copiar', 'warn'); return; }
    const ok   = () => pgToast(okMsg || 'Copiado', 'success');
    const fail = () => pgCopyFallback(String(text), ok);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(String(text)).then(ok).catch(fail);
    } else {
        fail();
    }
}
function pgCopyFallback(text, done) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed'; ta.style.left = '-9999px'; ta.style.top = '0';
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        ok ? done() : pgToast('No se pudo copiar', 'error');
    } catch (e) { pgToast('No se pudo copiar', 'error'); }
}

/* Reglas :hover de las hojas del iframe que matchean el elemento (Tailwind
 * hover:*, .cs-*:hover, a:hover…). Quita ':hover' del selector y prueba
 * element.matches() contra el resto. Devuelve [{ sel, decls:[{prop,val}] }]. */
function pgHoverDecls(el) {
    const doc  = el.ownerDocument;
    const out  = [];
    const seen = {};
    const walk = (rules) => {
        for (const rule of Array.from(rules || [])) {
            if (rule.cssRules && rule.selectorText === undefined) { walk(rule.cssRules); continue; }   // @media, @supports
            const sel = rule.selectorText;
            if (!sel || sel.indexOf(':hover') === -1) continue;
            sel.split(',').forEach(part => {
                part = part.trim();
                if (part.indexOf(':hover') === -1) return;
                const test = part.replace(/:hover/g, '');
                let ok = false;
                try { ok = el.matches(test); } catch (e) { ok = false; }
                if (!ok || seen[part]) return;
                seen[part] = 1;
                const decls = [];
                for (let i = 0; i < rule.style.length; i++) {
                    const p = rule.style[i];
                    decls.push({ prop: p, val: rule.style.getPropertyValue(p) });
                }
                if (decls.length) out.push({ sel: part, decls });
            });
        }
    };
    for (const sheet of Array.from(doc.styleSheets || [])) {
        let rules; try { rules = sheet.cssRules || sheet.rules; } catch (e) { continue; }   // hoja cross-origin
        walk(rules);
    }
    return out.slice(0, 12);
}
function pgHoverHtml(hover) {
    if (!hover.length) return '';
    const blocks = hover.map(o => {
        const rows = o.decls.map(d => pgStyRow(d.prop, pgIsColor(d.val) ? pgFmtColor(d.val) : d.val)).join('');
        return rows ? `<div class="pg-sty-hover"><div class="pg-sty-hover-sel">${pgEscape(o.sel)}</div>${rows}</div>` : '';
    }).filter(Boolean).join('');
    if (!blocks) return '';
    return `<div class="pg-sty-sec"><div class="pg-sty-sec-title pg-sty-hover-head">`
         + `<i data-lucide="mouse-pointer-2"></i> Al pasar el mouse (:hover)</div>${blocks}</div>`;
}

/* ── Zoom y viewport ──
 * El motor (pgApplyZoom, pgSetZoom, PG_VIEWPORTS, pgApplyViewport, pgSetViewport,
 * pgSyncStageViewport, pgIsFullDoc) vive en pg-core.js, COMPARTIDO con el Forge.
 * Aquí solo va el remate propio de esta página. */

/* Hook de pg-core tras aplicar el viewport: fondo del panel + zoom. */
function pgOnViewportApplied(mode) {
    const $body = $('.pg-sandbox-body');
    if (mode !== 'full') {
        // El fondo "escritorio" del dispositivo lo pinta el CSS; sin inline que lo tape.
        $body.css('background', '');
    } else {
        // A ancho completo el fondo vuelve a ser el del tema activo.
        const t = PG_THEMES[pg.theme] || PG_THEMES[PG_DEFAULT_THEME];
        $body.css('background', t.bg || '#fff');
    }
    pgApplyZoom();   // el iframe recargó/cambió de ancho: reaplica el zoom interno
}

/* ── Sandbox del preview ──
 * El sandbox ejecuta código GENERADO por el agente. El atributo sandbox (sin
 * allow-same-origin) lo aísla en un origen opaco: no puede leer el localStorage
 * del playground ni llamar a los ctrl con las cookies del usuario. El inspector
 * "Estilos" sí necesita leer el documento (same-origin), así que al entrar se
 * relaja el sandbox — contenido que el usuario ya está viendo y decidió
 * inspeccionar — y al salir se restaura. */
const PG_SANDBOX_FLAGS = 'allow-scripts allow-forms allow-modals allow-popups';
function pgSetFrameSandbox(on) {
    const fr = document.getElementById('pgSandboxFrame');
    if (!fr || fr.hasAttribute('sandbox') === !!on) return;
    if (on) fr.setAttribute('sandbox', PG_SANDBOX_FLAGS);
    else fr.removeAttribute('sandbox');
    // El cambio de sandbox aplica en la SIGUIENTE navegación: reasignar el
    // srcdoc recarga el preview (su onload re-aplica zoom/edge/inspector).
    if (fr.getAttribute('srcdoc')) fr.srcdoc = fr.getAttribute('srcdoc');
}

/* Bridge inyectado en el <head> de cada preview: con el iframe sandboxeado el
 * padre no puede tocar el documento, así que el zoom y el modo edge llegan por
 * postMessage. Se registra en el <head> para existir antes del load. */
const PG_BRIDGE_JS =
      `<script>(function(){window.addEventListener('message',function(e){var d=e.data||{};`
    + `if(d.pgZoom!=null)document.documentElement.style.zoom=d.pgZoom;`
    + `if(d.pgEdge!=null&&document.body)document.body.classList.toggle('pg-vp-edge',!!d.pgEdge);`
    + `});})();<\/script>`;

// Parche del preview para overlays/modales a pantalla completa (fixed inset-0).
// Un position:fixed se ancla al viewport del IFRAME y NO genera scroll, así que
// un modal más alto que el lienzo se recorta arriba y abajo (el contenido queda
// cortado). Aquí lo hacemos scrollable (overflow-y:auto en el overlay) y
// centramos su tarjeta con margin:auto: a diferencia de align-items:center, los
// márgenes automáticos colapsan a 0 al desbordar en lugar de recortar la parte
// superior. Resultado: el componente SIEMPRE se ve completo dentro del contenedor.
// Vive dentro del srcdoc del iframe, por eso el selector global es seguro.
const PG_PREVIEW_FIX_CSS =
      // El scroll HORIZONTAL del root del preview es espurio: nace del gutter del
      // scrollbar vertical o de algún 100vw/w-screen del template. Lo suprimimos en
      // html,body (root) para que el render llene el lienzo sin barra en x. Los
      // contenedores internos con overflow-x propio (tablas anchas) siguen scrolleando.
      'html,body{overflow-x:hidden;}'
    + '[class*="fixed"][class*="inset-0"]{overflow-y:auto;}'
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
        const headInject = `<base href="${appBase}">${PG_BRIDGE_JS}${scripts}${links}${style}<style>${PG_PREVIEW_FIX_CSS}</style>`;
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
        // El llenado a pantalla completa lo garantiza el prompt (nodo raíz
        // w-full min-h-screen); aquí NO forzamos altura extra para no provocar
        // scroll vertical espurio (y con él una barra horizontal de gutter).
        : `body{min-height:100vh;}`
          + `.pg-stage{box-sizing:border-box;width:100%;min-height:100vh;padding:28px;`
          +           `display:flex;flex-direction:column;align-items:center;justify-content:flex-start;}`
          // Hijo directo a ancho completo (la mayoría de componentes que deben
          // llenar el lienzo) pero respetando su propio max-width si lo declaran.
          + `.pg-stage > *{width:100%;}`
          // pg-vp-edge la pone pgSyncStageViewport() (full/móvil): el template
          // ocupa el lienzo de borde a borde, sin el padding de presentación.
          + `body.pg-vp-edge .pg-stage{padding:0;}`;

    return `<!DOCTYPE html><html${htmlAttr}><head><meta charset="utf-8">
        <base href="${appBase}">${PG_BRIDGE_JS}
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
    // Si vienes iterando una plantilla cargada, ofrecemos "Actualizar" además de
    // "Guardar como nueva", y proponemos su mismo nombre.
    const editing  = !!pg._loadedSlug;
    const suggested = editing
        ? (pg._loadedName || '')
        : (pg._lastUserText || '').trim().slice(0, 46);
    $('#pgSaveTplName').val(suggested);
    $('#pgSaveTplSlug').text(suggested ? 'Carpeta: documents/template/' + pgSlugify(suggested) + '/' : '');

    $('#pgSaveTplActive').toggle(editing);
    $('#pgSaveTplActiveName').text(pg._loadedName || pg._loadedSlug || '');
    $('#pgSaveTplUpdate').toggle(editing);
    $('#pgSaveTplConfirmLabel').text(editing ? 'Guardar como nueva' : 'Guardar');

    $('#pgSaveTplModal').removeClass('hidden').attr('aria-hidden', 'false');
    setTimeout(() => $('#pgSaveTplName').trigger('focus'), 30);
    if (window.lucide) lucide.createIcons();
}
function pgCloseSaveTemplate() {
    $('#pgSaveTplModal').addClass('hidden').attr('aria-hidden', 'true');
}

// `updateSlug` presente = sobrescribe esa carpeta (actualizar la plantilla
// cargada); ausente = crea/usa el slug derivado del nombre (guardar nueva).
async function pgConfirmSaveTemplate(updateSlug) {
    const name = $('#pgSaveTplName').val().trim();
    if (!name) { pgToast('Escribe un nombre para la plantilla', 'warn'); return; }
    if (!pg.lastHtml) { pgToast('No hay render para guardar', 'warn'); return; }

    const t = PG_THEMES[pg.lastTheme] || PG_THEMES[pg.theme] || {};
    // Al persistir solo guardamos el HTML generado: el history se despoja de las
    // imágenes adjuntas (base64) para no inflar meta.json con la imagen.
    const cleanHistory = (pg.history || []).map(m => {
        const { images, imagesPreview, ...rest } = m;
        return rest;
    });
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
        history:    cleanHistory
    };

    const $btn = $('#pgSaveTplConfirm, #pgSaveTplUpdate').prop('disabled', true);
    try {
        const form = new FormData();
        form.append('action', 'savetemplate');
        form.append('name', name);
        form.append('html', pg.lastHtml);
        form.append('meta', JSON.stringify(meta));
        if (updateSlug) form.append('slug', updateSlug);   // sobrescribe esa carpeta
        const res  = await fetch(PG_API, { method: 'POST', body: form });
        const data = await res.json();
        if (data.success) {
            // La plantilla guardada pasa a ser la "activa": el siguiente guardado
            // ya ofrece actualizarla, y sobrevive al recargar (va en la sesión).
            pg._loadedSlug = data.slug || updateSlug || pgSlugify(name);
            pg._loadedName = data.name || name;
            pgSaveSession();
            pgCloseSaveTemplate();
            pgToast(updateSlug ? 'Plantilla actualizada' : 'Plantilla guardada en ' + data.path, 'success');
        } else {
            pgToast(data.message || 'No se pudo guardar', 'error');
        }
    } catch (e) {
        pgToast('Error de red al guardar la plantilla', 'error');
    }
    $btn.prop('disabled', false);
}

/* ── Transmutación: diseño aprobado → módulo coffeeSoft (Coffee Studio) ──
 * El Playground solo aprueba el diseño; quien transmuta es CoffeeMagic dentro del
 * Studio, con el spell `transmute` (ver coffee/docs/coffee-magic-guia.md). Aquí se
 * recogen los parámetros del YAML, el render se persiste como plantilla y el Studio
 * la recoge por slug — así el HTML viaja por disco y no por la URL. */

// Pivote y carpeta por defecto del spell transmute (los del propio grimorio-fuente).
const PG_TM_DIR = 'app/inventarios';
const PG_TM_REF = 'app/inventarios/src/js/pos-entradas.js';

// Tema visual que entiende `transmute` (huubie|varoch|dark). Los temas del
// Playground sin equivalente devuelven '' para que CoffeeMagic lo detecte del HTML.
const PG_TM_THEME = {
    'huubie-ui': 'huubie',
    'coffee-varoch-light': 'varoch',
    'coffee-varoch-dark': 'varoch'
};

function pgPascalize(name) {
    return pgSlugify(name).split('-').filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

function pgOpenTransmute() {
    if (!pg.lastHtml) { pgToast('Aún no hay diseño que transmutar', 'warn'); return; }

    // Si la plantilla ya se transmutó antes, reproponemos sus mismos parámetros.
    const prev = pg._transmute || {};
    const seed = prev.modulo || pgSlugify(pg._loadedName || pg._lastUserText || '');
    $('#pgTmModulo').val(seed);
    $('#pgTmEntidad').val(prev.entidad || pgPascalize(seed)).data('touched', !!prev.entidad);
    $('#pgTmDir').val(prev.dir || PG_TM_DIR);
    $('#pgTmRef').val(prev.referencia || PG_TM_REF);
    $('#pgTmHub').val(prev.hub || '');
    $('#pgTmCardLabel').val(prev.cardLabel || '');
    $('#pgTmCardIcon').val(prev.cardIcon || '');
    $('#pgTmSlug').text(seed ? 'Plantilla: documents/template/' + pgSlugify(seed) + '/' : '');

    const themeKey = pg.lastTheme || pg.theme;
    const t = PG_THEMES[themeKey] || {};
    $('#pgTmThemeName').text(t.label || themeKey);

    $('#pgTransmuteModal').removeClass('hidden').attr('aria-hidden', 'false');
    setTimeout(() => $('#pgTmModulo').trigger('focus'), 30);
    if (window.lucide) lucide.createIcons();
}
function pgCloseTransmute() {
    $('#pgTransmuteModal').addClass('hidden').attr('aria-hidden', 'true');
}

/* Persiste el diseño como plantilla (con sus parámetros de transmutación en el
 * meta) y abre el Studio apuntando a ese slug. El Studio hace el resto: monta el
 * hilo con CoffeeMagic y deja listo el prompt del spell. */
async function pgConfirmTransmute() {
    const modulo = pgSlugify($('#pgTmModulo').val());
    if (!$('#pgTmModulo').val().trim()) { pgToast('Escribe el nombre del módulo', 'warn'); return; }
    if (!pg.lastHtml) { pgToast('No hay diseño que transmutar', 'warn'); return; }

    const themeKey = pg.lastTheme || pg.theme;
    const params = {
        modulo:     modulo,
        entidad:    $('#pgTmEntidad').val().trim() || pgPascalize(modulo),
        dir:        $('#pgTmDir').val().trim() || PG_TM_DIR,
        referencia: $('#pgTmRef').val().trim(),
        tema:       PG_TM_THEME[themeKey] || '',
        themeKey:   themeKey,
        hub:        $('#pgTmHub').val().trim(),
        cardLabel:  $('#pgTmCardLabel').val().trim(),
        cardIcon:   $('#pgTmCardIcon').val().trim()
    };

    const t = PG_THEMES[themeKey] || {};
    const cleanHistory = (pg.history || []).map(m => {
        const { images, imagesPreview, ...rest } = m;
        return rest;
    });
    const meta = {
        title:      (pg._lastUserText || modulo).slice(0, 120),
        theme:      themeKey,
        themeLabel: t.label || themeKey,
        agentKey:   pg.agentKey,
        agentLabel: pgAgentLabel(),
        model:      pg.model || '',
        prompt:     pg.prompt || '',
        userText:   pg._lastUserText || '',
        isDoc:      !!pg._lastIsDoc,
        transmute:  params,
        history:    cleanHistory
    };

    const $btn = $('#pgTransmuteConfirm').prop('disabled', true);
    try {
        const form = new FormData();
        form.append('action', 'savetemplate');
        form.append('name', modulo);
        form.append('html', pg.lastHtml);
        form.append('meta', JSON.stringify(meta));
        // Iterar sobre la misma plantilla reescribe su carpeta en vez de duplicarla.
        if (pg._loadedSlug === modulo) form.append('slug', modulo);
        const res  = await fetch(PG_API, { method: 'POST', body: form });
        const data = await res.json();
        if (!data.success) { pgToast(data.message || 'No se pudo guardar el diseño', 'error'); }
        else {
            const slug = data.slug || modulo;
            pg._loadedSlug = slug;
            pg._loadedName = data.name || modulo;
            pg._transmute  = params;
            pgSaveSession();
            pgCloseTransmute();
            pgToast('Diseño enviado a Coffee Studio', 'success');
            window.open('studio.php?transmute=' + encodeURIComponent(slug), '_blank');
        }
    } catch (e) {
        pgToast('Error de red al enviar el diseño al Studio', 'error');
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
    // Recordar de qué plantilla viene para poder ACTUALIZARLA al seguir iterando.
    // (Tras pgClearChat, que limpia estos campos.)
    pg._loadedSlug = t.slug || null;
    pg._loadedName = t.name || t.title || t.slug || '';
    pg._transmute  = t.transmute || null;   // si ya se transmutó, reproponer sus parámetros
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
    pgSaveSession();   // la plantilla cargada pasa a ser la sesión activa
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
/* Fusiona el JS/CSS que el modelo dejó en bloques HERMANOS (```js / ```css, fuera
 * del ```html) dentro del propio HTML. Sin esto el template se renderiza mudo: el
 * prompt pide todo en un solo bloque, pero al pedir "agrégale eventos" el modelo
 * suele contestar con el markup y el script separados y la interacción se perdía. */
function pgMergeSideBlocks(src, html) {
    if (!html) return html;
    const rest = String(src || '').split(html).join(' ');   // solo lo que quedó FUERA del html
    const grab = re => {
        const out = [];
        let m;
        while ((m = re.exec(rest))) if (m[1].trim()) out.push(m[1].trim());
        return out;
    };
    const css = grab(/```[ \t]*css[ \t]*\r?\n?([\s\S]*?)```/gi);
    const js  = grab(/```[ \t]*(?:javascript|js)[ \t]*\r?\n?([\s\S]*?)```/gi);
    if (!css.length && !js.length) return html;

    // data-pg-merged marca lo inyectado por nosotros: pgPatchLastHtml lo usa para
    // que un parche SUSTITUYA al anterior en vez de acumularse.
    let add = '';
    if (css.length) add += '\n<style data-pg-merged>\n' + css.join('\n') + '\n</style>';
    if (js.length)  add += '\n<script data-pg-merged>\n' + js.join('\n\n') + '\n<\/script>';
    // Documento completo: el script va DENTRO del body, no colgando tras </html>.
    return /<\/body>/i.test(html)
        ? html.replace(/<\/body>/i, add + '\n</body>')
        : html + add;
}

// Extrae HTML renderizable de la respuesta, tolerante a fences mal formados o
// HTML crudo sin fence (causa frecuente de "no renderiza").
function pgExtractHtml(text) {
    const s = text || '';
    // 1) bloque ```html cerrado (con/sin salto, espacios, mayúsculas)
    let m = s.match(/```[ \t]*html[ \t]*\r?\n?([\s\S]*?)```/i);
    if (m && m[1].trim()) return pgMergeSideBlocks(s, m[1].trim());
    // 2) cualquier fence cerrado cuyo contenido parezca HTML
    m = s.match(/```[a-z0-9+-]*[ \t]*\r?\n?([\s\S]*?)```/i);
    if (m && pgLooksLikeHtml(m[1])) return pgMergeSideBlocks(s, m[1].trim());
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
