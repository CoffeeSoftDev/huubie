let visor, visorView, app;

$(() => {
    visorView = new VisorView('root');
    visor     = new Visor('root');
    app       = new App('root');
    app.init();
});


class App {

    constructor(rootId) {
        this.rootId       = rootId;
        this.PROJECT_NAME = 'Visor';
        this.currentFile  = null;
    }

    init() {
        this.dataInit = {
            agents:    SAMPLE_VISOR_AGENTS.agents,
            grimoires: SAMPLE_VISOR_AGENTS.grimoires,
            header:    SAMPLE_VISOR_HEADER
        };
        this.allFiles = [...this.dataInit.agents, ...this.dataInit.grimoires];
        this.render();
        this.bind();
    }

    render() {
        visorView.renderHeader(this.dataInit.header, this.allFiles.length);
        visorView.renderFooter(this.dataInit);
        visorView.renderSidebar(this.dataInit, this.currentFile, '');
        this.loadFile('CoffeeIA.md');
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

        visorView.renderBreadcrumb(file);
        visorView.renderFrontmatter(file);
        visorView.renderContent(file);
        visorView.renderFooterSelection(file);

        if (window.lucide) lucide.createIcons();
    }
}


class Visor {

    constructor(rootId) {
        this.rootId = rootId;
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

    renderHeader(header, totalCount) {
        $('#headerTitle').text(header.title);
        $('#headerSubtitle').text(header.subtitle);
        $('#userInitials').text(header.user.initials);
        $('#userName').text(header.user.name);
        $('#userRole').text(header.user.role);
        $('#totalCountChip').text(totalCount);
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
            ${buildSection('Agentes', agentsFiltered, 'bot')}
            ${buildSection('Grimorios', grimoiresFiltered, 'book-open')}
            ${empty}
        `);
    }

    renderBreadcrumb(file) {
        $('#breadcrumbSection').text(file.section === 'agentes' ? 'agents' : 'agents/grimorios');
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
        $('#md-raw').text(file.raw);
        $('#lineCountChip').text(`~ ${visor.countLines(file.raw)} lineas`);
    }

    renderFooterSelection(file) {
        $('#footerFile').text(file.file);
        $('#footerSize').text(file.size);
    }
}
