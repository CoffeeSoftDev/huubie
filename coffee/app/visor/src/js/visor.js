let api = 'ctrl/ctrl-visor.php';
let visor, visorView, app;

const VISOR_STORAGE_KEY = 'visor:settings:v1';
const EDITABLE_EXTS = [
    'md','markdown','txt','json','yml','yaml','toml','xml','csv','tsv',
    'html','htm','css','scss','js','ts','php','py','rb','go','rs',
    'java','c','cpp','cs','sh','sql','ini','conf','log','env'
];

$(async () => {
    visorView = new VisorView('root');
    visor     = new Visor(api, 'root');
    app       = new App(api, 'root');
    await app.init();
});


class App {

    constructor(link, rootId) {
        this._link        = link;
        this.rootId       = rootId;
        this.PROJECT_NAME = 'Visor';
        this.currentFile  = null;
        this.isEditing    = false;
        this.settings     = this.loadSettings();
    }

    isDriveFolder(folder) {
        return typeof folder === 'string' && (folder === 'drive' || folder.startsWith('drive:'));
    }

    loadSettings() {
        const validStyles = ['sepia', 'github', 'notion'];
        const fallback = { folder: 'agents', customPath: '', theme: 'dark', docStyle: 'sepia', docZoom: 1 };
        try {
            const raw = localStorage.getItem(VISOR_STORAGE_KEY);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            const zoom = Number(parsed.docZoom);
            // Drive es volatil (depende del SA) — nunca lo restauramos desde localStorage
            const folder = (parsed.folder && !this.isDriveFolder(parsed.folder)) ? parsed.folder : 'agents';
            return {
                folder,
                customPath: parsed.customPath || '',
                theme:      parsed.theme === 'light' ? 'light' : 'dark',
                docStyle:   validStyles.includes(parsed.docStyle) ? parsed.docStyle : 'sepia',
                docZoom:    (isFinite(zoom) && zoom >= 0.7 && zoom <= 1.8) ? zoom : 1
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
    }

    render(initialFile) {
        visorView.renderHeader(this.dataInit.header, this.allFiles.length);
        visorView.renderFooter(this.dataInit);
        visorView.renderSidebar(this.dataInit, this.currentFile, '');
        visorView.renderFolderPicker(this.dataInit.header, this.settings);
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
        $('#btnEdit').off('click').on('click', () => this.enterEditMode());
        $('#btnSave').off('click').on('click', () => this.saveFile());
        $('#btnCancel').off('click').on('click', () => this.exitEditMode(false));

        // Ctrl+S dentro del textarea de edicion
        $('#md-edit').off('keydown.save').on('keydown.save', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                this.saveFile();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.exitEditMode(false);
            }
        });
    }

    canEdit(file) {
        if (!file)            return false;
        if (file.lazyDrive)   return false;  // Drive aun no soportado en write
        if (!file.fullPath)   return false;  // modo SAMPLE
        const parts = (file.file || '').split('.');
        if (parts.length < 2) return false;
        const ext = parts.pop().toLowerCase();
        return EDITABLE_EXTS.includes(ext);
    }

    updateEditButton() {
        const file = visor.getFile(this.allFiles, this.currentFile);
        const can  = this.canEdit(file);
        $('#btnEdit').prop('disabled', !can)
                     .attr('title', can ? 'Editar en el visor' : 'Archivo no editable en el visor');
    }

    enterEditMode() {
        const file = visor.getFile(this.allFiles, this.currentFile);
        if (!this.canEdit(file)) { visorView.toast('Archivo no editable', 'warn'); return; }

        this.isEditing = true;
        $('#md-edit').val(file.raw);
        $('#md-rendered').addClass('hidden');
        $('#md-raw').addClass('hidden');
        $('#md-edit').removeClass('hidden').focus();

        $('#btnEdit, #btnOpenEditor, #btnCopyPath').addClass('hidden');
        $('#btnSave, #btnCancel').removeClass('hidden');
        $('.cs-tab').prop('disabled', true).css('opacity', 0.5);

        if (window.lucide) lucide.createIcons();
    }

    exitEditMode(saved) {
        this.isEditing = false;
        $('#md-edit').addClass('hidden').val('');
        $('#md-rendered').removeClass('hidden');
        $('#md-raw').addClass('hidden');

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
        this.updateEditButton();
        if (window.lucide) lucide.createIcons();
    }

    async saveFile() {
        const file = visor.getFile(this.allFiles, this.currentFile);
        if (!this.canEdit(file)) { visorView.toast('Archivo no editable', 'warn'); return; }

        const content = $('#md-edit').val();
        const $btn    = $('#btnSave');
        $btn.prop('disabled', true).find('i').attr('data-lucide', 'loader-2').addClass('visor-spin');
        if (window.lucide) lucide.createIcons();

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
                $btn.prop('disabled', false).find('i').attr('data-lucide', 'save').removeClass('visor-spin');
                if (window.lucide) lucide.createIcons();
                return;
            }

            // Actualizar estado en memoria
            file.raw         = content;
            file.frontmatter = visor.parseFrontmatter(content);
            if (data.size)  file.size  = data.size;
            if (data.mtime) file.mtime = data.mtime;

            // Refrescar UI
            visorView.renderContent(file);
            visorView.renderFrontmatter(file);
            visorView.renderFooterSelection(file);
            visorView.renderSidebar(this.dataInit, this.currentFile, $('#sidebarSearch').val() || '');
            this.bindSidebarClicks();

            visorView.toast('Guardado: ' + (data.size || ''), 'success');
            this.exitEditMode(true);
        } catch (e) {
            visorView.toast('Error de red al guardar', 'error');
            $btn.prop('disabled', false).find('i').attr('data-lucide', 'save').removeClass('visor-spin');
            if (window.lucide) lucide.createIcons();
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
        const data = await visor.fetchLibrary(this.settings.folder, this.settings.customPath);
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
        const target = this.allFiles[0]?.file;

        visorView.renderHeader(this.dataInit.header, this.allFiles.length);
        visorView.renderFooter(this.dataInit);
        visorView.renderSidebar(this.dataInit, this.currentFile, '');
        visorView.renderFolderPicker(this.dataInit.header, this.settings);
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

    bindSidebarClicks() {
        $('#sidebarList .sidebar-item').off('click').on('click', (e) => {
            const fileName = $(e.currentTarget).data('file');
            this.loadFile(fileName);
        });
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
            try {
                const url = `${api}?action=driveread&id=${encodeURIComponent(file.driveId)}&mime=${encodeURIComponent(file.mimeType || '')}`;
                const res = await fetch(url, { cache: 'no-store' });
                file.raw = await res.text();
                // Re-parse frontmatter ahora que tenemos el contenido
                file.frontmatter = visor.parseFrontmatter(file.raw);
                file._loaded = true;
            } catch (e) {
                file.raw = `> Error al leer desde Drive: ${e.message || e}`;
            }
        }

        visorView.renderBreadcrumb(file, this.dataInit.header);
        visorView.renderFrontmatter(file);
        visorView.renderContent(file);
        visorView.renderFooterSelection(file);
        this.updateEditButton();

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

    countLines(raw) {
        return raw.split('\n').length;
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

    applyTheme(theme) {
        const t = theme === 'light' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', t);
        document.body.setAttribute('data-theme', t);
        const iconName = t === 'dark' ? 'sun' : 'moon';
        $('#btnThemeToggle').html(`<i data-lucide="${iconName}" class="w-4 h-4"></i>`);
        if (window.lucide) lucide.createIcons();
    }

    applyDocStyle(style) {
        const valid = ['sepia', 'github', 'notion'].includes(style) ? style : 'sepia';
        $('#md-rendered').attr('data-style', valid);
        const hljsTheme = document.getElementById('hljsTheme');
        if (hljsTheme) {
            hljsTheme.href = valid === 'sepia'
                ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css'
                : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
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
            return this.renderSidebarTree(data.documents, currentFile, filter);
        }

        const agentsFiltered     = visor.filterFiles(data.agents, filter);
        const grimoiresFiltered  = visor.filterFiles(data.grimoires, filter);
        const mainLabel          = data.header.currentLabel || 'Archivos';
        const subLabel           = data.header.sectionLabel;

        const buildSection = (title, items, icon) => {
            if (!items.length) return '';
            const rows = items.map(item => {
                const fmt = visor.fileFormat(item);
                return `
                <div class="sidebar-item ${currentFile === item.file ? 'active' : ''}" data-file="${item.file}">
                    <i data-lucide="${fmt.icon}" class="file-icon ${fmt.cls}"></i>
                    <span class="file-name">${item.file}</span>
                    ${item.isBackup ? '<span class="badge-backup">backup</span>' : ''}
                    <span class="file-size">${item.size}</span>
                </div>
            `;
            }).join('');
            return `
                <div class="section-header">
                    <span class="flex items-center gap-1.5">
                        <i data-lucide="${icon}" class="w-3 h-3 text-gray-500"></i>
                        ${title}
                    </span>
                    <span class="badge-count">${items.length}</span>
                </div>
                <div>${rows}</div>
            `;
        };

        const empty = (!agentsFiltered.length && !grimoiresFiltered.length) ? `
            <div class="empty-state">
                <i data-lucide="search-x" class="w-8 h-8"></i>
                <p class="text-xs">Sin resultados</p>
            </div>
        ` : '';

        $('#sidebarList').html(`
            ${buildSection(mainLabel, agentsFiltered, 'bot')}
            ${subLabel ? buildSection(subLabel, grimoiresFiltered, 'book-open') : ''}
            ${empty}
        `);
    }

    renderSidebarTree(documents, currentFile, filter) {
        const f = (filter || '').trim().toLowerCase();
        let collapsed = [];
        try {
            collapsed = JSON.parse(localStorage.getItem('visor:tree:collapsed') || '[]');
        } catch (e) { collapsed = []; }

        const filterMatch = (item) => {
            if (!f) return true;
            const hay = `${item.name} ${item.frontmatter?.description || ''} ${item.project || ''} ${item.type || ''}`.toLowerCase();
            return hay.includes(f);
        };

        let hasAny = false;
        let html = '';

        for (const proj of Object.keys(documents).sort((a, b) => a.localeCompare(b))) {
            const types = documents[proj];
            let projTotal = 0;
            let projHtml = '';

            for (const tipo of Object.keys(types).sort((a, b) => {
                if (a === '(sin clasificar)') return 1;
                if (b === '(sin clasificar)') return -1;
                return a.localeCompare(b);
            })) {
                const items = types[tipo];
                const matched = f ? items.filter(filterMatch) : items;
                if (!matched.length) continue;
                projTotal += matched.length;

                const typeRows = matched.map(item => {
                    const fmt = visor.fileFormat(item);
                    return `
                    <div class="sidebar-item ${currentFile === item.file ? 'active' : ''}" data-file="${item.file}">
                        <i data-lucide="${fmt.icon}" class="file-icon ${fmt.cls}"></i>
                        <span class="file-name">${item.file}</span>
                        ${item.isBackup ? '<span class="badge-backup">backup</span>' : ''}
                        <span class="file-size">${item.size}</span>
                    </div>
                `;
                }).join('');

                projHtml += `
                    <div class="tree-type-header">
                        <span class="flex items-center gap-1.5">
                            <i data-lucide="tag" class="w-3 h-3 text-gray-500"></i>
                            ${tipo}
                        </span>
                        <span class="badge-count">${matched.length}</span>
                    </div>
                    <div class="tree-files-wrap">${typeRows}</div>
                `;
            }

            if (!projTotal) continue;
            hasAny = true;
            const isCollapsed = collapsed.includes(proj);

            html += `
                <div class="tree-project-header ${isCollapsed ? 'collapsed' : ''}" data-project="${proj}">
                    <span class="flex items-center gap-1.5">
                        <i data-lucide="folder-tree" class="w-3.5 h-3.5 text-gray-500"></i>
                        <span class="font-semibold">${proj}</span>
                    </span>
                    <span class="flex items-center gap-1.5">
                        <span class="badge-count">${projTotal}</span>
                        <i data-lucide="chevron-right" class="tree-chevron"></i>
                    </span>
                </div>
                <div class="tree-project-body ${isCollapsed ? 'collapsed' : ''}">${projHtml}</div>
            `;
        }

        const empty = !hasAny ? `
            <div class="empty-state">
                <i data-lucide="search-x" class="w-8 h-8"></i>
                <p class="text-xs">Sin resultados</p>
            </div>
        ` : '';

        $('#sidebarList').html(html + empty);

        // Bind collapse toggle
        $('#sidebarList .tree-project-header').off('click').on('click', (e) => {
            const $header = $(e.currentTarget);
            const proj = $header.data('project');
            $header.toggleClass('collapsed');
            $header.next('.tree-project-body').toggleClass('collapsed');
            let collapsedState = [];
            try {
                collapsedState = JSON.parse(localStorage.getItem('visor:tree:collapsed') || '[]');
            } catch (e) { collapsedState = []; }
            if ($header.hasClass('collapsed')) {
                if (!collapsedState.includes(proj)) collapsedState.push(proj);
            } else {
                collapsedState = collapsedState.filter(p => p !== proj);
            }
            localStorage.setItem('visor:tree:collapsed', JSON.stringify(collapsedState));
            if (window.lucide) lucide.createIcons();
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

        const fm = file.frontmatter || {};
        const chips = [];
        if (fm.type) chips.push(`<span class="cs-badge badge-info">${fm.type}</span>`);
        if (fm.project) chips.push(`<span class="cs-badge" style="background:rgba(124,58,237,.18);color:#C4B5FD;border:1px solid rgba(124,58,237,.35)">${fm.project}</span>`);
        $('#fmChipsWrap').html(chips.join(' '));

        $('#frontmatterBody').html(`
            <div class="fm-row">
                <span class="fm-key">name</span>
                <span class="fm-val">${fm.name || '—'}</span>
            </div>
            <div class="fm-row">
                <span class="fm-key">description</span>
                <span class="fm-val">${fm.description || '—'}</span>
            </div>
            <div class="fm-row">
                <span class="fm-key">model</span>
                <span class="fm-val model">${fm.model || '—'}</span>
            </div>
            ${fm.status ? `<div class="fm-row"><span class="fm-key">status</span><span class="fm-val">${fm.status}</span></div>` : ''}
            ${fm.date ? `<div class="fm-row"><span class="fm-key">date</span><span class="fm-val">${fm.date}</span></div>` : ''}
        `);
    }

    renderContent(file) {
        const body = visor.stripFrontmatter(file.raw);
        const rendered = (typeof marked !== 'undefined' && marked.parse)
            ? marked.parse(body)
            : `<pre style="white-space:pre-wrap;">${body.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre>`;
        $('#md-rendered').html(rendered);

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

        $('#tocBody').html(this.buildTocHtml(tocItems));

        if (typeof hljs !== 'undefined') {
            $('#md-rendered pre code').each(function (i, block) {
                hljs.highlightElement(block);
            });
        }

        $('#md-raw').text(file.raw);
        $('#lineCountChip').text(`~ ${visor.countLines(file.raw)} lineas`);

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
}
