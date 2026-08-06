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
        'nivel', 'texto',
        // Bloque ```ers (documento con el que arranca el proyecto)
        'sistema', 'resumen', 'descripcion', 'objetivo', 'modulos', 'nombre',
        'pestana', 'campos', 'usuarios', 'exito', 'fases', 'excepciones',
        'observaciones', 'archivos', 'ruta', 'lineas', 'aporte'
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

                // Bloque literal (`|`) o plegado (`>`): el texto son las lineas
                // siguientes con mas sangria. Lo usan `descripcion` y `objetivo`.
                const fold = kv.value.trim();
                if (fold === '|' || fold === '>' || fold === '|-' || fold === '>-') {
                    const buf = [];
                    while (i < lines.length && lines[i].indent > myIndent) { buf.push(lines[i].text); i++; }
                    out[kv.key] = buf.join(fold[0] === '>' ? ' ' : '\n');
                    continue;
                }

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

            // La plantilla son cinco columnas: Yo / En el apartado / Quiero /
            // Beneficio / Criterios. Si el bloque trae sprint, points o fecha se
            // ignoran a proposito: la planeacion no se pinta aqui.
            return {
                usuario:   String(h.usuario || ''),
                apartado:  String(h.apartado || ''),
                quiero:    String(h.quiero || ''),
                beneficio: String(h.beneficio || ''),
                criterios: { intro: String(c.intro || ''), bloques: bloques, reglas: reglas }
            };
        });

        if (!historias.length) return null;
        return {
            proyecto:  String(src.proyecto || src.modulo || 'Historias de usuario'),
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
            html += `<article class="ia-story">
                <div class="ia-story-top">
                    <span class="ia-story-id">${String(n).padStart(2, '0')}</span>
                    <div class="ia-story-main">
                        <div class="ia-chip-row">
                            <span class="ia-chip is-user"><i data-lucide="user" class="w-3 h-3"></i>${escape(h.usuario || '—')}</span>
                        </div>
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
                      'Criterios de aceptación'];
        let rows = '';
        data.historias.forEach(function (h) {
            if (h.banner) { rows += `<tr class="ia-xls-banner"><td colspan="5">${escape(h.banner)}</td></tr>`; return; }
            rows += `<tr class="ia-xls-st">
                <td><span class="ia-chip is-user">${escape(h.usuario || '—')}</span></td>
                <td><b>${escape(h.apartado)}</b></td>
                <td>${escape(h.quiero)}</td>
                <td>${escape(h.beneficio)}</td>
                <td class="ia-xls-c"><span class="ia-xls-crit"><i data-lucide="chevron-down" class="w-3 h-3"></i>${escape(critCount(h))}</span></td>
            </tr>
            <tr class="ia-xls-crit-row"><td colspan="5">${specHtml(h)}</td></tr>`;
        });
        return `<div class="ia-xls-scroll"><table class="ia-xls">
            <thead><tr>${head.map(t => `<th>${escape(t)}</th>`).join('')}</tr></thead>
            <tbody>${rows}</tbody></table></div>`;
    }

    function storiesViewHtml(data) {
        const reales   = data.historias.filter(h => !h.banner);
        const perfiles = [];
        reales.forEach(h => { if (h.usuario && perfiles.indexOf(h.usuario) === -1) perfiles.push(h.usuario); });
        const apartados = [];
        reales.forEach(h => { if (h.apartado && apartados.indexOf(h.apartado) === -1) apartados.push(h.apartado); });

        return `
            <div class="ia-stories-head">
                <div class="ia-stories-ico"><i data-lucide="list-checks" class="w-4 h-4"></i></div>
                <div class="ia-stories-titles">
                    <div class="ia-stories-title">${escape(data.proyecto)}</div>
                    <div class="ia-stories-sub">Historias de usuario</div>
                </div>
            </div>
            <div class="ia-stories-metrics">
                <div class="ia-metric"><span class="k">Historias</span><span class="v">${reales.length}</span></div>
                <div class="ia-metric"><span class="k">Apartados</span><span class="v">${apartados.length}</span></div>
                <div class="ia-metric"><span class="k">Perfiles</span><span class="v">${perfiles.length}<small>${perfiles.length === 1 ? ' · ' + escape(perfiles[0]) : ''}</small></span></div>
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
        const head = '| Yo ( Usuario) | En el apartado | Quiero (funcionalidad) | Beneficio (para qué) | Criterios de aceptación |';
        const sep  = '|---|---|---|---|---|';
        const rows = data.historias.map(function (h) {
            if (h.banner) return `| **${h.banner.toUpperCase()}** | | | | |`;
            const cell = t => String(t || '').replace(/\|/g, '\\|');
            return `| ${cell(h.usuario)} | ${cell(h.apartado)} | ${cell(h.quiero)} | ${cell(h.beneficio)} | ` +
                   `${cell(critToText(h, '<br>'))} |`;
        });
        return [head, sep].concat(rows).join('\n') + '\n';
    }

    function storiesToRows(data) {
        const rows = [['Yo ( Usuario)', 'En el apartado', 'Quiero (funcionalidad)', 'Beneficio (para qué)',
                       'Criterios de aceptación']];
        data.historias.forEach(function (h) {
            if (h.banner) { rows.push([h.banner.toUpperCase(), '', '', '', '']); return; }
            rows.push([h.usuario, h.apartado, h.quiero, h.beneficio, critToText(h, '\n')]);
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

    // Una hoja con las cinco columnas de la plantilla. Sin SheetJS en la pagina,
    // se cae a CSV (Excel lo abre igual).
    function exportStories(data, slug) {
        if (typeof XLSX === 'undefined') {
            downloadBlob(slug + '.csv', storiesToCsv(data), 'text/csv;charset=utf-8');
            return;
        }
        const ws = XLSX.utils.aoa_to_sheet(storiesToRows(data));
        ws['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 46 }, { wch: 40 }, { wch: 70 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, (data.proyecto || 'Historias').replace(/[\\/*?:[\]]/g, ' ').slice(0, 31));
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

    /* ══════════════════════════════════════════════════════════════════
       ERS (bloque ```ers de CoffeePlanner)
       El documento con el que arranca un proyecto, presentado como un
       archivo de repositorio: tema GitHub, modulos plegables, avisos y
       la tabla de archivos que se leyeron para levantarlo.
       ══════════════════════════════════════════════════════════════════ */

    function normalizeErs(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
        if (!data.sistema && !data.modulos && !data.descripcion) return null;

        // Un parrafo por linea EN BLANCO: dentro de un bloque `|` los saltos simples
        // son solo el ancho del YAML, no punto y aparte.
        const parrafos = t => String(t == null ? '' : t)
            .split(/\n\s*\n/)
            .map(p => p.replace(/\s*\n\s*/g, ' ').trim())
            .filter(Boolean);

        const modulos = asArray(data.modulos).map(function (m) {
            if (typeof m === 'string') return { nombre: m, pestana: '', descripcion: '', campos: [] };
            return {
                nombre:      String(m.nombre || m.titulo || 'Módulo'),
                pestana:     String(m.pestana || ''),
                descripcion: String(m.descripcion || ''),
                campos:      asArray(m.campos || m.items).map(String)
            };
        });

        const exito = asArray(data.exito).map(function (e) {
            if (typeof e === 'string') return { titulo: '', texto: e };
            return { titulo: String(e.titulo || ''), texto: String(e.texto || '') };
        });

        const fases = asArray(data.fases).map(function (f, i) {
            if (typeof f === 'string') return { nombre: f, items: [] };
            return { nombre: String(f.nombre || f.titulo || ('Fase ' + (i + 1))), items: asArray(f.items).map(String) };
        });

        const archivos = asArray(data.archivos).map(function (a) {
            if (typeof a === 'string') return { ruta: a, lineas: '', aporte: '' };
            return { ruta: String(a.ruta || ''), lineas: String(a.lineas != null ? a.lineas : ''), aporte: String(a.aporte || '') };
        });

        return {
            sistema:      String(data.sistema || data.proyecto || 'Sistema'),
            resumen:      String(data.resumen || ''),
            fecha:        String(data.fecha || ''),
            proyecto:     String(data.proyecto || ''),
            descripcion:  parrafos(data.descripcion),
            objetivo:     parrafos(data.objetivo),
            modulos:      modulos,
            usuarios:     asArray(data.usuarios).map(String),
            exito:        exito,
            fases:        fases,
            excepciones:  asArray(data.excepciones).map(String),
            observaciones: asArray(data.observaciones).map(String),
            archivos:     archivos
        };
    }

    // Iniciales del puesto para el avatar del bloque de usuarios.
    function iniciales(txt) {
        const p = String(txt || '').trim().split(/\s+/).filter(w => w.length > 2);
        return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
    }

    const ERS_SECCIONES = [
        { id: 'descripcion',   titulo: 'Descripción breve del proyecto' },
        { id: 'objetivo',      titulo: 'Objetivo del proyecto' },
        { id: 'modulos',       titulo: 'Secciones del proyecto' },
        { id: 'usuarios',      titulo: 'Usuarios que utilizarán el proyecto' },
        { id: 'exito',         titulo: '¿El éxito del proyecto se da cuándo?' },
        { id: 'fases',         titulo: 'Acciones a realizar' },
        { id: 'excepciones',   titulo: 'Excepciones' },
        { id: 'observaciones', titulo: 'Observaciones' }
    ];

    function ersHasContent(d, id) {
        const v = d[id];
        return Array.isArray(v) ? v.length > 0 : !!v;
    }

    function ersDocHtml(d, uid) {
        const secs = ERS_SECCIONES.filter(s => ersHasContent(d, s.id));

        let html = `<h1 class="ia-ers-h1">ERS — ${escape(d.sistema)}</h1>`;

        const labels = [];
        if (d.fecha)    labels.push(`<span class="ia-ers-label is-accent">${escape(d.fecha)}</span>`);
        if (d.proyecto) labels.push(`<span class="ia-ers-label">${escape(d.proyecto)}</span>`);
        labels.push('<span class="ia-ers-label">levantado por CoffeePlanner</span>');
        html += `<div class="ia-ers-labels">${labels.join('')}</div>`;

        if (d.resumen) html += `<p class="ia-ers-lead">${escape(d.resumen)}</p>`;

        html += `<div class="ia-ers-stats">
            <div class="ia-ers-stat"><span class="k">Módulos</span><span class="v">${d.modulos.length}</span></div>
            <div class="ia-ers-stat"><span class="k">Usuarios</span><span class="v">${d.usuarios.length}</span></div>
            <div class="ia-ers-stat"><span class="k">Fases</span><span class="v">${d.fases.length}</span></div>
            <div class="ia-ers-stat"><span class="k">Archivos leídos</span><span class="v">${d.archivos.length || '—'}</span></div>
        </div>`;

        if (secs.length > 1) {
            html += `<nav class="ia-ers-toc"><div class="ia-ers-toc-h">Contenido</div><ol>` +
                secs.map(s => `<li><a href="#${uid}-${s.id}">${escape(s.titulo)}</a></li>`).join('') +
                `</ol></nav>`;
        }

        secs.forEach(function (s) {
            html += `<h2 class="ia-ers-h2" id="${uid}-${s.id}">${escape(s.titulo)}</h2>`;

            if (s.id === 'descripcion' || s.id === 'objetivo') {
                html += d[s.id].map(p => `<p>${escape(p)}</p>`).join('');

            } else if (s.id === 'modulos') {
                html += d.modulos.map(function (m, i) {
                    const meta = [
                        m.campos.length ? m.campos.length + (m.campos.length === 1 ? ' campo' : ' campos') : '',
                        m.pestana
                    ].filter(Boolean).join(' · ');
                    return `<details class="ia-ers-mod"${i === 0 ? ' open' : ''}>
                        <summary>
                            <i data-lucide="chevron-right" class="ia-ers-chev w-3.5 h-3.5"></i>
                            <span class="ia-ers-mod-name">${escape(m.nombre)}</span>
                            ${meta ? `<span class="ia-ers-mod-meta">${escape(meta)}</span>` : ''}
                        </summary>
                        <div class="ia-ers-mod-body">
                            ${m.descripcion ? `<p class="ia-ers-mod-desc">${escape(m.descripcion)}</p>` : ''}
                            <ul class="ia-ers-fields${m.campos.length < 6 ? ' is-short' : ''}">` +
                                m.campos.map(c => `<li>${escape(c)}</li>`).join('') +
                            `</ul>
                        </div>
                    </details>`;
                }).join('');

            } else if (s.id === 'usuarios') {
                html += `<div class="ia-ers-people">` +
                    d.usuarios.map(u => `<span class="ia-ers-person"><span class="av">${escape(iniciales(u))}</span>${escape(u)}</span>`).join('') +
                    `</div>`;

            } else if (s.id === 'exito') {
                const conTitulo = d.exito.some(e => e.titulo);
                html += `<div class="ia-ers-tablewrap"><table class="ia-ers-table">` +
                    (conTitulo ? '<thead><tr><th>Capacidad</th><th>Cómo se comprueba</th></tr></thead>' : '') +
                    '<tbody>' +
                    d.exito.map(e => conTitulo
                        ? `<tr><td><b>${escape(e.titulo)}</b></td><td>${escape(e.texto)}</td></tr>`
                        : `<tr><td>${escape(e.texto)}</td></tr>`).join('') +
                    `</tbody></table></div>`;

            } else if (s.id === 'fases') {
                html += d.fases.map(function (f, i) {
                    return `<div class="ia-ers-phase">
                        <h4><span class="ia-ers-badge">Fase ${i + 1}</span>${escape(f.nombre.replace(/^fase\s*\d+\s*[·:.-]?\s*/i, ''))}</h4>
                        <ul class="ia-ers-tasks">` +
                        f.items.map(it => `<li><span class="box"></span>${escape(it)}</li>`).join('') +
                        `</ul>
                    </div>`;
                }).join('');

            } else {
                const warn = s.id === 'excepciones';
                html += d[s.id].map(t => `<div class="ia-ers-alert ${warn ? 'is-warning' : 'is-note'}">
                    <span class="ia-ers-alert-t"><i data-lucide="${warn ? 'alert-triangle' : 'info'}" class="w-3.5 h-3.5"></i>${warn ? 'Warning' : 'Note'}</span>
                    <p>${escape(t)}</p>
                </div>`).join('');
            }
        });

        if (d.archivos.length) {
            html += `<hr class="ia-ers-hr">
                <h3 class="ia-ers-h3">Archivos leídos para levantar este ERS</h3>
                <div class="ia-ers-tablewrap"><table class="ia-ers-table">
                    <thead><tr><th>Archivo</th><th>Líneas</th><th>Qué aportó</th></tr></thead>
                    <tbody>` +
                    d.archivos.map(a => `<tr>
                        <td class="path">${escape(a.ruta)}</td>
                        <td class="num">${escape(a.lineas)}</td>
                        <td>${escape(a.aporte)}</td>
                    </tr>`).join('') +
                    `</tbody></table></div>`;
        }

        html += `<div class="ia-ers-foot">
            <i data-lucide="git-branch" class="w-3.5 h-3.5"></i>
            <span>Siguiente paso: derivar las historias de usuario de este ERS.</span>
            <button class="ia-render-btn ia-ers-next" type="button"><i data-lucide="list-checks" class="w-3 h-3"></i>Generar historias</button>
        </div>`;

        return html;
    }

    function ersFichaHtml(d, uid) {
        const secs = ERS_SECCIONES.filter(s => ersHasContent(d, s.id));
        const conteo = {
            modulos:       d.modulos.length + (d.modulos.length === 1 ? ' módulo' : ' módulos'),
            usuarios:      d.usuarios.length + (d.usuarios.length === 1 ? ' perfil' : ' perfiles'),
            fases:         d.fases.length + (d.fases.length === 1 ? ' fase' : ' fases'),
            exito:         d.exito.length + '',
            excepciones:   d.excepciones.length + '',
            observaciones: d.observaciones.length + ''
        };
        const resumenDe = function (s) {
            if (s.id === 'descripcion' || s.id === 'objetivo') return escape(d[s.id].join(' '));
            if (s.id === 'modulos')  return d.modulos.map(m => `<b>${escape(m.nombre)}</b>${m.campos.length ? ' — ' + m.campos.length + ' campos' : ''}`).join('<br>');
            if (s.id === 'usuarios') return escape(d.usuarios.join(' · '));
            if (s.id === 'exito')    return d.exito.map(e => escape(e.titulo || e.texto)).join('<br>');
            if (s.id === 'fases')    return d.fases.map(f => escape(f.nombre)).join(' · ');
            return d[s.id].map(t => escape(t)).join('<br>');
        };

        return `<div class="ia-ers-ficha">
            <div class="ia-ers-ficha-stats">
                <div class="ia-ers-stat"><span class="k">Módulos</span><span class="v">${d.modulos.length}</span></div>
                <div class="ia-ers-stat"><span class="k">Usuarios</span><span class="v">${d.usuarios.length}</span></div>
                <div class="ia-ers-stat"><span class="k">Fases</span><span class="v">${d.fases.length}</span></div>
            </div>
            <div class="ia-ers-rows">` +
            secs.map(function (s, i) {
                const n = String(ERS_SECCIONES.indexOf(s) + 1).padStart(2, '0');
                const c = conteo[s.id] || '';
                return `<details class="ia-ers-row"${i === 0 || s.id === 'modulos' ? ' open' : ''}>
                    <summary>
                        <span class="n">${n}</span>
                        <span class="t">${escape(s.titulo)}</span>
                        ${c ? `<span class="c">${escape(c)}</span>` : ''}
                    </summary>
                    <div class="rb">${resumenDe(s)}</div>
                </details>`;
            }).join('') +
            `</div>
        </div>`;
    }

    /* ── Salidas del ERS: el markdown de las ocho secciones ── */
    function ersToMarkdown(d) {
        const out = [];
        out.push('---', 'name: ERS', 'description: ' + (d.resumen || ''), 'date: ' + (d.fecha || ''), '---', '');
        out.push('ERS - ' + d.sistema.toUpperCase(), '');
        const push = (t, cuerpo) => { out.push('## ' + t, ''); out.push.apply(out, cuerpo); out.push(''); };

        if (d.descripcion.length) push('DESCRIPCIÓN BREVE DEL PROYECTO', d.descripcion);
        if (d.objetivo.length)    push('OBJETIVO DEL PROYECTO', d.objetivo);

        if (d.modulos.length) {
            const cuerpo = [];
            d.modulos.forEach(function (m) {
                cuerpo.push(m.nombre + (m.pestana ? ' [ ' + m.pestana + ' ]' : ''), '');
                if (m.descripcion) cuerpo.push(m.descripcion, '');
                m.campos.forEach(c => cuerpo.push('- ' + c));
                cuerpo.push('');
            });
            push('SECCIONES DEL PROYECTO', cuerpo);
        }
        if (d.usuarios.length) push('USUARIOS QUE UTILIZARÁN EL PROYECTO', d.usuarios);
        if (d.exito.length)    push('¿EL ÉXITO DEL PROYECTO SE DA CUÁNDO?',
            d.exito.map(e => (e.titulo ? e.titulo + ': ' : '') + e.texto));
        if (d.fases.length) {
            const cuerpo = [];
            d.fases.forEach(function (f) {
                cuerpo.push(f.nombre, '');
                f.items.forEach(it => cuerpo.push('- ' + it));
                cuerpo.push('');
            });
            push('ACCIONES A REALIZAR', cuerpo);
        }
        push('EXCEPCIONES', d.excepciones.map(t => '- ' + t));
        push('OBSERVACIONES', d.observaciones.map(t => '- ' + t));

        if (d.archivos.length) {
            out.push('---', '', '**Archivos leídos para levantar este ERS:**', '',
                     '| Archivo | Líneas | Contenido |', '|---|---|---|');
            d.archivos.forEach(a => out.push(`| \`${a.ruta}\` | ${a.lineas} | ${a.aporte} |`));
            out.push('');
        }
        return out.join('\n');
    }

    // Impresion / PDF: el documento en una ventana propia con su hoja de estilo.
    function printErs($wrap, titulo) {
        // En papel no hay clic: los modulos van todos desplegados.
        const doc = ($wrap.find('.ia-ers-doc').html() || '')
            .replace(/<details class="ia-ers-mod"(?! open)/g, '<details class="ia-ers-mod" open');
        const css = $('link[rel="stylesheet"]').map(function () { return this.href; }).get()
            .map(h => `<link rel="stylesheet" href="${h}">`).join('');
        const w = global.open('', '_blank', 'width=980,height=800');
        if (!w) return;
        w.document.write(`<!doctype html><html data-theme="light"><head><meta charset="utf-8">
            <title>${escape(titulo)}</title>${css}
            <style>body{margin:0;background:#fff;} .ia-ers-doc{padding:32px;} .ia-ers-foot,.ia-ers-next{display:none;}
                   .ia-ers-mod{break-inside:avoid;} details{open:true;}</style>
            </head><body><div class="ia-stories ia-ers"><div class="ia-ers-doc">${doc}</div></div></body></html>`);
        w.document.close();
        w.focus();
        setTimeout(() => { try { w.print(); } catch (e) {} }, 400);
    }

    function renderErs($pre, raw) {
        let data = null;
        try {
            const body = String(raw || '').trim();
            data = normalizeErs(body[0] === '{' ? JSON.parse(body) : parseYamlish(body));
        } catch (e) { data = null; }

        if (!data) {
            if (typeof hljs !== 'undefined') { try { hljs.highlightElement($pre.find('code')[0]); } catch (e) {} }
            return;
        }

        const uid  = 'ers-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        // Sin acentos antes de cortar: "facturación" -> "facturacion", no "facturaci-n".
        const slug = data.sistema.toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ers';
        const $wrap = $(`
            <div class="ia-render-block ia-render-ers ia-stories ia-ers" data-render-type="ers">
                <div class="ia-render-toolbar">
                    <span><i data-lucide="file-text" class="w-3 h-3"></i>ERS-${escape(slug)}.md</span>
                    <span class="ia-render-tabs">
                        <button class="ia-render-btn ia-render-tab ia-ers-view is-active" data-view="doc" title="Documento"><i data-lucide="file-text" class="w-3 h-3"></i></button>
                        <button class="ia-render-btn ia-render-tab ia-ers-view" data-view="ficha" title="Ficha"><i data-lucide="layout-list" class="w-3 h-3"></i></button>
                        <button class="ia-render-btn is-icon ia-ers-copy" title="Copiar markdown"><i data-lucide="copy" class="w-3 h-3"></i></button>
                        <button class="ia-render-btn is-icon ia-ers-download" title="Descargar .md"><i data-lucide="download" class="w-3 h-3"></i></button>
                        <button class="ia-render-btn is-icon ia-ers-print" title="Imprimir o PDF"><i data-lucide="printer" class="w-3 h-3"></i></button>
                        <button class="ia-render-btn is-icon ia-ers-expand" title="Pantalla completa"><i data-lucide="maximize-2" class="w-3 h-3"></i></button>
                        <button class="ia-render-btn is-icon ia-render-toggle" data-target="${uid}-code" title="Ver codigo"><i data-lucide="code-2" class="w-3 h-3"></i></button>
                    </span>
                </div>
                <div class="ia-render-view">
                    <div class="ia-ers-doc">${ersDocHtml(data, uid)}</div>
                    <div class="ia-ers-ficha-wrap" style="display:none;">${ersFichaHtml(data, uid)}</div>
                </div>
                <pre id="${uid}-code" class="ia-render-source" style="display:none;"></pre>
            </div>
        `);
        $wrap.find('.ia-render-source').text(raw);
        $wrap.data('ers', data);
        $pre.replaceWith($wrap);

        $wrap.find('.ia-ers-copy').on('click', function () { copyText(ersToMarkdown(data), $(this)); });
        $wrap.find('.ia-ers-download').on('click', function () {
            downloadBlob('ERS-' + slug + '.md', ersToMarkdown(data), 'text/markdown;charset=utf-8');
        });
        $wrap.find('.ia-ers-print').on('click', function () { printErs($wrap, 'ERS — ' + data.sistema); });
        $wrap.find('.ia-ers-expand').on('click', function () { openErsModal(data, uid); });

        bindCodeToggle($wrap, 'eye', 'Ver documento');
        lucide();
    }

    function openErsModal(data, uid) {
        $('.ia-ers-modal').remove();
        const $modal = $(`
            <div class="ia-html-modal ia-ers-modal">
                <div class="ia-html-modal-box">
                    <div class="ia-html-modal-head">
                        <h3><i data-lucide="file-text"></i>ERS — ${escape(data.sistema)}</h3>
                        <button class="cs-btn cs-btn-ghost cs-btn-sm ia-ers-modal-close" title="Cerrar (Esc)"><i data-lucide="x" class="w-3.5 h-3.5"></i>Cerrar</button>
                    </div>
                    <div class="ia-html-modal-body ia-stories ia-ers ia-ers-modal-body">
                        <div class="ia-ers-doc">${ersDocHtml(data, uid + '-m')}</div>
                    </div>
                </div>
            </div>
        `);
        $('body').append($modal);
        const close = () => { $modal.remove(); $(document).off('keydown.iaErsModal'); };
        $modal.find('.ia-ers-modal-close').on('click', close);
        $modal.on('click', (e) => { if (e.target === $modal[0]) close(); });
        $(document).on('keydown.iaErsModal', (e) => { if (e.key === 'Escape') close(); });
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
        })
        .on('click', '.ia-ers-view', function () {
            const $btn   = $(this);
            const ficha  = $btn.data('view') === 'ficha';
            const $block = $btn.closest('.ia-render-block');
            $btn.siblings('.ia-ers-view').removeClass('is-active');
            $btn.addClass('is-active');
            $block.find('.ia-ers-doc').toggle(!ficha);
            $block.find('.ia-ers-ficha-wrap').toggle(ficha);
        })
        // El puente al paso siguiente del flujo: el ERS ya esta, faltan las historias.
        .on('click', '.ia-ers-next', function () {
            const data = $(this).closest('.ia-render-block').data('ers');
            const texto = 'Deriva las historias de usuario del ERS de ' + ((data && data.sistema) || 'este documento') +
                          ', modulo por modulo.';
            const $input = $('#iaInputTextarea, #pgChatInput, #sbInput, #chatInput, #labInput').filter(':visible').first();
            if ($input.length) {
                $input.val(texto).trigger('input').focus();
            } else {
                copyText(texto, $(this));
            }
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
            const looksErs = /\blanguage-ers\b/.test(cls) ||
                (/\blanguage-(yaml|yml|json)\b/.test(cls) && /(^|[\s{,])"?sistema"?\s*:/m.test(raw) && /(^|[\s{,])"?modulos"?\s*:/m.test(raw));

            if (looksDrawio)                                          renderDrawio($pre, raw);
            else if (looksExcalidraw)                                renderExcalidraw($pre, raw);
            else if (looksStories)                                   renderStories($pre, raw);
            else if (looksErs)                                       renderErs($pre, raw);
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

    // Mismo caso que las historias: si TODO el mensaje es el YAML del ERS, se cerca.
    function normalizeErsYaml(text) {
        if (!text || /```[ \t]*ers/i.test(text)) return text;
        const body = text.trim();
        if (/^sistema\s*:/im.test(body) && /^modulos\s*:/m.test(body)) {
            return '```ers\n' + body.replace(/^```[a-z]*\s*|\s*```$/gi, '') + '\n```';
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
        renderDrawio, renderExcalidraw, renderStories, renderErs,
        parseYamlish, normalizeStories, storiesToMarkdown, storiesToCsv, exportStories, openStoriesModal,
        normalizeErs, ersToMarkdown, openErsModal,
        normalizeCanvasHtml, normalizeDrawioXml, normalizeExcalidrawJson,
        normalizeStoriesYaml, normalizeErsYaml
    };

})(window);
