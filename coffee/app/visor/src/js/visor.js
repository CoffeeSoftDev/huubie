let api = 'ctrl/ctrl-visor.php';
let visor, visorView, app;

const VISOR_STORAGE_KEY = 'visor:settings:v1';

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
        this.settings     = this.loadSettings();
    }

    loadSettings() {
        const validStyles = ['sepia', 'github', 'notion'];
        const fallback = { folder: 'agents', customPath: '', theme: 'dark', docStyle: 'sepia', docZoom: 1 };
        try {
            const raw = localStorage.getItem(VISOR_STORAGE_KEY);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            const zoom = Number(parsed.docZoom);
            return {
                folder:     parsed.folder     || 'agents',
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
        try { localStorage.setItem(VISOR_STORAGE_KEY, JSON.stringify(this.settings)); }
        catch (e) { /* quota / private mode — ignorar */ }
    }

    async init() {
        visorView.applyTheme(this.settings.theme);
        visorView.applyDocStyle(this.settings.docStyle);
        visorView.applyDocZoom(this.settings.docZoom);

        const data = await visor.fetchLibrary(this.settings.folder, this.settings.customPath);
        if (data) {
            this.dataInit = {
                agents:    data.agents,
                grimoires: data.grimoires,
                header:    data.header
            };
        } else {
            this.dataInit = {
                agents:    SAMPLE_VISOR_AGENTS.agents,
                grimoires: SAMPLE_VISOR_AGENTS.grimoires,
                header:    SAMPLE_VISOR_HEADER
            };
        }
        this.allFiles = [...this.dataInit.agents, ...this.dataInit.grimoires];
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
    }

    bindFolderPicker() {
        $('#folderSelect').off('change').on('change', (e) => {
            const val = e.target.value;
            if (val === 'custom') {
                $('#folderCustomPath').removeClass('hidden').val(this.settings.customPath || '').focus();
                $('#btnFolderApply').removeClass('hidden');
                if (window.lucide) lucide.createIcons();
            } else {
                $('#folderCustomPath').addClass('hidden');
                $('#btnFolderApply').addClass('hidden');
                this.settings.folder = val;
                this.settings.customPath = '';
                this.saveSettings();
                this.reloadLibrary();
            }
        });

        $('#btnFolderApply').off('click').on('click', () => this.applyCustomPath());
        $('#folderCustomPath').off('keydown').on('keydown', (e) => {
            if (e.key === 'Enter') this.applyCustomPath();
            if (e.key === 'Escape') {
                $('#folderCustomPath').addClass('hidden');
                $('#btnFolderApply').addClass('hidden');
                $('#folderSelect').val(this.settings.folder);
            }
        });
    }

    applyCustomPath() {
        const path = $('#folderCustomPath').val().trim();
        if (!path) { visorView.toast('Ingresa una ruta absoluta', 'warn'); return; }
        this.settings.folder = 'custom';
        this.settings.customPath = path;
        this.saveSettings();
        this.reloadLibrary();
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
        $('#tocBody').off('click').on('click', 'li[data-toc-target]', function () {
            const target = $(this).data('toc-target');
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
        this.dataInit = { agents: data.agents, grimoires: data.grimoires, header: data.header };
        this.allFiles = [...data.agents, ...data.grimoires];
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
            this.dataInit = { agents: data.agents, grimoires: data.grimoires, header: data.header };
            this.allFiles = [...data.agents, ...data.grimoires];
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

    loadFile(fileName) {
        const file = visor.getFile(this.allFiles, fileName);
        if (!file) return;
        this.currentFile = fileName;

        $('#sidebarList .sidebar-item').each(function () {
            $(this).toggleClass('active', $(this).data('file') === fileName);
        });

        visorView.renderBreadcrumb(file, this.dataInit.header);
        visorView.renderFrontmatter(file);
        visorView.renderContent(file);
        visorView.renderFooterSelection(file);

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
            if (!data || !Array.isArray(data.agents) || !Array.isArray(data.grimoires)) {
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
            $('#btnFolderApply').removeClass('hidden');
        } else {
            $sel.val(settings.folder);
            $('#folderCustomPath').addClass('hidden');
            $('#btnFolderApply').addClass('hidden');
        }
    }

    renderFooter(data) {
        const total = data.agents.length + data.grimoires.length;
        $('#footerTotal').text(total);
        $('#footerAgentsCount').text(data.agents.length);
        $('#footerGrimoiresCount').text(data.grimoires.length);
        $('#footerPath').text(data.header.pathLabel);
        $('#footerSource').text(data.header.source);
    }

    renderSidebar(data, currentFile, filter) {
        const agentsFiltered     = visor.filterFiles(data.agents, filter);
        const grimoiresFiltered  = visor.filterFiles(data.grimoires, filter);
        const mainLabel          = data.header.currentLabel || 'Archivos';
        const subLabel           = data.header.sectionLabel;

        const buildSection = (title, items, icon) => {
            if (!items.length) return '';
            const rows = items.map(item => `
                <div class="sidebar-item ${currentFile === item.file ? 'active' : ''}" data-file="${item.file}">
                    <i data-lucide="${item.isBackup ? 'archive' : 'file-text'}" class="file-icon"></i>
                    <span class="file-name">${item.name}.md</span>
                    ${item.isBackup ? '<span class="badge-backup">backup</span>' : ''}
                    <span class="file-size">${item.size}</span>
                </div>
            `).join('');
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

    renderBreadcrumb(file, header) {
        const root = header?.currentLabel || (file.section === 'agentes' ? 'agents' : 'agents/grimorios');
        const path = file.section === 'grimorios' && header?.sectionLabel
            ? `${root} / ${header.sectionLabel.toLowerCase()}`
            : root;
        $('#breadcrumbSection').text(path);
        $('#breadcrumbFile').text(file.file);
    }

    renderFrontmatter(file) {
        const $badge = $('#fmFileBadge');
        if (file.isBackup) {
            $badge.text('backup').attr('class', 'cs-badge badge-secondary');
        } else if (file.section === 'agentes') {
            $badge.text('agente').attr('class', 'cs-badge badge-primary');
        } else {
            $badge.text('grimorio').attr('class', 'cs-badge badge-success');
        }

        $('#fmSizeBadge').text(file.size);

        const fm = file.frontmatter || {};
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
        `);
    }

    renderContent(file) {
        const body = visor.stripFrontmatter(file.raw);
        const rendered = (typeof marked !== 'undefined' && marked.parse)
            ? marked.parse(body)
            : `<pre style="white-space:pre-wrap;">${body.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre>`;
        $('#md-rendered').html(rendered);

        let tocHtml = '<ul>';
        let hasAny = false;
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

            const level = this.tagName === 'H2' ? 2 : 3;
            const cls = level === 2 ? 'toc-h2' : 'toc-h3';
            tocHtml += `<li class="${cls}" data-toc-target="${finalSlug}">${text}</li>`;
            hasAny = true;
        });

        tocHtml += '</ul>';
        $('#tocBody').html(hasAny ? tocHtml : '<span class="toc-empty">Sin secciones</span>');

        if (typeof hljs !== 'undefined') {
            $('#md-rendered pre code').each(function (i, block) {
                hljs.highlightElement(block);
            });
        }

        $('#md-raw').text(file.raw);
        $('#lineCountChip').text(`~ ${visor.countLines(file.raw)} lineas`);
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
