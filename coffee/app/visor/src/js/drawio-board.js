/* ─────────────────────────────────────────────────────────────────────────
 * DrawioBoard — lienzo de diagramas embebido (draw.io / diagrams.net)
 *
 * Integra el editor de diagrams.net via <iframe> + protocolo postMessage
 * (proto=json). No requiere librerias locales ni React: el editor se sirve
 * desde embed.diagrams.net y nos comunicamos por mensajes.
 *
 * Protocolo usado:
 *   iframe -> host : { event:'init' }      al cargar el editor
 *   host  -> iframe: { action:'load', xml, autosave:1 }
 *   iframe -> host : { event:'save', xml } al pulsar Guardar / Ctrl+S
 *   iframe -> host : { event:'exit' }      al salir
 *
 * Persistencia: reutiliza el endpoint POST action=save de ctrl-visor.php,
 * escribiendo archivos .drawio (XML nativo de draw.io, reabrible y editable).
 * ───────────────────────────────────────────────────────────────────────── */

class DrawioBoard {

    constructor(app, link) {
        this.app     = app;
        this._link   = link;            // ctrl/ctrl-visor.php
        this.stageId = 'drawioStage';
        this.frame   = null;
        this.active  = false;
        this.currentFile = null;        // file en edicion, o null si es nuevo
        this.pendingXml  = '';          // XML a cargar cuando el iframe emita 'init'
        this._onMessage  = this._onMessage.bind(this);
    }

    _embedUrl() {
        // ui: 'dark' (oscuro) | 'kennedy' (claro). Sigue el tema del visor.
        const ui = (this.app.settings.theme === 'light') ? 'kennedy' : 'dark';
        const params = new URLSearchParams({
            embed:    '1',
            proto:    'json',          // mensajes JSON por postMessage
            spin:     '1',             // spinner de carga
            libraries:'1',             // panel de formas
            modified: 'unsavedChanges',// avisar de cambios sin guardar al salir
            ui:       ui,
            lang:     'es'
        });
        return 'https://embed.diagrams.net/?' + params.toString();
    }

    // Abre el lienzo. file=null => diagrama nuevo en blanco.
    open(file) {
        this.currentFile = file || null;
        this.pendingXml  = (file && file.raw) ? file.raw : '';
        this.active      = true;

        this._showStage(true);

        // Recrear el iframe en cada apertura evita estado residual entre diagramas.
        const host = document.getElementById(this.stageId);
        if (!host) return;
        host.innerHTML = '';
        this.frame = document.createElement('iframe');
        this.frame.className = 'drawio-frame';
        this.frame.setAttribute('frameborder', '0');
        this.frame.src = this._embedUrl();
        host.appendChild(this.frame);

        window.removeEventListener('message', this._onMessage);
        window.addEventListener('message', this._onMessage);
    }

    close() {
        if (!this.active) return;
        this.active = false;
        window.removeEventListener('message', this._onMessage);
        const host = document.getElementById(this.stageId);
        if (host) host.innerHTML = '';
        this.frame = null;
        this._showStage(false);
    }

    // Muestra/oculta el lienzo y atenua la toolbar de documento que no aplica.
    _showStage(show) {
        $('#' + this.stageId).toggleClass('hidden', !show);
        $('.doc-layout').toggleClass('hidden', show);
        // Controles de documento irrelevantes en modo lienzo.
        $('.cs-tabs-inline, #btnEdit, #btnCopyPath, #docStyleSelect, .doc-zoom, .doc-toolbar-sep')
            .toggleClass('hidden', show);
        $('#btnCloseDiagram').toggleClass('hidden', !show);
    }

    _post(msg) {
        if (this.frame && this.frame.contentWindow) {
            this.frame.contentWindow.postMessage(JSON.stringify(msg), '*');
        }
    }

    _onMessage(evt) {
        if (!this.frame || evt.source !== this.frame.contentWindow) return;
        let data;
        try { data = JSON.parse(evt.data); } catch (e) { return; }
        if (!data || !data.event) return;

        switch (data.event) {
            case 'init':
                // Cargar el XML (vacio para nuevo) y habilitar el flujo de guardado.
                this._post({ action: 'load', xml: this.pendingXml || '', autosave: 1 });
                break;
            case 'save':
                this._save(data.xml);
                break;
            case 'exit':
                // exitDiagram cierra el lienzo y muestra el XML como fuente (sin reabrirlo).
                this.app.exitDiagram();
                break;
            // 'autosave' se ignora: solo persistimos en guardado explicito.
        }
    }

    async _save(xml) {
        let file = this.currentFile;

        // Diagrama nuevo: pedir nombre y construir la ruta en la carpeta activa.
        if (!file || !file.fullPath) {
            const dir = (this.app.dataInit?.header?.currentPath || '')
                .replace(/\\/g, '/').replace(/\/+$/, '');
            if (!dir) { visorView.toast('No hay carpeta activa donde guardar', 'error'); return; }

            let name = (prompt('Nombre del diagrama:', 'diagrama') || '').trim();
            if (!name) return;
            if (!/\.drawio$/i.test(name)) name += '.drawio';

            file = { file: name, fullPath: dir + '/' + name, raw: '', section: 'agentes' };
            this.currentFile = file;
        }

        const ok = await this._persist(file.fullPath, xml);
        if (!ok) return;

        file.raw = xml;
        visorView.toast('Diagrama guardado: ' + file.file, 'success');

        // Integrarlo a la biblioteca en memoria y refrescar el sidebar.
        const exists = (this.app.allFiles || []).find(f => f.file === file.file);
        if (!exists) {
            this.app.allFiles = this.app.allFiles || [];
            this.app.allFiles.push(file);
        }
        this.app.currentFile = file.file;
        visorView.renderSidebar(this.app.dataInit, this.app.currentFile, $('#sidebarSearch').val() || '');
        this.app.bindSidebarClicks();
        if (window.lucide) lucide.createIcons();
    }

    async _persist(fullPath, content) {
        try {
            const form = new FormData();
            form.append('action',     'save');
            form.append('fullPath',   fullPath);
            form.append('customPath', this.app.settings.customPath || '');
            form.append('content',    content);
            const res  = await fetch(this._link, { method: 'POST', body: form });
            const data = await res.json();
            if (!data.success) {
                visorView.toast(data.message || 'Error al guardar el diagrama', 'error');
                return false;
            }
            return true;
        } catch (e) {
            visorView.toast('Error de red al guardar el diagrama', 'error');
            return false;
        }
    }
}
