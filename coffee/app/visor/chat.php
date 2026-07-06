<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chat con Agentes — CoffeeSoft</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="src/css/ui-kit.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/visor.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/chat.css?t=<?php echo time(); ?>">

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script src="https://unpkg.com/@viz-js/viz@3.2.4/lib/viz-standalone.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
    <script>
        if (window.mermaid) {
            mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
        }
    </script>
</head>

<body class="chat-body-root" data-theme="dark">

    <header class="chat-header">
        <div class="chat-header-left">
            <div class="chat-logo">CH</div>
            <div class="flex flex-col leading-tight">
                <span class="chat-title">Chat con Agentes</span>
                <span class="chat-subtitle">Conversación multi-modelo estilo OpenAI</span>
            </div>
        </div>

        <button id="chatHeaderToggle" class="chat-header-toggle" title="Ajustes" aria-expanded="false">
            <i data-lucide="sliders-horizontal" class="w-4 h-4"></i>
        </button>

        <div class="chat-header-right" id="chatHeaderRight">
            <div class="chat-select-wrap" title="Agente activo">
                <i data-lucide="bot" class="w-4 h-4"></i>
                <select id="chatAgentSelect" class="chat-select"></select>
            </div>

            <select id="chatModelSelect" class="ia-model-pill" title="Modelo activo">
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

            <button id="chatNewBtn" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5" title="Nueva conversación">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                <span>Nueva</span>
            </button>

            <button id="chatThemeToggle" class="theme-toggle" title="Cambiar tema claro/oscuro">
                <i data-lucide="sun" class="w-4 h-4"></i>
            </button>
        </div>
    </header>

    <!-- Conmutador Conversaciones/Chat (solo movil): ambos paneles no caben apilados. -->
    <div class="chat-mobile-switch" role="tablist" aria-label="Vista">
        <button class="chat-mswitch" data-mview="list" role="tab">
            <i data-lucide="messages-square" class="w-4 h-4"></i> Conversaciones
        </button>
        <button class="chat-mswitch active" data-mview="chat" role="tab">
            <i data-lucide="message-circle" class="w-4 h-4"></i> Chat
        </button>
    </div>

    <div class="chat-workspace" data-mview="chat">

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
                <a href="chat.php" class="app-rail-item active" title="Chat con Agentes">
                    <i data-lucide="message-circle"></i>
                    <span class="app-rail-label">Chat</span>
                </a>
                <a href="documents-admin.php" class="app-rail-item" title="Admin de Documentos">
                    <i data-lucide="folder-cog"></i>
                    <span class="app-rail-label">Admin</span>
                </a>
            </div>
        </nav>

        <aside class="chat-sidebar">
            <div class="chat-sidebar-head">
                <input id="chatSearchInput" type="text" class="cs-input" placeholder="Buscar chats…">
                <button id="chatNewSidebarBtn" class="cs-btn cs-btn-outline cs-btn-sm" title="Nueva conversación">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                </button>
            </div>
            <div class="chat-sidebar-body cs-scroll">
                <div class="chat-sidebar-group" data-group="today" style="display:none;">
                    <h4>Hoy</h4>
                    <ul id="chatListToday"></ul>
                </div>
                <div class="chat-sidebar-group" data-group="yesterday" style="display:none;">
                    <h4>Ayer</h4>
                    <ul id="chatListYesterday"></ul>
                </div>
                <div class="chat-sidebar-group" data-group="week" style="display:none;">
                    <h4>Esta semana</h4>
                    <ul id="chatListWeek"></ul>
                </div>
                <div class="chat-sidebar-group" data-group="older" style="display:none;">
                    <h4>Más antiguos</h4>
                    <ul id="chatListOlder"></ul>
                </div>
                <div id="chatSidebarEmpty" class="chat-sidebar-empty">
                    <i data-lucide="message-square-dashed" class="w-8 h-8 inline-block" style="color:var(--vsr-text-mute2);margin-bottom:8px;"></i>
                    <div>Aún no hay conversaciones guardadas.</div>
                    <div style="margin-top:4px;">Inicia una nueva y se guardará al cerrar.</div>
                </div>
            </div>
        </aside>

        <main class="chat-main">
            <header class="chat-pane-head">
                <div class="chat-pane-title">
                    <i data-lucide="message-circle" class="w-4 h-4"></i>
                    <span id="chatCurrentTitle">Nueva conversación</span>
                </div>
                <div class="chat-pane-actions">
                    <button id="chatRenameBtn" class="chat-iconbtn" title="Renombrar">
                        <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                    </button>
                    <button id="chatSaveBtn" class="chat-iconbtn" title="Guardar (.md en documents/Chats/)">
                        <i data-lucide="save" class="w-3.5 h-3.5"></i>
                    </button>
                    <button id="chatDownloadBtn" class="chat-iconbtn" title="Descargar .md">
                        <i data-lucide="download" class="w-3.5 h-3.5"></i>
                    </button>
                    <button id="chatDeleteBtn" class="chat-iconbtn is-danger" title="Eliminar">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </header>

            <div id="chatBody" class="chat-body"></div>

            <div class="ia-drawer-input chat-input">
                <div id="chatImageStrip" class="ia-image-strip" style="display:none;"></div>
                <div class="ia-input-wrap">
                    <textarea id="chatInput" class="ia-input-textarea" rows="1"
                        placeholder="Pregunta lo que quieras… (Enter para enviar, Shift+Enter para nueva línea)"></textarea>
                    <button id="chatSendBtn" class="ia-send-btn" title="Enviar (Enter)">
                        <i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
                <input id="chatFileInput" type="file" multiple hidden>
                <div class="ia-input-hint chat-input-hint">
                    <button id="chatAttachBtn" class="ia-attach-btn" title="Adjuntar imagen o documento de texto (también Ctrl+V)">
                        <i data-lucide="paperclip" class="w-3 h-3"></i>
                    </button>
                    <button id="chatCanvasToggle" class="ia-editor-toggle is-icon-only" title="Activar modo lienzo (la IA genera componentes HTML renderizables)">
                        <i data-lucide="layout-template" class="w-3 h-3"></i>
                    </button>
                    <div class="ia-graph-wrap" style="position:relative;">
                        <button id="chatGraphBtn" class="ia-attach-btn" title="Lienzos de gráficas (Mermaid / draw.io / Excalidraw)">
                            <i data-lucide="feather" class="w-3 h-3"></i>
                        </button>
                        <div id="chatGraphMenu" class="graph-menu graph-menu-up" style="display:none;">
                            <button type="button" class="graph-menu-item" data-graph="mermaid">
                                <i data-lucide="git-graph" class="w-4 h-4"></i>
                                <span class="graph-menu-info">
                                    <span class="graph-menu-name">Mermaid</span>
                                    <span class="graph-menu-desc">Diagrama desde texto</span>
                                </span>
                            </button>
                            <button type="button" class="graph-menu-item" data-graph="drawio">
                                <i data-lucide="pen-tool" class="w-4 h-4"></i>
                                <span class="graph-menu-info">
                                    <span class="graph-menu-name">draw.io</span>
                                    <span class="graph-menu-desc">Lienzo de diagramas</span>
                                </span>
                            </button>
                            <button type="button" class="graph-menu-item" data-graph="excalidraw">
                                <i data-lucide="pencil-ruler" class="w-4 h-4"></i>
                                <span class="graph-menu-info">
                                    <span class="graph-menu-name">Excalidraw</span>
                                    <span class="graph-menu-desc">Boceto a mano alzada</span>
                                </span>
                            </button>
                        </div>
                    </div>
                    <span id="chatContextInfo" class="chat-context-info"></span>
                    <span class="chat-spacer"></span>
                    <span id="chatStatusInfo" class="chat-status">Listo</span>
                </div>
            </div>
        </main>
    </div>

    <div id="chatRenameModal" class="pg-modal hidden" aria-hidden="true">
        <div id="chatRenameBackdrop" class="pg-modal-backdrop"></div>
        <div class="pg-modal-dialog chat-modal-dialog" role="dialog">
            <header class="pg-modal-head">
                <div class="flex items-center gap-2">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                    <h3>Renombrar conversación</h3>
                </div>
                <button id="chatRenameCancel" class="chat-iconbtn" title="Cerrar">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </header>
            <div class="pg-modal-body chat-modal-body">
                <div class="chat-modal-field">
                    <label for="chatRenameInput">Título</label>
                    <input id="chatRenameInput" type="text" class="chat-modal-input" placeholder="Ej. Consulta sobre mermas">
                </div>
            </div>
            <footer class="pg-modal-foot chat-modal-foot">
                <span class="pg-hint">El cambio se aplica al guardar.</span>
                <div class="flex gap-2">
                    <button id="chatRenameCancel2" class="cs-btn cs-btn-ghost cs-btn-sm">Cancelar</button>
                    <button id="chatRenameSave" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5">
                        <i data-lucide="check" class="w-3.5 h-3.5"></i> Guardar título
                    </button>
                </div>
            </footer>
        </div>
    </div>

    <div id="chatDeleteModal" class="pg-modal hidden" aria-hidden="true">
        <div id="chatDeleteBackdrop" class="pg-modal-backdrop"></div>
        <div class="pg-modal-dialog chat-modal-dialog" role="dialog">
            <header class="pg-modal-head">
                <div class="flex items-center gap-2">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                    <h3>Eliminar conversación</h3>
                </div>
                <button id="chatDeleteCancel" class="chat-iconbtn" title="Cerrar">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </header>
            <div class="pg-modal-body chat-modal-body">
                <p id="chatDeleteText" class="pg-hint" style="margin:0;font-size:13px;">Vas a eliminar esta conversación. Esta acción no se puede deshacer.</p>
            </div>
            <footer class="pg-modal-foot chat-modal-foot">
                <span class="pg-hint">Se borrará el archivo .md asociado.</span>
                <div class="flex gap-2">
                    <button id="chatDeleteCancel2" class="cs-btn cs-btn-ghost cs-btn-sm">Cancelar</button>
                    <button id="chatDeleteConfirm" class="cs-btn cs-btn-sm flex items-center gap-1.5" style="background:var(--vsr-accent);color:#fff;">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Eliminar
                    </button>
                </div>
            </footer>
        </div>
    </div>

    <div id="chatToast" class="visor-toast"></div>

    <script src="src/js/ia-render.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/chat.js?t=<?php echo time(); ?>"></script>
</body>
</html>
