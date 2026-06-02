<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Visor de Agentes — CoffeeSoft</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="src/css/ui-kit.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/visor.css?t=<?php echo time(); ?>">

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="https://unpkg.com/turndown/dist/turndown.js"></script>
    <script src="https://unpkg.com/turndown-plugin-gfm/dist/turndown-plugin-gfm.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script src="https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js"></script>
    <link id="hljsTheme" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
    <script>
        if (window.mermaid) {
            mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
        }
    </script>
</head>

<body class="visor-body" data-theme="dark">

    <header class="visor-header">
        <div class="vsr-header-left">
            <div class="visor-logo">VS</div>
            <div class="flex flex-col leading-tight">
                <span id="headerTitle">Visor de Agentes</span>
                <span id="headerSubtitle">CoffeeSoft Library</span>
            </div>
            <span class="vsr-chip hidden md:inline-block">
                <strong id="totalCountChip">0</strong> archivos
            </span>
        </div>

        <div class="vsr-header-right">
            <div class="folder-picker">
                <i data-lucide="folder" class="w-4 h-4"></i>
                <select id="folderSelect" class="folder-select" title="Carpeta a visualizar"></select>
                <input id="folderCustomPath" type="text" placeholder="C:/ruta/absoluta" class="folder-custom-input hidden" title="Ruta absoluta a escanear">
                <button id="btnFolderBrowse" class="folder-browse hidden" title="Examinar carpetas...">
                    <i data-lucide="folder-search" class="w-3.5 h-3.5"></i>
                </button>
                <button id="btnFolderApply" class="folder-apply hidden" title="Aplicar ruta">
                    <i data-lucide="check" class="w-3.5 h-3.5"></i>
                </button>
            </div>

<button id="btnRefresh" class="cs-btn cs-btn-outline cs-btn-sm flex items-center gap-1.5" title="Refrescar lista">
                <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                <span class="btn-label">Refrescar</span>
            </button>

            <a href="documents-admin.php" class="cs-btn cs-btn-outline cs-btn-sm flex items-center gap-1.5" title="Administrar documentos">
                <i data-lucide="settings" class="w-3.5 h-3.5"></i>
                Admin
            </a>

            <button id="btnThemeToggle" class="theme-toggle" title="Cambiar tema claro/oscuro">
                <i data-lucide="moon" class="w-4 h-4"></i>
            </button>

            <div class="vsr-user-block-wrap">
                <button id="userBlockBtn" class="vsr-user-block" type="button" title="Cambiar usuario">
                    <div id="userInitials" class="user-avatar">RV</div>
                    <div class="col">
                        <span id="userName">Rosy V.</span>
                        <span id="userRole">Guardiana</span>
                    </div>
                    <i data-lucide="chevron-down" class="user-block-chev w-3 h-3"></i>
                </button>
                <div id="userMenu" class="user-menu" style="display:none;"></div>
            </div>
        </div>
    </header>

    <div class="visor-body-row">

        <aside class="visor-sidebar">
            <div class="sidebar-search-wrap">
                <div class="cs-input-group">
                    <span class="cs-input-group-icon">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/>
                        </svg>
                    </span>
                    <input id="sidebarSearch" type="text" placeholder="Filtrar archivos..." class="cs-input pl-9 w-full">
                </div>
                <button id="btnToggleSidebar" class="sidebar-toggle-btn" title="Ocultar lista de archivos">
                    <i data-lucide="panel-left-close" class="w-4 h-4"></i>
                </button>
            </div>

            <div id="sidebarList" class="sidebar-list"></div>

            <div class="sidebar-footer">
                <span id="footerSource">Local</span>
                <span id="footerPath">.claude/agents</span>
            </div>
        </aside>

        <main id="root" class="visor-main">

            <div class="visor-main-col">

            <div class="main-breadcrumb">
                <button id="btnToggleCoffeeIA" class="cs-btn cs-btn-sm btn-coffeeia flex items-center gap-1.5" title="CoffeeIA (Ctrl+I)" style="display:none;">
                    <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                    CoffeeIA
                    <span class="dot-indicator"></span>
                </button>
                <div class="doc-toolbar">
                    <div class="cs-tabs cs-tabs-inline">
                        <button class="cs-tab active" data-tab="rendered">
                            <i data-lucide="eye" class="w-3.5 h-3.5 inline-block mr-1 -mt-0.5"></i>
                            Renderizado
                        </button>
                        <button class="cs-tab" data-tab="raw">
                            <i data-lucide="code-2" class="w-3.5 h-3.5 inline-block mr-1 -mt-0.5"></i>
                            Raw
                        </button>
                    </div>
                    <span class="doc-toolbar-sep"></span>
                    <select id="docStyleSelect" class="doc-style-select" title="Estilo de lectura">
                        <option value="github">GitHub</option>
                        <option value="notion">Notion</option>
                        <option value="dracula">Dracula</option>
                        <option value="monokai">Monokai</option>
                    </select>
                    <div class="doc-zoom" title="Tama&ntilde;o de texto">
                        <button id="btnZoomOut" type="button" title="Disminuir texto"><i data-lucide="minus" class="w-3 h-3"></i></button>
                        <span id="docZoomValue">100%</span>
                        <button id="btnZoomIn" type="button" title="Aumentar texto"><i data-lucide="plus" class="w-3 h-3"></i></button>
                    </div>
                    <span class="doc-toolbar-sep"></span>
                    <button id="btnCopyPath" class="cs-btn cs-btn-outline cs-btn-sm flex items-center gap-1.5" title="Copiar ruta relativa al portapapeles">
                        <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                        Copiar ruta
                    </button>
                    <button id="btnEdit" class="cs-btn cs-btn-outline cs-btn-sm flex items-center gap-1.5" title="Editar en el visor" disabled>
                        <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        Editar
                    </button>
                    <button id="btnSave" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5 hidden" title="Guardar (Ctrl+S)">
                        <i data-lucide="save" class="w-3.5 h-3.5"></i>
                        Guardar
                    </button>
                    <button id="btnCancel" class="cs-btn cs-btn-ghost cs-btn-sm flex items-center gap-1.5 hidden" title="Descartar cambios">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        Cancelar
                    </button>
                </div>
            </div>

            <div class="main-content">

                <!-- Panel de propuestas de edicion de CoffeeIA (oculto por defecto) -->
                <div id="editProposalPanel" class="edit-proposal-panel" style="display:none;">
                    <header class="epp-header">
                        <div class="epp-title">
                            <i data-lucide="wand-sparkles" class="w-4 h-4"></i>
                            <span>Propuestas de CoffeeIA</span>
                            <span id="eppCount" class="epp-count">0</span>
                        </div>
                        <div class="epp-actions">
                            <button id="eppAcceptAll" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5">
                                <i data-lucide="check-check" class="w-3.5 h-3.5"></i>
                                Aceptar todas
                            </button>
                            <button id="eppClose" class="cs-btn cs-btn-ghost cs-btn-sm flex items-center gap-1.5" title="Descartar propuestas">
                                <i data-lucide="x" class="w-3.5 h-3.5"></i>
                                Cerrar
                            </button>
                        </div>
                    </header>
                    <div id="eppBody" class="epp-body"></div>
                </div>

                <div class="doc-layout">

                    <aside class="doc-meta">
                        <div id="frontmatterCard" class="frontmatter-card">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-2.5">
                                    <i data-lucide="file-code-2" class="vsr-fm-icon w-4 h-4"></i>
                                    <h2>Frontmatter</h2>
                                </div>
                                <span id="fmFileBadge" class="cs-badge badge-primary">agente</span>
                            </div>
                            <div id="frontmatterBody"></div>
                            <div id="fmChipsWrap" class="flex flex-wrap gap-1.5 mt-2"></div>
                            <div class="fm-foot">
                                <span id="fmSizeBadge">—</span>
                            </div>
                        </div>

                        <div id="tocCard" class="frontmatter-card" style="margin-top:16px;">
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center gap-2.5">
                                    <i data-lucide="list" class="vsr-fm-icon w-4 h-4"></i>
                                    <h2>Contenido</h2>
                                </div>
                            </div>
                            <nav id="tocBody" class="toc-body"></nav>
                        </div>
                    </aside>

                    <div class="doc-main">
                        <div class="doc-main-meta">
                            <span id="lineCountChip">~ 0 lineas</span>
                        </div>

                        <article id="md-rendered" class="md-rendered"></article>
                        <pre id="md-raw" class="md-raw hidden"></pre>
                        <textarea id="md-edit" class="md-edit hidden" spellcheck="false"></textarea>
                    </div>

                </div>
            </div>

            </div><!-- /.visor-main-col -->

        <!-- CoffeeIA panel (ocupa todo el alto del contenedor, a la izquierda) -->
        <aside id="iaDrawer" class="ia-drawer">
            <div id="iaDrawerResizeHandle" class="ia-drawer-resize-handle" title="Arrastra para redimensionar"></div>
            <div class="ia-drawer-inner">

                <header class="ia-drawer-header">
                    <div class="ia-drawer-title">
                        <i data-lucide="sparkles" class="w-4 h-4"></i>
                        <span>CoffeeIA</span>
                    </div>
                    <button id="btnCloseIA" class="ia-drawer-close" title="Cerrar (Esc)">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </header>

                <div id="iaDrawerContext" class="ia-drawer-context">
                    <i data-lucide="file-text"></i>
                    <span id="iaCtxFilename" class="ia-ctx-filename">—</span>
                    <span id="iaCtxMeta" style="margin-left:auto;"></span>
                </div>

                <div id="iaPinnedWrap" class="ia-pinned-wrap" style="display:none;">
                    <div class="ia-pinned-header">
                        <i data-lucide="pin"></i>
                        <span>Anclados al contexto</span>
                        <span id="iaPinnedCount" class="ia-pinned-count">0</span>
                    </div>
                    <div id="iaPinnedChips" class="ia-pinned-chips"></div>
                </div>

                <!-- Estado VACIO -->
                <div class="ia-drawer-body" id="iaBodyEmpty">
                    <div class="ia-empty">
                        <i data-lucide="sparkles"></i>
                        <div class="ia-empty-title">CoffeeIA</div>
                        <div class="ia-empty-subtitle">Pregunta cualquier cosa sobre el documento o elige una sugerencia.</div>
                        <div class="ia-empty-suggestions">
                            <button class="ia-suggestion" data-prompt="Resume este documento">Resume este documento</button>
                            <button class="ia-suggestion" data-prompt="Encuentra inconsistencias">Encuentra inconsistencias</button>
                            <button class="ia-suggestion" data-prompt="Sugiere mejoras de estructura">Sugiere mejoras de estructura</button>
                        </div>
                    </div>
                </div>

                <!-- Estado CHAT -->
                <div class="ia-drawer-body" id="iaBodyChat" style="display:none;"></div>

                <div class="ia-drawer-input">
                    <div id="iaImageStrip" class="ia-image-strip" style="display:none;"></div>
                    <div class="ia-input-wrap">
                        <textarea id="iaInputTextarea" class="ia-input-textarea" rows="1" placeholder="Pregunta algo sobre el documento..."></textarea>
                        <button id="iaSendBtn" class="ia-send-btn" title="Enviar (Enter)">
                            <i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <input id="iaImageInput" type="file" accept="image/*" multiple style="display:none;">
                    <div class="ia-input-hint">
                        <button id="iaAttachBtn" class="ia-attach-btn" title="Adjuntar imagen (tambien Ctrl+V para pegar)">
                            <i data-lucide="paperclip" class="w-3 h-3"></i>
                        </button>
                        <button id="iaClearBtn" title="Limpiar conversacion" style="background:transparent;border:none;cursor:pointer;color:var(--vsr-text-mute2);font-size:10px;padding:0;">
                            <i data-lucide="trash-2" class="w-3 h-3" style="display:inline-block;vertical-align:middle;margin-right:3px;"></i>
                            Limpiar
                        </button>
                        <button id="iaEditorToggle" class="ia-editor-toggle" title="Activar modo editor">
                            <i data-lucide="pencil-line" class="w-3 h-3"></i>
                            <span>Editor</span>
                        </button>
                        <button id="iaCanvasToggle" class="ia-editor-toggle" title="Activar modo lienzo">
                            <i data-lucide="layout-template" class="w-3 h-3"></i>
                            <span>Lienzo</span>
                        </button>
                        <select id="iaModelSelect" class="ia-model-pill" title="Modelo activo">
                            <optgroup label="Ollama Cloud">
                                <option value="qwen3-coder:480b-cloud">Qwen3 Coder 480B</option>
                                <option value="qwen3-vl:235b-cloud">Qwen3 VL 235B (vision)</option>
                                <option value="qwen3.5:397b-cloud">Qwen 3.5 397B</option>
                                <option value="minimax-m2.7:cloud">MiniMax M2.7</option>
                                <option value="minimax-m3:cloud">MiniMax M3</option>
                                <option value="kimi-k2.6:cloud">Kimi K2.6</option>
                            </optgroup>
                            <optgroup label="OpenRouter (free)">
                                <option value="openai/gpt-oss-120b:free">GPT-OSS 120B (free)</option>
                                <option value="z-ai/glm-4.5-air:free">GLM 4.5 Air (free)</option>
                                <option value="nvidia/nemotron-3-super-120b-a12b:free">Nemotron 3 Super 120B (free)</option>
                                <option value="google/gemma-4-31b-it:free">Gemma 4 31B (free, vision)</option>
                                <option value="nvidia/nemotron-nano-12b-v2-vl:free">Nemotron Nano 12B VL (free, vision)</option>
                            </optgroup>
                        </select>
                    </div>
                </div>

            </div>
        </aside>

        </main>

    </div>

    <footer class="visor-footer">
        <div class="flex items-center gap-5">
            <nav class="breadcrumb footer-breadcrumb">
                <i data-lucide="folder" class="w-3.5 h-3.5"></i>
                <span id="breadcrumbSection">agents</span>
                <span class="sep">/</span>
                <span id="breadcrumbFile" class="current">—</span>
            </nav>
            <span class="vsr-footer-sep">|</span>
            <span class="flex items-center gap-1.5">
                <i data-lucide="files" class="w-3.5 h-3.5"></i>
                Total: <span id="footerTotal" class="vsr-footer-strong">0</span> archivos
            </span>
            <span class="flex items-center gap-1.5">
                <i data-lucide="bot" class="w-3.5 h-3.5"></i>
                Agentes: <span id="footerAgentsCount" class="vsr-footer-strong">0</span>
            </span>
            <span class="flex items-center gap-1.5">
                <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
                Grimorios: <span id="footerGrimoiresCount" class="vsr-footer-strong">0</span>
            </span>
        </div>
        <div class="flex items-center gap-2">
            <span class="vsr-footer-label">Seleccionado:</span>
            <span id="footerFile">—</span>
            <span class="vsr-footer-sep">|</span>
            <span id="footerSize">—</span>
        </div>
    </footer>

    <div id="visorToast" class="visor-toast"></div>

    <div id="folderBrowseModal" class="folder-browse-modal hidden" aria-hidden="true">
        <div class="folder-browse-backdrop"></div>
        <div class="folder-browse-dialog" role="dialog" aria-labelledby="folderBrowseTitle">
            <header class="folder-browse-header">
                <div class="flex items-center gap-2">
                    <i data-lucide="folder-search" class="w-4 h-4"></i>
                    <h3 id="folderBrowseTitle">Examinar carpetas</h3>
                </div>
                <button id="folderBrowseClose" class="folder-browse-close" title="Cerrar">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </header>
            <div class="folder-browse-toolbar">
                <button id="folderBrowseUp" class="cs-btn cs-btn-outline cs-btn-sm" title="Subir un nivel">
                    <i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>
                </button>
                <button id="folderBrowseHome" class="cs-btn cs-btn-outline cs-btn-sm" title="Ir al inicio del usuario">
                    <i data-lucide="home" class="w-3.5 h-3.5"></i>
                </button>
                <button id="folderBrowseRoots" class="cs-btn cs-btn-outline cs-btn-sm" title="Ver unidades">
                    <i data-lucide="hard-drive" class="w-3.5 h-3.5"></i>
                </button>
                <input id="folderBrowsePath" type="text" class="folder-browse-path" placeholder="Ruta actual" spellcheck="false">
                <button id="folderBrowseGo" class="cs-btn cs-btn-outline cs-btn-sm" title="Ir a esta ruta">
                    <i data-lucide="corner-down-left" class="w-3.5 h-3.5"></i>
                </button>
            </div>
            <ul id="folderBrowseList" class="folder-browse-list"></ul>
            <footer class="folder-browse-footer">
                <span id="folderBrowseSelected" class="folder-browse-selected">—</span>
                <div class="flex gap-2">
                    <button id="folderBrowseCancel" class="cs-btn cs-btn-outline cs-btn-sm">Cancelar</button>
                    <button id="folderBrowsePick" class="cs-btn cs-btn-primary cs-btn-sm" disabled>
                        <i data-lucide="check" class="w-3.5 h-3.5"></i>
                        Usar esta carpeta
                    </button>
                </div>
            </footer>
        </div>
    </div>

    <script src="../src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/sample_visor.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/visor.js?t=<?php echo time(); ?>"></script>
</body>
</html>
