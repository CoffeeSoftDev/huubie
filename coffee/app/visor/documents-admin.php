<?php require_once __DIR__ . '/../ctrl/auth-guard.php'; ?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Docs — Visor</title>
    <link rel="icon" type="image/x-icon" href="favicon.ico">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="src/css/ui-kit.css">
    <link rel="stylesheet" href="src/css/visor.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/documents-admin.css?t=<?php echo time(); ?>">
</head>
<body class="visor-body" data-theme="dark">

    <!-- Header -->
    <header class="visor-header">
        <div class="vsr-header-left">
            <div class="visor-logo">AD</div>
            <div class="flex flex-col">
                <span id="headerTitle">Admin Docs</span>
                <span id="headerSubtitle">Gestor de Documentos</span>
            </div>
        </div>
        <div class="vsr-header-right">
            <div class="source-toggle">
                <button data-source="local" title="Archivos locales">
                    <i data-lucide="hard-drive" class="w-3.5 h-3.5"></i>
                    <span>Local</span>
                </button>
                <button data-source="drive" title="Google Drive">
                    <i data-lucide="cloud" class="w-3.5 h-3.5"></i>
                    <span>Drive</span>
                </button>
            </div>
            <button id="btnThemeToggle" class="theme-toggle">
                <i data-lucide="sun" class="w-4 h-4"></i>
            </button>
        </div>
    </header>

    <div class="visor-body-row">

        <!-- Rail de navegacion entre modulos (Visor / Playground / Admin) -->
        <nav class="app-rail" aria-label="Modulos">
            <div class="app-rail-nav">
                <a href="index.php" class="app-rail-item" title="Visor de Agentes">
                    <i data-lucide="layout-dashboard"></i>
                    <span class="app-rail-label">Visor</span>
                </a>
                <a href="playground.php" class="app-rail-item" title="Playground de Agentes">
                    <i data-lucide="flask-conical"></i>
                    <span class="app-rail-label">Lab</span>
                </a>
                <a href="studio.php" class="app-rail-item" title="Coffee Studio - Templates multi-archivo">
                    <i data-lucide="clapperboard"></i>
                    <span class="app-rail-label">Studio</span>
                </a>
<a href="forge.php" class="app-rail-item" title="Forge — Fábrica de Módulos">
                    <i data-lucide="hammer"></i>
                    <span class="app-rail-label">Forge</span>
                </a>
                <a href="chat.php" class="app-rail-item" title="Chat con Agentes">
                    <i data-lucide="message-circle"></i>
                    <span class="app-rail-label">Chat</span>
                </a>
                <a href="coffeeia.php" class="app-rail-item" title="CoffeeIA — Chat unificado">
                    <i data-lucide="sparkles"></i>
                    <span class="app-rail-label">CoffeeIA</span>
                </a>
                <a href="documents-admin.php" class="app-rail-item active" title="Admin de Documentos">
                    <i data-lucide="folder-cog"></i>
                    <span class="app-rail-label">Admin</span>
                </a>
            </div>

            <button id="accountBtn" class="app-rail-account" type="button" title="Cuenta y configuración">
                <span class="account-avatar">CD</span>
            </button>
        </nav>

        <!-- Sidebar -->
        <aside class="visor-sidebar">
            <div class="sidebar-search-wrap">
                <div class="cs-input-group">
                    <span class="cs-input-group-icon"><i data-lucide="search" class="w-4 h-4"></i></span>
                    <input id="projectSearch" type="text" class="cs-input pl-9" placeholder="Buscar proyecto...">
                </div>
            </div>
            <div id="projectList" class="sidebar-list" style="padding: 8px 0;">
                <!-- Proyectos renderizados via JS -->
            </div>
            <div class="sidebar-footer">
                <button id="btnNewProject" class="cs-btn cs-btn-primary cs-btn-sm w-full flex items-center justify-center gap-1.5">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                    Nuevo Proyecto
                </button>
            </div>
        </aside>

        <!-- Main -->
        <main class="admin-main">
            <div id="mainHeader" class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2.5">
                    <i data-lucide="folder-tree" class="w-5 h-5" style="color:var(--vsr-accent-soft)"></i>
                    <h1 id="currentProjectTitle" class="text-sm font-bold" style="color:var(--vsr-text)">Selecciona un proyecto</h1>
                </div>
                <div class="flex items-center gap-3">
                    <span id="projectTotalBadge" class="vsr-chip"></span>
                    <button id="btnNewType" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5 hidden">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                        Nuevo Tipo
                    </button>
                </div>
            </div>

            <div id="typesContainer" class="flex-1 overflow-y-auto cs-scroll" style="min-height:0;">
                <!-- Tipos y archivos renderizados via JS -->
            </div>
        </main>
    </div>

    <!-- Modal: Nuevo Proyecto -->
    <div id="modalNewProject" class="cs-modal-backdrop hidden">
        <div class="cs-modal" style="max-width:420px;">
            <div class="cs-modal-header">
                <span class="font-semibold">Nuevo Proyecto</span>
                <button class="cs-modal-close" data-dismiss="modal"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
            <div class="cs-modal-body">
                <label class="block text-xs font-semibold mb-1.5" style="color:var(--vsr-text-muted)">Nombre del proyecto</label>
                <input id="inputNewProject" type="text" class="cs-input w-full" placeholder="ej. pedidos, huubie-core...">
                <p class="text-xs mt-2" style="color:var(--vsr-text-mute2)">Se creara la carpeta en documents/</p>
            </div>
            <div class="cs-modal-footer">
                <button class="cs-btn cs-btn-outline" data-dismiss="modal">Cancelar</button>
                <button id="btnConfirmNewProject" class="cs-btn cs-btn-primary">Crear</button>
            </div>
        </div>
    </div>

    <!-- Modal: Nuevo Tipo -->
    <div id="modalNewType" class="cs-modal-backdrop hidden">
        <div class="cs-modal" style="max-width:420px;">
            <div class="cs-modal-header">
                <span class="font-semibold">Nuevo Tipo</span>
                <button class="cs-modal-close" data-dismiss="modal"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
            <div class="cs-modal-body">
                <label class="block text-xs font-semibold mb-1.5" style="color:var(--vsr-text-muted)">Nombre del tipo</label>
                <input id="inputNewType" type="text" class="cs-input w-full" placeholder="ej. plan, database, actualizacion...">
                <p class="text-xs mt-2" style="color:var(--vsr-text-mute2)">Se creara la subcarpeta dentro del proyecto seleccionado.</p>
            </div>
            <div class="cs-modal-footer">
                <button class="cs-btn cs-btn-outline" data-dismiss="modal">Cancelar</button>
                <button id="btnConfirmNewType" class="cs-btn cs-btn-primary">Crear</button>
            </div>
        </div>
    </div>

    <!-- Modal: Nuevo MD -->
    <div id="modalNewMd" class="cs-modal-backdrop hidden">
        <div class="cs-modal" style="max-width:460px;">
            <div class="cs-modal-header">
                <span class="font-semibold">Nuevo documento .md</span>
                <button class="cs-modal-close" data-dismiss="modal"><i data-lucide="x" class="w-4 h-4"></i></button>
            </div>
            <div class="cs-modal-body">
                <label class="block text-xs font-semibold mb-1.5" style="color:var(--vsr-text-muted)">Nombre del archivo</label>
                <input id="inputNewMd" type="text" class="cs-input w-full" placeholder="ej. propuesta-bd, analisis-flujos...">
                <p class="text-xs mt-2" style="color:var(--vsr-text-mute2)">
                    Se agregara <code>.md</code> automaticamente · Tipo:
                    <span id="newMdTypeName" style="color:var(--vsr-accent-soft);font-family:'JetBrains Mono',monospace;"></span>
                </p>
            </div>
            <div class="cs-modal-footer">
                <button class="cs-btn cs-btn-outline" data-dismiss="modal">Cancelar</button>
                <button id="btnConfirmNewMd" class="cs-btn cs-btn-primary">Crear</button>
            </div>
        </div>
    </div>

    <!-- Toast -->
    <div id="adminToast" class="visor-toast"></div>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="src/js/prefs-store.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/model-config.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/documents-admin.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/account-menu.js?t=<?php echo time(); ?>"></script>
</body>
</html>
