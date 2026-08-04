<?php require_once __DIR__ . '/../ctrl/auth-guard.php'; ?>
<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Agentes — CoffeeSoft</title>
    <?php include __DIR__ . "/../partials/pwa-head.php"; ?>
    <link rel="icon" type="image/x-icon" href="favicon.ico">

    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="src/css/ui-kit.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/visor.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/todo-hub.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/drive-hub.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/playground.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/agents.css?t=<?php echo time(); ?>">

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>
</head>

<body class="pg-body-root agt-body" data-theme="dark">

    <header class="pg-header">
        <div class="pg-header-left">
            <div class="pg-logo">CS</div>
            <div class="flex flex-col leading-tight">
                <span class="pg-title">Agentes</span>
                <span class="pg-subtitle">Su prompt, sus reglas y su memoria</span>
            </div>
        </div>

        <button id="agtHeaderToggle" class="pg-header-toggle" title="Ajustes" aria-expanded="false">
            <i data-lucide="sliders-horizontal" class="w-4 h-4"></i>
        </button>

        <div class="pg-header-right" id="agtHeaderRight">
            <button id="agtNewBtn" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i> Nuevo agente
            </button>

            <?php include __DIR__ . '/partials/launcher.php'; ?>

            <button id="agtThemeToggle" class="theme-toggle" title="Cambiar tema claro/oscuro">
                <i data-lucide="sun" class="w-4 h-4"></i>
            </button>
        </div>
    </header>

    <div class="pg-workspace agt-workspace">

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
                <a href="forge.php" class="app-rail-item" title="Forge — Fábrica de Módulos">
                    <i data-lucide="hammer"></i>
                    <span class="app-rail-label">Forge</span>
                </a>
                <a href="agents.php" class="app-rail-item active" title="Agentes — prompt, reglas y memoria">
                    <i data-lucide="bot"></i>
                    <span class="app-rail-label">Agentes</span>
                </a>
                <a href="lab.php" class="app-rail-item" title="Lab — afinar al agente probándolo">
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

        <!-- ── Izquierda: lista de agentes + presupuesto de contexto ── -->
        <aside class="agt-list-pane">
            <header class="agt-pane-head">
                <span class="agt-pane-title">Agentes</span>
                <span id="agtCount" class="pg-count">0</span>
            </header>
            <div id="agtList" class="agt-list"></div>
            <footer id="agtBudget" class="agt-budget"></footer>
        </aside>

        <!-- ── Derecha: ficha del agente ── -->
        <section class="agt-detail">
            <header class="agt-detail-head">
                <div class="agt-detail-id">
                    <span id="agtAvatar" class="agt-avatar">CM</span>
                    <div class="agt-detail-text">
                        <h2 id="agtName">Selecciona un agente</h2>
                        <p id="agtMeta" class="agt-detail-meta">—</p>
                    </div>
                </div>
                <div class="agt-detail-actions">
                    <span id="agtStale" class="agt-stale hidden" title="El archivo .md de origen cambió en disco">
                        <i data-lucide="file-warning" class="w-3.5 h-3.5"></i>
                        archivo actualizado
                        <button id="agtReloadBtn" class="agt-stale-btn">recargar</button>
                    </span>
                    <button id="agtSaveBtn" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5" disabled>
                        <i data-lucide="save" class="w-3.5 h-3.5"></i> Guardar
                    </button>
                </div>
            </header>

            <nav class="agt-tabs" role="tablist">
                <button class="agt-tab active" data-tab="identity" role="tab">
                    <i data-lucide="id-card" class="w-3.5 h-3.5"></i> Identidad
                </button>
                <button class="agt-tab" data-tab="prompt" role="tab">
                    <i data-lucide="scroll-text" class="w-3.5 h-3.5"></i> Prompt
                </button>
                <button class="agt-tab" data-tab="soul" role="tab">
                    <i data-lucide="sparkle" class="w-3.5 h-3.5"></i> Alma
                </button>
                <button class="agt-tab" data-tab="rules" role="tab">
                    <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Reglas
                    <span id="agtRulesCount" class="pg-count">0</span>
                </button>
                <button class="agt-tab" data-tab="memory" role="tab">
                    <i data-lucide="brain" class="w-3.5 h-3.5"></i> Memoria
                    <span id="agtMemCount" class="pg-count">0</span>
                </button>
                <button class="agt-tab" data-tab="tools" role="tab">
                    <i data-lucide="wrench" class="w-3.5 h-3.5"></i> Herramientas
                </button>
            </nav>

            <div class="agt-panes">

                <!-- Identidad -->
                <div class="agt-pane active" data-pane="identity">
                    <div class="agt-form-grid">
                        <label class="agt-field">
                            <span>Nombre</span>
                            <input id="agtFName" type="text" class="cs-input" placeholder="CoffeeMagic">
                        </label>
                        <label class="agt-field">
                            <span>Clave <small>identifica al agente en los chats y en la asignación de herramientas</small></span>
                            <input id="agtFKey" type="text" class="cs-input agt-mono" placeholder="CoffeeMagic.md">
                        </label>
                        <label class="agt-field agt-field-wide">
                            <span>Descripción</span>
                            <input id="agtFDesc" type="text" class="cs-input" placeholder="Templates y UI">
                        </label>
                        <label class="agt-field">
                            <span>Modelo sugerido</span>
                            <input id="agtFModel" type="text" class="cs-input agt-mono" placeholder="glm-5.2:cloud">
                        </label>
                        <label class="agt-field">
                            <span>Tipo de respuesta</span>
                            <select id="agtFRender" class="cs-select">
                                <option value="markdown">Markdown (texto)</option>
                                <option value="html">HTML renderizable</option>
                                <option value="code">Código de módulo</option>
                            </select>
                        </label>
                        <label class="agt-field agt-field-wide">
                            <span>Etiquetas <small>separadas por coma</small></span>
                            <input id="agtFTags" type="text" class="cs-input" placeholder="ui, templates, diseño">
                        </label>
                    </div>

                    <div class="agt-switch-row">
                        <label class="agt-switch">
                            <input id="agtFActive" type="checkbox" checked>
                            <span>Agente activo <small>aparece en los selectores del chat</small></span>
                        </label>
                    </div>

                    <p id="agtSource" class="agt-source"></p>

                    <div class="agt-danger">
                        <button id="agtDeleteBtn" class="cs-btn cs-btn-ghost cs-btn-sm agt-danger-btn">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Eliminar agente
                        </button>
                        <span class="pg-hint">Se borran también sus reglas y sus memorias.</span>
                    </div>
                </div>

                <!-- Prompt -->
                <div class="agt-pane" data-pane="prompt">
                    <div class="agt-editor-head">
                        <span class="pg-hint">Contrato de trabajo del agente. Viaja completo en cada turno.</span>
                        <span id="agtPromptMeter" class="agt-meter">0 tokens</span>
                    </div>
                    <textarea id="agtFPrompt" class="cs-textarea agt-code" spellcheck="false"></textarea>
                </div>

                <!-- Alma -->
                <div class="agt-pane" data-pane="soul">
                    <div class="agt-editor-head">
                        <span class="pg-hint">Personalidad y tono. Se anexa al prompt como <code>## Personalidad</code>.</span>
                        <span id="agtSoulMeter" class="agt-meter">0 tokens</span>
                    </div>
                    <textarea id="agtFSoul" class="cs-textarea agt-code" spellcheck="false"></textarea>
                </div>

                <!-- Reglas -->
                <div class="agt-pane" data-pane="rules">
                    <div class="agt-rules-bar">
                        <p class="pg-hint">
                            Al prompt solo viaja el <b>índice</b>: nombre, descripción y cuándo usar.
                            El agente abre el archivo que necesita con <code>read_rules</code>.
                        </p>
                        <div class="agt-rules-actions">
                            <label class="cs-btn cs-btn-outline cs-btn-sm flex items-center gap-1.5 agt-upload">
                                <i data-lucide="upload" class="w-3.5 h-3.5"></i> Subir .md
                                <input id="agtRuleUpload" type="file" accept=".md,.txt,.markdown" multiple hidden>
                            </label>
                            <button id="agtRuleNew" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5">
                                <i data-lucide="plus" class="w-3.5 h-3.5"></i> Nueva
                            </button>
                        </div>
                    </div>
                    <div id="agtRulesList" class="agt-rules-list"></div>
                    <div id="agtBorrowed" class="agt-borrowed"></div>
                </div>

                <!-- Memoria -->
                <div class="agt-pane" data-pane="memory">
                    <div class="agt-mem-bar">
                        <p class="pg-hint">
                            Hechos que el agente recuerda entre conversaciones contigo.
                            Los guarda solo con <code>save_memory</code>, y aquí puedes sembrarlos o corregirlos.
                        </p>
                        <span id="agtMemMeter" class="agt-meter">0 / 100</span>
                    </div>
                    <div class="agt-mem-add">
                        <input id="agtMemInput" type="text" class="cs-input" maxlength="500"
                               placeholder="Ej: El usuario prefiere iconos lucide, nunca emojis.">
                        <button id="agtMemAdd" class="cs-btn cs-btn-primary cs-btn-sm">Recordar</button>
                    </div>
                    <div id="agtMemList" class="agt-mem-list"></div>
                </div>

                <!-- Herramientas -->
                <div class="agt-pane" data-pane="tools">
                    <div class="agt-switch-row agt-standalone">
                        <label class="agt-switch">
                            <input id="agtFStandalone" type="checkbox">
                            <span>
                                Leer reglas siempre
                                <small>
                                    Sin esto, el agente abre sus reglas cuando ya hay una carpeta o base conectada,
                                    y en los demás chats conserva la respuesta palabra por palabra.
                                    Activarlo le da acceso siempre, a costa de esa escritura en vivo.
                                </small>
                            </span>
                        </label>
                    </div>
                    <p class="pg-hint agt-tools-hint">
                        Marca las herramientas que este agente puede usar. Se guardan al momento.
                        Sin marcar ninguna en un grupo, las hereda todas.
                    </p>
                    <div id="agtToolsList" class="agt-tools-list"></div>
                </div>

            </div>
        </section>
    </div>

    <!-- Editor de una regla ("Pulir") -->
    <div id="agtRuleModal" class="pg-modal hidden" role="dialog" aria-modal="true">
        <div class="pg-modal-backdrop"></div>
        <div class="pg-modal-dialog agt-rule-card">
            <header class="pg-modal-head">
                <div class="agt-modal-title">
                    <i data-lucide="file-text" class="w-4 h-4"></i>
                    <span id="agtRuleTitle">Archivo de reglas</span>
                </div>
                <button id="agtRuleClose" class="pg-iconbtn"><i data-lucide="x" class="w-4 h-4"></i></button>
            </header>

            <nav class="agt-tabs agt-subtabs" role="tablist">
                <button class="agt-tab active" data-rtab="content" role="tab">Contenido</button>
                <button class="agt-tab" data-rtab="usage" role="tab">Cuándo usarla</button>
                <button class="agt-tab" data-rtab="share" role="tab">Compartir</button>
            </nav>

            <div class="pg-modal-body agt-rule-body">
                <div class="agt-rule-pane active" data-rpane="content">
                    <div class="agt-form-grid">
                        <label class="agt-field">
                            <span>Nombre del archivo <small>es lo que pide read_rules</small></span>
                            <input id="agtRName" type="text" class="cs-input agt-mono" placeholder="convenciones.md">
                        </label>
                        <label class="agt-field">
                            <span>Prioridad <small>ordena el índice; las críticas se inyectan enteras si no hay herramientas</small></span>
                            <select id="agtRPriority" class="cs-select">
                                <option value="critical">Crítica</option>
                                <option value="high">Alta</option>
                                <option value="medium" selected>Media</option>
                                <option value="low">Baja</option>
                            </select>
                        </label>
                        <label class="agt-field agt-field-wide">
                            <span>Descripción <small>la lee el agente en el índice para decidir si la abre</small></span>
                            <input id="agtRDesc" type="text" class="cs-input" maxlength="255">
                        </label>
                    </div>
                    <div class="agt-editor-head">
                        <span class="pg-hint">Contenido del archivo (markdown)</span>
                        <span id="agtRMeter" class="agt-meter">0 tokens</span>
                    </div>
                    <textarea id="agtRContent" class="cs-textarea agt-code agt-rule-content" spellcheck="false"></textarea>
                </div>

                <div class="agt-rule-pane" data-rpane="usage">
                    <label class="agt-field agt-field-wide">
                        <span>Cuándo usar este archivo <small>aparece en el índice, después de la descripción</small></span>
                        <textarea id="agtRWhen" class="cs-textarea agt-when" rows="3"
                                  placeholder="al generar UI del producto Huubie (tema dark, clases .cs-*)"></textarea>
                    </label>
                    <label class="agt-field agt-field-wide">
                        <span>Etiquetas <small>separadas por coma</small></span>
                        <input id="agtRTags" type="text" class="cs-input" placeholder="ui, dark, huubie">
                    </label>
                    <div class="agt-switch-row">
                        <label class="agt-switch">
                            <input id="agtRActive" type="checkbox" checked>
                            <span>Archivo activo <small>solo los activos entran al índice y los ve read_rules</small></span>
                        </label>
                    </div>
                </div>

                <div class="agt-rule-pane" data-rpane="share">
                    <p class="pg-hint">
                        El archivo sigue siendo de este agente. Los que marques podrán <b>leerlo</b>:
                        editarlo aquí los actualiza a todos, no se duplica.
                    </p>
                    <div id="agtRShareList" class="agt-share-list"></div>
                </div>
            </div>

            <footer class="pg-modal-foot">
                <button id="agtRuleDelete" class="cs-btn cs-btn-ghost cs-btn-sm agt-danger-btn">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Borrar
                </button>
                <div class="flex items-center gap-2">
                    <button id="agtRuleCancel" class="cs-btn cs-btn-ghost cs-btn-sm">Cancelar</button>
                    <button id="agtRuleSave" class="cs-btn cs-btn-primary cs-btn-sm">Guardar</button>
                </div>
            </footer>
        </div>
    </div>

    <div id="agtToast" class="visor-toast"></div>

    <?php include __DIR__ . '/partials/user-context.php'; ?>
    <script src="src/js/prefs-store.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/tools-config.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/agents.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/launcher.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/todo-hub.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/drive-hub.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/account-menu.js?t=<?php echo time(); ?>"></script>
</body>
</html>
