/* ============================================================
   ia-render.js — Motor de render avanzado de respuestas IA.

   Funciones standalone (sin estado de clase) portadas del drawer
   CoffeeIA del visor para que el Chat con Agentes tenga la misma
   riqueza de render: Mermaid, Graphviz (Viz.js), Chart.js,
   HTML-preview en iframe, diagramas draw.io / bocetos Excalidraw,
   modales de zoom y normalizadores de salida cruda del modelo.

   Reutiliza las clases .ia-render-* / .ia-*-modal de visor.css, por
   eso cualquier pagina que lo use debe cargar tambien visor.css.

   API publica (objeto global IARender):
     markdownToHtml(text)              -> string HTML (marked + DOMPurify)
     postProcess($msg, opts)          -> convierte bloques de codigo en visores
     normalizeCanvasHtml(text, on)    -> envuelve HTML crudo en ```html
     normalizeDrawioXml(text)         -> envuelve XML crudo en ```drawio
     normalizeExcalidrawJson(text)    -> envuelve JSON crudo en ```excalidraw
     openDiagramInTab(type,name,code) -> abre el lienzo en otra pestania
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

    /* ── HTML preview (iframe sandbox) ── */
    function renderHtmlPreview($pre, code) {
        const id = 'htm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const safeCode = (typeof DOMPurify !== 'undefined')
            ? DOMPurify.sanitize(code, { ADD_TAGS: ['svg', 'path', 'use'], ADD_ATTR: ['data-lucide'] })
            : code;
        const isDark = getTheme() === 'dark';
        const bg = isDark ? '#0F172A' : '#FFFFFF';
        const fg = isDark ? '#E2E8F0' : '#1F2937';
        const uiKitHref = new URL('src/css/ui-kit.css', document.baseURI).href;
        const srcdoc = `<!doctype html><html data-theme="${isDark ? 'dark' : 'light'}"><head><meta charset="utf-8">
            <script src="https://cdn.tailwindcss.com"><\/script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="${uiKitHref}">
            <script src="https://unpkg.com/lucide@latest"><\/script>
            <style>html,body{margin:0;padding:0;}body{padding:8px;background:${bg};color:${fg};font-family:Inter,system-ui,sans-serif;font-size:13px;}*{box-sizing:border-box;}</style>
            </head><body>${safeCode}<script>if(window.lucide)lucide.createIcons();<\/script></body></html>`;

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

            if (looksDrawio)                                          renderDrawio($pre, raw);
            else if (looksExcalidraw)                                renderExcalidraw($pre, raw);
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
        openDiagramInTab, openDiagramModal, openHtmlModal,
        renderMermaid, renderGraphviz, renderChart, renderHtmlPreview,
        renderDrawio, renderExcalidraw,
        normalizeCanvasHtml, normalizeDrawioXml, normalizeExcalidrawJson
    };

})(window);
