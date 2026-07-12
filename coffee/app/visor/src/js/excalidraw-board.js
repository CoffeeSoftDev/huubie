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
                let elements = Array.isArray(parsed.elements) ? parsed.elements : [];
                // Escenas "skeleton" (generadas por la IA): sus elementos NO traen
                // seed/versionNonce ni bindings. convertToExcalidrawElements los
                // normaliza (geometría, anclaje de flechas, textos en contenedores).
                const looksSkeleton = elements.length > 0 &&
                    elements.some(el => el && el.seed == null && el.versionNonce == null);
                if (looksSkeleton) {
                    // 0) Plantilla "maestros corporativos" (source coffeeia-template): ajusta
                    //    cada caja EXACTAMENTE a su texto antes de calcular las flechas, para
                    //    que las puntas caigan en el borde real de la card ya dimensionada.
                    if (parsed.source === 'coffeeia-template') {
                        elements = this._autoSizeNodes(elements);
                    }
                    // 1) Resolvemos NOSOTROS los enlaces (flechas/lineas con start/end por
                    //    id) calculando puntos de borde a borde. No dependemos del binding
                    //    de Excalidraw (inestable entre versiones) -> el enlace siempre cae
                    //    en el borde del nodo, nunca al centro ni desaparece.
                    elements = this._resolveConnections(elements);
                    // 2) convertToExcalidrawElements normaliza el resto (geometría, labels).
                    if (window.ExcalidrawLib &&
                        typeof window.ExcalidrawLib.convertToExcalidrawElements === 'function') {
                        try { elements = window.ExcalidrawLib.convertToExcalidrawElements(elements); }
                        catch (e) { /* skeleton invalido: cargamos los elementos tal cual */ }
                    }
                }
                initialData = {
                    elements,
                    // collaborators debe ser un array/Map: forzamos vacío para evitar errores.
                    // Excalidraw siempre en tema claro con fondo blanco.
                    appState: Object.assign(
                        { viewBackgroundColor: '#ffffff' },
                        parsed.appState || {},
                        { collaborators: [], theme: 'light', viewBackgroundColor: '#ffffff' }
                    ),
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

        // Excalidraw siempre en tema claro (independiente del tema del visor).
        const theme = 'light';
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

    // Ajusta cada caja (rectangle/ellipse/diamond con label) EXACTAMENTE al tamano de
    // su texto: mide el ancho real de cada linea con canvas y fija width/height con un
    // padding minimo. Soporta labels multilinea (`\n`). Asi las cards quedan "justas al
    // texto" (no infladas) sin depender de lo que estimo la IA.
    _autoSizeNodes(elements) {
        if (!Array.isArray(elements)) return elements;
        const PAD_X = 14, PAD_Y = 10, LINE_H = 1.28;
        if (!this._measureCtx) {
            const c = document.createElement('canvas');
            this._measureCtx = c.getContext('2d');
        }
        const ctx = this._measureCtx;
        const SHAPES = { rectangle: 1, ellipse: 1, diamond: 1 };

        elements.forEach(el => {
            if (!el || !SHAPES[el.type]) return;
            const label = (el.label && typeof el.label === 'object') ? el.label : null;
            const text  = label ? String(label.text || '') : '';
            if (!text) return;
            const fs = Number(label.fontSize) || Number(el.fontSize) || 13;
            // Fuente comparable a la manuscrita de Excalidraw (ancho parecido).
            ctx.font = '400 ' + fs + 'px "Comic Sans MS", "Segoe Print", "Bradley Hand", cursive';
            const lines = text.split('\n');
            let maxW = 0;
            for (const ln of lines) {
                const w = ctx.measureText(ln.length ? ln : ' ').width;
                if (w > maxW) maxW = w;
            }
            // Elipse/diamante necesitan algo mas de holgura para no recortar el texto.
            const extra = (el.type === 'rectangle') ? 1 : 1.3;
            el.width  = Math.max(24, Math.ceil(maxW * extra + PAD_X * 2));
            el.height = Math.max(fs + PAD_Y, Math.ceil(lines.length * fs * LINE_H + PAD_Y * 2));
        });
        return elements;
    }

    // Resuelve las conexiones de una escena skeleton SIN depender del binding de
    // Excalidraw: toma cada arrow/line que referencia nodos por id (start/end) y
    // calcula sus puntos de BORDE A BORDE entre las dos cajas. Devuelve el array
    // con las conexiones PRIMERO (z-order: lineas debajo de los nodos) y luego el
    // resto. Asi el enlace siempre toca el borde correcto, sin importar la version.
    _resolveConnections(elements) {
        if (!Array.isArray(elements)) return elements;

        // Mapa id -> nodo con geometria (cajas/figuras, no conexiones).
        const byId = {};
        elements.forEach(el => {
            if (el && el.id != null && el.type &&
                el.type !== 'arrow' && el.type !== 'line' &&
                el.width != null && el.height != null) {
                byId[String(el.id)] = el;
            }
        });

        const centerOf = (n) => ({ x: n.x + (n.width || 0) / 2, y: n.y + (n.height || 0) / 2 });

        // Punto del borde del rect de 'n' en direccion al objetivo (tx,ty).
        const edgeOf = (n, tx, ty) => {
            const cx = n.x + (n.width || 0) / 2;
            const cy = n.y + (n.height || 0) / 2;
            const dx = tx - cx, dy = ty - cy;
            if (dx === 0 && dy === 0) return { x: cx, y: cy };
            const hw = (n.width || 0) / 2, hh = (n.height || 0) / 2;
            const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
            const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
            const s = Math.min(sx, sy);
            return { x: cx + dx * s, y: cy + dy * s };
        };

        const refId = (ref) => {
            if (ref == null) return null;
            if (typeof ref === 'string') return ref;
            if (typeof ref === 'object' && ref.id != null) return String(ref.id);
            return null;
        };

        const connections = [];
        const nodes = [];

        elements.forEach(el => {
            if (!el) return;
            const isConn = el.type === 'arrow' || el.type === 'line';
            if (!isConn) { nodes.push(el); return; }

            const a = byId[refId(el.start)];
            const b = byId[refId(el.end)];

            if (a && b) {
                const aC = centerOf(a), bC = centerOf(b);
                const p1 = edgeOf(a, bC.x, bC.y);   // borde de A hacia B
                const p2 = edgeOf(b, aC.x, aC.y);   // borde de B hacia A
                const w  = p2.x - p1.x, h = p2.y - p1.y;
                const conn = Object.assign({}, el, {
                    x: p1.x, y: p1.y,
                    width: w, height: h,
                    points: [[0, 0], [w, h]]
                });
                // Quitamos el binding por id: ya tenemos la geometria exacta y asi
                // convertToExcalidrawElements no intenta re-rutear (ni falla).
                delete conn.start;
                delete conn.end;
                connections.push(conn);
            } else {
                // Sin ids resolubles: la dejamos tal cual (quiza ya trae points).
                connections.push(el);
            }
        });

        // Conexiones primero -> quedan por debajo de los nodos (los extremos se
        // ocultan tras las cajas y se ve como si tocaran el borde).
        return connections.concat(nodes);
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

    // Muestra el lienzo en split (documento izq + Excalidraw der), igual que el
    // modo diagrama de draw.io. El documento NO se oculta: queda como referencia.
    _showStage(show) {
        // El panel derecho es uno solo: si habia un template renderizado, cede el sitio.
        if (show && typeof htmlStage !== 'undefined' && htmlStage && htmlStage.active) htmlStage.close();
        $('body').toggleClass('sketch-mode', show);
        $('#' + this.stageId).toggleClass('hidden', !show);
        $('.cs-tabs-inline, #btnEdit, #btnCopyPath, #docStyleSelect, .doc-zoom, .doc-toolbar-sep')
            .toggleClass('hidden', show);
        $('#btnCloseSketch').toggleClass('hidden', !show);
        if (typeof visorMountStageResizer === 'function') visorMountStageResizer(show);
    }

    async _save() {
        if (!this._api || !window.ExcalidrawLib) return;

        const elements = this._api.getSceneElements();
        const appState = this._api.getAppState();
        const files    = this._api.getFiles ? this._api.getFiles() : {};
        const json     = window.ExcalidrawLib.serializeAsJSON(elements, appState, files || {}, 'local');

        const file = this.currentFile;

        // Boceto NUEVO: guardar DENTRO DEL PROYECTO con el flujo estandar del visor
        // (openNewFileModal -> createFile), que graba en la carpeta abierta, recarga
        // el arbol de documentos y abre el archivo para visualizarlo/re-editarlo.
        if (!file || !file.fullPath) {
            if (typeof this.app.openNewFileModal !== 'function') {
                visorView.toast('No se puede guardar en este origen', 'error');
                return;
            }
            const base = (this.currentFile && this.currentFile.file) ? this.currentFile.file : 'boceto.excalidraw';
            const name = /\.excalidraw$/i.test(base) ? base : 'boceto.excalidraw';
            this.app.openNewFileModal({ name: name, content: json });
            return;
        }

        // Boceto EXISTENTE: sobrescribir su .excalidraw en disco.
        const $btn = $('#exSaveBtn').prop('disabled', true);
        const ok = await this._persist(file.fullPath, json);
        $btn.prop('disabled', false);
        if (!ok) return;

        file.raw = json;
        visorView.toast('Boceto guardado: ' + file.file, 'success');
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
