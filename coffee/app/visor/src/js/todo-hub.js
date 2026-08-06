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
    // Mismo endpoint y mismo modelo fijo que la varita del panel TODO del visor:
    // la reescritura no depende del selector de modelo de ningun chat.
    const API_IA   = 'ctrl/ctrl-coffeeia.php';
    const IA_MODEL = 'glm-5.2:cloud';
    const PREF_KEY   = 'visor:todoArchived:v1';
    const ACCENT_KEY = 'visor:todoAccent:v1';
    const CHIPS_KEY  = 'visor:todoChips:v1';

    // Campos opcionales de una tarea que se pintan como chip. Solo se ven si el
    // todo.json los trae: el cajon los conserva pero no los inventa.
    const CHIPS = [
        { id: 'prio', name: 'Prioridad',    sample: 'alta'  },
        { id: 'tags', name: 'Etiquetas',    sample: '#ui'   },
        { id: 'due',  name: 'Fecha límite', sample: '5 ago' }
    ];

    const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    // La fecha se dice en relativo mientras sea util (hoy, mañana, tarde) y en
    // dia/mes cuando ya no lo es. `late` la pinta en rojo.
    function dueLabel(raw) {
        const d = new Date(String(raw).slice(0, 10) + 'T00:00:00');
        if (isNaN(d.getTime())) return { text: String(raw), late: false, soon: false };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days = Math.round((d - today) / 86400000);

        if (days < 0)   return { text: days === -1 ? 'ayer' : Math.abs(days) + ' d tarde', late: true,  soon: false };
        if (days === 0) return { text: 'hoy',    late: false, soon: true };
        if (days === 1) return { text: 'mañana', late: false, soon: true };
        return { text: d.getDate() + ' ' + MESES[d.getMonth()], late: false, soon: false };
    }
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
        empty:   'folder-search',
        share:   'user-plus',
        users:   'users',
        eye:     'eye',
        pencil:  'pencil',
        trash:   'trash-2',
        back:    'arrow-left',
        grip:    'grip-vertical',
        cog:     'settings',
        wand:    'wand-sparkles',
        spin:    'loader-circle',
        fields:  'sliders-horizontal',
        broom:   'eraser'
    };

    // Color de acento del hub. Cada uno trae su tono para fondo oscuro y para claro:
    // el celeste que se lee bien sobre #1F2A37 pierde contraste sobre blanco.
    const ACCENTS = [
        { id: 'sky',    name: 'Celeste',   dark: '#38BDF8', light: '#0284C7' },
        { id: 'terra',  name: 'Terracota', dark: '#E2795B', light: '#C05A40' },
        { id: 'jade',   name: 'Jade',      dark: '#34D399', light: '#059669' },
        { id: 'violet', name: 'Violeta',   dark: '#A78BFA', light: '#7C3AED' },
        { id: 'amber',  name: 'Ámbar',     dark: '#FBBF24', light: '#D97706' },
        { id: 'rose',   name: 'Rosa',      dark: '#F472B6', light: '#DB2777' },
        { id: 'indigo', name: 'Índigo',    dark: '#818CF8', light: '#4F46E5' },
        { id: 'slate',  name: 'Grafito',   dark: '#94A3B8', light: '#475569' }
    ];

    // Texto legible SOBRE el acento. Con celeste o ambar hay que escribir en oscuro;
    // con indigo o terracota, en blanco. Se decide por luminancia relativa (WCAG) en
    // vez de fijar un color, que era lo que dejaba textos ilegibles al cambiar de
    // acento.
    function onColor(hex) {
        const h = String(hex).replace('#', '');
        const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
        const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
            v /= 255;
            return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
        });
        const lum = .2126 * ch[0] + .7152 * ch[1] + .0722 * ch[2];
        return lum > .45 ? '#0A1A24' : '#FFFFFF';
    }

    // rgba a partir del hex del acento: las variables soft/line del tema son el
    // mismo color con alfa, no colores aparte.
    function rgba(hex, a) {
        const h = String(hex).replace('#', '');
        const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
        return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }

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

    // En el telefono la ventana no muestra las dos columnas a la vez: ensena las
    // listas o el detalle, nunca los dos. El mismo ancho que corta el CSS.
    function isPhone() {
        return !!(global.matchMedia && global.matchMedia('(max-width: 640px)').matches);
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
            this.showInvited  = true;   // lo que otros me prestan se ve de entrada
            this.formOpen = false;
            this.shareOpen = false;     // panel de comparticion de la lista abierta
            this.folders  = null;
            this.users    = null;       // catalogo de cuentas (se pide una vez)
            this.loading  = false;
            this.mounted  = false;
            this.saveTimers = {};
            this.drag       = null;     // arrastre de tarea en curso
            this.accent     = this.readAccent();
            this.chips      = this.readChips();   // que campos opcionales se pintan
            this.fieldsId   = null;               // tarea abierta en el editor de campos
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

        // ── Color de acento ─────────────────────────────────────────────────
        // Se pisan las tres variables --tdw-sky* sobre el propio velo: el CSS las
        // declara ahi, asi que el inline gana en los dos temas sin duplicar reglas.
        readAccent() {
            try {
                const key = global.coffeeScopedKey ? global.coffeeScopedKey(ACCENT_KEY) : ACCENT_KEY;
                const id  = localStorage.getItem(key) || '';
                return ACCENTS.filter((a) => a.id === id).length ? id : 'sky';
            } catch (e) { return 'sky'; }
        }

        writeAccent() {
            try {
                const key = global.coffeeScopedKey ? global.coffeeScopedKey(ACCENT_KEY) : ACCENT_KEY;
                localStorage.setItem(key, this.accent);
            } catch (e) {}
            if (global.CoffeePrefs) global.CoffeePrefs.push(ACCENT_KEY, this.accent);
        }

        applyAccent() {
            if (!this.$veil) return;
            const acc  = ACCENTS.filter((a) => a.id === this.accent)[0] || ACCENTS[0];
            const dark = document.documentElement.getAttribute('data-theme') !== 'light';
            const c    = dark ? acc.dark : acc.light;
            // El velo, el editor de campos (que cuelga del body) y cada panel
            // embebido declaran la paleta por separado: el acento se escribe en los
            // tres o el color solo cambiaria dentro de la ventana.
            const targets = [this.$veil.get(0), $('#tdwFields').get(0)]
                .concat(this.lists.filter((l) => l.embedded && l.host).map((l) => l.host))
                .concat($('.tdw-prop').get());          // tarjetas del chat, fuera del velo

            targets.forEach((el) => {
                if (!el) return;
                el.style.setProperty('--tdw-sky', c);
                el.style.setProperty('--tdw-sky-soft', rgba(c, .21));
                el.style.setProperty('--tdw-sky-line', rgba(c, .35));
                // Lo que va ENCIMA del acento: sin esto, el texto de los botones se
                // quedaba en el azul oscuro pensado para el celeste. El scrollbar NO
                // entra aqui: es gris del tema y no sigue al acento.
                el.style.setProperty('--tdw-on-sky', onColor(c));
            });
            // Las muestras enseñan el tono que se va a aplicar en el tema vigente.
            this.$veil.find('[data-accent]').each(function () {
                const id = $(this).attr('data-accent');
                const a  = ACCENTS.filter((x) => x.id === id)[0];
                if (a) $(this).find('i').css('background', dark ? a.dark : a.light);
                $(this).toggleClass('is-on', id === acc.id);
            });
        }

        // Abre/cierra el panel de configuracion. El estado vivia en dos sitios —la clase
        // del boton y el atributo hidden del panel— sincronizados a mano en tres
        // handlers; bastaba que uno no corriera para que el boton dejara de responder
        // (quedaba "abierto" con el panel cerrado, y el clic siguiente lo reabria).
        // Ahora manda el panel y el boton solo lo refleja.
        toggleAccents(force) {
            const $m = $('#tdwAccents');
            if (!$m.length) return;
            const abrir = (force === undefined) ? !!$m.prop('hidden') : !!force;
            $m.prop('hidden', !abrir);
            this.$veil.find('[data-tdw="accent"]').toggleClass('is-on', abrir).toggleClass('is-open', abrir);
            // Al abrir se refleja lo vigente: si el color o los interruptores cambiaron
            // en otra pestaña, el panel no debe mostrar lo de antes.
            if (abrir) { this.applyAccent(); this.syncChipToggles(); }
        }

        setAccent(id) {
            if (!ACCENTS.filter((a) => a.id === id).length) return;
            this.accent = id;
            this.applyAccent();
            this.writeAccent();
        }

        accentMenuHtml() {
            return '<div class="tdw-accents" id="tdwAccents" hidden>' +
                     '<p class="tdw-accents-h">Color del tema</p>' +
                     '<div class="tdw-accents-grid">' +
                       ACCENTS.map((a) =>
                         '<button class="tdw-swatch" type="button" data-accent="' + a.id + '" title="' + esc(a.name) + '">' +
                           '<i style="background:' + a.dark + '"></i>' +
                         '</button>').join('') +
                     '</div>' +
                     '<p class="tdw-accents-note">El claro/oscuro sigue al tema del visor.</p>' +
                     '<p class="tdw-accents-h" style="margin-top:14px">En cada tarea</p>' +
                     CHIPS.map((c) =>
                       '<button class="tdw-chiprow" type="button" data-chip="' + c.id + '">' +
                         '<span class="tdw-chip is-' + c.id + '">' + esc(c.sample) + '</span>' +
                         '<span class="tdw-chiprow-n">' + esc(c.name) + '</span>' +
                         '<i class="tdw-tog"></i>' +
                       '</button>').join('') +
                     '<p class="tdw-accents-note">Solo cambia lo que ves: el <code>todo.json</code> conserva los campos.</p>' +
                   '</div>';
        }

        // ── Chips de la tarea ───────────────────────────────────────────────
        readChips() {
            const def = { prio: true, tags: true, due: true };
            try {
                const key = global.coffeeScopedKey ? global.coffeeScopedKey(CHIPS_KEY) : CHIPS_KEY;
                const raw = localStorage.getItem(key);
                const val = raw ? JSON.parse(raw) : null;
                if (!val || typeof val !== 'object') return def;
                CHIPS.forEach((c) => { def[c.id] = val[c.id] !== false; });
                return def;
            } catch (e) { return def; }
        }

        writeChips() {
            const value = JSON.stringify(this.chips);
            try {
                const key = global.coffeeScopedKey ? global.coffeeScopedKey(CHIPS_KEY) : CHIPS_KEY;
                localStorage.setItem(key, value);
            } catch (e) {}
            if (global.CoffeePrefs) global.CoffeePrefs.push(CHIPS_KEY, value);
        }

        toggleChip(id) {
            if (!CHIPS.filter((c) => c.id === id).length) return;
            this.chips[id] = !this.chips[id];
            this.writeChips();
            this.syncChipToggles();
            this.renderMain();       // los chips se pintan al armar la fila
            this.icons();
        }

        syncChipToggles() {
            if (!this.$veil) return;
            const chips = this.chips;
            this.$veil.find('[data-chip]').each(function () {
                $(this).toggleClass('is-on', chips[$(this).attr('data-chip')] !== false);
            });
        }

        // ── Editor de campos de la tarea (fecha · prioridad · etiquetas) ────
        // Un panel por tarea, anclado a su boton. Cada cambio se guarda al vuelo y
        // repinta solo los chips de esa fila: repintar la vista entera cerraria el
        // panel debajo del cursor.
        fieldsMenuHtml() {
            const btn = (attr, val, label, cls) =>
                '<button type="button" ' + attr + '="' + val + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + label + '</button>';
            return '<div class="tdw-fields" id="tdwFields" hidden>' +
                     '<p class="tdw-fields-h">Prioridad</p>' +
                     '<div class="tdw-fields-row" data-group="prio">' +
                       btn('data-prio', 'alta', 'Alta') + btn('data-prio', 'media', 'Media') +
                       btn('data-prio', 'baja', 'Baja') + btn('data-prio', '', 'Sin', 'is-none') +
                     '</div>' +
                     '<p class="tdw-fields-h">Fecha límite</p>' +
                     '<input type="date" class="tdw-fields-date" data-tdw="duedate">' +
                     '<div class="tdw-fields-row">' +
                       btn('data-due', 'today', 'Hoy') + btn('data-due', 'tomorrow', 'Mañana') +
                       btn('data-due', 'week', 'En 7 días') + btn('data-due', '', 'Sin', 'is-none') +
                     '</div>' +
                     '<p class="tdw-fields-h">Etiquetas</p>' +
                     '<input type="text" class="tdw-fields-tags" data-tdw="tagsinput" placeholder="ui, facture" autocomplete="off">' +
                     '<p class="tdw-accents-note">Separadas por coma. Enter para guardar.</p>' +
                   '</div>';
        }

        openFieldsMenu($btn) {
            const $row = $btn.closest('.tdw-task');
            const ref  = this.refOf($row);
            if (!ref || !ref.task) return;

            const $m = $('#tdwFields');
            // Segundo clic en el mismo boton: se cierra.
            if (!$m.prop('hidden') && this.fieldsId === ref.task.id) { this.closeFieldsMenu(); return; }
            this.fieldsId = ref.task.id;

            $m.find('[data-prio]').each(function () {
                $(this).toggleClass('is-on', $(this).attr('data-prio') === String(ref.task.prio || ''));
            });
            $m.find('[data-tdw="duedate"]').val(String(ref.task.due || '').slice(0, 10));
            $m.find('[data-tdw="tagsinput"]').val(Array.isArray(ref.task.tags) ? ref.task.tags.join(', ') : '');

            $m.prop('hidden', false);

            // En el telefono no se ancla a nada: 232px colgados de un boton que
            // vive en el borde derecho se salen de la pantalla. Va abajo, a lo
            // ancho, como una hoja.
            if (isPhone()) {
                $m.addClass('is-sheet').css({ top: '', left: '' });
                $row.addClass('is-editing');
                return;
            }
            $m.removeClass('is-sheet');

            // Anclado al boton; si no cabe abajo, sube. El velo es fixed inset:0,
            // asi que las coordenadas del viewport valen tal cual.
            const r  = $btn.get(0).getBoundingClientRect();
            const mh = $m.outerHeight();
            const mw = $m.outerWidth();
            const top = (r.bottom + mh + 12 > window.innerHeight) ? Math.max(8, r.top - mh - 6) : r.bottom + 6;
            $m.css({ top: Math.round(top) + 'px', left: Math.round(Math.max(8, r.right - mw)) + 'px' });
            $row.addClass('is-editing');
        }

        closeFieldsMenu() {
            this.fieldsId = null;
            $('#tdwFields').prop('hidden', true);
            $('.tdw-task.is-editing').removeClass('is-editing');
        }

        // Escribe (o borra) un campo opcional de la tarea abierta en el editor.
        // Vaciar borra la clave en vez de dejarla en '': el archivo no acumula ruido.
        setTaskField(key, value) {
            // Se busca en todo el documento: la fila puede estar en la ventana o en
            // el panel embebido del visor, que no cuelga del velo.
            const $row = $('.tdw-task[data-id="' + this.fieldsId + '"]').first();
            const ref  = this.refOf($row);
            if (!ref || !ref.task) return;

            const empty = value === '' || value == null || (Array.isArray(value) && !value.length);
            if (empty) delete ref.task[key]; else ref.task[key] = value;

            this.persist(ref.list, true);
            $row.find('.tdw-chips').remove();
            const html = this.chipsHtml(ref.task);
            if (html) $row.find('.tdw-txt').first().after(html);
        }

        // Chips de una tarea. Se omite el bloque entero si no hay nada que decir:
        // una lista sin estos campos se ve exactamente igual que antes.
        chipsHtml(task) {
            let out = '';
            if (this.chips.prio && task.prio) {
                out += '<span class="tdw-chip is-prio p-' + esc(String(task.prio).toLowerCase()) + '">' + esc(task.prio) + '</span>';
            }
            if (this.chips.tags && Array.isArray(task.tags)) {
                out += task.tags.slice(0, 3).map((t) => '<span class="tdw-chip is-tags">#' + esc(t) + '</span>').join('');
            }
            if (this.chips.due && task.due) {
                const d = dueLabel(task.due);
                out += '<span class="tdw-chip is-due' + (d.late ? ' is-late' : (d.soon ? ' is-soon' : '')) + '">' + esc(d.text) + '</span>';
            }
            return out ? '<span class="tdw-chips">' + out + '</span>' : '';
        }

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
                      '<button class="tdw-ico" data-tdw="accent" type="button" title="Color del tema">' + ico(ICON.cog) + '</button>' +
                      '<button class="tdw-ico" data-tdw="wide" type="button" title="Agrandar">' + ico(ICON.wide) + '</button>' +
                      '<button class="tdw-ico" data-tdw="close" type="button" title="Cerrar">' + ico(ICON.close) + '</button>' +
                    '</div>' +
                    this.accentMenuHtml() +
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

            // El editor de campos cuelga del body, no del velo: cuando el panel va
            // embebido en el visor la ventana del cajon esta oculta, y todo lo que
            // viva dentro de ella se oculta con ella.
            $('body').append(this.fieldsMenuHtml());

            this.$veil = $('#tdwVeil');
            this.$rail = $('#tdwRail');
            this.$main = $('#tdwMain');
            this.bind();
            this.icons();
            this.applyAccent();
            this.syncChipToggles();

            // El acento tiene un tono por tema: si el visor cambia de claro a oscuro
            // con el hub abierto hay que recalcularlo.
            try {
                new MutationObserver(() => this.applyAccent())
                    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
            } catch (e) {}
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
            // Se entra siempre por el listado: en el telefono el detalle tapa el
            // rail y abrir directo en la lista de la sesion anterior desorienta.
            this.$veil.prop('hidden', false).removeClass('is-detail').addClass('is-in');
            setTimeout(() => this.$veil.removeClass('is-in'), 200);
            this.scan();
        }

        // ── Ir y volver en el telefono ──────────────────────────────────────
        // En pantallas anchas no hacen nada: las dos columnas ya estan a la vista
        // y la clase no la mira ningun estilo.
        showDetail() {
            if (this.$veil && isPhone()) this.$veil.addClass('is-detail');
        }

        backToRail() {
            if (this.$veil) this.$veil.removeClass('is-detail');
        }

        inDetail() {
            return !!this.$veil && this.$veil.hasClass('is-detail');
        }

        close() {
            if (!this.$veil) return;
            this.$veil.prop('hidden', true);
            this.closeForm();
            this.closeShare();
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

        // ── Comparticion ────────────────────────────────────────────────────
        // Una lista prestada en modo consulta se ve completa pero no se toca: el
        // backend rechazaria el guardado igual, y avisar aqui evita perder lo
        // escrito contra un 403.
        canEdit(list) {
            return !!list && list.canEdit !== false;
        }

        isInvited(list) {
            return !!list && list.scope === 'invited';
        }

        // Que tareas entran segun el segmento activo.
        keeps(task) {
            if (this.filter === 'pending') return !task.done;
            if (this.filter === 'done')    return !!task.done;
            return true;
        }

        // El JSON que se escribe en disco, en el mismo formato que ya lee el visor.
        // Los contadores se recalculan al leer, por eso no viajan.
        //
        // Se escribe por fusion, no por reconstruccion: lo que el cajon no entiende
        // (due, tags, prio, notas...) sobrevive al guardado. En secciones y tareas
        // basta con esparcir el objeto; el nivel raiz se rearma desde `list.extra`
        // porque la ficha de la lista trae ademas estado de ejecucion (key, fullPath,
        // crumbs, shares, canEdit...) que jamas debe acabar en el archivo.
        payloadOf(list) {
            return JSON.stringify(Object.assign({}, list.extra || {}, {
                title: list.title,
                sections: (list.sections || []).map((s) => Object.assign({}, s, {
                    id: s.id,
                    title: s.title,
                    tasks: (s.tasks || []).map((t) => Object.assign({}, t, { id: t.id, text: t.text, done: !!t.done }))
                }))
            }), null, 2);
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
        //
        // Una lista embebida trae su propio `onSave`: el visor guarda por su
        // controlador y sabe de carpetas locales del navegador, que este cajon no
        // puede alcanzar. El resto del ciclo (recuento, progreso) es el mismo.
        persist(list, now) {
            if (!this.canEdit(list)) {
                this.flash((list.ownerName || 'Su dueño') + ' la compartió solo para consulta', 'error');
                return;
            }
            this.recount(list);
            if (!list.embedded) { this.summary(); this.renderRail(); }
            this.renderProgress(list);
            clearTimeout(this.saveTimers[list.key]);

            const send = () => {
                const content = this.payloadOf(list);
                if (typeof list.onSave === 'function') { list.onSave(content, list); return; }
                $.post(API, { action: 'save', fullPath: list.fullPath, content: content })
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
            const visible  = this.visibleLists().filter(matches);
            // Lo prestado va en su propio grupo: mezclarlo con las carpetas
            // propias haria dudar de donde vive cada archivo.
            const mine     = visible.filter((l) => !this.isInvited(l));
            const invited  = visible.filter((l) => this.isInvited(l));
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
            if (invited.length) {
                html += this.groupRow('invited', 'Compartidas conmigo', invited.length, this.showInvited, ICON.users);
                if (this.showInvited) html += invited.map((l) => this.railItem(l)).join('');
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
                     '<span class="tdw-item-dot">' + ico(this.isInvited(list) ? ICON.users : ICON.list) + '</span>' +
                     '<span class="tdw-item-main"><b>' + esc(list.title) + '</b><small>' + esc(list.pathLabel) + '</small></span>' +
                     this.shareTag(list) +
                     '<span class="' + countCls + '">' + (list.total ? list.pending : 0) + '</span>' +
                   '</button>';
        }

        // Marca de comparticion del rail: de quien viene la lista prestada, o con
        // cuanta gente comparto la mia. Sin comparticion no se pinta nada.
        shareTag(list) {
            if (this.isInvited(list)) {
                return '<span class="tdw-tag' + (this.canEdit(list) ? '' : ' is-ro') + '" ' +
                            'title="' + esc('De ' + (list.ownerName || 'otra cuenta') + (this.canEdit(list) ? ' · puedes editarla' : ' · solo consulta')) + '">' +
                         ico(this.canEdit(list) ? ICON.pencil : ICON.eye) + esc(list.ownerName || '') +
                       '</span>';
            }
            const n = (list.shares || []).length;
            if (!n) return '';
            return '<span class="tdw-tag" title="' + esc('Compartida con ' + plural(n, 'cuenta', 'cuentas')) + '">' +
                     ico(ICON.users) + n +
                   '</span>';
        }

        groupRow(kind, label, count, open, iconName) {
            return '<button class="tdw-group" data-tdw="group" data-kind="' + kind + '" type="button">' +
                     ico(open ? ICON.down : ICON.right) +
                     (iconName ? ico(iconName) : '') +
                     esc(label) + '<span>' + count + '</span>' +
                   '</button>';
        }

        renderMain() {
            this.paintMain();
            // Todas las vistas del panel abren con la misma fila de titulo, asi que
            // el boton de volver se cuelga aqui una sola vez en vez de repetirlo en
            // cada plantilla. En pantallas anchas el CSS lo mantiene oculto.
            const $row = this.$main.find('.tdw-mh-row').first();
            if ($row.length && !$row.find('.tdw-back').length) {
                $row.prepend('<button class="tdw-back" data-tdw="back" type="button" title="Volver a las listas">' + ico(ICON.back) + '</button>');
                this.icons();
            }
        }

        paintMain() {
            if (this.formOpen)         { this.renderForm(); return; }
            if (this.query.length >= 2) { this.renderSearch(); return; }
            if (this.openKey === null)  { this.renderInbox(); return; }

            const list = this.listByKey(this.openKey);
            if (!list) { this.openKey = null; this.renderInbox(); return; }
            if (this.shareOpen)         { this.renderShare(list); return; }

            this.$main.attr('data-listkey', list.key).html(this.listViewHtml(list) + this.quickBar());
            this.renderProgress();
            this.renderDest();
            this.icons();
        }

        // La vista de una lista: cabecera, progreso, secciones y tareas. Es lo unico
        // que el visor necesita, asi que vive aparte del armazon del modal y se pinta
        // igual en los dos sitios. `embedded` retira lo que solo tiene sentido dentro
        // del cajon (compartir, archivar, abrir el archivo).
        listViewHtml(list, embedded) {
            const rw   = this.canEdit(list);
            const secs = list.sections || [];
            const body = secs.length
                ? secs.map((sec) => this.secBlock(sec, rw)).join('')
                : (rw
                    ? '<div class="tdw-sec" data-sec="">' +
                        '<div class="tdw-add">' +
                          '<span class="tdw-plus">' + ico(ICON.plus) + '</span>' +
                          '<input type="text" data-tdw="addtask" placeholder="Añadir la primera tarea…" maxlength="240">' +
                        '</div>' +
                      '</div>'
                    : this.emptyBlock(ICON.list, 'Esta lista todavía no tiene tareas',
                        esc((list.ownerName || 'Su dueño') + ' la compartió contigo para consulta.')));

            const done = (list.sections || []).some((s) => (s.tasks || []).some((t) => t.done));

            return '<div class="tdw-main-head">' +
                     '<div class="tdw-mh-row">' +
                       '<div class="tdw-mh-title">' +
                         '<h3' + (rw ? ' contenteditable="true" spellcheck="false" data-tdw="listtitle"' : '') + '>' + esc(list.title) + '</h3>' +
                         '<div class="tdw-crumb">' + ico(ICON.folder) + esc((list.crumbs || []).join(' / ')) +
                           ((list.crumbs || []).length ? ' / ' : '') + '<code>' + esc(list.file) + '</code>' +
                           this.originNote(list) + '</div>' +
                       '</div>' +
                       '<div class="tdw-mh-actions">' +
                         // El segmento de filtro vive en la barra de la ventana; el
                         // panel embebido no la tiene, asi que lo lleva aqui: sin el
                         // se quedaria fijo en "Pendientes" y las tareas hechas serian
                         // invisibles desde el visor.
                         (embedded
                           ? '<div class="tdw-seg">' +
                               ['pending:Pendientes', 'all:Todas', 'done:Hechas'].map((o) => {
                                   const f = o.split(':');
                                   return '<button data-tdw="filter" data-f="' + f[0] + '" type="button"' +
                                          (this.filter === f[0] ? ' class="is-on"' : '') + '>' + f[1] + '</button>';
                               }).join('') +
                             '</div>'
                           : '') +
                         (!embedded && list.scope === 'mine'
                           ? '<button class="tdw-btn' + ((list.shares || []).length ? ' is-shared' : '') + '" data-tdw="share" type="button" title="Compartir con otras cuentas">' +
                               ico(ICON.share) + '<span>' + ((list.shares || []).length ? 'Compartida · ' + list.shares.length : 'Compartir') + '</span></button>'
                           : '') +
                         (embedded ? '' : '<button class="tdw-btn" data-tdw="openfile" type="button" title="Abrir el archivo en el visor">' + ico(ICON.open) + '<span>Abrir</span></button>') +
                         '<button class="tdw-btn" data-tdw="prompt" type="button" title="Copiar prompt de la lista">' + ico(ICON.copy) + '<span>Copiar prompt</span></button>' +
                         (rw && done ? '<button class="tdw-btn" data-tdw="clearcompleted" type="button" title="Quitar las tareas hechas">' + ico(ICON.broom) + '</button>' : '') +
                         (embedded ? '' : (this.isArchived(list.key)
                           ? '<button class="tdw-btn" data-tdw="unarchive" type="button" title="Restaurar">' + ico(ICON.restore) + '</button>'
                           : '<button class="tdw-btn" data-tdw="archive" type="button" title="Archivar">' + ico(ICON.archive) + '</button>')) +
                       '</div>' +
                     '</div>' +
                     '<div class="tdw-progress"' + (embedded ? '' : ' id="tdwProgress"') + '></div>' +
                   '</div>' +
                   '<div class="tdw-scroll">' + body +
                     (rw ? '<button class="tdw-newsec" data-tdw="newsec" type="button">' + ico(ICON.plus) + ' Nueva sección</button>' : '') +
                   '</div>';
        }

        // ── Propuesta de tareas venida del chat ─────────────────────────────
        // La pinta este archivo y nadie mas. Hay tres chats (el cajon del visor, el
        // de pantalla completa y el del playground) con tres renderizadores propios:
        // si cada uno dibujara su tarjeta acabarian divergiendo, que es justo lo que
        // pasaba con el panel TODO antes de unificarlo.
        //
        // `payload` es lo que devolvio la tool todo_propose:
        //   { titulo, secciones: [{ titulo, tareas: [{ text, prio, tags, ref }] }] }
        // `$host` es donde el chat quiere la tarjeta. `opts.listKey` fija el destino
        // (el visor sabe que lista tiene abierta; los demas dejan elegir).
        proposal(payload, $host, opts) {
            if (!payload || !Array.isArray(payload.secciones) || !payload.secciones.length) return null;
            if (!$host || !$host.length) return null;
            this.mount();

            const o  = opts || {};
            const id = uid('p');
            const total = payload.secciones.reduce((n, s) => n + (s.tareas || []).length, 0);

            const filas = payload.secciones.map((sec) =>
                '<p class="tdw-prop-sec">' + esc(sec.titulo || 'Pendientes') + '</p>' +
                (sec.tareas || []).map((t, i) => {
                    const key = payload.secciones.indexOf(sec) + ':' + i;
                    return '<label class="tdw-prop-row">' +
                             '<input type="checkbox" checked data-prop-task="' + key + '">' +
                             '<span class="tdw-prop-txt">' + esc(t.text) +
                               (t.ref ? '<em>' + esc(t.ref) + '</em>' : '') +
                             '</span>' +
                             this.chipsHtml(Object.assign({}, t, { due: null })) +
                           '</label>';
                }).join('')
            ).join('');

            const selHtml = o.listKey
                ? '<span class="tdw-prop-dest is-fixed">' + ico(ICON.folder) + esc(o.listLabel || 'esta lista') + '</span>'
                : this.destSelectHtml();

            const $card = $(
                '<div class="tdw-prop" data-prop="' + id + '" data-prop-key="' + esc(o.listKey || '') + '">' +
                  '<div class="tdw-prop-head">' + ico(ICON.list) +
                    '<b>' + esc(payload.titulo || 'Tareas propuestas') + '</b>' +
                    '<span>' + total + (total === 1 ? ' tarea' : ' tareas') + '</span>' +
                  '</div>' +
                  '<div class="tdw-prop-body">' + filas + '</div>' +
                  '<div class="tdw-prop-foot">' +
                    '<span class="tdw-prop-n"></span>' + selHtml +
                    '<button type="button" class="tdw-prop-btn" data-prop-skip>Descartar</button>' +
                    '<button type="button" class="tdw-prop-btn is-pri" data-prop-add>Añadir</button>' +
                  '</div>' +
                '</div>'
            );

            $card.data('payload', payload);
            $host.append($card);
            this.applyAccent();
            this.icons();
            this.syncProposal($card);

            // El catalogo de listas solo se carga al abrir la ventana del TODO. Si el
            // chat propone antes de que eso ocurra no habria donde guardar, asi que
            // se pide aqui y el selector se rellena cuando llega.
            if (!o.listKey && !this.lists.length) this.scanForDest();
            return $card;
        }

        // Opciones del selector de destino (o el aviso de que no hay ninguna lista).
        destSelectHtml() {
            const destinos = this.visibleLists().filter((l) => this.canEdit(l) && !l.embedded);
            if (!destinos.length) {
                return '<span class="tdw-prop-dest is-empty" data-prop-empty>Sin listas donde guardar</span>';
            }
            return '<select class="tdw-prop-dest" data-prop-list>' +
                     destinos.map((l) => '<option value="' + esc(l.key) + '">' +
                       esc(l.title) + ' · ' + esc(l.pathLabel || l.file) + '</option>').join('') +
                   '</select>';
        }

        // Escaneo silencioso para las tarjetas de propuesta: no repinta la ventana
        // (puede estar cerrada), solo rellena los selectores que esten esperando.
        scanForDest() {
            if (this.loading) return;
            this.loading = true;
            $.get(API, { action: 'scan' })
                .done((res) => {
                    if (!res || !res.success) return;
                    this.lists = res.lists || [];
                    const self = this;
                    $('.tdw-prop:not(.is-done)').each(function () {
                        const $c = $(this);
                        if ($c.attr('data-prop-key')) return;          // destino fijo
                        $c.find('[data-prop-list], [data-prop-empty]').replaceWith(self.destSelectHtml());
                        self.syncProposal($c);
                    });
                })
                .always(() => { this.loading = false; });
        }

        // Atajo para los chats: cuelga la tarjeta del ultimo mensaje del hilo. Las
        // tres superficies pintan sus burbujas con la misma clase (.ia-msg.ai), asi
        // que cada una solo tiene que decir cual es su contenedor.
        proposalIn(payload, selector, opts) {
            const $c = $(selector);
            if (!$c.length) return null;
            const $last = $c.find('.ia-msg.ai').last();
            return this.proposal(payload, $last.length ? $last : $c, opts);
        }

        // Cuenta lo marcado y refleja el numero en el boton.
        syncProposal($card) {
            const n = $card.find('[data-prop-task]:checked').length;
            const sinDestino = !$card.attr('data-prop-key') && !$card.find('[data-prop-list]').length;
            $card.find('.tdw-prop-n').text(n + ' de ' + $card.find('[data-prop-task]').length);
            $card.find('[data-prop-add]')
                 .prop('disabled', !n || sinDestino)
                 .text(n ? 'Añadir ' + n : 'Añadir');
        }

        // Manda al servidor solo lo marcado. El archivo se modifica alli (action=append),
        // no se reescribe desde aqui: entre la propuesta y el disco no hay una copia
        // del navegador que pueda pisar lo que otro escribio mientras tanto.
        applyProposal($card) {
            const payload = $card.data('payload');
            const key     = $card.attr('data-prop-key') || $card.find('[data-prop-list]').val() || '';
            const list    = this.listByKey(key);
            if (!payload || !list) { this.flash('elige a qué lista van', 'error'); return; }

            const secciones = [];
            payload.secciones.forEach((sec, si) => {
                const tareas = (sec.tareas || []).filter((t, i) =>
                    $card.find('[data-prop-task="' + si + ':' + i + '"]').is(':checked'));
                if (tareas.length) secciones.push({ titulo: sec.titulo || 'Pendientes', tareas: tareas });
            });
            if (!secciones.length) return;

            $card.addClass('is-sending').find('[data-prop-add]').prop('disabled', true).text('Añadiendo…');

            $.post(API, { action: 'append', fullPath: list.fullPath, sections: JSON.stringify(secciones) })
                .done((res) => {
                    if (!res || !res.success) {
                        $card.removeClass('is-sending');
                        this.syncProposal($card);
                        this.flash((res && res.message) || 'no se pudieron añadir', 'error');
                        return;
                    }
                    // La ficha que devuelve el servidor ya trae la lista con las tareas
                    // dentro: se cambia en sitio para no volver a escanear la biblioteca.
                    const i = this.lists.findIndex((l) => l.key === list.key);
                    if (i >= 0) this.lists[i] = Object.assign({}, this.lists[i], res.entry);
                    if (this.openKey === list.key) { this.renderMain(); this.icons(); }
                    this.lists.filter((l) => l.embedded && l.fullPath === list.fullPath)
                              .forEach((l) => this.reloadEmbedded(l, res.entry));
                    this.summary();
                    this.renderRail();

                    $card.addClass('is-done').html(
                        '<div class="tdw-prop-ok">' + ico(ICON.check) +
                          '<b>' + res.added + (res.added === 1 ? ' tarea añadida' : ' tareas añadidas') + '</b>' +
                          '<span>' + esc(list.title) + '</span>' +
                        '</div>');
                    this.icons();
                })
                .fail((xhr) => {
                    $card.removeClass('is-sending');
                    this.syncProposal($card);
                    this.flash(this.reasonOf(xhr), 'error');
                });
        }

        // Refresca un panel embebido con la version del servidor tras un append.
        reloadEmbedded(list, entry) {
            if (!entry || !Array.isArray(entry.sections)) return;
            list.sections = entry.sections;
            this.recount(list);
            this.renderEmbed(list);
        }

        // ── Panel embebido ──────────────────────────────────────────────────
        // Monta la vista de una lista fuera del cajon (hoy: la hoja del visor). La
        // lista no viene del escaneo sino del archivo que el anfitrion ya tiene
        // abierto, y se guarda con su `onSave`, no con el controlador de aqui.
        //
        // Al registrarla en `this.lists` con su key, todo lo demas —refOf, persist,
        // arrastre, varita, chips, editor de campos— funciona sin distinguir si esta
        // dentro o fuera del modal.
        embed($host, opts) {
            this.mount();
            const o   = opts || {};
            const key = 'embed::' + (o.fullPath || o.file || 'todo.json');

            let data;
            try { data = JSON.parse(o.raw || ''); } catch (e) { data = null; }
            if (!data || typeof data !== 'object') data = {};

            const sections = Array.isArray(data.sections) ? data.sections : [];
            sections.forEach((s) => {
                if (!s.id) s.id = uid('s');
                if (!Array.isArray(s.tasks)) s.tasks = [];
                s.tasks.forEach((t) => { if (!t.id) t.id = uid('t'); });
            });

            const list = {
                key: key, scope: 'mine', embedded: true, host: $host.get(0),
                title: data.title || o.title || 'TODO',
                file: o.file || 'todo.json',
                crumbs: o.crumbs || [],
                fullPath: o.fullPath || '',
                sections: sections,
                extra: (function (d) {
                    const rest = {};
                    Object.keys(d).forEach((k) => { if (k !== 'title' && k !== 'sections') rest[k] = d[k]; });
                    return rest;
                })(data),
                canEdit: o.canEdit !== false,
                shares: [],
                onSave: o.onSave
            };
            this.recount(list);

            this.lists = this.lists.filter((l) => l.key !== key).concat([list]);
            $host.attr('data-listkey', key).addClass('tdw-embed').html(this.listViewHtml(list, true));
            this.bindEmbed($host);
            this.applyAccent();
            this.syncChipToggles();
            this.renderProgress(list);
            this.icons();
            return list;
        }

        // Los handlers del cajon estan delegados sobre el velo; aqui se vuelven a
        // aplicar sobre el contenedor embebido, una sola vez por contenedor.
        bindEmbed($host) {
            if ($host.data('tdwBound')) return;
            $host.data('tdwBound', true);
            (this._binds || []).forEach((args) => $host.on.apply($host, args));
        }

        // Repinta el panel embebido de una lista (tras acciones que cambian su
        // estructura: limpiar completadas, nueva sección…).
        renderEmbed(list) {
            if (!list || !list.embedded || !list.host) return;
            const $host = $(list.host);
            $host.html(this.listViewHtml(list, true));
            this.renderProgress(list);
            this.syncChipToggles();
            this.icons();
        }

        // Repinta donde viva la lista: el cajon o el panel embebido.
        repaint(list) {
            if (list && list.embedded) { this.renderEmbed(list); return; }
            this.renderMain();
            this.icons();
        }

        // Coletilla de la miga de pan cuando la lista no es propia: de quien es y
        // que se puede hacer con ella.
        originNote(list) {
            if (!this.isInvited(list)) return '';
            return '<span class="tdw-tag' + (this.canEdit(list) ? '' : ' is-ro') + '">' +
                     ico(this.canEdit(list) ? ICON.pencil : ICON.eye) +
                     esc((list.ownerName || 'Otra cuenta') + (this.canEdit(list) ? ' · puedes editarla' : ' · solo consulta')) +
                   '</span>';
        }

        // `rw` (read-write) apaga los controles de escritura cuando la lista es
        // prestada en modo consulta: sin caja de captura, sin renombrar, sin borrar.
        secBlock(sec, rw) {
            const tasks = (sec.tasks || []).filter((t) => this.keeps(t));
            return '<section class="tdw-sec" data-sec="' + esc(sec.id) + '">' +
                     '<div class="tdw-sec-head">' +
                       '<h4' + (rw ? ' contenteditable="true" spellcheck="false" data-tdw="sectitle"' : '') + '>' + esc(sec.title) + '</h4>' +
                       '<span class="tdw-n">' + (sec.tasks || []).length + '</span>' +
                       '<span class="tdw-sec-tools">' +
                         '<button data-tdw="secprompt" title="Copiar prompt de la sección">' + ico(ICON.copy) + '</button>' +
                         (rw ? '<button data-tdw="delsec" title="Eliminar sección">' + ico(ICON.close) + '</button>' : '') +
                       '</span>' +
                     '</div>' +
                     tasks.map((t) => this.taskRow(t, null, rw)).join('') +
                     (rw
                        ? '<div class="tdw-add">' +
                            '<span class="tdw-plus">' + ico(ICON.plus) + '</span>' +
                            '<input type="text" data-tdw="addtask" placeholder="Añadir tarea…" maxlength="240">' +
                          '</div>'
                        : '') +
                   '</section>';
        }

        // En la Bandeja y en la busqueda cada fila trae su origen, asi que el
        // permiso se resuelve por la lista a la que pertenece, no por la abierta.
        taskRow(task, origin, rw) {
            const editable = rw !== false;
            return '<div class="tdw-task' + (task.done ? ' is-done' : '') + (editable ? '' : ' is-ro') + '" data-id="' + esc(task.id) + '"' +
                        (origin ? ' data-key="' + esc(origin.key) + '" data-sec="' + esc(origin.secId) + '"' : '') + '>' +
                     // En la Bandeja y en la busqueda las filas vienen de varias
                     // listas: ahi no hay orden que reordenar, por eso no llevan grip.
                     (editable && !origin ? '<span class="tdw-grip" title="Arrastra para reordenar">' + ico(ICON.grip) + '</span>' : '') +
                     (editable
                        ? '<button class="tdw-chk" data-tdw="check" type="button" title="Marcar">' + ico(ICON.check) + '</button>'
                        : '<span class="tdw-chk is-ro" title="Solo consulta">' + ico(ICON.check) + '</span>') +
                     '<span class="tdw-txt"' + (origin || !editable ? '' : ' contenteditable="true" spellcheck="false" data-tdw="tasktext"') + '>' +
                       (origin ? mark(task.text, this.query) : esc(task.text)) +
                     '</span>' +
                     this.chipsHtml(task) +
                     (origin
                        ? '<button class="tdw-origin" data-tdw="goto" type="button" title="Abrir esta lista">' + ico(ICON.folder) + esc(origin.label) + '</button>'
                        : '') +
                     (editable
                        ? '<span class="tdw-task-tools">' +
                            // La varita solo en la lista abierta: en la Bandeja la fila
                            // es de otra lista y la sugerencia no tendria donde vivir.
                            (origin ? '' : '<button data-tdw="fields" title="Fecha, prioridad y etiquetas">' + ico(ICON.fields) + '</button>') +
                            (origin ? '' : '<button data-tdw="magic" title="Mejorar con IA">' + ico(ICON.wand) + '</button>') +
                            '<button data-tdw="deltask" title="Eliminar">' + ico(ICON.close) + '</button>' +
                          '</span>'
                        : '') +
                   '</div>';
        }

        // Sin argumento pinta el progreso de la lista abierta en el modal; con una
        // lista embebida pinta el de su propio contenedor.
        renderProgress(which) {
            const list = which || this.listByKey(this.openKey);
            const $p = list && list.embedded
                ? $(list.host).find('.tdw-progress').first()
                : $('#tdwProgress');
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
                        rows.push(this.taskRow(task, { key: list.key, secId: sec.id, label: list.title + ' · ' + sec.title }, this.canEdit(list)));
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
                        rows.push(this.taskRow(task, { key: list.key, secId: sec.id, label: list.title + ' · ' + sec.title }, this.canEdit(list)));
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
                if (!(list.sections || []).length || !this.canEdit(list)) return;
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
            if (!this.canEdit(dest.list)) {
                this.flash('Esa lista se compartió contigo solo para consulta', 'error');
                return false;
            }

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
            this.closeShare();
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

        // ── Compartir con otras cuentas ─────────────────────────────────────
        // El archivo no se mueve ni se duplica: el servidor solo anota que otra
        // cuenta puede abrirlo (ver ctrl/todo-shares.php). Por eso solo se ofrece
        // sobre listas propias — la carpeta comun ya la ve todo el mundo y lo
        // prestado no es de uno para volver a prestarlo.
        openShare() {
            const list = this.listByKey(this.openKey);
            if (!list || list.scope !== 'mine') {
                this.flash('Solo puedes compartir listas de tu biblioteca', 'error');
                return;
            }
            this.shareOpen = true;
            this.closeForm();

            if (this.users) { this.renderMain(); return; }
            $.get(API, { action: 'users' })
                .done((res) => {
                    if (!res || !res.success) { this.shareOpen = false; this.flash((res && res.message) || 'no se pudo leer las cuentas', 'error'); this.render(); return; }
                    this.users = res.users || [];
                    this.renderMain();
                })
                .fail((xhr) => { this.shareOpen = false; this.flash(this.reasonOf(xhr), 'error'); this.render(); });
        }

        closeShare() {
            this.shareOpen = false;
        }

        renderShare(list) {
            const shares = list.shares || [];
            const taken  = {};
            shares.forEach((s) => { taken[s.id] = s.permission; });

            // Una cuenta que ya tiene acceso sigue en el selector: volver a
            // enviarla es la forma de cambiarle el permiso.
            const opts = (this.users || []).map((u) =>
                '<option value="' + u.id + '">' + esc(u.name || u.email) +
                    (u.email ? ' — ' + esc(u.email) : '') +
                    (taken[u.id] ? ' (ya tiene acceso)' : '') + '</option>'
            ).join('');

            const rows = shares.length
                ? shares.map((s) =>
                    '<div class="tdw-share-row" data-target="' + s.id + '">' +
                      '<span class="tdw-share-who"><b>' + esc(s.name || s.email) + '</b>' +
                        (s.email ? '<small>' + esc(s.email) + '</small>' : '') + '</span>' +
                      '<select class="tdw-share-perm" data-tdw="shareperm">' +
                        '<option value="edit"' + (s.permission === 'edit' ? ' selected' : '') + '>Puede editar</option>' +
                        '<option value="view"' + (s.permission === 'view' ? ' selected' : '') + '>Solo consulta</option>' +
                      '</select>' +
                      '<button class="tdw-btn" data-tdw="unshare" type="button" title="Quitar acceso">' + ico(ICON.trash) + '</button>' +
                    '</div>').join('')
                : '<p class="tdw-share-none">Todavía no la comparte con nadie.</p>';

            this.$main.html(
                '<div class="tdw-main-head">' +
                  '<div class="tdw-mh-row">' +
                    '<div class="tdw-mh-title">' +
                      '<h3>Compartir “' + esc(list.title) + '”</h3>' +
                      '<div class="tdw-crumb">' + ico(ICON.users) +
                        'El archivo se queda en tu biblioteca · <code>' + esc(list.pathLabel) + '</code></div>' +
                    '</div>' +
                    '<div class="tdw-mh-actions">' +
                      '<button class="tdw-btn" data-tdw="closeshare" type="button">' + ico(ICON.back) + '<span>Volver a la lista</span></button>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="tdw-scroll">' +
                  '<div class="tdw-form">' +
                    '<h4>' + ico(ICON.share) + ' Dar acceso</h4>' +
                    (opts
                      ? '<div class="tdw-field"><label>Cuenta</label><select id="tdwShareUser">' + opts + '</select></div>' +
                        '<div class="tdw-field"><label>Permiso</label><select id="tdwSharePerm">' +
                          '<option value="edit">Puede editar — palomear, agregar y borrar tareas</option>' +
                          '<option value="view">Solo consulta — ve la lista y su avance</option>' +
                        '</select></div>' +
                        '<div class="tdw-form-foot">' +
                          '<button class="tdw-btn is-primary" data-tdw="doshare" type="button">' + ico(ICON.share) + ' Compartir</button>' +
                        '</div>'
                      : '<p class="tdw-share-none">No hay otras cuentas registradas todavía.</p>') +
                  '</div>' +
                  '<div class="tdw-form">' +
                    '<h4>' + ico(ICON.users) + ' Con acceso (' + shares.length + ')</h4>' +
                    rows +
                  '</div>' +
                '</div>'
            );
            this.icons();
        }

        // Alta y baja comparten respuesta: el servidor devuelve como queda la
        // lista de accesos, asi no hay que adivinarlo en el cliente.
        applyShares(list, shares) {
            list.shares = shares || [];
            this.renderRail();
            this.renderMain();
        }

        share() {
            const list = this.listByKey(this.openKey);
            if (!list) return;
            const target     = parseInt($('#tdwShareUser').val(), 10) || 0;
            const permission = String($('#tdwSharePerm').val() || 'edit');
            if (!target) { this.flash('Elige con quién compartirla', 'error'); return; }

            $.post(API, { action: 'share', rel: list.rel, target: target, permission: permission })
                .done((res) => {
                    if (!res || !res.success) { this.flash((res && res.message) || 'no se pudo compartir', 'error'); return; }
                    this.applyShares(list, res.shares);
                    this.flash('Lista compartida', 'ok');
                })
                .fail((xhr) => this.flash(this.reasonOf(xhr), 'error'));
        }

        unshare(target) {
            const list = this.listByKey(this.openKey);
            if (!list || !target) return;

            $.post(API, { action: 'unshare', rel: list.rel, target: target })
                .done((res) => {
                    if (!res || !res.success) { this.flash((res && res.message) || 'no se pudo quitar el acceso', 'error'); return; }
                    this.applyShares(list, res.shares);
                    this.flash('Acceso retirado', 'ok');
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

        // Solo lo pendiente: una tarea ya hecha en el prompt invita al modelo a
        // rehacerla. Si no queda nada por hacer devuelve '' y quien llama avisa.
        promptOf(list, sec) {
            const source = sec ? [sec] : (list.sections || []);
            const lines  = [];
            source.forEach((s) => {
                const pend = (s.tasks || []).filter((t) => !t.done);
                if (!pend.length) return;
                if (!sec) lines.push('', '## ' + s.title);
                pend.forEach((t) => lines.push('- [ ] ' + t.text));
            });
            if (!lines.length) return '';

            return 'Trabajemos en las tareas pendientes de "' + list.title + '"' +
                   (sec ? ' · sección "' + sec.title + '"' : '') + ':\n' + lines.join('\n') + '\n\n' +
                   'Impleméntalas en orden. No agregues nada que no esté en la lista y al terminar ' +
                   'dime qué tareas quedaron listas.\n\n' +
                   'Usando las reglas de CoffeeSoft /coffee-ia';
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
            if (!blocks.length) return '';

            return 'Estos son todos mis pendientes:\n\n' + blocks.join('\n\n') +
                   '\n\nDime en qué orden los atacarías y por qué.\n\n' +
                   'Usando las reglas de CoffeeSoft /coffee-ia';
        }

        // ── Mejorar la tarea con IA ─────────────────────────────────────────
        // Reescribe el texto con el modelo fijo. Devuelve '' si no hubo respuesta
        // util y deja el motivo en this.iaError: el texto original no se toca nunca,
        // la propuesta se muestra aparte y el usuario decide.
        improveTask(text, listTitle, secTitle) {
            const system = 'Reescribes tareas de un TODO de desarrollo de software. '
                + 'Respondes SIEMPRE con una sola linea: la tarea reescrita, clara y accionable, '
                + 'en espanol, con ortografia y acentos correctos, empezando con un verbo en infinitivo. '
                + 'Conservas la intencion original y los nombres tecnicos tal cual (archivos, clases, modulos). '
                + 'Sin vinetas, sin numeracion, sin comillas, sin markdown y sin explicaciones.';
            const user = 'Contexto: lista "' + (listTitle || 'TODO') + '", seccion "' + (secTitle || '') + '".\n'
                + 'Tarea original: ' + text;

            this.iaError = '';
            return fetch(API_IA, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ systemOverride: system, messages: [{ role: 'user', content: user }], model: IA_MODEL })
            })
                .then((r) => r.json())
                .then((data) => {
                    if (!data || !data.ok) { this.iaError = (data && data.error) || 'Respuesta invalida de la IA'; return ''; }
                    const line = String(data.reply || '')
                        .replace(/<think>[\s\S]*?<\/think>/gi, '')
                        .split('\n').map((s) => s.trim()).filter(Boolean)[0] || '';
                    return line.replace(/^[-*]\s*(\[[ xX]\]\s*)?/, '').replace(/^["'`]|["'`]$/g, '').trim();
                })
                .catch((e) => { this.iaError = e.message || 'No se pudo consultar la IA'; return ''; });
        }

        suggestHtml(txt) {
            return '<div class="tdw-suggest">' +
                     '<span class="tdw-suggest-txt">' + esc(txt) + '</span>' +
                     '<span class="tdw-suggest-act">' +
                       '<button data-tdw="applysuggest" type="button">Aplicar</button>' +
                       '<button data-tdw="skipsuggest" type="button">Descartar</button>' +
                     '</span>' +
                   '</div>';
        }

        // Animacion de copiado: el icono del boton pasa a palomita y sube una
        // burbuja desde el. La barra de resumen queda como aviso de respaldo, pero
        // el ojo esta en el boton que se acaba de pulsar, no arriba.
        copiedFx($btn) {
            if (!$btn || !$btn.length) return;
            const self = this;
            const el   = $btn.get(0);

            clearTimeout($btn.data('fxTimer'));
            if ($btn.data('fxHtml') == null) $btn.data('fxHtml', $btn.html());
            const hadText = !!$btn.find('span').length;
            $btn.addClass('is-copied').html(ico(ICON.check) + (hadText ? '<span>Copiado</span>' : ''));
            this.icons();
            $btn.data('fxTimer', setTimeout(function () {
                $btn.removeClass('is-copied').html($btn.data('fxHtml'));
                $btn.removeData('fxHtml');
                self.icons();
            }, 1400));

            const r   = el.getBoundingClientRect();
            const pop = document.createElement('div');
            pop.className   = 'tdw-copied-pop';
            pop.textContent = 'Copiado';
            pop.style.left  = Math.round(r.left + r.width / 2) + 'px';
            pop.style.top   = Math.round(r.top - 6) + 'px';
            // En el contenedor del boton (ventana o panel embebido): ahi hereda la
            // paleta y se ve aunque la ventana este cerrada.
            ($btn.closest('.tdw-embed, .tdw-veil').get(0) || document.body).appendChild(pop);
            setTimeout(() => pop.remove(), 950);
        }

        copy(text, okMsg, $btn) {
            const ok   = () => { this.flash(okMsg, 'ok'); this.copiedFx($btn); };
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
            // El visor declara su instancia con `let app` a nivel de script, y eso NO
            // crea window.app: hay que leer el identificador del ambito global de
            // scripts. Buscarlo en `global` devolvia undefined y esta ventana acababa
            // abriendo el visor en otra pestana teniendolo delante.
            const vsr = (typeof app !== 'undefined' && app) ? app : global.app;

            if (vsr && typeof vsr.loadFile === 'function' && Array.isArray(vsr.allFiles)) {
                const found = vsr.allFiles.filter((f) => norm(f.fullPath) === norm(list.fullPath))[0];
                if (found) { this.close(); vsr.loadFile(found.file, found); return; }
                this.flash('El visor no tiene ese archivo en la carpeta abierta', 'error');
                return;
            }
            global.open('index.php', '_blank');
        }

        // ── Eventos ─────────────────────────────────────────────────────────
        bind() {
            const self = this;

            // Todos los handlers se enganchan por delegacion sobre el velo, pero la
            // misma vista de lista se monta tambien fuera de el (embebida en el
            // visor). En vez de partir este bloque en dos, cada enganche se anota y
            // se vuelve a aplicar sobre el contenedor embebido al montarlo: un solo
            // juego de handlers para los dos sitios.
            this._binds = [];
            const $v = {
                on: function () {
                    const args = Array.prototype.slice.call(arguments);
                    self._binds.push(args);
                    self.$veil.on.apply(self.$veil, args);
                    return $v;
                },
                find: function () { return self.$veil.find.apply(self.$veil, arguments); },
                addClass:    function () { return self.$veil.addClass.apply(self.$veil, arguments); },
                removeClass: function () { return self.$veil.removeClass.apply(self.$veil, arguments); },
                toggleClass: function () { return self.$veil.toggleClass.apply(self.$veil, arguments); }
            };

            // Clic en el velo (fuera de la ventana) cierra. En el panel embebido no
            // hay ventana que cerrar, por eso se compara contra el velo real.
            $v.on('click', function (e) { if (e.target === this && this === self.$veil.get(0)) self.close(); });
            $(document).on('keydown.tdw', (e) => {
                if (e.key !== 'Escape' || !this.isOpen()) return;
                // Escape cierra primero lo que este encima; solo si no hay nada
                // abierto encima cierra la ventana.
                if (!$('#tdwFields').prop('hidden'))  { this.closeFieldsMenu(); return; }
                if (!$('#tdwAccents').prop('hidden')) { this.toggleAccents(false); return; }
                // Con el detalle abierto en el telefono, primero se retrocede.
                if (this.inDetail()) { this.backToRail(); return; }
                this.close();
            });

            $v.on('click', '[data-tdw="close"]',   () => this.close());
            $v.on('click', '[data-tdw="refresh"]', () => this.scan());

            // Color del tema: el panel se queda abierto al elegir para poder comparar.
            $v.on('click', '[data-tdw="accent"]', function (e) {
                e.stopPropagation();
                self.toggleAccents();
            });
            $v.on('click', '[data-accent]', function () { self.setAccent($(this).attr('data-accent')); });
            $v.on('click', '[data-chip]',   function () { self.toggleChip($(this).attr('data-chip')); });
            $v.on('click', function (e) {
                if ($(e.target).closest('#tdwAccents, [data-tdw="accent"]').length) return;
                self.toggleAccents(false);
            });
            $v.on('click', '[data-tdw="wide"]',    () => $v.toggleClass('is-wide'));
            $v.on('click', '[data-tdw="new"]',     () => { this.openForm(); this.showDetail(); });
            $v.on('click', '[data-tdw="cancelnew"]', () => { this.closeForm(); this.render(); });
            $v.on('click', '[data-tdw="createnew"]', () => this.createList());

            $v.on('click', '[data-tdw="clearsearch"]', () => {
                this.query = '';
                $('#tdwSearch').val('');
                this.render();
                // Sin busqueda no hay resultados que mirar: se vuelve al listado.
                this.backToRail();
            });

            // El buscador vive en el rail y sus resultados en el detalle: en el
            // telefono se salta alla al confirmar, no mientras se teclea.
            $v.on('keydown', '#tdwSearch', function (e) {
                if (e.key !== 'Enter') return;
                self.query = this.value.trim();
                self.render();
                if (self.query.length >= 2) self.showDetail();
            });

            $v.on('click', '[data-tdw="filter"]', function () {
                self.filter = $(this).data('f');
                // Los dos juegos de botones (ventana y panel embebido) miran el mismo
                // filtro: se marcan los dos y se repinta lo que este montado.
                $('[data-tdw="filter"]').removeClass('is-on')
                    .filter('[data-f="' + self.filter + '"]').addClass('is-on');
                if (self.isOpen()) self.render();
                self.lists.filter((l) => l.embedded).forEach((l) => self.renderEmbed(l));
            });

            let searchTimer = null;
            $v.on('input', '#tdwSearch', function () {
                const value = this.value.trim();
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => {
                    self.query = value;
                    self.closeForm();
                    self.closeShare();
                    self.render();
                }, 160);
            });

            $v.on('click', '[data-tdw="group"]', function () {
                const kind = $(this).data('kind');
                if (kind === 'empty') self.showEmpty = !self.showEmpty;
                else if (kind === 'invited') self.showInvited = !self.showInvited;
                else self.showArchived = !self.showArchived;
                self.renderRail();
            });

            $v.on('click', '[data-tdw="back"]', () => this.backToRail());

            $v.on('click', '[data-tdw="inbox"]', function () {
                self.closeForm();
                self.closeShare();
                self.openKey = null;
                self.render();
                self.showDetail();
            });

            $v.on('click', '[data-tdw="pick"]', function () {
                self.closeForm();
                self.closeShare();
                self.openKey = $(this).data('key');
                // Abrir una lista apunta ahi la captura rapida, salvo que el
                // usuario haya fijado otro destino a mano.
                const list = self.listByKey(self.openKey);
                if (list && self.canEdit(list) && (list.sections || []).length && !self.destOf()) {
                    self.destKey = list.key + '::' + list.sections[list.sections.length - 1].id;
                }
                self.render();
                self.showDetail();
            });

            // Chip de origen en la Bandeja / busqueda: salta a esa lista.
            $v.on('click', '[data-tdw="goto"]', function (e) {
                e.stopPropagation();
                self.closeShare();
                self.openKey = $(this).closest('.tdw-task').data('key');
                self.query = '';
                $('#tdwSearch').val('');
                self.render();
                self.showDetail();
            });

            $v.on('click', '[data-tdw="openfile"]', () => {
                const list = this.listByKey(this.openKey);
                if (list) this.openInVisor(list);
            });

            $v.on('click', '[data-tdw="prompt"]', function () {
                const list = self.listOf($(this));
                if (!list) return;
                const txt = self.promptOf(list);
                if (!txt) return self.flash('Esta lista no tiene tareas pendientes', 'error');
                self.copy(txt, 'Prompt de la lista copiado', $(this));
            });

            $v.on('click', '[data-tdw="inboxprompt"]', function () {
                const txt = self.inboxPrompt();
                if (!txt) return self.flash('No tienes tareas pendientes', 'error');
                self.copy(txt, 'Pendientes copiados como prompt', $(this));
            });

            $v.on('click', '[data-tdw="clearcompleted"]', function () {
                const list = self.listOf($(this));
                if (!list) return;
                const n = (list.sections || []).reduce((a, s) => a + (s.tasks || []).filter((t) => t.done).length, 0);
                if (!n || !global.confirm('¿Quitar ' + plural(n, 'tarea hecha', 'tareas hechas') + ' de esta lista?')) return;
                (list.sections || []).forEach((s) => { s.tasks = (s.tasks || []).filter((t) => !t.done); });
                self.persist(list, true);
                self.repaint(list);
                self.flash(plural(n, 'tarea quitada', 'tareas quitadas'), 'ok');
            });

            $v.on('click', '[data-tdw="secprompt"]', function () {
                const ref = self.refOf($(this));
                if (!ref) return;
                const txt = self.promptOf(ref.list, ref.sec);
                if (!txt) return self.flash('Esta sección no tiene tareas pendientes', 'error');
                self.copy(txt, 'Prompt de la sección copiado', $(this));
            });

            $v.on('click', '[data-tdw="archive"]',   () => this.archive(this.openKey));
            $v.on('click', '[data-tdw="unarchive"]', () => this.unarchive(this.openKey));

            $v.on('click', '[data-tdw="share"]',      () => this.openShare());
            $v.on('click', '[data-tdw="closeshare"]', () => { this.closeShare(); this.renderMain(); this.icons(); });
            $v.on('click', '[data-tdw="doshare"]',    () => this.share());

            $v.on('click', '[data-tdw="unshare"]', function () {
                self.unshare(parseInt($(this).closest('.tdw-share-row').data('target'), 10) || 0);
            });

            // Cambiar el permiso es volver a compartir con la misma cuenta: el
            // servidor hace upsert y no hace falta una accion aparte.
            $v.on('change', '[data-tdw="shareperm"]', function () {
                const list   = self.listByKey(self.openKey);
                const target = parseInt($(this).closest('.tdw-share-row').data('target'), 10) || 0;
                if (!list || !target) return;

                $.post(API, { action: 'share', rel: list.rel, target: target, permission: $(this).val() })
                    .done((res) => {
                        if (!res || !res.success) { self.flash((res && res.message) || 'no se pudo cambiar el permiso', 'error'); return; }
                        self.applyShares(list, res.shares);
                        self.flash('Permiso actualizado', 'ok');
                    })
                    .fail((xhr) => self.flash(self.reasonOf(xhr), 'error'));
            });

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

            // ── Mejorar con IA ──
            $v.on('click', '[data-tdw="magic"]', function () {
                const $btn = $(this);
                if ($btn.hasClass('is-busy')) return;
                const ref = self.refOf($btn);
                if (!ref || !ref.task) return;

                const $row = $btn.closest('.tdw-task');
                $row.find('.tdw-suggest').remove();
                $btn.addClass('is-busy').html(ico(ICON.spin));
                self.icons();

                self.improveTask(ref.task.text, ref.list.title, ref.sec.title).then((improved) => {
                    $btn.removeClass('is-busy').html(ico(ICON.wand));
                    self.icons();
                    if (!improved)                   { self.flash(self.iaError || 'la IA no pudo mejorar la tarea', 'error'); return; }
                    if (improved === ref.task.text)  { self.flash('la tarea ya está clara', 'ok'); return; }
                    $row.append(self.suggestHtml(improved));
                });
            });

            $v.on('click', '[data-tdw="applysuggest"]', function () {
                const $box = $(this).closest('.tdw-suggest');
                const $row = $box.closest('.tdw-task');
                const ref  = self.refOf($row);
                if (!ref || !ref.task) return;
                ref.task.text = $box.find('.tdw-suggest-txt').text();
                $row.find('.tdw-txt').text(ref.task.text);
                $box.remove();
                self.persist(ref.list, true);
                self.flash('tarea mejorada', 'ok');
            });

            $v.on('click', '[data-tdw="skipsuggest"]', function () { $(this).closest('.tdw-suggest').remove(); });

            // ── Tarjeta de propuesta ──
            // Va sobre `document`: la tarjeta vive dentro del chat que la pidio, que
            // puede estar fuera del velo y fuera de cualquier panel embebido.
            $(document)
                .on('change.tdwprop', '[data-prop-task]', function () {
                    self.syncProposal($(this).closest('.tdw-prop'));
                })
                .on('click.tdwprop', '[data-prop-add]', function () {
                    self.applyProposal($(this).closest('.tdw-prop'));
                })
                .on('click.tdwprop', '[data-prop-skip]', function () {
                    const $c = $(this).closest('.tdw-prop');
                    $c.addClass('is-done').html('<div class="tdw-prop-ok is-skip">' + ico(ICON.close) + '<b>Propuesta descartada</b></div>');
                    self.icons();
                });

            // ── Fecha, prioridad y etiquetas ──
            $v.on('click', '[data-tdw="fields"]', function (e) {
                e.stopPropagation();
                self.openFieldsMenu($(this));
            });

            $(document).on('click.tdwf', '[data-prio]', function () {
                const val = $(this).attr('data-prio');
                $(this).closest('.tdw-fields-row').find('[data-prio]').removeClass('is-on');
                $(this).addClass('is-on');
                self.setTaskField('prio', val);
            });

            $(document).on('click.tdwf', '[data-due]', function () {
                const when = $(this).attr('data-due');
                let val = '';
                if (when) {
                    const d = new Date();
                    d.setHours(12, 0, 0, 0);                       // mediodia: el cambio de dia no lo corre
                    if (when === 'tomorrow') d.setDate(d.getDate() + 1);
                    if (when === 'week')     d.setDate(d.getDate() + 7);
                    val = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                }
                $('#tdwFields [data-tdw="duedate"]').val(val);
                self.setTaskField('due', val);
            });

            $(document).on('change.tdwf', '[data-tdw="duedate"]', function () { self.setTaskField('due', this.value); });

            $(document).on('keydown.tdwf', '[data-tdw="tagsinput"]', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
                if (e.key === 'Escape') { self.closeFieldsMenu(); }
            });

            $(document).on('blur.tdwf', '[data-tdw="tagsinput"]', function () {
                // "ui, #facture ,, ui" -> ["ui","facture"]: sin gato, sin vacias, sin repetir.
                const tags = [];
                String(this.value).split(',').forEach((raw) => {
                    const t = raw.trim().replace(/^#+/, '');
                    if (t && tags.indexOf(t) === -1) tags.push(t);
                });
                this.value = tags.join(', ');
                self.setTaskField('tags', tags);
            });

            // Un clic fuera cierra el editor; dentro no, para poder encadenar cambios.
            $(document).on('click.tdwf', function (e) {
                if ($(e.target).closest('#tdwFields, [data-tdw="fields"]').length) return;
                self.closeFieldsMenu();
            });

            // ── Reordenar tareas arrastrando ──
            // Arrastre propio con pointer events, no el DnD nativo: arranca a los 4px
            // de movimiento, no depende de que el navegador acepte el dragstart y
            // responde igual con dedo. Se agarra desde el grip o desde el fondo de la
            // fila; el texto y los controles conservan su comportamiento.
            $v.on('pointerdown', '.tdw-task', function (e) {
                const ev = e.originalEvent;
                if (ev.button > 0) return;
                if (!$(this).find('.tdw-grip').length) return;      // Bandeja/busqueda: no se reordena
                const $t = $(e.target);
                if (!$t.closest('.tdw-grip').length && $t.closest('.tdw-txt, button, input, .tdw-suggest').length) return;
                // Con el dedo solo se arrastra desde el asa. Agarrando la fila
                // entera, el gesto de deslizar para leer la lista arrancaria un
                // reordenamiento en vez de hacer scroll.
                if (ev.pointerType === 'touch' && !$t.closest('.tdw-grip').length) return;
                ev.preventDefault();
                self.startDragTask(this, ev);
            });

            $v.on('keydown', '.tdw-txt, [data-tdw="sectitle"], [data-tdw="listtitle"]', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
                if (e.key === 'Escape') { this.blur(); }
                // Alt+flechas: mismo reordenamiento sin mouse, dentro de la seccion.
                if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
                if (!$(this).is('[data-tdw="tasktext"]')) return;
                e.preventDefault();
                const $row = $(this).closest('.tdw-task'), up = e.key === 'ArrowUp';
                const $sib = up ? $row.prev('.tdw-task') : $row.next('.tdw-task');
                if (!$sib.length) return;
                if (up) $sib.before($row); else $sib.after($row);
                this.focus();
                self.commitTaskRow($row);
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
                const list = self.listOf($(this));
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

                const list = self.listOf($(this));
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
                self.repaint(list);
                // Seguir capturando sin volver a apuntar con el mouse.
                $('.tdw-sec[data-sec="' + sec.id + '"] [data-tdw="addtask"]').trigger('focus');
            });

            $v.on('click', '[data-tdw="newsec"]', function () {
                const list = self.listOf($(this));
                if (!list) return;
                const sec = { id: uid('s'), title: 'Nueva sección', tasks: [] };
                list.sections = (list.sections || []).concat([sec]);
                self.persist(list, true);
                self.repaint(list);

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
                self.repaint(ref.list);
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
        // ── Reordenar tareas: arrastre al estilo Notion ─────────────────────
        // La lista no se reordena en vivo. Se levanta un clon flotante que sigue al
        // cursor (solo transform, sin layout) y una linea marca donde va a caer; el
        // movimiento real se aplica una sola vez, al soltar.
        startDragTask(row, ev) {
            const self = this;
            const r    = row.getBoundingClientRect();
            this.drag = {
                row: row, x: ev.clientX, y: ev.clientY, y0: ev.clientY, px: 0, py: 0,
                dx: ev.clientX - r.left, dy: ev.clientY - r.top, w: r.width,
                moved: false, raf: 0, ghost: null, line: null, dest: null,
                // La ventana o el panel embebido: el arrastre solo mira dentro del
                // contenedor de donde salio la fila.
                scope: $(row).closest('.tdw-embed, .tdw-veil')
            };
            $(document)
                .on('pointermove.tdwdrag', function (me) {
                    const m = me.originalEvent, d = self.drag;
                    if (!d) return;
                    d.x = m.clientX;                                 // el trabajo real va en dragFrame
                    d.y = m.clientY;
                    if (d.moved || Math.abs(m.clientY - d.y0) < 4) return;   // umbral: un clic no arrastra
                    self.liftDragRow();
                })
                .on('pointerup.tdwdrag pointercancel.tdwdrag', function () { self.endDragTask(); });
        }

        // Levanta la fila: clon flotante bajo el cursor, linea de destino y la
        // original atenuada en su sitio (queda claro de donde salio).
        liftDragRow() {
            const d = this.drag;
            d.moved = true;

            // Van dentro del velo, no en el body: la paleta del hub (--tdw-*) esta
            // declarada en .tdw-veil, asi que fuera de el la linea saldria sin color.
            // El velo es fixed inset:0, de modo que las coordenadas siguen siendo las
            // del viewport.
            const veil = (d.scope && d.scope.get(0)) || this.$veil.get(0);

            const ghost = d.row.cloneNode(true);
            ghost.className  = 'tdw-task tdw-ghost';
            ghost.style.width = d.w + 'px';
            veil.appendChild(ghost);

            const line = document.createElement('div');
            line.className = 'tdw-dropline';
            veil.appendChild(line);

            d.ghost = ghost;
            d.line  = line;
            $(d.row).addClass('is-dragging');
            d.scope.addClass('tdw-dnd');
            d.raf = requestAnimationFrame(() => this.dragFrame());
        }

        // Decide en que borde caeria la fila y lleva la linea ahi. No mueve nada.
        // Resuelve por ALTURA, no por lo que haya bajo el cursor: con
        // elementFromPoint la franja del grip y los margenes quedaban fuera de toda
        // fila y el destino se perdia. Aqui la X solo sirve para saber si sigues
        // dentro de la lista.
        markDrop(x, y) {
            const d      = this.drag;
            const scroll = d.scope.find('.tdw-scroll').get(0) || d.scope.get(0);
            const secs   = d.scope.find('.tdw-sec').get();
            const hide   = () => { d.dest = null; d.line.style.opacity = '0'; };
            if (!scroll || !secs.length) { hide(); return; }

            const sr = scroll.getBoundingClientRect();
            if (x < sr.left - 40 || x > sr.right + 40) { hide(); return; }   // fuera de la lista: se cancela

            // Seccion por franja vertical; fuera de todas, la de arriba o la de abajo.
            let sec = null;
            for (let i = 0; i < secs.length; i++) {
                const r = secs[i].getBoundingClientRect();
                if (y >= r.top && y <= r.bottom) { sec = secs[i]; break; }
            }
            if (!sec) sec = (y < secs[0].getBoundingClientRect().top) ? secs[0] : secs[secs.length - 1];

            // Primera fila cuyo medio queda por debajo del cursor: la linea va encima.
            const rows = $(sec).find('.tdw-task').get().filter((el) => el !== d.row);
            let edge = null;
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i].getBoundingClientRect();
                if (y < r.top + r.height / 2) {
                    d.dest = { ref: rows[i], after: false };
                    edge   = { top: r.top, left: r.left, width: r.width };
                    break;
                }
            }
            if (!edge && rows.length) {                          // por debajo de todas: al final
                const r = rows[rows.length - 1].getBoundingClientRect();
                d.dest = { ref: rows[rows.length - 1], after: true };
                edge   = { top: r.bottom, left: r.left, width: r.width };
            }
            if (!edge) {                                         // seccion sin otras tareas
                const add = sec.querySelector('.tdw-add') || sec;
                const r   = add.getBoundingClientRect();
                d.dest = { sec: sec };
                edge   = { top: r.top, left: r.left, width: r.width };
            }

            d.line.style.opacity = '1';
            d.line.style.top     = Math.round(edge.top) + 'px';
            d.line.style.left    = Math.round(edge.left) + 'px';
            d.line.style.width   = Math.round(edge.width) + 'px';
        }

        // Un solo recalculo por cuadro: el pointermove solo anota la posicion. Un
        // mouse de alta frecuencia dispara decenas de eventos por frame y resolver
        // ahi el destino es lo que se siente pesado.
        dragFrame() {
            const d = this.drag;
            if (!d || !d.moved) return;
            let scrolled = false;
            const el = d.scope.find('.tdw-scroll').get(0);
            if (el) {
                const r = el.getBoundingClientRect();
                if (d.y - r.top < 50)         { el.scrollTop -= 14; scrolled = true; }
                else if (r.bottom - d.y < 50) { el.scrollTop += 14; scrolled = true; }
            }
            d.ghost.style.transform = 'translate3d(' + (d.x - d.dx) + 'px,' + (d.y - d.dy) + 'px,0)';
            if (scrolled || d.x !== d.px || d.y !== d.py) {
                this.markDrop(d.x, d.y);
                d.px = d.x;
                d.py = d.y;
            }
            d.raf = requestAnimationFrame(() => this.dragFrame());
        }

        endDragTask() {
            $(document).off('.tdwdrag');
            const d = this.drag;
            this.drag = null;
            if (!d) return;
            cancelAnimationFrame(d.raf);
            if (d.ghost) d.ghost.remove();
            if (d.line)  d.line.remove();
            d.scope.removeClass('tdw-dnd');
            $(d.row).removeClass('is-dragging');
            if (!d.moved || !d.dest) return;                  // sin destino valido no hubo movimiento

            if (d.dest.ref) {
                if (d.dest.after) d.dest.ref.after(d.row); else d.dest.ref.before(d.row);
            } else if (d.dest.sec) {
                const add = d.dest.sec.querySelector('.tdw-add');
                if (add) d.dest.sec.insertBefore(d.row, add); else d.dest.sec.appendChild(d.row);
            }
            const $row = $(d.row).addClass('is-dropped');
            setTimeout(() => $row.removeClass('is-dropped'), 320);
            this.commitTaskRow($row);
        }

        // Aplica al modelo la posicion en que quedo la fila: se saca la tarea de su
        // seccion y se reinserta detras de la tarea anterior (o al inicio si quedo
        // primera). Se resuelve por vecino y no por el indice del DOM porque el
        // filtro activo puede tener tareas ocultas que no deben perder su lugar.
        commitTaskRow($row) {
            const id   = $row.data('id');
            const list = this.listOf($row);
            if (!id || !$row.length || !list) return;
            if (!this.canEdit(list)) { this.renderMain(); return; }   // prestada en consulta: se deshace

            const destId = $row.closest('.tdw-sec').data('sec');
            const dest   = (list.sections || []).filter((s) => s.id === destId)[0];
            if (!dest) { this.renderMain(); return; }

            let task = null, fromSec = null;
            (list.sections || []).forEach((s) => {
                const i = (s.tasks || []).map((t) => t.id).indexOf(id);
                if (i >= 0) { task = s.tasks[i]; fromSec = s; }
            });
            if (!task) { this.renderMain(); return; }

            const snap   = () => (list.sections || []).map((s) => (s.tasks || []).map((t) => t.id).join(',')).join('|');
            const before = snap();
            const prevId = $row.prevAll('.tdw-task').first().data('id');

            fromSec.tasks = (fromSec.tasks || []).filter((t) => t.id !== id);
            const at = prevId ? dest.tasks.map((t) => t.id).indexOf(prevId) + 1 : 0;
            dest.tasks.splice(at, 0, task);

            if (snap() === before) return;                 // volvio a su sitio: no se escribe
            this.persist(list, true);
            if (fromSec !== dest) this.renderMain();        // cambiaron los contadores por seccion
        }

        // La lista a la que pertenece un elemento del DOM. En el modal casi siempre
        // es la abierta, pero el panel embebido en el visor trabaja otra lista a la
        // vez: por eso manda el contenedor marcado con data-listkey y no `openKey`.
        listOf($el) {
            const key = ($el && $el.length) ? $el.closest('[data-listkey]').attr('data-listkey') : '';
            return this.listByKey(key || this.openKey);
        }

        refOf($el) {
            const $task = $el.closest('.tdw-task');
            const key   = ($task.length && $task.data('key')) ||
                          $el.closest('[data-listkey]').attr('data-listkey') || this.openKey;
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
