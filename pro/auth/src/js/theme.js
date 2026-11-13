/*  Tema claro / oscuro de las paginas de acceso (login y recuperar).

    Va en el <head>, sin defer: pone data-theme en <html> ANTES de pintar, asi
    la pagina nunca parpadea con el tema contrario.

    Orden: lo que se eligio aqui -> el tema con el que quedo la app la ultima
    vez (huubie:pro:dark, lo escribe tailwind-theme.js) -> claro.
    La llave es propia: la de la app la manda el tema del usuario, no este boton. */
(function () {
    var KEY = 'huubie:pro:auth-theme';
    var html = document.documentElement;

    function stored() {
        try {
            var own = localStorage.getItem(KEY);
            if (own === 'light' || own === 'dark') return own;
            if (localStorage.getItem('huubie:pro:dark') === 'true') return 'dark';
        } catch (e) { /* modo privado */ }
        return 'light';
    }

    function paint(theme) {
        html.setAttribute('data-theme', theme);

        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === 'dark' ? '#111928' : '#FFFFFF');

        var buttons = document.querySelectorAll('[data-theme-set]');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].setAttribute('aria-pressed', buttons[i].getAttribute('data-theme-set') === theme ? 'true' : 'false');
        }
    }

    paint(stored());

    document.addEventListener('DOMContentLoaded', function () {
        paint(html.getAttribute('data-theme'));
    });

    document.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('[data-theme-set]') : null;
        if (!btn) return;

        var theme = btn.getAttribute('data-theme-set');

        // Solo al cambiar a mano se anima el cruce de colores; al cargar no.
        html.classList.add('theme-anim');
        paint(theme);
        setTimeout(function () { html.classList.remove('theme-anim'); }, 350);

        try { localStorage.setItem(KEY, theme); } catch (e2) { /* modo privado */ }
    });
})();
