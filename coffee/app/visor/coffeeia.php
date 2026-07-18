<?php require_once __DIR__ . '/../ctrl/auth-guard.php'; ?>
<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CoffeeIA — Chat</title>
    <link rel="icon" type="image/x-icon" href="favicon.ico">

    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="src/css/ui-kit.css?t=<?php echo time(); ?>">
    <!-- visor.css es obligatorio: de aqui salen .ia-msg, el loader quantum con sus
         puntos animados, el cerebro de "Razonando...", la card "Conjurando..." y
         el cursor del typewriter. Son las MISMAS animaciones del Visor. -->
    <link rel="stylesheet" href="src/css/visor.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="src/css/coffeeia.css?t=<?php echo time(); ?>">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script src="https://unpkg.com/@viz-js/viz@3.2.4/lib/viz-standalone.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script>
        if (window.mermaid) mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
    </script>
</head>

<body class="cia-root" data-theme="dark">

    <header class="cia-header">
        <div class="cia-header-left">
            <!-- Mostrar/ocultar el panel de conversaciones (patron ChatGPT): en
                 escritorio lo colapsa; en movil lo abre como cajon sobre el chat. -->
            <button id="ciaSidebarToggle" class="cia-iconbtn cia-sb-toggle" title="Mostrar u ocultar conversaciones" aria-label="Conversaciones">
                <i data-lucide="panel-left"></i>
            </button>

            <!-- Marca: la taza y el lockup "Coffee"+"IA" en una sola linea, centrados
                 entre si. El SVG usa fill=currentColor, asi que el color lo pone el
                 contenedor .cia-logo: primer plano (negro en claro, blanco en oscuro). -->
            <div class="cia-brand">
                <div class="cia-logo">
                    <span class="cs-brand-mark cs-brand-lg"><?php include __DIR__ . '/brand-mark.php'; ?></span>
                </div>
                <span class="cia-title">Coffee<span class="cia-title-ia">IA</span></span>
            </div>

            <!-- Reabrir el visor de templates. Solo existe cuando la conversacion
                 ya produjo algun template (lo muestra/oculta el JS). -->
            <button id="ciaViewerBtn" class="cia-iconbtn cia-sb-toggle" title="Mostrar el visor de templates" style="display:none;">
                <i data-lucide="panel-right"></i>
            </button>
        </div>

        <button id="ciaHeaderToggle" class="cia-header-toggle" title="Ajustes">
            <i data-lucide="sliders-horizontal" class="w-4 h-4"></i>
        </button>

        <div class="cia-header-right" id="ciaHeaderRight">
            <div class="cia-select-wrap" title="Agente activo">
                <i data-lucide="bot" class="w-4 h-4"></i>
                <select id="ciaAgentSelect" class="cia-select"></select>
            </div>
            <button id="ciaNewBtn" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5" title="Nueva conversación">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i><span>Nueva</span>
            </button>
            <button id="ciaThemeToggle" class="theme-toggle" title="Cambiar tema claro/oscuro">
                <i data-lucide="sun" class="w-4 h-4"></i>
            </button>
        </div>
    </header>

    <!-- Fondo oscuro del cajon de conversaciones (solo movil): al tocarlo, se cierra. -->
    <div id="ciaSidebarBackdrop" class="cia-sidebar-backdrop"></div>

    <div class="cia-workspace is-sb-open">

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
                <a href="coffeeia.php" class="app-rail-item active" title="CoffeeIA — Chat">
                    <i data-lucide="sparkles"></i>
                    <span class="app-rail-label">CoffeeIA</span>
                </a>
                <a href="documents-admin.php" class="app-rail-item" title="Admin de Documentos">
                    <i data-lucide="folder-cog"></i>
                    <span class="app-rail-label">Admin</span>
                </a>
            </div>
            <button id="accountBtn" class="app-rail-account" type="button" title="Cuenta y configuración">
                <span class="account-avatar">CD</span>
            </button>
        </nav>

        <aside class="cia-sidebar">
            <!-- Handle para redimensionar arrastrando el borde derecho (mismo patron
                 que el sidebar del Visor). Doble clic = vuelve al ancho por defecto. -->
            <div id="ciaSidebarResize" class="cia-sidebar-resize" title="Arrastra para redimensionar (doble clic: restablecer)"></div>

            <!-- Conversacion abierta + sus acciones. Vive AQUI (no sobre el chat):
                 el panel del chat queda limpio, solo mensajes y composer. -->
            <header class="cia-pane-head">
                <div class="cia-pane-title">
                    <i data-lucide="message-circle"></i>
                    <span id="ciaCurrentTitle">Nueva conversación</span>
                </div>
                <div class="cia-pane-actions">
                    <button id="ciaRenameBtn" class="cia-iconbtn" title="Renombrar">
                        <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                    </button>
                    <button id="ciaSaveBtn" class="cia-iconbtn" title="Guardar ahora (también se guarda sola)">
                        <i data-lucide="save" class="w-3.5 h-3.5"></i>
                    </button>
                    <button id="ciaDownloadBtn" class="cia-iconbtn" title="Descargar .md">
                        <i data-lucide="download" class="w-3.5 h-3.5"></i>
                    </button>
                    <button id="ciaDeleteBtn" class="cia-iconbtn is-danger" title="Eliminar">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </header>

            <div class="cia-sidebar-head">
                <input id="ciaSearchInput" type="text" class="cs-input" placeholder="Buscar conversaciones…">
                <button id="ciaNewSidebarBtn" class="cs-btn cs-btn-outline cs-btn-sm" title="Nueva conversación">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                </button>
            </div>
            <div class="cia-sidebar-body cs-scroll">
                <div class="cia-sidebar-group" data-group="today" style="display:none;">
                    <h4>Hoy</h4><ul></ul>
                </div>
                <div class="cia-sidebar-group" data-group="yesterday" style="display:none;">
                    <h4>Ayer</h4><ul></ul>
                </div>
                <div class="cia-sidebar-group" data-group="week" style="display:none;">
                    <h4>Esta semana</h4><ul></ul>
                </div>
                <div class="cia-sidebar-group" data-group="older" style="display:none;">
                    <h4>Más antiguos</h4><ul></ul>
                </div>
                <div id="ciaSidebarEmpty" class="cia-sidebar-empty">
                    <i data-lucide="message-square-dashed" class="w-8 h-8"></i>
                    <div>Aún no hay conversaciones.</div>
                    <div class="cia-sidebar-empty-hint">Escribe y se guarda sola.</div>
                </div>
            </div>
        </aside>

        <main class="cia-main">
            <!-- Sin barra de titulo: las acciones de la conversacion viven en el
                 panel izquierdo. Aqui solo hay mensajes y composer.

                 .ia-drawer-body: MISMO contenedor de mensajes que el Visor (flex column,
                 gap 22px, scroll propio). Dentro van .ia-msg / .ia-typing-msg. -->
            <div id="ciaBody" class="ia-drawer-body cia-body"></div>

            <div class="ia-drawer-input cia-composer">
                <button id="ciaScrollDownBtn" class="ia-scrolldown-btn" title="Bajar al final" style="display:none;">
                    <i data-lucide="arrow-down" class="w-4 h-4"></i>
                </button>

                <!-- Chips de conexion pegajosa (base y carpeta), gemelos de Visor/Lab. -->
                <div id="ciaDbChip" class="ia-db-chip" style="display:none;"></div>
                <div id="ciaFolderChip" class="ia-db-chip ia-folder-chip" style="display:none;"></div>
                <div id="ciaImageStrip" class="ia-image-strip" style="display:none;"></div>

                <!-- Menu de menciones "@": elegir base de datos o carpeta y conectarla.
                     Se posiciona fixed sobre el input desde el JS. -->
                <div id="ciaMentionMenu" class="cia-mention-menu" style="display:none;"></div>

                <input id="ciaFileInput" type="file" multiple hidden>

                <!-- La CAJA del chat: el texto arriba y, dentro de la misma caja, la barra
                     de controles abajo (+ · modelo · enviar), como en Claude. -->
                <div class="ia-input-wrap cia-inputbox">
                    <textarea id="ciaInput" class="ia-input-textarea" rows="1"
                        placeholder="Pregunta lo que quieras…  (@ para conectar una base o carpeta · Enter envía)"></textarea>

                    <div class="cia-inputbar">
                    <!-- Todas las herramientas viven detras de un unico "+" (patron Claude):
                         adjuntar, lienzo, graficas y tools de datos. El menu se posiciona
                         fixed desde el JS para que la caja no lo recorte. -->
                    <button id="ciaPlusBtn" class="cia-plus-btn" title="Herramientas y adjuntos" aria-haspopup="true" aria-expanded="false">
                        <i data-lucide="plus"></i>
                    </button>

                    <div id="ciaPlusMenu" class="cia-menu" style="display:none;" role="menu">
                        <button type="button" class="cia-menu-item" data-act="attach" role="menuitem">
                            <i data-lucide="paperclip"></i>
                            <span class="cia-menu-label">Añadir archivos o fotos</span>
                            <span class="cia-menu-kbd">Ctrl+U</span>
                        </button>

                        <div class="cia-menu-sep"></div>

                        <button type="button" class="cia-menu-item" data-act="canvas" role="menuitemcheckbox">
                            <i data-lucide="layout-template"></i>
                            <span class="cia-menu-label">
                                Modo lienzo
                                <span class="cia-menu-desc">La IA genera componentes HTML</span>
                            </span>
                            <i data-lucide="check" class="cia-menu-check"></i>
                        </button>

                        <div class="cia-menu-item has-sub" data-sub="graph" role="menuitem" tabindex="0">
                            <i data-lucide="feather"></i>
                            <span class="cia-menu-label">
                                Gráficas
                                <span class="cia-menu-desc" id="ciaGraphDesc">Mermaid · draw.io · Excalidraw</span>
                            </span>
                            <i data-lucide="chevron-right" class="cia-menu-chev"></i>

                            <div class="cia-submenu" id="ciaGraphSub">
                                <button type="button" class="cia-menu-item" data-graph="mermaid" role="menuitemcheckbox">
                                    <i data-lucide="git-graph"></i>
                                    <span class="cia-menu-label">
                                        Mermaid
                                        <span class="cia-menu-desc">Diagrama desde texto</span>
                                    </span>
                                    <i data-lucide="check" class="cia-menu-check"></i>
                                </button>
                                <button type="button" class="cia-menu-item" data-graph="drawio" role="menuitemcheckbox">
                                    <i data-lucide="pen-tool"></i>
                                    <span class="cia-menu-label">
                                        draw.io
                                        <span class="cia-menu-desc">Lienzo de diagramas</span>
                                    </span>
                                    <i data-lucide="check" class="cia-menu-check"></i>
                                </button>
                                <button type="button" class="cia-menu-item" data-graph="excalidraw" role="menuitemcheckbox">
                                    <i data-lucide="pencil-ruler"></i>
                                    <span class="cia-menu-label">
                                        Excalidraw
                                        <span class="cia-menu-desc">Boceto a mano alzada</span>
                                    </span>
                                    <i data-lucide="check" class="cia-menu-check"></i>
                                </button>
                            </div>
                        </div>

                        <div class="cia-menu-sep"></div>

                        <button type="button" class="cia-menu-item" data-act="db" role="menuitemcheckbox">
                            <i data-lucide="database"></i>
                            <span class="cia-menu-label">
                                Base de datos
                                <span class="cia-menu-desc">Consulta datos reales (@ para elegirla)</span>
                            </span>
                            <i data-lucide="check" class="cia-menu-check"></i>
                        </button>
                        <button type="button" class="cia-menu-item" data-act="fs" role="menuitemcheckbox">
                            <i data-lucide="folder-search"></i>
                            <span class="cia-menu-label">
                                Archivos
                                <span class="cia-menu-desc">Lee una carpeta local (@ para elegirla)</span>
                            </span>
                            <i data-lucide="check" class="cia-menu-check"></i>
                        </button>
                    </div>

                    <span id="ciaContextInfo" class="cia-context-info"></span>
                    <span class="cia-spacer"></span>
                    <span id="ciaStatusInfo" class="cia-status">Listo</span>
                    <select id="ciaEffortSelect" class="ia-model-pill" title="Esfuerzo de razonamiento (solo modelos con thinking)">
                        <option value="">Esfuerzo: Auto</option>
                        <option value="off">Esfuerzo: Rapido (sin razonar)</option>
                        <option value="low">Esfuerzo: Bajo</option>
                        <option value="medium">Esfuerzo: Medio</option>
                        <option value="high">Esfuerzo: Alto</option>
                        <option value="max">Esfuerzo: Maximo</option>
                    </select>
                    <select id="ciaModelSelect" class="ia-model-pill" title="Modelo activo"></select>

                    <!-- Enviar: ya no flota sobre el textarea, vive en la barra. -->
                    <button id="ciaSendBtn" class="ia-send-btn" title="Enviar (Enter)">
                        <i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>
                    </button>
                    </div><!-- /.cia-inputbar -->
                </div><!-- /.cia-inputbox -->
            </div>
        </main>

        <!-- Visor de templates (patron Artifacts). Es UNA sola pieza de markup:
             en escritorio el CSS la pinta como panel a la DERECHA (y el chat le
             cede ancho); en movil, como VENTANA FLOTANTE sobre el chat. El JS no
             sabe de la diferencia: solo abre y cierra. -->
        <aside id="ciaViewer" class="cia-viewer" aria-hidden="true">
            <!-- Ancho ajustable arrastrando el borde izquierdo (gemelo del sidebar). -->
            <div id="ciaViewerResize" class="cia-viewer-resize" title="Arrastra para redimensionar (doble clic: restablecer)"></div>

            <header class="cia-viewer-head">
                <div class="cia-viewer-title">
                    <i data-lucide="layout-template"></i>
                    <span id="ciaViewerName">Componente</span>
                </div>
                <div class="cia-viewer-actions">
                    <!-- Historial de versiones: cada template nuevo de la conversacion
                         es una version; asi se puede volver a la anterior. -->
                    <div id="ciaViewerVersions" class="cia-viewer-versions" style="display:none;">
                        <button id="ciaViewerPrev" class="cia-iconbtn" title="Versión anterior">
                            <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
                        </button>
                        <span id="ciaViewerVer">1/1</span>
                        <button id="ciaViewerNext" class="cia-iconbtn" title="Versión siguiente">
                            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <button id="ciaViewerMax" class="cia-iconbtn" title="Maximizar">
                        <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
                    </button>
                    <button id="ciaViewerClose" class="cia-iconbtn" title="Cerrar (Esc)">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </header>

            <div class="cia-viewer-bar">
                <span class="cia-viewer-tabs">
                    <button class="cia-viewer-tab is-active" data-tab="preview">Vista previa</button>
                    <button class="cia-viewer-tab" data-tab="code">Código</button>
                </span>
                <span class="cia-spacer"></span>
                <button id="ciaViewerReload" class="cia-iconbtn" title="Recargar la vista previa">
                    <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                </button>
                <button id="ciaViewerNewTab" class="cia-iconbtn" title="Abrir en otra pestaña">
                    <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                </button>
                <button id="ciaViewerCopy" class="cia-iconbtn" title="Copiar el HTML">
                    <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                </button>
                <button id="ciaViewerDownload" class="cia-iconbtn" title="Descargar .html">
                    <i data-lucide="download" class="w-3.5 h-3.5"></i>
                </button>
            </div>

            <div class="cia-viewer-body">
                <iframe id="ciaViewerFrame" class="cia-viewer-frame" sandbox="allow-scripts"></iframe>
                <pre id="ciaViewerCode" class="cia-viewer-code cs-scroll" style="display:none;"><code class="language-html"></code></pre>
            </div>
        </aside>
    </div>

    <div id="ciaRenameModal" class="pg-modal hidden" aria-hidden="true">
        <div id="ciaRenameBackdrop" class="pg-modal-backdrop"></div>
        <div class="pg-modal-dialog cia-modal-dialog" role="dialog">
            <header class="pg-modal-head">
                <div class="flex items-center gap-2">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                    <h3>Renombrar conversación</h3>
                </div>
                <button id="ciaRenameCancel" class="cia-iconbtn" title="Cerrar">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </header>
            <div class="pg-modal-body cia-modal-body">
                <div class="cia-modal-field">
                    <label for="ciaRenameInput">Título</label>
                    <input id="ciaRenameInput" type="text" class="cia-modal-input" placeholder="Ej. Consulta sobre mermas">
                </div>
            </div>
            <footer class="pg-modal-foot cia-modal-foot">
                <span class="pg-hint">El cambio se guarda solo.</span>
                <div class="flex gap-2">
                    <button id="ciaRenameCancel2" class="cs-btn cs-btn-ghost cs-btn-sm">Cancelar</button>
                    <button id="ciaRenameSave" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5">
                        <i data-lucide="check" class="w-3.5 h-3.5"></i> Guardar título
                    </button>
                </div>
            </footer>
        </div>
    </div>

    <div id="ciaDeleteModal" class="pg-modal hidden" aria-hidden="true">
        <div id="ciaDeleteBackdrop" class="pg-modal-backdrop"></div>
        <div class="pg-modal-dialog cia-modal-dialog" role="dialog">
            <header class="pg-modal-head">
                <div class="flex items-center gap-2">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                    <h3>Eliminar conversación</h3>
                </div>
                <button id="ciaDeleteCancel" class="cia-iconbtn" title="Cerrar">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </header>
            <div class="pg-modal-body cia-modal-body">
                <p id="ciaDeleteText" class="pg-hint" style="margin:0;font-size:13px;">Vas a eliminar esta conversación.</p>
            </div>
            <footer class="pg-modal-foot cia-modal-foot">
                <span class="pg-hint">Se borrará de las conversaciones guardadas.</span>
                <div class="flex gap-2">
                    <button id="ciaDeleteCancel2" class="cs-btn cs-btn-ghost cs-btn-sm">Cancelar</button>
                    <button id="ciaDeleteConfirm" class="cs-btn cs-btn-sm flex items-center gap-1.5" style="background:var(--vsr-accent);color:#fff;">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Eliminar
                    </button>
                </div>
            </footer>
        </div>
    </div>

    <div id="ciaToast" class="visor-toast"></div>

    <!-- coffeeSoft.js: de aqui sale Templates.loader({type:'quantum'}), el loader
         REAL del Visor. Sin el, el indicador seria una imitacion (era el defecto
         del chat anterior). -->
    <script src="../src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/ia-render.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/prefs-store.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/model-config.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/coffeeia.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/account-menu.js?t=<?php echo time(); ?>"></script>
</body>
</html>
