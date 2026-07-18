/* Sincroniza en SQLite (ctrl/ctrl-prefs.php) las preferencias que antes solo vivían en
 * localStorage: las cuentas del panel de créditos y la configuración de modelos LLM.
 *
 * localStorage sigue siendo la caché de LECTURA (síncrona: model-config y account-menu
 * leen la preferencia en medio de un render y no pueden esperar una promesa). El servidor
 * es la copia DURABLE: sobrevive al borrado de caché y sigue al usuario entre navegadores.
 *
 * Al cargar la página:
 *   - la clave que existe en el servidor pisa a la local (el servidor manda);
 *   - la que solo existe en local se sube (migra sola lo que ya había en el navegador).
 * Terminada la sincronización dispara `coffeeia:prefs-synced` con las claves que cambiaron,
 * para que quien las tenga en pantalla se repinte. */
(function (global) {
    'use strict';

    const API   = 'ctrl/ctrl-prefs.php';
    const EVT   = 'coffeeia:prefs-synced';
    // Claves espejadas en SQLite. Deben coincidir con PREFS_ALLOWED de ctrl-prefs.php.
    const KEYS  = [
        'coffeeia:claude:accounts',
        'coffeeia:claude:reminderFired',
        'coffeeia:global:enabledModels',
        'coffeeia:global:activeModel',
        'visor:shortcuts:v1',
        'visor:recentViews:v1',
        'visor:recentCreated:v1'
    ];

    let _ready  = false;          // ya terminó la primera sincronización
    let _queued = {};             // escrituras hechas antes de que la sync terminara

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

    // Sube una preferencia al servidor. Fire-and-forget: si falla, el valor sigue en
    // localStorage y se reintenta en la próxima carga (la sync lo detecta como "solo local").
    function push(key, value) {
        if (KEYS.indexOf(key) === -1) return;
        if (!_ready) { _queued[key] = true; return; }   // aún sincronizando: se envía al terminar
        global.jQuery.post(API, { action: 'set', key: key, value: String(value == null ? '' : value) })
            .fail(function () { /* silencioso: localStorage conserva el valor */ });
    }

    function pushLocal(key) { push(key, lsGet(key) || ''); }

    function sync() {
        global.jQuery.get(API, { action: 'list' })
            .done(function (res) {
                if (!res || !res.success) { finish([]); return; }
                const remote  = res.prefs || {};
                const changed = [];
                const toUpload = [];

                KEYS.forEach(function (k) {
                    const hasRemote = Object.prototype.hasOwnProperty.call(remote, k);
                    const local     = lsGet(k);
                    if (hasRemote) {
                        if (remote[k] !== local) { lsSet(k, remote[k]); changed.push(k); }
                    } else if (local !== null && local !== '') {
                        toUpload.push(k);   // solo estaba en este navegador: se migra al servidor
                    }
                });

                finish(changed, toUpload);
            })
            .fail(function () { finish([]); });   // sin servidor se opera solo con localStorage
    }

    function finish(changed, toUpload) {
        _ready = true;
        (toUpload || []).forEach(pushLocal);
        // Escrituras que ocurrieron mientras sincronizábamos: mandan sobre lo remoto.
        Object.keys(_queued).forEach(pushLocal);
        _queued = {};

        if (changed && changed.length) {
            try { global.dispatchEvent(new CustomEvent(EVT, { detail: { keys: changed } })); } catch (e) {}
        }
    }

    global.CoffeePrefs = {
        KEYS:  KEYS,
        EVENT: EVT,
        push:  push,
        isReady: function () { return _ready; }
    };

    if (global.jQuery) {
        global.jQuery(sync);
    } else {
        _ready = true;   // sin jQuery no hay backend: modo solo-localStorage
    }
})(window);
