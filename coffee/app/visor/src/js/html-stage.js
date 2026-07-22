/* ─────────────────────────────────────────────────────────────────────────
 * HtmlStage — panel derecho que muestra renderizado un template HTML de CoffeeIA.
 *
 * Doble clic sobre el bloque HTML de una respuesta -> el template se abre a la
 * derecha, en split con el documento (mismo patron que DrawioBoard: body.html-mode
 * + visorMountStageResizer, un solo panel derecho a la vez).
 *
 * El preview corre dentro de un <iframe sandbox="allow-scripts">, de origen opaco:
 * el doble clic NO burbujea hasta el visor ni podemos leer su contentDocument. Por
 * eso el srcdoc lleva un puente que reenvia el evento con postMessage (bridgeId).
 *
 * buildSrcdoc() es la unica fuente del documento que corre dentro del iframe: lo
 * usan tanto el preview compacto del chat (CoffeeIA._renderHtmlPreview) como este
 * panel, para que el template se vea igual en los dos sitios.
 * ───────────────────────────────────────────────────────────────────────── */

class HtmlStage {

    constructor() {
        this.stageId = 'htmlStage';
        this.active  = false;
        this.code    = '';
        this.title   = '';
        this.tab     = 'preview';   // 'preview' | 'code'
    }

    static _theme() {
        return (document.documentElement.getAttribute('data-theme') === 'light') ? 'light' : 'dark';
    }

    // Documento que corre dentro del iframe.
    //   theme    -> 'dark' | 'light' (por defecto, el del visor)
    //   full     -> ocupa todo el alto del panel (en el chat el iframe se auto-ajusta)
    //   bridgeId -> inyecta el puente de doble clic hacia el visor
    static buildSrcdoc(code, opts = {}) {
        const theme  = opts.theme || HtmlStage._theme();
        const isDark = theme === 'dark';
        const bg     = isDark ? '#0F172A' : '#FFFFFF';
        const fg     = isDark ? '#E2E8F0' : '#1F2937';

        // El template se inyecta CRUDO, sin DOMPurify: sanitizar aqui eliminaba los
        // <script> y los handlers inline (onclick, etc.) del componente y lo dejaba
        // MUDO ("se ve pero no reacciona"). La barrera de seguridad real es el iframe
        // sandbox="allow-scripts" de origen opaco: el script corre aislado (no accede a
        // cookies, localStorage ni al DOM del padre), mismo modelo que usa el Playground.
        const safeCode = code;

        // El grimorio Huubie obliga clases .cs-* (ui-kit.css). Como el iframe usa
        // srcdoc (sin base URL), resolvemos la ruta del kit a URL absoluta.
        const uiKitHref = new URL('src/css/ui-kit.css', document.baseURI).href;

        const bridge = opts.bridgeId
            ? `document.addEventListener('dblclick',function(){parent.postMessage({visorHtmlStage:'open',id:${JSON.stringify(String(opts.bridgeId))}},'*');});`
            : '';

        return `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8">
            <script src="https://cdn.tailwindcss.com"><\/script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="${uiKitHref}">
            <script src="https://unpkg.com/lucide@latest"><\/script>
            <style>
                html,body{margin:0;padding:0;}
                body{padding:${opts.full ? '18px' : '8px'};background:${bg};color:${fg};font-family:Inter,system-ui,sans-serif;font-size:13px;${opts.full ? 'min-height:100vh;' : ''}}
                *{box-sizing:border-box;}
            </style></head>
            <body>${safeCode}<script>if(window.lucide)lucide.createIcons();${bridge}<\/script></body></html>`;
    }

    // Abre el template a la derecha. `code` es el HTML crudo del bloque.
    open(code, title) {
        if (!code || !String(code).trim()) return;

        // Un solo panel derecho a la vez: el split lo comparten los lienzos y este.
        if (typeof drawioBoard     !== 'undefined' && drawioBoard     && drawioBoard.active)     drawioBoard.close();
        if (typeof excalidrawBoard !== 'undefined' && excalidrawBoard && excalidrawBoard.active) excalidrawBoard.close();

        this.code   = String(code);
        this.title  = (title || this._guessTitle(this.code) || 'Template');
        this.tab    = 'preview';
        this.active = true;

        this._showStage(true);
        this._render();
    }

    close() {
        if (!this.active) return;
        this.active = false;
        const host = document.getElementById(this.stageId);
        if (host) host.innerHTML = '';
        this._showStage(false);
    }

    // Nombre para la barra: <title> del template, si no su primer encabezado.
    _guessTitle(code) {
        const t = code.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (t) return t[1].trim();
        const h = code.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
        if (h) return h[1].replace(/<[^>]+>/g, '').trim().slice(0, 60);
        return '';
    }

    // Split: documento a la izquierda, template renderizado a la derecha.
    _showStage(show) {
        $('body').toggleClass('html-mode', show);
        $('#' + this.stageId).toggleClass('hidden', !show);
        // Los controles de lectura/edicion no aplican sobre el preview.
        $('.cs-tabs-inline, #btnEdit, #btnCopyPath, #docStyleSelect, .doc-zoom, .doc-toolbar-sep')
            .toggleClass('hidden', show);
        $('#btnCloseHtml').toggleClass('hidden', !show);
        if (typeof visorMountStageResizer === 'function') visorMountStageResizer(show);
    }

    _render() {
        const host = document.getElementById(this.stageId);
        if (!host) return;

        const srcdoc = HtmlStage.buildSrcdoc(this.code, { full: true });

        $(host).html(`
            <div class="hst-bar">
                <div class="hst-bar-left">
                    <i data-lucide="layout"></i>
                    <span class="hst-title" title="${this._esc(this.title)}">${this._esc(this.title)}</span>
                </div>
                <div class="hst-bar-right">
                    <div class="cs-tabs hst-tabs">
                        <button class="cs-tab active" data-hst-tab="preview">
                            <i data-lucide="eye" class="w-3.5 h-3.5 inline-block mr-1 -mt-0.5"></i>
                            Vista previa
                        </button>
                        <button class="cs-tab" data-hst-tab="code">
                            <i data-lucide="code-2" class="w-3.5 h-3.5 inline-block mr-1 -mt-0.5"></i>
                            Codigo
                        </button>
                    </div>
                    <button class="cs-btn cs-btn-ghost cs-btn-sm hst-copy" title="Copiar el HTML">
                        <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                    </button>
                    <button class="cs-btn cs-btn-ghost cs-btn-sm hst-newtab" title="Abrir en una pestana nueva">
                        <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </div>
            <div class="hst-body">
                <iframe class="hst-frame" sandbox="allow-scripts"></iframe>
                <pre class="hst-code" style="display:none;"><code class="language-html"></code></pre>
            </div>
        `);

        $(host).find('.hst-frame').attr('srcdoc', srcdoc);

        const $code = $(host).find('.hst-code code').text(this.code);
        if (typeof hljs !== 'undefined') hljs.highlightElement($code[0]);

        $(host).find('[data-hst-tab]').on('click', (e) => {
            const tab = $(e.currentTarget).data('hst-tab');
            this.tab  = tab;
            $(host).find('[data-hst-tab]').removeClass('active');
            $(e.currentTarget).addClass('active');
            $(host).find('.hst-frame').toggle(tab === 'preview');
            $(host).find('.hst-code').toggle(tab === 'code');
        });

        $(host).find('.hst-copy').on('click', () => {
            navigator.clipboard.writeText(this.code);
        });

        $(host).find('.hst-newtab').on('click', () => {
            const blob = new Blob([srcdoc], { type: 'text/html' });
            window.open(URL.createObjectURL(blob), '_blank');
        });

        if (window.lucide) lucide.createIcons();
    }

    _esc(s) {
        return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }
}
