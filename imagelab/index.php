<?php require_once __DIR__ . '/ctrl/config.php'; ?>
<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ImageLab — harness de imagenes</title>

    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="src/css/app.css?t=<?php echo time(); ?>">

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
</head>

<body class="il-body">

    <header class="il-header">
        <div class="il-header-left">
            <div class="il-logo">IL</div>
            <div class="il-titles">
                <span class="il-title">ImageLab</span>
                <span class="il-subtitle">presign · upload · run · status · cdn</span>
            </div>
        </div>
        <div class="il-header-right">
            <span id="ilLocal" class="il-chip il-chip-muted" title="Servidor local de difusion">local: —</span>
            <span id="ilEngine" class="il-chip il-chip-muted" title="Lo decide el servidor a partir del alias">motor: —</span>
        </div>
    </header>

    <main class="il-main">

        <section class="il-panel il-panel-controls">
            <h2 class="il-panel-title"><i data-lucide="sliders-horizontal" class="w-4 h-4"></i> Orden</h2>

            <div class="il-field">
                <label class="il-label">Operacion</label>
                <div id="ilAliases" class="il-alias-grid"></div>
            </div>

            <div class="il-field" id="ilInputField" hidden>
                <label class="il-label">Imagen de partida</label>
                <div id="ilDrop" class="il-drop">
                    <input type="file" id="ilFile" accept="image/png,image/jpeg,image/webp" hidden>
                    <img id="ilInputPreview" class="il-drop-preview" hidden alt="">
                    <div id="ilDropHint" class="il-drop-hint">
                        <i data-lucide="image-plus" class="w-6 h-6"></i>
                        <span>Arrastra una foto o haz clic</span>
                        <small>png · jpg · webp · hasta 12 MB</small>
                    </div>
                </div>
            </div>

            <div class="il-field">
                <label class="il-label" for="ilPrompt">Instruccion</label>
                <textarea id="ilPrompt" class="il-textarea" rows="4"
                          placeholder="una taza de cafe azul, icono plano, fondo claro"></textarea>
            </div>

            <div class="il-grid-2">
                <div class="il-field">
                    <label class="il-label" for="ilRes">Resolucion</label>
                    <select id="ilRes" class="il-select">
                        <option value="512">512 · rapido</option>
                        <option value="1K" selected>1K · ~1 MP</option>
                        <option value="2K">2K · ~4 MP</option>
                    </select>
                </div>
                <div class="il-field">
                    <label class="il-label" for="ilAr">Aspecto</label>
                    <select id="ilAr" class="il-select">
                        <option value="1:1">1:1</option>
                        <option value="3:4">3:4</option>
                        <option value="4:3">4:3</option>
                        <option value="16:9">16:9</option>
                        <option value="9:16">9:16</option>
                    </select>
                </div>
            </div>

            <div class="il-field">
                <label class="il-label" for="ilFmt">Formato de salida</label>
                <select id="ilFmt" class="il-select">
                    <option value="jpg">jpg</option>
                    <option value="png">png</option>
                    <option value="webp">webp</option>
                </select>
            </div>

            <button id="ilRun" class="il-run">
                <i data-lucide="sparkles" class="w-4 h-4"></i>
                <span>Ejecutar</span>
            </button>

            <p class="il-note">
                El navegador nunca sabe que motor corre: manda un alias
                (<code>m</code>) y el servidor decide.
            </p>
        </section>

        <section class="il-panel il-panel-stage">
            <h2 class="il-panel-title"><i data-lucide="image" class="w-4 h-4"></i> Resultado</h2>
            <div id="ilStage" class="il-stage">
                <div id="ilStageEmpty" class="il-stage-empty">
                    <i data-lucide="scan-search" class="w-8 h-8"></i>
                    <p>Aqui aparece lo que devuelva el pipeline.</p>
                </div>
                <img id="ilResult" class="il-result" hidden alt="Resultado">
            </div>
            <div class="il-stage-foot">
                <span id="ilStatus" class="il-chip il-chip-muted">en espera</span>
                <a id="ilDownload" class="il-chip il-chip-link" hidden download>
                    <i data-lucide="download" class="w-3.5 h-3.5"></i> Descargar
                </a>
            </div>
        </section>

        <section class="il-panel il-panel-trace">
            <h2 class="il-panel-title">
                <i data-lucide="activity" class="w-4 h-4"></i> Traza del pipeline
                <button id="ilClearTrace" class="il-mini-btn" title="Limpiar">
                    <i data-lucide="eraser" class="w-3.5 h-3.5"></i>
                </button>
            </h2>
            <div id="ilTrace" class="il-trace">
                <p class="il-trace-empty">Cada peticion queda registrada aqui, como en la pestana Network.</p>
            </div>
        </section>

    </main>

    <script src="src/js/app.js?t=<?php echo time(); ?>"></script>
</body>
</html>
