const API = 'ctrl/ctrl-documents-admin.php';
const STORAGE_KEY = 'admin-docs:settings:v1';

let projects = [];
let currentProject = null;

/* ── Init ─────────────────────────────────────────────────── */

$(async () => {
    if (window.lucide) lucide.createIcons();
    loadTheme();
    await loadProjects();
    bindEvents();
});

/* ── Theme ────────────────────────────────────────────────── */

function loadTheme() {
    const settings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const theme = settings.theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    const icon = theme === 'dark' ? 'sun' : 'moon';
    $('#btnThemeToggle').html(`<i data-lucide="${icon}" class="w-4 h-4"></i>`);
    if (window.lucide) lucide.createIcons();
}

function toggleTheme() {
    const settings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const next = settings.theme === 'light' ? 'dark' : 'light';
    settings.theme = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    loadTheme();
}

/* ── Data ─────────────────────────────────────────────────── */

async function loadProjects() {
    try {
        const res = await fetch(`${API}?action=list`, { cache: 'no-store' });
        const data = await res.json();
        if (!data.success) { toast(data.message || 'Error al cargar', 'error'); return; }
        projects = data.projects || [];
        renderProjectList();
        // Restaurar proyecto seleccionado
        const saved = localStorage.getItem('admin-docs:project');
        if (saved) {
            const found = projects.find(p => p.name === saved);
            if (found) selectProject(found.name);
        }
        if (!currentProject && projects.length) selectProject(projects[0].name);
    } catch (e) {
        toast('Backend no disponible', 'error');
        console.error(e);
    }
}

/* ── Render ───────────────────────────────────────────────── */

function renderProjectList(filter = '') {
    const f = filter.trim().toLowerCase();
    const list = f ? projects.filter(p => p.name.toLowerCase().includes(f)) : projects;

    if (!list.length) {
        $('#projectList').html(`
            <div class="admin-empty-state">
                <i data-lucide="folder-x" class="w-8 h-8"></i>
                <p class="text-xs">Sin proyectos</p>
            </div>
        `);
        if (window.lucide) lucide.createIcons();
        return;
    }

    const html = list.map(p => `
        <div class="admin-project-item ${currentProject === p.name ? 'active' : ''}" data-project="${p.name}">
            <span class="flex items-center gap-2">
                <i data-lucide="folder" class="file-icon"></i>
                <span class="truncate">${p.name}</span>
            </span>
            <span class="badge-count">${p.totalFiles}</span>
        </div>
    `).join('');

    $('#projectList').html(html);
    if (window.lucide) lucide.createIcons();
}

function selectProject(name) {
    currentProject = name;
    localStorage.setItem('admin-docs:project', name);
    renderProjectList($('#projectSearch').val());
    renderMainPanel();
}

function renderMainPanel() {
    const proj = projects.find(p => p.name === currentProject);
    if (!proj) {
        $('#currentProjectTitle').text('Selecciona un proyecto');
        $('#projectTotalBadge').text('');
        $('#btnNewType').addClass('hidden');
        $('#typesContainer').html(`
            <div class="admin-empty-state" style="padding:80px 20px;">
                <i data-lucide="mouse-pointer-click" class="w-10 h-10"></i>
                <p class="text-sm" style="margin-top:8px;">Selecciona un proyecto desde la barra lateral.</p>
            </div>
        `);
        if (window.lucide) lucide.createIcons();
        return;
    }

    $('#currentProjectTitle').text(proj.name);
    $('#projectTotalBadge').html(`<strong>${proj.totalFiles}</strong> documentos`);
    $('#btnNewType').removeClass('hidden');

    if (!proj.types.length) {
        $('#typesContainer').html(`
            <div class="admin-empty-state">
                <i data-lucide="folder-plus" class="w-8 h-8"></i>
                <p class="text-xs">Sin tipos. Crea uno nuevo para empezar.</p>
            </div>
        `);
        if (window.lucide) lucide.createIcons();
        return;
    }

    const html = proj.types.map(t => {
        const fileRows = t.files.map(f => `
            <div class="admin-file-row">
                <span class="flex items-center gap-2">
                    <i data-lucide="file-text" class="w-3.5 h-3.5" style="color:var(--vsr-text-mute2)"></i>
                    <span style="color:var(--vsr-text-soft);font-family:'JetBrains Mono',monospace;">${f.name}</span>
                </span>
                <span class="flex items-center gap-3">
                    <span style="color:var(--vsr-text-mute2);font-size:10.5px;">${f.size} · ${f.mtime}</span>
                    <button class="btn-delete-file cs-btn cs-btn-ghost cs-btn-sm" data-file="${t.name}/${f.name}" title="Eliminar">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </span>
            </div>
        `).join('');

        return `
            <div class="admin-type-card">
                <div class="admin-type-header">
                    <span class="flex items-center gap-2">
                        <i data-lucide="tag" class="w-3.5 h-3.5" style="color:var(--vsr-accent-soft)"></i>
                        <span class="font-semibold text-sm" style="color:var(--vsr-text)">${t.name}</span>
                        <span class="badge-count">${t.files.length}</span>
                    </span>
                    <span class="flex items-center gap-2">
                        <button class="btn-delete-type cs-btn cs-btn-ghost cs-btn-sm" data-type="${t.name}" title="Eliminar tipo">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </span>
                </div>
                <div>${fileRows}</div>
                <div class="mt-2 pt-2" style="border-top:1px dashed var(--vsr-border-soft);">
                    <div class="admin-folder-slot" data-type="${t.name}">
                        <i data-lucide="upload-cloud"></i>
                        <span>Suelta .md aqui o clic</span>
                        <input type="file" accept=".md" multiple class="hidden file-input" data-type="${t.name}">
                    </div>
                </div>
            </div>
        `;
    }).join('');

    $('#typesContainer').html(html);
    if (window.lucide) lucide.createIcons();
}

/* ── Events ───────────────────────────────────────────────── */

function bindEvents() {
    // Theme
    $('#btnThemeToggle').on('click', toggleTheme);

    // Project search
    $('#projectSearch').on('input', (e) => renderProjectList(e.target.value));

    // Select project
    $('#projectList').on('click', '.admin-project-item', (e) => {
        const name = $(e.currentTarget).data('project');
        selectProject(name);
    });

    // New project modal
    $('#btnNewProject').on('click', () => {
        $('#inputNewProject').val('');
        $('#modalNewProject').removeClass('hidden');
        $('#inputNewProject').focus();
    });
    $('#btnConfirmNewProject').on('click', async () => {
        const name = $('#inputNewProject').val().trim();
        if (!name) { toast('Ingresa un nombre', 'warn'); return; }
        await apiPost('mkdir', { target: 'project', name });
        $('#modalNewProject').addClass('hidden');
    });

    // New type modal
    $('#btnNewType').on('click', () => {
        $('#inputNewType').val('');
        $('#modalNewType').removeClass('hidden');
        $('#inputNewType').focus();
    });
    $('#btnConfirmNewType').on('click', async () => {
        const name = $('#inputNewType').val().trim();
        if (!name) { toast('Ingresa un nombre', 'warn'); return; }
        if (!currentProject) { toast('Selecciona un proyecto primero', 'warn'); return; }
        await apiPost('mkdir', { target: 'type', project: currentProject, name });
        $('#modalNewType').addClass('hidden');
    });

    // Modals close
    $('[data-dismiss="modal"]').on('click', (e) => {
        $(e.currentTarget).closest('.cs-modal-backdrop').addClass('hidden');
    });
    $('.cs-modal-backdrop').on('click', (e) => {
        if (e.target === e.currentTarget) $(e.currentTarget).addClass('hidden');
    });

    // Delete file
    $('#typesContainer').on('click', '.btn-delete-file', async (e) => {
        e.stopPropagation();
        const rel = $(e.currentTarget).data('file');
        const fullPath = currentProject + '/' + rel;
        if (!confirm(`Eliminar \"${rel}\"?`)) return;
        await apiPost('delete', { target: 'file', path: fullPath });
    });

    // Delete type
    $('#typesContainer').on('click', '.btn-delete-type', async (e) => {
        e.stopPropagation();
        const type = $(e.currentTarget).data('type');
        const fullPath = currentProject + '/' + type;
        if (!confirm(`Eliminar el tipo \"${type}\" y todos sus archivos?`)) return;
        await apiPost('delete', { target: 'folder', path: fullPath });
    });

    // Drag & drop + file input
    $('#typesContainer').on('click', '.admin-folder-slot', function () {
        $(this).find('.file-input').trigger('click');
    });

    $('#typesContainer').on('change', '.file-input', function () {
        const type = $(this).data('type');
        const files = this.files;
        if (files.length) uploadFiles(type, files);
    });

    $('#typesContainer').on('dragover', '.admin-folder-slot', (e) => {
        e.preventDefault();
        e.stopPropagation();
        $(e.currentTarget).addClass('dragover');
    });

    $('#typesContainer').on('dragleave', '.admin-folder-slot', (e) => {
        e.preventDefault();
        e.stopPropagation();
        $(e.currentTarget).removeClass('dragover');
    });

    $('#typesContainer').on('drop', '.admin-folder-slot', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const $zone = $(e.currentTarget);
        $zone.removeClass('dragover');
        const type = $zone.data('type');
        const files = e.originalEvent.dataTransfer.files;
        if (files.length) uploadFiles(type, files);
    });

    // Keyboard: Enter en modales
    $('#inputNewProject').on('keydown', (e) => { if (e.key === 'Enter') $('#btnConfirmNewProject').trigger('click'); });
    $('#inputNewType').on('keydown', (e) => { if (e.key === 'Enter') $('#btnConfirmNewType').trigger('click'); });
}

/* ── API ──────────────────────────────────────────────────── */

async function apiPost(action, payload) {
    const form = new FormData();
    form.append('action', action);
    for (const k in payload) form.append(k, payload[k]);

    try {
        const res = await fetch(API, { method: 'POST', body: form });
        const data = await res.json();
        if (!data.success) {
            toast(data.message || 'Error', 'error');
            return false;
        }
        toast(data.message || 'OK', 'success');
        await loadProjects();
        if (currentProject) selectProject(currentProject);
        return true;
    } catch (e) {
        toast('Error de red', 'error');
        console.error(e);
        return false;
    }
}

async function uploadFiles(type, files) {
    const form = new FormData();
    form.append('action', 'upload');
    form.append('project', currentProject);
    form.append('type', type);
    for (const f of files) form.append('files[]', f);

    try {
        const res = await fetch(API, { method: 'POST', body: form });
        const data = await res.json();
        if (!data.success) { toast(data.message || 'Error', 'error'); return; }

        const results = data.results || [];
        const ok = results.filter(r => r.status === 'success').length;
        const err = results.filter(r => r.status === 'error').length;
        toast(`Subidos: ${ok} OK${err ? ', ' + err + ' error' : ''}`, err ? 'warn' : 'success');

        await loadProjects();
        if (currentProject) selectProject(currentProject);
    } catch (e) {
        toast('Error al subir', 'error');
        console.error(e);
    }
}

/* ── Toast ────────────────────────────────────────────────── */

function toast(msg, tone = 'success') {
    const $t = $('#adminToast');
    if (!$t.length) return;
    $t.text(msg).attr('data-tone', tone).addClass('visible');
    clearTimeout(window._adminToastTimer);
    window._adminToastTimer = setTimeout(() => $t.removeClass('visible'), 2400);
}
