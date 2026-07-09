<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Forge — Fábrica de Módulos · CoffeeSoft</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="src/css/ui-kit.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/visor.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/playground.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/forge.css?t=<?php echo time(); ?>">

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
            <div class="pg-logo">FG</div>
            <div class="flex flex-col leading-tight">
                <span class="pg-title">Forge — Fábrica de Módulos</span>
                <span class="pg-subtitle">Tus agentes generan módulos CoffeeSoft y los materializan a disco</span>
            </div>
        </div>

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
                    <option value="qwen3-coder:480b-cloud">Qwen3 Coder 480B (código · módulos ⭐)</option>
                    <option value="glm-5.2:cloud">GLM 5.2 (código)</option>
                    <option value="glm-5:cloud">GLM 5 (flagship)</option>
                    <option value="glm-5.1:cloud">GLM 5.1 (código)</option>
                    <option value="glm-4.7:cloud">GLM 4.7 (código)</option>
                    <option value="qwen3-coder-next:cloud">Qwen3 Coder Next (código)</option>
                    <option value="deepseek-v4-pro:cloud">DeepSeek V4 Pro (razonamiento)</option>
                    <option value="deepseek-v4-flash:cloud">DeepSeek V4 Flash (razonamiento rápido)</option>
                    <option value="gpt-oss:120b-cloud">GPT-OSS 120B (razonamiento)</option>
                    <option value="kimi-k2.7-code:cloud">Kimi K2.7 Code (código · vision)</option>
                    <option value="kimi-k2.6:cloud">Kimi K2.6 (agéntico · vision)</option>
                    <option value="kimi-k2.5:cloud">Kimi K2.5 (agéntico · vision)</option>
                    <option value="gemma4:31b-cloud">Gemma4 31B (vision)</option>
                    <option value="gemini-3-flash-preview:cloud">Gemini 3 Flash (rápido · vision)</option>
                    <option value="minimax-m3:cloud">MiniMax M3 (vision · débil en módulos)</option>
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

    <!-- Barra de hilos: cada hilo es una sesión completa (chat + sandbox + módulo) -->
    <div class="fg-threadbar">
        <div id="fgThreads" class="fg-threads"></div>
        <button id="fgNewThreadBtn" class="fg-thread-new" title="Nuevo hilo (sesión independiente)">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i> Nuevo hilo
        </button>
    </div>

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
                <a href="playground.php" class="app-rail-item" title="Playground de Agentes">
                    <i data-lucide="flask-conical"></i>
                    <span class="app-rail-label">Lab</span>
                </a>
                <a href="studio.php" class="app-rail-item" title="Coffee Studio - Templates multi-archivo">
                    <i data-lucide="clapperboard"></i>
                    <span class="app-rail-label">Studio</span>
                </a>
<a href="forge.php" class="app-rail-item active" title="Forge — Fábrica de Módulos">
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
                    <button id="pgThreadChip" title="Hilo activo — clic para ver todos los hilos" style="display:none;align-items:center;gap:4px;margin-left:8px;padding:2px 8px;border-radius:999px;border:1px solid var(--vsr-border,#374151);background:transparent;color:var(--vsr-accent-soft,#93c5fd);font-size:10px;cursor:pointer;max-width:180px;">
                        <i data-lucide="git-branch" class="w-3 h-3" style="flex:0 0 auto;"></i>
                        <span id="pgThreadName" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Hilo</span>
                        <span id="pgThreadState" style="opacity:.7;flex:0 0 auto;"></span>
                    </button>
                </div>
                <button id="pgResetBtn" class="pg-iconbtn" title="Nuevo hilo (reinicia la conversación)">
                    <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                </button>
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
                    <button id="pgLiveToggle" class="ia-editor-toggle" title="Abre un módulo en Live (📂) y actívalo para que el agente lo vea">
                        <i data-lucide="radio" class="w-3 h-3"></i>
                        <span>Live</span>
                    </button>
                    <button id="pgLiveShotBtn" class="ia-attach-btn" title="Capturar el Live como imagen y adjuntarlo al chat (para modelos con visión)">
                        <i data-lucide="camera" class="w-3 h-3"></i>
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
                    <button class="pg-tab" data-sbtab="live" id="fgLiveTab">
                        <i data-lucide="radio" class="w-3.5 h-3.5"></i> Live
                        <span id="fgLiveDot" class="fg-live-dot" style="display:none;"></span>
                    </button>
                    <button class="pg-tab active" data-sbtab="preview">
                        <i data-lucide="eye" class="w-3.5 h-3.5"></i> Preview
                    </button>
                    <button class="pg-tab" data-sbtab="code">
                        <i data-lucide="code-2" class="w-3.5 h-3.5"></i> Código
                    </button>
                    <button class="pg-tab" data-sbtab="module" id="fgModuleTab">
                        <i data-lucide="package" class="w-3.5 h-3.5"></i> Módulo
                        <span id="fgModuleCount" class="pg-count" style="display:none;">0</span>
                    </button>
                </div>
                <div class="pg-sandbox-actions">
                    <div class="pg-zoom" title="Zoom del preview">
                        <button id="pgZoomOut" class="pg-iconbtn" title="Alejar"><i data-lucide="minus" class="w-3.5 h-3.5"></i></button>
                        <button id="pgZoomLabel" class="pg-zoom-label" title="Restablecer a 100%">100%</button>
                        <button id="pgZoomIn" class="pg-iconbtn" title="Acercar"><i data-lucide="plus" class="w-3.5 h-3.5"></i></button>
                    </div>

                    <!-- Viewport del preview/live: ancho fijo móvil/laptop o completo. -->
                    <div class="pg-viewport" title="Ancho de la vista">
                        <button class="pg-vp-btn" data-vp="mobile" title="Vista móvil (390 px)"><i data-lucide="smartphone" class="w-3.5 h-3.5"></i></button>
                        <button class="pg-vp-btn" data-vp="laptop" title="Vista laptop (1280 px)"><i data-lucide="laptop" class="w-3.5 h-3.5"></i></button>
                        <button class="pg-vp-btn is-active" data-vp="full" title="Ancho completo (desktop)"><i data-lucide="monitor" class="w-3.5 h-3.5"></i></button>
                    </div>

                    <span id="pgSandboxTheme" class="pg-theme-chip">Huubie Dark</span>

                    <!-- Acciones secundarias agrupadas en un menú "puntitos" (kebab) -->
                    <div id="pgMoreWrap" class="pg-more">
                        <button id="pgMoreBtn" class="pg-iconbtn" title="Más acciones" aria-haspopup="true" aria-expanded="false">
                            <i data-lucide="more-vertical" class="w-3.5 h-3.5"></i>
                        </button>
                        <div id="pgMoreMenu" class="pg-more-menu hidden" role="menu">
                            <button id="fgOpenModuleBtn" class="pg-more-item" role="menuitem" title="Abrir un módulo existente (con sus datos reales) para mejorarlo">
                                <i data-lucide="folder-open" class="w-4 h-4"></i> Abrir módulo existente
                            </button>
                            <button id="fgRecreateBtn" class="pg-more-item" role="menuitem" title="Copiar el módulo completo del Live al chat del agente">
                                <i data-lucide="copy-plus" class="w-4 h-4"></i> Recrear módulo (Live → chat)
                            </button>
                            <button id="fgModTplBtn" class="pg-more-item" role="menuitem" title="Copias reales de módulos (index/ctrl/mdl/src) listas para aplicar a un proyecto">
                                <i data-lucide="package" class="w-4 h-4"></i> Templates de módulo
                            </button>
                            <div class="pg-more-sep"></div>
                            <button id="pgTemplatesBtn" class="pg-more-item" role="menuitem" title="Hilos guardados">
                                <i data-lucide="library" class="w-4 h-4"></i> Hilos guardados
                            </button>
                            <button id="pgSaveTplBtn" class="pg-more-item" role="menuitem" title="Guardar como plantilla reutilizable">
                                <i data-lucide="bookmark-plus" class="w-4 h-4"></i> Guardar como plantilla
                            </button>
                            <div class="pg-more-sep"></div>
                            <button id="pgSandboxDownload" class="pg-more-item" role="menuitem" title="Descargar HTML">
                                <i data-lucide="download" class="w-4 h-4"></i> Descargar HTML
                            </button>
                            <button id="pgSandboxOpen" class="pg-more-item" role="menuitem" title="Abrir render en pestaña nueva">
                                <i data-lucide="external-link" class="w-4 h-4"></i> Abrir en pestaña nueva
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div class="pg-sandbox-body">
                <!-- Mini-navegador del Live: atrás/adelante/recargar/inicio + barra de
                     direcciones para moverte entre secciones del módulo real. Solo se
                     muestra en la vista Live y a ancho completo. -->
                <div id="fgLiveNav" class="fg-live-nav hidden">
                    <div class="fg-nav-actions">
                        <button id="fgNavBack" class="fg-nav-btn" title="Atrás"><i data-lucide="arrow-left" class="w-3.5 h-3.5"></i></button>
                        <button id="fgNavFwd" class="fg-nav-btn" title="Adelante"><i data-lucide="arrow-right" class="w-3.5 h-3.5"></i></button>
                        <button id="fgNavReload" class="fg-nav-btn" title="Recargar"><i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i></button>
                        <button id="fgNavHome" class="fg-nav-btn" title="Volver al módulo abierto"><i data-lucide="home" class="w-3.5 h-3.5"></i></button>
                    </div>
                    <div class="fg-nav-addr">
                        <i data-lucide="globe" class="w-3.5 h-3.5 fg-nav-addr-ic"></i>
                        <input id="fgNavUrl" class="fg-nav-url" spellcheck="false" autocomplete="off" placeholder="URL del módulo…">
                        <span id="fgNavOrigin" class="fg-nav-origin" title="Origen del módulo cargado"></span>
                    </div>
                    <button id="fgNavOpenTab" class="fg-nav-btn" title="Abrir en una pestaña nueva del navegador"><i data-lucide="external-link" class="w-3.5 h-3.5"></i></button>
                </div>
                <!-- Shell de dispositivo (pg-core): invisible (display:contents) salvo en
                     vista móvil, donde dibuja el marco de teléfono alrededor del frame visible. -->
                <div id="pgDeviceShell" class="pg-device-shell">
                    <!-- Preview: los diseños que genera el agente (srcdoc) -->
                    <iframe id="pgSandboxFrame" class="pg-sandbox-frame" title="Preview"></iframe>
                    <!-- Live: el módulo real en línea (src), independiente del preview -->
                    <iframe id="fgLiveFrame" class="pg-sandbox-frame hidden" title="Live"></iframe>
                </div>
                <!-- Banner del modo selección: guía al hacer clic en un componente -->
                <div id="fgRecBanner" class="fg-rec-banner hidden">
                    <i data-lucide="mouse-pointer-click" class="w-4 h-4"></i>
                    <span>Haz clic en el componente del Live que quieres recrear · <strong>Esc</strong> cancela</span>
                </div>
                <!-- Acciones contextuales (solo en vista Live): copiar el módulo completo o
                     entrar al modo selección para recrear un componente concreto. -->
                <div id="fgRecFabWrap" class="fg-rec-fab-wrap hidden">
                    <button id="fgRecFab" class="fg-rec-fab" title="Copiar el módulo COMPLETO (HTML renderizado) al chat del agente">
                        <i data-lucide="copy-plus" class="w-4 h-4"></i> Recrear template
                    </button>
                    <button id="fgRecSelectFab" class="fg-rec-fab fg-rec-fab-alt" title="Seleccionar un componente del Live y recrearlo">
                        <i data-lucide="mouse-pointer-click" class="w-4 h-4"></i> Seleccionar
                    </button>
                </div>
                <div id="fgLiveEmpty" class="pg-empty pg-sandbox-empty hidden">
                    <i data-lucide="radio"></i>
                    <div class="pg-empty-title">Sin módulo en vivo</div>
                    <div class="pg-empty-sub">Pulsa <strong>Abrir módulo existente</strong> (📂) para cargar aquí un módulo real con sus datos. Tus diseños generados viven aparte, en <strong>Preview</strong>.</div>
                </div>
                <pre id="pgSandboxCode" class="pg-sandbox-code hidden"><code></code></pre>
                <!-- Código del módulo multi-archivo: un bloque por archivo, agrupado
                     por carpeta (index/ctrl/mdl/src). Sustituye al <pre> único cuando
                     lo que se muestra es un módulo y no un componente suelto. -->
                <div id="fgModuleCode" class="fg-module-code hidden"></div>

                <!-- ── Panel Módulo: archivos generados + destino + acciones ── -->
                <div id="pgModulePanel" class="fg-module-panel hidden">
                    <div class="fg-module-bar">
                        <div class="fg-module-dest">
                            <label class="fg-module-label"><i data-lucide="folder-tree" class="w-3.5 h-3.5"></i> Proyecto destino</label>
                            <select id="fgProjectSelect" class="pg-select"></select>
                        </div>
                        <div class="fg-module-actions">
                            <button id="fgPreviewBtn" class="cs-btn cs-btn-outline cs-btn-sm flex items-center gap-1.5" title="Comparar contra el proyecto sin escribir">
                                <i data-lucide="git-compare" class="w-3.5 h-3.5"></i> Previsualizar
                            </button>
                            <button id="fgMaterializeBtn" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5" title="Escribir los archivos al proyecto">
                                <i data-lucide="hammer" class="w-3.5 h-3.5"></i> Materializar
                            </button>
                        </div>
                    </div>
                    <div id="fgModuleList" class="fg-module-list"></div>
                </div>

                <div id="pgSandboxEmpty" class="pg-empty pg-sandbox-empty">
                    <i data-lucide="layout-template"></i>
                    <div class="pg-empty-title">Sandbox vacío</div>
                    <div class="pg-empty-sub">Lo que genere el agente se renderizará aquí. Si produce un módulo multi-archivo, aparecerá en la pestaña <strong>Módulo</strong>.</div>
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
                    <h3>Hilos guardados</h3>
                </div>
                <button id="pgTemplatesClose" class="pg-iconbtn" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>
            </header>
            <div class="pg-modal-body">
                <p class="pg-hint">Abre un hilo para retomar su diseño y su conversación: seguirás iterando en ese mismo hilo (autoguardado) sin afectar el proyecto.</p>
                <div id="pgTemplatesList" class="pg-context-list"></div>
            </div>
            <footer class="pg-modal-foot">
                <span id="pgTemplatesSummary" class="pg-hint">—</span>
                <button id="pgTemplatesDone" class="cs-btn cs-btn-primary cs-btn-sm">Cerrar</button>
            </footer>
        </div>
    </div>

    <!-- ── Modal: Previsualizar materialización (diff) ── -->
    <div id="fgPreviewModal" class="pg-modal hidden" aria-hidden="true">
        <div class="pg-modal-backdrop"></div>
        <div class="pg-modal-dialog" role="dialog" style="max-width:880px;">
            <header class="pg-modal-head">
                <div class="flex items-center gap-2">
                    <i data-lucide="git-compare" class="w-4 h-4"></i>
                    <h3>Previsualizar en <span id="fgPreviewProject">—</span></h3>
                </div>
                <button id="fgPreviewClose" class="pg-iconbtn" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>
            </header>
            <div class="pg-modal-body">
                <p class="pg-hint">Revisa qué archivos son <strong>nuevos</strong> y cuáles <strong>sobrescriben</strong> uno existente. Nada se escribe hasta que pulses <strong>Materializar</strong>.</p>
                <div id="fgPreviewList" class="fg-preview-list"></div>
            </div>
            <footer class="pg-modal-foot">
                <span id="fgPreviewSummary" class="pg-hint">—</span>
                <div class="flex gap-2">
                    <button id="fgPreviewCancel" class="cs-btn cs-btn-ghost cs-btn-sm">Cancelar</button>
                    <button id="fgPreviewConfirm" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5">
                        <i data-lucide="hammer" class="w-3.5 h-3.5"></i> Materializar
                    </button>
                </div>
            </footer>
        </div>
    </div>

    <!-- ── Modal: Abrir módulo existente (explorador del proyecto) ── -->
    <div id="fgBrowserModal" class="pg-modal hidden" aria-hidden="true">
        <div class="pg-modal-backdrop"></div>
        <div class="pg-modal-dialog" role="dialog" style="max-width:720px;">
            <header class="pg-modal-head">
                <div class="flex items-center gap-2">
                    <i data-lucide="folder-open" class="w-4 h-4"></i>
                    <h3>Abrir módulo existente</h3>
                </div>
                <button id="fgBrowserClose" class="pg-iconbtn" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>
            </header>
            <div class="pg-modal-body">
                <p class="pg-hint">Navega el proyecto, <strong>abre</strong> un módulo en el sandbox (corre con su backend y datos reales) e <strong>importa</strong> los archivos fuente que quieras que el agente modifique. Luego pídele el cambio y materialízalo con el diff.</p>
                <div class="fg-browser-bar">
                    <div class="pg-select-wrap" title="Proyecto">
                        <i data-lucide="folder-tree" class="w-4 h-4"></i>
                        <select id="fgBrowserProject" class="pg-select"></select>
                    </div>
                    <div id="fgBrowserPath" class="fg-browser-crumbs"></div>
                    <button id="fgCloneHereBtn" class="cs-btn cs-btn-outline cs-btn-sm flex items-center gap-1.5" title="Clonar la carpeta actual como template de módulo (copia real: index/ctrl/mdl/src)">
                        <i data-lucide="package-plus" class="w-3.5 h-3.5"></i> Clonar como template
                    </button>
                </div>
                <div id="fgBrowserList" class="fg-browser-list"></div>

                <!-- Host/base del proyecto: tú decides con qué origen se abren
                     SUS módulos (ej. http://localhost/ERP-GV/). Se guarda por
                     proyecto y manda sobre la detección automática. -->
                <div class="fg-open-row">
                    <i data-lucide="server" class="w-4 h-4 fg-open-ic"></i>
                    <input id="fgProjectBase" class="fg-open-input" placeholder="Host/base del proyecto (ej. http://localhost/ERP-GV/)" spellcheck="false" autocomplete="off">
                    <button id="fgSaveBaseBtn" class="cs-btn cs-btn-primary cs-btn-sm" title="Guardar este host como base del proyecto">Guardar host</button>
                    <button id="fgClearBaseBtn" class="cs-btn cs-btn-outline cs-btn-sm" title="Olvidar host y volver a la detección automática">Auto</button>
                </div>

                <!-- URL de apertura: editable porque muchas apps usan rutas
                     absolutas (ej. /alpha/) y no se sirven bajo /proyecto/. Se
                     prellena al pulsar "Abrir" en un archivo y se recuerda. -->
                <div class="fg-open-row">
                    <i data-lucide="globe" class="w-4 h-4 fg-open-ic"></i>
                    <input id="fgOpenUrl" class="fg-open-input" placeholder="URL del módulo para abrir en el sandbox…" spellcheck="false" autocomplete="off">
                    <button id="fgOpenUrlBtn" class="cs-btn cs-btn-primary cs-btn-sm" title="Abrir esta URL en el sandbox">Abrir URL</button>
                </div>
                <p id="fgBrowserBaseHint" class="pg-hint" style="margin-top:6px;">Si la app usa rutas absolutas (como <code>/alpha/</code>), ajusta aquí la URL con la que abres el módulo en tu navegador. Se recuerda por proyecto.</p>
            </div>
            <footer class="pg-modal-foot">
                <span id="fgBrowserSummary" class="pg-hint">—</span>
                <button id="fgBrowserDone" class="cs-btn cs-btn-primary cs-btn-sm">Cerrar</button>
            </footer>
        </div>
    </div>

    <!-- ── Modal: Templates de módulo (copias reales de módulos) ── -->
    <div id="fgModTplModal" class="pg-modal hidden" aria-hidden="true">
        <div class="pg-modal-backdrop"></div>
        <div class="pg-modal-dialog" role="dialog" style="max-width:780px;">
            <header class="pg-modal-head">
                <div class="flex items-center gap-2">
                    <i data-lucide="package" class="w-4 h-4"></i>
                    <h3>Templates de módulo</h3>
                </div>
                <button id="fgModTplClose" class="pg-iconbtn" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>
            </header>
            <div class="pg-modal-body">
                <p class="pg-hint">Copias <strong>reales</strong> de módulos que ya funcionan, separadas en <code>index</code> · <code>ctrl</code> · <code>mdl</code> · <code>src</code>. Para crear uno: <strong>Abrir módulo existente</strong> (📂) → botón <strong>Template</strong> sobre la carpeta del módulo. <strong>Usar</strong> lo copia al proyecto destino pasando por el preview; si tiene <code>index</code>, se abre en el Live al terminar.</p>
                <div id="fgModTplList" class="fg-mt-list"></div>
            </div>
            <footer class="pg-modal-foot">
                <span id="fgModTplSummary" class="pg-hint">—</span>
                <button id="fgModTplDone" class="cs-btn cs-btn-primary cs-btn-sm">Cerrar</button>
            </footer>
        </div>
    </div>

    <div id="pgToast" class="visor-toast"></div>

    <script src="src/js/pg-core.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/forge.js?t=<?php echo time(); ?>"></script>
</body>
</html>
