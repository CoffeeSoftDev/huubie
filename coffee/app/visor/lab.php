<?php require_once __DIR__ . '/../ctrl/auth-guard.php'; ?>
<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lab del Agente — CoffeeSoft</title>
    <?php include __DIR__ . "/../partials/pwa-head.php"; ?>
    <link rel="icon" type="image/x-icon" href="favicon.ico">

    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="src/css/ui-kit.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/visor.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/todo-hub.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/drive-hub.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/playground.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/lab.css?t=<?php echo time(); ?>">

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>
    <link id="hljsTheme" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
</head>

<body class="pg-body-root lab-body" data-theme="dark">

    <header class="pg-header">
        <div class="pg-header-left">
            <div class="pg-logo">CS</div>
            <div class="flex flex-col leading-tight">
                <span class="pg-title">Lab del Agente</span>
                <span class="pg-subtitle">Toca, prueba y guarda</span>
            </div>
        </div>

        <button id="labHeaderToggle" class="pg-header-toggle" title="Ajustes" aria-expanded="false">
            <i data-lucide="sliders-horizontal" class="w-4 h-4"></i>
        </button>

        <div class="pg-header-right" id="labHeaderRight">
            <!-- Anillo de contexto: cuanto del presupuesto del modelo lleva este turno -->
            <div id="labCtxWrap" class="lab-ctx" title="Contexto usado">
                <svg viewBox="0 0 20 20" class="lab-ctx-ring">
                    <circle cx="10" cy="10" r="8" class="lab-ctx-track"></circle>
                    <circle cx="10" cy="10" r="8" id="labCtxFill" class="lab-ctx-fill"></circle>
                </svg>
                <span id="labCtxPct">0%</span>
                <button id="labCompact" class="lab-ctx-btn" title="Compactar la conversación">
                    <i data-lucide="fold-vertical" class="w-3.5 h-3.5"></i>
                </button>
            </div>

            <!-- Sistema de diseño con el que el sandbox envuelve el render. Vive
                 aquí y no en el panel del sandbox porque ese encabezado ya carga
                 pestañas, zoom y viewport, y en el Lab es más estrecho que en el
                 Playground (a su izquierda va el panel de configuración). -->
            <div class="pg-select-wrap lab-sbtheme" title="Sistema de diseño del sandbox">
                <i data-lucide="palette" class="w-4 h-4"></i>
                <select id="labSandboxTheme" class="pg-select">
                    <option value="huubie-ui">Huubie UI (dark)</option>
                    <option value="coffeesoft-light">CoffeeSoft · Arcilla Invernal</option>
                    <option value="coffee-varoch-light">Coffee-Varoch (light)</option>
                    <option value="coffee-varoch-dark">Coffee-Varoch (dark)</option>
                    <option value="free">Libre (sin paleta)</option>
                </select>
            </div>

            <?php include __DIR__ . '/partials/launcher.php'; ?>

            <button id="labThemeToggle" class="theme-toggle" title="Cambiar tema claro/oscuro">
                <i data-lucide="sun" class="w-4 h-4"></i>
            </button>
        </div>
    </header>

    <div class="pg-workspace lab-workspace">

        <nav class="app-rail" aria-label="Modulos">
            <div class="app-rail-nav">
                <a href="index.php" class="app-rail-item" title="Visor de Agentes">
                    <i data-lucide="layout-dashboard"></i>
                    <span class="app-rail-label">Visor</span>
                </a>
                <a href="playground.php" class="app-rail-item" title="Playground de Agentes">
                    <i data-lucide="flask-conical"></i>
                    <span class="app-rail-label">Lab UI</span>
                </a>
                <a href="forge.php" class="app-rail-item" title="Forge — Fábrica de Módulos">
                    <i data-lucide="hammer"></i>
                    <span class="app-rail-label">Forge</span>
                </a>
                <a href="agents.php" class="app-rail-item" title="Agentes — prompt, reglas y memoria">
                    <i data-lucide="bot"></i>
                    <span class="app-rail-label">Agentes</span>
                </a>
                <a href="lab.php" class="app-rail-item active" title="Lab — afinar al agente probándolo">
                    <i data-lucide="microscope"></i>
                    <span class="app-rail-label">Lab</span>
                </a>
                <a href="coffeeia.php" class="app-rail-item" title="CoffeeIA — Chat unificado">
                    <i data-lucide="sparkles"></i>
                    <span class="app-rail-label">CoffeeIA</span>
                </a>
            </div>

            <button id="accountBtn" class="app-rail-account" type="button" title="Cuenta y configuración">
                <span class="account-avatar">CD</span>
            </button>
        </nav>

        <!-- ── Izquierda: la configuración del agente, en vivo ── -->
        <aside id="labConfig" class="lab-config">
            <div class="lab-agent-picker">
                <button id="labAgentBtn" class="lab-agent-btn" title="Cambiar de agente">
                    <span id="labAgentAvatar" class="lab-avatar">—</span>
                    <span id="labAgentLabel" class="lab-agent-label">Cargando…</span>
                    <i data-lucide="chevrons-up-down" class="w-3.5 h-3.5 lab-agent-caret"></i>
                </button>
                <div class="lab-agent-actions">
                    <button id="labRestore" class="lab-hicon hidden" title="Volver a la configuración previa al último guardado">
                        <i data-lucide="history" class="w-4 h-4"></i>
                    </button>
                    <button id="labSave" class="lab-hicon lab-hicon-accent" title="Guardar esta configuración en el agente">
                        <i data-lucide="arrow-up" class="w-4 h-4"></i>
                    </button>
                </div>
                <div id="labAgentMenu" class="lab-agent-menu hidden"></div>
            </div>
            <p id="labSaveMsg" class="lab-save-msg"></p>

            <div class="lab-config-inner">

                <!-- Prompt -->
                <section class="lab-sec" data-sec="prompt">
                    <button class="lab-sec-head" type="button">
                        <span class="lab-sec-badge violet"><i data-lucide="file-text" class="w-3.5 h-3.5"></i></span>
                        <span class="lab-sec-title">Prompt del agente</span>
                        <span class="lab-sec-actions">
                            <span id="labImprovePrompt" class="lab-improve" data-no-toggle title="Reescribir con IA">
                                <i data-lucide="sparkles" class="w-3 h-3"></i> Mejorar
                            </span>
                        </span>
                        <i data-lucide="chevron-down" class="lab-sec-caret w-4 h-4"></i>
                    </button>
                    <div class="lab-sec-body">
                        <div class="lab-ta-wrap">
                            <textarea id="labPrompt" class="lab-ta" spellcheck="false"
                                      placeholder="Rol, objetivo, instrucciones y restricciones del agente…"></textarea>
                            <span class="lab-ta-count">0</span>
                        </div>
                    </div>
                </section>

                <!-- Alma -->
                <section class="lab-sec" data-sec="soul">
                    <button class="lab-sec-head" type="button">
                        <span class="lab-sec-badge pink"><i data-lucide="heart" class="w-3.5 h-3.5"></i></span>
                        <span class="lab-sec-title">Alma / Esencia</span>
                        <span class="lab-sec-actions">
                            <span id="labImproveSoul" class="lab-improve" data-no-toggle title="Reescribir con IA">
                                <i data-lucide="sparkles" class="w-3 h-3"></i> Mejorar
                            </span>
                        </span>
                        <i data-lucide="chevron-down" class="lab-sec-caret w-4 h-4"></i>
                    </button>
                    <div class="lab-sec-body">
                        <div class="lab-ta-wrap">
                            <textarea id="labSoul" class="lab-ta lab-ta-pink" spellcheck="false"
                                      placeholder="Personalidad, tono, manías…"></textarea>
                            <span class="lab-ta-count">0</span>
                        </div>
                        <p class="lab-hint">Se anexa al prompt como <code>## Personalidad</code>: cambias el tono sin tocar las reglas técnicas.</p>
                    </div>
                </section>

                <!-- Modelo -->
                <section class="lab-sec" data-sec="model">
                    <button class="lab-sec-head" type="button">
                        <span class="lab-sec-badge blue"><i data-lucide="cpu" class="w-3.5 h-3.5"></i></span>
                        <span class="lab-sec-title">Modelo</span>
                        <span id="labModelBadge" class="lab-sec-meta">—</span>
                        <i data-lucide="chevron-down" class="lab-sec-caret w-4 h-4"></i>
                    </button>
                    <div class="lab-sec-body">
                        <label class="lab-field">
                            <span>Modelo</span>
                            <select id="labModel" class="cs-select ia-model-pill"></select>
                        </label>
                        <label class="lab-field">
                            <span class="lab-field-row">Temperatura <b id="labTempVal">0.70</b></span>
                            <input id="labTemp" type="range" min="0" max="1" step="0.05" value="0.7" class="lab-range">
                        </label>
                        <div id="labEffortRow" class="lab-field hidden">
                            <span>Esfuerzo de razonamiento</span>
                            <div id="labEffort" class="lab-effort"></div>
                        </div>
                    </div>
                </section>

                <!-- Reglas -->
                <section class="lab-sec" data-sec="rules">
                    <button class="lab-sec-head" type="button">
                        <span class="lab-sec-badge amber"><i data-lucide="book-open" class="w-3.5 h-3.5"></i></span>
                        <span class="lab-sec-title">Reglas</span>
                        <span id="labRulesMeta" class="lab-sec-meta">—</span>
                        <i data-lucide="chevron-down" class="lab-sec-caret w-4 h-4"></i>
                    </button>
                    <div class="lab-sec-body">
                        <p class="lab-hint">
                            Al prompt solo viaja el índice; el agente abre el archivo con <code>read_rules</code>.
                        </p>
                        <div class="lab-rules-actions">
                            <button id="labSplitOpen" class="cs-btn cs-btn-outline cs-btn-sm flex items-center gap-1.5">
                                <i data-lucide="scissors" class="w-3.5 h-3.5"></i> Pegar y dividir
                            </button>
                            <a href="agents.php" class="cs-btn cs-btn-ghost cs-btn-sm flex items-center gap-1.5" title="Editarlas en la pantalla de Agentes">
                                <i data-lucide="external-link" class="w-3.5 h-3.5"></i> Administrar
                            </a>
                        </div>
                        <div id="labRules" class="lab-rules"></div>
                    </div>
                </section>

                <!-- Memoria -->
                <section class="lab-sec" data-sec="memory">
                    <button class="lab-sec-head" type="button">
                        <span class="lab-sec-badge emerald"><i data-lucide="brain" class="w-3.5 h-3.5"></i></span>
                        <span class="lab-sec-title">Memoria</span>
                        <span id="labMemMeta" class="lab-sec-meta">—</span>
                        <i data-lucide="chevron-down" class="lab-sec-caret w-4 h-4"></i>
                    </button>
                    <div class="lab-sec-body">
                        <div class="lab-mem-add">
                            <input id="labMemInput" type="text" class="cs-input" maxlength="500" placeholder="Un hecho que deba recordar…">
                            <button id="labMemAdd" class="cs-btn cs-btn-primary cs-btn-sm">+</button>
                        </div>
                        <div id="labMem" class="lab-mem"></div>
                    </div>
                </section>

                <!-- Herramientas -->
                <section class="lab-sec" data-sec="tools">
                    <button class="lab-sec-head" type="button">
                        <span class="lab-sec-badge indigo"><i data-lucide="wrench" class="w-3.5 h-3.5"></i></span>
                        <span class="lab-sec-title">Herramientas</span>
                        <span id="labToolsMeta" class="lab-sec-meta">0 activas</span>
                        <i data-lucide="chevron-down" class="lab-sec-caret w-4 h-4"></i>
                    </button>
                    <div class="lab-sec-body">
                        <div id="labTools" class="lab-tools"></div>
                    </div>
                </section>

            </div>
        </aside>

        <button id="labRailToggle" class="lab-rail-toggle" title="Contraer el panel">
            <i data-lucide="panel-left-close" class="w-4 h-4"></i>
        </button>

        <!-- ── Derecha: el banco de pruebas ── -->
        <section class="lab-chat">
            <header class="lab-chat-head">
                <div class="lab-chat-title">
                    <span class="pg-brand-mark" aria-hidden="true"><?php include __DIR__ . '/brand-mark.php'; ?></span>
                    <span id="labChatAgent">Agente</span>
                    <span id="labDirty" class="lab-dirty hidden" title="Hay cambios sin guardar en el agente">sin guardar</span>
                </div>
                <div class="lab-chat-actions">
                    <span id="labSpend" class="lab-spend" title="Consumo de esta sesión">—</span>
                    <button id="labSandboxToggle" class="pg-iconbtn" title="Mostrar u ocultar el sandbox">
                        <i data-lucide="layout-template" class="w-3.5 h-3.5"></i>
                    </button>
                    <button id="labReset" class="pg-iconbtn" title="Vaciar la conversación">
                        <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </header>

            <!-- Mismo markup del chat del Visor y el Playground (.pg-chat-body +
                 .ia-msg): asi las burbujas, el markdown y el composer se ven y se
                 comportan igual en las tres pantallas. -->
            <div id="labMessages" class="pg-chat-body"></div>

            <div class="ia-drawer-input">
                <div class="ia-input-wrap">
                    <textarea id="labInput" class="ia-input-textarea" rows="1" placeholder="Prueba a tu agente aquí…"></textarea>
                    <button id="labSend" class="ia-send-btn" title="Enviar (Enter)">
                        <i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
                <div class="ia-input-hint">
                    <button id="labCanvasToggle" class="ia-editor-toggle" title="Activar modo lienzo (la IA generará componentes HTML renderizables)">
                        <i data-lucide="layout-template" class="w-3 h-3"></i>
                        <span>Lienzo</span>
                    </button>
                    <span>La conversación es <b>efímera</b>. Lo que persiste es la configuración cuando pulsas guardar.</span>
                </div>
            </div>
        </section>

        <!-- ── Splitter redimensionable (chat ↔ sandbox) ── -->
        <div id="labSplitter" class="pg-splitter" title="Arrastra para redimensionar"></div>

        <!-- ── Extremo derecho: sandbox de render ──
             Mismo motor que el Playground: los ids pg* (#pgSandboxFrame,
             .pg-sandbox-body, .pg-vp-btn, #pgZoomLabel) son el contrato que
             pg-core.js espera para el viewport y el zoom; renombrarlos aquí
             obligaría a duplicar ese motor. -->
        <section class="pg-sandbox lab-sandbox">
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
                    <div class="pg-zoom" title="Zoom del preview">
                        <button id="pgZoomOut" class="pg-iconbtn" title="Alejar"><i data-lucide="minus" class="w-3.5 h-3.5"></i></button>
                        <button id="pgZoomLabel" class="pg-zoom-label" title="Restablecer a 100%">100%</button>
                        <button id="pgZoomIn" class="pg-iconbtn" title="Acercar"><i data-lucide="plus" class="w-3.5 h-3.5"></i></button>
                    </div>

                    <div class="pg-viewport" title="Ancho del preview">
                        <button class="pg-vp-btn" data-vp="mobile" title="Vista móvil (390 px)"><i data-lucide="smartphone" class="w-3.5 h-3.5"></i></button>
                        <button class="pg-vp-btn" data-vp="laptop" title="Vista laptop (1280 px)"><i data-lucide="laptop" class="w-3.5 h-3.5"></i></button>
                        <button class="pg-vp-btn is-active" data-vp="full" title="Ancho completo"><i data-lucide="monitor" class="w-3.5 h-3.5"></i></button>
                    </div>

                    <div class="pg-actions-menu">
                        <button id="labSbActionsToggle" class="pg-iconbtn pg-actions-toggle" title="Más acciones" aria-expanded="false">
                            <i data-lucide="more-vertical" class="w-3.5 h-3.5"></i>
                        </button>
                        <div class="pg-actions-pop" id="labSbActionsPop">
                            <button id="labSandboxDownload" class="pg-iconbtn pg-actionbtn" title="Descargar HTML">
                                <i data-lucide="download" class="w-3.5 h-3.5"></i>
                                <span class="pg-actionbtn-label">Descargar HTML</span>
                            </button>
                            <button id="labSandboxOpen" class="pg-iconbtn pg-actionbtn" title="Abrir render en pestaña nueva">
                                <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                                <span class="pg-actionbtn-label">Abrir en pestaña</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div class="pg-sandbox-body">
                <!-- sandbox SIN allow-same-origin: el código que genera el agente corre
                     en un origen opaco (no puede leer localStorage ni llamar a los ctrl). -->
                <div id="pgDeviceShell" class="pg-device-shell">
                    <iframe id="pgSandboxFrame" class="pg-sandbox-frame" title="Sandbox"
                            sandbox="allow-scripts allow-forms allow-modals allow-popups"></iframe>
                </div>
                <pre id="pgSandboxCode" class="pg-sandbox-code hidden"><code></code></pre>

                <div id="pgSandboxEmpty" class="pg-empty pg-sandbox-empty">
                    <i data-lucide="layout-template"></i>
                    <div class="pg-empty-title">Sandbox vacío</div>
                    <div class="pg-empty-sub">Lo que genere el agente se renderizará aquí con el tema elegido.</div>
                </div>
            </div>
        </section>
    </div>

    <!-- Pegar y dividir un .md en varios archivos de reglas -->
    <div id="labSplitModal" class="pg-modal hidden" role="dialog" aria-modal="true">
        <div class="pg-modal-backdrop"></div>
        <div class="pg-modal-dialog lab-split-card">
            <header class="pg-modal-head">
                <div class="lab-modal-title">
                    <i data-lucide="scissors" class="w-4 h-4"></i>
                    <span>Dividir en archivos de reglas</span>
                </div>
                <button id="labSplitClose" class="pg-iconbtn"><i data-lucide="x" class="w-4 h-4"></i></button>
            </header>

            <div class="pg-modal-body lab-split-body">
                <p class="lab-hint">
                    <code>read_rules</code> trae el archivo completo o nada: un manual de 40 KB no sirve como archivo único.
                    Pega el documento, elige por qué nivel de encabezado cortarlo y cada sección queda como un archivo
                    que el agente pide por nombre solo cuando le hace falta.
                </p>

                <div class="lab-split-bar">
                    <div class="lab-lvls" role="group" aria-label="Nivel de corte">
                        <span>Cortar en</span>
                        <button class="lab-lvl" data-lvl="1">H1</button>
                        <button class="lab-lvl on" data-lvl="2">H2</button>
                        <button class="lab-lvl" data-lvl="3">H3</button>
                    </div>
                    <div class="lab-split-actions">
                        <span id="labSplitChars" class="lab-meter">0 chars</span>
                        <button id="labSplitPolish" class="cs-btn cs-btn-outline cs-btn-sm flex items-center gap-1.5" title="Reordenar el markdown con IA antes de cortar">
                            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> Ordenar
                        </button>
                        <button id="labSplitScan" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5">
                            <i data-lucide="scan-line" class="w-3.5 h-3.5"></i> Analizar
                        </button>
                    </div>
                </div>

                <textarea id="labSplitText" class="cs-textarea lab-split-text" spellcheck="false"
                          placeholder="Pega aquí el .md, el manual o el system prompt largo…"></textarea>

                <div id="labSplitList" class="lab-split-list"></div>
            </div>

            <footer class="pg-modal-foot">
                <span id="labSplitMsg" class="lab-hint">—</span>
                <div class="flex items-center gap-2">
                    <button id="labSplitCancel" class="cs-btn cs-btn-ghost cs-btn-sm">Cancelar</button>
                    <button id="labSplitCreate" class="cs-btn cs-btn-primary cs-btn-sm" disabled>Crear archivos</button>
                </div>
            </footer>
        </div>
    </div>

    <div id="labToast" class="visor-toast"></div>

    <?php include __DIR__ . '/partials/user-context.php'; ?>
    <script src="src/js/pg-core.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/prefs-store.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/model-config.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/ia-render.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/lab.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/launcher.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/todo-hub.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/drive-hub.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/account-menu.js?t=<?php echo time(); ?>"></script>
</body>
</html>
