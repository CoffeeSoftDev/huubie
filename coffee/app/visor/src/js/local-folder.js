/* Origen "Carpeta local": abre una carpeta del disco DEL USUARIO desde el navegador,
 * sin pasar por PHP.
 *
 * Por que existe: el origen Custom del visor le pide al backend que liste una ruta,
 * asi que lee el disco del servidor donde corre PHP. En local eso coincide con la
 * maquina del usuario y todo funciona; con el visor publicado, "C:/wamp64/..." no
 * existe alla y la carpeta nunca abre. La File System Access API es la unica via:
 * el navegador pide permiso sobre una carpeta y el visor la lee y la escribe en el
 * cliente.
 *
 * Limites conocidos (por diseno del navegador, no del visor):
 *   - Chrome / Edge / Opera. Firefox y Safari no traen la API.
 *   - Solo en https:// o localhost (contexto seguro).
 *   - El permiso NO sobrevive al cierre de la pestana: el handle se guarda en
 *     IndexedDB y al volver hay que reconceder con un clic ("Reconectar carpeta").
 *
 * Esta primera version cubre listar, navegar, leer y guardar archivos de texto.
 * Crear, renombrar y borrar siguen siendo del backend y quedan desactivados aqui,
 * igual que los binarios (hojas, imagenes, PDF), que se leen por otro endpoint. */
(function (global) {
    'use strict';

    const DB_NAME  = 'coffee-visor-fs';
    const STORE    = 'handles';
    const ROOT_KEY = 'root';

    // Mismas extensiones de texto que el backend acepta en Custom. Los binarios se
    // omiten: sus bytes se piden con ?action=readbin, que aqui no aplica.
    const TEXT_EXTS = [
        'md', 'markdown', 'txt', 'json', 'yml', 'yaml', 'toml', 'xml', 'csv', 'tsv',
        'html', 'htm', 'css', 'scss', 'js', 'ts', 'php', 'py', 'rb', 'go', 'rs',
        'java', 'c', 'cpp', 'cs', 'sh', 'sql', 'ini', 'conf', 'log', 'env',
        'drawio', 'excalidraw'
    ];

    function extOf(name) {
        const i = String(name).lastIndexOf('.');
        return i === -1 ? '' : String(name).slice(i + 1).toLowerCase();
    }

    function isTextFile(name) {
        return TEXT_EXTS.indexOf(extOf(name)) !== -1;
    }

    function labelOf(name) {
        return /\.(md|markdown)$/i.test(name) ? name.replace(/\.(md|markdown)$/i, '') : name;
    }

    function fmtSize(bytes) {
        if (bytes < 1024)        return bytes + ' B';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // 'Y-m-d H:i:s', el mismo formato que manda el backend.
    function fmtTime(ms) {
        const d = new Date(ms || Date.now());
        const p = (n) => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
               p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }

    function frontmatterOf(raw) {
        if (global.visor && typeof global.visor.parseFrontmatter === 'function') {
            return global.visor.parseFrontmatter(raw);
        }
        return {};
    }

    // ── Persistencia del handle ─────────────────────────────────────────────
    // El objeto del navegador es serializable en IndexedDB (no en localStorage):
    // asi al recargar sabemos QUE carpeta era y solo hace falta reconceder permiso.
    function idb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror   = () => reject(req.error);
        });
    }

    function idbPut(key, value) {
        return idb().then((db) => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(value, key);
            tx.oncomplete = () => resolve(true);
            tx.onerror    = () => reject(tx.error);
        }));
    }

    function idbGet(key) {
        return idb().then((db) => new Promise((resolve, reject) => {
            const tx  = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror   = () => reject(req.error);
        }));
    }

    class LocalFolder {

        constructor() {
            this.root = null;        // FileSystemDirectoryHandle de la carpeta elegida
            this.tried = false;      // ya se intento recuperar el handle guardado
        }

        supported() {
            return typeof global.showDirectoryPicker === 'function';
        }

        // La API solo vive en contexto seguro; en http:// ni siquiera esta definida,
        // pero el aviso ayuda a entender por que.
        secureContext() {
            return global.isSecureContext !== false;
        }

        rootName() {
            return this.root ? this.root.name : '';
        }

        hasRoot() {
            return !!this.root;
        }

        // Elige carpeta (requiere gesto del usuario) y la recuerda para la proxima vez.
        async pick() {
            if (!this.supported()) throw new Error('Tu navegador no permite abrir carpetas locales (usa Chrome o Edge)');
            const handle = await global.showDirectoryPicker({ id: 'coffee-visor', mode: 'readwrite' });
            this.root  = handle;
            this.tried = true;
            try { await idbPut(ROOT_KEY, handle); } catch (e) {}
            return handle;
        }

        // Recupera el handle guardado. NO pide permiso: eso exige un clic del usuario.
        async restore() {
            if (this.root || this.tried) return this.root;
            this.tried = true;
            try { this.root = await idbGet(ROOT_KEY); } catch (e) { this.root = null; }
            return this.root;
        }

        async forget() {
            this.root = null;
            try { await idbPut(ROOT_KEY, null); } catch (e) {}
        }

        // 'granted' | 'prompt' | 'denied' | 'none' (sin carpeta recordada).
        async permission() {
            if (!this.root) return 'none';
            if (typeof this.root.queryPermission !== 'function') return 'granted';
            try {
                return await this.root.queryPermission({ mode: 'readwrite' });
            } catch (e) {
                return 'denied';
            }
        }

        // Pide el permiso. Solo prospera dentro de un gesto del usuario.
        async requestPermission() {
            if (!this.root) return 'none';
            if (typeof this.root.requestPermission !== 'function') return 'granted';
            try {
                return await this.root.requestPermission({ mode: 'readwrite' });
            } catch (e) {
                return 'denied';
            }
        }

        // ── Rutas virtuales ─────────────────────────────────────────────────
        // No hay ruta absoluta que mostrar (el navegador no la revela), asi que se
        // usa "<carpeta>/sub/archivo.md". El primer segmento es el nombre de la raiz
        // elegida y sirve de ancla: todo lo que cuelgue de el es local.
        path(segments) {
            return [this.rootName()].concat(segments || []).filter(Boolean).join('/');
        }

        // Segmentos internos de una ruta virtual (sin el nombre de la raiz).
        segmentsOf(virtualPath) {
            const parts = String(virtualPath || '').replace(/\\/g, '/').split('/').filter(Boolean);
            if (parts.length && parts[0] === this.rootName()) parts.shift();
            return parts;
        }

        isLocalPath(virtualPath) {
            const parts = String(virtualPath || '').replace(/\\/g, '/').split('/').filter(Boolean);
            return !!this.rootName() && parts.length > 0 && parts[0] === this.rootName();
        }

        async dirHandle(segments) {
            let dir = this.root;
            for (const seg of (segments || [])) {
                dir = await dir.getDirectoryHandle(seg);
            }
            return dir;
        }

        // ── Lectura de la biblioteca ────────────────────────────────────────
        // Devuelve el MISMO payload que el backend arma para el origen Custom
        // (agents + folders + header), para que el explorador y el sidebar no
        // tengan que distinguir de donde salio.
        async buildLibrary(virtualPath, presets) {
            const segs = this.segmentsOf(virtualPath);
            const dir  = await this.dirHandle(segs);
            const here = this.path(segs);

            const files   = [];
            const folders = [];

            for await (const [name, handle] of dir.entries()) {
                if (name.charAt(0) === '.') continue;      // dotfiles fuera, como en Custom

                if (handle.kind === 'directory') {
                    folders.push({ name: name, fullPath: here + '/' + name, count: await this.countOf(handle) });
                    continue;
                }
                if (!isTextFile(name)) continue;           // binarios: no en esta version

                const file = await handle.getFile();
                const raw  = await file.text();
                files.push({
                    name       : labelOf(name),
                    file       : name,
                    section    : 'agentes',
                    size       : fmtSize(file.size),
                    isBackup   : name.toLowerCase().indexOf('backup') !== -1,
                    frontmatter: frontmatterOf(raw),
                    raw        : raw,
                    lazyBinary : false,
                    mediaKind  : '',
                    mtime      : fmtTime(file.lastModified),
                    fullPath   : here + '/' + name,
                    relPath    : here + '/' + name,
                    local      : true          // marca que el guardado va por esta API
                });
            }

            files.sort((a, b) => a.name.localeCompare(b.name));
            folders.sort((a, b) => a.name.localeCompare(b.name));

            return {
                header: {
                    title       : 'CoffeeDocs',
                    subtitle    : 'CoffeeSoft Library',
                    pathLabel   : here,
                    source      : 'Navegador',
                    currentKey  : 'local',
                    currentLabel: this.rootName(),
                    currentPath : here,
                    parentPath  : segs.length ? this.path(segs.slice(0, -1)) : null,
                    valid       : true,
                    presets     : presets || [],
                    sectionLabel: null,
                    local       : true
                },
                agents   : files,
                grimoires: [],
                folders  : folders
            };
        }

        // Conteo de entradas visibles para la burbuja de cada tarjeta de carpeta.
        async countOf(dirHandle) {
            let n = 0;
            try {
                for await (const [name] of dirHandle.entries()) {
                    if (name.charAt(0) !== '.') n++;
                }
            } catch (e) { return 0; }
            return n;
        }

        // ── Escritura ───────────────────────────────────────────────────────
        async write(virtualPath, content) {
            const segs = this.segmentsOf(virtualPath);
            const name = segs.pop();
            if (!name) throw new Error('Ruta local invalida');

            const dir    = await this.dirHandle(segs);
            const handle = await dir.getFileHandle(name);
            const stream = await handle.createWritable();
            await stream.write(content);
            await stream.close();

            const file = await handle.getFile();
            return { size: fmtSize(file.size), mtime: fmtTime(file.lastModified) };
        }
    }

    global.localFolder = new LocalFolder();
})(window);
