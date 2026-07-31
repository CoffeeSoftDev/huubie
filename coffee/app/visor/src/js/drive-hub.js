/* Explorador de Google Drive: navega las carpetas compartidas con la cuenta de
 * servicio y abre un documento en el visor que ya tienes abierto.
 *
 * Se monta solo sobre cualquier pagina que cargue este archivo (visor, playground,
 * forge, studio): no depende del layout de ninguna, solo de jQuery y de
 * ctrl/ctrl-drive-browser.php. Lo abre el icono Drive del launcher.
 *
 * Dos columnas: a la izquierda las unidades (lo que alguien compartio con la cuenta
 * de servicio) y los documentos abiertos hace poco; a la derecha el contenido de la
 * carpeta actual. Se pide UN nivel cada vez — a diferencia del origen "Drive" del
 * selector, que descarga el arbol entero y sustituye tu biblioteca. Al abrir, el
 * archivo entra en el visor como entrada efimera (lazyDrive + driveId, que es lo que
 * loadFile ya sabe leer) sin tocar la carpeta en la que estabas. */
(function (global) {
    'use strict';

    const API        = 'ctrl/ctrl-drive-browser.php';
    const RECENT_KEY = 'visor:driveRecent:v1';
    const HANDOFF    = 'visor:openDrive';   // relevo para las paginas sin visor
    const MAX_RECENT = 6;

    const ICON = {
        drive:   'hard-drive',
        folder:  'folder',
        text:    'file-text',
        gdoc:    'book-open',
        gsheet:  'file-spreadsheet',
        sheet:   'file-spreadsheet',
        image:   'image',
        pdf:     'file-type-2',
        gapp:    'file-question',
        other:   'file',
        search:  'search',
        close:   'x',
        wide:    'maximize-2',
        refresh: 'refresh-cw',
        right:   'chevron-right',
        open:    'external-link',
        link:    'link',
        empty:   'folder-search'
    };

    // Etiqueta legible del tipo, para el renglon secundario de cada archivo.
    const KIND_LABEL = {
        text:   'Texto',
        gdoc:   'Documento de Google',
        gsheet: 'Hoja de Google',
        sheet:  'Hoja de cálculo',
        image:  'Imagen',
        pdf:    'PDF',
        gapp:   'Archivo de Google',
        other:  'Archivo'
    };

    function ico(name) {
        return '<i data-lucide="' + name + '"></i>';
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    function plural(n, one, many) {
        return n + ' ' + (n === 1 ? one : many);
    }

    class DriveHub {

        constructor() {
            this.roots   = null;    // unidades compartidas (null = sin pedir todavia)
            this.path    = [];      // pila de { id, name } desde la unidad hasta aqui
            this.items   = [];      // contenido del nivel abierto
            this.sel     = null;    // archivo seleccionado (el de la vista previa)
            this.preview = null;    // respuesta de 'preview' para ese archivo
            this.query   = '';
            this.loading = false;
            this.mounted = false;
            this.recent  = this.readRecent();
        }

        // ── Documentos abiertos hace poco ───────────────────────────────────
        // Solo la ficha minima para reabrir (id, nombre, mime y de donde salio).
        // En el servidor va por cuenta (prefs.sqlite); la copia local lleva el id
        // para que dos cuentas en el mismo navegador no se mezclen.
        localKey() {
            return global.coffeeScopedKey ? global.coffeeScopedKey(RECENT_KEY) : RECENT_KEY;
        }

        readRecent() {
            try {
                const raw = localStorage.getItem(this.localKey());
                const arr = raw ? JSON.parse(raw) : [];
                return Array.isArray(arr) ? arr : [];
            } catch (e) { return []; }
        }

        pushRecent(item, whereLabel) {
            this.recent = [{
                id      : item.id,
                name    : item.name,
                mimeType: item.mimeType,
                kind    : item.kind,
                where   : whereLabel || '',
                // La carpeta de donde salio, para poder reabrirla sin volver a navegar.
                stack   : (this._openStack || this.path).map(p => ({ id: p.id, name: p.name }))
            }].concat(this.recent.filter(r => r.id !== item.id)).slice(0, MAX_RECENT);

            const value = JSON.stringify(this.recent);
            try { localStorage.setItem(this.localKey(), value); } catch (e) {}
            if (global.CoffeePrefs) global.CoffeePrefs.push(RECENT_KEY, value);
        }

        // ── Montaje ─────────────────────────────────────────────────────────
        mount() {
            if (this.mounted) return;
            this.mounted = true;

            $('body').append(
                '<div class="drv-veil" id="drvVeil" hidden>' +
                  '<section class="drv-modal" role="dialog" aria-label="Drive">' +
                    '<div class="drv-top">' +
                      '<span class="drv-badge">' + ico(ICON.drive) + '</span>' +
                      // El titulo refresca, como en el cajon de TODOs: un boton mas
                      // en la esquina desordena la barra para algo ocasional.
                      '<div><h2 data-drv="refresh" title="Volver a leer Drive">Drive</h2><p id="drvSummary">Buscando unidades…</p></div>' +
                      '<div class="drv-search">' + ico(ICON.search) +
                        '<input type="text" id="drvSearch" placeholder="Buscar por nombre…" autocomplete="off">' +
                        '<button class="drv-clear" data-drv="clearsearch" type="button" title="Limpiar">' + ico(ICON.close) + '</button>' +
                      '</div>' +
                      '<div class="drv-top-tools">' +
                        '<button class="drv-ico" data-drv="refresh" type="button" title="Refrescar">' + ico(ICON.refresh) + '</button>' +
                        '<button class="drv-ico" data-drv="wide" type="button" title="Agrandar">' + ico(ICON.wide) + '</button>' +
                        '<button class="drv-ico" data-drv="close" type="button" title="Cerrar">' + ico(ICON.close) + '</button>' +
                      '</div>' +
                    '</div>' +
                    '<div class="drv-body">' +
                      '<div class="drv-rail"><div class="drv-rail-scroll" id="drvRail"></div></div>' +
                      '<div class="drv-main" id="drvMain"></div>' +
                    '</div>' +
                    '<div class="drv-foot">' +
                      '<span class="drv-hint" id="drvHint"></span>' +
                      '<button class="drv-btn" data-drv="close" type="button">Cerrar</button>' +
                      '<button class="drv-btn is-primary" data-drv="open" type="button" disabled>' + ico(ICON.open) + ' Abrir</button>' +
                    '</div>' +
                  '</section>' +
                '</div>'
            );

            this.$veil = $('#drvVeil');
            this.$rail = $('#drvRail');
            this.$main = $('#drvMain');
            this.bind();
            this.icons();
        }

        icons() {
            if (global.lucide) global.lucide.createIcons();
        }

        // Aviso corto en la linea de resumen: la ventana vive en paginas que no
        // comparten el sistema de toast del visor.
        flash(msg, tone) {
            const $s = $('#drvSummary');
            if (!$s.length) return;
            clearTimeout(this.flashTimer);
            $s.text(msg).css('color', tone === 'error' ? '#FB7185' : (tone === 'ok' ? '#34D399' : ''));
            this.flashTimer = setTimeout(() => { $s.css('color', ''); this.summary(); }, 2800);
        }

        // ── Apertura / cierre ───────────────────────────────────────────────
        toggle() { this.isOpen() ? this.close() : this.open(); }

        open() {
            this.mount();
            this.$veil.prop('hidden', false).addClass('is-in');
            setTimeout(() => this.$veil.removeClass('is-in'), 200);
            if (this.roots === null) this.loadRoots();
            else                     this.render();
        }

        close() {
            if (this.$veil) this.$veil.prop('hidden', true);
        }

        isOpen() { return !!this.$veil && !this.$veil.prop('hidden'); }

        // ── Datos ───────────────────────────────────────────────────────────
        reasonOf(xhr) {
            if (!xhr || xhr.status === 0) return 'sin conexión con el servidor';
            const res = xhr.responseJSON;
            if (res && res.message) return res.message;
            return 'HTTP ' + xhr.status + ' ' + (xhr.statusText || '');
        }

        loadRoots() {
            this.loading = true;
            this.renderRail();
            this.renderMain();

            // El interruptor se apaga DENTRO de done/fail, no en always: always corre
            // despues, y renderizar con `loading` aun encendido deja el esqueleto
            // pintado encima de unos datos que ya llegaron.
            $.get(API, { action: 'roots' })
                .done((res) => {
                    this.loading = false;
                    if (!res || !res.success) { this.fail(res && res.message); return; }
                    this.roots = res.roots || [];
                    // Con una sola unidad no tiene sentido obligar a elegirla.
                    if (this.roots.length === 1 && !this.path.length) {
                        this.openRoot(this.roots[0]);
                        return;
                    }
                    this.render();
                })
                .fail((xhr) => this.fail(this.reasonOf(xhr)));
        }

        // Carga el contenido del ultimo nivel de `path`.
        list() {
            const here = this.path[this.path.length - 1];
            if (!here) { this.items = []; this.render(); return; }

            this.loading = true;
            this.sel = null;
            this.preview = null;
            this.render();

            $.get(API, { action: 'list', id: here.id })
                .done((res) => {
                    this.loading = false;
                    if (!res || !res.success) { this.fail(res && res.message); return; }
                    // Una respuesta que llega tarde no debe pisar otra carpeta.
                    if (res.id !== (this.path[this.path.length - 1] || {}).id) return;
                    this.items = res.items || [];
                    this.render();
                })
                .fail((xhr) => this.fail(this.reasonOf(xhr)));
        }

        search(q) {
            this.query = q;
            if (q.length < 2) { this.render(); return; }

            this.loading = true;
            this.render();

            // Con una unidad abierta se busca dentro de ella; desde la portada,
            // en todo lo que la cuenta de servicio alcanza.
            const root = this.path.length ? this.path[0].id : '';
            $.get(API, { action: 'search', q: q, root: this.path.length > 1 ? '' : root })
                .done((res) => {
                    this.loading = false;
                    if (!res || !res.success) { this.fail(res && res.message); return; }
                    if (res.query !== this.query) return;   // respuesta de una busqueda vieja
                    this.items = res.items || [];
                    this.render();
                })
                .fail((xhr) => this.fail(this.reasonOf(xhr)));
        }

        fail(msg) {
            this.loading = false;
            this.items = [];
            this.$main.html(this.emptyBlock(ICON.empty, 'No se pudo leer Drive', esc(msg || 'error desconocido')));
            this.renderFoot();
            this.icons();
        }

        // ── Navegacion ──────────────────────────────────────────────────────
        openRoot(root) {
            this.path  = [{ id: root.id, name: root.name }];
            this.query = '';
            $('#drvSearch').val('');
            this.$veil.removeClass('has-query');
            this.list();
        }

        enter(item) {
            this.path.push({ id: item.id, name: item.name });
            this.query = '';
            $('#drvSearch').val('');
            this.$veil.removeClass('has-query');
            this.list();
        }

        goTo(index) {
            if (index < 0) {                 // portada: volver a las unidades
                this.path = [];
                this.items = [];
                this.sel = null;
                this.preview = null;
                this.render();
                return;
            }
            this.path = this.path.slice(0, index + 1);
            this.list();
        }

        whereLabel() {
            return this.path.map(p => p.name).join(' / ');
        }

        // ── Vista previa ────────────────────────────────────────────────────
        select(item) {
            this.sel = item;
            this.preview = null;
            this.render();

            $.get(API, { action: 'preview', id: item.id, mime: item.mimeType, name: item.name })
                .done((res) => {
                    if (!res || !res.success) return;
                    if (!this.sel || this.sel.id !== item.id) return;
                    this.preview = res;
                    this.renderPreview();
                    this.icons();
                })
                .fail(() => {});
        }

        // ── Abrir en el visor ───────────────────────────────────────────────
        // Se arma la MISMA ficha que el backend manda para un archivo de Drive
        // (lazyDrive + driveId): loadFile ya sabe pedir su contenido a driveread.
        fileOf(item, whereLabel) {
            return {
                name       : String(item.name).replace(/\.(md|markdown)$/i, ''),
                file       : item.name,
                section    : 'documents',
                size       : item.size || '',
                isBackup   : false,
                frontmatter: { name: null, description: null, model: null, type: null, project: null, status: null, date: null },
                raw        : '',
                lazyDrive  : true,
                mtime      : item.mtime || '',
                fullPath   : 'drive://' + item.id,
                relPath    : 'drive/' + item.id + '/' + item.name,
                project    : 'Drive',
                type       : whereLabel || 'Drive',
                driveId    : item.id,
                mimeType   : item.mimeType || ''
            };
        }

        // El visor declara su instancia con `let app` a nivel de script, asi que NO
        // es window.app: hay que mirar el ambito global de scripts clasicos.
        visorApp() {
            const a = (typeof app !== 'undefined' && app) ? app : global.app;
            return (a && typeof a.loadFile === 'function') ? a : null;
        }

        openSelected() {
            const item = this.sel;
            if (!item || !item.openable) return;
            const where = this.whereLabel();
            this.pushRecent(item, where);

            const a = this.visorApp();
            // Un reciente se abre desde la carpeta que traia guardada, no desde la
            // que este abierta ahora en el explorador.
            const stack = this._openStack || this.path;
            this._openStack = null;

            // En el visor: se planta en LA CARPETA de donde salio el archivo y lo
            // abre ahi. Asi el sidebar muestra lo que hay al lado, en vez de dejar
            // el documento suelto sobre otra biblioteca.
            if (a && typeof a.openDriveFolder === 'function' && stack.length) {
                this.close();
                a.openDriveFolder(stack, item.name);
                return;
            }

            // Playground, Forge y Studio no tienen visor que pilotar: se deja el
            // archivo en relevo y se abre el visor en otra pestana.
            try {
                localStorage.setItem(HANDOFF, JSON.stringify({
                    file : this.fileOf(item, where),
                    stack: this.path
                }));
            } catch (e) {}
            this.close();
            global.open('index.php?drive=1', '_blank');
        }

        // ── Render ──────────────────────────────────────────────────────────
        summary() {
            const $s = $('#drvSummary');
            if (!$s.length) return;

            if (this.roots === null)  { $s.text('Buscando unidades…'); return; }
            if (!this.path.length)    { $s.text(plural((this.roots || []).length, 'unidad compartida', 'unidades compartidas')); return; }
            if (this.query.length >= 2) { $s.text(plural(this.items.length, 'resultado', 'resultados') + ' para “' + this.query + '”'); return; }

            const folders = this.items.filter(i => i.isFolder).length;
            $s.text(this.whereLabel() + ' · ' + plural(folders, 'carpeta', 'carpetas') + ', ' + plural(this.items.length - folders, 'archivo', 'archivos'));
        }

        render() {
            this.summary();
            this.$veil.toggleClass('has-query', this.query !== '');
            this.renderRail();
            this.renderMain();
            this.renderFoot();
            this.icons();
        }

        renderRail() {
            const roots = this.roots || [];
            const openId = this.path.length ? this.path[0].id : null;

            let html = '<div class="drv-group">Unidades</div>';
            if (this.roots === null) {
                html += '<div class="drv-skeleton"><i></i><i></i><i></i></div>';
            } else if (!roots.length) {
                html += '<div style="padding:10px;font-size:11.5px;color:var(--drv-dim);line-height:1.6">' +
                          'Ninguna carpeta compartida con la cuenta de servicio todavía.' +
                        '</div>';
            } else {
                html += roots.map(r =>
                    '<button class="drv-item' + (r.id === openId ? ' is-on' : '') + '" data-drv="root" data-id="' + esc(r.id) + '" type="button">' +
                      '<span class="drv-item-ico k-folder">' + ico(ICON.drive) + '</span>' +
                      '<span class="drv-item-main"><b>' + esc(r.name) + '</b></span>' +
                    '</button>'
                ).join('');
            }

            if (this.recent.length) {
                html += '<div class="drv-group">Abiertos hace poco</div>';
                html += this.recent.map(r =>
                    '<button class="drv-item" data-drv="recent" data-id="' + esc(r.id) + '" type="button" title="' + esc(r.where || '') + '">' +
                      '<span class="drv-item-ico k-' + esc(r.kind || 'other') + '">' + ico(ICON[r.kind] || ICON.other) + '</span>' +
                      '<span class="drv-item-main"><b>' + esc(r.name) + '</b><small>' + esc(r.where || 'Drive') + '</small></span>' +
                    '</button>'
                ).join('');
            }

            this.$rail.html(html);
        }

        crumbsBar() {
            if (!this.path.length) return '';
            const parts = this.path.map((p, i) =>
                '<button data-drv="crumb" data-i="' + i + '" type="button" class="' + (i === this.path.length - 1 ? 'is-now' : '') + '">' +
                  esc(p.name) +
                '</button>'
            );
            return '<div class="drv-crumbs">' + ico(ICON.drive) +
                     '<button data-drv="crumb" data-i="-1" type="button">Unidades</button>' +
                     parts.map(p => ico(ICON.right) + p).join('') +
                   '</div>';
        }

        renderMain() {
            // Portada: sin unidad abierta se explica que es esto y de donde sale.
            if (!this.path.length && this.query.length < 2) {
                const roots = this.roots || [];
                this.$main.html(
                    this.crumbsBar() +
                    '<div class="drv-scroll">' +
                      (this.roots === null
                        ? '<div class="drv-skeleton"><i></i><i></i><i></i><i></i></div>'
                        : (roots.length
                            ? '<div class="drv-group">Elige una unidad</div>' +
                              roots.map(r =>
                                '<button class="drv-item" data-drv="root" data-id="' + esc(r.id) + '" type="button">' +
                                  '<span class="drv-item-ico k-folder">' + ico(ICON.drive) + '</span>' +
                                  '<span class="drv-item-main"><b>' + esc(r.name) + '</b><small>Carpeta compartida</small></span>' +
                                  '<span class="drv-item-chev">' + ico(ICON.right) + '</span>' +
                                '</button>').join('')
                            : this.emptyBlock(ICON.drive, 'No hay carpetas compartidas',
                                'Comparte una carpeta de Drive con el correo de la cuenta de servicio del visor y aparecerá aquí.'))) +
                    '</div>'
                );
                return;
            }

            const rows = this.loading
                ? '<div class="drv-skeleton"><i></i><i></i><i></i><i></i></div>'
                : (this.items.length
                    ? this.items.map(it => this.itemRow(it)).join('')
                    : this.emptyBlock(ICON.empty,
                        this.query.length >= 2 ? 'Sin resultados' : 'Carpeta vacía',
                        this.query.length >= 2
                            ? 'Nada coincide con “' + esc(this.query) + '”.'
                            : 'Esta carpeta no tiene nada que el visor pueda listar.'));

            this.$main.html(
                this.crumbsBar() +
                '<div class="drv-scroll">' + rows + '</div>' +
                this.previewBlock()
            );
        }

        itemRow(item) {
            const on   = !!(this.sel && this.sel.id === item.id);
            const meta = [item.size, item.mtime ? item.mtime.slice(0, 10) : ''].filter(Boolean).join(' · ');

            return '<button class="drv-item' + (on ? ' is-on' : '') + (item.isFolder || item.openable ? '' : ' is-off') + '" ' +
                        'data-drv="item" data-id="' + esc(item.id) + '" type="button" title="' + esc(item.name) + '">' +
                     '<span class="drv-item-ico k-' + esc(item.kind) + '">' + ico(ICON[item.kind] || ICON.other) + '</span>' +
                     '<span class="drv-item-main"><b>' + esc(item.name) + '</b>' +
                       (item.isFolder ? '' : '<small>' + esc(KIND_LABEL[item.kind] || 'Archivo') + '</small>') +
                     '</span>' +
                     (item.isFolder
                        ? '<span class="drv-item-chev">' + ico(ICON.right) + '</span>'
                        : (item.openable
                            ? '<span class="drv-item-meta">' + esc(meta) + '</span>'
                            : '<span class="drv-tag">no soportado</span>')) +
                   '</button>';
        }

        previewBlock() {
            if (!this.sel) return '';
            return '<div class="drv-prev" id="drvPrev"></div>';
        }

        renderPreview() {
            const $p = $('#drvPrev');
            if (!$p.length || !this.sel) return;

            const item = this.sel;
            const body = this.preview
                ? (this.preview.text
                    ? '<pre class="drv-prev-txt">' + esc(this.preview.text) + '</pre>'
                    : '<p class="drv-prev-note">' + esc(this.preview.note || '') + '</p>')
                : '<p class="drv-prev-note">Leyendo…</p>';

            $p.html(
                '<h4>Vista previa · ' + esc(item.name) + '</h4>' +
                '<div class="drv-prev-card">' +
                  body +
                  '<div class="drv-prev-acts">' +
                    '<button class="drv-btn is-primary" data-drv="open" type="button"' + (item.openable ? '' : ' disabled') + '>' +
                      ico(ICON.open) + ' Abrir' +
                    '</button>' +
                    '<a class="drv-btn" href="' + esc(item.link) + '" target="_blank" rel="noopener">' + ico(ICON.link) + ' Ver en Drive</a>' +
                  '</div>' +
                '</div>'
            );
        }

        renderFoot() {
            const item = this.sel;
            $('#drvHint').html(item
                ? (item.openable
                    ? 'Se abrirá en <b>el visor que ya tienes abierto</b>, sin cambiar tu carpeta actual.'
                    : 'El visor no puede mostrar <b>' + esc(item.name) + '</b> desde Drive.')
                : 'Elige un documento para abrirlo.');
            $('.drv-foot [data-drv="open"]').prop('disabled', !(item && item.openable));
            this.renderPreview();
        }

        emptyBlock(iconName, title, sub) {
            return '<div class="drv-empty">' +
                     '<div class="drv-empty-ico">' + ico(iconName) + '</div>' +
                     '<p>' + title + '</p>' +
                     '<small>' + sub + '</small>' +
                   '</div>';
        }

        itemById(id) {
            return this.items.filter(i => i.id === id)[0] || null;
        }

        // ── Eventos ─────────────────────────────────────────────────────────
        bind() {
            const self = this;
            const $v = this.$veil;

            $v.on('click', function (e) { if (e.target === this) self.close(); });
            $(document).on('keydown.drv', (e) => {
                if (e.key === 'Escape' && this.isOpen()) this.close();
            });

            $v.on('click', '[data-drv="close"]', () => this.close());
            $v.on('click', '[data-drv="wide"]',  () => $v.toggleClass('is-wide'));
            $v.on('click', '[data-drv="refresh"]', () => {
                this.roots = null;
                this.items = [];
                this.sel = null;
                this.loadRoots();
                if (this.path.length) this.list();
            });

            $v.on('click', '[data-drv="root"]', function () {
                const id = $(this).data('id');
                const root = (self.roots || []).filter(r => r.id === id)[0];
                if (root) self.openRoot(root);
            });

            $v.on('click', '[data-drv="crumb"]', function () {
                self.goTo(parseInt($(this).data('i'), 10));
            });

            // Carpeta: entrar. Archivo abrible: seleccionar (la vista previa manda
            // antes de abrir). El resto no responde.
            $v.on('click', '[data-drv="item"]', function () {
                const item = self.itemById($(this).data('id'));
                if (!item) return;
                if (item.isFolder)   { self.enter(item); return; }
                if (!item.openable)  return;
                self.select(item);
            });

            // Doble clic: abrir directo, como en cualquier explorador.
            $v.on('dblclick', '[data-drv="item"]', function () {
                const item = self.itemById($(this).data('id'));
                if (!item || item.isFolder || !item.openable) return;
                self.sel = item;
                self.openSelected();
            });

            $v.on('click', '[data-drv="recent"]', function () {
                const r = self.recent.filter(x => x.id === $(this).data('id'))[0];
                if (!r) return;
                // El reciente guarda lo justo para reabrir: se completa la ficha y se
                // usa SU carpeta, no la que este abierta en el explorador.
                self.sel = { id: r.id, name: r.name, mimeType: r.mimeType, kind: r.kind, openable: true, size: '', mtime: '', link: 'https://drive.google.com/open?id=' + r.id };
                self._openStack = Array.isArray(r.stack) && r.stack.length ? r.stack : null;
                self.openSelected();
            });

            $v.on('click', '[data-drv="open"]', () => this.openSelected());

            $v.on('click', '[data-drv="clearsearch"]', () => {
                this.query = '';
                $('#drvSearch').val('');
                if (this.path.length) this.list();
                else                  this.render();
            });

            let searchTimer = null;
            $v.on('input', '#drvSearch', function () {
                const value = this.value.trim();
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    if (value.length < 2 && self.query.length >= 2) {
                        // Al borrar la busqueda se vuelve a la carpeta donde estabas.
                        self.query = '';
                        if (self.path.length) self.list(); else self.render();
                        return;
                    }
                    if (value.length >= 2) self.search(value);
                }, 260);
            });
        }
    }

    global.DriveHub = DriveHub;
    global.driveHub = new DriveHub();

    $(function () {
        $(document).on('launcher:launch', function (e, name) {
            if (name === 'drive') global.driveHub.open();
        });
    });
})(window);
