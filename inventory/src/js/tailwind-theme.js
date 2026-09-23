/*
 * Paleta de inventory: el motor de color del tema y su config de Tailwind.
 *
 * Un tema trae tres hex (fayxzvov_erp.themes):
 *   accent          -> pestañas, chips, selección. De él sale la rampa
 *                      50..950 que Tailwind usa como `blue-*` (bg-blue-600, ...).
 *   primary_color   -> los botones principales. Tailwind lo expone como `main`
 *                      (bg-main, hover:bg-main-hover...). No se llama `primary`
 *                      porque style.css ya tiene un .bg-primary con !important.
 *   secondary_color -> los detalles de la barra, el foco de los inputs y el
 *                      hover de las cards: rampa --accent-2-50..950. Huubie lo
 *                      lleva morado sobre su azul; sin él, es el acento.
 * Las hojas escritas a mano leen lo mismo desde colors.css (--primary,
 * --secondary, --info...), que cuelgan de estas variables.
 *
 * Y un `scheme` para el fondo de la página:
 *   light              -> el gris de siempre (#F3F4F6). Los temas claros nunca
 *                         lo cambian.
 *   huubie | midnight  -> página oscura: body.dark-mode (src/css/dark-mode.css)
 *                         con sus superficies según data-scheme en <html>, y la
 *                         clase `dark` para las variantes dark: de Tailwind.
 *
 * Los valores van como canales RGB sueltos ("192 90 64") y no como hex porque
 * Tailwind los consume como rgb(var(--x) / <alpha-value>): así siguen
 * funcionando los modificadores de opacidad del tipo bg-blue-600/10.
 *
 * Debe cargarse JUSTO DESPUÉS de <script src="https://cdn.tailwindcss.com"></script>.
 */
(function () {
    var KEY = 'inventory:palette';

    // Las rampas de los temas de siempre, afinadas a mano: se usan tal cual
    // cuando el acento coincide, para que Claro, Agents y Avatar no cambien.
    var TERRACOTA = {
        50: '251 243 239', 100: '247 227 220', 200: '239 201 188', 300: '232 166 143',
        400: '217 130 106', 500: '200 105 76', 600: '192 90 64', 700: '168 74 51',
        800: '143 61 42', 900: '110 47 32', 950: '74 31 22'
    };

    var PRESETS = {
        '#C05A40': TERRACOTA,
        // Agents (shadcn neutro): sobre un casi negro el hover solo se nota ACLARANDO.
        '#171717': {
            50: '250 250 250', 100: '245 245 245', 200: '229 229 229', 300: '212 212 212',
            400: '163 163 163', 500: '115 115 115', 600: '23 23 23', 700: '38 38 38',
            800: '10 10 10', 900: '5 5 5', 950: '0 0 0'
        },
        // Avatar: la violet de Tailwind, su 600 es el #7C3AED del origen.
        '#7C3AED': {
            50: '245 243 255', 100: '237 233 254', 200: '221 214 254', 300: '196 181 253',
            400: '167 139 250', 500: '139 92 246', 600: '124 58 237', 700: '109 40 217',
            800: '91 33 182', 900: '76 29 149', 950: '46 16 101'
        },
        // ERP Corporativo: la blue de Tailwind tal cual, la que pinta erp-pro.
        '#2563EB': {
            50: '239 246 255', 100: '219 234 254', 200: '191 219 254', 300: '147 197 253',
            400: '96 165 250', 500: '59 130 246', 600: '37 99 235', 700: '29 78 216',
            800: '30 64 175', 900: '30 58 138', 950: '23 37 84'
        }
    };

    var GRAY = {
        50: '249 250 251', 100: '243 244 246', 200: '229 231 235', 300: '209 213 219',
        400: '156 163 175', 500: '107 114 128', 600: '75 85 99', 700: '55 65 81',
        800: '31 41 55', 900: '17 24 39', 950: '3 7 18'
    };

    // Con un acento sin color (negro, grafito, gris) los grises pierden el
    // tinte azulado de Tailwind, como en Agents. El fondo NO se toca.
    var NEUTRAL = {
        50: '250 250 250', 100: '245 245 245', 200: '229 229 229', 300: '212 212 212',
        400: '163 163 163', 500: '115 115 115', 600: '82 82 82', 700: '64 64 64',
        800: '38 38 38', 900: '23 23 23', 950: '10 10 10'
    };

    var WHITE = [255, 255, 255];
    var BLACK = [0, 0, 0];

    function channels(hex) {
        var h = String(hex || '').trim().replace('#', '');
        if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
        if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
        return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
    }

    function mix(c, target, w) {
        return c.map(function (v, i) { return Math.round(v + (target[i] - v) * w); });
    }

    function str(c) {
        return c.join(' ');
    }

    function luma(c) {
        return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
    }

    function isNeutral(c) {
        return Math.max.apply(null, c) - Math.min.apply(null, c) < 24;
    }

    // Rampa 50..950 con el acento como 600: hacia blanco las claras, hacia
    // negro las oscuras. En un color muy oscuro el 700 (hover) aclara.
    function ramp(hex) {
        var key = '#' + String(hex || '').replace('#', '').toUpperCase();
        if (PRESETS[key]) return PRESETS[key];

        var c = channels(hex);
        if (!c) return TERRACOTA;

        var dark = luma(c) < 0.2;

        return {
            50: str(mix(c, WHITE, 0.94)),
            100: str(mix(c, WHITE, 0.87)),
            200: str(mix(c, WHITE, 0.73)),
            300: str(mix(c, WHITE, 0.54)),
            400: str(mix(c, WHITE, 0.32)),
            500: str(mix(c, WHITE, 0.14)),
            600: str(c),
            700: str(dark ? mix(c, WHITE, 0.10) : mix(c, BLACK, 0.14)),
            800: str(mix(c, BLACK, 0.28)),
            900: str(mix(c, BLACK, 0.44)),
            950: str(mix(c, BLACK, 0.62))
        };
    }

    // Tonos del primario. El grafito ya es oscuro: su hover ACLARA.
    function primaryTones(hex) {
        var c = channels(hex) || [41, 37, 36];
        var dark = luma(c) < 0.2;

        return {
            base: str(c),
            hover: str(dark ? mix(c, WHITE, 0.12) : mix(c, BLACK, 0.12)),
            active: str(mix(c, BLACK, 0.30)),
            light: str(mix(c, WHITE, 0.38))
        };
    }

    function setScale(style, token, scale) {
        Object.keys(scale).forEach(function (k) { style.setProperty('--' + token + '-' + k, scale[k]); });
    }

    var SCHEMES = ['light', 'huubie', 'midnight'];

    // body.dark-mode es la llave que usan dark-mode.css, sidebar.js y las
    // páginas con script inline. En el <head> el body aún no existe: se pone
    // en cuanto aparece.
    function applyScheme(scheme) {
        var html = document.documentElement;
        var dark = scheme !== 'light';

        html.setAttribute('data-scheme', scheme);
        html.classList.toggle('dark', dark);

        var paintBody = function () {
            document.body.classList.toggle('dark-mode', dark);
            document.body.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
        };

        if (document.body) paintBody();
        else document.addEventListener('DOMContentLoaded', paintBody, { once: true });

        try {
            localStorage.setItem('darkMode', dark ? 'true' : 'false');
        } catch (e) { /* modo privado */ }
    }

    // Se escribe en el style de <html>: gana a los :root de las hojas y lo
    // heredan todas, incluidas las que cuelgan de colors.css.
    function apply(palette) {
        var style  = document.documentElement.style;
        var accent = channels(palette && palette.accent) || [192, 90, 64];
        var tones  = primaryTones(palette && palette.primary);
        var scheme = SCHEMES.indexOf(palette && palette.scheme) > -1 ? palette.scheme : 'light';

        applyScheme(scheme);

        var secondary = palette && channels(palette.secondary) ? palette.secondary : palette && palette.accent;

        setScale(style, 'brand', ramp(palette && palette.accent));
        setScale(style, 'accent-2', ramp(secondary));

        if (isNeutral(accent)) {
            setScale(style, 'gray', NEUTRAL);
            style.setProperty('--line', '#E5E5E5');
            style.setProperty('--ink', '#0D0D0D');
            style.setProperty('--ink-dim', '#737373');
        } else {
            Object.keys(NEUTRAL).forEach(function (k) { style.removeProperty('--gray-' + k); });
            ['--line', '--ink', '--ink-dim'].forEach(function (p) { style.removeProperty(p); });
        }

        style.setProperty('--primary-rgb', tones.base);
        style.setProperty('--primary-hover-rgb', tones.hover);
        style.setProperty('--primary-active-rgb', tones.active);
        style.setProperty('--primary-light-rgb', tones.light);
    }

    function save(palette) {
        try {
            localStorage.setItem(KEY, JSON.stringify({ accent: palette.accent, primary: palette.primary, secondary: palette.secondary || palette.accent, scheme: palette.scheme || 'light' }));
        } catch (e) { /* modo privado: se aplica pero no se recuerda */ }
    }

    // -- Aviso "Aplicando tema" --
    // Velo con una tarjeta chica (anillo girando + texto) mientras el navbar
    // cambia de tema. Vive aquí y no en navbar.js porque, si el tema pasa de
    // claro a oscuro, la página se recarga y el aviso tiene que reaparecer en
    // la carga nueva desde el <head>, antes de que se pinte nada.
    var LOADER_KEY = 'inventory:theme-loading';
    var loaderEl   = null;

    var LOADER_CSS =
        '.inv-theme-loader{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(243,244,246,.72);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);opacity:0;transition:opacity .18s ease;}' +
        '.inv-theme-loader.is-visible{opacity:1;}' +
        '.inv-theme-loader__card{display:flex;align-items:center;gap:12px;padding:14px 22px 14px 16px;border-radius:14px;background:var(--surface,#FFFFFF);border:1px solid var(--line,#E5E7EB);box-shadow:0 12px 32px rgba(15,23,42,.14);transform:translateY(6px) scale(.97);transition:transform .22s cubic-bezier(.2,.8,.2,1);}' +
        '.inv-theme-loader.is-visible .inv-theme-loader__card{transform:none;}' +
        '.inv-theme-loader.is-instant,.inv-theme-loader.is-instant .inv-theme-loader__card{transition:none;}' +
        '.inv-theme-loader__ring{width:22px;height:22px;flex:none;border-radius:9999px;border:2.5px solid rgb(var(--brand-600,192 90 64)/.18);border-top-color:rgb(var(--brand-600,192 90 64));animation:inv-theme-spin .75s linear infinite;transition:border-color .3s ease;}' +
        '.inv-theme-loader__text{display:flex;flex-direction:column;line-height:1.3;}' +
        '.inv-theme-loader__text strong{font-size:14px;font-weight:600;color:var(--ink,#111827);}' +
        '.inv-theme-loader__text strong::after{content:"";display:inline-block;width:1.2em;animation:inv-theme-dots 1.2s steps(1,end) infinite;}' +
        '.inv-theme-loader__text small{font-size:12px;color:var(--ink-dim,#6B7280);}' +
        '.inv-theme-loader__text small:empty{display:none;}' +
        '@keyframes inv-theme-spin{to{transform:rotate(360deg);}}' +
        '@keyframes inv-theme-dots{0%{content:"";}25%{content:".";}50%{content:"..";}75%{content:"...";}}' +
        'html.dark .inv-theme-loader{background:color-mix(in srgb,var(--dk-bg,#111928) 72%,transparent);}' +
        'html.dark .inv-theme-loader__card{background:var(--dk-card,#1F2A37);border-color:var(--dk-line,#374151);box-shadow:0 16px 40px rgba(0,0,0,.45);}' +
        'html.dark .inv-theme-loader__text strong{color:var(--dk-text,#F9FAFB);}' +
        'html.dark .inv-theme-loader__text small{color:var(--dk-muted,#9CA3AF);}' +
        '@media (prefers-reduced-motion:reduce){.inv-theme-loader__ring{animation-duration:2s;}.inv-theme-loader__text strong::after{animation:none;content:"…";}}';

    function loaderCss() {
        if (document.getElementById('invThemeLoaderCss')) return;

        var css = document.createElement('style');
        css.id = 'invThemeLoaderCss';
        css.textContent = LOADER_CSS;
        document.head.appendChild(css);
    }

    // En el <head> el body todavía no existe: el aviso se cuelga en cuanto el
    // parser lo crea, antes del primer pintado.
    function whenBody(fn) {
        if (document.body) return fn();

        new MutationObserver(function (list, observer) {
            if (!document.body) return;
            observer.disconnect();
            fn();
        }).observe(document.documentElement, { childList: true });
    }

    // `instant`: aparece ya visible, sin el fundido de entrada (la carga nueva
    // tras la recarga, que debe verse igual que la página que se fue).
    function showLoader(label, instant) {
        loaderCss();

        whenBody(function () {
            if (!loaderEl) {
                loaderEl = document.createElement('div');
                loaderEl.className = 'inv-theme-loader';
                loaderEl.setAttribute('role', 'status');
                loaderEl.setAttribute('aria-live', 'polite');
                loaderEl.innerHTML = '<div class="inv-theme-loader__card"><span class="inv-theme-loader__ring"></span><span class="inv-theme-loader__text"><strong>Aplicando tema</strong><small></small></span></div>';
            }

            loaderEl.querySelector('small').textContent = label || '';
            loaderEl.classList.toggle('is-instant', !!instant);
            document.body.appendChild(loaderEl);

            // Lee el layout para fijar opacity:0 antes de encender la
            // transición; sin esto el fundido de entrada no corre.
            void loaderEl.offsetWidth;
            loaderEl.classList.add('is-visible');
        });
    }

    function hideLoader() {
        if (!loaderEl) return;

        loaderEl.classList.remove('is-instant', 'is-visible');
        setTimeout(function () {
            if (loaderEl && !loaderEl.classList.contains('is-visible')) loaderEl.remove();
        }, 250);
    }

    // Deja dicho a la próxima carga que siga mostrando el aviso.
    function carryLoader(label) {
        try {
            sessionStorage.setItem(LOADER_KEY, label || '');
        } catch (e) { /* sin sessionStorage: la carga nueva entra sin aviso */ }
    }

    window.InventoryPalette = {
        ramp: ramp,
        apply: apply,
        save: save,
        loader: { show: showLoader, hide: hideLoader, carry: carryLoader }
    };

    // La paleta guardada se aplica ANTES de pintar nada: este script corre en
    // el <head>, así que la página nunca asoma con los colores del tema
    // anterior. `inventory:theme` e `inventory:accent` son claves de antes del
    // 22/09/2026; se traducen una vez y el navbar escribe la nueva.
    try {
        var saved = JSON.parse(localStorage.getItem(KEY) || 'null');

        if (!saved) {
            var legacy = localStorage.getItem('inventory:accent') || localStorage.getItem('inventory:theme');
            saved = {
                agents: { accent: '#171717', primary: '#171717' },
                neutro: { accent: '#171717', primary: '#171717' },
                avatar: { accent: '#7C3AED', primary: '#7C3AED' },
                violeta: { accent: '#7C3AED', primary: '#7C3AED' }
            }[legacy] || null;
        }

        if (saved) apply(saved);
    } catch (e) { /* sin localStorage: arranca en Claro */ }

    // Recarga pedida por el navbar al cambiar de claro a oscuro (o al revés):
    // el aviso sigue en pantalla hasta que la página nueva terminó de cargar.
    // El tope de 5 s evita que un recurso lento la deje tapada.
    try {
        var pending = sessionStorage.getItem(LOADER_KEY);

        if (pending !== null) {
            sessionStorage.removeItem(LOADER_KEY);
            showLoader(pending, true);

            window.addEventListener('load', function () { setTimeout(hideLoader, 250); }, { once: true });
            setTimeout(hideLoader, 5000);
        }
    } catch (e) { /* sin sessionStorage */ }

    if (typeof tailwind === 'undefined') return;

    function scale(token, fallback) {
        var out = {};
        Object.keys(fallback).forEach(function (k) {
            out[k] = 'rgb(var(--' + token + '-' + k + ', ' + fallback[k] + ') / <alpha-value>)';
        });
        return out;
    }

    tailwind.config = {
        // Las variantes dark: siguen al tema (clase `dark` en <html>), no a la
        // preferencia del sistema operativo.
        darkMode: 'class',
        theme: {
            extend: {
                colors: {
                    // Acento. Respaldo: rampa terracota del tema Claro (600 = #C05A40).
                    blue: scale('brand', TERRACOTA),
                    // Neutros de contenedores. Respaldo: el gray de Tailwind de siempre.
                    gray: scale('gray', GRAY),
                    // Primario. Respaldo: grafito #292524 de Claro.
                    main: {
                        DEFAULT: 'rgb(var(--primary-rgb, 41 37 36) / <alpha-value>)',
                        hover: 'rgb(var(--primary-hover-rgb, 68 64 60) / <alpha-value>)',
                        active: 'rgb(var(--primary-active-rgb, 28 25 23) / <alpha-value>)',
                        light: 'rgb(var(--primary-light-rgb, 120 113 108) / <alpha-value>)'
                    }
                }
            }
        }
    };
})();
