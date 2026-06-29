let api = 'ctrl/ctrl-visor.php';
let apiIA = 'ctrl/ctrl-coffeeia.php';
let visor, visorView, app, coffeeIA, drawioBoard, githubBoard;

const VISOR_STORAGE_KEY = 'visor:settings:v1';
const VISOR_PINNED_KEY  = 'visor:pinned:v1';
const VISOR_USER_KEY    = 'visor:user:v1';

const VISOR_USERS = [
    { id: 'rosy',     name: 'Rosy V.',  role: 'Guardiana',     initials: 'RV', color: '#6366f1' },
    { id: 'somx',     name: 'Somx',     role: 'Desarrollador', initials: 'SO', color: '#22c55e' },
    { id: 'invitado', name: 'Invitado', role: 'Visitante',     initials: 'IN', color: '#94a3b8' }
];
const EDITABLE_EXTS = [
    'md','markdown','txt','json','yml','yaml','toml','xml','csv','tsv',
    'html','htm','css','scss','js','ts','php','py','rb','go','rs',
    'java','c','cpp','cs','sh','sql','ini','conf','log','env'
];

$(async () => {
    visorView   = new VisorView('root');
    visor       = new Visor(api, 'root');
    app         = new App(api, 'root');
    drawioBoard = new DrawioBoard(app, api);
    await app.init();
    coffeeIA = new CoffeeIA(apiIA, app);
    githubBoard = new GithubBoard(app, apiIA.replace('ctrl-coffeeia.php', 'ctrl-github.php'));
});

// Divisor arrastrable entre el documento (izq) y el lienzo (der) en modo split.
// Compartido por DrawioBoard y ExcalidrawBoard. Persiste el ancho del documento.
const VISOR_STAGE_SPLIT_KEY = 'visor:stage:docWidth';
function visorMountStageResizer(show) {
    const $mc  = $('.main-content');
    const $doc = $mc.find('.doc-layout');
    if (!$mc.length || !$doc.length) return;

    if (!show) {
        $mc.find('.stage-resize-handle').remove();
        $doc.css('flex', '');                    // vuelve al 50/50 del CSS
        $(document).off('mousemove.stageResize mouseup.stageResize');
        return;
    }
    if ($mc.find('.stage-resize-handle').length) return;   // ya montado

    const total = $mc[0].clientWidth || 0;
    const MIN_DOC = 280, MIN_STAGE = 320;
    let docW = parseInt(localStorage.getItem(VISOR_STAGE_SPLIT_KEY), 10);
    if (!isFinite(docW)) docW = Math.round((total - 20) / 2);
    docW = Math.min(Math.max(docW, MIN_DOC), Math.max(MIN_DOC, total - MIN_STAGE));
    $doc.css('flex', '0 0 ' + docW + 'px');

    const $handle = $('<div class="stage-resize-handle" title="Arrastra para redimensionar"></div>');
    $doc.after($handle);

    let dragging = false;
    $handle.on('mousedown', (e) => {
        e.preventDefault();
        dragging = true;
        document.body.classList.add('stage-resizing');
    });
    $(document).off('mousemove.stageResize mouseup.stageResize')
        .on('mousemove.stageResize', (e) => {
            if (!dragging) return;
            const rect = $mc[0].getBoundingClientRect();
            let w = e.clientX - rect.left;
            w = Math.min(Math.max(w, MIN_DOC), rect.width - MIN_STAGE);
            $doc.css('flex', '0 0 ' + w + 'px');
        })
        .on('mouseup.stageResize', () => {
            if (!dragging) return;
            dragging = false;
            document.body.classList.remove('stage-resizing');
            const basis = parseInt($doc.css('flex-basis'), 10);
            if (isFinite(basis)) localStorage.setItem(VISOR_STAGE_SPLIT_KEY, String(basis));
        });
}


class App {

    constructor(link, rootId) {
        this._link        = link;
        this.rootId       = rootId;
        this.PROJECT_NAME = 'Visor';
        this.currentFile  = null;
        this.isEditing    = false;
        this.settings     = this.loadSettings();
        this.pinnedFiles  = this.loadPinned();
        this.currentUser  = this.loadUser();
    }

    loadUser() {
        try {
            const id = localStorage.getItem(VISOR_USER_KEY);
            return VISOR_USERS.find(u => u.id === id) || VISOR_USERS[0];
        } catch (e) {
            return VISOR_USERS[0];
        }
    }

    saveUser() {
        try { localStorage.setItem(VISOR_USER_KEY, this.currentUser.id); }
        catch (e) {}
    }

    applyUser(user) {
        if (!user) return;
        this.currentUser = user;
        this.saveUser();

        $('#userInitials').text(user.initials).css('background', user.color);
        $('#userName').text(user.name);
        $('#userRole').text(user.role);
    }

    renderUserMenu() {
        const html = VISOR_USERS.map(u => `
            <button type="button" class="user-menu-item ${u.id === this.currentUser.id ? 'is-active' : ''}" data-user-id="${u.id}">
                <span class="user-menu-avatar" style="background:${u.color};">${u.initials}</span>
                <span class="user-menu-info">
                    <span class="user-menu-name">${u.name}</span>
                    <span class="user-menu-role">${u.role}</span>
                </span>
                ${u.id === this.currentUser.id ? '<i data-lucide="check" class="w-3.5 h-3.5 user-menu-check"></i>' : ''}
            </button>
        `).join('');
        $('#userMenu').html(html);
        if (window.lucide) lucide.createIcons();
    }

    bindUserMenu() {
        $('#userBlockBtn').off('click').on('click', (e) => {
            e.stopPropagation();
            const $menu = $('#userMenu');
            if ($menu.is(':visible')) {
                $menu.hide();
            } else {
                this.renderUserMenu();
                $menu.show();
            }
        });

        $(document).off('click.userMenu').on('click.userMenu', (e) => {
            if (!$(e.target).closest('#userMenu, #userBlockBtn').length) {
                $('#userMenu').hide();
            }
        });

        $('#userMenu').off('click', '.user-menu-item').on('click', '.user-menu-item', (e) => {
            const id = $(e.currentTarget).data('user-id');
            const user = VISOR_USERS.find(u => u.id === id);
            if (!user) return;
            this.applyUser(user);
            $('#userMenu').hide();
        });
    }

    workspaceId() {
        const f = this.settings && this.settings.folder ? this.settings.folder : '';
        const c = this.settings && this.settings.customPath ? this.settings.customPath : '';
        return f === 'custom' ? `custom:${c}` : f;
    }

    loadPinned() {
        try {
            const raw = localStorage.getItem(VISOR_PINNED_KEY);
            if (!raw) return new Set();
            const all = JSON.parse(raw);
            const wsId = this.workspaceId();
            const list = Array.isArray(all[wsId]) ? all[wsId] : [];
            return new Set(list);
        } catch (e) {
            return new Set();
        }
    }

    savePinned() {
        try {
            let all = {};
            try { all = JSON.parse(localStorage.getItem(VISOR_PINNED_KEY) || '{}'); } catch (e) {}
            const wsId = this.workspaceId();
            const list = Array.from(this.pinnedFiles);
            if (list.length === 0) {
                delete all[wsId];
            } else {
                all[wsId] = list;
            }
            localStorage.setItem(VISOR_PINNED_KEY, JSON.stringify(all));
        } catch (e) { /* quota / private mode — ignorar */ }
    }

    isPinned(fileName) {
        return this.pinnedFiles.has(fileName);
    }

    togglePin(fileName) {
        if (!fileName) return;
        if (this.pinnedFiles.has(fileName)) {
            this.pinnedFiles.delete(fileName);
        } else {
            this.pinnedFiles.add(fileName);
        }
        this.savePinned();
        visorView.renderSidebar(this.dataInit, this.currentFile, $('#sidebarSearch').val() || '');
        this.bindSidebarClicks();
        if (coffeeIA) coffeeIA._renderPinnedChips();
        if (window.lucide) lucide.createIcons();
    }

    getPinnedFilesPayload() {
        const out = [];
        this.pinnedFiles.forEach(name => {
            const f = (this.allFiles || []).find(x => x.file === name);
            if (!f) return;
            out.push({
                file:     f.file,
                fullPath: f.fullPath || '',
                content:  f.raw || ''
            });
        });
        return out;
    }

    isDriveFolder(folder) {
        return typeof folder === 'string' && (folder === 'drive' || folder.startsWith('drive:'));
    }

    loadSettings() {
        const validStyles = ['github', 'notion', 'dracula', 'monokai'];
        const fallback = {
            folder: 'agents', customPath: '', theme: 'dark', docStyle: 'github', docZoom: 1,
            sidebarCollapsed: false, iaDrawerWidth: 420
        };
        try {
            const raw = localStorage.getItem(VISOR_STORAGE_KEY);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            const zoom = Number(parsed.docZoom);
            const drawerW = Number(parsed.iaDrawerWidth);
            // Drive es volatil (depende del SA) — nunca lo restauramos desde localStorage
            const folder = (parsed.folder && !this.isDriveFolder(parsed.folder)) ? parsed.folder : 'agents';
            return {
                folder,
                customPath: parsed.customPath || '',
                theme:      parsed.theme === 'light' ? 'light' : 'dark',
                docStyle:   validStyles.includes(parsed.docStyle) ? parsed.docStyle : 'github',
                docZoom:    (isFinite(zoom) && zoom >= 0.7 && zoom <= 1.8) ? zoom : 1,
                sidebarCollapsed: !!parsed.sidebarCollapsed,
                iaDrawerWidth:    (isFinite(drawerW) && drawerW >= 380 && drawerW <= 900) ? drawerW : 420
            };
        } catch (e) {
            return fallback;
        }
    }

    saveSettings() {
        try {
            const toSave = { ...this.settings };
            // No persistir selecciones de Drive: conservar el ultimo folder local guardado
            if (this.isDriveFolder(toSave.folder)) {
                let prev = {};
                try { prev = JSON.parse(localStorage.getItem(VISOR_STORAGE_KEY) || '{}'); } catch (e) {}
                toSave.folder     = (prev.folder && !this.isDriveFolder(prev.folder)) ? prev.folder : 'agents';
                toSave.customPath = prev.customPath || '';
            }
            localStorage.setItem(VISOR_STORAGE_KEY, JSON.stringify(toSave));
        } catch (e) { /* quota / private mode — ignorar */ }
    }

    async init() {
        visorView.applyTheme(this.settings.theme);
        visorView.applyDocStyle(this.settings.docStyle);
        visorView.applyDocZoom(this.settings.docZoom);
        this.applySidebarCollapsed(this.settings.sidebarCollapsed, false);
        this.applyIaDrawerWidth(this.settings.iaDrawerWidth);
        this.applyUser(this.currentUser);

        const data = await visor.fetchLibrary(this.settings.folder, this.settings.customPath);
        if (data) {
            if (data.documents && typeof data.documents === 'object') {
                let allFiles = [];
                for (const proj in data.documents) {
                    for (const tipo in data.documents[proj]) {
                        allFiles.push(...data.documents[proj][tipo]);
                    }
                }
                this.dataInit = {
                    documents: data.documents,
                    agents:    [],
                    grimoires: [],
                    header:    data.header
                };
                this.allFiles = allFiles;
            } else {
                this.dataInit = {
                    agents:    data.agents,
                    grimoires: data.grimoires,
                    header:    data.header
                };
                this.allFiles = [...data.agents, ...data.grimoires];
            }
        } else {
            this.dataInit = {
                agents:    SAMPLE_VISOR_AGENTS.agents,
                grimoires: SAMPLE_VISOR_AGENTS.grimoires,
                header:    SAMPLE_VISOR_HEADER
            };
            this.allFiles = [...this.dataInit.agents, ...this.dataInit.grimoires];
        }
        const initial = this.allFiles[0]?.file || 'CoffeeIA.md';
        this.render(initial);
        this.bind();
        this._maybeOpenDiagramFromUrl();
    }

    // Si la URL trae ?diagram=1 abrimos en ESTA pestaña el diagrama/boceto cuyo
    // contenido dejo "Abrir en otra pestaña" en localStorage (handoff one-shot).
    _maybeOpenDiagramFromUrl(retry) {
        let params;
        try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
        if (params.get('diagram') !== '1') return;

        let payload = null;
        try { payload = JSON.parse(localStorage.getItem('visor:openDiagram') || 'null'); } catch (e) {}
        if (!payload || !payload.content) { try { localStorage.removeItem('visor:openDiagram'); } catch (e) {} return; }

        const wantExc = payload.type === 'excalidraw';
        const board = wantExc
            ? (typeof excalidrawBoard !== 'undefined' ? excalidrawBoard : null)
            : (typeof drawioBoard    !== 'undefined' ? drawioBoard    : null);
        // El board de Excalidraw se instancia en visor-2.js (despues): reintentamos.
        if (!board) { if (!retry) setTimeout(() => this._maybeOpenDiagramFromUrl(true), 350); return; }

        try { localStorage.removeItem('visor:openDiagram'); } catch (e) {}
        // ?full=1 => modo kiosk: solo el lienzo a pantalla completa (sin chrome).
        if (params.get('full') === '1') document.body.classList.add('diagram-fulltab');
        const ext  = wantExc ? 'excalidraw' : 'drawio';
        const name = payload.name || ('diagrama.' + ext);
        board.open({ file: name, raw: payload.content });
    }

    render(initialFile) {
        visorView.renderHeader(this.dataInit.header, this.allFiles.length);
        visorView.renderFooter(this.dataInit);
        visorView.renderSidebar(this.dataInit, this.currentFile, '');
        visorView.renderFolderPicker(this.dataInit.header, this.settings);
        this.updateNewFileButton();
        this.loadFile(initialFile);
        if (window.lucide) lucide.createIcons();
    }

    bind() {
        $('#sidebarSearch').on('input', (e) => {
            visorView.renderSidebar(this.dataInit, this.currentFile, e.target.value);
            this.bindSidebarClicks();
            if (window.lucide) lucide.createIcons();
        });

        $('#globalSearch').on('input', (e) => {
            const term = e.target.value.trim().toLowerCase();
            if (!term) {
                visorView.renderSidebar(this.dataInit, this.currentFile, '');
                this.bindSidebarClicks();
                if (window.lucide) lucide.createIcons();
                return;
            }
            const match = visor.findFirstMatch(this.allFiles, term);
            visorView.renderSidebar(this.dataInit, this.currentFile, term);
            this.bindSidebarClicks();
            if (match) this.loadFile(match.file);
            if (window.lucide) lucide.createIcons();
        });

        this.bindSidebarClicks();
        this.bindTabs();
        this.bindActions();
        this.bindFolderPicker();
        this.bindThemeToggle();
        this.bindDocStyle();
        this.bindToc();
        this.bindSidebarToggle();
        this.bindMobileSidebar();
        this.bindIaDrawerResize();
        this.bindUserMenu();
        this.bindNewFileModal();
    }

    bindMobileSidebar() {
        const isMobile = () => window.matchMedia && window.matchMedia('(max-width: 900px)').matches;

        // Conmutador Archivos/Documento (solo visible en móvil vía CSS).
        $('.vsr-mswitch').off('click').on('click', function () {
            const view = $(this).data('mview');
            $('.vsr-mswitch').removeClass('active');
            $(this).addClass('active');
            $('.visor-body-row').attr('data-mview', view);
        });

        // Al elegir un ARCHIVO en móvil, saltar a la vista Documento. Las carpetas
        // (.docs-folder-row / .tree-folder-toggle, sin data-file) NO conmutan: deben
        // dejar el sidebar visible para mostrar su contenido al expandir/entrar.
        $('#sidebarList').off('click.mobileSwitch').on('click.mobileSwitch', '.sidebar-item', function () {
            if (isMobile() && $(this).attr('data-file')) {
                $('.vsr-mswitch').removeClass('active');
                $('.vsr-mswitch[data-mview="doc"]').addClass('active');
                $('.visor-body-row').attr('data-mview', 'doc');
            }
        });

        // Botón Ajustes (solo móvil): despliega/colapsa los controles del header.
        const closeHeader = () => {
            $('#vsrHeaderRight').removeClass('is-open');
            $('#vsrHeaderToggle').attr('aria-expanded', 'false').removeClass('is-active');
        };
        $('#vsrHeaderToggle').off('click').on('click', function (e) {
            e.stopPropagation();
            const open = !$('#vsrHeaderRight').hasClass('is-open');
            $('#vsrHeaderRight').toggleClass('is-open', open);
            $(this).attr('aria-expanded', open ? 'true' : 'false').toggleClass('is-active', open);
        });
        $('#vsrHeaderRight').off('change.mobileHeader').on('change.mobileHeader', 'select', () => {
            if (isMobile()) closeHeader();
        });
        $(document).off('click.vsrHeader').on('click.vsrHeader', (e) => {
            if (!$('#vsrHeaderRight').hasClass('is-open')) return;
            if ($(e.target).closest('#vsrHeaderRight, #vsrHeaderToggle').length) return;
            closeHeader();
        });
    }

    applySidebarCollapsed(collapsed, withTransition) {
        const $sb  = $('.visor-sidebar');
        const $btn = $('#btnToggleSidebar');
        if (!withTransition) $sb.css('transition', 'none');
        $sb.toggleClass('is-collapsed', !!collapsed);
        $btn.attr('title', collapsed ? 'Mostrar lista de archivos' : 'Ocultar lista de archivos');
        // Re-inyectar el <i> porque lucide ya lo convirtio a <svg> en la carga inicial.
        // El chevron apunta hacia la accion: colapsado -> derecha (abrir), expandido -> izquierda (cerrar).
        const iconName = collapsed ? 'chevron-right' : 'chevron-left';
        $btn.html(`<i data-lucide="${iconName}" class="w-4 h-4"></i>`);
        if (window.lucide) lucide.createIcons();
        if (!withTransition) {
            $sb[0] && $sb[0].offsetHeight;
            $sb.css('transition', '');
        }
    }

    applyIaDrawerWidth(px) {
        const w = Math.min(900, Math.max(380, Number(px) || 420));
        document.getElementById('iaDrawer')?.style.setProperty('--ia-drawer-width', w + 'px');
    }

    bindSidebarToggle() {
        $('#btnToggleSidebar').off('click').on('click', () => {
            this.settings.sidebarCollapsed = !this.settings.sidebarCollapsed;
            this.saveSettings();
            this.applySidebarCollapsed(this.settings.sidebarCollapsed, true);
        });
    }

    bindIaDrawerResize() {
        const $handle = $('#iaDrawerResizeHandle');
        const $drawer = $('#iaDrawer');
        if (!$handle.length || !$drawer.length) return;

        let dragging = false;
        let startX   = 0;
        let startW   = this.settings.iaDrawerWidth;

        $handle.off('mousedown').on('mousedown', (e) => {
            if (!$drawer.hasClass('is-open')) return;
            e.preventDefault();
            dragging = true;
            startX = e.clientX;
            startW = this.settings.iaDrawerWidth;
            $drawer.addClass('is-resizing');
            document.body.classList.add('ia-drawer-resizing');
        });

        $(document).off('mousemove.iaResize').on('mousemove.iaResize', (e) => {
            if (!dragging) return;
            // El drawer vive a la izquierda y crece a la DERECHA → mover mouse a la DERECHA aumenta el ancho
            const dx = e.clientX - startX;
            const next = Math.min(900, Math.max(380, startW + dx));
            this.applyIaDrawerWidth(next);
            this.settings.iaDrawerWidth = next;
        });

        $(document).off('mouseup.iaResize').on('mouseup.iaResize', () => {
            if (!dragging) return;
            dragging = false;
            $drawer.removeClass('is-resizing');
            document.body.classList.remove('ia-drawer-resizing');
            this.saveSettings();
        });
    }

    bindDocStyle() {
        $('#docStyleSelect').val(this.settings.docStyle).off('change').on('change', (e) => {
            this.settings.docStyle = e.target.value;
            this.saveSettings();
            visorView.applyDocStyle(this.settings.docStyle);
        });

        $('#btnZoomOut').off('click').on('click', () => this.changeZoom(-0.1));
        $('#btnZoomIn').off('click').on('click', () => this.changeZoom(+0.1));
    }

    changeZoom(delta) {
        const current = Number(this.settings.docZoom) || 1;
        const next    = Math.min(1.8, Math.max(0.7, Math.round((current + delta) * 100) / 100));
        if (next === current) return;
        this.settings.docZoom = next;
        this.saveSettings();
        visorView.applyDocZoom(next);
    }

    bindActions() {
        $('#btnRefresh').off('click').on('click', () => this.refresh());
        $('#btnCopyPath').off('click').on('click', () => this.copyPath());
        $('#btnOpenEditor').off('click').on('click', () => this.openInEditor());
        $('#btnCloseDiagram').off('click').on('click', () => this.exitDiagram());
        $('#btnEdit').off('click').on('click', () => this.enterEditMode());
        $('#btnSave').off('click').on('click', () => this.saveFile());
        $('#btnCancel').off('click').on('click', () => this.exitEditMode(false));

        // Ctrl+S / atajos de formato dentro del textarea de edicion
        $('#md-edit').off('keydown.save').on('keydown.save', (e) => {
            if (e.ctrlKey || e.metaKey) {
                const k = e.key.toLowerCase();
                if (k === 's')      { e.preventDefault(); this.saveFile(); return; }
                if (k === 'b')      { e.preventDefault(); this.applyMdSyntax('bold'); return; }
                if (k === 'i')      { e.preventDefault(); this.applyMdSyntax('italic'); return; }
                if (k === 'k')      { e.preventDefault(); this.applyMdSyntax('link'); return; }
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                this.exitEditMode(false);
            }
            // Tab inserta indentacion en vez de cambiar el foco
            if (e.key === 'Tab') {
                e.preventDefault();
                const ta = e.currentTarget;
                const s = ta.selectionStart, en = ta.selectionEnd;
                ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
                ta.setSelectionRange(s + 2, s + 2);
            }
        });

        // Toolbar de markdown.
        // Usamos mousedown + preventDefault para que el boton NO robe el foco
        // del textarea; asi se conserva la seleccion/posicion del cursor y no
        // se inserta un salto de linea al perder el foco.
        $('#mdToolbar').off('mousedown click').on('mousedown', '.md-tool', (e) => {
            e.preventDefault();
            this.applyMdSyntax($(e.currentTarget).data('md'));
        });

        // Selector de estilo de bloque (tamaño de texto / titulos / cita / código).
        // Es un <select>: aplicamos al cambiar y devolvemos el foco al editor.
        $('#mdToolbar').off('change.block').on('change.block', '[data-md-block]', (e) => {
            const map = { p: 'paragraph', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', quote: 'quote', codeblock: 'codeblock' };
            const kind = map[$(e.currentTarget).val()];
            if (kind) this.applyMdSyntax(kind);
        });
    }

    canEdit(file) {
        if (!file) return false;

        if (file.lazyDrive) {
            if (!file.driveId) return false;
            const mime = file.mimeType || '';

            // Google Doc nativo: editable via markdown import (Drive convierte).
            // Sheets/Slides/Forms son solo-lectura (Sheets/.xlsx se exportan a CSV).
            if (mime === 'application/vnd.google-apps.document') return true;
            if (mime.indexOf('application/vnd.google-apps.') === 0) return false;

            // Drive: archivos texto/markdown reales — validar por extension
            const parts = (file.file || '').split('.');
            if (parts.length < 2) return false;
            return EDITABLE_EXTS.includes(parts.pop().toLowerCase());
        }

        // Local
        if (!file.fullPath) return false;
        const parts = (file.file || '').split('.');
        if (parts.length < 2) return false;
        return EDITABLE_EXTS.includes(parts.pop().toLowerCase());
    }

    updateEditButton() {
        const file = visor.getFile(this.allFiles, this.currentFile);
        const can  = this.canEdit(file);
        $('#btnEdit').prop('disabled', !can)
                     .attr('title', can ? 'Editar en el visor' : 'Archivo no editable en el visor');
    }

    _isMarkdown(file) {
        // Google Docs nativos: su contenido se exporta como markdown.
        if (file.mimeType === 'application/vnd.google-apps.document') return true;
        const parts = (file.file || '').split('.');
        const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
        return ext === 'md' || ext === 'markdown' || ext === '';
    }

    // Servicio Turndown (HTML -> Markdown) creado una sola vez.
    _turndown() {
        if (this._td) return this._td;
        if (typeof TurndownService === 'undefined') return null;
        const td = new TurndownService({
            headingStyle:     'atx',
            hr:               '---',
            bulletListMarker: '-',
            codeBlockStyle:   'fenced',
            fence:            '```',
            emDelimiter:      '*',
            strongDelimiter:  '**',
            linkStyle:        'inlined'
        });
        if (typeof turndownPluginGfm !== 'undefined' && turndownPluginGfm.gfm) {
            td.use(turndownPluginGfm.gfm);
        }
        this._td = td;
        return td;
    }

    enterEditMode() {
        const file = visor.getFile(this.allFiles, this.currentFile);
        if (!this.canEdit(file)) { visorView.toast('Archivo no editable', 'warn'); return; }

        this.isEditing = true;
        // El modo de edicion depende de la pestaña activa:
        //  - "Raw" activa  -> editar el markdown CRUDO en textarea.
        //  - "Renderizado" -> editar WYSIWYG (tipo Word), solo si es markdown y Turndown cargo.
        // Archivos que no son markdown (codigo) siempre van en raw.
        const rawTabActive = $('.cs-tab[data-tab="raw"]').hasClass('active');
        const canWysiwyg   = this._isMarkdown(file) && this._turndown();
        const useWysiwyg   = canWysiwyg && !rawTabActive;
        this._editMode = useWysiwyg ? 'wysiwyg' : 'raw';

        if (useWysiwyg) {
            // Edicion fluida en sitio sobre el documento renderizado (tipo Word).
            $('.cs-tab[data-tab="rendered"]').addClass('active');
            $('.cs-tab[data-tab="raw"]').removeClass('active');
            $('#md-raw, #md-edit').addClass('hidden');
            $('#md-rendered')
                .removeClass('hidden')
                .attr('contenteditable', 'true')
                .addClass('wysiwyg-editing')
                .focus();
            // Los checkbox de task lists vienen `disabled` desde el render (marked).
            // En edicion hay que habilitarlos y reflejar el toggle en el ATRIBUTO
            // `checked`, porque Turndown lee el atributo (no la propiedad) al guardar.
            $('#md-rendered').find('input[type="checkbox"]').prop('disabled', false);
            $('#md-rendered')
                .off('change.task')
                .on('change.task', 'input[type="checkbox"]', function () {
                    this.toggleAttribute('checked', this.checked);
                });
            // Toolbar de formato flotante encima del documento editable.
            $('#mdToolbar').removeClass('hidden');
        } else {
            // Edicion RAW: el markdown/codigo crudo en un textarea (sin toolbar WYSIWYG).
            $('.cs-tab[data-tab="raw"]').addClass('active');
            $('.cs-tab[data-tab="rendered"]').removeClass('active');
            $('#md-edit').val(file.raw);
            $('#md-rendered').addClass('hidden');
            $('#md-raw').addClass('hidden');
            $('#md-edit').removeClass('hidden').focus();
            $('#mdToolbar').addClass('hidden');
        }

        $('#btnEdit, #btnOpenEditor, #btnCopyPath').addClass('hidden');
        $('#btnSave, #btnCancel').removeClass('hidden');
        $('.cs-tab').prop('disabled', true).css('opacity', 0.5);

        if (window.lucide) lucide.createIcons();
    }

    exitEditMode(saved) {
        this.isEditing = false;
        $('#md-rendered').attr('contenteditable', 'false').removeClass('wysiwyg-editing');
        $('#md-edit').addClass('hidden').val('');
        $('#md-rendered').removeClass('hidden');
        $('#md-raw').addClass('hidden');
        $('#mdToolbar').addClass('hidden');

        $('#btnSave, #btnCancel').addClass('hidden');
        $('#btnEdit, #btnOpenEditor, #btnCopyPath').removeClass('hidden');
        $('.cs-tab').prop('disabled', false).css('opacity', 1);
        $('.cs-tab[data-tab="rendered"]').addClass('active');
        $('.cs-tab[data-tab="raw"]').removeClass('active');

        if (!saved) {
            // descartar: re-render desde file.raw original
            const file = visor.getFile(this.allFiles, this.currentFile);
            if (file) visorView.renderContent(file);
        }
        this._editMode = null;
        this.updateEditButton();
        if (window.lucide) lucide.createIcons();
    }

    // Aplica formato en el editor WYSIWYG (#md-rendered contenteditable) o,
    // si se edita codigo, inserta sintaxis markdown en el textarea raw.
    applyMdSyntax(kind) {
        // Modo raw (codigo): insertar markdown literal en el textarea.
        if (this._editMode === 'raw') {
            const ta = document.getElementById('md-edit');
            if (!ta) return;
            const start = ta.selectionStart, end = ta.selectionEnd;
            const val = ta.value, sel = val.slice(start, end);
            const before = val.slice(0, start), after = val.slice(end);
            let insert = '', selStart, selEnd;
            const wrap = (pre, post, ph) => {
                const text = sel || ph;
                insert = pre + text + post;
                selStart = start + pre.length; selEnd = selStart + text.length;
            };
            const linePrefix = (prefix, ph) => {
                const text = sel || ph;
                insert = text.split('\n').map(l => prefix + l).join('\n');
                selStart = start; selEnd = start + insert.length;
            };
            switch (kind) {
                case 'bold':      wrap('**', '**', 'texto'); break;
                case 'italic':    wrap('*', '*', 'texto'); break;
                case 'strike':    wrap('~~', '~~', 'texto'); break;
                case 'code':      wrap('`', '`', 'codigo'); break;
                case 'codeblock': wrap('```\n', '\n```', 'codigo'); break;
                case 'link':      wrap('[', '](https://)', 'texto'); break;
                case 'image':     wrap('![', '](https://)', 'alt'); break;
                case 'header':
                case 'h3':        linePrefix('### ', 'Encabezado'); break;
                case 'h1':        linePrefix('# ', 'Encabezado'); break;
                case 'h2':        linePrefix('## ', 'Encabezado'); break;
                case 'h4':        linePrefix('#### ', 'Encabezado'); break;
                case 'paragraph': linePrefix('', 'texto'); break;
                case 'quote':     linePrefix('> ', 'Cita'); break;
                case 'ul':        linePrefix('- ', 'Elemento'); break;
                case 'ol':        linePrefix('1. ', 'Elemento'); break;
                case 'task':      linePrefix('- [ ] ', 'Tarea'); break;
                case 'clear':     insert = sel; selStart = start; selEnd = start + insert.length; break;
                case 'hr':        insert = '\n---\n'; selStart = selEnd = start + insert.length; break;
                case 'table':     insert = '\n| Col 1 | Col 2 |\n| --- | --- |\n| a | b |\n'; selStart = selEnd = start + insert.length; break;
                default: return;
            }
            ta.value = before + insert + after;
            ta.focus();
            ta.setSelectionRange(selStart, selEnd);
            return;
        }

        // Modo WYSIWYG: usar execCommand sobre el documento renderizado editable.
        const el = document.getElementById('md-rendered');
        if (el) el.focus();
        const exec = (cmd, val = null) => document.execCommand(cmd, false, val);
        switch (kind) {
            case 'bold':      exec('bold'); break;
            case 'italic':    exec('italic'); break;
            case 'strike':    exec('strikeThrough'); break;
            case 'paragraph': exec('formatBlock', 'P'); break;
            case 'h1':        exec('formatBlock', 'H1'); break;
            case 'h2':        exec('formatBlock', 'H2'); break;
            case 'header':
            case 'h3':        exec('formatBlock', 'H3'); break;
            case 'h4':        exec('formatBlock', 'H4'); break;
            case 'quote':     exec('formatBlock', 'BLOCKQUOTE'); break;
            case 'codeblock': exec('formatBlock', 'PRE'); break;
            case 'clear':     exec('removeFormat'); exec('formatBlock', 'P'); break;
            case 'code': {
                // Código en línea: envolver la selección en <code>.
                const s = window.getSelection();
                const txt = (s && s.toString()) || 'codigo';
                exec('insertHTML', '<code>' + txt.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code>');
                break;
            }
            case 'image': {
                const url = prompt('URL de la imagen:', 'https://');
                if (url) exec('insertImage', url);
                break;
            }
            case 'ul':     exec('insertUnorderedList'); break;
            case 'ol':     exec('insertOrderedList'); break;
            case 'task': {
                // execCommand no sabe de task lists: insertamos el HTML que produce
                // `marked` (ul.contains-task-list > li.task-list-item > input[type=checkbox]).
                // Turndown + plugin GFM lo convierte de vuelta a "- [ ]" / "- [x]" al guardar.
                const sel  = window.getSelection();
                const text = (sel && sel.toString()) || 'Tarea';
                const html =
                    '<ul class="contains-task-list">' +
                        '<li class="task-list-item">' +
                            '<input type="checkbox"> ' + text +
                        '</li>' +
                    '</ul><p></p>';
                exec('insertHTML', html);
                break;
            }
            case 'hr':     exec('insertHorizontalRule'); break;
            case 'link': {
                const url = prompt('URL del enlace:', 'https://');
                if (url) exec('createLink', url);
                break;
            }
            case 'table': {
                const html = '<table><thead><tr><th>Col 1</th><th>Col 2</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table><p></p>';
                exec('insertHTML', html);
                break;
            }
            default: return;
        }
    }

    // Guarda contenido directo al disco/Drive sin pasar por modo edicion.
    // Lo usa CoffeeIA tras aplicar una propuesta y el WYSIWYG via saveFile.
    async saveContentSilent(file, content) {
        if (!file) return false;

        // Drive: route a drivewrite
        if (file.lazyDrive) {
            if (!file.driveId) return false;

            let body = content;
            let mime = 'text/markdown';

            // Google Doc: el caller mando markdown — convertir a HTML para
            // que Drive preserve el formato (headings, bold, listas, tablas).
            const isGoogleDoc = file.mimeType === 'application/vnd.google-apps.document';
            if (isGoogleDoc && typeof marked !== 'undefined' && marked.parse) {
                body = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' +
                       marked.parse(content) +
                       '</body></html>';
                mime = 'text/html';
            }

            try {
                const form = new FormData();
                form.append('action',  'drivewrite');
                form.append('id',      file.driveId);
                form.append('mime',    mime);
                form.append('content', body);
                const res  = await fetch(this._link, { method: 'POST', body: form });
                const data = await res.json();
                if (!data.success) {
                    visorView.toast(data.message || 'Error al guardar en Drive', 'error');
                    return false;
                }
                // file.raw siempre es el markdown original (no el HTML enviado).
                this._applySaveResult(file, content, data);
                return true;
            } catch (e) {
                visorView.toast('Error de red al guardar en Drive', 'error');
                return false;
            }
        }

        // Local
        if (!file.fullPath) return false;
        try {
            const form = new FormData();
            form.append('action',     'save');
            form.append('fullPath',   file.fullPath);
            form.append('customPath', this.settings.customPath || '');
            form.append('content',    content);
            const res  = await fetch(this._link, { method: 'POST', body: form });
            const data = await res.json();
            if (!data.success) {
                visorView.toast(data.message || 'Error al guardar', 'error');
                return false;
            }
            this._applySaveResult(file, content, data);
            return true;
        } catch (e) {
            visorView.toast('Error de red al guardar', 'error');
            return false;
        }
    }

    // Helper: actualiza el estado en memoria y refresca la UI tras un save exitoso.
    _applySaveResult(file, content, data) {
        file.raw         = content;
        file.frontmatter = visor.parseFrontmatter(content);
        if (data.size)  file.size  = data.size;
        if (data.mtime) file.mtime = data.mtime;
        visorView.renderContent(file);
        visorView.renderFrontmatter(file);
        visorView.renderFooterSelection(file);
        visorView.renderSidebar(this.dataInit, this.currentFile, $('#sidebarSearch').val() || '');
        this.bindSidebarClicks();
    }

    async saveFile() {
        const file = visor.getFile(this.allFiles, this.currentFile);
        if (!this.canEdit(file)) { visorView.toast('Archivo no editable', 'warn'); return; }

        // Sin ruta absoluta no hay a donde escribir (archivo SAMPLE o cargado sin
        // fullPath). Avisar en vez de fallar en silencio.
        if (!file.lazyDrive && !file.fullPath) {
            visorView.toast('No se puede guardar: el archivo no tiene ruta en disco', 'error');
            return;
        }

        const isGoogleDoc = file.lazyDrive && file.mimeType === 'application/vnd.google-apps.document';

        const $btn = $('#btnSave');
        $btn.prop('disabled', true).find('i').attr('data-lucide', 'loader-2').addClass('visor-spin');
        if (window.lucide) lucide.createIcons();

        let ok = false;

        try {
            if (isGoogleDoc && this._editMode === 'wysiwyg') {
                // ─── Google Doc + WYSIWYG ───
                // Enviar HTML directo al endpoint drivewrite. El conversor HTML→Doc
                // de Drive preserva headings, bold, listas, tablas, links, etc.
                // (mucho mejor que mandar markdown, que perdia formato).
                const html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' +
                             $('#md-rendered').html() +
                             '</body></html>';
                // Reconstruir markdown para mantener file.raw consistente con el resto del visor.
                const td    = this._turndown();
                const mdRaw = td ? td.turndown($('#md-rendered').html()) : '';
                ok = await this._driveSaveHtml(file, html, mdRaw);
            } else {
                // ─── Flujo regular (markdown) ───
                let content;
                if (this._editMode === 'wysiwyg') {
                    const td = this._turndown();
                    if (!td) {
                        // Turndown no cargo (CDN caido/sin red): no podemos convertir
                        // HTML→markdown sin perder el documento. Abortar con aviso claro.
                        visorView.toast('No se pudo convertir el documento (Turndown no disponible). Revisa tu conexión.', 'error');
                        return;
                    }
                    const body = td.turndown($('#md-rendered').html()).replace(/\s+$/, '');
                    const origBody = visor.stripFrontmatter(file.raw);
                    const fmPrefix = file.raw.slice(0, file.raw.length - origBody.length);
                    content = (fmPrefix.trim() ? fmPrefix.replace(/\s*$/, '\n\n') : '') + body + '\n';
                } else {
                    content = $('#md-edit').val();
                }
                ok = await this.saveContentSilent(file, content);
            }
        } catch (e) {
            console.error('[visor] saveFile fallo:', e);
            visorView.toast('Error al guardar: ' + (e && e.message ? e.message : e), 'error');
            ok = false;
        }

        if (ok) {
            visorView.toast('Guardado' + (file.size ? ': ' + file.size : '') + (file.lazyDrive ? ' (Drive)' : ''), 'success');
            this.exitEditMode(true);
        }

        $btn.prop('disabled', false).find('i').attr('data-lucide', 'save').removeClass('visor-spin');
        if (window.lucide) lucide.createIcons();
    }

    // Guarda HTML directo a un Google Doc en Drive. mdForState es el markdown
    // que se guardara en file.raw para que el visor lo siga manejando como tal.
    async _driveSaveHtml(file, htmlContent, mdForState) {
        if (!file.driveId) return false;
        try {
            const form = new FormData();
            form.append('action',  'drivewrite');
            form.append('id',      file.driveId);
            form.append('mime',    'text/html');
            form.append('content', htmlContent);
            const res  = await fetch(this._link, { method: 'POST', body: form });
            const data = await res.json();
            if (!data.success) {
                visorView.toast(data.message || 'Error al guardar Google Doc', 'error');
                return false;
            }
            this._applySaveResult(file, mdForState, data);
            return true;
        } catch (e) {
            visorView.toast('Error de red al guardar Google Doc', 'error');
            return false;
        }
    }

    bindFolderPicker() {
        $('#folderSelect').off('change').on('change', (e) => {
            const val = e.target.value;
            if (val === 'custom') {
                $('#folderCustomPath').removeClass('hidden').val(this.settings.customPath || '').focus();
                $('#btnFolderApply, #btnFolderBrowse').removeClass('hidden');
                if (window.lucide) lucide.createIcons();
            } else {
                $('#folderCustomPath').addClass('hidden');
                $('#btnFolderApply, #btnFolderBrowse').addClass('hidden');
                this.settings.folder = val;
                // No borramos customPath: queda recordada para cuando vuelvas a elegir Custom
                this.saveSettings();
                this.reloadLibrary();
            }
        });

        $('#btnFolderApply').off('click').on('click', () => this.applyCustomPath());
        $('#btnFolderBrowse').off('click').on('click', () => this.openBrowseModal());
        $('#folderCustomPath').off('keydown').on('keydown', (e) => {
            if (e.key === 'Enter') this.applyCustomPath();
            if (e.key === 'Escape') {
                $('#folderCustomPath').addClass('hidden');
                $('#btnFolderApply, #btnFolderBrowse').addClass('hidden');
                $('#folderSelect').val(this.settings.folder);
            }
        });

        this.bindBrowseModal();
    }

    applyCustomPath() {
        const path = $('#folderCustomPath').val().trim();
        if (!path) { visorView.toast('Ingresa una ruta absoluta', 'warn'); return; }
        this.settings.folder = 'custom';
        this.settings.customPath = path;
        this.saveSettings();
        this.reloadLibrary();
    }

    bindBrowseModal() {
        const $modal = $('#folderBrowseModal');
        if (!$modal.length || $modal.data('bound')) return;
        $modal.data('bound', true);

        const close = () => this.closeBrowseModal();

        $('#folderBrowseClose, #folderBrowseCancel').on('click', close);
        $('.folder-browse-backdrop', $modal).on('click', close);

        $('#folderBrowseUp').on('click', () => {
            const parent = this.browseState?.parent;
            if (parent === null || parent === undefined) return;
            this.loadBrowseDir(parent);
        });
        $('#folderBrowseHome').on('click', () => {
            const home = this.browseState?.home || '';
            this.loadBrowseDir(home);
        });
        $('#folderBrowseRoots').on('click', () => this.loadBrowseDir(''));
        $('#folderBrowseGo').on('click', () => {
            const p = $('#folderBrowsePath').val().trim();
            this.loadBrowseDir(p);
        });
        $('#folderBrowsePath').on('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.loadBrowseDir($('#folderBrowsePath').val().trim());
            } else if (e.key === 'Escape') {
                close();
            }
        });

        $('#folderBrowseList').on('click', 'li[data-full]', (e) => {
            const $li = $(e.currentTarget);
            $('#folderBrowseList li').removeClass('selected');
            $li.addClass('selected');
            this.browseState.selected = $li.data('full');
            $('#folderBrowseSelected').text(this.browseState.selected);
            $('#folderBrowsePick').prop('disabled', false);
        });
        $('#folderBrowseList').on('dblclick', 'li[data-full]', (e) => {
            const full = $(e.currentTarget).data('full');
            this.loadBrowseDir(full);
        });

        $('#folderBrowsePick').on('click', () => this.pickBrowseDir());

        $(document).on('keydown.browseModal', (e) => {
            if (e.key === 'Escape' && !$modal.hasClass('hidden')) close();
        });
    }

    openBrowseModal() {
        this.browseState = { current: '', parent: null, home: '', selected: null };
        $('#folderBrowseModal').removeClass('hidden').attr('aria-hidden', 'false');
        const initial = ($('#folderCustomPath').val() || '').trim();
        this.loadBrowseDir(initial);
        if (window.lucide) lucide.createIcons();
    }

    closeBrowseModal() {
        $('#folderBrowseModal').addClass('hidden').attr('aria-hidden', 'true');
    }

    async loadBrowseDir(path) {
        const $list = $('#folderBrowseList');
        $list.html('<li class="fb-empty">Cargando...</li>');
        try {
            const url = this._link + '?action=listdir' + (path ? '&path=' + encodeURIComponent(path) : '');
            const res = await fetch(url, { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error ' + res.status);

            this.browseState.current  = data.path || '';
            this.browseState.parent   = data.parent;
            this.browseState.home     = data.home || this.browseState.home || '';
            this.browseState.selected = data.path || null;

            $('#folderBrowsePath').val(data.path || '');
            $('#folderBrowseSelected').text(data.path || 'Selecciona una carpeta');
            $('#folderBrowsePick').prop('disabled', !data.path);
            $('#folderBrowseUp').prop('disabled', data.parent === null || data.parent === undefined);

            // Drives (cuando path vacio)
            const driveRows = (data.drives || []).map(d =>
                `<li data-full="${d.full}"><i data-lucide="hard-drive" class="w-4 h-4"></i><span class="name">${d.name}</span><span class="badge">unidad</span></li>`
            ).join('');

            const dirRows = (data.dirs || []).map(d =>
                `<li data-full="${d.full}"><i data-lucide="folder" class="w-4 h-4"></i><span class="name">${d.name}</span></li>`
            ).join('');

            const html = driveRows + dirRows;
            $list.html(html || '<li class="fb-empty">Sin subcarpetas</li>');
            if (window.lucide) lucide.createIcons();
        } catch (err) {
            $list.html(`<li class="fb-empty">No se pudo abrir: ${err.message}</li>`);
            $('#folderBrowsePick').prop('disabled', true);
        }
    }

    pickBrowseDir() {
        const pick = this.browseState?.selected;
        if (!pick) { visorView.toast('Selecciona una carpeta', 'warn'); return; }
        $('#folderCustomPath').val(pick);
        this.closeBrowseModal();
        this.applyCustomPath();
    }

    bindThemeToggle() {
        $('#btnThemeToggle').off('click').on('click', () => {
            this.settings.theme = this.settings.theme === 'dark' ? 'light' : 'dark';
            this.saveSettings();
            visorView.applyTheme(this.settings.theme);
            if (typeof coffeeIA !== 'undefined' && coffeeIA && coffeeIA._reRenderBlocksOnThemeChange) {
                coffeeIA._reRenderBlocksOnThemeChange();
            }
            if (window.lucide) lucide.createIcons();
        });
    }

    bindToc() {
        $('#tocBody').off('click').on('click', 'li[data-toc-target]', function (e) {
            e.stopPropagation();
            const $li = $(this);

            if ($li.hasClass('has-children')) {
                $li.toggleClass('collapsed');
                $li.children('ul.toc-children').toggleClass('collapsed');
            }

            const target = $li.data('toc-target');
            const $el = $('#md-rendered').find('#' + target);
            if ($el.length) {
                $el[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });

        const $main = $('.main-content');
        if (!$main.length) return;

        let ticking = false;
        $main.off('scroll.tocspy').on('scroll.tocspy', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                let current = null;
                const parentTop = $main[0].getBoundingClientRect().top;
                $('#md-rendered').find('h2, h3').each(function () {
                    const rect = this.getBoundingClientRect();
                    if (rect.top - parentTop <= 120) {
                        current = this.id;
                    }
                });
                $('#tocBody li').removeClass('toc-active');
                if (current) {
                    $('#tocBody li[data-toc-target="' + current + '"]').addClass('toc-active');
                }
                ticking = false;
            });
        });
    }

    async reloadLibrary() {
        const isDrive = this.isDriveFolder(this.settings.folder);
        let label = this.settings.folder;
        if (isDrive) {
            const preset = (this.dataInit?.header?.presets || []).find(p => p.key === this.settings.folder);
            label = preset?.label || 'Google Drive';
            visorView.showGlobalDriveLoader(label);
        }
        let data;
        try {
            data = await visor.fetchLibrary(this.settings.folder, this.settings.customPath);
        } finally {
            if (isDrive) visorView.hideGlobalDriveLoader();
        }
        if (!data) {
            visorView.toast('Carpeta no accesible o sin .md', 'error');
            return;
        }
        if (!data.header.valid) {
            visorView.toast('Ruta invalida: ' + data.header.currentPath, 'error');
            return;
        }
        if (data.documents && typeof data.documents === 'object') {
            let allFiles = [];
            for (const proj in data.documents) {
                for (const tipo in data.documents[proj]) {
                    allFiles.push(...data.documents[proj][tipo]);
                }
            }
            this.dataInit = { documents: data.documents, agents: [], grimoires: [], header: data.header };
            this.allFiles = allFiles;
        } else {
            this.dataInit = { agents: data.agents, grimoires: data.grimoires, header: data.header };
            this.allFiles = [...data.agents, ...data.grimoires];
        }
        this.currentFile = null;
        this.pinnedFiles = this.loadPinned();
        if (coffeeIA) coffeeIA._renderPinnedChips();
        const target = (this._pendingOpen && this.allFiles.find(f => f.file === this._pendingOpen))
            ? this._pendingOpen
            : this.allFiles[0]?.file;
        this._pendingOpen = null;

        visorView.renderHeader(this.dataInit.header, this.allFiles.length);
        visorView.renderFooter(this.dataInit);
        visorView.renderSidebar(this.dataInit, this.currentFile, '');
        visorView.renderFolderPicker(this.dataInit.header, this.settings);
        this.updateNewFileButton();
        this.bindSidebarClicks();
        if (target) this.loadFile(target);
        else        visorView.renderEmptyMain();
        visorView.toast(data.header.currentLabel + ': ' + this.allFiles.length + ' archivos', 'success');
        if (window.lucide) lucide.createIcons();
    }

    async refresh() {
        const $btn = $('#btnRefresh');
        const $icon = $btn.find('i');
        $btn.prop('disabled', true);
        $icon.addClass('visor-spin');
        $btn.find('.btn-label').text('Refrescando...');

        const data = await visor.fetchLibrary(this.settings.folder, this.settings.customPath);
        if (data) {
            if (data.documents && typeof data.documents === 'object') {
                let allFiles = [];
                for (const proj in data.documents) {
                    for (const tipo in data.documents[proj]) {
                        allFiles.push(...data.documents[proj][tipo]);
                    }
                }
                this.dataInit = { documents: data.documents, agents: [], grimoires: [], header: data.header };
                this.allFiles = allFiles;
            } else {
                this.dataInit = { agents: data.agents, grimoires: data.grimoires, header: data.header };
                this.allFiles = [...data.agents, ...data.grimoires];
            }
            const stillExists = this.allFiles.find(f => f.file === this.currentFile);
            const target      = stillExists ? this.currentFile : this.allFiles[0]?.file;

            visorView.renderHeader(this.dataInit.header, this.allFiles.length);
            visorView.renderFooter(this.dataInit);
            visorView.renderSidebar(this.dataInit, this.currentFile, '');
            this.updateNewFileButton();
            this.bindSidebarClicks();
            if (target) this.loadFile(target);
            visorView.toast('Biblioteca actualizada (' + this.allFiles.length + ' archivos)', 'success');
        } else {
            visorView.toast('Backend no disponible — sin cambios', 'warn');
        }

        $btn.prop('disabled', false);
        $icon.removeClass('visor-spin');
        $btn.find('.btn-label').text('Refrescar');
        if (window.lucide) lucide.createIcons();
    }

    copyPath() {
        const file = visor.getFile(this.allFiles, this.currentFile);
        if (!file) { visorView.toast('Sin archivo seleccionado', 'warn'); return; }
        const text = file.relPath || ('.claude/agents/' + file.file);

        const done = (ok) => visorView.toast(ok ? ('Ruta copiada: ' + text) : 'No se pudo copiar', ok ? 'success' : 'error');

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => done(true)).catch(() => done(false));
        } else {
            const $ta = $('<textarea>').val(text).css({ position: 'fixed', top: '-9999px' }).appendTo('body');
            $ta[0].select();
            try { document.execCommand('copy'); done(true); } catch (e) { done(false); }
            $ta.remove();
        }
    }

    openInEditor() {
        const file = visor.getFile(this.allFiles, this.currentFile);
        if (!file)            { visorView.toast('Sin archivo seleccionado', 'warn'); return; }
        if (!file.fullPath)   { visorView.toast('Ruta absoluta no disponible (modo SAMPLE)', 'warn'); return; }
        window.location.href = 'vscode://file/' + file.fullPath;
        visorView.toast('Abriendo en VS Code...', 'success');
    }

    /* ── Crear archivo nuevo (.md, .drawio, .json, etc.) ── */

    // Carpeta absoluta donde se creara el archivo: SIEMPRE la que esta abierta
    // (la ruta real que el backend esta listando). Asi "Nuevo" cae donde estas.
    newFileTargetDir() {
        const h = this.dataInit && this.dataInit.header ? this.dataInit.header : null;
        const current = h && h.currentPath ? h.currentPath : '';
        if (current && !/^drive:/i.test(current)) return current;
        // Fallback (Drive abierto): ultimo custom local conocido.
        return this.settings.customPath || '';
    }

    // Solo origenes locales con ruta valida admiten creacion (Drive no usa el endpoint save).
    canCreateFiles() {
        const h = this.dataInit && this.dataInit.header ? this.dataInit.header : null;
        if (!h) return false;
        if (h.source === 'Drive') return false;
        return !!h.currentPath && h.valid !== false;
    }

    updateNewFileButton() {
        const can = this.canCreateFiles();
        $('#btnNewFile').prop('disabled', !can)
            .attr('title', can
                ? 'Crear un archivo nuevo en esta carpeta'
                : 'Crear archivos no disponible en este origen (selecciona una carpeta local o Custom)');
    }

    _samePath(a, b) {
        const norm = s => String(s || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
        return norm(a) === norm(b);
    }

    // prefill: { dir?, name?, content? } — lo usa el boton "Guardar" del chat de CoffeeIA.
    openNewFileModal(prefill) {
        prefill = prefill || {};
        // Sin contenido precargado, exigimos un origen local valido.
        if (!prefill.content && !this.canCreateFiles()) {
            visorView.toast('Selecciona una carpeta local (o Custom) para crear archivos', 'warn');
            return;
        }
        // En el arbol de documentos sin carpeta prefijada el usuario ELIGE la
        // carpeta destino con un selector. En el resto de casos el destino es fijo
        // (lo que esta abierto, o el prefill.dir de CoffeeIA/diagramas).
        const treeMode     = !!(this.dataInit && this.dataInit.documents);
        const chooseFolder = treeMode && !prefill.dir;

        if (chooseFolder) {
            const baseDir = (this.dataInit.header && this.dataInit.header.currentPath
                ? String(this.dataInit.header.currentPath) : '').replace(/\/+$/, '');
            const opts = this._buildFolderOptions(baseDir);
            $('#newFileFolderSelect').html(
                opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('')
            );
            // Preseleccionar la carpeta del archivo abierto, si aplica.
            const active = (this.allFiles || []).find(x => x.file === this.currentFile);
            if (active && active.project) {
                const want = (active.type && active.type !== '(sin clasificar)')
                    ? `${baseDir}/${active.project}/${active.type}`
                    : `${baseDir}/${active.project}`;
                $('#newFileFolderSelect').val(want);
            }
            $('#newFilePathInput').addClass('hidden');
            $('#newFileFolderSelect').removeClass('hidden');
        } else {
            let dir = prefill.dir || this.newFileTargetDir();
            if (/^drive:/i.test(dir)) dir = this.settings.customPath || '';
            // Destino fijo: solo lectura para que el archivo caiga donde estas parado.
            $('#newFilePathInput').val(dir).prop('readonly', true).attr('title', dir).removeClass('hidden');
            $('#newFileFolderSelect').addClass('hidden');
        }

        $('#newFileNameInput').val(prefill.name || '');
        $('#newFileContent').val(prefill.content || '');
        $('#newFileModal').removeClass('hidden').attr('aria-hidden', 'false');
        setTimeout(() => $('#newFileNameInput').trigger('focus'), 30);
        if (window.lucide) lucide.createIcons();
    }

    // Opciones de carpeta destino para el modal (arbol de documentos): cada
    // proyecto y cada subcarpeta real. Omitimos "(sin clasificar)" porque
    // equivale a la propia carpeta del proyecto.
    _buildFolderOptions(baseDir) {
        const docs = (this.dataInit && this.dataInit.documents) || {};
        const out = [];
        Object.keys(docs).sort((a, b) => a.localeCompare(b)).forEach(proj => {
            out.push({ value: `${baseDir}/${proj}`, label: proj });
            const types = docs[proj];
            Object.keys(types).sort((a, b) => {
                if (a === '(sin clasificar)') return 1;
                if (b === '(sin clasificar)') return -1;
                return a.localeCompare(b);
            }).forEach(tipo => {
                if (tipo === '(sin clasificar)') return;
                out.push({ value: `${baseDir}/${proj}/${tipo}`, label: `${proj} / ${tipo}` });
            });
        });
        return out;
    }

    closeNewFileModal() {
        $('#newFileModal').addClass('hidden').attr('aria-hidden', 'true');
    }

    bindNewFileModal() {
        const $modal = $('#newFileModal');
        if (!$modal.length || $modal.data('bound')) return;
        $modal.data('bound', true);

        const close = () => this.closeNewFileModal();
        $('#newFileClose, #newFileCancel').on('click', close);
        $modal.find('[data-newfile-close]').on('click', close);
        $('#newFileCreateBtn').on('click', () => this.createFile());

        $('#newFileNameInput').on('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this.createFile(); }
            if (e.key === 'Escape') close();
        });
        $(document).on('keydown.newFileModal', (e) => {
            if (e.key === 'Escape' && !$modal.hasClass('hidden')) close();
        });
    }

    async createFile() {
        // El destino sale del selector (modo arbol) o del input de ruta fija.
        const usingSelect = !$('#newFileFolderSelect').hasClass('hidden');
        const dir = (usingSelect
            ? ($('#newFileFolderSelect').val() || '')
            : ($('#newFilePathInput').val() || '')
        ).trim().replace(/[\\/]+$/, '');
        let   name    = ($('#newFileNameInput').val() || '').trim();
        const content = $('#newFileContent').val();

        if (!dir)  { visorView.toast('Indica la carpeta destino', 'warn'); return; }
        if (!name) { visorView.toast('Indica el nombre del archivo', 'warn'); return; }
        if (/[\\/]/.test(name)) { visorView.toast('El nombre no puede contener / o \\', 'warn'); return; }

        // Default a .md cuando no se especifica extension.
        if (!/\.[a-z0-9]+$/i.test(name)) name += '.md';
        const ext = name.split('.').pop().toLowerCase();
        if (!EDITABLE_EXTS.includes(ext) && ext !== 'drawio' && ext !== 'excalidraw') {
            visorView.toast('Extension no permitida: .' + ext, 'warn');
            return;
        }

        const fullPath = dir + '/' + name;
        const $btn = $('#newFileCreateBtn');
        $btn.prop('disabled', true);

        try {
            const form = new FormData();
            form.append('action',     'save');
            form.append('fullPath',   fullPath);
            form.append('customPath', dir);   // autoriza el dir destino en el sandbox del backend
            form.append('content',    content || '');
            const res  = await fetch(this._link, { method: 'POST', body: form });
            const data = await res.json();
            if (!data.success) {
                visorView.toast(data.message || 'No se pudo crear el archivo', 'error');
                $btn.prop('disabled', false);
                return;
            }

            this.closeNewFileModal();
            visorView.toast('Archivo creado: ' + name, 'success');

            // Si cae en la carpeta abierta —o en cualquier subcarpeta del arbol de
            // documentos— recargar y abrirlo automaticamente.
            const openDir = (this.dataInit && this.dataInit.header ? this.dataInit.header.currentPath : '') || '';
            const norm = s => String(s || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
            const insideTree = !!(this.dataInit && this.dataInit.documents)
                && !!openDir && norm(dir).indexOf(norm(openDir) + '/') === 0;
            if (this._samePath(dir, openDir) || insideTree) {
                this._pendingOpen = name;
                if (insideTree) {
                    // Acordeon: dejar abierta la carpeta-proyecto donde se acaba de
                    // crear el archivo para que se vea en el arbol tras recargar.
                    const baseSlash = String(openDir).replace(/\\/g, '/').replace(/\/+$/, '');
                    const dirSlash  = String(dir).replace(/\\/g, '/').replace(/\/+$/, '');
                    const proj = dirSlash.slice(baseSlash.length + 1).split('/')[0];
                    if (proj) {
                        try { localStorage.setItem('visor:tree:expanded', JSON.stringify([proj])); } catch (e) {}
                    }
                }
                await this.reloadLibrary();
            }
        } catch (e) {
            visorView.toast('Error de red al crear el archivo', 'error');
        }
        $btn.prop('disabled', false);
    }

    async deleteFile(fileName) {
        const file = visor.getFile(this.allFiles, fileName);
        if (!file) return;
        if (file.lazyDrive || !file.fullPath) {
            visorView.toast('Este archivo no se puede eliminar desde el visor', 'warn');
            return;
        }
        if (!confirm(`¿Eliminar "${file.file}"?\nEsta acción no se puede deshacer.`)) return;

        try {
            const form = new FormData();
            form.append('action',     'delete');
            form.append('fullPath',   file.fullPath);
            form.append('customPath', this.settings.customPath || '');
            const res  = await fetch(this._link, { method: 'POST', body: form });
            const data = await res.json();
            if (!data.success) {
                visorView.toast(data.message || 'No se pudo eliminar', 'error');
                return;
            }

            visorView.toast('Eliminado: ' + file.file, 'success');
            // Soltar del contexto CoffeeIA y de la seleccion si correspondia.
            if (this.pinnedFiles.has(file.file)) { this.pinnedFiles.delete(file.file); this.savePinned(); }
            if (this.currentFile === file.file)  this.currentFile = null;
            await this.reloadLibrary();
        } catch (e) {
            visorView.toast('Error de red al eliminar', 'error');
        }
    }

    // Cierra el lienzo y muestra el .drawio activo como fuente (XML), sin reabrir.
    exitDiagram() {
        if (drawioBoard) drawioBoard.close();
        const file = visor.getFile(this.allFiles, this.currentFile);
        if (file) visorView.renderContent(file);
        if (window.lucide) lucide.createIcons();
    }

    bindSidebarClicks() {
        $('#sidebarList .sidebar-pin-btn').off('click').on('click', (e) => {
            e.stopPropagation();
            const fileName = $(e.currentTarget).data('pin-file');
            this.togglePin(fileName);
        });

        $('#sidebarList .sidebar-del-btn').off('click').on('click', (e) => {
            e.stopPropagation();
            const fileName = $(e.currentTarget).data('del-file');
            this.deleteFile(fileName);
        });

        // Carpetas del arbol: expandir/colapsar en linea (lazy), sin navegar.
        $('#sidebarList .tree-folder-toggle').off('click').on('click', (e) => {
            e.stopPropagation();
            this.toggleFolderNode($(e.currentTarget));
        });

        $('#sidebarList .sidebar-item').off('click').on('click', (e) => {
            const $el = $(e.currentTarget);
            if ($el.hasClass('tree-folder-toggle')) return; // las carpetas lazy las maneja toggleFolderNode
            // Carpeta de la vista de documentos: entrar a ella (navegacion tipo explorador).
            // Se maneja aqui porque .docs-folder-row es .sidebar-item y este .off('click')
            // borraria el handler que pone renderSidebarTree.
            if ($el.hasClass('docs-folder-row')) {
                const proj = $el.data('project');
                try { localStorage.setItem('visor:docs:folder', proj); } catch (er) {}
                visorView.renderSidebar(this.dataInit, this.currentFile, $('#sidebarSearch').val() || '');
                this.bindSidebarClicks();
                if (window.lucide) lucide.createIcons();
                return;
            }
            const fileName = $el.data('file');
            if (fileName) this.loadFile(fileName);
        });

        // El boton "Nuevo archivo" vive en la cabecera de la seccion DOCS, que se
        // re-renderiza en cada filtro/recarga: hay que reenlazarlo aqui.
        $('#btnNewFile').off('click').on('click', () => this.openNewFileModal());
        this.updateNewFileButton();
    }

    // Expande/colapsa un nodo de carpeta del arbol. Al expandir por primera vez,
    // carga su contenido (subcarpetas + archivos) bajo demanda reusando el backend.
    async toggleFolderNode($toggle) {
        const path      = $toggle.data('folder-path');
        const depth     = Number($toggle.attr('data-depth')) || 0;
        const $children = $toggle.next('.tree-folder-children');

        if (!$toggle.hasClass('collapsed')) {
            // Ya abierto -> colapsar.
            $toggle.addClass('collapsed');
            $children.addClass('collapsed');
            if (window.lucide) lucide.createIcons();
            return;
        }

        // Abrir.
        $toggle.removeClass('collapsed');
        $children.removeClass('collapsed');

        if ($toggle.data('loaded')) {
            if (window.lucide) lucide.createIcons();
            return;
        }

        $children.html('<div class="tree-loading">Cargando...</div>');
        const data = await visor.fetchLibrary('custom', path);
        if (!data) {
            $children.html('<div class="tree-loading">No se pudo abrir la carpeta</div>');
            return;
        }

        const childDepth = depth + 1;
        const folders = data.folders || [];
        const files   = data.agents  || [];

        // Registrar los archivos cargados en allFiles para poder abrirlos/anclarlos.
        files.forEach(item => {
            if (!this.allFiles.some(x => x.fullPath === item.fullPath)) this.allFiles.push(item);
        });

        const foldersHtml = folders.map(f => visorView.treeFolderNodeHtml(f, childDepth)).join('');
        const filesHtml   = files.map(item => visorView.treeFileRowHtml(item, this.currentFile, childDepth)).join('');
        const inner = foldersHtml + filesHtml;
        $children.html(inner || '<div class="tree-loading">Carpeta vacia</div>');
        $toggle.data('loaded', true);

        // Reenlazar clicks para los nodos recien inyectados.
        this.bindSidebarClicks();
        if (window.lucide) lucide.createIcons();
    }

    bindTabs() {
        $('.cs-tab').off('click').on('click', (e) => {
            const $tab = $(e.currentTarget);
            $('.cs-tab').removeClass('active');
            $tab.addClass('active');
            const target = $tab.data('tab');
            $('#md-rendered').toggleClass('hidden', target !== 'rendered');
            $('#md-raw').toggleClass('hidden', target !== 'raw');
        });
    }

    async loadFile(fileName) {
        const file = visor.getFile(this.allFiles, fileName);
        if (!file) return;

        // Si estoy editando otro archivo, confirmar antes de cambiar
        if (this.isEditing && fileName !== this.currentFile) {
            const current = $('#md-edit').val();
            const orig    = (visor.getFile(this.allFiles, this.currentFile) || {}).raw || '';
            if (current !== orig && !confirm('Tienes cambios sin guardar. ¿Descartar y cambiar de archivo?')) return;
            this.exitEditMode(false);
        }

        this.currentFile = fileName;

        $('#sidebarList .sidebar-item').each(function () {
            $(this).toggleClass('active', $(this).data('file') === fileName);
        });

        // Lazy-load para archivos de Drive
        if (file.lazyDrive && file.driveId && !file._loaded) {
            visorView.showDriveLoader(file);
            try {
                const url = `${api}?action=driveread&id=${encodeURIComponent(file.driveId)}&mime=${encodeURIComponent(file.mimeType || '')}`;
                const res = await fetch(url, { cache: 'no-store' });
                const fmt = (res.headers.get('X-Visor-Format') || '').toLowerCase();
                if (fmt === 'spreadsheet-binary') {
                    file._binary = await res.arrayBuffer();
                    file.raw     = '';
                } else {
                    file.raw         = await res.text();
                    file.frontmatter = visor.parseFrontmatter(file.raw);
                }
                file._loaded = true;
            } catch (e) {
                file.raw = `> Error al leer desde Drive: ${e.message || e}`;
            } finally {
                visorView.hideDriveLoader();
            }
        }

        visorView.renderBreadcrumb(file, this.dataInit.header);
        visorView.renderFrontmatter(file);

        // Los diagramas (.drawio) se abren en el lienzo draw.io, no como markdown.
        const ext = (file.file || '').split('.').pop().toLowerCase();
        if (ext === 'drawio') {
            if (drawioBoard) drawioBoard.open(file);
        } else {
            if (drawioBoard && drawioBoard.active) drawioBoard.close();
            visorView.renderContent(file);
        }

        visorView.renderFooterSelection(file);
        this.updateEditButton();

        // Mantener sincronizado el contexto de CoffeeIA con el archivo abierto.
        if (typeof coffeeIA !== 'undefined' && coffeeIA && coffeeIA._syncContext) {
            coffeeIA._syncContext();
        }

        if (window.lucide) lucide.createIcons();
    }
}


class Visor {

    constructor(link, rootId) {
        this._link  = link;
        this.rootId = rootId;
    }

    async fetchLibrary(folderKey, customPath) {
        try {
            const params = new URLSearchParams({ folder: folderKey || 'agents' });
            if (folderKey === 'custom' && customPath) params.set('path', customPath);
            const url = this._link + '?' + params.toString();
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (!data || (!Array.isArray(data.agents) && !Array.isArray(data.grimoires) && typeof data.documents !== 'object')) {
                throw new Error('payload invalido');
            }
            return data;
        } catch (err) {
            console.warn('[visor] backend no disponible, usando SAMPLE:', err.message);
            return null;
        }
    }

    getFile(allFiles, fileName) {
        return allFiles.find(f => f.file === fileName);
    }

    filterFiles(items, term) {
        const t = (term || '').trim().toLowerCase();
        if (!t) return items;
        return items.filter(item => {
            const haystack = `${item.name} ${item.frontmatter?.description || ''}`.toLowerCase();
            return haystack.includes(t);
        });
    }

    findFirstMatch(allFiles, term) {
        const t = term.toLowerCase();
        return allFiles.find(f => {
            const hay = `${f.name} ${f.frontmatter?.description || ''} ${f.raw}`.toLowerCase();
            return hay.includes(t);
        });
    }

    stripFrontmatter(raw) {
        return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
    }

    parseCsv(raw, delim) {
        const rows = [];
        let row = [];
        let cur = '';
        let inQuotes = false;
        const d = delim || ',';
        for (let i = 0; i < raw.length; i++) {
            const ch = raw[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (raw[i + 1] === '"') { cur += '"'; i++; }
                    else inQuotes = false;
                } else cur += ch;
            } else {
                if (ch === '"') inQuotes = true;
                else if (ch === d) { row.push(cur); cur = ''; }
                else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
                else if (ch === '\r') { /* ignorar */ }
                else cur += ch;
            }
        }
        if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
        return rows;
    }

    renderCsvAsTable(raw, delim) {
        if (!raw || raw.startsWith('> ')) {
            const escaped = (raw || '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
            return `<pre style="white-space:pre-wrap;">${escaped}</pre>`;
        }
        const rows = this.parseCsv(raw, delim);
        if (!rows.length) return '<p class="text-slate-400">Hoja vacia.</p>';
        const escape = s => String(s ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
        const head = rows[0].map(c => `<th>${escape(c)}</th>`).join('');
        const body = rows.slice(1).map(r =>
            '<tr>' + r.map(c => `<td>${escape(c)}</td>`).join('') + '</tr>'
        ).join('');
        return `<div class="md-sheet-wrapper"><table class="md-sheet"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }

    escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    }

    // Renderiza un workbook .xlsx/.xls/.ods completo (todas las hojas) usando SheetJS.
    // Devuelve HTML con tabs (clicables via _wireSheetTabs en la vista) y preserva
    // celdas combinadas, fechas formateadas y valores calculados de formulas.
    renderXlsxWorkbook(arrayBuffer) {
        if (typeof XLSX === 'undefined') {
            return '<pre style="white-space:pre-wrap;">> SheetJS no esta cargado. Refresca la pagina.</pre>';
        }
        let wb;
        try {
            wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true, cellStyles: false });
        } catch (e) {
            return `<pre style="white-space:pre-wrap;">> Error al leer el archivo: ${this.escapeHtml(e.message || e)}</pre>`;
        }
        const names = wb.SheetNames || [];
        if (!names.length) return '<p class="text-slate-400">Libro vacio.</p>';

        const parser = new DOMParser();
        const sheets = names.map((name, idx) => {
            const ws       = wb.Sheets[name];
            const fullHtml = XLSX.utils.sheet_to_html(ws, { editable: false });
            const doc      = parser.parseFromString(fullHtml, 'text/html');
            const table    = doc.querySelector('table');
            let tableHtml  = '';
            if (table) {
                table.classList.add('md-sheet');
                // Envolvemos el contenido de cada celda en un wrapper para poder
                // aplicarle max-height + scroll cuando el texto es muy largo.
                table.querySelectorAll('td').forEach(td => {
                    const wrap = doc.createElement('div');
                    wrap.className = 'cell-content';
                    while (td.firstChild) wrap.appendChild(td.firstChild);
                    td.appendChild(wrap);
                });
                tableHtml = table.outerHTML;
            }
            return { name, idx, tableHtml };
        });

        const tabs = sheets.map(s =>
            `<button type="button" class="sheet-tab${s.idx === 0 ? ' active' : ''}" data-sheet-idx="${s.idx}">${this.escapeHtml(s.name)}</button>`
        ).join('');
        const panels = sheets.map(s =>
            `<div id="sheet-panel-${s.idx}" class="sheet-panel${s.idx === 0 ? ' active' : ''}" data-sheet-panel="${s.idx}" data-sheet-name="${this.escapeHtml(s.name)}">
                <div class="md-sheet-wrapper">${s.tableHtml || '<p class="text-slate-400" style="padding:16px;">Hoja vacia.</p>'}</div>
             </div>`
        ).join('');

        return `<div class="xlsx-workbook"><div class="sheet-tabs">${tabs}</div><div class="sheet-panels">${panels}</div></div>`;
    }

    countLines(raw) {
        return raw.split('\n').length;
    }

    extToHljsLang(ext) {
        const map = {
            php: 'php',
            js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript',
            css: 'css', scss: 'scss',
            html: 'html', htm: 'html', xml: 'xml',
            json: 'json',
            yml: 'yaml', yaml: 'yaml', toml: 'ini',
            py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
            java: 'java', c: 'c', cpp: 'cpp', cs: 'csharp',
            sh: 'bash', env: 'bash',
            sql: 'sql',
            ini: 'ini', conf: 'ini',
            log: 'plaintext', txt: 'plaintext', csv: 'plaintext', tsv: 'plaintext'
        };
        return map[ext] || 'plaintext';
    }

    parseFrontmatter(raw) {
        const fm = { name: null, description: null, model: null, type: null, project: null, status: null, date: null };
        const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!m) return fm;
        for (const line of m[1].split(/\r?\n/)) {
            const kv = line.match(/^([\w-]+):\s*(.+?)\s*$/);
            if (!kv) continue;
            const key = kv[1];
            const val = kv[2].replace(/^["']|["']$/g, '');
            if (key in fm) fm[key] = val;
        }
        return fm;
    }

    fileFormat(file) {
        if (file.isBackup) return { icon: 'archive', cls: 'fmt-backup' };

        const mime  = (file.mimeType || '').toLowerCase();
        const parts = (file.file || '').split('.');
        const ext   = parts.length > 1 ? parts.pop().toLowerCase() : '';

        // Google Workspace (Drive)
        if (mime === 'application/vnd.google-apps.document')     return { icon: 'file-text',        cls: 'fmt-gdoc'   };
        if (mime === 'application/vnd.google-apps.spreadsheet')  return { icon: 'file-spreadsheet', cls: 'fmt-gsheet' };
        if (mime === 'application/vnd.google-apps.presentation') return { icon: 'presentation',     cls: 'fmt-gslide' };
        if (mime === 'application/vnd.google-apps.form')         return { icon: 'clipboard-list',   cls: 'fmt-gform'  };
        if (mime === 'application/vnd.google-apps.drawing')      return { icon: 'pen-tool',         cls: 'fmt-draw'   };

        // Por MIME generico
        if (mime.startsWith('image/'))             return { icon: 'file-image',    cls: 'fmt-image'   };
        if (mime.startsWith('video/'))             return { icon: 'file-video',    cls: 'fmt-video'   };
        if (mime.startsWith('audio/'))             return { icon: 'file-audio',    cls: 'fmt-audio'   };
        if (mime === 'application/pdf')            return { icon: 'file-text',     cls: 'fmt-pdf'     };
        if (mime === 'application/zip'
            || mime.includes('compressed')
            || mime.includes('x-rar')
            || mime.includes('x-7z'))              return { icon: 'file-archive',  cls: 'fmt-archive' };

        // Por extension
        switch (ext) {
            case 'md': case 'markdown':            return { icon: 'file-text',        cls: 'fmt-md'      };
            case 'txt': case 'rtf':                return { icon: 'file-text',        cls: 'fmt-txt'     };
            case 'pdf':                            return { icon: 'file-text',        cls: 'fmt-pdf'     };
            case 'doc': case 'docx': case 'odt':   return { icon: 'file-text',        cls: 'fmt-doc'     };
            case 'xls': case 'xlsx':
            case 'ods': case 'csv': case 'tsv':    return { icon: 'file-spreadsheet', cls: 'fmt-sheet'   };
            case 'ppt': case 'pptx': case 'odp':   return { icon: 'presentation',     cls: 'fmt-slide'   };
            case 'png': case 'jpg':  case 'jpeg':
            case 'gif': case 'svg':  case 'webp':
            case 'ico': case 'bmp':  case 'avif':  return { icon: 'file-image',       cls: 'fmt-image'   };
            case 'mp4': case 'webm': case 'mov':
            case 'avi': case 'mkv':  case 'm4v':   return { icon: 'file-video',       cls: 'fmt-video'   };
            case 'mp3': case 'wav':  case 'flac':
            case 'ogg': case 'm4a':  case 'aac':   return { icon: 'file-audio',       cls: 'fmt-audio'   };
            case 'zip': case 'rar':  case '7z':
            case 'tar': case 'gz':   case 'bz2':   return { icon: 'file-archive',     cls: 'fmt-archive' };
            case 'json': case 'xml': case 'yml':
            case 'yaml': case 'toml':              return { icon: 'file-code',        cls: 'fmt-data'    };
            case 'js': case 'ts': case 'jsx':
            case 'tsx': case 'py': case 'php':
            case 'rb': case 'go': case 'rs':
            case 'java': case 'c': case 'cpp':
            case 'cs': case 'sh': case 'sql':
            case 'html': case 'css': case 'scss':  return { icon: 'file-code',        cls: 'fmt-code'    };
            case 'excalidraw':                     return { icon: 'pen-tool',         cls: 'fmt-draw'    };
            case 'fig':                            return { icon: 'figma',            cls: 'fmt-draw'    };
            default:                               return { icon: 'file',             cls: 'fmt-generic' };
        }
    }
}


class VisorView {

    constructor(rootId) {
        this.rootId = rootId;
    }

    pinBtnHtml(fileName) {
        const pinned = (typeof app !== 'undefined' && app && app.isPinned) ? app.isPinned(fileName) : false;
        const title  = pinned ? 'Desanclar del contexto CoffeeIA' : 'Anclar al contexto CoffeeIA';
        return `<button type="button" class="sidebar-pin-btn ${pinned ? 'is-pinned' : ''}" data-pin-file="${fileName}" title="${title}">
            <i data-lucide="pin" class="w-3 h-3"></i>
        </button>`;
    }

    // Boton de borrado: solo para archivos locales reales (Drive y modo SAMPLE no aplican).
    delBtnHtml(file) {
        if (!file || file.lazyDrive || !file.fullPath) return '';
        return `<button type="button" class="sidebar-del-btn" data-del-file="${file.file}" title="Eliminar archivo">
            <i data-lucide="trash-2" class="w-3 h-3"></i>
        </button>`;
    }

    applyTheme(theme) {
        const t = theme === 'light' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', t);
        document.body.setAttribute('data-theme', t);
        const iconName = t === 'dark' ? 'sun' : 'moon';
        $('#btnThemeToggle').html(`<i data-lucide="${iconName}" class="w-4 h-4"></i>`);
        if (window.lucide) lucide.createIcons();
    }

    applyDocStyle(style) {
        const valid = ['github', 'notion', 'dracula', 'monokai'].includes(style) ? style : 'github';
        $('#md-rendered').attr('data-style', valid);
        const hljsTheme = document.getElementById('hljsTheme');
        if (hljsTheme) {
            const base = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/';
            const map = {
                github:  base + 'github.min.css',
                notion:  base + 'github.min.css',
                dracula: base + 'base16/dracula.min.css',
                monokai: base + 'monokai.min.css'
            };
            hljsTheme.href = map[valid];
        }
    }

    applyDocZoom(zoom) {
        const z = Math.min(1.8, Math.max(0.7, Number(zoom) || 1));
        const el = document.getElementById('md-rendered');
        if (el) el.style.setProperty('--vsr-doc-zoom', String(z));
        $('#docZoomValue').text(Math.round(z * 100) + '%');
        $('#btnZoomOut').prop('disabled', z <= 0.7);
        $('#btnZoomIn').prop('disabled',  z >= 1.8);
    }

    renderHeader(header, totalCount) {
        $('#headerTitle').text(header.title);
        $('#headerSubtitle').text(header.currentLabel || header.subtitle);
        $('#userInitials').text(header.user.initials);
        $('#userName').text(header.user.name);
        $('#userRole').text(header.user.role);
        $('#totalCountChip').text(totalCount);
    }

    renderFolderPicker(header, settings) {
        const presets = Array.isArray(header.presets) ? header.presets : [];
        const $sel    = $('#folderSelect');
        const opts    = presets.map(p =>
            `<option value="${p.key}" ${p.exists ? '' : 'disabled'}>${p.label}${p.exists ? '' : ' (no existe)'}</option>`
        ).join('');
        $sel.html(opts + `<option value="custom">Custom...</option>`);

        if (settings.folder === 'custom') {
            $sel.val('custom');
            $('#folderCustomPath').removeClass('hidden').val(settings.customPath || '');
            $('#btnFolderApply, #btnFolderBrowse').removeClass('hidden');
        } else {
            $sel.val(settings.folder);
            $('#folderCustomPath').addClass('hidden');
            $('#btnFolderApply, #btnFolderBrowse').addClass('hidden');
        }
    }

    renderFooter(data) {
        let total = 0;
        if (data.documents && typeof data.documents === 'object') {
            for (const proj in data.documents) {
                for (const tipo in data.documents[proj]) {
                    total += data.documents[proj][tipo].length;
                }
            }
            $('#footerAgentsCount').text(0);
            $('#footerGrimoiresCount').text(0);
        } else {
            total = data.agents.length + data.grimoires.length;
            $('#footerAgentsCount').text(data.agents.length);
            $('#footerGrimoiresCount').text(data.grimoires.length);
        }
        $('#footerTotal').text(total);
        $('#footerPath').text(data.header.pathLabel);
        $('#footerSource').text(data.header.source);
    }

    renderSidebar(data, currentFile, filter) {
        if (data.documents && typeof data.documents === 'object') {
            return this.renderSidebarTree(data.documents, currentFile, filter, data.header);
        }

        // Solo el arbol de documentos lleva el acento rojo "carpeta de archivos".
        $('#sidebarList').removeClass('is-doc-tree');

        const agentsFiltered     = visor.filterFiles(data.agents, filter);
        const grimoiresFiltered  = visor.filterFiles(data.grimoires, filter);
        const mainLabel          = data.header.currentLabel || 'Archivos';
        const subLabel           = data.header.sectionLabel;

        // Crear archivos solo aplica a origenes locales validos (no Drive).
        const canCreate = !!(data.header && data.header.source !== 'Drive'
            && data.header.currentPath && data.header.valid !== false);
        const newBtnHtml = `<button id="btnNewFile" class="section-new-btn" title="Crear un archivo nuevo en esta carpeta"><i data-lucide="file-plus" class="w-3.5 h-3.5"></i></button>`;

        // Header de seccion sin icono decorativo: solo titulo, contador y el boton "+".
        const sectionHeader = (title, count, withNew) => `
            <div class="section-header">
                <span class="flex items-center gap-1.5">${title}</span>
                <span class="flex items-center gap-1.5">
                    <span class="badge-count">${count}</span>
                    ${withNew && canCreate ? newBtnHtml : ''}
                </span>
            </div>`;

        // prependHtml: nodos de carpeta (arbol) que se inyectan antes de los archivos.
        const buildSection = (title, items, withNew, prependHtml) => {
            const rows = items.map(item => this.treeFileRowHtml(item, currentFile, 0)).join('');
            const body = (prependHtml || '') + rows;
            if (!body) {
                // Carpeta sin nada: mostramos igual el header con el boton "Nuevo".
                return (withNew && canCreate && !filter) ? sectionHeader(title, 0, true) : '';
            }
            return sectionHeader(title, items.length, withNew) + `<div>${body}</div>`;
        };

        const empty = (!agentsFiltered.length && !grimoiresFiltered.length && !(data.folders && data.folders.length)) ? `
            <div class="empty-state">
                <i data-lucide="search-x" class="w-8 h-8"></i>
                <p class="text-xs">Sin resultados</p>
            </div>
        ` : '';

        // Arbol tipo VS Code: las subcarpetas (un nivel) se muestran como nodos
        // expandibles que cargan su contenido bajo demanda. Sin "carpeta superior".
        const foldersFiltered = (data.folders || []).filter(f => {
            const t = (filter || '').trim().toLowerCase();
            return !t || f.name.toLowerCase().includes(t);
        });
        const foldersHtml = foldersFiltered.map(f => this.treeFolderNodeHtml(f, 0)).join('');

        $('#sidebarList').html(`
            ${buildSection(mainLabel, agentsFiltered, true, foldersHtml)}
            ${subLabel ? buildSection(subLabel, grimoiresFiltered, false) : ''}
            ${empty}
        `);
    }

    // Fila de archivo del arbol. depth controla la sangria (estilo VS Code).
    treeFileRowHtml(item, currentFile, depth) {
        const fmt = visor.fileFormat(item);
        const pad = 22 + (depth || 0) * 16;
        return `
            <div class="sidebar-item ${currentFile === item.file ? 'active' : ''}" data-file="${item.file}" title="${item.file}" style="padding-left:${pad}px">
                <i data-lucide="${fmt.icon}" class="file-icon ${fmt.cls}"></i>
                <span class="file-name">${item.file}</span>
                ${item.isBackup ? '<span class="badge-backup">backup</span>' : ''}
                <span class="file-size">${item.size}</span>
                ${this.delBtnHtml(item)}
                ${this.pinBtnHtml(item.file)}
            </div>`;
    }

    // Nodo de carpeta expandible (lazy). El contenido se carga al expandir.
    treeFolderNodeHtml(folder, depth) {
        const pad = 8 + (depth || 0) * 16;
        return `
            <div class="tree-folder-node">
                <div class="sidebar-item is-folder tree-folder-toggle collapsed" data-folder-path="${folder.fullPath}" data-depth="${depth || 0}" style="padding-left:${pad}px" title="${folder.name}">
                    <i data-lucide="chevron-right" class="tree-chevron tree-chevron-sm"></i>
                    <i data-lucide="folder" class="file-icon fmt-folder tree-folder-icon tree-folder-closed"></i>
                    <i data-lucide="folder-open" class="file-icon fmt-folder tree-folder-icon tree-folder-open"></i>
                    <span class="file-name">${folder.name}</span>
                </div>
                <div class="tree-folder-children collapsed"></div>
            </div>`;
    }

    renderSidebarTree(documents, currentFile, filter, header) {
        const f = (filter || '').trim().toLowerCase();
        // Crear archivos solo en origenes locales validos (Drive no usa 'save').
        // El unico boton "+" vive en la cabecera raiz; el destino se elige en el modal.
        const canCreate = !!(header && header.source !== 'Drive' && header.currentPath && header.valid !== false);
        let expandedTypes = [];
        try { expandedTypes = JSON.parse(localStorage.getItem('visor:tree:expandedTypes') || '[]'); }
        catch (e) { expandedTypes = []; }
        // Cuando hay filtro activo, abrimos todo para que se vean los resultados.
        const forceOpen = f !== '';

        const filterMatch = (item) => {
            if (!f) return true;
            const hay = `${item.name} ${item.frontmatter?.description || ''} ${item.project || ''} ${item.type || ''}`.toLowerCase();
            return hay.includes(f);
        };

        const typeSort = (a, b) => {
            if (a === '(sin clasificar)') return 1;
            if (b === '(sin clasificar)') return -1;
            return a.localeCompare(b);
        };

        const fileRow = (item) => {
            const fmt = visor.fileFormat(item);
            return `
                <div class="sidebar-item ${currentFile === item.file ? 'active' : ''}" data-file="${item.file}" title="${item.file}">
                    <i data-lucide="${fmt.icon}" class="file-icon ${fmt.cls}"></i>
                    <span class="file-name">${item.file}</span>
                    ${item.isBackup ? '<span class="badge-backup">backup</span>' : ''}
                    <span class="file-size">${item.size}</span>
                    ${this.delBtnHtml(item)}
                    ${this.pinBtnHtml(item.file)}
                </div>`;
        };

        // Contenido interno (tipos + archivos) de UN proyecto. openTypes = true abre los
        // tipos de entrada (vista de carpeta) para ver el contenido sin un clic extra.
        const buildProjectInner = (proj, openTypes) => {
            const types = documents[proj];
            let total = 0, inner = '';
            for (const tipo of Object.keys(types).sort(typeSort)) {
                const matched = f ? types[tipo].filter(filterMatch) : types[tipo];
                if (!matched.length) continue;
                total += matched.length;
                const typeKey = `${proj}::${tipo}`;
                const typeCollapsed = (forceOpen || openTypes) ? false : !expandedTypes.includes(typeKey);
                inner += `
                    <div class="tree-type-header ${typeCollapsed ? 'collapsed' : ''}" data-type-key="${typeKey}">
                        <span class="tree-type-label">
                            <i data-lucide="chevron-right" class="tree-chevron tree-chevron-sm"></i>
                            <i data-lucide="folder" class="tree-folder-icon tree-folder-closed"></i>
                            <i data-lucide="folder-open" class="tree-folder-icon tree-folder-open"></i>
                            <span class="tree-type-name">${tipo}</span>
                        </span>
                        <span class="badge-count">${matched.length}</span>
                    </div>
                    <div class="tree-files-wrap ${typeCollapsed ? 'collapsed' : ''}" data-type-body="${typeKey}">${matched.map(fileRow).join('')}</div>`;
            }
            return { total, inner };
        };

        const projNames = Object.keys(documents).sort((a, b) => a.localeCompare(b));

        // Carpeta abierta (navegacion tipo explorador). Solo aplica SIN filtro; si la
        // carpeta ya no existe (cambio de origen) se cae a la vista raiz.
        let docFolder = '';
        try { docFolder = localStorage.getItem('visor:docs:folder') || ''; } catch (e) {}
        if (docFolder && !documents[docFolder]) docFolder = '';

        let hasAny = false;
        let body = '';

        if (f) {
            // BUSQUEDA: acordeon de todas las carpetas con coincidencias (abierto).
            for (const proj of projNames) {
                const { total, inner } = buildProjectInner(proj, false);
                if (!total) continue;
                hasAny = true;
                body += `
                    <div class="tree-project-header" data-project="${proj}">
                        <span class="tree-type-label">
                            <i data-lucide="chevron-right" class="tree-chevron"></i>
                            <i data-lucide="folder" class="tree-folder-icon tree-folder-closed"></i>
                            <i data-lucide="folder-open" class="tree-folder-icon tree-folder-open"></i>
                            <span class="font-semibold tree-project-name">${proj}</span>
                        </span>
                        <span class="badge-count">${total}</span>
                    </div>
                    <div class="tree-project-body">${inner}</div>`;
            }
        } else if (docFolder) {
            // VISTA DE CARPETA: solo el contenido de la carpeta abierta + boton "volver".
            // openTypes=false -> los sub-grupos aparecen COLAPSADOS (se expanden al clic).
            const { total, inner } = buildProjectInner(docFolder, false);
            hasAny = total > 0;
            body = `
                <div class="docs-folder-back" title="Volver a las carpetas">
                    <i data-lucide="chevron-left" class="tree-chevron tree-chevron-sm"></i>
                    <i data-lucide="folder-open" class="tree-folder-icon"></i>
                    <span class="docs-folder-current">${docFolder}</span>
                    <span class="badge-count">${total}</span>
                </div>
                <div class="docs-folder-content">${inner || '<div class="tree-loading">Carpeta vacia</div>'}</div>`;
        } else {
            // VISTA RAIZ: lista de carpetas navegables (un clic entra a la carpeta).
            for (const proj of projNames) {
                const { total } = buildProjectInner(proj, false);
                if (!total) continue;
                hasAny = true;
                body += `
                    <div class="sidebar-item is-folder docs-folder-row" data-project="${proj}" title="Abrir ${proj}">
                        <i data-lucide="folder" class="file-icon fmt-folder"></i>
                        <span class="file-name">${proj}</span>
                        <span class="badge-count">${total}</span>
                        <i data-lucide="chevron-right" class="docs-folder-arrow"></i>
                    </div>`;
            }
        }

        const empty = !hasAny ? `
            <div class="empty-state">
                <i data-lucide="search-x" class="w-8 h-8"></i>
                <p class="text-xs">Sin resultados</p>
            </div>
        ` : '';

        // Cabecera raiz del arbol: unico punto de creacion. El destino se elige
        // dentro del modal (selector de carpetas), no por carpeta del arbol.
        const rootHeader = canCreate ? `
            <div class="tree-root-header">
                <span class="tree-root-title">${(header && header.currentLabel) || 'Documentos'}</span>
                <button type="button" class="tree-new-btn tree-root-new" title="Nuevo archivo — elige la carpeta destino">
                    <i data-lucide="file-plus" class="w-4 h-4"></i>
                </button>
            </div>` : '';

        $('#sidebarList').html(rootHeader + body + empty).addClass('is-doc-tree');

        const reRender = () => {
            visorView.renderSidebar(app.dataInit, app.currentFile, '');
            app.bindSidebarClicks();
            if (window.lucide) lucide.createIcons();
        };

        // Entrar a una carpeta (vista raiz -> vista de carpeta).
        $('#sidebarList .docs-folder-row').off('click').on('click', (e) => {
            const proj = $(e.currentTarget).data('project');
            try { localStorage.setItem('visor:docs:folder', proj); } catch (er) {}
            reRender();
        });

        // Volver a la lista de carpetas (vista de carpeta -> vista raiz).
        $('#sidebarList .docs-folder-back').off('click').on('click', () => {
            try { localStorage.removeItem('visor:docs:folder'); } catch (er) {}
            reRender();
        });

        // Acordeon de proyecto (solo en vista de busqueda).
        $('#sidebarList .tree-project-header').off('click').on('click', (e) => {
            const $header = $(e.currentTarget);
            $header.toggleClass('collapsed');
            $header.next('.tree-project-body').toggleClass('collapsed');
            if (window.lucide) lucide.createIcons();
        });

        // Bind collapse toggle de tipo (nivel 2) — sub-carpeta
        $('#sidebarList .tree-type-header').off('click').on('click', (e) => {
            const $header = $(e.currentTarget);
            const key = $header.data('type-key');
            $header.toggleClass('collapsed');
            $('#sidebarList .tree-files-wrap[data-type-body="' + key + '"]').toggleClass('collapsed');
            let state = [];
            try { state = JSON.parse(localStorage.getItem('visor:tree:expandedTypes') || '[]'); }
            catch (e) { state = []; }
            if ($header.hasClass('collapsed')) {
                state = state.filter(k => k !== key);
            } else if (!state.includes(key)) {
                state.push(key);
            }
            localStorage.setItem('visor:tree:expandedTypes', JSON.stringify(state));
            if (window.lucide) lucide.createIcons();
        });

        // Boton "+" de la raiz: abre el modal "Nuevo archivo"; la carpeta destino
        // se elige ahi con un selector. stopPropagation para no togglear nada.
        $('#sidebarList .tree-root-new').off('click').on('click', (e) => {
            e.stopPropagation();
            if (typeof app !== 'undefined' && app && app.openNewFileModal) {
                app.openNewFileModal();
            }
        });
    }

    renderBreadcrumb(file, header) {
        if (file.section === 'documents' || file.project) {
            const proj = file.project || '—';
            const tipo = file.type || '—';
            $('#breadcrumbSection').text(`documents / ${proj.toLowerCase()} / ${tipo.toLowerCase()}`);
        } else {
            const root = header?.currentLabel || (file.section === 'agentes' ? 'agents' : 'agents/grimorios');
            const path = file.section === 'grimorios' && header?.sectionLabel
                ? `${root} / ${header.sectionLabel.toLowerCase()}`
                : root;
            $('#breadcrumbSection').text(path);
        }
        $('#breadcrumbFile').text(file.file);
    }

    renderFrontmatter(file) {
        const fm = file.frontmatter || {};
        const hasData = !!(fm.name || fm.description || fm.model || fm.status || fm.date || fm.type || fm.project);

        // Si el archivo no tiene frontmatter util, ocultamos la card entera.
        const $card = $('#frontmatterCard');
        if (!hasData) {
            $card.hide();
            $('#fmChipsWrap').empty();
            $('#frontmatterBody').empty();
            return;
        }
        $card.show();

        const $badge = $('#fmFileBadge');
        if (file.isBackup) {
            $badge.text('backup').attr('class', 'cs-badge badge-secondary');
        } else if (file.section === 'documents') {
            $badge.text('documento').attr('class', 'cs-badge badge-info');
        } else if (file.section === 'agentes') {
            $badge.text('agente').attr('class', 'cs-badge badge-primary');
        } else {
            $badge.text('grimorio').attr('class', 'cs-badge badge-success');
        }

        $('#fmSizeBadge').text(file.size);

        const chips = [];
        if (fm.type) chips.push(`<span class="cs-badge badge-info">${fm.type}</span>`);
        if (fm.project) chips.push(`<span class="cs-badge" style="background:rgba(192,90,64,.18);color:#F7F0EB;border:1px solid rgba(192,90,64,.35)">${fm.project}</span>`);
        $('#fmChipsWrap').html(chips.join(' '));

        // Solo emitimos las filas que realmente tienen valor.
        const rows = [];
        if (fm.name)        rows.push(`<div class="fm-row"><span class="fm-key">name</span><span class="fm-val">${fm.name}</span></div>`);
        if (fm.description) rows.push(`<div class="fm-row"><span class="fm-key">description</span><span class="fm-val">${fm.description}</span></div>`);
        if (fm.model)       rows.push(`<div class="fm-row"><span class="fm-key">model</span><span class="fm-val model">${fm.model}</span></div>`);
        if (fm.status)      rows.push(`<div class="fm-row"><span class="fm-key">status</span><span class="fm-val">${fm.status}</span></div>`);
        if (fm.date)        rows.push(`<div class="fm-row"><span class="fm-key">date</span><span class="fm-val">${fm.date}</span></div>`);
        $('#frontmatterBody').html(rows.join(''));
    }

    renderContent(file) {
        const parts = (file.file || '').split('.');
        const ext   = parts.length > 1 ? parts.pop().toLowerCase() : '';
        // Google Docs nativos exportan como markdown — tratar como md aunque
        // el nombre del archivo no tenga extension .md
        const isMd  = ext === 'md' || ext === 'markdown' || ext === ''
                      || file.mimeType === 'application/vnd.google-apps.document';
        const hasXlsxBinary = !!file._binary && typeof XLSX !== 'undefined';
        const isSheetCsv    = !hasXlsxBinary && (
                                ['csv','tsv'].includes(ext) && file.lazyDrive
                              );
        const isSheet = hasXlsxBinary || isSheetCsv;

        // Modo hoja de calculo: el contenedor padre tiene que romper el max-width y padding
        // de articulo Markdown para que la tabla aproveche todo el ancho disponible.
        $('#md-rendered').toggleClass('is-sheet', !!isSheet);

        let rendered;
        if (hasXlsxBinary) {
            rendered = visor.renderXlsxWorkbook(file._binary);
        } else if (isSheetCsv) {
            rendered = visor.renderCsvAsTable(file.raw, ext === 'tsv' ? '\t' : ',');
        } else if (isMd) {
            const body = visor.stripFrontmatter(file.raw);
            rendered = (typeof marked !== 'undefined' && marked.parse)
                ? marked.parse(body)
                : `<pre style="white-space:pre-wrap;">${body.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre>`;
        } else {
            // Archivos de codigo: mostrar como bloque highlighted, sin pasar por marked
            const lang    = visor.extToHljsLang(ext);
            const escaped = file.raw.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
            rendered = `<pre class="md-code-fullfile"><code class="language-${lang}">${escaped}</code></pre>`;
        }
        $('#md-rendered').html(rendered);

        if (hasXlsxBinary) this._wireSheetTabs();

        const tocItems = [];
        const usedSlugs = new Set();

        $('#md-rendered').find('h2, h3').each(function () {
            const $h = $(this);
            const text = $h.text().trim();
            let slug = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').substring(0, 60);
            let finalSlug = slug;
            let counter = 1;
            while (usedSlugs.has(finalSlug)) {
                finalSlug = slug + '-' + counter++;
            }
            usedSlugs.add(finalSlug);
            $h.attr('id', finalSlug);

            if (this.tagName === 'H2') {
                tocItems.push({ level: 2, slug: finalSlug, text, children: [] });
            } else {
                const last = tocItems[tocItems.length - 1];
                if (last && last.level === 2) {
                    last.children.push({ slug: finalSlug, text });
                } else {
                    tocItems.push({ level: 3, slug: finalSlug, text });
                }
            }
        });

        // Para libros xlsx ocultamos el aside completo y la tabla toma todo el ancho.
        $('body').toggleClass('xlsx-view', !!hasXlsxBinary);
        if (!hasXlsxBinary) $('#tocBody').html(this.buildTocHtml(tocItems));

        if (typeof hljs !== 'undefined') {
            $('#md-rendered pre code').each(function (i, block) {
                hljs.highlightElement(block);
            });
        }

        if (hasXlsxBinary) {
            $('#md-raw').text('// Archivo binario (.xlsx/.xls/.ods). Vista Raw no disponible.');
            $('#lineCountChip').text('hoja de calculo');
        } else {
            $('#md-raw').text(file.raw);
            $('#lineCountChip').text(`~ ${visor.countLines(file.raw)} lineas`);
        }

        const $main = $('.main-content');
        if ($main.length) $main.scrollTop(0);
    }

    buildTocHtml(items) {
        if (!items.length) return '<span class="toc-empty">Sin secciones</span>';
        const rows = items.map(it => {
            if (it.level === 3) {
                return `<li class="toc-h3" data-toc-target="${it.slug}"><span class="toc-text">${it.text}</span></li>`;
            }
            if (!it.children.length) {
                return `<li class="toc-h2" data-toc-target="${it.slug}"><span class="toc-chevron-slot"></span><span class="toc-text">${it.text}</span></li>`;
            }
            const children = it.children.map(c =>
                `<li class="toc-h3" data-toc-target="${c.slug}"><span class="toc-text">${c.text}</span></li>`
            ).join('');
            return `
                <li class="toc-h2 has-children collapsed" data-toc-target="${it.slug}">
                    <i data-lucide="chevron-right" class="toc-chevron"></i>
                    <span class="toc-text">${it.text}</span>
                    <ul class="toc-children collapsed">${children}</ul>
                </li>
            `;
        }).join('');
        return `<ul class="toc-tree">${rows}</ul>`;
    }

    renderEmptyMain() {
        $('#md-rendered').html(`
            <div class="empty-state" style="padding:80px 20px;">
                <i data-lucide="folder-x" class="w-10 h-10"></i>
                <p class="text-sm" style="margin-top:8px;">Carpeta vacia o sin archivos .md</p>
            </div>
        `);
        $('#md-raw').text('');
        $('#lineCountChip').text('~ 0 lineas');
        $('#breadcrumbFile').text('—');
        $('#frontmatterBody').html('');
        $('#fmSizeBadge').text('—');
        $('#tocBody').html('<span class="toc-empty">Sin secciones</span>');
        $('#footerFile').text('—');
        $('#footerSize').text('—');
    }

    renderFooterSelection(file) {
        $('#footerFile').text(file.file);
        $('#footerSize').text(file.size);
    }

    toast(msg, tone = 'success') {
        const $t = $('#visorToast');
        if (!$t.length) return;
        $t.text(msg).attr('data-tone', tone).addClass('visible');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => $t.removeClass('visible'), 2400);
    }

    _wireSheetTabs() {
        const $root = $('#md-rendered');
        $root.off('click.sheetTab').on('click.sheetTab', '.sheet-tab', function () {
            const $btn = $(this);
            const idx  = $btn.data('sheet-idx');
            const $wb  = $btn.closest('.xlsx-workbook');
            $wb.find('.sheet-tab').removeClass('active');
            $btn.addClass('active');
            const $panels = $wb.find('.sheet-panel');
            $panels.removeClass('active');
            $panels.filter(`[data-sheet-panel="${idx}"]`).addClass('active');
        });
    }

    showDriveLoader(file) {
        $('#md-rendered').html('<div id="driveLoaderHost" class="drive-loader-mount"></div>');
        this._mountCoffeeLoader('driveLoaderHost', `Cargando ${file?.file || 'archivo'}`, 'circle');
    }

    hideDriveLoader() {
        $('#driveLoaderHost').remove();
    }

    showGlobalDriveLoader(folderLabel) {
        $('#globalDriveLoader').remove();
        $('body').append('<div id="globalDriveLoader" class="global-drive-loader"><div id="globalDriveLoaderHost"></div></div>');
        this._mountCoffeeLoader('globalDriveLoaderHost', folderLabel || 'Conectando con Drive', 'primary');
    }

    hideGlobalDriveLoader() {
        $('#globalDriveLoader').remove();
    }

    _mountCoffeeLoader(hostId, text, variant) {
        if (typeof Templates === 'undefined') return;
        try {
            if (!this._cs) this._cs = new Templates();
            const opts = {
                parent: hostId,
                text:   text,
                color:  '#8B5CF6'
            };
            if (variant === 'primary') {
                // Loader hero (cambio de carpeta Drive): gota gooey con la imagen institucional.
                opts.variant = 'primary';
                opts.size    = 'lg';
                opts.image   = '../src/img/coffee_white.png';
            } else {
                // Loader compacto (carga de documento individual): circulo girando.
                opts.variant = 'circle';
                opts.size    = 'md';
            }
            this._cs.coffeeLoader(opts);
        } catch (e) { /* coffeeSoft no cargado o roto: no mostrar nada */ }
    }
}


const COFFEEIA_EDITOR_KEY = 'visor:coffeeia:editorMode';
const COFFEEIA_LAYOUT_KEY = 'visor:coffeeia:layoutMode';
const COFFEEIA_GRAPH_KEY  = 'visor:coffeeia:graphMode';
const COFFEEIA_EXCALI_KEY = 'visor:coffeeia:excaliMode';
const COFFEEIA_MODEL_KEY  = 'visor:coffeeia:model';

// Tipos de grafica que el modo grafica puede instruir a la IA a generar.
const COFFEEIA_GRAPH_TYPES = ['mermaid', 'drawio', 'excalidraw'];
const COFFEEIA_GRAPH_LABELS = { mermaid: 'Mermaid', drawio: 'draw.io', excalidraw: 'Excalidraw' };
// Sub-modos de Excalidraw: 'libre' (boceto libre) o 'template' (maestros + tabla).
const COFFEEIA_EXCALI_MODES = ['libre', 'template'];

// Extensiones de archivo que tratamos como TEXTO plano: se leen con readAsText y
// se inyectan al contexto del chat (no como imagen). Cubre texto, codigo, marcado
// y datos. Los binarios (pdf/docx/xlsx) NO entran aqui: no son texto plano.
const IA_TEXT_EXTS = [
    'txt', 'md', 'markdown', 'rtf', 'log', 'csv', 'tsv',
    'html', 'htm', 'xml', 'svg', 'json', 'json5', 'yaml', 'yml', 'toml', 'ini', 'env', 'conf',
    'js', 'mjs', 'cjs', 'ts', 'jsx', 'tsx', 'css', 'scss', 'less',
    'php', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'h', 'cpp', 'cs', 'swift',
    'sql', 'sh', 'bash', 'ps1', 'bat', 'vue', 'astro'
];
const IA_TEXT_MIME_RE = /^(text\/|application\/(json|xml|javascript|x-yaml|x-sh|sql)|image\/svg)/i;

/** Decide si un File es texto plano (por extension o MIME). */
function iaIsTextFile(file) {
    if (!file) return false;
    const ext = (file.name || '').split('.').pop().toLowerCase();
    if (IA_TEXT_EXTS.indexOf(ext) !== -1) return true;
    return IA_TEXT_MIME_RE.test(file.type || '');
}

/**
 * Construye los <span> del footer de metadatos de un mensaje IA.
 * Prioriza el COSTO REAL en USD (lo trae OpenRouter via usage.cost); si no hay
 * costo (modelos Ollama), cae al "Credits" estimado por tokens. Anade el
 * desglose de tokens entrada/salida y el tiempo. Devuelve solo los meta-item,
 * para insertarlos antes del bloque de acciones (copiar).
 */
function iaMetaItems(meta) {
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

class CoffeeIA {

    constructor(apiEndpoint, appRef) {
        this._api     = apiEndpoint;
        // Endpoint gemelo en streaming (SSE). Mismo contexto, transporte distinto.
        this._apiStream = apiEndpoint.replace('ctrl-coffeeia.php', 'ctrl-coffeeia-stream.php');
        // Endpoint de persistencia de conversaciones (SQLite).
        this._apiChats  = apiEndpoint.replace('ctrl-coffeeia.php', 'ctrl-chats.php');
        // Endpoint de GitHub Projects (GraphQL via token en credentials/.env).
        this._apiGithub = apiEndpoint.replace('ctrl-coffeeia.php', 'ctrl-github.php');
        this._app     = appRef;
        this.history  = [];
        this._currentChatUid = null;   // uid de la conversacion guardada activa (para re-guardar/actualizar)
        this.isOpen   = false;
        this.isBusy   = false;
        this._abort   = null;   // AbortController de la consulta en curso (botón Detener)
        this._chipsRendered = false;
        this.editorMode    = this._loadEditorMode();
        this.layoutMode    = this._loadLayoutMode();
        this.graphMode     = this._loadGraphMode();   // '' | 'mermaid' | 'drawio' | 'excalidraw'
        this.excaliMode    = this._loadExcaliMode();  // 'libre' | 'template' (sub-modo de excalidraw)
        this.activeDb      = null;   // base MySQL conectada en la conversacion (persistente entre turnos)
        this.pendingEdits  = null;   // [{ find, with, status }]
        this.pendingImages = [];     // [{ dataUrl, base64, mime, name }]
        this.pendingDocs   = [];     // [{ name, content, size }] archivos de texto adjuntos al mensaje
        this.model         = this._loadModel();

        this.bind();
        this._syncContext();
        this._applyEditorModeUI();
        this._applyLayoutModeUI();
        this._applyGraphModeUI();
        this._applyModelUI();
    }

    _loadModel() {
        try { return localStorage.getItem(COFFEEIA_MODEL_KEY) || ''; }
        catch (e) { return ''; }
    }

    _saveModel() {
        try { localStorage.setItem(COFFEEIA_MODEL_KEY, this.model || ''); }
        catch (e) {}
    }

    _applyModelUI() {
        const $sel = $('#iaModelSelect');
        if (!$sel.length) return;
        if (this.model && $sel.find('option[value="' + this.model + '"]').length) {
            $sel.val(this.model);
        } else {
            this.model = $sel.val() || '';
            this._saveModel();
        }
    }

    _loadEditorMode() {
        try { return localStorage.getItem(COFFEEIA_EDITOR_KEY) === '1'; }
        catch (e) { return false; }
    }

    _saveEditorMode() {
        try { localStorage.setItem(COFFEEIA_EDITOR_KEY, this.editorMode ? '1' : '0'); }
        catch (e) {}
    }

    _toggleEditorMode() {
        this.editorMode = !this.editorMode;
        // Editor, layout y grafica son mutuamente excluyentes: activar uno apaga los otros.
        if (this.editorMode) {
            if (this.layoutMode) { this.layoutMode = false; this._saveLayoutMode(); this._applyLayoutModeUI(); }
            if (this.graphMode)  { this.graphMode  = '';    this._saveGraphMode();  this._applyGraphModeUI();  }
        }
        this._saveEditorMode();
        this._applyEditorModeUI();
    }

    _applyEditorModeUI() {
        const $btn = $('#iaEditorToggle');
        $btn.toggleClass('is-active', this.editorMode);
        $btn.attr('title', this.editorMode
            ? 'Modo editor ACTIVO — la IA propondra cambios al archivo abierto'
            : 'Activar modo editor (la IA propondra cambios al archivo abierto)');
        this._applyInputPlaceholder();
    }

    _loadLayoutMode() {
        try { return localStorage.getItem(COFFEEIA_LAYOUT_KEY) === '1'; }
        catch (e) { return false; }
    }

    _saveLayoutMode() {
        try { localStorage.setItem(COFFEEIA_LAYOUT_KEY, this.layoutMode ? '1' : '0'); }
        catch (e) {}
    }

    _toggleLayoutMode() {
        this.layoutMode = !this.layoutMode;
        // Editor, layout y grafica son mutuamente excluyentes: activar uno apaga los otros.
        if (this.layoutMode) {
            if (this.editorMode) { this.editorMode = false; this._saveEditorMode(); this._applyEditorModeUI(); }
            if (this.graphMode)  { this.graphMode  = '';    this._saveGraphMode();  this._applyGraphModeUI();  }
        }
        this._saveLayoutMode();
        this._applyLayoutModeUI();
    }

    _applyLayoutModeUI() {
        const $btn = $('#iaCanvasToggle');
        $btn.toggleClass('is-active', this.layoutMode);
        $btn.attr('title', this.layoutMode
            ? 'Modo Layout ACTIVO — la respuesta se mostrara como documento en el panel de lectura'
            : 'Activar modo Layout (la respuesta se mostrara como documento en el panel de lectura)');
        this._applyInputPlaceholder();
    }

    /* ── Modo grafica: la IA genera diagramas (mermaid / draw.io / excalidraw) ── */

    _loadGraphMode() {
        try {
            const v = localStorage.getItem(COFFEEIA_GRAPH_KEY) || '';
            return COFFEEIA_GRAPH_TYPES.indexOf(v) !== -1 ? v : '';
        } catch (e) { return ''; }
    }

    _saveGraphMode() {
        try { localStorage.setItem(COFFEEIA_GRAPH_KEY, this.graphMode || ''); }
        catch (e) {}
    }

    _loadExcaliMode() {
        try {
            const v = localStorage.getItem(COFFEEIA_EXCALI_KEY) || '';
            return COFFEEIA_EXCALI_MODES.indexOf(v) !== -1 ? v : 'libre';
        } catch (e) { return 'libre'; }
    }

    _saveExcaliMode() {
        try { localStorage.setItem(COFFEEIA_EXCALI_KEY, this.excaliMode || 'libre'); }
        catch (e) {}
    }

    // Despliega/oculta el submenu de Excalidraw (Template / Libre) anclado al item
    // del menu de herramientas. FIXED para escapar del overflow del drawer.
    _toggleExcaliSubmenu(anchorEl) {
        const $sub = $('#iaExcaliSubmenu');
        if ($sub.is(':visible')) { $sub.hide(); return; }

        $sub.css({ display: 'block', visibility: 'hidden', top: '0px', left: '0px' });
        const rect = anchorEl.getBoundingClientRect();
        const sw   = $sub.outerWidth();
        const sh   = $sub.outerHeight();
        const gap  = 6;

        // Abre a la DERECHA del item; si no cabe, a la izquierda. Alinea por arriba.
        let left = rect.right + gap;
        if (left + sw > window.innerWidth - 8) left = rect.left - sw - gap;
        left = Math.max(8, left);
        let top = rect.top;
        top = Math.max(8, Math.min(top, window.innerHeight - sh - 8));

        $sub.css({ left: left + 'px', top: top + 'px', visibility: 'visible' });
        if (window.lucide) lucide.createIcons();
    }

    // Selecciona el sub-modo de Excalidraw (template/libre) y activa el modo grafica
    // excalidraw. Re-elegir el sub-modo ya activo apaga el modo grafica (toggle off).
    _setExcaliMode(sub) {
        sub = (sub === 'template') ? 'template' : 'libre';
        const sameActive = this.graphMode === 'excalidraw' && this.excaliMode === sub;
        this.excaliMode = sub;
        this._saveExcaliMode();

        if (sameActive) {
            this.graphMode = '';
        } else {
            this.graphMode = 'excalidraw';
            // Grafica es excluyente con editor y layout.
            if (this.editorMode) { this.editorMode = false; this._saveEditorMode(); this._applyEditorModeUI(); }
            if (this.layoutMode) { this.layoutMode = false; this._saveLayoutMode(); this._applyLayoutModeUI(); }
        }
        this._saveGraphMode();
        this._applyGraphModeUI();
        $('#iaExcaliSubmenu').hide();
        $('#iaToolsMenu').hide();
    }

    // Abre/cierra el menu de herramientas posicionandolo FIXED sobre el boton
    // (abre hacia arriba). Fixed evita que el overflow:hidden del drawer lo recorte.
    _toggleToolsMenu(btnEl) {
        const $menu = $('#iaToolsMenu');
        $('#iaExcaliSubmenu').hide();   // el submenu nunca sobrevive a abrir/cerrar el menu padre
        if ($menu.is(':visible')) { $menu.hide(); return; }

        // Medir con el menu visible pero invisible para no parpadear.
        $menu.css({ display: 'block', visibility: 'hidden', top: '0px', left: '0px' });
        const rect = btnEl.getBoundingClientRect();
        const mw   = $menu.outerWidth();
        const mh   = $menu.outerHeight();
        const gap  = 8;

        // Alineado al borde izquierdo del boton y abriendo hacia la DERECHA y hacia
        // arriba; con clamps para que nunca se salga del viewport.
        let left = rect.left;
        let top  = rect.top - mh - gap;
        left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
        if (top < 8) top = rect.bottom + gap;   // si no cabe arriba, abre hacia abajo

        $menu.css({ left: left + 'px', top: top + 'px', visibility: 'visible' });
        if (window.lucide) lucide.createIcons();
    }

    // Abre el diagrama/boceto en OTRA pestaña: deja el contenido en localStorage y
    // abre index.php?diagram=1, que lo recoge y lo muestra en el lienzo.
    _openDiagramInTab(type, name, content) {
        if (!content) return;
        try {
            localStorage.setItem('visor:openDiagram', JSON.stringify({ type, name, content }));
        } catch (e) {
            if (typeof visorView !== 'undefined' && visorView) visorView.toast('No se pudo preparar la pestaña', 'error');
            return;
        }
        // full=1: la pestaña muestra SOLO el grafico a pantalla completa (sin chrome).
        window.open('index.php?diagram=1&full=1', '_blank');
    }

    // Selecciona un tipo de grafica. Re-seleccionar el tipo activo lo apaga (toggle).
    _setGraphMode(type) {
        if (COFFEEIA_GRAPH_TYPES.indexOf(type) === -1) return;
        this.graphMode = (this.graphMode === type) ? '' : type;
        // Grafica es excluyente con editor y layout: al activarla, apaga los otros.
        if (this.graphMode) {
            if (this.editorMode) { this.editorMode = false; this._saveEditorMode(); this._applyEditorModeUI(); }
            if (this.layoutMode) { this.layoutMode = false; this._saveLayoutMode(); this._applyLayoutModeUI(); }
        }
        this._saveGraphMode();
        this._applyGraphModeUI();
    }

    _applyGraphModeUI() {
        const mode = this.graphMode || '';
        // Marca el tipo activo dentro del menu de herramientas.
        $('#iaToolsMenu .graph-menu-item[data-graph]').each(function () {
            $(this).toggleClass('is-active', $(this).data('graph') === mode);
        });
        // Marca el sub-modo activo de Excalidraw (solo cuando excalidraw esta activo).
        $('#iaExcaliSubmenu .graph-menu-item[data-excali]').each((_, el) => {
            const $el = $(el);
            $el.toggleClass('is-active', mode === 'excalidraw' && $el.data('excali') === this.excaliMode);
        });
        this._applyToolsActive();
        this._applyInputPlaceholder();
    }

    // El boton de herramientas se marca activo cuando el modo grafica esta
    // encendido (su unico toggle), para que el estado se vea con el menu cerrado.
    // Editor y lienzo son botones sueltos con su propio estado activo.
    _applyToolsActive() {
        $('#iaToolsBtn').toggleClass('is-active', !!this.graphMode);
    }

    _applyInputPlaceholder() {
        const $ta = $('#iaInputTextarea');
        if (this.editorMode) {
            $ta.attr('placeholder', 'Pide un cambio al archivo abierto (ej: "renombra la seccion 1 a Vista panoramica")...');
        } else if (this.layoutMode) {
            $ta.attr('placeholder', 'Pide un documento y se mostrara como Layout en el panel de lectura...');
        } else if (this.graphMode) {
            let label = COFFEEIA_GRAPH_LABELS[this.graphMode] || this.graphMode;
            if (this.graphMode === 'excalidraw' && this.excaliMode === 'template') {
                label += ' (template: maestros + tabla)';
            }
            $ta.attr('placeholder', 'Describe el diagrama y la IA lo genera en ' + label + '...');
        } else {
            $ta.attr('placeholder', 'Pregunta algo sobre el documento...');
        }
    }

    /* ── Public: open / close / toggle ── */

    open() {
        $('#iaDrawer').addClass('is-open');
        $('#btnToggleCoffeeIA').addClass('is-active');
        // Colapsa el sidebar meta (Frontmatter + TOC) para liberar ancho al documento.
        $('body').addClass('ia-chat-open');
        this.isOpen = true;
        this._syncContext();
    }

    close() {
        $('#iaDrawer').removeClass('is-open');
        $('#btnToggleCoffeeIA').removeClass('is-active');
        $('body').removeClass('ia-chat-open');
        this.isOpen = false;
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    /* ── Bind events ── */

    bind() {
        $('#btnToggleCoffeeIA').on('click', () => this.toggle());
        $('#btnCloseIA').on('click', () => this.close());

        // Modo editor y modo layout: botones sueltos (acceso directo) en la barra.
        $('#iaEditorToggle').on('click', () => this._toggleEditorMode());
        $('#iaCanvasToggle').on('click', () => this._toggleLayoutMode());

        // Resto de herramientas agrupadas en un menu desplegable (#iaToolsBtn):
        // guardar, chats guardados, limpiar y graficas. Las acciones de una sola
        // vez cierran el menu; las graficas (toggle) lo dejan abierto para ver el
        // tipo activo.
        $('#iaToolsBtn').on('click', (e) => {
            e.stopPropagation();
            this._toggleToolsMenu(e.currentTarget);
        });
        $(document).on('click.iaToolsMenu', (e) => {
            if (!$(e.target).closest('#iaToolsMenu, #iaToolsBtn, #iaExcaliSubmenu').length) {
                $('#iaToolsMenu, #iaExcaliSubmenu').hide();
            }
        });
        // Reposicionar/cerrar si cambia el viewport mientras esta abierto.
        $(window).on('resize.iaToolsMenu scroll.iaToolsMenu', () => $('#iaToolsMenu, #iaExcaliSubmenu').hide());
        $('#iaToolsMenu').on('click', '.graph-menu-item', (e) => {
            const $it  = $(e.currentTarget);
            const tool = $it.data('tool');
            switch (tool) {
                case 'save':   $('#iaToolsMenu, #iaExcaliSubmenu').hide(); this.saveConversation();    break;
                case 'saved':  $('#iaToolsMenu, #iaExcaliSubmenu').hide(); this.openSavedChatsModal(); break;
                case 'github': $('#iaToolsMenu, #iaExcaliSubmenu').hide(); if (typeof githubBoard !== 'undefined' && githubBoard) githubBoard.open(); break;
                case 'graph':
                    // Excalidraw despliega un submenu (Template / Libre); el resto togglea directo.
                    if ($it.data('graph') === 'excalidraw') {
                        e.stopPropagation();
                        this._toggleExcaliSubmenu(e.currentTarget);
                    } else {
                        $('#iaExcaliSubmenu').hide();
                        this._setGraphMode($it.data('graph'));
                    }
                    break;
            }
        });
        // Submenu de Excalidraw: elige plantilla o modo libre.
        $('#iaExcaliSubmenu').on('click', '.graph-menu-item', (e) => {
            e.stopPropagation();
            this._setExcaliMode($(e.currentTarget).data('excali'));
        });

        $('#iaModelSelect').on('change', (e) => {
            this.model = $(e.currentTarget).val() || '';
            this._saveModel();
        });

        $('#iaSendBtn').on('click', () => { if (this.isBusy) this._stop(); else this._submit(); });

        $('#iaInputTextarea').on('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._submit();
            }
        });

        $('#iaInputTextarea').on('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 200) + 'px';
            // Solo mostramos scroll cuando el contenido real supera el maximo.
            this.style.overflowY = this.scrollHeight > 200 ? 'auto' : 'hidden';
        });

        // Adjuntar archivos: boton, file input, paste y drag&drop.
        // Imagenes -> vision; texto/codigo/html/md/csv/json -> contexto del chat.
        $('#iaAttachBtn').on('click', () => $('#iaImageInput').trigger('click'));
        $('#iaClearBtn').on('click', () => this.clearConversation());
        $('#iaImageInput').on('change', (e) => {
            const files = Array.from(e.target.files || []);
            files.forEach(f => this._addFile(f));
            $(e.target).val('');
        });
        // Pegar (Ctrl+V) a nivel de todo el chat: con el drawer abierto puedes
        // pegar un screenshot o un archivo sin tener el foco dentro del textarea.
        $(document).off('paste.coffeeIA').on('paste.coffeeIA', (e) => {
            if (!this.isOpen) return;
            const cd = e.originalEvent && e.originalEvent.clipboardData;
            if (!cd || !cd.items) return;
            let pasted = 0;
            for (const it of cd.items) {
                if (it.kind !== 'file') continue;
                const f = it.getAsFile();
                if (f && (/^image\//.test(it.type) || iaIsTextFile(f))) { this._addFile(f); pasted++; }
            }
            if (pasted) {
                e.preventDefault();
                if (typeof visorView !== 'undefined' && visorView) {
                    visorView.toast(pasted === 1 ? 'Adjunto pegado' : pasted + ' adjuntos pegados', 'success');
                }
            }
        });
        const $wrap = $('.ia-input-wrap');
        $wrap.on('dragover', (e) => { e.preventDefault(); $wrap.addClass('is-drag-over'); });
        $wrap.on('dragleave', () => $wrap.removeClass('is-drag-over'));
        $wrap.on('drop', (e) => {
            e.preventDefault();
            $wrap.removeClass('is-drag-over');
            const dt = e.originalEvent && e.originalEvent.dataTransfer;
            const files = dt ? Array.from(dt.files || []) : [];
            files.forEach(f => this._addFile(f));
        });

        $(document).on('keydown.coffeeIA', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
                e.preventDefault();
                this.toggle();
            }
        });

        $(document).on('click', '.ia-suggestion', (e) => {
            const prompt = $(e.currentTarget).data('prompt') || $(e.currentTarget).text();
            this._sendMessage(prompt);
        });
    }

    /* ── Context bar sync ── */

    _syncContext() {
        const currentFile = this._app.currentFile || '—';
        $('#iaCtxFilename').text(currentFile);

        if (currentFile && currentFile !== '—') {
            const file = visor.getFile(this._app.allFiles || [], currentFile);
            const meta = file ? `${file.size}` : '';
            $('#iaCtxMeta').text(meta);
        } else {
            $('#iaCtxMeta').text('');
        }

        this._renderPinnedChips();
    }

    _renderPinnedChips() {
        const pinned = this._app && this._app.pinnedFiles ? Array.from(this._app.pinnedFiles) : [];
        const $wrap  = $('#iaPinnedWrap');
        const $list  = $('#iaPinnedChips');
        if (!$wrap.length) return;

        if (!pinned.length) {
            $wrap.hide();
            $list.empty();
            return;
        }

        const html = pinned.map(name => {
            const f = (this._app.allFiles || []).find(x => x.file === name);
            const size = f ? f.size : '';
            return `
                <span class="ia-pinned-chip" title="${name}${size ? ' (' + size + ')' : ''}">
                    <i data-lucide="file-text" style="width:10px;height:10px;color:var(--vsr-accent-soft);"></i>
                    <span class="chip-name">${name}</span>
                    <button type="button" class="chip-remove" data-unpin="${name}" title="Desanclar">
                        <i data-lucide="x"></i>
                    </button>
                </span>
            `;
        }).join('');

        $list.html(html);
        $('#iaPinnedCount').text(pinned.length);
        $wrap.show();

        $list.find('.chip-remove').off('click').on('click', (e) => {
            e.stopPropagation();
            const name = $(e.currentTarget).data('unpin');
            if (this._app && this._app.togglePin) this._app.togglePin(name);
        });

        if (window.lucide) lucide.createIcons();
    }

    /* ── Adjuntos del composer (imagenes + documentos de texto) ── */

    /** Dispatcher: enruta el File a imagen (vision) o documento de texto (contexto). */
    _addFile(file) {
        if (!file) return;
        if (/^image\//.test(file.type)) { this._addImageFile(file); return; }
        if (iaIsTextFile(file))         { this._addDocFile(file);   return; }
        if (typeof visorView !== 'undefined' && visorView) {
            visorView.toast('Formato no soportado: ' + (file.name || 'archivo') + ' (solo imagenes y texto)', 'warn');
        }
    }

    /* ── Imagenes adjuntas en el composer ── */

    _addImageFile(file) {
        if (!file || !/^image\//.test(file.type)) return;
        if (file.size > 8 * 1024 * 1024) {
            if (typeof visorView !== 'undefined' && visorView) {
                visorView.toast('Imagen demasiado grande (max 8 MB)', 'warn');
            }
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = String(ev.target.result || '');
            const base64  = dataUrl.replace(/^data:[^;]+;base64,/, '');
            this.pendingImages.push({
                dataUrl,
                base64,
                mime: file.type,
                name: file.name || 'imagen'
            });
            this._renderImageStrip();
        };
        reader.readAsDataURL(file);
    }

    _removeImage(idx) {
        if (idx < 0 || idx >= this.pendingImages.length) return;
        this.pendingImages.splice(idx, 1);
        this._renderImageStrip();
    }

    /* ── Documentos de texto adjuntos en el composer ── */

    _addDocFile(file) {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            if (typeof visorView !== 'undefined' && visorView) {
                visorView.toast('Archivo demasiado grande (max 5 MB de texto)', 'warn');
            }
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            this.pendingDocs.push({
                name:    file.name || 'documento',
                content: String(ev.target.result || ''),
                size:    file.size || 0
            });
            this._renderImageStrip();
        };
        reader.readAsText(file);
    }

    _removeDoc(idx) {
        if (idx < 0 || idx >= this.pendingDocs.length) return;
        this.pendingDocs.splice(idx, 1);
        this._renderImageStrip();
    }

    /* ── Render unificado del strip de adjuntos (imagenes + documentos) ── */

    _renderImageStrip() {
        const $strip = $('#iaImageStrip');
        if (!$strip.length) return;
        if (!this.pendingImages.length && !this.pendingDocs.length) {
            $strip.hide().empty();
            return;
        }

        const imgHtml = this.pendingImages.map((img, i) => `
            <div class="ia-img-chip" title="${this._escape(img.name)}">
                <img src="${img.dataUrl}" alt="">
                <button type="button" class="ia-img-chip-remove" data-idx="${i}" title="Quitar">
                    <i data-lucide="x"></i>
                </button>
            </div>
        `).join('');

        const fmtKb  = (b) => b >= 1024 ? (b / 1024).toFixed(b >= 10240 ? 0 : 1) + ' KB' : b + ' B';
        const docHtml = this.pendingDocs.map((doc, i) => `
            <div class="ia-doc-chip" title="${this._escape(doc.name)} (${fmtKb(doc.size)})">
                <i data-lucide="file-text" class="ia-doc-chip-icon"></i>
                <span class="ia-doc-chip-name">${this._escape(doc.name)}</span>
                <button type="button" class="ia-doc-chip-remove" data-doc-idx="${i}" title="Quitar">
                    <i data-lucide="x"></i>
                </button>
            </div>
        `).join('');

        $strip.html(imgHtml + docHtml).show();
        $strip.find('.ia-img-chip-remove').off('click').on('click', (e) => {
            const idx = parseInt($(e.currentTarget).data('idx'), 10);
            this._removeImage(idx);
        });
        $strip.find('.ia-doc-chip-remove').off('click').on('click', (e) => {
            const idx = parseInt($(e.currentTarget).data('doc-idx'), 10);
            this._removeDoc(idx);
        });
        if (window.lucide) lucide.createIcons();
    }

    /* ── Submit from input ── */

    _submit() {
        if (this.isBusy) return;
        const $ta   = $('#iaInputTextarea');
        const text  = $ta.val().trim();
        const hasImages = this.pendingImages.length > 0;
        const hasDocs   = this.pendingDocs.length > 0;
        if (!text && !hasImages && !hasDocs) return;
        $ta.val('').css('height', 'auto');
        const images = this.pendingImages.slice();
        const docs   = this.pendingDocs.slice();
        this.pendingImages = [];
        this.pendingDocs   = [];
        this._renderImageStrip();
        const fallback = hasImages ? 'Describe esta imagen.' : (hasDocs ? 'Analiza el documento adjunto.' : '');
        this._sendMessage(text || fallback, images, docs);
    }

    /* ── Estado ocupado: el boton Enviar se transforma en Detener (aborta el fetch). ── */
    _setBusy(busy) {
        this.isBusy = !!busy;
        const $btn = $('#iaSendBtn');
        if (busy) {
            $btn.addClass('is-stop').attr('title', 'Detener generacion')
                .html('<i data-lucide="square" class="w-3.5 h-3.5"></i>');
        } else {
            $btn.removeClass('is-stop').attr('title', 'Enviar (Enter)')
                .html('<i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>');
        }
        if (window.lucide) lucide.createIcons();
    }
    _stop() {
        if (this._abort) { try { this._abort.abort(); } catch (e) {} }
        if (typeof visorView !== 'undefined' && visorView) visorView.toast('Deteniendo…', 'info');
    }

    /* ── Core: send message ── */

    async _sendMessage(text, images, docs) {
        if (this.isBusy) return;
        this._setBusy(true);

        images = Array.isArray(images) ? images : [];
        docs   = Array.isArray(docs)   ? docs   : [];

        // Switch to chat state (first message)
        if (!this._inChatMode()) {
            this._switchToChat();
        }

        // Documentos de texto adjuntos: su contenido se EMBEBE en el content del
        // mensaje (asi el modelo lo recuerda en toda la conversacion via history),
        // pero en la burbuja solo mostramos el texto + chips con el nombre.
        let contentForModel = text;
        if (docs.length) {
            const blocks = docs.map(d =>
                `--- INICIO DOC ADJUNTO: ${d.name} ---\n${d.content}\n--- FIN DOC: ${d.name} ---`
            ).join('\n\n');
            contentForModel = (text ? text + '\n\n' : '') +
                '=== DOCUMENTOS ADJUNTOS POR EL USUARIO ===\n' + blocks;
        }

        const userMsg = { role: 'user', content: contentForModel };
        if (images.length) {
            userMsg.images        = images.map(i => i.base64);
            userMsg.imagesPreview = images.map(i => i.dataUrl);
        }
        if (docs.length) userMsg.docsMeta = docs.map(d => ({ name: d.name, size: d.size }));
        this.history.push(userMsg);
        this._appendUserMessage(text, userMsg.imagesPreview, userMsg.docsMeta);

        // Typing indicator
        const $typing = this._appendTyping();
        this._scrollBottom();

        // Modo Layout: muestra en el panel de lectura la animacion "IA generando"
        // (puntitos + shimmer estilo Grok/ChatGPT) mientras llega la respuesta.
        // _layoutPending sigue en true hasta que se renderiza el resultado; si la
        // consulta falla/aborta, finish() restaura el documento abierto.
        this._layoutPending = this.layoutMode && !(this._app && this._app.isEditing);
        if (this._layoutPending) this._showLayoutLoading();

        const currentFileObj = this._app.currentFile
            ? (this._app.allFiles || []).find(f => f.file === this._app.currentFile)
            : null;

        const payload = {
            messages:           this.history.map(m => {
                const out = { role: m.role, content: m.content };
                if (m.images && m.images.length) out.images = m.images;
                return out;
            }),
            currentFile:        this._app.currentFile || '',
            currentFilePath:    currentFileObj?.fullPath || '',
            currentFileContent: currentFileObj?.raw || '',
            pinnedFiles:        (this._app.getPinnedFilesPayload ? this._app.getPinnedFilesPayload() : []),
            editorMode:         !!this.editorMode,
            graphMode:          this.graphMode || '',
            graphTemplate:      this.graphMode === 'excalidraw' ? (this.excaliMode || 'libre') : '',
            dbConnect:          this.activeDb || '',   // base conectada (conexion pegajosa)
            customPath:         (this._app.settings && this._app.settings.customPath) ? this._app.settings.customPath : '',
            model:              this.model || ''
        };

        // --- Streaming SSE + typewriter por palabras (estilo Claude) ---
        const provider = (this.model && this.model.indexOf('/') !== -1) ? 'OpenRouter' : 'Ollama';
        const finish = () => {
            // Layout: si quedo loading sin resultado (error/abort/sin respuesta),
            // restaura el documento abierto para no dejar el panel en "generando".
            if (this._layoutPending) {
                this._layoutPending = false;
                this._exitLayoutPreview();
            }
            this._scrollBottom();
            this._setBusy(false);
            this._abort = null;
            if (window.lucide) lucide.createIcons();
        };

        let stream     = null;   // controlador de _createAIStream (se crea al 1er token)
        let received   = '';     // texto completo acumulado del stream
        let meta       = {};     // metadatos del evento 'done'
        let streamErr  = null;   // error reportado dentro del stream
        let firstToken = false;
        let thinkChars = 0;      // razonamiento acumulado (modelos thinking) antes del 1er token

        // Controlador para abortar la consulta desde el botón Detener.
        const ac = new AbortController();
        this._abort = ac;

        try {
            const res = await fetch(this._apiStream, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(payload),
                signal:  ac.signal
            });
            if (!res.ok || !res.body) {
                let m = 'HTTP ' + res.status;
                try { const j = await res.json(); if (j && j.error) m = j.error; } catch (_) {}
                throw new Error(m);
            }

            // Lee el SSE: eventos separados por \n\n, lineas 'event:' y 'data:'.
            const reader = res.body.getReader();
            const dec    = new TextDecoder();
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

                    if (ev === 'thinking') {
                        // El modelo esta razonando: aun no hay respuesta. Mantenemos el
                        // indicador pero mostramos progreso para que no parezca colgado.
                        if (!firstToken) {
                            thinkChars += (obj.t || '').length;
                            this._setTypingPhase($typing, thinkChars);
                        }
                    } else if (ev === 'chunk') {
                        if (!firstToken) {
                            firstToken = true;
                            $typing.remove();
                            stream = this._createAIStream();   // crea la burbuja al 1er token (detecta HTML/diagrama y muestra card "Conjurando…")
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
            // Sin red, timeout, respuesta corrupta o detenida por el usuario (AbortError).
            $typing.remove();
            const aborted = err && err.name === 'AbortError';
            if (aborted && stream && received) {
                // Detenida con contenido parcial: conservamos lo ya generado.
                await stream.drain();
                this.history.push({ role: 'assistant', content: received });
                stream.complete(received, null, received);
                // Layout: vuelca el parcial al panel en vez de descartarlo.
                if (this.layoutMode && received.trim()) this._renderLayoutPreview(received);
                finish();
                return;
            }
            const msg = aborted
                ? '⏹ Generacion detenida.'
                : ('⚠️ No se obtuvo respuesta de ' + provider + '. '
                    + (err && err.message ? err.message : 'Error de red o timeout.'));
            if (stream) { await stream.drain(); stream.fail(msg); }
            else        { this._appendAIMessage(msg, null); }
            finish();
            return;
        }

        // Error emitido dentro del stream (p.ej. 429 del proveedor).
        if (streamErr) {
            $typing.remove();
            const msg = '⚠️ ' + streamErr;
            if (stream) { await stream.drain(); stream.fail(msg); }
            else        { this._appendAIMessage(msg, null); }
            finish();
            return;
        }

        // El stream cerro sin emitir ni un solo token.
        if (!firstToken) {
            $typing.remove();
            this._appendAIMessage('⚠️ No se obtuvo respuesta de ' + provider + '.', null);
            finish();
            return;
        }

        // Espera a que el typewriter termine de pintar todo lo recibido.
        await stream.drain();

        // Conexion pegajosa: si el backend resolvio una base, la recordamos para que
        // los siguientes turnos sigan consultandola sin tener que volver a nombrarla.
        if (meta && meta.db) this._setActiveDb(meta.db);

        this.history.push({ role: 'assistant', content: received });

        // Modo editor: extraer propuestas <edit-replace> del texto completo.
        let proposals = [];
        let displayedReply = received;
        if (this.editorMode) {
            const file = (this._app.allFiles || []).find(f => f.file === this._app.currentFile);
            const rawFile = file ? file.raw : '';
            const parsed = this._parseEditReplaceBlocks(received, rawFile);
            proposals     = parsed.proposals;
            displayedReply = parsed.cleanText || displayedReply;
        }

        // Render final: markdown completo + meta + post-proceso (mermaid/chart/html).
        stream.complete(displayedReply, {
            credits:        meta.credits_estimate,
            cost:           meta.cost_usd,            // costo real USD (OpenRouter) o null (Ollama)
            promptTokens:   meta.prompt_tokens,
            completionTokens: meta.completion_tokens,
            elapsed_ms:     meta.elapsed_ms,
            tokens:         meta.tokens_used,
            proposalsCount: proposals.length
        }, received);

        if (proposals.length > 0) {
            this.pendingEdits = proposals;
            this._showEditProposalPanel(proposals);
        }

        // Modo Layout: ademas de la burbuja del chat, renderiza la respuesta como
        // documento en el panel de lectura (#md-rendered) SIN tocar el archivo
        // abierto (no se guarda). Un boton "Volver al documento" restaura la vista.
        if (this.layoutMode && received.trim()) {
            this._renderLayoutPreview(received);
        }

        // Sonido al terminar de responder (solo en respuestas exitosas).
        this._playPopSound();

        finish();
    }

    /* ── Burbuja de IA en streaming: typewriter por palabras (estilo Claude) ── */

    // Crea una burbuja de respuesta vacia y devuelve un controlador:
    //   push(piece)                 → alimenta texto que se pinta palabra a palabra
    //   drain()  → Promise          → resuelve cuando termina de pintar lo pendiente
    //   complete(text, meta, copy)  → render final (markdown + meta + post-proceso)
    //   fail(msg)                   → corta y muestra un error
    _createAIStream() {
        const self  = this;
        const msgId = 'iaMsg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const $msg  = $(`
            <div class="ia-msg ai" id="${msgId}">
                <div class="ia-msg-role"><span class="dot"></span><span>CoffeeIA</span></div>
                <div class="ia-msg-text"></div>
            </div>
        `);
        $('#iaBodyChat').append($msg);
        const $text = $msg.find('.ia-msg-text');

        let pending = '', shown = '', streamDone = false, raf = null, drainCb = null;
        let last = performance.now(), credit = 0;

        // Deteccion dinamica de HTML: en cuanto el stream abre un bloque ```html
        // dejamos de teclear el codigo crudo y mostramos una card "Conjurando…".
        // Al terminar, complete() renderiza el componente. No depende del modo lienzo.
        let conjuring = false, conjureKind = null, fullBuf = '', $conjSub = null;
        const HTML_FENCE       = /```[ \t]*html/i;
        const DRAWIO_FENCE     = /```[ \t]*drawio/i;
        const EXCALIDRAW_FENCE = /```[ \t]*excalidraw/i;
        // Codigo crudo sin fence (solo diagramas: draw.io/excalidraw). El HTML solo
        // se "conjura" cuando viene en un fence ```html (ver conjureKindFor).
        const RAW_DRAWIO     = /<(mxGraphModel|mxfile)[\s>]/i;
        const RAW_EXCALIDRAW = /"type"\s*:\s*"excalidraw/i;
        // Tipo de conjuro segun lo que asoma en el stream (o null si es texto normal).
        const conjureKindFor = (buf) => {
            if (DRAWIO_FENCE.test(buf) || RAW_DRAWIO.test(buf)) return 'drawio';
            if (EXCALIDRAW_FENCE.test(buf) || RAW_EXCALIDRAW.test(buf)) return 'excalidraw';
            if (HTML_FENCE.test(buf)) return 'html';
            // Modo grafica activo: en cuanto se abre CUALQUIER bloque de codigo
            // (```excalidraw, ```json, ```mermaid, ```xml…) asumimos ese tipo y
            // mostramos la animacion en vez de teclear el codigo crudo.
            if (self.graphMode && /```/.test(buf)) return self.graphMode;
            return null;
        };
        const CONJURE_UI = {
            html:       { icon: 'wand-sparkles', title: 'Conjurando componente…', sub: 'Tejiendo el HTML' },
            mermaid:    { icon: 'git-graph',     title: 'Construyendo diagrama…',  sub: 'Trazando el grafico' },
            drawio:     { icon: 'workflow',      title: 'Construyendo diagrama…',  sub: 'Trazando el lienzo' },
            excalidraw: { icon: 'pencil-ruler',  title: 'Bosquejando…',            sub: 'Trazando el boceto' }
        };
        function enterConjuring(kind) {
            conjuring   = true;
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
            self._scrollBottom();
        }

        // Toma la siguiente "palabra" (espacios + token + espacio final). Pintar
        // palabra a palabra es lo que da la sensacion Claude; letra a letra se
        // siente a maquina de escribir.
        function takeWord() {
            const m   = pending.match(/^\s*\S+\s*/);
            const len = m ? m[0].length : pending.length;
            const piece = pending.slice(0, len);
            pending = pending.slice(len);
            return piece;
        }
        function paint() {
            $text.html(self._markdownToHtml(shown) + '<span class="ia-stream-cursor">▍</span>');
            self._scrollBottom();
        }
        function pump(now) {
            now = now || performance.now();
            const dt = Math.min(100, now - last); // cap por si la pestana estuvo inactiva
            last = now;
            // Ritmo en PALABRAS/seg; sube si se acumula backlog para no rezagarse.
            const wps = 14 + Math.min(46, pending.length / 40);
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
                    // No pintamos el código crudo: solo avanzamos el progreso de la card.
                    const lines = fullBuf.split('\n').length;
                    const sub   = (CONJURE_UI[conjureKind] || CONJURE_UI.html).sub;
                    if ($conjSub) $conjSub.text(sub + ' · ' + lines + (lines === 1 ? ' línea' : ' líneas'));
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
                displayedText = self._normalizeDrawioXml(displayedText);
                displayedText = self._normalizeExcalidrawJson(displayedText);
                let metaHtml = '';
                if (meta) {
                    metaHtml = `
                        <div class="ia-msg-meta-footer">
                            ${iaMetaItems(meta)}
                            <span class="meta-actions">
                                <button class="meta-iconbtn ia-savefile-btn" title="Guardar respuesta como archivo"><i data-lucide="file-down" class="w-3 h-3"></i></button>
                                <button class="meta-iconbtn ia-copy-btn" title="Copiar respuesta"><i data-lucide="copy" class="w-3 h-3"></i></button>
                            </span>
                        </div>`;
                }
                const proposalHint = (meta && meta.proposalsCount > 0)
                    ? `<div><span class="ia-msg-proposal-hint"><i data-lucide="wand-sparkles"></i>${meta.proposalsCount} propuesta${meta.proposalsCount > 1 ? 's' : ''} en el panel</span></div>`
                    : '';
                $text.html(self._markdownToHtml(displayedText));   // fin: render limpio, sin cursor
                $(proposalHint + metaHtml).appendTo($msg);
                $msg.find('.ia-copy-btn').on('click', () => {
                    const t = copyText != null ? copyText : displayedText;
                    if (navigator.clipboard) navigator.clipboard.writeText(t);
                    if (typeof visorView !== 'undefined' && visorView) visorView.toast('Respuesta copiada', 'success');
                });
                $msg.find('.ia-savefile-btn').on('click', () => {
                    const t = copyText != null ? copyText : displayedText;
                    if (self._app && self._app.openNewFileModal) {
                        self._app.openNewFileModal({ name: self._suggestFileName(t), content: t });
                    }
                });
                self._postProcessMessage($msg);
                if (window.lucide) lucide.createIcons();
                self._scrollBottom();
            },
            fail(msg) {
                if (conjuring) { $msg.find('.ia-conjuring').remove(); $text.show(); }
                streamDone = true; pending = '';
                if (raf) { cancelAnimationFrame(raf); raf = null; }
                $text.html(self._markdownToHtml(msg));
                if (window.lucide) lucide.createIcons();
                self._scrollBottom();
            }
        };
    }

    /* ── Parser de propuestas <edit-replace> ── */
    _parseEditReplaceBlocks(reply, fileRaw) {
        const proposals = [];
        const blockRe = /<edit-replace[^>]*>([\s\S]*?)<\/edit-replace>/gi;
        const findRe  = /<find[^>]*>([\s\S]*?)<\/find>/i;
        const withRe  = /<with[^>]*>([\s\S]*?)<\/with>/i;

        let cleanText = reply;
        let m;
        let idx = 0;
        while ((m = blockRe.exec(reply)) !== null) {
            const inner = m[1];
            const f = inner.match(findRe);
            const w = inner.match(withRe);
            if (!f || !w) continue;
            const findStr = f[1].replace(/^\r?\n/, '').replace(/\r?\n$/, '');
            const withStr = w[1].replace(/^\r?\n/, '').replace(/\r?\n$/, '');

            const match = this._locateFind(fileRaw || '', findStr);
            let status, matchedText = findStr;
            if (!match) {
                status = 'not_found';
            } else if (match.duplicated) {
                status = 'ambiguous';
            } else {
                status = 'ok';
                matchedText = match.matched;
            }

            proposals.push({
                id:      'edit-' + (idx++),
                find:    findStr,
                with:    withStr,
                matched: matchedText,
                status:  status,
                accepted: null
            });
            cleanText = cleanText.replace(m[0], '');
        }

        cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();
        if (!cleanText && proposals.length > 0) {
            cleanText = `He preparado ${proposals.length} cambio${proposals.length > 1 ? 's' : ''} para revisar.`;
        }
        return { proposals, cleanText };
    }

    /**
     * Busca needle en haystack con niveles crecientes de tolerancia:
     *  1. Match exacto byte a byte.
     *  2. Por linea con trailing whitespace ignorado.
     *  3. Por linea con TODO el whitespace colapsado (espacios/tabs internos).
     *  4. Lo anterior + escapes markdown neutralizados ("\[ \]" == "[ ]").
     *  5. Lo anterior + normalizacion Unicode NFC (acentos compuestos vs
     *     descompuestos — pasa al copiar texto desde el documento renderizado).
     * Cuando matchea por nivel 2+ reconstruye el texto REAL del archivo
     * para que el replace opere sobre el contenido exacto presente.
     * Retorna {matched, duplicated} o null si no hay match.
     */
    _locateFind(haystack, needle) {
        if (!haystack || !needle) return null;

        // Nivel 1: exacto
        const first = haystack.indexOf(needle);
        if (first !== -1) {
            const second = haystack.indexOf(needle, first + 1);
            return { matched: needle, duplicated: second !== -1 };
        }

        const hLines = haystack.split(/\r?\n/);
        const eol = /\r\n/.test(haystack) ? '\r\n' : '\n';

        // Helpers de normalizacion (componibles).
        const nfc       = l => (l.normalize ? l.normalize('NFC') : l);
        const collapse  = l => l.replace(/\s+/g, ' ').trim();
        const unescape  = l => this._stripMdEscapes(l);

        // Nivel 2: trailing whitespace por linea
        const lvl2 = this._matchByLineKey(haystack, hLines, eol, needle, l => l.replace(/\s+$/, ''));
        if (lvl2) return lvl2;

        // Nivel 3: colapsar whitespace interno + trim total (tolera diferencias en
        // cantidad de espacios — util para listas markdown con indentacion variable)
        const lvl3 = this._matchByLineKey(haystack, hLines, eol, needle, collapse);
        if (lvl3) return lvl3;

        // Nivel 4: whitespace colapsado + escapes markdown neutralizados. El modelo
        // (o Turndown) suele escapar puntuacion al copiar el texto al <find>:
        // "\[ \]", "\*", "\_", "\`"… mientras el archivo en disco los tiene crudos
        // (o viceversa).
        const lvl4 = this._matchByLineKey(haystack, hLines, eol, needle, l => collapse(unescape(l)));
        if (lvl4) return lvl4;

        // Nivel 5: ademas normaliza Unicode (NFC). Al copiar desde el render los
        // acentos pueden venir descompuestos ("í" = i + tilde combinante) y no
        // matchear contra el archivo en NFC. Ultima red de seguridad.
        const lvl5 = this._matchByLineKey(haystack, hLines, eol, needle, l => collapse(unescape(nfc(l))));
        if (lvl5) return lvl5;

        return null;
    }

    // Quita los backslashes que escapan puntuacion markdown (\[ \] \* \_ \` \# …)
    // dejando el caracter crudo. No toca un "\\" literal (doble backslash).
    _stripMdEscapes(str) {
        return str.replace(/\\([\\`*_{}\[\]()#+\-.!>~|])/g, '$1');
    }

    _matchByLineKey(haystack, hLines, eol, needle, keyFn) {
        const nLines = needle.split(/\r?\n/).map(keyFn);
        // Filtrar lineas vacias al final de needle (artefactos del modelo)
        while (nLines.length && nLines[nLines.length - 1] === '') nLines.pop();
        if (nLines.length === 0) return null;

        const hits = [];
        for (let i = 0; i <= hLines.length - nLines.length; i++) {
            let ok = true;
            for (let j = 0; j < nLines.length; j++) {
                if (keyFn(hLines[i + j]) !== nLines[j]) { ok = false; break; }
            }
            if (ok) hits.push(i);
        }
        if (hits.length === 0) return null;

        const start = hits[0];
        const blockLines = hLines.slice(start, start + nLines.length);
        const matched = blockLines.join(eol);
        if (haystack.indexOf(matched) === -1) return null;
        return { matched, duplicated: hits.length > 1 };
    }

    /* ── Panel side-by-side de propuestas ── */

    _showEditProposalPanel(proposals) {
        const $panel = $('#editProposalPanel');
        if (!$panel.length) return;

        const fileName = this._app.currentFile || '—';
        $('#eppCount').text(proposals.length);

        const cards = proposals.map(p => this._renderProposalCard(p, fileName)).join('');
        $('#eppBody').html(cards);
        $('#editProposalPanel').show();
        $('.doc-layout').hide();

        $('#eppAcceptAll').off('click').on('click', () => this._acceptAllProposals());
        $('#eppClose').off('click').on('click', () => this._closeEditProposalPanel());

        $('#eppBody .epp-accept').off('click').on('click', (e) => {
            this._acceptProposal($(e.currentTarget).data('id'));
        });
        $('#eppBody .epp-reject').off('click').on('click', (e) => {
            this._rejectProposal($(e.currentTarget).data('id'));
        });

        if (window.lucide) lucide.createIcons();
    }

    _renderProposalCard(p, fileName) {
        const isOk = p.status === 'ok' && p.accepted === null;
        const statusLabel = {
            'ok':         { txt: 'Listo para aplicar', cls: 'ok',  icon: 'circle-check'    },
            'not_found':  { txt: 'No encontrado',     cls: 'err', icon: 'circle-x'        },
            'ambiguous':  { txt: 'Texto ambiguo',     cls: 'warn',icon: 'circle-alert'    }
        }[p.status] || { txt: 'Desconocido', cls: 'err', icon: 'circle-help' };

        const stateBadge = p.accepted === true
            ? `<span class="epp-pill done"><i data-lucide="check-circle-2"></i>Aplicado</span>`
            : p.accepted === false
                ? `<span class="epp-pill rejected"><i data-lucide="x-circle"></i>Rechazado</span>`
                : `<span class="epp-pill ${statusLabel.cls}"><i data-lucide="${statusLabel.icon}"></i>${statusLabel.txt}</span>`;

        const actions = p.accepted !== null ? '' : `
            <div class="epp-card-actions">
                <button class="cs-btn cs-btn-ghost cs-btn-sm epp-reject" data-id="${p.id}">
                    <i data-lucide="x" class="w-3.5 h-3.5"></i> Rechazar
                </button>
                <button class="cs-btn cs-btn-primary cs-btn-sm epp-accept" data-id="${p.id}" ${isOk ? '' : 'disabled'}>
                    <i data-lucide="check" class="w-3.5 h-3.5"></i> Aceptar
                </button>
            </div>
        `;

        return `
            <div class="epp-card" data-status="${p.status}">
                <div class="epp-card-head">
                    <span class="epp-card-id">${p.id}</span>
                    ${stateBadge}
                    <span class="epp-card-file"><i data-lucide="file-text" class="w-3 h-3"></i>${fileName}</span>
                </div>
                <div class="epp-card-grid">
                    <div class="epp-side epp-side-before">
                        <div class="epp-side-label"><i data-lucide="minus" class="w-3 h-3"></i>Antes</div>
                        <pre class="epp-pre epp-pre-before">${this._escape(p.find)}</pre>
                    </div>
                    <div class="epp-side epp-side-after">
                        <div class="epp-side-label"><i data-lucide="plus" class="w-3 h-3"></i>Despues</div>
                        <pre class="epp-pre epp-pre-after">${this._escape(p.with)}</pre>
                    </div>
                </div>
                ${actions}
            </div>
        `;
    }

    async _acceptProposal(id) {
        const p = (this.pendingEdits || []).find(x => x.id === id);
        if (!p || p.status !== 'ok' || p.accepted !== null) return;

        const file = (this._app.allFiles || []).find(f => f.file === this._app.currentFile);
        if (!file || file.raw == null) {
            visorView.toast('Sin archivo abierto', 'warn');
            return;
        }

        // Aplicar al raw actual (puede haber cambios previos ya aplicados). Re-localizamos
        // con tolerancia por si el snapshot original difiere en whitespace/EOL del current.
        const reloc = this._locateFind(file.raw, p.matched || p.find);
        if (!reloc) {
            p.status = 'not_found';
            this._refreshProposalCard(p);
            visorView.toast('El texto a reemplazar ya no existe (cambio previo lo modifico)', 'warn');
            return;
        }
        const nextRaw = file.raw.replace(reloc.matched, p.with);

        const ok = await this._app.saveContentSilent(file, nextRaw);
        if (!ok) return;

        p.accepted = true;
        this._refreshProposalCard(p);
        visorView.toast('Cambio aplicado', 'success');

        // Si ya no quedan propuestas pendientes, cerrar el panel automaticamente
        const pending = (this.pendingEdits || []).filter(x => x.accepted === null);
        if (pending.length === 0) {
            setTimeout(() => this._closeEditProposalPanel(), 600);
        }
    }

    _rejectProposal(id) {
        const p = (this.pendingEdits || []).find(x => x.id === id);
        if (!p || p.accepted !== null) return;
        p.accepted = false;
        this._refreshProposalCard(p);

        const pending = (this.pendingEdits || []).filter(x => x.accepted === null);
        if (pending.length === 0) {
            setTimeout(() => this._closeEditProposalPanel(), 400);
        }
    }

    _refreshProposalCard(p) {
        const fileName = this._app.currentFile || '—';
        const newCard  = $(this._renderProposalCard(p, fileName));
        $('#eppBody .epp-card').each(function () {
            const $head = $(this).find('.epp-card-id');
            if ($head.text() === p.id) {
                $(this).replaceWith(newCard);
            }
        });
        $('#eppBody .epp-accept').off('click').on('click', (e) => this._acceptProposal($(e.currentTarget).data('id')));
        $('#eppBody .epp-reject').off('click').on('click', (e) => this._rejectProposal($(e.currentTarget).data('id')));
        if (window.lucide) lucide.createIcons();
    }

    async _acceptAllProposals() {
        const list = (this.pendingEdits || []).filter(p => p.status === 'ok' && p.accepted === null);
        for (const p of list) {
            // Cada una se ejecuta secuencial porque cada save actualiza file.raw
            await this._acceptProposal(p.id);
        }
    }

    _closeEditProposalPanel() {
        $('#editProposalPanel').hide();
        $('.doc-layout').show();
        this.pendingEdits = null;
    }

    /* ── Modo Layout: respuesta como documento en el panel de lectura ── */

    // Animacion "IA generando" (puntitos + shimmer estilo Grok/ChatGPT) en el
    // panel de lectura mientras llega la respuesta. Sustituye temporalmente la
    // vista; _renderLayoutPreview o _exitLayoutPreview la reemplazan al terminar.
    _showLayoutLoading() {
        const $doc = $('#md-rendered');
        if (!$doc.length) return;
        if (this._app && this._app.isEditing) return;

        $('.cs-tab[data-tab="rendered"]').addClass('active');
        $('.cs-tab[data-tab="raw"]').removeClass('active');
        $('#md-raw, #md-edit').addClass('hidden');
        $doc.removeClass('hidden');

        // Anchos variados para que el esqueleto parezca un documento escribiendose.
        // Un '' inserta un espacio (separacion entre parrafos).
        const widths = ['94%', '88%', '97%', '70%', '', '92%', '85%', '96%', '61%', '', '90%', '78%'];
        const lines = widths.map(w => w
            ? `<div class="ia-sk-line" style="width:${w}"></div>`
            : '<div class="ia-sk-gap"></div>').join('');

        $doc.html(`
            <div class="ia-layout-loading" contenteditable="false">
                <div class="ia-layout-loading-head">
                    <span class="ia-gen-orb"></span>
                    <span class="ia-gen-label">CoffeeIA esta generando<span class="ia-gen-dots"><i></i><i></i><i></i></span></span>
                </div>
                <div class="ia-sk-line ia-sk-title" style="width:46%"></div>
                <div class="ia-skeleton">${lines}</div>
            </div>
        `);

        const $main = $('.main-content');
        if ($main.length) $main.scrollTop(0);
        if (window.lucide) lucide.createIcons();
    }

    // Pinta el markdown de la respuesta en #md-rendered, reemplazando la vista
    // actual SIN tocar file.raw ni guardar a disco. Antepone un banner con un
    // boton "Volver al documento" que restaura el archivo abierto.
    _renderLayoutPreview(markdownText) {
        // La respuesta se rendea: el loading deja de estar pendiente.
        this._layoutPending = false;
        // Guarda el markdown crudo para exportarlo / guardarlo desde el banner.
        this._layoutMarkdown = markdownText || '';
        const $doc = $('#md-rendered');
        if (!$doc.length) return;
        // No interferir si el usuario esta editando el documento.
        if (this._app && this._app.isEditing) return;

        // Asegura que el panel de lectura este visible (no en Raw ni en diagrama).
        $('.cs-tab[data-tab="rendered"]').addClass('active');
        $('.cs-tab[data-tab="raw"]').removeClass('active');
        $('#md-raw, #md-edit').addClass('hidden');
        $doc.removeClass('hidden');

        const banner = `
            <div class="ia-layout-banner" id="iaLayoutBanner" contenteditable="false">
                <span class="ia-layout-banner-label">
                    <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                    Borrador generado por CoffeeIA · sin guardar
                </span>
                <span class="ia-layout-banner-actions">
                    <button type="button" id="iaLayoutExport" class="cs-btn cs-btn-ghost cs-btn-sm flex items-center gap-1.5" title="Descargar el contenido como archivo .md">
                        <i data-lucide="download" class="w-3.5 h-3.5"></i>
                        Exportar .md
                    </button>
                    <button type="button" id="iaLayoutSave" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5" title="Guardar como documento en el árbol">
                        <i data-lucide="save" class="w-3.5 h-3.5"></i>
                        Guardar
                    </button>
                    <button type="button" id="iaLayoutBack" class="cs-btn cs-btn-ghost cs-btn-sm flex items-center gap-1.5">
                        <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
                        Volver al documento
                    </button>
                </span>
            </div>`;
        $doc.html(banner + '<div class="ia-layout-doc">' + this._markdownToHtml(markdownText) + '</div>');

        // Resalta el codigo igual que renderContent.
        if (typeof hljs !== 'undefined') {
            $doc.find('.ia-layout-doc pre code').each(function (i, b) { hljs.highlightElement(b); });
        }

        $('#iaLayoutBack').off('click').on('click', () => this._exitLayoutPreview());
        $('#iaLayoutExport').off('click').on('click', () => {
            const md = this._layoutMarkdown || '';
            this._exportMarkdownFile(md, this._suggestFileName(md));
        });
        $('#iaLayoutSave').off('click').on('click', () => {
            const md = this._layoutMarkdown || '';
            if (this._app && this._app.openNewFileModal) {
                this._app.openNewFileModal({ name: this._suggestFileName(md), content: md });
            } else if (typeof visorView !== 'undefined' && visorView) {
                visorView.toast('No se puede guardar en este origen', 'error');
            }
        });

        const $main = $('.main-content');
        if ($main.length) $main.scrollTop(0);
        if (window.lucide) lucide.createIcons();
    }

    // Descarga un texto markdown como archivo .md (client-side, sin servidor).
    _exportMarkdownFile(text, name) {
        const fname = (name || 'documento').replace(/\.md$/i, '') + '.md';
        const blob  = new Blob([text || ''], { type: 'text/markdown;charset=utf-8' });
        const url   = URL.createObjectURL(blob);
        const a     = document.createElement('a');
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (typeof visorView !== 'undefined' && visorView) visorView.toast('Markdown exportado: ' + fname, 'success');
    }

    // Restaura el documento abierto re-renderizando desde file.raw (intacto).
    _exitLayoutPreview() {
        const file = this._app && this._app.currentFile
            ? (this._app.allFiles || []).find(f => f.file === this._app.currentFile)
            : null;
        if (file && typeof visorView !== 'undefined' && visorView) {
            visorView.renderContent(file);
        } else if (typeof visorView !== 'undefined' && visorView) {
            visorView.renderEmptyMain();
        }
    }

    /* ── DOM helpers ── */

    _inChatMode() {
        return $('#iaBodyChat').is(':visible');
    }

    _switchToChat() {
        $('#iaBodyEmpty').hide();
        $('#iaBodyChat').show().css('display', 'flex');

        // Saludo inicial (sin la sección decorativa "Grimorios en contexto"
        // — los anclados reales ya se muestran en #iaPinnedWrap).
        if (!this._chipsRendered) {
            this._chipsRendered = true;
            const $greet = $(`
                <div class="ia-msg ai" id="iaGreetMsg">
                    <div class="ia-msg-role"><span class="dot"></span><span>CoffeeIA</span></div>
                    <div class="ia-msg-text"><p>Hola. Soy <strong>CoffeeIA</strong>, tu asistente del framework CoffeeSoft. ¿En que te puedo ayudar hoy?</p></div>
                </div>
            `);
            $('#iaBodyChat').append($greet);
            if (window.lucide) lucide.createIcons();
        }
    }

    /* ── GitHub Projects: tablero como "card" dentro del chat ──────────────
       Entrada: menu Herramientas -> "GitHub Projects". Consulta ctrl-github.php
       (GraphQL con el token de credentials/.env) y pinta una tarjeta con los
       items agrupados por Status y badges de Size. */

    async _openGithubProjects() {
        this._switchToChat();
        const $card = this._ghCardShell('Cargando GitHub Projects…');
        $('#iaBodyChat').append($card);
        this._ghScroll();
        try {
            const data = await this._ghFetch('list');
            if (!data || !data.ok) { this._ghError($card, (data && data.error) || 'No se pudieron leer los Projects.'); return; }
            const projects = data.projects || [];
            if (projects.length === 0) {
                const extra = data.inaccessible ? ` (${data.inaccessible} sin acceso con este token)` : '';
                this._ghError($card, 'No se encontraron Projects accesibles.' + extra);
                return;
            }
            if (projects.length === 1) {
                await this._loadProjectBoard(projects[0].number, $card, data.inaccessible);
            } else {
                this._ghRenderPicker($card, projects, data.inaccessible);
            }
        } catch (e) {
            this._ghError($card, 'Error de red al consultar GitHub.');
        }
    }

    async _loadProjectBoard(number, $card, inaccessible) {
        if (!$card || !$card.length) $card = this._ghCardShell('Cargando tablero…');
        if (!$card.parent().length) $('#iaBodyChat').append($card);
        this._ghSetLoading($card, 'Cargando tablero…');
        this._ghScroll();
        try {
            const data = await this._ghFetch('items', { number });
            if (!data || !data.ok) { this._ghError($card, (data && data.error) || 'No se pudo cargar el tablero.'); return; }
            this._ghRenderBoard($card, data.project, data.items || [], inaccessible);
        } catch (e) {
            this._ghError($card, 'Error de red al cargar el tablero.');
        }
    }

    async _ghFetch(opc, extra) {
        const form = new FormData();
        form.append('opc', opc);
        if (extra) Object.keys(extra).forEach(k => form.append(k, extra[k]));
        const res = await fetch(this._apiGithub, { method: 'POST', body: form });
        return res.json();
    }

    _ghCardShell(loadingText) {
        return $(`
            <div class="ia-msg ai">
                <div class="ia-msg-role"><span class="dot"></span><span>CoffeeIA · GitHub</span></div>
                <div class="ia-gh-card">
                    <div class="ia-gh-loading"><span class="ia-gh-spin"></span>${this._escape(loadingText || 'Cargando…')}</div>
                </div>
            </div>
        `);
    }

    _ghSetLoading($card, text) {
        $card.find('.ia-gh-card').html(`<div class="ia-gh-loading"><span class="ia-gh-spin"></span>${this._escape(text)}</div>`);
    }

    _ghError($card, msg) {
        $card.find('.ia-gh-card').html(`
            <div class="ia-gh-error">
                <i data-lucide="alert-triangle"></i>
                <div class="ia-gh-error-body">
                    <p>${this._escape(msg)}</p>
                    <button type="button" class="ia-gh-retry">Reintentar</button>
                </div>
            </div>
        `);
        $card.find('.ia-gh-retry').on('click', () => this._openGithubProjects());
        if (window.lucide) lucide.createIcons();
        this._ghScroll();
    }

    _ghRenderPicker($card, projects, inaccessible) {
        const rows = projects.map(p => `
            <button type="button" class="ia-gh-pick" data-number="${p.number}">
                <i data-lucide="layout-list"></i>
                <span class="ia-gh-pick-info">
                    <span class="ia-gh-pick-title">${this._escape(p.title)}</span>
                    <span class="ia-gh-pick-sub">${p.itemsCount} items · ${this._ghDate(p.updatedAt)}</span>
                </span>
            </button>
        `).join('');
        const note = inaccessible ? `<div class="ia-gh-note">${inaccessible} project(s) sin acceso con este token.</div>` : '';
        $card.find('.ia-gh-card').html(`
            <div class="ia-gh-head"><i data-lucide="github"></i><span class="ia-gh-title">Elige un project</span></div>
            <div class="ia-gh-picklist">${rows}</div>
            ${note}
        `);
        $card.find('.ia-gh-pick').on('click', (e) => {
            this._loadProjectBoard($(e.currentTarget).data('number'), $card, inaccessible);
        });
        if (window.lucide) lucide.createIcons();
        this._ghScroll();
    }

    _ghRenderBoard($card, project, items, inaccessible) {
        const STATUS_ORDER = ['todo', 'to do', 'in progress', 'done'];
        const groups = {};
        items.forEach(it => {
            const s = it.status || 'Sin estado';
            (groups[s] = groups[s] || []).push(it);
        });
        const keys = Object.keys(groups).sort((a, b) => {
            const ia = STATUS_ORDER.indexOf(a.toLowerCase());
            const ib = STATUS_ORDER.indexOf(b.toLowerCase());
            const va = ia === -1 ? 98 : ia, vb = ib === -1 ? 98 : ib;
            return va - vb || a.localeCompare(b);
        });

        const total     = items.length;
        const doneCount = (groups['Done'] || []).length;
        const pct       = total ? Math.round(doneCount / total * 100) : 0;

        const sizeCount = items.reduce((m, it) => { if (it.size) m[it.size] = (m[it.size] || 0) + 1; return m; }, {});
        const sizeChips = ['XS', 'S', 'M', 'L', 'XL'].filter(s => sizeCount[s]).map(s => `${sizeCount[s]} ${s}`).join(' · ');

        const groupsHtml = keys.map(k => this._ghGroupHtml(k, groups[k])).join('');
        const note = inaccessible ? `<div class="ia-gh-note">${inaccessible} project(s) sin acceso con este token.</div>` : '';

        $card.find('.ia-gh-card').html(`
            <div class="ia-gh-head">
                <i data-lucide="github"></i>
                <span class="ia-gh-title" title="${this._escape(project.title)}">${this._escape(project.title)}</span>
                <span class="ia-gh-actions">
                    <button type="button" class="ia-gh-iconbtn ia-gh-refresh" title="Refrescar"><i data-lucide="refresh-cw"></i></button>
                    ${project.url ? `<a class="ia-gh-iconbtn" href="${project.url}" target="_blank" rel="noopener" title="Abrir en GitHub"><i data-lucide="external-link"></i></a>` : ''}
                </span>
            </div>
            <div class="ia-gh-sub">
                <div class="ia-gh-progress"><span style="width:${pct}%"></span></div>
                <span class="ia-gh-metaline">${doneCount}/${total} Done · ${pct}%${sizeChips ? ' · ' + sizeChips : ''}</span>
            </div>
            <div class="ia-gh-groups">${groupsHtml}</div>
            ${note}
        `);

        $card.find('.ia-gh-refresh').on('click', () => this._loadProjectBoard(project.number, $card, inaccessible));
        $card.find('.ia-gh-group-head').on('click', (e) => {
            $(e.currentTarget).closest('.ia-gh-group').toggleClass('collapsed');
        });
        $card.find('.ia-gh-more').on('click', (e) => {
            $(e.currentTarget).closest('.ia-gh-group').addClass('expanded');
            $(e.currentTarget).remove();
        });
        if (window.lucide) lucide.createIcons();
        this._ghScroll();
    }

    _ghGroupHtml(status, list) {
        const meta  = this._ghStatusMeta(status);
        const LIMIT = 5;
        const rows = list.map((it, i) => `
            <div class="ia-gh-item${i >= LIMIT ? ' ia-gh-extra' : ''}">
                <span class="ia-gh-item-title" title="${this._escape(it.title)}">${this._escape(it.title)}</span>
                ${it.size ? `<span class="ia-gh-size ia-gh-size-${this._escape((it.size || '').toLowerCase())}">${this._escape(it.size)}</span>` : ''}
            </div>
        `).join('');
        const more = list.length > LIMIT
            ? `<button type="button" class="ia-gh-more">ver ${list.length - LIMIT} más</button>`
            : '';
        return `
            <div class="ia-gh-group" data-status="${this._escape(status)}">
                <button type="button" class="ia-gh-group-head">
                    <span class="ia-gh-dot" style="background:${meta.color}"></span>
                    <span class="ia-gh-group-name">${this._escape(status)}</span>
                    <span class="ia-gh-group-count">${list.length}</span>
                    <i data-lucide="chevron-down" class="ia-gh-chev"></i>
                </button>
                <div class="ia-gh-items">${rows}${more}</div>
            </div>
        `;
    }

    _ghStatusMeta(status) {
        const s = (status || '').toLowerCase();
        if (s === 'done')                 return { color: '#22c55e' };
        if (s.indexOf('progress') !== -1) return { color: '#eab308' };
        if (s === 'todo' || s === 'to do')return { color: '#94a3b8' };
        return { color: '#64748b' };
    }

    _ghDate(iso) {
        if (!iso) return '';
        try {
            return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (e) { return ''; }
    }

    _ghScroll() {
        const el = $('#iaBodyChat')[0];
        if (el) el.scrollTop = el.scrollHeight;
    }

    // Reproduce el "pop" al crear un nuevo chat. La instancia de Audio se crea
    // una sola vez y se reinicia en cada uso para permitir reproducciones seguidas.
    _playPopSound() {
        try {
            if (!this._popSound) {
                this._popSound = new Audio('src/audio/pop_up.ogg');
                this._popSound.volume = 0.6;
            }
            this._popSound.currentTime = 0;
            const p = this._popSound.play();
            if (p && p.catch) p.catch(() => {});
        } catch (e) { /* autoplay bloqueado / formato no soportado — ignorar */ }
    }

    _appendUserMessage(text, images, docsMeta) {
        let imgsHtml = '';
        if (Array.isArray(images) && images.length) {
            imgsHtml = '<div class="ia-msg-imgs">' +
                images.map(u => `<img src="${u}" alt="imagen adjunta" loading="lazy">`).join('') +
                '</div>';
        }
        let docsHtml = '';
        if (Array.isArray(docsMeta) && docsMeta.length) {
            const fmtKb = (b) => b >= 1024 ? (b / 1024).toFixed(b >= 10240 ? 0 : 1) + ' KB' : (b || 0) + ' B';
            docsHtml = '<div class="ia-msg-docs">' +
                docsMeta.map(d => `
                    <span class="ia-msg-doc-chip" title="${this._escape(d.name)} (${fmtKb(d.size)})">
                        <i data-lucide="file-text"></i><span>${this._escape(d.name)}</span>
                    </span>`).join('') +
                '</div>';
        }
        const textHtml = text ? `<p>${this._escape(text)}</p>` : '';
        const $msg = $(`
            <div class="ia-msg user">
                <div class="ia-msg-text">${imgsHtml}${docsHtml}${textHtml}</div>
            </div>
        `);
        if (window.lucide) lucide.createIcons();
        $msg.find('.ia-msg-imgs img').on('click', function () {
            const src = $(this).attr('src');
            if (src) window.open(src, '_blank');
        });
        $('#iaBodyChat').append($msg);
    }

    _appendAIMessage(text, meta) {
        const htmlText = this._markdownToHtml(text);
        const msgId    = 'iaMsg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        let metaHtml = '';
        if (meta) {
            metaHtml = `
                <div class="ia-msg-meta-footer">
                    ${iaMetaItems(meta)}
                    <span class="meta-actions">
                        <button class="meta-iconbtn ia-copy-btn" title="Copiar respuesta"><i data-lucide="copy" class="w-3 h-3"></i></button>
                    </span>
                </div>
            `;
        }
        const proposalHint = (meta && meta.proposalsCount > 0)
            ? `<div><span class="ia-msg-proposal-hint"><i data-lucide="wand-sparkles"></i>${meta.proposalsCount} propuesta${meta.proposalsCount > 1 ? 's' : ''} en el panel</span></div>`
            : '';
        const $msg = $(`
            <div class="ia-msg ai" id="${msgId}">
                <div class="ia-msg-role"><span class="dot"></span><span>CoffeeIA</span></div>
                <div class="ia-msg-text">${htmlText}</div>
                ${proposalHint}
                ${metaHtml}
            </div>
        `);
        $msg.find('.ia-copy-btn').on('click', () => {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text);
            }
            if (visorView) visorView.toast('Respuesta copiada', 'success');
        });
        $('#iaBodyChat').append($msg);
        this._postProcessMessage($msg);
    }

    /* ── Post-procesador: mermaid / chart / html-preview ── */

    _postProcessMessage($msg) {
        const $codes = $msg.find('pre > code');
        $codes.each((_, codeEl) => {
            const $code = $(codeEl);
            const $pre  = $code.parent();
            const cls   = ($code.attr('class') || '').toLowerCase();
            const raw   = $code.text();

            const looksDrawio = /\blanguage-drawio\b/.test(cls) ||
                (/\blanguage-(xml|markup)\b/.test(cls) && /<mxGraphModel|<mxfile/i.test(raw));
            const looksExcalidraw = /\blanguage-excalidraw\b/.test(cls) ||
                (/\blanguage-json\b/.test(cls) && /"type"\s*:\s*"excalidraw/i.test(raw));

            if (looksDrawio) {
                this._renderDrawio($pre, raw);
            } else if (looksExcalidraw) {
                this._renderExcalidraw($pre, raw);
            } else if (/\blanguage-mermaid\b/.test(cls)) {
                this._renderMermaid($pre, raw);
            } else if (/\blanguage-dot\b|\blanguage-graphviz\b|\blanguage-gv\b/.test(cls)) {
                this._renderGraphviz($pre, raw);
            } else if (/\blanguage-chart\b|\blanguage-chartjs\b/.test(cls)) {
                this._renderChart($pre, raw);
            } else if (/\blanguage-html\b|\blanguage-html-preview\b/.test(cls)) {
                this._renderHtmlPreview($pre, raw);
            }
        });
    }

    _getTheme() {
        const t = (document.documentElement.getAttribute('data-theme') || 'dark').toLowerCase();
        return t === 'light' ? 'light' : 'dark';
    }

    // Tamano natural de un <svg>: prioriza el viewBox (Mermaid emite width="100%",
    // que no sirve como tamano intrinseco). Devuelve { w, h } en unidades de usuario.
    _svgNaturalSize(svgEl) {
        let w = 0, h = 0;
        const vb = svgEl.getAttribute('viewBox');
        if (vb) {
            const p = vb.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
            if (p.length === 4) { w = p[2]; h = p[3]; }
        }
        if (!w) w = parseFloat(svgEl.getAttribute('width')) || 0;
        if (!h) h = parseFloat(svgEl.getAttribute('height')) || 0;
        if ((!w || !h) && svgEl.getBBox) {
            try { const b = svgEl.getBBox(); w = w || b.width; h = h || b.height; } catch (e) {}
        }
        return { w, h };
    }

    _renderMermaid($pre, code) {
        if (typeof mermaid === 'undefined') return;
        const id = 'mer-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const $wrap = $(`
            <div class="ia-render-block ia-render-mermaid" data-render-type="mermaid">
                <div class="ia-render-toolbar">
                    <span><i data-lucide="git-graph" class="w-3 h-3"></i>Diagrama Mermaid</span>
                    <span class="ia-render-tabs">
                        <button class="ia-render-btn is-icon ia-render-refresh" title="Actualizar (volver a generar el diagrama)">
                            <i data-lucide="refresh-cw" class="w-3 h-3"></i>
                        </button>
                        <button class="ia-render-btn is-icon ia-render-toggle" data-target="${id}-code" title="Ver codigo">
                            <i data-lucide="code-2" class="w-3 h-3"></i>
                        </button>
                        <button class="ia-render-btn is-icon ia-render-zoom-out" style="display:none;" title="Alejar (zoom -)">
                            <i data-lucide="zoom-out" class="w-3 h-3"></i>
                        </button>
                        <button class="ia-render-btn ia-render-zoom-val" style="display:none;" title="Restablecer zoom">100%</button>
                        <button class="ia-render-btn is-icon ia-render-zoom-in" style="display:none;" title="Acercar (zoom +)">
                            <i data-lucide="zoom-in" class="w-3 h-3"></i>
                        </button>
                        <button class="ia-render-btn is-icon ia-render-expand" style="display:none;" title="Expandir a pantalla completa">
                            <i data-lucide="maximize-2" class="w-3 h-3"></i>
                        </button>
                    </span>
                </div>
                <div class="ia-render-view" id="${id}-view"></div>
                <pre id="${id}-code" class="ia-render-source" style="display:none;"></pre>
            </div>
        `);
        $wrap.find('.ia-render-source').text(code);
        $wrap.data('mermaid-code', code);
        $pre.replaceWith($wrap);

        // Limpia los elementos temporales que Mermaid v10 deja en <body> tras
        // un render fallido (las "bombas" de syntax error que quedan flotando).
        const cleanupOrphans = (rid) => {
            $('body > [id^="d' + rid + '"], body > [id="' + rid + '-svg"]').remove();
            $('body > .mermaidTooltip').remove();
        };

        // Zoom inline (dentro del chat, sin abrir el modal): escala el SVG segun su
        // ancho natural (viewBox) para que pueda crecer y hacer scroll en el bloque.
        let inlineScale = 1;
        const $zoomVal = $wrap.find('.ia-render-zoom-val');
        const applyInlineZoom = () => {
            const $svg  = $wrap.find('.ia-render-view svg').first();
            const $view = $wrap.find('.ia-render-view');
            $zoomVal.text(Math.round(inlineScale * 100) + '%');
            if (!$svg.length) return;
            const baseW = parseFloat($svg.attr('data-base-w')) || 0;
            if (!baseW || Math.abs(inlineScale - 1) < 0.001) {
                $svg.css({ width: '', height: '', 'max-width': '' });
                $view.removeClass('is-zoomed');
            } else {
                $svg.css({ width: (baseW * inlineScale) + 'px', height: 'auto', 'max-width': 'none' });
                $view.addClass('is-zoomed');
            }
        };

        // Dibuja (o vuelve a dibujar) el diagrama. Cada intento usa un id nuevo para
        // que Mermaid no choque con un render previo del mismo bloque. Lo reusan el
        // render inicial y el boton "Actualizar" (util cuando el diagrama sale en
        // blanco la primera vez por timing/visibilidad del drawer).
        const draw = () => {
            const $view = $wrap.find('.ia-render-view').show();
            $wrap.find('.ia-render-source').hide();
            $wrap.find('.ia-render-toggle')
                .html('<i data-lucide="code-2" class="w-3 h-3"></i>')
                .attr('title', 'Ver codigo');
            $view.html('<div class="ia-render-loading"><span class="ia-gh-spin"></span>Generando diagrama&hellip;</div>');
            const rid = 'mer-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
            try {
                mermaid.initialize({
                    startOnLoad: false,
                    theme: this._getTheme() === 'light' ? 'default' : 'dark',
                    securityLevel: 'strict'
                });
                mermaid.render(rid + '-svg', $wrap.data('mermaid-code')).then(({ svg }) => {
                    $view.html(svg);
                    $wrap.data('mermaid-svg', svg);
                    const svgEl = $view.find('svg')[0];
                    if (svgEl) {
                        const { w, h } = this._svgNaturalSize(svgEl);
                        if (w) svgEl.setAttribute('data-base-w', w);
                        if (h) svgEl.setAttribute('data-base-h', h);
                    }
                    inlineScale = 1;
                    applyInlineZoom();
                    $wrap.find('.ia-render-expand, .ia-render-zoom-in, .ia-render-zoom-out, .ia-render-zoom-val').show();
                    cleanupOrphans(rid);
                    if (window.lucide) lucide.createIcons();
                }).catch((err) => {
                    cleanupOrphans(rid);
                    const msg = this._escape(err.message || err);
                    $view.html(
                        `<div class="ia-render-error">
                            <strong>Error Mermaid:</strong> ${msg}
                            <div style="margin-top:6px;font-size:11px;color:var(--vsr-text-mute2);">El diagrama tiene sintaxis invalida. Pulsa "Codigo" para revisar la fuente y luego "Actualizar".</div>
                        </div>`
                    );
                    if (window.lucide) lucide.createIcons();
                });
            } catch (e) {
                cleanupOrphans(rid);
                $view.html(
                    `<div class="ia-render-error">Error Mermaid: ${this._escape(e.message || e)}</div>`
                );
            }
        };

        draw();

        // Actualizar: re-genera el diagrama on-demand.
        $wrap.find('.ia-render-refresh').on('click', (e) => {
            const $btn = $(e.currentTarget).addClass('is-spinning');
            draw();
            setTimeout(() => $btn.removeClass('is-spinning'), 600);
        });

        $wrap.find('.ia-render-toggle').on('click', (e) => {
            const $btn = $(e.currentTarget);
            const $src = $('#' + $btn.data('target'));
            const $view = $wrap.find('.ia-render-view');
            const showCode = $src.is(':hidden');
            $src.toggle(showCode);
            $view.toggle(!showCode);
            $btn.html(showCode
                ? '<i data-lucide="eye" class="w-3 h-3"></i>'
                : '<i data-lucide="code-2" class="w-3 h-3"></i>');
            $btn.attr('title', showCode ? 'Ver diagrama' : 'Ver codigo');
            if (window.lucide) lucide.createIcons();
        });

        // Zoom inline: botones -, valor (reset) y +, mas Ctrl + rueda sobre el diagrama.
        const stepZoom = (dir) => {
            inlineScale = dir === 0 ? 1 : Math.max(0.4, Math.min(3, +(inlineScale + dir * 0.2).toFixed(2)));
            applyInlineZoom();
        };
        $wrap.find('.ia-render-zoom-in').on('click', () => stepZoom(1));
        $wrap.find('.ia-render-zoom-out').on('click', () => stepZoom(-1));
        $wrap.find('.ia-render-zoom-val').on('click', () => stepZoom(0));
        $wrap.find('.ia-render-view').on('wheel', (e) => {
            const oe = e.originalEvent;
            if (!oe.ctrlKey) return;
            oe.preventDefault();
            inlineScale = Math.max(0.4, Math.min(3, +(inlineScale + (oe.deltaY < 0 ? 0.15 : -0.15)).toFixed(2)));
            applyInlineZoom();
        });

        $wrap.find('.ia-render-expand').on('click', () => {
            const svg = $wrap.data('mermaid-svg') || $wrap.find('.ia-render-view').html();
            this._openMermaidModal(svg);
        });

        if (window.lucide) lucide.createIcons();
    }

    // Diagrama draw.io: el modelo emite XML mxGraphModel/mxfile. No lo renderizamos
    // inline (no hay motor mxGraph standalone); ofrecemos abrirlo/editarlo en el
    // lienzo draw.io embebido (DrawioBoard) o guardarlo como archivo .drawio.
    _renderDrawio($pre, xml) {
        const code  = String(xml || '').trim();
        const valid = /<mxGraphModel|<mxfile/i.test(code);
        const id    = 'dio-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

        const $wrap = $(`
            <div class="ia-render-block ia-render-drawio" data-render-type="drawio">
                <div class="ia-render-toolbar">
                    <span><i data-lucide="pen-tool" class="w-3 h-3"></i>Diagrama draw.io</span>
                    <span class="ia-render-tabs">
                        <button class="ia-render-btn is-icon ia-render-open" title="Abrir y editar en el lienzo">
                            <i data-lucide="maximize-2" class="w-3 h-3"></i>
                        </button>
                        <button class="ia-render-btn is-icon ia-render-newtab" title="Abrir en otra pestaña">
                            <i data-lucide="external-link" class="w-3 h-3"></i>
                        </button>
                        <button class="ia-render-btn is-icon ia-render-save" title="Guardar como archivo .drawio">
                            <i data-lucide="save" class="w-3 h-3"></i>
                        </button>
                        <button class="ia-render-btn is-icon ia-render-toggle" data-target="${id}-code" title="Ver codigo">
                            <i data-lucide="code-2" class="w-3 h-3"></i>
                        </button>
                    </span>
                </div>
                <div class="ia-render-view" id="${id}-view"></div>
                <pre id="${id}-code" class="ia-render-source" style="display:none;"></pre>
            </div>
        `);
        $wrap.find('.ia-render-source').text(code);
        $wrap.data('drawio-xml', code);

        if (valid) {
            $wrap.find('.ia-render-view').html(`
                <div style="display:flex;align-items:center;gap:10px;padding:14px;">
                    <div style="width:38px;height:38px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.14);color:#818cf8;flex-shrink:0;">
                        <i data-lucide="workflow" class="w-5 h-5"></i>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
                        <strong style="font-size:12px;">Diagrama listo</strong>
                        <span style="font-size:11px;color:var(--vsr-text-mute2);">Pulsa "Abrir en lienzo" para verlo y editarlo en draw.io, o "Guardar" como .drawio.</span>
                    </div>
                </div>`);
        } else {
            $wrap.find('.ia-render-view').html(
                `<div class="ia-render-error"><strong>Diagrama draw.io invalido:</strong> falta &lt;mxGraphModel&gt;. Pulsa "Codigo" para revisar la fuente.</div>`
            );
            $wrap.find('.ia-render-open, .ia-render-save').prop('disabled', true).css('opacity', 0.5);
        }

        $pre.replaceWith($wrap);

        $wrap.find('.ia-render-open').on('click', () => {
            if (typeof drawioBoard === 'undefined' || !drawioBoard) {
                if (typeof visorView !== 'undefined' && visorView) visorView.toast('El lienzo no esta disponible', 'error');
                return;
            }
            drawioBoard.open({ file: 'ia-diagrama-' + Date.now() + '.drawio', raw: $wrap.data('drawio-xml') });
        });

        $wrap.find('.ia-render-newtab').on('click', () => {
            this._openDiagramInTab('drawio', 'diagrama.drawio', $wrap.data('drawio-xml'));
        });

        $wrap.find('.ia-render-save').on('click', () => {
            if (!this._app || typeof this._app.openNewFileModal !== 'function') return;
            this._app.openNewFileModal({ name: 'diagrama.drawio', content: $wrap.data('drawio-xml') });
        });

        $wrap.find('.ia-render-toggle').on('click', (e) => {
            const $btn  = $(e.currentTarget);
            const $src  = $('#' + $btn.data('target'));
            const $view = $wrap.find('.ia-render-view');
            const showCode = $src.is(':hidden');
            $src.toggle(showCode);
            $view.toggle(!showCode);
            $btn.html(showCode
                ? '<i data-lucide="eye" class="w-3 h-3"></i>'
                : '<i data-lucide="code-2" class="w-3 h-3"></i>');
            $btn.attr('title', showCode ? 'Ver diagrama' : 'Ver codigo');
            if (window.lucide) lucide.createIcons();
        });

        if (window.lucide) lucide.createIcons();
    }

    // Boceto Excalidraw: el modelo emite una escena JSON (formato skeleton). No la
    // renderizamos inline; ofrecemos abrirla/editarla en el lienzo Excalidraw
    // (ExcalidrawBoard, solo disponible en index-2.php) o guardarla como .excalidraw.
    _renderExcalidraw($pre, jsonText) {
        const code = String(jsonText || '').trim();
        let valid = false;
        try {
            const o = JSON.parse(code);
            valid = o && (/excalidraw/i.test(o.type || '') || Array.isArray(o.elements));
        } catch (e) { valid = false; }
        const id = 'exc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

        const $wrap = $(`
            <div class="ia-render-block ia-render-excalidraw" data-render-type="excalidraw">
                <div class="ia-render-toolbar">
                    <span><i data-lucide="pencil-ruler" class="w-3 h-3"></i>Boceto Excalidraw</span>
                    <span class="ia-render-tabs">
                        <button class="ia-render-btn is-icon ia-render-open" title="Abrir y editar en el lienzo Excalidraw">
                            <i data-lucide="maximize-2" class="w-3 h-3"></i>
                        </button>
                        <button class="ia-render-btn is-icon ia-render-newtab" title="Abrir en otra pestaña">
                            <i data-lucide="external-link" class="w-3 h-3"></i>
                        </button>
                        <button class="ia-render-btn is-icon ia-render-save" title="Guardar como archivo .excalidraw">
                            <i data-lucide="save" class="w-3 h-3"></i>
                        </button>
                        <button class="ia-render-btn is-icon ia-render-toggle" data-target="${id}-code" title="Ver codigo">
                            <i data-lucide="code-2" class="w-3 h-3"></i>
                        </button>
                    </span>
                </div>
                <div class="ia-render-view" id="${id}-view"></div>
                <pre id="${id}-code" class="ia-render-source" style="display:none;"></pre>
            </div>
        `);
        $wrap.find('.ia-render-source').text(code);
        $wrap.data('excalidraw-json', code);

        if (valid) {
            $wrap.find('.ia-render-view').html(`
                <div style="display:flex;align-items:center;gap:10px;padding:14px;">
                    <div style="width:38px;height:38px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.14);color:#818cf8;flex-shrink:0;">
                        <i data-lucide="pencil-ruler" class="w-5 h-5"></i>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
                        <strong style="font-size:12px;">Boceto listo</strong>
                        <span style="font-size:11px;color:var(--vsr-text-mute2);">Pulsa "Abrir en lienzo" para verlo y editarlo en Excalidraw, o "Guardar" como .excalidraw.</span>
                    </div>
                </div>`);
        } else {
            $wrap.find('.ia-render-view').html(
                `<div class="ia-render-error"><strong>Boceto Excalidraw invalido:</strong> JSON no parseable o sin "elements". Pulsa "Codigo" para revisar la fuente.</div>`
            );
            $wrap.find('.ia-render-open, .ia-render-save').prop('disabled', true).css('opacity', 0.5);
        }

        $pre.replaceWith($wrap);

        $wrap.find('.ia-render-open').on('click', () => {
            if (typeof excalidrawBoard === 'undefined' || !excalidrawBoard) {
                if (typeof visorView !== 'undefined' && visorView) visorView.toast('El lienzo Excalidraw no esta disponible en este visor', 'error');
                return;
            }
            excalidrawBoard.open({ file: 'ia-boceto-' + Date.now() + '.excalidraw', raw: $wrap.data('excalidraw-json') });
        });

        $wrap.find('.ia-render-newtab').on('click', () => {
            this._openDiagramInTab('excalidraw', 'boceto.excalidraw', $wrap.data('excalidraw-json'));
        });

        $wrap.find('.ia-render-save').on('click', () => {
            if (!this._app || typeof this._app.openNewFileModal !== 'function') return;
            this._app.openNewFileModal({ name: 'boceto.excalidraw', content: $wrap.data('excalidraw-json') });
        });

        $wrap.find('.ia-render-toggle').on('click', (e) => {
            const $btn  = $(e.currentTarget);
            const $src  = $('#' + $btn.data('target'));
            const $view = $wrap.find('.ia-render-view');
            const showCode = $src.is(':hidden');
            $src.toggle(showCode);
            $view.toggle(!showCode);
            $btn.html(showCode
                ? '<i data-lucide="eye" class="w-3 h-3"></i>'
                : '<i data-lucide="code-2" class="w-3 h-3"></i>');
            $btn.attr('title', showCode ? 'Ver boceto' : 'Ver codigo');
            if (window.lucide) lucide.createIcons();
        });

        if (window.lucide) lucide.createIcons();
    }

    _renderGraphviz($pre, code) {
        if (typeof Viz === 'undefined') {
            $pre.replaceWith($('<div class="ia-render-block ia-render-error">Graphviz (Viz.js) no se cargo.</div>'));
            return;
        }
        const id = 'gv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const $wrap = $(`
            <div class="ia-render-block ia-render-graphviz" data-render-type="graphviz">
                <div class="ia-render-toolbar">
                    <span><i data-lucide="database" class="w-3 h-3"></i>Diagrama Graphviz</span>
                    <span class="ia-render-tabs">
                        <button class="ia-render-btn is-icon ia-render-toggle" data-target="${id}-code" title="Ver codigo">
                            <i data-lucide="code-2" class="w-3 h-3"></i>
                        </button>
                        <button class="ia-render-btn is-icon ia-render-expand" style="display:none;" title="Expandir a pantalla completa">
                            <i data-lucide="maximize-2" class="w-3 h-3"></i>
                        </button>
                    </span>
                </div>
                <div class="ia-render-view" id="${id}-view"></div>
                <pre id="${id}-code" class="ia-render-source" style="display:none;"></pre>
            </div>
        `);
        $wrap.find('.ia-render-source').text(code);
        $pre.replaceWith($wrap);

        // Viz.instance() resuelve el runtime WASM una sola vez; renderString es sincrono.
        Viz.instance().then((viz) => {
            const svg = viz.renderString(code, { format: 'svg' });
            $wrap.find('.ia-render-view').html(svg);
            $wrap.data('graphviz-svg', svg);
            $wrap.find('.ia-render-expand').show();
        }).catch((err) => {
            const msg = this._escape(err && err.message ? err.message : err);
            $wrap.find('.ia-render-view').html(
                `<div class="ia-render-error"><strong>Error Graphviz:</strong> ${msg}
                    <div style="margin-top:6px;font-size:11px;color:var(--vsr-text-mute2);">Revisa la sintaxis DOT pulsando "Codigo".</div>
                </div>`
            );
        });

        $wrap.find('.ia-render-toggle').on('click', (e) => {
            const $btn  = $(e.currentTarget);
            const $src  = $('#' + $btn.data('target'));
            const $view = $wrap.find('.ia-render-view');
            const showCode = $src.is(':hidden');
            $src.toggle(showCode);
            $view.toggle(!showCode);
            $btn.html(showCode
                ? '<i data-lucide="eye" class="w-3 h-3"></i>'
                : '<i data-lucide="code-2" class="w-3 h-3"></i>');
            $btn.attr('title', showCode ? 'Ver diagrama' : 'Ver codigo');
            if (window.lucide) lucide.createIcons();
        });

        $wrap.find('.ia-render-expand').on('click', () => {
            const svg = $wrap.data('graphviz-svg') || $wrap.find('.ia-render-view').html();
            this._openMermaidModal(svg, { title: 'Diagrama Graphviz', canvasBg: '#ffffff' });
        });

        if (window.lucide) lucide.createIcons();
    }

    _openMermaidModal(svg, opts) {
        opts = opts || {};
        const mTitle      = opts.title || 'Diagrama Mermaid';
        const canvasStyle = opts.canvasBg ? ` style="background:${opts.canvasBg};border-radius:8px;"` : '';
        $('.ia-mermaid-modal').remove();
        const modalId = 'mer-modal-' + Date.now();
        const $modal = $(`
            <div class="ia-mermaid-modal" id="${modalId}">
                <div class="ia-mermaid-modal-box">
                    <div class="ia-mermaid-modal-head">
                        <h3><i data-lucide="git-graph"></i>${mTitle}</h3>
                        <div class="ia-mermaid-modal-tools">
                            <button class="cs-btn cs-btn-ghost cs-btn-sm ia-mermaid-zoom-out" title="Zoom -">
                                <i data-lucide="zoom-out" class="w-3.5 h-3.5"></i>
                            </button>
                            <span class="ia-mermaid-zoom-val">100%</span>
                            <button class="cs-btn cs-btn-ghost cs-btn-sm ia-mermaid-zoom-in" title="Zoom +">
                                <i data-lucide="zoom-in" class="w-3.5 h-3.5"></i>
                            </button>
                            <button class="cs-btn cs-btn-ghost cs-btn-sm ia-mermaid-zoom-reset" title="Restablecer">
                                <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                            </button>
                            <button class="cs-btn cs-btn-ghost cs-btn-sm ia-mermaid-download" title="Descargar SVG">
                                <i data-lucide="download" class="w-3.5 h-3.5"></i>
                                SVG
                            </button>
                            <button class="cs-btn cs-btn-ghost cs-btn-sm ia-mermaid-modal-close" title="Cerrar (Esc)">
                                <i data-lucide="x" class="w-3.5 h-3.5"></i>
                                Cerrar
                            </button>
                        </div>
                    </div>
                    <div class="ia-mermaid-modal-body">
                        <div class="ia-mermaid-modal-canvas"${canvasStyle}>${svg}</div>
                    </div>
                </div>
            </div>
        `);
        $('body').append($modal);

        const $canvas = $modal.find('.ia-mermaid-modal-canvas');
        const $val    = $modal.find('.ia-mermaid-zoom-val');

        // Normaliza el SVG: Mermaid v10 lo emite con width="100%", que dentro de un
        // contenedor shrink-to-fit (inline-block) colapsa a 0 -> "no se ve nada".
        // Le fijamos un ancho/alto explicito desde el viewBox para que tenga tamano
        // intrinseco real; a partir de ahi el zoom/pan opera sobre el canvas.
        const svgEl = $canvas.find('svg')[0];
        if (svgEl) {
            const { w, h } = this._svgNaturalSize(svgEl);
            if (w && h) {
                svgEl.setAttribute('width', w);
                svgEl.setAttribute('height', h);
                svgEl.style.width     = w + 'px';
                svgEl.style.height    = h + 'px';
                svgEl.style.maxWidth  = 'none';
                svgEl.style.maxHeight = 'none';
            }
        }

        // Zoom + pan (arrastre con el raton).
        let scale = 1, panX = 0, panY = 0;
        const applyZoom = () => {
            $canvas.css('transform', `translate(${panX}px, ${panY}px) scale(${scale})`);
            $val.text(Math.round(scale * 100) + '%');
        };
        $modal.find('.ia-mermaid-zoom-in').on('click', () => {
            scale = Math.min(scale + 0.2, 4); applyZoom();
        });
        $modal.find('.ia-mermaid-zoom-out').on('click', () => {
            scale = Math.max(scale - 0.2, 0.2); applyZoom();
        });
        $modal.find('.ia-mermaid-zoom-reset').on('click', () => {
            scale = 1; panX = 0; panY = 0; applyZoom();
        });
        $modal.find('.ia-mermaid-modal-body').on('wheel', (e) => {
            const oe = e.originalEvent;
            if (!oe.ctrlKey) return;
            oe.preventDefault();
            scale = Math.max(0.2, Math.min(4, scale + (oe.deltaY < 0 ? 0.1 : -0.1)));
            applyZoom();
        });

        // Pan: arrastrar el lienzo para desplazar el diagrama cuando esta ampliado.
        let dragging = false, startX = 0, startY = 0;
        $canvas.on('mousedown', (e) => {
            dragging = true; startX = e.clientX - panX; startY = e.clientY - panY;
            e.preventDefault();
        });
        $(document).on('mousemove.iaMermaidPan', (e) => {
            if (!dragging) return;
            panX = e.clientX - startX; panY = e.clientY - startY; applyZoom();
        });
        $(document).on('mouseup.iaMermaidPan', () => { dragging = false; });

        $modal.find('.ia-mermaid-download').on('click', () => {
            const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = 'diagram-' + Date.now() + '.svg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        const close = () => {
            $modal.remove();
            $(document).off('keydown.iaMermaidModal mousemove.iaMermaidPan mouseup.iaMermaidPan');
        };
        $modal.find('.ia-mermaid-modal-close').on('click', close);
        $modal.on('click', (e) => { if (e.target === $modal[0]) close(); });
        $(document).on('keydown.iaMermaidModal', (e) => { if (e.key === 'Escape') close(); });

        if (window.lucide) lucide.createIcons();
    }

    _renderChart($pre, code) {
        if (typeof Chart === 'undefined') return;
        let config;
        try {
            config = JSON.parse(code);
        } catch (e) {
            const $err = $(`<div class="ia-render-block ia-render-error">JSON invalido en bloque chart: ${this._escape(e.message)}</div>`);
            $pre.replaceWith($err);
            return;
        }
        const id = 'cht-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const $wrap = $(`
            <div class="ia-render-block ia-render-chart" data-render-type="chart">
                <div class="ia-render-toolbar">
                    <span><i data-lucide="bar-chart-3" class="w-3 h-3"></i>Grafico</span>
                    <button class="ia-render-btn ia-render-toggle" data-target="${id}-code">
                        <i data-lucide="code-2" class="w-3 h-3"></i>JSON
                    </button>
                </div>
                <div class="ia-render-view"><canvas id="${id}-canvas"></canvas></div>
                <pre id="${id}-code" class="ia-render-source" style="display:none;"></pre>
            </div>
        `);
        $wrap.find('.ia-render-source').text(code);
        $pre.replaceWith($wrap);

        try {
            const ctx = document.getElementById(id + '-canvas').getContext('2d');
            new Chart(ctx, config);
        } catch (e) {
            $wrap.find('.ia-render-view').html(
                `<div class="ia-render-error">Error Chart.js: ${this._escape(e.message || e)}</div>`
            );
        }

        $wrap.find('.ia-render-toggle').on('click', (e) => {
            const $btn = $(e.currentTarget);
            const $src = $('#' + $btn.data('target'));
            const $view = $wrap.find('.ia-render-view');
            const showCode = $src.is(':hidden');
            $src.toggle(showCode);
            $view.toggle(!showCode);
            $btn.html(showCode
                ? '<i data-lucide="bar-chart-3" class="w-3 h-3"></i>Grafico'
                : '<i data-lucide="code-2" class="w-3 h-3"></i>JSON');
            if (window.lucide) lucide.createIcons();
        });
        if (window.lucide) lucide.createIcons();
    }

    _renderHtmlPreview($pre, code) {
        const id = 'htm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const safeCode = (typeof DOMPurify !== 'undefined')
            ? DOMPurify.sanitize(code, { ADD_TAGS: ['svg', 'path', 'use'], ADD_ATTR: ['data-lucide'] })
            : code;
        const isDark = this._getTheme() === 'dark';
        const bg     = isDark ? '#0F172A' : '#FFFFFF';
        const fg     = isDark ? '#E2E8F0' : '#1F2937';
        // El grimorio Huubie obliga clases .cs-* (ui-kit.css). Como el iframe usa
        // srcdoc (sin base URL), resolvemos la ruta del kit a URL absoluta para
        // que el preview renderice con el mismo estilo institucional del visor.
        const uiKitHref = new URL('src/css/ui-kit.css', document.baseURI).href;
        const srcdoc = `<!doctype html><html data-theme="${isDark ? 'dark' : 'light'}"><head><meta charset="utf-8">
            <script src="https://cdn.tailwindcss.com"><\/script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="${uiKitHref}">
            <script src="https://unpkg.com/lucide@latest"><\/script>
            <style>
                html,body{margin:0;padding:0;}
                body{padding:8px;background:${bg};color:${fg};font-family:Inter,system-ui,sans-serif;font-size:13px;}
                *{box-sizing:border-box;}
            </style></head>
            <body>${safeCode}<script>if(window.lucide)lucide.createIcons();<\/script></body></html>`;

        const $wrap = $(`
            <div class="ia-render-block ia-render-html" data-render-type="html">
                <div class="ia-render-toolbar">
                    <span><i data-lucide="layout" class="w-3 h-3"></i>HTML</span>
                    <span class="ia-render-tabs">
                        <button class="ia-render-btn ia-render-tab is-active" data-tab="preview">Vista previa</button>
                        <button class="ia-render-btn ia-render-tab" data-tab="code">Codigo</button>
                        <button class="ia-render-btn ia-render-expand" title="Expandir a pantalla completa">
                            <i data-lucide="maximize-2" class="w-3 h-3"></i>Expandir
                        </button>
                    </span>
                </div>
                <div class="ia-render-view"><iframe id="${id}-iframe" class="ia-render-iframe" sandbox="allow-scripts" loading="lazy"></iframe></div>
                <pre id="${id}-code" class="ia-render-source" style="display:none;"></pre>
            </div>
        `);
        $wrap.find('.ia-render-source').text(code);
        $pre.replaceWith($wrap);

        const $iframe = $('#' + id + '-iframe');
        $iframe.attr('srcdoc', srcdoc);
        // Auto-altura cuando carga: respeta min/max definidos en CSS
        $iframe.on('load', function () {
            try {
                const doc = this.contentDocument || this.contentWindow.document;
                const h = Math.min(520, Math.max(280, doc.body.scrollHeight + 16));
                this.style.height = h + 'px';
            } catch (e) { /* sandbox cross-origin */ }
        });

        $wrap.find('.ia-render-tab').on('click', (e) => {
            const tab = $(e.currentTarget).data('tab');
            $wrap.find('.ia-render-tab').removeClass('is-active');
            $(e.currentTarget).addClass('is-active');
            $wrap.find('.ia-render-view').toggle(tab === 'preview');
            $wrap.find('.ia-render-source').toggle(tab === 'code');
        });

        $wrap.find('.ia-render-expand').on('click', () => {
            this._openHtmlModal(srcdoc);
        });

        if (window.lucide) lucide.createIcons();
    }

    _openHtmlModal(srcdoc) {
        $('.ia-html-modal').remove();
        const $modal = $(`
            <div class="ia-html-modal">
                <div class="ia-html-modal-box">
                    <div class="ia-html-modal-head">
                        <h3><i data-lucide="layout"></i>Vista previa HTML</h3>
                        <button class="cs-btn cs-btn-ghost cs-btn-sm ia-html-modal-close" title="Cerrar (Esc)">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                            Cerrar
                        </button>
                    </div>
                    <div class="ia-html-modal-body">
                        <iframe sandbox="allow-scripts"></iframe>
                    </div>
                </div>
            </div>
        `);
        $('body').append($modal);
        $modal.find('iframe').attr('srcdoc', srcdoc);

        const close = () => { $modal.remove(); $(document).off('keydown.iaHtmlModal'); };
        $modal.find('.ia-html-modal-close').on('click', close);
        $modal.on('click', (e) => { if (e.target === $modal[0]) close(); });
        $(document).on('keydown.iaHtmlModal', (e) => { if (e.key === 'Escape') close(); });

        if (window.lucide) lucide.createIcons();
    }

    /* Re-renderiza todos los bloques (mermaid + html) tras cambiar de tema */
    _reRenderBlocksOnThemeChange() {
        $('#iaBodyChat .ia-render-block').each((_, el) => {
            const $blk  = $(el);
            const type  = $blk.data('render-type');
            const src   = $blk.find('.ia-render-source').text();
            if (!src) return;
            // Reconstruimos un <pre><code> equivalente y reusamos los renderers
            const $stub = $('<pre><code></code></pre>');
            $stub.find('code').addClass('language-' + (type === 'html' ? 'html' : type)).text(src);
            $blk.replaceWith($stub);
            if (type === 'mermaid') this._renderMermaid($stub, src);
            else if (type === 'html') this._renderHtmlPreview($stub, src);
            else if (type === 'drawio') this._renderDrawio($stub, src);
            else if (type === 'excalidraw') this._renderExcalidraw($stub, src);
            // Charts no dependen del tema del visor, los dejamos como estan
        });
    }

    _appendTyping() {
        const hostId = 'iaTypingHost-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        const $t = $(`
            <div class="ia-msg ai ia-typing-msg">
                <div id="${hostId}" class="ia-typing-loader"></div>
                <span class="ia-typing-phase" style="display:none;"></span>
            </div>
        `);
        $('#iaBodyChat').append($t);

        if (typeof Templates !== 'undefined') {
            if (!CoffeeIA._loaderHelper) CoffeeIA._loaderHelper = new Templates();
            CoffeeIA._loaderHelper.loader({
                parent: hostId,
                type:   'quantum',
                size:   'xs',
                text:   'Analizando'
            });
        } else {
            $('#' + hostId).text('Analizando...');
        }
        return $t;
    }

    // Muestra que el modelo esta razonando (tokens de "thinking") con progreso vivo,
    // para que el indicador no parezca colgado en modelos de razonamiento.
    _setTypingPhase($typing, chars) {
        if (!$typing) return;
        const $phase = $typing.find('.ia-typing-phase');
        if (!$phase.length) return;
        const approxToks = Math.max(1, Math.round(chars / 4));   // ~4 chars/token
        // Pintamos el icono una sola vez (lucide lo convierte a <svg>); luego solo
        // actualizamos el contador para no recrear el SVG en cada token.
        if (!$phase.data('inited')) {
            // Al pasar a razonamiento ocultamos el loader "Analizando…": ahora el
            // estado lo comunica la linea "Razonando…".
            $typing.find('.ia-typing-loader').hide();
            $phase.html('<i data-lucide="brain" class="ia-typing-brain"></i><span class="ia-typing-phase-text"></span>').show();
            $phase.data('inited', true);
            if (window.lucide) lucide.createIcons();
        }
        $phase.find('.ia-typing-phase-text').text('Razonando… ≈ ' + approxToks + ' tokens');
    }

    _scrollBottom() {
        const el = $('#iaBodyChat')[0] || $('#iaBodyEmpty')[0];
        if (el) el.scrollTop = el.scrollHeight;
    }

    /* ── Clear conversation ── */

    clearConversation() {
        this.history = [];
        this._currentChatUid = null;
        this._currentChatTitle = null;
        this._chipsRendered = false;
        this._setActiveDb(null);   // al limpiar, se suelta la conexion a la base
        $('#iaBodyChat').empty().hide();
        $('#iaBodyEmpty').show();
        this._syncContext();
    }

    /* ── Conexion a base de datos (pegajosa por conversacion) ── */

    // Fija (o suelta, con null) la base conectada y refresca el chip indicador.
    _setActiveDb(schema) {
        this.activeDb = schema || null;
        this._renderDbIndicator();
    }

    // Chip "conectado a <base> ✕" sobre el input. La ✕ desconecta (sin borrar el chat).
    _renderDbIndicator() {
        const $chip = $('#iaDbChip');
        if (!$chip.length) return;
        if (!this.activeDb) { $chip.hide().empty(); return; }
        $chip.html(`
            <i data-lucide="database" class="w-3 h-3"></i>
            <span class="ia-db-chip-name">${this._escape(this.activeDb)}</span>
            <button type="button" class="ia-db-chip-x" title="Desconectar de la base">
                <i data-lucide="x" class="w-3 h-3"></i>
            </button>
        `).show();
        $chip.find('.ia-db-chip-x').off('click').on('click', () => {
            this._setActiveDb(null);
            this._toast('Desconectado de la base', 'info');
        });
        if (window.lucide) lucide.createIcons();
    }

    /* ── Persistencia de conversaciones (SQLite via ctrl-chats.php) ── */

    _toast(msg, kind) {
        if (typeof visorView !== 'undefined' && visorView) visorView.toast(msg, kind);
    }

    // Titulo sugerido a partir del primer mensaje del usuario.
    _suggestChatTitle() {
        const first = this.history.find(m => m.role === 'user');
        let t = first && first.content ? String(first.content).trim().replace(/\s+/g, ' ') : '';
        // Quitar bloques de docs adjuntos embebidos en el content.
        t = t.replace(/===\s*DOCUMENTOS ADJUNTOS[\s\S]*$/i, '').trim();
        if (!t) return 'Conversacion ' + new Date().toLocaleString();
        return t.slice(0, 80);
    }

    // Guarda la conversacion actual en el servidor. Si ya tiene uid, la actualiza.
    async saveConversation() {
        if (!this.history.length) {
            this._toast('No hay conversación que guardar', 'warn');
            return;
        }

        const suggested = this._currentChatTitle || this._suggestChatTitle();
        const title = window.prompt('Nombre para guardar esta conversación:', suggested);
        if (title === null) return;   // cancelado

        const userId = (this._app && this._app.currentUser) ? this._app.currentUser.id : '';

        try {
            const form = new FormData();
            form.append('action',   'save');
            if (this._currentChatUid) form.append('uid', this._currentChatUid);
            form.append('title',    title.trim());
            form.append('user_id',  userId);
            form.append('model',    this.model || '');
            form.append('doc',      (this._app && this._app.currentFile) || '');
            form.append('messages', JSON.stringify(this.history));

            const res  = await fetch(this._apiChats, { method: 'POST', body: form });
            const data = await res.json();
            if (!data.success) { this._toast(data.message || 'No se pudo guardar el chat', 'error'); return; }

            this._currentChatUid   = data.uid;
            this._currentChatTitle = data.title;
            this._toast('Chat guardado: ' + data.title, 'success');
        } catch (e) {
            this._toast('Error de red al guardar el chat', 'error');
        }
    }

    /* ── Modal de chats guardados ── */

    // El modal se inyecta una sola vez en el DOM (lazy) para no tocar el HTML base.
    _ensureSavedChatsModal() {
        if (document.getElementById('iaSavedModal')) return;
        const $modal = $(`
            <div id="iaSavedModal" class="ia-saved-modal hidden" aria-hidden="true">
                <div class="ia-saved-backdrop"></div>
                <div class="ia-saved-dialog" role="dialog" aria-label="Chats guardados">
                    <div class="ia-saved-head">
                        <span class="ia-saved-title"><i data-lucide="messages-square" class="w-4 h-4"></i> Chats guardados</span>
                        <button id="iaSavedClose" class="ia-saved-close" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>
                    </div>
                    <div id="iaSavedList" class="ia-saved-list"></div>
                </div>
            </div>
        `);
        $('body').append($modal);

        $modal.find('.ia-saved-backdrop, #iaSavedClose').on('click', () => this._closeSavedChatsModal());
        $(document).on('keydown.iaSavedModal', (e) => {
            if (e.key === 'Escape' && !$modal.hasClass('hidden')) this._closeSavedChatsModal();
        });

        $('#iaSavedList').on('click', '[data-load-chat]', (e) => {
            const uid = $(e.currentTarget).data('load-chat');
            this.loadConversation(uid);
        });
        $('#iaSavedList').on('click', '[data-del-chat]', (e) => {
            e.stopPropagation();
            const uid = $(e.currentTarget).data('del-chat');
            this.deleteSavedChat(uid);
        });
    }

    async openSavedChatsModal() {
        this._ensureSavedChatsModal();
        $('#iaSavedModal').removeClass('hidden').attr('aria-hidden', 'false');
        $('#iaSavedList').html('<div class="ia-saved-empty">Cargando…</div>');
        if (window.lucide) lucide.createIcons();

        try {
            const url  = this._apiChats + '?action=list';
            const res  = await fetch(url, { cache: 'no-store' });
            const data = await res.json();
            if (!data.success) { $('#iaSavedList').html('<div class="ia-saved-empty">' + (data.message || 'Error al listar') + '</div>'); return; }
            this._renderSavedChatsList(data.rows || []);
        } catch (e) {
            $('#iaSavedList').html('<div class="ia-saved-empty">Error de red al cargar la lista</div>');
        }
    }

    _closeSavedChatsModal() {
        $('#iaSavedModal').addClass('hidden').attr('aria-hidden', 'true');
    }

    _renderSavedChatsList(rows) {
        if (!rows.length) {
            $('#iaSavedList').html('<div class="ia-saved-empty">No hay conversaciones guardadas todavía.</div>');
            return;
        }
        const html = rows.map(r => `
            <div class="ia-saved-item" data-load-chat="${r.uid}" title="Abrir esta conversación">
                <div class="ia-saved-item-main">
                    <span class="ia-saved-item-title">${this._escape(r.title)}</span>
                    <span class="ia-saved-item-meta">
                        <i data-lucide="message-circle" class="w-3 h-3"></i> ${r.msg_count}
                        ${r.doc ? '· <i data-lucide="file-text" class="w-3 h-3"></i> ' + this._escape(r.doc) : ''}
                        ${r.model ? '· ' + this._escape(r.model) : ''}
                        · ${this._escape(r.updated_at || '')}
                    </span>
                </div>
                <button class="ia-saved-del" data-del-chat="${r.uid}" title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
        `).join('');
        $('#iaSavedList').html(html);
        if (window.lucide) lucide.createIcons();
    }

    // Trae una conversacion del servidor y reconstruye las burbujas en el chat.
    async loadConversation(uid) {
        try {
            const url  = this._apiChats + '?action=get&uid=' + encodeURIComponent(uid);
            const res  = await fetch(url, { cache: 'no-store' });
            const data = await res.json();
            if (!data.success || !data.chat) { this._toast(data.message || 'No se pudo abrir la conversación', 'error'); return; }

            const chat = data.chat;
            this.history = Array.isArray(chat.messages) ? chat.messages : [];
            this._currentChatUid   = chat.uid;
            this._currentChatTitle = chat.title;
            if (chat.model) { this.model = chat.model; this._saveModel(); this._applyModelUI(); }

            // Reconstruir la UID del chat desde el historial.
            this._chipsRendered = false;
            $('#iaBodyChat').empty();
            this._switchToChat();
            this.history.forEach(m => {
                if (m.role === 'user') {
                    // Mostrar solo el texto visible (sin los docs embebidos en el content).
                    let text = String(m.content || '').replace(/\n*===\s*DOCUMENTOS ADJUNTOS[\s\S]*$/i, '').trim();
                    this._appendUserMessage(text, m.imagesPreview, m.docsMeta);
                } else {
                    this._appendAIMessage(String(m.content || ''), null);
                }
            });
            this._scrollBottom();

            this._closeSavedChatsModal();
            if (!this.isOpen) this.open();
            this._toast('Conversación cargada: ' + chat.title, 'success');
        } catch (e) {
            this._toast('Error de red al abrir la conversación', 'error');
        }
    }

    async deleteSavedChat(uid) {
        if (!window.confirm('¿Eliminar esta conversación guardada? No se puede deshacer.')) return;
        try {
            const form = new FormData();
            form.append('action', 'delete');
            form.append('uid',    uid);
            const res  = await fetch(this._apiChats, { method: 'POST', body: form });
            const data = await res.json();
            if (!data.success) { this._toast(data.message || 'No se pudo eliminar', 'error'); return; }
            if (this._currentChatUid === uid) this._currentChatUid = null;
            this.openSavedChatsModal();   // refrescar lista
            this._toast('Conversación eliminada', 'success');
        } catch (e) {
            this._toast('Error de red al eliminar', 'error');
        }
    }

    // Si la respuesta trae XML de draw.io crudo SIN fence, lo envolvemos en
    // ```drawio para que _postProcessMessage lo convierta en la tarjeta del lienzo.
    _normalizeDrawioXml(text) {
        if (!text || /```[ \t]*drawio/i.test(text)) return text;
        const body = text.trim();
        if (/^<(\?xml|mxfile|mxGraphModel)[\s>]/i.test(body) && /<\/(mxfile|mxGraphModel)>\s*$/i.test(body)) {
            return '```drawio\n' + body + '\n```';
        }
        return text;
    }

    // Si la respuesta trae una escena Excalidraw cruda SIN fence, la envolvemos en
    // ```excalidraw para que _postProcessMessage la convierta en la tarjeta del lienzo.
    _normalizeExcalidrawJson(text) {
        if (!text || /```[ \t]*(excalidraw|json)/i.test(text)) return text;
        const body = text.trim();
        if (/^\{[\s\S]*"type"\s*:\s*"excalidraw[\s\S]*\}$/i.test(body)) {
            return '```excalidraw\n' + body + '\n```';
        }
        return text;
    }

    /* ── Minimal markdown → HTML ── */

    _markdownToHtml(text) {
        if (typeof marked !== 'undefined' && marked.parse) {
            return marked.parse(text);
        }
        return '<p>' + this._escape(text).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
    }

    _escape(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Sugiere un nombre de archivo a partir del primer encabezado markdown de la
    // respuesta; si no hay, usa una marca de tiempo. Siempre devuelve un .md.
    _suggestFileName(text) {
        let title = '';
        const m = (text || '').match(/^#{1,6}\s+(.+)$/m);
        if (m) title = m[1].trim();
        let slug = title.toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 50);
        if (!slug) {
            const d = new Date();
            const p = n => String(n).padStart(2, '0');
            slug = `respuesta-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
        }
        return slug + '.md';
    }
}

/* ─────────────────────────────────────────────────────────────────────────
 * GithubBoard — tablero de GitHub Projects (v2) en el panel derecho (split).
 *
 * Se abre desde el menu Herramientas de CoffeeIA ("GitHub Projects") y monta un
 * tablero estilo GitHub en #githubStage, en split con el documento (igual que el
 * lienzo draw.io/Excalidraw, via body.github-mode). Columnas = Status; filtro
 * por Sprint (Iteration). Datos: ctrl/ctrl-github.php (GraphQL, token en .env).
 * ───────────────────────────────────────────────────────────────────────── */
class GithubBoard {

    constructor(app, link) {
        this.app     = app;
        this._link   = link;          // ctrl/ctrl-github.php
        this.stageId = 'githubStage';
        this.active  = false;
        this.number  = null;
        this.data    = null;          // { project, items, statusOptions, iterations }
        this.sprintFilter = '';       // '' = todos los sprints
    }

    async open(number) {
        this.active = true;
        this._showStage(true);
        const host = document.getElementById(this.stageId);
        if (host) host.innerHTML = '<div class="ghb-state"><span class="ia-gh-spin"></span> Cargando tablero&hellip;</div>';

        try {
            // Sin number: listar y abrir el primer project accesible.
            if (!number) {
                const list = await this._fetch('list');
                if (!list || !list.ok) return this._renderError((list && list.error) || 'No se pudieron leer los Projects.');
                const projs = list.projects || [];
                if (!projs.length) {
                    const extra = list.inaccessible ? ` (${list.inaccessible} sin acceso con este token)` : '';
                    return this._renderError('No hay Projects accesibles.' + extra);
                }
                number = projs[0].number;
            }
            this.number = number;
            const data = await this._fetch('items', { number });
            if (!data || !data.ok) return this._renderError((data && data.error) || 'No se pudo cargar el tablero.');
            this.data = data;
            this.sprintFilter = '';
            this._render();
        } catch (e) {
            this._renderError('Error de red al consultar GitHub.');
        }
    }

    close() {
        this.active = false;
        const host = document.getElementById(this.stageId);
        if (host) host.innerHTML = '';
        this._showStage(false);
    }

    async _fetch(opc, extra) {
        const form = new FormData();
        form.append('opc', opc);
        if (extra) Object.keys(extra).forEach(k => form.append(k, extra[k]));
        const res = await fetch(this._link, { method: 'POST', body: form });
        return res.json();
    }

    // Split: documento a la izquierda, tablero a la derecha (como el lienzo).
    _showStage(show) {
        $('body').toggleClass('github-mode', show);
        $('#' + this.stageId).toggleClass('hidden', !show);
        $('.cs-tabs-inline, #btnEdit, #btnCopyPath, #docStyleSelect, .doc-zoom, .doc-toolbar-sep')
            .toggleClass('hidden', show);
        if (typeof visorMountStageResizer === 'function') visorMountStageResizer(show);
    }

    _render() {
        const host = document.getElementById(this.stageId);
        if (!host) return;
        const p = this.data.project || {};
        const sprints = this.data.iterations || [];

        const pills = [{ title: '', label: 'Todos' }]
            .concat(sprints.map(s => ({ title: s.title, label: s.title, active: s.active })))
            .map(s => `<button type="button" class="ghb-pill${this.sprintFilter === s.title ? ' is-active' : ''}" data-sprint="${this._esc(s.title)}">${this._esc(s.label)}${s.active ? ' <span class="ghb-live">&#9679;</span>' : ''}</button>`)
            .join('');

        host.innerHTML = `
            <div class="ghb">
                <div class="ghb-bar">
                    <div class="ghb-bar-left">
                        <i data-lucide="folder-git-2"></i>
                        <span class="ghb-title" title="${this._esc(p.title)}">${this._esc(p.title)}</span>
                        <span class="ghb-sub">${p.total || (this.data.items || []).length} items</span>
                    </div>
                    <div class="ghb-bar-right">
                        <button type="button" class="ghb-iconbtn ghb-refresh" title="Refrescar"><i data-lucide="refresh-cw"></i></button>
                        ${p.url ? `<a class="ghb-iconbtn" href="${p.url}" target="_blank" rel="noopener" title="Abrir en GitHub"><i data-lucide="external-link"></i></a>` : ''}
                        <button type="button" class="ghb-iconbtn ghb-close" title="Cerrar tablero"><i data-lucide="x"></i></button>
                    </div>
                </div>
                <div class="ghb-sprints">${pills}</div>
                <div class="ghb-cols">${this._columnsHtml()}</div>
            </div>
        `;

        $(host).find('.ghb-close').on('click', () => this.close());
        $(host).find('.ghb-refresh').on('click', () => this.open(this.number));
        $(host).find('.ghb-pill').on('click', (e) => {
            this.sprintFilter = $(e.currentTarget).attr('data-sprint') || '';
            this._render();
        });
        if (window.lucide) lucide.createIcons();
    }

    _columnsHtml() {
        const items = this._filteredItems();
        const cols  = (this.data.statusOptions || []).slice();
        // Estados presentes en items pero no en las opciones (p. ej. "Sin estado").
        items.forEach(it => { const s = it.status || 'Sin estado'; if (cols.indexOf(s) === -1) cols.push(s); });
        if (!cols.length) cols.push('Sin estado');

        return cols.map(st => {
            const list  = items.filter(it => (it.status || 'Sin estado') === st);
            const color = this._statusColor(st);
            const cards = list.length ? list.map(it => this._cardHtml(it)).join('') : '<div class="ghb-empty">Sin items</div>';
            return `
                <div class="ghb-col">
                    <div class="ghb-col-head">
                        <span class="ghb-dot" style="background:${color}"></span>
                        <span class="ghb-col-name">${this._esc(st)}</span>
                        <span class="ghb-col-count">${list.length}</span>
                    </div>
                    <div class="ghb-col-body">${cards}</div>
                </div>
            `;
        }).join('');
    }

    _cardHtml(it) {
        const typeIcon = it.type === 'PullRequest' ? 'git-pull-request'
                       : (it.type === 'Issue' ? 'circle-dot' : 'square-dashed');
        const sprintChip = it.sprint ? `<span class="ghb-chip"><i data-lucide="calendar-clock"></i>${this._esc(it.sprint)}</span>` : '';
        const sizeChip   = it.size   ? `<span class="ghb-size ghb-size-${this._esc((it.size || '').toLowerCase())}">${this._esc(it.size)}</span>` : '';
        return `
            <div class="ghb-card">
                <div class="ghb-card-title"><i data-lucide="${typeIcon}"></i><span>${this._esc(it.title)}</span></div>
                ${(sprintChip || sizeChip) ? `<div class="ghb-card-foot">${sprintChip}${sizeChip}</div>` : ''}
            </div>
        `;
    }

    _filteredItems() {
        const items = this.data.items || [];
        if (!this.sprintFilter) return items;
        return items.filter(it => (it.sprint || '') === this.sprintFilter);
    }

    _statusColor(status) {
        const s = (status || '').toLowerCase();
        if (s === 'done') return '#22c55e';
        if (s.indexOf('progress') !== -1) return '#eab308';
        if (s === 'backlog' || s === 'todo' || s === 'to do') return '#94a3b8';
        return '#64748b';
    }

    _renderError(msg) {
        const host = document.getElementById(this.stageId);
        if (host) host.innerHTML = `
            <div class="ghb-state ghb-error">
                <i data-lucide="alert-triangle"></i>
                <div>
                    <p>${this._esc(msg)}</p>
                    <button type="button" class="ghb-retry">Reintentar</button>
                    <button type="button" class="ghb-close2">Cerrar</button>
                </div>
            </div>`;
        $(host).find('.ghb-retry').on('click', () => this.open(this.number));
        $(host).find('.ghb-close2').on('click', () => this.close());
        if (window.lucide) lucide.createIcons();
    }

    _esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}
