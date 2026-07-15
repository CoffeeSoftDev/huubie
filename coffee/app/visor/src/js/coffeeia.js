/* ============================================================
   coffeeia.js — CoffeeIA: el chat definitivo del ecosistema.

   Escrito desde cero sobre el MOTOR REAL del Visor (no una
   imitación): mismo markup .ia-msg / .ia-typing-* / .ia-conjuring,
   mismo loader quantum de Templates.loader() (coffeeSoft.js) y
   mismo render IARender. Por eso las animaciones son idénticas a
   las del Visor, no parecidas: las pinta el mismo CSS (visor.css).

   Lo que aporta cada mundo:
   · Visor  → loader quantum real + puntos animados, fases de
              "Razonando…" con cerebro pulsante, typewriter por
              palabras, card "Conjurando…", pie de metadatos con
              costo/tokens/tiempo, cierre en el sitio (sin re-render).
   · Lab    → chequeo de visión, poda del payload (solo el último
              ```html viaja completo), aviso de tools_fallback,
              rescate del parcial cuando el stream se corta.
   · Nuevo  → multi-conversación con sidebar y autoguardado,
              cronómetro de espera, regenerar/editar en el hilo.
   ============================================================ */

const CIA_API_STREAM = 'ctrl/ctrl-coffeeia-stream.php';
const CIA_API_DOCS   = 'ctrl/ctrl-visor.php';
const CIA_API_CHATS  = 'ctrl/ctrl-chats.php';   // persistencia SQLite (misma que el Visor)

const CIA_AGENTS = {
    'CoffeeIA.md':            { key: 'CoffeeIA.md',            label: 'CoffeeIA',           slug: 'CoffeeIA' },
    'CoffeeMagic.md':         { key: 'CoffeeMagic.md',         label: 'CoffeeMagic',        slug: 'CoffeeMagic' },
    'coffee-intelligence.md': { key: 'coffee-intelligence.md', label: 'CoffeeIntelligence', slug: 'coffee-intelligence' }
};
const CIA_DEFAULT_AGENT = 'CoffeeIA.md';

const CIA_GRAPH_TYPES  = ['mermaid', 'drawio', 'excalidraw'];
const CIA_GRAPH_LABELS = { mermaid: 'Mermaid', drawio: 'draw.io', excalidraw: 'Excalidraw' };

// Panel de conversaciones: ancho ajustable arrastrando su borde (como en el Visor).
const CIA_SIDEBAR_DEFAULT = 262;
const CIA_SIDEBAR_MIN     = 200;
const CIA_SIDEBAR_MAX     = 680;

// Visor de templates (derecha en escritorio, ventana flotante en móvil).
const CIA_VIEWER_DEFAULT = 560;
const CIA_VIEWER_MIN     = 380;
const CIA_VIEWER_MAX     = 1100;

// Catálogo de modelos: fuente única en model-config.js, igual que Visor y Lab.
function ciaModelCatalog() {
    return (window.CoffeeModelConfig && window.CoffeeModelConfig.CATALOG) || [];
}

const CIA = {
    agentKey:       CIA_DEFAULT_AGENT,
    model:          '',
    systemOverride: '',
    uiTheme:        'dark',
    canvasMode:     false,     // la IA genera componentes HTML renderizables
    graphMode:      '',        // '' | 'mermaid' | 'drawio' | 'excalidraw'
    dbToolsOn:      false,     // tools de base de datos (run_select)
    fsToolsOn:      false,     // tools de archivos (list_dir/read_file/grep_files)
    sidebarWidth:   CIA_SIDEBAR_DEFAULT,   // ancho ajustable del panel de conversaciones
    sidebarOpen:    true,                  // panel visible (solo se recuerda en escritorio)
    // Visor de templates: los ```html de la conversación, en orden (cada uno es
    // una versión). El panel muestra uno; la burbuja solo deja una tarjeta.
    templates:      [],
    viewerOpen:     false,
    viewerIdx:      -1,
    viewerTab:      'preview',             // 'preview' | 'code'
    viewerWidth:    CIA_VIEWER_DEFAULT,
    activeDb:       null,      // base conectada (pegajosa por conversación)
    activeFolder:   null,      // carpeta conectada (pegajosa por conversación)
    history:        [],
    pendingImages:  [],
    pendingDocs:    [],
    isBusy:         false,
    _abort:         null,
    _agentPrompts:  {},
    conversations:  [],
    currentUid:     null,
    currentTitle:   'Nueva conversación',
    dirty:          false,
    _stickBottom:   true,
    _popSound:      null,
    _loaderHelper:  null,
    _waitTimer:     null,
    // Menciones "@": catálogo de bases/carpetas (se pide una vez) y estado del menú.
    _mentions:      null,
    _mentionsPromise: null,
    _mentionOpen:   false,
    _mentionItems:  [],
    _mentionIdx:    0,
    _mentionCtx:    null
};

/* ═══════════════════════ Bootstrap ═══════════════════════ */
$(async () => {
    ciaLoadSettings();
    ciaApplyUiTheme(CIA.uiTheme);
    ciaApplySidebarWidth(CIA.sidebarWidth);   // restaura el ancho guardado
    ciaApplyViewerWidth(CIA.viewerWidth);
    ciaPopulateAgentSelect();
    ciaPopulateModelSelect();
    ciaBind();
    ciaApplyModeUI();
    ciaRenderThread();
    await ciaLoadAgents();
    await ciaLoadConversations();
    ciaApplyAgent(CIA.agentKey, true);
    await ciaRestoreLastConversation();   // retoma la conversación donde se dejó
    if (window.lucide) lucide.createIcons();
});

/* Restaura la conversación activa tras recargar el módulo. El contenido ya vive
 * en SQLite (autoguardado); aquí solo reabrimos la última que estaba en pantalla,
 * recordada por uid en localStorage. Si fue borrada, arrancamos limpio. */
async function ciaRestoreLastConversation() {
    let uid = '';
    try { uid = localStorage.getItem('coffeeia:lastUid') || ''; } catch (_) { /* noop */ }
    if (!uid) return;
    if (!CIA.conversations.some(c => c.uid === uid)) { ciaRememberActive(null); return; }
    await ciaOpenConversation(uid);
}

/* Recuerda (o limpia) el uid de la conversación abierta para poder retomarla al
 * recargar. Se llama al guardar, abrir, iniciar una nueva y borrar. */
function ciaRememberActive(uid) {
    try {
        const v = uid !== undefined ? uid : CIA.currentUid;
        if (v) localStorage.setItem('coffeeia:lastUid', v);
        else   localStorage.removeItem('coffeeia:lastUid');
    } catch (_) { /* noop */ }
}

/* Carga los .md de los agentes para inyectar su personalidad como systemOverride. */
async function ciaLoadAgents() {
    try {
        const res = await fetch(`${CIA_API_DOCS}?folder=agents`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        (data.agents || []).forEach(f => { if (f && f.file) CIA._agentPrompts[f.file] = f.raw || ''; });
    } catch (err) {
        console.error('ciaLoadAgents:', err);
    }
}

/* ═══════════════════════ Settings ═══════════════════════ */
function ciaLoadSettings() {
    try {
        const s = JSON.parse(localStorage.getItem('coffeeia:settings:v1') || '{}');
        CIA.agentKey   = CIA_AGENTS[s.agentKey] ? s.agentKey : CIA_DEFAULT_AGENT;
        CIA.model      = s.model || '';
        CIA.uiTheme    = s.uiTheme === 'light' ? 'light' : 'dark';
        CIA.canvasMode = !!s.canvasMode;
        CIA.graphMode  = CIA_GRAPH_TYPES.indexOf(s.graphMode) !== -1 ? s.graphMode : '';
        CIA.dbToolsOn  = !!s.dbToolsOn;
        CIA.fsToolsOn  = !!s.fsToolsOn;
        // Ancho del panel de conversaciones (se descarta si viene fuera de rango).
        const w = Number(s.sidebarWidth);
        CIA.sidebarWidth = (isFinite(w) && w >= CIA_SIDEBAR_MIN && w <= CIA_SIDEBAR_MAX) ? w : CIA_SIDEBAR_DEFAULT;
        CIA.sidebarOpen  = (s.sidebarOpen === undefined) ? true : !!s.sidebarOpen;
        const vw = Number(s.viewerWidth);
        CIA.viewerWidth = (isFinite(vw) && vw >= CIA_VIEWER_MIN && vw <= CIA_VIEWER_MAX) ? vw : CIA_VIEWER_DEFAULT;
    } catch (_) { /* noop */ }
}

function ciaSaveSettings() {
    localStorage.setItem('coffeeia:settings:v1', JSON.stringify({
        agentKey: CIA.agentKey, model: CIA.model, uiTheme: CIA.uiTheme,
        canvasMode: CIA.canvasMode, graphMode: CIA.graphMode,
        dbToolsOn: CIA.dbToolsOn, fsToolsOn: CIA.fsToolsOn,
        sidebarWidth: CIA.sidebarWidth, sidebarOpen: CIA.sidebarOpen,
        viewerWidth: CIA.viewerWidth
    }));
}

/* ── Ancho del panel de conversaciones (ajustable, como el sidebar del Visor) ── */
function ciaApplySidebarWidth(px) {
    const w = Math.min(CIA_SIDEBAR_MAX, Math.max(CIA_SIDEBAR_MIN, Number(px) || CIA_SIDEBAR_DEFAULT));
    const sb = document.querySelector('.cia-sidebar');
    if (sb) sb.style.setProperty('--cia-sidebar-w', w + 'px');
    CIA.sidebarWidth = w;
    return w;
}

// Arrastre del borde derecho. El ancho se aplica en vivo y solo se PERSISTE al
// soltar (no en cada mousemove, que dispararía escrituras a localStorage a 60fps).
function ciaBindSidebarResize() {
    const $handle = $('#ciaSidebarResize');
    const $sb     = $('.cia-sidebar');
    if (!$handle.length || !$sb.length) return;

    let dragging = false, startX = 0, startW = CIA.sidebarWidth;

    $handle.on('mousedown', e => {
        e.preventDefault();          // sin esto el arrastre selecciona texto
        dragging = true;
        startX = e.clientX;
        startW = CIA.sidebarWidth;
        $sb.addClass('is-resizing');
        document.body.classList.add('cia-sidebar-resizing');
    });

    $(document).on('mousemove.ciaSbResize', e => {
        if (!dragging) return;
        ciaApplySidebarWidth(startW + (e.clientX - startX));   // crece hacia la derecha
    });

    $(document).on('mouseup.ciaSbResize', () => {
        if (!dragging) return;
        dragging = false;
        $sb.removeClass('is-resizing');
        document.body.classList.remove('cia-sidebar-resizing');
        ciaSaveSettings();
    });

    // Doble clic en el borde: vuelve al ancho por defecto.
    $handle.on('dblclick', () => {
        ciaApplySidebarWidth(CIA_SIDEBAR_DEFAULT);
        ciaSaveSettings();
    });
}

function ciaApplyUiTheme(theme) {
    CIA.uiTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', CIA.uiTheme);
    document.body.setAttribute('data-theme', CIA.uiTheme);
    // Mermaid no conoce el tema 'light': su equivalente claro es 'default'.
    if (window.mermaid) {
        mermaid.initialize({ startOnLoad: false, theme: CIA.uiTheme === 'light' ? 'default' : 'dark', securityLevel: 'strict' });
    }
    const $icon = $('#ciaThemeToggle i');
    if ($icon.length) {
        $icon.attr('data-lucide', CIA.uiTheme === 'dark' ? 'sun' : 'moon');
        if (window.lucide) lucide.createIcons();
    }
    ciaSaveSettings();
    // Los diagramas ya renderizados siguen el tema: se repintan al cambiarlo.
    if (CIA.history.length) ciaRenderThread();
}

/* ═══════════════════════ Selects ═══════════════════════ */
function ciaPopulateAgentSelect() {
    const $sel = $('#ciaAgentSelect').empty();
    Object.values(CIA_AGENTS).forEach(a => $sel.append(`<option value="${a.key}">${a.label}</option>`));
    $sel.val(CIA.agentKey);
}

function ciaPopulateModelSelect() {
    const $sel = $('#ciaModelSelect').empty();
    $sel.append('<option value="">— Default del proveedor —</option>');
    ciaModelCatalog().forEach(g => {
        const $grp = $(`<optgroup label="${g.group}"></optgroup>`);
        g.options.forEach(o => {
            const $opt = $(`<option value="${o.value}">${o.label}</option>`);
            if (o.tools) $opt.attr('data-tools', '1');   // tool-calling (igual que Lab/Visor)
            $grp.append($opt);
        });
        $sel.append($grp);
    });
    $sel.val(CIA.model || '');
}

function ciaApplyAgent(key, silent) {
    if (!CIA_AGENTS[key]) return;
    CIA.agentKey = key;
    // Personalidad del agente; si su .md no cargó, el backend usa el alma por defecto.
    CIA.systemOverride = CIA._agentPrompts[key] || '';
    if (!silent) { $('#ciaAgentSelect').val(key); ciaSaveSettings(); }
}

function ciaAgentLabel() {
    return (CIA_AGENTS[CIA.agentKey] || {}).label || 'CoffeeIA';
}

/* ═══════════════════════ Bindings ═══════════════════════ */
function ciaBind() {
    $('#ciaAgentSelect').on('change', e => ciaApplyAgent(e.target.value, false));
    $('#ciaModelSelect').on('change', e => { CIA.model = e.target.value || ''; ciaSaveSettings(); ciaWarnModelTools(); });
    $('#ciaThemeToggle').on('click', () => ciaApplyUiTheme(CIA.uiTheme === 'dark' ? 'light' : 'dark'));

    /* ── Menú "+" : todas las herramientas en un solo sitio (patrón Claude) ── */
    $('#ciaPlusBtn').on('click', e => {
        e.stopPropagation();
        ciaTogglePlusMenu(e.currentTarget);
    });

    // Acciones del menú. Los interruptores NO cierran el menú (se pueden encender
    // varios de una pasada); "Añadir archivos" sí, porque abre el diálogo del SO.
    $('#ciaPlusMenu').on('click', '[data-act]', e => {
        e.stopPropagation();
        const act = $(e.currentTarget).data('act');
        if (act === 'attach') {
            ciaClosePlusMenu();
            $('#ciaFileInput').trigger('click');
            return;
        }
        if (act === 'canvas') ciaToggleCanvasMode();
        if (act === 'db')     ciaToggleDbTools();
        if (act === 'fs')     ciaToggleFsTools();
    });

    // Submenú de gráficas: elegir un tipo lo activa; volver a elegirlo lo apaga.
    $('#ciaPlusMenu').on('click', '[data-graph]', e => {
        e.stopPropagation();
        ciaSetGraphMode($(e.currentTarget).data('graph'));
    });
    // El item padre ("Gráficas") abre/cierra el submenú al pulsarlo (para táctil;
    // en escritorio ya se despliega al pasar el ratón).
    $('#ciaPlusMenu').on('click', '.has-sub', e => {
        if ($(e.target).closest('[data-graph]').length) return;
        $(e.currentTarget).toggleClass('is-open');
    });

    $(document).on('click.ciaMenus', e => {
        if (!$(e.target).closest('#ciaPlusMenu, #ciaPlusBtn').length) ciaClosePlusMenu();
    });
    $(window).on('resize.ciaMenus scroll.ciaMenus', () => ciaClosePlusMenu());
    $(document).on('keydown.ciaMenus', e => { if (e.key === 'Escape') ciaClosePlusMenu(); });

    // Ctrl+U → adjuntar (el atajo que anuncia el propio menú).
    $(document).on('keydown.ciaAttach', e => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
            e.preventDefault();
            $('#ciaFileInput').trigger('click');
        }
    });

    $('#ciaNewBtn, #ciaNewSidebarBtn').on('click', () => ciaNewConversation());
    $('#ciaSearchInput').on('input', function () {
        CIA._filter = String($(this).val() || '').toLowerCase().trim();
        ciaRenderSidebar();
    });

    // Scroll pegajoso (patrón Visor): si el usuario sube a leer mientras la IA
    // escribe, no lo arrastramos de vuelta; aparece el botón de bajar al final.
    $('#ciaScrollDownBtn').on('click', () => ciaScrollBottom(true));
    $('#ciaBody').on('scroll', function () {
        const nearBottom = this.scrollTop + this.clientHeight >= this.scrollHeight - 48;
        CIA._stickBottom = nearBottom;
        $('#ciaScrollDownBtn').css('display', (!nearBottom && CIA.history.length) ? 'flex' : 'none');
    });

    $('#ciaSendBtn').on('click', () => { if (CIA.isBusy) ciaStop(); else ciaSubmit(); });
    $('#ciaInput').on('keydown', e => {
        // Con el menú @ abierto, él manda: ↑↓ navegan, Enter/Tab eligen, Esc cierra.
        // Así Enter completa la mención en vez de enviar el mensaje a medias.
        if (CIA._mentionOpen && ciaMentionKeydown(e)) return;
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            if (!CIA.isBusy) ciaSubmit();
        }
    }).on('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 180) + 'px';
        ciaMentionUpdate();
    }).on('click', () => ciaMentionUpdate())
      .on('blur', () => setTimeout(ciaMentionClose, 150));   // deja pasar el clic en el menú

    $(document).on('click.ciaMention', e => {
        if (!$(e.target).closest('#ciaMentionMenu, #ciaInput').length) ciaMentionClose();
    });
    $(window).on('resize.ciaMention', () => ciaMentionClose());

    $('#ciaRenameBtn').on('click', () => ciaOpenRenameModal());
    $('#ciaSaveBtn').on('click', () => ciaSaveConversation());
    $('#ciaDownloadBtn').on('click', () => ciaDownloadConversation());
    $('#ciaDeleteBtn').on('click', () => ciaOpenDeleteModal());

    $('#ciaRenameSave').on('click', () => ciaApplyRename());
    $('#ciaRenameCancel, #ciaRenameCancel2, #ciaRenameBackdrop').on('click', () => $('#ciaRenameModal').addClass('hidden'));
    $('#ciaRenameInput').on('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ciaApplyRename(); } });
    $('#ciaDeleteConfirm').on('click', () => ciaApplyDelete());
    $('#ciaDeleteCancel, #ciaDeleteCancel2, #ciaDeleteBackdrop').on('click', () => $('#ciaDeleteModal').addClass('hidden'));

    ciaBindAttachments();
    ciaBindSidebarResize();
    ciaBindViewer();
    ciaBindResponsive();
}

/* ═══════════════════════ Modos (lienzo / gráfica / tools) ═══════════════════════
 * Todo se opera desde el menú "+": los items marcan su estado con un check y el
 * propio botón "+" se resalta si hay algo encendido (así se ve de un vistazo que
 * el turno lleva herramientas activas, aunque el menú esté cerrado). */
function ciaApplyModeUI() {
    const anyOn = CIA.canvasMode || !!CIA.graphMode || CIA.dbToolsOn || CIA.fsToolsOn;

    $('#ciaPlusBtn').toggleClass('is-active', anyOn);
    const activos = [
        CIA.canvasMode && 'lienzo',
        CIA.graphMode  && (CIA_GRAPH_LABELS[CIA.graphMode] || CIA.graphMode),
        CIA.dbToolsOn  && 'base de datos',
        CIA.fsToolsOn  && 'archivos'
    ].filter(Boolean);
    $('#ciaPlusBtn').attr('title', activos.length
        ? 'Activo: ' + activos.join(' · ')
        : 'Herramientas y adjuntos');

    // Checks del menú.
    $('#ciaPlusMenu [data-act="canvas"]').toggleClass('is-on', CIA.canvasMode);
    $('#ciaPlusMenu [data-act="db"]').toggleClass('is-on', CIA.dbToolsOn);
    $('#ciaPlusMenu [data-act="fs"]').toggleClass('is-on', CIA.fsToolsOn);

    $('#ciaPlusMenu [data-graph]').each(function () {
        $(this).toggleClass('is-on', $(this).data('graph') === CIA.graphMode);
    });
    // El item padre "Gráficas" muestra el tipo elegido y se marca si hay alguno.
    $('#ciaPlusMenu .has-sub[data-sub="graph"]').toggleClass('is-on', !!CIA.graphMode);
    $('#ciaGraphDesc').text(CIA.graphMode
        ? (CIA_GRAPH_LABELS[CIA.graphMode] || CIA.graphMode) + ' — activo'
        : 'Mermaid · draw.io · Excalidraw');

    const $ta = $('#ciaInput');
    if (CIA.canvasMode)     $ta.attr('placeholder', 'Pide un componente UI (ej: "una card de producto con precio y botón")…');
    else if (CIA.graphMode) $ta.attr('placeholder', 'Describe el diagrama y la IA lo genera en ' + (CIA_GRAPH_LABELS[CIA.graphMode] || CIA.graphMode) + '…');
    else                    $ta.attr('placeholder', 'Pregunta lo que quieras…  (@ para conectar una base o carpeta · Enter envía)');
}

/* ── Menú "+" ── */
function ciaTogglePlusMenu(btnEl) {
    const $menu = $('#ciaPlusMenu');
    if ($menu.is(':visible')) { ciaClosePlusMenu(); return; }

    // Fixed sobre el botón, abriendo hacia arriba (el composer lo recortaría).
    $menu.css({ display: 'block', visibility: 'hidden', position: 'fixed', top: 0, left: 0 });
    const rect = btnEl.getBoundingClientRect();
    const mw = $menu.outerWidth(), mh = $menu.outerHeight(), gap = 8;
    let left = Math.max(8, Math.min(rect.left, window.innerWidth - mw - 8));
    let top  = rect.top - mh - gap;
    if (top < 8) top = rect.bottom + gap;   // sin sitio arriba: abre hacia abajo
    $menu.css({ left: left + 'px', top: top + 'px', visibility: 'visible' });

    $('#ciaPlusBtn').addClass('is-open').attr('aria-expanded', 'true');
    if (window.lucide) lucide.createIcons();
}

function ciaClosePlusMenu() {
    $('#ciaPlusMenu').hide().find('.has-sub').removeClass('is-open');
    $('#ciaPlusBtn').removeClass('is-open').attr('aria-expanded', 'false');
}

/* ── Interruptores de las tools de datos ── */
function ciaToggleDbTools() {
    CIA.dbToolsOn = !CIA.dbToolsOn;
    if (!CIA.dbToolsOn && CIA.activeDb) ciaSetActiveDb(null);
    ciaToast(CIA.dbToolsOn
        ? 'Base de datos activa: escribe @ para elegir una y conectarte'
        : 'Base de datos desactivada', 'info');
    if (CIA.dbToolsOn) ciaWarnModelTools();
    ciaSaveSettings();
    ciaApplyModeUI();
}

function ciaToggleFsTools() {
    CIA.fsToolsOn = !CIA.fsToolsOn;
    if (!CIA.fsToolsOn && CIA.activeFolder) ciaSetActiveFolder(null);
    ciaToast(CIA.fsToolsOn
        ? 'Archivos activo: escribe @ para elegir una carpeta y conectarte'
        : 'Archivos desactivado', 'info');
    if (CIA.fsToolsOn) ciaWarnModelTools();
    ciaSaveSettings();
    ciaApplyModeUI();
}

function ciaToggleCanvasMode() {
    CIA.canvasMode = !CIA.canvasMode;
    if (CIA.canvasMode && CIA.graphMode) CIA.graphMode = '';   // excluyentes
    ciaSaveSettings();
    ciaApplyModeUI();
}

function ciaSetGraphMode(type) {
    if (CIA_GRAPH_TYPES.indexOf(type) === -1) return;
    CIA.graphMode = (CIA.graphMode === type) ? '' : type;
    if (CIA.graphMode && CIA.canvasMode) CIA.canvasMode = false;   // excluyentes
    ciaSaveSettings();
    ciaApplyModeUI();
}

/* ═══════════════════════ Capacidades del modelo ═══════════════════════
 * Se derivan del <option> del selector (patrón Lab): "vision" en la etiqueta
 * y data-tools="1" para tool-calling. Así no hay listas paralelas que mantener. */
function ciaModelHasVision(model) {
    const m = model || CIA.model;
    if (!m) return false;
    const opt = document.querySelector(`#ciaModelSelect option[value="${m.replace(/"/g, '\\"')}"]`);
    return !!opt && /vision/i.test(opt.textContent || '');
}

function ciaModelSupportsTools(model) {
    const m = model || CIA.model;
    if (!m) return true;   // sin modelo explícito decide el backend
    const opt = document.querySelector(`#ciaModelSelect option[value="${m.replace(/"/g, '\\"')}"]`);
    return !opt || opt.getAttribute('data-tools') === '1';
}

function ciaWarnModelTools() {
    if (!CIA.dbToolsOn && !CIA.fsToolsOn) return;
    if (ciaModelSupportsTools(CIA.model)) return;
    const target = CIA.activeDb ? `la base conectada ("${CIA.activeDb}")`
                 : CIA.activeFolder ? 'la carpeta conectada' : 'bases de datos y carpetas';
    ciaToast(`Este modelo puede no soportar consultas en vivo (tools): ${target} podría no leerse. Para datos reales usa GLM, Qwen3 Coder o Kimi.`, 'warn');
}

/* ═══════════════════════ Conexiones pegajosas (BD / carpeta) ═══════════════════════ */
function ciaSetActiveDb(schema) {
    const next = schema || null;
    const changed = next !== CIA.activeDb;
    CIA.activeDb = next;
    ciaRenderDbChip();
    if (changed && next) { ciaToast('🛢 Conectado a la base ' + next, 'success'); ciaWarnModelTools(); }
}

function ciaRenderDbChip() {
    const $chip = $('#ciaDbChip');
    if (!CIA.activeDb) { $chip.hide().empty(); return; }
    $chip.html(`
        <i data-lucide="database" class="w-3 h-3"></i>
        <span class="ia-db-chip-name" title="Base conectada: ${ciaEscape(CIA.activeDb)}">${ciaEscape(CIA.activeDb)}</span>
        <button type="button" class="ia-db-chip-x" title="Desconectar de la base"><i data-lucide="x" class="w-3 h-3"></i></button>
    `).show();
    $chip.find('.ia-db-chip-x').on('click', () => { ciaSetActiveDb(null); ciaToast('Desconectado de la base', 'info'); });
    if (window.lucide) lucide.createIcons();
}

function ciaSetActiveFolder(path) {
    const next = path || null;
    const changed = next !== CIA.activeFolder;
    CIA.activeFolder = next;
    ciaRenderFolderChip();
    if (changed && next) {
        const fname = String(next).replace(/[\/\\]+$/, '').split(/[\/\\]/).pop();
        ciaToast('📁 Conectado a la carpeta ' + fname, 'success');
        ciaWarnModelTools();
    }
}

function ciaRenderFolderChip() {
    const $chip = $('#ciaFolderChip');
    if (!CIA.activeFolder) { $chip.hide().empty(); return; }
    const name = String(CIA.activeFolder).replace(/[\/\\]+$/, '').split(/[\/\\]/).pop();
    $chip.html(`
        <i data-lucide="folder-open" class="w-3 h-3"></i>
        <span class="ia-db-chip-name" title="Carpeta conectada: ${ciaEscape(CIA.activeFolder)}">${ciaEscape(name)}</span>
        <button type="button" class="ia-db-chip-x" title="Desconectar de la carpeta"><i data-lucide="x" class="w-3 h-3"></i></button>
    `).show();
    $chip.find('.ia-db-chip-x').on('click', () => { ciaSetActiveFolder(null); ciaToast('Desconectado de la carpeta', 'info'); });
    if (window.lucide) lucide.createIcons();
}

/* ═══════════════════════ Menciones "@" ═══════════════════════
 * Escribe @ en el input y sale un menú para elegir una BASE DE DATOS o una
 * CARPETA. Al elegirla se enciende la tool correspondiente y se fija la conexión
 * pegajosa, sin tener que "nombrarla" en prosa y esperar a que el backend la
 * adivine.
 *
 * Por qué importa en las carpetas: el catálogo manda la RUTA ABSOLUTA, así que
 * la conexión es exacta. Nombrarlas por texto es ambiguo — en este equipo hay 14
 * carpetas llamadas "costsys" — y ahí es donde el backend tiene que preguntar
 * cuál era. Eligiéndola del menú, no hay nada que adivinar. */

const CIA_API_MENTIONS = 'ctrl/ctrl-mentions.php';

// Catálogo (bases + carpetas). Se pide UNA vez, al primer @, y se cachea.
async function ciaLoadMentions() {
    if (CIA._mentions) return CIA._mentions;
    if (CIA._mentionsPromise) return CIA._mentionsPromise;

    CIA._mentionsPromise = (async () => {
        try {
            const res  = await fetch(CIA_API_MENTIONS, { cache: 'no-store' });
            const data = await res.json();
            const roots = data.roots || [];
            const items = [];

            // Las bases llevan prefijo de hosting ("fayxzvov_reginas"), así que buscar
            // "reginas" nunca daría match exacto y la base quedaría enterrada bajo las
            // carpetas. Se indexan sus ALIAS (lo que va tras el 1er y el último "_"),
            // el mismo criterio que usa el backend en db_schema_aliases().
            (data.dbs || []).forEach(name => {
                const aliases = [name.toLowerCase()];
                const i = name.indexOf('_'), j = name.lastIndexOf('_');
                if (i !== -1) aliases.push(name.slice(i + 1).toLowerCase());
                if (j !== -1 && j !== i) aliases.push(name.slice(j + 1).toLowerCase());
                items.push({ kind: 'db', name: name, hint: 'base de datos', value: name, aliases: aliases });
            });

            // Payload compacto: { r: índice de raíz, p: ruta relativa }.
            (data.folders || []).forEach(f => {
                const rel  = f.p || '';
                const name = rel.split('/').pop();
                items.push({
                    kind:  'fs',
                    name:  name,
                    hint:  rel,                                   // distingue homónimos a simple vista
                    value: (roots[f.r] || '') + '/' + rel         // ruta exacta: sin ambigüedad
                });
            });

            if (data.dbs_error) console.warn('menciones (bases):', data.dbs_error);
            CIA._mentions = items;
            return items;
        } catch (err) {
            console.error('ciaLoadMentions:', err);
            CIA._mentions = [];
            return [];
        } finally {
            CIA._mentionsPromise = null;
        }
    })();

    return CIA._mentionsPromise;
}

// ¿El caret está justo después de un "@algo" sin cerrar? Devuelve la consulta y
// dónde empieza el "@" (para sustituirlo al elegir).
function ciaMentionContext() {
    const el = document.getElementById('ciaInput');
    if (!el) return null;
    const pos    = el.selectionStart;
    const before = el.value.slice(0, pos);
    const m = before.match(/(?:^|\s)@([\w.\-\/\\]*)$/);
    if (!m) return null;
    return { query: m[1], start: pos - m[1].length - 1 };
}

// Ranking: exacto > empieza por > contiene > la ruta contiene. En las bases se
// puntúan también sus alias, así "reginas" encuentra "fayxzvov_reginas". A igual
// puntuación las bases van primero (son pocas y es el caso más buscado); las
// carpetas homónimas se desempatan a ojo por la ruta que se muestra al lado.
function ciaFilterMentions(items, query) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return items.slice(0, 40);

    const scoreOf = (text) => {
        if (!text) return -1;
        if (text === q)             return 0;
        if (text.startsWith(q))     return 1;
        if (text.indexOf(q) !== -1) return 2;
        return -1;
    };

    const scored = [];
    items.forEach(it => {
        let score = scoreOf(it.name.toLowerCase());
        (it.aliases || []).forEach(a => {
            const s = scoreOf(a);
            if (s !== -1 && (score === -1 || s < score)) score = s;
        });
        // Último recurso: la consulta aparece en la ruta ("GrupoVaroch/…").
        if (score === -1 && (it.hint || '').toLowerCase().indexOf(q) !== -1) score = 3;
        if (score >= 0) scored.push({ it, score });
    });

    scored.sort((a, b) =>
        (a.score - b.score) ||
        ((a.it.kind === 'db' ? 0 : 1) - (b.it.kind === 'db' ? 0 : 1)) ||
        (a.it.name.length - b.it.name.length)
    );
    return scored.slice(0, 40).map(s => s.it);
}

async function ciaMentionUpdate() {
    const ctx = ciaMentionContext();
    if (!ctx) { ciaMentionClose(); return; }

    const all = await ciaLoadMentions();

    // El caret pudo moverse mientras cargaba el catálogo: revalidar.
    const fresh = ciaMentionContext();
    if (!fresh) { ciaMentionClose(); return; }

    const items = ciaFilterMentions(all, fresh.query);
    if (!items.length) { ciaMentionClose(); return; }

    CIA._mentionCtx   = fresh;
    CIA._mentionItems = items;
    CIA._mentionIdx   = 0;
    ciaMentionRender();
}

function ciaMentionRender() {
    const $menu = $('#ciaMentionMenu');
    if (!$menu.length) return;

    $menu.html(CIA._mentionItems.map((it, i) => `
        <button type="button" class="cia-mention-item${i === CIA._mentionIdx ? ' is-active' : ''}" data-idx="${i}">
            <i data-lucide="${it.kind === 'db' ? 'database' : 'folder'}"></i>
            <span class="cia-mention-name">${ciaEscape(it.name)}</span>
            <span class="cia-mention-hint">${ciaEscape(it.hint)}</span>
        </button>`).join('')).show();

    CIA._mentionOpen = true;

    // mousedown (no click): el clic no debe robarle el foco al textarea.
    $menu.find('.cia-mention-item').on('mousedown', e => {
        e.preventDefault();
        ciaMentionApply(CIA._mentionItems[$(e.currentTarget).data('idx')]);
    });

    ciaMentionPosition();
    if (window.lucide) lucide.createIcons();
}

// Menú FIXED sobre el input (abre hacia arriba) para que el composer no lo recorte.
function ciaMentionPosition() {
    const $menu = $('#ciaMentionMenu');
    const el = document.getElementById('ciaInput');
    if (!$menu.length || !el) return;
    const rect = el.getBoundingClientRect();
    const mh   = $menu.outerHeight();
    let top = rect.top - mh - 8;
    if (top < 8) top = rect.bottom + 8;   // sin sitio arriba: abre hacia abajo
    $menu.css({
        position: 'fixed',
        left:  Math.max(8, rect.left) + 'px',
        top:   top + 'px',
        width: Math.min(rect.width, 560) + 'px'
    });
}

function ciaMentionKeydown(e) {
    const items = CIA._mentionItems || [];
    if (!items.length) return false;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        CIA._mentionIdx = (CIA._mentionIdx + 1) % items.length;
        ciaMentionHighlight();
        return true;
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        CIA._mentionIdx = (CIA._mentionIdx - 1 + items.length) % items.length;
        ciaMentionHighlight();
        return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        ciaMentionApply(items[CIA._mentionIdx]);
        return true;
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        ciaMentionClose();
        return true;
    }
    return false;
}

function ciaMentionHighlight() {
    const $items = $('#ciaMentionMenu .cia-mention-item').removeClass('is-active');
    const $active = $items.eq(CIA._mentionIdx).addClass('is-active');
    if ($active.length && $active[0].scrollIntoView) $active[0].scrollIntoView({ block: 'nearest' });
}

// Elegir del menú = CONECTAR: enciende la tool y fija la conexión pegajosa. En
// carpetas viaja la ruta absoluta, así que da igual cuántas homónimas existan.
function ciaMentionApply(item) {
    const el  = document.getElementById('ciaInput');
    const ctx = CIA._mentionCtx;
    if (!item || !el || !ctx) { ciaMentionClose(); return; }

    // Sustituye el "@loquesea" a medio escribir por "@nombre ". El token cierra con
    // un espacio, así que se comen los espacios que ya hubiera justo detrás: si no,
    // elegir a media frase dejaba doble espacio ("usa @costsys  y explícame"). Los
    // saltos de línea no se tocan.
    const before = el.value.slice(0, ctx.start);
    const after  = el.value.slice(el.selectionStart).replace(/^[ \t]+/, '');
    const token  = '@' + item.name + ' ';
    el.value = before + token + after;
    const caret = (before + token).length;
    el.setSelectionRange(caret, caret);

    if (item.kind === 'db') {
        CIA.dbToolsOn = true;
        ciaSetActiveDb(item.value);
    } else {
        CIA.fsToolsOn = true;
        ciaSetActiveFolder(item.value);
    }
    ciaSaveSettings();
    ciaApplyModeUI();
    ciaWarnModelTools();

    ciaMentionClose();
    $(el).trigger('input');   // recalcula el alto
    el.focus();
}

function ciaMentionClose() {
    CIA._mentionOpen  = false;
    CIA._mentionItems = [];
    CIA._mentionIdx   = 0;
    CIA._mentionCtx   = null;
    $('#ciaMentionMenu').hide().empty();
}

/* ═══════════════════════ Adjuntos ═══════════════════════ */
const CIA_TEXT_EXTS = [
    'txt','md','markdown','rtf','log','csv','tsv','html','htm','xml','svg','json','json5',
    'yaml','yml','toml','ini','env','conf','js','mjs','cjs','ts','jsx','tsx','css','scss','less',
    'php','py','rb','go','rs','java','kt','c','h','cpp','cs','swift','sql','sh','bash','ps1','bat','vue','astro'
];

function ciaIsTextFile(file) {
    if (!file) return false;
    const ext = (file.name || '').split('.').pop().toLowerCase();
    if (CIA_TEXT_EXTS.indexOf(ext) !== -1) return true;
    return /^(text\/|application\/(json|xml|javascript|x-yaml|x-sh|sql)|image\/svg)/i.test(file.type || '');
}

function ciaBindAttachments() {
    // Adjuntar se dispara desde el menú "+" (o con Ctrl+V / arrastrar / Ctrl+U).
    $('#ciaFileInput').on('change', e => {
        Array.from(e.target.files || []).forEach(f => ciaAddFile(f));
        e.target.value = '';
    });

    // Pegar (Ctrl+V) imágenes/archivos de texto; el texto normal se pega como siempre.
    $(document).on('paste', e => {
        if (e.target && e.target.id === 'ciaRenameInput') return;
        const cd = e.originalEvent && e.originalEvent.clipboardData;
        if (!cd) return;
        let pasted = 0;
        (cd.items ? Array.from(cd.items) : []).forEach(it => {
            if (it.kind !== 'file') return;
            const f = it.getAsFile();
            if (f) { ciaAddFile(f); pasted++; }
        });
        if (!pasted && cd.files && cd.files.length) {
            Array.from(cd.files).forEach(f => { ciaAddFile(f); pasted++; });
        }
        if (pasted) {
            e.preventDefault();
            ciaToast(pasted === 1 ? 'Adjunto pegado' : pasted + ' adjuntos pegados', 'success');
        }
    });

    const $wrap = $('.ia-input-wrap');
    $wrap.on('dragover', e => { e.preventDefault(); $wrap.addClass('is-drag-over'); });
    $wrap.on('dragleave drop', () => $wrap.removeClass('is-drag-over'));
    $wrap.on('drop', e => {
        e.preventDefault();
        const dt = e.originalEvent && e.originalEvent.dataTransfer;
        if (!dt) return;
        const files = dt.files && dt.files.length ? Array.from(dt.files)
            : (dt.items ? Array.from(dt.items).filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean) : []);
        files.forEach(f => ciaAddFile(f));
        if (files.length) ciaToast(files.length === 1 ? 'Adjunto agregado' : files.length + ' adjuntos agregados', 'success');
    });
}

function ciaAddFile(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { ciaToast('Archivo demasiado grande (>8MB)', 'error'); return; }
    if (/^image\//.test(file.type)) {
        const reader = new FileReader();
        reader.onload = ev => { CIA.pendingImages.push({ name: file.name, dataUrl: ev.target.result }); ciaRenderAttachments(); };
        reader.readAsDataURL(file);
    } else if (ciaIsTextFile(file)) {
        const reader = new FileReader();
        reader.onload = ev => { CIA.pendingDocs.push({ name: file.name, size: file.size, content: ev.target.result }); ciaRenderAttachments(); };
        reader.readAsText(file);
    } else {
        ciaToast('Formato no soportado: ' + (file.name || 'archivo') + ' (solo imágenes y texto)', 'error');
    }
}

function ciaRenderAttachments() {
    const $strip = $('#ciaImageStrip').empty();
    CIA.pendingImages.forEach((img, i) => {
        const $chip = $(`<div class="ia-img-chip"><img src="${img.dataUrl}" alt=""><span>${ciaEscape(img.name)}</span><i data-lucide="x" class="cursor-pointer"></i></div>`);
        $chip.find('i').on('click', () => { CIA.pendingImages.splice(i, 1); ciaRenderAttachments(); });
        $strip.append($chip);
    });
    CIA.pendingDocs.forEach((doc, i) => {
        const $chip = $(`<div class="ia-img-chip"><i data-lucide="file-text" class="w-3.5 h-3.5"></i><span>${ciaEscape(doc.name)}</span><i data-lucide="x" class="cursor-pointer"></i></div>`);
        $chip.find('i[data-lucide="x"]').on('click', () => { CIA.pendingDocs.splice(i, 1); ciaRenderAttachments(); });
        $strip.append($chip);
    });
    const n = CIA.pendingImages.length + CIA.pendingDocs.length;
    $strip.toggle(n > 0);
    $('#ciaContextInfo').text(n ? (n + ' adjunto' + (n === 1 ? '' : 's')) : '');
    if (window.lucide) lucide.createIcons();
}

/* ═══════════════════════ Hilo: render de mensajes ═══════════════════════
 * MARKUP DEL VISOR, literal: .ia-msg / .ia-msg-role / .ia-msg-text dentro de
 * un .ia-drawer-body. visor.css los estiliza y anima; no reimplementamos nada. */

function ciaThread() {
    let $t = $('#ciaBody .cia-thread');
    if (!$t.length) {
        $t = $('<div class="cia-thread"></div>');
        $('#ciaBody').empty().append($t);
    }
    return $t;
}

// Re-render completo (abrir conversación, cambiar tema). En el flujo normal de
// chat los mensajes se AÑADEN al hilo: la burbuja en streaming se cierra en su
// sitio, como en el Visor, sin repintar todo (eso rompía la animación).
function ciaRenderThread() {
    $('#ciaCurrentTitle').text(CIA.currentTitle);

    // Los templates se re-registran al repintar los mensajes (cada burbuja los
    // vuelve a extraer), así que aquí se parte de cero: si no, cambiar de tema
    // duplicaría todas las versiones del visor.
    const wasOpen = CIA.viewerOpen;
    const prevIdx = CIA.viewerIdx;
    CIA.templates = [];

    const $body = $('#ciaBody').empty();
    if (!CIA.history.length) {
        $body.append(ciaEmptyHtml());
        // El grano de la marca (SVG del header) también preside el estado vacío.
        $body.find('.cia-empty-orb').append($('.cia-logo svg').first().clone());
        $('.cia-suggestion').on('click', function () {
            $('#ciaInput').val($(this).data('prompt') || $(this).text()).trigger('input').trigger('focus');
        });
        ciaSyncViewer(wasOpen, prevIdx);
        if (window.lucide) lucide.createIcons();
        return;
    }
    const $t = ciaThread();
    CIA.history.forEach((m, i) => {
        // En la burbuja va SOLO el texto que escribió el usuario: el content
        // lleva además los documentos adjuntos embebidos (contexto del modelo).
        if (m.role === 'user') ciaAppendUserMessage(m.displayText != null ? m.displayText : m.content, m.imagesPreview, m.docsMeta);
        else                   ciaAppendAIMessage(m.content, m.meta, i);
    });
    ciaSyncViewer(wasOpen, prevIdx);
    if (window.lucide) lucide.createIcons();
    ciaScrollBottom(true);
    return $t;
}

function ciaEmptyHtml() {
    return `
        <div class="cia-empty">
            <div class="cia-empty-orb"></div>
            <div class="cia-empty-wordmark">Coffee<span>IA</span></div>
            <div class="cia-empty-sub">Pregunta lo que quieras. Adjunta imágenes o documentos, conecta una base de datos o una carpeta, y activa el lienzo para que la respuesta se convierta en un componente.</div>
            <div class="cia-suggestions">
                <button class="cia-suggestion" data-prompt="¿Qué puedes hacer?">¿Qué puedes hacer?</button>
                <button class="cia-suggestion" data-prompt="Explícame la arquitectura de CoffeeSoft">Arquitectura CoffeeSoft</button>
                <button class="cia-suggestion" data-prompt="Dibuja un diagrama de flujo del proceso de venta">Diagrama de un flujo</button>
                <button class="cia-suggestion" data-prompt="Diseña una card de producto con precio y botón">Diseña un componente</button>
            </div>
        </div>`;
}

function ciaAppendUserMessage(text, images, docsMeta) {
    let imgsHtml = '';
    if (Array.isArray(images) && images.length) {
        imgsHtml = '<div class="ia-msg-imgs">' +
            images.map(u => `<img src="${u}" alt="imagen adjunta" loading="lazy">`).join('') + '</div>';
    }
    let docsHtml = '';
    if (Array.isArray(docsMeta) && docsMeta.length) {
        const fmtKb = b => b >= 1024 ? (b / 1024).toFixed(b >= 10240 ? 0 : 1) + ' KB' : (b || 0) + ' B';
        docsHtml = '<div class="ia-msg-docs">' + docsMeta.map(d => `
            <span class="ia-msg-doc-chip" title="${ciaEscape(d.name)}${d.size ? ' (' + fmtKb(d.size) + ')' : ''}">
                <i data-lucide="file-text"></i><span>${ciaEscape(d.name)}</span>
            </span>`).join('') + '</div>';
    }
    const textHtml = text ? `<p>${ciaEscape(text)}</p>` : '';
    const $msg = $(`<div class="ia-msg user"><div class="ia-msg-text">${imgsHtml}${docsHtml}${textHtml}</div></div>`);
    $msg.find('.ia-msg-imgs img').on('click', function () {
        const src = $(this).attr('src');
        if (src) window.open(src, '_blank');
    });
    ciaThread().append($msg);
    if (window.lucide) lucide.createIcons();
}

function ciaAppendAIMessage(text, meta, idx) {
    const $msg = $(`
        <div class="ia-msg ai">
            <div class="ia-msg-role"><span class="dot"></span><span>${ciaEscape(ciaAgentLabel())}</span></div>
            <div class="ia-msg-text">${IARender.markdownToHtml(text || '')}</div>
        </div>`);
    ciaThread().append($msg);
    if (meta) ciaAttachMetaFooter($msg, meta, text || '', idx);
    IARender.postProcess($msg.find('.ia-msg-text'));
    ciaHookTemplates($msg.find('.ia-msg-text'), { msgIdx: idx });
    if (window.lucide) lucide.createIcons();
    return $msg;
}

/* Pie de metadatos (criterio del Visor): prioriza el COSTO REAL en USD que
 * reporta OpenRouter; sin costo (Ollama) cae a los "Credits" estimados. Suma
 * tokens in/out, tiempo, el aviso de tools_fallback del Lab y las acciones. */
function ciaMetaItems(meta) {
    if (!meta) return '';
    let out = '';
    if (meta.cost != null && !isNaN(meta.cost)) {
        const c = Number(meta.cost);
        const txt = (c === 0 || c >= 0.0001) ? '$' + c.toFixed(4) : '<$0.0001';
        out += `<span class="meta-item" title="Costo real de OpenRouter (USD)"><span class="dot"></span>Costo: <strong>${txt}</strong></span>`;
    } else if (meta.credits != null) {
        out += `<span class="meta-item" title="Estimación por tokens de salida"><span class="dot"></span>Credits: <strong>${meta.credits}</strong></span>`;
    }
    if (meta.promptTokens != null || meta.completionTokens != null) {
        const fmt = n => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n || 0));
        out += `<span class="meta-item" title="Tokens entrada / salida">Tokens: <strong>${fmt(meta.promptTokens)} in / ${fmt(meta.completionTokens)} out</strong></span>`;
    }
    if (meta.elapsed_ms > 0) out += `<span class="meta-item">Time: <strong>${(meta.elapsed_ms / 1000).toFixed(1)}s</strong></span>`;
    if (meta.toolsFallback) {
        out += `<span class="meta-item cia-meta-warn" title="${ciaEscape(meta.toolsFallback)}"><i data-lucide="triangle-alert"></i>sin datos en vivo</span>`;
    }
    return out;
}

function ciaAttachMetaFooter($msg, meta, copyText, idx) {
    const $footer = $(`
        <div class="ia-msg-meta-footer">
            ${ciaMetaItems(meta)}
            <span class="meta-actions">
                <button class="meta-iconbtn cia-regen-btn" title="Regenerar respuesta"><i data-lucide="refresh-cw" class="w-3 h-3"></i></button>
                <button class="meta-iconbtn cia-savefile-btn" title="Guardar respuesta como archivo"><i data-lucide="file-down" class="w-3 h-3"></i></button>
                <button class="meta-iconbtn cia-copy-btn" title="Copiar respuesta"><i data-lucide="copy" class="w-3 h-3"></i></button>
            </span>
        </div>`);
    $footer.find('.cia-copy-btn').on('click', () => {
        if (navigator.clipboard) navigator.clipboard.writeText(copyText);
        ciaToast('Respuesta copiada', 'success');
    });
    $footer.find('.cia-savefile-btn').on('click', () => {
        IARender.downloadText(ciaSuggestFileName(copyText), copyText);
        ciaToast('Respuesta descargada', 'success');
    });
    $footer.find('.cia-regen-btn').on('click', () => ciaRegenerate(idx != null ? idx : CIA.history.length - 1));
    $msg.append($footer);
}

/* ═══════════════════════ Visor de templates (patrón Artifacts) ═══════════════════════
 * La miniatura inline del bloque ```html se queda EXACTAMENTE como estaba (la
 * monta IARender.postProcess: vista previa en iframe, código y expandir). Esto
 * solo AÑADE una salida más: el botón "Visor" de su barra abre el template en
 * grande —panel a la derecha en escritorio, ventana flotante en móvil— sin
 * quitarle nada a la burbuja.
 *
 * Cada template de la conversación queda registrado como una VERSIÓN, así que
 * desde el visor se puede volver a la anterior sin rebuscar en el hilo. */

// Título del template: lo que el propio HTML declare (<title>, primer <h1> o un
// comentario de cabecera). Sin nada de eso, un nombre genérico.
function ciaTemplateTitle(code) {
    const html = String(code || '');
    const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (t && t[1].trim()) return t[1].trim().slice(0, 60);
    const h = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h) {
        const txt = h[1].replace(/<[^>]+>/g, '').trim();
        if (txt) return txt.slice(0, 60);
    }
    const c = html.match(/^\s*<!--\s*([^\n-]{3,60}?)\s*-->/);
    if (c) return c[1].trim();
    return 'Componente HTML';
}

// Registra una versión. Si el HTML es idéntico al último (repintado del hilo,
// regeneración que devuelve lo mismo), reutiliza esa versión en vez de duplicarla.
function ciaRegisterTemplate(code, msgIdx) {
    const clean = String(code || '').trim();
    if (!clean) return -1;
    const last = CIA.templates[CIA.templates.length - 1];
    if (last && last.code === clean) return CIA.templates.length - 1;
    CIA.templates.push({ code: clean, title: ciaTemplateTitle(clean), msgIdx: msgIdx });
    return CIA.templates.length - 1;
}

// Engancha las miniaturas ya renderizadas. Se llama DESPUÉS de postProcess: los
// bloques .ia-render-html ya existen con su vista previa, y aquí solo se les suma
// el botón que los manda al visor. La miniatura no se toca.
function ciaHookTemplates($text, opts) {
    opts = opts || {};
    let lastIdx = -1;
    $text.find('.ia-render-block[data-render-type="html"]').each(function () {
        const $block = $(this);
        if ($block.data('cia-hooked')) return;      // repintado: no duplicar el botón
        $block.data('cia-hooked', true);

        const idx = ciaRegisterTemplate($block.find('.ia-render-source').text(), opts.msgIdx);
        if (idx < 0) return;
        lastIdx = idx;

        const $btn = $(`
            <button class="ia-render-btn cia-render-side" title="Verlo en grande (a la derecha)">
                <i data-lucide="panel-right" class="w-3 h-3"></i>Visor
            </button>`);
        $btn.on('click', () => ciaOpenViewer(idx));

        // Antes de "Expandir": las dos son formas de verlo en grande, juntas.
        const $expand = $block.find('.ia-render-expand');
        if ($expand.length) $expand.before($btn);
        else                $block.find('.ia-render-tabs').append($btn);
    });
    ciaUpdateViewerBtn();
    if (window.lucide) lucide.createIcons();
    return lastIdx;
}

/* ── Abrir / cerrar ── */
function ciaOpenViewer(idx) {
    if (!CIA.templates.length) return;
    const n = CIA.templates.length;
    CIA.viewerIdx  = Math.max(0, Math.min(n - 1, idx == null ? n - 1 : idx));
    CIA.viewerOpen = true;
    $('.cia-workspace').addClass('is-viewer-open');
    $('#ciaViewer').attr('aria-hidden', 'false');
    ciaRenderViewer();
    ciaUpdateViewerBtn();
}

function ciaCloseViewer() {
    CIA.viewerOpen = false;
    $('.cia-workspace').removeClass('is-viewer-open is-viewer-max');
    $('#ciaViewer').attr('aria-hidden', 'true');
    $('#ciaViewerFrame').removeAttr('srcdoc');   // suelta el sandbox al cerrar
    ciaSetViewerMaxIcon(false);
    ciaUpdateViewerBtn();
}

function ciaToggleViewer() {
    if (CIA.viewerOpen) ciaCloseViewer();
    else                ciaOpenViewer(CIA.viewerIdx);
}

// Tras repintar el hilo: si ya no quedan templates, el visor se cierra; si estaba
// abierto, se reabre en la misma versión (acotada, por si el hilo se cortó).
function ciaSyncViewer(wasOpen, prevIdx) {
    if (!CIA.templates.length) {
        if (wasOpen) ciaCloseViewer();
        else         ciaUpdateViewerBtn();
        CIA.viewerIdx = -1;
        return;
    }
    if (wasOpen) ciaOpenViewer(Math.min(prevIdx < 0 ? CIA.templates.length - 1 : prevIdx, CIA.templates.length - 1));
    else         ciaUpdateViewerBtn();
}

function ciaUpdateViewerBtn() {
    $('#ciaViewerBtn')
        .toggle(CIA.templates.length > 0)
        .toggleClass('is-active', CIA.viewerOpen)
        .attr('title', CIA.viewerOpen ? 'Ocultar el visor de templates' : 'Mostrar el visor de templates');
}

/* ── Pintado del visor ── */
function ciaRenderViewer() {
    const t = CIA.templates[CIA.viewerIdx];
    if (!t) return;

    $('#ciaViewerName').text(t.title).attr('title', t.title);

    // El sandbox del iframe lo arma IARender: mismo saneado, mismo tema y mismas
    // libs (Tailwind, ui-kit, Lucide) que la vista previa del Visor.
    $('#ciaViewerFrame').attr('srcdoc', window.IARender && IARender.buildHtmlSrcdoc
        ? IARender.buildHtmlSrcdoc(t.code, { padding: 16 })
        : t.code);

    const el = document.querySelector('#ciaViewerCode code');
    if (el) {
        el.textContent = t.code;
        el.className = 'language-html';
        delete el.dataset.highlighted;   // sin esto hljs 11 se niega a repintar
        if (window.hljs) { try { hljs.highlightElement(el); } catch (_) { /* noop */ } }
    }

    const n = CIA.templates.length;
    $('#ciaViewerVersions').toggle(n > 1);
    $('#ciaViewerVer').text((CIA.viewerIdx + 1) + '/' + n);
    $('#ciaViewerPrev').prop('disabled', CIA.viewerIdx === 0);
    $('#ciaViewerNext').prop('disabled', CIA.viewerIdx === n - 1);

    ciaSetViewerTab(CIA.viewerTab);
    if (window.lucide) lucide.createIcons();
}

function ciaSetViewerTab(tab) {
    CIA.viewerTab = tab === 'code' ? 'code' : 'preview';
    $('.cia-viewer-tab').removeClass('is-active')
        .filter(`[data-tab="${CIA.viewerTab}"]`).addClass('is-active');
    $('#ciaViewerFrame').toggle(CIA.viewerTab === 'preview');
    $('#ciaViewerCode').toggle(CIA.viewerTab === 'code');
}

function ciaViewerStep(delta) {
    if (!CIA.templates.length) return;
    const next = CIA.viewerIdx + delta;
    if (next < 0 || next >= CIA.templates.length) return;
    CIA.viewerIdx = next;
    ciaRenderViewer();
}

function ciaSetViewerMaxIcon(on) {
    $('#ciaViewerMax')
        .attr('title', on ? 'Restaurar' : 'Maximizar')
        .html(`<i data-lucide="${on ? 'minimize-2' : 'maximize-2'}" class="w-3.5 h-3.5"></i>`);
    if (window.lucide) lucide.createIcons();
}

// Abrir en pestaña: el mismo documento del sandbox, servido como blob.
function ciaViewerOpenTab() {
    const t = CIA.templates[CIA.viewerIdx];
    if (!t) return;
    const doc = window.IARender && IARender.buildHtmlSrcdoc
        ? IARender.buildHtmlSrcdoc(t.code, { padding: 16 })
        : t.code;
    const url = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ── Ancho ajustable (solo escritorio: en móvil es una ventana flotante) ── */
function ciaApplyViewerWidth(px) {
    const w = Math.min(CIA_VIEWER_MAX, Math.max(CIA_VIEWER_MIN, Number(px) || CIA_VIEWER_DEFAULT));
    const el = document.querySelector('.cia-viewer');
    if (el) el.style.setProperty('--cia-viewer-w', w + 'px');
    CIA.viewerWidth = w;
    return w;
}

function ciaBindViewer() {
    $('#ciaViewerBtn').on('click', e => { e.stopPropagation(); ciaToggleViewer(); });
    $('#ciaViewerClose').on('click', () => ciaCloseViewer());
    $('#ciaViewerPrev').on('click', () => ciaViewerStep(-1));
    $('#ciaViewerNext').on('click', () => ciaViewerStep(1));
    $('#ciaViewer').on('click', '.cia-viewer-tab', function () { ciaSetViewerTab($(this).data('tab')); });

    $('#ciaViewerMax').on('click', () => {
        const on = !$('.cia-workspace').hasClass('is-viewer-max');
        $('.cia-workspace').toggleClass('is-viewer-max', on);
        ciaSetViewerMaxIcon(on);
    });

    $('#ciaViewerReload').on('click', () => { ciaRenderViewer(); ciaToast('Vista previa recargada', 'info'); });
    $('#ciaViewerNewTab').on('click', () => ciaViewerOpenTab());
    $('#ciaViewerCopy').on('click', () => {
        const t = CIA.templates[CIA.viewerIdx];
        if (!t) return;
        if (navigator.clipboard) navigator.clipboard.writeText(t.code);
        ciaToast('HTML copiado', 'success');
    });
    $('#ciaViewerDownload').on('click', () => {
        const t = CIA.templates[CIA.viewerIdx];
        if (!t) return;
        IARender.downloadText((ciaSlugify(t.title) || 'template') + '.html', t.code);
        ciaToast('Template descargado', 'success');
    });

    $(document).on('keydown.ciaViewer', e => {
        if (e.key === 'Escape' && CIA.viewerOpen) ciaCloseViewer();
    });

    // Arrastre del borde IZQUIERDO: el panel crece hacia la izquierda, así que el
    // ancho sube cuando el ratón baja en X. Solo se persiste al soltar.
    const $handle = $('#ciaViewerResize');
    let dragging = false, startX = 0, startW = CIA.viewerWidth;

    $handle.on('mousedown', e => {
        if (ciaIsMobile()) return;
        e.preventDefault();
        dragging = true;
        startX = e.clientX;
        startW = CIA.viewerWidth;
        $('#ciaViewer').addClass('is-resizing');
        document.body.classList.add('cia-sidebar-resizing');
    });
    $(document).on('mousemove.ciaViewerResize', e => {
        if (!dragging) return;
        ciaApplyViewerWidth(startW - (e.clientX - startX));
    });
    $(document).on('mouseup.ciaViewerResize', () => {
        if (!dragging) return;
        dragging = false;
        $('#ciaViewer').removeClass('is-resizing');
        document.body.classList.remove('cia-sidebar-resizing');
        ciaSaveSettings();
    });
    $handle.on('dblclick', () => { ciaApplyViewerWidth(CIA_VIEWER_DEFAULT); ciaSaveSettings(); });
}

/* ═══════════════════════ Indicador de espera (motor del Visor) ═══════════════════════ */

// Loader "quantum" REAL de Templates.loader() (coffeeSoft.js) dentro de un
// .ia-typing-loader: visor.css le añade el color atenuado y los puntos "…"
// animados. Es la misma animación del Visor porque es el mismo código y el
// mismo CSS, no una réplica.
function ciaAppendTyping() {
    const hostId = 'ciaTypingHost-' + Date.now();
    const $t = $(`
        <div class="ia-msg ai ia-typing-msg">
            <div id="${hostId}" class="ia-typing-loader"></div>
            <span class="ia-typing-phase" style="display:none;"></span>
            <span class="cia-wait" title="Tiempo de espera"></span>
        </div>`);
    ciaThread().append($t);

    if (typeof Templates !== 'undefined') {
        if (!CIA._loaderHelper) CIA._loaderHelper = new Templates();
        CIA._loaderHelper.loader({ parent: hostId, type: 'quantum', size: 'xs', text: 'Analizando' });
    } else {
        $('#' + hostId).text('Analizando…');
    }

    // Cronómetro de espera: el único añadido nuestro al indicador. Vive fuera
    // del loader, así que sobrevive a los cambios de fase (thinking/tools).
    const t0 = performance.now();
    ciaStopWaitTimer();
    CIA._waitTimer = setInterval(() => {
        const s = Math.floor((performance.now() - t0) / 1000);
        if (s >= 1) $t.find('.cia-wait').text(s + 's');
    }, 1000);

    ciaScrollBottom();
    return $t;
}

function ciaStopWaitTimer() {
    if (CIA._waitTimer) { clearInterval(CIA._waitTimer); CIA._waitTimer = null; }
}

// Estado del turno mientras no llega el 1er token: razonamiento de modelos
// thinking o la etiqueta de la herramienta en curso ("leyendo archivo…"). Igual
// que el Visor: al entrar en esta fase se oculta el loader y manda el cerebro
// pulsante (.ia-typing-brain), que se monta UNA vez (recrear el SVG parpadearía).
function ciaSetTypingText($typing, text) {
    if (!$typing || !$typing.length) return;
    const $phase = $typing.find('.ia-typing-phase');
    if (!$phase.length) return;
    if (!$phase.data('inited')) {
        $typing.find('.ia-typing-loader').hide();
        $phase.html('<i data-lucide="brain" class="ia-typing-brain"></i><span class="ia-typing-phase-text"></span>').show();
        $phase.data('inited', true);
        if (window.lucide) lucide.createIcons();
    }
    let t = String(text || '').replace(/\s+/g, ' ').trim();
    if (t.length > 70) t = t.slice(0, 70) + '…';
    $phase.find('.ia-typing-phase-text').text(t);
    ciaScrollBottom();
}

/* ═══════════════════════ Stream de la respuesta (motor del Visor) ═══════════════════════
 * Typewriter por PALABRAS a 14-60 wps (la sensación "Claude"; letra a letra se
 * siente máquina de escribir) + card "Conjurando…" cuando el stream abre un
 * bloque de código renderizable, para no teclear código crudo en el chat. */
function ciaCreateAIStream() {
    const $msg = $(`
        <div class="ia-msg ai">
            <div class="ia-msg-role"><span class="dot"></span><span>${ciaEscape(ciaAgentLabel())}</span></div>
            <div class="ia-msg-text"></div>
        </div>`);
    ciaThread().append($msg);
    const $text = $msg.find('.ia-msg-text');

    let pending = '', shown = '', streamDone = false, raf = null, drainCb = null;
    let last = performance.now(), credit = 0;
    let conjuring = false, conjureKind = null, fullBuf = '', $conjSub = null;

    const CONJURE_UI = {
        html:       { icon: 'wand-sparkles', title: 'Conjurando componente…', sub: 'Tejiendo el HTML' },
        mermaid:    { icon: 'git-graph',     title: 'Construyendo diagrama…', sub: 'Trazando el gráfico' },
        drawio:     { icon: 'workflow',      title: 'Construyendo diagrama…', sub: 'Trazando el lienzo' },
        excalidraw: { icon: 'pencil-ruler',  title: 'Bosquejando…',           sub: 'Trazando el boceto' }
    };
    const conjureKindFor = buf => {
        if (/```[ \t]*drawio/i.test(buf) || /<(mxGraphModel|mxfile)[\s>]/i.test(buf)) return 'drawio';
        if (/```[ \t]*excalidraw/i.test(buf) || /"type"\s*:\s*"excalidraw/i.test(buf)) return 'excalidraw';
        if (/```[ \t]*html/i.test(buf)) return 'html';
        // Modo gráfica: cualquier bloque de código abierto es del tipo elegido.
        if (CIA.graphMode && /```/.test(buf)) return CIA.graphMode;
        return null;
    };

    function enterConjuring(kind) {
        conjuring = true;
        conjureKind = kind;
        const ui = CONJURE_UI[kind] || CONJURE_UI.html;
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        pending = '';
        $text.hide().empty();
        const $card = $(`
            <div class="ia-conjuring">
                <span class="ia-conjuring-orb"><i data-lucide="${ui.icon}"></i></span>
                <div class="ia-conjuring-info">
                    <span class="ia-conjuring-title">${ui.title}</span>
                    <span class="ia-conjuring-sub">${ui.sub}</span>
                </div>
            </div>`);
        $card.insertBefore($text);
        $conjSub = $card.find('.ia-conjuring-sub');
        if (window.lucide) lucide.createIcons();
        ciaScrollBottom();
    }

    // Toma la siguiente "palabra" (espacios + token + espacio final).
    function takeWord() {
        const m = pending.match(/^\s*\S+\s*/);
        const len = m ? m[0].length : pending.length;
        const piece = pending.slice(0, len);
        pending = pending.slice(len);
        return piece;
    }
    function paint() {
        $text.html(IARender.markdownToHtml(shown) + '<span class="ia-stream-cursor">▍</span>');
        ciaScrollBottom();
    }
    function pump(now) {
        now = now || performance.now();
        const dt = Math.min(100, now - last);   // cap por si la pestaña estuvo inactiva
        last = now;
        const wps = 14 + Math.min(46, pending.length / 40);   // acelera si hay backlog
        credit += (dt / 1000) * wps;
        let painted = false;
        while (credit >= 1 && pending.length) { shown += takeWord(); credit -= 1; painted = true; }
        if (painted) paint();
        if (!pending.length) credit = 0;
        if (streamDone && !pending.length) {
            raf = null;
            const cb = drainCb; drainCb = null;
            if (cb) cb();
            return;
        }
        raf = requestAnimationFrame(pump);
    }
    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(pump); } };

    return {
        $msg,
        push(piece) {
            if (!piece) return;
            fullBuf += piece;
            if (!conjuring) {
                const kind = conjureKindFor(fullBuf);
                if (kind) enterConjuring(kind);
            }
            if (conjuring) {
                // No se teclea el código crudo: solo avanza el progreso de la card.
                const lines = fullBuf.split('\n').length;
                const sub = (CONJURE_UI[conjureKind] || CONJURE_UI.html).sub;
                if ($conjSub) $conjSub.text(sub + ' · ' + lines + (lines === 1 ? ' línea' : ' líneas'));
                return;
            }
            pending += piece;
            kick();
        },
        drain() {
            if (conjuring) return Promise.resolve();
            return new Promise(res => { streamDone = true; drainCb = res; kick(); });
        },
        // Cierra la burbuja EN SU SITIO (sin repintar el hilo): render markdown
        // definitivo sin cursor + visores ricos + pie de metadatos.
        complete(displayedText, meta, copyText, idx) {
            if (conjuring) { $msg.find('.ia-conjuring').remove(); $text.show(); }
            let out = displayedText;
            if (window.IARender) {
                out = IARender.normalizeCanvasHtml(out, CIA.canvasMode);
                out = IARender.normalizeDrawioXml(out);
                out = IARender.normalizeExcalidrawJson(out);
            }
            $text.html(IARender.markdownToHtml(out));
            IARender.postProcess($text);
            ciaHookTemplates($text, { msgIdx: idx });
            if (meta) ciaAttachMetaFooter($msg, meta, copyText != null ? copyText : out, idx);
            if (window.lucide) lucide.createIcons();
            ciaScrollBottom();
            return out;
        },
        fail(msg) {
            if (conjuring) { $msg.find('.ia-conjuring').remove(); $text.show(); }
            streamDone = true;
            pending = '';
            if (raf) { cancelAnimationFrame(raf); raf = null; }
            $text.html(IARender.markdownToHtml(msg));
            if (window.lucide) lucide.createIcons();
            ciaScrollBottom();
        }
    };
}

/* ═══════════════════════ Envío + SSE ═══════════════════════ */
async function ciaSubmit() {
    const text = $('#ciaInput').val().trim();

    // Reenvío: Regenerar / Editar dejan el hilo terminando en un mensaje de
    // usuario y llaman aquí con el input vacío; entonces se reenvía ese último.
    const lastMsg  = CIA.history[CIA.history.length - 1];
    const isResend = !text && !CIA.pendingImages.length && !CIA.pendingDocs.length
                     && !!lastMsg && lastMsg.role === 'user';
    if (!text && !CIA.pendingImages.length && !CIA.pendingDocs.length && !isResend) return;
    if (CIA.isBusy) { ciaStop(); return; }

    if (!CIA.history.length) $('#ciaBody').empty();   // sale del estado vacío

    let userMsg = lastMsg;
    if (!isResend) {
        const images = CIA.pendingImages.slice();
        const docs   = CIA.pendingDocs.slice();

        // Los documentos de texto se EMBEBEN en el content (así el modelo los
        // recuerda vía history); en la burbuja solo se ven los chips.
        let contentForModel = text;
        if (docs.length) {
            const blocks = docs.map(d => `--- INICIO DOC ADJUNTO: ${d.name} ---\n${d.content}\n--- FIN DOC: ${d.name} ---`).join('\n\n');
            contentForModel = (text ? text + '\n\n' : '') + '=== DOCUMENTOS ADJUNTOS POR EL USUARIO ===\n' + blocks;
        }

        userMsg = {
            role: 'user',
            content: contentForModel,
            displayText: text,
            images:        images.map(i => (i.dataUrl || '').replace(/^data:[^;]+;base64,/, '')),
            imagesPreview: images.map(i => i.dataUrl),
            docsMeta:      docs.map(d => ({ name: d.name, size: d.size })),
            ts: Date.now()
        };
        CIA.history.push(userMsg);
        ciaAppendUserMessage(text, userMsg.imagesPreview, userMsg.docsMeta);

        $('#ciaInput').val('').trigger('input');
        CIA.pendingImages = [];
        CIA.pendingDocs = [];
        ciaRenderAttachments();
    }

    CIA.dirty = true;
    if (CIA.history.length === 1) {
        CIA.currentTitle = (userMsg.displayText || userMsg.content || 'Nueva conversación').slice(0, 60).trim() || 'Nueva conversación';
        $('#ciaCurrentTitle').text(CIA.currentTitle);
    }

    // Guarda ya, al enviar (no solo al recibir): si se recarga durante la
    // generación, la pregunta no se pierde y la conversación queda restaurable.
    ciaAutoSave();

    ciaSetBusy(true);
    ciaScrollBottom(true);
    const $typing = ciaAppendTyping();

    // Si el modelo activo NO tiene visión, las imágenes NO viajan (siguen en el
    // chat y en el history por si luego se cambia de modelo). Patrón del Lab.
    const dropImages = !!CIA.model && !ciaModelHasVision(CIA.model);
    if (dropImages && (userMsg.images || []).length) {
        ciaToast('Este modelo no tiene visión: la imagen no se enviará. Elige uno con visión (los marcados con "vision").', 'warn');
    }

    // Poda del PAYLOAD (el history NO se toca): solo el ÚLTIMO bloque ```html
    // viaja completo — es la versión vigente. Los anteriores se sustituyen por
    // una marca; si no, cada turno reenvía miles de tokens ya obsoletos (Lab).
    let lastHtmlIdx = -1;
    CIA.history.forEach((m, i) => { if (/```html/i.test(m.content || '')) lastHtmlIdx = i; });

    const payload = {
        messages: CIA.history.map((m, i) => {
            let content = m.content || '';
            if (i !== lastHtmlIdx && /```html/i.test(content)) {
                content = content.replace(/```html[\s\S]*?```/gi,
                    '[versión anterior del template omitida por brevedad; la versión VIGENTE es el último bloque ```html de la conversación]');
            }
            const o = { role: m.role, content };
            if (!dropImages && m.images && m.images.length) o.images = m.images;
            return o;
        }),
        systemOverride: CIA.systemOverride || '',
        model:          CIA.model || '',
        canvasMode:     !!CIA.canvasMode,
        graphMode:      CIA.graphMode || '',
        dbConnect:      (CIA.dbToolsOn && CIA.activeDb) || '',
        folderConnect:  (CIA.fsToolsOn && CIA.activeFolder) || '',
        dbTools:        !!CIA.dbToolsOn,
        fsTools:        !!CIA.fsToolsOn
    };

    const provider = (CIA.model && CIA.model.indexOf('/') !== -1) ? 'OpenRouter' : 'Ollama';
    const idx = CIA.history.length;   // índice que ocupará la respuesta

    let stream = null, received = '', meta = {}, streamErr = null;
    let firstToken = false, thinkChars = 0;

    const ac = new AbortController();
    CIA._abort = ac;

    const finish = () => {
        ciaStopWaitTimer();
        ciaSetBusy(false);
        CIA._abort = null;
        ciaScrollBottom();
        ciaAutoSave();
        if (window.lucide) lucide.createIcons();
    };

    try {
        const res = await fetch(CIA_API_STREAM, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: ac.signal
        });
        if (!res.ok || !res.body) {
            let m = 'HTTP ' + res.status;
            try { const j = await res.json(); if (j && j.error) m = j.error; } catch (_) {}
            throw new Error(m);
        }

        // SSE: eventos separados por \n\n, con líneas 'event:' y 'data:'.
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let i;
            while ((i = buf.indexOf('\n\n')) !== -1) {
                const rawEvent = buf.slice(0, i);
                buf = buf.slice(i + 2);
                let ev = 'message', dataStr = '';
                rawEvent.split('\n').forEach(l => {
                    if (l.startsWith('event:')) ev = l.slice(6).trim();
                    else if (l.startsWith('data:')) dataStr += l.slice(5).trim();
                });
                let obj = {};
                try { obj = dataStr ? JSON.parse(dataStr) : {}; } catch (_) { continue; }

                if (ev === 'thinking') {
                    // Antes del 1er token llegan dos cosas: etiquetas de tool-calling
                    // COMPLETAS ("[consultando SELECT …]", "[leyendo archivo]"), que se
                    // muestran tal cual, y razonamiento de modelos thinking que streamea
                    // en fragmentos sueltos ("lo", " que"…), que NO se pintan crudos: se
                    // acumulan y se muestra el progreso en tokens.
                    if (!firstToken) {
                        const t = obj.t || '';
                        const label = t.match(/\[([^\]]+)\]/);
                        if (label) {
                            ciaSetTypingText($typing, label[1]);
                        } else {
                            thinkChars += t.length;
                            ciaSetTypingText($typing, 'Razonando… ≈ ' + Math.max(1, Math.round(thinkChars / 4)) + ' tokens');
                        }
                    }
                } else if (ev === 'chunk') {
                    if (!firstToken) {
                        firstToken = true;
                        ciaStopWaitTimer();
                        $typing.remove();
                        stream = ciaCreateAIStream();   // la burbuja nace con el 1er token
                    }
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
        ciaStopWaitTimer();
        $typing.remove();
        const aborted = err && err.name === 'AbortError';
        // Rescate del parcial: lo ya recibido se conserva (patrón Visor/Lab).
        if (stream && received) {
            await stream.drain();
            const note = aborted ? '\n\n⏹ *Generación detenida.*' : '\n\n⚠️ *La respuesta se cortó antes de terminar.*';
            const shownText = stream.complete(received + note, meta, received, idx);
            CIA.history.push({ role: 'assistant', content: shownText, meta: meta, ts: Date.now() });
            if (!aborted) ciaToast('Respuesta cortada: ' + (err.message || 'error de red'), 'warn');
            finish();
            return;
        }
        const msg = aborted
            ? '⏹ Generación detenida.'
            : ('⚠️ No se obtuvo respuesta de ' + provider + '. ' + (err && err.message ? err.message : 'Error de red o timeout.'));
        if (stream) { await stream.drain(); stream.fail(msg); }
        else        { ciaAppendAIMessage(msg, null, idx); }
        CIA.history.push({ role: 'assistant', content: msg, ts: Date.now() });
        finish();
        return;
    }

    // Error emitido DENTRO del stream (p.ej. 429 del proveedor).
    if (streamErr) {
        ciaStopWaitTimer();
        $typing.remove();
        if (stream && received) {
            await stream.drain();
            const shownText = stream.complete(received + '\n\n⚠️ *Respuesta cortada: ' + streamErr + '*', meta, received, idx);
            CIA.history.push({ role: 'assistant', content: shownText, meta: meta, ts: Date.now() });
        } else {
            const msg = '⚠️ ' + streamErr;
            if (stream) { await stream.drain(); stream.fail(msg); }
            else        { ciaAppendAIMessage(msg, null, idx); }
            CIA.history.push({ role: 'assistant', content: msg, ts: Date.now() });
        }
        ciaToast(streamErr, 'error');
        finish();
        return;
    }

    // El stream cerró sin emitir un solo token (patrón Lab: explica y sugiere).
    if (!firstToken) {
        ciaStopWaitTimer();
        $typing.remove();
        const msg = '⚠️ El agente no devolvió respuesta de ' + provider + '. El modelo actual puede no soportar esta tarea. '
                  + 'Prueba con **glm-5.2** para código, o **kimi-k2.7-code** si necesitas visión.';
        ciaAppendAIMessage(msg, null, idx);
        CIA.history.push({ role: 'assistant', content: msg, ts: Date.now() });
        finish();
        return;
    }

    // Deja que el typewriter termine de pintar lo recibido antes del render final.
    await stream.drain();

    // Conexión pegajosa: si el backend resolvió una base/carpeta, se recuerda
    // para los siguientes turnos sin tener que volver a nombrarla.
    if (meta && meta.db) ciaSetActiveDb(meta.db);
    if (meta && meta.fs) ciaSetActiveFolder(meta.fs);
    // El backend avisa cuando el tool-calling no funcionó: toast + chip en el pie.
    if (meta && meta.tools_fallback) ciaToast('⚠ ' + meta.tools_fallback, 'warn');

    const shownText = stream.complete(received, {
        credits:          meta.credits_estimate,
        cost:             meta.cost_usd,          // costo real USD (OpenRouter) o null (Ollama)
        promptTokens:     meta.prompt_tokens,
        completionTokens: meta.completion_tokens,
        elapsed_ms:       meta.elapsed_ms,
        toolsFallback:    meta.tools_fallback || null
    }, received, idx);

    CIA.history.push({
        role: 'assistant',
        content: shownText,
        meta: {
            cost: meta.cost_usd, credits: meta.credits_estimate,
            promptTokens: meta.prompt_tokens, completionTokens: meta.completion_tokens,
            elapsed_ms: meta.elapsed_ms, toolsFallback: meta.tools_fallback || null
        },
        ts: Date.now()
    });

    ciaPlayPop();
    finish();
}

function ciaStop() {
    if (CIA._abort) CIA._abort.abort();
}

function ciaSetBusy(b) {
    CIA.isBusy = b;
    const $btn = $('#ciaSendBtn');
    if (b) $btn.addClass('is-stop').attr('title', 'Detener').html('<i data-lucide="square" class="w-3.5 h-3.5"></i>');
    else   $btn.removeClass('is-stop').attr('title', 'Enviar (Enter)').html('<i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>');
    $('#ciaStatusInfo').text(b ? 'Generando…' : 'Listo');
    if (window.lucide) lucide.createIcons();
}

// Regenerar: corta el hilo en la respuesta elegida y reenvía el mensaje previo.
function ciaRegenerate(idx) {
    if (CIA.isBusy) return;
    if (idx == null || idx < 0 || idx >= CIA.history.length) return;
    CIA.history = CIA.history.slice(0, idx);
    CIA.dirty = true;
    ciaRenderThread();
    ciaSubmit();
}

function ciaPlayPop() {
    try {
        if (!CIA._popSound) {
            CIA._popSound = new Audio('src/audio/pop_up.ogg');
            CIA._popSound.volume = 0.6;
        }
        CIA._popSound.currentTime = 0;
        CIA._popSound.play().catch(() => {});
    } catch (_) { /* noop */ }
}

// force: baja al fondo sí o sí (envío o clic en el botón). Sin force respeta el
// pegado: si el usuario subió a leer mientras la IA escribe, no lo arrastramos.
function ciaScrollBottom(force) {
    const el = $('#ciaBody')[0];
    if (!el) return;
    if (force) { CIA._stickBottom = true; $('#ciaScrollDownBtn').hide(); }
    if (CIA._stickBottom !== false) el.scrollTop = el.scrollHeight;
}

/* ═══════════════════════ Conversaciones (SQLite: ctrl-chats.php) ═══════════════════════ */
async function ciaLoadConversations() {
    try {
        // Solo las conversaciones de CoffeeIA (las del Visor viven aparte).
        const res = await fetch(`${CIA_API_CHATS}?action=list&app=coffeeia`, { cache: 'no-store' });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Error al listar');
        CIA.conversations = (data.rows || []).map(r => ({
            uid:      r.uid,
            title:    r.title || 'Sin título',
            model:    r.model || '',
            agentKey: CIA_AGENTS[r.doc] ? r.doc : CIA_DEFAULT_AGENT,   // el agente viaja en `doc`
            // SQLite guarda 'Y-m-d H:i:s'; el espacio rompe Date() en algunos parsers.
            mtime:    String(r.updated_at || r.created_at || '').replace(' ', 'T')
        }));
    } catch (err) {
        console.error('ciaLoadConversations:', err);
        CIA.conversations = [];
    }
    ciaRenderSidebar();
}

function ciaRenderSidebar() {
    const groups = { today: [], yesterday: [], week: [], older: [] };
    const now = Date.now();
    const list = CIA._filter
        ? CIA.conversations.filter(c => (c.title || '').toLowerCase().indexOf(CIA._filter) !== -1)
        : CIA.conversations;

    list.forEach(c => {
        const t = new Date(c.mtime).getTime();
        if (isNaN(t)) { groups.older.push(c); return; }
        const days = Math.floor((now - t) / 86400000);
        if (days === 0) groups.today.push(c);
        else if (days === 1) groups.yesterday.push(c);
        else if (days < 7) groups.week.push(c);
        else groups.older.push(c);
    });

    Object.keys(groups).forEach(key => {
        const $wrap = $(`.cia-sidebar-group[data-group="${key}"]`);
        const $ul = $wrap.find('ul').empty();
        const items = groups[key];
        if (!items.length) { $wrap.hide(); return; }
        $wrap.show();
        items.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
        items.forEach(c => {
            const $li = $(`
                <li class="cia-sidebar-item${c.uid === CIA.currentUid ? ' active' : ''}" title="${ciaEscape(c.title)}">
                    <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                    <span class="item-title">${ciaEscape(c.title)}</span>
                    <span class="item-meta">${ciaRelativeTime(c.mtime)}</span>
                    <button class="item-del" title="Eliminar conversación"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                </li>`);
            $li.on('click', () => ciaOpenConversation(c.uid));
            $li.find('.item-del').on('click', e => { e.stopPropagation(); ciaDeleteSaved(c.uid, c.title); });
            $ul.append($li);
        });
    });

    $('#ciaSidebarEmpty').toggle(list.length === 0);
    if (window.lucide) lucide.createIcons();
}

function ciaNewConversation() {
    if (CIA.dirty && CIA.history.length && !confirm('Tienes cambios sin guardar. ¿Descartar y empezar una nueva conversación?')) return;
    clearTimeout(CIA._autoSaveTimer);
    CIA.history = [];
    CIA.currentUid = null;
    CIA.currentTitle = 'Nueva conversación';
    CIA.dirty = false;
    CIA.pendingImages = [];
    CIA.pendingDocs = [];
    ciaRememberActive(null);   // sin conversación activa que restaurar
    ciaSetActiveDb(null);
    ciaSetActiveFolder(null);
    ciaRenderAttachments();
    ciaRenderThread();
    ciaRenderSidebar();
    $('#ciaInput').trigger('focus');
}

async function ciaOpenConversation(uid) {
    if (CIA.dirty && CIA.currentUid !== uid && CIA.history.length
        && !confirm('Tienes cambios sin guardar. ¿Descartarlos y abrir esta conversación?')) return;
    let c;
    try {
        const res = await fetch(`${CIA_API_CHATS}?action=get&uid=${encodeURIComponent(uid)}`, { cache: 'no-store' });
        const data = await res.json();
        if (!data.success) { ciaToast('No se pudo abrir: ' + (data.message || ''), 'error'); return; }
        c = data.chat || {};
    } catch (err) {
        console.error(err);
        ciaToast('Error al abrir la conversación', 'error');
        return;
    }
    clearTimeout(CIA._autoSaveTimer);
    CIA.history      = Array.isArray(c.messages) ? c.messages : [];
    CIA.currentUid   = uid;
    CIA.currentTitle = c.title || 'Conversación';
    CIA.model        = c.model || '';
    CIA.dirty        = false;
    ciaRememberActive(uid);
    // Las conexiones pegajosas son POR conversación: al abrir otra se sueltan.
    ciaSetActiveDb(null);
    ciaSetActiveFolder(null);
    ciaApplyAgent(CIA_AGENTS[c.doc] ? c.doc : CIA.agentKey, true);
    $('#ciaAgentSelect').val(CIA.agentKey);
    $('#ciaModelSelect').val(CIA.model);
    ciaRenderThread();
    ciaRenderSidebar();
    $('#ciaInput').trigger('focus');
}

async function ciaSaveConversation(silent) {
    if (!CIA.history.length) {
        if (!silent) ciaToast('Conversación vacía, nada que guardar', 'info');
        return;
    }
    const form = new FormData();
    form.append('action', 'save');
    if (CIA.currentUid) form.append('uid', CIA.currentUid);
    form.append('title',    CIA.currentTitle);
    form.append('user_id',  '');
    form.append('model',    CIA.model || '');
    form.append('doc',      CIA.agentKey || '');   // el agente viaja en `doc`
    form.append('app',      'coffeeia');           // historial propio: no se mezcla con el Visor
    form.append('messages', JSON.stringify(CIA.history));

    try {
        const res = await fetch(CIA_API_CHATS, { method: 'POST', body: form });
        const data = await res.json();
        if (!data.success) {
            if (!silent) ciaToast('Error al guardar: ' + (data.message || ''), 'error');
            return;
        }
        CIA.currentUid = data.uid;
        CIA.dirty = false;
        ciaRememberActive(data.uid);   // restaurable tras recargar
        await ciaLoadConversations();
        if (!silent) ciaToast('Conversación guardada', 'success');
    } catch (err) {
        console.error(err);
        if (!silent) ciaToast('Error de red al guardar', 'error');
    }
}

// Autoguardado silencioso tras cada respuesta (debounced), como los hilos del Lab.
function ciaAutoSave() {
    clearTimeout(CIA._autoSaveTimer);
    CIA._autoSaveTimer = setTimeout(() => ciaSaveConversation(true), 600);
}

async function ciaDeleteSaved(uid, title) {
    if (!uid || !confirm('¿Eliminar "' + (title || 'esta conversación') + '"? Esta acción no se puede deshacer.')) return;
    const form = new FormData();
    form.append('action', 'delete');
    form.append('uid', uid);
    try {
        const res = await fetch(CIA_API_CHATS, { method: 'POST', body: form });
        const data = await res.json();
        if (!data.success) { ciaToast('Error al eliminar: ' + (data.message || ''), 'error'); return; }
        if (uid === CIA.currentUid) { CIA.dirty = false; ciaNewConversation(); }
        await ciaLoadConversations();
        ciaToast('Conversación eliminada', 'success');
    } catch (err) {
        console.error(err);
        ciaToast('Error de red al eliminar', 'error');
    }
}

function ciaOpenRenameModal() {
    $('#ciaRenameInput').val(CIA.currentTitle);
    $('#ciaRenameModal').removeClass('hidden');
    setTimeout(() => $('#ciaRenameInput').trigger('focus').select(), 50);
}

function ciaApplyRename() {
    const t = $('#ciaRenameInput').val().trim();
    if (!t) { ciaToast('El título no puede estar vacío', 'error'); return; }
    CIA.currentTitle = t;
    CIA.dirty = true;
    $('#ciaCurrentTitle').text(t);
    $('#ciaRenameModal').addClass('hidden');
    if (CIA.currentUid) ciaAutoSave();
    ciaToast('Título actualizado', 'success');
}

function ciaOpenDeleteModal() {
    if (!CIA.currentUid) { ciaToast('Esta conversación aún no está guardada', 'info'); return; }
    $('#ciaDeleteText').text('Vas a eliminar "' + CIA.currentTitle + '". Esta acción no se puede deshacer.');
    $('#ciaDeleteModal').removeClass('hidden');
}

async function ciaApplyDelete() {
    const uid = CIA.currentUid;
    $('#ciaDeleteModal').addClass('hidden');
    if (!uid) return;
    await ciaDeleteSaved(uid, CIA.currentTitle);
}

function ciaDownloadConversation() {
    if (!CIA.history.length) { ciaToast('Nada que descargar', 'info'); return; }
    const fm = [
        '---',
        `name: ${CIA.currentTitle}`,
        `agent: ${CIA.agentKey}`,
        `model: ${CIA.model || 'default'}`,
        `date: ${new Date().toISOString().slice(0, 10)}`,
        `messages: ${CIA.history.length}`,
        '---', ''
    ].join('\n');
    const body = CIA.history.map(m => {
        const who = m.role === 'user' ? 'Tú' : ciaAgentLabel();
        return `### ${new Date(m.ts || Date.now()).toISOString()} · ${who}\n\n${m.displayText || m.content || ''}\n`;
    }).join('\n---\n\n');
    IARender.downloadText((ciaSlugify(CIA.currentTitle) || 'conversacion') + '.md', fm + body);
    ciaToast('Conversación descargada', 'success');
}

/* ═══════════════════════ Móvil ═══════════════════════ */
function ciaIsMobile() {
    return !!(window.matchMedia && window.matchMedia('(max-width: 900px)').matches);
}

/* Abre/cierra el panel de conversaciones. Un solo control para dos comportamientos
 * (patrón ChatGPT): en escritorio COLAPSA el panel y el chat gana el ancho; en móvil
 * el panel es un CAJÓN que se desliza por encima, con fondo oscuro.
 * La preferencia solo se recuerda en escritorio: en móvil siempre arranca cerrado. */
function ciaSetSidebarOpen(open, persist) {
    $('.cia-workspace').toggleClass('is-sb-open', !!open);
    $('body').toggleClass('cia-sb-open', !!open);
    $('#ciaSidebarToggle')
        .toggleClass('is-active', !!open)
        .attr('aria-expanded', open ? 'true' : 'false');

    if (persist && !ciaIsMobile()) {
        CIA.sidebarOpen = !!open;
        ciaSaveSettings();
    }
}

function ciaToggleSidebar() {
    ciaSetSidebarOpen(!$('.cia-workspace').hasClass('is-sb-open'), true);
}

function ciaBindResponsive() {
    // Estado inicial: en móvil el cajón arranca cerrado; en escritorio, como se dejó.
    ciaSetSidebarOpen(ciaIsMobile() ? false : CIA.sidebarOpen, false);

    $('#ciaSidebarToggle').on('click', e => { e.stopPropagation(); ciaToggleSidebar(); });
    $('#ciaSidebarBackdrop').on('click', () => ciaSetSidebarOpen(false, false));

    // En móvil, elegir una conversación cierra el cajón y deja ver el chat.
    $(document).on('click', '.cia-sidebar-item', () => {
        if (ciaIsMobile()) ciaSetSidebarOpen(false, false);
    });
    // Y "Nueva conversación" desde el cajón, igual.
    $('#ciaNewSidebarBtn').on('click', () => {
        if (ciaIsMobile()) ciaSetSidebarOpen(false, false);
    });

    // Esc cierra el cajón (en escritorio no molesta: solo actúa si está abierto).
    $(document).on('keydown.ciaSb', e => {
        if (e.key === 'Escape' && ciaIsMobile()) ciaSetSidebarOpen(false, false);
    });

    // Al cruzar el umbral móvil/escritorio, reajusta: si vuelve a escritorio,
    // restaura la preferencia; si pasa a móvil, cierra el cajón.
    let wasMobile = ciaIsMobile();
    $(window).on('resize.ciaSb', () => {
        const now = ciaIsMobile();
        if (now === wasMobile) return;
        wasMobile = now;
        ciaSetSidebarOpen(now ? false : CIA.sidebarOpen, false);
    });

    // Ajustes del header (agente / nueva / tema) en un desplegable cuando no caben.
    $('#ciaHeaderToggle').on('click', e => {
        e.stopPropagation();
        $('#ciaHeaderRight').toggleClass('is-open');
    });
    $('#ciaHeaderRight').on('change', 'select', () => {
        if (ciaIsMobile()) $('#ciaHeaderRight').removeClass('is-open');
    });
    $(document).on('click.ciaHeader', e => {
        if (!$('#ciaHeaderRight').hasClass('is-open')) return;
        if ($(e.target).closest('#ciaHeaderRight, #ciaHeaderToggle').length) return;
        $('#ciaHeaderRight').removeClass('is-open');
    });
}

/* ═══════════════════════ Helpers ═══════════════════════ */
function ciaToast(msg, tone) {
    const $t = $('#ciaToast');
    if (!$t.length) return;
    $t.text(msg).attr('data-tone', tone || 'info').addClass('visible');
    clearTimeout(CIA._toastTimer);
    CIA._toastTimer = setTimeout(() => $t.removeClass('visible'), 3000);
}

function ciaEscape(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function ciaSlugify(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}

// Nombre de archivo desde el primer encabezado markdown de la respuesta.
function ciaSuggestFileName(text) {
    const h = (text || '').match(/^#{1,6}\s+(.+)$/m);
    const slug = ciaSlugify(h ? h[1] : '');
    if (slug) return slug + '.md';
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `respuesta-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.md`;
}

function ciaRelativeTime(ts) {
    const t = new Date(ts).getTime();
    if (isNaN(t)) return '';
    const min = Math.floor((Date.now() - t) / 60000);
    if (min < 1) return 'ahora';
    if (min < 60) return min + 'm';
    const h = Math.floor(min / 60);
    if (h < 24) return h + 'h';
    const d = Math.floor(h / 24);
    if (d < 7) return d + 'd';
    return new Date(t).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
}
