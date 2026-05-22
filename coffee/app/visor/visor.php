<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Visor de Agentes — CoffeeSoft</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/app/ui/css/ui-kit.css">
    <link rel="stylesheet" href="/coffee/app/visor/src/css/visor.css?t=<?php echo time(); ?>">

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
</head>

<body class="visor-body">

    <header class="visor-header">
        <div class="flex items-center gap-3">
            <div class="visor-logo">VS</div>
            <div class="flex flex-col leading-tight">
                <span id="headerTitle" class="text-[13px] font-bold text-white">Visor de Agentes</span>
                <span id="headerSubtitle" class="text-[9.5px] text-gray-500 tracking-wider uppercase">CoffeeSoft Library</span>
            </div>
            <div class="hidden md:flex items-center gap-1 ml-6">
                <span class="text-[10px] text-gray-500 px-2.5 py-1 rounded bg-[#1F2A37] border border-gray-700/40">
                    <span id="totalCountChip">0</span> archivos
                </span>
            </div>
        </div>

        <div class="flex items-center gap-3">
            <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/>
                </svg>
                <input id="globalSearch" type="text" placeholder="Buscar en todos los archivos..." class="global-search-input">
            </div>

            <button class="cs-btn cs-btn-outline cs-btn-sm flex items-center gap-1.5" title="Refrescar">
                <i data-lucide="refresh-cw" class="w-3 h-3"></i>
                Refrescar
            </button>

            <div class="flex items-center gap-2 pl-3 border-l border-gray-700/60">
                <div id="userInitials" class="user-avatar">RV</div>
                <div class="flex flex-col leading-tight">
                    <span id="userName" class="text-[11px] font-semibold text-white">Rosy V.</span>
                    <span id="userRole" class="text-[9px] text-gray-500">Guardiana</span>
                </div>
            </div>
        </div>
    </header>

    <div class="visor-body-row">

        <aside class="visor-sidebar">
            <div class="sidebar-search-wrap">
                <div class="cs-input-group">
                    <span class="cs-input-group-icon">
                        <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/>
                        </svg>
                    </span>
                    <input id="sidebarSearch" type="text" placeholder="Filtrar archivos..." class="cs-input pl-9 w-full">
                </div>
            </div>

            <div id="sidebarList" class="sidebar-list"></div>

            <div class="sidebar-footer">
                <span id="footerSource" class="text-[9.5px] text-gray-500 uppercase tracking-wider">Local</span>
                <span id="footerPath" class="text-[10px] text-gray-400 font-mono">.claude/agents</span>
            </div>
        </aside>

        <main id="root" class="visor-main">

            <div class="main-breadcrumb">
                <nav class="breadcrumb">
                    <i data-lucide="folder" class="w-3.5 h-3.5"></i>
                    <span id="breadcrumbSection">agents</span>
                    <span class="sep">/</span>
                    <span id="breadcrumbFile" class="current">—</span>
                </nav>
                <div class="flex items-center gap-2">
                    <button class="cs-btn cs-btn-outline cs-btn-sm flex items-center gap-1.5">
                        <i data-lucide="copy" class="w-3 h-3"></i>
                        Copiar ruta
                    </button>
                    <button class="cs-btn cs-btn-outline cs-btn-sm flex items-center gap-1.5">
                        <i data-lucide="external-link" class="w-3 h-3"></i>
                        Abrir en editor
                    </button>
                </div>
            </div>

            <div class="main-content">

                <div id="frontmatterCard" class="frontmatter-card">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2.5">
                            <i data-lucide="file-code-2" class="w-4 h-4 text-purple-400"></i>
                            <h2 class="text-[13px] font-bold text-white">Frontmatter</h2>
                            <span id="fmFileBadge" class="cs-badge badge-primary">agente</span>
                        </div>
                        <span id="fmSizeBadge" class="text-[10px] text-gray-500 font-mono">—</span>
                    </div>
                    <div id="frontmatterBody"></div>
                </div>

                <div class="flex items-center justify-between mb-3">
                    <div class="cs-tabs">
                        <button class="cs-tab active" data-tab="rendered">
                            <i data-lucide="eye" class="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5"></i>
                            Renderizado
                        </button>
                        <button class="cs-tab" data-tab="raw">
                            <i data-lucide="code-2" class="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5"></i>
                            Raw
                        </button>
                    </div>
                    <span id="lineCountChip" class="text-[10px] text-gray-500 font-mono">~ 0 lineas</span>
                </div>

                <article id="md-rendered" class="md-rendered"></article>
                <pre id="md-raw" class="md-raw hidden"></pre>

            </div>
        </main>
    </div>

    <footer class="visor-footer">
        <div class="flex items-center gap-4">
            <span class="flex items-center gap-1.5">
                <i data-lucide="files" class="w-3 h-3"></i>
                Total: <span id="footerTotal" class="text-gray-300 font-semibold">0</span> archivos
            </span>
            <span class="flex items-center gap-1.5">
                <i data-lucide="bot" class="w-3 h-3"></i>
                Agentes: <span id="footerAgentsCount" class="text-gray-300 font-semibold">0</span>
            </span>
            <span class="flex items-center gap-1.5">
                <i data-lucide="book-open" class="w-3 h-3"></i>
                Grimorios: <span id="footerGrimoiresCount" class="text-gray-300 font-semibold">0</span>
            </span>
        </div>
        <div class="flex items-center gap-2">
            <span class="text-gray-500">Seleccionado:</span>
            <span id="footerFile" class="text-purple-300 font-mono font-semibold">—</span>
            <span class="text-gray-600">|</span>
            <span id="footerSize" class="text-gray-300 font-mono">—</span>
        </div>
    </footer>

    <script src="/coffee/app/visor/src/js/sample_visor.js?t=<?php echo time(); ?>"></script>
    <script src="/coffee/app/visor/src/js/visor.js?t=<?php echo time(); ?>"></script>
</body>
</html>
