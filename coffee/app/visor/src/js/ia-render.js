/* ============================================================
   ia-render.js — Motor de render avanzado de respuestas IA.

   Funciones standalone (sin estado de clase) portadas del drawer
   CoffeeIA del visor para que el Chat con Agentes tenga la misma
   riqueza de render: Mermaid, Graphviz (Viz.js), Chart.js,
   HTML-preview en iframe, diagramas draw.io / bocetos Excalidraw,
   historias de usuario (```stories de CoffeePlanner), modales de
   zoom y normalizadores de salida cruda del modelo.

   Reutiliza las clases .ia-render-* / .ia-*-modal de visor.css, por
   eso cualquier pagina que lo use debe cargar tambien visor.css.

   API publica (objeto global IARender):
     markdownToHtml(text)              -> string HTML (marked + DOMPurify)
     postProcess($msg, opts)          -> convierte bloques de codigo en visores
     normalizeCanvasHtml(text, on)    -> envuelve HTML crudo en ```html
     normalizeDrawioXml(text)         -> envuelve XML crudo en ```drawio
     normalizeExcalidrawJson(text)    -> envuelve JSON crudo en ```excalidraw
     openDiagramInTab(type,name,code) -> abre el lienzo en otra pestania
     storiesToMarkdown(data)          -> tabla Varoch de 8 columnas
     storiesToCsv(data)               -> CSV (BOM UTF-8) para el Excel del equipo
     getTheme() / escape(str)         -> helpers
   ============================================================ */

(function (global) {
    'use strict';

    function escape(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getTheme() {
        const t = (document.documentElement.getAttribute('data-theme') ||
                   document.body.getAttribute('data-theme') || 'dark').toLowerCase();
        return t === 'light' ? 'light' : 'dark';
    }

    function lucide() { if (global.lucide) global.lucide.createIcons(); }

    /* ── Markdown → HTML (marked + saneado DOMPurify) ── */
    function markdownToHtml(text) {
        if (text == null) return '';
        if (typeof marked !== 'undefined' && marked.parse) {
            const raw = marked.parse(String(text), { breaks: true, gfm: true });
            if (typeof DOMPurify !== 'undefined') {
                return DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'class'] });
            }
            return raw;
        }
        return '<p>' + escape(text).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
    }

    /* ── Descargar texto como archivo (sustituye al newFileModal del visor) ── */
    function downloadText(name, content) {
        const blob = new Blob([content || ''], { type: 'text/plain;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = name || ('archivo-' + Date.now() + '.txt');
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
    }

    /* ── Abrir diagrama/boceto en otra pestania (handoff via localStorage) ── */
    function openDiagramInTab(type, name, content) {
        if (!content) return;
        try {
            localStorage.setItem('visor:openDiagram', JSON.stringify({ type, name, content }));
        } catch (e) { return; }
        global.open('index.php?diagram=1&full=1', '_blank');
    }

    /* ── Toggle generico Vista/Codigo de un visor ── */
    function bindCodeToggle($wrap, viewLabelIcon, viewTitle) {
        $wrap.find('.ia-render-toggle').on('click', function () {
            const $btn  = $(this);
            const $src  = $('#' + $btn.data('target'));
            const $view = $wrap.find('.ia-render-view');
            const showCode = $src.is(':hidden');
            $src.toggle(showCode);
            $view.toggle(!showCode);
            $btn.html(showCode
                ? '<i data-lucide="eye" class="w-3 h-3"></i>'
                : '<i data-lucide="code-2" class="w-3 h-3"></i>');
            $btn.attr('title', showCode ? viewTitle : 'Ver codigo');
            lucide();
        });
    }

    /* ── Mermaid ── */
    function renderMermaid($pre, code) {
        if (typeof mermaid === 'undefined') return;
        const id = 'mer-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const $wrap = $(`
            <div class="ia-render-block ia-render-mermaid" data-render-type="mermaid">
                <div class="ia-render-toolbar">
                    <span><i data-lucide="git-graph" class="w-3 h-3"></i>Diagrama Mermaid</span>
                    <span class="ia-render-tabs">
                        <button class="ia-render-btn is-icon ia-render-toggle" data-target="${id}-code" title="Ver codigo">
                            <i data-lucide="code-2" class="w-3 h-3"></i>
                        </button>
                        <button class="ia-render-btn is-icon ia-render-expand" style="display:none;" title="Expandir a pantalla completa">
                            <i data-lucide="maximize-2" class="w-3 h-3"></i>
                        </button>
                    </span>
                </div>
                <div class="ia-render-view" id="${id}-view"></div>
                <pre id="${id}-code" class="ia-render-source" style="display:none;"></pre>
            </div>
        `);
        $wrap.find('.ia-render-source').text(code);
        $wrap.data('mermaid-code', code);
        $pre.replaceWith($wrap);

        const cleanupOrphans = () => {
            $('body > [id^="d' + id + '"], body > [id="' + id + '-svg"]').remove();
            $('body > .mermaidTooltip').remove();
        };

        try {
            mermaid.initialize({
                startOnLoad: false,
                theme: getTheme() === 'light' ? 'default' : 'dark',
                securityLevel: 'strict'
            });
            mermaid.render(id + '-svg', code).then(({ svg }) => {
                $wrap.find('.ia-render-view').html(svg);
                $wrap.data('mermaid-svg', svg);
                $wrap.find('.ia-render-expand').show();
                cleanupOrphans();
            }).catch((err) => {
                cleanupOrphans();
                $wrap.find('.ia-render-view').html(
                    `<div class="ia-render-error"><strong>Error Mermaid:</strong> ${escape(err.message || err)}
                        <div style="margin-top:6px;font-size:11px;opacity:.7;">Pulsa "Codigo" para revisar la fuente.</div>
                    </div>`
                );
            });
        } catch (e) {
            cleanupOrphans();
            $wrap.find('.ia-render-view').html(`<div class="ia-render-error">Error Mermaid: ${escape(e.message || e)}</div>`);
        }

        bindCodeToggle($wrap, 'eye', 'Ver diagrama');
        $wrap.find('.ia-render-expand').on('click', () => {
            const svg = $wrap.data('mermaid-svg') || $wrap.find('.ia-render-view').html();
            openDiagramModal(svg, { title: 'Diagrama Mermaid' });
        });
        lucide();
    }

    /* ── Graphviz (Viz.js / DOT) ── */
    function renderGraphviz($pre, code) {
        if (typeof Viz === 'undefined') {
            $pre.replaceWith($('<div class="ia-render-block ia-render-error">Graphviz (Viz.js) no se cargo.</div>'));
            return;
        }
        const id = 'gv-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const $wrap = $(`
            <div class="ia-render-block ia-render-graphviz" data-render-type="graphviz">
                <div class="ia-render-toolbar">
                    <span><i data-lucide="database" class="w-3 h-3"></i>Diagrama Graphviz</span>
                    <span class="ia-render-tabs">
                        <button class="ia-render-btn is-icon ia-render-toggle" data-target="${id}-code" title="Ver codigo">
                            <i data-lucide="code-2" class="w-3 h-3"></i>
                        </button>
                        <button class="ia-render-btn is-icon ia-render-expand" style="display:none;" title="Expandir a pantalla completa">
                            <i data-lucide="maximize-2" class="w-3 h-3"></i>
                        </button>
                    </span>
                </div>
                <div class="ia-render-view" id="${id}-view"></div>
                <pre id="${id}-code" class="ia-render-source" style="display:none;"></pre>
            </div>
        `);
        $wrap.find('.ia-render-source').text(code);
        $pre.replaceWith($wrap);

        Viz.instance().then((viz) => {
            const svg = viz.renderString(code, { format: 'svg' });
            $wrap.find('.ia-render-view').html(svg);
            $wrap.data('graphviz-svg', svg);
            $wrap.find('.ia-render-expand').show();
        }).catch((err) => {
            $wrap.find('.ia-render-view').html(
                `<div class="ia-render-error"><strong>Error Graphviz:</strong> ${escape(err && err.message ? err.message : err)}
                    <div style="margin-top:6px;font-size:11px;opacity:.7;">Revisa la sintaxis DOT pulsando "Codigo".</div>
                </div>`
            );
        });

        bindCodeToggle($wrap, 'eye', 'Ver diagrama');
        $wrap.find('.ia-render-expand').on('click', () => {
            const svg = $wrap.data('graphviz-svg') || $wrap.find('.ia-render-view').html();
            openDiagramModal(svg, { title: 'Diagrama Graphviz', canvasBg: '#ffffff' });
        });
        lucide();
    }

    /* ── Chart.js ── */
    function renderChart($pre, code) {
        if (typeof Chart === 'undefined') return;
        let config;
        try { config = JSON.parse(code); }
        catch (e) {
            $pre.replaceWith($(`<div class="ia-render-block ia-render-error">JSON invalido en bloque chart: ${escape(e.message)}</div>`));
            return;
        }
        const id = 'cht-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const $wrap = $(`
            <div class="ia-render-block ia-render-chart" data-render-type="chart">
                <div class="ia-render-toolbar">
                    <span><i data-lucide="bar-chart-3" class="w-3 h-3"></i>Grafico</span>
                    <button class="ia-render-btn ia-render-toggle" data-target="${id}-code">
                        <i data-lucide="code-2" class="w-3 h-3"></i>JSON
                    </button>
                </div>
                <div class="ia-render-view"><canvas id="${id}-canvas"></canvas></div>
                <pre id="${id}-code" class="ia-render-source" style="display:none;"></pre>
            </div>
        `);
        $wrap.find('.ia-render-source').text(code);
        $pre.replaceWith($wrap);

        try {
            const ctx = document.getElementById(id + '-canvas').getContext('2d');
            new Chart(ctx, config);
        } catch (e) {
            $wrap.find('.ia-render-view').html(`<div class="ia-render-error">Error Chart.js: ${escape(e.message || e)}</div>`);
        }

        $wrap.find('.ia-render-toggle').on('click', function () {
            const $btn = $(this);
            const $src = $('#' + $btn.data('target'));
            const $view = $wrap.find('.ia-render-view');
            const showCode = $src.is(':hidden');
            $src.toggle(showCode);
            $view.toggle(!showCode);
            $btn.html(showCode
                ? '<i data-lucide="bar-chart-3" class="w-3 h-3"></i>Grafico'
                : '<i data-lucide="code-2" class="w-3 h-3"></i>JSON');
            lucide();
        });
        lucide();
    }

    /* ── Documento del preview HTML (el srcdoc del iframe) ──
       Lo usan el visor inline de aqui y el panel de templates de CoffeeIA: un
       solo sitio donde viven el saneado, el tema y las libs del sandbox. ── */
    function buildHtmlSrcdoc(code, opts) {
        opts = opts || {};
        const safeCode = (typeof DOMPurify !== 'undefined')
            ? DOMPurify.sanitize(code, { ADD_TAGS: ['svg', 'path', 'use'], ADD_ATTR: ['data-lucide'] })
            : code;
        const isDark = getTheme() === 'dark';
        const bg = isDark ? '#0F172A' : '#FFFFFF';
        const fg = isDark ? '#E2E8F0' : '#1F2937';
        const pad = opts.padding != null ? opts.padding : 8;
        const uiKitHref = new URL('src/css/ui-kit.css', document.baseURI).href;
        return `<!doctype html><html data-theme="${isDark ? 'dark' : 'light'}"><head><meta charset="utf-8">
            <script src="https://cdn.tailwindcss.com"><\/script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="${uiKitHref}">
            <script src="https://unpkg.com/lucide@latest"><\/script>
            <style>html,body{margin:0;padding:0;}body{padding:${pad}px;background:${bg};color:${fg};font-family:Inter,system-ui,sans-serif;font-size:13px;}*{box-sizing:border-box;}</style>
            </head><body>${safeCode}<script>if(window.lucide)lucide.createIcons();<\/script></body></html>`;
    }

    /* ── HTML preview (iframe sandbox) ── */
    function renderHtmlPreview($pre, code) {
        const id = 'htm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const srcdoc = buildHtmlSrcdoc(code);

        const $wrap = $(`
            <div class="ia-render-block ia-render-html" data-render-type="html">
                <div class="ia-render-toolbar">
                    <span><i data-lucide="layout" class="w-3 h-3"></i>HTML</span>
                    <span class="ia-render-tabs">
                        <button class="ia-render-btn ia-render-tab is-active" data-tab="preview">Vista previa</button>
                        <button class="ia-render-btn ia-render-tab" data-tab="code">Codigo</button>
                        <button class="ia-render-btn ia-render-expand" title="Expandir a pantalla completa">
                            <i data-lucide="maximize-2" class="w-3 h-3"></i>Expandir
                        </button>
                    </span>
                </div>
                <div class="ia-render-view"><iframe id="${id}-iframe" class="ia-render-iframe" sandbox="allow-scripts" loading="lazy"></iframe></div>
                <pre id="${id}-code" class="ia-render-source" style="display:none;"></pre>
            </div>
        `);
        $wrap.find('.ia-render-source').text(code);
        $pre.replaceWith($wrap);

        const $iframe = $('#' + id + '-iframe');
        $iframe.attr('srcdoc', srcdoc);
        $iframe.on('load', function () {
            try {
                const doc = this.contentDocument || this.contentWindow.document;
                this.style.height = Math.min(520, Math.max(280, doc.body.scrollHeight + 16)) + 'px';
            } catch (e) { /* sandbox */ }
        });

        $wrap.find('.ia-render-tab').on('click', function () {
            const tab = $(this).data('tab');
            $wrap.find('.ia-render-tab').removeClass('is-active');
            $(this).addClass('is-active');
            $wrap.find('.ia-render-view').toggle(tab === 'preview');
            $wrap.find('.ia-render-source').toggle(tab === 'code');
        });
        $wrap.find('.ia-render-expand').on('click', () => openHtmlModal(srcdoc));
        lucide();
    }

    /* ── draw.io (tarjeta: abrir en pestania / guardar / codigo) ── */
    function renderDrawio($pre, xml) {
        const code  = String(xml || '').trim();
        const valid = /<mxGraphModel|<mxfile/i.test(code);
        const id    = 'dio-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const $wrap = $(`
            <div class="ia-render-block ia-render-drawio" data-render-type="drawio">
                <div class="ia-render-toolbar">
                    <span><i data-lucide="pen-tool" class="w-3 h-3"></i>Diagrama draw.io</span>
                    <span class="ia-render-tabs">
                        <button class="ia-render-btn is-icon ia-render-newtab" title="Abrir en el lienzo (otra pestania)">
                            <i data-lucide="external-link" class="w-3 h-3"></i>
                        </button>
                        <button class="ia-render-btn is-icon ia-render-save" title="Descargar como .drawio">
                            <i data-lucide="download" class="w-3 h-3"></i>
                        </button>
                        <button class="ia-render-btn is-icon ia-render-toggle" data-target="${id}-code" title="Ver codigo">
                            <i data-lucide="code-2" class="w-3 h-3"></i>
                        </button>
                    </span>
                </div>
                <div class="ia-render-view" id="${id}-view"></div>
                <pre id="${id}-code" class="ia-render-source" style="display:none;"></pre>
            </div>
        `);
        $wrap.find('.ia-render-source').text(code);
        $wrap.data('drawio-xml', code);

        if (valid) {
            $wrap.find('.ia-render-view').html(diagramCardHtml('workflow', 'Diagrama listo',
                'Pulsa el icono de pestania para abrirlo y editarlo en draw.io, o descarga el .drawio.'));
        } else {
            $wrap.find('.ia-render-view').html(`<div class="ia-render-error"><strong>Diagrama draw.io invalido:</strong> falta &lt;mxGraphModel&gt;. Pulsa "Codigo" para revisar la fuente.</div>`);
            $wrap.find('.ia-render-newtab, .ia-render-save').prop('disabled', true).css('opacity', 0.5);
        }
        $pre.replaceWith($wrap);

        $wrap.find('.ia-render-newtab').on('click', () => openDiagramInTab('drawio', 'diagrama.drawio', $wrap.data('drawio-xml')));
        $wrap.find('.ia-render-save').on('click', () => downloadText('diagrama-' + Date.now() + '.drawio', $wrap.data('drawio-xml')));
        bindCodeToggle($wrap, 'eye', 'Ver diagrama');
        lucide();
    }

    /* ── Excalidraw (tarjeta: abrir en pestania / guardar / codigo) ── */
    function renderExcalidraw($pre, jsonText) {
        const code = String(jsonText || '').trim();
        let valid = false;
        try { const o = JSON.parse(code); valid = o && (/excalidraw/i.test(o.type || '') || Array.isArray(o.elements)); }
        catch (e) { valid = false; }
        const id = 'exc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const $wrap = $(`
            <div class="ia-render-block ia-render-excalidraw" data-render-type="excalidraw">
                <div class="ia-render-toolbar">
                    <span><i data-lucide="pencil-ruler" class="w-3 h-3"></i>Boceto Excalidraw</span>
                    <span class="ia-render-tabs">
                        <button class="ia-render-btn is-icon ia-render-newtab" title="Abrir en el lienzo (otra pestania)">
                            <i data-lucide="external-link" class="w-3 h-3"></i>
                        </button>
                        <button class="ia-render-btn is-icon ia-render-save" title="Descargar como .excalidraw">
                            <i data-lucide="download" class="w-3 h-3"></i>
                        </button>
                        <button class="ia-render-btn is-icon ia-render-toggle" data-target="${id}-code" title="Ver codigo">
                            <i data-lucide="code-2" class="w-3 h-3"></i>
                        </button>
                    </span>
                </div>
                <div class="ia-render-view" id="${id}-view"></div>
                <pre id="${id}-code" class="ia-render-source" style="display:none;"></pre>
            </div>
        `);
        $wrap.find('.ia-render-source').text(code);
        $wrap.data('excalidraw-json', code);

        if (valid) {
            $wrap.find('.ia-render-view').html(diagramCardHtml('pencil-ruler', 'Boceto listo',
                'Pulsa el icono de pestania para abrirlo y editarlo en Excalidraw, o descarga el .excalidraw.'));
        } else {
            $wrap.find('.ia-render-view').html(`<div class="ia-render-error"><strong>Boceto Excalidraw invalido:</strong> JSON no parseable o sin "elements". Pulsa "Codigo" para revisar la fuente.</div>`);
            $wrap.find('.ia-render-newtab, .ia-render-save').prop('disabled', true).css('opacity', 0.5);
        }
        $pre.replaceWith($wrap);

        $wrap.find('.ia-render-newtab').on('click', () => openDiagramInTab('excalidraw', 'boceto.excalidraw', $wrap.data('excalidraw-json')));
        $wrap.find('.ia-render-save').on('click', () => downloadText('boceto-' + Date.now() + '.excalidraw', $wrap.data('excalidraw-json')));
        bindCodeToggle($wrap, 'eye', 'Ver boceto');
        lucide();
    }

    function diagramCardHtml(icon, title, sub) {
        return `
            <div style="display:flex;align-items:center;gap:10px;padding:14px;">
                <div style="width:38px;height:38px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,0.14);color:#818cf8;flex-shrink:0;">
                    <i data-lucide="${icon}" class="w-5 h-5"></i>
                </div>
                <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
                    <strong style="font-size:12px;">${title}</strong>
                    <span style="font-size:11px;opacity:.7;">${sub}</span>
                </div>
            </div>`;
    }

    /* ── Modal de zoom para SVG (mermaid / graphviz) ── */
    function openDiagramModal(svg, opts) {
        opts = opts || {};
        const mTitle = opts.title || 'Diagrama';
        const canvasStyle = opts.canvasBg ? ` style="background:${opts.canvasBg};border-radius:8px;"` : '';
        $('.ia-mermaid-modal').remove();
        const $modal = $(`
            <div class="ia-mermaid-modal">
                <div class="ia-mermaid-modal-box">
                    <div class="ia-mermaid-modal-head">
                        <h3><i data-lucide="git-graph"></i>${mTitle}</h3>
                        <div class="ia-mermaid-modal-tools">
                            <button class="cs-btn cs-btn-ghost cs-btn-sm ia-mermaid-zoom-out" title="Zoom -"><i data-lucide="zoom-out" class="w-3.5 h-3.5"></i></button>
                            <span class="ia-mermaid-zoom-val">100%</span>
                            <button class="cs-btn cs-btn-ghost cs-btn-sm ia-mermaid-zoom-in" title="Zoom +"><i data-lucide="zoom-in" class="w-3.5 h-3.5"></i></button>
                            <button class="cs-btn cs-btn-ghost cs-btn-sm ia-mermaid-zoom-reset" title="Restablecer"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i></button>
                            <button class="cs-btn cs-btn-ghost cs-btn-sm ia-mermaid-download" title="Descargar SVG"><i data-lucide="download" class="w-3.5 h-3.5"></i>SVG</button>
                            <button class="cs-btn cs-btn-ghost cs-btn-sm ia-mermaid-modal-close" title="Cerrar (Esc)"><i data-lucide="x" class="w-3.5 h-3.5"></i>Cerrar</button>
                        </div>
                    </div>
                    <div class="ia-mermaid-modal-body">
                        <div class="ia-mermaid-modal-canvas"${canvasStyle}>${svg}</div>
                    </div>
                </div>
            </div>
        `);
        $('body').append($modal);

        let scale = 1;
        const $canvas = $modal.find('.ia-mermaid-modal-canvas');
        const $val = $modal.find('.ia-mermaid-zoom-val');
        const applyZoom = () => { $canvas.css('transform', `scale(${scale})`); $val.text(Math.round(scale * 100) + '%'); };
        $modal.find('.ia-mermaid-zoom-in').on('click', () => { scale = Math.min(scale + 0.2, 4); applyZoom(); });
        $modal.find('.ia-mermaid-zoom-out').on('click', () => { scale = Math.max(scale - 0.2, 0.2); applyZoom(); });
        $modal.find('.ia-mermaid-zoom-reset').on('click', () => { scale = 1; applyZoom(); });
        $modal.find('.ia-mermaid-modal-body').on('wheel', (e) => {
            const oe = e.originalEvent;
            if (!oe.ctrlKey) return;
            oe.preventDefault();
            scale = Math.max(0.2, Math.min(4, scale + (oe.deltaY < 0 ? 0.1 : -0.1)));
            applyZoom();
        });
        $modal.find('.ia-mermaid-download').on('click', () => downloadText('diagram-' + Date.now() + '.svg', svg));

        const close = () => { $modal.remove(); $(document).off('keydown.iaMermaidModal'); };
        $modal.find('.ia-mermaid-modal-close').on('click', close);
        $modal.on('click', (e) => { if (e.target === $modal[0]) close(); });
        $(document).on('keydown.iaMermaidModal', (e) => { if (e.key === 'Escape') close(); });
        lucide();
    }

    /* ── Modal de vista previa HTML ── */
    function openHtmlModal(srcdoc) {
        $('.ia-html-modal').remove();
        const $modal = $(`
            <div class="ia-html-modal">
                <div class="ia-html-modal-box">
                    <div class="ia-html-modal-head">
                        <h3><i data-lucide="layout"></i>Vista previa HTML</h3>
                        <button class="cs-btn cs-btn-ghost cs-btn-sm ia-html-modal-close" title="Cerrar (Esc)"><i data-lucide="x" class="w-3.5 h-3.5"></i>Cerrar</button>
                    </div>
                    <div class="ia-html-modal-body"><iframe sandbox="allow-scripts"></iframe></div>
                </div>
            </div>
        `);
        $('body').append($modal);
        $modal.find('iframe').attr('srcdoc', srcdoc);
        const close = () => { $modal.remove(); $(document).off('keydown.iaHtmlModal'); };
        $modal.find('.ia-html-modal-close').on('click', close);
        $modal.on('click', (e) => { if (e.target === $modal[0]) close(); });
        $(document).on('keydown.iaHtmlModal', (e) => { if (e.key === 'Escape') close(); });
        lucide();
    }

    /* ══════════════════════════════════════════════════════════════════
       Historias de usuario (bloque ```stories de CoffeePlanner)
       El agente entrega los datos; la maquetacion la pone el visor.
       ══════════════════════════════════════════════════════════════════ */

    // Claves del contrato. Solo estas se leen como clave de mapa: asi un texto
    // con dos puntos ("Header: ruta del documento") no se parte por accidente.
    const STORY_KEYS = [
        'proyecto', 'modulo', 'sprint', 'fecha', 'historias', 'banner',
        'usuario', 'apartado', 'quiero', 'beneficio', 'points', 'criterios',
        'intro', 'bloques', 'reglas', 'tipo', 'titulo', 'items', 'item', 'sub',
        'nivel', 'texto'
    ];

    function unquote(v) {
        const s = String(v == null ? '' : v).trim();
        if (s.length > 1 && ((s[0] === '"' && s.slice(-1) === '"') || (s[0] === "'" && s.slice(-1) === "'"))) {
            return s.slice(1, -1);
        }
        return s;
    }

    function scalar(v) {
        const s = String(v == null ? '' : v).trim();
        if (/^\[.*\]$/.test(s)) {                       // arreglo en linea: [ a, b ]
            const inner = s.slice(1, -1).trim();
            return inner ? inner.split(',').map(unquote) : [];
        }
        return unquote(s);
    }

    function splitKey(text) {
        const m = /^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ_][\w\-]*)\s*:\s?(.*)$/.exec(text);
        if (!m || STORY_KEYS.indexOf(m[1].toLowerCase()) === -1) return null;
        return { key: m[1].toLowerCase(), value: m[2] };
    }

    // Parser del subconjunto YAML que usa el contrato: mapas, secuencias,
    // escalares y arreglos en linea. Devuelve objetos/arreglos/strings planos.
    function parseYamlish(text) {
        const lines = String(text || '').split(/\r?\n/)
            .map(l => ({ indent: l.search(/\S/), raw: l, text: l.trim() }))
            .filter(l => l.text !== '' && l.text[0] !== '#');

        function parseBlock(from, indent) {
            if (from >= lines.length) return [null, from];
            return lines[from].text[0] === '-'
                ? parseSeq(from, indent)
                : parseMap(from, indent);
        }

        function parseSeq(from, indent) {
            const out = [];
            let i = from;
            while (i < lines.length && lines[i].indent >= indent && lines[i].text[0] === '-') {
                const itemIndent = lines[i].indent;
                const head = lines[i].text.replace(/^-\s*/, '');
                const kv = splitKey(head);
                i++;
                const childFrom = i;
                while (i < lines.length && lines[i].indent > itemIndent) i++;

                if (!kv) {                                   // item escalar
                    out.push(scalar(head));
                    continue;
                }
                // item de mapa: la cabecera vuelve al pool de lineas del item
                const inner = [{ indent: itemIndent + 2, text: head }]
                    .concat(lines.slice(childFrom, i));
                out.push(parseMapFrom(inner));
            }
            return [out, i];
        }

        function parseMapFrom(sub) {           // parsea un arreglo de lineas suelto
            const keep = lines.splice(0, lines.length, ...sub);
            const res = parseMap(0, sub.length ? sub[0].indent : 0)[0];
            lines.splice(0, lines.length, ...keep);
            return res;
        }

        function parseMap(from, indent) {
            const out = {};
            let i = from;
            while (i < lines.length && lines[i].indent >= indent && lines[i].text[0] !== '-') {
                const kv = splitKey(lines[i].text);
                if (!kv) { i++; continue; }
                const myIndent = lines[i].indent;
                i++;
                if (kv.value.trim() !== '') { out[kv.key] = scalar(kv.value); continue; }

                const childFrom = i;
                while (i < lines.length && lines[i].indent > myIndent) i++;
                const child = lines.slice(childFrom, i);
                out[kv.key] = child.length
                    ? (function () {
                        const keep = lines.splice(0, lines.length, ...child);
                        const val = parseBlock(0, child[0].indent)[0];
                        lines.splice(0, lines.length, ...keep);
                        return val;
                    })()
                    : '';
            }
            return [out, i];
        }

        return parseBlock(0, lines.length ? lines[0].indent : 0)[0];
    }

    function asArray(v) {
        if (v == null || v === '') return [];
        return Array.isArray(v) ? v : [v];
    }

    // Normaliza lo parseado al esquema que consume el render.
    function normalizeStories(data) {
        if (!data || typeof data !== 'object') return null;
        const src = Array.isArray(data) ? { historias: data } : data;

        const historias = asArray(src.historias).map(function (h) {
            if (typeof h === 'string') return { banner: h };
            if (h.banner && !h.apartado) return { banner: String(h.banner) };

            const c = (h.criterios && typeof h.criterios === 'object' && !Array.isArray(h.criterios))
                ? h.criterios
                : { bloques: [], reglas: [], intro: typeof h.criterios === 'string' ? h.criterios : '' };

            const bloques = asArray(c.bloques).map(function (b) {
                if (typeof b === 'string') return { tipo: 'nota', titulo: '', items: [b] };
                return {
                    tipo:   String(b.tipo || b.titulo || 'nota'),
                    titulo: String(b.titulo || ''),
                    items:  asArray(b.items).map(function (it) {
                        if (typeof it === 'string') return { texto: it, sub: [] };
                        return { texto: String(it.item || it.texto || ''), sub: asArray(it.sub).map(String) };
                    })
                };
            });

            // El modelo suele dejar la marca del formato de papel dentro del texto
            // ("* validar…", "** IMPORTANTE ** …"): aqui la marca es el icono.
            const limpiaRegla = function (txt, nivel) {
                let t = String(txt || '').trim();
                let hard = /import/i.test(nivel || '') || /^\*{2}/.test(t) || /^\**\s*importante\b/i.test(t);
                t = t.replace(/^\*+\s*/, '').replace(/^importante\s*\*+/i, '').replace(/^[-—:\s]+/, '');
                return { nivel: hard ? 'importante' : 'nota', texto: t };
            };
            const reglas = asArray(c.reglas).map(function (r) {
                return typeof r === 'string' ? limpiaRegla(r, '') : limpiaRegla(r.texto, r.nivel);
            });

            return {
                usuario:   String(h.usuario || ''),
                apartado:  String(h.apartado || ''),
                quiero:    String(h.quiero || ''),
                beneficio: String(h.beneficio || ''),
                sprint:    String(h.sprint != null ? h.sprint : (src.sprint || '')),
                points:    String(h.points != null ? h.points : ''),
                fecha:     String(h.fecha || src.fecha || ''),
                criterios: { intro: String(c.intro || ''), bloques: bloques, reglas: reglas }
            };
        });

        if (!historias.length) return null;
        return {
            proyecto: String(src.proyecto || src.modulo || 'Historias de usuario'),
            sprint:   String(src.sprint || ''),
            fecha:    String(src.fecha || ''),
            historias: historias
        };
    }

    // Aspecto de cada tipo de bloque; el tipo sale del vocabulario de la regla.
    function blockStyle(tipo) {
        const t = String(tipo || '').toLowerCase();
        if (/filter|filtro/.test(t))          return { cls: 'is-filter', icon: 'sliders-horizontal', label: 'filterBar' };
        if (/card/.test(t))                   return { cls: 'is-cards',  icon: 'layout-grid',        label: 'Cards' };
        if (/tabla|table|listado|lista/.test(t)) return { cls: 'is-table', icon: 'table',            label: 'Tabla' };
        if (/modal|formulario|form/.test(t))  return { cls: 'is-modal',  icon: 'app-window',         label: 'Modal' };
        if (/tab/.test(t))                    return { cls: 'is-cards',  icon: 'panels-top-left',    label: 'Tabs' };
        if (/header|encabez/.test(t))         return { cls: 'is-modal',  icon: 'panel-top',          label: 'Header' };
        if (/footer|pie/.test(t))             return { cls: 'is-modal',  icon: 'panel-bottom',       label: 'Footer' };
        return { cls: '', icon: 'list', label: tipo || 'Detalle' };
    }

    function critCount(h) {
        const b = h.criterios.bloques.length, r = h.criterios.reglas.length;
        const parts = [];
        if (b) parts.push(b + (b === 1 ? ' bloque' : ' bloques'));
        if (r) parts.push(r + (r === 1 ? ' regla' : ' reglas'));
        return parts.join(' · ') || 'sin criterios';
    }

    function specHtml(h) {
        let html = '';
        if (h.criterios.intro) html += `<div class="ia-story-intro">${escape(h.criterios.intro)}</div>`;

        html += '<div class="ia-story-specs">';
        h.criterios.bloques.forEach(function (b) {
            const st = blockStyle(b.tipo);
            const title = b.titulo || st.label;
            // Listas con <div> a proposito: el chat y el visor estilizan ul/li del
            // markdown y esas reglas se colarian dentro del componente.
            html += `<div class="ia-story-spec ${st.cls}">
                <div class="ia-story-spec-h"><i data-lucide="${st.icon}" class="w-3 h-3"></i>${escape(title)}</div>
                <div class="ia-spec-list">` +
                b.items.map(function (it) {
                    const sub = it.sub.length
                        ? '<div class="ia-spec-sub">' + it.sub.map(s => `<div class="ia-spec-item">${escape(s)}</div>`).join('') + '</div>'
                        : '';
                    return `<div class="ia-spec-item">${escape(it.texto)}${sub}</div>`;
                }).join('') +
                '</div></div>';
        });
        html += '</div>';

        h.criterios.reglas.forEach(function (r) {
            const hard = r.nivel === 'importante';
            html += `<div class="ia-story-rule ${hard ? 'is-hard' : 'is-soft'}">
                <i data-lucide="${hard ? 'alert-triangle' : 'asterisk'}" class="w-3 h-3"></i>
                <span>${hard ? '<b>IMPORTANTE</b> — ' : ''}${escape(r.texto)}</span>
            </div>`;
        });
        return html;
    }

    function cardsHtml(data) {
        let html = '', n = 0;
        data.historias.forEach(function (h) {
            if (h.banner) { html += `<div class="ia-story-banner">${escape(h.banner)}</div>`; return; }
            n++;
            const chips = [`<span class="ia-chip is-user"><i data-lucide="user" class="w-3 h-3"></i>${escape(h.usuario || '—')}</span>`];
            if (h.sprint) chips.push(`<span class="ia-chip is-sprint">Sprint ${escape(h.sprint)}</span>`);
            if (h.fecha)  chips.push(`<span class="ia-chip is-date">${escape(h.fecha)}</span>`);
            if (h.points) chips.push(`<span class="ia-chip is-points">${escape(h.points)} pts</span>`);

            html += `<article class="ia-story">
                <div class="ia-story-top">
                    <span class="ia-story-id">${String(n).padStart(2, '0')}</span>
                    <div class="ia-story-main">
                        <div class="ia-chip-row">${chips.join('')}</div>
                        <div class="ia-story-apartado">${escape(h.apartado)}</div>
                        <div class="ia-story-quiero">${escape(h.quiero)}</div>
                        ${h.beneficio ? `<div class="ia-story-benef"><i data-lucide="target" class="w-3 h-3"></i>${escape(h.beneficio)}</div>` : ''}
                    </div>
                    <i data-lucide="chevron-down" class="ia-story-chev w-4 h-4"></i>
                </div>
                <div class="ia-story-crit">${specHtml(h)}</div>
            </article>`;
        });
        return html;
    }

    function tableHtml(data) {
        const head = ['Yo ( Usuario)', 'En el apartado', 'Quiero (funcionalidad)', 'Beneficio (para qué)',
                      'Criterios de aceptación', 'Sprint', 'Points', 'Fecha'];
        let rows = '';
        data.historias.forEach(function (h) {
            if (h.banner) { rows += `<tr class="ia-xls-banner"><td colspan="8">${escape(h.banner)}</td></tr>`; return; }
            rows += `<tr class="ia-xls-st">
                <td><span class="ia-chip is-user">${escape(h.usuario || '—')}</span></td>
                <td><b>${escape(h.apartado)}</b></td>
                <td>${escape(h.quiero)}</td>
                <td>${escape(h.beneficio)}</td>
                <td class="ia-xls-c"><span class="ia-xls-crit"><i data-lucide="chevron-down" class="w-3 h-3"></i>${escape(critCount(h))}</span></td>
                <td class="ia-xls-mid">${escape(h.sprint)}</td>
                <td class="ia-xls-mid">${escape(h.points)}</td>
                <td>${escape(h.fecha)}</td>
            </tr>
            <tr class="ia-xls-crit-row"><td colspan="8">${specHtml(h)}</td></tr>`;
        });
        return `<div class="ia-xls-scroll"><table class="ia-xls">
            <thead><tr>${head.map(t => `<th>${escape(t)}</th>`).join('')}</tr></thead>
            <tbody>${rows}</tbody></table></div>`;
    }

    function storiesViewHtml(data) {
        const reales   = data.historias.filter(h => !h.banner);
        const perfiles = [];
        reales.forEach(h => { if (h.usuario && perfiles.indexOf(h.usuario) === -1) perfiles.push(h.usuario); });
        const sprints  = [];
        reales.forEach(h => { if (h.sprint && sprints.indexOf(h.sprint) === -1) sprints.push(h.sprint); });
        const sub = [data.sprint ? 'Sprint ' + data.sprint : '', data.fecha].filter(Boolean).join(' · ');

        return `
            <div class="ia-stories-head">
                <div class="ia-stories-ico"><i data-lucide="list-checks" class="w-4 h-4"></i></div>
                <div class="ia-stories-titles">
                    <div class="ia-stories-title">${escape(data.proyecto)}</div>
                    ${sub ? `<div class="ia-stories-sub">${escape(sub)}</div>` : ''}
                </div>
            </div>
            <div class="ia-stories-metrics">
                <div class="ia-metric"><span class="k">Historias</span><span class="v">${reales.length}</span></div>
                <div class="ia-metric"><span class="k">Perfiles</span><span class="v">${perfiles.length}<small>${perfiles.length === 1 ? ' · ' + escape(perfiles[0]) : ''}</small></span></div>
                <div class="ia-metric"><span class="k">Sprints</span><span class="v">${sprints.length || '—'}</span></div>
            </div>
            <div class="ia-stories-cards">${cardsHtml(data)}</div>
            <div class="ia-stories-table" style="display:none;">${tableHtml(data)}</div>`;
    }

    /* ── Salidas: tabla markdown de la casa y CSV para el Excel del equipo ── */
    function critToText(h, sep) {
        const out = [];
        if (h.criterios.intro) out.push(h.criterios.intro, '');
        h.criterios.bloques.forEach(function (b) {
            out.push((b.titulo || blockStyle(b.tipo).label) + ':');
            b.items.forEach(function (it) {
                out.push('- ' + it.texto);
                it.sub.forEach(s => out.push('   - ' + s));
            });
            out.push('');
        });
        h.criterios.reglas.forEach(function (r) {
            out.push(r.nivel === 'importante' ? '** IMPORTANTE ** ' + r.texto : '* ' + r.texto);
        });
        return out.join(sep).replace(new RegExp('(' + sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')+$'), '');
    }

    function storiesToMarkdown(data) {
        const head = '| Yo ( Usuario) | En el apartado | Quiero (funcionalidad) | Beneficio (para qué) | Criterios de aceptación | Sprint | Points | Fecha |';
        const sep  = '|---|---|---|---|---|---|---|---|';
        const rows = data.historias.map(function (h) {
            if (h.banner) return `| **${h.banner.toUpperCase()}** | | | | | | | |`;
            const cell = t => String(t || '').replace(/\|/g, '\\|');
            return `| ${cell(h.usuario)} | ${cell(h.apartado)} | ${cell(h.quiero)} | ${cell(h.beneficio)} | ` +
                   `${cell(critToText(h, '<br>'))} | ${cell(h.sprint)} | ${cell(h.points)} | ${cell(h.fecha)} |`;
        });
        const title = data.sprint ? `## SPRINT ${data.sprint}\n\n` : '';
        return title + [head, sep].concat(rows).join('\n') + '\n';
    }

    function storiesToRows(data) {
        const rows = [['Yo ( Usuario)', 'En el apartado', 'Quiero (funcionalidad)', 'Beneficio (para qué)',
                       'Criterios de aceptación', 'Sprint', 'Points', 'Fecha']];
        data.historias.forEach(function (h) {
            if (h.banner) { rows.push([h.banner.toUpperCase(), '', '', '', '', '', '', '']); return; }
            rows.push([h.usuario, h.apartado, h.quiero, h.beneficio, critToText(h, '\n'), h.sprint, h.points, h.fecha]);
        });
        return rows;
    }

    function storiesToCsv(data) {
        const q = t => '"' + String(t == null ? '' : t).replace(/"/g, '""') + '"';
        return '﻿' + storiesToRows(data).map(r => r.map(q).join(',')).join('\r\n');
    }

    function downloadBlob(name, content, mime) {
        const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
    }

    // Una hoja por sprint, como el archivo que ya maneja el equipo. Sin SheetJS
    // en la pagina, se cae a CSV (Excel lo abre igual).
    function exportStories(data, slug) {
        if (typeof XLSX === 'undefined') {
            downloadBlob(slug + '.csv', storiesToCsv(data), 'text/csv;charset=utf-8');
            return;
        }
        const ws = XLSX.utils.aoa_to_sheet(storiesToRows(data));
        ws['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 46 }, { wch: 40 }, { wch: 70 }, { wch: 8 }, { wch: 8 }, { wch: 16 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, ('SPRINT ' + (data.sprint || '1')).slice(0, 31));
        XLSX.writeFile(wb, slug + '.xlsx');
    }

    function copyText(text, $btn) {
        const done = () => {
            if (!$btn) return;
            const html = $btn.html();
            $btn.html('<i data-lucide="check" class="w-3 h-3"></i>'); lucide();
            setTimeout(() => { $btn.html(html); lucide(); }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(() => {});
            return;
        }
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { /* noop */ }
        document.body.removeChild(ta);
    }

    /* ── Modal a pantalla completa de las historias ── */
    function openStoriesModal(data) {
        $('.ia-stories-modal').remove();
        const $modal = $(`
            <div class="ia-html-modal ia-stories-modal">
                <div class="ia-html-modal-box">
                    <div class="ia-html-modal-head">
                        <h3><i data-lucide="list-checks"></i>${escape(data.proyecto)}</h3>
                        <div class="ia-stories-modal-tools">
                            <button class="ia-render-btn ia-stories-view is-active" data-view="cards"><i data-lucide="layout-list" class="w-3 h-3"></i>Fichas</button>
                            <button class="ia-render-btn ia-stories-view" data-view="table"><i data-lucide="table-2" class="w-3 h-3"></i>Tabla</button>
                            <button class="cs-btn cs-btn-ghost cs-btn-sm ia-stories-modal-close" title="Cerrar (Esc)"><i data-lucide="x" class="w-3.5 h-3.5"></i>Cerrar</button>
                        </div>
                    </div>
                    <div class="ia-html-modal-body ia-stories-modal-body">
                        <div class="ia-stories">${storiesViewHtml(data)}</div>
                    </div>
                </div>
            </div>
        `);
        $('body').append($modal);
        $modal.find('.ia-stories').data('stories', data);
        const close = () => { $modal.remove(); $(document).off('keydown.iaStoriesModal'); };
        $modal.find('.ia-stories-modal-close').on('click', close);
        $modal.on('click', (e) => { if (e.target === $modal[0]) close(); });
        $(document).on('keydown.iaStoriesModal', (e) => { if (e.key === 'Escape') close(); });
        lucide();
    }

    function renderStories($pre, raw) {
        let data = null;
        try {
            const body = String(raw || '').trim();
            data = normalizeStories(body[0] === '{' || body[0] === '[' ? JSON.parse(body) : parseYamlish(body));
        } catch (e) { data = null; }

        if (!data) {                                   // el bloque no cumple: se deja el codigo
            if (typeof hljs !== 'undefined') { try { hljs.highlightElement($pre.find('code')[0]); } catch (e) {} }
            return;
        }

        const id = 'sto-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const $wrap = $(`
            <div class="ia-render-block ia-render-stories" data-render-type="stories">
                <div class="ia-render-toolbar">
                    <span><i data-lucide="list-checks" class="w-3 h-3"></i>Historias de usuario</span>
                    <span class="ia-render-tabs">
                        <button class="ia-render-btn ia-render-tab ia-stories-view is-active" data-view="cards" title="Vista de fichas"><i data-lucide="layout-list" class="w-3 h-3"></i></button>
                        <button class="ia-render-btn ia-render-tab ia-stories-view" data-view="table" title="Vista de tabla"><i data-lucide="table-2" class="w-3 h-3"></i></button>
                        <button class="ia-render-btn is-icon ia-stories-copy" title="Copiar tabla markdown"><i data-lucide="copy" class="w-3 h-3"></i></button>
                        <button class="ia-render-btn is-icon ia-stories-csv" title="Exportar a Excel"><i data-lucide="sheet" class="w-3 h-3"></i></button>
                        <button class="ia-render-btn is-icon ia-stories-expand" title="Expandir a pantalla completa"><i data-lucide="maximize-2" class="w-3 h-3"></i></button>
                        <button class="ia-render-btn is-icon ia-render-toggle" data-target="${id}-code" title="Ver codigo"><i data-lucide="code-2" class="w-3 h-3"></i></button>
                    </span>
                </div>
                <div class="ia-render-view"><div class="ia-stories">${storiesViewHtml(data)}</div></div>
                <pre id="${id}-code" class="ia-render-source" style="display:none;"></pre>
            </div>
        `);
        $wrap.find('.ia-render-source').text(raw);
        $wrap.find('.ia-stories').data('stories', data);
        $pre.replaceWith($wrap);

        const slug = data.proyecto.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'historias';
        $wrap.find('.ia-stories-copy').on('click', function () { copyText(storiesToMarkdown(data), $(this)); });
        $wrap.find('.ia-stories-csv').on('click', function () { exportStories(data, slug); });
        $wrap.find('.ia-stories-expand').on('click', function () { openStoriesModal(data); });

        bindCodeToggle($wrap, 'eye', 'Ver historias');
        lucide();
    }

    /* Interaccion delegada: sirve igual dentro de la tarjeta y del modal. */
    $(document)
        .on('click', '.ia-story-top', function () {
            $(this).closest('.ia-story').toggleClass('is-open');
        })
        .on('click', '.ia-xls-st', function () {
            $(this).toggleClass('is-open');
        })
        .on('click', '.ia-stories-view', function () {
            const $btn  = $(this);
            const table = $btn.data('view') === 'table';
            const $root = $btn.closest('.ia-render-block, .ia-html-modal').find('.ia-stories');
            $btn.siblings('.ia-stories-view').removeClass('is-active');
            $btn.addClass('is-active');
            $root.find('.ia-stories-cards').toggle(!table);
            $root.find('.ia-stories-table').toggle(table);
        });

    /* ── Post-procesador: convierte bloques de codigo en visores ricos ──
       Lo que no sea un bloque especial se resalta con highlight.js. ── */
    function postProcess($msg) {
        $msg.find('pre > code').each(function () {
            const $code = $(this);
            const $pre  = $code.parent();
            const cls   = ($code.attr('class') || '').toLowerCase();
            const raw   = $code.text();

            const looksDrawio = /\blanguage-drawio\b/.test(cls) ||
                (/\blanguage-(xml|markup)\b/.test(cls) && /<mxGraphModel|<mxfile/i.test(raw));
            const looksExcalidraw = /\blanguage-excalidraw\b/.test(cls) ||
                (/\blanguage-json\b/.test(cls) && /"type"\s*:\s*"excalidraw/i.test(raw));

            const looksStories = /\blanguage-(stories|historias)\b/.test(cls) ||
                (/\blanguage-(yaml|yml|json)\b/.test(cls) && /(^|[\s{,])"?historias"?\s*:/m.test(raw));

            if (looksDrawio)                                          renderDrawio($pre, raw);
            else if (looksExcalidraw)                                renderExcalidraw($pre, raw);
            else if (looksStories)                                   renderStories($pre, raw);
            else if (/\blanguage-mermaid\b/.test(cls))               renderMermaid($pre, raw);
            else if (/\blanguage-dot\b|\blanguage-graphviz\b|\blanguage-gv\b/.test(cls)) renderGraphviz($pre, raw);
            else if (/\blanguage-chart\b|\blanguage-chartjs\b/.test(cls)) renderChart($pre, raw);
            else if (/\blanguage-html\b|\blanguage-html-preview\b/.test(cls)) renderHtmlPreview($pre, raw);
            else if (typeof hljs !== 'undefined') {
                try { hljs.highlightElement(this); } catch (e) { /* noop */ }
            }
        });
    }

    /* ── Normalizadores de salida cruda (modo lienzo / grafica) ── */
    function looksLikeHtml(t) {
        return /<!doctype html|<html[\s>]|<head[\s>]|<body[\s>]|<(div|section|main|header|nav|table|article|ul|ol|form|button|span|img|svg|h[1-6]|p)[\s>]/i.test(t || '');
    }
    function normalizeCanvasHtml(text, canvasMode) {
        if (!canvasMode || !text) return text;
        if (/```[ \t]*html/i.test(text)) return text;
        const body = text.replace(/```[a-z0-9+-]*[ \t]*/gi, '').trim();
        if (looksLikeHtml(body)) return '```html\n' + body + '\n```';
        return text;
    }
    function normalizeDrawioXml(text) {
        if (!text || /```[ \t]*drawio/i.test(text)) return text;
        const body = text.trim();
        if (/^<(\?xml|mxfile|mxGraphModel)[\s>]/i.test(body) && /<\/(mxfile|mxGraphModel)>\s*$/i.test(body)) {
            return '```drawio\n' + body + '\n```';
        }
        return text;
    }
    // El modelo a veces suelta el YAML de historias sin cercar. Si TODO el mensaje
    // es ese bloque, se envuelve para que postProcess lo reconozca.
    function normalizeStoriesYaml(text) {
        if (!text || /```[ \t]*stories/i.test(text)) return text;
        const body = text.trim();
        if (/^(proyecto|modulo|historias)\s*:/i.test(body) && /^historias\s*:/m.test(body)) {
            return '```stories\n' + body.replace(/^```[a-z]*\s*|\s*```$/gi, '') + '\n```';
        }
        return text;
    }

    function normalizeExcalidrawJson(text) {
        if (!text || /```[ \t]*(excalidraw|json)/i.test(text)) return text;
        const body = text.trim();
        if (/^\{[\s\S]*"type"\s*:\s*"excalidraw[\s\S]*\}$/i.test(body)) {
            return '```excalidraw\n' + body + '\n```';
        }
        return text;
    }

    global.IARender = {
        escape, getTheme, markdownToHtml, postProcess, downloadText,
        openDiagramInTab, openDiagramModal, openHtmlModal, buildHtmlSrcdoc,
        renderMermaid, renderGraphviz, renderChart, renderHtmlPreview,
        renderDrawio, renderExcalidraw, renderStories,
        parseYamlish, normalizeStories, storiesToMarkdown, storiesToCsv, exportStories, openStoriesModal,
        normalizeCanvasHtml, normalizeDrawioXml, normalizeExcalidrawJson, normalizeStoriesYaml
    };

})(window);
