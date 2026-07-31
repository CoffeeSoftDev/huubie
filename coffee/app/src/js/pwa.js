/* ─────────────────────────────────────────────────────────────
 *  CoffeeSoft — capa PWA (registro del SW + instalación)
 *  Se carga con defer desde partials/pwa-head.php, así que aplica al
 *  login y a todas las páginas del visor sin tocar su JS.
 *  window.PWA_BASE lo define ese mismo partial (URL de coffee/app/).
 * ───────────────────────────────────────────────────────────── */

(function () {
    'use strict';

    const BASE = (window.PWA_BASE || '').replace(/\/$/, '');
    const DISMISS_KEY = 'pwa-install-dismissed';
    const DISMISS_MS = 7 * 24 * 60 * 60 * 1000; // el banner descartado calla una semana

    let deferredPrompt = null;
    let updating = false;   // true sólo cuando el usuario pidió actualizar
    let placeWatcher = null;

    // -- Barra de título del sistema: se funde con el header de la app --

    function currentTheme() {
        // Las páginas ponen data-theme en <html>, en <body> o en ambos
        return document.documentElement.getAttribute('data-theme')
            || document.body.getAttribute('data-theme')
            || 'dark';
    }

    function syncThemeColor() {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) return;
        meta.setAttribute('content', currentTheme() === 'light' ? '#FFFFFF' : '#141d2b');
    }

    function watchTheme() {
        syncThemeColor();
        const obs = new MutationObserver(syncThemeColor);
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        obs.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    }

    // -- Botón de instalación --

    function buildButton() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'btnInstallApp';
        btn.title = 'Instalar CoffeeSoft como aplicación';
        btn.innerHTML =
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' +
            '</svg><span>Instalar app</span>';
        btn.addEventListener('click', promptInstall);
        return btn;
    }

    // Cada página del visor nombra distinto su botón de tema (#btnThemeToggle,
    // #chatThemeToggle, #ciaThemeToggle…), pero todas comparten .theme-toggle:
    // ahí es donde se ancla. Si no hay header, el botón flota en la esquina.
    function placeButton() {
        if (!deferredPrompt) return;

        let btn = document.getElementById('btnInstallApp');
        if (!btn) btn = buildButton();

        const anchor = document.querySelector('.theme-toggle');
        if (anchor) {
            if (btn.parentNode !== anchor.parentNode) {
                btn.className = 'theme-toggle pwa-install-inline';
                anchor.parentNode.insertBefore(btn, anchor);
            }
            if (placeWatcher) { placeWatcher.disconnect(); placeWatcher = null; }
            return;
        }

        if (!btn.parentNode) {
            btn.className = 'pwa-install-float';
            document.body.appendChild(btn);
        }
    }

    function removeButton() {
        const btn = document.getElementById('btnInstallApp');
        if (btn) btn.remove();
        if (placeWatcher) { placeWatcher.disconnect(); placeWatcher = null; }
    }

    async function promptInstall() {
        if (!deferredPrompt) return;
        const prompt = deferredPrompt;
        deferredPrompt = null;
        prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome !== 'accepted') {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
        }
        removeButton();
    }

    function dismissed() {
        const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
        return ts > 0 && (Date.now() - ts) < DISMISS_MS;
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (dismissed()) return;
        placeButton();
        // El header de algunas páginas se pinta por JS: reintentamos al vuelo
        if (!placeWatcher && !document.querySelector('.theme-toggle')) {
            placeWatcher = new MutationObserver(placeButton);
            placeWatcher.observe(document.body, { childList: true, subtree: true });
        }
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        localStorage.removeItem(DISMISS_KEY);
        removeButton();
    });

    // Disponible desde consola o desde cualquier botón propio
    window.pwaInstall = promptInstall;

    // -- Aviso de versión nueva --

    function showUpdateToast(worker) {
        if (document.getElementById('pwaUpdateToast')) return;

        const toast = document.createElement('div');
        toast.id = 'pwaUpdateToast';
        toast.className = 'pwa-update-toast';
        toast.innerHTML =
            '<span>Hay una versión nueva de CoffeeSoft</span>' +
            '<button type="button" id="pwaUpdateBtn">Actualizar</button>' +
            '<button type="button" id="pwaUpdateClose" aria-label="Cerrar">&times;</button>';
        document.body.appendChild(toast);

        document.getElementById('pwaUpdateBtn').addEventListener('click', () => {
            updating = true;
            worker.postMessage({ type: 'SKIP_WAITING' });
        });
        document.getElementById('pwaUpdateClose').addEventListener('click', () => toast.remove());
    }

    // -- Registro del Service Worker --

    function registerSW() {
        if (!('serviceWorker' in navigator)) return;

        // Los SW sólo corren en contexto seguro: en local hay que entrar por
        // http://localhost/... o por HTTPS, no por un vhost http con nombre.
        if (!window.isSecureContext) {
            console.info('[PWA] Service Worker omitido: el origen no es seguro. Usa localhost o HTTPS para probar la instalación.');
            return;
        }

        navigator.serviceWorker.register(BASE + '/sw.js', { scope: BASE + '/' }).then((reg) => {
            if (reg.waiting) showUpdateToast(reg.waiting);

            reg.addEventListener('updatefound', () => {
                const nuevo = reg.installing;
                if (!nuevo) return;
                nuevo.addEventListener('statechange', () => {
                    // Sólo avisamos si ya había un SW controlando: si no, es la
                    // primera instalación y no hay nada que "actualizar".
                    if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
                        showUpdateToast(nuevo);
                    }
                });
            });
        }).catch((err) => console.warn('[PWA] No se pudo registrar el Service Worker:', err));

        // Sólo recargamos tras un "Actualizar" explícito; el claim() de la
        // primera instalación también dispara este evento y ahí no toca nada.
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!updating) return;
            updating = false;
            location.reload();
        });
    }

    watchTheme();
    registerSW();
})();
