/* Centro de TODOs: reune las listas todo*.json que el usuario tiene repartidas por
 * la biblioteca y las deja trabajar sin abrir cada archivo en el visor.
 *
 * Se monta solo, al vuelo, sobre cualquier pagina que cargue este archivo (visor,
 * playground, forge, studio): no depende del layout de ninguna, solo de jQuery y
 * de ctrl/ctrl-todos.php. Lo abre el icono TODO del launcher.
 *
 * Dos columnas: a la izquierda todas las listas encontradas (mas la Bandeja, que
 * junta los pendientes de todas); a la derecha la lista elegida, editable. Cada
 * cambio (palomear, escribir, borrar) reescribe el todo.json completo en el disco:
 * es el mismo formato que ya lee el visor, asi que un archivo tocado aqui se sigue
 * abriendo alla y al reves. */
(function (global) {
    'use strict';

    const API      = 'ctrl/ctrl-todos.php';
    const PREF_KEY = 'visor:todoArchived:v1';
    const SAVED_EVENT = 'visor:todo-saved';

    const ICON = {
        list:    'list-checks',
        inbox:   'inbox',
        plus:    'plus',
        close:   'x',
        wide:    'maximize-2',
        search:  'search',
        right:   'chevron-right',
        down:    'chevron-down',
        open:    'external-link',
        copy:    'copy',
        archive: 'archive',
        restore: 'archive-restore',
        check:   'check',
        folder:  'folder',
        layers:  'layers',
        zap:     'zap',
        send:    'arrow-up',
        dest:    'corner-down-right',
        file:    'file-plus-2',
        empty:   'folder-search'
    };

    function ico(name) {
        return '<i data-lucide="' + name + '"></i>';
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    function uid(prefix) {
        return prefix + Math.random().toString(36).slice(2, 9);
    }

    // Resalta el termino buscado sobre texto ya escapado.
    function mark(text, query) {
        const safe = esc(text);
        if (!query) return safe;
        const rx = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        return safe.replace(rx, '<mark>$1</mark>');
    }

    function plural(n, one, many) {
        return n + ' ' + (n === 1 ? one : many);
    }

    class TodoHub {

        constructor() {
            this.lists    = [];
            this.archived = this.readArchived();
            this.openKey  = null;       // lista abierta; null = Bandeja
            this.destKey  = null;       // destino de la captura rapida: "listKey::secId"
            this.query    = '';
            this.filter   = 'pending';  // pending | all | done
            this.showEmpty    = false;
            this.showArchived = false;
            this.formOpen = false;
            this.folders  = null;
            this.loading  = false;
            this.mounted  = false;
            this.saveTimers = {};
        }

        // ── Preferencia de archivado ────────────────────────────────────────
        // Solo se guardan claves de lista (ruta relativa), nunca el contenido: el
        // todo.json es del proyecto y no debe llevar estado de interfaz dentro.
        // En el servidor ya va por cuenta (prefs.sqlite); la copia local tambien
        // lleva el id, para que dos cuentas en el mismo navegador no se mezclen.
        localKey() {
            return global.coffeeScopedKey ? global.coffeeScopedKey(PREF_KEY) : PREF_KEY;
        }

        readArchived() {
            try {
                const raw = localStorage.getItem(this.localKey());
                const arr = raw ? JSON.parse(raw) : [];
                return Array.isArray(arr) ? arr : [];
            } catch (e) { return []; }
        }

        writeArchived() {
            const value = JSON.stringify(this.archived);
            try { localStorage.setItem(this.localKey(), value); } catch (e) {}
            // Al servidor va con la clave limpia: alli la cuenta la pone la sesion.
            if (global.CoffeePrefs) global.CoffeePrefs.push(PREF_KEY, value);
        }

        isArchived(key) { return this.archived.indexOf(key) !== -1; }

        // ── Montaje ─────────────────────────────────────────────────────────
        mount() {
            if (this.mounted) return;
            this.mounted = true;

            $('body').append(
                '<div class="tdw-veil" id="tdwVeil" hidden>' +
                  '<section class="tdw-modal" role="dialog" aria-label="TODO">' +
                    '<div class="tdw-top">' +
                      '<span class="tdw-badge">' + ico(ICON.list) + '</span>' +
                      // El titulo hace de boton de refresco: un tercer boton en la
                      // esquina desordena la barra y esto no se busca a diario.
                      '<div><h2 data-tdw="refresh" title="Refrescar listas">TODO</h2><p id="tdwSummary">Buscando listas…</p></div>' +
                      '<div class="tdw-seg">' +
                        '<button data-tdw="filter" data-f="pending" class="is-on" type="button">Pendientes</button>' +
                        '<button data-tdw="filter" data-f="all" type="button">Todas</button>' +
                        '<button data-tdw="filter" data-f="done" type="button">Hechas</button>' +
                      '</div>' +
                      '<button class="tdw-ico" data-tdw="wide" type="button" title="Agrandar">' + ico(ICON.wide) + '</button>' +
                      '<button class="tdw-ico" data-tdw="close" type="button" title="Cerrar">' + ico(ICON.close) + '</button>' +
                    '</div>' +
                    '<div class="tdw-body">' +
                      '<div class="tdw-rail">' +
                        '<div class="tdw-search">' + ico(ICON.search) +
                          '<input type="text" id="tdwSearch" placeholder="Buscar lista o tarea…" autocomplete="off">' +
                          '<button class="tdw-clear" data-tdw="clearsearch" type="button" title="Limpiar">' + ico(ICON.close) + '</button>' +
                        '</div>' +
                        '<div class="tdw-rail-scroll" id="tdwRail"><div class="tdw-skeleton"><i></i><i></i><i></i><i></i></div></div>' +
                        '<div class="tdw-rail-foot">' +
                          '<button class="tdw-newbtn" data-tdw="new" type="button">' + ico(ICON.plus) + ' Nuevo TODO</button>' +
                        '</div>' +
                      '</div>' +
                      '<div class="tdw-main" id="tdwMain"></div>' +
                    '</div>' +
                  '</section>' +
                '</div>'
            );

            this.$veil = $('#tdwVeil');
            this.$rail = $('#tdwRail');
            this.$main = $('#tdwMain');
            this.bind();
            this.icons();
        }

        icons() {
            if (global.lucide) global.lucide.createIcons();
        }

        // Aviso corto en la linea de resumen: la ventana vive en paginas que no
        // comparten el sistema de toast del visor.
        flash(msg, tone) {
            const $s = $('#tdwSummary');
            if (!$s.length) return;
            clearTimeout(this.flashTimer);
            $s.text(msg).css('color', tone === 'error' ? '#FB7185' : (tone === 'ok' ? '#34D399' : ''));
            this.flashTimer = setTimeout(() => { $s.css('color', ''); this.summary(); }, 2600);
        }

        // ── Apertura / cierre ───────────────────────────────────────────────
        toggle() { this.isOpen() ? this.close() : this.open(); }

        open() {
            this.mount();
            this.$veil.prop('hidden', false).addClass('is-in');
            setTimeout(() => this.$veil.removeClass('is-in'), 200);
            this.scan();
        }

        close() {
            if (!this.$veil) return;
            this.$veil.prop('hidden', true);
            this.closeForm();
        }

        isOpen() { return !!this.$veil && !this.$veil.prop('hidden'); }

        // ── Datos ───────────────────────────────────────────────────────────
        scan() {
            if (this.loading) return;
            this.loading = true;
            $('#tdwSummary').text('Buscando listas…');

            $.get(API, { action: 'scan' })
                .done((res) => {
                    if (!res || !res.success) { this.fail(res && res.message); return; }
                    this.lists = res.lists || [];
                    this.render();
                })
                .fail((xhr) => this.fail(this.reasonOf(xhr)))
                .always(() => { this.loading = false; });
        }

        reasonOf(xhr) {
            if (!xhr || xhr.status === 0) return 'sin conexion con el servidor';
            const res = xhr.responseJSON;
            if (res && res.message) return res.message;
            return 'HTTP ' + xhr.status + ' ' + (xhr.statusText || '');
        }

        fail(msg) {
            this.$rail.empty();
            this.$main.html(this.emptyBlock(ICON.empty, 'No se pudieron leer las listas', esc(msg || 'error desconocido')));
            this.icons();
        }

        emptyBlock(iconName, title, sub) {
            return '<div class="tdw-empty">' +
                     '<div class="tdw-empty-ico">' + ico(iconName) + '</div>' +
                     '<p>' + title + '</p>' +
                     '<small>' + sub + '</small>' +
                   '</div>';
        }

        listByKey(key) {
            return this.lists.filter((l) => l.key === key)[0] || null;
        }

        visibleLists() {
            return this.lists.filter((l) => !this.isArchived(l.key));
        }

        // Que tareas entran segun el segmento activo.
        keeps(task) {
            if (this.filter === 'pending') return !task.done;
            if (this.filter === 'done')    return !!task.done;
            return true;
        }

        // El JSON que se escribe en disco: solo titulo y secciones, en el mismo
        // formato que ya lee el visor. Los contadores se recalculan al leer.
        payloadOf(list) {
            return JSON.stringify({
                title: list.title,
                sections: (list.sections || []).map((s) => ({
                    id: s.id,
                    title: s.title,
                    tasks: (s.tasks || []).map((t) => ({ id: t.id, text: t.text, done: !!t.done }))
                }))
            }, null, 2);
        }

        recount(list) {
            let total = 0, done = 0;
            (list.sections || []).forEach((s) => (s.tasks || []).forEach((t) => {
                total++;
                if (t.done) done++;
            }));
            list.total = total;
            list.done = done;
            list.pending = total - done;
        }

        // Guarda con retardo para no escribir en cada tecla; `now` fuerza el envio
        // en las acciones que el usuario percibe como definitivas (palomear, borrar).
        persist(list, now) {
            this.recount(list);
            this.summary();
            this.renderRail();
            this.renderProgress();
            clearTimeout(this.saveTimers[list.key]);

            const send = () => {
                $.post(API, { action: 'save', fullPath: list.fullPath, content: this.payloadOf(list) })
                    .done((res) => {
                        if (!res || !res.success) { this.flash((res && res.message) || 'no se pudo guardar', 'error'); return; }
                        // El visor puede tener este mismo archivo abierto: que lo
                        // recargue en vez de quedarse con la version vieja y pisarla.
                        try {
                            document.dispatchEvent(new CustomEvent(SAVED_EVENT, { detail: { fullPath: list.fullPath } }));
                        } catch (e) {}
                    })
                    .fail((xhr) => this.flash(this.reasonOf(xhr), 'error'));
            };

            if (now) send(); else this.saveTimers[list.key] = setTimeout(send, 550);
        }

        // ── Render ──────────────────────────────────────────────────────────
        summary() {
            const visible = this.visibleLists();
            const pending = visible.reduce((n, l) => n + l.pending, 0);
            const active  = visible.filter((l) => l.total > 0).length;
            $('#tdwSummary').text(plural(pending, 'pendiente', 'pendientes') + ' · ' + plural(active, 'lista activa', 'listas activas'));
        }

        render() {
            this.summary();
            this.$veil.toggleClass('has-query', this.query !== '');
            this.renderRail();
            this.renderMain();
            this.icons();
        }

        renderRail() {
            const q        = this.query.toLowerCase();
            const matches  = (l) => !q || String(l.title + ' ' + l.pathLabel).toLowerCase().indexOf(q) !== -1;
            const mine     = this.visibleLists().filter(matches);
            const withWork = mine.filter((l) => l.total > 0 || l.key === this.openKey);
            const empty    = mine.filter((l) => l.total === 0 && l.key !== this.openKey);
            const archived = this.lists.filter((l) => this.isArchived(l.key)).filter(matches);
            const pending  = this.visibleLists().reduce((n, l) => n + l.pending, 0);

            let html =
                '<button class="tdw-item' + (this.openKey === null && !this.formOpen ? ' is-on' : '') + '" data-tdw="inbox" type="button">' +
                  '<span class="tdw-item-dot">' + ico(ICON.inbox) + '</span>' +
                  '<span class="tdw-item-main"><b>Bandeja</b><small>Pendientes de todas las carpetas</small></span>' +
                  '<span class="tdw-count">' + pending + '</span>' +
                '</button>';

            if (withWork.length) {
                html += '<div class="tdw-group" data-tdw="nogroup">Listas<span>' + withWork.length + '</span></div>';
                html += withWork.map((l) => this.railItem(l)).join('');
            }
            if (empty.length) {
                html += this.groupRow('empty', 'Sin tareas', empty.length, this.showEmpty);
                if (this.showEmpty) html += empty.map((l) => this.railItem(l)).join('');
            }
            if (archived.length) {
                html += this.groupRow('archived', 'Archivadas', archived.length, this.showArchived, ICON.archive);
                if (this.showArchived) html += archived.map((l) => this.railItem(l, true)).join('');
            }
            if (!this.lists.length) {
                html += '<div style="padding:14px 8px;font-size:11.5px;color:var(--tdw-dim);line-height:1.6">Todavía no hay listas en tu biblioteca.</div>';
            }

            this.$rail.html(html);
            this.icons();
        }

        railItem(list, archived) {
            const on = this.openKey === list.key && !this.formOpen;
            const countCls = 'tdw-count' + (list.total > 0 && list.pending === 0 ? ' is-clear' : '');
            return '<button class="tdw-item' + (on ? ' is-on' : '') + (archived ? ' is-archived' : '') + '" ' +
                        'data-tdw="pick" data-key="' + esc(list.key) + '" type="button" title="' + esc(list.pathLabel) + '">' +
                     '<span class="tdw-item-dot">' + ico(ICON.list) + '</span>' +
                     '<span class="tdw-item-main"><b>' + esc(list.title) + '</b><small>' + esc(list.pathLabel) + '</small></span>' +
                     '<span class="' + countCls + '">' + (list.total ? list.pending : 0) + '</span>' +
                   '</button>';
        }

        groupRow(kind, label, count, open, iconName) {
            return '<button class="tdw-group" data-tdw="group" data-kind="' + kind + '" type="button">' +
                     ico(open ? ICON.down : ICON.right) +
                     (iconName ? ico(iconName) : '') +
                     esc(label) + '<span>' + count + '</span>' +
                   '</button>';
        }

        renderMain() {
            if (this.formOpen)         { this.renderForm(); return; }
            if (this.query.length >= 2) { this.renderSearch(); return; }
            if (this.openKey === null)  { this.renderInbox(); return; }

            const list = this.listByKey(this.openKey);
            if (!list) { this.openKey = null; this.renderInbox(); return; }

            const secs = list.sections || [];
            const body = secs.length
                ? secs.map((sec) => this.secBlock(sec)).join('')
                : '<div class="tdw-sec" data-sec="">' +
                     '<div class="tdw-add">' +
                       '<span class="tdw-plus">' + ico(ICON.plus) + '</span>' +
                       '<input type="text" data-tdw="addtask" placeholder="Añadir la primera tarea…" maxlength="240">' +
                     '</div>' +
                   '</div>';

            this.$main.html(
                '<div class="tdw-main-head">' +
                  '<div class="tdw-mh-row">' +
                    '<div class="tdw-mh-title">' +
                      '<h3 contenteditable="true" spellcheck="false" data-tdw="listtitle">' + esc(list.title) + '</h3>' +
                      '<div class="tdw-crumb">' + ico(ICON.folder) + esc(list.crumbs.join(' / ')) +
                        (list.crumbs.length ? ' / ' : '') + '<code>' + esc(list.file) + '</code></div>' +
                    '</div>' +
                    '<div class="tdw-mh-actions">' +
                      '<button class="tdw-btn" data-tdw="openfile" type="button" title="Abrir el archivo en el visor">' + ico(ICON.open) + '<span>Abrir</span></button>' +
                      '<button class="tdw-btn" data-tdw="prompt" type="button" title="Copiar prompt de la lista">' + ico(ICON.copy) + '<span>Copiar prompt</span></button>' +
                      (this.isArchived(list.key)
                        ? '<button class="tdw-btn" data-tdw="unarchive" type="button" title="Restaurar">' + ico(ICON.restore) + '</button>'
                        : '<button class="tdw-btn" data-tdw="archive" type="button" title="Archivar">' + ico(ICON.archive) + '</button>') +
                    '</div>' +
                  '</div>' +
                  '<div class="tdw-progress" id="tdwProgress"></div>' +
                '</div>' +
                '<div class="tdw-scroll">' + body +
                  '<button class="tdw-newsec" data-tdw="newsec" type="button">' + ico(ICON.plus) + ' Nueva sección</button>' +
                '</div>' +
                this.quickBar()
            );
            this.renderProgress();
            this.renderDest();
            this.icons();
        }

        secBlock(sec) {
            const tasks = (sec.tasks || []).filter((t) => this.keeps(t));
            return '<section class="tdw-sec" data-sec="' + esc(sec.id) + '">' +
                     '<div class="tdw-sec-head">' +
                       '<h4 contenteditable="true" spellcheck="false" data-tdw="sectitle">' + esc(sec.title) + '</h4>' +
                       '<span class="tdw-n">' + (sec.tasks || []).length + '</span>' +
                       '<span class="tdw-sec-tools">' +
                         '<button data-tdw="secprompt" title="Copiar prompt de la sección">' + ico(ICON.copy) + '</button>' +
                         '<button data-tdw="delsec" title="Eliminar sección">' + ico(ICON.close) + '</button>' +
                       '</span>' +
                     '</div>' +
                     tasks.map((t) => this.taskRow(t)).join('') +
                     '<div class="tdw-add">' +
                       '<span class="tdw-plus">' + ico(ICON.plus) + '</span>' +
                       '<input type="text" data-tdw="addtask" placeholder="Añadir tarea…" maxlength="240">' +
                     '</div>' +
                   '</section>';
        }

        taskRow(task, origin) {
            return '<div class="tdw-task' + (task.done ? ' is-done' : '') + '" data-id="' + esc(task.id) + '"' +
                        (origin ? ' data-key="' + esc(origin.key) + '" data-sec="' + esc(origin.secId) + '"' : '') + '>' +
                     '<button class="tdw-chk" data-tdw="check" type="button" title="Marcar">' + ico(ICON.check) + '</button>' +
                     '<span class="tdw-txt"' + (origin ? '' : ' contenteditable="true" spellcheck="false" data-tdw="tasktext"') + '>' +
                       (origin ? mark(task.text, this.query) : esc(task.text)) +
                     '</span>' +
                     (origin
                        ? '<button class="tdw-origin" data-tdw="goto" type="button" title="Abrir esta lista">' + ico(ICON.folder) + esc(origin.label) + '</button>'
                        : '') +
                     '<span class="tdw-task-tools">' +
                       '<button data-tdw="deltask" title="Eliminar">' + ico(ICON.close) + '</button>' +
                     '</span>' +
                   '</div>';
        }

        renderProgress() {
            const list = this.listByKey(this.openKey);
            const $p = $('#tdwProgress');
            if (!list || !$p.length) return;
            const pct = list.total ? Math.round(list.done / list.total * 100) : 0;
            $p.html(
                '<span class="tdw-num">' + list.done + ' / ' + list.total + '</span>' +
                '<span class="tdw-bar"><i style="width:' + pct + '%"></i></span>' +
                '<span class="tdw-num">' + plural(list.pending, 'pendiente', 'pendientes') + '</span>'
            );
        }

        // Bandeja: los pendientes de todas las listas en una sola corriente, cada
        // uno con el chip de donde vive. Es lo que se ve al entrar sin elegir nada.
        renderInbox() {
            const rows = [];
            this.visibleLists().forEach((list) => {
                (list.sections || []).forEach((sec) => {
                    (sec.tasks || []).forEach((task) => {
                        if (!this.keeps(task)) return;
                        rows.push(this.taskRow(task, { key: list.key, secId: sec.id, label: list.title + ' · ' + sec.title }));
                    });
                });
            });

            const label = this.filter === 'done' ? 'hechas' : (this.filter === 'all' ? 'tareas' : 'pendientes');
            this.$main.html(
                '<div class="tdw-main-head">' +
                  '<div class="tdw-mh-row">' +
                    '<div class="tdw-mh-title">' +
                      '<h3>Bandeja</h3>' +
                      '<div class="tdw-crumb">' + ico(ICON.layers) + rows.length + ' ' + label + ' de ' +
                        plural(this.visibleLists().filter((l) => l.total > 0).length, 'lista', 'listas') + ' · agrupadas por lista</div>' +
                    '</div>' +
                    '<div class="tdw-mh-actions">' +
                      '<button class="tdw-btn" data-tdw="inboxprompt" type="button" title="Copiar todo como prompt">' + ico(ICON.copy) + '<span>Copiar prompt</span></button>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="tdw-scroll">' +
                  (rows.length ? rows.join('') : this.emptyBlock(ICON.inbox, 'Nada por hacer aquí',
                        this.filter === 'pending' ? 'No te queda ningún pendiente en la biblioteca.' : 'Ninguna tarea coincide con este filtro.')) +
                '</div>' +
                this.quickBar()
            );
            this.renderDest();
            this.icons();
        }

        renderSearch() {
            const q = this.query.toLowerCase();
            const rows = [];
            let hitLists = {};

            this.visibleLists().forEach((list) => {
                (list.sections || []).forEach((sec) => {
                    (sec.tasks || []).forEach((task) => {
                        if (!this.keeps(task)) return;
                        const inTask = String(task.text).toLowerCase().indexOf(q) !== -1;
                        const inList = String(list.title + ' ' + sec.title).toLowerCase().indexOf(q) !== -1;
                        if (!inTask && !inList) return;
                        hitLists[list.key] = true;
                        rows.push(this.taskRow(task, { key: list.key, secId: sec.id, label: list.title + ' · ' + sec.title }));
                    });
                });
            });

            this.$main.html(
                '<div class="tdw-main-head">' +
                  '<div class="tdw-mh-row">' +
                    '<div class="tdw-mh-title">' +
                      '<h3>“' + esc(this.query) + '”</h3>' +
                      '<div class="tdw-crumb">' + ico(ICON.search) +
                        plural(rows.length, 'resultado', 'resultados') + ' en ' +
                        plural(Object.keys(hitLists).length, 'lista', 'listas') + '</div>' +
                    '</div>' +
                    '<div class="tdw-mh-actions">' +
                      '<button class="tdw-btn" data-tdw="clearsearch" type="button">' + ico(ICON.close) + '<span>Limpiar</span></button>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="tdw-scroll">' +
                  (rows.length ? rows.join('') : this.emptyBlock(ICON.search, 'Sin resultados', 'Nada coincide con “' + esc(this.query) + '”.')) +
                '</div>' +
                this.quickBar()
            );
            this.renderDest();
            this.icons();
        }

        quickBar() {
            return '<div class="tdw-quick">' +
                     '<div class="tdw-quick-in">' + ico(ICON.zap) +
                       '<input type="text" id="tdwQuick" placeholder="Capturar tarea rápida…" maxlength="240" autocomplete="off">' +
                       '<button class="tdw-dest" data-tdw="dest" type="button">' + ico(ICON.dest) + '<span>Elegir destino</span></button>' +
                       '<span class="tdw-kbd">↵</span>' +
                     '</div>' +
                     '<button class="tdw-send" data-tdw="send" type="button" title="Anotar">' + ico(ICON.send) + '</button>' +
                   '</div>';
        }

        // ── Destino de la captura rapida ────────────────────────────────────
        renderDest() {
            const dest = this.destOf();
            $('[data-tdw="dest"] span').text(dest ? (dest.list.title + ' · ' + dest.sec.title) : 'Elegir destino');
        }

        destOf() {
            if (!this.destKey) return null;
            const parts = this.destKey.split('::');
            const list = this.listByKey(parts[0]);
            if (!list) return null;
            const sec = (list.sections || []).filter((s) => s.id === parts[1])[0];
            if (!sec) return null;
            return { list: list, sec: sec };
        }

        // Menu nativo: ya sabe desbordarse fuera de la ventana y no hay que
        // mantener un desplegable propio para una eleccion ocasional.
        pickDest($anchor) {
            const opts = [];
            this.visibleLists().forEach((list) => {
                if (!(list.sections || []).length) return;
                opts.push('<optgroup label="' + esc(list.title + ' — ' + list.pathLabel) + '">' +
                    list.sections.map((s) =>
                        '<option value="' + esc(list.key + '::' + s.id) + '"' + (this.destKey === list.key + '::' + s.id ? ' selected' : '') + '>' +
                        esc(s.title) + '</option>'
                    ).join('') + '</optgroup>');
            });

            if (!opts.length) { this.flash('Ninguna lista tiene secciones todavia', 'error'); return; }

            const $sel = $('<select class="tdw-dest"></select>').html(opts.join(''));
            $anchor.replaceWith($sel);
            $sel.trigger('focus');
            $sel.on('change blur', () => {
                this.destKey = $sel.val();
                $sel.replaceWith('<button class="tdw-dest" data-tdw="dest" type="button">' + ico(ICON.dest) + '<span></span></button>');
                this.icons();
                this.renderDest();
            });
        }

        quickAdd(text) {
            const dest = this.destOf();
            if (!dest) { this.flash('Elige primero a que lista va', 'error'); return false; }

            dest.sec.tasks = dest.sec.tasks || [];
            dest.sec.tasks.push({ id: uid('t'), text: text, done: false });
            this.persist(dest.list, true);
            this.flash('Anotada en ' + dest.list.title + ' · ' + dest.sec.title, 'ok');
            this.renderMain();
            return true;
        }

        // ── Alta de lista ───────────────────────────────────────────────────
        openForm() {
            this.formOpen = true;
            this.renderRail();

            if (this.folders) { this.renderForm(); return; }
            $.get(API, { action: 'folders' })
                .done((res) => { this.folders = (res && res.folders) || []; this.renderForm(); })
                .fail((xhr) => { this.formOpen = false; this.flash(this.reasonOf(xhr), 'error'); this.render(); });
        }

        renderForm() {
            const opts = (this.folders || []).map((f) =>
                '<option value="' + esc(f.scope + '|' + f.dir) + '">' + esc(f.label) + '</option>'
            ).join('');

            this.$main.html(
                '<div class="tdw-main-head">' +
                  '<div class="tdw-mh-row"><div class="tdw-mh-title">' +
                    '<h3>Nueva lista</h3>' +
                    '<div class="tdw-crumb">' + ico(ICON.file) + 'Se guarda como un todo.json en la carpeta que elijas</div>' +
                  '</div></div>' +
                '</div>' +
                '<div class="tdw-scroll">' +
                  '<div class="tdw-form">' +
                    '<h4>' + ico(ICON.file) + ' Datos de la lista</h4>' +
                    '<div class="tdw-field"><label>Nombre</label><input type="text" id="tdwNewTitle" placeholder="Costsys GV" maxlength="80"></div>' +
                    '<div class="tdw-field"><label>Carpeta de la biblioteca</label><select id="tdwNewDir">' + opts + '</select></div>' +
                    '<div class="tdw-field"><label>Archivo</label><input type="text" id="tdwNewFile" value="todo.json" style="font-family:\'JetBrains Mono\',monospace;font-size:11.5px"></div>' +
                    '<div class="tdw-form-foot">' +
                      '<button class="tdw-btn" data-tdw="cancelnew" type="button">Cancelar</button>' +
                      '<button class="tdw-btn is-primary" data-tdw="createnew" type="button">Crear lista</button>' +
                    '</div>' +
                  '</div>' +
                '</div>'
            );
            this.icons();
            $('#tdwNewTitle').trigger('focus');
        }

        closeForm() {
            if (!this.formOpen) return;
            this.formOpen = false;
        }

        createList() {
            const title = $('#tdwNewTitle').val().trim();
            const dir   = String($('#tdwNewDir').val() || 'mine|');
            const file  = $('#tdwNewFile').val().trim() || 'todo.json';
            const parts = dir.split('|');

            $.post(API, { action: 'create', scope: parts[0], dir: parts[1] || '', file: file, title: title })
                .done((res) => {
                    if (!res || !res.success) { this.flash((res && res.message) || 'no se pudo crear', 'error'); return; }
                    this.closeForm();
                    this.flash(res.exists ? 'Esa lista ya existia: la abri' : 'Lista creada', 'ok');
                    // El archivo puede haber caido en una carpeta nueva: se rebarre
                    // en vez de insertarlo a mano para que quede ordenado como el resto.
                    const key = res.entry && res.entry.key;
                    $.get(API, { action: 'scan' }).done((r2) => {
                        if (!r2 || !r2.success) return;
                        this.lists = r2.lists || [];
                        this.openKey = key;
                        this.render();
                    });
                })
                .fail((xhr) => this.flash(this.reasonOf(xhr), 'error'));
        }

        // ── Acciones sobre una lista ────────────────────────────────────────
        archive(key) {
            if (this.isArchived(key)) return;
            this.archived.push(key);
            this.writeArchived();
            if (this.openKey === key) this.openKey = null;
            this.render();
            this.flash('Archivada — el archivo sigue en su carpeta', 'ok');
        }

        unarchive(key) {
            this.archived = this.archived.filter((k) => k !== key);
            this.writeArchived();
            this.render();
        }

        promptOf(list, sec) {
            const source = sec ? [sec] : (list.sections || []);
            const lines  = [];
            source.forEach((s) => {
                const pend = (s.tasks || []).filter((t) => !t.done);
                const use  = pend.length ? pend : (s.tasks || []);
                if (!use.length) return;
                if (!sec) lines.push('', '## ' + s.title);
                use.forEach((t) => lines.push('- [' + (t.done ? 'x' : ' ') + '] ' + t.text));
            });

            return 'Trabajemos en las tareas pendientes de "' + list.title + '"' +
                   (sec ? ' · sección "' + sec.title + '"' : '') + ':\n' + lines.join('\n') + '\n\n' +
                   'Impleméntalas en orden, respetando las convenciones y el stack del proyecto. ' +
                   'No agregues nada que no esté en la lista y al terminar dime qué tareas quedaron listas.';
        }

        // La Bandeja se copia agrupada por lista: sin el encabezado de cada una, un
        // pegote de 33 renglones no dice de que proyecto es cada tarea.
        inboxPrompt() {
            const blocks = [];
            this.visibleLists().forEach((list) => {
                const pend = [];
                (list.sections || []).forEach((sec) => {
                    (sec.tasks || []).forEach((t) => { if (!t.done) pend.push('- [ ] ' + sec.title + ': ' + t.text); });
                });
                if (pend.length) blocks.push('## ' + list.title + ' (' + list.pathLabel + ')\n' + pend.join('\n'));
            });

            return 'Estos son todos mis pendientes:\n\n' + blocks.join('\n\n') +
                   '\n\nDime en que orden los atacarias y por que.';
        }

        copy(text, okMsg) {
            const ok   = () => this.flash(okMsg, 'ok');
            const fail = () => this.flash('no se pudo copiar', 'error');
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(ok, fail);
                return;
            }
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy') ? ok() : fail(); } catch (e) { fail(); }
            ta.remove();
        }

        // El visor sabe abrir el archivo con su propio explorador; en las demas
        // paginas no hay explorador que pilotar, asi que se navega a el.
        openInVisor(list) {
            const norm = (s) => String(s || '').replace(/\\/g, '/');
            const app  = global.app;

            if (app && typeof app.loadFile === 'function' && Array.isArray(app.allFiles)) {
                const found = app.allFiles.filter((f) => norm(f.fullPath) === norm(list.fullPath))[0];
                if (found) { this.close(); app.loadFile(found.file, found); return; }
                this.flash('El visor no tiene ese archivo en la carpeta abierta', 'error');
                return;
            }
            global.open('index.php', '_blank');
        }

        // ── Eventos ─────────────────────────────────────────────────────────
        bind() {
            const self = this;
            const $v = this.$veil;

            // Clic en el velo (fuera de la ventana) cierra.
            $v.on('click', function (e) { if (e.target === this) self.close(); });
            $(document).on('keydown.tdw', (e) => {
                if (e.key === 'Escape' && this.isOpen()) this.close();
            });

            $v.on('click', '[data-tdw="close"]',   () => this.close());
            $v.on('click', '[data-tdw="refresh"]', () => this.scan());
            $v.on('click', '[data-tdw="wide"]',    () => $v.toggleClass('is-wide'));
            $v.on('click', '[data-tdw="new"]',     () => this.openForm());
            $v.on('click', '[data-tdw="cancelnew"]', () => { this.closeForm(); this.render(); });
            $v.on('click', '[data-tdw="createnew"]', () => this.createList());

            $v.on('click', '[data-tdw="clearsearch"]', () => {
                this.query = '';
                $('#tdwSearch').val('');
                this.render();
            });

            $v.on('click', '[data-tdw="filter"]', function () {
                self.filter = $(this).data('f');
                $v.find('[data-tdw="filter"]').removeClass('is-on');
                $(this).addClass('is-on');
                self.render();
            });

            let searchTimer = null;
            $v.on('input', '#tdwSearch', function () {
                const value = this.value.trim();
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    self.query = value;
                    self.closeForm();
                    self.render();
                }, 160);
            });

            $v.on('click', '[data-tdw="group"]', function () {
                const kind = $(this).data('kind');
                if (kind === 'empty') self.showEmpty = !self.showEmpty;
                else self.showArchived = !self.showArchived;
                self.renderRail();
            });

            $v.on('click', '[data-tdw="inbox"]', function () {
                self.closeForm();
                self.openKey = null;
                self.render();
            });

            $v.on('click', '[data-tdw="pick"]', function () {
                self.closeForm();
                self.openKey = $(this).data('key');
                // Abrir una lista apunta ahi la captura rapida, salvo que el
                // usuario haya fijado otro destino a mano.
                const list = self.listByKey(self.openKey);
                if (list && (list.sections || []).length && !self.destOf()) {
                    self.destKey = list.key + '::' + list.sections[list.sections.length - 1].id;
                }
                self.render();
            });

            // Chip de origen en la Bandeja / busqueda: salta a esa lista.
            $v.on('click', '[data-tdw="goto"]', function (e) {
                e.stopPropagation();
                self.openKey = $(this).closest('.tdw-task').data('key');
                self.query = '';
                $('#tdwSearch').val('');
                self.render();
            });

            $v.on('click', '[data-tdw="openfile"]', () => {
                const list = this.listByKey(this.openKey);
                if (list) this.openInVisor(list);
            });

            $v.on('click', '[data-tdw="prompt"]', () => {
                const list = this.listByKey(this.openKey);
                if (list) this.copy(this.promptOf(list), 'Prompt de la lista copiado');
            });

            $v.on('click', '[data-tdw="inboxprompt"]', () => {
                this.copy(this.inboxPrompt(), 'Pendientes copiados como prompt');
            });

            $v.on('click', '[data-tdw="secprompt"]', function () {
                const ref = self.refOf($(this));
                if (ref) self.copy(self.promptOf(ref.list, ref.sec), 'Prompt de la sección copiado');
            });

            $v.on('click', '[data-tdw="archive"]',   () => this.archive(this.openKey));
            $v.on('click', '[data-tdw="unarchive"]', () => this.unarchive(this.openKey));

            $v.on('click', '[data-tdw="check"]', function () {
                const ref = self.refOf($(this));
                if (!ref || !ref.task) return;
                ref.task.done = !ref.task.done;
                const $row = $(this).closest('.tdw-task').toggleClass('is-done', ref.task.done);
                self.persist(ref.list, true);
                // La tarea deja de pertenecer al filtro activo: se retira en vez de
                // repintar toda la vista bajo el cursor.
                if (self.filter !== 'all') $row.slideUp(140, function () { $(this).remove(); });
            });

            $v.on('click', '[data-tdw="deltask"]', function () {
                const ref = self.refOf($(this));
                if (!ref || !ref.task) return;
                ref.sec.tasks = ref.sec.tasks.filter((t) => t.id !== ref.task.id);
                self.persist(ref.list, true);
                $(this).closest('.tdw-task').slideUp(140, function () { $(this).remove(); });
            });

            $v.on('keydown', '.tdw-txt, [data-tdw="sectitle"], [data-tdw="listtitle"]', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
                if (e.key === 'Escape') { this.blur(); }
            });

            $v.on('blur', '[data-tdw="tasktext"]', function () {
                const ref = self.refOf($(this));
                if (!ref || !ref.task) return;
                const v = this.textContent.trim();
                if (v === ref.task.text) return;
                // Vaciar el texto es la forma corta de borrar la tarea.
                if (v === '') {
                    ref.sec.tasks = ref.sec.tasks.filter((t) => t.id !== ref.task.id);
                    $(this).closest('.tdw-task').slideUp(140, function () { $(this).remove(); });
                } else {
                    ref.task.text = v;
                }
                self.persist(ref.list, true);
            });

            $v.on('blur', '[data-tdw="sectitle"]', function () {
                const ref = self.refOf($(this));
                if (!ref) return;
                const v = this.textContent.trim() || 'Sección';
                this.textContent = v;
                if (v === ref.sec.title) return;
                ref.sec.title = v;
                self.persist(ref.list);
                self.renderDest();
            });

            $v.on('blur', '[data-tdw="listtitle"]', function () {
                const list = self.listByKey(self.openKey);
                if (!list) return;
                const v = this.textContent.trim() || 'TODO';
                this.textContent = v;
                if (v === list.title) return;
                list.title = v;
                self.persist(list, true);
            });

            $v.on('keydown', '[data-tdw="addtask"]', function (e) {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const text = this.value.trim();
                if (!text) return;

                const list = self.listByKey(self.openKey);
                if (!list) return;

                const secId = $(this).closest('[data-sec]').data('sec');
                let sec = secId ? (list.sections || []).filter((s) => s.id === secId)[0] : null;
                // Lista sin secciones: la primera tarea crea la seccion que la aloja.
                if (!sec) {
                    sec = { id: uid('s'), title: 'Pendientes', tasks: [] };
                    list.sections = (list.sections || []).concat([sec]);
                }

                sec.tasks = (sec.tasks || []).concat([{ id: uid('t'), text: text, done: false }]);
                this.value = '';
                self.persist(list, true);
                self.renderMain();
                // Seguir capturando sin volver a apuntar con el mouse.
                $('.tdw-sec[data-sec="' + sec.id + '"] [data-tdw="addtask"]').trigger('focus');
            });

            $v.on('click', '[data-tdw="newsec"]', function () {
                const list = self.listByKey(self.openKey);
                if (!list) return;
                const sec = { id: uid('s'), title: 'Nueva sección', tasks: [] };
                list.sections = (list.sections || []).concat([sec]);
                self.persist(list, true);
                self.renderMain();

                const $t = $('.tdw-sec[data-sec="' + sec.id + '"] [data-tdw="sectitle"]');
                $t.trigger('focus');
                if ($t.length && global.getSelection) {
                    const r = document.createRange();
                    r.selectNodeContents($t[0]);
                    const s = global.getSelection();
                    s.removeAllRanges();
                    s.addRange(r);
                }
            });

            $v.on('click', '[data-tdw="delsec"]', function () {
                const ref = self.refOf($(this));
                if (!ref) return;
                const n = (ref.sec.tasks || []).length;
                if (n && !confirm('¿Eliminar la sección “' + ref.sec.title + '” y sus ' + n + ' tarea(s)?')) return;
                ref.list.sections = ref.list.sections.filter((s) => s.id !== ref.sec.id);
                self.persist(ref.list, true);
                self.renderMain();
            });

            $v.on('click', '[data-tdw="dest"]', function () { self.pickDest($(this)); });

            $v.on('keydown', '#tdwQuick', function (e) {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const v = this.value.trim();
                if (v && self.quickAdd(v)) this.value = '';
            });

            $v.on('click', '[data-tdw="send"]', function () {
                const $in = $('#tdwQuick');
                const v = String($in.val() || '').trim();
                if (v && self.quickAdd(v)) $in.val('');
                $in.trigger('focus');
            });
        }

        // Localiza la lista, seccion y tarea a la que pertenece un elemento del DOM.
        // En el detalle la lista es la abierta; en la Bandeja y en la busqueda cada
        // fila lleva su referencia completa en sus propios data-*.
        refOf($el) {
            const $task = $el.closest('.tdw-task');
            const key   = ($task.length && $task.data('key')) || this.openKey;
            const list  = this.listByKey(key);
            if (!list) return null;

            const secId = ($task.length && $task.data('sec')) || $el.closest('[data-sec]').data('sec');
            const sec   = (list.sections || []).filter((s) => s.id === secId)[0];
            if (!sec) return null;

            const taskId = $task.data('id');
            const task   = taskId ? (sec.tasks || []).filter((t) => t.id === taskId)[0] : null;
            return { list: list, sec: sec, task: task };
        }
    }

    global.TodoHub = TodoHub;
    global.todoHub = new TodoHub();

    // El launcher solo anuncia que app se pidio: quien lo cablea no necesita
    // conocer esta clase ni el orden en que se cargan los scripts.
    $(function () {
        $(document).on('launcher:launch', function (e, name) {
            if (name === 'todo') global.todoHub.open();
        });
    });
})(window);
