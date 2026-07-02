<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CoffeeDocs — CoffeeSoft</title>

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
    <script src="https://unpkg.com/@viz-js/viz@3.2.4/lib/viz-standalone.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script src="https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js"></script>
    <link id="hljsTheme" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
    <script>
        if (window.mermaid) {
            mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
        }
    </script>

    <style>
        /* ── Lienzo Excalidraw ── */
        .excalidraw-stage { width: 100%; height: 100%; min-height: 480px; display: flex; flex-direction: column; background: var(--vsr-bg-base, #0E1521); border-radius: 10px; overflow: hidden; }
        .excalidraw-bar {
            display: flex; align-items: center; justify-content: space-between;
            padding: 8px 14px; border-bottom: 1px solid var(--vsr-border, #243043);
            background: var(--vsr-bg-card, #141d2b); flex-shrink: 0;
        }
        .excalidraw-bar-title { font-size: 13px; font-weight: 600; color: var(--vsr-text, #E5E7EB); }
        .excalidraw-mount { flex: 1 1 auto; min-height: 0; position: relative; }
        .excalidraw-mount .excalidraw { height: 100%; }
        .excalidraw-loading {
            flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px;
            color: var(--vsr-text-muted, #9CA3AF); font-size: 13px; padding: 40px; text-align: center;
        }
        .excalidraw-spinner {
            width: 16px; height: 16px; border-radius: 50%;
            border: 2px solid currentColor; border-top-color: transparent;
            display: inline-block; animation: excSpin .8s linear infinite;
        }
        @keyframes excSpin { to { transform: rotate(360deg); } }

        /* ── Modo boceto dividido: documento (izq) + lienzo Excalidraw (der) ──
           Mismo split que draw.io (body.diagram-mode): el documento queda a la
           izquierda como referencia y el lienzo aparece a la derecha. */
        body.sketch-mode .main-content    { display: flex; flex-direction: row; align-items: stretch; gap: 20px; overflow: hidden; }
        body.sketch-mode .doc-layout      { flex: 1 1 0; min-width: 0; height: 100%; overflow-y: auto; }
        body.sketch-mode #excalidrawStage { flex: 1 1 0; min-width: 0; height: 100%; }
        body.sketch-mode .doc-meta        { display: none; }
        @media (max-width: 1100px) {
            body.sketch-mode .main-content    { flex-direction: column; overflow-y: auto; }
            body.sketch-mode .doc-layout      { height: auto; overflow-y: visible; }
            body.sketch-mode #excalidrawStage { height: 70vh; }
        }
    </style>
</head>

<body class="visor-body" data-theme="dark">

    <header class="visor-header">
        <div class="vsr-header-left">
            <div class="visor-logo">VS</div>
            <button id="btnToggleSidebar" class="vsr-sidebar-toggle" title="Ocultar lista de archivos" aria-label="Colapsar panel de archivos">
                <i data-lucide="panel-left" class="w-4 h-4"></i>
            </button>
            <div class="flex flex-col leading-tight">
                <span id="headerTitle">CoffeeDocs</span>
                <span id="headerSubtitle">CoffeeSoft Library</span>
            </div>
            <span class="vsr-chip hidden md:inline-block">
                <strong id="totalCountChip">0</strong> archivos
            </span>
        </div>

        <!-- Boton Ajustes (solo movil): colapsa/expande los controles del header. -->
        <button id="vsrHeaderToggle" class="vsr-header-toggle" title="Ajustes" aria-expanded="false">
            <i data-lucide="sliders-horizontal" class="w-4 h-4"></i>
        </button>

        <div class="vsr-header-right" id="vsrHeaderRight">
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

    <!-- Conmutador Archivos/Documento (solo movil): ambos paneles no caben apilados. -->
    <div class="vsr-mobile-switch" role="tablist" aria-label="Vista">
        <button class="vsr-mswitch" data-mview="files" role="tab">
            <i data-lucide="folder-tree" class="w-4 h-4"></i> Archivos
        </button>
        <button class="vsr-mswitch active" data-mview="doc" role="tab">
            <i data-lucide="file-text" class="w-4 h-4"></i> Documento
        </button>
    </div>

    <div class="visor-body-row" data-mview="doc">

        <!-- Rail de navegacion entre modulos (Visor / Playground / Admin) -->
        <nav class="app-rail" aria-label="Modulos">
            <div class="app-rail-nav">
                <a href="index.php" class="app-rail-item active" title="CoffeeDocs">
                    <i data-lucide="layout-dashboard"></i>
                    <span class="app-rail-label">Visor</span>
                </a>
                <a href="playground.php" class="app-rail-item" title="Playground de Agentes">
                    <i data-lucide="flask-conical"></i>
                    <span class="app-rail-label">Lab</span>
                </a>
                <a href="forge.php" class="app-rail-item" title="Forge — Fábrica de Módulos">
                    <i data-lucide="hammer"></i>
                    <span class="app-rail-label">Forge</span>
                </a>
                <a href="chat.php" class="app-rail-item" title="Chat con Agentes">
                    <i data-lucide="message-circle"></i>
                    <span class="app-rail-label">Chat</span>
                </a>
                <a href="documents-admin.php" class="app-rail-item" title="Admin de Documentos">
                    <i data-lucide="folder-cog"></i>
                    <span class="app-rail-label">Admin</span>
                </a>
            </div>
        </nav>

        <aside class="visor-sidebar">
            <div class="visor-sidebar-inner">
                <div class="sidebar-search-wrap">
                    <div class="cs-input-group">
                        <span class="cs-input-group-icon">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/>
                            </svg>
                        </span>
                        <input id="sidebarSearch" type="text" placeholder="Filtrar archivos..." class="cs-input pl-9 w-full">
                    </div>
                </div>

                <div id="sidebarList" class="sidebar-list"></div>

                <div class="sidebar-footer">
                    <span id="footerSource">Local</span>
                    <span id="footerPath">.claude/agents</span>
                </div>
            </div>
        </aside>

        <main id="root" class="visor-main">

            <div class="visor-main-col">

            <div class="main-breadcrumb">
                <button id="btnToggleCoffeeIA" class="cs-btn cs-btn-sm btn-coffeeia flex items-center gap-1.5" title="CoffeeIA (Ctrl+I)">
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
                    <button id="btnCloseDiagram" class="cs-btn cs-btn-ghost cs-btn-sm flex items-center gap-1.5 hidden" title="Cerrar lienzo">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        Cerrar lienzo
                    </button>
                    <button id="btnCloseSketch" class="cs-btn cs-btn-ghost cs-btn-sm flex items-center gap-1.5 hidden" title="Cerrar boceto">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        Cerrar boceto
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

                        <!-- Toolbar de Markdown (estilo GitHub) — visible solo en modo edicion -->
                        <div id="mdToolbar" class="md-toolbar hidden">
                            <!-- Selector de estilo de bloque / tamaño de texto -->
                            <select class="md-block-select" data-md-block title="Estilo de texto">
                                <option value="p">Texto normal</option>
                                <option value="h1">Título 1</option>
                                <option value="h2">Título 2</option>
                                <option value="h3">Título 3</option>
                                <option value="h4">Título 4</option>
                                <option value="quote">Cita</option>
                                <option value="codeblock">Bloque de código</option>
                            </select>
                            <span class="md-toolbar-sep"></span>
                            <button type="button" class="md-tool" data-md="bold"       title="Negrita (Ctrl+B)"><i data-lucide="bold" class="w-4 h-4"></i></button>
                            <button type="button" class="md-tool" data-md="italic"     title="Cursiva (Ctrl+I)"><i data-lucide="italic" class="w-4 h-4"></i></button>
                            <button type="button" class="md-tool" data-md="strike"     title="Tachado"><i data-lucide="strikethrough" class="w-4 h-4"></i></button>
                            <button type="button" class="md-tool" data-md="code"       title="Código en línea"><i data-lucide="code" class="w-4 h-4"></i></button>
                            <button type="button" class="md-tool" data-md="link"       title="Enlace (Ctrl+K)"><i data-lucide="link" class="w-4 h-4"></i></button>
                            <button type="button" class="md-tool" data-md="image"      title="Imagen"><i data-lucide="image" class="w-4 h-4"></i></button>
                            <span class="md-toolbar-sep"></span>
                            <button type="button" class="md-tool" data-md="ul"   title="Lista"><i data-lucide="list" class="w-4 h-4"></i></button>
                            <button type="button" class="md-tool" data-md="ol"   title="Lista numerada"><i data-lucide="list-ordered" class="w-4 h-4"></i></button>
                            <button type="button" class="md-tool" data-md="task" title="Lista de tareas"><i data-lucide="list-checks" class="w-4 h-4"></i></button>
                            <span class="md-toolbar-sep"></span>
                            <button type="button" class="md-tool" data-md="quote"     title="Cita"><i data-lucide="text-quote" class="w-4 h-4"></i></button>
                            <button type="button" class="md-tool" data-md="codeblock" title="Bloque de código"><i data-lucide="square-code" class="w-4 h-4"></i></button>
                            <button type="button" class="md-tool" data-md="table"     title="Tabla"><i data-lucide="table" class="w-4 h-4"></i></button>
                            <button type="button" class="md-tool" data-md="hr"        title="Línea divisoria"><i data-lucide="minus" class="w-4 h-4"></i></button>
                            <span class="md-toolbar-sep"></span>
                            <button type="button" class="md-tool" data-md="clear" title="Quitar formato"><i data-lucide="remove-formatting" class="w-4 h-4"></i></button>
                        </div>

                        <article id="md-rendered" class="md-rendered"></article>
                        <pre id="md-raw" class="md-raw hidden"></pre>
                        <textarea id="md-edit" class="md-edit hidden" spellcheck="false"></textarea>
                    </div>

                </div>

                <!-- Lienzo de diagramas (draw.io embebido). Oculto salvo modo diagrama. -->
                <div id="drawioStage" class="drawio-stage hidden"></div>

                <!-- Lienzo de bocetos (Excalidraw). Oculto salvo modo boceto. -->
                <div id="excalidrawStage" class="excalidraw-stage hidden"></div>

                <!-- Tablero de GitHub Projects (panel derecho). Oculto salvo modo github. -->
                <div id="githubStage" class="github-stage hidden"></div>
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
                    <!-- Bajar al final: aparece al subir a leer mientras la IA escribe -->
                    <button id="iaScrollDownBtn" class="ia-scrolldown-btn" title="Bajar al final" style="display:none;">
                        <i data-lucide="arrow-down" class="w-4 h-4"></i>
                    </button>
                    <div id="iaDbChip" class="ia-db-chip" style="display:none;"></div>
                    <div id="iaFolderChip" class="ia-db-chip ia-folder-chip" style="display:none;"></div>
                    <div id="iaImageStrip" class="ia-image-strip" style="display:none;"></div>
                    <div class="ia-input-wrap">
                        <textarea id="iaInputTextarea" class="ia-input-textarea" rows="1" placeholder="Pregunta algo sobre el documento..."></textarea>
                        <button id="iaSendBtn" class="ia-send-btn" title="Enviar (Enter)">
                            <i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <input id="iaImageInput" type="file" accept="image/*,text/*,.md,.markdown,.csv,.tsv,.html,.htm,.xml,.svg,.json,.yaml,.yml,.toml,.ini,.env,.conf,.log,.js,.mjs,.ts,.jsx,.tsx,.css,.scss,.less,.php,.py,.rb,.go,.rs,.java,.kt,.c,.h,.cpp,.cs,.sql,.sh,.bash,.ps1,.bat,.vue,.astro" multiple style="display:none;">
                    <div class="ia-input-hint">
                        <button id="iaAttachBtn" class="ia-attach-btn" title="Adjuntar imagen o documento de texto (tambien Ctrl+V para pegar)">
                            <i data-lucide="paperclip" class="w-3 h-3"></i>
                        </button>
                        <button id="iaEditorToggle" class="ia-editor-toggle is-icon-only" title="Activar modo editor">
                            <i data-lucide="pencil-line" class="w-3 h-3"></i>
                        </button>
                        <button id="iaCanvasToggle" class="ia-editor-toggle is-icon-only" title="Activar modo Layout">
                            <i data-lucide="layout-template" class="w-3 h-3"></i>
                        </button>
                        <button id="iaClearBtn" class="ia-attach-btn" title="Limpiar conversaci&oacute;n (borra los mensajes actuales)">
                            <i data-lucide="trash-2" class="w-3 h-3"></i>
                        </button>
                        <!-- Resto de herramientas del chat agrupadas en un menu desplegable -->
                        <div class="ia-tools-wrap" style="position:relative;">
                            <button id="iaToolsBtn" class="ia-attach-btn" title="Herramientas del chat">
                                <i data-lucide="wrench" class="w-3 h-3"></i>
                            </button>
                            <div id="iaToolsMenu" class="graph-menu graph-menu-up" style="display:none;">
                                <button type="button" class="graph-menu-item" data-tool="save">
                                    <i data-lucide="save" class="w-4 h-4"></i>
                                    <span class="graph-menu-info">
                                        <span class="graph-menu-name">Guardar conversaci&oacute;n</span>
                                        <span class="graph-menu-desc">Guarda el chat actual</span>
                                    </span>
                                </button>
                                <button type="button" class="graph-menu-item" data-tool="saved">
                                    <i data-lucide="messages-square" class="w-4 h-4"></i>
                                    <span class="graph-menu-info">
                                        <span class="graph-menu-name">Chats guardados</span>
                                        <span class="graph-menu-desc">Abre conversaciones previas</span>
                                    </span>
                                </button>
                                <div class="graph-menu-sep"></div>
                                <button type="button" class="graph-menu-item" data-tool="github">
                                    <i data-lucide="folder-git-2" class="w-4 h-4"></i>
                                    <span class="graph-menu-info">
                                        <span class="graph-menu-name">GitHub Projects</span>
                                        <span class="graph-menu-desc">Ver tus tableros en el chat</span>
                                    </span>
                                </button>
                                <div class="graph-menu-sep"></div>
                                <button type="button" class="graph-menu-item" data-tool="graph" data-graph="mermaid">
                                    <i data-lucide="git-graph" class="w-4 h-4"></i>
                                    <span class="graph-menu-info">
                                        <span class="graph-menu-name">Mermaid</span>
                                        <span class="graph-menu-desc">Diagrama desde texto</span>
                                    </span>
                                </button>
                                <button type="button" class="graph-menu-item" data-tool="graph" data-graph="drawio">
                                    <i data-lucide="pen-tool" class="w-4 h-4"></i>
                                    <span class="graph-menu-info">
                                        <span class="graph-menu-name">draw.io</span>
                                        <span class="graph-menu-desc">Lienzo de diagramas</span>
                                    </span>
                                </button>
                                <button type="button" class="graph-menu-item has-submenu" data-tool="graph" data-graph="excalidraw">
                                    <i data-lucide="pencil-ruler" class="w-4 h-4"></i>
                                    <span class="graph-menu-info">
                                        <span class="graph-menu-name">Excalidraw</span>
                                        <span class="graph-menu-desc">Boceto a mano alzada</span>
                                    </span>
                                    <i data-lucide="chevron-right" class="graph-menu-caret w-4 h-4"></i>
                                </button>
                            </div>
                            <!-- Submenu de Excalidraw: elige plantilla o modo libre -->
                            <div id="iaExcaliSubmenu" class="graph-menu graph-submenu" style="display:none;">
                                <div class="graph-submenu-title">Excalidraw</div>
                                <button type="button" class="graph-menu-item" data-excali="template">
                                    <i data-lucide="layout-template" class="w-4 h-4"></i>
                                    <span class="graph-menu-info">
                                        <span class="graph-menu-name">Template</span>
                                        <span class="graph-menu-desc">Maestros corporativos + tabla</span>
                                    </span>
                                </button>
                                <button type="button" class="graph-menu-item" data-excali="libre">
                                    <i data-lucide="pencil" class="w-4 h-4"></i>
                                    <span class="graph-menu-info">
                                        <span class="graph-menu-name">Libre</span>
                                        <span class="graph-menu-desc">Boceto a mano alzada</span>
                                    </span>
                                </button>
                            </div>
                        </div>
                        <select id="iaModelSelect" class="ia-model-pill" title="Modelo activo">
                            <optgroup label="Ollama Cloud">
                                <option value="glm-5.2:cloud">GLM 5.2 (código)</option>
                                <option value="glm-5.1:cloud">GLM 5.1 (código)</option>
                                <option value="qwen3-coder-next:cloud">Qwen3 Coder Next (código)</option>
                                <option value="minimax-m3:cloud">MiniMax M3 (código, vision)</option>
                                <option value="gemma4:31b-cloud">Gemma4 31B (vision)</option>
                                <option value="deepseek-v4-pro:cloud">DeepSeek V4 Pro (razonamiento)</option>
                                <option value="kimi-k2.6:cloud">Kimi K2.6 (agéntico, vision)</option>
                                <option value="kimi-k2.7-code:cloud">Kimi K2.7 Code (código)</option>
                            </optgroup>
                            <optgroup label="OpenRouter (free)">
                                <option value="openai/gpt-oss-120b:free">GPT-OSS 120B (free)</option>
                                <option value="z-ai/glm-4.5-air:free">GLM 4.5 Air (free)</option>
                                <option value="nvidia/nemotron-3-super-120b-a12b:free">Nemotron 3 Super 120B (free)</option>
                                <option value="google/gemma-4-31b-it:free">Gemma 4 31B (free, vision)</option>
                                <option value="nvidia/nemotron-nano-12b-v2-vl:free">Nemotron Nano 12B VL (free, vision)</option>
                            </optgroup>
                            <optgroup label="OpenRouter (de pago)">
                                <option value="qwen/qwen3.7-max">Qwen3.7 Max (pago)</option>
                                <option value="qwen/qwen3.6-27b">Qwen3.6 27B (pago)</option>
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

    <!-- Modal: crear archivo nuevo (.md, .drawio, .json, etc.) en la carpeta abierta -->
    <div id="newFileModal" class="folder-browse-modal new-file-modal hidden" aria-hidden="true">
        <div class="folder-browse-backdrop" data-newfile-close></div>
        <div class="folder-browse-dialog new-file-dialog" role="dialog" aria-labelledby="newFileTitle">
            <header class="folder-browse-header">
                <div class="flex items-center gap-2">
                    <i data-lucide="file-plus" class="w-4 h-4"></i>
                    <h3 id="newFileTitle">Nuevo archivo</h3>
                </div>
                <button id="newFileClose" class="folder-browse-close" title="Cerrar">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </header>
            <div class="new-file-body">
                <label class="new-file-label" for="newFilePathInput">Carpeta destino</label>
                <input id="newFilePathInput" type="text" class="folder-browse-path new-file-input" placeholder="C:/ruta/destino" spellcheck="false">
                <select id="newFileFolderSelect" class="folder-browse-path new-file-input hidden"></select>
                <label class="new-file-label" for="newFileNameInput">Nombre del archivo</label>
                <input id="newFileNameInput" type="text" class="folder-browse-path new-file-input" placeholder="documento.md" spellcheck="false">
                <span class="new-file-hint">Si no escribes extensi&oacute;n se usar&aacute; <strong>.md</strong>. Tambi&eacute;n puedes crear .drawio, .json, .txt, etc.</span>
                <label class="new-file-label" for="newFileContent">Contenido inicial (opcional)</label>
                <textarea id="newFileContent" class="new-file-textarea" spellcheck="false" placeholder="# T&iacute;tulo&#10;&#10;Escribe aqu&iacute;..."></textarea>
            </div>
            <footer class="folder-browse-footer">
                <span class="folder-browse-selected">Se crear&aacute; dentro del sandbox del visor.</span>
                <div class="flex gap-2">
                    <button id="newFileCancel" class="cs-btn cs-btn-outline cs-btn-sm">Cancelar</button>
                    <button id="newFileCreateBtn" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5">
                        <i data-lucide="check" class="w-3.5 h-3.5"></i>
                        Crear archivo
                    </button>
                </div>
            </footer>
        </div>
    </div>

    <script src="../src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/sample_visor.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/drawio-board.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/visor.js?t=<?php echo time(); ?>"></script>

    <!-- Integración Excalidraw (lienzo de bocetos): parchea App.loadFile y monta el board. -->
    <script src="src/js/excalidraw-board.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/visor-2.js?t=<?php echo time(); ?>"></script>
</body>
</html>
