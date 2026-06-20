<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Playground de Agentes — CoffeeSoft</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="src/css/ui-kit.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/visor.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/playground.css?t=<?php echo time(); ?>">

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>
    <link id="hljsTheme" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
</head>

<body class="pg-body-root" data-theme="dark">

    <header class="pg-header">
        <div class="pg-header-left">
            <div class="pg-logo">PG</div>
            <div class="flex flex-col leading-tight">
                <span class="pg-title">Playground de Agentes</span>
                <span class="pg-subtitle">Entrena y prueba tus agentes CoffeeSoft</span>
            </div>
        </div>

        <!-- Botón Ajustes (solo móvil): colapsa/expande la barra de controles. -->
        <button id="pgHeaderToggle" class="pg-header-toggle" title="Ajustes" aria-expanded="false">
            <i data-lucide="sliders-horizontal" class="w-4 h-4"></i>
        </button>

        <div class="pg-header-right" id="pgHeaderRight">
            <div class="pg-select-wrap" title="Agente activo">
                <i data-lucide="bot" class="w-4 h-4"></i>
                <select id="pgAgentSelect" class="pg-select"></select>
            </div>

            <div class="pg-select-wrap" title="Sistema de diseño / tema del sandbox">
                <i data-lucide="palette" class="w-4 h-4"></i>
                <select id="pgThemeSelect" class="pg-select">
                    <option value="huubie-ui">Huubie UI (dark)</option>
                    <option value="coffeesoft-light">CoffeeSoft · Arcilla Invernal</option>
                    <option value="coffee-varoch-light">Coffee-Varoch (light)</option>
                    <option value="coffee-varoch-dark">Coffee-Varoch (dark)</option>
                    <option value="free">Libre (sin paleta)</option>
                </select>
            </div>

            <button id="pgKnowledgeBtn" class="cs-btn cs-btn-outline cs-btn-sm flex items-center gap-1.5" title="Configurar prompt y contexto del agente">
                <i data-lucide="brain" class="w-3.5 h-3.5"></i>
                Conocimiento
                <span id="pgKnowledgeCount" class="pg-count">0</span>
            </button>

            <select id="pgModelSelect" class="ia-model-pill" title="Modelo activo">
                <optgroup label="Ollama Cloud">
                    <option value="glm-5.2:cloud">GLM 5.2 (código)</option>
                    <option value="glm-5.1:cloud">GLM 5.1 (código)</option>
                    <option value="qwen3-coder-next:cloud">Qwen3 Coder Next (código)</option>
                    <option value="minimax-m3:cloud">MiniMax M3 (código, vision)</option>
                    <option value="gemma4:31b-cloud">Gemma4 31B (vision)</option>
                    <option value="deepseek-v4-pro:cloud">DeepSeek V4 Pro (razonamiento)</option>
                    <option value="kimi-k2.6:cloud">Kimi K2.6 (agéntico, vision)</option>
                    <option value="kimi-k2.7-code:cloud">Kimi K2.7 Code (código, vision)</option>
                </optgroup>
                <optgroup label="OpenRouter (free)">
                    <option value="openai/gpt-oss-120b:free">GPT-OSS 120B (free)</option>
                    <option value="z-ai/glm-4.5-air:free">GLM 4.5 Air (free)</option>
                    <option value="google/gemma-4-31b-it:free">Gemma 4 31B (free)</option>
                </optgroup>
                <optgroup label="OpenRouter (de pago)">
                    <option value="qwen/qwen3.7-max">Qwen3.7 Max (pago)</option>
                    <option value="qwen/qwen3.6-27b">Qwen3.6 27B (pago)</option>
                </optgroup>
            </select>

            <button id="pgThemeToggle" class="theme-toggle" title="Cambiar tema claro/oscuro">
                <i data-lucide="sun" class="w-4 h-4"></i>
            </button>
        </div>
    </header>

    <!-- Conmutador Chat/Sandbox (solo movil): ambos paneles no caben apilados. -->
    <div class="pg-mobile-switch" role="tablist" aria-label="Vista">
        <button class="pg-mswitch active" data-mview="chat" role="tab">
            <i data-lucide="message-square" class="w-4 h-4"></i> Chat
        </button>
        <button class="pg-mswitch" data-mview="sandbox" role="tab">
            <i data-lucide="layout-template" class="w-4 h-4"></i> Sandbox
        </button>
    </div>

    <div class="pg-workspace" data-mview="chat">

        <!-- Rail de navegacion entre modulos (Visor / Playground / Admin) -->
        <nav class="app-rail" aria-label="Modulos">
            <div class="app-rail-nav">
                <a href="index.php" class="app-rail-item" title="Visor de Agentes">
                    <i data-lucide="layout-dashboard"></i>
                    <span class="app-rail-label">Visor</span>
                </a>
                <a href="playground.php" class="app-rail-item active" title="Playground de Agentes">
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

        <!-- ── Izquierda: chat con el agente ── -->
        <section class="pg-chat">
            <header class="pg-pane-head">
                <div class="pg-pane-title">
                    <i id="pgChatAgentIcon" data-lucide="sparkles" class="w-4 h-4"></i>
                    <span id="pgChatAgentName">CoffeeIA</span>
                    <span id="pgThreadChip" class="pg-thread-chip hidden" title="Hilo activo">
                        <i data-lucide="git-branch" class="w-3 h-3"></i>
                        <span id="pgThreadChipTitle">Hilo</span>
                    </span>
                </div>
                <div class="pg-pane-head-actions">
                    <button id="pgNewThreadBtn" class="pg-iconbtn" title="Nuevo hilo de conversación">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                    </button>
                    <button id="pgThreadsBtn" class="pg-iconbtn" title="Hilos guardados">
                        <i data-lucide="messages-square" class="w-3.5 h-3.5"></i>
                    </button>
                    <button id="pgResetBtn" class="pg-iconbtn" title="Reiniciar conversación">
                        <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </header>

            <div id="pgChatBody" class="pg-chat-body">
                <div class="pg-empty">
                    <i data-lucide="sparkles"></i>
                    <div class="pg-empty-title">Pon a prueba a tu agente</div>
                    <div class="pg-empty-sub">Escríbele una instrucción y observa el resultado en el sandbox.</div>
                </div>
            </div>

            <div class="ia-drawer-input pg-chat-input">
                <div id="pgImageStrip" class="ia-image-strip" style="display:none;"></div>
                <div class="ia-input-wrap">
                    <textarea id="pgInput" class="ia-input-textarea" rows="1" placeholder="Pide algo al agente..."></textarea>
                    <button id="pgSendBtn" class="ia-send-btn" title="Enviar (Enter)">
                        <i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
                <input id="pgImageInput" type="file" accept="image/*,text/*,.md,.markdown,.csv,.tsv,.html,.htm,.xml,.svg,.json,.yaml,.yml,.toml,.ini,.env,.conf,.log,.js,.mjs,.ts,.jsx,.tsx,.css,.scss,.less,.php,.py,.rb,.go,.rs,.java,.kt,.c,.h,.cpp,.cs,.sql,.sh,.bash,.ps1,.bat,.vue,.astro" multiple style="display:none;">
                <div class="ia-input-hint">
                    <button id="pgAttachBtn" class="ia-attach-btn" title="Adjuntar imagen o documento de texto (también Ctrl+V para pegar)">
                        <i data-lucide="paperclip" class="w-3 h-3"></i>
                    </button>
                    <button id="pgClearBtn" title="Limpiar conversación" style="background:transparent;border:none;cursor:pointer;color:var(--vsr-text-mute2);font-size:10px;padding:0;">
                        <i data-lucide="trash-2" class="w-3 h-3" style="display:inline-block;vertical-align:middle;margin-right:3px;"></i>
                        Limpiar
                    </button>
                    <button id="pgCanvasToggle" class="ia-editor-toggle" title="Activar modo lienzo (la IA generará componentes HTML renderizables)">
                        <i data-lucide="layout-template" class="w-3 h-3"></i>
                        <span>Lienzo</span>
                    </button>
                </div>
            </div>
        </section>

        <!-- ── Splitter redimensionable ── -->
        <div id="pgSplitter" class="pg-splitter" title="Arrastra para redimensionar"></div>

        <!-- ── Derecha: sandbox de render ── -->
        <section class="pg-sandbox">
            <header class="pg-pane-head">
                <div class="pg-sandbox-tabs">
                    <button class="pg-tab active" data-sbtab="preview">
                        <i data-lucide="eye" class="w-3.5 h-3.5"></i> Preview
                    </button>
                    <button class="pg-tab" data-sbtab="code">
                        <i data-lucide="code-2" class="w-3.5 h-3.5"></i> Código
                    </button>
                    <button class="pg-tab" data-sbtab="styles" title="Inspeccionar estilos de cada elemento">
                        <i data-lucide="palette" class="w-3.5 h-3.5"></i> Estilos
                    </button>
                </div>
                <div class="pg-sandbox-actions">
                    <div class="pg-zoom" title="Zoom del preview">
                        <button id="pgZoomOut" class="pg-iconbtn" title="Alejar"><i data-lucide="minus" class="w-3.5 h-3.5"></i></button>
                        <button id="pgZoomLabel" class="pg-zoom-label" title="Restablecer a 100%">100%</button>
                        <button id="pgZoomIn" class="pg-iconbtn" title="Acercar"><i data-lucide="plus" class="w-3.5 h-3.5"></i></button>
                    </div>

                    <!-- Viewport del preview: ancho fijo móvil/laptop o completo. -->
                    <div class="pg-viewport" title="Ancho del preview">
                        <button class="pg-vp-btn" data-vp="mobile" title="Vista móvil (390 px)"><i data-lucide="smartphone" class="w-3.5 h-3.5"></i></button>
                        <button class="pg-vp-btn" data-vp="laptop" title="Vista laptop (1280 px)"><i data-lucide="laptop" class="w-3.5 h-3.5"></i></button>
                        <button class="pg-vp-btn is-active" data-vp="full" title="Ancho completo"><i data-lucide="monitor" class="w-3.5 h-3.5"></i></button>
                    </div>

                    <span id="pgSandboxTheme" class="pg-theme-chip">Huubie Dark</span>

                    <!-- Menú de acciones: en desktop los botones van sueltos; en
                         móvil se colapsan tras el botón ⋯ para no saturar. -->
                    <div class="pg-actions-menu">
                        <button id="pgActionsToggle" class="pg-iconbtn pg-actions-toggle" title="Más acciones" aria-expanded="false">
                            <i data-lucide="more-vertical" class="w-3.5 h-3.5"></i>
                        </button>
                        <div class="pg-actions-pop" id="pgActionsPop">
                            <button id="pgTemplatesBtn" class="pg-iconbtn pg-actionbtn" title="Plantillas guardadas">
                                <i data-lucide="library" class="w-3.5 h-3.5"></i>
                                <span class="pg-actionbtn-label">Cargar plantilla</span>
                            </button>
                            <button id="pgSaveTplBtn" class="pg-iconbtn pg-actionbtn" title="Guardar como plantilla reutilizable">
                                <i data-lucide="bookmark-plus" class="w-3.5 h-3.5"></i>
                                <span class="pg-actionbtn-label">Guardar plantilla</span>
                            </button>
                            <button id="pgSandboxDownload" class="pg-iconbtn pg-actionbtn" title="Descargar HTML">
                                <i data-lucide="download" class="w-3.5 h-3.5"></i>
                                <span class="pg-actionbtn-label">Descargar HTML</span>
                            </button>
                            <button id="pgSandboxOpen" class="pg-iconbtn pg-actionbtn" title="Abrir render en pestaña nueva">
                                <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                                <span class="pg-actionbtn-label">Abrir en pestaña</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div class="pg-sandbox-body">
                <iframe id="pgSandboxFrame" class="pg-sandbox-frame" title="Sandbox"></iframe>
                <pre id="pgSandboxCode" class="pg-sandbox-code hidden"><code></code></pre>

                <!-- Inspector de estilos: panel lateral que muestra el CSS resuelto
                     (color, borde, tipografía, hover…) del elemento clicado en el preview. -->
                <aside id="pgStylesPanel" class="pg-styles-panel" aria-hidden="true">
                    <div id="pgStylesHint" class="pg-styles-hint">
                        <i data-lucide="mouse-pointer-click"></i>
                        <p>Haz clic en cualquier elemento del preview (input, card, botón…) para ver cómo está construido: colores, borde, tipografía y su estado <code>:hover</code>.</p>
                    </div>
                    <div id="pgStylesContent"></div>
                </aside>

                <div id="pgSandboxEmpty" class="pg-empty pg-sandbox-empty">
                    <i data-lucide="layout-template"></i>
                    <div class="pg-empty-title">Sandbox vacío</div>
                    <div class="pg-empty-sub">Lo que genere el agente se renderizará aquí con el tema elegido.</div>
                </div>
            </div>
        </section>

    </div>

    <!-- ── Modal: Conocimiento del agente ── -->
    <div id="pgKnowledgeModal" class="pg-modal hidden" aria-hidden="true">
        <div class="pg-modal-backdrop"></div>
        <div class="pg-modal-dialog" role="dialog">
            <header class="pg-modal-head">
                <div class="flex items-center gap-2">
                    <i data-lucide="brain" class="w-4 h-4"></i>
                    <h3>Conocimiento de <span id="pgKnowAgentName">CoffeeIA</span></h3>
                </div>
                <button id="pgKnowClose" class="pg-iconbtn" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>
            </header>

            <div class="pg-modal-tabs">
                <button class="pg-ktab active" data-ktab="prompt"><i data-lucide="file-code-2" class="w-3.5 h-3.5"></i> Prompt del agente</button>
                <button class="pg-ktab" data-ktab="context"><i data-lucide="library" class="w-3.5 h-3.5"></i> Contexto (grimorios)</button>
            </div>

            <div class="pg-modal-body">
                <!-- Tab Prompt -->
                <div id="pgKtabPrompt" class="pg-ktab-panel">
                    <p class="pg-hint">Esta es la "personalidad" del agente. Edítala y prueba al instante; guarda a disco para que el cambio quede en el <code>.md</code>.</p>
                    <textarea id="pgPromptEditor" class="pg-prompt-editor" spellcheck="false"></textarea>
                    <div class="pg-prompt-foot">
                        <span id="pgPromptPath" class="pg-prompt-path">—</span>
                        <div class="flex gap-2">
                            <button id="pgPromptReset" class="cs-btn cs-btn-ghost cs-btn-sm">Revertir</button>
                            <button id="pgPromptSave" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5">
                                <i data-lucide="save" class="w-3.5 h-3.5"></i> Guardar a disco
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Tab Contexto -->
                <div id="pgKtabContext" class="pg-ktab-panel hidden">
                    <p class="pg-hint">Marca los grimorios/archivos que quieres inyectar como contexto del agente en cada pregunta.</p>
                    <div id="pgContextList" class="pg-context-list"></div>
                </div>
            </div>

            <footer class="pg-modal-foot">
                <span id="pgKnowSummary" class="pg-hint">—</span>
                <button id="pgKnowDone" class="cs-btn cs-btn-primary cs-btn-sm">Listo</button>
            </footer>
        </div>
    </div>

    <!-- ── Modal: Guardar plantilla ── -->
    <div id="pgSaveTplModal" class="pg-modal hidden" aria-hidden="true">
        <div class="pg-modal-backdrop"></div>
        <div class="pg-modal-dialog" role="dialog" style="max-width:480px;">
            <header class="pg-modal-head">
                <div class="flex items-center gap-2">
                    <i data-lucide="bookmark-plus" class="w-4 h-4"></i>
                    <h3>Guardar plantilla</h3>
                </div>
                <button id="pgSaveTplClose" class="pg-iconbtn" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>
            </header>
            <div class="pg-modal-body">
                <p class="pg-hint">Se guardará el render actual en <code>documents/template/&lt;nombre&gt;/</code> junto con su tema y la conversación, para reutilizarla más adelante en un chat independiente.</p>
                <label class="pg-hint" style="display:block;margin-bottom:6px;font-weight:600;color:var(--vsr-text-soft);">Nombre de la plantilla</label>
                <input id="pgSaveTplName" type="text" class="pg-prompt-editor" style="height:auto;min-height:0;padding:9px 12px;font-family:inherit;" placeholder="ej. Card de producto" autocomplete="off">
                <p id="pgSaveTplSlug" class="pg-hint" style="margin-top:8px;"></p>
            </div>
            <footer class="pg-modal-foot">
                <span class="pg-hint">El nombre se normaliza para la carpeta.</span>
                <div class="flex gap-2">
                    <button id="pgSaveTplCancel" class="cs-btn cs-btn-ghost cs-btn-sm">Cancelar</button>
                    <button id="pgSaveTplConfirm" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5">
                        <i data-lucide="save" class="w-3.5 h-3.5"></i> Guardar
                    </button>
                </div>
            </footer>
        </div>
    </div>

    <!-- ── Modal: Plantillas guardadas ── -->
    <div id="pgTemplatesModal" class="pg-modal hidden" aria-hidden="true">
        <div class="pg-modal-backdrop"></div>
        <div class="pg-modal-dialog" role="dialog">
            <header class="pg-modal-head">
                <div class="flex items-center gap-2">
                    <i data-lucide="library" class="w-4 h-4"></i>
                    <h3>Plantillas guardadas</h3>
                </div>
                <button id="pgTemplatesClose" class="pg-iconbtn" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>
            </header>
            <div class="pg-modal-body">
                <p class="pg-hint">Carga una plantilla en el sandbox y, si quieres, restaura su conversación para seguir iterándola en un chat independiente.</p>
                <div id="pgTemplatesList" class="pg-tpl-gallery"></div>
            </div>
            <footer class="pg-modal-foot">
                <span id="pgTemplatesSummary" class="pg-hint">—</span>
                <button id="pgTemplatesDone" class="cs-btn cs-btn-primary cs-btn-sm">Cerrar</button>
            </footer>
        </div>
    </div>

    <!-- ── Modal: Hilos de conversación ── -->
    <div id="pgThreadsModal" class="pg-modal hidden" aria-hidden="true">
        <div class="pg-modal-backdrop"></div>
        <div class="pg-modal-dialog" role="dialog" style="max-width:560px;">
            <header class="pg-modal-head">
                <div class="flex items-center gap-2">
                    <i data-lucide="messages-square" class="w-4 h-4"></i>
                    <h3>Hilos de conversación</h3>
                </div>
                <button id="pgThreadsClose" class="pg-iconbtn" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>
            </header>
            <div class="pg-modal-body">
                <div class="pg-threads-bar">
                    <p class="pg-hint" style="margin:0;">Cada hilo guarda su conversación y los renders del sandbox. Ábrelo para seguir iterando donde lo dejaste.</p>
                    <button id="pgThreadsNew" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i> Nuevo hilo
                    </button>
                </div>
                <div id="pgThreadsList" class="pg-threads-list"></div>
            </div>
            <footer class="pg-modal-foot">
                <span id="pgThreadsSummary" class="pg-hint">—</span>
                <button id="pgThreadsDone" class="cs-btn cs-btn-ghost cs-btn-sm">Cerrar</button>
            </footer>
        </div>
    </div>

    <div id="pgToast" class="visor-toast"></div>

    <script src="src/js/playground.js?t=<?php echo time(); ?>"></script>
</body>
</html>
