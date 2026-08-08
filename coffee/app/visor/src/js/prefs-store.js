/* Sincroniza en SQLite (ctrl/ctrl-prefs.php) las preferencias que antes solo vivían en
 * localStorage: las cuentas del panel de créditos y la configuración de modelos LLM.
 *
 * localStorage sigue siendo la caché de LECTURA (síncrona: model-config y account-menu
 * leen la preferencia en medio de un render y no pueden esperar una promesa). El servidor
 * es la copia DURABLE: sobrevive al borrado de caché y sigue al usuario entre navegadores.
 *
 * Al cargar la página:
 *   - la clave que existe en el servidor pisa a la local (el servidor manda);
 *   - la que solo existe en local se sube (migra sola lo que ya había en el navegador);
 *   - EXCEPCIÓN: una clave PENDIENTE (escrita en este navegador y aún no confirmada por
 *     el servidor) nunca se pisa — si el servidor no pudo guardarla, su copia está vieja
 *     y pisar con ella borraría el cambio del usuario en cada recarga.
 * Terminada la sincronización dispara `coffeeia:prefs-synced` con las claves que cambiaron,
 * para que quien las tenga en pantalla se repinte.
 *
 * Los fallos NO son silenciosos: si el servidor rechaza una escritura (carpeta data/ sin
 * permisos, pdo_sqlite ausente, sesión caída) o no responde, se dispara
 * `coffeeia:prefs-error` con { key, stage, message }. Quien lo escuche puede avisar al
 * usuario de que su ajuste solo vive en este navegador. */
(function (global) {
    'use strict';

    const API   = 'ctrl/ctrl-prefs.php';
    const EVT   = 'coffeeia:prefs-synced';
    const ERR   = 'coffeeia:prefs-error';
    // Claves espejadas en SQLite. Deben coincidir con PREFS_ALLOWED de ctrl-prefs.php.
    const KEYS  = [
        'coffeeia:claude:accounts',
        'coffeeia:claude:reminderFired',
        'coffeeia:claude:resetPinDismissed',
        'coffeeia:global:enabledModels',
        'coffeeia:global:activeModel',
        'coffeeia:global:modelCatalog',
        'coffeeia:global:uiTheme',
        'visor:shortcuts:v1',
        'visor:recentViews:v1',
        'visor:recentCreated:v1',
        'visor:todoArchived:v1'
    ];

    let _ready  = false;          // ya terminó la primera sincronización
    let _online = null;           // ¿el servidor contestó el list? (null = aún sin saber)
    let _queued = {};             // escrituras hechas antes de que la sync terminara
    let _dirty  = {};             // escrituras que el servidor todavía no confirmó
    let _last   = null;           // último error { key, stage, message }

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

    // Un fallo de persistencia no rompe la app (localStorage conserva el valor), pero sí
    // se anuncia: el usuario cree haber guardado "para todos sus chats" y no fue así.
    function fail(key, stage, message) {
        _last = { key: key || '', stage: stage, message: message || '' };
        console.warn('[prefs] ' + stage + (key ? ' · ' + key : '') + ': ' + (message || 'sin detalle'));
        try { global.dispatchEvent(new CustomEvent(ERR, { detail: _last })); } catch (e) {}
    }

    // Lee el motivo que mandó ctrl-prefs.php (JSON) o, si respondió HTML/404, algo legible.
    function reasonOf(xhr) {
        if (!xhr) return 'sin respuesta del servidor';
        if (xhr.status === 0) return 'sin conexión con el servidor';
        const res = xhr.responseJSON;
        if (res && res.message) return res.message;
        return 'HTTP ' + xhr.status + ' ' + (xhr.statusText || '');
    }

    // Sube una preferencia al servidor. La clave queda PENDIENTE hasta que el servidor
    // confirme; si falla, se reintenta en la próxima carga y la sync no la pisa.
    function push(key, value) {
        if (KEYS.indexOf(key) === -1) return;
        if (!global.jQuery) return;                     // pagina sin backend: solo localStorage
        if (!_ready) { _queued[key] = true; return; }   // aún sincronizando: se envía al terminar
        _dirty[key] = true;
        global.jQuery.post(API, { action: 'set', key: key, value: String(value == null ? '' : value) })
            .done(function (res) {
                if (res && res.success) { delete _dirty[key]; _online = true; return; }
                fail(key, 'no se pudo guardar en el servidor', (res && res.message) || 'respuesta inesperada');
            })
            .fail(function (xhr) { fail(key, 'no se pudo guardar en el servidor', reasonOf(xhr)); });
    }

    function pushLocal(key) { push(key, lsGet(key) || ''); }

    function sync() {
        global.jQuery.get(API, { action: 'list' })
            .done(function (res) {
                if (!res || !res.success) {
                    fail('', 'el servidor no devolvió las preferencias', (res && res.message) || 'respuesta inesperada');
                    _online = false;
                    finish([]);
                    return;
                }
                _online = true;
                const remote  = res.prefs || {};
                const changed = [];
                const toUpload = [];

                KEYS.forEach(function (k) {
                    const hasRemote = Object.prototype.hasOwnProperty.call(remote, k);
                    const local     = lsGet(k);
                    if (hasRemote && !_dirty[k] && !_queued[k]) {
                        if (remote[k] !== local) { lsSet(k, remote[k]); changed.push(k); }
                    } else if (local !== null && local !== '') {
                        // Solo estaba en este navegador, o quedó pendiente de una carga
                        // anterior: en ambos casos manda lo local.
                        toUpload.push(k);
                    }
                });

                finish(changed, toUpload);
            })
            .fail(function (xhr) {
                // Sin servidor se opera solo con localStorage: el ajuste no seguirá al
                // usuario a otro navegador ni sobrevivirá al borrado de caché.
                _online = false;
                fail('', 'sin sincronización con el servidor', reasonOf(xhr));
                finish([]);
            });
    }

    function finish(changed, toUpload) {
        _ready = true;
        const pending = Object.keys(_queued);
        _queued = {};
        // Escrituras que ocurrieron mientras sincronizábamos: mandan sobre lo remoto.
        (toUpload || []).concat(pending).forEach(function (k, i, all) {
            if (all.indexOf(k) === i) pushLocal(k);      // sin repetir
        });

        if (changed && changed.length) {
            try { global.dispatchEvent(new CustomEvent(EVT, { detail: { keys: changed } })); } catch (e) {}
        }
    }

    global.CoffeePrefs = {
        KEYS:  KEYS,
        EVENT: EVT,
        ERROR_EVENT: ERR,
        push:  push,
        isReady: function () { return _ready; },
        // ¿El servidor está guardando de verdad? false = todo vive solo en este navegador.
        isOnline: function () { return _online !== false; },
        // Claves escritas que el servidor todavía no confirmó.
        pending: function () { return Object.keys(_dirty); },
        lastError: function () { return _last; }
    };

    /* ── Temas de la interfaz ────────────────────────────────────────────────
     * Catalogo unico para todas las paginas del visor. Cada modulo guardaba su
     * tema con `t === 'light' ? 'light' : 'dark'`, asi que cualquier valor nuevo
     * caia en "dark" y no habia forma de sumar un tercero sin tocar seis archivos
     * a mano. Aqui vive la lista y la normalizacion; los modulos solo preguntan.
     *
     * `dark` es el navy de siempre con terracota; `midnight`, azul noche con
     * celeste; `light`, el claro. Los dos primeros son oscuros, asi que un modulo
     * que solo distinga claro/oscuro puede usar `isDark()`.
     *
     * El tema se guarda en UNA sola clave para todo coffee/app/. Antes cada pagina
     * tenia la suya (`agents:theme`, `lab:theme`, `costsys_ia_theme`, el `uiTheme`
     * dentro del settings de cada modulo), asi que cambiarlo en el Visor y navegar
     * a Agentes devolvia al usuario al tema anterior. `LEGACY_KEYS` existe para no
     * perder lo que ya habia elegido: la primera vez se adopta la clave vieja.
     */
    const THEMES = [
        { key: 'dark',     label: 'Oscuro',     icon: 'moon',  dark: true  },
        { key: 'midnight', label: 'Medianoche', icon: 'stars', dark: true  },
        { key: 'light',    label: 'Claro',      icon: 'sun',   dark: false }
    ];

    const THEME_KEY   = 'coffeeia:global:uiTheme';
    const THEME_EVT   = 'coffeeia:theme-changed';
    const LEGACY_KEYS = ['agents:theme', 'lab:theme', 'costsys_ia_theme'];

    function themeOf(key) {
        const k = String(key || '');
        return THEMES.filter(function (t) { return t.key === k; })[0] || THEMES[0];
    }

    // Preferencia previa de esta pagina, para migrarla la primera vez. `settings`
    // es el JSON de modulos como visor/chat/coffeeia, donde el tema es un campo.
    function legacyTheme(settingsKey, field) {
        for (let i = 0; i < LEGACY_KEYS.length; i++) {
            const v = lsGet(LEGACY_KEYS[i]);
            if (v) return v;
        }
        if (!settingsKey) return '';
        try {
            const s = JSON.parse(lsGet(settingsKey) || '{}');
            return String(s[field || 'uiTheme'] || s.theme || '');
        } catch (e) { return ''; }
    }

    global.CoffeeTheme = {
        LIST: THEMES,
        KEY:   THEME_KEY,
        EVENT: THEME_EVT,
        /** Valor valido a partir de cualquier cosa guardada. */
        normalize: function (key) { return themeOf(key).key; },
        /** Ficha del tema (label, icono, si es oscuro). */
        info: function (key) { return themeOf(key); },
        /** ¿Se pinta sobre fondo oscuro? Para quien solo necesita saber eso. */
        isDark: function (key) { return themeOf(key).dark; },
        /** Siguiente tema del ciclo, para el boton de la barra. */
        next: function (key) {
            const i = THEMES.indexOf(themeOf(key));
            return THEMES[(i + 1) % THEMES.length].key;
        },
        /**
         * Tema vigente para toda la app. Si aun no hay clave global adopta la que
         * tuviera esta pagina, para que el primer arranque no cambie lo que el
         * usuario veia.
         */
        load: function (settingsKey, field) {
            const saved = lsGet(THEME_KEY);
            if (saved) return themeOf(saved).key;
            return themeOf(legacyTheme(settingsKey, field)).key;
        },
        /** Persiste el tema para todas las paginas (localStorage + SQLite). */
        save: function (key) {
            const t = themeOf(key).key;
            lsSet(THEME_KEY, t);
            push(THEME_KEY, t);
            return t;
        },
        /** Lo escribe en el documento. Devuelve el tema aplicado. */
        apply: function (key) {
            const t = themeOf(key).key;
            document.documentElement.setAttribute('data-theme', t);
            document.body.setAttribute('data-theme', t);
            return t;
        },
        /**
         * Aplica + persiste + avisa. El evento lo escucha quien tenga contenido ya
         * pintado que dependa del tema y no pueda repintarse desde cero sin perder
         * el estado del usuario (ver ia-render.js: ERS e historias de usuario).
         */
        set: function (key) {
            const t = this.apply(key);
            this.save(t);
            try { global.dispatchEvent(new CustomEvent(THEME_EVT, { detail: { theme: t } })); } catch (e) {}
            return t;
        }
    };

    // Si el servidor traia otro tema (el usuario lo cambio en otro navegador), la sync
    // ya piso el localStorage: falta reflejarlo en la pagina que ya esta pintada.
    global.addEventListener(EVT, function (e) {
        const keys = (e.detail && e.detail.keys) || [];
        if (keys.indexOf(THEME_KEY) !== -1) global.CoffeeTheme.set(lsGet(THEME_KEY));
    });

    if (global.jQuery) {
        global.jQuery(sync);
    } else {
        _ready = true;   // sin jQuery no hay backend: modo solo-localStorage
        _online = false;
    }
})(window);
