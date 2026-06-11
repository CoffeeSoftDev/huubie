/* ─────────────────────────────────────────────────────────────────────────
 * ExcalidrawBoard — lienzo de bocetos a mano alzada embebido (Excalidraw)
 *
 * A diferencia de DrawioBoard (iframe + postMessage), Excalidraw es un
 * componente React. Lo montamos sin paso de build: cargamos React + ReactDOM +
 * el bundle UMD de Excalidraw desde CDN (lazy, solo al primer uso) y montamos
 * <Excalidraw> en un <div>. Para guardar serializamos la escena a JSON nativo
 * (.excalidraw, reabrible) y reutilizamos el endpoint POST action=save.
 *
 * Solo se carga en index-2.php (copia de pruebas); el visor principal queda
 * intacto. Convive con jQuery: React vive aislado en su propio nodo.
 * ───────────────────────────────────────────────────────────────────────── */

// Versiones fijadas (UMD). EXCALIDRAW_ASSET_PATH habilita fuentes/íconos.
const EXC_REACT_URL    = 'https://unpkg.com/react@18.2.0/umd/react.production.min.js';
const EXC_REACTDOM_URL = 'https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js';
const EXC_LIB_URL      = 'https://unpkg.com/@excalidraw/excalidraw@0.17.6/dist/excalidraw.production.min.js';
const EXC_ASSET_PATH   = 'https://unpkg.com/@excalidraw/excalidraw@0.17.6/dist/';

class ExcalidrawBoard {

    constructor(app, link) {
        this.app         = app;
        this._link       = link;          // ctrl/ctrl-visor.php
        this.stageId     = 'excalidrawStage';
        this.active      = false;
        this.currentFile = null;          // file en edición, o null si es nuevo
        this._root       = null;          // ReactDOM root
        this._api        = null;          // API imperativa de Excalidraw
    }

    // Carga perezosa de React + Excalidraw (una sola vez). Devuelve true si OK.
    async _ensureAssets() {
        if (window.ExcalidrawLib && window.React && window.ReactDOM) return true;
        window.EXCALIDRAW_ASSET_PATH = EXC_ASSET_PATH;

        const loadScript = (src) => new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                if (existing.dataset.loaded) return resolve();
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error('No se pudo cargar ' + src)));
                return;
            }
            const s = document.createElement('script');
            s.src = src;
            s.crossOrigin = 'anonymous';
            s.onload  = () => { s.dataset.loaded = '1'; resolve(); };
            s.onerror = () => reject(new Error('No se pudo cargar ' + src));
            document.head.appendChild(s);
        });

        try {
            if (!window.React)         await loadScript(EXC_REACT_URL);
            if (!window.ReactDOM)      await loadScript(EXC_REACTDOM_URL);
            if (!window.ExcalidrawLib) await loadScript(EXC_LIB_URL);
            return !!(window.ExcalidrawLib && window.React && window.ReactDOM);
        } catch (e) {
            if (typeof visorView !== 'undefined' && visorView) visorView.toast(e.message, 'error');
            return false;
        }
    }

    // Abre el lienzo. file=null => boceto nuevo en blanco.
    async open(file) {
        this.currentFile = file || null;
        this.active      = true;
        this._showStage(true);

        const host = document.getElementById(this.stageId);
        if (!host) return;
        host.innerHTML = '<div class="excalidraw-loading"><span class="excalidraw-spinner"></span> Cargando Excalidraw…</div>';

        const ok = await this._ensureAssets();
        if (!ok) {
            host.innerHTML = '<div class="excalidraw-loading">No se pudo cargar Excalidraw. Revisa tu conexión a internet e inténtalo de nuevo.</div>';
            return;
        }
        // Si el usuario cerró el lienzo mientras cargaban los assets, abortar.
        if (!this.active) return;

        // Datos iniciales desde el JSON del archivo (.excalidraw es JSON nativo).
        let initialData = null;
        if (file && file.raw) {
            try {
                const parsed = JSON.parse(file.raw);
                initialData = {
                    elements: Array.isArray(parsed.elements) ? parsed.elements : [],
                    // collaborators debe ser un array/Map: forzamos vacío para evitar errores.
                    appState: Object.assign({}, parsed.appState || {}, { collaborators: [] }),
                    files:    parsed.files || undefined
                };
            } catch (e) {
                initialData = null;
            }
        }

        host.innerHTML = `
            <div class="excalidraw-bar">
                <span class="excalidraw-bar-title">${this._escape(this.currentFile ? this.currentFile.file : 'Boceto nuevo')}</span>
                <span class="excalidraw-bar-actions">
                    <button id="exSaveBtn" class="cs-btn cs-btn-primary cs-btn-sm flex items-center gap-1.5">
                        <i data-lucide="save" class="w-3.5 h-3.5"></i> Guardar
                    </button>
                </span>
            </div>
            <div id="excalidrawMount" class="excalidraw-mount"></div>`;

        const theme = (this.app.settings.theme === 'light') ? 'light' : 'dark';
        const mount = document.getElementById('excalidrawMount');
        this._root  = window.ReactDOM.createRoot(mount);
        this._root.render(window.React.createElement(window.ExcalidrawLib.Excalidraw, {
            theme,
            initialData,
            excalidrawAPI: (api) => { this._api = api; },
            UIOptions: { canvasActions: { loadScene: false } }
        }));

        $('#exSaveBtn').off('click').on('click', () => this._save());
        if (window.lucide) lucide.createIcons();
    }

    close() {
        if (!this.active) return;
        this.active = false;
        if (this._root) { try { this._root.unmount(); } catch (e) {} this._root = null; }
        this._api = null;
        const host = document.getElementById(this.stageId);
        if (host) host.innerHTML = '';
        this._showStage(false);
    }

    // Muestra/oculta el lienzo y atenúa la toolbar de documento que no aplica.
    _showStage(show) {
        $('#' + this.stageId).toggleClass('hidden', !show);
        $('.doc-layout').toggleClass('hidden', show);
        $('.cs-tabs-inline, #btnEdit, #btnCopyPath, #docStyleSelect, .doc-zoom, .doc-toolbar-sep, #btnNewDiagram, #btnNewSketch')
            .toggleClass('hidden', show);
        $('#btnCloseSketch').toggleClass('hidden', !show);
    }

    async _save() {
        if (!this._api || !window.ExcalidrawLib) return;

        const elements = this._api.getSceneElements();
        const appState = this._api.getAppState();
        const files    = this._api.getFiles ? this._api.getFiles() : {};
        const json     = window.ExcalidrawLib.serializeAsJSON(elements, appState, files || {}, 'local');

        let file = this.currentFile;

        // Boceto nuevo: pedir nombre y construir la ruta en la carpeta activa.
        if (!file || !file.fullPath) {
            const dir = (this.app.dataInit && this.app.dataInit.header ? this.app.dataInit.header.currentPath : '' || '')
                .replace(/\\/g, '/').replace(/\/+$/, '');
            if (!dir) { visorView.toast('No hay carpeta activa donde guardar', 'error'); return; }

            let name = (prompt('Nombre del boceto:', 'boceto') || '').trim();
            if (!name) return;
            if (!/\.excalidraw$/i.test(name)) name += '.excalidraw';

            file = { file: name, fullPath: dir + '/' + name, raw: '', section: 'agentes' };
            this.currentFile = file;
            $('.excalidraw-bar-title').text(name);
        }

        const $btn = $('#exSaveBtn').prop('disabled', true);
        const ok = await this._persist(file.fullPath, json);
        $btn.prop('disabled', false);
        if (!ok) return;

        file.raw = json;
        visorView.toast('Boceto guardado: ' + file.file, 'success');

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
                visorView.toast(data.message || 'Error al guardar el boceto', 'error');
                return false;
            }
            return true;
        } catch (e) {
            visorView.toast('Error de red al guardar el boceto', 'error');
            return false;
        }
    }

    _escape(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }
}
