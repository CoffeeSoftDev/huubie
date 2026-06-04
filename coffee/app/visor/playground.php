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

        <div class="pg-header-right">
            <div class="pg-select-wrap" title="Agente activo">
                <i data-lucide="bot" class="w-4 h-4"></i>
                <select id="pgAgentSelect" class="pg-select"></select>
            </div>

            <div class="pg-select-wrap" title="Sistema de diseño / tema del sandbox">
                <i data-lucide="palette" class="w-4 h-4"></i>
                <select id="pgThemeSelect" class="pg-select">
                    <option value="huubie-ui">Huubie UI (dark)</option>
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
                    <option value="qwen3-coder:480b-cloud">Qwen3 Coder 480B</option>
                    <option value="qwen3-vl:235b-cloud">Qwen3 VL 235B (vision)</option>
                    <option value="qwen3.5:397b-cloud">Qwen 3.5 397B</option>
                    <option value="minimax-m3:cloud">MiniMax M3</option>
                    <option value="kimi-k2.6:cloud">Kimi K2.6</option>
                </optgroup>
                <optgroup label="OpenRouter (free)">
                    <option value="openai/gpt-oss-120b:free">GPT-OSS 120B (free)</option>
                    <option value="z-ai/glm-4.5-air:free">GLM 4.5 Air (free)</option>
                    <option value="google/gemma-4-31b-it:free">Gemma 4 31B (free)</option>
                </optgroup>
            </select>

            <button id="pgThemeToggle" class="theme-toggle" title="Cambiar tema claro/oscuro">
                <i data-lucide="sun" class="w-4 h-4"></i>
            </button>

            <a href="index.php" class="cs-btn cs-btn-ghost cs-btn-sm flex items-center gap-1.5" title="Volver al Visor">
                <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
                Visor
            </a>
        </div>
    </header>

    <div class="pg-workspace">

        <!-- ── Izquierda: chat con el agente ── -->
        <section class="pg-chat">
            <header class="pg-pane-head">
                <div class="pg-pane-title">
                    <i id="pgChatAgentIcon" data-lucide="sparkles" class="w-4 h-4"></i>
                    <span id="pgChatAgentName">CoffeeIA</span>
                </div>
                <button id="pgResetBtn" class="pg-iconbtn" title="Reiniciar conversación">
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
                <input id="pgImageInput" type="file" accept="image/*" multiple style="display:none;">
                <div class="ia-input-hint">
                    <button id="pgAttachBtn" class="ia-attach-btn" title="Adjuntar imagen (también Ctrl+V para pegar)">
                        <i data-lucide="paperclip" class="w-3 h-3"></i>
                    </button>
                    <button id="pgCanvasToggle" class="ia-editor-toggle" title="Activar modo lienzo (la IA generará componentes HTML renderizables)">
                        <i data-lucide="layout-template" class="w-3 h-3"></i>
                        <span>Lienzo</span>
                    </button>
                    <button id="pgClearBtn" title="Limpiar conversación" style="background:transparent;border:none;cursor:pointer;color:var(--vsr-text-mute2);font-size:10px;padding:0;margin-left:auto;">
                        <i data-lucide="trash-2" class="w-3 h-3" style="display:inline-block;vertical-align:middle;margin-right:3px;"></i>
                        Limpiar
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
                </div>
                <div class="pg-sandbox-actions">
                    <span id="pgSandboxTheme" class="pg-theme-chip">Huubie Dark</span>
                    <button id="pgSandboxOpen" class="pg-iconbtn" title="Abrir render en pestaña nueva">
                        <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </header>

            <div class="pg-sandbox-body">
                <iframe id="pgSandboxFrame" class="pg-sandbox-frame" title="Sandbox"></iframe>
                <pre id="pgSandboxCode" class="pg-sandbox-code hidden"><code></code></pre>
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

    <div id="pgToast" class="visor-toast"></div>

    <script src="src/js/playground.js?t=<?php echo time(); ?>"></script>
</body>
</html>
