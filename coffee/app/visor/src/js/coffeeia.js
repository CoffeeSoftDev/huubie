/* ============================================================
   coffeeia.js — Chat CoffeeIA: la fusión del Visor y el Lab.
   Misma lógica que ambos (thinking, animaciones, tools, SSE de
   ctrl-coffeeia-stream.php) tomando lo mejor de cada uno:
   - Visor: meta footer completo (costo real/credits, tokens
     in/out, tiempo), rescate del parcial con drain al detener.
   - Lab: chequeo de visión del modelo, poda del payload (solo
     el último ```html viaja completo), chip de tools_fallback,
     mensaje útil cuando el modelo no responde.
   - Nuevo: cronómetro vivo del tiempo de espera en el indicador.
   ============================================================ */

const CHAT_API_STREAM = 'ctrl/ctrl-coffeeia-stream.php';
const CHAT_API_DOCS   = 'ctrl/ctrl-visor.php';
const CHAT_API_CHATS  = 'ctrl/ctrl-chats.php';   // persistencia en SQLite, igual que el Visor

const CHAT_AGENTS = {
    'CoffeeIA.md':            { key: 'CoffeeIA.md',            label: 'CoffeeIA',          icon: 'sparkles',      slug: 'CoffeeIA' },
    'CoffeeMagic.md':         { key: 'CoffeeMagic.md',         label: 'CoffeeMagic',       icon: 'wand-sparkles', slug: 'CoffeeMagic' },
    'coffee-intelligence.md': { key: 'coffee-intelligence.md', label: 'CoffeeIntelligence', icon: 'database',     slug: 'coffee-intelligence' }
};
const CHAT_DEFAULT_AGENT = 'CoffeeIA.md';

// Catálogo de modelos: fuente única en model-config.js (CoffeeModelConfig.CATALOG),
// igual que Visor y Lab. Así el chat respeta los modelos habilitados en
// Configuración y el modelo activo global compartido entre superficies.
function chatModelCatalog() {
    return (window.CoffeeModelConfig && window.CoffeeModelConfig.CATALOG) || [];
}

// Tipos de grafica del modo grafica (mismo set que el visor).
const CHAT_GRAPH_TYPES  = ['mermaid', 'drawio', 'excalidraw'];
const CHAT_GRAPH_LABELS = { mermaid: 'Mermaid', drawio: 'draw.io', excalidraw: 'Excalidraw' };

const chat = {
    agentKey:      CHAT_DEFAULT_AGENT,
    model:         '',
    systemOverride: '',
    uiTheme:       'dark',
    canvasMode:    false,      // la IA genera componentes HTML renderizables
    graphMode:     '',         // '' | 'mermaid' | 'drawio' | 'excalidraw'
    dbToolsOn:     false,      // tools de base de datos (run_select + conexión al nombrar una base)
    fsToolsOn:     false,      // tools de archivos (list_dir/read_file/grep_files + conexión de carpeta)
    activeDb:      null,       // base conectada (conexión pegajosa por conversación)
    activeFolder:  null,       // carpeta conectada (conexión pegajosa por conversación)
    history:       [],
    pendingImages: [],
    pendingDocs:   [],
    isBusy:        false,
    _abort:        null,
    conversations: [],
    currentUid:    null,       // uid de la conversación en SQLite (ctrl-chats.php)
    currentTitle:  'Nueva conversacion',
    dirty:         false,
    _popSound:     null
};

/* ---------- Bootstrap ---------- */
$(async () => {
    chatLoadSettings();
    chatApplyUiTheme(chat.uiTheme);
    chatPopulateAgentSelect();
    chatPopulateModelSelect();
    chatBind();
    chatApplyModeUI();
    chatRenderMain();
    await chatLoadAgents();
    await chatLoadConversations();
    chatApplyAgent(chat.agentKey, true);
    if (window.lucide) lucide.createIcons();
});

/* ---------- Prompts de agentes (hace funcional el selector) ---------- */
// Carga el .md de cada agente desde la libreria de .claude/agents y guarda su
// "personalidad" para inyectarla como systemOverride al hablar con ese agente.
async function chatLoadAgents() {
    chat._agentPrompts = chat._agentPrompts || {};
    try {
        const res = await fetch(`${CHAT_API_DOCS}?folder=agents`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        (data.agents || []).forEach(f => { if (f && f.file) chat._agentPrompts[f.file] = f.raw || ''; });
    } catch (err) {
        console.error('chatLoadAgents:', err);
    }
}

/* ---------- Settings ---------- */
function chatLoadSettings() {
    try {
        const s = JSON.parse(localStorage.getItem('coffeeia:settings:v1') || '{}');
        chat.agentKey   = s.agentKey || CHAT_DEFAULT_AGENT;
        chat.model      = s.model || '';
        chat.uiTheme    = s.uiTheme || 'dark';
        chat.canvasMode = !!s.canvasMode;
        chat.graphMode  = CHAT_GRAPH_TYPES.indexOf(s.graphMode) !== -1 ? s.graphMode : '';
        chat.dbToolsOn  = !!s.dbToolsOn;
        chat.fsToolsOn  = !!s.fsToolsOn;
    } catch (_) { /* noop */ }
}

function chatSaveSettings() {
    localStorage.setItem('coffeeia:settings:v1', JSON.stringify({
        agentKey: chat.agentKey,
        model: chat.model,
        uiTheme: chat.uiTheme,
        canvasMode: chat.canvasMode,
        graphMode: chat.graphMode,
        dbToolsOn: chat.dbToolsOn,
        fsToolsOn: chat.fsToolsOn
    }));
}

function chatApplyUiTheme(theme) {
    chat.uiTheme = theme;
    document.body.setAttribute('data-theme', theme);
    const $icon = $('#chatThemeToggle i');
    if ($icon.length) {
        $icon.attr('data-lucide', theme === 'dark' ? 'sun' : 'moon');
        if (window.lucide) lucide.createIcons();
    }
    chatSaveSettings();
    // Re-render para que los diagramas Mermaid/HTML adopten el tema nuevo.
    if (chat.history && chat.history.length) chatRenderMain();
}

/* ---------- Populate selects ---------- */
function chatPopulateAgentSelect() {
    const $sel = $('#chatAgentSelect');
    $sel.empty();
    Object.values(CHAT_AGENTS).forEach(a => {
        $sel.append(`<option value="${a.key}">${a.label}</option>`);
    });
    $sel.val(chat.agentKey);
}

function chatPopulateModelSelect() {
    const $sel = $('#chatModelSelect');
    $sel.empty();
    $sel.append('<option value="">— Default del proveedor —</option>');
    chatModelCatalog().forEach(g => {
        const $grp = $(`<optgroup label="${g.group}"></optgroup>`);
        g.options.forEach(o => {
            const $opt = $(`<option value="${o.value}">${o.label}</option>`);
            if (o.tools) $opt.attr('data-tools', '1');
            $grp.append($opt);
        });
        $sel.append($grp);
    });
    $sel.val(chat.model || '');
}

/* ---------- Bindings ---------- */
function chatBind() {
    $('#chatAgentSelect').on('change', e => chatApplyAgent(e.target.value, false));
    $('#chatModelSelect').on('change', e => { chat.model = e.target.value || ''; chatSaveSettings(); chatWarnModelTools(); });
    $('#chatThemeToggle').on('click', () => chatApplyUiTheme(chat.uiTheme === 'dark' ? 'light' : 'dark'));

    // Modo lienzo (HTML renderizable).
    $('#chatCanvasToggle').on('click', () => chatToggleCanvasMode());

    // Menu de graficas: elegir tipo activa el "modo grafica".
    $('#chatGraphBtn').on('click', e => { e.stopPropagation(); chatToggleGraphMenu(e.currentTarget); });
    $(document).on('click.chatGraphMenu', e => {
        if (!$(e.target).closest('#chatGraphMenu, #chatGraphBtn').length) $('#chatGraphMenu').hide();
    });
    $(window).on('resize.chatGraphMenu scroll.chatGraphMenu', () => $('#chatGraphMenu').hide());
    $('#chatGraphMenu').on('click', '.graph-menu-item', e => {
        const type = $(e.currentTarget).data('graph');
        $('#chatGraphMenu').hide();
        chatSetGraphMode(type);
    });

    // Menú Tools: interruptores de BD/archivos (tool-calling del agente).
    $('#chatToolsBtn').on('click', e => { e.stopPropagation(); chatToggleToolsMenu(e.currentTarget); });
    $(document).on('click.chatToolsMenu', e => {
        if (!$(e.target).closest('#chatToolsMenu, #chatToolsBtn').length) $('#chatToolsMenu').hide();
    });
    $(window).on('resize.chatToolsMenu scroll.chatToolsMenu', () => $('#chatToolsMenu').hide());
    $('#chatToolsMenu').on('click', '.graph-menu-item', e => {
        const tool = $(e.currentTarget).data('cht');
        if (tool === 'db') {
            chat.dbToolsOn = !chat.dbToolsOn;
            if (!chat.dbToolsOn && chat.activeDb) chatSetActiveDb(null);
            chatToast(chat.dbToolsOn ? 'Tools de base de datos activadas: nombra una base en el chat para conectarte' : 'Tools de base de datos desactivadas', 'info');
            if (chat.dbToolsOn) chatWarnModelTools();
        } else if (tool === 'fs') {
            chat.fsToolsOn = !chat.fsToolsOn;
            if (!chat.fsToolsOn && chat.activeFolder) chatSetActiveFolder(null);
            chatToast(chat.fsToolsOn ? 'Tools de archivos activadas: nombra una carpeta en el chat para conectarte' : 'Tools de archivos desactivadas', 'info');
            if (chat.fsToolsOn) chatWarnModelTools();
        }
        chatSaveSettings();
        chatApplyModeUI();
    });

    $('#chatNewBtn, #chatNewSidebarBtn').on('click', () => chatNewConversation());

    // Buscador de conversaciones guardadas (filtra el sidebar por título).
    $('#chatSearchInput').on('input', function () {
        chat._filter = String($(this).val() || '').toLowerCase().trim();
        chatRenderSidebar();
    });

    // Scroll pegajoso: si el usuario sube a leer, se despega y aparece el botón
    // flotante para volver al final (mismo patrón que el Visor).
    $('#chatScrollDownBtn').on('click', () => chatScrollBottom(true));
    $('#chatBody').on('scroll', function () {
        const nearBottom = this.scrollTop + this.clientHeight >= this.scrollHeight - 48;
        chat._stickBottom = nearBottom;
        chatToggleScrollDownBtn(!nearBottom && chat.history.length > 0);
    });

    $('#chatSendBtn').on('click', () => {
        if (chat.isBusy) chatStop();
        else chatSubmit();
    });

    $('#chatInput').on('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            if (!chat.isBusy) chatSubmit();
        }
    }).on('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 180) + 'px';
    });

    $('#chatRenameBtn').on('click', () => chatOpenRenameModal());
    $('#chatSaveBtn').on('click', () => chatSaveConversation());
    $('#chatDownloadBtn').on('click', () => chatDownloadConversation());
    $('#chatDeleteBtn').on('click', () => chatOpenDeleteModal());

    $('#chatRenameSave').on('click', () => chatApplyRename());
    $('#chatRenameCancel, #chatRenameBackdrop').on('click', () => chatCloseRenameModal());
    $('#chatDeleteConfirm').on('click', () => chatApplyDelete());
    $('#chatDeleteCancel, #chatDeleteBackdrop').on('click', () => chatCloseDeleteModal());

    $('#chatRenameInput').on('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); chatApplyRename(); }
    });

    chatBindAttachments();
}

function chatApplyAgent(key, silent) {
    if (!CHAT_AGENTS[key]) return;
    chat.agentKey = key;
    // Aplica la personalidad del agente (si su .md ya se cargo). Si no hay prompt,
    // queda vacio y el backend usa el "alma" por defecto (coffee-system.md).
    chat.systemOverride = (chat._agentPrompts && chat._agentPrompts[key]) || '';
    if (!silent) {
        $('#chatAgentSelect').val(key);
        chatSaveSettings();
    }
}

/* ---------- Modos lienzo / grafica ---------- */
function chatApplyModeUI() {
    const $canvas = $('#chatCanvasToggle');
    $canvas.toggleClass('is-active', chat.canvasMode);
    $canvas.attr('title', chat.canvasMode
        ? 'Modo lienzo ACTIVO — la IA generará componentes HTML renderizables'
        : 'Activar modo lienzo (la IA generará componentes HTML renderizables)');

    const $graph = $('#chatGraphBtn');
    $graph.toggleClass('is-active', !!chat.graphMode);
    $graph.attr('title', chat.graphMode
        ? 'Modo gráfica ACTIVO (' + (CHAT_GRAPH_LABELS[chat.graphMode] || chat.graphMode) + ') — la IA generará diagramas de este tipo'
        : 'Lienzos de gráficas (Mermaid / draw.io / Excalidraw)');
    $('#chatGraphMenu .graph-menu-item').each(function () {
        $(this).toggleClass('is-active', $(this).data('graph') === chat.graphMode);
    });

    const $tools = $('#chatToolsBtn');
    $tools.toggleClass('is-active', chat.dbToolsOn || chat.fsToolsOn);
    $tools.attr('title', (chat.dbToolsOn || chat.fsToolsOn)
        ? 'Tools del agente ACTIVAS (' + [chat.dbToolsOn && 'base de datos', chat.fsToolsOn && 'archivos'].filter(Boolean).join(' + ') + ')'
        : 'Tools del agente: base de datos y archivos');
    $('#chatToolsMenu .graph-menu-item').each(function () {
        const t = $(this).data('cht');
        $(this).toggleClass('is-active', t === 'db' ? chat.dbToolsOn : chat.fsToolsOn);
    });

    chatApplyInputPlaceholder();
}

function chatApplyInputPlaceholder() {
    const $ta = $('#chatInput');
    if (chat.canvasMode) {
        $ta.attr('placeholder', 'Pide un componente UI (ej: "una card de producto con precio y botón")…');
    } else if (chat.graphMode) {
        const label = CHAT_GRAPH_LABELS[chat.graphMode] || chat.graphMode;
        $ta.attr('placeholder', 'Describe el diagrama y la IA lo genera en ' + label + '…');
    } else {
        $ta.attr('placeholder', 'Pregunta lo que quieras… (Enter para enviar, Shift+Enter para nueva línea)');
    }
}

function chatToggleCanvasMode() {
    chat.canvasMode = !chat.canvasMode;
    if (chat.canvasMode && chat.graphMode) chat.graphMode = '';   // excluyentes
    chatSaveSettings();
    chatApplyModeUI();
}

function chatSetGraphMode(type) {
    if (CHAT_GRAPH_TYPES.indexOf(type) === -1) return;
    chat.graphMode = (chat.graphMode === type) ? '' : type;
    if (chat.graphMode && chat.canvasMode) chat.canvasMode = false;   // excluyentes
    chatSaveSettings();
    chatApplyModeUI();
}

// Posiciona el menu FIXED sobre el boton (abre hacia arriba) para que el
// overflow del composer no lo recorte.
function chatToggleGraphMenu(btnEl) {
    chatToggleFloatingMenu($('#chatGraphMenu'), btnEl);
}

function chatToggleToolsMenu(btnEl) {
    chatToggleFloatingMenu($('#chatToolsMenu'), btnEl);
}

function chatToggleFloatingMenu($menu, btnEl) {
    if ($menu.is(':visible')) { $menu.hide(); return; }
    $menu.css({ display: 'block', visibility: 'hidden', position: 'fixed', top: '0px', left: '0px' });
    const rect = btnEl.getBoundingClientRect();
    const mw = $menu.outerWidth(), mh = $menu.outerHeight(), gap = 8;
    let left = rect.left, top = rect.top - mh - gap;
    left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
    if (top < 8) top = rect.bottom + gap;
    $menu.css({ left: left + 'px', top: top + 'px', visibility: 'visible' });
    if (window.lucide) lucide.createIcons();
}

/* ---------- Tools de datos (BD y carpeta), gemelo de Lab/Visor ----------
 * La base/carpeta se conecta nombrándola en el chat ("conéctate a reginas…");
 * el backend la resuelve y la devuelve en el evento `done`. Aquí solo se
 * recuerda (conexión pegajosa) y se reenvía en cada turno. */

function chatSetActiveDb(schema) {
    const next = schema || null;
    const changed = next !== chat.activeDb;
    chat.activeDb = next;
    chatRenderDbChip();
    if (changed && next) {
        chatToast('🛢 Conectado a la base ' + next, 'success');
        chatWarnModelTools();
    }
}

function chatRenderDbChip() {
    const $chip = $('#chatDbChip');
    if (!$chip.length) return;
    if (!chat.activeDb) { $chip.hide().empty(); return; }
    $chip.html(`
        <i data-lucide="database" class="w-3 h-3"></i>
        <span class="ia-db-chip-name" title="Base conectada: ${chatEscape(chat.activeDb)}">${chatEscape(chat.activeDb)}</span>
        <button type="button" class="ia-db-chip-x" title="Desconectar de la base"><i data-lucide="x" class="w-3 h-3"></i></button>
    `).show();
    $chip.find('.ia-db-chip-x').off('click').on('click', () => {
        chatSetActiveDb(null);
        chatToast('Desconectado de la base', 'info');
    });
    if (window.lucide) lucide.createIcons();
}

function chatSetActiveFolder(path) {
    const next = path || null;
    const changed = next !== chat.activeFolder;
    chat.activeFolder = next;
    chatRenderFolderChip();
    if (changed && next) {
        const fname = String(next).replace(/[\/\\]+$/, '').split(/[\/\\]/).pop();
        chatToast('📁 Conectado a la carpeta ' + fname, 'success');
        chatWarnModelTools();
    }
}

function chatRenderFolderChip() {
    const $chip = $('#chatFolderChip');
    if (!$chip.length) return;
    if (!chat.activeFolder) { $chip.hide().empty(); return; }
    const name = String(chat.activeFolder).replace(/[\/\\]+$/, '').split(/[\/\\]/).pop();
    $chip.html(`
        <i data-lucide="folder-open" class="w-3 h-3"></i>
        <span class="ia-db-chip-name" title="Carpeta conectada: ${chatEscape(chat.activeFolder)}">${chatEscape(name)}</span>
        <button type="button" class="ia-db-chip-x" title="Desconectar de la carpeta"><i data-lucide="x" class="w-3 h-3"></i></button>
    `).show();
    $chip.find('.ia-db-chip-x').off('click').on('click', () => {
        chatSetActiveFolder(null);
        chatToast('Desconectado de la carpeta', 'info');
    });
    if (window.lucide) lucide.createIcons();
}

// ¿El modelo dado tiene VISIÓN? Se deriva del texto del <option> del selector
// (los modelos con visión llevan "vision" en su etiqueta), mismo patrón que el
// Lab: no hay que mantener una lista aparte.
function chatModelHasVision(model) {
    const m = model || chat.model;
    if (!m) return false;
    const opt = document.querySelector(`#chatModelSelect option[value="${m.replace(/"/g, '\\"')}"]`);
    return !!opt && /vision/i.test(opt.textContent || '');
}

// ¿El modelo dado soporta tool-calling? Se deriva del data-tools="1" del
// <option> (mismo patrón que Lab). Un modelo desconocido no genera aviso.
function chatModelSupportsTools(model) {
    const m = model || chat.model;
    if (!m) return true;   // sin modelo explícito decide el backend (default tool-capable)
    const opt = document.querySelector(`#chatModelSelect option[value="${m.replace(/"/g, '\\"')}"]`);
    return !opt || opt.getAttribute('data-tools') === '1';
}

// Aviso suave cuando el modelo activo puede no soportar consultas en vivo.
function chatWarnModelTools() {
    if (!chat.dbToolsOn && !chat.fsToolsOn) return;
    if (chatModelSupportsTools(chat.model)) return;
    const target = chat.activeDb ? `la base conectada ("${chat.activeDb}")` :
                   chat.activeFolder ? 'la carpeta conectada' : 'bases de datos y carpetas';
    chatToast(`Este modelo puede no soportar consultas en vivo (tools): ${target} podría no leerse. Para datos reales usa GLM, Qwen3 Coder o Kimi.`, 'warn');
}

function chatBindAttachments() {
    $('#chatAttachBtn').on('click', () => $('#chatFileInput').trigger('click'));
    $('#chatFileInput').on('change', e => {
        Array.from(e.target.files || []).forEach(f => chatAddFile(f));
        e.target.value = '';
    });
    // Pegar (Ctrl+V) imagenes o archivos de texto desde el portapapeles. Tambien
    // funciona con el foco DENTRO del textarea (#chatInput): el texto normal se
    // pega como siempre y solo los archivos se adjuntan. Se ignora el modal de
    // renombrar para no robarle el pegado.
    $(document).on('paste', e => {
        if (e.target && e.target.id === 'chatRenameInput') return;
        const cd = e.originalEvent && e.originalEvent.clipboardData;
        if (!cd) return;
        const items = cd.items ? Array.from(cd.items) : [];
        let pasted = 0;
        for (const it of items) {
            if (it.kind !== 'file') continue;
            const f = it.getAsFile();
            if (f) { chatAddFile(f); pasted++; }
        }
        // Fallback: algunos navegadores exponen los archivos en clipboardData.files.
        if (!pasted && cd.files && cd.files.length) {
            Array.from(cd.files).forEach(f => { chatAddFile(f); pasted++; });
        }
        if (pasted > 0) {
            e.preventDefault();
            chatToast(pasted === 1 ? 'Adjunto pegado' : pasted + ' adjuntos pegados', 'success');
        }
    });
    const $wrap = $('.ia-input-wrap');
    $wrap.on('dragover', e => { e.preventDefault(); $wrap.addClass('is-drag-over'); });
    $wrap.on('dragleave', () => $wrap.removeClass('is-drag-over'));
    $wrap.on('drop', e => {
        e.preventDefault();
        $wrap.removeClass('is-drag-over');
        const dt = e.originalEvent && e.originalEvent.dataTransfer;
        if (!dt) return;
        let dropped = 0;
        const files = dt.files && dt.files.length ? Array.from(dt.files)
            : (dt.items ? Array.from(dt.items).filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean) : []);
        files.forEach(f => { chatAddFile(f); dropped++; });
        if (dropped > 0) chatToast(dropped === 1 ? 'Adjunto agregado' : dropped + ' adjuntos agregados', 'success');
    });
}

// Extensiones tratadas como texto plano (se inyectan al contexto, no como imagen).
const CHAT_TEXT_EXTS = [
    'txt','md','markdown','rtf','log','csv','tsv','html','htm','xml','svg','json','json5',
    'yaml','yml','toml','ini','env','conf','js','mjs','cjs','ts','jsx','tsx','css','scss','less',
    'php','py','rb','go','rs','java','kt','c','h','cpp','cs','swift','sql','sh','bash','ps1','bat','vue','astro'
];
function chatIsTextFile(file) {
    if (!file) return false;
    const ext = (file.name || '').split('.').pop().toLowerCase();
    if (CHAT_TEXT_EXTS.indexOf(ext) !== -1) return true;
    return /^(text\/|application\/(json|xml|javascript|x-yaml|x-sh|sql)|image\/svg)/i.test(file.type || '');
}

function chatAddFile(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
        chatToast('Archivo demasiado grande (>8MB)', 'error');
        return;
    }
    if (/^image\//.test(file.type)) {
        const reader = new FileReader();
        reader.onload = ev => {
            chat.pendingImages.push({ name: file.name, dataurl: ev.target.result });
            chatRenderAttachments();
        };
        reader.readAsDataURL(file);
    } else if (chatIsTextFile(file)) {
        const reader = new FileReader();
        reader.onload = ev => {
            chat.pendingDocs.push({ name: file.name, text: ev.target.result });
            chatRenderAttachments();
        };
        reader.readAsText(file);
    } else {
        chatToast('Formato no soportado: ' + (file.name || 'archivo') + ' (solo imágenes y texto)', 'error');
    }
}

function chatRenderAttachments() {
    const $strip = $('#chatImageStrip');
    $strip.empty();
    const all = [
        ...chat.pendingImages.map(i => Object.assign({}, i, { kind: 'image' })),
        ...chat.pendingDocs.map(d => Object.assign({}, d, { kind: 'doc' }))
    ];
    all.forEach((item, idx) => {
        const $chip = $('<div>').addClass('ia-img-chip');
        if (item.kind === 'image') {
            $chip.html(`<img src="${item.dataurl}" alt=""><span>${chatEscape(item.name)}</span><i data-lucide="x" class="cursor-pointer"></i>`);
        } else {
            $chip.html(`<i data-lucide="file-text" class="w-3.5 h-3.5"></i><span>${chatEscape(item.name)}</span><i data-lucide="x" class="cursor-pointer"></i>`);
        }
        $chip.find('i[data-lucide="x"]').on('click', () => {
            if (item.kind === 'image') {
                chat.pendingImages.splice(idx, 1);
            } else {
                chat.pendingDocs.splice(idx - chat.pendingImages.length, 1);
            }
            chatRenderAttachments();
        });
        $strip.append($chip);
    });
    $strip.toggle(all.length > 0);
    if (window.lucide) lucide.createIcons();
    const n = all.length;
    $('#chatContextInfo').text(n === 0 ? '' : (n + ' adjunto' + (n === 1 ? '' : 's')));
}

function chatDocsToContextString() {
    return chat.pendingDocs.map(d => `\n\n--- ${d.name} ---\n${d.text}`).join('');
}

/* ---------- Conversations list (SQLite via ctrl-chats.php, como el Visor) ---------- */
async function chatLoadConversations() {
    try {
        const res = await fetch(`${CHAT_API_CHATS}?action=list`, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Error al listar');
        chat.conversations = (data.rows || []).map(r => ({
            uid:      r.uid,
            title:    r.title || 'Sin titulo',
            model:    r.model || '',
            agentKey: CHAT_AGENTS[r.doc] ? r.doc : CHAT_DEFAULT_AGENT,   // el agente viaja en el campo `doc`
            msgCount: r.msg_count || 0,
            // SQLite guarda 'Y-m-d H:i:s'; el espacio rompe Date() en algunos parsers.
            mtime:    String(r.updated_at || r.created_at || '').replace(' ', 'T')
        }));
        chatRenderSidebar();
    } catch (err) {
        console.error('chatLoadConversations:', err);
        chat.conversations = [];
        chatRenderSidebar();
    }
}

function chatRenderSidebar() {
    const groups = { today: [], yesterday: [], week: [], older: [] };
    const now = Date.now();
    const list = chat._filter
        ? chat.conversations.filter(c => (c.title || '').toLowerCase().indexOf(chat._filter) !== -1)
        : chat.conversations;
    list.forEach(c => {
        const t = new Date(c.mtime).getTime();
        if (isNaN(t)) { groups.older.push(c); return; }
        const diffDays = Math.floor((now - t) / 86400000);
        if (diffDays === 0) groups.today.push(c);
        else if (diffDays === 1) groups.yesterday.push(c);
        else if (diffDays < 7) groups.week.push(c);
        else groups.older.push(c);
    });
    ['today', 'yesterday', 'week', 'older'].forEach(g => chatRenderGroup(g, groups[g]));
    $('#chatSidebarEmpty').toggle(list.length === 0);
}

function chatRenderGroup(groupKey, items) {
    const $wrap = $(`.chat-sidebar-group[data-group="${groupKey}"]`);
    const $ul = $wrap.find('ul');
    $ul.empty();
    if (!items.length) { $wrap.hide(); return; }
    $wrap.show();
    items.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    items.forEach(c => {
        const active = c.uid === chat.currentUid ? ' active' : '';
        const $li = $(`
            <li class="chat-sidebar-item${active}" data-uid="${chatEscape(c.uid)}" title="${chatEscape(c.title)}">
                <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                <span class="item-title">${chatEscape(c.title)}</span>
                <span class="item-meta">${chatRelativeTime(c.mtime)}</span>
                <button class="item-del" title="Eliminar conversación"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
            </li>
        `);
        $li.on('click', () => chatOpenConversation(c.uid));
        $li.find('.item-del').on('click', e => {
            e.stopPropagation();
            chatDeleteSaved(c.uid, c.title);
        });
        $ul.append($li);
    });
    if (window.lucide) lucide.createIcons();
}

// Elimina una conversación guardada directo desde el sidebar (✕ al hover).
async function chatDeleteSaved(uid, title) {
    if (!uid) return;
    if (!confirm('¿Eliminar "' + (title || 'esta conversación') + '"? Esta acción no se puede deshacer.')) return;
    const form = new FormData();
    form.append('action', 'delete');
    form.append('uid', uid);
    try {
        const res = await fetch(CHAT_API_CHATS, { method: 'POST', body: form });
        const data = await res.json();
        if (!data.success) { chatToast('Error al eliminar: ' + (data.message || ''), 'error'); return; }
        // Si borraste la conversación abierta, el chat queda en una nueva.
        if (uid === chat.currentUid) {
            chat.dirty = false;
            chatNewConversation();
        }
        await chatLoadConversations();
        chatToast('Conversación eliminada', 'success');
    } catch (err) {
        console.error(err);
        chatToast('Error de red al eliminar', 'error');
    }
}

/* ---------- New / Open / Save / Delete / Rename ---------- */
function chatNewConversation() {
    if (chat.dirty) {
        if (!confirm('Tienes cambios sin guardar. ¿Descartar y empezar una nueva conversacion?')) return;
    }
    clearTimeout(chat._autoSaveTimer);   // que no se guarde la conversación anterior aquí
    chat.history = [];
    chat.currentUid = null;
    chat.currentTitle = 'Nueva conversacion';
    chat.dirty = false;
    chat.pendingImages = [];
    chat.pendingDocs = [];
    chatSetActiveDb(null);
    chatSetActiveFolder(null);
    chatRenderAttachments();
    chatRenderMain();
    chatRenderSidebar();
    $('#chatInput').focus();
}

async function chatOpenConversation(uid) {
    if (chat.dirty && chat.currentUid !== uid) {
        if (!confirm('Tienes cambios sin guardar. ¿Descartarlos y abrir esta conversacion?')) return;
    }
    let c;
    try {
        const res = await fetch(`${CHAT_API_CHATS}?action=get&uid=${encodeURIComponent(uid)}`, { cache: 'no-store' });
        const data = await res.json();
        if (!data.success) { chatToast('No se pudo abrir: ' + (data.message || ''), 'error'); return; }
        c = data.chat || {};
    } catch (err) {
        console.error(err);
        chatToast('Error al abrir la conversacion', 'error');
        return;
    }
    clearTimeout(chat._autoSaveTimer);   // que no se guarde la conversación anterior aquí
    chat.history = Array.isArray(c.messages) ? c.messages : [];
    chat.currentUid = uid;
    chat.currentTitle = c.title || 'Conversacion';
    chat.agentKey = CHAT_AGENTS[c.doc] ? c.doc : chat.agentKey;   // el agente viaja en `doc`
    chat.model = c.model || '';
    chat.dirty = false;
    // Las conexiones pegajosas son por conversación: al abrir otra, se sueltan.
    chatSetActiveDb(null);
    chatSetActiveFolder(null);
    chatRenderMain();
    chatRenderSidebar();
    chatApplyAgent(chat.agentKey, true);
    $('#chatModelSelect').val(chat.model);
    $('#chatInput').focus();
}

async function chatSaveConversation(silent) {
    if (!chat.history.length) {
        if (!silent) chatToast('Conversacion vacia, nada que guardar', 'info');
        return;
    }
    if (chat.currentTitle === 'Nueva conversacion' || !chat.currentTitle.trim()) {
        chat.currentTitle = (chat.history[0].content || 'Conversacion').slice(0, 50).trim() || 'Conversacion';
    }
    // Upsert en SQLite (ctrl-chats.php), igual que el Visor: con uid actualiza la
    // misma fila; sin uid el backend lo genera y lo recordamos para el resto de
    // la conversación. El agente viaja en el campo `doc` del esquema.
    const form = new FormData();
    form.append('action', 'save');
    if (chat.currentUid) form.append('uid', chat.currentUid);
    form.append('title',    chat.currentTitle);
    form.append('user_id',  '');
    form.append('model',    chat.model || '');
    form.append('doc',      chat.agentKey || '');
    form.append('messages', JSON.stringify(chat.history));

    try {
        const res = await fetch(CHAT_API_CHATS, { method: 'POST', body: form });
        const data = await res.json();
        if (!data.success) {
            if (!silent) chatToast('Error al guardar: ' + (data.message || ''), 'error');
            return;
        }
        chat.currentUid = data.uid;
        chat.dirty = false;
        await chatLoadConversations();
        if (!silent) chatToast('Conversacion guardada', 'success');
    } catch (err) {
        console.error(err);
        if (!silent) chatToast('Error de red al guardar', 'error');
    }
}

// Autoguardado silencioso tras cada respuesta (debounced), como los hilos de Lab.
function chatAutoSave() {
    clearTimeout(chat._autoSaveTimer);
    chat._autoSaveTimer = setTimeout(() => chatSaveConversation(true), 600);
}

function chatDownloadConversation() {
    if (!chat.history.length) { chatToast('Nada que descargar', 'info'); return; }
    const md = chatSerializeToMd();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chatSlugify(chat.currentTitle) || 'conversacion'}.md`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

function chatOpenDeleteModal() {
    if (!chat.currentUid) { chatToast('Esta conversacion aun no esta guardada', 'info'); return; }
    $('#chatDeleteText').text('Vas a eliminar "' + chat.currentTitle + '". Esta accion no se puede deshacer.');
    $('#chatDeleteModal').removeClass('hidden');
}

function chatCloseDeleteModal() { $('#chatDeleteModal').addClass('hidden'); }

async function chatApplyDelete() {
    if (!chat.currentUid) return;
    const form = new FormData();
    form.append('action', 'delete');
    form.append('uid', chat.currentUid);
    try {
        const res = await fetch(CHAT_API_CHATS, { method: 'POST', body: form });
        const data = await res.json();
        if (!data.success) { chatToast('Error al eliminar: ' + (data.message || ''), 'error'); return; }
        chatToast('Conversacion eliminada', 'success');
        chatNewConversation();
        await chatLoadConversations();
        chatCloseDeleteModal();
    } catch (err) {
        console.error(err);
        chatToast('Error de red al eliminar', 'error');
    }
}

function chatOpenRenameModal() {
    $('#chatRenameInput').val(chat.currentTitle);
    $('#chatRenameModal').removeClass('hidden');
    setTimeout(() => $('#chatRenameInput').trigger('focus').select(), 50);
}

function chatCloseRenameModal() { $('#chatRenameModal').addClass('hidden'); }

function chatApplyRename() {
    const newTitle = $('#chatRenameInput').val().trim();
    if (!newTitle) { chatToast('El titulo no puede estar vacio', 'error'); return; }
    chat.currentTitle = newTitle;
    chat.dirty = true;
    $('#chatCurrentTitle').text(chat.currentTitle);
    chatCloseRenameModal();
    chatToast('Titulo actualizado', 'success');
    if (chat.currentUid) chatAutoSave();
}

/* ---------- Serialize / parse markdown ---------- */
function chatSerializeToMd() {
    const fmLines = [
        '---',
        `name: ${chat.currentTitle}`,
        `description: ${(chat.history[0]?.content || '').slice(0, 120).replace(/\n/g, ' ')}`,
        `date: ${new Date().toISOString().slice(0, 10)}`,
        `agent: ${chat.agentKey}`,
        `agent_dir: ${CHAT_AGENTS[chat.agentKey]?.slug || 'CoffeeIA'}`,
        `model: ${chat.model || 'default'}`,
        `messages: ${chat.history.length}`,
        '---',
        ''
    ];
    const blocks = chat.history.map(m => {
        const ts = new Date(m.ts || Date.now()).toISOString();
        const role = m.role === 'user' ? 'Tu' : (CHAT_AGENTS[chat.agentKey]?.label || 'Assistant');
        return `### ${ts} · ${role}\n\n${m.content || ''}\n`;
    });
    return fmLines.join('\n') + blocks.join('\n---\n\n');
}

/* ---------- Render main / mensajes ---------- */
function chatRenderMain() {
    $('#chatCurrentTitle').text(chat.currentTitle);
    const $body = $('#chatBody');
    $body.empty();
    if (!chat.history.length) {
        $body.html(chatEmptyHtml());
        $body.find('.chat-empty-brand').append($('.chat-logo svg').first().clone());
        chatBindSuggestions();
        if (window.lucide) lucide.createIcons();
        return;
    }
    const $inner = $('<div class="chat-body-inner"></div>');
    chat.history.forEach((m, idx) => $inner.append(chatRenderMessage(m, idx)));
    $body.append($inner);
    // Visores ricos (mermaid / chart / graphviz / html / diagramas) + resaltado.
    if (window.IARender) $inner.find('.chat-msg.assistant .chat-msg-text').each((_, el) => IARender.postProcess($(el)));
    if (window.lucide) lucide.createIcons();
    chatScrollBottom();
}

function chatEmptyHtml() {
    return `
        <div class="chat-empty">
            <div class="chat-empty-brand"></div>
            <div class="chat-empty-wordmark">Coffee <span>IA</span></div>
            <div class="chat-empty-sub">Pregunta lo que quieras. Adjunta imagenes o documentos para enriquecer el contexto.</div>
            <div class="chat-suggestions">
                <button class="chat-suggestion" data-prompt="¿Que puedes hacer?">¿Que puedes hacer?</button>
                <button class="chat-suggestion" data-prompt="Explicame CoffeeSoft en 3 parrafos">Explicame CoffeeSoft</button>
                <button class="chat-suggestion" data-prompt="Dame un ejemplo de consulta SQL con JOIN">Ejemplo SQL con JOIN</button>
                <button class="chat-suggestion" data-prompt="¿Cual es la diferencia entre varoch y huubie?">Varoch vs Huubie</button>
            </div>
        </div>
    `;
}

function chatBindSuggestions() {
    $('.chat-suggestion').on('click', function () {
        const prompt = $(this).data('prompt') || $(this).text();
        $('#chatInput').val(prompt).trigger('input').trigger('focus');
    });
}

function chatRenderMessage(m, idx) {
    const isUser = m.role === 'user';
    const $msg = $('<div>').addClass('chat-msg').addClass(m.role);
    const $text = $('<div>').addClass('chat-msg-text');
    if (isUser) {
        // Miniaturas de imagenes adjuntas + chips de documentos.
        if (Array.isArray(m.imagesPreview) && m.imagesPreview.length) {
            const $imgs = $('<div class="chat-msg-imgs"></div>');
            m.imagesPreview.forEach(src => {
                const $im = $(`<img src="${src}" alt="imagen adjunta" loading="lazy">`);
                $im.on('click', () => window.open(src, '_blank'));
                $imgs.append($im);
            });
            $text.append($imgs);
        }
        if (Array.isArray(m.docsMeta) && m.docsMeta.length) {
            const $docs = $('<div class="chat-msg-docs"></div>');
            m.docsMeta.forEach(d => $docs.append(
                `<span class="chat-msg-doc-chip" title="${chatEscape(d.name)}"><i data-lucide="file-text" class="w-3 h-3"></i><span>${chatEscape(d.name)}</span></span>`
            ));
            $text.append($docs);
        }
        if (m.content) $text.append($('<div>').text(m.content));
    } else {
        $text.html(chatMarkdown(m.content || ''));
    }
    $msg.append($text);

    const $actions = $('<div>').addClass('chat-msg-actions');
    if (isUser) {
        $actions.append(chatActionBtn('edit-3', 'Editar', () => chatEditMessage(idx)));
    } else {
        $actions.append(chatActionBtn('copy', 'Copiar', () => chatCopyMessage(idx)));
        $actions.append(chatActionBtn('file-down', 'Guardar como archivo', () => chatSaveMessageFile(idx)));
        $actions.append(chatActionBtn('refresh-cw', 'Regenerar', () => chatRegenerate(idx)));
    }
    $msg.append($actions);

    if (!isUser && m.meta) {
        // Pie de metadatos completo, mismo criterio que el Visor (iaMetaItems):
        // prioriza el COSTO REAL en USD (OpenRouter); sin costo cae a Credits
        // estimados (Ollama). Añade tokens in/out, tiempo, modelo y el aviso
        // persistente de tools_fallback (patrón Lab).
        const mm = m.meta;
        const $meta = $('<div>').addClass('chat-msg-meta');
        if (mm.cost_usd != null && !isNaN(mm.cost_usd)) {
            const c   = Number(mm.cost_usd);
            const txt = (c === 0 || c >= 0.0001) ? '$' + c.toFixed(4) : '<$0.0001';
            $meta.append(`<span class="meta-item" title="Costo real de OpenRouter (USD)"><span class="dot"></span>Costo: <strong>${txt}</strong></span>`);
        } else if (mm.credits_estimate != null) {
            $meta.append(`<span class="meta-item" title="Estimación por tokens de salida"><span class="dot"></span>Credits: <strong>${mm.credits_estimate}</strong></span>`);
        }
        if (mm.prompt_tokens != null || mm.completion_tokens != null) {
            const fmt = n => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n || 0));
            $meta.append(`<span class="meta-item" title="Tokens entrada / salida">Tokens: <strong>${fmt(mm.prompt_tokens)} in / ${fmt(mm.completion_tokens)} out</strong></span>`);
        } else if (mm.tokens_used) {
            $meta.append(`<span class="meta-item">${mm.tokens_used} tokens</span>`);
        }
        if (mm.elapsed_ms) $meta.append(`<span class="meta-item">Time: <strong>${(mm.elapsed_ms / 1000).toFixed(1)}s</strong></span>`);
        if (mm.model)      $meta.append(`<span class="meta-item">${chatEscape(mm.model)}</span>`);
        if (mm.tools_fallback) {
            $meta.append(`<span class="meta-item meta-fallback" title="${chatEscape(mm.tools_fallback)}"><i data-lucide="alert-triangle" class="w-3 h-3"></i> sin datos en vivo</span>`);
        }
        $msg.append($meta);
    }
    return $msg;
}

function chatActionBtn(icon, title, handler) {
    return $(`<button class="chat-msg-action" title="${title}"><i data-lucide="${icon}" class="w-3.5 h-3.5"></i></button>`).on('click', handler);
}

// Markdown → HTML. Delega en el motor compartido (marked + DOMPurify). El
// resaltado de codigo y los visores ricos (mermaid/chart/html/diagramas) los
// aplica IARender.postProcess sobre el mensaje ya montado en el DOM.
function chatMarkdown(text) {
    if (!text) return '';
    if (window.IARender) return IARender.markdownToHtml(text);
    if (!window.marked) return chatEscape(text);
    const raw = window.marked.parse(text, { breaks: true, gfm: true });
    return window.DOMPurify ? window.DOMPurify.sanitize(raw, { ADD_ATTR: ['target'] }) : raw;
}

// force=true: baja al fondo sí o sí y reactiva el pegado (envío de mensaje o
// clic en "bajar al final"). Sin force: respeta _stickBottom, de modo que si
// el usuario subió a leer mientras la IA escribe, no lo arrastra de vuelta.
function chatScrollBottom(force) {
    const el = $('#chatBody')[0];
    if (!el) return;
    if (force) { chat._stickBottom = true; chatToggleScrollDownBtn(false); }
    if (chat._stickBottom !== false) el.scrollTop = el.scrollHeight;
}

function chatToggleScrollDownBtn(show) {
    const $b = $('#chatScrollDownBtn');
    if (!$b.length) return;
    if (show) $b.css('display', 'flex'); else $b.hide();
}

function chatCopyMessage(idx) {
    const m = chat.history[idx];
    if (!m) return;
    const text = m.content || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
            () => chatToast('Mensaje copiado', 'success'),
            () => chatToast('No se pudo copiar', 'error')
        );
    } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); chatToast('Mensaje copiado', 'success'); }
        catch (_) { chatToast('No se pudo copiar', 'error'); }
        document.body.removeChild(ta);
    }
}

// Descarga el contenido de una respuesta como archivo .md (sugiere el nombre
// desde su primer encabezado markdown).
function chatSaveMessageFile(idx) {
    const m = chat.history[idx];
    if (!m || !m.content) { chatToast('Nada que guardar', 'info'); return; }
    let title = '';
    const h = m.content.match(/^#{1,6}\s+(.+)$/m);
    if (h) title = h[1].trim();
    const slug = chatSlugify(title) || ('respuesta-' + chatStamp());
    if (window.IARender) IARender.downloadText(slug + '.md', m.content);
    else {
        const blob = new Blob([m.content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = slug + '.md';
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
    }
    chatToast('Respuesta descargada', 'success');
}

function chatEditMessage(idx) {
    const m = chat.history[idx];
    if (!m || m.role !== 'user') return;
    const $msg = $('#chatBody .chat-body-inner .chat-msg').eq(idx);
    if (!$msg.length) return;
    const $editor = $(`<textarea class="chat-edit-textarea" rows="3">${chatEscape(m.content)}</textarea>`);
    const $actions = $(`
        <div class="chat-edit-actions">
            <button class="cs-btn cs-btn-sm cs-btn-primary chat-edit-save"><i data-lucide="send" class="w-3 h-3"></i> Guardar y reenviar</button>
            <button class="cs-btn cs-btn-sm cs-btn-ghost chat-edit-cancel">Cancelar</button>
        </div>
    `);
    $msg.find('.chat-msg-text').replaceWith($editor);
    $msg.find('.chat-msg-actions').replaceWith($actions);
    if (window.lucide) lucide.createIcons();
    $editor.trigger('focus');
    $actions.find('.chat-edit-save').on('click', () => {
        const newText = $editor.val().trim();
        if (!newText) { chatToast('Mensaje vacio', 'error'); return; }
        chat.history = chat.history.slice(0, idx);
        chat.history.push({ role: 'user', content: newText, ts: Date.now() });
        chat.dirty = true;
        chatRenderMain();
        chatSubmit();
    });
    $actions.find('.chat-edit-cancel').on('click', () => chatRenderMain());
}

function chatRegenerate(idx) {
    const m = chat.history[idx];
    if (!m || m.role !== 'assistant') return;
    chat.history = chat.history.slice(0, idx);
    chat.dirty = true;
    chatRenderMain();
    chatSubmit();
}

/* ---------- Submit + SSE streaming ---------- */
async function chatSubmit() {
    const text = $('#chatInput').val().trim();
    // Reenvío (Regenerar / Editar y reenviar): esas acciones dejan el history
    // terminando en un mensaje de usuario y llaman aquí con el input vacío. En
    // ese caso NO se pushea un user nuevo: se reenvía el que ya está al final.
    const lastMsg  = chat.history[chat.history.length - 1];
    const isResend = !text && !chat.pendingImages.length && !chat.pendingDocs.length
        && !!lastMsg && lastMsg.role === 'user';
    if (!text && !chat.pendingImages.length && !chat.pendingDocs.length && !isResend) return;
    if (chat.isBusy) { chatStop(); return; }

    // Snapshot de adjuntos ANTES de limpiar (si no, el payload viajaba vacio).
    const docsContext = chatDocsToContextString();
    const userMsg = isResend ? lastMsg : {
        role: 'user',
        content: text,
        images:        chat.pendingImages.map(img => (img.dataurl || '').replace(/^data:[^;]+;base64,/, '')),
        imagesPreview: chat.pendingImages.map(img => img.dataurl),
        docsMeta:      chat.pendingDocs.map(d => ({ name: d.name })),
        ts: Date.now()
    };
    if (!isResend) chat.history.push(userMsg);
    $('#chatInput').val('').trigger('input');
    chat.pendingImages = [];
    chat.pendingDocs = [];
    chatRenderAttachments();
    chat.dirty = true;

    if (chat.history.length === 1) {
        const auto = (userMsg.content || 'Nueva conversacion').slice(0, 50).trim();
        chat.currentTitle = auto || 'Nueva conversacion';
    }
    chatRenderMain();
    chatScrollBottom(true);   // enviar re-pega el scroll al fondo

    chatSetBusy(true);
    const ac = new AbortController();
    chat._abort = ac;
    const $typing = chatAppendTyping();
    chatStartWaitTimer($typing);
    let received = '';
    let meta = null;
    let streamErr = null;
    let firstToken = false;
    let thinkChars = 0;
    const streamState = { conjuring: false, kind: null, fed: 0, pending: '', shown: '', raf: null, done: false, drainCb: null, credit: 0, last: 0, $text: null };

    // Si el modelo activo NO tiene visión, las imágenes no viajan al modelo: se
    // OMITEN del payload (siguen en el chat y en el history por si luego se
    // cambia a un modelo con visión). Mismo patrón que el Lab.
    const dropImages = !!chat.model && !chatModelHasVision(chat.model);
    if (dropImages && userMsg.images.length) {
        chatToast('Este modelo no tiene visión: la imagen no se enviará. Elige uno con visión (los marcados con “vision”).', 'warn');
    }

    // Poda del PAYLOAD (chat.history no se toca): solo el ÚLTIMO bloque ```html
    // de la conversación viaja completo (la versión vigente); los anteriores se
    // sustituyen por una marca para no releer miles de tokens obsoletos (Lab).
    let lastHtmlIdx = -1;
    chat.history.forEach((m, i) => {
        if (/```html/i.test(m.content || '')) lastHtmlIdx = i;
    });

    try {
        const payload = {
            messages: chat.history.map((m, i) => {
                let content = m.content || '';
                if (i !== lastHtmlIdx && /```html/i.test(content)) {
                    content = content.replace(/```html[\s\S]*?```/gi,
                        '[versión anterior del template omitida por brevedad; la versión VIGENTE es el último bloque ```html de la conversación]');
                }
                const o = { role: m.role, content };
                if (!dropImages && m.images && m.images.length) o.images = m.images;
                return o;
            }),
            systemOverride: chat.systemOverride,
            model: chat.model || '',
            canvasMode: !!chat.canvasMode,
            graphMode: chat.graphMode || '',
            dbConnect:     (chat.dbToolsOn && chat.activeDb) || '',     // base conectada (conexión pegajosa)
            folderConnect: (chat.fsToolsOn && chat.activeFolder) || '', // carpeta conectada (conexión pegajosa)
            dbTools:       !!chat.dbToolsOn,   // apagado: el backend no resuelve base ni al nombrarla
            fsTools:       !!chat.fsToolsOn,   // apagado: el backend no resuelve carpeta ni al nombrarla
            currentFile: '',
            currentFileContent: docsContext || ''
        };

        const res = await fetch(CHAT_API_STREAM, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: ac.signal
        });
        if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        // eslint-disable-next-line no-constant-condition
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
                if (ev === 'thinking') {
                    // Etiqueta de tool-calling completa ("[consultando SELECT …]",
                    // "[leyendo archivo]") se muestra tal cual; el razonamiento en
                    // fragmentos se acumula como progreso (mismo patrón que Lab).
                    if (!firstToken) {
                        const t = obj.t || '';
                        if (/\[[^\]]*\]/.test(t)) {
                            chatSetTypingLabel($typing, t);
                        } else {
                            thinkChars += t.length;
                            chatSetTypingPhase($typing, thinkChars);
                        }
                    }
                } else if (ev === 'chunk') {
                    if (!firstToken) { firstToken = true; chatStopWaitTimer(); $typing.remove(); }
                    received += obj.t || '';
                    chatAppendOrUpdateStream(received, streamState);
                } else if (ev === 'done') {
                    meta = obj;
                } else if (ev === 'error') {
                    streamErr = obj.error;
                }
            }
        }
    } catch (err) {
        chatStopWaitTimer();
        $typing.remove();
        const aborted = err && err.name === 'AbortError';
        if (received) {
            // Rescate del parcial (patrón Visor/Lab): el typewriter termina de
            // pintar lo ya recibido y se conserva en el historial con su nota.
            await chatStreamDrain(streamState);
            const note = aborted
                ? '\n\n⏹ _Generación detenida._'
                : '\n\n⚠️ _La respuesta se cortó antes de terminar._';
            chat.history.push({ role: 'assistant', content: received + note, ts: Date.now() });
            if (!aborted) chatToast('Respuesta cortada: ' + (err.message || 'error de red'), 'warn');
        } else {
            chatStreamCancel(streamState);
            const content = aborted ? '⏹ Generación detenida.' : ('⚠️ ' + (streamErr || err.message || 'Error de red'));
            chat.history.push({ role: 'assistant', content: content, ts: Date.now() });
        }
        chat.dirty = true;
        chatRenderMain();
        chatSetBusy(false);
        chat._abort = null;
        chatAutoSave();
        return;
    }

    chatStopWaitTimer();
    if ($typing && $typing.length) $typing.remove();
    // Deja que el typewriter termine de escribir lo pendiente antes del render final.
    if (streamErr && !received) chatStreamCancel(streamState);
    else await chatStreamDrain(streamState);
    // Conexión pegajosa: si el backend resolvió una base/carpeta (la nombrada en
    // el mensaje o la reenviada), la recordamos para los siguientes turnos.
    if (meta && meta.db) chatSetActiveDb(meta.db);
    if (meta && meta.fs) chatSetActiveFolder(meta.fs);
    // Tool-calling que no funcionó: toast inmediato + chip persistente en el pie
    // del mensaje (viaja en meta y lo pinta chatRenderMessage), patrón Lab.
    if (meta && meta.tools_fallback) chatToast('⚠ ' + meta.tools_fallback, 'warn');
    if (streamErr) {
        // Error del proveedor a media respuesta: rescata el parcial (patrón Lab).
        const content = received
            ? (received + '\n\n⚠️ _Respuesta cortada: ' + streamErr + '_')
            : ('⚠️ ' + streamErr);
        chat.history.push({ role: 'assistant', content: content, ts: Date.now(), meta: meta });
    } else if (!firstToken) {
        // El stream cerró sin emitir un solo token (patrón Lab): explica y sugiere.
        chat.history.push({
            role: 'assistant',
            content: '⚠️ El agente no devolvió respuesta. El modelo actual puede no soportar esta tarea. Prueba con **glm-5.2** para código, o **kimi-k2.7-code** si necesitas visión.',
            ts: Date.now()
        });
    } else {
        // Normaliza salida cruda (modo lienzo/grafica) a bloques fenced para que
        // el post-procesador la convierta en visores ricos.
        let finalText = received;
        if (window.IARender) {
            finalText = IARender.normalizeCanvasHtml(finalText, chat.canvasMode);
            finalText = IARender.normalizeDrawioXml(finalText);
            finalText = IARender.normalizeExcalidrawJson(finalText);
        }
        chat.history.push({ role: 'assistant', content: finalText, ts: Date.now(), meta: meta });
    }
    chat.dirty = true;
    chatRenderMain();
    chatSetBusy(false);
    chat._abort = null;
    chatPlayPopSound();
    chatAutoSave();
}

function chatAppendTyping() {
    const $body = $('#chatBody');
    let $inner = $body.find('.chat-body-inner');
    if (!$inner.length) {
        $inner = $('<div class="chat-body-inner"></div>');
        $body.empty().append($inner);
    }
    // Mismo indicador que Visor/Lab: loader "quantum" + "Analizando…" animado,
    // más un cronómetro vivo del tiempo de espera (mejora propia de CoffeeIA).
    const $typing = $(`<div class="chat-typing"><div class="ia-typing-loader">${chatQuantumLoader('Analizando')}</div><span class="chat-typing-timer" title="Tiempo de espera"></span></div>`);
    $inner.append($typing);
    chatScrollBottom();
    return $typing;
}

/* Cronómetro del tiempo de espera: cuenta los segundos desde el envío hasta el
 * primer token, junto al indicador (sobrevive a los cambios de fase porque vive
 * fuera de .ia-typing-loader). Se apaga al primer token, error o cierre. */
function chatStartWaitTimer($typing) {
    chatStopWaitTimer();
    const t0 = performance.now();
    chat._waitTimer = setInterval(() => {
        const s = Math.floor((performance.now() - t0) / 1000);
        if (s >= 1) $typing.find('.chat-typing-timer').text(s + 's');
    }, 1000);
}

function chatStopWaitTimer() {
    if (chat._waitTimer) { clearInterval(chat._waitTimer); chat._waitTimer = null; }
}

// Loader "quantum" replicado de Templates.loader() (coffeeSoft.js), igual que en
// Visor/Lab: un orbe que muta forma y color; visor.css le añade el texto atenuado
// y los puntos "…" animados.
function chatQuantumLoader(text) {
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

// Pinta el stream. Si detecta un bloque de codigo "conjurable" (HTML en modo
// lienzo, o cualquier diagrama/grafica) muestra una tarjeta animada en vez de
// teclear el codigo crudo; el render real lo hace el post-proceso al terminar.
const CHAT_CONJURE_UI = {
    html:       { icon: 'wand-sparkles', title: 'Conjurando componente…', sub: 'Tejiendo el HTML' },
    mermaid:    { icon: 'git-graph',     title: 'Construyendo diagrama…',  sub: 'Trazando el gráfico' },
    drawio:     { icon: 'workflow',      title: 'Construyendo diagrama…',  sub: 'Trazando el lienzo' },
    excalidraw: { icon: 'pencil-ruler',  title: 'Bosquejando…',            sub: 'Trazando el boceto' }
};

function chatConjureKindFor(buf) {
    if (/```[ \t]*drawio/i.test(buf) || /<(mxGraphModel|mxfile)[\s>]/i.test(buf)) return 'drawio';
    if (/```[ \t]*excalidraw/i.test(buf) || /"type"\s*:\s*"excalidraw/i.test(buf)) return 'excalidraw';
    if (/```[ \t]*html/i.test(buf) || (chat.canvasMode && /<(!doctype html|html|head|body|section|main|header|nav|article|aside|footer|form|table|ul|ol|div|button|h[1-6])[\s>]/i.test(buf))) return 'html';
    if (chat.graphMode && /```/.test(buf)) return chat.graphMode;
    return null;
}

function chatAppendOrUpdateStream(received, state) {
    const $inner = $('#chatBody .chat-body-inner');
    if (!$inner.length) return;
    let $last = $inner.find('.chat-msg.assistant').last();
    if (!$last.length) {
        $last = $('<div class="chat-msg assistant"><div class="chat-msg-text"></div></div>');
        $inner.append($last);
    }

    if (state && !state.conjuring) {
        const kind = chatConjureKindFor(received);
        if (kind) {
            state.conjuring = true;
            state.kind = kind;
            chatStreamCancel(state);   // el typewriter se apaga: la card comunica el progreso
            const ui = CHAT_CONJURE_UI[kind] || CHAT_CONJURE_UI.html;
            $last.find('.chat-msg-text').html(`
                <div class="ia-conjuring">
                    <span class="ia-conjuring-orb"><i data-lucide="${ui.icon}"></i></span>
                    <div class="ia-conjuring-info">
                        <span class="ia-conjuring-title">${ui.title}</span>
                        <span class="ia-conjuring-sub"></span>
                    </div>
                </div>`);
            if (window.lucide) lucide.createIcons();
        }
    }

    if (state && state.conjuring) {
        const ui = CHAT_CONJURE_UI[state.kind] || CHAT_CONJURE_UI.html;
        const lines = received.split('\n').length;
        $last.find('.ia-conjuring-sub').text(ui.sub + ' · ' + lines + (lines === 1 ? ' línea' : ' líneas'));
        chatScrollBottom();
        return;
    }

    // Tecleo palabra a palabra (efecto Claude, mismo patrón que el Visor): al
    // typewriter solo se le alimenta el DELTA nuevo; un requestAnimationFrame
    // saca palabras del backlog a 14-60 palabras/seg y repinta el markdown.
    state.$text = $last.find('.chat-msg-text');
    state.pending += received.slice(state.fed || 0);
    state.fed = received.length;
    chatStreamKick(state);
}

function chatStreamKick(state) {
    if (state.raf) return;
    state.last = performance.now();
    state.credit = state.credit || 0;
    const pump = (now) => {
        const dt = Math.min(100, now - state.last);   // cap por si la pestaña estuvo inactiva
        state.last = now;
        // Ritmo en palabras/seg; sube si se acumula backlog para no rezagarse.
        const wps = 14 + Math.min(46, state.pending.length / 40);
        state.credit += (dt / 1000) * wps;
        let painted = false;
        while (state.credit >= 1 && state.pending.length) {
            const m = state.pending.match(/^\s*\S+\s*/);
            const len = m ? m[0].length : state.pending.length;
            state.shown += state.pending.slice(0, len);
            state.pending = state.pending.slice(len);
            state.credit -= 1;
            painted = true;
        }
        if (painted) {
            state.$text.html(chatMarkdown(state.shown) + '<span class="ia-stream-cursor">▍</span>');
            chatScrollBottom();
        }
        if (!state.pending.length) state.credit = 0;
        if (state.done && !state.pending.length) {
            state.raf = null;
            const cb = state.drainCb; state.drainCb = null;
            if (cb) cb();
            return;
        }
        state.raf = requestAnimationFrame(pump);
    };
    state.raf = requestAnimationFrame(pump);
}

// Espera a que el typewriter termine de escribir el backlog (para no cortar la
// animación al llegar el último chunk antes de pintar el mensaje definitivo).
function chatStreamDrain(state) {
    if (state.conjuring || (!state.raf && !state.pending.length)) return Promise.resolve();
    return new Promise(res => { state.done = true; state.drainCb = res; });
}

// Corta el typewriter en seco (error/abort): sin esto el rAF seguiría pintando
// sobre un nodo ya desmontado por el re-render.
function chatStreamCancel(state) {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;
    state.pending = '';
    state.done = true;
    const cb = state.drainCb; state.drainCb = null;
    if (cb) cb();
}

// Indica que el modelo esta razonando (tokens de "thinking") con progreso vivo.
function chatSetTypingPhase($typing, chars) {
    const approxToks = Math.max(1, Math.round(chars / 4));
    chatSetTypingLabel($typing, 'Razonando… ≈ ' + approxToks + ' tokens');
}

// Cambia el texto del indicador para reflejar el estado: etiquetas de
// tool-calling ("[consultando SELECT …]", "[leyendo archivo]") van con el orbe
// quantum; "Razonando…" (cadena de pensamiento) lleva un cerebro pulsante que
// se monta una sola vez y solo refresca el contador (mismo patrón que Lab).
function chatSetTypingLabel($typing, text) {
    if (!$typing || !$typing.length) return;
    let t = String(text || '').replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim();
    if (/^consultando/i.test(t)) t = 'Consultando: ' + t.replace(/^consultando\s*/i, '');
    if (t.length > 70) t = t.slice(0, 70) + '…';
    if (/^razonando/i.test(t)) {
        const $loader = $typing.find('.ia-typing-loader');
        const $txt = $loader.find('.chat-think-txt');
        if ($txt.length) { $txt.text(t); chatScrollBottom(); return; }
        $loader.html(
            `<div style="display:inline-flex;align-items:center;gap:8px">`
          + `<i data-lucide="brain" class="chat-think-brain"></i>`
          + `<span class="chat-think-txt"></span></div>`);
        $loader.find('.chat-think-txt').text(t);
        if (window.lucide) lucide.createIcons();
        chatScrollBottom();
        return;
    }
    $typing.find('.ia-typing-loader').html(chatQuantumLoader(t || 'Analizando'));
    chatScrollBottom();
}

function chatStop() {
    if (chat._abort) chat._abort.abort();
}

function chatSetBusy(b) {
    chat.isBusy = b;
    const $btn = $('#chatSendBtn');
    if (!$btn.length) return;
    if (b) {
        $btn.addClass('is-stop').html('<i data-lucide="square" class="w-3.5 h-3.5"></i>');
        $btn.attr('title', 'Detener');
    } else {
        $btn.removeClass('is-stop').html('<i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>');
        $btn.attr('title', 'Enviar (Enter)');
    }
    if (window.lucide) lucide.createIcons();
    $('#chatStatusInfo').text(b ? 'Generando…' : 'Listo');
}

function chatPlayPopSound() {
    try {
        if (!chat._popSound) {
            chat._popSound = new Audio('src/audio/pop_up.ogg');
            chat._popSound.volume = 0.6;   // mismo volumen que el Visor
        }
        chat._popSound.currentTime = 0;
        chat._popSound.play().catch(() => { /* noop */ });
    } catch (_) { /* noop */ }
}

/* ---------- Toast ---------- */
function chatToast(msg, tone) {
    tone = tone || 'info';
    const $t = $('#chatToast');
    if (!$t.length) return;
    $t.text(msg).attr('data-tone', tone).addClass('visible');
    clearTimeout(chat._toastTimer);
    chat._toastTimer = setTimeout(() => $t.removeClass('visible'), 2800);
}

/* ---------- Helpers ---------- */
function chatStamp() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function chatSlugify(s) {
    if (!s) return '';
    return String(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50);
}

function chatEscape(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function chatRelativeTime(ts) {
    if (!ts) return '';
    const t = new Date(ts).getTime();
    if (isNaN(t)) return '';
    const diff = Date.now() - t;
    if (diff < 0) return 'ahora';
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'ahora';
    if (min < 60) return min + 'm';
    const h = Math.floor(min / 60);
    if (h < 24) return h + 'h';
    const d = Math.floor(h / 24);
    if (d < 7) return d + 'd';
    return new Date(t).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
}

/* Responsive móvil (mismo patrón que el Lab): conmutador Conversaciones/Chat +
   dropdown de los controles del header. En desktop están ocultos por CSS. */
$(function () {
    const isMobile = () => window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
    const showChatView = () => {
        $('.chat-mswitch').removeClass('active');
        $('.chat-mswitch[data-mview="chat"]').addClass('active');
        $('.chat-workspace').attr('data-mview', 'chat');
    };

    $('.chat-mswitch').on('click', function () {
        const view = $(this).data('mview');
        $('.chat-mswitch').removeClass('active');
        $(this).addClass('active');
        $('.chat-workspace').attr('data-mview', view);
    });

    // Al abrir una conversación en móvil, saltar a la vista Chat.
    $(document).on('click', '.chat-sidebar-item', () => { if (isMobile()) showChatView(); });

    const closeHeader = () => {
        $('#chatHeaderRight').removeClass('is-open');
        $('#chatHeaderToggle').attr('aria-expanded', 'false').removeClass('is-active');
    };
    $('#chatHeaderToggle').on('click', function (e) {
        e.stopPropagation();
        const open = !$('#chatHeaderRight').hasClass('is-open');
        $('#chatHeaderRight').toggleClass('is-open', open);
        $(this).attr('aria-expanded', open ? 'true' : 'false').toggleClass('is-active', open);
    });
    $('#chatHeaderRight').on('change', 'select', () => { if (isMobile()) closeHeader(); });
    $(document).on('click.chatHeader', e => {
        if (!$('#chatHeaderRight').hasClass('is-open')) return;
        if ($(e.target).closest('#chatHeaderRight, #chatHeaderToggle').length) return;
        closeHeader();
    });
});
