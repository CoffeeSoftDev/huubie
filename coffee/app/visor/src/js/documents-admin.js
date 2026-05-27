const API_ENDPOINTS = {
    local: 'ctrl/ctrl-documents-admin.php',
    drive: 'ctrl/ctrl-documents-admin-drive.php',
};
const STORAGE_KEY = 'admin-docs:settings:v1';
const SOURCE_KEY  = 'admin-docs:source';
const DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/';
const DRIVE_FILE_URL   = 'https://drive.google.com/file/d/';

let source = localStorage.getItem(SOURCE_KEY) === 'drive' ? 'drive' : 'local';
let projects = [];
let currentProject = null;
let rootFolderId = null;

function apiUrl() { return API_ENDPOINTS[source]; }
function isDrive() { return source === 'drive'; }

/* ── Init ─────────────────────────────────────────────────── */

$(async () => {
    if (window.lucide) lucide.createIcons();
    loadTheme();
    paintSourceToggle();
    await loadProjects();
    bindEvents();

    // Evita que el navegador abra archivos sueltos fuera de la dropzone
    window.addEventListener('dragover', e => e.preventDefault(), false);
    window.addEventListener('drop',    e => e.preventDefault(), false);
});

/* ── Source toggle ────────────────────────────────────────── */

function paintSourceToggle() {
    $('.source-toggle button').removeClass('active');
    $(`.source-toggle button[data-source="${source}"]`).addClass('active');
}

async function setSource(newSource) {
    if (newSource === source || !API_ENDPOINTS[newSource]) return;
    source = newSource;
    localStorage.setItem(SOURCE_KEY, source);
    paintSourceToggle();
    currentProject = null;
    rootFolderId   = null;
    projects       = [];
    $('#projectList').html('');
    renderMainPanel();
    await loadProjects();
}

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
        const res = await fetch(`${apiUrl()}?action=list`, { cache: 'no-store' });
        const data = await res.json();
        if (!data.success) { toast(data.message || 'Error al cargar', 'error'); return; }
        projects     = data.projects || [];
        rootFolderId = data.rootId   || null;
        renderProjectList();
        // Restaurar proyecto seleccionado (key separada por source)
        const saved = localStorage.getItem(`admin-docs:project:${source}`);
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
    localStorage.setItem(`admin-docs:project:${source}`, name);
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
    if (proj.isVirtual) $('#btnNewType').addClass('hidden');
    else                $('#btnNewType').removeClass('hidden');

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

    const drive = isDrive();
    const html = proj.types.map(t => {
        const fileRows = t.files.map(f => {
            const viewLink = drive && f.id ? `
                <a href="${DRIVE_FILE_URL}${f.id}/view" target="_blank" rel="noopener" class="cs-btn cs-btn-ghost cs-btn-sm" title="Ver en Drive">
                    <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                </a>` : '';
            return `
                <div class="admin-file-row">
                    <span class="admin-file-info">
                        <i data-lucide="file-text" class="w-3.5 h-3.5" style="color:var(--vsr-text-mute2)"></i>
                        <span class="admin-file-text">
                            <span class="admin-file-name">${f.name}</span>
                            <span class="admin-file-meta">${f.size} · ${f.mtime}</span>
                        </span>
                    </span>
                    <span class="flex items-center gap-1">
                        ${viewLink}
                        <button class="btn-delete-file cs-btn cs-btn-ghost cs-btn-sm" data-file="${t.name}/${f.name}" data-id="${f.id || ''}" title="Eliminar">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </span>
                </div>
            `;
        }).join('');

        const typeMenu = t.isVirtual ? '' : `
            <div class="admin-type-menu">
                <button class="admin-type-menu-trigger cs-btn cs-btn-ghost cs-btn-sm" data-type="${t.name}" title="Opciones">
                    <i data-lucide="more-vertical" class="w-3.5 h-3.5"></i>
                </button>
                <div class="admin-type-menu-dropdown hidden">
                    <button class="btn-rename-type" data-type="${t.name}">
                        <i data-lucide="pencil" class="w-3 h-3"></i> Editar nombre
                    </button>
                    <button class="btn-delete-type danger" data-type="${t.name}">
                        <i data-lucide="trash-2" class="w-3 h-3"></i> Eliminar
                    </button>
                </div>
            </div>`;
        return `
            <div class="admin-type-card${t.isVirtual ? ' is-virtual' : ''}">
                <div class="admin-type-header">
                    <span class="flex items-center gap-2">
                        <i data-lucide="${t.isVirtual ? 'inbox' : 'tag'}" class="w-3.5 h-3.5" style="color:var(--vsr-accent-soft)"></i>
                        <span class="font-semibold text-sm" style="color:var(--vsr-text)">${t.name}</span>
                        <span class="badge-count">${t.files.length}</span>
                    </span>
                    ${typeMenu}
                </div>
                <div>${fileRows}</div>
                <div class="mt-2 pt-2" style="border-top:1px dashed var(--vsr-border-soft);">
                    ${drive && t.id ? `
                        <a href="${DRIVE_FOLDER_URL}${t.id}" target="_blank" rel="noopener" class="admin-folder-slot">
                            <i data-lucide="external-link"></i>
                            <span>Subir via Drive</span>
                        </a>
                    ` : `
                        <div class="admin-folder-slot" data-type="${t.name}">
                            <i data-lucide="upload-cloud"></i>
                            <span>Suelta archivos aqui o clic</span>
                            <input type="file" multiple class="hidden file-input" data-type="${t.name}">
                        </div>
                    `}
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

    // Source toggle (Local / Drive)
    $('.source-toggle').on('click', 'button[data-source]', (e) => {
        setSource($(e.currentTarget).data('source'));
    });

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
        const $btn   = $(e.currentTarget);
        const rel    = $btn.data('file');
        const fileId = $btn.data('id');
        if (!confirm(`Eliminar "${rel}"?`)) return;
        // En Drive usamos ID directo (funciona con archivos sueltos / virtuales)
        if (isDrive() && fileId) {
            await apiPost('delete', { target: 'file', id: fileId });
        } else {
            await apiPost('delete', { target: 'file', path: currentProject + '/' + rel });
        }
    });

    // Toggle dropdown del menu de tipo
    $('#typesContainer').on('click', '.admin-type-menu-trigger', function (e) {
        e.stopPropagation();
        const $dropdown = $(this).siblings('.admin-type-menu-dropdown');
        const wasHidden = $dropdown.hasClass('hidden');
        $('.admin-type-menu-dropdown').addClass('hidden');
        if (wasHidden) $dropdown.removeClass('hidden');
    });

    // Cerrar dropdown al click fuera
    $(document).on('click', (e) => {
        if (!$(e.target).closest('.admin-type-menu').length) {
            $('.admin-type-menu-dropdown').addClass('hidden');
        }
    });

    // Rename type
    $('#typesContainer').on('click', '.btn-rename-type', async (e) => {
        e.stopPropagation();
        $('.admin-type-menu-dropdown').addClass('hidden');
        const type = $(e.currentTarget).data('type');
        const newName = prompt(`Nuevo nombre para el tipo "${type}":`, type);
        if (newName === null) return;
        const trimmed = newName.trim();
        if (!trimmed || trimmed === type) return;
        await apiPost('rename', { target: 'type', project: currentProject, oldName: type, newName: trimmed });
    });

    // Delete type
    $('#typesContainer').on('click', '.btn-delete-type', async (e) => {
        e.stopPropagation();
        $('.admin-type-menu-dropdown').addClass('hidden');
        const type = $(e.currentTarget).data('type');
        const fullPath = currentProject + '/' + type;
        if (!confirm(`Eliminar el tipo "${type}" y todos sus archivos?`)) return;
        await apiPost('delete', { target: 'folder', path: fullPath });
    });

    // Drag & drop + file input
    $('#typesContainer').on('click', '.admin-folder-slot', function (e) {
        // Evita reentry cuando el click sintetico del input burbujea
        if ($(e.target).is('input')) return;
        e.preventDefault();
        this.querySelector('.file-input').click();
    });

    // Detiene la burbuja del click del input hacia el dropzone
    $('#typesContainer').on('click', '.file-input', function (e) {
        e.stopPropagation();
    });

    $('#typesContainer').on('change', '.file-input', function () {
        const type = $(this).data('type');
        const files = this.files;
        if (files.length) uploadFiles(type, files);
        // Reset para permitir resubir el mismo archivo
        this.value = '';
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
        const res = await fetch(apiUrl(), { method: 'POST', body: form });
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
        const res = await fetch(apiUrl(), { method: 'POST', body: form });
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
