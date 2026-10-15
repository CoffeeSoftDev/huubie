/*
 * Tema de Pedidos: Huubie (oscuro, el de siempre) o Huubie Claro.
 *
 * Se elige en el menú del usuario de la navbar (navbar.js) y se recuerda en
 * este navegador: localStorage['alpha:pedidos:theme'] = 'light' | 'dark'.
 * Lo leen las tres páginas de Pedidos (index, calendario y admin).
 *
 * Con Huubie Claro:
 *   - <html data-scheme="light">: lo usa src/css/theme-light.css para pasar a
 *     claro los fondos, bordes y textos oscuros que los módulos traen fijos.
 *   - La escala `blue-*` de Tailwind se vuelve la violet: en Huubie predomina
 *     el morado (mismo tema que inventory, fayxzvov_erp.themes 'huubie-claro').
 *   - Bootstrap pasa a data-bs-theme="light" (tablas, modales, paginación).
 *
 * Debe cargarse JUSTO DESPUÉS de <script src="https://cdn.tailwindcss.com"></script>
 * para que la página nunca asome en oscuro.
 */
(function () {
    var KEY = 'alpha:pedidos:theme';

    // La violet de Tailwind: su 600 es el #7C3AED de Huubie UI.
    var VIOLET = {
        50: '#F5F3FF', 100: '#EDE9FE', 200: '#DDD6FE', 300: '#C4B5FD', 400: '#A78BFA',
        500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9', 800: '#5B21B6', 900: '#4C1D95', 950: '#2E1065'
    };

    function get() {
        try {
            return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
        } catch (e) {
            return 'dark';
        }
    }

    // Los módulos se arman una sola vez con sus clases: cambiar de tema recarga.
    function set(scheme) {
        try {
            localStorage.setItem(KEY, scheme === 'light' ? 'light' : 'dark');
        } catch (e) { /* modo privado: no se recuerda */ }

        window.location.reload();
    }

    var light = get() === 'light';

    window.PedidosTheme = {
        get: get,
        set: set,
        isLight: function () { return light; },
        toggle: function () { set(light ? 'dark' : 'light'); }
    };

    if (!light) return;

    document.documentElement.setAttribute('data-scheme', 'light');

    if (typeof tailwind !== 'undefined') {
        tailwind.config = { theme: { extend: { colors: { blue: VIOLET } } } };
    }

    // El <body> trae data-bs-theme="dark" en el HTML. En el <head> aún no
    // existe: se cambia en cuanto el parser lo crea, antes del primer pintado.
    function paintBody() {
        document.body.setAttribute('data-bs-theme', 'light');
    }

    if (document.body) {
        paintBody();
    } else {
        new MutationObserver(function (list, observer) {
            if (!document.body) return;
            observer.disconnect();
            paintBody();
        }).observe(document.documentElement, { childList: true });
    }
})();
